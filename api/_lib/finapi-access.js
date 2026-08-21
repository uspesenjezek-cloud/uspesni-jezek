"use strict";

const crypto = require("crypto");

const SANDBOX_BASE_URL = "https://sandbox.finapi.io/api/v2";
const WEBFORM_SANDBOX_BASE_URL = "https://webform-sandbox.finapi.io";
const DEMO_BANK_ID = 280001;
const DEMO_BANK_NAME = "finAPI Test Bank";
const DEMO_BANK_INTERFACE = "XS2A";
const tokenCache = new Map();

function clean(value) {
  return String(value || "").trim();
}

function configuration(source) {
  const env = source || process.env;
  const mode = clean(env.FINAPI_MODE || "sandbox").toLowerCase();
  if (mode !== "sandbox") {
    const error = new Error("Produkcijski finAPI še ni omogočen.");
    error.code = "FINAPI_LIVE_LOCKED";
    throw error;
  }
  const clientId = clean(env.FINAPI_CLIENT_ID);
  const clientSecret = clean(env.FINAPI_CLIENT_SECRET);
  const userKey = clean(env.FINAPI_USER_KEY);
  if (!clientId || !clientSecret || !userKey) {
    const error = new Error("Testna finAPI povezava še ni nastavljena.");
    error.code = "FINAPI_NOT_CONFIGURED";
    throw error;
  }
  if (userKey.length < 32) {
    const error = new Error("Strežniški ključ finAPI uporabnikov ni dovolj dolg.");
    error.code = "FINAPI_USER_KEY_INVALID";
    throw error;
  }
  return { mode: "sandbox", baseUrl: SANDBOX_BASE_URL, clientId, clientSecret, userKey };
}

function userCredentials(appUserId, cfg) {
  // finAPI zahteva strogo razmerje one end user -> one finAPI user.
  // Identiteto zato deterministično ločimo po Supabase uporabniku, geslo pa
  // izpeljemo samo na strežniku in ga nikoli ne vrnemo v brskalnik.
  const rawId = clean(appUserId).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (!rawId) {
    const error = new Error("Uporabniški identifikator ni veljaven.");
    error.code = "FINAPI_USER_INVALID";
    throw error;
  }
  const id = ("uj" + rawId).slice(0, 36);
  const digest = crypto.createHmac("sha256", cfg.userKey).update("finapi-user:" + clean(appUserId)).digest("base64url");
  return { id, password: "Wk!9-" + digest.slice(0, 40) };
}

function errorCode(body) {
  if (!body || typeof body !== "object") return "";
  if (body.code) return clean(body.code);
  if (Array.isArray(body.errors) && body.errors[0]) return clean(body.errors[0].code || body.errors[0].type);
  return "";
}

async function requestJson(cfg, path, options, timeoutMs) {
  const request = Object.assign({}, options || {});
  request.headers = Object.assign({
    Accept: "application/json",
    "X-Request-Id": crypto.randomUUID(),
  }, request.headers || {});
  if (!request.signal && typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    request.signal = AbortSignal.timeout(Math.min(Math.max(Number(timeoutMs) || 12000, 1000), 25000));
  }
  let response;
  try {
    response = await fetch(cfg.baseUrl + path, request);
  } catch (cause) {
    const error = new Error("finAPI trenutno ni dosegljiv.");
    error.code = cause && (cause.name === "AbortError" || cause.name === "TimeoutError") ? "FINAPI_TIMEOUT" : "FINAPI_UNAVAILABLE";
    error.retryable = true;
    throw error;
  }
  let body = null;
  try { body = await response.json(); } catch (_) {}
  if (!response.ok) {
    const error = new Error("finAPI zahteva ni uspela.");
    error.code = errorCode(body) || "FINAPI_REQUEST_FAILED";
    error.status = response.status;
    error.retryable = response.status === 429 || response.status >= 500;
    error.details = body;
    throw error;
  }
  return body || {};
}

