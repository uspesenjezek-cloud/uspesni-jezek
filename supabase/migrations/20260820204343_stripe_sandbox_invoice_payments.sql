-- Stripe Checkout TEST plačila ostanejo del obstoječe POS plačilne sledi.
-- Brskalnik ne more ustvariti Stripe vrstice ali potrditi uspeha. Checkout
-- registrira strežnik, status pa spremeni samo podpisan Stripe webhook prek
-- service-role RPC-ja. Ločena tabela hrani zgolj idempotentne dogodke.

alter table public.pos_payments
  alter column paid_at drop not null,
  add column provider text not null default 'manual',
  add column provider_attempt_id uuid,
  add column external_payment_id text,
  add column checkout_session_id text,
  add column status text not null default 'succeeded',
  add column refunded_cents bigint not null default 0,
  add column failure_code text not null default '',
  add column expires_at timestamptz,
  add column metadata jsonb not null default '{}'::jsonb,
  add column updated_at timestamptz not null default now();

alter table public.pos_payments drop constraint if exists pos_payments_method_check;
alter table public.pos_payments
  add constraint pos_payments_method_check
    check (method in ('bank_transfer','external_card','manual','stripe_card')),
  add constraint pos_payments_provider_check
    check (provider in ('manual','external','finapi','stripe')),
  add constraint pos_payments_status_check
    check (status in ('pending','succeeded','failed','cancelled','partially_refunded','refunded')),
  add constraint pos_payments_refunded_check
    check (refunded_cents >= 0 and refunded_cents <= amount_cents),
  add constraint pos_payments_failure_code_check
    check (char_length(failure_code) <= 120),
  add constraint pos_payments_external_payment_id_check
    check (external_payment_id is null or char_length(external_payment_id) between 1 and 240),
  add constraint pos_payments_checkout_session_id_check
    check (checkout_session_id is null or char_length(checkout_session_id) between 1 and 240),
  add constraint pos_payments_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  add constraint pos_payments_provider_shape_check
    check (
      (provider = 'stripe' and method = 'stripe_card' and provider_attempt_id is not null and checkout_session_id is not null)
      or
      (provider <> 'stripe' and provider_attempt_id is null and checkout_session_id is null)
    ),
  add constraint pos_payments_status_shape_check
    check (
      (status in ('pending','failed','cancelled') and paid_at is null and refunded_cents = 0)
      or
      (status = 'succeeded' and paid_at is not null and refunded_cents = 0)
      or
      (status = 'partially_refunded' and paid_at is not null and refunded_cents > 0 and refunded_cents < amount_cents)
      or
      (status = 'refunded' and paid_at is not null and refunded_cents = amount_cents)
    );

update public.pos_payments
set provider = case
  when source_bank_transaction_id is not null then 'finapi'
  when method = 'external_card' then 'external'
  else 'manual'
end;

create unique index pos_payments_provider_attempt_uidx
  on public.pos_payments(provider, provider_attempt_id)
  where provider_attempt_id is not null;
create unique index pos_payments_checkout_session_uidx
  on public.pos_payments(checkout_session_id)
  where checkout_session_id is not null;
create unique index pos_payments_provider_external_uidx
  on public.pos_payments(provider, external_payment_id)
  where external_payment_id is not null;
create index pos_payments_invoice_status_idx
  on public.pos_payments(invoice_id, status, created_at desc);

create trigger pos_payments_updated_at
before update on public.pos_payments
for each row execute function private.pos_set_updated_at();

create table public.pos_payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid not null references public.pos_payments(id) on delete restrict,
  provider text not null check (provider = 'stripe'),
  external_event_id text not null check (char_length(external_event_id) between 1 and 240),
  event_type text not null check (char_length(event_type) between 1 and 120),
  event_sha256 text not null check (event_sha256 ~ '^[0-9a-f]{64}$'),
  livemode boolean not null check (livemode = false),
  event_created_at timestamptz not null,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  processed_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create index pos_payment_events_user_payment_idx
  on public.pos_payment_events(user_id, payment_id, event_created_at desc);

alter table public.pos_payment_events enable row level security;
revoke all on table public.pos_payment_events from public, anon, authenticated;
grant select on table public.pos_payment_events to authenticated;
grant all on table public.pos_payment_events to service_role;

