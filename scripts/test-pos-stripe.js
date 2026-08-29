"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const stripeSandbox = require(path.join(root, "api", "_lib", "stripe-sandbox"));
const supabaseServer = require(path.join(root, "api", "_lib", "supabase-server"));
const checkoutHandler = require(path.join(root, "api", "_handlers", "pos-stripe-checkout"));
const checkout = checkoutHandler._test;
const stripeWebhookHandler = require(path.join(root, "api", "_handlers", "pos-stripe-webhook"));
const webhook = stripeWebhookHandler._test;
const posCore = require(path.join(root, "app", "pos-terminal.js"));
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260820204343_stripe_sandbox_invoice_payments.sql"), "utf8");
const monotonicRefundMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821230949_pos_stripe_refunds_monotonic.sql"), "utf8");
const paymentEventInvariantsMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260822013234_pos_payment_event_invariants.sql"), "utf8");
const router = fs.readFileSync(path.join(root, "api", "pos.js"), "utf8");
const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "pos-terminal.css"), "utf8");
const localServer = fs.readFileSync(path.join(root, "scripts", "local-server.js"), "utf8");

assert.match(localServer, /pathname === "\/api\/pos-stripe-checkout"[\s\S]*izvediLokalniApi\(req, res, posStripeCheckoutModul\)/);
assert.match(localServer, /pathname === "\/api\/pos-stripe-webhook"[\s\S]*izvediLokalniApi\(req, res, posStripeWebhookModul\)/);

