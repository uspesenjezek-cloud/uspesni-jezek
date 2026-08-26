-- Uporabnik lahko razveljavi že knjiženo delno plačilo, obrok, delni
-- dobropis ali delni odpust. Knjigovodski zapis, finančni seštevki, načrt in
-- zgodovina ukrepov se spremenijo atomsko pod zaklepom iste zadeve.
create or replace function public.razveljavi_opomin_poravnavo(
  p_zadeva_id uuid,
  p_obrtnik_id uuid,
  p_expected_version text,
  p_target_action_id uuid,
  p_new_plan jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_zadeva public.zadeve%rowtype;
  v_ukrep public.opomin_ukrepi%rowtype;
  v_znesek numeric;
  v_verzija bigint;
  v_pricakovana_verzija bigint;
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
  if coalesce((p_new_plan->>'version')::bigint, -1) <> v_verzija + 1 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_SETTINGS', 'napaka', 'Nova različica načrta ni veljavna.');
  end if;

  select * into v_ukrep
  from public.opomin_ukrepi
  where action_id = p_target_action_id
    and zadeva_id = p_zadeva_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_FOUND', 'napaka', 'Korak ni več na voljo.');
  end if;
  if v_ukrep.obrtnik_id <> p_obrtnik_id
     or v_ukrep.status <> 'completed'
     or v_ukrep.action_type not in ('partial_payment', 'partial_settlement') then
    return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_REVERSIBLE', 'napaka', 'Tega koraka ni mogoče odstraniti.');
  end if;

  if v_ukrep.action_type = 'partial_payment' then
    select znesek into v_znesek
    from public.zadeva_placila
    where action_id = p_target_action_id
      and zadeva_id = p_zadeva_id
    for update;

    if not found or not (v_znesek > 0) or v_zadeva.placano_skupaj < v_znesek then
      return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_REVERSIBLE', 'napaka', 'Finančni zapis koraka ni veljaven.');
    end if;

    perform set_config('app.dovoli_denarne_spremembe', 'true', true);
    update public.zadeve
    set opomin_nacrt = p_new_plan,
        preostali_dolg = preostali_dolg + v_znesek,
        placano_skupaj = placano_skupaj - v_znesek,
        znesek = preostali_dolg + v_znesek
    where id = p_zadeva_id;

    delete from public.zadeva_placila
    where action_id = p_target_action_id
      and zadeva_id = p_zadeva_id;
  else
    select znesek into v_znesek
    from public.zadeva_poravnave
    where action_id = p_target_action_id
      and zadeva_id = p_zadeva_id
    for update;

    if not found or not (v_znesek > 0) or v_zadeva.poravnano_nedenarno < v_znesek then
      return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_REVERSIBLE', 'napaka', 'Finančni zapis koraka ni veljaven.');
    end if;

    perform set_config('app.dovoli_denarne_spremembe', 'true', true);
    update public.zadeve
    set opomin_nacrt = p_new_plan,
        preostali_dolg = preostali_dolg + v_znesek,
        poravnano_nedenarno = poravnano_nedenarno - v_znesek,
        znesek = preostali_dolg + v_znesek
    where id = p_zadeva_id;

    delete from public.zadeva_poravnave
    where action_id = p_target_action_id
      and zadeva_id = p_zadeva_id;
  end if;

  delete from public.opomin_ukrepi
  where action_id = p_target_action_id
    and zadeva_id = p_zadeva_id;

  select * into v_zadeva from public.zadeve where id = p_zadeva_id;
  return jsonb_build_object(
    'ok', true,
    'version', p_new_plan->>'version',
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
    'plan', p_new_plan,
    'steps', public._izvedba_koraki_dto(p_zadeva_id)
  );
end;
$$;

revoke all on function public.razveljavi_opomin_poravnavo(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.razveljavi_opomin_poravnavo(uuid, uuid, text, uuid, jsonb) to service_role;;
