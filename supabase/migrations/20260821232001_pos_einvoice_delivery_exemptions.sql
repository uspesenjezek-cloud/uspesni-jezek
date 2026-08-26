-- German B2B e-invoice transition rules are based on the date of the supply,
-- not the invoice issue date. Kleinunternehmer invoices and qualifying invoices
-- up to EUR 250 may always be delivered as an unstructured invoice. The small
-- amount exception does not apply to reverse-charge supplies under section 13b.

create or replace function private.pos_invoice_pdf_delivery_allowed(
  p_invoice_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when invoice.customer_type <> 'business' then true
      when invoice.tax_mode = 'small_business' then true
      when invoice.gross_cents <= 25000 and invoice.tax_mode <> 'reverse_charge' then true
      when invoice.service_date < date '2027-01-01' then true
      when invoice.service_date < date '2028-01-01'
        and profile.previous_year_turnover_band = 'lte_800k' then true
      else false
    end
    from public.pos_invoices as invoice
    join public.pos_business_profiles as profile on profile.user_id = invoice.user_id
    where invoice.id = p_invoice_id and invoice.user_id = p_user_id
  ), false);
$$;

revoke all on function private.pos_invoice_pdf_delivery_allowed(uuid,uuid)
  from public, anon, authenticated;
grant execute on function private.pos_invoice_pdf_delivery_allowed(uuid,uuid)
  to service_role;

create or replace function private.pos_enforce_invoice_delivery_format()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_type text;
begin
  if new.document_format <> 'pdf' then return new; end if;

  select customer_type into v_customer_type
  from public.pos_invoices
  where id = new.invoice_id and user_id = new.user_id;

  if v_customer_type = 'business'
    and not private.pos_invoice_pdf_delivery_allowed(new.invoice_id, new.user_id) then
    raise exception 'PDF za ta B2B promet ni dovoljen; izberite strukturirani e-račun.';
  end if;
  return new;
end;
$$;

revoke all on function private.pos_enforce_invoice_delivery_format()
  from public, anon, authenticated;
grant execute on function private.pos_enforce_invoice_delivery_format()
  to service_role;

drop trigger if exists pos_invoice_deliveries_enforce_format on public.pos_invoice_deliveries;
create trigger pos_invoice_deliveries_enforce_format
before insert or update of document_format, status, provider, is_test
on public.pos_invoice_deliveries
for each row execute function private.pos_enforce_invoice_delivery_format();

