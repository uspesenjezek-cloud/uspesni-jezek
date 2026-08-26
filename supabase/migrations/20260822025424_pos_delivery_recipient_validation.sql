-- Delivery targets are browser-controlled and must be valid before a queued
-- worker hands them to an external provider. Also keep line breaks out of
-- address/routing/header fields while allowing them in the message body.

alter table public.pos_invoice_deliveries
  add constraint pos_invoice_deliveries_email_recipient_check
  check (
    channel <> 'email'
    or trim(recipient) ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ) not valid;

alter table public.pos_invoice_deliveries
  add constraint pos_invoice_deliveries_header_line_check
  check (
    recipient !~ E'[\r\n]'
    and routing_reference !~ E'[\r\n]'
    and subject !~ E'[\r\n]'
  ) not valid;

alter table public.pos_invoice_deliveries
  validate constraint pos_invoice_deliveries_email_recipient_check;
alter table public.pos_invoice_deliveries
  validate constraint pos_invoice_deliveries_header_line_check;

;
