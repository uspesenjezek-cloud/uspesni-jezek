-- ==========================================================
-- Doda "kategorijo" predlogom sporočil (glej sporocilo_predlogi iz
-- prejšnje migracije), da lahko poleg predlogov BESEDILA SPOROČILA (kot
-- doslej) uporabimo isto skupno tabelo tudi za predloge MOŽNOSTI PLAČILA
-- (npr. "Plačilo lahko pokrijete tudi obročno ...") - glej
-- app/neplacila-sporocilo.html in inicializirajSkupinoPredlogov v app.js.
-- ==========================================================

alter table public.sporocilo_predlogi
  add column kategorija text not null default 'sporocilo'
    check (kategorija in ('sporocilo', 'placilo'));

-- Začetne možnosti plačila.
insert into public.sporocilo_predlogi (besedilo, kategorija) values
  ('Plačilo lahko poravnate tudi obročno, v 2 obrokih.', 'placilo'),
  ('Plačilo lahko poravnate tudi obročno, v 3 obrokih.', 'placilo'),
  ('Če želite, se lahko dogovoriva za drugačen način plačila.', 'placilo');
