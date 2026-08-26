-- Cover both composite foreign keys used by immutable early-start evidence.

create index pos_work_order_early_start_order_user_idx
  on public.pos_work_order_early_start_evidence(work_order_id, user_id);

create index pos_work_order_early_start_document_user_idx
  on public.pos_work_order_early_start_evidence(offer_document_id, user_id);

;
