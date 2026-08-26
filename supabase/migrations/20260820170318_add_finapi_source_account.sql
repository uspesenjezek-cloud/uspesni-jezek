-- finAPI lahko vrne dva na pogled enaka priliva z različnih uporabnikovih
-- računov. Izvorni račun ohranimo, da veljavnih plačil ne skrivamo kot dvojnike.

alter table public.pos_bank_transactions
  add column source_account_id text not null default ''
    check (char_length(source_account_id) <= 64),
  add column source_account_name text not null default ''
    check (char_length(source_account_name) <= 240),
  add column source_account_iban text not null default ''
    check (char_length(source_account_iban) <= 34);

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
  v_source_account_id text;
  v_source_account_name text;
  v_source_account_iban text;
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
    v_source_account_id := left(trim(coalesce(v_row->>'source_account_id','')),64);
    if v_source_account_id <> '' and v_source_account_id !~ '^[0-9]+$' then raise exception 'Neveljaven finAPI identifikator računa.'; end if;
    v_source_account_name := left(trim(coalesce(v_row->>'source_account_name','')),240);
    v_source_account_iban := left(upper(replace(coalesce(v_row->>'source_account_iban',''),' ','')),34);
    if v_source_account_iban <> '' and v_source_account_iban !~ '^[A-Z]{2}[0-9A-Z]{13,32}$' then raise exception 'Neveljaven IBAN izvornega računa.'; end if;
    v_source_key := 'tx:' || md5(concat_ws('|',
      upper(v_external_reference), coalesce(v_row->>'booked_on',''), coalesce(v_row->>'amount_cents',''),
      upper(replace(coalesce(v_row->>'counterparty_iban',''),' ','')),
      upper(trim(coalesce(v_row->>'counterparty_name',''))), upper(trim(coalesce(v_row->>'remittance_info','')))
    ));

    insert into public.pos_bank_transactions(
      user_id,import_id,source_key,external_reference,booked_on,amount_cents,currency,
      counterparty_name,counterparty_iban,remittance_info,
      source_account_id,source_account_name,source_account_iban
    ) values (
      v_user,v_import.id,v_source_key,v_external_reference,(v_row->>'booked_on')::date,
      (v_row->>'amount_cents')::bigint,upper(coalesce(v_row->>'currency','EUR')),
      left(trim(coalesce(v_row->>'counterparty_name','')),240),
      left(upper(replace(coalesce(v_row->>'counterparty_iban',''),' ','')),34),
      left(trim(coalesce(v_row->>'remittance_info','')),500),
      v_source_account_id,v_source_account_name,v_source_account_iban
    ) on conflict (user_id,source_key) do nothing;
    if found then
      v_inserted := v_inserted + 1;
    else
      update public.pos_bank_transactions
      set source_account_id = v_source_account_id,
          source_account_name = v_source_account_name,
          source_account_iban = v_source_account_iban
      where user_id = v_user and source_key = v_source_key
        and (source_account_id,source_account_name,source_account_iban)
          is distinct from (v_source_account_id,v_source_account_name,v_source_account_iban);
    end if;
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

notify pgrst, 'reload schema';

;
