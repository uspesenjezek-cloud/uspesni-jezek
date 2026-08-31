"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const migrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter((name) => /pos_archive_primary_object_recovery\.sql$/.test(name)).sort().pop();
assert.ok(migrationName, "Manjka migracija obnove primarnega arhivskega objekta.");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", migrationName), "utf8");
const workerSource = fs.readFileSync(path.join(root, "api", "_handlers", "pos-arhiv-delavec.js"), "utf8");
const batchSql = migration.match(/create or replace function public\.pos_archive_primary_recovery_batch\([\s\S]*?\n\$\$;/i);
assert.ok(batchSql, "Migracija nima zaključene batch funkcije primarne obnove.");

assert.match(migration, /create or replace function public\.pos_archive_primary_recovery_batch\([\s\S]*latest\.result = 'missing'/i);
assert.match(migration, /replica\.status = 'verified'[\s\S]*replica\.remote_checksum_sha256 = record\.sha256[\s\S]*replica\.remote_byte_size = record\.byte_size/i);
assert.match(migration, /nullif\(trim\(replica\.object_version_id\), ''\) is not null/i);
assert.match(batchSql[0], /replica_last_attempt_at timestamptz,[\s\S]*replica_copied_at timestamptz/i);
assert.match(batchSql[0], /replica\.retain_until,[\s\S]*replica\.last_attempt_at,[\s\S]*replica\.copied_at,[\s\S]*record\.id/i);
assert.match(batchSql[0], /replica\.last_attempt_at is not null[\s\S]*replica\.copied_at is not null/i);
assert.match(batchSql[0], /record\.is_test[\s\S]*replica\.object_lock_mode = 'COMPLIANCE'[\s\S]*record\.retention_not_before::timestamptz \+ interval '1 day' - interval '1 millisecond'/i);
assert.match(migration, /create or replace function public\.pos_archive_primary_recovery_complete\([\s\S]*p_missing_integrity_event_id uuid,[\s\S]*p_verified_integrity_event_id uuid/i);
assert.match(migration, /v_missing_event\.result <> 'missing'[\s\S]*v_verified_event\.checked_at <= v_missing_event\.checked_at[\s\S]*v_latest_event_id is distinct from v_verified_event\.id/i);
assert.match(migration, /'missingIntegrityEventId', v_missing_event\.id[\s\S]*'verifiedIntegrityEventId', v_verified_event\.id/i);
assert.match(migration, /event\.details ->> 'missingIntegrityEventId' = v_missing_event\.id::text[\s\S]*event\.details ->> 'verifiedIntegrityEventId' = v_verified_event\.id::text/i);
assert.match(migration, /create or replace function private\.pos_archive_production_ready\(\)[\s\S]*left join lateral[\s\S]*latest\.result is distinct from 'verified'[\s\S]*latest\.observed_sha256 is distinct from record\.sha256[\s\S]*latest\.observed_byte_size is distinct from record\.byte_size[\s\S]*latest\.checked_at < now\(\) - interval '90 days'[\s\S]*latest\.checked_at > now\(\) \+ interval '5 minutes'/i);
assert.match(migration, /revoke all on function public\.pos_archive_primary_recovery_complete\(uuid, uuid, uuid, text\)/i);
assert.match(migration, /revoke all on function public\.pos_archive_primary_recovery_batch\(integer\)[\s\S]*to service_role/i);
assert.match(workerSource, /"x-upsert": "false"/);
assert.doesNotMatch(workerSource, /"x-upsert": "true"/);

const archive = require(path.join(root, "api", "_lib", "pos-archive"));
const worm = require(path.join(root, "api", "_lib", "pos-worm-archive"));
const worker = require(path.join(root, "api", "_handlers", "pos-arhiv-delavec"));
const supabase = require(path.join(root, "api", "_lib", "supabase-server"));

const original = Buffer.from("original");
const sha256 = archive.hash(original);
const versionId = "verified-version-1";
const missingEventId = "66666666-6666-4666-8666-666666666666";
const verifiedEventId = "77777777-7777-4777-8777-777777777777";
const fixtureNow = new Date();
const lastAttemptAt = new Date(fixtureNow.getTime() - 60 * 1000);
const copiedAt = new Date(fixtureNow.getTime() - 30 * 1000);
const retainUntil = new Date(lastAttemptAt.getTime() + 7 * 86400000);
const s3Cfg = worm.configuration({
  POS_ARCHIVE_S3_REGION: "eu-central-1",
  POS_ARCHIVE_S3_BUCKET: "uj-pos-test-archive",
  POS_ARCHIVE_S3_ACCESS_KEY_ID: "test-access",
  POS_ARCHIVE_S3_SECRET_ACCESS_KEY: "test-secret"
});
const record = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  invoice_id: "33333333-3333-4333-8333-333333333333",
  replica_id: "44444444-4444-4444-8444-444444444444",
  missing_integrity_event_id: missingEventId,
  source_table: "pos_invoice_documents",
  source_id: "55555555-5555-4555-8555-555555555555",
  original_media_type: "application/pdf",
  sha256,
  byte_size: original.length,
  retention_not_before: "2034-12-31",
  is_test: true,
  replica_bucket: s3Cfg.bucket,
  replica_object_key: "",
  replica_object_version_id: versionId,
  replica_object_lock_mode: "GOVERNANCE",
  replica_retain_until: retainUntil.toISOString(),
  replica_last_attempt_at: lastAttemptAt.toISOString(),
  replica_copied_at: copiedAt.toISOString(),
  storage_bucket: "pos-invoice-originals",
  storage_path: "22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/invoice.pdf"
};
record.replica_object_key = worm._test.objectKey(record);

function s3ClientWithBody(body, calls) {
  return {
    async send(command) {
      const name = command.constructor.name;
      calls.push({ name, input: command.input });
      assert.strictEqual(command.input.VersionId, versionId);
      if (name === "HeadObjectCommand") {
        return {
          VersionId: versionId,
          ContentLength: original.length,
          ChecksumSHA256: worm._test.hexToBase64(sha256),
          Metadata: { sha256 },
          ObjectLockMode: "GOVERNANCE",
          ObjectLockRetainUntilDate: retainUntil
        };
      }
      if (name === "GetObjectCommand") {
        return {
          VersionId: versionId,
          ContentLength: body.length,
          Body: { async transformToByteArray() { return new Uint8Array(body); } }
        };
      }
      throw new Error("Unexpected AWS command: " + name);
    }
  };
}

async function main() {
  const originalFetch = supabase.fetchZOmejitvijo;
  const originalRpc = supabase.pokliciRpc;
  const events = [];
  const rpcCalls = [];
  const awsCalls = [];
  let primary = null;
  let primaryWrites = 0;

  function response(body, status, contentType) {
    return new Response(body, {
      status,
      headers: { "Content-Type": contentType || "application/octet-stream" }
    });
  }
  function productionReady() {
    const latest = events[events.length - 1];
    return Boolean(latest && latest.result === "verified"
      && latest.observed_sha256 === record.sha256
      && Number(latest.observed_byte_size) === Number(record.byte_size));
  }

  supabase.fetchZOmejitvijo = async function (url, options) {
    const method = String(options && options.method || "GET").toUpperCase();
    if (url.includes("/storage/v1/object/")) {
      if (method === "GET") return primary
        ? response(primary, 200, record.original_media_type)
        : response("", 404);
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
    throw new Error("Unexpected Supabase request: " + method + " " + url);
  };
  supabase.pokliciRpc = async function (_, name, payload) {
    assert.strictEqual(name, "pos_archive_primary_recovery_complete");
    assert.strictEqual(payload.p_replica_id, record.replica_id);
    assert.strictEqual(payload.p_object_version_id, versionId);
    assert.strictEqual(payload.p_missing_integrity_event_id, missingEventId);
    assert.strictEqual(payload.p_verified_integrity_event_id, verifiedEventId);
    rpcCalls.push({ name, payload });
    return null;
  };

  try {
    const missing = await archive.verifyAndRecord({ url: "http://supabase.local", serviceKey: "test" }, record);
    assert.strictEqual(missing.verification.result, "missing");
    assert.strictEqual(productionReady(), false);

    const result = await worker._test.restoreMissingPrimary(
      { url: "http://supabase.local", serviceKey: "test" },
      s3ClientWithBody(original, awsCalls), s3Cfg, record
    );
    assert.strictEqual(result.restored, true);
    assert.deepStrictEqual(primary, original);
    assert.strictEqual(primaryWrites, 1);
    assert.strictEqual(events[events.length - 1].result, "verified");
    assert.strictEqual(productionReady(), true);
    assert.strictEqual(rpcCalls.length, 1);
    assert.ok(awsCalls.some((call) => call.name === "GetObjectCommand" && call.input.VersionId === versionId));

    await assert.rejects(
      () => worm.recoverAndVerify(s3ClientWithBody(Buffer.from("tampered"), []), s3Cfg, record),
      (error) => error && error.code === "AWS_RECOVERY_HASH_MISMATCH"
    );
    await assert.rejects(
      () => worm.recoverAndVerify(s3ClientWithBody(original, []), s3Cfg, Object.assign({}, record, {
        objectVersionId: "ambiguous-version"
      })),
      (error) => error && error.code === "AWS_VERSION_AMBIGUOUS"
    );
    await assert.rejects(
      () => worm.recoverAndVerify(s3ClientWithBody(original, []), s3Cfg, Object.assign({}, record, {
        replica_object_version_id: ""
      })),
      (error) => error && error.code === "AWS_VERSION_MISSING"
    );

    primary = Buffer.from("tampered");
    const writesBeforeMismatch = primaryWrites;
    await assert.rejects(
      () => worker._test.restoreMissingPrimary(
        { url: "http://supabase.local", serviceKey: "test" },
        s3ClientWithBody(original, []), s3Cfg, record
      ),
      (error) => error && error.code === "PRIMARY_RESTORE_STATE_INVALID"
    );
    assert.strictEqual(primaryWrites, writesBeforeMismatch);
  } finally {
    supabase.fetchZOmejitvijo = originalFetch;
    supabase.pokliciRpc = originalRpc;
  }
}

main().then(function () {
  console.log("POS archive primary recovery tests passed.");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
