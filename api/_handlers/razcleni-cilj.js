"use strict";

var crypto = require("node:crypto");
var db = require("../_lib/supabase-server");
var parser = require("../_lib/cilj-naravni-vnos");
var localPreviewAuth = require("../_lib/atena-local-preview-auth");
var lunaPolicy = require("../_lib/atena-luna-policy");
var WINDOW_MS = 60000;
var MAX_REQUESTS = lunaPolicy.REQUESTS_PER_MINUTE;
var CACHE_TTL_MS = 300000;
var runtime = lunaPolicy.ensureIdempotencyRuntime(globalThis.__ujGoalAiRuntime || { users: new Map(), cache: new Map(), inflight: new Map() });
globalThis.__ujGoalAiRuntime = runtime;

function validRequestId(value) { return /^[a-zA-Z0-9][a-zA-Z0-9:_-]{15,99}$/.test(String(value || "")); }
function finiteDebt(value) { var number = Number(value); return Number.isFinite(number) && number > 0 && number <= 1000000000 ? Math.round(number * 100) / 100 : null; }
function validReferenceDate(value) { var text = String(value || ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; var date = new Date(text + "T12:00:00.000Z"); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null; }
function todayInLjubljana() { return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Ljubljana" }); }
function fingerprint(text, debt, referenceDate, clarificationRound) { return crypto.createHash("sha256").update(JSON.stringify([parser.CONTRACT_VERSION, text, debt, referenceDate, Number.isInteger(clarificationRound) ? clarificationRound : 0])).digest("hex"); }
function reserve(userId, now) { return lunaPolicy.reserveRateLimit(runtime.users, userId, now, WINDOW_MS, MAX_REQUESTS); }
function cleanup(now) { runtime.cache.forEach(function (entry, key) { if (now - entry.createdAt > CACHE_TTL_MS) runtime.cache.delete(key); }); runtime.users.forEach(function (entry, key) { if (now - entry.startedAt > WINDOW_MS * 2) runtime.users.delete(key); }); }

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", napaka: "Samo POST." });
  var cfg;
  try { cfg = db.uporabniskaKonfiguracija(); } catch (_error) { return res.status(500).json({ ok: false, code: "SERVER_CONFIGURATION", napaka: "Strežniška konfiguracija manjka." }); }
  var auth = localPreviewAuth.preveri(req) || await db.preveriUporabnika(req, cfg);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, code: auth.code || "AUTH_REQUIRED", retryable: auth.retryable === true, napaka: auth.napaka });
  var body = req.body && typeof req.body === "object" ? req.body : {};
  var requestId = String(body.requestId || "");
  var text = String(body.text || "").trim();
  var remainingDebt = finiteDebt(body.remainingDebt);
  var clarificationRound = body.clarificationRound == null ? 0 : Number(body.clarificationRound);
  var suppliedReferenceDate = body.referenceDate == null || body.referenceDate === "" ? null : validReferenceDate(body.referenceDate);
  var referenceDate = suppliedReferenceDate || todayInLjubljana();
  if (!validRequestId(requestId) || !text || text.length > parser.MAX_TEXT_LENGTH || !remainingDebt || !Number.isInteger(clarificationRound) ||
      clarificationRound < 0 || clarificationRound > parser.MAX_CLARIFICATION_ROUNDS || (body.referenceDate != null && body.referenceDate !== "" && !suppliedReferenceDate)) return res.status(400).json({ ok: false, code: "INVALID_INPUT", napaka: "Preverite opis, datum in stanje dolga." });
  var now = Date.now(); cleanup(now);
  var key = parser.CONTRACT_VERSION + ":" + auth.user.id + ":" + requestId;
  var requestFingerprint = fingerprint(text, remainingDebt, referenceDate, clarificationRound);
  var coordinator = lunaPolicy.createDistributedCoordinator({
    enabled: Boolean(auth.token) && auth.verification !== "local_preview_loopback",
    rpc: function (name, payload) { return db.pokliciRpcKotUporabnik(cfg, auth.token, name, payload); },
    key: key, requestId: requestId, kind: "goal", contractVersion: parser.CONTRACT_VERSION, fingerprint: requestFingerprint,
  });
  var outcome = await lunaPolicy.executeIdempotent(runtime, {
    key: key, fingerprint: requestFingerprint, coordinator: coordinator, fallbackMessage: "Cilja trenutno ni bilo mogoče razumeti.",
    beforeStart: function () { return reserve(auth.user.id, now) ? null : { statusCode: 429, payload: { ok: false, code: "RATE_LIMITED", retryable: true, napaka: "Preveč zaporednih zahtev. Poskusite znova čez minuto." } }; },
  }, async function () {
    var result = await parser.analyze(text, { remainingDebt: remainingDebt, referenceDate: referenceDate, clarificationRound: clarificationRound }, { userId: auth.user.id });
    var payload = { ok: true, requestId: requestId, referenceDate: referenceDate, engineVersion: parser.ATENA_ENGINE_VERSION, contractVersion: parser.CONTRACT_VERSION, model: parser.MODEL, semanticPlan: result.semanticPlan, summary: result.summary, goals: result.goals, clarification: result.clarification || null, clarificationExhausted: result.clarificationExhausted === true };
    return { statusCode: 200, payload: payload };
  });
  return res.status(outcome.statusCode).json(outcome.payload);
}

module.exports = handler;
module.exports._test = { validRequestId: validRequestId, finiteDebt: finiteDebt, validReferenceDate: validReferenceDate, fingerprint: fingerprint, runtime: runtime };
