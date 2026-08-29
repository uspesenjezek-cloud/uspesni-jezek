-- A cash refund is a separate TRAINING fiscal event. The authenticated user
-- may prepare it, but only a service-role TSE adapter may attach a signature
-- and atomically mark the original cash payment as refunded.

create table public.pos_cash_refunds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_id uuid not null,
  invoice_id uuid not null,
  payment_id uuid not null,
  request_key uuid not null,
  transaction_id uuid not null,
  status text not null default 'prepared'
    check (status in ('prepared','signed','completed','recovery_required')),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  payment_type text not null default 'CASH' check (payment_type = 'CASH'),
  fiscal_type text not null default 'REFUND' check (fiscal_type = 'REFUND'),
  receipt_snapshot jsonb not null check (jsonb_typeof(receipt_snapshot) = 'object'),
  signature_counter text,
  signature_algorithm text,
  tss_serial_number text,
  client_serial_number text,
  qr_code_data text,
  tse_started_at timestamptz,
  tse_finished_at timestamptz,
  failure_code text not null default '' check (char_length(failure_code) <= 120),
  prepared_at timestamptz not null default now(),
  signed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, request_key),
  unique (transaction_id),
  unique (checkout_id),
  constraint pos_cash_refunds_checkout_tenant_fkey
    foreign key (checkout_id, user_id) references public.pos_cash_checkouts(id, user_id) on delete restrict,
  constraint pos_cash_refunds_invoice_tenant_fkey
    foreign key (invoice_id, user_id) references public.pos_invoices(id, user_id) on delete restrict,
  constraint pos_cash_refunds_payment_tenant_fkey
    foreign key (payment_id, user_id) references public.pos_payments(id, user_id) on delete restrict,
  constraint pos_cash_refunds_signature_shape_check check (
    (status = 'prepared' and signature_counter is null and signature_algorithm is null
      and tss_serial_number is null and client_serial_number is null and qr_code_data is null
      and tse_started_at is null and tse_finished_at is null and signed_at is null)
    or (status = 'recovery_required')
    or (status = 'signed' and signature_counter is not null and signature_algorithm is not null
      and tss_serial_number is not null and client_serial_number is not null and qr_code_data is not null
      and tse_started_at is not null and tse_finished_at is not null and signed_at is not null)
    or (status = 'completed' and signature_counter is not null and signature_algorithm is not null
      and tss_serial_number is not null and client_serial_number is not null and qr_code_data is not null
      and tse_started_at is not null and tse_finished_at is not null and signed_at is not null
      and completed_at is not null)
  ),
  constraint pos_cash_refunds_signature_size_check check (
    char_length(coalesce(signature_counter,'')) <= 120
    and char_length(coalesce(signature_algorithm,'')) <= 120
    and char_length(coalesce(tss_serial_number,'')) <= 512
    and char_length(coalesce(client_serial_number,'')) <= 512
    and char_length(coalesce(qr_code_data,'')) <= 8192
  )
);

create index pos_cash_refunds_user_prepared_idx
  on public.pos_cash_refunds(user_id, prepared_at desc);
create index pos_cash_refunds_invoice_user_idx
  on public.pos_cash_refunds(invoice_id, user_id);
create index pos_cash_refunds_payment_user_idx
  on public.pos_cash_refunds(payment_id, user_id);

alter table public.pos_cash_refunds enable row level security;
revoke all on table public.pos_cash_refunds from public, anon, authenticated;
grant select on table public.pos_cash_refunds to authenticated;
grant all on table public.pos_cash_refunds to service_role;
create policy pos_cash_refunds_select_own on public.pos_cash_refunds
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create trigger pos_cash_refunds_updated_at
before update on public.pos_cash_refunds
for each row execute function private.pos_set_updated_at();

