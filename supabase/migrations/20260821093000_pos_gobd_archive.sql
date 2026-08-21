-- GoBD archive register for the original POS documents.
-- German invoice and booking-document retention is currently at least eight
-- years. Nothing is deleted automatically because tax limitation periods and
-- legal holds may extend that minimum.

create table private.pos_archive_configuration (
  singleton boolean primary key default true check (singleton),
  retention_years smallint not null default 8 check (retention_years = 8),
  storage_encryption_scope text not null default 'provider_managed_at_rest'
    check (storage_encryption_scope = 'provider_managed_at_rest'),
  independent_backup_ready boolean not null default false,
  backup_provider text not null default '' check (char_length(backup_provider) <= 120),
  recovery_tested_at timestamptz,
  updated_at timestamptz not null default now(),
  check (not independent_backup_ready or (trim(backup_provider) <> '' and recovery_tested_at is not null))
);

insert into private.pos_archive_configuration(singleton)
values (true)
on conflict (singleton) do nothing;

revoke all on table private.pos_archive_configuration from public, anon, authenticated;
grant select, update on table private.pos_archive_configuration to service_role;

create table public.pos_archive_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  invoice_id uuid not null references public.pos_invoices(id) on delete restrict,
  source_table text not null check (source_table in ('pos_invoice_documents','pos_einvoice_documents','pos_adjustment_documents')),
  source_id uuid not null,
  storage_bucket text not null check (storage_bucket in ('pos-invoice-originals','pos-einvoice-originals')),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  document_kind text not null check (char_length(document_kind) between 1 and 80),
  original_media_type text not null check (original_media_type in ('application/pdf','application/xml')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 5242880),
  archived_at timestamptz not null,
  retention_years smallint not null default 8 check (retention_years = 8),
  retention_not_before date not null,
  retention_basis text not null default 'UStG § 14b; AO § 147'
    check (char_length(retention_basis) between 1 and 120),
  encryption_scope text not null default 'provider_managed_at_rest'
    check (encryption_scope = 'provider_managed_at_rest'),
  created_at timestamptz not null default now(),
  unique (source_table, source_id),
  unique (storage_bucket, storage_path)
);

create table public.pos_archive_integrity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  archive_record_id uuid not null references public.pos_archive_records(id) on delete restrict,
  result text not null check (result in ('verified','missing','hash_mismatch','size_mismatch','error')),
  observed_sha256 text check (observed_sha256 is null or observed_sha256 ~ '^[0-9a-f]{64}$'),
  observed_byte_size bigint check (observed_byte_size is null or observed_byte_size >= 0),
  checker_version text not null check (char_length(checker_version) between 1 and 80),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  checked_at timestamptz not null default now()
);

create index pos_archive_records_user_created_idx
  on public.pos_archive_records(user_id, created_at desc);
create index pos_archive_records_invoice_idx
  on public.pos_archive_records(invoice_id, archived_at);
create index pos_archive_records_retention_idx
  on public.pos_archive_records(retention_not_before);
create index pos_archive_integrity_record_checked_idx
  on public.pos_archive_integrity_events(archive_record_id, checked_at desc);
create index pos_archive_integrity_user_checked_idx
  on public.pos_archive_integrity_events(user_id, checked_at desc);

alter table public.pos_archive_records enable row level security;
alter table public.pos_archive_integrity_events enable row level security;
revoke all on table public.pos_archive_records, public.pos_archive_integrity_events from public, anon, authenticated;
grant select on table public.pos_archive_records, public.pos_archive_integrity_events to authenticated;
grant all on table public.pos_archive_records, public.pos_archive_integrity_events to service_role;

create policy pos_archive_records_select_own on public.pos_archive_records
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_archive_integrity_events_select_own on public.pos_archive_integrity_events
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create trigger pos_archive_records_immutable
before update or delete on public.pos_archive_records
for each row execute function private.pos_prevent_invoice_mutation();
create trigger pos_archive_integrity_events_immutable
before update or delete on public.pos_archive_integrity_events
for each row execute function private.pos_prevent_invoice_mutation();
create trigger pos_audit_events_immutable
before update or delete on public.pos_audit_events
for each row execute function private.pos_prevent_invoice_mutation();

create or replace function private.pos_archive_document_manifest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_id uuid;
  v_issue_year integer;
  v_bucket text;
begin
  if tg_table_name = 'pos_adjustment_documents' then
    select a.original_invoice_id, extract(year from a.issued_at)::integer
      into v_invoice_id, v_issue_year
    from public.pos_invoice_adjustments a
    where a.id = new.adjustment_id and a.user_id = new.user_id;
    v_bucket := 'pos-invoice-originals';
  else
    select i.id, extract(year from i.issue_date)::integer
      into v_invoice_id, v_issue_year
    from public.pos_invoices i
    where i.id = new.invoice_id and i.user_id = new.user_id;
    v_bucket := case when tg_table_name = 'pos_einvoice_documents'
      then 'pos-einvoice-originals' else 'pos-invoice-originals' end;
  end if;

  if v_invoice_id is null or v_issue_year is null then
    raise exception 'Arhivskega dokumenta ni mogoče povezati z računom.';
  end if;

  insert into public.pos_archive_records(
    user_id, invoice_id, source_table, source_id, storage_bucket, storage_path,
    document_kind, original_media_type, sha256, byte_size, archived_at,
    retention_years, retention_not_before
  ) values (
    new.user_id, v_invoice_id, tg_table_name, new.id, v_bucket, new.storage_path,
    new.document_kind, new.media_type, new.sha256, new.byte_size, new.created_at,
    8, make_date(v_issue_year + 8, 12, 31)
  );
  return new;
