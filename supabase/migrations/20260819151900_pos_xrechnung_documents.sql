-- Nespremenljivi XRechnung UBL originali in sled uradne KoSIT validacije.
-- Izdaja računa in validacija sta namenoma ločeni: natančen XML lahko nastane
-- šele iz zaklenjenega posnetka izdanega računa. Dostava mora pozneje zahtevati
-- status "validated"; uporabniški boolean ni dokaz validacije.

alter table public.pos_business_profiles
  add column business_phone text not null default ''
  check (char_length(business_phone) <= 60);
create table public.pos_einvoice_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.pos_invoices(id) on delete restrict,
  document_kind text not null default 'xrechnung_ubl' check (document_kind = 'xrechnung_ubl'),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 2097152),
  media_type text not null default 'application/xml' check (media_type = 'application/xml'),
  generator_version text not null check (char_length(generator_version) between 1 and 80),
  xrechnung_version text not null check (char_length(xrechnung_version) between 1 and 30),
  validation_status text not null default 'pending' check (validation_status in ('pending','validated','failed')),
  validator_name text not null default 'KoSIT' check (validator_name = 'KoSIT'),
  validator_version text not null check (char_length(validator_version) between 1 and 30),
  validator_config_version text not null check (char_length(validator_config_version) between 1 and 30),
  validation_report jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_report) = 'object'),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, document_kind),
  unique (storage_path),
  check ((validation_status = 'validated' and validated_at is not null) or (validation_status <> 'validated' and validated_at is null))
);
create table public.pos_einvoice_validation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.pos_einvoice_documents(id) on delete restrict,
  result text not null check (result in ('pending','validated','failed')),
  report jsonb not null default '{}'::jsonb check (jsonb_typeof(report) = 'object'),
  created_at timestamptz not null default now()
);
create index pos_einvoice_documents_user_created_idx
  on public.pos_einvoice_documents(user_id, created_at desc);
create index pos_einvoice_documents_pending_idx
  on public.pos_einvoice_documents(user_id, updated_at)
  where validation_status <> 'validated';
create index pos_einvoice_validation_events_document_created_idx
  on public.pos_einvoice_validation_events(document_id, created_at desc);
create index pos_einvoice_validation_events_user_created_idx
  on public.pos_einvoice_validation_events(user_id, created_at desc);
alter table public.pos_einvoice_documents enable row level security;
alter table public.pos_einvoice_validation_events enable row level security;
revoke all on table public.pos_einvoice_documents, public.pos_einvoice_validation_events from public, anon, authenticated;
grant select on table public.pos_einvoice_documents, public.pos_einvoice_validation_events to authenticated;
grant all on table public.pos_einvoice_documents, public.pos_einvoice_validation_events to service_role;
create policy pos_einvoice_documents_select_own on public.pos_einvoice_documents
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_einvoice_validation_events_select_own on public.pos_einvoice_validation_events
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create or replace function private.pos_protect_einvoice_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Arhiviranega XRechnung dokumenta ni dovoljeno izbrisati.';
  end if;
  if new.user_id is distinct from old.user_id
    or new.invoice_id is distinct from old.invoice_id
    or new.document_kind is distinct from old.document_kind
    or new.storage_path is distinct from old.storage_path
    or new.sha256 is distinct from old.sha256
    or new.byte_size is distinct from old.byte_size
    or new.media_type is distinct from old.media_type
    or new.generator_version is distinct from old.generator_version
    or new.xrechnung_version is distinct from old.xrechnung_version
    or new.created_at is distinct from old.created_at then
    raise exception 'Jedro arhiviranega XRechnung dokumenta je nespremenljivo.';
  end if;
  return new;
end;
$$;
create trigger pos_einvoice_documents_protected
before update or delete on public.pos_einvoice_documents
for each row execute function private.pos_protect_einvoice_document();
create trigger pos_einvoice_validation_events_immutable
before update or delete on public.pos_einvoice_validation_events
for each row execute function private.pos_prevent_invoice_mutation();
revoke all on function private.pos_protect_einvoice_document() from public, anon, authenticated;
grant execute on function private.pos_protect_einvoice_document() to service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pos-einvoice-originals', 'pos-einvoice-originals', false, 2097152, array['application/xml'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Brskalnik nima storage.objects politike. XML prebira le endpoint, ki najprej
-- preveri JWT in lastništvo računa ter nato ponovno preveri SHA-256.

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
  -- p_einvoice_validated ostaja le zaradi združljivosti starega odjemalca.
  -- Pravi dokaz se zapiše šele v pos_einvoice_documents iz KoSIT poročila.
  select private._pos_issue_invoice(
    p_draft_id,
    p_payload || jsonb_build_object(
      'seller_contact_phone', coalesce((select business_phone from public.pos_business_profiles where user_id = (select auth.uid())), '')
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
security invoker
set search_path = ''
as $$
  select private._pos_issue_replacement_invoice(
    p_draft_id,
    p_payload || jsonb_build_object(
      'seller_contact_phone', coalesce((select business_phone from public.pos_business_profiles where user_id = (select auth.uid())), '')
    ),
    p_final_confirmed,
    true,
    p_cancellation_adjustment_id
  );
$$;
revoke all on function public.pos_issue_invoice(uuid,jsonb,boolean,boolean) from public, anon;
revoke all on function public.pos_issue_replacement_invoice(uuid,jsonb,boolean,boolean,uuid) from public, anon;
grant execute on function public.pos_issue_invoice(uuid,jsonb,boolean,boolean) to authenticated, service_role;
grant execute on function public.pos_issue_replacement_invoice(uuid,jsonb,boolean,boolean,uuid) to authenticated, service_role;
notify pgrst, 'reload schema';
