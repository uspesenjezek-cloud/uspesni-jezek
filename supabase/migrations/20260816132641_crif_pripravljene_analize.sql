-- Pripravljene CRIF analize. Dejanska poizvedba ostane zaklenjena do posebne
-- platformske pogodbe, produkcijskih dovoljenj in potrditve pravnega besedila.
create table if not exists public.boniteta_crif_zahteve (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_type text not null check (subject_type in ('company','sole_trader','private_person')),
  status text not null default 'contract_pending' check (status in ('prepared','contract_pending','ready_for_provider','processing','in_review','completed','insufficient','failed','disputed','canceled')),
  provider text not null default 'crif',
  provider_product text not null,
  provider_mode text not null default 'disabled' check (provider_mode in ('disabled','uat','production')),
  project_reference text,
  project_value_cents bigint not null check (project_value_cents > 0),
  open_exposure_cents bigint not null check (open_exposure_cents >= 0 and open_exposure_cents <= project_value_cents),
  currency text not null default 'EUR' check (currency = 'EUR'),
  payment_timing text not null check (payment_timing in ('prepayment','milestone','after_completion','invoice','installments','other')),
  project_start_date date not null,
  project_end_date date not null check (project_end_date >= project_start_date),
  legitimate_interest text,
  legal_basis text not null default 'art_6_1_f' check (legal_basis = 'art_6_1_f'),
  financial_risk_confirmed boolean not null default false,
  business_purpose_confirmed boolean not null default false,
  subject_payload jsonb not null default '{}'::jsonb,
  notice_required boolean not null default false,
  notice_version text,
  notice_method text check (notice_method is null or notice_method in ('email','pdf','in_person','portal')),
  notice_delivered_at timestamptz,
  monitoring_requested boolean not null default false,
  monitoring_end_date date,
  monitoring_reason text,
  human_decision_required boolean not null default true check (human_decision_required = true),
  human_decision text check (human_decision is null or human_decision in ('approve','review','decline')),
  human_decision_reason text,
  human_decision_at timestamptz,
  dispute_status text not null default 'none' check (dispute_status in ('none','requested','in_review','resolved')),
  dispute_reason text,
  dispute_requested_at timestamptz,
  provider_request_id text,
  provider_result jsonb not null default '{}'::jsonb,
  result_received_at timestamptz,
  contract_gate text not null default 'platform_agreement_required',
  readiness jsonb not null default '{}'::jsonb,
  evidence_retain_until date not null,
  personal_data_delete_after date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not notice_required or (notice_version is not null and notice_method is not null and notice_delivered_at is not null)),
  check (not monitoring_requested or (monitoring_end_date is not null and monitoring_end_date <= project_end_date)),
  check (evidence_retain_until >= project_end_date and personal_data_delete_after >= project_end_date),
  check (octet_length(subject_payload::text) <= 16000)
);

create index if not exists boniteta_crif_zahteve_user_created_idx on public.boniteta_crif_zahteve(user_id, created_at desc);
alter table public.boniteta_crif_zahteve enable row level security;
revoke all on table public.boniteta_crif_zahteve from public, anon, authenticated;
grant select on table public.boniteta_crif_zahteve to authenticated;
grant all on table public.boniteta_crif_zahteve to service_role;

create policy "crif_select_own" on public.boniteta_crif_zahteve for select to authenticated using (auth.uid() = user_id);

