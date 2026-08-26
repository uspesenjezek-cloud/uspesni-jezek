-- Versioned, immutable archive for the GoBD procedure documentation itself.
-- These organizational documents are retained for ten years from the end of
-- their creation year (AO section 147). Storage remains private and is only
-- accessed by the authenticated server endpoint.

create table public.pos_procedure_document_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  version_number bigint not null check (version_number > 0),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  storage_bucket text not null default 'pos-procedure-documents'
    check (storage_bucket = 'pos-procedure-documents'),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 5242880),
  media_type text not null default 'application/pdf' check (media_type = 'application/pdf'),
  generator_version text not null check (char_length(generator_version) between 1 and 80),
  profile_snapshot jsonb not null check (jsonb_typeof(profile_snapshot) = 'object'),
  archive_snapshot jsonb not null check (jsonb_typeof(archive_snapshot) = 'object'),
  environment text not null check (environment in ('production', 'test')),
  created_at timestamptz not null default now(),
  retention_years smallint not null default 10 check (retention_years = 10),
  retention_not_before date not null,
  retention_basis text not null default 'AO § 147 Abs. 1 Nr. 1, Abs. 3'
    check (char_length(retention_basis) between 1 and 120),
  unique (user_id, version_number),
  unique (user_id, source_fingerprint),
  unique (storage_bucket, storage_path)
);

create index pos_procedure_document_versions_user_created_idx
  on public.pos_procedure_document_versions(user_id, created_at desc);
create index pos_procedure_document_versions_retention_idx
  on public.pos_procedure_document_versions(retention_not_before);

alter table public.pos_procedure_document_versions enable row level security;
revoke all on table public.pos_procedure_document_versions from public, anon, authenticated;
grant select on table public.pos_procedure_document_versions to authenticated;
grant all on table public.pos_procedure_document_versions to service_role;

create policy pos_procedure_document_versions_select_own
on public.pos_procedure_document_versions
for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create trigger pos_procedure_document_versions_immutable
before update or delete on public.pos_procedure_document_versions
for each row execute function private.pos_prevent_invoice_mutation();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pos-procedure-documents', 'pos-procedure-documents', false, 5242880, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The object itself is never directly exposed to browser roles. The service
-- endpoint uses the service role after authenticating the caller and checking
-- the tenant-bound metadata row above.
drop policy if exists pos_procedure_documents_select on storage.objects;
drop policy if exists pos_procedure_documents_insert on storage.objects;
drop policy if exists pos_procedure_documents_update on storage.objects;
drop policy if exists pos_procedure_documents_delete on storage.objects;

create or replace function public.pos_archive_procedure_document_version(
  p_user_id uuid,
  p_source_fingerprint text,
  p_storage_path text,
  p_sha256 text,
  p_byte_size bigint,
  p_generator_version text,
  p_profile_snapshot jsonb,
  p_archive_snapshot jsonb,
  p_environment text
)
returns public.pos_procedure_document_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.pos_procedure_document_versions;
  v_version bigint;
  v_year integer;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Ta operacija je dovoljena samo strežniški storitvi.';
  end if;
  if p_user_id is null or p_source_fingerprint !~ '^[0-9a-f]{64}$'
    or p_sha256 !~ '^[0-9a-f]{64}$' or p_byte_size < 1 or p_byte_size > 5242880
    or char_length(coalesce(p_storage_path, '')) not between 1 and 500
    or p_storage_path <> p_user_id::text || '/' || p_source_fingerprint || '.pdf'
    or char_length(coalesce(p_generator_version, '')) not between 1 and 80
    or jsonb_typeof(p_profile_snapshot) <> 'object'
    or jsonb_typeof(p_archive_snapshot) <> 'object'
    or p_environment not in ('production', 'test') then
    raise exception 'Metapodatki različice Verfahrensdokumentation niso veljavni.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  select * into v_existing
  from public.pos_procedure_document_versions
  where user_id = p_user_id and source_fingerprint = p_source_fingerprint;
  if found then return v_existing; end if;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.pos_procedure_document_versions where user_id = p_user_id;
  v_year := extract(year from (now() at time zone 'Europe/Berlin'))::integer;

  insert into public.pos_procedure_document_versions(
    user_id, version_number, source_fingerprint, storage_path, sha256,
    byte_size, generator_version, profile_snapshot, archive_snapshot,
    environment, retention_not_before
  ) values (
    p_user_id, v_version, p_source_fingerprint, p_storage_path, p_sha256,
    p_byte_size, p_generator_version, p_profile_snapshot, p_archive_snapshot,
    p_environment, make_date(v_year + 10, 12, 31)
  ) returning * into v_existing;
  return v_existing;
end;
$$;

revoke all on function public.pos_archive_procedure_document_version(uuid, text, text, text, bigint, text, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.pos_archive_procedure_document_version(uuid, text, text, text, bigint, text, jsonb, jsonb, text)
  to service_role;

create or replace function private.pos_block_unsafe_auth_user_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.pos_invoices as invoice
    where invoice.user_id = old.id and not invoice.is_test
  ) or exists (
    select 1 from public.pos_archive_records as archive_record
    where archive_record.user_id = old.id
  ) or exists (
    select 1 from public.pos_procedure_document_versions as procedure_version
    where procedure_version.user_id = old.id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Uporabniškega računa ni mogoče izbrisati, ker vsebuje dokumente z zakonsko hrambo.',
      detail = 'Dostop deaktivirajte; račun in arhiv morata ostati nespremenjena do retention-safe offboardinga.',
      hint = 'Ne brišite auth uporabnika, dokler pravni in arhivski POS zapisi niso varno preneseni na trajnega pravnega nosilca.';
  end if;
  return old;
end;
$$;

revoke all on function private.pos_block_unsafe_auth_user_delete() from public, anon, authenticated;
grant execute on function private.pos_block_unsafe_auth_user_delete() to service_role;

notify pgrst, 'reload schema';

;
