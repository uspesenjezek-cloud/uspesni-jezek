-- Boniteta: preverjeni rezultati so strežniško-avtoritativni, vsi podrejeni
-- zapisi pa morajo pripadati istemu uporabniku kot njihov profil.

-- 1. Odjemalec lahko bere svoje podatke in briše uporabniško upravljane
-- zapise. INSERT/UPDATE preverjenih rezultatov poteka samo prek service role.
revoke all on table public.boniteta_profili from public, anon, authenticated;
revoke all on table public.boniteta_pro_cache from public, anon, authenticated;
revoke all on table public.boniteta_monitorji from public, anon, authenticated;
revoke all on table public.boniteta_opozorila from public, anon, authenticated;
revoke all on table public.boniteta_projektna_spremljanja from public, anon, authenticated;
revoke all on table public.boniteta_ponovne_preverbe from public, anon, authenticated;
revoke all on table public.boniteta_650f_osnutki from public, anon, authenticated;

grant select, delete on table public.boniteta_profili to authenticated;
grant select on table public.boniteta_pro_cache to authenticated;
grant select, delete on table public.boniteta_monitorji to authenticated;
grant select on table public.boniteta_opozorila to authenticated;
grant select, delete on table public.boniteta_projektna_spremljanja to authenticated;
grant select, delete on table public.boniteta_ponovne_preverbe to authenticated;
grant select on table public.boniteta_650f_osnutki to authenticated;

grant select, insert, update, delete on table public.boniteta_profili to service_role;
grant select, insert, update, delete on table public.boniteta_pro_cache to service_role;
grant select, insert, update, delete on table public.boniteta_monitorji to service_role;
grant select, insert, update, delete on table public.boniteta_opozorila to service_role;
grant select, insert, update, delete on table public.boniteta_projektna_spremljanja to service_role;
grant select, insert, update, delete on table public.boniteta_ponovne_preverbe to service_role;
grant select, insert, update, delete on table public.boniteta_650f_osnutki to service_role;

drop policy if exists boniteta_profili_lastnik on public.boniteta_profili;
drop policy if exists boniteta_pro_cache_lastnik on public.boniteta_pro_cache;
drop policy if exists boniteta_monitorji_lastnik on public.boniteta_monitorji;
drop policy if exists boniteta_opozorila_lastnik on public.boniteta_opozorila;
drop policy if exists boniteta_profili_lastni_select on public.boniteta_profili;
drop policy if exists boniteta_profili_lastni_delete on public.boniteta_profili;
drop policy if exists boniteta_pro_cache_lastni_select on public.boniteta_pro_cache;
drop policy if exists boniteta_monitorji_lastni_select on public.boniteta_monitorji;
drop policy if exists boniteta_monitorji_lastni_delete on public.boniteta_monitorji;
drop policy if exists boniteta_opozorila_lastni_select on public.boniteta_opozorila;

create policy boniteta_profili_lastni_select on public.boniteta_profili
  for select to authenticated using ((select auth.uid()) = user_id);
create policy boniteta_profili_lastni_delete on public.boniteta_profili
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy boniteta_pro_cache_lastni_select on public.boniteta_pro_cache
  for select to authenticated using ((select auth.uid()) = user_id);
create policy boniteta_monitorji_lastni_select on public.boniteta_monitorji
  for select to authenticated using ((select auth.uid()) = user_id);
create policy boniteta_monitorji_lastni_delete on public.boniteta_monitorji
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy boniteta_opozorila_lastni_select on public.boniteta_opozorila
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Uporabnik ustvari svoja projektna spremljanja" on public.boniteta_projektna_spremljanja;
drop policy if exists "Uporabnik posodobi svoja projektna spremljanja" on public.boniteta_projektna_spremljanja;
drop policy if exists "Uporabnik ustvari svoje ponovne preverbe" on public.boniteta_ponovne_preverbe;
drop policy if exists "Uporabnik posodobi svoje ponovne preverbe" on public.boniteta_ponovne_preverbe;
drop policy if exists boniteta_650f_lastni_insert on public.boniteta_650f_osnutki;

