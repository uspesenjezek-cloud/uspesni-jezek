-- The legal withdrawal period starts when the contract is concluded, not when
-- the merchant later records the acceptance in the POS. New clients provide
-- that calendar date explicitly; the existing two-argument RPC stays compatible.

alter table public.pos_work_orders
  add column accepted_on date,
  add constraint pos_work_orders_accepted_on_check
    check (
      accepted_on is null
      or (accepted_at is not null and accepted_on <= (accepted_at at time zone 'Europe/Berlin')::date)
    );

alter table public.pos_work_order_acceptances
  add column accepted_on date,
  add constraint pos_work_order_acceptances_id_user_key unique (id, user_id),
  add constraint pos_work_order_acceptances_accepted_on_check
    check (accepted_on is null or accepted_on <= (recorded_at at time zone 'Europe/Berlin')::date);

alter table public.pos_work_order_early_start_evidence
  add constraint pos_work_order_early_start_acceptance_user_fk
    foreign key (acceptance_id, user_id)
    references public.pos_work_order_acceptances(id, user_id)
    on delete restrict;

create index pos_work_order_early_start_acceptance_user_idx
  on public.pos_work_order_early_start_evidence(acceptance_id, user_id);

create or replace function private._pos_accept_work_order(
  p_work_order_id uuid,
  p_evidence text,
  p_accepted_on date
)
returns public.pos_work_orders
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Berlin'
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile public.pos_business_profiles%rowtype;
  v_order public.pos_work_orders%rowtype;
  v_document public.pos_offer_documents%rowtype;
  v_number text;
  v_evidence text := trim(coalesce(p_evidence, ''));
  v_accepted_at timestamptz;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if char_length(v_evidence) not between 5 and 500 then
    raise exception 'Vpišite kratek dokaz sprejema (od 5 do 500 znakov).';
  end if;
  if p_accepted_on is null then
    raise exception 'Vpišite datum, ko je naročnik sprejel ponudbo.';
  end if;

  select * into v_order
  from public.pos_work_orders
  where id = p_work_order_id and user_id = v_user
  for update;
  if not found then raise exception 'Ponudba ne obstaja ali ni vaša.'; end if;
  if v_order.status <> 'offered' then raise exception 'Sprejeti je mogoče samo zaklenjeno ponudbo.'; end if;
  if p_accepted_on < (v_order.offered_at at time zone 'Europe/Berlin')::date then
    raise exception 'Datum sprejema ne sme biti pred zaklepom ponudbe.';
  end if;
  if p_accepted_on > current_date then
    raise exception 'Datum sprejema ne sme biti v prihodnosti.';
  end if;
  if p_accepted_on > v_order.valid_until then raise exception 'Ponudba je bila ob sprejemu že potekla.'; end if;

  select * into v_document
  from public.pos_offer_documents
  where work_order_id = v_order.id and user_id = v_user and document_kind = 'offer_pdf';
  if not found then raise exception 'Najprej ustvarite arhivirani PDF ponudbe.'; end if;

  select * into v_profile
  from public.pos_business_profiles
  where user_id = v_user
  for update;
  if not found then raise exception 'Podatki podjetja ne obstajajo.'; end if;

  v_accepted_at := now();
  v_number := 'AUF-' || extract(year from p_accepted_on)::integer || '-' || lpad(v_profile.next_order_sequence::text, 4, '0');
  update public.pos_business_profiles
  set next_order_sequence = next_order_sequence + 1
  where user_id = v_user;

  insert into public.pos_work_order_acceptances(
    user_id, work_order_id, offer_document_id, offer_sha256, evidence, accepted_at, accepted_on
  ) values (
    v_user, v_order.id, v_document.id, v_document.sha256, v_evidence, v_accepted_at, p_accepted_on
  );

  update public.pos_work_orders
  set status = 'accepted', order_number = v_number, accepted_at = v_accepted_at, accepted_on = p_accepted_on
  where id = v_order.id
  returning * into v_order;

  insert into public.pos_work_order_events(user_id, work_order_id, action, details)
  values (
    v_user,
    v_order.id,
    'accepted',
    jsonb_build_object(
      'from_status', 'offered',
      'order_number', v_number,
      'accepted_on', p_accepted_on,
      'acceptance_evidence', v_evidence,
      'offer_document_id', v_document.id,
      'offer_sha256', v_document.sha256
    )
  );
  return v_order;
end;
$$;

create or replace function public.pos_accept_work_order(
  p_work_order_id uuid,
  p_evidence text,
  p_accepted_on date
)
returns public.pos_work_orders
language sql
security definer
set search_path = ''
as $$
  select private._pos_accept_work_order(p_work_order_id, p_evidence, p_accepted_on);
$$;

-- Backward-compatible overloads prevent an older deployed client from breaking.
-- They retain the former behaviour, while the current POS uses the dated RPC.
create or replace function private._pos_accept_work_order(
  p_work_order_id uuid,
  p_evidence text
)
returns public.pos_work_orders
language sql
security definer
set search_path = ''
set timezone = 'Europe/Berlin'
as $$
  select private._pos_accept_work_order(p_work_order_id, p_evidence, current_date);
$$;

create or replace function public.pos_accept_work_order(
  p_work_order_id uuid,
  p_evidence text
)
returns public.pos_work_orders
language sql
security definer
set search_path = ''
set timezone = 'Europe/Berlin'
as $$
  select private._pos_accept_work_order(p_work_order_id, p_evidence, current_date);
$$;

revoke all on function private._pos_accept_work_order(uuid, text, date)
  from public, anon, authenticated;
grant execute on function private._pos_accept_work_order(uuid, text, date)
  to service_role;
revoke all on function public.pos_accept_work_order(uuid, text, date)
  from public, anon;
grant execute on function public.pos_accept_work_order(uuid, text, date)
  to authenticated, service_role;
revoke all on function private._pos_accept_work_order(uuid, text)
  from public, anon, authenticated;
grant execute on function private._pos_accept_work_order(uuid, text)
  to service_role;
revoke all on function public.pos_accept_work_order(uuid, text)
  from public, anon;
grant execute on function public.pos_accept_work_order(uuid, text)
  to authenticated, service_role;

create or replace function private.pos_consumer_early_start_requires_evidence(
  p_locked_payload jsonb,
  p_accepted_on date,
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
        and (p_started_at at time zone 'Europe/Berlin')::date <= p_accepted_on + 14
      )
    );
$$;

revoke all on function private.pos_consumer_early_start_requires_evidence(jsonb, date, timestamptz)
  from public, anon, authenticated;
grant execute on function private.pos_consumer_early_start_requires_evidence(jsonb, date, timestamptz)
  to service_role;

create or replace function private.pos_require_consumer_early_start_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context text := coalesce(new.locked_payload->>'consumer_contract_context', '');
  v_accepted_on date := coalesce(new.accepted_on, (old.accepted_at at time zone 'Europe/Berlin')::date);
  v_required boolean;
begin
  if old.status = 'accepted' and new.status = 'in_progress' then
    v_required := private.pos_consumer_early_start_requires_evidence(
      new.locked_payload,
      v_accepted_on,
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
  v_accepted_on date;
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
  v_accepted_on := coalesce(v_order.accepted_on, (v_order.accepted_at at time zone 'Europe/Berlin')::date);
  v_required := private.pos_consumer_early_start_requires_evidence(
    v_order.locked_payload,
    v_accepted_on,
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
      'accepted_on', v_accepted_on,
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
