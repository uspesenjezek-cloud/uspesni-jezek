"use strict";

const crypto = require("node:crypto");
const supabase = require("../_lib/supabase-server");
const stripeSandbox = require("../_lib/stripe-sandbox");

const MAX_BODY_BYTES = 1024 * 1024;
const TYPES = new Set([
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
]);

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
}

async function rawRequestBody(req) {
  if (Buffer.isBuffer(req.rawBody) || typeof req.rawBody === "string") {
    const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody, "utf8");
    if (raw.length > MAX_BODY_BYTES) { const error = new Error("Webhook je prevelik."); error.status = 413; throw error; }
    return raw.toString("utf8");
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += part.length;
    if (total > MAX_BODY_BYTES) { const error = new Error("Webhook je prevelik."); error.status = 413; throw error; }
    chunks.push(part);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function uuid(value) {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function objectId(value) { return typeof value === "string" ? value : value && value.id || ""; }

function eventCreatedAt(value) {
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return "";
  const date = new Date(seconds * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function normalizeEvent(event) {
  const object = event && event.data && event.data.object || {};
  const metadata = object.metadata || {};
  const base = {
    eventId: String(event && event.id || ""), eventType: String(event && event.type || ""),
    eventCreatedAt: eventCreatedAt(event && event.created),
    livemode: Boolean(event && event.livemode), userId: uuid(metadata.user_id), invoiceId: uuid(metadata.invoice_id),
    attemptId: uuid(metadata.provider_attempt_id), checkoutSessionId: "", paymentIntentId: "",
    amountCents: 0, currency: String(object.currency || "").toUpperCase(), paymentStatus: String(object.payment_status || object.status || ""),
    failureCode: "", refundedCents: 0,
  };
  if (base.eventType === "checkout.session.completed") {
    base.checkoutSessionId = String(object.id || "");
    base.paymentIntentId = objectId(object.payment_intent);
    base.amountCents = Number(object.amount_total || 0);
  } else if (base.eventType === "payment_intent.succeeded" || base.eventType === "payment_intent.payment_failed") {
    base.paymentIntentId = String(object.id || "");
    base.amountCents = Number(object.amount || object.amount_received || 0);
    base.failureCode = String(object.last_payment_error && (object.last_payment_error.code || object.last_payment_error.type) || "").slice(0, 120);
  } else if (base.eventType === "charge.refunded") {
    base.paymentIntentId = objectId(object.payment_intent);
    base.amountCents = Number(object.amount || 0);
    base.refundedCents = Number(object.amount_refunded || 0);
  }
  return base;
}

function rpcResult(value) { return Array.isArray(value) ? value[0] || null : value || null; }

async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, napaka: "Dovoljen je samo POST." });
  let stripeCfg;
  let serviceCfg;
  try { stripeCfg = stripeSandbox.configuration(); serviceCfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 503, { ok: false, code: error.code || "SERVER_NOT_CONFIGURED", napaka: error.message }); }
  let rawBody;
  try { rawBody = await rawRequestBody(req); }
  catch (error) { return json(res, error.status || 400, { ok: false, napaka: error.message }); }
  const signature = String(req.headers && req.headers["stripe-signature"] || "");
  const stripe = stripeSandbox.createClient(stripeCfg);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeCfg.webhookSecret);
  } catch (_) {
    return json(res, 400, { ok: false, code: "INVALID_WEBHOOK_SIGNATURE", napaka: "Stripe webhook podpis ni veljaven." });
  }
  if (event.livemode) return json(res, 400, { ok: false, code: "STRIPE_LIVE_EVENT_REJECTED", napaka: "Live Stripe dogodki so v Testbetrieb zaklenjeni." });
  if (!TYPES.has(event.type)) return json(res, 200, { ok: true, ignored: true });
  const normalized = normalizeEvent(event);
  if (normalized.eventType === "charge.refunded" && normalized.paymentIntentId && !normalized.attemptId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(normalized.paymentIntentId);
      const metadata = paymentIntent && paymentIntent.metadata || {};
      if (!paymentIntent || paymentIntent.livemode !== false || metadata.test_mode !== "true") throw new Error("Live ali nepovezan PaymentIntent.");
      normalized.userId = uuid(metadata.user_id);
      normalized.invoiceId = uuid(metadata.invoice_id);
      normalized.attemptId = uuid(metadata.provider_attempt_id);
      if (!normalized.userId || !normalized.invoiceId || !normalized.attemptId) throw new Error("Manjka Stripe TEST metadata.");
    } catch (_) {
      return json(res, 503, { ok: false, code: "STRIPE_REFUND_LOOKUP_FAILED", napaka: "Stripe povračila trenutno ni bilo mogoče povezati s testnim plačilom." });
    }
  }
  if (!normalized.eventId.startsWith("evt_") || normalized.eventId.length > 240 || !normalized.eventCreatedAt
      || normalized.checkoutSessionId.length > 240 || normalized.paymentIntentId.length > 240
      || normalized.paymentStatus.length > 120 || !Number.isSafeInteger(normalized.amountCents)
      || normalized.amountCents <= 0 || !Number.isSafeInteger(normalized.refundedCents)
      || normalized.refundedCents < 0 || normalized.refundedCents > normalized.amountCents
      || normalized.currency !== "EUR") {
    return json(res, 400, { ok: false, code: "INVALID_WEBHOOK_EVENT", napaka: "Stripe dogodek nima veljavnih podatkov." });
  }
  try {
    const result = rpcResult(await supabase.pokliciRpc(serviceCfg, "pos_apply_stripe_event", {
      p_event_id: normalized.eventId,
      p_event_type: normalized.eventType,
      p_event_created_at: normalized.eventCreatedAt,
      p_event_sha256: crypto.createHash("sha256").update(rawBody).digest("hex"),
      p_livemode: normalized.livemode,
      p_user_id: normalized.userId,
      p_invoice_id: normalized.invoiceId,
      p_provider_attempt_id: normalized.attemptId,
      p_checkout_session_id: normalized.checkoutSessionId,
      p_payment_intent_id: normalized.paymentIntentId,
      p_amount_cents: normalized.amountCents,
      p_currency: normalized.currency,
      p_payment_status: normalized.paymentStatus,
      p_failure_code: normalized.failureCode,
      p_refunded_cents: normalized.refundedCents,
    }));
    return json(res, 200, {
      ok: true, ignored: !result || result.matched !== true,
      duplicate: Boolean(result && result.duplicate), status: result && result.status || "",
    });
  } catch (error) {
    console.error("[pos-stripe-webhook]", String(error && (error.code || error.name) || "DATABASE_ERROR"), normalized.eventId.slice(0, 80));
    return json(res, 503, { ok: false, code: "STRIPE_EVENT_DATABASE_ERROR", napaka: "Stripe dogodka trenutno ni bilo mogoče varno shraniti." });
  }
}

module.exports = handler;
module.exports._test = { eventCreatedAt, normalizeEvent, rawRequestBody, uuid, MAX_BODY_BYTES };
