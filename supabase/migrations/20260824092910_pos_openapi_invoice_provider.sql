-- Openapi Invoice Germany provider. The public wrapper is service-role only;
-- browser clients can prepare a delivery but cannot select a live provider.

create unique index pos_invoice_deliveries_one_openapi_per_invoice_uidx
  on public.pos_invoice_deliveries(user_id, invoice_id)
  where provider = 'openapi' and adjustment_id is null;

create unique index pos_invoice_deliveries_openapi_reference_uidx
  on public.pos_invoice_deliveries(provider_reference)
  where provider = 'openapi' and provider_reference <> '';

create or replace function private._pos_queue_openapi_invoice_delivery(
  p_delivery_id uuid,
  p_user_id uuid,
  p_confirmed boolean default false,
  p_sandbox boolean default true
)
returns public.pos_invoice_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_invoice public.pos_invoices%rowtype;
  v_einvoice_status text;
  v_event text;
begin
  if p_delivery_id is null or p_user_id is null then raise exception 'Manjkajo podatki Openapi dostave.'; end if;
  if not coalesce(p_confirmed, false) then raise exception 'Pred Openapi dostavo je potrebna izrecna potrditev.'; end if;

  select * into v_delivery from public.pos_invoice_deliveries
  where id = p_delivery_id and user_id = p_user_id for update;
  if not found then raise exception 'Dostava ne obstaja ali ni uporabnikova.'; end if;

  select * into v_invoice from public.pos_invoices
  where id = v_delivery.invoice_id and user_id = p_user_id for share;
  if not found then raise exception 'Izvorni račun ne obstaja.'; end if;
  if v_delivery.adjustment_id is not null then raise exception 'Openapi popravki še niso vključeni.'; end if;
  if v_invoice.customer_type not in ('business', 'public') then raise exception 'Openapi je namenjen strukturiranim B2B in B2G računom.'; end if;
  if v_invoice.is_test <> coalesce(p_sandbox, true) then raise exception 'Openapi način se ne ujema s testnim oziroma pravim računom.'; end if;

  if v_delivery.provider = 'openapi' and v_delivery.status in ('queued','processing','test_completed','sent','delivered') then
    return v_delivery;
  end if;
  if v_delivery.status not in ('test_prepared','test_completed','failed') then raise exception 'Dostave v trenutnem stanju ni mogoče oddati Openapi.'; end if;
  if v_delivery.status = 'failed' and v_delivery.provider = 'openapi' and v_delivery.attempt_count >= v_delivery.max_attempts then
    raise exception 'Največje število Openapi poskusov je doseženo.';
  end if;

  if exists(select 1 from public.pos_invoice_adjustments where user_id = p_user_id
    and original_invoice_id = v_invoice.id and adjustment_type in ('cancellation','credit_note')) then
    raise exception 'Izvirnega računa po finančnem popravku ni dovoljeno dostaviti.';
  end if;

  if v_invoice.customer_type = 'public' then
    if v_delivery.channel not in ('ozg_re','peppol') or v_delivery.document_format <> 'xrechnung' then
      raise exception 'B2G Openapi dostava zahteva XRechnung in javni kanal.';
    end if;
  else
    if v_delivery.channel not in ('email','peppol') or v_delivery.document_format <> 'xrechnung_pdf' then
      raise exception 'B2B Openapi dostava zahteva strukturirani račun in PDF.';
    end if;
    if not exists(select 1 from public.pos_invoice_documents where user_id = p_user_id
      and invoice_id = v_invoice.id and document_kind = 'invoice_pdf') then
      raise exception 'Arhivirani PDF original manjka.';
    end if;
  end if;

  select validation_status into v_einvoice_status from public.pos_einvoice_documents
  where user_id = p_user_id and invoice_id = v_invoice.id and document_kind = 'xrechnung_ubl';
  if coalesce(v_einvoice_status, '') <> 'validated' then
    raise exception 'XRechnung mora pred Openapi dostavo prestati KoSIT validacijo.';
  end if;

  v_event := case when v_delivery.status = 'failed' and v_delivery.provider = 'openapi' then 'retry_scheduled' else 'queued' end;
  update public.pos_invoice_deliveries set
    status = 'queued', provider = 'openapi', is_test = coalesce(p_sandbox, true),
    validation_status = v_einvoice_status,
    attempt_count = case when v_delivery.provider = 'openapi' then v_delivery.attempt_count else 0 end,
    next_attempt_at = now(), locked_at = null, locked_by = null, completed_at = null,
    sent_at = null, delivered_at = null, provider_reference = '', last_error = '',
    last_provider_event_at = null, last_provider_event_type = '', updated_at = now()
  where id = v_delivery.id returning * into v_delivery;

  insert into public.pos_invoice_delivery_events(user_id, delivery_id, event_type, details)
  values(p_user_id, v_delivery.id, v_event, jsonb_build_object(
    'provider','openapi','mode',case when p_sandbox then 'sandbox' else 'production' end,
    'document_format',v_delivery.document_format,'validation_status',v_delivery.validation_status,
    'attempt_count',v_delivery.attempt_count,'max_attempts',v_delivery.max_attempts));
  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values(p_user_id, 'invoice', v_invoice.id, 'delivery_openapi_queued', jsonb_build_object(
    'delivery_id',v_delivery.id,'provider','openapi','sandbox',coalesce(p_sandbox,true),'confirmed',true));
  return v_delivery;
end;
$$;

