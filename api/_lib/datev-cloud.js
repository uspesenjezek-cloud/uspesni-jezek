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
const MAX_ENCRYPTED_SECRET_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

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

function validRedirectUri(value) {
  try {
    const target = new URL(String(value || ""));
    return target.protocol === "https:" && !target.username && !target.password && !target.hash &&
      target.pathname === "/api/pos-datev" && target.searchParams.get("action") === "callback";
  } catch (_) { return false; }
}

function normalizedScopes(value) {
  const scopes = Array.from(new Set(String(value || DEFAULT_SCOPES.join(" ")).trim().split(/\s+/).filter(Boolean)));
  const invalid = scopes.length > 32 || scopes.some(function (scope) {
    return scope.length > 160 || !/^[A-Za-z0-9:._/-]+$/.test(scope);
  }) || DEFAULT_SCOPES.some(function (required) { return !scopes.includes(required); });
  if (invalid) throw new DatevError("DATEV OAuth scopes niso varno konfigurirani.", { code: "DATEV_NOT_CONFIGURED", status: 503 });
  return scopes;
}

function configuration(env) {
  const source = env || process.env;
  const mode = environment(source.DATEV_MODE);
  if (mode === "production") {
    throw new DatevError("Produkcijski DATEV prenos še ni omogočen.", {
      code: "DATEV_PRODUCTION_LOCKED",
      status: 409,
    });
  }
  const required = mode !== "mock";
  const clientId = String(source.DATEV_CLIENT_ID || "").trim();
  const clientSecret = String(source.DATEV_CLIENT_SECRET || "");
  const redirectUri = String(source.DATEV_REDIRECT_URI || "").trim();
  if (required && (!clientId || clientId.length > 200 || !clientSecret || Buffer.byteLength(clientSecret, "utf8") > 8192 || !validRedirectUri(redirectUri))) {
    throw new DatevError("DATEV sandbox nastavitve še niso izdane.", { code: "DATEV_NOT_CONFIGURED", status: 503 });
  }
  return {
    mode,
    clientId: clientId || "uj-datev-mock",
    clientSecret,
    redirectUri: redirectUri || "https://uspesni-jezek.vercel.app/api/pos-datev?action=callback",
    scopes: normalizedScopes(source.DATEV_SCOPES),
    tokenKey: secretKey(source.DATEV_TOKEN_ENCRYPTION_KEY, required),
    appVersion: String(source.DATEV_APP_VERSION || "1.0.0").slice(0, 40),
  };
}

function urls(mode) {
  if (environment(mode) === "production") {
    throw new DatevError("Produkcijski DATEV prenos še ni omogočen.", {
      code: "DATEV_PRODUCTION_LOCKED",
      status: 409,
    });
  }
  const sandbox = mode !== "production";
  return {
    issuer: sandbox ? "https://login.datev.de/openidsandbox" : "https://login.datev.de/openid",
    authorize: sandbox ? "https://login.datev.de/openidsandbox/authorize" : "https://login.datev.de/openid/authorize",
    token: sandbox ? "https://sandbox-api.datev.de/token" : "https://api.datev.de/token",
    revoke: sandbox ? "https://sandbox-api.datev.de/revoke" : "https://api.datev.de/revoke",
    clients: "https://accounting-clients.api.datev.de/" + (sandbox ? "platform-sandbox" : "platform") + "/v2",
    documents: "https://accounting-documents.api.datev.de/" + (sandbox ? "platform-sandbox" : "platform") + "/v2",
    extf: "https://accounting-extf-files.api.datev.de/" + (sandbox ? "platform-sandbox" : "platform") + "/v3",
  };
}

function safeOidcUrl(cfg, value) {
  const issuer = new URL(urls(cfg.mode).issuer + "/");
  const target = new URL(String(value || ""), issuer);
  if (target.protocol !== "https:" || target.origin !== issuer.origin || !target.pathname.startsWith(issuer.pathname)) {
    throw new DatevError("DATEV OIDC konfiguracija ni veljavna.", { code: "DATEV_OIDC_INVALID", status: 502 });
  }
  return target.toString();
}

async function validateIdToken(cfg, idToken, nonce) {
  const token = String(idToken || "");
  if (!token || Buffer.byteLength(token, "utf8") > 32 * 1024 || !String(nonce || "")) {
    throw new DatevError("DATEV identitetni žeton manjka.", { code: "DATEV_ID_TOKEN_INVALID", status: 502 });
  }
  const issuer = urls(cfg.mode).issuer;
  const discovery = await checkedFetch(safeOidcUrl(cfg, issuer + "/.well-known/openid-configuration"), {
    headers: { Accept: "application/json" },
  }, 15000);
  const metadata = discovery.data || {};
  if (String(metadata.issuer || "").replace(/\/$/, "") !== issuer || !metadata.jwks_uri) {
    throw new DatevError("DATEV OIDC konfiguracija ni veljavna.", { code: "DATEV_OIDC_INVALID", status: 502 });
  }
  const jwks = await checkedFetch(safeOidcUrl(cfg, metadata.jwks_uri), { headers: { Accept: "application/json" } }, 15000);
  if (!jwks.data || !Array.isArray(jwks.data.keys)) {
    throw new DatevError("DATEV podpisnih ključev ni bilo mogoče preveriti.", { code: "DATEV_OIDC_INVALID", status: 502 });
  }
  try {
    const jose = await import("jose");
    const verified = await jose.jwtVerify(token, jose.createLocalJWKSet(jwks.data), {
      issuer, audience: cfg.clientId,
    });
    if (!sameText(verified.payload.nonce, nonce)) throw new Error("nonce mismatch");
    return verified.payload;
  } catch (_) {
    throw new DatevError("DATEV identitetni žeton ni veljaven.", { code: "DATEV_ID_TOKEN_INVALID", status: 401 });
  }
}

