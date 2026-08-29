"use strict";

var crypto = require("node:crypto");
var db = require("../_lib/supabase-server");
var parser = require("../_lib/zgodovina-naravni-vnos");

var WINDOW_MS = 60 * 1000;
var MAX_REQUESTS_PER_WINDOW = 12;
var CACHE_TTL_MS = 5 * 60 * 1000;
var CACHE_CONTRACT_VERSION = parser.CONTRACT_VERSION;
var runtime = globalThis.__ujZgodovinaAiRuntime || { users: new Map(), cache: new Map() };
globalThis.__ujZgodovinaAiRuntime = runtime;

function cleanRuntime(now) {
  runtime.cache.forEach(function (entry, key) {
    if (now - entry.createdAt > CACHE_TTL_MS) runtime.cache.delete(key);
  });
  runtime.users.forEach(function (entry, key) {
    if (now - entry.startedAt > WINDOW_MS * 2) runtime.users.delete(key);
  });
}

function reserve(userId, now) {
  var entry = runtime.users.get(userId);
  if (!entry || now - entry.startedAt >= WINDOW_MS) entry = { startedAt: now, count: 0 };
  entry.count += 1;
  runtime.users.set(userId, entry);
  return entry.count <= MAX_REQUESTS_PER_WINDOW;
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

  var auth = await db.preveriUporabnika(req, cfg);
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
  var cached = runtime.cache.get(cacheKey);
  if (cached) {
    if (cached.fingerprint !== fingerprint) {
      return res.status(409).json({ ok: false, code: "REQUEST_ID_REUSED", napaka: "Ta zahteva je bila že uporabljena za drug opis." });
    }
    if (cached.payload.clarification || cached.payload.clarificationExhausted || cached.payload.semanticPlan && cached.payload.semanticPlan.source === "validated_canonical_plan") return res.json(cached.payload);
    var revalidated = parser.normalizeResult({
      summary: cached.payload.summary,
      needsClarification: cached.payload.needsClarification,
      events: cached.payload.candidates,
    }, remainingDebt, {
      text: text,
      referenceDate: referenceDate,
      originalDebt: originalDebt,
      remainingDebt: remainingDebt,
    });
    cached.payload = Object.assign({}, cached.payload, {
      engineVersion: parser.ATENA_ENGINE_VERSION,
      contractVersion: CACHE_CONTRACT_VERSION,
      summary: revalidated.summary,
      needsClarification: revalidated.needsClarification,
      candidates: revalidated.candidates,
      projectedRemainingDebtEur: revalidated.projectedRemainingDebtEur,
      questionPlan: revalidated.questionPlan,
      ledger: revalidated.ledger,
      fieldOrder: revalidated.fieldOrder,
      requiredFields: revalidated.requiredFields,
      missing: revalidated.missing,
    });
    return res.json(cached.payload);
  }
  if (!reserve(auth.user.id, now)) {
    return res.status(429).json({ ok: false, code: "RATE_LIMITED", napaka: "Preveč zaporednih zahtev. Poskusite znova čez minuto." });
  }

  try {
    var analyzeOptions = { userId: auth.user.id };
    var result = await parser.analyze(text, {
      referenceDate: referenceDate,
      originalDebt: originalDebt,
      remainingDebt: remainingDebt,
      clarification: clarification,
    }, analyzeOptions);
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
    runtime.cache.set(cacheKey, { createdAt: now, fingerprint: fingerprint, payload: payload });
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 503).json({
      ok: false,
      code: error.code || "AI_UNAVAILABLE",
      napaka: error.message || "Besedila trenutno ni bilo mogoče razumeti.",
    });
  }
}

module.exports = handler;
module.exports._test = {
  validRequestId: validRequestId,
  finiteDebt: finiteDebt,
  validReferenceDate: validReferenceDate,
  todayInLjubljana: todayInLjubljana,
  requestFingerprint: requestFingerprint,
  reserve: reserve,
  runtime: runtime,
};
