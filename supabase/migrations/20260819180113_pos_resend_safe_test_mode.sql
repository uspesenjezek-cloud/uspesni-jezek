-- Resend testni nacin je streznisko omejen na en dovoljeni naslov. Dostava
-- ostane is_test=true in je zato nikoli ne smemo zamenjati za poslano stranki.

create unique index pos_invoice_deliveries_resend_test_reference_uidx
  on public.pos_invoice_deliveries(provider_reference)
  where provider = 'resend' and is_test = true and provider_reference <> '';

create or replace function private._pos_queue_resend_test_invoice_delivery(
  p_delivery_id uuid,
  p_user_id uuid,
  p_confirmed boolean default false
)
returns public.pos_invoice_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_einvoice_status text;
begin
  if p_delivery_id is null or p_user_id is null then raise exception 'Manjkajo podatki dostave.'; end if;
  if not coalesce(p_confirmed, false) then raise exception 'Pred testnim posiljanjem je potrebna izrecna potrditev.'; end if;

  select * into v_delivery
  from public.pos_invoice_deliveries
  where id = p_delivery_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Dostava ne obstaja ali ni uporabnikova.'; end if;
  if v_delivery.is_test and v_delivery.provider = 'resend'
    and v_delivery.status in ('queued','processing','test_completed','sent','delivered') then
    return v_delivery;
  end if;
  if v_delivery.status not in ('test_prepared','test_completed','failed') then
    raise exception 'Dostave v trenutnem stanju ni mogoce testno poslati.';
  end if;
  if v_delivery.status = 'failed' and v_delivery.attempt_count >= v_delivery.max_attempts then
    raise exception 'Najvecje stevilo testnih poskusov je dosezeno.';
  end if;
  if v_delivery.channel <> 'email' then raise exception 'Resend test je dovoljen samo za e-postni kanal.'; end if;
  if trim(v_delivery.recipient) = '' or v_delivery.recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Nameravani e-postni naslov prejemnika ni veljaven.';
  end if;
  if exists (
    select 1 from public.pos_invoice_adjustments
    where user_id = p_user_id and original_invoice_id = v_delivery.invoice_id and adjustment_type = 'cancellation'
  ) then raise exception 'Storniranega racuna ni dovoljeno testno poslati.'; end if;

  if v_delivery.document_format in ('pdf','xrechnung_pdf') and not exists (
    select 1 from public.pos_invoice_documents
    where user_id = p_user_id and invoice_id = v_delivery.invoice_id and document_kind = 'invoice_pdf'
  ) then raise exception 'Pred testnim posiljanjem mora biti arhiviran nespremenljivi PDF original.'; end if;

  if v_delivery.document_format in ('xrechnung','xrechnung_pdf') then
    select validation_status into v_einvoice_status
    from public.pos_einvoice_documents
    where user_id = p_user_id and invoice_id = v_delivery.invoice_id and document_kind = 'xrechnung_ubl';
    if coalesce(v_einvoice_status, '') <> 'validated' then
      raise exception 'XRechnung mora pred testnim posiljanjem prestati KoSIT validacijo.';
    end if;
  else
    v_einvoice_status := 'not_required';
  end if;

  update public.pos_invoice_deliveries
  set status = 'queued',
      provider = 'resend',
      is_test = true,
      validation_status = v_einvoice_status,
      attempt_count = case when v_delivery.provider <> 'resend' then 0 else v_delivery.attempt_count end,
      next_attempt_at = now(),
      locked_at = null,
      locked_by = null,
      completed_at = null,
      sent_at = null,
      delivered_at = null,
      provider_reference = '',
      last_error = '',
      last_provider_event_at = null,
      last_provider_event_type = '',
      updated_at = now()
  where id = v_delivery.id
  returning * into v_delivery;

  insert into public.pos_invoice_delivery_events(user_id, delivery_id, event_type, details)
  values (p_user_id, v_delivery.id, 'queued', jsonb_build_object(
    'provider', 'resend', 'mode', 'test', 'document_format', v_delivery.document_format,
    'validation_status', v_delivery.validation_status, 'recipient_locked', true
  ));

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (p_user_id, 'invoice', v_delivery.invoice_id, 'delivery_resend_test_queued', jsonb_build_object(
    'delivery_id', v_delivery.id, 'provider', 'resend', 'confirmed', true, 'recipient_locked', true
  ));
  return v_delivery;
end;
$$;

create or replace function public.pos_queue_resend_test_invoice_delivery(
  p_delivery_id uuid,
  p_user_id uuid,
  p_confirmed boolean default false
)
returns public.pos_invoice_deliveries
language sql
security invoker
set search_path = ''
as $$
  select private._pos_queue_resend_test_invoice_delivery(p_delivery_id, p_user_id, p_confirmed);
$$;

