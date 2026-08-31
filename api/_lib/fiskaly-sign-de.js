"use strict";

const crypto = require("node:crypto");
const providerJson = require("./provider-json");

const TEST_BASE_URL = "https://kassensichv-middleware.fiskaly.com/api/v2";
const LIVE_BASE_URL = "https://kassensichv.fiskaly.com/api/v2";
const MAX_RESPONSE_BYTES = 1024 * 1024;

function clean(value) {
  return String(value || "").trim();
}

function enabled(value) {
  return /^(1|true)$/i.test(clean(value));
}

function configuration(source) {
  const env = source || process.env;
  const mode = clean(env.FISKALY_SIGN_DE_MODE || "test").toLowerCase();
  if (mode !== "test" && mode !== "production") {
    const error = new Error("Produkcijski fiskaly SIGN DE še ni omogočen.");
    error.code = "FISKALY_LIVE_LOCKED";
    throw error;
  }
  const production = mode === "production";
  if (production && (!enabled(env.FISKALY_LIVE_ENABLED)
      || !enabled(env.FISKALY_LIVE_LEGAL_REVIEW_CONFIRMED)
      || !enabled(env.FISKALY_LIVE_CASH_SYSTEM_REGISTERED)
      || !enabled(env.FISKALY_LIVE_DSFINVK_CONFORMANCE_CONFIRMED))) {
    const error = new Error("Produkcijski fiskaly zahteva izrecno omogočanje ter potrjen pravni, registracijski in DSFinV-K postopek.");
    error.code = "FISKALY_LIVE_LOCKED";
    throw error;
  }
  const apiKey = clean(production ? env.FISKALY_API_KEY_LIVE : env.FISKALY_API_KEY_TEST);
  const apiSecret = clean(production ? env.FISKALY_API_SECRET_LIVE : env.FISKALY_API_SECRET_TEST);
  if (!apiKey || !apiSecret) {
    const error = new Error(production ? "Produkcijska fiskaly povezava še ni nastavljena." : "Testna fiskaly povezava še ni nastavljena.");
    error.code = "FISKALY_NOT_CONFIGURED";
    throw error;
  }
  return {
    mode,
    baseUrl: TEST_BASE_URL,
    apiKey,
    apiSecret,
    tssId: clean(production ? env.FISKALY_TSS_ID_LIVE : env.FISKALY_TSS_ID_TEST),
    clientId: clean(production ? env.FISKALY_CLIENT_ID_LIVE : env.FISKALY_CLIENT_ID_TEST),
  };
}

