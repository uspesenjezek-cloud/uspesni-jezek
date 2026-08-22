-- `payment_method = already_paid` is an explicit confirmation made during
-- issuance. Record it in the payment ledger in the same transaction so the
-- immutable invoice, payment status and audit trail cannot disagree.

create or replace function private.pos_record_already_paid_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.pos_payments%rowtype;
begin
  if new.snapshot #>> '{draft,payment_method}' = 'already_paid'
     and new.gross_cents > 0 then
    insert into public.pos_payments(
      user_id, invoice_id, amount_cents, currency, method, provider,
      provider_reference, paid_at, status, metadata
    ) values (
      new.user_id, new.id, new.gross_cents, 'EUR', 'manual', 'manual',
      'Bei Rechnungsausstellung als bezahlt bestätigt', new.issued_at, 'succeeded',
      jsonb_build_object(
        'confirmation_source', 'invoice_issuance',
        'invoice_number', new.invoice_number
      )
    ) returning * into v_payment;

    insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
    values (
      new.user_id, 'payment', v_payment.id, 'invoice_issued_already_paid',
      jsonb_build_object(
        'invoice_id', new.id,
        'invoice_number', new.invoice_number,
        'amount_cents', new.gross_cents,
        'currency', 'EUR',
        'provider', 'manual'
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function private.pos_record_already_paid_invoice()
  from public, anon, authenticated;
grant execute on function private.pos_record_already_paid_invoice()
  to service_role;

create trigger pos_invoices_record_already_paid
after insert on public.pos_invoices
for each row execute function private.pos_record_already_paid_invoice();
