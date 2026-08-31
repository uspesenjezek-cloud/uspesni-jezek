"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const readiness = require("../api/_lib/pos-production-readiness");

const envExample = fs.readFileSync(path.join(__dirname, "..", ".env.example"), "utf8");
const verifyWorkflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "verify.yml"), "utf8");
assert.match(verifyWorkflow, /supabase\/setup-cli@ab058987d8d6c725971f6cf9d0b5c98467e30bd1\s+# v1\.7\.1/);
assert.match(verifyWorkflow, /version:\s*2\.115\.0/);
[
  "20260829165203_pos_payment_safety_v2.sql",
  "20260830172315_pos_stripe_event_invoice_lock.sql",
  "20260830212243_pos_stripe_refund_recovery.sql",
  "20260830212449_pos_bank_confirm_retry_idempotency.sql",
  "20260830212909_pos_cash_provider_recovery_lock_order.sql",
  "20260830213055_pos_archive_primary_object_recovery.sql",
].forEach((name) => assert.match(
  verifyWorkflow,
  new RegExp("git ls-files --error-unmatch --[\\s\\S]*supabase/migrations/" + name.replace(/\./g, "\\.")),
  name + " mora biti obvezni del CI checkouta."
));
const workflowLines = verifyWorkflow.split(/\r?\n/).map((line) => line.trim());
const resetIndex = workflowLines.indexOf("run: supabase db reset --local --no-seed --version=20260829165203");
const seedIndex = workflowLines.indexOf("run: npm run test:pos-snapshot:seed");
const migrateIndex = workflowLines.indexOf("run: supabase migration up --local");
const snapshotIndex = workflowLines.indexOf("run: npm run test:pos-snapshot");
const catalogIndex = workflowLines.indexOf("run: node scripts/test-pos-rpc-security.js");
const concurrencyIndex = workflowLines.indexOf("run: npm run test:pos-concurrency");
assert.ok(resetIndex >= 0 && resetIndex < seedIndex && seedIndex < migrateIndex && migrateIndex < snapshotIndex,
  "Disposable Supabase job mora dokazati pravi pre-J.2 snapshot in nato dejansko migracijo.");
assert.ok(snapshotIndex < catalogIndex && catalogIndex < concurrencyIndex,
  "Po migraciji morata pred concurrency gateom teči snapshot in pg_proc catalog dokaz.");
assert.match(verifyWorkflow, /POS_REQUIRE_RPC_CATALOG:\s*"1"[\s\S]*node scripts\/test-pos-rpc-security\.js/);
assert.match(verifyWorkflow, /POS_REQUIRE_PAYMENT_CONCURRENCY:\s*"1"[\s\S]*npm run test:pos-concurrency/);
[
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "POS_DATABASE_CI_GATE_CONFIRMED", "POS_DATABASE_CI_GATE_REFERENCE",
  "POS_DATABASE_CI_GATE_CONFIRMED_AT", "POS_DATABASE_CI_GATE_MIGRATION_HEAD",
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
  "FINAPI_MODE", "FINAPI_CLIENT_ID", "FINAPI_CLIENT_SECRET", "FINAPI_USER_KEY",
  "FINAPI_LIVE_ENABLED", "FINAPI_LIVE_LICENSE_CONFIRMED", "FINAPI_LIVE_DATA_PROCESSING_CONFIRMED",
  "FINAPI_LIVE_USER_DELETION_PROCESS_CONFIRMED", "FINAPI_CLIENT_ID_LIVE", "FINAPI_CLIENT_SECRET_LIVE",
  "FINAPI_USER_KEY_LIVE", "FINAPI_LIVE_PREFLIGHT_REFERENCE", "FINAPI_LIVE_PREFLIGHT_CONFIRMED_AT",
  "FISKALY_SIGN_DE_MODE", "FISKALY_API_KEY_TEST", "FISKALY_API_SECRET_TEST",
  "FISKALY_TSS_ID_TEST", "FISKALY_CLIENT_ID_TEST", "FISKALY_LIVE_ENABLED",
  "FISKALY_API_KEY_LIVE", "FISKALY_API_SECRET_LIVE", "FISKALY_TSS_ID_LIVE", "FISKALY_CLIENT_ID_LIVE",
  "FISKALY_LIVE_LEGAL_REVIEW_CONFIRMED", "FISKALY_LIVE_CASH_SYSTEM_REGISTERED",
  "FISKALY_LIVE_DSFINVK_CONFORMANCE_CONFIRMED",
].forEach((name) => assert.match(envExample, new RegExp("^" + name + "=", "m"), name + " manjka v .env.example"));
assert.match(envExample, /^FINAPI_MODE=sandbox$/m, "finAPI predloga mora ostati fail-closed v sandboxu.");
assert.match(envExample, /^FISKALY_SIGN_DE_MODE=test$/m, "fiskaly predloga mora ostati fail-closed v TEST okolju.");
[
  "POS_OPENAPI_INVOICE_ENABLED", "OPENAPI_INVOICE_SEND_ENABLED",
  "OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED",
  "OPENAPI_INVOICE_ALLOW_CONFIGURATION_CREATE", "OPENAPI_INVOICE_ALLOW_CONFIGURATION_UPDATE",
  "OPENAPI_INVOICE_RECONCILIATION_ENABLED", "POS_ARCHIVE_S3_LIVE_ENABLED",
  "POS_ARCHIVE_S3_READINESS_CONFIRMED",
  "POS_DE_LEGAL_REVIEW_CONFIRMED", "POS_DE_PILOT_ACCEPTED",
  "POS_DATABASE_CI_GATE_CONFIRMED", "FINAPI_LIVE_ENABLED", "FINAPI_LIVE_LICENSE_CONFIRMED",
  "FINAPI_LIVE_DATA_PROCESSING_CONFIRMED", "FINAPI_LIVE_USER_DELETION_PROCESS_CONFIRMED",
  "FISKALY_LIVE_ENABLED", "FISKALY_LIVE_LEGAL_REVIEW_CONFIRMED",
  "FISKALY_LIVE_CASH_SYSTEM_REGISTERED", "FISKALY_LIVE_DSFINVK_CONFORMANCE_CONFIRMED",
].forEach((name) => assert.match(envExample, new RegExp("^" + name + "=false$", "m"), name + " mora biti v predlogi fail-closed"));

const empty = readiness.assess({});
assert.strictEqual(empty.version, "pos-de-production-readiness-v17");
assert.strictEqual(empty.ready, false);
assert.strictEqual(empty.summary.blockingTotal, 8);
assert.strictEqual(empty.summary.blockingReady, 0);
assert.strictEqual(empty.checks.find((check) => check.id === "stripe_card_payments").blocking, false);
assert.strictEqual(empty.checks.find((check) => check.id === "finapi_bank_sync").blocking, true);
assert.strictEqual(empty.checks.find((check) => check.id === "fiskaly_tse").blocking, true);
assert.deepStrictEqual(empty.checks.find((check) => check.id === "fiskaly_tse").missing, [
  "cash_checkout_migration_not_deployed",
  "cash_refund_migration_not_deployed",
  "fiskaly_production_cash_db_path_locked",
  "FISKALY_SIGN_DE_MODE=production",
  "FISKALY_LIVE_ENABLED=true",
  "FISKALY_API_KEY_LIVE",
  "FISKALY_API_SECRET_LIVE",
  "FISKALY_TSS_ID_LIVE",
  "FISKALY_CLIENT_ID_LIVE",
  "FISKALY_LIVE_LEGAL_REVIEW_CONFIRMED=true",
  "FISKALY_LIVE_CASH_SYSTEM_REGISTERED=true",
  "FISKALY_LIVE_DSFINVK_CONFORMANCE_CONFIRMED=true",
]);
assert.strictEqual(empty.checks.find((check) => check.id === "fiskaly_tse").status, "training_provider_post_complete");
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
  finapiSecret: "finapi-secret-never-print",
  finapiUserKey: "0123456789abcdef0123456789abcdef",
};
const completeEnv = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: secretValues.anon,
  SUPABASE_SERVICE_ROLE_KEY: secretValues.service,
  POS_DATABASE_CI_GATE_CONFIRMED: "true",
  POS_DATABASE_CI_GATE_REFERENCE: "GITHUB-ACTIONS-POS-DB-2026-08-31",
  POS_DATABASE_CI_GATE_CONFIRMED_AT: new Date().toISOString(),
  POS_DATABASE_CI_GATE_MIGRATION_HEAD: "20260830213055",
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
assert.strictEqual(complete.ready, false);
assert.deepStrictEqual(complete.summary, {
  blockingTotal: 8,
  blockingReady: 6,
  blockingRemaining: 2,
  optionalNotReady: 4,
});
assert.strictEqual(complete.checks.find((check) => check.id === "openapi_einvoicing").status, "ready");
assert.strictEqual(complete.checks.find((check) => check.id === "supabase_core").status, "ready");
const finapiReadyEnv = Object.assign({}, completeEnv, {
  FINAPI_MODE: "production",
  FINAPI_LIVE_ENABLED: "true",
  FINAPI_LIVE_LICENSE_CONFIRMED: "true",
  FINAPI_LIVE_DATA_PROCESSING_CONFIRMED: "true",
  FINAPI_LIVE_USER_DELETION_PROCESS_CONFIRMED: "true",
  FINAPI_CLIENT_ID_LIVE: "finapi-live-client",
  FINAPI_CLIENT_SECRET_LIVE: secretValues.finapiSecret,
  FINAPI_USER_KEY_LIVE: secretValues.finapiUserKey,
  FINAPI_LIVE_PREFLIGHT_REFERENCE: "FINAPI-LIVE-PREFLIGHT-2026-08-31",
  FINAPI_LIVE_PREFLIGHT_CONFIRMED_AT: new Date().toISOString(),
});
const finapiReady = readiness.assess(finapiReadyEnv);
assert.strictEqual(finapiReady.checks.find((check) => check.id === "finapi_bank_sync").status, "ready");
assert.deepStrictEqual(finapiReady.summary, {
  blockingTotal: 8,
  blockingReady: 7,
  blockingRemaining: 1,
  optionalNotReady: 4,
});
const staleFinapiPreflight = readiness.assess(Object.assign({}, finapiReadyEnv, {
  FINAPI_LIVE_PREFLIGHT_CONFIRMED_AT: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
}));
assert.strictEqual(staleFinapiPreflight.checks.find((check) => check.id === "finapi_bank_sync").ready, false);
assert.ok(staleFinapiPreflight.checks.find((check) => check.id === "finapi_bank_sync").missing.includes("FINAPI_LIVE_PREFLIGHT_CONFIRMED_AT"));
const shortFinapiUserKey = readiness.assess(Object.assign({}, finapiReadyEnv, { FINAPI_USER_KEY_LIVE: "too-short" }));
assert.ok(shortFinapiUserKey.checks.find((check) => check.id === "finapi_bank_sync").missing.includes("FINAPI_USER_KEY_LIVE"));
const staleDatabaseCiGate = readiness.assess(Object.assign({}, completeEnv, {
  POS_DATABASE_CI_GATE_CONFIRMED_AT: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
}));
assert.strictEqual(staleDatabaseCiGate.checks.find((check) => check.id === "supabase_core").ready, false);
assert.ok(staleDatabaseCiGate.checks.find((check) => check.id === "supabase_core").missing.includes("POS_DATABASE_CI_GATE_CONFIRMED_AT"));
const wrongDatabaseMigrationHead = readiness.assess(Object.assign({}, completeEnv, {
  POS_DATABASE_CI_GATE_MIGRATION_HEAD: "20260830172315",
}));
assert.strictEqual(wrongDatabaseMigrationHead.checks.find((check) => check.id === "supabase_core").ready, false);
assert.ok(wrongDatabaseMigrationHead.checks.find((check) => check.id === "supabase_core").missing.includes("POS_DATABASE_CI_GATE_MIGRATION_HEAD=20260830213055"));
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