create or replace function private._pos_claim_resend_test_invoice_delivery(
  p_delivery_id uuid,
  p_user_id uuid,
  p_worker_id uuid
)
returns public.pos_invoice_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
begin
  if p_delivery_id is null or p_user_id is null or p_worker_id is null then
    raise exception 'Manjkajo podatki testnega dostavnega delavca.';
  end if;
  select * into v_delivery
  from public.pos_invoice_deliveries
  where id = p_delivery_id
    and user_id = p_user_id
    and is_test = true
    and provider = 'resend'
    and channel = 'email'
    and attempt_count < max_attempts
    and (
      (status = 'queued' and coalesce(next_attempt_at, now()) <= now())
      or (status = 'processing' and locked_at < now() - interval '2 minutes')
    )
  for update skip locked;
  if not found then return null; end if;

  update public.pos_invoice_deliveries
  set status = 'processing', attempt_count = attempt_count + 1, locked_at = now(), locked_by = p_worker_id,
      last_error = '', updated_at = now()
  where id = v_delivery.id
  returning * into v_delivery;

  insert into public.pos_invoice_delivery_events(user_id, delivery_id, event_type, details)
  values (p_user_id, v_delivery.id, 'processing', jsonb_build_object(
    'provider', 'resend', 'mode', 'test', 'attempt', v_delivery.attempt_count, 'worker_id', p_worker_id,
    'recipient_locked', true
  ));
  return v_delivery;
end;
$$;

create or replace function public.pos_claim_resend_test_invoice_delivery(
  p_delivery_id uuid,
  p_user_id uuid,
  p_worker_id uuid
)
returns public.pos_invoice_deliveries
language sql
security invoker
set search_path = ''
as $$
  select private._pos_claim_resend_test_invoice_delivery(p_delivery_id, p_user_id, p_worker_id);
$$;

create or replace function private._pos_finish_resend_test_invoice_delivery(
  p_delivery_id uuid,
  p_user_id uuid,
  p_worker_id uuid,
  p_success boolean,
  p_provider_reference text default '',
  p_error text default '',
  p_retryable boolean default false
)
returns public.pos_invoice_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_event text;
  v_delay_seconds integer;
begin
  select * into v_delivery
  from public.pos_invoice_deliveries
  where id = p_delivery_id and user_id = p_user_id and status = 'processing' and locked_by = p_worker_id
    and is_test = true and provider = 'resend' and channel = 'email'
  for update;
  if not found then raise exception 'Testno dostavno opravilo ni zaklenjeno za tega delavca.'; end if;

  if coalesce(p_success, false) then
    v_event := 'test_completed';
    update public.pos_invoice_deliveries
    set status = 'test_completed',
        provider_reference = left(coalesce(p_provider_reference, ''), 240),
        next_attempt_at = null, locked_at = null, locked_by = null, completed_at = now(),
        sent_at = null, delivered_at = null, last_error = '', updated_at = now()
    where id = v_delivery.id
    returning * into v_delivery;
  elsif coalesce(p_retryable, false) and v_delivery.attempt_count < v_delivery.max_attempts then
    v_event := 'retry_scheduled';
    v_delay_seconds := least(300, power(2, v_delivery.attempt_count)::integer * 5);
    update public.pos_invoice_deliveries
    set status = 'queued', next_attempt_at = now() + make_interval(secs => v_delay_seconds),
        locked_at = null, locked_by = null,
        last_error = left(coalesce(p_error, 'Zacasna napaka testne dostave.'), 1000), updated_at = now()
    where id = v_delivery.id
    returning * into v_delivery;
  else
    v_event := 'failed';
    update public.pos_invoice_deliveries
    set status = 'failed', next_attempt_at = null, locked_at = null, locked_by = null, completed_at = now(),
        last_error = left(coalesce(p_error, 'Testna dostava ni uspela.'), 1000), updated_at = now()
    where id = v_delivery.id
    returning * into v_delivery;
  end if;

  insert into public.pos_invoice_delivery_events(user_id, delivery_id, event_type, details)
  values (p_user_id, v_delivery.id, v_event, jsonb_build_object(
    'provider', 'resend', 'mode', 'test', 'attempt', v_delivery.attempt_count,
    'max_attempts', v_delivery.max_attempts, 'retryable', coalesce(p_retryable, false),
    'next_attempt_at', v_delivery.next_attempt_at, 'provider_reference', v_delivery.provider_reference,
    'recipient_locked', true
  ));

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (p_user_id, 'invoice', v_delivery.invoice_id, 'delivery_resend_test_' || v_event,
    jsonb_build_object('delivery_id', v_delivery.id, 'attempt', v_delivery.attempt_count, 'provider', 'resend')
  );
  return v_delivery;
end;
$$;

