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
const css = fs.readFileSync(path.join(root, "app", "pos-terminal.css"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
const qrBuild = fs.readFileSync(path.join(root, "scripts", "build-qrcode-browser.mjs"), "utf8");

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
const normalizedReceipt = client._test.normalizeTrainingReceipt({
  paymentType: "CASH",
  items: [
    { description: "Arbeitszeit", quantityMilli: 1000, unitGrossCents: 11900, vatRate: "19" },
    { description: "Testmaterial", quantityMilli: 1000, unitGrossCents: 1070, vatRate: "7" }
  ]
});
assert.deepStrictEqual({ gross: normalizedReceipt.grossCents, net: normalizedReceipt.netCents, tax: normalizedReceipt.taxCents }, { gross: 12970, net: 11000, tax: 1970 });
assert.deepStrictEqual(client._test.trainingReceipt(normalizedReceipt).standard_v1.receipt.amounts_per_vat_rate, [
  { vat_rate: "NORMAL", amount: "119.00" }, { vat_rate: "REDUCED_1", amount: "10.70" }
]);
assert.deepStrictEqual(client._test.trainingReceipt(normalizedReceipt).standard_v1.receipt.amounts_per_payment_type, [{ payment_type: "CASH", amount: "129.70", currency_code: "EUR" }]);
assert.throws(() => client._test.normalizeTrainingReceipt({ items: [] }), /od 1 do 12/);
assert.throws(() => client._test.normalizeTrainingReceipt({ paymentType: "WIRE", items: [{ description: "Test", quantityMilli: 1000, unitGrossCents: 100, vatRate: "19" }] }), /ni podprt/);
assert.throws(() => client._test.normalizeTrainingReceipt({ items: [{ description: "Test", quantityMilli: 100000000, unitGrossCents: 100000000, vatRate: "19" }] }), /varen obračunski obseg/);
const publicReceipt = client._test.publicTransaction({
  _id: "5c9242f4-12d0-4409-91a9-92265116f7f0", number: 12, state: "FINISHED", revision: 2,
  signature: { counter: 44, algorithm: "ecdsa-plain-SHA256" }, time_start: "start", time_end: "end",
  tss_serial_number: "tss-serial", client_serial_number: "ers-serial", qr_code_data: "V0;test"
}, normalizedReceipt);
assert.deepStrictEqual({
  transactionId: publicReceipt.transactionId, transactionNumber: publicReceipt.transactionNumber, state: publicReceipt.state,
  signatureCounter: publicReceipt.signatureCounter, tss: publicReceipt.tssSerialNumber, client: publicReceipt.clientSerialNumber,
  qr: publicReceipt.qrCodeData, payment: publicReceipt.paymentType, amount: publicReceipt.amount
}, {
  transactionId: "5c9242f4-12d0-4409-91a9-92265116f7f0", transactionNumber: "12", state: "FINISHED",
  signatureCounter: "44", tss: "tss-serial", client: "ers-serial", qr: "V0;test", payment: "CASH", amount: "129.70"
});
assert.strictEqual(publicReceipt.receipt.items.length, 2);
assert.match(handler, /preveriUporabnika/);
assert.match(handler, /Cache-Control/);
assert.match(handler, /training-transaction/);
assert.match(handler, /training-receipt/);
assert.doesNotMatch(handler, /api_secret|FISKALY_API_SECRET_TEST/);
assert.match(router, /"fiskaly-sign": require\("\.\/_handlers\/pos-fiskaly"\)/);
assert.match(vercel, /\/api\/pos-fiskaly/);
assert.match(html, /data-fiskaly-status/);
assert.match(html, /Gotovinski modul ostaja izključen/);
assert.match(html, /data-fiskaly-test/);
assert.match(html, /data-fiskaly-result/);
assert.match(html, /data-fiskaly-receipt-backdrop/);
assert.match(html, /data-kassenbon-client/);
assert.match(html, /data-kassenbon-tss/);
assert.match(html, /data-kassenbon-counter/);
assert.match(html, /data-kassenbon-qr/);
assert.match(html, /TRAINING – brez pravega poslovnega dogodka/);
assert.match(html, /pos-terminal\.css\?v=20260821-stripe-refund-v1/);
assert.match(html, /qrcode\.bundle\.js\?v=20260820-local-qr-v1/);
assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/qrcode/);
assert.match(js, /loadFiskalyCapability/);
assert.match(js, /submitFiskalyTrainingReceipt/);
assert.match(js, /renderSignedKassenbon/);
assert.match(js, /QRCode\.toCanvas/);
assert.match(js, /FISKALY_TRAINING_RECEIPT_KEY/);
assert.match(js, /fiskalyRetryable/);
assert.match(js, /integrationReady/);
assert.doesNotMatch(js, /FISKALY_API_(?:KEY|SECRET)/);
assert.match(css, /\.pos-fiskaly-receipt-sheet/);
assert.match(css, /\.pos-fiskaly-receipt-form\[hidden\]\s*\{\s*display:\s*none/);
assert.match(css, /\.pos-kassenbon-tse/);
assert.match(css, /overflow-wrap:\s*anywhere/);
assert.match(packageJson, /"qrcode":\s*"1\.5\.4"/);
assert.match(packageJson, /build-qrcode-browser\.mjs/);
assert.match(qrBuild, /qrcode-entry\.js/);

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
      signature: { counter: "52", algorithm: "ecdsa-plain-SHA256" }, time_start: "start", time_end: "end",
      tss_serial_number: "tss-serial", client_serial_number: "ers-serial", qr_code_data: "V0;test-receipt"
    };
    else body = { state: "INITIALIZED" };
    return { ok: true, status: 200, json: async function () { return body; } };
  };
  try {
    const result = await client.runTrainingReceipt({
      FISKALY_SIGN_DE_MODE: "test",
      FISKALY_API_KEY_TEST: "key",
      FISKALY_API_SECRET_TEST: "secret",
      FISKALY_TSS_ID_TEST: tssId,
      FISKALY_CLIENT_ID_TEST: clientId,
    }, transactionId, {
      paymentType: "CASH",
      items: [
        { description: "Arbeitszeit", quantityMilli: 1000, unitGrossCents: 11900, vatRate: "19" },
        { description: "Testmaterial", quantityMilli: 1000, unitGrossCents: 1070, vatRate: "7" }
      ]
    });
    assert.strictEqual(result.state, "FINISHED");
    assert.strictEqual(result.signatureCounter, "52");
    assert.strictEqual(result.qrCodeData, "V0;test-receipt");
    assert.strictEqual(result.receipt.grossCents, 12970);
    assert.strictEqual(calls.length, 5);
    const started = JSON.parse(calls[3].options.body);
    const finished = JSON.parse(calls[4].options.body);
    assert.strictEqual(started.state, "ACTIVE");
    assert.strictEqual(started.schema, undefined);
    assert.strictEqual(finished.state, "FINISHED");
    assert.strictEqual(finished.schema.standard_v1.receipt.receipt_type, "TRAINING");
    assert.strictEqual(finished.schema.standard_v1.receipt.amounts_per_payment_type[0].payment_type, "CASH");
    assert.strictEqual(finished.schema.standard_v1.receipt.amounts_per_payment_type[0].amount, "129.70");
    assert.deepStrictEqual(finished.schema.standard_v1.receipt.amounts_per_vat_rate, [
      { vat_rate: "NORMAL", amount: "119.00" }, { vat_rate: "REDUCED_1", amount: "10.70" }
    ]);
    assert.match(calls[3].options.headers["request-id"], /^[0-9a-f-]{36}$/i);
  } finally {
    global.fetch = originalFetch;
  }
}

verifyTrainingFlow().then(function () {
  console.log("POS fiskaly SIGN DE testna povezava, TRAINING košarica in Kassenbon: OK");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
