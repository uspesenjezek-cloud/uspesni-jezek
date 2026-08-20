"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const stripeSandbox = require(path.join(root, "api", "_lib", "stripe-sandbox"));
const checkout = require(path.join(root, "api", "_handlers", "pos-stripe-checkout"))._test;
const webhook = require(path.join(root, "api", "_handlers", "pos-stripe-webhook"))._test;
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260820202607_stripe_sandbox_invoice_payments.sql"), "utf8");
const router = fs.readFileSync(path.join(root, "api", "pos.js"), "utf8");
const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");

assert.throws(() => stripeSandbox.configuration({}), /ključ še ni nastavljen/);
assert.throws(() => stripeSandbox.configuration({ STRIPE_MODE: "live", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_1234567890123456" }), /zaklenjen/);
assert.throws(() => stripeSandbox.configuration({ STRIPE_SECRET_KEY: "sk_live_forbidden", STRIPE_WEBHOOK_SECRET: "whsec_1234567890123456" }), /live ključ/);
assert.deepStrictEqual(stripeSandbox.configuration({
  STRIPE_MODE: "test", STRIPE_SECRET_KEY: "sk_test_example", STRIPE_WEBHOOK_SECRET: "whsec_1234567890123456",
}), { mode: "test", secretKey: "sk_test_example", webhookSecret: "whsec_1234567890123456" });

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
assert.match(params.success_url, /stripe_session_id=%7BCHECKOUT_SESSION_ID%7D/);
assert.match(params.cancel_url, /stripe=cancelled/);
assert.doesNotMatch(params.cancel_url, /CHECKOUT_SESSION_ID|stripe_session_id/);
assert.match(params.cancel_url, /invoice_id=11111111-1111-4111-8111-111111111111/);

assert.strictEqual(checkout.effectivePaidCents([
  { amount_cents: 10000, refunded_cents: 2500, status: "partially_refunded" },
  { amount_cents: 1900, refunded_cents: 0, status: "pending" },
  { amount_cents: 2500, refunded_cents: 0, status: "succeeded" },
]), 10000);
assert.strictEqual(checkout.effectivePaidCents([{ amount_cents: 11900, refunded_cents: 11900, status: "refunded" }]), 0);

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

assert.match(migration, /alter table public\.pos_payments[\s\S]*add column status text not null default 'succeeded'/i);
assert.match(migration, /create table public\.pos_payment_events/i);
assert.match(migration, /unique \(provider, external_event_id\)/i);
assert.match(migration, /p_livemode[\s\S]*Live Stripe dogodki so zaklenjeni/i);
assert.match(migration, /p_amount_cents <> v_payment\.amount_cents/i);
assert.match(migration, /grant execute on function public\.pos_apply_stripe_event[\s\S]*to service_role/i);
assert.doesNotMatch(migration, /grant execute on function public\.pos_apply_stripe_event[\s\S]*to authenticated/i);
assert.match(migration, /private\._pos_effective_paid_cents/i);
assert.match(router, /"stripe-checkout": require\("\.\/_handlers\/pos-stripe-checkout"\)/);
assert.match(router, /"stripe-webhook": require\("\.\/_handlers\/pos-stripe-webhook"\)/);
assert.match(vercel, /\/api\/pos-stripe-checkout/);
assert.match(vercel, /\/api\/pos-stripe-webhook/);
assert.match(html, /Plačaj s kartico – TEST/);
assert.match(html, /SANDBOX · TEST/);
assert.match(js, /handleStripeReturn/);
assert.match(js, /status === "succeeded"/);
assert.doesNotMatch(js, /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|sk_test_|whsec_/);

console.log("POS Stripe sandbox Checkout, webhook varovalke in plačilna sled: OK");