create or replace function public.pos_finish_resend_test_invoice_delivery(
  p_delivery_id uuid,
  p_user_id uuid,
  p_worker_id uuid,
  p_success boolean,
  p_provider_reference text default '',
  p_error text default '',
  p_retryable boolean default false
)
returns public.pos_invoice_deliveries
language sql
security invoker
set search_path = ''
as $$
  select private._pos_finish_resend_test_invoice_delivery(
    p_delivery_id, p_user_id, p_worker_id, p_success, p_provider_reference, p_error, p_retryable
  );
$$;

create or replace function private._pos_apply_resend_test_webhook_event(
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
  v_failure_code text := case
    when coalesce(p_failure_code, '') ~ '^[a-zA-Z0-9_.:-]{1,120}$' then p_failure_code
    else ''
  end;
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
  where provider = 'resend' and is_test = true and provider_reference = p_email_id
  for update;

  if not found then
    return jsonb_build_object('matched', false, 'duplicate', v_duplicate);
  end if;

  update private.pos_resend_webhook_receipts
  set matched_delivery_id = v_delivery.id
  where svix_id = p_svix_id;

  if v_duplicate then
    return jsonb_build_object('matched', true, 'duplicate', true, 'status', v_delivery.status, 'test', true);
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
    when 'sent' then 10 when 'delivery_delayed' then 20 when 'delivered' then 30
    when 'bounced' then 40 when 'failed' then 40 when 'suppressed' then 40
    when 'complained' then 50 else 0
  end;
  v_old_rank := case v_delivery.status
    when 'test_completed' then 10 when 'sent' then 10 when 'delivery_delayed' then 20
    when 'delivered' then 30 when 'bounced' then 40 when 'failed' then 40
    when 'suppressed' then 40 when 'complained' then 50 else 0
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
        sent_at = null,
        delivered_at = null,
        completed_at = case
          when v_new_status in ('delivered','bounced','complained','failed','suppressed') then p_event_created_at
          else completed_at
        end,
        last_error = case v_new_status
          when 'delivery_delayed' then 'Testni e-postni ponudnik je sporocil zakasnitev dostave.'
          when 'bounced' then 'Testni prejemnikov streznik je e-posto zavrnil.'
          when 'complained' then 'Testno sporocilo je bilo oznaceno kot nezeleno.'
          when 'failed' then 'E-postni ponudnik testne dostave ni mogel izvesti.'
          when 'suppressed' then 'Ponudnik je testno dostavo varnostno zadrzal.'
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
    v_delivery.user_id, v_delivery.id, v_event,
    jsonb_strip_nulls(jsonb_build_object(
      'provider', 'resend', 'mode', 'test', 'failure_code', nullif(v_failure_code, ''),
      'applied_to_status', v_should_update, 'recipient_locked', true
    )),
    p_svix_id, p_event_created_at
  );

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (
    v_delivery.user_id, 'invoice', v_delivery.invoice_id, 'delivery_resend_test_webhook',
    jsonb_build_object('delivery_id', v_delivery.id, 'event_type', v_event, 'applied_to_status', v_should_update)
  );

  update private.pos_resend_webhook_receipts
  set processed_at = now()
  where svix_id = p_svix_id;

  return jsonb_build_object(
    'matched', true, 'duplicate', false, 'applied', v_should_update,
    'status', v_delivery.status, 'test', true
  );
end;
$$;

create or replace function public.pos_apply_resend_test_webhook_event(
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
  select private._pos_apply_resend_test_webhook_event(
    p_svix_id, p_event_type, p_email_id, p_event_created_at, p_failure_code
  );
$$;

revoke all on function private._pos_queue_resend_test_invoice_delivery(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.pos_queue_resend_test_invoice_delivery(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function private._pos_queue_resend_test_invoice_delivery(uuid,uuid,boolean) to service_role;
grant execute on function public.pos_queue_resend_test_invoice_delivery(uuid,uuid,boolean) to service_role;

revoke all on function private._pos_claim_resend_test_invoice_delivery(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.pos_claim_resend_test_invoice_delivery(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function private._pos_claim_resend_test_invoice_delivery(uuid,uuid,uuid) to service_role;
grant execute on function public.pos_claim_resend_test_invoice_delivery(uuid,uuid,uuid) to service_role;

revoke all on function private._pos_finish_resend_test_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean) from public, anon, authenticated;
revoke all on function public.pos_finish_resend_test_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean) from public, anon, authenticated;
grant execute on function private._pos_finish_resend_test_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean) to service_role;
grant execute on function public.pos_finish_resend_test_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean) to service_role;

revoke all on function private._pos_apply_resend_test_webhook_event(text,text,text,timestamptz,text) from public, anon, authenticated;
revoke all on function public.pos_apply_resend_test_webhook_event(text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function private._pos_apply_resend_test_webhook_event(text,text,text,timestamptz,text) to service_role;
grant execute on function public.pos_apply_resend_test_webhook_event(text,text,text,timestamptz,text) to service_role;

notify pgrst, 'reload schema';
