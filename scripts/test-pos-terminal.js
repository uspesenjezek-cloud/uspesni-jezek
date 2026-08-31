"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.basename(__dirname).toLowerCase() === "scripts"
  ? path.resolve(__dirname, "..")
  : path.resolve(__dirname, "..");
const assetRoot = path.basename(__dirname).toLowerCase() === "scripts"
  ? path.join(repoRoot, "app")
  : __dirname;
const html = fs.readFileSync(path.join(assetRoot, "pos-terminal.html"), "utf8");
const css = fs.readFileSync(path.join(assetRoot, "pos-terminal.css"), "utf8");
const js = fs.readFileSync(path.join(assetRoot, "pos-terminal.js"), "utf8");
const migrationRoot = path.basename(__dirname).toLowerCase() === "scripts" ? repoRoot : path.resolve(__dirname);
const migrationsDir = path.join(migrationRoot, "supabase", "migrations");
const kositPreflightMigration = fs.readFileSync(path.join(migrationsDir, "20260823181854_pos_kosit_preflight_evidence.sql"), "utf8");
const migrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_terminal_core\.sql$/.test(name)).sort().pop()
  : null;
const migration = migrationName ? fs.readFileSync(path.join(migrationsDir, migrationName), "utf8") : "";
const issueConcurrencyMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_invoice_issue_concurrency_idempotency\.sql$/.test(name)).sort().pop()
  : null;
const issueConcurrencyMigration = issueConcurrencyMigrationName ? fs.readFileSync(path.join(migrationsDir, issueConcurrencyMigrationName), "utf8") : "";
const payloadLimitsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_invoice_payload_limits\.sql$/.test(name)).sort().pop()
  : null;
const payloadLimitsMigration = payloadLimitsMigrationName ? fs.readFileSync(path.join(migrationsDir, payloadLimitsMigrationName), "utf8") : "";
const payloadInvokerMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_invoice_payload_invoker_wrappers\.sql$/.test(name)).sort().pop()
  : null;
const payloadInvokerMigration = payloadInvokerMigrationName ? fs.readFileSync(path.join(migrationsDir, payloadInvokerMigrationName), "utf8") : "";
const manualPaymentMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_manual_payment_rpc\.sql$/.test(name)).sort().pop()
  : null;
const manualPaymentMigration = manualPaymentMigrationName ? fs.readFileSync(path.join(migrationsDir, manualPaymentMigrationName), "utf8") : "";
const manualPaymentRetryMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_manual_payment_retry_idempotency\.sql$/.test(name)).sort().pop()
  : null;
const manualPaymentRetryMigration = manualPaymentRetryMigrationName ? fs.readFileSync(path.join(migrationsDir, manualPaymentRetryMigrationName), "utf8") : "";
const profilePrivilegesMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_profile_sequence_privileges\.sql$/.test(name)).sort().pop()
  : null;
const profilePrivilegesMigration = profilePrivilegesMigrationName ? fs.readFileSync(path.join(migrationsDir, profilePrivilegesMigrationName), "utf8") : "";
const documentsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_invoice_documents\.sql$/.test(name)).sort().pop()
  : null;
const documentsMigration = documentsMigrationName ? fs.readFileSync(path.join(migrationsDir, documentsMigrationName), "utf8") : "";
const adjustmentsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_invoice_adjustments\.sql$/.test(name)).sort().pop()
  : null;
const adjustmentsMigration = adjustmentsMigrationName ? fs.readFileSync(path.join(migrationsDir, adjustmentsMigrationName), "utf8") : "";
const adjustmentLimitsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_adjustment_payload_limits\.sql$/.test(name)).sort().pop()
  : null;
const adjustmentLimitsMigration = adjustmentLimitsMigrationName ? fs.readFileSync(path.join(migrationsDir, adjustmentLimitsMigrationName), "utf8") : "";
const adjustmentRetryMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_adjustment_retry_idempotency\.sql$/.test(name)).sort().pop()
  : null;
const adjustmentRetryMigration = adjustmentRetryMigrationName ? fs.readFileSync(path.join(migrationsDir, adjustmentRetryMigrationName), "utf8") : "";
const adjustmentRetryIndexMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_adjustment_request_fk_index\.sql$/.test(name)).sort().pop()
  : null;
const adjustmentRetryIndexMigration = adjustmentRetryIndexMigrationName ? fs.readFileSync(path.join(migrationsDir, adjustmentRetryIndexMigrationName), "utf8") : "";
const adjustmentSourceMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_adjustment_source_invariants\.sql$/.test(name)).sort().pop()
  : null;
const adjustmentSourceMigration = adjustmentSourceMigrationName ? fs.readFileSync(path.join(migrationsDir, adjustmentSourceMigrationName), "utf8") : "";
const adjustmentNullGuardsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_adjustment_null_guards\.sql$/.test(name)).sort().pop()
  : null;
const adjustmentNullGuardsMigration = adjustmentNullGuardsMigrationName ? fs.readFileSync(path.join(migrationsDir, adjustmentNullGuardsMigrationName), "utf8") : "";
const businessProfileInvariantsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_business_profile_invariants\.sql$/.test(name)).sort().pop()
  : null;
const businessProfileInvariantsMigration = businessProfileInvariantsMigrationName ? fs.readFileSync(path.join(migrationsDir, businessProfileInvariantsMigrationName), "utf8") : "";
const profileReconfirmationMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_profile_reconfirmation\.sql$/.test(name)).sort().pop()
  : null;
const profileReconfirmationMigration = profileReconfirmationMigrationName ? fs.readFileSync(path.join(migrationsDir, profileReconfirmationMigrationName), "utf8") : "";
const sellerLegalIdentityMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_seller_legal_identity\.sql$/.test(name)).sort().pop()
  : null;
const sellerLegalIdentityMigration = sellerLegalIdentityMigrationName ? fs.readFileSync(path.join(migrationsDir, sellerLegalIdentityMigrationName), "utf8") : "";
const expandedLegalFormsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_expand_german_legal_forms\.sql$/.test(name)).sort().pop()
  : null;
const expandedLegalFormsMigration = expandedLegalFormsMigrationName ? fs.readFileSync(path.join(migrationsDir, expandedLegalFormsMigrationName), "utf8") : "";
const germanTaxReceivingMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_german_tax_receiving_readiness\.sql$/.test(name)).sort().pop()
  : null;
const germanTaxReceivingMigration = germanTaxReceivingMigrationName ? fs.readFileSync(path.join(migrationsDir, germanTaxReceivingMigrationName), "utf8") : "";
const invoicePartyValidationMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_invoice_party_validation\.sql$/.test(name)).sort().pop()
  : null;
const invoicePartyValidationMigration = invoicePartyValidationMigrationName ? fs.readFileSync(path.join(migrationsDir, invoicePartyValidationMigrationName), "utf8") : "";
const invoiceEinvoicePartyRequirementsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_invoice_einvoice_party_requirements\.sql$/.test(name)).sort().pop()
  : null;
const invoiceEinvoicePartyRequirementsMigration = invoiceEinvoicePartyRequirementsMigrationName ? fs.readFileSync(path.join(migrationsDir, invoiceEinvoicePartyRequirementsMigrationName), "utf8") : "";
const invoiceTaxEvidenceRequirementsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_invoice_tax_evidence_requirements\.sql$/.test(name)).sort().pop()
  : null;
const invoiceTaxEvidenceRequirementsMigration = invoiceTaxEvidenceRequirementsMigrationName ? fs.readFileSync(path.join(migrationsDir, invoiceTaxEvidenceRequirementsMigrationName), "utf8") : "";
const alreadyPaidInvoicePaymentMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_already_paid_invoice_payment\.sql$/.test(name)).sort().pop()
  : null;
const alreadyPaidInvoicePaymentMigration = alreadyPaidInvoicePaymentMigrationName ? fs.readFileSync(path.join(migrationsDir, alreadyPaidInvoicePaymentMigrationName), "utf8") : "";
const germanBusinessTimezoneMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_german_business_timezone\.sql$/.test(name)).sort().pop()
  : null;
const germanBusinessTimezoneMigration = germanBusinessTimezoneMigrationName ? fs.readFileSync(path.join(migrationsDir, germanBusinessTimezoneMigrationName), "utf8") : "";
const positiveTotalMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_invoice_positive_total\.sql$/.test(name)).sort().pop()
  : null;
const positiveTotalMigration = positiveTotalMigrationName ? fs.readFileSync(path.join(migrationsDir, positiveTotalMigrationName), "utf8") : "";
const privateRpcSurfaceMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_private_rpc_surface\.sql$/.test(name)).sort().pop()
  : null;
const privateRpcSurfaceMigration = privateRpcSurfaceMigrationName ? fs.readFileSync(path.join(migrationsDir, privateRpcSurfaceMigrationName), "utf8") : "";
const replacementsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_replacement_invoices\.sql$/.test(name)).sort().pop()
  : null;
const replacementsMigration = replacementsMigrationName ? fs.readFileSync(path.join(migrationsDir, replacementsMigrationName), "utf8") : "";
const deliveriesMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_invoice_delivery_outbox\.sql$/.test(name)).sort().pop()
  : null;
const deliveriesMigration = deliveriesMigrationName ? fs.readFileSync(path.join(migrationsDir, deliveriesMigrationName), "utf8") : "";
const xrechnungMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_xrechnung_documents\.sql$/.test(name)).sort().pop()
  : null;
const xrechnungMigration = xrechnungMigrationName ? fs.readFileSync(path.join(migrationsDir, xrechnungMigrationName), "utf8") : "";
const bankMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_bank_reconciliation\.sql$/.test(name)).sort().pop()
  : null;
const bankMigration = bankMigrationName ? fs.readFileSync(path.join(migrationsDir, bankMigrationName), "utf8") : "";
const finapiMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_finapi_bank_provider\.sql$/.test(name)).sort().pop()
  : null;
const finapiMigration = finapiMigrationName ? fs.readFileSync(path.join(migrationsDir, finapiMigrationName), "utf8") : "";
const bankLimitsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_bank_import_payload_limits\.sql$/.test(name)).sort().pop()
  : null;
const bankLimitsMigration = bankLimitsMigrationName ? fs.readFileSync(path.join(migrationsDir, bankLimitsMigrationName), "utf8") : "";
const internalJsonLimitsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_internal_json_limits\.sql$/.test(name)).sort().pop()
  : null;
const internalJsonLimitsMigration = internalJsonLimitsMigrationName ? fs.readFileSync(path.join(migrationsDir, internalJsonLimitsMigrationName), "utf8") : "";
const moneyInvariantsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_money_invariants\.sql$/.test(name)).sort().pop()
  : null;
const moneyInvariantsMigration = moneyInvariantsMigrationName ? fs.readFileSync(path.join(migrationsDir, moneyInvariantsMigrationName), "utf8") : "";
const dateInvariantsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_date_invariants\.sql$/.test(name)).sort().pop()
  : null;
const dateInvariantsMigration = dateInvariantsMigrationName ? fs.readFileSync(path.join(migrationsDir, dateInvariantsMigrationName), "utf8") : "";
const liveCalendarMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_live_invoice_calendar_dates\.sql$/.test(name)).sort().pop()
  : null;
const liveCalendarMigration = liveCalendarMigrationName ? fs.readFileSync(path.join(migrationsDir, liveCalendarMigrationName), "utf8") : "";
const liveBauabzugMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_live_construction_withholding_lock\.sql$/.test(name)).sort().pop()
  : null;
const liveBauabzugMigration = liveBauabzugMigrationName ? fs.readFileSync(path.join(migrationsDir, liveBauabzugMigrationName), "utf8") : "";
const tenantInvariantsMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_tenant_relationship_invariants\.sql$/.test(name)).sort().pop()
  : null;
const tenantInvariantsMigration = tenantInvariantsMigrationName ? fs.readFileSync(path.join(migrationsDir, tenantInvariantsMigrationName), "utf8") : "";
const tenantIndexesMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_tenant_foreign_key_indexes\.sql$/.test(name)).sort().pop()
  : null;
const tenantIndexesMigration = tenantIndexesMigrationName ? fs.readFileSync(path.join(migrationsDir, tenantIndexesMigrationName), "utf8") : "";
const finapiAccountMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /add_finapi_source_account\.sql$/.test(name)).sort().pop()
  : null;
const finapiAccountMigration = finapiAccountMigrationName ? fs.readFileSync(path.join(migrationsDir, finapiAccountMigrationName), "utf8") : "";
const datevMigrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).filter((name) => /pos_datev_export_settings\.sql$/.test(name)).sort().pop()
  : null;
const datevMigration = datevMigrationName ? fs.readFileSync(path.join(migrationsDir, datevMigrationName), "utf8") : "";
const apiRoot = path.basename(__dirname).toLowerCase() === "scripts" ? path.join(repoRoot, "api") : path.join(repoRoot, "api");
const pdfApi = fs.existsSync(path.join(apiRoot, "_handlers", "pos-racun-pdf.js")) ? fs.readFileSync(path.join(apiRoot, "_handlers", "pos-racun-pdf.js"), "utf8") : "";
const xrechnungApi = fs.existsSync(path.join(apiRoot, "_handlers", "pos-racun-xrechnung.js")) ? fs.readFileSync(path.join(apiRoot, "_handlers", "pos-racun-xrechnung.js"), "utf8") : "";
const deliveryApi = fs.existsSync(path.join(apiRoot, "_handlers", "pos-dostava-sandbox.js")) ? fs.readFileSync(path.join(apiRoot, "_handlers", "pos-dostava-sandbox.js"), "utf8") : "";
const deliveryWorkerApi = fs.existsSync(path.join(apiRoot, "_lib", "pos-delivery-worker.js")) ? fs.readFileSync(path.join(apiRoot, "_lib", "pos-delivery-worker.js"), "utf8") : "";
const deliveryEmailApi = fs.existsSync(path.join(apiRoot, "_handlers", "pos-dostava-email.js")) ? fs.readFileSync(path.join(apiRoot, "_handlers", "pos-dostava-email.js"), "utf8") : "";
const adjustmentPdfApi = fs.existsSync(path.join(apiRoot, "_handlers", "pos-racun-korekcija.js")) ? fs.readFileSync(path.join(apiRoot, "_handlers", "pos-racun-korekcija.js"), "utf8") : "";
const compatibilityWrappers = [
  "pos-racun-pdf", "pos-racun-korekcija", "pos-racun-xrechnung", "pos-dostava-sandbox", "pos-dostava-delavec"
].map(function (name) { return fs.readFileSync(path.join(apiRoot, name + ".js"), "utf8"); });
const finapiApi = fs.existsSync(path.join(apiRoot, "_handlers", "pos-finapi.js")) ? fs.readFileSync(path.join(apiRoot, "_handlers", "pos-finapi.js"), "utf8") : "";
const finapiLib = fs.existsSync(path.join(apiRoot, "_lib", "finapi-access.js")) ? fs.readFileSync(path.join(apiRoot, "_lib", "finapi-access.js"), "utf8") : "";
const Core = require(path.join(assetRoot, "pos-terminal.js"));
const requestJson = require(path.join(repoRoot, "api", "_lib", "pos-request-json.js"));
assert.deepStrictEqual(requestJson({ headers: {}, body: '{"action":"test"}' }, 4096), { action: "test" });
assert.throws(() => requestJson({ headers: { "content-length": "5000" }, body: {} }, 4096), (error) => error && error.status === 413 && error.code === "POS_REQUEST_BODY_TOO_LARGE");
assert.throws(() => requestJson({ headers: {}, body: { payload: "x".repeat(5000) } }, 4096), (error) => error && error.status === 413);
assert.throws(() => requestJson({ headers: {}, body: "[1,2,3]" }, 4096), (error) => error && error.status === 400);

