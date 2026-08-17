-- Trajni profili nemških poslovnih strank in postopno naloženi OpenRegister Pro podatki.

create table public.boniteta_profili (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_key text not null,
  company_id text,
  legal_name text not null,
  register_number text,
  register_court text,
  company_status text,
  address jsonb not null default '{}'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  latest_check jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_key)
);

create table public.boniteta_pro_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.boniteta_profili(id) on delete cascade,
  section text not null check (section in (
    'company', 'financials', 'owners', 'holdings', 'ubo',
    'historical_owners', 'documents', 'insolvency'
  )),
  payload jsonb not null default '{}'::jsonb,
  credits_used integer not null default 0 check (credits_used >= 0),
  source_mode text not null default 'cached' check (source_mode in ('cached', 'realtime')),
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (profile_id, section)
);

create table public.boniteta_monitorji (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.boniteta_profili(id) on delete cascade,
  entity_id text not null,
  frequency text not null default 'weekly' check (frequency in ('weekly', 'daily')),
  preferences text[] not null default array['basic', 'insolvencies']::text[],
  disabled boolean not null default false,
  openregister_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entity_id)
);

create table public.boniteta_opozorila (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.boniteta_profili(id) on delete cascade,
  external_event_id text not null,
  category text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, external_event_id)
);

create index boniteta_profili_user_updated_idx on public.boniteta_profili (user_id, updated_at desc);
create index boniteta_pro_cache_profile_idx on public.boniteta_pro_cache (profile_id, fetched_at desc);
create index boniteta_monitorji_user_idx on public.boniteta_monitorji (user_id, updated_at desc);
create index boniteta_opozorila_user_idx on public.boniteta_opozorila (user_id, occurred_at desc);

alter table public.boniteta_profili enable row level security;
alter table public.boniteta_pro_cache enable row level security;
alter table public.boniteta_monitorji enable row level security;
alter table public.boniteta_opozorila enable row level security;

-- Dostop do plačljivih virov in njihovih rezultatov je samo prek preverjenih
-- strežniških funkcij. Odjemalec nikoli ne prejme service-role ali OpenRegister ključa.
revoke all on table public.boniteta_profili from public, anon, authenticated;
revoke all on table public.boniteta_pro_cache from public, anon, authenticated;
revoke all on table public.boniteta_monitorji from public, anon, authenticated;
revoke all on table public.boniteta_opozorila from public, anon, authenticated;
grant select, insert, update, delete on table public.boniteta_profili to service_role;
grant select, insert, update, delete on table public.boniteta_pro_cache to service_role;
grant select, insert, update, delete on table public.boniteta_monitorji to service_role;
grant select, insert, update, delete on table public.boniteta_opozorila to service_role;

comment on table public.boniteta_profili is 'Uporabnikovi trajni profili preverjenih nemških poslovnih strank.';
comment on table public.boniteta_pro_cache is 'Predpomnilnik ločenih, kreditno obračunanih OpenRegister Pro sklopov.';
comment on table public.boniteta_monitorji is 'OpenRegister API monitorji, ločeni od platformne Watchlist.';
comment on table public.boniteta_opozorila is 'Preverjena opozorila, prejeta prek podpisanih OpenRegister webhookov.';
