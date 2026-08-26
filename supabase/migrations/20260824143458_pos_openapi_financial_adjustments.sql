-- Openapi Germany accepts document type 381 for financial credit documents.
-- Keep non-financial Rechnungsberichtigung (UBL type 384) fail-closed because
-- the provider schema only exposes types 380 and 381.

create unique index if not exists pos_invoice_deliveries_one_openapi_per_adjustment_uidx
  on public.pos_invoice_deliveries(user_id, adjustment_id)
  where provider='openapi' and adjustment_id is not null;

create or replace function private.pos_validate_delivery_invoice_mode()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_invoice_is_test boolean; v_adjustment record;
begin
  select invoice.is_test into v_invoice_is_test from public.pos_invoices invoice
    where invoice.id=new.invoice_id and invoice.user_id=new.user_id;
  if not found then raise exception 'Dostave ni mogoče povezati z izvornim računom.'; end if;
  if new.adjustment_id is not null then
    select adjustment.original_invoice_id,adjustment.is_test,adjustment.adjustment_type
      into v_adjustment from public.pos_invoice_adjustments adjustment
      where adjustment.id=new.adjustment_id and adjustment.user_id=new.user_id;
    if not found or v_adjustment.original_invoice_id<>new.invoice_id
      or v_adjustment.adjustment_type not in ('correction','cancellation','credit_note') then
      raise exception 'Dostava ni pravilno povezana s strukturiranim popravkom.';
    end if;
    if v_adjustment.is_test<>v_invoice_is_test then
      raise exception 'Način popravka se ne ujema z izvornim računom.';
    end if;
  end if;
  if not (new.status='test_prepared' and new.provider='not_connected')
    and new.is_test<>v_invoice_is_test then
    raise exception 'Način dostave se ne ujema s testnim oziroma pravim računom.';
  end if;
  return new;
end;
$$;

create or replace function private.pos_block_original_delivery_after_financial_adjustment()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.adjustment_id is null and new.status in ('test_prepared','queued','processing') and exists (
    select 1 from public.pos_invoice_adjustments adjustment
    where adjustment.original_invoice_id=new.invoice_id and adjustment.user_id=new.user_id
      and adjustment.adjustment_type in ('cancellation','credit_note')
  ) then
    raise exception 'Izvirnega računa po Stornu ali dobropisu ni dovoljeno pripraviti ali poslati.';
  end if;
  return new;
end;
$$;

