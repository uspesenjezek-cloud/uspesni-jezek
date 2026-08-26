-- A successful provider submission has a provider reference before the first
-- asynchronous provider event exists. Keep `sent` valid during that window;
-- delivery and failure states still require a real provider-event watermark.

alter table public.pos_invoice_deliveries
  drop constraint if exists pos_invoice_deliveries_lifecycle_check;

alter table public.pos_invoice_deliveries
  add constraint pos_invoice_deliveries_lifecycle_check
  check (
    updated_at >= created_at
    and prepared_at >= created_at
    and ((last_provider_event_at is null) = (last_provider_event_type = ''))
    and ((locked_at is null) = (locked_by is null))
    and ((status = 'processing') = (locked_at is not null))
    and (
      status not in ('test_completed','delivered','failed','bounced','complained','suppressed')
      or (completed_at is not null and next_attempt_at is null and locked_at is null)
    )
    and (
      status not in ('test_completed','sent','delivered','delivery_delayed','bounced','complained','suppressed')
      or provider_reference <> ''
    )
    and (
      status not in ('delivered','delivery_delayed','bounced','complained','suppressed')
      or last_provider_event_at is not null
    )
  ) not valid;

alter table public.pos_invoice_deliveries
  validate constraint pos_invoice_deliveries_lifecycle_check;
