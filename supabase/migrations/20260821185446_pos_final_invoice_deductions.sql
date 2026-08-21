-- Schlussrechnungen must deduct previously received progress payments and the
-- VAT included in those payments. The server derives every deduction from
-- immutable invoices and confirmed payments; client-provided amounts are never
-- trusted.

alter table public.pos_work_order_invoices
  add column net_cents bigint,
  add column tax_cents bigint;

update public.pos_work_order_invoices as link
set net_cents = invoice.net_cents,
    tax_cents = invoice.tax_cents
from public.pos_invoices as invoice
where invoice.id = link.invoice_id;

alter table public.pos_work_order_invoices
  alter column net_cents set not null,
  alter column tax_cents set not null,
  add constraint pos_work_order_invoices_net_cents_check check (net_cents >= 0),
  add constraint pos_work_order_invoices_tax_cents_check check (tax_cents >= 0);

create or replace function private.pos_prepare_work_order_final_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context jsonb := new.snapshot #> '{draft,workflow_context}';
  v_order_id uuid;
  v_kind text;
  v_order public.pos_work_orders%rowtype;
  v_progress record;
  v_deductions jsonb := '[]'::jsonb;
  v_deduction_net bigint := 0;
  v_deduction_tax bigint := 0;
  v_deduction_gross bigint := 0;
  v_deduction_eligible bigint := 0;
  v_service_net bigint;
  v_service_tax bigint;
  v_service_gross bigint;
  v_service_eligible bigint;
begin
  if v_context is null or jsonb_typeof(v_context) <> 'object' then return new; end if;
  v_kind := coalesce(v_context->>'invoice_kind', 'final');
  if v_kind <> 'final' then return new; end if;
  if trim(coalesce(v_context->>'work_order_id', '')) = '' then return new; end if;

  begin
    v_order_id := (v_context->>'work_order_id')::uuid;
  exception when others then
    raise exception 'Povezava Schlussrechnung z naročilom ni veljavna.';
  end;

  select * into v_order
  from public.pos_work_orders
  where id = v_order_id and user_id = new.user_id
  for update;
  if not found then raise exception 'Povezano naročilo ne obstaja.'; end if;
  if v_order.status <> 'completed' then raise exception 'Schlussrechnung je dovoljena šele po zaključku dela.'; end if;

  for v_progress in
    select
      invoice.id as invoice_id,
      invoice.invoice_number,
      invoice.issue_date,
      invoice.net_cents,
      invoice.tax_cents,
      invoice.gross_cents,
      invoice.eligible_35a_cents,
      invoice.is_test,
      coalesce((
        select sum(case
          when payment.status in ('succeeded', 'partially_refunded')
            then payment.amount_cents - payment.refunded_cents
          else 0
        end)
        from public.pos_payments as payment
        where payment.invoice_id = invoice.id and payment.user_id = new.user_id
      ), 0)::bigint as paid_cents
    from public.pos_work_order_invoices as link
    join public.pos_invoices as invoice on invoice.id = link.invoice_id
    where link.work_order_id = v_order.id
      and link.user_id = new.user_id
      and link.invoice_kind = 'progress'
      and not exists (
        select 1 from public.pos_invoice_adjustments as adjustment
        where adjustment.original_invoice_id = invoice.id
          and adjustment.adjustment_type = 'cancellation'
      )
    order by link.created_at, link.id
  loop
    if v_progress.is_test <> new.is_test then
      raise exception 'Testnih in pravnih Abschlagsrechnungen ni mogoče združiti v isti Schlussrechnung.';
    end if;
    if v_progress.paid_cents < v_progress.gross_cents then
      raise exception 'Schlussrechnung je dovoljena šele, ko so vsi Abschlagsrechnungen v celoti plačani.';
    end if;
    v_deduction_net := v_deduction_net + v_progress.net_cents;
    v_deduction_tax := v_deduction_tax + v_progress.tax_cents;
    v_deduction_gross := v_deduction_gross + v_progress.gross_cents;
    v_deduction_eligible := v_deduction_eligible + v_progress.eligible_35a_cents;
    v_deductions := v_deductions || jsonb_build_array(jsonb_build_object(
      'invoice_id', v_progress.invoice_id,
      'invoice_number', v_progress.invoice_number,
      'issue_date', v_progress.issue_date,
      'net_cents', v_progress.net_cents,
      'tax_cents', v_progress.tax_cents,
      'gross_cents', v_progress.gross_cents
    ));
  end loop;

  if jsonb_array_length(v_deductions) = 0 then return new; end if;

  v_service_net := new.net_cents;
  v_service_tax := new.tax_cents;
  v_service_gross := new.gross_cents;
  v_service_eligible := new.eligible_35a_cents;
  if v_service_net < v_deduction_net or v_service_tax < v_deduction_tax or v_service_gross <= v_deduction_gross then
    raise exception 'Odbitki Abschlagsrechnungen presegajo vrednost Schlussrechnung.';
  end if;

  new.net_cents := v_service_net - v_deduction_net;
  new.tax_cents := v_service_tax - v_deduction_tax;
  new.gross_cents := v_service_gross - v_deduction_gross;
  new.eligible_35a_cents := greatest(0, v_service_eligible - v_deduction_eligible);
  if new.net_cents + new.tax_cents <> new.gross_cents then
    raise exception 'Odbitek Abschlagsrechnungen ni davčno skladen.';
  end if;

  new.snapshot := jsonb_set(
    new.snapshot,
    '{draft,workflow_context}',
    v_context || jsonb_build_object('final_deductions', v_deductions),
    true
  );
  new.snapshot := jsonb_set(
    new.snapshot,
    '{totals}',
    coalesce(new.snapshot->'totals', '{}'::jsonb) || jsonb_build_object(
      'serviceNetCents', v_service_net,
      'serviceTaxCents', v_service_tax,
      'serviceGrossCents', v_service_gross,
      'deductionNetCents', v_deduction_net,
      'deductionTaxCents', v_deduction_tax,
      'deductionGrossCents', v_deduction_gross,
      'netCents', new.net_cents,
      'taxCents', new.tax_cents,
      'grossCents', new.gross_cents,
      'eligible35aCents', new.eligible_35a_cents
    ),
    true
  );
  return new;
