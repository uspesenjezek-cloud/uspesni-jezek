-- Podpisani Resend webhooki: minimalen sprejemni zapis, idempotentna obdelava
-- in casovno pravilna dostavna sled tudi pri podvojenih/neurejenih dogodkih.

alter table public.pos_invoice_deliveries
  add column last_provider_event_at timestamptz,
  add column last_provider_event_type text not null default '';

alter table public.pos_invoice_deliveries
  drop constraint if exists pos_invoice_deliveries_status_check;
alter table public.pos_invoice_deliveries
  add constraint pos_invoice_deliveries_status_check
  check (status in (
    'test_prepared','queued','processing','test_completed','sent','delivered','failed',
    'delivery_delayed','bounced','complained','suppressed'
  ));

alter table public.pos_invoice_delivery_events
  add column provider_event_id text,
  add column provider_event_at timestamptz;

alter table public.pos_invoice_delivery_events
  drop constraint if exists pos_invoice_delivery_events_event_type_check;
alter table public.pos_invoice_delivery_events
  add constraint pos_invoice_delivery_events_event_type_check
  check (event_type in (
    'prepared','queued','processing','test_completed','retry_scheduled','sent','delivered','failed',
    'delivery_delayed','bounced','complained','suppressed','opened','clicked'
  ));

create unique index pos_invoice_delivery_events_provider_event_uidx
  on public.pos_invoice_delivery_events(provider_event_id)
  where provider_event_id is not null;
create unique index pos_invoice_deliveries_resend_reference_uidx
  on public.pos_invoice_deliveries(provider_reference)
  where provider = 'resend' and is_test = false and provider_reference <> '';

