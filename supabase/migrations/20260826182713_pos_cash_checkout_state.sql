-- Cash checkout is deliberately TRAINING-only. The browser may prepare an
-- idempotent checkout, but only a server-side TSE adapter may attach signature
-- evidence and atomically turn that evidence into a cash payment.

alter table public.pos_payments drop constraint if exists pos_payments_method_check;
alter table public.pos_payments drop constraint if exists pos_payments_provider_check;
alter table public.pos_payments
  add constraint pos_payments_method_check
    check (method in ('bank_transfer','external_card','manual','stripe_card','cash')),
  add constraint pos_payments_provider_check
    check (provider in ('manual','external','finapi','stripe','fiskaly'));

create table public.pos_cash_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null,
  request_key uuid not null,
  transaction_id uuid not null,
  status text not null default 'prepared'
    check (status in ('prepared','signed','completed','recovery_required')),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  payment_type text not null default 'CASH' check (payment_type = 'CASH'),
  receipt_snapshot jsonb not null check (jsonb_typeof(receipt_snapshot) = 'object'),
  signature_counter text,
  signature_algorithm text,
  tss_serial_number text,
  client_serial_number text,
  qr_code_data text,
  tse_started_at timestamptz,
  tse_finished_at timestamptz,
  payment_id uuid,
  failure_code text not null default '' check (char_length(failure_code) <= 120),
  prepared_at timestamptz not null default now(),
  signed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, request_key),
  unique (transaction_id),
  unique (payment_id),
  unique (id, user_id),
  constraint pos_cash_checkouts_invoice_tenant_fkey
    foreign key (invoice_id, user_id) references public.pos_invoices(id, user_id) on delete restrict,
  constraint pos_cash_checkouts_payment_tenant_fkey
    foreign key (payment_id, user_id) references public.pos_payments(id, user_id) on delete restrict,
  constraint pos_cash_checkouts_signature_shape_check check (
    (status = 'prepared' and signature_counter is null and signature_algorithm is null
      and tss_serial_number is null and client_serial_number is null and qr_code_data is null
      and tse_started_at is null and tse_finished_at is null and signed_at is null and payment_id is null)
    or
    (status = 'recovery_required' and payment_id is null)
    or
    (status = 'signed' and signature_counter is not null and signature_algorithm is not null
      and tss_serial_number is not null and client_serial_number is not null and qr_code_data is not null
      and tse_started_at is not null and tse_finished_at is not null and signed_at is not null and payment_id is null)
    or
    (status = 'completed' and signature_counter is not null and signature_algorithm is not null
      and tss_serial_number is not null and client_serial_number is not null and qr_code_data is not null
      and tse_started_at is not null and tse_finished_at is not null and signed_at is not null
      and payment_id is not null and completed_at is not null)
  ),
  constraint pos_cash_checkouts_signature_size_check check (
    char_length(coalesce(signature_counter,'')) <= 120
    and char_length(coalesce(signature_algorithm,'')) <= 120
    and char_length(coalesce(tss_serial_number,'')) <= 512
    and char_length(coalesce(client_serial_number,'')) <= 512
    and char_length(coalesce(qr_code_data,'')) <= 8192
  )
);

create index pos_cash_checkouts_user_prepared_idx
  on public.pos_cash_checkouts(user_id, prepared_at desc);
create index pos_cash_checkouts_invoice_user_idx
  on public.pos_cash_checkouts(invoice_id, user_id);

alter table public.pos_cash_checkouts enable row level security;
revoke all on table public.pos_cash_checkouts from public, anon, authenticated;
grant select on table public.pos_cash_checkouts to authenticated;
grant all on table public.pos_cash_checkouts to service_role;
create policy pos_cash_checkouts_select_own on public.pos_cash_checkouts
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create trigger pos_cash_checkouts_updated_at
before update on public.pos_cash_checkouts
for each row execute function private.pos_set_updated_at();

