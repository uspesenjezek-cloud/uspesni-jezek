-- Dolžnikova registrska identiteta uporablja izključno OpenRegister iskanje,
-- ki porabi največ en kredit. Podrobni 10-kreditni profili niso del tega toka.

alter table public.zadeve
  add column if not exists vrsta_dolznika text not null default 'podjetje'
    check (vrsta_dolznika in ('podjetje', 'fizicna_oseba')),
  add column if not exists openregister_company_id text,
  add column if not exists register_type text,
  add column if not exists register_number text,
  add column if not exists register_court text,
  add column if not exists legal_form text,
  add column if not exists davcna_stevilka text,
  add column if not exists kontaktna_oseba text,
  add column if not exists podjetje_preverjeno_at timestamptz;

create index if not exists zadeve_user_company_status_idx
  on public.zadeve (user_id, openregister_company_id, status)
  where openregister_company_id is not null;

create table if not exists public.dolznik_podjetja (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.boniteta_profili(id) on delete set null,
  company_id text not null,
  legal_name text not null,
  register_type text,
  register_number text,
  register_court text,
  legal_form text,
  company_status text,
  checked_at timestamptz,
  next_check_at timestamptz not null default (now() + interval '30 days'),
  last_credits_used smallint not null default 0 check (last_credits_used between 0 and 1),
  disabled boolean not null default true,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id),
  check (btrim(company_id) <> ''),
  check (btrim(legal_name) <> '')
);

create index if not exists dolznik_podjetja_user_name_idx
  on public.dolznik_podjetja (user_id, legal_name);
create index if not exists dolznik_podjetja_due_idx
  on public.dolznik_podjetja (next_check_at)
  where disabled = false;

alter table public.dolznik_podjetja enable row level security;
revoke all on table public.dolznik_podjetja from public, anon, authenticated;
grant select on table public.dolznik_podjetja to authenticated;
grant select, insert, update on table public.dolznik_podjetja to service_role;

create policy "Uporabnik bere svoja dolznik podjetja"
  on public.dolznik_podjetja for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Uporabnik ustvari svoja dolznik podjetja"
  on public.dolznik_podjetja for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Uporabnik posodobi svoja dolznik podjetja"
  on public.dolznik_podjetja for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.openregister_identity_search_cache (
  normalized_query text primary key,
  display_query text not null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  results jsonb not null default '[]'::jsonb check (jsonb_typeof(results) = 'array'),
  searched_at timestamptz,
  expires_at timestamptz not null default now(),
  lock_until timestamptz,
  updated_at timestamptz not null default now(),
  check (btrim(normalized_query) <> '')
);

alter table public.openregister_identity_search_cache enable row level security;
revoke all on table public.openregister_identity_search_cache from public, anon, authenticated;
grant select, insert, update on table public.openregister_identity_search_cache to service_role;

create or replace function public.claim_openregister_identity_search(
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
  insert into public.openregister_identity_search_cache (
    normalized_query, display_query, status, results, expires_at, lock_until, updated_at
  ) values (
    p_normalized_query, p_display_query, 'pending', '[]'::jsonb, now(),
    now() + make_interval(secs => greatest(10, least(coalesce(p_lock_seconds, 45), 90))), now()
  )
  on conflict (normalized_query) do update
  set display_query = excluded.display_query,
      status = 'pending',
      results = '[]'::jsonb,
      expires_at = now(),
      lock_until = excluded.lock_until,
      updated_at = now()
  where public.openregister_identity_search_cache.expires_at <= now()
    and (
      public.openregister_identity_search_cache.status <> 'pending'
      or public.openregister_identity_search_cache.lock_until is null
      or public.openregister_identity_search_cache.lock_until <= now()
    )
  returning true into acquired;
  return coalesce(acquired, false);
end;
$$;

create or replace function public.claim_due_debtor_company_refresh(p_lease_seconds integer default 75)
returns public.dolznik_podjetja
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed public.dolznik_podjetja;
begin
  update public.dolznik_podjetja d
     set disabled = true, updated_at = now()
   where d.disabled = false
     and not exists (
       select 1 from public.zadeve z
        where z.user_id = d.user_id
          and z.openregister_company_id = d.company_id
          and z.status <> 'Rešeno'
     );

  select * into claimed
    from public.dolznik_podjetja d
   where d.disabled = false
     and d.next_check_at <= now()
     and (d.lease_until is null or d.lease_until <= now())
     and exists (
       select 1 from public.zadeve z
        where z.user_id = d.user_id
          and z.openregister_company_id = d.company_id
          and z.status <> 'Rešeno'
     )
   order by d.next_check_at, d.id
   for update skip locked
   limit 1;

  if claimed.id is null then return null; end if;
  update public.dolznik_podjetja
     set lease_until = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 75), 180))),
         updated_at = now()
   where id = claimed.id
   returning * into claimed;
  return claimed;
end;
$$;

