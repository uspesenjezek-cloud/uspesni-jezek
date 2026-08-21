-- The browser is not a durable job runner. If it closes after the immutable
-- invoice/adjustment row is issued but before its PDF is archived, the daily
-- archive worker must be able to find and repair the missing original.
create or replace function public.pos_archive_missing_document_batch(p_limit integer default 2)
returns table (
  source_table text,
  source_id uuid,
  user_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  select candidates.source_table, candidates.source_id, candidates.user_id
  from (
    select
      'pos_invoices'::text as source_table,
      invoice.id as source_id,
      invoice.user_id,
      invoice.issued_at
    from public.pos_invoices invoice
    where not exists (
      select 1
      from public.pos_invoice_documents document
      where document.invoice_id = invoice.id
    )

    union all

    select
      'pos_invoice_adjustments'::text as source_table,
      adjustment.id as source_id,
      adjustment.user_id,
      adjustment.issued_at
    from public.pos_invoice_adjustments adjustment
    where not exists (
      select 1
      from public.pos_adjustment_documents document
      where document.adjustment_id = adjustment.id
    )
  ) candidates
  order by candidates.issued_at asc, candidates.source_id asc
  limit least(greatest(coalesce(p_limit, 2), 1), 10);
$$;

revoke all on function public.pos_archive_missing_document_batch(integer)
  from public, anon, authenticated;
grant execute on function public.pos_archive_missing_document_batch(integer)
  to service_role;

notify pgrst, 'reload schema';
