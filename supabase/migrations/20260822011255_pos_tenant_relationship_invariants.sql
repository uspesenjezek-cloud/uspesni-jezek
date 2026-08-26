-- RLS filters child rows by user_id. Also bind every important POS relation to
-- the same user at the foreign-key layer so a service bug cannot create a
-- cross-tenant document, payment, delivery or archive relationship.

alter table public.pos_invoices
  add constraint pos_invoices_id_user_key unique (id, user_id);
alter table public.pos_invoice_adjustments
  add constraint pos_invoice_adjustments_id_user_key unique (id, user_id);
alter table public.pos_archive_records
  add constraint pos_archive_records_id_user_key unique (id, user_id);
alter table public.pos_archive_replicas
  add constraint pos_archive_replicas_id_user_key unique (id, user_id);
alter table public.pos_payments
  add constraint pos_payments_id_user_key unique (id, user_id);
alter table public.pos_bank_imports
  add constraint pos_bank_imports_id_user_key unique (id, user_id);
alter table public.pos_bank_transactions
  add constraint pos_bank_transactions_id_user_key unique (id, user_id);
alter table public.pos_einvoice_documents
  add constraint pos_einvoice_documents_id_user_key unique (id, user_id);
alter table public.pos_invoice_deliveries
  add constraint pos_invoice_deliveries_id_user_key unique (id, user_id);
alter table public.pos_work_orders
  add constraint pos_work_orders_id_user_key unique (id, user_id);

alter table public.pos_adjustment_documents
  add constraint pos_tenant_adjustment_document_adjustment_fk
  foreign key (adjustment_id, user_id)
  references public.pos_invoice_adjustments(id, user_id) on delete restrict not valid;
alter table public.pos_archive_integrity_events
  add constraint pos_tenant_archive_integrity_record_fk
  foreign key (archive_record_id, user_id)
  references public.pos_archive_records(id, user_id) on delete restrict not valid;
alter table public.pos_archive_records
  add constraint pos_tenant_archive_record_invoice_fk
  foreign key (invoice_id, user_id)
  references public.pos_invoices(id, user_id) on delete restrict not valid;
alter table public.pos_archive_replica_events
  add constraint pos_tenant_archive_replica_event_record_fk
  foreign key (archive_record_id, user_id)
  references public.pos_archive_records(id, user_id) on delete restrict not valid;
alter table public.pos_archive_replica_events
  add constraint pos_tenant_archive_replica_event_replica_fk
  foreign key (replica_id, user_id)
  references public.pos_archive_replicas(id, user_id) on delete restrict not valid;
alter table public.pos_archive_replicas
  add constraint pos_tenant_archive_replica_record_fk
  foreign key (archive_record_id, user_id)
  references public.pos_archive_records(id, user_id) on delete restrict not valid;
alter table public.pos_bank_transactions
  add constraint pos_tenant_bank_transaction_invoice_fk
  foreign key (confirmed_invoice_id, user_id)
  references public.pos_invoices(id, user_id) on delete restrict not valid;
alter table public.pos_bank_transactions
  add constraint pos_tenant_bank_transaction_payment_fk
  foreign key (confirmed_payment_id, user_id)
  references public.pos_payments(id, user_id) on delete restrict not valid;
alter table public.pos_bank_transactions
  add constraint pos_tenant_bank_transaction_import_fk
  foreign key (import_id, user_id)
  references public.pos_bank_imports(id, user_id) on delete restrict not valid;
alter table public.pos_datev_document_transfers
  add constraint pos_tenant_datev_transfer_archive_fk
  foreign key (archive_record_id, user_id)
  references public.pos_archive_records(id, user_id) on delete restrict not valid;
alter table public.pos_einvoice_documents
  add constraint pos_tenant_einvoice_document_invoice_fk
  foreign key (invoice_id, user_id)
  references public.pos_invoices(id, user_id) on delete restrict not valid;
alter table public.pos_einvoice_validation_events
  add constraint pos_tenant_einvoice_validation_document_fk
  foreign key (document_id, user_id)
  references public.pos_einvoice_documents(id, user_id) on delete restrict not valid;
alter table public.pos_invoice_adjustments
  add constraint pos_tenant_invoice_adjustment_invoice_fk
  foreign key (original_invoice_id, user_id)
  references public.pos_invoices(id, user_id) on delete restrict not valid;
alter table public.pos_invoice_deliveries
  add constraint pos_tenant_invoice_delivery_invoice_fk
  foreign key (invoice_id, user_id)
  references public.pos_invoices(id, user_id) on delete restrict not valid;
alter table public.pos_invoice_delivery_events
  add constraint pos_tenant_invoice_delivery_event_delivery_fk
  foreign key (delivery_id, user_id)
  references public.pos_invoice_deliveries(id, user_id) on delete restrict not valid;
