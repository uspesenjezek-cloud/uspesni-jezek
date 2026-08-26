-- Keep document dates internally consistent at the database boundary. Test
-- invoices may deliberately use future dates for regulatory simulations, but
-- a live invoice's issue date must describe the actual day of issuance.

alter table public.pos_invoices
  add constraint pos_invoices_date_invariant_check
    check (
      due_date between issue_date and issue_date + 365
      and (
        (is_test and document_status = 'test')
        or (not is_test and document_status = 'issued')
      )
    ) not valid;

alter table public.pos_work_orders
  add constraint pos_work_orders_validity_window_check
    check (
      valid_until between
        (created_at at time zone 'Europe/Berlin')::date
        and (created_at at time zone 'Europe/Berlin')::date + 180
    ) not valid;

create or replace function private.pos_enforce_live_invoice_issue_date()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.is_test
     and new.issue_date > (pg_catalog.timezone('Europe/Berlin', pg_catalog.now()))::date then
    raise exception 'Datum izdaje pravega računa ne sme biti v prihodnosti.';
  end if;
  return new;
end;
$$;

revoke all on function private.pos_enforce_live_invoice_issue_date() from public, anon, authenticated;

create trigger pos_invoices_live_issue_date_guard
before insert or update of issue_date, is_test on public.pos_invoices
for each row execute function private.pos_enforce_live_invoice_issue_date();

alter table public.pos_invoices validate constraint pos_invoices_date_invariant_check;
alter table public.pos_work_orders validate constraint pos_work_orders_validity_window_check;

;
