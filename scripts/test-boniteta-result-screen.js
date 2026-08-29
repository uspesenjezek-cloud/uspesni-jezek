"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var koren = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(koren, "app", "bonitetna-preverba.html"), "utf8");
var css = fs.readFileSync(path.join(koren, "app", "bonitetna-preverba.css"), "utf8");
var grafikeCss = fs.readFileSync(path.join(koren, "app", "bonitetna-podjetje-grafike.css"), "utf8");
var preverbaJs = fs.readFileSync(path.join(koren, "app", "bonitetna-preverba.js"), "utf8");
var centerJs = fs.readFileSync(path.join(koren, "app", "boniteta-sredisce.js"), "utf8");
var navigacijaJs = fs.readFileSync(path.join(koren, "app", "testna-vrstica.js"), "utf8");
var appJs = fs.readFileSync(path.join(koren, "app", "app.js"), "utf8");
var apiHandlerJs = fs.readFileSync(path.join(koren, "api", "_handlers", "mehka-boniteta.js"), "utf8");
var queueHandlerJs = fs.readFileSync(path.join(koren, "api", "mehka-boniteta-opravilo.js"), "utf8");
var workerHandlerJs = fs.readFileSync(path.join(koren, "api", "mehka-boniteta-delavec.js"), "utf8");

assert.match(preverbaJs, /function jeLokalniPredogled\(\)[\s\S]*?app-preview[\s\S]*?return "local-preview"/,
  "lokalni predogled ne sme biti odvisen od oddaljenega prijavnega strežnika");
assert.match(preverbaJs, /function glaveCakalneVrste\(token, json\)[\s\S]*?X-UJ-Local-Preview/);
assert.match(queueHandlerJs, /function jeLokalniPredogled\(req\)[\s\S]*?MEHKA_BONITETA_IN_MEMORY_QUEUE[\s\S]*?local-preview/);
assert.match(workerHandlerJs, /!ujemanjeCron\(req\) && !jeLokalniPredogled\(req\)/);

assert.match(html, /id="boniteta-rezultat-okno"[^>]*hidden/);
assert.doesNotMatch(html, /id="boniteta-rezultat-nazaj"/);
assert.doesNotMatch(html, /id="boniteta-status-ikona"|id="boniteta-rezultat-naslov"|id="boniteta-rezultat-opis"/,
  "stari rumeni povzetek mehke preverbe ne sme biti prikazan nad rezultatom");
assert.doesNotMatch(preverbaJs, /getElementById\("boniteta-(?:status-ikona|rezultat-naslov|rezultat-opis)"\)/,
  "izris ne sme vec naslavljati odstranjenega povzetka");
assert.doesNotMatch(centerJs, /el\("boniteta-(?:status-ikona|rezultat-naslov|rezultat-opis)"\)/,
  "testni predogledi ne smejo vec naslavljati odstranjenega povzetka");