create function private._pos_prepare_training_cash_checkout(
  p_invoice_id uuid,
  p_request_key uuid,
  p_transaction_id uuid,
  p_receipt jsonb,
  p_confirmed boolean default false
)
returns public.pos_cash_checkouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invoice public.pos_invoices%rowtype;
  v_existing public.pos_cash_checkouts%rowtype;
  v_checkout public.pos_cash_checkouts%rowtype;
  v_paid bigint;
  v_outstanding bigint;
  v_amount bigint;
  v_item jsonb;
  v_item_amount bigint;
  v_item_sum bigint := 0;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_invoice_id is null or p_request_key is null or p_transaction_id is null then
    raise exception 'Manjka identiteta gotovinskega checkouta.';
  end if;
  if not coalesce(p_confirmed, false) then raise exception 'Izrecna potrditev gotovinskega plačila je obvezna.'; end if;
  if p_receipt is null or jsonb_typeof(p_receipt) <> 'object' then raise exception 'Neveljaven Kassenbon.'; end if;
  if upper(coalesce(p_receipt->>'payment_type','')) <> 'CASH' or upper(coalesce(p_receipt->>'currency','')) <> 'EUR' then
    raise exception 'Gotovinski checkout zahteva CASH v EUR.';
  end if;
  if jsonb_typeof(p_receipt->'items') <> 'array' then raise exception 'Kassenbon nima veljavnih postavk.'; end if;
  if jsonb_array_length(p_receipt->'items') not between 1 and 100 then raise exception 'Kassenbon mora imeti od 1 do 100 postavk.'; end if;
  begin v_amount := (p_receipt->>'gross_cents')::bigint;
  exception when others then raise exception 'Znesek Kassenbona ni veljaven.'; end;
  if v_amount <= 0 or v_amount > 100000000000 then raise exception 'Znesek Kassenbona ni veljaven.'; end if;
  for v_item in select value from jsonb_array_elements(p_receipt->'items') loop
    if trim(coalesce(v_item->>'description','')) = '' or char_length(v_item->>'description') > 240 then
      raise exception 'Postavka Kassenbona nima veljavnega opisa.';
    end if;
    if coalesce(v_item->>'vat_rate','') not in ('0','7','19') then
      raise exception 'Postavka Kassenbona uporablja nedovoljeno nemško stopnjo DDV.';
    end if;
    begin v_item_amount := (v_item->>'gross_cents')::bigint;
    exception when others then raise exception 'Znesek postavke Kassenbona ni veljaven.'; end;
    if v_item_amount < 0 or v_item_amount > 100000000000 then raise exception 'Znesek postavke Kassenbona ni veljaven.'; end if;
    v_item_sum := v_item_sum + v_item_amount;
  end loop;
  if v_item_sum <> v_amount then raise exception 'Vsota postavk se ne ujema z gotovinskim zneskom.'; end if;

  select * into v_invoice from public.pos_invoices
  where id = p_invoice_id and user_id = v_user
  for update;
  if not found then raise exception 'Račun ne obstaja ali ni vaš.'; end if;
  if v_invoice.is_test is not true then
    raise exception 'Produkcijski gotovinski checkout ostaja zaklenjen do SIGN DE aktivacije in pravne potrditve.';
  end if;
  if exists (
    select 1 from public.pos_invoice_adjustments
    where original_invoice_id = v_invoice.id and user_id = v_user and adjustment_type = 'cancellation'
  ) then raise exception 'Storniranega računa ni mogoče plačati z gotovino.'; end if;

  v_paid := private._pos_effective_paid_cents(v_invoice.id, v_user);
  v_outstanding := v_invoice.gross_cents - v_paid;
  if v_outstanding <= 0 then raise exception 'Račun je že v celoti plačan.'; end if;
  if v_amount <> v_outstanding then raise exception 'Kassenbon se ne ujema s preostankom računa.'; end if;

  select * into v_existing from public.pos_cash_checkouts
  where user_id = v_user and request_key = p_request_key
  for update;
  if found then
    if v_existing.invoice_id is distinct from p_invoice_id
      or v_existing.transaction_id is distinct from p_transaction_id
      or v_existing.amount_cents is distinct from v_amount
      or v_existing.receipt_snapshot is distinct from p_receipt then
      raise exception 'Ključ ponovitve je že vezan na drug gotovinski checkout.';
    end if;
    return v_existing;
  end if;

  if exists (
    select 1 from public.pos_cash_checkouts
    where user_id = v_user and invoice_id = p_invoice_id
      and status in ('prepared','signed','completed','recovery_required')
  ) then raise exception 'Za račun že obstaja gotovinski checkout, ki ga je treba dokončati ali uskladiti.'; end if;

  insert into public.pos_cash_checkouts(
    user_id, invoice_id, request_key, transaction_id, amount_cents, receipt_snapshot
  ) values (
    v_user, p_invoice_id, p_request_key, p_transaction_id, v_amount, p_receipt
  ) returning * into v_checkout;

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (v_user, 'payment', v_checkout.id, 'training_cash_checkout_prepared',
    jsonb_build_object('invoice_id',v_invoice.id,'amount_cents',v_amount,'transaction_id',p_transaction_id));
  return v_checkout;
