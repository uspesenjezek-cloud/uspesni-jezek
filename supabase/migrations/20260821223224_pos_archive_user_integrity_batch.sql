-- A user-triggered archive check must cover the user's complete retained
-- history instead of silently rechecking only the newest 25 records. Work is
-- returned in bounded packages so one HTTP request stays within its runtime.
create or replace function public.pos_archive_user_integrity_batch(
  p_user_id uuid,
  p_limit integer default 10
)
returns setof public.pos_archive_records
language sql
stable
security invoker
set search_path = ''
as $$
  select record.*
  from public.pos_archive_records record
  where record.user_id = p_user_id
    and not exists (
      select 1
      from public.pos_archive_integrity_events event
      where event.archive_record_id = record.id
        and event.result = 'verified'
        and event.checked_at >= now() - interval '90 days'
    )
  order by record.archived_at asc, record.id asc
  limit least(greatest(coalesce(p_limit, 10), 1), 25);
$$;

-- Failed or missing objects must be retried by the daily worker. A recent
-- failed check is evidence of a problem, not a reason to suppress retries.
create or replace function public.pos_archive_integrity_batch(p_limit integer default 25)
returns setof public.pos_archive_records
language sql
stable
security invoker
set search_path = ''
as $$
  select record.*
  from public.pos_archive_records record
  where not exists (
    select 1
    from public.pos_archive_integrity_events event
    where event.archive_record_id = record.id
      and event.result = 'verified'
      and event.checked_at >= now() - interval '90 days'
  )
  order by record.archived_at asc, record.id asc
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

revoke all on function public.pos_archive_user_integrity_batch(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.pos_archive_user_integrity_batch(uuid, integer)
  to service_role;

revoke all on function public.pos_archive_integrity_batch(integer)
  from public, anon, authenticated;
grant execute on function public.pos_archive_integrity_batch(integer)
  to service_role;

notify pgrst, 'reload schema';
