-- Serialize issuance per POS account before the idempotency check. Without this
-- ordering, two concurrent retries for the same draft can both pass the early
-- existence checks; the second request then fails on the unique draft index
-- instead of returning the invoice created by the first request.
create or replace function private._pos_issue_invoice(
  p_draft_id uuid,
  p_payload jsonb,
  p_final_confirmed boolean,
  p_einvoice_validated boolean default false
)
returns public.pos_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile public.pos_business_profiles%rowtype;
  v_existing public.pos_invoices%rowtype;
  v_invoice public.pos_invoices%rowtype;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_customer_type text;
  v_customer_name text;
  v_tax_mode text;
  v_price_mode text;
  v_issue_date date;
  v_service_date date;
  v_due_date date;
  v_due_days integer;
  v_is_live boolean;
  v_is_test boolean;
  v_sequence bigint;
  v_number text;
  v_quantity_milli bigint;
  v_unit_price_cents bigint;
  v_rate_bps integer;
  v_line_entered bigint;
  v_line_net bigint;
  v_line_tax bigint;
  v_line_gross bigint;
  v_net bigint := 0;
  v_tax bigint := 0;
  v_gross bigint := 0;
  v_eligible bigint := 0;
  v_category text;
  v_snapshot jsonb;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_draft_id is null then raise exception 'Manjka strežniški osnutek.'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Neveljaven račun.'; end if;

  -- The profile row is the per-user issuance mutex and the sequence source.
  -- PostgreSQL READ COMMITTED takes a fresh snapshot for the following
  -- statements after a waiter acquires this lock, so a concurrent retry sees
  -- and returns the invoice committed by the first request.
  select * into v_profile from public.pos_business_profiles
  where user_id = v_user for update;
  if not found then raise exception 'Najprej shranite podatke podjetja.'; end if;

  select * into v_existing from public.pos_invoices
  where user_id = v_user and source_draft_id = p_draft_id;
  if found then return v_existing; end if;

  if not exists (
    select 1 from public.pos_invoice_drafts
    where id = p_draft_id and user_id = v_user
  ) then raise exception 'Osnutek ne obstaja ali ni vaš.'; end if;

  v_is_live := trim(v_profile.legal_name) <> ''
    and trim(v_profile.street) <> '' and trim(v_profile.postal_code) <> '' and trim(v_profile.city) <> ''
    and (trim(v_profile.tax_number) <> '' or trim(v_profile.vat_id) <> '')
    and char_length(regexp_replace(v_profile.iban, '\\s', '', 'g')) between 15 and 34
    and trim(v_profile.account_holder) <> '' and trim(v_profile.invoice_prefix) <> ''
    and v_profile.legal_confirmed;
  v_is_test := not v_is_live;

  if not coalesce(p_final_confirmed, false) then raise exception 'Končni pregled ni potrjen.'; end if;
  v_customer_type := p_payload->>'customer_type';
  if v_customer_type not in ('private','business','public') then raise exception 'Neveljavna vrsta prejemnika.'; end if;
  v_customer_name := trim(coalesce(p_payload->>'customer_name',''));
  if char_length(v_customer_name) not between 1 and 240 then raise exception 'Manjka veljaven naziv prejemnika.'; end if;
  if trim(coalesce(p_payload->>'customer_street','')) = '' or trim(coalesce(p_payload->>'customer_postal_code','')) = '' or trim(coalesce(p_payload->>'customer_city','')) = '' then
    raise exception 'Manjka naslov prejemnika.';
  end if;
  if v_customer_type = 'public' and trim(coalesce(p_payload->>'leitweg_id','')) = '' then raise exception 'Za javnega naročnika je potrebna Leitweg-ID.'; end if;

  begin
    v_issue_date := (p_payload->>'issue_date')::date;
    v_service_date := (p_payload->>'service_date')::date;
    v_due_days := coalesce((p_payload->>'due_days')::integer, v_profile.default_due_days);
  exception when others then
    raise exception 'Datum ali rok plačila ni veljaven.';
  end;
  if v_due_days not between 0 and 365 then raise exception 'Rok plačila mora biti med 0 in 365 dni.'; end if;
  v_due_date := v_issue_date + v_due_days;

  v_tax_mode := p_payload->>'tax_mode';
  if v_tax_mode not in ('regular','small_business','reverse_charge') then raise exception 'Neveljaven davčni način.'; end if;
  if v_profile.tax_status = 'small_business' and v_tax_mode <> 'small_business' then raise exception 'Kleinunternehmer ne sme obračunati DDV.'; end if;
  if v_profile.tax_status <> 'small_business' and v_tax_mode = 'small_business' then raise exception '§ 19 UStG ni omogočen v profilu.'; end if;
  if v_tax_mode = 'reverse_charge' and (v_customer_type = 'private' or not coalesce((p_payload->>'reverse_charge_confirmed')::boolean, false)) then
    raise exception 'Pogoji § 13b UStG niso potrjeni.';
  end if;
  if v_is_live and (v_customer_type = 'public' or v_issue_date >= date '2028-01-01') and not coalesce(p_einvoice_validated, false) then
    raise exception 'Zahtevana je uspešna KoSIT validacija strukturiranega e-računa.';
  end if;

  v_price_mode := p_payload->>'price_mode';
  if v_price_mode not in ('net','gross') then raise exception 'Neveljaven način cene.'; end if;
  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') not between 1 and 100 then
    raise exception 'Račun mora imeti od 1 do 100 postavk.';
  end if;

  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    if trim(coalesce(v_item->>'description','')) = '' or char_length(v_item->>'description') > 240 then raise exception 'Vsaka postavka potrebuje veljaven opis.'; end if;
    begin
      v_quantity_milli := (v_item->>'quantity_milli')::bigint;
      v_unit_price_cents := (v_item->>'unit_price_cents')::bigint;
      v_rate_bps := coalesce((v_item->>'tax_rate_bps')::integer, 0);
    exception when others then
      raise exception 'Količina, cena ali DDV postavke ni veljaven.';
    end;
    if v_quantity_milli <= 0 or v_quantity_milli > 1000000000 then raise exception 'Količina postavke ni veljavna.'; end if;
    if v_unit_price_cents < 0 or v_unit_price_cents > 100000000000 then raise exception 'Cena postavke ni veljavna.'; end if;
    if v_tax_mode <> 'regular' then v_rate_bps := 0; end if;
    if v_rate_bps not in (0,700,1900) then raise exception 'Dovoljene stopnje DDV so 0, 7 in 19 odstotkov.'; end if;

    v_line_entered := round((v_unit_price_cents::numeric * v_quantity_milli::numeric) / 1000)::bigint;
    if v_price_mode = 'gross' and v_rate_bps > 0 then
      v_line_gross := v_line_entered;
      v_line_net := round((v_line_gross::numeric * 10000) / (10000 + v_rate_bps))::bigint;
      v_line_tax := v_line_gross - v_line_net;
    else
      v_line_net := v_line_entered;
      v_line_tax := round((v_line_net::numeric * v_rate_bps) / 10000)::bigint;
      v_line_gross := v_line_net + v_line_tax;
    end if;
    v_net := v_net + v_line_net;
    v_tax := v_tax + v_line_tax;
    v_gross := v_gross + v_line_gross;
    v_category := coalesce(v_item->>'category','other');
    if v_category not in ('labour','travel','machine','material','goods','other') then v_category := 'other'; end if;
    if v_category in ('labour','travel','machine') then v_eligible := v_eligible + v_line_gross; end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', left(coalesce(v_item->>'id',''),100),
      'description', v_item->>'description', 'category', v_category,
      'quantity_milli', v_quantity_milli, 'unit', left(coalesce(v_item->>'unit',''),20),
      'unit_price_cents', v_unit_price_cents, 'tax_rate_bps', v_rate_bps,
      'net_cents', v_line_net, 'tax_cents', v_line_tax, 'gross_cents', v_line_gross
    ));
  end loop;

  if v_is_test then
    v_sequence := v_profile.next_test_sequence;
    v_number := 'TEST-' || extract(year from v_issue_date)::integer || '-' || lpad(v_sequence::text, 4, '0');
    update public.pos_business_profiles set next_test_sequence = next_test_sequence + 1 where user_id = v_user;
  else
    v_sequence := v_profile.next_invoice_sequence;
    v_number := v_profile.invoice_prefix || lpad(v_sequence::text, 4, '0');
    update public.pos_business_profiles set next_invoice_sequence = next_invoice_sequence + 1 where user_id = v_user;
  end if;

  v_snapshot := jsonb_build_object(
    'schema_version', 1,
    'seller', jsonb_build_object(
      'legalName', v_profile.legal_name, 'legalForm', v_profile.legal_form,
      'representative', v_profile.representative, 'street', v_profile.street,
      'postalCode', v_profile.postal_code, 'city', v_profile.city,
      'businessEmail', v_profile.business_email, 'taxStatus', v_profile.tax_status,
      'taxNumber', v_profile.tax_number, 'vatId', v_profile.vat_id,
      'accountHolder', v_profile.account_holder, 'iban', v_profile.iban
    ),
    'draft', (p_payload - 'items') || jsonb_build_object('items', v_items),
    'totals', jsonb_build_object('netCents',v_net,'taxCents',v_tax,'grossCents',v_gross,'eligible35aCents',v_eligible)
  );

  insert into public.pos_invoices (
    user_id, source_draft_id, invoice_number, document_status, is_test,
    customer_type, customer_name, issue_date, service_date, due_date, tax_mode,
    net_cents, tax_cents, gross_cents, eligible_35a_cents, snapshot
  ) values (
    v_user, p_draft_id, v_number, case when v_is_test then 'test' else 'issued' end, v_is_test,
    v_customer_type, v_customer_name, v_issue_date, v_service_date, v_due_date, v_tax_mode,
    v_net, v_tax, v_gross, v_eligible, v_snapshot
  ) returning * into v_invoice;

  delete from public.pos_invoice_drafts where id = p_draft_id and user_id = v_user;
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (v_user,'invoice',v_invoice.id,case when v_is_test then 'test_created' else 'invoice_issued' end,
    jsonb_build_object('invoice_number',v_number,'gross_cents',v_gross,'source_draft_id',p_draft_id));
  return v_invoice;
end;
$$;

revoke all on function private._pos_issue_invoice(uuid,jsonb,boolean,boolean) from public, anon;
grant execute on function private._pos_issue_invoice(uuid,jsonb,boolean,boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
