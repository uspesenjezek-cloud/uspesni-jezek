-- Uradna insolvenčna preverba ostane do 20 sočasnih opravil, vendar posamezen
-- job nima več ugnezdenega retry proračuna. Za to fazo sta dovoljena največ dva
-- skupna poskusa, med njima pa le tri sekunde. Druge faze ohranijo obstoječi
-- max_attempts in eksponentni odmik.

create or replace function public.omeji_poskuse_mehka_boniteta_insolvenca()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.faza = 'insolvenca' then
    new.max_attempts := least(coalesce(new.max_attempts, 2), 2);
  end if;
  return new;
end;
$$;

revoke all on function public.omeji_poskuse_mehka_boniteta_insolvenca() from public, anon, authenticated;

drop trigger if exists mehka_boniteta_insolvenca_attempt_budget on public.mehka_boniteta_opravila;
create trigger mehka_boniteta_insolvenca_attempt_budget
before insert or update of faza, max_attempts on public.mehka_boniteta_opravila
for each row execute function public.omeji_poskuse_mehka_boniteta_insolvenca();

update public.mehka_boniteta_opravila
   set max_attempts = 2,
       updated_at = now()
 where faza = 'insolvenca'
   and status in ('queued', 'processing')
   and max_attempts > 2;

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
             then now() + case
               when faza = 'insolvenca' then interval '3 seconds'
               else make_interval(secs => least(120, 10 * (2 ^ greatest(attempts - 1, 0))::integer))
             end
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

revoke all on function public.zakljuci_mehka_boniteta_opravilo(uuid, uuid, boolean, jsonb, text, boolean)
  from public, anon, authenticated;
grant execute on function public.zakljuci_mehka_boniteta_opravilo(uuid, uuid, boolean, jsonb, text, boolean)
  to service_role;
