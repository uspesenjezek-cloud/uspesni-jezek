-- Monetary values cross the PostgreSQL/JSON/JavaScript boundary. Keep them in
-- a realistic, exactly representable range and make aggregate relationships
-- database invariants instead of relying only on issuing RPC calculations.

alter table public.pos_invoices
  add constraint pos_invoices_money_invariant_check
    check (
      net_cents between 0 and 100000000000
      and tax_cents between 0 and 100000000000
      and gross_cents between 0 and 100000000000
      and gross_cents = net_cents + tax_cents
      and eligible_35a_cents between 0 and gross_cents
      and (tax_mode = 'regular' or tax_cents = 0)
    ) not valid;

alter table public.pos_invoice_adjustments
  add constraint pos_invoice_adjustments_money_invariant_check
    check (
      delta_net_cents between -100000000000 and 100000000000
      and delta_tax_cents between -100000000000 and 100000000000
      and delta_gross_cents between -100000000000 and 100000000000
      and delta_gross_cents = delta_net_cents + delta_tax_cents
    ) not valid;

alter table public.pos_work_orders
  add constraint pos_work_orders_money_invariant_check
    check (
      net_cents between 0 and 100000000000
      and tax_cents between 0 and 100000000000
      and gross_cents between 1 and 100000000000
      and gross_cents = net_cents + tax_cents
    ) not valid;

alter table public.pos_work_order_invoices
  add constraint pos_work_order_invoices_money_invariant_check
    check (
      net_cents between 0 and 100000000000
      and tax_cents between 0 and 100000000000
      and gross_cents between 1 and 100000000000
      and gross_cents = net_cents + tax_cents
    ) not valid;

alter table public.pos_payments
  add constraint pos_payments_amount_upper_bound_check
    check (amount_cents between 1 and 100000000000) not valid;

alter table public.pos_bank_transactions
  add constraint pos_bank_transactions_amount_upper_bound_check
    check (amount_cents between 1 and 100000000000) not valid;

alter table public.pos_invoices validate constraint pos_invoices_money_invariant_check;
alter table public.pos_invoice_adjustments validate constraint pos_invoice_adjustments_money_invariant_check;
alter table public.pos_work_orders validate constraint pos_work_orders_money_invariant_check;
alter table public.pos_work_order_invoices validate constraint pos_work_order_invoices_money_invariant_check;
alter table public.pos_payments validate constraint pos_payments_amount_upper_bound_check;
alter table public.pos_bank_transactions validate constraint pos_bank_transactions_amount_upper_bound_check;
