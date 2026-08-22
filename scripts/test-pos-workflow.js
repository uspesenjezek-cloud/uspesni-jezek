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
const sellerLockConsistencyMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_offer_seller_lock_consistency\.sql$/.test(name)).sort().pop();
assert.ok(sellerLockConsistencyMigrationName, "Manjka usklajen zaklep pravnih podatkov ponudbe.");
const sellerLockConsistencyMigration = fs.readFileSync(path.join(root, "supabase", "migrations", sellerLockConsistencyMigrationName), "utf8");
const Core = require(path.join(root, "app", "pos-terminal.js"));

assert.match(html, /data-new-offer/);
assert.match(html, /data-view="work-orders"/);
assert.match(html, /data-work-order-list/);
assert.match(html, /data-offer-validity/);
assert.match(html, /data-customer-step-title/);
assert.match(html, /data-issue-date-label/);
assert.match(html, /data-service-date-label/);
assert.match(html, /data-final-confirm-title/);
assert.match(html, /pos-terminal\.js\?v=20260822-withdrawal-settlement-v28/);
assert.match(html, /data-consumer-contract/);
assert.match(html, /name="consumerContractContext"[\s\S]*value="distance"[\s\S]*value="off_premises"[\s\S]*value="urgent_repair"/);
assert.match(html, /name="urgentRepairScope"[\s\S]*maxlength="500"/);
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
assert.match(sellerLockConsistencyMigration, /new\.payload := jsonb_set\(new\.payload, '\{seller\}', v_seller, true\)/i);
assert.match(sellerLockConsistencyMigration, /new\.locked_payload := new\.payload/i);
assert.match(sellerLockConsistencyMigration, /not v_profile\.legal_confirmed/i);

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
assert.equal(payload.consumer_contract_context, "not_applicable");

const consumerOfferDraft = Core.defaultDraft(profile);
consumerOfferDraft.workflowMode = "offer";
consumerOfferDraft.customerName = "Max Mustermann";
consumerOfferDraft.customerStreet = "Musterstraße 2";
consumerOfferDraft.customerPostalCode = "10115";
consumerOfferDraft.customerCity = "Berlin";
consumerOfferDraft.projectName = "Reparatur";
consumerOfferDraft.consumerContractContext = "distance";
consumerOfferDraft.items = [{ id: "item-c", description: "Reparatur", category: "labour", quantity: "1", unit: "Std.", unitPrice: "100,00", taxRate: "19" }];
assert.equal(Core.validateStep(consumerOfferDraft, profile, 1).filter((entry) => /Pogodba|sklenjena|način/i.test(entry)).length, 0);
consumerOfferDraft.consumerContractContext = "unknown";
assert.ok(Core.validateStep(consumerOfferDraft, profile, 1).some((entry) => /sklenjena potrošniška pogodba/.test(entry)));
consumerOfferDraft.consumerContractContext = "urgent_repair";
assert.ok(Core.validateStep(consumerOfferDraft, profile, 1).some((entry) => /nujno popravilo/.test(entry)));
consumerOfferDraft.urgentRepairScope = "Zaustavitev aktivnega iztekanja in zamenjava nujnega ventila";
assert.equal(Core.validateStep(consumerOfferDraft, profile, 1).filter((entry) => /nujno popravilo/.test(entry)).length, 0);

const order = Core.workOrderFromServer({
  id: "11111111-1111-4111-8111-111111111111", offer_number: "ANG-2026-0001", order_number: "AUF-2026-0001",
  status: "in_progress", title: offerDraft.projectName, customer_name: offerDraft.customerName,
  customer_email: "kunde@example.de", valid_until: payload.valid_until, net_cents: 100000,
  tax_cents: 19000, gross_cents: 119000, payload, locked_payload: payload, updated_at: "2026-08-21T12:00:00Z"
}, []);
assert.deepEqual(Core.workOrderActions("draft"), ["edit", "offer", "cancel"]);
assert.deepEqual(Core.workOrderActions("offered"), ["pdf", "accept", "cancel"]);
assert.deepEqual(Core.workOrderActions("accepted"), ["pdf", "start", "progress"]);
assert.deepEqual(Core.workOrderActions("in_progress"), ["pdf", "complete", "progress"]);
assert.deepEqual(Core.workOrderActions("completed"), ["pdf", "final", "progress"]);
assert.deepEqual(Core.workOrderActions("invoiced"), ["pdf"]);
assert.deepEqual(Core.workOrderActions({ status: "cancelled", offeredAt: "2026-08-22T10:00:00Z" }), ["pdf"]);
assert.deepEqual(Core.workOrderActions("withdrawn"), ["pdf"]);

