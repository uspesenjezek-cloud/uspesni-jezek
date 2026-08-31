-- Provider-authoritative recovery for TRAINING cash checkout/refund records.
-- A locally ambiguous TSE result stays locked until fiskaly proves FINISHED,
-- CANCELLED or an exact transaction lookup returns NOT_FOUND. All financial
-- paths use invoice -> checkout/refund -> payment lock ordering.

alter table public.pos_cash_checkouts
  add column provider_observed_state text,
  add column provider_observed_at timestamptz,
  add column cancelled_at timestamptz;

alter table public.pos_cash_refunds
  add column provider_observed_state text,
  add column provider_observed_at timestamptz,
  add column cancelled_at timestamptz;

alter table public.pos_cash_checkouts
  drop constraint pos_cash_checkouts_status_check,
  drop constraint pos_cash_checkouts_signature_shape_check,
  add constraint pos_cash_checkouts_status_check
    check (status in ('prepared','signed','completed','recovery_required','cancelled')),
  add constraint pos_cash_checkouts_provider_observation_check
    check (provider_observed_state is null or provider_observed_state in ('ACTIVE','FINISHED','CANCELLED','NOT_FOUND')),
  add constraint pos_cash_checkouts_signature_shape_check check (
    (status = 'prepared' and signature_counter is null and signature_algorithm is null
      and tss_serial_number is null and client_serial_number is null and qr_code_data is null
      and tse_started_at is null and tse_finished_at is null and signed_at is null
      and payment_id is null and cancelled_at is null)
    or (status = 'recovery_required' and payment_id is null and cancelled_at is null)
    or (status = 'cancelled' and signature_counter is null and signature_algorithm is null
      and tss_serial_number is null and client_serial_number is null and qr_code_data is null
      and tse_started_at is null and tse_finished_at is null and signed_at is null
      and payment_id is null and completed_at is null and cancelled_at is not null
      and provider_observed_state in ('CANCELLED','NOT_FOUND') and provider_observed_at is not null)
    or (status = 'signed' and signature_counter is not null and signature_algorithm is not null
      and tss_serial_number is not null and client_serial_number is not null and qr_code_data is not null
      and tse_started_at is not null and tse_finished_at is not null and signed_at is not null
      and payment_id is null and completed_at is null and cancelled_at is null)
    or (status = 'completed' and signature_counter is not null and signature_algorithm is not null
      and tss_serial_number is not null and client_serial_number is not null and qr_code_data is not null
      and tse_started_at is not null and tse_finished_at is not null and signed_at is not null
      and payment_id is not null and completed_at is not null and cancelled_at is null)
  );

-- Only a provider-authoritatively cancelled refund releases the checkout for
-- a new request. Completed and still-ambiguous attempts remain exclusive.
alter table public.pos_cash_refunds
  drop constraint pos_cash_refunds_checkout_id_key;
create unique index pos_cash_refunds_one_live_per_checkout_uidx
  on public.pos_cash_refunds(checkout_id)
  where status <> 'cancelled';

alter table public.pos_cash_refunds
  drop constraint pos_cash_refunds_status_check,
  drop constraint pos_cash_refunds_signature_shape_check,
  add constraint pos_cash_refunds_status_check
    check (status in ('prepared','signed','completed','recovery_required','cancelled')),
  add constraint pos_cash_refunds_provider_observation_check
    check (provider_observed_state is null or provider_observed_state in ('ACTIVE','FINISHED','CANCELLED','NOT_FOUND')),
  add constraint pos_cash_refunds_signature_shape_check check (
    (status = 'prepared' and signature_counter is null and signature_algorithm is null
      and tss_serial_number is null and client_serial_number is null and qr_code_data is null
      and tse_started_at is null and tse_finished_at is null and signed_at is null
      and completed_at is null and cancelled_at is null)
    or (status = 'recovery_required' and completed_at is null and cancelled_at is null)
    or (status = 'cancelled' and signature_counter is null and signature_algorithm is null
      and tss_serial_number is null and client_serial_number is null and qr_code_data is null
      and tse_started_at is null and tse_finished_at is null and signed_at is null
      and completed_at is null and cancelled_at is not null
      and provider_observed_state in ('CANCELLED','NOT_FOUND') and provider_observed_at is not null)
    or (status = 'signed' and signature_counter is not null and signature_algorithm is not null
      and tss_serial_number is not null and client_serial_number is not null and qr_code_data is not null
      and tse_started_at is not null and tse_finished_at is not null and signed_at is not null
      and completed_at is null and cancelled_at is null)
    or (status = 'completed' and signature_counter is not null and signature_algorithm is not null
      and tss_serial_number is not null and client_serial_number is not null and qr_code_data is not null
      and tse_started_at is not null and tse_finished_at is not null and signed_at is not null
      and completed_at is not null and cancelled_at is null)
  );

