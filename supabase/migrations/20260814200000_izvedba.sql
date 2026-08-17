-- ==========================================================
-- Produkcijska stran "Izvedba" - shema, RPC, varovalke.
--
-- POMEMBNO - VARNO ZAPOREDJE UVEDBE (glej HANDOFF/poročilo za podrobnosti):
-- 1. Pred zagonom te migracije: ustavi cron za /api/obdelaj-opomine
--    (ali nastavi OPOMIN_SCHEDULER_ENABLED=false), počakaj da vsi
--    trenutno tekoči workerji zaključijo, preveri da
--    `select count(*) from opomin_koraki where status='processing'`
--    vrne 0. Šele nato zaženi to migracijo.
-- 2. Ta migracija teče kot ena transakcija. Stikalo sistem_stikala
--    se ustvari z vklopljeno=false (fail-closed) - scheduler ostane
--    izklopljen, dokler ga po preverjenem deployu ročno ne vklopiš:
--    update sistem_stikala set vklopljeno=true where ime='opomin_scheduler';
-- 3. V sili (karkoli po uvedbi izgleda narobe):
--    update sistem_stikala set vklopljeno=false where ime='opomin_scheduler';
--    - to takoj ustavi vse označevanje in pošiljanje, brez novega deploya.
-- ==========================================================


-- ----------------------------------------------------------
-- 0. Preflight: obstoječi denarni podatki morajo biti veljavni,
--    sicer se cela migracija varno prekine (KROG 3-5).
-- ----------------------------------------------------------
do $$
declare v_neveljavno integer;
begin
  select count(*) into v_neveljavno from public.zadeve where znesek is null or znesek < 0;
  if v_neveljavno > 0 then
    raise exception 'Migracija prekinjena: % vrstic v zadeve ima neveljaven znesek (null ali negativen). Popravi podatke pred ponovnim zagonom migracije.', v_neveljavno;
  end if;
end $$;


-- ----------------------------------------------------------
-- 1. DB-nivo kill-stikalo za scheduler, neodvisno od env spremenljivk.
--    Privzeto IZKLOPLJENO (KROG 3-2) - uporabnik ga ročno vklopi po
--    preverjenem deployu.
-- ----------------------------------------------------------
create table public.sistem_stikala (
  ime text primary key,
  vklopljeno boolean not null default true,
  posodobljeno_at timestamptz not null default now()
);

insert into public.sistem_stikala (ime, vklopljeno) values ('opomin_scheduler', false);

alter table public.sistem_stikala enable row level security;
revoke all on public.sistem_stikala from public, anon, authenticated;
grant select, update (vklopljeno, posodobljeno_at) on public.sistem_stikala to service_role;


-- ----------------------------------------------------------
-- 2. Razširitev opomin_koraki: kanal, execution_state in nova
--    izvedbena polja.
-- ----------------------------------------------------------
alter table public.opomin_koraki
  add column kanal text not null default 'sms' check (kanal in ('sms', 'email')),
  add column execution_state text not null default 'scheduled' check (
    execution_state in (
      'scheduled', 'awaiting_confirmation', 'ready_to_send', 'processing',
      'sent', 'failed', 'paused', 'skipped', 'cancelled', 'handed_over'
    )
  ),
  add column requires_user_confirmation boolean not null default true,
  add column confirmed_by_user_at timestamptz,
  add column paused_until timestamptz,
  add column cancel_reason text,
  add column action_id uuid,
  add column execution_snapshot jsonb;

-- Fail-closed backfill (KROG 3-2): vse še neposlane obstoječe vrstice
-- (scheduled, failed, processing) morajo obvezno čakati potrditev,
-- ne glede na to, kje so bile v ciklu pošiljanja. status se ponovno
-- nastavi na 'scheduled', da jih worker pred potrditvijo ne more
-- prevzeti (claim RPC spodaj zahteva execution_state='ready_to_send').
update public.opomin_koraki
set execution_state = 'awaiting_confirmation',
    status = 'scheduled',
    claim_token = null,
    claimed_at = null,
    claim_expires_at = null,
    next_retry_at = null,
    posodobljeno_at = now()
