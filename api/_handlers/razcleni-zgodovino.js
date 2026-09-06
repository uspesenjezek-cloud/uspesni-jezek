"use strict";

var crypto = require("node:crypto");
var db = require("../_lib/supabase-server");
var parser = require("../_lib/zgodovina-naravni-vnos");
var localPreviewAuth = require("../_lib/atena-local-preview-auth");
var lunaPolicy = require("../_lib/atena-luna-policy");

var WINDOW_MS = 60 * 1000;
var MAX_REQUESTS_PER_WINDOW = lunaPolicy.REQUESTS_PER_MINUTE;
var CACHE_TTL_MS = 5 * 60 * 1000;
var CONTENT_CACHE_TTL_MS = 5 * 60 * 1000;
var CONTENT_CACHE_MAX_ENTRIES = 100;
var CACHE_CONTRACT_VERSION = parser.CONTRACT_VERSION;
var runtime = lunaPolicy.ensureIdempotencyRuntime(globalThis.__ujZgodovinaAiRuntime || { users: new Map(), cache: new Map(), inflight: new Map() });
if (!runtime.contentCache) runtime.contentCache = new Map();
if (!runtime.contentInflight) runtime.contentInflight = new Map();
globalThis.__ujZgodovinaAiRuntime = runtime;

var CACHEABLE_SEMANTIC_STATUSES = new Set([
  "OK", "CORRECTED", "CLARIFICATION_REQUIRED", "VALIDATION_WARNING", "CLARIFICATION_EXHAUSTED",
]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function contentCacheKey(userId, fingerprint) {
  return CACHE_CONTRACT_VERSION + ":" + userId + ":content:" + fingerprint;
}

function cacheableContentResult(result) {
  return Boolean(result && result.semanticPlan && CACHEABLE_SEMANTIC_STATUSES.has(String(result.semanticPlan.status || "")));
}

function rememberContent(key, result) {
  if (runtime.contentCache.has(key)) runtime.contentCache.delete(key);
  while (runtime.contentCache.size >= CONTENT_CACHE_MAX_ENTRIES) {
    runtime.contentCache.delete(runtime.contentCache.keys().next().value);
  }
  runtime.contentCache.set(key, { createdAt: Date.now(), result: cloneJson(result) });
}

async function analyzeContentOnce(key, operation) {
  var cached = runtime.contentCache.get(key);
  if (cached) return cloneJson(cached.result);
  var active = runtime.contentInflight.get(key);
  if (active) return cloneJson(await active);
  var promise = Promise.resolve().then(operation).then(function (result) {
    if (cacheableContentResult(result)) rememberContent(key, result);
    return result;
  }).finally(function () {
    if (runtime.contentInflight.get(key) === promise) runtime.contentInflight.delete(key);
  });
  runtime.contentInflight.set(key, promise);
  return cloneJson(await promise);
}

function cleanRuntime(now) {
  runtime.cache.forEach(function (entry, key) {
    if (now - entry.createdAt > CACHE_TTL_MS) runtime.cache.delete(key);
  });
  runtime.contentCache.forEach(function (entry, key) {
    if (now - entry.createdAt > CONTENT_CACHE_TTL_MS) runtime.contentCache.delete(key);
  });
  runtime.users.forEach(function (entry, key) {
    if (now - entry.startedAt > WINDOW_MS * 2) runtime.users.delete(key);
  });
}

function reserve(userId, now) {
  return lunaPolicy.reserveRateLimit(runtime.users, userId, now, WINDOW_MS, MAX_REQUESTS_PER_WINDOW);
}

function validRequestId(value) {
  return /^[a-zA-Z0-9][a-zA-Z0-9:_-]{15,99}$/.test(String(value || ""));
}

function finiteDebt(value) {
  var number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 1000000000 ? Math.round(number * 100) / 100 : null;
}

function validReferenceDate(value) {
  var text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  var date = new Date(text + "T12:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
}

function todayInLjubljana(value) {
  var date = value instanceof Date ? value : new Date();
  var parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).reduce(function (result, part) {
    if (part.type === "year" || part.type === "month" || part.type === "day") result[part.type] = part.value;
    return result;
  }, {});
  return parts.year + "-" + parts.month + "-" + parts.day;
}

function requestFingerprint(text, originalDebt, remainingDebt, referenceDate, clarification) {
  return crypto.createHash("sha256").update(JSON.stringify([CACHE_CONTRACT_VERSION, text, originalDebt, remainingDebt, referenceDate, clarification || null])).digest("hex");
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", napaka: "Samo POST." });

  var cfg;
  try { cfg = db.uporabniskaKonfiguracija(); }
  catch (_error) { return res.status(500).json({ ok: false, code: "SERVER_CONFIGURATION", napaka: "Strežniška konfiguracija manjka." }); }

  var auth = localPreviewAuth.preveri(req) || await db.preveriUporabnika(req, cfg);
  if (!auth.ok) return res.status(auth.status).json({
    ok: false,
    code: auth.code || "AUTH_REQUIRED",
    retryable: auth.retryable === true,
    napaka: auth.napaka,
  });

  var body = req.body && typeof req.body === "object" ? req.body : {};
  var requestId = String(body.requestId || "");
  var text = String(body.text || "").trim();
  var originalDebt = finiteDebt(body.originalDebt);
  var remainingDebt = finiteDebt(body.remainingDebt);
  var clarification = body.clarification && typeof body.clarification === "object" ? {
    question: String(body.clarification.question || "").trim().slice(0, 181),
    answer: String(body.clarification.answer || "").trim().slice(0, parser.MAX_CLARIFICATION_ANSWER_LENGTH + 1),
    clauseId: String(body.clarification.clauseId || "").trim().slice(0, 81),
    round: Number(body.clarification.round),
  } : null;
  var suppliedReferenceDate = body.referenceDate == null || body.referenceDate === "" ? null : validReferenceDate(body.referenceDate);
  var referenceDate = suppliedReferenceDate || todayInLjubljana();
  var invalidClarification = clarification && (!clarification.question || clarification.question.length > 180 || !/^clause-\d+$/.test(clarification.clauseId) || !clarification.answer || clarification.answer.length > parser.MAX_CLARIFICATION_ANSWER_LENGTH || !Number.isInteger(clarification.round) || clarification.round < 1 || clarification.round > parser.MAX_CLARIFICATION_ROUNDS || text.length + 24 + clarification.answer.length > parser.MAX_TEXT_LENGTH);
  if (!validRequestId(requestId) || !text || text.length > parser.MAX_TEXT_LENGTH || !originalDebt || !remainingDebt || remainingDebt > originalDebt + 0.009 || invalidClarification || (body.referenceDate != null && body.referenceDate !== "" && !suppliedReferenceDate)) {
    return res.status(400).json({ ok: false, code: "INVALID_INPUT", napaka: "Preverite opis in stanje dolga." });
  }

  var now = Date.now();
  cleanRuntime(now);
  var cacheKey = CACHE_CONTRACT_VERSION + ":" + auth.user.id + ":" + requestId;
  var fingerprint = requestFingerprint(text, originalDebt, remainingDebt, referenceDate, clarification);
  var semanticContentKey = contentCacheKey(auth.user.id, fingerprint);
  var coordinator = lunaPolicy.createDistributedCoordinator({
    enabled: Boolean(auth.token) && auth.verification !== "local_preview_loopback",
    rpc: function (name, payload) { return db.pokliciRpcKotUporabnik(cfg, auth.token, name, payload); },
    key: cacheKey, requestId: requestId, kind: "history", contractVersion: CACHE_CONTRACT_VERSION, fingerprint: fingerprint,
  });
  var cached = runtime.cache.get(cacheKey);
  if (cached) {
    if (cached.fingerprint !== fingerprint) {
      return res.status(409).json({ ok: false, code: "REQUEST_ID_REUSED", napaka: "Ta zahteva je bila že uporabljena za drug opis." });
    }
    if (cached.outcome && cached.outcome.statusCode !== 200) return res.status(cached.outcome.statusCode).json(cached.outcome.payload);
    // Contract version je del cache ključa, zato je exact replay hkrati varen in
    // nujen: lokalni legacy parser ne sme ponovno razlagati Luninega compact plana.
    return res.json(cached.payload);
  }
  var outcome = await lunaPolicy.executeIdempotent(runtime, {
    key: cacheKey, fingerprint: fingerprint, coordinator: coordinator, fallbackMessage: "Besedila trenutno ni bilo mogoče razumeti.",
    beforeStart: function () {
      if (runtime.contentCache.has(semanticContentKey) || runtime.contentInflight.has(semanticContentKey)) return null;
      return reserve(auth.user.id, now) ? null : { statusCode: 429, payload: { ok: false, code: "RATE_LIMITED", retryable: true, napaka: "Preveč zaporednih zahtev. Poskusite znova čez minuto." } };
    },
  }, async function () {
    var analyzeOptions = { userId: auth.user.id };
    var result = await analyzeContentOnce(semanticContentKey, function () {
      return parser.analyze(text, {
        referenceDate: referenceDate,
        originalDebt: originalDebt,
        remainingDebt: remainingDebt,
        clarification: clarification,
      }, analyzeOptions);
    });
    if (process.env.NODE_ENV !== "production" && result.semanticPlan && result.semanticPlan.source !== "validated_canonical_plan") {
      console.warn("[history-ai-plan]", String(result.semanticPlan.source || "unknown"), String(result.semanticPlan.reason || "unknown"));
    }
    var payload = {
      ok: true,
      requestId: requestId,
      referenceDate: referenceDate,
      engineVersion: parser.ATENA_ENGINE_VERSION,
      contractVersion: CACHE_CONTRACT_VERSION,
      model: parser.MODEL,
      semanticPlan: result.semanticPlan || null,
      summary: result.summary,
      needsClarification: result.needsClarification,
      clarification: result.clarification || null,
      clarificationExhausted: result.clarificationExhausted === true,
      candidates: result.candidates,
      projectedRemainingDebtEur: result.projectedRemainingDebtEur,
      questionPlan: result.questionPlan,
      ledger: result.ledger,
      fieldOrder: result.fieldOrder,
      requiredFields: result.requiredFields,
      missing: result.missing,
    };
    return { statusCode: 200, payload: payload };
  });
  return res.status(outcome.statusCode).json(outcome.payload);
}

module.exports = handler;
module.exports._test = {
  validRequestId: validRequestId,
  finiteDebt: finiteDebt,
  validReferenceDate: validReferenceDate,
  todayInLjubljana: todayInLjubljana,
  requestFingerprint: requestFingerprint,
  contentCacheKey: contentCacheKey,
  cacheableContentResult: cacheableContentResult,
  analyzeContentOnce: analyzeContentOnce,
  reserve: reserve,
  runtime: runtime,
};
