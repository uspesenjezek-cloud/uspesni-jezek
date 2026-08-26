-- A draft or an unaccepted offer may be withdrawn, but an accepted contract
-- must not be erased by the same generic status action. Preserve the reason
-- and, when available, bind the withdrawal to the archived offer document.

create table public.pos_work_order_cancellations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  work_order_id uuid not null,
  status_before text not null check (status_before in ('draft', 'offered')),
  reason text not null check (char_length(trim(reason)) between 5 and 500),
  offer_document_id uuid,
  offer_sha256 text check (offer_sha256 is null or offer_sha256 ~ '^[0-9a-f]{64}$'),
  cancelled_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint pos_work_order_cancellations_order_user_fk
    foreign key (work_order_id, user_id)
    references public.pos_work_orders(id, user_id)
    on delete restrict,
  constraint pos_work_order_cancellations_document_user_fk
    foreign key (offer_document_id, user_id)
    references public.pos_offer_documents(id, user_id)
    on delete restrict,
  check (
    (status_before = 'draft' and offer_document_id is null and offer_sha256 is null)
    or (status_before = 'offered' and offer_document_id is not null and offer_sha256 is not null)
  ),
  unique (work_order_id)
);

create index pos_work_order_cancellations_user_recorded_idx
  on public.pos_work_order_cancellations(user_id, recorded_at desc);

alter table public.pos_work_order_cancellations enable row level security;
revoke all on table public.pos_work_order_cancellations from public, anon, authenticated;
grant select on table public.pos_work_order_cancellations to authenticated;
grant all on table public.pos_work_order_cancellations to service_role;

create policy pos_work_order_cancellations_select_own
  on public.pos_work_order_cancellations
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create trigger pos_work_order_cancellations_immutable
before update or delete on public.pos_work_order_cancellations
for each row execute function private.pos_prevent_work_order_evidence_mutation();

create or replace function private.pos_require_cancellation_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and not exists (
    select 1
    from public.pos_work_order_cancellations as cancellation
    where cancellation.work_order_id = new.id
      and cancellation.user_id = new.user_id
      and cancellation.status_before = old.status
      and cancellation.cancelled_at = new.cancelled_at
  ) then
    raise exception 'Preklic zahteva nespremenljiv razlog in dovoljeno predhodno stanje.';
  end if;
  return new;
end;
$$;

revoke all on function private.pos_require_cancellation_evidence()
  from public, anon, authenticated;
grant execute on function private.pos_require_cancellation_evidence()
  to service_role;

create trigger pos_work_orders_require_cancellation_evidence
before update of status on public.pos_work_orders
for each row execute function private.pos_require_cancellation_evidence();

create or replace function private._pos_cancel_work_order(
  p_work_order_id uuid,
  p_reason text
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
  v_document public.pos_offer_documents%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
  v_cancelled_at timestamptz := now();
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if char_length(v_reason) not between 5 and 500 then
    raise exception 'Vpišite razlog preklica (od 5 do 500 znakov).';
  end if;

  select * into v_order
  from public.pos_work_orders
  where id = p_work_order_id and user_id = v_user
  for update;
  if not found then raise exception 'Ponudba ne obstaja ali ni vaša.'; end if;
  if v_order.status not in ('draft', 'offered') then
    raise exception 'Sprejetega naročila ni mogoče preklicati kot ponudbo. Potreben je ločen postopek odpovedi pogodbe.';
  end if;

  if v_order.status = 'offered' then
    select * into v_document
    from public.pos_offer_documents
    where work_order_id = v_order.id and user_id = v_user and document_kind = 'offer_pdf';
    if not found then raise exception 'Najprej ustvarite arhivirani PDF ponudbe.'; end if;
  end if;

  insert into public.pos_work_order_cancellations(
    user_id, work_order_id, status_before, reason, offer_document_id, offer_sha256, cancelled_at
  ) values (
    v_user,
    v_order.id,
    v_order.status,
    v_reason,
    case when v_order.status = 'offered' then v_document.id else null end,
    case when v_order.status = 'offered' then v_document.sha256 else null end,
    v_cancelled_at
  );

  update public.pos_work_orders
  set status = 'cancelled', cancelled_at = v_cancelled_at
  where id = v_order.id
  returning * into v_order;

  insert into public.pos_work_order_events(user_id, work_order_id, action, details)
  values (
    v_user,
    v_order.id,
    'cancelled',
    jsonb_strip_nulls(jsonb_build_object(
      'from_status', (select status_before from public.pos_work_order_cancellations where work_order_id = v_order.id),
      'reason', v_reason,
      'offer_document_id', v_document.id,
      'offer_sha256', v_document.sha256
    ))
  );
  return v_order;
end;
$$;

create or replace function public.pos_cancel_work_order(
  p_work_order_id uuid,
  p_reason text
)
returns public.pos_work_orders
language sql
security definer
set search_path = ''
as $$
  select private._pos_cancel_work_order(p_work_order_id, p_reason);
$$;

revoke all on function private._pos_cancel_work_order(uuid, text)
  from public, anon, authenticated;
grant execute on function private._pos_cancel_work_order(uuid, text)
  to service_role;
revoke all on function public.pos_cancel_work_order(uuid, text)
  from public, anon;
grant execute on function public.pos_cancel_work_order(uuid, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

;
