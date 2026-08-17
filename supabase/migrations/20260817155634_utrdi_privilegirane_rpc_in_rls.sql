-- Privilegirana implementacija ostane zunaj izpostavljene sheme public.
-- Public RPC funkcije so SECURITY INVOKER ovojnice; zasebne funkcije vedno
-- preverijo auth.uid() in omejijo zapis na trenutno prijavljenega uporabnika.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

drop policy if exists "crif_select_own" on public.boniteta_crif_zahteve;
create policy "crif_select_own" on public.boniteta_crif_zahteve
for select to authenticated using ((select auth.uid()) = user_id);

create or replace function private._oznaci_obvestilo_prebrano(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_updated integer;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  update public.obrtnik_obvestila set prebrano_at = now()
  where id = p_id and obrtnik_id = v_user and prebrano_at is null;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.oznaci_obvestilo_prebrano(p_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select private._oznaci_obvestilo_prebrano(p_id);
$$;

revoke all on function private._oznaci_obvestilo_prebrano(uuid) from public, anon;
revoke all on function public.oznaci_obvestilo_prebrano(uuid) from public, anon;
grant execute on function private._oznaci_obvestilo_prebrano(uuid) to authenticated, service_role;
grant execute on function public.oznaci_obvestilo_prebrano(uuid) to authenticated, service_role;

create or replace function private._ustvari_crif_pripravo(p_request jsonb)
returns public.boniteta_crif_zahteve
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
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

create or replace function public.ustvari_crif_pripravo(p_request jsonb)
returns public.boniteta_crif_zahteve language sql security invoker set search_path = '' as $$
  select private._ustvari_crif_pripravo(p_request);
$$;

revoke all on function private._ustvari_crif_pripravo(jsonb) from public, anon;
revoke all on function public.ustvari_crif_pripravo(jsonb) from public, anon;
grant execute on function private._ustvari_crif_pripravo(jsonb) to authenticated, service_role;
grant execute on function public.ustvari_crif_pripravo(jsonb) to authenticated, service_role;
