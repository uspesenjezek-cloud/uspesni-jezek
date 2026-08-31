-- POS payment safety v2.
--
-- This migration deliberately fails closed when legacy data already violates
-- one of the new invariants. Run the same SELECTs in the deployment preflight
-- before applying it outside a disposable local database.

-- Keep the preflight, backfill and trigger installation in one stable write
-- boundary. Existing transactions may finish; new invoice/payment/checkout
-- writes wait until the migration commits or rolls back.
begin;

lock table public.pos_invoices in share row exclusive mode;
lock table public.pos_payments in share row exclusive mode;
lock table public.pos_cash_checkouts in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.pos_invoices invoice
    left join public.pos_payments payment
      on payment.invoice_id = invoice.id
     and payment.user_id = invoice.user_id
    group by invoice.id, invoice.gross_cents
    having coalesce(sum(
      case when payment.status in ('succeeded','partially_refunded')
        then payment.amount_cents - payment.refunded_cents else 0 end
    ), 0) > invoice.gross_cents
  ) then
    raise exception using
      errcode = '23514',
      message = 'POS_PAYMENT_PREFLIGHT_OVERPAID_INVOICE';
  end if;

  if exists (
    select 1 from public.pos_payments
    where provider = 'stripe'
      and (
        status in ('pending','failed')
        or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
      )
    group by invoice_id having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'POS_PAYMENT_PREFLIGHT_DUPLICATE_STRIPE_ATTEMPTS';
  end if;

  if exists (
    select 1 from public.pos_cash_checkouts
    where status in ('prepared','signed','recovery_required')
    group by invoice_id having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'POS_PAYMENT_PREFLIGHT_DUPLICATE_CASH_ATTEMPTS';
  end if;

  if exists (
    select 1
    from public.pos_payments payment
    join public.pos_cash_checkouts checkout
      on checkout.invoice_id = payment.invoice_id
     and checkout.user_id = payment.user_id
    where payment.provider = 'stripe'
      and (
        payment.status in ('pending','failed')
        or (payment.status = 'cancelled' and coalesce(payment.failure_code,'') <> 'checkout_expired')
      )
      and checkout.status in ('prepared','signed','recovery_required')
  ) then
    raise exception using
      errcode = '23505',
      message = 'POS_PAYMENT_PREFLIGHT_CROSS_METHOD_ATTEMPTS';
  end if;
end;
$$;

create table private.pos_invoice_payment_totals (
  invoice_id uuid primary key,
  user_id uuid not null,
  gross_cents bigint not null check (gross_cents >= 0),
  effective_paid_cents bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint pos_invoice_payment_totals_invoice_tenant_fkey
    foreign key (invoice_id, user_id)
    references public.pos_invoices(id, user_id)
    on delete restrict,
  constraint pos_invoice_payment_totals_not_overpaid_check
    check (effective_paid_cents between 0 and gross_cents)
);

alter table private.pos_invoice_payment_totals enable row level security;
revoke all on table private.pos_invoice_payment_totals from public, anon, authenticated;
grant select on table private.pos_invoice_payment_totals to service_role;

insert into private.pos_invoice_payment_totals(
  invoice_id, user_id, gross_cents, effective_paid_cents
)
select
  invoice.id,
  invoice.user_id,
  invoice.gross_cents,
  coalesce(sum(
    case when payment.status in ('succeeded','partially_refunded')
      then payment.amount_cents - payment.refunded_cents else 0 end
  ), 0)::bigint
from public.pos_invoices invoice
left join public.pos_payments payment
  on payment.invoice_id = invoice.id
 and payment.user_id = invoice.user_id
group by invoice.id, invoice.user_id, invoice.gross_cents;

create function private._pos_payment_effective_cents(
  p_status text,
  p_amount_cents bigint,
  p_refunded_cents bigint
)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status in ('succeeded','partially_refunded')
      then p_amount_cents - p_refunded_cents
    else 0
  end;
$$;

create function private._pos_seed_invoice_payment_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.pos_invoice_payment_totals(
    invoice_id, user_id, gross_cents, effective_paid_cents
  ) values (new.id, new.user_id, new.gross_cents, 0)
  on conflict (invoice_id) do nothing;
  return new;
end;
$$;

create trigger pos_invoices_seed_payment_total
after insert on public.pos_invoices
for each row execute function private._pos_seed_invoice_payment_total();

create function private._pos_guard_payment_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.invoice_id is distinct from old.invoice_id
    or new.amount_cents is distinct from old.amount_cents
    or new.currency is distinct from old.currency
    or new.method is distinct from old.method
    or new.provider is distinct from old.provider
    or new.provider_attempt_id is distinct from old.provider_attempt_id
    or new.checkout_session_id is distinct from old.checkout_session_id then
    raise exception using
      errcode = '23514',
      message = 'POS_PAYMENT_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger pos_payments_guard_identity
before update on public.pos_payments
for each row execute function private._pos_guard_payment_identity();

create function private._pos_apply_payment_total_delta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_id uuid;
  v_user_id uuid;
  v_old_effective bigint := 0;
  v_new_effective bigint := 0;
  v_delta bigint;
  v_total bigint;
begin
  if tg_op = 'DELETE' then
    v_invoice_id := old.invoice_id;
    v_user_id := old.user_id;
  else
    v_invoice_id := new.invoice_id;
    v_user_id := new.user_id;
  end if;
  if tg_op in ('UPDATE','DELETE') then
    v_old_effective := private._pos_payment_effective_cents(
      old.status, old.amount_cents, old.refunded_cents
    );
  end if;
  if tg_op in ('INSERT','UPDATE') then
    v_new_effective := private._pos_payment_effective_cents(
      new.status, new.amount_cents, new.refunded_cents
    );
  end if;
  v_delta := v_new_effective - v_old_effective;
  if v_delta = 0 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  insert into private.pos_invoice_payment_totals(
    invoice_id, user_id, gross_cents, effective_paid_cents
  )
  select invoice.id, invoice.user_id, invoice.gross_cents, 0
  from public.pos_invoices invoice
  where invoice.id = v_invoice_id and invoice.user_id = v_user_id
  on conflict (invoice_id) do nothing;

  update private.pos_invoice_payment_totals
  set effective_paid_cents = effective_paid_cents + v_delta,
      updated_at = now()
  where invoice_id = v_invoice_id
    and user_id = v_user_id
    and effective_paid_cents + v_delta between 0 and gross_cents
  returning effective_paid_cents into v_total;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'POS_INVOICE_GROSS_LIMIT_EXCEEDED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger pos_payments_apply_total_delta
after insert or update or delete on public.pos_payments
for each row execute function private._pos_apply_payment_total_delta();

create unique index pos_payments_one_active_stripe_per_invoice_uidx
  on public.pos_payments(invoice_id)
  where provider = 'stripe'
    and (
      status in ('pending','failed')
      or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
    );

create unique index pos_cash_checkouts_one_active_per_invoice_uidx
  on public.pos_cash_checkouts(invoice_id)
  where status in ('prepared','signed','recovery_required');

create function private._pos_guard_cash_attempt_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_invoice public.pos_invoices%rowtype;
begin
  select * into v_invoice
  from public.pos_invoices
  where id = new.invoice_id and user_id = new.user_id
  for update;
  if not found then raise exception 'Račun ne obstaja ali ni vaš.'; end if;
  if exists (
    select 1 from public.pos_payments
    where invoice_id = new.invoice_id
      and user_id = new.user_id
      and provider = 'stripe'
      and (
        status in ('pending','failed')
        or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
      )
  ) then
    raise exception using
      errcode = '23505',
      message = 'POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS';
  end if;
  return new;
end;
$$;

create trigger pos_cash_checkouts_guard_active_attempt
before insert on public.pos_cash_checkouts
for each row execute function private._pos_guard_cash_attempt_insert();

-- Preserve request-key idempotency even when a completed checkout has already
-- changed the invoice balance. The wrapper locks the invoice and rechecks the
-- durable request mapping before the legacy prepare function evaluates the
-- outstanding amount.
create or replace function public.pos_prepare_training_cash_checkout(
  p_invoice_id uuid,
  p_request_key uuid,
  p_transaction_id uuid,
  p_receipt jsonb,
  p_confirmed boolean default false
)
returns public.pos_cash_checkouts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invoice public.pos_invoices%rowtype;
  v_existing public.pos_cash_checkouts%rowtype;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_invoice_id is null or p_request_key is null or p_transaction_id is null then
    raise exception 'Manjka identiteta gotovinskega checkouta.';
  end if;
  select * into v_invoice from public.pos_invoices
  where id = p_invoice_id and user_id = v_user
  for update;
  if not found then raise exception 'Račun ne obstaja ali ni vaš.'; end if;

  select * into v_existing from public.pos_cash_checkouts
  where user_id = v_user and request_key = p_request_key
  for update;
  if found then
    if v_existing.invoice_id is distinct from p_invoice_id
      or v_existing.transaction_id is distinct from p_transaction_id
      or v_existing.receipt_snapshot is distinct from p_receipt then
      raise exception 'Ključ ponovitve je že vezan na drug gotovinski checkout.';
    end if;
    return v_existing;
  end if;

  return private._pos_prepare_training_cash_checkout(
    p_invoice_id,p_request_key,p_transaction_id,p_receipt,p_confirmed
  );
end;
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
  if found then
    if v_payment.user_id is distinct from p_user_id
      or v_payment.invoice_id is distinct from p_invoice_id
      or v_payment.checkout_session_id is distinct from p_checkout_session_id
      or v_payment.amount_cents is distinct from p_amount_cents then
      raise exception 'Stripe poskus je že vezan na drugo plačilo.';
    end if;
    return v_payment;
  end if;

  select * into v_invoice from public.pos_invoices
  where id = p_invoice_id and user_id = p_user_id for update;
  if not found then raise exception 'Račun ne obstaja.'; end if;

  -- A concurrent retry with the same provider attempt waits on the invoice
  -- lock. Recheck it before rejecting another active attempt so the retry
  -- cannot expire the session that the first request just registered.
  select * into v_payment from public.pos_payments
  where provider = 'stripe' and provider_attempt_id = p_provider_attempt_id;
  if found then
    if v_payment.user_id is distinct from p_user_id
      or v_payment.invoice_id is distinct from p_invoice_id
      or v_payment.checkout_session_id is distinct from p_checkout_session_id
      or v_payment.amount_cents is distinct from p_amount_cents then
      raise exception 'Stripe poskus je že vezan na drugo plačilo.';
    end if;
    return v_payment;
  end if;

  if not v_invoice.is_test then raise exception 'Stripe sandbox je dovoljen samo za testni račun.'; end if;
  if exists (
    select 1 from public.pos_invoice_adjustments
    where original_invoice_id = v_invoice.id and user_id = p_user_id and adjustment_type = 'cancellation'
  ) then raise exception 'Storniranega računa ni mogoče plačati.'; end if;
  if exists (
    select 1 from public.pos_payments
    where invoice_id = v_invoice.id and user_id = p_user_id
      and provider = 'stripe'
      and (
        status in ('pending','failed')
        or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
      )
  ) or exists (
    select 1 from public.pos_cash_checkouts
    where invoice_id = v_invoice.id and user_id = p_user_id
      and status in ('prepared','signed','recovery_required')
  ) then
    raise exception using
      errcode = '23505',
      message = 'POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS';
  end if;

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

create or replace function private._pos_record_manual_payment_idempotent(
  p_invoice_id uuid,
  p_request_key uuid,
  p_confirmed boolean default false
)
returns public.pos_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invoice public.pos_invoices%rowtype;
  v_existing public.pos_payments%rowtype;
  v_payment public.pos_payments%rowtype;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_invoice_id is null then raise exception 'Manjka račun.'; end if;
  if p_request_key is null then raise exception 'Manjka ključ varne ponovitve plačila.'; end if;
  if not coalesce(p_confirmed, false) then raise exception 'Ročna potrditev plačila je obvezna.'; end if;

  select * into v_invoice
  from public.pos_invoices
  where id = p_invoice_id and user_id = v_user
  for update;
  if not found then raise exception 'Račun ne obstaja ali ni vaš.'; end if;

  select payment.* into v_existing
  from private.pos_manual_payment_requests request
  join public.pos_payments payment
    on payment.id = request.payment_id and payment.user_id = request.user_id
  where request.user_id = v_user and request.request_key = p_request_key;
  if found then
    if v_existing.invoice_id is distinct from p_invoice_id
      or v_existing.method is distinct from 'manual'
      or v_existing.provider is distinct from 'manual'
      or v_existing.status is distinct from 'succeeded' then
      raise exception 'Ključ ponovitve je že vezan na drugo plačilo.';
    end if;
    return v_existing;
  end if;

  if exists (
    select 1 from public.pos_payments
    where invoice_id = p_invoice_id and user_id = v_user
      and provider = 'stripe'
      and (
        status in ('pending','failed')
        or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
      )
  ) or exists (
    select 1 from public.pos_cash_checkouts
    where invoice_id = p_invoice_id and user_id = v_user
      and status in ('prepared','signed','recovery_required')
  ) then
    raise exception using
      errcode = '23505',
      message = 'POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS';
  end if;

  v_payment := private._pos_record_manual_payment(p_invoice_id, p_confirmed);
  insert into private.pos_manual_payment_requests(user_id, request_key, invoice_id, payment_id)
  values (v_user, p_request_key, p_invoice_id, v_payment.id);
  return v_payment;
end;
$$;

-- Bank reconciliation is another way to settle the same invoice. Keep it in
-- the same invoice-lock domain as Stripe, cash and manual payments so a bank
-- confirmation cannot race an externally payable Checkout Session.
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

  if exists (
    select 1 from public.pos_payments
    where invoice_id = v_invoice.id and user_id = v_user
      and provider = 'stripe'
      and (
        status in ('pending','failed')
        or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
      )
  ) or exists (
    select 1 from public.pos_cash_checkouts
    where invoice_id = v_invoice.id and user_id = v_user
      and status in ('prepared','signed','recovery_required')
  ) then
    raise exception using
      errcode = '23505',
      message = 'POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS';
  end if;

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

create function private._pos_reconcile_stripe_checkout(
  p_user_id uuid,
  p_checkout_session_id text,
  p_session_status text,
  p_payment_status text,
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_currency text,
  p_observed_at timestamptz
)
returns public.pos_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_other_paid bigint;
  v_action text;
begin
  if p_user_id is null or p_checkout_session_id !~ '^cs_test_[A-Za-z0-9_]+$' then
    raise exception 'Stripe TEST seja nima veljavne identitete.';
  end if;
  if lower(coalesce(p_session_status,'')) not in ('open','complete','expired')
    or lower(coalesce(p_payment_status,'')) not in ('paid','unpaid','no_payment_required') then
    raise exception 'Stripe TEST seja nima podprtega stanja.';
  end if;

  select * into v_payment from public.pos_payments
  where user_id = p_user_id and provider = 'stripe'
    and checkout_session_id = p_checkout_session_id;
  if not found then raise exception 'Stripe TEST plačilo ne obstaja.'; end if;

  select * into v_invoice from public.pos_invoices
  where id = v_payment.invoice_id and user_id = p_user_id
  for update;
  if not found or v_invoice.is_test is not true then raise exception 'Stripe TEST račun ne obstaja.'; end if;

  select * into v_payment from public.pos_payments
  where id = v_payment.id and user_id = p_user_id
  for update;
  if upper(coalesce(p_currency,'')) <> v_payment.currency
    or p_amount_cents <> v_payment.amount_cents then
    raise exception 'Stripe stanje se ne ujema z zneskom plačila.';
  end if;
  if nullif(p_payment_intent_id,'') is not null
    and p_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception 'Stripe PaymentIntent nima veljavne identitete.';
  end if;
  if nullif(p_payment_intent_id,'') is not null
    and v_payment.external_payment_id is not null
    and v_payment.external_payment_id <> p_payment_intent_id then
    raise exception 'Stripe PaymentIntent se ne ujema s plačilom.';
  end if;

  if v_payment.status in ('succeeded','partially_refunded','refunded') then return v_payment; end if;

  if lower(p_payment_status) = 'paid' then
    v_other_paid := private._pos_effective_paid_cents(v_invoice.id, p_user_id)
      - private._pos_payment_effective_cents(v_payment.status, v_payment.amount_cents, v_payment.refunded_cents);
    if v_other_paid + v_payment.amount_cents <= v_invoice.gross_cents then
      update public.pos_payments set
        status = 'succeeded', paid_at = coalesce(p_observed_at,now()),
        refunded_cents = 0, failure_code = '',
        external_payment_id = coalesce(nullif(p_payment_intent_id,''),external_payment_id),
        provider_reference = coalesce(nullif(p_payment_intent_id,''),provider_reference),
        metadata = metadata || jsonb_build_object(
          'reconciled_at',coalesce(p_observed_at,now()),
          'checkout_status',lower(p_session_status),
          'payment_status',lower(p_payment_status)
        )
      where id = v_payment.id returning * into v_payment;
      v_action := 'stripe_checkout_reconciled_succeeded';
    else
      update public.pos_payments set
        status = 'pending', paid_at = null, refunded_cents = 0,
        failure_code = 'paid_requires_reconciliation',
        external_payment_id = coalesce(nullif(p_payment_intent_id,''),external_payment_id),
        metadata = metadata || jsonb_build_object(
          'reconciled_at',coalesce(p_observed_at,now()),
          'checkout_status',lower(p_session_status),
          'payment_status',lower(p_payment_status),
          'reconciliation_reason','invoice_gross_limit'
        )
      where id = v_payment.id returning * into v_payment;
      v_action := 'stripe_checkout_paid_requires_reconciliation';
    end if;
  elsif lower(p_session_status) = 'expired' then
    update public.pos_payments set
      status = 'cancelled', paid_at = null, refunded_cents = 0,
      failure_code = 'checkout_expired',
      metadata = metadata || jsonb_build_object('reconciled_at',coalesce(p_observed_at,now()),'checkout_status','expired')
    where id = v_payment.id and status not in ('succeeded','partially_refunded','refunded')
    returning * into v_payment;
    v_action := 'stripe_checkout_reconciled_expired';
  else
    update public.pos_payments set
      status = 'pending', paid_at = null, refunded_cents = 0,
      failure_code = case when lower(p_session_status) = 'open' then '' else 'stripe_reconciliation_required' end,
      metadata = metadata || jsonb_build_object(
        'reconciled_at',coalesce(p_observed_at,now()),
        'checkout_status',lower(p_session_status),
        'payment_status',lower(p_payment_status)
      )
    where id = v_payment.id and status not in ('succeeded','partially_refunded','refunded')
    returning * into v_payment;
    v_action := 'stripe_checkout_reconciled_pending';
  end if;

  if v_action is not null then
    insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
    values (v_payment.user_id,'payment',v_payment.id,v_action,jsonb_build_object(
      'invoice_id',v_payment.invoice_id,'amount_cents',v_payment.amount_cents,
      'currency',v_payment.currency,'status',v_payment.status,
      'checkout_session_id',v_payment.checkout_session_id,
      'checkout_status',lower(p_session_status),'payment_status',lower(p_payment_status),
      'test_mode',true
    ));
  end if;
  return v_payment;
end;
$$;

create function public.pos_reconcile_stripe_checkout(
  p_user_id uuid,
  p_checkout_session_id text,
  p_session_status text,
  p_payment_status text,
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_currency text,
  p_observed_at timestamptz
)
returns public.pos_payments
language sql
security invoker
set search_path = ''
as $$
  select private._pos_reconcile_stripe_checkout(
    p_user_id,p_checkout_session_id,p_session_status,p_payment_status,
    p_payment_intent_id,p_amount_cents,p_currency,p_observed_at
  );
$$;

create function public.pos_record_training_cash_signature_service(
  p_user_id uuid,
  p_checkout_id uuid,
  p_signature_counter text,
  p_signature_algorithm text,
  p_tss_serial_number text,
  p_client_serial_number text,
  p_qr_code_data text,
  p_tse_started_at timestamptz,
  p_tse_finished_at timestamptz
)
returns public.pos_cash_checkouts
language sql
security invoker
set search_path = ''
as $$
  select private._pos_record_training_cash_signature(
    p_user_id,p_checkout_id,p_signature_counter,p_signature_algorithm,
    p_tss_serial_number,p_client_serial_number,p_qr_code_data,
    p_tse_started_at,p_tse_finished_at
  );
$$;

create function public.pos_mark_training_cash_recovery_service(
  p_user_id uuid, p_checkout_id uuid, p_failure_code text
)
returns public.pos_cash_checkouts
language sql
security invoker
set search_path = ''
as $$
  select private._pos_mark_training_cash_recovery_required(p_user_id,p_checkout_id,p_failure_code);
$$;

create function public.pos_complete_training_cash_checkout_service(
  p_user_id uuid, p_checkout_id uuid
)
returns public.pos_cash_checkouts
language plpgsql
security invoker
set search_path = ''
as $$
declare v_checkout public.pos_cash_checkouts%rowtype;
begin
  perform private._pos_complete_training_cash_checkout(p_user_id,p_checkout_id);
  select * into strict v_checkout from public.pos_cash_checkouts
  where id = p_checkout_id and user_id = p_user_id;
  return v_checkout;
end;
$$;

create function public.pos_record_training_cash_refund_signature_service(
  p_user_id uuid,
  p_refund_id uuid,
  p_signature_counter text,
  p_signature_algorithm text,
  p_tss_serial_number text,
  p_client_serial_number text,
  p_qr_code_data text,
  p_tse_started_at timestamptz,
  p_tse_finished_at timestamptz
)
returns public.pos_cash_refunds
language sql
security invoker
set search_path = ''
as $$
  select private._pos_record_training_cash_refund_signature(
    p_user_id,p_refund_id,p_signature_counter,p_signature_algorithm,
    p_tss_serial_number,p_client_serial_number,p_qr_code_data,
    p_tse_started_at,p_tse_finished_at
  );
$$;

create function public.pos_mark_training_cash_refund_recovery_service(
  p_user_id uuid, p_refund_id uuid, p_failure_code text
)
returns public.pos_cash_refunds
language sql
security invoker
set search_path = ''
as $$
  select private._pos_mark_training_cash_refund_recovery_required(p_user_id,p_refund_id,p_failure_code);
$$;

create function public.pos_complete_training_cash_refund_service(
  p_user_id uuid, p_refund_id uuid
)
returns public.pos_cash_refunds
language sql
security invoker
set search_path = ''
as $$
  select private._pos_complete_training_cash_refund(p_user_id,p_refund_id);
$$;

revoke all on function private._pos_payment_effective_cents(text,bigint,bigint) from public, anon, authenticated;
revoke all on function private._pos_seed_invoice_payment_total() from public, anon, authenticated;
revoke all on function private._pos_guard_payment_identity() from public, anon, authenticated;
revoke all on function private._pos_apply_payment_total_delta() from public, anon, authenticated;
revoke all on function private._pos_guard_cash_attempt_insert() from public, anon, authenticated;
revoke all on function private._pos_reconcile_stripe_checkout(uuid,text,text,text,text,bigint,text,timestamptz) from public, anon, authenticated;
grant execute on function private._pos_reconcile_stripe_checkout(uuid,text,text,text,text,bigint,text,timestamptz) to service_role;

revoke all on function public.pos_reconcile_stripe_checkout(uuid,text,text,text,text,bigint,text,timestamptz) from public, anon, authenticated;
grant execute on function public.pos_reconcile_stripe_checkout(uuid,text,text,text,text,bigint,text,timestamptz) to service_role;

revoke all on function public.pos_record_training_cash_signature_service(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.pos_record_training_cash_signature_service(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) to service_role;
revoke all on function public.pos_mark_training_cash_recovery_service(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.pos_mark_training_cash_recovery_service(uuid,uuid,text) to service_role;
revoke all on function public.pos_complete_training_cash_checkout_service(uuid,uuid) from public, anon, authenticated;
grant execute on function public.pos_complete_training_cash_checkout_service(uuid,uuid) to service_role;
revoke all on function public.pos_record_training_cash_refund_signature_service(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.pos_record_training_cash_refund_signature_service(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) to service_role;
revoke all on function public.pos_mark_training_cash_refund_recovery_service(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.pos_mark_training_cash_refund_recovery_service(uuid,uuid,text) to service_role;
revoke all on function public.pos_complete_training_cash_refund_service(uuid,uuid) from public, anon, authenticated;
grant execute on function public.pos_complete_training_cash_refund_service(uuid,uuid) to service_role;

-- The old RPC could mark an unpaid-looking local row cancelled without proof
-- that Stripe had reached a terminal state. All callers must use reconcile.
revoke execute on function private._pos_cancel_stripe_checkout(uuid,text,timestamptz) from service_role;
revoke execute on function public.pos_cancel_stripe_checkout(uuid,text,timestamptz) from service_role;

notify pgrst, 'reload schema';

commit;
