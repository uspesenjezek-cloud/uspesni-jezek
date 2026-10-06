-- Dejanske vožnje na delovne naloge (gumba »Odhajam« / »Na lokaciji«).
-- Shranimo napoved ob odhodu in dejanski čas vožnje, da se napoved
-- pozneje umeri (napoved proti dejanskemu) in da se meri točnost.
-- Zapisuje samo strežnik (/api/promet-voznja); uporabnik bere samo svoje.

create table if not exists public.promet_voznja (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  datum date not null,
  nalog_id text not null,
  stranka text,
  od_naslov text,
  do_naslov text,
  nacrtovan_prihod text,
  napoved_odhod text,
  napoved_prosto_min integer,
  napoved_varno_min integer,
  napoved_osnova text,
  vreme jsonb,
  odhod timestamptz,
  prihod timestamptz,
  dejansko_min integer,
  ustvarjeno timestamptz not null default now(),
  posodobljeno timestamptz not null default now(),
  unique (user_id, datum, nalog_id)
);

create index if not exists promet_voznja_user_datum_idx on public.promet_voznja (user_id, datum desc);

alter table public.promet_voznja enable row level security;

drop policy if exists promet_voznja_beri_svoje on public.promet_voznja;
create policy promet_voznja_beri_svoje on public.promet_voznja
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.promet_voznja from anon, authenticated;
grant select on public.promet_voznja to authenticated;