assert.throws(() => stripeSandbox.configuration({}), /ključ še ni nastavljen/);
assert.throws(() => stripeSandbox.configuration({ STRIPE_MODE: "live", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_1234567890123456" }), /zaklenjen/);
assert.throws(() => stripeSandbox.configuration({ STRIPE_SECRET_KEY: "sk_live_forbidden", STRIPE_WEBHOOK_SECRET: "whsec_1234567890123456" }), /live ključ/);
assert.deepStrictEqual(stripeSandbox.configuration({
  STRIPE_MODE: "test", STRIPE_SECRET_KEY: "sk_test_example", STRIPE_WEBHOOK_SECRET: "whsec_1234567890123456",
}), { mode: "test", secretKey: "sk_test_example", webhookSecret: "whsec_1234567890123456" });
assert.strictEqual(stripeSandbox.safeBaseUrl({ headers: { host: "uspesni-jezek.vercel.app" } }, { NODE_ENV: "production" }), "https://uspesni-jezek.vercel.app");
assert.strictEqual(stripeSandbox.safeBaseUrl({ headers: { host: "attacker.invalid" } }, { NODE_ENV: "production", VERCEL_URL: "uspesni-jezek-git-pos-preview.vercel.app" }), "https://uspesni-jezek-git-pos-preview.vercel.app");
assert.strictEqual(stripeSandbox.safeBaseUrl({ headers: { host: "attacker.invalid" } }, { NODE_ENV: "production", STRIPE_RETURN_BASE_URL: "https://pos.example.de/path?q=1" }), "https://pos.example.de");
assert.throws(() => stripeSandbox.safeBaseUrl({ headers: { "x-forwarded-host": "attacker-preview.vercel.app", host: "uspesni-jezek.vercel.app" } }, { NODE_ENV: "production" }), /povratna domena/i);
assert.throws(() => stripeSandbox.safeBaseUrl({ headers: { host: "attacker.invalid" } }, { NODE_ENV: "production" }), /povratna domena/i);
assert.strictEqual(stripeSandbox.assertTestPaymentIntent({
  id: "pi_test_refund", livemode: false, amount: 11900, currency: "eur",
  metadata: { test_mode: "true", user_id: "user-1", invoice_id: "invoice-1" },
}, { userId: "user-1", invoiceId: "invoice-1", amountCents: 11900 }).id, "pi_test_refund");
assert.throws(() => stripeSandbox.assertTestPaymentIntent({
  id: "pi_test_refund", livemode: false, amount: 11900, currency: "eur",
  metadata: { test_mode: "true", user_id: "someone-else", invoice_id: "invoice-1" },
}, { userId: "user-1", invoiceId: "invoice-1", amountCents: 11900 }), /ni povezano/);
assert.throws(() => stripeSandbox.assertTestPaymentIntent({
  id: "pi_test_refund", livemode: false, amount: 11899, currency: "eur",
  metadata: { test_mode: "true", user_id: "user-1", invoice_id: "invoice-1" },
}, { userId: "user-1", invoiceId: "invoice-1", amountCents: 11900 }), /pričakovanega zneska/);

const params = stripeSandbox.checkoutParams({
  baseUrl: "https://uspesni-jezek.vercel.app", invoiceId: "11111111-1111-4111-8111-111111111111",
  invoiceNumber: "TEST-2026-0001", userId: "22222222-2222-4222-8222-222222222222",
  attemptId: "33333333-3333-4333-8333-333333333333", amountCents: 11900,
});
assert.strictEqual(params.mode, "payment");
assert.deepStrictEqual(params.payment_method_types, ["card"]);
assert.strictEqual(params.line_items[0].price_data.unit_amount, 11900);
assert.strictEqual(params.metadata.expected_amount, "11900");
assert.strictEqual(params.metadata.test_mode, "true");
assert.strictEqual(params.payment_intent_data.metadata.invoice_id, params.metadata.invoice_id);
assert.match(params.success_url, /stripe=success/);
assert.match(params.success_url, /stripe_session_id=\{CHECKOUT_SESSION_ID\}/);
assert.doesNotMatch(params.success_url, /%7BCHECKOUT_SESSION_ID%7D/);
assert.match(params.cancel_url, /stripe=cancelled/);
assert.doesNotMatch(params.cancel_url, /CHECKOUT_SESSION_ID|stripe_session_id/);
assert.match(params.cancel_url, /invoice_id=11111111-1111-4111-8111-111111111111/);
const checkoutSession = {
  id: "cs_test_retry_safe", livemode: false, metadata: params.metadata,
};
assert.strictEqual(stripeSandbox.assertTestSession(checkoutSession, {
  userId: params.metadata.user_id,
  invoiceId: params.metadata.invoice_id,
  attemptId: params.metadata.provider_attempt_id,
}).id, checkoutSession.id);
assert.throws(() => stripeSandbox.assertTestSession(checkoutSession, {
  userId: params.metadata.user_id,
  invoiceId: params.metadata.invoice_id,
  attemptId: "44444444-4444-4444-8444-444444444444",
}), /ni povezana/);

assert.strictEqual(checkout.effectivePaidCents([
  { amount_cents: 10000, refunded_cents: 2500, status: "partially_refunded" },
  { amount_cents: 1900, refunded_cents: 0, status: "pending" },
  { amount_cents: 2500, refunded_cents: 0, status: "succeeded" },
]), 10000);
assert.strictEqual(checkout.effectivePaidCents([{ amount_cents: 11900, refunded_cents: 11900, status: "refunded" }]), 0);
assert.strictEqual(checkout.refundRequestCents({ amount_cents: 11900, refunded_cents: 0, status: "succeeded" }), 11900);
assert.strictEqual(checkout.refundRequestCents({ amount_cents: 11900, refunded_cents: 1900, status: "partially_refunded" }, 2500), 2500);
assert.throws(() => checkout.refundRequestCents({ amount_cents: 11900, refunded_cents: 11900, status: "refunded" }), /uspešno Stripe TEST plačilo/);
assert.throws(() => checkout.refundRequestCents({ amount_cents: 11900, refunded_cents: 1900, status: "partially_refunded" }, 10001), /ni veljaven/);
assert.deepStrictEqual(checkout.requestJson({ headers: {}, body: { action: "status" } }, checkout.MAX_BODY_BYTES), { action: "status" });
assert.throws(
  () => checkout.requestJson({ headers: { "content-length": String(checkout.MAX_BODY_BYTES + 1) }, body: {} }, checkout.MAX_BODY_BYTES),
  function (error) { return error && error.status === 413 && error.code === "POS_REQUEST_BODY_TOO_LARGE"; }
);
assert.throws(
  () => checkout.requestJson({ headers: {}, body: "x".repeat(checkout.MAX_BODY_BYTES + 1) }, checkout.MAX_BODY_BYTES),
  function (error) { return error && error.status === 413 && error.code === "POS_REQUEST_BODY_TOO_LARGE"; }
);
assert.throws(
  () => checkout.requestJson({ headers: {}, body: "not-json" }, checkout.MAX_BODY_BYTES),
  function (error) { return error && error.status === 400 && error.code === "POS_REQUEST_BODY_INVALID"; }
);
assert.throws(
  () => checkout.requestJson({ headers: {}, body: [] }, checkout.MAX_BODY_BYTES),
  function (error) { return error && error.status === 400 && error.code === "POS_REQUEST_BODY_INVALID"; }
);
assert.throws(
  () => checkout.requestJson({ headers: {}, body: "true" }, checkout.MAX_BODY_BYTES),
  function (error) { return error && error.status === 400 && error.code === "POS_REQUEST_BODY_INVALID"; }
);
assert.deepStrictEqual(posCore.validateRefundAmountInput("25,00", 11900), { amountCents: 2500, error: "" });
assert.match(posCore.validateRefundAmountInput("0", 11900).error, /večji od 0/);
assert.match(posCore.validateRefundAmountInput("120,00", 11900).error, /119,00/);
assert.match(posCore.stripeReturnMessage("succeeded"), /potrjeno s podpisanim webhookom/);
assert.doesNotMatch(posCore.stripeReturnMessage("succeeded"), /neveljavna|čaka/i);
assert.match(posCore.stripeReturnMessage("partially_refunded"), /del zneska je že povrnjen/);
assert.match(posCore.stripeReturnMessage("refunded"), /v celoti povrnjeno/);
assert.match(posCore.stripeReturnMessage("pending"), /čaka na podpisano potrditev/);

const baseEvent = { id: "evt_test", created: 1787248800, livemode: false };
const metadata = {
  user_id: "22222222-2222-4222-8222-222222222222",
  invoice_id: "11111111-1111-4111-8111-111111111111",
  provider_attempt_id: "33333333-3333-4333-8333-333333333333",
};
const succeeded = webhook.normalizeEvent(Object.assign({}, baseEvent, {
  type: "payment_intent.succeeded",
  data: { object: { id: "pi_test", amount: 11900, currency: "eur", status: "succeeded", metadata } },
}));
assert.deepStrictEqual({ amount: succeeded.amountCents, currency: succeeded.currency, paymentIntent: succeeded.paymentIntentId }, {
  amount: 11900, currency: "EUR", paymentIntent: "pi_test",
});
assert.strictEqual(succeeded.userId, metadata.user_id);
assert.strictEqual(succeeded.attemptId, metadata.provider_attempt_id);
assert.strictEqual(succeeded.testMode, false);
const succeededTestMode = webhook.normalizeEvent(Object.assign({}, baseEvent, {
  type: "payment_intent.succeeded",
  data: { object: { id: "pi_test", amount: 11900, currency: "eur", status: "succeeded", metadata: Object.assign({ test_mode: "true" }, metadata) } },
}));
assert.strictEqual(succeededTestMode.testMode, true);
const failed = webhook.normalizeEvent(Object.assign({}, baseEvent, {
  type: "payment_intent.payment_failed",
  data: { object: { id: "pi_test", amount: 11900, currency: "eur", status: "requires_payment_method", metadata, last_payment_error: { code: "card_declined" } } },
}));
assert.strictEqual(failed.failureCode, "card_declined");
const refunded = webhook.normalizeEvent(Object.assign({}, baseEvent, {
  type: "charge.refunded",
  data: { object: { id: "ch_test", amount: 11900, amount_refunded: 11900, currency: "eur", payment_intent: "pi_test", metadata: {} } },
}));
assert.strictEqual(refunded.refundedCents, 11900);
assert.strictEqual(refunded.paymentIntentId, "pi_test");
assert.strictEqual(webhook.eventCreatedAt("ni-cas"), "");
const fixedNow = Date.parse("2026-08-21T12:00:00.000Z");
assert.strictEqual(webhook.eventCreatedAt(String(fixedNow / 1000 + 301), fixedNow), "");
assert.strictEqual(webhook.eventCreatedAt(String(fixedNow / 1000 + 300), fixedNow), "2026-08-21T12:05:00.000Z");

assert.match(migration, /alter table public\.pos_payments[\s\S]*add column status text not null default 'succeeded'/i);
assert.match(migration, /create table public\.pos_payment_events/i);
assert.match(migration, /unique \(provider, external_event_id\)/i);
assert.match(migration, /p_livemode[\s\S]*Live Stripe dogodki so zaklenjeni/i);
assert.match(migration, /p_amount_cents <> v_payment\.amount_cents/i);
assert.match(migration, /grant execute on function public\.pos_apply_stripe_event[\s\S]*to service_role/i);
assert.doesNotMatch(migration, /grant execute on function public\.pos_apply_stripe_event[\s\S]*to authenticated/i);
assert.match(migration, /private\._pos_effective_paid_cents/i);
assert.match(monotonicRefundMigration, /create or replace function private\.pos_preserve_refund_progress\(\)/i);
assert.match(monotonicRefundMigration, /new\.refunded_cents < old\.refunded_cents[\s\S]*new\.refunded_cents := old\.refunded_cents/i);
assert.match(monotonicRefundMigration, /new\.refunded_cents = new\.amount_cents[\s\S]*new\.status := 'refunded'/i);
assert.match(monotonicRefundMigration, /create trigger pos_payments_refund_monotonic[\s\S]*before update on public\.pos_payments/i);
assert.match(monotonicRefundMigration, /revoke all on function private\.pos_preserve_refund_progress\(\) from public, anon, authenticated/i);
assert.match(paymentEventInvariantsMigration, /pos_payment_events_source_shape_check/i);
assert.match(paymentEventInvariantsMigration, /external_event_id ~ '\^evt_\[A-Za-z0-9_\]\+\$'/i);
assert.match(paymentEventInvariantsMigration, /event_created_at <= processed_at \+ interval '5 minutes'/i);
assert.match(paymentEventInvariantsMigration, /summary->'test_mode' = 'true'::jsonb/i);
assert.match(paymentEventInvariantsMigration, /v_payment\.provider is distinct from 'stripe'/i);
assert.match(paymentEventInvariantsMigration, /v_payment\.method is distinct from 'stripe_card'/i);
assert.match(paymentEventInvariantsMigration, /new\.event_created_at < v_payment\.created_at - interval '5 minutes'/i);
assert.match(paymentEventInvariantsMigration, /create trigger pos_payment_events_validate_source[\s\S]*before insert on public\.pos_payment_events/i);
assert.match(paymentEventInvariantsMigration, /validate constraint pos_payment_events_source_shape_check/i);
assert.match(router, /"stripe-checkout": require\("\.\/_handlers\/pos-stripe-checkout"\)/);
assert.match(router, /"stripe-webhook": require\("\.\/_handlers\/pos-stripe-webhook"\)/);
const checkoutHandlerSource = fs.readFileSync(path.join(root, "api", "_handlers", "pos-stripe-checkout.js"), "utf8");
assert.match(checkoutHandlerSource, /stripe\.refunds\.create/);
assert.match(checkoutHandlerSource, /const attemptId = requestId;/);
assert.match(checkoutHandlerSource, /assertTestSession[\s\S]*\{ userId: auth\.user\.id, invoiceId, attemptId \}/);
assert.match(vercel, /\/api\/pos-stripe-checkout/);
assert.match(vercel, /\/api\/pos-stripe-webhook/);
assert.match(html, /Plačaj s kartico – TEST/);
assert.match(html, /SANDBOX · TEST/);
assert.match(js, /handleStripeReturn/);
assert.match(js, /status === "succeeded"/);
assert.match(js, /data-stripe-refund/);
assert.match(js, /stripeCheckoutRequest\("refund"/);
assert.match(html, /Vrni plačilo – TEST/);
assert.match(html, /data-dialog-input/);
assert.match(js, /Znesek povračila/);
assert.match(js, /validateRefundAmountInput\(value, refundableCents\)/);
assert.match(js, /onConfirm: async function \(value\)/);
assert.match(css, /\.pos-dialog__field\[hidden\] \{ display: none; \}/);
assert.match(css, /font: 700 1rem\/1\.2/);
assert.match(css, /\.pos-stripe-test\[hidden\], \.pos-stripe-test__refund\[hidden\] \{ display: none; \}/);
const stripeTheme = css.slice(css.indexOf(".pos-stripe-test {"), css.indexOf(".pos-replacement-banner"));
assert.match(stripeTheme, /border: 1px solid #bfd2df/);
assert.match(stripeTheme, /background: linear-gradient\(145deg, #f1f6fa, #fff\)/);
assert.match(stripeTheme, /\.pos-stripe-test__button \{[^}]*background: #567392/);
assert.match(stripeTheme, /\.pos-stripe-test__refund \{[^}]*color: #405f7e; border-color: #bfd2df/);
assert.doesNotMatch(stripeTheme, /#635bff|#564ee8|#5e4d87|#d8d1f3|#eee9f8|#faf8ff|#786f91/);
assert.doesNotMatch(js, /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|sk_test_|whsec_/);

function stripeWebhookResponse() {
  return {
    statusCode: 0, headers: {}, body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    end(value) { this.body = value ? JSON.parse(value) : null; return this; },
  };
}

async function testWebhookRetryRace() {
  const originals = {
    serviceConfiguration: supabaseServer.konfiguracija,
    rpc: supabaseServer.pokliciRpc,
    stripeConfiguration: stripeSandbox.configuration,
    createClient: stripeSandbox.createClient,
  };
  const now = Math.floor(Date.now() / 1000);
  const ownedMetadata = {
    test_mode: "true",
    user_id: "22222222-2222-4222-8222-222222222222",
    invoice_id: "11111111-1111-4111-8111-111111111111",
    provider_attempt_id: "33333333-3333-4333-8333-333333333333",
  };
  let currentEvent;
  let rpcResult = { matched: false, duplicate: false };
  let rpcCalls = 0;
  try {
    supabaseServer.konfiguracija = () => ({ service: true });
    supabaseServer.pokliciRpc = async () => { rpcCalls += 1; return rpcResult; };
    stripeSandbox.configuration = () => ({ mode: "test", secretKey: "sk_test_mock", webhookSecret: "whsec_mock_mock" });
    stripeSandbox.createClient = () => ({
      webhooks: { constructEvent: () => currentEvent },
      paymentIntents: { retrieve: async () => { throw new Error("lookup ni pričakovan"); } },
    });

    currentEvent = {
      id: "evt_owned_before_registration", type: "payment_intent.succeeded", created: now, livemode: false,
      data: { object: { id: "pi_owned", amount: 11900, currency: "eur", status: "succeeded", metadata: ownedMetadata } },
    };
    const retryResponse = stripeWebhookResponse();
    await stripeWebhookHandler({ method: "POST", headers: { "stripe-signature": "test" }, rawBody: "{}" }, retryResponse);
    assert.strictEqual(retryResponse.statusCode, 503);
    assert.strictEqual(retryResponse.body.code, "STRIPE_PAYMENT_NOT_READY");

    currentEvent = {
      id: "evt_foreign_test_event", type: "payment_intent.succeeded", created: now, livemode: false,
      data: { object: { id: "pi_foreign", amount: 500, currency: "eur", status: "succeeded", metadata: {} } },
    };
    const ignoredResponse = stripeWebhookResponse();
    await stripeWebhookHandler({ method: "POST", headers: { "stripe-signature": "test" }, rawBody: "{}" }, ignoredResponse);
    assert.strictEqual(ignoredResponse.statusCode, 200);
    assert.strictEqual(ignoredResponse.body.ignored, true);

    rpcResult = { matched: true, duplicate: false, status: "succeeded" };
    currentEvent = {
      id: "evt_owned_after_registration", type: "payment_intent.succeeded", created: now, livemode: false,
      data: { object: { id: "pi_owned", amount: 11900, currency: "eur", status: "succeeded", metadata: ownedMetadata } },
    };
    const acceptedResponse = stripeWebhookResponse();
    await stripeWebhookHandler({ method: "POST", headers: { "stripe-signature": "test" }, rawBody: "{}" }, acceptedResponse);
    assert.strictEqual(acceptedResponse.statusCode, 200);
    assert.strictEqual(acceptedResponse.body.ignored, false);
    assert.strictEqual(rpcCalls, 2, "tuji Stripe dogodek ne sme sprožiti podatkovnega klica");
  } finally {
    supabaseServer.konfiguracija = originals.serviceConfiguration;
    supabaseServer.pokliciRpc = originals.rpc;
    stripeSandbox.configuration = originals.stripeConfiguration;
    stripeSandbox.createClient = originals.createClient;
  }
}

async function testStatusHandler() {
  const originals = {
    userConfiguration: supabaseServer.uporabniskaKonfiguracija,
    serviceConfiguration: supabaseServer.konfiguracija,
    authenticate: supabaseServer.preveriUporabnika,
    rows: supabaseServer.pridobiVrstice,
    stripeConfiguration: stripeSandbox.configuration,
    createClient: stripeSandbox.createClient,
  };
  const userId = "22222222-2222-4222-8222-222222222222";
  const invoiceId = "11111111-1111-4111-8111-111111111111";
  const sessionId = "cs_test_full_return";
  const calls = { queries: [], retrieves: 0 };
  try {
    supabaseServer.uporabniskaKonfiguracija = () => ({ test: true });
    supabaseServer.konfiguracija = () => ({ service: true });
    supabaseServer.preveriUporabnika = async () => ({ ok: true, user: { id: userId } });
    supabaseServer.pridobiVrstice = async (_cfg, table, query) => {
      calls.queries.push({ table, query });
      if (table !== "pos_payments") return [];
      return [{
        id: "33333333-3333-4333-8333-333333333333", invoice_id: invoiceId,
        amount_cents: 119, currency: "EUR", status: "succeeded", refunded_cents: 0,
        failure_code: "", paid_at: "2026-08-21T12:00:00.000Z", expires_at: null,
        checkout_session_id: sessionId, external_payment_id: "pi_test_full_return",
      }];
    };
    stripeSandbox.configuration = () => ({ mode: "test", secretKey: "sk_test_mock", webhookSecret: "whsec_mock_mock" });
    stripeSandbox.createClient = () => ({
      checkout: { sessions: { retrieve: async (value) => {
        calls.retrieves += 1;
        assert.strictEqual(value, sessionId);
        return {
          id: sessionId, livemode: false, status: "complete", payment_status: "paid",
          metadata: { test_mode: "true", user_id: userId, invoice_id: invoiceId },
        };
      } } },
    });
    const request = { method: "POST", headers: {}, body: { action: "status", sessionId } };
    const response = {
      statusCode: 0, headers: {}, body: "",
      status(code) { this.statusCode = code; return this; },
      setHeader(name, value) { this.headers[name] = value; return this; },
      end(value) { this.body = String(value || ""); return this; },
    };
    await checkoutHandler(request, response);
    const result = JSON.parse(response.body);
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.payment.status, "succeeded");
    assert.strictEqual(result.checkout.paymentStatus, "paid");
    assert.strictEqual(calls.retrieves, 1);
    assert.strictEqual(calls.queries.filter((entry) => entry.table === "pos_payments").length, 1);
    assert(calls.queries[0].query.includes("user_id=eq." + userId));
  } finally {
    supabaseServer.uporabniskaKonfiguracija = originals.userConfiguration;
    supabaseServer.konfiguracija = originals.serviceConfiguration;
    supabaseServer.preveriUporabnika = originals.authenticate;
    supabaseServer.pridobiVrstice = originals.rows;
    stripeSandbox.configuration = originals.stripeConfiguration;
    stripeSandbox.createClient = originals.createClient;
  }
}

async function testWebhookBodyLimit() {
  assert.strictEqual(await webhook.rawRequestBody({ rawBody: Buffer.from("{}") }), "{}");
  await assert.rejects(
    () => webhook.rawRequestBody({ rawBody: Buffer.alloc(webhook.MAX_BODY_BYTES + 1) }),
    function (error) { return error && error.status === 413; }
  );
  await assert.rejects(
    () => webhook.rawRequestBody({ rawBody: "x".repeat(webhook.MAX_BODY_BYTES + 1) }),
    function (error) { return error && error.status === 413; }
  );
}

async function testRefundHandler() {
  const originals = {
    userConfiguration: supabaseServer.uporabniskaKonfiguracija,
    serviceConfiguration: supabaseServer.konfiguracija,
    authenticate: supabaseServer.preveriUporabnika,
    rows: supabaseServer.pridobiVrstice,
    stripeConfiguration: stripeSandbox.configuration,
    createClient: stripeSandbox.createClient,
  };
  const calls = { queries: [], refunds: [] };
  try {
    supabaseServer.uporabniskaKonfiguracija = () => ({ test: true });
    supabaseServer.konfiguracija = () => ({ service: true });
    supabaseServer.preveriUporabnika = async () => ({ ok: true, user: { id: "22222222-2222-4222-8222-222222222222" } });
    supabaseServer.pridobiVrstice = async (_cfg, table, query) => {
      calls.queries.push({ table, query });
      if (table === "pos_payments") return [{
        id: "33333333-3333-4333-8333-333333333333",
        invoice_id: "11111111-1111-4111-8111-111111111111",
        provider: "stripe", amount_cents: 11900, refunded_cents: 1900,
        currency: "EUR", status: "partially_refunded", external_payment_id: "pi_test_refund",
      }];
      if (table === "pos_invoices") return [{ id: "11111111-1111-4111-8111-111111111111", is_test: true }];
      return [];
    };
    stripeSandbox.configuration = () => ({ mode: "test", secretKey: "sk_test_mock", webhookSecret: "whsec_mock_mock" });
    stripeSandbox.createClient = () => ({
      paymentIntents: { retrieve: async () => ({
        id: "pi_test_refund", livemode: false, amount: 11900, currency: "eur",
        metadata: { test_mode: "true", user_id: "22222222-2222-4222-8222-222222222222", invoice_id: "11111111-1111-4111-8111-111111111111" },
      }) },
      refunds: { create: async (params, options) => {
        calls.refunds.push({ params, options });
        return { id: "re_test_refund", status: "succeeded", amount: params.amount, currency: "eur" };
      } },
    });
    const request = {
      method: "POST", headers: {}, body: {
        action: "refund", invoiceId: "11111111-1111-4111-8111-111111111111",
        paymentId: "33333333-3333-4333-8333-333333333333", amountCents: 2500,
        confirmed: true, requestId: "44444444-4444-4444-8444-444444444444",
      },
    };
    const response = {
      statusCode: 0, headers: {}, body: "",
      status(code) { this.statusCode = code; return this; },
      setHeader(name, value) { this.headers[name] = value; return this; },
      end(value) { this.body = String(value || ""); return this; },
    };
    await checkoutHandler(request, response);
    const result = JSON.parse(response.body);
    assert.strictEqual(response.statusCode, 202);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.testMode, true);
    assert.strictEqual(result.refund.amountCents, 2500);
    assert.strictEqual(calls.refunds.length, 1);
    assert.strictEqual(calls.refunds[0].params.payment_intent, "pi_test_refund");
    assert.strictEqual(calls.refunds[0].params.metadata.request_id, request.body.requestId);
    assert.strictEqual(
      calls.refunds[0].options.idempotencyKey,
      "uj-pos-test-refund:22222222-2222-4222-8222-222222222222:33333333-3333-4333-8333-333333333333:" + request.body.requestId
    );
    assert(calls.queries.some((entry) => entry.table === "pos_invoices" && entry.query.includes("is_test=eq.true")));
    assert(calls.queries.some((entry) => entry.table === "pos_payments" && entry.query.includes("user_id=eq.")));
  } finally {
    supabaseServer.uporabniskaKonfiguracija = originals.userConfiguration;
    supabaseServer.konfiguracija = originals.serviceConfiguration;
    supabaseServer.preveriUporabnika = originals.authenticate;
    supabaseServer.pridobiVrstice = originals.rows;
    stripeSandbox.configuration = originals.stripeConfiguration;
    stripeSandbox.createClient = originals.createClient;
  }
}

testWebhookBodyLimit().then(testWebhookRetryRace).then(testStatusHandler).then(testRefundHandler).then(() => {
  console.log("POS Stripe sandbox Checkout, refund API, webhook varovalke in plačilna sled: OK");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
