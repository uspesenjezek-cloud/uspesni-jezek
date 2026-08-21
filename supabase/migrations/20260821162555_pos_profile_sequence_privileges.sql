-- Users may edit their own business data, but invoice counters and timestamps
-- are database-owned. Column privileges keep direct Data API requests from
-- resetting a sequence or forging profile lifecycle fields.
revoke insert, update on table public.pos_business_profiles from authenticated;

grant insert (
  user_id,
  legal_name,
  legal_form,
  representative,
  street,
  postal_code,
  city,
  business_email,
  business_phone,
  tax_status,
  tax_number,
  vat_id,
  previous_year_turnover_band,
  account_holder,
  iban,
  invoice_prefix,
  default_due_days,
  legal_confirmed,
  datev_settings
) on public.pos_business_profiles to authenticated;

grant update (
  user_id,
  legal_name,
  legal_form,
  representative,
  street,
  postal_code,
  city,
  business_email,
  business_phone,
  tax_status,
  tax_number,
  vat_id,
  previous_year_turnover_band,
  account_holder,
  iban,
  invoice_prefix,
  default_due_days,
  legal_confirmed,
  datev_settings
) on public.pos_business_profiles to authenticated;
