-- Odstranitev zapisa »Plačilo obljubljeno« mora v isti transakciji obnoviti
-- stanje načrta in premor prihodnjih korakov. Če obstaja starejša veljavna
-- obljuba, se načrt vrne nanjo; sicer se znova aktivira.
create or replace function public.razveljavi_obljubo_placila(
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
  v_prejsnja_obljuba public.opomin_ukrepi%rowtype;
  v_verzija bigint;
  v_pricakovana_verzija bigint;
  v_novi_plan jsonb;
  v_trenutni_rok timestamptz;
  v_prejsnji_rok timestamptz;
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
    return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_FOUND', 'napaka', 'Korak ni več na voljo.');
  end if;
  if v_ukrep.obrtnik_id <> p_obrtnik_id
     or v_ukrep.status <> 'completed'
     or v_ukrep.action_type <> 'payment_promised' then
    return jsonb_build_object('ok', false, 'code', 'ACTION_NOT_REVERSIBLE', 'napaka', 'Tega koraka ni mogoče odstraniti.');
  end if;

  v_novi_plan := coalesce(v_zadeva.opomin_nacrt, '{}'::jsonb);
  v_trenutni_rok := nullif(v_novi_plan->>'promisedPaymentUntil', '')::timestamptz;

  select * into v_prejsnja_obljuba
  from public.opomin_ukrepi
  where zadeva_id = p_zadeva_id
    and obrtnik_id = p_obrtnik_id
    and action_id <> p_target_action_id
    and action_type = 'payment_promised'
    and status = 'completed'
  order by completed_at desc nulls last, created_at desc
  limit 1;

  if found then
    v_prejsnji_rok := coalesce(
      nullif(v_prejsnja_obljuba.result_state->'plan'->>'promisedPaymentUntil', '')::timestamptz,
      v_prejsnja_obljuba.completed_at
    );
  else
    v_prejsnji_rok := null;
  end if;

  if v_novi_plan->>'status' = 'waiting_for_promised_payment' then
    if v_prejsnji_rok is null then
      v_novi_plan := jsonb_set(
        v_novi_plan - 'promisedPaymentUntil' - 'promisedPaymentNotifiedAt',
        '{status}',
        '"active"'::jsonb,
        true
      );
    else
      v_novi_plan := jsonb_set(
        jsonb_set(v_novi_plan - 'promisedPaymentNotifiedAt', '{status}', '"waiting_for_promised_payment"'::jsonb, true),
        '{promisedPaymentUntil}',
        to_jsonb(v_prejsnji_rok),
        true
      );
    end if;

    update public.opomin_koraki
    set execution_state = case when v_prejsnji_rok is null then 'scheduled' else 'paused' end,
        paused_until = v_prejsnji_rok,
        posodobljeno_at = now()
    where zadeva_id = p_zadeva_id
      and execution_state = 'paused'
      and (v_trenutni_rok is null or paused_until = v_trenutni_rok);
  end if;

  v_novi_plan := jsonb_set(v_novi_plan, '{version}', to_jsonb((v_verzija + 1)::text), true);
  update public.zadeve
  set opomin_nacrt = v_novi_plan
  where id = p_zadeva_id;

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

revoke all on function public.razveljavi_obljubo_placila(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.razveljavi_obljubo_placila(uuid, uuid, text, uuid) to service_role;
