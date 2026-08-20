"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var client = require("../api/_lib/apify-northdata-client");
var queue = require("../api/_lib/mehka-boniteta-queue");
var profileView = require("../app/boniteta-profil");

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

async function main() {
  var official = {
    name: "Beispiel Technik GmbH", register_type: "HRB", register_number: "0012345",
    address: { street: "Musterstraße 1", postal_code: "10115", city: "Berlin", country: "DE" },
  };
  assert.deepStrictEqual(client.buildInput(official), {
    searchQueries: ["HRB 12345"], country: "DE", resultType: "companies",
    includeFinancials: true, includeOfficers: true, includeRelatedCompanies: true,
    includeEvents: true, includeNews: false, maxResults: 3,
  });

  var company = {
    recordType: "company", url: "https://www.northdata.com/Beispiel+Technik+GmbH,+Berlin/HRB+12345",
    name: "Beispiel Technik GmbH", status: "Active", legalForm: "GmbH",
    foundingDate: "2018-04-12", corporatePurpose: "Tehnične storitve.",
    registerNumber: "Berlin HRB 12345", address: { street: "Musterstraße 1", postalCode: "10115", city: "Berlin", country: "DE" },
    officers: [{ name: "Anna Beispiel", role: "Geschäftsführerin", url: "https://www.northdata.com/Anna+Beispiel" }],
    financials: [{ metric: "Revenue", values: [{ year: 2025, value: 125000, formattedValue: "125 k EUR" }] }],
  };
  assert.strictEqual(client.selectCompany([company], official).status, "found");
  assert.strictEqual(client.selectCompany([Object.assign({}, company, { registerNumber: "Berlin HRB 99999" })], official).status, "not_found",
    "enako ime z drugo registrsko številko se ne sme združiti");
  assert.strictEqual(client.sanitizeCompany(Object.assign({}, company, { url: "https://example.test/fake" })), null,
    "vrnjena povezava mora ostati na domeni North Data");

  var calls = [];
  var result = await client.enrichCompany(official, {
    token: "apify-secret-test",
    fetch: async function (url, options) {
      calls.push({ url: String(url), options: options });
      return { ok: true, status: 200, json: async function () { return [company]; } };
    },
  });
  assert.strictEqual(calls.length, 1, "plačljivi actor se sme poklicati samo enkrat");
  assert.ok(calls[0].url.includes("/acts/9nsu4ZqEMU7DzdcW4/run-sync-get-dataset-items"));
  assert.ok(calls[0].url.includes("maxTotalChargeUsd=0.02"));
  assert.ok(!calls[0].url.includes("apify-secret-test"), "žeton ne sme biti v URL-ju");
  assert.strictEqual(calls[0].options.headers.Authorization, "Bearer apify-secret-test");
  assert.strictEqual(result.status, "found");
  assert.strictEqual(result.company.foundingDate, "2018-04-12");
  assert.ok(result.estimatedCostUsd <= 0.02);

  var failedCalls = 0;
  var failed = await client.enrichCompany(official, {
    token: "apify-secret-test",
    fetch: async function () { failedCalls += 1; return { ok: false, status: 500, json: async function () { return {}; } }; },
  });
  assert.strictEqual(failedCalls, 1, "plačljivega neuspešnega klica ni dovoljeno samodejno ponoviti");
  assert.strictEqual(failed.status, "unavailable");
  assert.strictEqual((await client.enrichCompany(official, { token: "", fetch: async function () { throw new Error("ne sme biti poklicano"); } })).status, "not_configured");

  var identity = { status: "verified_register", entityType: "company", incorporatedAt: "", purpose: "", ime: official.name, naslov: "Musterstraße 1" };
  var enriched = await client.enrichVerifiedIdentity({ status: "found", company: official }, identity, {
    token: "apify-secret-test",
    fetch: async function () { return { ok: true, status: 200, json: async function () { return [company]; } }; },
  });
  assert.strictEqual(enriched.identity.incorporatedAt, "2018-04-12");
  assert.strictEqual(enriched.identity.purpose, "Tehnične storitve.");
  assert.strictEqual(enriched.identity.ime, official.name, "dopolnilni vir ne sme prepisati uradne identitete");
  assert.strictEqual(enriched.source.id, "northdata");
  assert.strictEqual((await client.enrichVerifiedIdentity({ status: "not_found" }, identity, { token: "apify-secret-test" })).northData.status, "skipped");
  assert.strictEqual((await client.enrichVerifiedIdentity({ status: "found", company: official }, Object.assign({}, identity, {
    entityType: "person",
  }), { token: "apify-secret-test", fetch: async function () { throw new Error("oseba ne sme sprožiti actorja"); } })).northData.status, "skipped",
  "North Data actor se ne sme zagnati za fizične osebe");

  ["api/_handlers/mehka-boniteta.js", "api/mehka-boniteta.js"].forEach(function (file) {
    var api = source(file);
    assert.match(api, /enrichVerifiedIdentity\(openregister, identiteta\)/);
    assert.strictEqual((api.match(/enrichVerifiedIdentity\(openregister, identiteta\)/g) || []).length, 1,
      "končna faza sme vsebovati samo en plačljiv North Data klic");
    assert.ok(api.indexOf("enrichVerifiedIdentity(openregister, identiteta)") > api.indexOf("identiteta = potrditev.identity"),
      "North Data se sme zagnati šele po uporabnikovi potrditvi identitete");
    assert.match(api, /Promise\.all\(\[northDataPromise, insolvencaPromise\]\)/,
      "North Data in insolvenčna poizvedba morata teči vzporedno");
    assert.match(api, /northData: northData/);
    assert.match(api, /viri\.push\(northDataObogatitev\.source\)/);
  });
  assert.strictEqual(queue._test.NORTHDATA_ENRICHMENT_VERSION, "northdata-apify-v1");
  assert.match(source("scripts/local-server.js"), /APIFY_API_TOKEN/,
    "lokalni strežnik mora naložiti strežniški Apify žeton iz .env.local");
  assert.match(source("app/bonitetna-preverba.js"), /northData: podatki\.northData \|\| null/);
  assert.match(source("app/boniteta-profil.js"), /function northDataPayload\(\)/);
  assert.match(source("app/boniteta-profil.js"), /Vključeno v osnovno preverbo · North Data/);
  var currentFinancials = profileView.northDataFinancials({ company: {
    revenue: 125000, earnings: 19000, employees: 12,
  } });
  assert.strictEqual(currentFinancials.indicators.length, 1,
    "trenutni finančni podatki se morajo prikazati tudi brez zgodovinskega niza");
  assert.strictEqual(currentFinancials.indicators[0].revenue, 125000);
  assert.strictEqual(currentFinancials.indicators[0].net_income, 19000);
  assert.strictEqual(currentFinancials.indicators[0].employees, 12);
  assert.match(profileView.northDataNetworkHtml({ company: {
    officers: [{ name: "Anna Beispiel", role: "Geschäftsführerin" }],
    relatedCompanies: [{ name: "Povezana GmbH", relationships: ["Shared officer"] }],
  } }), /Vodstvo in povezave niso isto kot dokazano lastništvo/);
  console.log("✓ North Data actor je omejen, varen in povezan z osnovno bonitetno preverbo.");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
