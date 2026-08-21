"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821100924_pos_gobd_archive.sql"), "utf8");
const hardeningMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821101118_pos_archive_private_readiness.sql"), "utf8");
const wormMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821195904_pos_s3_object_lock_archive.sql"), "utf8");
const productionRecoveryMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821214500_pos_archive_production_recovery_evidence.sql"), "utf8");
const completeSummaryMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821213852_pos_archive_complete_summary.sql"), "utf8");
const missingDocumentMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821220929_pos_archive_missing_document_repair.sql"), "utf8");
const userIntegrityMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821223224_pos_archive_user_integrity_batch.sql"), "utf8");
const integrityPriorityMigration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260821223844_pos_archive_integrity_batch_priority.sql"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const archive = require(path.join(root, "api", "_lib", "pos-archive"));
const worm = require(path.join(root, "api", "_lib", "pos-worm-archive"));
const handler = require(path.join(root, "api", "_handlers", "pos-arhiv"));
const archiveWorker = require(path.join(root, "api", "pos-arhiv-delavec"));
const terminal = require(path.join(root, "app", "pos-terminal"));
const handlerSource = fs.readFileSync(path.join(root, "api", "_handlers", "pos-arhiv.js"), "utf8");
const localServer = fs.readFileSync(path.join(root, "scripts", "local-server.js"), "utf8");

assert.strictEqual(archive.hash(Buffer.from("original")), "0682c5f2076f099c34cfdd15a9e063849ed437a49677e6fcc5b4198c76575be5");
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
assert.match(html, /pos-terminal\.js\?v=20260822-full-history-v7/);
assert.match(js, /function productionReady\(\)[\s\S]*archiveCapability\.productionReady/);
assert.match(js, /function loadArchiveCapability\([\s\S]*await apiSessionToken\(\)/);
assert.match(js, /async function loadFullServerState\([\s\S]*renderHome\(\);\s*await loadArchiveCapability\(false, false\);/);
assert.doesNotMatch(js, /currentSessionToken/);
assert.match(handlerSource, /select=id,user_id,invoice_id/);
assert.match(handlerSource, /pos_archive_user_summary/);
assert.match(handlerSource, /pos_archive_user_integrity_batch/);
assert.doesNotMatch(handlerSource, /archived_at\.desc&limit=25/);
assert.match(html, /data-archive-verify>Preveri arhiv zdaj/);
assert.match(js, /Paket je preverjen; preostanek arhiva bo preverjen v naslednjih paketih/);
assert.doesNotMatch(handlerSource, /pos_archive_integrity_events[\s\S]*limit=500/);
assert.match(fs.readFileSync(path.join(root, "api", "pos-arhiv-delavec.js"), "utf8"), /Promise\.all\([\s\S]*archive\.verifyAndRecord/);
assert.match(js, /Produkcijska izdaja čaka potrjeno ločeno arhivsko kopijo/);
assert.ok(vercel.rewrites.some((entry) => entry.source === "/api/pos-arhiv"));
assert.match(localServer, /posArhivModul = require\.resolve\("\.\.\/api\/_handlers\/pos-arhiv"\)/);
assert.match(localServer, /pathname === "\/api\/pos-arhiv"[\s\S]*izvediLokalniApi\(req, res, posArhivModul\)/);
assert.ok(vercel.crons.some((entry) => entry.path === "/api/pos-arhiv-delavec" && entry.schedule === "23 4 * * *"));

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
          ContentLength: original.length,
          Body: { async transformToByteArray() { return new Uint8Array(original); } }
        };
      }
      throw new Error("Unexpected AWS command: " + name);
    }
  };

  const copied = await worm.copyAndVerify(client, testConfig, sampleRecord, original, new Date("2026-08-21T00:00:00Z"));
  assert.strictEqual(copied.objectVersionId, stored.versionId);
  assert.strictEqual(copied.remoteChecksumSha256, sampleRecord.sha256);
  const recovered = await worm.recoverAndVerify(client, testConfig, Object.assign({}, sampleRecord, {
    replica_bucket: copied.bucket,
    replica_object_key: copied.objectKey,
    replica_object_version_id: copied.objectVersionId
  }));
  assert.strictEqual(recovered.sha256, sampleRecord.sha256);
  assert.ok(calls.some(function (call) { return call.name === "PutObjectCommand"; }));
  assert.ok(calls.some(function (call) { return call.name === "GetObjectCommand" && call.input.VersionId === stored.versionId; }));
}

async function testMissingDocumentRepair() {
  const supabase = require(path.join(root, "api", "_lib", "supabase-server"));
  const invoiceDocuments = require(path.join(root, "api", "_handlers", "pos-racun-pdf"))._test;
  const adjustmentDocuments = require(path.join(root, "api", "_handlers", "pos-racun-korekcija"))._test;
  const originalRpc = supabase.pokliciRpc;
  const originalRead = supabase.pridobiVrstice;
  const originalInvoiceEnsure = invoiceDocuments.ensureDocument;
  const originalAdjustmentEnsure = adjustmentDocuments.ensureDocument;
  const repaired = [];
  supabase.pokliciRpc = async function (_, name, payload) {
    assert.strictEqual(name, "pos_archive_missing_document_batch");
    assert.strictEqual(payload.p_limit, 2);
    return [
      { source_table: "pos_invoices", source_id: "invoice-1", user_id: "user-1" },
      { source_table: "pos_invoice_adjustments", source_id: "adjustment-1", user_id: "user-1" }
    ];
  };
  supabase.pridobiVrstice = async function (_, table, query) {
    assert.match(query, /user_id=eq\.user-1/);
    return [{ id: table === "pos_invoices" ? "invoice-1" : "adjustment-1" }];
  };
  invoiceDocuments.ensureDocument = async function (_, row) { repaired.push("invoice:" + row.id); };
  adjustmentDocuments.ensureDocument = async function (_, row) { repaired.push("adjustment:" + row.id); };
  try {
    const counts = await archiveWorker._test.repairMissingDocuments({}, 2);
    assert.deepStrictEqual(counts, { repaired: 2, failed: 0 });
    assert.deepStrictEqual(repaired, ["invoice:invoice-1", "adjustment:adjustment-1"]);
  } finally {
    supabase.pokliciRpc = originalRpc;
    supabase.pridobiVrstice = originalRead;
    invoiceDocuments.ensureDocument = originalInvoiceEnsure;
    adjustmentDocuments.ensureDocument = originalAdjustmentEnsure;
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
  await testAwsRoundTrip();
  await testMissingDocumentRepair();
  await testUserIntegrityBatch();
  await testParallelUserIntegrityVerification();
  await testUnconfiguredWormDoesNotClaimReplicas();
}

runArchiveTests().then(function () {
  console.log("POS archive tests passed.");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
