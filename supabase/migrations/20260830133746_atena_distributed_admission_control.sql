-- Shared Atena admission control for horizontally scaled serverless instances.
-- The table is never exposed directly; authenticated users can only call the
-- two narrowly scoped RPCs below, which derive ownership from auth.uid().

create table if not exists public.atena_ai_requests (
  request_key text primary key,
  user_id uuid not null,
  request_id text not null,
  request_kind text not null check (request_kind in ('history', 'agreement', 'goal', 'document')),
  contract_version text not null,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('processing', 'completed')),
  lease_token uuid,
  lease_until timestamptz,
  http_status smallint check (http_status between 100 and 599),
  response_payload jsonb,
  started_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '5 minutes'),
  check (
    (status = 'processing' and lease_token is not null and lease_until is not null and response_payload is null)
    or
    (status = 'completed' and lease_token is null and lease_until is null and http_status is not null and response_payload is not null)
  )
);

alter table public.atena_ai_requests enable row level security;
revoke all on table public.atena_ai_requests from public, anon, authenticated;

create index if not exists atena_ai_requests_user_started_idx
  on public.atena_ai_requests (user_id, started_at desc);
create index if not exists atena_ai_requests_active_lease_idx
  on public.atena_ai_requests (lease_until)
  where status = 'processing';
create index if not exists atena_ai_requests_expiry_idx
  on public.atena_ai_requests (expires_at);

create or replace function public.atena_begin_ai_request(
  p_request_key text,
  p_request_id text,
  p_request_kind text,
  p_contract_version text,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_existing public.atena_ai_requests%rowtype;
  v_lease_token uuid;
  v_user_count integer;
  v_active_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_request_key is null or length(p_request_key) < 16 or length(p_request_key) > 260
    or p_request_id is null or p_request_id !~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{15,99}$'
    or p_request_kind is null or p_request_kind not in ('history', 'agreement', 'goal', 'document')
    or p_contract_version is null or length(p_contract_version) > 120
    or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('action', 'invalid');
  end if;

  -- One very short transaction lock makes the global capacity decision atomic.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('atena-ai-admission-v1', 0));
  delete from public.atena_ai_requests where expires_at <= v_now;

  select * into v_existing
  from public.atena_ai_requests
  where request_key = p_request_key
  for update;

  if found then
    if v_existing.user_id <> v_user_id or v_existing.fingerprint <> p_fingerprint then
      return jsonb_build_object('action', 'conflict');
    end if;
    if v_existing.status = 'completed' then
      if v_existing.response_payload @> '{"retryable": true}'::jsonb then
        -- Self-heal rows written by an older deployment which incorrectly
        -- treated a transient failure as a completed idempotent result.
        delete from public.atena_ai_requests where request_key = p_request_key;
      else
        return jsonb_build_object(
          'action', 'cached',
          'httpStatus', v_existing.http_status,
          'payload', v_existing.response_payload
        );
      end if;
    end if;
    if v_existing.lease_until > v_now then
      return jsonb_build_object(
        'action', 'in_progress',
        'retryAfterMs', greatest(250, least(5000, ceil(extract(epoch from (v_existing.lease_until - v_now)) * 1000)::integer))
      );
    end if;
  end if;

  select count(*) into v_user_count
  from public.atena_ai_requests
  where user_id = v_user_id and started_at > v_now - interval '1 minute';
  if v_user_count >= 12 then
    return jsonb_build_object('action', 'rate_limited', 'retryAfterMs', 60000);
  end if;

  select count(*) into v_active_count
  from public.atena_ai_requests
  where status = 'processing' and lease_until > v_now;
  if v_active_count >= 24 then
    return jsonb_build_object('action', 'busy', 'retryAfterMs', 1500);
  end if;

  v_lease_token := gen_random_uuid();
  insert into public.atena_ai_requests (
    request_key, user_id, request_id, request_kind, contract_version,
    fingerprint, status, lease_token, lease_until, started_at, updated_at, expires_at
  ) values (
    p_request_key, v_user_id, p_request_id, p_request_kind, p_contract_version,
    p_fingerprint, 'processing', v_lease_token, v_now + interval '55 seconds',
    v_now, v_now, v_now + interval '5 minutes'
  )
  on conflict (request_key) do update set
    request_id = excluded.request_id,
    request_kind = excluded.request_kind,
    contract_version = excluded.contract_version,
    fingerprint = excluded.fingerprint,
    status = 'processing',
    lease_token = excluded.lease_token,
    lease_until = excluded.lease_until,
    http_status = null,
    response_payload = null,
    started_at = excluded.started_at,
    updated_at = excluded.updated_at,
    expires_at = excluded.expires_at;

  return jsonb_build_object('action', 'start', 'leaseToken', v_lease_token);
end;
$$;

create or replace function public.atena_finish_ai_request(
  p_request_key text,
  p_fingerprint text,
  p_lease_token uuid,
  p_http_status integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_http_status < 100 or p_http_status > 599 or p_payload is null then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  -- A transient result is not a completed idempotent operation. Releasing the
  -- owned lease lets the same request id retry immediately after recovery.
  if p_payload @> '{"retryable": true}'::jsonb then
    delete from public.atena_ai_requests
    where request_key = p_request_key
      and user_id = v_user_id
      and fingerprint = p_fingerprint
      and status = 'processing'
      and lease_token = p_lease_token;
    get diagnostics v_updated = row_count;
    return jsonb_build_object('ok', v_updated = 1, 'released', v_updated = 1);
  end if;

  update public.atena_ai_requests
  set status = 'completed',
      lease_token = null,
      lease_until = null,
      http_status = p_http_status,
      response_payload = p_payload,
      updated_at = clock_timestamp(),
      expires_at = clock_timestamp() + interval '5 minutes'
  where request_key = p_request_key
    and user_id = v_user_id
    and fingerprint = p_fingerprint
    and status = 'processing'
    and lease_token = p_lease_token;
  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', v_updated = 1);
end;
$$;

revoke execute on function public.atena_begin_ai_request(text, text, text, text, text) from public, anon;
revoke execute on function public.atena_finish_ai_request(text, text, uuid, integer, jsonb) from public, anon;
grant execute on function public.atena_begin_ai_request(text, text, text, text, text) to authenticated;
grant execute on function public.atena_finish_ai_request(text, text, uuid, integer, jsonb) to authenticated;
