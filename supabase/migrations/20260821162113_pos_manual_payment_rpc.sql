-- Manual payment confirmation must be atomic and server-calculated. Direct
-- table inserts allowed a browser to overpay an invoice or create duplicate
-- confirmations without an audit event.
revoke insert on table public.pos_payments from authenticated;
drop policy if exists pos_payment_insert_own on public.pos_payments;

create or replace function private._pos_record_manual_payment(
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
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_paid bigint;
  v_outstanding bigint;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_invoice_id is null then raise exception 'Manjka račun.'; end if;
  if not coalesce(p_confirmed, false) then
    raise exception 'Ročna potrditev plačila je obvezna.';
  end if;

  select * into v_invoice from public.pos_invoices
  where id = p_invoice_id and user_id = v_user
  for update;
  if not found then raise exception 'Račun ne obstaja ali ni vaš.'; end if;

  if exists (
    select 1 from public.pos_invoice_adjustments
    where original_invoice_id = v_invoice.id
      and user_id = v_user
      and adjustment_type = 'cancellation'
  ) then raise exception 'Storniranega računa ni mogoče označiti kot plačanega.';
  end if;

  v_paid := private._pos_effective_paid_cents(v_invoice.id, v_user);
  v_outstanding := v_invoice.gross_cents - v_paid;
  if v_outstanding <= 0 then raise exception 'Račun je že v celoti plačan.'; end if;

  insert into public.pos_payments(
    user_id, invoice_id, amount_cents, currency, method, provider,
    provider_reference, paid_at, status, metadata
  ) values (
    v_user, v_invoice.id, v_outstanding, 'EUR', 'manual', 'manual',
    'Ročno potrjeno v POS', now(), 'succeeded',
    jsonb_build_object('confirmed_by', v_user, 'confirmation_source', 'pos_terminal')
  ) returning * into v_payment;

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (
    v_user, 'payment', v_payment.id, 'manual_payment_confirmed',
    jsonb_build_object(
      'invoice_id', v_invoice.id,
      'invoice_number', v_invoice.invoice_number,
      'amount_cents', v_payment.amount_cents,
      'currency', v_payment.currency,
      'confirmed_by', v_user,
      'provider', 'manual'
    )
  );

  return v_payment;
end;
$$;

create or replace function public.pos_record_manual_payment(
  p_invoice_id uuid,
  p_confirmed boolean default false
)
returns public.pos_payments
language sql
security invoker
set search_path = ''
as $$
  select private._pos_record_manual_payment(p_invoice_id, p_confirmed);
$$;

revoke all on function private._pos_record_manual_payment(uuid,boolean) from public, anon;
revoke all on function public.pos_record_manual_payment(uuid,boolean) from public, anon;
grant execute on function private._pos_record_manual_payment(uuid,boolean) to authenticated, service_role;
grant execute on function public.pos_record_manual_payment(uuid,boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
