-- Razširi obstoječo atomsko razveljavitev poravnave tudi na zadnji
-- zaključni korak »Plačano v celoti« oziroma njegovo nedenarno različico.
-- Ob razveljavitvi se povrnejo dolg, knjigovodski seštevki, status primera
-- in samo tisti prihodnji koraki, ki jih je odpovedala ta poravnava.
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
  v_ukrep_verzija bigint;
  v_settlement_type text;
  v_prejsnji_status text;
  v_poslani_koraki integer;
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
     or v_ukrep.action_type not in ('partial_payment', 'partial_settlement', 'paid_in_full') then
    return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_REVERSIBLE', 'napaka', 'Tega koraka ni mogoče odstraniti.');
  end if;

  v_settlement_type := case
    when v_ukrep.action_type = 'partial_payment' then coalesce(nullif(v_ukrep.settings->>'settlementType', ''), 'partial')
    when v_ukrep.action_type = 'partial_settlement' then coalesce(nullif(v_ukrep.settings->>'kind', ''), 'credit')
    else coalesce(nullif(v_ukrep.settings->>'settlementType', ''), 'full')
  end;

  if v_ukrep.action_type = 'paid_in_full' then
    v_ukrep_verzija := coalesce(
      nullif(v_ukrep.result_state->>'version', '')::bigint,
      nullif(v_ukrep.result_state->'plan'->>'version', '')::bigint,
      -1
    );
    if v_ukrep_verzija <> v_verzija
       or v_zadeva.status <> 'Rešeno'
       or v_zadeva.preostali_dolg <> 0
       or v_settlement_type not in ('full', 'compensation', 'credit_note', 'cancelled_invoice')
       or p_new_plan->>'status' <> 'active'
       or p_new_plan ? 'settlement' then
      return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_REVERSIBLE', 'napaka', 'Primer je bil po zaključku že spremenjen.');
    end if;

    select count(distinct step_id)::integer into v_poslani_koraki
    from public.opomin_koraki
    where zadeva_id = p_zadeva_id
      and (status = 'sent' or execution_state = 'sent');

    v_prejsnji_status := case
      when exists (
        select 1
        from jsonb_array_elements(coalesce(p_new_plan->'steps', '[]'::jsonb)) as s
        where s->>'kind' = 'manual_lawyer' and s->>'status' = 'sent'
      ) then 'Predano odvetniku'
      when coalesce(v_poslani_koraki, 0) = 0 then 'Nov'
      when v_poslani_koraki = 1 then '1. opomin poslan'
      when v_poslani_koraki = 2 then '2. opomin poslan'
      else 'Zadnji opomin poslan'
    end;
  end if;

  if v_ukrep.action_type = 'partial_payment'
     or (v_ukrep.action_type = 'paid_in_full' and v_settlement_type = 'full') then
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
        znesek = preostali_dolg + v_znesek,
        status = case when v_ukrep.action_type = 'paid_in_full' then v_prejsnji_status else status end,
        poravnano_at = case when v_ukrep.action_type = 'paid_in_full' then null else poravnano_at end
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
        znesek = preostali_dolg + v_znesek,
        status = case when v_ukrep.action_type = 'paid_in_full' then v_prejsnji_status else status end,
        poravnano_at = case when v_ukrep.action_type = 'paid_in_full' then null else poravnano_at end
    where id = p_zadeva_id;

    delete from public.zadeva_poravnave
    where action_id = p_target_action_id
      and zadeva_id = p_zadeva_id;
  end if;

  if v_ukrep.action_type = 'paid_in_full' then
    -- Fail-closed: nič se ne pošlje samodejno. Ponovno se odprejo samo
    -- neposlani koraki, ki jih je odpovedal prav ta način poravnave.
    update public.opomin_koraki
    set status = 'scheduled',
        execution_state = 'scheduled',
        cancel_reason = null,
        confirmed_by_user_at = null,
        posodobljeno_at = now()
    where zadeva_id = p_zadeva_id
      and status = 'cancelled'
      and execution_state = 'cancelled'
      and cancel_reason = v_settlement_type;
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
grant execute on function public.razveljavi_opomin_poravnavo(uuid, uuid, text, uuid, jsonb) to service_role;
