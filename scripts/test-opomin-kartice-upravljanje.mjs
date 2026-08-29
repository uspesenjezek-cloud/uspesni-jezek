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
assert.match(uiSrc, /opomin-nacrt__napredek-tekst">Potrjeno<\/p>/);
assert.doesNotMatch(uiSrc, /opomin-nacrt__napredek-tekst">Koraki:<\/p>/);
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
assert.match(uiSrc, />Privzeto <span>/);
assert.match(uiSrc, />Moji koraki <span>/);
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
assert.match(cssSrc, /\.opomin-nacrt__cas-povzetek-mreza\s*\{[\s\S]*?margin:\s*0 0 12px;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-povzetek-karta\s*\{[\s\S]*?border-left:\s*3px solid #e5a719;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-povzetek-mreza\s*\{[\s\S]*?grid-template-columns:\s*58% 42%;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-povzetek-vrstica:last-child\s*\{[\s\S]*?padding-bottom:\s*2px;/);
assert.match(cssSrc, /\.opomin-nacrt__cas-povzetek-vrstica:last-child\s*\{[\s\S]*?border-left:\s*1px solid #e2ecea;/);
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
assert.match(uiSrc, /function htmlPreoblikujKartico\(korak, vsebinaKorakaHtml\)/);
assert.match(uiSrc, /class="opomin-nov-korak__vsebina">' \+ \(vsebinaKorakaHtml \|\| ""\)/);
assert.match(uiSrc, /htmlPreoblikujKartico\(step, novKorakUrejevalnikOdprt \? vsebinaHtml : ""\)/);
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
