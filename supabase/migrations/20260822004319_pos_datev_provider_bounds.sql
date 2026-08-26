-- OAuth tokens are encrypted before storage, but provider-controlled token
-- sizes still need an explicit upper bound.

alter table public.pos_datev_connections
  add constraint pos_datev_connections_access_token_size_check
    check (octet_length(access_token_encrypted) <= 16384) not valid,
  add constraint pos_datev_connections_refresh_token_size_check
    check (octet_length(refresh_token_encrypted) <= 16384) not valid;

alter table public.pos_datev_connections
  validate constraint pos_datev_connections_access_token_size_check,
  validate constraint pos_datev_connections_refresh_token_size_check;;
