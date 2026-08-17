alter table public.opomin_kartice_nastavitve
  add column if not exists predaja_odvetniku jsonb,
  add column if not exists predaja_updated_at timestamptz;

create or replace function public.sinhroniziraj_opomin_kartice(
  p_vkljuceni_indeksi smallint[],
  p_client_id text,
  p_settings_updated_at timestamptz,
  p_predaja_odvetniku jsonb,
  p_predaja_updated_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Prijava je obvezna.' using errcode = '42501';
  end if;

  insert into public.opomin_kartice_nastavitve (
    user_id,
    vkljuceni_indeksi,
    client_id,
    settings_updated_at,
    updated_at,
    predaja_odvetniku,
    predaja_updated_at
  ) values (
    (select auth.uid()),
    p_vkljuceni_indeksi,
    p_client_id,
    p_settings_updated_at,
    now(),
    p_predaja_odvetniku,
    p_predaja_updated_at
  )
  on conflict (user_id) do update set
    vkljuceni_indeksi = case
      when excluded.settings_updated_at >= public.opomin_kartice_nastavitve.settings_updated_at
        then excluded.vkljuceni_indeksi
      else public.opomin_kartice_nastavitve.vkljuceni_indeksi
    end,
    settings_updated_at = greatest(
      excluded.settings_updated_at,
      public.opomin_kartice_nastavitve.settings_updated_at
    ),
    predaja_odvetniku = case
      when excluded.predaja_odvetniku is not null
       and (
         public.opomin_kartice_nastavitve.predaja_updated_at is null
         or excluded.predaja_updated_at >= public.opomin_kartice_nastavitve.predaja_updated_at
       ) then excluded.predaja_odvetniku
      else public.opomin_kartice_nastavitve.predaja_odvetniku
    end,
    predaja_updated_at = case
      when excluded.predaja_odvetniku is not null
       and (
         public.opomin_kartice_nastavitve.predaja_updated_at is null
         or excluded.predaja_updated_at >= public.opomin_kartice_nastavitve.predaja_updated_at
       ) then excluded.predaja_updated_at
      else public.opomin_kartice_nastavitve.predaja_updated_at
    end,
    client_id = excluded.client_id,
    updated_at = now();
end;
$$;

revoke all on function public.sinhroniziraj_opomin_kartice(
  smallint[], text, timestamptz, jsonb, timestamptz
) from public, anon;
grant execute on function public.sinhroniziraj_opomin_kartice(
  smallint[], text, timestamptz, jsonb, timestamptz
) to authenticated;;
