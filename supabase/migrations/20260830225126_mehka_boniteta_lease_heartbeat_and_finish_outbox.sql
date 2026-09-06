-- Lease heartbeat in trajna uskladitev terminalnih Boniteta opravil.
-- Migracija je namenoma strežniška: noben nov objekt ni neposredno dostopen
-- anon ali authenticated vlogi.

create table if not exists public.boniteta_zakljucki_za_uskladitev (
  id uuid primary key default gen_random_uuid(),
  -- job_id je trajni korelacijski ID, namenoma brez FK: uporabnik sme izbrisati
  -- zaključen source job, obveznost uskladitve pa mora ostati.
  job_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('project_monitor', 'financial_recheck')),
  success boolean not null,
  result_payload jsonb,
  request_payload jsonb not null default '{}'::jsonb,
  project_monitor_id uuid references public.boniteta_projektna_spremljanja(id) on delete cascade,
  financial_recheck_id uuid references public.boniteta_ponovne_preverbe(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  claim_token uuid,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint boniteta_zakljucki_target_check check (
    (kind = 'project_monitor' and project_monitor_id is not null and financial_recheck_id is null)
    or
    (kind = 'financial_recheck' and financial_recheck_id is not null and project_monitor_id is null)
  ),
  unique (job_id, kind)
);

alter table public.boniteta_zakljucki_za_uskladitev enable row level security;
revoke all on table public.boniteta_zakljucki_za_uskladitev from public, anon, authenticated;
grant select, insert, update, delete on table public.boniteta_zakljucki_za_uskladitev to service_role;

create index if not exists boniteta_zakljucki_pending_idx
  on public.boniteta_zakljucki_za_uskladitev(available_at, created_at)
  where status = 'pending';
create index if not exists boniteta_zakljucki_processing_idx
  on public.boniteta_zakljucki_za_uskladitev(lease_until)
  where status = 'processing';
create index if not exists boniteta_zakljucki_user_idx
  on public.boniteta_zakljucki_za_uskladitev(user_id);
create index if not exists boniteta_zakljucki_project_target_idx
  on public.boniteta_zakljucki_za_uskladitev(project_monitor_id)
  where project_monitor_id is not null;
create index if not exists boniteta_zakljucki_financial_target_idx
  on public.boniteta_zakljucki_za_uskladitev(financial_recheck_id)
  where financial_recheck_id is not null;

