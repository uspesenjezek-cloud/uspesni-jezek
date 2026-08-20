"use strict";

const crypto = require("node:crypto");

const TEST_BASE_URL = "https://kassensichv-middleware.fiskaly.com/api/v2";
const LIVE_BASE_URL = "https://kassensichv.fiskaly.com/api/v2";

function clean(value) {
  return String(value || "").trim();
}

function configuration(source) {
  const env = source || process.env;
  const mode = clean(env.FISKALY_SIGN_DE_MODE || "test").toLowerCase();
  if (mode !== "test") {
    const error = new Error("Produkcijski fiskaly SIGN DE še ni omogočen.");
    error.code = "FISKALY_LIVE_LOCKED";
    throw error;
  }
  const apiKey = clean(env.FISKALY_API_KEY_TEST);
  const apiSecret = clean(env.FISKALY_API_SECRET_TEST);
  if (!apiKey || !apiSecret) {
    const error = new Error("Testna fiskaly povezava še ni nastavljena.");
    error.code = "FISKALY_NOT_CONFIGURED";
    throw error;
  }
  return {
    mode: "test",
    baseUrl: TEST_BASE_URL,
    apiKey,
    apiSecret,
    tssId: clean(env.FISKALY_TSS_ID_TEST),
    clientId: clean(env.FISKALY_CLIENT_ID_TEST),
  };
}

async function requestJson(url, options, timeoutMs) {
  const request = Object.assign({}, options || {});
  if (!request.signal && typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    request.signal = AbortSignal.timeout(Math.min(Math.max(Number(timeoutMs) || 12000, 1000), 20000));
  }
  let response;
  try {
    response = await fetch(url, request);
  } catch (cause) {
    const error = new Error("fiskaly SIGN DE trenutno ni dosegljiv.");
    error.code = "FISKALY_REQUEST_FAILED";
    error.status = 0;
    error.retryable = true;
    error.cause = cause;
    throw error;
  }
  let body = null;
  try { body = await response.json(); } catch (_) {}
  if (!response.ok) {
    const error = new Error("fiskaly SIGN DE trenutno ni dosegljiv.");
    error.code = "FISKALY_REQUEST_FAILED";
    error.status = response.status;
    error.retryable = response.status === 499 || response.status === 429 || response.status >= 500;
    throw error;
  }
  return body || {};
}

function uuidV4(value) {
  const text = clean(value).toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(text) ? text : "";
}

function transactionHeaders(token) {
  return {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
    Accept: "application/json",
    "request-id": crypto.randomUUID(),
  };
}

function trainingReceipt() {
  return {
    standard_v1: {
      receipt: {
        receipt_type: "TRAINING",
        amounts_per_vat_rate: [{ vat_rate: "NORMAL", amount: "1.00" }],
        amounts_per_payment_type: [{ payment_type: "NON_CASH", amount: "1.00", currency_code: "EUR" }],
      },
    },
  };
}

function publicTransaction(body) {
  const transaction = body || {};
  const signature = transaction.signature || {};
  return {
    transactionId: clean(transaction._id),
    transactionNumber: clean(transaction.number) || null,
    state: clean(transaction.state).toUpperCase(),
    revision: clean(transaction.revision) || null,
    signatureCounter: clean(signature.counter) || null,
    signatureAlgorithm: clean(signature.algorithm),
    startedAt: clean(transaction.time_start),
    finishedAt: clean(transaction.time_end),
    training: true,
    paymentType: "NON_CASH",
    amount: "1.00",
    currency: "EUR",
  };
}

async function retrieveResources(cfg, token) {
  if (!cfg.tssId || !cfg.clientId) {
    const error = new Error("Testna TSS in odjemalec še nista nastavljena.");
    error.code = "FISKALY_RESOURCES_NOT_CONFIGURED";
    throw error;
  }
  const headers = { Authorization: "Bearer " + token, Accept: "application/json" };
  const tss = await requestJson(cfg.baseUrl + "/tss/" + encodeURIComponent(cfg.tssId), { method: "GET", headers }, 12000);
  const client = await requestJson(cfg.baseUrl + "/tss/" + encodeURIComponent(cfg.tssId) + "/client/" + encodeURIComponent(cfg.clientId), { method: "GET", headers }, 12000);
  if (clean(tss.state).toUpperCase() !== "INITIALIZED" || clean(client.state).toUpperCase() !== "REGISTERED") {
    const error = new Error("Testna TSS ali odjemalec še nista pripravljena.");
    error.code = "FISKALY_RESOURCES_NOT_READY";
    throw error;
  }
  return { tss, client };
}

