"use strict";

const crypto = require("crypto");
const providerJson = require("./provider-json");

const SANDBOX_BASE_URL = "https://sandbox.finapi.io/api/v2";
const LIVE_BASE_URL = "https://live.finapi.io/api/v2";
const WEBFORM_SANDBOX_BASE_URL = "https://webform-sandbox.finapi.io";
const WEBFORM_LIVE_BASE_URL = "https://webform-live.finapi.io";
const WEBFORM_LIVE_HOSTS = new Set(["webform-live.finapi.io", "webform.finapi.io"]);
const DEMO_BANK_ID = 280001;
const DEMO_BANK_NAME = "finAPI Test Bank";
const DEMO_BANK_INTERFACE = "XS2A";
const tokenCache = new Map();
const MAX_TOKEN_CACHE_ENTRIES = 256;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function pruneTokenCache(now) {
  const current = Number(now) || Date.now();
  tokenCache.forEach(function (entry, key) {
    if (!entry || entry.expiresAt <= current + 30000) tokenCache.delete(key);
  });
  while (tokenCache.size >= MAX_TOKEN_CACHE_ENTRIES) {
    const oldestKey = tokenCache.keys().next().value;
    if (oldestKey === undefined) break;
    tokenCache.delete(oldestKey);
  }
}

function clean(value) {
  return String(value || "").trim();
}

function enabled(value) {
  return /^(1|true)$/i.test(clean(value));
}

function clientIdFingerprint(value) {
  return crypto.createHash("sha256").update(clean(value)).digest("hex");
}

function configuration(source) {
  const env = source || process.env;
  const mode = clean(env.FINAPI_MODE || "sandbox").toLowerCase();
  if (mode !== "sandbox" && mode !== "production") {
    const error = new Error("Produkcijski finAPI še ni omogočen.");
    error.code = "FINAPI_LIVE_LOCKED";
    throw error;
  }
  const production = mode === "production";
  if (production && (!enabled(env.FINAPI_LIVE_ENABLED)
      || !enabled(env.FINAPI_LIVE_LICENSE_CONFIRMED)
      || !enabled(env.FINAPI_LIVE_DATA_PROCESSING_CONFIRMED)
      || !enabled(env.FINAPI_LIVE_USER_DELETION_PROCESS_CONFIRMED))) {
    const error = new Error("Produkcijski finAPI zahteva izrecno omogočanje, licenco, potrditev obdelave podatkov in potrjen postopek izbrisa uporabnikov.");
    error.code = "FINAPI_LIVE_LOCKED";
    throw error;
  }
  const clientId = clean(production ? env.FINAPI_CLIENT_ID_LIVE : env.FINAPI_CLIENT_ID);
  const clientSecret = clean(production ? env.FINAPI_CLIENT_SECRET_LIVE : env.FINAPI_CLIENT_SECRET);
  const userKey = clean(production ? env.FINAPI_USER_KEY_LIVE : env.FINAPI_USER_KEY);
  if (!clientId || !clientSecret || !userKey) {
    const error = new Error(production ? "Produkcijska finAPI povezava še ni nastavljena." : "Testna finAPI povezava še ni nastavljena.");
    error.code = "FINAPI_NOT_CONFIGURED";
    throw error;
  }
  if (userKey.length < 32) {
    const error = new Error("Strežniški ključ finAPI uporabnikov ni dovolj dolg.");
    error.code = "FINAPI_USER_KEY_INVALID";
    throw error;
  }
  return {
    mode,
    baseUrl: production ? LIVE_BASE_URL : SANDBOX_BASE_URL,
    webFormBaseUrl: production ? WEBFORM_LIVE_BASE_URL : WEBFORM_SANDBOX_BASE_URL,
    clientId,
    clientSecret,
    userKey,
  };
}

