-- Record a timely, unambiguous consumer withdrawal separately from cancelling
-- an unaccepted offer. The transition freezes further work and invoicing but
-- deliberately does not alter invoices, payments, credits, or refunds.

alter table public.pos_work_orders
  drop constraint pos_work_orders_status_check,
  add column withdrawn_at timestamptz,
  add constraint pos_work_orders_status_check
    check (status in ('draft','offered','accepted','in_progress','completed','invoiced','cancelled','withdrawn'));

alter table public.pos_work_order_events
  drop constraint pos_work_order_events_action_check,
  add constraint pos_work_order_events_action_check
    check (action in ('created','updated','offered','accepted','started','completed','progress_invoiced','final_invoiced','cancelled','withdrawn'));

create table public.pos_work_order_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  work_order_id uuid not null,
  acceptance_id uuid not null,
  offer_document_id uuid not null,
  offer_sha256 text not null check (offer_sha256 ~ '^[0-9a-f]{64}$'),
  status_before text not null check (status_before in ('accepted', 'in_progress')),
  declared_on date not null,
  evidence text not null check (char_length(trim(evidence)) between 5 and 500),
  value_compensation_review_required boolean not null,
  received_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint pos_work_order_withdrawals_order_user_fk
    foreign key (work_order_id, user_id)
    references public.pos_work_orders(id, user_id)
    on delete restrict,
  constraint pos_work_order_withdrawals_acceptance_user_fk
    foreign key (acceptance_id, user_id)
    references public.pos_work_order_acceptances(id, user_id)
    on delete restrict,
  constraint pos_work_order_withdrawals_document_user_fk
    foreign key (offer_document_id, user_id)
    references public.pos_offer_documents(id, user_id)
    on delete restrict,
  unique (work_order_id)
);

create index pos_work_order_withdrawals_user_recorded_idx
  on public.pos_work_order_withdrawals(user_id, recorded_at desc);
create index pos_work_order_withdrawals_order_user_idx
  on public.pos_work_order_withdrawals(work_order_id, user_id);
create index pos_work_order_withdrawals_acceptance_user_idx
  on public.pos_work_order_withdrawals(acceptance_id, user_id);
create index pos_work_order_withdrawals_document_user_idx
  on public.pos_work_order_withdrawals(offer_document_id, user_id);

alter table public.pos_work_order_withdrawals enable row level security;
revoke all on table public.pos_work_order_withdrawals from public, anon, authenticated;
grant select on table public.pos_work_order_withdrawals to authenticated;
grant all on table public.pos_work_order_withdrawals to service_role;

create policy pos_work_order_withdrawals_select_own
  on public.pos_work_order_withdrawals
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create trigger pos_work_order_withdrawals_immutable
before update or delete on public.pos_work_order_withdrawals
for each row execute function private.pos_prevent_work_order_evidence_mutation();

create or replace function private.pos_require_consumer_withdrawal_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'withdrawn' and old.status <> 'withdrawn' and not exists (
    select 1
    from public.pos_work_order_withdrawals as withdrawal
    where withdrawal.work_order_id = new.id
      and withdrawal.user_id = new.user_id
      and withdrawal.status_before = old.status
      and withdrawal.received_at = new.withdrawn_at
  ) then
    raise exception 'Potrošnikov odstop zahteva nespremenljiv dokaz in veljaven datum izjave.';
  end if;
  return new;
end;
$$;

revoke all on function private.pos_require_consumer_withdrawal_evidence()
  from public, anon, authenticated;
grant execute on function private.pos_require_consumer_withdrawal_evidence()
  to service_role;

create trigger pos_work_orders_require_consumer_withdrawal_evidence
before update of status on public.pos_work_orders
for each row execute function private.pos_require_consumer_withdrawal_evidence();

alter table public.pos_work_orders
  drop constraint pos_work_orders_lifecycle_check;

alter table public.pos_work_orders
  add constraint pos_work_orders_lifecycle_check
  check (
    updated_at >= created_at
    and (locked_payload is null or locked_payload = payload)
    and ((locked_payload is null) = (offered_at is null))
    and ((order_number is null) = (accepted_at is null))
    and (accepted_at is null or offered_at is not null)
    and (started_at is null or accepted_at is not null)
    and (completed_at is null or started_at is not null)
    and (offered_at is null or offered_at >= created_at)
    and (accepted_at is null or accepted_at >= offered_at)
    and (started_at is null or started_at >= accepted_at)
    and (completed_at is null or completed_at >= started_at)
    and (
      cancelled_at is null
      or cancelled_at >= greatest(
        created_at,
        coalesce(offered_at, created_at),
        coalesce(accepted_at, created_at),
        coalesce(started_at, created_at),
        coalesce(completed_at, created_at)
      )
    )
    and (
      withdrawn_at is null
      or withdrawn_at >= greatest(
        created_at,
        coalesce(offered_at, created_at),
        coalesce(accepted_at, created_at),
        coalesce(started_at, created_at)
      )
    )
    and case status
      when 'draft' then
        offered_at is null and accepted_at is null and started_at is null
        and completed_at is null and cancelled_at is null and withdrawn_at is null
      when 'offered' then
        offered_at is not null and accepted_at is null and started_at is null
        and completed_at is null and cancelled_at is null and withdrawn_at is null
      when 'accepted' then
        accepted_at is not null and started_at is null
        and completed_at is null and cancelled_at is null and withdrawn_at is null
      when 'in_progress' then
        started_at is not null and completed_at is null and cancelled_at is null and withdrawn_at is null
      when 'completed' then
        completed_at is not null and cancelled_at is null and withdrawn_at is null
      when 'invoiced' then
        completed_at is not null and cancelled_at is null and withdrawn_at is null
      when 'cancelled' then
        cancelled_at is not null and withdrawn_at is null
      when 'withdrawn' then
        accepted_at is not null and completed_at is null and cancelled_at is null and withdrawn_at is not null
      else false
    end
  );

