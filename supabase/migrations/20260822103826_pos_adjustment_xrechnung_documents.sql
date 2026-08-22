-- Nespremenljivi strukturirani popravki izdanih B2B/javnih XRechnung računov.
create table public.pos_adjustment_einvoice_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  adjustment_id uuid not null references public.pos_invoice_adjustments(id) on delete restrict,
  document_kind text not null default 'adjustment_xrechnung_ubl'
    check (document_kind = 'adjustment_xrechnung_ubl'),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 2097152),
  media_type text not null default 'application/xml' check (media_type = 'application/xml'),
  generator_version text not null check (char_length(generator_version) between 1 and 80),
  xrechnung_version text not null check (char_length(xrechnung_version) between 1 and 30),
  validation_status text not null default 'pending' check (validation_status in ('pending','validated','failed')),
  validator_name text not null default 'KoSIT' check (validator_name = 'KoSIT'),
  validator_version text not null check (char_length(validator_version) between 1 and 30),
  validator_config_version text not null check (char_length(validator_config_version) between 1 and 30),
  validation_report jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_report) = 'object'),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adjustment_id, document_kind),
  unique (storage_path),
  check ((validation_status = 'validated' and validated_at is not null)
    or (validation_status <> 'validated' and validated_at is null))
);

create table public.pos_adjustment_einvoice_validation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.pos_adjustment_einvoice_documents(id) on delete restrict,
  result text not null check (result in ('pending','validated','failed')),
  report jsonb not null default '{}'::jsonb check (jsonb_typeof(report) = 'object'),
  created_at timestamptz not null default now()
);

create index pos_adjustment_einvoice_documents_user_created_idx
  on public.pos_adjustment_einvoice_documents(user_id, created_at desc);
create index pos_adjustment_einvoice_documents_pending_idx
  on public.pos_adjustment_einvoice_documents(user_id, updated_at)
  where validation_status <> 'validated';
create index pos_adjustment_einvoice_events_document_created_idx
  on public.pos_adjustment_einvoice_validation_events(document_id, created_at desc);
create index pos_adjustment_einvoice_events_user_created_idx
  on public.pos_adjustment_einvoice_validation_events(user_id, created_at desc);

alter table public.pos_adjustment_einvoice_documents enable row level security;
alter table public.pos_adjustment_einvoice_validation_events enable row level security;
revoke all on table public.pos_adjustment_einvoice_documents,
  public.pos_adjustment_einvoice_validation_events from public,anon,authenticated;
grant select on table public.pos_adjustment_einvoice_documents,
  public.pos_adjustment_einvoice_validation_events to authenticated;
grant all on table public.pos_adjustment_einvoice_documents,
  public.pos_adjustment_einvoice_validation_events to service_role;

create policy pos_adjustment_einvoice_documents_select_own
  on public.pos_adjustment_einvoice_documents for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy pos_adjustment_einvoice_events_select_own
  on public.pos_adjustment_einvoice_validation_events for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function private.pos_protect_adjustment_einvoice_document()
returns trigger language plpgsql set search_path=''
as $$
begin
  if tg_op='DELETE' then raise exception 'Arhiviranega strukturiranega popravka ni dovoljeno izbrisati.'; end if;
  if new.user_id is distinct from old.user_id
    or new.adjustment_id is distinct from old.adjustment_id
    or new.document_kind is distinct from old.document_kind
    or new.storage_path is distinct from old.storage_path
    or new.sha256 is distinct from old.sha256
    or new.byte_size is distinct from old.byte_size
    or new.media_type is distinct from old.media_type
    or new.generator_version is distinct from old.generator_version
    or new.xrechnung_version is distinct from old.xrechnung_version
    or new.created_at is distinct from old.created_at then
    raise exception 'Jedro arhiviranega strukturiranega popravka je nespremenljivo.';
  end if;
  return new;
end;
$$;

revoke all on function private.pos_protect_adjustment_einvoice_document() from public,anon,authenticated;
grant execute on function private.pos_protect_adjustment_einvoice_document() to service_role;

create trigger pos_adjustment_einvoice_documents_protected
before update or delete on public.pos_adjustment_einvoice_documents
for each row execute function private.pos_protect_adjustment_einvoice_document();
create trigger pos_adjustment_einvoice_validation_events_immutable
before update or delete on public.pos_adjustment_einvoice_validation_events
for each row execute function private.pos_prevent_invoice_mutation();

alter table public.pos_archive_records
  drop constraint pos_archive_records_source_table_check,
  add constraint pos_archive_records_source_table_check check (source_table in (
    'pos_invoice_documents','pos_einvoice_documents','pos_adjustment_documents','pos_adjustment_einvoice_documents'
  ));
alter table public.pos_archive_records
  drop constraint pos_archive_records_source_shape_check,
  add constraint pos_archive_records_source_shape_check check (
    (source_table='pos_invoice_documents' and storage_bucket='pos-invoice-originals'
      and document_kind='invoice_pdf' and original_media_type='application/pdf' and byte_size<=5242880)
    or (source_table='pos_einvoice_documents' and storage_bucket='pos-einvoice-originals'
      and document_kind='xrechnung_ubl' and original_media_type='application/xml' and byte_size<=2097152)
    or (source_table='pos_adjustment_documents' and storage_bucket='pos-invoice-originals'
      and document_kind='adjustment_pdf' and original_media_type='application/pdf' and byte_size<=5242880)
    or (source_table='pos_adjustment_einvoice_documents' and storage_bucket='pos-einvoice-originals'
      and document_kind='adjustment_xrechnung_ubl' and original_media_type='application/xml' and byte_size<=2097152)
  );

