-- Nemški Handwerker potek: ponudba -> naročilo -> izvedba -> račun.
-- Številke in prehodi nastanejo izključno na strežniku. Poslani ponudbi se
-- vsebina zaklene; uporabnik lahko vidi le svoje zapise.

alter table public.pos_business_profiles
  add column if not exists next_offer_sequence bigint not null default 1 check (next_offer_sequence > 0),
  add column if not exists next_order_sequence bigint not null default 1 check (next_order_sequence > 0);
create table public.pos_work_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  offer_number text not null check (char_length(offer_number) between 1 and 80),
  order_number text check (order_number is null or char_length(order_number) between 1 and 80),
  status text not null default 'draft' check (status in ('draft','offered','accepted','in_progress','completed','invoiced','cancelled')),
  title text not null check (char_length(title) between 1 and 180),
  customer_name text not null check (char_length(customer_name) between 1 and 240),
  customer_email text not null default '' check (char_length(customer_email) <= 200),
  valid_until date not null,
  net_cents bigint not null check (net_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  gross_cents bigint not null check (gross_cents > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  locked_payload jsonb check (locked_payload is null or jsonb_typeof(locked_payload) = 'object'),
  offered_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, offer_number),
  unique (user_id, order_number)
);
create index pos_work_orders_user_status_idx on public.pos_work_orders(user_id, status, updated_at desc);
create table public.pos_work_order_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_order_id uuid not null references public.pos_work_orders(id) on delete restrict,
  action text not null check (action in ('created','updated','offered','accepted','started','completed','progress_invoiced','final_invoiced','cancelled')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index pos_work_order_events_order_idx on public.pos_work_order_events(user_id, work_order_id, created_at);
create table public.pos_work_order_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_order_id uuid not null references public.pos_work_orders(id) on delete restrict,
  invoice_id uuid not null references public.pos_invoices(id) on delete restrict,
  invoice_kind text not null check (invoice_kind in ('progress','final')),
  progress_percent integer check (
    (invoice_kind = 'progress' and progress_percent between 1 and 99)
    or (invoice_kind = 'final' and progress_percent is null)
  ),
  gross_cents bigint not null check (gross_cents > 0),
  created_at timestamptz not null default now(),
  unique (invoice_id)
);
create unique index pos_work_order_final_invoice_uidx
  on public.pos_work_order_invoices(work_order_id)
  where invoice_kind = 'final';
create index pos_work_order_invoices_order_idx
  on public.pos_work_order_invoices(user_id, work_order_id, created_at);
