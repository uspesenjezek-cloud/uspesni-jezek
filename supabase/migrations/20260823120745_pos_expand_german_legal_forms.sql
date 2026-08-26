-- Support the common German legal forms relevant to trades businesses. Offers
-- and invoices are business correspondence; registered forms therefore keep
-- requiring seat, register court/number and the responsible representatives.

alter table public.pos_business_profiles
  drop constraint pos_business_profiles_legal_form_values_check,
  drop constraint pos_business_profiles_confirmation_check;

alter table public.pos_business_profiles
  add constraint pos_business_profiles_legal_form_values_check
  check (legal_form in (
    '', 'Einzelunternehmen', 'e.K.', 'GbR', 'eGbR', 'OHG', 'KG',
    'GmbH & Co. KG', 'UG (haftungsbeschränkt)', 'GmbH', 'AG', 'eG', 'Sonstige'
  )) not valid,
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
    )
  ) not valid;

alter table public.pos_invoices
  drop constraint pos_invoices_live_seller_legal_identity_check;

alter table public.pos_invoices
  add constraint pos_invoices_live_seller_legal_identity_check
  check (
    is_test or (
      coalesce(snapshot #>> '{seller,legalForm}', '') in (
        'Einzelunternehmen', 'e.K.', 'GbR', 'eGbR', 'OHG', 'KG',
        'GmbH & Co. KG', 'UG (haftungsbeschränkt)', 'GmbH', 'AG', 'eG'
      )
      and trim(coalesce(snapshot #>> '{seller,representative}', '')) <> ''
      and (
        coalesce(snapshot #>> '{seller,legalForm}', '') not in (
          'e.K.', 'eGbR', 'OHG', 'KG', 'GmbH & Co. KG',
          'UG (haftungsbeschränkt)', 'GmbH', 'AG', 'eG'
        )
        or (
          trim(coalesce(snapshot #>> '{seller,companySeat}', '')) <> ''
          and trim(coalesce(snapshot #>> '{seller,registerCourt}', '')) <> ''
          and trim(coalesce(snapshot #>> '{seller,registerNumber}', '')) <> ''
        )
      )
    )
  ) not valid;

alter table public.pos_business_profiles
  validate constraint pos_business_profiles_legal_form_values_check;
alter table public.pos_business_profiles
  validate constraint pos_business_profiles_confirmation_check;
alter table public.pos_invoices
  validate constraint pos_invoices_live_seller_legal_identity_check;

notify pgrst, 'reload schema';

;
