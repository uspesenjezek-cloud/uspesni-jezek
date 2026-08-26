-- Extend the immutable GoBD/WORM chain from the four invoice/adjustment
-- originals to all seven generated POS document kinds.

alter table public.pos_work_orders
  add column is_test boolean not null default true;

update public.pos_work_orders as work_order
set is_test=false
where exists (
  select 1 from public.pos_work_order_invoices link
  join public.pos_invoices invoice on invoice.id=link.invoice_id and invoice.user_id=link.user_id
  where link.work_order_id=work_order.id and link.user_id=work_order.user_id and not invoice.is_test
);

create or replace function private.pos_capture_work_order_archive_environment()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_profile public.pos_business_profiles%rowtype; v_profile_live boolean;
begin
  if old.status='draft' and new.status='offered' then
    select * into v_profile from public.pos_business_profiles where user_id=new.user_id;
    v_profile_live:=found and trim(v_profile.legal_name)<>'' and trim(v_profile.street)<>''
      and trim(v_profile.postal_code)<>'' and trim(v_profile.city)<>''
      and (trim(v_profile.tax_number)<>'' or trim(v_profile.vat_id)<>'')
      and char_length(regexp_replace(v_profile.iban,'\\s','','g')) between 15 and 34
      and trim(v_profile.account_holder)<>'' and trim(v_profile.invoice_prefix)<>'' and v_profile.legal_confirmed;
    new.is_test:=not (v_profile_live and private.pos_archive_production_ready());
  elsif old.status<>'draft' and new.is_test is distinct from old.is_test then
    raise exception 'Arhivskega okolja zaklenjene ponudbe ni dovoljeno spreminjati.';
  end if;
  return new;
end;
$$;
revoke all on function private.pos_capture_work_order_archive_environment() from public,anon,authenticated;
grant execute on function private.pos_capture_work_order_archive_environment() to service_role;
create trigger pos_work_orders_capture_archive_environment
before update of status,is_test on public.pos_work_orders
for each row execute function private.pos_capture_work_order_archive_environment();

drop trigger if exists pos_archive_records_immutable on public.pos_archive_records;

alter table public.pos_archive_records
  add column work_order_id uuid,
  add column procedure_version_id uuid,
  add column is_test boolean;

update public.pos_archive_records as record set is_test=invoice.is_test
from public.pos_invoices as invoice where invoice.id=record.invoice_id;

alter table public.pos_archive_records
  alter column invoice_id drop not null,
  alter column is_test set default true,
  alter column is_test set not null,
  drop constraint pos_archive_records_retention_years_check,
  add constraint pos_archive_records_retention_years_check check (retention_years in (8,10)),
  drop constraint pos_archive_records_storage_bucket_check,
  add constraint pos_archive_records_storage_bucket_check check (storage_bucket in (
    'pos-invoice-originals','pos-einvoice-originals','pos-offer-originals','pos-procedure-documents'
  )),
  drop constraint pos_archive_records_source_table_check,
  add constraint pos_archive_records_source_table_check check (source_table in (
    'pos_invoice_documents','pos_einvoice_documents','pos_adjustment_documents','pos_adjustment_einvoice_documents',
    'pos_offer_documents','pos_contract_confirmation_documents','pos_procedure_document_versions'
  )),
  drop constraint pos_archive_records_source_shape_check,
  add constraint pos_archive_records_source_shape_check check (
    (source_table='pos_invoice_documents' and invoice_id is not null and work_order_id is null and procedure_version_id is null
      and storage_bucket='pos-invoice-originals' and document_kind='invoice_pdf' and original_media_type='application/pdf' and byte_size<=5242880 and retention_years=8)
    or (source_table='pos_einvoice_documents' and invoice_id is not null and work_order_id is null and procedure_version_id is null
      and storage_bucket='pos-einvoice-originals' and document_kind='xrechnung_ubl' and original_media_type='application/xml' and byte_size<=2097152 and retention_years=8)
    or (source_table='pos_adjustment_documents' and invoice_id is not null and work_order_id is null and procedure_version_id is null
      and storage_bucket='pos-invoice-originals' and document_kind='adjustment_pdf' and original_media_type='application/pdf' and byte_size<=5242880 and retention_years=8)
    or (source_table='pos_adjustment_einvoice_documents' and invoice_id is not null and work_order_id is null and procedure_version_id is null
      and storage_bucket='pos-einvoice-originals' and document_kind='adjustment_xrechnung_ubl' and original_media_type='application/xml' and byte_size<=2097152 and retention_years=8)
    or (source_table='pos_offer_documents' and invoice_id is null and work_order_id is not null and procedure_version_id is null
      and storage_bucket='pos-offer-originals' and document_kind='offer_pdf' and original_media_type='application/pdf' and byte_size<=5242880 and retention_years=8)
    or (source_table='pos_contract_confirmation_documents' and invoice_id is null and work_order_id is not null and procedure_version_id is null
      and storage_bucket='pos-offer-originals' and document_kind='contract_confirmation_pdf' and original_media_type='application/pdf' and byte_size<=5242880 and retention_years=8)
    or (source_table='pos_procedure_document_versions' and invoice_id is null and work_order_id is null and procedure_version_id is not null
      and storage_bucket='pos-procedure-documents' and document_kind='procedure_document_pdf' and original_media_type='application/pdf' and byte_size<=5242880 and retention_years=10)
  );