create table private.pos_resend_webhook_receipts (
  svix_id text primary key check (length(svix_id) between 1 and 240),
  event_type text not null check (event_type in (
    'email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained',
    'email.failed','email.suppressed','email.opened','email.clicked'
  )),
  email_id text not null check (length(email_id) between 1 and 240),
  provider_created_at timestamptz not null,
  failure_code text not null default '' check (length(failure_code) <= 120),
  matched_delivery_id uuid references public.pos_invoice_deliveries(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

revoke all on table private.pos_resend_webhook_receipts from public, anon, authenticated;
grant select, insert, update on table private.pos_resend_webhook_receipts to service_role;

create or replace function private._pos_apply_resend_webhook_event(
  p_svix_id text,
  p_event_type text,
  p_email_id text,
  p_event_created_at timestamptz,
  p_failure_code text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt private.pos_resend_webhook_receipts%rowtype;
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_duplicate boolean := false;
  v_event text;
  v_new_status text;
  v_new_rank integer := 0;
  v_old_rank integer := 0;
  v_should_update boolean := false;
  v_failure_code text := left(regexp_replace(coalesce(p_failure_code, ''), '[^a-zA-Z0-9_.:-]', '_', 'g'), 120);
begin
  if p_svix_id is null or length(p_svix_id) not between 1 and 240 then raise exception 'Neveljaven Svix ID.'; end if;
  if p_email_id is null or length(p_email_id) not between 1 and 240 then raise exception 'Neveljaven Resend email ID.'; end if;
  if p_event_created_at is null then raise exception 'Manjka cas Resend dogodka.'; end if;
  if p_event_type not in (
    'email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained',
    'email.failed','email.suppressed','email.opened','email.clicked'
  ) then raise exception 'Nepodprt Resend dogodek.'; end if;

  insert into private.pos_resend_webhook_receipts(
    svix_id, event_type, email_id, provider_created_at, failure_code
  ) values (
    p_svix_id, p_event_type, p_email_id, p_event_created_at, v_failure_code
  ) on conflict (svix_id) do nothing;

  select * into v_receipt
  from private.pos_resend_webhook_receipts
  where svix_id = p_svix_id
  for update;

  if v_receipt.event_type <> p_event_type
    or v_receipt.email_id <> p_email_id
    or v_receipt.provider_created_at <> p_event_created_at then
    raise exception 'Svix ID je bil ponovno uporabljen z drugimi podatki.';
  end if;
  v_duplicate := v_receipt.processed_at is not null;

  select * into v_delivery
  from public.pos_invoice_deliveries
  where provider = 'resend'
    and is_test = false
    and provider_reference = p_email_id
  for update;

  if not found then
    return jsonb_build_object('matched', false, 'duplicate', v_duplicate);
  end if;

  update private.pos_resend_webhook_receipts
  set matched_delivery_id = v_delivery.id
  where svix_id = p_svix_id;

  if v_duplicate then
    return jsonb_build_object('matched', true, 'duplicate', true, 'status', v_delivery.status);
  end if;

  v_event := case p_event_type
    when 'email.sent' then 'sent'
    when 'email.delivered' then 'delivered'
    when 'email.delivery_delayed' then 'delivery_delayed'
    when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained'
    when 'email.failed' then 'failed'
    when 'email.suppressed' then 'suppressed'
    when 'email.opened' then 'opened'
    when 'email.clicked' then 'clicked'
  end;
  v_new_status := case when v_event in ('opened','clicked') then null else v_event end;
  v_new_rank := case v_new_status
    when 'sent' then 10
    when 'delivery_delayed' then 20
    when 'delivered' then 30
    when 'bounced' then 40
    when 'failed' then 40
    when 'suppressed' then 40
    when 'complained' then 50
    else 0
  end;
  v_old_rank := case v_delivery.status
    when 'sent' then 10
    when 'delivery_delayed' then 20
    when 'delivered' then 30
    when 'bounced' then 40
    when 'failed' then 40
    when 'suppressed' then 40
    when 'complained' then 50
    else 0
  end;
  v_should_update := v_new_status is not null
    and v_new_rank >= v_old_rank
    and (
      v_delivery.last_provider_event_at is null
      or p_event_created_at > v_delivery.last_provider_event_at
      or (p_event_created_at = v_delivery.last_provider_event_at and v_new_rank > v_old_rank)
    );

  if v_should_update then
    update public.pos_invoice_deliveries
    set status = v_new_status,
        sent_at = case
          when v_new_status in ('sent','delivery_delayed','delivered','complained') then coalesce(sent_at, p_event_created_at)
          else sent_at
        end,
        delivered_at = case when v_new_status = 'delivered' then coalesce(delivered_at, p_event_created_at) else delivered_at end,
        completed_at = case
          when v_new_status in ('delivered','bounced','complained','failed','suppressed') then p_event_created_at
          else completed_at
        end,
        last_error = case v_new_status
          when 'delivery_delayed' then 'E-postni ponudnik je sporocil zakasnitev dostave.'
          when 'bounced' then 'Prejemnikov streznik je e-posto zavrnil.'
          when 'complained' then 'Prejemnik je sporocilo oznacil kot nezeleno.'
          when 'failed' then 'E-postni ponudnik dostave ni mogel izvesti.'
          when 'suppressed' then 'Ponudnik je dostavo varnostno zadrzal.'
          else ''
        end,
        last_provider_event_at = p_event_created_at,
        last_provider_event_type = p_event_type,
        updated_at = now()
    where id = v_delivery.id
    returning * into v_delivery;
  end if;

  insert into public.pos_invoice_delivery_events(
    user_id, delivery_id, event_type, details, provider_event_id, provider_event_at
  ) values (
    v_delivery.user_id,
    v_delivery.id,
    v_event,
    jsonb_strip_nulls(jsonb_build_object(
      'provider', 'resend',
      'failure_code', nullif(v_failure_code, ''),
      'applied_to_status', v_should_update
    )),
    p_svix_id,
    p_event_created_at
  );

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (
    v_delivery.user_id,
    'invoice',
    v_delivery.invoice_id,
    'delivery_live_webhook',
    jsonb_build_object(
      'delivery_id', v_delivery.id,
      'event_type', v_event,
      'applied_to_status', v_should_update
    )
  );

  update private.pos_resend_webhook_receipts
  set processed_at = now()
  where svix_id = p_svix_id;

  return jsonb_build_object(
    'matched', true,
    'duplicate', false,
    'applied', v_should_update,
    'status', v_delivery.status
  );
end;
$$;

create or replace function public.pos_apply_resend_webhook_event(
  p_svix_id text,
  p_event_type text,
  p_email_id text,
  p_event_created_at timestamptz,
  p_failure_code text default ''
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private._pos_apply_resend_webhook_event(
    p_svix_id, p_event_type, p_email_id, p_event_created_at, p_failure_code
  );
$$;

revoke all on function private._pos_apply_resend_webhook_event(text,text,text,timestamptz,text)
  from public, anon, authenticated;
revoke all on function public.pos_apply_resend_webhook_event(text,text,text,timestamptz,text)
  from public, anon, authenticated;
grant execute on function private._pos_apply_resend_webhook_event(text,text,text,timestamptz,text)
  to service_role;
grant execute on function public.pos_apply_resend_webhook_event(text,text,text,timestamptz,text)
  to service_role;

notify pgrst, 'reload schema';
