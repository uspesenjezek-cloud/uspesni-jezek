-- Bančni uvoz in ročno potrjeno usklajevanje nakazil z izdanimi računi.
-- Datoteka in posamezna transakcija sta idempotentni; plačilo nastane samo
-- skozi RPC, ki znova preveri lastništvo, preostanek in podvojitev.

create table public.pos_bank_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 240),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  file_format text not null check (file_format in ('csv','camt053')),
  imported_at timestamptz not null default now(),
  unique (user_id, file_sha256)
);
create table public.pos_bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_id uuid not null references public.pos_bank_imports(id) on delete restrict,
  source_key text not null check (char_length(source_key) between 1 and 160),
  external_reference text not null default '' check (char_length(external_reference) <= 240),
  booked_on date not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  counterparty_name text not null default '' check (char_length(counterparty_name) <= 240),
  counterparty_iban text not null default '' check (char_length(counterparty_iban) <= 34),
  remittance_info text not null default '' check (char_length(remittance_info) <= 500),
  status text not null default 'unmatched' check (status in ('unmatched','confirmed')),
  confirmed_invoice_id uuid references public.pos_invoices(id) on delete restrict,
  confirmed_payment_id uuid references public.pos_payments(id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source_key),
  check (
    (status = 'unmatched' and confirmed_invoice_id is null and confirmed_payment_id is null and confirmed_at is null)
    or
    (status = 'confirmed' and confirmed_invoice_id is not null and confirmed_payment_id is not null and confirmed_at is not null)
  )
);
alter table public.pos_payments
  add column source_bank_transaction_id uuid references public.pos_bank_transactions(id) on delete restrict;
-- Bančni vir sme povezati samo potrditveni RPC. Običajna ročna plačila ostanejo dovoljena.
drop policy pos_payment_insert_own on public.pos_payments;
create policy pos_payment_insert_own on public.pos_payments
  for insert to authenticated with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
    and source_bank_transaction_id is null
    and exists (
      select 1 from public.pos_invoices i
      where i.id = invoice_id and i.user_id = (select auth.uid())
    )
  );
create unique index pos_payments_bank_transaction_uidx
  on public.pos_payments(source_bank_transaction_id)
  where source_bank_transaction_id is not null;
create index pos_bank_imports_user_imported_idx on public.pos_bank_imports(user_id, imported_at desc);
create index pos_bank_transactions_import_idx on public.pos_bank_transactions(import_id);
create index pos_bank_transactions_user_status_booked_idx on public.pos_bank_transactions(user_id, status, booked_on desc);
create index pos_bank_transactions_confirmed_invoice_idx on public.pos_bank_transactions(confirmed_invoice_id)
  where confirmed_invoice_id is not null;
create index pos_bank_transactions_confirmed_payment_idx on public.pos_bank_transactions(confirmed_payment_id)
  where confirmed_payment_id is not null;