where status in ('scheduled', 'failed', 'processing');
-- 'sent' in 'cancelled' vrstice ostanejo nedotaknjene (execution_state
-- jim je stolpčni default 'scheduled' nastavil narobe ob ADD COLUMN -
-- popravimo tudi to, da se ujema s status):
update public.opomin_koraki
set execution_state = status
where status in ('sent', 'cancelled') and execution_state <> status;

-- Kanalni unique constraint (KROG 2-2 / KROG 3-1): dinamično najdemo
-- ime obstoječega constrainta namesto trdo kodiranega naziva.
do $$
declare v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'public.opomin_koraki'::regclass
    and contype = 'u'
    and conname like '%zadeva_id_step_id_recipient_index%';
  if v_constraint_name is not null then
    execute format('alter table public.opomin_koraki drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.opomin_koraki
  add constraint opomin_koraki_zadeva_step_recipient_kanal_key
  unique (zadeva_id, step_id, recipient_index, kanal);


-- ----------------------------------------------------------
-- 3. Denarni stolpci na zadeve - en vir resnice za dolg/plačila.
-- ----------------------------------------------------------
alter table public.zadeve
  add column prvotni_znesek numeric(12, 2),
  add column placano_skupaj numeric(12, 2) not null default 0,
  add column preostali_dolg numeric(12, 2),
  add column poravnano_at timestamptz;

update public.zadeve
set prvotni_znesek = coalesce(znesek, 0),
    preostali_dolg = coalesce(znesek, 0)
where prvotni_znesek is null;

alter table public.zadeve
  alter column prvotni_znesek set not null,
  alter column preostali_dolg set not null;

alter table public.zadeve
  add constraint zadeve_prvotni_znesek_pozitiven check (prvotni_znesek > 0),
  add constraint zadeve_preostali_dolg_nenegativen check (preostali_dolg >= 0),
  add constraint zadeve_placano_nenegativno check (placano_skupaj >= 0),
  add constraint zadeve_vsota_uravnotezena check (
    round(placano_skupaj + preostali_dolg, 2) = round(prvotni_znesek, 2)
  );

-- Zaščita pred neposrednim spreminjanjem denarnih stolpcev (KROG 3-3):
-- trigger namesto stolpčnega revoke, ker obstoječi tabelni
-- `grant update on zadeve to authenticated` že dovoljuje vse stolpce.
-- Zaupanja vredna RPC funkcija (izvedi_opomin_ukrep) pred pisanjem
-- teh stolpcev eksplicitno nastavi transakcijsko-lokalno zastavico
-- app.dovoli_denarne_spremembe - to NI odvisno od current_user/lastnika
-- funkcije (kar bi bilo nezanesljivo pri security definer klicih).
create or replace function public.zadeve_zascita_denarnih_stolpcev()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.dovoli_denarne_spremembe', true), 'false') <> 'true' then
    if new.prvotni_znesek is distinct from old.prvotni_znesek
       or new.preostali_dolg is distinct from old.preostali_dolg
       or new.placano_skupaj is distinct from old.placano_skupaj
       or new.poravnano_at is distinct from old.poravnano_at then
      raise exception 'Denarnih stolpcev ni mogoče spreminjati neposredno.';
    end if;
    if old.opomin_nacrt->>'serverActivatedAt' is not null
       and new.znesek is distinct from old.znesek then
      raise exception 'Po aktivaciji načrta zneska ni mogoče spreminjati neposredno.';
    end if;
  end if;
  return new;
end;
$$;

create trigger zadeve_zascita_denarnih_stolpcev_trg
before update on public.zadeve
for each row execute function public.zadeve_zascita_denarnih_stolpcev();


-- ----------------------------------------------------------
-- 4. Audit tabela ukrepov, z idempotenčnim fingerprintom (KROG 2-3).
-- ----------------------------------------------------------
create table public.opomin_ukrepi (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null unique,
  zahteva_fingerprint text not null,
  zadeva_id uuid not null references public.zadeve(id) on delete cascade,
  obrtnik_id uuid not null references auth.users(id) on delete cascade,
  step_id text,
  step_index integer,
  action_type text not null check (
    action_type in (
      'send_reminder', 'skip_current_step', 'stop_plan', 'handoff_to_lawyer',
      'postpone_reminder', 'payment_promised', 'partial_payment', 'paid_in_full'
    )
  ),
  settings jsonb not null default '{}'::jsonb,
  previous_state jsonb,
  result_state jsonb,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index opomin_ukrepi_zadeva_idx on public.opomin_ukrepi (zadeva_id, created_at desc);

alter table public.opomin_ukrepi enable row level security;
create policy "Obrtnik vidi svoje ukrepe"
on public.opomin_ukrepi for select to authenticated
using ((select auth.uid()) = obrtnik_id);

grant select on public.opomin_ukrepi to authenticated;
grant select, insert, update on public.opomin_ukrepi to service_role;


-- ----------------------------------------------------------
-- 5. Plačila.
-- ----------------------------------------------------------
create table public.zadeva_placila (
  id uuid primary key default gen_random_uuid(),
  zadeva_id uuid not null references public.zadeve(id) on delete cascade,
  obrtnik_id uuid not null references auth.users(id) on delete cascade,
  znesek numeric(12, 2) not null check (znesek > 0),
  valuta text not null default 'EUR' check (valuta = 'EUR'),
  vrsta text not null check (vrsta in ('partial', 'full')),
  datum_placila date not null default current_date,
  action_id uuid not null unique,
  created_at timestamptz not null default now()
);

create index zadeva_placila_zadeva_idx on public.zadeva_placila (zadeva_id);

alter table public.zadeva_placila enable row level security;
create policy "Obrtnik vidi svoja plačila"
on public.zadeva_placila for select to authenticated
using ((select auth.uid()) = obrtnik_id);

grant select on public.zadeva_placila to authenticated;
grant select, insert on public.zadeva_placila to service_role;


-- ----------------------------------------------------------
-- 6. Globalna v-app obvestila (KROG 2-5) - ne OS push.
-- ----------------------------------------------------------
create table public.obrtnik_obvestila (
  id uuid primary key default gen_random_uuid(),
  obrtnik_id uuid not null references auth.users(id) on delete cascade,
  zadeva_id uuid not null references public.zadeve(id) on delete cascade,
  step_id text,
  tip text not null check (tip in ('opomin_potrditev', 'obljuba_placila_potek')),
  naslov text not null,
  prebrano_at timestamptz,
  ustvarjeno_at timestamptz not null default now()
);

create index obrtnik_obvestila_obrtnik_idx on public.obrtnik_obvestila (obrtnik_id, prebrano_at);

alter table public.obrtnik_obvestila enable row level security;
create policy "Obrtnik vidi svoja obvestila"
on public.obrtnik_obvestila for select to authenticated
using ((select auth.uid()) = obrtnik_id);

-- Authenticated dobi SAMO select - edina mutacija je spodnja RPC,
-- ki dotakne izključno prebrano_at (KROG 3, razdelek G/F).
grant select on public.obrtnik_obvestila to authenticated;
grant select, insert, update, delete on public.obrtnik_obvestila to service_role;

create or replace function public.oznaci_obvestilo_prebrano(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  update public.obrtnik_obvestila
  set prebrano_at = now()
  where id = p_id and obrtnik_id = (select auth.uid()) and prebrano_at is null;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.oznaci_obvestilo_prebrano(uuid) from public, anon;
grant execute on function public.oznaci_obvestilo_prebrano(uuid) to authenticated;


-- ----------------------------------------------------------
-- 7. Dovoljen DTO builder za opomin_koraki - brez internih polj
--    (claim_token, idempotency_key, ...) (KROG 2-4).
-- ----------------------------------------------------------
create or replace function public._izvedba_koraki_dto(p_zadeva_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', k.id,
    'stepId', k.step_id,
    'stepIndex', k.step_index,
    'recipientIndex', k.recipient_index,
    'kanal', k.kanal,
    'status', k.status,
    'executionState', k.execution_state,
    'scheduledAt', k.scheduled_at,
    'sentAt', k.sent_at,
    'sporocilo', k.sporocilo,
    'prejemnik', k.prejemnik,
    'lastError', k.last_error,
    'cancelReason', k.cancel_reason,
    'pausedUntil', k.paused_until,
    'confirmedByUserAt', k.confirmed_by_user_at
  ) order by k.step_index, k.recipient_index, k.kanal), '[]'::jsonb)
  from public.opomin_koraki k
  where k.zadeva_id = p_zadeva_id;
$$;

revoke all on function public._izvedba_koraki_dto(uuid) from public, anon, authenticated;
grant execute on function public._izvedba_koraki_dto(uuid) to service_role;


-- ----------------------------------------------------------
-- 8. Označevanje zapadlih korakov (neodvisno od SMS providerja,
--    KROG C), fail-closed prek sistem_stikala.
-- ----------------------------------------------------------
create or replace function public.oznaci_zapadle_za_potrditev(p_limit integer default 200)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oznaceno integer;
begin
  if not coalesce((select vklopljeno from public.sistem_stikala where ime = 'opomin_scheduler'), false) then
    return 0;
  end if;

  with kandidati as (
    select id
    from public.opomin_koraki
    where status = 'scheduled'
      and execution_state = 'scheduled'
      and kanal = 'sms'
      and scheduled_at <= now()
    order by scheduled_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 200), 500))
  ),
  posodobljeni as (
    update public.opomin_koraki k
    set execution_state = 'awaiting_confirmation', posodobljeno_at = now()
    from kandidati
    where k.id = kandidati.id
    returning k.zadeva_id, k.obrtnik_id, k.step_id
  )
  insert into public.obrtnik_obvestila (obrtnik_id, zadeva_id, step_id, tip, naslov)
  select obrtnik_id, zadeva_id, step_id, 'opomin_potrditev', 'Opomin čaka na vašo potrditev'
  from posodobljeni;

  get diagnostics v_oznaceno = row_count;
  return v_oznaceno;
