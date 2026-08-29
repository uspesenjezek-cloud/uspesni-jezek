-- Varen dostavni predal za izdane račune. Brskalnik lahko dostavo samo
-- pripravi v testnem stanju; dejansko pošiljanje bo kasneje prevzel ponudnik.

alter table public.pos_business_profiles
  add column previous_year_turnover_band text not null default 'unknown'
  check (previous_year_turnover_band in ('unknown','lte_800k','gt_800k'));
create table public.pos_invoice_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.pos_invoices(id) on delete restrict,
  request_key uuid not null,
  channel text not null check (channel in ('email','ozg_re','peppol')),
  document_format text not null check (document_format in ('pdf','xrechnung','xrechnung_pdf')),
  validation_status text not null check (validation_status in ('not_required','pending','validated','failed')),
  recipient text not null default '',
  routing_reference text not null default '',
  subject text not null default '',
  message text not null default '',
  recipient_consent boolean not null default false,
  status text not null default 'test_prepared'
    check (status in ('test_prepared','queued','sent','delivered','failed')),
  provider text not null default 'not_connected',
  provider_reference text not null default '',
  is_test boolean not null default true,
  prepared_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_key)
);
create index pos_invoice_deliveries_user_created_idx
  on public.pos_invoice_deliveries(user_id, created_at desc);
create index pos_invoice_deliveries_invoice_created_idx
  on public.pos_invoice_deliveries(invoice_id, created_at desc);
create index pos_invoice_deliveries_status_idx
  on public.pos_invoice_deliveries(status, created_at)
  where status in ('queued','failed');
create table public.pos_invoice_delivery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid not null references public.pos_invoice_deliveries(id) on delete restrict,
  event_type text not null check (event_type in ('prepared','queued','sent','delivered','failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index pos_invoice_delivery_events_user_created_idx
  on public.pos_invoice_delivery_events(user_id, created_at desc);
create index pos_invoice_delivery_events_delivery_created_idx
  on public.pos_invoice_delivery_events(delivery_id, created_at);
alter table public.pos_invoice_deliveries enable row level security;
alter table public.pos_invoice_delivery_events enable row level security;
revoke all on table public.pos_invoice_deliveries, public.pos_invoice_delivery_events
  from public, anon, authenticated;
grant select on table public.pos_invoice_deliveries, public.pos_invoice_delivery_events
  to authenticated;
grant all on table public.pos_invoice_deliveries, public.pos_invoice_delivery_events
  to service_role;
create policy pos_invoice_deliveries_select_own on public.pos_invoice_deliveries
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_invoice_delivery_events_select_own on public.pos_invoice_delivery_events
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create trigger pos_invoice_deliveries_updated_at
before update on public.pos_invoice_deliveries
for each row execute function private.pos_set_updated_at();
create trigger pos_invoice_delivery_events_immutable
before update or delete on public.pos_invoice_delivery_events
for each row execute function private.pos_prevent_invoice_mutation();
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
  v_profile public.pos_business_profiles%rowtype;
  v_existing public.pos_invoice_deliveries%rowtype;
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_customer_type text;
  v_issue_date date;
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

  select * into v_profile
  from public.pos_business_profiles
  where user_id = v_user;
  if not found then raise exception 'Najprej dopolnite podatke podjetja.'; end if;

  v_customer_type := coalesce(v_invoice.snapshot #>> '{draft,customer_type}', 'private');
  v_issue_date := coalesce(
    nullif(v_invoice.snapshot #>> '{draft,issue_date}', '')::date,
    v_invoice.issued_at::date
  );
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
      if v_issue_date >= date '2028-01-01' then
        raise exception 'Od leta 2028 za ta B2B račun izberite strukturirani e-račun.';
      end if;
      if v_issue_date >= date '2027-01-01'
        and v_profile.previous_year_turnover_band <> 'lte_800k' then
        raise exception 'Za PDF v letu 2027 mora biti potrjen promet prejšnjega leta do 800.000 EUR.';
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
  values (
    v_user,
    v_delivery.id,
    'prepared',
    jsonb_build_object(
      'status', 'test_prepared',
      'provider', 'not_connected',
      'validation_status', v_validation_status
    )
  );

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (
    v_user,
    'invoice',
    v_invoice.id,
    'delivery_test_prepared',
    jsonb_build_object(
      'delivery_id', v_delivery.id,
      'channel', v_delivery.channel,
      'document_format', v_delivery.document_format,
      'validation_status', v_delivery.validation_status
    )
  );

  return v_delivery;
end;
$$;
create or replace function public.pos_prepare_invoice_delivery(
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
language sql
security invoker
set search_path = ''
as $$
  select private._pos_prepare_invoice_delivery(
    p_invoice_id,
    p_request_key,
    p_channel,
    p_document_format,
    p_recipient,
    p_routing_reference,
    p_subject,
    p_message,
    p_recipient_consent,
    p_confirmed
  );
$$;
revoke all on function private._pos_prepare_invoice_delivery(uuid,uuid,text,text,text,text,text,text,boolean,boolean)
  from public, anon;
revoke all on function public.pos_prepare_invoice_delivery(uuid,uuid,text,text,text,text,text,text,boolean,boolean)
  from public, anon;
grant execute on function private._pos_prepare_invoice_delivery(uuid,uuid,text,text,text,text,text,text,boolean,boolean)
  to authenticated, service_role;
grant execute on function public.pos_prepare_invoice_delivery(uuid,uuid,text,text,text,text,text,text,boolean,boolean)
  to authenticated, service_role;
notify pgrst, 'reload schema';
