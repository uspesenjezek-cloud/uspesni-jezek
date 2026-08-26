-- Production readiness for current German tax law: an eligible small business
-- confirms the § 19 UStG turnover conditions, and every domestic business
-- confirms a reachable channel for structured incoming E-Rechnungen.

alter table public.pos_business_profiles
  add column small_business_eligibility_confirmed boolean not null default false,
  add column einvoice_receiving_confirmed boolean not null default false;

alter table public.pos_business_profiles
  drop constraint pos_business_profiles_confirmation_check;

alter table public.pos_business_profiles
  add constraint pos_business_profiles_confirmation_check
  check (
    not legal_confirmed or (
      trim(legal_name) <> ''
      and legal_form in (
        'Einzelunternehmen', 'e.K.', 'GbR', 'eGbR', 'OHG', 'KG',
        'GmbH & Co. KG', 'UG (haftungsbeschränkt)', 'GmbH', 'AG', 'eG'
      )
      and trim(representative) <> ''
      and (
        legal_form not in (
          'e.K.', 'eGbR', 'OHG', 'KG', 'GmbH & Co. KG',
          'UG (haftungsbeschränkt)', 'GmbH', 'AG', 'eG'
        )
        or (
          trim(company_seat) <> ''
          and trim(register_court) <> ''
          and trim(register_number) <> ''
        )
      )
      and trim(street) <> ''
      and postal_code ~ '^[0-9]{5}$'
      and trim(city) <> ''
      and (tax_number <> '' or vat_id <> '')
      and trim(account_holder) <> ''
      and private.pos_iban_valid(iban)
      and invoice_prefix ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
      and (tax_status <> 'small_business' or small_business_eligibility_confirmed)
      and trim(business_email) <> ''
      and einvoice_receiving_confirmed
    )
  ) not valid;

-- Keep previously confirmed rows untouched. PostgreSQL enforces this NOT VALID
-- constraint for every future insert/update; an existing profile must therefore
-- provide the new evidence the next time its owner changes or re-confirms it.

grant insert (small_business_eligibility_confirmed, einvoice_receiving_confirmed)
  on public.pos_business_profiles to authenticated;
grant update (small_business_eligibility_confirmed, einvoice_receiving_confirmed)
  on public.pos_business_profiles to authenticated;

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
    or new.company_seat is distinct from old.company_seat
    or new.register_court is distinct from old.register_court
    or new.register_number is distinct from old.register_number
    or new.street is distinct from old.street
    or new.postal_code is distinct from old.postal_code
    or new.city is distinct from old.city
    or new.business_email is distinct from old.business_email
    or new.business_phone is distinct from old.business_phone
    or new.tax_status is distinct from old.tax_status
    or new.tax_number is distinct from old.tax_number
    or new.vat_id is distinct from old.vat_id
    or new.previous_year_turnover_band is distinct from old.previous_year_turnover_band
    or new.small_business_eligibility_confirmed is distinct from old.small_business_eligibility_confirmed
    or new.einvoice_receiving_confirmed is distinct from old.einvoice_receiving_confirmed
    or new.account_holder is distinct from old.account_holder
    or new.iban is distinct from old.iban
  ) then
    new.legal_confirmed := false;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

;
