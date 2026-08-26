-- A service consumer's withdrawal right expires on full performance only when
-- the consumer expressly requested early performance and acknowledged both
-- value compensation and the loss of the right (§ 356(5), § 357a(2) BGB).
-- Preserve those facts separately and keep withdrawal possible after technical
-- completion when the statutory expiry conditions were not proven.

alter table public.pos_work_order_early_start_evidence
  add column value_compensation_informed boolean not null default false,
  add column right_expiry_acknowledged boolean not null default false,
  add column request_on_durable_medium boolean not null default false,
  add constraint pos_early_start_consumer_acknowledgements_check
    check (
      contract_context not in ('distance', 'off_premises')
      or (
        value_compensation_informed
        and right_expiry_acknowledged
        and (contract_context <> 'off_premises' or request_on_durable_medium)
      )
    ) not valid;

create or replace function private._pos_start_work_order(
  p_work_order_id uuid,
  p_evidence text,
  p_value_compensation_informed boolean,
  p_right_expiry_acknowledged boolean,
  p_request_on_durable_medium boolean
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
    if v_context in ('distance', 'off_premises') and (
      not coalesce(p_value_compensation_informed, false)
      or not coalesce(p_right_expiry_acknowledged, false)
    ) then
      raise exception 'Dokaz mora potrjevati obvestilo o Wertersatz in seznanjenost z izgubo pravice po popolni izvedbi.';
    end if;
    if v_context = 'off_premises' and not coalesce(p_request_on_durable_medium, false) then
      raise exception 'Zahteva za predčasni začetek zunaj poslovnih prostorov mora biti na trajnem nosilcu.';
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
      contract_context, evidence, started_at, value_compensation_informed,
      right_expiry_acknowledged, request_on_durable_medium
    ) values (
      v_user, v_order.id, v_acceptance.id, v_document.id, v_document.sha256,
      v_context, v_evidence, v_started_at,
      case when v_context in ('distance', 'off_premises') then p_value_compensation_informed else false end,
      case when v_context in ('distance', 'off_premises') then p_right_expiry_acknowledged else false end,
      case when v_context = 'off_premises' then p_request_on_durable_medium else false end
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
      'value_compensation_informed', case when v_required and v_context in ('distance', 'off_premises') then p_value_compensation_informed else null end,
      'right_expiry_acknowledged', case when v_required and v_context in ('distance', 'off_premises') then p_right_expiry_acknowledged else null end,
      'request_on_durable_medium', case when v_required and v_context = 'off_premises' then p_request_on_durable_medium else null end,
      'offer_document_id', case when v_required then v_document.id else null end,
      'offer_sha256', case when v_required then v_document.sha256 else null end
    ))
  );
  return v_order;
end;
$$;

create or replace function public.pos_start_work_order(
  p_work_order_id uuid,
  p_evidence text,
  p_value_compensation_informed boolean,
  p_right_expiry_acknowledged boolean,
  p_request_on_durable_medium boolean
)
returns public.pos_work_orders
language sql
security definer
set search_path = ''
as $$
  select private._pos_start_work_order(
    p_work_order_id,
    p_evidence,
    p_value_compensation_informed,
    p_right_expiry_acknowledged,
    p_request_on_durable_medium
  );
$$;

-- Keep the old signature for a cached client, but never let it silently claim
-- consumer acknowledgements that it did not collect.
create or replace function private._pos_start_work_order(
  p_work_order_id uuid,
  p_evidence text
)
returns public.pos_work_orders
language sql
security definer
set search_path = ''
as $$
  select private._pos_start_work_order(p_work_order_id, p_evidence, false, false, false);
$$;

create or replace function public.pos_start_work_order(
  p_work_order_id uuid,
  p_evidence text
)
returns public.pos_work_orders
language sql
security definer
set search_path = ''
as $$
  select private._pos_start_work_order(p_work_order_id, p_evidence, false, false, false);
