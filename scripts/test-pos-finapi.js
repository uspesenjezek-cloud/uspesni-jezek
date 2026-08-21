"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Finapi = require(path.join(__dirname, "..", "api", "_lib", "finapi-access"));
const PosRouter = require(path.join(__dirname, "..", "api", "pos"))._test;
const localServer = fs.readFileSync(path.join(__dirname, "..", "scripts", "local-server.js"), "utf8");

const env = {
  FINAPI_MODE: "sandbox",
  FINAPI_CLIENT_ID: "client-id-test",
  FINAPI_CLIENT_SECRET: "client-secret-test",
  FINAPI_USER_KEY: "0123456789abcdef0123456789abcdef",
};

const rewrittenRequest = { url: "/api/pos?handler=finapi-bank" };
Object.defineProperty(rewrittenRequest, "query", {
  get: function () { throw new Error("POS router must not access the legacy req.query field"); },
});
assert.strictEqual(PosRouter.route(rewrittenRequest), "finapi-bank");
assert.strictEqual(PosRouter.route({ url: "/api/pos" }), "");
assert.strictEqual(PosRouter.route(null), "");
assert.match(localServer, /pathname === "\/api\/pos-finapi"[\s\S]*izvediLokalniApi\(req, res, posFinapiModul\)/);

assert.throws(function () { Finapi.configuration({}); }, /še ni nastavljena/);
const cfg = Finapi.configuration(env);
assert.strictEqual(cfg.baseUrl, "https://sandbox.finapi.io/api/v2");
assert.strictEqual(Finapi.WEBFORM_SANDBOX_BASE_URL, "https://webform-sandbox.finapi.io");
const userA = Finapi._test.userCredentials("11111111-2222-4333-8444-555555555555", cfg);
const userB = Finapi._test.userCredentials("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", cfg);
assert.match(userA.id, /^uj[a-z0-9]{32}$/);
assert.ok(userA.password.length >= 13);
assert.notStrictEqual(userA.password, userB.password);
assert.deepStrictEqual(userA, Finapi._test.userCredentials("11111111-2222-4333-8444-555555555555", cfg));

const testAccounts = new Map([["41", { id: "41", name: "Geschäftskonto", iban: "DE89370400440532013000" }]]);
assert.deepStrictEqual(Finapi._test.normalizeTransaction({
  id: 91,
  accountId: 41,
  amount: 12.34,
  currency: "EUR",
  bankBookingDate: "2026-08-20",
  counterpartName: "Muster Kunde",
  counterpartIban: "DE12 3456",
  purpose: "RE-2026-0001",
  isAdjustingEntry: false,
  isPotentialDuplicate: false,
}, testAccounts), {
  external_reference: "finapi:91",
  booked_on: "2026-08-20",
  amount_cents: 1234,
  currency: "EUR",
  counterparty_name: "Muster Kunde",
  counterparty_iban: "DE123456",
  remittance_info: "RE-2026-0001",
  source_account_id: "41",
  source_account_name: "Geschäftskonto",
  source_account_iban: "DE89370400440532013000",
});
assert.strictEqual(Finapi._test.normalizeTransaction({ id: 92, amount: -1, currency: "EUR", bankBookingDate: "2026-08-20" }), null);
assert.strictEqual(Finapi._test.normalizeTransaction({ id: 93, amount: 1, currency: "USD", bankBookingDate: "2026-08-20" }), null);
assert.strictEqual(Finapi._test.normalizeTransaction({ id: 94, amount: 1, currency: "EUR", bankBookingDate: "2026-08-20", isPotentialDuplicate: true }), null);

