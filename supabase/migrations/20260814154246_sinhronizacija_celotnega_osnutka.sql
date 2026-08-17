create table if not exists public.opomin_osnutek_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  korak1 jsonb not null,
  korak2 jsonb not null,
  nacrt jsonb not null,
  client_id text,
  sync_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opomin_osnutek_sync enable row level security;

create policy "Uporabnik bere svoj opomin osnutek"
  on public.opomin_osnutek_sync for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Uporabnik ustvari svoj opomin osnutek"
  on public.opomin_osnutek_sync for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Uporabnik spremeni svoj opomin osnutek"
  on public.opomin_osnutek_sync for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.opomin_osnutek_sync to authenticated;

create or replace function public.sinhroniziraj_opomin_osnutek(
  p_korak1 jsonb, p_korak2 jsonb, p_nacrt jsonb,
  p_client_id text, p_sync_updated_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Prijava je obvezna.' using errcode = '42501';
  end if;
  if p_korak1 is null or p_korak2 is null or p_nacrt is null then
    raise exception 'Celoten osnutek je obvezen.' using errcode = '22004';
  end if;
  insert into public.opomin_osnutek_sync (
    user_id, korak1, korak2, nacrt, client_id, sync_updated_at, updated_at
  ) values (
    (select auth.uid()), p_korak1, p_korak2, p_nacrt,
    p_client_id, p_sync_updated_at, now()
  )
  on conflict (user_id) do update set
    korak1 = excluded.korak1,
    korak2 = excluded.korak2,
    nacrt = excluded.nacrt,
    client_id = excluded.client_id,
    sync_updated_at = excluded.sync_updated_at,
    updated_at = now()
  where excluded.sync_updated_at >= public.opomin_osnutek_sync.sync_updated_at;
end;
$$;

revoke all on function public.sinhroniziraj_opomin_osnutek(
  jsonb, jsonb, jsonb, text, timestamptz
) from public, anon;
grant execute on function public.sinhroniziraj_opomin_osnutek(
  jsonb, jsonb, jsonb, text, timestamptz
) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'opomin_osnutek_sync'
  ) then
    alter publication supabase_realtime add table public.opomin_osnutek_sync;
  end if;
end;
$$;;
