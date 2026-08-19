-- Ponudniško neodvisen dostavni mehanizem. Trenutno je dovoljen samo
-- nenevaren sandbox: noben dokument ne zapusti sistema, uspešen preizkus pa
-- namenoma nikoli ne dobi statusa sent/delivered.

alter table public.pos_invoice_deliveries
  add column attempt_count integer not null default 0 check (attempt_count >= 0),
  add column max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  add column next_attempt_at timestamptz,
  add column locked_at timestamptz,
  add column locked_by uuid,
  add column completed_at timestamptz;

alter table public.pos_invoice_deliveries
  drop constraint if exists pos_invoice_deliveries_status_check;
alter table public.pos_invoice_deliveries
  add constraint pos_invoice_deliveries_status_check
  check (status in ('test_prepared','queued','processing','test_completed','sent','delivered','failed'));

alter table public.pos_invoice_delivery_events
  drop constraint if exists pos_invoice_delivery_events_event_type_check;
alter table public.pos_invoice_delivery_events
  add constraint pos_invoice_delivery_events_event_type_check
  check (event_type in ('prepared','queued','processing','test_completed','retry_scheduled','sent','delivered','failed'));

drop index if exists public.pos_invoice_deliveries_status_idx;
create index pos_invoice_deliveries_dispatch_queue_idx
  on public.pos_invoice_deliveries(next_attempt_at, created_at)
  where status = 'queued';
create index pos_invoice_deliveries_stale_lock_idx
  on public.pos_invoice_deliveries(locked_at)
  where status = 'processing';

create or replace function public.pos_queue_invoice_delivery(
  p_delivery_id uuid,
  p_confirmed boolean default false
)
returns public.pos_invoice_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_event text;
  v_einvoice_status text;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if not coalesce(p_confirmed, false) then
    raise exception 'Pred preizkusom potrdite pripravljeno dostavo.';
  end if;

  select * into v_delivery
  from public.pos_invoice_deliveries
  where id = p_delivery_id and user_id = v_user
  for update;
  if not found then raise exception 'Dostava ne obstaja ali ni vaša.'; end if;
  if not v_delivery.is_test then raise exception 'Ta funkcija dovoljuje samo sandbox dostavo.'; end if;
  -- Ponovljen odjemalčev klic po izgubljenem odgovoru ne sme podvojiti opravila.
  if v_delivery.status = 'queued' and v_delivery.provider = 'sandbox' then
    return v_delivery;
  end if;
  if v_delivery.status not in ('test_prepared','failed') then
    raise exception 'Dostave v trenutnem stanju ni mogoče dodati v čakalno vrsto.';
  end if;
  if v_delivery.status = 'failed' and v_delivery.attempt_count >= v_delivery.max_attempts then
    raise exception 'Največje število poskusov je doseženo.';
  end if;
  if exists (
    select 1 from public.pos_invoice_adjustments
    where user_id = v_user
      and original_invoice_id = v_delivery.invoice_id
      and adjustment_type = 'cancellation'
  ) then
    raise exception 'Storniranega računa ni dovoljeno pripraviti za dostavo.';
  end if;

  if v_delivery.document_format in ('pdf','xrechnung_pdf') and not exists (
    select 1 from public.pos_invoice_documents
    where user_id = v_user and invoice_id = v_delivery.invoice_id
  ) then
    raise exception 'Pred dostavo mora biti arhiviran nespremenljivi PDF original.';
  end if;

  if v_delivery.document_format in ('xrechnung','xrechnung_pdf') then
    select validation_status into v_einvoice_status
    from public.pos_einvoice_documents
    where user_id = v_user and invoice_id = v_delivery.invoice_id;
    if coalesce(v_einvoice_status, '') <> 'validated' then
      raise exception 'Strukturirani e-račun mora pred dostavo prestati KoSIT validacijo.';
    end if;
  else
    v_einvoice_status := 'not_required';
  end if;

  v_event := case when v_delivery.status = 'failed' then 'retry_scheduled' else 'queued' end;
  update public.pos_invoice_deliveries
  set status = 'queued',
      provider = 'sandbox',
      validation_status = v_einvoice_status,
      next_attempt_at = now(),
      locked_at = null,
      locked_by = null,
      completed_at = null,
      last_error = '',
      updated_at = now()
  where id = v_delivery.id
  returning * into v_delivery;

  insert into public.pos_invoice_delivery_events(user_id, delivery_id, event_type, details)
  values (
    v_user,
    v_delivery.id,
    v_event,
    jsonb_build_object(
      'provider', 'sandbox',
      'attempt_count', v_delivery.attempt_count,
      'max_attempts', v_delivery.max_attempts,
      'document_format', v_delivery.document_format,
      'validation_status', v_delivery.validation_status
    )
  );

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (
    v_user,
    'invoice',
    v_delivery.invoice_id,
    'delivery_sandbox_queued',
    jsonb_build_object('delivery_id', v_delivery.id, 'event', v_event)
  );
  return v_delivery;
end;
$$;

