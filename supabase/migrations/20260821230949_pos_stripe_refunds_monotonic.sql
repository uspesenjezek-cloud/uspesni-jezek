-- Stripe may deliver signed refund events out of order. A stale event must
-- never reduce an already recorded cumulative refund or reopen a fully
-- refunded invoice. Enforce this as a table invariant for every update path.
create or replace function private.pos_preserve_refund_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.refunded_cents < old.refunded_cents then
    new.refunded_cents := old.refunded_cents;
  end if;

  if new.refunded_cents = new.amount_cents then
    new.status := 'refunded';
  elsif new.refunded_cents > 0 then
    new.status := 'partially_refunded';
  end if;

  return new;
end;
$$;

drop trigger if exists pos_payments_refund_monotonic on public.pos_payments;
create trigger pos_payments_refund_monotonic
before update on public.pos_payments
for each row execute function private.pos_preserve_refund_progress();

revoke all on function private.pos_preserve_refund_progress() from public, anon, authenticated;
grant execute on function private.pos_preserve_refund_progress() to service_role;

notify pgrst, 'reload schema';;
