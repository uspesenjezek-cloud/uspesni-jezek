"use strict";

const Stripe = require("stripe");

function clean(value) { return String(value == null ? "" : value).trim(); }

function configuration(env) {
  const source = env || process.env;
  const mode = clean(source.STRIPE_MODE || "test").toLowerCase();
  const secretKey = clean(source.STRIPE_SECRET_KEY);
  const webhookSecret = clean(source.STRIPE_WEBHOOK_SECRET);
  if (mode !== "test") {
    const error = new Error("Stripe produkcijski način je zaklenjen.");
    error.code = "STRIPE_LIVE_LOCKED";
    throw error;
  }
  if (!secretKey.startsWith("sk_test_")) {
    const error = new Error(secretKey.startsWith("sk_live_")
      ? "Stripe live ključ je v Testbetrieb prepovedan."
      : "Stripe TEST strežniški ključ še ni nastavljen.");
    error.code = secretKey.startsWith("sk_live_") ? "STRIPE_LIVE_KEY_REJECTED" : "STRIPE_NOT_CONFIGURED";
    throw error;
  }
  if (!webhookSecret.startsWith("whsec_") || webhookSecret.length < 16) {
    const error = new Error("Stripe TEST podpisni ključ webhooka še ni nastavljen.");
    error.code = "STRIPE_WEBHOOK_NOT_CONFIGURED";
    throw error;
  }
  return { mode, secretKey, webhookSecret };
}

function createClient(cfg, StripeConstructor) {
  const Constructor = StripeConstructor || Stripe;
  return new Constructor(cfg.secretKey, {
    appInfo: { name: "WerkTech Lab POS Testbetrieb", version: "1.0.0" },
    maxNetworkRetries: 2,
    timeout: 12000,
  });
}

function safeBaseUrl(req, env) {
  const source = env || process.env;
  const configured = clean(source.STRIPE_RETURN_BASE_URL);
  const vercelUrl = clean(source.VERCEL_URL);
  const forwarded = clean(req && req.headers && (req.headers["x-forwarded-host"] || req.headers.host)).split(",")[0];
  const candidate = configured || (vercelUrl ? "https://" + vercelUrl : forwarded ? "https://" + forwarded : "");
  let parsed;
  try { parsed = new URL(candidate); }
  catch (_) { parsed = null; }
  const localAllowed = source.NODE_ENV !== "production" && parsed && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  const vercelAllowed = parsed && (parsed.hostname === "uspesni-jezek.vercel.app" || parsed.hostname.endsWith(".vercel.app"));
  const configuredAllowed = Boolean(configured && parsed && parsed.protocol === "https:");
  if (!parsed || (!configuredAllowed && !vercelAllowed && !localAllowed) || (parsed.protocol !== "https:" && !localAllowed)) {
    const error = new Error("Varna Stripe povratna domena ni nastavljena.");
    error.code = "STRIPE_RETURN_URL_INVALID";
    throw error;
  }
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function checkoutMetadata(input) {
  return {
    invoice_id: clean(input.invoiceId),
    invoice_number: clean(input.invoiceNumber).slice(0, 80),
    user_id: clean(input.userId),
    merchant_id: clean(input.userId),
    provider_attempt_id: clean(input.attemptId),
    expected_amount: String(Number(input.amountCents)),
    currency: "EUR",
    test_mode: "true",
  };
}

function checkoutParams(input) {
  const metadata = checkoutMetadata(input);
  const success = new URL("/app/pos-terminal.html", input.baseUrl);
  success.searchParams.set("stripe", "success");
  success.searchParams.set("stripe_session_id", "{CHECKOUT_SESSION_ID}");
  success.searchParams.set("invoice_id", input.invoiceId);
  const cancel = new URL("/app/pos-terminal.html", input.baseUrl);
  cancel.searchParams.set("stripe", "cancelled");
  cancel.searchParams.set("invoice_id", input.invoiceId);
  return {
    mode: "payment",
    payment_method_types: ["card"],
    client_reference_id: input.invoiceId,
    locale: "de",
    submit_type: "pay",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: Number(input.amountCents),
        product_data: {
          name: "Testrechnung " + clean(input.invoiceNumber).slice(0, 80),
          description: "WerkTech Lab · Stripe Sandbox · kein echtes Geld",
        },
      },
    }],
    metadata,
    payment_intent_data: { metadata },
    success_url: success.toString(),
    cancel_url: cancel.toString(),
  };
}

function assertTestSession(session, expected) {
  const metadata = session && session.metadata || {};
  if (!session || !clean(session.id).startsWith("cs_test_") || session.livemode !== false) {
    const error = new Error("Stripe ni vrnil veljavne TEST seje.");
    error.code = "STRIPE_LIVE_SESSION_REJECTED";
    throw error;
  }
  if (metadata.test_mode !== "true" || metadata.user_id !== expected.userId || metadata.invoice_id !== expected.invoiceId) {
    const error = new Error("Stripe TEST seja ni povezana s tem računom.");
    error.code = "STRIPE_SESSION_MISMATCH";
    throw error;
  }
  return session;
}

module.exports = {
  assertTestSession,
  checkoutMetadata,
  checkoutParams,
  configuration,
  createClient,
  safeBaseUrl,
};
