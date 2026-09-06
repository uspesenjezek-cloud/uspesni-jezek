"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var html = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.html"), "utf8");
var ui = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.js"), "utf8");
var center = fs.readFileSync(path.join(root, "app", "boniteta-sredisce.js"), "utf8");
var css = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.css"), "utf8");
var reachable = html + "\n" + ui + "\n" + center + "\n" + css;

[
  "Rezultat preverbe",
  "DOKAZILA OSNOVNE PREVERBE",
  "Uporabljeni viri",
  "boniteta-rezultat-okno",
  "boniteta-rezultat-je-okno",
  "boniteta-preverjeni-viri",
  "boniteta-viri",
  "boniteta-izbrisi-preverbo",
  "boniteta-ponovi",
  "nastaviRezultatKotOkno",
  "UJBonitetaNastaviRezultatKotOkno",
  "izrisiVire",
  "boniteta-spletna-rezerva",
  "boniteta-rezerva-spletna",
  "boniteta-rezerva-brez-spletne",
  "OK, zmenjeno",
  "Nima spletne strani",
].forEach(function (legacyMarker) {
  assert.ok(!reachable.includes(legacyMarker), "Legacy vmesni zaslon ne sme biti dosegljiv: " + legacyMarker);
});

assert.match(ui, /if \(jeDokazniPregled && identiteta\.status !== "probable_impressum"\) \{[\s\S]*?nastaviInsolvencnoOkno\(true, false\);/,
  "probable Impressum mora najprej prikazati profil; blokirana dokazna pot lahko odpre pregled neposredno");
assert.match(ui, /potrditevGumb\.dataset\.identityEvidenceRetry = "true";[\s\S]*?"Poskusi zajem znova"/,
  "capture failure mora ostati v blokiranem retry stanju");
assert.match(ui, /rezultat\.hidden = false;[\s\S]*?if \(jeDokazniPregled && identiteta\.status !== "probable_impressum"\)/,
  "renderer mora probable Impressum pustiti na profilu do izrecnega klika uporabnika");
assert.match(ui, /if \(identitetaImaKompaktniPrikaz\) \{[\s\S]*?podjetjeSklop\.hidden = false;[\s\S]*?UJBonitetaPrikaziRegistrskoPodjetje/,
  "potrjeni rezultat mora po dokaznem pregledu znova prikazati glavno kartico podjetja");
assert.match(ui, /if \(nadaljujVInsolvencnemOknu && lahkoOdpreRocnoPotrditev && !zadnjiInsolvencniRezultatPripravljen\)[\s\S]*?else if \(zadnjiInsolvencniRezultatPripravljen\)[\s\S]*?nastaviInsolvencnoOkno\(nadaljujVInsolvencnemOknu, nadaljujVInsolvencnemOknu\)/,
  "izrecno sprožen insolvenčni tok mora po zaključku ostati na dokaznem izidu");
assert.match(css, /boniteta-profil-je-okno \.boniteta-obrazec,[\s\S]*?boniteta-insolvenca-je-okno \.boniteta-obrazec[\s\S]*?display: none !important/,
  "profil in insolvenčni detail morata biti samostojna pogleda brez začetnega wizarda");
assert.match(center, /data-boniteta-center-view="new"[\s\S]*?boniteta-profil-je-okno[\s\S]*?boniteta-insolvenca-je-okno[\s\S]*?UJBonitetaPonastaviNovoPreverbo/,
  "klik Preveri mora zapreti profil ali detail in vrniti začetni obrazec");
assert.match(css, /boniteta-insolvenca-okno__spodnja-vrstica[\s\S]*?bottom: max\(8px, env\(safe-area-inset-bottom, 0px\)\)/,
  "gumb Nazaj mora biti pod spodnjo navigacijo in ne sme prekrivati dokazov");
assert.match(ui, /Impressuma trenutno ni bilo mogoče varno zajeti[\s\S]*?neposredni URL Impressuma/,
  "neuspešen URL mora ostati v enem dokaznem retry toku brez dokumentnega obvoda");

console.log("Boniteta legacy result screen removal tests passed.");
