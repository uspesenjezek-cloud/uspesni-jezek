-- German invoices and offers are business letters. Registered legal forms
-- require their seat, register court/number and all persons who must appear on
-- business correspondence. Keep those values in every immutable document.

alter table public.pos_business_profiles
  add column company_seat text not null default '' check (char_length(company_seat) <= 100),
  add column register_court text not null default '' check (char_length(register_court) <= 160),
  add column register_number text not null default '' check (char_length(register_number) <= 80);

alter table public.pos_business_profiles
  add constraint pos_business_profiles_legal_form_values_check
  check (legal_form in ('', 'Einzelunternehmen', 'e.K.', 'GbR', 'eGbR', 'UG (haftungsbeschränkt)', 'GmbH', 'Sonstige')) not valid,
  add constraint pos_business_profiles_register_text_check
  check (
    company_seat !~ '[[:cntrl:]]'
    and register_court !~ '[[:cntrl:]]'
    and register_number !~ '[[:cntrl:]]'
  ) not valid;

-- A previous confirmation did not cover the newly required register fields.
-- No live invoices exist in this development project; reconfirmation is safer
-- than silently treating an old confirmation as approval of blank values.
update public.pos_business_profiles
set legal_confirmed = false
where legal_confirmed;

alter table public.pos_business_profiles
  drop constraint pos_business_profiles_confirmation_check;

alter table public.pos_business_profiles
  add constraint pos_business_profiles_confirmation_check
  check (
    not legal_confirmed or (
      trim(legal_name) <> ''
      and legal_form in ('Einzelunternehmen', 'e.K.', 'GbR', 'eGbR', 'UG (haftungsbeschränkt)', 'GmbH')
      and trim(representative) <> ''
      and (
        legal_form not in ('e.K.', 'eGbR', 'UG (haftungsbeschränkt)', 'GmbH')
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

alter table public.pos_business_profiles
  validate constraint pos_business_profiles_legal_form_values_check;
alter table public.pos_business_profiles
  validate constraint pos_business_profiles_register_text_check;
alter table public.pos_business_profiles
  validate constraint pos_business_profiles_confirmation_check;

grant insert (company_seat, register_court, register_number)
  on public.pos_business_profiles to authenticated;
grant update (company_seat, register_court, register_number)
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
    or new.account_holder is distinct from old.account_holder
    or new.iban is distinct from old.iban
  ) then
    new.legal_confirmed := false;
  end if;
  return new;
end;
$$;

create or replace function private.pos_capture_seller_legal_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.pos_business_profiles%rowtype;
  v_seller jsonb;
begin
  select * into v_profile
  from public.pos_business_profiles
  where user_id = new.user_id;
  if not found then raise exception 'Podatki podjetja ne obstajajo.'; end if;

  v_seller := coalesce(new.snapshot->'seller', '{}'::jsonb) || jsonb_build_object(
    'legalName', v_profile.legal_name,
    'legalForm', v_profile.legal_form,
    'representative', v_profile.representative,
    'companySeat', v_profile.company_seat,
    'registerCourt', v_profile.register_court,
    'registerNumber', v_profile.register_number
  );
  new.snapshot := jsonb_set(new.snapshot, '{seller}', v_seller, true);
  return new;
end;
$$;

revoke all on function private.pos_capture_seller_legal_identity()
  from public, anon, authenticated;
grant execute on function private.pos_capture_seller_legal_identity()
  to service_role;

create trigger pos_invoices_capture_seller_legal_identity
before insert on public.pos_invoices
for each row execute function private.pos_capture_seller_legal_identity();

alter table public.pos_invoices
  add constraint pos_invoices_live_seller_legal_identity_check
  check (
    is_test or (
      coalesce(snapshot #>> '{seller,legalForm}', '') in ('Einzelunternehmen', 'e.K.', 'GbR', 'eGbR', 'UG (haftungsbeschränkt)', 'GmbH')
      and trim(coalesce(snapshot #>> '{seller,representative}', '')) <> ''
      and (
        coalesce(snapshot #>> '{seller,legalForm}', '') not in ('e.K.', 'eGbR', 'UG (haftungsbeschränkt)', 'GmbH')
        or (
          trim(coalesce(snapshot #>> '{seller,companySeat}', '')) <> ''
          and trim(coalesce(snapshot #>> '{seller,registerCourt}', '')) <> ''
          and trim(coalesce(snapshot #>> '{seller,registerNumber}', '')) <> ''
        )
      )
    )
  ) not valid;

alter table public.pos_invoices
  validate constraint pos_invoices_live_seller_legal_identity_check;

create or replace function private.pos_lock_offer_seller_legal_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.pos_business_profiles%rowtype;
  v_seller jsonb;
begin
  if old.status = 'draft' and new.status = 'offered' then
    select * into v_profile
    from public.pos_business_profiles
    where user_id = new.user_id;
    if not found or not v_profile.legal_confirmed then
      raise exception 'Pred pošiljanjem ponudbe potrdite popolne pravne podatke podjetja.';
    end if;

    v_seller := jsonb_build_object(
      'legalName', v_profile.legal_name,
      'legalForm', v_profile.legal_form,
      'representative', v_profile.representative,
      'companySeat', v_profile.company_seat,
      'registerCourt', v_profile.register_court,
      'registerNumber', v_profile.register_number,
      'street', v_profile.street,
      'postalCode', v_profile.postal_code,
      'city', v_profile.city,
      'businessEmail', v_profile.business_email,
      'businessPhone', v_profile.business_phone,
      'taxStatus', v_profile.tax_status,
      'taxNumber', v_profile.tax_number,
      'vatId', v_profile.vat_id
    );
    new.locked_payload := jsonb_set(coalesce(new.locked_payload, new.payload), '{seller}', v_seller, true);
  end if;
  return new;
end;
$$;

revoke all on function private.pos_lock_offer_seller_legal_identity()
  from public, anon, authenticated;
grant execute on function private.pos_lock_offer_seller_legal_identity()
  to service_role;

create trigger pos_work_orders_lock_seller_legal_identity
before update of status on public.pos_work_orders
for each row execute function private.pos_lock_offer_seller_legal_identity();

notify pgrst, 'reload schema';

;
