-- Napoved prometa za delovne naloge (SI + DE).
-- Zbiralnik vsakih 15 min zapiše zajem vira in opazovane zastoje po
-- ~2 km celicah; nočni izračun iz zadnjih 56 dni zgradi profil
-- (vir, celica, tip dneva, 15-min interval) -> mediana / p85 zamude.
-- Tabele so samo za strežnik (service role); brskalnik jih ne bere neposredno.

create table if not exists public.promet_zajem (
  id bigint generated always as identity primary key,
  vir text not null check (vir in ('autobahn', 'dars')),
  cas timestamptz not null,
  uspeh boolean not null,
  pokritost integer not null default 0,
  skupaj integer not null default 0,
  st_opazovanj integer not null default 0,
  napake jsonb not null default '[]'::jsonb,
  ustvarjeno timestamptz not null default now()
);
create index if not exists promet_zajem_vir_cas_idx on public.promet_zajem (vir, cas desc);

create table if not exists public.promet_opazovanje (
  id bigint generated always as identity primary key,
  zajem_id bigint not null references public.promet_zajem (id) on delete cascade,
  vir text not null,
  celica text not null,
  cesta text,
  zamuda_s integer,
  hitrost_kmh real,
  zunanji_id text
);
create index if not exists promet_opazovanje_zajem_idx on public.promet_opazovanje (zajem_id);

create table if not exists public.promet_dogodek (
  vir text not null,
  zunanji_id text not null,
  tip text not null check (tip in ('dela', 'zapora')),
  cesta text,
  naslov text,
  opis text,
  zacetek timestamptz,
  zaprto boolean not null default false,
  tocke jsonb not null default '[]'::jsonb,
  prvic_videno timestamptz not null default now(),
  zadnjic_videno timestamptz not null default now(),
  primary key (vir, zunanji_id)
);
create index if not exists promet_dogodek_zadnjic_idx on public.promet_dogodek (zadnjic_videno desc);

create table if not exists public.promet_profil (
  vir text not null,
  celica text not null,
  tip_dneva text not null check (tip_dneva in ('delavnik', 'petek', 'sobota', 'nedelja_praznik', 'pocitnice_delavnik')),
  interval smallint not null check (interval between 0 and 95),
  n_vzorcev integer not null,
  p_zastoja real not null,
  mediana_s integer not null,
  p85_s integer not null,
  verzija smallint not null,
  izracunano timestamptz not null default now(),
  primary key (vir, celica, tip_dneva, interval)
);

create table if not exists public.promet_pokritost (
  vir text not null,
  tip_dneva text not null,
  interval smallint not null check (interval between 0 and 95),
  n_vzorcev integer not null,
  izracunano timestamptz not null default now(),
  primary key (vir, tip_dneva, interval)
);

alter table public.promet_zajem enable row level security;
alter table public.promet_opazovanje enable row level security;
alter table public.promet_dogodek enable row level security;
alter table public.promet_profil enable row level security;
alter table public.promet_pokritost enable row level security;
revoke all on public.promet_zajem, public.promet_opazovanje, public.promet_dogodek,
  public.promet_profil, public.promet_pokritost from anon, authenticated;

-- Atomarna zamenjava profila: napoved nikoli ne bere pol starega in pol novega.
create or replace function public.promet_zamenjaj_profil(p_vrstice jsonb, p_pokritost jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.promet_profil where true;
  delete from public.promet_pokritost where true;
  insert into public.promet_profil (vir, celica, tip_dneva, interval, n_vzorcev, p_zastoja, mediana_s, p85_s, verzija)
  select r.vir, r.celica, r.tip_dneva, r.interval, r.n_vzorcev, r.p_zastoja, r.mediana_s, r.p85_s, r.verzija
  from jsonb_to_recordset(coalesce(p_vrstice, '[]'::jsonb)) as r(
    vir text, celica text, tip_dneva text, interval smallint, n_vzorcev integer,
    p_zastoja real, mediana_s integer, p85_s integer, verzija smallint);
  insert into public.promet_pokritost (vir, tip_dneva, interval, n_vzorcev)
  select r.vir, r.tip_dneva, r.interval, r.n_vzorcev
  from jsonb_to_recordset(coalesce(p_pokritost, '[]'::jsonb)) as r(
    vir text, tip_dneva text, interval smallint, n_vzorcev integer);
end;
$$;

-- Hramba surovih opazovanj je omejena (56 dni), da baza ostane majhna.
create or replace function public.promet_pocisti(p_dni integer default 56)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.promet_zajem where cas < now() - make_interval(days => greatest(p_dni, 14));
  delete from public.promet_dogodek where zadnjic_videno < now() - interval '3 days';
$$;

revoke all on function public.promet_zamenjaj_profil(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.promet_pocisti(integer) from public, anon, authenticated;
grant execute on function public.promet_zamenjaj_profil(jsonb, jsonb) to service_role;
grant execute on function public.promet_pocisti(integer) to service_role;