end;
$$;

drop trigger if exists pos_invoices_prepare_work_order_final on public.pos_invoices;
create trigger pos_invoices_prepare_work_order_final
before insert on public.pos_invoices
for each row execute function private.pos_prepare_work_order_final_invoice();

create or replace function private.pos_link_work_order_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context jsonb := new.snapshot #> '{draft,workflow_context}';
  v_order_id uuid;
  v_kind text;
  v_percent integer;
  v_order public.pos_work_orders%rowtype;
  v_progress_total integer;
begin
  if v_context is null or jsonb_typeof(v_context) <> 'object' or trim(coalesce(v_context->>'work_order_id','')) = '' then return new; end if;
  begin v_order_id := (v_context->>'work_order_id')::uuid;
  exception when others then raise exception 'Povezava računa z naročilom ni veljavna.'; end;
  v_kind := coalesce(v_context->>'invoice_kind','final');
  v_percent := nullif(v_context->>'progress_percent','')::integer;
  select * into v_order from public.pos_work_orders where id=v_order_id and user_id=new.user_id for update;
  if not found then raise exception 'Povezano naročilo ne obstaja.'; end if;
  if v_kind = 'progress' then
    if v_order.status not in ('accepted','in_progress','completed') or v_percent not between 1 and 99 then raise exception 'Abschlagsrechnung nima veljavnega stanja ali odstotka.'; end if;
    select coalesce(sum(link.progress_percent),0) into v_progress_total
    from public.pos_work_order_invoices as link
    join public.pos_invoices as invoice on invoice.id = link.invoice_id
    where link.work_order_id=v_order.id and link.invoice_kind='progress'
      and not exists (
        select 1 from public.pos_invoice_adjustments as adjustment
        where adjustment.original_invoice_id = invoice.id
          and adjustment.adjustment_type = 'cancellation'
      );
    if v_progress_total + v_percent >= 100 then raise exception 'Vsota Abschlagsrechnungen mora ostati pod 100 odstotki.'; end if;
  elsif v_kind = 'final' then
    if v_order.status <> 'completed' then raise exception 'Schlussrechnung je dovoljena šele po zaključku dela.'; end if;
    v_percent := null;
  else raise exception 'Neveljavna vrsta povezanega računa.';
  end if;
  insert into public.pos_work_order_invoices(user_id,work_order_id,invoice_id,invoice_kind,progress_percent,net_cents,tax_cents,gross_cents)
  values(new.user_id,v_order.id,new.id,v_kind,v_percent,new.net_cents,new.tax_cents,new.gross_cents);
  if v_kind='final' then update public.pos_work_orders set status='invoiced' where id=v_order.id; end if;
  insert into public.pos_work_order_events(user_id,work_order_id,action,details)
  values(new.user_id,v_order.id,case when v_kind='final' then 'final_invoiced' else 'progress_invoiced' end,
    jsonb_build_object('invoice_id',new.id,'invoice_number',new.invoice_number,'net_cents',new.net_cents,'tax_cents',new.tax_cents,'gross_cents',new.gross_cents,'progress_percent',v_percent));
  return new;
end;
$$;

revoke all on function private.pos_prepare_work_order_final_invoice() from public, anon, authenticated;
revoke all on function private.pos_link_work_order_invoice() from public, anon, authenticated;
grant execute on function private.pos_prepare_work_order_final_invoice(), private.pos_link_work_order_invoice() to service_role;

notify pgrst, 'reload schema';
