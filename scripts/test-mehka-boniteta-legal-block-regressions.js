"use strict";

const assert = require("assert");
const test = require("../api/_handlers/mehka-boniteta")._test;

function parse(lines, input) {
  return test.razcleniImpressum(
    "<main><h1>Impressum</h1><p>" + lines.join("<br>") + "</p></main>",
    "https://example-handwerk.de/impressum/",
    input || {}
  );
}

let subject = parse([
  "Florian Johannsen GmbH und Co. KG",
  "Breite Straße 10",
  "21646 Halvesbostel",
  "Geschäftsführer: Florian Johannsen",
]);
assert(subject);
assert.strictEqual(subject.naziv, "Florian Johannsen GmbH und Co. KG");
assert.strictEqual(subject.identityProvenance.legalForm, "GmbH und Co. KG");

subject = parse([
  "Grabpflege Brumm",
  "Inhaber: Michael Brumm",
  "Zugspitzstr. 2",
  "Eingang: Tegernseer Landstraße",
  "81541 München",
]);
assert(subject);
assert.strictEqual(subject.naziv, "Grabpflege Brumm");
assert.strictEqual(subject.ime, "Michael Brumm");
assert.strictEqual(subject.naslov, "Zugspitzstr. 2");

subject = parse([
  "Böttcherei Messerschmidt",
  "Inhaber: Denis Merten",
  "Telefon: 03362 8966",
  "Berliner Straße 26",
  "15537 Gosen-Neu Zittau",
  "Zuständige Kammer: Handwerkskammer Frankfurt (Oder)",
]);
assert(subject);
assert.strictEqual(subject.naziv, "Böttcherei Messerschmidt");
assert.strictEqual(subject.ime, "Denis Merten");
assert.strictEqual(subject.naslov, "Berliner Straße 26");
assert.strictEqual(subject.postnaStevilka, "15537");

subject = parse([
  "Weingut Friedrichshof",
  "Inhaber: Harald Schmitt",
  "Bildstockstr. 8",
  "55283 Nierstein",
  "Aufsichtsbehörde",
  "Ministerium für Wirtschaft, Verkehr, Landwirtschaft und Weinbau Rheinland-Pfalz",
  "Stiftsstraße 9",
  "55116 Mainz",
]);
assert(subject);
assert.strictEqual(subject.naziv, "Weingut Friedrichshof");
assert.strictEqual(subject.ime, "Harald Schmitt");
assert.strictEqual(subject.naslov, "Bildstockstr. 8");

subject = parse([
  "Fotostudio Pötzsch",
  "Inhaber: Jens Müller",
  "Georg-Schumann-Straße 294",
  "04159 Leipzig",
  "Haftungsausschluss",
  "Widerrufsrecht",
]);
assert(subject);
assert.strictEqual(subject.naziv, "Fotostudio Pötzsch");
assert.strictEqual(subject.ime, "Jens Müller");

subject = parse([
  "Orthopädie-Schuhtechnik Adelmann",
  "Oliver Adelmann (Inhaber)",
  "Krämerstraße 15",
  "41460 Neuss",
]);
assert(subject);
assert.strictEqual(subject.naziv, "Orthopädie-Schuhtechnik Adelmann");
assert.strictEqual(subject.ime, "Oliver Adelmann");

subject = parse([
  "Buchbinderei Sanders oHG",
  "Neumann-Reichardt-Str. 27-33",
  "(Haus 21)",
  "22041 Hamburg (Wandsbek)",
  "Geschäftsführer: Lars Sanders",
]);
assert(subject);
assert.strictEqual(subject.naslov, "Neumann-Reichardt-Str. 27-33");
assert.strictEqual(subject.postnaStevilka, "22041");

subject = parse([
  "MDS Messebau und Service GmbH",
  "Musterweg 7",
  "21079 Hamburg",
  "Webdesign: Fremde Agentur GmbH",
  "Agenturstraße 4",
  "20095 Hamburg",
]);
assert(subject);
assert.strictEqual(subject.naziv, "MDS Messebau und Service GmbH");
assert.strictEqual(subject.naslov, "Musterweg 7");

subject = parse([
  "Orthopädie-Schuhtechnik Adelmann",
  "Inhaber: Oliver Adelmann (Einzelunternehmer)",
  "Krämerstraße 15",
  "41460 Neuss",
]);
assert(subject);
assert.strictEqual(subject.ime, "Oliver Adelmann");

subject = parse([
  "Kai und Kristin Fotografie",
  "Inhaberin: Kristin Lurtz, Fotografin",
  "Hafenstraße 8 b, 04179 Leipzig",
  "zuständige Kammer: Handwerkskammer Leipzig, Dresdner Straße 11, 04103 Leipzig",
]);
assert(subject);
assert.strictEqual(subject.ime, "Kristin Lurtz");
assert.strictEqual(subject.naslov, "Hafenstraße 8 b");
assert.strictEqual(subject.postnaStevilka, "04179");

assert.strictEqual(test.jeVerjetnoImeOsebe("Widerspruch Werbe-Mails"), false);

console.log("Legal-block parser regressions are successful.");
