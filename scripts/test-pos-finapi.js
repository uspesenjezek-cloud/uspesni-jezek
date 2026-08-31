"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Finapi = require(path.join(__dirname, "..", "api", "_lib", "finapi-access"));
const PosRouter = require(path.join(__dirname, "..", "api", "pos"))._test;
const PosCore = require(path.join(__dirname, "..", "app", "pos-terminal"));
const localServer = fs.readFileSync(path.join(__dirname, "..", "scripts", "local-server.js"), "utf8");
const handlerSource = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "pos-finapi.js"), "utf8");

const env = {
  FINAPI_MODE: "sandbox",
  FINAPI_CLIENT_ID: "client-id-test",
  FINAPI_CLIENT_SECRET: "client-secret-test",
  FINAPI_USER_KEY: "0123456789abcdef0123456789abcdef",
};
const liveEnv = {
  FINAPI_MODE: "production",
  FINAPI_LIVE_ENABLED: "true",
  FINAPI_LIVE_LICENSE_CONFIRMED: "true",
  FINAPI_LIVE_DATA_PROCESSING_CONFIRMED: "true",
  FINAPI_LIVE_USER_DELETION_PROCESS_CONFIRMED: "true",
  FINAPI_CLIENT_ID_LIVE: "client-id-live",
  FINAPI_CLIENT_SECRET_LIVE: "client-secret-live",
  FINAPI_USER_KEY_LIVE: "abcdef0123456789abcdef0123456789",
};

const rewrittenRequest = { url: "/api/pos?handler=finapi-bank" };
Object.defineProperty(rewrittenRequest, "query", {
  get: function () { throw new Error("POS router must not access the legacy req.query field"); },
});
assert.strictEqual(PosRouter.route(rewrittenRequest), "finapi-bank");
assert.strictEqual(PosRouter.route({ url: "/api/pos" }), "");
assert.strictEqual(PosRouter.route(null), "");
assert.match(localServer, /pathname === "\/api\/pos-finapi"[\s\S]*izvediLokalniApi\(req, res, posFinapiModul\)/);
assert.match(handlerSource, /requestJson\(req, MAX_BODY_BYTES\)/);

assert.throws(function () { Finapi.configuration({}); }, /še ni nastavljena/);
assert.throws(
  function () { Finapi.configuration(Object.assign({}, env, { FINAPI_MODE: "production" })); },
  function (error) { return error && error.code === "FINAPI_LIVE_LOCKED"; }
);
const cfg = Finapi.configuration(env);
assert.strictEqual(cfg.baseUrl, "https://sandbox.finapi.io/api/v2");
assert.strictEqual(Finapi.WEBFORM_SANDBOX_BASE_URL, "https://webform-sandbox.finapi.io");
const liveCfg = Finapi.configuration(liveEnv);
assert.strictEqual(liveCfg.mode, "production");
assert.strictEqual(liveCfg.baseUrl, "https://live.finapi.io/api/v2");
assert.strictEqual(liveCfg.webFormBaseUrl, "https://webform-live.finapi.io");
assert.strictEqual(Finapi._test.verifiedWebFormUrl("https://webform-live.finapi.io/wf/946db09e-5bfc-11eb-ae93-0242ac130002", liveCfg), "https://webform-live.finapi.io/wf/946db09e-5bfc-11eb-ae93-0242ac130002");
assert.strictEqual(Finapi._test.verifiedWebFormUrl("https://webform.finapi.io/wf/946db09e-5bfc-11eb-ae93-0242ac130002", liveCfg), "https://webform.finapi.io/wf/946db09e-5bfc-11eb-ae93-0242ac130002");
assert.throws(
  function () { Finapi._test.verifiedWebFormUrl("https://webform-sandbox.finapi.io/wf/946db09e-5bfc-11eb-ae93-0242ac130002", liveCfg); },
  function (error) { return error && error.code === "FINAPI_WEBFORM_INVALID"; },
  "Produkcijska seja ne sme sprejeti sandbox Web Form hosta."
);
const userA = Finapi._test.userCredentials("11111111-2222-4333-8444-555555555555", cfg);
const userB = Finapi._test.userCredentials("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", cfg);
assert.match(userA.id, /^uj[a-z0-9]{32}$/);
assert.ok(userA.password.length >= 13);
assert.notStrictEqual(userA.password, userB.password);
assert.deepStrictEqual(userA, Finapi._test.userCredentials("11111111-2222-4333-8444-555555555555", cfg));
assert.deepStrictEqual(userA, Finapi._test.userCredentials("11111111-2222-4333-8444-555555555555".toUpperCase(), cfg), "Isti Supabase UUID mora imeti eno kanonično finAPI identiteto.");
assert.throws(
  function () { Finapi._test.userCredentials("user-1", cfg); },
  function (error) { return error && error.code === "FINAPI_USER_INVALID"; },
  "Poljuben niz ne sme ustvariti finAPI uporabniške preslikave."
);
assert.throws(
  function () { Finapi._test.verifiedWebFormUrl("https://webform-sandbox.finapi.io/not-a-web-form"); },
  function (error) { return error && error.code === "FINAPI_WEBFORM_INVALID"; },
  "Allowlistani host brez kanonične /wf/<id> poti ne sme biti sprejet."
);
assert.throws(
  function () { Finapi._test.verifiedWebFormUrl("https://user:pass@webform-sandbox.finapi.io/wf/946db09e-5bfc-11eb-ae93-0242ac130002"); },
  function (error) { return error && error.code === "FINAPI_WEBFORM_INVALID"; },
  "Web Form URL z uporabniškimi podatki mora biti zavrnjen."
);

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

