import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

global.sessionStorage = {
  _data: new Map(),
  getItem(key) { return this._data.has(key) ? this._data.get(key) : null; },
  setItem(key, value) { this._data.set(key, String(value)); },
  removeItem(key) { this._data.delete(key); },
};
global.localStorage = {
  _data: new Map(),
  getItem(key) { return this._data.has(key) ? this._data.get(key) : null; },
  setItem(key, value) { this._data.set(key, String(value)); },
  removeItem(key) { this._data.delete(key); },
};

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(root, "..", "app");
const N = require(path.join(appRoot, "opomin-nacrt.js"));
const uiSrc = fs.readFileSync(path.join(appRoot, "opomin-nacrt-ui.js"), "utf8");
const cssSrc = fs.readFileSync(path.join(appRoot, "styles.css"), "utf8");
const htmlSrc = fs.readFileSync(path.join(appRoot, "neplacila-posiljanje.html"), "utf8");
const sporociloHtmlSrc = fs.readFileSync(path.join(appRoot, "neplacila-sporocilo.html"), "utf8");

assert.match(uiSrc, /id="opomin-kartice-minus"/);
assert.match(uiSrc, /id="opomin-kartice-plus"/);
assert.match(uiSrc, /opomin-nacrt__napredek-tekst">Koraki načrta <span class="opomin-nacrt__napredek-stevilo"[\s\S]{0,260}vkljuceniKoraki\.length/);
assert.match(cssSrc, /\.opomin-nacrt__napredek-stevilo\s*\{[^}]*min-width:\s*18px;[^}]*height:\s*18px;[^}]*border-radius:\s*999px;/s);
assert.match(uiSrc, /barvePristopov = \{\s*postopno: "167, 122, 69",\s*uravnotezeno: "200, 167, 74",\s*odlocno: "125, 89, 98",/s);
assert.match(uiSrc, /opts\.glavniEl\.style\.setProperty\(\s*"--opomin-pristop-aktivni-rgb",\s*barvePristopov\[aktivni\]/s);
assert.match(cssSrc, /\.opomin-nacrt__napredek-tekst\s*\{[^}]*color:\s*rgb\(var\(--opomin-pristop-aktivni-rgb, 21, 145, 149\)\);/s);
assert.match(cssSrc, /\.opomin-nacrt__napredek-stevilo\s*\{[^}]*background:\s*rgba\(var\(--opomin-pristop-aktivni-rgb, 21, 145, 149\), \.14\);[^}]*color:\s*rgb\(var\(--opomin-pristop-aktivni-rgb, 21, 145, 149\)\);/s);
assert.match(cssSrc, /\.opomin-nacrt__napredek-crta\s*\{[^}]*background:\s*rgba\(var\(--opomin-pristop-aktivni-rgb, 21, 145, 149\), \.3\);/s);
assert.match(cssSrc, /\.opomin-nacrt__pika--potrjen\s*\{[^}]*border-color:\s*rgb\(var\(--opomin-pristop-aktivni-rgb, 21, 145, 149\)\);[^}]*background:\s*rgb\(var\(--opomin-pristop-aktivni-rgb, 21, 145, 149\)\);/s);
assert.match(cssSrc, /\.opomin-nacrt__pika--izbran\s*\{[^}]*border-color:\s*rgb\(var\(--opomin-pristop-aktivni-rgb, 21, 145, 149\)\);[^}]*box-shadow:\s*0 0 0 2px rgba\(var\(--opomin-pristop-aktivni-rgb, 21, 145, 149\), \.24\);/s);
assert.doesNotMatch(uiSrc, /opomin-nacrt__napredek-tekst">Potrjeno<\/p>/);
assert.match(uiSrc, /var pikeHtml = vkljuceniKoraki/);
assert.match(uiSrc, /var vsePredlogeKorakov = plan\.steps \|\| \[\]/);
assert.doesNotMatch(uiSrc, /vkljuceniKoraki\.length === 1 \? "kartica"/);
assert.match(uiSrc, /function oznakaStevilaKorakov/);
assert.match(uiSrc, /if \(n === 1\) return "korak"/);
assert.match(uiSrc, /if \(n === 2\) return "koraka"/);
assert.match(uiSrc, /if \(n === 3 \|\| n === 4\) return "koraki"/);
assert.doesNotMatch(uiSrc, /data-hitri-korak=/);
assert.doesNotMatch(uiSrc, /opomin-hitri-koraki-zgoraj/);
assert.match(uiSrc, /data-tone-id/);
assert.match(uiSrc, /function prikazniNaslovKoraka/);
assert.match(uiSrc, /function prikazniRedGlavnegaKoraka/);
assert.match(uiSrc, /var prikazniRedStep = prikazniRedGlavnegaKoraka\(step\)/);
assert.match(uiSrc, /"Preveri in potrdi " \+ prikazniRedGlavnegaKoraka\(step\)/);
assert.doesNotMatch(uiSrc, /prikazniRedMap/);
assert.doesNotMatch(uiSrc, /Ton izbrane kartice lahko spremeniš spodaj\./);
assert.match(uiSrc, /Nadomesti z izbrano kartico/);
assert.doesNotMatch(uiSrc, /id="opomin-preoblikuj-izberi"/);
assert.match(uiSrc, /function uporabiIzbranoPreoblikovanje\(\)/);
assert.match(uiSrc, /\[data-moj-korak\][\s\S]*?uporabiIzbranoPreoblikovanje\(\)/);
assert.match(uiSrc, /\[data-preoblikuj-predloga\][\s\S]*?uporabiIzbranoPreoblikovanje\(\)/);
assert.match(uiSrc, /!s\.isExcluded && vkljuceniKoraki\.length > 1/);
assert.match(uiSrc, /classList\.toggle\("opomin-nadomesti-odprt", preoblikujRazsirjen\)/);
assert.match(uiSrc, /kompaktneOznakePristopov = \{\s*postopno: "Prijazno",\s*uravnotezeno: "Resno",\s*odlocno: "Odločno"/s);
assert.match(uiSrc, /class="opomin-pristop__krog-ime">' \+ esc\(kompaktneOznakePristopov\[pristop\.id\] \|\| pristop\.label\)/);
assert.match(uiSrc, /opomin-pristop__krog--' \+ esc\(pristop\.id\) \+[\s\S]{0,120}pristop\.id === aktivni \? " is-selected" : ""/, "kompaktni krog mora uporabiti obstoječi aktivni pristop");
assert.match(uiSrc, /<button type="button" class="opomin-pristop__krog[\s\S]{0,260}data-opomin-pristop-odpri=/, "zaprti krogi morajo biti pravi gumbi");
assert.match(uiSrc, /if \(krogi\.dataset\.opominPristopIzris !== aktivni\)[\s\S]{0,180}krogi\.dataset\.opominPristopIzris = aktivni;/, "ura načrta ne sme med klikom znova ustvarjati nespremenjenih krogov");
assert.match(uiSrc, /function izberiPristopIzterjave\(pristopId\)[\s\S]{0,1400}N\.uporabiPristopIzterjave\(plan, pristopId\)[\s\S]{0,900}izrisiGlavni\(\);/, "izbira pristopa mora imeti eno skupno logiko za krog in kartico");
assert.match(uiSrc, /krogi\.onclick = function \(dogodek\)[\s\S]{0,260}dogodek\.target\.closest\("\[data-opomin-pristop-odpri\]"\)[\s\S]{0,180}odpriKarticePristopa\(\);[\s\S]{0,180}izberiPristopIzterjave\(krogGumb\.getAttribute\("data-opomin-pristop-odpri"\)\);/, "klik zaprtega kroga mora odpreti in takoj izbrati pripadajočo kartico");
assert.match(htmlSrc, /id="opomin-pristop-krogi" aria-label="Odpri možnosti pristopa"/);
assert.doesNotMatch(htmlSrc, /id="opomin-pristop-krogi" aria-hidden="true"/);
assert.match(cssSrc, /\.opomin-pristop__krog\.is-selected,[\s\S]{0,180}\.opomin-pristop__kartica\.is-selected \.opomin-pristop__ikona\s*\{[^}]*border-color:\s*rgb\(var\(--pristop-rgb\)\);/s, "izbor mora prebarvati samo obstoječi celotni rob medaljona");
assert.doesNotMatch(cssSrc, /\.opomin-pristop__krog::before|\.opomin-pristop__ikona::before|--opomin-pristop-zunanji-stik-y/, "izbor medaljona ne sme dodati loka ali dodatne obrobe");
assert.doesNotMatch(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__kartica\.is-selected::after\s*\{/, "izbor ne sme spreminjati geometrije maske kartice");
assert.doesNotMatch(cssSrc, /--opomin-pristop-medaljon-x/, "medaljon mora biti na pravi sredini svoje kartice brez odmika zunanjih stolpcev");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__krogi\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);[^}]*gap:\s*7px;/s, "zaprti krogi morajo uporabljati isto 7px mrežo kot kartice");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__priporocilo-overlay\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);[^}]*gap:\s*7px;/s, "zvezdica mora slediti centrirani mreži krogov");
assert.match(cssSrc, /\.opomin-pristop__krog-ime\s*\{[^}]*top:\s*45px;[^}]*color:\s*currentColor;[^}]*font:\s*700 10\.5px\/1 "Fredoka"[^;]*;[^}]*letter-spacing:\s*-\.018em;/s);
assert.match(uiSrc, /stopnjePristopov = \{\s*postopno: 1,\s*uravnotezeno: 2,\s*odlocno: 3,/s);
assert.match(uiSrc, /class="opomin-pristop__stopnja" role="img" aria-label="Stopnja ' \+ stopnjaPristopa \+ ' od 3"/);
assert.match(uiSrc, /var kajSlediPoPristopu = \{\s*postopno:\s*"prijazen opomin",\s*uravnotezeno:\s*"jasen zadnji rok",\s*odlocno:\s*"hitra eskalacija",\s*\};/s);
assert.match(uiSrc, /function opisPristopa\(pristop\)[\s\S]{0,1400}zamuda\.toLocaleString\("sl-SI"\) \+ " dni zamude zahteva odziv\."/);
assert.match(uiSrc, /class="opomin-pristop__opis">' \+ esc\(opisPristopa\(pristop\)\)/);
assert.match(cssSrc, /\.opomin-pristop__opis\s*\{[^}]*color:\s*#4f6662;[^}]*font-size:\s*11\.75px;[^}]*-webkit-line-clamp:\s*3;/s);
assert.match(cssSrc, /\.opomin-pristop__izbrano\s*\{[^}]*top:\s*5px;[^}]*right:\s*5px;[^}]*width:\s*18px;[^}]*height:\s*18px;/s);
assert.match(uiSrc, /class="opomin-pristop__krog-oznaka">Kaj sledi\?<\/span>/);
assert.match(uiSrc, /class="opomin-pristop__krog-priporocilo" aria-label="Priporočeno"><span aria-hidden="true">★<\/span><\/span>/);
assert.doesNotMatch(uiSrc, /class="opomin-pristop__krog-priporocilo"[^>]*><svg/);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded \.opomin-pristop__ikona > svg\s*\{[^}]*display:\s*none;/s, "odprto stanje sme skriti samo glavno obrazno ikono, ne SVG zvezdice");
assert.doesNotMatch(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded \.opomin-pristop__ikona svg\s*\{[^}]*display:\s*none;/s);
assert.match(uiSrc, /class="opomin-pristop__zapiranje-ime">' \+ esc\(kompaktneOznakePristopov\[pristop\.id\] \|\| pristop\.label\)/);
assert.doesNotMatch(uiSrc, /class="opomin-pristop__meta"><b>Kaj sledi\?<\/b>/);
assert.doesNotMatch(uiSrc, /class="opomin-pristop__meta"><em>Priporočeno<\/em>/);
assert.match(htmlSrc, /id="opomin-pristop-priporocilo-overlay"/);
assert.match(htmlSrc, /class="opomin-pristop__razpri-vrstica">[\s\S]*?class="opomin-pristop__razpri-prostor"[\s\S]*?id="opomin-pristop-razpri"/, "vrstica mora imeti prazen levi prostor in desni kontrolnik");
assert.match(htmlSrc, /data-opomin-pristop-povzetek data-pristop="postopno"[\s\S]*?data-opomin-pristop-predpona>Priporočamo<[\s\S]*?data-opomin-pristop-izbrano>Prijazen pristop<[\s\S]*?data-opomin-pristop-razpri-oznaka>Spremeni</, "vrstica mora ob prvem prihodu jedrnato pokazati prijazen pristop in dejanje Spremeni");
assert.doesNotMatch(htmlSrc, /Za spremembo odprite možnosti\./, "podvojeno navodilo ni potrebno, ko gumb že piše Spremeni");
assert.match(uiSrc, /pristopKarticeOdprte \? "Skrij možnosti" : "Spremeni"/, "zaprt kontrolnik mora biti jasno dejanje Spremeni");
assert.doesNotMatch(uiSrc, /razpriOznaka\.textContent = "Več informacij"/, "po zapiranju mora dejanje ostati Spremeni");
assert.match(uiSrc, /var jePristopIzbralUporabnik = Boolean\(plan && plan\.collectionApproachChosenByUser\)/, "priporočilo in uporabnikova izbira morata biti ločeni stanji");
assert.match(uiSrc, /var prikazaniPristopId = jePristopIzbralUporabnik[\s\S]{0,160}: "postopno";/, "prvi prihod mora pokazati zahtevani prijazen pristop");
assert.match(uiSrc, /povzetekPristopaPredpona\.hidden = jePristopIzbralUporabnik/, "po izbiri mora ostati samo ena vrstica z imenom pristopa");
assert.match(uiSrc, /plan\.collectionApproachChosenByUser = true/, "klik pristopa mora shraniti eksplicitno uporabnikovo izbiro");
assert.match(uiSrc, /postopno: "Prijazen pristop",\s*uravnotezeno: "Resen pristop",\s*odlocno: "Odločen pristop"/s, "priporočila morajo uporabiti slovnično pravilna imena");
assert.match(uiSrc, /povzetekPristopaIme\.textContent = priporocenaImenaPristopov\[prikazaniPristopId\]/, "izbrani pristop mora biti v eni vrstici kot Prijazen, Resen ali Odločen pristop");
assert.match(uiSrc, /'<strong>' \+ esc\(kompaktneOznakePristopov\[pristop\.id\] \|\| pristop\.label\) \+ '<\/strong>'/, "zgornje kartice morajo uporabljati imena Prijazno, Resno in Odločno");
assert.match(cssSrc, /\.opomin-pristop__razpri-povzetek > strong\s*\{[^}]*white-space:\s*nowrap;/s, "ime pristopa mora ostati v svoji vrstici");
assert.match(cssSrc, /\.opomin-pristop__razpri-povzetek > span\s*\{[^}]*font:\s*650 10px\/1 /s, "nadnapis mora izkoristiti višino vrstice");
assert.match(cssSrc, /\.opomin-pristop__razpri-povzetek > strong\s*\{[^}]*font:\s*850 13px\/1\.05 /s, "ime pristopa mora biti jasno večje in čitljivo");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__razpri-vrstica\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(152px, 32%\);/s, "ločnica mora biti še bližje desnemu napisu");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__razpri::before\s*\{[^}]*top:\s*20%;[^}]*bottom:\s*20%;[^}]*width:\s*1px;[^}]*background:\s*#d5e7e3;/s, "ločnica mora biti tanka, centrirana in visoka 60 odstotkov vrstice");
assert.match(uiSrc, /getElementById\("opomin-pristop-priporocilo-overlay"\)/);
assert.match(uiSrc, /class="opomin-pristop__priporocilo-mesto opomin-pristop__priporocilo-mesto--/);
assert.doesNotMatch(uiSrc, /opomin-pristop__priporocilo-mesto opomin-pristop__krog--/);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__priporocilo-overlay\s*\{[^}]*z-index:\s*5;[^}]*display:\s*grid;/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__priporocilo-overlay\s*\{[^}]*pointer-events:\s*none;/s, "dekorativna zvezdica ne sme prestreči klika zaprtega kroga");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded \.opomin-pristop__priporocilo-overlay\s*\{[^}]*visibility:\s*visible;/s);
assert.match(cssSrc, /\.opomin-pristop__krog-priporocilo\s*\{[^}]*top:\s*32px;[^}]*right:\s*-6px;[^}]*width:\s*21px;[^}]*height:\s*21px;[^}]*border-radius:\s*50%;[^}]*background:\s*rgb\(var\(--pristop-rgb\)\);/s);
assert.doesNotMatch(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded \.opomin-pristop__ikona \.opomin-pristop__krog-priporocilo\s*\{/);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__kartica \.opomin-pristop__krog-priporocilo\s*\{[^}]*display:\s*none;/s, "kartica ne sme risati druge zvezdice pod vrstico Več informacij");
assert.match(uiSrc, /stopnja <= stopnjaPristopa \? " is-active" : ""/);
assert.match(cssSrc, /\.opomin-pristop__stopnja\s*\{[^}]*display:\s*flex;[^}]*width:\s*min\(82px, 82%\);[^}]*gap:\s*4px;/s);
assert.match(cssSrc, /\.opomin-pristop__kartica > strong\s*\{[^}]*transform:\s*translateY\(-6px\);/s);
assert.match(cssSrc, /\.opomin-pristop__stopnja\s*\{[^}]*margin:\s*1px auto 0;/s);
assert.match(cssSrc, /\.opomin-pristop__stopnja-segment\.is-active\s*\{[^}]*background:\s*rgb\(var\(--pristop-rgb\)\);/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__stopnja\s*\{[^}]*display:\s*none;/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded \.opomin-pristop__stopnja\s*\{[^}]*display:\s*flex;/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__kartica > strong\s*\{[^}]*transform:\s*none;/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded \.opomin-pristop__kartica > strong\s*\{[^}]*transform:\s*translateY\(-6px\);/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded \.opomin-pristop__krog-vsebina\s*\{[^}]*display:\s*flex;/s);
assert.match(cssSrc, /\.opomin-pristop__krog-oznaka\s*\{[^}]*border:\s*1px solid rgb\(var\(--pristop-rgb\)\);[^}]*border-radius:\s*999px;[^}]*color:\s*#fff;[^}]*background:\s*rgb\(var\(--pristop-rgb\)\);/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded \.opomin-pristop__krog-vsebina\s*\{[^}]*position:\s*relative;/s);
assert.match(cssSrc, /\.opomin-pristop__krog-oznaka\s*\{[^}]*position:\s*absolute;[^}]*top:\s*-3px;[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/s);
assert.match(cssSrc, /@keyframes opomin-pristop-vsebina-izgine/);
assert.match(cssSrc, /@keyframes opomin-pristop-odpiranje-vsebina/);
assert.match(cssSrc, /@keyframes opomin-pristop-odpiranje-staro/);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded:not\(\.is-closing\) \.opomin-pristop__kartica\s*\{[^}]*opacity:\s*1;/s, "kartica med odpiranjem ne sme zbledeti");
assert.doesNotMatch(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded:not\(\.is-closing\) \.opomin-pristop__kartica\s*\{[^}]*animation-duration:\s*700ms/s, "kartice morajo ohraniti prejšnjo hitrost");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded:not\(\.is-closing\) \.opomin-pristop__krog-vsebina\s*\{[^}]*animation:\s*opomin-pristop-odpiranje-vsebina 260ms ease both;[^}]*animation-delay:\s*var\(--opomin-pristop-zamik, 0ms\);/s, "nova vsebina mora začeti preliv takoj, brez praznine");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded:not\(\.is-closing\) \.opomin-pristop__ikona > svg,[\s\S]{0,180}\.opomin-pristop__zapiranje-ime\s*\{[^}]*display:\s*block;[^}]*animation:\s*opomin-pristop-odpiranje-staro 260ms ease both;/s, "stara vsebina mora ostati vidna med neposrednim prelivom");
assert.match(uiSrc, /if \(pristopKarticeOdprte && sekcija\) sekcija\.classList\.add\("is-switching"\);[\s\S]{0,80}izrisiGlavni\(\);/, "menjava odprte kartice mora označiti izris brez ponovne animacije");
assert.match(uiSrc, /sekcija\.classList\.remove\("is-closing", "is-switching"\)/, "novo pravo odpiranje mora znova dovoliti animacijo");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded\.is-switching:not\(\.is-closing\) \.opomin-pristop__kartica,[\s\S]{0,360}animation:\s*none;/s, "izbira drugega pristopa ne sme znova zagnati animacije kartic");
assert.doesNotMatch(cssSrc, /@keyframes opomin-pristop-vsebina-izgine\s*\{[^}]*transform:/s, "besedilo med prehodom ne sme spreminjati merila");
assert.match(cssSrc, /@keyframes opomin-pristop-korak-pojavi/);
assert.match(cssSrc, /@keyframes opomin-pristop-vsebina-izgine\s*\{[\s\S]{0,180}0%[^}]*opacity:\s*1;[\s\S]{0,100}50%, 100%[^}]*opacity:\s*0;/, "stara vsebina mora od začetka zvezno izginjati");
assert.match(cssSrc, /@keyframes opomin-pristop-korak-pojavi\s*\{[\s\S]{0,140}0%[^}]*opacity:\s*0;[\s\S]{0,90}50%, 100%[^}]*opacity:\s*1;/, "ime in smeško se morata od začetka zvezno prikazovati");
assert.match(cssSrc, /@keyframes opomin-pristop-medaljon-izgine/);
assert.match(cssSrc, /@keyframes opomin-pristop-cilj-pojavi/);
assert.match(cssSrc, /@keyframes opomin-pristop-priporocilo-pade/);
assert.match(cssSrc, /@keyframes opomin-pristop-priporocilo-pospravi/);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded\.is-closing \.opomin-pristop__krog-vsebina\s*\{[^}]*animation:\s*opomin-pristop-vsebina-izgine 560ms ease both;/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded\.is-closing \.opomin-pristop__ikona > svg,[\s\S]{0,180}\.opomin-pristop__zapiranje-ime\s*\{[^}]*display:\s*block;[^}]*animation:\s*opomin-pristop-korak-pojavi 560ms ease both;/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded\.is-closing \.opomin-pristop__krog-vsebina\s*\{[^}]*grid-area:\s*1 \/ 1;/s, "Kaj sledi ne sme med prehodom zamenjati mrežne celice");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded\.is-closing \.opomin-pristop__ikona > svg\s*\{[^}]*grid-area:\s*1 \/ 1;/s, "smeško mora prekriti isto mesto brez premika gumba Kaj sledi");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded\.is-closing \.opomin-pristop__ikona\s*\{[^}]*opacity:\s*1;/s, "premikajoci medaljon mora senco ohraniti do atomskega zakljucka");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded\.is-closing \.opomin-pristop__krogi,[\s\S]{0,180}\.opomin-pristop__priporocilo-overlay\s*\{[^}]*visibility:\s*visible;/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded\.is-closing \.opomin-pristop__krog\s*\{[^}]*opacity:\s*0;/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded\.is-closing \.opomin-pristop__priporocilo-mesto\s*\{[^}]*opacity:\s*1;[^}]*animation:\s*opomin-pristop-priporocilo-pospravi 560ms cubic-bezier\(\.22, 1, \.36, 1\) both;[^}]*animation-delay:\s*0ms;/s, "ista zvezdica mora ostati nad vrstico in slediti krogu do konca");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded\.is-closing \.opomin-pristop__kartica\s*\{[^}]*--opomin-pristop-zamik:\s*0ms;[^}]*animation-name:\s*opomin-pristop-kartica-pospravi;[^}]*animation-delay:\s*0ms;/s);
assert.doesNotMatch(cssSrc, /\.opomin-pristop\.is-collapsed\.is-expanded\.is-closing \.opomin-pristop__kartica:nth-child/);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__izbrano\s*\{[^}]*top:\s*5px;[^}]*right:\s*2px;[^}]*width:\s*18px;[^}]*height:\s*18px;/s);
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__kartica::after\s*\{[^}]*left:\s*calc\(50% \+ 1px\);[^}]*transform:\s*translateX\(-50%\);/s, "maska spodnjega roba mora ostati na sredini kartice");
assert.match(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__ikona\s*\{[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/s, "medaljon mora biti natančno na sredini kartice");
assert.doesNotMatch(cssSrc, /\.opomin-pristop\.is-collapsed \.opomin-pristop__kartica:nth-child\([^)]*\) \.opomin-pristop__ikona\s*\{/, "posamezna kartica ne sme imeti ločenega popravka medaljona");
assert.match(uiSrc, /data-pristop-obraz="prijazno"/);
assert.match(uiSrc, /data-pristop-obraz="resno"/);
assert.match(uiSrc, /data-pristop-obraz="odlocno"/);
assert.match(uiSrc, /data-pristop-obraz="prijazno" viewBox="4 5 16 15"/);
assert.match(cssSrc, /\.opomin-pristop__krog > svg,[\s\S]{0,160}width:\s*17\.86px;[\s\S]{0,80}height:\s*17\.86px;[\s\S]{0,80}transform:\s*translateY\(26px\);/);
assert.match(cssSrc, /\.opomin-nacrt__stage-odstrani-krogec\s*\{[^}]*visibility:\s*hidden;[^}]*pointer-events:\s*none;/s);
assert.match(cssSrc, /\.opomin-nadomesti-odprt \.opomin-nacrt__stage-odstrani-krogec\s*\{[^}]*opacity:\s*1;[^}]*visibility:\s*visible;[^}]*pointer-events:\s*auto;/s);
assert.match(cssSrc, /\.opomin-nacrt__stage-odstrani-krogec svg\s*\{[^}]*width:\s*15px;[^}]*height:\s*15px;/s);
assert.match(cssSrc, /\.opomin-nacrt__stage-st\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;[^}]*min-width:\s*24px;[^}]*min-height:\s*24px;[^}]*flex:\s*0 0 24px;[^}]*border-radius:\s*50%;/s);
assert.doesNotMatch(cssSrc, /\.opomin-nacrt__stage[^{}]*\.opomin-nacrt__stage-st\s*\{[^}]*border-radius:\s*8px;/s);
assert.match(uiSrc, />Privzeto <span>/);
assert.match(uiSrc, />Moji koraki <span>/);
assert.match(cssSrc, /\.opomin-preoblikuj__kartica::before\s*\{[^}]*inset:\s*0 0 auto;[^}]*height:\s*2px;/s);
assert.match(cssSrc, /\.opomin-nacrt__stage--barvna:not\(\.opomin-preoblikuj__kartica\)[^{]*::before/);
assert.match(uiSrc, /uspesni-jezek-moji-koraki-v1/);
assert.match(uiSrc, /function shraniMojKorak/);
assert.match(uiSrc, /shraniMojKorak\(noviKorak\)/);
assert.match(uiSrc, /data-moj-korak/);
assert.match(uiSrc, /function izbrisiMojKorak/);
assert.match(uiSrc, /data-izbrisi-moj-korak/);
assert.match(uiSrc, /Moj korak je izbrisan\./);
assert.match(cssSrc, /\.opomin-preoblikuj__moja-izbrisi\s*\{/);
assert.match(cssSrc, /\.opomin-preoblikuj__podrobnosti\s*\{[\s\S]*?height:\s*0;[\s\S]*?overflow:\s*hidden;[\s\S]*?visibility:\s*hidden;/);
assert.match(cssSrc, /\.opomin-preoblikuj--razsirjen \.opomin-preoblikuj__podrobnosti\s*\{[\s\S]*?height:\s*auto;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-panel--detajl\s*\{[\s\S]*?height:\s*0;[\s\S]*?overflow:\s*hidden;[\s\S]*?visibility:\s*hidden;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-panel--detajl-razsirjen\s*\{[\s\S]*?height:\s*auto;/);
assert.doesNotMatch(uiSrc, /casDetajlPanel\.style\.display|podrobnosti\.style\.display/);
assert.match(uiSrc, /function animirajHarmonikNaKompozitorju/);
assert.match(uiSrc, /zberiTarceHarmonika\(casDetajlPanel\)/);
assert.match(uiSrc, /el\.animate\([\s\S]*?translate3d\([\s\S]*?scale\(/);
assert.doesNotMatch(cssSrc, /\.opomin-nacrt__cas-panel--detajl\s*\{[\s\S]{0,420}transition:/);
assert.match(cssSrc, /cas-povzetek-karta:has\([\s\S]{0,260}border-bottom-color:\s*transparent;/);
assert.match(cssSrc, /cas-panel--detajl-razsirjen \.opomin-nacrt__cas-kartica\s*\{[\s\S]{0,220}border-top-color:\s*transparent;/);
assert.match(uiSrc, /opomin-nacrt__cas-podrobno-ura[\s\S]*?Skrij nastavitve[\s\S]*?Prilagodi čas/);
assert.match(uiSrc, /var casPreklopObstaja = !jeManual;/);
assert.match(uiSrc, /var casPodrobnoOdprto = jeManual \|\| Boolean\(step\._casPodrobnoOdprto\);/);
assert.match(uiSrc, /var povzetekRazmikDni = prejsnjiAktiven[\s\S]*?razmikOdPrejsnjega\(plan, step\)[\s\S]*?dneviOdDanes/);
assert.match(cssSrc, /\.opomin-nacrt__cas-povzetek-mreza\s*\{[\s\S]*?margin:\s*0 0 12px;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-povzetek-karta\s*\{[\s\S]*?border-left:\s*3px solid #e5a719;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-povzetek-mreza\s*\{[\s\S]*?grid-template-columns:\s*58% 42%;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-povzetek-vrstica:last-child\s*\{[\s\S]*?padding-bottom:\s*2px;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-povzetek-vrstica:last-child\s*\{[\s\S]*?border-left:\s*1px solid #e2ecea;/);
assert.match(uiSrc, /function htmlKompaktniKontaktniKanali\(ctx\)[\s\S]*?data-kontakt-toggle-primarni/);
assert.match(uiSrc, /kompaktniKontaktniKanaliHtml[\s\S]*?casGumbPreklopHtml/);
assert.doesNotMatch(uiSrc, /opomin-nacrt__cas-kanal-vrednost[^\n]*SMS|opomin-nacrt__cas-kanal-vrednost[^\n]*E-pošta/);
assert.match(cssSrc, /\.opomin-nacrt__cas-kanali\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 0\.85fr\) minmax\(0, 1\.45fr\);/);
assert.match(cssSrc, /\.opomin-nacrt__cas-kanal-vrednost\s*\{[\s\S]*?white-space:\s*nowrap;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-podrobno-ura\s*\{[\s\S]*?color:\s*#159195;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-podrobno-preklop-tekst\s*\{[\s\S]*?color:\s*#737f7d;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-podrobno-puscica\s*\{[\s\S]*?color:\s*#159195;/);
assert.match(cssSrc, /\.step-content-card:not\(\.step-content-card--lastni-korak\)\s*\{[\s\S]*?gap:\s*8px;[\s\S]*?padding:\s*10px;/);
assert.match(cssSrc, /\.step-content-card:not\(\.step-content-card--lastni-korak\) \.step-content-card__title\s*\{[\s\S]*?font-size:\s*15px;/);
assert.match(cssSrc, /\.step-content-card:not\(\.step-content-card--lastni-korak\) \.sms-preview__okno\s*\{[\s\S]*?height:\s*auto;[\s\S]*?max-height:\s*none;[\s\S]*?overflow:\s*visible;/);
assert.match(cssSrc, /\.step-content-card:not\(\.step-content-card--lastni-korak\) \.sms-preview__viewport\s*\{[\s\S]*?min-height:\s*158px;[\s\S]*?overflow-y:\s*hidden;/);
assert.match(uiSrc, /function prilagodiVisinoSmsUrejevalnika\(polje\)[\s\S]*?polje\.scrollHeight/);
assert.match(uiSrc, /smsUrejanje\.addEventListener\("input", function \(\) \{\s*prilagodiVisinoSmsUrejevalnika\(smsUrejanje\);/);
assert.match(cssSrc, /\.step-content-card:not\(\.step-content-card--lastni-korak\) \.opomin-sporocilo-dodatki \.sporocilo-dodatek\s*\{[\s\S]*?min-height:\s*72px;/);
assert.match(cssSrc, /\.step-content-card:not\(\.step-content-card--lastni-korak\) \.opomin-potrdi-predloge__kartica\s*\{[\s\S]*?min-height:\s*80px;/);
assert.doesNotMatch(uiSrc, /Dodaj izbrani/);
assert.match(uiSrc, /var glavniGumbBesedilo = "Nadomesti"/);
assert.match(uiSrc, /\(stevecKorakovHtml \|\| ""\) \+/, "števec mora ostati v DOM-u tudi med menjavo stanja");
assert.doesNotMatch(uiSrc, /preoblikujRazsirjen \? "" : \(stevecKorakovHtml \|\| ""\)/, "razširitev ne sme odstraniti števca iz DOM-a in razdreti akcijske vrstice");
assert.doesNotMatch(uiSrc, /Najprej klikni zgornjo kartico, ki jo želiš nadomestiti s svojo\./);
assert.match(cssSrc, /\.opomin-nov-korak__barve > \.opomin-nov-korak__barvna-vrstica[\s\S]*?touch-action: pan-x pan-y/);
assert.match(uiSrc, /root\.matchMedia\("\(hover: hover\) and \(pointer: fine\)"\)\.matches/);
assert.match(uiSrc, /var obstojeciOsnutek = \(plan\.steps \|\| \[\]\)\.find/);
assert.match(uiSrc, /if \(obstojeciOsnutek\) \{[\s\S]*?plan\.selectedStageId = obstojeciOsnutek\.id;[\s\S]*?novKorakUrejevalnikOdprt = true;/);
assert.match(htmlSrc, /styles\.css\?v=/);
assert.match(cssSrc, /\.stran--sporocilo \.sporocilo-dodatek\[aria-pressed="true"\]\s*\{[\s\S]*?border:\s*2\.5px solid #55aaa3;[\s\S]*?radial-gradient[\s\S]*?#ffffff;/);
assert.match(cssSrc, /\.template-editor \.sporocilo-dodatek\[aria-pressed="true"\]\s*\{[\s\S]*?border:\s*2\.5px solid #55aaa3;[\s\S]*?radial-gradient[\s\S]*?#ffffff;/);
assert.match(htmlSrc, /opomin-nacrt-ui\.js\?v=/);
assert.match(uiSrc, /N\.uporabiMojKorak\(plan, aktivenIndex, osebniKorak\)/);
assert.doesNotMatch(uiSrc, /Podrsaj in izberi med 10 karticami\./);
assert.match(uiSrc, /id="opomin-preoblikuj-dodaj"/);
assert.match(uiSrc, /var dodajBesedilo = "Dodaj korak"/);
assert.match(uiSrc, /var IKONA_PLUS =/);
assert.match(uiSrc, /data-predoglej-predlogo[^\n]+aria-label="Dodaj korak iz predloge:[^\n]+IKONA_PLUS/);
assert.match(uiSrc, /data-predoglej-moj-korak[^\n]+aria-label="Dodaj korak iz mojih korakov:[^\n]+IKONA_PLUS/);
assert.match(uiSrc, /<button type="submit">Dodaj korak<\/button>/);
assert.doesNotMatch(uiSrc, /<button type="submit">Shrani korak<\/button>/);
assert.match(uiSrc, /data-predoglej-predlogo[\s\S]{0,2500}odpriUrejevalnikPredloge\(\{[\s\S]{0,500}templateId: predloga\.id/);
assert.match(uiSrc, /novKorakForm\.addEventListener\("submit"[\s\S]{0,1800}N\.dokoncajKorakPoMeri\(plan, aktivenIndex[\s\S]{0,800}shraniSprememboKartic\(\);[\s\S]{0,200}preklopiAktivniKorak\(noviKorak\.index\)/);
assert.doesNotMatch(uiSrc, /lahkoDodaIzbranega/);
assert.doesNotMatch(uiSrc, /opomin-preoblikuj__indikator/);
assert.match(uiSrc, /function posodobiIndikatorPreoblikovanja/);
assert.match(uiSrc, /dodajKorakSpodaj\.addEventListener\("click", function \(\)/);
assert.doesNotMatch(uiSrc, /karticePlus\.addEventListener\("click", odpriNovKorak\)/);
assert.match(uiSrc, /var naslednjiObicajniKorak = \(plan\.steps \|\| \[\]\)\.find/);
assert.match(uiSrc, /naslednjiObicajniKorak\.isExcluded = false/);
assert.match(uiSrc, /plan\.selectedStageId = naslednjiObicajniKorak\.id/);
assert.match(uiSrc, /poravnajKarticoVKaruselu\(naslednjiObicajniKorak\.index, "smooth"\)/);
assert.match(uiSrc, /var zadnjiOdstranljivKorak = vkljuceniKoraki\.slice\(\)\.reverse\(\)\.find/);
assert.match(uiSrc, /var odstranljivi = aktivni\.filter/);
assert.match(uiSrc, /odstranljivi\.length <= 1/);
assert.match(uiSrc, /dodajKorakSpodaj\.addEventListener\("click", function \(\) \{\s*odpriNovKorak\(\);\s*\}\);/);
assert.match(uiSrc, /id="opomin-nov-korak-form"/);
assert.match(uiSrc, /Ime koraka/);
assert.match(uiSrc, /Barva kartice/);
assert.ok(
  uiSrc.indexOf('class="opomin-nov-korak__barve"') < uiSrc.indexOf('<span>Ime koraka<\/span>'),
  "barvni trak mora biti nad poljem za ime koraka"
);
assert.match(uiSrc, /function htmlPreoblikujKartico\(korak, vsebinaKorakaHtml, stevecKorakovHtml\)/);
assert.doesNotMatch(uiSrc, /if \(!korak \|\| korak\.kind === "manual_lawyer" \|\| korak\.deliveryMode === "manual"\)/, "pravni korak mora prikazati števec in Nadomesti");
assert.match(uiSrc, /var jeRocnaPredaja = korak\.kind === "manual_lawyer" \|\| korak\.deliveryMode === "manual"/);
assert.match(uiSrc, /function pripraviCiljPreoblikovanja\(\)[\s\S]{0,900}prostSamodejniKorak\.isExcluded = false/, "nadomestitev pravnega koraka mora uporabiti prost samodejni korak");
assert.match(uiSrc, /function zakljuciZamenjavoRocnePredaje\(cilj\)[\s\S]{0,500}step\.isExcluded = true;[\s\S]{0,300}preklopiAktivniKorak\(cilj\.index\)/, "po izbiri mora pravni korak zamenjati izbrana samodejna kartica");
assert.match(uiSrc, /class="opomin-nov-korak__vsebina">' \+ \(vsebinaKorakaHtml \|\| ""\)/);
assert.match(uiSrc, /htmlPreoblikujKartico\(step, novKorakUrejevalnikOdprt \? vsebinaHtml : "", upravljalnikKarticHtml\)/);
assert.ok(
  uiSrc.indexOf('htmlPreoblikujKartico(step, novKorakUrejevalnikOdprt ? vsebinaHtml : "", upravljalnikKarticHtml)') <
    uiSrc.indexOf("'<section class=\"lp-enotni-widget\">' + lpPovzetekHtml"),
  "vsebina Predaje odvetniku mora biti pod koraki ter števcem in gumbom Nadomesti"
);
assert.doesNotMatch(uiSrc, /'<div class="opomin-nacrt__napredek-desno">' \+\s*upravljalnikKarticHtml/);
assert.match(uiSrc, /\(preoblikujRazsirjen \? "" : \(stevecKorakovHtml \|\| ""\)\)/);
assert.match(cssSrc, /\.opomin-preoblikuj__akcije\s*\{[\s\S]{0,80}grid-template-columns:\s*0fr 132px minmax\(0, 1fr\)/);
assert.match(uiSrc, /opomin-kartice-minus[\s\S]{0,420}<span aria-live="polite">[\s\S]{0,220}opomin-kartice-plus/, "spodnja vrstica mora imeti vrstni red minus, število, plus");
assert.match(uiSrc, /opomin-preoblikuj__stevilka">11<\/span>[\s\S]{0,180}>Predaja odvetniku<\/strong>/, "privzeti drsnik mora vsebovati 11. mini kartico Predaja odvetniku");
assert.match(uiSrc, /data-odpri-predajo-odvetniku[\s\S]{0,900}predaja\.isExcluded = false;[\s\S]{0,180}preklopiAktivniKorak\(predaja\.index\)/, "11. mini kartica mora odpreti oziroma obnoviti dejanski pravni korak");
assert.match(uiSrc, /var zadnjiOdstranljivKorak = vkljuceniSamodejniKoraki\.length > 1[\s\S]{0,180}rocnaPredajaKorak/, "pri dveh karticah mora minus odstraniti ročno predajo in pustiti prvi opomnik");
assert.match(uiSrc, /var naslednjiIzkljuceniKorak = izkljucenaRocnaPredaja \|\| vsePredlogeKorakov\.find/, "plus mora po enem koraku najprej vrniti ročno predajo");
assert.match(uiSrc, /var dodajaRocnoPredajo = naslednjiKorak\.kind === "manual_lawyer"[\s\S]{0,260}if \(!dodajaRocnoPredajo\) plan\.selectedStageId = naslednjiKorak\.id/, "vrnitev ročne predaje mora ohraniti prvi opomnik kot aktivno kartico");
assert.match(uiSrc, /var zadnji = samodejni\.length > 1[\s\S]{0,180}aktivni\.length > 1 \? rocnaPredaja : null/, "minus mora dovoliti prehod z dveh kartic na eno");
assert.match(cssSrc, /\.opomin-preoblikuj__akcije \.opomin-nacrt__stevilo-kartic\s*\{[^}]*grid-template-columns:\s*36px minmax\(24px, 1fr\) 36px;[^}]*min-height:\s*44px;[^}]*border-radius:\s*22px;/s);
assert.match(cssSrc, /\.opomin-nacrt__carousel-ovoj\s*\{[^}]*position:\s*relative;[^}]*transform:\s*translateY\(8px\);/s, "samo kartice korakov se premaknejo 8px navzdol, brez premika krogcev ali spodnjih gumbov");
assert.match(cssSrc, /\.opomin-nacrt__napredek-vrstica\s*\{[^}]*transform:\s*translateY\(7px\);/s, "vrstica Koraki načrta s krogci se premakne 7px navzdol brez premika kartic ali gumbov");
assert.match(cssSrc, /\.opomin-nacrt__napredek-vrstica\s*\{[^}]*margin-top:\s*8px;[^}]*transform:\s*translateY\(7px\);/s, "celoten blok Koraki načrta se v dokumentnem toku premakne 8px navzdol, notranji odmiki pa ostanejo nespremenjeni");
assert.match(cssSrc, /\.lp-enotni-widget \.lp-paket-kartica__znacka--izbrano\s*\{[^}]*top:\s*-24px;/s, "značka Izbrano mora biti dvignjena nad zgornji rob kartice");
assert.match(cssSrc, /\.lp-paket-carousel\s*\{[^}]*padding:\s*25px 2px 10px;/s, "drsnik mora nad dvignjeno značko Izbrano rezervirati dovolj prostora brez rezanja");
assert.match(cssSrc, /\.opomin-preoblikuj:not\(\.opomin-preoblikuj--razsirjen\) \.opomin-preoblikuj__gumb\s*\{[^}]*min-height:\s*44px;[^}]*font-size:\s*16px;/s);
assert.match(cssSrc, /\.opomin-preoblikuj--razsirjen \.opomin-nacrt__stevilo-kartic\s*\{[^}]*display:\s*none;/s, "razširjeno stanje mora odstraniti strnjeni števec iz akcijske mreže");
assert.match(cssSrc, /\.opomin-preoblikuj--razsirjen \.opomin-preoblikuj__akcije\s*\{[^}]*grid-template-columns:\s*0fr 132px minmax\(0, 1fr\);[^}]*gap:\s*12px;[^}]*margin:\s*0 -13px;/s, "odprto stanje ne sme skočiti navzgor, vodoravno pa mora ohraniti položaj zaprtih gumbov");
assert.match(cssSrc, /\.opomin-preoblikuj--razsirjen\s*\{[^}]*padding:\s*0 13px 13px;/s, "razširitev mora vsebino odpreti navzdol brez premika akcijske vrstice");
assert.match(cssSrc, /\.opomin-preoblikuj--razsirjen \.opomin-preoblikuj__reset\s*\{[^}]*grid-column:\s*2;[^}]*opacity:\s*1;/s, "besedilo za ponastavitev mora zamenjati števec v istem levem okviru");
assert.match(cssSrc, /\.opomin-preoblikuj__reset\s*\{[^}]*opacity:\s*0;[^}]*visibility:\s*hidden;[^}]*transition:\s*none;/s, "gumb za ponastavitev se v zaprtem stanju ne sme delno izrisati med menjavo stolpca");
assert.match(cssSrc, /\.opomin-preoblikuj--razsirjen \.opomin-preoblikuj__reset\s*\{[^}]*opacity:\s*1;[^}]*visibility:\s*visible;/s, "gumb za ponastavitev se mora pokazati šele na končnem mestu");
assert.match(cssSrc, /\.opomin-preoblikuj__reset\s*\{[^}]*border:\s*1px solid rgba\(26, 126, 128, 0\.18\);[^}]*border-radius:\s*22px;[^}]*background:\s*linear-gradient\(180deg, #ffffff, #f8fcfb\);[^}]*box-shadow:\s*0 5px 14px rgba\(33, 75, 70, 0\.06\);/s, "ponastavitev mora imeti isto barvo, obliko in senco kot števec");
assert.match(cssSrc, /\.opomin-preoblikuj__glavni-ovoj\s*\{[^}]*min-height:\s*44px;[^}]*border-radius:\s*22px;/s, "glavni gumb mora v obeh stanjih ohraniti enako obliko");
assert.match(cssSrc, /\.opomin-preoblikuj__akcije\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px;[^}]*max-height:\s*44px;/s, "akcijska vrstica mora imeti strogo enako višino v obeh stanjih");
assert.match(cssSrc, /\.opomin-preoblikuj__reset\s*\{[^}]*display:\s*grid;[^}]*height:\s*44px;[^}]*min-height:\s*44px;[^}]*max-height:\s*44px;[^}]*line-height:\s*1\.05;/s, "dvovrstični napis ponastavitve ne sme povečati gumba");
assert.match(uiSrc, /\(novKorakUrejevalnikOdprt \? "" : vsebinaHtml\)/);
assert.doesNotMatch(uiSrc, /Svoja barva/);
assert.doesNotMatch(uiSrc, /type="color"/);
assert.match(uiSrc, /N\.zacniKorakPoMeri\(plan/);
assert.match(uiSrc, /N\.dokoncajKorakPoMeri\(plan/);
assert.match(uiSrc, /N\.prekliciKorakPoMeri\(plan/);
assert.match(uiSrc, /function htmlVsebinaKoraka/);
assert.match(uiSrc, /class="step-content-card' \+ \(ctx\.lastniKorak/);
assert.match(uiSrc, /lastniKorak:\s*Boolean\(novKorakUrejevalnikOdprt\)/);
assert.match(uiSrc, /if \(novKorakUrejevalnikOdprt && ciljIndex !== Number\(aktivenIndex\)\)\s*\{\s*return false;/);
assert.match(uiSrc, /step-content-card--lastni-korak/);
assert.match(uiSrc, /ctx\.lastniKorak \? "" : htmlZgornjaOrodnaVrstica\(readyN\)/);
assert.match(uiSrc, /ctx\.lastniKorak \? "" : '<div class="debt-summary debt-summary--compact">/);
assert.match(uiSrc, /data-nov-korak-ton/);
assert.match(uiSrc, /Privzeti ton/);
assert.match(uiSrc, /N\.nastaviTonKoraka\(plan, aktivenIndex, novaKarticaTonId\)/);
assert.doesNotMatch(uiSrc, /<strong>Nova kartica<\/strong>/);
assert.match(uiSrc, /novKorakUrejevalnikOdprt \? "" : zavihki \+ '<div class="opomin-preoblikuj__drsnik-ovoj/);
assert.match(uiSrc, /id="opomin-sms-urejanje"/);
assert.match(uiSrc, /id="opomin-glavni-predloge"/);
assert.doesNotMatch(uiSrc, /id="opomin-nov-korak-sporocilo"/);
assert.doesNotMatch(uiSrc, /data-nov-korak-dodatek/);
assert.match(uiSrc, /data-preoblikuj-predloga/);
assert.match(uiSrc, /id="opomin-preoblikuj-gumb"/);
assert.match(uiSrc, /id="opomin-preoblikuj-reset"/);
assert.match(uiSrc, /id="opomin-preoblikuj-kolaps"/);
assert.match(uiSrc, /var preoblikujRazsirjen = false/);
assert.match(uiSrc, /function nastaviPreoblikujRazsirjen/);
assert.match(uiSrc, /if \(!preoblikujRazsirjen\)/);
assert.match(cssSrc, /\.opomin-preoblikuj--razsirjen\s*\{/);
/* Oba harmonika ostaneta v DOM-u; postavitev se spremeni enkrat, vidni
   prehod pa teče s kompozitorskimi FLIP-transformi. */
assert.match(cssSrc, /\.opomin-preoblikuj__podrobnosti\s*\{[\s\S]{0,300}height:\s*0;/);
assert.match(cssSrc, /\.opomin-preoblikuj--razsirjen \.opomin-preoblikuj__podrobnosti\s*\{[\s\S]{0,180}height:\s*auto;/);
assert.doesNotMatch(uiSrc, /podrobnosti\.style\.(?:display|opacity|transform)/);
assert.match(uiSrc, /zberiTarceHarmonika\(podrobnosti\)/);
assert.doesNotMatch(uiSrc, /preoblikujKolapsira|dodajKolapsAnimacijo/);
assert.doesNotMatch(cssSrc, /\.opomin-preoblikuj__akcije\s*\{[\s\S]{0,260}transition:\s*grid-template-columns/);
assert.doesNotMatch(cssSrc, /\.opomin-preoblikuj__glavni-ovoj\s*\{[\s\S]{0,360}transition:\s*grid-template-columns/);
assert.match(cssSrc, /grid-template-columns:\s*minmax\(0, 1fr\) 64px/);
assert.match(uiSrc, /N\.ponastaviPreoblikovanOpomin\(plan, aktivenIndex/);
assert.match(uiSrc, /N\.preoblikujOpomin\(plan, aktivenIndex/);
assert.match(uiSrc, /var akcijskaVrsticaTop = akcijskaVrstica[\s\S]{0,180}getBoundingClientRect\(\)\.top/);
assert.match(uiSrc, /function ohraniPolozajAkcijskeVrstice\(\)[\s\S]{0,900}root\.scrollTo\([\s\S]{0,420}setTimeout\(ohraniPolozajAkcijskeVrstice, 380\)/, "razširitev mora zakleniti zaslonski položaj akcijske vrstice tudi po animaciji");
assert.match(cssSrc, /\.opomin-preoblikuj__kartica--izbrana\s*\{/);
assert.match(cssSrc, /\.opomin-preoblikuj__drsnik\s*\{/);
assert.match(uiSrc, /var zadnji = odstranljivi\[odstranljivi\.length - 1\]/);
assert.doesNotMatch(uiSrc, /id="opomin-uredi-korake"/);
assert.doesNotMatch(uiSrc, /data-dodaj-korak/);
assert.doesNotMatch(uiSrc, /var hitriUrejevalnikHtml/);
assert.match(cssSrc, /\.opomin-nacrt__stevilo-kartic\s*\{/);
assert.doesNotMatch(cssSrc, /\.opomin-nacrt__zgornje-kartice\s*\{/);
assert.match(cssSrc, /\.opomin-nacrt__izbira-koraka--izbrana\s*\{/);
assert.match(sporociloHtmlSrc, /class="tone-carousel" id="ton-carousel"/);
assert.ok(
  sporociloHtmlSrc.indexOf('id="ton-carousel"') < sporociloHtmlSrc.indexOf('id="priporocilo-razlaga"'),
  "izbira tona mora ostati v namenskem pogledu sporočila"
);
assert.doesNotMatch(htmlSrc, /opomin-hitri-koraki-zgoraj/);
assert.match(htmlSrc, /styles\.css\?v=/);
assert.match(cssSrc, /#opomin-nov-korak-form \.step-content-card__title,[\s\S]*#opomin-nov-korak-form \.debt-summary--compact\s*\{[\s\S]*display:\s*none !important;/);
assert.doesNotMatch(cssSrc, /#opomin-nov-korak-form \.debt-summary\s*\{/);
assert.doesNotMatch(cssSrc, /#opomin-nov-korak-form \.kontakt-kartice/);
assert.doesNotMatch(cssSrc, /#opomin-nov-korak-form \.step-content-card__header/);
assert.match(uiSrc, /htmlKontaktneKartice\(ctx\)/);
assert.match(uiSrc, /var casSekcijaHtml = ctx\.casPriporociloVgnezdenoHtml \|\|/);
assert.match(cssSrc, /\.opomin-nacrt__predizbor-meni\s*\{[\s\S]*bottom:\s*var\(--opomin-predizbor-bottom/);
assert.match(cssSrc, /\.opomin-preoblikuj\s*\{[\s\S]*margin:\s*-8px 0 14px/);
assert.match(cssSrc, /\.opomin-nov-korak__vsebina \.step-content-card--lastni-korak\s*\{[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;/);
assert.match(cssSrc, /\.opomin-nov-korak__polje input:focus,[\s\S]*\.opomin-nov-korak__polje input:focus-visible\s*\{[\s\S]*border-color:\s*#75b9b5;[\s\S]*outline:\s*0;[\s\S]*box-shadow:\s*none;/);
assert.match(cssSrc, /\.opomin-nacrt__napredek-vrstica\s*\{[\s\S]*align-items:\s*center/);
assert.match(cssSrc, /\.opomin-nacrt__napredek-levo\s*\{[\s\S]*flex-direction:\s*column/);
assert.match(htmlSrc, /opomin-nacrt\.js\?v=/);
assert.match(htmlSrc, /opomin-nacrt-ui\.js\?v=/);
assert.match(uiSrc, /return !s\.isExcluded && !s\.customCardDraft/);
assert.match(uiSrc, /step\.index === aktivenIndex && !step\.customCardDraft/);
assert.match(uiSrc, /!novKorakUrejevalnikOdprt &&\s*zadnjiOdstranljivKorak/);
assert.match(cssSrc, /\.opomin-preoblikuj__zavihki\s*\{/);
assert.match(uiSrc, /--stage-accent-strong:color-mix\(in srgb,/);
assert.match(uiSrc, /class="opomin-nov-korak" id="opomin-nov-korak-form" style=/);
assert.ok(N.BARVE_KORAKA_PO_MERI.length >= 20, "izbirnik mora ponuditi vsaj 20 barv");
assert.match(uiSrc, /Podrsaj za več/);
assert.doesNotMatch(uiSrc, /Svoja barva|opomin-nov-korak-lastna-barva/);
assert.match(cssSrc, /\.opomin-nov-korak__barve > \.opomin-nov-korak__barvna-vrstica\s*\{[\s\S]*display:\s*flex;[\s\S]*overflow-x:\s*auto;/);
assert.doesNotMatch(cssSrc, /grid-template-columns:\s*repeat\(6[^}]*opomin-nov-korak__barvna-vrstica/);
assert.match(uiSrc, /function postaviPredizborNadGumb\(\)/);
assert.match(uiSrc, /document\.body\.appendChild\(predizborMeni\);\s*postaviPredizborNadGumb\(\);/);
assert.match(uiSrc, /document\.addEventListener\("scroll", osveziPredizborPolozaj,[\s\S]*capture:\s*true/);
assert.match(uiSrc, /document\.removeEventListener\("scroll", osveziPredizborPolozaj, true\)/);
assert.match(uiSrc, /window\.visualViewport\.addEventListener\("scroll", osveziPredizborPolozaj\)/);
assert.match(uiSrc, /zacniSleditiPredizborGumbu\(\);\s*window\.requestAnimationFrame\(postaviPredizborNadGumb\);/);
assert.match(uiSrc, /Ni shranjenih bližnjic\. Dodaš jih v »Določi čas«\./);
assert.match(uiSrc, /opomin-preoblikuj__odpri-puscica[\s\S]*m6\.5 9\.5 5\.5 5 5\.5-5/);
assert.doesNotMatch(uiSrc, /function poravnajPreoblikujKartico/);
assert.match(uiSrc, /var izbranaPredlogaKatalogaId/);
assert.match(uiSrc, /var preoblikujScrollLeft = 0/);
assert.match(uiSrc, /var klikanaId = btn\.getAttribute\("data-preoblikuj-predloga"\)/);
assert.match(uiSrc, /if \(izbranaPredlogaKatalogaId === klikanaId\)/);
assert.match(uiSrc, /p\.id === izbranaPredlogaKatalogaId/);
assert.doesNotMatch(uiSrc, /izbranaPredlogaKartice\[aktivenIndex\] = btn\.getAttribute/);
assert.match(htmlSrc, /opomin-kartice-sync\.js\?v=20260823-confirmation-refresh-v6/);
assert.match(htmlSrc, /opomin-nacrt-ui\.js\?v=[^"']+/);
assert.match(
  uiSrc,
  /function shraniIzbiroKoraka\(\)[\s\S]*?N\.shraniOsnutek\(plan\)[\s\S]*?UJOpominKarticeSync\.narociShranjevanje\(plan\)/,
  "Klik kartice mora shraniti samo izbiro brez prepisovanja dodatkov"
);
assert.match(
  uiSrc,
  /plan\.selectedStageId = \(izbranKorak \|\| \{\}\)\.id;\s*shraniIzbiroKoraka\(\);\s*izrisiGlavni\(\);/,
  "Preklop kartice ne sme klicati splosnega shrani(), ki razveljavi kljukico"
);

let plan = N.narediNovPlan(
  { imeDolznika: "Testni dolžnik", znesek: 9446, datumZapadlosti: "2026-08-01" },
  { toneRecommendation: { selectedToneId: "friendly" }, sporociloDolzniku: "Izvirno besedilo" }
);

// Starejši shranjeni načrti imajo lahko več korakov od trenutne predloge.
// Nadgradnja takega načrta ne sme prekiniti izrisa celotne strani.
const predolgPlan = N.narediNovPlan(
  { imeDolznika: "Testni dolžnik", znesek: 9446, datumZapadlosti: "2026-08-01" },
  { toneRecommendation: { selectedToneId: "friendly" }, sporociloDolzniku: "Izvirno besedilo" }
);
predolgPlan.steps.push({ ...predolgPlan.steps[0], id: "stari-dodatni-korak", index: predolgPlan.steps.length });
assert.doesNotThrow(() => N.zamenjajNeureljivZadnjiKorak(predolgPlan, {}, {}));
assert.equal(predolgPlan.steps.at(-1).id, "stari-dodatni-korak");

const zadnjaOriginalnaKartica = plan.steps.at(-1);
zadnjaOriginalnaKartica.isExcluded = true;
plan = N.zagotoviVkljucenZadnjiRocniKorak(plan);
assert.equal(zadnjaOriginalnaKartica.kind, "manual_lawyer");
assert.equal(zadnjaOriginalnaKartica.isExcluded, false);
const prvi = plan.steps[0];
const sporociloPred = prvi.finalMessage;
prvi.status = "confirmed";
prvi.confirmedAt = new Date().toISOString();
plan = N.nastaviTonKoraka(plan, prvi.index, "super_strict");
assert.equal(prvi.toneId, "super_strict");
assert.equal(prvi.finalMessage, sporociloPred);
assert.equal(prvi.status, "needs_review");
assert.equal(prvi.confirmedAt, null);

const predaja = plan.steps.find((s) => s.kind === "manual_lawyer");
N.nastaviTonKoraka(plan, predaja.index, "friendly");
assert.equal(predaja.toneId, null);

assert.equal(N.PREDLOGE_PREOBLIKOVANJA.length, 10);
assert.equal(N.BARVE_KORAKA_PO_MERI.length, 20);
const skriti = plan.steps[4];
skriti.isExcluded = true;
plan = N.zacniKorakPoMeri(plan, {
  imeDolznika: "Testni dolžnik",
  stevilkaRacuna: "R-10",
  amountCents: 944600,
});
assert.equal(skriti.isExcluded, false);
assert.equal(skriti.customCardDraft, true);
assert.equal(plan.selectedStageId, skriti.id);
plan = N.posodobiVidezKorakaPoMeri(plan, skriti.index, {
  title: "  Osebni   opomin  ",
  colorId: "orange",
  colorHex: "#7a4bd8",
});
skriti.finalMessage = "Moje besedilo po meri";
plan = N.dokoncajKorakPoMeri(plan, skriti.index, {
  title: "  Osebni   opomin  ",
  colorId: "orange",
  colorHex: "#7a4bd8",
});
assert.equal(skriti.customCardTitle, "Osebni opomin");
assert.equal(skriti.customCardDraft, undefined);
assert.equal(skriti.customCardColor, "orange");
assert.equal(skriti.customCardColorHex, "#7a4bd8");
assert.equal(skriti.customCardColorLevel, 6);
assert.equal(skriti.toneId, "super_friendly");
assert.equal(skriti.finalMessage, "Moje besedilo po meri");
assert.equal(plan.selectedStageId, skriti.id);
N.shraniOsnutek(plan);
const ponovnoNalozen = N.naloziOsnutek();
const shranjenPoMeri = ponovnoNalozen.steps.find((s) => s.id === skriti.id);
assert.equal(shranjenPoMeri.customCardTitle, "Osebni opomin");
assert.equal(shranjenPoMeri.customCardColor, "orange");
assert.equal(shranjenPoMeri.customCardColorHex, "#7a4bd8");

const drugiSkriti = plan.steps[5];
drugiSkriti.isExcluded = true;
plan = N.zacniKorakPoMeri(plan, { amountCents: 944600 });
assert.equal(drugiSkriti.customCardDraft, true);
plan = N.prekliciKorakPoMeri(plan, drugiSkriti.index, { amountCents: 944600 });
assert.equal(drugiSkriti.isExcluded, true);
assert.equal(drugiSkriti.customCardDraft, undefined);
assert.equal(drugiSkriti.customCardTitle, undefined);
const sporociloPredPreoblikovanjem = prvi.finalMessage;
plan = N.preoblikujOpomin(plan, prvi.index, "card-4", {
  imeDolznika: "Testni dolžnik",
  stevilkaRacuna: "R-10",
  amountCents: 944600,
});
assert.equal(prvi.cardTemplateId, "card-4");
assert.equal(prvi.cardTemplateTitle, "Strog opomin");
assert.equal(prvi.toneId, "strict");
assert.equal(prvi.templateSelectionMode, "manual");
assert.notEqual(prvi.finalMessage, sporociloPredPreoblikovanjem);
assert.match(prvi.finalMessage, /Letzte Mahnung/);

plan = N.uporabiMojKorak(plan, prvi.index, {
  id: "moj-hitri-opomin",
  title: "Moj hitri opomin",
  colorId: "blue",
  colorHex: "#4f8fca",
  toneId: "firm",
  templateId: "card-2",
  message: "Moje ponovno uporabljivo besedilo",
});
assert.equal(prvi.customCardLibraryId, "moj-hitri-opomin");
assert.equal(prvi.customCardTitle, "Moj hitri opomin");
assert.equal(prvi.customCardColor, "blue");
assert.equal(prvi.customCardColorHex, "#4f8fca");
assert.equal(prvi.toneId, "firm");
assert.equal(prvi.finalMessage, "Moje ponovno uporabljivo besedilo");

plan = N.ponastaviPreoblikovanOpomin(plan, prvi.index, {
  imeDolznika: "Testni dolžnik",
  stevilkaRacuna: "R-10",
  sporociloDolzniku: "Izvirno besedilo",
  amountCents: 944600,
});
assert.equal(prvi.toneId, "friendly");
assert.equal(prvi.cardTemplateId, undefined);
assert.equal(prvi.cardTemplateTitle, undefined);
assert.equal(prvi.templateSelectionMode, "automatic");
assert.doesNotMatch(prvi.finalMessage, /Letzte Mahnung/);

console.log("OK: upravljanje kartic in tona izbrane kartice");