end;
$$;

create or replace function public.preveri_potekle_obljube_placila()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oznaceno integer;
begin
  if not coalesce((select vklopljeno from public.sistem_stikala where ime = 'opomin_scheduler'), false) then
    return 0;
  end if;

  with kandidati as (
    select id
    from public.zadeve
    where opomin_nacrt->>'status' = 'waiting_for_promised_payment'
      and (opomin_nacrt->>'promisedPaymentUntil') is not null
      and (opomin_nacrt->>'promisedPaymentUntil')::timestamptz <= now()
      and opomin_nacrt->>'promisedPaymentNotifiedAt' is null
    for update skip locked
  ),
  posodobljeni as (
    update public.zadeve z
    set opomin_nacrt = jsonb_set(z.opomin_nacrt, '{promisedPaymentNotifiedAt}', to_jsonb(now()::text))
    from kandidati
    where z.id = kandidati.id
    returning z.id as zadeva_id, z.obrtnik_id
  )
  insert into public.obrtnik_obvestila (obrtnik_id, zadeva_id, tip, naslov)
  select obrtnik_id, zadeva_id, 'obljuba_placila_potek', 'Preverite, ali je dolžnik poravnal obljubljeno plačilo'
  from posodobljeni;

  get diagnostics v_oznaceno = row_count;
  return v_oznaceno;
