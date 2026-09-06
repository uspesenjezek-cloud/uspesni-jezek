"use strict";

var assert = require("node:assert");
var client = require("../api/_lib/apify-northdata-details-client");
var primaryClient = require("../api/_lib/apify-northdata-client");
var accountGuard = require("../api/_lib/apify-account-guard");
var fs = require("node:fs");
var path = require("node:path");

async function main() {
  accountGuard._test.reset();
  await assert.rejects(function () {
    return accountGuard.verify("old-account-token", async function () {
      return { ok: true, status: 200, json: async function () { return { data: { username: "old_account" } }; } };
    });
  }, function (error) { return error && error.code === "APIFY_ACCOUNT_MISMATCH"; },
  "žeton drugega Apify računa mora biti zavrnjen pred plačljivim POST-om");
  accountGuard._test.reset();
  var vzporednaPreverjanja = 0;
  await Promise.all([1, 2].map(function () {
    return accountGuard.verify("parallel-token", async function () {
      vzporednaPreverjanja += 1;
      await new Promise(function (resolve) { setImmediate(resolve); });
      return { ok: true, status: 200, json: async function () { return { data: { username: "ruly_caviar_jhh" } }; } };
    });
  }));
  assert.strictEqual(vzporednaPreverjanja, 1, "sočasna actorja morata deliti eno preverjanje Apify računa");
  accountGuard._test.reset();
  var accountChecks = [];
  await accountGuard.verify("test-token", async function (url) {
    accountChecks.push(url);
    if (url.includes("/users/me")) {
      return { ok: false, status: 403, json: async function () { return { error: { type: "insufficient-permissions" } }; } };
    }
    if (url.includes("/actor-runs")) {
      return { ok: true, status: 200, json: async function () { return { data: { items: [{ userId: accountGuard.EXPECTED_USER_ID }] } }; } };
    }
    throw new Error("Unexpected account verification URL: " + url);
  });
  assert.strictEqual(accountChecks.length, 2, "omejeni Actor žeton se mora potrditi brez plačljivega klica");
  var official = { name: "Kurt Schwarzwälder GmbH, Gas-, Wasser- Installateurmeisterbetrieb", registerNumber: "HRB 123456", address: { city: "Berlin" } };
  var primary = { status: "found", company: { name: official.name, registerNumber: "Berlin HRB 123456" } };
  var row = {
    name: official.name, registerId: "Berlin HRB 123456",
    url: "https://www.northdata.com/Kurt+Schwarzwaelder+GmbH,+Berlin/HRB+123456",
    financials: [
      { date: "2024-12-31", fiscalYear: "2024", items: { Cash: { value: 133563.1, estimate: false }, Revenue: { value: 2200000, estimate: true }, Employees: { value: 15.75, estimate: true } }, sourceTitle: "Jahresabschluss 2024", sourceDate: "2026-02-16" },
      { date: "2025-12-31", fiscalYear: "2025", items: { Cash: { value: 344100.04, estimate: false }, Receivables: { value: 170351.83, estimate: false }, Liabilities: { value: 106825.26, estimate: false }, Equity: { value: 753179.93, estimate: false }, EquityRatio: { value: 75.5, estimate: false }, ROE: { value: 16.6, estimate: false }, Employees: { value: 16.5, estimate: true } }, sourceTitle: "Jahresabschluss 2025", sourceDate: "2026-08-20" },
    ],
    events: [{ date: "2025-03-01", category: "Management", text: "Nova registrska objava." }],
  };
  assert.strictEqual(client.ACTOR_ID, "vKs8nu688v4F1se82");
  assert.strictEqual(client.MAX_RESULTS, 1, "dopolnilni North Data actor sme vrniti samo eno podjetje");
  assert.strictEqual(client.POLL_WAIT_SECONDS, 25, "statusni GET sme čakati 25 sekund, actor pa se ne sme ustaviti");
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "apify-northdata-details-client.js"), "utf8"),
    /ACTOR_ID \+ "\/runs\?timeout=/,
    "dopolnilni asinhroni actor ne sme imeti Apify runtime omejitve");
  assert.match(fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "apify-northdata-details-client.js"), "utf8"),
    /setTimeout\(function \(\) \{ controller\.abort\(\); \}, timeoutSeconds \* 1000\)/,
    "lokalna prekinitev mora uporabiti interno omejitev brez dodatnega pribitka");
  assert.deepStrictEqual(client.buildInput(official).queries, [official.name]);
  assert.strictEqual(client.buildInput(official).maxResults, 1);
  assert.strictEqual(client.buildInput(official).includeNetwork, false,
    "dopolnilni actor ne sme preiskovati mreže povezanih družb");
  assert.strictEqual(client.buildInput(official).includeOfficers, false,
    "dopolnilni actor ne sme podvajati oseb iz primarnega actorja");
  var clean = client.sanitizeCompany(row);
  assert.strictEqual(clean.financials.length, 2);
  assert.strictEqual(clean.financials[1].items.Cash.estimate, false);
  assert.strictEqual(clean.financials[1].items.Employees.estimate, true);
  assert.strictEqual(clean.financials[0].items.Revenue, undefined, "ocenjeni prihodki ne smejo podvajati osnovnega finančnega grafa");
  assert.deepStrictEqual(clean.events[0], {
    category: "Management", date: "2025-03-01", title: "Management",
    description: "Nova registrska objava.", type: "Management",
  }, "dopolnilni actor mora ohraniti dogodke, ki so odstranjeni iz kritične poti primarnega actorja");
  assert.strictEqual(client.selectCompany([row], official, primary).status, "found");
  assert.strictEqual(client.selectCompany([Object.assign({}, row, { registerId: "Berlin HRB 999999" })], official, primary).status, "not_found");
  var calls = 0;
  var result = await client.enrichCompany(official, primary, { token: "test-token", fetch: async function (url, options) {
    calls += 1;
    assert.match(String(url), /vKs8nu688v4F1se82/);
    assert.doesNotMatch(String(url), /[?&]timeout=/, "dopolnilni actor privzeto ne sme dobiti runtime omejitve");
    assert.match(String(url), /maxTotalChargeUsd=0\.01/);
    assert.match(String(url), /maxItems=1/, "Apify odgovor dopolnilnega actorja mora biti omejen na eno podjetje");
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
  var timeoutZacetek = Date.now();
  var dejanskiTimeout = await client.enrichCompany(official, primary, { token: "test-token", timeoutSeconds: 0.05, fetch: function (_url, options) {
    return new Promise(function (_resolve, reject) {
      options.signal.addEventListener("abort", function () {
        var timeoutError = new Error("presežena časovna omejitev");
        timeoutError.name = "AbortError";
        reject(timeoutError);
      }, { once: true });
    });
  } });
  var timeoutTrajanje = Date.now() - timeoutZacetek;
  assert.strictEqual(dejanskiTimeout.reason, "timeout");
  assert.ok(timeoutTrajanje >= 35 && timeoutTrajanje < 500,
    "notranji testni timeout se mora dejansko prekiniti brez 25-sekundnega čakanja, izmerjeno " + timeoutTrajanje + " ms");

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
  var sprostiPrimary;
  var sprostiDetailsStart;
  var recheckPrimaryPromise = primaryClient.enrichVerifiedIdentity({ status: "found", company: recheckOfficial }, recheckIdentity, {
    disableCache: true, token: "test-token", fetch: async function () {
      primaryCalls += 1;
      return new Promise(function (resolve) {
        sprostiPrimary = function () { resolve({ ok: true, status: 200, json: async function () { return [recheckPrimaryRow]; } }); };
      });
    },
  });
  var recheckDetailsStartPromise = client.startVerifiedIdentity(
    { status: "found", company: recheckOfficial }, recheckIdentity,
    { token: "test-token", fetch: async function (url) {
      if (/\/users\/me$/.test(String(url))) return { ok: true, status: 200, json: async function () { return { data: { username: "ruly_caviar_jhh" } }; } };
      detailsCalls += 1;
      return new Promise(function (resolve) {
        sprostiDetailsStart = function () { resolve({ ok: true, status: 201, json: async function () { return { data: { id: "DETAILSRUN12345", actId: client.ACTOR_ID, defaultDatasetId: "DETAILSDATA12345", status: "RUNNING" } }; } }); };
      });
    } }
  );
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(typeof sprostiPrimary, "function", "osnovni actor se mora začeti brez čakanja na dopolnilnega");
  assert.strictEqual(typeof sprostiDetailsStart, "function", "dopolnilni actor se mora začeti brez čakanja na osnovnega");
  sprostiPrimary();
  sprostiDetailsStart();
  var parallelResults = await Promise.all([recheckPrimaryPromise, recheckDetailsStartPromise]);
  var recheckPrimary = parallelResults[0];
  var recheckDetailsStart = parallelResults[1];
  assert.strictEqual(recheckDetailsStart.status, "started", "prvi prikaz mora dobiti ID že začetega drugega runa");
  var recheckDetails = await client.completeStartedRun(
    recheckDetailsStart, { status: "found", company: recheckOfficial }, recheckIdentity, recheckPrimary.northData,
    { token: "test-token", fetch: async function (url) {
      if (/\/actor-runs\/DETAILSRUN12345/.test(String(url))) return { ok: true, status: 200, json: async function () { return { data: { id: "DETAILSRUN12345", actId: client.ACTOR_ID, status: "SUCCEEDED", defaultDatasetId: "DETAILSDATA12345" } }; } };
      if (/\/datasets\/DETAILSDATA12345\/items/.test(String(url))) return { ok: true, status: 200, json: async function () { return [recheckDetailsRow]; } };
      throw new Error("Nepričakovan GET: " + url);
    } }
  );
  assert.strictEqual(primaryCalls, 1, "oddana ponovna preverba mora sprožiti osnovnega North Data agenta");
  assert.strictEqual(detailsCalls, 1, "potrjen OpenRegister mora vzporedno sprožiti dopolnilnega North Data agenta");
  assert.strictEqual(recheckPrimary.northData.status, "found");
  assert.strictEqual(recheckDetails.northDataDetails.status, "found");
  assert.strictEqual(recheckDetails.northDataDetails.verification.status, "confirmed");
  assert.strictEqual(recheckPrimary.identity.companyId, recheckOfficial.company_id,
    "North Data ne sme prepisati uradnega company ID-ja ponovne preverbe");
  assert.strictEqual(recheckPrimary.identity.registerNumber, "HRB 10001",
    "oba North Data koraka morata ostati vezana na isto registrsko številko");
  var conflict = client.confirmWithPrimary(recheckDetails.northDataDetails, {
    status: "found", company: { name: recheckOfficial.name, registerNumber: "HRB 99999" },
  });
  assert.strictEqual(conflict.status, "conflict", "nasprotujoča registrska številka se ne sme združiti");
  assert.strictEqual(conflict.company, undefined, "konflikten rezultat ne sme razkriti podatkov za združitev");
  var skipped = await client.enrichVerifiedIdentity({ status: "not_found" }, recheckIdentity, { token: "test-token", fetch: async function () { throw new Error("ne sme se zagnati"); } });
  assert.strictEqual(skipped.northDataDetails.status, "skipped", "drugi actor brez potrjenega OpenRegisterja ne sme teči");
  var handler = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
  var backgroundHandler = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta-podrobnosti.js"), "utf8");
  assert.ok(!handler.includes("northDataDetailsClient.enrichAfterPrimary"), "glavni rezultat ne sme čakati drugega actorja");
  assert.ok(!handler.includes("northDataDetailsClient.enrichVerifiedIdentity"), "dopolnilni actor ne sme biti v kritični poti prvega prikaza");
  assert.ok(handler.includes("northDataDetailsClient.startVerifiedIdentity"), "drugi actor se mora sprožiti vzporedno z osnovnim");
  assert.match(handler, /function zacniNorthDataPoOpenRegisterju[\s\S]*?detailsPromise[\s\S]*?primaryPromise/,
    "oba actorja se morata začeti vzporedno takoj po OpenRegisterju");
  assert.match(handler, /Promise\.all\(\[zacetek\.primaryPromise, zacetek\.detailsPromise\]\)/,
    "prvi prikaz sme uporabiti le osnovni rezultat in ID že začetega drugega actorja");
  assert.ok(handler.includes("northDataDetailsProof.signPending(authUserId, openregister, primaryStart, detailsStart)"),
    "oba ozadna actorja morata dobiti podpisano vez z OpenRegister identiteto in run ID-jema");
  assert.ok(backgroundHandler.includes("primaryClient.completeStartedRun"),
    "ozadni handler mora dokončati tudi že začeti prvi North Data run");
  assert.ok(handler.includes("backgroundRun:"), "prvi rezultat mora shraniti ID že začetega drugega runa");
  assert.ok(backgroundHandler.includes("detailsClient.completeStartedRun"), "Plus mora prebrati že začeti run brez novega plačljivega POST-a");
  assert.ok(backgroundHandler.includes("detailsClient.enrichAfterPrimary"), "stari ozadni handler mora ostati združljiv z že začetimi preverjanji");
  assert.match(backgroundHandler, /events:\s*dopolnilniDogodki\.length\s*\?\s*dopolnilniDogodki\s*:\s*guarded\.company\.events/,
    "dogodki drugega actorja se morajo po zaključku združiti v osnovni North Data rezultat");
  assert.match(handler, /northDataDetails = detailsStart[\s\S]*?status: "pending_background"/);
  console.log("✓ Oba North Data actorja se začneta vzporedno in se po OpenRegister rezultatu dopolnita v kartici.");
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