create or replace function private._pos_claim_invoice_delivery(
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
    raise exception 'Manjkajo podatki dostavnega delavca.';
  end if;

  select * into v_delivery
  from public.pos_invoice_deliveries
  where id = p_delivery_id
    and user_id = p_user_id
    and is_test = true
    and provider = 'sandbox'
    and attempt_count < max_attempts
    and (
      (status = 'queued' and coalesce(next_attempt_at, now()) <= now())
      or (status = 'processing' and locked_at < now() - interval '2 minutes')
    )
  for update skip locked;
  if not found then return null; end if;

  update public.pos_invoice_deliveries
  set status = 'processing',
      attempt_count = attempt_count + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      last_error = '',
      updated_at = now()
  where id = v_delivery.id
  returning * into v_delivery;

  insert into public.pos_invoice_delivery_events(user_id, delivery_id, event_type, details)
  values (
    p_user_id,
    v_delivery.id,
    'processing',
    jsonb_build_object('provider', 'sandbox', 'attempt', v_delivery.attempt_count, 'worker_id', p_worker_id)
  );
  return v_delivery;
end;
$$;

create or replace function private._pos_finish_invoice_delivery(
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
  where id = p_delivery_id
    and user_id = p_user_id
    and is_test = true
    and provider = 'sandbox'
    and status = 'processing'
    and locked_by = p_worker_id
  for update;
  if not found then raise exception 'Dostavno opravilo ni zaklenjeno za tega delavca.'; end if;

  if coalesce(p_success, false) then
    v_event := 'test_completed';
    update public.pos_invoice_deliveries
    set status = 'test_completed',
        provider_reference = left(coalesce(p_provider_reference, ''), 240),
        next_attempt_at = null,
        locked_at = null,
        locked_by = null,
        completed_at = now(),
        sent_at = null,
        delivered_at = null,
        last_error = '',
        updated_at = now()
    where id = v_delivery.id
    returning * into v_delivery;
  elsif coalesce(p_retryable, false) and v_delivery.attempt_count < v_delivery.max_attempts then
    v_event := 'retry_scheduled';
    v_delay_seconds := least(300, (power(2, v_delivery.attempt_count)::integer * 5));
    update public.pos_invoice_deliveries
    set status = 'queued',
        next_attempt_at = now() + make_interval(secs => v_delay_seconds),
        locked_at = null,
        locked_by = null,
        last_error = left(coalesce(p_error, 'Začasna napaka sandboxa.'), 1000),
        updated_at = now()
    where id = v_delivery.id
    returning * into v_delivery;
  else
    v_event := 'failed';
    update public.pos_invoice_deliveries
    set status = 'failed',
        next_attempt_at = null,
        locked_at = null,
        locked_by = null,
        completed_at = now(),
        last_error = left(coalesce(p_error, 'Sandbox preizkus ni uspel.'), 1000),
        updated_at = now()
    where id = v_delivery.id
    returning * into v_delivery;
  end if;

  insert into public.pos_invoice_delivery_events(user_id, delivery_id, event_type, details)
  values (
    p_user_id,
    v_delivery.id,
    v_event,
    jsonb_build_object(
      'provider', 'sandbox',
      'attempt', v_delivery.attempt_count,
      'max_attempts', v_delivery.max_attempts,
      'retryable', coalesce(p_retryable, false),
      'next_attempt_at', v_delivery.next_attempt_at,
      'provider_reference', v_delivery.provider_reference
    )
  );

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (
    p_user_id,
    'invoice',
    v_delivery.invoice_id,
    'delivery_sandbox_' || v_event,
    jsonb_build_object('delivery_id', v_delivery.id, 'attempt', v_delivery.attempt_count)
  );
  return v_delivery;
end;
$$;

create or replace function public.pos_claim_invoice_delivery(
  p_delivery_id uuid,
  p_user_id uuid,
  p_worker_id uuid
)
returns public.pos_invoice_deliveries
language sql
security invoker
set search_path = ''
as $$
  select private._pos_claim_invoice_delivery(p_delivery_id, p_user_id, p_worker_id);
$$;

create or replace function public.pos_finish_invoice_delivery(
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
  select private._pos_finish_invoice_delivery(
    p_delivery_id, p_user_id, p_worker_id, p_success,
    p_provider_reference, p_error, p_retryable
  );
$$;

revoke all on function public.pos_queue_invoice_delivery(uuid,boolean) from public, anon;
grant execute on function public.pos_queue_invoice_delivery(uuid,boolean) to authenticated, service_role;

revoke all on function private._pos_claim_invoice_delivery(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function private._pos_finish_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean) from public, anon, authenticated;
revoke all on function public.pos_claim_invoice_delivery(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.pos_finish_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean) from public, anon, authenticated;
grant execute on function private._pos_claim_invoice_delivery(uuid,uuid,uuid) to service_role;
grant execute on function private._pos_finish_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean) to service_role;
grant execute on function public.pos_claim_invoice_delivery(uuid,uuid,uuid) to service_role;
grant execute on function public.pos_finish_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean) to service_role;

notify pgrst, 'reload schema';
