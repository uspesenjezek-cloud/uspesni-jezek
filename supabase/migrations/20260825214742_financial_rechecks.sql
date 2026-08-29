create table public.boniteta_ponovne_preverbe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.boniteta_profili(id) on delete cascade,
  reason text not null check (reason in ('equity_decline_material')),
  interval_days integer not null check (interval_days in (30, 90, 180, 365)),
  scheduled_for timestamptz not null,
  request_payload jsonb not null default '{}'::jsonb,
  status text not null default 'scheduled' check (status in ('scheduled', 'queued', 'completed', 'failed', 'cancelled')),
  last_job_id uuid references public.mehka_boniteta_opravila(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, profile_id, reason)
);

alter table public.boniteta_ponovne_preverbe enable row level security;
revoke all on table public.boniteta_ponovne_preverbe from public, anon;
grant select, insert, update, delete on table public.boniteta_ponovne_preverbe to authenticated;
grant select, insert, update, delete on table public.boniteta_ponovne_preverbe to service_role;
create policy "Uporabnik bere svoje ponovne preverbe" on public.boniteta_ponovne_preverbe for select to authenticated using ((select auth.uid()) = user_id);
create policy "Uporabnik ustvari svoje ponovne preverbe" on public.boniteta_ponovne_preverbe for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Uporabnik posodobi svoje ponovne preverbe" on public.boniteta_ponovne_preverbe for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Uporabnik izbriše svoje ponovne preverbe" on public.boniteta_ponovne_preverbe for delete to authenticated using ((select auth.uid()) = user_id);
create index boniteta_ponovne_preverbe_due_idx on public.boniteta_ponovne_preverbe(scheduled_for) where status = 'scheduled';

alter table public.mehka_boniteta_opravila drop constraint if exists mehka_boniteta_opravila_source_check;
alter table public.mehka_boniteta_opravila add constraint mehka_boniteta_opravila_source_check check (source in ('user', 'project_monitor', 'financial_recheck'));
alter table public.mehka_boniteta_opravila add column financial_recheck_id uuid references public.boniteta_ponovne_preverbe(id) on delete set null;
create index mehka_boniteta_financial_recheck_idx on public.mehka_boniteta_opravila(financial_recheck_id) where financial_recheck_id is not null;

create or replace function public.razporedi_zapadlo_financno_ponovno_preverbo()
returns public.mehka_boniteta_opravila
language plpgsql
security definer
set search_path = ''
as $$
declare v_recheck public.boniteta_ponovne_preverbe; v_job public.mehka_boniteta_opravila;
begin
  perform pg_advisory_xact_lock(hashtextextended('financno_ponovno_preverjanje', 0));
  if exists(select 1 from public.mehka_boniteta_opravila where source = 'user' and status in ('queued', 'processing')) then return null; end if;
  select * into v_recheck from public.boniteta_ponovne_preverbe
   where status = 'scheduled' and scheduled_for <= now()
     and not exists(select 1 from public.mehka_boniteta_opravila j where j.financial_recheck_id = boniteta_ponovne_preverbe.id and j.status in ('queued', 'processing'))
   order by scheduled_for for update skip locked limit 1;
  if v_recheck.id is null then return null; end if;
  insert into public.mehka_boniteta_opravila(user_id, faza, status, cache_key, request_payload, source, financial_recheck_id)
  values(v_recheck.user_id, 'insolvenca', 'queued', md5(v_recheck.id::text || v_recheck.scheduled_for::text), v_recheck.request_payload, 'financial_recheck', v_recheck.id)
  returning * into v_job;
  update public.boniteta_ponovne_preverbe set status = 'queued', last_job_id = v_job.id, updated_at = now() where id = v_recheck.id;
  return v_job;
end;
$$;

create or replace function public.zakljuci_financno_ponovno_preverbo(p_job_id uuid, p_success boolean, p_result jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_recheck public.boniteta_ponovne_preverbe;
begin
  select r.* into v_recheck from public.boniteta_ponovne_preverbe r
  join public.mehka_boniteta_opravila j on j.financial_recheck_id = r.id
  where j.id = p_job_id and j.status in ('completed', 'failed') for update of r;
  if v_recheck.id is null then return; end if;
  update public.boniteta_ponovne_preverbe set status = case when p_success then 'completed' else 'failed' end, completed_at = now(), updated_at = now() where id = v_recheck.id;
  update public.boniteta_profili set latest_check = case when p_success then coalesce(p_result, '{}'::jsonb) else latest_check end, checked_at = case when p_success then now() else checked_at end, updated_at = now() where id = v_recheck.profile_id;
end;
$$;

revoke all on function public.razporedi_zapadlo_financno_ponovno_preverbo() from public, anon, authenticated;
revoke all on function public.zakljuci_financno_ponovno_preverbo(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.razporedi_zapadlo_financno_ponovno_preverbo(), public.zakljuci_financno_ponovno_preverbo(uuid, boolean, jsonb) to service_role;
