-- Independent write-once archive for every original POS document.
-- Supabase remains the operational store; AWS S3 Object Lock is the
-- geographically separate, versioned retention copy.

alter table private.pos_archive_configuration
  add column worm_provider text not null default 'aws_s3_object_lock'
    check (worm_provider = 'aws_s3_object_lock'),
  add column worm_environment text not null default 'not_configured'
    check (worm_environment in ('not_configured', 'test', 'production')),
  add column worm_object_lock_mode text not null default 'GOVERNANCE'
    check (worm_object_lock_mode in ('GOVERNANCE', 'COMPLIANCE')),
  add column worm_provider_ready boolean not null default false,
  add column worm_connectivity_tested_at timestamptz;

-- A historic manual backup is useful evidence, but it is not an automatic
-- per-document WORM replica. Require the new provider check before live use.
update private.pos_archive_configuration
set independent_backup_ready = false,
    worm_provider_ready = false,
    worm_environment = 'not_configured',
    recovery_tested_at = null,
    updated_at = now()
where singleton;

create table public.pos_archive_replicas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  archive_record_id uuid not null references public.pos_archive_records(id) on delete restrict,
  provider text not null default 'aws_s3_object_lock'
    check (provider = 'aws_s3_object_lock'),
  status text not null default 'pending'
    check (status in ('pending', 'copying', 'verified', 'failed')),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  bucket text check (bucket is null or char_length(bucket) between 3 and 63),
  object_key text check (object_key is null or char_length(object_key) between 1 and 900),
  object_version_id text check (object_version_id is null or char_length(object_version_id) between 1 and 1024),
  object_etag text check (object_etag is null or char_length(object_etag) between 1 and 160),
  remote_checksum_sha256 text
    check (remote_checksum_sha256 is null or remote_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  remote_byte_size bigint check (remote_byte_size is null or remote_byte_size > 0),
  object_lock_mode text check (object_lock_mode is null or object_lock_mode in ('GOVERNANCE', 'COMPLIANCE')),
  retain_until timestamptz,
  attempt_count integer not null default 0 check (attempt_count between 0 and 1000000),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  copied_at timestamptz,
  verified_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[A-Z0-9_]{1,80}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (archive_record_id, provider),
  check (
    status <> 'verified' or (
      bucket is not null and object_key is not null and object_version_id is not null
      and remote_checksum_sha256 = source_sha256
      and remote_byte_size is not null and object_lock_mode is not null
      and retain_until > copied_at and copied_at is not null and verified_at is not null
      and last_error_code is null
    )
  )
);

create table public.pos_archive_replica_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  archive_record_id uuid not null references public.pos_archive_records(id) on delete restrict,
  replica_id uuid not null references public.pos_archive_replicas(id) on delete restrict,
  result text not null check (result in ('queued', 'verified', 'failed')),
  provider text not null default 'aws_s3_object_lock'
    check (provider = 'aws_s3_object_lock'),
  error_code text check (error_code is null or error_code ~ '^[A-Z0-9_]{1,80}$'),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  checked_at timestamptz not null default now()
);

create index pos_archive_replicas_user_status_idx
  on public.pos_archive_replicas(user_id, status, next_attempt_at);
create index pos_archive_replicas_retry_idx
  on public.pos_archive_replicas(status, next_attempt_at, created_at);
create index pos_archive_replica_events_record_checked_idx
  on public.pos_archive_replica_events(archive_record_id, checked_at desc);
create index pos_archive_replica_events_user_checked_idx
  on public.pos_archive_replica_events(user_id, checked_at desc);

alter table public.pos_archive_replicas enable row level security;
alter table public.pos_archive_replica_events enable row level security;
revoke all on table public.pos_archive_replicas, public.pos_archive_replica_events
  from public, anon, authenticated;
grant select on table public.pos_archive_replicas, public.pos_archive_replica_events
  to authenticated;
grant all on table public.pos_archive_replicas, public.pos_archive_replica_events
  to service_role;

create policy pos_archive_replicas_select_own on public.pos_archive_replicas
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_archive_replica_events_select_own on public.pos_archive_replica_events
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create trigger pos_archive_replica_events_immutable
before update or delete on public.pos_archive_replica_events
for each row execute function private.pos_prevent_invoice_mutation();

create or replace function private.pos_archive_replica_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Arhivske replike ni dovoljeno izbrisati.';
  end if;
  if old.user_id <> new.user_id
    or old.archive_record_id <> new.archive_record_id
    or old.provider <> new.provider
    or old.source_sha256 <> new.source_sha256 then
    raise exception 'Izvorne identitete arhivske replike ni dovoljeno spreminjati.';
  end if;
  if old.copied_at is not null and (
    old.bucket is distinct from new.bucket
    or old.object_key is distinct from new.object_key
    or old.object_version_id is distinct from new.object_version_id
    or old.object_etag is distinct from new.object_etag
    or old.remote_checksum_sha256 is distinct from new.remote_checksum_sha256
    or old.remote_byte_size is distinct from new.remote_byte_size
    or old.object_lock_mode is distinct from new.object_lock_mode
    or old.retain_until is distinct from new.retain_until
    or old.copied_at is distinct from new.copied_at
  ) then
    raise exception 'Identitete in zaklepa že zapisane arhivske replike ni dovoljeno spreminjati.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger pos_archive_replicas_guard