create policy pos_payment_events_select_own on public.pos_payment_events
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy pos_payment_insert_own on public.pos_payments;
create policy pos_payment_insert_own on public.pos_payments
  for insert to authenticated with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and source_bank_transaction_id is null
    and provider in ('manual','external')
    and method in ('manual','external_card')
    and status = 'succeeded'
    and paid_at is not null
    and refunded_cents = 0
    and external_payment_id is null
    and exists (
      select 1 from public.pos_invoices i
      where i.id = invoice_id and i.user_id = (select auth.uid())
    )
  );

create or replace function private._pos_effective_paid_cents(p_invoice_id uuid, p_user_id uuid)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select coalesce(sum(
    case
      when status in ('succeeded','partially_refunded') then amount_cents - refunded_cents
      else 0
    end
  ),0)::bigint
  from public.pos_payments
  where invoice_id = p_invoice_id and user_id = p_user_id;
$$;

create or replace function private._pos_register_stripe_checkout(
  p_user_id uuid,
  p_invoice_id uuid,
  p_provider_attempt_id uuid,
  p_checkout_session_id text,
  p_amount_cents bigint,
  p_currency text,
  p_created_at timestamptz,
  p_expires_at timestamptz
)
returns public.pos_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_paid bigint;
begin
  if p_user_id is null or p_invoice_id is null or p_provider_attempt_id is null then
    raise exception 'Stripe Checkout nima veljavne povezave z računom.';
  end if;
  if p_checkout_session_id !~ '^cs_test_[A-Za-z0-9_]+$' then
    raise exception 'Dovoljena je samo Stripe TEST seja.';
  end if;
  if upper(coalesce(p_currency,'')) <> 'EUR' or p_amount_cents <= 0 then
    raise exception 'Stripe Checkout ima neveljaven znesek ali valuto.';
  end if;

  select * into v_payment from public.pos_payments
  where provider = 'stripe' and provider_attempt_id = p_provider_attempt_id;
  if found then return v_payment; end if;

  select * into v_invoice from public.pos_invoices
  where id = p_invoice_id and user_id = p_user_id for update;
  if not found then raise exception 'Račun ne obstaja.'; end if;
  if not v_invoice.is_test then raise exception 'Stripe sandbox je dovoljen samo za testni račun.'; end if;
  if exists (
    select 1 from public.pos_invoice_adjustments
    where original_invoice_id = v_invoice.id and user_id = p_user_id and adjustment_type = 'cancellation'
  ) then raise exception 'Storniranega računa ni mogoče plačati.'; end if;

  v_paid := private._pos_effective_paid_cents(v_invoice.id,p_user_id);
  if v_paid >= v_invoice.gross_cents then raise exception 'Račun je že v celoti plačan.'; end if;
  if p_amount_cents <> v_invoice.gross_cents - v_paid then
    raise exception 'Stripe znesek se ne ujema z odprtim zneskom računa.';
  end if;

  insert into public.pos_payments(
    user_id,invoice_id,amount_cents,currency,method,provider,provider_attempt_id,
    checkout_session_id,status,provider_reference,paid_at,expires_at,metadata
  ) values (
    p_user_id,v_invoice.id,p_amount_cents,'EUR','stripe_card','stripe',p_provider_attempt_id,
    p_checkout_session_id,'pending',p_checkout_session_id,null,p_expires_at,
    jsonb_build_object('invoice_number',v_invoice.invoice_number,'test_mode',true,'checkout_created_at',p_created_at)
  ) returning * into v_payment;

  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (p_user_id,'payment',v_payment.id,'stripe_checkout_created',jsonb_build_object(
    'invoice_id',v_invoice.id,'invoice_number',v_invoice.invoice_number,
    'amount_cents',p_amount_cents,'currency','EUR','provider','stripe','test_mode',true
  ));
  return v_payment;
end;
$$;

create or replace function public.pos_register_stripe_checkout(
  p_user_id uuid,
  p_invoice_id uuid,
  p_provider_attempt_id uuid,
  p_checkout_session_id text,
  p_amount_cents bigint,
  p_currency text,
  p_created_at timestamptz,
  p_expires_at timestamptz
)
returns public.pos_payments
language sql
security invoker
set search_path = ''
as $$
  select private._pos_register_stripe_checkout(
    p_user_id,p_invoice_id,p_provider_attempt_id,p_checkout_session_id,
    p_amount_cents,p_currency,p_created_at,p_expires_at
  );
