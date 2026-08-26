-- Return complete per-user archive totals without loading a capped slice of
-- records and the growing append-only event history through the Data API.

create or replace function public.pos_archive_user_summary(p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with records as (
    select record.id, record.retention_not_before
    from public.pos_archive_records record
    where record.user_id = p_user_id
  ), latest_integrity as (
    select distinct on (event.archive_record_id)
      event.archive_record_id,
      event.result
    from public.pos_archive_integrity_events event
    join records record on record.id = event.archive_record_id
    order by event.archive_record_id, event.checked_at desc, event.id desc
  ), latest_replica as (
    select distinct on (replica.archive_record_id)
      replica.archive_record_id,
      replica.status
    from public.pos_archive_replicas replica
    join records record on record.id = replica.archive_record_id
    where replica.provider = 'aws_s3_object_lock'
    order by replica.archive_record_id, replica.created_at desc, replica.id desc
  ), states as (
    select record.retention_not_before,
      integrity.result as integrity_result,
      replica.status as replica_status
    from records record
    left join latest_integrity integrity on integrity.archive_record_id = record.id
    left join latest_replica replica on replica.archive_record_id = record.id
  )
  select jsonb_build_object(
    'documentCount', count(*),
    'verifiedCount', count(*) filter (where integrity_result = 'verified'),
    'failureCount', count(*) filter (where integrity_result is not null and integrity_result <> 'verified'),
    'uncheckedCount', count(*) filter (where integrity_result is null),
    'replicatedCount', count(*) filter (where replica_status = 'verified'),
    'replicaFailureCount', count(*) filter (where replica_status = 'failed'),
    'replicaPendingCount', count(*) filter (where replica_status is null or replica_status in ('pending', 'copying')),
    'earliestRetentionNotBefore', min(retention_not_before)
  )
  from states;
$$;

revoke all on function public.pos_archive_user_summary(uuid)
  from public, anon, authenticated;
grant execute on function public.pos_archive_user_summary(uuid)
  to service_role;

notify pgrst, 'reload schema';;
