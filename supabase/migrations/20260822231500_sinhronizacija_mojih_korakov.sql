create table if not exists public.opomin_moji_koraki_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  koraki jsonb not null,
  client_id text,
  sync_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opomin_moji_koraki_sync enable row level security;

create policy "Uporabnik bere svoje moje korake"
  on public.opomin_moji_koraki_sync for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Uporabnik ustvari svoje moje korake"
  on public.opomin_moji_koraki_sync for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Uporabnik spremeni svoje moje korake"
  on public.opomin_moji_koraki_sync for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.opomin_moji_koraki_sync to authenticated;

create or replace function public.sinhroniziraj_moje_korake(
  p_koraki jsonb, p_client_id text, p_sync_updated_at timestamptz
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
  if p_koraki is null then
    raise exception 'Seznam mojih korakov je obvezen.' using errcode = '22004';
  end if;
  insert into public.opomin_moji_koraki_sync (
    user_id, koraki, client_id, sync_updated_at, updated_at
  ) values (
    (select auth.uid()), p_koraki, p_client_id, p_sync_updated_at, now()
  )
  on conflict (user_id) do update set
    koraki = excluded.koraki,
    client_id = excluded.client_id,
    sync_updated_at = excluded.sync_updated_at,
    updated_at = now()
  where excluded.sync_updated_at >= public.opomin_moji_koraki_sync.sync_updated_at;
end;
$$;

revoke all on function public.sinhroniziraj_moje_korake(
  jsonb, text, timestamptz
) from public, anon;
grant execute on function public.sinhroniziraj_moje_korake(
  jsonb, text, timestamptz
) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'opomin_moji_koraki_sync'
  ) then
    alter publication supabase_realtime add table public.opomin_moji_koraki_sync;
  end if;
end;
$$;
