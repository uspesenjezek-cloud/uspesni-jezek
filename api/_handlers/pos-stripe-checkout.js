"use strict";

const supabase = require("../_lib/supabase-server");
const stripeSandbox = require("../_lib/stripe-sandbox");
const requestJson = require("../_lib/pos-request-json");
const requestQuery = require("../_lib/pos-request-query");
const MAX_BODY_BYTES = 16 * 1024;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
}

function uuid(value) {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : "";
}

function rpcRow(value) { return Array.isArray(value) ? value[0] || null : value || null; }

function effectivePaidCents(rows) {
  return (rows || []).reduce(function (sum, row) {
    if (!["succeeded", "partially_refunded"].includes(row.status || "succeeded")) return sum;
    return sum + Math.max(0, Number(row.amount_cents || 0) - Number(row.refunded_cents || 0));
  }, 0);
}

async function invoiceContext(cfg, userId, invoiceId) {
  const invoiceRows = await supabase.pridobiVrstice(cfg, "pos_invoices",
    "id=eq." + encodeURIComponent(invoiceId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=id,user_id,invoice_number,is_test,gross_cents,currency&limit=1");
  const invoice = invoiceRows[0];
  if (!invoice) { const error = new Error("Testni račun ne obstaja."); error.status = 404; throw error; }
  if (!invoice.is_test) { const error = new Error("Stripe sandbox je dovoljen samo za testni račun."); error.status = 409; throw error; }
  const [payments, financialAdjustments] = await Promise.all([
    supabase.pridobiVrstice(cfg, "pos_payments",
      "invoice_id=eq." + encodeURIComponent(invoiceId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=amount_cents,refunded_cents,status"),
    supabase.pridobiVrstice(cfg, "pos_invoice_adjustments",
      "original_invoice_id=eq." + encodeURIComponent(invoiceId) + "&user_id=eq." + encodeURIComponent(userId) + "&adjustment_type=in.(cancellation,credit_note)&select=id&limit=1"),
  ]);
  if (financialAdjustments.length) { const error = new Error("Računa po Stornu ali dobropisu ni mogoče dodatno plačati."); error.status = 409; throw error; }
  const outstandingCents = Number(invoice.gross_cents) - effectivePaidCents(payments);
  if (!Number.isSafeInteger(outstandingCents) || outstandingCents <= 0) {
    const error = new Error("Račun je že v celoti plačan."); error.status = 409; throw error;
  }
  return { invoice, outstandingCents };
}

async function paymentForSession(cfg, userId, sessionId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_payments",
    "checkout_session_id=eq." + encodeURIComponent(sessionId) + "&user_id=eq." + encodeURIComponent(userId) +
    "&provider=eq.stripe&select=id,invoice_id,amount_cents,currency,status,refunded_cents,failure_code,paid_at,expires_at,checkout_session_id,external_payment_id&limit=1");
  return rows[0] || null;
}

async function paymentForRefund(cfg, userId, invoiceId, paymentId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_payments",
    "id=eq." + encodeURIComponent(paymentId) + "&invoice_id=eq." + encodeURIComponent(invoiceId) +
    "&user_id=eq." + encodeURIComponent(userId) + "&provider=eq.stripe" +
    "&select=id,invoice_id,provider,amount_cents,currency,status,refunded_cents,failure_code,paid_at,expires_at,checkout_session_id,external_payment_id&limit=1");
  return rows[0] || null;
}

async function testInvoiceForRefund(cfg, userId, invoiceId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_invoices",
    "id=eq." + encodeURIComponent(invoiceId) + "&user_id=eq." + encodeURIComponent(userId) +
    "&is_test=eq.true&select=id,is_test&limit=1");
  return rows[0] || null;
}

function refundRequestCents(payment, requestedAmount) {
  if (!payment || !["succeeded", "partially_refunded"].includes(payment.status)) {
    const error = new Error("Povrniti je mogoče samo uspešno Stripe TEST plačilo.");
    error.status = 409;
    throw error;
  }
  const remaining = Number(payment.amount_cents || 0) - Number(payment.refunded_cents || 0);
  const amount = requestedAmount == null || requestedAmount === "" ? remaining : Number(requestedAmount);
  if (!Number.isSafeInteger(remaining) || remaining <= 0) {
    const error = new Error("Stripe TEST plačilo je že v celoti povrnjeno.");
    error.status = 409;
    throw error;
  }
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > remaining) {
    const error = new Error("Znesek TEST povračila ni veljaven.");
    error.status = 400;
    throw error;
  }
  return amount;
}

