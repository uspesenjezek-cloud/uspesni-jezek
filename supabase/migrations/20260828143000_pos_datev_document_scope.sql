-- A provider document id belongs to one exact DATEV environment and client.
-- Existing unscoped rows remain intentionally unreachable so the first scoped
-- transfer uploads again instead of trusting ambiguous historical state.
alter table public.pos_datev_document_transfers
  add column environment text,
  add column datev_client_id text;

alter table public.pos_datev_document_transfers
  drop constraint pos_datev_document_transfers_user_id_archive_record_id_key;

alter table public.pos_datev_document_transfers
  add constraint pos_datev_document_scope_pair_check check (
    (environment is null and datev_client_id is null)
    or (
      environment in ('mock','sandbox','production')
      and datev_client_id <> ''
      and char_length(datev_client_id) <= 80
    )
  ),
  add constraint pos_datev_document_scope_unique
    unique (user_id, archive_record_id, environment, datev_client_id);

-- EXTF jobs use the same provider boundary. Old unscoped jobs remain audit
-- history but cannot suppress a transfer for a newly identified client.
alter table public.pos_datev_transfer_jobs
  add column datev_client_id text;

alter table public.pos_datev_transfer_jobs
  drop constraint pos_datev_transfer_jobs_user_id_request_id_key;

drop index if exists public.pos_datev_one_active_period_non_mock_uidx;
drop index if exists public.pos_datev_one_running_mock_period_uidx;

alter table public.pos_datev_transfer_jobs
  add constraint pos_datev_job_client_check check (
    datev_client_id is null
    or (datev_client_id <> '' and char_length(datev_client_id) <= 80)
  ),
  add constraint pos_datev_job_request_scope_unique
    unique (user_id, request_id, environment, datev_client_id);

create unique index pos_datev_one_active_period_non_mock_uidx
  on public.pos_datev_transfer_jobs(user_id, period, environment, datev_client_id)
  where environment <> 'mock'
    and datev_client_id is not null
    and status in ('preparing','processing','succeeded');

create unique index pos_datev_one_running_mock_period_uidx
  on public.pos_datev_transfer_jobs(user_id, period, environment, datev_client_id)
  where environment = 'mock'
    and datev_client_id is not null
    and status in ('preparing','processing');

notify pgrst, 'reload schema';