end;
$$;


-- ----------------------------------------------------------
-- 9. Generična atomska izvedba ukrepov (KROG D, KROG 2-3, KROG 3-3).
--    Node vnaprej izračuna nov plan (p_new_plan) in seznam sprememb
--    opomin_koraki (p_koraki_updates) - RPC samo atomsko zapiše,
--    preveri idempotenco/verzijo/lastništvo in sam sestavi rezultat.
-- ----------------------------------------------------------
create or replace function public.izvedi_opomin_ukrep(
  p_zadeva_id uuid,
  p_obrtnik_id uuid,
  p_expected_version text,
  p_action_id uuid,
  p_fingerprint text,
  p_action_type text,
  p_settings jsonb,
  p_new_plan jsonb,
  p_koraki_updates jsonb,
  p_placilo_znesek numeric default null,
  p_placilo_vrsta text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ukrep_id uuid;
  v_obstojeci public.opomin_ukrepi%rowtype;
  v_zadeva public.zadeve%rowtype;
  v_verzija bigint;
  v_pricakovana_verzija bigint;
  v_nov_preostanek numeric;
  v_result jsonb;
begin
  insert into public.opomin_ukrepi (
    action_id, zahteva_fingerprint, zadeva_id, obrtnik_id, action_type, settings, status, created_at
  ) values (
    p_action_id, p_fingerprint, p_zadeva_id, p_obrtnik_id, p_action_type, coalesce(p_settings, '{}'::jsonb), 'pending', now()
  )
  on conflict (action_id) do nothing
  returning id into v_ukrep_id;

  if v_ukrep_id is null then
    select * into v_obstojeci from public.opomin_ukrepi where action_id = p_action_id for update;
    if not found then
      insert into public.opomin_ukrepi (
        action_id, zahteva_fingerprint, zadeva_id, obrtnik_id, action_type, settings, status, created_at
      ) values (
        p_action_id, p_fingerprint, p_zadeva_id, p_obrtnik_id, p_action_type, coalesce(p_settings, '{}'::jsonb), 'pending', now()
      )
      returning id into v_ukrep_id;
    elsif v_obstojeci.zahteva_fingerprint <> p_fingerprint then
      return jsonb_build_object('ok', false, 'code', 'ACTION_ID_REUSED');
    elsif v_obstojeci.status in ('completed', 'failed') then
      return v_obstojeci.result_state;
    else
      return jsonb_build_object('ok', false, 'code', 'ACTION_IN_PROGRESS');
    end if;
  end if;

  select * into v_zadeva from public.zadeve where id = p_zadeva_id for update;

  if not found then
    v_result := jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  if v_zadeva.obrtnik_id <> p_obrtnik_id then
    v_result := jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  v_verzija := coalesce((v_zadeva.opomin_nacrt->>'version')::bigint, 0);
  v_pricakovana_verzija := coalesce(nullif(p_expected_version, '')::bigint, 0);
  if v_verzija <> v_pricakovana_verzija then
    v_result := jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'serverVersion', v_verzija::text);
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  if p_action_type = 'partial_payment' then
    if p_placilo_znesek is null or p_placilo_znesek <= 0 then
      v_result := jsonb_build_object('ok', false, 'code', 'INVALID_PAYMENT_AMOUNT');
      update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
      return v_result;
    end if;

    v_nov_preostanek := v_zadeva.preostali_dolg - p_placilo_znesek;
    if v_nov_preostanek <= 0 then
      v_result := jsonb_build_object('ok', false, 'code', 'PAYMENT_EXCEEDS_DEBT');
      update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
      return v_result;
    end if;

    perform set_config('app.dovoli_denarne_spremembe', 'true', true);
    update public.zadeve
    set opomin_nacrt = p_new_plan,
        preostali_dolg = v_nov_preostanek,
        placano_skupaj = placano_skupaj + p_placilo_znesek,
        znesek = v_nov_preostanek
    where id = p_zadeva_id;

    insert into public.zadeva_placila (zadeva_id, obrtnik_id, znesek, vrsta, datum_placila, action_id)
    values (p_zadeva_id, p_obrtnik_id, p_placilo_znesek, 'partial', current_date, p_action_id);

  elsif p_action_type = 'paid_in_full' then
    perform set_config('app.dovoli_denarne_spremembe', 'true', true);
    update public.zadeve
    set opomin_nacrt = p_new_plan,
        preostali_dolg = 0,
        placano_skupaj = prvotni_znesek,
        znesek = 0,
        status = 'Rešeno',
        poravnano_at = now()
    where id = p_zadeva_id;

    insert into public.zadeva_placila (zadeva_id, obrtnik_id, znesek, vrsta, datum_placila, action_id)
    values (p_zadeva_id, p_obrtnik_id, v_zadeva.preostali_dolg, 'full', current_date, p_action_id);

  else
    update public.zadeve set opomin_nacrt = p_new_plan where id = p_zadeva_id;
  end if;

  if p_koraki_updates is not null and jsonb_typeof(p_koraki_updates) = 'array' and jsonb_array_length(p_koraki_updates) > 0 then
    update public.opomin_koraki k
    set execution_state = coalesce(x.execution_state, k.execution_state),
        status = coalesce(x.status, k.status),
        scheduled_at = coalesce(x.scheduled_at, k.scheduled_at),
        cancel_reason = coalesce(x.cancel_reason, k.cancel_reason),
        paused_until = x.paused_until,
        posodobljeno_at = now()
    from jsonb_to_recordset(p_koraki_updates) as x(
      id uuid, execution_state text, status text, scheduled_at timestamptz,
      cancel_reason text, paused_until timestamptz
    )
    where k.id = x.id and k.zadeva_id = p_zadeva_id;
  end if;

  select * into v_zadeva from public.zadeve where id = p_zadeva_id;

  v_result := jsonb_build_object(
    'ok', true,
    'actionId', p_action_id,
    'version', (p_new_plan->>'version'),
    'zadeva', jsonb_build_object(
      'id', v_zadeva.id,
      'status', v_zadeva.status,
      'prvotniZnesek', v_zadeva.prvotni_znesek,
      'preostaliDolg', v_zadeva.preostali_dolg,
      'placanoSkupaj', v_zadeva.placano_skupaj,
      'znesek', v_zadeva.znesek,
      'poravnanoAt', v_zadeva.poravnano_at
    ),
    'plan', p_new_plan,
    'steps', public._izvedba_koraki_dto(p_zadeva_id)
  );

  update public.opomin_ukrepi
  set status = 'completed', result_state = v_result, completed_at = now()
  where id = v_ukrep_id;

  return v_result;
