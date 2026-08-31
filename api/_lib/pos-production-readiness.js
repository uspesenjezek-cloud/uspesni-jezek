"use strict";

const openapiInvoice = require("./pos-openapi-invoice");
const deliveryProviders = require("./pos-delivery-providers");
const wormArchive = require("./pos-worm-archive");
const sandboxEvidenceVerifier = require("./pos-openapi-sandbox-evidence");
const sandbox381Evidence = require("../../scripts/fixtures/openapi-de-381-sandbox-evidence.json");

const VERSION = "pos-de-production-readiness-v17";
const MAX_ARCHIVE_READINESS_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_DATABASE_CI_GATE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CONFIRMATION_FUTURE_SKEW_MS = 5 * 60 * 1000;
const REQUIRED_DATABASE_MIGRATION_HEAD = "20260830213055";

function text(value) {
  return String(value == null ? "" : value).trim();
}

function enabled(value) {
  return text(value).toLowerCase() === "true";
}

function validHttpsUrl(value) {
  try {
    return new URL(text(value)).protocol === "https:";
  } catch (_) {
    return false;
  }
}

function validAuditReference(value) {
  const reference = text(value);
  return reference.length >= 8 && reference.length <= 160 && !/[\r\n]/.test(reference);
}

function validPastConfirmationAt(value) {
  const timestamp = Date.parse(text(value));
  return Number.isFinite(timestamp) && timestamp <= Date.now() + MAX_CONFIRMATION_FUTURE_SKEW_MS;
}

function freshConfirmationAt(value, maxAgeMs) {
  const timestamp = Date.parse(text(value));
  return Number.isFinite(timestamp)
    && timestamp >= Date.now() - maxAgeMs
    && timestamp <= Date.now() + MAX_CONFIRMATION_FUTURE_SKEW_MS;
}

function item(id, area, blocking, ready, status, missing, note) {
  return {
    id,
    area,
    blocking: Boolean(blocking),
    ready: Boolean(ready),
    status,
    missing: Array.from(new Set((missing || []).filter(Boolean))),
    note,
  };
}

