"use strict";

require("./test-boniteta-identity-fallback");

var assert = require("assert/strict");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var zlib = require("zlib");
var root = path.resolve(__dirname, "..");
var identitySearch = require("../api/_lib/openregister-identity-search");

function source(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

async function main() {
  var html = source("app/bonitetna-preverba.html");
  var js = source("app/bonitetna-preverba.js");
  assert.doesNotThrow(function () { new vm.Script(js); },
    "glavna logika bonitetne preverbe mora ostati veljaven JavaScript");
  assert.match(js, /if \(preverjanjeVTehniku\) return;/,
    "ponovni klik med preverjanjem ne sme ustvariti podvojene poizvedbe");
  assert.match(js, /heroPreveriGumb\.disabled = vklopljeno;[\s\S]*?Preverjam podjetje/,
    "vidni gumb mora takoj pokazati stanje preverjanja");
  assert.match(js, /HERO_NALAGANJE_BESEDILA = \[[\s\S]*?Preverjam register[\s\S]*?Preverjam sedež[\s\S]*?Preverjam status[\s\S]*?Preverjam finance[\s\S]*?Preverjam vodstvo[\s\S]*?Preverjam povezave[\s\S]*?Preverjam insolventnost[\s\S]*?Primerjam podatke[\s\S]*?Sestavljam rezultat/,
    "gumb mora prikazati devet kratkih in različnih korakov preverbe");
  assert.match(js, /heroNalaganjeKorak >= HERO_NALAGANJE_BESEDILA\.length[\s\S]*?window\.setTimeout\(prikaziHeroNalaganjeKorak, 1500\)/,
    "koraki se morajo menjati na 1,5 sekunde in se po devetem ne smejo ponoviti");
  assert.match(js, /localhost\|127\\\.0\\\.0\\\.1[\s\S]*?loading-preview[\s\S]*?nastaviNalaganje\(true\)/,
    "vizualni predogled nalaganja mora ostati omejen na lokalni razvojni naslov");
  assert.match(js, /registrskiVnos && heroSpletnaStatus[\s\S]*?classList\.add\("is-error"\)/,
    "napaka registrskega preverjanja mora biti vidna ob izbranem podjetju");
  assert.match(js, /function jeNeuspesnaRegistrskaIdentifikacija\(podatki\)[\s\S]*?nacinVnosa === "register"[\s\S]*?identity\.status === "unresolved"/,
    "nepotrjen registrski predlog mora biti prepoznan kot neuspešno iskanje, ne kot rezultat");
  assert.match(js, /if \(jeNeuspesnaRegistrskaIdentifikacija\(podatki\)\) \{[\s\S]*?prikaziPotPoNeuspesnemRegistrskemIskanju[\s\S]*?return;/,
    "nepotrjen registrski predlog ne sme odpreti starega zaslona Rezultat preverbe");
  assert.match(js, /localhost\|127\\\.0\\\.0\\\.1[\s\S]*?register-miss-preview[\s\S]*?lokalniAudit: true/,
    "vizualni predogled neuspešnega registrskega toka mora ostati omejen na localhost");
  var css = source("app/bonitetna-preverba.css");
  assert.match(html, /id="boniteta-rezerva-spletna">OK, zmenjeno<\/button>/,
    "opozorilo mora uporabniku potrditi navodilo brez dodatnega gumba za odpiranje vnosa");
  assert.match(js, /function nastaviHeroZaSpletnoRezervo\(vklopljeno\)[\s\S]*?nastaviHeroPodjetje\(""\)[\s\S]*?heroPodnaslov\.textContent = "Vnesite spletno stran"[\s\S]*?heroSpletnaLabel\.textContent = "Vnesite spletno stran"[\s\S]*?placeholder = "www\.podjetje\.de"/,
    "neuspešno registrsko iskanje mora takoj pokazati zgornji vnos spletne strani");
  assert.match(js, /vodeniSpletniVnos = spletnaRezervaRazlog === "openregister_not_found"[\s\S]*?if \(!vodeniSpletniVnos\) nastaviSpletnoRezervo\(false\)/,
    "opozorilo se med vnosom spletne strani ne sme prezgodaj skriti");
  assert.doesNotMatch(html, /id="boniteta-rezerva-spletna">Vnesi spletno stran<\/button>/,
    "stari podvojeni poziv za odpiranje spletnega vnosa ne sme ostati");
  assert.match(html, /id="boniteta-potrditev-gumb"[\s\S]*?data-potrditev-gumb-label[\s\S]*?>Preveri insolventnost<\/span>/,
    "label gumba za insolventnost mora imeti lastno centrirano območje");
  assert.match(js, /function nastaviNalaganjePotrditve\(vklopljeno\)[\s\S]*?classList\.toggle\("is-loading"[\s\S]*?"Preverjam insolventnost"[\s\S]*?potrditevGumb\.disabled = true/,
    "nalaganje insolventnosti mora ohraniti disabled zaščito brez pikic v labelu");
  assert.match(js, /confirmation-loading-preview[\s\S]*?pripraviOpenRegisterTestnoPotrditev\(\)[\s\S]*?nastaviNalaganjePotrditve\(true\)/,
    "lokalni vizualni predogled mora varno pokazati dejansko loading stanje potrditvenega gumba");
  assert.doesNotMatch(js, /potrditevGumb\.textContent = "Preverjam insolventnost/,
    "nalaganje ne sme zamenjati strukturirane vsebine gumba z navadnim besedilom");
  assert.match(css, /boniteta-potrditev-identitete__gumb \{[\s\S]*?grid-template-columns: 38px minmax\(0, 1fr\) 38px[\s\S]*?text-align: center/,
    "label mora biti geometrijsko centriran med enako širokima stranskima območjema");
  assert.match(css, /boniteta-potrditev-identitete__gumb\.is-loading:disabled[\s\S]*?linear-gradient\(135deg,#35aaa5,#0b8587 72%,#08717a\)[\s\S]*?cursor: wait/,
    "disabled stanje med nalaganjem mora ohraniti turkizni videz");
  assert.match(css, /boniteta-potrditev-identitete__gumb\.is-loading::after[\s\S]*?border-top-color: #fff[\s\S]*?animation: boniteta-vrtenje/,
    "desni krogec mora med nalaganjem postati čist bel spinner");
  assert.match(css, /\.crif-flow-picker__start-status\.is-changing[\s\S]*?boniteta-status-prihod/,
    "sprememba statusa v glavnem gumbu mora imeti nežno animacijo");
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?boniteta-status-pika/,
    "animacija mora spoštovati uporabnikovo nastavitev zmanjšanega gibanja");
  assert.match(html, /id="boniteta-priporocilo"[\s\S]*?Katera preverba je prava zame\?[\s\S]*?id="boniteta-priporocilo-vrednost"[\s\S]*?id="boniteta-priporocilo-izpostavljenost"[\s\S]*?id="boniteta-priporocilo-trajanje"[\s\S]*?id="boniteta-priporocilo-izkusnja"[\s\S]*?id="boniteta-priporocilo-placilo"/,
    "zložljivi svetovalec mora biti med naslovom in karticama ter zahtevati ključne podatke o poslu");
  assert.match(html, /Največ še neplačano[\s\S]*?Poznate stranko\?[\s\S]*?Ne, nova je[\s\S]*?Da, včasih zamuja/,
    "vprašanja morajo biti kratka in razumljiva obrtniku");
  assert.match(html, /id="boniteta-trajanje-enota-gumb"[\s\S]*?data-trajanje-enota="days"[\s\S]*?>dni<[\s\S]*?data-trajanje-enota="weeks"[\s\S]*?>tedni<[\s\S]*?data-trajanje-enota="months"[\s\S]*?>meseci</,
    "enoto trajanja mora biti mogoče izbrati med dnevi, tedni in meseci");
  assert.match(css, /\.boniteta-trajanje-enota > button \{[\s\S]*?justify-content: center[\s\S]*?text-align: center[\s\S]*?\.boniteta-trajanje-enota > button > \[aria-hidden="true"\][\s\S]*?right: 6px/,
    "besedilo enote mora biti centrirano, puščica pa ostati samostojno desno");
  assert.match(css, /\.boniteta-trajanje-enota__meni \{[\s\S]*?bottom: calc\(100% \+ 5px\)/,
    "meni enote trajanja se mora odpreti navzgor");
  assert.match(html, /id="boniteta-priporocilo-placilni-predlog"/,
    "rezultat mora poleg preverbe pokazati tudi predlog plačila");
  assert.match(html, /class="boniteta-priporocilo__preklop"[\s\S]*?id="boniteta-priporocilo-zavihek-posel"[\s\S]*?>Ta posel<\/button>[\s\S]*?id="boniteta-priporocilo-zavihek-profil"[\s\S]*?>O meni[\s\S]*?id="boniteta-priporocilo-posel"[\s\S]*?id="boniteta-priporocilo-profil"/,
    "en svetovalec mora z notranjim preklopom zamenjati podatke za posel in O meni");
  assert.equal((html.match(/id="boniteta-priporocilo"/g) || []).length, 1,
    "na zaslonu sme ostati samo en zunanji svetovalni widget");
  assert.doesNotMatch(html, /<details[^>]+id="boniteta-poslovni-profil"/,
    "O meni ne sme biti ločen zunanji widget");
  assert.match(html, /Najprej izpolnite podatke »O meni«[\s\S]*?Tako lahko znesek primerjamo z vašimi običajnimi projekti/,
    "manjkajoči profil mora biti pojasnjen kratko in pogovorno");
  assert.doesNotMatch(html, /Izpolni zdaj|boniteta-profil-opozorilo-odpri/,
    "opozorilo ne sme podvajati dejanja, ker je uporabnik že v zavihku O meni");
  assert.match(html, /S čim se ukvarjate\?[\s\S]*?Običajna vrednost projekta[\s\S]*?Koliko običajno založite\?[\s\S]*?Kdaj bi vas neplačilo resno prizadelo\?/,
    "O meni mora zbrati štiri kratke podatke, potrebne za osebno priporočilo");
  assert.doesNotMatch(html, /Najprej spoznajmo vaše delo|4 kratki odgovori — samo prvič|boniteta-poslovni-profil__glava/,
    "profilni obrazec ne sme porabljati prostora z dodatnim podvojenim naslovom");
  assert.doesNotMatch(html, /<form[^>]+id="boniteta-poslovni-profil-obrazec"/,
    "profilni podatki ne smejo ustvariti neveljavnega vgnezdenega obrazca");
  assert.match(html, /id="boniteta-priporocilo-zavrni"[^>]*>Ne, hvala<\/button>[\s\S]*?id="boniteta-priporocilo-uporabi"[^>]*>Uporabi priporočilo<\/button>/,
    "priporočilo mora imeti dve enakovredni odločitvi v vrstnem redu zavrni in uporabi");
  assert.doesNotMatch(html, /Izberite vrsto preverbe|Izberite obseg podatkov\./,
    "nad svetovalcem ne sme ostati odstranjeni podvojeni naslov");
  assert.match(css, /\.boniteta-priporocilo \{[\s\S]*?border: 1px solid #d5e9e4[\s\S]*?linear-gradient\(145deg, #f7fcfb 0%, #edf8f5 100%\)[\s\S]*?0 4px 12px rgba\(0, 80, 75, \.06\)/,
    "svetovalec mora uporabljati odobreni mint videz obstoječih kartic");
  assert.match(css, /\.boniteta-priporocilo__povzetek \{[\s\S]*?grid-template-columns: 42px minmax\(0, 1fr\) 38px/,
    "zaprti widget mora imeti stabilna stranska območja in prožen sredinski tekst");
  assert.match(css, /\.boniteta-priporocilo\[open\] \{ z-index: 100; \}/,
    "odprti svetovalec mora ostati nad spodnjo navigacijo, da je zadnji gumb klikljiv");
  assert.match(css, /\.boniteta-priporocilo__vsebina \{[\s\S]*?position: absolute[\s\S]*?top: calc\(100% \+ 10px\)[\s\S]*?bottom: auto[\s\S]*?transform-origin: center top[\s\S]*?boniteta-priporocilo-odpri/,
    "odprti svetovalec mora lebdeti navzdol brez razširitve strani");
  assert.match(css, /max-height: var\(--boniteta-priporocilo-max-height[\s\S]*?overflow-y: auto[\s\S]*?-webkit-overflow-scrolling: touch[\s\S]*?touch-action: pan-y/,
    "odprti svetovalec mora omogočiti drsenje s prstom in koleščkom");
  assert.match(css, /\.boniteta-priporocilo__preklop \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[\s\S]*?background: #e4f2ef/,
    "notranji preklop mora imeti dve enaki strani v enem widgetu");
  assert.match(css, /\.boniteta-priporocilo__preklop\.is-profil::before \{ transform: translateX\(calc\(100% \+ 4px\)\); \}/,
    "aktivni notranji gumb mora gladko zdrsniti z leve na desno");
  assert.match(css, /@keyframes boniteta-priporocilo-odpri \{ from \{ opacity: 0; transform: translateY\(-12px\) scale\(\.975\)/,
    "lebdeča kartica mora imeti nežno animacijo od zgornjega roba navzdol");
  var centerJs = source("app/boniteta-sredisce.js");
  assert.match(centerJs, /function uporabiBonitetnoPriporocilo\(\)[\s\S]*?chooseFlow\(bonitetaPriporocilo\.flow\)[\s\S]*?okvir\.open=false/,
    "uporaba priporočila mora izbrati pravo kartico in widget zložiti nazaj");
  assert.match(centerJs, /function prikaziZavihekPriporocila\(ime\)[\s\S]*?boniteta-priporocilo-posel[\s\S]*?boniteta-priporocilo-profil[\s\S]*?aria-selected/,
    "gumba Ta posel in O meni morata preklopiti vsebino znotraj iste kartice");
  assert.match(centerJs, /function uskladiVisinoPriporocila\(\)[\s\S]*?boniteta-app-testna-vrstica[\s\S]*?--boniteta-priporocilo-max-height[\s\S]*?window\.addEventListener\("resize",uskladiVisinoPriporocila\)/,
    "višina odprtega panela se mora prilagoditi prostoru nad spodnjo vrstico");
  assert.match(centerJs, /function pripraviLepeIzbirnike\(\)[\s\S]*?\.boniteta-priporocilo__polja select[\s\S]*?role","combobox"[\s\S]*?role","listbox"/,
    "sistemske select menije v svetovalcu mora zamenjati dostopen lastni izbirnik");
  assert.match(centerJs, /select\.dispatchEvent\(new Event\("input",\{bubbles:true\}\)\)[\s\S]*?select\.dispatchEvent\(new Event\("change",\{bubbles:true\}\)\)/,
    "lastni izbirnik mora ohraniti obstoječo logiko prek izvornega selecta");
  assert.match(css, /\.boniteta-lep-izbirnik__meni \{[\s\S]*?linear-gradient\(145deg, #fff, #f1faf7\)[\s\S]*?\.boniteta-lep-izbirnik__izbira\.is-selected \{ background: #d9efeb/,
    "odprt meni in izbrana možnost morata uporabljati miren mint videz brez sistemske modrine");
  assert.match(centerJs, /POSLOVNI_PROFIL_KLJUC="uj_boniteta_poslovni_profil_v1"[\s\S]*?localStorage\.setItem/,
    "kratkega profila ni treba izpolnjevati ob vsakem poslu");
  assert.doesNotMatch(centerJs, /el\("boniteta-poslovni-profil"\)/,
    "logika ne sme več pričakovati odstranjenega zunanjega profilnega widgeta");
  var advisorSource = centerJs.slice(centerJs.indexOf("function priporociBonitetniTok"), centerJs.indexOf("function meseciBesedilo"));
  var advise = new Function(advisorSource + "; return priporociBonitetniTok;")();
  assert.deepEqual(advise(18000, 8000, 4, "after_completion", "new"), { flow: "crif", repeatDays: 30, paymentPlan: "Predlagamo vsaj 20 % avans in plačilo po fazah." });
  assert.deepEqual(advise(4000, 1000, 1, "prepayment", "good"), { flow: "soft", repeatDays: 0, paymentPlan: "Dogovorjeni način plačila je primeren." });
  assert.deepEqual(advise(60000, 60000, 2, "milestone", "late"), { flow: "crif", repeatDays: 14, paymentPlan: "Predlagamo 30 % avans in plačilo po fazah." });
  assert.deepEqual(advise(5000, 5000, 1, "milestone", "good", { obicajnaVrednost: 2000, kriticniZnesek: 5000 }), { flow: "crif", repeatDays: 30, paymentPlan: "Predlagamo vsaj 20 % avans in plačilo po fazah." });
  assert.match(centerJs, /Pri tem poslu je tveganje večje[\s\S]*?ali je naročilo za vas varno[\s\S]*?tveganje nizko[\s\S]*?brez dodatnih stroškov/,
    "končni predlog mora kratko in pogovorno razložiti samo razlog za izbrano preverbo");
  assert.match(centerJs, /function zavrniBonitetnoPriporocilo\(\)[\s\S]*?chooseFlow\(flowPredPriporocilom\)[\s\S]*?ustaviPoudarekPriporocila/,
    "Ne, hvala mora obnoviti prejšnjo izbiro in ustaviti poudarjanje");
  assert.match(centerJs, /function trajanjeVMesecih\(vrednost,enota\)[\s\S]*?enota==="days"\?n\/30:enota==="weeks"\?n\/4\.345:n/,
    "dnevi in tedni se morajo pred odločitvijo pravilno pretvoriti v mesece");
  assert.match(centerJs, /function trajanjeBesedilo\(vrednost,enota\)[\s\S]*?1 dan[\s\S]*?1 teden[\s\S]*?meseciBesedilo/,
    "razlaga priporočila mora uporabiti uporabnikovo izbrano enoto");
  assert.match(centerJs, /function zapriMeniEnoteTrajanja\(\)[\s\S]*?aria-expanded","false"[\s\S]*?addEventListener\("toggle",function\(\)\{zapriMeniEnoteTrajanja\(\)/,
    "meni enote trajanja se mora zapreti ob zapiranju in ponovnem odpiranju widgeta");
  assert.match(centerJs, /function pokaziBonitetnoPriporocilo\(\)[\s\S]*?classList\.add\("is-ready"\)[\s\S]*?rezultat"\)\.hidden=false/,
    "po kliku mora obrazec zamenjati kratek rezultat brez podaljšanja odprte kartice");
  assert.match(centerJs, /function pokaziBonitetnoPriporocilo\(\)[\s\S]*?chooseFlow\(bonitetaPriporocilo\.flow\)[\s\S]*?is-recommended-pulse/,
    "prikaz predloga mora takoj izbrati in poudariti priporočeno kartico brez dodatnega klika");
  assert.match(css, /\.boniteta-priporocilo\.is-ready > \.boniteta-priporocilo__povzetek \{ display: none; \}[\s\S]*?\.boniteta-priporocilo\.is-ready \.boniteta-priporocilo__vsebina[\s\S]*?position: relative;[\s\S]*?animation-name: boniteta-priporocilo-bubble/,
    "končno priporočilo mora zamenjati povzetek in stati neposredno nad karticama");
  assert.match(css, /\.boniteta-priporocilo\.is-ready \.boniteta-priporocilo__preklop \{ display: none; \}[\s\S]*?padding: 10px;[\s\S]*?\.boniteta-priporocilo\.is-ready \.boniteta-priporocilo__rezultat \{ margin-top: 0; \}/,
    "končni panel mora skriti nepotreben preklop in ostati dovolj kompakten za vidni zaslon");
  assert.match(css, /\.boniteta-priporocilo\.is-ready \.boniteta-priporocilo__vsebina[\s\S]*?linear-gradient\(135deg, #46b2ac, #168d8a 62%, #087079\)[\s\S]*?\.boniteta-priporocilo\.is-ready \.boniteta-priporocilo__rezultat div > span[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;/,
    "priporočilo mora biti turkizna kartica z belim besedilom brez notranjih značk");
  assert.match(css, /\.crif-flow-picker__option\.is-recommended-pulse[\s\S]*?boniteta-priporocena-kartica[\s\S]*?@keyframes boniteta-priporocena-kartica[\s\S]*?0 0 0 5px rgba\(172, 229, 219, \.34\)/,
    "priporočena kartica mora dobiti nežen mint poudarek v jeziku spletnega polja");
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?crif-flow-picker__option\.is-recommended-pulse \{ animation: none/,
    "poudarek priporočene kartice mora spoštovati zmanjšano gibanje");
  assert.match(css, /\.boniteta-priporocilo\.is-ready \.boniteta-priporocilo__vsebina \{[\s\S]*?position: relative[\s\S]*?max-height: none[\s\S]*?overflow: visible/,
    "rezultatski bubble mora biti v toku nad karticama in ju ne sme prekrivati");
  var api = source("api/boniteta-pro.js");
  var apiHandler = source("api/_handlers/boniteta-pro.js");
  var mehka = source("api/_handlers/mehka-boniteta.js");
  var proofSource = source("api/_lib/openregister-identity-search.js");

  assert.match(html, />Podjetje, oseba ali spletna stran<\/label>/);
  assert.match(html, /placeholder="Ime, oseba, podjetje ali URL"/);
  assert.match(html, /id="boniteta-nacin-spletna" hidden aria-hidden="true" tabindex="-1"/,
    "programski iskalni gumb mora ostati skrit, ker preverbo sproži spodnji glavni gumb");
  assert.match(html, /aria-autocomplete="list"/);
  assert.match(html, /id="boniteta-hero-zadetki"[^>]+role="listbox"/);
  assert.match(html, /id="boniteta-hero-podjetje-odstrani"[^>]+aria-label="Odstrani izbrano podjetje"/,
    "izbrano podjetje mora imeti jasen gumb za popoln izbris izbire");
  assert.match(html, /id="boniteta-hero-podjetje"[^>]+role="button"[^>]+tabindex="0"[^>]+aria-label="Spremeni izbrano podjetje"/,
    "navidezno vnosno polje mora biti jasno označeno kot dejanje za ponovno urejanje");
  assert.doesNotMatch(html, /id="boniteta-hero-podjetje"[\s\S]{0,500}?m5 12\.5 4\.2 4\.2L19 7/,
    "izbrano podjetje ne sme več prikazovati zelene potrditvene kljukice");
  assert.match(html, /Samodejno poišči pravo osebo ali podjetje/);
  assert.doesNotMatch(js, /action: "autocomplete"/);
  assert.match(js, /action: "identity_search"/);
  assert.match(js, /pridobiToken\(false, true\)/,
    "zaščiteni autocomplete mora tudi v lokalnem predogledu uporabiti pravo prijavno sejo");
  assert.match(js, /odgovor\.status === 401 && authPoskus === 0/,
    "zavrnjeno prijavo mora varno osvežiti, ne da bi ponovil že izveden plačljiv klic");
  assert.match(js, /jeLokalniPredogled\(\) && !zahtevajPravoPrijavo/,
    "lokalni žeton sme ostati omejen samo na lokalne predogledne poti");
  assert.doesNotMatch(html, /class="boniteta-hero__vir"/,
    "pod iskalnikom ne sme biti stalnega besedila o virih ali stroških");
  assert.match(js, /openRegisterCompanyId:/);
  assert.match(js, /openRegisterIdentityProof:/);
  assert.match(js, /companyIndexSource:/);
  assert.match(js, /companyIndexProof:/);
  assert.match(js, /delete shranljivo\.identity_proof/,
    "kratkotrajni plačljivi dokaz se ne sme zapisati v lokalni predpomnilnik");
  assert.match(js, /if \(!registrskiVnos && !obrazec\.reportValidity\(\)\) return;/,
    "izbrano registrsko podjetje ne sme obstati na skritih obveznih ročnih poljih");
  assert.match(js, /function izvediUniverzalnoIskanje[\s\S]*?zanesljivEnolicniZadetek/,
    "glavni gumb mora samodejno usmeriti univerzalni vnos");
  assert.doesNotMatch(js, /prviPrikazaniZadetek[\s\S]*?prviPrikazaniZadetek\.click\(\)/,
    "glavni gumb ne sme slepo izbrati prvega približnega zadetka");
  var classifierSource = js.slice(
    js.indexOf("function razvrstiUniverzalniVnos"),
    js.indexOf("function jedroUniverzalnegaNaziva")
  );
  var classify = new Function(classifierSource + "; return razvrstiUniverzalniVnos;")();
  assert.deepEqual(classify("https://kuzey-haustechnik.de/impressum"), {
    vrsta: "spletna_stran", vrednost: "https://kuzey-haustechnik.de/impressum",
  });
  assert.equal(classify("kuzey-haustechnik.de").vrsta, "spletna_stran");
  assert.equal(classify("Hasan Seyhan").vrsta, "oseba");
  assert.equal(classify("Kuzey Haustechnik").vrsta, "podjetje");
  assert.equal(classify("HRB 123456 Berlin").vrsta, "register");
  assert.equal(classify("Angaben gemäß § 5 TMG").vrsta, "naslov_impressuma");
  assert.match(js, /razvrstitev\.vrsta === "spletna_stran"[\s\S]*?nacinVnosa = "spletna"[\s\S]*?izvediBonitetnoPreverbo/,
    "spletni naslov mora neposredno v Impressum preverjanje");
  assert.match(js, /razvrstitev\.vrsta !== "register"[\s\S]*?poisciNorthDataPodjetja[\s\S]*?poisciAutocompletePodjetja/,
    "ime mora samodejno preiti iz brezplačnih virov v novejše in uradno iskanje");
  assert.match(source("app/boniteta-sredisce.js"), /!hasCompany&&heroInput&&heroInput\.value\.trim\(\)&&window\.UJBonitetaZacniIzbranoPodjetje/,
    "tok mora pred spletnim iskanjem najprej uporabiti že prikazani predlog podjetja");
  assert.doesNotMatch(js, /AUTOCOMPLETE_ZAKASNITEV_MS|razporediAutocompleteIskanje/,
    "tipkanje ne sme samodejno razporediti plačljivega OpenRegister klica");
  assert.match(js, /filtrirajAutocompleteZadetke/,
    "tipkanje mora filtrirati brezplačne shranjene zadetke lokalno");
  assert.match(js, /naloziOdprtiRegisterZadetke/,
    "tipkanje mora uporabljati stisnjeni brezplačni indeks nemških podjetij");
  assert.match(js, /function najdiOdprtiRegisterKandidate[\s\S]*?kandidati\.length < 240/,
    "velikega registrskega dela ne smemo v celoti ocenjevati in razvrščati ob vsakem znaku");
  assert.match(js, /autocompleteIskalniTokeni/,
    "iskanje mora podpirati besedno ujemanje, ne samo dobesednega podniza");
  assert.doesNotMatch(js, /Paul Hartmann|Müller Elektro/,
    "rešitev ne sme biti trdo vezana na posamezno testno podjetje");
  var wordMatchSource = js.slice(
    js.indexOf("function normalizirajAutocompleteBesede"),
    js.indexOf("function normalizirajOdprtiRegisterNiz")
  );
  var wordMatch = new Function(wordMatchSource + "; return { tokens: autocompleteIskalniTokeni, score: oceniAutocompleteNaziv };")();
  assert.ok(
    wordMatch.score("Paul Hartmann Spenglerei und Installations GmbH & Co. KG", "Paul Hartmann GmbH & Co. KG") >
      wordMatch.score("Paul Hartmann AG", "Paul Hartmann GmbH & Co. KG"),
    "vmesne besede ne smejo preprečiti zadetka, pravna oblika pa mora izboljšati razvrstitev"
  );
  assert.equal(wordMatch.score("Hartmann Internationale Transporte GmbH", "Paul Hartmann GmbH"), -1,
    "zadetek, ki mu manjka razlikovalna beseda, ne sme biti sprejet");
  assert.ok(wordMatch.score("Müller Elektro Anlagenbau GmbH", "Müller GmbH") >= 0,
    "isto pravilo mora delovati tudi za nepovezan primer z vmesnimi besedami");
  var directoryMapper = js.slice(js.indexOf("function odprtiRegisterZapisVPodjetje"), js.indexOf("function naloziOdprtiRegisterDodatke"));
  assert.match(directoryMapper, /name: String\(row\[0\]/,
    "stari imenik sme prispevati samo naziv podjetja");
  assert.doesNotMatch(directoryMapper, /row\[[1-6]\]/,
    "kraj, register, status in identifikator iz starega imenika ne smejo v preverbo");
  assert.match(js, /route=profiles/,
    "brezplačni predlogi morajo vključiti že shranjene profile uporabnika");
  var inputHandler = js.slice(js.indexOf('heroSpletnaPolje.addEventListener("input"'), js.indexOf('heroSpletnaPolje.addEventListener("keydown"'));
  assert.doesNotMatch(inputHandler, /openRegisterApi|poisciAutocompletePodjetja|identity_search/,
    "samo tipkanje nikoli ne sme poklicati plačljivega OpenRegister autocomplete");
  assert.doesNotMatch(inputHandler, /northDataAutocompleteApi|northdata_autocomplete|poisciNorthDataPodjetja/,
    "samo tipkanje nikoli ne sme poklicati plačljivega North Data actorja");
  assert.match(inputHandler, /length >= 2[\s\S]*?naloziOdprtiRegisterDelec\(odprtiRegisterKljuc\(query\)\)/,
    "pravi brezplačni del indeksa se mora začeti nalagati že pri dveh znakih");
  assert.match(inputHandler, /\}, 35\);/,
    "iskanje ne sme imeti starega 180-milisekundnega umetnega čakanja");
  assert.match(html, /bonitetna-preverba\.js\?v=202608\d{2}-[^"']+-v\d+/,
    "brskalnik mora dobiti novo hitro različico iskalne kode");
  var selection = js.slice(js.indexOf("function izberiAutocompletePodjetje"), js.indexOf("function ponastaviAutocompletePodjetje"));
  assert.doesNotMatch(selection, /openRegisterApi|company_lookup/,
    "izbira že najdenega podjetja ne sme sprožiti dodatnega plačljivega klica");
  assert.doesNotMatch(selection, /scrollIntoView/,
    "izbira podjetja ne sme samodejno odskrolati stran od izbrane vrstice in gumba za izbris");
  assert.doesNotMatch(selection, /Podjetje je izbrano|drugega kredita ne bo|kredit se porabi/,
    "po izbiri podjetja se pod vrstico ne sme prikazati informativno besedilo");
  assert.match(css, /\.boniteta-hero__zadetki/);
  assert.match(css, /\.boniteta-hero__zadetek/);
  assert.match(css, /\.boniteta-hero__status:not\(\.is-error\) \{ display: none !important; \}/,
    "pod iskalnikom sme biti vidna samo uporabniku pomembna napaka");
  assert.match(js, /function nastaviHeroNapako[\s\S]*?classList\.add\("is-error"\)/,
    "vse vidne napake pod iskalnikom morajo uporabljati enotno stanje napake");
  assert.match(js, /nastaviHeroPodjetje\(selected\.name\);[\s\S]*?pocistiHeroSporocilo\(\);/,
    "po izbiri podjetja mora informativno besedilo v celoti izginiti");
  assert.match(js, /function urediAutocompletePodjetje\(\)[\s\S]*?ponastaviAutocompletePodjetje\(\);[\s\S]*?heroSpletnaPolje\.value = trenutnoIme;[\s\S]*?heroSpletnaPolje\.select\(\);/,
    "dotik izbranega naziva mora ponovno odpreti pravo polje z besedilom za urejanje");
  assert.match(js, /heroPodjetje\.addEventListener\("click"[\s\S]*?#boniteta-hero-podjetje-odstrani[\s\S]*?urediAutocompletePodjetje\(\);/,
    "izbrani naziv mora biti mogoče urediti brez obveznega klika na križec");
  assert.match(css, /boniteta-hero\.is-autocomplete-open \{[\s\S]*?z-index: 20;[\s\S]*?overflow: visible;/,
    "iskalni seznam mora lebdeti v belem oknu brez umetnega podaljšanja zelene glave");
  assert.doesNotMatch(css, /boniteta-hero\.is-autocomplete-open \{ min-height:/,
    "odprto iskanje ne sme ustvariti prazne zelene površine");
  assert.match(css, /#boniteta-nacin-spletna\s*\{[\s\S]*display: none !important/,
    "ob vnosnem polju ne sme biti dodatne lupe");
  assert.match(html, /id="boniteta-hero-pocisti"[^>]*aria-label="Izbriši celoten vnos"[^>]*hidden/,
    "vnosno polje mora imeti dostopen krožni gumb za popoln izbris");
  assert.match(css, /\.boniteta-hero__pocisti\s*\{[\s\S]*?border-radius:\s*50%;/,
    "gumb za izbris mora biti okrogel");
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.boniteta-hero__pocisti \{ right: 5px; width: 40px; height: 40px; \}/,
    "gumb za izbris mora imeti dovolj veliko mobilno klik površino");
  assert.match(css, /\.boniteta-zajem__nacin \{[\s\S]*?min-height: 128px;[\s\S]*?border: 1px solid #d5e9e4;[\s\S]*?border-radius: 16px;[\s\S]*?linear-gradient\(145deg, #f7fcfb 0%, #edf8f5 100%\);[\s\S]*?0 4px 12px rgba\(0, 80, 75, \.06\)/,
    "tri kartice zajema morajo uporabljati enoten svetel mint videz");
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.boniteta-zajem__nacin \{ min-height: 64px;[\s\S]*?\.stran--bonitetna \.crif-flow-picker__option \{ min-height: 194px;/,
    "mobilni začetni sklopi morajo ostati opazno kompaktnejši");
  assert.match(css, /\.boniteta-zajem__nacin:active:not\(:disabled\)[\s\S]*?transform: scale\(\.985\)[\s\S]*?#e3f3ef/,
    "pritisnjena kartica mora imeti subtilen turkizen odziv brez premika postavitve");
  assert.match(css, /\.boniteta-zajem__nacin > span:not\(\.boniteta-zajem__ikona\):not\(\.boniteta-zajem__uspeh\):not\(\.boniteta-zajem__datoteka\) \{ color: #5b6f6b;/,
    "opisno besedilo kartic ne sme biti modro");
  assert.match(css, /#boniteta-hero-spletna-stran \{ padding-right: 50px; \}/,
    "vnosno polje mora rezervirati prostor za gumb za izbris");
  assert.match(js, /function posodobiHeroPocisti\(\)[\s\S]*?hidden = !heroSpletnaPolje\.value\.length/,
    "križec mora biti viden pri kateremkoli vpisanem znaku");
  assert.match(js, /function pocistiCelotenHeroVnos\(\)[\s\S]*?ponastaviNovoPreverbo\(\)[\s\S]*?heroSpletnaPolje\.focus/,
    "klik križca mora izbrisati vnos in ponastaviti celoten prikaz");
  assert.match(api, /PAID_AUTOCOMPLETE_DISABLED/);
  assert.match(api, /action === "identity_search"/);
  assert.match(api, /action === "company_lookup"/);
  assert.match(apiHandler, /PAID_AUTOCOMPLETE_DISABLED/);
  assert.match(apiHandler, /action === "identity_search"/);
  assert.match(mehka, /telo && telo\.openRegisterCompanyId/);
  assert.match(mehka, /!popolnRocniVnos && !izbranoRegistrskoPodjetje/);
  assert.match(mehka, /verifyCompanyProof\(telo\.openRegisterIdentityProof, auth\.user\.id\)/);
  assert.match(mehka, /reusedSignedSelection: true/,
    "isti enokreditni rezultat mora biti ponovno uporabljen pri končni preverbi");
  assert.match(mehka, /telo\.companyIndexSource === "offeneregister" && vnos\.ime/,
    "predlog starega imenika mora v aktualno preverbo vstopiti samo z nazivom");
  assert.match(mehka, /poisciOpenRegisterNajvecEnkrat/,
    "končna preverba mora imeti trdo omejitev največ enega identitetnega klica");
  assert.match(mehka, /one_credit_budget_preserved/,
    "drugi identitetni klic v isti zahtevi mora biti zavrnjen");
  assert.match(proofSource, /api\.openregister\.de\/v0\/search\/company/);
  assert.doesNotMatch(proofSource, /autocomplete\/company/);
  assert.doesNotThrow(function () { new Function(js); });

  var manifestPath = path.join(root, "app", "company-index", "manifest.json");
  assert.ok(fs.existsSync(manifestPath), "manjka zgrajeni odprti indeks podjetij");
  var manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.snapshotDate, "2019-02-05");
  assert.ok(manifest.records > 4_000_000, "indeks mora vsebovati več milijonov podjetij");
  var medienShard = path.join(root, "app", "company-index", "me.json.gz");
  assert.ok(fs.existsSync(medienShard), "manjka shard za podjetja z začetkom 'me'");
  var medienRows = JSON.parse(zlib.gunzipSync(fs.readFileSync(medienShard)).toString("utf8"));
  assert.ok(medienRows.some(function (row) { return /^Mercedes-Benz AG$/i.test(String(row[0] || "")); }),
    "brezplačni predlogi morajo vrniti resničen registrski zadetek iz indeksa");
  var paulRows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, "app", "company-index", "pa.json.gz"))).toString("utf8"));
  assert.ok(paulRows.some(function (row) {
    return wordMatch.score(String(row[0] || ""), "Paul Hartmann GmbH & Co. KG") >= 0;
  }), "splošno besedno ujemanje mora najti naziv tudi, kadar ima register vmesne besede");
  var verifiedAdditions = JSON.parse(fs.readFileSync(path.join(root, "app", "company-index", "verified-additions.json"), "utf8"));
  assert.ok(verifiedAdditions.some(function (row) { return /^MedienOrbis GmbH$/i.test(String(row[0] || "")); }),
    "že preverjeni novejši primer MedienOrbis mora ostati brezplačno najdljiv");

  var oldFetch = global.fetch;
  var oldKey = process.env.OPENREGISTER_API_KEY;
  var calls = [];
  process.env.OPENREGISTER_API_KEY = "test-key";
  global.fetch = async function (url) {
    calls.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async function () {
        return {
          results: [{
            company_id: "DE-HRB-F1103-267645",
            name: "Muster Autocomplete GmbH",
            register_type: "HRB",
            register_number: "267645",
            register_court: "Berlin (Charlottenburg)",
            active: true,
          }],
          id: "DE-HRB-F1103-267645",
          name: { name: "Muster Autocomplete GmbH" },
        };
      },
    };
  };

  try {
    await assert.rejects(identitySearch.search("ab", "user-a"), /vsaj tri znake/);
    var first = await identitySearch.search("Muster Autocomplete 267645", "user-a");
    assert.equal(first.results[0].name, "Muster Autocomplete GmbH");
    assert.equal(first.cached, false);
    assert.match(calls[0], /\/v0\/search\/company\?query=Muster\+Autocomplete\+267645&page=1&per_page=10$/);
    assert.ok(first.results[0].identity_proof);
    assert.equal(identitySearch.verifyCompanyProof(first.results[0].identity_proof, "user-a").company_id, "DE-HRB-F1103-267645");
    assert.equal(identitySearch.verifyCompanyProof(first.results[0].identity_proof, "user-b"), null,
      "podpisan izbor ne sme veljati za drugega uporabnika");
    var second = await identitySearch.search("Muster Autocomplete 267645", "user-a");
    assert.equal(second.cached, true);
    assert.equal(calls.length, 1, "enak vnos mora uporabiti petminutni predpomnilnik");
  } finally {
    identitySearch.resetCache();
    global.fetch = oldFetch;
    if (oldKey == null) delete process.env.OPENREGISTER_API_KEY;
    else process.env.OPENREGISTER_API_KEY = oldKey;
  }

  console.log("Boniteta autocomplete: OK");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