$$;

create or replace function private._pos_cancel_stripe_checkout(
  p_user_id uuid,
  p_checkout_session_id text,
  p_cancelled_at timestamptz
)
returns public.pos_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.pos_payments%rowtype;
begin
  select * into v_payment from public.pos_payments
  where user_id = p_user_id and provider = 'stripe' and checkout_session_id = p_checkout_session_id
  for update;
  if not found then raise exception 'Stripe TEST plačilo ne obstaja.'; end if;
  if v_payment.status in ('succeeded','partially_refunded','refunded') then return v_payment; end if;
  update public.pos_payments set status = 'cancelled', failure_code = 'checkout_cancelled', paid_at = null,
    metadata = metadata || jsonb_build_object('cancelled_at',coalesce(p_cancelled_at,now()))
  where id = v_payment.id returning * into v_payment;
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (v_payment.user_id,'payment',v_payment.id,'stripe_checkout_cancelled',jsonb_build_object(
    'invoice_id',v_payment.invoice_id,'amount_cents',v_payment.amount_cents,'provider','stripe','test_mode',true
  ));
  return v_payment;
end;
$$;

create or replace function public.pos_cancel_stripe_checkout(
  p_user_id uuid,
  p_checkout_session_id text,
  p_cancelled_at timestamptz
)
returns public.pos_payments
language sql
security invoker
set search_path = ''
as $$
  select private._pos_cancel_stripe_checkout(p_user_id,p_checkout_session_id,p_cancelled_at);
$$;

