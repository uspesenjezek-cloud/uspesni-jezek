-- SQL comparisons with NULL evaluate to UNKNOWN. Use NULL-safe comparisons so
-- a missing embedded source field cannot bypass the immutable adjustment
-- source check, and reuse the strict changes validator on every insert path.

create or replace function private.pos_validate_adjustment_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.pos_invoices%rowtype;
  v_expected_status text;
begin
  perform private.pos_validate_adjustment_changes(
    new.adjustment_type,
    new.reason,
    new.changes
  );

  select * into v_invoice
  from public.pos_invoices
  where id = new.original_invoice_id and user_id = new.user_id;

  v_expected_status := case when v_invoice.is_test then 'test' else 'issued' end;

  if not found
     or new.is_test is distinct from v_invoice.is_test
     or new.document_status is distinct from v_expected_status
     or new.snapshot #>> '{original_invoice,id}' is distinct from v_invoice.id::text
     or new.snapshot #>> '{original_invoice,invoice_number}' is distinct from v_invoice.invoice_number
     or (new.snapshot #>> '{original_invoice,issue_date}')::date is distinct from v_invoice.issue_date
     or (new.snapshot #>> '{original_invoice,net_cents}')::bigint is distinct from v_invoice.net_cents
     or (new.snapshot #>> '{original_invoice,tax_cents}')::bigint is distinct from v_invoice.tax_cents
     or (new.snapshot #>> '{original_invoice,gross_cents}')::bigint is distinct from v_invoice.gross_cents
     or (new.snapshot #>> '{original_invoice,is_test}')::boolean is distinct from v_invoice.is_test then
    raise exception 'Popravek se ne ujema z izvornim računom.';
  end if;

  if new.adjustment_type = 'cancellation' and (
    new.delta_net_cents <> -v_invoice.net_cents
    or new.delta_tax_cents <> -v_invoice.tax_cents
    or new.delta_gross_cents <> -v_invoice.gross_cents
  ) then
    raise exception 'Storno nima pravilnih nasprotnih zneskov.';
  end if;

  if new.adjustment_type = 'correction' and new.changes ? 'due_date' and (
    (new.changes->>'due_date')::date < v_invoice.issue_date
    or (new.changes->>'due_date')::date > v_invoice.issue_date + 365
  ) then
    raise exception 'Popravljeni rok plačila mora biti med datumom izdaje in 365 dnevi pozneje.';
  end if;

  return new;
end;
$$;

revoke all on function private.pos_validate_adjustment_source() from public, anon, authenticated;
grant execute on function private.pos_validate_adjustment_source() to service_role;

;
