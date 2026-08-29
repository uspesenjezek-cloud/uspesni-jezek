"use strict";

var assert = require("assert");
var boniteta = require("../api/mehka-boniteta")._test;
var podvojeniHandler = require("../api/_handlers/mehka-boniteta")._test;

var popolnZapis = {
  status: "verified_api",
  verifiedAt: "2026-08-22T08:00:00.000Z",
  sourceUrl: "https://openregister.de/company/DE-HRB-M1201-39796",
  sourceLabel: "OpenRegister API",
  companyId: "DE-HRB-M1201-39796",
  officialName: "R. Schrankler Sanitäre Installation GmbH Gas- und Wasseranlagen",
  officialStreet: "Bruchfeldstraße 109",
  officialPostalCode: "60528",
  officialCity: "Frankfurt am Main",
  legalForm: "GmbH",
  active: true,
  registerNumber: "HRB 39796",
  registerCourt: "Frankfurt am Main",
};
var dokazilo = boniteta.pripraviDokaziloZaOdgovor(popolnZapis);

assert.strictEqual(dokazilo.screenshotReady, false);
assert.strictEqual(dokazilo.evidenceReady, true);
assert.strictEqual(dokazilo.evidenceKind, "structured_api");
assert.strictEqual(dokazilo.officialStreet, "Bruchfeldstraße 109");
assert.strictEqual(dokazilo.officialPostalCode, "60528");
assert.strictEqual(dokazilo.registerNumber, "HRB 39796");
var podvojenoDokazilo = podvojeniHandler.pripraviDokaziloZaOdgovor(popolnZapis);
assert.strictEqual(podvojenoDokazilo.evidenceReady, true, "Podvojeni strežniški handler mora imeti enako pogodbo dokazila.");
assert.strictEqual(podvojenoDokazilo.evidenceKind, "structured_api");

var registrskaDruzba = {
  status: "verified_register", entityType: "company",
  ime: "R. Schrankler Sanitäre Installation GmbH Gas- und Wasseranlagen",
  naziv: "R. Schrankler Sanitäre Installation GmbH Gas- und Wasseranlagen",
  naslov: "Bruchfeldstraße 109", postnaStevilka: "60528", kraj: "Frankfurt am Main",
  companyId: "DE-HRB-M1201-39796", legalForm: "GmbH", registerNumber: "HRB 39796",
};
var samodejno = boniteta.pripraviSamodejnoRegistrskoPotrditev(registrskaDruzba, dokazilo, null);
assert.strictEqual(samodejno.status, "valid", "Popolna registrska družba ne sme zahtevati ročne potrditve.");
assert.strictEqual(samodejno.identity.verificationMode, "openregister_automatic");
assert.strictEqual(samodejno.identity.automaticallyVerified, true);
assert.notStrictEqual(samodejno.identity.userConfirmed, true, "Samodejna registrska preverba se ne sme predstavljati kot uporabniška potrditev.");
assert.strictEqual(
  podvojeniHandler.pripraviSamodejnoRegistrskoPotrditev(registrskaDruzba, podvojenoDokazilo, null).status,
  "valid",
  "Oba strežniška handlerja morata samodejno nadaljevati z registrsko družbo."
);

var registriraniTrgovec = Object.assign({}, registrskaDruzba, {
  ime: "Matthias Dührsen e.K. SRS Nord Solarreinigung + Service Nord",
  naziv: "Matthias Dührsen e.K. SRS Nord Solarreinigung + Service Nord",
  legalForm: "e.K.", registerNumber: "HRA 12602", companyId: "DE-HRA-K1101-12602",
});
assert.strictEqual(
  boniteta.pripraviSamodejnoRegistrskoPotrditev(registriraniTrgovec, dokazilo, null).reason,
  "registered_merchant_owner_required",
  "e.K. brez dokazano prepoznanega nosilca ne sme sprožiti insolvenčne poizvedbe."
);
assert.strictEqual(
  boniteta.pripraviPotrditevIdentitete({ confirmedIdentity: {
    name: registriraniTrgovec.ime, businessName: registriraniTrgovec.naziv,
    street: registriraniTrgovec.naslov, postalCode: registriraniTrgovec.postnaStevilka,
    city: registriraniTrgovec.kraj, confirmed: true,
  } }, registriraniTrgovec).reason,
  "registered_merchant_owner_required",
  "Stari odjemalec ne sme obiti varovala e.K. samo z uporabniško potrditvijo."
);
var trgovecZNosilcem = Object.assign({}, registriraniTrgovec, { nosilec: "Matthias Dührsen" });
assert.strictEqual(
  boniteta.pripraviSamodejnoRegistrskoPotrditev(trgovecZNosilcem, dokazilo, null).reason,
  "registered_merchant_evidence_unavailable"
);
assert.strictEqual(
  boniteta.pripraviSamodejnoRegistrskoPotrditev(trgovecZNosilcem, dokazilo, { screenshotReady: true }).status,
  "valid",
  "e.K. se sme samodejno nadaljevati šele z nosilcem in dokaznim Impressumom."
);

var nepopolno = boniteta.pripraviDokaziloZaOdgovor({
  status: "verified_api",
  sourceUrl: "https://openregister.de/company/DE-HRB-M1201-39796",
  companyId: "DE-HRB-M1201-39796",
  officialName: "R. Schrankler Sanitäre Installation GmbH Gas- und Wasseranlagen",
  registerNumber: "HRB 39796",
});

assert.strictEqual(nepopolno.evidenceReady, false, "Nepopoln registrski zapis mora ostati blokiran.");
assert.strictEqual(nepopolno.evidenceKind, "");

console.log("✓ OpenRegister družba samodejno nadaljuje; nepopoln zapis in e.K. brez dokazanega nosilca ostaneta blokirana.");
