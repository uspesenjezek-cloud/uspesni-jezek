(function (root, factory) {
  var api;
  if (typeof module === "object" && module.exports) api = factory(require("./ponudba-moduli-engine"), require("./svetovalec-storitve-engine"));
  else api = factory(root && root.UJPonudbaModuliEngine, root && root.UJSvetovalecStoritveEngine);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJSvetovalecCapabilityCatalog = api;
})(typeof window !== "undefined" ? window : null, function (ponudba, storitve) {
  "use strict";
  var VERSION = "svetovalec-capability-catalog-v3";
  function freeze(value) { return Object.freeze(value); }
  function normalized(value) { return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  var ACTIONS = freeze([
    { id:"action:ponudba", code:"ponudba", label:"Preverite ponudbo", intent:"Razumeti ponudbo, primerjati obljube z zapisanim in odkriti stroške, vrzeli ter tveganja.", verbs:["preveri ponudbo","predracun","pogodbo","ali je v redu","marketing pogodbo"] },
    { id:"action:narocnina", code:"narocnina", label:"Preverite sklenjene pogodbe", intent:"Preveriti uporabo, ponavljajoče stroške, vezavo, podaljšanje in varen izstop.", verbs:["narocnina","vezava","podaljsanje","mesecno","odpoved paketa"] },
    { id:"action:pogajanje", code:"pogajanje", label:"Pogajajte se ali odpovejte", intent:"Določiti cilj, meje, dokazila, alternativo in varen način pogajanja ali odpovedi.", verbs:["pogajaj","pogajanje","izpogajaj","boljsa cena","nizja cena","popust","znizaj","odpovej","izstop","boljsi pogoji"] },
    { id:"action:ponudbe", code:"ponudbe", label:"Poiščite mi ponudbe", intent:"Pripraviti primerljiv obseg in merila, po katerih se zberejo ustrezne ponudbe izvajalcev.", verbs:["najdi izvajalca","zberi ponudbe","povprasevanje","primerjaj izvajalce"] },
    { id:"action:klic", code:"klic", label:"Vas kliče prodajalec?", intent:"Pripraviti kratka vprašanja, meje in dokazila za varen prodajni pogovor.", verbs:["klice prodajalec","prodajni klic","poklical","po telefonu"] }
  ].map(freeze));
  var FAMILY_PACKS = freeze({
    material:{ scope:"vrsto, kakovost, količino, dobavo in nadomestljivost materiala", deliverables:["točna specifikacija","količina in enota","dobava ali prevzem","dokazila o kakovosti"], risks:["neprimerljiva kakovost","manjkajoča dostava","kalo in vračila","sprememba cen"], evidence:["predračun","tehnični list","dobavnica","pogoji vračila"] },
    orodje:{ scope:"zmogljivost, združljivost, opremo, zagon in servis", deliverables:["model in oprema","zahtevana zmogljivost","zagon ali usposabljanje","servis"], risks:["napačna zmogljivost","dodatna oprema","izpad in servis","garancijske izjeme"], evidence:["specifikacija","garancija","servisni pogoji"] },
    najem:{ scope:"predmet najema, obračunsko obdobje, dostavo, škodo in vračilo", deliverables:["točen predmet","termin","dostava in prevzem","zavarovanje"], risks:["zamudnina","škoda","čiščenje","podaljšanje najema"], evidence:["najemna pogodba","prevzemni zapisnik","cenik škode"] },
    zascita:{ scope:"standard, velikosti, primernost za delo in zamenjavo", deliverables:["zahtevani standard","količine in velikosti","dobava","menjava"], risks:["neustrezen standard","slabo prileganje","rok uporabe"], evidence:["certifikat","izjava o skladnosti","tehnični list"] },
    vozila:{ scope:"vozilo, stanje, opremo, financiranje, servis in skupne stroške", deliverables:["točna konfiguracija","dobavni rok","servisni paket","strošek lastništva"], risks:["omejitve kilometrov","preostala vrednost","drage vrnitve","izključena oprema"], evidence:["ponudba vozila","leasing izračun","servisni pogoji"] },
    flota:{ scope:"vozila, kartice ali naprave, uporabnike, porabo in poročanje", deliverables:["obseg flote","pravila uporabe","poročila","integracije"], risks:["skriti pribitki","zloraba kartic","vezava","lastništvo podatkov"], evidence:["cenik","vzorec poročila","pogoji uporabe"] },
    energija:{ scope:"porabo, moč, lokacijo, ceno, prihranke in vzdrževanje", deliverables:["izhodiščna poraba","projektna rešitev","izračun prihranka","servis"], risks:["nerealna donosnost","spremenljiva cena","neustrezna moč","nejasne subvencije"], evidence:["računi porabe","projekt","izračun","garancije"] },
    telekom:{ scope:"uporabnike, lokacije, hitrosti, naprave, prenos in podporo", deliverables:["paket in količine","pokritost ali hitrost","prenos številk","odziv podpore"], risks:["vezava","indeksacija","stroški naprav","izpad"], evidence:["cenik","povzetek pogodbe","SLA"] },
    it:{ scope:"uporabnike, naprave, funkcije, integracije, podatke, varnost in podporo", deliverables:["zahteve in uporabniki","migracija","dostopi in lastništvo","podpora"], risks:["vendor lock-in","izguba podatkov","nezdružljivost","neomejen obseg"], evidence:["licenčni pogoji","SLA","načrt migracije","varnostna dokazila"] },
    marketing:{ scope:"ciljno skupino, kanal, sporočilo, proračun, merjenje in lastništvo računov", deliverables:["cilj in ciljna skupina","kanali in vsebine","merila uspeha","poročanje"], risks:["nejasni rezultati","agencijski dostopi","oglaševalski proračun ni vključen","dolga vezava"], evidence:["medijski načrt","primer poročila","seznam dostopov","reference"] },
    oblikovanje:{ scope:"namen, vizualni obseg, formate, popravke, avtorske pravice in uporabo", deliverables:["brief in slog","končne datoteke","število predlogov in popravkov","pravice uporabe"], risks:["brez izvornih datotek","omejene pravice","neomejeni popravki niso dogovorjeni","tisk ni vključen"], evidence:["brief","seznam formatov","licenca ali prenos pravic","časovnica"] },
    posredniki:{ scope:"vir kontaktov, ekskluzivnost, provizijo, kakovost in odgovornost", deliverables:["definicija veljavnega kontakta","območje in panoga","način predaje","reklamacije"], risks:["nekakovostni kontakti","podvojeni kontakti","dolga ekskluzivnost","nejasna provizija"], evidence:["cenik","pravila veljavnosti","vzorec kontakta","pogoji reklamacije"] },
    finance:{ scope:"znesek, rok, efektivni strošek, zavarovanja, izplačilo in izstop", deliverables:["potreben znesek","skupni strošek","čas izplačila","zavarovanja"], risks:["dodatne provizije","osebno jamstvo","spremenljiva obrestna mera","predčasno poplačilo"], evidence:["informativni izračun","cenik","pogodbeni pogoji"] },
    zavarovanje:{ scope:"predmet, kritja, limite, franšizo, izključitve in prijavo škode", deliverables:["zahtevana kritja","limiti","franšiza","postopek škode"], risks:["ključne izključitve","prenizki limiti","podzavarovanje","avtomatsko podaljšanje"], evidence:["ponudba","splošni pogoji","pregled kritij"] },
    poslovne:{ scope:"pričakovani rezultat, odgovornosti, dostop do podatkov, roke in način obračuna", deliverables:["jasen rezultat","obseg odgovornosti","mejniki","predaja dokumentacije"], risks:["nejasen obseg","urna poraba brez meje","zaupnost","odvisnost od ene osebe"], evidence:["opis storitve","ponudba","pooblastila","reference"] },
    skladnost:{ scope:"zakonsko podlago, lokacije, opremo, roke, meritve in veljavnost dokazila", deliverables:["potreben pregled","obseg lokacij ali opreme","rok veljavnosti","končno dokazilo"], risks:["manjkajoča akreditacija","nepopoln obseg","zamujen rok","dodatni ukrepi"], evidence:["pooblastilo izvajalca","vzorec zapisnika","certifikat","zakonska podlaga"] }
  });
  var fallbackPack = freeze({ scope:"točen obseg, rezultat, stroške, roke in odgovornost", deliverables:["jasen obseg","pričakovani rezultat","rok","dokazilo"], risks:["nejasna cena","manjkajoč obseg","nejasna odgovornost"], evidence:["ponudba","pogodba","pisna potrditev"] });
  function buildProfiles() {
    var families = ponudba && ponudba.families || [];
    var familyById = new Map(families.map(function (item) { return [item.id, item]; }));
    return freeze((ponudba && ponudba.profiles || []).map(function (profile) {
      var family = familyById.get(profile.familyId) || { code:"drugo", label:"Drugo" };
      var pack = FAMILY_PACKS[family.code] || fallbackPack;
      return freeze({
        id:"capability:" + profile.id, profileId:profile.id, familyId:profile.familyId, familyCode:family.code,
        code:profile.code, label:profile.label, aliases:profile.aliases, status:"catalog-confirmed+draft-enrichment",
        description:"Pri »" + profile.label + "« preverimo " + pack.scope + ".",
        scopeIncluded:pack.scope, deliverableFamilies:freeze(pack.deliverables.slice()), riskFamilies:freeze(pack.risks.slice()),
        evidenceNeeded:freeze(pack.evidence.slice()), improvementFamilies:freeze(["jasnejši obseg","merljiv rezultat","primerljiva cena","varnejši izstop"]),
        adjacentServiceCodes:freeze(["ponudba","pogajanje","ponudbe"])
      });
    }));
  }
  var PROFILES = buildProfiles();
  function wordMatch(sourceWord, expectedWord) {
    if (sourceWord === expectedWord) return true;
    if (sourceWord.length < 5 || expectedWord.length < 5) return false;
    var limit=Math.min(sourceWord.length,expectedWord.length),same=0;
    while(same<limit&&sourceWord.charAt(same)===expectedWord.charAt(same)) same+=1;
    return same>=5&&same/Math.min(sourceWord.length,expectedWord.length)>=0.68;
  }
  function phraseMatch(sourceWords, expectedWords) {
    return expectedWords.length>0&&expectedWords.every(function(expected){return sourceWords.some(function(actual){return wordMatch(actual,expected);});});
  }
  function scoreText(text, values) {
    var sourceWords=normalized(text).split(" ").filter(Boolean);
    return values.reduce(function (score, value) {
      var expected=normalized(value).split(" ").filter(Boolean);
      return phraseMatch(sourceWords,expected)?score+Math.max(2,expected.length*3):score;
    }, 0);
  }
  function infer(text) {
    var actions = ACTIONS.map(function (item) { return { item:item, score:scoreText(text, item.verbs.concat([item.label,item.code])) }; }).sort(function (a,b) { return b.score-a.score; });
    var profiles = PROFILES.map(function (item) { return { item:item, score:scoreText(text, item.aliases.concat([item.label,item.code])) }; }).sort(function (a,b) { return b.score-a.score; });
    return freeze({ actionCode:(actions[0] && actions[0].score ? actions[0].item.code : "ponudba"), actionConfidence:actions[0] ? actions[0].score : 0, profileId:(profiles[0] && profiles[0].score ? profiles[0].item.profileId : null), profileConfidence:profiles[0] ? profiles[0].score : 0, profileCandidates:freeze(profiles.filter(function (row) { return row.score > 0; }).slice(0,4).map(function (row) { return row.item.profileId; })) });
  }
  function validate() {
    var errors=[];
    if (ACTIONS.length !== 5) errors.push("Katalog mora vsebovati 5 dejanj.");
    if (PROFILES.length !== 43) errors.push("Katalog mora vsebovati 43 profilov.");
    PROFILES.forEach(function (item) { if (!item.description || !item.deliverableFamilies.length || !item.riskFamilies.length || !item.evidenceNeeded.length) errors.push("Nepopoln profil " + item.profileId); });
    return freeze({ valid:!errors.length, errors:freeze(errors) });
  }
  return freeze({ version:VERSION, actions:ACTIONS, profiles:PROFILES, offerModels:freeze((ponudba && ponudba.offerModels || []).slice()), salesChannels:freeze((ponudba && ponudba.salesChannels || []).slice()), familyPacks:FAMILY_PACKS, infer:infer, validate:validate, byProfileId:function (id) { return PROFILES.find(function (item) { return item.profileId === Number(id); }) || null; }, byActionCode:function (code) { return ACTIONS.find(function (item) { return item.code === code; }) || null; } });
});