compatibilityWrappers.forEach(function (source) {
  assert.match(source, /module\.exports = require\("\.\/_handlers\/pos-[a-z-]+"\);/);
  assert.ok(source.trim().split(/\r?\n/).length <= 3, "POS združljivostna pot ne sme podvajati produkcijskega handlerja.");
});

assert.match(html, /data-view="home"/);
assert.match(html, /pos-terminal\.css\?v=202608(?:2[2-9]|3[01])-[^"']+/);
assert.match(css, /\.pos-app \[hidden\]\s*\{[^}]*display:\s*none !important/);
assert.match(html, /pos-terminal\.js\?v=202608(?:2[2-9]|3[01])-[^"']+/);
assert.match(html, /pos-dsfinvk\.js\?v=20260826-cash-recovery-export-v1/);
assert.match(html, /data-cash-payment-panel/);
assert.match(html, /data-cash-deposit/);
assert.match(html, /data-cash-withdrawal/);
assert.match(html, /data-dsfinvk-export/);
assert.match(html, /data-step="1" aria-current="step"/);
assert.match(js, /button\.setAttribute\("aria-current", "step"\)[\s\S]*button\.removeAttribute\("aria-current"\)/);
assert.match(js, /setAttribute\("aria-invalid", "true"\)[\s\S]*focus\(\{ preventScroll: false \}\)/);
assert.match(js, /classList\.remove\("is-invalid"\)[\s\S]*removeAttribute\("aria-invalid"\)/);
assert.match(js, /function hideToast\(\)[\s\S]*toast\.textContent = ""/);
assert.match(js, /function closeEditor\(\)[\s\S]*hideToast\(\)[\s\S]*showView\("home"\)/);
assert.match(js, /function setStep\(step, validateCurrent\)[\s\S]*showToast\(errors\[0\]\)[\s\S]*return false;[\s\S]*hideToast\(\);[\s\S]*currentStep = clamp/);
assert.match(html, /data-view="settings"/);
assert.match(html, /data-view="invoice"/);
assert.match(css, /\.pos-view--editor\s*\{[^}]*padding:\s*0 12px calc\(142px \+ env\(safe-area-inset-bottom\)\)/);
assert.match(html, /Fizična oseba/);
assert.match(html, /Javni naročnik/);
assert.match(html, /Leitweg-ID/);
assert.match(html, /name="businessEmail"/);
assert.match(html, /Kleinunternehmer/);
assert.match(html, /Reverse charge/);
assert.match(html, /Handwerkerleistung § 35a/);
assert.match(html, /Bauleistung \/ § 48 EStG/);
assert.match(html, /30-dnevno opozorilo/);
assert.match(html, /data-sync-state/);
assert.match(html, /data-view="invoice-detail"/);
assert.match(html, /data-detail-download/);
assert.match(html, /data-adjustment-backdrop/);
assert.match(html, /value="correction"/);
assert.match(html, /value="cancellation"/);
assert.match(html, /data-replacement-banner/);
assert.match(html, /data-detail-replacement/);
assert.match(html, /data-detail-send/);
assert.match(html, /data-delivery-backdrop/);
assert.match(html, /data-detail-deliveries-list/);
assert.match(html, /data-detail-payments-section/);
assert.match(html, /data-detail-payments-list/);
assert.match(html, /data-view="invoices"/);
assert.match(html, /data-invoice-overview-list/);
assert.match(html, /data-invoice-search/);
assert.match(html, /data-invoice-filter="overdue"/);
assert.match(html, /data-detail-einvoice/);
assert.match(html, /data-structured-buyer-reference/);
assert.match(html, /data-bank-backdrop/);
assert.match(html, /data-bank-list/);
assert.match(html, /data-bank-import-another/);
assert.match(html, /data-finapi-bank-sync/);
assert.match(html, /finAPI testna banka/);
assert.match(html, /data-datev-backdrop/);
assert.match(html, /DATEV Buchungsstapel/);
assert.match(html, /name="datevAdviserNumber"/);
assert.match(html, /name="datevClientNumber"/);
assert.match(html, /data-datev-download/);
assert.strictEqual((html.match(/role="dialog" aria-modal="true"[^>]*tabindex="-1"/g) || []).length, 6, "Vsi POS dialogi morajo imeti programatsko fokusno tarčo.");
assert.match(html, /name="previousYearTurnoverBand"/);
assert.match(html, /data-replacement-title data-fit-text data-fit-max="12"/);
assert.match(js, /rpcName = replacement \? "pos_issue_replacement_invoice" : "pos_issue_invoice"/);
assert.match(js, /\.rpc\(rpcName, rpcPayload\)/);
assert.match(js, /\.from\("pos_business_profiles"\)/);
assert.match(js, /typeof supabaseKlient !== "undefined" && supabaseKlient && supabaseKlient\.auth/);
assert.doesNotMatch(js, /global\.supabaseKlient/);
assert.match(js, /displayProfile = profileForPreview\(profile, invoice\.isTest\)/);
assert.match(js, /state\.invoices = applyLocalCashCheckouts\(mergeInvoiceSources\(serverInvoices, localTests\), state\.cashCheckouts\)/);
assert.match(js, /function activateModal\(backdrop, close, preferredFocus\)/);
assert.match(js, /function deactivateModal\(backdrop\)/);
assert.match(js, /function handleModalKeydown\(event\)/);
assert.match(js, /event\.key === "Escape"/);
assert.match(js, /event\.key !== "Tab"/);
assert.match(js, /document\.addEventListener\("keydown", handleModalKeydown, true\)/);
assert.match(js, /field\.tagName === "SELECT"/);
assert.match(js, /field\.selectedOptions\[0\]\.textContent/);
assert.match(js, /var arrowReserve = isSelect \? 28 : 4/);
assert.match(js, /field\.style\.setProperty\("font-size", max \+ "px", "important"\)/);
assert.match(js, /activateModal\(query\("\[data-bank-backdrop\]"\), closeBankSheet/);
assert.match(js, /deactivateModal\(query\("\[data-bank-backdrop\]"\)\)/);
assert.match(js, /async function fetchAllRows\(buildQuery, pageSize\)/);
assert.match(js, /buildQuery\(\)\.range\(offset, offset \+ size - 1\)/);
assert.match(js, /fetchAllRows\(function \(\) \{ return backend\.client\.from\("pos_invoices"\)/);
assert.match(js, /fetchAllRows\(function \(\) \{ return backend\.client\.from\("pos_payments"\)/);
assert.match(js, /fetchAllRows\(function \(\) \{ return backend\.client\.from\("pos_work_orders"\)/);
assert.doesNotMatch(js, /\.from\("pos_invoices"\)[^;\n]*\.limit\(100\)/);
assert.doesNotMatch(js, /\.from\("pos_work_orders"\)[^;\n]*\.limit\(100\)/);

async function testFetchAllRows() {
  const source = Array.from({ length: 1201 }, function (_value, index) { return { id: index + 1 }; });
  const ranges = [];
  const result = await Core.fetchAllRows(function () {
    return {
      range: async function (from, to) {
        ranges.push([from, to]);
        return { data: source.slice(from, to + 1), error: null };
      }
    };
  }, 500);
  assert.equal(result.error, null);
  assert.equal(result.data.length, 1201);
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);

  const expectedError = new Error("page failed");
  const failed = await Core.fetchAllRows(function () {
    return { range: async function () { return { data: null, error: expectedError }; } };
  }, 500);
  assert.equal(failed.data, null);
  assert.equal(failed.error, expectedError);
}

const cachedState = Core.localStateSnapshot({
  profile: { legalName: "Server GmbH", taxNumber: "12/345/67890", iban: "DE02120300000000202051" },
  invoices: Array.from({ length: 125 }, function (_value, index) { return { id: "server-" + index, serverStored: true }; })
    .concat([{ id: "local-test", serverStored: false }]),
  workOrders: Array.from({ length: 125 }, function (_value, index) { return { id: "order-" + index }; }),
  bankTransactions: [{ id: "bank-1" }],
  draft: { id: "draft-1" }
});
assert.equal(cachedState.invoices.length, 1);
assert.ok(cachedState.invoices.some(function (invoice) { return invoice.id === "local-test"; }));
assert.equal(cachedState.workOrders.length, 0);
assert.deepEqual(cachedState.bankTransactions, []);
assert.equal(cachedState.draft.id, "draft-1");
assert.equal(cachedState.profile.taxNumber, "12/345/67890");
const connectedState = Core.localStateSnapshot(cachedState, true, "user-a");
assert.equal(connectedState.profile.legalName, "");
assert.equal(connectedState.profile.taxNumber, "");
assert.equal(connectedState.profile.iban, "");
assert.equal(connectedState.invoices.length, 1);
assert.equal(connectedState.draft.id, "draft-1");
assert.equal(connectedState.storageOwnerUserId, "user-a");
const cashInvoice = {
  id: "local-cash-invoice", number: "TEST-2026-CASH-1", isTest: true, serverStored: false,
  status: "open", paidCents: 0, payments: [], adjustedGrossCents: 11900, totals: { grossCents: 11900 },
  draft: { priceMode: "gross", taxMode: "regular", items: [{ description: "Arbeitszeit", quantity: "1", unitPrice: "119,00", taxRate: "19" }] }
};
const cashReceipt = Core.cashReceiptForInvoice(cashInvoice);
assert.deepEqual({ grossCents: cashReceipt.grossCents, paymentType: cashReceipt.paymentType, vatRate: cashReceipt.items[0].vatRate }, { grossCents: 11900, paymentType: "CASH", vatRate: "19" });
const completedCash = {
  id: "checkout-1", invoiceId: cashInvoice.id, paymentId: "cash-payment-1", state: "completed", completedAt: "2026-08-26T12:00:00.000Z",
  receipt: cashReceipt, signature: { signatureCounter: "1", finishedAt: "2026-08-26T12:00:00.000Z" }
};
Core.applyLocalCashCheckouts([cashInvoice], [completedCash, completedCash]);
assert.equal(cashInvoice.payments.length, 1, "Idempotentni checkout ne sme podvojiti gotovinskega plačila.");
assert.equal(cashInvoice.status, "paid");
completedCash.refundedAt = "2026-08-26T12:05:00.000Z";
Core.applyLocalCashCheckouts([cashInvoice], [completedCash]);
assert.equal(cashInvoice.status, "open");
assert.equal(cashInvoice.payments[0].status, "refunded");
assert.match(js, /global\.localStorage\.removeItem\(STORAGE_KEY\)/);
assert.match(js, /global\.sessionStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(localSnapshot\)\)/);
assert.match(js, /backend\.serverStateLoaded = true;\s+persist\(\);\s+backendMessage\("Sinhronizirano", "ready"\)/);
assert.match(js, /var connected = Boolean\(backend\.serverStateLoaded \|\| ownerUserId\)/);
assert.match(js, /state\.storageOwnerUserId !== nextUserId[\s\S]*global\.sessionStorage\.removeItem\(STORAGE_KEY\)/);
assert.match(Core.propertyRetentionNotice({ customerType: "private", propertyRelated: true }), /zwei Jahre aufzubewahren \(§ 14b Abs\. 1 UStG\)/);
assert.match(Core.propertyRetentionNotice({ customerType: "private", handwerker35a: true }), /zwei Jahre aufzubewahren/);
assert.strictEqual(Core.propertyRetentionNotice({ customerType: "business", propertyRelated: true }), "");
assert.match(html, /name="propertyRelated"/);
const mergedBankRows = Core.mergeBankTransactionRows(
  [{ id: "open-old", booked_on: "2024-01-01", status: "unmatched" }, { id: "duplicate", booked_on: "2025-01-01", status: "unmatched" }],
  [{ id: "confirmed-new", booked_on: "2026-01-01", status: "confirmed" }, { id: "duplicate", booked_on: "2025-01-01", status: "confirmed" }]
);
assert.deepEqual(mergedBankRows.map(function (row) { return row.id; }), ["confirmed-new", "duplicate", "open-old"]);
assert.match(js, /fetchAllRows\(function \(\) \{[\s\S]*\.eq\("status", "unmatched"\)/);
assert.match(js, /fetchAllRows\(function \(\) \{[\s\S]*?eq\("status", "confirmed"\)/);
assert.doesNotMatch(js, /eq\("status", "confirmed"\)[^\n]*\.limit\(200\)/);
assert.doesNotMatch(js, /scopes\.bank \? backend\.client\.from\("pos_bank_transactions"\)[^;\n]*\.limit\(200\)/);
assert.match(js, /loadServerState\("deliveries"\)/);
assert.match(js, /loadServerState\("payments"\)/);
assert.match(js, /loadServerState\(\["payments", "bank"\]\)/);
assert.match(js, /scopes\.bank \? loadBankTransactionRows\(userId\) : skipped\(\)/);
assert.match(js, /pendingRefreshScopes = mergePosRefreshScopes/);
assert.match(js, /\.rpc\("pos_import_bank_transactions"/);
assert.match(js, /\.rpc\("pos_confirm_bank_transaction"/);
assert.match(js, /\/api\/pos-finapi/);
assert.match(js, /webform-sandbox\.finapi\.io/);
assert.match(js, /finapi.*complete/);
assert.match(js, /\.rpc\("pos_import_finapi_transactions"/);
assert.match(js, /Sandbox povezan · brez pravih nakazil/);
assert.match(js, /Nalagam bančne podatke/);
assert.match(js, /Prejeto na/);
assert.match(js, /source_account_id,source_account_name,source_account_iban/);
assert.match(js, /backend\.syncing = false;[\s\S]*bankBackdrop && !bankBackdrop\.hidden\) renderBankSheet/);
assert.match(js, /\.from\("pos_invoice_drafts"\)/);
assert.match(js, /\.from\("pos_payments"\)/);
assert.match(js, /\.rpc\("pos_record_manual_payment"/);
assert.match(js, /p_request_key: operationRequestId\("manual-payment", paymentRequestScope\)/);
assert.match(js, /clearOperationRequestId\("manual-payment", paymentRequestScope\)/);
assert.doesNotMatch(js, /\.from\("pos_payments"\)\.insert\(/);
assert.match(js, /source_bank_transaction_id/);
assert.match(js, /renderPaymentList\(invoice\)/);
assert.match(js, /Bančno nakazilo/);
assert.match(js, /requestLocalCashPayment\(invoice\)/);
assert.match(js, /local-training-cash-checkout/);
assert.match(js, /local-training-cash-refund/);
assert.match(js, /checkout\.refund = Object\.assign/);
assert.match(js, /fiscalInvoiceId: body\.checkout\.invoiceId/);
assert.match(js, /checkout\.fiscalInvoiceId \|\|/);
assert.match(js, /recoveryRequired = Boolean/);
assert.match(js, /body\.refund\.state === "recovery_required"/);
assert.match(js, /Povračilo ni zabeleženo – potrebna je ročna TSE uskladitev/);
assert.match(js, /STORNOBELEG · TRAINING/);
assert.doesNotMatch(js, /type: "REFUND"[\s\S]{0,300}state\.cashMovements/);
assert.match(js, /renderCashPayment\(invoice\)/);
assert.match(js, /UJPosDsfinvk\.buildPackage/);
assert.match(js, /\.from\("pos_invoice_documents"\)/);
assert.match(js, /\/api\/pos-racun-pdf\?invoiceId=/);
assert.match(js, /\/api\/pos-racun-xrechnung\?invoiceId=/);
assert.match(js, /\.from\("pos_einvoice_documents"\)/);
assert.match(js, /\.rpc\("pos_create_invoice_adjustment"/);
assert.match(js, /p_request_key: operationRequestId\("invoice-adjustment", adjustmentRequestScope\)/);
assert.match(js, /saveDraftToServer\(\{ allowIssuedRetry: true \}\)/);
assert.match(js, /existingDraftId && options && options\.allowIssuedRetry && missingSingleRowError\(result\.error\)/);
assert.match(js, /operationRequestId\("stripe-checkout", checkoutScope\)/);
assert.match(js, /operationRequestId\("stripe-refund", refundScope\)/);
assert.match(js, /operationRequestId\("datev-transfer", transferScope\)/);
assert.doesNotMatch(js, /\bfetch\("\/api\/pos-/);
assert.ok((js.match(/posFetch\("\/api\/pos-/g) || []).length >= 17, "Vse POS API poti morajo uporabljati omejen čakalni čas.");
assert.match(js, /"pos_issue_replacement_invoice"/);
assert.match(js, /Nadomestni račun potrebuje varno strežniško povezavo/);
assert.match(js, /pos_prepare_invoice_delivery/);
assert.match(js, /\.rpc\(adjustment \? "pos_prepare_adjustment_delivery" : "pos_prepare_invoice_delivery"/);
assert.match(js, /data-deliver-adjustment/);
assert.match(js, /openAdjustmentDeliverySheet\(invoice, entry\)/);
assert.match(js, /ensureAdjustmentEinvoiceDocument\(adjustment, true\)/);
assert.match(js, /adjustmentId: row\.adjustment_id \|\| null/);
assert.match(js, /\.rpc\("pos_queue_invoice_delivery"/);
assert.match(js, /\/api\/pos-dostava-sandbox/);
assert.match(js, /\/api\/pos-dostava-email/);
assert.match(js, /Pravo e-poštno pošiljanje/);
assert.match(js, /deliveryCapability\.liveEnabled/);
assert.match(js, /deliveryCapability\.sendEnabled/);
assert.match(js, /rezultat\.catch\(function \(error\)/, "Asinhroni dialog mora varno obravnavati zavrnitev.");
assert.match(js, /navigator\.clipboard\.writeText\(text\)[\s\S]*?\.catch\(function \(\) \{ openDialog\(/, "Kopiranje mora imeti varen nadomestni prikaz.");
assert.match(js, /Promise\.resolve\(document\.fonts\.ready\)[\s\S]*?\.catch\(function \(\) \{ global\.setTimeout\(fitAllText, 0\); \}\)/, "Priprava pisav ne sme povzročiti neobravnavane zavrnitve.");
assert.match(js, /loadServerState\(\)\.catch\(function \(error\)/, "Začetna sinhronizacija mora imeti zadnjo varnostno obravnavo.");
assert.match(js, /Varni e-poštni test/);
assert.match(js, /Stranka ga ne bo prejela/);
assert.match(js, /dovoljeni testni naslov/);
assert.match(js, /Sandbox preizkus je končan\. Nič ni bilo poslano\./);
assert.match(js, /OZG-RE mock sandbox je končan\. Nič ni bilo preneseno\./);
assert.match(js, /Peppol mock sandbox je končan\. Nič ni bilo preneseno\./);
assert.match(js, /publicDeliverySandboxCopy\(form\.elements\.deliveryChannel\.value\)/);
assert.deepStrictEqual(Core.publicDeliverySandboxCopy("ozg_re"), {
  title: "OZG-RE mock sandbox",
  copy: "Leitweg-ID, kanal in arhivirani XML se preverijo znotraj sistema. Povezava z OZG-RE se ne vzpostavi in nič se ne prenese.",
  help: "Leitweg-ID se preveri; zunanja OZG-RE dostopna točka v mocku ni poklicana.",
  success: "OZG-RE mock sandbox je končan. Nič ni bilo preneseno."
});
assert.equal(Core.publicDeliverySandboxCopy("peppol").title, "Peppol mock sandbox");
assert.match(deliveryApi, /pos_claim_invoice_delivery/);
assert.match(deliveryApi, /sent: false/);
assert.match(deliveryWorkerApi, /CRON_SECRET/);
assert.match(deliveryEmailApi, /pos_queue_live_invoice_delivery/);
assert.match(deliveryEmailApi, /pos_queue_resend_test_invoice_delivery/);
assert.match(deliveryEmailApi, /EMAIL_DELIVERY_NOT_ENABLED/);
assert.match(js, /pos-delivery-timeline/);
assert.match(css, /\.pos-detail-payments/);
assert.match(css, /\.pos-payment-row/);
assert.match(css, /\.pos-invoice-overview-summary/);
assert.match(css, /\.pos-invoice-search[\s\S]*font-size:\s*16px/);
assert.match(css, /\.pos-invoice-filters/);
assert.match(css, /\.pos-delivery-timeline[\s\S]*grid-template-columns/);
assert.match(js, /getAttribute\("data-fit-max"\)/);
assert.match(js, /\/api\/pos-racun-korekcija\?adjustmentId=/);
assert.doesNotMatch(js, /service[_-]?role/i);
assert.match(js, /if \(readiness\.live\) throw new Error\("Pravnega računa brez varne strežniške izdaje ni mogoče ustvariti\./);
assert.doesNotMatch(html, /type="(?:number|text)"[^>]*name="cash"/i);
assert.match(css, /bottom:\s*calc\(48px \+ var\(--app-testna-safe-bottom/);
assert.match(css, /overflow-x:\s*hidden/);
assert.match(css, /\.pos-icon-button,[\s\S]*?\.pos-back-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*flex:\s*0 0 44px/, "Ikonski in povratni gumbi morajo imeti varen mobilni dotik.");
assert.match(css, /\.pos-inline-action\s*\{[^}]*min-height:\s*44px/, "Vrstične akcije morajo imeti varen mobilni dotik.");
assert.match(css, /\[data-show-all\]\.pos-text-button\s*\{[^}]*min-height:\s*44px/, "Gumb za prikaz vseh računov mora imeti varen mobilni dotik.");
assert.match(css, /\.pos-field input, \.pos-field select, \.pos-field textarea\s*\{[^}]*min-height:\s*44px/, "Vnosna in izbirna polja morajo imeti varen mobilni dotik.");
assert.match(css, /\.pos-choice span\s*\{[^}]*min-height:\s*44px/, "Segmentirane izbire morajo imeti varen mobilni dotik.");
assert.match(css, /\.pos-invoice-search input\s*\{[^}]*min-height:\s*44px/, "Iskanje računov mora imeti varen mobilni dotik.");
assert.match(css, /\.pos-invoice-filters button\s*\{[^}]*min-height:\s*44px/, "Filtri računov morajo imeti varen mobilni dotik.");
assert.match(css, /\.pos-save-draft\s*\{[^}]*min-height:\s*44px/, "Shranjevanje osnutka mora imeti varen mobilni dotik.");
assert.match(css, /\.pos-steps button\s*\{[^}]*min-height:\s*44px/, "Koraki urejevalnika morajo imeti varen mobilni dotik.");
assert.match(css, /\.pos-procedure-version,[\s\S]*\.pos-work-order__actions button,[\s\S]*\.pos-delivery-row__retry,[\s\S]*\.pos-datev-sheet__actions button\s*\{\s*min-height:\s*44px/, "Redkejše POS poti morajo uporabljati enotno varno dotikalno višino.");
assert.match(css, /\.pos-bank-sheet__head button,[\s\S]*\.pos-datev-sheet__head button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*flex:\s*0 0 44px/, "Gumbi za zapiranje POS listov morajo imeti varno dotikalno površino.");
assert.match(css, /\.pos-adjustment-sheet[\s\S]*max-height:\s*min\(88vh/);
assert.match(css, /\.pos-delivery-sheet[\s\S]*overflow-x:\s*hidden/);
assert.match(css, /\.pos-delivery-sheet__actions[\s\S]*env\(safe-area-inset-bottom\)/);
assert.match(css, /\.pos-acknowledge\[hidden\]\s*\{\s*display:\s*none\s*!important/);
assert.match(css, /\.pos-bank-sheet[\s\S]*max-height:\s*min\(88vh/);
assert.match(css, /\.pos-bank-list[\s\S]*overflow-x:\s*hidden/);
assert.match(css, /\.pos-bank-provider[\s\S]*grid-template-columns/);
assert.match(css, /\.pos-datev-sheet[\s\S]*env\(safe-area-inset-bottom\)/);
assert.match(css, /\.pos-datev-sheet[\s\S]*overflow-x:\s*hidden/);

assert.strictEqual(Core.parseMoneyToCents("1.234,56 €"), 123456);
assert.strictEqual(Core.parseQuantityMilli("1,25"), 1250);
assert.strictEqual(Core.isoToday("2026-12-31T22:30:00.000Z"), "2026-12-31");
assert.strictEqual(Core.isoToday("2026-12-31T23:30:00.000Z"), "2027-01-01");
assert.strictEqual(Core.isoToday("2026-03-29T00:30:00.000Z"), "2026-03-29");
assert.strictEqual(Core.isoToday("2026-03-29T22:30:00.000Z"), "2026-03-30");
assert.strictEqual(Core.liveInvoiceDateError({ issueDate: "2026-08-22", serviceDate: "2026-08-21" }, "2026-08-22"), "");
assert.match(Core.liveInvoiceDateError({ issueDate: "2026-08-21", serviceDate: "2026-08-21" }, "2026-08-22"), /današnji nemški poslovni datum/);
assert.match(Core.liveInvoiceDateError({ issueDate: "2026-08-22", serviceDate: "2026-08-23" }, "2026-08-22"), /ne sme biti v prihodnosti/);
assert.strictEqual(Core.liveConstructionWithholdingError({ constructionWithholding: true, exemptionCertificate: "valid" }), "");
assert.strictEqual(Core.liveConstructionWithholdingError({ constructionWithholding: true, exemptionCertificate: "not_applicable" }), "");
assert.match(Core.liveConstructionWithholdingError({ constructionWithholding: true, exemptionCertificate: "missing" }), /15 % Bauabzugsteuer/);
assert.strictEqual(Core.addDays("2026-03-28", 1), "2026-03-29");
assert.strictEqual(Core.addDays("2026-03-29", 1), "2026-03-30");
assert.strictEqual(Core.addDays("2026-12-31", 1), "2027-01-01");
assert.strictEqual(Core.addDays("2027-01-01", -1), "2026-12-31");
assert.strictEqual(Core.defaultProfile("2026-12-31T23:30:00.000Z").invoicePrefix, "RE-2027-");
assert.strictEqual(Core.datevTimestamp("2026-12-31T23:30:15.007Z"), "20270101003015007");
assert.strictEqual(Core.datevTimestamp("2026-06-30T22:30:15.007Z"), "20260701003015007");
assert.deepStrictEqual(Core.normalizePosRefreshScopes(), { profile: true, draft: true, invoices: true, bank: true });
assert.deepStrictEqual(Core.normalizePosRefreshScopes("payments"), { payments: true });
assert.deepStrictEqual(Core.normalizePosRefreshScopes(["deliveries", "bank"]), { deliveries: true, bank: true });
assert.deepStrictEqual(Core.mergePosRefreshScopes({ payments: true }, "invoices"), { invoices: true });
assert.deepStrictEqual(Core.mergePosRefreshScopes({ bank: true }, "payments"), { bank: true, payments: true });
assert.deepStrictEqual(Core.paymentSummary([{ amountCents: 400, refundedCents: 0, status: "succeeded" }], 1000, "open"), { paidCents: 400, status: "partial" });
assert.deepStrictEqual(Core.paymentSummary([{ amountCents: 1200, refundedCents: 200, status: "partially_refunded" }], 1000, "open"), { paidCents: 1000, status: "paid" });
assert.deepStrictEqual(Core.paymentSummary([{ amountCents: 1000, refundedCents: 0, status: "failed" }], 1000, "open"), { paidCents: 0, status: "open" });
assert.deepStrictEqual(Core.paymentSummary([{ amountCents: 1000, refundedCents: 0, status: "succeeded" }], 1000, "cancelled"), { paidCents: 1000, status: "cancelled" });
assert.deepStrictEqual(Core.paymentSummary([], 0, "credited"), { paidCents: 0, status: "credited" });
assert.strictEqual(Core.invoiceOutstandingCents({ adjustedGrossCents: 3000, paidCents: 3000, status: "paid" }), 0);
assert.strictEqual(Core.invoiceOutstandingCents({ adjustedGrossCents: 3000, paidCents: 1000, status: "partial" }), 2000);
const creditedInvoice = Core.serverInvoiceToLocal({
  id: "invoice-credit-test", invoice_number: "RE-TEST", snapshot: { draft: {} },
  due_date: "2026-08-30", net_cents: 10000, tax_cents: 1900, gross_cents: 11900,
  eligible_35a_cents: 0, is_test: true, issued_at: "2026-08-22T10:00:00.000Z"
}, {}, {}, {
  "invoice-credit-test": [{ type: "credit_note", deltaGrossCents: -11900 }]
}, {}, {});
assert.strictEqual(creditedInvoice.adjustedGrossCents, 0);
assert.strictEqual(creditedInvoice.hasCreditNote, true);
assert.strictEqual(creditedInvoice.status, "credited");
const invoiceWithDatabaseCustomerTypeFallback = Core.serverInvoiceToLocal({
  id: "invoice-customer-type-fallback", invoice_number: "RE-FALLBACK", customer_type: "business",
  snapshot: { draft: { customer_name: "Fallback GmbH" } }, due_date: "2026-08-30",
  net_cents: 100, tax_cents: 19, gross_cents: 119, eligible_35a_cents: 0,
  is_test: true, issued_at: "2026-08-24T10:00:00.000Z"
}, {}, {}, {}, {}, {});
assert.strictEqual(invoiceWithDatabaseCustomerTypeFallback.draft.customerType, "business");
assert.strictEqual(Core.latestManualPaymentCandidate([
  { id: "partial", status: "partial", totals: { grossCents: 1000 }, paidCents: 400 },
  { id: "open", status: "open", totals: { grossCents: 1000 }, paidCents: 0 }
]).id, "partial");
assert.strictEqual(Core.latestManualPaymentCandidate([
  { status: "paid", totals: { grossCents: 1000 }, paidCents: 1000 },
  { status: "cancelled", totals: { grossCents: 1000 }, paidCents: 0 }
]), null);

const net = Core.calculateItem({ quantity: "2", unitPrice: "100,00", taxRate: "19" }, "net", "regular");
assert.deepStrictEqual(
  { net: net.netCents, tax: net.taxCents, gross: net.grossCents },
  { net: 20000, tax: 3800, gross: 23800 }
);

const gross = Core.calculateItem({ quantity: "1", unitPrice: "119,00", taxRate: "19" }, "gross", "regular");
assert.deepStrictEqual(
  { net: gross.netCents, tax: gross.taxCents, gross: gross.grossCents },
  { net: 10000, tax: 1900, gross: 11900 }
);

const exempt = Core.calculateItem({ quantity: "1", unitPrice: "119,00", taxRate: "19" }, "net", "small_business");
assert.deepStrictEqual(
  { net: exempt.netCents, tax: exempt.taxCents, gross: exempt.grossCents },
  { net: 11900, tax: 0, gross: 11900 }
);

const profile = Core.defaultProfile();
profile.legalName = "Muster Handwerk GmbH";
profile.legalForm = "GmbH";
profile.representative = "Erika Beispiel";
profile.companySeat = "Berlin";
profile.registerCourt = "Amtsgericht Charlottenburg";
profile.registerNumber = "HRB 12345 B";
profile.street = "Musterstraße 1";
profile.postalCode = "10115";
profile.city = "Berlin";
profile.businessEmail = "rechnung@muster-handwerk.de";
profile.businessPhone = "+49 30 1234567";
profile.taxNumber = "12/345/67890";
profile.accountHolder = "Muster Handwerk GmbH";
profile.iban = "DE02120300000000202051";
profile.einvoiceReceivingConfirmed = true;
profile.legalConfirmed = true;
assert.strictEqual(Core.profileReadiness(profile).live, true);
assert.strictEqual(Core.profileReadiness(Object.assign({}, profile, { legalName: "   " })).live, false);
assert.strictEqual(Core.profileReadiness(Object.assign({}, profile, { registerNumber: "" })).live, false);
assert.strictEqual(Core.profileReadiness(Object.assign({}, profile, { legalForm: "Einzelunternehmen", companySeat: "", registerCourt: "", registerNumber: "" })).live, true);
assert.match(Core.profileValidationError(Object.assign({}, profile, { legalForm: "Sonstige" })), /podprto nemško pravno obliko/);
assert.strictEqual(Core.validIban("DE02 1203 0000 0000 2020 51"), true);
assert.strictEqual(Core.validIban("DE03 1203 0000 0000 2020 51"), false);
assert.strictEqual(Core.profileReadiness(Object.assign({}, profile, { iban: "DE03120300000000202051" })).live, false);
assert.strictEqual(Core.profileReadiness(Object.assign({}, profile, { vatId: "DE123", taxNumber: "" })).live, false);
assert.strictEqual(Core.profileReadiness(Object.assign({}, profile, { einvoiceReceivingConfirmed: false })).live, false);
assert.match(Core.profileValidationError(Object.assign({}, profile, { einvoiceReceivingConfirmed: false })), /strukturiranih e-računov/);
assert.match(Core.profileValidationError(Object.assign({}, profile, { taxStatus: "small_business", smallBusinessEligibilityConfirmed: false })), /§ 19 UStG/);
assert.strictEqual(Core.profileReadiness(Object.assign({}, profile, { taxStatus: "small_business", smallBusinessEligibilityConfirmed: true })).live, true);
assert.match(Core.profileValidationError(Object.assign({}, profile, { iban: "DE03120300000000202051" })), /IBAN/);
assert.strictEqual(Core.profileChangeRequiresConfirmation("iban"), true);
assert.strictEqual(Core.profileChangeRequiresConfirmation("taxStatus"), true);
assert.strictEqual(Core.profileChangeRequiresConfirmation("registerCourt"), true);
assert.strictEqual(Core.profileChangeRequiresConfirmation("einvoiceReceivingConfirmed"), true);
assert.strictEqual(Core.profileChangeRequiresConfirmation("defaultDueDays"), false);
assert.strictEqual(Core.profileChangeRequiresConfirmation("invoicePrefix"), false);
assert.deepStrictEqual(Core.profileForPreview({ legalName: "   " }, true), {
  legalName: "TEST-Unternehmen", street: "Musterstraße 1", postalCode: "00000", city: "Teststadt"
});

const duplicateDraft = Core.defaultDraft(profile);
duplicateDraft.customerName = "Unicode-Test Žiga Čebelar";
duplicateDraft.customerStreet = "Šolska Straße 1";
duplicateDraft.customerPostalCode = "00000";
duplicateDraft.customerCity = "Teststadt";
duplicateDraft.items[0].description = "Preizkus računa - č, š, ž, ß";
duplicateDraft.items[0].unitPrice = "1,00";
duplicateDraft.finalConfirmed = true;
const duplicateTotals = Core.calculateTotals(duplicateDraft);
const serverTestInvoice = { id: "server-test", number: "TEST-2026-0001", isTest: true, serverStored: true, draft: duplicateDraft, totals: duplicateTotals };
const localDuplicate = { id: "local-duplicate", number: "TEST-2026-0001", isTest: true, serverStored: false, draft: JSON.parse(JSON.stringify(duplicateDraft)), totals: duplicateTotals };
localDuplicate.draft.items[0].id = "drug-lokalni-id";
const staleLocalCollision = { id: "local-collision", number: "TEST-2026-0001", isTest: true, serverStored: false, draft: JSON.parse(JSON.stringify(duplicateDraft)), totals: duplicateTotals };
staleLocalCollision.draft.items[0].description = "Stara lokalna različica iste številke";
const differentLocalTest = { id: "local-different", number: "TEST-2026-0002", isTest: true, serverStored: false, draft: JSON.parse(JSON.stringify(duplicateDraft)), totals: duplicateTotals };
differentLocalTest.draft.items[0].description = "Druga testna storitev";
assert.deepStrictEqual(Core.mergeInvoiceSources([serverTestInvoice], [localDuplicate, staleLocalCollision, differentLocalTest]).map((invoice) => invoice.id), ["server-test", "local-different"]);

const csvTransactions = Core.parseBankCsv([
  "Buchungstag;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;Verwendungszweck;Betrag;Währung;Kundenreferenz",
  "19.08.2026;Unicode-Test Žiga Čebelar;DE02120300000000202051;Zahlung TEST-2026-0001;1,19;EUR;BANK-REF-1",
  "19.08.2026;Gebühr;;Kontoführung;-4,90;EUR;BANK-REF-2"
].join("\n"));
assert.strictEqual(csvTransactions.length, 1);
assert.deepStrictEqual({ amount: csvTransactions[0].amount_cents, date: csvTransactions[0].booked_on, reference: csvTransactions[0].external_reference }, { amount: 119, date: "2026-08-19", reference: "BANK-REF-1" });

const camtTransactions = Core.parseCamt053(`<?xml version="1.0"?><BkToCstmrStmt><Stmt><Ntry><Amt Ccy="EUR">1.19</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-08-19</Dt></BookgDt><AcctSvcrRef>CAMT-REF-1</AcctSvcrRef><NtryDtls><TxDtls><RltdPties><Dbtr><Nm>Unicode-Test Žiga Čebelar</Nm></Dbtr><DbtrAcct><Id><IBAN>DE02120300000000202051</IBAN></Id></DbtrAcct></RltdPties><RmtInf><Ustrd>TEST-2026-0001</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry></Stmt></BkToCstmrStmt>`);
assert.strictEqual(camtTransactions.length, 1);
assert.deepStrictEqual({ amount: camtTransactions[0].amount_cents, date: camtTransactions[0].booked_on, reference: camtTransactions[0].external_reference }, { amount: 119, date: "2026-08-19", reference: "CAMT-REF-1" });
assert.strictEqual(Core.bankImportFileError({ size: 1024 }), "");
assert.match(Core.bankImportFileError({ size: 0 }), /prazen/i);
assert.match(Core.bankImportFileError({ size: Core.MAX_BANK_IMPORT_BYTES + 1 }), /5 MB/);
assert.match(js, /reader\.onerror = function \(\) \{ showToast\("Bančnega izpiska ni bilo mogoče prebrati\."\); \}/);
const bankMatch = Core.matchBankTransaction(csvTransactions[0], [serverTestInvoice]);
assert.strictEqual(bankMatch.invoice.id, "server-test");
assert.strictEqual(bankMatch.score, 100);
const partialBankMatch = Core.matchBankTransaction({ amount_cents: 50, remittance_info: "Teilzahlung TEST-2026-0001" }, [serverTestInvoice]);
assert.strictEqual(partialBankMatch.invoice.id, "server-test");
assert.strictEqual(partialBankMatch.score, 92);
const sameAmountInvoice = Object.assign({}, serverTestInvoice, { id: "server-same-amount", number: "TEST-2026-0099", draft: Object.assign({}, duplicateDraft, { customerName: "Andere GmbH" }) });
assert.strictEqual(Core.matchBankTransaction({ amount_cents: 119, remittance_info: "Ohne Referenz", counterparty_name: "" }, [serverTestInvoice, sameAmountInvoice]), null);

const reconciliationInvoice = Object.assign({}, serverTestInvoice, {
  id: "reconciliation-invoice",
  number: "TEST-2026-0100",
  dueDate: "2026-09-03",
  seller: { iban: "DE00123456789012345678" },
  draft: Object.assign({}, duplicateDraft, { issueDate: "2026-08-20", customerName: "Lohn/Gehalt" }),
  totals: Object.assign({}, duplicateTotals, { grossCents: 40000 })
});
const duplicateBankCandidates = [
  { id: "bank-main", bookedOn: "2026-08-19", amountCents: 40000, counterpartyName: "Lohn/Gehalt", sourceAccountIban: "DE00123456789012345678" },
  { id: "bank-secondary", bookedOn: "2026-08-19", amountCents: 40000, counterpartyName: "Lohn/Gehalt", sourceAccountIban: "DE00999999999999999999" },
  { id: "bank-old", bookedOn: "2026-06-01", amountCents: 40000, counterpartyName: "Lohn/Gehalt", sourceAccountIban: "DE00123456789012345678" }
];
const resolvedBankMatches = Core.resolveBankMatches(duplicateBankCandidates, [reconciliationInvoice]);
assert.strictEqual(resolvedBankMatches.suggestions["bank-main"].invoice.id, "reconciliation-invoice");
assert.strictEqual(resolvedBankMatches.suggestions["bank-secondary"], undefined);
assert.strictEqual(resolvedBankMatches.suggestions["bank-old"], undefined);
const ambiguousBankMatches = Core.resolveBankMatches(duplicateBankCandidates.slice(0, 2), [Object.assign({}, reconciliationInvoice, { seller: { iban: "" } })]);
assert.strictEqual(Object.keys(ambiguousBankMatches.suggestions).length, 0);
assert.match(ambiguousBankMatches.ambiguities["bank-main"], /Več enako primernih prilivov/);

const mappedBankPayment = Core.paymentFromServer({
  id: "payment-1",
  invoice_id: "reconciliation-invoice",
  amount_cents: 40000,
  currency: "EUR",
  method: "bank_transfer",
  provider_reference: "BANK-REFERENCE-1",
  paid_at: "2026-08-20T00:00:00Z",
  source_bank_transaction_id: "bank-main"
});

const overviewBase = {
  draft: { customerName: "Muster GmbH", customerEmail: "rechnung@muster.de" },
  totals: { grossCents: 11900 },
  paidCents: 0,
  isTest: false,
  status: "open"
};
const overviewInvoices = [
  Object.assign({}, overviewBase, { id: "overdue", number: "RE-2026-0001", dueDate: "2026-08-18" }),
  Object.assign({}, overviewBase, { id: "future", number: "RE-2026-0002", dueDate: "2026-08-25" }),
  Object.assign({}, overviewBase, { id: "paid", number: "RE-2026-0003", dueDate: "2026-08-18", status: "paid", paidCents: 11900 }),
  Object.assign({}, overviewBase, { id: "test", number: "TEST-2026-0001", dueDate: "2026-08-18", isTest: true })
];
assert.strictEqual(Core.invoiceDaysOverdue(overviewInvoices[0], "2026-08-20"), 2);
assert.strictEqual(Core.invoiceDaysOverdue(overviewInvoices[3], "2026-08-20"), 0);
assert.deepStrictEqual(Core.filterInvoices(overviewInvoices, "overdue", "", "2026-08-20").map((row) => row.id), ["overdue"]);
assert.deepStrictEqual(Core.filterInvoices(overviewInvoices, "all", "0002", "2026-08-20").map((row) => row.id), ["future"]);
assert.deepStrictEqual(Core.invoiceOverview(overviewInvoices, "2026-08-20"), { openCents: 23800, overdueCents: 11900, paidCount: 1 });
assert.match(js, /showView\("invoices"\)/);
assert.match(js, /showView\(invoiceDetailReturnView\)/);
assert.deepStrictEqual(mappedBankPayment, {
  id: "payment-1",
  invoiceId: "reconciliation-invoice",
  amountCents: 40000,
  currency: "EUR",
  method: "bank_transfer",
  provider: "finapi",
  providerReference: "BANK-REFERENCE-1",
  paidAt: "2026-08-20T00:00:00Z",
  sourceBankTransactionId: "bank-main",
  status: "succeeded",
  refundedCents: 0,
  failureCode: "",
  checkoutSessionId: null,
  externalPaymentId: null,
  expiresAt: null,
  createdAt: "2026-08-20T00:00:00Z"
});

const draft = Core.defaultDraft(profile);
draft.customerName = "Sehr langes deutsches Beispielunternehmen für Gebäudetechnik und Sanierung GmbH";
draft.customerStreet = "Beispielstraße 123";
draft.customerPostalCode = "20095";
draft.customerCity = "Hamburg";
draft.customerEmail = "rechnung@kunde.de";
draft.customerType = "business";
draft.buyerReference = "PO-TEST-1";
draft.items[0].description = "Arbeitsleistung für die vollständige Sanierung";
draft.items[0].unitPrice = "100,00";
draft.finalConfirmed = true;
assert.deepStrictEqual(Core.validateStep(draft, profile, 4), []);
const zeroValueDraft = JSON.parse(JSON.stringify(draft));
zeroValueDraft.items.forEach((item) => { item.unitPrice = "0,00"; });
assert.ok(Core.validateStep(zeroValueDraft, profile, 2).some((entry) => /večji od 0,00/.test(entry)));
assert.ok(positiveTotalMigrationName, "Manjka prepoved ničelnega pravnega POS računa.");
assert.match(positiveTotalMigration, /check \(gross_cents > 0\)[\s\S]*validate constraint pos_invoices_positive_total_check/i);

const invalidParty = JSON.parse(JSON.stringify(draft));
invalidParty.customerPostalCode = "2009";
invalidParty.customerEmail = "ni-email";
invalidParty.customerPhone = "12";
invalidParty.customerVatId = "napačno";
assert.ok(Core.validateStep(invalidParty, profile, 1).some((entry) => /PLZ prejemnika/.test(entry)));
assert.ok(Core.validateStep(invalidParty, profile, 1).some((entry) => /E-poštni naslov prejemnika/.test(entry)));
assert.ok(Core.validateStep(invalidParty, profile, 1).some((entry) => /Telefon prejemnika/.test(entry)));
assert.ok(Core.validateStep(invalidParty, profile, 1).some((entry) => /USt-IdNr\. prejemnika/.test(entry)));
const multilineParty = JSON.parse(JSON.stringify(draft));
multilineParty.customerName = "Kunde GmbH\nInjected";
assert.ok(Core.validateStep(multilineParty, profile, 1).some((entry) => /preloma vrstice/.test(entry)));

const privateReverse = JSON.parse(JSON.stringify(draft));
privateReverse.customerType = "private";
privateReverse.taxMode = "reverse_charge";
privateReverse.reverseChargeConfirmed = true;
assert.ok(Core.validateStep(privateReverse, profile, 3).some((entry) => /fizično osebo/.test(entry)));

const publicWithoutLeitweg = JSON.parse(JSON.stringify(draft));
publicWithoutLeitweg.customerType = "public";
publicWithoutLeitweg.leitwegId = "";
assert.ok(Core.validateStep(publicWithoutLeitweg, profile, 1).some((entry) => /Leitweg-ID/.test(entry)));

const privateConstruction = JSON.parse(JSON.stringify(draft));
privateConstruction.customerType = "private";
privateConstruction.constructionWithholding = true;
privateConstruction.exemptionCertificate = "valid";
assert.ok(Core.validateStep(privateConstruction, profile, 3).some((entry) => /§ 48 EStG/.test(entry)));

const businessHandwerker = JSON.parse(JSON.stringify(draft));
businessHandwerker.handwerker35a = true;
assert.ok(Core.validateStep(businessHandwerker, profile, 3).some((entry) => /§ 35a EStG/.test(entry)));

const invoice = {
  number: "RE-2026-0001",
  dueDate: "2026-09-02",
  totals: Core.calculateTotals(draft),
  draft
};
const datevSettings = Object.assign(Core.defaultDatevSettings("03"), {
  adviserNumber: "29098",
  clientNumber: "55003",
  confirmed: true
});
const datevDraft = JSON.parse(JSON.stringify(draft));
datevDraft.issueDate = "2026-08-19";
datevDraft.serviceDate = "2026-08-18";
datevDraft.customerName = "Žiga Čebelar GmbH";
const datevInvoice = {
  id: "datev-live-1",
  number: "RE.Ž-2026 0001",
  dueDate: "2026-09-02",
  draft: datevDraft,
  totals: Core.calculateTotals(datevDraft),
  isTest: false,
  adjustments: []
};
const datevExport = Core.buildDatevExport([datevInvoice, Object.assign({}, datevInvoice, { id: "datev-test", isTest: true })], datevSettings, "2026-08", new Date("2026-08-19T12:34:56.789Z"));
assert.deepStrictEqual(datevExport.errors, []);
assert.strictEqual(Core.DATEV_BOOKING_HEADERS.length, 125);
assert.strictEqual(datevExport.bookings.length, 1, "Testni računi ne smejo v DATEV izvoz.");
assert.strictEqual(datevExport.filename, "EXTF_Buchungsstapel_202608.csv");
const datevLines = datevExport.content.trim().split("\r\n");
assert.strictEqual(datevLines.length, 3);
assert.strictEqual(datevLines[0].split(";").length, 31);
assert.strictEqual(datevLines[1].split(";").length, 125);
assert.strictEqual(datevLines[2].split(";").length, 125);
assert.match(datevLines[0], /^"EXTF";700;21;"Buchungsstapel";13;/);
assert.match(datevLines[0], /;29098;55003;20260101;4;20260801;20260831;/);
assert.match(datevLines[2], /^119,00;"S";"EUR";;;;1410;8400;"";1908;"RE-Z-2026-0001";"020926";/);
assert.strictEqual(Core.datevDocumentNumber("Rächnung 1.2;ß"), "Raechnung-1-2-ss");
assert.ok(Core.validateDatevSettings(Object.assign({}, datevSettings, { confirmed: false }), "2026-08").some((message) => /računovodja/.test(message)));
const cancelledDatevInvoice = Object.assign({}, datevInvoice, {
  adjustments: [{ number: "ST-2026-0001", type: "cancellation", createdAt: "2026-08-20T08:00:00Z", deltaGrossCents: -11900 }]
});
const cancelledDatevExport = Core.buildDatevExport([cancelledDatevInvoice], datevSettings, "2026-08", new Date("2026-08-20T09:00:00Z"));
assert.strictEqual(cancelledDatevExport.bookings.length, 2);
assert.strictEqual(cancelledDatevExport.bookings[1].side, "H");
assert.strictEqual(cancelledDatevExport.bookings[1].documentNumber, "ST-2026-0001");
const mixedRateDraft = JSON.parse(JSON.stringify(datevDraft));
mixedRateDraft.items = [
  Object.assign({}, mixedRateDraft.items[0], { id: "datev-19", unitPrice: "100,00", taxRate: "19" }),
  Object.assign({}, mixedRateDraft.items[0], { id: "datev-7", unitPrice: "50,00", taxRate: "7" })
];
const mixedRateExport = Core.buildDatevExport([{ id: "datev-mixed", number: "RE-2026-0002", dueDate: "2026-09-02", draft: mixedRateDraft, isTest: false, adjustments: [] }], datevSettings, "2026-08", new Date("2026-08-20T09:00:00Z"));
assert.deepStrictEqual(mixedRateExport.bookings.map((booking) => booking.counterAccount).sort(), ["8300", "8400"]);
assert.deepStrictEqual(mixedRateExport.bookings.map((booking) => booking.amountCents).sort((a, b) => a - b), [5350, 11900]);
const duplicateDocumentExport = Core.buildDatevExport([
  Object.assign({}, datevInvoice, { id: "datev-duplicate-a", number: "RE.1" }),
  Object.assign({}, datevInvoice, { id: "datev-duplicate-b", number: "RE 1" })
], datevSettings, "2026-08", new Date("2026-08-20T09:00:00Z"));
assert.ok(duplicateDocumentExport.errors.some((message) => /enak DATEV ključ/.test(message)));
assert.strictEqual(Core.buildXRechnungXml, undefined, "XRechnung sme nastati samo iz zaklenjenega računa na strežniku.");
assert.doesNotMatch(js, /function buildXRechnungXml\(/);
assert.match(js, /Točen XRechnung nastane iz zaklenjenih podatkov po izdaji/);
assert.match(css, /\.pos-field input:focus-visible[\s\S]*outline:\s*2px solid var\(--pos-teal\)/, "Vnosna polja morajo imeti jasno vidno tipkovniško fokusno obrobo.");
assert.match(css, /\.pos-choice input:focus-visible \+ span[\s\S]*\.pos-mini-choice input:focus-visible \+ span/, "Skrite radio izbire morajo imeti vidno tipkovniško fokusno stanje.");
assert.match(css, /\.pos-tax-options input:focus-visible \+ span/, "Davčne izbire morajo imeti vidno tipkovniško fokusno stanje.");
assert.match(css, /\.pos-adjustment-types input:focus-visible \+ span/, "Vrste popravkov morajo imeti vidno tipkovniško fokusno stanje.");

const epc = Core.buildEpcPayload(invoice, profile);
assert.match(epc, /^BCD\n002\n1\nSCT\n/);
assert.match(epc, /DE02120300000000202051/);
assert.match(epc, /RE-2026-0001/);

const privateInvoice = { number: invoice.number, dueDate: invoice.dueDate, totals: invoice.totals, draft: Object.assign({}, draft, { customerType: "private", issueDate: "2026-08-19" }) };
const privateDelivery = Core.deliveryRecommendation(privateInvoice, profile);
assert.strictEqual(privateDelivery.documentFormat, "pdf");
assert.strictEqual(privateDelivery.pdfConsentRequired, true);
const business2026 = Core.deliveryRecommendation(invoice, profile);
assert.strictEqual(business2026.documentFormat, "xrechnung_pdf");
assert.strictEqual(business2026.pdfAllowed, true);
assert.strictEqual(business2026.structuredRequired, false);
const business2027Unknown = Core.deliveryRecommendation({ totals: { grossCents: 50000 }, draft: Object.assign({}, draft, { issueDate: "2027-04-01", serviceDate: "2027-03-28" }) }, profile);
assert.strictEqual(business2027Unknown.pdfAllowed, false);
assert.strictEqual(business2027Unknown.needsTurnoverDecision, true);
profile.previousYearTurnoverBand = "gt_800k";
profile.datevSettings = datevSettings;
const business2027Large = Core.deliveryRecommendation({ totals: { grossCents: 50000 }, draft: Object.assign({}, draft, { issueDate: "2027-04-01", serviceDate: "2027-03-28" }) }, profile);
assert.strictEqual(business2027Large.structuredRequired, true);
const business2028SmallAmount = Core.deliveryRecommendation({ totals: { grossCents: 25000 }, draft: Object.assign({}, draft, { issueDate: "2028-04-01", serviceDate: "2028-03-28" }) }, profile);
assert.strictEqual(business2028SmallAmount.pdfAllowed, true);
assert.strictEqual(business2028SmallAmount.structuredRequired, false);
const business2028ReverseCharge = Core.deliveryRecommendation({ totals: { grossCents: 25000 }, draft: Object.assign({}, draft, { issueDate: "2028-04-01", serviceDate: "2028-03-28", taxMode: "reverse_charge" }) }, profile);
assert.strictEqual(business2028ReverseCharge.pdfAllowed, false, "§ 33 UStDV ne velja za reverse charge po § 13b UStG.");
const business2028SmallBusiness = Core.deliveryRecommendation({ totals: { grossCents: 50000 }, draft: Object.assign({}, draft, { issueDate: "2028-04-01", serviceDate: "2028-03-28", taxMode: "small_business" }) }, Object.assign({}, profile, { taxStatus: "small_business" }));
assert.strictEqual(business2028SmallBusiness.pdfAllowed, true);
const lateInvoiceForOldService = Core.deliveryRecommendation({ totals: { grossCents: 50000 }, draft: Object.assign({}, draft, { issueDate: "2028-01-10", serviceDate: "2026-12-20" }) }, profile);
assert.strictEqual(lateInvoiceForOldService.pdfAllowed, true, "Prehodno pravilo se presoja po datumu prometa/storitve, ne po datumu izdaje.");
const publicDelivery = Core.deliveryRecommendation({ draft: Object.assign({}, draft, { customerType: "public" }) }, profile);
assert.deepStrictEqual({ channel: publicDelivery.channel, format: publicDelivery.documentFormat }, { channel: "ozg_re", format: "xrechnung" });

const dbProfile = Core.profileToDatabase(profile, "11111111-1111-4111-8111-111111111111");
assert.strictEqual(dbProfile.legal_name, "Muster Handwerk GmbH");
assert.strictEqual(dbProfile.user_id, "11111111-1111-4111-8111-111111111111");
assert.strictEqual(dbProfile.previous_year_turnover_band, "gt_800k");
assert.strictEqual(dbProfile.company_seat, "Berlin");
assert.strictEqual(dbProfile.register_court, "Amtsgericht Charlottenburg");
assert.strictEqual(dbProfile.register_number, "HRB 12345 B");
assert.strictEqual(dbProfile.einvoice_receiving_confirmed, true);
assert.strictEqual(dbProfile.small_business_eligibility_confirmed, false);
assert.strictEqual(Core.profileFromDatabase(dbProfile).registerNumber, "HRB 12345 B");
assert.strictEqual(Core.profileFromDatabase(dbProfile).einvoiceReceivingConfirmed, true);
assert.strictEqual(Core.profileToDatabase(Object.assign({}, profile, { taxStatus: "small_business", smallBusinessEligibilityConfirmed: true }), "user-1").small_business_eligibility_confirmed, true);
assert.strictEqual(Core.profileToDatabase(Object.assign({}, profile, { vatId: "de-123 456 789" }), "user-1").vat_id, "DE123456789");
assert.strictEqual(Core.draftToDatabasePayload(Object.assign(Core.defaultDraft(profile), { customerVatId: "de-123 456 789" })).customer_vat_id, "DE123456789");
assert.strictEqual(dbProfile.business_phone, "+49 30 1234567");
assert.strictEqual(Object.keys(dbProfile).some((key) => /^(?:next_.*_sequence|created_at|updated_at)$/.test(key)), false);
assert.strictEqual(dbProfile.datev_settings.adviserNumber, "29098");
assert.strictEqual(dbProfile.datev_settings.framework, "03");
const dbDraft = Core.draftToDatabasePayload(draft);
assert.strictEqual(dbDraft.items[0].unit_price_cents, 10000);
assert.strictEqual(dbDraft.items[0].quantity_milli, 1000);
assert.strictEqual(dbDraft.items[0].tax_rate_bps, 1900);
assert.strictEqual(dbDraft.property_related, false);
const propertyDbDraft = Core.draftToDatabasePayload(Object.assign({}, draft, { propertyRelated: true }));
assert.strictEqual(propertyDbDraft.property_related, true);
const restoredDraft = Core.draftFromDatabasePayload(dbDraft);
assert.strictEqual(restoredDraft.customerName, draft.customerName);
assert.strictEqual(restoredDraft.items[0].unitPrice, "100,00");
assert.strictEqual(restoredDraft.finalConfirmed, false, "Obnovljen osnutek mora zahtevati nov končni pregled.");
assert.strictEqual(Core.draftFromDatabasePayload(propertyDbDraft).propertyRelated, true);
assert.deepStrictEqual(Core.buildAdjustmentChanges({ draft, dueDate: "2026-09-02" }, {
  customer_name: draft.customerName,
  customer_street: "Neue Straße 44",
  customer_postal_code: draft.customerPostalCode,
  customer_city: draft.customerCity,
  service_date: draft.serviceDate,
  due_date: "2026-09-09"
}), { customer_street: "Neue Straße 44", due_date: "2026-09-09" });
const cancellation = { id: "22222222-2222-4222-8222-222222222222", number: "ST-2026-0001", type: "cancellation" };
const replacementDraft = Core.replacementDraftFromInvoice({
  id: "11111111-1111-4111-8111-111111111111",
  number: "RE-2026-0001",
  draft
}, cancellation, profile);
assert.strictEqual(replacementDraft.customerName, draft.customerName);
assert.strictEqual(replacementDraft.items[0].description, draft.items[0].description);
assert.strictEqual(replacementDraft.finalConfirmed, false);
assert.strictEqual(replacementDraft.einvoiceValidated, false);
assert.strictEqual(replacementDraft.issueDate, Core.isoToday());
assert.notStrictEqual(replacementDraft.items[0].id, draft.items[0].id);
assert.deepStrictEqual(Core.normalizeReplacementContext(replacementDraft), {
  originalInvoiceId: "11111111-1111-4111-8111-111111111111",
  originalInvoiceNumber: "RE-2026-0001",
  cancellationAdjustmentId: "22222222-2222-4222-8222-222222222222",
  cancellationNumber: "ST-2026-0001"
});
const replacementPayload = Core.draftToDatabasePayload(replacementDraft);
assert.strictEqual(replacementPayload.replacement_context.cancellation_adjustment_id, cancellation.id);
assert.strictEqual(Core.draftFromDatabasePayload(replacementPayload).replacementContext.originalInvoiceId, "11111111-1111-4111-8111-111111111111");

assert.ok(migrationName, "Manjka Supabase migracija za POS terminal.");
["pos_business_profiles", "pos_invoice_drafts", "pos_invoices", "pos_payments", "pos_audit_events"].forEach((table) => {
  assert.match(migration, new RegExp("alter table public\\." + table + " enable row level security", "i"));
  assert.match(migration, new RegExp("revoke all on table public\\." + table + " from public, anon, authenticated", "i"));
});
assert.match(migration, /grant select on table public\.pos_invoices to authenticated/i);
assert.doesNotMatch(migration, /grant\s+(?:all|insert|update|delete)[^;]*public\.pos_invoices\s+to authenticated/i);
assert.match(migration, /create trigger pos_invoices_immutable/i);
assert.match(migration, /where user_id = v_user for update/i);
assert.match(migration, /security definer\s+set search_path = ''/i);
assert.match(migration, /create or replace function public\.pos_issue_invoice[\s\S]*security invoker/i);
assert.match(migration, /revoke all on function public\.pos_issue_invoice\(uuid,jsonb,boolean,boolean\) from public, anon/i);
assert.match(migration, /grant execute on function public\.pos_issue_invoice\(uuid,jsonb,boolean,boolean\) to authenticated, service_role/i);
assert.match(migration, /v_line_net := round[\s\S]*v_line_tax := v_line_gross - v_line_net/i);
assert.ok(issueConcurrencyMigrationName, "Manjka migracija za sočasno idempotentno izdajo POS računa.");
const profileLockIndex = issueConcurrencyMigration.search(/select \* into v_profile[\s\S]*?where user_id = v_user for update/i);
const existingInvoiceIndex = issueConcurrencyMigration.search(/select \* into v_existing[\s\S]*?source_draft_id = p_draft_id/i);
const draftOwnershipIndex = issueConcurrencyMigration.search(/if not exists \([\s\S]*?from public\.pos_invoice_drafts/i);
assert.ok(profileLockIndex >= 0, "Izdaja mora zakleniti zaporedje uporabnika.");
assert.ok(existingInvoiceIndex > profileLockIndex, "Idempotentni pregled mora slediti zaklepu uporabnika.");
assert.ok(draftOwnershipIndex > existingInvoiceIndex, "Obstoj osnutka se preveri šele po zaklepu in idempotentnem pregledu.");
assert.match(issueConcurrencyMigration, /security definer\s+set search_path = ''/i);
assert.match(issueConcurrencyMigration, /revoke all on function private\._pos_issue_invoice\(uuid,jsonb,boolean,boolean\) from public, anon/i);
assert.match(issueConcurrencyMigration, /grant execute on function private\._pos_issue_invoice\(uuid,jsonb,boolean,boolean\) to authenticated, service_role/i);
assert.ok(privateRpcSurfaceMigrationName, "Manjka zaprtje neposrednega dostopa do zasebnih POS RPC funkcij.");
[
  "pos_archive_readiness", "pos_confirm_bank_transaction", "pos_create_invoice_adjustment",
  "pos_import_bank_transactions", "pos_import_finapi_transactions", "pos_issue_invoice",
  "pos_issue_replacement_invoice", "pos_prepare_invoice_delivery", "pos_queue_invoice_delivery",
  "pos_record_manual_payment", "pos_save_work_order", "pos_transition_work_order"
].forEach((name) => {
  assert.match(privateRpcSurfaceMigration, new RegExp("alter function public\\." + name + "\\([^;]*\\) security definer", "i"));
});
[
  "pos_archive_readiness", "_pos_confirm_bank_transaction", "_pos_create_invoice_adjustment_validated",
  "_pos_import_bank_transactions_validated", "_pos_import_finapi_transactions_validated",
  "_pos_issue_invoice_validated", "_pos_issue_replacement_invoice_validated",
  "_pos_prepare_invoice_delivery", "_pos_queue_invoice_delivery", "_pos_record_manual_payment",
  "_pos_save_work_order_validated", "_pos_transition_work_order"
].forEach((name) => {
  assert.match(privateRpcSurfaceMigration, new RegExp("revoke execute on function private\\." + name.replace(/^_/, "\\_") + "\\([^;]*from authenticated", "i"));
});
assert.ok(payloadLimitsMigrationName, "Manjka omejitev strežniškega POS payload-a.");
assert.match(payloadLimitsMigration, /octet_length\(p_payload::text\) > 524288/i);
assert.match(payloadLimitsMigration, /customer_street[\s\S]*between 1 and 180/i);
assert.match(payloadLimitsMigration, /customer_postal_code[\s\S]*between 1 and 12/i);
assert.match(payloadLimitsMigration, /customer_email[\s\S]*> 320/i);
assert.match(payloadLimitsMigration, /work_description[\s\S]*> 1200/i);
assert.match(payloadLimitsMigration, /pos_invoice_drafts_payload_size_check[\s\S]*validate constraint pos_invoice_drafts_payload_size_check/i);
assert.match(payloadLimitsMigration, /pos_invoices_snapshot_size_check[\s\S]*validate constraint pos_invoices_snapshot_size_check/i);
assert.match(payloadLimitsMigration, /create or replace function public\.pos_issue_invoice[\s\S]*security definer[\s\S]*private\.pos_validate_invoice_payload/i);
assert.match(payloadLimitsMigration, /create or replace function public\.pos_issue_replacement_invoice[\s\S]*security definer[\s\S]*private\.pos_validate_invoice_payload/i);
assert.match(payloadLimitsMigration, /revoke execute on function private\._pos_issue_invoice\(uuid,jsonb,boolean,boolean\) from authenticated/i);
assert.match(payloadLimitsMigration, /revoke execute on function private\._pos_issue_replacement_invoice\(uuid,jsonb,boolean,boolean,uuid\) from authenticated/i);
assert.ok(payloadInvokerMigrationName, "Manjka neprivilegiran javni ovoj za POS izdajo.");
assert.match(payloadInvokerMigration, /create or replace function private\._pos_issue_invoice_validated[\s\S]*security definer[\s\S]*private\.pos_validate_invoice_payload/i);
assert.match(payloadInvokerMigration, /create or replace function private\._pos_issue_replacement_invoice_validated[\s\S]*security definer[\s\S]*private\.pos_validate_invoice_payload/i);
assert.match(payloadInvokerMigration, /create or replace function public\.pos_issue_invoice[\s\S]*security invoker[\s\S]*private\._pos_issue_invoice_validated/i);
assert.match(payloadInvokerMigration, /create or replace function public\.pos_issue_replacement_invoice[\s\S]*security invoker[\s\S]*private\._pos_issue_replacement_invoice_validated/i);
assert.match(payloadInvokerMigration, /revoke all on function private\._pos_issue_invoice_validated\(uuid,jsonb,boolean,boolean\) from public, anon/i);
assert.ok(manualPaymentMigrationName, "Manjka varna strežniška pot za ročno potrditev plačila.");
assert.match(manualPaymentMigration, /revoke insert on table public\.pos_payments from authenticated/i);
assert.match(manualPaymentMigration, /drop policy if exists pos_payment_insert_own/i);
assert.match(manualPaymentMigration, /where id = p_invoice_id and user_id = v_user\s+for update/i);
assert.match(manualPaymentMigration, /v_outstanding := v_invoice\.gross_cents - v_paid/i);
assert.match(manualPaymentMigration, /if v_outstanding <= 0 then raise exception 'Račun je že v celoti plačan\.'/i);
assert.match(manualPaymentMigration, /manual_payment_confirmed/i);
assert.match(manualPaymentMigration, /create or replace function public\.pos_record_manual_payment[\s\S]*security invoker/i);
assert.match(manualPaymentMigration, /revoke all on function public\.pos_record_manual_payment\(uuid,boolean\) from public, anon/i);
assert.match(manualPaymentMigration, /grant execute on function public\.pos_record_manual_payment\(uuid,boolean\) to authenticated, service_role/i);
assert.ok(manualPaymentRetryMigrationName, "Manjka idempotentna ponovitev ročne potrditve plačila.");
assert.match(manualPaymentRetryMigration, /create table private\.pos_manual_payment_requests/i);
assert.match(manualPaymentRetryMigration, /primary key \(user_id, request_key\)/i);
assert.match(manualPaymentRetryMigration, /foreign key \(invoice_id, user_id\)[\s\S]*references public\.pos_invoices\(id, user_id\)/i);
assert.match(manualPaymentRetryMigration, /foreign key \(payment_id, user_id\)[\s\S]*references public\.pos_payments\(id, user_id\)/i);
assert.match(manualPaymentRetryMigration, /alter table private\.pos_manual_payment_requests enable row level security/i);
const manualPaymentRetryLock = manualPaymentRetryMigration.search(/from public\.pos_invoices[\s\S]*where id = p_invoice_id and user_id = v_user[\s\S]*for update/i);
const manualPaymentRetryLookup = manualPaymentRetryMigration.search(/from private\.pos_manual_payment_requests request[\s\S]*request\.request_key = p_request_key/i);
const manualPaymentRetryCreate = manualPaymentRetryMigration.search(/v_payment := private\._pos_record_manual_payment\(p_invoice_id, p_confirmed\)/i);
assert.ok(manualPaymentRetryLock >= 0 && manualPaymentRetryLookup > manualPaymentRetryLock && manualPaymentRetryCreate > manualPaymentRetryLookup, "Ponovitev plačila mora po zaklepu računa najprej poiskati isti zahtevek.");
assert.match(manualPaymentRetryMigration, /v_existing\.invoice_id is distinct from p_invoice_id/i);
assert.match(manualPaymentRetryMigration, /revoke all on function public\.pos_record_manual_payment\(uuid,boolean\)[\s\S]*from public, anon, authenticated/i);
assert.match(manualPaymentRetryMigration, /grant execute on function public\.pos_record_manual_payment\(uuid,uuid,boolean\)[\s\S]*to authenticated, service_role/i);
assert.ok(profilePrivilegesMigrationName, "Manjka zaščita strežniških števcev računa.");
assert.match(profilePrivilegesMigration, /revoke insert, update on table public\.pos_business_profiles from authenticated/i);
assert.match(profilePrivilegesMigration, /grant insert \([\s\S]*user_id[\s\S]*legal_name[\s\S]*datev_settings[\s\S]*\) on public\.pos_business_profiles to authenticated/i);
assert.match(profilePrivilegesMigration, /grant update \([\s\S]*user_id[\s\S]*legal_name[\s\S]*datev_settings[\s\S]*\) on public\.pos_business_profiles to authenticated/i);
assert.doesNotMatch(profilePrivilegesMigration, /grant (?:insert|update) \([\s\S]*next_(?:invoice|test|adjustment)_sequence/i);
assert.doesNotMatch(profilePrivilegesMigration, /grant (?:insert|update) \([\s\S]*\b(?:created_at|updated_at)\b/i);
assert.ok(datevMigrationName, "Manjka migracija za DATEV nastavitve.");
assert.match(datevMigration, /alter table public\.pos_business_profiles[\s\S]*add column datev_settings jsonb not null default '\{\}'::jsonb/i);
assert.match(datevMigration, /jsonb_typeof\(datev_settings\) = 'object'/i);
assert.ok(documentsMigrationName, "Manjka migracija za PDF originale računov.");
assert.match(documentsMigration, /create table public\.pos_invoice_documents/i);
assert.match(documentsMigration, /alter table public\.pos_invoice_documents enable row level security/i);
assert.match(documentsMigration, /grant select on table public\.pos_invoice_documents to authenticated/i);
assert.doesNotMatch(documentsMigration, /grant\s+(?:all|insert|update|delete)[^;]*public\.pos_invoice_documents\s+to authenticated/i);
assert.match(documentsMigration, /create trigger pos_invoice_documents_immutable/i);
assert.match(documentsMigration, /'pos-invoice-originals'[\s\S]*false/i);
assert.match(pdfApi, /preveriUporabnika\(req, cfg\)/);
assert.match(pdfApi, /user_id=eq\." \+ encodeURIComponent\(userId\)/);
assert.match(pdfApi, /"x-upsert": "false"/);
assert.match(pdfApi, /sha256\(pdf\) !== document\.sha256/);
assert.ok(adjustmentsMigrationName, "Manjka migracija za Storno in Rechnungsberichtigung.");
assert.match(adjustmentsMigration, /create table public\.pos_invoice_adjustments/i);
assert.match(adjustmentsMigration, /create table public\.pos_adjustment_documents/i);
assert.match(adjustmentsMigration, /alter table public\.pos_invoice_adjustments enable row level security/i);
assert.match(adjustmentsMigration, /grant select on table public\.pos_invoice_adjustments, public\.pos_adjustment_documents to authenticated/i);
assert.doesNotMatch(adjustmentsMigration, /grant\s+(?:all|insert|update|delete)[^;]*public\.pos_invoice_adjustments[^;]*to authenticated/i);
assert.match(adjustmentsMigration, /create unique index pos_invoice_adjustments_single_cancellation_uidx/i);
assert.match(adjustmentsMigration, /create trigger pos_invoice_adjustments_immutable/i);
assert.match(adjustmentsMigration, /not exists \([\s\S]*adjustment_type = 'cancellation'/i);
assert.match(adjustmentsMigration, /p_adjustment_type not in \('correction','cancellation'\)/i);
assert.match(adjustmentsMigration, /v_net := -v_invoice\.net_cents/i);
assert.match(adjustmentsMigration, /security definer\s+set search_path = ''/i);
assert.match(adjustmentsMigration, /create or replace function public\.pos_create_invoice_adjustment[\s\S]*security invoker/i);
assert.ok(adjustmentLimitsMigrationName, "Manjka omejitev payload-a popravka računa.");
assert.match(adjustmentLimitsMigration, /octet_length\(p_changes::text\) > 65536/i);
assert.match(adjustmentLimitsMigration, /jsonb_typeof\(v_value\) <> 'string'/i);
assert.match(adjustmentLimitsMigration, /pos_invoice_adjustments_changes_size_check[\s\S]*validate constraint pos_invoice_adjustments_changes_size_check/i);
assert.match(adjustmentLimitsMigration, /pos_invoice_adjustments_snapshot_size_check[\s\S]*2097152[\s\S]*validate constraint pos_invoice_adjustments_snapshot_size_check/i);
assert.match(adjustmentLimitsMigration, /create or replace function private\._pos_create_invoice_adjustment_validated[\s\S]*security definer/i);
assert.match(adjustmentLimitsMigration, /create or replace function public\.pos_create_invoice_adjustment[\s\S]*security invoker[\s\S]*private\._pos_create_invoice_adjustment_validated/i);
assert.match(adjustmentLimitsMigration, /revoke execute on function private\._pos_create_invoice_adjustment\(uuid,text,text,jsonb,boolean\) from authenticated/i);
assert.ok(adjustmentRetryMigrationName, "Manjka idempotentna ponovitev popravka po izgubljenem odgovoru.");
assert.match(adjustmentRetryMigration, /create table private\.pos_adjustment_requests/i);
assert.match(adjustmentRetryMigration, /primary key \(user_id, request_key\)/i);
assert.match(adjustmentRetryMigration, /foreign key \(adjustment_id, user_id\)[\s\S]*references public\.pos_invoice_adjustments\(id, user_id\)/i);
assert.match(adjustmentRetryMigration, /alter table private\.pos_adjustment_requests enable row level security/i);
const retryProfileLock = adjustmentRetryMigration.search(/from public\.pos_business_profiles[\s\S]*where user_id = v_user[\s\S]*for update/i);
const retryLookup = adjustmentRetryMigration.search(/from private\.pos_adjustment_requests request[\s\S]*request\.request_key = p_request_key/i);
const retryCreate = adjustmentRetryMigration.search(/v_adjustment := private\._pos_create_invoice_adjustment\(/i);
assert.ok(retryProfileLock >= 0 && retryLookup > retryProfileLock && retryCreate > retryLookup, "Ponovitev mora po uporabniškem zaklepu najprej poiskati isti zahtevek.");
assert.match(adjustmentRetryMigration, /v_existing\.changes is distinct from v_changes/i);
assert.match(adjustmentRetryMigration, /revoke execute on function public\.pos_create_invoice_adjustment\(uuid,text,text,jsonb,boolean\)[\s\S]*from authenticated/i);
assert.match(adjustmentRetryMigration, /grant execute on function public\.pos_create_invoice_adjustment\(uuid,uuid,text,text,jsonb,boolean\)[\s\S]*to authenticated, service_role/i);
assert.ok(adjustmentRetryIndexMigrationName, "Manjka pokrivni indeks idempotentne povezave popravka.");
assert.match(adjustmentRetryIndexMigration, /create index pos_adjustment_requests_adjustment_tenant_idx[\s\S]*on private\.pos_adjustment_requests\(adjustment_id, user_id\)/i);
assert.ok(adjustmentSourceMigrationName, "Manjkajo izvorne invariante popravkov računov.");
assert.match(adjustmentSourceMigration, /pos_invoice_adjustments_kind_shape_check/i);
assert.match(adjustmentSourceMigration, /adjustment_type = 'correction'[\s\S]*changes <> '\{\}'::jsonb[\s\S]*delta_gross_cents = 0/i);
assert.match(adjustmentSourceMigration, /adjustment_type = 'cancellation'[\s\S]*delta_gross_cents < 0/i);
assert.match(adjustmentSourceMigration, /new\.snapshot #>> '\{original_invoice,invoice_number\}' <> v_invoice\.invoice_number/i);
assert.match(adjustmentSourceMigration, /new\.delta_gross_cents <> -v_invoice\.gross_cents/i);
assert.match(adjustmentSourceMigration, /new\.changes \? 'due_date'[\s\S]*v_invoice\.issue_date \+ 365/i);
assert.match(adjustmentSourceMigration, /create trigger pos_invoice_adjustments_validate_source[\s\S]*before insert on public\.pos_invoice_adjustments/i);
assert.match(adjustmentSourceMigration, /validate constraint pos_invoice_adjustments_kind_shape_check/i);
assert.ok(adjustmentNullGuardsMigrationName, "Manjkajo NULL-varovalke izvora popravkov.");
assert.match(adjustmentNullGuardsMigration, /perform private\.pos_validate_adjustment_changes\(/i);
assert.strictEqual((adjustmentNullGuardsMigration.match(/is distinct from/gi) || []).length, 9);
assert.match(adjustmentNullGuardsMigration, /snapshot #>> '\{original_invoice,id\}' is distinct from v_invoice\.id::text/i);
assert.match(adjustmentNullGuardsMigration, /snapshot #>> '\{original_invoice,gross_cents\}'\)::bigint is distinct from v_invoice\.gross_cents/i);
assert.match(adjustmentNullGuardsMigration, /revoke all on function private\.pos_validate_adjustment_source\(\) from public, anon, authenticated/i);
assert.ok(businessProfileInvariantsMigrationName, "Manjkajo varovalke poslovnega profila.");
assert.match(businessProfileInvariantsMigration, /create or replace function private\.pos_iban_valid\(p_iban text\)/i);
assert.match(businessProfileInvariantsMigration, /return v_remainder = 1/i);
assert.match(businessProfileInvariantsMigration, /pos_business_profiles_german_tax_shape_check/i);
assert.match(businessProfileInvariantsMigration, /vat_id = '' or vat_id ~ '\^DE\[0-9\]\{9\}\$'/i);
assert.match(businessProfileInvariantsMigration, /pos_business_profiles_confirmation_check/i);
assert.match(businessProfileInvariantsMigration, /grant execute on function private\.pos_iban_valid\(text\) to authenticated, service_role/i);
assert.ok(profileReconfirmationMigrationName, "Manjka ponovna potrditev spremenjenega profila.");
assert.match(profileReconfirmationMigration, /if old\.legal_confirmed and/i);
assert.match(profileReconfirmationMigration, /new\.iban is distinct from old\.iban/i);
assert.match(profileReconfirmationMigration, /new\.legal_confirmed := false/i);
assert.match(profileReconfirmationMigration, /create trigger pos_business_profiles_reset_confirmation[\s\S]*before update on public\.pos_business_profiles/i);
assert.ok(sellerLegalIdentityMigrationName, "Manjkajo pravni podatki izdajatelja za nemške poslovne dokumente.");
assert.match(sellerLegalIdentityMigration, /add column company_seat text not null default ''/i);
assert.match(sellerLegalIdentityMigration, /add column register_court text not null default ''/i);
assert.match(sellerLegalIdentityMigration, /add column register_number text not null default ''/i);
assert.match(sellerLegalIdentityMigration, /legal_form in \('Einzelunternehmen', 'e\.K\.', 'GbR', 'eGbR', 'UG \(haftungsbeschränkt\)', 'GmbH'\)/i);
assert.match(sellerLegalIdentityMigration, /pos_invoices_live_seller_legal_identity_check[\s\S]*validate constraint pos_invoices_live_seller_legal_identity_check/i);
assert.match(sellerLegalIdentityMigration, /create trigger pos_invoices_capture_seller_legal_identity[\s\S]*before insert on public\.pos_invoices/i);
assert.match(sellerLegalIdentityMigration, /create trigger pos_work_orders_lock_seller_legal_identity[\s\S]*before update of status on public\.pos_work_orders/i);
assert.match(sellerLegalIdentityMigration, /new\.locked_payload := jsonb_set[\s\S]*'\{seller\}'/i);
assert.ok(expandedLegalFormsMigrationName, "Manjka razširitev običajnih nemških pravnih oblik.");
assert.match(html, /<option>OHG<\/option>[\s\S]*<option>KG<\/option>[\s\S]*<option>GmbH &amp; Co\. KG<\/option>[\s\S]*<option>AG<\/option>[\s\S]*<option>eG<\/option>/);
assert.match(js, /SUPPORTED_LEGAL_FORMS[\s\S]*"OHG"[\s\S]*"GmbH & Co\. KG"[\s\S]*"AG"[\s\S]*"eG"/);
assert.match(expandedLegalFormsMigration, /legal_form in \([\s\S]*'OHG'[\s\S]*'KG'[\s\S]*'GmbH & Co\. KG'[\s\S]*'AG'[\s\S]*'eG'/i);
assert.match(expandedLegalFormsMigration, /drop constraint pos_invoices_live_seller_legal_identity_check[\s\S]*add constraint pos_invoices_live_seller_legal_identity_check/i);
assert.ok(germanTaxReceivingMigrationName, "Manjkajo nemške davčne in E-Rechnung varovalke profila.");
assert.match(germanTaxReceivingMigration, /add column small_business_eligibility_confirmed boolean not null default false/i);
assert.match(germanTaxReceivingMigration, /add column einvoice_receiving_confirmed boolean not null default false/i);
assert.match(germanTaxReceivingMigration, /tax_status <> 'small_business' or small_business_eligibility_confirmed/i);
assert.match(germanTaxReceivingMigration, /trim\(business_email\) <> ''[\s\S]*einvoice_receiving_confirmed/i);
assert.match(germanTaxReceivingMigration, /grant insert \(small_business_eligibility_confirmed, einvoice_receiving_confirmed\)/i);
assert.match(germanTaxReceivingMigration, /new\.einvoice_receiving_confirmed is distinct from old\.einvoice_receiving_confirmed/i);
assert.ok(invoicePartyValidationMigrationName, "Manjka strežniška validacija prejemnika računa.");
assert.match(invoicePartyValidationMigration, /customer_postal_code[\s\S]*'\^\[0-9\]\{5\}\$'/i);
assert.match(invoicePartyValidationMigration, /customer_email[\s\S]*\^\[\^\[:space:\]@\]\+@/i);
assert.match(invoicePartyValidationMigration, /tax_mode[\s\S]*reverse_charge[\s\S]*v_vat_id = ''/i);
assert.match(invoicePartyValidationMigration, /private\.pos_validate_invoice_payload\([\s\S]*private\.pos_validate_invoice_party_fields\(/i);
assert.match(invoicePartyValidationMigration, /revoke all on function private\.pos_validate_invoice_party_fields\(jsonb\)[\s\S]*authenticated/i);
assert.ok(invoiceEinvoicePartyRequirementsMigrationName, "Manjkajo strežniške zahteve za XRechnung kontakte.");
assert.match(invoiceEinvoicePartyRequirementsMigration, /v_customer_type in \('business', 'public'\)[\s\S]*v_buyer_reference = '' and v_leitweg_id = ''/i);
assert.match(invoiceEinvoicePartyRequirementsMigration, /v_customer_type = 'business' and v_email = ''/i);
assert.match(invoiceEinvoicePartyRequirementsMigration, /v_seller_email[\s\S]*business_email[\s\S]*auth\.uid\(\)/i);
assert.match(invoiceEinvoicePartyRequirementsMigration, /v_seller_phone = ''/i);
assert.ok(invoiceTaxEvidenceRequirementsMigrationName, "Manjkajo strežniške zahteve za davčna dokazila računa.");
assert.match(invoiceTaxEvidenceRequirementsMigration, /v_construction_withholding[\s\S]*v_customer_type not in \('business', 'public'\)/i);
assert.match(invoiceTaxEvidenceRequirementsMigration, /v_exemption_certificate not in \('valid', 'missing', 'not_applicable'\)/i);
assert.match(invoiceTaxEvidenceRequirementsMigration, /v_handwerker_35a[\s\S]*v_customer_type <> 'private'/i);
assert.match(invoiceTaxEvidenceRequirementsMigration, /private\.pos_validate_invoice_tax_evidence\([\s\S]*private\.pos_validate_invoice_payload/i);
assert.ok(alreadyPaidInvoicePaymentMigrationName, "Manjka atomaren zapis že plačanega računa.");
assert.match(alreadyPaidInvoicePaymentMigration, /snapshot #>> '\{draft,payment_method\}' = 'already_paid'/i);
assert.match(alreadyPaidInvoicePaymentMigration, /insert into public\.pos_payments[\s\S]*new\.gross_cents/i);
assert.match(alreadyPaidInvoicePaymentMigration, /create trigger pos_invoices_record_already_paid[\s\S]*after insert on public\.pos_invoices/i);
assert.match(alreadyPaidInvoicePaymentMigration, /invoice_issued_already_paid/i);
assert.ok(germanBusinessTimezoneMigrationName, "Manjka nemški poslovni časovni pas za strežniške POS funkcije.");
assert.match(germanBusinessTimezoneMigration, /_pos_create_invoice_adjustment\(uuid,text,text,jsonb,boolean\)[\s\S]*Europe\/Berlin/i);
assert.match(germanBusinessTimezoneMigration, /_pos_save_work_order\(uuid,jsonb\)[\s\S]*Europe\/Berlin/i);
assert.match(germanBusinessTimezoneMigration, /_pos_transition_work_order\(uuid,text\)[\s\S]*Europe\/Berlin/i);
assert.match(germanBusinessTimezoneMigration, /_pos_import_finapi_transactions\(text,jsonb\)[\s\S]*Europe\/Berlin/i);
assert.match(adjustmentPdfApi, /preveriUporabnika\(req, cfg\)/);
assert.match(adjustmentPdfApi, /user_id=eq\." \+ encodeURIComponent\(userId\)/);
assert.match(adjustmentPdfApi, /"x-upsert": "false"/);
assert.match(adjustmentPdfApi, /sha256\(pdf\) !== document\.sha256/);
assert.ok(replacementsMigrationName, "Manjka migracija za nadomestne račune.");
assert.match(replacementsMigration, /create table public\.pos_invoice_replacements/i);
assert.match(replacementsMigration, /alter table public\.pos_invoice_replacements enable row level security/i);
assert.match(replacementsMigration, /grant select on table public\.pos_invoice_replacements to authenticated/i);
assert.doesNotMatch(replacementsMigration, /grant\s+(?:all|insert|update|delete)[^;]*public\.pos_invoice_replacements\s+to authenticated/i);
assert.match(replacementsMigration, /cancellation_adjustment_id uuid not null unique/i);
assert.match(replacementsMigration, /replacement_invoice_id uuid not null unique/i);
assert.match(replacementsMigration, /for update;[\s\S]*Za ta Storno nadomestni račun že obstaja/i);
assert.match(replacementsMigration, /v_replacement\.is_test <> v_original\.is_test/i);
assert.match(replacementsMigration, /create trigger pos_invoice_replacements_immutable/i);
assert.match(replacementsMigration, /create or replace function public\.pos_issue_replacement_invoice[\s\S]*security invoker/i);
assert.match(replacementsMigration, /revoke all on function public\.pos_issue_replacement_invoice\(uuid,jsonb,boolean,boolean,uuid\) from public, anon/i);

assert.ok(deliveriesMigrationName, "Manjka migracija za dostavni predal računov.");
assert.match(deliveriesMigration, /add column previous_year_turnover_band/i);
assert.match(deliveriesMigration, /create table public\.pos_invoice_deliveries/i);
assert.match(deliveriesMigration, /create table public\.pos_invoice_delivery_events/i);
assert.match(deliveriesMigration, /alter table public\.pos_invoice_deliveries enable row level security/i);
assert.match(deliveriesMigration, /grant select on table public\.pos_invoice_deliveries, public\.pos_invoice_delivery_events\s+to authenticated/i);
assert.doesNotMatch(deliveriesMigration, /grant\s+(?:all|insert|update|delete)[^;]*public\.pos_invoice_deliveries[^;]*to authenticated/i);
assert.match(deliveriesMigration, /create index pos_invoice_deliveries_invoice_created_idx/i);
assert.match(deliveriesMigration, /unique \(user_id, request_key\)/i);
assert.match(deliveriesMigration, /status, provider, is_test[\s\S]*'test_prepared', 'not_connected', true/i);
assert.match(deliveriesMigration, /Storniranega računa ni dovoljeno pripraviti za pošiljanje/i);
assert.match(deliveriesMigration, /Za elektronski PDF je potrebno soglasje prejemnika/i);
assert.match(deliveriesMigration, /promet prejšnjega leta do 800\.000 EUR/i);
assert.match(deliveriesMigration, /Javni naročnik zahteva XRechnung prek uradnega kanala/i);
assert.match(deliveriesMigration, /security definer\s+set search_path = ''/i);
assert.match(deliveriesMigration, /create or replace function public\.pos_prepare_invoice_delivery[\s\S]*security invoker/i);
assert.match(deliveriesMigration, /revoke all on function public\.pos_prepare_invoice_delivery\(uuid,uuid,text,text,text,text,text,text,boolean,boolean\)[\s\S]*from public, anon/i);

assert.ok(xrechnungMigrationName, "Manjka migracija za arhivirane XRechnung originale.");
assert.match(xrechnungMigration, /create table public\.pos_einvoice_documents/i);
assert.match(xrechnungMigration, /create table public\.pos_einvoice_validation_events/i);
assert.match(xrechnungMigration, /alter table public\.pos_einvoice_documents enable row level security/i);
assert.match(xrechnungMigration, /grant select on table public\.pos_einvoice_documents, public\.pos_einvoice_validation_events to authenticated/i);
assert.match(xrechnungMigration, /seller_contact_phone/i);
assert.match(xrechnungMigration, /p_final_confirmed,[\s\S]*true/i);
assert.match(xrechnungApi, /KOSIT_VALIDATOR_URL/);
assert.match(xrechnungApi, /response\.status === 200/);
assert.match(xrechnungApi, /response\.status === 406/);
assert.match(xrechnungApi, /sha256\(xml\) !== document\.sha256/);

assert.ok(bankMigrationName, "Manjka Supabase migracija za bančno usklajevanje.");
assert.match(bankMigration, /create table public\.pos_bank_imports/i);
assert.match(bankMigration, /create table public\.pos_bank_transactions/i);
assert.match(bankMigration, /alter table public\.pos_bank_imports enable row level security/i);
assert.match(bankMigration, /alter table public\.pos_bank_transactions enable row level security/i);
assert.match(bankMigration, /grant select on table public\.pos_bank_imports, public\.pos_bank_transactions to authenticated/i);
assert.doesNotMatch(bankMigration, /grant\s+(?:all|insert|update|delete)[^;]*public\.pos_bank_transactions[^;]*to authenticated/i);
assert.match(bankMigration, /unique \(user_id, file_sha256\)/i);
assert.match(bankMigration, /unique \(user_id, source_key\)/i);
assert.match(bankMigration, /source_bank_transaction_id/i);
assert.match(bankMigration, /source_bank_transaction_id is null/i);
assert.match(bankMigration, /for update/i);
assert.match(bankMigration, /Potrditev uporabnika je obvezna/i);
assert.match(bankMigration, /Priliv presega odprti znesek računa/i);
assert.match(bankMigration, /security definer\s+set search_path = ''/i);
assert.match(bankMigration, /create or replace function public\.pos_import_bank_transactions[\s\S]*security invoker/i);
assert.match(bankMigration, /create or replace function public\.pos_confirm_bank_transaction[\s\S]*security invoker/i);
assert.match(bankMigration, /notify pgrst, 'reload schema'/i);
assert.ok(finapiMigrationName, "Manjka Supabase migracija za finAPI bančni vir.");
assert.match(finapiMigration, /file_format in \('csv','camt053','finapi'\)/i);
assert.match(finapiMigration, /create or replace function public\.pos_import_finapi_transactions/i);
assert.match(finapiMigration, /security invoker/i);
assert.match(finapiMigration, /security definer\s+set search_path = ''/i);
assert.match(finapiMigration, /external_reference !~ '\^finapi:\[0-9\]\+\$'/i);
assert.match(finapiMigration, /notify pgrst, 'reload schema'/i);
assert.ok(bankLimitsMigrationName, "Manjka omejitev payload-a bančnega uvoza.");
assert.match(bankLimitsMigration, /octet_length\(p_transactions::text\) > p_max_bytes/i);
assert.match(bankLimitsMigration, /jsonb_typeof\(v_row->'amount_cents'\) not in \('number', 'string'\)/i);
assert.match(bankLimitsMigration, /v_amount > 9223372036854775807/i);
assert.match(bankLimitsMigration, /private\._pos_import_bank_transactions_validated[\s\S]*4194304/i);
assert.match(bankLimitsMigration, /private\._pos_import_finapi_transactions_validated[\s\S]*2097152/i);
assert.match(bankLimitsMigration, /create or replace function public\.pos_import_bank_transactions[\s\S]*security invoker[\s\S]*private\._pos_import_bank_transactions_validated/i);
assert.match(bankLimitsMigration, /create or replace function public\.pos_import_finapi_transactions[\s\S]*security invoker[\s\S]*private\._pos_import_finapi_transactions_validated/i);
assert.match(bankLimitsMigration, /revoke execute on function private\._pos_import_bank_transactions\(text,text,text,jsonb\) from authenticated/i);
assert.match(bankLimitsMigration, /revoke execute on function private\._pos_import_finapi_transactions\(text,jsonb\) from authenticated/i);
assert.ok(internalJsonLimitsMigrationName, "Manjkajo omejitve notranjih JSON zapisov POS.");
assert.match(internalJsonLimitsMigration, /pos_audit_events_details_size_check[\s\S]*octet_length\(details::text\) <= 65536/i);
assert.match(internalJsonLimitsMigration, /pos_datev_connections_services_size_check[\s\S]*jsonb_typeof\(services\) = 'array'/i);
assert.match(internalJsonLimitsMigration, /pos_einvoice_documents_validation_report_size_check[\s\S]*2097152/i);
assert.match(internalJsonLimitsMigration, /pos_payments_metadata_size_check[\s\S]*jsonb_typeof\(metadata\) = 'object'/i);
assert.match(internalJsonLimitsMigration, /validate constraint pos_work_order_events_details_size_check/i);
assert.ok(moneyInvariantsMigrationName, "Manjkajo denarne invariante POS.");
assert.match(moneyInvariantsMigration, /gross_cents = net_cents \+ tax_cents/i);
assert.match(moneyInvariantsMigration, /eligible_35a_cents between 0 and gross_cents/i);
assert.match(moneyInvariantsMigration, /tax_mode = 'regular' or tax_cents = 0/i);
assert.match(moneyInvariantsMigration, /pos_invoice_adjustments_money_invariant_check[\s\S]*delta_gross_cents = delta_net_cents \+ delta_tax_cents/i);
assert.match(moneyInvariantsMigration, /pos_payments_amount_upper_bound_check[\s\S]*100000000000/i);
assert.match(moneyInvariantsMigration, /validate constraint pos_bank_transactions_amount_upper_bound_check/i);
assert.ok(dateInvariantsMigrationName, "Manjkajo datumske invariante POS.");
assert.match(dateInvariantsMigration, /due_date between issue_date and issue_date \+ 365/i);
assert.match(dateInvariantsMigration, /is_test and document_status = 'test'/i);
assert.match(dateInvariantsMigration, /not is_test and document_status = 'issued'/i);
assert.match(dateInvariantsMigration, /valid_until between[\s\S]*Europe\/Berlin[\s\S]*\+ 180/i);
assert.match(dateInvariantsMigration, /create trigger pos_invoices_live_issue_date_guard[\s\S]*before insert or update of issue_date, is_test/i);
assert.match(dateInvariantsMigration, /not new\.is_test[\s\S]*Europe\/Berlin[\s\S]*pg_catalog\.now/i);
assert.match(dateInvariantsMigration, /revoke all on function private\.pos_enforce_live_invoice_issue_date\(\) from public, anon, authenticated/i);
assert.match(dateInvariantsMigration, /validate constraint pos_work_orders_validity_window_check/i);
assert.ok(liveCalendarMigrationName, "Manjka stroga koledarska varovalka pravih računov.");
assert.match(liveCalendarMigration, /check \(is_test or service_date <= issue_date\) not valid/i);
assert.match(liveCalendarMigration, /new\.issue_date is distinct from[\s\S]*Europe\/Berlin[\s\S]*pg_catalog\.now/i);
assert.match(liveCalendarMigration, /validate constraint pos_invoices_live_service_date_check/i);
assert.ok(liveBauabzugMigrationName, "Manjka produkcijska varovalka nepodprte Bauabzugsteuer.");
assert.match(liveBauabzugMigration, /pos_invoices_live_bauabzug_support_check/i);
assert.match(liveBauabzugMigration, /construction_withholding[\s\S]*exemption_certificate[\s\S]*missing/i);
assert.match(liveBauabzugMigration, /validate constraint pos_invoices_live_bauabzug_support_check/i);
assert.ok(tenantInvariantsMigrationName, "Manjkajo uporabniške invariante povezav POS.");
assert.strictEqual((tenantInvariantsMigration.match(/foreign key \([^\n]+, user_id\)/gi) || []).length, 25);
assert.strictEqual((tenantInvariantsMigration.match(/validate constraint pos_tenant_/gi) || []).length, 25);
assert.strictEqual((tenantInvariantsMigration.match(/unique \(id, user_id\)/gi) || []).length, 10);
assert.match(tenantInvariantsMigration, /pos_tenant_archive_record_invoice_fk[\s\S]*foreign key \(invoice_id, user_id\)/i);
assert.match(tenantInvariantsMigration, /pos_tenant_payment_invoice_fk[\s\S]*references public\.pos_invoices\(id, user_id\)/i);
assert.match(tenantInvariantsMigration, /pos_tenant_invoice_delivery_event_delivery_fk[\s\S]*references public\.pos_invoice_deliveries\(id, user_id\)/i);
assert.match(tenantInvariantsMigration, /pos_tenant_work_order_invoice_order_fk[\s\S]*references public\.pos_work_orders\(id, user_id\)/i);
assert.ok(tenantIndexesMigrationName, "Manjkajo pokrivni indeksi uporabniških tujih ključev POS.");
assert.strictEqual((tenantIndexesMigration.match(/create index /gi) || []).length, 25);
assert.strictEqual((tenantIndexesMigration.match(/\([^\n]+, user_id\)/gi) || []).length, 25);
assert.match(tenantIndexesMigration, /pos_archive_records_invoice_user_idx[\s\S]*pos_archive_records\(invoice_id, user_id\)/i);
assert.match(tenantIndexesMigration, /pos_payments_invoice_user_idx[\s\S]*pos_payments\(invoice_id, user_id\)/i);
assert.match(tenantIndexesMigration, /pos_work_order_invoices_order_user_idx[\s\S]*pos_work_order_invoices\(work_order_id, user_id\)/i);
assert.ok(finapiAccountMigrationName, "Manjka migracija za izvorni finAPI račun.");
assert.match(finapiAccountMigration, /add column source_account_id text/i);
assert.match(finapiAccountMigration, /add column source_account_name text/i);
assert.match(finapiAccountMigration, /add column source_account_iban text/i);
assert.match(finapiAccountMigration, /on conflict \(user_id,source_key\) do nothing/i);
assert.match(finapiAccountMigration, /update public\.pos_bank_transactions[\s\S]*source_account_id/i);
assert.match(finapiApi, /preveriUporabnika\(req, cfg\)/);
assert.match(finapiApi, /syncTransactions\(auth\.user\.id\)/);
assert.match(finapiApi, /createBankWebForm\(auth\.user\.id\)/);
assert.doesNotMatch(finapiApi, /FINAPI_CLIENT_SECRET/);
assert.match(finapiLib, /https:\/\/sandbox\.finapi\.io\/api\/v2/);
assert.match(finapiLib, /https:\/\/webform-sandbox\.finapi\.io/);
assert.match(finapiLib, /createHmac\("sha256"/);
assert.match(finapiLib, /\/api\/webForms\/bankConnectionImport/);
assert.doesNotMatch(finapiLib, /requestJson\(cfg, "\/bankConnections\/import"/);
assert.match(finapiLib, /Do NOT route multiple application users|one end user/i);
assert.doesNotMatch(js, /await\s+backend\.client\.rpc\(/, "Vsak neposredno čakani RPC mora imeti časovno omejitev.");
assert.strictEqual((js.match(/backend\.client\.rpc\(/g) || []).length, 18, "Novi RPC klic zahteva izrecen pregled timeouta.");
assert.strictEqual((js.match(/withOperationTimeout\(backend\.client\.rpc\(/g) || []).length, 15, "Neposredni RPC klici morajo biti oviti v timeout.");
assert.match(js, /var result = await withOperationTimeout\(request\.single\(\)\)/, "Tudi dinamični RPC prehod naročila potrebuje timeout.");
assert.match(js, /if \(invoiceIssuing\) return;[\s\S]*issueButton\.setAttribute\("aria-busy", "true"\)/, "Izdaja računa mora blokirati dvojni klik.");
assert.match(js, /if \(webhookConfirmed\)[\s\S]*clearOperationRequestId\("stripe-refund"/, "Stripe idempotency ključ se sme počistiti šele po potrditvi webhooka.");
assert.match(js, /var needsKositPreflight = profileReadiness\(state\.profile\)\.live[\s\S]*posEinvoicePreflightRequest\(draftId\)/, "Obvezna KoSIT izdaja mora najprej preveriti shranjeni osnutek.");
assert.strictEqual((kositPreflightMigration.match(/private\.pos_has_einvoice_preflight\(p_draft_id,p_payload\)/g) || []).length, 2, "Oba strežniška wrapperja morata zahtevati veljaven dokaz istega payload-a.");
assert.doesNotMatch(kositPreflightMigration, /p_final_confirmed,\s*true/i, "Klicateljev parameter ne sme obiti KoSIT dokaza.");
assert.match(kositPreflightMigration, /revoke all on function private\._pos_issue_invoice_validated[\s\S]*authenticated/i);

async function testFailureRecoveryHelpers() {
  const first = Core.operationRequestId("test-operation", "same-scope");
  const second = Core.operationRequestId("test-operation", "same-scope");
  assert.strictEqual(second, first, "Ponovitev mora ohraniti isti ključ zahtevka.");
  Core.clearOperationRequestId("test-operation", "same-scope");
  assert.notStrictEqual(Core.operationRequestId("test-operation", "same-scope"), first, "Po potrjenem uspehu mora nov postopek dobiti nov ključ.");
  assert.strictEqual(Core.operationScopeHash("isti-payload"), Core.operationScopeHash("isti-payload"));
  assert.notStrictEqual(Core.operationScopeHash("isti-payload"), Core.operationScopeHash("drug-payload"));
  assert.strictEqual(Core.missingSingleRowError({ code: "PGRST116" }), true, "Manjkajoči porabljeni osnutek mora dovoliti idempotentno obnovitev računa.");
  assert.strictEqual(Core.missingSingleRowError({ code: "42501" }), false, "Prave napake dovoljenj se ne smejo prikriti kot varna ponovitev.");

  await assert.rejects(
    Core.posFetch("/slow", {}, 15, function (_url, options) {
      return new Promise(function (_resolve, reject) {
        options.signal.addEventListener("abort", function () {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    }),
    function (error) { return error && error.code === "POS_REQUEST_TIMEOUT" && error.retryable === true; }
  );
  const response = await Core.posFetch("/fast", {}, 50, async function () { return { ok: true }; });
  assert.strictEqual(response.ok, true);

  await assert.rejects(
    Core.withOperationTimeout(new Promise(function () {}), 15),
    function (error) { return error && error.code === "POS_REQUEST_TIMEOUT" && error.retryable === true; }
  );
  assert.strictEqual(await Core.withOperationTimeout(Promise.resolve("ok"), 50), "ok");
}

Promise.all([testFetchAllRows(), testFailureRecoveryHelpers()]).then(function () {
  console.log("POS terminal: nemška logika, celotna zgodovina, dostavni predal, Supabase RLS in mobilna geometrija so preverjeni.");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