// A retry can arrive after the first request already advanced refunded_cents
// (or even fully refunded the payment). Keep the original strict helper for
// fresh UI validation, but let an explicit amount reach the idempotent DB
// request lookup; a new over-refund is still rejected under the invoice lock.
function refundAttemptCents(payment, requestedAmount) {
  try { return refundRequestCents(payment, requestedAmount); }
  catch (error) {
    const amount = Number(requestedAmount);
    const total = Number(payment && payment.amount_cents);
    if (requestedAmount !== null && requestedAmount !== ""
        && payment && ["succeeded", "partially_refunded", "refunded"].includes(payment.status)
        && Number.isSafeInteger(amount) && amount > 0
        && Number.isSafeInteger(total) && amount <= total) return amount;
    throw error;
  }
}

function publicPayment(row) {
  if (!row) return null;
  return {
    id: row.id, invoiceId: row.invoice_id, amountCents: Number(row.amount_cents), currency: row.currency,
    status: row.status, refundedCents: Number(row.refunded_cents || 0), failureCode: row.failure_code || "",
    paidAt: row.paid_at || null, expiresAt: row.expires_at || null,
  };
}

function sessionPaymentIntentId(session) {
  const intent = session && session.payment_intent;
  return typeof intent === "string" ? intent : intent && String(intent.id || "") || "";
}

function objectId(value) {
  return typeof value === "string" ? value : value && String(value.id || "") || "";
}

function assertTestRefund(refund, expected) {
  const metadata = refund && refund.metadata || {};
  const status = String(refund && refund.status || "");
  if (!refund || !/^re_[A-Za-z0-9_]+$/.test(String(refund.id || ""))
      || refund.livemode !== false
      || !["pending", "requires_action", "succeeded", "failed", "canceled"].includes(status)) {
    const error = new Error("Stripe ni vrnil veljavnega TEST povračila.");
    error.code = "STRIPE_REFUND_INVALID";
    throw error;
  }
  if (objectId(refund.payment_intent) !== expected.paymentIntentId
      || Number(refund.amount) !== Number(expected.amountCents)
      || String(refund.currency || "").toUpperCase() !== "EUR"
      || metadata.test_mode !== "true" || metadata.user_id !== expected.userId
      || metadata.invoice_id !== expected.invoiceId || metadata.payment_id !== expected.paymentId
      || metadata.request_id !== expected.requestId) {
    const error = new Error("Stripe TEST povračilo ni povezano s to zahtevo.");
    error.code = "STRIPE_REFUND_MISMATCH";
    throw error;
  }
  return refund;
}

