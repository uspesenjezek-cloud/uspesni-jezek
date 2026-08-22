-- A prepared delivery can be previewed before choosing test/live mode. Once it
-- is queued or handed to a provider, its mode must match the source invoice and
-- its worker/provider evidence must remain internally consistent.

alter table public.pos_invoice_deliveries
  add constraint pos_invoice_deliveries_lifecycle_check
  check (
    updated_at >= created_at
    and prepared_at >= created_at
    and ((last_provider_event_at is null) = (last_provider_event_type = ''))
    and ((locked_at is null) = (locked_by is null))
    and ((status = 'processing') = (locked_at is not null))
    and (
      status not in ('test_completed','delivered','failed','bounced','complained','suppressed')
      or (completed_at is not null and next_attempt_at is null and locked_at is null)
    )
    and (
      status not in ('test_completed','sent','delivered','delivery_delayed','bounced','complained','suppressed')
      or provider_reference <> ''
    )
    and (
      status not in ('sent','delivered','delivery_delayed','bounced','complained','suppressed')
      or last_provider_event_at is not null
    )
  ) not valid;

create or replace function private.pos_validate_delivery_invoice_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_is_test boolean;
begin
  select invoice.is_test into v_invoice_is_test
  from public.pos_invoices invoice
  where invoice.id = new.invoice_id and invoice.user_id = new.user_id;

  if not found then
    raise exception 'Dostave ni mogoče povezati z izvornim računom.';
  end if;

  if not (new.status = 'test_prepared' and new.provider = 'not_connected')
     and new.is_test <> v_invoice_is_test then
    raise exception 'Način dostave se ne ujema s testnim oziroma pravim računom.';
  end if;

  return new;
end;
$$;

revoke all on function private.pos_validate_delivery_invoice_mode() from public, anon, authenticated;
grant execute on function private.pos_validate_delivery_invoice_mode() to service_role;

create trigger pos_invoice_deliveries_validate_invoice_mode
before insert or update of invoice_id, user_id, status, provider, is_test
on public.pos_invoice_deliveries
for each row execute function private.pos_validate_delivery_invoice_mode();

alter table public.pos_invoice_deliveries
  validate constraint pos_invoice_deliveries_lifecycle_check;
