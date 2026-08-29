-- DATEV refresh tokens are single-use. Serialize refresh-token rotation so two
-- concurrent API requests cannot redeem the same token and invalidate the
-- complete DATEV session.

alter table public.pos_datev_connections
  add column refresh_claim_id uuid,
  add column refresh_claimed_at timestamptz,
  add constraint pos_datev_refresh_claim_pair_check
    check ((refresh_claim_id is null) = (refresh_claimed_at is null));

create or replace function public.claim_pos_datev_refresh(
  p_user_id uuid,
  p_environment text,
  p_claim_id uuid
)
returns setof public.pos_datev_connections
language sql
security definer
set search_path = ''
as $$
  update public.pos_datev_connections
     set refresh_claim_id = p_claim_id,
         refresh_claimed_at = now(),
         updated_at = now()
   where user_id = p_user_id
     and environment = p_environment
     and status = 'connected'
     and refresh_token_encrypted <> ''
     and (token_expires_at is null or token_expires_at <= now() + interval '60 seconds')
     and (refresh_claim_id is null or refresh_claimed_at < now() - interval '2 minutes')
  returning *;
$$;

revoke all on function public.claim_pos_datev_refresh(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_pos_datev_refresh(uuid, text, uuid) to service_role;

notify pgrst, 'reload schema';
