"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821100924_pos_gobd_archive.sql"), "utf8");
const hardeningMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821101118_pos_archive_private_readiness.sql"), "utf8");
const wormMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821201129_pos_s3_object_lock_archive.sql"), "utf8");
const productionRecoveryMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821211930_pos_archive_production_recovery_evidence.sql"), "utf8");
const berlinRetentionMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260822024027_pos_archive_berlin_retention_year.sql"), "utf8");
const berlinSourceRetentionMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260822024311_pos_archive_source_berlin_retention.sql"), "utf8");
const completeSummaryMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821214057_pos_archive_complete_summary.sql"), "utf8");
const missingDocumentMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821220929_pos_archive_missing_document_repair.sql"), "utf8");
const userIntegrityMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821223224_pos_archive_user_integrity_batch.sql"), "utf8");
const integrityPriorityMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821223844_pos_archive_integrity_batch_priority.sql"), "utf8");
const retentionDeletionMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260822002843_pos_retention_safe_user_deletion.sql"), "utf8");
const readinessInvokerMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260823114723_pos_archive_readiness_invoker.sql"), "utf8");
const allOriginalsMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260823181907_pos_archive_all_originals.sql"), "utf8");
const sourceInvariantsMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260822010909_pos_archive_source_invariants.sql"), "utf8");
const adjustmentRepairMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_adjustment_xrechnung_archive_repair\.sql$/.test(name)).sort().pop();
assert.ok(adjustmentRepairMigrationName, "Manjka obnova strukturiranih popravkov v arhivu.");
const adjustmentRepairMigration = fs.readFileSync(path.join(root, "supabase", "migrations", adjustmentRepairMigrationName), "utf8");
const durableDocumentRecoveryMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_archive_durable_document_recovery\.sql$/.test(name)).sort().pop();
assert.ok(durableDocumentRecoveryMigrationName, "Manjka trajna obnova vseh zaklenjenih POS originalov.");
const durableDocumentRecoveryMigration = fs.readFileSync(path.join(root, "supabase", "migrations", durableDocumentRecoveryMigrationName), "utf8");
const primaryObjectRecoveryMigrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_archive_primary_object_recovery\.sql$/.test(name)).sort().pop();
assert.ok(primaryObjectRecoveryMigrationName, "Manjka varna WORM obnova primarnega arhivskega objekta.");
const primaryObjectRecoveryMigration = fs.readFileSync(path.join(root, "supabase", "migrations", primaryObjectRecoveryMigrationName), "utf8");
const primaryRecoveryBatchSql = primaryObjectRecoveryMigration.match(/create or replace function public\.pos_archive_primary_recovery_batch\([\s\S]*?\n\$\$;/i);
assert.ok(primaryRecoveryBatchSql, "Migracija nima zaključene batch funkcije primarne obnove.");
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
assert.match(html, /Arhivska veriga zajema 7 vrst izvirnikov/);
assert.match(html, /ponudbe, pogodbena potrdila ter Verfahrensdokumentation/);
const js = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const archive = require(path.join(root, "api", "_lib", "pos-archive"));
const worm = require(path.join(root, "api", "_lib", "pos-worm-archive"));
const handler = require(path.join(root, "api", "_handlers", "pos-arhiv"));
const archiveWorker = require(path.join(root, "api", "pos-arhiv-delavec"));
const terminal = require(path.join(root, "app", "pos-terminal"));
const handlerSource = fs.readFileSync(path.join(root, "api", "_handlers", "pos-arhiv.js"), "utf8");
assert.match(allOriginalsMigration, /add column is_test boolean not null default true/i);
assert.match(allOriginalsMigration, /source_table in \([\s\S]*pos_offer_documents[\s\S]*pos_contract_confirmation_documents[\s\S]*pos_procedure_document_versions/i);
assert.match(allOriginalsMigration, /pos_offer_documents_archive_manifest/);
assert.match(allOriginalsMigration, /pos_contract_confirmation_documents_archive_manifest/);
assert.match(allOriginalsMigration, /pos_procedure_document_versions_archive_manifest/);
assert.match(allOriginalsMigration, /record\.is_test[\s\S]*record\.source_table[\s\S]*record\.source_id/i);
assert.match(allOriginalsMigration, /where not record\.is_test and not exists/i);
assert.match(allOriginalsMigration, /auth\.jwt\(\)->>'role'/i);
assert.doesNotMatch(allOriginalsMigration, /join public\.pos_invoices invoice on invoice\.id=record\.invoice_id[\s\S]*record\.is_test/i);
assert.match(handlerSource, /work_order_id,procedure_version_id,source_table,source_id/);
assert.match(fs.readFileSync(path.join(root, "api", "_lib", "pos-worm-archive.js"), "utf8"), /source_table: String\(record\.source_table/);
assert.doesNotMatch(fs.readFileSync(path.join(root, "api", "_lib", "pos-worm-archive.js"), "utf8"), /invoice_id: String\(record\.invoice_id\)/);
const localServer = fs.readFileSync(path.join(root, "scripts", "local-server.js"), "utf8");

assert.strictEqual(archive.hash(Buffer.from("original")), "0682c5f2076f099c34cfdd15a9e063849ed437a49677e6fcc5b4198c76575be5");
assert.match(archive.readObject.toString(), /providerJson\.readBuffer/);
assert.doesNotMatch(archive.readObject.toString(), /arrayBuffer\(/);
assert.match(migration, /create table public\.pos_archive_records/i);
assert.match(migration, /create table public\.pos_archive_integrity_events/i);
assert.match(migration, /retention_years smallint not null default 8/i);
assert.match(migration, /make_date\([^\n]+ \+ 8, 12, 31\)/i);
assert.match(migration, /pos_archive_records_immutable[\s\S]*pos_archive_integrity_events_immutable[\s\S]*pos_audit_events_immutable/i);
assert.match(migration, /after insert on public\.pos_invoice_documents[\s\S]*after insert on public\.pos_einvoice_documents[\s\S]*after insert on public\.pos_adjustment_documents/i);
assert.match(migration, /pos_invoices_require_archive_for_live[\s\S]*private\.pos_require_archive_before_live_invoice/i);
assert.match(migration, /independent_backup_ready[\s\S]*recovery_tested_at/i);
assert.match(migration, /alter table public\.pos_archive_records enable row level security/i);
assert.match(migration, /revoke all on function public\.pos_archive_integrity_batch\(integer\) from public, anon, authenticated/i);
assert.doesNotMatch(migration, /delete from public\.pos_archive_records/i);
assert.match(hardeningMigration, /private\.pos_archive_readiness\(\)[\s\S]*security definer/i);
assert.match(hardeningMigration, /public\.pos_archive_readiness\(\)[\s\S]*security invoker/i);
assert.match(hardeningMigration, /revoke all on function private\.pos_archive_readiness\(\) from public, anon/i);
assert.match(readinessInvokerMigration, /create or replace function public\.pos_archive_readiness\(\)[\s\S]*security invoker/i);
assert.match(readinessInvokerMigration, /auth\.jwt\(\) ->> 'role' = 'service_role'/i);
assert.doesNotMatch(readinessInvokerMigration, /auth\.role\(\)/i);
assert.match(readinessInvokerMigration, /grant execute on function private\.pos_archive_readiness\(\) to authenticated, service_role/i);
assert.match(wormMigration, /create table public\.pos_archive_replicas/i);
assert.match(wormMigration, /create table public\.pos_archive_replica_events/i);
assert.match(wormMigration, /pos_archive_replica_events_immutable/i);
assert.match(wormMigration, /after insert on public\.pos_archive_records[\s\S]*private\.pos_archive_enqueue_replica/i);
assert.match(wormMigration, /for update skip locked/i);
assert.match(wormMigration, /worm_environment = 'production'[\s\S]*worm_object_lock_mode = 'COMPLIANCE'/i);
assert.match(wormMigration, /independent_backup_ready = false/i);
assert.doesNotMatch(wormMigration, /delete from public\.pos_archive_(?:records|replicas|replica_events)/i);
assert.match(productionRecoveryMigration, /worm_environment is distinct from p_environment/i);
assert.match(productionRecoveryMigration, /object_lock_mode = 'COMPLIANCE'/i);
assert.match(productionRecoveryMigration, /not invoice\.is_test/i);
assert.match(productionRecoveryMigration, /replica\.retain_until >= \(record\.retention_not_before::timestamptz \+ interval '1 day' - interval '1 millisecond'\)/i);
assert.match(berlinRetentionMigration, /extract\(year from \(a\.issued_at at time zone 'Europe\/Berlin'\)\)::integer/i);
assert.match(berlinRetentionMigration, /make_date\(v_issue_year \+ 8, 12, 31\)/i);
assert.doesNotMatch(berlinRetentionMigration, /extract\(year from a\.issued_at\)::integer/i);
assert.match(berlinSourceRetentionMigration, /extract\(year from \(adjustment\.issued_at at time zone 'Europe\/Berlin'\)\)::integer/i);
assert.match(berlinSourceRetentionMigration, /new\.retention_not_before[\s\S]*v_retention_not_before/i);
assert.doesNotMatch(berlinSourceRetentionMigration, /extract\(year from adjustment\.issued_at\)::integer/i);
assert.match(completeSummaryMigration, /create or replace function public\.pos_archive_user_summary\(p_user_id uuid\)/i);
assert.match(completeSummaryMigration, /security invoker/i);
assert.match(completeSummaryMigration, /count\(\*\) filter \(where integrity_result = 'verified'\)/i);
assert.match(completeSummaryMigration, /revoke all on function public\.pos_archive_user_summary\(uuid\)\s+from public, anon, authenticated/i);
assert.match(missingDocumentMigration, /create or replace function public\.pos_archive_missing_document_batch\(p_limit integer default 2\)/i);
assert.match(missingDocumentMigration, /not exists[\s\S]*public\.pos_invoice_documents/i);
assert.match(missingDocumentMigration, /not exists[\s\S]*public\.pos_adjustment_documents/i);
assert.match(missingDocumentMigration, /security invoker/i);
assert.match(missingDocumentMigration, /revoke all on function public\.pos_archive_missing_document_batch\(integer\)[\s\S]*from public, anon, authenticated/i);
assert.match(missingDocumentMigration, /grant execute on function public\.pos_archive_missing_document_batch\(integer\)[\s\S]*to service_role/i);
assert.match(userIntegrityMigration, /create or replace function public\.pos_archive_user_integrity_batch\([\s\S]*p_user_id uuid[\s\S]*p_limit integer default 10/i);
assert.match(userIntegrityMigration, /record\.user_id = p_user_id/i);
assert.match(userIntegrityMigration, /event\.result = 'verified'[\s\S]*event\.checked_at >= now\(\) - interval '90 days'/i);
assert.match(userIntegrityMigration, /limit least\(greatest\(coalesce\(p_limit, 10\), 1\), 25\)/i);
assert.match(userIntegrityMigration, /revoke all on function public\.pos_archive_user_integrity_batch\(uuid, integer\)[\s\S]*from public, anon, authenticated/i);
assert.match(userIntegrityMigration, /grant execute on function public\.pos_archive_user_integrity_batch\(uuid, integer\)[\s\S]*to service_role/i);
assert.strictEqual((userIntegrityMigration.match(/event\.result = 'verified'/gi) || []).length, 2);
assert.strictEqual((integrityPriorityMigration.match(/left join lateral/gi) || []).length, 2);
assert.strictEqual((integrityPriorityMigration.match(/when latest\.checked_at is null then 0/gi) || []).length, 2);
assert.strictEqual((integrityPriorityMigration.match(/when latest\.result <> 'verified' then 1/gi) || []).length, 2);
assert.strictEqual((integrityPriorityMigration.match(/latest\.checked_at < now\(\) - interval '90 days'/gi) || []).length, 2);
assert.match(integrityPriorityMigration, /security invoker/i);
assert.match(integrityPriorityMigration, /revoke all on function public\.pos_archive_user_integrity_batch\(uuid, integer\)[\s\S]*from public, anon, authenticated/i);
assert.match(retentionDeletionMigration, /create or replace function private\.pos_block_unsafe_auth_user_delete\(\)/i);
assert.match(retentionDeletionMigration, /from public\.pos_invoices[\s\S]*not invoice\.is_test/i);
assert.match(retentionDeletionMigration, /from public\.pos_archive_records/i);
assert.match(retentionDeletionMigration, /before delete on auth\.users/i);
assert.match(retentionDeletionMigration, /errcode = '23503'/i);
assert.match(retentionDeletionMigration, /revoke all on function private\.pos_block_unsafe_auth_user_delete\(\) from public, anon, authenticated/i);
assert.match(sourceInvariantsMigration, /pos_archive_records_source_shape_check/i);
assert.match(sourceInvariantsMigration, /source_table = 'pos_einvoice_documents'[\s\S]*storage_bucket = 'pos-einvoice-originals'[\s\S]*byte_size <= 2097152/i);
assert.match(sourceInvariantsMigration, /source_table = 'pos_adjustment_documents'[\s\S]*document_kind = 'adjustment_pdf'/i);
assert.match(sourceInvariantsMigration, /create trigger pos_archive_records_validate_source[\s\S]*before insert on public\.pos_archive_records/i);
assert.match(sourceInvariantsMigration, /new\.retention_basis <> 'UStG § 14b; AO § 147'/i);
assert.match(sourceInvariantsMigration, /new\.encryption_scope <> 'provider_managed_at_rest'/i);
assert.match(sourceInvariantsMigration, /revoke all on function private\.pos_validate_archive_record_source\(\) from public, anon, authenticated/i);
assert.match(sourceInvariantsMigration, /validate constraint pos_archive_records_source_shape_check/i);
assert.match(adjustmentRepairMigration, /'pos_invoice_adjustment_xrechnung'::text/i);
assert.match(adjustmentRepairMigration, /exists\(select 1 from public\.pos_einvoice_documents/i);
assert.match(adjustmentRepairMigration, /not exists\(select 1 from public\.pos_adjustment_einvoice_documents/i);
assert.match(durableDocumentRecoveryMigration, /'pos_work_order_offer'::text/i);
assert.match(durableDocumentRecoveryMigration, /'pos_work_order_contract_confirmation'::text/i);
assert.match(durableDocumentRecoveryMigration, /not exists \([\s\S]*public\.pos_offer_documents/i);
assert.match(durableDocumentRecoveryMigration, /not exists \([\s\S]*public\.pos_contract_confirmation_documents/i);
assert.match(durableDocumentRecoveryMigration, /create or replace function private\.pos_archive_production_ready\(\)/i);
assert.match(durableDocumentRecoveryMigration, /where not invoice\.is_test and not exists/i);
assert.match(durableDocumentRecoveryMigration, /where not work_order\.is_test[\s\S]*public\.pos_offer_documents/i);
assert.match(durableDocumentRecoveryMigration, /order by candidates\.priority, candidates\.created_at/i);
assert.match(durableDocumentRecoveryMigration, /case when invoice\.is_test then 1 else 0 end priority/i);
assert.match(durableDocumentRecoveryMigration, /where not invoice\.is_test[\s\S]*public\.pos_adjustment_einvoice_documents/i);
assert.match(primaryObjectRecoveryMigration, /create or replace function public\.pos_archive_primary_recovery_batch\([\s\S]*latest\.result = 'missing'/i);
assert.match(primaryObjectRecoveryMigration, /replica\.status = 'verified'[\s\S]*replica\.remote_checksum_sha256 = record\.sha256[\s\S]*replica\.remote_byte_size = record\.byte_size/i);
assert.match(primaryObjectRecoveryMigration, /nullif\(trim\(replica\.object_version_id\), ''\) is not null/i);
assert.match(primaryRecoveryBatchSql[0], /replica_last_attempt_at timestamptz,[\s\S]*replica_copied_at timestamptz/i);
assert.match(primaryRecoveryBatchSql[0], /replica\.retain_until,[\s\S]*replica\.last_attempt_at,[\s\S]*replica\.copied_at,[\s\S]*record\.id/i);
assert.match(primaryRecoveryBatchSql[0], /replica\.last_attempt_at is not null[\s\S]*replica\.copied_at is not null/i);
assert.match(primaryRecoveryBatchSql[0], /record\.is_test[\s\S]*replica\.object_lock_mode = 'COMPLIANCE'[\s\S]*record\.retention_not_before::timestamptz \+ interval '1 day' - interval '1 millisecond'/i);
assert.match(primaryObjectRecoveryMigration, /create or replace function public\.pos_archive_primary_recovery_complete\([\s\S]*p_missing_integrity_event_id uuid,[\s\S]*p_verified_integrity_event_id uuid/i);
assert.match(primaryObjectRecoveryMigration, /v_missing_event\.result <> 'missing'[\s\S]*v_verified_event\.checked_at <= v_missing_event\.checked_at[\s\S]*v_latest_event_id is distinct from v_verified_event\.id/i);
assert.match(primaryObjectRecoveryMigration, /'missingIntegrityEventId', v_missing_event\.id[\s\S]*'verifiedIntegrityEventId', v_verified_event\.id/i);
assert.match(primaryObjectRecoveryMigration, /event\.details ->> 'missingIntegrityEventId' = v_missing_event\.id::text[\s\S]*event\.details ->> 'verifiedIntegrityEventId' = v_verified_event\.id::text/i);
assert.match(primaryObjectRecoveryMigration, /create or replace function private\.pos_archive_production_ready\(\)[\s\S]*left join lateral[\s\S]*latest\.result is distinct from 'verified'[\s\S]*latest\.observed_sha256 is distinct from record\.sha256[\s\S]*latest\.observed_byte_size is distinct from record\.byte_size[\s\S]*latest\.checked_at < now\(\) - interval '90 days'[\s\S]*latest\.checked_at > now\(\) \+ interval '5 minutes'/i);
assert.match(primaryObjectRecoveryMigration, /revoke all on function public\.pos_archive_primary_recovery_complete\(uuid, uuid, uuid, text\)/i);
assert.match(primaryObjectRecoveryMigration, /security definer[\s\S]*set search_path = ''/i);
assert.match(primaryObjectRecoveryMigration, /revoke all on function public\.pos_archive_primary_recovery_batch\(integer\)[\s\S]*to service_role/i);
assert.match(fs.readFileSync(path.join(root, "api", "_handlers", "pos-arhiv-delavec.js"), "utf8"), /"x-upsert": "false"/);
assert.doesNotMatch(fs.readFileSync(path.join(root, "api", "_handlers", "pos-arhiv-delavec.js"), "utf8"), /"x-upsert": "true"/);

const summary = handler._test.publicSummary(
  { retentionYears: 8, productionReady: false, independentBackupReady: false },
  [
    { id: "a", invoice_id: "i", document_kind: "invoice_pdf", original_media_type: "application/pdf", archived_at: "2026-01-01", retention_not_before: "2034-12-31" },
    { id: "b", invoice_id: "i", document_kind: "xrechnung_ubl", original_media_type: "application/xml", archived_at: "2026-01-02", retention_not_before: "2034-12-31" }
  ],
  [{ archive_record_id: "a", result: "verified", checked_at: "2026-02-01" }],
  [{ archive_record_id: "a", status: "verified", object_lock_mode: "GOVERNANCE", retain_until: "2026-02-08", verified_at: "2026-02-01" }]
);
assert.strictEqual(summary.documentCount, 2);
assert.strictEqual(summary.verifiedCount, 1);
assert.strictEqual(summary.uncheckedCount, 1);
assert.strictEqual(summary.replicatedCount, 1);
assert.strictEqual(summary.replicaPendingCount, 1);
assert.strictEqual(summary.productionReady, false);
assert.strictEqual(summary.earliestRetentionNotBefore, "2034-12-31");

const completeSummary = handler._test.publicDatabaseSummary(
  { retentionYears: 8, productionReady: false, wormProviderReady: false },
  { documentCount: 1250, verifiedCount: 1249, uncheckedCount: 1, failureCount: 0, replicatedCount: 1200, replicaPendingCount: 50, replicaFailureCount: 0, earliestRetentionNotBefore: "2034-12-31" }
);
assert.strictEqual(completeSummary.documentCount, 1250);
assert.strictEqual(completeSummary.verifiedCount, 1249);
assert.strictEqual(completeSummary.replicaPendingCount, 50);
assert.deepStrictEqual(completeSummary.records, []);

const loadingView = terminal.archiveCapabilityView({ loaded: false, loading: false, independentBackupReady: false });
assert.strictEqual(loadingView.badgeText, "Preverjam");
assert.strictEqual(loadingView.integrityText, "—");
assert.strictEqual(loadingView.backupText, "preverjam");
assert.doesNotMatch(loadingView.copyText, /ni potrjena/i);

const readyView = terminal.archiveCapabilityView({ loaded: true, loading: false, documentCount: 10, verifiedCount: 10, uncheckedCount: 0, failureCount: 0, replicatedCount: 10, replicaPendingCount: 0, replicaFailureCount: 0, wormProviderReady: true, independentBackupReady: true, productionReady: true });
assert.strictEqual(readyView.badgeText, "Dvojno zaščiten");
assert.strictEqual(readyView.integrityText, "10 / 10 preverjenih");
assert.strictEqual(readyView.backupText, "AWS Object Lock: 10 / 10");

const unavailableView = terminal.archiveCapabilityView({ loaded: true, loading: false, error: "začasna napaka", independentBackupReady: true, productionReady: false });
assert.strictEqual(unavailableView.badgeText, "Ni dosegljivo");
assert.strictEqual(unavailableView.backupText, "ni dosegljivo");
assert.match(unavailableView.copyText, /varno zaklenjena/i);

assert.match(html, /GoBD arhiv/);
assert.match(html, /data-archive-verify/);
assert.match(html, /pos-terminal\.js\?v=20260830-cash-provider-recovery-v1/);
assert.match(js, /function productionReady\(\)[\s\S]*archiveCapability\.productionReady/);
assert.match(js, /function loadArchiveCapability\([\s\S]*await apiSessionToken\(\)/);
assert.match(js, /async function loadFullServerState\([\s\S]*renderHome\(\);\s*await loadArchiveCapability\(false, false\);/);
assert.doesNotMatch(js, /currentSessionToken/);
assert.match(handlerSource, /select=id,user_id,invoice_id/);
assert.match(handlerSource, /pos_archive_user_summary/);
assert.match(handlerSource, /pos_archive_user_integrity_batch/);
assert.match(handlerSource, /Cache-Control", "private, no-store, max-age=0"/);
assert.match(handlerSource, /requestJson\(req, MAX_BODY_BYTES\)/);
assert.doesNotMatch(handlerSource, /archived_at\.desc&limit=25/);
assert.match(html, /data-archive-verify>Preveri arhiv zdaj/);
assert.match(js, /Paket je preverjen; preostanek arhiva bo preverjen v naslednjih paketih/);
assert.doesNotMatch(handlerSource, /pos_archive_integrity_events[\s\S]*limit=500/);
assert.match(fs.readFileSync(path.join(root, "api", "_handlers", "pos-arhiv-delavec.js"), "utf8"), /Promise\.all\([\s\S]*archive\.verifyAndRecord/);
assert.match(js, /Produkcijska izdaja čaka potrjeno ločeno arhivsko kopijo/);
assert.ok(vercel.rewrites.some((entry) => entry.source === "/api/pos-arhiv"));
assert.match(localServer, /posArhivModul = require\.resolve\("\.\.\/api\/_handlers\/pos-arhiv"\)/);
assert.match(localServer, /pathname === "\/api\/pos-arhiv"[\s\S]*izvediLokalniApi\(req, res, posArhivModul\)/);
assert.ok(vercel.crons.some((entry) => entry.path === "/api/pos-arhiv-delavec" && entry.schedule === "23 4 * * *"));
assert.ok(vercel.rewrites.some((entry) => entry.source === "/api/pos-arhiv-delavec" && entry.destination === "/api/pos?handler=archive-worker"));

const testConfig = worm.configuration({
  POS_ARCHIVE_S3_REGION: "eu-central-1",
  POS_ARCHIVE_S3_BUCKET: "uj-pos-test-archive",
  POS_ARCHIVE_S3_ACCESS_KEY_ID: "test-access",
  POS_ARCHIVE_S3_SECRET_ACCESS_KEY: "test-secret",
  POS_ARCHIVE_S3_TEST_RETENTION_DAYS: "100"
});
assert.strictEqual(testConfig.configured, true);
assert.strictEqual(testConfig.testRetentionDays, 30);
assert.throws(function () {
  worm.configuration({ POS_ARCHIVE_S3_REGION: "us-east-1" });
}, /Frankfurt/);

const sampleRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  invoice_id: "33333333-3333-4333-8333-333333333333",
  original_media_type: "application/pdf",
  sha256: archive.hash(Buffer.from("original")),
  byte_size: Buffer.byteLength("original"),
  retention_not_before: "2034-12-31",
  is_test: true
};
assert.match(worm._test.objectKey(sampleRecord), /pos-originals\/[0-9a-f-]+\/[0-9a-f-]+\/[0-9a-f]{64}\.pdf/);
const testRetention = worm._test.retentionFor(sampleRecord, testConfig, new Date("2026-08-21T00:00:00Z"));
assert.strictEqual(testRetention.mode, "GOVERNANCE");
assert.strictEqual(testRetention.retainUntil.toISOString(), "2026-09-20T00:00:00.000Z");
assert.throws(function () {
  worm._test.retentionFor(Object.assign({}, sampleRecord, { is_test: false }), testConfig, new Date("2026-08-21T00:00:00Z"));
}, /izrecno omogočen/);

const liveConfig = Object.assign({}, testConfig, { liveEnabled: true });
const liveTestRetention = worm._test.retentionFor(sampleRecord, liveConfig, new Date("2026-08-21T00:00:00Z"));
assert.strictEqual(liveTestRetention.mode, "COMPLIANCE");
assert.strictEqual(liveTestRetention.retainUntil.toISOString(), "2026-09-20T00:00:00.000Z");
const liveRetention = worm._test.retentionFor(Object.assign({}, sampleRecord, { is_test: false }), liveConfig, new Date("2026-08-21T00:00:00Z"));
assert.strictEqual(liveRetention.mode, "COMPLIANCE");
assert.strictEqual(liveRetention.retainUntil.toISOString(), "2034-12-31T23:59:59.999Z");

function testRecoveryRetentionPolicy() {
  const now = new Date("2026-08-21T00:02:00.000Z");
  const base = Object.assign({}, sampleRecord, {
    replica_bucket: testConfig.bucket,
    replica_object_key: worm._test.objectKey(sampleRecord),
    replica_object_version_id: "version-policy-1",
    replica_object_lock_mode: "GOVERNANCE",
    replica_last_attempt_at: "2026-08-21T00:00:00.000Z",
    replica_copied_at: "2026-08-21T00:01:00.000Z",
    replica_retain_until: "2026-09-20T00:00:00.000Z"
  });
  assert.strictEqual(worm._test.recoveryIdentity(testConfig, base, now).mode, "GOVERNANCE");
  const unanchored = Object.assign({}, base, { replica_last_attempt_at: null, replica_copied_at: null });
  assert.throws(
    () => worm._test.recoveryIdentity(testConfig, unanchored, now),
    (error) => error && error.code === "AWS_RETENTION_INVALID"
  );
  assert.strictEqual(
    worm._test.recoveryIdentity(testConfig, unanchored, now, { allowUnanchoredTest: true }).mode,
    "GOVERNANCE"
  );
  assert.throws(
    () => worm._test.recoveryIdentity(testConfig, Object.assign({}, unanchored, {
      missing_integrity_event_id: "66666666-6666-4666-8666-666666666666"
    }), now, { allowUnanchoredTest: true }),
    (error) => error && error.code === "AWS_RETENTION_INVALID"
  );
  assert.throws(
    () => worm._test.recoveryIdentity(testConfig, Object.assign({}, base, { replica_object_lock_mode: "COMPLIANCE" }), now),
    (error) => error && error.code === "AWS_RETENTION_MISMATCH"
  );
  assert.throws(
    () => worm._test.recoveryIdentity(testConfig, Object.assign({}, base, { replica_retain_until: "2026-08-20T23:59:59.999Z" }), now),
    (error) => error && error.code === "AWS_RETENTION_MISMATCH"
  );
  assert.throws(
    () => worm._test.recoveryIdentity(testConfig, Object.assign({}, base, { replica_retain_until: "2026-10-01T00:00:00.000Z" }), now),
    (error) => error && error.code === "AWS_RETENTION_MISMATCH"
  );

  const live = Object.assign({}, base, {
    is_test: false,
    replica_object_lock_mode: "COMPLIANCE",
    replica_retain_until: "2034-12-31T23:59:59.999Z"
  });
  assert.strictEqual(worm._test.recoveryIdentity(liveConfig, live, now).mode, "COMPLIANCE");
  assert.throws(
    () => worm._test.recoveryIdentity(testConfig, live, now),
    (error) => error && error.code === "LIVE_WORM_NOT_ENABLED"
  );
  assert.throws(
    () => worm._test.recoveryIdentity(liveConfig, Object.assign({}, live, { replica_object_lock_mode: "GOVERNANCE" }), now),
    (error) => error && error.code === "AWS_RETENTION_MISMATCH"
  );
  assert.throws(
    () => worm._test.recoveryIdentity(liveConfig, Object.assign({}, live, { replica_retain_until: "2034-12-31T23:59:59.998Z" }), now),
    (error) => error && error.code === "AWS_RETENTION_MISMATCH"
  );
}

async function testArchiveReadStatusSemantics() {
  const supabase = require(path.join(root, "api", "_lib", "supabase-server"));
  const originalFetch = supabase.fetchZOmejitvijo;
  const record = Object.assign({}, sampleRecord, { storage_bucket: "archive", storage_path: "user/original.pdf" });
  let status = 404;
  supabase.fetchZOmejitvijo = async function () { return new Response("", { status }); };
  try {
    assert.strictEqual(await archive.readObject({ url: "http://supabase.local", serviceKey: "test" }, record), null);
    assert.strictEqual((await archive.verifyRecord({ url: "http://supabase.local", serviceKey: "test" }, record)).result, "missing");
    status = 400;
    await assert.rejects(
      () => archive.readObject({ url: "http://supabase.local", serviceKey: "test" }, record),
      (error) => error && error.status === 400
    );
    const badRequest = await archive.verifyRecord({ url: "http://supabase.local", serviceKey: "test" }, record);
    assert.deepStrictEqual(badRequest, {
      result: "error", observed_sha256: null, observed_byte_size: null,
      checker_version: "pos-archive-integrity-v1",
      details: { code: "STORAGE_READ_FAILED", status: 400 }
    });
    status = 500;
    assert.strictEqual((await archive.verifyRecord({ url: "http://supabase.local", serviceKey: "test" }, record)).result, "error");
  } finally {
    supabase.fetchZOmejitvijo = originalFetch;
  }
}

async function testPrimaryWriteConflictClassification() {
  const supabase = require(path.join(root, "api", "_lib", "supabase-server"));
  const originalFetch = supabase.fetchZOmejitvijo;
  const original = Buffer.from("original");
  const record = Object.assign({}, sampleRecord, {
    storage_bucket: "pos-invoice-originals",
    storage_path: "user/invoice.pdf"
  });
  let responseBody;
  let responseStatus;
  supabase.fetchZOmejitvijo = async function () {
    return new Response(JSON.stringify(responseBody), {
      status: responseStatus,
      headers: { "Content-Type": "application/json" }
    });
  };
  async function write() {
    return archiveWorker._test.writePrimaryObject({ url: "http://supabase.local", serviceKey: "test" }, record, original);
  }
  try {
    responseStatus = 409;
    responseBody = { code: "ResourceAlreadyExists", message: "The resource already exists" };
    assert.deepStrictEqual(await write(), { created: false });
    responseStatus = 400;
    responseBody = { statusCode: "409", error: "Duplicate", message: "The resource already exists" };
    assert.deepStrictEqual(await write(), { created: false });
    responseStatus = 409;
    responseBody = { code: "Conflict", message: "Asset Already Exists" };
    await assert.rejects(write, (error) => error && error.code === "PRIMARY_RESTORE_WRITE_FAILED" && error.status === 409);
    responseStatus = 400;
    responseBody = { code: "InvalidRequest", message: "Malformed storage path" };
    await assert.rejects(write, (error) => error && error.code === "PRIMARY_RESTORE_WRITE_FAILED" && error.status === 400);
  } finally {
    supabase.fetchZOmejitvijo = originalFetch;
  }
}

async function testAwsRoundTrip() {
  const original = Buffer.from("original");
  const expectedKey = worm._test.objectKey(sampleRecord);
  const stored = { versionId: "version-1", retainUntil: testRetention.retainUntil };
  const calls = [];
  const client = {
    async send(command) {
      const name = command.constructor.name;
      calls.push({ name: name, input: command.input });
      if (name === "HeadObjectCommand" && !command.input.VersionId) {
        const missing = new Error("missing");
        missing.name = "NotFound";
        missing.$metadata = { httpStatusCode: 404 };
        throw missing;
      }
      if (name === "PutObjectCommand") {
        assert.strictEqual(command.input.Key, expectedKey);
        assert.strictEqual(command.input.ObjectLockMode, "GOVERNANCE");
        assert.strictEqual(command.input.ChecksumSHA256, worm._test.hexToBase64(sampleRecord.sha256));
        assert.strictEqual(command.input.ServerSideEncryption, "AES256");
        return { VersionId: stored.versionId, ETag: "etag-1" };
      }
      if (name === "HeadObjectCommand") {
        return {
          VersionId: stored.versionId,
          ETag: "etag-1",
          ContentLength: original.length,
          ChecksumSHA256: worm._test.hexToBase64(sampleRecord.sha256),
          Metadata: { sha256: sampleRecord.sha256 },
          ObjectLockMode: "GOVERNANCE",
          ObjectLockRetainUntilDate: stored.retainUntil
        };
      }
      if (name === "GetObjectCommand") {
        return {
          VersionId: stored.versionId,
          ContentLength: original.length,
          ChecksumSHA256: worm._test.hexToBase64(sampleRecord.sha256),
          Body: { async transformToByteArray() { return new Uint8Array(original); } }
        };
      }
      throw new Error("Unexpected AWS command: " + name);
    }
  };

  const copied = await worm.copyAndVerify(client, testConfig, sampleRecord, original, new Date("2026-08-21T00:00:00Z"));
  assert.strictEqual(copied.objectVersionId, stored.versionId);
  assert.strictEqual(copied.remoteChecksumSha256, sampleRecord.sha256);
  const recoveryRecord = Object.assign({}, sampleRecord, {
    replica_bucket: copied.bucket,
    replica_object_key: copied.objectKey,
    replica_object_version_id: copied.objectVersionId,
    replica_object_lock_mode: copied.objectLockMode,
    replica_retain_until: copied.retainUntil,
    replica_last_attempt_at: "2026-08-21T00:00:00.000Z",
    replica_copied_at: "2026-08-21T00:01:00.000Z"
  });
  const recoveryNow = new Date("2026-08-21T00:02:00Z");
  const recovered = await worm.recoverAndVerify(client, testConfig, recoveryRecord, recoveryNow);
  assert.strictEqual(recovered.sha256, sampleRecord.sha256);
  assert.deepStrictEqual(recovered.buffer, original);
  async function* oversizedBody() { yield Buffer.from("abc"); yield Buffer.from("def"); }
  await assert.rejects(
    () => worm._test.readBodyBounded(oversizedBody(), 5),
    function (error) { return error && error.code === "AWS_RECOVERY_TOO_LARGE"; }
  );
  await assert.rejects(
    () => worm.recoverAndVerify({ send: async function (command) {
      if (command.constructor.name === "HeadObjectCommand") {
        return {
          VersionId: stored.versionId,
          ContentLength: original.length,
          ChecksumSHA256: worm._test.hexToBase64(sampleRecord.sha256),
          Metadata: { sha256: sampleRecord.sha256 },
          ObjectLockMode: "GOVERNANCE",
          ObjectLockRetainUntilDate: stored.retainUntil
        };
      }
      return { ContentLength: original.length, Body: { async transformToByteArray() { return new Uint8Array(original); } } };
    } }, testConfig, recoveryRecord, recoveryNow),
    function (error) { return error && error.code === "AWS_RECOVERY_INVALID"; }
  );
  await assert.rejects(
    () => worm.recoverAndVerify(client, testConfig, Object.assign({}, recoveryRecord, {
      objectVersionId: "different-version"
    }), recoveryNow),
    function (error) { return error && error.code === "AWS_VERSION_AMBIGUOUS"; }
  );
  await assert.rejects(
    () => worm.recoverAndVerify(client, testConfig, Object.assign({}, recoveryRecord, {
      replica_object_version_id: ""
    }), recoveryNow),
    function (error) { return error && error.code === "AWS_VERSION_MISSING"; }
  );
  const tampered = Buffer.from("tampered");
  await assert.rejects(
    () => worm.recoverAndVerify({ send: async function (command) {
      if (command.constructor.name === "HeadObjectCommand") {
        return {
          VersionId: stored.versionId,
          ContentLength: original.length,
          ChecksumSHA256: worm._test.hexToBase64(sampleRecord.sha256),
          Metadata: { sha256: sampleRecord.sha256 },
          ObjectLockMode: "GOVERNANCE",
          ObjectLockRetainUntilDate: stored.retainUntil
        };
      }
      return {
        VersionId: stored.versionId,
        ContentLength: tampered.length,
        Body: { async transformToByteArray() { return new Uint8Array(tampered); } }
      };
    } }, testConfig, recoveryRecord, recoveryNow),
    function (error) { return error && error.code === "AWS_RECOVERY_HASH_MISMATCH"; }
  );
  assert.ok(calls.some(function (call) { return call.name === "PutObjectCommand"; }));
  assert.ok(calls.some(function (call) { return call.name === "GetObjectCommand" && call.input.VersionId === stored.versionId; }));
}

async function testMissingDocumentRepair() {
  const supabase = require(path.join(root, "api", "_lib", "supabase-server"));
  const invoiceDocuments = require(path.join(root, "api", "_handlers", "pos-racun-pdf"))._test;
  const adjustmentDocuments = require(path.join(root, "api", "_handlers", "pos-racun-korekcija"))._test;
  const adjustmentEinvoiceDocuments = require(path.join(root, "api", "_handlers", "pos-racun-korekcija-xrechnung"))._test;
  const offerDocuments = require(path.join(root, "api", "_handlers", "pos-angebot-pdf"))._test;
  const contractDocuments = require(path.join(root, "api", "_handlers", "pos-pogodba-pdf"))._test;
  const originalRpc = supabase.pokliciRpc;
  const originalRead = supabase.pridobiVrstice;
  const originalInvoiceEnsure = invoiceDocuments.ensureDocument;
  const originalAdjustmentEnsure = adjustmentDocuments.ensureDocument;
  const originalAdjustmentEinvoiceEnsure = adjustmentEinvoiceDocuments.ensureDocument;
  const originalOfferEnsure = offerDocuments.ensureDocument;
  const originalContractEnsure = contractDocuments.ensureDocument;
  const repaired = [];
  supabase.pokliciRpc = async function (_, name, payload) {
    assert.strictEqual(name, "pos_archive_missing_document_batch");
    assert.strictEqual(payload.p_limit, 2);
    return [
      { source_table: "pos_invoices", source_id: "invoice-1", user_id: "user-1" },
      { source_table: "pos_invoice_adjustments", source_id: "adjustment-1", user_id: "user-1" },
      { source_table: "pos_invoice_adjustment_xrechnung", source_id: "adjustment-x-1", user_id: "user-1" },
      { source_table: "pos_work_order_offer", source_id: "offer-1", user_id: "user-1" },
      { source_table: "pos_work_order_contract_confirmation", source_id: "contract-1", user_id: "user-1" }
    ];
  };
  supabase.pridobiVrstice = async function (_, table, query) {
    assert.match(query, /user_id=eq\.user-1/);
    return [{ id: /contract-1/.test(query) ? "contract-1" : /offer-1/.test(query) ? "offer-1" : /adjustment-x-1/.test(query) ? "adjustment-x-1" : table === "pos_invoices" ? "invoice-1" : "adjustment-1" }];
  };
  invoiceDocuments.ensureDocument = async function (_, row) { repaired.push("invoice:" + row.id); };
  adjustmentDocuments.ensureDocument = async function (_, row) { repaired.push("adjustment:" + row.id); };
  adjustmentEinvoiceDocuments.ensureDocument = async function (_, row) { repaired.push("adjustment-xml:" + row.id); };
  offerDocuments.ensureDocument = async function (_, row) { repaired.push("offer:" + row.id); };
  contractDocuments.ensureDocument = async function (_, row) { repaired.push("contract:" + row.id); };
  try {
    const counts = await archiveWorker._test.repairMissingDocuments({}, 2);
    assert.deepStrictEqual(counts, { repaired: 5, failed: 0 });
    assert.deepStrictEqual(repaired, ["invoice:invoice-1", "adjustment:adjustment-1", "adjustment-xml:adjustment-x-1", "offer:offer-1", "contract:contract-1"]);
  } finally {
    supabase.pokliciRpc = originalRpc;
    supabase.pridobiVrstice = originalRead;
    invoiceDocuments.ensureDocument = originalInvoiceEnsure;
    adjustmentDocuments.ensureDocument = originalAdjustmentEnsure;
    adjustmentEinvoiceDocuments.ensureDocument = originalAdjustmentEinvoiceEnsure;
    offerDocuments.ensureDocument = originalOfferEnsure;
    contractDocuments.ensureDocument = originalContractEnsure;
  }
}

async function testUserIntegrityBatch() {
  const supabase = require(path.join(root, "api", "_lib", "supabase-server"));
  const originalRpc = supabase.pokliciRpc;
  supabase.pokliciRpc = async function (_, name, payload) {
    assert.strictEqual(name, "pos_archive_user_integrity_batch");
    assert.deepStrictEqual(payload, { p_user_id: "user-1", p_limit: 25 });
    return [{ id: "archive-1" }];
  };
  try {
    const rows = await handler._test.integrityBatchForUser({}, "user-1", 999);
    assert.deepStrictEqual(rows, [{ id: "archive-1" }]);
  } finally {
    supabase.pokliciRpc = originalRpc;
  }
}

async function testParallelUserIntegrityVerification() {
  const originalVerify = archive.verifyAndRecord;
  let active = 0;
  let maximumActive = 0;
  const completed = [];
  archive.verifyAndRecord = async function (_, record) {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise(function (resolve) { setTimeout(resolve, 5); });
    completed.push(record.id);
    active -= 1;
  };
  try {
    const checked = await handler._test.verifyRecords({}, [
      { id: "archive-1" },
      { id: "archive-2" },
      { id: "archive-3" }
    ]);
    assert.strictEqual(checked, 3);
    assert.strictEqual(maximumActive, 3);
    assert.deepStrictEqual(completed.sort(), ["archive-1", "archive-2", "archive-3"]);
  } finally {
    archive.verifyAndRecord = originalVerify;
  }
}

async function testPrimaryObjectRestore() {
  const supabase = require(path.join(root, "api", "_lib", "supabase-server"));
  const originalFetch = supabase.fetchZOmejitvijo;
  const originalRpc = supabase.pokliciRpc;
  const original = Buffer.from("original");
  const versionId = "verified-version-1";
  const missingEventId = "66666666-6666-4666-8666-666666666666";
  const verifiedEventId = "77777777-7777-4777-8777-777777777777";
  const fixtureNow = new Date();
  const lastAttemptAt = new Date(fixtureNow.getTime() - 60 * 1000);
  const copiedAt = new Date(fixtureNow.getTime() - 30 * 1000);
  const retainUntil = new Date(lastAttemptAt.getTime() + testConfig.testRetentionDays * 86400000);
  const record = Object.assign({}, sampleRecord, {
    replica_id: "44444444-4444-4444-8444-444444444444",
    missing_integrity_event_id: missingEventId,
    replica_bucket: testConfig.bucket,
    replica_object_key: worm._test.objectKey(sampleRecord),
    replica_object_version_id: versionId,
    replica_object_lock_mode: "GOVERNANCE",
    replica_retain_until: retainUntil.toISOString(),
    replica_last_attempt_at: lastAttemptAt.toISOString(),
    replica_copied_at: copiedAt.toISOString(),
    storage_bucket: "pos-invoice-originals",
    storage_path: "22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/invoice.pdf"
  });
  const events = [];
  const rpcCalls = [];
  const awsCalls = [];
  let primary = null;
  let primaryWrites = 0;

  function response(body, status, contentType) {
    return new Response(body, {
      status: status,
      headers: { "Content-Type": contentType || "application/octet-stream" }
    });
  }
  function readiness() {
    const latest = events[events.length - 1];
    return Boolean(latest && latest.result === "verified"
      && latest.observed_sha256 === record.sha256
      && Number(latest.observed_byte_size) === Number(record.byte_size));
  }

  supabase.fetchZOmejitvijo = async function (url, options) {
    const method = String(options && options.method || "GET").toUpperCase();
    if (url.includes("/storage/v1/object/")) {
      if (method === "GET") {
        if (!primary) return response("", 404);
        return response(primary, 200, record.original_media_type);
      }
      assert.strictEqual(method, "POST");
      assert.strictEqual(options.headers["x-upsert"], "false");
      assert.strictEqual(options.headers["Content-Type"], record.original_media_type);
      assert.ok(url.endsWith("/pos-invoice-originals/" + record.storage_path));
      primaryWrites += 1;
      if (primary) return response(JSON.stringify({ message: "Asset Already Exists" }), 409, "application/json");
      primary = Buffer.from(options.body);
      return response("{}", 200, "application/json");
    }
    if (url.endsWith("/rest/v1/pos_archive_integrity_events") && method === "POST") {
      const event = Object.assign({ id: events.length === 0 ? missingEventId : verifiedEventId }, JSON.parse(options.body));
      events.push(event);
      return response(JSON.stringify([event]), 201, "application/json");
    }
    throw new Error("Unexpected mocked Supabase request: " + method + " " + url);
  };
  supabase.pokliciRpc = async function (_, name, payload) {
    rpcCalls.push({ name, payload });
    assert.strictEqual(name, "pos_archive_primary_recovery_complete");
    assert.strictEqual(payload.p_replica_id, record.replica_id);
    assert.strictEqual(payload.p_object_version_id, versionId);
    assert.strictEqual(payload.p_missing_integrity_event_id, missingEventId);
    assert.strictEqual(payload.p_verified_integrity_event_id, verifiedEventId);
    return null;
  };
  const s3Client = {
    async send(command) {
      const name = command.constructor.name;
      awsCalls.push({ name, input: command.input });
      assert.strictEqual(command.input.VersionId, versionId);
      if (name === "HeadObjectCommand") {
        return {
          VersionId: versionId,
          ContentLength: original.length,
          ChecksumSHA256: worm._test.hexToBase64(record.sha256),
          Metadata: { sha256: record.sha256 },
          ObjectLockMode: "GOVERNANCE",
          ObjectLockRetainUntilDate: retainUntil
        };
      }
      if (name === "GetObjectCommand") {
        return {
          VersionId: versionId,
          ContentLength: original.length,
          ChecksumSHA256: worm._test.hexToBase64(record.sha256),
          Body: { async transformToByteArray() { return new Uint8Array(original); } }
        };
      }
      throw new Error("Unexpected AWS recovery command: " + name);
    }
  };

  try {
    const missing = await archive.verifyAndRecord({ url: "http://supabase.local", serviceKey: "test" }, record);
    assert.strictEqual(missing.verification.result, "missing");
    assert.strictEqual(readiness(), false, "Manjkajoči primarni objekt mora zakleniti pripravljenost.");

    const restored = await archiveWorker._test.restoreMissingPrimary(
      { url: "http://supabase.local", serviceKey: "test" }, s3Client, testConfig, record
    );
    assert.strictEqual(restored.restored, true);
    assert.deepStrictEqual(primary, original);
    assert.strictEqual(primaryWrites, 1);
    assert.strictEqual(events[events.length - 1].result, "verified");
    assert.strictEqual(readiness(), true, "Pripravljenost se sme obnoviti šele po ponovnem SHA/size preverjanju.");
    assert.strictEqual(rpcCalls.length, 1);
    assert.ok(awsCalls.some(function (call) {
      return call.name === "GetObjectCommand" && call.input.VersionId === versionId;
    }));

    primary = Buffer.from("tampered");
    const writesBeforeMismatch = primaryWrites;
    await assert.rejects(
      () => archiveWorker._test.restoreMissingPrimary(
        { url: "http://supabase.local", serviceKey: "test" }, s3Client, testConfig, record
      ),
      function (error) { return error && error.code === "PRIMARY_RESTORE_STATE_INVALID"; }
    );
    assert.strictEqual(primaryWrites, writesBeforeMismatch, "Poškodovanega obstoječega objekta obnovitev ne sme prepisati.");
  } finally {
    supabase.fetchZOmejitvijo = originalFetch;
    supabase.pokliciRpc = originalRpc;
  }
}

async function testUnconfiguredWormDoesNotClaimReplicas() {
  const supabase = require(path.join(root, "api", "_lib", "supabase-server"));
  const originalConfiguration = worm.configuration;
  const originalSupabaseConfiguration = supabase.konfiguracija;
  const originalVerifyUser = supabase.preveriUporabnika;
  const originalRpc = supabase.pokliciRpc;
  const originalCronSecret = process.env.CRON_SECRET;
  const calls = [];
  let responseStatus = 0;
  let responseBody = null;
  supabase.konfiguracija = function () { return {}; };
  supabase.preveriUporabnika = async function () { throw new Error("Cron ne sme preverjati uporabnika."); };
  supabase.pokliciRpc = async function (_, name) {
    calls.push(name);
    if (name === "pos_archive_replica_batch" || name === "pos_archive_provider_fail") {
      throw new Error("Nepovezan AWS ne sme prevzeti ali pokvariti replik.");
    }
    if (name === "pos_archive_missing_document_batch" || name === "pos_archive_integrity_batch") return [];
    throw new Error("Nepričakovan RPC: " + name);
  };
  worm.configuration = function () {
    return { configured: false, liveEnabled: false };
  };
  process.env.CRON_SECRET = "archive-test-secret";
  const res = {
    status(code) { responseStatus = code; return this; },
    setHeader() { return this; },
    end(body) { responseBody = JSON.parse(body); return this; }
  };
  try {
    await archiveWorker({ method: "GET", headers: { authorization: "Bearer archive-test-secret" } }, res);
    assert.strictEqual(responseStatus, 200);
    assert.strictEqual(responseBody.ok, true);
    assert.strictEqual(responseBody.replicas.skipped, true);
    assert.strictEqual(responseBody.replicas.checked, 0);
    assert.strictEqual(responseBody.replicas.providerErrorCode, null);
    assert.deepStrictEqual(calls, ["pos_archive_missing_document_batch", "pos_archive_integrity_batch"]);
  } finally {
    worm.configuration = originalConfiguration;
    supabase.konfiguracija = originalSupabaseConfiguration;
    supabase.preveriUporabnika = originalVerifyUser;
    supabase.pokliciRpc = originalRpc;
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  }
}

async function runArchiveTests() {
  testRecoveryRetentionPolicy();
  await testArchiveReadStatusSemantics();
  await testPrimaryWriteConflictClassification();
  await testAwsRoundTrip();
  await testMissingDocumentRepair();
  await testUserIntegrityBatch();
  await testParallelUserIntegrityVerification();
  await testPrimaryObjectRestore();
  await testUnconfiguredWormDoesNotClaimReplicas();
}

runArchiveTests().then(function () {
  console.log("POS archive tests passed.");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
