-- POS Stripe event invoice-lock and retry-stable snapshot contract.
--
-- This is a NEW follow-up migration. It does not edit, replace or reorder
-- 20260829165203_pos_payment_safety_v2.sql or any other prior migration.
--
-- CHANGES FROM v6 (v6 review points 1-3):
--
-- 1. UNSAFE CAST REMOVED. v6's validator relied on
--      jsonb_typeof(...) = 'number' AND (...)::numeric >= 1
--    PostgreSQL does NOT guarantee left-to-right evaluation of AND
--    operands — the planner may evaluate the cast first — so malformed
--    JSON could still raise 22P02 from inside the guard that exists to
--    prevent exactly that. v7 moves the cast inside an explicit CASE,
--    which is the documented construct with guaranteed evaluation order:
--    the cast is unreachable unless jsonb_typeof has already proved the
--    value is a JSON number.
--
-- 2. FULL, TYPE-SAFE CONTRACT VALIDATION. Every contract field has its
--    required JSON type. Identity fields also use the UUID / cs_test shape
--    already enforced on the write path, so JSON nulls, objects, arrays and
--    malformed text cannot be projected into a misleading RPC response.
--    A snapshot which asks for a
--    reconciliation follow-up actually carries what the handler needs to
--    perform it: when failure_code = 'paid_requires_reconciliation' and a
--    competing_checkout_session_id is present, the original session id and
--    both provider_attempt_ids must be non-empty. Without them the
--    handler cannot call assertTestSession, so accepting such a snapshot
--    would only defer the failure to runtime.
--
-- 3. BACKFILL NO LONGER TRUSTS A BARE outcome_version. v6 skipped any
--    event that merely had a numeric outcome_version, so a partially
--    formed snapshot would survive untouched and then fail the stricter
--    validator at runtime. v7 backfills every Stripe event that does not
--    pass the full validator, and additionally recovers
--    competing_provider_attempt_id by looking the competing payment up
--    (joined on ::text, never by casting untrusted JSON text to uuid).
--    A fail-closed preflight then runs AFTER the backfill and aborts the
--    migration, naming the offending external_event_ids, if anything still
--    fails validation — so ambiguous legacy data is resolved by a human
--    before deploy rather than surfacing as a 503 in a live webhook.
--
-- Ordering note: the two helper functions are created FIRST because the
-- backfill and the new preflight both call the validator.
--
-- CARRIED FORWARD (unchanged from v6): invoice-locked-before-payment
-- ordering; dedup re-checked under lock; ON CONFLICT DO NOTHING dedup
-- insert; payload-mismatch rejection; success only from a genuinely open
-- pending attempt within gross_cents; stale payment_failed events recorded
-- but ignored; narrowed unique index with every RPC guard left untouched.
--
-- KNOWN OPEN GAP (unchanged): this migration cannot call the Stripe API.
-- Closing the competing Checkout Session and re-reconciling the original
-- one is handler work, delivered separately.

begin;

lock table public.pos_invoices in share row exclusive mode;
lock table public.pos_payments in share row exclusive mode;
lock table public.pos_payment_events in share row exclusive mode;
lock table private.pos_invoice_payment_totals in share row exclusive mode;

-- ============================ helpers first ============================

