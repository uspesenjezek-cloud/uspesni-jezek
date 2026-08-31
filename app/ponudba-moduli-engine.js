(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJPonudbaModuliEngine = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var VERSION = "ponudba-moduli-v2";
  var CONTRACT_VERSION = "ponudba-luna-id-contract-v4";

  var DRUZINE = [
    [101, "material", "Material in repromaterial"], [102, "orodje", "Orodje in stroji"],
    [103, "najem", "Najem opreme"], [104, "zascita", "Zaščitna oprema"],
    [105, "vozila", "Vozila in mobilnost"], [106, "flota", "Flota, gorivo in poti"],
    [107, "energija", "Energija in infrastruktura"], [108, "telekom", "Telekomunikacije"],
    [109, "it", "IT in programska oprema"], [110, "marketing", "Splet in marketing"],
    [111, "oblikovanje", "Oblikovanje in promocija"], [112, "posredniki", "Prodajni portali in posredniki"],
    [113, "finance", "Finance in plačila"], [114, "zavarovanje", "Zavarovanje"],
    [115, "poslovne", "Poslovne in kadrovske storitve"], [116, "skladnost", "Skladnost in obvezne storitve"]
  ];

  var PROFILI = [
    [1001,101,"gradbeni-material","Gradbeni material in veleprodaja","Baustoffhandel|gradbeni material|repromaterial"],
    [1002,101,"elektro-material","Elektro material","Elektrogroßhandel|elektromaterial"],
    [1003,101,"instalacijski-material","Vodovodni, ogrevalni in instalacijski material","SHK Großhandel|sanitarni material"],
    [1004,101,"barve-kemija","Barve, premazi in gradbena kemija","Farbenhandel|premazi|lepila"],
    [1005,102,"orodje-stroji","Orodje, stroji in delavniška oprema","Werkzeug|Maschinen|orodje"],
    [1006,103,"najem-strojev","Najem strojev, odrov in dvižne opreme","Baumaschinenvermietung|Mietpark|najem opreme"],
    [1007,104,"osebna-varovalna-oprema","Osebna varovalna in delovna oprema","PSA|Arbeitsschutz|delovna oblačila"],
    [1008,105,"gospodarska-vozila","Gospodarska vozila in servis","Nutzfahrzeuge|Transporter|kombi"],
    [1009,105,"leasing-vozil","Leasing in financiranje vozil","Fahrzeugleasing|leasing vozil"],
    [1010,106,"gorivo-kartice","Gorivne kartice, cestnine in polnjenje","Tankkarte|Maut|Ladekarte"],
    [1011,106,"upravljanje-flote","Upravljanje flote in telematika","Fuhrpark|Telematik|flota"],
    [1012,107,"dobava-energije","Elektrika, plin in energijski paketi","Stromtarif|Gastarif|dobava energije"],
    [1013,107,"energetski-sistemi","Sončne elektrarne, baterije in polnilnice","Photovoltaik|Speicher|Wallbox"],
    [1014,108,"mobilna-telefonija","Mobilna telefonija in poslovni paketi","Mobilfunk|Handytarif|mobilni operater"],
    [1015,108,"internet-telefonija","Internet, stacionarna telefonija in povezljivost","Internetanschluss|VoIP|Glasfaser"],
    [1016,109,"racunalniki-omrezja","Računalniki, omrežja in tehnična podpora","IT Systemhaus|Netzwerk|računalniki"],
    [1017,109,"oblak-kibernetska-varnost","Oblak, varnost in varnostne kopije","Cloud|Cybersecurity|Backup"],
    [1018,109,"racunovodski-program","Računovodski, blagajniški in plačni programi","Buchhaltung Software|Kasse|Lohn"],
    [1019,109,"erp-crm","ERP, CRM in poslovni sistemi","ERP|CRM|Warenwirtschaft"],
    [1020,109,"obrtna-programska-oprema","Programi za ponudbe, projekte, CAD/BIM in evidenco časa","Handwerkersoftware|CAD|BIM|Zeiterfassung"],
    [1021,110,"spletna-stran-gostovanje","Spletna stran, trgovina, domene in gostovanje","Webagentur|Hosting|spletna stran"],
    [1022,110,"digitalni-marketing","SEO, oglasi, družbena omrežja in vsebinski marketing","SEO|Google Ads|Social Media|marketing"],
    [1023,110,"telemarketing","Telemarketing in pridobivanje terminov","Telemarketing|Telesales|Terminierung"],
    [1024,111,"graficno-oblikovanje","Grafično oblikovanje in celostna podoba","Grafikdesign|Branding|logotip"],
    [1025,111,"tisk-oznake","Tisk, napisi, table, folije in promocijski material","Druckerei|Werbetechnik|Beschriftung"],
    [1026,111,"foto-video","Fotografija in video produkcija","Fotografie|Videoproduktion"],
    [1027,112,"portal-povprasevanja","Portal, imenik in prodajni kontakti","Leadportal|Branchenbuch|povpraševanja"],
    [1028,112,"poslovni-posrednik","Poslovni posrednik ali nabavni svetovalec","Vermittler|Makler|posrednik"],
    [1029,113,"banka-racun","Poslovni račun, kredit in financiranje","Geschäftskonto|Kredit|banka"],
    [1030,113,"placila-pos","Kartična plačila, POS in spletna plačila","Kartenzahlung|POS|Payment"],
    [1031,113,"factoring-izterjava","Factoring in izterjava terjatev","Factoring|Inkasso|izterjava"],
    [1032,114,"zavarovanje-posrednik","Zavarovalnica ali zavarovalni posrednik","Versicherung|Makler|zavarovanje"],
    [1033,115,"racunovodstvo-davki","Računovodstvo, davki in obračun plač","Steuerberater|Buchhaltung|racunovodstvo"],
    [1034,115,"pravo-pogodbe","Pravne storitve in pogodbe","Rechtsanwalt|Vertrag|odvetnik"],
    [1035,115,"kadrovanje-delo","Kadrovanje, agencijsko delo in obračun kadrov","Personalvermittlung|Zeitarbeit|HR"],
    [1036,115,"izobrazevanje","Poslovno in strokovno izobraževanje","Weiterbildung|Schulung|usposabljanje"],
    [1037,116,"varnost-zdravje","Varnost pri delu in medicina dela","Arbeitssicherheit|Betriebsarzt|varstvo pri delu"],
    [1038,116,"pozarna-varnost-pregledi","Požarna varnost in periodični pregledi opreme","Brandschutz|Prüfdienst|pregledi"],
    [1039,116,"odpadki-okolje","Odpadki, okoljske storitve in dokumentacija","Entsorgung|Umwelt|odpadki"],
    [1040,116,"certificiranje","Certificiranje, meritve in dokazila","Zertifizierung|Prüfung|certifikat"],
    [1041,115,"logistika-skladiscenje","Logistika, kurirske storitve in skladiščenje","Logistik|Kurier|Lager"],
    [1042,115,"prostori-vzdrzevanje","Poslovni prostori, čiščenje, varovanje in facility storitve","Facility|Reinigung|Bewachung"],
    [1043,101,"pisarniska-oprema","Pisarniška oprema, embalaža in potrošni material","Bürobedarf|Verpackung|pisarniški material"]
  ];

  var MODELI = [
    [2001,"enkratni-nakup","Enkratni nakup"], [2002,"nakup-montaza","Nakup z dostavo ali montažo"],
    [2003,"projekt","Posamezen projekt po meri"], [2004,"redno-sodelovanje","Redna storitev"],
    [2005,"narocnina","Naročnina na uporabnika, napravo ali lokacijo"], [2006,"poraba","Obračun po porabi"],
    [2007,"najem","Najem"], [2008,"leasing","Leasing ali financiranje"],
    [2009,"vzdrzevanje","Vzdrževanje ali servis"], [2010,"okvirna-pogodba","Okvirna pogodba"],
    [2011,"provizija","Posredniška provizija"], [2012,"uspesnost","Plačilo po uspehu"],
    [2013,"oglasevalski-paket","Oglaševalski ali medijski paket"], [2014,"zagotavljanje-kadra","Zagotavljanje kadra"],
    [2015,"pregled-certifikat","Pregled, meritev ali certificiranje"]
  ];

  var KANALI = [
    [3001,"lastno-povprasevanje","Sami smo poslali povpraševanje"], [3002,"priporocilo","Priporočilo"],
    [3003,"obstojeci-dobavitelj","Obstoječi dobavitelj"], [3004,"prodajni-zastopnik","Prodajni zastopnik"],
    [3005,"hladni-klic","Hladni prodajni klic"], [3006,"nepricakovana-posta","Nepričakovana e-pošta"],
    [3007,"spletni-obrazec","Spletni obrazec"], [3008,"sejem","Sejem ali dogodek"],
    [3009,"portal","Portal ali imenik"], [3010,"zbornica","Program zbornice ali združenja"],
    [3011,"posrednik","Posrednik"], [3012,"samodejno-podaljsanje","Samodejno podaljšanje"]
  ];

  var PODROCJA = [
    ["cena","Cena in stroški","DDV, dodatki in realna skupna cena",[4009,4010,4011,4012]],
    ["obseg","Obseg ponudbe","Kaj je vključeno in kaj morate zagotoviti vi",[4004,4005,4006,4007,4008,4019]],
    ["placilo","Plačilo in roki","Obroki, zapadlost in izvedba",[4013,4014,4015]],
    ["pogodba","Pogodbeni pogoji","Trajanje, podaljšanje in odpoved",[4003,4016,4017,4018]],
    ["garancija","Garancija","Jamstva, servis in reklamacije",[4020,4021]],
    ["tveganja","Tveganja","Ponudnik, dokazila in skrite obveznosti",[4001,4022,4023,4024,4025,4026]]
  ];

  var MODULI = [
    [4000,"C00","Potrditev razumevanja","Potrdite, kaj je Atena razumela"],
    [4001,"C01","Vloga ponudnika","Izvajalec, prodajalec ali posrednik"],
    [4002,"C02","Odnos in vir ponudbe","Kako je ponudba prišla do vas"],
    [4003,"C03","Oblika sodelovanja","Nakup, projekt, naročnina ali najem"],
    [4004,"S01","Predmet ponudbe","Kaj točno kupujete"],
    [4005,"S02","Vključeno in izključeno","Kaj je vključeno in kaj manjka"],
    [4006,"S03","Količina in enota","Količina, površina, uporabniki ali čas"],
    [4007,"S04","Specifikacija in kakovost","Model, material, standard in različica"],
    [4008,"S05","Obveznosti naročnika","Kaj morate zagotoviti vi"],
    [4009,"P01","Enkratna cena","Znesek, valuta in DDV"],
    [4010,"P02","Ponavljajoča cena","Mesečni ali letni strošek"],
    [4011,"P03","Cena po porabi","Enota, prag in način obračuna"],
    [4012,"P04","Dodatki in popusti","Dodatni stroški, popusti in podražitve"],
    [4013,"T01","Začetek in rok","Točen ali približen datum"],
    [4014,"T02","Obroki in mejniki","Zneski, dogodki in roki"],
    [4015,"T03","Termin in razpoložljivost","Termin, časovno okno in pogostost"],
    [4016,"K01","Trajanje in podaljšanje","Trajanje, vezava in avtomatsko podaljšanje"],
    [4017,"K02","Odpoved in izstop","Rok, način odpovedi in strošek izstopa"],
    [4018,"K03","Spremembe pogodbe","Cena, obseg in enostranske spremembe"],
    [4019,"Q01","Rezultat in prevzem","Kaj pomeni končano in kdo potrdi"],
    [4020,"G01","Garancija in reklamacija","Trajanje, kritje in prijava napake"],
    [4021,"G02","Podpora in SLA","Odziv, odprava in dosegljivost"],
    [4022,"R01","Identiteta in dovoljenja","Pravna oseba, licence in dokazila"],
    [4023,"R02","Podizvajalci in odvisnosti","Kdo izvaja in od česa je izvedba odvisna"],
    [4024,"R03","Podatki in lastništvo","Dostopi, osebni podatki in izvorne datoteke"],
    [4025,"R04","Ustna prodajna obljuba","Kaj je bilo obljubljeno po telefonu"],
    [4026,"E01","Dokazilo","Ponudba, pogodba, cenik ali sporočilo"],
    [4027,"A01","Končni povzetek","Potrjena dejstva in manjkajoči podatki"]
  ];

  var MODUL_VPRASANJA = Object.freeze({
    C00:"Ali je Atena pravilno razumela ponudbo?",
    C01:"Kdo sklene pogodbo in kdo ponudbo dejansko izvede ali dobavi?",
    C02:"Kako in od koga ste prejeli ponudbo?",
    C03:"Ali gre za nakup, projekt, naročnino, najem ali drugo obliko sodelovanja?",
    S01:"Kaj točno kupujete in kateri rezultat pričakujete?",
    S02:"Kaj je vključeno in kaj boste morali naročiti ali plačati posebej?",
    S03:"Kakšna sta količina in obračunska enota?",
    S04:"Katere specifikacije, materiali, modeli ali standardi morajo veljati?",
    S05:"Kaj morate pred začetkom zagotoviti vi?",
    P01:"Kakšna je enkratna cena in ali vključuje DDV?",
    P02:"Kolikšen je redni strošek in kako pogosto se plača?",
    P03:"Po kateri enoti, pragu ali odstotku se obračuna poraba oziroma uspeh?",
    P04:"Kateri dodatni stroški, popusti ali podražitve lahko spremenijo končno ceno?",
    T01:"Kdaj se izvedba začne in do kdaj mora biti zaključena?",
    T02:"Kolikšni so predplačilo, obroki in roki plačila ob posameznih mejnikih?",
    T03:"Kateri termin, časovno okno ali pogostost izvedbe velja?",
    K01:"Koliko časa traja pogodba, kakšna je vezava in kako se podaljša?",
    K02:"Kako in do kdaj lahko pogodbo odpoveste ter koliko stane izstop?",
    K03:"Kaj lahko ponudnik enostransko spremeni in kako je omejena njegova odgovornost?",
    Q01:"Po katerih merilih je delo končano in kdo potrdi prevzem?",
    G01:"Kako dolgo velja garancija, kaj krije in kako prijavite napako?",
    G02:"V kolikšnem času se ponudnik odzove in odpravi napako?",
    R01:"Kdo je pravni ponudnik in katera veljavna dovoljenja ali dokazila ima?",
    R02:"Kdo bo delo dejansko izvajal in od katerih predpogojev je odvisno?",
    R03:"Kdo dobi dostop do podatkov in kdo obdrži datoteke, vsebine ter dostope?",
    R04:"Kaj vam je bilo obljubljeno ustno, vendar v ponudbi ni jasno zapisano?",
    E01:"Katero dokazilo potrjuje navedene cene, pogoje in obljube?",
    A01:"Ali so zbrana dejstva pravilna in kateri ključni podatki še manjkajo?"
  });

  var POLJA = [
    [5001,4001,"vloga-ponudnika","Vloga ponudnika","select",1,"Kdo dejansko izvede ali dobavi ponudbo?","izvajalec:Izvajalec|proizvajalec:Proizvajalec|prodajalec:Prodajalec|posrednik:Posrednik"],
    [5002,4002,"vir-ponudbe","Kako je ponudba prišla do vas","select",1,"","povprasevanje:Naše povpraševanje|obstojeci:Obstoječi ponudnik|hladni-klic:Hladni klic ali pošta|priporocilo:Priporočilo|drugo:Drugo"],
    [5003,4003,"oblika-sodelovanja","Oblika sodelovanja","select",1,"","nakup:Enkratni nakup|projekt:Posamezen projekt|redno:Redno sodelovanje|narocnina:Naročnina ali pogodba|najem:Najem|poraba:Plačilo po porabi"],
    [5101,4009,"osnovna-cena","Osnovna cena","money",1,"Cena brez dodatnih stroškov"],
    [5102,4009,"ddv","DDV","select",1,"","vkljucen:Vključen|ni-vkljucen:Ni vključen|ni-naveden:Ni naveden"],
    [5103,4006,"kolicina-enota","Količina in obračunska enota","text",1,"npr. 12 ur, 30 m², 3 uporabniki"],
    [5104,4012,"popusti","Popusti in pogoji popusta","textarea",0,"Kdaj popust velja in kdaj se izgubi?"],
    [5105,4012,"dodatni-stroski","Dodatni in enkratni stroški","textarea",1,"Aktivacija, dostava, montaža, pot, material …"],
    [5106,4010,"ponavljajoci-strosek","Ponavljajoči strošek","money",1,"Mesečni ali letni znesek"],
    [5107,4012,"indeksacija","Podražitve in indeksacija","textarea",0,"Kako in kdaj se cena lahko spremeni?"],
    [5108,4011,"provizija-osnova","Cena po porabi ali uspehu","text",1,"Odstotek, enota, prag in osnova obračuna"],
    [5201,4004,"predmet","Kaj točno kupujete","textarea",1,"Izdelek, storitev ali rezultat"],
    [5202,4007,"kolicine-specifikacije","Specifikacije in kakovost","textarea",1,"Mere, modeli, material, standard ali različica"],
    [5203,4005,"vkljuceno","Kaj je vključeno","textarea",1,"Dostava, montaža, konfiguracija, usposabljanje …"],
    [5204,4005,"izkljuceno","Kaj ni vključeno ali ni jasno","textarea",1,"Kaj bo treba naročiti ali plačati posebej?"],
    [5205,4008,"obveznosti-narocnika","Kaj morate zagotoviti vi","textarea",1,"Dostop, elektrika, vsebine, dovoljenja, materiali …"],
    [5206,4023,"podizvajalci","Podizvajalci","select",1,"Ali sme ponudnik uporabiti podizvajalce?","da:Da|ne:Ne|ni-naveden:Ni navedeno"],
    [5207,4019,"prevzem-merila","Merila za rezultat in prevzem","textarea",1,"Kako se potrdi, da je delo pravilno zaključeno?"],
    [5208,4007,"licence-uporabniki","Licence, uporabniki, naprave ali lokacije","text",0,"Kaj omejuje uporabo?"],
    [5301,4013,"zacetek","Predviden začetek","date",0,""],
    [5302,4013,"rok-izvedbe","Rok izvedbe ali dobave","text",1,"Datum, približno obdobje ali število delovnih dni"],
    [5303,4014,"predplacilo","Predplačilo","money",0,"Znesek ali odstotek"],
    [5304,4014,"obroki-mejniki","Obroki in mejniki","textarea",1,"Kateri znesek zapade ob katerem dogodku?"],
    [5305,4014,"rok-placila","Rok plačila računa","text",1,"npr. 14 dni"],
    [5306,4014,"zamuda-obresti","Zamudne obresti in stroški","textarea",0,""],
    [5307,4014,"zadrzani-znesek","Zadržani znesek do prevzema","money",0,""],
    [5308,4014,"nacin-placila","Način plačila","text",0,"Nakazilo, kartica, direktna obremenitev …"],
    [5309,4015,"termin-pogostost","Termin in razpoložljivost","text",1,"Datum, časovno okno ali pogostost storitve"],
    [5401,4016,"trajanje","Trajanje pogodbe","text",1,"Določen čas, nedoločen čas ali enkratno"],
    [5402,4016,"vezava","Minimalna vezava","text",0,""],
    [5403,4016,"podaljsanje","Samodejno podaljšanje","textarea",1,"Za koliko časa in pod katerimi pogoji?"],
    [5404,4017,"odpovedni-rok","Odpovedni rok in način odpovedi","textarea",1,"Rok, naslov in zahtevana oblika"],
    [5405,4018,"spremembe-pogojev","Enostranske spremembe pogojev","textarea",1,"Ali lahko ponudnik spremeni ceno ali storitev?"],
    [5406,4018,"omejitev-odgovornosti","Omejitev odgovornosti","textarea",0,""],
    [5407,4018,"pravo-sodisce","Pravo in pristojno sodišče","text",0,""],
    [5408,4024,"lastnistvo-podatkov","Lastništvo datotek, vsebin in podatkov","textarea",1,"Kdo obdrži izvorne datoteke in dostop?"],
    [5501,4020,"trajanje-garancije","Trajanje garancije ali jamstva","text",1,""],
    [5502,4020,"kritje-garancije","Kaj garancija krije","textarea",1,""],
    [5503,4020,"izkljucitve-garancije","Izključitve garancije","textarea",0,""],
    [5504,4020,"prijava-napake","Kako prijavite napako ali reklamacijo","textarea",1,"Kontakt, rok in zahtevana dokazila"],
    [5505,4021,"odzivni-cas","Odzivni in odpravljalni čas","text",1,""],
    [5506,4021,"servis-deli","Servis, rezervni deli in nadomestna oprema","textarea",0,""],
    [5507,4021,"sla-dostopnost","Dogovorjena razpoložljivost storitve","text",0,"npr. 99,9 % ali delovni čas podpore"],
    [5601,4022,"pravna-identiteta","Pravna oseba in podpisnik","text",1,"Kdo je dejanski pogodbeni partner?"],
    [5602,4001,"posrednik-status","Ali je ponudnik posrednik","select",0,"","da:Da|ne:Ne|ni-jasno:Ni jasno"],
    [5603,4022,"reference","Reference in primerljive izvedbe","textarea",0,""],
    [5604,4022,"certifikati-dovoljenja","Certifikati, licence in dovoljenja","textarea",0,""],
    [5605,4022,"zavarovanje-odgovornosti","Zavarovanje odgovornosti","textarea",0,"Zavarovalnica, kritje in veljavnost"],
    [5606,4023,"odvisnosti","Ključne odvisnosti in predpogoji","textarea",0,""],
    [5607,4024,"podatki-zasebnost","Osebni podatki, dostopi in zasebnost","textarea",1,""],
    [5608,4025,"ustni-dogovor","Kaj je bilo obljubljeno po telefonu ali ustno","textarea",1,""],
    [5609,4017,"izstopni-stroski","Stroški izstopa, prenosa ali demontaže","textarea",0,""],
    [5610,4022,"varnost-dokazila","Varnostna in zakonska dokazila","textarea",0,"Pregledi, meritve, izjave in roki veljavnosti"],
    [5611,4002,"vir-ponudbe-opomba","Podrobnost o prvem stiku","text",0,"Kdo vas je kontaktiral in kdaj?"],
    [5612,4019,"primerjava-trga","Primerljive ponudbe ali tržne cene","textarea",0,""],
    [5701,4026,"dokazilo-vrsta","Vrsta dokazila","select",1,"","ponudba:Ponudba|pogodba:Pogodba|cenik:Cenik|eposta:E-pošta|posnetek:Posnetek zaslona|drugo:Drugo"],
    [5702,4026,"dokazilo-opomba","Kaj dokazilo potrjuje","textarea",0,"Povežite dokazilo z dejstvom, ki ga želite preveriti"]
  ];

  var PROFIL_DODATNA_POLJA = {
    1006:[5103,5202,5302,5506,5609], 1009:[5106,5401,5402,5403,5404,5609], 1010:[5103,5106,5403,5609],
    1012:[5103,5106,5107,5403,5404], 1014:[5103,5106,5208,5401,5402,5403,5404,5609],
    1015:[5106,5208,5401,5403,5404,5507,5609], 1017:[5106,5208,5408,5507,5607],
    1018:[5106,5208,5408,5507,5607,5609], 1019:[5106,5208,5408,5507,5607,5609],
    1020:[5106,5208,5408,5507,5607,5609], 1021:[5106,5408,5607,5609],
    1022:[5106,5108,5207,5408,5607,5612], 1023:[5106,5108,5207,5608,5607],
    1027:[5106,5108,5207,5403,5404,5602,5609,5612], 1028:[5108,5207,5602],
    1030:[5103,5106,5107,5403,5404,5507,5607,5609], 1031:[5108,5404,5602],
    1032:[5106,5107,5203,5204,5401,5403,5404,5501,5502,5503],
    1035:[5103,5106,5202,5206,5401,5404,5604,5605], 1037:[5202,5302,5401,5501,5610],
    1038:[5202,5302,5401,5501,5610], 1039:[5103,5106,5202,5401,5604,5610], 1040:[5202,5302,5501,5604,5610]
  };

  var MODEL_DODATNA_POLJA = {
    2002:[5105,5203,5204,5301,5302,5501,5504], 2003:[5202,5205,5207,5301,5302,5304,5408],
    2004:[5106,5401,5403,5404,5505], 2005:[5103,5106,5208,5401,5402,5403,5404,5609],
    2006:[5103,5106,5107], 2007:[5103,5106,5401,5402,5404,5506,5609],
    2008:[5106,5401,5402,5403,5404,5609], 2009:[5106,5401,5504,5505,5506],
    2010:[5103,5107,5401,5403,5404], 2011:[5108,5207,5602], 2012:[5108,5207],
    2013:[5106,5108,5202,5207,5401,5403,5404], 2014:[5103,5106,5202,5206,5401,5404,5604,5605],
    2015:[5202,5302,5501,5604,5610]
  };

  function freezeRows(rows, mapper) { return Object.freeze(rows.map(function (row) { return Object.freeze(mapper(row)); })); }
  var families = freezeRows(DRUZINE, function (r) { return { id:r[0], code:r[1], label:r[2] }; });
  var profiles = freezeRows(PROFILI, function (r) { return { id:r[0], familyId:r[1], code:r[2], label:r[3], aliases:Object.freeze(r[4].split("|")) }; });
  var offerModels = freezeRows(MODELI, function (r) { return { id:r[0], code:r[1], label:r[2] }; });
  var salesChannels = freezeRows(KANALI, function (r) { return { id:r[0], code:r[1], label:r[2] }; });
  var areas = freezeRows(PODROCJA, function (r) { return { code:r[0], label:r[1], description:r[2], moduleIds:Object.freeze(r[3].slice()) }; });
  var modules = freezeRows(MODULI, function (r) { return { id:r[0], code:r[1], label:r[2], description:r[3], question:MODUL_VPRASANJA[r[1]]||r[2] }; });
  var fields = freezeRows(POLJA, function (r) {
    var options = r[7] ? r[7].split("|").map(function (v) { var p=v.split(":"); return Object.freeze({ id:p[0], label:p.slice(1).join(":") }); }) : [];
    return { id:r[0], moduleId:r[1], code:r[2], label:r[3], type:r[4], required:r[5]===1, help:r[6]||"", options:Object.freeze(options) };
  });
  var byId = function (rows) { var map=new Map(); rows.forEach(function (row) { map.set(row.id,row); }); return map; };
  var profileById=byId(profiles), modelById=byId(offerModels), channelById=byId(salesChannels), moduleById=byId(modules), fieldById=byId(fields);

  function normaliziraj(value) { return String(value==null?"":value).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
  function uniqueKnown(values, map) { var seen=new Set(); return (Array.isArray(values)?values:[]).map(Number).filter(function (id) { if(!map.has(id)||seen.has(id)) return false; seen.add(id); return true; }); }
  function poisciProfile(query, limit) {
    var q=normaliziraj(query); if(!q) return profiles.slice(0,Math.max(1,Number(limit)||12));
    return profiles.map(function(p){var hay=normaliziraj([p.label,p.code].concat(p.aliases).join(" "));var score=hay===q?100:hay.includes(q)?70:q.split(" ").reduce(function(s,t){return s+(hay.includes(t)?10:0);},0);return {profile:p,score:score};})
      .filter(function(x){return x.score>0;}).sort(function(a,b){return b.score-a.score||a.profile.label.localeCompare(b.profile.label,"sl");}).slice(0,Math.max(1,Number(limit)||12)).map(function(x){return x.profile;});
  }
  function sestavi(config) {
    config=config||{};
    var profileId=profileById.has(Number(config.profileId))?Number(config.profileId):null;
    var modelIds=uniqueKnown(config.offerModelIds,modelById), channelIds=uniqueKnown(config.salesChannelIds,channelById);
    var moduleIds=uniqueKnown(config.moduleIds,moduleById); if(!moduleIds.length) moduleIds=modules.map(function(m){return m.id;});
    var allowed=new Set(fields.filter(function(f){return moduleIds.includes(f.moduleId);}).filter(function(f){return f.required;}).map(function(f){return f.id;}));
    fields.forEach(function(f){if(moduleIds.includes(f.moduleId)&&![5108,5208,5408,5507,5609,5610,5611,5612].includes(f.id))allowed.add(f.id);});
    (PROFIL_DODATNA_POLJA[profileId]||[]).forEach(function(id){if(moduleIds.includes(fieldById.get(id).moduleId))allowed.add(id);});
    modelIds.forEach(function(modelId){(MODEL_DODATNA_POLJA[modelId]||[]).forEach(function(id){if(moduleIds.includes(fieldById.get(id).moduleId))allowed.add(id);});});
    if(channelIds.some(function(id){return [3004,3005,3006,3009,3011,3012].includes(id);})) [5608,5611].forEach(function(id){var field=fieldById.get(id);if(field&&moduleIds.includes(field.moduleId))allowed.add(id);});
    var orderedFields=fields.filter(function(f){return allowed.has(f.id);});
    return Object.freeze({ version:VERSION, contractVersion:CONTRACT_VERSION, profileId:profileId, offerModelIds:Object.freeze(modelIds), salesChannelIds:Object.freeze(channelIds), moduleIds:Object.freeze(moduleIds), modules:Object.freeze(moduleIds.map(function(id){var m=moduleById.get(id);return Object.freeze({id:m.id,code:m.code,label:m.label,description:m.description,question:m.question,fields:Object.freeze(orderedFields.filter(function(f){return f.moduleId===id;}))});})) });
  }
  function lunaContract() { return { version:CONTRACT_VERSION, providerProfiles:profiles.map(function(x){return [x.id,x.familyId,x.label,x.aliases];}), offerModels:offerModels.map(function(x){return [x.id,x.label];}), salesChannels:salesChannels.map(function(x){return [x.id,x.label];}), modules:modules.map(function(x){return [x.id,x.label];}), fields:fields.map(function(x){return [x.id,x.moduleId,x.label,x.type,x.options.map(function(o){return o.id;})];}) }; }
  function exactKeys(value, keys) { if(!value||Object.prototype.toString.call(value)!=="[object Object]")return false;var actual=Object.keys(value).sort(),expected=keys.slice().sort();return actual.length===expected.length&&actual.every(function(key,index){return key===expected[index];}); }
  function strictKnownIds(values, map, maxItems) { if(!Array.isArray(values)||values.length>maxItems)return null;var seen=new Set(),result=[];for(var index=0;index<values.length;index+=1){var id=values[index];if(!Number.isInteger(id)||!map.has(id)||seen.has(id))return null;seen.add(id);result.push(id);}return result; }
  function validateLunaProposal(proposal, sourceText) {
    if(!exactKeys(proposal,["profileId","offerModelIds","salesChannelIds","moduleIds","facts"])||typeof sourceText!=="string"||!sourceText.trim())return null;var source=sourceText;
    var profileId=proposal.profileId===null?null:proposal.profileId;
    if(profileId!==null&&(!Number.isInteger(profileId)||!profileById.has(profileId)))return null;
    var offerModelIds=strictKnownIds(proposal.offerModelIds,modelById,50),salesChannelIds=strictKnownIds(proposal.salesChannelIds,channelById,50),moduleIds=strictKnownIds(proposal.moduleIds,moduleById,28);
    if(!offerModelIds||!salesChannelIds||!moduleIds||!moduleIds.length||!Array.isArray(proposal.facts)||proposal.facts.length>50)return null;
    var assembled=sestavi({profileId:profileId,offerModelIds:offerModelIds,salesChannelIds:salesChannelIds,moduleIds:moduleIds});var allowed=new Set();assembled.modules.forEach(function(m){m.fields.forEach(function(f){allowed.add(f.id);});});
    var facts=[],seenFacts=new Set();for(var factIndex=0;factIndex<proposal.facts.length;factIndex+=1){var fact=proposal.facts[factIndex];if(!exactKeys(fact,["fieldId","value","evidence"])||!Number.isInteger(fact.fieldId)||seenFacts.has(fact.fieldId)||typeof fact.value!=="string"||!fact.value.trim()||fact.value.length>500||typeof fact.evidence!=="string"||!fact.evidence.trim()||fact.evidence.length>180||source.indexOf(fact.evidence)<0)return null;var field=fieldById.get(fact.fieldId);if(!field||!allowed.has(field.id)||(field.options.length&&!field.options.some(function(option){return option.id===fact.value;})))return null;seenFacts.add(field.id);facts.push(Object.freeze({fieldId:field.id,value:fact.value.trim(),evidence:fact.evidence,source:"luna",requiresHumanReview:true}));}
    return Object.freeze({profileId:profileId,offerModelIds:Object.freeze(offerModelIds),salesChannelIds:Object.freeze(salesChannelIds),moduleIds:Object.freeze(moduleIds),facts:Object.freeze(facts),requiresHumanReview:true});
  }
  return Object.freeze({ version:VERSION, contractVersion:CONTRACT_VERSION, families:families, profiles:profiles, offerModels:offerModels, salesChannels:salesChannels, areas:areas, modules:modules, fields:fields, poisciProfile:poisciProfile, sestavi:sestavi, lunaContract:lunaContract, validateLunaProposal:validateLunaProposal });
});
