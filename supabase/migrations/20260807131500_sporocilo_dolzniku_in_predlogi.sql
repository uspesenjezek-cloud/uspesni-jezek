-- ==========================================================
-- Doda podporo za "Sporočilo dolžniku" - zadnji korak pri dodajanju
-- zadeve (glej app/neplacila-sporocilo.html):
-- 1. Nov stolpec "sporocilo_dolzniku" v tabeli "zadeve" - besedilo
--    sporočila, ki ga obrtnik napiše dolžniku (samo shranjeno, POŠILJANJE
--    pride v kasnejši fazi).
-- 2. Nova tabela "sporocilo_predlogi" - SKUPNA knjižnica vnaprej
--    pripravljenih besedil ("bublice"), ki jih vidijo VSI prijavljeni
--    obrtniki in lahko vanjo tudi sami dodajajo nove predloge.
-- ==========================================================

-- 1. Besedilo sporočila dolžniku (neobvezno polje).
alter table public.zadeve
  add column sporocilo_dolzniku text;

-- 2. Skupna knjižnica predlogov sporočil.
create table public.sporocilo_predlogi (
  id uuid primary key default gen_random_uuid(),
  besedilo text not null,
  -- Kdo je predlog dodal - samo za evidenco, ne omejuje vidnosti (vsi
  -- obrtniki vidijo VSE predloge, glej RLS spodaj). Pri privzetih 6
  -- predlogih (vstavljenih spodaj) je to polje prazno (NULL).
  dodal_obrtnik_id uuid references auth.users (id) on delete set null,
  ustvarjeno_at timestamptz not null default now()
);

alter table public.sporocilo_predlogi enable row level security;

-- Vsak prijavljen obrtnik vidi VSE predloge (skupna knjižnica, ne samo svoje).
create policy "Obrtniki vidijo vse predloge sporocil"
on public.sporocilo_predlogi
for select
to authenticated
using ( true );

-- Vsak prijavljen obrtnik lahko doda nov predlog - na voljo bo takoj tudi
-- vsem ostalim obrtnikom.
create policy "Obrtnik doda nov predlog sporocila"
on public.sporocilo_predlogi
for insert
to authenticated
with check ( (select auth.uid()) = dodal_obrtnik_id );

grant select, insert on public.sporocilo_predlogi to authenticated;

-- Začetnih 6 predlogov, na voljo takoj vsem obrtnikom.
insert into public.sporocilo_predlogi (besedilo) values
  ('Živjo, prosim da danes poravnate priloženi račun. Hvala za razumevanje!'),
  ('Pozdravljeni, opažam, da račun še ni poravnan. Prosim, da ga čim prej plačate.'),
  ('Pozdravljeni, gre za prijazen opomin, da je račun že zapadel. Hvala za hitro poravnavo.'),
  ('Živjo, verjetno ste pozabili na plačilo računa - prosim, da to čim prej uredite.'),
  ('Pozdravljeni, to je zadnji opomin pred nadaljnjimi koraki. Prosim, poravnajte račun v naslednjih dneh.'),
  ('Pozdravljeni, žal do sedaj nismo prejeli plačila. Če je prišlo do nesporazuma, prosim, javite se mi.');
