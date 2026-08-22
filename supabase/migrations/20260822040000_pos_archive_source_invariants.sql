-- The archive manifest is immutable, so reject any source mismatch before it
-- can become a permanent retention record. This also ties each document type
-- to the correct private bucket, media type and size ceiling.

alter table public.pos_archive_records
  add constraint pos_archive_records_source_shape_check
  check (
    (
      source_table = 'pos_invoice_documents'
      and storage_bucket = 'pos-invoice-originals'
      and document_kind = 'invoice_pdf'
      and original_media_type = 'application/pdf'
      and byte_size <= 5242880
    ) or (
      source_table = 'pos_einvoice_documents'
      and storage_bucket = 'pos-einvoice-originals'
      and document_kind = 'xrechnung_ubl'
      and original_media_type = 'application/xml'
      and byte_size <= 2097152
    ) or (
      source_table = 'pos_adjustment_documents'
      and storage_bucket = 'pos-invoice-originals'
      and document_kind = 'adjustment_pdf'
      and original_media_type = 'application/pdf'
      and byte_size <= 5242880
    )
  ) not valid;

create or replace function private.pos_validate_archive_record_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_invoice_id uuid;
  v_storage_bucket text;
  v_storage_path text;
  v_document_kind text;
  v_media_type text;
  v_sha256 text;
  v_byte_size bigint;
  v_archived_at timestamptz;
  v_retention_not_before date;
begin
  if new.source_table = 'pos_invoice_documents' then
    select document.user_id, document.invoice_id, 'pos-invoice-originals',
      document.storage_path, document.document_kind, document.media_type,
      document.sha256, document.byte_size, document.created_at,
      make_date(extract(year from invoice.issue_date)::integer + 8, 12, 31)
    into v_user_id, v_invoice_id, v_storage_bucket, v_storage_path,
      v_document_kind, v_media_type, v_sha256, v_byte_size, v_archived_at,
      v_retention_not_before
    from public.pos_invoice_documents document
    join public.pos_invoices invoice on invoice.id = document.invoice_id
    where document.id = new.source_id;
  elsif new.source_table = 'pos_einvoice_documents' then
    select document.user_id, document.invoice_id, 'pos-einvoice-originals',
      document.storage_path, document.document_kind, document.media_type,
      document.sha256, document.byte_size, document.created_at,
      make_date(extract(year from invoice.issue_date)::integer + 8, 12, 31)
    into v_user_id, v_invoice_id, v_storage_bucket, v_storage_path,
      v_document_kind, v_media_type, v_sha256, v_byte_size, v_archived_at,
      v_retention_not_before
    from public.pos_einvoice_documents document
    join public.pos_invoices invoice on invoice.id = document.invoice_id
    where document.id = new.source_id;
  elsif new.source_table = 'pos_adjustment_documents' then
    select document.user_id, adjustment.original_invoice_id, 'pos-invoice-originals',
      document.storage_path, document.document_kind, document.media_type,
      document.sha256, document.byte_size, document.created_at,
      make_date(extract(year from adjustment.issued_at)::integer + 8, 12, 31)
    into v_user_id, v_invoice_id, v_storage_bucket, v_storage_path,
      v_document_kind, v_media_type, v_sha256, v_byte_size, v_archived_at,
      v_retention_not_before
    from public.pos_adjustment_documents document
    join public.pos_invoice_adjustments adjustment on adjustment.id = document.adjustment_id
    where document.id = new.source_id;
  end if;

  if v_user_id is null
     or (new.user_id, new.invoice_id, new.storage_bucket, new.storage_path,
         new.document_kind, new.original_media_type, new.sha256, new.byte_size,
         new.archived_at, new.retention_not_before)
        is distinct from
        (v_user_id, v_invoice_id, v_storage_bucket, v_storage_path,
         v_document_kind, v_media_type, v_sha256, v_byte_size,
         v_archived_at, v_retention_not_before)
     or new.retention_years <> 8
     or new.retention_basis <> 'UStG § 14b; AO § 147'
     or new.encryption_scope <> 'provider_managed_at_rest' then
    raise exception 'Arhivski manifest se ne ujema z izvornim dokumentom.';
  end if;

  return new;
end;
$$;

revoke all on function private.pos_validate_archive_record_source() from public, anon, authenticated;
grant execute on function private.pos_validate_archive_record_source() to service_role;

create trigger pos_archive_records_validate_source
before insert on public.pos_archive_records
for each row execute function private.pos_validate_archive_record_source();

alter table public.pos_archive_records
  validate constraint pos_archive_records_source_shape_check;
