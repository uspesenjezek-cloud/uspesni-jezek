-- Centralni strežniški predpomnilnik podrobne SolidCode/North Data dopolnitve.
-- Podatki niso javni in nikoli ne nadomestijo uradne OpenRegister identitete.
create table if not exists public.northdata_company_cache (
  company_key text primary key,
  identity_fingerprint text not null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  cache_version text not null,
  source_actor_id text not null default '9nsu4ZqEMU7DzdcW4',
  fetched_at timestamptz,
  expires_at timestamptz not null default now(),
  lock_until timestamptz,
  hit_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists northdata_company_cache_expiry_idx
  on public.northdata_company_cache (expires_at);

alter table public.northdata_company_cache enable row level security;
revoke all on table public.northdata_company_cache from public, anon, authenticated;
grant select, insert, update on table public.northdata_company_cache to service_role;

create or replace function public.claim_northdata_company_cache(
  p_company_key text,
  p_identity_fingerprint text,
  p_cache_version text,
  p_lock_seconds integer default 55
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claimed boolean := false;
begin
  if p_company_key !~ '^[0-9a-f]{64}$'
     or p_identity_fingerprint !~ '^[0-9a-f]{64}$'
     or length(coalesce(p_cache_version, '')) < 3 then
    raise exception 'invalid cache identity';
  end if;

  insert into public.northdata_company_cache (
    company_key, identity_fingerprint, status, payload, cache_version,
    source_actor_id, expires_at, lock_until, updated_at
  ) values (
    p_company_key, p_identity_fingerprint, 'pending', '{}'::jsonb, p_cache_version,
    '9nsu4ZqEMU7DzdcW4', now(), now() + make_interval(secs => least(greatest(p_lock_seconds, 10), 120)), now()
  )
  on conflict (company_key) do update set
    identity_fingerprint = excluded.identity_fingerprint,
    status = 'pending',
    payload = '{}'::jsonb,
    cache_version = excluded.cache_version,
    source_actor_id = excluded.source_actor_id,
    expires_at = now(),
    lock_until = excluded.lock_until,
    updated_at = now()
  where public.northdata_company_cache.cache_version <> excluded.cache_version
     or public.northdata_company_cache.expires_at <= now()
     or (public.northdata_company_cache.status = 'pending'
         and coalesce(public.northdata_company_cache.lock_until, '-infinity'::timestamptz) <= now())
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_northdata_company_cache(text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_northdata_company_cache(text, text, text, integer)
  to service_role;

;