alter table public.pos_procedure_document_versions
  add constraint pos_procedure_document_versions_id_user_key unique(id,user_id);
alter table public.pos_archive_records
  add constraint pos_archive_records_work_order_user_fk foreign key(work_order_id,user_id)
    references public.pos_work_orders(id,user_id) on delete restrict,
  add constraint pos_archive_records_procedure_version_user_fk foreign key(procedure_version_id,user_id)
    references public.pos_procedure_document_versions(id,user_id) on delete restrict;
create index pos_archive_records_work_order_user_idx on public.pos_archive_records(work_order_id,user_id) where work_order_id is not null;
create index pos_archive_records_procedure_version_user_idx on public.pos_archive_records(procedure_version_id,user_id) where procedure_version_id is not null;

create or replace function private.pos_archive_document_manifest()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_invoice_id uuid; v_work_order_id uuid; v_procedure_version_id uuid; v_archive_year integer;
  v_bucket text; v_kind text; v_media_type text; v_retention_years smallint:=8;
  v_retention_basis text:='UStG § 14b; AO § 147'; v_is_test boolean;
begin
  if tg_table_name in ('pos_invoice_documents','pos_einvoice_documents') then
    select i.id,extract(year from i.issue_date)::integer,i.is_test into v_invoice_id,v_archive_year,v_is_test
    from public.pos_invoices i where i.id=new.invoice_id and i.user_id=new.user_id;
    v_bucket:=case when tg_table_name='pos_einvoice_documents' then 'pos-einvoice-originals' else 'pos-invoice-originals' end;
    v_kind:=new.document_kind; v_media_type:=new.media_type;
  elsif tg_table_name in ('pos_adjustment_documents','pos_adjustment_einvoice_documents') then
    select a.original_invoice_id,extract(year from (a.issued_at at time zone 'Europe/Berlin'))::integer,i.is_test
      into v_invoice_id,v_archive_year,v_is_test from public.pos_invoice_adjustments a
      join public.pos_invoices i on i.id=a.original_invoice_id and i.user_id=a.user_id
      where a.id=new.adjustment_id and a.user_id=new.user_id;
    v_bucket:=case when tg_table_name='pos_adjustment_einvoice_documents' then 'pos-einvoice-originals' else 'pos-invoice-originals' end;
    v_kind:=new.document_kind; v_media_type:=new.media_type;
  elsif tg_table_name='pos_offer_documents' then
    select w.id,extract(year from (new.created_at at time zone 'Europe/Berlin'))::integer,w.is_test
      into v_work_order_id,v_archive_year,v_is_test from public.pos_work_orders w
      where w.id=new.work_order_id and w.user_id=new.user_id;
    v_bucket:='pos-offer-originals'; v_kind:=new.document_kind; v_media_type:=new.media_type;
  elsif tg_table_name='pos_contract_confirmation_documents' then
    select w.id,extract(year from (new.created_at at time zone 'Europe/Berlin'))::integer,w.is_test
      into v_work_order_id,v_archive_year,v_is_test from public.pos_work_orders w
      where w.id=new.work_order_id and w.user_id=new.user_id;
    v_bucket:='pos-offer-originals'; v_kind:='contract_confirmation_pdf'; v_media_type:=new.media_type;
  elsif tg_table_name='pos_procedure_document_versions' then
    v_procedure_version_id:=new.id; v_archive_year:=extract(year from (new.created_at at time zone 'Europe/Berlin'))::integer;
    v_is_test:=new.environment<>'production'; v_bucket:=new.storage_bucket; v_kind:='procedure_document_pdf';
    v_media_type:=new.media_type; v_retention_years:=10; v_retention_basis:=new.retention_basis;
  end if;
  if v_archive_year is null or v_is_test is null then raise exception 'Arhivskega dokumenta ni mogoče povezati z izvorom.'; end if;
  insert into public.pos_archive_records(user_id,invoice_id,work_order_id,procedure_version_id,is_test,source_table,source_id,
    storage_bucket,storage_path,document_kind,original_media_type,sha256,byte_size,archived_at,retention_years,
    retention_not_before,retention_basis)
  values(new.user_id,v_invoice_id,v_work_order_id,v_procedure_version_id,v_is_test,tg_table_name,new.id,
    v_bucket,new.storage_path,v_kind,v_media_type,new.sha256,new.byte_size,new.created_at,v_retention_years,
    make_date(v_archive_year+v_retention_years,12,31),v_retention_basis)
  on conflict(source_table,source_id) do nothing;
  return new;
