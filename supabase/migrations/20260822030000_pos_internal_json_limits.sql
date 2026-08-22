-- Keep append-only evidence and provider metadata bounded. These columns are
-- produced by trusted RPCs/workers, but external validator and payment data
-- must still have an explicit database boundary.

alter table public.pos_archive_integrity_events
  add constraint pos_archive_integrity_events_details_size_check
    check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 65536) not valid;

alter table public.pos_archive_replica_events
  add constraint pos_archive_replica_events_details_size_check
    check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 65536) not valid;

alter table public.pos_audit_events
  add constraint pos_audit_events_details_size_check
    check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 65536) not valid;

alter table public.pos_datev_connections
  add constraint pos_datev_connections_services_size_check
    check (jsonb_typeof(services) = 'array' and octet_length(services::text) <= 65536) not valid;

alter table public.pos_einvoice_documents
  add constraint pos_einvoice_documents_validation_report_size_check
    check (
      jsonb_typeof(validation_report) = 'object'
      and octet_length(validation_report::text) <= 2097152
    ) not valid;

alter table public.pos_einvoice_validation_events
  add constraint pos_einvoice_validation_events_report_size_check
    check (jsonb_typeof(report) = 'object' and octet_length(report::text) <= 2097152) not valid;

alter table public.pos_payment_events
  add constraint pos_payment_events_summary_size_check
    check (jsonb_typeof(summary) = 'object' and octet_length(summary::text) <= 65536) not valid;

alter table public.pos_payments
  add constraint pos_payments_metadata_size_check
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 65536) not valid;

alter table public.pos_work_order_events
  add constraint pos_work_order_events_details_size_check
    check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 65536) not valid;

alter table public.pos_archive_integrity_events
  validate constraint pos_archive_integrity_events_details_size_check;
alter table public.pos_archive_replica_events
  validate constraint pos_archive_replica_events_details_size_check;
alter table public.pos_audit_events
  validate constraint pos_audit_events_details_size_check;
alter table public.pos_datev_connections
  validate constraint pos_datev_connections_services_size_check;
alter table public.pos_einvoice_documents
  validate constraint pos_einvoice_documents_validation_report_size_check;
alter table public.pos_einvoice_validation_events
  validate constraint pos_einvoice_validation_events_report_size_check;
alter table public.pos_payment_events
  validate constraint pos_payment_events_summary_size_check;
alter table public.pos_payments
  validate constraint pos_payments_metadata_size_check;
alter table public.pos_work_order_events
  validate constraint pos_work_order_events_details_size_check;
