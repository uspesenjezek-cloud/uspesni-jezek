-- Kanonični, ID-stabilen katalog za modularno preverjanje ponudb.
create table public.offer_provider_families (
  id smallint primary key,
  code text not null unique check (code ~ '^[a-z0-9-]+$'),
  label text not null
);

create table public.offer_provider_profiles (
  id integer primary key,
  family_id smallint not null references public.offer_provider_families(id),
  code text not null unique check (code ~ '^[a-z0-9-]+$'),
  label text not null,
  aliases text[] not null default '{}',
  extra_field_ids integer[] not null default '{}'
);

create table public.offer_contract_models (
  id integer primary key,
  code text not null unique check (code ~ '^[a-z0-9-]+$'),
  label text not null,
  extra_field_ids integer[] not null default '{}'
);

create table public.offer_sales_channels (
  id integer primary key,
  code text not null unique check (code ~ '^[a-z0-9-]+$'),
  label text not null
);

create table public.offer_review_modules (
  id integer primary key,
  code text not null unique check (code ~ '^[a-z0-9-]+$'),
  label text not null,
  description text not null,
  sort_order smallint not null unique
);

create table public.offer_review_fields (
  id integer primary key,
  module_id integer not null references public.offer_review_modules(id),
  code text not null unique check (code ~ '^[a-z0-9-]+$'),
  label text not null,
  input_type text not null check (input_type in ('text','textarea','money','date','select')),
  required boolean not null default false,
  help text not null default '',
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  sort_order smallint not null,
  unique (module_id, sort_order)
);

create table public.offer_review_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_profile_id uuid,
  provider_profile_id integer references public.offer_provider_profiles(id),
  offer_model_ids integer[] not null default '{}',
  sales_channel_ids integer[] not null default '{}',
  selected_module_ids integer[] not null default '{}',
  source_text text not null default '' check (char_length(source_text) <= 6000),
  status text not null default 'draft' check (status in ('draft','ready','ordered','closed')),
  engine_version text not null default 'ponudba-moduli-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.offer_review_answers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id integer not null references public.offer_review_fields(id),
  value jsonb not null,
  source text not null default 'manual' check (source in ('manual','document','luna')),
  evidence text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (request_id, user_id) references public.offer_review_requests(id, user_id) on delete cascade,
  unique (request_id, field_id)
);

create index offer_provider_profiles_family_idx on public.offer_provider_profiles(family_id);
create index offer_review_fields_module_idx on public.offer_review_fields(module_id);
create index offer_review_requests_user_idx on public.offer_review_requests(user_id, updated_at desc);
create index offer_review_answers_user_request_idx on public.offer_review_answers(user_id, request_id);

insert into public.offer_provider_families (id,code,label) values
(101,'material','Material in repromaterial'),(102,'orodje','Orodje in stroji'),(103,'najem','Najem opreme'),
(104,'zascita','Zaščitna oprema'),(105,'vozila','Vozila in mobilnost'),(106,'flota','Flota, gorivo in poti'),
(107,'energija','Energija in infrastruktura'),(108,'telekom','Telekomunikacije'),(109,'it','IT in programska oprema'),
(110,'marketing','Splet in marketing'),(111,'oblikovanje','Oblikovanje in promocija'),(112,'posredniki','Prodajni portali in posredniki'),
(113,'finance','Finance in plačila'),(114,'zavarovanje','Zavarovanje'),(115,'poslovne','Poslovne in kadrovske storitve'),
(116,'skladnost','Skladnost in obvezne storitve');