end;
$$;
revoke all on function private.pos_archive_document_manifest() from public,anon,authenticated;
grant execute on function private.pos_archive_document_manifest() to service_role;

create or replace function private.pos_validate_archive_record_source()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid; v_invoice_id uuid; v_work_order_id uuid; v_procedure_version_id uuid; v_is_test boolean;
  v_bucket text; v_path text; v_kind text; v_media text; v_sha text; v_bytes bigint; v_archived timestamptz;
  v_years smallint; v_not_before date; v_basis text;
begin
  if new.source_table='pos_invoice_documents' then
    select d.user_id,d.invoice_id,null,null,i.is_test,'pos-invoice-originals',d.storage_path,d.document_kind,d.media_type,d.sha256,d.byte_size,d.created_at,8,
      make_date(extract(year from i.issue_date)::integer+8,12,31),'UStG § 14b; AO § 147'
      into v_user_id,v_invoice_id,v_work_order_id,v_procedure_version_id,v_is_test,v_bucket,v_path,v_kind,v_media,v_sha,v_bytes,v_archived,v_years,v_not_before,v_basis
      from public.pos_invoice_documents d join public.pos_invoices i on i.id=d.invoice_id where d.id=new.source_id;
  elsif new.source_table='pos_einvoice_documents' then
    select d.user_id,d.invoice_id,null,null,i.is_test,'pos-einvoice-originals',d.storage_path,d.document_kind,d.media_type,d.sha256,d.byte_size,d.created_at,8,
      make_date(extract(year from i.issue_date)::integer+8,12,31),'UStG § 14b; AO § 147'
      into v_user_id,v_invoice_id,v_work_order_id,v_procedure_version_id,v_is_test,v_bucket,v_path,v_kind,v_media,v_sha,v_bytes,v_archived,v_years,v_not_before,v_basis
      from public.pos_einvoice_documents d join public.pos_invoices i on i.id=d.invoice_id where d.id=new.source_id;
  elsif new.source_table in ('pos_adjustment_documents','pos_adjustment_einvoice_documents') then
    if new.source_table='pos_adjustment_documents' then
      select d.user_id,a.original_invoice_id,null,null,i.is_test,'pos-invoice-originals',d.storage_path,d.document_kind,d.media_type,d.sha256,d.byte_size,d.created_at,8,
        make_date(extract(year from (a.issued_at at time zone 'Europe/Berlin'))::integer+8,12,31),'UStG § 14b; AO § 147'
        into v_user_id,v_invoice_id,v_work_order_id,v_procedure_version_id,v_is_test,v_bucket,v_path,v_kind,v_media,v_sha,v_bytes,v_archived,v_years,v_not_before,v_basis
        from public.pos_adjustment_documents d join public.pos_invoice_adjustments a on a.id=d.adjustment_id
        join public.pos_invoices i on i.id=a.original_invoice_id where d.id=new.source_id;
    else
      select d.user_id,a.original_invoice_id,null,null,i.is_test,'pos-einvoice-originals',d.storage_path,d.document_kind,d.media_type,d.sha256,d.byte_size,d.created_at,8,
        make_date(extract(year from (a.issued_at at time zone 'Europe/Berlin'))::integer+8,12,31),'UStG § 14b; AO § 147'
        into v_user_id,v_invoice_id,v_work_order_id,v_procedure_version_id,v_is_test,v_bucket,v_path,v_kind,v_media,v_sha,v_bytes,v_archived,v_years,v_not_before,v_basis
        from public.pos_adjustment_einvoice_documents d join public.pos_invoice_adjustments a on a.id=d.adjustment_id
        join public.pos_invoices i on i.id=a.original_invoice_id where d.id=new.source_id;
    end if;
  elsif new.source_table='pos_offer_documents' then
    select d.user_id,null,d.work_order_id,null,w.is_test,'pos-offer-originals',d.storage_path,d.document_kind,d.media_type,d.sha256,d.byte_size,d.created_at,8,
      make_date(extract(year from (d.created_at at time zone 'Europe/Berlin'))::integer+8,12,31),'UStG § 14b; AO § 147'
      into v_user_id,v_invoice_id,v_work_order_id,v_procedure_version_id,v_is_test,v_bucket,v_path,v_kind,v_media,v_sha,v_bytes,v_archived,v_years,v_not_before,v_basis
      from public.pos_offer_documents d join public.pos_work_orders w on w.id=d.work_order_id where d.id=new.source_id;
  elsif new.source_table='pos_contract_confirmation_documents' then
    select d.user_id,null,d.work_order_id,null,w.is_test,'pos-offer-originals',d.storage_path,'contract_confirmation_pdf',d.media_type,d.sha256,d.byte_size,d.created_at,8,
      make_date(extract(year from (d.created_at at time zone 'Europe/Berlin'))::integer+8,12,31),'UStG § 14b; AO § 147'
      into v_user_id,v_invoice_id,v_work_order_id,v_procedure_version_id,v_is_test,v_bucket,v_path,v_kind,v_media,v_sha,v_bytes,v_archived,v_years,v_not_before,v_basis
      from public.pos_contract_confirmation_documents d join public.pos_work_orders w on w.id=d.work_order_id where d.id=new.source_id;
  elsif new.source_table='pos_procedure_document_versions' then
    select d.user_id,null,null,d.id,d.environment<>'production',d.storage_bucket,d.storage_path,'procedure_document_pdf',d.media_type,d.sha256,d.byte_size,d.created_at,
      d.retention_years,d.retention_not_before,d.retention_basis
      into v_user_id,v_invoice_id,v_work_order_id,v_procedure_version_id,v_is_test,v_bucket,v_path,v_kind,v_media,v_sha,v_bytes,v_archived,v_years,v_not_before,v_basis
      from public.pos_procedure_document_versions d where d.id=new.source_id;
  end if;
  if v_user_id is null or (new.user_id,new.invoice_id,new.work_order_id,new.procedure_version_id,new.is_test,
      new.storage_bucket,new.storage_path,new.document_kind,new.original_media_type,new.sha256,new.byte_size,new.archived_at,
      new.retention_years,new.retention_not_before,new.retention_basis,new.encryption_scope) is distinct from
    (v_user_id,v_invoice_id,v_work_order_id,v_procedure_version_id,v_is_test,v_bucket,v_path,v_kind,v_media,v_sha,v_bytes,v_archived,
      v_years,v_not_before,v_basis,'provider_managed_at_rest') then
    raise exception 'Arhivski manifest se ne ujema z izvornim dokumentom.';
  end if;
  return new;
