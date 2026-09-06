"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.html"), "utf8");
var css = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.css"), "utf8");
var js = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.js"), "utf8");
var apiFiles = [
  path.join(root, "api", "_handlers", "mehka-boniteta.js"),
];

assert.doesNotMatch(html, /boniteta-spletna-rezerva|boniteta-rezerva-spletna|boniteta-rezerva-brez-spletne|OK, zmenjeno|Nima spletne strani/,
  "stari generični fallback zaslon in njegova slepa obvoda ne smeta več obstajati");
assert.match(html, /id="boniteta-hero-podnaslov">Preveri podjetje, osebo ali spletno stran<\/p>/);
assert.match(css, /\.boniteta-hero__naslovna-vrstica p \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/);
assert.match(css, /#boniteta-hero-label \{[^}]*clip: rect\(0 0 0 0\);[^}]*white-space: nowrap;/);
assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.boniteta-hero__naslovna-vrstica \{[^}]*margin-bottom: 8px;/);
assert.match(js, /prikaziPotPoNeuspesnemRegistrskemIskanju\(query\)/);
assert.match(js, /heroPodnaslov\.textContent = "Vnesite spletno stran"/);
assert.match(js, /function poudariVnosSpletneStrani\(\)[\s\S]*classList\.add\("is-guided-focus"\)[\s\S]*}, 1000\)/);
assert.doesNotMatch(js.slice(js.indexOf("function prikaziPotPoNeuspesnemRegistrskemIskanju"), js.indexOf("function jeNeuspesnaSpletnaIdentifikacija")), /v OpenRegisterju|v Impressumu/);
assert.match(js.slice(js.indexOf("function nastaviSpletnoRezervo"), js.indexOf("function prikaziPotPoNeuspesnemRegistrskemIskanju")), /if \(niRegistrskegaZadetka\) nastaviHeroZaSpletnoRezervo\(true\)[\s\S]*?neposredni URL Impressuma[\s\S]*?heroSpletnaPolje\.focus/,
  "neuspeh mora ostati v enem zgornjem URL polju z jasnim navodilom za neposredni Impressum");
assert.match(js, /Insolvenčna preverba ostaja blokirana, dokler posnetek ni pripravljen/,
  "ob neuspelem zajemu mora biti varnostna blokada izrecna");
assert.match(html, /class="boniteta-polje boniteta-polje--celo" data-boniteta-rocni-podatek>\s*<label for="boniteta-spletna-stran">Spletna stran podjetja<\/label>[\s\S]*?for="boniteta-ime"/,
  "spletna stran mora biti vidna na vrhu obrazca za pregled podatkov");
assert.doesNotMatch(html, /id="boniteta-brez-spletne"|id="boniteta-spletna-status"|boniteta-spletna-izbira/,
  "ob polju spletne strani ne sme ostati dodatni widget, gumb ali razlaga");
assert.match(js, /var rocniVnos = nacin === "rocno";[\s\S]*?var popupVnos = rocniVnos \|\| nacin === "dokument";[\s\S]*?nastaviRocniPopup\(popupVnos\);/,
  "ročni in dokumentni vnos morata uporabljati isto modalno okno");
assert.match(js, /if \(stranke\.length === 1\) \{[\s\S]*?izberiRazbranoStranko\(stranke\[0\], null\);[\s\S]*?return false;/,
  "en sam razbrani subjekt mora neposredno odpreti izpolnjen pregled podatkov");
assert.match(js, /var zahtevaIzbiroStranke = izrisiRazbraneStranke\(telo\.stranke\);[\s\S]*?Preverite razbrane podatke\./,
  "po dokumentu mora status razlikovati neposreden pregled od izbire več strank");
assert.doesNotMatch(js, /Vnesite spletno stran ali kliknite »Nima spletne strani«/,
  "spletna stran v ročnem obrazcu mora ostati neobvezna");
assert.match(js, /spletnaPolje\.addEventListener\("input", function \(\) \{\s*potrjenoBrezSpletne = !spletnaPolje\.value\.trim\(\);/,
  "prazno spletno polje mora brez dodatnega gumba pravilno preklopiti na ročni vnos");
assert.doesNotMatch(css, /boniteta-zajem__rezerva|is-spletna-rezerva/,
  "odstranjeni fallback ne sme pustiti mrtvih stilov");
assert.doesNotMatch(js, /ni registrirano podjetje/i);
apiFiles.forEach(function (file) {
  var api = fs.readFileSync(file, "utf8");
  assert.match(api, /var uspesnoPrebranihStrani = 0;/,
    "lokalni zajem mora ločiti neuspeh povezave od resnično prebrane strani brez Impressuma");
  assert.match(api, /status: uspesnoPrebranihStrani \? "not_found" : "unavailable"/,
    "če ni bila uspešno prebrana nobena stran, rezultat ne sme biti lažni not_found");
  assert.match(api, /reason: uspesnoPrebranihStrani \? zadnjiRazlog : \(zadnjaNapakaBranja \|\| "website_unreachable"\)/,
    "omrežna napaka mora ostati vidna kot nedosegljiv vir");
  var manualGate = api.indexOf('if (identiteta.status === "manual_input")');
  var insolvencyRun = api.indexOf("var insolvencaPromise = preveriInsolvenco", manualGate);
  assert.ok(manualGate >= 0, path.relative(root, file) + " mora prepoznati ročni vnos");
  assert.match(api.slice(manualGate, insolvencyRun), /reason: "identity_source_required"/);
  assert.ok(insolvencyRun > manualGate, path.relative(root, file) + " mora ročni vnos ustaviti pred insolvenčno poizvedbo");
});

console.log("Boniteta pot po neuspešnem registrskem iskanju: OK");
