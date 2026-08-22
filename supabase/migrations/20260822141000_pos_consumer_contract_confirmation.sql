-- § 312f BGB requires a contract copy/confirmation on paper or another durable
-- medium. Archive the exact confirmation PDF, record its actual delivery, and
-- prevent work from starting until that proof exists for covered B2C contracts.

alter table public.pos_work_order_events
  drop constraint pos_work_order_events_action_check,
  add constraint pos_work_order_events_action_check
    check (action in ('created','updated','offered','accepted','started','completed','progress_invoiced','final_invoiced','cancelled','withdrawn','contract_confirmation_delivered'));

create table public.pos_contract_confirmation_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  work_order_id uuid not null,
  acceptance_id uuid not null,
  offer_document_id uuid not null,
  offer_sha256 text not null check (offer_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_on date not null,
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 5242880),
  media_type text not null default 'application/pdf' check (media_type = 'application/pdf'),
  generator_version text not null check (char_length(generator_version) between 1 and 80),
  created_at timestamptz not null default now(),
  constraint pos_contract_confirmation_order_user_fk
    foreign key (work_order_id, user_id)
    references public.pos_work_orders(id, user_id)
    on delete restrict,
  constraint pos_contract_confirmation_acceptance_user_fk
    foreign key (acceptance_id, user_id)
    references public.pos_work_order_acceptances(id, user_id)
    on delete restrict,
  constraint pos_contract_confirmation_offer_document_user_fk
    foreign key (offer_document_id, user_id)
    references public.pos_offer_documents(id, user_id)
    on delete restrict,
  unique (id, user_id),
  unique (work_order_id),
  unique (acceptance_id),
  unique (storage_path)
);

create index pos_contract_confirmation_documents_user_created_idx
  on public.pos_contract_confirmation_documents(user_id, created_at desc);
create index pos_contract_confirmation_documents_order_user_idx
  on public.pos_contract_confirmation_documents(work_order_id, user_id);
create index pos_contract_confirmation_documents_acceptance_user_idx
  on public.pos_contract_confirmation_documents(acceptance_id, user_id);
create index pos_contract_confirmation_documents_offer_user_idx
  on public.pos_contract_confirmation_documents(offer_document_id, user_id);

alter table public.pos_contract_confirmation_documents enable row level security;
revoke all on table public.pos_contract_confirmation_documents from public, anon, authenticated;
grant select on table public.pos_contract_confirmation_documents to authenticated;
grant all on table public.pos_contract_confirmation_documents to service_role;

create policy pos_contract_confirmation_documents_select_own
  on public.pos_contract_confirmation_documents
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create trigger pos_contract_confirmation_documents_immutable
before update or delete on public.pos_contract_confirmation_documents
for each row execute function private.pos_prevent_work_order_evidence_mutation();

create or replace function private.pos_validate_contract_confirmation_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.pos_work_orders as work_order
    join public.pos_work_order_acceptances as acceptance
      on acceptance.work_order_id = work_order.id and acceptance.user_id = work_order.user_id
    join public.pos_offer_documents as offer_document
      on offer_document.id = acceptance.offer_document_id and offer_document.user_id = acceptance.user_id
    where work_order.id = new.work_order_id
      and work_order.user_id = new.user_id
      and work_order.status in ('accepted','in_progress','completed','invoiced','withdrawn')
      and work_order.locked_payload->>'customer_type' = 'private'
      and work_order.locked_payload->>'consumer_contract_context' in ('distance','off_premises','urgent_repair')
      and work_order.accepted_on is not null
      and acceptance.id = new.acceptance_id
      and acceptance.accepted_on = work_order.accepted_on
      and offer_document.id = new.offer_document_id
      and offer_document.work_order_id = work_order.id
      and offer_document.sha256 = acceptance.offer_sha256
      and new.offer_sha256 = acceptance.offer_sha256
      and new.accepted_on = work_order.accepted_on
  ) then
    raise exception 'Pogodbeno potrdilo mora biti vezano na dejanski sprejem in nespremenljivi PDF ponudbe.';
  end if;
  return new;
end;
$$;

revoke all on function private.pos_validate_contract_confirmation_document()
  from public, anon, authenticated;