async function upsertTransaction(cfg, token, transactionId, revision, payload) {
  const url = cfg.baseUrl + "/tss/" + encodeURIComponent(cfg.tssId) + "/tx/" + encodeURIComponent(transactionId) + "?tx_revision=" + revision;
  const body = JSON.stringify(payload);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await requestJson(url, { method: "PUT", headers: transactionHeaders(token), body }, 20000);
    } catch (error) {
      lastError = error;
      if (!error || !error.retryable || attempt > 0) throw error;
    }
  }
  throw lastError;
}

async function runTrainingTransaction(source, requestedId) {
  const cfg = configuration(source);
  const transactionId = uuidV4(requestedId);
  if (!transactionId) {
    const error = new Error("Neveljaven identifikator testne transakcije.");
    error.code = "FISKALY_TX_ID_INVALID";
    throw error;
  }
  const token = await authenticate(cfg);
  await retrieveResources(cfg, token);
  await upsertTransaction(cfg, token, transactionId, 1, {
    state: "ACTIVE",
    client_id: cfg.clientId,
    metadata: { source: "werktech_pos", purpose: "sandbox_readiness" },
  });
  const finished = await upsertTransaction(cfg, token, transactionId, 2, {
    state: "FINISHED",
    client_id: cfg.clientId,
    schema: trainingReceipt(),
  });
  const result = publicTransaction(finished);
  if (result.state !== "FINISHED" || !result.transactionId || result.transactionId !== transactionId || result.signatureCounter === null) {
    const error = new Error("fiskaly ni vrnil popolnega testnega podpisa.");
    error.code = "FISKALY_TX_INCOMPLETE";
    throw error;
  }
  return result;
}

async function authenticate(cfg) {
  const body = await requestJson(cfg.baseUrl + "/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ api_key: cfg.apiKey, api_secret: cfg.apiSecret }),
  }, 12000);
  const token = clean(body.access_token);
  if (!token) {
    const error = new Error("fiskaly ni vrnil veljavne testne seje.");
    error.code = "FISKALY_AUTH_INVALID";
    throw error;
  }
  return token;
}

function listCount(body) {
  if (Array.isArray(body)) return body.length;
  if (body && Array.isArray(body.data)) return body.data.length;
  if (body && Array.isArray(body.results)) return body.results.length;
  if (body && Number.isFinite(Number(body.count))) return Number(body.count);
  return 0;
}

async function connectionStatus(source) {
  const cfg = configuration(source);
  const token = await authenticate(cfg);
  const headers = { Authorization: "Bearer " + token, Accept: "application/json" };
  const tssList = await requestJson(cfg.baseUrl + "/tss", {
    method: "GET",
    headers,
  }, 12000);
  let tssState = "";
  let clientState = "";
  if (cfg.tssId) {
    const tss = await requestJson(cfg.baseUrl + "/tss/" + encodeURIComponent(cfg.tssId), { method: "GET", headers }, 12000);
    tssState = clean(tss.state).toUpperCase();
    if (cfg.clientId) {
      const client = await requestJson(cfg.baseUrl + "/tss/" + encodeURIComponent(cfg.tssId) + "/client/" + encodeURIComponent(cfg.clientId), { method: "GET", headers }, 12000);
      clientState = clean(client.state).toUpperCase();
    }
  }
  return {
    configured: true,
    connected: true,
    environment: cfg.mode,
    country: "DE",
    tssCount: listCount(tssList),
    tssState,
    clientState,
    integrationReady: tssState === "INITIALIZED" && clientState === "REGISTERED",
    cashModuleEnabled: false,
  };
}

module.exports = {
  TEST_BASE_URL,
  LIVE_BASE_URL,
  configuration,
  authenticate,
  connectionStatus,
  runTrainingTransaction,
  listCount,
  _test: { requestJson, uuidV4, trainingReceipt, publicTransaction, transactionHeaders },
};
