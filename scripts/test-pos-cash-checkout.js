"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cash = require("../api/_lib/pos-cash-checkout");

function memoryStore() {
  const byRequest = new Map();
  let completedCount = 0;
  return {
    get completedCount() { return completedCount; },
    async prepare(input) {
      if (byRequest.has(input.requestKey)) return byRequest.get(input.requestKey);
      const record = Object.assign({ id: "cash-1", state: cash.STATES.PREPARED, signature: null }, input);
      byRequest.set(input.requestKey, record);
      return record;
    },
    async markSigned(id, signature) {
      const record = Array.from(byRequest.values()).find((entry) => entry.id === id);
      record.state = cash.STATES.SIGNED;
      record.signature = signature;
      return record;
    },
    async markRecoveryRequired(id, code) {
      const record = Array.from(byRequest.values()).find((entry) => entry.id === id);
      record.state = cash.STATES.RECOVERY_REQUIRED;
      record.failureCode = code;
      return record;
    },
    async complete(id) {
      const record = Array.from(byRequest.values()).find((entry) => entry.id === id);
      assert.strictEqual(record.state, cash.STATES.SIGNED);
      assert.ok(record.signature);
      record.state = cash.STATES.COMPLETED;
      record.paymentId = "payment-1";
      completedCount += 1;
      return record;
    },
  };
}

const request = {
  invoiceId: "5c9242f4-12d0-4409-91a9-92265116f7f0",
  requestKey: "63f3fa9e-6c8b-4fe9-949b-534ad16132cf",
  confirmed: true,
  receipt: {
    paymentType: "CASH",
    grossCents: 12970,
    items: [
      { description: "Arbeitszeit", grossCents: 11900, vatRate: "19" },
      { description: "Material", grossCents: 1070, vatRate: "7" },
    ],
  },
};

async function run() {
  const store = memoryStore();
  let signatures = 0;
  const adapter = cash.mockTseAdapter({ signatureCounter: "44" });
  const service = cash.createService({
    store,
    tse: { environment: adapter.environment, sign: async (input) => { signatures += 1; return adapter.sign(input); } },
  });
  const first = await service(request);
  assert.strictEqual(first.state, cash.STATES.COMPLETED);
  assert.strictEqual(first.signature.signatureCounter, "44");
  assert.strictEqual(first.signature.fiscalType, "SALE");
  assert.strictEqual(first.receipt.paymentType, "CASH");
  assert.strictEqual(signatures, 1);
  assert.strictEqual(store.completedCount, 1);

  const signatureCheckout = { transactionId: request.requestKey, receipt: cash.normalizeCashReceipt(request.receipt) };
  const validSignature = await adapter.sign({ transactionId: request.requestKey, fiscalType: "SALE", receipt: signatureCheckout.receipt });
  assert.throws(() => cash.validateSignature(Object.assign({}, validSignature, { finishedAt: "" }), signatureCheckout, "SALE"), (error) => error.code === "TSE_SIGNATURE_INCOMPLETE");
  assert.throws(() => cash.validateSignature(Object.assign({}, validSignature, { qrCodeData: "x".repeat(8193) }), signatureCheckout, "SALE"), (error) => error.code === "TSE_SIGNATURE_INVALID");

  const retry = await service(request);
  assert.strictEqual(retry.paymentId, "payment-1");
  assert.strictEqual(signatures, 1, "Idempotentna ponovitev ne sme še enkrat podpisati TSE transakcije.");
  assert.strictEqual(store.completedCount, 1);

  assert.throws(() => cash.createService({ store, tse: { environment: "production", sign: async () => ({}) } }), /ostaja zaklenjen/);
  await assert.rejects(() => service(Object.assign({}, request, { confirmed: false })), (error) => error.code === "CASH_CONFIRMATION_REQUIRED");
  await assert.rejects(() => service(Object.assign({}, request, { requestKey: "7bf2b660-8a4f-44da-8a01-2cadc1d0e93c", receipt: Object.assign({}, request.receipt, { paymentType: "NON_CASH" }) })), (error) => error.code === "CASH_PAYMENT_REQUIRED");
  await assert.rejects(() => service(Object.assign({}, request, { requestKey: "1da7f92f-96e0-4820-8df1-0fb23c601424", receipt: Object.assign({}, request.receipt, { grossCents: 12971 }) })), (error) => error.code === "CASH_TOTAL_MISMATCH");

  const failedStore = memoryStore();
  const failedService = cash.createService({ store: failedStore, tse: cash.mockTseAdapter({ fail: true }) });
  await assert.rejects(() => failedService(Object.assign({}, request, { requestKey: "be046285-153d-43af-975f-562b9ab71570" })), (error) => error.code === "CASH_RECOVERY_REQUIRED");
  assert.strictEqual(failedStore.completedCount, 0, "Nejasen TSE rezultat ne sme ustvariti plačila.");
  await assert.rejects(() => failedService(Object.assign({}, request, { requestKey: "be046285-153d-43af-975f-562b9ab71570" })), (error) => error.code === "CASH_RECOVERY_REQUIRED");

  const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260826182713_pos_cash_checkout_state.sql"), "utf8");
  assert.match(migration, /check \(status in \('prepared','signed','completed','recovery_required'\)\)/i);
  assert.match(migration, /unique \(id, user_id\)/i, "Refund tabela mora imeti kompozitni checkout ownership ključ.");
  assert.match(migration, /pos_cash_checkouts_signature_size_check[\s\S]*qr_code_data,''\)\) <= 8192/i);
  assert.match(migration, /status = 'signed'[\s\S]*signature_algorithm is not null[\s\S]*tse_started_at is not null[\s\S]*tse_finished_at is not null/i);
  assert.match(migration, /v_invoice\.is_test is not true[\s\S]*Produkcijski gotovinski checkout/i);
  assert.match(migration, /private\._pos_effective_paid_cents/i);
  assert.match(migration, /payment_type[\s\S]*CASH/i);
  assert.match(migration, /status = 'signed'[\s\S]*insert into public\.pos_payments/i);
  assert.match(migration, /method, provider[\s\S]*'cash', 'fiskaly'/i);
  assert.match(migration, /if v_checkout\.status in \('signed','completed'\) then[\s\S]*signature_counter is distinct from p_signature_counter[\s\S]*signature_algorithm is distinct from left\(coalesce\(p_signature_algorithm,''\),120\)[\s\S]*tss_serial_number is distinct from p_tss_serial_number[\s\S]*client_serial_number is distinct from p_client_serial_number[\s\S]*qr_code_data is distinct from p_qr_code_data[\s\S]*tse_started_at is distinct from p_tse_started_at[\s\S]*tse_finished_at is distinct from p_tse_finished_at[\s\S]*drugačno TSE dokazilo/i, "Tudi completed checkout replay mora zavrniti spremenjeno TSE dokazilo.");
  assert.match(migration, /revoke all on function private\._pos_complete_training_cash_checkout/i);
  console.log("POS fail-closed gotovinski checkout in mock TSE: OK");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