create or replace function private._pos_reconcile_training_cash_checkout(
  p_user_id uuid,
  p_checkout_id uuid,
  p_provider_state text,
  p_signature_counter text,
  p_signature_algorithm text,
  p_tss_serial_number text,
  p_client_serial_number text,
  p_qr_code_data text,
  p_tse_started_at timestamptz,
  p_tse_finished_at timestamptz,
  p_observed_at timestamptz
)
returns public.pos_cash_checkouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_invoice_id uuid;
  v_invoice public.pos_invoices%rowtype;
  v_checkout public.pos_cash_checkouts%rowtype;
  v_state text := upper(coalesce(p_provider_state,''));
  v_observed_at timestamptz := coalesce(p_observed_at,now());
begin
  if p_user_id is null or p_checkout_id is null
    or v_state not in ('ACTIVE','FINISHED','CANCELLED','NOT_FOUND') then
    raise exception using errcode = '22023', message = 'POS_CASH_PROVIDER_STATE_INVALID';
  end if;

  select invoice_id into v_candidate_invoice_id
  from public.pos_cash_checkouts
  where id = p_checkout_id and user_id = p_user_id;
  if not found then raise exception 'Gotovinski checkout ne obstaja.'; end if;

  select * into v_invoice from public.pos_invoices
  where id = v_candidate_invoice_id and user_id = p_user_id
  for update;
  if not found or v_invoice.is_test is not true then raise exception 'TRAINING račun ni več na voljo.'; end if;

  select * into v_checkout from public.pos_cash_checkouts
  where id = p_checkout_id and user_id = p_user_id and invoice_id = v_invoice.id
  for update;
  if not found then raise exception 'Gotovinski checkout se je med uskladitvijo spremenil.'; end if;

  if v_state = 'FINISHED' then
    if trim(coalesce(p_signature_counter,'')) = '' or trim(coalesce(p_signature_algorithm,'')) = ''
      or trim(coalesce(p_tss_serial_number,'')) = '' or trim(coalesce(p_client_serial_number,'')) = ''
      or trim(coalesce(p_qr_code_data,'')) = '' or char_length(p_signature_counter) > 120
      or char_length(p_signature_algorithm) > 120 or char_length(p_tss_serial_number) > 512
      or char_length(p_client_serial_number) > 512 or char_length(p_qr_code_data) > 8192
      or p_tse_started_at is null or p_tse_finished_at is null or p_tse_finished_at < p_tse_started_at then
      raise exception using errcode = '22023', message = 'POS_CASH_PROVIDER_SIGNATURE_INVALID';
    end if;
    if v_checkout.status in ('signed','completed') then
      if v_checkout.signature_counter is distinct from p_signature_counter
        or v_checkout.signature_algorithm is distinct from p_signature_algorithm
        or v_checkout.tss_serial_number is distinct from p_tss_serial_number
        or v_checkout.client_serial_number is distinct from p_client_serial_number
        or v_checkout.qr_code_data is distinct from p_qr_code_data
        or v_checkout.tse_started_at is distinct from p_tse_started_at
        or v_checkout.tse_finished_at is distinct from p_tse_finished_at then
        raise exception using errcode = '23514', message = 'POS_CASH_PROVIDER_SIGNATURE_MISMATCH';
      end if;
      return v_checkout;
    end if;
    if v_checkout.status not in ('prepared','recovery_required') then
      raise exception using errcode = '23514', message = 'POS_CASH_PROVIDER_STATE_CONFLICT';
    end if;
    update public.pos_cash_checkouts set
      status = 'signed', signature_counter = p_signature_counter,
      signature_algorithm = p_signature_algorithm,
      tss_serial_number = p_tss_serial_number, client_serial_number = p_client_serial_number,
      qr_code_data = p_qr_code_data, tse_started_at = p_tse_started_at,
      tse_finished_at = p_tse_finished_at, signed_at = coalesce(signed_at,v_observed_at),
      provider_observed_state = 'FINISHED', provider_observed_at = v_observed_at,
      failure_code = ''
    where id = v_checkout.id returning * into v_checkout;
  elsif v_state = 'CANCELLED' then
    if v_checkout.status = 'cancelled' then return v_checkout; end if;
    if v_checkout.status not in ('prepared','recovery_required') then
      raise exception using errcode = '23514', message = 'POS_CASH_PROVIDER_CANCELLATION_CONFLICT';
    end if;
    update public.pos_cash_checkouts set
      status = 'cancelled', cancelled_at = v_observed_at,
      provider_observed_state = 'CANCELLED', provider_observed_at = v_observed_at,
      failure_code = 'provider_transaction_cancelled'
    where id = v_checkout.id returning * into v_checkout;
  elsif v_state = 'NOT_FOUND' then
    if v_checkout.status = 'cancelled' then return v_checkout; end if;
    if v_checkout.status = 'recovery_required' then
      update public.pos_cash_checkouts set
        status = 'cancelled', cancelled_at = v_observed_at,
        provider_observed_state = 'NOT_FOUND', provider_observed_at = v_observed_at,
        failure_code = 'provider_transaction_not_found'
      where id = v_checkout.id returning * into v_checkout;
    elsif v_checkout.status = 'prepared' then
      -- A concurrent provider PUT may still be in flight. NOT_FOUND alone cannot
      -- fence that request, so preserve the live row and its unique lock.
      update public.pos_cash_checkouts set
        status = 'prepared', cancelled_at = null,
        provider_observed_state = 'NOT_FOUND', provider_observed_at = v_observed_at,
        failure_code = 'provider_transaction_not_found_unfenced'
      where id = v_checkout.id returning * into v_checkout;
    else
      raise exception using errcode = '23514', message = 'POS_CASH_PROVIDER_NOT_FOUND_CONFLICT';
    end if;
  else
    if v_checkout.status in ('signed','completed','cancelled') then return v_checkout; end if;
    update public.pos_cash_checkouts set
      status = 'recovery_required', provider_observed_state = 'ACTIVE',
      provider_observed_at = v_observed_at, failure_code = 'provider_transaction_active'
    where id = v_checkout.id returning * into v_checkout;
  end if;

  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (p_user_id,'payment',v_checkout.id,'training_cash_checkout_provider_reconciled',jsonb_build_object(
    'invoice_id',v_checkout.invoice_id,'transaction_id',v_checkout.transaction_id,
    'provider_state',v_state,'local_state',v_checkout.status,'observed_at',v_observed_at
  ));
  return v_checkout;
