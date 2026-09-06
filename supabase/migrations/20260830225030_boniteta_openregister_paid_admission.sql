-- Durable, server-only admission for every credit-consuming OpenRegister call.
-- A completed/failed request is replayed by (user_id, idempotency_key). An
-- expired processing request is deliberately not reclaimed automatically:
-- after an uncertain provider outcome, at-most-once charging is safer than a
-- hidden retry that can buy the same register product twice.

create table if not exists public.boniteta_openregister_paid_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  action text not null check (action in ('company_lookup', 'document', 'document_realtime', 'section', 'transparency_order')),
  profile_id uuid,
  binding text not null check (char_length(binding) between 1 and 500),
  credits_reserved integer not null check (credits_reserved between 1 and 100),
  request_day date not null default ((now() at time zone 'Europe/Ljubljana')::date),
  status text not null check (status in ('processing', 'completed', 'failed')),
  lease_token uuid,
  lease_until timestamptz,
  http_status integer check (http_status between 100 and 599),
  response_payload jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boniteta_openregister_paid_user_key unique (user_id, idempotency_key),
  constraint boniteta_openregister_paid_profile_owner_fkey
    foreign key (profile_id, user_id)
    references public.boniteta_profili(id, user_id)
    on delete cascade,
  constraint boniteta_openregister_paid_state_check check (
    (
      status = 'processing'
      and lease_token is not null
      and lease_until is not null
      and http_status is null
      and response_payload is null
      and completed_at is null
    )
    or
    (
      status in ('completed', 'failed')
      and lease_token is null
      and lease_until is null
      and http_status is not null
      and response_payload is not null
      and completed_at is not null
    )
  )
);

create index if not exists boniteta_openregister_paid_daily_idx
  on public.boniteta_openregister_paid_requests(user_id, request_day);
create index if not exists boniteta_openregister_paid_active_idx
  on public.boniteta_openregister_paid_requests(user_id, lease_until)
  where status = 'processing';

alter table public.boniteta_openregister_paid_requests enable row level security;
revoke all on table public.boniteta_openregister_paid_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.boniteta_openregister_paid_requests to service_role;

create or replace function public.sprejmi_boniteta_openregister_zahtevo(
  p_user_id uuid,
  p_idempotency_key text,
  p_fingerprint text,
  p_action text,
  p_profile_id uuid,
  p_binding text,
  p_credits integer,
  p_daily_credit_limit integer,
  p_concurrent_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_day date := (v_now at time zone 'Europe/Ljubljana')::date;
  v_existing public.boniteta_openregister_paid_requests;
  v_daily integer;
  v_active integer;
  v_lease_token uuid;
begin
  if p_user_id is null
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
    or p_fingerprint is null
    or p_fingerprint !~ '^[0-9a-f]{64}$'
    or p_action not in ('company_lookup', 'document', 'document_realtime', 'section', 'transparency_order')
    or p_binding is null
    or char_length(p_binding) not between 1 and 500
    or p_credits not between 1 and 100
    or p_daily_credit_limit not between 25 and 1000
    or p_concurrent_limit not between 1 and 4 then
    raise exception using errcode = '22023', message = 'Invalid paid OpenRegister admission input';
  end if;

  -- Serialize admission per user so quota and concurrency checks cannot race.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 92741)
  );

  select r.* into v_existing
    from public.boniteta_openregister_paid_requests r
   where r.user_id = p_user_id
     and r.idempotency_key = p_idempotency_key
   for update;

  if found then
    if v_existing.fingerprint <> p_fingerprint
      or v_existing.action <> p_action
      or v_existing.profile_id is distinct from p_profile_id
      or v_existing.binding <> p_binding
      or v_existing.credits_reserved <> p_credits then
      return jsonb_build_object(
        'action', 'reject',
        'statusCode', 409,
        'code', 'IDEMPOTENCY_KEY_REUSED',
        'retryable', false,
        'napaka', 'Ta ključ zahteve je že vezan na drugo plačljivo poizvedbo.'
      );
    end if;

    if v_existing.status in ('completed', 'failed') then
      return jsonb_build_object(
        'action', 'replay',
        'httpStatus', v_existing.http_status,
        'responsePayload', v_existing.response_payload
      );
    end if;

    if v_existing.lease_until > v_now then
      return jsonb_build_object(
        'action', 'reject',
        'statusCode', 409,
        'code', 'PAID_ACTION_IN_PROGRESS',
        'retryable', true,
        'retryAfterMs', greatest(250, least(5000, ceil(extract(epoch from (v_existing.lease_until - v_now)) * 1000)::integer)),
        'napaka', 'Plačljiva poizvedba se še izvaja.'
      );
    end if;

    return jsonb_build_object(
      'action', 'reject',
      'statusCode', 409,
      'code', 'PAID_ACTION_RECOVERY_REQUIRED',
      'retryable', false,
      'napaka', 'Izid prejšnje plačljive poizvedbe je negotov. Zaradi zaščite kreditov je ne bomo samodejno ponovili.'
    );
  end if;

  select coalesce(sum(r.credits_reserved), 0)::integer into v_daily
    from public.boniteta_openregister_paid_requests r
   where r.user_id = p_user_id
     and r.request_day = v_day;
  if v_daily + p_credits > p_daily_credit_limit then
    return jsonb_build_object(
      'action', 'reject',
      'statusCode', 429,
      'code', 'PAID_ACTION_DAILY_QUOTA_EXCEEDED',
      'retryable', false,
      'napaka', 'Dosežena je dnevna varnostna omejitev OpenRegister kreditov.'
    );
  end if;

  select count(*)::integer into v_active
    from public.boniteta_openregister_paid_requests r
   where r.user_id = p_user_id
     and r.status = 'processing'
     and r.lease_until > v_now;
  if v_active >= p_concurrent_limit then
    return jsonb_build_object(
      'action', 'reject',
      'statusCode', 429,
      'code', 'PAID_ACTION_CONCURRENCY_LIMIT',
      'retryable', true,
      'retryAfterMs', 1500,
      'napaka', 'Druga plačljiva poizvedba se še izvaja. Počakajte trenutek.'
    );
  end if;

  v_lease_token := gen_random_uuid();
  insert into public.boniteta_openregister_paid_requests(
    user_id, idempotency_key, fingerprint, action, profile_id, binding,
    credits_reserved, request_day, status, lease_token, lease_until,
    started_at, created_at, updated_at
  ) values (
    p_user_id, p_idempotency_key, p_fingerprint, p_action, p_profile_id, p_binding,
    p_credits, v_day, 'processing', v_lease_token, v_now + interval '90 seconds',
    v_now, v_now, v_now
  );

  return jsonb_build_object('action', 'start', 'leaseToken', v_lease_token);
