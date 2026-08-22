-- Offers and work orders reuse invoice recipient/item data. Validate that data
-- before the privileged numbering function runs, and bound both mutable and
-- locked JSON copies so a modified client cannot persist oversized documents.

create or replace function private.pos_validate_work_order_payload(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile_tax_status text;
  v_customer_type text;
  v_tax_mode text;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;

  p_payload := private.pos_validate_invoice_payload(p_payload);
  v_customer_type := p_payload->>'customer_type';
  v_tax_mode := p_payload->>'tax_mode';

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

  select profile.tax_status
    into v_profile_tax_status
  from public.pos_business_profiles as profile
  where profile.user_id = v_user;
  if not found then raise exception 'Najprej shranite podatke podjetja.'; end if;
  if v_profile_tax_status = 'small_business' and v_tax_mode <> 'small_business' then
    raise exception 'Kleinunternehmer ne sme obračunati DDV.';
  end if;
  if v_profile_tax_status <> 'small_business' and v_tax_mode = 'small_business' then
    raise exception '§ 19 UStG ni omogočen v profilu.';
  end if;

  return p_payload;
end;
$$;

alter table public.pos_work_orders
  add constraint pos_work_orders_payload_size_check
  check (octet_length(payload::text) <= 524288) not valid;
alter table public.pos_work_orders
  validate constraint pos_work_orders_payload_size_check;

alter table public.pos_work_orders
  add constraint pos_work_orders_locked_payload_size_check
  check (locked_payload is null or octet_length(locked_payload::text) <= 524288) not valid;
alter table public.pos_work_orders
  validate constraint pos_work_orders_locked_payload_size_check;

create or replace function private._pos_save_work_order_validated(
  p_work_order_id uuid,
  p_payload jsonb
)
returns public.pos_work_orders
language sql
security definer
set search_path = ''
as $$
  select private._pos_save_work_order(
    p_work_order_id,
    private.pos_validate_work_order_payload(p_payload)
  );
$$;

create or replace function public.pos_save_work_order(
  p_work_order_id uuid,
  p_payload jsonb
)
returns public.pos_work_orders
language sql
security invoker
set search_path = ''
as $$
  select private._pos_save_work_order_validated(p_work_order_id, p_payload);
$$;

revoke all on function private.pos_validate_work_order_payload(jsonb) from public, anon, authenticated;
grant execute on function private.pos_validate_work_order_payload(jsonb) to service_role;

revoke execute on function private._pos_save_work_order(uuid,jsonb) from authenticated;
revoke all on function private._pos_save_work_order_validated(uuid,jsonb) from public, anon;
grant execute on function private._pos_save_work_order_validated(uuid,jsonb) to authenticated, service_role;

revoke all on function public.pos_save_work_order(uuid,jsonb) from public, anon;
grant execute on function public.pos_save_work_order(uuid,jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
