-- Pokrije tuji ključ invoice_id neodvisno od uporabniškega RLS indeksa.
create index pos_payments_invoice_idx on public.pos_payments(invoice_id);