function sameText(left, right) {
  const first = Buffer.from(String(left || ""), "utf8");
  const second = Buffer.from(String(right || ""), "utf8");
  return first.length > 0 && first.length === second.length && crypto.timingSafeEqual(first, second);
}

function encryptBuffer(key, buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function decryptBuffer(key, value) {
  if (Buffer.byteLength(String(value || ""), "utf8") > MAX_ENCRYPTED_SECRET_BYTES) {
    throw new DatevError("DATEV seja je prevelika.", { code: "DATEV_TOKEN_TOO_LARGE", status: 401 });
  }
  const payload = Buffer.from(String(value || ""), "base64url");
  if (payload.length < 29) throw new DatevError("DATEV seja je poškodovana.", { code: "DATEV_TOKEN_INVALID", status: 401 });
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
}

function encryptSecret(cfg, value) {
  if (!value) return "";
  const raw = Buffer.from(String(value), "utf8");
  if (raw.length > 8 * 1024) {
    throw new DatevError("DATEV žeton je prevelik.", { code: "DATEV_TOKEN_TOO_LARGE", status: 502 });
  }
  return encryptBuffer(cfg.tokenKey, raw);
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
  const nonce = crypto.randomBytes(24).toString("base64url");
  const state = sealState(cfg, Object.assign({}, values, { verifier: pkce.verifier, nonce }));
  const target = new URL(urls(cfg.mode).authorize);
  target.searchParams.set("client_id", cfg.clientId);
  target.searchParams.set("redirect_uri", cfg.redirectUri);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("scope", cfg.scopes.join(" "));
  target.searchParams.set("code_challenge", pkce.challenge);
  target.searchParams.set("code_challenge_method", "S256");
  target.searchParams.set("state", state);
  target.searchParams.set("nonce", nonce);
  target.searchParams.set("enableWindowsSso", "true");
  return target.toString();
}

async function responseBuffer(response) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new DatevError("DATEV odgovor je prevelik.", { code: "DATEV_RESPONSE_TOO_LARGE", status: 502 });
  }
  if (!response.body || typeof response.body.getReader !== "function") {
    const fallback = Buffer.from(await response.arrayBuffer());
    if (fallback.length > MAX_RESPONSE_BYTES) {
      throw new DatevError("DATEV odgovor je prevelik.", { code: "DATEV_RESPONSE_TOO_LARGE", status: 502 });
    }
    return fallback;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    const chunk = Buffer.from(part.value);
    total += chunk.length;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(function () {});
      throw new DatevError("DATEV odgovor je prevelik.", { code: "DATEV_RESPONSE_TOO_LARGE", status: 502 });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

async function responseData(response) {
  const body = (await responseBuffer(response)).toString("utf8");
  const type = String(response.headers.get("content-type") || "");
  if (type.includes("json")) { try { return JSON.parse(body); } catch (_) { return null; } }
  return body;
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
    return service && service.name === "Buchungsdatenservice" &&
      Array.isArray(service.scopes) && service.scopes.includes("datev:accounting:extf-files-import");
  }));
}

async function getClient(cfg, token, consultantNumber, clientNumber) {
  const expected = normalizedClientId(consultantNumber, clientNumber);
  const target = urls(cfg.mode).clients + "/clients/" + encodeURIComponent(expected);
  const result = await checkedFetch(target, { headers: tokenHeaders(cfg, token) }, 15000);
  const client = result.data && !Array.isArray(result.data) ? result.data : null;
  if (!client || String(client.id || "") !== expected || Number(client.consultant_number) !== Number(consultantNumber) ||
      Number(client.client_number) !== Number(clientNumber) || !hasBuchungsdatenservice(client)) {
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
  const retryAfter = parseRetryAfter(result.response.headers.get("retry-after"), 5);
  if (!location) throw new DatevError("DATEV ni vrnil povezave za preverjanje opravila.", { code: "DATEV_JOB_LOCATION_MISSING" });
  const safeLocation = safeJobUrl(cfg, location);
  const jobId = safeLocation.split("/").filter(Boolean).pop() || "";
  if (safeLocation.length > 500 || jobId.length > 240) {
    throw new DatevError("DATEV je vrnil predolgo povezavo opravila.", { code: "DATEV_JOB_LOCATION_INVALID" });
  }
  return { location: safeLocation, retryAfter, jobId };
}

function parseRetryAfter(value, fallback) {
  const defaultSeconds = Math.min(Math.max(Number(fallback) || 5, 1), 300);
  const raw = String(value || "").trim();
  if (!raw) return defaultSeconds;
  if (/^\d+$/.test(raw)) return Math.min(Math.max(Number(raw), 1), 300);
  const target = Date.parse(raw);
  if (!Number.isFinite(target)) return defaultSeconds;
  return Math.min(Math.max(Math.ceil((target - Date.now()) / 1000), 1), 300);
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
    retryAfter: parseRetryAfter(result.response.headers.get("retry-after"), 5),
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
  validateIdToken,
  urls,
  _test: {
    createPkce, decryptBuffer, encryptBuffer, environment, normalizedScopes, parseRetryAfter, responseData, safeOidcUrl,
    secretKey, validRedirectUri,
    MAX_ENCRYPTED_SECRET_BYTES, MAX_RESPONSE_BYTES,
  },
};
