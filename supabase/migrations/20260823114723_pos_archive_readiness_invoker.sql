-- Keep the exposed readiness wrapper as SECURITY INVOKER. The privileged
-- reader remains in the unexposed private schema and validates either a real
-- authenticated user id or Supabase's trusted service-role JWT claim.

create or replace function private.pos_archive_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_service boolean := coalesce((select auth.jwt() ->> 'role' = 'service_role'), false);
  v_result jsonb;
begin
  if (select auth.uid()) is null and not v_is_service then
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

create or replace function public.pos_archive_readiness()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.pos_archive_readiness();
$$;

revoke all on function private.pos_archive_readiness() from public, anon;
revoke all on function public.pos_archive_readiness() from public, anon;
grant execute on function private.pos_archive_readiness() to authenticated, service_role;
grant execute on function public.pos_archive_readiness() to authenticated, service_role;

notify pgrst, 'reload schema';

;
