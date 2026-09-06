-- ==========================================================
-- sporocilo_predlogi: zapri prekomerne pravice UPDATE/DELETE.
--
-- STANJE PRED TO MIGRACIJO
-- ------------------------
-- 20260807140500_priporoceni_predlogi_in_brisanje.sql:33-37
--   policy "Obrtnik izbrise katerikoli predlog" ... for delete using (true)
-- 20260807142500_vrstni_red_predlogov.sql:23-28
--   policy "Obrtnik posodobi katerikoli predlog" ... for update using (true)
--   with check (true)
-- Vsak prijavljen uporabnik je torej lahko spremenil ali izbrisal predloge
-- VSEH ostalih uporabnikov in tudi sistemske ("priporocene") predloge.
--
-- ZAKAJ JE TO ZDAJ VARNO ZAPRETI
-- ------------------------------
-- Ta odprtost je bila takrat namerna, ker je stari app.js vrstni red urejal
-- z zamenjavo stolpca "vrstni_red" med dvema sosednjima vrsticama SKUPNE
-- knjiznice (glej commit 30f2a96, app/app.js: .from("sporocilo_predlogi")
-- .update({ vrstni_red: ... })). Ta koda ne obstaja vec: trenutni app.js
-- predloge in njihov vrstni red hrani v localStorage
-- (app/app.js:226 KLJUC_MOJI_PREDLOGI_OSNOVA,
--  app/app.js:228 KLJUC_PREDLOGI_NASTAVITVE_OSNOVA) in tabele
-- sporocilo_predlogi ne bere in ne pise. Zapiranje pravic zato ne odvzame
-- nobene delujoce funkcije - tudi urejanja vrstnega reda ne.
--
-- NOVA PRAVILA
-- ------------
-- SELECT: nespremenjeno - vsi prijavljeni vidijo vse predloge (skupna
--         knjiznica), vkljucno s sistemskimi.
-- INSERT: nespremenjeno - uporabnik lahko doda samo predlog, kjer je
--         dodal_obrtnik_id = auth.uid().
-- UPDATE: samo lastne vrstice (dodal_obrtnik_id = auth.uid()), in vrstica
--         mora ostati njegova.
-- DELETE: samo lastne vrstice.
-- Sistemski predlogi imajo dodal_obrtnik_id IS NULL (glej
-- 20260807131500_sporocilo_dolzniku_in_predlogi.sql:20-23 in zacetne
-- INSERT-e brez dodal_obrtnik_id). Ker "auth.uid() = NULL" ni nikoli true,
-- so ti predlogi skozi vlogo authenticated berljivi vsem in zapisljivi
-- nikomur. Spremeni jih lahko le koda, ki drzi service_role kljuc
-- (streznik ali Supabase nadzorna plosca).
--
-- POJASNILO: service_role NI administratorska pravica prijavljenega
-- uporabnika. V tej bazi vloge "administrator" ni - iskanje po migracijah
-- ne najde ne is_admin ne app_metadata ne vloge 'admin'. service_role je
-- privilegirana STREZNISKA vloga, ki obide RLS. Trditev "ureja jih samo
-- administrator" zato pomeni "ureja jih samo streznik"; pravega
-- administratorskega uporabnika v aplikaciji ni. Ce naj sistemske predloge
-- ureja dolocen prijavljen uporabnik, je treba uvesti vlogo in politiko
-- zanjo - to s to migracijo NI narejeno.
--
-- SKUPNO BRANJE je preverjeno in namerno (20260807131500:7-9, :19-21, :34-35):
-- vsi prijavljeni vidijo VSE predloge, tudi tiste, ki jih je dodal nekdo
-- drug. Ta migracija tega ne spreminja. Posledica, ki jo je vredno vedeti:
-- besedilo predloge, ki ga uporabnik vpise, vidijo vsi ostali uporabniki.
--
-- POZOR: migracija ceka na odobritev lastnika. NI vpisana v
-- POS_MIGRATION_MANIFEST (scripts/check-pos-migration-deployment.js) in ni
-- objavljena.
-- ==========================================================

