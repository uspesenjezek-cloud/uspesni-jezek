-- A manual payment can commit even when the browser loses the RPC response.
-- Bind every confirmation attempt to a durable request key so retrying the
-- same user action returns the committed payment instead of reporting an
-- ambiguous "already paid" error.

create table private.pos_manual_payment_requests (
  user_id uuid not null,
  request_key uuid not null,
  invoice_id uuid not null,
  payment_id uuid not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, request_key),
  constraint pos_manual_payment_requests_invoice_tenant_fkey
    foreign key (invoice_id, user_id)
    references public.pos_invoices(id, user_id)
    on delete restrict,
  constraint pos_manual_payment_requests_payment_tenant_fkey
    foreign key (payment_id, user_id)
    references public.pos_payments(id, user_id)
    on delete restrict
);

create index pos_manual_payment_requests_invoice_tenant_idx
  on private.pos_manual_payment_requests(invoice_id, user_id);
create index pos_manual_payment_requests_payment_tenant_idx
  on private.pos_manual_payment_requests(payment_id, user_id);

alter table private.pos_manual_payment_requests enable row level security;
revoke all on table private.pos_manual_payment_requests from public, anon, authenticated;
grant select, insert on table private.pos_manual_payment_requests to service_role;

create function private._pos_record_manual_payment_idempotent(
  p_invoice_id uuid,
  p_request_key uuid,
  p_confirmed boolean default false
)
returns public.pos_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invoice public.pos_invoices%rowtype;
  v_existing public.pos_payments%rowtype;
  v_payment public.pos_payments%rowtype;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_invoice_id is null then raise exception 'Manjka račun.'; end if;
  if p_request_key is null then raise exception 'Manjka ključ varne ponovitve plačila.'; end if;
  if not coalesce(p_confirmed, false) then
    raise exception 'Ročna potrditev plačila je obvezna.';
  end if;

  -- The original payment function uses the same invoice-row lock. Concurrent
  -- retries therefore wait here and then see the mapping committed first.
  select * into v_invoice
  from public.pos_invoices
  where id = p_invoice_id and user_id = v_user
  for update;
  if not found then raise exception 'Račun ne obstaja ali ni vaš.'; end if;

  select payment.* into v_existing
  from private.pos_manual_payment_requests request
  join public.pos_payments payment
    on payment.id = request.payment_id
   and payment.user_id = request.user_id
  where request.user_id = v_user
    and request.request_key = p_request_key;

  if found then
    if v_existing.invoice_id is distinct from p_invoice_id
      or v_existing.method is distinct from 'manual'
      or v_existing.provider is distinct from 'manual'
      or v_existing.status is distinct from 'succeeded' then
      raise exception 'Ključ ponovitve je že vezan na drugo plačilo.';
    end if;
    return v_existing;
  end if;

  v_payment := private._pos_record_manual_payment(p_invoice_id, p_confirmed);

  insert into private.pos_manual_payment_requests(
    user_id, request_key, invoice_id, payment_id
  ) values (
    v_user, p_request_key, p_invoice_id, v_payment.id
  );

  return v_payment;
end;
$$;

create function public.pos_record_manual_payment(
  p_invoice_id uuid,
  p_request_key uuid,
  p_confirmed boolean default false
)
returns public.pos_payments
language sql
security definer
set search_path = ''
as $$
  select private._pos_record_manual_payment_idempotent(
    p_invoice_id, p_request_key, p_confirmed
  );
$$;

revoke all on function private._pos_record_manual_payment_idempotent(uuid,uuid,boolean)
  from public, anon, authenticated;
grant execute on function private._pos_record_manual_payment_idempotent(uuid,uuid,boolean)
  to service_role;

revoke all on function private._pos_record_manual_payment(uuid,boolean)
  from public, anon, authenticated;
revoke all on function public.pos_record_manual_payment(uuid,boolean)
  from public, anon, authenticated;
revoke all on function public.pos_record_manual_payment(uuid,uuid,boolean)
  from public, anon;
grant execute on function public.pos_record_manual_payment(uuid,uuid,boolean)
  to authenticated, service_role;

notify pgrst, 'reload schema';
