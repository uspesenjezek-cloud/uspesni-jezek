-- A correction or cancellation that must be an E-Rechnung needs its own
-- delivery package and evidence. Reuse the hardened outbox while keeping the
-- original invoice relation for audit, and bind the optional adjustment at the
-- tenant-aware foreign-key layer.

alter table public.pos_invoice_deliveries
  add column adjustment_id uuid;

alter table public.pos_invoice_deliveries
  add constraint pos_invoice_deliveries_adjustment_format_check
    check (adjustment_id is null or document_format in ('xrechnung','xrechnung_pdf')) not valid,
  add constraint pos_tenant_invoice_delivery_adjustment_fk
    foreign key (adjustment_id,user_id)
    references public.pos_invoice_adjustments(id,user_id) on delete restrict not valid;

create index pos_invoice_deliveries_adjustment_created_idx
  on public.pos_invoice_deliveries(adjustment_id,created_at desc)
  where adjustment_id is not null;

alter table public.pos_invoice_deliveries
  validate constraint pos_invoice_deliveries_adjustment_format_check,
  validate constraint pos_tenant_invoice_delivery_adjustment_fk;

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
      or v_adjustment.adjustment_type not in ('correction','cancellation') then
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

create or replace function private.pos_enforce_invoice_delivery_format()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_customer_type text;
begin
  select customer_type into v_customer_type from public.pos_invoices
    where id=new.invoice_id and user_id=new.user_id;
  if not found then raise exception 'Dostava nima veljavnega izvornega računa.'; end if;

  if new.adjustment_id is not null then
    if new.document_format='pdf' then
      raise exception 'Strukturirani popravek mora vsebovati XRechnung XML.';
    end if;
    if v_customer_type='public' and new.document_format<>'xrechnung' then
      raise exception 'Javni naročnik prejme strukturirani popravek brez dodatnega PDF.';
    end if;
    return new;
  end if;

  if new.document_format='pdf' and v_customer_type='business'
    and not private.pos_invoice_pdf_delivery_allowed(new.invoice_id,new.user_id) then
    raise exception 'PDF za ta B2B promet ni dovoljen; izberite strukturirani e-račun.';
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
  if not found or v_adjustment.adjustment_type not in ('correction','cancellation') then
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
    'validation_status',v_validation_status));
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values(v_user,'invoice',v_invoice.id,'adjustment_delivery_test_prepared',jsonb_build_object(
    'delivery_id',v_delivery.id,'adjustment_id',v_adjustment.id,'channel',p_channel,
    'document_format',p_document_format,'validation_status',v_validation_status));
  return v_delivery;
end;
$$;

create or replace function public.pos_prepare_adjustment_delivery(
  p_adjustment_id uuid,p_request_key uuid,p_channel text,p_document_format text,
  p_recipient text default '',p_routing_reference text default '',p_subject text default '',
  p_message text default '',p_confirmed boolean default false
)
returns public.pos_invoice_deliveries language sql security invoker set search_path=''
as $$ select private._pos_prepare_adjustment_delivery(
  p_adjustment_id,p_request_key,p_channel,p_document_format,p_recipient,
  p_routing_reference,p_subject,p_message,p_confirmed); $$;

revoke all on function private._pos_prepare_adjustment_delivery(uuid,uuid,text,text,text,text,text,text,boolean)
  from public,anon;
revoke all on function public.pos_prepare_adjustment_delivery(uuid,uuid,text,text,text,text,text,text,boolean)
  from public,anon;
grant execute on function private._pos_prepare_adjustment_delivery(uuid,uuid,text,text,text,text,text,text,boolean)
  to authenticated,service_role;
grant execute on function public.pos_prepare_adjustment_delivery(uuid,uuid,text,text,text,text,text,text,boolean)
  to authenticated,service_role;

