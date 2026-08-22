-- Defense in depth for the delivery outbox. The preparation RPC already
-- validates these values, but database constraints also protect future
-- service-role workers and provider integrations from unbounded input.

alter table public.pos_invoice_deliveries
  add constraint pos_invoice_deliveries_recipient_length_check
    check (char_length(recipient) <= 320 and recipient !~ E'[\\r\\n]') not valid,
  add constraint pos_invoice_deliveries_routing_reference_length_check
    check (char_length(routing_reference) <= 160 and routing_reference !~ E'[\\r\\n]') not valid,
  add constraint pos_invoice_deliveries_subject_length_check
    check (char_length(subject) <= 240 and subject !~ E'[\\r\\n]') not valid,
  add constraint pos_invoice_deliveries_message_length_check
    check (char_length(message) <= 4000) not valid,
  add constraint pos_invoice_deliveries_provider_length_check
    check (char_length(provider) between 1 and 80 and provider !~ E'[\\r\\n]') not valid,
  add constraint pos_invoice_deliveries_provider_reference_length_check
    check (char_length(provider_reference) <= 240 and provider_reference !~ E'[\\r\\n]') not valid,
  add constraint pos_invoice_deliveries_last_error_length_check
    check (char_length(last_error) <= 1000) not valid,
  add constraint pos_invoice_deliveries_last_provider_event_type_length_check
    check (char_length(last_provider_event_type) <= 120 and last_provider_event_type !~ E'[\\r\\n]') not valid;

alter table public.pos_invoice_delivery_events
  add constraint pos_invoice_delivery_events_provider_event_id_length_check
    check (provider_event_id is null or (
      char_length(provider_event_id) between 1 and 240
      and provider_event_id !~ E'[\\r\\n]'
    )) not valid,
  add constraint pos_invoice_delivery_events_details_check
    check (
      jsonb_typeof(details) = 'object'
      and octet_length(details::text) <= 65536
    ) not valid;

alter table public.pos_invoice_deliveries
  validate constraint pos_invoice_deliveries_recipient_length_check,
  validate constraint pos_invoice_deliveries_routing_reference_length_check,
  validate constraint pos_invoice_deliveries_subject_length_check,
  validate constraint pos_invoice_deliveries_message_length_check,
  validate constraint pos_invoice_deliveries_provider_length_check,
  validate constraint pos_invoice_deliveries_provider_reference_length_check,
  validate constraint pos_invoice_deliveries_last_error_length_check,
  validate constraint pos_invoice_deliveries_last_provider_event_type_length_check;

alter table public.pos_invoice_delivery_events
  validate constraint pos_invoice_delivery_events_provider_event_id_length_check,
  validate constraint pos_invoice_delivery_events_details_check;