insert into public.offer_provider_profiles (id,family_id,code,label,aliases,extra_field_ids) values
(1001,101,'gradbeni-material','Gradbeni material in veleprodaja',array['Baustoffhandel','gradbeni material','repromaterial'],'{}'),
(1002,101,'elektro-material','Elektro material',array['Elektrogrosshandel','elektromaterial'],'{}'),
(1003,101,'instalacijski-material','Vodovodni, ogrevalni in instalacijski material',array['SHK Grosshandel','sanitarni material'],'{}'),
(1004,101,'barve-kemija','Barve, premazi in gradbena kemija',array['Farbenhandel','premazi','lepila'],'{}'),
(1005,102,'orodje-stroji','Orodje, stroji in delavniška oprema',array['Werkzeug','Maschinen','orodje'],'{}'),
(1006,103,'najem-strojev','Najem strojev, odrov in dvižne opreme',array['Baumaschinenvermietung','Mietpark','najem opreme'],array[5103,5202,5302,5506,5609]),
(1007,104,'osebna-varovalna-oprema','Osebna varovalna in delovna oprema',array['PSA','Arbeitsschutz','delovna oblačila'],'{}'),
(1008,105,'gospodarska-vozila','Gospodarska vozila in servis',array['Nutzfahrzeuge','Transporter','kombi'],'{}'),
(1009,105,'leasing-vozil','Leasing in financiranje vozil',array['Fahrzeugleasing','leasing vozil'],array[5106,5401,5402,5403,5404,5609]),
(1010,106,'gorivo-kartice','Gorivne kartice, cestnine in polnjenje',array['Tankkarte','Maut','Ladekarte'],array[5103,5106,5403,5609]),
(1011,106,'upravljanje-flote','Upravljanje flote in telematika',array['Fuhrpark','Telematik','flota'],'{}'),
(1012,107,'dobava-energije','Elektrika, plin in energijski paketi',array['Stromtarif','Gastarif','dobava energije'],array[5103,5106,5107,5403,5404]),
(1013,107,'energetski-sistemi','Sončne elektrarne, baterije in polnilnice',array['Photovoltaik','Speicher','Wallbox'],'{}'),
(1014,108,'mobilna-telefonija','Mobilna telefonija in poslovni paketi',array['Mobilfunk','Handytarif','mobilni operater'],array[5103,5106,5208,5401,5402,5403,5404,5609]),
(1015,108,'internet-telefonija','Internet, stacionarna telefonija in povezljivost',array['Internetanschluss','VoIP','Glasfaser'],array[5106,5208,5401,5403,5404,5507,5609]),
(1016,109,'racunalniki-omrezja','Računalniki, omrežja in tehnična podpora',array['IT Systemhaus','Netzwerk','računalniki'],'{}'),
(1017,109,'oblak-kibernetska-varnost','Oblak, varnost in varnostne kopije',array['Cloud','Cybersecurity','Backup'],array[5106,5208,5408,5507,5607]),
(1018,109,'racunovodski-program','Računovodski, blagajniški in plačni programi',array['Buchhaltung Software','Kasse','Lohn'],array[5106,5208,5408,5507,5607,5609]),
(1019,109,'erp-crm','ERP, CRM in poslovni sistemi',array['ERP','CRM','Warenwirtschaft'],array[5106,5208,5408,5507,5607,5609]),
(1020,109,'obrtna-programska-oprema','Programi za ponudbe, projekte, CAD/BIM in evidenco časa',array['Handwerkersoftware','CAD','BIM','Zeiterfassung'],array[5106,5208,5408,5507,5607,5609]),
(1021,110,'spletna-stran-gostovanje','Spletna stran, trgovina, domene in gostovanje',array['Webagentur','Hosting','spletna stran'],array[5106,5408,5607,5609]),
(1022,110,'digitalni-marketing','SEO, oglasi, družbena omrežja in vsebinski marketing',array['SEO','Google Ads','Social Media','marketing'],array[5106,5108,5207,5408,5607,5612]),
(1023,110,'telemarketing','Telemarketing in pridobivanje terminov',array['Telemarketing','Telesales','Terminierung'],array[5106,5108,5207,5608,5607]),
(1024,111,'graficno-oblikovanje','Grafično oblikovanje in celostna podoba',array['Grafikdesign','Branding','logotip'],'{}'),
(1025,111,'tisk-oznake','Tisk, napisi, table, folije in promocijski material',array['Druckerei','Werbetechnik','Beschriftung'],'{}'),
(1026,111,'foto-video','Fotografija in video produkcija',array['Fotografie','Videoproduktion'],'{}'),
(1027,112,'portal-povprasevanja','Portal, imenik in prodajni kontakti',array['Leadportal','Branchenbuch','povpraševanja'],array[5106,5108,5207,5403,5404,5602,5609,5612]),
(1028,112,'poslovni-posrednik','Poslovni posrednik ali nabavni svetovalec',array['Vermittler','Makler','posrednik'],array[5108,5207,5602]),
(1029,113,'banka-racun','Poslovni račun, kredit in financiranje',array['Geschäftskonto','Kredit','banka'],'{}'),
(1030,113,'placila-pos','Kartična plačila, POS in spletna plačila',array['Kartenzahlung','POS','Payment'],array[5103,5106,5107,5403,5404,5507,5607,5609]),
(1031,113,'factoring-izterjava','Factoring in izterjava terjatev',array['Factoring','Inkasso','izterjava'],array[5108,5404,5602]),
(1032,114,'zavarovanje-posrednik','Zavarovalnica ali zavarovalni posrednik',array['Versicherung','Makler','zavarovanje'],array[5106,5107,5203,5204,5401,5403,5404,5501,5502,5503]),
(1033,115,'racunovodstvo-davki','Računovodstvo, davki in obračun plač',array['Steuerberater','Buchhaltung','računovodstvo'],'{}'),
(1034,115,'pravo-pogodbe','Pravne storitve in pogodbe',array['Rechtsanwalt','Vertrag','odvetnik'],'{}'),
(1035,115,'kadrovanje-delo','Kadrovanje, agencijsko delo in obračun kadrov',array['Personalvermittlung','Zeitarbeit','HR'],array[5103,5106,5202,5206,5401,5404,5604,5605]),
(1036,115,'izobrazevanje','Poslovno in strokovno izobraževanje',array['Weiterbildung','Schulung','usposabljanje'],'{}'),
(1037,116,'varnost-zdravje','Varnost pri delu in medicina dela',array['Arbeitssicherheit','Betriebsarzt','varstvo pri delu'],array[5202,5302,5401,5501,5610]),
(1038,116,'pozarna-varnost-pregledi','Požarna varnost in periodični pregledi opreme',array['Brandschutz','Prüfdienst','pregledi'],array[5202,5302,5401,5501,5610]),
(1039,116,'odpadki-okolje','Odpadki, okoljske storitve in dokumentacija',array['Entsorgung','Umwelt','odpadki'],array[5103,5106,5202,5401,5604,5610]),
(1040,116,'certificiranje','Certificiranje, meritve in dokazila',array['Zertifizierung','Prüfung','certifikat'],array[5202,5302,5501,5604,5610]),
(1041,115,'logistika-skladiscenje','Logistika, kurirske storitve in skladiščenje',array['Logistik','Kurier','Lager'],'{}'),
(1042,115,'prostori-vzdrzevanje','Poslovni prostori, čiščenje, varovanje in facility storitve',array['Facility','Reinigung','Bewachung'],'{}'),
(1043,101,'pisarniska-oprema','Pisarniška oprema, embalaža in potrošni material',array['Bürobedarf','Verpackung','pisarniški material'],'{}');

