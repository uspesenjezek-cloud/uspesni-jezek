-- ==========================================================
-- Faza 2: Tabela "zadeve" (Opozarjanje na neplačila)
--
-- KAKO POGNATI:
-- 1. Odpri Supabase nadzorno ploščo svojega projekta.
-- 2. Levo v meniju izberi "SQL Editor" -> "New query".
-- 3. Prilepi CELOTNO vsebino te datoteke in klikni "Run".
-- 4. Po izvedbi preveri Database -> Table Editor -> tam bi
--    morala biti nova tabela "zadeve".
-- ==========================================================

-- Tabela: ena vrstica = ena neplačana zadeva enega obrtnika.
create table public.zadeve (
  id uuid primary key default gen_random_uuid(),
  -- Kdo je zadevo ustvaril. Privzeto se samodejno nastavi na
  -- trenutno prijavljenega uporabnika (auth.uid()), zato aplikaciji
  -- tega ni treba pošiljati ročno.
  obrtnik_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ime_dolznika text not null,
  znesek numeric not null,
  opis_dolga text,
  datum_zapadlosti date,
  status text not null default 'Nov' check (
    status in (
      'Nov',
      '1. opomin poslan',
      '2. opomin poslan',
      'Zadnji opomin poslan',
      'Predano odvetniku',
      'Rešeno'
    )
  ),
  ustvarjeno_at timestamptz not null default now(),
  posodobljeno_at timestamptz not null default now()
);

-- Pohitri poizvedbe, ki iščejo zadeve enega obrtnika.
create index zadeve_obrtnik_id_idx on public.zadeve (obrtnik_id);

-- Samodejno posodobi "posodobljeno_at", kadar se vrstica spremeni
-- (npr. ob napredovanju statusa), da ni treba tega ročno pošiljati
-- iz aplikacije.
create function public.posodobi_cas_posodobitve()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.posodobljeno_at = now();
  return new;
end;
$$;

create trigger zadeve_posodobi_cas
  before update on public.zadeve
  for each row
  execute function public.posodobi_cas_posodobitve();

-- ==========================================================
-- VARNOST: Row Level Security (RLS)
-- Brez tega bi lahko en obrtnik videl/urejal/brisal zadeve
-- VSEH ostalih obrtnikov - to je ključnega pomena!
-- ==========================================================
alter table public.zadeve enable row level security;

-- Obrtnik lahko vidi SAMO svoje zadeve.
create policy "Obrtnik vidi svoje zadeve"
on public.zadeve
for select
to authenticated
using ( (select auth.uid()) = obrtnik_id );

-- Obrtnik lahko doda SAMO zadevo, ki je last njemu.
create policy "Obrtnik doda svojo zadevo"
on public.zadeve
for insert
to authenticated
with check ( (select auth.uid()) = obrtnik_id );

-- Obrtnik lahko ureja (napreduje status ipd.) SAMO svoje zadeve.
create policy "Obrtnik ureja svoje zadeve"
on public.zadeve
for update
to authenticated
using ( (select auth.uid()) = obrtnik_id )
with check ( (select auth.uid()) = obrtnik_id );

-- Obrtnik lahko izbriše SAMO svoje zadeve.
create policy "Obrtnik brise svoje zadeve"
on public.zadeve
for delete
to authenticated
using ( (select auth.uid()) = obrtnik_id );

-- Zagotovi, da prijavljeni uporabniki sploh smejo dostopati do
-- tabele (RLS zgoraj potem dodatno omeji SAMO na njihove vrstice).
grant select, insert, update, delete on public.zadeve to authenticated;
