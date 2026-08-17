-- Prazna kartica na eni napravi ne sme prepisati ze izbranega odvetnika.
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
       and nullif(btrim(excluded.predaja_odvetniku #>> '{lawyerHandoff,lawyerSnapshot,name}'), '') is not null
       and (
         public.opomin_kartice_nastavitve.predaja_updated_at is null
         or excluded.predaja_updated_at >= public.opomin_kartice_nastavitve.predaja_updated_at
       ) then excluded.predaja_odvetniku
      else public.opomin_kartice_nastavitve.predaja_odvetniku
    end,
    predaja_updated_at = case
      when excluded.predaja_odvetniku is not null
       and nullif(btrim(excluded.predaja_odvetniku #>> '{lawyerHandoff,lawyerSnapshot,name}'), '') is not null
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

-- Ce je prvo odprtje nove kode ze poslalo prazno kartico, jo obnovimo iz
-- nazadnje shranjenega aktivnega nacrta istega uporabnika.
with zadnji_nacrti as (
  select distinct on (z.obrtnik_id)
    z.obrtnik_id,
    z.opomin_nacrt,
    jsonb_path_query_first(
      z.opomin_nacrt,
      '$.steps[*] ? (@.kind == "manual_lawyer")'
    ) as korak
  from public.zadeve z
  where z.opomin_nacrt is not null
  order by z.obrtnik_id, z.posodobljeno_at desc
)
update public.opomin_kartice_nastavitve n
set
  predaja_odvetniku = jsonb_build_object(
    'title', coalesce(z.korak->'title', '"Predaja odvetniku"'::jsonb),
    'scheduledAt', coalesce(z.korak->'scheduledAt', z.korak->'sendAt', 'null'::jsonb),
    'status', coalesce(z.korak->'status', '"draft"'::jsonb),
    'lawyerHandoff', z.korak->'lawyerHandoff'
  ),
  predaja_updated_at = now(),
  client_id = 'server-reconcile',
  updated_at = now()
from zadnji_nacrti z
where n.user_id = z.obrtnik_id
  and nullif(btrim(z.korak #>> '{lawyerHandoff,lawyerSnapshot,name}'), '') is not null
  and nullif(btrim(n.predaja_odvetniku #>> '{lawyerHandoff,lawyerSnapshot,name}'), '') is null;
