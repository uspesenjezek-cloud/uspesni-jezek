-- Corrections and cancellations become immutable accounting records. Reject
-- oversized or non-scalar changes before the privileged numbering function
-- locks the profile or copies invoice snapshots into the adjustment trail.

create or replace function private.pos_validate_adjustment_changes(
  p_adjustment_type text,
  p_reason text,
  p_changes jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
begin
  if p_adjustment_type is null or p_adjustment_type not in ('correction', 'cancellation') then
    raise exception 'Neveljavna vrsta popravka.';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 5 and 500 then
    raise exception 'Razlog mora vsebovati od 5 do 500 znakov.';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'Popravljeni podatki niso veljavni.';
  end if;
  if octet_length(p_changes::text) > 65536 then
    raise exception 'Popravek presega dovoljeno velikost.';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_changes) loop
    if v_key not in (
      'customer_name', 'customer_street', 'customer_postal_code', 'customer_city',
      'customer_vat_id', 'service_date', 'due_date', 'buyer_reference',
      'leitweg_id', 'work_description'
    ) then
      raise exception 'Popravek vsebuje nedovoljeno polje.';
    end if;
    if jsonb_typeof(v_value) <> 'string' then
      raise exception 'Popravljeni podatki morajo biti besedilo ali datum.';
    end if;
  end loop;

  return p_changes;
end;
$$;

alter table public.pos_invoice_adjustments
  add constraint pos_invoice_adjustments_changes_size_check
  check (octet_length(changes::text) <= 65536) not valid;
alter table public.pos_invoice_adjustments
  validate constraint pos_invoice_adjustments_changes_size_check;

alter table public.pos_invoice_adjustments
  add constraint pos_invoice_adjustments_snapshot_size_check
  check (octet_length(snapshot::text) <= 2097152) not valid;
alter table public.pos_invoice_adjustments
  validate constraint pos_invoice_adjustments_snapshot_size_check;

create or replace function private._pos_create_invoice_adjustment_validated(
  p_invoice_id uuid,
  p_adjustment_type text,
  p_reason text,
  p_changes jsonb default '{}'::jsonb,
  p_confirmed boolean default false
)
returns public.pos_invoice_adjustments
language sql
security definer
set search_path = ''
as $$
  select private._pos_create_invoice_adjustment(
    p_invoice_id,
    p_adjustment_type,
    p_reason,
    private.pos_validate_adjustment_changes(p_adjustment_type, p_reason, p_changes),
    p_confirmed
  );
$$;

create or replace function public.pos_create_invoice_adjustment(
  p_invoice_id uuid,
  p_adjustment_type text,
  p_reason text,
  p_changes jsonb default '{}'::jsonb,
  p_confirmed boolean default false
)
returns public.pos_invoice_adjustments
language sql
security invoker
set search_path = ''
as $$
  select private._pos_create_invoice_adjustment_validated(
    p_invoice_id, p_adjustment_type, p_reason, p_changes, p_confirmed
  );
$$;

revoke all on function private.pos_validate_adjustment_changes(text,text,jsonb) from public, anon, authenticated;
grant execute on function private.pos_validate_adjustment_changes(text,text,jsonb) to service_role;

revoke execute on function private._pos_create_invoice_adjustment(uuid,text,text,jsonb,boolean) from authenticated;
revoke all on function private._pos_create_invoice_adjustment_validated(uuid,text,text,jsonb,boolean) from public, anon;
grant execute on function private._pos_create_invoice_adjustment_validated(uuid,text,text,jsonb,boolean) to authenticated, service_role;

revoke all on function public.pos_create_invoice_adjustment(uuid,text,text,jsonb,boolean) from public, anon;
grant execute on function public.pos_create_invoice_adjustment(uuid,text,text,jsonb,boolean) to authenticated, service_role;

notify pgrst, 'reload schema';

;