create or replace function public.ustvari_crif_pripravo(p_request jsonb)
returns public.boniteta_crif_zahteve
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row public.boniteta_crif_zahteve;
  v_subject_type text := p_request->>'subject_type';
  v_notice_required boolean := coalesce((p_request->>'notice_required')::boolean, false);
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if v_subject_type not in ('company','sole_trader','private_person') then raise exception 'Neveljavna vrsta stranke.'; end if;
  if p_request->>'provider_product' not in ('FinanzCheck','BoniCheck Kompakt','Kreditauskunft','Vollauskunft','CreditCheck ONE') then raise exception 'Neveljavna vrsta analize.'; end if;
  if coalesce(length(trim(p_request->>'legitimate_interest')),0) < 10 then raise exception 'Manjka opis finančnega rizika.'; end if;
  if not coalesce((p_request->>'financial_risk_confirmed')::boolean,false) or not coalesce((p_request->>'business_purpose_confirmed')::boolean,false) then raise exception 'Manjka poslovna pravna podlaga.'; end if;
  if v_notice_required and (nullif(p_request->>'notice_version','') is null or nullif(p_request->>'notice_method','') is null or nullif(p_request->>'notice_delivered_at','') is null) then raise exception 'Manjka dokaz o obvestilu osebi.'; end if;
  if v_notice_required and (p_request->>'notice_delivered_at')::timestamptz > now() + interval '5 minutes' then raise exception 'Čas obvestila ne sme biti v prihodnosti.'; end if;
  if (p_request->>'project_end_date')::date < current_date then raise exception 'Poslovno razmerje je že zaključeno.'; end if;
  if coalesce((p_request->>'monitoring_requested')::boolean,false) and coalesce(length(trim(p_request->>'monitoring_reason')),0) < 10 then raise exception 'Manjka razlog spremljanja.'; end if;

  insert into public.boniteta_crif_zahteve (
    user_id,subject_type,status,provider,provider_product,provider_mode,project_reference,
    project_value_cents,open_exposure_cents,currency,payment_timing,project_start_date,project_end_date,
    legitimate_interest,legal_basis,financial_risk_confirmed,business_purpose_confirmed,subject_payload,
    notice_required,notice_version,notice_method,notice_delivered_at,monitoring_requested,monitoring_end_date,
    monitoring_reason,human_decision_required,provider_result,contract_gate,readiness,evidence_retain_until,personal_data_delete_after
  ) values (
    v_user,v_subject_type,'contract_pending','crif',p_request->>'provider_product','disabled',nullif(p_request->>'project_reference',''),
    (p_request->>'project_value_cents')::bigint,(p_request->>'open_exposure_cents')::bigint,'EUR',p_request->>'payment_timing',
    (p_request->>'project_start_date')::date,(p_request->>'project_end_date')::date,p_request->>'legitimate_interest','art_6_1_f',true,true,
    jsonb_build_object(
      'legalName',left(coalesce(p_request->'subject_payload'->>'legalName',''),240),
      'firstName',left(coalesce(p_request->'subject_payload'->>'firstName',''),120),
      'lastName',left(coalesce(p_request->'subject_payload'->>'lastName',''),120),
      'dateOfBirth',left(coalesce(p_request->'subject_payload'->>'dateOfBirth',''),10),
      'registerNumber',left(coalesce(p_request->'subject_payload'->>'registerNumber',''),120),
      'street',left(coalesce(p_request->'subject_payload'->>'street',''),160),
      'postalCode',left(coalesce(p_request->'subject_payload'->>'postalCode',''),10),
      'city',left(coalesce(p_request->'subject_payload'->>'city',''),100),
      'country','DE'
    ),v_notice_required,nullif(p_request->>'notice_version',''),nullif(p_request->>'notice_method',''),
    nullif(p_request->>'notice_delivered_at','')::timestamptz,coalesce((p_request->>'monitoring_requested')::boolean,false),
    nullif(p_request->>'monitoring_end_date','')::date,nullif(p_request->>'monitoring_reason',''),true,'{}'::jsonb,
    'platform_agreement_required',jsonb_build_object('recommendation',jsonb_build_object('product',p_request->>'provider_product'),'missing',jsonb_build_array('platform_agreement','api_credentials')),
    ((p_request->>'project_end_date')::date + interval '12 months')::date,
    ((p_request->>'project_end_date')::date + interval '12 months')::date
  ) returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.ustvari_crif_pripravo(jsonb) from public, anon;
grant execute on function public.ustvari_crif_pripravo(jsonb) to authenticated;
grant execute on function public.ustvari_crif_pripravo(jsonb) to service_role;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private._shrani_crif_odlocitev(p_request_id uuid, p_decision text, p_reason text)
returns public.boniteta_crif_zahteve
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.boniteta_crif_zahteve;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_decision not in ('approve','review','decline') or coalesce(length(trim(p_reason)),0) < 10 then raise exception 'Odločitev in razlog nista veljavna.'; end if;
  update public.boniteta_crif_zahteve set human_decision=p_decision,human_decision_reason=left(trim(p_reason),1200),human_decision_at=now(),updated_at=now()
  where id=p_request_id and user_id=v_user and status in ('completed','insufficient','disputed')
  returning * into v_row;
  if v_row.id is null then raise exception 'Rezultat še ni pripravljen ali analiza ni dostopna.'; end if;
  return v_row;
end;
$$;

create or replace function public.shrani_crif_odlocitev(p_request_id uuid, p_decision text, p_reason text)
returns public.boniteta_crif_zahteve
language sql
security invoker
set search_path = ''
as $$ select private._shrani_crif_odlocitev(p_request_id,p_decision,p_reason); $$;

create or replace function private._odpri_crif_ugovor(p_request_id uuid, p_reason text)
returns public.boniteta_crif_zahteve
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.boniteta_crif_zahteve;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if coalesce(length(trim(p_reason)),0) < 20 then raise exception 'Opišite razlog za ugovor ali popravek.'; end if;
  update public.boniteta_crif_zahteve set status='disputed',dispute_status='requested',dispute_reason=left(trim(p_reason),1600),dispute_requested_at=now(),updated_at=now()
  where id=p_request_id and user_id=v_user and status in ('completed','insufficient')
  returning * into v_row;
  if v_row.id is null then raise exception 'Ugovora za to analizo ni mogoče odpreti.'; end if;
  return v_row;
end;
$$;

create or replace function public.odpri_crif_ugovor(p_request_id uuid, p_reason text)
returns public.boniteta_crif_zahteve
language sql
security invoker
set search_path = ''
as $$ select private._odpri_crif_ugovor(p_request_id,p_reason); $$;

revoke all on function private._shrani_crif_odlocitev(uuid,text,text) from public, anon;
revoke all on function private._odpri_crif_ugovor(uuid,text) from public, anon;
grant execute on function private._shrani_crif_odlocitev(uuid,text,text) to authenticated, service_role;
grant execute on function private._odpri_crif_ugovor(uuid,text) to authenticated, service_role;
revoke all on function public.shrani_crif_odlocitev(uuid,text,text) from public, anon;
revoke all on function public.odpri_crif_ugovor(uuid,text) from public, anon;
grant execute on function public.shrani_crif_odlocitev(uuid,text,text) to authenticated;
grant execute on function public.odpri_crif_ugovor(uuid,text) to authenticated;