async function authoritativeRefundSnapshot(stripe, paymentIntentId, expected) {
  const intent = stripeSandbox.assertTestPaymentIntent(
    await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] }),
    expected
  );
  if (String(intent.status || "") !== "succeeded") {
    const error = new Error("Stripe TEST plačilo ni v uspešnem stanju.");
    error.code = "STRIPE_PAYMENT_NOT_SUCCEEDED";
    throw error;
  }
  let charge = intent.latest_charge;
  if (typeof charge === "string") {
    if (!stripe.charges || typeof stripe.charges.retrieve !== "function") {
      const error = new Error("Stripe TEST plačilo nima razpoložljivega Charge stanja.");
      error.code = "STRIPE_CHARGE_LOOKUP_UNAVAILABLE";
      throw error;
    }
    charge = await stripe.charges.retrieve(charge);
  }
  const chargePaymentIntentId = objectId(charge && charge.payment_intent);
  const amountCents = Number(charge && charge.amount);
  const cumulativeRefundedCents = Number(charge && charge.amount_refunded);
  const currency = String(charge && charge.currency || "").toUpperCase();
  if (!charge || !/^ch_[A-Za-z0-9_]+$/.test(String(charge.id || ""))
      || charge.livemode !== false || chargePaymentIntentId !== paymentIntentId
      || !Number.isSafeInteger(amountCents) || amountCents !== Number(expected.amountCents)
      || currency !== "EUR" || !Number.isSafeInteger(cumulativeRefundedCents)
      || cumulativeRefundedCents < 0 || cumulativeRefundedCents > amountCents) {
    const error = new Error("Stripe TEST Charge nima veljavnega kumulativnega stanja povračil.");
    error.code = "STRIPE_REFUND_CHARGE_MISMATCH";
    throw error;
  }
  return { amountCents, cumulativeRefundedCents, currency };
}

