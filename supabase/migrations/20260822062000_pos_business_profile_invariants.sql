-- Seller data is embedded into immutable invoices and payment QR codes. Keep
-- incomplete test profiles possible, but only allow confirmed German profiles
-- to leave Testbetrieb when their identifiers and payment data are plausible.

create or replace function private.pos_iban_valid(p_iban text)
returns boolean
language plpgsql
security invoker
immutable
strict
set search_path = ''
as $$
declare
  v_iban text := upper(p_iban);
  v_rearranged text;
  v_character text;
  v_digits text;
  v_digit text;
  v_remainder integer := 0;
  v_index integer;
begin
  if v_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    return false;
  end if;

  v_rearranged := substring(v_iban from 5) || substring(v_iban from 1 for 4);
  for v_index in 1..char_length(v_rearranged) loop
    v_character := substring(v_rearranged from v_index for 1);
    v_digits := case
      when v_character between '0' and '9' then v_character
      else (ascii(v_character) - ascii('A') + 10)::text
    end;
    foreach v_digit in array regexp_split_to_array(v_digits, '') loop
      if v_digit <> '' then
        v_remainder := (v_remainder * 10 + v_digit::integer) % 97;
      end if;
    end loop;
  end loop;

  return v_remainder = 1;
end;
$$;

alter table public.pos_business_profiles
  add constraint pos_business_profiles_document_text_check
  check (
    legal_name !~ '[[:cntrl:]]'
    and legal_form !~ '[[:cntrl:]]'
    and representative !~ '[[:cntrl:]]'
    and street !~ '[[:cntrl:]]'
    and city !~ '[[:cntrl:]]'
    and account_holder !~ '[[:cntrl:]]'
  ) not valid,
  add constraint pos_business_profiles_contact_shape_check
  check (
    (business_email = '' or business_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
    and (business_phone = '' or business_phone ~ '^\+?[0-9][0-9 ()/.-]{5,59}$')
  ) not valid,
  add constraint pos_business_profiles_german_tax_shape_check
  check (
    (tax_number = '' or (
      tax_number ~ '^[0-9 /-]+$'
      and char_length(regexp_replace(tax_number, '[^0-9]', '', 'g')) in (10, 11, 13)
    ))
    and (vat_id = '' or vat_id ~ '^DE[0-9]{9}$')
  ) not valid,
  add constraint pos_business_profiles_payment_shape_check
  check (iban = '' or private.pos_iban_valid(iban)) not valid,
  add constraint pos_business_profiles_german_postal_check
  check (postal_code = '' or postal_code ~ '^[0-9]{5}$') not valid,
  add constraint pos_business_profiles_invoice_prefix_shape_check
  check (invoice_prefix ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$') not valid,
  add constraint pos_business_profiles_confirmation_check
  check (
    not legal_confirmed or (
      trim(legal_name) <> ''
      and trim(street) <> ''
      and postal_code ~ '^[0-9]{5}$'
      and trim(city) <> ''
      and (tax_number <> '' or vat_id <> '')
      and trim(account_holder) <> ''
      and private.pos_iban_valid(iban)
      and invoice_prefix ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
    )
  ) not valid;

alter table public.pos_business_profiles
  validate constraint pos_business_profiles_document_text_check;
alter table public.pos_business_profiles
  validate constraint pos_business_profiles_contact_shape_check;
alter table public.pos_business_profiles
  validate constraint pos_business_profiles_german_tax_shape_check;
alter table public.pos_business_profiles
  validate constraint pos_business_profiles_payment_shape_check;
alter table public.pos_business_profiles
  validate constraint pos_business_profiles_german_postal_check;
alter table public.pos_business_profiles
  validate constraint pos_business_profiles_invoice_prefix_shape_check;
alter table public.pos_business_profiles
  validate constraint pos_business_profiles_confirmation_check;

revoke all on function private.pos_iban_valid(text) from public, anon;
grant execute on function private.pos_iban_valid(text) to authenticated, service_role;

notify pgrst, 'reload schema';
