-- Keep authenticated clients on the documented public POS RPC surface. The
-- public wrappers have an empty search_path and call implementations that
-- still enforce auth.uid(), ownership and state transitions. Running those
-- wrappers with their fixed owner lets us remove direct EXECUTE privileges
-- from the private implementation functions.

alter function public.pos_archive_readiness() security definer;
alter function public.pos_confirm_bank_transaction(uuid, uuid, boolean) security definer;
alter function public.pos_create_invoice_adjustment(uuid, text, text, jsonb, boolean) security definer;
alter function public.pos_import_bank_transactions(text, text, text, jsonb) security definer;
alter function public.pos_import_finapi_transactions(text, jsonb) security definer;
alter function public.pos_issue_invoice(uuid, jsonb, boolean, boolean) security definer;
alter function public.pos_issue_replacement_invoice(uuid, jsonb, boolean, boolean, uuid) security definer;
alter function public.pos_prepare_invoice_delivery(uuid, uuid, text, text, text, text, text, text, boolean, boolean) security definer;
alter function public.pos_queue_invoice_delivery(uuid, boolean) security definer;
alter function public.pos_record_manual_payment(uuid, boolean) security definer;
alter function public.pos_save_work_order(uuid, jsonb) security definer;
alter function public.pos_transition_work_order(uuid, text) security definer;

revoke execute on function private.pos_archive_readiness() from authenticated;
revoke execute on function private._pos_confirm_bank_transaction(uuid, uuid, boolean) from authenticated;
revoke execute on function private._pos_create_invoice_adjustment_validated(uuid, text, text, jsonb, boolean) from authenticated;
revoke execute on function private._pos_import_bank_transactions_validated(text, text, text, jsonb) from authenticated;
revoke execute on function private._pos_import_finapi_transactions_validated(text, jsonb) from authenticated;
revoke execute on function private._pos_issue_invoice_validated(uuid, jsonb, boolean, boolean) from authenticated;
revoke execute on function private._pos_issue_replacement_invoice_validated(uuid, jsonb, boolean, boolean, uuid) from authenticated;
revoke execute on function private._pos_prepare_invoice_delivery(uuid, uuid, text, text, text, text, text, text, boolean, boolean) from authenticated;
revoke execute on function private._pos_queue_invoice_delivery(uuid, boolean) from authenticated;
revoke execute on function private._pos_record_manual_payment(uuid, boolean) from authenticated;
revoke execute on function private._pos_save_work_order_validated(uuid, jsonb) from authenticated;
revoke execute on function private._pos_transition_work_order(uuid, text) from authenticated;

notify pgrst, 'reload schema';
