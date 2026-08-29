"use strict";

var assert = require("node:assert");
var client = require("../api/_lib/apify-northdata-details-client");
var primaryClient = require("../api/_lib/apify-northdata-client");
var fs = require("node:fs");
var path = require("node:path");

async function main() {
  var official = { name: "Kurt Schwarzwälder GmbH, Gas-, Wasser- Installateurmeisterbetrieb", registerNumber: "HRB 123456", address: { city: "Berlin" } };
  var primary = { status: "found", company: { name: official.name, registerNumber: "Berlin HRB 123456" } };
  var row = {
    name: official.name, registerId: "Berlin HRB 123456",
    url: "https://www.northdata.com/Kurt+Schwarzwaelder+GmbH,+Berlin/HRB+123456",
    financials: [
      { date: "2024-12-31", fiscalYear: "2024", items: { Cash: { value: 133563.1, estimate: false }, Revenue: { value: 2200000, estimate: true }, Employees: { value: 15.75, estimate: true } }, sourceTitle: "Jahresabschluss 2024", sourceDate: "2026-02-16" },
      { date: "2025-12-31", fiscalYear: "2025", items: { Cash: { value: 344100.04, estimate: false }, Receivables: { value: 170351.83, estimate: false }, Liabilities: { value: 106825.26, estimate: false }, Equity: { value: 753179.93, estimate: false }, EquityRatio: { value: 75.5, estimate: false }, ROE: { value: 16.6, estimate: false }, Employees: { value: 16.5, estimate: true } }, sourceTitle: "Jahresabschluss 2025", sourceDate: "2026-08-20" },
    ],
  };
  assert.strictEqual(client.ACTOR_ID, "vKs8nu688v4F1se82");
  assert.strictEqual(client.TIMEOUT_SECONDS, 10, "drugi North Data actor sme celotno preverbo zadržati največ 10 sekund");
  assert.match(fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "apify-northdata-details-client.js"), "utf8"),
    /setTimeout\(function \(\) \{ controller\.abort\(\); \}, TIMEOUT_SECONDS \* 1000\)/,
    "lokalna prekinitev mora nastopiti pri 10 sekundah brez dodatnega pribitka");
  assert.deepStrictEqual(client.buildInput(official).queries, [official.name]);
  var clean = client.sanitizeCompany(row);
  assert.strictEqual(clean.financials.length, 2);
  assert.strictEqual(clean.financials[1].items.Cash.estimate, false);
  assert.strictEqual(clean.financials[1].items.Employees.estimate, true);
  assert.strictEqual(clean.financials[0].items.Revenue, undefined, "ocenjeni prihodki ne smejo podvajati osnovnega finančnega grafa");
  assert.strictEqual(client.selectCompany([row], official, primary).status, "found");
  assert.strictEqual(client.selectCompany([Object.assign({}, row, { registerId: "Berlin HRB 999999" })], official, primary).status, "not_found");
  var calls = 0;
  var result = await client.enrichCompany(official, primary, { token: "test-token", fetch: async function (url, options) {
    calls += 1;
    assert.match(String(url), /vKs8nu688v4F1se82/);
    assert.match(String(url), /[?&]timeout=10(?:&|$)/, "Apify mora dobiti isto 10-sekundno omejitev");
    assert.match(String(url), /maxTotalChargeUsd=0\.01/);
    assert.strictEqual(options.method, "POST");
    return { ok: true, status: 200, json: async function () { return [row]; } };
  } });
  assert.strictEqual(calls, 1);
  assert.strictEqual(result.status, "found");
  assert.strictEqual(result.estimatedCostUsd, 0.002);
  var timedOut = await client.enrichCompany(official, primary, { token: "test-token", fetch: async function () {
    var timeoutError = new Error("presežena časovna omejitev");
    timeoutError.name = "AbortError";
    throw timeoutError;
  } });
  assert.strictEqual(timedOut.status, "unavailable");
  assert.strictEqual(timedOut.reason, "timeout");
  assert.strictEqual(timedOut.company, undefined, "po timeoutu podatki drugega actorja ne smejo v rezultat");

  var recheckOfficial = {
    company_id: "DE-HRB-R0001-10001", name: "Generična ponovna preverba GmbH",
    register_type: "HRB", register_number: "10001", register_court: "Amtsgericht Berlin",
    address: { street: "Skupna ulica 12", postal_code: "10115", city: "Berlin", country: "DE" },
  };
  var recheckIdentity = {
    status: "verified_register", entityType: "company", companyId: recheckOfficial.company_id,
    ime: recheckOfficial.name, naziv: recheckOfficial.name, registerNumber: "HRB 10001",
    registerCourt: recheckOfficial.register_court, naslov: "Skupna ulica 12", postnaStevilka: "10115", kraj: "Berlin",
  };
  var recheckPrimaryRow = {
    recordType: "company", name: recheckOfficial.name, registerNumber: "Berlin HRB 10001",
    url: "https://www.northdata.com/Genericna+ponovna+preverba+GmbH,+Berlin/HRB+10001",
    address: { street: "Skupna ulica 12", postalCode: "10115", city: "Berlin", country: "DE" },
  };
  var recheckDetailsRow = {
    name: recheckOfficial.name, registerId: "Berlin HRB 10001",
    url: "https://www.northdata.com/Genericna+ponovna+preverba+GmbH,+Berlin/HRB+10001",
    financials: [{ date: "2025-12-31", fiscalYear: 2025, items: { Cash: { value: 120000 } } }],
  };
  var primaryCalls = 0;
  var detailsCalls = 0;
  var recheckPrimary = await primaryClient.enrichVerifiedIdentity({ status: "found", company: recheckOfficial }, recheckIdentity, {
    disableCache: true, token: "test-token", fetch: async function () {
      primaryCalls += 1;
      return { ok: true, status: 200, json: async function () { return [recheckPrimaryRow]; } };
    },
  });
  var recheckDetails = await client.enrichAfterPrimary(
    { status: "found", company: recheckOfficial }, recheckPrimary.identity, recheckPrimary.northData,
    { disableCache: true, token: "test-token", fetch: async function () {
      detailsCalls += 1;
      return { ok: true, status: 200, json: async function () { return [recheckDetailsRow]; } };
    } }
  );
  assert.strictEqual(primaryCalls, 1, "oddana ponovna preverba mora sprožiti osnovnega North Data agenta");
  assert.strictEqual(detailsCalls, 1, "uspešen osnovni rezultat mora sprožiti še dopolnilnega North Data agenta");
  assert.strictEqual(recheckPrimary.northData.status, "found");
  assert.strictEqual(recheckDetails.northDataDetails.status, "found");
  assert.strictEqual(recheckPrimary.identity.companyId, recheckOfficial.company_id,
    "North Data ne sme prepisati uradnega company ID-ja ponovne preverbe");
  assert.strictEqual(recheckPrimary.identity.registerNumber, "HRB 10001",
    "oba North Data koraka morata ostati vezana na isto registrsko številko");
  var skipped = await client.enrichAfterPrimary({ status: "found", company: official }, {}, { status: "not_found" }, { token: "test-token", fetch: async function () { throw new Error("ne sme se zagnati"); } });
  assert.strictEqual(skipped.northDataDetails.status, "skipped", "drugi actor brez uspešnega prvega actorja ne sme teči");
  var handler = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
  assert.ok(handler.indexOf("northDataClient.enrichVerifiedIdentity") < handler.indexOf("northDataDetailsClient.enrichAfterPrimary"), "novi actor mora nastopiti za obstoječim North Data agentom");
  assert.match(handler, /northDataDetails: northDataDetails/);
  console.log("✓ Dopolnilni North Data actor je zaporeden, omejen in ohrani izvor/estimate.");
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