end;
$$;

create function public.pos_prepare_training_cash_checkout(
  p_invoice_id uuid,
  p_request_key uuid,
  p_transaction_id uuid,
  p_receipt jsonb,
  p_confirmed boolean default false
)
returns public.pos_cash_checkouts
language sql
security invoker
set search_path = ''
as $$
  select private._pos_prepare_training_cash_checkout(
    p_invoice_id, p_request_key, p_transaction_id, p_receipt, p_confirmed
  );
$$;

create function private._pos_record_training_cash_signature(
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
language plpgsql
security definer
set search_path = ''
as $$
declare v_checkout public.pos_cash_checkouts%rowtype;
begin
  if p_user_id is null or p_checkout_id is null then raise exception 'Manjka identiteta TSE podpisa.'; end if;
  if trim(coalesce(p_signature_counter,'')) = '' or trim(coalesce(p_signature_algorithm,'')) = ''
    or trim(coalesce(p_tss_serial_number,'')) = ''
    or trim(coalesce(p_client_serial_number,'')) = '' or trim(coalesce(p_qr_code_data,'')) = ''
    or char_length(p_signature_counter) > 120 or char_length(p_signature_algorithm) > 120
    or char_length(p_tss_serial_number) > 512 or char_length(p_client_serial_number) > 512
    or char_length(p_qr_code_data) > 8192
    or p_tse_started_at is null or p_tse_finished_at is null or p_tse_finished_at < p_tse_started_at then
    raise exception 'TSE podpis nima vseh veljavnih dokazil.';
  end if;
  select * into v_checkout from public.pos_cash_checkouts
  where id = p_checkout_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Gotovinski checkout ne obstaja.'; end if;
  if v_checkout.status in ('signed','completed') then
    if v_checkout.signature_counter is distinct from p_signature_counter
      or v_checkout.signature_algorithm is distinct from left(coalesce(p_signature_algorithm,''),120)
      or v_checkout.tss_serial_number is distinct from p_tss_serial_number
      or v_checkout.client_serial_number is distinct from p_client_serial_number
      or v_checkout.qr_code_data is distinct from p_qr_code_data
      or v_checkout.tse_started_at is distinct from p_tse_started_at
      or v_checkout.tse_finished_at is distinct from p_tse_finished_at then
      raise exception 'Checkout je že vezan na drugačno TSE dokazilo.';
    end if;
    return v_checkout;
  end if;
  if v_checkout.status <> 'prepared' then raise exception 'Checkout zahteva ročno TSE uskladitev.'; end if;
  update public.pos_cash_checkouts set
    status = 'signed', signature_counter = p_signature_counter,
    signature_algorithm = left(coalesce(p_signature_algorithm,''),120),
    tss_serial_number = p_tss_serial_number, client_serial_number = p_client_serial_number,
    qr_code_data = p_qr_code_data, tse_started_at = p_tse_started_at,
    tse_finished_at = p_tse_finished_at, signed_at = now(), failure_code = ''
  where id = v_checkout.id returning * into v_checkout;
  return v_checkout;
end;
$$;

create function private._pos_mark_training_cash_recovery_required(
  p_user_id uuid,
  p_checkout_id uuid,
  p_failure_code text
)
returns public.pos_cash_checkouts
language plpgsql
security definer
set search_path = ''
as $$
declare v_checkout public.pos_cash_checkouts%rowtype;
begin
  select * into v_checkout from public.pos_cash_checkouts
  where id = p_checkout_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Gotovinski checkout ne obstaja.'; end if;
  if v_checkout.status in ('signed','completed') then return v_checkout; end if;
  update public.pos_cash_checkouts set status = 'recovery_required',
    failure_code = left(coalesce(nullif(trim(p_failure_code),''),'TSE_RESULT_UNCERTAIN'),120)
  where id = v_checkout.id returning * into v_checkout;
  return v_checkout;
end;
$$;

create function private._pos_complete_training_cash_checkout(
  p_user_id uuid,
  p_checkout_id uuid
)
returns public.pos_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout public.pos_cash_checkouts%rowtype;
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_outstanding bigint;
begin
  select * into v_checkout from public.pos_cash_checkouts
  where id = p_checkout_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Gotovinski checkout ne obstaja.'; end if;
  if v_checkout.status = 'completed' then
    select * into v_payment from public.pos_payments
    where id = v_checkout.payment_id and user_id = p_user_id;
    if not found then raise exception 'Zaključen checkout nima plačilne sledi.'; end if;
    return v_payment;
  end if;
  if v_checkout.status <> 'signed' then raise exception 'Checkout brez popolnega TSE podpisa ne sme ustvariti plačila.'; end if;

  select * into v_invoice from public.pos_invoices
  where id = v_checkout.invoice_id and user_id = p_user_id
  for update;
  if not found or v_invoice.is_test is not true then raise exception 'TRAINING račun ni več na voljo.'; end if;
  v_outstanding := v_invoice.gross_cents - private._pos_effective_paid_cents(v_invoice.id, p_user_id);
  if v_outstanding <> v_checkout.amount_cents then raise exception 'Odprti znesek se je med TSE podpisom spremenil.'; end if;

  insert into public.pos_payments(
    user_id, invoice_id, amount_cents, currency, method, provider,
    provider_reference, paid_at, status, metadata
  ) values (
    p_user_id, v_invoice.id, v_checkout.amount_cents, 'EUR', 'cash', 'fiskaly',
    v_checkout.transaction_id::text, now(), 'succeeded',
    jsonb_build_object(
      'training',true,'cash_checkout_id',v_checkout.id,'tse_transaction_id',v_checkout.transaction_id,
      'signature_counter',v_checkout.signature_counter,'signature_algorithm',v_checkout.signature_algorithm,
      'tss_serial_number',v_checkout.tss_serial_number,'client_serial_number',v_checkout.client_serial_number,
      'qr_code_data',v_checkout.qr_code_data,'tse_started_at',v_checkout.tse_started_at,
      'tse_finished_at',v_checkout.tse_finished_at
    )
  ) returning * into v_payment;

  update public.pos_cash_checkouts set status = 'completed', payment_id = v_payment.id, completed_at = now()
  where id = v_checkout.id;
  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (p_user_id, 'payment', v_payment.id, 'training_cash_payment_completed',
    jsonb_build_object('invoice_id',v_invoice.id,'checkout_id',v_checkout.id,'amount_cents',v_payment.amount_cents,
      'transaction_id',v_checkout.transaction_id,'signature_counter',v_checkout.signature_counter));
  return v_payment;
end;
$$;

revoke all on function private._pos_prepare_training_cash_checkout(uuid,uuid,uuid,jsonb,boolean) from public, anon;
grant execute on function private._pos_prepare_training_cash_checkout(uuid,uuid,uuid,jsonb,boolean) to authenticated, service_role;
revoke all on function public.pos_prepare_training_cash_checkout(uuid,uuid,uuid,jsonb,boolean) from public, anon;
grant execute on function public.pos_prepare_training_cash_checkout(uuid,uuid,uuid,jsonb,boolean) to authenticated, service_role;
revoke all on function private._pos_record_training_cash_signature(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function private._pos_record_training_cash_signature(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz) to service_role;
revoke all on function private._pos_mark_training_cash_recovery_required(uuid,uuid,text) from public, anon, authenticated;
grant execute on function private._pos_mark_training_cash_recovery_required(uuid,uuid,text) to service_role;
revoke all on function private._pos_complete_training_cash_checkout(uuid,uuid) from public, anon, authenticated;
grant execute on function private._pos_complete_training_cash_checkout(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