function requireTraining(cfg) {
  if (cfg && cfg.mode === "test") return;
  const error = new Error("TRAINING podpis ni dovoljen s produkcijskimi fiskaly poverilnicami.");
  error.code = "FISKALY_TRAINING_ONLY";
  throw error;
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
  const body = await providerJson.readJson(response, {
    maxBytes: MAX_RESPONSE_BYTES,
    code: "FISKALY_RESPONSE_TOO_LARGE",
    message: "fiskaly SIGN DE je vrnil prevelik odgovor.",
  });
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
const FISCAL_TYPES = new Set(["SALE", "REFUND"]);

function failReceipt(message) {
  const error = new Error(message || "Neveljaven testni Kassenbon.");
  error.code = "FISKALY_RECEIPT_INVALID";
  throw error;
}

function failLookup(message) {
  const error = new Error(message || "fiskaly je vrnil drugo ali nepodprto testno transakcijo.");
  error.code = "FISKALY_TX_LOOKUP_MISMATCH";
  throw error;
}

function cents(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : NaN;
}

function money(centsValue) {
  return (centsValue / 100).toFixed(2);
}

function fiscalType(value, fallback) {
  const normalized = clean(value || fallback).toUpperCase();
  if (!FISCAL_TYPES.has(normalized)) failLookup("Vrsta fiskalnega dogodka ni veljavna.");
  return normalized;
}

function trainingMetadata(fiscalTypeValue) {
  return {
    source: "werktech_pos",
    purpose: "sandbox_kassenbon",
    receipt_type: "training",
    fiscal_type: fiscalType(fiscalTypeValue, "SALE").toLowerCase(),
  };
}

function productionMetadata() {
  return {
    source: "werktech_pos",
    purpose: "fiscal_kassenbon",
    receipt_type: "receipt",
    fiscal_type: "sale",
  };
}

function providerMoneyCents(value) {
  const amount = typeof value === "string" ? value : "";
  if (!/^(?:0|[1-9][0-9]{0,9})\.[0-9]{2}$/.test(amount)) {
    failLookup("fiskaly Kassenbon nima veljavnega decimalnega zneska.");
  }
  const parts = amount.split(".");
  const result = Number(parts[0]) * 100 + Number(parts[1]);
  if (!Number.isSafeInteger(result)) failLookup("fiskaly Kassenbon presega varen obračunski obseg.");
  return result;
}

function providerReceiptEvidence(body, expectedReceipt, expectedFiscalType, receiptTypeInput, purposeInput) {
  const transaction = body && typeof body === "object" ? body : {};
  const metadata = transaction.metadata && typeof transaction.metadata === "object" ? transaction.metadata : {};
  const schema = transaction.schema && transaction.schema.standard_v1;
  const providerReceipt = schema && schema.receipt;
  const expected = expectedReceipt && Array.isArray(expectedReceipt.items) && Array.isArray(expectedReceipt.totalsByVat)
    ? expectedReceipt
    : normalizeTrainingReceipt(expectedReceipt);
  const expectedType = fiscalType(expectedFiscalType);
  const observedType = fiscalType(metadata.fiscal_type);
  const expectedReceiptType = clean(receiptTypeInput || "TRAINING").toUpperCase();
  const expectedPurpose = clean(purposeInput || "sandbox_kassenbon");

  if (!providerReceipt || typeof providerReceipt !== "object" || providerReceipt.receipt_type !== expectedReceiptType) {
    failLookup("fiskaly FINISHED transakcija nima pričakovanega Kassenbona.");
  }
  if (metadata.source !== "werktech_pos"
      || metadata.purpose !== expectedPurpose
      || metadata.receipt_type !== expectedReceiptType.toLowerCase()
      || observedType !== expectedType) {
    failLookup("fiskaly FINISHED transakcija nima pričakovane fiskalne oznake.");
  }

  const payments = providerReceipt.amounts_per_payment_type;
  if (!Array.isArray(payments) || payments.length !== 1) {
    failLookup("fiskaly Kassenbon nima enega točnega plačilnega zneska.");
  }
  const payment = payments[0] && typeof payments[0] === "object" ? payments[0] : {};
  const paymentType = typeof payment.payment_type === "string" ? payment.payment_type : "";
  const currency = typeof payment.currency_code === "string" ? payment.currency_code : "";
  const grossCents = providerMoneyCents(payment.amount);
  if (paymentType !== expected.paymentType || currency !== "EUR" || grossCents !== expected.grossCents) {
    failLookup("fiskaly Kassenbon se ne ujema s pričakovanim plačilnim zneskom v EUR.");
  }

  const expectedVat = new Map(expected.totalsByVat.map((row) => [row.fiskalyVatRate, row.grossCents]));
  const providerVat = providerReceipt.amounts_per_vat_rate;
  if (!Array.isArray(providerVat) || providerVat.length !== expectedVat.size) {
    failLookup("fiskaly Kassenbon nima pričakovanih DDV vsot.");
  }
  const observedVat = new Map();
  providerVat.forEach((raw) => {
    const row = raw && typeof raw === "object" ? raw : {};
    const rate = typeof row.vat_rate === "string" ? row.vat_rate : "";
    if (!expectedVat.has(rate) || observedVat.has(rate)) {
      failLookup("fiskaly Kassenbon vsebuje drugo ali podvojeno DDV stopnjo.");
    }
    observedVat.set(rate, providerMoneyCents(row.amount));
  });
  for (const [rate, expectedCents] of expectedVat) {
    if (observedVat.get(rate) !== expectedCents) {
      failLookup("fiskaly Kassenbon se ne ujema s pričakovano DDV vsoto.");
    }
  }

  return Object.freeze({
    receiptType: expectedReceiptType,
    fiscalType: observedType,
    paymentType,
    currency,
    grossCents,
    totalsByVat: Object.freeze(Array.from(observedVat, ([vatRate, amountCents]) => Object.freeze({ vatRate, amountCents }))),
  });
}

function providerTrainingEvidence(body, expectedReceipt, expectedFiscalType) {
  return providerReceiptEvidence(body, expectedReceipt, expectedFiscalType, "TRAINING", "sandbox_kassenbon");
}

function assertFinishedSignature(result) {
  if (!result || result.state !== "FINISHED" || !result.transactionId
      || result.signatureCounter === null || !result.signatureAlgorithm
      || !result.tssSerialNumber || !result.clientSerialNumber || !result.qrCodeData
      || !result.startedAt || !result.finishedAt) {
    const error = new Error("fiskaly ni vrnil popolnega testnega podpisa.");
    error.code = "FISKALY_TX_INCOMPLETE";
    throw error;
  }
  const startedAt = new Date(result.startedAt);
  const finishedAt = new Date(result.finishedAt);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(finishedAt.getTime()) || finishedAt < startedAt) {
    const error = new Error("fiskaly FINISHED transakcija nima veljavnega časovnega intervala.");
    error.code = "FISKALY_TX_INCOMPLETE";
    throw error;
  }
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

function receiptSchema(receiptInput, receiptTypeInput) {
  const receipt = receiptInput && Array.isArray(receiptInput.items)
    ? receiptInput
    : normalizeTrainingReceipt({
      paymentType: "NON_CASH",
      items: [{ description: "SIGN DE readiness", quantityMilli: 1000, unitGrossCents: 100, vatRate: "19" }],
    });
  return {
    standard_v1: {
      receipt: {
        receipt_type: clean(receiptTypeInput || "TRAINING").toUpperCase(),
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

function trainingReceipt(receiptInput) {
  return receiptSchema(receiptInput, "TRAINING");
}

function productionReceipt(receiptInput) {
  return receiptSchema(receiptInput, "RECEIPT");
}

function publicTransaction(body, receiptInput, providerEvidence) {
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
    training: providerEvidence ? providerEvidence.receiptType === "TRAINING" : true,
    fiscalType: providerEvidence ? providerEvidence.fiscalType : undefined,
    paymentType: providerEvidence ? providerEvidence.paymentType : receipt.paymentType,
    amount: money(providerEvidence ? providerEvidence.grossCents : receipt.grossCents),
    currency: providerEvidence ? providerEvidence.currency : "EUR",
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

async function runTrainingReceipt(source, requestedId, receiptInput, fiscalTypeInput) {
  const cfg = configuration(source);
  requireTraining(cfg);
  const transactionId = uuidV4(requestedId);
  if (!transactionId) {
    const error = new Error("Neveljaven identifikator testne transakcije.");
    error.code = "FISKALY_TX_ID_INVALID";
    throw error;
  }
  const receipt = normalizeTrainingReceipt(receiptInput);
  const expectedType = fiscalType(fiscalTypeInput, "SALE");
  const metadata = trainingMetadata(expectedType);
  const token = await authenticate(cfg);
  await retrieveResources(cfg, token);
  await upsertTransaction(cfg, token, transactionId, 1, {
    state: "ACTIVE",
    client_id: cfg.clientId,
    metadata,
  });
  const finished = await upsertTransaction(cfg, token, transactionId, 2, {
    state: "FINISHED",
    client_id: cfg.clientId,
    metadata,
    schema: trainingReceipt(receipt),
  });
  const returnedClientId = finished && typeof finished.client_id === "string" ? finished.client_id : "";
  if (!returnedClientId || returnedClientId !== cfg.clientId) failLookup();
  const evidence = providerTrainingEvidence(finished, receipt, expectedType);
  const result = publicTransaction(finished, receipt, evidence);
  assertFinishedSignature(result);
  if (result.transactionId !== transactionId) failLookup();
  return result;
}

async function runProductionReceipt(source, requestedId, receiptInput, fiscalTypeInput) {
  const cfg = configuration(source);
  if (cfg.mode !== "production") {
    const error = new Error("Produkcijski fiskaly podpis zahteva produkcijski način.");
    error.code = "FISKALY_LIVE_LOCKED";
    throw error;
  }
  const transactionId = uuidV4(requestedId);
  if (!transactionId) {
    const error = new Error("Neveljaven identifikator produkcijske transakcije.");
    error.code = "FISKALY_TX_ID_INVALID";
    throw error;
  }
  const expectedType = fiscalType(fiscalTypeInput, "SALE");
  if (expectedType !== "SALE") {
    const error = new Error("Produkcijski fiskaly refund ostaja zaklenjen do potrditve davčne sheme.");
    error.code = "FISKALY_LIVE_REFUND_LOCKED";
    throw error;
  }
  const receipt = normalizeTrainingReceipt(receiptInput);
  const metadata = productionMetadata();
  const token = await authenticate(cfg);
  await retrieveResources(cfg, token);
  await upsertTransaction(cfg, token, transactionId, 1, {
    state: "ACTIVE",
    client_id: cfg.clientId,
    metadata,
  });
  const finished = await upsertTransaction(cfg, token, transactionId, 2, {
    state: "FINISHED",
    client_id: cfg.clientId,
    metadata,
    schema: productionReceipt(receipt),
  });
  const returnedClientId = finished && typeof finished.client_id === "string" ? finished.client_id : "";
  if (!returnedClientId || returnedClientId !== cfg.clientId) failLookup();
  const evidence = providerReceiptEvidence(finished, receipt, "SALE", "RECEIPT", "fiscal_kassenbon");
  const result = publicTransaction(finished, receipt, evidence);
  assertFinishedSignature(result);
  if (result.transactionId !== transactionId || result.training) failLookup();
  return result;
}

async function runTrainingTransaction(source, requestedId) {
  return runTrainingReceipt(source, requestedId, {
    paymentType: "NON_CASH",
    items: [{ description: "SIGN DE readiness", quantityMilli: 1000, unitGrossCents: 100, vatRate: "19" }],
  });
}

async function retrieveTrainingReceipt(source, requestedId, receiptInput, expectedFiscalType) {
  const cfg = configuration(source);
  requireTraining(cfg);
  const transactionId = uuidV4(requestedId);
  if (!transactionId) {
    const error = new Error("Neveljaven identifikator testne transakcije.");
    error.code = "FISKALY_TX_ID_INVALID";
    throw error;
  }
  if (!cfg.tssId || !cfg.clientId) {
    const error = new Error("Testna TSS in odjemalec še nista nastavljena.");
    error.code = "FISKALY_RESOURCES_NOT_CONFIGURED";
    throw error;
  }
  const receipt = normalizeTrainingReceipt(receiptInput);
  const expectedType = fiscalType(expectedFiscalType);
  const token = await authenticate(cfg);
  let body;
  try {
    body = await requestJson(
      cfg.baseUrl + "/tss/" + encodeURIComponent(cfg.tssId) + "/tx/" + encodeURIComponent(transactionId),
      { method: "GET", headers: { Authorization: "Bearer " + token, Accept: "application/json" } },
      12000
    );
  } catch (error) {
    // Only an exact authenticated 404 for this TSS/transaction id is
    // authoritative absence. Network errors and every other response remain
    // ambiguous and must keep the local record locked.
    if (error && error.status === 404) {
      return { transactionId, state: "NOT_FOUND", receipt, observedAt: new Date().toISOString() };
    }
    throw error;
  }
  const returnedClientId = body && typeof body.client_id === "string" ? body.client_id : "";
  const result = publicTransaction(body, receipt);
  if (result.transactionId !== transactionId
      || !returnedClientId || returnedClientId !== cfg.clientId
      || !["ACTIVE", "FINISHED", "CANCELLED"].includes(result.state)) {
    failLookup();
  }
  if (result.state === "FINISHED") assertFinishedSignature(result);
  if (result.state === "FINISHED") {
    const evidence = providerTrainingEvidence(body, receipt, expectedType);
    result.fiscalType = evidence.fiscalType;
    result.paymentType = evidence.paymentType;
    result.amount = money(evidence.grossCents);
    result.currency = evidence.currency;
    result.providerReceipt = evidence;
  }
  result.observedAt = new Date().toISOString();
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
  MAX_RESPONSE_BYTES,
  configuration,
  authenticate,
  connectionStatus,
  runTrainingTransaction,
  runTrainingReceipt,
  runProductionReceipt,
  retrieveTrainingReceipt,
  listCount,
  _test: {
    requestJson,
    uuidV4,
    normalizeTrainingReceipt,
    trainingReceipt,
    productionReceipt,
    trainingMetadata,
    productionMetadata,
    providerReceiptEvidence,
    providerTrainingEvidence,
    publicTransaction,
    transactionHeaders,
  },
};