const expiringToken = readiness.assess(Object.assign({}, completeEnv, {
  OPENAPI_INVOICE_TOKEN_EXPIRES_AT: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
}));
assert.strictEqual(expiringToken.checks.find((check) => check.id === "openapi_einvoicing").ready, false);
assert.ok(expiringToken.checks.find((check) => check.id === "openapi_einvoicing").missing.includes("OPENAPI_INVOICE_TOKEN_EXPIRES_AT"));

const stalePublicPreflight = readiness.assess(Object.assign({}, completeEnv, {
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
}));
assert.strictEqual(stalePublicPreflight.checks.find((check) => check.id === "openapi_einvoicing").ready, false);
assert.ok(stalePublicPreflight.checks.find((check) => check.id === "openapi_einvoicing").missing.includes("OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT"));

const futurePublicPreflight = readiness.assess(Object.assign({}, completeEnv, {
  OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT: new Date(Date.now() + 6 * 60 * 1000).toISOString(),
}));
assert.strictEqual(futurePublicPreflight.checks.find((check) => check.id === "openapi_einvoicing").ready, false);
assert.ok(futurePublicPreflight.checks.find((check) => check.id === "openapi_einvoicing").missing.includes("OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT"));

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

const serialized = JSON.stringify([complete, finapiReady]);
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