create or replace function public.finish_debtor_company_refresh(
  p_id uuid,
  p_success boolean,
  p_company jsonb,
  p_credits_used integer,
  p_error text default null
)
returns public.dolznik_podjetja
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated public.dolznik_podjetja;
begin
  if coalesce(p_credits_used, 0) not between 0 and 1 then
    raise exception 'Debtor company refresh may use at most one credit';
  end if;
  update public.dolznik_podjetja
     set legal_name = case when p_success then coalesce(nullif(btrim(p_company->>'name'), ''), legal_name) else legal_name end,
         register_type = case when p_success then coalesce(nullif(btrim(p_company->>'register_type'), ''), register_type) else register_type end,
         register_number = case when p_success then coalesce(nullif(btrim(p_company->>'register_number'), ''), register_number) else register_number end,
         register_court = case when p_success then coalesce(nullif(btrim(p_company->>'register_court'), ''), register_court) else register_court end,
         legal_form = case when p_success then coalesce(nullif(btrim(p_company->>'legal_form'), ''), legal_form) else legal_form end,
         company_status = case when p_success then case when lower(coalesce(p_company->>'active', 'true')) = 'false' then 'inactive' else 'active' end else company_status end,
         checked_at = case when p_success then now() else checked_at end,
         next_check_at = now() + interval '30 days',
         last_credits_used = coalesce(p_credits_used, 0),
         lease_until = null,
         last_error = case when p_success then null else left(coalesce(p_error, 'Preverjanje ni uspelo.'), 500) end,
         updated_at = now()
   where id = p_id
   returning * into updated;
  return updated;
end;
$$;

create or replace function public.sync_debtor_company_monitor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nullif(btrim(new.openregister_company_id), '') is not null then
    insert into public.dolznik_podjetja (
      user_id, company_id, legal_name, register_type, register_number, register_court,
      legal_form, checked_at, next_check_at, disabled, updated_at
    ) values (
      new.user_id, new.openregister_company_id, new.ime_dolznika,
      new.register_type, new.register_number, new.register_court, new.legal_form,
      new.podjetje_preverjeno_at, coalesce(new.podjetje_preverjeno_at, now()) + interval '30 days',
      new.status = 'Rešeno', now()
    )
    on conflict (user_id, company_id) do update
      set legal_name = excluded.legal_name,
          register_type = coalesce(excluded.register_type, public.dolznik_podjetja.register_type),
          register_number = coalesce(excluded.register_number, public.dolznik_podjetja.register_number),
          register_court = coalesce(excluded.register_court, public.dolznik_podjetja.register_court),
          legal_form = coalesce(excluded.legal_form, public.dolznik_podjetja.legal_form),
          checked_at = coalesce(excluded.checked_at, public.dolznik_podjetja.checked_at),
          disabled = not exists (
            select 1 from public.zadeve z
             where z.user_id = excluded.user_id
               and z.openregister_company_id = excluded.company_id
               and z.status <> 'Rešeno'
          ),
          updated_at = now();
  end if;

  if tg_op = 'UPDATE' and old.openregister_company_id is not null then
    update public.dolznik_podjetja d
       set disabled = not exists (
         select 1 from public.zadeve z
          where z.user_id = d.user_id
            and z.openregister_company_id = d.company_id
            and z.status <> 'Rešeno'
            and z.id <> new.id
       ) and (new.status = 'Rešeno' or new.openregister_company_id is distinct from old.openregister_company_id),
           updated_at = now()
     where d.user_id = old.user_id and d.company_id = old.openregister_company_id;
  end if;
  return new;
end;
$$;

drop trigger if exists zadeve_sync_debtor_company_monitor on public.zadeve;
create trigger zadeve_sync_debtor_company_monitor
after insert or update of status, openregister_company_id, ime_dolznika on public.zadeve
for each row execute function public.sync_debtor_company_monitor();

revoke all on function public.claim_openregister_identity_search(text, text, integer) from public, anon, authenticated;
revoke all on function public.claim_due_debtor_company_refresh(integer) from public, anon, authenticated;
revoke all on function public.finish_debtor_company_refresh(uuid, boolean, jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.claim_openregister_identity_search(text, text, integer) to service_role;
grant execute on function public.claim_due_debtor_company_refresh(integer) to service_role;
grant execute on function public.finish_debtor_company_refresh(uuid, boolean, jsonb, integer, text) to service_role;

do $$
declare
  existing_job bigint;
begin
  for existing_job in select jobid from cron.job where jobname = 'uj-debtor-company-identity-heartbeat'
  loop
    perform cron.unschedule(existing_job);
  end loop;
end;
$$;

select cron.schedule(
  'uj-debtor-company-identity-heartbeat',
  '* * * * *',
  $job$
    with settings as (
      select
        (select decrypted_secret from vault.decrypted_secrets where name = 'uspesni_jezek_app_url' limit 1) as app_url,
        (select decrypted_secret from vault.decrypted_secrets where name = 'uspesni_jezek_cron_secret' limit 1) as cron_secret
    )
    select net.http_post(
      url := rtrim(settings.app_url, '/') || '/api/mehka-boniteta-delavec',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || settings.cron_secret
      ),
      body := jsonb_build_object('source', 'debtor-company-identity-heartbeat'),
      timeout_milliseconds := 30000
    ) as request_id
    from settings
    where settings.app_url ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$'
      and length(settings.cron_secret) >= 16
      and exists (
        select 1 from public.dolznik_podjetja d
         where d.disabled = false
           and d.next_check_at <= now()
           and (d.lease_until is null or d.lease_until <= now())
           and exists (
             select 1 from public.zadeve z
              where z.user_id = d.user_id
                and z.openregister_company_id = d.company_id
                and z.status <> 'Rešeno'
           )
      )
  $job$
);
