-- Cover composite foreign keys used by the POS workflow. Besides avoiding
-- full-table scans during parent updates/deletes, these indexes keep tenant
-- ownership joins efficient as the retained document history grows.
create index if not exists pos_withdrawal_settlements_order_user_idx
  on public.pos_consumer_withdrawal_settlements (work_order_id, user_id);

create index if not exists pos_invoice_adjustments_work_order_user_idx
  on public.pos_invoice_adjustments (work_order_id, user_id);

create index if not exists pos_invoice_deliveries_adjustment_user_idx
  on public.pos_invoice_deliveries (adjustment_id, user_id);

create index if not exists pos_work_order_acceptances_offer_document_user_idx
  on public.pos_work_order_acceptances (offer_document_id, user_id);

create index if not exists pos_work_order_acceptances_order_user_idx
  on public.pos_work_order_acceptances (work_order_id, user_id);

create index if not exists pos_work_order_cancellations_offer_document_user_idx
  on public.pos_work_order_cancellations (offer_document_id, user_id);

create index if not exists pos_work_order_cancellations_order_user_idx
  on public.pos_work_order_cancellations (work_order_id, user_id);

;
