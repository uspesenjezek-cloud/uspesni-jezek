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

function eventCreatedAt(value, nowMilliseconds) {
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return "";
  const date = new Date(seconds * 1000);
  const now = Number.isFinite(nowMilliseconds) ? nowMilliseconds : Date.now();
  return Number.isFinite(date.getTime()) && date.getTime() <= now + 5 * 60 * 1000 ? date.toISOString() : "";
}

function normalizeEvent(event) {
  const object = event && event.data && event.data.object || {};
  const metadata = object.metadata || {};
  const base = {
    eventId: String(event && event.id || ""), eventType: String(event && event.type || ""),
    eventCreatedAt: eventCreatedAt(event && event.created),
    livemode: Boolean(event && event.livemode), testMode: metadata.test_mode === "true",
    userId: uuid(metadata.user_id), invoiceId: uuid(metadata.invoice_id),
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

function sessionPaymentIntentId(session) {
  const intent = session && session.payment_intent;
  return typeof intent === "string" ? intent : intent && String(intent.id || "") || "";
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isTerminalSession(session) {
  return session.status !== "open" || session.payment_status === "paid";
}

// Reconciles ONE Checkout Session's Stripe-side truth into the database.
// Always retrieves and validates first; expires ONLY a session that is
// still open and unpaid; after expiring, re-retrieves and REQUIRES the
// session to have actually become terminal; then always reconciles —
// already-paid and already-expired competitors are synced too, never
// silently left behind.
async function reconcileSessionState(stripe, rpc, ctx, sessionId) {
  const expected = { userId: ctx.userId, invoiceId: ctx.invoiceId };
  if (ctx.attemptId) expected.attemptId = ctx.attemptId;

  let session = stripeSandbox.assertTestSession(await stripe.checkout.sessions.retrieve(sessionId), expected);
  if (String(session.id) !== sessionId) {
    throw fail("STRIPE_SESSION_MISMATCH", "Stripe je vrnil drugo sejo, kot je bila zahtevana.");
  }

  if (!isTerminalSession(session)) {
    await stripe.checkout.sessions.expire(sessionId);
    session = stripeSandbox.assertTestSession(await stripe.checkout.sessions.retrieve(sessionId), expected);
    if (!isTerminalSession(session)) {
      // Expire reported no error but the session is still payable. Stop
      // here: reconciling the original session now could complete a
      // payment while the customer can still pay the competitor.
      throw fail(
        "STRIPE_SESSION_STILL_OPEN",
        "Stripe seje ni bilo mogoče zapreti — ostaja odprta in neplačana."
      );
    }
  }

  const amountCents = Number(session.amount_total);
  const currency = String(session.currency || "").toUpperCase();
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || currency !== "EUR") {
    throw fail("STRIPE_SESSION_AMOUNT_INVALID", "Stripe seja nima veljavnega zneska ali valute.");
  }

  await rpc("pos_reconcile_stripe_checkout", {
    p_user_id: ctx.userId,
    p_checkout_session_id: session.id,
    p_session_status: String(session.status || ""),
    p_payment_status: String(session.payment_status || ""),
    p_payment_intent_id: sessionPaymentIntentId(session),
    p_amount_cents: amountCents,
    p_currency: currency,
    p_observed_at: new Date().toISOString(),
  });
  return session;
}

// Competitor first, then the original. The original webhook event is
// deduplicated and will never fire again on its own, so this is the only
// remaining path that can complete the original payment once the conflict
// is resolved.
async function reconcileCompetingAndOriginal(stripe, rpc, userId, result) {
  const competingSessionId = String(result.competing_checkout_session_id || "");
  const originalSessionId = String(result.original_checkout_session_id || "");
  const invoiceId = String(result.invoice_id || "");
  const competingAttemptId = uuid(result.competing_provider_attempt_id);
  const originalAttemptId = uuid(result.original_provider_attempt_id);

  if (!/^cs_test_[A-Za-z0-9_]+$/.test(competingSessionId)
      || !/^cs_test_[A-Za-z0-9_]+$/.test(originalSessionId)
      || !uuid(invoiceId) || !competingAttemptId || !originalAttemptId) {
    throw fail(
      "STRIPE_RECONCILIATION_CONTRACT_BROKEN",
      "RPC ni vrnil popolne Stripe TEST identitete za uskladitev."
    );
  }

  await reconcileSessionState(stripe, rpc, {
    userId,
    invoiceId,
    attemptId: competingAttemptId,
  }, competingSessionId);

  await reconcileSessionState(stripe, rpc, {
    userId,
    invoiceId,
    attemptId: originalAttemptId,
  }, originalSessionId);
}

function needsReconciliationFollowUp(result) {
  if (!result || result.failure_code !== "paid_requires_reconciliation") return false;
  // The valid no-competitor state is exactly the empty string. Any other
  // type/shape enters the follow-up path and fails closed in its contract
  // validator instead of being mistaken for "nothing to do".
  return result.competing_checkout_session_id !== "";
}

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
  if (normalized.eventType === "charge.refunded" && normalized.paymentIntentId
      && (!normalized.testMode || !normalized.userId || !normalized.invoiceId || !normalized.attemptId)) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(normalized.paymentIntentId);
      const metadata = paymentIntent && paymentIntent.metadata || {};
      if (!paymentIntent || paymentIntent.livemode !== false || metadata.test_mode !== "true") throw new Error("Live ali nepovezan PaymentIntent.");
      normalized.userId = uuid(metadata.user_id);
      normalized.invoiceId = uuid(metadata.invoice_id);
      normalized.attemptId = uuid(metadata.provider_attempt_id);
      normalized.testMode = true;
      if (!normalized.userId || !normalized.invoiceId || !normalized.attemptId) throw new Error("Manjka Stripe TEST metadata.");
    } catch (_) {
      return json(res, 503, { ok: false, code: "STRIPE_REFUND_LOOKUP_FAILED", napaka: "Stripe povračila trenutno ni bilo mogoče povezati s testnim plačilom." });
    }
  }
  if (!normalized.testMode) return json(res, 200, { ok: true, ignored: true });
  if (!normalized.eventId.startsWith("evt_") || normalized.eventId.length > 240 || !normalized.eventCreatedAt
      || !normalized.userId || !normalized.invoiceId || !normalized.attemptId
      || normalized.checkoutSessionId.length > 240 || normalized.paymentIntentId.length > 240
      || normalized.paymentStatus.length > 120 || !Number.isSafeInteger(normalized.amountCents)
      || normalized.amountCents <= 0 || !Number.isSafeInteger(normalized.refundedCents)
      || normalized.refundedCents < 0 || normalized.refundedCents > normalized.amountCents
      || normalized.currency !== "EUR") {
    return json(res, 400, { ok: false, code: "INVALID_WEBHOOK_EVENT", napaka: "Stripe dogodek nima veljavnih podatkov." });
  }

  const rpc = (name, args) => supabase.pokliciRpc(serviceCfg, name, args);

  let result;
  try {
    result = rpcResult(await rpc("pos_apply_stripe_event", {
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
  } catch (error) {
    console.error("[pos-stripe-webhook]", String(error && (error.code || error.name) || "DATABASE_ERROR"), normalized.eventId.slice(0, 80));
    return json(res, 503, { ok: false, code: "STRIPE_EVENT_DATABASE_ERROR", napaka: "Stripe dogodka trenutno ni bilo mogoče varno shraniti." });
  }
  if (!result || result.matched !== true) {
    return json(res, 503, { ok: false, code: "STRIPE_PAYMENT_NOT_READY", napaka: "Stripe TEST plačilo še ni pripravljeno za dogodek." });
  }

  if (needsReconciliationFollowUp(result)) {
    try {
      await reconcileCompetingAndOriginal(stripe, rpc, normalized.userId, result);
    } catch (error) {
      console.error(
        "[pos-stripe-webhook] reconciliation follow-up failed",
        String(error && (error.code || error.message) || error),
        normalized.eventId.slice(0, 80)
      );
      // Never write a cancellation or any other local state here. The 503
      // makes Stripe redeliver this exact event_id; the retry-stable
      // snapshot hands back the identical competing_/original_ identities,
      // so the retry
      // idempotently completes whatever is left.
      return json(res, 503, {
        ok: false,
        code: error && error.code === "STRIPE_RECONCILIATION_CONTRACT_BROKEN"
          ? "STRIPE_RECONCILIATION_CONTRACT_BROKEN"
          : "STRIPE_RECONCILIATION_FOLLOWUP_FAILED",
        napaka: "Uskladitev konkurenčne Stripe seje trenutno ni uspela. Stripe bo dogodek ponovil.",
      });
    }
  }

  return json(res, 200, {
    ok: true, ignored: false,
    duplicate: Boolean(result.duplicate), status: result.status || "",
  });
}

module.exports = handler;
module.exports._test = {
  eventCreatedAt,
  normalizeEvent,
  rawRequestBody,
  uuid,
  MAX_BODY_BYTES,
  isTerminalSession,
  needsReconciliationFollowUp,
  reconcileSessionState,
  reconcileCompetingAndOriginal,
};
