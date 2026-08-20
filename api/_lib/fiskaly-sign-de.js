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

const VAT_RATES = {
  "19": { fiskaly: "NORMAL", percent: 19 },
  "7": { fiskaly: "REDUCED_1", percent: 7 },
  "0": { fiskaly: "NULL", percent: 0 },
};

function failReceipt(message) {
  const error = new Error(message || "Neveljaven testni Kassenbon.");
  error.code = "FISKALY_RECEIPT_INVALID";
  throw error;
}

function cents(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : NaN;
}

function money(centsValue) {
  return (centsValue / 100).toFixed(2);
}

function normalizeTrainingReceipt(input) {
  const source = input && typeof input === "object" ? input : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  if (!rawItems.length || rawItems.length > 12) failReceipt("Testni Kassenbon mora imeti od 1 do 12 postavk.");
  const items = rawItems.map((raw, index) => {
    const item = raw && typeof raw === "object" ? raw : {};
    const description = clean(item.description).slice(0, 160);
    const quantityMilli = cents(item.quantityMilli);
    const unitGrossCents = cents(item.unitGrossCents);
    const vatRate = clean(item.vatRate);
    if (!description) failReceipt("Postavka " + (index + 1) + " nima opisa.");
    if (!Number.isSafeInteger(quantityMilli) || quantityMilli < 1 || quantityMilli > 100000000) failReceipt("Postavka " + (index + 1) + " nima veljavne količine.");
    if (!Number.isSafeInteger(unitGrossCents) || unitGrossCents < 0 || unitGrossCents > 100000000) failReceipt("Postavka " + (index + 1) + " nima veljavne cene.");
    if (!Number.isSafeInteger(unitGrossCents * quantityMilli)) failReceipt("Postavka " + (index + 1) + " presega varen obračunski obseg.");
    if (!VAT_RATES[vatRate]) failReceipt("Postavka " + (index + 1) + " nima podprte davčne stopnje.");
    const grossCents = Math.round(unitGrossCents * quantityMilli / 1000);
    const netCents = VAT_RATES[vatRate].percent
      ? Math.round(grossCents * 100 / (100 + VAT_RATES[vatRate].percent))
      : grossCents;
    return {
      description,
      quantityMilli,
      unitGrossCents,
      vatRate,
      grossCents,
      netCents,
      taxCents: grossCents - netCents,
    };
  });
  const paymentType = clean(source.paymentType || "NON_CASH").toUpperCase();
  if (!["CASH", "NON_CASH"].includes(paymentType)) failReceipt("Način testnega plačila ni podprt.");
  const totalsByVat = ["19", "7", "0"].map((vatRate) => {
    const matching = items.filter((item) => item.vatRate === vatRate);
    return {
      vatRate,
      fiskalyVatRate: VAT_RATES[vatRate].fiskaly,
      grossCents: matching.reduce((sum, item) => sum + item.grossCents, 0),
      netCents: matching.reduce((sum, item) => sum + item.netCents, 0),
      taxCents: matching.reduce((sum, item) => sum + item.taxCents, 0),
    };
  }).filter((row) => row.grossCents !== 0);
  const grossCents = items.reduce((sum, item) => sum + item.grossCents, 0);
  const netCents = items.reduce((sum, item) => sum + item.netCents, 0);
  if (grossCents <= 0 || grossCents > 999999999) failReceipt("Skupni znesek testnega Kassenbona ni veljaven.");
  return {
    items,
    paymentType,
    totalsByVat,
    grossCents,
    netCents,
    taxCents: grossCents - netCents,
    currency: "EUR",
  };
}

function trainingReceipt(receiptInput) {
  const receipt = receiptInput && Array.isArray(receiptInput.items)
    ? receiptInput
    : normalizeTrainingReceipt({
      paymentType: "NON_CASH",
      items: [{ description: "SIGN DE readiness", quantityMilli: 1000, unitGrossCents: 100, vatRate: "19" }],
    });
  return {
    standard_v1: {
      receipt: {
        receipt_type: "TRAINING",
        amounts_per_vat_rate: receipt.totalsByVat.map((row) => ({
          vat_rate: row.fiskalyVatRate,
          amount: money(row.grossCents),
        })),
        amounts_per_payment_type: [{
          payment_type: receipt.paymentType,
          amount: money(receipt.grossCents),
          currency_code: "EUR",
        }],
      },
    },
  };
}

function publicTransaction(body, receiptInput) {
  const transaction = body || {};
  const signature = transaction.signature || {};
  const receipt = receiptInput && Array.isArray(receiptInput.items)
    ? receiptInput
    : normalizeTrainingReceipt({
      paymentType: "NON_CASH",
      items: [{ description: "SIGN DE readiness", quantityMilli: 1000, unitGrossCents: 100, vatRate: "19" }],
    });
  return {
    transactionId: clean(transaction._id),
    transactionNumber: clean(transaction.number) || null,
    state: clean(transaction.state).toUpperCase(),
    revision: clean(transaction.revision) || null,
    signatureCounter: clean(signature.counter) || null,
    signatureAlgorithm: clean(signature.algorithm),
    startedAt: clean(transaction.time_start),
    finishedAt: clean(transaction.time_end),
    tssSerialNumber: clean(transaction.tss_serial_number),
    clientSerialNumber: clean(transaction.client_serial_number),
    qrCodeData: clean(transaction.qr_code_data),
    training: true,
    paymentType: receipt.paymentType,
    amount: money(receipt.grossCents),
    currency: "EUR",
    receipt,
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

async function runTrainingReceipt(source, requestedId, receiptInput) {
  const cfg = configuration(source);
  const transactionId = uuidV4(requestedId);
  if (!transactionId) {
    const error = new Error("Neveljaven identifikator testne transakcije.");
    error.code = "FISKALY_TX_ID_INVALID";
    throw error;
  }
  const receipt = normalizeTrainingReceipt(receiptInput);
  const token = await authenticate(cfg);
  await retrieveResources(cfg, token);
  await upsertTransaction(cfg, token, transactionId, 1, {
    state: "ACTIVE",
    client_id: cfg.clientId,
    metadata: { source: "werktech_pos", purpose: "sandbox_kassenbon", receipt_type: "training" },
  });
  const finished = await upsertTransaction(cfg, token, transactionId, 2, {
    state: "FINISHED",
    client_id: cfg.clientId,
    schema: trainingReceipt(receipt),
  });
  const result = publicTransaction(finished, receipt);
  if (result.state !== "FINISHED" || !result.transactionId || result.transactionId !== transactionId || result.signatureCounter === null || !result.tssSerialNumber || !result.clientSerialNumber || !result.qrCodeData) {
    const error = new Error("fiskaly ni vrnil popolnega testnega podpisa.");
    error.code = "FISKALY_TX_INCOMPLETE";
    throw error;
  }
  return result;
}

async function runTrainingTransaction(source, requestedId) {
  return runTrainingReceipt(source, requestedId, {
    paymentType: "NON_CASH",
    items: [{ description: "SIGN DE readiness", quantityMilli: 1000, unitGrossCents: 100, vatRate: "19" }],
  });
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
  runTrainingReceipt,
  listCount,
  _test: { requestJson, uuidV4, normalizeTrainingReceipt, trainingReceipt, publicTransaction, transactionHeaders },
};
