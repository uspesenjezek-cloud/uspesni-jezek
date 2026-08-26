-- Never-checked originals must not be starved by a permanently failing older
-- object. Prioritize unchecked, then failed, then stale verified records.
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
  left join lateral (
    select event.result, event.checked_at
    from public.pos_archive_integrity_events event
    where event.archive_record_id = record.id
    order by event.checked_at desc, event.id desc
    limit 1
  ) latest on true
  where record.user_id = p_user_id
    and (
      latest.checked_at is null
      or latest.result <> 'verified'
      or latest.checked_at < now() - interval '90 days'
    )
  order by
    case
      when latest.checked_at is null then 0
      when latest.result <> 'verified' then 1
      else 2
    end,
    latest.checked_at asc nulls first,
    record.archived_at asc,
    record.id asc
  limit least(greatest(coalesce(p_limit, 10), 1), 25);
$$;

create or replace function public.pos_archive_integrity_batch(p_limit integer default 25)
returns setof public.pos_archive_records
language sql
stable
security invoker
set search_path = ''
as $$
  select record.*
  from public.pos_archive_records record
  left join lateral (
    select event.result, event.checked_at
    from public.pos_archive_integrity_events event
    where event.archive_record_id = record.id
    order by event.checked_at desc, event.id desc
    limit 1
  ) latest on true
  where latest.checked_at is null
    or latest.result <> 'verified'
    or latest.checked_at < now() - interval '90 days'
  order by
    case
      when latest.checked_at is null then 0
      when latest.result <> 'verified' then 1
      else 2
    end,
    latest.checked_at asc nulls first,
    record.archived_at asc,
    record.id asc
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

;