end;
$$;

create or replace function private._pos_reconcile_training_cash_refund(
  p_user_id uuid,
  p_refund_id uuid,
  p_provider_state text,
  p_signature_counter text,
  p_signature_algorithm text,
  p_tss_serial_number text,
  p_client_serial_number text,
  p_qr_code_data text,
  p_tse_started_at timestamptz,
  p_tse_finished_at timestamptz,
  p_observed_at timestamptz
)
returns public.pos_cash_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_invoice_id uuid;
  v_invoice public.pos_invoices%rowtype;
  v_refund public.pos_cash_refunds%rowtype;
  v_state text := upper(coalesce(p_provider_state,''));
  v_observed_at timestamptz := coalesce(p_observed_at,now());
begin
  if p_user_id is null or p_refund_id is null
    or v_state not in ('ACTIVE','FINISHED','CANCELLED','NOT_FOUND') then
    raise exception using errcode = '22023', message = 'POS_CASH_REFUND_PROVIDER_STATE_INVALID';
  end if;

  select invoice_id into v_candidate_invoice_id
  from public.pos_cash_refunds
  where id = p_refund_id and user_id = p_user_id;
  if not found then raise exception 'Gotovinsko povračilo ne obstaja.'; end if;

  select * into v_invoice from public.pos_invoices
  where id = v_candidate_invoice_id and user_id = p_user_id
  for update;
  if not found or v_invoice.is_test is not true then raise exception 'TRAINING račun ni več na voljo.'; end if;

  select * into v_refund from public.pos_cash_refunds
  where id = p_refund_id and user_id = p_user_id and invoice_id = v_invoice.id
  for update;
  if not found then raise exception 'Gotovinsko povračilo se je med uskladitvijo spremenilo.'; end if;

  if v_state = 'FINISHED' then
    if trim(coalesce(p_signature_counter,'')) = '' or trim(coalesce(p_signature_algorithm,'')) = ''
      or trim(coalesce(p_tss_serial_number,'')) = '' or trim(coalesce(p_client_serial_number,'')) = ''
      or trim(coalesce(p_qr_code_data,'')) = '' or char_length(p_signature_counter) > 120
      or char_length(p_signature_algorithm) > 120 or char_length(p_tss_serial_number) > 512
      or char_length(p_client_serial_number) > 512 or char_length(p_qr_code_data) > 8192
      or p_tse_started_at is null or p_tse_finished_at is null or p_tse_finished_at < p_tse_started_at then
      raise exception using errcode = '22023', message = 'POS_CASH_REFUND_PROVIDER_SIGNATURE_INVALID';
    end if;
    if v_refund.status in ('signed','completed') then
      if v_refund.signature_counter is distinct from p_signature_counter
        or v_refund.signature_algorithm is distinct from p_signature_algorithm
        or v_refund.tss_serial_number is distinct from p_tss_serial_number
        or v_refund.client_serial_number is distinct from p_client_serial_number
        or v_refund.qr_code_data is distinct from p_qr_code_data
        or v_refund.tse_started_at is distinct from p_tse_started_at
        or v_refund.tse_finished_at is distinct from p_tse_finished_at then
        raise exception using errcode = '23514', message = 'POS_CASH_REFUND_PROVIDER_SIGNATURE_MISMATCH';
      end if;
      return v_refund;
    end if;
    if v_refund.status not in ('prepared','recovery_required') then
      raise exception using errcode = '23514', message = 'POS_CASH_REFUND_PROVIDER_STATE_CONFLICT';
    end if;
    update public.pos_cash_refunds set
      status = 'signed', signature_counter = p_signature_counter,
      signature_algorithm = p_signature_algorithm,
      tss_serial_number = p_tss_serial_number, client_serial_number = p_client_serial_number,
      qr_code_data = p_qr_code_data, tse_started_at = p_tse_started_at,
      tse_finished_at = p_tse_finished_at, signed_at = coalesce(signed_at,v_observed_at),
      provider_observed_state = 'FINISHED', provider_observed_at = v_observed_at,
      failure_code = ''
    where id = v_refund.id returning * into v_refund;
  elsif v_state = 'CANCELLED' then
    if v_refund.status = 'cancelled' then return v_refund; end if;
    if v_refund.status not in ('prepared','recovery_required') then
      raise exception using errcode = '23514', message = 'POS_CASH_REFUND_PROVIDER_CANCELLATION_CONFLICT';
    end if;
    update public.pos_cash_refunds set
      status = 'cancelled', cancelled_at = v_observed_at,
      provider_observed_state = 'CANCELLED', provider_observed_at = v_observed_at,
      failure_code = 'provider_transaction_cancelled'
    where id = v_refund.id returning * into v_refund;
  elsif v_state = 'NOT_FOUND' then
    if v_refund.status = 'cancelled' then return v_refund; end if;
    if v_refund.status = 'recovery_required' then
      update public.pos_cash_refunds set
        status = 'cancelled', cancelled_at = v_observed_at,
        provider_observed_state = 'NOT_FOUND', provider_observed_at = v_observed_at,
        failure_code = 'provider_transaction_not_found'
      where id = v_refund.id returning * into v_refund;
    elsif v_refund.status = 'prepared' then
      -- Preserve the one-live-refund fence while a provider PUT can still win.
      update public.pos_cash_refunds set
        status = 'prepared', cancelled_at = null,
        provider_observed_state = 'NOT_FOUND', provider_observed_at = v_observed_at,
        failure_code = 'provider_transaction_not_found_unfenced'
      where id = v_refund.id returning * into v_refund;
    else
      raise exception using errcode = '23514', message = 'POS_CASH_REFUND_PROVIDER_NOT_FOUND_CONFLICT';
    end if;
  else
    if v_refund.status in ('signed','completed','cancelled') then return v_refund; end if;
    update public.pos_cash_refunds set
      status = 'recovery_required', provider_observed_state = 'ACTIVE',
      provider_observed_at = v_observed_at, failure_code = 'provider_transaction_active'
    where id = v_refund.id returning * into v_refund;
  end if;

  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (p_user_id,'payment',v_refund.id,'training_cash_refund_provider_reconciled',jsonb_build_object(
    'invoice_id',v_refund.invoice_id,'checkout_id',v_refund.checkout_id,
    'transaction_id',v_refund.transaction_id,'provider_state',v_state,
    'local_state',v_refund.status,'observed_at',v_observed_at
  ));
  return v_refund;
