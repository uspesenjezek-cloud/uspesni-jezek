"use strict";
var assert = require("node:assert/strict");
var fs = require("node:fs");
var vm = require("node:vm");
var path = require("node:path");
var source = fs.readFileSync(path.join(__dirname, "../app/bonitetna-preverba.js"), "utf8");
function section(start, end) {
  var offset = source.indexOf(start);
  assert.ok(offset >= 0 && source.indexOf(end, offset) > offset);
  return source.slice(offset, source.indexOf(end, offset));
}
function load(box, start, end) { vm.runInContext(section(start, end), box); }
function sandbox() {
  var fields = {
    "boniteta-ime": { value: "New Audit GmbH" },
    "boniteta-naslov-podjetja": { value: "Old Street 1" },
    "boniteta-posta": { value: "10115" },
    "boniteta-kraj": { value: "Berlin" },
    "boniteta-register": { value: "HRB 99999" },
    "boniteta-davcna": { value: "DE999999999" },
    "boniteta-spletna-stran": { value: "https://old.example.test" }
  };
  var box = vm.createContext({
    fields: fields, document: { getElementById: function (id) { return fields[id]; } },
    preverjanjeVTehniku: false, nacinVnosa: "surovo_ime", izbranoOpenRegisterPodjetje: null,
    spletnaPolje: fields["boniteta-spletna-stran"], krajPolje: fields["boniteta-kraj"],
    krajiTrenutnePoste: [], autocompleteZaporedje: 0, zaporedjePostnePoizvedbe: 0,
    obrazec: { reportValidity: function () { return true; } },
    pocistiNapako: function () {}, nastaviNalaganje: function () {},
    pridobiToken: async function () { return "test-token"; },
    potek: {}, vnosPodrobnosti: {},
    pokaziNapako: function (message) { throw new Error(message); },
    nastaviHeroNapako: function (message) { throw new Error(message); },
    odpriAutocomplete: function () {}, nastaviHeroPodjetje: function () {}, pocistiHeroSporocilo: function () {}
  });
  box.izpolniRazbranoPolje = function (id, value) { fields[id].value = value; };
  box.izvediPrekoCakalneVrste = async function (input) { box.sent = input; return null; };
  load(box, "  function prvaVrednost(", "  function imaSvezeDokazilo");
  load(box, "  function normalizirajOpenRegisterPodjetje(", "  function izrisiAutocompleteZadetke(");
  load(box, "  function izberiAutocompletePodjetje(", "  window.UJBonitetaZacniIzbranoPodjetje");
  load(box, "  async function izvediBonitetnoPreverbo(", "  obrazec.addEventListener(\"submit\"");
  return box;
}
async function main() {
  for (var register of ["HRB", "HRA"]) {
    var box = sandbox();
    var raw = { company_id: "DE-" + register + "-B1103-12345", name: "Audit GmbH", register_type: register,
      register_number: "12345", register_court: "Berlin", source: "openregister_ambiguous",
      address: { street: "New Street 2", postal_code: "10117", city: "Berlin" },
      identity_proof: "test-signature", source_id: "local-123", vat_id: "DE123456789", website_url: "https://new.example.test" };
    var normalized = box.normalizirajOpenRegisterPodjetje({}, raw);
    assert.equal(normalized.street, "New Street 2");
    assert.deepEqual(box.normalizirajOpenRegisterPodjetje({}, normalized), normalized);
    assert.deepEqual(box.normalizirajOpenRegisterPodjetje(normalized, {}), normalized);
    box.izberiAutocompletePodjetje(normalized);
    assert.equal(box.izbranoOpenRegisterPodjetje.companyId, raw.company_id);
    assert.equal(box.fields["boniteta-register"].value, register + " 12345");
    assert.equal(box.nacinVnosa, "register");
  }
  for (var oldUrl of ["", "https://old.example.test"]) {
    var rawBox = sandbox();
    rawBox.spletnaPolje.value = oldUrl;
    // Even incomplete stale manual input must not block a name-only request.
    rawBox.fields["boniteta-posta"].value = "12";
    await rawBox.izvediBonitetnoPreverbo();
    assert.equal(rawBox.sent.ime, "New Audit GmbH");
    assert.equal(rawBox.sent.rawNameIdentitySearch, true);
    for (var key of ["naslov", "postnaStevilka", "kraj", "spletnaStran", "registerNumber", "vatId"])
      assert.equal(rawBox.sent[key], "", "Staro polje ne sme v surovo iskanje: " + key);
  }
  var manual = sandbox();
  manual.nacinVnosa = "rocno";
  await manual.izvediBonitetnoPreverbo();
  assert.equal(manual.sent.naslov, "Old Street 1");
  assert.equal(manual.sent.registerNumber, "HRB 99999");
  assert.equal(manual.sent.spletnaStran, "https://old.example.test");
  assert.equal(manual.sent.rawNameIdentitySearch, false);
  var flow = sandbox();
  Object.assign(flow, { univerzalnoIskanjeVTehniku: false, heroSpletnaPolje: { value: "New Audit GmbH" },
    heroPreveriGumb: {}, razvrstiUniverzalniVnos: function (value) { return { vrsta: "podjetje", vrednost: value }; },
    naloziBrezplacneAutocompleteZadetke: async function () {}, naloziOdprtiRegisterZadetke: async function () { return []; },
    zdruziAutocompleteZaPrikaz: function () { return []; }, filtrirajAutocompleteZadetke: function () { return []; },
    zanesljivEnolicniZadetek: function () { return null; }
  });
  load(flow, "  async function izvediUniverzalnoIskanje(", "  function odpriAutocomplete(");
  await flow.izvediUniverzalnoIskanje();
  assert.equal(flow.sent.rawNameIdentitySearch, true);
  assert.equal(flow.zaporedjePostnePoizvedbe, 1);
  for (var id of Object.keys(flow.fields).filter(function (id) { return id !== "boniteta-ime"; }))
    assert.equal(flow.fields[id].value, "", "Nov vnos mora počistiti: " + id);
  console.log("PASS: ambiguous HRB/HRA selection, idempotent identity, raw-name isolation, manual input and transition.");
}
main().catch(function (error) { console.error(error); process.exitCode = 1; });
