-- partial_settlement je veljaven izvedbeni ukrep za dejanski delni
-- dobropis, odpust ali kompenzacijo. Dogovori o prihodnji poravnavi
-- še naprej uporabljajo izključno payment_promised.
do $$
declare
  v_constraint_name text;
begin
  for v_constraint_name in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.opomin_ukrepi'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%action_type%'
  loop
    execute format('alter table public.opomin_ukrepi drop constraint %I', v_constraint_name);
  end loop;
end
$$;

alter table public.opomin_ukrepi
  add constraint opomin_ukrepi_action_type_check
  check (action_type in (
    'send_reminder',
    'skip_current_step',
    'stop_plan',
    'handoff_to_lawyer',
    'postpone_reminder',
    'payment_promised',
    'partial_payment',
    'partial_settlement',
    'paid_in_full'
  ));
