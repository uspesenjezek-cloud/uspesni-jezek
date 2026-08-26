-- A refund recorded as using the original payment method must match at least
-- one actual payment channel retained in the work-order payment history.

create or replace function private._pos_record_consumer_withdrawal_refund(
  p_work_order_id uuid,
  p_amount_cents bigint,
  p_provider text,
  p_provider_reference text,
  p_evidence text,
  p_executed_on date
)
returns public.pos_consumer_withdrawal_refund_records
language plpgsql security definer set search_path='' set timezone='Europe/Berlin'
as $$
declare
  v_user uuid := (select auth.uid());
  v_settlement public.pos_consumer_withdrawal_settlements%rowtype;
  v_record public.pos_consumer_withdrawal_refund_records%rowtype;
  v_recorded bigint;
  v_withdrawal_received_on date;
  v_provider text := trim(coalesce(p_provider,''));
  v_reference text := trim(coalesce(p_provider_reference,''));
  v_evidence text := trim(coalesce(p_evidence,''));
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  select * into v_settlement from public.pos_consumer_withdrawal_settlements
  where work_order_id=p_work_order_id and user_id=v_user for update;
  if not found then raise exception 'Najprej nespremenljivo ocenite denarne posledice odstopa.'; end if;
  if v_settlement.refund_due_cents <= 0 then raise exception 'Za ta odstop ni odprtega vračila.'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'Znesek vračila mora biti večji od 0.'; end if;
  if v_provider not in ('stripe','bank_transfer','other') then raise exception 'Izberite veljaven način izvedenega vračila.'; end if;
  if v_settlement.refund_method = 'original' and not exists (
    select 1
    from public.pos_work_order_invoices as link
    join public.pos_payments as payment
      on payment.invoice_id=link.invoice_id and payment.user_id=link.user_id
    where link.work_order_id=v_settlement.work_order_id and link.user_id=v_user
      and payment.status in ('succeeded','partially_refunded','refunded')
      and case
        when payment.provider='stripe' then 'stripe'
        when payment.method='bank_transfer' or payment.provider='finapi' then 'bank_transfer'
        else 'other'
      end = v_provider
  ) then
    raise exception 'Dokaz vračila mora uporabiti enega od prvotnih načinov plačila.';
  end if;
  if char_length(v_reference) not between 3 and 200 then raise exception 'Vpišite referenco izvedenega vračila.'; end if;
  if char_length(v_evidence) not between 5 and 500 then raise exception 'Vpišite dokaz izvedenega vračila.'; end if;
  if p_executed_on is null or p_executed_on > current_date then raise exception 'Datum vračila ni veljaven.'; end if;
  select (withdrawal.received_at at time zone 'Europe/Berlin')::date
  into v_withdrawal_received_on
  from public.pos_work_order_withdrawals as withdrawal
  where withdrawal.id=v_settlement.withdrawal_id and withdrawal.user_id=v_user;
  if p_executed_on < v_withdrawal_received_on then
    raise exception 'Datum vračila ne sme biti pred prejemom potrošnikovega odstopa.';
  end if;
  select coalesce(sum(amount_cents),0) into v_recorded
  from public.pos_consumer_withdrawal_refund_records
  where settlement_id=v_settlement.id and user_id=v_user;
  if v_recorded + p_amount_cents > v_settlement.refund_due_cents then
    raise exception 'Vsota dokazov vračila presega ocenjeni znesek.';
  end if;
  insert into public.pos_consumer_withdrawal_refund_records(
    user_id,work_order_id,settlement_id,amount_cents,refund_method,provider,
    provider_reference,evidence,executed_on
  ) values (
    v_user,v_settlement.work_order_id,v_settlement.id,p_amount_cents,v_settlement.refund_method,
    v_provider,v_reference,v_evidence,p_executed_on
  ) returning * into v_record;
  insert into public.pos_work_order_events(user_id,work_order_id,action,details)
  values(v_user,v_settlement.work_order_id,'withdrawal_refund_recorded',jsonb_build_object(
    'amount_cents',p_amount_cents,'refund_method',v_settlement.refund_method,
    'provider',v_provider,'provider_reference',v_reference,'executed_on',p_executed_on,
    'remaining_cents',v_settlement.refund_due_cents-v_recorded-p_amount_cents,
    'external_payment_triggered',false
  ));
  return v_record;
end;
$$;

notify pgrst, 'reload schema';

;
