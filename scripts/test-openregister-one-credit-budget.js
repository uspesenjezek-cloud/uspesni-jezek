"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
[
  "api/_handlers/mehka-boniteta.js",
].forEach(function (file) {
  var source = fs.readFileSync(path.join(root, file), "utf8");
  var activeFlow = source.slice(source.indexOf("async function handler"), source.indexOf("handler._test"));

  assert.match(source, /Boolean\(moznosti && moznosti\.uporabiOpenRegister === true\)/,
    file + ": paid insolvency lookup must require an explicit internal opt-in");
  assert.match(activeFlow, /preveriInsolvenco\([\s\S]*?\{ uporabiOpenRegister: false \}/,
    file + ": user check must send insolvency directly to the official portal");
  assert.doesNotMatch(activeFlow, /preveriInsolvenco\([\s\S]*?uporabiOpenRegister:\s*openregisterIdentitetaVklopljena/,
    file + ": identity lookup must not enable a second paid insolvency request");
  assert.match(activeFlow, /openRegisterIskanjeOpravljeno[\s\S]*?one_credit_budget_preserved/,
    file + ": every run must cap identity lookup at one simple company search");
  assert.match(activeFlow, /forceFresh:\s*telo\.monitoringMode === "internal_recheck"/,
    file + ": due internal monitoring must repeat the simple company search instead of reusing the 24-hour cache");
  assert.match(activeFlow, /official_company_id_mismatch[\s\S]*?preveriInsolvenco/,
    file + ": official insolvency must remain behind the stable identity gate");
});

var test = require(path.join(root, "api/mehka-boniteta.js"))._test;
var result = test.sestaviSklep(
  { status: "verified_register" },
  { status: "clear", verificationMode: "official_portal_only", officialVerification: { status: "clear" } },
  null
);
assert.strictEqual(result.level, "green");
assert.match(result.message, /Uradni portal Insolvenzbekanntmachungen/);
assert.doesNotMatch(result.message, /OpenRegister in uradni portal/);
var mismatch = test.pripraviPotrditevIdentiteteZaZahtevo({confirmedIdentity:{companyId:"DE-HRB-M1201-137035",confirmed:true}}, {status:"verified_register",companyId:"DE-HRB-F1103-267645"}, null, null);
assert.strictEqual(mismatch.status,"invalid");
assert.strictEqual(mismatch.reason,"official_company_id_mismatch");

async function verifyFreshInternalRecheck() {
  var originalFetch = global.fetch;
  var originalKey = process.env.OPENREGISTER_API_KEY;
  var calls = 0;
  process.env.OPENREGISTER_API_KEY = "test-key-no-live-call";
  global.fetch = async function () {
    calls += 1;
    return {
      ok: true,
      status: 200,
      json: async function () { return { results: [{
        company_id: "DE-HRB-F1103-267645",
        name: "Test GmbH",
        register_type: "HRB",
        register_number: "267645",
        register_court: "Berlin (Charlottenburg)",
        address: { street: "Teststraße 1", postal_code: "10115", city: "Berlin" },
      }] }; },
    };
  };
  test.ponastaviOpenRegisterIdentityCache();
  try {
    var input = { ime: "DE-HRB-F1103-267645", naslov: "Teststraße 1", postnaStevilka: "10115", kraj: "Berlin" };
    assert.strictEqual((await test.poisciOpenRegister(input, { forceFresh: true })).status, "found");
    assert.strictEqual(calls, 1, "en zapadli ponovni pregled sme izvesti samo eno navadno iskanje");
    assert.strictEqual((await test.poisciOpenRegister(input, { forceFresh: true })).status, "found");
    assert.strictEqual(calls, 2, "nov zapadli termin mora narediti sveže iskanje");
    await test.poisciOpenRegister(input);
    assert.strictEqual(calls, 2, "običajni tok sme ponovno uporabiti varen rezultat brez dodatnega kredita");
  } finally {
    global.fetch = originalFetch;
    if (originalKey == null) delete process.env.OPENREGISTER_API_KEY;
    else process.env.OPENREGISTER_API_KEY = originalKey;
    test.ponastaviOpenRegisterIdentityCache();
  }
}

verifyFreshInternalRecheck().then(function () {
  console.log("OpenRegister one-credit budget tests passed.");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
