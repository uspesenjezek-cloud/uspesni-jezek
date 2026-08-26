-- A lost HTTP response must not create a second immutable correction or make a
-- successfully committed cancellation look like a failure. Keep request keys
-- outside the immutable accounting row and serialize retries on the same
-- per-user profile lock that already protects adjustment numbering.

create table private.pos_adjustment_requests (
  user_id uuid not null,
  request_key uuid not null,
  adjustment_id uuid not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, request_key),
  constraint pos_adjustment_requests_adjustment_tenant_fkey
    foreign key (adjustment_id, user_id)
    references public.pos_invoice_adjustments(id, user_id)
    on delete restrict
);

alter table private.pos_adjustment_requests enable row level security;
revoke all on table private.pos_adjustment_requests from public, anon, authenticated;
grant select, insert on table private.pos_adjustment_requests to service_role;

create or replace function private._pos_create_invoice_adjustment_idempotent(
  p_invoice_id uuid,
  p_request_key uuid,
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
  v_existing public.pos_invoice_adjustments%rowtype;
  v_adjustment public.pos_invoice_adjustments%rowtype;
  v_changes jsonb;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_request_key is null then raise exception 'Manjka ključ varne ponovitve popravka.'; end if;

  v_changes := private.pos_validate_adjustment_changes(
    p_adjustment_type, v_reason, p_changes
  );

  perform 1
  from public.pos_business_profiles
  where user_id = v_user
  for update;
  if not found then raise exception 'Podatki podjetja ne obstajajo.'; end if;

  select adjustment.* into v_existing
  from private.pos_adjustment_requests request
  join public.pos_invoice_adjustments adjustment
    on adjustment.id = request.adjustment_id
   and adjustment.user_id = request.user_id
  where request.user_id = v_user
    and request.request_key = p_request_key;

  if found then
    if v_existing.original_invoice_id is distinct from p_invoice_id
      or v_existing.adjustment_type is distinct from p_adjustment_type
      or v_existing.reason is distinct from v_reason
      or v_existing.changes is distinct from v_changes then
      raise exception 'Ključ ponovitve je že vezan na drug popravek.';
    end if;
    return v_existing;
  end if;

  v_adjustment := private._pos_create_invoice_adjustment(
    p_invoice_id, p_adjustment_type, v_reason, v_changes, p_confirmed
  );

  insert into private.pos_adjustment_requests(user_id, request_key, adjustment_id)
  values (v_user, p_request_key, v_adjustment.id);

  return v_adjustment;
end;
$$;

create or replace function public.pos_create_invoice_adjustment(
  p_invoice_id uuid,
  p_request_key uuid,
  p_adjustment_type text,
  p_reason text,
  p_changes jsonb default '{}'::jsonb,
  p_confirmed boolean default false
)
returns public.pos_invoice_adjustments
language sql
security definer
set search_path = ''
as $$
  select private._pos_create_invoice_adjustment_idempotent(
    p_invoice_id, p_request_key, p_adjustment_type, p_reason, p_changes, p_confirmed
  );
$$;

revoke all on function private._pos_create_invoice_adjustment_idempotent(uuid,uuid,text,text,jsonb,boolean)
  from public, anon, authenticated;
grant execute on function private._pos_create_invoice_adjustment_idempotent(uuid,uuid,text,text,jsonb,boolean)
  to service_role;

revoke execute on function public.pos_create_invoice_adjustment(uuid,text,text,jsonb,boolean)
  from authenticated;
revoke all on function public.pos_create_invoice_adjustment(uuid,uuid,text,text,jsonb,boolean)
  from public, anon;
grant execute on function public.pos_create_invoice_adjustment(uuid,uuid,text,text,jsonb,boolean)
  to authenticated, service_role;

notify pgrst, 'reload schema';;
