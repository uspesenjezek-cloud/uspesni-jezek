"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var client = require("../api/_lib/apify-northdata-client");
var profileStore = require("../api/_lib/boniteta-pro-store");
var queue = require("../api/_lib/mehka-boniteta-queue");
var profileView = require("../app/boniteta-profil");

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

async function main() {
  assert.strictEqual(client.ACTOR_ID, "Ja65ilbhWnUTs1Xeb",
    "podrobna dopolnitev mora ostati vezana na Jaka Northdata actor");
  assert.strictEqual(client.TIMEOUT_SECONDS, 11,
    "prvi North Data actor sme preverbo zadržati največ 11 sekund");
  assert.match(source("api/_lib/apify-northdata-client.js"),
    /setTimeout\(function \(\) \{ controller\.abort\(\); \}, TIMEOUT_SECONDS \* 1000\)/,
    "lokalna prekinitev prvega actorja mora nastopiti brez dodatnega pribitka");
  assert.doesNotMatch(source("api/_lib/apify-northdata-client.js"), /silentflow/i,
    "SilentFlow actor se ne sme vrniti v podrobno North Data dopolnitev");
  var official = {
    name: "Beispiel Technik GmbH", register_type: "HRB", register_number: "0012345",
    address: { street: "Musterstraße 1", postal_code: "10115", city: "Berlin", country: "DE" },
  };
  assert.deepStrictEqual(client.buildInput(official), {
    searchQueries: ["Beispiel Technik GmbH"], country: "", resultType: "companies",
    includeFinancials: true, includeOfficers: true, includeRelatedCompanies: true,
    includeEvents: true, includeNews: false, maxResults: 3,
  });

  var company = {
    recordType: "company", url: "https://www.northdata.com/Beispiel+Technik+GmbH,+Berlin/HRB+12345",
    name: "Beispiel Technik GmbH", status: "Active", legalForm: "GmbH",
    foundingDate: "2018-04-12", corporatePurpose: "Tehnične storitve.",
    registerNumber: "Berlin HRB 12345", address: { street: "Musterstraße 1", postalCode: "10115", city: "Berlin", country: "DE" },
    officers: [{ name: "Anna Beispiel", role: "Geschäftsführerin", status: "former", startDate: "2019-01-10", endDate: "2024-01-23", url: "https://www.northdata.com/Anna+Beispiel" }],
    financials: [
      { metric: "Earnings", metricKey: "Earnings", values: [
        { year: "2023", value: 17088.09, formattedValue: "€17,088.09" },
        { year: "2024", value: -28762.56, formattedValue: "€−28,763" },
      ] },
      { metric: "Total assets", metricKey: "BalanceTotal", values: [
        { year: "2023", value: 773243.8, formattedValue: "€773,244" },
        { year: "2024", value: 751024.17, formattedValue: "€751,024" },
      ] },
    ],
  };
  assert.strictEqual(client.selectCompany([company], official).status, "found");
  var wrongCourt = Object.assign({}, company, {
    url: "https://www.northdata.com/Reiner+Grundbesitz+GmbH+Co+KG,+Holzheim/HRB+12345",
    name: "Reiner Grundbesitz GmbH & Co. KG",
    registerNumber: "Augsburg HRB 12345",
    address: { street: "Dorfstraße 2", postalCode: "86684", city: "Holzheim", country: "DE" },
  });
  assert.strictEqual(client.selectCompany([wrongCourt], official).status, "not_found",
    "ista registrska številka pri drugem sodišču in drugem podjetju se ne sme združiti");
  assert.strictEqual(client.selectCompany([wrongCourt, company], official).company.name, company.name,
    "pravilno ime in kraj morata preglasiti enako številko iz napačnega sodišča");
  assert.strictEqual(profileStore._test.veljavenNorthDataZaProfil({ status: "found", company: client.sanitizeCompany(company) }, {
    legalName: official.name, registerNumber: "HRB 12345", registerCourt: "Amtsgericht Berlin", address: official.address,
  }), true, "pravilni North Data rezultat mora biti dovoljen za profil");
  assert.strictEqual(profileStore._test.veljavenNorthDataZaProfil({ status: "found", company: client.sanitizeCompany(wrongCourt) }, {
    legalName: official.name, registerNumber: "HRB 12345", registerCourt: "Amtsgericht Berlin", address: official.address,
  }), false, "napačno podjetje z isto registrsko številko ne sme prepisati profila");
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
  assert.ok(calls[0].url.includes("/acts/Ja65ilbhWnUTs1Xeb/run-sync-get-dataset-items"));
  assert.ok(calls[0].url.includes("timeout=11"), "Apify mora dobiti 11-sekundno omejitev prvega actorja");
  assert.ok(calls[0].url.includes("maxTotalChargeUsd=0.02"));
  assert.ok(!calls[0].url.includes("apify-secret-test"), "žeton ne sme biti v URL-ju");
  assert.strictEqual(calls[0].options.headers.Authorization, "Bearer apify-secret-test");
  assert.strictEqual(result.status, "found");
  var timedOut = await client.enrichCompany(official, {
    token: "apify-secret-test",
    fetch: async function () {
      var timeoutError = new Error("presežena časovna omejitev");
      timeoutError.name = "AbortError";
      throw timeoutError;
    },
  });
  assert.strictEqual(timedOut.status, "unavailable");
  assert.strictEqual(timedOut.reason, "timeout");
  assert.strictEqual(timedOut.company, undefined,
    "po timeoutu podatki prvega North Data actorja ne smejo v rezultat");
  assert.strictEqual(result.company.foundingDate, "2018-04-12");
  assert.deepStrictEqual(result.company.financials.map(function (metric) {
    return { metric: metric.metric, years: metric.values.map(function (entry) { return entry.year; }) };
  }), [
    { metric: "Earnings", years: [2023, 2024] },
    { metric: "Total assets", years: [2023, 2024] },
  ], "dejanski SolidCode finančni časovnici se morata ohraniti");
  var financeView = profileView.northDataFinancials(result);
  assert.deepStrictEqual(financeView.indicators.map(function (entry) {
    return { year: entry.date.slice(0, 4), earnings: entry.net_income, assets: entry.balance_sheet_total };
  }), [
    { year: "2024", earnings: -28762.56, assets: 751024.17 },
    { year: "2023", earnings: 17088.09, assets: 773243.8 },
  ], "North Data metrikama morata napolniti oba grafa v profilu");
  var financeHtml = profileView.financialsHtml(financeView);
  assert.match(financeHtml, /Dobiček/);
  assert.match(financeHtml, /Bilančna vsota/);
  assert.doesNotMatch(financeHtml, /Za ta kazalnik ni zabeležene časovnice/);
  assert.deepStrictEqual({ status: result.company.officers[0].status, startDate: result.company.officers[0].startDate, endDate: result.company.officers[0].endDate },
    { status: "former", startDate: "2019-01-10", endDate: "2024-01-23" },
    "datumi in stanje vodstva se morajo ohraniti za pogled Dodatno");
  assert.ok(result.estimatedCostUsd <= 0.02);

  var importedCalls = [];
  var imported = await client.readExistingRun("s9vXNTpSzV78qYzqd", official, {
    token: "apify-secret-test",
    fetch: async function (url, options) {
      importedCalls.push({ url: String(url), options: options });
      if (String(url).includes("/actor-runs/")) return { ok: true, status: 200, json: async function () { return { data: { actId: client.ACTOR_ID, status: "SUCCEEDED", defaultDatasetId: "dataset-1" } }; } };
      return { ok: true, status: 200, json: async function () { return [company]; } };
    },
  });
  assert.strictEqual(importedCalls.length, 2);
  assert.ok(importedCalls.every(function (call) { return call.options.method === "GET"; }), "uvoz končanega runa ne sme sprožiti plačljivega POST klica");
  assert.strictEqual(imported.status, "found");
  assert.strictEqual(imported.importedRunId, "s9vXNTpSzV78qYzqd");
  assert.strictEqual(imported.estimatedCostUsd, 0);
  assert.strictEqual(imported.company.financials[1].values.length, 2);
  var assetsOnlyView = profileView.northDataFinancials({ company: {
    earnings: 0,
    financials: [company.financials[1]],
  } });
  assert.deepStrictEqual(profileView.financniNiz(assetsOnlyView, "net_income"), [],
    "ničelna pomožna vrednost ne sme ustvariti lažnega grafa dobička");
  assert.strictEqual(profileView.financniNiz(assetsOnlyView, "balance_sheet_total").length, 2,
    "ob objavljeni bilančni vsoti mora biti prvi prikazan dejanski graf sredstev");
  assert.strictEqual(profileView.financniNiz({ indicators: Array.from({ length: 9 }, function (_, index) {
    return { date: String(2017 + index) + "-12-31", balance_sheet_total: 100000 + index };
  }) }, "balance_sheet_total").length, 9, "devet objavljenih let mora ostati vidnih v grafu");

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
    disableCache: true,
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

  var trautIdentity = {
    status: "confirmed_impressum", source: "impressum", entityType: "company",
    ime: "Marius Mertzdorff", naziv: "Traut Sanitär und Heizung GmbH", legalForm: "GmbH",
    registerNumber: "HRB 39465", registerCourt: "Amtsgericht Frankfurt am Main",
    naslov: "Alt Praunheim 21", postnaStevilka: "60488", kraj: "Frankfurt am Main",
  };
  var trautCompany = Object.assign({}, company, {
    url: "https://www.northdata.com/Traut+Sanitaer+und+Heizung+GmbH,+Frankfurt+am+Main/HRB+39465",
    name: "Traut Sanitär und Heizung GmbH", registerNumber: "Frankfurt am Main HRB 39465",
    foundingDate: "1995-01-17", corporatePurpose: "Gas-, Wasser- und Sanitärinstallationen.",
    address: { street: "Alt Praunheim 21", postalCode: "60488", city: "Frankfurt am Main", country: "DE" },
  });
  var trautFallback = await client.enrichVerifiedIdentity({ status: "unavailable", reason: "insufficient_credits" }, trautIdentity, {
    allowConfirmedImpressum: true, disableCache: true, token: "apify-secret-test",
    fetch: async function () { return { ok: true, status: 200, json: async function () { return [trautCompany]; } }; },
  });
  assert.strictEqual(trautFallback.northData.status, "found", "potrjen Impressum z natančnim registrom mora dovoliti North Data dopolnitev tudi ob izčrpani OpenRegister kvoti");
  assert.strictEqual(trautFallback.identity.incorporatedAt, "1995-01-17");
  assert.strictEqual(trautFallback.identity.legalForm, "GmbH", "dopolnilni vir ne sme prepisati pravne oblike iz potrjene identitete");
  assert.strictEqual((await client.enrichVerifiedIdentity({ status: "unavailable" }, trautIdentity, {
    allowConfirmedImpressum: false, token: "apify-secret-test",
  })).northData.status, "skipped", "nepotrjen Impressum ne sme sprožiti North Data actorja");
  assert.strictEqual((await client.enrichVerifiedIdentity({ status: "unavailable" }, Object.assign({}, trautIdentity, {
    registerNumber: "",
  }), { allowConfirmedImpressum: true, token: "apify-secret-test" })).northData.status, "skipped",
  "potrjen Impressum brez natančne registrske oznake ne sme sprožiti dopolnitve");

  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "northdata-cache-test-"));
  var cachePath = path.join(tempDir, "cache.json");
  var paidCalls = 0;
  var cachedOptions = {
    cacheFile: cachePath, disableRemoteCache: true, token: "apify-secret-test",
    fetch: async function () {
      paidCalls += 1;
      return { ok: true, status: 200, json: async function () { return [company]; } };
    },
  };
  try {
    var firstCached = await client.enrichVerifiedIdentity({ status: "found", company: official }, identity, cachedOptions);
    var secondCached = await client.enrichVerifiedIdentity({ status: "found", company: official }, identity, cachedOptions);
    assert.strictEqual(firstCached.northData.cacheHit, false, "prvi pregled mora shraniti svež SolidCode rezultat");
    assert.strictEqual(secondCached.northData.cacheHit, true, "ponovni pregled mora uporabiti predpomnilnik");
    assert.strictEqual(secondCached.northData.estimatedCostUsd, 0, "zadetek iz predpomnilnika ne sme imeti novega stroška");
    assert.strictEqual(paidCalls, 1, "isto podjetje sme sprožiti samo en plačljiv SolidCode klic");

    client.companyCache._test.clearMemory();
    var afterRestart = await client.enrichVerifiedIdentity({ status: "found", company: official }, identity, cachedOptions);
    assert.strictEqual(afterRestart.northData.cacheLayer, "local_disk",
      "lokalni 8001 mora rezultat ohraniti tudi po ponovnem zagonu procesa");
    assert.strictEqual(paidCalls, 1, "branje z diska ne sme ponovno zagnati actorja");
  } finally {
    var resolvedTemp = path.resolve(tempDir);
    var resolvedRoot = path.resolve(os.tmpdir()) + path.sep;
    if (resolvedTemp.startsWith(resolvedRoot)) fs.rmSync(resolvedTemp, { recursive: true, force: true });
  }

  ["api/_handlers/mehka-boniteta.js"].forEach(function (file) {
    var api = source(file);
    assert.match(api, /enrichVerifiedIdentity\(openregister, identiteta, \{[\s\S]*?allowConfirmedImpressum/);
    assert.strictEqual((api.match(/enrichVerifiedIdentity\(openregister, identiteta, \{/g) || []).length, 1,
      "končna faza sme vsebovati samo en plačljiv North Data klic");
    assert.ok(api.indexOf("enrichVerifiedIdentity(openregister, identiteta, {") > api.indexOf("identiteta = potrditev.identity"),
      "North Data se sme zagnati šele po uradni samodejni ali uporabniški potrditvi identitete");
    assert.match(api, /function pripraviPotrditevIdentiteteZaZahtevo[\s\S]*?potrditev\.status === "not_provided"[\s\S]*?pripraviSamodejnoRegistrskoPotrditev/,
      "popolna OpenRegister družba mora samodejno nadaljevati brez dodatnega uporabniškega koraka");
    assert.match(api, /var potrditev = pripraviPotrditevIdentiteteZaZahtevo\(/,
      "končna faza mora uporabiti skupno izbiro aktualne registrske potrditve");
    assert.match(api, /Promise\.all\(\[northDataPromise, insolvencaPromise\]\)/,
      "North Data in insolvenčna poizvedba morata teči vzporedno");
    assert.match(api, /northData: northData/);
    assert.match(api, /viri\.push\(northDataObogatitev\.source\)/);
  });
  assert.strictEqual(queue._test.NORTHDATA_ENRICHMENT_VERSION, "northdata-apify-v10-financial-invariants");
  assert.strictEqual(client.companyCache.CACHE_VERSION, "northdata-jaka-v6-financial-invariants");
  assert.match(source("scripts/local-server.js"), /APIFY_API_TOKEN/,
    "lokalni strežnik mora naložiti strežniški Apify žeton iz .env.local");
  assert.match(source("app/bonitetna-preverba.js"), /northData: podatki\.northData \|\| null/);
  assert.match(source("app/boniteta-profil.js"), /function northDataPayload\(\)/);
  assert.match(source("app/boniteta-profil.js"), /Vključeno v osnovno preverbo · North Data/);
  assert.match(profileView.northDataNetworkHtml({ company: {
    officers: [{ name: "Anna Beispiel", role: "Geschäftsführerin" }],
    relatedCompanies: [{ name: "Povezana GmbH", type: "company", relationships: ["Shared officer"] }],
  } }), /Vodstvo in povezave niso isto kot dokazano lastništvo/);
  console.log("✓ North Data actor je omejen, varen in povezan z osnovno bonitetno preverbo.");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
