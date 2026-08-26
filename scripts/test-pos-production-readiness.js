"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const readiness = require("../api/_lib/pos-production-readiness");

const envExample = fs.readFileSync(path.join(__dirname, "..", ".env.example"), "utf8");
[
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAPI_INVOICE_TOKEN", "OPENAPI_INVOICE_TOKEN_EXPIRES_AT", "OPENAPI_INVOICE_MODE",
  "POS_OPENAPI_INVOICE_ENABLED", "OPENAPI_INVOICE_SEND_ENABLED",
  "OPENAPI_INVOICE_WEBHOOK_SECRET", "OPENAPI_INVOICE_WEBHOOK_URL",
  "OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED", "OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL",
  "OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT",
  "POS_ARCHIVE_S3_BUCKET", "POS_ARCHIVE_S3_ACCESS_KEY_ID",
  "POS_ARCHIVE_S3_SECRET_ACCESS_KEY", "POS_ARCHIVE_S3_LIVE_ENABLED", "POS_ARCHIVE_S3_READINESS_CONFIRMED",
  "POS_ARCHIVE_S3_READINESS_CONFIRMED_BUCKET", "POS_ARCHIVE_S3_READINESS_CONFIRMED_AT",
  "POS_DE_LEGAL_REVIEW_CONFIRMED", "POS_DE_LEGAL_REVIEW_REFERENCE", "POS_DE_LEGAL_REVIEW_CONFIRMED_AT",
  "POS_DE_PILOT_ACCEPTED", "POS_DE_PILOT_REFERENCE", "POS_DE_PILOT_ACCEPTED_AT",
].forEach((name) => assert.match(envExample, new RegExp("^" + name + "=", "m"), name + " manjka v .env.example"));
[
  "POS_OPENAPI_INVOICE_ENABLED", "OPENAPI_INVOICE_SEND_ENABLED",
  "OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED",
  "OPENAPI_INVOICE_ALLOW_CONFIGURATION_CREATE", "OPENAPI_INVOICE_ALLOW_CONFIGURATION_UPDATE",
  "OPENAPI_INVOICE_RECONCILIATION_ENABLED", "POS_ARCHIVE_S3_LIVE_ENABLED",
  "POS_ARCHIVE_S3_READINESS_CONFIRMED",
  "POS_DE_LEGAL_REVIEW_CONFIRMED", "POS_DE_PILOT_ACCEPTED",
].forEach((name) => assert.match(envExample, new RegExp("^" + name + "=false$", "m"), name + " mora biti v predlogi fail-closed"));

const empty = readiness.assess({});
assert.strictEqual(empty.version, "pos-de-production-readiness-v9");
assert.strictEqual(empty.ready, false);
assert.strictEqual(empty.summary.blockingTotal, 6);
assert.strictEqual(empty.summary.blockingReady, 0);
assert.strictEqual(empty.checks.find((check) => check.id === "stripe_card_payments").blocking, false);
assert.strictEqual(empty.checks.find((check) => check.id === "fiskaly_tse").ready, true);
assert.strictEqual(empty.checks.find((check) => check.id === "openapi_multi_company_onboarding").status, "cost_locked");
assert.deepStrictEqual(
  empty.checks.find((check) => check.id === "openapi_financial_adjustments").missing,
  ["openapi_delivery_not_enabled"],
  "Produkcijski readiness ne sme napačno poročati sandbox probe blokade."
);

