"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cash = require("../api/_lib/pos-cash-checkout");

function memoryStore() {
  const records = new Map();
  let completedCount = 0;
  return {
    get completedCount() { return completedCount; },
    async prepare(input) {
      if (records.has(input.requestKey)) return records.get(input.requestKey);
      const record = Object.assign({ id: "refund-1", state: cash.STATES.PREPARED, signature: null }, input);
      records.set(input.requestKey, record);
      return record;
    },
    async markSigned(id, signature) {
      const record = Array.from(records.values()).find((entry) => entry.id === id);
      record.state = cash.STATES.SIGNED; record.signature = signature; return record;
    },
    async markRecoveryRequired(id, code) {
      const record = Array.from(records.values()).find((entry) => entry.id === id);
      record.state = cash.STATES.RECOVERY_REQUIRED; record.failureCode = code; return record;
    },
    async complete(id) {
      const record = Array.from(records.values()).find((entry) => entry.id === id);
      assert.strictEqual(record.state, cash.STATES.SIGNED);
      record.state = cash.STATES.COMPLETED; record.completedAt = "2026-08-26T12:05:00.000Z"; completedCount += 1; return record;
    },
  };
}

const request = {
  invoiceId: "5c9242f4-12d0-4409-91a9-92265116f7f0",
  originalCheckoutId: "cash-checkout-1",
  requestKey: "7bf2b660-8a4f-44da-8a01-2cadc1d0e93c",
  confirmed: true,
  receipt: { paymentType: "CASH", currency: "EUR", grossCents: 11900, items: [{ description: "Arbeitszeit", grossCents: 11900, vatRate: "19" }] },
};