end;
$$;

-- Final checkout completion: discover identity without a lock, then lock the
-- invoice before the checkout and payment, matching every other money path.
create or replace function private._pos_complete_training_cash_checkout(
  p_user_id uuid,
  p_checkout_id uuid
)
returns public.pos_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_invoice_id uuid;
  v_checkout public.pos_cash_checkouts%rowtype;
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_outstanding bigint;
begin
  select invoice_id into v_candidate_invoice_id from public.pos_cash_checkouts
  where id = p_checkout_id and user_id = p_user_id;
  if not found then raise exception 'Gotovinski checkout ne obstaja.'; end if;

  select * into v_invoice from public.pos_invoices
  where id = v_candidate_invoice_id and user_id = p_user_id for update;
  if not found or v_invoice.is_test is not true then raise exception 'TRAINING račun ni več na voljo.'; end if;

  select * into v_checkout from public.pos_cash_checkouts
  where id = p_checkout_id and user_id = p_user_id and invoice_id = v_invoice.id for update;
  if not found then raise exception 'Gotovinski checkout se je med zaključkom spremenil.'; end if;
  if v_checkout.status = 'completed' then
    select * into v_payment from public.pos_payments
    where id = v_checkout.payment_id and user_id = p_user_id and invoice_id = v_invoice.id for update;
    if not found then raise exception 'Zaključen checkout nima plačilne sledi.'; end if;
    return v_payment;
  end if;
  if v_checkout.status <> 'signed' then raise exception 'Checkout brez popolnega TSE podpisa ne sme ustvariti plačila.'; end if;

  v_outstanding := v_invoice.gross_cents - private._pos_effective_paid_cents(v_invoice.id,p_user_id);
  if v_outstanding <> v_checkout.amount_cents then raise exception 'Odprti znesek se je med TSE podpisom spremenil.'; end if;

  insert into public.pos_payments(
    user_id,invoice_id,amount_cents,currency,method,provider,provider_reference,paid_at,status,metadata
  ) values (
    p_user_id,v_invoice.id,v_checkout.amount_cents,'EUR','cash','fiskaly',
    v_checkout.transaction_id::text,now(),'succeeded',jsonb_build_object(
      'training',true,'cash_checkout_id',v_checkout.id,'tse_transaction_id',v_checkout.transaction_id,
      'signature_counter',v_checkout.signature_counter,'signature_algorithm',v_checkout.signature_algorithm,
      'tss_serial_number',v_checkout.tss_serial_number,'client_serial_number',v_checkout.client_serial_number,
      'qr_code_data',v_checkout.qr_code_data,'tse_started_at',v_checkout.tse_started_at,
      'tse_finished_at',v_checkout.tse_finished_at
    )
  ) returning * into v_payment;

  update public.pos_cash_checkouts set status = 'completed',payment_id = v_payment.id,completed_at = now()
  where id = v_checkout.id;
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (p_user_id,'payment',v_payment.id,'training_cash_payment_completed',jsonb_build_object(
    'invoice_id',v_invoice.id,'checkout_id',v_checkout.id,'amount_cents',v_payment.amount_cents,
    'transaction_id',v_checkout.transaction_id,'signature_counter',v_checkout.signature_counter
  ));
  return v_payment;
