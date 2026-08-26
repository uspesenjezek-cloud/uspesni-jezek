-- Keep the existing behaviour while removing the remaining plpgsql_check
-- warnings reported by `supabase db lint --linked`.

create or replace function private.pos_iban_valid(p_iban text)
returns boolean
language plpgsql
security invoker
immutable
strict
set search_path = ''
as $$
declare
  v_iban text := upper(p_iban);
  v_rearranged text;
  v_character text;
  v_digits text;
  v_digit text;
  v_remainder integer := 0;
begin
  if v_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    return false;
  end if;

  v_rearranged := substring(v_iban from 5) || substring(v_iban from 1 for 4);
  for v_index in 1..char_length(v_rearranged) loop
    v_character := substring(v_rearranged from v_index for 1);
    v_digits := case
      when v_character between '0' and '9' then v_character
      else (ascii(v_character) - ascii('A') + 10)::text
    end;
    foreach v_digit in array regexp_split_to_array(v_digits, '') loop
      if v_digit <> '' then
        v_remainder := (v_remainder * 10 + v_digit::integer) % 97;
      end if;
    end loop;
  end loop;

  return v_remainder = 1;
end;
$$;

revoke all on function private.pos_iban_valid(text) from public, anon;
grant execute on function private.pos_iban_valid(text) to authenticated, service_role;

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

  -- The code is intentionally accepted for worker/API compatibility. Detailed
  -- per-object failures are stored by pos_archive_replica_fail; this provider
  -- heartbeat only marks the global WORM capability unhealthy.
  perform p_error_code;

  update private.pos_archive_configuration
  set independent_backup_ready = false,
      worm_provider_ready = false,
      updated_at = now()
  where singleton;
end;
$$;

revoke all on function public.pos_archive_provider_fail(text) from public, anon, authenticated;
grant execute on function public.pos_archive_provider_fail(text) to service_role;

notify pgrst, 'reload schema';
