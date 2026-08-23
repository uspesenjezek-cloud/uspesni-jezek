-- Nova veja RPC izvedi_opomin_ukrep za partial_settlement: delni dobropis
-- ali odpust, ki zmanjša preostali_dolg in poveca poravnano_nedenarno,
-- a NE zapre primera - zrcali obstojeco partial_payment vejo, le da pise
-- v zadeva_poravnave namesto zadeva_placila. Glej
-- docs/superpowers/specs/2026-08-23-delna-nedenarna-poravnava-design.md.

create or replace function public.izvedi_opomin_ukrep(
  p_zadeva_id uuid,
  p_obrtnik_id uuid,
  p_expected_version text,
  p_action_id uuid,
  p_fingerprint text,
  p_action_type text,
  p_settings jsonb,
  p_new_plan jsonb,
  p_koraki_updates jsonb,
  p_placilo_znesek numeric default null,
  p_placilo_vrsta text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ukrep_id uuid;
  v_obstojeci public.opomin_ukrepi%rowtype;
  v_zadeva public.zadeve%rowtype;
  v_verzija bigint;
  v_pricakovana_verzija bigint;
  v_nov_preostanek numeric;
  v_settlement_type text;
  v_settled_at timestamptz;
  v_nedenarni_znesek numeric;
  v_result jsonb;
begin
  insert into public.opomin_ukrepi (
    action_id, zahteva_fingerprint, zadeva_id, obrtnik_id, action_type, settings, status, created_at
  ) values (
    p_action_id, p_fingerprint, p_zadeva_id, p_obrtnik_id, p_action_type, coalesce(p_settings, '{}'::jsonb), 'pending', now()
  )
  on conflict (action_id) do nothing
  returning id into v_ukrep_id;

  if v_ukrep_id is null then
    select * into v_obstojeci from public.opomin_ukrepi where action_id = p_action_id for update;
    if not found then
      insert into public.opomin_ukrepi (
        action_id, zahteva_fingerprint, zadeva_id, obrtnik_id, action_type, settings, status, created_at
      ) values (
        p_action_id, p_fingerprint, p_zadeva_id, p_obrtnik_id, p_action_type, coalesce(p_settings, '{}'::jsonb), 'pending', now()
      ) returning id into v_ukrep_id;
    elsif v_obstojeci.zahteva_fingerprint <> p_fingerprint then
      return jsonb_build_object('ok', false, 'code', 'ACTION_ID_REUSED');
    elsif v_obstojeci.status in ('completed', 'failed') then
      return v_obstojeci.result_state;
    else
      return jsonb_build_object('ok', false, 'code', 'ACTION_IN_PROGRESS');
    end if;
  end if;

  select * into v_zadeva from public.zadeve where id = p_zadeva_id for update;
  if not found then
    v_result := jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;
  if v_zadeva.obrtnik_id <> p_obrtnik_id then
    v_result := jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  v_verzija := coalesce((v_zadeva.opomin_nacrt->>'version')::bigint, 0);
  v_pricakovana_verzija := coalesce(nullif(p_expected_version, '')::bigint, 0);
  if v_verzija <> v_pricakovana_verzija then
    v_result := jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'serverVersion', v_verzija::text);
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  if p_action_type = 'partial_payment' then
    if p_placilo_znesek is null or p_placilo_znesek <= 0 then
      v_result := jsonb_build_object('ok', false, 'code', 'INVALID_PAYMENT_AMOUNT');
      update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
      return v_result;
    end if;
    v_nov_preostanek := v_zadeva.preostali_dolg - p_placilo_znesek;
    if v_nov_preostanek <= 0 then
      v_result := jsonb_build_object('ok', false, 'code', 'PAYMENT_EXCEEDS_DEBT');
      update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
      return v_result;
    end if;
    perform set_config('app.dovoli_denarne_spremembe', 'true', true);
    update public.zadeve
    set opomin_nacrt = p_new_plan,
        preostali_dolg = v_nov_preostanek,
        placano_skupaj = placano_skupaj + p_placilo_znesek,
        znesek = v_nov_preostanek
    where id = p_zadeva_id;
    insert into public.zadeva_placila (zadeva_id, obrtnik_id, znesek, vrsta, datum_placila, action_id)
    values (
      p_zadeva_id,
      p_obrtnik_id,
      p_placilo_znesek,
      case when p_placilo_vrsta = 'installment' then 'installment' else 'partial' end,
      current_date,
      p_action_id
    );

  elsif p_action_type = 'partial_settlement' then
    if p_placilo_znesek is null or p_placilo_znesek <= 0 then
      v_result := jsonb_build_object('ok', false, 'code', 'INVALID_PAYMENT_AMOUNT');
      update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
      return v_result;
    end if;
    v_nov_preostanek := v_zadeva.preostali_dolg - p_placilo_znesek;
    if v_nov_preostanek <= 0 then
      v_result := jsonb_build_object('ok', false, 'code', 'PAYMENT_EXCEEDS_DEBT');
      update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
      return v_result;
    end if;
    perform set_config('app.dovoli_denarne_spremembe', 'true', true);
    update public.zadeve
    set opomin_nacrt = p_new_plan,
        preostali_dolg = v_nov_preostanek,
        poravnano_nedenarno = poravnano_nedenarno + p_placilo_znesek,
        znesek = v_nov_preostanek
    where id = p_zadeva_id;
    insert into public.zadeva_poravnave (zadeva_id, obrtnik_id, vrsta, znesek, datum_poravnave, razlog, action_id)
    values (
      p_zadeva_id,
      p_obrtnik_id,
      case when p_placilo_vrsta = 'cancelled_invoice' then 'cancelled_invoice' else 'credit_note' end,
      p_placilo_znesek,
      current_date,
      nullif(p_settings->>'reason', ''),
      p_action_id
    );

  elsif p_action_type = 'paid_in_full' then
    v_settlement_type := coalesce(nullif(p_settings->>'settlementType', ''), 'full');
    v_settled_at := coalesce(nullif(p_settings->>'settledAt', '')::timestamptz, now());

    if v_settlement_type = 'full' then
      perform set_config('app.dovoli_denarne_spremembe', 'true', true);
      update public.zadeve
      set opomin_nacrt = p_new_plan,
          preostali_dolg = 0,
          placano_skupaj = placano_skupaj + preostali_dolg,
          znesek = 0,
          status = 'Rešeno',
          poravnano_at = v_settled_at
      where id = p_zadeva_id;
      insert into public.zadeva_placila (zadeva_id, obrtnik_id, znesek, vrsta, datum_placila, action_id)
      values (p_zadeva_id, p_obrtnik_id, v_zadeva.preostali_dolg, 'full', v_settled_at::date, p_action_id);
    else
      -- compensation / credit_note / cancelled_invoice: NI denarnega priliva.
      v_nedenarni_znesek := v_zadeva.preostali_dolg;
      perform set_config('app.dovoli_denarne_spremembe', 'true', true);
      update public.zadeve
      set opomin_nacrt = p_new_plan,
          preostali_dolg = 0,
          poravnano_nedenarno = poravnano_nedenarno + v_nedenarni_znesek,
          znesek = 0,
          status = 'Rešeno',
          poravnano_at = v_settled_at
      where id = p_zadeva_id;
      insert into public.zadeva_poravnave (zadeva_id, obrtnik_id, vrsta, znesek, datum_poravnave, razlog, action_id)
      values (
        p_zadeva_id, p_obrtnik_id, v_settlement_type, v_nedenarni_znesek, v_settled_at::date,
        nullif(p_settings->>'reason', ''), p_action_id
      );
    end if;
  else
    update public.zadeve set opomin_nacrt = p_new_plan where id = p_zadeva_id;
  end if;

  if p_koraki_updates is not null and jsonb_typeof(p_koraki_updates) = 'array' and jsonb_array_length(p_koraki_updates) > 0 then
    update public.opomin_koraki k
    set execution_state = coalesce(x.execution_state, k.execution_state),
        status = coalesce(x.status, k.status),
        scheduled_at = coalesce(x.scheduled_at, k.scheduled_at),
        cancel_reason = coalesce(x.cancel_reason, k.cancel_reason),
        paused_until = x.paused_until,
        posodobljeno_at = now()
    from jsonb_to_recordset(p_koraki_updates) as x(
      id uuid, execution_state text, status text, scheduled_at timestamptz,
      cancel_reason text, paused_until timestamptz
    )
    where k.id = x.id and k.zadeva_id = p_zadeva_id;
  end if;

  select * into v_zadeva from public.zadeve where id = p_zadeva_id;
  v_result := jsonb_build_object(
    'ok', true, 'actionId', p_action_id, 'version', (p_new_plan->>'version'),
    'zadeva', jsonb_build_object(
      'id', v_zadeva.id, 'status', v_zadeva.status, 'prvotniZnesek', v_zadeva.prvotni_znesek,
      'preostaliDolg', v_zadeva.preostali_dolg, 'placanoSkupaj', v_zadeva.placano_skupaj,
      'poravnanoNedenarno', v_zadeva.poravnano_nedenarno,
      'znesek', v_zadeva.znesek, 'poravnanoAt', v_zadeva.poravnano_at
    ),
    'plan', p_new_plan, 'steps', public._izvedba_koraki_dto(p_zadeva_id)
  );
  update public.opomin_ukrepi set status = 'completed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
  return v_result;
end;
$$;

revoke all on function public.izvedi_opomin_ukrep(uuid, uuid, text, uuid, text, text, jsonb, jsonb, jsonb, numeric, text) from public, anon, authenticated;
grant execute on function public.izvedi_opomin_ukrep(uuid, uuid, text, uuid, text, text, jsonb, jsonb, jsonb, numeric, text) to service_role;
