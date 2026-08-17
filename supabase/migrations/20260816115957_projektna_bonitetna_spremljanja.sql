-- Projektno spremljanje: periodična insolvenčna preverba iste, že potrjene stranke.
create table public.boniteta_projektna_spremljanja (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.boniteta_profili(id) on delete cascade,
  project_value_cents bigint not null check (project_value_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  project_start_date date not null,
  project_end_date date not null,
  interval_days integer not null check (interval_days between 1 and 365),
  final_check_days_before integer not null default 3 check (final_check_days_before between 0 and 30),
  request_payload jsonb not null,
  next_check_at timestamptz,
  last_check_at timestamptz,
  last_result_status text,
  last_job_id uuid,
  disabled boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, profile_id),
  check (project_end_date >= project_start_date)
);

alter table public.boniteta_projektna_spremljanja enable row level security;
revoke all on table public.boniteta_projektna_spremljanja from public, anon;
grant select, insert, update, delete on table public.boniteta_projektna_spremljanja to authenticated, service_role;
create policy "Uporabnik bere svoja projektna spremljanja" on public.boniteta_projektna_spremljanja for select to authenticated using ((select auth.uid()) = user_id);
create policy "Uporabnik ustvari svoja projektna spremljanja" on public.boniteta_projektna_spremljanja for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Uporabnik posodobi svoja projektna spremljanja" on public.boniteta_projektna_spremljanja for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Uporabnik izbriše svoja projektna spremljanja" on public.boniteta_projektna_spremljanja for delete to authenticated using ((select auth.uid()) = user_id);
create index boniteta_projektna_user_idx on public.boniteta_projektna_spremljanja(user_id, updated_at desc);
create index boniteta_projektna_due_idx on public.boniteta_projektna_spremljanja(next_check_at) where disabled = false and completed_at is null;

alter table public.mehka_boniteta_opravila add column if not exists source text not null default 'user' check (source in ('user','project_monitor'));
alter table public.mehka_boniteta_opravila add column if not exists project_monitor_id uuid references public.boniteta_projektna_spremljanja(id) on delete set null;
create index mehka_boniteta_user_priority_idx on public.mehka_boniteta_opravila(source, available_at, created_at) where status = 'queued';

create or replace function public.razporedi_zapadlo_projektno_spremljanje()
returns public.mehka_boniteta_opravila language plpgsql security invoker set search_path=public as $$
declare v_monitor public.boniteta_projektna_spremljanja; v_job public.mehka_boniteta_opravila;
begin
  perform pg_advisory_xact_lock(hashtextextended('projektno_bonitetno_spremljanje',0));
  if exists(select 1 from public.mehka_boniteta_opravila where source='user' and status in ('queued','processing')) then return null; end if;
  select * into v_monitor from public.boniteta_projektna_spremljanja
   where disabled=false and completed_at is null and next_check_at<=now()
     and not exists(select 1 from public.mehka_boniteta_opravila j where j.project_monitor_id=boniteta_projektna_spremljanja.id and j.status in ('queued','processing'))
   order by next_check_at for update skip locked limit 1;
  if v_monitor.id is null then return null; end if;
  insert into public.mehka_boniteta_opravila(user_id,faza,status,cache_key,request_payload,source,project_monitor_id)
  values(v_monitor.user_id,'insolvenca','queued',md5(v_monitor.request_payload::text || now()::date::text),v_monitor.request_payload,'project_monitor',v_monitor.id)
  returning * into v_job;
  update public.boniteta_projektna_spremljanja set last_job_id=v_job.id,updated_at=now() where id=v_monitor.id;
  return v_job;
end $$;

create or replace function public.zakljuci_projektno_spremljanje(p_job_id uuid,p_success boolean,p_result jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare v public.boniteta_projektna_spremljanja; v_status text; v_final timestamptz; v_next timestamptz;
begin
  select m.* into v from public.boniteta_projektna_spremljanja m join public.mehka_boniteta_opravila j on j.project_monitor_id=m.id where j.id=p_job_id for update of m;
  if v.id is null then return; end if;
  v_status:=coalesce(p_result->'insolvency'->>'status',case when p_success then 'checked' else 'unavailable' end);
  v_final:=(v.project_end_date::timestamp + interval '12 hours') - make_interval(days=>v.final_check_days_before);
  if now() >= v_final then v_next:=null; else v_next:=least(now()+make_interval(days=>v.interval_days),v_final); end if;
  update public.boniteta_projektna_spremljanja set last_check_at=now(),last_result_status=v_status,next_check_at=v_next,
    completed_at=case when v_next is null then now() else null end,updated_at=now() where id=v.id;
  update public.boniteta_profili set latest_check=case when p_success then coalesce(p_result,'{}'::jsonb) else latest_check end,
    checked_at=case when p_success then now() else checked_at end,updated_at=now() where id=v.profile_id;
  if v_status in ('found','possible_match','match','warning') then
    insert into public.boniteta_opozorila(user_id,profile_id,external_event_id,category,title,payload)
    values(v.user_id,v.profile_id,'project-monitor:'||p_job_id,'insolvency','Projektna ponovna preverba zahteva pregled',coalesce(p_result,'{}'::jsonb)) on conflict do nothing;
  end if;
end $$;

-- Ročne zahteve imajo vedno prednost pred samodejnimi.
create or replace function public.prevzemi_mehka_boniteta_opravila(p_limit integer default 30,p_lease_seconds integer default 75)
returns setof public.mehka_boniteta_opravila language plpgsql security invoker set search_path=public as $$
declare v_limit integer:=least(greatest(coalesce(p_limit,1),1),30); v_lease integer:=least(greatest(coalesce(p_lease_seconds,75),30),180); v_free integer; v_ins integer; v_ids uuid[]:=array[]::uuid[]; c record;
begin
 perform pg_advisory_xact_lock(hashtextextended('mehka_boniteta_sloti',0));
 update public.mehka_boniteta_opravila set status=case when attempts>=max_attempts then 'failed' else 'queued' end,lease_until=null,claim_token=null,updated_at=now() where status='processing' and lease_until<now();
 select greatest(0,30-count(*))::int,greatest(0,10-count(*) filter(where faza='insolvenca'))::int into v_free,v_ins from public.mehka_boniteta_opravila where status='processing' and lease_until>=now();
 for c in select id,faza from public.mehka_boniteta_opravila where status='queued' and available_at<=now() order by case source when 'user' then 0 else 1 end,created_at for update skip locked loop
  exit when cardinality(v_ids)>=least(v_limit,v_free); if c.faza='insolvenca' and v_ins=0 then continue; end if; v_ids:=array_append(v_ids,c.id); if c.faza='insolvenca' then v_ins:=v_ins-1; end if;
 end loop;
 return query update public.mehka_boniteta_opravila o set status='processing',attempts=o.attempts+1,started_at=coalesce(o.started_at,now()),lease_until=now()+make_interval(secs=>v_lease),claim_token=gen_random_uuid(),updated_at=now() where o.id=any(v_ids) returning o.*;
end $$;

revoke all on function public.razporedi_zapadlo_projektno_spremljanje() from public,anon,authenticated;
revoke all on function public.zakljuci_projektno_spremljanje(uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.razporedi_zapadlo_projektno_spremljanje(),public.zakljuci_projektno_spremljanje(uuid,boolean,jsonb) to service_role;

;
