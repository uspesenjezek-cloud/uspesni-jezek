"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const client = require(path.join(root, "api", "_lib", "fiskaly-sign-de"));
const cash = require(path.join(root, "api", "_lib", "pos-cash-checkout"));
const handler = fs.readFileSync(path.join(root, "api", "_handlers", "pos-fiskaly.js"), "utf8");
const handlerModule = require(path.join(root, "api", "_handlers", "pos-fiskaly.js"));
const supabaseServer = require(path.join(root, "api", "_lib", "supabase-server.js"));
const router = fs.readFileSync(path.join(root, "api", "pos.js"), "utf8");
const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "pos-terminal.css"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
const qrBuild = fs.readFileSync(path.join(root, "scripts", "build-qrcode-browser.mjs"), "utf8");
const scopeDocument = fs.readFileSync(path.join(root, "docs", "POS-FISKALY-SCOPE-DE.md"), "utf8");

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
assert.match(handler, /local-training-cash-checkout/);
assert.match(handler, /local-training-cash-refund/);
assert.match(handler, /local-training-cash-reconcile/);
assert.match(handler, /local-training-cash-refund-reconcile/);
assert.match(handler, /const reconcileOnly = action\.includes\("reconcile"\)/);
assert.match(handler, /recovery && \[cash\.STATES\.PREPARED, cash\.STATES\.RECOVERY_REQUIRED, cash\.STATES\.CANCELLED\]\.includes\(recovery\.state\)/);
assert.match(handler, /pos_reconcile_training_cash_checkout_service/);
assert.match(handler, /pos_reconcile_training_cash_refund_service/);
assert.match(handler, /retrieveTrainingReceipt\([\s\S]*input\.fiscalType/);
assert.doesNotMatch(handler, /result\.fiscalType\s*=/, "Handler ne sme lokalno izdelati providerjeve fiskalne vrste.");
assert.doesNotMatch(handler, /new Map\(|localCashRecords|localCashRefundRecords/);
assert.match(handler, /pokliciRpcKotUporabnik[\s\S]*pos_prepare_training_cash_checkout/);
assert.match(handler, /preveriUporabnika[\s\S]*local-training-cash-checkout/);
assert.match(handler, /POS_LOCAL_MOCKS_ENABLED/);
assert.match(handler, /requestJson\(req, MAX_BODY_BYTES\)/);
assert.doesNotMatch(handler, /api_secret|FISKALY_API_SECRET_TEST/);
assert.match(router, /"fiskaly-sign": require\("\.\/_handlers\/pos-fiskaly"\)/);
assert.match(vercel, /\/api\/pos-fiskaly/);
assert.match(html, /data-fiskaly-status/);
assert.match(html, /Gotovinski tok je lokalno popoln v TRAINING načinu/);
assert.doesNotMatch(html, /Ta različica nima gotovinske funkcije/);
assert.match(html, /data-fiskaly-test/);
assert.match(html, /data-fiskaly-result/);
assert.match(html, /data-fiskaly-receipt-backdrop/);
assert.match(html, /data-kassenbon-client/);
assert.match(html, /data-kassenbon-tss/);
assert.match(html, /data-kassenbon-counter/);
assert.match(html, /data-kassenbon-qr/);
assert.match(html, /TRAINING – brez pravega poslovnega dogodka/);
assert.match(html, /pos-terminal\.css\?v=202608(?:2[2-9]|3[01])-[^"']+/);
assert.match(html, /qrcode\.bundle\.js\?v=20260820-local-qr-v1/);
assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/qrcode/);
assert.match(js, /loadFiskalyCapability/);
assert.match(js, /submitFiskalyTrainingReceipt/);
assert.match(js, /renderSignedKassenbon/);
assert.match(js, /QRCode\.toCanvas/);
assert.match(js, /FISKALY_TRAINING_RECEIPT_KEY/);
assert.match(js, /fiskalyRetryable/);
assert.match(js, /local-training-cash-checkout[\s\S]*Authorization:\s*"Bearer " \+ token/);
assert.match(js, /integrationReady/);
assert.match(js, /configured:\s*false[\s\S]*lastError:\s*true/);
assert.doesNotMatch(js, /FISKALY_API_(?:KEY|SECRET)/);
assert.match(scopeDocument, /auch Barzahlungen unterstützen/i);
assert.match(scopeDocument, /DSFinV-K-Export/i);
assert.match(scopeDocument, /cashModuleEnabled.*false/i);
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
  const env = {
    FISKALY_SIGN_DE_MODE: "test",
    FISKALY_API_KEY_TEST: "key",
    FISKALY_API_SECRET_TEST: "secret",
    FISKALY_TSS_ID_TEST: tssId,
    FISKALY_CLIENT_ID_TEST: clientId,
  };
  const receiptInput = {
    paymentType: "CASH",
    items: [
      { description: "Arbeitszeit", quantityMilli: 1000, unitGrossCents: 11900, vatRate: "19" },
      { description: "Testmaterial", quantityMilli: 1000, unitGrossCents: 1070, vatRate: "7" }
    ]
  };
  const baseFinishedBody = {
    _id: transactionId, state: "FINISHED", revision: 2, number: 21,
    client_id: clientId,
    metadata: { source: "werktech_pos", purpose: "sandbox_kassenbon", receipt_type: "training", fiscal_type: "sale" },
    schema: { standard_v1: { receipt: {
      receipt_type: "TRAINING",
      amounts_per_vat_rate: [
        { vat_rate: "NORMAL", amount: "119.00" },
        { vat_rate: "REDUCED_1", amount: "10.70" }
      ],
      amounts_per_payment_type: [{ payment_type: "CASH", amount: "129.70", currency_code: "EUR" }]
    } } },
    signature: { counter: "52", algorithm: "ecdsa-plain-SHA256" },
    time_start: "2026-08-30T10:00:00.000Z", time_end: "2026-08-30T10:00:01.000Z",
    tss_serial_number: "tss-serial", client_serial_number: "ers-serial", qr_code_data: "V0;test-receipt"
  };
  let finishedBody = baseFinishedBody;
  global.fetch = async function () {
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json", "content-length": String(client.MAX_RESPONSE_BYTES + 1) },
    });
  };
  await assert.rejects(
    () => client._test.requestJson(client.TEST_BASE_URL + "/oversized", {}, 1000),
    function (error) { return error && error.code === "FISKALY_RESPONSE_TOO_LARGE" && error.retryable === true; }
  );
  global.fetch = async function (url, options) {
    calls.push({ url: String(url), options: options || {} });
    let body = {};
    if (String(url).endsWith("/auth")) body = { access_token: "test-token" };
    else if (String(url).includes("/client/")) body = { state: "REGISTERED" };
    else if (String(url).includes("?tx_revision=1")) body = { _id: transactionId, state: "ACTIVE", revision: 1, number: 21 };
    else if (String(url).includes("?tx_revision=2")) body = finishedBody;
    else body = { state: "INITIALIZED" };
    return { ok: true, status: 200, json: async function () { return body; } };
  };
  try {
    const result = await client.runTrainingReceipt(env, transactionId, receiptInput);
    assert.strictEqual(result.state, "FINISHED");
    assert.strictEqual(result.signatureCounter, "52");
    assert.strictEqual(result.qrCodeData, "V0;test-receipt");
    assert.strictEqual(result.fiscalType, "SALE");
    assert.strictEqual(result.paymentType, "CASH");
    assert.strictEqual(result.amount, "129.70");
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
    finishedBody = JSON.parse(JSON.stringify(baseFinishedBody));
    finishedBody.schema.standard_v1.receipt.amounts_per_payment_type[0].amount = "129.71";
    await assert.rejects(
      () => client.runTrainingReceipt(env, transactionId, receiptInput),
      (error) => error && error.code === "FISKALY_TX_LOOKUP_MISMATCH"
    );
    finishedBody = JSON.parse(JSON.stringify(baseFinishedBody));
    finishedBody.client_id = "another-client";
    await assert.rejects(
      () => client.runTrainingReceipt(env, transactionId, receiptInput),
      (error) => error && error.code === "FISKALY_TX_LOOKUP_MISMATCH"
    );
    for (const mutate of [
      (body) => { delete body.signature.algorithm; },
      (body) => { body.time_start = "not-a-date"; },
      (body) => { body.time_end = "2026-08-30T09:59:59.000Z"; }
    ]) {
      finishedBody = JSON.parse(JSON.stringify(baseFinishedBody));
      mutate(finishedBody);
      await assert.rejects(
        () => client.runTrainingReceipt(env, transactionId, receiptInput),
        (error) => error && error.code === "FISKALY_TX_INCOMPLETE"
      );
    }
    finishedBody = JSON.parse(JSON.stringify(baseFinishedBody));
    finishedBody.schema.standard_v1.receipt.amounts_per_vat_rate = [{ vat_rate: "NORMAL", amount: "1.00" }];
    finishedBody.schema.standard_v1.receipt.amounts_per_payment_type = [{ payment_type: "NON_CASH", amount: "1.00", currency_code: "EUR" }];
    const nonCash = await client.runTrainingTransaction(env, transactionId);
    assert.strictEqual(nonCash.paymentType, "NON_CASH");
    assert.strictEqual(nonCash.amount, "1.00");
  } finally {
    global.fetch = originalFetch;
  }
}