$$;

revoke all on function private._pos_start_work_order(uuid,text,boolean,boolean,boolean)
  from public, anon, authenticated;
grant execute on function private._pos_start_work_order(uuid,text,boolean,boolean,boolean)
  to service_role;
revoke all on function public.pos_start_work_order(uuid,text,boolean,boolean,boolean)
  from public, anon;
grant execute on function public.pos_start_work_order(uuid,text,boolean,boolean,boolean)
  to authenticated, service_role;
revoke all on function private._pos_start_work_order(uuid,text)
  from public, anon, authenticated;
grant execute on function private._pos_start_work_order(uuid,text)
  to service_role;
revoke all on function public.pos_start_work_order(uuid,text)
  from public, anon;
grant execute on function public.pos_start_work_order(uuid,text)
  to authenticated, service_role;

create or replace function private.pos_consumer_service_right_expired(
  p_work_order_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pos_work_orders as work_order
    join public.pos_work_order_early_start_evidence as evidence
      on evidence.work_order_id = work_order.id
     and evidence.user_id = work_order.user_id
    where work_order.id = p_work_order_id
      and work_order.user_id = p_user_id
      and work_order.completed_at is not null
      and work_order.locked_payload->>'customer_type' = 'private'
      and work_order.locked_payload->>'consumer_contract_context' in ('distance', 'off_premises')
      and evidence.value_compensation_informed
      and evidence.right_expiry_acknowledged
      and (
        evidence.contract_context <> 'off_premises'
        or evidence.request_on_durable_medium
      )
  );
$$;

revoke all on function private.pos_consumer_service_right_expired(uuid,uuid)
  from public, anon, authenticated;
grant execute on function private.pos_consumer_service_right_expired(uuid,uuid)
  to service_role;

alter table public.pos_work_order_withdrawals
  drop constraint pos_work_order_withdrawals_status_before_check,
  add constraint pos_work_order_withdrawals_status_before_check
    check (status_before in ('accepted', 'in_progress', 'completed', 'invoiced'));

alter table public.pos_work_orders
  drop constraint pos_work_orders_lifecycle_check;

alter table public.pos_work_orders
  add constraint pos_work_orders_lifecycle_check
  check (
    updated_at >= created_at
    and (locked_payload is null or locked_payload = payload)
    and ((locked_payload is null) = (offered_at is null))
    and ((order_number is null) = (accepted_at is null))
    and (accepted_at is null or offered_at is not null)
    and (started_at is null or accepted_at is not null)
    and (completed_at is null or started_at is not null)
    and (offered_at is null or offered_at >= created_at)
    and (accepted_at is null or accepted_at >= offered_at)
    and (started_at is null or started_at >= accepted_at)
    and (completed_at is null or completed_at >= started_at)
    and (
      cancelled_at is null
      or cancelled_at >= greatest(created_at,coalesce(offered_at,created_at),coalesce(accepted_at,created_at),coalesce(started_at,created_at),coalesce(completed_at,created_at))
    )
    and (
      withdrawn_at is null
      or withdrawn_at >= greatest(created_at,coalesce(offered_at,created_at),coalesce(accepted_at,created_at),coalesce(started_at,created_at),coalesce(completed_at,created_at))
    )
    and case status
      when 'draft' then offered_at is null and accepted_at is null and started_at is null and completed_at is null and cancelled_at is null and withdrawn_at is null
      when 'offered' then offered_at is not null and accepted_at is null and started_at is null and completed_at is null and cancelled_at is null and withdrawn_at is null
      when 'accepted' then accepted_at is not null and started_at is null and completed_at is null and cancelled_at is null and withdrawn_at is null
      when 'in_progress' then started_at is not null and completed_at is null and cancelled_at is null and withdrawn_at is null
      when 'completed' then completed_at is not null and cancelled_at is null and withdrawn_at is null
      when 'invoiced' then completed_at is not null and cancelled_at is null and withdrawn_at is null
      when 'cancelled' then cancelled_at is not null and withdrawn_at is null
      when 'withdrawn' then accepted_at is not null and cancelled_at is null and withdrawn_at is not null
      else false
    end
  );