insert into public.offer_contract_models (id,code,label,extra_field_ids) values
(2001,'enkratni-nakup','Enkratni nakup','{}'),(2002,'nakup-montaza','Nakup z dostavo ali montažo',array[5105,5203,5204,5301,5302,5501,5504]),
(2003,'projekt','Posamezen projekt po meri',array[5202,5205,5207,5301,5302,5304,5408]),(2004,'redno-sodelovanje','Redna storitev',array[5106,5401,5403,5404,5505]),
(2005,'narocnina','Naročnina na uporabnika, napravo ali lokacijo',array[5103,5106,5208,5401,5402,5403,5404,5609]),
(2006,'poraba','Obračun po porabi',array[5103,5106,5107]),(2007,'najem','Najem',array[5103,5106,5401,5402,5404,5506,5609]),
(2008,'leasing','Leasing ali financiranje',array[5106,5401,5402,5403,5404,5609]),(2009,'vzdrzevanje','Vzdrževanje ali servis',array[5106,5401,5504,5505,5506]),
(2010,'okvirna-pogodba','Okvirna pogodba',array[5103,5107,5401,5403,5404]),(2011,'provizija','Posredniška provizija',array[5108,5207,5602]),
(2012,'uspesnost','Plačilo po uspehu',array[5108,5207]),(2013,'oglasevalski-paket','Oglaševalski ali medijski paket',array[5106,5108,5202,5207,5401,5403,5404]),
(2014,'zagotavljanje-kadra','Zagotavljanje kadra',array[5103,5106,5202,5206,5401,5404,5604,5605]),
(2015,'pregled-certifikat','Pregled, meritev ali certificiranje',array[5202,5302,5501,5604,5610]);