create or replace function private._pos_queue_invoice_delivery(
  p_delivery_id uuid,p_confirmed boolean default false
)
returns public.pos_invoice_deliveries language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=(select auth.uid()); v_delivery public.pos_invoice_deliveries%rowtype;
  v_event text; v_einvoice_status text;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if not coalesce(p_confirmed,false) then raise exception 'Pred preizkusom potrdite pripravljeno dostavo.'; end if;
  select * into v_delivery from public.pos_invoice_deliveries
    where id=p_delivery_id and user_id=v_user for update;
  if not found then raise exception 'Dostava ne obstaja ali ni vaša.'; end if;
  if not v_delivery.is_test then raise exception 'Ta funkcija dovoljuje samo sandbox dostavo.'; end if;
  if v_delivery.status='queued' and v_delivery.provider='sandbox' then return v_delivery; end if;
  if v_delivery.status not in ('test_prepared','failed') then raise exception 'Dostave ni mogoče dodati v čakalno vrsto.'; end if;
  if v_delivery.status='failed' and v_delivery.attempt_count>=v_delivery.max_attempts then raise exception 'Največje število poskusov je doseženo.'; end if;

  if v_delivery.adjustment_id is null then
    if exists(select 1 from public.pos_invoice_adjustments where user_id=v_user
      and original_invoice_id=v_delivery.invoice_id and adjustment_type in ('cancellation','credit_note')) then
      raise exception 'Izvirnega računa po finančnem popravku ni dovoljeno dostaviti.';
    end if;
    if v_delivery.document_format in ('pdf','xrechnung_pdf') and not exists(
      select 1 from public.pos_invoice_documents where user_id=v_user and invoice_id=v_delivery.invoice_id
        and document_kind='invoice_pdf') then raise exception 'Arhivirani PDF original manjka.'; end if;
    if v_delivery.document_format in ('xrechnung','xrechnung_pdf') then
      select validation_status into v_einvoice_status from public.pos_einvoice_documents
        where user_id=v_user and invoice_id=v_delivery.invoice_id and document_kind='xrechnung_ubl';
    else v_einvoice_status:='not_required'; end if;
  else
    if v_delivery.document_format='xrechnung_pdf' and not exists(
      select 1 from public.pos_adjustment_documents where user_id=v_user and adjustment_id=v_delivery.adjustment_id
        and document_kind='adjustment_pdf') then raise exception 'Arhivirani PDF popravek manjka.'; end if;
    select validation_status into v_einvoice_status from public.pos_adjustment_einvoice_documents
      where user_id=v_user and adjustment_id=v_delivery.adjustment_id
        and document_kind='adjustment_xrechnung_ubl';
  end if;
  if v_delivery.document_format in ('xrechnung','xrechnung_pdf') and coalesce(v_einvoice_status,'')<>'validated' then
    raise exception 'Strukturirani dokument mora pred dostavo prestati KoSIT validacijo.';
  end if;

  v_event:=case when v_delivery.status='failed' then 'retry_scheduled' else 'queued' end;
  update public.pos_invoice_deliveries set status='queued',provider='sandbox',validation_status=v_einvoice_status,
    next_attempt_at=now(),locked_at=null,locked_by=null,completed_at=null,last_error='',updated_at=now()
    where id=v_delivery.id returning * into v_delivery;
  insert into public.pos_invoice_delivery_events(user_id,delivery_id,event_type,details)
  values(v_user,v_delivery.id,v_event,jsonb_build_object('provider','sandbox','adjustment_id',v_delivery.adjustment_id,
    'attempt_count',v_delivery.attempt_count,'max_attempts',v_delivery.max_attempts,
    'document_format',v_delivery.document_format,'validation_status',v_delivery.validation_status));
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values(v_user,'invoice',v_delivery.invoice_id,case when v_delivery.adjustment_id is null
    then 'delivery_sandbox_queued' else 'adjustment_delivery_sandbox_queued' end,
    jsonb_build_object('delivery_id',v_delivery.id,'adjustment_id',v_delivery.adjustment_id,'event',v_event));
  return v_delivery;
end;
$$;