async function run() {
  const store = memoryStore();
  let signatures = 0;
  const adapter = cash.mockTseAdapter({ signatureCounter: "45" });
  const original = { id: "cash-checkout-1", invoiceId: request.invoiceId, state: cash.STATES.COMPLETED, receipt: cash.normalizeCashReceipt(request.receipt) };
  const service = cash.createRefundService({ store, lookupCheckout: async (id) => id === original.id ? original : null, tse: { environment: adapter.environment, sign: async (input) => { signatures += 1; return adapter.sign(input); } } });
  const first = await service(request);
  assert.strictEqual(first.state, cash.STATES.COMPLETED);
  assert.strictEqual(first.signature.fiscalType, "REFUND");
  assert.strictEqual(first.signature.signatureCounter, "45");
  assert.strictEqual(first.originalCheckoutId, "cash-checkout-1");
  assert.strictEqual(signatures, 1);
  assert.strictEqual(store.completedCount, 1);
  const repeated = await service(request);
  assert.strictEqual(repeated.id, first.id);
  assert.strictEqual(signatures, 1, "Idempotentno povračilo ne sme še enkrat podpisati TSE dogodka.");
  assert.strictEqual(store.completedCount, 1);

  await assert.rejects(() => service(Object.assign({}, request, { confirmed: false })), (error) => error.code === "CASH_CONFIRMATION_REQUIRED");
  assert.throws(() => cash.createRefundService({ store, lookupCheckout: async () => original, tse: { environment: "production", sign: async () => ({}) } }), /ostaja zaklenjeno/);
  await assert.rejects(() => service(Object.assign({}, request, { originalCheckoutId: "missing-checkout", requestKey: "3fc18b50-2b2a-4b23-8409-b61499a96c93" })), (error) => error.code === "CASH_ORIGINAL_CHECKOUT_INVALID");
  const failedStore = memoryStore();
  const failed = cash.createRefundService({ store: failedStore, lookupCheckout: async () => original, tse: cash.mockTseAdapter({ fail: true }) });
  await assert.rejects(() => failed(Object.assign({}, request, { requestKey: "be046285-153d-43af-975f-562b9ab71570" })), (error) => error.code === "CASH_RECOVERY_REQUIRED");
  assert.strictEqual(failedStore.completedCount, 0, "Nejasen TSE rezultat ne sme zaključiti povračila.");

  const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20260826194158_pos_cash_refund_state.sql"), "utf8");
  assert.match(migration, /create table public\.pos_cash_refunds/i);
  assert.match(migration, /pos_cash_refunds_signature_size_check[\s\S]*qr_code_data,''\)\) <= 8192/i);
  assert.match(migration, /status = 'completed'[\s\S]*signature_algorithm is not null[\s\S]*tse_started_at is not null[\s\S]*tse_finished_at is not null/i);
  assert.match(migration, /unique \(checkout_id\)/i);
  assert.match(migration, /foreign key \(checkout_id, user_id\) references public\.pos_cash_checkouts\(id, user_id\)/i);
  assert.match(migration, /foreign key \(invoice_id, user_id\) references public\.pos_invoices\(id, user_id\)/i);
  assert.match(migration, /foreign key \(payment_id, user_id\) references public\.pos_payments\(id, user_id\)/i);
  assert.match(migration, /create index pos_cash_refunds_payment_user_idx\s+on public\.pos_cash_refunds\(payment_id, user_id\)/i, "Kompozitni payment FK mora imeti pokrivni indeks.");
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for select to authenticated[\s\S]*auth\.uid\(\)[\s\S]*user_id/i);
  assert.match(migration, /v_invoice\.is_test is not true[\s\S]*Produkcijsko gotovinsko povračilo ostaja zaklenjeno/i);
  assert.match(migration, /v_existing[\s\S]*return v_existing[\s\S]*v_payment\.status <> 'succeeded'/i, "Idempotentna ponovitev mora biti preverjena pred že zaključenim statusom plačila.");
  assert.match(migration, /where id = p_checkout_id and user_id = v_user[\s\S]*where id = v_checkout\.invoice_id and user_id = v_user[\s\S]*where id = v_checkout\.payment_id and invoice_id = v_checkout\.invoice_id and user_id = v_user/i, "Priprava mora zakleniti checkout, račun in plačilo istega uporabnika.");
  assert.match(migration, /if v_refund\.status in \('signed','completed'\) then[\s\S]*signature_counter is distinct from p_signature_counter[\s\S]*signature_algorithm is distinct from left\(coalesce\(p_signature_algorithm,''\),120\)[\s\S]*tss_serial_number is distinct from p_tss_serial_number[\s\S]*client_serial_number is distinct from p_client_serial_number[\s\S]*qr_code_data is distinct from p_qr_code_data[\s\S]*tse_started_at is distinct from p_tse_started_at[\s\S]*tse_finished_at is distinct from p_tse_finished_at[\s\S]*drugačno TSE dokazilo/i, "Tudi completed replay mora zavrniti katerokoli spremenjeno TSE dokazilo.");
  assert.match(migration, /if v_refund\.status <> 'prepared' then raise exception 'Povračilo zahteva ročno TSE uskladitev\.'/i, "Recovery refund se ne sme naknadno podpisati brez ročne uskladitve.");
  assert.match(migration, /if v_refund\.status in \('signed','completed'\) then return v_refund; end if;[\s\S]*status = 'recovery_required'/i, "Recovery označitev ne sme znižati signed ali completed stanja.");
  assert.match(migration, /status <> 'signed'[\s\S]*update public\.pos_payments set[\s\S]*status = 'refunded'[\s\S]*update public\.pos_cash_refunds set status = 'completed'/i);
  assert.match(migration, /where id = p_refund_id and user_id = p_user_id[\s\S]*where id = v_refund\.payment_id and invoice_id = v_refund\.invoice_id and user_id = p_user_id/i, "Zaključek mora refund in plačilo omejiti na istega uporabnika in račun.");
  assert.match(migration, /revoke all on table public\.pos_cash_refunds from public, anon, authenticated[\s\S]*grant select on table public\.pos_cash_refunds to authenticated[\s\S]*using \(\(select auth\.uid\(\)\) is not null and \(select auth\.uid\(\)\) = user_id\)/i, "RLS mora dovoliti samo branje lastnih refundov.");
  assert.match(migration, /security definer\s+set search_path = ''/gi);
  assert.match(migration, /revoke all on function private\._pos_record_training_cash_refund_signature[\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/i);
  assert.match(migration, /revoke all on function private\._pos_mark_training_cash_refund_recovery_required[\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/i);
  assert.match(migration, /revoke all on function private\._pos_complete_training_cash_refund[\s\S]*authenticated/i);
  console.log("POS fail-closed gotovinsko povračilo in lasten mock TSE podpis: OK");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