drop policy if exists "Obrtnik posodobi katerikoli predlog" on public.sporocilo_predlogi;
drop policy if exists "Obrtnik izbrise katerikoli predlog" on public.sporocilo_predlogi;

-- Uporabnik lahko posodobi SAMO svoj predlog in ga ne more prepisati na
-- drugega lastnika (with check).
create policy "Obrtnik posodobi svoj predlog"
on public.sporocilo_predlogi
for update
to authenticated
using ( (select auth.uid()) is not null and (select auth.uid()) = dodal_obrtnik_id )
with check ( (select auth.uid()) is not null and (select auth.uid()) = dodal_obrtnik_id );

-- Uporabnik lahko izbrise SAMO svoj predlog.
create policy "Obrtnik izbrise svoj predlog"
on public.sporocilo_predlogi
for delete
to authenticated
using ( (select auth.uid()) is not null and (select auth.uid()) = dodal_obrtnik_id );

-- Anonimna vloga do te tabele nima nobene pravice.
revoke all on table public.sporocilo_predlogi from anon;

-- Vloga authenticated ohrani natanko tiste pravice, ki jih politike zgoraj
-- se dodatno omejijo na lastne vrstice.
grant select, insert, update, delete on table public.sporocilo_predlogi to authenticated;
grant all on table public.sporocilo_predlogi to service_role;

notify pgrst, 'reload schema';

-- ==========================================================
-- LOCENA UVELJAVITEV SAMO TE MIGRACIJE
-- ------------------------------------
-- Ta migracija je NEODVISNA od 18 drugih, ki cakajo v vrsti: dotika se samo
-- politik tabele public.sporocilo_predlogi in ne uvaja ne novih stolpcev ne
-- novih funkcij. Zato je ni treba uveljaviti skupaj z njimi.
--
-- Uveljavi jo lahko brez varovalke migracij, z neposrednim zagonom vsebine
-- te datoteke v Supabase SQL urejevalniku (Dashboard > SQL Editor).
-- Varovalka scripts/check-pos-migration-deployment.js je namenjena paketni
-- objavi cez CLI; ta migracija tja NI vpisana in tudi ne sme biti, dokler
-- lastnik ne odobri celotnega paketa.
--
-- PREVERJANJE PO IZVEDBI (zazeni v SQL urejevalniku):
--
--   select polname, polcmd, pg_get_expr(polqual, polrelid) as using_izraz
--   from pg_policy
--   where polrelid = 'public.sporocilo_predlogi'::regclass
--   order by polcmd, polname;
--
-- PRICAKOVANO PO USPESNI IZVEDBI:
--   - politiki "Obrtnik posodobi katerikoli predlog" in
--     "Obrtnik izbrise katerikoli predlog" NE obstajata vec,
--   - obstajata "Obrtnik posodobi svoj predlog" (polcmd = 'w') in
--     "Obrtnik izbrise svoj predlog" (polcmd = 'd'),
--   - njun using_izraz vsebuje "dodal_obrtnik_id", NE "true",
--   - politiki za SELECT in INSERT sta nespremenjeni.
--
-- FUNKCIONALNO PREVERJANJE z dvema racunoma (po uveljavitvi):
--   Kot uporabnik B poskusi update in delete nad predlogo, ki jo je dodal A.
--   Pricakovano: 0 prizadetih vrstic pri obeh. Predloga A ostane nespremenjena.
--   Kot A poskusi update in delete nad SVOJO predlogo. Pricakovano: uspe -
--   brez te kontrole rezultat zgoraj ne dokazuje nicesar.
--
-- POVRNITEV, ce bi kaj slo narobe: znova ustvari prvotni politiki iz
--   20260807140500_priporoceni_predlogi_in_brisanje.sql:33-37 in
--   20260807142500_vrstni_red_predlogov.sql:23-28.
-- ==========================================================
