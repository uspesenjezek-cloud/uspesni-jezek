-- Emergency rollback for 20260830172315_pos_stripe_event_invoice_lock.sql.
-- Apply manually only after deploying the previous webhook handler.
--
-- Reverts private._pos_apply_stripe_event to its pre-fix body (from
-- 20260820204343_stripe_sandbox_invoice_payments.sql) and restores the
-- ORIGINAL, broader pos_payments_one_active_stripe_per_invoice_uidx
-- predicate. A forward migration (a new file), not an edit of an existing
-- one.
--
-- FIXED FROM THE v5 ROLLBACK (per review point 2):
--
-- v5's rollback preflight only looked for the pairing "one ordinary-active
-- row + one reconciliation row". That misses the case of TWO OR MORE
-- pending + paid_requires_reconciliation rows on the same invoice — which
-- the narrowed index permits but the restored broad index does NOT (the
-- old predicate matches every 'pending' row regardless of failure_code).
-- The restore would then have failed inside CREATE UNIQUE INDEX with a raw
-- duplicate-key error.
--
-- v6 checks the EXACT old predicate with GROUP BY invoice_id HAVING
-- COUNT(*) > 1, which by construction catches every combination the
-- restored index would reject — the active+reconciliation pairing and the
-- multiple-reconciliation case alike.
--
-- v5 also ran its preflight without holding a write lock, so a concurrent
-- webhook could insert a conflicting row between the check and the CREATE
-- UNIQUE INDEX. v6 takes the same SHARE ROW EXCLUSIVE lock the forward
-- migration uses, before the preflight, and holds it through the swap.
--
-- Rolling this back REINTRODUCES every bug the fix closed: the webhook
-- path locks only the payment row again, a concurrent duplicate delivery
-- can again surface as an unhandled 23505 (HTTP 503), a late "paid" or
-- "failed" event can again hard-fail or wrongly reclassify a payment, and
-- the retry-stable event-snapshot contract disappears. This is an
-- emergency technical withdrawal only.
--
-- ORDER OF OPERATIONS WHEN ROLLING BACK: deploy the previous
-- api/_handlers/pos-stripe-webhook.js FIRST, in its own release. The J.2
-- handler requires failure_code / competing_* / original_* in the RPC
-- result and returns 503 when they are missing; the reverted function
-- does not return them, so leaving the J.2 handler live against this
-- reverted function would 503 every reconciliation webhook.
--
-- NOTE: the outcome snapshots written into pos_payment_events.summary are
-- intentionally left in place. They are additive JSON keys that the
-- reverted function simply ignores, and destroying them would throw away
-- the only durable record of what past deliveries decided.

begin;

lock table public.pos_payments in share row exclusive mode;

