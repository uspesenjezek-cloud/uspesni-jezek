-- A recovery check from a development/GOVERNANCE archive must never unlock a
-- production/COMPLIANCE archive. Production readiness also requires recent,
-- concrete COMPLIANCE evidence and complete coverage of every live original.

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
declare
  v_environment_changed boolean;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role is required.';
  end if;
  if (p_environment = 'test' and p_object_lock_mode <> 'GOVERNANCE')
    or (p_environment = 'production' and p_object_lock_mode <> 'COMPLIANCE')
    or p_environment not in ('test', 'production') then
    raise exception 'Neveljavna nastavitev AWS arhivskega okolja.';
  end if;

  select worm_environment is distinct from p_environment
      or worm_object_lock_mode is distinct from p_object_lock_mode
  into v_environment_changed
  from private.pos_archive_configuration
  where singleton;

  if p_recovery_tested and not exists (
    select 1
    from public.pos_archive_replicas replica
    where replica.status = 'verified'
      and replica.object_lock_mode = p_object_lock_mode
      and replica.verified_at >= now() - interval '15 minutes'
  ) then
    raise exception 'Obnovitveni preizkus nima sveže preverjene arhivske kopije.';
  end if;

  update private.pos_archive_configuration
  set independent_backup_ready = true,
      backup_provider = 'AWS S3 Object Lock',
      worm_provider_ready = true,
      worm_environment = p_environment,
      worm_object_lock_mode = p_object_lock_mode,
      worm_connectivity_tested_at = now(),
      recovery_tested_at = case
        when p_recovery_tested then now()
        when v_environment_changed then null
        else recovery_tested_at
      end,
      updated_at = now()
  where singleton;
  return private.pos_archive_readiness();
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
        select 1
        from public.pos_archive_replicas replica
        where replica.status = 'verified'
          and replica.object_lock_mode = 'COMPLIANCE'
          and replica.verified_at >= now() - interval '90 days'
      )
      and not exists (
        select 1
        from public.pos_archive_records record
        join public.pos_invoices invoice on invoice.id = record.invoice_id
        where not invoice.is_test
          and not exists (
            select 1
            from public.pos_archive_replicas replica
            where replica.archive_record_id = record.id
              and replica.status = 'verified'
              and replica.object_lock_mode = 'COMPLIANCE'
              and replica.remote_checksum_sha256 = record.sha256
              and replica.remote_byte_size = record.byte_size
              and replica.retain_until >= (record.retention_not_before::timestamptz + interval '1 day' - interval '1 millisecond')
          )
      )
    from private.pos_archive_configuration configuration
    where configuration.singleton
  ), false);
$$;

revoke all on function public.pos_archive_provider_heartbeat(text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.pos_archive_provider_heartbeat(text, text, boolean)
  to service_role;
revoke all on function private.pos_archive_production_ready()
  from public, anon, authenticated;
grant execute on function private.pos_archive_production_ready()
  to service_role;

notify pgrst, 'reload schema';;