function userCredentials(appUserId, cfg) {
  // finAPI zahteva strogo razmerje one end user -> one finAPI user.
  // Identiteto zato deterministično ločimo po Supabase uporabniku, geslo pa
  // izpeljemo samo na strežniku in ga nikoli ne vrnemo v brskalnik.
  const normalizedUserId = clean(appUserId).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalizedUserId)) {
    const error = new Error("Uporabniški identifikator ni veljaven.");
    error.code = "FINAPI_USER_INVALID";
    throw error;
  }
  const rawId = normalizedUserId.replace(/-/g, "");
  const id = ("uj" + rawId).slice(0, 36);
  const digest = crypto.createHmac("sha256", cfg.userKey).update("finapi-user:" + normalizedUserId).digest("base64url");
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
  const body = await providerJson.readJson(response, {
    maxBytes: MAX_RESPONSE_BYTES,
    code: "FINAPI_RESPONSE_TOO_LARGE",
    message: "finAPI je vrnil prevelik odgovor.",
  });
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
  const cacheNamespace = clean(cfg && cfg.baseUrl) + ":" + clientIdFingerprint(cfg && cfg.clientId);
  const cacheKey = cacheNamespace + (grant === "client_credentials" ? ":client" : ":user:" + user.id);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30000) {
    tokenCache.delete(cacheKey);
    tokenCache.set(cacheKey, cached);
    return cached.value;
  }
  if (cached) tokenCache.delete(cacheKey);
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
  pruneTokenCache(Date.now());
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

function relevantConnections(connections, cfg) {
  const rows = Array.isArray(connections) ? connections : [];
  if (cfg && cfg.mode === "production") {
    return rows.filter(function (connection) { return Boolean(clean(connection && connection.id)); });
  }
  const demo = demoConnection(rows);
  return demo ? [demo] : [];
}

function connectionPending(connection) {
  return clean(connection && connection.updateStatus).toUpperCase() === "IN_PROGRESS";
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

function verifiedWebFormUrl(value, cfg) {
  let parsed;
  try { parsed = new URL(clean(value)); }
  catch (_) { parsed = null; }
  const production = cfg && cfg.mode === "production";
  const allowedHost = production
    ? parsed && WEBFORM_LIVE_HOSTS.has(parsed.hostname)
    : parsed && parsed.hostname === "webform-sandbox.finapi.io";
  if (!parsed || parsed.protocol !== "https:" || !allowedHost
    || !/^\/wf\/[0-9a-f-]+\/?$/i.test(parsed.pathname) || parsed.username || parsed.password) {
    const error = new Error("finAPI ni vrnil varnega bančnega obrazca.");
    error.code = "FINAPI_WEBFORM_INVALID";
    throw error;
  }
  return parsed.toString();
}

async function createBankWebForm(appUserId, source) {
  const cfg = configuration(source);
  const token = await userToken(appUserId, cfg, true);
  const webFormCfg = Object.assign({}, cfg, { baseUrl: cfg.webFormBaseUrl });
  const requestBody = cfg.mode === "production"
    ? { accountTypes: ["CHECKING"], maxDaysForDownload: 120 }
    : {
      bank: { id: DEMO_BANK_ID },
      bankConnectionName: DEMO_BANK_NAME,
      allowedInterfaces: [DEMO_BANK_INTERFACE],
      allowTestBank: true,
      maxDaysForDownload: 120,
    };
  const body = await requestJson(webFormCfg, "/api/webForms/bankConnectionImport", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, bearer(token)),
    body: JSON.stringify(requestBody),
  }, 20000);
  return {
    id: clean(body.id),
    url: verifiedWebFormUrl(body.url, cfg),
    status: clean(body.status || "NOT_YET_OPENED"),
    expiresAt: clean(body.expiresAt),
  };
}

