"use strict";

const supabase = require("../_lib/supabase-server");
const fiskaly = require("../_lib/fiskaly-sign-de");
const cash = require("../_lib/pos-cash-checkout");
const requestJson = require("../_lib/pos-request-json");
const MAX_BODY_BYTES = 64 * 1024;

function rpcRow(value) { return Array.isArray(value) ? value[0] || null : value || null; }

function receiptToDatabase(receipt) {
  return {
    schema_version: Number(receipt.schemaVersion || 1),
    payment_type: receipt.paymentType,
    currency: receipt.currency,
    gross_cents: Number(receipt.grossCents),
    items: (receipt.items || []).map(function (item) {
      return { description: item.description, gross_cents: Number(item.grossCents), vat_rate: String(item.vatRate) };
    }),
  };
}

function receiptFromDatabase(receipt) {
  const value = receipt && typeof receipt === "object" ? receipt : {};
  return {
    schemaVersion: Number(value.schema_version || 1),
    paymentType: String(value.payment_type || "CASH"),
    currency: String(value.currency || "EUR"),
    grossCents: Number(value.gross_cents),
    items: (Array.isArray(value.items) ? value.items : []).map(function (item) {
      return { description: item.description, grossCents: Number(item.gross_cents), vatRate: String(item.vat_rate) };
    }),
  };
}

function signatureFromRow(row, fiscalType) {
  if (!row || !row.signature_counter) return null;
  return {
    transactionId: row.transaction_id,
    fiscalType,
    signatureCounter: row.signature_counter,
    signatureAlgorithm: row.signature_algorithm,
    tssSerialNumber: row.tss_serial_number,
    clientSerialNumber: row.client_serial_number,
    qrCodeData: row.qr_code_data,
    startedAt: row.tse_started_at,
    finishedAt: row.tse_finished_at,
  };
}

function checkoutFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, state: row.status, requestKey: row.request_key,
    invoiceId: row.invoice_id, transactionId: row.transaction_id,
    receipt: receiptFromDatabase(row.receipt_snapshot),
    signature: signatureFromRow(row, "SALE"), paymentId: row.payment_id || null,
    failureCode: row.failure_code || "", completedAt: row.completed_at || null,
    providerObservedState: row.provider_observed_state || "",
    providerObservedAt: row.provider_observed_at || null,
    cancelledAt: row.cancelled_at || null,
  };
}

function refundFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, state: row.status, requestKey: row.request_key,
    invoiceId: row.invoice_id, originalCheckoutId: row.checkout_id,
    transactionId: row.transaction_id, receipt: receiptFromDatabase(row.receipt_snapshot),
    signature: signatureFromRow(row, "REFUND"), failureCode: row.failure_code || "",
    completedAt: row.completed_at || null,
    providerObservedState: row.provider_observed_state || "",
    providerObservedAt: row.provider_observed_at || null,
    cancelledAt: row.cancelled_at || null,
  };
}

function signaturePayload(userId, idName, id, signature) {
  return {
    p_user_id: userId, [idName]: id,
    p_signature_counter: signature.signatureCounter,
    p_signature_algorithm: signature.signatureAlgorithm,
    p_tss_serial_number: signature.tssSerialNumber,
    p_client_serial_number: signature.clientSerialNumber,
    p_qr_code_data: signature.qrCodeData,
    p_tse_started_at: signature.startedAt,
    p_tse_finished_at: signature.finishedAt,
  };
}

function reconcilePayload(userId, idName, id, observation) {
  const signature = observation && observation.signature || {};
  return {
    p_user_id: userId,
    [idName]: id,
    p_provider_state: String(observation && observation.providerState || ""),
    p_signature_counter: signature.signatureCounter || null,
    p_signature_algorithm: signature.signatureAlgorithm || null,
    p_tss_serial_number: signature.tssSerialNumber || null,
    p_client_serial_number: signature.clientSerialNumber || null,
    p_qr_code_data: signature.qrCodeData || null,
    p_tse_started_at: signature.startedAt || null,
    p_tse_finished_at: signature.finishedAt || null,
    p_observed_at: observation && observation.observedAt || new Date().toISOString(),
  };
}

function cashReceiptForFiskaly(receipt) {
  return {
    paymentType: "CASH",
    items: (receipt.items || []).map(function (item) {
      return {
        description: item.description,
        quantityMilli: 1000,
        unitGrossCents: Number(item.grossCents),
        vatRate: String(item.vatRate),
      };
    }),
  };
}