alter table public.pos_work_orders enable row level security;
alter table public.pos_work_order_events enable row level security;
alter table public.pos_work_order_invoices enable row level security;
revoke all on table public.pos_work_orders, public.pos_work_order_events, public.pos_work_order_invoices from public, anon, authenticated;
grant select on table public.pos_work_orders, public.pos_work_order_events, public.pos_work_order_invoices to authenticated;
grant all on table public.pos_work_orders, public.pos_work_order_events, public.pos_work_order_invoices to service_role;
create policy pos_work_orders_select_own on public.pos_work_orders
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_work_order_events_select_own on public.pos_work_order_events
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_work_order_invoices_select_own on public.pos_work_order_invoices
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create trigger pos_work_orders_updated_at
before update on public.pos_work_orders
for each row execute function private.pos_set_updated_at();
create or replace function private._pos_save_work_order(p_work_order_id uuid, p_payload jsonb)
returns public.pos_work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile public.pos_business_profiles%rowtype;
  v_order public.pos_work_orders%rowtype;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_title text;
  v_customer_name text;
  v_customer_email text;
  v_valid_until date;
  v_price_mode text;
  v_tax_mode text;
  v_quantity_milli bigint;
  v_unit_price_cents bigint;
  v_rate_bps integer;
  v_entered bigint;
  v_line_net bigint;
  v_line_tax bigint;
  v_line_gross bigint;
  v_net bigint := 0;
  v_tax bigint := 0;
  v_gross bigint := 0;
  v_number text;
  v_normalized_payload jsonb;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Neveljavna ponudba.'; end if;

  v_title := trim(coalesce(p_payload->>'project_name',''));
  v_customer_name := trim(coalesce(p_payload->>'customer_name',''));
  v_customer_email := trim(coalesce(p_payload->>'customer_email',''));
  if char_length(v_title) not between 1 and 180 then raise exception 'Manjka veljaven naziv projekta.'; end if;
  if char_length(v_customer_name) not between 1 and 240 then raise exception 'Manjka veljaven naziv naročnika.'; end if;
  if char_length(v_customer_email) > 200 then raise exception 'E-poštni naslov je predolg.'; end if;
  begin
    v_valid_until := (p_payload->>'valid_until')::date;
  exception when others then raise exception 'Veljavnost ponudbe ni pravilna.';
  end;
  if v_valid_until < current_date then raise exception 'Ponudba ne more poteči v preteklosti.'; end if;

  v_price_mode := p_payload->>'price_mode';
  v_tax_mode := p_payload->>'tax_mode';
  if v_price_mode not in ('net','gross') then raise exception 'Neveljaven način cene.'; end if;
  if v_tax_mode not in ('regular','small_business','reverse_charge') then raise exception 'Neveljaven davčni način.'; end if;
  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') not between 1 and 100 then
    raise exception 'Ponudba mora imeti od 1 do 100 postavk.';
  end if;

  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    if trim(coalesce(v_item->>'description','')) = '' or char_length(v_item->>'description') > 240 then
      raise exception 'Vsaka postavka potrebuje veljaven opis.';
    end if;
    begin
      v_quantity_milli := (v_item->>'quantity_milli')::bigint;
      v_unit_price_cents := (v_item->>'unit_price_cents')::bigint;
      v_rate_bps := coalesce((v_item->>'tax_rate_bps')::integer, 0);
    exception when others then raise exception 'Količina, cena ali DDV postavke ni veljaven.';
    end;
    if v_quantity_milli <= 0 or v_quantity_milli > 1000000000 then raise exception 'Količina postavke ni veljavna.'; end if;
    if v_unit_price_cents < 0 or v_unit_price_cents > 100000000000 then raise exception 'Cena postavke ni veljavna.'; end if;
    if v_tax_mode <> 'regular' then v_rate_bps := 0; end if;
    if v_rate_bps not in (0,700,1900) then raise exception 'Dovoljene stopnje DDV so 0, 7 in 19 odstotkov.'; end if;
    v_entered := round((v_unit_price_cents::numeric * v_quantity_milli::numeric) / 1000)::bigint;
    if v_price_mode = 'gross' and v_rate_bps > 0 then
      v_line_gross := v_entered;
      v_line_net := round((v_line_gross::numeric * 10000) / (10000 + v_rate_bps))::bigint;
      v_line_tax := v_line_gross - v_line_net;
    else
      v_line_net := v_entered;
      v_line_tax := round((v_line_net::numeric * v_rate_bps) / 10000)::bigint;
      v_line_gross := v_line_net + v_line_tax;
    end if;
    v_net := v_net + v_line_net;
    v_tax := v_tax + v_line_tax;
    v_gross := v_gross + v_line_gross;
    v_items := v_items || jsonb_build_array(v_item || jsonb_build_object(
      'net_cents',v_line_net,'tax_cents',v_line_tax,'gross_cents',v_line_gross
    ));
  end loop;
  if v_gross <= 0 then raise exception 'Skupni znesek ponudbe mora biti večji od 0.'; end if;
  v_normalized_payload := (p_payload - 'items') || jsonb_build_object('items',v_items,'valid_until',v_valid_until);

  if p_work_order_id is null then
    select * into v_profile from public.pos_business_profiles where user_id = v_user for update;
    if not found then raise exception 'Najprej shranite podatke podjetja.'; end if;
    v_number := 'ANG-' || extract(year from current_date)::integer || '-' || lpad(v_profile.next_offer_sequence::text,4,'0');
    update public.pos_business_profiles set next_offer_sequence = next_offer_sequence + 1 where user_id = v_user;
    insert into public.pos_work_orders(user_id,offer_number,title,customer_name,customer_email,valid_until,net_cents,tax_cents,gross_cents,payload)
    values(v_user,v_number,v_title,v_customer_name,v_customer_email,v_valid_until,v_net,v_tax,v_gross,v_normalized_payload)
    returning * into v_order;
    insert into public.pos_work_order_events(user_id,work_order_id,action,details)
    values(v_user,v_order.id,'created',jsonb_build_object('offer_number',v_number,'gross_cents',v_gross));
  else
    select * into v_order from public.pos_work_orders where id = p_work_order_id and user_id = v_user for update;
    if not found then raise exception 'Ponudba ne obstaja ali ni vaša.'; end if;
    if v_order.status <> 'draft' then raise exception 'Poslane ponudbe ni mogoče spreminjati.'; end if;
    update public.pos_work_orders set title=v_title,customer_name=v_customer_name,customer_email=v_customer_email,
      valid_until=v_valid_until,net_cents=v_net,tax_cents=v_tax,gross_cents=v_gross,payload=v_normalized_payload
    where id=v_order.id returning * into v_order;
    insert into public.pos_work_order_events(user_id,work_order_id,action,details)
    values(v_user,v_order.id,'updated',jsonb_build_object('gross_cents',v_gross));
  end if;
  return v_order;
end;
$$;
create or replace function private._pos_transition_work_order(p_work_order_id uuid, p_action text)
returns public.pos_work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile public.pos_business_profiles%rowtype;
  v_order public.pos_work_orders%rowtype;
  v_number text;
  v_event text;
