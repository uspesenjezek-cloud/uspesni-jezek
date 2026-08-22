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

compatibilityWrappers.forEach(function (source) {
  assert.match(source, /module\.exports = require\("\.\/_handlers\/pos-[a-z-]+"\);/);
  assert.ok(source.trim().split(/\r?\n/).length <= 3, "POS združljivostna pot ne sme podvajati produkcijskega handlerja.");
});

assert.match(html, /data-view="home"/);
assert.match(html, /data-view="settings"/);
assert.match(html, /data-view="invoice"/);
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
assert.match(html, /name="previousYearTurnoverBand"/);
assert.match(html, /data-replacement-title data-fit-text data-fit-max="12"/);
assert.match(js, /rpcName = replacement \? "pos_issue_replacement_invoice" : "pos_issue_invoice"/);
assert.match(js, /\.rpc\(rpcName, rpcPayload\)/);
assert.match(js, /\.from\("pos_business_profiles"\)/);
assert.match(js, /typeof supabaseKlient !== "undefined" && supabaseKlient && supabaseKlient\.auth/);
assert.doesNotMatch(js, /global\.supabaseKlient/);
assert.match(js, /displayProfile = profileForPreview\(profile, invoice\.isTest\)/);
assert.match(js, /state\.invoices = mergeInvoiceSources\(serverInvoices, localTests\)/);
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
assert.match(js, /\.eq\("status", "confirmed"\)[^;\n]*\.limit\(200\)/);
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
assert.doesNotMatch(js, /\.from\("pos_payments"\)\.insert\(/);
assert.match(js, /source_bank_transaction_id/);
assert.match(js, /renderPaymentList\(invoice\)/);
assert.match(js, /Bančno nakazilo/);
assert.match(js, /\.from\("pos_invoice_documents"\)/);
assert.match(js, /\/api\/pos-racun-pdf\?invoiceId=/);
assert.match(js, /\/api\/pos-racun-xrechnung\?invoiceId=/);
assert.match(js, /\.from\("pos_einvoice_documents"\)/);
assert.match(js, /\.rpc\("pos_create_invoice_adjustment"/);
assert.match(js, /"pos_issue_replacement_invoice"/);
assert.match(js, /Nadomestni račun potrebuje varno strežniško povezavo/);
assert.match(js, /\.rpc\("pos_prepare_invoice_delivery"/);
assert.match(js, /\.rpc\("pos_queue_invoice_delivery"/);
assert.match(js, /\/api\/pos-dostava-sandbox/);
assert.match(js, /\/api\/pos-dostava-email/);
assert.match(js, /Pravo e-poštno pošiljanje/);
assert.match(js, /deliveryCapability\.liveEnabled/);
assert.match(js, /deliveryCapability\.sendEnabled/);
assert.match(js, /Varni e-poštni test/);
assert.match(js, /Stranka ga ne bo prejela/);
assert.match(js, /dovoljeni testni naslov/);
assert.match(js, /Sandbox preizkus je končan\. Nič ni bilo poslano\./);
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
assert.match(css, /\.pos-adjustment-sheet[\s\S]*max-height:\s*min\(88vh/);
assert.match(css, /\.pos-delivery-sheet[\s\S]*overflow-x:\s*hidden/);
assert.match(css, /\.pos-delivery-sheet__actions[\s\S]*env\(safe-area-inset-bottom\)/);
assert.match(css, /\.pos-bank-sheet[\s\S]*max-height:\s*min\(88vh/);
assert.match(css, /\.pos-bank-list[\s\S]*overflow-x:\s*hidden/);
assert.match(css, /\.pos-bank-provider[\s\S]*grid-template-columns/);
assert.match(css, /\.pos-datev-sheet[\s\S]*env\(safe-area-inset-bottom\)/);
assert.match(css, /\.pos-datev-sheet[\s\S]*overflow-x:\s*hidden/);

assert.strictEqual(Core.parseMoneyToCents("1.234,56 €"), 123456);
assert.strictEqual(Core.parseQuantityMilli("1,25"), 1250);
assert.deepStrictEqual(Core.normalizePosRefreshScopes(), { profile: true, draft: true, invoices: true, bank: true });
assert.deepStrictEqual(Core.normalizePosRefreshScopes("payments"), { payments: true });
assert.deepStrictEqual(Core.normalizePosRefreshScopes(["deliveries", "bank"]), { deliveries: true, bank: true });
assert.deepStrictEqual(Core.mergePosRefreshScopes({ payments: true }, "invoices"), { invoices: true });
assert.deepStrictEqual(Core.mergePosRefreshScopes({ bank: true }, "payments"), { bank: true, payments: true });
assert.deepStrictEqual(Core.paymentSummary([{ amountCents: 400, refundedCents: 0, status: "succeeded" }], 1000, "open"), { paidCents: 400, status: "partial" });
assert.deepStrictEqual(Core.paymentSummary([{ amountCents: 1200, refundedCents: 200, status: "partially_refunded" }], 1000, "open"), { paidCents: 1000, status: "paid" });
assert.deepStrictEqual(Core.paymentSummary([{ amountCents: 1000, refundedCents: 0, status: "failed" }], 1000, "open"), { paidCents: 0, status: "open" });
assert.deepStrictEqual(Core.paymentSummary([{ amountCents: 1000, refundedCents: 0, status: "succeeded" }], 1000, "cancelled"), { paidCents: 1000, status: "cancelled" });

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
profile.street = "Musterstraße 1";
profile.postalCode = "10115";
profile.city = "Berlin";
profile.businessEmail = "rechnung@muster-handwerk.de";
profile.businessPhone = "+49 30 1234567";
profile.taxNumber = "12/345/67890";
profile.accountHolder = "Muster Handwerk GmbH";
profile.iban = "DE02120300000000202051";
profile.legalConfirmed = true;
assert.strictEqual(Core.profileReadiness(profile).live, true);
assert.strictEqual(Core.profileReadiness(Object.assign({}, profile, { legalName: "   " })).live, false);
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

const privateReverse = JSON.parse(JSON.stringify(draft));
privateReverse.customerType = "private";
privateReverse.taxMode = "reverse_charge";
privateReverse.reverseChargeConfirmed = true;
assert.ok(Core.validateStep(privateReverse, profile, 3).some((entry) => /fizično osebo/.test(entry)));

const publicWithoutLeitweg = JSON.parse(JSON.stringify(draft));
publicWithoutLeitweg.customerType = "public";
publicWithoutLeitweg.leitwegId = "";
assert.ok(Core.validateStep(publicWithoutLeitweg, profile, 1).some((entry) => /Leitweg-ID/.test(entry)));

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
const xml = Core.buildXRechnungXml(invoice, profile);
assert.match(xml, /xrechnung_3\.0/);
assert.match(xml, /<cbc:InvoiceTypeCode>380<\/cbc:InvoiceTypeCode>/);
assert.match(xml, /<cbc:PayableAmount currencyID="EUR">119\.00<\/cbc:PayableAmount>/);
assert.match(xml, /Muster Handwerk GmbH/);

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
assert.strictEqual(replacementDraft.issueDate, new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
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
assert.ok(finapiAccountMigrationName, "Manjka migracija za izvorni finAPI račun.");
assert.match(finapiAccountMigration, /add column source_account_id text/i);
assert.match(finapiAccountMigration, /add column source_account_name text/i);
assert.match(finapiAccountMigration, /add column source_account_iban text/i);
assert.match(finapiAccountMigration, /on conflict \(user_id,source_key\) do nothing/i);
assert.match(finapiAccountMigration, /update public\.pos_bank_transactions[\s\S]*source_account_id/i);
assert.match(finapiApi, /preveriUporabnika\(req, cfg\)/);
assert.match(finapiApi, /syncDemoTransactions\(auth\.user\.id\)/);
assert.match(finapiApi, /createDemoBankWebForm\(auth\.user\.id\)/);
assert.doesNotMatch(finapiApi, /FINAPI_CLIENT_SECRET/);
assert.match(finapiLib, /https:\/\/sandbox\.finapi\.io\/api\/v2/);
assert.match(finapiLib, /https:\/\/webform-sandbox\.finapi\.io/);
assert.match(finapiLib, /createHmac\("sha256"/);
assert.match(finapiLib, /\/api\/webForms\/bankConnectionImport/);
assert.doesNotMatch(finapiLib, /requestJson\(cfg, "\/bankConnections\/import"/);
assert.match(finapiLib, /Do NOT route multiple application users|one end user/i);

testFetchAllRows().then(function () {
  console.log("POS terminal: nemška logika, celotna zgodovina, dostavni predal, Supabase RLS in mobilna geometrija so preverjeni.");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
