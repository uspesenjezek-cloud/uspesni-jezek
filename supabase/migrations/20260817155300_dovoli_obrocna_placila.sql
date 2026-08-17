-- Funkcija izvedi_opomin_ukrep zapisuje vrsto "installment", kadar uporabnik
-- delno plačilo označi kot obrok. Prvotna omejitev je poznala samo partial/full.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.zadeva_placila'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%vrsta%'
  loop
    execute format('alter table public.zadeva_placila drop constraint %I', v_constraint.conname);
  end loop;
end $$;

alter table public.zadeva_placila
  add constraint zadeva_placila_vrsta_check
  check (vrsta in ('partial', 'full', 'installment'));