async function verifyTrainingLookupEvidence() {
  const originalFetch = global.fetch;
  const transactionId = "63f3fa9e-6c8b-4fe9-949b-534ad16132cf";
  const clientId = "eeb95524-a891-465c-b71f-7bfa05ae69c3";
  const env = {
    FISKALY_SIGN_DE_MODE: "test",
    FISKALY_API_KEY_TEST: "key",
    FISKALY_API_SECRET_TEST: "secret",
    FISKALY_TSS_ID_TEST: "5c9242f4-12d0-4409-91a9-92265116f7f0",
    FISKALY_CLIENT_ID_TEST: clientId,
  };
  const receiptInput = {
    paymentType: "CASH",
    items: [
      { description: "Arbeitszeit", quantityMilli: 1000, unitGrossCents: 11900, vatRate: "19" },
      { description: "Testmaterial", quantityMilli: 1000, unitGrossCents: 1070, vatRate: "7" },
    ],
  };
  const baseBody = {
    _id: transactionId,
    client_id: clientId,
    state: "FINISHED",
    revision: 2,
    number: 21,
    metadata: { source: "werktech_pos", purpose: "sandbox_kassenbon", receipt_type: "training", fiscal_type: "sale" },
    schema: { standard_v1: { receipt: {
      receipt_type: "TRAINING",
      amounts_per_vat_rate: [
        { vat_rate: "NORMAL", amount: "119.00" },
        { vat_rate: "REDUCED_1", amount: "10.70" }
      ],
      amounts_per_payment_type: [{ payment_type: "CASH", amount: "129.70", currency_code: "EUR" }]
    } } },
    signature: { counter: "52", algorithm: "ecdsa-plain-SHA256" },
    time_start: "2026-08-30T10:00:00.000Z",
    time_end: "2026-08-30T10:00:01.000Z",
    tss_serial_number: "tss-serial",
    client_serial_number: "ers-serial",
    qr_code_data: "V0;test-receipt",
  };
  let lookupBody = baseBody;
  global.fetch = async function (url) {
    const body = String(url).endsWith("/auth") ? { access_token: "test-token" } : lookupBody;
    return { ok: true, status: 200, json: async function () { return body; } };
  };

  function cloneBody() { return JSON.parse(JSON.stringify(baseBody)); }
  async function rejectsLookup(mutator) {
    lookupBody = cloneBody();
    mutator(lookupBody);
    await assert.rejects(
      () => client.retrieveTrainingReceipt(env, transactionId, receiptInput, "SALE"),
      function (error) { return error && error.code === "FISKALY_TX_LOOKUP_MISMATCH"; }
    );
  }

  try {
    const exact = await client.retrieveTrainingReceipt(env, transactionId, receiptInput, "SALE");
    assert.strictEqual(exact.fiscalType, "SALE");
    assert.strictEqual(exact.paymentType, "CASH");
    assert.strictEqual(exact.currency, "EUR");
    assert.strictEqual(exact.amount, "129.70");
    assert.deepStrictEqual(exact.providerReceipt.totalsByVat, [
      { vatRate: "NORMAL", amountCents: 11900 },
      { vatRate: "REDUCED_1", amountCents: 1070 },
    ]);

    await rejectsLookup(function (body) { delete body.client_id; });
    await rejectsLookup(function (body) { body.client_id = "another-client"; });
    await rejectsLookup(function (body) { body.client_id = " " + clientId + " "; });
    await rejectsLookup(function (body) { delete body.schema; });
    await rejectsLookup(function (body) { body.schema.standard_v1.receipt.receipt_type = "RECEIPT"; });
    await rejectsLookup(function (body) { body.schema.standard_v1.receipt.receipt_type = "training"; });
    await rejectsLookup(function (body) { body.metadata.fiscal_type = "refund"; });
    await rejectsLookup(function (body) { body.schema.standard_v1.receipt.amounts_per_payment_type[0].amount = "129.71"; });
    await rejectsLookup(function (body) { body.schema.standard_v1.receipt.amounts_per_payment_type[0].amount = 129.70; });
    await rejectsLookup(function (body) { body.schema.standard_v1.receipt.amounts_per_payment_type[0].payment_type = "NON_CASH"; });
    await rejectsLookup(function (body) { body.schema.standard_v1.receipt.amounts_per_payment_type.push({ payment_type: "CASH", amount: "0.00", currency_code: "EUR" }); });
    await rejectsLookup(function (body) { body.schema.standard_v1.receipt.amounts_per_payment_type[0].currency_code = "USD"; });
    await rejectsLookup(function (body) { body.schema.standard_v1.receipt.amounts_per_vat_rate[0].amount = "118.99"; });
    await rejectsLookup(function (body) {
      body.schema.standard_v1.receipt.amounts_per_vat_rate[1].vat_rate = "NORMAL";
    });
    await rejectsLookup(function (body) {
      body.schema.standard_v1.receipt.amounts_per_vat_rate.push({ vat_rate: "NULL", amount: "0.00" });
    });

    lookupBody = cloneBody();
    lookupBody.metadata = { source: "werktech_pos", purpose: "sandbox_kassenbon", receipt_type: "training", fiscal_type: "refund" };
    const refund = await client.retrieveTrainingReceipt(env, transactionId, receiptInput, "REFUND");
    assert.strictEqual(refund.fiscalType, "REFUND", "Providerjev marker mora določiti refund vrsto brez handlerjevega pripisa.");
  } finally {
    global.fetch = originalFetch;
  }
}