const secretValues = {
  service: "service-secret-never-print",
  anon: "anon-secret-never-print",
  openapi: "openapi-secret-never-print",
  webhook: "webhook-secret-never-print-1234567890",
  resend: "resend-secret-never-print",
  resendWebhook: "resend-webhook-secret-never-print",
  awsAccess: "aws-access-never-print",
  awsSecret: "aws-secret-never-print",
};
const completeEnv = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: secretValues.anon,
  SUPABASE_SERVICE_ROLE_KEY: secretValues.service,
  OPENAPI_INVOICE_TOKEN: secretValues.openapi,
  OPENAPI_INVOICE_TOKEN_EXPIRES_AT: "2099-12-31T23:59:59Z",
  OPENAPI_INVOICE_MODE: "production",
  POS_OPENAPI_INVOICE_ENABLED: "true",
  OPENAPI_INVOICE_SEND_ENABLED: "true",
  OPENAPI_INVOICE_WEBHOOK_SECRET: secretValues.webhook,
  OPENAPI_INVOICE_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED: "true",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT: new Date().toISOString(),
  RESEND_API_KEY: secretValues.resend,
  POS_EMAIL_FROM: "receipts@example.test",
  POS_EMAIL_DELIVERY_MODE: "production",
  POS_EMAIL_DELIVERY_ENABLED: "true",
  RESEND_WEBHOOK_SECRET: secretValues.resendWebhook,
  POS_ARCHIVE_S3_REGION: "eu-central-1",
  POS_ARCHIVE_S3_BUCKET: "uspesni-jezek-pos-archive",
  POS_ARCHIVE_S3_ACCESS_KEY_ID: secretValues.awsAccess,
  POS_ARCHIVE_S3_SECRET_ACCESS_KEY: secretValues.awsSecret,
  POS_ARCHIVE_S3_LIVE_ENABLED: "true",
  POS_ARCHIVE_S3_READINESS_CONFIRMED: "true",
  POS_ARCHIVE_S3_READINESS_CONFIRMED_BUCKET: "uspesni-jezek-pos-archive",
  POS_ARCHIVE_S3_READINESS_CONFIRMED_AT: new Date().toISOString(),
  POS_DE_LEGAL_REVIEW_CONFIRMED: "true",
  POS_DE_LEGAL_REVIEW_REFERENCE: "LEGAL-REVIEW-2026-08-26",
  POS_DE_LEGAL_REVIEW_CONFIRMED_AT: new Date().toISOString(),
  POS_DE_PILOT_ACCEPTED: "true",
  POS_DE_PILOT_REFERENCE: "PILOT-ACCEPTANCE-2026-08-26",
  POS_DE_PILOT_ACCEPTED_AT: new Date().toISOString(),
};
const complete = readiness.assess(completeEnv);
assert.strictEqual(complete.ready, true);
assert.deepStrictEqual(complete.summary, {
  blockingTotal: 6,
  blockingReady: 6,
  blockingRemaining: 0,
  optionalNotReady: 5,
});
assert.strictEqual(complete.checks.find((check) => check.id === "openapi_einvoicing").status, "ready");
const sendLocked = readiness.assess(Object.assign({}, {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  OPENAPI_INVOICE_TOKEN: "token",
  OPENAPI_INVOICE_TOKEN_EXPIRES_AT: "2099-12-31T23:59:59Z",
  OPENAPI_INVOICE_MODE: "production",
  POS_OPENAPI_INVOICE_ENABLED: "true",
  OPENAPI_INVOICE_WEBHOOK_SECRET: "w".repeat(32),
  OPENAPI_INVOICE_WEBHOOK_URL: "https://uspesni-jezek.vercel.app/api/pos?handler=openapi-invoice&webhook=1",
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED: "true",
}));
assert.strictEqual(sendLocked.checks.find((check) => check.id === "openapi_einvoicing").ready, false);
assert.ok(sendLocked.checks.find((check) => check.id === "openapi_einvoicing").missing.includes("OPENAPI_INVOICE_SEND_ENABLED=true"));
assert.strictEqual(complete.checks.find((check) => check.id === "openapi_multi_company_onboarding").status, "cost_locked");
assert.strictEqual(complete.checks.find((check) => check.id === "openapi_webhook_reconciliation").status, "cost_locked");
assert.deepStrictEqual(
  complete.checks.find((check) => check.id === "openapi_financial_adjustments"),
  {
    id: "openapi_financial_adjustments",
    area: "core",
    blocking: true,
    ready: true,
    status: "ready",
    missing: [],
    note: "Sandbox Storno in Gutschrift (UN/CEFACT tip 381) sta dosegla SENT / succeeded. Produkcijski tip 381 je omogočen samo skupaj z vsemi splošnimi Openapi produkcijskimi varovalkami.",
  }
);
assert.strictEqual(complete.checks.find((check) => check.id === "gobd_worm_archive").status, "ready");

const forgedSandboxEvidence = require("./fixtures/openapi-de-381-sandbox-evidence.json");
const forgedCopy = structuredClone(forgedSandboxEvidence);
forgedCopy.cases[0].providerEventAt = "2026-08-26T12:53:15.000Z";
const forgedEvidenceReadiness = readiness.assess(completeEnv, { sandbox381Evidence: forgedCopy });
assert.strictEqual(forgedEvidenceReadiness.ready, false);
assert.deepStrictEqual(
  forgedEvidenceReadiness.checks.find((check) => check.id === "openapi_financial_adjustments").missing,
  ["controlled_sandbox_381_evidence_invalid"]
);

