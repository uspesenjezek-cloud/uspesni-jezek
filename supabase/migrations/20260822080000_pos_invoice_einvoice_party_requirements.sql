-- A browser-side wizard must not be the only protection against issuing an
-- immutable B2B/public invoice that cannot be rendered as XRechnung. Require
-- the electronic routing and seller contact data at the privileged boundary.

create or replace function private.pos_validate_invoice_party_fields(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer_type text := coalesce(p_payload->>'customer_type', '');
  v_email text := trim(coalesce(p_payload->>'customer_email', ''));
  v_phone text := trim(coalesce(p_payload->>'customer_phone', ''));
  v_vat_id text := upper(regexp_replace(coalesce(p_payload->>'customer_vat_id', ''), '[[:space:]-]', '', 'g'));
  v_buyer_reference text := trim(coalesce(p_payload->>'buyer_reference', ''));
  v_leitweg_id text := trim(coalesce(p_payload->>'leitweg_id', ''));
  v_seller_phone text := trim(coalesce(p_payload->>'seller_contact_phone', ''));
  v_seller_email text;
begin
  if coalesce(p_payload->>'customer_postal_code', '') !~ '^[0-9]{5}$' then
    raise exception 'PLZ prejemnika mora imeti točno 5 številk.';
  end if;

  if exists (
    select 1
    from (values
      (coalesce(p_payload->>'customer_name', '')),
      (coalesce(p_payload->>'customer_street', '')),
      (coalesce(p_payload->>'customer_postal_code', '')),
      (coalesce(p_payload->>'customer_city', '')),
      (coalesce(p_payload->>'customer_vat_id', '')),
      (coalesce(p_payload->>'customer_contact', '')),
      (coalesce(p_payload->>'customer_email', '')),
      (coalesce(p_payload->>'customer_phone', '')),
      (coalesce(p_payload->>'leitweg_id', '')),
      (coalesce(p_payload->>'buyer_reference', '')),
      (coalesce(p_payload->>'project_name', '')),
      (coalesce(p_payload->>'seller_contact_phone', ''))
    ) as party_field(value)
    where party_field.value ~ E'[\r\n]'
  ) then
    raise exception 'Podatki računa ne smejo vsebovati preloma vrstice.';
  end if;

  if v_email <> '' and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'E-poštni naslov prejemnika ni veljaven.';
  end if;
  if v_phone <> '' and v_phone !~ '^\+?[0-9][0-9 ()/.-]{5,59}$' then
    raise exception 'Telefon prejemnika ni veljaven.';
  end if;
  if v_vat_id <> '' and v_vat_id !~ '^[A-Z]{2}[A-Z0-9]{2,14}$' then
    raise exception 'USt-IdNr. prejemnika ni veljavna.';
  end if;
  if coalesce(p_payload->>'tax_mode', '') = 'reverse_charge' and v_vat_id = '' then
    raise exception 'Za reverse charge je potrebna USt-IdNr. prejemnika.';
  end if;

  if v_customer_type in ('business', 'public') then
    select trim(coalesce(profile.business_email, ''))
      into v_seller_email
    from public.pos_business_profiles as profile
    where profile.user_id = (select auth.uid());

    if v_buyer_reference = '' and v_leitweg_id = '' then
      raise exception 'Za XRechnung je potreben Buyer reference.';
    end if;
    if v_customer_type = 'business' and v_email = '' then
      raise exception 'Za poslovnega prejemnika je potreben e-poštni naslov.';
    end if;
    if coalesce(v_seller_email, '') = '' then
      raise exception 'Za XRechnung je potreben poslovni e-poštni naslov izdajatelja.';
    end if;
    if v_seller_phone = '' then
      raise exception 'Za XRechnung je potreben telefon izdajatelja.';
    end if;
  end if;

  return p_payload || jsonb_build_object('customer_vat_id', v_vat_id);
end;
$$;

revoke all on function private.pos_validate_invoice_party_fields(jsonb)
  from public, anon, authenticated;
grant execute on function private.pos_validate_invoice_party_fields(jsonb)
  to service_role;
