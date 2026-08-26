-- Reserve each billable provider read before it starts. The row lock and the
-- six-hour lease prevent concurrent workers from spending the same bounded
-- reconciliation attempt more than once. Success and failure completion then
-- operate only on the exact reservation timestamp and never increment again.

create or replace function private._pos_claim_openapi_reconciliation(
  p_provider_reference text,
  p_sandbox boolean,
  p_checked_at timestamptz
)
returns public.pos_invoice_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_checked_at timestamptz := coalesce(p_checked_at, now());
  v_attempts integer;
begin
  if p_sandbox is null then raise exception 'Openapi način usklajevanja manjka.'; end if;
  if char_length(trim(coalesce(p_provider_reference, ''))) not between 1 and 240 then
    raise exception 'Openapi referenca usklajevanja ni veljavna.';
  end if;
  if v_checked_at < now() - interval '1 hour' or v_checked_at > now() + interval '10 minutes' then
    raise exception 'Openapi čas preverjanja ni veljaven.';
  end if;

  select * into v_delivery from public.pos_invoice_deliveries
  where provider = 'openapi'
    and provider_reference = trim(p_provider_reference)
    and is_test = p_sandbox
    and status in ('sent', 'test_completed')
    and reconciliation_attempt_count < 7
    and (
      reconcile_after <= v_checked_at
      or (reconcile_after is null and updated_at <= v_checked_at - interval '15 minutes')
    )
  for update skip locked;
  if not found then return null; end if;

  v_attempts := least(7, coalesce(v_delivery.reconciliation_attempt_count, 0) + 1);
  update public.pos_invoice_deliveries set
    last_reconciled_at = v_checked_at,
    reconciliation_attempt_count = v_attempts,
    reconcile_after = case
      when v_attempts >= 7 then null
      else v_checked_at + interval '6 hours'
    end,
    updated_at = now()
  where id = v_delivery.id
  returning * into v_delivery;

  return v_delivery;
end;
$$;

create or replace function public.pos_claim_openapi_reconciliation(
  p_provider_reference text,
  p_sandbox boolean,
  p_checked_at timestamptz
)
returns public.pos_invoice_deliveries
language sql
security definer
set search_path = ''
as $$
  select private._pos_claim_openapi_reconciliation(
    p_provider_reference, p_sandbox, p_checked_at
  );
$$;

-- A successful completion reuses the attempt consumed by the claim. Matching
-- last_reconciled_at prevents a stale worker from completing another lease.
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

  v_terminal := upper(trim(coalesce(p_state, ''))) in ('DONE', 'ERROR');
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

-- A failed provider read has already consumed its attempt in the claim. This
-- function only validates the exact lease and writes the failure audit event.

create or replace function private._pos_record_openapi_reconciliation_failure(
  p_provider_reference text,
  p_sandbox boolean,
  p_checked_at timestamptz,
  p_error_code text,
  p_retryable boolean default false
)
returns public.pos_invoice_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_checked_at timestamptz := coalesce(p_checked_at, now());
  v_error_code text := upper(trim(coalesce(p_error_code, 'OPENAPI_RECONCILIATION_FAILED')));
begin
  if p_sandbox is null then raise exception 'Openapi način usklajevanja manjka.'; end if;
  if char_length(trim(coalesce(p_provider_reference, ''))) not between 1 and 240 then
    raise exception 'Openapi referenca usklajevanja ni veljavna.';
  end if;
  if char_length(v_error_code) not between 1 and 120 or v_error_code ~ E'[\r\n]' then
    raise exception 'Openapi koda napake usklajevanja ni veljavna.';
  end if;
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

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (
    v_delivery.user_id, 'invoice', v_delivery.invoice_id,
    'delivery_openapi_reconciliation_check_failed',
    jsonb_build_object(
      'delivery_id', v_delivery.id,
      'provider_reference', v_delivery.provider_reference,
      'sandbox', p_sandbox,
      'error_code', v_error_code,
      'retryable', coalesce(p_retryable, false),
      'attempt', v_delivery.reconciliation_attempt_count,
      'max_attempts', 7
    )
  );
  return v_delivery;
end;
$$;

create or replace function public.pos_record_openapi_reconciliation_failure(
  p_provider_reference text,
  p_sandbox boolean,
  p_checked_at timestamptz,
  p_error_code text,
  p_retryable boolean default false
)
returns public.pos_invoice_deliveries
language sql
security definer
set search_path = ''
as $$
  select private._pos_record_openapi_reconciliation_failure(
    p_provider_reference, p_sandbox, p_checked_at, p_error_code, p_retryable
  );
$$;

revoke all on function private._pos_claim_openapi_reconciliation(text,boolean,timestamptz)
  from public, anon, authenticated;
revoke all on function public.pos_claim_openapi_reconciliation(text,boolean,timestamptz)
  from public, anon, authenticated;
revoke all on function private._pos_record_openapi_reconciliation_failure(text,boolean,timestamptz,text,boolean)
  from public, anon, authenticated;
revoke all on function public.pos_record_openapi_reconciliation_failure(text,boolean,timestamptz,text,boolean)
  from public, anon, authenticated;
grant execute on function private._pos_claim_openapi_reconciliation(text,boolean,timestamptz)
  to service_role;
grant execute on function public.pos_claim_openapi_reconciliation(text,boolean,timestamptz)
  to service_role;
grant execute on function private._pos_record_openapi_reconciliation_failure(text,boolean,timestamptz,text,boolean)
  to service_role;
grant execute on function public.pos_record_openapi_reconciliation_failure(text,boolean,timestamptz,text,boolean)
  to service_role;

notify pgrst, 'reload schema';
