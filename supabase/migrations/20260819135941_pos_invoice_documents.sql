-- Nespremenljivi PDF originali izdanih POS računov.
create table public.pos_invoice_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.pos_invoices(id) on delete restrict,
  document_kind text not null default 'invoice_pdf' check (document_kind = 'invoice_pdf'),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 5242880),
  media_type text not null default 'application/pdf' check (media_type = 'application/pdf'),
  generator_version text not null check (char_length(generator_version) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (invoice_id, document_kind),
  unique (storage_path)
);
create index pos_invoice_documents_user_created_idx
  on public.pos_invoice_documents(user_id, created_at desc);
alter table public.pos_invoice_documents enable row level security;
revoke all on table public.pos_invoice_documents from public, anon, authenticated;
grant select on table public.pos_invoice_documents to authenticated;
grant all on table public.pos_invoice_documents to service_role;
create policy pos_invoice_documents_select_own on public.pos_invoice_documents
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create trigger pos_invoice_documents_immutable
before update or delete on public.pos_invoice_documents
for each row execute function private.pos_prevent_invoice_mutation();
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pos-invoice-originals', 'pos-invoice-originals', false, 5242880, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Namerno ni storage.objects politike za brskalnik. Original lahko ustvari in
-- prebere samo preverjeni strežniški endpoint s service_role; uporabnik dobi
-- dokument šele po preverjanju JWT in lastništva računa.;
