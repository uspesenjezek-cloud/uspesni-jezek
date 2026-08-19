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
const apiRoot = path.basename(__dirname).toLowerCase() === "scripts" ? path.join(repoRoot, "api") : path.join(repoRoot, "api");
const pdfApi = fs.existsSync(path.join(apiRoot, "pos-racun-pdf.js")) ? fs.readFileSync(path.join(apiRoot, "pos-racun-pdf.js"), "utf8") : "";
const xrechnungApi = fs.existsSync(path.join(apiRoot, "pos-racun-xrechnung.js")) ? fs.readFileSync(path.join(apiRoot, "pos-racun-xrechnung.js"), "utf8") : "";
const deliveryApi = fs.existsSync(path.join(apiRoot, "pos-dostava-sandbox.js")) ? fs.readFileSync(path.join(apiRoot, "pos-dostava-sandbox.js"), "utf8") : "";
const deliveryWorkerApi = fs.existsSync(path.join(apiRoot, "_lib", "pos-delivery-worker.js")) ? fs.readFileSync(path.join(apiRoot, "_lib", "pos-delivery-worker.js"), "utf8") : "";
const deliveryEmailApi = fs.existsSync(path.join(apiRoot, "_handlers", "pos-dostava-email.js")) ? fs.readFileSync(path.join(apiRoot, "_handlers", "pos-dostava-email.js"), "utf8") : "";
const adjustmentPdfApi = fs.existsSync(path.join(apiRoot, "pos-racun-korekcija.js")) ? fs.readFileSync(path.join(apiRoot, "pos-racun-korekcija.js"), "utf8") : "";
const Core = require(path.join(assetRoot, "pos-terminal.js"));

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
assert.match(html, /data-detail-einvoice/);
assert.match(html, /data-structured-buyer-reference/);
assert.match(html, /name="previousYearTurnoverBand"/);
assert.match(html, /data-replacement-title data-fit-text data-fit-max="12"/);
assert.match(js, /rpcName = replacement \? "pos_issue_replacement_invoice" : "pos_issue_invoice"/);
assert.match(js, /\.rpc\(rpcName, rpcPayload\)/);
assert.match(js, /\.from\("pos_business_profiles"\)/);
assert.match(js, /typeof supabaseKlient !== "undefined" && supabaseKlient && supabaseKlient\.auth/);
assert.doesNotMatch(js, /global\.supabaseKlient/);
assert.match(js, /displayProfile = profileForPreview\(profile, invoice\.isTest\)/);
assert.match(js, /state\.invoices = mergeInvoiceSources\(serverInvoices, localTests\)/);
assert.match(js, /\.from\("pos_invoice_drafts"\)/);
assert.match(js, /\.from\("pos_payments"\)/);
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

assert.strictEqual(Core.parseMoneyToCents("1.234,56 €"), 123456);
assert.strictEqual(Core.parseQuantityMilli("1,25"), 1250);

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
const differentLocalTest = { id: "local-different", number: "TEST-2026-0001", isTest: true, serverStored: false, draft: JSON.parse(JSON.stringify(duplicateDraft)), totals: duplicateTotals };
differentLocalTest.draft.items[0].description = "Druga testna storitev";
assert.deepStrictEqual(Core.mergeInvoiceSources([serverTestInvoice], [localDuplicate, differentLocalTest]).map((invoice) => invoice.id), ["server-test", "local-different"]);

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
const business2027Unknown = Core.deliveryRecommendation({ draft: Object.assign({}, draft, { issueDate: "2027-04-01" }) }, profile);
assert.strictEqual(business2027Unknown.pdfAllowed, false);
assert.strictEqual(business2027Unknown.needsTurnoverDecision, true);
profile.previousYearTurnoverBand = "gt_800k";
const business2027Large = Core.deliveryRecommendation({ draft: Object.assign({}, draft, { issueDate: "2027-04-01" }) }, profile);
assert.strictEqual(business2027Large.structuredRequired, true);
const publicDelivery = Core.deliveryRecommendation({ draft: Object.assign({}, draft, { customerType: "public" }) }, profile);
assert.deepStrictEqual({ channel: publicDelivery.channel, format: publicDelivery.documentFormat }, { channel: "ozg_re", format: "xrechnung" });

const dbProfile = Core.profileToDatabase(profile, "11111111-1111-4111-8111-111111111111");
assert.strictEqual(dbProfile.legal_name, "Muster Handwerk GmbH");
assert.strictEqual(dbProfile.user_id, "11111111-1111-4111-8111-111111111111");
assert.strictEqual(dbProfile.previous_year_turnover_band, "gt_800k");
assert.strictEqual(dbProfile.business_phone, "+49 30 1234567");
const dbDraft = Core.draftToDatabasePayload(draft);
assert.strictEqual(dbDraft.items[0].unit_price_cents, 10000);
assert.strictEqual(dbDraft.items[0].quantity_milli, 1000);
assert.strictEqual(dbDraft.items[0].tax_rate_bps, 1900);
const restoredDraft = Core.draftFromDatabasePayload(dbDraft);
assert.strictEqual(restoredDraft.customerName, draft.customerName);
assert.strictEqual(restoredDraft.items[0].unitPrice, "100,00");
assert.strictEqual(restoredDraft.finalConfirmed, false, "Obnovljen osnutek mora zahtevati nov končni pregled.");
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

console.log("POS terminal: nemška logika, dostavni predal, Supabase RLS in mobilna geometrija so preverjeni.");