create or replace function private._pos_prepare_adjustment_delivery(
  p_adjustment_id uuid,p_request_key uuid,p_channel text,p_document_format text,
  p_recipient text default '',p_routing_reference text default '',p_subject text default '',
  p_message text default '',p_confirmed boolean default false
)
returns public.pos_invoice_deliveries language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=(select auth.uid());
  v_adjustment public.pos_invoice_adjustments%rowtype;
  v_invoice public.pos_invoices%rowtype;
  v_existing public.pos_invoice_deliveries%rowtype;
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_leitweg_id text; v_validation_status text;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if not coalesce(p_confirmed,false) then raise exception 'Pred pripravo potrdite podatke pošiljanja.'; end if;
  if p_adjustment_id is null or p_request_key is null then raise exception 'Manjka popravek ali ključ zahteve.'; end if;
  select * into v_existing from public.pos_invoice_deliveries
    where user_id=v_user and request_key=p_request_key;
  if found then return v_existing; end if;
  select * into v_adjustment from public.pos_invoice_adjustments
    where id=p_adjustment_id and user_id=v_user;
  if not found or v_adjustment.adjustment_type not in ('correction','cancellation','credit_note') then
    raise exception 'Strukturirani popravek ne obstaja ali ni podprt.';
  end if;
  select * into v_invoice from public.pos_invoices
    where id=v_adjustment.original_invoice_id and user_id=v_user;
  if not found or v_invoice.customer_type not in ('business','public') then
    raise exception 'Strukturirana dostava je dovoljena samo podjetju ali javnemu naročniku.';
  end if;
  if not exists(select 1 from public.pos_business_profiles where user_id=v_user) then
    raise exception 'Najprej dopolnite podatke podjetja.';
  end if;
  if p_channel not in ('email','ozg_re','peppol') then raise exception 'Neveljaven kanal.'; end if;
  if p_document_format not in ('xrechnung','xrechnung_pdf') then
    raise exception 'Za popravek je obvezen strukturirani XRechnung XML.';
  end if;
  if char_length(trim(coalesce(p_recipient,'')))>320 or trim(coalesce(p_recipient,''))~E'[\r\n]' then raise exception 'Prejemnik ni veljaven.'; end if;
  if char_length(trim(coalesce(p_routing_reference,'')))>160 or trim(coalesce(p_routing_reference,''))~E'[\r\n]' then raise exception 'Usmerjevalni podatek ni veljaven.'; end if;
  if char_length(trim(coalesce(p_subject,'')))>240 or trim(coalesce(p_subject,''))~E'[\r\n]' then raise exception 'Zadeva ni veljavna.'; end if;
  if char_length(coalesce(p_message,''))>4000 then raise exception 'Sporočilo je predolgo.'; end if;
  v_leitweg_id:=trim(coalesce(v_invoice.snapshot#>>'{draft,leitweg_id}',''));
  if v_invoice.customer_type='business' then
    if p_channel<>'email' then raise exception 'Za poslovnega prejemnika je trenutno podprt e-poštni kanal.'; end if;
    if trim(coalesce(p_recipient,''))='' then raise exception 'Vnesite e-poštni naslov prejemnika.'; end if;
  else
    if p_channel not in ('ozg_re','peppol') or p_document_format<>'xrechnung' then
      raise exception 'Javni naročnik zahteva XRechnung prek uradnega kanala.';
    end if;
    if v_leitweg_id='' or trim(coalesce(p_routing_reference,''))<>v_leitweg_id then
      raise exception 'Leitweg-ID se ne ujema z izvornim računom.';
    end if;
  end if;
  select validation_status into v_validation_status
    from public.pos_adjustment_einvoice_documents
    where adjustment_id=v_adjustment.id and user_id=v_user
      and document_kind='adjustment_xrechnung_ubl';
  v_validation_status:=coalesce(v_validation_status,'pending');
  insert into public.pos_invoice_deliveries(
    user_id,invoice_id,adjustment_id,request_key,channel,document_format,validation_status,
    recipient,routing_reference,subject,message,recipient_consent,status,provider,is_test
  ) values (
    v_user,v_invoice.id,v_adjustment.id,p_request_key,p_channel,p_document_format,v_validation_status,
    case when v_invoice.customer_type='public' then '' else trim(coalesce(p_recipient,'')) end,
    case when v_invoice.customer_type='public' then trim(coalesce(p_routing_reference,'')) else '' end,
    case when v_invoice.customer_type='public' then '' else trim(coalesce(p_subject,'')) end,
    case when v_invoice.customer_type='public' then '' else coalesce(p_message,'') end,
    false,'test_prepared','not_connected',true
  ) returning * into v_delivery;
  insert into public.pos_invoice_delivery_events(user_id,delivery_id,event_type,details)
  values(v_user,v_delivery.id,'prepared',jsonb_build_object(
    'status','test_prepared','provider','not_connected','adjustment_id',v_adjustment.id,
    'adjustment_type',v_adjustment.adjustment_type,'validation_status',v_validation_status));
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values(v_user,'invoice',v_invoice.id,'adjustment_delivery_test_prepared',jsonb_build_object(
    'delivery_id',v_delivery.id,'adjustment_id',v_adjustment.id,'channel',p_channel,
    'document_format',p_document_format,'validation_status',v_validation_status));
  return v_delivery;
end;
$$;

create or replace function private._pos_queue_openapi_invoice_delivery(
  p_delivery_id uuid,p_user_id uuid,p_confirmed boolean default false,p_sandbox boolean default true
)
returns public.pos_invoice_deliveries language plpgsql security definer set search_path=''
as $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_invoice public.pos_invoices%rowtype;
  v_adjustment public.pos_invoice_adjustments%rowtype;
  v_einvoice_status text; v_event text;
begin
  if p_delivery_id is null or p_user_id is null then raise exception 'Manjkajo podatki Openapi dostave.'; end if;
  if not coalesce(p_confirmed,false) then raise exception 'Pred Openapi dostavo je potrebna izrecna potrditev.'; end if;
  select * into v_delivery from public.pos_invoice_deliveries
    where id=p_delivery_id and user_id=p_user_id for update;
  if not found then raise exception 'Dostava ne obstaja ali ni uporabnikova.'; end if;
  select * into v_invoice from public.pos_invoices
    where id=v_delivery.invoice_id and user_id=p_user_id for share;
  if not found then raise exception 'Izvorni račun ne obstaja.'; end if;
  if v_invoice.customer_type not in ('business','public') then
    raise exception 'Openapi je namenjen strukturiranim B2B in B2G dokumentom.';
  end if;
  if v_invoice.is_test<>coalesce(p_sandbox,true) then
    raise exception 'Openapi način se ne ujema s testnim oziroma pravim računom.';
  end if;
  if v_delivery.adjustment_id is not null then
    select * into v_adjustment from public.pos_invoice_adjustments
      where id=v_delivery.adjustment_id and user_id=p_user_id
        and original_invoice_id=v_invoice.id for share;
    if not found or v_adjustment.adjustment_type not in ('cancellation','credit_note') then
      raise exception 'Openapi podpira samo finančni Storno ali Gutschrift (tip 381).';
    end if;
  elsif exists(select 1 from public.pos_invoice_adjustments where user_id=p_user_id
    and original_invoice_id=v_invoice.id and adjustment_type in ('cancellation','credit_note')) then
    raise exception 'Izvirnega računa po finančnem popravku ni dovoljeno dostaviti.';
  end if;
  if v_delivery.provider='openapi' and v_delivery.status in ('queued','processing','test_completed','sent','delivered') then
    return v_delivery;
  end if;
  if v_delivery.status not in ('test_prepared','test_completed','failed') then
    raise exception 'Dostave v trenutnem stanju ni mogoče oddati Openapi.';
  end if;
  if v_delivery.status='failed' and v_delivery.provider='openapi'
    and v_delivery.attempt_count>=v_delivery.max_attempts then
    raise exception 'Največje število Openapi poskusov je doseženo.';
  end if;
  if v_invoice.customer_type='public' then
    if v_delivery.channel not in ('ozg_re','peppol') or v_delivery.document_format<>'xrechnung' then
      raise exception 'B2G Openapi dostava zahteva XRechnung in javni kanal.';
    end if;
  else
    if v_delivery.channel not in ('email','peppol') or v_delivery.document_format<>'xrechnung_pdf' then
      raise exception 'B2B Openapi dostava zahteva strukturirani dokument in PDF.';
    end if;
    if v_delivery.adjustment_id is null and not exists(select 1 from public.pos_invoice_documents
      where user_id=p_user_id and invoice_id=v_invoice.id and document_kind='invoice_pdf') then
      raise exception 'Arhivirani PDF original manjka.';
    elsif v_delivery.adjustment_id is not null and not exists(select 1 from public.pos_adjustment_documents
      where user_id=p_user_id and adjustment_id=v_delivery.adjustment_id and document_kind='adjustment_pdf') then
      raise exception 'Arhivirani PDF finančnega popravka manjka.';
    end if;
  end if;
  if v_delivery.adjustment_id is null then
    select validation_status into v_einvoice_status from public.pos_einvoice_documents
      where user_id=p_user_id and invoice_id=v_invoice.id and document_kind='xrechnung_ubl';
  else
    select validation_status into v_einvoice_status from public.pos_adjustment_einvoice_documents
      where user_id=p_user_id and adjustment_id=v_delivery.adjustment_id
        and document_kind='adjustment_xrechnung_ubl';
  end if;
  if coalesce(v_einvoice_status,'')<>'validated' then
    raise exception 'XRechnung mora pred Openapi dostavo prestati KoSIT validacijo.';
  end if;
  v_event:=case when v_delivery.status='failed' and v_delivery.provider='openapi'
    then 'retry_scheduled' else 'queued' end;
  update public.pos_invoice_deliveries set
    status='queued',provider='openapi',is_test=coalesce(p_sandbox,true),validation_status=v_einvoice_status,
    attempt_count=case when v_delivery.provider='openapi' then v_delivery.attempt_count else 0 end,
    next_attempt_at=now(),locked_at=null,locked_by=null,completed_at=null,sent_at=null,delivered_at=null,
    provider_reference='',last_error='',last_provider_event_at=null,last_provider_event_type='',updated_at=now()
  where id=v_delivery.id returning * into v_delivery;
  insert into public.pos_invoice_delivery_events(user_id,delivery_id,event_type,details)
  values(p_user_id,v_delivery.id,v_event,jsonb_build_object(
    'provider','openapi','mode',case when p_sandbox then 'sandbox' else 'production' end,
    'adjustment_id',v_delivery.adjustment_id,'adjustment_type',v_adjustment.adjustment_type,
    'document_format',v_delivery.document_format,'validation_status',v_delivery.validation_status,
    'attempt_count',v_delivery.attempt_count,'max_attempts',v_delivery.max_attempts));
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values(p_user_id,'invoice',v_invoice.id,
    case when v_delivery.adjustment_id is null then 'delivery_openapi_queued' else 'adjustment_delivery_openapi_queued' end,
    jsonb_build_object('delivery_id',v_delivery.id,'adjustment_id',v_delivery.adjustment_id,
      'provider','openapi','sandbox',coalesce(p_sandbox,true),'confirmed',true));
  return v_delivery;
end;
$$;

revoke all on function private.pos_validate_delivery_invoice_mode() from public,anon,authenticated;
revoke all on function private.pos_block_original_delivery_after_financial_adjustment() from public,anon,authenticated;
revoke all on function private._pos_prepare_adjustment_delivery(uuid,uuid,text,text,text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function private._pos_queue_openapi_invoice_delivery(uuid,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function private.pos_validate_delivery_invoice_mode() to service_role;
grant execute on function private.pos_block_original_delivery_after_financial_adjustment() to service_role;
grant execute on function private._pos_prepare_adjustment_delivery(uuid,uuid,text,text,text,text,text,text,boolean) to service_role;
grant execute on function private._pos_queue_openapi_invoice_delivery(uuid,uuid,boolean,boolean) to service_role;

notify pgrst,'reload schema';
;
