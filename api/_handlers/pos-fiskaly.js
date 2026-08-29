"use strict";

const crypto = require("node:crypto");
const supabase = require("../_lib/supabase-server");
const fiskaly = require("../_lib/fiskaly-sign-de");
const cash = require("../_lib/pos-cash-checkout");
const requestJson = require("../_lib/pos-request-json");
const MAX_BODY_BYTES = 64 * 1024;
const localCashRecords = new Map();
const localCashRefundRecords = new Map();

const localCashStore = {
  async prepare(input) {
    if (localCashRecords.has(input.requestKey)) return localCashRecords.get(input.requestKey);
    if (localCashRecords.size >= 500) localCashRecords.delete(localCashRecords.keys().next().value);
    const record = Object.assign({ id: crypto.randomUUID(), state: cash.STATES.PREPARED, signature: null, paymentId: null }, input);
    localCashRecords.set(input.requestKey, record);
    return record;
  },
  async markSigned(id, signature) {
    const record = Array.from(localCashRecords.values()).find((entry) => entry.id === id);
    if (!record) throw Object.assign(new Error("Lokalni checkout ne obstaja."), { code: "CASH_STATE_INVALID" });
    record.state = cash.STATES.SIGNED; record.signature = signature; return record;
  },
  async markRecoveryRequired(id, code) {
    const record = Array.from(localCashRecords.values()).find((entry) => entry.id === id);
    if (record) { record.state = cash.STATES.RECOVERY_REQUIRED; record.failureCode = code; }
    return record;
  },
  async complete(id) {
    const record = Array.from(localCashRecords.values()).find((entry) => entry.id === id);
    if (!record || record.state !== cash.STATES.SIGNED || !record.signature) throw Object.assign(new Error("Lokalni checkout ni podpisan."), { code: "CASH_STATE_INVALID" });
    record.state = cash.STATES.COMPLETED; record.paymentId = record.paymentId || crypto.randomUUID(); record.completedAt = new Date().toISOString(); return record;
  },
};

const localCashRefundStore = {
  async prepare(input) {
    if (localCashRefundRecords.has(input.requestKey)) return localCashRefundRecords.get(input.requestKey);
    const existing = Array.from(localCashRefundRecords.values()).find((entry) => entry.originalCheckoutId === input.originalCheckoutId);
    if (existing) return existing;
    if (localCashRefundRecords.size >= 500) localCashRefundRecords.delete(localCashRefundRecords.keys().next().value);
    const record = Object.assign({ id: crypto.randomUUID(), state: cash.STATES.PREPARED, signature: null }, input);
    localCashRefundRecords.set(input.requestKey, record);
    return record;
  },
  async markSigned(id, signature) {
    const record = Array.from(localCashRefundRecords.values()).find((entry) => entry.id === id);
    if (!record) throw Object.assign(new Error("Lokalno povračilo ne obstaja."), { code: "CASH_STATE_INVALID" });
    record.state = cash.STATES.SIGNED; record.signature = signature; return record;
  },
  async markRecoveryRequired(id, code) {
    const record = Array.from(localCashRefundRecords.values()).find((entry) => entry.id === id);
    if (record) { record.state = cash.STATES.RECOVERY_REQUIRED; record.failureCode = code; }
    return record;
  },
  async complete(id) {
    const record = Array.from(localCashRefundRecords.values()).find((entry) => entry.id === id);
    if (!record || record.state !== cash.STATES.SIGNED || !record.signature) throw Object.assign(new Error("Lokalno povračilo ni podpisano."), { code: "CASH_STATE_INVALID" });
    record.state = cash.STATES.COMPLETED; record.completedAt = record.completedAt || new Date().toISOString(); return record;
  },
};

function json(res, status, body) {
  res.status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0")
    .end(JSON.stringify(body));
}