do $$
begin
  if exists (
    select 1 from public.pos_payments
    where provider = 'stripe'
      and (
        status in ('pending','failed')
        or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
      )
    group by invoice_id having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'POS_STRIPE_EVENT_ROLLBACK_INDEX_RESTORE_CONFLICT';
  end if;
end;
$$;

drop index public.pos_payments_one_active_stripe_per_invoice_uidx;

create unique index pos_payments_one_active_stripe_per_invoice_uidx
  on public.pos_payments(invoice_id)
  where provider = 'stripe'
    and (
      status in ('pending','failed')
      or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
    );

create or replace function private._pos_apply_stripe_event(
  p_event_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_event_sha256 text,
  p_livemode boolean,
  p_user_id uuid,
  p_invoice_id uuid,
  p_provider_attempt_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_currency text,
  p_payment_status text,
  p_failure_code text,
  p_refunded_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.pos_payments%rowtype;
  v_existing public.pos_payment_events%rowtype;
  v_status text;
  v_action text;
  v_refunded bigint;
begin
  if coalesce(p_livemode,true) then raise exception 'Live Stripe dogodki so zaklenjeni.'; end if;
  if p_event_id !~ '^evt_[A-Za-z0-9_]+$' or p_event_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Stripe dogodek nima veljavne identitete.';
  end if;
  if p_event_type not in ('checkout.session.completed','payment_intent.succeeded','payment_intent.payment_failed','charge.refunded') then
    raise exception 'Stripe dogodek ni podprt.';
  end if;

  select * into v_existing from public.pos_payment_events
  where provider = 'stripe' and external_event_id = p_event_id;
  if found then
    select * into v_payment from public.pos_payments where id = v_existing.payment_id;
    return jsonb_build_object('matched',true,'duplicate',true,'payment_id',v_payment.id,'status',v_payment.status,'invoice_id',v_payment.invoice_id);
  end if;

  if p_event_type = 'charge.refunded' then
    select * into v_payment from public.pos_payments
    where provider = 'stripe' and (
      external_payment_id = p_payment_intent_id
      or (
        user_id = p_user_id and invoice_id = p_invoice_id
        and provider_attempt_id = p_provider_attempt_id
      )
    ) for update;
  else
    select * into v_payment from public.pos_payments
    where provider = 'stripe'
      and user_id = p_user_id and invoice_id = p_invoice_id
      and provider_attempt_id = p_provider_attempt_id
      and (nullif(p_checkout_session_id,'') is null or checkout_session_id = p_checkout_session_id)
    for update;
  end if;
  if not found then return jsonb_build_object('matched',false,'duplicate',false); end if;

  if upper(coalesce(p_currency,'')) <> v_payment.currency or p_amount_cents <> v_payment.amount_cents then
    raise exception 'Stripe dogodek se ne ujema z zneskom plačila.';
  end if;
  if p_event_type <> 'charge.refunded' and (v_payment.user_id <> p_user_id or v_payment.invoice_id <> p_invoice_id) then
    raise exception 'Stripe dogodek se ne ujema z računom ali uporabnikom.';
  end if;
  if nullif(p_payment_intent_id,'') is not null
    and v_payment.external_payment_id is not null
    and v_payment.external_payment_id <> p_payment_intent_id then
    raise exception 'Stripe PaymentIntent se ne ujema s plačilom.';
  end if;

  insert into public.pos_payment_events(
    user_id,payment_id,provider,external_event_id,event_type,event_sha256,livemode,event_created_at,summary
  ) values (
    v_payment.user_id,v_payment.id,'stripe',p_event_id,p_event_type,p_event_sha256,false,p_event_created_at,
    jsonb_build_object(
      'payment_intent_id',coalesce(p_payment_intent_id,''),
      'checkout_session_id',coalesce(p_checkout_session_id,''),
      'amount_cents',p_amount_cents,'currency',upper(p_currency),
      'payment_status',coalesce(p_payment_status,''),'failure_code',left(coalesce(p_failure_code,''),120),
      'refunded_cents',coalesce(p_refunded_cents,0),'test_mode',true
    )
  );

  v_status := v_payment.status;
  if p_event_type in ('checkout.session.completed','payment_intent.succeeded')
    and (p_event_type = 'payment_intent.succeeded' or p_payment_status = 'paid')
    and v_payment.status not in ('partially_refunded','refunded') then
    v_status := 'succeeded';
    v_action := 'stripe_payment_succeeded';
    update public.pos_payments set
      status = v_status, paid_at = coalesce(p_event_created_at,now()), refunded_cents = 0, failure_code = '',
      external_payment_id = coalesce(nullif(p_payment_intent_id,''),external_payment_id),
      provider_reference = coalesce(nullif(p_payment_intent_id,''),provider_reference),
      metadata = metadata || jsonb_build_object('last_event_id',p_event_id,'last_event_type',p_event_type)
    where id = v_payment.id returning * into v_payment;
  elsif p_event_type = 'payment_intent.payment_failed'
    and v_payment.status not in ('succeeded','partially_refunded','refunded') then
    v_status := 'failed';
    v_action := 'stripe_payment_failed';
    update public.pos_payments set
      status = v_status, paid_at = null, failure_code = left(coalesce(p_failure_code,'payment_failed'),120),
      external_payment_id = coalesce(nullif(p_payment_intent_id,''),external_payment_id),
      metadata = metadata || jsonb_build_object('last_event_id',p_event_id,'last_event_type',p_event_type)
    where id = v_payment.id returning * into v_payment;
  elsif p_event_type = 'charge.refunded' then
    v_refunded := greatest(0,least(v_payment.amount_cents,coalesce(p_refunded_cents,0)));
    v_status := case when v_refunded >= v_payment.amount_cents then 'refunded' else 'partially_refunded' end;
    v_action := 'stripe_payment_refunded';
    update public.pos_payments set
      status = v_status, refunded_cents = v_refunded, failure_code = '',
      paid_at = coalesce(paid_at,p_event_created_at,now()),
      external_payment_id = coalesce(nullif(p_payment_intent_id,''),external_payment_id),
      metadata = metadata || jsonb_build_object('last_event_id',p_event_id,'last_event_type',p_event_type)
    where id = v_payment.id returning * into v_payment;
  end if;

  if v_action is not null then
    insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
    values (v_payment.user_id,'payment',v_payment.id,v_action,jsonb_build_object(
      'provider','stripe','invoice_id',v_payment.invoice_id,'amount_cents',v_payment.amount_cents,
      'currency',v_payment.currency,'status',v_payment.status,'refunded_cents',v_payment.refunded_cents,
      'provider_event_id',p_event_id,'provider_event_sha256',p_event_sha256,'test_mode',true
    ));
  end if;

  return jsonb_build_object('matched',true,'duplicate',false,'payment_id',v_payment.id,'status',v_payment.status,'invoice_id',v_payment.invoice_id);
end;
$$;

drop function if exists private._pos_stripe_event_contract(jsonb,boolean);
drop function if exists private._pos_stripe_event_snapshot_ok(jsonb);

revoke all on function private._pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) from public, anon, authenticated;
grant execute on function private._pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) to service_role;
revoke all on function public.pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) from public, anon, authenticated;
grant execute on function public.pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) to service_role;

notify pgrst, 'reload schema';

commit;