-- Terminalni source job sam po sebi še ne pomeni, da je urnik premaknjen.
-- Dokler njegov outbox čaka ali se obdeluje, scheduler za isti monitor ne sme
-- ustvariti novega joba in s tem dovoliti dveh zaporednih premikov.
create or replace function public.razporedi_zapadlo_projektno_spremljanje()
returns public.mehka_boniteta_opravila
language plpgsql
security invoker
set search_path = ''
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
       and not exists(
         select 1
           from public.boniteta_zakljucki_za_uskladitev r
          where r.project_monitor_id = m.id
            and r.status in ('pending', 'processing')
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
     where id = v_monitor.id and user_id = v_monitor.user_id;

    if not v_has_first then
      v_first := v_job;
      v_has_first := true;
    end if;
  end loop;

  return v_first;
end;
$$;

create or replace function public.zabelezi_boniteta_zakljucek_za_uskladitev()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.project_monitor_id is not null then
    insert into public.boniteta_zakljucki_za_uskladitev(
      job_id, user_id, kind, success, result_payload, request_payload, project_monitor_id, financial_recheck_id
    ) values (
      new.id, new.user_id, 'project_monitor', new.status = 'completed', new.result_payload,
      new.request_payload, new.project_monitor_id, null
    ) on conflict (job_id, kind) do nothing;
  end if;
  if new.financial_recheck_id is not null then
    insert into public.boniteta_zakljucki_za_uskladitev(
      job_id, user_id, kind, success, result_payload, request_payload, project_monitor_id, financial_recheck_id
    ) values (
      new.id, new.user_id, 'financial_recheck', new.status = 'completed', new.result_payload,
      new.request_payload, null, new.financial_recheck_id
    ) on conflict (job_id, kind) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists mehka_boniteta_terminal_finish_outbox on public.mehka_boniteta_opravila;
create trigger mehka_boniteta_terminal_finish_outbox
after update of status on public.mehka_boniteta_opravila
for each row
when (new.status in ('completed', 'failed') and old.status not in ('completed', 'failed'))
execute function public.zabelezi_boniteta_zakljucek_za_uskladitev();

-- Popravi tudi morebitne terminalne vrstice, ki so obstale pred uvedbo
-- outboxa zaradi prehodne napake ločenega finish RPC-ja.
insert into public.boniteta_zakljucki_za_uskladitev(
  job_id, user_id, kind, success, result_payload, request_payload, project_monitor_id, financial_recheck_id
)
select j.id, j.user_id, 'project_monitor', j.status = 'completed', j.result_payload,
       j.request_payload, j.project_monitor_id, null
  from public.mehka_boniteta_opravila j
  join public.boniteta_projektna_spremljanja m on m.id = j.project_monitor_id and m.user_id = j.user_id
 where j.status in ('completed', 'failed')
   and (m.last_check_at is null or m.last_check_at < coalesce(j.finished_at, j.updated_at))
   and not exists (
     select 1 from public.mehka_boniteta_opravila newer
      where newer.project_monitor_id = j.project_monitor_id
        and newer.status in ('completed', 'failed')
        and (coalesce(newer.finished_at, newer.updated_at), newer.id) > (coalesce(j.finished_at, j.updated_at), j.id)
   )
on conflict (job_id, kind) do nothing;

insert into public.boniteta_zakljucki_za_uskladitev(
  job_id, user_id, kind, success, result_payload, request_payload, project_monitor_id, financial_recheck_id
)
select j.id, j.user_id, 'financial_recheck', j.status = 'completed', j.result_payload,
       j.request_payload, null, j.financial_recheck_id
  from public.mehka_boniteta_opravila j
  join public.boniteta_ponovne_preverbe r
    on r.id = j.financial_recheck_id and r.user_id = j.user_id and r.last_job_id = j.id
 where j.status in ('completed', 'failed') and r.status = 'queued'
on conflict (job_id, kind) do nothing;

-- CAS heartbeat: najem lahko podaljša samo trenutni claim token in samo pred
-- iztekom. Star delavec zato ne more oživiti že prevzetega opravila.
create or replace function public.podaljsaj_mehka_boniteta_najem(
  p_id uuid,
  p_claim_token uuid,
  p_lease_seconds integer default 75
)
returns public.mehka_boniteta_opravila
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.mehka_boniteta_opravila;
  v_lease integer := least(greatest(coalesce(p_lease_seconds, 75), 30), 180);
begin
  update public.mehka_boniteta_opravila
     set lease_until = now() + make_interval(secs => v_lease),
         updated_at = now()
   where id = p_id
     and status = 'processing'
     and claim_token = p_claim_token
     and lease_until >= now()
  returning * into v_row;
  return v_row;
end;
$$;

-- Terminalni prehod in outbox sta ena transakcija. Če kasnejši RPC za profil
-- ali urnik začasno odpove, obveznost uskladitve zato ne more izginiti.
create or replace function public.zakljuci_mehka_boniteta_opravilo(
  p_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_result jsonb default null,
  p_error text default null,
  p_retryable boolean default false
)
returns public.mehka_boniteta_opravila
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.mehka_boniteta_opravila;
begin
  update public.mehka_boniteta_opravila
     set status = case
           when p_success then 'completed'
           when p_retryable and attempts < max_attempts then 'queued'
           else 'failed'
         end,
         result_payload = coalesce(p_result, result_payload),
         last_error = left(nullif(p_error, ''), 500),
         available_at = case
           when not p_success and p_retryable and attempts < max_attempts
             then now() + make_interval(secs => least(120, 10 * (2 ^ greatest(attempts - 1, 0))::integer))
           else available_at
         end,
         lease_until = null,
         claim_token = null,
         finished_at = case
           when p_success or not p_retryable or attempts >= max_attempts then now()
           else null
         end,
         updated_at = now()
   where id = p_id
     and status = 'processing'
     and claim_token = p_claim_token
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Opravilo ni več v lasti tega delavca.' using errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

create or replace function public.prevzemi_boniteta_zakljucke_za_uskladitev(
  p_limit integer default 1,
  p_lease_seconds integer default 60,
  p_job_id uuid default null
)
returns setof public.boniteta_zakljucki_za_uskladitev
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 1), 1), 10);
  v_lease integer := least(greatest(coalesce(p_lease_seconds, 60), 30), 180);
begin
  update public.boniteta_zakljucki_za_uskladitev
     set status = 'pending',
         available_at = least(available_at, now()),
         lease_until = null,
         claim_token = null,
         updated_at = now()
   where status = 'processing'
     and lease_until < now();

  return query
  with kandidati as (
    select r.id
      from public.boniteta_zakljucki_za_uskladitev r
     where r.status = 'pending'
       and r.available_at <= now()
       and (p_job_id is null or r.job_id = p_job_id)
     order by r.available_at, r.created_at
     limit v_limit
     for update skip locked
  )
  update public.boniteta_zakljucki_za_uskladitev r
     set status = 'processing',
         attempts = r.attempts + 1,
         lease_until = now() + make_interval(secs => v_lease),
         claim_token = gen_random_uuid(),
         updated_at = now()
    from kandidati k
   where r.id = k.id
  returning r.*;
end;
$$;

