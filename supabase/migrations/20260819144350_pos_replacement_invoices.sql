-- Povezuje nespremenljiv prvotni račun, njegov polni Storno in en sam
-- nadomestni račun. Izdaja ostane atomska in je dovoljena samo lastniku.

create table public.pos_invoice_replacements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_invoice_id uuid not null references public.pos_invoices(id) on delete restrict,
  cancellation_adjustment_id uuid not null unique references public.pos_invoice_adjustments(id) on delete restrict,
  replacement_invoice_id uuid not null unique references public.pos_invoices(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (original_invoice_id <> replacement_invoice_id)
);
create index pos_invoice_replacements_user_created_idx
  on public.pos_invoice_replacements(user_id, created_at desc);
create index pos_invoice_replacements_original_idx
  on public.pos_invoice_replacements(original_invoice_id, created_at);
alter table public.pos_invoice_replacements enable row level security;
revoke all on table public.pos_invoice_replacements from public, anon, authenticated;
grant select on table public.pos_invoice_replacements to authenticated;
grant all on table public.pos_invoice_replacements to service_role;
create policy pos_invoice_replacements_select_own on public.pos_invoice_replacements
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create or replace function private.pos_prevent_replacement_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Povezava nadomestnega računa je nespremenljiva.';
end;
$$;
create trigger pos_invoice_replacements_immutable
before update or delete on public.pos_invoice_replacements
for each row execute function private.pos_prevent_replacement_mutation();
create or replace function private._pos_issue_replacement_invoice(
  p_draft_id uuid,
  p_payload jsonb,
  p_final_confirmed boolean,
  p_einvoice_validated boolean,
  p_cancellation_adjustment_id uuid
)
returns public.pos_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_adjustment public.pos_invoice_adjustments%rowtype;
  v_original public.pos_invoices%rowtype;
  v_existing public.pos_invoice_replacements%rowtype;
  v_existing_invoice public.pos_invoices%rowtype;
  v_replacement public.pos_invoices%rowtype;
  v_payload jsonb;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_cancellation_adjustment_id is null then raise exception 'Manjka Storno, na katerega se nanaša nadomestni račun.'; end if;

  select * into v_adjustment
  from public.pos_invoice_adjustments
  where id = p_cancellation_adjustment_id
    and user_id = v_user
    and adjustment_type = 'cancellation'
  for update;
  if not found then raise exception 'Storno ne obstaja ali ni vaš.'; end if;

  select * into v_original
  from public.pos_invoices
  where id = v_adjustment.original_invoice_id and user_id = v_user;
  if not found then raise exception 'Prvotni račun ne obstaja ali ni vaš.'; end if;

  select * into v_existing
  from public.pos_invoice_replacements
  where cancellation_adjustment_id = v_adjustment.id;
  if found then
    select * into v_existing_invoice
    from public.pos_invoices
    where id = v_existing.replacement_invoice_id and user_id = v_user;
    if found and v_existing_invoice.source_draft_id = p_draft_id then return v_existing_invoice; end if;
    raise exception 'Za ta Storno nadomestni račun že obstaja.';
  end if;

  v_payload := p_payload || jsonb_build_object(
    'replacement_original_invoice_id', v_original.id,
    'replacement_original_number', v_original.invoice_number,
    'replacement_cancellation_adjustment_id', v_adjustment.id,
    'replacement_cancellation_number', v_adjustment.adjustment_number
  );

  v_replacement := private._pos_issue_invoice(
    p_draft_id,
    v_payload,
    p_final_confirmed,
    p_einvoice_validated
  );

  if v_replacement.id = v_original.id then raise exception 'Račun ne more nadomestiti samega sebe.'; end if;
  if v_replacement.is_test <> v_original.is_test then
    raise exception 'Testni in produkcijski dokumenti ne smejo biti povezani v isti verigi.';
  end if;

  insert into public.pos_invoice_replacements(
    user_id,
    original_invoice_id,
    cancellation_adjustment_id,
    replacement_invoice_id
  ) values (
    v_user,
    v_original.id,
    v_adjustment.id,
    v_replacement.id
  );

  insert into public.pos_audit_events(user_id, entity_type, entity_id, action, details)
  values (
    v_user,
    'invoice',
    v_replacement.id,
    'replacement_invoice_issued',
    jsonb_build_object(
      'original_invoice_id', v_original.id,
      'original_invoice_number', v_original.invoice_number,
      'cancellation_adjustment_id', v_adjustment.id,
      'cancellation_adjustment_number', v_adjustment.adjustment_number,
      'replacement_invoice_number', v_replacement.invoice_number
    )
  );

  return v_replacement;
end;
$$;
create or replace function public.pos_issue_replacement_invoice(
  p_draft_id uuid,
  p_payload jsonb,
  p_final_confirmed boolean,
  p_einvoice_validated boolean default false,
  p_cancellation_adjustment_id uuid default null
)
returns public.pos_invoices
language sql
security invoker
set search_path = ''
as $$
  select private._pos_issue_replacement_invoice(
    p_draft_id,
    p_payload,
    p_final_confirmed,
    p_einvoice_validated,
    p_cancellation_adjustment_id
  );
$$;
revoke all on function private.pos_prevent_replacement_mutation() from public, anon, authenticated;
revoke all on function private._pos_issue_replacement_invoice(uuid,jsonb,boolean,boolean,uuid) from public, anon;
revoke all on function public.pos_issue_replacement_invoice(uuid,jsonb,boolean,boolean,uuid) from public, anon;
grant execute on function private._pos_issue_replacement_invoice(uuid,jsonb,boolean,boolean,uuid) to authenticated, service_role;
grant execute on function public.pos_issue_replacement_invoice(uuid,jsonb,boolean,boolean,uuid) to authenticated, service_role;
grant execute on function private.pos_prevent_replacement_mutation() to service_role;
notify pgrst, 'reload schema';
