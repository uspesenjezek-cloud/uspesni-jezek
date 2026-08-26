-- Keep Openapi sandbox callbacks isolated from production deliveries and ignore
-- stale provider events. Sandbox callbacks remain test evidence and must never
-- turn a test delivery into a live sent/delivered state.

drop function if exists public.pos_apply_openapi_invoice_event(text,text,text,timestamptz);
drop function if exists private._pos_apply_openapi_invoice_event(text,text,text,timestamptz);
create function private._pos_apply_openapi_invoice_event(
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
    v_status := case when v_state='DONE' then 'delivered' when v_state='ERROR' then 'failed' else 'sent' end;
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
create function public.pos_apply_openapi_invoice_event(
  p_provider_reference text,
  p_state text,
  p_external_status text,
  p_event_at timestamptz,
  p_sandbox boolean
)
returns public.pos_invoice_deliveries
language sql
security definer
set search_path = ''
as $$
  select private._pos_apply_openapi_invoice_event(
    p_provider_reference,p_state,p_external_status,p_event_at,p_sandbox
  );
$$;
revoke all on function private._pos_apply_openapi_invoice_event(text,text,text,timestamptz,boolean) from public,anon,authenticated;
revoke all on function public.pos_apply_openapi_invoice_event(text,text,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function private._pos_apply_openapi_invoice_event(text,text,text,timestamptz,boolean) to service_role;
grant execute on function public.pos_apply_openapi_invoice_event(text,text,text,timestamptz,boolean) to service_role;
notify pgrst, 'reload schema';
