(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJSvetovalecStoritveEngine = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var VERSION = "svetovalec-storitve-v1";
  var FAMILIES = Object.freeze([
    Object.freeze({ id: 900, code: "ponudnik", label: "Vrsta sogovornika" })
  ]);
  var PROFILES = Object.freeze([
    [9001,"izvajalec","Izvajalec storitve"], [9002,"dobavitelj","Dobavitelj ali prodajalec"],
    [9003,"operater","Operater ali ponudnik programske opreme"], [9004,"posrednik","Posrednik ali zastopnik"],
    [9005,"neznan","Še ni jasno"]
  ].map(function (row) { return Object.freeze({ id:row[0], familyId:900, code:row[1], label:row[2], aliases:Object.freeze([row[2]]) }); }));
  var MODELS = Object.freeze([
    [9101,"obstojeca-pogodba","Obstoječa pogodba ali naročnina"], [9102,"nova-potreba","Nova potreba ali povpraševanje"],
    [9103,"pogajanje","Pogajanje o pogojih"], [9104,"odpoved","Odpoved ali izstop"],
    [9105,"prodajni-klic","Prodajni klic"]
  ].map(function (row) { return Object.freeze({ id:row[0], code:row[1], label:row[2] }); }));
  var CHANNELS = Object.freeze([
    [9201,"telefon","Telefon"], [9202,"eposta","E-pošta"], [9203,"sms","SMS"],
    [9204,"osebno","Osebno"], [9205,"portal","Spletni portal"], [9206,"neznano","Ni jasno"]
  ].map(function (row) { return Object.freeze({ id:row[0], code:row[1], label:row[2] }); }));

  function options(text) {
    return Object.freeze(String(text || "").split("|").filter(Boolean).map(function (item) {
      var pair = item.split(":");
      return Object.freeze({ id:pair.shift(), label:pair.join(":") });
    }));
  }

  function buildService(definition) {
    var modules = Object.freeze(definition.modules.map(function (row) {
      return Object.freeze({ id:row[0], code:row[1], label:row[2], description:row[3], question:row[4] });
    }));
    var fields = Object.freeze(definition.fields.map(function (row) {
      return Object.freeze({ id:row[0], moduleId:row[1], code:row[2], label:row[3], type:row[4], required:row[5] === 1, help:row[6] || "", options:options(row[7]) });
    }));
    var moduleById = new Map(modules.map(function (module) { return [module.id, module]; }));
    var areas = Object.freeze(definition.areas.map(function (row) {
      return Object.freeze({ code:row[0], label:row[1], description:row[2], moduleIds:Object.freeze(row[3].slice()), icon:row[4] || "obseg" });
    }));
    function sestavi(config) {
      config = config || {};
      var requested = Array.isArray(config.moduleIds) ? config.moduleIds.map(Number) : [];
      var moduleIds = requested.filter(function (id, index) { return moduleById.has(id) && requested.indexOf(id) === index; });
      if (!moduleIds.length) moduleIds = modules.map(function (module) { return module.id; });
      return Object.freeze({
        version:VERSION,
        contractVersion:"svetovalec-" + definition.code + "-contract-v1",
        profileId:PROFILES.some(function (profile) { return profile.id === Number(config.profileId); }) ? Number(config.profileId) : null,
        offerModelIds:Object.freeze((config.offerModelIds || []).map(Number).filter(function (id) { return MODELS.some(function (model) { return model.id === id; }); })),
        salesChannelIds:Object.freeze((config.salesChannelIds || []).map(Number).filter(function (id) { return CHANNELS.some(function (channel) { return channel.id === id; }); })),
        moduleIds:Object.freeze(moduleIds),
        modules:Object.freeze(moduleIds.map(function (id) {
          var module = moduleById.get(id);
          return Object.freeze(Object.assign({}, module, { fields:Object.freeze(fields.filter(function (field) { return field.moduleId === id; })) }));
        }))
      });
    }
    return Object.freeze(Object.assign({}, definition.meta, {
      code:definition.code,
      version:VERSION,
      contractVersion:"svetovalec-" + definition.code + "-contract-v1",
      families:FAMILIES,
      profiles:PROFILES,
      offerModels:MODELS,
      salesChannels:CHANNELS,
      areas:areas,
      modules:modules,
      fields:fields,
      sestavi:sestavi,
      poisciProfile:function () { return []; }
    }));
  }

  var definitions = [
    {
      code:"narocnina",
      meta:{ title:"Preverite naročnino", summaryTitle:"Pregled naročnine", intro:"Preverimo stroške, uporabo, trajanje in varen izstop.", placeholder:"Npr. Naročnino plačujem mesečno, cena se je zvišala in ne vem, kdaj jo lahko odpovem …", primary:"Sestavi pregled", overviewTitle:"Kaj naj preverimo pri naročnini?", status:"Izberite področje naročnine ali Ateni opišite težavo.", accent:"#318fdd", tint:"#eff6fc" },
      areas:[
        ["storitev","Storitev in uporaba","Kaj plačujete in ali to dejansko uporabljate",[6101,6102,6103],"obseg"],
        ["stroski","Stroški naročnine","Redna cena, dodatki in podražitve",[6104,6105,6106],"cena"],
        ["trajanje","Trajanje in podaljšanje","Vezava, obnovitev in odpovedni datum",[6107,6108,6109],"pogodba"],
        ["izstop","Sprememba ali izstop","Vaš cilj, stroški izstopa in prenos",[6110,6111,6112],"placilo"],
        ["dokazila","Spremembe in dokazila","Obvestila, soglasja in dokumenti",[6113,6114,6115],"tveganja"]
      ],
      modules:[
        [6101,"S01","Predmet naročnine","Storitev, paket ali licenca","Kaj točno vključuje naročnina?"],
        [6102,"S02","Obseg uporabe","Uporabniki, naprave in dejanska raba","Koliko naročnine dejansko uporabljate?"],
        [6103,"Q01","Izvedba storitve","Ali storitev ustreza dogovoru","Ali storitev deluje tako, kot je bilo obljubljeno?"],
        [6104,"P01","Redni strošek","Znesek in pogostost plačila","Koliko zdaj plačujete in kako pogosto?"],
        [6105,"P02","Dodatni stroški","Poraba, dodatki in oprema","Kateri dodatni stroški se pojavljajo poleg naročnine?"],
        [6106,"P03","Podražitve","Zadnja sprememba cene","Kdaj in kako se je cena nazadnje spremenila?"],
        [6107,"K01","Trajanje in vezava","Začetek, konec in minimalna vezava","Koliko časa pogodba traja in ali še velja vezava?"],
        [6108,"K02","Samodejno podaljšanje","Način in obdobje podaljšanja","Ali se naročnina samodejno podaljšuje?"],
        [6109,"T01","Rok za odločitev","Znani odpovedni datum","Do kdaj morate ukrepati, da se naročnina ne podaljša?"],
        [6110,"C01","Vaš cilj","Ohranitev, sprememba ali odpoved","Kaj želite doseči z naročnino?"],
        [6111,"P04","Strošek izstopa","Znana nadomestila in odprte obveznosti","Ali so navedeni stroški predčasnega izstopa?"],
        [6112,"R01","Prenos po izstopu","Oprema, podatki, številke in dostopi","Kaj mora po spremembi ostati dostopno ali se prenesti?"],
        [6113,"R02","Obvestilo o spremembi","Kaj in kdaj je ponudnik spremenil","Katero spremembo vam je ponudnik napovedal?"],
        [6114,"C02","Vaš odziv","Soglasje ali ugovor uporabnika","Ali ste spremembo izrecno sprejeli ali ji ugovarjali?"],
        [6115,"E01","Dokazila","Pogodba, račun, pogoji in sporočila","Kateri dokumenti potrjujejo dogovor in spremembe?"]
      ],
      fields:[
        [16101,6101,"predmet","Storitev ali paket","textarea",1,"Kaj dobite za naročnino?"],
        [16102,6101,"ponudnik","Ponudnik","text",1,"Ime pogodbenega ponudnika"],
        [16103,6102,"enote","Uporabniki, naprave ali lokacije","text",0,"npr. 5 uporabnikov ali 2 telefonski številki"],
        [16104,6102,"raba","Dejanska uporaba","select",1,"","redno:Redno|delno:Delno|ne:Ne uporabljamo|ne-vem:Ne vem"],
        [16105,6103,"ustreznost","Ustreznost storitve","select",1,"","da:Da|delno:Delno|ne:Ne|ne-vem:Ne vem"],
        [16106,6103,"tezava","Kaj manjka ali ne deluje","textarea",0,"Opišite samo dejansko opaženo težavo"],
        [16107,6104,"znesek","Trenutni znesek","money",1,"Vpišite tudi valuto"],
        [16108,6104,"pogostost","Pogostost plačila","select",1,"","mesec:Mesečno|leto:Letno|poraba:Po porabi|drugo:Drugo"],
        [16109,6105,"dodatki","Dodatni ali spremenljivi stroški","textarea",0,"Poraba, oprema, dodatne licence, administracija …"],
        [16110,6106,"sprememba","Zadnja podražitev","textarea",0,"Stari in novi znesek ter datum, če so znani"],
        [16111,6107,"trajanje","Trajanje pogodbe","text",1,"Določen ali nedoločen čas"],
        [16112,6107,"vezava","Minimalna vezava","text",0,"Če je znana"],
        [16113,6108,"podaljsanje","Samodejno podaljšanje","select",1,"","da:Da|ne:Ne|nejasno:Ni jasno"],
        [16114,6108,"obdobje","Obdobje podaljšanja","text",0,"npr. za 12 mesecev"],
        [16115,6109,"rok","Znani rok za odpoved","text",0,"Datum ali število dni pred iztekom"],
        [16116,6110,"cilj","Želeni rezultat","select",1,"","obdrzi:Obdržati pod boljšimi pogoji|spremeni:Spremeniti paket|odpovej:Odpovedati|preveri:Najprej preveriti možnosti"],
        [16117,6110,"datum","Želeni datum spremembe","date",0,""],
        [16118,6111,"stroski","Znani stroški izstopa","textarea",0,"Brez pravne presoje; prepišite navedeno"],
        [16119,6112,"prenos","Kaj je treba vrniti ali prenesti","textarea",0,"Oprema, številke, podatki, domene, licence …"],
        [16120,6113,"obvestilo","Vsebina in datum obvestila","textarea",1,"Kaj se spreminja in od kdaj?"],
        [16121,6114,"odziv","Vaš dosedanji odziv","select",1,"","sprejel:Sprejel sem|ugovarjal:Ugovarjal sem|brez:Brez odziva|ne-vem:Ne vem"],
        [16122,6115,"dokazila","Razpoložljivi dokumenti","textarea",1,"Pogodba, splošni pogoji, računi, e-pošta ali posnetek zaslona"]
      ]
    },
    {
      code:"pogajanje",
      meta:{ title:"Pogajajte se ali odpovejte", summaryTitle:"Načrt pogajanja ali odpovedi", intro:"Določimo cilj, meje in dejstva za varno naslednjo potezo.", placeholder:"Npr. Želim nižjo ceno, sicer bi pogodbo zaključil ob prvem varnem datumu …", primary:"Sestavi načrt", overviewTitle:"Kaj naj pripravimo?", status:"Izberite področje pogajanja ali odpovedi.", accent:"#855bd1", tint:"#f5f2fb" },
      areas:[
        ["cilj","Cilj in prioritete","Kaj želite doseči in česa ne sprejmete",[6201,6202,6203],"pogodba"],
        ["izhodisce","Trenutno izhodišče","Obstoječi dogovor, težava in sogovornik",[6204,6205,6206],"obseg"],
        ["okvir","Pogajalski okvir","Ciljna meja, alternativa in rok",[6207,6208,6209],"cena"],
        ["odpoved","Priprava odpovedi","Želeni konec, znani pogoji in posledice",[6210,6211,6212],"placilo"],
        ["dokazila","Sporočilo in dokazila","Obljube, dokumenti in želeni stik",[6213,6214,6215],"tveganja"]
      ],
      modules:[
        [6201,"C01","Glavni cilj","Prednostna sprememba ali izstop","Kaj je vaš glavni cilj?"],
        [6202,"C02","Najpomembnejši pogoji","Cena, obseg, rok ali kakovost","Kateri pogoji so za vas najpomembnejši?"],
        [6203,"R01","Rdeče črte","Česa ne želite sprejeti","Kje je vaša meja, čez katero ne boste šli?"],
        [6204,"S01","Trenutni dogovor","Kaj trenutno velja","Kakšen dogovor ali pogodba trenutno velja?"],
        [6205,"Q01","Razlog za spremembo","Kaj je sprožilo pogajanje","Zakaj želite pogoje spremeniti ali razmerje končati?"],
        [6206,"C03","Sogovornik","Kdo odloča na drugi strani","S kom ste se doslej pogovarjali?"],
        [6207,"P01","Ciljni rezultat","Želena cena ali drugi merljiv rezultat","Kakšen konkreten rezultat želite doseči?"],
        [6208,"P02","Sprejemljiva meja","Najslabši še sprejemljiv rezultat","Kaj je za vas še sprejemljivo?"],
        [6209,"T01","Alternativa in rok","Druga možnost ter časovna omejitev","Kaj boste naredili, če dogovora ne bo, in do kdaj ga potrebujete?"],
        [6210,"K01","Želeni konec","Kdaj želite razmerje zaključiti","Kdaj naj bi pogodba ali sodelovanje prenehalo?"],
        [6211,"K02","Znani pogoji izstopa","Rok, vezava in strošek","Kaj v dokumentih piše o odpovedi ali izstopu?"],
        [6212,"R02","Posledice izstopa","Prenos, oprema, podatki in neprekinjenost","Kaj mora biti urejeno, preden sodelovanje preneha?"],
        [6213,"E01","Ustne obljube","Kaj je bilo povedano, a ni zapisano","Katere pomembne obljube so bile dane ustno?"],
        [6214,"E02","Dokumenti","Pogodba, ponudba in komunikacija","Kateri dokumenti podpirajo vaše izhodišče?"],
        [6215,"C04","Način pogovora","Ton in kanal naslednjega stika","Kako želite, da poteka naslednji pogovor?"]
      ],
      fields:[
        [16201,6201,"cilj","Glavni cilj","select",1,"","cena:Boljša cena|pogoji:Boljši pogoji|obseg:Več ali drugačen obseg|odpoved:Odpoved|kombinacija:Kombinacija"],
        [16202,6202,"prioritete","Najpomembnejše prioritete","textarea",1,"Navedite največ tri"],
        [16203,6203,"meje","Nesprejemljivi pogoji","textarea",1,"Kaj mora Atena jasno zavrniti?"],
        [16204,6204,"dogovor","Trenutni dogovor","textarea",1,"Cena, obseg, trajanje in kar je za cilj pomembno"],
        [16205,6205,"razlog","Razlog za spremembo","textarea",1,"Opišite dejstva brez pravne razlage"],
        [16206,6206,"sogovornik","Podjetje in kontaktna oseba","text",1,""],
        [16207,6207,"cilj-rezultat","Želeni rezultat","textarea",1,"npr. 15 % nižja cena ali odpoved brez dodatnih stroškov"],
        [16208,6208,"minimum","Najnižji sprejemljiv rezultat","textarea",1,""],
        [16209,6209,"alternativa","Vaša alternativa","textarea",0,"Drug ponudnik, manjši paket, premor …"],
        [16210,6209,"rok","Rok za dogovor","date",0,""],
        [16211,6210,"konec","Želeni datum konca","date",0,""],
        [16212,6211,"pogoji","Znani pogoji odpovedi","textarea",0,"Prepišite rok, vezavo in stroške; način pravne izvedbe določi strokovnjak"],
        [16213,6212,"posledice","Kaj je treba urediti pred izstopom","textarea",0,"Oprema, podatki, številke, prehod na drugega ponudnika …"],
        [16214,6213,"obljube","Ustne obljube","textarea",0,"Kdo, kaj in približno kdaj"],
        [16215,6214,"dokazila","Razpoložljivi dokumenti","textarea",1,""],
        [16216,6215,"kanal","Prednostni kanal","select",1,"","eposta:E-pošta|telefon:Telefon|sestanek:Sestanek|priporoceno:Priporočena pošta"],
        [16217,6215,"ton","Želeni ton","select",1,"","miren:Miren in sodelovalen|odlocen:Odločen|kratek:Kratek in neposreden"],
        [16218,6215,"sporocilo","Dodatna navodila Ateni","textarea",0,"Česa naj ne obljubi ali sprejme"]
      ]
    },
    {
      code:"ponudbe",
      meta:{ title:"Uredite mi ponudbe", summaryTitle:"Načrt pridobivanja ponudb", intro:"Pripravimo jasno povpraševanje in merila za primerjavo.", placeholder:"Npr. Potrebujem tri primerljive ponudbe za novo spletno stran do konca oktobra …", primary:"Sestavi povpraševanje", overviewTitle:"Kaj potrebujemo za ponudbe?", status:"Izberite področje povpraševanja ali opišite potrebo.", accent:"#159f9b", tint:"#eef9f7" },
      areas:[
        ["potreba","Potreba in rezultat","Kaj kupujete in kaj mora biti doseženo",[6301,6302,6303],"obseg"],
        ["zahteve","Obseg in zahteve","Količina, kakovost in vaše obveznosti",[6304,6305,6306],"garancija"],
        ["proracun","Proračun in plačilo","Cenovni okvir in primerljiv obračun",[6307,6308,6309],"cena"],
        ["rok","Rok in izvedba","Lokacija, začetek in razpoložljivost",[6310,6311,6312],"placilo"],
        ["izbor","Ponudniki in izbor","Koga povabiti in kako primerjati",[6313,6314,6315,6316],"tveganja"]
      ],
      modules:[
        [6301,"S01","Predmet povpraševanja","Izdelek, storitev ali rezultat","Kaj točno potrebujete?"],
        [6302,"Q01","Uspešen rezultat","Merila dokončanja","Kako boste vedeli, da je naročilo uspešno izvedeno?"],
        [6303,"C01","Razlog in uporaba","Zakaj to potrebujete","Za kaj boste rešitev uporabljali?"],
        [6304,"S02","Količina in obseg","Enote, uporabniki, lokacije ali ure","Kolikšen obseg potrebujete?"],
        [6305,"S03","Nujne zahteve","Specifikacije in standardi","Katere zahteve mora izpolniti vsaka ponudba?"],
        [6306,"S04","Vaš prispevek","Podatki, dostopi in materiali naročnika","Kaj lahko zagotovite vi?"],
        [6307,"P01","Proračun","Ciljni in najvišji znesek","Kakšen cenovni okvir imate?"],
        [6308,"P02","Način obračuna","Fiksno, po enoti ali po porabi","Kako naj ponudniki prikažejo ceno?"],
        [6309,"P03","Plačilni okvir","Predplačilo, obroki in valuta","Kateri plačilni pogoji so za vas sprejemljivi?"],
        [6310,"T01","Začetek in zaključek","Želeni časovni okvir","Kdaj naj se izvedba začne in konča?"],
        [6311,"T02","Lokacija izvedbe","Naslov, območje ali delo na daljavo","Kje se naročilo izvaja?"],
        [6312,"T03","Časovne omejitve","Dostopnost, termini in odvisnosti","Katere časovne omejitve morajo ponudniki poznati?"],
        [6313,"R01","Iskanje ponudnikov","Območje in tip ponudnika","Kakšne ponudnike naj Atena poišče?"],
        [6314,"R02","Izključitve","Koga ali česa ne vključiti","Ali katerega ponudnika ali rešitev ne želite?"],
        [6315,"Q02","Merila primerjave","Cena, rok, kakovost in reference","Po katerih merilih naj ponudbe primerjamo?"],
        [6316,"C02","Obseg pridobivanja","Število ponudb in dovoljen stik","Koliko ponudb želite in kaj smemo deliti s ponudniki?"]
      ],
      fields:[
        [16301,6301,"predmet","Kaj potrebujete","textarea",1,""],
        [16302,6302,"rezultat","Merljiv uspešen rezultat","textarea",1,""],
        [16303,6303,"uporaba","Namen uporabe","textarea",0,""],
        [16304,6304,"obseg","Količina in enota","text",1,"npr. 200 m², 8 uporabnikov, 3 vozila"],
        [16305,6305,"nujno","Nujne zahteve","textarea",1,"Ločite nujno od zaželenega"],
        [16306,6306,"prispevek","Kaj zagotovite vi","textarea",0,""],
        [16307,6307,"ciljni-proracun","Ciljni proračun","money",0,""],
        [16308,6307,"najvec","Najvišji znesek","money",0,""],
        [16309,6308,"obracun","Želeni način obračuna","select",1,"","fiksno:Fiksna skupna cena|enota:Cena po enoti|poraba:Po porabi|primerjaj:Naj ponudniki predlagajo"],
        [16310,6309,"placilo","Sprejemljivi plačilni pogoji","textarea",0,""],
        [16311,6310,"zacetek","Želeni začetek","date",0,""],
        [16312,6310,"zakljucek","Želeni zaključek","date",0,""],
        [16313,6311,"lokacija","Lokacija ali območje","text",1,""],
        [16314,6312,"omejitve","Termini in odvisnosti","textarea",0,""],
        [16315,6313,"ponudniki","Vrsta in območje ponudnikov","textarea",1,""],
        [16316,6314,"izkljuci","Izključeni ponudniki ali rešitve","textarea",0,""],
        [16317,6315,"merila","Tri glavna merila","textarea",1,"npr. skupna cena, rok in garancija"],
        [16318,6316,"stevilo","Želeno število ponudb","select",1,"","dve:2 ponudbi|tri:3 ponudbe|pet:5 ponudb|predlagaj:Naj Atena predlaga"],
        [16319,6316,"deljenje","Kaj smemo deliti","textarea",1,"Ne vključujte skrivnosti ali nepotrebnih osebnih podatkov"],
        [16320,6316,"kontakt","Prednostni kanal odgovorov","select",1,"","eposta:E-pošta|telefon:Telefon|portal:Spletni portal" ]
      ]
    },
    {
      code:"klic",
      meta:{ title:"Vas kliče prodajalec?", summaryTitle:"Načrt prodajnega klica", intro:"Ateni določite cilj, meje in vprašanja za varen pogovor.", placeholder:"Npr. Kliče me prodajalec telekomunikacij. Zanima me cena, ne želim pa danes ničesar potrditi …", primary:"Pripravi klic", overviewTitle:"Kaj naj Atena uredi v klicu?", status:"Izberite področje klica ali opišite, kaj prodajalec ponuja.", accent:"#159f9b", tint:"#eef9f7" },
      areas:[
        ["klicatelj","Kdo kliče","Podjetje, oseba in razlog klica",[6401,6402,6403],"obseg"],
        ["ponudba","Kaj ponuja","Cena, obseg in prodajne trditve",[6404,6405,6406],"cena"],
        ["cilj","Vaš cilj in meje","Kaj naj Atena doseže in česa ne sme sprejeti",[6407,6408,6409],"pogodba"],
        ["varnost","Varnost klica","Nujnost, podatki in zahtevana dejanja",[6410,6411,6412],"tveganja"],
        ["povratek","Povratni stik","Kanal, čas in naslednji korak",[6413,6414,6415],"placilo"]
      ],
      modules:[
        [6401,"S01","Podjetje in klicatelj","Identiteta sogovornika","Kdo kliče in iz katerega podjetja?"],
        [6402,"C01","Odnos s podjetjem","Prvi stik ali obstoječe sodelovanje","Ali s podjetjem že sodelujete?"],
        [6403,"T01","Čas klica","Kdaj kliče oziroma kdaj naj pokliče nazaj","Kdaj poteka klic ali je dogovorjen povratni stik?"],
        [6404,"S02","Predmet ponudbe","Izdelek ali storitev","Kaj vam prodajalec ponuja?"],
        [6405,"P01","Cena in obveznosti","Znesek, trajanje in dodatki","Kakšno ceno in obveznosti je prodajalec navedel?"],
        [6406,"R01","Prodajne trditve","Prihranki, ugodnosti in roki","Katere pomembne koristi ali obljube prodajalec navaja?"],
        [6407,"C02","Cilj klica","Informacije, ponudba ali zavrnitev","Kaj naj Atena v tem klicu doseže?"],
        [6408,"C03","Vprašanja za prodajalca","Kaj mora biti pojasnjeno","Katera vprašanja mora Atena obvezno postaviti?"],
        [6409,"R02","Meje pooblastila","Brez naročila, soglasja ali deljenja podatkov","Česa Atena brez vaše potrditve ne sme narediti?"],
        [6410,"R03","Pritisk in nujnost","Časovno omejene zahteve","Ali prodajalec zahteva takojšnjo odločitev?"],
        [6411,"R04","Zahtevani podatki","Osebni, bančni ali dostopni podatki","Katere podatke ali dostope prodajalec zahteva?"],
        [6412,"E01","Dokazilo ponudbe","Pisna ponudba ali pogoji","Ali je prodajalec poslal pisno ponudbo?"],
        [6413,"C04","Prednostni kanal","Telefon, e-pošta, SMS ali pisno","Po katerem kanalu želite nadaljevati?"],
        [6414,"T02","Čas nadaljevanja","Datum in čas povratnega stika","Kdaj je najprimernejši naslednji stik?"],
        [6415,"Q01","Naslednji korak","Kaj naj se zgodi po pogovoru","Kakšen naj bo naslednji korak po klicu?"]
      ],
      fields:[
        [16401,6401,"podjetje","Podjetje","text",1,""],
        [16402,6401,"oseba","Ime klicatelja","text",0,"Če ga poznate"],
        [16403,6402,"odnos","Odnos s podjetjem","select",1,"","prvi:Prvi stik|ponudba:Že imam ponudbo|stranka:Obstoječa stranka|nekdanji:Nekdanji ponudnik|ne-vem:Ne vem"],
        [16404,6403,"datum","Datum povratnega stika","date",0,""],
        [16405,6403,"cas","Primeren čas","text",0,"npr. med 10.00 in 12.00"],
        [16406,6404,"predmet","Kaj prodajalec ponuja","textarea",1,""],
        [16407,6405,"cena","Navedena cena","money",0,""],
        [16408,6405,"obveznosti","Trajanje, vezava in dodatki","textarea",0,""],
        [16409,6406,"trditve","Obljube in prodajne trditve","textarea",1,""],
        [16410,6407,"cilj","Želeni cilj","select",1,"","informacije:Samo zbrati informacije|pisno:Pridobiti pisno ponudbo|pogajanje:Pogajati se|zavrni:Vljudno zavrniti|prekini:Zahtevati konec trženjskih stikov"],
        [16411,6408,"vprasanja","Obvezna vprašanja","textarea",1,""],
        [16412,6409,"meje","Atena brez potrditve ne sme","textarea",1,"npr. skleniti pogodbe, potrditi naročila ali deliti bančnih podatkov"],
        [16413,6410,"nujnost","Zahteva takojšnjo odločitev","select",1,"","da:Da|ne:Ne|ne-vem:Ne vem"],
        [16414,6411,"podatki","Zahtevani podatki ali dostopi","textarea",0,""],
        [16415,6412,"pisno","Pisna ponudba obstaja","select",1,"","da:Da|ne:Ne|obljubljena:Obljubljena|ne-vem:Ne vem"],
        [16416,6413,"kanal","Prednostni način stika","select",1,"","eposta:E-pošta|sms:SMS|telefon:Telefon|posta:Priporočena pošta"],
        [16417,6414,"datum","Želeni datum","date",0,""],
        [16418,6414,"cas","Želeni čas","text",0,"npr. čim prej ali po 15.00"],
        [16419,6415,"naslednje","Naslednji korak","select",1,"","povzetek:Pisni povzetek|primerjava:Primerjava ponudbe|ponovni-klic:Ponovni klic po pregledu|brez:Zaključek brez nadaljevanja"],
        [16420,6415,"opomba","Dodatna zahteva","textarea",0,"" ]
      ]
    }
  ];

  var services = Object.freeze(definitions.map(buildService));
  var byCode = new Map(services.map(function (service) { return [service.code, service]; }));
  return Object.freeze({ version:VERSION, services:services, get:function (code) { return byCode.get(String(code || "")) || null; } });
});
