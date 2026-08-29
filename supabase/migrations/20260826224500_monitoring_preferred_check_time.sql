-- Uporabnikova izbrana lokalna ura se hrani v request_payload in ostane
-- nespremenjena tudi po zaključku posamezne ponovne preverbe.
create or replace function public.zakljuci_projektno_spremljanje(
  p_job_id uuid,
  p_success boolean,
  p_result jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_monitor public.boniteta_projektna_spremljanja;
  v_status text;
  v_next timestamptz;
  v_end timestamptz;
  v_next_local_date date;
  v_time text;
begin
  select m.* into v_monitor
    from public.boniteta_projektna_spremljanja m
    join public.mehka_boniteta_opravila j on j.project_monitor_id = m.id
   where j.id = p_job_id and j.status in ('completed', 'failed')
   for update of m;
  if v_monitor.id is null then return; end if;

  v_status := coalesce(p_result->'insolvency'->>'status', case when p_success then 'checked' else 'unavailable' end);
  v_time := case
    when coalesce(v_monitor.request_payload->>'monitoringTime', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      then v_monitor.request_payload->>'monitoringTime'
    else '12:00'
  end;

  if (now() at time zone 'Europe/Ljubljana')::date >= v_monitor.project_end_date then
    v_next := null;
  else
    v_next_local_date := greatest(
      (now() at time zone 'Europe/Ljubljana')::date,
      (v_monitor.next_check_at at time zone 'Europe/Ljubljana')::date
    ) + v_monitor.interval_days;
    v_next := (v_next_local_date + v_time::time) at time zone 'Europe/Ljubljana';
    v_end := (v_monitor.project_end_date + v_time::time) at time zone 'Europe/Ljubljana';
    v_next := least(v_next, v_end);
  end if;

  update public.boniteta_projektna_spremljanja
     set last_check_at = now(), last_result_status = v_status, next_check_at = v_next,
         completed_at = case when v_next is null then now() else null end, updated_at = now()
   where id = v_monitor.id;
  update public.boniteta_profili
     set latest_check = case when p_success then coalesce(p_result, '{}'::jsonb) else latest_check end,
         checked_at = case when p_success then now() else checked_at end, updated_at = now()
   where id = v_monitor.profile_id;
  if v_status in ('found', 'possible_match', 'match', 'warning') then
    insert into public.boniteta_opozorila(user_id, profile_id, external_event_id, category, title, payload)
    values(v_monitor.user_id, v_monitor.profile_id, 'project-monitor:' || p_job_id,
      'insolvency', 'Projektna ponovna preverba zahteva pregled', coalesce(p_result, '{}'::jsonb))
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.zakljuci_projektno_spremljanje(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.zakljuci_projektno_spremljanje(uuid, boolean, jsonb) to service_role;