create or replace function private.pos_archive_document_manifest()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_invoice_id uuid; v_issue_year integer; v_bucket text;
begin
  if tg_table_name in ('pos_adjustment_documents','pos_adjustment_einvoice_documents') then
    select a.original_invoice_id,extract(year from (a.issued_at at time zone 'Europe/Berlin'))::integer
      into v_invoice_id,v_issue_year from public.pos_invoice_adjustments a
      where a.id=new.adjustment_id and a.user_id=new.user_id;
    v_bucket:=case when tg_table_name='pos_adjustment_einvoice_documents'
      then 'pos-einvoice-originals' else 'pos-invoice-originals' end;
  else
    select i.id,extract(year from i.issue_date)::integer into v_invoice_id,v_issue_year
      from public.pos_invoices i where i.id=new.invoice_id and i.user_id=new.user_id;
    v_bucket:=case when tg_table_name='pos_einvoice_documents'
      then 'pos-einvoice-originals' else 'pos-invoice-originals' end;
  end if;
  if v_invoice_id is null or v_issue_year is null then raise exception 'Arhivskega dokumenta ni mogoče povezati z računom.'; end if;
  insert into public.pos_archive_records(user_id,invoice_id,source_table,source_id,storage_bucket,storage_path,
    document_kind,original_media_type,sha256,byte_size,archived_at,retention_years,retention_not_before)
  values(new.user_id,v_invoice_id,tg_table_name,new.id,v_bucket,new.storage_path,new.document_kind,new.media_type,
    new.sha256,new.byte_size,new.created_at,8,make_date(v_issue_year+8,12,31));
  return new;
end;
$$;
revoke all on function private.pos_archive_document_manifest() from public,anon,authenticated;
grant execute on function private.pos_archive_document_manifest() to service_role;

create trigger pos_adjustment_einvoice_documents_archive_manifest
after insert on public.pos_adjustment_einvoice_documents
for each row execute function private.pos_archive_document_manifest();

create or replace function private.pos_validate_archive_record_source()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid; v_invoice_id uuid; v_storage_bucket text; v_storage_path text;
  v_document_kind text; v_media_type text; v_sha256 text; v_byte_size bigint;
  v_archived_at timestamptz; v_retention_not_before date;
begin
  if new.source_table='pos_invoice_documents' then
    select d.user_id,d.invoice_id,'pos-invoice-originals',d.storage_path,d.document_kind,d.media_type,d.sha256,d.byte_size,d.created_at,
      make_date(extract(year from i.issue_date)::integer+8,12,31)
    into v_user_id,v_invoice_id,v_storage_bucket,v_storage_path,v_document_kind,v_media_type,v_sha256,v_byte_size,v_archived_at,v_retention_not_before
    from public.pos_invoice_documents d join public.pos_invoices i on i.id=d.invoice_id where d.id=new.source_id;
  elsif new.source_table='pos_einvoice_documents' then
    select d.user_id,d.invoice_id,'pos-einvoice-originals',d.storage_path,d.document_kind,d.media_type,d.sha256,d.byte_size,d.created_at,
      make_date(extract(year from i.issue_date)::integer+8,12,31)
    into v_user_id,v_invoice_id,v_storage_bucket,v_storage_path,v_document_kind,v_media_type,v_sha256,v_byte_size,v_archived_at,v_retention_not_before
    from public.pos_einvoice_documents d join public.pos_invoices i on i.id=d.invoice_id where d.id=new.source_id;
  elsif new.source_table='pos_adjustment_documents' then
    select d.user_id,a.original_invoice_id,'pos-invoice-originals',d.storage_path,d.document_kind,d.media_type,d.sha256,d.byte_size,d.created_at,
      make_date(extract(year from (a.issued_at at time zone 'Europe/Berlin'))::integer+8,12,31)
    into v_user_id,v_invoice_id,v_storage_bucket,v_storage_path,v_document_kind,v_media_type,v_sha256,v_byte_size,v_archived_at,v_retention_not_before
    from public.pos_adjustment_documents d join public.pos_invoice_adjustments a on a.id=d.adjustment_id where d.id=new.source_id;
  elsif new.source_table='pos_adjustment_einvoice_documents' then
    select d.user_id,a.original_invoice_id,'pos-einvoice-originals',d.storage_path,d.document_kind,d.media_type,d.sha256,d.byte_size,d.created_at,
      make_date(extract(year from (a.issued_at at time zone 'Europe/Berlin'))::integer+8,12,31)
    into v_user_id,v_invoice_id,v_storage_bucket,v_storage_path,v_document_kind,v_media_type,v_sha256,v_byte_size,v_archived_at,v_retention_not_before
    from public.pos_adjustment_einvoice_documents d join public.pos_invoice_adjustments a on a.id=d.adjustment_id where d.id=new.source_id;
  end if;
  if v_user_id is null or
    (new.user_id,new.invoice_id,new.storage_bucket,new.storage_path,new.document_kind,new.original_media_type,
      new.sha256,new.byte_size,new.archived_at,new.retention_not_before) is distinct from
    (v_user_id,v_invoice_id,v_storage_bucket,v_storage_path,v_document_kind,v_media_type,
      v_sha256,v_byte_size,v_archived_at,v_retention_not_before)
    or new.retention_years<>8 or new.retention_basis<>'UStG § 14b; AO § 147'
    or new.encryption_scope<>'provider_managed_at_rest' then
    raise exception 'Arhivski manifest se ne ujema z izvornim dokumentom.';
  end if;
  return new;
end;
$$;
revoke all on function private.pos_validate_archive_record_source() from public,anon,authenticated;
grant execute on function private.pos_validate_archive_record_source() to service_role;

notify pgrst,'reload schema';