create or replace function private._pos_record_consumer_withdrawal(
  p_work_order_id uuid,
  p_declared_on date,
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
  v_accepted_on date;
  v_deadline date;
  v_received_at timestamptz := now();
  v_review_required boolean;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_declared_on is null then raise exception 'Vpišite datum potrošnikove izjave o odstopu.'; end if;
  if char_length(v_evidence) not between 5 and 500 then
    raise exception 'Vpišite dokaz prejete izjave o odstopu (od 5 do 500 znakov).';
  end if;

  select * into v_order
  from public.pos_work_orders
  where id = p_work_order_id and user_id = v_user
  for update;
  if not found then raise exception 'Naročilo ne obstaja ali ni vaše.'; end if;
  if v_order.status not in ('accepted', 'in_progress', 'completed', 'invoiced') then
    raise exception 'Odstopa ni mogoče zabeležiti v trenutnem stanju naročila.';
  end if;
  if coalesce(v_order.locked_payload->>'customer_type', '') <> 'private' then
    raise exception 'Ta postopek je namenjen samo potrošniškim pogodbam.';
  end if;
  v_context := coalesce(v_order.locked_payload->>'consumer_contract_context', '');
  if v_context not in ('distance', 'off_premises') then
    raise exception 'Zakonski odstop v tem postopku velja samo za pogodbo na daljavo ali zunaj poslovnih prostorov.';
  end if;
  if v_order.status in ('completed', 'invoiced') and private.pos_consumer_service_right_expired(v_order.id, v_user) then
    raise exception 'Po dokazani popolni izvedbi in potrošnikovi potrditvi je pravica do odstopa prenehala; primer potrebuje ločen pravni pregled.';
  end if;

  v_accepted_on := coalesce(v_order.accepted_on, (v_order.accepted_at at time zone 'Europe/Berlin')::date);
  v_deadline := v_accepted_on + 14;
  if p_declared_on < v_accepted_on then raise exception 'Datum izjave ne sme biti pred sprejemom ponudbe.'; end if;
  if p_declared_on > current_date then raise exception 'Datum izjave ne sme biti v prihodnosti.'; end if;
  if p_declared_on > v_deadline then
    raise exception 'Ta 14-dnevni postopek ni primeren za pozno izjavo; primer potrebuje ločen pravni pregled.';
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

  v_review_required := v_order.status in ('in_progress', 'completed', 'invoiced');
  insert into public.pos_work_order_withdrawals(
    user_id, work_order_id, acceptance_id, offer_document_id, offer_sha256,
    status_before, declared_on, evidence, value_compensation_review_required, received_at
  ) values (
    v_user, v_order.id, v_acceptance.id, v_document.id, v_document.sha256,
    v_order.status, p_declared_on, v_evidence, v_review_required, v_received_at
  );

  update public.pos_work_orders
  set status = 'withdrawn', withdrawn_at = v_received_at
  where id = v_order.id
  returning * into v_order;

  insert into public.pos_work_order_events(user_id, work_order_id, action, details)
  values (
    v_user,
    v_order.id,
    'withdrawn',
    jsonb_build_object(
      'from_status', (select status_before from public.pos_work_order_withdrawals where work_order_id = v_order.id),
      'declared_on', p_declared_on,
      'received_at', v_received_at,
      'evidence', v_evidence,
      'consumer_contract_context', v_context,
      'value_compensation_review_required', v_review_required,
      'right_expiry_proven', false,
      'offer_document_id', v_document.id,
      'offer_sha256', v_document.sha256,
      'automatic_refund_performed', false
    )
  );
  return v_order;
end;
$$;

notify pgrst, 'reload schema';

;