create or replace function private._pos_record_consumer_withdrawal(
  p_work_order_id uuid,
  p_declared_on date,
  p_evidence text
)
returns public.pos_work_orders
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Berlin'
as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.pos_work_orders%rowtype;
  v_acceptance public.pos_work_order_acceptances%rowtype;
  v_document public.pos_offer_documents%rowtype;
  v_context text;
  v_evidence text := trim(coalesce(p_evidence, ''));
  v_accepted_on date;
  v_deadline date;
  v_received_at timestamptz := now();
  v_review_required boolean;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_declared_on is null then raise exception 'Vpišite datum potrošnikove izjave o odstopu.'; end if;
  if char_length(v_evidence) not between 5 and 500 then
    raise exception 'Vpišite dokaz prejete izjave o odstopu (od 5 do 500 znakov).';
  end if;

  select * into v_order
  from public.pos_work_orders
  where id = p_work_order_id and user_id = v_user
  for update;
  if not found then raise exception 'Naročilo ne obstaja ali ni vaše.'; end if;
  if v_order.status not in ('accepted', 'in_progress') then
    raise exception 'Odstop je mogoče zabeležiti samo pri sprejetem ali začetem naročilu brez zaključnega računa.';
  end if;
  if coalesce(v_order.locked_payload->>'customer_type', '') <> 'private' then
    raise exception 'Ta postopek je namenjen samo potrošniškim pogodbam.';
  end if;
  v_context := coalesce(v_order.locked_payload->>'consumer_contract_context', '');
  if v_context not in ('distance', 'off_premises') then
    raise exception 'Zakonski odstop v tem postopku velja samo za pogodbo na daljavo ali zunaj poslovnih prostorov.';
  end if;

  v_accepted_on := coalesce(v_order.accepted_on, (v_order.accepted_at at time zone 'Europe/Berlin')::date);
  v_deadline := v_accepted_on + 14;
  if p_declared_on < v_accepted_on then
    raise exception 'Datum izjave ne sme biti pred sprejemom ponudbe.';
  end if;
  if p_declared_on > current_date then
    raise exception 'Datum izjave ne sme biti v prihodnosti.';
  end if;
  if p_declared_on > v_deadline then
    raise exception 'Ta 14-dnevni postopek ni primeren za pozno izjavo; primer potrebuje ločen pravni pregled.';
  end if;

  select * into v_acceptance
  from public.pos_work_order_acceptances
  where work_order_id = v_order.id and user_id = v_user;
  if not found then raise exception 'Manjka nespremenljiv dokaz sprejema ponudbe.'; end if;
  select * into v_document
  from public.pos_offer_documents
  where id = v_acceptance.offer_document_id and user_id = v_user and work_order_id = v_order.id;
  if not found or v_document.sha256 <> v_acceptance.offer_sha256 then
    raise exception 'Arhivirani PDF ponudbe se ne ujema z dokazom sprejema.';
  end if;

  v_review_required := v_order.status = 'in_progress';
  insert into public.pos_work_order_withdrawals(
    user_id, work_order_id, acceptance_id, offer_document_id, offer_sha256,
    status_before, declared_on, evidence, value_compensation_review_required, received_at
  ) values (
    v_user, v_order.id, v_acceptance.id, v_document.id, v_document.sha256,
    v_order.status, p_declared_on, v_evidence, v_review_required, v_received_at
  );

  update public.pos_work_orders
  set status = 'withdrawn', withdrawn_at = v_received_at
  where id = v_order.id
  returning * into v_order;

  insert into public.pos_work_order_events(user_id, work_order_id, action, details)
  values (
    v_user,
    v_order.id,
    'withdrawn',
    jsonb_build_object(
      'from_status', (select status_before from public.pos_work_order_withdrawals where work_order_id = v_order.id),
      'declared_on', p_declared_on,
      'received_at', v_received_at,
      'evidence', v_evidence,
      'consumer_contract_context', v_context,
      'value_compensation_review_required', v_review_required,
      'offer_document_id', v_document.id,
      'offer_sha256', v_document.sha256,
      'automatic_refund_performed', false
    )
  );
  return v_order;
end;
$$;

create or replace function public.pos_record_consumer_withdrawal(
  p_work_order_id uuid,
  p_declared_on date,
  p_evidence text
)
returns public.pos_work_orders
language sql
security definer
set search_path = ''
as $$
  select private._pos_record_consumer_withdrawal(p_work_order_id, p_declared_on, p_evidence);
$$;

revoke all on function private._pos_record_consumer_withdrawal(uuid, date, text)
  from public, anon, authenticated;
grant execute on function private._pos_record_consumer_withdrawal(uuid, date, text)
  to service_role;
revoke all on function public.pos_record_consumer_withdrawal(uuid, date, text)
  from public, anon;
grant execute on function public.pos_record_consumer_withdrawal(uuid, date, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
