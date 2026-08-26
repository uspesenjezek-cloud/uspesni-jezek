-- A provider callback may be created before the local delivery worker commits
-- the successful submission. The local submission clock is therefore not a
-- provider-event watermark: using it could discard a slightly older DONE
-- callback that arrives after the worker finishes.

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
      last_provider_event_at=null,
      last_provider_event_type='',
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

-- Repair only the synthetic local watermark. Provider evidence and immutable
-- delivery events remain untouched; this merely allows the first real
-- Openapi or Resend callback to establish the provider clock.
do $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
begin
  for v_delivery in
    select * from public.pos_invoice_deliveries
    where provider in ('openapi','resend') and is_test=false and status='sent'
      and last_provider_event_type='submitted' and last_provider_event_at is not null
    for update
  loop
    update public.pos_invoice_deliveries set
      last_provider_event_at=null,
      last_provider_event_type='',
      updated_at=now()
    where id=v_delivery.id;

    insert into public.pos_invoice_delivery_events(
      user_id,delivery_id,event_type,provider_event_at,details
    ) values (
      v_delivery.user_id,v_delivery.id,'sent',null,
      jsonb_build_object(
        'provider',v_delivery.provider,'reason','submission_clock_not_provider_watermark',
        'provider_reference',v_delivery.provider_reference,
        'previous_local_watermark',v_delivery.last_provider_event_at
      )
    );
    insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
    values(v_delivery.user_id,'invoice',v_delivery.invoice_id,
      'delivery_'||v_delivery.provider||'_provider_clock_reset',
      jsonb_build_object(
        'delivery_id',v_delivery.id,'provider_reference',v_delivery.provider_reference,
        'previous_local_watermark',v_delivery.last_provider_event_at
      ));
  end loop;
end;
$$;

revoke all on function private._pos_finish_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean)
  from public,anon,authenticated;
grant execute on function private._pos_finish_invoice_delivery(uuid,uuid,uuid,boolean,text,text,boolean)
  to service_role;

notify pgrst, 'reload schema';
