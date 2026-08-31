"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cash = require("../api/_lib/pos-cash-checkout");

function memoryStore() {
  const byRequest = new Map();
  let completedCount = 0;
  let nextId = 1;
  return {
    get completedCount() { return completedCount; },
    async prepare(input) {
      if (byRequest.has(input.requestKey)) return byRequest.get(input.requestKey);
      const active = Array.from(byRequest.values()).find((entry) => entry.invoiceId === input.invoiceId
        && [cash.STATES.PREPARED, cash.STATES.SIGNED, cash.STATES.RECOVERY_REQUIRED].includes(entry.state));
      if (active) {
        const error = new Error("Aktiven gotovinski poskus že obstaja.");
        error.code = "POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS";
        throw error;
      }
      const record = Object.assign({ id: "cash-" + nextId++, state: cash.STATES.PREPARED, signature: null }, input);
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
    async reconcile(id, observation) {
      const record = Array.from(byRequest.values()).find((entry) => entry.id === id);
      if (observation.providerState === "FINISHED") {
        record.state = cash.STATES.SIGNED;
        record.signature = observation.signature;
      } else if (observation.providerState === "CANCELLED"
          || (observation.providerState === "NOT_FOUND" && record.state === cash.STATES.RECOVERY_REQUIRED)) {
        record.state = cash.STATES.CANCELLED;
        record.cancelledAt = observation.observedAt;
      } else if (observation.providerState === "NOT_FOUND") {
        record.state = cash.STATES.PREPARED;
        record.cancelledAt = null;
        record.failureCode = "provider_transaction_not_found_unfenced";
      } else {
        record.state = cash.STATES.RECOVERY_REQUIRED;
      }
      record.providerObservedState = observation.providerState;
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
  const safelyCancelled = await failedService(Object.assign({}, request, { requestKey: "be046285-153d-43af-975f-562b9ab71570" }));
  assert.strictEqual(safelyCancelled.state, cash.STATES.CANCELLED, "Samo avtoritativni NOT_FOUND sme sprostiti pripravljen poskus.");

  const lostStore = memoryStore();
  const committedAdapter = cash.mockTseAdapter({ failAfterCommit: true });
  const lostResponseService = cash.createService({ store: lostStore, tse: committedAdapter });
  const lostRequest = Object.assign({}, request, { requestKey: "bbfbf041-8c85-46f8-89ce-6e69c93cf731" });
  await assert.rejects(() => lostResponseService(lostRequest), (error) => error.code === "CASH_RECOVERY_REQUIRED");
  const recovered = await lostResponseService(lostRequest);
  assert.strictEqual(recovered.state, cash.STATES.COMPLETED, "FINISHED provider lookup mora nadaljevati iz recovery stanja brez novega podpisa.");
  assert.strictEqual(lostStore.completedCount, 1);

  const activeStore = memoryStore();
  const activeService = cash.createService({ store: activeStore, tse: cash.mockTseAdapter({ fail: true, lookupState: "ACTIVE" }) });
  const activeRequest = Object.assign({}, request, { requestKey: "c4ee7894-9884-4e36-9895-43fcf0bc97f8" });
  await assert.rejects(() => activeService(activeRequest), (error) => error.code === "CASH_RECOVERY_REQUIRED");
  await assert.rejects(() => activeService(activeRequest), (error) => error.code === "CASH_RECOVERY_REQUIRED" && error.record && error.record.providerObservedState === "ACTIVE");

  const fencedStore = memoryStore();
  const fencedRequest = Object.assign({}, request, {
    requestKey: "2eb66caa-15cc-4f60-a96a-0a13872551cd",
    transactionId: "2eb66caa-15cc-4f60-a96a-0a13872551cd",
    receipt: cash.normalizeCashReceipt(request.receipt),
  });
  const fencedRecord = await fencedStore.prepare(fencedRequest);
  const notFoundAdapter = cash.mockTseAdapter({ lookupState: "NOT_FOUND" });
  await assert.rejects(
    () => cash.reconcileProviderRecord(fencedRecord, fencedStore, notFoundAdapter, "SALE"),
    (error) => error.code === "CASH_RETRY_REQUIRED" && error.record
      && error.record.state === cash.STATES.PREPARED
      && error.record.transactionId === fencedRequest.transactionId,
    "NOT_FOUND brez in-flight fencea mora ohraniti prepared zapis in isti transaction ID."
  );
  await assert.rejects(
    () => fencedStore.prepare(Object.assign({}, fencedRequest, { requestKey: "62086264-f6ca-4c52-aa79-0921b849aa62", transactionId: "62086264-f6ca-4c52-aa79-0921b849aa62" })),
    (error) => error.code === "POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS",
    "Prepared + NOT_FOUND mora še vedno blokirati nov gotovinski poskus."
  );
  await fencedStore.markRecoveryRequired(fencedRecord.id, "provider_result_unknown");
  const fencedCancelled = await cash.reconcileProviderRecord(fencedRecord, fencedStore, notFoundAdapter, "SALE");
  assert.strictEqual(fencedCancelled.state, cash.STATES.CANCELLED, "Šele recovery_required + NOT_FOUND sme sprostiti poskus.");
  const replacement = await fencedStore.prepare(Object.assign({}, fencedRequest, {
    requestKey: "62086264-f6ca-4c52-aa79-0921b849aa62",
    transactionId: "62086264-f6ca-4c52-aa79-0921b849aa62",
  }));
  await assert.rejects(
    () => cash.reconcileProviderRecord(replacement, fencedStore, cash.mockTseAdapter({ lookupState: "ACTIVE" }), "SALE"),
    (error) => error.code === "CASH_RECOVERY_REQUIRED" && error.record
      && error.record.state === cash.STATES.RECOVERY_REQUIRED,
    "Prepared + ACTIVE mora ostati zaklenjen kot recovery_required."
  );

  const evidenceStore = memoryStore();
  const evidenceRequest = Object.assign({}, request, { requestKey: "f1d90b72-cc31-4b8c-a470-82ca0fc0e406" });
  const mismatchedEvidenceService = cash.createService({
    store: evidenceStore,
    tse: {
      environment: "training",
      async sign() {
        const error = new Error("lost response");
        error.code = "TSE_RESULT_UNCERTAIN";
        throw error;
      },
      async lookup(input) {
        return {
          state: "FINISHED",
          transactionId: input.transactionId,
          fiscalType: "REFUND",
          signatureCounter: "77",
          signatureAlgorithm: "ecdsa-plain-SHA256",
          tssSerialNumber: "provider-tss",
          clientSerialNumber: "provider-client",
          qrCodeData: "V0;provider-evidence",
          paymentType: "CASH",
          currency: "EUR",
          amount: (input.receipt.grossCents / 100).toFixed(2),
          startedAt: "2026-08-30T10:00:00.000Z",
          finishedAt: "2026-08-30T10:00:01.000Z",
          observedAt: "2026-08-30T10:00:02.000Z",
        };
      },
    },
  });
  await assert.rejects(
    () => mismatchedEvidenceService(evidenceRequest),
    (error) => error.code === "CASH_RECOVERY_REQUIRED",
    "Izgubljen odgovor mora zapis zakleniti za provider recovery."
  );
  await assert.rejects(
    () => mismatchedEvidenceService(evidenceRequest),
    (error) => error.code === "TSE_SIGNATURE_MISMATCH",
    "Provider FINISHED z napačno fiskalno vrsto ne sme zaključiti SALE checkouta."
  );
  assert.strictEqual(evidenceStore.completedCount, 0, "Neujemajoče provider dokazilo ne sme ustvariti plačila.");

  const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260826182713_pos_cash_checkout_state.sql"), "utf8");
  const safetyMigration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260829165203_pos_payment_safety_v2.sql"), "utf8");
  const recoveryMigration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260830212909_pos_cash_provider_recovery_lock_order.sql"), "utf8");
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
  assert.match(safetyMigration, /pos_cash_checkouts_one_active_per_invoice_uidx[\s\S]*prepared','signed','recovery_required/i);
  assert.match(safetyMigration, /POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS/i);
  assert.match(safetyMigration, /pos_complete_training_cash_checkout_service/i);
  assert.match(safetyMigration, /create or replace function public\.pos_prepare_training_cash_checkout[\s\S]*for update[\s\S]*request_key = p_request_key/i);
  assert.match(recoveryMigration, /status in \('prepared','signed','completed','recovery_required','cancelled'\)/i);
  assert.doesNotMatch(recoveryMigration, /v_state in \('CANCELLED','NOT_FOUND'\)/i, "CANCELLED in NOT_FOUND morata imeti ločeni varnostni veji.");
  assert.match(recoveryMigration, /elsif v_state = 'NOT_FOUND' then[\s\S]*if v_checkout\.status = 'recovery_required' then[\s\S]*status = 'cancelled'[\s\S]*elsif v_checkout\.status = 'prepared' then[\s\S]*status = 'prepared'[\s\S]*cancelled_at = null[\s\S]*provider_transaction_not_found_unfenced/i, "Prepared + NOT_FOUND mora ohraniti isti živi checkout; samo recovery_required sme biti preklican.");
  assert.match(recoveryMigration, /else\s+if v_checkout\.status in \('signed','completed','cancelled'\) then return v_checkout; end if;[\s\S]*status = 'recovery_required'[\s\S]*provider_observed_state = 'ACTIVE'/i, "ACTIVE mora prepared checkout premakniti v recovery_required brez sprostitve unique locka.");
  assert.match(recoveryMigration, /create function public\.pos_reconcile_training_cash_checkout_service[\s\S]*security invoker[\s\S]*set search_path = ''/i);
  assert.match(recoveryMigration, /select \* into v_invoice[\s\S]*for update[\s\S]*select \* into v_checkout[\s\S]*for update[\s\S]*select \* into v_payment[\s\S]*for update/i, "Končni lock order mora biti invoice -> checkout -> payment.");
  console.log("POS fail-closed gotovinski checkout in mock TSE: OK");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