end;
$$;
revoke all on function private.pos_validate_archive_record_source() from public,anon,authenticated;
grant execute on function private.pos_validate_archive_record_source() to service_role;

create trigger pos_offer_documents_archive_manifest after insert on public.pos_offer_documents
for each row execute function private.pos_archive_document_manifest();
create trigger pos_contract_confirmation_documents_archive_manifest after insert on public.pos_contract_confirmation_documents
for each row execute function private.pos_archive_document_manifest();
create trigger pos_procedure_document_versions_archive_manifest after insert on public.pos_procedure_document_versions
for each row execute function private.pos_archive_document_manifest();

insert into public.pos_archive_records(user_id,work_order_id,is_test,source_table,source_id,storage_bucket,storage_path,
  document_kind,original_media_type,sha256,byte_size,archived_at,retention_years,retention_not_before)
select d.user_id,d.work_order_id,w.is_test,'pos_offer_documents',d.id,'pos-offer-originals',d.storage_path,d.document_kind,
  d.media_type,d.sha256,d.byte_size,d.created_at,8,make_date(extract(year from (d.created_at at time zone 'Europe/Berlin'))::integer+8,12,31)
from public.pos_offer_documents d join public.pos_work_orders w on w.id=d.work_order_id and w.user_id=d.user_id
on conflict(source_table,source_id) do nothing;

insert into public.pos_archive_records(user_id,work_order_id,is_test,source_table,source_id,storage_bucket,storage_path,
  document_kind,original_media_type,sha256,byte_size,archived_at,retention_years,retention_not_before)
select d.user_id,d.work_order_id,w.is_test,'pos_contract_confirmation_documents',d.id,'pos-offer-originals',d.storage_path,
  'contract_confirmation_pdf',d.media_type,d.sha256,d.byte_size,d.created_at,8,
  make_date(extract(year from (d.created_at at time zone 'Europe/Berlin'))::integer+8,12,31)
