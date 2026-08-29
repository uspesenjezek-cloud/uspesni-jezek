"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var identity = require("../api/_lib/debtor-company-identity");
var identitySearch = require("../api/_lib/openregister-identity-search");
var api = require("../api/boniteta-pro")._test;

assert.equal(identity.normalize("  MedienÖrbis GmbH "), "medienorbis gmbh");
assert.equal(identity.cacheKey("MedienOrbis GmbH"), "v1|medienorbis gmbh");
assert.equal(identity.exactCompany([
  { company_id: "DE-HRB-X-1", name: "Drugo GmbH" },
  { company_id: "DE-HRB-M1201-137035", name: "MedienOrbis GmbH" },
], "de-hrb-m1201-137035").name, "MedienOrbis GmbH");
assert.equal(identity.exactCompany([{ company_id: "DE-HRB-X-1", name: "Drugo GmbH" }], "DE-HRB-X-2"), null);

var profile = identity._test.profilePayload({
  company_id: "DE-HRB-M1201-137035",
  name: "MedienOrbis GmbH",
  register_type: "HRB",
  register_number: "137035",
  register_court: "Frankfurt am Main",
  legal_form: "gmbh",
  active: true,
});
assert.equal(profile.companyId, "DE-HRB-M1201-137035");
assert.equal(profile.latestCheck.identityStatus, "verified_register");

["api/boniteta-pro.js", "api/_handlers/boniteta-pro.js"].forEach(function (file) {
  var source = fs.readFileSync(file, "utf8");
  assert.match(source, /action === "debtor_company_search"[\s\S]*?maxCredits: 1/);
  assert.match(source, /action === "debtor_company_select"[\s\S]*?creditsUsed: 0[\s\S]*?maxCredits: 1/);
  var debtorFlow = source.slice(source.indexOf('action === "debtor_company_search"'), source.indexOf('action === "company_lookup"'));
  assert.doesNotMatch(debtorFlow, /companyDetails|company_lookup|section\(/);
});

var worker = fs.readFileSync("api/mehka-boniteta-delavec.js", "utf8");
assert.match(worker, /debtor-company-identity/);
assert.match(worker, /debtor-company-identity-heartbeat/);

var migration = fs.readFileSync("supabase/migrations/20260828103922_debtor_company_identity_refresh.sql", "utf8");
assert.match(migration, /last_credits_used smallint[\s\S]*?between 0 and 1/i);
assert.match(migration, /p_credits_used[\s\S]*?not between 0 and 1/i);
assert.match(migration, /unique \(user_id, company_id\)/i);
assert.match(migration, /z\.status <> 'Rešeno'/);
assert.match(migration, /interval '30 days'/);
assert.match(migration, /enable row level security/i);
assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/i);
assert.doesNotMatch(migration, /security definer/i);
assert.doesNotMatch(migration, /grant\s+(?:select,\s*)?insert(?:,\s*update)?\s+on table public\.dolznik_podjetja to authenticated/i);
assert.doesNotMatch(migration, /\(p_company->>'active'\)::boolean/i);

var appSource = fs.readFileSync("app/app.js", "utf8");
[
  ["openRegisterCompanyId", "openregister_company_id"],
  ["openRegisterRegisterType", "register_type"],
  ["openRegisterRegisterNumber", "register_number"],
  ["openRegisterRegisterCourt", "register_court"],
  ["openRegisterLegalForm", "legal_form"],
  ["openRegisterVerifiedAt", "podjetje_preverjeno_at"],
].forEach(function (fields) {
  assert.match(appSource, new RegExp(fields[0] + ":[\\s\\S]*?podatki\\.get\\(\"" + fields[0] + "\"\\)"));
  assert.match(appSource, new RegExp(fields[1] + ":\\s*podatkiKorak1\\." + fields[0]));
});

assert.ok(api, "strežniški API mora izvoziti testne varovalke");

