-- Rezultat mehke preverbe je zaseben uporabniški podatek. Poizvedbe za svež
-- rezultat so zato vedno omejene z user_id; ta indeks ohrani hiter dostop.
create index if not exists mehka_boniteta_opravila_user_cache_idx
  on public.mehka_boniteta_opravila (user_id, cache_key, finished_at desc)
  where status = 'completed' and result_payload is not null;
