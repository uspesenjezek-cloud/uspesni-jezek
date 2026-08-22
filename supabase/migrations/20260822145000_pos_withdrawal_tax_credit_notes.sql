-- Immutable partial tax credit notes for a consumer withdrawal with taxable
-- Wertersatz. Amounts and tax groups are derived from locked invoice lines;
-- the client cannot choose or alter accounting amounts.

alter table public.pos_invoice_adjustments
  drop constraint pos_invoice_adjustments_adjustment_type_check,
  add constraint pos_invoice_adjustments_adjustment_type_check
    check (adjustment_type in ('correction','cancellation','credit_note'));

alter table public.pos_invoice_adjustments
  add column work_order_id uuid,
  add column withdrawal_settlement_id uuid,
  add constraint pos_invoice_adjustments_work_order_user_fk
    foreign key (work_order_id, user_id)
    references public.pos_work_orders(id, user_id) on delete restrict,
  add constraint pos_invoice_adjustments_settlement_user_fk
    foreign key (withdrawal_settlement_id, user_id)
    references public.pos_consumer_withdrawal_settlements(id, user_id) on delete restrict;

create unique index pos_invoice_adjustments_single_withdrawal_credit_uidx
  on public.pos_invoice_adjustments(original_invoice_id)
  where adjustment_type = 'credit_note';
create index pos_invoice_adjustments_settlement_user_idx
  on public.pos_invoice_adjustments(withdrawal_settlement_id, user_id)
  where withdrawal_settlement_id is not null;

alter table public.pos_invoice_adjustments
  drop constraint pos_invoice_adjustments_kind_shape_check,
  add constraint pos_invoice_adjustments_kind_shape_check
  check (
    ((is_test and document_status = 'test') or (not is_test and document_status = 'issued'))
    and (
      (adjustment_type = 'correction' and changes <> '{}'::jsonb
        and delta_net_cents = 0 and delta_tax_cents = 0 and delta_gross_cents = 0
        and work_order_id is null and withdrawal_settlement_id is null)
      or
      (adjustment_type = 'cancellation' and changes = '{}'::jsonb
        and delta_net_cents <= 0 and delta_tax_cents <= 0 and delta_gross_cents < 0
        and work_order_id is null and withdrawal_settlement_id is null)
      or
      (adjustment_type = 'credit_note' and changes = '{}'::jsonb
        and delta_net_cents <= 0 and delta_tax_cents <= 0 and delta_gross_cents < 0
        and work_order_id is not null and withdrawal_settlement_id is not null)
    )
  ) not valid;

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
  if p_adjustment_type is null or p_adjustment_type not in ('correction','cancellation','credit_note') then
    raise exception 'Neveljavna vrsta popravka.';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 5 and 500 then
    raise exception 'Razlog mora vsebovati od 5 do 500 znakov.';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'Popravljeni podatki niso veljavni.';
  end if;
  if octet_length(p_changes::text) > 65536 then raise exception 'Popravek presega dovoljeno velikost.'; end if;
  if p_adjustment_type in ('cancellation','credit_note') and p_changes <> '{}'::jsonb then
    raise exception 'Finančni popravek ne sprejema ročno vnesenih sprememb.';
  end if;
  for v_key, v_value in select key, value from jsonb_each(p_changes) loop
    if v_key not in ('customer_name','customer_street','customer_postal_code','customer_city',
      'customer_vat_id','service_date','due_date','buyer_reference','leitweg_id','work_description') then
      raise exception 'Popravek vsebuje nedovoljeno polje.';
    end if;
    if jsonb_typeof(v_value) <> 'string' then raise exception 'Popravljeni podatki morajo biti besedilo ali datum.'; end if;
  end loop;
  return p_changes;
end;
$$;

create or replace function private.pos_validate_adjustment_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.pos_invoices%rowtype;
  v_expected_status text;
  v_line_net bigint;
  v_line_tax bigint;
  v_line_gross bigint;
