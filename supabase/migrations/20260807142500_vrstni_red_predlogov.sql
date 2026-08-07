-- Ročni vrstni red predlogov (obrtnik ga lahko spreminja s puščicami
-- levo/desno v način "Uredi", glej app.js) - ločen po kategoriji, da imata
-- "sporocilo" in "placilo" vsak svoje zaporedje.
alter table public.sporocilo_predlogi
  add column vrstni_red integer not null default 0;

-- Začetni vrstni red za obstoječe predloge - po trenutnem vrstnem redu
-- prikaza (datum dodajanja), ločeno po kategoriji.
with ostevilceno as (
  select
    id,
    row_number() over (partition by kategorija order by ustvarjeno_at asc) as zaporedje
  from public.sporocilo_predlogi
)
update public.sporocilo_predlogi as p
set vrstni_red = ostevilceno.zaporedje
from ostevilceno
where p.id = ostevilceno.id;

-- Posodabljanje predloga (samo za spreminjanje vrstnega reda uporablja
-- app.js, a je - enako kot brisanje - odprto vsem obrtnikom, glej odločitev
-- pri migraciji 20260807140500).
create policy "Obrtnik posodobi katerikoli predlog"
on public.sporocilo_predlogi
for update
to authenticated
using ( true )
with check ( true );

grant update on public.sporocilo_predlogi to authenticated;