-- Ciljni finish RPC in označitev outboxa kot completed sta ena transakcija.
-- Tako izgubljen HTTP odgovor po uspešnem COMMIT-u ne more povzročiti drugega
-- premika projektnega urnika ob naslednjem retryju.
create or replace function public.izvedi_boniteta_uskladitev(
  p_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_result jsonb
)
returns public.boniteta_zakljucki_za_uskladitev
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry public.boniteta_zakljucki_za_uskladitev;
begin
  select r.* into v_entry
    from public.boniteta_zakljucki_za_uskladitev r
   where r.id = p_id and r.status = 'processing' and r.claim_token = p_claim_token
   for update;
  if v_entry.id is null then return null; end if;

  if v_entry.kind = 'project_monitor' then
    perform public.zakljuci_projektno_spremljanje_cilj(
      v_entry.project_monitor_id, v_entry.user_id, v_entry.job_id, coalesce(p_success, false), p_result
    );
  elsif v_entry.kind = 'financial_recheck' then
    perform public.zakljuci_financno_ponovno_preverbo_cilj(
      v_entry.financial_recheck_id, v_entry.user_id, v_entry.job_id, coalesce(p_success, false), p_result
    );
  else
    raise exception 'Neznana vrsta Boniteta uskladitve.' using errcode = 'P0001';
  end if;

  update public.boniteta_zakljucki_za_uskladitev
     set status = 'completed', lease_until = null, claim_token = null,
         result_payload = null, request_payload = '{}'::jsonb,
         last_error = null, finished_at = now(), updated_at = now()
   where id = v_entry.id and status = 'processing' and claim_token = p_claim_token
  returning * into v_entry;
  return v_entry;
end;
$$;

create or replace function public.zakljuci_boniteta_uskladitev(
  p_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error text default null
)
returns public.boniteta_zakljucki_za_uskladitev
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.boniteta_zakljucki_za_uskladitev;
begin
  update public.boniteta_zakljucki_za_uskladitev
     set status = case when p_success then 'completed' else 'pending' end,
         available_at = case when p_success then available_at else
           now() + make_interval(secs => least(900, 10 * (2 ^ least(greatest(attempts - 1, 0), 6))::integer)) end,
         lease_until = null,
         claim_token = null,
         last_error = case when p_success then null else left(coalesce(nullif(p_error, ''), 'Uskladitev ni uspela.'), 500) end,
         result_payload = case when p_success then null else result_payload end,
         request_payload = case when p_success then '{}'::jsonb else request_payload end,
         finished_at = case when p_success then now() else null end,
         updated_at = now()
   where id = p_id
     and status = 'processing'
     and claim_token = p_claim_token
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.podaljsaj_mehka_boniteta_najem(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.razporedi_zapadlo_projektno_spremljanje() from public, anon, authenticated;
revoke all on function public.zabelezi_boniteta_zakljucek_za_uskladitev() from public, anon, authenticated;
revoke all on function public.zakljuci_mehka_boniteta_opravilo(uuid, uuid, boolean, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.prevzemi_boniteta_zakljucke_za_uskladitev(integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.izvedi_boniteta_uskladitev(uuid, uuid, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.zakljuci_boniteta_uskladitev(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.podaljsaj_mehka_boniteta_najem(uuid, uuid, integer) to service_role;
grant execute on function public.razporedi_zapadlo_projektno_spremljanje() to service_role;
grant execute on function public.zabelezi_boniteta_zakljucek_za_uskladitev() to service_role;
grant execute on function public.zakljuci_mehka_boniteta_opravilo(uuid, uuid, boolean, jsonb, text, boolean) to service_role;
grant execute on function public.prevzemi_boniteta_zakljucke_za_uskladitev(integer, integer, uuid) to service_role;
grant execute on function public.izvedi_boniteta_uskladitev(uuid, uuid, boolean, jsonb) to service_role;
grant execute on function public.zakljuci_boniteta_uskladitev(uuid, uuid, boolean, text) to service_role;

-- Če po terminalnem opravilu ni več običajnega queue prometa, cron še vedno
-- prebudi omejeno število delavcev za zapadle ali po padcu ostale uskladitve.
do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'uj-boniteta-finish-reconciliation'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'uj-boniteta-finish-reconciliation',
  '* * * * *',
  $job$
    with settings as (
      select
        (select decrypted_secret from vault.decrypted_secrets where name = 'uspesni_jezek_app_url' limit 1) as app_url,
        (select decrypted_secret from vault.decrypted_secrets where name = 'uspesni_jezek_cron_secret' limit 1) as cron_secret
    ), demand as (
      select least(10, count(*))::integer as worker_count
        from public.boniteta_zakljucki_za_uskladitev
       where (status = 'pending' and available_at <= now())
          or (status = 'processing' and lease_until < now())
    )
    select net.http_post(
      url := rtrim(settings.app_url, '/') || '/api/mehka-boniteta-delavec',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || settings.cron_secret
      ),
      body := jsonb_build_object(
        'source', 'boniteta-finish-reconciliation',
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

comment on table public.boniteta_zakljucki_za_uskladitev is
  'Trajni service-role outbox za uskladitev terminalnih Boniteta opravil s projektnimi in finančnimi urniki.';