const earlyOrder = Object.assign({}, order, {
  status: "accepted",
  acceptedAt: "2026-08-22T10:00:00.000Z",
  acceptedOn: "2026-08-22",
  lockedPayload: Object.assign({}, payload, { customer_type: "private", consumer_contract_context: "distance" })
});
assert.equal(Core.requiresContractConfirmation(earlyOrder), true);
assert.deepEqual(Core.workOrderActions(earlyOrder), ["pdf", "contract_pdf", "contract_delivery", "start", "progress", "withdraw"]);
assert.deepEqual(Core.workOrderActions(Object.assign({}, earlyOrder, { status: "in_progress" })), ["pdf", "contract_pdf", "contract_delivery", "complete", "progress", "withdraw"]);
assert.deepEqual(Core.workOrderActions(Object.assign({}, earlyOrder, { contractConfirmationDeliveryEvidence: "E-pošta s PDF" })), ["pdf", "contract_pdf", "start", "progress", "withdraw"]);
const completedConsumerWithoutExpiryProof = Object.assign({}, earlyOrder, {
  status: "completed",
  completedAt: "2026-08-22T12:00:00.000Z",
  contractConfirmationDeliveryEvidence: "E-pošta s PDF"
});
assert.equal(Core.consumerServiceRightExpired(completedConsumerWithoutExpiryProof), false);
assert.equal(Core.consumerWithdrawalAvailable(completedConsumerWithoutExpiryProof, "2026-08-25T12:00:00.000Z"), true);
assert.deepEqual(Core.workOrderActions(completedConsumerWithoutExpiryProof), ["pdf", "contract_pdf", "final", "progress", "withdraw"]);
const completedConsumerWithExpiryProof = Object.assign({}, completedConsumerWithoutExpiryProof, {
  valueCompensationInformed: true,
  rightExpiryAcknowledged: true
});
assert.equal(Core.consumerServiceRightExpired(completedConsumerWithExpiryProof), true);
assert.equal(Core.consumerWithdrawalAvailable(completedConsumerWithExpiryProof, "2026-08-25T12:00:00.000Z"), false);
assert.deepEqual(Core.workOrderActions(completedConsumerWithExpiryProof), ["pdf", "contract_pdf", "final", "progress"]);
assert.equal(Core.requiresEarlyStartEvidence(earlyOrder, "2026-08-30T10:00:00.000Z"), true);
assert.equal(Core.requiresEarlyStartEvidence(earlyOrder, "2026-09-05T21:59:59.000Z"), true);
assert.equal(Core.requiresEarlyStartEvidence(earlyOrder, "2026-09-05T22:00:00.000Z"), false);
earlyOrder.lockedPayload.consumer_contract_context = "urgent_repair";
assert.equal(Core.requiresEarlyStartEvidence(earlyOrder, "2026-09-30T10:00:00.000Z"), true);
earlyOrder.lockedPayload.customer_type = "business";
assert.equal(Core.requiresEarlyStartEvidence(earlyOrder, "2026-08-22T10:01:00.000Z"), false);

