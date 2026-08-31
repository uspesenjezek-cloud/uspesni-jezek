-- Persist every Stripe refund request before contacting Stripe and reconcile
-- the payment from Stripe's current Charge state. This is deliberately
-- independent of webhook event ids: signed webhooks remain an event ledger,
-- while this recovery path closes the response/webhook-loss gap.

create table private.pos_stripe_refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  invoice_id uuid not null references public.pos_invoices(id) on delete restrict,
  payment_id uuid not null references public.pos_payments(id) on delete restrict,
  request_id uuid not null,
  requested_cents bigint not null check (requested_cents > 0),
  baseline_refunded_cents bigint not null check (baseline_refunded_cents >= 0),
  provider_refund_id text,
  provider_status text not null default 'prepared'
    check (provider_status in ('prepared','pending','requires_action','succeeded','failed','canceled')),
  state text not null default 'prepared'
    check (state in ('prepared','provider_accepted','reconciled','failed','cancelled')),
  cumulative_refunded_cents bigint not null default 0
    check (cumulative_refunded_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reconciled_at timestamptz,
  unique (user_id, request_id),
  unique (provider_refund_id),
  check (provider_refund_id is null or provider_refund_id ~ '^re_[A-Za-z0-9_]+$')
);

create index pos_stripe_refund_requests_payment_active_idx
  on private.pos_stripe_refund_requests(payment_id, created_at)
  where state in ('prepared','provider_accepted');

revoke all on table private.pos_stripe_refund_requests from public, anon, authenticated;

