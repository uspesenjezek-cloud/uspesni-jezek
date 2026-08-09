-- ==========================================================
-- TRR računi obrtnika (za dodatek »Podatki za nakazilo« v koraku 2)
--
-- KAKO POGNATI:
-- 1. Odpri Supabase → SQL Editor → New query.
-- 2. Prilepi CELOTNO vsebino in klikni Run.
-- ==========================================================

create table if not exists public.trr_racuni (
  id uuid primary key default gen_random_uuid(),
  obrtnik_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ime text not null,
  naziv_podjetja text not null,
  iban text not null,
  je_privzet boolean not null default false,
  ustvarjeno_at timestamptz not null default now()
);

create index if not exists trr_racuni_obrtnik_id_idx
  on public.trr_racuni (obrtnik_id);

alter table public.trr_racuni enable row level security;

create policy "Obrtnik vidi svoje TRR racune"
on public.trr_racuni
for select
to authenticated
using ( (select auth.uid()) = obrtnik_id );

create policy "Obrtnik doda svoj TRR racun"
on public.trr_racuni
for insert
to authenticated
with check ( (select auth.uid()) = obrtnik_id );

create policy "Obrtnik ureja svoj TRR racun"
on public.trr_racuni
for update
to authenticated
using ( (select auth.uid()) = obrtnik_id )
with check ( (select auth.uid()) = obrtnik_id );

create policy "Obrtnik brise svoj TRR racun"
on public.trr_racuni
for delete
to authenticated
using ( (select auth.uid()) = obrtnik_id );

grant select, insert, update, delete on public.trr_racuni to authenticated;