grant execute on function private.pos_validate_contract_confirmation_document()
  to service_role;

create trigger pos_contract_confirmation_documents_validate_source
before insert on public.pos_contract_confirmation_documents
for each row execute function private.pos_validate_contract_confirmation_document();

create table public.pos_contract_confirmation_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  work_order_id uuid not null,
  confirmation_document_id uuid not null,
  channel text not null check (channel in ('paper', 'electronic')),
  recipient text not null check (char_length(trim(recipient)) between 2 and 200),
  evidence text not null check (char_length(trim(evidence)) between 5 and 500),
  electronic_consent_evidence text check (
    electronic_consent_evidence is null
    or char_length(trim(electronic_consent_evidence)) between 5 and 500
  ),
  delivered_on date not null,
  recorded_at timestamptz not null default now(),
  constraint pos_contract_confirmation_delivery_order_user_fk
    foreign key (work_order_id, user_id)
    references public.pos_work_orders(id, user_id)
    on delete restrict,
  constraint pos_contract_confirmation_delivery_document_user_fk
    foreign key (confirmation_document_id, user_id)
    references public.pos_contract_confirmation_documents(id, user_id)
    on delete restrict,
  unique (work_order_id),
  unique (confirmation_document_id)
);

create index pos_contract_confirmation_deliveries_user_recorded_idx
  on public.pos_contract_confirmation_deliveries(user_id, recorded_at desc);
create index pos_contract_confirmation_deliveries_order_user_idx
  on public.pos_contract_confirmation_deliveries(work_order_id, user_id);
create index pos_contract_confirmation_deliveries_document_user_idx
  on public.pos_contract_confirmation_deliveries(confirmation_document_id, user_id);

alter table public.pos_contract_confirmation_deliveries enable row level security;
revoke all on table public.pos_contract_confirmation_deliveries from public, anon, authenticated;
grant select on table public.pos_contract_confirmation_deliveries to authenticated;
grant all on table public.pos_contract_confirmation_deliveries to service_role;

create policy pos_contract_confirmation_deliveries_select_own
  on public.pos_contract_confirmation_deliveries
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create trigger pos_contract_confirmation_deliveries_immutable
before update or delete on public.pos_contract_confirmation_deliveries
for each row execute function private.pos_prevent_work_order_evidence_mutation();

create or replace function private.pos_require_contract_confirmation_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context text := coalesce(new.locked_payload->>'consumer_contract_context', '');
begin
  if old.status = 'accepted'
     and new.status = 'in_progress'
     and coalesce(new.locked_payload->>'customer_type', '') = 'private'
     and v_context in ('distance', 'off_premises', 'urgent_repair')
     and not exists (
       select 1
       from public.pos_contract_confirmation_deliveries as delivery
       join public.pos_contract_confirmation_documents as document
         on document.id = delivery.confirmation_document_id
        and document.user_id = delivery.user_id
       where delivery.work_order_id = new.id
         and delivery.user_id = new.user_id
         and delivery.delivered_on >= coalesce(new.accepted_on, (new.accepted_at at time zone 'Europe/Berlin')::date)
         and delivery.delivered_on <= (new.started_at at time zone 'Europe/Berlin')::date
     ) then
    raise exception 'Pred začetkom dela je treba potrošniku izročiti dokazljivo pogodbeno potrdilo na trajnem nosilcu.';
  end if;
  return new;
end;
$$;

revoke all on function private.pos_require_contract_confirmation_delivery()
  from public, anon, authenticated;
grant execute on function private.pos_require_contract_confirmation_delivery()
  to service_role;

create trigger pos_work_orders_require_contract_confirmation_delivery
before update of status on public.pos_work_orders
for each row execute function private.pos_require_contract_confirmation_delivery();

