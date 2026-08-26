-- Keep the immutable invoice snapshot consistent with German recipient-side
-- tax workflows. § 48 EStG applies to construction services supplied to an
-- entrepreneur/public body; § 35a and the optional default notice are private
-- customer workflows. Require an explicit certificate decision for § 48.

create or replace function private.pos_validate_invoice_tax_evidence(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer_type text := coalesce(p_payload->>'customer_type', '');
  v_construction_withholding boolean := coalesce((p_payload->>'construction_withholding')::boolean, false);
  v_handwerker_35a boolean := coalesce((p_payload->>'handwerker_35a')::boolean, false);
  v_consumer_default_notice boolean := coalesce((p_payload->>'consumer_default_notice')::boolean, false);
  v_exemption_certificate text := coalesce(p_payload->>'exemption_certificate', 'unknown');
begin
  if v_construction_withholding and v_customer_type not in ('business', 'public') then
    raise exception 'Bauabzugsteuer po § 48 EStG velja le za poslovnega ali javnega prejemnika.';
  end if;
  if v_construction_withholding
     and v_exemption_certificate not in ('valid', 'missing', 'not_applicable') then
    raise exception 'Pri Bauleistung je treba določiti stanje Freistellungsbescheinigung.';
  end if;
  if v_handwerker_35a and v_customer_type <> 'private' then
    raise exception 'Handwerkerleistung po § 35a EStG je namenjena zasebnemu prejemniku.';
  end if;
  if v_consumer_default_notice and v_customer_type <> 'private' then
    raise exception '30-dnevno potrošniško opozorilo je dovoljeno le za zasebnega prejemnika.';
  end if;
  return p_payload;
end;
$$;

revoke all on function private.pos_validate_invoice_tax_evidence(jsonb)
  from public, anon, authenticated;
grant execute on function private.pos_validate_invoice_tax_evidence(jsonb)
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
    private.pos_validate_invoice_tax_evidence(
      private.pos_validate_invoice_payload(
        private.pos_validate_invoice_party_fields(
          p_payload || jsonb_build_object(
            'seller_contact_phone',
            coalesce((select business_phone from public.pos_business_profiles where user_id = (select auth.uid())), '')
          )
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
    private.pos_validate_invoice_tax_evidence(
      private.pos_validate_invoice_payload(
        private.pos_validate_invoice_party_fields(
          p_payload || jsonb_build_object(
            'seller_contact_phone',
            coalesce((select business_phone from public.pos_business_profiles where user_id = (select auth.uid())), '')
          )
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

;
