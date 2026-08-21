"use strict";

const crypto = require("node:crypto");
const supabase = require("./supabase-server");

const DEFAULT_SCOPES = [
  "openid",
  "datev:accounting:clients",
  "accounting:documents",
  "datev:accounting:extf-files-import",
  "offline_access",
];

class DatevError extends Error {
  constructor(message, options) {
    super(message);
    const values = options || {};
    this.name = "DatevError";
    this.code = values.code || "DATEV_FAILED";
    this.status = Number(values.status || 502);
    this.retryable = Boolean(values.retryable);
    this.details = values.details || null;
  }
}

function environment(value) {
  const mode = String(value || "mock").toLowerCase();
  return ["mock", "sandbox", "production"].includes(mode) ? mode : "mock";
}

function secretKey(value, required) {
  const raw = String(value || "");
  if (required && raw.length < 32) throw new DatevError("DATEV šifrirni ključ manjka.", { code: "DATEV_NOT_CONFIGURED", status: 503 });
  return crypto.createHash("sha256").update(raw || "datev-mock-only-local-key").digest();
}

function configuration(env) {
  const source = env || process.env;
  const mode = environment(source.DATEV_MODE);
  const required = mode !== "mock";
  const clientId = String(source.DATEV_CLIENT_ID || "").trim();
  const clientSecret = String(source.DATEV_CLIENT_SECRET || "");
  const redirectUri = String(source.DATEV_REDIRECT_URI || "").trim();
  if (required && (!clientId || !clientSecret || !/^https:\/\//i.test(redirectUri))) {
    throw new DatevError("DATEV sandbox nastavitve še niso izdane.", { code: "DATEV_NOT_CONFIGURED", status: 503 });
  }
  return {
    mode,
    clientId: clientId || "uj-datev-mock",
    clientSecret,
    redirectUri: redirectUri || "https://uspesni-jezek.vercel.app/api/pos-datev?action=callback",
    scopes: String(source.DATEV_SCOPES || DEFAULT_SCOPES.join(" ")).trim().split(/\s+/).filter(Boolean),
    tokenKey: secretKey(source.DATEV_TOKEN_ENCRYPTION_KEY, required),
    appVersion: String(source.DATEV_APP_VERSION || "1.0.0").slice(0, 40),
  };
}

function urls(mode) {
  const sandbox = mode !== "production";
  return {
    authorize: sandbox ? "https://login.datev.de/openidsandbox/authorize" : "https://login.datev.de/openid/authorize",
    token: sandbox ? "https://sandbox-api.datev.de/token" : "https://api.datev.de/token",
    revoke: sandbox ? "https://sandbox-api.datev.de/revoke" : "https://api.datev.de/revoke",
    clients: "https://accounting-clients.api.datev.de/" + (sandbox ? "platform-sandbox" : "platform") + "/v2",
    documents: "https://accounting-documents.api.datev.de/" + (sandbox ? "platform-sandbox" : "platform") + "/v2",
    extf: "https://accounting-extf-files.api.datev.de/" + (sandbox ? "platform-sandbox" : "platform") + "/v3",
  };
}

function encryptBuffer(key, buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function decryptBuffer(key, value) {
  const payload = Buffer.from(String(value || ""), "base64url");
  if (payload.length < 29) throw new DatevError("DATEV seja je poškodovana.", { code: "DATEV_TOKEN_INVALID", status: 401 });
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
}

function encryptSecret(cfg, value) {
  return value ? encryptBuffer(cfg.tokenKey, Buffer.from(String(value), "utf8")) : "";
}

function decryptSecret(cfg, value) {
  return value ? decryptBuffer(cfg.tokenKey, value).toString("utf8") : "";
}

function sealState(cfg, values) {
  const body = Object.assign({}, values, { exp: Date.now() + 15 * 60 * 1000 });
  return encryptBuffer(cfg.tokenKey, Buffer.from(JSON.stringify(body), "utf8"));
}

function openState(cfg, value) {
  let body;
  try { body = JSON.parse(decryptBuffer(cfg.tokenKey, value).toString("utf8")); }
  catch (_) { throw new DatevError("DATEV povezovalna seja ni veljavna.", { code: "DATEV_STATE_INVALID", status: 400 }); }
  if (!body || Number(body.exp || 0) < Date.now()) throw new DatevError("DATEV povezovalna seja je potekla.", { code: "DATEV_STATE_EXPIRED", status: 400 });
  return body;
}

function createPkce() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  return { verifier, challenge: crypto.createHash("sha256").update(verifier).digest("base64url") };
}

function authorizationUrl(cfg, values) {
  const pkce = createPkce();
  const state = sealState(cfg, Object.assign({}, values, { verifier: pkce.verifier, nonce: crypto.randomUUID() }));
  const target = new URL(urls(cfg.mode).authorize);
  target.searchParams.set("client_id", cfg.clientId);
  target.searchParams.set("redirect_uri", cfg.redirectUri);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("scope", cfg.scopes.join(" "));
  target.searchParams.set("code_challenge", pkce.challenge);
  target.searchParams.set("code_challenge_method", "S256");
  target.searchParams.set("state", state);
  target.searchParams.set("nonce", crypto.randomBytes(24).toString("base64url"));
  target.searchParams.set("enableWindowsSso", "true");
  return target.toString();
}

async function responseData(response) {
  const type = String(response.headers.get("content-type") || "");
  if (type.includes("json")) return response.json().catch(function () { return null; });
  return response.text().catch(function () { return ""; });
}

async function checkedFetch(url, options, timeoutMs) {
  let response;
  try { response = await supabase.fetchZOmejitvijo(url, options, timeoutMs || 20000); }
  catch (error) { throw new DatevError("DATEV je začasno nedosegljiv.", { code: "DATEV_NETWORK_FAILED", status: 503, retryable: true }); }
  const data = await responseData(response);
  if (!response.ok) {
    throw new DatevError("DATEV je zahtevek zavrnil.", {
      code: "DATEV_HTTP_" + response.status,
      status: response.status === 401 ? 401 : response.status === 429 || response.status >= 500 ? 503 : 422,
      retryable: response.status === 429 || response.status >= 500,
      details: data,
    });
  }
  return { response, data };
}

function tokenHeaders(cfg, token, extra) {
  return Object.assign({
    Authorization: "Bearer " + token,
    "X-DATEV-Client-Id": cfg.clientId,
    Accept: "application/json",
  }, extra || {});
}

async function exchangeCode(cfg, code, verifier) {
  const body = new URLSearchParams({
    grant_type: "authorization_code", code: String(code || ""), redirect_uri: cfg.redirectUri,
    code_verifier: String(verifier || ""),
  });
  const result = await checkedFetch(urls(cfg.mode).token, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Authorization: "Basic " + Buffer.from(cfg.clientId + ":" + cfg.clientSecret).toString("base64") }, body,
  }, 15000);
  return result.data || {};
}