create or replace function private._pos_record_contract_confirmation_delivery(
  p_work_order_id uuid,
  p_channel text,
  p_evidence text,
  p_delivered_on date,
  p_electronic_consent_evidence text default null
)
returns public.pos_contract_confirmation_deliveries
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Berlin'
as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.pos_work_orders%rowtype;
  v_document public.pos_contract_confirmation_documents%rowtype;
  v_delivery public.pos_contract_confirmation_deliveries%rowtype;
  v_context text;
  v_channel text := trim(coalesce(p_channel, ''));
  v_evidence text := trim(coalesce(p_evidence, ''));
  v_consent text := nullif(trim(coalesce(p_electronic_consent_evidence, '')), '');
  v_accepted_on date;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if v_channel not in ('paper', 'electronic') then raise exception 'Izberite papir ali elektronski trajni nosilec.'; end if;
  if char_length(v_evidence) not between 5 and 500 then raise exception 'Vpišite dokaz izročitve pogodbenega potrdila (od 5 do 500 znakov).'; end if;
  if p_delivered_on is null or p_delivered_on > current_date then raise exception 'Datum izročitve ni veljaven.'; end if;

  select * into v_order
  from public.pos_work_orders
  where id = p_work_order_id and user_id = v_user
  for update;
  if not found then raise exception 'Naročilo ne obstaja ali ni vaše.'; end if;
  if v_order.status <> 'accepted' then raise exception 'Izročitev se zabeleži po sprejemu in pred začetkom dela.'; end if;
  if coalesce(v_order.locked_payload->>'customer_type', '') <> 'private' then raise exception 'Pogodbeno potrdilo v tem postopku je namenjeno potrošniku.'; end if;
  v_context := coalesce(v_order.locked_payload->>'consumer_contract_context', '');
  if v_context not in ('distance', 'off_premises', 'urgent_repair') then raise exception 'Za ta način sklenitve posebno pogodbeno potrdilo ni zahtevano.'; end if;
  v_accepted_on := coalesce(v_order.accepted_on, (v_order.accepted_at at time zone 'Europe/Berlin')::date);
  if p_delivered_on < v_accepted_on then raise exception 'Potrdilo ne more biti izročeno pred sklenitvijo pogodbe.'; end if;
  if v_channel = 'electronic' and v_context in ('off_premises', 'urgent_repair') and char_length(coalesce(v_consent, '')) not between 5 and 500 then
    raise exception 'Elektronsko potrdilo zunaj poslovnih prostorov zahteva dokaz potrošnikovega soglasja k drugemu trajnemu nosilcu.';
  end if;

  select * into v_document
  from public.pos_contract_confirmation_documents
  where work_order_id = v_order.id and user_id = v_user;
  if not found then raise exception 'Najprej ustvarite in arhivirajte PDF pogodbenega potrdila.'; end if;

  insert into public.pos_contract_confirmation_deliveries(
    user_id, work_order_id, confirmation_document_id, channel, recipient,
    evidence, electronic_consent_evidence, delivered_on
  ) values (
    v_user, v_order.id, v_document.id, v_channel, trim(v_order.customer_name),
    v_evidence, v_consent, p_delivered_on
  ) returning * into v_delivery;

  insert into public.pos_work_order_events(user_id, work_order_id, action, details)
  values (
    v_user,
    v_order.id,
    'contract_confirmation_delivered',
    jsonb_strip_nulls(jsonb_build_object(
      'channel', v_channel,
      'recipient', trim(v_order.customer_name),
      'evidence', v_evidence,
      'electronic_consent_evidence', v_consent,
      'delivered_on', p_delivered_on,
      'confirmation_document_id', v_document.id,
      'confirmation_sha256', v_document.sha256
    ))
  );
  return v_delivery;
end;
$$;

create or replace function public.pos_record_contract_confirmation_delivery(
  p_work_order_id uuid,
  p_channel text,
  p_evidence text,
  p_delivered_on date,
  p_electronic_consent_evidence text default null
)
returns public.pos_contract_confirmation_deliveries
language sql
security definer
set search_path = ''
as $$
  select private._pos_record_contract_confirmation_delivery(
    p_work_order_id, p_channel, p_evidence, p_delivered_on, p_electronic_consent_evidence
  );
$$;

revoke all on function private._pos_record_contract_confirmation_delivery(uuid,text,text,date,text)
  from public, anon, authenticated;
grant execute on function private._pos_record_contract_confirmation_delivery(uuid,text,text,date,text)
  to service_role;
revoke all on function public.pos_record_contract_confirmation_delivery(uuid,text,text,date,text)
  from public, anon;
grant execute on function public.pos_record_contract_confirmation_delivery(uuid,text,text,date,text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