function assess(env, options) {
  const source = env || process.env;
  const settings = options || {};
  const checks = [];

  const supabaseMissing = [];
  if (!validHttpsUrl(source.SUPABASE_URL)) supabaseMissing.push("SUPABASE_URL");
  if (!text(source.SUPABASE_ANON_KEY)) supabaseMissing.push("SUPABASE_ANON_KEY");
  if (!text(source.SUPABASE_SERVICE_ROLE_KEY)) supabaseMissing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!enabled(source.POS_DATABASE_CI_GATE_CONFIRMED)) supabaseMissing.push("POS_DATABASE_CI_GATE_CONFIRMED=true");
  if (!validAuditReference(source.POS_DATABASE_CI_GATE_REFERENCE)) supabaseMissing.push("POS_DATABASE_CI_GATE_REFERENCE");
  if (text(source.POS_DATABASE_CI_GATE_MIGRATION_HEAD) !== REQUIRED_DATABASE_MIGRATION_HEAD) {
    supabaseMissing.push("POS_DATABASE_CI_GATE_MIGRATION_HEAD=" + REQUIRED_DATABASE_MIGRATION_HEAD);
  }
  const databaseCiGateAt = Date.parse(text(source.POS_DATABASE_CI_GATE_CONFIRMED_AT));
  const databaseCiGateFresh = Number.isFinite(databaseCiGateAt)
    && databaseCiGateAt >= Date.now() - MAX_DATABASE_CI_GATE_AGE_MS
    && databaseCiGateAt <= Date.now() + MAX_CONFIRMATION_FUTURE_SKEW_MS;
  if (!databaseCiGateFresh) supabaseMissing.push("POS_DATABASE_CI_GATE_CONFIRMED_AT");
  checks.push(item(
    "supabase_core",
    "core",
    true,
    supabaseMissing.length === 0,
    supabaseMissing.length ? "blocked" : "ready",
    supabaseMissing,
    "Avtentikacija, podatkovna baza in strežniški RPC-ji; readiness zahteva svež CI dokaz točne Phase 0b migracijske verige, snapshot backfilla, pg_proc pravic in concurrency scenarijev."
  ));

  const openapi = openapiInvoice.readiness(source);
  const openapiMissing = [];
  if (!text(source.OPENAPI_INVOICE_TOKEN)) openapiMissing.push("OPENAPI_INVOICE_TOKEN");
  if (!text(source.OPENAPI_INVOICE_TOKEN_EXPIRES_AT) || !openapi.productionTokenFresh) openapiMissing.push("OPENAPI_INVOICE_TOKEN_EXPIRES_AT");
  if (text(source.OPENAPI_INVOICE_MODE).toLowerCase() !== "production") openapiMissing.push("OPENAPI_INVOICE_MODE=production");
  if (!enabled(source.POS_OPENAPI_INVOICE_ENABLED)) openapiMissing.push("POS_OPENAPI_INVOICE_ENABLED=true");
  if (!enabled(source.OPENAPI_INVOICE_SEND_ENABLED)) openapiMissing.push("OPENAPI_INVOICE_SEND_ENABLED=true");
  if (text(source.OPENAPI_INVOICE_WEBHOOK_SECRET).length < 32) openapiMissing.push("OPENAPI_INVOICE_WEBHOOK_SECRET");
  if (!validHttpsUrl(source.OPENAPI_INVOICE_WEBHOOK_URL)) openapiMissing.push("OPENAPI_INVOICE_WEBHOOK_URL");
  if (!enabled(source.OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED)) openapiMissing.push("OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED=true");
  if (text(source.OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL) !== text(source.OPENAPI_INVOICE_WEBHOOK_URL)) openapiMissing.push("OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL");
  const publicPreflightDependenciesValid = enabled(source.OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_CONFIRMED)
    && text(source.OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_URL) === text(source.OPENAPI_INVOICE_WEBHOOK_URL)
    && openapi.webhookConfigured;
  if (!text(source.OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT)
    || (publicPreflightDependenciesValid && !openapi.webhookPublicPreflightConfirmed)) {
    openapiMissing.push("OPENAPI_INVOICE_WEBHOOK_PUBLIC_PREFLIGHT_AT");
  }
  checks.push(item(
    "openapi_einvoicing",
    "core",
    true,
    openapi.liveEnabled,
    openapi.liveEnabled ? "ready" : "blocked",
    openapiMissing.concat(openapi.blockers || []),
    "Produkcijska dostava ZUGFeRD/XRechnung prek Openapi."
  ));

  const evidence = Object.prototype.hasOwnProperty.call(settings, "sandbox381Evidence")
    ? settings.sandbox381Evidence
    : sandbox381Evidence;
  const sandbox381Proof = sandboxEvidenceVerifier.controlledSandboxEvidence(evidence);
  const financialAdjustmentsReady = Boolean(openapi.financialAdjustmentsEnabled && sandbox381Proof.successful);
  const financialAdjustmentMissing = financialAdjustmentsReady
    ? []
    : [openapi.requestedMode === "production"
      ? (!sandbox381Proof.successful
        ? "controlled_sandbox_381_evidence_invalid"
        : (openapi.financialAdjustmentBlocker || "openapi_delivery_not_enabled"))
      : "openapi_delivery_not_enabled"];
  checks.push(item(
    "openapi_financial_adjustments",
    "core",
    true,
    financialAdjustmentsReady,
    financialAdjustmentsReady ? "ready" : "blocked",
    financialAdjustmentMissing,
    "Sandbox Storno in Gutschrift (UN/CEFACT tip 381) sta dosegla SENT / succeeded. Produkcijski tip 381 je omogočen samo skupaj z vsemi splošnimi Openapi produkcijskimi varovalkami."
  ));

  const multiCompanyOnboardingReady = enabled(source.OPENAPI_INVOICE_ALLOW_CONFIGURATION_CREATE)
    && enabled(source.OPENAPI_INVOICE_ALLOW_CONFIGURATION_UPDATE);
  checks.push(item(
    "openapi_multi_company_onboarding",
    "optional",
    false,
    multiCompanyOnboardingReady,
    multiCompanyOnboardingReady ? "approved" : "cost_locked",
    multiCompanyOnboardingReady ? [] : [
      "OPENAPI_INVOICE_ALLOW_CONFIGURATION_CREATE=true",
      "OPENAPI_INVOICE_ALLOW_CONFIGURATION_UPDATE=true",
    ],
    "Samodejno ustvarjanje ali usklajevanje pravne osebe je plačljiva možnost in ostaja zaklenjeno brez ločene poslovne odobritve."
  ));

  checks.push(item(
    "openapi_webhook_reconciliation",
    "optional",
    false,
    openapi.reconciliationEnabled,
    openapi.reconciliationEnabled ? "approved" : "cost_locked",
    openapi.reconciliationEnabled ? [] : ["OPENAPI_INVOICE_RECONCILIATION_ENABLED=true"],
    "Obnova izgubljenih callbackov uporablja omejene, vendar lahko plačljive GET klice in se zato vključi samo izrecno."
  ));

  let archive = null;
  let archiveError = "";
  try {
    archive = wormArchive.configuration(source);
  } catch (error) {
    archiveError = text(error && error.code) || "ARCHIVE_CONFIGURATION_INVALID";
  }
  const archiveMissing = [];
  if (!text(source.POS_ARCHIVE_S3_BUCKET)) archiveMissing.push("POS_ARCHIVE_S3_BUCKET");
  if (!text(source.POS_ARCHIVE_S3_ACCESS_KEY_ID)) archiveMissing.push("POS_ARCHIVE_S3_ACCESS_KEY_ID");
  if (!text(source.POS_ARCHIVE_S3_SECRET_ACCESS_KEY)) archiveMissing.push("POS_ARCHIVE_S3_SECRET_ACCESS_KEY");
  if (!enabled(source.POS_ARCHIVE_S3_LIVE_ENABLED)) archiveMissing.push("POS_ARCHIVE_S3_LIVE_ENABLED=true");
  if (!enabled(source.POS_ARCHIVE_S3_READINESS_CONFIRMED)) archiveMissing.push("POS_ARCHIVE_S3_READINESS_CONFIRMED=true");
  const archiveReadinessBucketMatches = text(source.POS_ARCHIVE_S3_READINESS_CONFIRMED_BUCKET) === text(source.POS_ARCHIVE_S3_BUCKET);
  if (!archiveReadinessBucketMatches) archiveMissing.push("POS_ARCHIVE_S3_READINESS_CONFIRMED_BUCKET");
  const archiveReadinessAtMs = Date.parse(text(source.POS_ARCHIVE_S3_READINESS_CONFIRMED_AT));
  const archiveReadinessFresh = Number.isFinite(archiveReadinessAtMs)
    && archiveReadinessAtMs >= Date.now() - MAX_ARCHIVE_READINESS_AGE_MS
    && archiveReadinessAtMs <= Date.now() + MAX_CONFIRMATION_FUTURE_SKEW_MS;
  if (!archiveReadinessFresh) archiveMissing.push("POS_ARCHIVE_S3_READINESS_CONFIRMED_AT");
  if (archiveError) archiveMissing.push(archiveError);
  const archiveEnvironmentReady = Boolean(archive && archive.configured && archive.liveEnabled
    && enabled(source.POS_ARCHIVE_S3_READINESS_CONFIRMED)
    && archiveReadinessBucketMatches
    && archiveReadinessFresh);
  checks.push(item(
    "gobd_worm_archive",
    "core",
    true,
    archiveEnvironmentReady,
    archiveEnvironmentReady ? "ready" : "blocked",
    archiveMissing,
    "Potrditev WORM readinessa mora biti sveža, vezana na točen S3 predal in nastavljena šele po uspešnem pos_archive_readiness dokazu za Object Lock, ločeno kopijo in obnovitveni preizkus."
  ));

  const legalReviewMissing = [];
  if (!enabled(source.POS_DE_LEGAL_REVIEW_CONFIRMED)) legalReviewMissing.push("POS_DE_LEGAL_REVIEW_CONFIRMED=true");
  if (!validAuditReference(source.POS_DE_LEGAL_REVIEW_REFERENCE)) legalReviewMissing.push("POS_DE_LEGAL_REVIEW_REFERENCE");
  if (!validPastConfirmationAt(source.POS_DE_LEGAL_REVIEW_CONFIRMED_AT)) legalReviewMissing.push("POS_DE_LEGAL_REVIEW_CONFIRMED_AT");
  const legalReviewReady = legalReviewMissing.length === 0;
  checks.push(item(
    "german_legal_review",
    "external_confirmation",
    true,
    legalReviewReady,
    legalReviewReady ? "confirmed" : "pending",
    legalReviewMissing,
    "Končni pregled nemškega davčnega oziroma pravnega strokovnjaka mora imeti čas in interno auditno referenco brez osebnih podatkov."
  ));

  const pilotMissing = [];
  if (!enabled(source.POS_DE_PILOT_ACCEPTED)) pilotMissing.push("POS_DE_PILOT_ACCEPTED=true");
  if (!validAuditReference(source.POS_DE_PILOT_REFERENCE)) pilotMissing.push("POS_DE_PILOT_REFERENCE");
  if (!validPastConfirmationAt(source.POS_DE_PILOT_ACCEPTED_AT)) pilotMissing.push("POS_DE_PILOT_ACCEPTED_AT");
  const pilotReady = pilotMissing.length === 0;
  checks.push(item(
    "merchant_pilot",
    "external_confirmation",
    true,
    pilotReady,
    pilotReady ? "confirmed" : "pending",
    pilotMissing,
    "Potrjen pilot z dejanskim nemškim podjetjem in prejemnikom mora imeti čas in interno auditno referenco brez osebnih podatkov."
  ));

  const email = deliveryProviders.deliveryReadiness(source);
  checks.push(item(
    "resend_email",
    "optional",
    false,
    email.liveEnabled && email.webhookConfigured,
    email.liveEnabled && email.webhookConfigured ? "ready" : "optional_not_ready",
    [],
    "Neobvezna neposredna e-poštna dostava; Openapi ostaja primarna e-računska pot."
  ));

  checks.push(item(
    "stripe_card_payments",
    "optional",
    false,
    false,
    "sandbox_only",
    [],
    "Kartično plačevanje je namenoma omejeno na Stripe TEST; SEPA in ročna potrditev ostajata na voljo."
  ));
  const finapiMissing = [];
  if (text(source.FINAPI_MODE).toLowerCase() !== "production") finapiMissing.push("FINAPI_MODE=production");
  if (!enabled(source.FINAPI_LIVE_ENABLED)) finapiMissing.push("FINAPI_LIVE_ENABLED=true");
  if (!enabled(source.FINAPI_LIVE_LICENSE_CONFIRMED)) finapiMissing.push("FINAPI_LIVE_LICENSE_CONFIRMED=true");
  if (!enabled(source.FINAPI_LIVE_DATA_PROCESSING_CONFIRMED)) finapiMissing.push("FINAPI_LIVE_DATA_PROCESSING_CONFIRMED=true");
  if (!enabled(source.FINAPI_LIVE_USER_DELETION_PROCESS_CONFIRMED)) finapiMissing.push("FINAPI_LIVE_USER_DELETION_PROCESS_CONFIRMED=true");
  if (!text(source.FINAPI_CLIENT_ID_LIVE)) finapiMissing.push("FINAPI_CLIENT_ID_LIVE");
  if (!text(source.FINAPI_CLIENT_SECRET_LIVE)) finapiMissing.push("FINAPI_CLIENT_SECRET_LIVE");
  if (text(source.FINAPI_USER_KEY_LIVE).length < 32) finapiMissing.push("FINAPI_USER_KEY_LIVE");
  if (!validAuditReference(source.FINAPI_LIVE_PREFLIGHT_REFERENCE)) finapiMissing.push("FINAPI_LIVE_PREFLIGHT_REFERENCE");
  if (!freshConfirmationAt(source.FINAPI_LIVE_PREFLIGHT_CONFIRMED_AT, MAX_DATABASE_CI_GATE_AGE_MS)) {
    finapiMissing.push("FINAPI_LIVE_PREFLIGHT_CONFIRMED_AT");
  }
  const finapiReady = finapiMissing.length === 0;
  checks.push(item(
    "finapi_bank_sync",
    "core",
    true,
    finapiReady,
    finapiReady ? "ready" : "blocked",
    finapiMissing,
    "Produkcijski finAPI uporablja ločene poverilnice in ostane fail-closed brez licence, potrditve obdelave podatkov, potrjenega operativnega postopka izbrisa uporabnikov ter svežega preflight dokaza."
  ));
  checks.push(item(
    "datev_cloud_transfer",
    "optional",
    false,
    false,
    "sandbox_only",
    [],
    "DATEV prenos je mock/sandbox; preverljivi EXTF izvoz ostaja na voljo."
  ));
  const fiskalyMissing = [
    "cash_checkout_migration_not_deployed",
    "cash_refund_migration_not_deployed",
    "fiskaly_production_cash_db_path_locked",
  ];
  if (text(source.FISKALY_SIGN_DE_MODE).toLowerCase() !== "production") fiskalyMissing.push("FISKALY_SIGN_DE_MODE=production");
  if (!enabled(source.FISKALY_LIVE_ENABLED)) fiskalyMissing.push("FISKALY_LIVE_ENABLED=true");
  if (!text(source.FISKALY_API_KEY_LIVE)) fiskalyMissing.push("FISKALY_API_KEY_LIVE");
  if (!text(source.FISKALY_API_SECRET_LIVE)) fiskalyMissing.push("FISKALY_API_SECRET_LIVE");
  if (!text(source.FISKALY_TSS_ID_LIVE)) fiskalyMissing.push("FISKALY_TSS_ID_LIVE");
  if (!text(source.FISKALY_CLIENT_ID_LIVE)) fiskalyMissing.push("FISKALY_CLIENT_ID_LIVE");
  if (!enabled(source.FISKALY_LIVE_LEGAL_REVIEW_CONFIRMED)) fiskalyMissing.push("FISKALY_LIVE_LEGAL_REVIEW_CONFIRMED=true");
  if (!enabled(source.FISKALY_LIVE_CASH_SYSTEM_REGISTERED)) fiskalyMissing.push("FISKALY_LIVE_CASH_SYSTEM_REGISTERED=true");
  if (!enabled(source.FISKALY_LIVE_DSFINVK_CONFORMANCE_CONFIRMED)) fiskalyMissing.push("FISKALY_LIVE_DSFINVK_CONFORMANCE_CONFIRMED=true");
  checks.push(item(
    "fiskaly_tse",
    "core",
    true,
    false,
    "training_provider_post_complete",
    fiskalyMissing,
    "TEST/TRAINING in notranji produkcijski SALE/RECEIPT POST sta implementirana z ločenimi poverilnicami. Produkcija ostaja blokirana, dokler produkcijski podpis ni povezan z atomarnim DB checkout tokom, migraciji nista deployani ter niso potrjeni pravni, registracijski in DSFinV-K pogoji."
  ));

  const blocking = checks.filter((check) => check.blocking);
  const readyBlocking = blocking.filter((check) => check.ready);
  return {
    version: VERSION,
    ready: blocking.length === readyBlocking.length,
    summary: {
      blockingTotal: blocking.length,
      blockingReady: readyBlocking.length,
      blockingRemaining: blocking.length - readyBlocking.length,
      optionalNotReady: checks.filter((check) => !check.blocking && !check.ready).length,
    },
    checks,
  };
}

module.exports = { VERSION, assess, enabled, freshConfirmationAt, validAuditReference, validHttpsUrl, validPastConfirmationAt };