before update or delete on public.pos_archive_replicas
for each row execute function private.pos_archive_replica_guard();

create or replace function private.pos_archive_enqueue_replica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replica_id uuid;
begin
  insert into public.pos_archive_replicas(user_id, archive_record_id, source_sha256)
  values (new.user_id, new.id, new.sha256)
  on conflict (archive_record_id, provider) do nothing
  returning id into v_replica_id;

  if v_replica_id is not null then
    insert into public.pos_archive_replica_events(
      user_id, archive_record_id, replica_id, result, details
    ) values (
      new.user_id, new.id, v_replica_id, 'queued',
      jsonb_build_object('reason', 'archive_record_created')
    );
  end if;
  return new;
end;
$$;

create trigger pos_archive_records_enqueue_replica
after insert on public.pos_archive_records
for each row execute function private.pos_archive_enqueue_replica();

with inserted as (
  insert into public.pos_archive_replicas(user_id, archive_record_id, source_sha256)
  select r.user_id, r.id, r.sha256
  from public.pos_archive_records r
  on conflict (archive_record_id, provider) do nothing
  returning id, user_id, archive_record_id
)
insert into public.pos_archive_replica_events(
  user_id, archive_record_id, replica_id, result, details
)
select user_id, archive_record_id, id, 'queued',
  jsonb_build_object('reason', 'migration_backfill')
from inserted;

