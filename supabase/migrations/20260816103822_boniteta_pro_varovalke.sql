-- Izrecna zaščita odjemalca in indeksi za profile z veliko zgodovine.

create index boniteta_pro_cache_user_idx on public.boniteta_pro_cache (user_id);
create index boniteta_monitorji_profile_idx on public.boniteta_monitorji (profile_id);
create index boniteta_opozorila_profile_idx on public.boniteta_opozorila (profile_id);

create policy boniteta_profili_streznik_only on public.boniteta_profili
  for all to authenticated using (false) with check (false);
create policy boniteta_pro_cache_streznik_only on public.boniteta_pro_cache
  for all to authenticated using (false) with check (false);
create policy boniteta_monitorji_streznik_only on public.boniteta_monitorji
  for all to authenticated using (false) with check (false);
create policy boniteta_opozorila_streznik_only on public.boniteta_opozorila
  for all to authenticated using (false) with check (false);

;