end;
$$;

create or replace function public.zakljuci_boniteta_openregister_zahtevo(
  p_user_id uuid,
  p_idempotency_key text,
  p_fingerprint text,
  p_lease_token uuid,
  p_http_status integer,
  p_response_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.boniteta_openregister_paid_requests;
  v_terminal_status text;
begin
  if p_user_id is null
    or p_idempotency_key is null
    or p_fingerprint is null
    or p_lease_token is null
    or p_http_status not between 100 and 599
    or p_response_payload is null then
    raise exception using errcode = '22023', message = 'Invalid paid OpenRegister completion input';
  end if;

  select r.* into v_existing
    from public.boniteta_openregister_paid_requests r
   where r.user_id = p_user_id
     and r.idempotency_key = p_idempotency_key
   for update;

  if not found
    or v_existing.fingerprint <> p_fingerprint then
    return jsonb_build_object('ok', false, 'code', 'PAID_ACTION_NOT_OWNED');
  end if;
  if v_existing.status in ('completed', 'failed') then
    return jsonb_build_object('ok', true, 'replayed', true);
  end if;
  if v_existing.lease_token <> p_lease_token then
    return jsonb_build_object('ok', false, 'code', 'PAID_ACTION_LEASE_MISMATCH');
  end if;

  v_terminal_status := case when p_http_status between 200 and 299 then 'completed' else 'failed' end;
  update public.boniteta_openregister_paid_requests
     set status = v_terminal_status,
         lease_token = null,
         lease_until = null,
         http_status = p_http_status,
         response_payload = p_response_payload,
         completed_at = now(),
         updated_at = now()
   where user_id = p_user_id
     and idempotency_key = p_idempotency_key
     and fingerprint = p_fingerprint
     and status = 'processing'
     and lease_token = p_lease_token;

  return jsonb_build_object('ok', found, 'status', v_terminal_status);
end;
$$;

revoke all on function public.sprejmi_boniteta_openregister_zahtevo(uuid, text, text, text, uuid, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.zakljuci_boniteta_openregister_zahtevo(uuid, text, text, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.sprejmi_boniteta_openregister_zahtevo(uuid, text, text, text, uuid, text, integer, integer, integer) to service_role;
grant execute on function public.zakljuci_boniteta_openregister_zahtevo(uuid, text, text, uuid, integer, jsonb) to service_role;
