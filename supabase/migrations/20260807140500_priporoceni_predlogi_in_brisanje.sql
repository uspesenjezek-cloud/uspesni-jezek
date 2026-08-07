-- 1. Oznaka "priporočeno" (zvezdica) za predloge, ki jih pripravi ekipa
--    Uspešnega Jezeka - obrtniki jih ne morejo urediti/izbrisati po pomoti,
--    ker jih ni videti drugače kot navadne predloge, dobijo pa zvezdico.
alter table public.sporocilo_predlogi
  add column priporoceno boolean not null default false;

-- Oznaci obstoječih 6 predlogov sporočila kot priporočene.
update public.sporocilo_predlogi
set priporoceno = true
where kategorija = 'sporocilo'
  and besedilo in (
    'Živjo, prosim da danes poravnate priloženi račun. Hvala za razumevanje!',
    'Pozdravljeni, opažam, da račun še ni poravnan. Prosim, da ga čim prej plačate.',
    'Pozdravljeni, gre za prijazen opomin, da je račun že zapadel. Hvala za hitro poravnavo.',
    'Živjo, verjetno ste pozabili na plačilo računa - prosim, da to čim prej uredite.',
    'Pozdravljeni, to je zadnji opomin pred nadaljnjimi koraki. Prosim, poravnajte račun v naslednjih dneh.',
    'Pozdravljeni, žal do sedaj nismo prejeli plačila. Če je prišlo do nesporazuma, prosim, javite se mi.'
  );

-- Oznaci obstoječe 3 možnosti plačila kot priporočene.
update public.sporocilo_predlogi
set priporoceno = true
where kategorija = 'placilo'
  and besedilo in (
    'Plačilo lahko poravnate tudi obročno, v 2 obrokih.',
    'Plačilo lahko poravnate tudi obročno, v 3 obrokih.',
    'Če želite, se lahko dogovoriva za drugačen način plačila.'
  );

-- 2. Brisanje predlogov - vsak prijavljen obrtnik lahko izbriše katerikoli
--    predlog (skupna knjižnica, ni omejeno samo na predloge, ki jih je sam
--    dodal) - odločitev obrtnika, ki je bila usklajena z uporabnikom.
create policy "Obrtnik izbrise katerikoli predlog"
on public.sporocilo_predlogi
for delete
to authenticated
using ( true );

grant delete on public.sporocilo_predlogi to authenticated;