alter table public.pos_bank_imports enable row level security;
alter table public.pos_bank_transactions enable row level security;
revoke all on table public.pos_bank_imports, public.pos_bank_transactions from public, anon, authenticated;
grant select on table public.pos_bank_imports, public.pos_bank_transactions to authenticated;
grant all on table public.pos_bank_imports, public.pos_bank_transactions to service_role;
create policy pos_bank_imports_select_own on public.pos_bank_imports
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_bank_transactions_select_own on public.pos_bank_transactions
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create or replace function private._pos_import_bank_transactions(
  p_file_name text,
  p_file_sha256 text,
  p_file_format text,
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
  if char_length(trim(coalesce(p_file_name,''))) not between 1 and 240 then raise exception 'Neveljavno ime datoteke.'; end if;
  if coalesce(p_file_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception 'Neveljaven prstni odtis datoteke.'; end if;
  if p_file_format not in ('csv','camt053') then raise exception 'Nepodprt bančni format.'; end if;
  if jsonb_typeof(p_transactions) <> 'array' or jsonb_array_length(p_transactions) = 0 or jsonb_array_length(p_transactions) > 2000 then
    raise exception 'Bančni izpisek mora vsebovati od 1 do 2000 prilivov.';
  end if;

  insert into public.pos_bank_imports(user_id,file_name,file_sha256,file_format)
  values (v_user,trim(p_file_name),p_file_sha256,p_file_format)
  on conflict (user_id,file_sha256) do update set file_name = excluded.file_name
  returning * into v_import;

  for v_row in select value from jsonb_array_elements(p_transactions)
  loop
    v_total := v_total + 1;
    if jsonb_typeof(v_row) <> 'object' then raise exception 'Neveljaven zapis bančne transakcije.'; end if;
    v_external_reference := left(trim(coalesce(v_row->>'external_reference','')),240);
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
    raise exception 'Bančni izpisek vsebuje neveljaven datum, znesek ali valuto.';
end;
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
  select private._pos_import_bank_transactions(p_file_name,p_file_sha256,p_file_format,p_transactions);
$$;
create or replace function private._pos_confirm_bank_transaction(
  p_transaction_id uuid,
  p_invoice_id uuid,
  p_confirmed boolean default false
)
returns public.pos_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_transaction public.pos_bank_transactions%rowtype;
  v_invoice public.pos_invoices%rowtype;
  v_payment public.pos_payments%rowtype;
  v_paid bigint;
  v_cancelled boolean;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if not coalesce(p_confirmed,false) then raise exception 'Potrditev uporabnika je obvezna.'; end if;

  select * into v_transaction from public.pos_bank_transactions
  where id = p_transaction_id and user_id = v_user for update;
  if not found then raise exception 'Bančna transakcija ne obstaja.'; end if;
  if v_transaction.status = 'confirmed' then raise exception 'Ta bančna transakcija je že potrjena.'; end if;

  select * into v_invoice from public.pos_invoices
  where id = p_invoice_id and user_id = v_user for update;
  if not found then raise exception 'Račun ne obstaja.'; end if;
  select exists(
    select 1 from public.pos_invoice_adjustments
    where original_invoice_id = v_invoice.id and user_id = v_user and adjustment_type = 'cancellation'
  ) into v_cancelled;
  if v_cancelled then raise exception 'Storniranega računa ni mogoče uskladiti.'; end if;

  select coalesce(sum(amount_cents),0) into v_paid
  from public.pos_payments where invoice_id = v_invoice.id and user_id = v_user;
  if v_paid >= v_invoice.gross_cents then raise exception 'Račun je že v celoti plačan.'; end if;
  if v_transaction.amount_cents > v_invoice.gross_cents - v_paid then
    raise exception 'Priliv presega odprti znesek računa. Potrebna je ročna obravnava preplačila.';
  end if;

  insert into public.pos_payments(
    user_id,invoice_id,amount_cents,currency,method,provider_reference,paid_at,source_bank_transaction_id
  ) values (
    v_user,v_invoice.id,v_transaction.amount_cents,v_transaction.currency,'bank_transfer',
    coalesce(nullif(v_transaction.external_reference,''),v_transaction.source_key),
    v_transaction.booked_on::timestamptz,v_transaction.id
  ) returning * into v_payment;

  update public.pos_bank_transactions set
    status = 'confirmed', confirmed_invoice_id = v_invoice.id,
    confirmed_payment_id = v_payment.id, confirmed_at = now()
  where id = v_transaction.id;

  insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
  values (v_user,'payment',v_payment.id,'bank_payment_confirmed',jsonb_build_object(
    'bank_transaction_id',v_transaction.id,'invoice_id',v_invoice.id,
    'invoice_number',v_invoice.invoice_number,'amount_cents',v_transaction.amount_cents,
    'confirmed_by',v_user
  ));
  return v_payment;
end;
$$;
create or replace function public.pos_confirm_bank_transaction(
  p_transaction_id uuid,
  p_invoice_id uuid,
  p_confirmed boolean default false
)
returns public.pos_payments
language sql
security invoker
set search_path = ''
as $$
  select private._pos_confirm_bank_transaction(p_transaction_id,p_invoice_id,p_confirmed);
$$;
revoke all on function private._pos_import_bank_transactions(text,text,text,jsonb) from public, anon;
revoke all on function public.pos_import_bank_transactions(text,text,text,jsonb) from public, anon;
grant execute on function private._pos_import_bank_transactions(text,text,text,jsonb) to authenticated, service_role;
grant execute on function public.pos_import_bank_transactions(text,text,text,jsonb) to authenticated, service_role;
revoke all on function private._pos_confirm_bank_transaction(uuid,uuid,boolean) from public, anon;
revoke all on function public.pos_confirm_bank_transaction(uuid,uuid,boolean) from public, anon;
grant execute on function private._pos_confirm_bank_transaction(uuid,uuid,boolean) to authenticated, service_role;
grant execute on function public.pos_confirm_bank_transaction(uuid,uuid,boolean) to authenticated, service_role;
notify pgrst, 'reload schema';
