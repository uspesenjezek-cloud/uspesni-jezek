-- Recovery of a missing primary Storage object is allowed only from the exact
-- already-verified AWS Object Lock version. Production readiness additionally
-- requires the latest primary-integrity observation for every live record to
-- be a fresh success.

create or replace function public.pos_archive_primary_recovery_batch(
  p_limit integer default 10
)
returns table(
  replica_id uuid,
  missing_integrity_event_id uuid,
  replica_bucket text,
  replica_object_key text,
  replica_object_version_id text,
  replica_object_lock_mode text,
  replica_retain_until timestamptz,
  replica_last_attempt_at timestamptz,
  replica_copied_at timestamptz,
  id uuid,
  user_id uuid,
  invoice_id uuid,
  work_order_id uuid,
  procedure_version_id uuid,
  source_table text,
  source_id uuid,
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
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'Service role is required.';
  end if;

  return query
  select replica.id,
    latest.id,
    replica.bucket,
    replica.object_key,
    replica.object_version_id,
    replica.object_lock_mode,
    replica.retain_until,
    replica.last_attempt_at,
    replica.copied_at,
    record.id,
    record.user_id,
    record.invoice_id,
    record.work_order_id,
    record.procedure_version_id,
    record.source_table,
    record.source_id,
    record.storage_bucket,
    record.storage_path,
    record.original_media_type,
    record.sha256,
    record.byte_size,
    record.retention_not_before,
    record.is_test
  from public.pos_archive_records record
  join lateral (
    select event.id, event.result, event.checked_at
    from public.pos_archive_integrity_events event
    where event.archive_record_id = record.id
    order by event.checked_at desc, event.id desc
    limit 1
  ) latest on true
  join public.pos_archive_replicas replica
    on replica.archive_record_id = record.id
   and replica.provider = 'aws_s3_object_lock'
   and replica.status = 'verified'
   and replica.source_sha256 = record.sha256
   and replica.remote_checksum_sha256 = record.sha256
   and replica.remote_byte_size = record.byte_size
  where latest.result = 'missing'
    and replica.bucket is not null
    and replica.object_key is not null
    and nullif(trim(replica.object_version_id), '') is not null
    and replica.object_lock_mode in ('GOVERNANCE', 'COMPLIANCE')
    and replica.retain_until is not null
    and replica.last_attempt_at is not null
    and replica.copied_at is not null
    and (
      record.is_test
      or (
        replica.object_lock_mode = 'COMPLIANCE'
        and replica.retain_until >= (
          record.retention_not_before::timestamptz + interval '1 day' - interval '1 millisecond'
        )
      )
    )
  order by record.is_test, latest.checked_at, record.archived_at, record.id
  limit least(greatest(coalesce(p_limit, 10), 1), 25);
end;
$$;

create or replace function public.pos_archive_primary_recovery_complete(
  p_replica_id uuid,
  p_missing_integrity_event_id uuid,
  p_verified_integrity_event_id uuid,
  p_object_version_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replica public.pos_archive_replicas%rowtype;
  v_record public.pos_archive_records%rowtype;
  v_missing_event public.pos_archive_integrity_events%rowtype;
  v_verified_event public.pos_archive_integrity_events%rowtype;
  v_latest_event_id uuid;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'Service role is required.';
  end if;

  select replica.* into v_replica
  from public.pos_archive_replicas replica
  where replica.id = p_replica_id
  for update;
  if not found then raise exception 'Arhivska replika ne obstaja.'; end if;

  select record.* into v_record
  from public.pos_archive_records record
  where record.id = v_replica.archive_record_id;
  if not found then raise exception 'Arhivski zapis ne obstaja.'; end if;

  select event.* into v_missing_event
  from public.pos_archive_integrity_events event
  where event.id = p_missing_integrity_event_id
    and event.archive_record_id = v_record.id
    and event.user_id = v_record.user_id;
  if not found then raise exception 'Dokaz manjkajočega primarnega objekta ne obstaja.'; end if;
  if v_missing_event.result <> 'missing' then
    raise exception 'Začetni dokaz obnove ne potrjuje manjkajočega primarnega objekta.';
  end if;

  select event.* into v_verified_event
  from public.pos_archive_integrity_events event
  where event.id = p_verified_integrity_event_id
    and event.archive_record_id = v_record.id
    and event.user_id = v_record.user_id;
  if not found then raise exception 'Dokaz preverjenega primarnega objekta ne obstaja.'; end if;

  select event.id into v_latest_event_id
  from public.pos_archive_integrity_events event
  where event.archive_record_id = v_record.id
    and event.user_id = v_record.user_id
  order by event.checked_at desc, event.id desc
  limit 1;

  if v_replica.status <> 'verified'
    or nullif(trim(v_replica.object_version_id), '') is null
    or v_replica.object_version_id is distinct from p_object_version_id
    or v_replica.source_sha256 is distinct from v_record.sha256
    or v_replica.remote_checksum_sha256 is distinct from v_record.sha256
    or v_replica.remote_byte_size is distinct from v_record.byte_size then
    raise exception 'Identiteta preverjene WORM različice ni skladna.';
  end if;
  if v_verified_event.result <> 'verified'
    or v_verified_event.observed_sha256 is distinct from v_record.sha256
    or v_verified_event.observed_byte_size is distinct from v_record.byte_size then
    raise exception 'Obnovljeni primarni objekt ni prestal preverjanja celovitosti.';
  end if;
  if v_verified_event.checked_at <= v_missing_event.checked_at then
    raise exception 'Preverjanje obnovljenega objekta ni poznejše od dogodka manjkajočega objekta.';
  end if;
  if v_latest_event_id is distinct from v_verified_event.id then
    raise exception 'Preverjanje obnovljenega objekta ni najnovejši dogodek celovitosti.';
  end if;

  insert into public.pos_archive_replica_events(
    user_id, archive_record_id, replica_id, result, provider, details
  )
  select v_record.user_id, v_record.id, v_replica.id, 'verified',
    'aws_s3_object_lock',
    jsonb_build_object(
      'operation', 'primary_restore',
      'missingIntegrityEventId', v_missing_event.id,
      'verifiedIntegrityEventId', v_verified_event.id,
      'versionId', v_replica.object_version_id,
      'sha256', v_record.sha256,
      'byteSize', v_record.byte_size
    )
  where not exists (
    select 1
    from public.pos_archive_replica_events event
    where event.replica_id = v_replica.id
      and event.result = 'verified'
      and event.details ->> 'operation' = 'primary_restore'
      and event.details ->> 'missingIntegrityEventId' = v_missing_event.id::text
      and event.details ->> 'verifiedIntegrityEventId' = v_verified_event.id::text
  );
end;
$$;

create or replace function public.pos_archive_primary_recovery_fail(
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
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'Service role is required.';
  end if;
  if v_code !~ '^[A-Z0-9_]{1,80}$' then v_code := 'UNKNOWN_ERROR'; end if;

  select replica.* into v_replica
  from public.pos_archive_replicas replica
  where replica.id = p_replica_id;
  if not found then return; end if;

  insert into public.pos_archive_replica_events(
    user_id, archive_record_id, replica_id, result, provider, error_code, details
  ) values (
    v_replica.user_id, v_replica.archive_record_id, v_replica.id,
    'failed', 'aws_s3_object_lock', v_code,
    jsonb_build_object('operation', 'primary_restore')
  );
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
    select configuration.independent_backup_ready
      and configuration.worm_provider_ready
      and configuration.worm_provider = 'aws_s3_object_lock'
      and configuration.worm_environment = 'production'
      and configuration.worm_object_lock_mode = 'COMPLIANCE'
      and configuration.worm_connectivity_tested_at >= now() - interval '30 days'
      and configuration.recovery_tested_at >= now() - interval '365 days'
      and exists (
        select 1 from public.pos_archive_replicas replica
        where replica.status = 'verified'
          and replica.object_lock_mode = 'COMPLIANCE'
          and replica.verified_at >= now() - interval '90 days'
      )
      and not exists (
        select 1 from public.pos_invoices invoice
        where not invoice.is_test and not exists (
          select 1 from public.pos_invoice_documents document
          where document.invoice_id = invoice.id and document.user_id = invoice.user_id
        )
      )
      and not exists (
        select 1
        from public.pos_invoice_adjustments adjustment
        join public.pos_invoices invoice
          on invoice.id = adjustment.original_invoice_id
         and invoice.user_id = adjustment.user_id
        where not invoice.is_test and not exists (
          select 1 from public.pos_adjustment_documents document
          where document.adjustment_id = adjustment.id and document.user_id = adjustment.user_id
        )
      )
      and not exists (
        select 1
        from public.pos_invoice_adjustments adjustment
        join public.pos_invoices invoice
          on invoice.id = adjustment.original_invoice_id
         and invoice.user_id = adjustment.user_id
        where not invoice.is_test
          and adjustment.adjustment_type in ('correction','cancellation')
          and invoice.customer_type in ('business','public')
          and exists (
            select 1 from public.pos_einvoice_documents document
            where document.invoice_id = invoice.id and document.user_id = invoice.user_id
          )
          and not exists (
            select 1 from public.pos_adjustment_einvoice_documents document
            where document.adjustment_id = adjustment.id and document.user_id = adjustment.user_id
          )
      )
      and not exists (
        select 1 from public.pos_work_orders work_order
        where not work_order.is_test
          and work_order.offered_at is not null
          and work_order.status <> 'draft'
          and not exists (
            select 1 from public.pos_offer_documents document
            where document.work_order_id = work_order.id and document.user_id = work_order.user_id
          )
      )
      and not exists (
        select 1
        from public.pos_work_orders work_order
        join public.pos_work_order_acceptances acceptance
          on acceptance.work_order_id = work_order.id
         and acceptance.user_id = work_order.user_id
        where not work_order.is_test
          and work_order.locked_payload->>'customer_type' = 'private'
          and work_order.locked_payload->>'consumer_contract_context'
            in ('distance','off_premises','urgent_repair')
          and not exists (
            select 1 from public.pos_contract_confirmation_documents document
            where document.work_order_id = work_order.id and document.user_id = work_order.user_id
          )
      )
      and not exists (
        select 1 from public.pos_archive_records record
        where not record.is_test and not exists (
          select 1 from public.pos_archive_replicas replica
          where replica.archive_record_id = record.id
            and replica.status = 'verified'
            and replica.object_lock_mode = 'COMPLIANCE'
            and replica.remote_checksum_sha256 = record.sha256
            and replica.remote_byte_size = record.byte_size
            and replica.retain_until >= (
              record.retention_not_before::timestamptz + interval '1 day' - interval '1 millisecond'
            )
        )
      )
      and not exists (
        select 1
        from public.pos_archive_records record
        left join lateral (
          select event.result, event.observed_sha256, event.observed_byte_size, event.checked_at
          from public.pos_archive_integrity_events event
          where event.archive_record_id = record.id
          order by event.checked_at desc, event.id desc
          limit 1
        ) latest on true
        where not record.is_test
          and (
            latest.result is distinct from 'verified'
            or latest.observed_sha256 is distinct from record.sha256
            or latest.observed_byte_size is distinct from record.byte_size
            or latest.checked_at < now() - interval '90 days'
            or latest.checked_at > now() + interval '5 minutes'
          )
      )
    from private.pos_archive_configuration configuration
    where configuration.singleton
  ), false);
$$;

revoke all on function public.pos_archive_primary_recovery_batch(integer)
  from public, anon, authenticated;
revoke all on function public.pos_archive_primary_recovery_complete(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.pos_archive_primary_recovery_fail(uuid, text)
  from public, anon, authenticated;
revoke all on function private.pos_archive_production_ready()
  from public, anon, authenticated;

grant execute on function public.pos_archive_primary_recovery_batch(integer),
  public.pos_archive_primary_recovery_complete(uuid, uuid, uuid, text),
  public.pos_archive_primary_recovery_fail(uuid, text),
  private.pos_archive_production_ready()
  to service_role;

notify pgrst, 'reload schema';
