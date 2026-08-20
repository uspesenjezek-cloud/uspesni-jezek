-- finAPI sandbox prilivi uporabljajo isto nespremenljivo bančno sled kot ročni
-- CSV/camt.053 uvoz, vendar imajo lasten omejen RPC in jasno označen vir.

alter table public.pos_bank_imports
  drop constraint if exists pos_bank_imports_file_format_check;
alter table public.pos_bank_imports
  add constraint pos_bank_imports_file_format_check
  check (file_format in ('csv','camt053','finapi'));

create or replace function private._pos_import_finapi_transactions(
  p_batch_sha256 text,
  p_transactions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_import public.pos_bank_imports%rowtype;
  v_row jsonb;
  v_source_key text;
  v_external_reference text;
  v_inserted integer := 0;
  v_total integer := 0;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if coalesce(p_batch_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception 'Neveljaven prstni odtis finAPI sinhronizacije.'; end if;
  if jsonb_typeof(p_transactions) <> 'array' or jsonb_array_length(p_transactions) = 0 or jsonb_array_length(p_transactions) > 500 then
    raise exception 'finAPI sinhronizacija mora vsebovati od 1 do 500 prilivov.';
  end if;

  insert into public.pos_bank_imports(user_id,file_name,file_sha256,file_format)
  values (v_user,'finapi-' || to_char(current_date,'YYYY-MM-DD') || '.json',p_batch_sha256,'finapi')
  on conflict (user_id,file_sha256) do update set file_name = excluded.file_name
  returning * into v_import;

  for v_row in select value from jsonb_array_elements(p_transactions)
  loop
    v_total := v_total + 1;
    if jsonb_typeof(v_row) <> 'object' then raise exception 'Neveljaven finAPI zapis.'; end if;
    v_external_reference := left(trim(coalesce(v_row->>'external_reference','')),240);
    if v_external_reference !~ '^finapi:[0-9]+$' then raise exception 'Neveljaven finAPI identifikator transakcije.'; end if;
    v_source_key := 'tx:' || md5(concat_ws('|',
      upper(v_external_reference), coalesce(v_row->>'booked_on',''), coalesce(v_row->>'amount_cents',''),
      upper(replace(coalesce(v_row->>'counterparty_iban',''),' ','')),
      upper(trim(coalesce(v_row->>'counterparty_name',''))), upper(trim(coalesce(v_row->>'remittance_info','')))
    ));

    insert into public.pos_bank_transactions(
      user_id,import_id,source_key,external_reference,booked_on,amount_cents,currency,
      counterparty_name,counterparty_iban,remittance_info
    ) values (
      v_user,v_import.id,v_source_key,v_external_reference,(v_row->>'booked_on')::date,
      (v_row->>'amount_cents')::bigint,upper(coalesce(v_row->>'currency','EUR')),
      left(trim(coalesce(v_row->>'counterparty_name','')),240),
      left(upper(replace(coalesce(v_row->>'counterparty_iban',''),' ','')),34),
      left(trim(coalesce(v_row->>'remittance_info','')),500)
    ) on conflict (user_id,source_key) do nothing;
    if found then v_inserted := v_inserted + 1; end if;
  end loop;

  return jsonb_build_object(
    'import_id',v_import.id,
    'received_count',v_total,
    'inserted_count',v_inserted,
    'duplicate_count',v_total-v_inserted
  );
exception
  when invalid_text_representation or datetime_field_overflow or check_violation then
    raise exception 'finAPI vsebuje neveljaven datum, znesek ali valuto.';
end;
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
  select private._pos_import_finapi_transactions(p_batch_sha256,p_transactions);
$$;

revoke all on function private._pos_import_finapi_transactions(text,jsonb) from public, anon;
revoke all on function public.pos_import_finapi_transactions(text,jsonb) from public, anon;
grant execute on function private._pos_import_finapi_transactions(text,jsonb) to authenticated, service_role;
grant execute on function public.pos_import_finapi_transactions(text,jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
