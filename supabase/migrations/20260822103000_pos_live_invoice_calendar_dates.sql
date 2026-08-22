-- A legal invoice's issue date is the day on which it is actually issued.
-- Backdating would also shorten the archive period because retention starts
-- at the end of the issue year. This POS does not support advance invoices,
-- so a live service date may not be later than the issue date.

alter table public.pos_invoices
  add constraint pos_invoices_live_service_date_check
  check (is_test or service_date <= issue_date) not valid;

create or replace function private.pos_enforce_live_invoice_issue_date()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.is_test
     and new.issue_date is distinct from
       (pg_catalog.timezone('Europe/Berlin', pg_catalog.now()))::date then
    raise exception 'Datum izdaje pravega računa mora biti današnji nemški poslovni datum.';
  end if;
  return new;
end;
$$;

revoke all on function private.pos_enforce_live_invoice_issue_date()
  from public, anon, authenticated;

alter table public.pos_invoices
  validate constraint pos_invoices_live_service_date_check;
