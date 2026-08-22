-- Assess and evidence the monetary consequences of a consumer withdrawal
-- without triggering a payment. § 357 BGB requires return within 14 days and
-- normally through the original payment method; § 357a limits Wertersatz.

alter table public.pos_work_order_events
  drop constraint pos_work_order_events_action_check,
  add constraint pos_work_order_events_action_check
    check (action in (
      'created','updated','offered','accepted','started','completed','progress_invoiced',
      'final_invoiced','cancelled','withdrawn','contract_confirmation_delivered',
      'withdrawal_settlement_assessed','withdrawal_refund_recorded'
    ));

alter table public.pos_work_order_withdrawals
  add constraint pos_work_order_withdrawals_id_user_key unique (id, user_id);

create table public.pos_consumer_withdrawal_settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  work_order_id uuid not null,
  withdrawal_id uuid not null,
  gross_received_cents bigint not null check (gross_received_cents >= 0),
  already_refunded_cents bigint not null check (already_refunded_cents >= 0),
  retained_payment_cents bigint not null check (retained_payment_cents >= 0),
  value_compensation_cents bigint not null check (value_compensation_cents >= 0),
  refund_due_cents bigint not null check (refund_due_cents >= 0),
  consumer_balance_review_cents bigint not null check (consumer_balance_review_cents >= 0),
  refund_method text not null check (refund_method in ('original', 'agreed_alternative', 'not_required')),
  alternative_agreement_evidence text check (
    alternative_agreement_evidence is null
    or char_length(trim(alternative_agreement_evidence)) between 5 and 500
  ),
  value_compensation_reason text check (
    value_compensation_reason is null
    or char_length(trim(value_compensation_reason)) between 5 and 500
  ),
  refund_due_on date not null,
  assessed_at timestamptz not null default now(),
  constraint pos_withdrawal_settlement_order_user_fk
    foreign key (work_order_id, user_id)
    references public.pos_work_orders(id, user_id)
    on delete restrict,
  constraint pos_withdrawal_settlement_withdrawal_user_fk
    foreign key (withdrawal_id, user_id)
    references public.pos_work_order_withdrawals(id, user_id)
    on delete restrict,
  constraint pos_withdrawal_settlement_amounts_check check (
    already_refunded_cents <= gross_received_cents
    and retained_payment_cents = gross_received_cents - already_refunded_cents
    and refund_due_cents = greatest(retained_payment_cents - value_compensation_cents, 0)
    and consumer_balance_review_cents = greatest(value_compensation_cents - retained_payment_cents, 0)
  ),
  constraint pos_withdrawal_settlement_method_check check (
    (refund_due_cents = 0 and refund_method = 'not_required' and alternative_agreement_evidence is null)
    or (refund_due_cents > 0 and refund_method = 'original' and alternative_agreement_evidence is null)
    or (refund_due_cents > 0 and refund_method = 'agreed_alternative' and alternative_agreement_evidence is not null)
  ),
  unique (id, user_id),
  unique (work_order_id),
  unique (withdrawal_id)
);

create index pos_consumer_withdrawal_settlements_user_due_idx
  on public.pos_consumer_withdrawal_settlements(user_id, refund_due_on, assessed_at desc);
create index pos_consumer_withdrawal_settlements_withdrawal_user_idx
  on public.pos_consumer_withdrawal_settlements(withdrawal_id, user_id);

alter table public.pos_consumer_withdrawal_settlements enable row level security;
revoke all on table public.pos_consumer_withdrawal_settlements from public, anon, authenticated;
grant select on table public.pos_consumer_withdrawal_settlements to authenticated;
grant all on table public.pos_consumer_withdrawal_settlements to service_role;
create policy pos_consumer_withdrawal_settlements_select_own
  on public.pos_consumer_withdrawal_settlements for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create trigger pos_consumer_withdrawal_settlements_immutable
before update or delete on public.pos_consumer_withdrawal_settlements
for each row execute function private.pos_prevent_work_order_evidence_mutation();

create table public.pos_consumer_withdrawal_refund_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  work_order_id uuid not null,
  settlement_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  refund_method text not null check (refund_method in ('original', 'agreed_alternative')),
  provider text not null check (provider in ('stripe', 'bank_transfer', 'other')),
  provider_reference text not null check (char_length(trim(provider_reference)) between 3 and 200),
  evidence text not null check (char_length(trim(evidence)) between 5 and 500),
  executed_on date not null,
  recorded_at timestamptz not null default now(),
  constraint pos_withdrawal_refund_order_user_fk
    foreign key (work_order_id, user_id)
    references public.pos_work_orders(id, user_id)
    on delete restrict,
  constraint pos_withdrawal_refund_settlement_user_fk
    foreign key (settlement_id, user_id)
    references public.pos_consumer_withdrawal_settlements(id, user_id)
    on delete restrict,
  unique (user_id, provider, provider_reference)
);

