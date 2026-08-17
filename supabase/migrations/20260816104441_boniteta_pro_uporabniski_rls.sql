-- Prijavljeni uporabnik lahko prek svojega JWT bere in spreminja samo lastne vrstice.
-- OpenRegister ključ ostane izključno v Vercel funkcijah.

drop policy if exists boniteta_profili_streznik_only on public.boniteta_profili;
drop policy if exists boniteta_pro_cache_streznik_only on public.boniteta_pro_cache;
drop policy if exists boniteta_monitorji_streznik_only on public.boniteta_monitorji;
drop policy if exists boniteta_opozorila_streznik_only on public.boniteta_opozorila;

grant select, insert, update, delete on table public.boniteta_profili to authenticated;
grant select, insert, update, delete on table public.boniteta_pro_cache to authenticated;
grant select, insert, update, delete on table public.boniteta_monitorji to authenticated;
grant select, insert, update, delete on table public.boniteta_opozorila to authenticated;

create policy boniteta_profili_lastnik on public.boniteta_profili
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy boniteta_pro_cache_lastnik on public.boniteta_pro_cache
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy boniteta_monitorji_lastnik on public.boniteta_monitorji
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy boniteta_opozorila_lastnik on public.boniteta_opozorila
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

;