create or replace function private._pos_prepare_invoice_delivery(
  p_invoice_id uuid,
  p_request_key uuid,
  p_channel text,
  p_document_format text,
  p_recipient text default '',
  p_routing_reference text default '',
  p_subject text default '',
  p_message text default '',
  p_recipient_consent boolean default false,
  p_confirmed boolean default false
)
returns public.pos_invoice_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invoice public.pos_invoices%rowtype;
  v_existing public.pos_invoice_deliveries%rowtype;
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_customer_type text;
  v_leitweg_id text;
  v_validation_status text;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if not coalesce(p_confirmed, false) then raise exception 'Pred pripravo potrdite podatke pošiljanja.'; end if;
  if p_invoice_id is null or p_request_key is null then raise exception 'Manjka račun ali ključ zahteve.'; end if;

  select * into v_existing
  from public.pos_invoice_deliveries
  where user_id = v_user and request_key = p_request_key;
  if found then return v_existing; end if;

  select * into v_invoice
  from public.pos_invoices
  where id = p_invoice_id and user_id = v_user;
  if not found then raise exception 'Račun ne obstaja ali ni vaš.'; end if;

  if exists (
    select 1 from public.pos_invoice_adjustments
    where user_id = v_user
      and original_invoice_id = v_invoice.id
      and adjustment_type = 'cancellation'
  ) then
    raise exception 'Storniranega računa ni dovoljeno pripraviti za pošiljanje.';
  end if;

  if not exists (select 1 from public.pos_business_profiles where user_id = v_user) then
    raise exception 'Najprej dopolnite podatke podjetja.';
  end if;

  v_customer_type := v_invoice.customer_type;
  v_leitweg_id := trim(coalesce(v_invoice.snapshot #>> '{draft,leitweg_id}', ''));

  if p_channel not in ('email','ozg_re','peppol') then raise exception 'Neveljaven kanal.'; end if;
  if p_document_format not in ('pdf','xrechnung','xrechnung_pdf') then raise exception 'Neveljaven format dokumenta.'; end if;
  if length(trim(coalesce(p_recipient, ''))) > 320 then raise exception 'Prejemnik je predolg.'; end if;
  if length(trim(coalesce(p_routing_reference, ''))) > 160 then raise exception 'Usmerjevalni podatek je predolg.'; end if;
  if length(trim(coalesce(p_subject, ''))) > 240 then raise exception 'Zadeva je predolga.'; end if;
  if length(coalesce(p_message, '')) > 4000 then raise exception 'Sporočilo je predolgo.'; end if;

  if v_customer_type = 'private' then
    if p_channel <> 'email' or p_document_format <> 'pdf' then
      raise exception 'Fizični osebi se v tej različici pripravi PDF po e-pošti.';
    end if;
    if not coalesce(p_recipient_consent, false) then
      raise exception 'Za elektronski PDF je potrebno soglasje prejemnika.';
    end if;
  elsif v_customer_type = 'business' then
    if p_channel <> 'email' then raise exception 'Za podjetje je trenutno podprt e-poštni kanal.'; end if;
    if p_document_format = 'pdf' then
      if not coalesce(p_recipient_consent, false) then
        raise exception 'Za elektronski PDF je potrebno soglasje prejemnika.';
      end if;
      if not private.pos_invoice_pdf_delivery_allowed(v_invoice.id, v_user) then
        raise exception 'PDF za ta B2B promet ni dovoljen; izberite strukturirani e-račun.';
      end if;
    end if;
  elsif v_customer_type = 'public' then
    if p_channel not in ('ozg_re','peppol') or p_document_format <> 'xrechnung' then
      raise exception 'Javni naročnik zahteva XRechnung prek uradnega kanala.';
    end if;
    if v_leitweg_id = '' then raise exception 'Za javnega naročnika manjka Leitweg-ID.'; end if;
    if trim(coalesce(p_routing_reference, '')) <> v_leitweg_id then
      raise exception 'Usmerjevalni podatek se ne ujema z Leitweg-ID računa.';
    end if;
  else
    raise exception 'Vrsta prejemnika ni podprta.';
  end if;

  if p_channel = 'email' and trim(coalesce(p_recipient, '')) = '' then
    raise exception 'Vnesite e-poštni naslov prejemnika.';
  end if;

  v_validation_status := case when p_document_format = 'pdf' then 'not_required' else 'pending' end;

  insert into public.pos_invoice_deliveries(
    user_id, invoice_id, request_key, channel, document_format, validation_status,
    recipient, routing_reference, subject, message, recipient_consent,
    status, provider, is_test
  ) values (
    v_user, v_invoice.id, p_request_key, p_channel, p_document_format, v_validation_status,
    trim(coalesce(p_recipient, '')), trim(coalesce(p_routing_reference, '')),
    trim(coalesce(p_subject, '')), coalesce(p_message, ''), coalesce(p_recipient_consent, false),
    'test_prepared', 'not_connected', true
  ) returning * into v_delivery;

  insert into public.pos_invoice_delivery_events(user_id, delivery_id, event_type, details)
  values (v_user, v_delivery.id, 'prepared', jsonb_build_object(
    'status', 'test_prepared', 'provider', 'not_connected',
    'validation_status', v_validation_status
  ));

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (v_user, 'invoice', v_invoice.id, 'delivery_test_prepared', jsonb_build_object(
    'delivery_id', v_delivery.id, 'channel', v_delivery.channel,
    'document_format', v_delivery.document_format,
    'validation_status', v_delivery.validation_status
  ));

  return v_delivery;
end;
$$;

revoke all on function private._pos_prepare_invoice_delivery(uuid,uuid,text,text,text,text,text,text,boolean,boolean)
  from public, anon;
grant execute on function private._pos_prepare_invoice_delivery(uuid,uuid,text,text,text,text,text,text,boolean,boolean)
  to authenticated, service_role;

notify pgrst, 'reload schema';

;
