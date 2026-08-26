-- A manual status click is not enough evidence that a customer accepted an
-- offer. Bind every acceptance to the exact archived offer PDF and preserve a
-- short, user-entered description of the external evidence (email, signed
-- offer, telephone note, or in-person confirmation).

alter table public.pos_offer_documents
  add constraint pos_offer_documents_id_user_key unique (id, user_id);

create table public.pos_work_order_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  work_order_id uuid not null,
  offer_document_id uuid not null,
  offer_sha256 text not null check (offer_sha256 ~ '^[0-9a-f]{64}$'),
  evidence text not null check (char_length(trim(evidence)) between 5 and 500),
  accepted_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint pos_work_order_acceptances_order_user_fk
    foreign key (work_order_id, user_id)
    references public.pos_work_orders(id, user_id)
    on delete restrict,
  constraint pos_work_order_acceptances_document_user_fk
    foreign key (offer_document_id, user_id)
    references public.pos_offer_documents(id, user_id)
    on delete restrict,
  unique (work_order_id),
  unique (offer_document_id)
);

create index pos_work_order_acceptances_user_recorded_idx
  on public.pos_work_order_acceptances(user_id, recorded_at desc);

alter table public.pos_work_order_acceptances enable row level security;
revoke all on table public.pos_work_order_acceptances from public, anon, authenticated;
grant select on table public.pos_work_order_acceptances to authenticated;
grant all on table public.pos_work_order_acceptances to service_role;

create policy pos_work_order_acceptances_select_own
  on public.pos_work_order_acceptances
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function private.pos_prevent_work_order_evidence_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Pogodbena sled in dokaz sprejema sta nespremenljiva.';
end;
$$;

revoke all on function private.pos_prevent_work_order_evidence_mutation()
  from public, anon, authenticated;
grant execute on function private.pos_prevent_work_order_evidence_mutation()
  to service_role;

create trigger pos_work_order_acceptances_immutable
before update or delete on public.pos_work_order_acceptances
for each row execute function private.pos_prevent_work_order_evidence_mutation();

create trigger pos_work_order_events_immutable
before update or delete on public.pos_work_order_events
for each row execute function private.pos_prevent_work_order_evidence_mutation();

create or replace function private.pos_require_acceptance_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'offered' and new.status = 'accepted' and not exists (
    select 1
    from public.pos_work_order_acceptances as acceptance
    where acceptance.work_order_id = new.id
      and acceptance.user_id = new.user_id
      and acceptance.accepted_at = new.accepted_at
  ) then
    raise exception 'Sprejem zahteva dokaz, vezan na arhivirani PDF ponudbe.';
  end if;
  return new;
end;
$$;

revoke all on function private.pos_require_acceptance_evidence()
  from public, anon, authenticated;
grant execute on function private.pos_require_acceptance_evidence()
  to service_role;

create trigger pos_work_orders_require_acceptance_evidence
before update of status on public.pos_work_orders
for each row execute function private.pos_require_acceptance_evidence();

create or replace function private._pos_accept_work_order(
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
  v_profile public.pos_business_profiles%rowtype;
  v_order public.pos_work_orders%rowtype;
  v_document public.pos_offer_documents%rowtype;
  v_number text;
  v_evidence text := trim(coalesce(p_evidence, ''));
  v_accepted_at timestamptz := now();
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if char_length(v_evidence) not between 5 and 500 then
    raise exception 'Vpišite kratek dokaz sprejema (od 5 do 500 znakov).';
  end if;

  select * into v_order
  from public.pos_work_orders
  where id = p_work_order_id and user_id = v_user
  for update;
  if not found then raise exception 'Ponudba ne obstaja ali ni vaša.'; end if;
  if v_order.status <> 'offered' then raise exception 'Sprejeti je mogoče samo zaklenjeno ponudbo.'; end if;
  if v_order.valid_until < current_date then raise exception 'Ponudba je potekla.'; end if;

  select * into v_document
  from public.pos_offer_documents
  where work_order_id = v_order.id and user_id = v_user and document_kind = 'offer_pdf';
  if not found then
    raise exception 'Najprej ustvarite arhivirani PDF ponudbe.';
  end if;

  select * into v_profile
  from public.pos_business_profiles
  where user_id = v_user
  for update;
  if not found then raise exception 'Podatki podjetja ne obstajajo.'; end if;

  v_number := 'AUF-' || extract(year from current_date)::integer || '-' || lpad(v_profile.next_order_sequence::text, 4, '0');
  update public.pos_business_profiles
  set next_order_sequence = next_order_sequence + 1
  where user_id = v_user;

  insert into public.pos_work_order_acceptances(
    user_id, work_order_id, offer_document_id, offer_sha256, evidence, accepted_at
  ) values (
    v_user, v_order.id, v_document.id, v_document.sha256, v_evidence, v_accepted_at
  );

  update public.pos_work_orders
  set status = 'accepted', order_number = v_number, accepted_at = v_accepted_at
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
  p_evidence text
)
returns public.pos_work_orders
language sql
security definer
set search_path = ''
as $$
  select private._pos_accept_work_order(p_work_order_id, p_evidence);
$$;

revoke all on function private._pos_accept_work_order(uuid, text)
  from public, anon, authenticated;
grant execute on function private._pos_accept_work_order(uuid, text)
  to service_role;
revoke all on function public.pos_accept_work_order(uuid, text)
  from public, anon;
grant execute on function public.pos_accept_work_order(uuid, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

;
