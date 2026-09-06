"use strict";

var assert = require("assert");
var test = require("../api/mehka-boniteta")._test;
var vnos = {
  ime: "AK Fernseh- und Hausgeräte Reparaturdienst",
  naslov: "Sievekingdamm 31",
  postnaStevilka: "20535",
  kraj: "Hamburg",
};
var html = "<main><h1>Impressum</h1>" +
  "<p>Webdesign: Vangerow GmbH<br>Web: www.vangerow.de<br>im Auftrag von:</p>" +
  "<p>Meisterbetrieb AK Fernseh- und Hausgeräte Reparaturdienst<br>Sievekingdamm 31<br>20535 Hamburg</p>" +
  "<p>Inhaber: Abdullah Khalliqie<br>Geschäftsform: Einzelunternehmen</p></main>" +
  "<script type='application/ld+json'>{\"@type\":\"Organization\",\"name\":\"Vangerow GmbH\"}</script>";

var zacetek = process.hrtime.bigint();
var subjekt;
for (var i = 0; i < 1000; i += 1) {
  subjekt = test.razcleniImpressum(html, "https://elektro-fachhandel-hamburg.de/impressum/", vnos);
}
var trajanjeMs = Number(process.hrtime.bigint() - zacetek) / 1e6;

assert.strictEqual(subjekt.ime, "Abdullah Khalliqie");
assert.strictEqual(subjekt.naziv, "Meisterbetrieb AK Fernseh- und Hausgeräte Reparaturdienst");
assert.strictEqual(subjekt.entityType, "person");
assert.strictEqual(subjekt.identityProvenance.legalForm, "Einzelunternehmen");
assert.deepStrictEqual(subjekt.identityProvenance.excludedServiceProviders, ["Vangerow GmbH"]);
assert.ok(!subjekt.businessIdentityNames.includes("Vangerow GmbH"));

var identiteta = test.sestaviIdentiteto({ status: "not_found" }, null, {
  status: "found", subjekt: subjekt,
}, vnos);
var pravilna = test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: subjekt.ime, businessName: subjekt.naziv, street: subjekt.naslov,
  postalCode: subjekt.postnaStevilka, city: subjekt.kraj, confirmed: true,
} }, identiteta);
assert.strictEqual(pravilna.status, "valid");

var mesana = test.pripraviPotrditevIdentitete({ confirmedIdentity: {
  name: "Vangerow GmbH", businessName: "Vangerow GmbH", representativeName: "Abdullah Khalliqie",
  street: "Sievekingdamm 31", postalCode: "20535", city: "Hamburg", confirmed: true,
} }, identiteta);
assert.strictEqual(mesana.reason, "confirmed_identity_block_mismatch");

var spremenjena = Object.assign({}, pravilna.identity, {
  ime: "Vangerow GmbH", naziv: "Vangerow GmbH", entityType: "company",
});
assert.deepStrictEqual(test.preveriSkladnostIdentiteteZaInsolvenco(spremenjena), {
  status: "blocked", reason: "identity_block_mismatch",
});

var agencijaZaSubjektom = test.razcleniImpressum(
  "<h1>Impressum</h1><p>Köksal Duman<br>Halmstraße 2<br>60437 Frankfurt am Main</p>" +
  "<p>Inhaber: Köksal Duman</p><p>Webdesign: Fremde Agentur GmbH</p>",
  "https://heizungsmeisterei-duman.de/impressum",
  { ime: "Heizungsmeisterei Duman", postnaStevilka: "60437", kraj: "Frankfurt am Main" }
);
assert.strictEqual(agencijaZaSubjektom.ime, "Köksal Duman");
assert.strictEqual(agencijaZaSubjektom.naziv, "Heizungsmeisterei Duman");

assert.strictEqual(test.personNamePositiveSignal.score("Xyzabc Qhalliqie"), 0);
assert.strictEqual(test.jeVerjetnoImeOsebe("Xyzabc Qhalliqie"), true);

console.log("Mehka boniteta identity-block testi so uspešni.", {
  lexiconSize: test.personNamePositiveSignal.size,
  averageParserMs: Number((trajanjeMs / 1000).toFixed(4)),
});
