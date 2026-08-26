-- The lifecycle invariant intentionally requires locked_payload = payload.
-- Enrich both copies atomically when a draft becomes a sent offer so the
-- immutable seller disclosure is preserved without blocking the transition.

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
    new.payload := jsonb_set(new.payload, '{seller}', v_seller, true);
    new.locked_payload := new.payload;
  end if;
  return new;
end;
$$;

revoke all on function private.pos_lock_offer_seller_legal_identity()
  from public, anon, authenticated;
grant execute on function private.pos_lock_offer_seller_legal_identity()
  to service_role;

notify pgrst, 'reload schema';

;