const withdrawnConsumerOrder = {
  status: "withdrawn",
  acceptedOn: "2026-08-22",
  lockedPayload: { customer_type: "private", consumer_contract_context: "distance" },
  contractConfirmationDeliveryEvidence: "E-pošta s PDF",
  withdrawalRefundRecords: []
};
assert.deepEqual(Core.workOrderActions(withdrawnConsumerOrder), ["pdf", "contract_pdf", "withdrawal_settlement"]);
assert.deepEqual(Core.workOrderActions(Object.assign({}, withdrawnConsumerOrder, {
  withdrawalSettlementId: "settlement-1", withdrawalRefundDueCents: 7000
})), ["pdf", "contract_pdf", "withdrawal_refund"]);
assert.deepEqual(Core.workOrderActions(Object.assign({}, withdrawnConsumerOrder, {
  withdrawalSettlementId: "settlement-1", withdrawalRefundDueCents: 7000,
  withdrawalRefundRecords: [{ amount_cents: 3000 }, { amount_cents: 4000 }]
})), ["pdf", "contract_pdf"]);

const acceptanceMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_offer_acceptance_evidence\.sql$/.test(name)).sort().pop();
assert.ok(acceptanceMigrationName, "Manjka migracija za dokaz sprejema ponudbe.");
const acceptanceMigration = fs.readFileSync(path.join(root, "supabase", "migrations", acceptanceMigrationName), "utf8");
assert.match(acceptanceMigration, /create table public\.pos_work_order_acceptances/i);
assert.match(acceptanceMigration, /foreign key \(offer_document_id, user_id\)[\s\S]*references public\.pos_offer_documents\(id, user_id\)/i);
assert.match(acceptanceMigration, /pos_work_order_acceptances_immutable[\s\S]*before update or delete/i);
assert.match(acceptanceMigration, /pos_work_order_events_immutable[\s\S]*before update or delete/i);
assert.match(acceptanceMigration, /pos_work_orders_require_acceptance_evidence[\s\S]*before update of status/i);
assert.match(acceptanceMigration, /create or replace function public\.pos_accept_work_order/i);
assert.match(js, /rpc\("pos_accept_work_order", \{[\s\S]*p_work_order_id: order\.id,[\s\S]*p_evidence:[\s\S]*p_accepted_on: acceptedOn/);
assert.match(js, /label: "Dokaz sprejema"[\s\S]*maxLength: 500/);
const acceptanceDateMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_offer_acceptance_effective_date\.sql$/.test(name)).sort().pop();
assert.ok(acceptanceDateMigrationName, "Manjka dejanski datum sprejema pogodbe.");
const acceptanceDateMigration = fs.readFileSync(path.join(root, "supabase", "migrations", acceptanceDateMigrationName), "utf8");
assert.match(acceptanceDateMigration, /add column accepted_on date/i);
assert.match(acceptanceDateMigration, /_pos_accept_work_order\([\s\S]*p_accepted_on date/i);
assert.match(acceptanceDateMigration, /pos_consumer_early_start_requires_evidence\([\s\S]*p_accepted_on date/i);
assert.match(acceptanceDateMigration, /create or replace function public\.pos_accept_work_order\([\s\S]*p_accepted_on date/i);
assert.match(acceptanceDateMigration, /create or replace function public\.pos_accept_work_order\([\s\S]*p_evidence text\s*\)/i, "Stari RPC mora ostati združljiv.");

const cancellationMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_offer_cancellation_evidence\.sql$/.test(name)).sort().pop();
assert.ok(cancellationMigrationName, "Manjka migracija za dokaz preklica ponudbe.");
const cancellationMigration = fs.readFileSync(path.join(root, "supabase", "migrations", cancellationMigrationName), "utf8");
assert.match(cancellationMigration, /create table public\.pos_work_order_cancellations/i);
assert.match(cancellationMigration, /status_before text not null check \(status_before in \('draft', 'offered'\)\)/i);
assert.match(cancellationMigration, /pos_work_order_cancellations_immutable[\s\S]*before update or delete/i);
assert.match(cancellationMigration, /pos_work_orders_require_cancellation_evidence[\s\S]*before update of status/i);
assert.match(cancellationMigration, /create or replace function public\.pos_cancel_work_order/i);
assert.match(js, /rpc\("pos_cancel_work_order", \{ p_work_order_id: order\.id, p_reason:/);
assert.match(js, /label: "Razlog preklica"[\s\S]*maxLength: 500/);

const consumerMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_consumer_withdrawal_evidence\.sql$/.test(name)).sort().pop();
assert.ok(consumerMigrationName, "Manjka zaščita potrošniškega odstopa in predčasnega začetka.");
const consumerMigration = fs.readFileSync(path.join(root, "supabase", "migrations", consumerMigrationName), "utf8");
assert.match(consumerMigration, /consumer_contract_context[\s\S]*business_premises[\s\S]*distance[\s\S]*off_premises[\s\S]*urgent_repair/i);
assert.match(consumerMigration, /create table public\.pos_work_order_early_start_evidence/i);
assert.match(consumerMigration, /pos_work_order_early_start_immutable[\s\S]*before update or delete/i);
assert.match(consumerMigration, /pos_work_orders_require_consumer_early_start_evidence[\s\S]*before update of status/i);
assert.match(consumerMigration, /old\.accepted_at \+ interval '14 days'/i);
assert.match(consumerMigration, /create or replace function public\.pos_start_work_order/i);
assert.match(consumerMigration, /foreign key \(offer_document_id, user_id\)[\s\S]*references public\.pos_offer_documents\(id, user_id\)/i);
assert.match(js, /rpc\("pos_start_work_order", \{[\s\S]*p_work_order_id: order\.id,[\s\S]*p_evidence:[\s\S]*p_value_compensation_informed:/);
assert.match(js, /label: "Dokaz zahteve za predčasni začetek"[\s\S]*maxLength: 500/);
const consumerIndexMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_consumer_withdrawal_evidence_indexes\.sql$/.test(name)).sort().pop();
assert.ok(consumerIndexMigrationName, "Manjkajo indeksi dokazov predčasnega začetka.");
const consumerIndexMigration = fs.readFileSync(path.join(root, "supabase", "migrations", consumerIndexMigrationName), "utf8");
assert.match(consumerIndexMigration, /\(work_order_id, user_id\)/i);
assert.match(consumerIndexMigration, /\(offer_document_id, user_id\)/i);
const consumerLegacyMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_consumer_legacy_transition_guard\.sql$/.test(name)).sort().pop();
assert.ok(consumerLegacyMigrationName, "Manjka zaščita starejših B2C ponudb brez pogodbenega konteksta.");
const consumerLegacyMigration = fs.readFileSync(path.join(root, "supabase", "migrations", consumerLegacyMigrationName), "utf8");
assert.match(consumerLegacyMigration, /new\.status in \('offered', 'accepted', 'in_progress'\)/i);
assert.match(consumerLegacyMigration, /consumer_contract_context[\s\S]*business_premises[\s\S]*distance[\s\S]*off_premises[\s\S]*urgent_repair/i);
assert.match(consumerLegacyMigration, /pos_work_orders_validate_consumer_contract_context[\s\S]*before update of status/i);
const consumerPeriodMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_consumer_withdrawal_period_boundary\.sql$/.test(name)).sort().pop();
assert.ok(consumerPeriodMigrationName, "Manjka pravilna meja 14-dnevnega potrošniškega roka.");
const consumerPeriodMigration = fs.readFileSync(path.join(root, "supabase", "migrations", consumerPeriodMigrationName), "utf8");
assert.match(consumerPeriodMigration, /at time zone 'Europe\/Berlin'\)::date[\s\S]*<= [\s\S]*::date \+ 14/i);
assert.match(consumerPeriodMigration, /private\.pos_consumer_early_start_requires_evidence[\s\S]*private\._pos_start_work_order/i);

const withdrawalMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_consumer_withdrawal_notices\.sql$/.test(name)).sort().pop();
assert.ok(withdrawalMigrationName, "Manjka ločen postopek potrošnikovega odstopa.");
const withdrawalMigration = fs.readFileSync(path.join(root, "supabase", "migrations", withdrawalMigrationName), "utf8");
assert.match(withdrawalMigration, /create table public\.pos_work_order_withdrawals/i);
assert.match(withdrawalMigration, /status_before text not null check \(status_before in \('accepted', 'in_progress'\)\)/i);
assert.match(withdrawalMigration, /pos_work_order_withdrawals_immutable[\s\S]*before update or delete/i);
assert.match(withdrawalMigration, /pos_work_orders_require_consumer_withdrawal_evidence[\s\S]*before update of status/i);
assert.match(withdrawalMigration, /p_declared_on > v_deadline/i);
assert.match(withdrawalMigration, /automatic_refund_performed', false/i);
assert.match(withdrawalMigration, /create or replace function public\.pos_record_consumer_withdrawal/i);
assert.match(js, /rpc\("pos_record_consumer_withdrawal", \{[\s\S]*p_declared_on: declaredOn[\s\S]*p_evidence:/);
assert.match(js, /Obstoječi računi, plačila in morebitni Wertersatz se ne spremenijo samodejno/i);

const confirmationMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_consumer_contract_confirmation\.sql$/.test(name)).sort().pop();
assert.ok(confirmationMigrationName, "Manjka dokazljivo potrdilo potrošniške pogodbe na trajnem nosilcu.");
const confirmationMigration = fs.readFileSync(path.join(root, "supabase", "migrations", confirmationMigrationName), "utf8");
assert.match(confirmationMigration, /create table public\.pos_contract_confirmation_documents/i);
assert.match(confirmationMigration, /create table public\.pos_contract_confirmation_deliveries/i);
assert.match(confirmationMigration, /pos_contract_confirmation_documents_immutable[\s\S]*before update or delete/i);
assert.match(confirmationMigration, /pos_contract_confirmation_deliveries_immutable[\s\S]*before update or delete/i);
assert.match(confirmationMigration, /pos_work_orders_require_contract_confirmation_delivery[\s\S]*before update of status/i);
assert.match(confirmationMigration, /delivery\.delivered_on[\s\S]*<= \(new\.started_at at time zone 'Europe\/Berlin'\)::date/i);
assert.match(confirmationMigration, /v_channel = 'electronic'[\s\S]*v_context in \('off_premises', 'urgent_repair'\)[\s\S]*v_consent/i);
assert.match(confirmationMigration, /create or replace function public\.pos_record_contract_confirmation_delivery/i);
assert.match(confirmationMigration, /revoke all on table public\.pos_contract_confirmation_documents from public, anon, authenticated/i);
assert.match(confirmationMigration, /revoke all on table public\.pos_contract_confirmation_deliveries from public, anon, authenticated/i);
assert.match(html, /data-dialog-select/);
assert.match(js, /function requiresContractConfirmation\(order\)/);
assert.match(js, /function recordContractConfirmationDelivery\(order\)/);
assert.match(js, /rpc\("pos_record_contract_confirmation_delivery", \{[\s\S]*p_channel: channel[\s\S]*p_delivered_on: deliveredOn/);
assert.match(js, /Pred začetkom dela zabeležite izročitev pogodbenega potrdila potrošniku/);

const completionWithdrawalMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_consumer_service_completion_withdrawal\.sql$/.test(name)).sort().pop();
assert.ok(completionWithdrawalMigrationName, "Manjka pravilna obravnava odstopa po popolni izvedbi storitve.");
const completionWithdrawalMigration = fs.readFileSync(path.join(root, "supabase", "migrations", completionWithdrawalMigrationName), "utf8");
assert.match(completionWithdrawalMigration, /add column value_compensation_informed boolean not null default false/i);
assert.match(completionWithdrawalMigration, /add column right_expiry_acknowledged boolean not null default false/i);
assert.match(completionWithdrawalMigration, /add column request_on_durable_medium boolean not null default false/i);
assert.match(completionWithdrawalMigration, /create or replace function public\.pos_start_work_order\([\s\S]*p_value_compensation_informed boolean[\s\S]*p_right_expiry_acknowledged boolean/i);
assert.match(completionWithdrawalMigration, /create or replace function private\.pos_consumer_service_right_expired/i);
assert.match(completionWithdrawalMigration, /status_before in \('accepted', 'in_progress', 'completed', 'invoiced'\)/i);
assert.match(completionWithdrawalMigration, /v_order\.status in \('completed', 'invoiced'\) and private\.pos_consumer_service_right_expired/i);
assert.match(completionWithdrawalMigration, /when 'withdrawn' then accepted_at is not null and cancelled_at is null and withdrawn_at is not null/i);
assert.match(js, /Potrdite vsebino izjave[\s\S]*Wertersatz[\s\S]*pravica do odstopa po popolni izvedbi preneha/i);

const settlementMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_consumer_withdrawal_settlement\.sql$/.test(name)).sort().pop();
assert.ok(settlementMigrationName, "Manjka nespremenljiv denarni pregled po potrošnikovem odstopu.");
const settlementMigration = fs.readFileSync(path.join(root, "supabase", "migrations", settlementMigrationName), "utf8");
const originalMethodMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_consumer_withdrawal_original_method_guard\.sql$/.test(name)).sort().pop();
assert.ok(originalMethodMigrationName, "Manjka strežniška zaščita prvotnega načina vračila.");
const originalMethodMigration = fs.readFileSync(path.join(root, "supabase", "migrations", originalMethodMigrationName), "utf8");
assert.match(settlementMigration, /create table public\.pos_consumer_withdrawal_settlements/i);
assert.match(settlementMigration, /create table public\.pos_consumer_withdrawal_refund_records/i);
assert.match(settlementMigration, /pos_consumer_withdrawal_settlements_immutable[\s\S]*before update or delete/i);
assert.match(settlementMigration, /pos_consumer_withdrawal_refund_records_immutable[\s\S]*before update or delete/i);
assert.match(settlementMigration, /refund_due_cents = greatest\(retained_payment_cents - value_compensation_cents, 0\)/i);
assert.match(settlementMigration, /refund_method = 'agreed_alternative' and alternative_agreement_evidence is not null/i);
assert.match(settlementMigration, /payment\.status in \('succeeded','partially_refunded','refunded'\)/i);
assert.match(settlementMigration, /evidence\.value_compensation_informed[\s\S]*request_on_durable_medium/i);
assert.match(settlementMigration, /received_at at time zone 'Europe\/Berlin'\)::date \+ 14/i);
assert.match(settlementMigration, /p_executed_on < v_withdrawal_received_on/i);
assert.match(settlementMigration, /automatic_refund_performed',false/i);
assert.match(settlementMigration, /external_payment_triggered',false/i);
assert.match(originalMethodMigration, /v_settlement\.refund_method = 'original'[\s\S]*payment\.provider='stripe'[\s\S]*payment\.method='bank_transfer'[\s\S]*payment\.provider='finapi'/i);
assert.match(originalMethodMigration, /Dokaz vračila mora uporabiti enega od prvotnih načinov plačila/i);
assert.match(settlementMigration, /revoke all on table public\.pos_consumer_withdrawal_settlements from public, anon, authenticated/i);
assert.match(settlementMigration, /revoke all on table public\.pos_consumer_withdrawal_refund_records from public, anon, authenticated/i);
assert.match(js, /from\("pos_consumer_withdrawal_settlements"\)/);
assert.match(js, /from\("pos_consumer_withdrawal_refund_records"\)/);
assert.match(js, /function assessConsumerWithdrawalSettlement\(order\)/);
assert.match(js, /rpc\("pos_assess_consumer_withdrawal_settlement"/);
assert.match(js, /function recordConsumerWithdrawalRefund\(order\)/);
assert.match(js, /function originalRefundProvider\(order\)/);
assert.match(js, /rpc\("pos_record_consumer_withdrawal_refund"/);
assert.match(js, /Ta postopek ne sproži Stripe, banke ali nakazila/i);
assert.match(js, /Zakonski rok:[\s\S]*Vračilo ni bilo samodejno izvedeno/i);

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
