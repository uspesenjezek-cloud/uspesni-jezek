create or replace function public.pos_archive_missing_document_batch(p_limit integer default 2)
returns table(source_table text,source_id uuid,user_id uuid)
language sql stable security invoker set search_path=''
as $$
  select candidates.source_table,candidates.source_id,candidates.user_id
  from (
    select 'pos_invoices'::text source_table,i.id source_id,i.user_id,i.issued_at
    from public.pos_invoices i
    where not exists(select 1 from public.pos_invoice_documents d where d.invoice_id=i.id)
    union all
    select 'pos_invoice_adjustments'::text,a.id,a.user_id,a.issued_at
    from public.pos_invoice_adjustments a
    where not exists(select 1 from public.pos_adjustment_documents d where d.adjustment_id=a.id)
    union all
    select 'pos_invoice_adjustment_xrechnung'::text,a.id,a.user_id,a.issued_at
    from public.pos_invoice_adjustments a
    join public.pos_invoices i on i.id=a.original_invoice_id and i.user_id=a.user_id
    where a.adjustment_type in ('correction','cancellation')
      and i.customer_type in ('business','public')
      and exists(select 1 from public.pos_einvoice_documents d where d.invoice_id=i.id)
      and not exists(select 1 from public.pos_adjustment_einvoice_documents d where d.adjustment_id=a.id)
  ) candidates
  order by candidates.issued_at,candidates.source_id
  limit least(greatest(coalesce(p_limit,2),1),10);
$$;
revoke all on function public.pos_archive_missing_document_batch(integer) from public,anon,authenticated;
grant execute on function public.pos_archive_missing_document_batch(integer) to service_role;
notify pgrst,'reload schema';

;
