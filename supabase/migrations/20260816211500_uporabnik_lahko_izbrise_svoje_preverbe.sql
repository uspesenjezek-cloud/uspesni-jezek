-- Popoln izbris profila ne sme biti odvisen od service-role ključa v okolju.
-- Prijavljeni uporabnik sme prebrati in izbrisati samo svoja opravila, da lahko
-- strežnik prepozna pripadajoče rezultate in dokazne posnetke. Anon ostane brez
-- vseh pravic, druga dejanja nad tabelo pa še naprej zahtevajo service role.
grant select, delete on table public.mehka_boniteta_opravila to authenticated;

drop policy if exists "Uporabnik vidi svoja opravila mehke bonitete" on public.mehka_boniteta_opravila;
create policy "Uporabnik vidi svoja opravila mehke bonitete"
  on public.mehka_boniteta_opravila
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Uporabnik izbrise svoja opravila mehke bonitete" on public.mehka_boniteta_opravila;
create policy "Uporabnik izbrise svoja opravila mehke bonitete"
  on public.mehka_boniteta_opravila
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on table public.mehka_boniteta_opravila from anon;