const localCashTse = cash.mockTseAdapter();

function fiskalyRecoveryAdapter() {
  return {
    environment: "training",
    async lookup(input) {
      const result = await fiskaly.retrieveTrainingReceipt(
        process.env,
        input.transactionId,
        cashReceiptForFiskaly(input.receipt),
        input.fiscalType
      );
      return result;
    },
  };
}

function createCashStore(authCfg, serviceCfg, auth) {
  return {
    async prepare(input) {
      return checkoutFromRow(rpcRow(await supabase.pokliciRpcKotUporabnik(authCfg, auth.token, "pos_prepare_training_cash_checkout", {
        p_invoice_id: input.invoiceId, p_request_key: input.requestKey,
        p_transaction_id: input.transactionId, p_receipt: receiptToDatabase(input.receipt), p_confirmed: true,
      })));
    },
    async markSigned(id, signature) {
      return checkoutFromRow(rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_record_training_cash_signature_service",
        signaturePayload(auth.user.id, "p_checkout_id", id, signature))));
    },
    async markRecoveryRequired(id, code) {
      return checkoutFromRow(rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_mark_training_cash_recovery_service", {
        p_user_id: auth.user.id, p_checkout_id: id, p_failure_code: code,
      })));
    },
    async complete(id) {
      return checkoutFromRow(rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_complete_training_cash_checkout_service", {
        p_user_id: auth.user.id, p_checkout_id: id,
      })));
    },
    async reconcile(id, observation) {
      return checkoutFromRow(rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_reconcile_training_cash_checkout_service",
        reconcilePayload(auth.user.id, "p_checkout_id", id, observation))));
    },
  };
}

