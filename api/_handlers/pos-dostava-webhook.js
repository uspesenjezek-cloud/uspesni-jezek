"use strict";

const crypto = require("node:crypto");
const supabase = require("../_lib/supabase-server");

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const EVENT_TYPES = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
  "email.opened",
  "email.clicked",
]);

function json(res, status, body) {
  res.status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0")
    .end(JSON.stringify(body));
}

function header(req, name) {
  const value = req.headers && req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : String(value || "");
}

async function rawRequestBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString("utf8");
  if (typeof req.rawBody === "string") return req.rawBody;
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += part.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error("Webhook je prevelik.");
      error.status = 413;
      throw error;
    }
    chunks.push(part);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function webhookSecretBytes(secret) {
  const text = String(secret || "").trim();
  const encoded = text.startsWith("whsec_") ? text.slice(6) : text;
  if (!encoded) return null;
  try {
    const bytes = Buffer.from(encoded, "base64");
    return bytes.length >= 16 ? bytes : null;
  } catch (_) {
    return null;
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signatureValues(value) {
  return String(value || "").split(/\s+/).map(function (part) {
    const separator = part.indexOf(",");
    return separator > 0 && part.slice(0, separator) === "v1" ? part.slice(separator + 1) : "";
  }).filter(Boolean);
}

function verifySvixSignature(options) {
  const id = String(options && options.id || "");
  const timestamp = String(options && options.timestamp || "");
  const signatures = signatureValues(options && options.signature);
  const rawBody = String(options && options.rawBody || "");
  const secret = webhookSecretBytes(options && options.secret);
  const epoch = Number(timestamp);
  const nowSeconds = Number.isFinite(options && options.nowSeconds) ? options.nowSeconds : Math.floor(Date.now() / 1000);
  if (!id || !/^\d+$/.test(timestamp) || !signatures.length || !secret) return false;
  if (Math.abs(nowSeconds - epoch) > MAX_CLOCK_SKEW_SECONDS) return false;
  const signed = [id, timestamp, rawBody].join(".");
  const expected = crypto.createHmac("sha256", secret).update(signed).digest("base64");
  return signatures.some(function (candidate) { return safeEqual(candidate, expected); });
}

function eventTimestamp(payload) {
  const value = payload && (payload.created_at || payload.data && payload.data.created_at);
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function safeFailureCode(payload) {
  const data = payload && payload.data || {};
  const candidates = [
    data.bounce && (data.bounce.type || data.bounce.subType),
    data.failed && (data.failed.reason || data.failed.code),
    data.error && (data.error.code || data.error.type),
    data.reason,
  ];
  const value = candidates.filter(Boolean)[0];
  const code = String(value || "");
  return /^[a-zA-Z0-9_.:-]{1,120}$/.test(code) ? code : "";
}

function rpcResult(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value && typeof value === "object" ? value : null;
}

async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, napaka: "Dovoljen je samo POST." });
  const secret = String(process.env.RESEND_WEBHOOK_SECRET || "").trim();
  if (!secret) return json(res, 503, { ok: false, code: "WEBHOOK_NOT_CONFIGURED", napaka: "Webhook še ni konfiguriran." });

  const svixId = header(req, "svix-id");
  const svixTimestamp = header(req, "svix-timestamp");
  const svixSignature = header(req, "svix-signature");
  let rawBody;
  try { rawBody = await rawRequestBody(req); }
  catch (error) { return json(res, error.status || 400, { ok: false, napaka: error.message || "Webhooka ni bilo mogoče prebrati." }); }

  if (!verifySvixSignature({
    id: svixId,
    timestamp: svixTimestamp,
    signature: svixSignature,
    rawBody,
    secret,
  })) {
    return json(res, 401, { ok: false, code: "INVALID_WEBHOOK_SIGNATURE", napaka: "Podpis webhooka ni veljaven." });
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch (_) { return json(res, 400, { ok: false, code: "INVALID_WEBHOOK_BODY", napaka: "Webhook ni veljaven JSON." }); }
  const eventType = String(payload && payload.type || "");
  if (!EVENT_TYPES.has(eventType)) return json(res, 200, { ok: true, ignored: true });
  const emailId = String(payload && payload.data && payload.data.email_id || "").trim();
  const createdAt = eventTimestamp(payload);
  if (!emailId || emailId.length > 240 || !createdAt || !svixId || svixId.length > 240) {
    return json(res, 400, { ok: false, code: "INVALID_WEBHOOK_EVENT", napaka: "Webhooku manjkajo obvezni podatki." });
  }

  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 503, { ok: false, code: error.code || "SERVER_NOT_CONFIGURED", napaka: error.message }); }
  try {
    const rpcPayload = {
      p_svix_id: svixId,
      p_event_type: eventType,
      p_email_id: emailId,
      p_event_created_at: createdAt,
      p_failure_code: safeFailureCode(payload),
    };
    let result = rpcResult(await supabase.pokliciRpc(cfg, "pos_apply_resend_webhook_event", rpcPayload));
    if (!result || result.matched !== true) {
      result = rpcResult(await supabase.pokliciRpc(cfg, "pos_apply_resend_test_webhook_event", rpcPayload));
    }
    if (!result || result.matched !== true) {
      return json(res, 503, { ok: false, code: "DELIVERY_NOT_READY", napaka: "Dostava še ni pripravljena za dogodek." });
    }
    return json(res, 200, { ok: true, duplicate: Boolean(result.duplicate), status: result.status || "" });
  } catch (error) {
    console.error("[pos-dostava-webhook]", error && error.code || "WEBHOOK_DATABASE_ERROR", svixId.slice(0, 80));
    return json(res, 503, { ok: false, code: "WEBHOOK_DATABASE_ERROR", napaka: "Dogodka trenutno ni bilo mogoče shraniti." });
  }
}

module.exports = handler;
module.exports._test = {
  eventTimestamp,
  rawRequestBody,
  safeFailureCode,
  signatureValues,
  verifySvixSignature,
  webhookSecretBytes,
};
