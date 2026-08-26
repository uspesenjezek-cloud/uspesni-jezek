-- Locked offers and accepted consumer contracts are committed before their
-- PDFs are generated. If the browser closes in that gap, recover them in the
-- same durable worker that already repairs invoice and adjustment originals.

create or replace function public.pos_archive_missing_document_batch(p_limit integer default 2)
returns table(source_table text, source_id uuid, user_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select candidates.source_table, candidates.source_id, candidates.user_id
  from (
    select 'pos_invoices'::text source_table, invoice.id source_id,
      invoice.user_id, invoice.issued_at created_at,
      case when invoice.is_test then 1 else 0 end priority
    from public.pos_invoices invoice
    where not exists (
      select 1 from public.pos_invoice_documents document
      where document.invoice_id = invoice.id and document.user_id = invoice.user_id
    )

    union all

    select 'pos_invoice_adjustments'::text, adjustment.id,
      adjustment.user_id, adjustment.issued_at,
      case when invoice.is_test then 1 else 0 end
    from public.pos_invoice_adjustments adjustment
    join public.pos_invoices invoice
      on invoice.id = adjustment.original_invoice_id
     and invoice.user_id = adjustment.user_id
    where not exists (
      select 1 from public.pos_adjustment_documents document
      where document.adjustment_id = adjustment.id and document.user_id = adjustment.user_id
    )

    union all

    select 'pos_invoice_adjustment_xrechnung'::text, adjustment.id,
      adjustment.user_id, adjustment.issued_at,
      case when invoice.is_test then 1 else 0 end
    from public.pos_invoice_adjustments adjustment
    join public.pos_invoices invoice
      on invoice.id = adjustment.original_invoice_id
     and invoice.user_id = adjustment.user_id
    where adjustment.adjustment_type in ('correction','cancellation')
      and invoice.customer_type in ('business','public')
      and exists (
        select 1 from public.pos_einvoice_documents document
        where document.invoice_id = invoice.id and document.user_id = invoice.user_id
      )
      and not exists (
        select 1 from public.pos_adjustment_einvoice_documents document
        where document.adjustment_id = adjustment.id and document.user_id = adjustment.user_id
      )

    union all

    select 'pos_work_order_offer'::text, work_order.id,
      work_order.user_id, work_order.offered_at,
      case when work_order.is_test then 1 else 0 end
    from public.pos_work_orders work_order
    where work_order.offered_at is not null
      and work_order.status <> 'draft'
      and not exists (
        select 1 from public.pos_offer_documents document
        where document.work_order_id = work_order.id and document.user_id = work_order.user_id
      )

    union all

    select 'pos_work_order_contract_confirmation'::text, work_order.id,
      work_order.user_id, acceptance.recorded_at,
      case when work_order.is_test then 1 else 0 end
    from public.pos_work_orders work_order
    join public.pos_work_order_acceptances acceptance
      on acceptance.work_order_id = work_order.id
     and acceptance.user_id = work_order.user_id
    where work_order.locked_payload->>'customer_type' = 'private'
      and work_order.locked_payload->>'consumer_contract_context'
        in ('distance','off_premises','urgent_repair')
      and not exists (
        select 1 from public.pos_contract_confirmation_documents document
        where document.work_order_id = work_order.id and document.user_id = work_order.user_id
      )
  ) candidates
  order by candidates.priority, candidates.created_at, candidates.source_id
  limit least(greatest(coalesce(p_limit, 2), 1), 10);
$$;

create or replace function private.pos_archive_production_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select configuration.independent_backup_ready
      and configuration.worm_provider_ready
      and configuration.worm_provider = 'aws_s3_object_lock'
      and configuration.worm_environment = 'production'
      and configuration.worm_object_lock_mode = 'COMPLIANCE'
      and configuration.worm_connectivity_tested_at >= now() - interval '30 days'
      and configuration.recovery_tested_at >= now() - interval '365 days'
      and exists (
        select 1 from public.pos_archive_replicas replica
        where replica.status = 'verified'
          and replica.object_lock_mode = 'COMPLIANCE'
          and replica.verified_at >= now() - interval '90 days'
      )
      and not exists (
        select 1 from public.pos_invoices invoice
        where not invoice.is_test and not exists (
          select 1 from public.pos_invoice_documents document
          where document.invoice_id = invoice.id and document.user_id = invoice.user_id
        )
      )
      and not exists (
        select 1
        from public.pos_invoice_adjustments adjustment
        join public.pos_invoices invoice
          on invoice.id = adjustment.original_invoice_id
         and invoice.user_id = adjustment.user_id
        where not invoice.is_test and not exists (
          select 1 from public.pos_adjustment_documents document
          where document.adjustment_id = adjustment.id and document.user_id = adjustment.user_id
        )
      )
      and not exists (
        select 1
        from public.pos_invoice_adjustments adjustment
        join public.pos_invoices invoice
          on invoice.id = adjustment.original_invoice_id
         and invoice.user_id = adjustment.user_id
        where not invoice.is_test
          and adjustment.adjustment_type in ('correction','cancellation')
          and invoice.customer_type in ('business','public')
          and exists (
            select 1 from public.pos_einvoice_documents document
            where document.invoice_id = invoice.id and document.user_id = invoice.user_id
          )
          and not exists (
            select 1 from public.pos_adjustment_einvoice_documents document
            where document.adjustment_id = adjustment.id and document.user_id = adjustment.user_id
          )
      )
      and not exists (
        select 1 from public.pos_work_orders work_order
        where not work_order.is_test
          and work_order.offered_at is not null
          and work_order.status <> 'draft'
          and not exists (
            select 1 from public.pos_offer_documents document
            where document.work_order_id = work_order.id and document.user_id = work_order.user_id
          )
      )
      and not exists (
        select 1
        from public.pos_work_orders work_order
        join public.pos_work_order_acceptances acceptance
          on acceptance.work_order_id = work_order.id
         and acceptance.user_id = work_order.user_id
        where not work_order.is_test
          and work_order.locked_payload->>'customer_type' = 'private'
          and work_order.locked_payload->>'consumer_contract_context'
            in ('distance','off_premises','urgent_repair')
          and not exists (
            select 1 from public.pos_contract_confirmation_documents document
            where document.work_order_id = work_order.id and document.user_id = work_order.user_id
          )
      )
      and not exists (
        select 1 from public.pos_archive_records record
        where not record.is_test and not exists (
          select 1 from public.pos_archive_replicas replica
          where replica.archive_record_id = record.id
            and replica.status = 'verified'
            and replica.object_lock_mode = 'COMPLIANCE'
            and replica.remote_checksum_sha256 = record.sha256
            and replica.remote_byte_size = record.byte_size
            and replica.retain_until >= (
              record.retention_not_before::timestamptz + interval '1 day' - interval '1 millisecond'
            )
        )
      )
    from private.pos_archive_configuration configuration
    where configuration.singleton
  ), false);
$$;

revoke all on function public.pos_archive_missing_document_batch(integer)
  from public, anon, authenticated;
grant execute on function public.pos_archive_missing_document_batch(integer)
  to service_role;
revoke all on function private.pos_archive_production_ready()
  from public, anon, authenticated;
grant execute on function private.pos_archive_production_ready()
  to service_role;

notify pgrst, 'reload schema';
