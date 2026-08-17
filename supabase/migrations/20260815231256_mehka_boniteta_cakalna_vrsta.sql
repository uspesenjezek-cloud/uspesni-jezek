-- Trajna čakalna vrsta za nemško mehko bonitetno preverbo.
-- Največ dve opravili se obdelujeta hkrati; prevzem je atomaren in uporablja
-- FOR UPDATE SKIP LOCKED, zato več Vercel funkcij ne more prevzeti iste vrstice.

create table if not exists public.mehka_boniteta_opravila (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  faza text not null check (faza in ('identiteta', 'insolvenca')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  cache_key text not null,
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  claim_token uuid,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.mehka_boniteta_opravila enable row level security;

-- Dostop je samo prek strežniških API funkcij s service_role. S tem rezultat
-- enega uporabnika nikoli ni neposredno viden drugemu uporabniku.
revoke all on table public.mehka_boniteta_opravila from anon, authenticated;
grant select, insert, update, delete on table public.mehka_boniteta_opravila to service_role;

create index if not exists mehka_boniteta_opravila_uporabnik_idx
  on public.mehka_boniteta_opravila (user_id, created_at desc);

create index if not exists mehka_boniteta_opravila_cakalna_idx
  on public.mehka_boniteta_opravila (available_at, created_at)
  where status = 'queued';

create index if not exists mehka_boniteta_opravila_aktivna_idx
  on public.mehka_boniteta_opravila (lease_until)
  where status = 'processing';

create index if not exists mehka_boniteta_opravila_cache_idx
  on public.mehka_boniteta_opravila (cache_key, finished_at desc)
  where status = 'completed';

create or replace function public.prevzemi_mehka_boniteta_opravila(
  p_limit integer default 2,
  p_lease_seconds integer default 75
)
returns setof public.mehka_boniteta_opravila
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 1), 1), 2);
  v_lease_seconds integer := least(greatest(coalesce(p_lease_seconds, 75), 30), 180);
  v_prosta_mesta integer;
begin
  -- Po prekoračitvi lease se opravilo varno vrne v vrsto. Zunanji HTTP klici
  -- se izvajajo šele po tej kratki transakciji, zato vrstic ne zaklepamo dolgo.
  update public.mehka_boniteta_opravila
     set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
         available_at = case
           when attempts >= max_attempts then available_at
           else now() + make_interval(secs => least(120, 10 * (2 ^ greatest(attempts - 1, 0))::integer))
         end,
         lease_until = null,
         claim_token = null,
         last_error = coalesce(last_error, 'Čas obdelave je potekel.'),
         finished_at = case when attempts >= max_attempts then now() else finished_at end,
         updated_at = now()
   where status = 'processing'
     and lease_until < now();

  select greatest(0, 2 - count(*))::integer
    into v_prosta_mesta
    from public.mehka_boniteta_opravila
   where status = 'processing'
     and lease_until >= now();

  return query
  with kandidati as (
    select id
      from public.mehka_boniteta_opravila
     where status = 'queued'
       and available_at <= now()
     order by created_at
     limit least(v_limit, v_prosta_mesta)
     for update skip locked
  )
  update public.mehka_boniteta_opravila o
     set status = 'processing',
         attempts = o.attempts + 1,
         started_at = coalesce(o.started_at, now()),
         lease_until = now() + make_interval(secs => v_lease_seconds),
         claim_token = gen_random_uuid(),
         updated_at = now()
    from kandidati k
   where o.id = k.id
  returning o.*;
end;
$$;

create or replace function public.zakljuci_mehka_boniteta_opravilo(
  p_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_result jsonb default null,
  p_error text default null,
  p_retryable boolean default false
)
returns public.mehka_boniteta_opravila
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.mehka_boniteta_opravila;
begin
  update public.mehka_boniteta_opravila
     set status = case
           when p_success then 'completed'
           when p_retryable and attempts < max_attempts then 'queued'
           else 'failed'
         end,
         result_payload = coalesce(p_result, result_payload),
         last_error = left(nullif(p_error, ''), 500),
         available_at = case
           when not p_success and p_retryable and attempts < max_attempts
             then now() + make_interval(secs => least(120, 10 * (2 ^ greatest(attempts - 1, 0))::integer))
           else available_at
         end,
         lease_until = null,
         claim_token = null,
         finished_at = case
           when p_success or not p_retryable or attempts >= max_attempts then now()
           else null
         end,
         updated_at = now()
   where id = p_id
     and status = 'processing'
     and claim_token = p_claim_token
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Opravilo ni več v lasti tega delavca.' using errcode = 'P0001';
  end if;
  return v_row;
end;
$$;

revoke all on function public.prevzemi_mehka_boniteta_opravila(integer, integer) from public, anon, authenticated;
revoke all on function public.zakljuci_mehka_boniteta_opravilo(uuid, uuid, boolean, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function public.prevzemi_mehka_boniteta_opravila(integer, integer) to service_role;
grant execute on function public.zakljuci_mehka_boniteta_opravilo(uuid, uuid, boolean, jsonb, text, boolean) to service_role;

comment on table public.mehka_boniteta_opravila is
  'Trajna, strežniško dostopna čakalna vrsta za nemške mehke bonitetne preverbe.';