async function createDemoBankWebForm(appUserId, source) {
  return createBankWebForm(appUserId, source);
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

function reconcileTransactions(rows, accounts) {
  const accountsById = new Map();
  (Array.isArray(accounts) ? accounts : []).forEach(function (account) {
    const normalized = normalizeAccount(account);
    if (!normalized) return;
    const existing = accountsById.get(normalized.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(normalized)) {
      const error = new Error("finAPI je vrnil nasprotujoče podatke bančnega računa.");
      error.code = "FINAPI_ACCOUNT_MAPPING_CONFLICT";
      throw error;
    }
    accountsById.set(normalized.id, normalized);
  });
  const byReference = new Map();
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    const normalized = normalizeTransaction(row, accountsById);
    if (!normalized) return;
    if (!normalized.source_account_id || !accountsById.has(normalized.source_account_id)) {
      const error = new Error("finAPI priliva ni mogoče varno povezati z uporabnikovim bančnim računom.");
      error.code = "FINAPI_ACCOUNT_MAPPING_INVALID";
      throw error;
    }
    const existing = byReference.get(normalized.external_reference);
    if (existing && JSON.stringify(existing) !== JSON.stringify(normalized)) {
      const error = new Error("finAPI je vrnil nasprotujočo ponovitev iste transakcije.");
      error.code = "FINAPI_TRANSACTION_CONFLICT";
      throw error;
    }
    if (!existing) byReference.set(normalized.external_reference, normalized);
  });
  return Array.from(byReference.values());
}

async function incomingTransactions(token, cfg, days, accounts) {
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
  return reconcileTransactions(rows, accounts);
}

async function statusForUser(appUserId, source) {
  const cfg = configuration(source);
  try {
    const token = await userToken(appUserId, cfg, false);
    const connections = relevantConnections(await bankConnections(token, cfg), cfg);
    const connection = connections[0] || null;
    return {
      configured: true,
      connected: Boolean(connection),
      pending: connections.some(connectionPending),
      environment: cfg.mode,
      bankName: connectionBankName(connection),
    };
  } catch (error) {
    if (error && (error.status === 400 || error.status === 401 || error.code === "FINAPI_AUTH_INVALID")) {
      return { configured: true, connected: false, pending: false, environment: cfg.mode, bankName: "" };
    }
    throw error;
  }
}

async function syncTransactions(appUserId, source) {
  const cfg = configuration(source);
  const token = await userToken(appUserId, cfg, false);
  let connections = relevantConnections(await bankConnections(token, cfg), cfg);
  let connection = connections[0] || null;
  if (!connection) {
    const error = new Error("Najprej zaključite varen finAPI bančni obrazec.");
    error.code = "FINAPI_WEBFORM_REQUIRED";
    error.status = 409;
    throw error;
  }
  if (connections.some(connectionPending)) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise(function (resolve) { setTimeout(resolve, 650); });
      connections = relevantConnections(await bankConnections(token, cfg), cfg);
      connection = connections[0] || connection;
      if (!connections.some(connectionPending)) break;
    }
  }
  if (connections.some(connectionPending)) {
    return {
      status: {
        configured: true,
        connected: true,
        pending: true,
        environment: cfg.mode,
        bankName: connectionBankName(connection) || (cfg.mode === "sandbox" ? DEMO_BANK_NAME : ""),
      },
    };
  }
  const accounts = await accountsForUser(token, cfg);
  const transactions = await incomingTransactions(token, cfg, 120, accounts);
  return {
    status: {
      configured: true,
      connected: true,
      pending: connections.some(connectionPending),
      environment: cfg.mode,
      bankName: connectionBankName(connection) || (cfg.mode === "sandbox" ? DEMO_BANK_NAME : ""),
    },
    transactions,
    syncedAt: new Date().toISOString(),
  };
}

async function syncDemoTransactions(appUserId, source) {
  return syncTransactions(appUserId, source);
}

module.exports = {
  SANDBOX_BASE_URL,
  LIVE_BASE_URL,
  WEBFORM_SANDBOX_BASE_URL,
  WEBFORM_LIVE_BASE_URL,
  DEMO_BANK_ID,
  MAX_TOKEN_CACHE_ENTRIES,
  MAX_RESPONSE_BYTES,
  configuration,
  createBankWebForm,
  createDemoBankWebForm,
  statusForUser,
  syncTransactions,
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
    relevantConnections,
    connectionPending,
    connectionBankName,
    normalizeAccount,
    reconcileTransactions,
    pagedCollection,
    accountsForUser,
    verifiedWebFormUrl,
    clientIdFingerprint,
    incomingTransactions,
    pruneTokenCache,
    tokenCacheSize: function () { return tokenCache.size; },
    resetTokenCache: function () { tokenCache.clear(); },
  },
};
