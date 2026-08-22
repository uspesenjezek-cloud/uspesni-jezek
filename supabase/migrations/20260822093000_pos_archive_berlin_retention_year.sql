-- The retention year of a correction/cancellation must follow the German
-- business date. PostgreSQL otherwise extracts the year from timestamptz in
-- the database session zone (UTC), which can shorten retention by one year for
-- documents issued shortly after midnight in Germany on 1 January.

create or replace function private.pos_archive_document_manifest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_id uuid;
  v_issue_year integer;
  v_bucket text;
begin
  if tg_table_name = 'pos_adjustment_documents' then
    select a.original_invoice_id,
           extract(year from (a.issued_at at time zone 'Europe/Berlin'))::integer
      into v_invoice_id, v_issue_year
    from public.pos_invoice_adjustments as a
    where a.id = new.adjustment_id and a.user_id = new.user_id;
    v_bucket := 'pos-invoice-originals';
  else
    select i.id, extract(year from i.issue_date)::integer
      into v_invoice_id, v_issue_year
    from public.pos_invoices as i
    where i.id = new.invoice_id and i.user_id = new.user_id;
    v_bucket := case when tg_table_name = 'pos_einvoice_documents'
      then 'pos-einvoice-originals' else 'pos-invoice-originals' end;
  end if;

  if v_invoice_id is null or v_issue_year is null then
    raise exception 'Arhivskega dokumenta ni mogoče povezati z računom.';
  end if;

  insert into public.pos_archive_records(
    user_id, invoice_id, source_table, source_id, storage_bucket, storage_path,
    document_kind, original_media_type, sha256, byte_size, archived_at,
    retention_years, retention_not_before
  ) values (
    new.user_id, v_invoice_id, tg_table_name, new.id, v_bucket, new.storage_path,
    new.document_kind, new.media_type, new.sha256, new.byte_size, new.created_at,
    8, make_date(v_issue_year + 8, 12, 31)
  );
  return new;
end;
$$;

revoke all on function private.pos_archive_document_manifest()
  from public, anon, authenticated;
grant execute on function private.pos_archive_document_manifest()
  to service_role;
