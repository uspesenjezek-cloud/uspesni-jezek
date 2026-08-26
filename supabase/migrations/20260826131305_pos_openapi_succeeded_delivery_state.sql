-- Openapi keeps a successfully delivered German document in macro state SENT
-- while details.external_status is succeeded. Treat that exact combination as
-- delivered for live invoices and as terminal reconciliation evidence. Sandbox
-- deliveries remain isolated in test_completed and can never become live.

create or replace function private._pos_apply_openapi_invoice_event(
  p_provider_reference text,
  p_state text,
  p_external_status text,
  p_event_at timestamptz,
  p_sandbox boolean
)
returns public.pos_invoice_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_state text := upper(trim(coalesce(p_state,'')));
  v_external text := lower(trim(coalesce(p_external_status,'')));
  v_event_at timestamptz := coalesce(p_event_at, now());
  v_status text;
  v_event text;
begin
  if p_sandbox is null then raise exception 'Openapi način dogodka manjka.'; end if;
  if char_length(trim(coalesce(p_provider_reference,''))) not between 1 and 240 then
    raise exception 'Openapi referenca ni veljavna.';
  end if;
  if v_state not in ('NEW','SENT','DONE','ERROR') then raise exception 'Openapi stanje ni veljavno.'; end if;
  if char_length(v_external) > 120 or v_external ~ E'[\r\n]' then raise exception 'Openapi zunanji status ni veljaven.'; end if;

  select * into v_delivery from public.pos_invoice_deliveries
  where provider='openapi'
    and provider_reference=trim(p_provider_reference)
    and is_test=p_sandbox
  for update;
  if not found then return null; end if;

  if v_delivery.last_provider_event_at is not null
     and v_event_at < v_delivery.last_provider_event_at then
    return v_delivery;
  end if;

  if p_sandbox then
    v_status := case when v_state='ERROR' then 'failed' else 'test_completed' end;
    v_event := v_status;
  else
    v_status := case
      when v_state='DONE' or (v_state='SENT' and v_external='succeeded') then 'delivered'
      when v_state='ERROR' then 'failed'
      else 'sent'
    end;
    v_event := v_status;
  end if;

  if not p_sandbox and v_delivery.status='delivered' and v_status<>'delivered' then return v_delivery; end if;
  if v_delivery.status=v_status
     and lower(v_delivery.last_provider_event_type)=coalesce(nullif(v_external,''),lower(v_state))
     and v_delivery.last_provider_event_at is not null
     and v_delivery.last_provider_event_at>=v_event_at then return v_delivery; end if;

  update public.pos_invoice_deliveries set
    status=v_status,
    sent_at=case
      when p_sandbox then null
      when v_status in ('sent','delivered') then coalesce(sent_at,v_event_at)
      else sent_at
    end,
    delivered_at=case
      when p_sandbox then null
      when v_status='delivered' then coalesce(delivered_at,v_event_at)
      else delivered_at
    end,
    completed_at=case
      when v_status in ('test_completed','delivered','failed') then coalesce(completed_at,v_event_at)
      else completed_at
    end,
    next_attempt_at=null,locked_at=null,locked_by=null,
    last_error=case when v_status='failed' then left(coalesce(nullif(v_external,''),'Openapi delivery failed.'),1000) else '' end,
    last_provider_event_at=v_event_at,
    last_provider_event_type=coalesce(nullif(v_external,''),lower(v_state)),
    updated_at=now()
  where id=v_delivery.id returning * into v_delivery;

  insert into public.pos_invoice_delivery_events(
    user_id,delivery_id,event_type,provider_event_at,details
  ) values (
    v_delivery.user_id,v_delivery.id,v_event,v_event_at,
    jsonb_build_object('provider','openapi','state',v_state,'external_status',v_external,
      'provider_reference',v_delivery.provider_reference,'sandbox',p_sandbox)
  );
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values(v_delivery.user_id,'invoice',v_delivery.invoice_id,'delivery_openapi_'||v_event,
    jsonb_build_object('delivery_id',v_delivery.id,'state',v_state,'external_status',v_external,
      'provider_reference',v_delivery.provider_reference,'sandbox',p_sandbox));
  return v_delivery;
end;
$$;

create or replace function private._pos_reconcile_openapi_invoice_event(
  p_provider_reference text,
  p_state text,
  p_external_status text,
  p_event_at timestamptz,
  p_sandbox boolean,
  p_checked_at timestamptz default now()
)
returns public.pos_invoice_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_checked_at timestamptz := coalesce(p_checked_at, now());
  v_event_at timestamptz;
  v_terminal boolean;
begin
  if p_sandbox is null then raise exception 'Openapi način usklajevanja manjka.'; end if;
  if v_checked_at < now() - interval '1 hour' or v_checked_at > now() + interval '10 minutes' then
    raise exception 'Openapi čas preverjanja ni veljaven.';
  end if;

  select * into v_delivery from public.pos_invoice_deliveries
  where provider = 'openapi'
    and provider_reference = trim(p_provider_reference)
    and is_test = p_sandbox
    and status in ('sent', 'test_completed')
    and reconciliation_attempt_count between 1 and 7
    and last_reconciled_at = v_checked_at
  for update;
  if not found then return null; end if;
  v_event_at := coalesce(p_event_at, v_delivery.last_provider_event_at, v_checked_at);

  v_delivery := private._pos_apply_openapi_invoice_event(
    p_provider_reference, p_state, p_external_status, v_event_at, p_sandbox
  );
  if v_delivery.id is null then return null; end if;

  v_terminal := upper(trim(coalesce(p_state, ''))) in ('DONE', 'ERROR')
    or (
      upper(trim(coalesce(p_state, ''))) = 'SENT'
      and lower(trim(coalesce(p_external_status, ''))) = 'succeeded'
    );
  update public.pos_invoice_deliveries set
    last_reconciled_at = v_checked_at,
    reconcile_after = case
      when v_terminal or reconciliation_attempt_count >= 7 then null
      else v_checked_at + interval '6 hours'
    end,
    updated_at = now()
  where id = v_delivery.id
  returning * into v_delivery;

  return v_delivery;
end;
$$;

revoke all on function private._pos_apply_openapi_invoice_event(text,text,text,timestamptz,boolean)
  from public, anon, authenticated;
revoke all on function private._pos_reconcile_openapi_invoice_event(text,text,text,timestamptz,boolean,timestamptz)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
