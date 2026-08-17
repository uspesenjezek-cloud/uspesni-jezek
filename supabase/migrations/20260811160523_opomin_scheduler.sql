-- Normalizirana čakalna vrsta za varno pošiljanje opominov.
-- JSONB načrt ostane uporabniški dokument; ta tabela je strežniški vir resnice
-- za scheduler in retry logiko.

create table if not exists public.opomin_koraki (
  id uuid primary key default gen_random_uuid(),
  zadeva_id uuid not null references public.zadeve(id) on delete cascade,
  obrtnik_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  step_id text not null,
  step_index integer not null check (step_index > 0),
  recipient_index integer not null default 0 check (recipient_index >= 0),
  prejemnik text not null check (length(trim(prejemnik)) > 0),
  sporocilo text not null check (length(trim(sporocilo)) > 0),
  status text not null default 'scheduled' check (
    status in ('scheduled', 'processing', 'sent', 'failed', 'cancelled')
  ),
  scheduled_at timestamptz not null,
  idempotency_key text not null unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  last_error text,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  ustvarjeno_at timestamptz not null default now(),
  posodobljeno_at timestamptz not null default now(),
  unique (zadeva_id, step_id, recipient_index)
);

create index if not exists opomin_koraki_due_idx
  on public.opomin_koraki (coalesce(next_retry_at, scheduled_at), status)
  where status in ('scheduled', 'failed');

create index if not exists opomin_koraki_zadeva_idx
  on public.opomin_koraki (zadeva_id, step_index);

alter table public.opomin_koraki enable row level security;

drop policy if exists "Obrtnik vidi svoje opomin korake" on public.opomin_koraki;
create policy "Obrtnik vidi svoje opomin korake"
on public.opomin_koraki
for select
to authenticated
using ((select auth.uid()) = obrtnik_id);

-- Frontend lahko vrstice samo bere. Vstavljanje in spreminjanje izvaja
-- izključno strežniški API s service_role.
grant select on public.opomin_koraki to authenticated;
grant select, insert, update, delete on public.opomin_koraki to service_role;

