-- En zapadel paket lahko vsebuje najmanj 20 različnih uporabnikov. Scheduler
-- jih v eni transakciji postavi v vrsto, pg_net pa za dejansko delo sproži
-- največ 20 ločenih Vercel invokacij. Zaklepi in claim_token preprečujejo, da
-- bi dva delavca prevzela isto opravilo.

create or replace function public.razporedi_zapadlo_projektno_spremljanje()
returns public.mehka_boniteta_opravila
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_monitor public.boniteta_projektna_spremljanja;
  v_job public.mehka_boniteta_opravila;
  v_first public.mehka_boniteta_opravila;
  v_has_first boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended('projektno_bonitetno_spremljanje', 0));
  if exists(
    select 1
      from public.mehka_boniteta_opravila
     where source = 'user'
       and status in ('queued', 'processing')
  ) then
    return null;
  end if;

  update public.boniteta_projektna_spremljanja
     set next_check_at = null,
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where disabled = false
     and completed_at is null
     and project_end_date < (now() at time zone 'Europe/Ljubljana')::date;

  for v_monitor in
    select m.*
      from public.boniteta_projektna_spremljanja m
     where m.disabled = false
       and m.completed_at is null
       and m.project_end_date >= (now() at time zone 'Europe/Ljubljana')::date
       and m.next_check_at <= now()
       and not exists(
         select 1
           from public.mehka_boniteta_opravila j
          where j.project_monitor_id = m.id
            and j.status in ('queued', 'processing')
       )
     order by m.next_check_at, m.id
     for update skip locked
     limit 20
  loop
    insert into public.mehka_boniteta_opravila(
      user_id, faza, status, cache_key, request_payload, source, project_monitor_id
    )
    values(
      v_monitor.user_id,
      'insolvenca',
      'queued',
      md5(v_monitor.request_payload::text || now()::date::text),
      v_monitor.request_payload,
      'project_monitor',
      v_monitor.id
    )
    returning * into v_job;

    update public.boniteta_projektna_spremljanja
       set last_job_id = v_job.id,
           updated_at = now()
     where id = v_monitor.id;

    if not v_has_first then
      v_first := v_job;
      v_has_first := true;
    end if;
  end loop;

  return v_first;
end;
$$;

-- Skupna meja ostane 30, uradnih insolvenčnih opravil pa je lahko 20 hkrati.
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
         greatest(0, 20 - count(*) filter (where faza = 'insolvenca'))::integer
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

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'uj-monitoring-worker-heartbeat'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'uj-monitoring-worker-heartbeat',
  '* * * * *',
  $job$
    with settings as (
      select
        (select decrypted_secret from vault.decrypted_secrets where name = 'uspesni_jezek_app_url' limit 1) as app_url,
        (select decrypted_secret from vault.decrypted_secrets where name = 'uspesni_jezek_cron_secret' limit 1) as cron_secret
    ), capacity as (
      select
        greatest(0, 30 - count(*))::integer as total_free,
        greatest(0, 20 - count(*) filter (where faza = 'insolvenca'))::integer as insolvency_free
      from public.mehka_boniteta_opravila
      where status = 'processing'
        and lease_until >= now()
    ), demand as (
      select least(20, capacity.total_free, capacity.insolvency_free,
        (
          select count(*)
            from public.boniteta_projektna_spremljanja m
           where m.disabled = false
             and m.completed_at is null
             and m.project_end_date >= (now() at time zone 'Europe/Ljubljana')::date
             and m.next_check_at <= now()
             and not exists(
               select 1
                 from public.mehka_boniteta_opravila j
                where j.project_monitor_id = m.id
                  and j.status in ('queued', 'processing')
             )
        ) + (
          select count(*)
            from public.mehka_boniteta_opravila j
           where j.source = 'project_monitor'
             and j.status = 'queued'
             and j.available_at <= now()
        )
      )::integer as worker_count
      from capacity
    )
    select net.http_post(
      url := rtrim(settings.app_url, '/') || '/api/mehka-boniteta-delavec',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || settings.cron_secret
      ),
      body := jsonb_build_object(
        'source', 'supabase-monitoring-heartbeat',
        'worker', worker_number
      ),
      timeout_milliseconds := 65000
    ) as request_id
      from settings
      cross join demand
      cross join lateral generate_series(1, demand.worker_count) worker_number
     where settings.app_url ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$'
       and length(settings.cron_secret) >= 16
  $job$
);

revoke all on function public.razporedi_zapadlo_projektno_spremljanje() from public, anon, authenticated;
revoke all on function public.prevzemi_mehka_boniteta_opravila(integer, integer) from public, anon, authenticated;
grant execute on function public.razporedi_zapadlo_projektno_spremljanje() to service_role;
grant execute on function public.prevzemi_mehka_boniteta_opravila(integer, integer) to service_role;
