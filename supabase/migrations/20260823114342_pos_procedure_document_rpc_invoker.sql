-- The RPC is callable only by service_role, which already has the required
-- table privileges and bypasses RLS. SECURITY INVOKER therefore preserves the
-- same server behaviour without granting the function owner's privileges.

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
security invoker
set search_path = ''
as $$
declare
  v_existing public.pos_procedure_document_versions;
  v_version bigint;
  v_year integer;
begin
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

notify pgrst, 'reload schema';

;