async function oauthToken(cfg, grant, user) {
  const cacheKey = grant === "client_credentials" ? "client" : "user:" + user.id;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30000) return cached.value;
  const form = new URLSearchParams({
    grant_type: grant,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  if (grant === "password") {
    form.set("username", user.id);
    form.set("password", user.password);
  }
  const body = await requestJson(cfg, "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }, 12000);
  const value = clean(body.access_token);
  if (!value) {
    const error = new Error("finAPI ni vrnil veljavne seje.");
    error.code = "FINAPI_AUTH_INVALID";
    throw error;
  }
  tokenCache.set(cacheKey, { value, expiresAt: Date.now() + Math.max(60, Number(body.expires_in) || 3600) * 1000 });
  return value;
}

function bearer(token) {
  return { Authorization: "Bearer " + token };
}

async function ensureUser(appUserId, cfg) {
  const user = userCredentials(appUserId, cfg);
  const token = await oauthToken(cfg, "client_credentials");
  try {
    await requestJson(cfg, "/users", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, bearer(token)),
      body: JSON.stringify({ id: user.id, password: user.password, isAutoUpdateEnabled: false }),
    }, 12000);
  } catch (error) {
    if (!(error && error.status === 422 && error.code === "ENTITY_EXISTS")) throw error;
  }
  return user;
}

async function userToken(appUserId, cfg, createIfMissing) {
  const user = createIfMissing ? await ensureUser(appUserId, cfg) : userCredentials(appUserId, cfg);
  return oauthToken(cfg, "password", user);
}

async function bankConnections(token, cfg) {
  const body = await requestJson(cfg, "/bankConnections", { headers: bearer(token) }, 12000);
  return Array.isArray(body.connections) ? body.connections : [];
}

async function pagedCollection(token, cfg, path, query, property, timeoutMs) {
  const rows = [];
  let page = 1;
  while (true) {
    query.set("page", String(page));
    const body = await requestJson(cfg, path + "?" + query.toString(), { headers: bearer(token) }, timeoutMs);
    const current = Array.isArray(body[property]) ? body[property] : [];
    rows.push.apply(rows, current);
    const pageCount = Number(body.paging && body.paging.pageCount);
    if (!Number.isSafeInteger(pageCount) || pageCount < 1 || page >= pageCount) break;
    if (pageCount > 1000) {
      const error = new Error("finAPI je vrnil neveljavno število strani.");
      error.code = "FINAPI_PAGING_INVALID";
      throw error;
    }
    page += 1;
  }
  return rows;
}

function demoConnection(connections) {
  return (connections || []).find(function (connection) {
    return Number(connection && (connection.bankId || connection.bank && connection.bank.id)) === DEMO_BANK_ID;
  }) || null;
}

function connectionBankName(connection) {
  return clean(connection && (connection.bankName || connection.name || connection.bank && connection.bank.name));
}

function normalizeAccount(row) {
  const id = clean(row && row.id);
  if (!id) return null;
  return {
    id,
    name: clean(row && (row.name || row.accountName || row.productName || row.accountTypeName)).slice(0, 240),
    iban: clean(row && row.iban).replace(/\s+/g, "").toUpperCase().slice(0, 34),
  };
}

async function accountsForUser(token, cfg) {
  const rows = await pagedCollection(token, cfg, "/accounts", new URLSearchParams({ perPage: "500" }), "accounts", 12000);
  return rows.map(normalizeAccount).filter(Boolean);
}

function verifiedWebFormUrl(value) {
  let parsed;
  try { parsed = new URL(clean(value)); }
  catch (_) { parsed = null; }
  if (!parsed || parsed.protocol !== "https:" || parsed.hostname !== "webform-sandbox.finapi.io") {
    const error = new Error("finAPI ni vrnil varnega testnega obrazca.");
    error.code = "FINAPI_WEBFORM_INVALID";
    throw error;
  }
  return parsed.toString();
}

async function createDemoBankWebForm(appUserId, source) {
  const cfg = configuration(source);
  const token = await userToken(appUserId, cfg, true);
  const webFormCfg = Object.assign({}, cfg, { baseUrl: WEBFORM_SANDBOX_BASE_URL });
  const body = await requestJson(webFormCfg, "/api/webForms/bankConnectionImport", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, bearer(token)),
    body: JSON.stringify({
      bank: { id: DEMO_BANK_ID },
      bankConnectionName: DEMO_BANK_NAME,
      allowedInterfaces: [DEMO_BANK_INTERFACE],
      allowTestBank: true,
      maxDaysForDownload: 120,
    }),
  }, 20000);
  return {
    id: clean(body.id),
    url: verifiedWebFormUrl(body.url),
    status: clean(body.status || "NOT_YET_OPENED"),
    expiresAt: clean(body.expiresAt),
  };
}

function isoDateDaysAgo(days) {
  const date = new Date(Date.now() - Math.max(0, Number(days) || 0) * 86400000);
  return date.toISOString().slice(0, 10);
}

