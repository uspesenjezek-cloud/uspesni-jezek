-- Bound all browser-controlled invoice JSON before the privileged issuance
-- functions acquire locks, calculate totals or persist an immutable snapshot.
-- Normal invoices with 100 maximum-length line items stay far below 512 KiB.

create or replace function private.pos_validate_invoice_payload(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Neveljaven račun.';
  end if;
  if octet_length(p_payload::text) > 524288 then
    raise exception 'Račun presega dovoljeno velikost.';
  end if;

  if jsonb_typeof(p_payload->'customer_name') <> 'string'
     or char_length(trim(coalesce(p_payload->>'customer_name', ''))) not between 1 and 240 then
    raise exception 'Manjka veljaven naziv prejemnika.';
  end if;
  if jsonb_typeof(p_payload->'customer_street') <> 'string'
     or char_length(trim(coalesce(p_payload->>'customer_street', ''))) not between 1 and 180 then
    raise exception 'Ulica prejemnika ni veljavna.';
  end if;
  if jsonb_typeof(p_payload->'customer_postal_code') <> 'string'
     or char_length(trim(coalesce(p_payload->>'customer_postal_code', ''))) not between 1 and 12 then
    raise exception 'Poštna številka prejemnika ni veljavna.';
  end if;
  if jsonb_typeof(p_payload->'customer_city') <> 'string'
     or char_length(trim(coalesce(p_payload->>'customer_city', ''))) not between 1 and 120 then
    raise exception 'Kraj prejemnika ni veljaven.';
  end if;

  if p_payload ? 'customer_vat_id' and (
       jsonb_typeof(p_payload->'customer_vat_id') <> 'string'
       or char_length(p_payload->>'customer_vat_id') > 20
     ) then raise exception 'USt-IdNr. prejemnika je predolga.'; end if;
  if p_payload ? 'customer_contact' and (
       jsonb_typeof(p_payload->'customer_contact') <> 'string'
       or char_length(p_payload->>'customer_contact') > 120
     ) then raise exception 'Kontaktna oseba je predolga.'; end if;
  if p_payload ? 'customer_email' and (
       jsonb_typeof(p_payload->'customer_email') <> 'string'
       or char_length(p_payload->>'customer_email') > 320
     ) then raise exception 'E-poštni naslov prejemnika je predolg.'; end if;
  if p_payload ? 'customer_phone' and (
       jsonb_typeof(p_payload->'customer_phone') <> 'string'
       or char_length(p_payload->>'customer_phone') > 60
     ) then raise exception 'Telefon prejemnika je predolg.'; end if;
  if p_payload ? 'leitweg_id' and (
       jsonb_typeof(p_payload->'leitweg_id') <> 'string'
       or char_length(p_payload->>'leitweg_id') > 60
     ) then raise exception 'Leitweg-ID je predolga.'; end if;
  if p_payload ? 'buyer_reference' and (
       jsonb_typeof(p_payload->'buyer_reference') <> 'string'
       or char_length(p_payload->>'buyer_reference') > 80
     ) then raise exception 'Buyer reference je predolga.'; end if;
  if p_payload ? 'project_name' and (
       jsonb_typeof(p_payload->'project_name') <> 'string'
       or char_length(p_payload->>'project_name') > 160
     ) then raise exception 'Naziv projekta je predolg.'; end if;
  if p_payload ? 'work_description' and (
       jsonb_typeof(p_payload->'work_description') <> 'string'
       or char_length(p_payload->>'work_description') > 1200
     ) then raise exception 'Opis dela je predolg.'; end if;
  if p_payload ? 'seller_contact_phone' and (
       jsonb_typeof(p_payload->'seller_contact_phone') <> 'string'
       or char_length(p_payload->>'seller_contact_phone') > 60
     ) then raise exception 'Telefon izdajatelja je predolg.'; end if;

  if p_payload ? 'payment_method'
     and coalesce(p_payload->>'payment_method', '') not in ('sepa', 'card_external', 'already_paid') then
    raise exception 'Način plačila ni veljaven.';
  end if;
  if p_payload ? 'exemption_certificate'
     and coalesce(p_payload->>'exemption_certificate', '') not in ('unknown', 'valid', 'missing', 'not_applicable') then
    raise exception 'Stanje Freistellungsbescheinigung ni veljavno.';
  end if;

  if p_payload ? 'replacement_context'
     and jsonb_typeof(p_payload->'replacement_context') not in ('object', 'null') then
    raise exception 'Povezava nadomestnega računa ni veljavna.';
  end if;
  if p_payload ? 'workflow_context'
     and jsonb_typeof(p_payload->'workflow_context') not in ('object', 'null') then
    raise exception 'Povezava računa z naročilom ni veljavna.';
  end if;

  if exists (
    select 1
    from (values
      ('reverse_charge_confirmed'),
      ('property_related'),
      ('handwerker_35a'),
      ('construction_withholding'),
      ('consumer_default_notice')
    ) as boolean_key(key)
    where p_payload ? (boolean_key.key)
      and jsonb_typeof(p_payload -> (boolean_key.key)) <> 'boolean'
  ) then
    raise exception 'Potrditvena polja računa niso veljavna.';
  end if;

  return p_payload;
end;
$$;

alter table public.pos_invoice_drafts
  add constraint pos_invoice_drafts_payload_size_check
  check (octet_length(payload::text) <= 524288) not valid;
alter table public.pos_invoice_drafts
  validate constraint pos_invoice_drafts_payload_size_check;

alter table public.pos_invoices
  add constraint pos_invoices_snapshot_size_check
  check (octet_length(snapshot::text) <= 524288) not valid;
alter table public.pos_invoices
  validate constraint pos_invoices_snapshot_size_check;

-- The public entry points run as their fixed owner so authenticated callers no
-- longer need direct EXECUTE on the privileged implementation functions. The
-- implementations still enforce auth.uid(), ownership and all tax rules.
create or replace function public.pos_issue_invoice(
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
      p_payload || jsonb_build_object(
        'seller_contact_phone',
        coalesce((select business_phone from public.pos_business_profiles where user_id = (select auth.uid())), '')
      )
    ),
    p_final_confirmed,
    true
  );
$$;

create or replace function public.pos_issue_replacement_invoice(
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
      p_payload || jsonb_build_object(
        'seller_contact_phone',
        coalesce((select business_phone from public.pos_business_profiles where user_id = (select auth.uid())), '')
      )
    ),
    p_final_confirmed,
    true,
    p_cancellation_adjustment_id
  );
$$;

revoke all on function private.pos_validate_invoice_payload(jsonb) from public, anon, authenticated;
grant execute on function private.pos_validate_invoice_payload(jsonb) to service_role;

revoke execute on function private._pos_issue_invoice(uuid,jsonb,boolean,boolean) from authenticated;
revoke execute on function private._pos_issue_replacement_invoice(uuid,jsonb,boolean,boolean,uuid) from authenticated;

revoke all on function public.pos_issue_invoice(uuid,jsonb,boolean,boolean) from public, anon;
revoke all on function public.pos_issue_replacement_invoice(uuid,jsonb,boolean,boolean,uuid) from public, anon;
grant execute on function public.pos_issue_invoice(uuid,jsonb,boolean,boolean) to authenticated, service_role;
grant execute on function public.pos_issue_replacement_invoice(uuid,jsonb,boolean,boolean,uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
