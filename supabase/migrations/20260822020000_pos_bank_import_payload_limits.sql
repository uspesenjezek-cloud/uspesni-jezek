-- Bound and type-check bank batches before privileged import functions create
-- import rows or calculate transaction fingerprints. This covers both manual
-- CSV/camt.053 uploads and the finAPI sandbox adapter.

create or replace function private.pos_validate_bank_transaction_batch(
  p_transactions jsonb,
  p_max_count integer,
  p_max_bytes integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
  v_amount numeric;
begin
  if p_max_count not between 1 and 2000 or p_max_bytes not between 1024 and 4194304 then
    raise exception 'Neveljavna omejitev bančnega uvoza.';
  end if;
  if p_transactions is null or jsonb_typeof(p_transactions) <> 'array'
     or jsonb_array_length(p_transactions) not between 1 and p_max_count then
    raise exception 'Bančni uvoz nima veljavnega števila prilivov.';
  end if;
  if octet_length(p_transactions::text) > p_max_bytes then
    raise exception 'Bančni uvoz presega dovoljeno velikost.';
  end if;

  for v_row in select value from jsonb_array_elements(p_transactions) loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'Neveljaven zapis bančne transakcije.';
    end if;
    if jsonb_typeof(v_row->'booked_on') <> 'string'
       or coalesce(v_row->>'booked_on', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Bančna transakcija nima veljavnega datuma.';
    end if;
    if jsonb_typeof(v_row->'amount_cents') not in ('number', 'string')
       or char_length(coalesce(v_row->>'amount_cents', '')) not between 1 and 19
       or coalesce(v_row->>'amount_cents', '') !~ '^[0-9]+$' then
      raise exception 'Bančna transakcija nima veljavnega zneska.';
    end if;
    begin
      v_amount := (v_row->>'amount_cents')::numeric;
    exception when others then
      raise exception 'Bančna transakcija nima veljavnega zneska.';
    end;
    if v_amount < 1 or v_amount > 9223372036854775807 then
      raise exception 'Bančna transakcija nima veljavnega zneska.';
    end if;
    if v_row ? 'currency' and (
         jsonb_typeof(v_row->'currency') <> 'string'
         or upper(v_row->>'currency') <> 'EUR'
       ) then raise exception 'Bančni uvoz podpira samo EUR.'; end if;
    if v_row ? 'external_reference' and (
         jsonb_typeof(v_row->'external_reference') <> 'string'
         or char_length(v_row->>'external_reference') > 240
       ) then raise exception 'Referenca bančne transakcije je predolga.'; end if;
    if v_row ? 'counterparty_name' and (
         jsonb_typeof(v_row->'counterparty_name') <> 'string'
         or char_length(v_row->>'counterparty_name') > 240
       ) then raise exception 'Naziv plačnika je predolg.'; end if;
    if v_row ? 'counterparty_iban' and (
         jsonb_typeof(v_row->'counterparty_iban') <> 'string'
         or char_length(v_row->>'counterparty_iban') > 80
       ) then raise exception 'IBAN plačnika je predolg.'; end if;
    if v_row ? 'remittance_info' and (
         jsonb_typeof(v_row->'remittance_info') <> 'string'
         or char_length(v_row->>'remittance_info') > 500
       ) then raise exception 'Namen nakazila je predolg.'; end if;
  end loop;

  return p_transactions;
end;
$$;

create or replace function private._pos_import_bank_transactions_validated(
  p_file_name text,
  p_file_sha256 text,
  p_file_format text,
  p_transactions jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private._pos_import_bank_transactions(
    p_file_name,
    p_file_sha256,
    p_file_format,
    private.pos_validate_bank_transaction_batch(p_transactions, 2000, 4194304)
  );
$$;

create or replace function private._pos_import_finapi_transactions_validated(
  p_batch_sha256 text,
  p_transactions jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private._pos_import_finapi_transactions(
    p_batch_sha256,
    private.pos_validate_bank_transaction_batch(p_transactions, 500, 2097152)
  );
$$;

create or replace function public.pos_import_bank_transactions(
  p_file_name text,
  p_file_sha256 text,
  p_file_format text,
  p_transactions jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private._pos_import_bank_transactions_validated(
    p_file_name, p_file_sha256, p_file_format, p_transactions
  );
$$;

create or replace function public.pos_import_finapi_transactions(
  p_batch_sha256 text,
  p_transactions jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private._pos_import_finapi_transactions_validated(p_batch_sha256, p_transactions);
$$;

revoke all on function private.pos_validate_bank_transaction_batch(jsonb,integer,integer) from public, anon, authenticated;
grant execute on function private.pos_validate_bank_transaction_batch(jsonb,integer,integer) to service_role;

revoke execute on function private._pos_import_bank_transactions(text,text,text,jsonb) from authenticated;
revoke execute on function private._pos_import_finapi_transactions(text,jsonb) from authenticated;
revoke all on function private._pos_import_bank_transactions_validated(text,text,text,jsonb) from public, anon;
revoke all on function private._pos_import_finapi_transactions_validated(text,jsonb) from public, anon;
grant execute on function private._pos_import_bank_transactions_validated(text,text,text,jsonb) to authenticated, service_role;
grant execute on function private._pos_import_finapi_transactions_validated(text,jsonb) to authenticated, service_role;

revoke all on function public.pos_import_bank_transactions(text,text,text,jsonb) from public, anon;
revoke all on function public.pos_import_finapi_transactions(text,jsonb) from public, anon;
grant execute on function public.pos_import_bank_transactions(text,text,text,jsonb) to authenticated, service_role;
grant execute on function public.pos_import_finapi_transactions(text,jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