const repeatedTransaction = {
  id: 95, accountId: 41, amount: 10, currency: "EUR", bankBookingDate: "2026-08-20",
  counterpartName: "Muster Kunde", purpose: "RE-2026-0003", isAdjustingEntry: false, isPotentialDuplicate: false,
};
assert.strictEqual(
  Finapi._test.reconcileTransactions([repeatedTransaction, Object.assign({}, repeatedTransaction)], Array.from(testAccounts.values())).length,
  1,
  "Popolnoma enaka ponovitev iste finAPI transakcije se sme uvoziti samo enkrat."
);
assert.throws(
  function () { Finapi._test.reconcileTransactions([Object.assign({}, repeatedTransaction, { accountId: 999 })], Array.from(testAccounts.values())); },
  function (error) { return error && error.code === "FINAPI_ACCOUNT_MAPPING_INVALID"; },
  "Priliv z računom, ki ne pripada uporabnikovemu seznamu računov, mora biti zavrnjen."
);
assert.throws(
  function () { Finapi._test.reconcileTransactions([repeatedTransaction, Object.assign({}, repeatedTransaction, { amount: 10.01 })], Array.from(testAccounts.values())); },
  function (error) { return error && error.code === "FINAPI_TRANSACTION_CONFLICT"; },
  "Isti finAPI transactionId z drugačnim zneskom mora fail-closed ustaviti usklajevanje."
);
assert.throws(
  function () {
    Finapi._test.reconcileTransactions([repeatedTransaction], [
      { id: 41, name: "Geschäftskonto", iban: "DE89370400440532013000" },
      { id: 41, name: "Anderes Konto", iban: "DE12500105170648489890" },
    ]);
  },
  function (error) { return error && error.code === "FINAPI_ACCOUNT_MAPPING_CONFLICT"; },
  "Nasprotujoča preslikava istega finAPI računa mora ustaviti uvoz."
);

