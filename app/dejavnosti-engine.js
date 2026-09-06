(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJDejavnostiEngine = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var SKUPINE = [
    ["gradnja", "Gradnja in obnova", "Splošno gradbeništvo|Novogradnje|Prenove stanovanj|Prenove hiš|Zidarska dela|Betoniranje|Tesarstvo|Krovska dela|Kleparstvo|Fasaderstvo|Suhomontaža|Mavčarska dela|Slikopleskarstvo|Polaganje keramike|Polaganje talnih oblog|Parketarstvo|Kamnoseštvo|Asfaltiranje|Tlakovanje|Rušitvena dela|Izkopi in zemeljska dela|Geodetske storitve|Arhitektura|Gradbeni nadzor|Projektiranje objektov|Sanacija vlage|Hidroizolacija|Toplotna izolacija|Dimnikarstvo|Montaža oken in vrat"],
    ["instalacije", "Inštalacije in vzdrževanje", "Elektroinštalacije|Vodovodne inštalacije|Ogrevalni sistemi|Plinske inštalacije|Klimatske naprave|Prezračevanje|Toplotne črpalke|Sončne elektrarne|Pametne hiše|Alarmni sistemi|Videonadzor|Domofoni|Telekomunikacijske inštalacije|Optična omrežja|Računalniška omrežja|Servis gospodinjskih aparatov|Servis ogrevanja|Servis klimatskih naprav|Servis dvigal|Vzdrževanje stavb|Hišniška dela|Ključavničarstvo|Varjenje|Strojne inštalacije|Industrijsko vzdrževanje|Popravilo električnih naprav|Montaža pohištva|Montaža kuhinj|Montaža senčil|Montaža garažnih vrat"],
    ["dom", "Dom, vrt in okolica", "Vrtnarstvo|Urejanje okolice|Košnja trave|Obrezovanje dreves|Podiranje dreves|Namakanje vrtov|Krajinska arhitektura|Čiščenje stanovanj|Čiščenje poslovnih prostorov|Čiščenje oken|Globinsko čiščenje|Čiščenje fasad|Čiščenje žlebov|Selitvene storitve|Odvoz pohištva|Odvoz odpadkov|Dezinsekcija|Deratizacija|Zatiranje škodljivcev|Bazen in vzdrževanje bazenov|Izdelava ograj|Senčila in tende|Tapetništvo|Restavriranje pohištva|Mizarstvo|Izdelava pohištva|Notranje oblikovanje|Dekoracija doma|Upravljanje objektov|Zimska služba"],
    ["vozila", "Vozila in prevoz", "Avtoservis|Avtokleparstvo|Avtoličarstvo|Vulkanizerstvo|Avtoelektrika|Avtodiagnostika|Menjava olja|Servis klimatskih naprav v vozilih|Avtopralnica|Poliranje vozil|Vleka vozil|Pomoč na cesti|Najem vozil|Prodaja vozil|Prevoz oseb|Taksi prevoz|Avtobusni prevoz|Kombi prevoz|Tovorni prevoz|Kurirske storitve|Dostava paketov|Špedicija|Logistika|Skladiščenje|Selitve|Servis motornih koles|Servis koles|Prodaja koles|Navtični servis|Prevoz gradbenega materiala"],
    ["digitalno", "Marketing in splet", "SEO|Google Ads|Meta oglasi|Spletno oglaševanje|Digitalni marketing|Vsebinski marketing|E-poštni marketing|Družbena omrežja|Upravljanje družbenih omrežij|Izdelava spletnih strani|Spletne trgovine|Oblikovanje uporabniške izkušnje|Grafično oblikovanje|Celostna grafična podoba|Oblikovanje logotipa|Pisanje besedil|Prevajanje|Lektoriranje|Odnosi z javnostmi|Tržne raziskave|Prodajno svetovanje|Telemarketing|Fotografiranje izdelkov|Video marketing|Influencer marketing|Organizacija promocij|Tisk oglasnih materialov|Izdelava tabel in napisov|Domene in gostovanje|Spletna analitika"],
    ["poslovanje", "Poslovne in finančne storitve", "Računovodstvo|Knjigovodstvo|Obračun plač|Davčno svetovanje|Finančno svetovanje|Poslovno svetovanje|Pravno svetovanje|Odvetniške storitve|Notarske storitve|Revizija|Cenitve|Zavarovalno posredovanje|Zavarovanje|Bančne storitve|Kreditno posredovanje|Izterjava terjatev|Kadrovske storitve|Zaposlovanje|Agencija za delo|Virtualna pisarna|Administrativne storitve|Tajniške storitve|Upravljanje dokumentov|Arhiviranje|Nabavno svetovanje|Svetovanje za razpise|Projektno vodenje|Certificiranje|Varstvo pri delu|Požarna varnost"],
    ["trgovina", "Trgovina in prodaja", "Živilska trgovina|Spletna trgovina|Trgovina z oblačili|Trgovina z obutvijo|Trgovina s pohištvom|Trgovina z elektroniko|Trgovina z računalniki|Trgovina z gradbenim materialom|Trgovina z orodjem|Trgovina z avtodeli|Trgovina s kolesi|Cvetličarna|Vrtnarski center|Lekarna|Optika|Zlatarna|Knjigarna|Papirnica|Trgovina za male živali|Veleprodaja|Maloprodaja|Prodajni avtomati|Rabljeno blago|Antikvariat|Darila in spominki|Otroška oprema|Športna oprema|Medicinski pripomočki|Pisarniška oprema|Embalaža"],
    ["hrana", "Hrana in gostinstvo", "Restavracija|Gostilna|Okrepčevalnica|Picerija|Kavarna|Bar|Pekarna|Slaščičarna|Mesnica|Ribarnica|Catering|Dostava hrane|Priprava malic|Organizacija pogostitev|Hotel|Motel|Penzion|Apartmaji|Turistična kmetija|Kamp|Hostel|Vinarstvo|Pivovarstvo|Žganjekuha|Pražarna kave|Proizvodnja hrane|Predelava mesa|Predelava mleka|Prehransko svetovanje|Najem gostinske opreme"],
    ["zdravje", "Zdravje, nega in lepota", "Splošna medicina|Zobozdravstvo|Fizioterapija|Delovna terapija|Psihoterapija|Psihološko svetovanje|Logopedija|Dietetično svetovanje|Masaža|Kiropraktika|Akupunktura|Veterina|Frizerski salon|Brivnica|Kozmetični salon|Nega nohtov|Pedikura|Ličenje|Permanentno ličenje|Tetoviranje|Pirsing|Wellness|Savna|Fitnes center|Osebno trenerstvo|Joga|Pilates|Plesni studio|Nega na domu|Optometrija"],
    ["izobrazevanje", "Izobraževanje in usposabljanje", "Inštrukcije|Jezikovni tečaji|Računalniški tečaji|Poslovna izobraževanja|Poklicna usposabljanja|Tečaji prve pomoči|Šola vožnje|Glasbena šola|Plesna šola|Športni treningi|Spletni tečaji|Mentorstvo|Coaching|Karierno svetovanje|Izobraževanje otrok|Varstvo otrok|Vrtec|Učna pomoč|Priprave na izpite|Delavnice za podjetja|Tehnično usposabljanje|Usposabljanje za varnost|Tečaji kuhanja|Umetniške delavnice|Tečaji fotografije"],
    ["ustvarjalno", "Mediji, kultura in dogodki", "Fotografija|Poročna fotografija|Video produkcija|Snemanje dogodkov|Montaža videa|Zvočna produkcija|Glasbeni studio|DJ storitve|Glasbeni nastopi|Organizacija dogodkov|Organizacija porok|Najem ozvočenja|Najem razsvetljave|Scenska tehnika|Dekoracija dogodkov|Cvetlična dekoracija|Tiskarstvo|3D tisk|Založništvo|Novinarstvo|Ilustracija|Animacija|Industrijsko oblikovanje|Modno oblikovanje|Šivanje|Krojaštvo|Izposoja kostumov|Galerija|Muzejske storitve|Kulturna produkcija"],
    ["it", "IT in tehnologija", "Razvoj programske opreme|Razvoj mobilnih aplikacij|Razvoj spletnih aplikacij|IT svetovanje|Sistemska administracija|Tehnična podpora|Servis računalnikov|Kibernetska varnost|Varnostni pregledi|Oblačne storitve|Podatkovne baze|Poslovna analitika|Umetna inteligenca|Avtomatizacija procesov|Integracija sistemov|ERP sistemi|CRM sistemi|Računovodski programi|Spletno gostovanje|Registracija domen|Obnova podatkov|Prodaja programske opreme|Elektronsko podpisovanje|Telekomunikacije|Klicni center|IoT rešitve|Razvoj iger|Blockchain rešitve|GIS sistemi|Tehnična dokumentacija"],
    ["industrija", "Proizvodnja in industrija", "Kovinska proizvodnja|Obdelava kovin|CNC obdelava|Orodjarstvo|Varjenje kovin|Laserski razrez|Plastična proizvodnja|Gumarska proizvodnja|Lesna proizvodnja|Proizvodnja pohištva|Papirna proizvodnja|Tisk embalaže|Tekstilna proizvodnja|Proizvodnja oblačil|Proizvodnja obutve|Kemijska proizvodnja|Kozmetična proizvodnja|Farmacevtska proizvodnja|Elektronska proizvodnja|Proizvodnja strojev|Proizvodnja vozil|Montaža izdelkov|Industrijsko pakiranje|Kontrola kakovosti|Laboratorijske analize|Prototipiranje|Vzdrževanje proizvodnje|Tehnično testiranje|Reciklaža materialov|Industrijsko čiščenje"],
    ["kmetijstvo", "Kmetijstvo, gozdarstvo in živali", "Poljedelstvo|Sadjarstvo|Vinogradništvo|Zelenjadarstvo|Cvetličarstvo|Ekološko kmetovanje|Živinoreja|Čebelarstvo|Ribištvo|Ribogojstvo|Gozdarstvo|Sečnja lesa|Spravilo lesa|Kmetijske storitve|Najem kmetijskih strojev|Servis kmetijskih strojev|Prodaja semen|Prodaja krme|Dresura psov|Pasji salon|Varstvo živali|Hotel za živali|Sprehajanje psov|Reja živali|Veterinarske storitve|Urejanje gozdnih poti|Lovske storitve|Predelava lesa|Kompostiranje|Vrtnarske sadike"],
    ["energija", "Energija in okolje", "Dobava elektrike|Dobava plina|Obnovljivi viri energije|Sončne elektrarne|Vetrna energija|Energetsko svetovanje|Energetske izkaznice|Meritve porabe energije|Polnilnice za električna vozila|Upravljanje odpadkov|Odvoz odpadkov|Reciklaža|Čiščenje odpadnih voda|Komunalne storitve|Okoljsko svetovanje|Meritve emisij|Sanacija onesnaženja|Geotermalni sistemi|Toplotne črpalke|Biomasa|Peleti in drva|Zbiranje nevarnih odpadkov|Ponovna uporaba materialov|Vzdrževanje kanalizacije|Čiščenje greznic"],
    ["nepremicnine", "Nepremičnine", "Prodaja nepremičnin|Oddaja nepremičnin|Nepremičninsko posredovanje|Upravljanje nepremičnin|Upravljanje večstanovanjskih stavb|Cenitev nepremičnin|Pregled nepremičnin|Home staging|Fotografiranje nepremičnin|Pravno svetovanje za nepremičnine|Vzdrževanje počitniških objektov|Kratkoročno oddajanje|Najem pisarn|Najem skladišč|Coworking|Investicije v nepremičnine|Razvoj nepremičninskih projektov|Facility management|Energetska sanacija stavb|Čiščenje po gradnji"],
    ["turizem", "Turizem, prosti čas in šport", "Turistična agencija|Turistični vodnik|Organizacija potovanj|Rezervacije nastanitev|Izleti|Prevoz turistov|Izposoja športne opreme|Smučarski servis|Kolesarski izleti|Pohodniški izleti|Vodni športi|Najem plovil|Šola smučanja|Šola plavanja|Fitnes|Športni klub|Pustolovski park|Escape room|Igralnica za otroke|Animacija gostov|Wellness turizem|Kongresni turizem|Lovski turizem|Ribiški turizem|Kampiranje"],
    ["osebno", "Osebne in gospodinjske storitve", "Varstvo otrok|Varstvo starejših|Pomoč na domu|Osebna asistenca|Gospodinjska pomoč|Likanje|Pralnica|Kemična čistilnica|Šiviljska popravila|Popravilo čevljev|Izdelava ključev|Pogrebne storitve|Genealogija|Osebno nakupovanje|Organizacija doma|Osebni stilist|Poročno svetovanje|Partnersko svetovanje|Astrologija|Prevajanje dokumentov|Dostava na dom|Oskrba počitniške hiše|Čuvanje hiše|Zasebni kuhar|Darilni paketi"],
    ["varnost", "Varnost in zaščita", "Fizično varovanje|Tehnično varovanje|Varovanje dogodkov|Receptorska služba|Detektivske storitve|Alarmni sistemi|Videonadzor|Požarna varnost|Varnost pri delu|Kibernetska varnost|Varovanje podatkov|Svetovanje GDPR|Kontrola dostopa|Intervencijska služba|Prevoz vrednostnih pošiljk|Varnostno usposabljanje|Meritve delovnega okolja|Periodični pregledi opreme|Zaščitna oprema|Načrti evakuacije"],
    ["javno", "Družbene in javne storitve", "Socialno svetovanje|Humanitarna pomoč|Invalidsko varstvo|Pomoč družinam|Mladinsko delo|Dnevni center|Dom za starejše|Rehabilitacija|Zaposlitvena rehabilitacija|Mediacija|Potrošniško svetovanje|Stanovanjsko svetovanje|Verske dejavnosti|Društvene dejavnosti|Sindikalne storitve|Zbornice in združenja|Razvoj lokalne skupnosti|Javne prireditve|Komunalno svetovanje|Prostovoljstvo"],
  ];

  var SOPOMENKE = {
    "SEO": "optimizacija za iskalnike|google iskanje|da me najdejo na googlu|visje na googlu|prvi na googlu",
    "Google Ads": "google oglasi|oglasevanje na googlu|adwords|placljivi oglasi",
    "Meta oglasi": "facebook oglasi|instagram oglasi|fb oglasi|oglasi na instagramu",
    "Izdelava spletnih strani": "spletna stran|internetna stran|web stran|naredi spletno stran|izdeluje strani",
    "Spletne trgovine": "webshop|online trgovina|prodaja prek spleta|e trgovina",
    "Računovodstvo": "racunovodja|vodi knjige|bilance|knjizenje racunov",
    "Obračun plač": "place zaposlenih|placilne liste|obracunava place",
    "Polaganje keramike": "keramicar|polaga ploscice|kopalniske ploscice|keramicne ploscice",
    "Vodovodne inštalacije": "vodovodar|popravlja pipe|pusca voda|odtoki|odmasi odtok",
    "Elektroinštalacije": "elektricar|elektrika po hisi|montira vticnice|elektricne napeljave",
    "Krovska dela": "krovec|dela strehe|popravlja streho|kritina",
    "Slikopleskarstvo": "pleskar|beljenje|barva stene|pleska stanovanja",
    "Fasaderstvo": "fasader|dela fasade|obnova fasade",
    "Mizarstvo": "mizar|dela omare|leseno pohistvo|pohistvo po meri",
    "Montaža kuhinj": "montira kuhinje|sestavlja kuhinjo",
    "Klimatske naprave": "klima|montaza klime|hlajenje prostorov",
    "Toplotne črpalke": "toplotna crpalka|montira toplotne crpalke",
    "Sončne elektrarne": "soncna elektrarna|solarni paneli|fotovoltajika|montira panele",
    "Čiščenje stanovanj": "cistilni servis|cisti stanovanja|pospravlja stanovanja",
    "Urejanje okolice": "ureja vrtove|urejanje vrta|vrtni servis",
    "Obrezovanje dreves": "obrezuje drevesa|arborist|obrezovanje sadnega drevja",
    "Avtoservis": "avtomehanik|popravlja avtomobile|servis avta|mehanicna delavnica",
    "Vulkanizerstvo": "vulkanizer|menjava gum|pnevmatike",
    "Vleka vozil": "avtovleka|vlece pokvarjen avto",
    "Selitvene storitve": "selitveni servis|seli pohistvo|selitev stanovanja",
    "Tovorni prevoz": "kamionski prevoz|prevoz tovora|prevoz blaga",
    "Kurirske storitve": "kurir|hitra dostava|razvoz paketov",
    "Frizerski salon": "frizer|striže lase|barvanje las|frizerske storitve",
    "Brivnica": "brivec|ureja brado|britje brade",
    "Kozmetični salon": "kozmeticarka|nega obraza|lepotni salon",
    "Nega nohtov": "manikura|gel nohti|ureja nohte",
    "Fizioterapija": "fizioterapevt|rehabilitacija po poskodbi|terapija gibanja",
    "Masaža": "maser|masira|sportna masaza|sprostitvena masaza",
    "Veterinarske storitve": "veterinar|zdravnik za zivali|zdravi zivali",
    "Catering": "pogostitev|hrana za dogodke|pripravi hrano za poroko",
    "Pekarna": "pek|pece kruh|pekovski izdelki",
    "Cvetličarna": "cvetlicar|prodaja roze|sopki",
    "Fotografija": "fotograf|slika dogodke|fotografske storitve",
    "Video produkcija": "snema videe|videograf|izdelava videa",
    "Organizacija dogodkov": "organizira prireditve|event agencija|organizacija zabave",
    "Prevajanje": "prevajalec|prevaja dokumente|prevodi",
    "Lektoriranje": "lektor|popravlja slovnico|jezikovni pregled",
    "Razvoj programske opreme": "programer|izdeluje programe|software development",
    "Servis računalnikov": "popravlja racunalnike|racunalniski servis|servis laptopov",
    "Kibernetska varnost": "varnost racunalnikov|hekerska zascita|penetracijski test",
    "Inštrukcije": "instruktor|ucna pomoc|pomaga pri matematiki|zasebne ure",
    "Šola vožnje": "avtosola|ucitelj voznje|izpit za avto",
    "Nepremičninsko posredovanje": "nepremicninski agent|prodaja stanovanja|posrednik za hise",
    "Pogrebne storitve": "pogrebno podjetje|organizacija pogreba|pogrebnik"
  };

  var PRILJUBLJENE = ["Računovodstvo", "Izdelava spletnih strani", "Elektroinštalacije", "Vodovodne inštalacije", "Slikopleskarstvo", "Polaganje keramike", "Avtoservis", "Čiščenje poslovnih prostorov", "Digitalni marketing", "Pravno svetovanje", "Catering", "Fotografija"];
  var STOP_BESEDE = new Set("in ali ter za na pri od do po iz z s v o ob je so se da ki kot kaj kdo podjetje podjetja ponuja dela delajo nudi nudijo storitev storitve potrebujem rabim ukvarja ukvarjajo".split(" "));

  function normaliziraj(vrednost) {
    return String(vrednost == null ? "" : vrednost).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("sl-SI").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function idIz(ime) { return normaliziraj(ime).replace(/\s+/g, "-"); }
  function besede(vrednost) { return normaliziraj(vrednost).split(" ").filter(function (b) { return b.length > 1 && !STOP_BESEDE.has(b); }); }

  var KATALOG = [];
  var VIDENI = new Set();
  SKUPINE.forEach(function (skupina) {
    skupina[2].split("|").forEach(function (ime) {
      if (VIDENI.has(ime)) return;
      VIDENI.add(ime);
      KATALOG.push(Object.freeze({
        id: idIz(ime),
        ime: ime,
        skupinaId: skupina[0],
        skupina: skupina[1],
        sopomenke: Object.freeze((SOPOMENKE[ime] || "").split("|").filter(Boolean)),
      }));
    });
  });
  KATALOG = Object.freeze(KATALOG);

  function razdaljaEna(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1 || Math.max(a.length, b.length) < 5) return false;
    var i = 0; var j = 0; var napake = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i += 1; j += 1; continue; }
      napake += 1;
      if (napake > 1) return false;
      if (a.length > b.length) i += 1;
      else if (b.length > a.length) j += 1;
      else { i += 1; j += 1; }
    }
    return napake + (i < a.length || j < b.length ? 1 : 0) <= 1;
  }

  function oceni(vnos, vnosBesede, zapis) {
    var ime = normaliziraj(zapis.ime);
    var fraze = [ime].concat(zapis.sopomenke.map(normaliziraj));
    var vseBesede = Array.from(new Set(fraze.flatMap(function (fraza) { return fraza.split(" "); })));
    var rezultat = 0; var dokazi = [];
    fraze.forEach(function (fraza, indeks) {
      if (vnos === fraza) { rezultat = Math.max(rezultat, indeks ? 220 : 240); dokazi.push(fraza); }
      else if (vnos.length >= 3 && fraza.includes(vnos)) { rezultat = Math.max(rezultat, indeks ? 145 : 170); dokazi.push(fraza); }
      else if (fraza.length >= 4 && vnos.includes(fraza)) { rezultat = Math.max(rezultat, indeks ? 170 : 185); dokazi.push(fraza); }
    });
    vnosBesede.forEach(function (iskana) {
      var najboljsa = 0;
      vseBesede.forEach(function (kandidat) {
        if (iskana === kandidat) najboljsa = Math.max(najboljsa, 48);
        else if (iskana.length >= 3 && (kandidat.startsWith(iskana) || iskana.startsWith(kandidat))) najboljsa = Math.max(najboljsa, 30);
        else if (razdaljaEna(iskana, kandidat)) najboljsa = Math.max(najboljsa, 20);
      });
      rezultat += najboljsa;
    });
    if (vnosBesede.length > 1 && rezultat && vnosBesede.every(function (iskana) {
      return vseBesede.some(function (kandidat) { return iskana === kandidat || kandidat.startsWith(iskana) || iskana.startsWith(kandidat) || razdaljaEna(iskana, kandidat); });
    })) rezultat += 55;
    return { rezultat: rezultat, dokazi: dokazi.slice(0, 2) };
  }

  function predlagaj(vnos, opcije) {
    var nastavitve = opcije || {};
    var meja = Math.max(1, Math.min(30, Number(nastavitve.limit) || 12));
    var izlocene = new Set((nastavitve.izloci || []).map(normaliziraj));
    var cisto = normaliziraj(vnos);
    if (!cisto) return PRILJUBLJENE.map(function (ime) { return KATALOG.find(function (zapis) { return zapis.ime === ime; }); }).filter(Boolean).filter(function (zapis) { return !izlocene.has(normaliziraj(zapis.ime)); }).slice(0, meja);
    var tokeni = besede(cisto);
    var razvrsceni = KATALOG.map(function (zapis) {
      var ocena = oceni(cisto, tokeni, zapis);
      return Object.assign({}, zapis, { ocena: ocena.rezultat, dokaz: ocena.dokazi });
    }).filter(function (zapis) { return zapis.ocena >= 20 && !izlocene.has(normaliziraj(zapis.ime)); }).sort(function (a, b) {
      return b.ocena - a.ocena || a.ime.localeCompare(b.ime, "sl");
    });
    var najboljsa = razvrsceni[0] ? razvrsceni[0].ocena : 0;
    if (tokeni.length > 1 && najboljsa < 45) return [];
    var prag = najboljsa >= 100 ? Math.max(45, najboljsa * 0.3) : 20;
    return razvrsceni.filter(function (zapis) { return zapis.ocena >= prag; }).slice(0, meja);
  }

  function razvrsti(vnos) {
    var predlogi = predlagaj(vnos, { limit: 3 });
    var prviKandidat = predlogi[0] || null;
    var prvi = prviKandidat && prviKandidat.ocena >= 45 ? prviKandidat : null;
    return {
      predlogi: predlogi,
      glavni: prvi,
      zaupanje: !prvi ? "ni_zadetka" : prvi.ocena >= 180 ? "visoko" : prvi.ocena >= 90 ? "srednje" : "nizko",
      zahtevaPotrditev: true,
    };
  }

  return Object.freeze({
    version: "dejavnosti-v1",
    katalog: KATALOG,
    skupine: Object.freeze(SKUPINE.map(function (s) { return Object.freeze({ id: s[0], ime: s[1] }); })),
    normaliziraj: normaliziraj,
    predlagaj: predlagaj,
    razvrsti: razvrsti,
  });
});
