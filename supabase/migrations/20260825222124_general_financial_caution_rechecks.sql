alter table public.boniteta_ponovne_preverbe
  drop constraint if exists boniteta_ponovne_preverbe_reason_check;

update public.boniteta_ponovne_preverbe
set reason = 'financial_caution',
    updated_at = now()
where reason = 'equity_decline_material';

alter table public.boniteta_ponovne_preverbe
  add constraint boniteta_ponovne_preverbe_reason_check
  check (reason in ('financial_caution'));
