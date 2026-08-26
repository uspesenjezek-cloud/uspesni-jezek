-- When no valid Freistellungsbescheinigung exists, the customer may have to
-- withhold 15 percent of the gross consideration under section 48 EStG and
-- remit it to the tax office. The current POS payment model expects the full
-- invoice amount and cannot yet reconcile that split safely. Keep this case
-- in test mode instead of issuing a legally misleading live payment request.

alter table public.pos_invoices
  add constraint pos_invoices_live_bauabzug_support_check
  check (
    is_test
    or coalesce(snapshot #>> '{draft,construction_withholding}', 'false') <> 'true'
    or coalesce(snapshot #>> '{draft,exemption_certificate}', 'unknown') <> 'missing'
  ) not valid;

alter table public.pos_invoices
  validate constraint pos_invoices_live_bauabzug_support_check;
;
