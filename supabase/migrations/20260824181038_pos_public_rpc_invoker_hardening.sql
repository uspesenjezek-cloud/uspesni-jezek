-- Public RPCs must run with the caller's privileges. The narrowly scoped
-- private implementations retain SECURITY DEFINER because they perform the
-- actual writes, but every implementation validates auth.uid() and tenant
-- ownership before touching data.

create or replace function public.pos_cancel_work_order(
  p_work_order_id uuid,
  p_reason text
)
returns public.pos_work_orders
language sql
security invoker
set search_path = ''
as $$
  select private._pos_cancel_work_order(p_work_order_id, p_reason);
$$;

revoke all on function private._pos_cancel_work_order(uuid,text) from public, anon;
grant execute on function private._pos_cancel_work_order(uuid,text) to authenticated, service_role;
revoke all on function public.pos_cancel_work_order(uuid,text) from public, anon;
grant execute on function public.pos_cancel_work_order(uuid,text) to authenticated, service_role;

create or replace function public.pos_accept_work_order(
  p_work_order_id uuid,
  p_evidence text,
  p_accepted_on date
)
returns public.pos_work_orders
language sql
security invoker
set search_path = ''
as $$
  select private._pos_accept_work_order(p_work_order_id, p_evidence, p_accepted_on);
$$;

create or replace function public.pos_accept_work_order(
  p_work_order_id uuid,
  p_evidence text
)
returns public.pos_work_orders
language sql
security invoker
set search_path = ''
set timezone = 'Europe/Berlin'
as $$
  select private._pos_accept_work_order(p_work_order_id, p_evidence, current_date);
$$;

revoke all on function private._pos_accept_work_order(uuid,text,date) from public, anon;
grant execute on function private._pos_accept_work_order(uuid,text,date) to authenticated, service_role;
revoke all on function public.pos_accept_work_order(uuid,text,date) from public, anon;
grant execute on function public.pos_accept_work_order(uuid,text,date) to authenticated, service_role;
revoke all on function public.pos_accept_work_order(uuid,text) from public, anon;
grant execute on function public.pos_accept_work_order(uuid,text) to authenticated, service_role;

create or replace function public.pos_record_consumer_withdrawal(
  p_work_order_id uuid,
  p_declared_on date,
  p_evidence text
)
returns public.pos_work_orders
language sql
security invoker
set search_path = ''
as $$
  select private._pos_record_consumer_withdrawal(p_work_order_id, p_declared_on, p_evidence);
$$;

revoke all on function private._pos_record_consumer_withdrawal(uuid,date,text) from public, anon;
grant execute on function private._pos_record_consumer_withdrawal(uuid,date,text) to authenticated, service_role;
revoke all on function public.pos_record_consumer_withdrawal(uuid,date,text) from public, anon;
grant execute on function public.pos_record_consumer_withdrawal(uuid,date,text) to authenticated, service_role;

create or replace function public.pos_record_contract_confirmation_delivery(
  p_work_order_id uuid,
  p_channel text,
  p_evidence text,
  p_delivered_on date,
  p_electronic_consent_evidence text default null
)
returns public.pos_contract_confirmation_deliveries
language sql
security invoker
set search_path = ''
as $$
  select private._pos_record_contract_confirmation_delivery(
    p_work_order_id, p_channel, p_evidence, p_delivered_on, p_electronic_consent_evidence
  );
$$;

revoke all on function private._pos_record_contract_confirmation_delivery(uuid,text,text,date,text) from public, anon;
grant execute on function private._pos_record_contract_confirmation_delivery(uuid,text,text,date,text) to authenticated, service_role;
revoke all on function public.pos_record_contract_confirmation_delivery(uuid,text,text,date,text) from public, anon;
grant execute on function public.pos_record_contract_confirmation_delivery(uuid,text,text,date,text) to authenticated, service_role;

create or replace function public.pos_start_work_order(
  p_work_order_id uuid,
  p_evidence text,
  p_value_compensation_informed boolean,
  p_right_expiry_acknowledged boolean,
  p_request_on_durable_medium boolean
)
returns public.pos_work_orders
language sql
security invoker
set search_path = ''
as $$
  select private._pos_start_work_order(
    p_work_order_id,
    p_evidence,
    p_value_compensation_informed,
    p_right_expiry_acknowledged,
    p_request_on_durable_medium
  );
$$;

create or replace function public.pos_start_work_order(
  p_work_order_id uuid,
  p_evidence text
)
returns public.pos_work_orders
language sql
security invoker
set search_path = ''
as $$
  select private._pos_start_work_order(p_work_order_id, p_evidence, false, false, false);
$$;

revoke all on function private._pos_start_work_order(uuid,text,boolean,boolean,boolean) from public, anon;
grant execute on function private._pos_start_work_order(uuid,text,boolean,boolean,boolean) to authenticated, service_role;
revoke all on function public.pos_start_work_order(uuid,text,boolean,boolean,boolean) from public, anon;
grant execute on function public.pos_start_work_order(uuid,text,boolean,boolean,boolean) to authenticated, service_role;
revoke all on function public.pos_start_work_order(uuid,text) from public, anon;
grant execute on function public.pos_start_work_order(uuid,text) to authenticated, service_role;