create index pos_consumer_withdrawal_refunds_user_executed_idx
  on public.pos_consumer_withdrawal_refund_records(user_id, executed_on desc, recorded_at desc);
create index pos_consumer_withdrawal_refunds_settlement_user_idx
  on public.pos_consumer_withdrawal_refund_records(settlement_id, user_id);
create index pos_consumer_withdrawal_refunds_order_user_idx
  on public.pos_consumer_withdrawal_refund_records(work_order_id, user_id);

alter table public.pos_consumer_withdrawal_refund_records enable row level security;
revoke all on table public.pos_consumer_withdrawal_refund_records from public, anon, authenticated;
grant select on table public.pos_consumer_withdrawal_refund_records to authenticated;
grant all on table public.pos_consumer_withdrawal_refund_records to service_role;
create policy pos_consumer_withdrawal_refund_records_select_own
  on public.pos_consumer_withdrawal_refund_records for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create trigger pos_consumer_withdrawal_refund_records_immutable
before update or delete on public.pos_consumer_withdrawal_refund_records
for each row execute function private.pos_prevent_work_order_evidence_mutation();

create or replace function private._pos_assess_consumer_withdrawal_settlement(
  p_work_order_id uuid,
  p_value_compensation_cents bigint,
  p_refund_method text,
  p_alternative_agreement_evidence text default null,
  p_value_compensation_reason text default null
)
returns public.pos_consumer_withdrawal_settlements
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Berlin'
as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.pos_work_orders%rowtype;
  v_withdrawal public.pos_work_order_withdrawals%rowtype;
  v_settlement public.pos_consumer_withdrawal_settlements%rowtype;
  v_gross_received bigint := 0;
  v_already_refunded bigint := 0;
  v_retained bigint := 0;
  v_value_compensation bigint := coalesce(p_value_compensation_cents, 0);
  v_refund_due bigint;
  v_balance_review bigint;
  v_method text := trim(coalesce(p_refund_method, ''));
  v_alternative text := nullif(trim(coalesce(p_alternative_agreement_evidence, '')), '');
  v_reason text := nullif(trim(coalesce(p_value_compensation_reason, '')), '');
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  select * into v_order from public.pos_work_orders
  where id=p_work_order_id and user_id=v_user for update;
  if not found then raise exception 'Naročilo ne obstaja ali ni vaše.'; end if;
  if v_order.status <> 'withdrawn' then raise exception 'Denarni pregled je dovoljen samo po zabeleženem potrošnikovem odstopu.'; end if;
  select * into v_withdrawal from public.pos_work_order_withdrawals
  where work_order_id=v_order.id and user_id=v_user;
  if not found then raise exception 'Manjka dokaz potrošnikovega odstopa.'; end if;
  if exists (select 1 from public.pos_consumer_withdrawal_settlements where work_order_id=v_order.id) then
    raise exception 'Denarne posledice tega odstopa so že nespremenljivo ocenjene.';
  end if;
  if v_value_compensation < 0 or v_value_compensation > v_order.gross_cents then
    raise exception 'Wertersatz mora biti med 0 in pogodbeno bruto vrednostjo.';
  end if;
  if v_value_compensation > 0 then
    if not v_withdrawal.value_compensation_review_required then raise exception 'Za to naročilo Wertersatz ni dovoljen.'; end if;
    if char_length(coalesce(v_reason,'')) not between 5 and 500 then
      raise exception 'Vpišite dokazljivo utemeljitev Wertersatz (od 5 do 500 znakov).';
    end if;
    if not exists (
      select 1 from public.pos_work_order_early_start_evidence as evidence
      where evidence.work_order_id=v_order.id and evidence.user_id=v_user
        and evidence.value_compensation_informed
        and (evidence.contract_context <> 'off_premises' or evidence.request_on_durable_medium)
    ) then raise exception 'Wertersatz zahteva dokaz izrecne zahteve in predhodnega obvestila potrošniku.'; end if;
  else
    v_reason := null;
  end if;

  select
    coalesce(sum(payment.amount_cents),0),
    coalesce(sum(payment.refunded_cents),0)
  into v_gross_received,v_already_refunded
  from public.pos_work_order_invoices as link
  join public.pos_payments as payment
    on payment.invoice_id=link.invoice_id and payment.user_id=link.user_id
  where link.work_order_id=v_order.id and link.user_id=v_user
    and payment.status in ('succeeded','partially_refunded','refunded');
  v_retained := v_gross_received - v_already_refunded;
  v_refund_due := greatest(v_retained - v_value_compensation,0);
  v_balance_review := greatest(v_value_compensation - v_retained,0);

  if v_refund_due = 0 then
    if v_method not in ('','not_required') then raise exception 'Način vračila ni dovoljen, ker vračilo ni odprto.'; end if;
    v_method := 'not_required'; v_alternative := null;
  elsif v_method = 'original' then
    v_alternative := null;
  elsif v_method = 'agreed_alternative' then
    if char_length(coalesce(v_alternative,'')) not between 5 and 500 then
      raise exception 'Drugi način vračila zahteva dokaz izrecnega dogovora brez stroškov za potrošnika.';
    end if;
  else
    raise exception 'Vračilo mora uporabiti prvotni način plačila ali dokazano dogovorjeno alternativo.';
  end if;

  insert into public.pos_consumer_withdrawal_settlements(
    user_id,work_order_id,withdrawal_id,gross_received_cents,already_refunded_cents,
    retained_payment_cents,value_compensation_cents,refund_due_cents,
    consumer_balance_review_cents,refund_method,alternative_agreement_evidence,
    value_compensation_reason,refund_due_on
  ) values (
    v_user,v_order.id,v_withdrawal.id,v_gross_received,v_already_refunded,
    v_retained,v_value_compensation,v_refund_due,v_balance_review,v_method,v_alternative,
    v_reason,(v_withdrawal.received_at at time zone 'Europe/Berlin')::date + 14
  ) returning * into v_settlement;

  insert into public.pos_work_order_events(user_id,work_order_id,action,details)
  values(v_user,v_order.id,'withdrawal_settlement_assessed',jsonb_build_object(
    'gross_received_cents',v_gross_received,'already_refunded_cents',v_already_refunded,
    'retained_payment_cents',v_retained,'value_compensation_cents',v_value_compensation,
    'refund_due_cents',v_refund_due,'consumer_balance_review_cents',v_balance_review,
    'refund_method',v_method,'refund_due_on',v_settlement.refund_due_on,
    'automatic_refund_performed',false
  ));
  return v_settlement;
