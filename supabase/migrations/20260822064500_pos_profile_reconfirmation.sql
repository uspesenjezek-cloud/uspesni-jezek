-- A legal confirmation applies to the exact seller, tax, contact and payment
-- data that the user reviewed. Editing any of those fields must return the
-- profile to Testbetrieb until the changed values are confirmed again.

create or replace function private.pos_reset_profile_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.legal_confirmed and (
    new.legal_name is distinct from old.legal_name
    or new.legal_form is distinct from old.legal_form
    or new.representative is distinct from old.representative
    or new.street is distinct from old.street
    or new.postal_code is distinct from old.postal_code
    or new.city is distinct from old.city
    or new.business_email is distinct from old.business_email
    or new.business_phone is distinct from old.business_phone
    or new.tax_status is distinct from old.tax_status
    or new.tax_number is distinct from old.tax_number
    or new.vat_id is distinct from old.vat_id
    or new.previous_year_turnover_band is distinct from old.previous_year_turnover_band
    or new.account_holder is distinct from old.account_holder
    or new.iban is distinct from old.iban
  ) then
    new.legal_confirmed := false;
  end if;
  return new;
end;
$$;

revoke all on function private.pos_reset_profile_confirmation() from public, anon, authenticated;
grant execute on function private.pos_reset_profile_confirmation() to service_role;

create trigger pos_business_profiles_reset_confirmation
before update on public.pos_business_profiles
for each row execute function private.pos_reset_profile_confirmation();