async function verifyLocalCashHandler() {
  const originals = {
    userRpc: supabaseServer.pokliciRpcKotUporabnik,
    serviceRpc: supabaseServer.pokliciRpc,
  };
  const userId = "22222222-2222-4222-8222-222222222222";
  const invoiceId = "63f3fa9e-6c8b-4fe9-949b-534ad16132cf";
  const requestKey = "5c9242f4-12d0-4409-91a9-92265116f7f0";
  const refundKey = "7bf2b660-8a4f-44da-8a01-2cadc1d0e93c";
  const auth = { token: "user-access-token", user: { id: userId } };
  const receipt = {
    paymentType: "CASH", currency: "EUR", grossCents: 11900,
    items: [{ description: "Arbeitszeit", grossCents: 11900, vatRate: "19" }],
  };
  let checkoutRow = null;
  let refundRow = null;
  const calls = [];

  supabaseServer.pokliciRpcKotUporabnik = async (_cfg, token, name, payload) => {
    calls.push(name);
    assert.strictEqual(token, auth.token);
    if (name === "pos_prepare_training_cash_checkout") {
      checkoutRow = checkoutRow || {
        id: "33333333-3333-4333-8333-333333333333", user_id: userId,
        invoice_id: invoiceId, request_key: payload.p_request_key,
        transaction_id: payload.p_transaction_id, status: "prepared",
        receipt_snapshot: payload.p_receipt, failure_code: "", payment_id: null,
      };
      return [checkoutRow];
    }
    assert.strictEqual(name, "pos_prepare_training_cash_refund");
    refundRow = refundRow || {
      id: "44444444-4444-4444-8444-444444444444", user_id: userId,
      checkout_id: checkoutRow.id, invoice_id: invoiceId,
      request_key: payload.p_request_key, transaction_id: payload.p_transaction_id,
      status: "prepared", receipt_snapshot: payload.p_receipt, failure_code: "",
    };
    return [refundRow];
  };

  supabaseServer.pokliciRpc = async (_cfg, name, payload) => {
    calls.push(name);
    if (name === "pos_record_training_cash_signature_service") {
      Object.assign(checkoutRow, {
        status: "signed", signature_counter: payload.p_signature_counter,
        signature_algorithm: payload.p_signature_algorithm,
        tss_serial_number: payload.p_tss_serial_number,
        client_serial_number: payload.p_client_serial_number,
        qr_code_data: payload.p_qr_code_data,
        tse_started_at: payload.p_tse_started_at, tse_finished_at: payload.p_tse_finished_at,
      });
      return [checkoutRow];
    }
    if (name === "pos_complete_training_cash_checkout_service") {
      Object.assign(checkoutRow, { status: "completed", payment_id: "55555555-5555-4555-8555-555555555555", completed_at: "2026-08-29T12:00:00.000Z" });
      return [checkoutRow];
    }
    if (name === "pos_record_training_cash_refund_signature_service") {
      Object.assign(refundRow, {
        status: "signed", signature_counter: payload.p_signature_counter,
        signature_algorithm: payload.p_signature_algorithm,
        tss_serial_number: payload.p_tss_serial_number,
        client_serial_number: payload.p_client_serial_number,
        qr_code_data: payload.p_qr_code_data,
        tse_started_at: payload.p_tse_started_at, tse_finished_at: payload.p_tse_finished_at,
      });
      return [refundRow];
    }
    if (name === "pos_complete_training_cash_refund_service") {
      Object.assign(refundRow, { status: "completed", completed_at: "2026-08-29T12:01:00.000Z" });
      return [refundRow];
    }
    throw new Error("Nepričakovan RPC: " + name);
  };

  try {
    const checkoutService = cash.createService({
      store: handlerModule._test.createCashStore({}, {}, auth), tse: cash.mockTseAdapter(),
    });
    const checkoutRequest = { invoiceId, requestKey, transactionId: requestKey, confirmed: true, receipt };
    const first = await checkoutService(checkoutRequest);
    const repeated = await checkoutService(checkoutRequest);
    assert.strictEqual(first.state, "completed");
    assert.strictEqual(first.signature.tssSerialNumber, "mock-tss");
    assert.strictEqual(repeated.paymentId, first.paymentId, "Ponovitev Supabase checkouta mora ostati idempotentna.");
    assert.strictEqual(calls.filter((name) => name === "pos_record_training_cash_signature_service").length, 1);

    const refundService = cash.createRefundService({
      store: handlerModule._test.createCashRefundStore({}, {}, auth), tse: cash.mockTseAdapter(),
      lookupCheckout: async () => handlerModule._test.checkoutFromRow(checkoutRow),
    });
    const refundRequest = {
      invoiceId, originalCheckoutId: first.id, requestKey: refundKey,
      transactionId: refundKey, confirmed: true, receipt: first.receipt,
    };
    const refund = await refundService(refundRequest);
    const repeatedRefund = await refundService(refundRequest);
    assert.strictEqual(refund.state, "completed");
    assert.strictEqual(refund.signature.fiscalType, "REFUND");
    assert.strictEqual(repeatedRefund.id, refund.id, "Ponovitev Supabase povračila mora ostati idempotentna.");
    assert.strictEqual(calls.filter((name) => name === "pos_record_training_cash_refund_signature_service").length, 1);
  } finally {
    supabaseServer.pokliciRpcKotUporabnik = originals.userRpc;
    supabaseServer.pokliciRpc = originals.serviceRpc;
  }
}

Promise.resolve().then(verifyTrainingFlow).then(verifyTrainingLookupEvidence).then(verifyLocalCashHandler).then(function () {
  console.log("POS fiskaly SIGN DE testna povezava, TRAINING košarica in Kassenbon: OK");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