async function run() {
  const originalFetch = global.fetch;
  const requests = [];
  const responses = [
    { status: 200, body: { access_token: "client-token", expires_in: 3600 } },
    { status: 201, body: { id: userA.id, password: "XXXXX", isAutoUpdateEnabled: false, isAutoUpdateInProgress: false } },
    { status: 200, body: { access_token: "user-token", expires_in: 3600 } },
    { status: 201, body: { id: "946db09e-5bfc-11eb-ae93-0242ac130002", url: "https://webform-sandbox.finapi.io/wf/946db09e-5bfc-11eb-ae93-0242ac130002", status: "NOT_YET_OPENED", expiresAt: "2026-08-20T15:00:00.000Z" } },
    { status: 200, body: { connections: [{ id: 7, bankId: 280001, name: "finAPI Test Bank", updateStatus: "READY", categorizationStatus: "READY", accountIds: [10], interfaces: [] }] } },
    { status: 200, body: { accounts: [{ id: 41, name: "Geschäftskonto", iban: "DE89 3704 0044 0532 0130 00" }] } },
    { status: 200, body: { transactions: [{ id: 91, accountId: 41, amount: 12.34, currency: "EUR", bankBookingDate: "2026-08-20", counterpartName: "Muster Kunde", purpose: "RE-2026-0001", isAdjustingEntry: false, isPotentialDuplicate: false }], paging: { page: 1, perPage: 500, pageCount: 2, totalCount: 2 }, income: 12.34, spending: 0, balance: 12.34 } },
    { status: 200, body: { transactions: [{ id: 90, accountId: 41, amount: 56.78, currency: "EUR", bankBookingDate: "2026-08-19", counterpartName: "Zweiter Kunde", purpose: "RE-2026-0002", isAdjustingEntry: false, isPotentialDuplicate: false }], paging: { page: 2, perPage: 500, pageCount: 2, totalCount: 2 }, income: 56.78, spending: 0, balance: 69.12 } },
  ];
  global.fetch = async function (url, options) {
    requests.push({ url: String(url), options: options || {} });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected finAPI request");
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async function () { return next.body; },
    };
  };
  try {
    Finapi._test.resetTokenCache();
    const webForm = await Finapi.createDemoBankWebForm("11111111-2222-4333-8444-555555555555", env);
    assert.strictEqual(webForm.status, "NOT_YET_OPENED");
    assert.match(webForm.url, /^https:\/\/webform-sandbox\.finapi\.io\/wf\//);
    const result = await Finapi.syncDemoTransactions("11111111-2222-4333-8444-555555555555", env);
    assert.strictEqual(result.status.connected, true);
    assert.strictEqual(result.status.environment, "sandbox");
    assert.strictEqual(result.transactions.length, 2);
    assert.strictEqual(result.transactions[0].external_reference, "finapi:91");
    assert.strictEqual(result.transactions[1].external_reference, "finapi:90");
    assert.strictEqual(requests.length, 8);
    assert.match(requests[0].url, /\/oauth\/token$/);
    assert.match(requests[3].url, /webform-sandbox\.finapi\.io\/api\/webForms\/bankConnectionImport$/);
    assert.match(requests[4].url, /\/bankConnections$/);
    assert.match(requests[5].url, /\/accounts\?/);
    assert.match(requests[6].url, /\/transactions\?/);
    assert.match(requests[6].url, /view=bankView/);
    assert.match(requests[6].url, /direction=income/);
    assert.match(requests[6].url, /page=1/);
    assert.match(requests[7].url, /page=2/);
    const importBody = JSON.parse(requests[3].options.body);
    assert.strictEqual(importBody.bank.id, 280001);
    assert.strictEqual(importBody.allowTestBank, true);
    assert.deepStrictEqual(importBody.allowedInterfaces, ["XS2A"]);
    assert.doesNotMatch(requests.map(function (entry) { return entry.url; }).join("\n"), /\/bankConnections\/import/);
    assert.doesNotMatch(JSON.stringify(result), /client-secret-test|0123456789abcdef/);
  } finally {
    global.fetch = originalFetch;
    Finapi._test.resetTokenCache();
  }
  console.log("POS finAPI sandbox tests passed.");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