insert into public.offer_sales_channels (id,code,label) values
(3001,'lastno-povprasevanje','Sami smo poslali povpraševanje'),(3002,'priporocilo','Priporočilo'),(3003,'obstojeci-dobavitelj','Obstoječi dobavitelj'),
(3004,'prodajni-zastopnik','Prodajni zastopnik'),(3005,'hladni-klic','Hladni prodajni klic'),(3006,'nepricakovana-posta','Nepričakovana e-pošta'),
(3007,'spletni-obrazec','Spletni obrazec'),(3008,'sejem','Sejem ali dogodek'),(3009,'portal','Portal ali imenik'),
(3010,'zbornica','Program zbornice ali združenja'),(3011,'posrednik','Posrednik'),(3012,'samodejno-podaljsanje','Samodejno podaljšanje');

insert into public.offer_review_modules (id,code,label,description,sort_order) values
(4001,'cena','Cena in stroški','DDV, dodatki in realna skupna cena',1),(4002,'obseg','Obseg ponudbe','Kaj je vključeno in kaj morate zagotoviti vi',2),
(4003,'placilo','Plačilo in roki','Obroki, zapadlost in izvedba',3),(4004,'pogodba','Pogodbeni pogoji','Trajanje, podaljšanje in odpoved',4),
(4005,'garancija','Garancija','Jamstva, servis in reklamacije',5),(4006,'tveganja','Tveganja','Ponudnik, dokazila in skrite obveznosti',6);

