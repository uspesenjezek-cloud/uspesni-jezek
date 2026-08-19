-- Javni RPC ostane SECURITY INVOKER. Povišane pravice ima samo zasebno jedro,
-- ki samo pridobi auth.uid(), zaklene uporabnikov zapis in preveri vse dokaze.
alter function public.pos_queue_invoice_delivery(uuid,boolean)
  rename to _pos_queue_invoice_delivery;
alter function public._pos_queue_invoice_delivery(uuid,boolean)
  set schema private;

create or replace function public.pos_queue_invoice_delivery(
  p_delivery_id uuid,
  p_confirmed boolean default false
)
returns public.pos_invoice_deliveries
language sql
security invoker
set search_path = ''
as $$
  select private._pos_queue_invoice_delivery(p_delivery_id, p_confirmed);
$$;

revoke all on function private._pos_queue_invoice_delivery(uuid,boolean) from public, anon;
revoke all on function public.pos_queue_invoice_delivery(uuid,boolean) from public, anon;
grant execute on function private._pos_queue_invoice_delivery(uuid,boolean) to authenticated, service_role;
grant execute on function public.pos_queue_invoice_delivery(uuid,boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