begin
  if v_user is null then raise exception 'Prijava je obvezna.'; end if;
  select * into v_order from public.pos_work_orders where id=p_work_order_id and user_id=v_user for update;
  if not found then raise exception 'Ponudba oziroma naročilo ne obstaja.'; end if;
  case p_action
    when 'offer' then
      if v_order.status <> 'draft' then raise exception 'Poslati je mogoče samo osnutek ponudbe.'; end if;
      update public.pos_work_orders set status='offered',locked_payload=payload,offered_at=now() where id=v_order.id returning * into v_order;
      v_event := 'offered';
    when 'accept' then
      if v_order.status <> 'offered' then raise exception 'Sprejeti je mogoče samo poslano ponudbo.'; end if;
      if v_order.valid_until < current_date then raise exception 'Ponudba je potekla.'; end if;
      select * into v_profile from public.pos_business_profiles where user_id=v_user for update;
      v_number := 'AUF-' || extract(year from current_date)::integer || '-' || lpad(v_profile.next_order_sequence::text,4,'0');
      update public.pos_business_profiles set next_order_sequence=next_order_sequence+1 where user_id=v_user;
      update public.pos_work_orders set status='accepted',order_number=v_number,accepted_at=now() where id=v_order.id returning * into v_order;
      v_event := 'accepted';
    when 'start' then
      if v_order.status <> 'accepted' then raise exception 'Začetek je dovoljen samo pri sprejetem naročilu.'; end if;
      update public.pos_work_orders set status='in_progress',started_at=now() where id=v_order.id returning * into v_order;
      v_event := 'started';
    when 'complete' then
      if v_order.status <> 'in_progress' then raise exception 'Zaključiti je mogoče samo začeto delo.'; end if;
      update public.pos_work_orders set status='completed',completed_at=now() where id=v_order.id returning * into v_order;
      v_event := 'completed';
    when 'cancel' then
      if v_order.status in ('invoiced','cancelled') then raise exception 'Tega naročila ni mogoče preklicati.'; end if;
      update public.pos_work_orders set status='cancelled',cancelled_at=now() where id=v_order.id returning * into v_order;
      v_event := 'cancelled';
    else raise exception 'Neveljaven prehod naročila.';
  end case;
  insert into public.pos_work_order_events(user_id,work_order_id,action,details)
  values(v_user,v_order.id,v_event,jsonb_build_object('from_status',case p_action when 'offer' then 'draft' when 'accept' then 'offered' when 'start' then 'accepted' when 'complete' then 'in_progress' else null end,'order_number',v_order.order_number));
  return v_order;
end;
$$;
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
    select coalesce(sum(progress_percent),0) into v_progress_total from public.pos_work_order_invoices where work_order_id=v_order.id and invoice_kind='progress';
    if v_progress_total + v_percent >= 100 then raise exception 'Vsota Abschlagsrechnungen mora ostati pod 100 odstotki.'; end if;
  elsif v_kind = 'final' then
    if v_order.status <> 'completed' then raise exception 'Schlussrechnung je dovoljena šele po zaključku dela.'; end if;
    if exists(select 1 from public.pos_work_order_invoices where work_order_id=v_order.id and invoice_kind='progress') then
      raise exception 'Schlussrechnung po Abschlägen zahteva prikaz in odbitek že izdanih obrokov.';
    end if;
    v_percent := null;
  else raise exception 'Neveljavna vrsta povezanega računa.';
  end if;
  insert into public.pos_work_order_invoices(user_id,work_order_id,invoice_id,invoice_kind,progress_percent,gross_cents)
  values(new.user_id,v_order.id,new.id,v_kind,v_percent,new.gross_cents);
  if v_kind='final' then update public.pos_work_orders set status='invoiced' where id=v_order.id; end if;
  insert into public.pos_work_order_events(user_id,work_order_id,action,details)
  values(new.user_id,v_order.id,case when v_kind='final' then 'final_invoiced' else 'progress_invoiced' end,
    jsonb_build_object('invoice_id',new.id,'invoice_number',new.invoice_number,'gross_cents',new.gross_cents,'progress_percent',v_percent));
  return new;
end;
$$;
create trigger pos_invoices_link_work_order
after insert on public.pos_invoices
for each row execute function private.pos_link_work_order_invoice();
create or replace function public.pos_save_work_order(p_work_order_id uuid, p_payload jsonb)
returns public.pos_work_orders language sql security invoker set search_path='' as $$
  select private._pos_save_work_order(p_work_order_id,p_payload);
$$;
create or replace function public.pos_transition_work_order(p_work_order_id uuid, p_action text)
returns public.pos_work_orders language sql security invoker set search_path='' as $$
  select private._pos_transition_work_order(p_work_order_id,p_action);
$$;
revoke all on function private._pos_save_work_order(uuid,jsonb) from public,anon;
revoke all on function private._pos_transition_work_order(uuid,text) from public,anon;
revoke all on function public.pos_save_work_order(uuid,jsonb) from public,anon;
revoke all on function public.pos_transition_work_order(uuid,text) from public,anon;
revoke all on function private.pos_link_work_order_invoice() from public,anon,authenticated;
grant execute on function private._pos_save_work_order(uuid,jsonb), private._pos_transition_work_order(uuid,text) to authenticated,service_role;
grant execute on function public.pos_save_work_order(uuid,jsonb), public.pos_transition_work_order(uuid,text) to authenticated,service_role;
grant execute on function private.pos_link_work_order_invoice() to service_role;
notify pgrst, 'reload schema';
