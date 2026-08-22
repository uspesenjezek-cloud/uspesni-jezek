-- A numbered POS invoice is a payment claim, not a zero-value informational
-- document. Prevent an accidental all-zero invoice from consuming an immutable
-- sequence number and entering the tax archive.

alter table public.pos_invoices
  add constraint pos_invoices_positive_total_check
  check (gross_cents > 0) not valid;

alter table public.pos_invoices
  validate constraint pos_invoices_positive_total_check;
