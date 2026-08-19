-- Nespremenljivi popravki in storni izdanih POS racunov.
alter table public.pos_business_profiles
  add column if not exists next_adjustment_sequence bigint not null default 1
  check (next_adjustment_sequence > 0);

create table public.pos_invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_invoice_id uuid not null references public.pos_invoices(id) on delete restrict,
  adjustment_number text not null check (char_length(adjustment_number) between 1 and 80),
  adjustment_type text not null check (adjustment_type in ('correction','cancellation')),
  document_status text not null check (document_status in ('issued','test')),
  is_test boolean not null,
  reason text not null check (char_length(reason) between 5 and 500),
  changes jsonb not null default '{}'::jsonb check (jsonb_typeof(changes) = 'object'),
  delta_net_cents bigint not null default 0,
  delta_tax_cents bigint not null default 0,
  delta_gross_cents bigint not null default 0,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  issued_at timestamptz not null default now(),
  unique (user_id, adjustment_number)
);

create index pos_invoice_adjustments_user_issued_idx
  on public.pos_invoice_adjustments(user_id, issued_at desc);
create index pos_invoice_adjustments_original_idx
  on public.pos_invoice_adjustments(original_invoice_id, issued_at);
create unique index pos_invoice_adjustments_single_cancellation_uidx
  on public.pos_invoice_adjustments(original_invoice_id)
  where adjustment_type = 'cancellation';

create table public.pos_adjustment_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  adjustment_id uuid not null references public.pos_invoice_adjustments(id) on delete restrict,
  document_kind text not null default 'adjustment_pdf' check (document_kind = 'adjustment_pdf'),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 5242880),
  media_type text not null default 'application/pdf' check (media_type = 'application/pdf'),
  generator_version text not null check (char_length(generator_version) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (adjustment_id, document_kind),
  unique (storage_path)
);

create index pos_adjustment_documents_user_created_idx
  on public.pos_adjustment_documents(user_id, created_at desc);

alter table public.pos_invoice_adjustments enable row level security;
alter table public.pos_adjustment_documents enable row level security;
revoke all on table public.pos_invoice_adjustments from public, anon, authenticated;
revoke all on table public.pos_adjustment_documents from public, anon, authenticated;
grant select on table public.pos_invoice_adjustments, public.pos_adjustment_documents to authenticated;
grant all on table public.pos_invoice_adjustments, public.pos_adjustment_documents to service_role;

create policy pos_invoice_adjustments_select_own on public.pos_invoice_adjustments
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_adjustment_documents_select_own on public.pos_adjustment_documents
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create trigger pos_invoice_adjustments_immutable
before update or delete on public.pos_invoice_adjustments
for each row execute function private.pos_prevent_invoice_mutation();
create trigger pos_adjustment_documents_immutable
before update or delete on public.pos_adjustment_documents
for each row execute function private.pos_prevent_invoice_mutation();

drop policy if exists pos_payment_insert_own on public.pos_payments;
create policy pos_payment_insert_own on public.pos_payments
  for insert to authenticated with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and exists (
      select 1 from public.pos_invoices i
      where i.id = invoice_id and i.user_id = (select auth.uid())
    )
    and not exists (
      select 1 from public.pos_invoice_adjustments a
      where a.original_invoice_id = invoice_id and a.adjustment_type = 'cancellation'
    )
  );