end;
$$;

-- Refund preparation and completion use invoice -> checkout/refund -> payment.
create or replace function private._pos_prepare_training_cash_refund(
  p_checkout_id uuid,
  p_request_key uuid,
  p_transaction_id uuid,
  p_receipt jsonb,
  p_confirmed boolean default false
)
returns public.pos_cash_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_candidate_invoice_id uuid;
  v_checkout public.pos_cash_checkouts%rowtype;
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_existing public.pos_cash_refunds%rowtype;
  v_refund public.pos_cash_refunds%rowtype;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_checkout_id is null or p_request_key is null or p_transaction_id is null then raise exception 'Manjka identiteta gotovinskega povračila.'; end if;
  if not coalesce(p_confirmed,false) then raise exception 'Izrecna potrditev gotovinskega povračila je obvezna.'; end if;
  if p_receipt is null or jsonb_typeof(p_receipt) <> 'object' then raise exception 'Neveljaven refundni Kassenbon.'; end if;

  select invoice_id into v_candidate_invoice_id from public.pos_cash_checkouts
  where id = p_checkout_id and user_id = v_user;
  if not found then raise exception 'Povračilo zahteva zaključen uporabnikov gotovinski checkout.'; end if;

  select * into v_invoice from public.pos_invoices
  where id = v_candidate_invoice_id and user_id = v_user for update;
  if not found or v_invoice.is_test is not true then raise exception 'Produkcijsko gotovinsko povračilo ostaja zaklenjeno do SIGN DE aktivacije in pravne potrditve.'; end if;

  select * into v_checkout from public.pos_cash_checkouts
  where id = p_checkout_id and user_id = v_user and invoice_id = v_invoice.id for update;
  if not found or v_checkout.status <> 'completed' or v_checkout.payment_id is null then raise exception 'Povračilo zahteva zaključen uporabnikov gotovinski checkout.'; end if;
  if p_receipt is distinct from v_checkout.receipt_snapshot then raise exception 'Refundni Kassenbon se ne ujema z izvirnim checkoutom.'; end if;

  select * into v_existing from public.pos_cash_refunds
  where user_id = v_user and request_key = p_request_key for update;
  if found then
    if v_existing.checkout_id is distinct from p_checkout_id
      or v_existing.transaction_id is distinct from p_transaction_id
      or v_existing.receipt_snapshot is distinct from p_receipt then
      raise exception 'Ključ ponovitve je že vezan na drugo gotovinsko povračilo.';
    end if;
    return v_existing;
  end if;

  select * into v_payment from public.pos_payments
  where id = v_checkout.payment_id and invoice_id = v_invoice.id and user_id = v_user for update;
  if not found or v_payment.method <> 'cash' or v_payment.provider <> 'fiskaly'
    or v_payment.status <> 'succeeded' or v_payment.refunded_cents <> 0
    or v_payment.amount_cents <> v_checkout.amount_cents then
    raise exception 'Izvirno gotovinsko plačilo ni primerno za povračilo.';
  end if;
  if exists (select 1 from public.pos_cash_refunds where checkout_id = p_checkout_id and status <> 'cancelled') then raise exception 'Za checkout že obstaja gotovinsko povračilo, ki ga je treba dokončati ali uskladiti.'; end if;

  insert into public.pos_cash_refunds(
    user_id,checkout_id,invoice_id,payment_id,request_key,transaction_id,amount_cents,receipt_snapshot
  ) values (
    v_user,v_checkout.id,v_checkout.invoice_id,v_checkout.payment_id,p_request_key,p_transaction_id,v_checkout.amount_cents,p_receipt
  ) returning * into v_refund;
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (v_user,'payment',v_refund.id,'training_cash_refund_prepared',jsonb_build_object(
    'invoice_id',v_refund.invoice_id,'checkout_id',v_checkout.id,'payment_id',v_refund.payment_id,
    'amount_cents',v_refund.amount_cents,'transaction_id',p_transaction_id
  ));
  return v_refund;
