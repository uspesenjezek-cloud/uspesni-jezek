-- An original invoice must not be newly prepared, queued or dispatched after
-- a full cancellation or a withdrawal credit note. The financial adjustment
-- PDF remains available separately from the immutable original.

create or replace function private.pos_block_original_delivery_after_financial_adjustment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('test_prepared','queued','processing') and exists (
    select 1 from public.pos_invoice_adjustments adjustment
    where adjustment.original_invoice_id=new.invoice_id
      and adjustment.user_id=new.user_id
      and adjustment.adjustment_type in ('cancellation','credit_note')
  ) then
    raise exception 'Izvirnega računa po Stornu ali dobropisu ni dovoljeno pripraviti ali poslati.';
  end if;
  return new;
end;
$$;

revoke all on function private.pos_block_original_delivery_after_financial_adjustment()
  from public,anon,authenticated;
grant execute on function private.pos_block_original_delivery_after_financial_adjustment()
  to service_role;

create trigger pos_invoice_deliveries_block_after_financial_adjustment
before insert or update of status on public.pos_invoice_deliveries
for each row execute function private.pos_block_original_delivery_after_financial_adjustment();

notify pgrst, 'reload schema';
