"use strict";

const assert = require("assert");
const path = require("path");
const Finapi = require(path.join(__dirname, "..", "api", "_lib", "finapi-access"));

const env = {
  FINAPI_MODE: "sandbox",
  FINAPI_CLIENT_ID: "client-id-test",
  FINAPI_CLIENT_SECRET: "client-secret-test",
  FINAPI_USER_KEY: "0123456789abcdef0123456789abcdef",
};

assert.throws(function () { Finapi.configuration({}); }, /še ni nastavljena/);
const cfg = Finapi.configuration(env);
assert.strictEqual(cfg.baseUrl, "https://sandbox.finapi.io/api/v2");
const userA = Finapi._test.userCredentials("11111111-2222-4333-8444-555555555555", cfg);
const userB = Finapi._test.userCredentials("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", cfg);
assert.match(userA.id, /^uj[a-z0-9]{32}$/);
assert.ok(userA.password.length >= 13);
assert.notStrictEqual(userA.password, userB.password);
assert.deepStrictEqual(userA, Finapi._test.userCredentials("11111111-2222-4333-8444-555555555555", cfg));

assert.deepStrictEqual(Finapi._test.normalizeTransaction({
  id: 91,
  amount: 12.34,
  currency: "EUR",
  bankBookingDate: "2026-08-20",
  counterpartName: "Muster Kunde",
  counterpartIban: "DE12 3456",
  purpose: "RE-2026-0001",
  isAdjustingEntry: false,
  isPotentialDuplicate: false,
}), {
  external_reference: "finapi:91",
  booked_on: "2026-08-20",
  amount_cents: 1234,
  currency: "EUR",
  counterparty_name: "Muster Kunde",
  counterparty_iban: "DE123456",
  remittance_info: "RE-2026-0001",
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
    { status: 200, body: { connections: [] } },
    { status: 201, body: { id: 7, updateStatus: "READY", categorizationStatus: "READY", accountIds: [10], interfaces: [], importDate: "2026-08-20T12:00:00Z", bank: { id: 280001, name: "finAPI Test Bank" } } },
    { status: 200, body: { transactions: [{ id: 91, amount: 12.34, currency: "EUR", bankBookingDate: "2026-08-20", counterpartName: "Muster Kunde", purpose: "RE-2026-0001", isAdjustingEntry: false, isPotentialDuplicate: false }], paging: { page: 1, perPage: 500, pageCount: 1, totalCount: 1 }, income: 12.34, spending: 0, balance: 12.34 } },
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
    const result = await Finapi.syncDemoTransactions("11111111-2222-4333-8444-555555555555", env);
    assert.strictEqual(result.status.connected, true);
    assert.strictEqual(result.status.environment, "sandbox");
    assert.strictEqual(result.transactions.length, 1);
    assert.strictEqual(result.transactions[0].external_reference, "finapi:91");
    assert.strictEqual(requests.length, 6);
    assert.match(requests[0].url, /\/oauth\/token$/);
    assert.match(requests[3].url, /\/bankConnections$/);
    assert.match(requests[4].url, /\/bankConnections\/import$/);
    assert.match(requests[5].url, /\/transactions\?/);
    assert.match(requests[5].url, /view=bankView/);
    assert.match(requests[5].url, /direction=income/);
    const importBody = JSON.parse(requests[4].options.body);
    assert.strictEqual(importBody.bankId, 280001);
    assert.strictEqual(importBody.storeSecrets, false);
    assert.deepStrictEqual(importBody.loginCredentials.map(function (entry) { return entry.label; }), ["Onlinebanking-ID", "PIN"]);
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
