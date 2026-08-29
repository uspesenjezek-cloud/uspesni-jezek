-- POS terminal: varna hramba osnutkov, nespremenljiva izdaja in ločena plačila.
-- Vse javne tabele imajo izrecne GRANT pravice in RLS. Pravno izdajo lahko
-- izvede samo spodnja RPC funkcija, ki zneske ponovno izračuna v bazi.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.pos_business_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legal_name text not null default '' check (char_length(legal_name) <= 160),
  legal_form text not null default '' check (char_length(legal_form) <= 80),
  representative text not null default '' check (char_length(representative) <= 160),
  street text not null default '' check (char_length(street) <= 180),
  postal_code text not null default '' check (char_length(postal_code) <= 12),
  city text not null default '' check (char_length(city) <= 120),
  business_email text not null default '' check (char_length(business_email) <= 200),
  tax_status text not null default 'regular' check (tax_status in ('regular','small_business')),
  tax_number text not null default '' check (char_length(tax_number) <= 40),
  vat_id text not null default '' check (char_length(vat_id) <= 20),
  account_holder text not null default '' check (char_length(account_holder) <= 160),
  iban text not null default '' check (char_length(iban) <= 34),
  invoice_prefix text not null default '' check (char_length(invoice_prefix) between 1 and 32),
  default_due_days integer not null default 14 check (default_due_days between 0 and 365),
  legal_confirmed boolean not null default false,
  next_invoice_sequence bigint not null default 1 check (next_invoice_sequence > 0),
  next_test_sequence bigint not null default 1 check (next_test_sequence > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pos_invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pos_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_draft_id uuid,
  invoice_number text not null check (char_length(invoice_number) between 1 and 80),
  document_status text not null check (document_status in ('issued','test')),
  is_test boolean not null,
  customer_type text not null check (customer_type in ('private','business','public')),
  customer_name text not null check (char_length(customer_name) between 1 and 240),
  issue_date date not null,
  service_date date not null,
  due_date date not null,
  currency text not null default 'EUR' check (currency = 'EUR'),
  tax_mode text not null check (tax_mode in ('regular','small_business','reverse_charge')),
  net_cents bigint not null check (net_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  gross_cents bigint not null check (gross_cents >= 0),
  eligible_35a_cents bigint not null default 0 check (eligible_35a_cents >= 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  issued_at timestamptz not null default now(),
  unique (user_id, invoice_number)
);

create unique index pos_invoices_user_source_draft_uidx
  on public.pos_invoices(user_id, source_draft_id)
  where source_draft_id is not null;
create index pos_invoice_drafts_user_updated_idx on public.pos_invoice_drafts(user_id, updated_at desc);
create index pos_invoices_user_issued_idx on public.pos_invoices(user_id, issued_at desc);

create table public.pos_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.pos_invoices(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  method text not null check (method in ('bank_transfer','external_card','manual')),
  provider_reference text not null default '' check (char_length(provider_reference) <= 240),
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index pos_payments_user_invoice_idx on public.pos_payments(user_id, invoice_id, paid_at desc);

create table public.pos_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('profile','draft','invoice','payment')),
  entity_id uuid,
  action text not null check (char_length(action) between 1 and 80),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index pos_audit_events_user_created_idx on public.pos_audit_events(user_id, created_at desc);

alter table public.pos_business_profiles enable row level security;
alter table public.pos_invoice_drafts enable row level security;
alter table public.pos_invoices enable row level security;
alter table public.pos_payments enable row level security;
alter table public.pos_audit_events enable row level security;

revoke all on table public.pos_business_profiles from public, anon, authenticated;
revoke all on table public.pos_invoice_drafts from public, anon, authenticated;
revoke all on table public.pos_invoices from public, anon, authenticated;
revoke all on table public.pos_payments from public, anon, authenticated;
revoke all on table public.pos_audit_events from public, anon, authenticated;

grant select, insert, update on table public.pos_business_profiles to authenticated;
grant select, insert, update, delete on table public.pos_invoice_drafts to authenticated;
grant select on table public.pos_invoices to authenticated;
grant select, insert on table public.pos_payments to authenticated;
grant select on table public.pos_audit_events to authenticated;
grant all on table public.pos_business_profiles, public.pos_invoice_drafts, public.pos_invoices, public.pos_payments, public.pos_audit_events to service_role;

create policy pos_profile_select_own on public.pos_business_profiles
  for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_profile_insert_own on public.pos_business_profiles
  for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_profile_update_own on public.pos_business_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy pos_draft_select_own on public.pos_invoice_drafts
  for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_draft_insert_own on public.pos_invoice_drafts
  for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_draft_update_own on public.pos_invoice_drafts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy pos_draft_delete_own on public.pos_invoice_drafts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy pos_invoice_select_own on public.pos_invoices
  for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy pos_payment_select_own on public.pos_payments
  for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_payment_insert_own on public.pos_payments
  for insert to authenticated with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and exists (
      select 1 from public.pos_invoices i
      where i.id = invoice_id and i.user_id = (select auth.uid())
    )
  );

create policy pos_audit_select_own on public.pos_audit_events
  for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function private.pos_set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger pos_business_profiles_updated_at
before update on public.pos_business_profiles
for each row execute function private.pos_set_updated_at();
create trigger pos_invoice_drafts_updated_at
before update on public.pos_invoice_drafts
for each row execute function private.pos_set_updated_at();

create or replace function private.pos_prevent_invoice_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Izdani račun je nespremenljiv. Popravek mora biti nov dokument.';
end;
$$;

create trigger pos_invoices_immutable
before update or delete on public.pos_invoices
for each row execute function private.pos_prevent_invoice_mutation();

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

  select * into v_existing from public.pos_invoices
  where user_id = v_user and source_draft_id = p_draft_id;
  if found then return v_existing; end if;

  if not exists (
    select 1 from public.pos_invoice_drafts
    where id = p_draft_id and user_id = v_user
  ) then raise exception 'Osnutek ne obstaja ali ni vaš.'; end if;

  select * into v_profile from public.pos_business_profiles
  where user_id = v_user for update;
  if not found then raise exception 'Najprej shranite podatke podjetja.'; end if;

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

create or replace function public.pos_issue_invoice(
  p_draft_id uuid,
  p_payload jsonb,
  p_final_confirmed boolean,
  p_einvoice_validated boolean default false
)
returns public.pos_invoices
language sql
security invoker
set search_path = ''
as $$
  select private._pos_issue_invoice(p_draft_id,p_payload,p_final_confirmed,p_einvoice_validated);
$$;

revoke all on function private.pos_set_updated_at() from public, anon, authenticated;
revoke all on function private.pos_prevent_invoice_mutation() from public, anon, authenticated;
revoke all on function private._pos_issue_invoice(uuid,jsonb,boolean,boolean) from public, anon;
revoke all on function public.pos_issue_invoice(uuid,jsonb,boolean,boolean) from public, anon;
grant execute on function private._pos_issue_invoice(uuid,jsonb,boolean,boolean) to authenticated, service_role;
grant execute on function public.pos_issue_invoice(uuid,jsonb,boolean,boolean) to authenticated, service_role;
grant execute on function private.pos_set_updated_at(), private.pos_prevent_invoice_mutation() to service_role;

notify pgrst, 'reload schema';

;
