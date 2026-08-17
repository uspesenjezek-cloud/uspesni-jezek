-- Uskladitev projektne čakalne vrste z varovalkami osnovne vrste.
-- Potekli lease dobi odmik, izčrpani poskusi pa terminalni čas zaključka.

create or replace function public.prevzemi_mehka_boniteta_opravila(
  p_limit integer default 30,
  p_lease_seconds integer default 75
)
returns setof public.mehka_boniteta_opravila
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 1), 1), 30);
  v_lease integer := least(greatest(coalesce(p_lease_seconds, 75), 30), 180);
  v_free integer;
  v_insolvency integer;
  v_ids uuid[] := array[]::uuid[];
  v_candidate record;
begin
  perform pg_advisory_xact_lock(hashtextextended('mehka_boniteta_sloti', 0));

  update public.mehka_boniteta_opravila
     set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
         available_at = case
           when attempts >= max_attempts then available_at
           else now() + make_interval(secs => least(120, 10 * (2 ^ greatest(attempts - 1, 0))::integer))
         end,
         lease_until = null,
         claim_token = null,
         last_error = coalesce(last_error, 'Čas obdelave je potekel.'),
         finished_at = case when attempts >= max_attempts then now() else null end,
         updated_at = now()
   where status = 'processing'
     and lease_until < now();

  select greatest(0, 30 - count(*))::integer,
         greatest(0, 10 - count(*) filter (where faza = 'insolvenca'))::integer
    into v_free, v_insolvency
    from public.mehka_boniteta_opravila
   where status = 'processing'
     and lease_until >= now();

  if v_free = 0 then return; end if;

  for v_candidate in
    select id, faza
      from public.mehka_boniteta_opravila
     where status = 'queued'
       and available_at <= now()
     order by case source when 'user' then 0 else 1 end, created_at
     for update skip locked
  loop
    exit when cardinality(v_ids) >= least(v_limit, v_free);
    if v_candidate.faza = 'insolvenca' and v_insolvency = 0 then continue; end if;
    v_ids := array_append(v_ids, v_candidate.id);
    if v_candidate.faza = 'insolvenca' then v_insolvency := v_insolvency - 1; end if;
  end loop;

  if cardinality(v_ids) = 0 then return; end if;

  return query
  update public.mehka_boniteta_opravila o
     set status = 'processing',
         attempts = o.attempts + 1,
         started_at = coalesce(o.started_at, now()),
         lease_until = now() + make_interval(secs => v_lease),
         claim_token = gen_random_uuid(),
         updated_at = now()
   where o.id = any(v_ids)
  returning o.*;
end;
$$;

-- Spremljanje se sme premakniti samo za terminalno opravilo. S tem retry ne
-- preskoči naslednjega pravega preverjanja in ne ustvari podvojenega opozorila.
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
  v_final timestamptz;
  v_next timestamptz;
begin
  select m.*
    into v_monitor
    from public.boniteta_projektna_spremljanja m
    join public.mehka_boniteta_opravila j on j.project_monitor_id = m.id
   where j.id = p_job_id
     and j.status in ('completed', 'failed')
   for update of m;

  if v_monitor.id is null then return; end if;
  v_status := coalesce(p_result->'insolvency'->>'status', case when p_success then 'checked' else 'unavailable' end);
  v_final := (v_monitor.project_end_date::timestamp + interval '12 hours') - make_interval(days => v_monitor.final_check_days_before);
  if now() >= v_final then v_next := null;
  else v_next := least(now() + make_interval(days => v_monitor.interval_days), v_final);
  end if;

  update public.boniteta_projektna_spremljanja
     set last_check_at = now(),
         last_result_status = v_status,
         next_check_at = v_next,
         completed_at = case when v_next is null then now() else null end,
         updated_at = now()
   where id = v_monitor.id;

  update public.boniteta_profili
     set latest_check = case when p_success then coalesce(p_result, '{}'::jsonb) else latest_check end,
         checked_at = case when p_success then now() else checked_at end,
         updated_at = now()
   where id = v_monitor.profile_id;

  if v_status in ('found', 'possible_match', 'match', 'warning') then
    insert into public.boniteta_opozorila(user_id, profile_id, external_event_id, category, title, payload)
    values (v_monitor.user_id, v_monitor.profile_id, 'project-monitor:' || p_job_id,
      'insolvency', 'Projektna ponovna preverba zahteva pregled', coalesce(p_result, '{}'::jsonb))
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.prevzemi_mehka_boniteta_opravila(integer, integer) from public, anon, authenticated;
revoke all on function public.zakljuci_projektno_spremljanje(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.prevzemi_mehka_boniteta_opravila(integer, integer) to service_role;
grant execute on function public.zakljuci_projektno_spremljanje(uuid, boolean, jsonb) to service_role;