end;
$$;

create or replace function public.pos_assess_consumer_withdrawal_settlement(
  p_work_order_id uuid,
  p_value_compensation_cents bigint,
  p_refund_method text,
  p_alternative_agreement_evidence text default null,
  p_value_compensation_reason text default null
)
returns public.pos_consumer_withdrawal_settlements
language sql security definer set search_path=''
as $$ select private._pos_assess_consumer_withdrawal_settlement(
  p_work_order_id,p_value_compensation_cents,p_refund_method,
  p_alternative_agreement_evidence,p_value_compensation_reason
); $$;

revoke all on function private._pos_assess_consumer_withdrawal_settlement(uuid,bigint,text,text,text) from public,anon,authenticated;
grant execute on function private._pos_assess_consumer_withdrawal_settlement(uuid,bigint,text,text,text) to service_role;
revoke all on function public.pos_assess_consumer_withdrawal_settlement(uuid,bigint,text,text,text) from public,anon;
grant execute on function public.pos_assess_consumer_withdrawal_settlement(uuid,bigint,text,text,text) to authenticated,service_role;

create or replace function private._pos_record_consumer_withdrawal_refund(
  p_work_order_id uuid,
  p_amount_cents bigint,
  p_provider text,
  p_provider_reference text,
  p_evidence text,
  p_executed_on date
)
returns public.pos_consumer_withdrawal_refund_records
language plpgsql security definer set search_path='' set timezone='Europe/Berlin'
as $$
declare
  v_user uuid := (select auth.uid());
  v_settlement public.pos_consumer_withdrawal_settlements%rowtype;
  v_withdrawal_received_on date;
  v_record public.pos_consumer_withdrawal_refund_records%rowtype;
  v_recorded bigint;
  v_provider text := trim(coalesce(p_provider,''));
  v_reference text := trim(coalesce(p_provider_reference,''));
  v_evidence text := trim(coalesce(p_evidence,''));
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  select * into v_settlement from public.pos_consumer_withdrawal_settlements
  where work_order_id=p_work_order_id and user_id=v_user for update;
  if not found then raise exception 'Najprej nespremenljivo ocenite denarne posledice odstopa.'; end if;
  if v_settlement.refund_due_cents <= 0 then raise exception 'Za ta odstop ni odprtega vračila.'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Znesek vračila mora biti večji od 0.'; end if;
  if v_provider not in ('stripe','bank_transfer','other') then raise exception 'Izberite veljaven način izvedenega vračila.'; end if;
  if v_settlement.refund_method = 'original' and not exists (
    select 1
    from public.pos_work_order_invoices as link
    join public.pos_payments as payment
      on payment.invoice_id=link.invoice_id and payment.user_id=link.user_id
    where link.work_order_id=v_settlement.work_order_id and link.user_id=v_user
      and payment.status in ('succeeded','partially_refunded','refunded')
      and case
        when payment.provider='stripe' then 'stripe'
        when payment.method='bank_transfer' or payment.provider='finapi' then 'bank_transfer'
        else 'other'
      end = v_provider
  ) then
    raise exception 'Dokaz vračila mora uporabiti enega od prvotnih načinov plačila.';
  end if;
  if char_length(v_reference) not between 3 and 200 then raise exception 'Vpišite referenco izvedenega vračila.'; end if;
  if char_length(v_evidence) not between 5 and 500 then raise exception 'Vpišite dokaz izvedenega vračila.'; end if;
  if p_executed_on is null or p_executed_on > current_date then raise exception 'Datum vračila ni veljaven.'; end if;
  select (withdrawal.received_at at time zone 'Europe/Berlin')::date
  into v_withdrawal_received_on
  from public.pos_work_order_withdrawals as withdrawal
  where withdrawal.id=v_settlement.withdrawal_id and withdrawal.user_id=v_user;
  if p_executed_on < v_withdrawal_received_on then
    raise exception 'Datum vračila ne sme biti pred prejemom potrošnikovega odstopa.';
  end if;
  select coalesce(sum(amount_cents),0) into v_recorded
  from public.pos_consumer_withdrawal_refund_records
  where settlement_id=v_settlement.id and user_id=v_user;
  if v_recorded + p_amount_cents > v_settlement.refund_due_cents then
    raise exception 'Vsota dokazov vračila presega ocenjeni znesek.';
  end if;
  insert into public.pos_consumer_withdrawal_refund_records(
    user_id,work_order_id,settlement_id,amount_cents,refund_method,provider,
    provider_reference,evidence,executed_on
  ) values (
    v_user,v_settlement.work_order_id,v_settlement.id,p_amount_cents,v_settlement.refund_method,
    v_provider,v_reference,v_evidence,p_executed_on
  ) returning * into v_record;
  insert into public.pos_work_order_events(user_id,work_order_id,action,details)
  values(v_user,v_settlement.work_order_id,'withdrawal_refund_recorded',jsonb_build_object(
    'amount_cents',p_amount_cents,'refund_method',v_settlement.refund_method,
    'provider',v_provider,'provider_reference',v_reference,'executed_on',p_executed_on,
    'remaining_cents',v_settlement.refund_due_cents-v_recorded-p_amount_cents,
    'external_payment_triggered',false
  ));
  return v_record;
end;
$$;

create or replace function public.pos_record_consumer_withdrawal_refund(
  p_work_order_id uuid,p_amount_cents bigint,p_provider text,p_provider_reference text,
  p_evidence text,p_executed_on date
)
returns public.pos_consumer_withdrawal_refund_records
language sql security definer set search_path=''
as $$ select private._pos_record_consumer_withdrawal_refund(
  p_work_order_id,p_amount_cents,p_provider,p_provider_reference,p_evidence,p_executed_on
); $$;

revoke all on function private._pos_record_consumer_withdrawal_refund(uuid,bigint,text,text,text,date) from public,anon,authenticated;
grant execute on function private._pos_record_consumer_withdrawal_refund(uuid,bigint,text,text,text,date) to service_role;
revoke all on function public.pos_record_consumer_withdrawal_refund(uuid,bigint,text,text,text,date) from public,anon;
grant execute on function public.pos_record_consumer_withdrawal_refund(uuid,bigint,text,text,text,date) to authenticated,service_role;

notify pgrst, 'reload schema';
