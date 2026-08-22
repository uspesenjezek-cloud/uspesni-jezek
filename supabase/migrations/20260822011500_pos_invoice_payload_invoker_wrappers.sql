-- Keep PostgREST entry points SECURITY INVOKER. A validated bridge lives in the
-- non-exposed private schema, so clients cannot bypass the payload guard by
-- calling the privileged core issuance functions directly.

create or replace function private._pos_issue_invoice_validated(
  p_draft_id uuid,
  p_payload jsonb,
  p_final_confirmed boolean,
  p_einvoice_validated boolean default false
)
returns public.pos_invoices
language sql
security definer
set search_path = ''
as $$
  select private._pos_issue_invoice(
    p_draft_id,
    private.pos_validate_invoice_payload(
      p_payload || jsonb_build_object(
        'seller_contact_phone',
        coalesce((select business_phone from public.pos_business_profiles where user_id = (select auth.uid())), '')
      )
    ),
    p_final_confirmed,
    true
  );
$$;

create or replace function private._pos_issue_replacement_invoice_validated(
  p_draft_id uuid,
  p_payload jsonb,
  p_final_confirmed boolean,
  p_einvoice_validated boolean default false,
  p_cancellation_adjustment_id uuid default null
)
returns public.pos_invoices
language sql
security definer
set search_path = ''
as $$
  select private._pos_issue_replacement_invoice(
    p_draft_id,
    private.pos_validate_invoice_payload(
      p_payload || jsonb_build_object(
        'seller_contact_phone',
        coalesce((select business_phone from public.pos_business_profiles where user_id = (select auth.uid())), '')
      )
    ),
    p_final_confirmed,
    true,
    p_cancellation_adjustment_id
  );
$$;

create or replace function public.pos_issue_invoice(
  p_draft_id uuid,
  p_payload jsonb,
  p_final_confirmed boolean,
  p_einvoice_validated boolean default false
)
returns public.pos_invoices
language sql
security invoker
set search_path = ''
as $$
  select private._pos_issue_invoice_validated(
    p_draft_id,
    p_payload,
    p_final_confirmed,
    p_einvoice_validated
  );
$$;

create or replace function public.pos_issue_replacement_invoice(
  p_draft_id uuid,
  p_payload jsonb,
  p_final_confirmed boolean,
  p_einvoice_validated boolean default false,
  p_cancellation_adjustment_id uuid default null
)
returns public.pos_invoices
language sql
security invoker
set search_path = ''
as $$
  select private._pos_issue_replacement_invoice_validated(
    p_draft_id,
    p_payload,
    p_final_confirmed,
    p_einvoice_validated,
    p_cancellation_adjustment_id
  );
$$;

revoke all on function private._pos_issue_invoice_validated(uuid,jsonb,boolean,boolean) from public, anon;
revoke all on function private._pos_issue_replacement_invoice_validated(uuid,jsonb,boolean,boolean,uuid) from public, anon;
grant execute on function private._pos_issue_invoice_validated(uuid,jsonb,boolean,boolean) to authenticated, service_role;
grant execute on function private._pos_issue_replacement_invoice_validated(uuid,jsonb,boolean,boolean,uuid) to authenticated, service_role;

revoke all on function public.pos_issue_invoice(uuid,jsonb,boolean,boolean) from public, anon;
revoke all on function public.pos_issue_replacement_invoice(uuid,jsonb,boolean,boolean,uuid) from public, anon;
grant execute on function public.pos_issue_invoice(uuid,jsonb,boolean,boolean) to authenticated, service_role;
grant execute on function public.pos_issue_replacement_invoice(uuid,jsonb,boolean,boolean,uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
