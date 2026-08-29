alter table public.boniteta_ponovne_preverbe
  drop constraint boniteta_ponovne_preverbe_interval_days_check;

alter table public.boniteta_ponovne_preverbe
  add constraint boniteta_ponovne_preverbe_interval_days_check
  check (interval_days between 1 and 365);
