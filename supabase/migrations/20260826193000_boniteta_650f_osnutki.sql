create table if not exists public.boniteta_650f_osnutki (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.boniteta_profili(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','approved','sent')),
  legal_review_status text not null default 'pending' check (legal_review_status in ('pending','legal_review_approved','rejected')),
  template_version text not null,
  draft_payload jsonb not null,
  audit_payload jsonb not null,
  craftsman_confirmed_at timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.boniteta_650f_osnutki enable row level security;
revoke all on public.boniteta_650f_osnutki from public, anon;
grant select, insert on public.boniteta_650f_osnutki to authenticated;
drop policy if exists boniteta_650f_lastni_select on public.boniteta_650f_osnutki;
create policy boniteta_650f_lastni_select on public.boniteta_650f_osnutki for select to authenticated using (auth.uid() = user_id);
drop policy if exists boniteta_650f_lastni_insert on public.boniteta_650f_osnutki;
create policy boniteta_650f_lastni_insert on public.boniteta_650f_osnutki for insert to authenticated with check (auth.uid() = user_id);

create index if not exists boniteta_650f_osnutki_owner_profile_idx
  on public.boniteta_650f_osnutki(user_id, profile_id);

comment on table public.boniteta_650f_osnutki is 'Minimalna revizijska sled osnutkov §650f; posodobitve so namenoma blokirane odjemalcu in legal_review_approved nastavi le ločen pravni strežniški proces.';
