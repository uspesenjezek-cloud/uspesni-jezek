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
const Core = require(path.join(root, "app", "pos-terminal.js"));

assert.match(html, /data-new-offer/);
assert.match(html, /data-view="work-orders"/);
assert.match(html, /data-work-order-list/);
assert.match(html, /data-offer-validity/);
assert.match(html, /data-customer-step-title/);
assert.match(html, /data-issue-date-label/);
assert.match(html, /data-service-date-label/);
assert.match(html, /data-final-confirm-title/);
assert.match(html, /pos-terminal\.js\?v=20260821-handwerker-workflow-v2/);
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

console.log("POS Handwerker workflow tests passed.");