async function run() {
  const originalFetch = global.fetch;
  Finapi._test.resetTokenCache();
  const tokenRequests = [];
  global.fetch = async function (url) {
    tokenRequests.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async function () { return { access_token: "token-" + tokenRequests.length, expires_in: 3600 }; },
    };
  };
  const firstClientToken = await Finapi._test.oauthToken({ baseUrl: "https://sandbox.finapi.io/api/v2", clientId: "client-a", clientSecret: "secret" }, "client_credentials");
  const repeatedClientToken = await Finapi._test.oauthToken({ baseUrl: "https://sandbox.finapi.io/api/v2", clientId: "client-a", clientSecret: "secret" }, "client_credentials");
  const secondClientToken = await Finapi._test.oauthToken({ baseUrl: "https://sandbox.finapi.io/api/v2", clientId: "client-b", clientSecret: "secret" }, "client_credentials");
  const otherEnvironmentToken = await Finapi._test.oauthToken({ baseUrl: "https://live.finapi.io/api/v2", clientId: "client-a", clientSecret: "secret" }, "client_credentials");
  assert.strictEqual(firstClientToken, repeatedClientToken, "Isti klient in okolje smeta ponovno uporabiti veljaven token.");
  assert.notStrictEqual(firstClientToken, secondClientToken, "Različna klienta ne smeta deliti OAuth tokena.");
  assert.notStrictEqual(firstClientToken, otherEnvironmentToken, "Sandbox in live ne smeta deliti OAuth tokena.");
  assert.strictEqual(tokenRequests.length, 3);
  Finapi._test.resetTokenCache();

  let rpcImports = 0;
  const pendingUiResult = await PosCore.processFinapiSyncResult({
    finapi: { configured: true, connected: true, pending: true },
    transactions: [{ external_reference: "finapi:must-not-import" }],
  }, async function () {
    rpcImports += 1;
    return { inserted_count: 1, duplicate_count: 0 };
  });
  assert.strictEqual(rpcImports, 0, "UI must not call the finAPI import RPC while the provider is pending.");
  assert.deepStrictEqual(pendingUiResult.transactions, []);
  assert.strictEqual(pendingUiResult.imported, false);

  const readyTransactions = [{ external_reference: "finapi:ready" }];
  const readyUiResult = await PosCore.processFinapiSyncResult({
    finapi: { configured: true, connected: true, pending: false },
    transactions: readyTransactions,
  }, async function (transactions) {
    rpcImports += 1;
    assert.deepStrictEqual(transactions, readyTransactions);
    return { inserted_count: 1, duplicate_count: 0 };
  });
  assert.strictEqual(rpcImports, 1, "ready finAPI transactions must still reach the import RPC callback exactly once");
  assert.strictEqual(readyUiResult.imported, true);
  assert.deepStrictEqual(readyUiResult.summary, { inserted_count: 1, duplicate_count: 0 });

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
  global.fetch = async function () {
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json", "content-length": String(Finapi.MAX_RESPONSE_BYTES + 1) },
    });
  };
  await assert.rejects(
    () => Finapi._test.requestJson(cfg, "/oversized", {}, 1000),
    function (error) { return error && error.code === "FINAPI_RESPONSE_TOO_LARGE" && error.retryable === true; }
  );
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

    Finapi._test.resetTokenCache();
    const pendingRequests = [];
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = function (callback) { callback(); return 0; };
    global.fetch = async function (url, options) {
      const requestUrl = String(url);
      pendingRequests.push({ url: requestUrl, options: options || {} });
      if (/\/oauth\/token$/.test(requestUrl)) {
        return { ok: true, status: 200, json: async function () { return { access_token: "pending-user-token", expires_in: 3600 }; } };
      }
      if (/\/bankConnections$/.test(requestUrl)) {
        return {
          ok: true,
          status: 200,
          json: async function () {
            return { connections: [{ id: 7, bankId: 280001, name: "finAPI Test Bank", updateStatus: "IN_PROGRESS" }] };
          },
        };
      }
      throw new Error("Unexpected request while finAPI is pending: " + requestUrl);
    };
    let pendingResult;
    try {
      pendingResult = await Finapi.syncDemoTransactions("11111111-2222-4333-8444-555555555555", env);
    } finally {
      global.setTimeout = originalSetTimeout;
    }
    assert.strictEqual(pendingResult.status.pending, true);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(pendingResult, "transactions"), false, "pending result must omit transactions");
    assert.strictEqual(Object.prototype.hasOwnProperty.call(pendingResult, "syncedAt"), false, "pending result must omit syncedAt");
    assert.strictEqual(pendingRequests.filter(function (entry) { return /\/bankConnections$/.test(entry.url); }).length, 7);
    assert.doesNotMatch(pendingRequests.map(function (entry) { return entry.url; }).join("\n"), /\/accounts(?:\?|$)|\/transactions(?:\?|$)/, "pending finAPI sync must not read accounts or transactions");

    Finapi._test.resetTokenCache();
    const liveRequests = [];
    const liveResponses = [
      { status: 200, body: { access_token: "live-client-token", expires_in: 3600 } },
      { status: 201, body: { id: userA.id } },
      { status: 200, body: { access_token: "live-user-token", expires_in: 3600 } },
      { status: 201, body: { id: "946db09e-5bfc-11eb-ae93-0242ac130002", url: "https://webform.finapi.io/wf/946db09e-5bfc-11eb-ae93-0242ac130002", status: "NOT_YET_OPENED" } },
      { status: 200, body: { connections: [{ id: 77, name: "Produktionsbank", updateStatus: "READY" }] } },
      { status: 200, body: { accounts: [{ id: 441, name: "Geschäftskonto", iban: "DE89370400440532013000" }], paging: { page: 1, pageCount: 1 } } },
      { status: 200, body: { transactions: [{ id: 991, accountId: 441, amount: 25, currency: "EUR", bankBookingDate: "2026-08-30", counterpartName: "Live Kunde", purpose: "RE-2026-0099", isAdjustingEntry: false, isPotentialDuplicate: false }], paging: { page: 1, pageCount: 1 } } },
    ];
    global.fetch = async function (url, options) {
      liveRequests.push({ url: String(url), options: options || {} });
      const next = liveResponses.shift();
      if (!next) throw new Error("Unexpected finAPI live request");
      return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async function () { return next.body; } };
    };
    const liveWebForm = await Finapi.createBankWebForm("11111111-2222-4333-8444-555555555555", liveEnv);
    const liveResult = await Finapi.syncTransactions("11111111-2222-4333-8444-555555555555", liveEnv);
    assert.match(liveWebForm.url, /^https:\/\/webform\.finapi\.io\/wf\//);
    assert.strictEqual(liveResult.status.environment, "production");
    assert.strictEqual(liveResult.status.bankName, "Produktionsbank");
    assert.strictEqual(liveResult.transactions[0].external_reference, "finapi:991");
    assert.strictEqual(liveRequests.length, 7);
    assert.ok(liveRequests.every(function (entry) { return /^(https:\/\/live\.finapi\.io\/api\/v2|https:\/\/webform-live\.finapi\.io\/api\/)/.test(entry.url); }));
    const liveImportBody = JSON.parse(liveRequests[3].options.body);
    assert.deepStrictEqual(liveImportBody.accountTypes, ["CHECKING"]);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(liveImportBody, "bank"), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(liveImportBody, "allowTestBank"), false);
    assert.doesNotMatch(JSON.stringify(liveResult), /client-secret-live|abcdef0123456789/);
  } finally {
    global.fetch = originalFetch;
    Finapi._test.resetTokenCache();
  }
  console.log("POS finAPI sandbox and fail-closed production tests passed.");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