create or replace function private._pos_create_invoice_adjustment(
  p_invoice_id uuid,
  p_adjustment_type text,
  p_reason text,
  p_changes jsonb default '{}'::jsonb,
  p_confirmed boolean default false
)
returns public.pos_invoice_adjustments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invoice public.pos_invoices%rowtype;
  v_profile public.pos_business_profiles%rowtype;
  v_adjustment public.pos_invoice_adjustments%rowtype;
  v_effective jsonb;
  v_previous_effective jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_previous record;
  v_key text;
  v_value jsonb;
  v_sequence bigint;
  v_number text;
  v_reason text := trim(coalesce(p_reason, ''));
  v_snapshot jsonb;
  v_net bigint := 0;
  v_tax bigint := 0;
  v_gross bigint := 0;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if not coalesce(p_confirmed, false) then raise exception 'Potrditev popravka je obvezna.'; end if;
  if p_adjustment_type not in ('correction','cancellation') then raise exception 'Neveljavna vrsta popravka.'; end if;
  if char_length(v_reason) not between 5 and 500 then raise exception 'Razlog mora vsebovati od 5 do 500 znakov.'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then raise exception 'Popravljeni podatki niso veljavni.'; end if;

  select * into v_invoice from public.pos_invoices
  where id = p_invoice_id and user_id = v_user for share;
  if not found then raise exception 'Racun ne obstaja ali ni vas.'; end if;
  select * into v_profile from public.pos_business_profiles
  where user_id = v_user for update;
  if not found then raise exception 'Podatki podjetja ne obstajajo.'; end if;

  if exists (
    select 1 from public.pos_invoice_adjustments
    where original_invoice_id = v_invoice.id and adjustment_type = 'cancellation'
  ) then raise exception 'Ta racun je ze storniran.'; end if;

  v_effective := coalesce(v_invoice.snapshot->'draft', '{}'::jsonb);
  for v_previous in
    select changes from public.pos_invoice_adjustments
    where original_invoice_id = v_invoice.id and adjustment_type = 'correction'
    order by issued_at, id
  loop
    v_effective := v_effective || v_previous.changes;
  end loop;

  if p_adjustment_type = 'correction' then
    if exists (
      select 1 from jsonb_object_keys(p_changes) as allowed(key)
      where allowed.key not in (
        'customer_name','customer_street','customer_postal_code','customer_city',
        'customer_vat_id','service_date','due_date','buyer_reference','leitweg_id','work_description'
      )
    ) then raise exception 'Popravek vsebuje nedovoljeno polje.'; end if;

    v_previous_effective := v_effective;
    for v_key, v_value in select key, value from jsonb_each(p_changes) loop
      if v_value <> coalesce(v_effective->v_key, 'null'::jsonb) then
        v_changes := v_changes || jsonb_build_object(v_key, v_value);
      end if;
    end loop;
    if v_changes = '{}'::jsonb then raise exception 'Spremenite najmanj en podatek.'; end if;
    v_effective := v_effective || v_changes;

    if trim(coalesce(v_effective->>'customer_name','')) = ''
      or trim(coalesce(v_effective->>'customer_street','')) = ''
      or trim(coalesce(v_effective->>'customer_postal_code','')) = ''
      or trim(coalesce(v_effective->>'customer_city','')) = '' then
      raise exception 'Prejemnik in naslov ne smejo biti prazni.';
    end if;
    if char_length(coalesce(v_effective->>'customer_name','')) > 240
      or char_length(coalesce(v_effective->>'customer_street','')) > 180
      or char_length(coalesce(v_effective->>'customer_postal_code','')) > 12
      or char_length(coalesce(v_effective->>'customer_city','')) > 120
      or char_length(coalesce(v_effective->>'customer_vat_id','')) > 20
      or char_length(coalesce(v_effective->>'buyer_reference','')) > 120
      or char_length(coalesce(v_effective->>'leitweg_id','')) > 120
      or char_length(coalesce(v_effective->>'work_description','')) > 2000 then
      raise exception 'Eden od popravljenih podatkov je predolg.';
    end if;
    begin
      if v_effective ? 'service_date' then perform (v_effective->>'service_date')::date; end if;
      if v_effective ? 'due_date' then perform (v_effective->>'due_date')::date; end if;
    exception when others then raise exception 'Popravljeni datum ni veljaven.';
    end;
  else
    v_changes := '{}'::jsonb;
    v_net := -v_invoice.net_cents;
    v_tax := -v_invoice.tax_cents;
    v_gross := -v_invoice.gross_cents;
  end if;

  v_sequence := v_profile.next_adjustment_sequence;
  v_number := case
    when v_invoice.is_test and p_adjustment_type = 'cancellation' then 'TEST-ST-'
    when v_invoice.is_test then 'TEST-KORR-'
    when p_adjustment_type = 'cancellation' then 'ST-'
    else 'KORR-'
  end || extract(year from current_date)::integer || '-' || lpad(v_sequence::text, 4, '0');
  update public.pos_business_profiles
  set next_adjustment_sequence = next_adjustment_sequence + 1
  where user_id = v_user;

  v_snapshot := jsonb_build_object(
    'schema_version', 1,
    'seller', v_invoice.snapshot->'seller',
    'original_invoice', jsonb_build_object(
      'id', v_invoice.id, 'invoice_number', v_invoice.invoice_number,
      'issue_date', v_invoice.issue_date, 'service_date', v_invoice.service_date,
      'due_date', v_invoice.due_date, 'tax_mode', v_invoice.tax_mode,
      'net_cents', v_invoice.net_cents, 'tax_cents', v_invoice.tax_cents,
      'gross_cents', v_invoice.gross_cents, 'is_test', v_invoice.is_test
    ),
    'original_draft', v_invoice.snapshot->'draft',
    'previous_draft', coalesce(v_previous_effective, v_effective),
    'effective_draft', v_effective,
    'changes', v_changes
  );

  insert into public.pos_invoice_adjustments (
    user_id, original_invoice_id, adjustment_number, adjustment_type,
    document_status, is_test, reason, changes, delta_net_cents,
    delta_tax_cents, delta_gross_cents, snapshot
  ) values (
    v_user, v_invoice.id, v_number, p_adjustment_type,
    case when v_invoice.is_test then 'test' else 'issued' end,
    v_invoice.is_test, v_reason, v_changes, v_net, v_tax, v_gross, v_snapshot
  ) returning * into v_adjustment;

  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (v_user,'invoice',v_invoice.id,
    case when p_adjustment_type = 'cancellation' then 'invoice_cancelled' else 'invoice_corrected' end,
    jsonb_build_object('adjustment_id',v_adjustment.id,'adjustment_number',v_number,'reason',v_reason));
  return v_adjustment;
end;
$$;

create or replace function public.pos_create_invoice_adjustment(
  p_invoice_id uuid,
  p_adjustment_type text,
  p_reason text,
  p_changes jsonb default '{}'::jsonb,
  p_confirmed boolean default false
)
returns public.pos_invoice_adjustments
language sql
security invoker
set search_path = ''
as $$
  select private._pos_create_invoice_adjustment(
    p_invoice_id,p_adjustment_type,p_reason,p_changes,p_confirmed
  );
$$;

revoke all on function private._pos_create_invoice_adjustment(uuid,text,text,jsonb,boolean) from public, anon;
revoke all on function public.pos_create_invoice_adjustment(uuid,text,text,jsonb,boolean) from public, anon;
grant execute on function private._pos_create_invoice_adjustment(uuid,text,text,jsonb,boolean) to authenticated, service_role;
grant execute on function public.pos_create_invoice_adjustment(uuid,text,text,jsonb,boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
