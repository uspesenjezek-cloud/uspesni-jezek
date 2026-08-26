-- DATEV Buchungsstapel preferences are tenant-owned accounting metadata.
-- Existing row ownership remains protected by the profile table's RLS policies.

alter table public.pos_business_profiles
  add column datev_settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(datev_settings) = 'object');
comment on column public.pos_business_profiles.datev_settings is
  'User-confirmed DATEV EXTF configuration (SKR, adviser/client numbers and account mapping).';