async function verifyOneCreditAndSharedCache() {
  var originalFetch = global.fetch;
  var originalKey = process.env.OPENREGISTER_API_KEY;
  var cacheReady = false;
  var providerCalls = 0;
  process.env.OPENREGISTER_API_KEY = "test-one-credit-key";
  global.fetch = async function (url, options) {
    var target = String(url), method = options && options.method || "GET";
    if (target.includes("/rpc/claim_openregister_identity_search")) {
      return { ok: true, status: 200, json: async function () { return true; } };
    }
    if (target.includes("openregister_identity_search_cache?") && method === "GET") {
      return { ok: true, status: 200, json: async function () { return cacheReady ? [{
        results: [{ company_id: "DE-HRB-M1201-137035", name: "MedienOrbis GmbH", register_type: "HRB", register_number: "137035", register_court: "Frankfurt am Main", active: true }],
        searched_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(),
      }] : []; } };
    }
    if (target.includes("openregister_identity_search_cache?") && method === "PATCH") {
      cacheReady = true;
      return { ok: true, status: 204, json: async function () { return []; } };
    }
    throw new Error("Nepričakovan testni klic: " + target);
  };
  var provider = { search: async function () {
    providerCalls += 1;
    return { cached: false, results: [{ company_id: "DE-HRB-M1201-137035", name: "MedienOrbis GmbH", register_type: "HRB", register_number: "137035", register_court: "Frankfurt am Main", active: true }] };
  } };
  try {
    var cfg = { url: "https://project.supabase.co", serviceKey: "service-test", isService: true };
    var first = await identity.search(cfg, "00000000-0000-4000-8000-000000000001", "MedienOrbis", { serviceCfg: cfg, identitySearch: provider });
    assert.equal(first.creditsUsed, 1);
    assert.equal(providerCalls, 1);
    var second = await identity.search(cfg, "00000000-0000-4000-8000-000000000001", "MedienOrbis", { serviceCfg: cfg, identitySearch: provider });
    assert.equal(second.creditsUsed, 0);
    assert.equal(providerCalls, 1, "shranjen rezultat mora preprečiti drugo plačljivo iskanje");
    assert.ok(second.results[0].identity_proof, "rezultat iz skupnega cachea mora dobiti uporabniku vezan dokaz");
  } finally {
    global.fetch = originalFetch;
    if (originalKey == null) delete process.env.OPENREGISTER_API_KEY;
    else process.env.OPENREGISTER_API_KEY = originalKey;
  }
}

async function verifySelectionDoesNotCallProvider() {
  var originalFetch = global.fetch;
  var originalSecret = process.env.OPENREGISTER_IDENTITY_PROOF_SECRET;
  var providerCalls = 0;
  var userId = "00000000-0000-4000-8000-000000000001";
  process.env.OPENREGISTER_IDENTITY_PROOF_SECRET = "test-selection-proof-secret";
  var proof = identitySearch.signCompany({
    company_id: "DE-HRB-M1201-137035", name: "MedienOrbis GmbH",
    register_type: "HRB", register_number: "137035", register_court: "Frankfurt am Main", active: true,
  }, userId);
  global.fetch = async function (url, options) {
    var target = String(url), method = options && options.method || "GET";
    if (target.includes("api.openregister")) providerCalls += 1;
    if (target.includes("boniteta_profili?") && method === "GET") return { ok: true, status: 200, json: async function () { return []; } };
    if (target.includes("boniteta_profili?") && method === "POST") return { ok: true, status: 201, json: async function () { return [{ id: "profile-1" }]; } };
    if (target.includes("dolznik_podjetja?") && method === "POST") return { ok: true, status: 201, json: async function () { return [{ id: "debtor-company-1" }]; } };
    throw new Error("Nepričakovan testni klic: " + target);
  };
  try {
    var cfg = { url: "https://project.supabase.co", serviceKey: "service-test", isService: true };
    var saved = await identity.saveSelection(cfg, userId, proof);
    assert.equal(saved.company.company_id, "DE-HRB-M1201-137035");
    assert.equal(providerCalls, 0, "izbor podpisanega rezultata ne sme ponovno klicati OpenRegisterja");
  } finally {
    global.fetch = originalFetch;
    if (originalSecret == null) delete process.env.OPENREGISTER_IDENTITY_PROOF_SECRET;
    else process.env.OPENREGISTER_IDENTITY_PROOF_SECRET = originalSecret;
  }
}

