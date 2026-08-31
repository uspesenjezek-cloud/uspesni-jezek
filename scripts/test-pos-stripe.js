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
const paymentSafetyMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260829165203_pos_payment_safety_v2.sql"), "utf8");
const paymentSnapshotMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260830172315_pos_stripe_event_invoice_lock.sql"), "utf8");
const refundRecoveryMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260830212243_pos_stripe_refund_recovery.sql"), "utf8");
const paymentConcurrencyHarness = fs.readFileSync(path.join(root, "scripts", "test-pos-payment-concurrency.js"), "utf8");
const paymentSnapshotHarness = fs.readFileSync(path.join(root, "scripts", "test-pos-stripe-event-snapshot.js"), "utf8");
const webhookHandlerHarness = fs.readFileSync(path.join(root, "scripts", "test-pos-stripe-webhook-handler.js"), "utf8");
const paymentSnapshotRollback = fs.readFileSync(path.join(root, "supabase", "rollbacks", "pos_stripe_event_invoice_lock.sql"), "utf8");
const verifyWorkflow = fs.readFileSync(path.join(root, ".github", "workflows", "verify.yml"), "utf8");
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
assert.strictEqual(checkout.refundAttemptCents({ amount_cents: 11900, refunded_cents: 11900, status: "refunded" }, 10000), 10000);
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
assert.match(paymentSafetyMigration, /pos_payments_one_active_stripe_per_invoice_uidx[\s\S]*status in \('pending','failed'\)[\s\S]*checkout_expired/i);
assert.match(paymentSafetyMigration, /create or replace function private\._pos_confirm_bank_transaction[\s\S]*POS_ACTIVE_PAYMENT_ATTEMPT_EXISTS/i);
assert.match(paymentSafetyMigration, /pos_invoice_payment_totals_not_overpaid_check[\s\S]*effective_paid_cents between 0 and gross_cents/i);
assert.match(paymentSafetyMigration, /POS_INVOICE_GROSS_LIMIT_EXCEEDED/i);
assert.match(paymentSafetyMigration, /create function public\.pos_reconcile_stripe_checkout/i);
assert.match(paymentSafetyMigration, /revoke execute on function public\.pos_cancel_stripe_checkout/i);
assert.match(paymentSnapshotMigration, /lock table public\.pos_invoices[\s\S]*lock table public\.pos_payments/i);
assert.match(paymentSnapshotMigration, /jsonb_typeof\(p_summary -> 'failure_code'\) = 'string'/i);
assert.match(paymentSnapshotMigration, /jsonb_typeof\(p_summary -> 'competing_checkout_session_id'\) = 'string'/i);
assert.match(paymentSnapshotMigration, /POS_STRIPE_EVENT_SNAPSHOT_MISSING/i);
assert.match(paymentSnapshotMigration, /on conflict \(provider, external_event_id\) do nothing/i);
assert.match(refundRecoveryMigration, /create table private\.pos_stripe_refund_requests/i);
assert.match(refundRecoveryMigration, /unique \(user_id, request_id\)/i);
assert.match(refundRecoveryMigration, /global financial lock order: invoice, payment, refund request/i);
assert.match(refundRecoveryMigration, /from public\.pos_invoices[\s\S]*for update[\s\S]*from public\.pos_payments[\s\S]*for update[\s\S]*from private\.pos_stripe_refund_requests[\s\S]*for update/i);
assert.match(refundRecoveryMigration, /p_cumulative_refunded_cents < v_payment\.refunded_cents[\s\S]*POS_STRIPE_REFUND_PROGRESS_REGRESSION/i);
assert.match(refundRecoveryMigration, /v_state := case[\s\S]*v_request\.state in \('reconciled','failed','cancelled'\)[\s\S]*p_provider_status = 'failed'[\s\S]*p_provider_status = 'canceled'[\s\S]*p_provider_status = 'succeeded'[\s\S]*p_cumulative_refunded_cents >= v_target then 'reconciled'/i, "Kumulativa plačila ne sme dokazati uspeha drugega konkretnega Stripe refunda.");
assert.doesNotMatch(refundRecoveryMigration, /v_state := case\s+when p_cumulative_refunded_cents >= v_target then 'reconciled'/i);
assert.match(refundRecoveryMigration, /refund_reconcile_source','stripe_current_charge'/i);
assert.match(refundRecoveryMigration, /security definer[\s\S]*set search_path = ''/i);
assert.match(refundRecoveryMigration, /grant execute on function public\.pos_reconcile_stripe_refund[\s\S]*to service_role/i);
assert.match(paymentSnapshotHarness, /phase === "seed"[\s\S]*seedLegacyFixture/i);
assert.match(paymentSnapshotHarness, /failure_code JSON null/i);
assert.doesNotMatch(paymentSnapshotHarness, /const BACKFILL_SQL/i);
assert.match(webhookHandlerHarness, /STRIPE_SESSION_STILL_OPEN/i);
assert.match(paymentSnapshotRollback, /POS_STRIPE_EVENT_ROLLBACK_INDEX_RESTORE_CONFLICT/i);
assert.match(paymentConcurrencyHarness, /expectedCodes[\s\S]*expectedMessages[\s\S]*rejected\.reason/i);
assert.match(paymentConcurrencyHarness, /testRetryableStripeAttemptStaysActive/i);
assert.match(paymentConcurrencyHarness, /testBankCannotSettleActiveStripe/i);
assert.match(paymentConcurrencyHarness, /testWebhookVsReconcile/i);
assert.match(paymentConcurrencyHarness, /testRefundVsNewAttempt/i);
assert.match(paymentConcurrencyHarness, /testWebhookOverCapPersistsReconciliation/i);
assert.match(paymentConcurrencyHarness, /POS_REQUIRE_PAYMENT_CONCURRENCY[\s\S]*throw new Error/);
assert.match(paymentConcurrencyHarness, /ensureTestUser[\s\S]*insert into auth\.users/);
assert.match(verifyWorkflow, /pos-payment-concurrency:[\s\S]*supabase\/setup-cli@ab058987d8d6c725971f6cf9d0b5c98467e30bd1\s+# v1\.7\.1[\s\S]*version: 2\.115\.0/);
assert.match(verifyWorkflow, /db reset --local --no-seed --version=20260829165203[\s\S]*test:pos-snapshot:seed[\s\S]*supabase migration up --local[\s\S]*test:pos-snapshot/);
assert.match(verifyWorkflow, /POS_REQUIRE_PAYMENT_CONCURRENCY: "1"[\s\S]*npm run test:pos-concurrency/);
assert.match(router, /"stripe-checkout": require\("\.\/_handlers\/pos-stripe-checkout"\)/);
assert.match(router, /"stripe-webhook": require\("\.\/_handlers\/pos-stripe-webhook"\)/);
const checkoutHandlerSource = fs.readFileSync(path.join(root, "api", "_handlers", "pos-stripe-checkout.js"), "utf8");
assert.match(checkoutHandlerSource, /stripe\.refunds\.create/);
assert.match(checkoutHandlerSource, /const attemptId = requestId;/);
assert.match(checkoutHandlerSource, /assertTestSession[\s\S]*\{ userId: auth\.user\.id, invoiceId, attemptId \}/);
assert.match(vercel, /\/api\/pos-stripe-checkout/);
assert.match(vercel, /\/api\/pos-stripe-webhook/);
assert.match(html, /Plačaj s kartico – TEST/);
assert.match(html, /data-stripe-abandon[\s\S]*Končaj Stripe poskus/);
assert.match(html, /SANDBOX · TEST/);
assert.match(js, /handleStripeReturn/);
assert.match(js, /status === "succeeded"/);
assert.match(js, /data-stripe-refund/);
assert.match(js, /stripeCheckoutRequest\("refund"/);
assert.match(js, /function abandonStripeCheckout\(invoice\)[\s\S]*stripeCheckoutRequest\("cancel"[\s\S]*loadServerState\("payments"\)/);
assert.match(html, /Vrni plačilo – TEST/);
assert.match(html, /data-dialog-input/);
assert.match(js, /Znesek povračila/);
assert.match(js, /validateRefundAmountInput\(value, refundableCents\)/);
assert.match(js, /onConfirm: async function \(value\)/);
assert.match(css, /\.pos-dialog__field\[hidden\] \{ display: none; \}/);
assert.match(css, /font: 700 1rem\/1\.2/);
assert.match(css, /\.pos-stripe-test\[hidden\], \.pos-stripe-test__abandon\[hidden\], \.pos-stripe-test__refund\[hidden\] \{ display: none; \}/);
const stripeTheme = css.slice(css.indexOf(".pos-stripe-test {"), css.indexOf(".pos-replacement-banner"));
assert.match(stripeTheme, /border: 1px solid #bfd2df/);
assert.match(stripeTheme, /background: linear-gradient\(145deg, #f1f6fa, #fff\)/);
assert.match(stripeTheme, /\.pos-stripe-test__button \{[^}]*background: #567392/);
assert.match(stripeTheme, /\.pos-stripe-test__abandon, \.pos-stripe-test__refund \{[^}]*color: #405f7e; border-color: #bfd2df/);
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
    rpc: supabaseServer.pokliciRpc,
    stripeConfiguration: stripeSandbox.configuration,
    createClient: stripeSandbox.createClient,
  };
  const userId = "22222222-2222-4222-8222-222222222222";
  const invoiceId = "11111111-1111-4111-8111-111111111111";
  const sessionId = "cs_test_full_return";
  const calls = { queries: [], retrieves: 0, reconciles: 0 };
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
    supabaseServer.pokliciRpc = async (_cfg, name, payload) => {
      assert.strictEqual(name, "pos_reconcile_stripe_checkout");
      assert.strictEqual(payload.p_checkout_session_id, sessionId);
      assert.strictEqual(payload.p_payment_status, "paid");
      calls.reconciles += 1;
      return [{
        id: "33333333-3333-4333-8333-333333333333", invoice_id: invoiceId,
        amount_cents: 119, currency: "EUR", status: "succeeded", refunded_cents: 0,
        failure_code: "", paid_at: "2026-08-21T12:00:00.000Z", expires_at: null,
      }];
    };
    stripeSandbox.configuration = () => ({ mode: "test", secretKey: "sk_test_mock", webhookSecret: "whsec_mock_mock" });
    stripeSandbox.createClient = () => ({
      checkout: { sessions: { retrieve: async (value) => {
        calls.retrieves += 1;
        assert.strictEqual(value, sessionId);
        return {
          id: sessionId, livemode: false, status: "complete", payment_status: "paid",
          amount_total: 119, currency: "eur", payment_intent: "pi_test_full_return",
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
    assert.strictEqual(calls.reconciles, 1);
    assert.strictEqual(calls.queries.filter((entry) => entry.table === "pos_payments").length, 1);
    assert(calls.queries[0].query.includes("user_id=eq." + userId));

    request.body.action = "cancel";
    response.statusCode = 0;
    response.body = "";
    await checkoutHandler(request, response);
    const cancelledPaid = JSON.parse(response.body);
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(cancelledPaid.payment.status, "succeeded", "Plačana seja se ob preklicu uskladi in se ne označi cancelled.");
    assert.strictEqual(calls.reconciles, 2);
  } finally {
    supabaseServer.uporabniskaKonfiguracija = originals.userConfiguration;
    supabaseServer.konfiguracija = originals.serviceConfiguration;
    supabaseServer.preveriUporabnika = originals.authenticate;
    supabaseServer.pridobiVrstice = originals.rows;
    supabaseServer.pokliciRpc = originals.rpc;
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

async function testExpiredCancellationHandler() {
  const originals = {
    userConfiguration: supabaseServer.uporabniskaKonfiguracija,
    serviceConfiguration: supabaseServer.konfiguracija,
    authenticate: supabaseServer.preveriUporabnika,
    rows: supabaseServer.pridobiVrstice,
    rpc: supabaseServer.pokliciRpc,
    stripeConfiguration: stripeSandbox.configuration,
    createClient: stripeSandbox.createClient,
  };
  const userId = "22222222-2222-4222-8222-222222222222";
  const invoiceId = "11111111-1111-4111-8111-111111111111";
  const sessionId = "cs_test_cancel_reconcile";
  const payment = {
    id: "33333333-3333-4333-8333-333333333333", invoice_id: invoiceId,
    amount_cents: 11900, currency: "EUR", status: "pending", refunded_cents: 0,
    failure_code: "", paid_at: null, expires_at: null, checkout_session_id: sessionId,
  };
  let expired = false;
  let retrieves = 0;
  let expires = 0;
  try {
    supabaseServer.uporabniskaKonfiguracija = () => ({ test: true });
    supabaseServer.konfiguracija = () => ({ service: true });
    supabaseServer.preveriUporabnika = async () => ({ ok: true, user: { id: userId } });
    supabaseServer.pridobiVrstice = async () => [payment];
    supabaseServer.pokliciRpc = async (_cfg, name, payload) => {
      assert.strictEqual(name, "pos_reconcile_stripe_checkout");
      assert.strictEqual(payload.p_session_status, "expired");
      assert.strictEqual(payload.p_payment_status, "unpaid");
      return [Object.assign({}, payment, { status: "cancelled", failure_code: "checkout_expired" })];
    };
    stripeSandbox.configuration = () => ({ mode: "test" });
    stripeSandbox.createClient = () => ({
      checkout: { sessions: {
        retrieve: async () => {
          retrieves += 1;
          return {
            id: sessionId, livemode: false, status: expired ? "expired" : "open", payment_status: "unpaid",
            amount_total: 11900, currency: "eur", payment_intent: null,
            metadata: { test_mode: "true", user_id: userId, invoice_id: invoiceId },
          };
        },
        expire: async () => { expires += 1; expired = true; },
      } },
    });
    const response = {
      statusCode: 0, body: "", status(code) { this.statusCode = code; return this; },
      setHeader() { return this; }, end(value) { this.body = String(value || ""); return this; },
    };
    await checkoutHandler({ method: "POST", headers: {}, body: { action: "cancel", sessionId } }, response);
    const result = JSON.parse(response.body);
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(result.payment.status, "cancelled");
    assert.strictEqual(result.payment.failureCode, "checkout_expired");
    assert.strictEqual(expires, 1);
    assert.strictEqual(retrieves, 2, "Po expire je treba pridobiti svež provider snapshot.");
  } finally {
    supabaseServer.uporabniskaKonfiguracija = originals.userConfiguration;
    supabaseServer.konfiguracija = originals.serviceConfiguration;
    supabaseServer.preveriUporabnika = originals.authenticate;
    supabaseServer.pridobiVrstice = originals.rows;
    supabaseServer.pokliciRpc = originals.rpc;
    stripeSandbox.configuration = originals.stripeConfiguration;
    stripeSandbox.createClient = originals.createClient;
  }
}

async function testRefundHandler() {
  const originals = {
    userConfiguration: supabaseServer.uporabniskaKonfiguracija,
    serviceConfiguration: supabaseServer.konfiguracija,
    authenticate: supabaseServer.preveriUporabnika,
    rows: supabaseServer.pridobiVrstice,
    rpc: supabaseServer.pokliciRpc,
    stripeConfiguration: stripeSandbox.configuration,
    createClient: stripeSandbox.createClient,
  };
  const userId = "22222222-2222-4222-8222-222222222222";
  const invoiceId = "11111111-1111-4111-8111-111111111111";
  const paymentId = "33333333-3333-4333-8333-333333333333";
  const requestId = "44444444-4444-4444-8444-444444444444";
  const calls = { queries: [], refunds: [], rpcs: [], intentRetrieves: 0 };
  let paymentState = {
    id: paymentId, invoice_id: invoiceId, provider: "stripe", method: "stripe_card",
    amount_cents: 11900, refunded_cents: 1900, currency: "EUR",
    status: "partially_refunded", external_payment_id: "pi_test_refund",
    failure_code: "", paid_at: "2026-08-30T10:00:00.000Z",
  };
  try {
    supabaseServer.uporabniskaKonfiguracija = () => ({ test: true });
    supabaseServer.konfiguracija = () => ({ service: true });
    supabaseServer.preveriUporabnika = async () => ({ ok: true, user: { id: userId } });
    supabaseServer.pridobiVrstice = async (_cfg, table, query) => {
      calls.queries.push({ table, query });
      if (table === "pos_payments") return [Object.assign({}, paymentState)];
      if (table === "pos_invoices") return [{ id: invoiceId, is_test: true }];
      return [];
    };
    supabaseServer.pokliciRpc = async (_cfg, name, payload) => {
      calls.rpcs.push({ name, payload });
      if (name === "pos_prepare_stripe_refund") {
        assert.strictEqual(payload.p_user_id, userId);
        assert.strictEqual(payload.p_invoice_id, invoiceId);
        assert.strictEqual(payload.p_payment_id, paymentId);
        assert.strictEqual(payload.p_request_id, requestId);
        assert.strictEqual(payload.p_requested_cents, 10000);
        return {
          request_id: requestId, requested_cents: 10000,
          baseline_refunded_cents: 1900, provider_refund_id: "re_test_refund",
          provider_status: "succeeded", state: paymentState.status === "refunded" ? "reconciled" : "prepared",
        };
      }
      assert.strictEqual(name, "pos_reconcile_stripe_refund");
      assert.strictEqual(payload.p_provider_refund_id, "re_test_refund");
      assert.strictEqual(payload.p_payment_intent_id, "pi_test_refund");
      assert.strictEqual(payload.p_amount_cents, 11900);
      assert.strictEqual(payload.p_cumulative_refunded_cents, 11900);
      paymentState = Object.assign({}, paymentState, { status: "refunded", refunded_cents: 11900 });
      return {
        request_id: requestId, provider_refund_id: "re_test_refund",
        provider_status: "succeeded", state: "reconciled", payment: Object.assign({}, paymentState),
      };
    };
    stripeSandbox.configuration = () => ({ mode: "test", secretKey: "sk_test_mock", webhookSecret: "whsec_mock_mock" });
    stripeSandbox.createClient = () => ({
      paymentIntents: { retrieve: async () => {
        calls.intentRetrieves += 1;
        return {
          id: "pi_test_refund", livemode: false, amount: 11900, currency: "eur", status: "succeeded",
          latest_charge: {
            id: "ch_test_refund", livemode: false, payment_intent: "pi_test_refund",
            amount: 11900, amount_refunded: 11900, currency: "eur",
          },
          metadata: { test_mode: "true", user_id: userId, invoice_id: invoiceId },
        };
      } },
      refunds: { create: async (params, options) => {
        calls.refunds.push({ params, options });
        return {
          id: "re_test_refund", livemode: false, status: "succeeded",
          amount: params.amount, currency: "eur", payment_intent: "pi_test_refund",
          metadata: Object.assign({}, params.metadata),
        };
      } },
    });
    const request = {
      method: "POST", headers: {}, body: {
        action: "refund", invoiceId, paymentId, amountCents: 10000,
        confirmed: true, requestId,
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
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.testMode, true);
    assert.strictEqual(result.refund.amountCents, 10000);
    assert.strictEqual(result.reconciliation.state, "reconciled");
    assert.strictEqual(result.reconciliation.cumulativeRefundedCents, 11900);
    assert.strictEqual(result.payment.status, "refunded");
    assert.strictEqual(result.payment.refundedCents, 11900);

    // Simulate a lost HTTP response and a lost charge.refunded webhook: the
    // browser retries the exact requestId. Stripe returns the same idempotent
    // refund and the current Charge snapshot repairs/retains final DB state.
    response.statusCode = 0;
    response.body = "";
    await checkoutHandler(request, response);
    const retry = JSON.parse(response.body);
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(retry.payment.status, "refunded");
    assert.strictEqual(retry.payment.refundedCents, 11900);
    assert.strictEqual(calls.rpcs.filter((entry) => entry.name === "pos_prepare_stripe_refund").length, 2);
    assert.strictEqual(calls.rpcs.filter((entry) => entry.name === "pos_reconcile_stripe_refund").length, 2);
    assert.strictEqual(calls.rpcs.filter((entry) => entry.name === "pos_apply_stripe_event").length, 0, "Recovery ne sme ponarediti webhook event_id.");
    assert.strictEqual(calls.refunds.length, 2);
    assert.strictEqual(calls.intentRetrieves, 4, "Vsak poskus mora pred refundom in po njem prebrati sveže Stripe stanje.");
    assert.strictEqual(calls.refunds[0].options.idempotencyKey, calls.refunds[1].options.idempotencyKey);
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
    supabaseServer.pokliciRpc = originals.rpc;
    stripeSandbox.configuration = originals.stripeConfiguration;
    stripeSandbox.createClient = originals.createClient;
  }
}

testWebhookBodyLimit().then(testWebhookRetryRace).then(testStatusHandler).then(testExpiredCancellationHandler).then(testRefundHandler).then(() => {
  console.log("POS Stripe sandbox Checkout, refund API, webhook varovalke in plačilna sled: OK");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