end;
$$;

create or replace function private._pos_complete_training_cash_refund(
  p_user_id uuid,
  p_refund_id uuid
)
returns public.pos_cash_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_invoice_id uuid;
  v_invoice public.pos_invoices%rowtype;
  v_refund public.pos_cash_refunds%rowtype;
  v_payment public.pos_payments%rowtype;
begin
  select invoice_id into v_candidate_invoice_id from public.pos_cash_refunds
  where id = p_refund_id and user_id = p_user_id;
  if not found then raise exception 'Gotovinsko povračilo ne obstaja.'; end if;

  select * into v_invoice from public.pos_invoices
  where id = v_candidate_invoice_id and user_id = p_user_id for update;
  if not found or v_invoice.is_test is not true then raise exception 'TRAINING račun ni več na voljo.'; end if;

  select * into v_refund from public.pos_cash_refunds
  where id = p_refund_id and user_id = p_user_id and invoice_id = v_invoice.id for update;
  if not found then raise exception 'Gotovinsko povračilo se je med zaključkom spremenilo.'; end if;
  if v_refund.status = 'completed' then return v_refund; end if;
  if v_refund.status <> 'signed' then raise exception 'Povračilo brez popolnega TSE podpisa ne sme spremeniti plačila.'; end if;

  select * into v_payment from public.pos_payments
  where id = v_refund.payment_id and invoice_id = v_invoice.id and user_id = p_user_id for update;
  if not found or v_payment.method <> 'cash' or v_payment.provider <> 'fiskaly'
    or v_payment.status <> 'succeeded' or v_payment.refunded_cents <> 0
    or v_payment.amount_cents <> v_refund.amount_cents then
    raise exception 'Izvirno gotovinsko plačilo se je med TSE podpisom spremenilo.';
  end if;

  update public.pos_payments set status = 'refunded',refunded_cents = amount_cents,
    metadata = metadata || jsonb_build_object(
      'cash_refund_id',v_refund.id,'refund_tse_transaction_id',v_refund.transaction_id,
      'refund_signature_counter',v_refund.signature_counter,'refund_tss_serial_number',v_refund.tss_serial_number,
      'refund_client_serial_number',v_refund.client_serial_number,'refund_qr_code_data',v_refund.qr_code_data,
      'refund_tse_started_at',v_refund.tse_started_at,'refund_tse_finished_at',v_refund.tse_finished_at
    )
  where id = v_payment.id;
  update public.pos_cash_refunds set status = 'completed',completed_at = now()
  where id = v_refund.id returning * into v_refund;
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (p_user_id,'payment',v_payment.id,'training_cash_refund_completed',jsonb_build_object(
    'invoice_id',v_refund.invoice_id,'checkout_id',v_refund.checkout_id,'refund_id',v_refund.id,
    'amount_cents',v_refund.amount_cents,'transaction_id',v_refund.transaction_id,
    'signature_counter',v_refund.signature_counter
  ));
  return v_refund;