async function refreshAccessToken(cfg, refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token", refresh_token: refreshToken,
  });
  const result = await checkedFetch(urls(cfg.mode).token, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Authorization: "Basic " + Buffer.from(cfg.clientId + ":" + cfg.clientSecret).toString("base64") }, body,
  }, 15000);
  return result.data || {};
}

async function revokeToken(cfg, token, hint) {
  if (!token) return;
  const body = new URLSearchParams({ token: String(token), token_type_hint: String(hint || "access_token") });
  await checkedFetch(urls(cfg.mode).revoke, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Authorization: "Basic " + Buffer.from(cfg.clientId + ":" + cfg.clientSecret).toString("base64") },
    body,
  }, 15000);
}

function normalizedClientId(consultantNumber, clientNumber) {
  const consultant = Number(consultantNumber);
  const client = Number(clientNumber);
  if (!Number.isInteger(consultant) || consultant < 1001 || consultant > 9999999 || !Number.isInteger(client) || client < 1 || client > 99999) {
    throw new DatevError("DATEV Beraternummer ali Mandantennummer ni veljavna.", { code: "DATEV_CLIENT_INVALID", status: 400 });
  }
  return consultant + "-" + client;
}

function hasBuchungsdatenservice(client) {
  return Boolean((client && client.services || []).some(function (service) {
    return service && (service.name === "Buchungsdatenservice" || (service.scopes || []).includes("datev:accounting:extf-files-import"));
  }));
}

async function getClient(cfg, token, consultantNumber, clientNumber) {
  const expected = normalizedClientId(consultantNumber, clientNumber);
  const target = urls(cfg.mode).clients + "/clients/" + encodeURIComponent(expected);
  const result = await checkedFetch(target, { headers: tokenHeaders(cfg, token) }, 15000);
  const client = result.data && !Array.isArray(result.data) ? result.data : null;
  if (!client || !hasBuchungsdatenservice(client)) {
    throw new DatevError("Izbrani DATEV mandant nima dovoljenja Buchungsdatenservice.", { code: "DATEV_PERMISSION_MISSING", status: 403 });
  }
  return client;
}

