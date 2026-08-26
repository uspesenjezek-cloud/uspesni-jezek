-- Consumer offers need a recorded contract context. Distance and off-premises
-- contracts receive the statutory withdrawal pages in the immutable offer PDF.
-- Starting before the 14-day period (or under the urgent-repair exception)
-- requires separate immutable evidence bound to the accepted offer original.

create or replace function private.pos_validate_work_order_payload(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile public.pos_business_profiles%rowtype;
  v_customer_type text;
  v_tax_mode text;
  v_context text;
  v_urgent_scope text;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;

  p_payload := private.pos_validate_invoice_tax_evidence(
    private.pos_validate_invoice_payload(
      private.pos_validate_invoice_party_fields(
        p_payload || jsonb_build_object(
          'seller_contact_phone',
          coalesce((select business_phone from public.pos_business_profiles where user_id = v_user), '')
        )
      )
    )
  );
  v_customer_type := p_payload->>'customer_type';
  v_tax_mode := p_payload->>'tax_mode';
  v_context := trim(coalesce(p_payload->>'consumer_contract_context', ''));
  v_urgent_scope := trim(coalesce(p_payload->>'urgent_repair_scope', ''));

  if v_customer_type is null or v_customer_type not in ('private', 'business', 'public') then
    raise exception 'Neveljavna vrsta prejemnika.';
  end if;
  if v_tax_mode is null or v_tax_mode not in ('regular', 'small_business', 'reverse_charge') then
    raise exception 'Neveljaven davčni način.';
  end if;
  if v_customer_type = 'public' and trim(coalesce(p_payload->>'leitweg_id', '')) = '' then
    raise exception 'Za javnega naročnika je potrebna Leitweg-ID.';
  end if;
  if v_tax_mode = 'reverse_charge' and (
       v_customer_type = 'private'
       or not coalesce((p_payload->>'reverse_charge_confirmed')::boolean, false)
     ) then
    raise exception 'Pogoji § 13b UStG niso potrjeni.';
  end if;

  select * into v_profile
  from public.pos_business_profiles
  where user_id = v_user;
  if not found then raise exception 'Najprej shranite podatke podjetja.'; end if;
  if v_profile.tax_status = 'small_business' and v_tax_mode <> 'small_business' then
    raise exception 'Kleinunternehmer ne sme obračunati DDV.';
  end if;
  if v_profile.tax_status <> 'small_business' and v_tax_mode = 'small_business' then
    raise exception '§ 19 UStG ni omogočen v profilu.';
  end if;

  if v_customer_type = 'private' then
    if v_context not in ('business_premises', 'distance', 'off_premises', 'urgent_repair') then
      raise exception 'Izberite način sklenitve potrošniške pogodbe.';
    end if;
    if v_context in ('distance', 'off_premises') and (
      trim(coalesce(v_profile.business_email, '')) = ''
      or trim(coalesce(v_profile.business_phone, '')) = ''
    ) then
      raise exception 'Widerrufsbelehrung zahteva poslovni e-poštni naslov in telefon.';
    end if;
    if v_context = 'urgent_repair' and char_length(v_urgent_scope) not between 5 and 500 then
      raise exception 'Natančno opišite nujno popravilo (od 5 do 500 znakov).';
    end if;
    if v_context <> 'urgent_repair' and v_urgent_scope <> '' then
      raise exception 'Obseg nujnega popravila je dovoljen samo pri nujnem popravilu.';
    end if;
  elsif v_context not in ('', 'not_applicable') or v_urgent_scope <> '' then
    raise exception 'Potrošniški način sklenitve ni dovoljen za poslovnega ali javnega naročnika.';
  end if;

  return p_payload;
end;
$$;

revoke all on function private.pos_validate_work_order_payload(jsonb)
  from public, anon, authenticated;
grant execute on function private.pos_validate_work_order_payload(jsonb)
  to service_role;

create table public.pos_work_order_early_start_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  work_order_id uuid not null,
  acceptance_id uuid not null references public.pos_work_order_acceptances(id) on delete restrict,
  offer_document_id uuid not null,
  offer_sha256 text not null check (offer_sha256 ~ '^[0-9a-f]{64}$'),
  contract_context text not null check (contract_context in ('distance', 'off_premises', 'urgent_repair')),
  evidence text not null check (char_length(trim(evidence)) between 5 and 500),
  started_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint pos_work_order_early_start_order_user_fk
    foreign key (work_order_id, user_id)
    references public.pos_work_orders(id, user_id)
    on delete restrict,
  constraint pos_work_order_early_start_document_user_fk
    foreign key (offer_document_id, user_id)
    references public.pos_offer_documents(id, user_id)
    on delete restrict,
  unique (work_order_id),
  unique (acceptance_id)
);

create index pos_work_order_early_start_user_recorded_idx
  on public.pos_work_order_early_start_evidence(user_id, recorded_at desc);

alter table public.pos_work_order_early_start_evidence enable row level security;
revoke all on table public.pos_work_order_early_start_evidence from public, anon, authenticated;
grant select on table public.pos_work_order_early_start_evidence to authenticated;
grant all on table public.pos_work_order_early_start_evidence to service_role;

create policy pos_work_order_early_start_select_own
  on public.pos_work_order_early_start_evidence
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create trigger pos_work_order_early_start_immutable
before update or delete on public.pos_work_order_early_start_evidence
for each row execute function private.pos_prevent_work_order_evidence_mutation();

create or replace function private.pos_require_consumer_early_start_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context text := coalesce(new.locked_payload->>'consumer_contract_context', '');
  v_private boolean := coalesce(new.locked_payload->>'customer_type', '') = 'private';
  v_required boolean;
begin
  if old.status = 'accepted' and new.status = 'in_progress' then
    v_required := v_private and (
      v_context = 'urgent_repair'
      or (v_context in ('distance', 'off_premises') and new.started_at < old.accepted_at + interval '14 days')
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

create trigger pos_work_orders_require_consumer_early_start_evidence
before update of status on public.pos_work_orders
for each row execute function private.pos_require_consumer_early_start_evidence();

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
  v_required := coalesce(v_order.locked_payload->>'customer_type', '') = 'private' and (
    v_context = 'urgent_repair'
    or (v_context in ('distance', 'off_premises') and v_started_at < v_order.accepted_at + interval '14 days')
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

create or replace function public.pos_start_work_order(
  p_work_order_id uuid,
  p_evidence text
)
returns public.pos_work_orders
language sql
security definer
set search_path = ''
as $$
  select private._pos_start_work_order(p_work_order_id, p_evidence);
$$;

revoke all on function private._pos_start_work_order(uuid, text)
  from public, anon, authenticated;
grant execute on function private._pos_start_work_order(uuid, text)
  to service_role;
revoke all on function public.pos_start_work_order(uuid, text)
  from public, anon;
grant execute on function public.pos_start_work_order(uuid, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

;
