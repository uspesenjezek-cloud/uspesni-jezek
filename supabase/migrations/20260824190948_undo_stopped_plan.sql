-- Odstranitev zadnje ustavitve načrta mora v isti transakciji ponovno
-- aktivirati načrt, sprostiti prihodnje korake in odstraniti auditni zapis.
create or replace function public.razveljavi_ustavitev_opomin_nacrta(
  p_zadeva_id uuid,
  p_obrtnik_id uuid,
  p_expected_version text,
  p_target_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_zadeva public.zadeve%rowtype;
  v_ukrep public.opomin_ukrepi%rowtype;
  v_verzija bigint;
  v_pricakovana_verzija bigint;
  v_ukrep_verzija bigint;
  v_novi_plan jsonb;
begin
  select * into v_zadeva
  from public.zadeve
  where id = p_zadeva_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'napaka', 'Zadeva ni najdena.');
  end if;
  if v_zadeva.obrtnik_id <> p_obrtnik_id then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'napaka', 'Zadeva ni vaša.');
  end if;

  v_verzija := coalesce((v_zadeva.opomin_nacrt->>'version')::bigint, 0);
  v_pricakovana_verzija := coalesce(nullif(p_expected_version, '')::bigint, 0);
  if v_verzija <> v_pricakovana_verzija then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'serverVersion', v_verzija::text);
  end if;

  select * into v_ukrep
  from public.opomin_ukrepi
  where action_id = p_target_action_id
    and zadeva_id = p_zadeva_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_FOUND', 'napaka', 'Ustavitev načrta ni več na voljo.');
  end if;
  if v_ukrep.obrtnik_id <> p_obrtnik_id
     or v_ukrep.status <> 'completed'
     or v_ukrep.action_type <> 'stop_plan'
     or v_zadeva.opomin_nacrt->>'status' <> 'paused' then
    return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_REVERSIBLE', 'napaka', 'Te ustavitve načrta ni mogoče odstraniti.');
  end if;

  v_ukrep_verzija := coalesce(
    nullif(v_ukrep.result_state->>'version', '')::bigint,
    nullif(v_ukrep.result_state->'plan'->>'version', '')::bigint,
    -1
  );
  if v_ukrep_verzija <> v_verzija then
    return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_REVERSIBLE', 'napaka', 'Načrt je bil po ustavitvi že spremenjen.');
  end if;

  v_novi_plan := v_zadeva.opomin_nacrt - 'pausedAt' - 'resumeAt' - 'resumeMode';
  v_novi_plan := jsonb_set(v_novi_plan, '{status}', '"active"'::jsonb, true);
  v_novi_plan := jsonb_set(v_novi_plan, '{version}', to_jsonb((v_verzija + 1)::text), true);

  update public.zadeve
  set opomin_nacrt = v_novi_plan
  where id = p_zadeva_id;

  -- Fail-closed: koraki se vrnejo v načrtovano stanje. Scheduler bo zapadle
  -- vrstice znova postavil v čakanje na uporabnikovo potrditev; nič se ne pošlje takoj.
  update public.opomin_koraki
  set execution_state = 'scheduled',
      paused_until = null,
      posodobljeno_at = now()
  where zadeva_id = p_zadeva_id
    and execution_state = 'paused';

  delete from public.opomin_ukrepi
  where action_id = p_target_action_id
    and zadeva_id = p_zadeva_id;

  select * into v_zadeva from public.zadeve where id = p_zadeva_id;
  return jsonb_build_object(
    'ok', true,
    'version', v_novi_plan->>'version',
    'zadeva', jsonb_build_object(
      'id', v_zadeva.id,
      'status', v_zadeva.status,
      'prvotniZnesek', v_zadeva.prvotni_znesek,
      'preostaliDolg', v_zadeva.preostali_dolg,
      'placanoSkupaj', v_zadeva.placano_skupaj,
      'poravnanoNedenarno', v_zadeva.poravnano_nedenarno,
      'znesek', v_zadeva.znesek,
      'poravnanoAt', v_zadeva.poravnano_at
    ),
    'plan', v_novi_plan,
    'steps', public._izvedba_koraki_dto(p_zadeva_id)
  );
end;
$$;

revoke all on function public.razveljavi_ustavitev_opomin_nacrta(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.razveljavi_ustavitev_opomin_nacrta(uuid, uuid, text, uuid) to service_role;