const archiveNotProven = readiness.assess(Object.assign({}, {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  POS_ARCHIVE_S3_REGION: "eu-central-1",
  POS_ARCHIVE_S3_BUCKET: "uspesni-jezek-pos-archive",
  POS_ARCHIVE_S3_ACCESS_KEY_ID: "access",
  POS_ARCHIVE_S3_SECRET_ACCESS_KEY: "secret",
  POS_ARCHIVE_S3_LIVE_ENABLED: "true",
}));
assert.strictEqual(archiveNotProven.checks.find((check) => check.id === "gobd_worm_archive").ready, false);
assert.ok(archiveNotProven.checks.find((check) => check.id === "gobd_worm_archive").missing.includes("POS_ARCHIVE_S3_READINESS_CONFIRMED=true"));

const staleArchiveConfirmation = readiness.assess(Object.assign({}, completeEnv, {
  POS_ARCHIVE_S3_READINESS_CONFIRMED_AT: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
}));
assert.strictEqual(staleArchiveConfirmation.checks.find((check) => check.id === "gobd_worm_archive").ready, false);
assert.ok(staleArchiveConfirmation.checks.find((check) => check.id === "gobd_worm_archive").missing.includes("POS_ARCHIVE_S3_READINESS_CONFIRMED_AT"));
const wrongArchiveBucket = readiness.assess(Object.assign({}, completeEnv, {
  POS_ARCHIVE_S3_READINESS_CONFIRMED_BUCKET: "different-archive-bucket",
}));
assert.strictEqual(wrongArchiveBucket.checks.find((check) => check.id === "gobd_worm_archive").ready, false);
assert.ok(wrongArchiveBucket.checks.find((check) => check.id === "gobd_worm_archive").missing.includes("POS_ARCHIVE_S3_READINESS_CONFIRMED_BUCKET"));
const futureArchiveConfirmation = readiness.assess(Object.assign({}, completeEnv, {
  POS_ARCHIVE_S3_READINESS_CONFIRMED_AT: new Date(Date.now() + 6 * 60 * 1000).toISOString(),
}));
assert.strictEqual(futureArchiveConfirmation.checks.find((check) => check.id === "gobd_worm_archive").ready, false);
assert.ok(futureArchiveConfirmation.checks.find((check) => check.id === "gobd_worm_archive").missing.includes("POS_ARCHIVE_S3_READINESS_CONFIRMED_AT"));

const unauditedExternalConfirmations = readiness.assess(Object.assign({}, completeEnv, {
  POS_DE_LEGAL_REVIEW_REFERENCE: "",
  POS_DE_PILOT_ACCEPTED_AT: "2099-01-01T00:00:00Z",
}));
assert.strictEqual(unauditedExternalConfirmations.ready, false);
assert.ok(unauditedExternalConfirmations.checks.find((check) => check.id === "german_legal_review").missing.includes("POS_DE_LEGAL_REVIEW_REFERENCE"));
assert.ok(unauditedExternalConfirmations.checks.find((check) => check.id === "merchant_pilot").missing.includes("POS_DE_PILOT_ACCEPTED_AT"));

const serialized = JSON.stringify(complete);
Object.values(secretValues).forEach((secret) => {
  assert.ok(!serialized.includes(secret), "Poročilo ne sme vsebovati vrednosti skrivnosti.");
});

const wrongModes = readiness.assess({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  OPENAPI_INVOICE_TOKEN: "sandbox-token",
  OPENAPI_INVOICE_MODE: "sandbox",
  OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET: "s".repeat(32),
  OPENAPI_INVOICE_SANDBOX_WEBHOOK_URL: "https://example.test/sandbox",
  POS_ARCHIVE_S3_BUCKET: "uspesni-jezek-pos-archive",
  POS_ARCHIVE_S3_ACCESS_KEY_ID: "access",
  POS_ARCHIVE_S3_SECRET_ACCESS_KEY: "secret",
});
assert.strictEqual(wrongModes.ready, false);
assert.ok(wrongModes.checks.find((check) => check.id === "openapi_einvoicing").missing.includes("OPENAPI_INVOICE_MODE=production"));
assert.ok(wrongModes.checks.find((check) => check.id === "gobd_worm_archive").missing.includes("POS_ARCHIVE_S3_LIVE_ENABLED=true"));

const explicitlyApprovedCosts = readiness.assess({
  OPENAPI_INVOICE_MODE: "production",
  OPENAPI_INVOICE_ALLOW_CONFIGURATION_CREATE: "true",
  OPENAPI_INVOICE_ALLOW_CONFIGURATION_UPDATE: "true",
  OPENAPI_INVOICE_RECONCILIATION_ENABLED: "true",
});
assert.strictEqual(explicitlyApprovedCosts.checks.find((check) => check.id === "openapi_multi_company_onboarding").status, "approved");
assert.strictEqual(explicitlyApprovedCosts.checks.find((check) => check.id === "openapi_webhook_reconciliation").status, "approved");

console.log("POS production readiness tests passed.");