from public.pos_contract_confirmation_documents d join public.pos_work_orders w on w.id=d.work_order_id and w.user_id=d.user_id
on conflict(source_table,source_id) do nothing;

insert into public.pos_archive_records(user_id,procedure_version_id,is_test,source_table,source_id,storage_bucket,storage_path,
  document_kind,original_media_type,sha256,byte_size,archived_at,retention_years,retention_not_before,retention_basis)
select d.user_id,d.id,d.environment<>'production','pos_procedure_document_versions',d.id,d.storage_bucket,d.storage_path,
  'procedure_document_pdf',d.media_type,d.sha256,d.byte_size,d.created_at,10,d.retention_not_before,d.retention_basis
from public.pos_procedure_document_versions d on conflict(source_table,source_id) do nothing;

create trigger pos_archive_records_immutable before update or delete on public.pos_archive_records
for each row execute function private.pos_prevent_invoice_mutation();

create or replace function private.pos_archive_production_ready()
returns boolean language sql stable security definer set search_path=''
as $$
  select coalesce((select configuration.independent_backup_ready and configuration.worm_provider_ready
    and configuration.worm_provider='aws_s3_object_lock' and configuration.worm_environment='production'
    and configuration.worm_object_lock_mode='COMPLIANCE'
    and configuration.worm_connectivity_tested_at>=now()-interval '30 days'
    and configuration.recovery_tested_at>=now()-interval '365 days'
    and exists(select 1 from public.pos_archive_replicas replica where replica.status='verified'
      and replica.object_lock_mode='COMPLIANCE' and replica.verified_at>=now()-interval '90 days')
    and not exists(select 1 from public.pos_archive_records record where not record.is_test and not exists(
      select 1 from public.pos_archive_replicas replica where replica.archive_record_id=record.id
        and replica.status='verified' and replica.object_lock_mode='COMPLIANCE'
        and replica.remote_checksum_sha256=record.sha256 and replica.remote_byte_size=record.byte_size
        and replica.retain_until>=(record.retention_not_before::timestamptz+interval '1 day'-interval '1 millisecond')
    )) from private.pos_archive_configuration configuration where configuration.singleton),false);
$$;
revoke all on function private.pos_archive_production_ready() from public,anon,authenticated;
grant execute on function private.pos_archive_production_ready() to service_role;

drop function public.pos_archive_replica_batch(integer);
create function public.pos_archive_replica_batch(p_limit integer default 10)
returns table(replica_id uuid,replica_attempt_count integer,replica_bucket text,replica_object_key text,
  replica_object_version_id text,replica_object_lock_mode text,replica_retain_until timestamptz,id uuid,user_id uuid,
  invoice_id uuid,source_table text,source_id uuid,storage_bucket text,storage_path text,original_media_type text,
  sha256 text,byte_size bigint,retention_not_before date,is_test boolean)
language plpgsql security definer set search_path=''
as $$
begin
  if coalesce((select auth.jwt()->>'role'),'')<>'service_role' then raise exception 'Service role is required.'; end if;
  return query with candidates as (
    select replica.id from public.pos_archive_replicas replica where
      (replica.status in ('pending','failed') and replica.next_attempt_at<=now())
      or (replica.status='copying' and replica.last_attempt_at<now()-interval '15 minutes')
      or (replica.status='verified' and not exists(select 1 from public.pos_archive_replica_events event
        where event.replica_id=replica.id and event.result='verified' and event.checked_at>=now()-interval '90 days'))
    order by replica.next_attempt_at,replica.created_at for update skip locked
    limit least(greatest(coalesce(p_limit,10),1),25)
  ), claimed as (
    update public.pos_archive_replicas replica set status='copying',attempt_count=replica.attempt_count+1,
      last_attempt_at=now(),last_error_code=null from candidates where replica.id=candidates.id returning replica.*
  ) select claimed.id,claimed.attempt_count,claimed.bucket,claimed.object_key,claimed.object_version_id,
    claimed.object_lock_mode,claimed.retain_until,record.id,record.user_id,record.invoice_id,record.source_table,
    record.source_id,record.storage_bucket,record.storage_path,record.original_media_type,record.sha256,record.byte_size,
    record.retention_not_before,record.is_test from claimed join public.pos_archive_records record
    on record.id=claimed.archive_record_id order by claimed.created_at;
end;
$$;
revoke all on function public.pos_archive_replica_batch(integer) from public,anon,authenticated;
grant execute on function public.pos_archive_replica_batch(integer) to service_role;

notify pgrst,'reload schema';

;
