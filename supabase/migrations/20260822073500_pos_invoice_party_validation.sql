-- Recipient identity becomes part of an immutable invoice snapshot. Validate
-- German addressing and electronic contact fields at the privileged issuance
-- boundary so a modified browser cannot persist unusable PDF/XRechnung data.

create or replace function private.pos_validate_invoice_party_fields(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_email text := trim(coalesce(p_payload->>'customer_email', ''));
  v_phone text := trim(coalesce(p_payload->>'customer_phone', ''));
  v_vat_id text := upper(regexp_replace(coalesce(p_payload->>'customer_vat_id', ''), '[[:space:]-]', '', 'g'));
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
    where party_field.value ~ E'[\\r\\n]'
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

  return p_payload || jsonb_build_object('customer_vat_id', v_vat_id);
end;
$$;

revoke all on function private.pos_validate_invoice_party_fields(jsonb)
  from public, anon, authenticated;
grant execute on function private.pos_validate_invoice_party_fields(jsonb)
  to service_role;

create or replace function private._pos_issue_invoice_validated(
  p_draft_id uuid,
  p_payload jsonb,
  p_final_confirmed boolean,
  p_einvoice_validated boolean default false
)
returns public.pos_invoices
language sql
security definer
set search_path = ''
as $$
  select private._pos_issue_invoice(
    p_draft_id,
    private.pos_validate_invoice_payload(
      private.pos_validate_invoice_party_fields(
        p_payload || jsonb_build_object(
          'seller_contact_phone',
          coalesce((select business_phone from public.pos_business_profiles where user_id = (select auth.uid())), '')
        )
      )
    ),
    p_final_confirmed,
    true
  );
$$;

create or replace function private._pos_issue_replacement_invoice_validated(
  p_draft_id uuid,
  p_payload jsonb,
  p_final_confirmed boolean,
  p_einvoice_validated boolean default false,
  p_cancellation_adjustment_id uuid default null
)
returns public.pos_invoices
language sql
security definer
set search_path = ''
as $$
  select private._pos_issue_replacement_invoice(
    p_draft_id,
    private.pos_validate_invoice_payload(
      private.pos_validate_invoice_party_fields(
        p_payload || jsonb_build_object(
          'seller_contact_phone',
          coalesce((select business_phone from public.pos_business_profiles where user_id = (select auth.uid())), '')
        )
      )
    ),
    p_final_confirmed,
    true,
    p_cancellation_adjustment_id
  );
$$;

revoke all on function private._pos_issue_invoice_validated(uuid,jsonb,boolean,boolean)
  from public, anon;
revoke all on function private._pos_issue_replacement_invoice_validated(uuid,jsonb,boolean,boolean,uuid)
  from public, anon;
grant execute on function private._pos_issue_invoice_validated(uuid,jsonb,boolean,boolean)
  to authenticated, service_role;
grant execute on function private._pos_issue_replacement_invoice_validated(uuid,jsonb,boolean,boolean,uuid)
  to authenticated, service_role;
