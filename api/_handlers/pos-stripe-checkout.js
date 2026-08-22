"use strict";

const supabase = require("../_lib/supabase-server");
const stripeSandbox = require("../_lib/stripe-sandbox");

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
}

function uuid(value) {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : "";
}

function requestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (_) {}
  }
  return {};
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
  const [payments, cancellations] = await Promise.all([
    supabase.pridobiVrstice(cfg, "pos_payments",
      "invoice_id=eq." + encodeURIComponent(invoiceId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=amount_cents,refunded_cents,status"),
    supabase.pridobiVrstice(cfg, "pos_invoice_adjustments",
      "original_invoice_id=eq." + encodeURIComponent(invoiceId) + "&user_id=eq." + encodeURIComponent(userId) + "&adjustment_type=eq.cancellation&select=id&limit=1"),
  ]);
  if (cancellations.length) { const error = new Error("Storniranega računa ni mogoče plačati."); error.status = 409; throw error; }
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

function publicPayment(row) {
  if (!row) return null;
  return {
    id: row.id, invoiceId: row.invoice_id, amountCents: Number(row.amount_cents), currency: row.currency,
    status: row.status, refundedCents: Number(row.refunded_cents || 0), failureCode: row.failure_code || "",
    paidAt: row.paid_at || null, expiresAt: row.expires_at || null,
  };
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
  const body = requestBody(req);
  const action = String(req.method === "GET" ? req.query && req.query.action || "status" : body.action || "create");
  const sessionId = String(req.method === "GET" ? req.query && req.query.sessionId || "" : body.sessionId || "");
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
      const amountCents = refundRequestCents(payment, body.amountCents);
      if (String(payment.currency || "").toUpperCase() !== "EUR") {
        return json(res, 409, { ok: false, napaka: "Stripe TEST povračilo podpira samo EUR plačila." });
      }
      const paymentIntentId = String(payment.external_payment_id || "");
      if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId) || paymentIntentId.length > 240) {
        return json(res, 409, { ok: false, napaka: "Stripe TEST plačilo nima veljavne povezave za povračilo." });
      }
      stripeSandbox.assertTestPaymentIntent(await stripe.paymentIntents.retrieve(paymentIntentId), {
        userId: auth.user.id, invoiceId, amountCents: Number(payment.amount_cents),
      });
      const refund = await stripe.refunds.create({
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
      });
      if (!refund || !String(refund.id || "").startsWith("re_")) {
        throw new Error("Stripe ni vrnil veljavnega TEST povračila.");
      }
      return json(res, 202, {
        ok: true,
        testMode: true,
        refund: { id: refund.id, status: refund.status, amountCents: Number(refund.amount), currency: String(refund.currency || "eur").toUpperCase() },
        payment: publicPayment(payment),
      });
    }

    if (action === "status" || action === "cancel" || action === "resume") {
      if (!sessionId.startsWith("cs_test_") || sessionId.length > 240) return json(res, 400, { ok: false, napaka: "Neveljavna Stripe TEST seja." });
      const payment = await paymentForSession(serviceCfg, auth.user.id, sessionId);
      if (!payment) return json(res, 404, { ok: false, napaka: "Stripe TEST plačilo ne obstaja." });
      const session = stripeSandbox.assertTestSession(await stripe.checkout.sessions.retrieve(sessionId), {
        userId: auth.user.id, invoiceId: payment.invoice_id,
      });
      if (action === "cancel" && !["succeeded", "partially_refunded", "refunded"].includes(payment.status)) {
        if (session.status === "open" && session.payment_status !== "paid") await stripe.checkout.sessions.expire(sessionId);
        const cancelled = rpcRow(await supabase.pokliciRpc(serviceCfg, "pos_cancel_stripe_checkout", {
          p_user_id: auth.user.id, p_checkout_session_id: sessionId, p_cancelled_at: new Date().toISOString(),
        }));
        return json(res, 200, { ok: true, testMode: true, payment: publicPayment(cancelled) });
      }
      if (action === "resume") {
        if (session.status !== "open" || session.payment_status === "paid" || !session.url) {
          return json(res, 409, { ok: false, napaka: "Stripe TEST seje ni več mogoče nadaljevati." });
        }
        const checkoutUrl = new URL(session.url);
        if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com") throw new Error("Stripe ni vrnil varnega Checkout naslova.");
        return json(res, 200, { ok: true, testMode: true, url: checkoutUrl.toString(), payment: publicPayment(payment) });
      }
      return json(res, 200, {
        ok: true, testMode: true, payment: publicPayment(payment),
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
module.exports._test = { effectivePaidCents, publicPayment, refundRequestCents, requestBody, uuid };