insert into public.offer_review_fields (id,module_id,code,label,input_type,required,help,options,sort_order) values
(5101,4001,'osnovna-cena','Osnovna cena','money',true,'Cena brez dodatnih stroškov','[]',1),(5102,4001,'ddv','DDV','select',true,'Je DDV vključen?','[{"id":"vkljucen","label":"Vključen"},{"id":"ni-vkljucen","label":"Ni vključen"},{"id":"ni-naveden","label":"Ni naveden"}]',2),
(5103,4001,'kolicina-enota','Količina in obračunska enota','text',false,'npr. 12 ur, 3 uporabniki, 1 projekt','[]',3),(5104,4001,'popusti','Popusti in pogoji popusta','textarea',false,'Kdaj popust velja in kdaj se izgubi?','[]',4),(5105,4001,'dodatni-stroski','Dodatni in enkratni stroški','textarea',true,'Aktivacija, dostava, montaža, pot, material …','[]',5),(5106,4001,'ponavljajoci-strosek','Ponavljajoči strošek','money',false,'Mesečni ali letni znesek','[]',6),(5107,4001,'indeksacija','Podražitve in indeksacija','textarea',false,'Kako in kdaj se cena lahko spremeni?','[]',7),(5108,4001,'provizija-osnova','Osnova za provizijo ali uspeh','text',false,'Odstotek, dogodek in osnova obračuna','[]',8),
(5201,4002,'predmet','Kaj točno kupujete','textarea',true,'Izdelek, storitev ali rezultat','[]',1),(5202,4002,'kolicine-specifikacije','Količine in specifikacije','textarea',true,'Mere, modeli, uporabniki, lokacije ali obseg','[]',2),(5203,4002,'vkljuceno','Kaj je vključeno','textarea',true,'Dostava, montaža, konfiguracija, usposabljanje …','[]',3),(5204,4002,'izkljuceno','Kaj ni vključeno','textarea',true,'Kaj bo treba naročiti ali plačati posebej?','[]',4),(5205,4002,'obveznosti-narocnika','Kaj morate zagotoviti vi','textarea',false,'Dostop, elektrika, vsebine, dovoljenja, materiali …','[]',5),(5206,4002,'podizvajalci','Podizvajalci','select',false,'Ali sme ponudnik uporabiti podizvajalce?','[{"id":"da","label":"Da"},{"id":"ne","label":"Ne"},{"id":"ni-naveden","label":"Ni navedeno"}]',6),(5207,4002,'prevzem-merila','Merila za prevzem','textarea',false,'Kako se potrdi, da je delo pravilno zaključeno?','[]',7),(5208,4002,'licence-uporabniki','Licence, uporabniki, naprave ali lokacije','text',false,'Kaj omejuje uporabo?','[]',8),
(5301,4003,'zacetek','Predviden začetek','date',false,'','[]',1),(5302,4003,'rok-izvedbe','Rok izvedbe ali dobave','text',true,'Datum ali število delovnih dni','[]',2),(5303,4003,'predplacilo','Predplačilo','money',false,'Znesek ali odstotek','[]',3),(5304,4003,'obroki-mejniki','Obroki in mejniki','textarea',false,'Kateri znesek zapade ob katerem dogodku?','[]',4),(5305,4003,'rok-placila','Rok plačila računa','text',true,'npr. 14 dni','[]',5),(5306,4003,'zamuda-obresti','Zamudne obresti in stroški','textarea',false,'','[]',6),(5307,4003,'zadrzani-znesek','Zadržani znesek do prevzema','money',false,'','[]',7),(5308,4003,'nacin-placila','Način plačila','text',false,'Nakazilo, kartica, direktna obremenitev …','[]',8),
(5401,4004,'trajanje','Trajanje pogodbe','text',true,'Določen čas, nedoločen čas ali enkratno','[]',1),(5402,4004,'vezava','Minimalna vezava','text',false,'','[]',2),(5403,4004,'podaljsanje','Samodejno podaljšanje','textarea',true,'Za koliko časa in pod katerimi pogoji?','[]',3),(5404,4004,'odpovedni-rok','Odpovedni rok in način odpovedi','textarea',true,'Rok, naslov in zahtevana oblika','[]',4),(5405,4004,'spremembe-pogojev','Enostranske spremembe pogojev','textarea',false,'Ali lahko ponudnik spremeni ceno ali storitev?','[]',5),(5406,4004,'omejitev-odgovornosti','Omejitev odgovornosti','textarea',false,'','[]',6),(5407,4004,'pravo-sodisce','Pravo in pristojno sodišče','text',false,'','[]',7),(5408,4004,'lastnistvo-podatkov','Lastništvo datotek, vsebin in podatkov','textarea',false,'Kdo obdrži izvorne datoteke in dostop?','[]',8),
(5501,4005,'trajanje-garancije','Trajanje garancije ali jamstva','text',true,'','[]',1),(5502,4005,'kritje-garancije','Kaj garancija krije','textarea',true,'','[]',2),(5503,4005,'izkljucitve-garancije','Izključitve garancije','textarea',false,'','[]',3),(5504,4005,'prijava-napake','Kako prijavite napako ali reklamacijo','textarea',true,'Kontakt, rok in zahtevana dokazila','[]',4),(5505,4005,'odzivni-cas','Odzivni in odpravljalni čas','text',false,'','[]',5),(5506,4005,'servis-deli','Servis, rezervni deli in nadomestna oprema','textarea',false,'','[]',6),(5507,4005,'sla-dostopnost','Dogovorjena razpoložljivost storitve','text',false,'npr. 99,9 % ali delovni čas podpore','[]',7),
(5601,4006,'pravna-identiteta','Pravna oseba in podpisnik','text',true,'Kdo je dejanski pogodbeni partner?','[]',1),(5602,4006,'posrednik-status','Ali je ponudnik posrednik','select',false,'','[{"id":"da","label":"Da"},{"id":"ne","label":"Ne"},{"id":"ni-jasno","label":"Ni jasno"}]',2),(5603,4006,'reference','Reference in primerljive izvedbe','textarea',false,'','[]',3),(5604,4006,'certifikati-dovoljenja','Certifikati, licence in dovoljenja','textarea',false,'','[]',4),(5605,4006,'zavarovanje-odgovornosti','Zavarovanje odgovornosti','textarea',false,'Zavarovalnica, kritje in veljavnost','[]',5),(5606,4006,'odvisnosti','Ključne odvisnosti in predpogoji','textarea',false,'','[]',6),(5607,4006,'podatki-zasebnost','Osebni podatki, dostopi in zasebnost','textarea',false,'','[]',7),(5608,4006,'ustni-dogovor','Kaj je bilo obljubljeno po telefonu ali ustno','textarea',false,'','[]',8),(5609,4006,'izstopni-stroski','Stroški izstopa, prenosa ali demontaže','textarea',false,'','[]',9),(5610,4006,'varnost-dokazila','Varnostna in zakonska dokazila','textarea',false,'Pregledi, meritve, izjave in roki veljavnosti','[]',10),(5611,4006,'vir-ponudbe','Kako je ponudba prišla do vas','text',false,'','[]',11),(5612,4006,'primerjava-trga','Primerljive ponudbe ali tržne cene','textarea',false,'','[]',12);