async function verifyMonthlyRefreshUsesOneProviderCall() {
  var originalFetch = global.fetch;
  var providerCalls = 0;
  var finishBody = null;
  var claimed = {
    id: "10000000-0000-4000-8000-000000000001",
    user_id: "00000000-0000-4000-8000-000000000001",
    company_id: "DE-HRB-M1201-137035",
    legal_name: "MedienOrbis GmbH",
  };
  global.fetch = async function (url, options) {
    var target = String(url);
    if (target.includes("/rpc/claim_due_debtor_company_refresh")) return { ok: true, status: 200, json: async function () { return claimed; } };
    if (target.includes("/rpc/finish_debtor_company_refresh")) {
      finishBody = JSON.parse(options.body);
      return { ok: true, status: 200, json: async function () { return claimed; } };
    }
    if (target.includes("openregister_identity_search_cache?") && options.method === "PATCH") return { ok: true, status: 204, json: async function () { return []; } };
    throw new Error("Nepričakovan testni klic: " + target);
  };
  try {
    var cfg = { url: "https://project.supabase.co", serviceKey: "service-test", isService: true };
    var result = await identity.refreshDue({ serviceCfg: cfg, identitySearch: { search: async function () {
      providerCalls += 1;
      return { cached: false, results: [{ company_id: claimed.company_id, name: claimed.legal_name, active: true }] };
    } } });
    assert.equal(result.success, true);
    assert.equal(providerCalls, 1, "mesečna osvežitev sme izvesti natanko en providerski klic");
    assert.equal(finishBody.p_credits_used, 1);
  } finally {
    global.fetch = originalFetch;
  }
}

async function verifyFailedRefreshConservativelyRecordsOneCredit() {
  var originalFetch = global.fetch;
  var providerCalls = 0;
  var finishBody = null;
  var claimed = {
    id: "10000000-0000-4000-8000-000000000002",
    user_id: "00000000-0000-4000-8000-000000000001",
    company_id: "DE-HRB-M1201-137035",
    legal_name: "MedienOrbis GmbH",
  };
  global.fetch = async function (url, options) {
    var target = String(url);
    if (target.includes("/rpc/claim_due_debtor_company_refresh")) return { ok: true, status: 200, json: async function () { return claimed; } };
    if (target.includes("/rpc/finish_debtor_company_refresh")) {
      finishBody = JSON.parse(options.body);
      return { ok: true, status: 200, json: async function () { return claimed; } };
    }
    throw new Error("Nepričakovan testni klic: " + target);
  };
  try {
    var cfg = { url: "https://project.supabase.co", serviceKey: "service-test", isService: true };
    var result = await identity.refreshDue({ serviceCfg: cfg, identitySearch: { search: async function () {
      providerCalls += 1;
      throw new Error("provider timeout after request");
    } } });
    assert.equal(result.success, false);
    assert.equal(providerCalls, 1);
    assert.equal(result.creditsUsed, 1);
    assert.equal(finishBody.p_credits_used, 1, "po poslanem providerskem poskusu mora tudi napaka zabeležiti 1 kredit");
  } finally {
    global.fetch = originalFetch;
  }
}

verifyOneCreditAndSharedCache()
  .then(verifySelectionDoesNotCallProvider)
  .then(verifyMonthlyRefreshUsesOneProviderCall)
  .then(verifyFailedRefreshConservativelyRecordsOneCredit)
  .then(function () {
  console.log("Dolžnikovo podjetje: največ 1 kredit, deduplikacija in mesečna osvežitev: OK");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