async function getDuoVersion(cfg, token, clientId) {
  const result = await checkedFetch(urls(cfg.mode).documents + "/clients/" + encodeURIComponent(clientId) + "/duo-version", {
    headers: tokenHeaders(cfg, token),
  }, 15000);
  return result.data || {};
}

function supportsDocumentExtension(duoVersion, extension) {
  const expected = String(extension || "").replace(/^\./, "").toLowerCase();
  const allowed = duoVersion && duoVersion.allowed_file_extensions;
  return Array.isArray(allowed) && allowed.some(function (value) { return String(value || "").replace(/^\./, "").toLowerCase() === expected; });
}

async function uploadDocument(cfg, token, clientId, document) {
  const form = new FormData();
  form.append("file", new Blob([document.content], { type: document.mediaType || "application/pdf" }), document.filename);
  form.append("metadata", new Blob([JSON.stringify(document.metadata || {})], { type: "application/json" }));
  const target = urls(cfg.mode).documents + "/clients/" + encodeURIComponent(clientId) + "/documents/" + encodeURIComponent(document.guid);
  try {
    const result = await checkedFetch(target, { method: "PUT", headers: tokenHeaders(cfg, token), body: form }, 30000);
    return result.data || { id: document.guid };
  } catch (error) {
    if (error.code === "DATEV_HTTP_409") return { id: document.guid, duplicate: true };
    throw error;
  }
}

async function uploadExtf(cfg, token, clientId, payload) {
  const target = urls(cfg.mode).extf + "/clients/" + encodeURIComponent(clientId) + "/extf-files/import";
  const result = await checkedFetch(target, {
    method: "POST",
    headers: tokenHeaders(cfg, token, {
      "Content-Type": "application/octet-stream",
      Filename: payload.filename,
      "Reference-Id": payload.referenceId,
      "Client-Application-Version": cfg.appVersion,
    }),
    body: Buffer.from(payload.content, "utf8"),
  }, 30000);
  const location = String(result.response.headers.get("location") || "");
  const retryAfter = Math.min(Math.max(Number(result.response.headers.get("retry-after") || 5), 1), 300);
  if (!location) throw new DatevError("DATEV ni vrnil povezave za preverjanje opravila.", { code: "DATEV_JOB_LOCATION_MISSING" });
  return { location, retryAfter, jobId: location.split("/").filter(Boolean).pop() || "" };
}

function safeJobUrl(cfg, location) {
  const base = new URL(urls(cfg.mode).extf + "/");
  const target = new URL(String(location || ""), base);
  if (target.origin !== base.origin || !target.pathname.startsWith(new URL(urls(cfg.mode).extf).pathname + "/clients/")) {
    throw new DatevError("DATEV je vrnil neveljavno povezavo opravila.", { code: "DATEV_JOB_LOCATION_INVALID" });
  }
  return target.toString();
}

async function getJob(cfg, token, location) {
  const result = await checkedFetch(safeJobUrl(cfg, location), { headers: tokenHeaders(cfg, token) }, 15000);
  const data = result.data || {};
  const raw = String(data.result || data.status || "processing").toLowerCase();
  return {
    status: raw === "success" || raw === "succeeded" ? "succeeded" : raw === "failed" || raw === "error" ? "failed" : "processing",
    code: String(data.error_code || data.code || ""),
    message: String(data.error_message || data.message || ""),
    raw: data,
  };
}

function mockClient(consultantNumber, clientNumber) {
  const id = normalizedClientId(consultantNumber, clientNumber);
  return {
    id, consultant_number: Number(consultantNumber), client_number: Number(clientNumber), name: "DATEV Sandbox Mandant",
    services: [
      { name: "Buchungsdatenservice", scopes: ["datev:accounting:extf-files-import"] },
      { name: "Belegbilderservice", scopes: ["accounting:documents"] },
    ],
  };
}

module.exports = {
  DatevError,
  authorizationUrl,
  configuration,
  decryptSecret,
  encryptSecret,
  exchangeCode,
  getClient,
  getDuoVersion,
  getJob,
  hasBuchungsdatenservice,
  mockClient,
  normalizedClientId,
  openState,
  refreshAccessToken,
  revokeToken,
  safeJobUrl,
  sealState,
  supportsDocumentExtension,
  tokenHeaders,
  uploadDocument,
  uploadExtf,
  urls,
  _test: { createPkce, decryptBuffer, encryptBuffer, environment, secretKey },
};
