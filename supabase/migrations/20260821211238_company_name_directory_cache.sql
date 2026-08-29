-- Skupni imenik je namenjen izključno cenejšemu iskanju imen podjetij.
-- Ne vsebuje bonitetne ocene, finančnih podatkov ali osebnih podatkov.
create table if not exists public.company_name_directory (
  id bigint generated always as identity primary key,
  normalized_name text not null,
  legal_name text not null,
  normalized_city text not null default '',
  city text not null default '',
  source text not null default 'northdata_names'
    check (source in ('northdata_names', 'openregister_identity')),
  source_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint company_name_directory_name_city_key unique (normalized_name, normalized_city),
  constraint company_name_directory_normalized_name_not_blank check (btrim(normalized_name) <> ''),
  constraint company_name_directory_legal_name_not_blank check (btrim(legal_name) <> '')
);
comment on table public.company_name_directory is
  'Skupni predpomnilnik imen podjetij za autocomplete; ni vir bonitetne ocene ali uradne identitete.';
create index if not exists company_name_directory_name_prefix_idx
  on public.company_name_directory (normalized_name text_pattern_ops);
create index if not exists company_name_directory_last_seen_idx
  on public.company_name_directory (last_seen_at desc);
create table if not exists public.company_name_search_cache (
  normalized_query text primary key,
  display_query text not null,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'failed')),
  results jsonb not null default '[]'::jsonb,
  searched_at timestamptz,
  expires_at timestamptz not null default now(),
  lock_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint company_name_search_cache_query_not_blank check (btrim(normalized_query) <> ''),
  constraint company_name_search_cache_results_array check (jsonb_typeof(results) = 'array')
);
comment on table public.company_name_search_cache is
  'Strežniški predpomnilnik NorthData iskalnih izrazov, vključno s praznimi zadetki, za preprečevanje dvojnih plačljivih zagonov.';
create index if not exists company_name_search_cache_expiry_idx
  on public.company_name_search_cache (expires_at);
alter table public.company_name_directory enable row level security;
alter table public.company_name_search_cache enable row level security;
revoke all on table public.company_name_directory from anon, authenticated;
revoke all on table public.company_name_search_cache from anon, authenticated;
grant select, insert, update on table public.company_name_directory to service_role;
grant select, insert, update on table public.company_name_search_cache to service_role;
grant usage, select on sequence public.company_name_directory_id_seq to service_role;
create or replace function public.claim_company_name_search(
  p_normalized_query text,
  p_display_query text,
  p_lock_seconds integer default 45
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  acquired boolean := false;
begin
  insert into public.company_name_search_cache (
    normalized_query, display_query, status, results, expires_at, lock_until, updated_at
  ) values (
    p_normalized_query,
    p_display_query,
    'pending',
    '[]'::jsonb,
    now(),
    now() + make_interval(secs => greatest(10, least(coalesce(p_lock_seconds, 45), 90))),
    now()
  )
  on conflict (normalized_query) do update
  set display_query = excluded.display_query,
      status = 'pending',
      results = '[]'::jsonb,
      expires_at = now(),
      lock_until = excluded.lock_until,
      updated_at = now()
  where public.company_name_search_cache.expires_at <= now()
    and (
      public.company_name_search_cache.status <> 'pending'
      or public.company_name_search_cache.lock_until is null
      or public.company_name_search_cache.lock_until <= now()
    )
  returning true into acquired;
  return coalesce(acquired, false);
end;
$$;
revoke all on function public.claim_company_name_search(text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_company_name_search(text, text, integer) to service_role;;
