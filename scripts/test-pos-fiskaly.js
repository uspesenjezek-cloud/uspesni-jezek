"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const client = require(path.join(root, "api", "_lib", "fiskaly-sign-de"));
const handler = fs.readFileSync(path.join(root, "api", "_handlers", "pos-fiskaly.js"), "utf8");
const router = fs.readFileSync(path.join(root, "api", "pos.js"), "utf8");
const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");

assert.strictEqual(client.TEST_BASE_URL, "https://kassensichv-middleware.fiskaly.com/api/v2");
assert.strictEqual(client.LIVE_BASE_URL, "https://kassensichv.fiskaly.com/api/v2");
assert.throws(() => client.configuration({}), /še ni nastavljena/);
assert.throws(() => client.configuration({ FISKALY_SIGN_DE_MODE: "live", FISKALY_API_KEY_TEST: "x", FISKALY_API_SECRET_TEST: "y" }), /še ni omogočen/);
const cfg = client.configuration({ FISKALY_API_KEY_TEST: "test_key", FISKALY_API_SECRET_TEST: "test_secret" });
assert.deepStrictEqual({ mode: cfg.mode, baseUrl: cfg.baseUrl }, { mode: "test", baseUrl: client.TEST_BASE_URL });
const configured = client.configuration({ FISKALY_API_KEY_TEST: "test_key", FISKALY_API_SECRET_TEST: "test_secret", FISKALY_TSS_ID_TEST: "tss", FISKALY_CLIENT_ID_TEST: "client" });
assert.deepStrictEqual({ tssId: configured.tssId, clientId: configured.clientId }, { tssId: "tss", clientId: "client" });
assert.strictEqual(client.listCount([{ id: 1 }]), 1);
assert.strictEqual(client.listCount({ data: [{ id: 1 }, { id: 2 }] }), 2);
assert.strictEqual(client._test.uuidV4("5c9242f4-12d0-4409-91a9-92265116f7f0"), "5c9242f4-12d0-4409-91a9-92265116f7f0");
assert.strictEqual(client._test.uuidV4("not-a-uuid"), "");
const training = client._test.trainingReceipt().standard_v1.receipt;
assert.strictEqual(training.receipt_type, "TRAINING");
assert.deepStrictEqual(training.amounts_per_payment_type, [{ payment_type: "NON_CASH", amount: "1.00", currency_code: "EUR" }]);
assert.deepStrictEqual(client._test.publicTransaction({
  _id: "5c9242f4-12d0-4409-91a9-92265116f7f0", number: 12, state: "FINISHED", revision: 2,
  signature: { counter: 44, algorithm: "ecdsa-plain-SHA256" }, time_start: "start", time_end: "end"
}), {
  transactionId: "5c9242f4-12d0-4409-91a9-92265116f7f0", transactionNumber: "12", state: "FINISHED", revision: "2",
  signatureCounter: "44", signatureAlgorithm: "ecdsa-plain-SHA256", startedAt: "start", finishedAt: "end",
  training: true, paymentType: "NON_CASH", amount: "1.00", currency: "EUR"
});
assert.match(handler, /preveriUporabnika/);
assert.match(handler, /Cache-Control/);
assert.match(handler, /training-transaction/);
assert.doesNotMatch(handler, /api_secret|FISKALY_API_SECRET_TEST/);
assert.match(router, /"fiskaly-sign": require\("\.\/_handlers\/pos-fiskaly"\)/);
assert.match(vercel, /\/api\/pos-fiskaly/);
assert.match(html, /data-fiskaly-status/);
assert.match(html, /Gotovinski modul ostaja izključen/);
assert.match(html, /data-fiskaly-test/);
assert.match(html, /data-fiskaly-result/);
assert.match(js, /loadFiskalyCapability/);
assert.match(js, /runFiskalyTrainingTest/);
assert.match(js, /integrationReady/);
assert.doesNotMatch(js, /FISKALY_API_(?:KEY|SECRET)/);

async function verifyTrainingFlow() {
  const originalFetch = global.fetch;
  const calls = [];
  const transactionId = "63f3fa9e-6c8b-4fe9-949b-534ad16132cf";
  const tssId = "5c9242f4-12d0-4409-91a9-92265116f7f0";
  const clientId = "eeb95524-a891-465c-b71f-7bfa05ae69c3";
  global.fetch = async function (url, options) {
    calls.push({ url: String(url), options: options || {} });
    let body = {};
    if (String(url).endsWith("/auth")) body = { access_token: "test-token" };
    else if (String(url).includes("/client/")) body = { state: "REGISTERED" };
    else if (String(url).includes("?tx_revision=1")) body = { _id: transactionId, state: "ACTIVE", revision: 1, number: 21 };
    else if (String(url).includes("?tx_revision=2")) body = {
      _id: transactionId, state: "FINISHED", revision: 2, number: 21,
      signature: { counter: "52", algorithm: "ecdsa-plain-SHA256" }, time_start: "start", time_end: "end"
    };
    else body = { state: "INITIALIZED" };
    return { ok: true, status: 200, json: async function () { return body; } };
  };
  try {
    const result = await client.runTrainingTransaction({
      FISKALY_SIGN_DE_MODE: "test",
      FISKALY_API_KEY_TEST: "key",
      FISKALY_API_SECRET_TEST: "secret",
      FISKALY_TSS_ID_TEST: tssId,
      FISKALY_CLIENT_ID_TEST: clientId,
    }, transactionId);
    assert.strictEqual(result.state, "FINISHED");
    assert.strictEqual(result.signatureCounter, "52");
    assert.strictEqual(calls.length, 5);
    const started = JSON.parse(calls[3].options.body);
    const finished = JSON.parse(calls[4].options.body);
    assert.strictEqual(started.state, "ACTIVE");
    assert.strictEqual(started.schema, undefined);
    assert.strictEqual(finished.state, "FINISHED");
    assert.strictEqual(finished.schema.standard_v1.receipt.receipt_type, "TRAINING");
    assert.strictEqual(finished.schema.standard_v1.receipt.amounts_per_payment_type[0].payment_type, "NON_CASH");
    assert.match(calls[3].options.headers["request-id"], /^[0-9a-f-]{36}$/i);
  } finally {
    global.fetch = originalFetch;
  }
}

verifyTrainingFlow().then(function () {
  console.log("POS fiskaly SIGN DE testna povezava in TRAINING podpis: OK");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