begin
  perform private.pos_validate_adjustment_changes(new.adjustment_type,new.reason,new.changes);
  select * into v_invoice from public.pos_invoices
  where id=new.original_invoice_id and user_id=new.user_id;
  v_expected_status := case when v_invoice.is_test then 'test' else 'issued' end;
  if not found
     or new.is_test is distinct from v_invoice.is_test
     or new.document_status is distinct from v_expected_status
     or new.snapshot #>> '{original_invoice,id}' is distinct from v_invoice.id::text
     or new.snapshot #>> '{original_invoice,invoice_number}' is distinct from v_invoice.invoice_number
     or (new.snapshot #>> '{original_invoice,issue_date}')::date is distinct from v_invoice.issue_date
     or (new.snapshot #>> '{original_invoice,net_cents}')::bigint is distinct from v_invoice.net_cents
     or (new.snapshot #>> '{original_invoice,tax_cents}')::bigint is distinct from v_invoice.tax_cents
     or (new.snapshot #>> '{original_invoice,gross_cents}')::bigint is distinct from v_invoice.gross_cents
     or (new.snapshot #>> '{original_invoice,is_test}')::boolean is distinct from v_invoice.is_test then
    raise exception 'Popravek se ne ujema z izvornim računom.';
  end if;
  if new.adjustment_type = 'cancellation' then
    if exists (select 1 from public.pos_invoice_adjustments a where a.original_invoice_id=v_invoice.id and a.adjustment_type='credit_note') then
      raise exception 'Račun z delnim dobropisom ni mogoče naknadno v celoti stornirati.';
    end if;
    if new.delta_net_cents <> -v_invoice.net_cents or new.delta_tax_cents <> -v_invoice.tax_cents
       or new.delta_gross_cents <> -v_invoice.gross_cents then raise exception 'Storno nima pravilnih nasprotnih zneskov.'; end if;
  elsif new.adjustment_type = 'credit_note' then
    if exists (select 1 from public.pos_invoice_adjustments a where a.original_invoice_id=v_invoice.id and a.adjustment_type='cancellation') then
      raise exception 'Storniran račun ne more dobiti delnega dobropisa.';
    end if;
    if new.delta_net_cents < -v_invoice.net_cents or new.delta_tax_cents < -v_invoice.tax_cents
       or new.delta_gross_cents < -v_invoice.gross_cents
       or jsonb_typeof(new.snapshot->'credit_lines') is distinct from 'array'
       or jsonb_array_length(new.snapshot->'credit_lines') = 0 then
      raise exception 'Dobropis presega izvorni račun ali nima postavk.';
    end if;
    select coalesce(sum((line->>'net_cents')::bigint),0),
           coalesce(sum((line->>'tax_cents')::bigint),0),
           coalesce(sum((line->>'gross_cents')::bigint),0)
    into v_line_net,v_line_tax,v_line_gross
    from jsonb_array_elements(new.snapshot->'credit_lines') as line;
    if v_line_net <> -new.delta_net_cents or v_line_tax <> -new.delta_tax_cents
       or v_line_gross <> -new.delta_gross_cents or v_line_net+v_line_tax <> v_line_gross
       or new.snapshot #>> '{withdrawal_settlement,id}' is distinct from new.withdrawal_settlement_id::text
       or new.snapshot #>> '{withdrawal_settlement,work_order_id}' is distinct from new.work_order_id::text
       or not exists (
         select 1 from public.pos_consumer_withdrawal_settlements s
         join public.pos_work_order_invoices l on l.work_order_id=s.work_order_id and l.user_id=s.user_id
         where s.id=new.withdrawal_settlement_id and s.user_id=new.user_id
           and s.work_order_id=new.work_order_id and l.invoice_id=new.original_invoice_id
       ) then raise exception 'Dobropis ni skladen z odstopom, računom ali davčnimi postavkami.'; end if;
  elsif new.changes ? 'due_date' and ((new.changes->>'due_date')::date < v_invoice.issue_date
    or (new.changes->>'due_date')::date > v_invoice.issue_date + 365) then
    raise exception 'Popravljeni rok plačila mora biti med datumom izdaje in 365 dnevi pozneje.';
  end if;
  return new;
end;
$$;

create or replace function private._pos_create_withdrawal_tax_credit_notes(
  p_work_order_id uuid,
  p_confirmed boolean default false
)
returns setof public.pos_invoice_adjustments
language plpgsql
security definer
set search_path = ''
set timezone = 'Europe/Berlin'
as $$
declare
  v_user uuid := (select auth.uid());
  v_order public.pos_work_orders%rowtype;
  v_settlement public.pos_consumer_withdrawal_settlements%rowtype;
  v_profile public.pos_business_profiles%rowtype;
  v_invoice public.pos_invoices%rowtype;
  v_item jsonb;
  v_credit_lines jsonb;
  v_tax_groups jsonb;
  v_line_gross bigint;
  v_take bigint;
  v_take_net bigint;
  v_take_tax bigint;
  v_credit_net bigint;
  v_credit_tax bigint;
  v_credit_gross bigint;
  v_total_invoiced bigint;
  v_remaining bigint;
  v_sequence bigint;
  v_number text;
  v_snapshot jsonb;
  v_adjustment public.pos_invoice_adjustments%rowtype;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if not coalesce(p_confirmed,false) then raise exception 'Izrecna potrditev dobropisa je obvezna.'; end if;
  select * into v_order from public.pos_work_orders where id=p_work_order_id and user_id=v_user for update;
  if not found or v_order.status <> 'withdrawn' then raise exception 'Davčni dobropis je dovoljen samo za vaše odstopljeno naročilo.'; end if;
  select * into v_settlement from public.pos_consumer_withdrawal_settlements
  where work_order_id=v_order.id and user_id=v_user for share;
  if not found then raise exception 'Najprej nespremenljivo ocenite denarne posledice odstopa.'; end if;
  if v_settlement.value_compensation_cents <= 0 then raise exception 'Pri ničelnem Wertersatz uporabite popolni Storno.'; end if;
  if exists (select 1 from public.pos_invoice_adjustments where withdrawal_settlement_id=v_settlement.id) then
    return query select * from public.pos_invoice_adjustments
      where withdrawal_settlement_id=v_settlement.id order by issued_at,id;
    return;
  end if;
  select coalesce(sum(invoice.gross_cents),0) into v_total_invoiced
  from public.pos_work_order_invoices link join public.pos_invoices invoice
    on invoice.id=link.invoice_id and invoice.user_id=link.user_id
  where link.work_order_id=v_order.id and link.user_id=v_user
    and not exists (select 1 from public.pos_invoice_adjustments a
      where a.original_invoice_id=invoice.id and a.adjustment_type='cancellation');
  v_remaining := greatest(v_total_invoiced-v_settlement.value_compensation_cents,0);
  if v_remaining <= 0 then raise exception 'Davčna osnova ne presega priznanega Wertersatz; dobropis ni potreben.'; end if;
  select * into v_profile from public.pos_business_profiles where user_id=v_user for update;
  if not found then raise exception 'Podatki podjetja ne obstajajo.'; end if;

  for v_invoice in
    select invoice.* from public.pos_work_order_invoices link join public.pos_invoices invoice
      on invoice.id=link.invoice_id and invoice.user_id=link.user_id
    where link.work_order_id=v_order.id and link.user_id=v_user
      and not exists (select 1 from public.pos_invoice_adjustments a
        where a.original_invoice_id=invoice.id and a.adjustment_type in ('cancellation','credit_note'))
    order by invoice.issued_at desc,invoice.id desc
  loop
    exit when v_remaining <= 0;
    v_credit_gross := least(v_remaining,v_invoice.gross_cents);
    v_credit_net := 0; v_credit_tax := 0; v_credit_lines := '[]'::jsonb;
    for v_item in select value from jsonb_array_elements(v_invoice.snapshot->'draft'->'items') loop
      exit when v_credit_net+v_credit_tax >= v_credit_gross;
      v_line_gross := coalesce((v_item->>'gross_cents')::bigint,0);
      if v_line_gross <= 0 then continue; end if;
      v_take := least(v_line_gross,v_credit_gross-v_credit_net-v_credit_tax);
      if v_take=v_line_gross then v_take_net := (v_item->>'net_cents')::bigint; v_take_tax := (v_item->>'tax_cents')::bigint;
      else v_take_net := round(((v_item->>'net_cents')::numeric*v_take)/v_line_gross)::bigint; v_take_tax := v_take-v_take_net; end if;
      v_credit_lines := v_credit_lines || jsonb_build_array(jsonb_build_object(
        'description',coalesce(v_item->>'description','Leistung'), 'tax_rate_bps',coalesce((v_item->>'tax_rate_bps')::integer,0),
        'net_cents',v_take_net,'tax_cents',v_take_tax,'gross_cents',v_take));
      v_credit_net := v_credit_net+v_take_net; v_credit_tax := v_credit_tax+v_take_tax;
    end loop;
    if v_credit_net+v_credit_tax <> v_credit_gross then raise exception 'Zaklenjene postavke računa ne pokrivajo zahtevanega dobropisa.'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('tax_rate_bps',tax_rate,'net_cents',net_total,
      'tax_cents',tax_total,'gross_cents',net_total+tax_total) order by tax_rate),'[]'::jsonb)
    into v_tax_groups from (
      select (line->>'tax_rate_bps')::integer tax_rate,sum((line->>'net_cents')::bigint) net_total,
        sum((line->>'tax_cents')::bigint) tax_total from jsonb_array_elements(v_credit_lines) line group by 1
    ) grouped;
    v_sequence := v_profile.next_adjustment_sequence;
    v_number := (case when v_invoice.is_test then 'TEST-GS-' else 'GS-' end)
      || extract(year from current_date)::integer || '-' || lpad(v_sequence::text,4,'0');
    update public.pos_business_profiles set next_adjustment_sequence=next_adjustment_sequence+1 where user_id=v_user;
    v_profile.next_adjustment_sequence := v_profile.next_adjustment_sequence+1;
    v_snapshot := jsonb_build_object('schema_version',2,'seller',v_invoice.snapshot->'seller',
      'original_invoice',jsonb_build_object('id',v_invoice.id,'invoice_number',v_invoice.invoice_number,
        'issue_date',v_invoice.issue_date,'service_date',v_invoice.service_date,'due_date',v_invoice.due_date,
        'tax_mode',v_invoice.tax_mode,'net_cents',v_invoice.net_cents,'tax_cents',v_invoice.tax_cents,
        'gross_cents',v_invoice.gross_cents,'is_test',v_invoice.is_test),
      'original_draft',v_invoice.snapshot->'draft','effective_draft',v_invoice.snapshot->'draft','changes','{}'::jsonb,
      'credit_lines',v_credit_lines,'credit_tax_groups',v_tax_groups,
      'withdrawal_settlement',jsonb_build_object('id',v_settlement.id,'work_order_id',v_order.id,
        'value_compensation_cents',v_settlement.value_compensation_cents,'refund_due_cents',v_settlement.refund_due_cents));
    insert into public.pos_invoice_adjustments(user_id,original_invoice_id,adjustment_number,adjustment_type,
      document_status,is_test,reason,changes,delta_net_cents,delta_tax_cents,delta_gross_cents,snapshot,
      work_order_id,withdrawal_settlement_id)
    values(v_user,v_invoice.id,v_number,'credit_note',case when v_invoice.is_test then 'test' else 'issued' end,
      v_invoice.is_test,'Minderung nach Verbraucherwiderruf; der anerkannte Wertersatz bleibt steuerpflichtig.',
      '{}'::jsonb,-v_credit_net,-v_credit_tax,-v_credit_gross,v_snapshot,v_order.id,v_settlement.id)
    returning * into v_adjustment;
    insert into public.pos_audit_events(user_id,entity_type,entity_id,action,details)
    values(v_user,'invoice',v_invoice.id,'withdrawal_tax_credit_issued',jsonb_build_object(
      'adjustment_id',v_adjustment.id,'adjustment_number',v_number,'work_order_id',v_order.id,
      'settlement_id',v_settlement.id,'gross_cents',v_credit_gross));
    v_remaining := v_remaining-v_credit_gross;
  end loop;
  if v_remaining <> 0 then raise exception 'Davčnega dobropisa ni bilo mogoče v celoti razporediti.'; end if;
  return query select * from public.pos_invoice_adjustments
    where withdrawal_settlement_id=v_settlement.id order by issued_at,id;
end;
$$;

create or replace function public.pos_create_withdrawal_tax_credit_notes(
  p_work_order_id uuid,
  p_confirmed boolean default false
)
returns setof public.pos_invoice_adjustments
language sql security definer set search_path=''
as $$ select * from private._pos_create_withdrawal_tax_credit_notes(p_work_order_id,p_confirmed); $$;

revoke all on function private._pos_create_withdrawal_tax_credit_notes(uuid,boolean) from public,anon,authenticated;
grant execute on function private._pos_create_withdrawal_tax_credit_notes(uuid,boolean) to service_role;
revoke all on function public.pos_create_withdrawal_tax_credit_notes(uuid,boolean) from public,anon;
grant execute on function public.pos_create_withdrawal_tax_credit_notes(uuid,boolean) to authenticated,service_role;

create or replace function private.pos_block_payment_after_financial_adjustment()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if exists (select 1 from public.pos_invoice_adjustments a where a.original_invoice_id=new.invoice_id
    and a.user_id=new.user_id and a.adjustment_type in ('cancellation','credit_note')) then
    if tg_op='INSERT' or (old.status in ('pending','failed','cancelled') and new.status in ('succeeded','partially_refunded','refunded')) then
      raise exception 'Po Stornu ali dobropisu za ta račun ni dovoljeno sprejeti novega plačila.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.pos_block_payment_after_financial_adjustment() from public,anon,authenticated;
grant execute on function private.pos_block_payment_after_financial_adjustment() to service_role;
create trigger pos_payments_block_after_financial_adjustment
before insert or update of status on public.pos_payments
for each row execute function private.pos_block_payment_after_financial_adjustment();

alter table public.pos_invoice_adjustments validate constraint pos_invoice_adjustments_kind_shape_check;
notify pgrst, 'reload schema';