create or replace function private._pos_queue_live_invoice_delivery(
  p_delivery_id uuid,p_user_id uuid,p_confirmed boolean default false
)
returns public.pos_invoice_deliveries language plpgsql security definer set search_path=''
as $$
declare v_delivery public.pos_invoice_deliveries%rowtype; v_einvoice_status text;
begin
  if p_delivery_id is null or p_user_id is null then raise exception 'Manjkajo podatki dostave.'; end if;
  if not coalesce(p_confirmed,false) then raise exception 'Pred pravim pošiljanjem je potrebna izrecna potrditev.'; end if;
  select * into v_delivery from public.pos_invoice_deliveries
    where id=p_delivery_id and user_id=p_user_id for update;
  if not found then raise exception 'Dostava ne obstaja ali ni uporabnikova.'; end if;
  if v_delivery.status in ('sent','delivered') and not v_delivery.is_test and v_delivery.provider='resend' then return v_delivery; end if;
  if v_delivery.status not in ('test_prepared','test_completed','failed') then raise exception 'Dostave v trenutnem stanju ni mogoče poslati.'; end if;
  if not v_delivery.is_test and v_delivery.status='failed' and v_delivery.attempt_count>=v_delivery.max_attempts then raise exception 'Največje število poskusov je doseženo.'; end if;
  if v_delivery.channel<>'email' then raise exception 'Resend je dovoljen samo za e-poštni kanal.'; end if;
  if trim(v_delivery.recipient)='' or v_delivery.recipient!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'E-poštni naslov ni veljaven.'; end if;

  if v_delivery.adjustment_id is null then
    if exists(select 1 from public.pos_invoice_adjustments where user_id=p_user_id
      and original_invoice_id=v_delivery.invoice_id and adjustment_type in ('cancellation','credit_note')) then
      raise exception 'Izvirnega računa po finančnem popravku ni dovoljeno poslati.';
    end if;
    if v_delivery.document_format in ('pdf','xrechnung_pdf') and not exists(
      select 1 from public.pos_invoice_documents where user_id=p_user_id and invoice_id=v_delivery.invoice_id
        and document_kind='invoice_pdf') then raise exception 'Arhivirani PDF original manjka.'; end if;
    if v_delivery.document_format in ('xrechnung','xrechnung_pdf') then
      select validation_status into v_einvoice_status from public.pos_einvoice_documents
        where user_id=p_user_id and invoice_id=v_delivery.invoice_id and document_kind='xrechnung_ubl';
    else v_einvoice_status:='not_required'; end if;
  else
    if v_delivery.document_format='xrechnung_pdf' and not exists(
      select 1 from public.pos_adjustment_documents where user_id=p_user_id and adjustment_id=v_delivery.adjustment_id
        and document_kind='adjustment_pdf') then raise exception 'Arhivirani PDF popravek manjka.'; end if;
    select validation_status into v_einvoice_status from public.pos_adjustment_einvoice_documents
      where user_id=p_user_id and adjustment_id=v_delivery.adjustment_id
        and document_kind='adjustment_xrechnung_ubl';
  end if;
  if v_delivery.document_format in ('xrechnung','xrechnung_pdf') and coalesce(v_einvoice_status,'')<>'validated' then
    raise exception 'XRechnung mora pred pošiljanjem prestati KoSIT validacijo.';
  end if;

  update public.pos_invoice_deliveries set status='queued',provider='resend',is_test=false,
    validation_status=v_einvoice_status,attempt_count=case when v_delivery.is_test then 0 else v_delivery.attempt_count end,
    next_attempt_at=now(),locked_at=null,locked_by=null,completed_at=null,sent_at=null,delivered_at=null,
    provider_reference='',last_error='',updated_at=now() where id=v_delivery.id returning * into v_delivery;
  insert into public.pos_invoice_delivery_events(user_id,delivery_id,event_type,details)
  values(p_user_id,v_delivery.id,'queued',jsonb_build_object('provider','resend','mode','live',
    'adjustment_id',v_delivery.adjustment_id,'document_format',v_delivery.document_format,
    'validation_status',v_delivery.validation_status));
  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values(p_user_id,'invoice',v_delivery.invoice_id,case when v_delivery.adjustment_id is null
    then 'delivery_live_queued' else 'adjustment_delivery_live_queued' end,
    jsonb_build_object('delivery_id',v_delivery.id,'adjustment_id',v_delivery.adjustment_id,
      'provider','resend','confirmed',true));
  return v_delivery;
end;
$$;

revoke all on function private._pos_queue_invoice_delivery(uuid,boolean) from public,anon;
grant execute on function private._pos_queue_invoice_delivery(uuid,boolean) to authenticated,service_role;
revoke all on function private._pos_queue_live_invoice_delivery(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private._pos_queue_live_invoice_delivery(uuid,uuid,boolean) to service_role;

notify pgrst,'reload schema';

;
