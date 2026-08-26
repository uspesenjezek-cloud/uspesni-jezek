-- Adjustments are immutable legal records. Bind their mode, amounts, dates and
-- embedded original-invoice snapshot to the actual source invoice before the
-- row can enter the permanent correction trail.

alter table public.pos_invoice_adjustments
  add constraint pos_invoice_adjustments_kind_shape_check
  check (
    ((is_test and document_status = 'test') or (not is_test and document_status = 'issued'))
    and (
      (
        adjustment_type = 'correction'
        and changes <> '{}'::jsonb
        and delta_net_cents = 0
        and delta_tax_cents = 0
        and delta_gross_cents = 0
      ) or (
        adjustment_type = 'cancellation'
        and changes = '{}'::jsonb
        and delta_net_cents <= 0
        and delta_tax_cents <= 0
        and delta_gross_cents < 0
      )
    )
  ) not valid;

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
  select * into v_invoice
  from public.pos_invoices
  where id = new.original_invoice_id and user_id = new.user_id;

  v_expected_status := case when v_invoice.is_test then 'test' else 'issued' end;

  if not found
     or new.is_test <> v_invoice.is_test
     or new.document_status <> v_expected_status
     or new.snapshot #>> '{original_invoice,id}' <> v_invoice.id::text
     or new.snapshot #>> '{original_invoice,invoice_number}' <> v_invoice.invoice_number
     or (new.snapshot #>> '{original_invoice,issue_date}')::date <> v_invoice.issue_date
     or (new.snapshot #>> '{original_invoice,net_cents}')::bigint <> v_invoice.net_cents
     or (new.snapshot #>> '{original_invoice,tax_cents}')::bigint <> v_invoice.tax_cents
     or (new.snapshot #>> '{original_invoice,gross_cents}')::bigint <> v_invoice.gross_cents
     or (new.snapshot #>> '{original_invoice,is_test}')::boolean <> v_invoice.is_test then
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

create trigger pos_invoice_adjustments_validate_source
before insert on public.pos_invoice_adjustments
for each row execute function private.pos_validate_adjustment_source();

alter table public.pos_invoice_adjustments
  validate constraint pos_invoice_adjustments_kind_shape_check;

;
