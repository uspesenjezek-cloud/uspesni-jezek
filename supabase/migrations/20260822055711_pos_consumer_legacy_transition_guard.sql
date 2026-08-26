-- Do not let offers stored before the consumer-context migration bypass the
-- new rules by transitioning without another save. The seller-lock trigger
-- runs first (trigger names are ordered), so the offered snapshot can also be
-- checked for the contact details printed in the withdrawal instruction.

create or replace function private.pos_require_consumer_contract_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := coalesce(new.locked_payload, new.payload);
  v_context text := trim(coalesce(v_payload->>'consumer_contract_context', ''));
  v_urgent_scope text := trim(coalesce(v_payload->>'urgent_repair_scope', ''));
begin
  if old.status <> new.status
     and new.status in ('offered', 'accepted', 'in_progress')
     and coalesce(v_payload->>'customer_type', '') = 'private' then
    if v_context not in ('business_premises', 'distance', 'off_premises', 'urgent_repair') then
      raise exception 'Potrošniška ponudba nima potrjenega načina sklenitve pogodbe.';
    end if;
    if v_context = 'urgent_repair' and char_length(v_urgent_scope) not between 5 and 500 then
      raise exception 'Nujno popravilo nima dovolj natančnega obsega.';
    end if;
    if v_context in ('distance', 'off_premises') and (
      trim(coalesce(v_payload #>> '{seller,businessEmail}', '')) = ''
      or trim(coalesce(v_payload #>> '{seller,businessPhone}', '')) = ''
    ) then
      raise exception 'Widerrufsbelehrung zahteva poslovni e-poštni naslov in telefon.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.pos_require_consumer_contract_context()
  from public, anon, authenticated;
grant execute on function private.pos_require_consumer_contract_context()
  to service_role;

create trigger pos_work_orders_validate_consumer_contract_context
before update of status on public.pos_work_orders
for each row execute function private.pos_require_consumer_contract_context();

notify pgrst, 'reload schema';

;