create function private._pos_prepare_training_cash_refund(
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
  v_checkout public.pos_cash_checkouts%rowtype;
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_existing public.pos_cash_refunds%rowtype;
  v_refund public.pos_cash_refunds%rowtype;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_checkout_id is null or p_request_key is null or p_transaction_id is null then
    raise exception 'Manjka identiteta gotovinskega povračila.';
  end if;
  if not coalesce(p_confirmed, false) then raise exception 'Izrecna potrditev gotovinskega povračila je obvezna.'; end if;
  if p_receipt is null or jsonb_typeof(p_receipt) <> 'object' then raise exception 'Neveljaven refundni Kassenbon.'; end if;

  select * into v_checkout from public.pos_cash_checkouts
  where id = p_checkout_id and user_id = v_user
  for update;
  if not found or v_checkout.status <> 'completed' or v_checkout.payment_id is null then
    raise exception 'Povračilo zahteva zaključen uporabnikov gotovinski checkout.';
  end if;
  if p_receipt is distinct from v_checkout.receipt_snapshot then
    raise exception 'Refundni Kassenbon se ne ujema z izvirnim checkoutom.';
  end if;

  select * into v_invoice from public.pos_invoices
  where id = v_checkout.invoice_id and user_id = v_user
  for update;
  if not found or v_invoice.is_test is not true then
    raise exception 'Produkcijsko gotovinsko povračilo ostaja zaklenjeno do SIGN DE aktivacije in pravne potrditve.';
  end if;

  select * into v_payment from public.pos_payments
  where id = v_checkout.payment_id and invoice_id = v_checkout.invoice_id and user_id = v_user
  for update;
  if not found then raise exception 'Izvirno gotovinsko plačilo ne obstaja.'; end if;

  select * into v_existing from public.pos_cash_refunds
  where user_id = v_user and request_key = p_request_key
  for update;
  if found then
    if v_existing.checkout_id is distinct from p_checkout_id
      or v_existing.transaction_id is distinct from p_transaction_id
      or v_existing.receipt_snapshot is distinct from p_receipt then
      raise exception 'Ključ ponovitve je že vezan na drugo gotovinsko povračilo.';
    end if;
    return v_existing;
  end if;

  if v_payment.method <> 'cash' or v_payment.provider <> 'fiskaly'
    or v_payment.status <> 'succeeded' or v_payment.refunded_cents <> 0
    or v_payment.amount_cents <> v_checkout.amount_cents then
    raise exception 'Izvirno gotovinsko plačilo ni primerno za povračilo.';
  end if;

  if exists (select 1 from public.pos_cash_refunds where checkout_id = p_checkout_id) then
    raise exception 'Za checkout že obstaja gotovinsko povračilo, ki ga je treba dokončati ali uskladiti.';
  end if;

  insert into public.pos_cash_refunds(
    user_id, checkout_id, invoice_id, payment_id, request_key,
    transaction_id, amount_cents, receipt_snapshot
  ) values (
    v_user, v_checkout.id, v_checkout.invoice_id, v_checkout.payment_id,
    p_request_key, p_transaction_id, v_checkout.amount_cents, p_receipt
  ) returning * into v_refund;

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (v_user, 'payment', v_refund.id, 'training_cash_refund_prepared',
    jsonb_build_object('invoice_id',v_refund.invoice_id,'checkout_id',v_checkout.id,
      'payment_id',v_refund.payment_id,'amount_cents',v_refund.amount_cents,
      'transaction_id',p_transaction_id));
  return v_refund;
end;
$$;

create function public.pos_prepare_training_cash_refund(
  p_checkout_id uuid,
  p_request_key uuid,
  p_transaction_id uuid,
  p_receipt jsonb,
  p_confirmed boolean default false
)
returns public.pos_cash_refunds
language sql
security invoker
set search_path = ''
as $$
  select private._pos_prepare_training_cash_refund(
    p_checkout_id, p_request_key, p_transaction_id, p_receipt, p_confirmed
  );
$$;

create function private._pos_record_training_cash_refund_signature(
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
language plpgsql
security definer
set search_path = ''
as $$
declare v_refund public.pos_cash_refunds%rowtype;
begin
  if p_user_id is null or p_refund_id is null then raise exception 'Manjka identiteta TSE podpisa povračila.'; end if;
  if trim(coalesce(p_signature_counter,'')) = '' or trim(coalesce(p_signature_algorithm,'')) = ''
    or trim(coalesce(p_tss_serial_number,'')) = ''
    or trim(coalesce(p_client_serial_number,'')) = '' or trim(coalesce(p_qr_code_data,'')) = ''
    or char_length(p_signature_counter) > 120 or char_length(p_signature_algorithm) > 120
    or char_length(p_tss_serial_number) > 512 or char_length(p_client_serial_number) > 512
    or char_length(p_qr_code_data) > 8192
    or p_tse_started_at is null or p_tse_finished_at is null or p_tse_finished_at < p_tse_started_at then
    raise exception 'TSE podpis povračila nima vseh veljavnih dokazil.';
  end if;
  select * into v_refund from public.pos_cash_refunds
  where id = p_refund_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Gotovinsko povračilo ne obstaja.'; end if;
  if v_refund.status in ('signed','completed') then
    if v_refund.signature_counter is distinct from p_signature_counter
      or v_refund.signature_algorithm is distinct from left(coalesce(p_signature_algorithm,''),120)
      or v_refund.tss_serial_number is distinct from p_tss_serial_number
      or v_refund.client_serial_number is distinct from p_client_serial_number
      or v_refund.qr_code_data is distinct from p_qr_code_data
      or v_refund.tse_started_at is distinct from p_tse_started_at
      or v_refund.tse_finished_at is distinct from p_tse_finished_at then
      raise exception 'Povračilo je že vezano na drugačno TSE dokazilo.';
    end if;
    return v_refund;
  end if;
  if v_refund.status <> 'prepared' then raise exception 'Povračilo zahteva ročno TSE uskladitev.'; end if;
  update public.pos_cash_refunds set
    status = 'signed', signature_counter = p_signature_counter,
    signature_algorithm = left(coalesce(p_signature_algorithm,''),120),
    tss_serial_number = p_tss_serial_number, client_serial_number = p_client_serial_number,
    qr_code_data = p_qr_code_data, tse_started_at = p_tse_started_at,
    tse_finished_at = p_tse_finished_at, signed_at = now(), failure_code = ''
  where id = v_refund.id returning * into v_refund;
  return v_refund;
end;
$$;

create function private._pos_mark_training_cash_refund_recovery_required(
  p_user_id uuid,
  p_refund_id uuid,
  p_failure_code text
)
returns public.pos_cash_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare v_refund public.pos_cash_refunds%rowtype;
begin
  select * into v_refund from public.pos_cash_refunds
  where id = p_refund_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Gotovinsko povračilo ne obstaja.'; end if;
  if v_refund.status in ('signed','completed') then return v_refund; end if;
  update public.pos_cash_refunds set status = 'recovery_required',
    failure_code = left(coalesce(nullif(trim(p_failure_code),''),'TSE_RESULT_UNCERTAIN'),120)
  where id = v_refund.id returning * into v_refund;
  return v_refund;
end;
$$;

create function private._pos_complete_training_cash_refund(
  p_user_id uuid,
  p_refund_id uuid
)
returns public.pos_cash_refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.pos_cash_refunds%rowtype;
  v_payment public.pos_payments%rowtype;
begin
  select * into v_refund from public.pos_cash_refunds
  where id = p_refund_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Gotovinsko povračilo ne obstaja.'; end if;
  if v_refund.status = 'completed' then return v_refund; end if;
  if v_refund.status <> 'signed' then raise exception 'Povračilo brez popolnega TSE podpisa ne sme spremeniti plačila.'; end if;

  select * into v_payment from public.pos_payments
  where id = v_refund.payment_id and invoice_id = v_refund.invoice_id and user_id = p_user_id
  for update;
  if not found or v_payment.method <> 'cash' or v_payment.provider <> 'fiskaly'
    or v_payment.status <> 'succeeded' or v_payment.refunded_cents <> 0
    or v_payment.amount_cents <> v_refund.amount_cents then
    raise exception 'Izvirno gotovinsko plačilo se je med TSE podpisom spremenilo.';
  end if;

  update public.pos_payments set
    status = 'refunded', refunded_cents = amount_cents,
    metadata = metadata || jsonb_build_object(
      'cash_refund_id',v_refund.id,'refund_tse_transaction_id',v_refund.transaction_id,
      'refund_signature_counter',v_refund.signature_counter,
      'refund_tss_serial_number',v_refund.tss_serial_number,
      'refund_client_serial_number',v_refund.client_serial_number,
      'refund_qr_code_data',v_refund.qr_code_data,
      'refund_tse_started_at',v_refund.tse_started_at,
      'refund_tse_finished_at',v_refund.tse_finished_at
    )
  where id = v_payment.id;

  update public.pos_cash_refunds set status = 'completed', completed_at = now()
  where id = v_refund.id returning * into v_refund;
  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (p_user_id, 'payment', v_payment.id, 'training_cash_refund_completed',
    jsonb_build_object('invoice_id',v_refund.invoice_id,'checkout_id',v_refund.checkout_id,
      'refund_id',v_refund.id,'amount_cents',v_refund.amount_cents,
      'transaction_id',v_refund.transaction_id,'signature_counter',v_refund.signature_counter));
  return v_refund;
end;
$$;

revoke all on function private._pos_prepare_training_cash_refund(uuid,uuid,uuid,jsonb,boolean) from public, anon;
grant execute on function private._pos_prepare_training_cash_refund(uuid,uuid,uuid,jsonb,boolean) to authenticated, service_role;
revoke all on function public.pos_prepare_training_cash_refund(uuid,uuid,uuid,jsonb,boolean) from public, anon;
grant execute on function public.pos_prepare_training_cash_refund(uuid,uuid,uuid,jsonb,boolean) to authenticated, service_role;
revoke all on function private._pos_record_training_cash_refund_signature(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function private._pos_record_training_cash_refund_signature(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) to service_role;
revoke all on function private._pos_mark_training_cash_refund_recovery_required(uuid,uuid,text) from public, anon, authenticated;
grant execute on function private._pos_mark_training_cash_refund_recovery_required(uuid,uuid,text) to service_role;
revoke all on function private._pos_complete_training_cash_refund(uuid,uuid) from public, anon, authenticated;
grant execute on function private._pos_complete_training_cash_refund(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
