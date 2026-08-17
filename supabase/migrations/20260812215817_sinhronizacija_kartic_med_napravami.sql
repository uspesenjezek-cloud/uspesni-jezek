-- Med napravami se sinhronizira samo nastavitev vidnih kartic.
-- Osebni podatki, zneski in besedila opominov ostanejo v lokalni seji.
create table public.opomin_kartice_nastavitve (
  user_id uuid primary key references auth.users (id) on delete cascade,
  vkljuceni_indeksi smallint[] not null default array[1,10]::smallint[],
  client_id text,
  settings_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opomin_kartice_veljavni_indeksi check (
    vkljuceni_indeksi <@ array[1,2,3,4,5,6,7,8,9,10]::smallint[]
    and array_position(vkljuceni_indeksi, 1::smallint) is not null
    and array_position(vkljuceni_indeksi, 10::smallint) is not null
  )
);

alter table public.opomin_kartice_nastavitve enable row level security;

create policy "Uporabnik vidi svoje nastavitve kartic"
on public.opomin_kartice_nastavitve for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Uporabnik ustvari svoje nastavitve kartic"
on public.opomin_kartice_nastavitve for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Uporabnik posodobi svoje nastavitve kartic"
on public.opomin_kartice_nastavitve for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.opomin_kartice_nastavitve to authenticated;

alter publication supabase_realtime add table public.opomin_kartice_nastavitve;
