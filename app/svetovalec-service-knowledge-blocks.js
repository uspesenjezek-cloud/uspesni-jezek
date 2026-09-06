(function (root, factory) {
  var api;
  if (typeof module === "object" && module.exports) api = factory(require("./svetovalec-capability-catalog"), require("./atena-card-templates"));
  else api = factory(root && root.UJSvetovalecCapabilityCatalog, root && root.UJAtenaCardTemplates);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJSvetovalecServiceKnowledgeBlocks = api;
})(typeof window !== "undefined" ? window : null, function (capabilities, templates) {
  "use strict";

  var VERSION = "svetovalec-service-knowledge-v1";
  var CONTEXT_VERSION = "atena-service-knowledge-context-v1";
  var APPROVED_WIDGET_IDS = Object.freeze(((templates && templates.approvedTemplateIds) || []).slice());
  var APPROVED_WIDGET_SET = new Set(APPROVED_WIDGET_IDS);

  function freeze(value) {
    if (Array.isArray(value)) value.forEach(freeze);
    else if (value && typeof value === "object") Object.keys(value).forEach(function (key) { freeze(value[key]); });
    return value && typeof value === "object" ? Object.freeze(value) : value;
  }
  function uniq(values) { return Array.from(new Set(values)); }
  function condition(factId, operator, value) { return freeze({ factId:factId, operator:operator, value:value }); }
  function fact(id, label, type, required, widgetId, config) {
    config = config || {};
    return freeze({
      id:id, interfaceId:"atena:field:svetovalec-knowledge:" + id.replace(/[^a-z0-9-]+/gi, "-"),
      contextVersion:CONTEXT_VERSION, label:label, dataType:type, required:required !== false,
      widgetId:widgetId, allowedValues:freeze((config.allowedValues || []).slice()),
      showWhen:config.showWhen || null, validation:freeze(config.validation || {}),
      purpose:config.purpose || label, persistence:"svetovalec-session",
      antiPatterns:freeze(["Ne ugibaj manjkajoče vrednosti.", "Ne zavrni odgovora samo zato, ker je podan z lastnimi besedami."])
    });
  }
  function block(id, promptCode, label, purpose, facts, config) {
    config = config || {};
    return freeze({
      id:id, promptCode:promptCode, revision:1,
      interfaceId:"atena:card:svetovalec-knowledge:" + id.replace(/[^a-z0-9-]+/gi, "-"),
      contextVersion:CONTEXT_VERSION, label:label, purpose:purpose, facts:freeze(facts),
      dependsOn:freeze((config.dependsOn || []).slice()), unlocks:freeze((config.unlocks || []).slice()),
      showWhen:config.showWhen || null, completionGate:freeze((config.completionGate || facts.filter(function (item) { return item.required; }).map(function (item) { return item.id; })).slice()),
      actionUses:freeze((config.actionUses || ["ponudba","narocnina","pogajanje","ponudbe","klic"]).slice()),
      upsellRules:freeze((config.upsellRules || []).slice()), promptSummary:config.promptSummary || purpose,
      approvedWidgetIds:freeze(uniq(facts.map(function (item) { return item.widgetId; })))
    });
  }
  function upsell(id, when, targetActionCode, reason, targetProfileIds) {
    return freeze({ id:id, when:freeze(when), targetActionCode:targetActionCode, targetProfileIds:freeze((targetProfileIds || []).slice()), reason:reason, mode:"suggest-only" });
  }

  var COMMON_BLOCKS = freeze([
    block("svc:c:situation","c0","Cilj in trenutno stanje","Razjasni problem, želeni rezultat in nujnost.",[
      fact("situation.goal","Kaj želite doseči?","text",true,"besedilni-vnos"),
      fact("situation.currentState","Kaj imate ali uporabljate zdaj?","text",false,"besedilni-vnos"),
      fact("situation.urgency","Do kdaj potrebujete odločitev ali izvedbo?","date-or-relative",false,"relativni-rok")
    ],{unlocks:["svc:c:scope"],promptSummary:"cilj, sedanje stanje, nujnost"}),
    block("svc:c:provider","c1","Ponudnik in razmerje","Določi, kdo ponuja ali izvaja ter ali sodelovanje že obstaja.",[
      fact("provider.name","Kdo je ponudnik ali izvajalec?","text",false,"iskalni-izbirnik"),
      fact("provider.relationship","Kakšno je trenutno razmerje?","enum",true,"navpicni-izbor",{allowedValues:["nov","obstoječ","posrednik","neznano"]}),
      fact("provider.decisionAuthority","Kdo lahko potrdi spremembo ali odpoved?","enum",false,"mreza-izbir")
    ],{dependsOn:["svc:c:situation"],promptSummary:"ponudnik, novo/obstoječe razmerje, odločevalec"}),
    block("svc:c:scope","c2","Obseg in dobave","Določi predmet, vključeno, izključeno in merljiv rezultat.",[
      fact("scope.subject","Kaj točno kupujete ali naročate?","text",true,"besedilni-vnos"),
      fact("scope.included","Kaj mora biti vključeno?","string[]",true,"matrika-vkljucenosti"),
      fact("scope.deliverables","Kaj mora ponudnik predati?","string[]",true,"seznam-postavk"),
      fact("scope.acceptance","Po čem boste rezultat sprejeli?","string[]",false,"kontrolni-seznam-dokazil")
    ],{dependsOn:["svc:c:situation"],unlocks:["svc:c:price","svc:c:performance"],promptSummary:"predmet, vključeno/izključeno, dobave, sprejem"}),
    block("svc:c:price","c3","Cena in skupni strošek","Razstavi osnovno ceno, način obračuna, dodatke in plačilo.",[
      fact("price.model","Kako se cena obračuna?","enum",true,"dvojni-segment",{allowedValues:["enkratno","ponavljajoče","po porabi","po uspehu","kombinirano"]}),
      fact("price.baseEur","Kakšna je osnovna cena?","money",true,"natancen-znesek"),
      fact("price.extras","Kateri dodatki lahko spremenijo končno ceno?","string[]",false,"cenovni-most"),
      fact("price.payment","Kako in kdaj se plača?","object",false,"placilni-razrez")
    ],{dependsOn:["svc:c:scope"],upsellRules:[upsell("upsell:price:compare",[condition("price.extras","not-empty",true)],"ponudbe","Primerjava pokaže dejanski skupni strošek, ne le osnovne cene.")],promptSummary:"obračun, osnovna cena, dodatki, plačilo"}),
    block("svc:c:term","c4","Trajanje in podaljšanje","Določi začetek, konec, minimalno trajanje in obnovo.",[
      fact("term.start","Kdaj sodelovanje začne veljati?","date-or-unknown",true,"datum-z-gotovostjo"),
      fact("term.end","Kdaj se izteče?","date-or-unknown",false,"datum-z-gotovostjo"),
      fact("term.minimumMonths","Koliko traja minimalna vezava?","number",false,"stevilcna-lestvica"),
      fact("term.renewal","Kako se pogodba podaljšuje?","enum",true,"pravilo-ponavljanja",{allowedValues:["brez","ročno","samodejno","neznano"]})
    ],{dependsOn:["svc:c:provider"],unlocks:["svc:c:exit"],promptSummary:"začetek, konec, vezava, samodejna obnova"}),
    block("svc:c:exit","c5","Odpoved in varen izstop","Določi rok, način, stroške ter kaj se vrne ali prenese.",[
      fact("exit.notice","Kakšen je odpovedni rok?","duration-or-unknown",true,"relativni-rok"),
      fact("exit.method","Kako mora biti odpoved podana?","enum",true,"navpicni-izbor"),
      fact("exit.penalty","Ali so ob izstopu penali ali preostali obroki?","money-or-none",false,"natancen-znesek"),
      fact("exit.handover","Kaj mora ponudnik ob izstopu predati, izvoziti ali izbrisati?","string[]",false,"kontrolni-seznam-dokazil")
    ],{dependsOn:["svc:c:term"],upsellRules:[upsell("upsell:exit:negotiate",[condition("exit.penalty","greater-than",0)],"pogajanje","Pred odpovedjo je smiselno zahtevati nižji strošek izstopa ali boljše pogoje.")],promptSummary:"odpovedni rok, način, penali, predaja"}),
    block("svc:c:performance","c6","Uspešnost in dokazila","Določi metrike, izhodišče, cilj in način poročanja.",[
      fact("performance.metric","Kaj mora ponudnik meriti?","string[]",true,"izbirnik-oznak"),
      fact("performance.baseline","Kakšno je izhodiščno stanje?","number-or-text",false,"trenutno-proti-cilju"),
      fact("performance.target","Kakšen je sprejemljiv cilj?","number-or-text",true,"ciljni-pas"),
      fact("performance.reporting","Kako pogosto in s katerimi dokazi poroča?","object",false,"termin-in-pogostost")
    ],{dependsOn:["svc:c:scope"],upsellRules:[upsell("upsell:performance:negotiate",[condition("performance.target","missing",true)],"pogajanje","Merljiv cilj je treba zapisati pred potrditvijo ali nadaljevanjem.")],promptSummary:"metrike, izhodišče, cilj, poročanje"}),
    block("svc:c:access","c7","Dostopi, podatki in lastništvo","Zaščiti skrbniške dostope, podatke, datoteke in pravice uporabe.",[
      fact("access.owner","Kdo bo lastnik računov, podatkov in rezultatov?","enum",true,"mreza-izbir"),
      fact("access.admin","Katere skrbniške dostope morate obdržati?","string[]",false,"kontrolni-seznam-dokazil"),
      fact("access.export","Ali je možen popoln izvoz in prenos?","enum",false,"da-ne-ne-vem"),
      fact("access.deletion","Kako se podatki izbrišejo po koncu?","text",false,"besedilni-vnos")
    ],{dependsOn:["svc:c:scope"],promptSummary:"lastništvo, admin dostopi, izvoz, izbris"}),
    block("svc:c:delivery","c8","Izvedba in roki","Določi začetek, mejnike, odgovornosti in spremembe obsega.",[
      fact("delivery.start","Kdaj se izvedba začne?","date-or-unknown",true,"datum-z-gotovostjo"),
      fact("delivery.milestones","Kateri mejniki in roki veljajo?","object[]",true,"casovnica-mejnikov"),
      fact("delivery.dependencies","Kaj morate pred začetkom zagotoviti vi?","string[]",false,"mreza-odvisnosti"),
      fact("delivery.changeControl","Kako se potrdi sprememba cene, obsega ali roka?","object",false,"sprememba-in-potrditev")
    ],{dependsOn:["svc:c:scope"],promptSummary:"začetek, mejniki, odvisnosti, spremembe"}),
    block("svc:c:support","c9","Podpora, servis in jamstva","Določi odziv, odpravo, garancijo in rezervni korak.",[
      fact("support.channel","Kje in kdaj je podpora dosegljiva?","string[]",false,"izbirnik-oznak"),
      fact("support.response","V kolikšnem času mora ponudnik odgovoriti?","duration",true,"relativni-rok"),
      fact("support.resolution","V kolikšnem času mora težavo odpraviti?","duration",false,"relativni-rok"),
      fact("support.warranty","Kaj krije garancija in koliko časa?","object",false,"pogojna-garancija")
    ],{dependsOn:["svc:c:scope"],promptSummary:"kanal, odziv, odprava, garancija"}),
    block("svc:c:evidence","ca","Dokumenti in tveganja","Poveži vsako obljubo z dokazilom in označi manjkajoče pogoje.",[
      fact("evidence.available","Katere dokumente že imate?","string[]",true,"kontrolni-seznam-dokazil"),
      fact("evidence.promises","Katere obljube še niso zapisane?","string[]",false,"ujemanje-pogojev-dokazil"),
      fact("evidence.risks","Katera tveganja so najpomembnejša?","object[]",false,"matrika-tveganja")
    ],{dependsOn:["svc:c:provider"],promptSummary:"dokumenti, nezapisane obljube, tveganja"}),
    block("svc:c:negotiate","cb","Primerjava in pogajalska meja","Določi cilj, minimum, alternativo in posledico zavrnitve.",[
      fact("negotiate.goal","Kaj želite izboljšati?","string[]",true,"pogajalski-prostor"),
      fact("negotiate.minimum","Kateri minimum je še sprejemljiv?","string[]",true,"seznam-postavk"),
      fact("negotiate.alternative","Kakšno alternativo imate?","enum",false,"primerjava-moznosti"),
      fact("negotiate.ifRejected","Kaj naredite, če ponudnik zavrne?","enum",true,"odlocitvena-pot")
    ],{dependsOn:["svc:c:price","svc:c:evidence"],promptSummary:"cilj, minimum, alternativa, posledica zavrnitve"}),
    block("svc:c:action","cc","Končni ukrep","Iz zbranih dejstev pripravi preverbo, pogajanje, primerjavo ali varen izstop.",[
      fact("action.requested","Kateri rezultat naj Atena pripravi?","enum",true,"odlocitvena-pot"),
      fact("action.reviewConfirmed","Ali so odgovori pravilni in popolni?","boolean",true,"pregled-odgovorov")
    ],{dependsOn:["svc:c:evidence"],promptSummary:"zahtevani izhod, pregled in potrditev"})
  ]);

  var FAMILY_DEFINITIONS = freeze({
    material:{code:"fm",label:"Material",summary:"specifikacija, razred, količina, dobava, vračilo",facts:[
      ["spec","Zahtevana specifikacija, razred ali standard","text",true,"besedilni-vnos"],
      ["quantity","Količina in obračunska enota","quantity",true,"kolicina-in-enota"],
      ["delivery","Dobava, razklad in prevzem","object",true,"termin-in-pogostost"],
      ["returns","Kalo, presežek, vračilo in reklamacije","string[]",false,"matrika-vkljucenosti"]]},
    orodje:{code:"fo",label:"Orodje in stroji",summary:"zmogljivost, združljivost, oprema, servis, garancija",facts:[
      ["performance","Zahtevana zmogljivost in obremenitev","text",true,"besedilni-vnos"],
      ["compatibility","Združljivost z obstoječo opremo","string[]",true,"kontrolni-seznam-dokazil"],
      ["included","Pribor, zagon in usposabljanje","string[]",false,"matrika-vkljucenosti"],
      ["service","Servis, deli in nadomestna oprema","object",true,"pogojna-garancija"]]},
    najem:{code:"fn",label:"Najem opreme",summary:"predmet, termin, dostava, škoda, vračilo, podaljšanje",facts:[
      ["asset","Točen predmet in oprema najema","text",true,"besedilni-vnos"],
      ["period","Termin in obračunsko obdobje","object",true,"termin-in-pogostost"],
      ["handover","Dostava, prevzem in vračilo","object",true,"odlocitvena-pot"],
      ["damage","Škoda, zavarovanje, čiščenje in zamuda","string[]",true,"matrika-tveganja"]]},
    zascita:{code:"fz",label:"Zaščitna oprema",summary:"standard, velikosti, količine, prileganje, rok uporabe",facts:[
      ["standard","Zahtevani standard in stopnja zaščite","text",true,"besedilni-vnos"],
      ["sizes","Količine, velikosti in uporabniki","string[]",true,"seznam-postavk"],
      ["proof","Certifikat in izjava o skladnosti","string[]",true,"kontrolni-seznam-dokazil"],
      ["replacement","Rok uporabe, menjava in reklamacija","object",false,"pravilo-ponavljanja"]]},
    vozila:{code:"fv",label:"Vozila",summary:"konfiguracija, uporaba, kilometri, financiranje, servis, vračilo",facts:[
      ["configuration","Vrsta vozila, nosilnost in oprema","string[]",true,"hierarhicni-izbor"],
      ["usage","Predvidena uporaba in kilometri","quantity",true,"kolicina-in-enota"],
      ["ownershipCost","Mesečni in skupni strošek","money",true,"cenovni-most"],
      ["return","Stanje, kilometri in stroški ob vračilu","string[]",false,"matrika-vkljucenosti"]]},
    flota:{code:"ff",label:"Flota",summary:"vozila, uporabniki, kartice, poraba, poročila, izvoz",facts:[
      ["fleetSize","Število vozil in uporabnikov","quantity",true,"kolicina-in-enota"],
      ["coverage","Kartice, naprave, države in omrežje","string[]",true,"izbirnik-oznak"],
      ["controls","Limiti, opozorila in pravila uporabe","string[]",false,"gradnik-pravila-eskalacije"],
      ["reporting","Poročila, integracije in izvoz podatkov","string[]",true,"kontrolni-seznam-dokazil"]]},
    energija:{code:"fe",label:"Energija",summary:"poraba, lokacija, moč, tarifa, prihranek, vzdrževanje",facts:[
      ["baseline","Pretekla poraba in računi","object",true,"trenutno-proti-cilju"],
      ["site","Lokacija, priključna moč in omejitve","object",true,"lokacija-in-doseg"],
      ["tariff","Tarifa, indeksacija in omrežnina","string[]",false,"cenovni-most"],
      ["savings","Izračun prihranka, predpostavke in garancija","object",true,"ocena-z-negotovostjo"]]},
    telekom:{code:"ft",label:"Telekom",summary:"uporabniki, lokacije, prenos, naprave, vezava, podpora",facts:[
      ["lines","Število številk, uporabnikov ali lokacij","quantity",true,"kolicina-in-enota"],
      ["usage","Podatki, klici, roaming ali hitrost","string[]",true,"izbirnik-oznak"],
      ["migration","Prenos številk, oprema in neprekinjen prehod","string[]",false,"casovnica-mejnikov"],
      ["coverage","Pokritost, hitrost in odziv podpore","string[]",true,"kontrolni-seznam-dokazil"]]},
    it:{code:"fi",label:"IT",summary:"uporabniki, naprave, funkcije, migracija, varnost, podatki, podpora",facts:[
      ["users","Uporabniki, vloge, naprave in lokacije","string[]",true,"seznam-postavk"],
      ["requirements","Funkcije in integracije","string[]",true,"hierarhicni-izbor"],
      ["migration","Migracija, izpad in odgovornosti","object",false,"casovnica-mejnikov"],
      ["security","Varnost, backup, dostopi in izvoz","string[]",true,"kontrolni-seznam-dokazil"]]},
    marketing:{code:"fk",label:"Marketing",summary:"cilj, občinstvo, kanal, proračun, metrike, dostopi",facts:[
      ["objective","Poslovni cilj in želena dejanja strank","string[]",true,"izbirnik-oznak"],
      ["audience","Ciljna skupina, območje in ponudba","text",true,"besedilni-vnos"],
      ["budget","Izvedbeni in oglaševalski proračun","object",true,"razdelitev-proracuna"],
      ["measurement","Povpraševanja, strošek, prodaja in poročanje","string[]",true,"izbirnik-oznak"]]},
    oblikovanje:{code:"fd",label:"Oblikovanje",summary:"brief, formati, popravki, datoteke, pravice, produkcija",facts:[
      ["brief","Namen, občinstvo, slog in primeri","text",true,"besedilni-vnos"],
      ["formats","Končni in izvorni formati","string[]",true,"matrika-vkljucenosti"],
      ["revisions","Število predlogov in krogov popravkov","quantity",true,"kolicina-in-enota"],
      ["rights","Avtorske pravice, licence in področje uporabe","string[]",true,"kontrolni-seznam-dokazil"]]},
    posredniki:{code:"fp",label:"Posredniki",summary:"veljaven kontakt, območje, provizija, ekskluzivnost, reklamacije",facts:[
      ["validLead","Kaj šteje kot veljaven kontakt ali posel","text",true,"besedilni-vnos"],
      ["territory","Panoga, območje in izključitve","object",true,"lokacija-in-doseg"],
      ["commission","Kdaj nastane provizija in kako se obračuna","object",true,"znesek-ali-odstotek"],
      ["quality","Dvojniki, reklamacije in nadomestila","string[]",true,"skupine-odstopanj"]]},
    finance:{code:"fc",label:"Finance",summary:"znesek, rok, vse provizije, jamstva, izplačilo, predčasni izstop",facts:[
      ["amount","Potreben ali obdelan znesek","money",true,"natancen-znesek"],
      ["totalCost","Skupni strošek, obresti in provizije","object",true,"graficni-cenovni-most"],
      ["security","Zavarovanja, jamstva in regres","string[]",false,"matrika-tveganja"],
      ["settlement","Izplačilo, poravnava in predčasni izstop","object",true,"odlocitvena-pot"]]},
    zavarovanje:{code:"fs",label:"Zavarovanje",summary:"predmet, kritja, limiti, franšiza, izključitve, škoda",facts:[
      ["subject","Predmet, vrednost in izpostavljenost","text",true,"besedilni-vnos"],
      ["coverage","Kritja, limiti in podlimiti","string[]",true,"matrika-vkljucenosti"],
      ["deductible","Franšiza in soudeležba","money-or-percent",true,"znesek-ali-odstotek"],
      ["claims","Izključitve in postopek prijave škode","string[]",true,"kontrolni-seznam-dokazil"]]},
    poslovne:{code:"fb",label:"Poslovne storitve",summary:"rezultat, odgovornosti, podatki, mejniki, obračun, zaupnost",facts:[
      ["result","Končni rezultat ali odločitev","text",true,"besedilni-vnos"],
      ["responsibilities","Odgovornosti naročnika in izvajalca","string[]",true,"matrika-vkljucenosti"],
      ["inputs","Potrebni podatki, pooblastila in dostopi","string[]",false,"kontrolni-seznam-dokazil"],
      ["acceptance","Mejniki, predaja in potrditev","object",true,"casovnica-mejnikov"]]},
    skladnost:{code:"fl",label:"Skladnost",summary:"pravna podlaga, obseg, roki, pooblastilo, meritev, dokazilo",facts:[
      ["basis","Zakonska ali standardna podlaga","text",true,"besedilni-vnos"],
      ["scope","Lokacije, oprema, zaposleni ali meritve","string[]",true,"hierarhicni-izbor"],
      ["qualification","Pooblastilo, akreditacija in metoda","string[]",true,"kontrolni-seznam-dokazil"],
      ["validity","Rok izvedbe, veljavnost in naslednja ponovitev","object",true,"pravilo-ponavljanja"]]}
  });

  var PROFILE_REQUIREMENTS = freeze({
    1001:{summary:"razred materiala, količina, palete, dostava, razklad",facts:[["grade","Vrsta in trdnostni ali kakovostni razred","text",true,"besedilni-vnos"],["packaging","Pakiranje, palete in vračilo embalaže","string[]",false,"matrika-vkljucenosti"],["unloading","Dostop za dostavo, razklad in termin","object",true,"termin-in-pogostost"]],upsell:[1043]},
    1002:{summary:"tipi, preseki, standardi, združljivost, dobava",facts:[["components","Tipi, preseki, oznake in količine","string[]",true,"seznam-postavk"],["compliance","Standardi, certifikati in proizvajalec","string[]",true,"kontrolni-seznam-dokazil"],["substitutes","Dovoljeni nadomestni artikli","enum",false,"da-ne-ne-vem"]],upsell:[1005]},
    1003:{summary:"sistem, dimenzije, medij, tlak, kompletnost",facts:[["system","Sistem, material in proizvajalec","text",true,"besedilni-vnos"],["dimensions","Dimenzije, priključki, tlak in temperatura","string[]",true,"seznam-postavk"],["completeness","Fitingi, tesnila in pribor vključeni","string[]",true,"matrika-vkljucenosti"]],upsell:[1005]},
    1004:{summary:"podlaga, površina, poraba, barva, varnostni listi",facts:[["substrate","Podlaga in pogoji uporabe","text",true,"besedilni-vnos"],["coverage","Površina, sloji in predvidena poraba","quantity",true,"kolicina-in-enota"],["safety","Tehnični in varnostni listi","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1007]},
    1005:{summary:"naloga, moč, priključek, pribor, servis",facts:[["task","Za katero delo in obremenitev je oprema","text",true,"besedilni-vnos"],["power","Moč, napajanje in mere","string[]",true,"seznam-postavk"],["downtime","Servisni čas in nadomestna naprava","object",true,"pogojna-garancija"]],upsell:[1006]},
    1006:{summary:"stroj, lokacija, termin, upravljavec, prevoz, škoda",facts:[["operator","Ali je potreben upravljavec ali usposobljenost","enum",true,"da-ne-ne-vem"],["transport","Dostava, postavitev in odvoz","string[]",true,"matrika-vkljucenosti"],["siteLimits","Dostop, nosilnost tal in višinske omejitve","text",true,"besedilni-vnos"]],upsell:[1005]},
    1007:{summary:"nevarnost, standard, velikosti, količine, menjava",facts:[["hazard","Vrsta nevarnosti in delovno okolje","string[]",true,"izbirnik-oznak"],["fit","Velikosti, prileganje in poskusni vzorci","string[]",true,"seznam-postavk"],["replacementCycle","Pogostost menjave in zaloga","object",false,"pravilo-ponavljanja"]],upsell:[]},
    1008:{summary:"uporaba, tovor, konfiguracija, dobava, servis",facts:[["payload","Tovor, prostornina, vleka in posebna oprema","string[]",true,"hierarhicni-izbor"],["route","Letni kilometri in vrsta poti","quantity",true,"kolicina-in-enota"],["serviceNetwork","Servisna mreža in nadomestno vozilo","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1009,1011]},
    1009:{summary:"cena vozila, polog, doba, kilometri, preostanek, vračilo",facts:[["deposit","Polog ali začetno plačilo","money-or-percent",true,"znesek-ali-odstotek"],["mileage","Letni kilometri in doplačilo prek omejitve","quantity",true,"kolicina-in-enota"],["residual","Preostala vrednost, odkup in vračilo","string[]",true,"matrika-vkljucenosti"]],upsell:[1008,1032]},
    1010:{summary:"vozila, goriva, države, popusti, pristojbine, limiti",facts:[["fuels","Vrste goriva, polnjenje in cestnine","string[]",true,"izbirnik-oznak"],["network","Države, mreža in sprejemna mesta","object",true,"lokacija-in-doseg"],["fees","Popusti, pribitki, kartične in servisne pristojbine","object",true,"cenovni-most"]],upsell:[1011]},
    1011:{summary:"vozila, GPS, vozniki, opozorila, zasebnost, integracije",facts:[["tracking","Lokacija, vožnje, poraba in dogodki","string[]",true,"izbirnik-oznak"],["privacy","Zasebna uporaba, soglasja in hramba","string[]",true,"kontrolni-seznam-dokazil"],["integration","Izvoz v računovodstvo ali druge sisteme","string[]",false,"matrika-vkljucenosti"]],upsell:[1010]},
    1012:{summary:"merilno mesto, poraba, moč, tarifa, indeksacija, odpoved",facts:[["meter","Merilna mesta in odjemni profil","string[]",true,"seznam-postavk"],["consumption","Letna poraba in konice","quantity",true,"kolicina-in-enota"],["indexation","Fiksna ali indeksirana cena ter formula","enum",true,"dvojni-segment"]],upsell:[1013]},
    1013:{summary:"lokacija, poraba, streha, moč, proizvodnja, donos, servis",facts:[["siteSurvey","Streha, priklop, senčenje in dovoljenja","string[]",true,"kontrolni-seznam-dokazil"],["systemSize","Moč sistema, baterije ali polnilnic","quantity",true,"kolicina-in-enota"],["yield","Proizvodnja, samooskrba in vračilna doba","object",true,"ocena-z-negotovostjo"]],upsell:[1012]},
    1014:{summary:"številke, poraba, roaming, naprave, prenos, vezava",facts:[["devices","Naprave, obroki in lastništvo","string[]",false,"matrika-vkljucenosti"],["roaming","Države in pričakovana poraba v tujini","string[]",false,"izbirnik-oznak"],["porting","Prenos številk in dovoljen izpad","object",true,"casovnica-mejnikov"]],upsell:[1015]},
    1015:{summary:"lokacije, hitrost, tehnologija, SLA, oprema, preklop",facts:[["speed","Zahtevana hitrost gor/dol in stabilnost","string[]",true,"ciljni-pas"],["technology","Optika, kabel, xDSL, mobilna ali rezervna povezava","enum",false,"navpicni-izbor"],["outage","Dovoljen izpad, SLA in nadomestna povezava","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1014,1017]},
    1016:{summary:"naprave, omrežje, uporabniki, odziv, teren, nadomestna oprema",facts:[["inventory","Naprave, operacijski sistemi in omrežna oprema","string[]",true,"seznam-postavk"],["supportMode","Oddaljena in terenska podpora ter ure","string[]",true,"matrika-vkljucenosti"],["sla","Prioritete incidentov in odzivni časi","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1017]},
    1017:{summary:"podatki, grožnje, backup, RPO/RTO, incidenti, izvoz",facts:[["assets","Sistemi in podatki, ki jih je treba zaščititi","string[]",true,"hierarhicni-izbor"],["recovery","Pogostost kopij, RPO in RTO","string[]",true,"ciljni-pas"],["incident","Odkrivanje, obveščanje in odziv na incident","object",true,"gradnik-pravila-eskalacije"]],upsell:[1016]},
    1018:{summary:"uporabniki, podjetja, funkcije, migracija, davki, podpora",facts:[["modules","Računovodstvo, plače, blagajna in poročila","string[]",true,"hierarhicni-izbor"],["migration","Prenos šifrantov, dokumentov in otvoritev","string[]",true,"kontrolni-seznam-dokazil"],["compliance","Davčne posodobitve, revizijska sled in hramba","string[]",true,"matrika-vkljucenosti"]],upsell:[1033]},
    1019:{summary:"procesi, uporabniki, integracije, migracija, prilagoditve, licence",facts:[["processes","Prodaja, nabava, zaloga, projekti in servis","string[]",true,"hierarhicni-izbor"],["integrations","Povezave z računovodstvom, pošto in spletnimi sistemi","string[]",true,"seznam-postavk"],["customization","Standardne funkcije proti prilagoditvam","string[]",true,"matrika-vkljucenosti"]],upsell:[1017]},
    1020:{summary:"vrsta obrti, proces, projekti, CAD/BIM, teren, izvoz",facts:[["workflow","Ponudbe, nalogi, čas, material in obračun","string[]",true,"hierarhicni-izbor"],["fieldUse","Mobilno delo, offline način in fotografije","string[]",false,"matrika-vkljucenosti"],["formats","CAD/BIM formati in izvozi","string[]",false,"kontrolni-seznam-dokazil"]],upsell:[1019]},
    1021:{summary:"cilj strani, vsebine, funkcije, domena, gostovanje, analitika",facts:[["siteType","Predstavitvena stran, trgovina ali portal","enum",true,"mreza-izbir"],["content","Kdo pripravi besedila, fotografije in prevode","string[]",true,"matrika-vkljucenosti"],["ownership","Domena, hosting, koda, analitika in skrbniški dostopi","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1022,1024,1026]},
    1022:{summary:"cilj, publika, kanali, proračun, konverzije, dostopi, poročila",facts:[["channels","SEO, oglasi, družbena omrežja ali vsebine","string[]",true,"izbirnik-oznak"],["conversion","Kaj šteje kot povpraševanje ali prodaja","text",true,"besedilni-vnos"],["accounts","Lastništvo oglasnih računov, pikslov in analitike","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1021,1024]},
    1023:{summary:"ciljna lista, skripta, veljaven termin, količina, snemanje, GDPR",facts:[["audienceList","Vir, kakovost in dovoljenost kontaktne baze","string[]",true,"sled-izvora-podatka"],["qualifiedMeeting","Kaj šteje kot veljaven dogovorjen termin","text",true,"besedilni-vnos"],["scriptCompliance","Skripta, snemanje, ugovori in varstvo podatkov","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1027]},
    1024:{summary:"brief, identiteta, predlogi, popravki, formati, pravice",facts:[["identityScope","Logotip, barve, tipografija in priročnik","string[]",true,"hierarhicni-izbor"],["concepts","Število začetnih smeri in popravkov","quantity",true,"kolicina-in-enota"],["sourceFiles","Izvorne datoteke, pisave in licence","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1025,1021]},
    1025:{summary:"format, material, naklada, priprava, montaža, barvni dokaz",facts:[["productionSpec","Mere, material, naklada in dodelava","string[]",true,"seznam-postavk"],["artwork","Priprava datotek, barvni profil in poskusni odtis","string[]",true,"kontrolni-seznam-dokazil"],["installation","Dostava, montaža in odstranitev","string[]",false,"matrika-vkljucenosti"]],upsell:[1024]},
    1026:{summary:"namen, lokacija, snemalni dan, kadri, montaža, pravice",facts:[["shoot","Lokacija, termini, osebe in potrebni kadri","string[]",true,"casovnica-mejnikov"],["outputs","Dolžine, formati, podnapisi in različice","string[]",true,"matrika-vkljucenosti"],["rights","Glasba, modeli, lokacije in pravice uporabe","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1022]},
    1027:{summary:"vir, definicija kontakta, območje, ekskluzivnost, cena, reklamacija",facts:[["leadSource","Od kod pridejo kontakti in kako so preverjeni","string[]",true,"sled-izvora-podatka"],["duplicateWindow","Obdobje in pravilo za dvojnike","duration",true,"relativni-rok"],["replacement","Rok za reklamacijo in nadomestni kontakt","object",true,"gradnik-pravila-eskalacije"]],upsell:[1023]},
    1028:{summary:"mandat, dobavitelji, provizija, konflikt interesov, dokaz prihranka",facts:[["mandate","Kaj sme posrednik iskati, pogajati ali podpisati","string[]",true,"matrika-vkljucenosti"],["independence","Kdo posrednika plača in možni konflikti","string[]",true,"kontrolni-seznam-dokazil"],["successFee","Osnova provizije in dokaz doseženega prihranka","object",true,"znesek-ali-odstotek"]],upsell:[]},
    1029:{summary:"znesek, namen, rok, obresti, EOM, jamstva, predčasno poplačilo",facts:[["purpose","Namen financiranja in čas potrebe","text",true,"besedilni-vnos"],["repayment","Doba, obroki in skupno vračilo","object",true,"obrocni-nacrt"],["guarantees","Osebna poroštva, zastave in druge zaveze","string[]",true,"matrika-tveganja"]],upsell:[1031]},
    1030:{summary:"promet, kanali, kartice, provizije, izplačilo, chargeback",facts:[["volume","Mesečni promet, število in povprečna transakcija","object",true,"kolicina-in-enota"],["channels","Fizični POS, splet, povezava ali mobilno","string[]",true,"izbirnik-oznak"],["fees","Odstotna in fiksna provizija, najem ter dodatki","object",true,"graficni-cenovni-most"],["settlement","Rok izplačila, rezervacije in chargeback","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1021]},
    1031:{summary:"terjatve, starost, regres, avans, provizija, postopek",facts:[["receivables","Znesek, zapadlost, dolžniki in dokazila","string[]",true,"seznam-postavk"],["recourse","Regresni ali neregresni model","enum",true,"dvojni-segment"],["advance","Delež takojšnjega izplačila in vse pristojbine","object",true,"znesek-ali-odstotek"]],upsell:[1029,1034]},
    1032:{summary:"predmet, vrednost, kritja, limiti, franšiza, izključitve, škoda",facts:[["policies","Obstoječe police, škode in datumi obnov","string[]",true,"kontrolni-seznam-dokazil"],["limits","Limiti na dogodek in letno","string[]",true,"seznam-postavk"],["brokerRole","Pooblastilo, provizija in pomoč pri škodi","string[]",false,"matrika-vkljucenosti"]],upsell:[1008,1009]},
    1033:{summary:"promet, zaposleni, dokumenti, roki, poročila, odgovornost",facts:[["volume","Število dokumentov, zaposlenih in posebnosti","string[]",true,"seznam-postavk"],["deadlines","DDV, plače, poročila in letni obračun","string[]",true,"pravilo-ponavljanja"],["responsibility","Kontrole, pooblastila, napake in zavarovanje odgovornosti","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1018]},
    1034:{summary:"pravno vprašanje, jurisdikcija, dokumenti, roki, obseg zastopanja",facts:[["matter","Pravno vprašanje in želeni rezultat","text",true,"besedilni-vnos"],["jurisdiction","Država, pravo, sodišče in jezik","string[]",true,"izbirnik-oznak"],["representation","Pregled, priprava, pogajanje ali zastopanje","string[]",true,"hierarhicni-izbor"]],upsell:[]},
    1035:{summary:"vloga, profil, število, trajanje, plačilo, zamenjava, odgovornost",facts:[["roles","Delovna mesta, znanja in število oseb","string[]",true,"seznam-postavk"],["employmentModel","Zaposlitev, napotitev ali posredovanje","enum",true,"mreza-izbir"],["replacement","Garancija zamenjave in odgovornost delodajalca","string[]",true,"pogojna-garancija"]],upsell:[1036]},
    1036:{summary:"cilj, udeleženci, predznanje, izvedba, preverjanje, dokazilo",facts:[["learningOutcome","Kaj morajo udeleženci po izvedbi znati ali narediti","text",true,"besedilni-vnos"],["participants","Število, vloge in predznanje udeležencev","string[]",true,"seznam-postavk"],["assessment","Preverjanje znanja in veljavnost potrdila","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[]},
    1037:{summary:"dejavnosti, tveganja, zaposleni, pregledi, usposabljanja, roki",facts:[["workplaces","Lokacije, delovna mesta in posebna tveganja","string[]",true,"hierarhicni-izbor"],["employees","Število zaposlenih in zdravstvene zahteve","string[]",true,"seznam-postavk"],["deliverables","Ocene tveganja, usposabljanja, pregledi in evidence","string[]",true,"matrika-vkljucenosti"]],upsell:[1038]},
    1038:{summary:"objekti, oprema, evidence, intervali, pooblastilo, odprava napak",facts:[["assets","Objekti, sistemi in oprema za pregled","string[]",true,"seznam-postavk"],["intervals","Zakonski intervali in zapadli pregledi","object",true,"pravilo-ponavljanja"],["remediation","Rok in odgovornost za odpravo pomanjkljivosti","object",true,"gradnik-pravila-eskalacije"]],upsell:[1037]},
    1039:{summary:"vrste odpadkov, količine, lokacije, odvoz, evidence, poročila",facts:[["wasteTypes","Vrste, klasifikacijske številke in nevarnost","string[]",true,"hierarhicni-izbor"],["quantities","Količine, posode in pogostost odvoza","object",true,"kolicina-in-enota"],["documentation","Evidenčni listi, poročila in sled prevzema","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[]},
    1040:{summary:"standard, izdelek ali proces, metoda, vzorčenje, rok, veljavnost",facts:[["standard","Standard, predpis ali zahtevana oznaka","text",true,"besedilni-vnos"],["sampleScope","Izdelki, lokacije, meritve in vzorčenje","string[]",true,"hierarhicni-izbor"],["certificate","Vrsta dokazila, veljavnost in nadzorni pregledi","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[]},
    1041:{summary:"blago, relacije, količine, termini, skladišče, škoda, sledenje",facts:[["shipments","Vrsta blaga, količine, teža in mere","string[]",true,"seznam-postavk"],["routes","Prevzemna in dostavna območja ter roki","object",true,"lokacija-in-doseg"],["storage","Skladiščenje, posebni pogoji in zalogovna evidenca","string[]",false,"matrika-vkljucenosti"],["claims","Sledenje, poškodbe, izguba in odgovornost","string[]",true,"kontrolni-seznam-dokazil"]],upsell:[1032]},
    1042:{summary:"lokacije, površine, naloge, pogostost, standard, ključi, odziv",facts:[["sites","Lokacije, površine in dostopna območja","string[]",true,"lokacija-in-doseg"],["tasks","Čiščenje, varovanje ali vzdrževanje po conah","string[]",true,"hierarhicni-izbor"],["schedule","Pogostost, termini in nadomeščanje osebja","object",true,"pravilo-ponavljanja"],["quality","Kontrola kakovosti, incidenti in odziv","string[]",true,"gradnik-pravila-eskalacije"]],upsell:[1032]},
    1043:{summary:"artikli, poraba, zaloga, dobava, nadomestki, embalaža",facts:[["items","Artikli, mere, kakovost in pakiranje","string[]",true,"seznam-postavk"],["consumption","Običajna poraba in minimalna zaloga","object",true,"kolicina-in-enota"],["replenishment","Pogostost dobave in avtomatsko naročanje","object",false,"pravilo-ponavljanja"],["substitution","Dovoljeni nadomestki in vračilo","string[]",true,"matrika-vkljucenosti"]],upsell:[]}
  });

  function familyBlock(familyCode) {
    var definition = FAMILY_DEFINITIONS[familyCode];
    if (!definition) return null;
    return block("svc:f:" + familyCode, definition.code, definition.label, "Zberi družinsko specifična dejstva: " + definition.summary + ".", definition.facts.map(function (row) {
      return fact("family." + familyCode + "." + row[0], row[1], row[2], row[3], row[4]);
    }), { dependsOn:["svc:c:scope"], promptSummary:definition.summary });
  }
  function profileBlock(profile) {
    var definition = PROFILE_REQUIREMENTS[profile.profileId];
    if (!definition) return null;
    return block("svc:p:" + profile.profileId, "p" + (profile.profileId - 1000).toString(36), profile.label, "Zberi specifična dejstva za »" + profile.label + "«: " + definition.summary + ".", definition.facts.map(function (row) {
      return fact("profile." + profile.code + "." + row[0], row[1], row[2], row[3], row[4]);
    }), {
      dependsOn:["svc:f:" + profile.familyCode], promptSummary:definition.summary,
      upsellRules:(definition.upsell || []).map(function (targetId) {
        return upsell("upsell:profile:" + profile.profileId + ":" + targetId, [condition("action.reviewConfirmed","equals",true)], "ponudbe", "Povezana storitev je smiselna šele po potrjeni osnovni potrebi.", [targetId]);
      })
    });
  }

  var FAMILY_BLOCKS = freeze(Object.keys(FAMILY_DEFINITIONS).map(familyBlock));
  var PROFILE_BLOCKS = freeze(((capabilities && capabilities.profiles) || []).map(profileBlock).filter(Boolean));
  var BLOCKS = freeze(COMMON_BLOCKS.concat(FAMILY_BLOCKS, PROFILE_BLOCKS));
  var BLOCK_BY_ID = freeze(BLOCKS.reduce(function (out, item) { out[item.id] = item; return out; }, {}));
  var BLOCK_BY_CODE = freeze(BLOCKS.reduce(function (out, item) { out[item.promptCode] = item; return out; }, {}));
  var ACTION_BLUEPRINTS = freeze({
    ponudba:["svc:c:situation","svc:c:provider","svc:c:scope","svc:c:price","svc:c:delivery","svc:c:evidence","svc:c:action"],
    narocnina:["svc:c:situation","svc:c:provider","svc:c:scope","svc:c:price","svc:c:term","svc:c:exit","svc:c:evidence","svc:c:action"],
    pogajanje:["svc:c:situation","svc:c:provider","svc:c:scope","svc:c:price","svc:c:performance","svc:c:term","svc:c:exit","svc:c:evidence","svc:c:negotiate","svc:c:action"],
    ponudbe:["svc:c:situation","svc:c:scope","svc:c:price","svc:c:delivery","svc:c:performance","svc:c:evidence","svc:c:negotiate","svc:c:action"],
    klic:["svc:c:situation","svc:c:provider","svc:c:scope","svc:c:price","svc:c:term","svc:c:evidence","svc:c:action"]
  });
  var PROFILE_BLUEPRINTS = freeze(((capabilities && capabilities.profiles) || []).reduce(function (out, profile) {
    out[profile.profileId] = freeze({ profileId:profile.profileId, profileCode:profile.code, familyCode:profile.familyCode, blockIds:freeze(["svc:c:situation","svc:c:provider","svc:c:scope","svc:f:" + profile.familyCode,"svc:p:" + profile.profileId,"svc:c:evidence","svc:c:action"]) });
    return out;
  }, {}));

  function expandDependencies(ids) {
    var result=[], visiting=new Set(), visited=new Set();
    function visit(id) {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error("Krožna odvisnost bloka: " + id);
      var item=BLOCK_BY_ID[id];
      if (!item) throw new Error("Neznan blok: " + id);
      visiting.add(id); item.dependsOn.forEach(visit); visiting.delete(id); visited.add(id); result.push(id);
    }
    ids.forEach(visit);
    return freeze(result);
  }
  function resolve(profileId, actionCode, selectedBlockIds) {
    var profile=(capabilities && capabilities.byProfileId && capabilities.byProfileId(profileId)) || null;
    if (!profile) throw new Error("Neznan profil: " + profileId);
    if (!ACTION_BLUEPRINTS[actionCode]) throw new Error("Neznano dejanje: " + actionCode);
    var selected=(selectedBlockIds || []).map(function (idOrCode) {
      var selectedBlock=BLOCK_BY_ID[idOrCode] || BLOCK_BY_CODE[idOrCode];
      if (!selectedBlock) throw new Error("Neznan izbrani blok: " + idOrCode);
      return selectedBlock.id;
    });
    var ids=ACTION_BLUEPRINTS[actionCode].concat(["svc:f:" + profile.familyCode,"svc:p:" + profile.profileId],selected);
    var resolvedIds=expandDependencies(uniq(ids));
    return freeze({ version:VERSION, profileId:profile.profileId, actionCode:actionCode, blockIds:resolvedIds, blocks:freeze(resolvedIds.map(function (id) { return BLOCK_BY_ID[id]; })) });
  }
  function resolveSelection(profileId, actionCode, selectedBlockIds) {
    var profile=(capabilities && capabilities.byProfileId && capabilities.byProfileId(profileId)) || null;
    if (!profile) throw new Error("Neznan profil: " + profileId);
    if (!ACTION_BLUEPRINTS[actionCode]) throw new Error("Neznano dejanje: " + actionCode);
    if (!Array.isArray(selectedBlockIds) || !selectedBlockIds.length) throw new Error("Luna mora izbrati najmanj en block code.");
    var allowed=new Set(ACTION_BLUEPRINTS[actionCode].concat(["svc:f:" + profile.familyCode,"svc:p:" + profile.profileId]));
    var selected=selectedBlockIds.map(function (idOrCode) {
      var selectedBlock=BLOCK_BY_ID[idOrCode] || BLOCK_BY_CODE[idOrCode];
      if (!selectedBlock) throw new Error("Neznan izbrani blok: " + idOrCode);
      if (!allowed.has(selectedBlock.id)) throw new Error("Blok ni dovoljen za izbrani profil in dejanje: " + idOrCode);
      return selectedBlock.id;
    });
    var resolvedIds=expandDependencies(uniq(["svc:f:" + profile.familyCode,"svc:p:" + profile.profileId].concat(selected)));
    return freeze({ version:VERSION, profileId:profile.profileId, actionCode:actionCode, selectedBlockIds:freeze(selected), blockIds:resolvedIds, blocks:freeze(resolvedIds.map(function (id) { return BLOCK_BY_ID[id]; })) });
  }
  function missingFacts(plan, knownFacts) {
    knownFacts=knownFacts || {};
    return freeze(plan.blocks.reduce(function (out, item) {
      item.facts.forEach(function (entry) {
        if (entry.required && (knownFacts[entry.id] == null || knownFacts[entry.id] === "")) out.push(freeze({ blockId:item.id, factId:entry.id, widgetId:entry.widgetId, label:entry.label }));
      });
      return out;
    }, []));
  }
  function compactOperatingModel() {
    var actions={}; Object.keys(ACTION_BLUEPRINTS).forEach(function (code) { actions[code]=ACTION_BLUEPRINTS[code].map(function (id) { return BLOCK_BY_ID[id].promptCode; }); });
    return freeze({
      v:"sk1", rule:"Iz prvega sporočila vrni hipotezo, znana dejstva, 3–4 najpomembnejše manjkajoče blockCodes in največ 3 takojšnje konkretne predloge z razlogom. Ne izmišljaj. Lokalni resolver razširi odvisnosti; nov modelski klic je potreben le ob nejasnosti, prostem odgovoru ali novi fazi.",
      output:"{hypothesis:{profileId,actionCode,confidence},knownFacts:{},blockCodes:[],suggestions:[{type,reason,targetActionCode?,targetProfileId?}]}",
      actions:actions,
      families:Object.keys(FAMILY_DEFINITIONS).reduce(function (out, code) { out[code]=[FAMILY_DEFINITIONS[code].code,FAMILY_DEFINITIONS[code].summary]; return out; }, {}),
      profiles:((capabilities && capabilities.profiles) || []).map(function (profile) { return [profile.profileId,profile.code,profile.familyCode,"p" + (profile.profileId - 1000).toString(36)]; })
    });
  }
  function compactIndexJson() { return JSON.stringify(compactOperatingModel()); }
  function validate() {
    var errors=[], profiles=(capabilities && capabilities.profiles) || [], actions=(capabilities && capabilities.actions) || [];
    if (profiles.length !== 43) errors.push("Pričakovanih je natanko 43 profilov.");
    if (Object.keys(PROFILE_REQUIREMENTS).length !== 43) errors.push("PROFILE_REQUIREMENTS mora vsebovati natanko 43 profilov.");
    if (Object.keys(FAMILY_DEFINITIONS).length !== 16) errors.push("FAMILY_DEFINITIONS mora vsebovati natanko 16 družin.");
    if (Object.keys(PROFILE_BLUEPRINTS).length !== profiles.length) errors.push("Vsak profil potrebuje konkreten blueprint.");
    var ids=new Set(), codes=new Set(), interfaces=new Set(), factIds=new Set();
    BLOCKS.forEach(function (item) {
      if (ids.has(item.id)) errors.push("Podvojen block ID: " + item.id); ids.add(item.id);
      if (codes.has(item.promptCode)) errors.push("Podvojen prompt code: " + item.promptCode); codes.add(item.promptCode);
      if (interfaces.has(item.interfaceId)) errors.push("Podvojen interfaceId: " + item.interfaceId); interfaces.add(item.interfaceId);
      item.dependsOn.forEach(function (id) { if (!BLOCK_BY_ID[id]) errors.push("Manjkajoča odvisnost " + id + " v " + item.id); });
      item.completionGate.forEach(function (id) { if (!item.facts.some(function (entry) { return entry.id === id; })) errors.push("Neveljaven completion gate " + id + " v " + item.id); });
      item.facts.forEach(function (entry) {
        if (factIds.has(entry.id)) errors.push("Podvojen fact ID: " + entry.id); factIds.add(entry.id);
        if (interfaces.has(entry.interfaceId)) errors.push("Podvojen interfaceId: " + entry.interfaceId); interfaces.add(entry.interfaceId);
        if (!APPROVED_WIDGET_SET.has(entry.widgetId)) errors.push("Neodobren widget " + entry.widgetId + " pri " + entry.id);
      });
    });
    profiles.forEach(function (profile) {
      if (!PROFILE_REQUIREMENTS[profile.profileId]) errors.push("Manjkajoče potrebe profila " + profile.profileId);
      if (!BLOCK_BY_ID["svc:f:" + profile.familyCode]) errors.push("Manjkajoč družinski blok " + profile.familyCode);
      if (!BLOCK_BY_ID["svc:p:" + profile.profileId]) errors.push("Manjkajoč profilni blok " + profile.profileId);
    });
    actions.forEach(function (action) { if (!ACTION_BLUEPRINTS[action.code] || !ACTION_BLUEPRINTS[action.code].includes("svc:c:action")) errors.push("Dejanje brez zaključnega gatea: " + action.code); });
    var compact=compactIndexJson(), approxTokens=Math.ceil(compact.length/4);
    if (approxTokens >= 1000) errors.push("Compact index presega 1000 približnih tokenov: " + approxTokens);
    return freeze({ valid:!errors.length, errors:freeze(errors), metrics:freeze({ profiles:profiles.length, families:Object.keys(FAMILY_DEFINITIONS).length, blocks:BLOCKS.length, facts:factIds.size, compactCharacters:compact.length, approximateTokens:approxTokens }) });
  }

  return freeze({
    version:VERSION, contextVersion:CONTEXT_VERSION, commonBlocks:COMMON_BLOCKS, familyBlocks:FAMILY_BLOCKS, profileBlocks:PROFILE_BLOCKS,
    blocks:BLOCKS, blockById:BLOCK_BY_ID, blockByPromptCode:BLOCK_BY_CODE, actionBlueprints:ACTION_BLUEPRINTS, profileBlueprints:PROFILE_BLUEPRINTS,
    resolve:resolve, resolveSelection:resolveSelection, missingFacts:missingFacts, compactOperatingModel:compactOperatingModel, compactIndexJson:compactIndexJson, validate:validate
  });
});
