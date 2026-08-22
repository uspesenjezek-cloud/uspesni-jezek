"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "pos-terminal.css"), "utf8");
const js = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");
const migrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_handwerker_workflow\.sql$/.test(name)).sort().pop();
assert.ok(migrationName, "Manjka migracija za Handwerker workflow.");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", migrationName), "utf8");
const indexMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /index_pos_workflow_and_datev_foreign_keys\.sql$/.test(name)).sort().pop();
assert.ok(indexMigrationName, "Manjka migracija indeksov za POS/DATEV tuje ključe.");
const indexMigration = fs.readFileSync(path.join(root, "supabase", "migrations", indexMigrationName), "utf8");
const deductionMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_final_invoice_deductions\.sql$/.test(name)).sort().pop();
assert.ok(deductionMigrationName, "Manjka migracija za odbitke v Schlussrechnung.");
const deductionMigration = fs.readFileSync(path.join(root, "supabase", "migrations", deductionMigrationName), "utf8");
const payloadLimitsMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_work_order_payload_limits\.sql$/.test(name)).sort().pop();
assert.ok(payloadLimitsMigrationName, "Manjka zaščita payload-a ponudbe in delovnega naloga.");
const payloadLimitsMigration = fs.readFileSync(path.join(root, "supabase", "migrations", payloadLimitsMigrationName), "utf8");
const complianceMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_work_order_party_tax_validation\.sql$/.test(name)).sort().pop();
assert.ok(complianceMigrationName, "Manjka strežniška preverba pogodbenih in davčnih podatkov ponudbe.");
const complianceMigration = fs.readFileSync(path.join(root, "supabase", "migrations", complianceMigrationName), "utf8");
const lifecycleMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_work_order_lifecycle_invariants\.sql$/.test(name)).sort().pop();
assert.ok(lifecycleMigrationName, "Manjkajo invariante življenjskega cikla ponudbe in naročila.");
const lifecycleMigration = fs.readFileSync(path.join(root, "supabase", "migrations", lifecycleMigrationName), "utf8");
const Core = require(path.join(root, "app", "pos-terminal.js"));

assert.match(html, /data-new-offer/);
assert.match(html, /data-view="work-orders"/);
assert.match(html, /data-work-order-list/);
assert.match(html, /data-offer-validity/);
assert.match(html, /data-customer-step-title/);
assert.match(html, /data-issue-date-label/);
assert.match(html, /data-service-date-label/);
assert.match(html, /data-final-confirm-title/);
assert.match(html, /pos-terminal\.js\?v=20260822-full-history-v8/);
assert.match(html, /pos-terminal\.css\?v=20260821-final-deductions-v1/);
assert.match(css, /\.pos-work-order__facts/);
assert.match(css, /@media \(max-width: 479px\)[\s\S]*\.pos-work-order__facts/);
assert.ok(js.includes('data-fit-text data-fit-max=\\"15\\"'), "Dinamični dolgi naslov mora uporabljati samodejno prilagajanje pisave.");

