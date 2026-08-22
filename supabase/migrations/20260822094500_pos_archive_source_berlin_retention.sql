-- Keep the source-integrity guard aligned with the manifest's German business
-- year. Otherwise the guard would reject the corrected retention date exactly
-- during the UTC/Germany New Year boundary.

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
    from public.pos_invoice_documents as document
    join public.pos_invoices as invoice on invoice.id = document.invoice_id
    where document.id = new.source_id;
  elsif new.source_table = 'pos_einvoice_documents' then
    select document.user_id, document.invoice_id, 'pos-einvoice-originals',
      document.storage_path, document.document_kind, document.media_type,
      document.sha256, document.byte_size, document.created_at,
      make_date(extract(year from invoice.issue_date)::integer + 8, 12, 31)
    into v_user_id, v_invoice_id, v_storage_bucket, v_storage_path,
      v_document_kind, v_media_type, v_sha256, v_byte_size, v_archived_at,
      v_retention_not_before
    from public.pos_einvoice_documents as document
    join public.pos_invoices as invoice on invoice.id = document.invoice_id
    where document.id = new.source_id;
  elsif new.source_table = 'pos_adjustment_documents' then
    select document.user_id, adjustment.original_invoice_id, 'pos-invoice-originals',
      document.storage_path, document.document_kind, document.media_type,
      document.sha256, document.byte_size, document.created_at,
      make_date(extract(year from (adjustment.issued_at at time zone 'Europe/Berlin'))::integer + 8, 12, 31)
    into v_user_id, v_invoice_id, v_storage_bucket, v_storage_path,
      v_document_kind, v_media_type, v_sha256, v_byte_size, v_archived_at,
      v_retention_not_before
    from public.pos_adjustment_documents as document
    join public.pos_invoice_adjustments as adjustment on adjustment.id = document.adjustment_id
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

revoke all on function private.pos_validate_archive_record_source()
  from public, anon, authenticated;
grant execute on function private.pos_validate_archive_record_source()
  to service_role;