end;
$$;

revoke all on function private.pos_archive_document_manifest() from public, anon, authenticated;
grant execute on function private.pos_archive_document_manifest() to service_role;

create trigger pos_invoice_documents_archive_manifest
after insert on public.pos_invoice_documents
for each row execute function private.pos_archive_document_manifest();
create trigger pos_einvoice_documents_archive_manifest
after insert on public.pos_einvoice_documents
for each row execute function private.pos_archive_document_manifest();
create trigger pos_adjustment_documents_archive_manifest
after insert on public.pos_adjustment_documents
for each row execute function private.pos_archive_document_manifest();

-- Backfill every already archived original before the feature is enabled.
insert into public.pos_archive_records(
  user_id, invoice_id, source_table, source_id, storage_bucket, storage_path,
  document_kind, original_media_type, sha256, byte_size, archived_at,
  retention_years, retention_not_before
)
select d.user_id, d.invoice_id, 'pos_invoice_documents', d.id,
  'pos-invoice-originals', d.storage_path, d.document_kind, d.media_type,
  d.sha256, d.byte_size, d.created_at, 8,
  make_date(extract(year from i.issue_date)::integer + 8, 12, 31)
from public.pos_invoice_documents d
join public.pos_invoices i on i.id = d.invoice_id
on conflict (source_table, source_id) do nothing;

insert into public.pos_archive_records(
  user_id, invoice_id, source_table, source_id, storage_bucket, storage_path,
  document_kind, original_media_type, sha256, byte_size, archived_at,
  retention_years, retention_not_before
)
select d.user_id, d.invoice_id, 'pos_einvoice_documents', d.id,
  'pos-einvoice-originals', d.storage_path, d.document_kind, d.media_type,
  d.sha256, d.byte_size, d.created_at, 8,
  make_date(extract(year from i.issue_date)::integer + 8, 12, 31)
from public.pos_einvoice_documents d
join public.pos_invoices i on i.id = d.invoice_id
on conflict (source_table, source_id) do nothing;

insert into public.pos_archive_records(
  user_id, invoice_id, source_table, source_id, storage_bucket, storage_path,
  document_kind, original_media_type, sha256, byte_size, archived_at,
  retention_years, retention_not_before
)
select d.user_id, a.original_invoice_id, 'pos_adjustment_documents', d.id,
  'pos-invoice-originals', d.storage_path, d.document_kind, d.media_type,
  d.sha256, d.byte_size, d.created_at, 8,
  make_date(extract(year from a.issued_at)::integer + 8, 12, 31)
from public.pos_adjustment_documents d
join public.pos_invoice_adjustments a on a.id = d.adjustment_id
on conflict (source_table, source_id) do nothing;

create or replace function private.pos_archive_production_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select independent_backup_ready
      and trim(backup_provider) <> ''
      and recovery_tested_at is not null
      and recovery_tested_at >= now() - interval '365 days'
    from private.pos_archive_configuration where singleton
  ), false);
$$;

create or replace function private.pos_require_archive_before_live_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_test and not private.pos_archive_production_ready() then
    raise exception 'Produkcijska izdaja je zaklenjena, dokler ni potrjena neodvisna arhivska kopija in uspešen preizkus obnove.';
  end if;
  return new;
end;
$$;

create trigger pos_invoices_require_archive_for_live
before insert on public.pos_invoices
for each row execute function private.pos_require_archive_before_live_invoice();

create or replace function public.pos_archive_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce((select auth.role()), '');
  v_result jsonb;
begin
  if (select auth.uid()) is null and v_role <> 'service_role' then
    raise exception 'Prijava je obvezna.';
  end if;
  select jsonb_build_object(
    'retentionYears', retention_years,
    'encryptionScope', storage_encryption_scope,
    'independentBackupReady', independent_backup_ready,
    'recoveryTestedAt', recovery_tested_at,
    'productionReady', private.pos_archive_production_ready()
  ) into v_result
  from private.pos_archive_configuration where singleton;
  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.pos_archive_integrity_batch(p_limit integer default 25)
returns setof public.pos_archive_records
language sql
stable
security invoker
set search_path = ''
as $$
  select r.*
  from public.pos_archive_records r
  where not exists (
    select 1 from public.pos_archive_integrity_events e
    where e.archive_record_id = r.id
      and e.checked_at >= now() - interval '90 days'
  )
  order by r.archived_at asc
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

revoke all on function private.pos_archive_production_ready() from public, anon, authenticated;
revoke all on function private.pos_require_archive_before_live_invoice() from public, anon, authenticated;
revoke all on function public.pos_archive_readiness() from public, anon;
revoke all on function public.pos_archive_integrity_batch(integer) from public, anon, authenticated;
grant execute on function private.pos_archive_production_ready(), private.pos_require_archive_before_live_invoice() to service_role;
grant execute on function public.pos_archive_readiness() to authenticated, service_role;
grant execute on function public.pos_archive_integrity_batch(integer) to service_role;

notify pgrst, 'reload schema';