alter table public.offer_provider_families enable row level security;
alter table public.offer_provider_profiles enable row level security;
alter table public.offer_contract_models enable row level security;
alter table public.offer_sales_channels enable row level security;
alter table public.offer_review_modules enable row level security;
alter table public.offer_review_fields enable row level security;
alter table public.offer_review_requests enable row level security;
alter table public.offer_review_answers enable row level security;

create policy offer_catalog_families_read on public.offer_provider_families for select to authenticated using (true);
create policy offer_catalog_profiles_read on public.offer_provider_profiles for select to authenticated using (true);
create policy offer_catalog_models_read on public.offer_contract_models for select to authenticated using (true);
create policy offer_catalog_channels_read on public.offer_sales_channels for select to authenticated using (true);
create policy offer_catalog_modules_read on public.offer_review_modules for select to authenticated using (true);
create policy offer_catalog_fields_read on public.offer_review_fields for select to authenticated using (true);

create policy offer_requests_read_own on public.offer_review_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy offer_requests_insert_own on public.offer_review_requests for insert to authenticated with check ((select auth.uid()) = user_id);
create policy offer_requests_update_own on public.offer_review_requests for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy offer_requests_delete_own on public.offer_review_requests for delete to authenticated using ((select auth.uid()) = user_id);
create policy offer_answers_read_own on public.offer_review_answers for select to authenticated using ((select auth.uid()) = user_id);
create policy offer_answers_insert_own on public.offer_review_answers for insert to authenticated with check ((select auth.uid()) = user_id);
create policy offer_answers_update_own on public.offer_review_answers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy offer_answers_delete_own on public.offer_review_answers for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.offer_provider_families, public.offer_provider_profiles, public.offer_contract_models, public.offer_sales_channels, public.offer_review_modules, public.offer_review_fields, public.offer_review_requests, public.offer_review_answers from anon;
grant select on public.offer_provider_families, public.offer_provider_profiles, public.offer_contract_models, public.offer_sales_channels, public.offer_review_modules, public.offer_review_fields to authenticated;
grant select, insert, update, delete on public.offer_review_requests, public.offer_review_answers to authenticated;