create or replace function public.pos_queue_openapi_invoice_delivery(
  p_delivery_id uuid,
  p_user_id uuid,
  p_confirmed boolean default false,
  p_sandbox boolean default true
)
returns public.pos_invoice_deliveries
language sql
security definer
set search_path = ''
as $$
  select private._pos_queue_openapi_invoice_delivery(p_delivery_id,p_user_id,p_confirmed,p_sandbox);
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
declare v_delivery public.pos_invoice_deliveries%rowtype;
begin
  if p_delivery_id is null or p_user_id is null or p_worker_id is null then raise exception 'Manjkajo podatki dostavnega delavca.'; end if;
  select * into v_delivery from public.pos_invoice_deliveries
  where id = p_delivery_id and user_id = p_user_id
    and (
      (is_test = true and provider = 'sandbox')
      or (is_test = false and provider = 'resend' and channel = 'email')
      or (provider = 'openapi' and channel in ('email','ozg_re','peppol'))
    )
    and attempt_count < max_attempts
    and ((status = 'queued' and coalesce(next_attempt_at, now()) <= now())
      or (status = 'processing' and locked_at < now() - interval '2 minutes'))
  for update skip locked;
  if not found then return null; end if;

  update public.pos_invoice_deliveries set status='processing',attempt_count=attempt_count+1,
    locked_at=now(),locked_by=p_worker_id,last_error='',updated_at=now()
  where id=v_delivery.id returning * into v_delivery;
  insert into public.pos_invoice_delivery_events(user_id,delivery_id,event_type,details)
  values(p_user_id,v_delivery.id,'processing',jsonb_build_object(
    'provider',v_delivery.provider,'mode',case when v_delivery.is_test then 'sandbox' else 'production' end,
    'attempt',v_delivery.attempt_count,'worker_id',p_worker_id));
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
  select * into v_delivery from public.pos_invoice_deliveries
  where id=p_delivery_id and user_id=p_user_id and status='processing' and locked_by=p_worker_id
    and ((is_test=true and provider='sandbox') or (is_test=false and provider='resend' and channel='email') or provider='openapi')
  for update;
  if not found then raise exception 'Dostavno opravilo ni zaklenjeno za tega delavca.'; end if;

  if coalesce(p_success,false) then
    v_event := case when v_delivery.is_test then 'test_completed' else 'sent' end;
    if trim(coalesce(p_provider_reference,'')) = '' then raise exception 'Ponudnik ni vrnil reference dostave.'; end if;
    update public.pos_invoice_deliveries set status=v_event,
      provider_reference=left(p_provider_reference,240),next_attempt_at=null,locked_at=null,locked_by=null,
      completed_at=now(),sent_at=case when v_delivery.is_test then null else now() end,delivered_at=null,
      last_provider_event_at=case when v_delivery.is_test then null else now() end,
      last_provider_event_type=case when v_delivery.is_test then '' else 'submitted' end,
      last_error='',updated_at=now()
    where id=v_delivery.id returning * into v_delivery;
  elsif coalesce(p_retryable,false) and v_delivery.attempt_count<v_delivery.max_attempts then
    v_event:='retry_scheduled';
    v_delay_seconds:=least(300,power(2,v_delivery.attempt_count)::integer*5);
    update public.pos_invoice_deliveries set status='queued',next_attempt_at=now()+make_interval(secs=>v_delay_seconds),
      locked_at=null,locked_by=null,last_error=left(coalesce(p_error,'Zacasna napaka dostave.'),1000),updated_at=now()
    where id=v_delivery.id returning * into v_delivery;
  else
    v_event:='failed';
    update public.pos_invoice_deliveries set status='failed',next_attempt_at=null,locked_at=null,locked_by=null,
      completed_at=now(),last_error=left(coalesce(p_error,'Dostava ni uspela.'),1000),updated_at=now()
    where id=v_delivery.id returning * into v_delivery;
  end if;

  insert into public.pos_invoice_delivery_events(user_id,delivery_id,event_type,details)
  values(p_user_id,v_delivery.id,v_event,jsonb_build_object(
    'provider',v_delivery.provider,'mode',case when v_delivery.is_test then 'sandbox' else 'production' end,
    'attempt',v_delivery.attempt_count,'max_attempts',v_delivery.max_attempts,
    'retryable',coalesce(p_retryable,false),'next_attempt_at',v_delivery.next_attempt_at,
    'provider_reference',v_delivery.provider_reference));
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values(p_user_id,'invoice',v_delivery.invoice_id,
    case when v_delivery.is_test then 'delivery_sandbox_' else 'delivery_live_' end||v_event,
    jsonb_build_object('delivery_id',v_delivery.id,'attempt',v_delivery.attempt_count,'provider',v_delivery.provider));
  return v_delivery;
end;
$$;

revoke all on function private._pos_queue_openapi_invoice_delivery(uuid,uuid,boolean,boolean) from public,anon,authenticated;
revoke all on function public.pos_queue_openapi_invoice_delivery(uuid,uuid,boolean,boolean) from public,anon,authenticated;
revoke all on function private._pos_claim_invoice_delivery(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private._pos_finish_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean) from public,anon,authenticated;
grant execute on function private._pos_queue_openapi_invoice_delivery(uuid,uuid,boolean,boolean) to service_role;
grant execute on function public.pos_queue_openapi_invoice_delivery(uuid,uuid,boolean,boolean) to service_role;
grant execute on function private._pos_claim_invoice_delivery(uuid,uuid,uuid) to service_role;
grant execute on function private._pos_finish_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean) to service_role;

notify pgrst, 'reload schema';

;