end;
$$;

revoke all on function public.izvedi_opomin_ukrep(uuid, uuid, text, uuid, text, text, jsonb, jsonb, jsonb, numeric, text) from public, anon, authenticated;
grant execute on function public.izvedi_opomin_ukrep(uuid, uuid, text, uuid, text, text, jsonb, jsonb, jsonb, numeric, text) to service_role;


-- ----------------------------------------------------------
-- 10. "Pošlji opomin zdaj": RPC sam sestavi execution_snapshot iz
--     zaklenjenih podatkov (KROG E), zahteva VSE čakajoče SMS
--     vrstice koraka (KROG 3-4).
-- ----------------------------------------------------------
create or replace function public.poslji_opomin_zdaj(
  p_zadeva_id uuid,
  p_obrtnik_id uuid,
  p_expected_version text,
  p_action_id uuid,
  p_fingerprint text,
  p_step_id text,
  p_sporocila jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ukrep_id uuid;
  v_obstojeci public.opomin_ukrepi%rowtype;
  v_zadeva public.zadeve%rowtype;
  v_verzija bigint;
  v_pricakovana_verzija bigint;
  v_pricakovani uuid[];
  v_prejeti uuid[];
  v_stevilo_prejetih integer;
  v_stevilo_razlicnih integer;
  v_posodobljenih integer;
  v_nova_verzija bigint;
  v_result jsonb;
begin
  insert into public.opomin_ukrepi (
    action_id, zahteva_fingerprint, zadeva_id, obrtnik_id, step_id, action_type, settings, status, created_at
  ) values (
    p_action_id, p_fingerprint, p_zadeva_id, p_obrtnik_id, p_step_id, 'send_reminder', jsonb_build_object('stepId', p_step_id), 'pending', now()
  )
  on conflict (action_id) do nothing
  returning id into v_ukrep_id;

  if v_ukrep_id is null then
    select * into v_obstojeci from public.opomin_ukrepi where action_id = p_action_id for update;
    if not found then
      insert into public.opomin_ukrepi (
        action_id, zahteva_fingerprint, zadeva_id, obrtnik_id, step_id, action_type, settings, status, created_at
      ) values (
        p_action_id, p_fingerprint, p_zadeva_id, p_obrtnik_id, p_step_id, 'send_reminder', jsonb_build_object('stepId', p_step_id), 'pending', now()
      )
      returning id into v_ukrep_id;
    elsif v_obstojeci.zahteva_fingerprint <> p_fingerprint then
      return jsonb_build_object('ok', false, 'code', 'ACTION_ID_REUSED');
    elsif v_obstojeci.status in ('completed', 'failed') then
      return v_obstojeci.result_state;
    else
      return jsonb_build_object('ok', false, 'code', 'ACTION_IN_PROGRESS');
    end if;
  end if;

  select * into v_zadeva from public.zadeve where id = p_zadeva_id for update;
  if not found then
    v_result := jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  if v_zadeva.obrtnik_id <> p_obrtnik_id then
    v_result := jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  v_verzija := coalesce((v_zadeva.opomin_nacrt->>'version')::bigint, 0);
  v_pricakovana_verzija := coalesce(nullif(p_expected_version, '')::bigint, 0);
  if v_verzija <> v_pricakovana_verzija then
    v_result := jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'serverVersion', v_verzija::text);
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  select count(*), count(distinct opomin_korak_id)
  into v_stevilo_prejetih, v_stevilo_razlicnih
  from jsonb_to_recordset(p_sporocila) as x(opomin_korak_id uuid, koncno_besedilo text);

  if coalesce(v_stevilo_prejetih, 0) = 0 or v_stevilo_prejetih <> v_stevilo_razlicnih then
    v_result := jsonb_build_object('ok', false, 'code', 'INVALID_SPOROCILA');
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  select array_agg(id order by id) into v_pricakovani
  from public.opomin_koraki
  where zadeva_id = p_zadeva_id and step_id = p_step_id and kanal = 'sms' and execution_state = 'awaiting_confirmation';

  select array_agg(x.opomin_korak_id order by x.opomin_korak_id) into v_prejeti
  from jsonb_to_recordset(p_sporocila) as x(opomin_korak_id uuid, koncno_besedilo text);

  if v_pricakovani is null or v_pricakovani is distinct from v_prejeti then
    v_result := jsonb_build_object('ok', false, 'code', 'INCOMPLETE_RECIPIENTS');
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  update public.opomin_koraki k
  set sporocilo = x.koncno_besedilo,
      execution_snapshot = jsonb_build_object(
        'sporocilo', x.koncno_besedilo,
        'prejemnik', k.prejemnik,
        'kanal', k.kanal,
        'dolznik', v_zadeva.ime_dolznika,
        'dolg', v_zadeva.preostali_dolg,
        'racun', v_zadeva.opis_dolga,
        'snapshotAt', now()
      ),
      execution_state = 'ready_to_send',
      confirmed_by_user_at = now(),
      action_id = p_action_id,
      last_error = null,
      posodobljeno_at = now()
  from jsonb_to_recordset(p_sporocila) as x(opomin_korak_id uuid, koncno_besedilo text)
  where k.id = x.opomin_korak_id
    and k.zadeva_id = p_zadeva_id
    and k.step_id = p_step_id
    and k.execution_state = 'awaiting_confirmation';

  get diagnostics v_posodobljenih = row_count;
  if v_posodobljenih <> coalesce(array_length(v_pricakovani, 1), 0) then
    raise exception 'poslji_opomin_zdaj: nepričakovano število posodobljenih vrstic (% od %)', v_posodobljenih, array_length(v_pricakovani, 1);
  end if;

  v_nova_verzija := v_verzija + 1;
  update public.zadeve
  set opomin_nacrt = jsonb_set(opomin_nacrt, '{version}', to_jsonb(v_nova_verzija::text))
  where id = p_zadeva_id;

  v_result := jsonb_build_object(
    'ok', true,
    'actionId', p_action_id,
    'version', v_nova_verzija::text,
    'stepId', p_step_id,
    'steps', public._izvedba_koraki_dto(p_zadeva_id)
  );

  update public.opomin_ukrepi
  set status = 'completed', result_state = v_result, completed_at = now()
  where id = v_ukrep_id;

  return v_result;
