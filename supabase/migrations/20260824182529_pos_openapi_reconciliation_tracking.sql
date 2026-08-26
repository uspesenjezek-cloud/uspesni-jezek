-- Track bounded Openapi delivery reconciliation without opening browser write access.
-- The provider GET endpoint is billable, so polling stops after seven checks or a
-- terminal DONE/ERROR state. The service-only wrapper applies the same monotonic
-- event rules as signed webhooks and records the next permitted check atomically.

alter table public.pos_invoice_deliveries
  add column if not exists last_reconciled_at timestamptz,
  add column if not exists reconcile_after timestamptz,
  add column if not exists reconciliation_attempt_count integer not null default 0;

alter table public.pos_invoice_deliveries
  drop constraint if exists pos_invoice_deliveries_reconciliation_attempt_count_check;
alter table public.pos_invoice_deliveries
  add constraint pos_invoice_deliveries_reconciliation_attempt_count_check
  check (reconciliation_attempt_count between 0 and 7);

create index if not exists pos_invoice_deliveries_openapi_reconcile_idx
  on public.pos_invoice_deliveries(is_test, reconcile_after, updated_at)
  where provider = 'openapi'
    and status in ('sent', 'test_completed')
    and provider_reference <> ''
    and reconciliation_attempt_count < 7;

create or replace function private.pos_reset_openapi_reconciliation_tracking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider = 'openapi'
     and new.status = 'queued'
     and (old.provider is distinct from 'openapi' or old.status not in ('queued', 'processing')) then
    new.last_reconciled_at := null;
    new.reconcile_after := null;
    new.reconciliation_attempt_count := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists pos_reset_openapi_reconciliation_tracking_trg
  on public.pos_invoice_deliveries;
create trigger pos_reset_openapi_reconciliation_tracking_trg
before update of provider, status on public.pos_invoice_deliveries
for each row execute function private.pos_reset_openapi_reconciliation_tracking();

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
  v_attempts integer;
  v_terminal boolean;
begin
  if v_checked_at < now() - interval '1 hour' or v_checked_at > now() + interval '10 minutes' then
    raise exception 'Openapi čas preverjanja ni veljaven.';
  end if;

  select * into v_delivery from public.pos_invoice_deliveries
  where provider = 'openapi'
    and provider_reference = trim(p_provider_reference)
    and is_test = p_sandbox
  for update;
  if not found then return null; end if;
  v_event_at := coalesce(p_event_at, v_delivery.last_provider_event_at, v_checked_at);

  v_delivery := private._pos_apply_openapi_invoice_event(
    p_provider_reference, p_state, p_external_status, v_event_at, p_sandbox
  );
  if v_delivery.id is null then return null; end if;

  v_attempts := least(7, coalesce(v_delivery.reconciliation_attempt_count, 0) + 1);
  v_terminal := upper(trim(coalesce(p_state, ''))) in ('DONE', 'ERROR');
  update public.pos_invoice_deliveries set
    last_reconciled_at = v_checked_at,
    reconciliation_attempt_count = v_attempts,
    reconcile_after = case
      when v_terminal or v_attempts >= 7 then null
      else v_checked_at + interval '6 hours'
    end,
    updated_at = now()
  where id = v_delivery.id
  returning * into v_delivery;

  return v_delivery;
end;
$$;

create or replace function public.pos_reconcile_openapi_invoice_event(
  p_provider_reference text,
  p_state text,
  p_external_status text,
  p_event_at timestamptz,
  p_sandbox boolean,
  p_checked_at timestamptz default now()
)
returns public.pos_invoice_deliveries
language sql
security definer
set search_path = ''
as $$
  select private._pos_reconcile_openapi_invoice_event(
    p_provider_reference, p_state, p_external_status, p_event_at, p_sandbox, p_checked_at
  );
$$;

revoke all on function private._pos_reconcile_openapi_invoice_event(text,text,text,timestamptz,boolean,timestamptz)
  from public, anon, authenticated;
revoke all on function public.pos_reconcile_openapi_invoice_event(text,text,text,timestamptz,boolean,timestamptz)
  from public, anon, authenticated;
grant execute on function private._pos_reconcile_openapi_invoice_event(text,text,text,timestamptz,boolean,timestamptz)
  to service_role;
grant execute on function public.pos_reconcile_openapi_invoice_event(text,text,text,timestamptz,boolean,timestamptz)
  to service_role;
revoke all on function private.pos_reset_openapi_reconciliation_tracking()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
