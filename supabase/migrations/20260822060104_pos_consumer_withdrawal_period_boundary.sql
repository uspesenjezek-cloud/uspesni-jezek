-- A 14-day withdrawal period ends at the end of its final German calendar
-- day (§§ 187, 188 BGB), not exactly 336 hours after acceptance. Centralize
-- that rule so both the transition trigger and the public start RPC agree,
-- including across daylight-saving changes.

create or replace function private.pos_consumer_early_start_requires_evidence(
  p_locked_payload jsonb,
  p_accepted_at timestamptz,
  p_started_at timestamptz
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(p_locked_payload->>'customer_type', '') = 'private'
    and (
      coalesce(p_locked_payload->>'consumer_contract_context', '') = 'urgent_repair'
      or (
        coalesce(p_locked_payload->>'consumer_contract_context', '') in ('distance', 'off_premises')
        and (p_started_at at time zone 'Europe/Berlin')::date
          <= (p_accepted_at at time zone 'Europe/Berlin')::date + 14
      )
    );
$$;

revoke all on function private.pos_consumer_early_start_requires_evidence(jsonb, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function private.pos_consumer_early_start_requires_evidence(jsonb, timestamptz, timestamptz)
  to service_role;

create or replace function private.pos_require_consumer_early_start_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context text := coalesce(new.locked_payload->>'consumer_contract_context', '');
  v_required boolean;
begin
  if old.status = 'accepted' and new.status = 'in_progress' then
    v_required := private.pos_consumer_early_start_requires_evidence(
      new.locked_payload,
      old.accepted_at,
      new.started_at
    );
    if v_required and not exists (
      select 1
      from public.pos_work_order_early_start_evidence as evidence
      where evidence.work_order_id = new.id
        and evidence.user_id = new.user_id
        and evidence.contract_context = v_context
        and evidence.started_at = new.started_at
    ) then
      raise exception 'Predčasni začetek zahteva dokaz izrecne zahteve potrošnika, vezan na sprejeto ponudbo.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.pos_require_consumer_early_start_evidence()
  from public, anon, authenticated;
grant execute on function private.pos_require_consumer_early_start_evidence()
  to service_role;

create or replace function private._pos_start_work_order(
  p_work_order_id uuid,
  p_evidence text
)
returns public.pos_work_orders
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Berlin'
as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.pos_work_orders%rowtype;
  v_acceptance public.pos_work_order_acceptances%rowtype;
  v_document public.pos_offer_documents%rowtype;
  v_context text;
  v_evidence text := trim(coalesce(p_evidence, ''));
  v_started_at timestamptz := now();
  v_required boolean;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;

  select * into v_order
  from public.pos_work_orders
  where id = p_work_order_id and user_id = v_user
  for update;
  if not found then raise exception 'Naročilo ne obstaja ali ni vaše.'; end if;
  if v_order.status <> 'accepted' then raise exception 'Začetek je dovoljen samo pri sprejetem naročilu.'; end if;

  v_context := coalesce(v_order.locked_payload->>'consumer_contract_context', '');
  v_required := private.pos_consumer_early_start_requires_evidence(
    v_order.locked_payload,
    v_order.accepted_at,
    v_started_at
  );

  if v_required then
    if char_length(v_evidence) not between 5 and 500 then
      raise exception 'Vpišite dokaz izrecne zahteve potrošnika za predčasni začetek (od 5 do 500 znakov).';
    end if;
    select * into v_acceptance
    from public.pos_work_order_acceptances
    where work_order_id = v_order.id and user_id = v_user;
    if not found then raise exception 'Manjka nespremenljiv dokaz sprejema ponudbe.'; end if;
    select * into v_document
    from public.pos_offer_documents
    where id = v_acceptance.offer_document_id and user_id = v_user and work_order_id = v_order.id;
    if not found or v_document.sha256 <> v_acceptance.offer_sha256 then
      raise exception 'Arhivirani PDF ponudbe se ne ujema z dokazom sprejema.';
    end if;

    insert into public.pos_work_order_early_start_evidence(
      user_id, work_order_id, acceptance_id, offer_document_id, offer_sha256,
      contract_context, evidence, started_at
    ) values (
      v_user, v_order.id, v_acceptance.id, v_document.id, v_document.sha256,
      v_context, v_evidence, v_started_at
    );
  end if;

  update public.pos_work_orders
  set status = 'in_progress', started_at = v_started_at
  where id = v_order.id
  returning * into v_order;

  insert into public.pos_work_order_events(user_id, work_order_id, action, details)
  values (
    v_user,
    v_order.id,
    'started',
    jsonb_strip_nulls(jsonb_build_object(
      'from_status', 'accepted',
      'consumer_contract_context', nullif(v_context, ''),
      'early_start_evidence', case when v_required then v_evidence else null end,
      'offer_document_id', case when v_required then v_document.id else null end,
      'offer_sha256', case when v_required then v_document.sha256 else null end
    ))
  );
  return v_order;
end;
$$;

revoke all on function private._pos_start_work_order(uuid, text)
  from public, anon, authenticated;
grant execute on function private._pos_start_work_order(uuid, text)
  to service_role;

notify pgrst, 'reload schema';

;
