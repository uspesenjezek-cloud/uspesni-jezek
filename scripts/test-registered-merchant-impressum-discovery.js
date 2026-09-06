"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var test = require("../api/_handlers/mehka-boniteta")._test;

var jetRepairOpenRegister = {
  status: "found",
  company: {
    name: "Jet-Repair e.K.", legal_form: "e.K.", company_id: "DE-HRA-R1101-21258",
    register_type: "HRA", register_number: "21258", register_court: "Düsseldorf", active: true,
    address: { street: "Oberbilker Allee 280", postal_code: "40227", city: "Düsseldorf" },
  },
};
var jetRepairProfil = {
  status: "found", sourceUrl: "https://www.jet-repair.de/impressum/",
  subjekt: {
    ime: "Jet-Repair e.K.", naziv: "Jet-Repair e.K.", entityType: "company", nosilec: "Özgür Akarsu",
    zastopniki: ["Özgür Akarsu"], vloge: [{ ime: "Özgür Akarsu", vloga: "Inhaber" }],
    naslov: "Oberbilker Allee 280", postnaStevilka: "40227", kraj: "Düsseldorf",
    registerNumber: "HRA 21258", sourceUrl: "https://www.jet-repair.de/impressum/",
    identityProvenance: { status: "coherent" },
  },
};

(async function () {
  assert.strictEqual(test.potrebujeImpressumDopolnitev(jetRepairOpenRegister, {}), true,
    "potrjeni e.K. mora poiskati pravni Impressum tudi pri lokalni kartici brez URL-ja");
  assert(test.ustvariRegistrskeDomenskeKandidate(jetRepairOpenRegister.company).includes("https://jet-repair.de/"));
  assert(test.ustvariRegistrskeDomenskeKandidate({
    name: "Matthias Dührsen e. K. SRS Nord Solarreinigung + Service Nord", legal_form: "e.K.",
  }).includes("https://srsnord.de/"), "soroden e.K. mora dobiti kratko domensko jedro za pravno obliko");
  assert.deepStrictEqual(test.ustvariRegistrskeDomenskeKandidate({ name: "Beispiel GmbH", legal_form: "GmbH" }), [],
    "navadna družba ne sme sprožiti tega posebnega iskanja");

  var nalozeni = [];
  var odkrit = await test.odkrijImpressumRegistriranegaTrgovca(jetRepairOpenRegister, {
    candidateUrls: ["https://openregister.de/company/DE-HRA-R1101-21258", "https://www.jet-repair.de/impressum/"],
    loadProfile: async function (url) { nalozeni.push(url); return jetRepairProfil; },
  });
  assert.strictEqual(odkrit.sourceUrl, "https://www.jet-repair.de/impressum/");
  assert.deepStrictEqual(nalozeni, ["https://www.jet-repair.de/impressum/"], "agregator ne sme postati Impressum dokaz");

  var napacenProfil = {
    status: "found", sourceUrl: "https://wrong.example/impressum/",
    subjekt: Object.assign({}, jetRepairProfil.subjekt, {
      nosilec: "Erika Beispiel", zastopniki: ["Erika Beispiel"],
      vloge: [{ ime: "Erika Beispiel", vloga: "Inhaber" }],
      naslov: "Druga Straße 1", postnaStevilka: "10115", kraj: "Berlin",
    }),
  };
  assert.strictEqual(await test.odkrijImpressumRegistriranegaTrgovca(jetRepairOpenRegister, {
    candidateUrls: ["https://wrong.example/impressum/"], loadProfile: async function () { return napacenProfil; },
  }), null, "drug naslov ali nosilec ne sme dopolniti registrske identitete");

  var source = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
  var flow = source.slice(source.indexOf("async function handler"), source.indexOf("handler._test"));
  assert.match(flow, /await odkrijImpressumRegistriranegaTrgovca\(openregister\)/,
    "glavni tok mora po OpenRegister zadetku dejansko odkriti Impressum e.K.");
  assert.match(flow, /potrebujeNaknadnoImpressumPotrditev[\s\S]*agentValidation:[\s\S]*pending_background/,
    "odkriti Impressum mora po trajnem rezultatu sprožiti en agentov pregled");
  assert.match(source, /pripraviSamostojniHtmlPravnegaDokaza\(izvirnik\.html, izvirnik\.url\)/,
    "dokazni zajem mora uporabiti že preneseni pravni HTML brez nove odvisnosti od CSS, pisav ali skript strani");
  console.log("✓ Registrirani e.K.: avtomatično odkritje Impressuma, strogo ujemanje in naknadni agent so ožičeni.");
})().catch(function (error) { console.error(error); process.exitCode = 1; });