-- Aktivacija načrta in izdelava čakalne vrste sta ena transakcija.
create or replace function public.aktiviraj_opomin_nacrt(
  p_zadeva_id uuid,
  p_expected_version text,
  p_plan jsonb,
  p_steps jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_zadeva public.zadeve%rowtype;
  v_version text;
  v_existing integer;
begin
  select * into v_zadeva
  from public.zadeve
  where id = p_zadeva_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_version := coalesce(v_zadeva.opomin_nacrt->>'version', '0');

  -- Idempotenten odgovor, če je prejšnja zahteva uspela, odgovor pa se je izgubil.
  if v_zadeva.opomin_nacrt->>'serverActivatedAt' is not null then
    select count(*) into v_existing
    from public.opomin_koraki
    where zadeva_id = p_zadeva_id;

    return jsonb_build_object(
      'ok', true,
      'alreadyActivated', true,
      'version', v_version,
      'scheduledCount', v_existing
    );
  end if;

  if v_version <> coalesce(p_expected_version, '0') then
    return jsonb_build_object(
      'ok', false,
      'code', 'VERSION_CONFLICT',
      'serverVersion', v_version
    );
  end if;

  if coalesce(jsonb_typeof(p_steps), '') <> 'array' or jsonb_array_length(p_steps) = 0 then
    return jsonb_build_object('ok', false, 'code', 'NO_SCHEDULED_STEPS');
  end if;

  update public.zadeve
  set opomin_nacrt = p_plan
  where id = p_zadeva_id;

  insert into public.opomin_koraki (
    zadeva_id, obrtnik_id, plan_id, step_id, step_index,
    recipient_index, prejemnik, sporocilo, status, scheduled_at,
    idempotency_key
  )
  select
    p_zadeva_id,
    v_zadeva.obrtnik_id,
    x.plan_id,
    x.step_id,
    x.step_index,
    x.recipient_index,
    x.prejemnik,
    x.sporocilo,
    'scheduled',
    x.scheduled_at,
    x.idempotency_key
  from jsonb_to_recordset(p_steps) as x(
    plan_id text,
    step_id text,
    step_index integer,
    recipient_index integer,
    prejemnik text,
    sporocilo text,
    scheduled_at timestamptz,
    idempotency_key text
  );

  get diagnostics v_existing = row_count;

  return jsonb_build_object(
    'ok', true,
    'alreadyActivated', false,
    'version', p_plan->>'version',
    'scheduledCount', v_existing
  );
end;
$$;

-- Atomsko prevzame zapadle vrstice. SKIP LOCKED omogoča več sočasnih
-- workerjev brez dvojnega prevzema.
create or replace function public.prevzemi_zapadle_opomine(p_limit integer default 50)
returns setof public.opomin_koraki
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Po zadnjem neuspešnem/izgubljenem poskusu vrstica ne sme za vedno
  -- ostati v processing.
  update public.opomin_koraki
  set status = 'failed',
      last_error = coalesce(last_error, 'Worker ni pravočasno zaključil pošiljanja.'),
      next_retry_at = null,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      posodobljeno_at = now()
  where status = 'processing'
    and claim_expires_at is not null
    and claim_expires_at <= now()
    and attempt_count >= max_attempts;

  return query
  with kandidati as (
    select k.id
    from public.opomin_koraki k
    where (
      (k.status = 'scheduled' and k.scheduled_at <= now())
      or
      (k.status = 'failed'
        and k.attempt_count < k.max_attempts
        and k.next_retry_at is not null
        and k.next_retry_at <= now())
      or
      (k.status = 'processing'
        and k.claim_expires_at is not null
        and k.claim_expires_at <= now()
        and k.attempt_count < k.max_attempts)
    )
    order by coalesce(k.next_retry_at, k.scheduled_at), k.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 50))
  )
  update public.opomin_koraki k
  set status = 'processing',
      attempt_count = k.attempt_count + 1,
      last_attempt_at = now(),
      claim_token = gen_random_uuid(),
      claimed_at = now(),
      claim_expires_at = now() + interval '5 minutes',
      posodobljeno_at = now()
  from kandidati
  where k.id = kandidati.id
  returning k.*;
end;
$$;

-- Zaključi samo vrstico, ki jo še vedno drži isti worker.
create or replace function public.zakljuci_opomin_posiljanje(
  p_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_provider_message_id text default null,
  p_error text default null,
  p_terminal boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.opomin_koraki
  set status = case when p_success then 'sent' else 'failed' end,
      attempt_count = case when not p_success and p_terminal then max_attempts else attempt_count end,
      sent_at = case when p_success then now() else null end,
      provider_message_id = case when p_success then p_provider_message_id else provider_message_id end,
      last_error = case when p_success then null else left(coalesce(p_error, 'Neznana napaka'), 1000) end,
      next_retry_at = case
        when p_success then null
        when p_terminal or attempt_count >= max_attempts then null
        when attempt_count = 1 then now() + interval '5 minutes'
        when attempt_count = 2 then now() + interval '15 minutes'
        else now() + interval '60 minutes'
      end,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      posodobljeno_at = now()
  where id = p_id
    and status = 'processing'
    and claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

-- Privilegirane funkcije niso javni API. Pokliče jih lahko samo service_role.
revoke all on function public.aktiviraj_opomin_nacrt(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.prevzemi_zapadle_opomine(integer) from public, anon, authenticated;
revoke all on function public.zakljuci_opomin_posiljanje(uuid, uuid, boolean, text, text, boolean) from public, anon, authenticated;

grant execute on function public.aktiviraj_opomin_nacrt(uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.prevzemi_zapadle_opomine(integer) to service_role;
grant execute on function public.zakljuci_opomin_posiljanje(uuid, uuid, boolean, text, text, boolean) to service_role;
