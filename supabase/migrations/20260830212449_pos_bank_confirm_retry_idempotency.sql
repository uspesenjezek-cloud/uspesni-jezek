-- A lost HTTP response after a successful bank confirmation must be safe to
-- retry.  The bank transaction itself is the idempotency key: the same
-- transaction/invoice binding returns its existing payment, while any other
-- binding fails closed.  Acquire the invoice lock before the bank transaction
-- lock so all invoice-settlement paths share the same lock order.

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
  if p_transaction_id is null then raise exception 'Manjka bančna transakcija.'; end if;
  if p_invoice_id is null then raise exception 'Manjka račun.'; end if;
  if not coalesce(p_confirmed, false) then raise exception 'Potrditev uporabnika je obvezna.'; end if;

  select * into v_invoice
  from public.pos_invoices
  where id = p_invoice_id and user_id = v_user
  for update;
  if not found then raise exception 'Račun ne obstaja.'; end if;

  select * into v_transaction
  from public.pos_bank_transactions
  where id = p_transaction_id and user_id = v_user
  for update;
  if not found then raise exception 'Bančna transakcija ne obstaja.'; end if;

  if v_transaction.status = 'confirmed' then
    if v_transaction.confirmed_invoice_id is distinct from v_invoice.id
      or v_transaction.confirmed_payment_id is null then
      raise exception using
        errcode = '23514',
        message = 'POS_BANK_TRANSACTION_BINDING_CONFLICT';
    end if;

    select * into v_payment
    from public.pos_payments
    where id = v_transaction.confirmed_payment_id
      and user_id = v_user
      and invoice_id = v_invoice.id
      and source_bank_transaction_id = v_transaction.id
      and amount_cents = v_transaction.amount_cents
      and currency = v_transaction.currency
      and method = 'bank_transfer'
      and provider = 'finapi'
    for update;
    if not found then
      raise exception using
        errcode = '23514',
        message = 'POS_BANK_TRANSACTION_BINDING_CONFLICT';
    end if;
    return v_payment;
  end if;

  if v_transaction.status is distinct from 'unmatched'
    or v_transaction.confirmed_invoice_id is not null
    or v_transaction.confirmed_payment_id is not null
    or v_transaction.confirmed_at is not null then
    raise exception using
      errcode = '23514',
      message = 'POS_BANK_TRANSACTION_BINDING_CONFLICT';
  end if;

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

  v_paid := private._pos_effective_paid_cents(v_invoice.id, v_user);
  if v_paid >= v_invoice.gross_cents then raise exception 'Račun je že v celoti plačan.'; end if;
  if v_transaction.amount_cents > v_invoice.gross_cents - v_paid then
    raise exception 'Priliv presega odprti znesek računa. Potrebna je ročna obravnava preplačila.';
  end if;

  insert into public.pos_payments(
    user_id, invoice_id, amount_cents, currency, method, provider,
    provider_reference, paid_at, status, source_bank_transaction_id
  ) values (
    v_user, v_invoice.id, v_transaction.amount_cents, v_transaction.currency,
    'bank_transfer', 'finapi',
    coalesce(nullif(v_transaction.external_reference, ''), v_transaction.source_key),
    v_transaction.booked_on::timestamptz, 'succeeded', v_transaction.id
  ) returning * into v_payment;

  update public.pos_bank_transactions
  set status = 'confirmed',
      confirmed_invoice_id = v_invoice.id,
      confirmed_payment_id = v_payment.id,
      confirmed_at = now()
  where id = v_transaction.id;

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (v_user, 'payment', v_payment.id, 'bank_payment_confirmed', jsonb_build_object(
    'bank_transaction_id', v_transaction.id,
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.invoice_number,
    'amount_cents', v_transaction.amount_cents,
    'confirmed_by', v_user,
    'provider', 'finapi'
  ));
  return v_payment;
end;
$$;

revoke all on function private._pos_confirm_bank_transaction(uuid,uuid,boolean)
  from public, anon, authenticated;
grant execute on function private._pos_confirm_bank_transaction(uuid,uuid,boolean)
  to service_role;

alter function public.pos_confirm_bank_transaction(uuid,uuid,boolean) security definer;
alter function public.pos_confirm_bank_transaction(uuid,uuid,boolean) set search_path = '';
revoke all on function public.pos_confirm_bank_transaction(uuid,uuid,boolean)
  from public, anon;
grant execute on function public.pos_confirm_bank_transaction(uuid,uuid,boolean)
  to authenticated, service_role;

notify pgrst, 'reload schema';