end;
$$;

create function public.pos_reconcile_training_cash_checkout_service(
  p_user_id uuid,p_checkout_id uuid,p_provider_state text,
  p_signature_counter text,p_signature_algorithm text,p_tss_serial_number text,
  p_client_serial_number text,p_qr_code_data text,p_tse_started_at timestamptz,
  p_tse_finished_at timestamptz,p_observed_at timestamptz
)
returns public.pos_cash_checkouts
language sql
security invoker
set search_path = ''
as $$
  select private._pos_reconcile_training_cash_checkout(
    p_user_id,p_checkout_id,p_provider_state,p_signature_counter,p_signature_algorithm,
    p_tss_serial_number,p_client_serial_number,p_qr_code_data,p_tse_started_at,
    p_tse_finished_at,p_observed_at
  );
$$;

create function public.pos_reconcile_training_cash_refund_service(
  p_user_id uuid,p_refund_id uuid,p_provider_state text,
  p_signature_counter text,p_signature_algorithm text,p_tss_serial_number text,
  p_client_serial_number text,p_qr_code_data text,p_tse_started_at timestamptz,
  p_tse_finished_at timestamptz,p_observed_at timestamptz
)
returns public.pos_cash_refunds
language sql
security invoker
set search_path = ''
as $$
  select private._pos_reconcile_training_cash_refund(
    p_user_id,p_refund_id,p_provider_state,p_signature_counter,p_signature_algorithm,
    p_tss_serial_number,p_client_serial_number,p_qr_code_data,p_tse_started_at,
    p_tse_finished_at,p_observed_at
  );
$$;

revoke all on function private._pos_reconcile_training_cash_checkout(uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function private._pos_reconcile_training_cash_checkout(uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz) to service_role;
revoke all on function public.pos_reconcile_training_cash_checkout_service(uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.pos_reconcile_training_cash_checkout_service(uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz) to service_role;

revoke all on function private._pos_reconcile_training_cash_refund(uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function private._pos_reconcile_training_cash_refund(uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz) to service_role;
revoke all on function public.pos_reconcile_training_cash_refund_service(uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.pos_reconcile_training_cash_refund_service(uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz) to service_role;

-- Reassert least privilege after replacing the final money functions.
revoke all on function private._pos_complete_training_cash_checkout(uuid,uuid) from public, anon, authenticated;
grant execute on function private._pos_complete_training_cash_checkout(uuid,uuid) to service_role;
revoke all on function private._pos_prepare_training_cash_refund(uuid,uuid,uuid,jsonb,boolean) from public, anon;
grant execute on function private._pos_prepare_training_cash_refund(uuid,uuid,uuid,jsonb,boolean) to authenticated, service_role;
revoke all on function private._pos_complete_training_cash_refund(uuid,uuid) from public, anon, authenticated;
grant execute on function private._pos_complete_training_cash_refund(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
