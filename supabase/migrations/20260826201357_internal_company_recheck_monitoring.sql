-- Spremljanje podjetij vodi naš scheduler. OpenRegister se uporablja samo za
-- največ eno navadno identitetno iskanje ob dejansko izvedeni ponovni preverbi.
alter table public.boniteta_monitorji
  drop constraint if exists boniteta_monitorji_frequency_check;
alter table public.boniteta_monitorji
  add constraint boniteta_monitorji_frequency_check
  check (frequency in ('daily', 'weekly', 'monthly'));

comment on table public.boniteta_monitorji is
  'Uporabnikov prikaz lokalnih ponovnih preverjanj; ne predstavlja OpenRegister Monitor API naročnine.';

create or replace function public.razporedi_zapadlo_projektno_spremljanje()
returns public.mehka_boniteta_opravila
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_monitor public.boniteta_projektna_spremljanja;
  v_job public.mehka_boniteta_opravila;
begin
  perform pg_advisory_xact_lock(hashtextextended('projektno_bonitetno_spremljanje', 0));
  if exists(select 1 from public.mehka_boniteta_opravila where source = 'user' and status in ('queued', 'processing')) then
    return null;
  end if;

  update public.boniteta_projektna_spremljanja
     set next_check_at = null, completed_at = coalesce(completed_at, now()), updated_at = now()
   where disabled = false and completed_at is null and project_end_date < current_date;

  select * into v_monitor
    from public.boniteta_projektna_spremljanja
   where disabled = false
     and completed_at is null
     and project_end_date >= current_date
     and next_check_at <= now()
     and not exists(
       select 1 from public.mehka_boniteta_opravila j
        where j.project_monitor_id = boniteta_projektna_spremljanja.id
          and j.status in ('queued', 'processing')
     )
   order by next_check_at
   for update skip locked
   limit 1;
  if v_monitor.id is null then return null; end if;

  insert into public.mehka_boniteta_opravila(user_id, faza, status, cache_key, request_payload, source, project_monitor_id)
  values(v_monitor.user_id, 'insolvenca', 'queued', md5(v_monitor.request_payload::text || now()::date::text), v_monitor.request_payload, 'project_monitor', v_monitor.id)
  returning * into v_job;
  update public.boniteta_projektna_spremljanja set last_job_id = v_job.id, updated_at = now() where id = v_monitor.id;
  return v_job;
end;
$$;

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
begin
  select m.* into v_monitor
    from public.boniteta_projektna_spremljanja m
    join public.mehka_boniteta_opravila j on j.project_monitor_id = m.id
   where j.id = p_job_id and j.status in ('completed', 'failed')
   for update of m;
  if v_monitor.id is null then return; end if;

  v_status := coalesce(p_result->'insolvency'->>'status', case when p_success then 'checked' else 'unavailable' end);
  if current_date >= v_monitor.project_end_date then
    v_next := null;
  else
    v_next := least(
      now() + make_interval(days => v_monitor.interval_days),
      v_monitor.project_end_date::timestamp
    );
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

revoke all on function public.razporedi_zapadlo_projektno_spremljanje() from public, anon, authenticated;
revoke all on function public.zakljuci_projektno_spremljanje(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.razporedi_zapadlo_projektno_spremljanje() to service_role;
grant execute on function public.zakljuci_projektno_spremljanje(uuid, boolean, jsonb) to service_role;