-- Snapshot validator.
--
-- The outcome_version cast sits inside a CASE, not behind an AND, because
-- PostgreSQL only guarantees evaluation order for CASE. Every other check
-- is cast-free (jsonb `?` for presence, ->> for text), so this function
-- cannot raise 22P02 for any input, including a summary where
-- outcome_version is the string "abc", an object, an array or null.
create or replace function private._pos_stripe_event_snapshot_ok(p_summary jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    case
      when p_summary is null then false
      when jsonb_typeof(p_summary) <> 'object' then false
      when jsonb_typeof(p_summary -> 'outcome_version') <> 'number' then false
      else (p_summary ->> 'outcome_version')::numeric >= 1
    end
    -- Every projected contract field must be a JSON string. Presence alone
    -- is insufficient: ->> maps JSON null to SQL NULL and would otherwise
    -- let a reconciliation snapshot bypass the handler follow-up.
    and jsonb_typeof(p_summary -> 'payment_id') = 'string'
    and jsonb_typeof(p_summary -> 'invoice_id') = 'string'
    and jsonb_typeof(p_summary -> 'status') = 'string'
    and jsonb_typeof(p_summary -> 'failure_code') = 'string'
    and jsonb_typeof(p_summary -> 'reconciliation_reason') = 'string'
    and jsonb_typeof(p_summary -> 'competing_payment_id') = 'string'
    and jsonb_typeof(p_summary -> 'competing_checkout_session_id') = 'string'
    and jsonb_typeof(p_summary -> 'competing_provider_attempt_id') = 'string'
    and jsonb_typeof(p_summary -> 'original_checkout_session_id') = 'string'
    and jsonb_typeof(p_summary -> 'original_provider_attempt_id') = 'string'
    -- Stable identity and enum shapes.
    and (p_summary ->> 'payment_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (p_summary ->> 'invoice_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (p_summary ->> 'status') in ('pending','succeeded','failed','cancelled','partially_refunded','refunded')
    and char_length(p_summary ->> 'failure_code') <= 120
    and (p_summary ->> 'original_checkout_session_id') ~ '^cs_test_[A-Za-z0-9_]+$'
    and (p_summary ->> 'original_provider_attempt_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    -- Competing identity is all-empty or a complete, type-safe tuple.
    and case
      when (p_summary ->> 'competing_payment_id') = ''
       and (p_summary ->> 'competing_checkout_session_id') = ''
       and (p_summary ->> 'competing_provider_attempt_id') = ''
      then true
      else (p_summary ->> 'failure_code') = 'paid_requires_reconciliation'
       and (p_summary ->> 'competing_payment_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and (p_summary ->> 'competing_checkout_session_id') ~ '^cs_test_[A-Za-z0-9_]+$'
       and (p_summary ->> 'competing_provider_attempt_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    end
  , false);
$$;

-- One definition of the RPC result shape, used by every return path, so
-- duplicate:true and duplicate:false can never drift apart.
create or replace function private._pos_stripe_event_contract(
  p_summary jsonb,
  p_duplicate boolean
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'matched', true,
    'duplicate', p_duplicate,
    'outcome_version', p_summary->'outcome_version',
    'payment_id', p_summary->>'payment_id',
    'invoice_id', p_summary->>'invoice_id',
    'status', p_summary->>'status',
    'failure_code', p_summary->>'failure_code',
    'reconciliation_reason', p_summary->>'reconciliation_reason',
    'competing_payment_id', p_summary->>'competing_payment_id',
    'competing_checkout_session_id', p_summary->>'competing_checkout_session_id',
    'competing_provider_attempt_id', p_summary->>'competing_provider_attempt_id',
    'original_checkout_session_id', p_summary->>'original_checkout_session_id',
    'original_provider_attempt_id', p_summary->>'original_provider_attempt_id'
  );
$$;

-- ============================= preflights ==============================

-- Preflight 1: an invoice whose active Stripe attempt plus what is already
-- paid would exceed gross_cents.
do $$
begin
  if exists (
    select 1
    from public.pos_payments stripe_payment
    join private.pos_invoice_payment_totals totals
      on totals.invoice_id = stripe_payment.invoice_id
     and totals.user_id = stripe_payment.user_id
    where stripe_payment.provider = 'stripe'
      and (
        stripe_payment.status in ('pending','failed')
        or (stripe_payment.status = 'cancelled' and coalesce(stripe_payment.failure_code,'') <> 'checkout_expired')
      )
      and totals.effective_paid_cents + stripe_payment.amount_cents > totals.gross_cents
  ) then
    raise exception using
      errcode = '23514',
      message = 'POS_STRIPE_EVENT_PREFLIGHT_OVERCAP_CONFLICT';
  end if;
end;
$$;

-- Preflight 2: more than one payment already matching the NEW narrower
-- index predicate on one invoice.
do $$
begin
  if exists (
    select 1 from public.pos_payments
    where provider = 'stripe'
      and (
        (status = 'pending' and coalesce(failure_code,'') <> 'paid_requires_reconciliation')
        or status = 'failed'
        or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
      )
    group by invoice_id having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'POS_STRIPE_EVENT_PREFLIGHT_INDEX_SWAP_CONFLICT';
  end if;
end;
$$;

-- Preflight 3: every Stripe event must resolve to a payment row, otherwise
-- the backfill below cannot give it a snapshot.
do $$
begin
  if exists (
    select 1 from public.pos_payment_events e
    left join public.pos_payments p on p.id = e.payment_id
    where e.provider = 'stripe' and p.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'POS_STRIPE_EVENT_PREFLIGHT_ORPHAN_EVENT';
  end if;
end;
$$;

-- ============================== backfill ===============================

-- Backfill every Stripe event that does not pass the FULL validator — not
-- merely those lacking an outcome_version — so a partially formed snapshot
-- is repaired rather than skipped.
--
-- competing_provider_attempt_id is recovered by joining the competing
-- payment on id::text = metadata->>'competing_payment_id'. Comparing as
-- text deliberately avoids casting untrusted JSON content to uuid, which
-- would reintroduce a 22P02 path.
--
-- Honest limitation, unchanged from v6: an old event's true per-delivery
-- outcome was never recorded, so this snapshots the payment's CURRENT
-- state. It is flagged "backfilled": true so it is never mistaken for a
-- genuine decision-time snapshot.
update public.pos_payment_events e
set summary = e.summary || jsonb_build_object(
  'outcome_version', 1,
  'backfilled', true,
  'payment_id', p.id::text,
  'invoice_id', p.invoice_id::text,
  'status', p.status,
  'failure_code', coalesce(p.failure_code,''),
  'reconciliation_reason', coalesce(p.metadata->>'reconciliation_reason',''),
  'competing_payment_id', coalesce(p.metadata->>'competing_payment_id',''),
  'competing_checkout_session_id', coalesce(p.metadata->>'competing_checkout_session_id',''),
  'competing_provider_attempt_id', coalesce(cp.provider_attempt_id::text,''),
  'original_checkout_session_id', coalesce(p.checkout_session_id,''),
  'original_provider_attempt_id', coalesce(p.provider_attempt_id::text,'')
)
from public.pos_payments p
left join public.pos_payments cp
  on cp.provider = 'stripe'
 and cp.id::text = nullif(p.metadata->>'competing_payment_id','')
where p.id = e.payment_id
  and e.provider = 'stripe'
  and not private._pos_stripe_event_snapshot_ok(e.summary);

-- Preflight 4 (post-backfill, fail closed): if any Stripe event still
-- fails validation, stop the migration and name the offending events. This
-- is the ambiguous-legacy-data case — typically an old event whose payment
-- is flagged paid_requires_reconciliation against a competing session
-- whose attempt id can no longer be recovered. A human must resolve those
-- rows; installing the new function over them would only turn the problem
-- into a runtime 503.
do $$
declare
  v_count bigint;
  v_ids text;
begin
  select count(*), string_agg(e.external_event_id, ', ' order by e.external_event_id)
    into v_count, v_ids
  from public.pos_payment_events e
  where e.provider = 'stripe'
    and not private._pos_stripe_event_snapshot_ok(e.summary);

  if coalesce(v_count, 0) > 0 then
    raise exception using
      errcode = '23514',
      message = 'POS_STRIPE_EVENT_PREFLIGHT_SNAPSHOT_INCOMPLETE (' || v_count || '): ' || left(coalesce(v_ids,''), 2000);
  end if;
end;
$$;

-- ================================ index ================================

-- A pending row already flagged paid_requires_reconciliation is not a
-- user-payable active Checkout, so it must not count toward "one active
-- Stripe attempt per invoice" for UNIQUENESS. It still matches every RPC
-- guard's own EXISTS check (all unchanged), so it still blocks new
-- Stripe/manual/cash/bank attempts on its own.
drop index public.pos_payments_one_active_stripe_per_invoice_uidx;

create unique index pos_payments_one_active_stripe_per_invoice_uidx
  on public.pos_payments(invoice_id)
  where provider = 'stripe'
    and (
      (status = 'pending' and coalesce(failure_code,'') <> 'paid_requires_reconciliation')
      or status = 'failed'
      or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
    );

-- ============================== function ===============================

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
  v_candidate_id uuid;
  v_candidate_invoice_id uuid;
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_existing public.pos_payment_events%rowtype;
  v_event_row_id uuid;
  v_other_paid bigint;
  v_within_cap boolean;
  v_status text;
  v_action text;
  v_refunded bigint;
  v_reconciliation_reason text := '';
  v_competing_payment_id uuid;
  v_competing_checkout_session_id text;
  v_competing_provider_attempt_id uuid;
  v_snapshot jsonb;
begin
  if coalesce(p_livemode,true) then raise exception 'Live Stripe dogodki so zaklenjeni.'; end if;
  if p_event_id !~ '^evt_[A-Za-z0-9_]+$' or p_event_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Stripe dogodek nima veljavne identitete.';
  end if;
  if p_event_type not in ('checkout.session.completed','payment_intent.succeeded','payment_intent.payment_failed','charge.refunded') then
    raise exception 'Stripe dogodek ni podprt.';
  end if;

  -- 1. Early dedup check, unlocked.
  select * into v_existing from public.pos_payment_events
  where provider = 'stripe' and external_event_id = p_event_id;
  if found then
    if v_existing.event_sha256 <> p_event_sha256 or v_existing.event_type <> p_event_type then
      raise exception using
        errcode = '23514',
        message = 'POS_STRIPE_EVENT_ID_PAYLOAD_MISMATCH';
    end if;
    if not private._pos_stripe_event_snapshot_ok(v_existing.summary) then
      raise exception using
        errcode = '22023',
        message = 'POS_STRIPE_EVENT_SNAPSHOT_MISSING';
    end if;
    return private._pos_stripe_event_contract(v_existing.summary, true);
  end if;

  -- 2. Resolve the candidate payment without lock or mutation, only to
  -- learn which invoice to lock first.
  if p_event_type = 'charge.refunded' then
    select id, invoice_id into v_candidate_id, v_candidate_invoice_id
    from public.pos_payments
    where provider = 'stripe' and (
      external_payment_id = p_payment_intent_id
      or (
        user_id = p_user_id and invoice_id = p_invoice_id
        and provider_attempt_id = p_provider_attempt_id
      )
    )
    limit 1;
  else
    select id, invoice_id into v_candidate_id, v_candidate_invoice_id
    from public.pos_payments
    where provider = 'stripe'
      and user_id = p_user_id and invoice_id = p_invoice_id
      and provider_attempt_id = p_provider_attempt_id
      and (nullif(p_checkout_session_id,'') is null or checkout_session_id = p_checkout_session_id)
    limit 1;
  end if;
  if v_candidate_id is null then
    return jsonb_build_object('matched',false,'duplicate',false);
  end if;

  -- 3. Lock the invoice FIRST — the base concurrency fix.
  select * into v_invoice from public.pos_invoices
  where id = v_candidate_invoice_id
  for update;
  if not found then
    raise exception using
      errcode = '23514',
      message = 'POS_STRIPE_EVENT_INVOICE_MISSING';
  end if;

  -- 4. Re-read and lock the payment row.
  select * into v_payment from public.pos_payments
  where id = v_candidate_id
  for update;
  if not found or v_payment.provider <> 'stripe' then
    return jsonb_build_object('matched',false,'duplicate',false);
  end if;
  if p_event_type <> 'charge.refunded'
    and (
      v_payment.user_id <> p_user_id
      or v_payment.invoice_id <> p_invoice_id
      or v_payment.provider_attempt_id <> p_provider_attempt_id
    ) then
    return jsonb_build_object('matched',false,'duplicate',false);
  end if;

  -- 5. Re-check dedup under both locks.
  select * into v_existing from public.pos_payment_events
  where provider = 'stripe' and external_event_id = p_event_id;
  if found then
    if v_existing.event_sha256 <> p_event_sha256 or v_existing.event_type <> p_event_type
      or v_existing.payment_id <> v_payment.id then
      raise exception using
        errcode = '23514',
        message = 'POS_STRIPE_EVENT_ID_PAYLOAD_MISMATCH';
    end if;
    if not private._pos_stripe_event_snapshot_ok(v_existing.summary) then
      raise exception using
        errcode = '22023',
        message = 'POS_STRIPE_EVENT_SNAPSHOT_MISSING';
    end if;
    return private._pos_stripe_event_contract(v_existing.summary, true);
  end if;

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

  -- 6. Race-safe dedup insert.
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
  )
  on conflict (provider, external_event_id) do nothing
  returning id into v_event_row_id;

  if v_event_row_id is null then
    select * into v_existing from public.pos_payment_events
    where provider = 'stripe' and external_event_id = p_event_id;
    if v_existing.event_sha256 <> p_event_sha256 or v_existing.event_type <> p_event_type
      or v_existing.payment_id <> v_payment.id then
      raise exception using
        errcode = '23514',
        message = 'POS_STRIPE_EVENT_ID_PAYLOAD_MISMATCH';
    end if;
    if not private._pos_stripe_event_snapshot_ok(v_existing.summary) then
      raise exception using
        errcode = '22023',
        message = 'POS_STRIPE_EVENT_SNAPSHOT_MISSING';
    end if;
    return private._pos_stripe_event_contract(v_existing.summary, true);
  end if;

  -- 7. State transition. gross_cents stays a hard ceiling; the
  -- pos_invoice_payment_totals AFTER trigger remains the final backstop.
  v_status := v_payment.status;
  if p_event_type in ('checkout.session.completed','payment_intent.succeeded')
    and (p_event_type = 'payment_intent.succeeded' or p_payment_status = 'paid')
    and v_payment.status not in ('succeeded','partially_refunded','refunded') then
    v_other_paid := private._pos_effective_paid_cents(v_invoice.id, v_payment.user_id)
      - private._pos_payment_effective_cents(v_payment.status, v_payment.amount_cents, v_payment.refunded_cents);
    v_within_cap := (v_other_paid + v_payment.amount_cents <= v_invoice.gross_cents);
    if v_payment.status = 'pending'
      and coalesce(v_payment.failure_code,'') <> 'paid_requires_reconciliation'
      and v_within_cap then
      v_status := 'succeeded';
      v_action := 'stripe_payment_succeeded';
      update public.pos_payments set
        status = v_status, paid_at = coalesce(p_event_created_at,now()), refunded_cents = 0, failure_code = '',
        external_payment_id = coalesce(nullif(p_payment_intent_id,''),external_payment_id),
        provider_reference = coalesce(nullif(p_payment_intent_id,''),provider_reference),
        metadata = metadata || jsonb_build_object('last_event_id',p_event_id,'last_event_type',p_event_type)
      where id = v_payment.id returning * into v_payment;
    else
      v_status := 'pending';
      v_action := 'stripe_payment_paid_requires_reconciliation';
      v_reconciliation_reason := case
        when v_payment.status <> 'pending' then 'payment_not_pending'
        when coalesce(v_payment.failure_code,'') = 'paid_requires_reconciliation' then 'already_requires_reconciliation'
        when not v_within_cap then 'invoice_gross_limit'
        else 'payment_not_pending'
      end;
      -- Surface one other genuinely active Stripe attempt on this invoice.
      -- Because that row is provider='stripe', pos_payments_provider_shape_check
      -- guarantees its checkout_session_id and provider_attempt_id are NOT
      -- NULL — which is what lets the snapshot satisfy the validator's
      -- reconciliation requirement below.
      select id, checkout_session_id, provider_attempt_id
        into v_competing_payment_id, v_competing_checkout_session_id, v_competing_provider_attempt_id
      from public.pos_payments
      where provider = 'stripe'
        and invoice_id = v_payment.invoice_id
        and id <> v_payment.id
        and (
          (status = 'pending' and coalesce(failure_code,'') <> 'paid_requires_reconciliation')
          or status = 'failed'
          or (status = 'cancelled' and coalesce(failure_code,'') <> 'checkout_expired')
        )
      order by created_at desc
      limit 1;
      update public.pos_payments set
        status = v_status, paid_at = null, refunded_cents = 0,
        failure_code = 'paid_requires_reconciliation',
        external_payment_id = coalesce(nullif(p_payment_intent_id,''),external_payment_id),
        metadata = metadata || jsonb_build_object(
          'last_event_id',p_event_id,'last_event_type',p_event_type,
          'reconciliation_reason',v_reconciliation_reason,
          'competing_payment_id',v_competing_payment_id,
          'competing_checkout_session_id',v_competing_checkout_session_id
        )
      where id = v_payment.id returning * into v_payment;
    end if;
  elsif p_event_type = 'payment_intent.payment_failed' then
    if v_payment.status = 'pending' and coalesce(v_payment.failure_code,'') <> 'paid_requires_reconciliation' then
      v_status := 'failed';
      v_action := 'stripe_payment_failed';
      update public.pos_payments set
        status = v_status, paid_at = null, failure_code = left(coalesce(p_failure_code,'payment_failed'),120),
        external_payment_id = coalesce(nullif(p_payment_intent_id,''),external_payment_id),
        metadata = metadata || jsonb_build_object('last_event_id',p_event_id,'last_event_type',p_event_type)
      where id = v_payment.id returning * into v_payment;
    else
      v_action := 'stripe_payment_failed_event_ignored';
    end if;
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

  -- 8. Freeze this delivery's decided outcome into its own event row.
  v_snapshot := jsonb_build_object(
    'outcome_version', 1,
    'backfilled', false,
    'payment_id', v_payment.id::text,
    'invoice_id', v_payment.invoice_id::text,
    'status', v_payment.status,
    'failure_code', coalesce(v_payment.failure_code,''),
    'reconciliation_reason', coalesce(v_reconciliation_reason,''),
    'competing_payment_id', coalesce(v_competing_payment_id::text,''),
    'competing_checkout_session_id', coalesce(v_competing_checkout_session_id,''),
    'competing_provider_attempt_id', coalesce(v_competing_provider_attempt_id::text,''),
    'original_checkout_session_id', coalesce(v_payment.checkout_session_id,''),
    'original_provider_attempt_id', coalesce(v_payment.provider_attempt_id::text,'')
  );

  -- Defence in depth: a snapshot this function just built must satisfy the
  -- same validator every read path applies. If it somehow does not, fail
  -- the transaction now rather than persisting an event that would raise
  -- POS_STRIPE_EVENT_SNAPSHOT_MISSING on every future retry.
  if not private._pos_stripe_event_snapshot_ok(v_snapshot) then
    raise exception using
      errcode = '22023',
      message = 'POS_STRIPE_EVENT_SNAPSHOT_INVALID';
  end if;

  update public.pos_payment_events
  set summary = summary || v_snapshot
  where id = v_event_row_id;

  if v_action is not null then
    insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
    values (v_payment.user_id,'payment',v_payment.id,v_action,jsonb_build_object(
      'provider','stripe','invoice_id',v_payment.invoice_id,'amount_cents',v_payment.amount_cents,
      'currency',v_payment.currency,'status',v_payment.status,'refunded_cents',v_payment.refunded_cents,
      'failure_code',v_payment.failure_code,
      'reconciliation_reason',v_reconciliation_reason,
      'competing_payment_id',v_competing_payment_id,
      'competing_checkout_session_id',v_competing_checkout_session_id,
      'competing_provider_attempt_id',v_competing_provider_attempt_id,
      'provider_event_id',p_event_id,'provider_event_sha256',p_event_sha256,'test_mode',true
    ));
  end if;

  return private._pos_stripe_event_contract(v_snapshot, false);
end;
$$;

revoke all on function private._pos_stripe_event_contract(jsonb,boolean) from public, anon, authenticated;
revoke all on function private._pos_stripe_event_snapshot_ok(jsonb) from public, anon, authenticated;
revoke all on function private._pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) from public, anon, authenticated;
grant execute on function private._pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) to service_role;
revoke all on function public.pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) from public, anon, authenticated;
grant execute on function public.pos_apply_stripe_event(text,text,timestamptz,text,boolean,uuid,uuid,uuid,text,text,bigint,text,text,text,bigint) to service_role;

notify pgrst, 'reload schema';

commit;
