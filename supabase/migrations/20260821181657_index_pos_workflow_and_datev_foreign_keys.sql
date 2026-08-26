create index if not exists pos_work_order_events_work_order_id_idx
  on public.pos_work_order_events (work_order_id);
create index if not exists pos_datev_document_transfers_archive_record_id_idx
  on public.pos_datev_document_transfers (archive_record_id);