create or replace function private._pos_apply_stripe_event(
  p_event_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_event_sha256 text,
  p_livemode boolean,
  p_user_id uuid,
  p_invoice_id uuid,
  p_provider_attempt_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_currency text,
  p_payment_status text,
  p_failure_code text,
  p_refunded_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.pos_payments%rowtype;
  v_existing public.pos_payment_events%rowtype;
  v_status text;
  v_action text;
  v_refunded bigint;
begin
  if coalesce(p_livemode,true) then raise exception 'Live Stripe dogodki so zaklenjeni.'; end if;
  if p_event_id !~ '^evt_[A-Za-z0-9_]+$' or p_event_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Stripe dogodek nima veljavne identitete.';
  end if;
  if p_event_type not in ('checkout.session.completed','payment_intent.succeeded','payment_intent.payment_failed','charge.refunded') then
    raise exception 'Stripe dogodek ni podprt.';
  end if;

  select * into v_existing from public.pos_payment_events
  where provider = 'stripe' and external_event_id = p_event_id;
  if found then
    select * into v_payment from public.pos_payments where id = v_existing.payment_id;
    return jsonb_build_object('matched',true,'duplicate',true,'payment_id',v_payment.id,'status',v_payment.status,'invoice_id',v_payment.invoice_id);
  end if;

  if p_event_type = 'charge.refunded' then
    select * into v_payment from public.pos_payments
    where provider = 'stripe' and (
      external_payment_id = p_payment_intent_id
      or (
        user_id = p_user_id and invoice_id = p_invoice_id
        and provider_attempt_id = p_provider_attempt_id
      )
    ) for update;
  else
    select * into v_payment from public.pos_payments
    where provider = 'stripe'
      and user_id = p_user_id and invoice_id = p_invoice_id
      and provider_attempt_id = p_provider_attempt_id
      and (nullif(p_checkout_session_id,'') is null or checkout_session_id = p_checkout_session_id)
    for update;
  end if;
  if not found then return jsonb_build_object('matched',false,'duplicate',false); end if;

  if upper(coalesce(p_currency,'')) <> v_payment.currency or p_amount_cents <> v_payment.amount_cents then
    raise exception 'Stripe dogodek se ne ujema z zneskom plačila.';
  end if;
  if p_event_type <> 'charge.refunded' and (v_payment.user_id <> p_user_id or v_payment.invoice_id <> p_invoice_id) then
    raise exception 'Stripe dogodek se ne ujema z računom ali uporabnikom.';
  end if;
  if nullif(p_payment_intent_id,'') is not null
    and v_payment.external_payment_id is not null
    and v_payment.external_payment_id <> p_payment_intent_id then
    raise exception 'Stripe PaymentIntent se ne ujema s plačilom.';
  end if;

  insert into public.pos_payment_events(
    user_id,payment_id,provider,external_event_id,event_type,event_sha256,livemode,event_created_at,summary
  ) values (
    v_payment.user_id,v_payment.id,'stripe',p_event_id,p_event_type,p_event_sha256,false,p_event_created_at,
    jsonb_build_object(
      'payment_intent_id',coalesce(p_payment_intent_id,''),
      'checkout_session_id',coalesce(p_checkout_session_id,''),
      'amount_cents',p_amount_cents,'currency',upper(p_currency),
      'payment_status',coalesce(p_payment_status,''),'failure_code',left(coalesce(p_failure_code,''),120),
      'refunded_cents',coalesce(p_refunded_cents,0),'test_mode',true
    )
  );

  v_status := v_payment.status;
  if p_event_type in ('checkout.session.completed','payment_intent.succeeded')
    and (p_event_type = 'payment_intent.succeeded' or p_payment_status = 'paid')
    and v_payment.status not in ('partially_refunded','refunded') then
    v_status := 'succeeded';
    v_action := 'stripe_payment_succeeded';
    update public.pos_payments set
      status = v_status, paid_at = coalesce(p_event_created_at,now()), refunded_cents = 0, failure_code = '',
      external_payment_id = coalesce(nullif(p_payment_intent_id,''),external_payment_id),
      provider_reference = coalesce(nullif(p_payment_intent_id,''),provider_reference),
      metadata = metadata || jsonb_build_object('last_event_id',p_event_id,'last_event_type',p_event_type)
    where id = v_payment.id returning * into v_payment;
  elsif p_event_type = 'payment_intent.payment_failed'
    and v_payment.status not in ('succeeded','partially_refunded','refunded') then
    v_status := 'failed';
    v_action := 'stripe_payment_failed';
    update public.pos_payments set
      status = v_status, paid_at = null, failure_code = left(coalesce(p_failure_code,'payment_failed'),120),
      external_payment_id = coalesce(nullif(p_payment_intent_id,''),external_payment_id),
      metadata = metadata || jsonb_build_object('last_event_id',p_event_id,'last_event_type',p_event_type)
    where id = v_payment.id returning * into v_payment;
  elsif p_event_type = 'charge.refunded' then
    v_refunded := greatest(0,least(v_payment.amount_cents,coalesce(p_refunded_cents,0)));
    v_status := case when v_refunded >= v_payment.amount_cents then 'refunded' else 'partially_refunded' end;
    v_action := 'stripe_payment_refunded';
    update public.pos_payments set
      status = v_status, refunded_cents = v_refunded, failure_code = '',
      paid_at = coalesce(paid_at,p_event_created_at,now()),
      external_payment_id = coalesce(nullif(p_payment_intent_id,''),external_payment_id),
      metadata = metadata || jsonb_build_object('last_event_id',p_event_id,'last_event_type',p_event_type)
    where id = v_payment.id returning * into v_payment;
  end if;

  if v_action is not null then
    insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
    values (v_payment.user_id,'payment',v_payment.id,v_action,jsonb_build_object(
      'provider','stripe','invoice_id',v_payment.invoice_id,'amount_cents',v_payment.amount_cents,
      'currency',v_payment.currency,'status',v_payment.status,'refunded_cents',v_payment.refunded_cents,
      'provider_event_id',p_event_id,'provider_event_sha256',p_event_sha256,'test_mode',true
    ));
  end if;

  return jsonb_build_object('matched',true,'duplicate',false,'payment_id',v_payment.id,'status',v_payment.status,'invoice_id',v_payment.invoice_id);
end;
$$;

create or replace function public.pos_apply_stripe_event(
  p_event_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_event_sha256 text,
  p_livemode boolean,
  p_user_id uuid,
  p_invoice_id uuid,
  p_provider_attempt_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_currency text,
  p_payment_status text,
  p_failure_code text,
  p_refunded_cents bigint
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private._pos_apply_stripe_event(
    p_event_id,p_event_type,p_event_created_at,p_event_sha256,p_livemode,
    p_user_id,p_invoice_id,p_provider_attempt_id,p_checkout_session_id,p_payment_intent_id,
    p_amount_cents,p_currency,p_payment_status,p_failure_code,p_refunded_cents
  );
$$;

-- Bančno usklajevanje mora po razširitvi plačil upoštevati samo dejansko
-- uspešne in nepovrnjene zneske ter pravilno označiti ponudnika finAPI.
create or replace function private._pos_confirm_bank_transaction(
  p_transaction_id uuid,
  p_invoice_id uuid,
  p_confirmed boolean default false
)
returns public.pos_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_transaction public.pos_bank_transactions%rowtype;
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_paid bigint;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if not coalesce(p_confirmed,false) then raise exception 'Potrditev uporabnika je obvezna.'; end if;
  select * into v_transaction from public.pos_bank_transactions
  where id = p_transaction_id and user_id = v_user for update;
  if not found then raise exception 'Bančna transakcija ne obstaja.'; end if;
  if v_transaction.status = 'confirmed' then raise exception 'Ta bančna transakcija je že potrjena.'; end if;
  select * into v_invoice from public.pos_invoices
  where id = p_invoice_id and user_id = v_user for update;
  if not found then raise exception 'Račun ne obstaja.'; end if;
  if exists (
    select 1 from public.pos_invoice_adjustments
    where original_invoice_id = v_invoice.id and user_id = v_user and adjustment_type = 'cancellation'
  ) then raise exception 'Storniranega računa ni mogoče uskladiti.'; end if;
  v_paid := private._pos_effective_paid_cents(v_invoice.id,v_user);
  if v_paid >= v_invoice.gross_cents then raise exception 'Račun je že v celoti plačan.'; end if;
  if v_transaction.amount_cents > v_invoice.gross_cents - v_paid then
    raise exception 'Priliv presega odprti znesek računa. Potrebna je ročna obravnava preplačila.';
  end if;
  insert into public.pos_payments(
    user_id,invoice_id,amount_cents,currency,method,provider,provider_reference,paid_at,status,source_bank_transaction_id
  ) values (
    v_user,v_invoice.id,v_transaction.amount_cents,v_transaction.currency,'bank_transfer','finapi',
    coalesce(nullif(v_transaction.external_reference,''),v_transaction.source_key),v_transaction.booked_on::timestamptz,
    'succeeded',v_transaction.id
  ) returning * into v_payment;
  update public.pos_bank_transactions set
    status = 'confirmed',confirmed_invoice_id = v_invoice.id,
    confirmed_payment_id = v_payment.id,confirmed_at = now()
  where id = v_transaction.id;
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (v_user,'payment',v_payment.id,'bank_payment_confirmed',jsonb_build_object(
    'bank_transaction_id',v_transaction.id,'invoice_id',v_invoice.id,
    'invoice_number',v_invoice.invoice_number,'amount_cents',v_transaction.amount_cents,
    'confirmed_by',v_user,'provider','finapi'
  ));
  return v_payment;
end;
$$;

revoke all on function private._pos_effective_paid_cents(uuid,uuid) from public, anon, authenticated;
grant execute on function private._pos_effective_paid_cents(uuid,uuid) to service_role;
revoke all on function private._pos_register_stripe_checkout(uuid,uuid,uuid,text,bigint,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.pos_register_stripe_checkout(uuid,uuid,uuid,text,bigint,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function private._pos_register_stripe_checkout(uuid,uuid,uuid,text,bigint,text,timestamptz,timestamptz) to service_role;
grant execute on function public.pos_register_stripe_checkout(uuid,uuid,uuid,text,bigint,text,timestamptz,timestamptz) to service_role;
revoke all on function private._pos_cancel_stripe_checkout(uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.pos_cancel_stripe_checkout(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function private._pos_cancel_stripe_checkout(uuid,text,timestamptz) to service_role;
grant execute on function public.pos_cancel_stripe_checkout(uuid,text,timestamptz) to service_role;
revoke all on function private._pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) from public, anon, authenticated;
revoke all on function public.pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) from public, anon, authenticated;
grant execute on function private._pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) to service_role;
grant execute on function public.pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) to service_role;

notify pgrst, 'reload schema';

;