function normalizeTransaction(row, accountsById) {
  const amount = Number(row && row.amount);
  const amountCents = Math.round(amount * 100);
  const currency = clean(row && row.currency || "EUR").toUpperCase();
  if (!row || !Number.isFinite(amount) || amountCents <= 0 || currency !== "EUR" || row.isAdjustingEntry || row.isPotentialDuplicate) return null;
  const id = clean(row.id);
  const sourceAccountId = clean(row.accountId);
  const sourceAccount = accountsById && accountsById.get(sourceAccountId) || null;
  const bookedOn = clean(row.bankBookingDate || row.finapiBookingDate || row.valueDate);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(bookedOn)) return null;
  return {
    external_reference: "finapi:" + id,
    booked_on: bookedOn,
    amount_cents: amountCents,
    currency: "EUR",
    counterparty_name: clean(row.counterpartName).slice(0, 240),
    counterparty_iban: clean(row.counterpartIban).replace(/\s+/g, "").toUpperCase().slice(0, 34),
    remittance_info: clean(row.cleanedPurpose || row.purpose || row.endToEndReference).slice(0, 500),
    source_account_id: sourceAccountId,
    source_account_name: clean(sourceAccount && sourceAccount.name).slice(0, 240),
    source_account_iban: clean(sourceAccount && sourceAccount.iban).slice(0, 34),
  };
}

async function incomingTransactions(token, cfg, days, accounts) {
  const accountsById = new Map((accounts || []).map(function (account) { return [clean(account.id), account]; }));
  const query = new URLSearchParams({
    view: "bankView",
    direction: "income",
    currency: "EUR",
    isAdjustingEntry: "false",
    isPotentialDuplicate: "false",
    minBankBookingDate: isoDateDaysAgo(Math.min(Math.max(Number(days) || 120, 14), 365)),
    perPage: "500",
    order: "finapiBookingDate,desc",
  });
  const rows = await pagedCollection(token, cfg, "/transactions", query, "transactions", 15000);
  return rows.map(function (row) {
    return normalizeTransaction(row, accountsById);
  }).filter(Boolean);
}

async function statusForUser(appUserId, source) {
  const cfg = configuration(source);
  try {
    const token = await userToken(appUserId, cfg, false);
    const connection = demoConnection(await bankConnections(token, cfg));
    return {
      configured: true,
      connected: Boolean(connection),
      pending: Boolean(connection && connection.updateStatus === "IN_PROGRESS"),
      environment: "sandbox",
      bankName: connectionBankName(connection),
    };
  } catch (error) {
    if (error && (error.status === 400 || error.status === 401 || error.code === "FINAPI_AUTH_INVALID")) {
      return { configured: true, connected: false, pending: false, environment: "sandbox", bankName: "" };
    }
    throw error;
  }
}

async function syncDemoTransactions(appUserId, source) {
  const cfg = configuration(source);
  const token = await userToken(appUserId, cfg, false);
  let connection = demoConnection(await bankConnections(token, cfg));
  if (!connection) {
    const error = new Error("Najprej zaključite varen finAPI testni obrazec.");
    error.code = "FINAPI_WEBFORM_REQUIRED";
    error.status = 409;
    throw error;
  }
  if (connection && connection.updateStatus === "IN_PROGRESS") {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise(function (resolve) { setTimeout(resolve, 650); });
      connection = demoConnection(await bankConnections(token, cfg)) || connection;
      if (connection.updateStatus !== "IN_PROGRESS") break;
    }
  }
  const accounts = await accountsForUser(token, cfg);
  const transactions = await incomingTransactions(token, cfg, 120, accounts);
  return {
    status: {
      configured: true,
      connected: true,
      pending: Boolean(connection && connection.updateStatus === "IN_PROGRESS"),
      environment: "sandbox",
      bankName: connectionBankName(connection) || DEMO_BANK_NAME,
    },
    transactions,
    syncedAt: new Date().toISOString(),
  };
}

module.exports = {
  SANDBOX_BASE_URL,
  WEBFORM_SANDBOX_BASE_URL,
  DEMO_BANK_ID,
  configuration,
  createDemoBankWebForm,
  statusForUser,
  syncDemoTransactions,
  _test: {
    userCredentials,
    errorCode,
    normalizeTransaction,
    isoDateDaysAgo,
    requestJson,
    oauthToken,
    ensureUser,
    demoConnection,
    connectionBankName,
    normalizeAccount,
    pagedCollection,
    accountsForUser,
    verifiedWebFormUrl,
    incomingTransactions,
    resetTokenCache: function () { tokenCache.clear(); },
  },
};
