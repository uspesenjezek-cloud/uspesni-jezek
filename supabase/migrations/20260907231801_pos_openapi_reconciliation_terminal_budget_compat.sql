-- Forward compatibility after backfilling the previously missing 20260825130657.
-- Keep its exact reservation timestamp and consumed-at-claim budget semantics,
-- and preserve 20260826131305's SENT/succeeded terminal result. Applying an
-- older missing migration must never silently roll back this newer contract.
-- Dependencies: 20260825130657 and 20260826131305. No data backfill.

create or replace function private._pos_reconcile_openapi_invoice_event(
  p_provider_reference text,
  p_state text,
  p_external_status text,
  p_event_at timestamptz,
  p_sandbox boolean,
  p_checked_at timestamptz default now()
)
returns public.pos_invoice_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.pos_invoice_deliveries%rowtype;
  v_checked_at timestamptz := coalesce(p_checked_at, now());
  v_event_at timestamptz;
  v_terminal boolean;
begin
  if p_sandbox is null then raise exception 'Openapi način usklajevanja manjka.'; end if;
  if v_checked_at < now() - interval '1 hour' or v_checked_at > now() + interval '10 minutes' then
    raise exception 'Openapi čas preverjanja ni veljaven.';
  end if;

  select * into v_delivery from public.pos_invoice_deliveries
  where provider = 'openapi'
    and provider_reference = trim(p_provider_reference)
    and is_test = p_sandbox
    and status in ('sent', 'test_completed')
    and reconciliation_attempt_count between 1 and 7
    and last_reconciled_at = v_checked_at
  for update;
  if not found then return null; end if;
  v_event_at := coalesce(p_event_at, v_delivery.last_provider_event_at, v_checked_at);

  v_delivery := private._pos_apply_openapi_invoice_event(
    p_provider_reference, p_state, p_external_status, v_event_at, p_sandbox
  );
  if v_delivery.id is null then return null; end if;

  v_terminal := upper(trim(coalesce(p_state, ''))) in ('DONE', 'ERROR')
    or (
      upper(trim(coalesce(p_state, ''))) = 'SENT'
      and lower(trim(coalesce(p_external_status, ''))) = 'succeeded'
    );
  update public.pos_invoice_deliveries set
    last_reconciled_at = v_checked_at,
    reconcile_after = case
      when v_terminal or reconciliation_attempt_count >= 7 then null
      else v_checked_at + interval '6 hours'
    end,
    updated_at = now()
  where id = v_delivery.id
  returning * into v_delivery;

  return v_delivery;
end;
$$;

revoke all on function private._pos_reconcile_openapi_invoice_event(text,text,text,timestamptz,boolean,timestamptz)
  from public, anon, authenticated;
grant execute on function private._pos_reconcile_openapi_invoice_event(text,text,text,timestamptz,boolean,timestamptz)
  to service_role;

notify pgrst, 'reload schema';
