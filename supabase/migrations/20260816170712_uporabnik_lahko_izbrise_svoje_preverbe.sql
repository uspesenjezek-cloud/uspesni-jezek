
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
;
