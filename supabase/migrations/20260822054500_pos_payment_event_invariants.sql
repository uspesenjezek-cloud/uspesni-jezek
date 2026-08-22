-- Signed Stripe TEST events form part of the payment audit trail. Preserve
-- their sandbox identity, accepted event vocabulary and plausible ordering at
-- the database boundary as well as in the webhook handler.

alter table public.pos_payment_events
  add constraint pos_payment_events_source_shape_check
  check (
    external_event_id ~ '^evt_[A-Za-z0-9_]+$'
    and event_type in (
      'checkout.session.completed',
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'charge.refunded'
    )
    and summary->'test_mode' = 'true'::jsonb
    and event_created_at <= processed_at + interval '5 minutes'
  ) not valid;

create or replace function private.pos_validate_payment_event_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.pos_payments%rowtype;
begin
  select * into v_payment
  from public.pos_payments
  where id = new.payment_id and user_id = new.user_id;

  if not found
     or v_payment.provider is distinct from 'stripe'
     or v_payment.method is distinct from 'stripe_card' then
    raise exception 'Stripe dogodek ni povezan s Stripe TEST plačilom.';
  end if;

  if new.event_created_at < v_payment.created_at - interval '5 minutes' then
    raise exception 'Stripe dogodek časovno predhodi povezani plačilni seji.';
  end if;

  return new;
end;
$$;

revoke all on function private.pos_validate_payment_event_source() from public, anon, authenticated;
grant execute on function private.pos_validate_payment_event_source() to service_role;

create trigger pos_payment_events_validate_source
before insert on public.pos_payment_events
for each row execute function private.pos_validate_payment_event_source();

alter table public.pos_payment_events
  validate constraint pos_payment_events_source_shape_check;