assert.match(css, /\.stran--bonitetna\.boniteta-rezultat-je-okno \.boniteta-obrazec \{\s*display: none;/);
assert.match(preverbaJs, /function nastaviRezultatKotOkno\(vklopljeno\)/);
var nalaganjeFunkcija = preverbaJs.slice(
  preverbaJs.indexOf("function nastaviNalaganje(vklopljeno)"),
  preverbaJs.indexOf("function dodajPodatek", preverbaJs.indexOf("function nastaviNalaganje(vklopljeno)"))
);
assert.match(nalaganjeFunkcija, /if \(vklopljeno\) \{[\s\S]*?nastaviRezultatKotOkno\(false\);[\s\S]*?potek\.hidden = true;/,
  "nalaganje mora ostati v trenutnem koraku brez zaslona Rezultat preverbe");
assert.doesNotMatch(nalaganjeFunkcija, /nastaviRezultatKotOkno\(true\)/,
  "celozaslonsko okno se sme odpreti šele za pripravljen rezultat");
assert.match(preverbaJs, /nastaviRezultatKotOkno\(true\);\s*rezultat\.hidden = false;/);
assert.match(preverbaJs, /catch \(err\) \{\s*potek\.hidden = true;\s*nastaviRezultatKotOkno\(false\);/);
assert.match(preverbaJs, /nastaviRezultatKotOkno\(false\);\s*rezultat\.hidden = true;/);
assert.match(preverbaJs, /UJBonitetaIzberiTok\("soft"\)/);
assert.match(preverbaJs, /function pojdiEnBonitetniKorakNazaj\(\)[\s\S]*?boniteta-rezultat-je-okno[\s\S]*?boniteta-ponovi[\s\S]*?return true;/);
assert.match(preverbaJs, /window\.UJPoskusiNotranjiKorakNazaj = pojdiEnBonitetniKorakNazaj;/);
assert.match(navigacijaJs, /typeof window\.UJPoskusiNotranjiKorakNazaj === "function"[\s\S]*?window\.UJPoskusiNotranjiKorakNazaj\(\)[\s\S]*?return;/);
assert.match(centerJs, /fillSoftTestPreview\(\)[\s\S]*?UJBonitetaNastaviRezultatKotOkno\)window\.UJBonitetaNastaviRezultatKotOkno\(true\)/);
assert.match(centerJs, /selectedStartFlow==="crif"[\s\S]*?UJBonitetaNastaviRezultatKotOkno\(true\)/);
assert.match(html, /BONITETNA PREVERBA[\s\S]*?id="boniteta-identiteta-naslov"[\s\S]*?id="boniteta-podjetje-glava"[^>]*hidden/);
assert.match(html, /id="boniteta-podjetje-monogram"[\s\S]*?id="boniteta-podjetje-ime"[\s\S]*?id="boniteta-podjetje-preverjeno"/);
assert.match(html, /id="boniteta-podjetje-ime"[^>]*data-fit-text[^>]*data-fit-text-min="8"/,
  "daljse ime podjetja se mora prilagoditi znotraj kompaktne zdruzene glave");
assert.match(html, /class="boniteta-register-hero__ikona"[\s\S]*?<svg/);
assert.match(html, /id="boniteta-podjetje-pregled"[^>]*hidden[\s\S]*?id="boniteta-podjetje-podnaslov"[^>]*data-podjetje-pogled="kljucni"[\s\S]*?Pregled/);
assert.match(html, /id="boniteta-podjetje-ustanovitev"[^>]*hidden[\s\S]*?id="boniteta-podjetje-ustanovitev-datum"[\s\S]*?id="boniteta-podjetje-ustanovitev-starost"/,
  "North Data dopolnitev mora imeti poudarjen datum ustanovitve in starost podjetja");
assert.match(preverbaJs, /var skupnoMesecev =[\s\S]*?meseciEnota:[\s\S]*?poslovanja/,
  "starost podjetja mora prikazati dopolnjena leta in mesece");
assert.match(css, /\.boniteta-podjetje-ustanovitev__starost \{[\s\S]*?right: 38px;[\s\S]*?text-align: right;/,
  "leta in meseci morajo biti poravnani na desni strani ustanovitvene vrstice");
assert.doesNotMatch(html, /boniteta-podjetje-povzetek|Brez zaznanih opozoril/,
  "odvečni povzetek se ne sme ponavljati nad potrditvenim gumbom");
assert.doesNotMatch(preverbaJs, /podjetjePovzetek|boniteta-podjetje-povzetek/,
  "odstranjeni povzetek ne sme pustiti neuporabljene prikazne logike");
assert.match(html, /id="boniteta-podjetje-navigacija"[\s\S]*?data-podjetje-pogled="kljucni"[\s\S]*?data-podjetje-pogled="izstopa"[\s\S]*?data-podjetje-pogled="plus"[\s\S]*?<\/nav>[\s\S]*?id="boniteta-podjetje-pogledi"[\s\S]*?id="boniteta-podjetje-sekundarna-navigacija"[\s\S]*?data-podjetje-pogled="finance"[\s\S]*?data-podjetje-pogled="pot"[\s\S]*?data-podjetje-pogled="dodatno"/,
  "Pregled, Kaj izstopa in Plus morajo ostati nad podatki, spodnji trije sklopi pa v ločeni vrstici pod njimi");
assert.match(html, /data-podjetje-pogled="finance"[\s\S]*?<small[^>]*>Ni na voljo<\/small>/,
  "vsak podatkovni gumb mora imeti jasno stanje, ko informacije niso na voljo");
assert.doesNotMatch(html, /Več podatkov|Celoten pregled podjetja|boniteta-podjetje-podrobnosti-gumb/,
  "staro razkritje ne sme ostati poleg nove navigacije");
assert.match(html, /id="boniteta-identiteta-nadaljuj"[^>]*hidden[\s\S]*?Podatki so potrjeni\. Preverite še insolventnost\.[\s\S]*?Preveri insolventnost/);
assert.ok(
  html.indexOf('id="boniteta-identiteta-nadaljuj"') < html.indexOf('id="boniteta-podjetje-podnaslov"'),
  "potrditev in gumb za insolventnost morata biti v zgornji kartici pred ključnimi podatki"
);
var zgornjaKarticaCss = css.slice(css.lastIndexOf("Potrjena postavitev: povzetek podjetja"));
assert.match(zgornjaKarticaCss, /\.boniteta-identiteta-nadaljuj \{[\s\S]*?margin: 0 0 14px;[\s\S]*?border-radius: 0 0 20px 20px;/,
  "zgornji potrditveni del mora zaključiti prvo kompaktno kartico");
assert.match(css, /\.boniteta-podjetje-pregled \{[\s\S]*?border-radius: 20px;[\s\S]*?overflow: hidden;/,
  "vseh pet pogledov mora ostati v enem zaobljenem ovoju");
assert.match(zgornjaKarticaCss, /\.boniteta-podjetje-ustanovitev__ikona,[\s\S]*?\.boniteta-podjetje-kartica\.is-state-green[\s\S]*?\{[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;/,
  "ikone ključnih podatkov ne smejo biti v zelenih krogcih");
assert.match(css, /Za 24 % nizji uvod kljucnih podatkov:[\s\S]*?\.boniteta-podjetje-podnaslov \{[\s\S]*?min-height: 32px;[\s\S]*?\.boniteta-podjetje-ustanovitev \{[\s\S]*?height: 61px;[\s\S]*?min-height: 61px;/,
  "naslov in vrstica ustanovitve morata biti skupaj visoka 93 px oziroma približno 24 % manj");
/* Plačljive podrobne možnosti so odstranjene iz osnovnega rezultata. */
assert.doesNotMatch(html, /id="boniteta-krediti"/);
assert.doesNotMatch(html, /PODROBNI OPENREGISTER PODATKI/);
assert.doesNotMatch(html, /id="boniteta-razsiritve-odpri"/);
assert.doesNotMatch(html, /data-boniteta-razsiritev=/);
assert.doesNotMatch(html, /Dva povezana registrska sklopa[\s\S]*?20 kreditov/);
assert.match(css, /Koncna registrska mreza: 2 podatka zgoraj, 3 visji podatki spodaj/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-podatki--identiteta \{[\s\S]*?grid-template-columns: repeat\(6[\s\S]*?grid-template-rows: 118px 158px/);
assert.match(css, /\.boniteta-podjetje-kartica--datum \{[\s\S]*?grid-column: 1 \/ span 3;[\s\S]*?grid-row: 1;/);
assert.match(css, /\.boniteta-podjetje-kartica--sedez \{[\s\S]*?grid-column: 4 \/ span 3;[\s\S]*?grid-row: 1;/);
assert.match(css, /\.boniteta-podjetje-kartica--datum,[\s\S]*?\.boniteta-podjetje-kartica--sedez \{\s*align-items: flex-start;/,
  "zgornji kartici morata vsebino zasidrati na isti vrh");
assert.match(css, /\.boniteta-podjetje-kartica--datum \.boniteta-podjetje-kartica__vsebina,[\s\S]*?\.boniteta-podjetje-kartica--sedez \.boniteta-podjetje-kartica__vsebina \{[\s\S]*?grid-template-rows: 2\.32em auto;[\s\S]*?align-self: flex-start;/,
  "zgornji oznaki morata imeti fiksno vrstico, da se vrednosti začneta na isti liniji");
assert.match(css, /\.boniteta-podjetje-kartica--oblika \{[\s\S]*?grid-column: 1 \/ span 2;[\s\S]*?grid-row: 2;/);
assert.match(css, /\.boniteta-podjetje-kartica--register \{[\s\S]*?grid-column: 3 \/ span 2;[\s\S]*?grid-row: 2;/);
assert.match(css, /\.boniteta-podjetje-kartica--sodisce \{[\s\S]*?grid-column: 5 \/ span 2;[\s\S]*?grid-row: 2;/);
assert.match(css, /\.boniteta-podjetje-kartica__kljukica/);
assert.match(css, /\.boniteta-podjetje-kartica__kljukica \{[\s\S]*?width: 21px;[\s\S]*?height: 21px;[\s\S]*?font-size: \.78rem;/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card #boniteta-hwk-status\.boniteta-znacka--yellow::before \{[\s\S]*?content: "i";[\s\S]*?background: #fff3d5;/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card #boniteta-hwk-status\.boniteta-znacka--red::before \{[\s\S]*?content: "!";[\s\S]*?background: #fbe5e3;/);
assert.match(css, /\.boniteta-podjetje-kartica__grafika/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-podjetje-kartica__grafika \{\s*display: none;/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card #boniteta-identiteta-dokazilo-status \{\s*display: none !important;/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card #boniteta-hwk-vir \{\s*display: none !important;/);
assert.doesNotMatch(css, /repeating-linear-gradient\(90deg, transparent 0 20px/);
assert.match(preverbaJs, /function grafikaPodjetja\(vrsta\)/);
assert.match(css, /\.boniteta-krediti__graf span/);
assert.match(preverbaJs, /function izrisiRegistrskoPodjetje\(podatki, identiteta\)/);
assert.match(preverbaJs, /var ime = identiteta\.entityType === "company"[\s\S]*?identiteta\.naziv \|\| identiteta\.ime/,
  "kompaktni pregled družbe mora v glavi prikazati pravni naziv, ne imena zastopnika");
assert.match(preverbaJs, /function odgovorneOsebe\(company\)[\s\S]*?toLocaleLowerCase\("sl-SI"\)[\s\S]*?rezultat\.push\(\{ ime: ime, vloga: vloga \}\)/,
  "odgovorne osebe morajo biti očiščene in podvojeni zapisi združeni");
assert.match(preverbaJs, /function odgovorneOsebeIzIdentitete\(identiteta\)[\s\S]*?identiteta\.zastopniki[\s\S]*?identiteta\.nosilec[\s\S]*?rezultat\.push/,
  "kompaktni pregled mora prikazati vse zastopnike iz Impressuma tudi brez North Data");
assert.match(preverbaJs, /if \(!osebe\.length\) osebe = odgovorneOsebeIzIdentitete\(identiteta\)/);
assert.match(css, /\.boniteta-podatki--identiteta:not\(\.has-northdata\)\.has-responsible \.boniteta-podjetje-kartica--oseba \{[\s\S]*?grid-column: 1 \/ span 2;/,
  "zastopnik iz Impressuma mora imeti svoje mesto v kompaktni mreži");
assert.match(preverbaJs, /function povzetekOdgovornihOseb\(osebe\)[\s\S]*?osebe\.length === 2[\s\S]*?join\("\\n"\)[\s\S]*?dodatneOdgovorneOsebeBesedilo\(osebe\.length - 1\)/,
  "kartica mora prikazati dve imeni ali povzetek dodatnih oseb");
assert.match(preverbaJs, /function izrisiDodatno\(company, identiteta\)[\s\S]*?Povezana podjetja[\s\S]*?Dodatni identifikatorji[\s\S]*?Vodstvo in povezave/,
  "četrti pogled mora prikazati modularno vodstvo, povezana podjetja in identifikatorje");
assert.doesNotMatch(preverbaJs, /boniteta-dodatno__potrjeno/,
  "vrstice trenutnega vodstva ne smejo podvajati stanja z zelenimi kljukicami");
assert.match(preverbaJs, /var moduli = \[vodstvoHtml, povezaveHtml, identifikatorjiHtml\]\.filter\(Boolean\)[\s\S]*?moduli\.join\(""\)/,
  "manjkajoča kategorija se mora odstraniti, preostale kartice pa zložiti brez praznega mesta");
assert.match(preverbaJs, /Vodstvo podjetja[\s\S]*?Povezave podjetja[\s\S]*?Dodatni podatki podjetja/,
  "naslov dodatnega pogleda se mora prilagoditi dejansko prikazani modularni kartici");
assert.match(preverbaJs, /Prikaži še[\s\S]*?Skrij dodatne povezave/,
  "razširjeni seznam povezav mora jasno ponuditi tudi dejanje za zapiranje");
assert.match(centerJs, /get\("dodatno-test"\)\|\|"vse"[\s\S]*?variant==="vodstvo"[\s\S]*?variant==="povezave"[\s\S]*?variant==="identifikatorji"/,
  "TEST-predogled mora omogočati ločeno preverjanje vsake modularne kartice");
assert.match(centerJs, /variant!=="identifikatorji-en"[\s\S]*?leiCode:leiCode/,
  "identifikatorje je treba preveriti tudi v enostolpčni različici brez LEI");
assert.doesNotMatch(preverbaJs.slice(preverbaJs.indexOf("function izrisiDodatno"), preverbaJs.indexOf("function prilagodiPodjetjePogled")), /Preteklo vodstvo/,
  "preteklo vodstvo sodi v pogled Kaj izstopa in se v Dodatno ne sme podvajati");
assert.match(preverbaJs, /nevtralnaOsebaIkona[\s\S]*?<circle cx=\"16\" cy=\"10\" r=\"6\"\/>[\s\S]*?boniteta-dodatno__avatar/,
  "vodstvo mora uporabljati jasno spolno nevtralno ikono glave in ramen");
assert.match(preverbaJs, /Posodobljeno[\s\S]*?preverjenoBesedilo/,
  "datum dopolnilnih podatkov mora biti prikazan v diskretni nogi brez razkritja ponudnika");
var dodatniWidget = preverbaJs.slice(preverbaJs.indexOf("function izrisiDodatno"), preverbaJs.indexOf("function prilagodiPodjetjePogled"));
assert.doesNotMatch(dodatniWidget, /Predmet poslovanja|Registrski podatki|<dt>Register<\/dt>/,
  "četrti pogled ne sme podvajati dejavnosti ali registra iz ključnih podatkov");
assert.doesNotMatch(dodatniWidget, /Vodstvo ni isto kot lastništvo/,
  "odobreni kompaktni widget ne sme ohranjati stare razlagalne vrstice");
assert.match(preverbaJs, /karticaOseb\.setAttribute\("role", "button"\)[\s\S]*?nastaviPodjetjePogled\("dodatno"\)/,
  "kartica odgovornih oseb mora odpreti pogled Dodatno tudi s tipkovnico");
assert.match(css, /\.boniteta-podjetje-kartica--oseba dd\.is-multiple \{ white-space: pre-line; \}/,
  "dve odgovorni osebi morata ostati v dveh ločenih vrsticah");
assert.match(preverbaJs, /green: \{ znak: "✓"[\s\S]*?yellow: \{ znak: "i"[\s\S]*?red: \{ znak: "!"/,
  "delne statusne kartice morajo uporabljati miren informacijski znak in opozorilo");
assert.match(css, /\.is-state-yellow \.boniteta-podjetje-kartica__kljukica,[\s\S]*?\.is-state-red \.boniteta-podjetje-kartica__kljukica \{[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/,
  "rumeni in rdeči status ne smeta biti prikazana kot barvna kvadratka");
assert.match(css, /\.boniteta-podatki--identiteta\.is-state-yellow \{[\s\S]*?rgba\(43, 151, 145, \.035\)/,
  "nepotrjen rezultat mora ostati nevtralno turkizen, ne prelit z rumeno");
assert.match(css, /\.is-state-yellow \.boniteta-podjetje-kartica__ikona,[\s\S]*?\.is-state-red \.boniteta-podjetje-kartica__ikona \{[\s\S]*?color: #087f7b;/,
  "ikone ključnih podatkov morajo ostati čiste turkizne črte");
assert.match(preverbaJs, /function pravnaOblikaIzNaziva\(vrednost\)[\s\S]*?GmbH &[\s\S]*?var pravnaOblika = identiteta\.legalForm \|\| pravnaOblikaIzNaziva\(ime\)/,
  "pravno obliko je treba varno razbrati iz pravnega naziva tudi pri delnem starem rezultatu");
assert.match(preverbaJs, /OpenRegisterjev ključ, ki ga uporablja aplikacija, trenutno nima dostopa do API kvote[\s\S]*?North Data in insolvenčno preverbo/);
assert.match(preverbaJs, /data-fit-text-min="' \+ najmanjsaVelikost \+ '" data-fit-text-lines="' \+ najvecVrstic \+ '" data-fit-text-container="\.boniteta-podjetje-kartica"/,
  "kratke in dolge registrske vrednosti morajo ostati znotraj fiksnih polj");
assert.match(preverbaJs, /var jeKratkaVrednost = \["oblika", "register", "sodisce"\]\.includes\(vrsta\);[\s\S]*?vrsta === "dejavnost" \? "4" : vrsta === "sedez" \|\| vrsta === "oseba" \? "2"/,
  "dolga dejavnost in ime osebe morata ostati berljiva v svojem fiksnem okviru");
assert.match(preverbaJs, /<dt data-fit-text data-fit-text-min=\"6\">[\s\S]*?<small data-fit-text data-fit-text-min=\"6\">/,
  "kratke oznake in podnapisi morajo zmanjšati pisavo namesto preloma");
assert.match(css, /boniteta-podjetje-kartica--oblika dt,[\s\S]*?boniteta-podjetje-kartica--register dd,[\s\S]*?white-space: nowrap;/,
  "pravna oblika in register morata ostati v eni vrstici");
assert.match(html, /id="boniteta-podjetje-ime" data-fit-text data-fit-text-min="8"/,
  "daljše ime podjetja mora imeti dovoljeno samodejno zmanjšanje brez preloma");
assert.match(css, /boniteta-podjetje-glava__opis strong \{[\s\S]*?white-space: nowrap;/,
  "ime podjetja v glavi se ne sme lomiti med besedami");
assert.match(appJs, /data-fit-text-lines[\s\S]*?el\.scrollHeight <= visinaVrstice \* omejitevVrstic/,
  "samodejno prilagajanje mora preveriti tudi višino večvrstičnega besedila");
assert.match(appJs, /data-fit-text-container[\s\S]*?okvir\.scrollHeight <= okvir\.clientHeight/,
  "samodejno prilagajanje mora meriti celotno kartico z ikono in oznako");
assert.match(html, /app\.js\?v=20260819-container-fit-v5/);
assert.match(preverbaJs, /function zacetniciPodjetja\(ime\)[\s\S]*?function izrisiRegistrskoPodjetje\(podatki, identiteta\)/,
  "izris registrskega podjetja mora imeti vedno naložen izračun začetnic");
assert.match(preverbaJs, /async function nadaljujOpravilo\(jobId\) \{\s*var samoSpletniVnos = nacinVnosa === "spletna";/,
  "nadaljevanje shranjene preverbe mora samo določiti način vnosa");
assert.match(preverbaJs, /document\.body\.classList\.add\("boniteta-register-result"\)/);
assert.match(preverbaJs, /document\.body\.classList\.remove\("boniteta-register-result"\)/);
assert.match(preverbaJs, /else if \(\["probable_impressum", "confirmed_impressum"\]\.includes\(identiteta\.status\) && profil\.subjekt\) \{\s*window\.UJBonitetaPrikaziRegistrskoPodjetje\(podatki\);/,
  "rezultat iz Impressuma mora neposredno odpreti kompaktni pregled podjetja brez stare strani Rezultat preverbe");
assert.doesNotMatch(preverbaJs, /identitetaNaslov\.textContent = "Podatki iz Impressuma"/,
  "stara vmesna stran Podatki iz Impressuma ne sme ostati kot samostojen rezultat");
assert.match(css, /\.stran--bonitetna\.boniteta-register-result \.boniteta-rezultat-okno,[\s\S]*?\.boniteta-rezultat > \.boniteta-rezultat__glava \{\s*display: none !important;/);
assert.match(css, /\.stran--bonitetna\.boniteta-register-result \.boniteta-preverjeni-viri \{\s*display: none !important;/);
assert.match(css, /\.stran--bonitetna\.boniteta-register-result #boniteta-identiteta-posnetek \{\s*display: none !important;/,
  "posnetek Impressuma se na kompaktnem pregledu ne sme podvajati; ostane v koraku potrditve");
assert.match(css, /Potrjen rezultat: vizualno nadaljevanje prvega zaslona/);
assert.match(css, /\.stran--bonitetna\.boniteta-register-result #boniteta-rezultat \{[\s\S]*?border-radius: 0;/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-podatki--identiteta::before \{[\s\S]*?linear-gradient\(90deg, transparent 0%,[\s\S]*?42%[\s\S]*?58%[\s\S]*?transparent 100%/);
assert.match(css, /\.boniteta-podjetje-kartica--datum::after,[\s\S]*?linear-gradient\(180deg, transparent 0%,[\s\S]*?42%[\s\S]*?58%[\s\S]*?transparent 100%/);
assert.match(css, /\.boniteta-podatki--identiteta\.is-state-green \{[\s\S]*?radial-gradient\(ellipse 118% 105% at 50% 50%, rgba\(76, 183, 122, \.085\)/);
assert.match(css, /\.boniteta-podatki--identiteta\.is-state-yellow \{[\s\S]*?radial-gradient\(ellipse 118% 105% at 50% 50%, rgba\(226, 176, 62, \.08\)/);
assert.match(css, /\.boniteta-podatki--identiteta\.is-state-red \{[\s\S]*?radial-gradient\(ellipse 118% 105% at 50% 50%, rgba\(207, 91, 82, \.075\)/);
assert.match(css, /\.boniteta-podjetje-kartica\.is-state-green \{\s*background: transparent;/);
assert.match(css, /\.boniteta-podjetje-kartica dt \{[\s\S]*?font-size: \.58rem;/);
assert.match(css, /\.boniteta-podjetje-kartica dd \{[\s\S]*?font-size: \.84rem;/);
assert.match(css, /\.boniteta-podjetje-podrobnosti-gumb::before \{[\s\S]*?linear-gradient\(90deg, transparent 0%/);
assert.match(css, /Zdruzena Apple-like kartica: identiteta, osnovni podatki in razkritje so ena celota/);
assert.match(css, /\.stran--bonitetna\.boniteta-register-result,[\s\S]*?#boniteta-hwk-sklop\.is-register-card \{\s*background: #f5f5f7;/);
assert.match(css, /\.boniteta-rezultat__sklop-glava \{[\s\S]*?height: 127px;[\s\S]*?min-height: 127px;/);
assert.match(css, /\.boniteta-podjetje-glava \{[\s\S]*?top: 43px;[\s\S]*?min-height: 84px;[\s\S]*?border-radius: 20px 20px 0 0;/);
assert.match(css, /\.boniteta-podjetje-podnaslov \{[\s\S]*?margin: 0;[\s\S]*?border-right: 1px solid[\s\S]*?border-left: 1px solid/);
assert.match(css, /\.boniteta-podjetje-podnaslov::before \{[\s\S]*?linear-gradient\(90deg, transparent 0%/);
assert.match(css, /\.boniteta-podjetje-podnaslov \{[\s\S]*?background: linear-gradient\(180deg, rgba\(255, 255, 255, \.98\) 0%, rgba\(248, 252, 250, \.95\) 100%\)/,
  "naslovni del mora mehko preiti v statusno barvo brez trdega roba");
assert.match(css, /\.boniteta-podatki--identiteta::after \{[\s\S]*?linear-gradient\(180deg, rgba\(255, 255, 255, \.86\) 0%[\s\S]*?transparent 16%[\s\S]*?transparent 82%[\s\S]*?rgba\(255, 255, 255, \.88\) 100%\)/,
  "statusni gradient mora na zgornjem in spodnjem robu zbledeti v belo");
assert.match(css, /\.boniteta-podatki--identiteta \{[\s\S]*?grid-template-rows: 110px 146px;[\s\S]*?border-radius: 0;/);
assert.match(css, /\.boniteta-podjetje-podrobnosti-gumb \{[\s\S]*?border-radius: 0 0 20px 20px;/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-identiteta-nadaljuj__vsebina b \{[\s\S]*?background: linear-gradient/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-identiteta-nadaljuj \{[\s\S]*?gap: 5px 8px;[\s\S]*?padding: 11px 12px 10px;/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-identiteta-nadaljuj__vsebina b \{[\s\S]*?min-height: 42px;[\s\S]*?margin-top: 8px;/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-podjetje-glava__opis span \{[\s\S]*?white-space: normal;/);
assert.match(html, /id="boniteta-insolvenca-okno"[^>]*hidden[\s\S]*?id="boniteta-insolvenca-nazaj"[\s\S]*?id="boniteta-potrditev-identitete"[\s\S]*?id="boniteta-insolvenca-sklop"/);
assert.match(preverbaJs, /function nastaviInsolvencnoOkno\(odprto, rezultatPripravljen\)[\s\S]*?boniteta-insolvenca-je-okno[\s\S]*?insolvencaSklop\.hidden = !rezultatPripravljen/);
assert.match(preverbaJs, /function pripraviOpenRegisterTestnoPotrditev\(\)[\s\S]*?testPreviewSource !== "openregister"[\s\S]*?boniteta-potrdi-ime[\s\S]*?OPEN Testbau GmbH[\s\S]*?potrditevIdentitete\.hidden = false/);
assert.match(preverbaJs, /identitetaNadaljuj\.addEventListener\("click"[\s\S]*?if \(zadnjiInsolvencniRezultatPripravljen\) return;[\s\S]*?pripraviOpenRegisterTestnoPotrditev\(\)[\s\S]*?nastaviInsolvencnoOkno\(true, false\)/);
assert.match(preverbaJs, /jeOpenRegisterTestniPredogled[\s\S]*?nastaviKarticoInsolvenceZakljuceno[\s\S]*?nastaviInsolvencnoOkno\(true, true\)/);
assert.match(preverbaJs, /if \(nadaljujVInsolvencnemOknu\) \{[\s\S]*?nastaviInsolvencnoOkno\(true, zadnjiInsolvencniRezultatPripravljen\)/,
  "zaključena insolvenčna preverba mora ostati v istem dvokoračnem toku");
assert.match(preverbaJs, /Rezultat preverbe[\s\S]*?Preverili smo potrjeno identiteto podjetja\./);
assert.match(html, /id="boniteta-insolvenca-nazaj-spodaj"[^>]*>Nazaj na podatke podjetja<\/button>/);
assert.match(preverbaJs, /function nazajNaPodatkePodjetja\(\)[\s\S]*?insolvencaNazajSpodaj[\s\S]*?nazajNaPodatkePodjetja/);
assert.match(css, /\.boniteta-insolvenca-okno__nazaj-spodaj \{[\s\S]*?min-height: 52px;[\s\S]*?border: 1px solid #168b8c;/);
assert.match(preverbaJs, /function nastaviKarticoInsolvenceZakljuceno\(podatki\)[\s\S]*?identitetaNadaljuj\.disabled = true[\s\S]*?INSOLVENČNOST PREVERJENA[\s\S]*?REZULTAT/);
assert.match(preverbaJs, /!rezultatPripravljen && potrditevIdentitete && potrditevIdentitete\.hidden[\s\S]*?Podatki za potrditev niso bili pripravljeni/);
assert.match(preverbaJs, /identitetaNadaljuj && \(podatki\.confirmationRequired \|\| zadnjiInsolvencniRezultatPripravljen\)[\s\S]*?identitetaNadaljuj\.hidden = false/);
assert.match(preverbaJs, /potrditevGumb\.addEventListener\("click"[\s\S]*?confirmedIdentity[\s\S]*?izvediPrekoCakalneVrste/);
assert.match(html, /id="boniteta-potrditev-dokaz"[^>]*hidden[\s\S]*?id="boniteta-potrditev-dokaz-slika"[\s\S]*?id="boniteta-potrditev-identitete"/);
assert.match(html, /id="boniteta-potrditev-api-dokaz"[^>]*hidden[\s\S]*?OpenRegister API[\s\S]*?id="boniteta-potrditev-api-dokaz-register"/);
assert.match(html, /1\. KORAK · POTRDITEV PODATKOV[\s\S]*?Podatki so pravilni[\s\S]*?id="boniteta-potrditev-gumb"[^>]*disabled>Preveri insolventnost/);
assert.match(html, /id="boniteta-insolvenca-izid-ikona"[\s\S]*?id="boniteta-insolvenca-status"[\s\S]*?id="boniteta-insolvenca-posnetek"[\s\S]*?<h3>Uporabljeni iskalni podatki<\/h3>/,
  "drugi korak mora prikazati izid, uradni posnetek in nato uporabljene iskalne podatke");
assert.match(html, /<figcaption>[\s\S]*?<strong>Uradni insolvenčni register<\/strong>[\s\S]*?data-posnetek-pomanjsaj[\s\S]*?<output data-posnetek-stopnja[\s\S]*?data-posnetek-povecaj[\s\S]*?<\/figcaption>/,
  "spodnja vrstica posnetka mora vsebovati oznako vira in kompaktne kontrolnike povečave");
assert.doesNotMatch(html, /boniteta-insolvenca-prenos|Odpri posnetek ↗/,
  "ločena povezava za odpiranje posnetka ne sme podvajati kontrolnikov povečave");
assert.match(html, /id="boniteta-identiteta-posnetek"[\s\S]*?<figcaption>[\s\S]*?<strong>Posnetek uporabljenega vira<\/strong>[\s\S]*?data-posnetek-pomanjsaj[\s\S]*?<output data-posnetek-stopnja[\s\S]*?data-posnetek-povecaj[\s\S]*?<\/figcaption>/,
  "tudi posnetek Impressuma mora uporabljati spodnjo kompaktno zoom vrstico");
assert.doesNotMatch(html, /boniteta-identiteta-prenos|Prenesi posnetek/,
  "ločeni prenos posnetka Impressuma ne sme podvajati povečave");
assert.match(html, /Barva povezuje podatek z uradnim posnetkom\./,
  "barvna povezava med karticami in označbami mora ostati razložena");
assert.match(preverbaJs, /var oznaceniToni = [\s\S]*?screenshotAnnotation\.highlightedTones[\s\S]*?var prikazaniToni = \{[\s\S]*?blue: Boolean\(imaBarvniDokaz && oznaceniToni\.includes\("blue"\) && imeIzObrazca\)[\s\S]*?green: Boolean\(imaBarvniDokaz && oznaceniToni\.includes\("green"\)[\s\S]*?violet: Boolean\(imaBarvniDokaz && oznaceniToni\.includes\("violet"\) && registerIzObrazca\)[\s\S]*?amber: Boolean\(imaBarvniDokaz && oznaceniToni\.includes\("amber"\) && zadevaIzObrazca\)/,
  "barva kartice mora obstajati samo za polje, ki je dejansko označeno na uradnem posnetku");
assert.match(preverbaJs, /Register", registerIzObrazca \|\| uradnaPotrditev\.searchedRegister, prikazaniToni\.violet \? "violet" : "neutral"/,
  "rezervni registrski podatek brez vijolične oznake na posnetku mora ostati bel");
assert.match(preverbaJs, /Zadeva", zadevaIzObrazca \|\| uradnaPotrditev\.searchedCaseNumber, prikazaniToni\.amber \? "amber" : "neutral"/,
  "rezervna opravilna številka brez rumene oznake na posnetku mora ostati bela");
assert.match(preverbaJs, /Ni najdenih insolvenčnih objav[\s\S]*?Za preverjene iskalne podatke v uradnem insolvenčnem registru ni bila najdena objava\./,
  "čist rezultat mora opisati le izid poizvedbe, ne pa potrjevati identitete ali plačilne sposobnosti");
assert.match(preverbaJs, /imaWildcardIme[\s\S]*?Iskalni niz podjetja[\s\S]*?Potrjeno pravno ime/,
  "wildcard mora biti označen kot iskalni niz in ločen od potrjenega pravnega imena");
assert.doesNotMatch(preverbaJs, /Insolvenčnost je preverjena\./,
  "insolvenčna poizvedba se ne sme predstavljati kot splošna potrditev insolventnosti");
assert.match(css, /#boniteta-insolvenca-posnetek \.boniteta-posnetek-povecava__orodja,[\s\S]*?#boniteta-identiteta-posnetek \.boniteta-posnetek-povecava__orodja \{[\s\S]*?display: flex;/,
  "oba uradna posnetka morata vedno prikazati kontrolnike povečave");
assert.match(css, /#boniteta-insolvenca-posnetek figcaption \.boniteta-posnetek-povecava__orodja,[\s\S]*?#boniteta-identiteta-posnetek figcaption \.boniteta-posnetek-povecava__orodja \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1 \/ span 2;[\s\S]*?background: transparent;/,
  "kontrolniki povečave obeh dokazil morajo biti v enaki razširjeni spodnji vrstici");
assert.match(html, /id="boniteta-potrditev-dokaz"[^>]*hidden[\s\S]*?data-posnetek-povecava[\s\S]*?aria-label="Povečava posnetka Impressuma"[\s\S]*?data-posnetek-povecaj/,
  "posnetek Impressuma mora imeti enako spodnjo povečavo kot insolvenčni posnetek");
assert.match(css, /\.boniteta-potrditev-dokaz figcaption \.boniteta-posnetek-povecava__orodja \{[\s\S]*?justify-self: end;[\s\S]*?background: transparent;/,
  "povečava Impressuma mora biti poravnana desno v spodnji vrstici");
assert.match(css, /@media \(max-width: 699px\) \{[\s\S]*?\.boniteta-potrditev-dokaz__okno \{ height: clamp\(104px, 29vw, 126px\); min-height: 104px/,
  "mobilni dokazni posnetek mora biti dovolj nizek, da ostane obrazec v istem vidnem kontekstu");
assert.match(css, /@media \(max-width: 699px\) \{[\s\S]*?\.boniteta-potrditev-identitete input\[type="text"\] \{[\s\S]*?min-height: 36px/,
  "mobilna potrditvena polja morajo uporabljati kompaktno višino");
assert.match(html, /bonitetna-preverba\.css\?v=20260825-confirmation-actions-v77/,
  "nova kompaktna postavitev mora obiti stari predpomnjeni CSS");
assert.match(html, /boniteta-potrditev-identitete__akcije[\s\S]*?id="boniteta-potrdi-checkbox"[\s\S]*?id="boniteta-potrditev-gumb"/,
  "potrditev podatkov in zagon insolvenčne preverbe morata biti v skupni akcijski vrstici");
assert.match(css, /\.boniteta-potrditev-identitete__akcije \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(118px, \.72fr\)/,
  "skupna akcijska vrstica mora imeti levi potrditveni in desni izvedbeni del");
assert.match(css, /\.boniteta-potrditev-identitete__akcije > \.boniteta-potrditev-identitete__gumb \{[\s\S]*?white-space: normal;[\s\S]*?line-height: 1\.12/,
  "napis Preveri insolventnost se mora v desnem delu prelomiti v dve vrstici");
assert.match(preverbaJs, /var obsegOrodij = pregledovalnik\.closest\("figure"\) \|\| pregledovalnik;[\s\S]*?if \(prilagodi\) prilagodi\.addEventListener/,
  "povečava mora podpirati spodnje kontrolnike brez obveznega gumba Prilagodi");
assert.match(css, /#boniteta-insolvenca-posnetek \.boniteta-posnetek-povecava__okno \{[\s\S]*?height: clamp\(210px, 30dvh, 258px\);[\s\S]*?overflow: auto;[\s\S]*?touch-action: pan-x pan-y;/,
  "povečan uradni posnetek mora omogočiti vodoravno in navpično pomikanje");
assert.doesNotMatch(css, /#boniteta-insolvenca-posnetek \.boniteta-posnetek-povecava__okno img \{[\s\S]*?width: 100% !important;/,
  "fiksna pomembna širina ne sme preprečiti uporabnikove povečave");
assert.match(css, /#boniteta-insolvenca-podatki \.boniteta-podatek dd \{[\s\S]*?overflow-wrap: anywhere;[\s\S]*?-webkit-line-clamp: 3;/,
  "daljša preverjena besedila ne smejo prekrivati kartic");
assert.match(preverbaJs, /function posodobiPotrditevIdentitete\(\)[\s\S]*?potrjenoInVeljavno[\s\S]*?polje\.readOnly = potrjenoInVeljavno[\s\S]*?potrditevGumb\.disabled = !potrjenoInVeljavno/);
assert.match(preverbaJs, /apiDokaziloIdentitetePripravljeno[\s\S]*?evidenceKind === "structured_api"[\s\S]*?potrditevDokaziloPripravljeno = true/);
assert.match(preverbaJs, /Brez preverljivega uradnega dokaza identitete insolvenčne poizvedbe ni mogoče izvesti/);
assert.doesNotMatch(preverbaJs, /Brez prikazljivega posnetka uporabljenega vira insolvenčne poizvedbe ni mogoče izvesti/);
assert.match(preverbaJs, /posnetekIdentitetePrikazljiv[\s\S]*?potrditevDokaziloPripravljeno = true[\s\S]*?potrditevDokazSlika\.src/);
assert.match(css, /\.boniteta-potrditev-api-dokaz \{[\s\S]*?border-radius: 19px;[\s\S]*?\.boniteta-potrditev-api-dokaz__mreza/);
assert.match(css, /\.boniteta-potrditev-identitete\.is-confirmed input\[type="text"\][\s\S]*?font-weight: 750/);
assert.match(css, /\.boniteta-potrditev-identitete\.is-confirmed \.boniteta-potrditev-identitete__potrditev-ikona[\s\S]*?background: #19ac60/);
assert.doesNotMatch(html, /boniteta-podjetje-vpis|Vpis v register/);
assert.doesNotMatch(preverbaJs, /podjetjeVpis/);
assert.doesNotMatch(preverbaJs, /function opisDatumaVpisa\(vrednost\)/);
assert.doesNotMatch(css, /boniteta-podjetje-vpis/);
assert.match(html, /id="boniteta-podjetje-kljucni"[^>]*role="tabpanel"[\s\S]*?id="boniteta-hwk-podatki"[\s\S]*?id="boniteta-podjetje-podrobnosti"[^>]*role="tabpanel"[^>]*hidden/);
assert.match(preverbaJs, /function nastaviPodjetjePogled\(pogled, fokus\)[\s\S]*?podjetjeKljucni\.hidden = !kljucni[\s\S]*?podjetjePodrobnosti\.hidden = kljucni/,
  "klik mora zamenjati osrednjo vsebino, ne dodati nove kartice pod njo");
assert.match(preverbaJs, /function financnaSerija\(company, vrsta\)[\s\S]*?company\.financials[\s\S]*?company\.balanceSheets/);
assert.match(preverbaJs, /function izrisiFinance[\s\S]*?Poslovni rezultat[\s\S]*?Bilančna vsota/);
assert.match(preverbaJs, /function izrisiFinance\(company, vrsta\)[\s\S]*?rezultat\.length \? "earnings" : sredstva\.length \? "assets"[\s\S]*?var serija = izbrana === "assets" \? sredstva : rezultat/,
  "če North Data vrne samo Total assets, se mora samodejno odpreti Bilančna vsota");
assert.match(preverbaJs, /function financeGumb\([\s\S]*?disabled aria-disabled="true" title="Ta časovnica ni objavljena"[\s\S]*?<small>Ni na voljo<\/small>/,
  "manjkajoč finančni kazalnik mora biti jasno označen in neklikljiv");
assert.match(preverbaJs, /sredstva\.length && !rezultat\.length[\s\S]*?Objavljena je bilančna vsota; časovnica poslovnega rezultata ni na voljo\./,
  "ob samo bilančni vsoti mora uporabnik dobiti jasno razlago, ne praznega grafa");
assert.match(preverbaJs, /if \(!gumb\.disabled\) gumb\.addEventListener/,
  "onemogočen finančni kazalnik ne sme dobiti klika");
assert.match(preverbaJs, /if \(pogled === "finance"\) izrisiFinance\(company\);/,
  "prvi vstop v Finance ne sme na silo izbrati praznega poslovnega rezultata");
assert.match(preverbaJs, /function izrisiPlus\(\)[\s\S]*?dopolnilniVpogledHtml\(northDataPodrobnosti\(zadnjiRegistrskiPodatki\)\)[\s\S]*?pogled === "plus"\) izrisiPlus\(\)/,
  "dopolnilni finančni podatki morajo imeti lasten pogled Plus");
assert.match(preverbaJs, /function izrisiPot[\s\S]*?function izrisiIzstopa[\s\S]*?function izrisiDodatno/);
assert.match(preverbaJs, /function vrstaDogodkaPoti[\s\S]*?capital[\s\S]*?leadership[\s\S]*?finance[\s\S]*?foundation/,
  "Pot podjetja mora dogodke razvrstiti glede na dejansko vrsto zapisa");
assert.match(preverbaJs, /function izrisiPot[\s\S]*?datumOsebe\(oseba, status\) === datum[\s\S]*?boniteta-pot__drsnik[\s\S]*?Dogodki temeljijo na razpoložljivih registrskih podatkih/,
  "časovnica mora povezati osebe z datumom dogodka, drseti v lastnem okvirju in prikazati nevtralno pojasnilo vira");
assert.match(preverbaJs, /var razredOseb = osebe \? " has-people"[\s\S]*?<\/div>' \+ osebe \+ '<\/article>'/,
  "osebe morajo biti samostojna vrstica kartice in ne stisnjene v stolpec ob ikoni");
assert.match(grafikeCss, /\.boniteta-pot__osebe \{ grid-column:2;[\s\S]*?\.boniteta-pot__osebe strong \{ grid-column:1; grid-row:1;[\s\S]*?overflow:visible/,
  "ime osebe mora biti poravnano z letom in naslovom ter ostati celo");
assert.match(preverbaJs, /boniteta-pot__osebe[\s\S]*?data-fit-text data-fit-text-min="7"/,
  "daljša imena oseb se morajo samodejno prilagoditi širini kartice");
assert.match(preverbaJs, /function obdobjePoDogodkuHtml\(tocka, indeks\)[\s\S]*?meseci <= 12 \? 1[\s\S]*?boniteta-pot__obdobje[\s\S]*?obdobjePoDogodkuHtml\(tocka, indeks\)/,
  "časovnica mora med dogodki prikazati obdobje in več črtic pri daljšem časovnem razmiku");
assert.match(grafikeCss, /\.boniteta-pot__obdobje \{[\s\S]*?top:108px[\s\S]*?\.boniteta-pot__obdobje i b \{[\s\S]*?height:6px/,
  "časovne oznake in črtice morajo biti vezane neposredno na nosilno črto");
assert.match(grafikeCss, /data-pogled="pot"\] \.boniteta-podjetje-podrobnosti,[\s\S]*?data-pogled="finance"\] \.boniteta-podjetje-podrobnosti,[\s\S]*?data-pogled="plus"\] \.boniteta-podjetje-podrobnosti \{[\s\S]*?radial-gradient\(ellipse 112% 76% at -12% 92%[\s\S]*?linear-gradient\(145deg,#faf9f5 0%,#f7fbf8 48%,#eef9f6 100%\)/,
  "celotno ozadje poti, financ in pogleda Plus mora uporabljati enak nežen kremno-mint mesh preliv");
assert.match(grafikeCss, /data-pogled="finance"\] \.boniteta-podjetje-podrobnosti \{ min-height:0; padding-bottom:14px; --boniteta-finance-odmik:18px; \}[\s\S]*?\.boniteta-finance__graf \{[\s\S]*?display:block;[\s\S]*?width:calc\(100% \+ var\(--boniteta-finance-odmik\) \+ var\(--boniteta-finance-odmik\)\)[\s\S]*?height: 248px;[\s\S]*?\.boniteta-finance__merilo \{[\s\S]*?position:absolute[\s\S]*?height:248px[\s\S]*?\.boniteta-finance__drsnik \{ width:100%; \}[\s\S]*?\.boniteta-finance__stolpec \{ bottom: 119px;[\s\S]*?\.boniteta-finance__leto > small \{ bottom: 50px;[\s\S]*?\.boniteta-finance__leto > strong \{ bottom: 32px;/,
  "finančni graf se mora swajpati do dejanskih robov widgeta, merilo pa mora ostati fiksno");
assert.match(preverbaJs, /var skupinePoDatumu = \[\][\s\S]*?zadnjaSkupina\.date === tocka\.date[\s\S]*?zadnjaSkupina\.items\.push\(tocka\)[\s\S]*?is-grouped/,
  "dogodki z istim datumom morajo uporabljati eno skupno časovno točko");
assert.match(preverbaJs, /is-grouped has-top has-bottom[\s\S]*?posameznaKartica\(zapisi\[0\], "top"[\s\S]*?posameznaKartica\(zapisi\[1\], "bottom"/,
  "pri dveh dogodkih na isti datum mora biti ena manjša kartica nad in druga pod skupno točko");
assert.doesNotMatch(preverbaJs, /Dogodki so povzeti iz North Data/,
  "v uporabniškem pogledu časovnice ne smemo razkriti dopolnilnega ponudnika");
assert.match(preverbaJs, /function scenarijIzstopa\(serija, vrsta\)[\s\S]*?Prehod v izgubo[\s\S]*?Povratek v dobiček[\s\S]*?Izguba se zmanjšuje[\s\S]*?Rezultat se izboljšuje/,
  "Kaj izstopa mora iz podatkov prepoznati različne finančne scenarije");
assert.match(preverbaJs, /function polozajDogodkaNaGrafu\(dogodek, serija\)[\s\S]*?Date\.UTC[\s\S]*?datum < zacetek \|\| datum > konec/,
  "marker vodstva mora biti izračunan iz dejanskega datuma in primerjalnega obdobja");
assert.match(preverbaJs, /osnovnaVrsta = rezultat\.length >= 2 \? "earnings" : sredstva\.length >= 2 \? "assets"[\s\S]*?spodnjeKartice\.length === 1[\s\S]*?Za zanesljiv povzetek še ni dovolj primerljivih podatkov/,
  "povzetek mora preklopiti na bilančno vsoto, eno kartico ali pošteno prazno stanje");
assert.match(preverbaJs, /pointerdown[\s\S]*?pointerup[\s\S]*?Math\.abs\(dx\) < 48/,
  "vodoravni swipe mora preklopiti isti izbrani pogled");
assert.match(css, /\.boniteta-finance__drsnik \{[\s\S]*?touch-action: pan-x pan-y;/,
  "finančni drsnik mora dovoliti vodoravni swipe in navpično drsenje strani");
assert.match(grafikeCss, /\.boniteta-pot__drsnik \{[^}]*touch-action:pan-x pan-y;/,
  "časovnica mora dovoliti vodoravni swipe in navpično drsenje strani");
assert.doesNotMatch(preverbaJs, /Vir dopolnitve|North Data prek Apify/,
  "dopolnilnega ponudnika ne smemo razkriti v uporabniškem pogledu");
assert.match(centerJs, /companyId:"DE-HRB-F1103-123456"[\s\S]*?purpose:"Načrtovanje in izvedba gradbenih ter tehničnih projektov\."[\s\S]*?source:"openregister"/);
assert.match(grafikeCss, /boniteta-podjetje-navigacija--glavna[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)[\s\S]*?boniteta-podjetje-navigacija--sekundarna[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
  "meni mora imeti tri enake gumbe zgoraj in tri enake gumbe spodaj");
assert.match(css, /\.boniteta-podjetje-navigacija button\.is-active::before \{[\s\S]*?linear-gradient/);
assert.match(css, /\.boniteta-finance__drsnik \{[\s\S]*?overflow-x: auto/);
assert.match(css, /\.boniteta-finance__stolpec \{[\s\S]*?grid-template-rows: repeat\(var\(--segment-count\)[\s\S]*?width: 32px/);
assert.match(preverbaJs, /data-segment-tone="' \+ tonSegmenta \+ '"/,
  "vsak finančni segment mora dobiti položajno določeno barvno stopnjo");
assert.match(css, /\.boniteta-finance__stolpec i \{[\s\S]*?opacity: 1;[\s\S]*?background-image: none;/,
  "segmenti morajo biti polno obarvani brez opacity ali gradientnega bledenja");
assert.match(css, /data-segment-tone="0"\] \{ background-color: #45b8ae; \}[\s\S]*?data-segment-tone="3"\] \{ background-color: #087a78; \}/,
  "pozitivni segmenti morajo uporabljati potrjeno turkizno paleto od vrha proti dnu");
assert.match(css, /is-negative[\s\S]*?data-segment-tone="0"\] \{ background-color: #d64545; \}[\s\S]*?data-segment-tone="3"\] \{ background-color: #f19a95; \}/,
  "negativni segmenti morajo uporabljati enakovredno solidno rdečo paleto");
assert.doesNotMatch(css, /boniteta-finance__stolpec i:nth-child\([^)]*\) \{ opacity:/,
  "stari opacity fade ne sme več določati finančnih segmentov");
assert.match(css, /\.boniteta-finance__odstotek \{[\s\S]*?border-radius: 999px/);
assert.match(grafikeCss, /\.boniteta-finance__odstotek \{[^}]*bottom:calc\(160px \+ var\(--bar-size\) \+ 7px\)[^}]*\}[\s\S]*?\.boniteta-finance__leto\.is-negative \.boniteta-finance__odstotek \{ bottom:165px; \}/,
  "odstotek mora biti nad pripadajočim pozitivnim ali negativnim stolpcem");
assert.match(grafikeCss, /\.boniteta-pot__drsnik \{[\s\S]*?overflow-x:auto[\s\S]*?\.boniteta-pot-podjetja \{[\s\S]*?width:max-content/,
  "drsni okvir mora biti ločen od vsebine vodoravne časovnice");
assert.match(grafikeCss, /\.boniteta-pot-podjetja::before \{[\s\S]*?display:block[\s\S]*?\.boniteta-pot-podjetja li \{[\s\S]*?scroll-snap-align:start/,
  "nosilna črta mora ostati vidna tudi v širokem oknu, kartica pa se mora poravnati cela na začetek drsnika");
assert.match(grafikeCss, /container-type:inline-size[\s\S]*?width:clamp\(150px,calc\(\(100cqw - 22px\)\/2\),174px\)[\s\S]*?scroll-snap-stop:always/,
  "časovne kartice morajo biti dovolj široke za berljiv tekst in ostati zanesljivo poravnane pri drsenju");
assert.doesNotMatch(grafikeCss, /\.boniteta-pot-podjetja li:nth-child\(even\)/,
  "položaj kartice mora določiti logika dogodka, ne slepi CSS vrstni red");
assert.match(preverbaJs, /detailedChecksAvailable/);
assert.doesNotMatch(html, /NAŠ SISTEM \+ OPENREGISTER · 1 KREDIT/);
assert.doesNotMatch(html, /boniteta-vkljuceno|boniteta-osnovni-kazalniki|Podatki, vključeni v osnovno iskanje/);
assert.doesNotMatch(preverbaJs, /osnovniKazalniki/);
assert.match(preverbaJs, /dejavnost: '<svg[\s\S]*?function stanjeKarticePodjetja/);
assert.match(preverbaJs, /function stanjeKarticePodjetja\(podatki, identiteta, vrsta, vrednost\)[\s\S]*?lokacija\.status === "mismatch"[\s\S]*?return "red"[\s\S]*?\["verified_register", "confirmed_impressum"\]\.includes\(identiteta\.status\)[\s\S]*?return "green"[\s\S]*?return "yellow"/);
assert.match(preverbaJs, /var stanjeMreze = vsaStanja\.includes\("red"\) \? "red" : vsaStanja\.includes\("yellow"\) \? "yellow" : "green";[\s\S]*?hwkPodatki\.classList\.add\("is-state-" \+ stanjeMreze\)/);
assert.match(preverbaJs, /dodajSkupinoKljucnihPodatkov\("seznam", "Podatki"\)[\s\S]*?dodajKarticoPodjetja\(podatkiSeznam, "sedez", "Sedež"[\s\S]*?dodajKarticoPodjetja\(podatkiSeznam, "dejavnost", "Dejavnost"[\s\S]*?dodajKarticoPodjetja\(podatkiSeznam, "register", "Register"/,
  "ključni podatki morajo biti združeni v en kompakten seznam brez kartic znotraj kartic");
assert.match(html, /id="boniteta-insolvenca-sklop"[^>]*hidden/);
assert.ok(html.indexOf('id="boniteta-insolvenca-sklop"') < html.indexOf('class="boniteta-rezultat__sklop boniteta-preverjeni-viri"'), "dokazni viri morajo slediti osnovnemu rezultatu");
assert.match(html, /id="boniteta-razsiritve" hidden/);
assert.doesNotMatch(html, /id="boniteta-razsiritve-moznosti"/);
assert.match(preverbaJs, /function nastaviRazsiritveOdprte\(odprto\)/);
assert.match(css, /\.boniteta-razsiritve__moznosti\[hidden\] \{ display: none !important; \}/);
assert.match(html, /id="boniteta-barvna-primerjava-namig"[^>]*hidden/);
assert.match(html, /id="boniteta-metodologija"[^>]*hidden[\s\S]*?4 koraki do rezultata/);
assert.match(html, /data-metodologija-korak="identity"[\s\S]*?data-metodologija-korak="location"[\s\S]*?data-metodologija-korak="query"[\s\S]*?data-metodologija-korak="evidence"/);
assert.match(preverbaJs, /function izrisiMetodologijo\(podatki\)/);
assert.match(preverbaJs, /var shranjeniNorthData = shranjeno\.profile\.latest_check && shranjeno\.profile\.latest_check\.northData/,
  "glavni rezultat mora po shranjevanju prevzeti obstoječe North Data podatke profila");
assert.match(preverbaJs, /podatki\.northData = shranjeniNorthData;[\s\S]*?izrisiRegistrskoPodjetje\(podatki, identiteta\)/,
  "finančni widget se mora po obnovi North Data podatkov ponovno izrisati");
assert.match(preverbaJs, /uradno\.evidenceStatus === "captured"[\s\S]*?uradno\.status === "clear"/);
assert.match(centerJs, /function fillTestMethodology\(\)/);
assert.match(centerJs, /function fillCompanyCardTestPreview\(\)[\s\S]*?UJBonitetaPrikaziRegistrskoPodjetje/);
assert.match(centerJs, /finalizeOpenRegisterTestPreview\(\);fillCompanyCardTestPreview\(\);[\s\S]*?prepareProTestPreview\(\)/);
assert.match(css, /\.boniteta-metodologija__koraki[\s\S]*?grid-template-columns: repeat\(4/);
assert.match(css, /@media \(max-width: 430px\)[\s\S]*?\.boniteta-metodologija__koraki \{ grid-template-columns: repeat\(2/);
assert.match(html, /data-primerjava-ton="blue"[^>]*>Ime podjetja</);
assert.match(preverbaJs, /screenshotAnnotation\.status === "applied"/);
assert.match(preverbaJs, /var oznakaImena = jeIskanaOseba[\s\S]*?"Ime in priimek"[\s\S]*?"Ime podjetja"/);
assert.match(preverbaJs, /if \(ton === "blue"\) znacka\.textContent = oznakaImena/);
assert.match(preverbaJs, /dodajPodatek\(insolvencaPodatki, oznakaImena, prikazanoIskalnoIme, prikazaniToni\.blue \? "blue" : "neutral"/);
assert.match(apiHandlerJs, /\["firmaPriimek", "blue"\], \["ime", "blue"\]/,
  "priimek in Vorname morata uporabljati isti moder ton");
assert.match(apiHandlerJs, /function najdiUradnoPolje\(kljuc\)[\s\S]*?document\.getElementById\(selektor\)/,
  "Vorname mora dobiti moder okvir tudi, ko je uradno polje dosegljivo samo prek ID-ja");
assert.match(apiHandlerJs, /official-insolvency-v9-highlighted-tones/,
  "nova oznaka mora ustvariti novo različico uradnega dokazila");
assert.match(css, /\.boniteta-podatek--blue[\s\S]*?--podatek-pika: #2f70d6/);
assert.match(css, /\.boniteta-podatek--green[\s\S]*?--podatek-pika: #2d8a68/);
assert.match(css, /\.boniteta-podatek--violet[\s\S]*?--podatek-pika: #7657bd/);
assert.match(css, /\.boniteta-podatek--amber[\s\S]*?--podatek-pika: #b8751d/);
assert.match(html, /id="boniteta-spletna-rezerva"[^>]*hidden/);
assert.match(html, /Slikaj[\s\S]*?Račun ali ponudbo[\s\S]*?Uvozi PDF[\s\S]*?Vnesi ročno/);
assert.match(preverbaJs, /function nastaviSpletnoRezervo\(prikazi, opis, razlog\)/);
assert.match(preverbaJs, /function jeNeuspesnaSpletnaIdentifikacija\(podatki\)[\s\S]*?identity\.status === "unresolved"/);
assert.match(preverbaJs, /var uradniCompanyId = identiteta\.companyId \|\| podatki\.identityEvidence && podatki\.identityEvidence\.companyId \|\| ""/);
assert.match(preverbaJs, /registerCourt: uradniCompanyId \? identiteta\.registerCourt/,
  "profil ne sme prikazati sodišča iz Impressuma kot uradnega brez OpenRegister ID");
assert.match(preverbaJs, /if \(jeNeuspesnaSpletnaIdentifikacija\(podatki\)\) \{\s*nastaviSpletnoRezervo\(true, opisNeuspeleSpletnePoizvedbe\(podatki\), podatki && podatki\.publicProfile && podatki\.publicProfile\.reason\);\s*return;/);
assert.match(css, /\.boniteta-zajem__rezerva\[hidden\] \{ display: none !important; \}/);
assert.match(html, /bonitetna-preverba\.css\?v=2026082[234]-[^"']+/);
assert.ok(css.lastIndexOf(".boniteta-podatki--identiteta.is-grouped") > css.lastIndexOf("grid-template-rows: 82px 106px 112px"),
  "končna Q1 postavitev mora preglasiti staro skupno mrežo");
assert.match(css, /boniteta-kljucni-skupina--osnovni[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/,
  "osnovni podatki morajo ostati v dveh polno širokih vrsticah");
assert.match(css, /boniteta-kljucni-skupina--podjetje[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
  "kartica podjetja mora imeti tri enakomerno široke stolpce");
assert.match(css, /boniteta-kljucni-skupina--osnovni[\s\S]*?boniteta-podjetje-kartica__kljukica \{\s*display: none;/,
  "sedež in dejavnost po referenci ne smeta prikazovati kljukic");
assert.match(html, /bonitetna-preverba\.js\?v=2026082[34]-[^"']+/);
assert.match(html, /boniteta-sredisce\.js\?v=2026082[34]-[^"']+/);
assert.match(css, /boniteta-podjetje-kartica--sedez,[\s\S]*?boniteta-podjetje-kartica--dejavnost \{[\s\S]*?flex-direction: row;[\s\S]*?align-items: center;/,
  "sedež in dejavnost morata imeti ikono levo ter vsebino v svoji polni vrstici");
assert.match(css, /boniteta-podjetje-kartica--sedez \.boniteta-podjetje-kartica__vsebina,[\s\S]*?boniteta-podjetje-kartica--dejavnost \.boniteta-podjetje-kartica__vsebina \{[\s\S]*?grid-template-rows: auto auto;/,
  "oznaka in vrednost morata ostati poravnani brez klipanja");
assert.match(css, /boniteta-podjetje-kartica--sedez,[\s\S]*?grid-column: 1 \/ span 6;[\s\S]*?grid-row: 1;/,
  "sedež mora zasedati celo prvo vrstico");
assert.match(css, /boniteta-podjetje-kartica--dejavnost \{[\s\S]*?grid-column: 1 \/ span 6;[\s\S]*?grid-row: 2;/,
  "dejavnost mora zasedati celo drugo vrstico");
assert.match(css, /boniteta-podatki--identiteta:not\(\.has-northdata\)\.has-purpose \.boniteta-podjetje-kartica--oseba,[\s\S]*?boniteta-podjetje-kartica--register,[\s\S]*?boniteta-podjetje-kartica--sodisce \{[\s\S]*?grid-row: 3;/,
  "spodnje kartice morajo tudi po specifičnih starejših pravilih ostati pod dolgo dejavnostjo");
assert.match(css, /grid-template-rows: 82px 106px 112px;/,
  "spodnja vrstica mora ohraniti dovolj višine za ime in funkcijo odgovorne osebe");
assert.match(css, /grid-template-columns: 1\.3fr 1\.3fr \.8fr \.8fr \.9fr \.9fr;/,
  "stolpec odgovorne osebe mora biti širši od pravne oblike in registra");
assert.match(css, /boniteta-kljucni-skupina--podjetje \.boniteta-podjetje-kartica--oseba dd:not\(\.is-multiple\) \{[\s\S]*?white-space: normal;/,
  "dolgo ime osebe mora ostati berljivo v največ dveh vrsticah");
assert.match(preverbaJs, /vrsta === "sedez" \|\| vrsta === "oseba" \? "2"/,
  "ime odgovorne osebe mora uporabljati dvovrstično samodejno prilagoditev pisave");
assert.match(html, /boniteta-podjetje-ustanovitev-meseci[\s\S]*?<span>poslovanja<\/span>/,
  "meseci in oznaka poslovanja morajo biti v ločenih vrsticah");
assert.match(preverbaJs, /podjetjeUstanovitevMeseci\.textContent = starost\.meseci \+ " " \+ starost\.meseciEnota;/,
  "skripta v dinamično vrstico ne sme več dodati besede poslovanja");
assert.match(css, /boniteta-podjetje-podnaslov \{[\s\S]*?min-height: 50px;[\s\S]*?font-size: 1rem;/,
  "glava ključnih podatkov mora slediti odobreni bolj umirjeni hierarhiji");
assert.match(css, /boniteta-podjetje-ustanovitev \{[\s\S]*?height: 90px;[\s\S]*?min-height: 90px;/,
  "vrstica ustanovitve mora imeti dovolj prostora za datum, starost in mesece brez prekrivanja");
assert.match(css, /boniteta-podjetje-ustanovitev__starost > small > span:first-child \{[\s\S]*?color: #087f87;/,
  "leta in meseci starosti podjetja morajo biti prikazani z enotnim zelenim poudarkom");
assert.match(css, /boniteta-podatki--identiteta \{[\s\S]*?background: linear-gradient\(180deg, rgba\(238,250,246,\.72\)/,
  "ključni podatki morajo uporabljati potrjeni subtilni mint prehod");
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-rezultat__sklop-glava \{[\s\S]*?display: block;[\s\S]*?height: 118px;/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-podjetje-glava__vsebina \{[\s\S]*?position: relative;[\s\S]*?height: 100%;/, "notranji ovoj mora zapolniti glavo, da absolutna vrstica podjetja ne prekrije naslova");
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-podjetje-glava__monogram \{[\s\S]*?width: 61px;[\s\S]*?height: 61px;/, "povzetek podjetja mora ohraniti 27-odstotno povečan monogram");
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-podjetje-glava__opis strong \{[\s\S]*?font-size: 1\.17rem;/, "ime podjetja mora ostati povečano za 27 odstotkov");
assert.match(css, /#boniteta-hwk-sklop\.is-register-card #boniteta-hwk-status \{[\s\S]*?font-size: \.77rem;/, "status podjetja mora ostati sorazmerno povečan");
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-register-hero__ikona \{\s*display: none;\s*\}/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-rezultat__oznaka \{\s*display: none;\s*\}/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-podjetje-glava \{[\s\S]*?background: transparent;/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-rezultat__sklop-glava \{[\s\S]*?border-radius: 0;/);
assert.match(css, /#boniteta-hwk-sklop\.is-register-card \.boniteta-identiteta-nadaljuj__vsebina b > i:last-child \{[\s\S]*?border-radius: 50%;[\s\S]*?background: rgba\(255, 255, 255, \.16\);/);
assert.match(html, /testna-vrstica\.js\?v=20260819-inner-back-v4/);
assert.match(html, /bonitetna-preverba\.js\?v=2026082[34]-[^"']+/);
assert.match(html, /boniteta-sredisce\.js\?v=2026082[34]-[^"']+/);

var spletniKlik = preverbaJs.slice(
  preverbaJs.indexOf('document.getElementById("boniteta-nacin-spletna").addEventListener("click"'),
  preverbaJs.indexOf('document.getElementById("boniteta-nacin-rocno").addEventListener("click"')
);
assert.match(spletniKlik, /heroVrednost\.length < 3[\s\S]*?void izvediUniverzalnoIskanje\(\);/,
  "iskanje po imenu mora preveriti dolžino in nato izvesti univerzalno iskanje");
var izbiraPodjetja = preverbaJs.slice(
  preverbaJs.indexOf("function izberiAutocompletePodjetje(company)"),
  preverbaJs.indexOf("function ponastaviAutocompletePodjetje()")
);
assert.match(izbiraPodjetja, /nacinVnosa = "register"[\s\S]*?izpolniRazbranoPolje\("boniteta-ime", selected\.name\)[\s\S]*?vnosPodrobnosti\.hidden = true/,
  "izbrani uradni zadetek mora brez dodatnega klica napolniti preverjeni podatkovni tok");
assert.doesNotMatch(izbiraPodjetja, /company_lookup|openRegisterApi|fetch\(/,
  "klik uradnega zadetka ne sme porabiti dodatnih kreditov");
assert.match(preverbaJs, /window\.UJBonitetaZacniIzbranoPodjetje = function \(\) \{[\s\S]*?izvediBonitetnoPreverbo\(\)/,
  "podrobnosti se smejo pridobiti šele ob dejanskem začetku prek kanonične funkcije preverbe");
assert.doesNotMatch(preverbaJs, /\.requestSubmit\(/,
  "zagon ne sme biti odvisen od requestSubmit, ki manjka v nekaterih mobilnih WebView okoljih");
assert.match(preverbaJs, /async function izvediBonitetnoPreverbo\(dogodek\)[\s\S]*?obrazec\.addEventListener\("submit", izvediBonitetnoPreverbo\)/,
  "obrazec in začetni gumb morata uporabljati isto kanonično izvedbo");
assert.match(centerJs, /UJBonitetaZacniIzbranoPodjetje/,
  "glavni gumb mora zagnati preverjanje izbranega podjetja");
var zacetekToka = centerJs.slice(centerJs.indexOf("function startSelectedFlow()"));
assert.ok(zacetekToka.indexOf('selectedStartFlow==="crif"') < zacetekToka.indexOf("UJBonitetaZacniIzbranoPodjetje"),
  "poglobljeni tok mora biti izbran pred kakršnimkoli zagonom mehke preverbe");
assert.match(centerJs, /function startSoftCheck\(\)[\s\S]*?boniteta-gumb[\s\S]*?submit\.click\(\)/,
  "izbrano podjetje mora imeti neposredno rezervno pot do istega submit gumba");
assert.doesNotMatch(spletniKlik, /nastaviNacinVnosa\("spletna"/,
  "klik spletnega iskanja ne sme več odpreti zaslona Prilepite spletno povezavo");
assert.match(preverbaJs, /samoSpletniVnos = nacinVnosa === "spletna";[\s\S]*?if \(nacinVnosa === "register"\)[\s\S]*?vnosPodrobnosti\.hidden = true;\s*\} else if \(samoSpletniVnos\) vnosPodrobnosti\.hidden = true;\s*else nastaviNacinVnosa/,
  "nadaljevanje shranjenega spletnega ali registrskega opravila mora ostati brez vmesnega obrazca");
assert.match(preverbaJs, /function pokaziSpletnoNapako\(sporocilo\)[\s\S]*?vnosPodrobnosti\.hidden = true;[\s\S]*?heroSpletnaStatus\.textContent = sporocilo/,
  "napaka spletnega iskanja mora biti prikazana pri začetnem iskalniku");
assert.match(preverbaJs, /function opisiStanjeOpravila\(job\)[\s\S]*?nacinVnosa === "spletna"[\s\S]*?heroSpletnaStatus\.textContent = opis/,
  "stanje spletnega iskanja mora biti vidno pri začetnem iskalniku namesto na ločenem zaslonu");
assert.match(preverbaJs, /profilUrl\.searchParams\.set\("profile", shranjeno\.profile\.id\)[\s\S]*?history\.replaceState/,
  "po shranjevanju mora URL kazati na dejanski novi profil in ne na stari izbrisani ID");
assert.match(preverbaJs, /function posodobiRazpolozljivostPodjetjePogledov[\s\S]*?gumb\.disabled = !jeNaVoljo[\s\S]*?informacije niso na voljo/,
  "manjkajoči celotni sklop mora ostati viden, vendar jasno označen in neklikljiv");
assert.match(preverbaJs, /function razpolozljiviPodjetjePogledi[\s\S]*?:not\(:disabled\)/,
  "tipkovnica in swipe morata preskočiti nedostopne poglede");
assert.doesNotMatch(preverbaJs, /pogled !== "kljucni" && !northDataPodjetje/,
  "manjkajoči dodatni podatki uporabnika ne smejo vrniti v odstranjeni enozavihekni prikaz");
assert.match(preverbaJs, /if \(dejavnost\) dodajKarticoPodjetja\(osnovniPodatki, "dejavnost"/,
  "prazna dejavnost ne sme ustvariti prekrivajoče se kartice Ni podatka");
assert.match(preverbaJs, /if \(imaOdgovornoOsebo\) dodajKarticoPodjetja\(podatkiPodjetja, "oseba"/,
  "prazna odgovorna oseba ne sme ustvariti prekrivajoče se kartice Ni podatka");
assert.match(preverbaJs, /UJBonitetaPonastaviNeveljavenProfil[\s\S]*?heroSpletnaStatus\.textContent = sporocilo/,
  "izbrisani profil mora počistiti zataknjeno stanje nalaganja in ostati v novem vmesniku");
var izbiraAutocompletePodjetja = preverbaJs.slice(preverbaJs.indexOf("function izberiAutocompletePodjetje"), preverbaJs.indexOf("function ponastaviAutocompletePodjetje"));
assert.doesNotMatch(izbiraAutocompletePodjetja, /scrollIntoView/,
  "izbira podjetja ne sme samodejno premakniti uporabnika stran od izbrane vrstice");
assert.match(preverbaJs, /function izrisiRegistrskoPodjetje\(podatki, identiteta\) \{\s*hwkPodatki\.innerHTML = "";/,
  "vsak ponovni izris mora najprej odstraniti stare kartice, da se podatki ne prekrivajo in podvajajo");

console.log("✓ Potrditev in rezultat insolvence ostaneta v istem dvokoračnem toku.");
