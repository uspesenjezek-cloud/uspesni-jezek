-- Immutable PDF originals for offers after the draft is locked. Browser users
-- may read metadata only; object creation/download stays behind the JWT-owning
-- server endpoint and the private Storage bucket.

create table public.pos_offer_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  work_order_id uuid not null,
  document_kind text not null default 'offer_pdf' check (document_kind = 'offer_pdf'),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 5242880),
  media_type text not null default 'application/pdf' check (media_type = 'application/pdf'),
  generator_version text not null check (char_length(generator_version) between 1 and 80),
  created_at timestamptz not null default now(),
  constraint pos_offer_documents_work_order_user_fk
    foreign key (work_order_id, user_id)
    references public.pos_work_orders(id, user_id)
    on delete restrict,
  unique (work_order_id, document_kind),
  unique (storage_path)
);

create index pos_offer_documents_user_created_idx
  on public.pos_offer_documents(user_id, created_at desc);
create index pos_offer_documents_work_order_user_idx
  on public.pos_offer_documents(work_order_id, user_id);

alter table public.pos_offer_documents enable row level security;
revoke all on table public.pos_offer_documents from public, anon, authenticated;
grant select on table public.pos_offer_documents to authenticated;
grant all on table public.pos_offer_documents to service_role;

create policy pos_offer_documents_select_own on public.pos_offer_documents
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function private.pos_validate_offer_document_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.pos_work_orders as work_order
    where work_order.id = new.work_order_id
      and work_order.user_id = new.user_id
      and work_order.status <> 'draft'
      and work_order.locked_payload is not null
      and work_order.locked_payload = work_order.payload
      and trim(coalesce(work_order.locked_payload #>> '{seller,legalName}', '')) <> ''
  ) then
    raise exception 'PDF je dovoljen samo za zaklenjeno ponudbo z dokazljivim izdajateljem.';
  end if;
  return new;
end;
$$;

revoke all on function private.pos_validate_offer_document_source()
  from public, anon, authenticated;
grant execute on function private.pos_validate_offer_document_source()
  to service_role;

create trigger pos_offer_documents_validate_source
before insert on public.pos_offer_documents
for each row execute function private.pos_validate_offer_document_source();

create trigger pos_offer_documents_immutable
before update or delete on public.pos_offer_documents
for each row execute function private.pos_prevent_invoice_mutation();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pos-offer-originals', 'pos-offer-originals', false, 5242880, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