assert.match(migration, /create table public\.pos_work_orders/);
assert.match(migration, /create table public\.pos_work_order_events/);
assert.match(migration, /create table public\.pos_work_order_invoices/);
assert.match(migration, /alter table public\.pos_work_orders enable row level security/);
assert.match(migration, /revoke all on table public\.pos_work_orders[\s\S]*from public, anon, authenticated/);
assert.match(migration, /grant select on table public\.pos_work_orders[\s\S]*to authenticated/);
assert.match(migration, /\(select auth\.uid\(\)\) = user_id/);
assert.match(migration, /security definer[\s\S]*v_user uuid := \(select auth\.uid\(\)\)/);
assert.match(migration, /pos_invoices_link_work_order/);
assert.match(migration, /Schlussrechnung po Abschlägen zahteva prikaz in odbitek/);
assert.match(indexMigration, /pos_work_order_events_work_order_id_idx[\s\S]*pos_work_order_events \(work_order_id\)/);
assert.match(indexMigration, /pos_datev_document_transfers_archive_record_id_idx[\s\S]*pos_datev_document_transfers \(archive_record_id\)/);
assert.match(deductionMigration, /pos_prepare_work_order_final_invoice/);
assert.match(deductionMigration, /status in \('succeeded', 'partially_refunded'\)/);
assert.match(deductionMigration, /final_deductions/);
assert.match(deductionMigration, /new\.net_cents := v_service_net - v_deduction_net/);
assert.match(deductionMigration, /insert into public\.pos_work_order_invoices[\s\S]*net_cents,tax_cents,gross_cents/);
assert.match(deductionMigration, /adjustment_type = 'cancellation'/);
assert.match(deductionMigration, /v_progress\.is_test <> new\.is_test/);
assert.doesNotMatch(deductionMigration, /Schlussrechnung po Abschlägen zahteva prikaz in odbitek/);
assert.match(payloadLimitsMigration, /private\.pos_validate_invoice_payload\(p_payload\)/i);
assert.match(payloadLimitsMigration, /v_profile_tax_status = 'small_business'[\s\S]*v_tax_mode <> 'small_business'/i);
assert.match(payloadLimitsMigration, /v_profile_tax_status <> 'small_business'[\s\S]*v_tax_mode = 'small_business'/i);
assert.match(payloadLimitsMigration, /v_tax_mode = 'reverse_charge'[\s\S]*v_customer_type = 'private'/i);
assert.match(payloadLimitsMigration, /pos_work_orders_payload_size_check[\s\S]*validate constraint pos_work_orders_payload_size_check/i);
assert.match(payloadLimitsMigration, /pos_work_orders_locked_payload_size_check[\s\S]*validate constraint pos_work_orders_locked_payload_size_check/i);
assert.match(payloadLimitsMigration, /create or replace function private\._pos_save_work_order_validated[\s\S]*security definer/i);
assert.match(payloadLimitsMigration, /create or replace function public\.pos_save_work_order[\s\S]*security invoker[\s\S]*private\._pos_save_work_order_validated/i);
assert.match(payloadLimitsMigration, /revoke execute on function private\._pos_save_work_order\(uuid,jsonb\) from authenticated/i);
assert.match(complianceMigration, /private\.pos_validate_invoice_party_fields[\s\S]*seller_contact_phone/i);
assert.match(complianceMigration, /private\.pos_validate_invoice_payload/i);
assert.match(complianceMigration, /private\.pos_validate_invoice_tax_evidence/i);
assert.match(complianceMigration, /v_customer_type = 'public'[\s\S]*leitweg_id/i);
assert.match(complianceMigration, /v_tax_mode = 'reverse_charge'[\s\S]*reverse_charge_confirmed/i);
assert.match(complianceMigration, /revoke all on function private\.pos_validate_work_order_payload\(jsonb\)[\s\S]*from public, anon, authenticated/i);
assert.match(lifecycleMigration, /pos_work_orders_lifecycle_check/i);
assert.match(lifecycleMigration, /locked_payload is null or locked_payload = payload/i);
assert.match(lifecycleMigration, /\(order_number is null\) = \(accepted_at is null\)/i);
assert.match(lifecycleMigration, /accepted_at is null or accepted_at >= offered_at/i);
assert.match(lifecycleMigration, /when 'invoiced' then[\s\S]*completed_at is not null and cancelled_at is null/i);
assert.match(lifecycleMigration, /when 'cancelled' then[\s\S]*cancelled_at is not null/i);
assert.match(lifecycleMigration, /validate constraint pos_work_orders_lifecycle_check/i);

const profile = Core.defaultProfile();
profile.taxStatus = "regular";
const offerDraft = Core.defaultDraft(profile);
offerDraft.workflowMode = "offer";
offerDraft.customerType = "business";
offerDraft.customerName = "Sehr langer realistischer Auftraggebername Handwerksbetrieb München GmbH";
offerDraft.customerStreet = "Musterstraße 10";
offerDraft.customerPostalCode = "80331";
offerDraft.customerCity = "München";
offerDraft.projectName = "Komplette energetische Sanierung eines Mehrfamilienhauses";
offerDraft.issueDate = "2026-08-21";
offerDraft.offerValidDays = "30";
offerDraft.items = [{
  id: "item-1", description: "Montage und Inbetriebnahme der Heizungsanlage", category: "labour",
  quantity: "10", unit: "Std.", unitPrice: "100,00", taxRate: "19"
}];
const payload = Core.workOrderPayloadFromDraft(offerDraft);
assert.equal(payload.valid_until, "2026-09-20");
assert.equal(payload.items[0].unit_price_cents, 10000);

