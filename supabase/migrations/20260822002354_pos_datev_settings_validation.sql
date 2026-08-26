-- DATEV preferences are directly writable through the profile Data API. Keep
-- incomplete defaults valid, but reject oversized JSON, nested values and
-- malformed identifiers/accounts that a modified client could persist.

create or replace function private.pos_datev_settings_valid(p_settings jsonb)
returns boolean
language plpgsql
security invoker
immutable
set search_path = ''
as $$
declare
  v_key text;
begin
  if p_settings is null or jsonb_typeof(p_settings) <> 'object'
     or octet_length(p_settings::text) > 16384 then
    return false;
  end if;

  if p_settings ? 'framework' and (
       jsonb_typeof(p_settings->'framework') <> 'string'
       or p_settings->>'framework' not in ('03', '04')
     ) then return false; end if;

  foreach v_key in array array['adviserNumber', 'adviser_number'] loop
    if p_settings ? v_key and (
         jsonb_typeof(p_settings -> v_key) <> 'string'
         or p_settings->>v_key !~ '^[0-9]{0,7}$'
       ) then return false; end if;
  end loop;
  foreach v_key in array array['clientNumber', 'client_number'] loop
    if p_settings ? v_key and (
         jsonb_typeof(p_settings -> v_key) <> 'string'
         or p_settings->>v_key !~ '^[0-9]{0,5}$'
       ) then return false; end if;
  end loop;
  foreach v_key in array array['fiscalYearStart', 'fiscal_year_start'] loop
    if p_settings ? v_key and (
         jsonb_typeof(p_settings -> v_key) <> 'string'
         or p_settings->>v_key !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
       ) then return false; end if;
  end loop;
  foreach v_key in array array['accountLength', 'account_length'] loop
    if p_settings ? v_key and (
         jsonb_typeof(p_settings -> v_key) not in ('string', 'number')
         or p_settings->>v_key !~ '^[4-8]$'
       ) then return false; end if;
  end loop;

  if p_settings ? 'initials' and (
       jsonb_typeof(p_settings->'initials') <> 'string'
       or p_settings->>'initials' !~ '^[A-Za-z]{0,4}$'
     ) then return false; end if;

  foreach v_key in array array[
    'receivableAccount', 'receivable_account',
    'revenue19Account', 'revenue_19_account',
    'revenue7Account', 'revenue_7_account',
    'smallBusinessAccount', 'small_business_account',
    'reverseChargeAccount', 'reverse_charge_account'
  ] loop
    if p_settings ? v_key and (
         jsonb_typeof(p_settings -> v_key) <> 'string'
         or p_settings->>v_key !~ '^[0-9]{0,9}$'
       ) then return false; end if;
  end loop;

  if p_settings ? 'confirmed' and jsonb_typeof(p_settings->'confirmed') <> 'boolean' then
    return false;
  end if;
  return true;
end;
$$;

alter table public.pos_business_profiles
  add constraint pos_business_profiles_datev_settings_values_check
  check (private.pos_datev_settings_valid(datev_settings)) not valid;
alter table public.pos_business_profiles
  validate constraint pos_business_profiles_datev_settings_values_check;

revoke all on function private.pos_datev_settings_valid(jsonb) from public, anon;
grant execute on function private.pos_datev_settings_valid(jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';

;
