-- Uporabniški wake-up worker sme prevzeti samo opravilo istega uporabnika.
-- Globalni cron še naprej uporablja obstoječi prevzemi_mehka_boniteta_opravila.
create or replace function public.prevzemi_mehka_boniteta_opravila_za_uporabnika(
  p_limit integer,
  p_lease_seconds integer,
  p_user_id uuid
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
  if p_user_id is null then
    return;
  end if;

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
       and user_id = p_user_id
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
     and o.user_id = p_user_id
  returning o.*;
end;
$$;

revoke all on function public.prevzemi_mehka_boniteta_opravila_za_uporabnika(integer, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.prevzemi_mehka_boniteta_opravila_za_uporabnika(integer, integer, uuid)
  to service_role;