end;
$$;

revoke all on function public.poslji_opomin_zdaj(uuid, uuid, text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.poslji_opomin_zdaj(uuid, uuid, text, uuid, text, text, jsonb) to service_role;


-- ----------------------------------------------------------
-- 11. Spremenjeni scheduler RPC-ji: samo kanal='sms', samo
--     execution_state='ready_to_send' (+ ustrezne retry veje),
--     fail-closed prek sistem_stikala, sinhronizacija execution_state.
-- ----------------------------------------------------------
create or replace function public.prevzemi_zapadle_opomine(p_limit integer default 50)
returns setof public.opomin_koraki
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select vklopljeno from public.sistem_stikala where ime = 'opomin_scheduler'), false) then
    return;
  end if;

  update public.opomin_koraki
  set status = 'failed',
      execution_state = 'failed',
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
    where k.kanal = 'sms'
      and (
        (k.status = 'scheduled' and k.execution_state = 'ready_to_send' and k.scheduled_at <= now())
        or
        (k.status = 'failed' and k.execution_state = 'failed'
          and k.attempt_count < k.max_attempts
          and k.next_retry_at is not null
          and k.next_retry_at <= now())
        or
        (k.status = 'processing' and k.execution_state = 'processing'
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
      execution_state = 'processing',
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
      execution_state = case when p_success then 'sent' else 'failed' end,
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

revoke all on function public.prevzemi_zapadle_opomine(integer) from public, anon, authenticated;
revoke all on function public.zakljuci_opomin_posiljanje(uuid, uuid, boolean, text, text, boolean) from public, anon, authenticated;
revoke all on function public.oznaci_zapadle_za_potrditev(integer) from public, anon, authenticated;
revoke all on function public.preveri_potekle_obljube_placila() from public, anon, authenticated;

grant execute on function public.prevzemi_zapadle_opomine(integer) to service_role;
grant execute on function public.zakljuci_opomin_posiljanje(uuid, uuid, boolean, text, text, boolean) to service_role;
grant execute on function public.oznaci_zapadle_za_potrditev(integer) to service_role;
grant execute on function public.preveri_potekle_obljube_placila() to service_role;


-- ----------------------------------------------------------
-- 12. Realtime publikacija - idempotentno (KROG 2-8).
-- ----------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'opomin_koraki'
  ) then
    alter publication supabase_realtime add table public.opomin_koraki;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'opomin_ukrepi'
  ) then
    alter publication supabase_realtime add table public.opomin_ukrepi;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'obrtnik_obvestila'
  ) then
    alter publication supabase_realtime add table public.obrtnik_obvestila;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'zadeve'
  ) then
    alter publication supabase_realtime add table public.zadeve;
  end if;
end $$;
