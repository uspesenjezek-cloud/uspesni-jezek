-- Razširi šest področij v 28 stabilnih Lego modulov brez brisanja odgovorov.
update public.offer_review_modules set sort_order = sort_order + 100 where sort_order < 100;

insert into public.offer_review_modules (id,code,label,description,sort_order) values
(4000,'c00','Potrditev razumevanja','Potrdite, kaj je Atena razumela',1),
(4001,'c01','Vloga ponudnika','Izvajalec, prodajalec ali posrednik',2),
(4002,'c02','Odnos in vir ponudbe','Kako je ponudba prišla do vas',3),
(4003,'c03','Oblika sodelovanja','Nakup, projekt, naročnina ali najem',4),
(4004,'s01','Predmet ponudbe','Kaj točno kupujete',5),
(4005,'s02','Vključeno in izključeno','Kaj je vključeno in kaj manjka',6),
(4006,'s03','Količina in enota','Količina, površina, uporabniki ali čas',7),
(4007,'s04','Specifikacija in kakovost','Model, material, standard in različica',8),
(4008,'s05','Obveznosti naročnika','Kaj morate zagotoviti vi',9),
(4009,'p01','Enkratna cena','Znesek, valuta in DDV',10),
(4010,'p02','Ponavljajoča cena','Mesečni ali letni strošek',11),
(4011,'p03','Cena po porabi','Enota, prag in način obračuna',12),
(4012,'p04','Dodatki in popusti','Dodatni stroški, popusti in podražitve',13),
(4013,'t01','Začetek in rok','Točen ali približen datum',14),
(4014,'t02','Obroki in mejniki','Zneski, dogodki in roki',15),
(4015,'t03','Termin in razpoložljivost','Termin, časovno okno in pogostost',16),
(4016,'k01','Trajanje in podaljšanje','Trajanje, vezava in avtomatsko podaljšanje',17),
(4017,'k02','Odpoved in izstop','Rok, način odpovedi in strošek izstopa',18),
(4018,'k03','Spremembe pogodbe','Cena, obseg in enostranske spremembe',19),
(4019,'q01','Rezultat in prevzem','Kaj pomeni končano in kdo potrdi',20),
(4020,'g01','Garancija in reklamacija','Trajanje, kritje in prijava napake',21),
(4021,'g02','Podpora in SLA','Odziv, odprava in dosegljivost',22),
(4022,'r01','Identiteta in dovoljenja','Pravna oseba, licence in dokazila',23),
(4023,'r02','Podizvajalci in odvisnosti','Kdo izvaja in od česa je izvedba odvisna',24),
(4024,'r03','Podatki in lastništvo','Dostopi, osebni podatki in izvorne datoteke',25),
(4025,'r04','Ustna prodajna obljuba','Kaj je bilo obljubljeno po telefonu',26),
(4026,'e01','Dokazilo','Ponudba, pogodba, cenik ali sporočilo',27),
(4027,'a01','Končni povzetek','Potrjena dejstva in manjkajoči podatki',28)
on conflict (id) do update set code=excluded.code,label=excluded.label,description=excluded.description,sort_order=excluded.sort_order;

with premik(field_id,module_id) as (values
  (5101,4009),(5102,4009),(5103,4006),(5104,4012),(5105,4012),(5106,4010),(5107,4012),(5108,4011),
  (5201,4004),(5202,4007),(5203,4005),(5204,4005),(5205,4008),(5206,4023),(5207,4019),(5208,4007),
  (5301,4013),(5302,4013),(5303,4014),(5304,4014),(5305,4014),(5306,4014),(5307,4014),(5308,4014),
  (5401,4016),(5402,4016),(5403,4016),(5404,4017),(5405,4018),(5406,4018),(5407,4018),(5408,4024),
  (5501,4020),(5502,4020),(5503,4020),(5504,4020),(5505,4021),(5506,4021),(5507,4021),
  (5601,4022),(5602,4001),(5603,4022),(5604,4022),(5605,4022),(5606,4023),(5607,4024),(5608,4025),
  (5609,4017),(5610,4022),(5611,4002),(5612,4019)
), razvrstitev as (
  select p.field_id,p.module_id,row_number() over (partition by p.module_id order by p.field_id)::smallint as sort_order from premik p
)
update public.offer_review_fields f set module_id=r.module_id,sort_order=r.sort_order from razvrstitev r where f.id=r.field_id;

update public.offer_review_fields set sort_order=2 where id in (5602,5611);

insert into public.offer_review_fields (id,module_id,code,label,input_type,required,help,options,sort_order) values
(5001,4001,'vloga-ponudnika','Vloga ponudnika','select',true,'Kdo dejansko izvede ali dobavi ponudbo?','[{"id":"izvajalec","label":"Izvajalec"},{"id":"proizvajalec","label":"Proizvajalec"},{"id":"prodajalec","label":"Prodajalec"},{"id":"posrednik","label":"Posrednik"}]',1),
(5002,4002,'vir-ponudbe','Kako je ponudba prišla do vas','select',true,'','[{"id":"povprasevanje","label":"Naše povpraševanje"},{"id":"obstojeci","label":"Obstoječi ponudnik"},{"id":"hladni-klic","label":"Hladni klic ali pošta"},{"id":"priporocilo","label":"Priporočilo"},{"id":"drugo","label":"Drugo"}]',1),
(5003,4003,'oblika-sodelovanja','Oblika sodelovanja','select',true,'','[{"id":"nakup","label":"Enkratni nakup"},{"id":"projekt","label":"Posamezen projekt"},{"id":"redno","label":"Redno sodelovanje"},{"id":"narocnina","label":"Naročnina ali pogodba"},{"id":"najem","label":"Najem"},{"id":"poraba","label":"Plačilo po porabi"}]',1),
(5309,4015,'termin-pogostost','Termin in razpoložljivost','text',true,'Datum, časovno okno ali pogostost storitve','[]',1),
(5701,4026,'dokazilo-vrsta','Vrsta dokazila','select',true,'','[{"id":"ponudba","label":"Ponudba"},{"id":"pogodba","label":"Pogodba"},{"id":"cenik","label":"Cenik"},{"id":"eposta","label":"E-pošta"},{"id":"posnetek","label":"Posnetek zaslona"},{"id":"drugo","label":"Drugo"}]',1),
(5702,4026,'dokazilo-opomba','Kaj dokazilo potrjuje','textarea',false,'Povežite dokazilo z dejstvom, ki ga želite preveriti','[]',2)
on conflict (id) do update set module_id=excluded.module_id,code=excluded.code,label=excluded.label,input_type=excluded.input_type,required=excluded.required,help=excluded.help,options=excluded.options,sort_order=excluded.sort_order;

alter table public.offer_review_requests alter column engine_version set default 'ponudba-moduli-v2';
