-- Restore the private RPC boundary after the adjustment delivery migration
-- replaced the queue implementation and introduced a new adjustment helper.
-- Authenticated clients call only the fixed-search-path public wrappers; the
-- private SECURITY DEFINER implementations remain callable by service_role.

alter function public.pos_prepare_adjustment_delivery(
  uuid, uuid, text, text, text, text, text, text, boolean
) security definer;

alter function public.pos_queue_invoice_delivery(uuid, boolean)
  security definer;

revoke execute on function private._pos_prepare_adjustment_delivery(
  uuid, uuid, text, text, text, text, text, text, boolean
) from authenticated;

revoke execute on function private._pos_queue_invoice_delivery(uuid, boolean)
  from authenticated;

notify pgrst, 'reload schema';;