async function reconcileSession(cfg, userId, payment, session) {
  const amountCents = Number(session && session.amount_total);
  const currency = String(session && session.currency || "").toUpperCase();
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents !== Number(payment.amount_cents)
      || currency !== String(payment.currency || "").toUpperCase()) {
    const error = new Error("Stripe TEST seja nima pričakovanega zneska ali valute.");
    error.code = "STRIPE_SESSION_AMOUNT_MISMATCH";
    error.status = 409;
    throw error;
  }
  return rpcRow(await supabase.pokliciRpc(cfg, "pos_reconcile_stripe_checkout", {
    p_user_id: userId,
    p_checkout_session_id: session.id,
    p_session_status: String(session.status || ""),
    p_payment_status: String(session.payment_status || ""),
    p_payment_intent_id: sessionPaymentIntentId(session),
    p_amount_cents: amountCents,
    p_currency: currency,
    p_observed_at: new Date().toISOString(),
  }));
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Dovoljena sta samo GET in POST." });
  let authCfg;
  let serviceCfg;
  let stripeCfg;
  try {
    authCfg = supabase.uporabniskaKonfiguracija();
    serviceCfg = supabase.konfiguracija();
    stripeCfg = stripeSandbox.configuration();
  } catch (error) {
    return json(res, 503, { ok: false, code: error.code || "SERVER_NOT_CONFIGURED", napaka: error.message });
  }
  const auth = await supabase.preveriUporabnika(req, authCfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  let body;
  try { body = requestJson(req, MAX_BODY_BYTES); }
  catch (error) { return json(res, error.status || 400, { ok: false, code: error.code || "POS_REQUEST_BODY_INVALID", napaka: error.message }); }
  const query = req.method === "GET" ? requestQuery(req) : null;
  const action = String(req.method === "GET" ? query.action || "status" : body.action || "create");
  const sessionId = String(req.method === "GET" ? query.sessionId || "" : body.sessionId || "");
  const stripe = stripeSandbox.createClient(stripeCfg);

  try {
    if (action === "refund") {
      const invoiceId = uuid(body.invoiceId);
      const paymentId = uuid(body.paymentId);
      const requestId = uuid(body.requestId);
      if (!invoiceId || !paymentId || !requestId || body.confirmed !== true) {
        return json(res, 400, { ok: false, napaka: "TEST povračilo potrebuje veljavno in izrecno potrditev." });
      }
      const [payment, invoice] = await Promise.all([
        paymentForRefund(serviceCfg, auth.user.id, invoiceId, paymentId),
        testInvoiceForRefund(serviceCfg, auth.user.id, invoiceId),
      ]);
      if (!payment || !invoice) return json(res, 404, { ok: false, napaka: "Stripe TEST plačilo ne obstaja." });
      const amountCents = refundAttemptCents(payment, body.amountCents);
      if (String(payment.currency || "").toUpperCase() !== "EUR") {
        return json(res, 409, { ok: false, napaka: "Stripe TEST povračilo podpira samo EUR plačila." });
      }
      const paymentIntentId = String(payment.external_payment_id || "");
      if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId) || paymentIntentId.length > 240) {
        return json(res, 409, { ok: false, napaka: "Stripe TEST plačilo nima veljavne povezave za povračilo." });
      }
      const expectedPayment = {
        userId: auth.user.id, invoiceId, amountCents: Number(payment.amount_cents),
      };
      stripeSandbox.assertTestPaymentIntent(await stripe.paymentIntents.retrieve(paymentIntentId), expectedPayment);

      const prepared = rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_prepare_stripe_refund", {
        p_user_id: auth.user.id,
        p_invoice_id: invoiceId,
        p_payment_id: paymentId,
        p_request_id: requestId,
        p_requested_cents: amountCents,
      }));
      if (!prepared || String(prepared.request_id || "") !== requestId
          || Number(prepared.requested_cents) !== amountCents) {
        const error = new Error("Baza ni potrdila varne Stripe refund zahteve.");
        error.code = "STRIPE_REFUND_PREPARE_CONTRACT_BROKEN";
        throw error;
      }

      const refund = assertTestRefund(await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountCents,
        reason: "requested_by_customer",
        metadata: {
          test_mode: "true",
          user_id: auth.user.id,
          invoice_id: invoiceId,
          payment_id: paymentId,
          request_id: requestId,
        },
      }, {
        idempotencyKey: "uj-pos-test-refund:" + auth.user.id + ":" + paymentId + ":" + requestId,
      }), {
        userId: auth.user.id, invoiceId, paymentId, requestId, paymentIntentId, amountCents,
      });

      // Do not manufacture a webhook event. Read Stripe's current Charge,
      // whose amount_refunded is cumulative, then commit that provider truth
      // through a service-only, invoice-first locked RPC.
      const snapshot = await authoritativeRefundSnapshot(stripe, paymentIntentId, expectedPayment);
      const reconciled = rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_reconcile_stripe_refund", {
        p_user_id: auth.user.id,
        p_invoice_id: invoiceId,
        p_payment_id: paymentId,
        p_request_id: requestId,
        p_provider_refund_id: refund.id,
        p_provider_status: refund.status,
        p_payment_intent_id: paymentIntentId,
        p_amount_cents: snapshot.amountCents,
        p_currency: snapshot.currency,
        p_cumulative_refunded_cents: snapshot.cumulativeRefundedCents,
        p_observed_at: new Date().toISOString(),
      }));
      if (!reconciled || String(reconciled.request_id || "") !== requestId
          || String(reconciled.provider_refund_id || "") !== refund.id || !reconciled.payment) {
        const error = new Error("Baza ni potrdila uskladitve Stripe povračila.");
        error.code = "STRIPE_REFUND_RECONCILE_CONTRACT_BROKEN";
        throw error;
      }

      return json(res, reconciled.state === "reconciled" ? 200 : 202, {
        ok: true,
        testMode: true,
        refund: { id: refund.id, status: refund.status, amountCents: Number(refund.amount), currency: String(refund.currency || "eur").toUpperCase() },
        reconciliation: { state: reconciled.state, cumulativeRefundedCents: snapshot.cumulativeRefundedCents },
        payment: publicPayment(reconciled.payment),
      });
    }

    if (action === "status" || action === "cancel" || action === "resume") {
      if (!sessionId.startsWith("cs_test_") || sessionId.length > 240) return json(res, 400, { ok: false, napaka: "Neveljavna Stripe TEST seja." });
      const payment = await paymentForSession(serviceCfg, auth.user.id, sessionId);
      if (!payment) return json(res, 404, { ok: false, napaka: "Stripe TEST plačilo ne obstaja." });
      let session = stripeSandbox.assertTestSession(await stripe.checkout.sessions.retrieve(sessionId), {
        userId: auth.user.id, invoiceId: payment.invoice_id,
      });
      if (action === "cancel") {
        if (session.status === "open" && session.payment_status !== "paid") {
          await stripe.checkout.sessions.expire(sessionId);
          session = stripeSandbox.assertTestSession(await stripe.checkout.sessions.retrieve(sessionId), {
            userId: auth.user.id, invoiceId: payment.invoice_id,
          });
        }
        const reconciled = await reconcileSession(serviceCfg, auth.user.id, payment, session);
        return json(res, 200, { ok: true, testMode: true, payment: publicPayment(reconciled) });
      }
      if (action === "resume") {
        if (session.status !== "open" || session.payment_status === "paid" || !session.url) {
          await reconcileSession(serviceCfg, auth.user.id, payment, session);
          return json(res, 409, { ok: false, napaka: "Stripe TEST seje ni več mogoče nadaljevati." });
        }
        const reconciled = await reconcileSession(serviceCfg, auth.user.id, payment, session);
        const checkoutUrl = new URL(session.url);
        if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") throw new Error("Stripe ni vrnil varnega Checkout naslova.");
        return json(res, 200, { ok: true, testMode: true, url: checkoutUrl.toString(), payment: publicPayment(reconciled) });
      }
      const reconciled = await reconcileSession(serviceCfg, auth.user.id, payment, session);
      return json(res, 200, {
        ok: true, testMode: true, payment: publicPayment(reconciled),
        checkout: { status: session.status, paymentStatus: session.payment_status },
      });
    }

    if (action !== "create") return json(res, 400, { ok: false, napaka: "Neznano Stripe opravilo." });
    const invoiceId = uuid(body.invoiceId);
    const requestId = uuid(body.requestId);
    if (!invoiceId || !requestId) return json(res, 400, { ok: false, napaka: "Manjka veljavna povezava z računom." });
    const context = await invoiceContext(serviceCfg, auth.user.id, invoiceId);
    // The browser request id is already a validated UUID. Reusing it as the
    // provider attempt id keeps a retried HTTP request bound to the same
    // Stripe idempotency result and the same database row.
    const attemptId = requestId;
    const params = stripeSandbox.checkoutParams({
      baseUrl: stripeSandbox.safeBaseUrl(req), invoiceId, invoiceNumber: context.invoice.invoice_number,
      userId: auth.user.id, attemptId, amountCents: context.outstandingCents,
    });
    const session = stripeSandbox.assertTestSession(await stripe.checkout.sessions.create(params, {
      idempotencyKey: "uj-pos-test:" + auth.user.id + ":" + invoiceId + ":" + requestId,
    }), { userId: auth.user.id, invoiceId, attemptId });
    let registered;
    try {
      registered = rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_register_stripe_checkout", {
        p_user_id: auth.user.id,
        p_invoice_id: invoiceId,
        p_provider_attempt_id: attemptId,
        p_checkout_session_id: session.id,
        p_amount_cents: context.outstandingCents,
        p_currency: "EUR",
        p_created_at: new Date(Number(session.created) * 1000).toISOString(),
        p_expires_at: new Date(Number(session.expires_at) * 1000).toISOString(),
      }));
    } catch (error) {
      try { if (session.status === "open") await stripe.checkout.sessions.expire(session.id); } catch (_) {}
      throw error;
    }
    const checkoutUrl = new URL(session.url);
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") throw new Error("Stripe ni vrnil varnega Checkout naslova.");
    return json(res, 201, { ok: true, testMode: true, url: checkoutUrl.toString(), payment: publicPayment(registered) });
  } catch (error) {
    console.error("[pos-stripe-checkout]", String(error && (error.code || error.type || error.name) || "UNKNOWN"));
    return json(res, error.status || 502, {
      ok: false, code: error.code || "STRIPE_CHECKOUT_FAILED",
      napaka: error.status ? error.message : "Stripe TEST plačila trenutno ni bilo mogoče pripraviti.",
    });
  }
}

module.exports = handler;
module.exports._test = {
  authoritativeRefundSnapshot,
  assertTestRefund,
  effectivePaidCents,
  publicPayment,
  refundAttemptCents,
  refundRequestCents,
  requestJson,
  sessionPaymentIntentId,
  uuid,
  MAX_BODY_BYTES,
};