function unavailable(error) {
  return {
    configured: Boolean(error && error.code !== "FISKALY_NOT_CONFIGURED"),
    connected: false,
    environment: "test",
    country: "DE",
    tssCount: 0,
    tssState: "",
    clientState: "",
    integrationReady: false,
    cashModuleEnabled: false,
  };
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Dovoljena sta samo GET in POST." });
  let body = {};
  if (req.method === "POST") {
    try { body = requestJson(req, MAX_BODY_BYTES); }
    catch (error) { return json(res, error.status || 400, { ok: false, code: error.code, napaka: error.message }); }
    if (String(body.action || "") === "local-training-cash-checkout") {
      if (String(process.env.POS_LOCAL_MOCKS_ENABLED || "").toLowerCase() !== "true") {
        return json(res, 404, { ok: false, code: "LOCAL_MOCK_DISABLED", napaka: "Lokalni TSE mock ni omogočen." });
      }
      try {
        const checkout = await cash.createService({ store: localCashStore, tse: cash.mockTseAdapter() })({
          invoiceId: body.invoiceId,
          requestKey: body.requestKey,
          transactionId: body.transactionId,
          confirmed: body.confirmed === true,
          receipt: body.receipt,
        });
        return json(res, 201, { ok: true, sandbox: true, localMock: true, live: false, cashModuleEnabled: false, checkout });
      } catch (error) {
        const clientError = error && ["CASH_CONFIRMATION_REQUIRED", "CASH_REQUEST_INVALID", "CASH_PAYMENT_REQUIRED", "CASH_AMOUNT_INVALID", "CASH_ITEMS_INVALID", "CASH_ITEM_INVALID", "CASH_TOTAL_MISMATCH"].includes(error.code);
        return json(res, clientError ? 400 : 409, { ok: false, code: error && error.code || "CASH_CHECKOUT_FAILED", napaka: error && error.message || "Lokalnega gotovinskega checkouta ni bilo mogoče zaključiti." });
      }
    }
    if (String(body.action || "") === "local-training-cash-refund") {
      if (String(process.env.POS_LOCAL_MOCKS_ENABLED || "").toLowerCase() !== "true") {
        return json(res, 404, { ok: false, code: "LOCAL_MOCK_DISABLED", napaka: "Lokalni TSE mock ni omogočen." });
      }
      try {
        const refund = await cash.createRefundService({
          store: localCashRefundStore,
          tse: cash.mockTseAdapter(),
          lookupCheckout: async (id) => Array.from(localCashRecords.values()).find((entry) => entry.id === id) || null,
        })({
          invoiceId: body.invoiceId,
          originalCheckoutId: body.originalCheckoutId,
          requestKey: body.requestKey,
          transactionId: body.transactionId,
          confirmed: body.confirmed === true,
          receipt: body.receipt,
        });
        return json(res, 201, { ok: true, sandbox: true, localMock: true, live: false, cashModuleEnabled: false, refund });
      } catch (error) {
        const clientError = error && ["CASH_CONFIRMATION_REQUIRED", "CASH_REQUEST_INVALID", "CASH_ORIGINAL_CHECKOUT_INVALID", "CASH_PAYMENT_REQUIRED", "CASH_AMOUNT_INVALID", "CASH_ITEMS_INVALID", "CASH_ITEM_INVALID", "CASH_TOTAL_MISMATCH"].includes(error.code);
        const recovery = localCashRefundRecords.get(String(body.requestKey || ""));
        return json(res, clientError ? 400 : 409, {
          ok: false,
          code: error && error.code || "CASH_REFUND_FAILED",
          napaka: error && error.message || "Lokalnega gotovinskega povračila ni bilo mogoče zaključiti.",
          refund: recovery && recovery.state === cash.STATES.RECOVERY_REQUIRED ? recovery : undefined,
        });
      }
    }
  }
  let cfg;
  try { cfg = supabase.uporabniskaKonfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  try {
    if (req.method === "POST") {
      const action = String(body.action || "");
      if (!["training-transaction", "training-receipt"].includes(action)) return json(res, 400, { ok: false, napaka: "Neznano fiskaly opravilo." });
      const transaction = action === "training-receipt"
        ? await fiskaly.runTrainingReceipt(process.env, body.transactionId, body.receipt)
        : await fiskaly.runTrainingTransaction(process.env, body.transactionId);
      return json(res, 201, { ok: true, sandbox: true, live: false, cashModuleEnabled: false, transaction });
    }
    return json(res, 200, { ok: true, fiskaly: await fiskaly.connectionStatus() });
  } catch (error) {
    const status = unavailable(error);
    if (error && error.code === "FISKALY_NOT_CONFIGURED" && req.method === "GET") return json(res, 200, { ok: true, fiskaly: status });
    if (error && error.code === "FISKALY_TX_ID_INVALID") return json(res, 400, { ok: false, code: error.code, napaka: "Neveljaven identifikator testnega podpisa." });
    if (error && error.code === "FISKALY_RECEIPT_INVALID") return json(res, 400, { ok: false, code: error.code, napaka: error.message });
    if (error && ["FISKALY_NOT_CONFIGURED", "FISKALY_RESOURCES_NOT_CONFIGURED", "FISKALY_RESOURCES_NOT_READY"].includes(error.code)) {
      return json(res, 409, { ok: false, code: error.code, napaka: "fiskaly TEST okolje še ni pripravljeno za podpis." });
    }
    console.error("[pos-fiskaly]", String(error && (error.code || error.name) || "UNKNOWN"));
    return json(res, error && error.retryable ? 503 : 502, {
      ok: false,
      code: error && error.code || "FISKALY_UNAVAILABLE",
      napaka: req.method === "POST"
        ? "Varnega fiskaly SIGN DE preizkusa ni bilo mogoče zaključiti."
        : "Testne povezave s fiskaly SIGN DE ni bilo mogoče preveriti.",
      fiskaly: status,
    });
  }
}

module.exports = handler;
module.exports._test = { unavailable, MAX_BODY_BYTES, localCashStore, localCashRecords, localCashRefundStore, localCashRefundRecords };
