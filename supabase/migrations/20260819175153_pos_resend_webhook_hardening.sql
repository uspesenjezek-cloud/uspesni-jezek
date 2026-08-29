-- Dodatna obramba za zasebni webhook sprejemnik. Service-role in lastnik
-- funkcije obdrzita dostop, odjemalci pa nimajo neposredne politike.
alter table private.pos_resend_webhook_receipts enable row level security;
create index pos_resend_webhook_receipts_delivery_idx
  on private.pos_resend_webhook_receipts(matched_delivery_id)
  where matched_delivery_id is not null;
