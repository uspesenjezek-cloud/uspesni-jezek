-- ==========================================================
-- Doda možnost prilog (slike/PDF-ji računa, do 6 na zadevo) k zadevi:
-- 1. Nov stolpec "racun_datoteke_poti" v tabeli "zadeve" - shrani SEZNAM
--    poti do datotek v Supabase Storage (ne samih datotek). To je
--    Postgres "array" tipa text - lahko vsebuje 0 do 6 poti hkrati.
-- 2. Nov Storage "bucket" (prostor za datoteke) "racuni-priloge" -
--    ZASEBEN (public = false), ker gre za občutljive podatke strank.
-- 3. RLS pravila na tem bucketu, da vsak obrtnik vidi/nalaga/briše
--    SAMO svoje datoteke - enaka logika kot na tabeli "zadeve".
--
-- KAKO POGNATI:
-- Enako kot prejšnji migraciji - Supabase nadzorna plošča ->
-- SQL Editor -> New query -> prilepi CELOTNO vsebino -> Run.
-- ==========================================================

-- 1. Nov stolpec za seznam poti do priloženih datotek (neobvezno polje,
-- privzeto prazen seznam). Omejitev na največ 6 poti se preveri v
-- aplikaciji (app.js) - "check" spodaj je dodatna varnostna mreža, če bi
-- kdo poskusil vstaviti podatke mimo aplikacije.
alter table public.zadeve
  add column racun_datoteke_poti text[] not null default '{}',
  add constraint zadeve_najvec_6_prilog check (
    array_length(racun_datoteke_poti, 1) is null
    or array_length(racun_datoteke_poti, 1) <= 6
  );

-- 2. Nov bucket za priloge računov.
-- - public = false: datotek ni mogoče odpreti kar tako s povezavo,
--   dostop je mogoč samo prek Supabase Auth (glej RLS spodaj).
-- - file_size_limit = 10 MB, allowed_mime_types omeji na slike in PDF -
--   dodatna varnostna plast poleg omejitev v aplikaciji.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'racuni-priloge',
  'racuni-priloge',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

-- 3. RLS na storage.objects - vsaka datoteka se shrani pod potjo
-- "<id_obrtnika>/ime-datoteke.pdf" (glej app.js), zato lahko dostop
-- omejimo tako, da mora biti prva mapa v poti enaka auth.uid().
create policy "Obrtnik nalozi svojo prilogo racuna"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'racuni-priloge'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Obrtnik vidi svojo prilogo racuna"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'racuni-priloge'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Obrtnik posodobi svojo prilogo racuna"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'racuni-priloge'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'racuni-priloge'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Obrtnik izbrise svojo prilogo racuna"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'racuni-priloge'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