const order = Core.workOrderFromServer({
  id: "11111111-1111-4111-8111-111111111111", offer_number: "ANG-2026-0001", order_number: "AUF-2026-0001",
  status: "in_progress", title: offerDraft.projectName, customer_name: offerDraft.customerName,
  customer_email: "kunde@example.de", valid_until: payload.valid_until, net_cents: 100000,
  tax_cents: 19000, gross_cents: 119000, payload, locked_payload: payload, updated_at: "2026-08-21T12:00:00Z"
}, []);
assert.deepEqual(Core.workOrderActions("draft"), ["edit", "offer", "cancel"]);
assert.deepEqual(Core.workOrderActions("in_progress"), ["complete", "progress", "cancel"]);

const progress = Core.prepareWorkOrderInvoiceDraft(order, profile, "progress", 30);
assert.equal(progress.workflowContext.invoiceKind, "progress");
assert.equal(progress.workflowContext.progressPercent, 30);
assert.equal(progress.items[0].unitPrice, "30,00");
assert.match(progress.items[0].description, /^Abschlag 30 %/);
const serializedProgress = Core.draftToDatabasePayload(progress);
assert.equal(serializedProgress.workflow_context.work_order_id, order.id);
assert.equal(serializedProgress.workflow_context.progress_percent, 30);

assert.equal(Core.prepareWorkOrderInvoiceDraft(order, profile, "final", 0), null, "Schlussrechnung mora čakati zaključeno delo.");
order.status = "completed";
const finalDraft = Core.prepareWorkOrderInvoiceDraft(order, profile, "final", 0);
assert.equal(finalDraft.workflowContext.invoiceKind, "final");
assert.equal(finalDraft.items[0].unitPrice, "100,00");

order.invoiceLinks = [{
  invoice_id: "22222222-2222-4222-8222-222222222222", invoice_kind: "progress", progress_percent: 30,
  net_cents: 30000, tax_cents: 5700, gross_cents: 35700, paid_cents: 0,
  invoice_number: "RE-2026-0002", issue_date: "2026-08-21"
}];
assert.equal(Core.workOrderFinalState(order).blocked, true);
assert.equal(Core.prepareWorkOrderInvoiceDraft(order, profile, "final", 0), null, "Neplačan Abschlag mora blokirati Schlussrechnung.");
order.invoiceLinks[0].paid_cents = 35700;
const deductedFinal = Core.prepareWorkOrderInvoiceDraft(order, profile, "final", 0);
assert.equal(deductedFinal.workflowContext.finalDeductions.length, 1);
assert.equal(deductedFinal.workflowContext.finalDeductions[0].invoiceNumber, "RE-2026-0002");
const deductedTotals = Core.calculateTotals(deductedFinal);
assert.equal(deductedTotals.serviceGrossCents, 119000);
assert.equal(deductedTotals.deductionGrossCents, 35700);
assert.equal(deductedTotals.grossCents, 83300);
assert.equal(deductedTotals.netCents, 70000);
assert.equal(deductedTotals.taxCents, 13300);
const serializedFinal = Core.draftToDatabasePayload(deductedFinal);
assert.equal(serializedFinal.workflow_context.final_deductions[0].gross_cents, 35700);

const cancelledLink = Object.assign({}, order.invoiceLinks[0], {
  invoice: { id: order.invoiceLinks[0].invoice_id, status: "cancelled", isTest: true, totals: { netCents: 30000, taxCents: 5700, grossCents: 35700 }, paidCents: 0 }
});
order.invoiceLinks = [cancelledLink];
assert.equal(Core.workOrderFinalState(order, true).progressPercent, 0, "Stornirani Abschlag ne sme zmanjšati Schlussrechnung.");
assert.equal(Core.workOrderFinalState(order, true).blocked, false);
assert.match(js, /var used = workOrderFinalState\(order\)\.progressPercent;/, "Dialog za novi Abschlag mora uporabiti isti seštevek aktivnih delnih računov.");
assert.doesNotMatch(js, /var used = \(order\.invoiceLinks \|\| \[\]\)\.filter/, "Dialog ne sme ponovno šteti storniranih Abschlagsrechnungen.");

order.invoiceLinks = [Object.assign({}, cancelledLink, { invoice: Object.assign({}, cancelledLink.invoice, { status: "paid", isTest: false, paidCents: 35700 }) })];
assert.equal(Core.workOrderFinalState(order, true).blocked, true, "Testnega in pravnega računa ni dovoljeno mešati.");

console.log("POS Handwerker workflow tests passed.");