-- 2. Enotni lastnik profila in vseh njegovih podrejenih zapisov. NOT VALID
-- takoj varuje nove zapise, starih neskladij pa ne izbriše.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.boniteta_profili'::regclass
       and conname = 'boniteta_profili_id_user_key'
  ) then
    alter table public.boniteta_profili
      add constraint boniteta_profili_id_user_key unique (id, user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.boniteta_pro_cache'::regclass and conname = 'boniteta_pro_cache_profile_owner_fkey') then
    alter table public.boniteta_pro_cache add constraint boniteta_pro_cache_profile_owner_fkey
      foreign key (profile_id, user_id) references public.boniteta_profili(id, user_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.boniteta_monitorji'::regclass and conname = 'boniteta_monitorji_profile_owner_fkey') then
    alter table public.boniteta_monitorji add constraint boniteta_monitorji_profile_owner_fkey
      foreign key (profile_id, user_id) references public.boniteta_profili(id, user_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.boniteta_opozorila'::regclass and conname = 'boniteta_opozorila_profile_owner_fkey') then
    alter table public.boniteta_opozorila add constraint boniteta_opozorila_profile_owner_fkey
      foreign key (profile_id, user_id) references public.boniteta_profili(id, user_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.boniteta_projektna_spremljanja'::regclass and conname = 'boniteta_projektna_profile_owner_fkey') then
    alter table public.boniteta_projektna_spremljanja add constraint boniteta_projektna_profile_owner_fkey
      foreign key (profile_id, user_id) references public.boniteta_profili(id, user_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.boniteta_ponovne_preverbe'::regclass and conname = 'boniteta_ponovne_profile_owner_fkey') then
    alter table public.boniteta_ponovne_preverbe add constraint boniteta_ponovne_profile_owner_fkey
      foreign key (profile_id, user_id) references public.boniteta_profili(id, user_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.boniteta_650f_osnutki'::regclass and conname = 'boniteta_650f_profile_owner_fkey') then
    alter table public.boniteta_650f_osnutki add constraint boniteta_650f_profile_owner_fkey
      foreign key (profile_id, user_id) references public.boniteta_profili(id, user_id) on delete cascade not valid;
  end if;
end;
$$;

-- Podatki so pred migracijo preverjeni, zato morajo biti vsi lastniški ključi
-- potrjeni še v isti transakciji. Neveljavna zgodovinska vrstica prekine release.
alter table public.boniteta_pro_cache validate constraint boniteta_pro_cache_profile_owner_fkey;
alter table public.boniteta_monitorji validate constraint boniteta_monitorji_profile_owner_fkey;
alter table public.boniteta_opozorila validate constraint boniteta_opozorila_profile_owner_fkey;
alter table public.boniteta_projektna_spremljanja validate constraint boniteta_projektna_profile_owner_fkey;
alter table public.boniteta_ponovne_preverbe validate constraint boniteta_ponovne_profile_owner_fkey;
alter table public.boniteta_650f_osnutki validate constraint boniteta_650f_profile_owner_fkey;

-- Stare profile označimo kot strežniško preverjene samo, če je njihov queueJobId
-- vezan na zaključeno opravilo istega lastnika in ima to opravilo poln dokaz.
update public.boniteta_profili p
   set latest_check = jsonb_set(latest_check, '{insolvency,officialVerification,serverEvidenceVerified}', 'true'::jsonb, true),
       updated_at = now()
 where latest_check->'insolvency'->'officialVerification'->>'evidenceStatus' = 'captured'
   and coalesce(latest_check->'insolvency'->'officialVerification'->>'serverEvidenceVerified', 'false') <> 'true'
   and exists (
     select 1 from public.mehka_boniteta_opravila j
      where j.id::text = p.latest_check->>'queueJobId'
        and j.user_id = p.user_id
        and j.status = 'completed'
        and j.result_payload->'insolvency'->>'status' in ('clear', 'possible_match')
        and j.result_payload->'insolvency'->'officialVerification'->>'evidenceStatus' = 'captured'
        and coalesce(j.result_payload->'insolvency'->'officialVerification'->>'evidenceImage', '') <> ''
   );

-- 3. Stare urnike brez veljavne uradne osnove nevtraliziramo brez brisanja.
update public.boniteta_projektna_spremljanja m
   set disabled = true,
       last_result_status = 'baseline_invalid',
       updated_at = now()
 where m.disabled = false
   and (
     not exists (
       select 1 from public.boniteta_profili p
        where p.id = m.profile_id and p.user_id = m.user_id
          and p.latest_check->'insolvency'->>'status' in ('clear', 'possible_match')
          and p.latest_check->'insolvency'->'officialVerification'->>'evidenceStatus' = 'captured'
          and (coalesce(p.latest_check->'insolvency'->'officialVerification'->>'evidenceImage', '') <> ''
            or p.latest_check->'insolvency'->'officialVerification'->>'serverEvidenceVerified' = 'true')
     )
     or (
       m.request_payload->>'monitoringMode' = 'internal_recheck'
       and not (
         m.request_payload->'monitoringBaseline'->'insolvency'->>'status' in ('clear', 'possible_match')
         and m.request_payload->'monitoringBaseline'->'insolvency'->'officialVerification'->>'evidenceStatus' = 'captured'
         and (coalesce(m.request_payload->'monitoringBaseline'->'insolvency'->'officialVerification'->>'evidenceImage', '') <> ''
           or m.request_payload->'monitoringBaseline'->'insolvency'->'officialVerification'->>'serverEvidenceVerified' = 'true')
       )
     )
   );

update public.boniteta_ponovne_preverbe r
   set status = 'cancelled', updated_at = now()
 where r.status in ('scheduled', 'queued')
   and not exists (
     select 1 from public.boniteta_profili p
      where p.id = r.profile_id and p.user_id = r.user_id
        and p.latest_check->'insolvency'->>'status' in ('clear', 'possible_match')
        and p.latest_check->'insolvency'->'officialVerification'->>'evidenceStatus' = 'captured'
        and (coalesce(p.latest_check->'insolvency'->'officialVerification'->>'evidenceImage', '') <> ''
          or p.latest_check->'insolvency'->'officialVerification'->>'serverEvidenceVerified' = 'true')
   );

update public.mehka_boniteta_opravila j
   set status = 'failed',
       last_error = 'Urnik nima veljavne uradne osnove ali istega lastnika.',
       lease_until = null,
       claim_token = null,
       finished_at = coalesce(finished_at, now()),
       updated_at = now()
 where j.status in ('queued', 'processing')
   and (
     exists (select 1 from public.boniteta_projektna_spremljanja m where m.id = j.project_monitor_id and m.disabled = true and m.last_result_status = 'baseline_invalid')
     or exists (select 1 from public.boniteta_ponovne_preverbe r where r.id = j.financial_recheck_id and r.status = 'cancelled')
   );

-- 4. Dve sočasni enaki zahtevi istega uporabnika ne smeta ustvariti dveh
-- aktivnih plačljivih opravil. Stare dvojnike zaključimo kot neuspele.
with ranked as (
  select id, row_number() over (partition by user_id, cache_key order by created_at, id) as rn
    from public.mehka_boniteta_opravila
   where status in ('queued', 'processing')
)
update public.mehka_boniteta_opravila j
   set status = 'failed',
       last_error = 'Podvojeno aktivno opravilo je bilo združeno z najstarejšim zahtevkom.',
       lease_until = null,
       claim_token = null,
       finished_at = coalesce(finished_at, now()),
       updated_at = now()
  from ranked r
 where j.id = r.id and r.rn > 1;

create unique index if not exists mehka_boniteta_one_active_user_cache_idx
  on public.mehka_boniteta_opravila(user_id, cache_key)
  where status in ('queued', 'processing');

-- 5. Zaključevanje spremljanja posodobi samo profil istega uporabnika in
-- sprejme samo popoln uradni rezultat z dokaznim posnetkom.
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
  v_safe_success boolean;
begin
  select m.* into v_monitor
    from public.boniteta_projektna_spremljanja m
    join public.mehka_boniteta_opravila j
      on j.project_monitor_id = m.id and j.user_id = m.user_id
    join public.boniteta_profili p
      on p.id = m.profile_id and p.user_id = m.user_id
   where j.id = p_job_id and j.status in ('completed', 'failed')
   for update of m;
  if v_monitor.id is null then return; end if;

  v_safe_success := coalesce(p_success, false)
    and p_result->'insolvency'->>'status' in ('clear', 'possible_match')
    and p_result->'insolvency'->'officialVerification'->>'evidenceStatus' = 'captured'
    and coalesce(p_result->'insolvency'->'officialVerification'->>'evidenceImage', '') <> '';
  v_status := case when v_safe_success then p_result->'insolvency'->>'status' else 'unavailable' end;
  v_time := case when coalesce(v_monitor.request_payload->>'monitoringTime', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    then v_monitor.request_payload->>'monitoringTime' else '12:00' end;

  if (now() at time zone 'Europe/Ljubljana')::date >= v_monitor.project_end_date then
    v_next := null;
  else
    v_next_local_date := greatest((now() at time zone 'Europe/Ljubljana')::date, (v_monitor.next_check_at at time zone 'Europe/Ljubljana')::date) + v_monitor.interval_days;
    v_next := (v_next_local_date + v_time::time) at time zone 'Europe/Ljubljana';
    v_end := (v_monitor.project_end_date + v_time::time) at time zone 'Europe/Ljubljana';
    v_next := least(v_next, v_end);
  end if;

  update public.boniteta_projektna_spremljanja
     set last_check_at = now(), last_result_status = v_status, next_check_at = v_next,
         request_payload = case when v_safe_success then
           jsonb_set(jsonb_set(request_payload, '{monitoringBaseline}', coalesce(p_result->'monitoringBaseline', '{}'::jsonb), true), '{monitoringCardState}', coalesce(p_result->'monitoringCardState', '{}'::jsonb), true)
         else request_payload end,
         completed_at = case when v_next is null then now() else null end, updated_at = now()
   where id = v_monitor.id and user_id = v_monitor.user_id;

  update public.boniteta_profili
     set latest_check = case when v_safe_success then coalesce(p_result, '{}'::jsonb) - 'monitoringBaseline' else latest_check end,
         checked_at = case when v_safe_success then now() else checked_at end,
         updated_at = now()
   where id = v_monitor.profile_id and user_id = v_monitor.user_id;

  if v_safe_success and v_status in ('possible_match') then
    insert into public.boniteta_opozorila(user_id, profile_id, external_event_id, category, title, payload)
    values(v_monitor.user_id, v_monitor.profile_id, 'project-monitor:' || p_job_id, 'insolvency', 'Projektna ponovna preverba zahteva pregled', coalesce(p_result, '{}'::jsonb))
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.zakljuci_financno_ponovno_preverbo(p_job_id uuid, p_success boolean, p_result jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_recheck public.boniteta_ponovne_preverbe;
  v_safe_success boolean;
begin
  select r.* into v_recheck
    from public.boniteta_ponovne_preverbe r
    join public.mehka_boniteta_opravila j
      on j.financial_recheck_id = r.id and j.user_id = r.user_id
    join public.boniteta_profili p
      on p.id = r.profile_id and p.user_id = r.user_id
   where j.id = p_job_id and j.status in ('completed', 'failed')
   for update of r;
  if v_recheck.id is null then return; end if;
  v_safe_success := coalesce(p_success, false)
    and p_result->'insolvency'->>'status' in ('clear', 'possible_match')
    and p_result->'insolvency'->'officialVerification'->>'evidenceStatus' = 'captured'
    and coalesce(p_result->'insolvency'->'officialVerification'->>'evidenceImage', '') <> '';
  update public.boniteta_ponovne_preverbe
     set status = case when v_safe_success then 'completed' else 'failed' end,
         completed_at = now(), updated_at = now()
   where id = v_recheck.id and user_id = v_recheck.user_id;
  update public.boniteta_profili
     set latest_check = case when v_safe_success then coalesce(p_result, '{}'::jsonb) else latest_check end,
         checked_at = case when v_safe_success then now() else checked_at end,
         updated_at = now()
   where id = v_recheck.profile_id and user_id = v_recheck.user_id;
end;
$$;

revoke all on function public.zakljuci_projektno_spremljanje(uuid, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.zakljuci_financno_ponovno_preverbo(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.zakljuci_projektno_spremljanje(uuid, boolean, jsonb) to service_role;
grant execute on function public.zakljuci_financno_ponovno_preverbo(uuid, boolean, jsonb) to service_role;