alter table public.pos_invoice_documents
  add constraint pos_tenant_invoice_document_invoice_fk
  foreign key (invoice_id, user_id)
  references public.pos_invoices(id, user_id) on delete restrict not valid;
alter table public.pos_invoice_replacements
  add constraint pos_tenant_replacement_cancellation_fk
  foreign key (cancellation_adjustment_id, user_id)
  references public.pos_invoice_adjustments(id, user_id) on delete restrict not valid;
alter table public.pos_invoice_replacements
  add constraint pos_tenant_replacement_original_invoice_fk
  foreign key (original_invoice_id, user_id)
  references public.pos_invoices(id, user_id) on delete restrict not valid;
alter table public.pos_invoice_replacements
  add constraint pos_tenant_replacement_new_invoice_fk
  foreign key (replacement_invoice_id, user_id)
  references public.pos_invoices(id, user_id) on delete restrict not valid;
alter table public.pos_payment_events
  add constraint pos_tenant_payment_event_payment_fk
  foreign key (payment_id, user_id)
  references public.pos_payments(id, user_id) on delete restrict not valid;
alter table public.pos_payments
  add constraint pos_tenant_payment_invoice_fk
  foreign key (invoice_id, user_id)
  references public.pos_invoices(id, user_id) on delete restrict not valid;
alter table public.pos_payments
  add constraint pos_tenant_payment_bank_transaction_fk
  foreign key (source_bank_transaction_id, user_id)
  references public.pos_bank_transactions(id, user_id) on delete restrict not valid;
alter table public.pos_work_order_events
  add constraint pos_tenant_work_order_event_order_fk
  foreign key (work_order_id, user_id)
  references public.pos_work_orders(id, user_id) on delete restrict not valid;
alter table public.pos_work_order_invoices
  add constraint pos_tenant_work_order_invoice_invoice_fk
  foreign key (invoice_id, user_id)
  references public.pos_invoices(id, user_id) on delete restrict not valid;
alter table public.pos_work_order_invoices
  add constraint pos_tenant_work_order_invoice_order_fk
  foreign key (work_order_id, user_id)
  references public.pos_work_orders(id, user_id) on delete restrict not valid;

alter table public.pos_adjustment_documents validate constraint pos_tenant_adjustment_document_adjustment_fk;
alter table public.pos_archive_integrity_events validate constraint pos_tenant_archive_integrity_record_fk;
alter table public.pos_archive_records validate constraint pos_tenant_archive_record_invoice_fk;
alter table public.pos_archive_replica_events validate constraint pos_tenant_archive_replica_event_record_fk;
alter table public.pos_archive_replica_events validate constraint pos_tenant_archive_replica_event_replica_fk;
alter table public.pos_archive_replicas validate constraint pos_tenant_archive_replica_record_fk;
alter table public.pos_bank_transactions validate constraint pos_tenant_bank_transaction_invoice_fk;
alter table public.pos_bank_transactions validate constraint pos_tenant_bank_transaction_payment_fk;
alter table public.pos_bank_transactions validate constraint pos_tenant_bank_transaction_import_fk;
alter table public.pos_datev_document_transfers validate constraint pos_tenant_datev_transfer_archive_fk;
alter table public.pos_einvoice_documents validate constraint pos_tenant_einvoice_document_invoice_fk;
alter table public.pos_einvoice_validation_events validate constraint pos_tenant_einvoice_validation_document_fk;
alter table public.pos_invoice_adjustments validate constraint pos_tenant_invoice_adjustment_invoice_fk;
alter table public.pos_invoice_deliveries validate constraint pos_tenant_invoice_delivery_invoice_fk;
alter table public.pos_invoice_delivery_events validate constraint pos_tenant_invoice_delivery_event_delivery_fk;
alter table public.pos_invoice_documents validate constraint pos_tenant_invoice_document_invoice_fk;
alter table public.pos_invoice_replacements validate constraint pos_tenant_replacement_cancellation_fk;
alter table public.pos_invoice_replacements validate constraint pos_tenant_replacement_original_invoice_fk;
alter table public.pos_invoice_replacements validate constraint pos_tenant_replacement_new_invoice_fk;
alter table public.pos_payment_events validate constraint pos_tenant_payment_event_payment_fk;
alter table public.pos_payments validate constraint pos_tenant_payment_invoice_fk;
alter table public.pos_payments validate constraint pos_tenant_payment_bank_transaction_fk;
alter table public.pos_work_order_events validate constraint pos_tenant_work_order_event_order_fk;
alter table public.pos_work_order_invoices validate constraint pos_tenant_work_order_invoice_invoice_fk;
alter table public.pos_work_order_invoices validate constraint pos_tenant_work_order_invoice_order_fk;

;
