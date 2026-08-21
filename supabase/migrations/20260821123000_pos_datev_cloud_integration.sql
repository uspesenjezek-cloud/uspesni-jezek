-- DATEV Buchungsdatenservice connection and idempotent transfer ledger.
-- OAuth tokens are encrypted by the application before storage. These tables
-- are service-role only and are never exposed to authenticated browser clients.

create table public.pos_datev_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  environment text not null check (environment in ('mock','sandbox','production')),
  status text not null default 'disconnected' check (status in ('disconnected','connected','error')),
  datev_client_id text not null default '' check (char_length(datev_client_id) <= 80),
  consultant_number integer check (consultant_number is null or consultant_number between 1001 and 9999999),
  client_number integer check (client_number is null or client_number between 1 and 99999),
  client_name text not null default '' check (char_length(client_name) <= 240),
  services jsonb not null default '[]'::jsonb check (jsonb_typeof(services) = 'array'),
  access_token_encrypted text not null default '',
  refresh_token_encrypted text not null default '',
  token_expires_at timestamptz,
  last_verified_at timestamptz,
  last_error_code text not null default '' check (char_length(last_error_code) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status <> 'connected'
    or (datev_client_id <> '' and consultant_number is not null and client_number is not null)
  )
);

create table public.pos_datev_document_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  archive_record_id uuid not null references public.pos_archive_records(id) on delete restrict,
  document_guid uuid not null unique,
  status text not null default 'pending' check (status in ('pending','transferred','error')),
  provider_document_id text not null default '' check (char_length(provider_document_id) <= 160),
  transferred_at timestamptz,
  last_error_code text not null default '' check (char_length(last_error_code) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, archive_record_id),
  check ((status = 'transferred') = (transferred_at is not null))
);

create table public.pos_datev_transfer_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  period text not null check (period ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  environment text not null check (environment in ('mock','sandbox','production')),
  status text not null default 'preparing' check (status in ('preparing','processing','succeeded','failed')),
  provider_job_id text not null default '' check (char_length(provider_job_id) <= 240),
  provider_location text not null default '' check (char_length(provider_location) <= 500),
  retry_after_seconds integer not null default 0 check (retry_after_seconds between 0 and 300),
  file_name text not null default '' check (char_length(file_name) <= 160),
  file_sha256 text check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$'),
  booking_count integer not null default 0 check (booking_count >= 0),
  document_count integer not null default 0 check (document_count >= 0),
  error_code text not null default '' check (char_length(error_code) <= 100),
  error_message text not null default '' check (char_length(error_message) <= 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id),
  check ((status in ('succeeded','failed')) = (completed_at is not null))
);

create unique index pos_datev_one_active_period_uidx
  on public.pos_datev_transfer_jobs(user_id, period)
  where status in ('preparing','processing','succeeded');
create index pos_datev_jobs_user_created_idx on public.pos_datev_transfer_jobs(user_id, created_at desc);
create index pos_datev_documents_user_status_idx on public.pos_datev_document_transfers(user_id, status, updated_at desc);

alter table public.pos_datev_connections enable row level security;
alter table public.pos_datev_document_transfers enable row level security;
alter table public.pos_datev_transfer_jobs enable row level security;

revoke all on table public.pos_datev_connections, public.pos_datev_document_transfers, public.pos_datev_transfer_jobs
  from public, anon, authenticated;
grant all on table public.pos_datev_connections, public.pos_datev_document_transfers, public.pos_datev_transfer_jobs
  to service_role;

notify pgrst, 'reload schema';