create function private._pos_prepare_stripe_refund(
  p_user_id uuid,
  p_invoice_id uuid,
  p_payment_id uuid,
  p_request_id uuid,
  p_requested_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_request private.pos_stripe_refund_requests%rowtype;
  v_reserved bigint;
begin
  if p_user_id is null or p_invoice_id is null or p_payment_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'POS_STRIPE_REFUND_IDENTITY_INVALID';
  end if;
  if p_requested_cents is null or p_requested_cents <= 0 then
    raise exception using errcode = '22023', message = 'POS_STRIPE_REFUND_AMOUNT_INVALID';
  end if;

  -- Global financial lock order: invoice, payment, refund request.
  select * into v_invoice
  from public.pos_invoices
  where id = p_invoice_id and user_id = p_user_id
  for update;
  if not found or v_invoice.is_test is not true then
    raise exception using errcode = 'P0002', message = 'POS_STRIPE_TEST_INVOICE_NOT_FOUND';
  end if;

  select * into v_payment
  from public.pos_payments
  where id = p_payment_id and invoice_id = p_invoice_id and user_id = p_user_id
  for update;
  if not found or v_payment.provider <> 'stripe' or v_payment.method <> 'stripe_card'
    or v_payment.external_payment_id is null then
    raise exception using errcode = 'P0002', message = 'POS_STRIPE_REFUND_PAYMENT_NOT_ELIGIBLE';
  end if;

  select * into v_request
  from private.pos_stripe_refund_requests
  where user_id = p_user_id and request_id = p_request_id
  for update;
  if found then
    if v_request.invoice_id is distinct from p_invoice_id
      or v_request.payment_id is distinct from p_payment_id
      or v_request.requested_cents is distinct from p_requested_cents then
      raise exception using errcode = '23505', message = 'POS_STRIPE_REFUND_REQUEST_ID_REUSED';
    end if;
    return jsonb_build_object(
      'id',v_request.id,'request_id',v_request.request_id,
      'requested_cents',v_request.requested_cents,
      'baseline_refunded_cents',v_request.baseline_refunded_cents,
      'provider_refund_id',coalesce(v_request.provider_refund_id,''),
      'provider_status',v_request.provider_status,'state',v_request.state
    );
  end if;

  if v_payment.status not in ('succeeded','partially_refunded') then
    raise exception using errcode = 'P0002', message = 'POS_STRIPE_REFUND_PAYMENT_NOT_ELIGIBLE';
  end if;

  select coalesce(sum(requested_cents),0)::bigint into v_reserved
  from private.pos_stripe_refund_requests
  where payment_id = p_payment_id and user_id = p_user_id
    and state in ('prepared','provider_accepted');

  if p_requested_cents > v_payment.amount_cents - v_payment.refunded_cents - v_reserved then
    raise exception using errcode = '23514', message = 'POS_STRIPE_REFUND_EXCEEDS_AVAILABLE';
  end if;

  insert into private.pos_stripe_refund_requests(
    user_id,invoice_id,payment_id,request_id,requested_cents,
    baseline_refunded_cents,cumulative_refunded_cents
  ) values (
    p_user_id,p_invoice_id,p_payment_id,p_request_id,p_requested_cents,
    v_payment.refunded_cents,v_payment.refunded_cents
  )
  returning * into v_request;

  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (p_user_id,'payment',p_payment_id,'stripe_refund_requested',jsonb_build_object(
    'invoice_id',p_invoice_id,'request_id',p_request_id,
    'requested_cents',p_requested_cents,
    'baseline_refunded_cents',v_payment.refunded_cents,'test_mode',true
  ));

  return jsonb_build_object(
    'id',v_request.id,'request_id',v_request.request_id,
    'requested_cents',v_request.requested_cents,
    'baseline_refunded_cents',v_request.baseline_refunded_cents,
    'provider_refund_id','','provider_status',v_request.provider_status,'state',v_request.state
  );
end;
$$;

create function private._pos_reconcile_stripe_refund(
  p_user_id uuid,
  p_invoice_id uuid,
  p_payment_id uuid,
  p_request_id uuid,
  p_provider_refund_id text,
  p_provider_status text,
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_currency text,
  p_cumulative_refunded_cents bigint,
  p_observed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_request private.pos_stripe_refund_requests%rowtype;
  v_previous_state text;
  v_previous_provider_refund_id text;
  v_previous_refunded_cents bigint;
  v_target bigint;
  v_state text;
  v_status text;
  v_observed_at timestamptz := coalesce(p_observed_at,now());
begin
  if p_user_id is null or p_invoice_id is null or p_payment_id is null or p_request_id is null
    or p_provider_refund_id !~ '^re_[A-Za-z0-9_]+$'
    or p_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception using errcode = '22023', message = 'POS_STRIPE_REFUND_RECONCILE_IDENTITY_INVALID';
  end if;
  if p_provider_status not in ('pending','requires_action','succeeded','failed','canceled') then
    raise exception using errcode = '22023', message = 'POS_STRIPE_REFUND_PROVIDER_STATUS_INVALID';
  end if;
  if upper(coalesce(p_currency,'')) <> 'EUR' or p_amount_cents <= 0
    or p_cumulative_refunded_cents < 0 or p_cumulative_refunded_cents > p_amount_cents then
    raise exception using errcode = '22023', message = 'POS_STRIPE_REFUND_PROVIDER_AMOUNT_INVALID';
  end if;

  -- Same global financial lock order as every checkout/refund path.
  select * into v_invoice
  from public.pos_invoices
  where id = p_invoice_id and user_id = p_user_id
  for update;
  if not found or v_invoice.is_test is not true then
    raise exception using errcode = 'P0002', message = 'POS_STRIPE_TEST_INVOICE_NOT_FOUND';
  end if;

  select * into v_payment
  from public.pos_payments
  where id = p_payment_id and invoice_id = p_invoice_id and user_id = p_user_id
  for update;
  if not found or v_payment.provider <> 'stripe' or v_payment.method <> 'stripe_card'
    or v_payment.status not in ('succeeded','partially_refunded','refunded')
    or v_payment.external_payment_id is distinct from p_payment_intent_id
    or v_payment.amount_cents is distinct from p_amount_cents
    or v_payment.currency is distinct from upper(p_currency) then
    raise exception using errcode = '23514', message = 'POS_STRIPE_REFUND_PAYMENT_MISMATCH';
  end if;

  select * into v_request
  from private.pos_stripe_refund_requests
  where user_id = p_user_id and request_id = p_request_id
  for update;
  if not found or v_request.invoice_id is distinct from p_invoice_id
    or v_request.payment_id is distinct from p_payment_id then
    raise exception using errcode = 'P0002', message = 'POS_STRIPE_REFUND_REQUEST_NOT_FOUND';
  end if;
  if v_request.provider_refund_id is not null
    and v_request.provider_refund_id is distinct from p_provider_refund_id then
    raise exception using errcode = '23505', message = 'POS_STRIPE_REFUND_PROVIDER_ID_MISMATCH';
  end if;
  if p_cumulative_refunded_cents < v_payment.refunded_cents then
    raise exception using errcode = '23514', message = 'POS_STRIPE_REFUND_PROGRESS_REGRESSION';
  end if;

  v_target := v_request.baseline_refunded_cents + v_request.requested_cents;
  if v_target > v_payment.amount_cents then
    raise exception using errcode = '23514', message = 'POS_STRIPE_REFUND_REQUEST_TOTAL_INVALID';
  end if;
  if p_provider_status = 'succeeded' and p_cumulative_refunded_cents < v_target then
    raise exception using errcode = '23514', message = 'POS_STRIPE_REFUND_SUCCEEDED_AMOUNT_MISMATCH';
  end if;

  v_previous_state := v_request.state;
  v_previous_provider_refund_id := v_request.provider_refund_id;
  v_previous_refunded_cents := v_payment.refunded_cents;
  v_state := case
    when v_request.state in ('reconciled','failed','cancelled') then v_request.state
    when p_provider_status = 'failed' then 'failed'
    when p_provider_status = 'canceled' then 'cancelled'
    when p_provider_status = 'succeeded'
      and p_cumulative_refunded_cents >= v_target then 'reconciled'
    else 'provider_accepted'
  end;

  if p_cumulative_refunded_cents > v_payment.refunded_cents then
    v_status := case
      when p_cumulative_refunded_cents = v_payment.amount_cents then 'refunded'
      when p_cumulative_refunded_cents > 0 then 'partially_refunded'
      else 'succeeded'
    end;
    update public.pos_payments
    set status = v_status,
        refunded_cents = p_cumulative_refunded_cents,
        failure_code = '',
        paid_at = coalesce(paid_at,v_observed_at),
        metadata = metadata || jsonb_build_object(
          'last_refund_request_id',p_request_id,
          'last_provider_refund_id',p_provider_refund_id,
          'refund_reconciled_at',v_observed_at,
          'refund_reconcile_source','stripe_current_charge'
        )
    where id = v_payment.id
    returning * into v_payment;
  end if;

  update private.pos_stripe_refund_requests
  set provider_refund_id = coalesce(provider_refund_id,p_provider_refund_id),
      provider_status = p_provider_status,
      state = v_state,
      cumulative_refunded_cents = greatest(cumulative_refunded_cents,p_cumulative_refunded_cents),
      updated_at = v_observed_at,
      reconciled_at = case when v_state = 'reconciled' then coalesce(reconciled_at,v_observed_at) else reconciled_at end
  where id = v_request.id
  returning * into v_request;

  if p_cumulative_refunded_cents > v_previous_refunded_cents
    or v_previous_state is distinct from v_request.state
    or v_previous_provider_refund_id is null then
    insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
    values (p_user_id,'payment',p_payment_id,'stripe_refund_reconciled',jsonb_build_object(
      'invoice_id',p_invoice_id,'request_id',p_request_id,
      'provider_refund_id',p_provider_refund_id,'provider_status',p_provider_status,
      'state',v_request.state,'requested_cents',v_request.requested_cents,
      'cumulative_refunded_cents',p_cumulative_refunded_cents,
      'payment_intent_id',p_payment_intent_id,'test_mode',true
    ));
  end if;

  return jsonb_build_object(
    'request_id',v_request.request_id,'provider_refund_id',v_request.provider_refund_id,
    'provider_status',v_request.provider_status,'state',v_request.state,
    'payment',to_jsonb(v_payment)
  );
end;
$$;

create function public.pos_prepare_stripe_refund(
  p_user_id uuid,
  p_invoice_id uuid,
  p_payment_id uuid,
  p_request_id uuid,
  p_requested_cents bigint
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private._pos_prepare_stripe_refund(
    p_user_id,p_invoice_id,p_payment_id,p_request_id,p_requested_cents
  );
$$;

create function public.pos_reconcile_stripe_refund(
  p_user_id uuid,
  p_invoice_id uuid,
  p_payment_id uuid,
  p_request_id uuid,
  p_provider_refund_id text,
  p_provider_status text,
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_currency text,
  p_cumulative_refunded_cents bigint,
  p_observed_at timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private._pos_reconcile_stripe_refund(
    p_user_id,p_invoice_id,p_payment_id,p_request_id,p_provider_refund_id,
    p_provider_status,p_payment_intent_id,p_amount_cents,p_currency,
    p_cumulative_refunded_cents,p_observed_at
  );
$$;

revoke all on function private._pos_prepare_stripe_refund(uuid,uuid,uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function private._pos_prepare_stripe_refund(uuid,uuid,uuid,uuid,bigint) to service_role;
revoke all on function private._pos_reconcile_stripe_refund(uuid,uuid,uuid,uuid,text,text,text,bigint,text,bigint,timestamptz) from public, anon, authenticated;
grant execute on function private._pos_reconcile_stripe_refund(uuid,uuid,uuid,uuid,text,text,text,bigint,text,bigint,timestamptz) to service_role;

revoke all on function public.pos_prepare_stripe_refund(uuid,uuid,uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function public.pos_prepare_stripe_refund(uuid,uuid,uuid,uuid,bigint) to service_role;
revoke all on function public.pos_reconcile_stripe_refund(uuid,uuid,uuid,uuid,text,text,text,bigint,text,bigint,timestamptz) from public, anon, authenticated;
grant execute on function public.pos_reconcile_stripe_refund(uuid,uuid,uuid,uuid,text,text,text,bigint,text,bigint,timestamptz) to service_role;

notify pgrst, 'reload schema';