create or replace function public.pos_assess_consumer_withdrawal_settlement(
  p_work_order_id uuid,
  p_value_compensation_cents bigint,
  p_refund_method text,
  p_alternative_agreement_evidence text default null,
  p_value_compensation_reason text default null
)
returns public.pos_consumer_withdrawal_settlements
language sql
security invoker
set search_path = ''
as $$
  select private._pos_assess_consumer_withdrawal_settlement(
    p_work_order_id,
    p_value_compensation_cents,
    p_refund_method,
    p_alternative_agreement_evidence,
    p_value_compensation_reason
  );
$$;

revoke all on function private._pos_assess_consumer_withdrawal_settlement(uuid,bigint,text,text,text) from public, anon;
grant execute on function private._pos_assess_consumer_withdrawal_settlement(uuid,bigint,text,text,text) to authenticated, service_role;
revoke all on function public.pos_assess_consumer_withdrawal_settlement(uuid,bigint,text,text,text) from public, anon;
grant execute on function public.pos_assess_consumer_withdrawal_settlement(uuid,bigint,text,text,text) to authenticated, service_role;

create or replace function public.pos_record_consumer_withdrawal_refund(
  p_work_order_id uuid,
  p_amount_cents bigint,
  p_provider text,
  p_provider_reference text,
  p_evidence text,
  p_executed_on date
)
returns public.pos_consumer_withdrawal_refund_records
language sql
security invoker
set search_path = ''
as $$
  select private._pos_record_consumer_withdrawal_refund(
    p_work_order_id, p_amount_cents, p_provider, p_provider_reference, p_evidence, p_executed_on
  );
$$;

revoke all on function private._pos_record_consumer_withdrawal_refund(uuid,bigint,text,text,text,date) from public, anon;
grant execute on function private._pos_record_consumer_withdrawal_refund(uuid,bigint,text,text,text,date) to authenticated, service_role;
revoke all on function public.pos_record_consumer_withdrawal_refund(uuid,bigint,text,text,text,date) from public, anon;
grant execute on function public.pos_record_consumer_withdrawal_refund(uuid,bigint,text,text,text,date) to authenticated, service_role;

create or replace function public.pos_create_withdrawal_tax_credit_notes(
  p_work_order_id uuid,
  p_confirmed boolean default false
)
returns setof public.pos_invoice_adjustments
language sql
security invoker
set search_path = ''
as $$
  select * from private._pos_create_withdrawal_tax_credit_notes(p_work_order_id, p_confirmed);
$$;

revoke all on function private._pos_create_withdrawal_tax_credit_notes(uuid,boolean) from public, anon;
grant execute on function private._pos_create_withdrawal_tax_credit_notes(uuid,boolean) to authenticated, service_role;
revoke all on function public.pos_create_withdrawal_tax_credit_notes(uuid,boolean) from public, anon;
grant execute on function public.pos_create_withdrawal_tax_credit_notes(uuid,boolean) to authenticated, service_role;

create or replace function public.pos_create_invoice_adjustment(
  p_invoice_id uuid,
  p_request_key uuid,
  p_adjustment_type text,
  p_reason text,
  p_changes jsonb default '{}'::jsonb,
  p_confirmed boolean default false
)
returns public.pos_invoice_adjustments
language sql
security invoker
set search_path = ''
as $$
  select private._pos_create_invoice_adjustment_idempotent(
    p_invoice_id, p_request_key, p_adjustment_type, p_reason, p_changes, p_confirmed
  );
$$;

revoke all on function private._pos_create_invoice_adjustment_idempotent(uuid,uuid,text,text,jsonb,boolean) from public, anon;
grant execute on function private._pos_create_invoice_adjustment_idempotent(uuid,uuid,text,text,jsonb,boolean) to authenticated, service_role;
revoke all on function public.pos_create_invoice_adjustment(uuid,uuid,text,text,jsonb,boolean) from public, anon;
grant execute on function public.pos_create_invoice_adjustment(uuid,uuid,text,text,jsonb,boolean) to authenticated, service_role;

create or replace function public.pos_record_manual_payment(
  p_invoice_id uuid,
  p_request_key uuid,
  p_confirmed boolean default false
)
returns public.pos_payments
language sql
security invoker
set search_path = ''
as $$
  select private._pos_record_manual_payment_idempotent(p_invoice_id, p_request_key, p_confirmed);
$$;

revoke all on function private._pos_record_manual_payment_idempotent(uuid,uuid,boolean) from public, anon;
grant execute on function private._pos_record_manual_payment_idempotent(uuid,uuid,boolean) to authenticated, service_role;
revoke all on function public.pos_record_manual_payment(uuid,uuid,boolean) from public, anon;
grant execute on function public.pos_record_manual_payment(uuid,uuid,boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
