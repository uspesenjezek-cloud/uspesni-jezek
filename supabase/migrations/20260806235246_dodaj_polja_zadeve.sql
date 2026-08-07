-- ==========================================================
-- Doda manjkajoča polja k obstoječi tabeli "zadeve":
-- telefon in e-pošta dolžnika, datum izdaje računa, številka računa.
-- Uporabila jih bo Faza 3 (samodejno pošiljanje opominov).
--
-- KAKO POGNATI:
-- Enako kot prejšnjo migracijo - Supabase nadzorna plošča ->
-- SQL Editor -> New query -> prilepi CELOTNO vsebino -> Run.
--
-- Ta migracija SAMO dodaja nove stolpce - ne spreminja obstoječih
-- stolpcev, podatkov ali RLS politik.
-- ==========================================================

alter table public.zadeve
  add column telefon_dolznika text,
  add column email_dolznika text,
  add column datum_izdaje_racuna date,
  add column stevilka_racuna text;