async function checkoutById(serviceCfg, userId, id) {
  const rows = await supabase.pridobiVrstice(serviceCfg, "pos_cash_checkouts",
    "id=eq." + encodeURIComponent(id) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*&limit=1");
  return checkoutFromRow(rows[0] || null);
}

async function checkoutByRequest(serviceCfg, userId, requestKey) {
  const rows = await supabase.pridobiVrstice(serviceCfg, "pos_cash_checkouts",
    "request_key=eq." + encodeURIComponent(requestKey) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*&limit=1");
  return checkoutFromRow(rows[0] || null);
}

async function refundByRequest(serviceCfg, userId, requestKey) {
  const rows = await supabase.pridobiVrstice(serviceCfg, "pos_cash_refunds",
    "request_key=eq." + encodeURIComponent(requestKey) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*&limit=1");
  return refundFromRow(rows[0] || null);
}

function createCashRefundStore(authCfg, serviceCfg, auth) {
  return {
    async prepare(input) {
      return refundFromRow(rpcRow(await supabase.pokliciRpcKotUporabnik(authCfg, auth.token, "pos_prepare_training_cash_refund", {
        p_checkout_id: input.originalCheckoutId, p_request_key: input.requestKey,
        p_transaction_id: input.transactionId, p_receipt: receiptToDatabase(input.receipt), p_confirmed: true,
      })));
    },
    async markSigned(id, signature) {
      return refundFromRow(rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_record_training_cash_refund_signature_service",
        signaturePayload(auth.user.id, "p_refund_id", id, signature))));
    },
    async markRecoveryRequired(id, code) {
      return refundFromRow(rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_mark_training_cash_refund_recovery_service", {
        p_user_id: auth.user.id, p_refund_id: id, p_failure_code: code,
      })));
    },
    async complete(id) {
      return refundFromRow(rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_complete_training_cash_refund_service", {
        p_user_id: auth.user.id, p_refund_id: id,
      })));
    },
    async reconcile(id, observation) {
      return refundFromRow(rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_reconcile_training_cash_refund_service",
        reconcilePayload(auth.user.id, "p_refund_id", id, observation))));
    },
  };
}

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
  }

  let authCfg;
  try { authCfg = supabase.uporabniskaKonfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  const auth = await supabase.preveriUporabnika(req, authCfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  const action = String(body.action || "");

  const cashActions = [
    "local-training-cash-checkout",
    "local-training-cash-refund",
    "local-training-cash-reconcile",
    "local-training-cash-refund-reconcile",
    "training-cash-reconcile",
    "training-cash-refund-reconcile",
  ];
  if (req.method === "POST" && cashActions.includes(action)) {
    const localMock = action.startsWith("local-");
    const reconcileOnly = action.includes("reconcile");
    if (localMock && String(process.env.POS_LOCAL_MOCKS_ENABLED || "").toLowerCase() !== "true") {
      return json(res, 404, { ok: false, code: "LOCAL_MOCK_DISABLED", napaka: "Lokalni TSE mock ni omogočen." });
    }
    let serviceCfg;
    try { serviceCfg = supabase.konfiguracija(); }
    catch (error) { return json(res, 503, { ok: false, code: error.code, napaka: error.message }); }

    const tse = localMock ? localCashTse : fiskalyRecoveryAdapter();
    const checkoutAction = [
      "local-training-cash-checkout",
      "local-training-cash-reconcile",
      "training-cash-reconcile",
    ].includes(action);
    if (checkoutAction) {
      try {
        const checkout = await cash.createService({
          store: createCashStore(authCfg, serviceCfg, auth), tse,
        })({
          invoiceId: body.invoiceId, requestKey: body.requestKey,
          transactionId: body.transactionId, confirmed: body.confirmed === true,
          receipt: body.receipt, reconcileOnly,
        });
        return json(res, reconcileOnly ? 200 : 201, { ok: true, sandbox: true, localMock, live: false, cashModuleEnabled: false, checkout });
      } catch (error) {
        const clientError = error && ["CASH_CONFIRMATION_REQUIRED", "CASH_REQUEST_INVALID", "CASH_PAYMENT_REQUIRED", "CASH_AMOUNT_INVALID", "CASH_ITEMS_INVALID", "CASH_ITEM_INVALID", "CASH_TOTAL_MISMATCH"].includes(error.code);
        let recovery = error && error.record;
        try { recovery = recovery || await checkoutByRequest(serviceCfg, auth.user.id, String(body.requestKey || "")); } catch (_) {}
        return json(res, clientError ? 400 : 409, {
          ok: false, code: error && error.code || "CASH_CHECKOUT_FAILED",
          napaka: error && error.message || "Gotovinskega checkouta ni bilo mogoče zaključiti.",
          checkout: recovery && [cash.STATES.PREPARED, cash.STATES.RECOVERY_REQUIRED, cash.STATES.CANCELLED].includes(recovery.state) ? recovery : undefined,
        });
      }
    }

    try {
      const refund = await cash.createRefundService({
        store: createCashRefundStore(authCfg, serviceCfg, auth),
        tse,
        lookupCheckout: (id) => checkoutById(serviceCfg, auth.user.id, id),
      })({
        invoiceId: body.invoiceId, originalCheckoutId: body.originalCheckoutId,
        requestKey: body.requestKey, transactionId: body.transactionId,
        confirmed: body.confirmed === true, receipt: body.receipt, reconcileOnly,
      });
      return json(res, reconcileOnly ? 200 : 201, { ok: true, sandbox: true, localMock, live: false, cashModuleEnabled: false, refund });
    } catch (error) {
      const clientError = error && ["CASH_CONFIRMATION_REQUIRED", "CASH_REQUEST_INVALID", "CASH_ORIGINAL_CHECKOUT_INVALID", "CASH_PAYMENT_REQUIRED", "CASH_AMOUNT_INVALID", "CASH_ITEMS_INVALID", "CASH_ITEM_INVALID", "CASH_TOTAL_MISMATCH"].includes(error.code);
      let recovery = error && error.record;
      try { recovery = recovery || await refundByRequest(serviceCfg, auth.user.id, String(body.requestKey || "")); } catch (_) {}
      return json(res, clientError ? 400 : 409, {
        ok: false, code: error && error.code || "CASH_REFUND_FAILED",
        napaka: error && error.message || "Gotovinskega povračila ni bilo mogoče zaključiti.",
        refund: recovery && [cash.STATES.PREPARED, cash.STATES.RECOVERY_REQUIRED, cash.STATES.CANCELLED].includes(recovery.state) ? recovery : undefined,
      });
    }
  }

  try {
    if (req.method === "POST") {
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
module.exports._test = {
  unavailable, MAX_BODY_BYTES, checkoutFromRow, createCashRefundStore, createCashStore,
  cashReceiptForFiskaly, receiptFromDatabase, receiptToDatabase, reconcilePayload, refundFromRow,
};