create or replace function public.pos_archive_replica_batch(p_limit integer default 10)
returns table (
  replica_id uuid,
  replica_attempt_count integer,
  replica_bucket text,
  replica_object_key text,
  replica_object_version_id text,
  replica_object_lock_mode text,
  replica_retain_until timestamptz,
  id uuid,
  user_id uuid,
  invoice_id uuid,
  storage_bucket text,
  storage_path text,
  original_media_type text,
  sha256 text,
  byte_size bigint,
  retention_not_before date,
  is_test boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required.';
  end if;

  return query
  with candidates as (
    select replica.id
    from public.pos_archive_replicas replica
    where (
      (replica.status in ('pending', 'failed') and replica.next_attempt_at <= now())
      or (replica.status = 'copying' and replica.last_attempt_at < now() - interval '15 minutes')
      or (
        replica.status = 'verified' and not exists (
          select 1 from public.pos_archive_replica_events event
          where event.replica_id = replica.id
            and event.result = 'verified'
            and event.checked_at >= now() - interval '90 days'
        )
      )
    )
    order by replica.next_attempt_at asc, replica.created_at asc
    for update skip locked
    limit least(greatest(coalesce(p_limit, 10), 1), 25)
  ), claimed as (
    update public.pos_archive_replicas replica
    set status = 'copying',
        attempt_count = replica.attempt_count + 1,
        last_attempt_at = now(),
        last_error_code = null
    from candidates
    where replica.id = candidates.id
    returning replica.*
  )
  select claimed.id, claimed.attempt_count,
    claimed.bucket, claimed.object_key, claimed.object_version_id,
    claimed.object_lock_mode, claimed.retain_until,
    record.id, record.user_id, record.invoice_id,
    record.storage_bucket, record.storage_path, record.original_media_type,
    record.sha256, record.byte_size, record.retention_not_before,
    invoice.is_test
  from claimed
  join public.pos_archive_records record on record.id = claimed.archive_record_id
  join public.pos_invoices invoice on invoice.id = record.invoice_id
  order by claimed.created_at asc;
end;
$$;

create or replace function public.pos_archive_replica_complete(
  p_replica_id uuid,
  p_bucket text,
  p_object_key text,
  p_object_version_id text,
  p_object_etag text,
  p_remote_checksum_sha256 text,
  p_remote_byte_size bigint,
  p_object_lock_mode text,
  p_retain_until timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replica public.pos_archive_replicas%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required.';
  end if;

  select * into v_replica
  from public.pos_archive_replicas
  where id = p_replica_id
  for update;
  if not found then raise exception 'Arhivska replika ne obstaja.'; end if;
  if v_replica.status = 'verified' then return; end if;
  if p_remote_checksum_sha256 <> v_replica.source_sha256 then
    raise exception 'Kontrolna vsota oddaljene kopije se ne ujema.';
  end if;
  if p_object_lock_mode not in ('GOVERNANCE', 'COMPLIANCE') or p_retain_until <= now() then
    raise exception 'Oddaljena kopija nima veljavnega zaklepa hrambe.';
  end if;

  update public.pos_archive_replicas
  set status = 'verified', bucket = p_bucket, object_key = p_object_key,
      object_version_id = p_object_version_id, object_etag = p_object_etag,
      remote_checksum_sha256 = p_remote_checksum_sha256,
      remote_byte_size = p_remote_byte_size,
      object_lock_mode = p_object_lock_mode, retain_until = p_retain_until,
      copied_at = coalesce(copied_at, now()), verified_at = now(),
      next_attempt_at = p_retain_until, last_error_code = null
  where id = p_replica_id;

  insert into public.pos_archive_replica_events(
    user_id, archive_record_id, replica_id, result, details
  ) values (
    v_replica.user_id, v_replica.archive_record_id, v_replica.id, 'verified',
    jsonb_build_object('bucket', p_bucket, 'objectKey', p_object_key,
      'versionId', p_object_version_id, 'mode', p_object_lock_mode,
      'retainUntil', p_retain_until, 'sha256', p_remote_checksum_sha256,
      'byteSize', p_remote_byte_size)
  );
end;
$$;

create or replace function public.pos_archive_replica_fail(
  p_replica_id uuid,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replica public.pos_archive_replicas%rowtype;
  v_code text := upper(coalesce(p_error_code, 'UNKNOWN_ERROR'));
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required.';
  end if;
  if v_code !~ '^[A-Z0-9_]{1,80}$' then v_code := 'UNKNOWN_ERROR'; end if;

  select * into v_replica
  from public.pos_archive_replicas
  where id = p_replica_id
  for update;
  if not found or v_replica.status = 'verified' then return; end if;

  update public.pos_archive_replicas
  set status = 'failed', last_error_code = v_code,
      next_attempt_at = now() + make_interval(hours => least(24, greatest(1, attempt_count * 2)))
  where id = p_replica_id;

  insert into public.pos_archive_replica_events(
    user_id, archive_record_id, replica_id, result, error_code, details
  ) values (
    v_replica.user_id, v_replica.archive_record_id, v_replica.id,
    'failed', v_code, jsonb_build_object('attempt', v_replica.attempt_count)
  );
end;
$$;

create or replace function public.pos_archive_provider_heartbeat(
  p_environment text,
  p_object_lock_mode text,
  p_recovery_tested boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required.';
  end if;
  if (p_environment = 'test' and p_object_lock_mode <> 'GOVERNANCE')
    or (p_environment = 'production' and p_object_lock_mode <> 'COMPLIANCE')
    or p_environment not in ('test', 'production') then
    raise exception 'Neveljavna nastavitev AWS arhivskega okolja.';
  end if;

  update private.pos_archive_configuration
  set independent_backup_ready = true,
      backup_provider = 'AWS S3 Object Lock',
      worm_provider_ready = true,
      worm_environment = p_environment,
      worm_object_lock_mode = p_object_lock_mode,
      worm_connectivity_tested_at = now(),
      recovery_tested_at = case when p_recovery_tested then now() else recovery_tested_at end,
      updated_at = now()
  where singleton;
  return private.pos_archive_readiness();
end;
$$;

create or replace function public.pos_archive_provider_fail(p_error_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required.';
  end if;
  update private.pos_archive_configuration
  set independent_backup_ready = false,
      worm_provider_ready = false,
      updated_at = now()
  where singleton;
end;
$$;

create or replace function private.pos_archive_production_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select independent_backup_ready
      and worm_provider_ready
      and worm_provider = 'aws_s3_object_lock'
      and worm_environment = 'production'
      and worm_object_lock_mode = 'COMPLIANCE'
      and worm_connectivity_tested_at >= now() - interval '30 days'
      and recovery_tested_at >= now() - interval '365 days'
    from private.pos_archive_configuration where singleton
  ), false);
$$;

create or replace function private.pos_archive_readiness()
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
    'wormProvider', worm_provider,
    'wormEnvironment', worm_environment,
    'objectLockMode', worm_object_lock_mode,
    'wormProviderReady', worm_provider_ready,
    'wormConnectivityTestedAt', worm_connectivity_tested_at,
    'productionReady', private.pos_archive_production_ready()
  ) into v_result
  from private.pos_archive_configuration where singleton;
  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function private.pos_archive_replica_guard() from public, anon, authenticated;
revoke all on function private.pos_archive_enqueue_replica() from public, anon, authenticated;
revoke all on function public.pos_archive_replica_batch(integer) from public, anon, authenticated;
revoke all on function public.pos_archive_replica_complete(uuid, text, text, text, text, text, bigint, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.pos_archive_replica_fail(uuid, text) from public, anon, authenticated;
revoke all on function public.pos_archive_provider_heartbeat(text, text, boolean) from public, anon, authenticated;
revoke all on function public.pos_archive_provider_fail(text) from public, anon, authenticated;
grant execute on function private.pos_archive_replica_guard(), private.pos_archive_enqueue_replica()
  to service_role;
grant execute on function public.pos_archive_replica_batch(integer),
  public.pos_archive_replica_complete(uuid, text, text, text, text, text, bigint, text, timestamptz),
  public.pos_archive_replica_fail(uuid, text),
  public.pos_archive_provider_heartbeat(text, text, boolean),
  public.pos_archive_provider_fail(text)
  to service_role;

notify pgrst, 'reload schema';
