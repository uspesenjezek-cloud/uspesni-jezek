-- Povečanje globalne omejitve uradnih preverjanj z 2 na 10.
-- Vsako opravilo še vedno prevzame samostojna funkcija, SKIP LOCKED pa prepreči
-- dvojni prevzem tudi pri več sočasnih Vercel izvajanjih.

create or replace function public.prevzemi_mehka_boniteta_opravila(
  p_limit integer default 10,
  p_lease_seconds integer default 75
)
returns setof public.mehka_boniteta_opravila
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 1), 1), 10);
  v_lease_seconds integer := least(greatest(coalesce(p_lease_seconds, 75), 30), 180);
  v_prosta_mesta integer;
begin
  update public.mehka_boniteta_opravila
     set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
         available_at = case
           when attempts >= max_attempts then available_at
           else now() + make_interval(secs => least(120, 10 * (2 ^ greatest(attempts - 1, 0))::integer))
         end,
         lease_until = null,
         claim_token = null,
         last_error = coalesce(last_error, 'Čas obdelave je potekel.'),
         finished_at = case when attempts >= max_attempts then now() else finished_at end,
         updated_at = now()
   where status = 'processing'
     and lease_until < now();

  select greatest(0, 10 - count(*))::integer
    into v_prosta_mesta
    from public.mehka_boniteta_opravila
   where status = 'processing'
     and lease_until >= now();

  return query
  with kandidati as (
    select id
      from public.mehka_boniteta_opravila
     where status = 'queued'
       and available_at <= now()
     order by created_at
     limit least(v_limit, v_prosta_mesta)
     for update skip locked
  )
  update public.mehka_boniteta_opravila o
     set status = 'processing',
         attempts = o.attempts + 1,
         started_at = coalesce(o.started_at, now()),
         lease_until = now() + make_interval(secs => v_lease_seconds),
         claim_token = gen_random_uuid(),
         updated_at = now()
    from kandidati k
   where o.id = k.id
  returning o.*;
end;
$$;

revoke all on function public.prevzemi_mehka_boniteta_opravila(integer, integer) from public, anon, authenticated;
grant execute on function public.prevzemi_mehka_boniteta_opravila(integer, integer) to service_role;

;
