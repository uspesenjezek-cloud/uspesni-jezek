-- Napoved prometa na produkciji: zgodovina se zbira samodejno.
--
-- 1) Vsak zajem dobi tip dneva in lokalni 15-min interval (izračuna ju
--    zbiralnik s koledarjem praznikov), da se profil računa v bazi.
-- 2) promet_preracunaj_profil(): p85/mediana zamude po (vir, celica, tip
--    dneva, interval) iz zadnjih 56 dni — enaka pravila kot
--    api/_lib/promet/profil.js (nearest rank, zajemi brez zastoja štejejo 0,
--    zastoj brez navedene zamude 120 s na celico).
-- 3) pg_cron: vsakih 15 min pokliče zbiralnik (/api/promet-zbiraj),
--    vsako noč preračuna profil in počisti stare podatke.

alter table public.promet_zajem add column if not exists tip_dneva text;
alter table public.promet_zajem add column if not exists interval smallint;
create index if not exists promet_zajem_uspeh_cas_idx on public.promet_zajem (cas desc) where uspeh;

create or replace function public.promet_preracunaj_profil(p_dni integer default 56)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.promet_pokritost where true;
  insert into public.promet_pokritost (vir, tip_dneva, interval, n_vzorcev)
  select z.vir, z.tip_dneva, z.interval, count(*)
  from public.promet_zajem z
  where z.uspeh and z.tip_dneva is not null and z.interval is not null
    and z.cas >= now() - make_interval(days => greatest(p_dni, 7))
  group by z.vir, z.tip_dneva, z.interval;

  delete from public.promet_profil where true;
  insert into public.promet_profil (vir, celica, tip_dneva, interval, n_vzorcev, p_zastoja, mediana_s, p85_s, verzija)
  with z as (
    select id, vir, tip_dneva, interval
    from public.promet_zajem
    where uspeh and tip_dneva is not null and interval is not null
      and cas >= now() - make_interval(days => greatest(p_dni, 7))
  ),
  na_zajem as (
    select z.vir, o.celica, z.tip_dneva, z.interval, o.zajem_id,
           sum(case when o.zamuda_s is null then 120 else greatest(o.zamuda_s, 0) end) as zamuda
    from public.promet_opazovanje o
    join z on z.id = o.zajem_id
    group by z.vir, o.celica, z.tip_dneva, z.interval, o.zajem_id
  ),
  rangirano as (
    select a.*,
           row_number() over (partition by a.vir, a.celica, a.tip_dneva, a.interval order by a.zamuda, a.zajem_id) as rn,
           count(*) over (partition by a.vir, a.celica, a.tip_dneva, a.interval) as k,
           p.n_vzorcev as n
    from na_zajem a
    join public.promet_pokritost p
      on p.vir = a.vir and p.tip_dneva = a.tip_dneva and p.interval = a.interval
  )
  select vir, celica, tip_dneva, interval,
         max(n),
         round(max(k)::numeric / max(n), 3),
         coalesce(max(zamuda) filter (where rn = greatest(1, ceil(0.5 * n)) - (n - k)), 0),
         coalesce(max(zamuda) filter (where rn = greatest(1, ceil(0.85 * n)) - (n - k)), 0),
         1
  from rangirano
  group by vir, celica, tip_dneva, interval;
end;
$$;

revoke all on function public.promet_preracunaj_profil(integer) from public, anon, authenticated;
grant execute on function public.promet_preracunaj_profil(integer) to service_role;

-- Samodejni zagon (brezplačno v Supabase): pg_cron + pg_net.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('promet-zbiraj', 'promet-profil');
end;
$$;

-- Zbiralnik sam preskoči klic, če je bil zadnji zajem pred manj kot 12 min,
-- zato podvojeni ali ročni klici ne podvajajo podatkov.
select cron.schedule(
  'promet-zbiraj',
  '*/15 * * * *',
  $$select net.http_get(
      url := 'https://uspesni-jezek.vercel.app/api/promet-zbiraj',
      timeout_milliseconds := 60000
    );$$
);

select cron.schedule(
  'promet-profil',
  '41 1 * * *',
  $$select public.promet_preracunaj_profil(56); select public.promet_pocisti(56);$$
);
