-- Repair sandbox rows that older callback handling incorrectly promoted to live
-- sent/delivered states. Preserve provider evidence and add an explicit audit
-- event instead of silently rewriting test history.

do $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_previous_status text;
begin
  for v_delivery in
    select * from public.pos_invoice_deliveries
    where provider='openapi' and is_test=true and status in ('sent','delivered')
    for update
  loop
    v_previous_status := v_delivery.status;

    update public.pos_invoice_deliveries set
      status='test_completed',
      sent_at=null,
      delivered_at=null,
      last_error='',
      updated_at=now()
    where id=v_delivery.id;

    insert into public.pos_invoice_delivery_events(
      user_id,delivery_id,event_type,provider_event_at,details
    ) values (
      v_delivery.user_id,v_delivery.id,'test_completed',now(),
      jsonb_build_object('provider','openapi','sandbox',true,
        'reason','sandbox_status_repair',
        'previous_status',v_previous_status,'status','test_completed',
        'provider_reference',v_delivery.provider_reference)
    );

    insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
    values(v_delivery.user_id,'invoice',v_delivery.invoice_id,'delivery_openapi_test_status_repaired',
      jsonb_build_object('delivery_id',v_delivery.id,'previous_status',v_previous_status,
        'status','test_completed','provider_reference',v_delivery.provider_reference));
  end loop;
end;
$$;
