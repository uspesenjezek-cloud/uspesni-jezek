-- The 2027 German B2B transition depends on the issuer's prior-year turnover.
-- That decision must use the profile state at invoice issuance, not a later
-- mutable profile value that could retroactively loosen the delivery format.

alter table public.pos_invoices
  add column seller_previous_year_turnover_band text;

alter table public.pos_invoices
  add constraint pos_invoices_seller_turnover_band_check
  check (
    seller_previous_year_turnover_band is null
    or seller_previous_year_turnover_band in ('unknown', 'lte_800k', 'gt_800k')
  ) not valid;

create or replace function private.pos_capture_invoice_einvoice_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select previous_year_turnover_band
  into new.seller_previous_year_turnover_band
  from public.pos_business_profiles
  where user_id = new.user_id;

  new.seller_previous_year_turnover_band :=
    coalesce(new.seller_previous_year_turnover_band, 'unknown');
  return new;
end;
$$;

revoke all on function private.pos_capture_invoice_einvoice_context()
  from public, anon, authenticated;
grant execute on function private.pos_capture_invoice_einvoice_context()
  to service_role;

create trigger pos_invoices_capture_einvoice_context
before insert on public.pos_invoices
for each row execute function private.pos_capture_invoice_einvoice_context();

create or replace function private.pos_invoice_pdf_delivery_allowed(
  p_invoice_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when invoice.customer_type <> 'business' then true
      when invoice.tax_mode = 'small_business' then true
      when invoice.gross_cents <= 25000 and invoice.tax_mode <> 'reverse_charge' then true
      when invoice.service_date < date '2027-01-01' then true
      when invoice.service_date < date '2028-01-01'
        and invoice.seller_previous_year_turnover_band = 'lte_800k' then true
      else false
    end
    from public.pos_invoices as invoice
    where invoice.id = p_invoice_id and invoice.user_id = p_user_id
  ), false);
$$;

revoke all on function private.pos_invoice_pdf_delivery_allowed(uuid,uuid)
  from public, anon, authenticated;
grant execute on function private.pos_invoice_pdf_delivery_allowed(uuid,uuid)
  to service_role;

alter table public.pos_invoices
  validate constraint pos_invoices_seller_turnover_band_check;

;
