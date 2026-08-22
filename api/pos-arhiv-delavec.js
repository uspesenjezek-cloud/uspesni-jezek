"use strict";

const crypto = require("crypto");
const supabase = require("./_lib/supabase-server");
const archive = require("./_lib/pos-archive");
const worm = require("./_lib/pos-worm-archive");
const invoiceDocuments = require("./_handlers/pos-racun-pdf")._test;
const adjustmentDocuments = require("./_handlers/pos-racun-korekcija")._test;
const adjustmentEinvoiceDocuments = require("./_handlers/pos-racun-korekcija-xrechnung")._test;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

async function repairMissingDocuments(cfg, limit) {
  const candidates = await supabase.pokliciRpc(cfg, "pos_archive_missing_document_batch", {
    p_limit: Math.min(Math.max(Number(limit) || 2, 1), 10)
  });
  const counts = { repaired: 0, failed: 0 };
  for (const candidate of (Array.isArray(candidates) ? candidates : [])) {
    try {
      const table = candidate && candidate.source_table;
      const sourceId = candidate && candidate.source_id;
      const userId = candidate && candidate.user_id;
      if (!sourceId || !userId || !["pos_invoices", "pos_invoice_adjustments", "pos_invoice_adjustment_xrechnung"].includes(table)) {
        throw Object.assign(new Error("Neveljaven kandidat za obnovo dokumenta."), { code: "INVALID_REPAIR_CANDIDATE" });
      }
      const sourceTable = table === "pos_invoice_adjustment_xrechnung" ? "pos_invoice_adjustments" : table;
      const rows = await supabase.pridobiVrstice(cfg, sourceTable,
        "id=eq." + encodeURIComponent(sourceId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*&limit=1");
      if (!rows[0]) throw Object.assign(new Error("Izvorni POS zapis ne obstaja."), { code: "REPAIR_SOURCE_MISSING" });
      if (table === "pos_invoices") await invoiceDocuments.ensureDocument(cfg, rows[0], userId);
      else if (table === "pos_invoice_adjustments") await adjustmentDocuments.ensureDocument(cfg, rows[0], userId);
      else await adjustmentEinvoiceDocuments.ensureDocument(cfg, rows[0], userId);
      counts.repaired += 1;
    } catch (error) {
      console.error("[pos-archive-document-repair]", worm.safeErrorCode(error));
      counts.failed += 1;
    }
  }
  return counts;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false });
  const expected = String(process.env.CRON_SECRET || "");
  const provided = String(req.headers && req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(provided, expected)) return json(res, 401, { ok: false });
  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }

  try {
    const documentCounts = await repairMissingDocuments(cfg, 2);
    const rows = await supabase.pokliciRpc(cfg, "pos_archive_integrity_batch", { p_limit: 10 });
    const counts = { verified: 0, failed: 0 };
    const integrityResults = await Promise.all((Array.isArray(rows) ? rows : []).map(function (record) {
      return archive.verifyAndRecord(cfg, record);
    }));
    for (const result of integrityResults) {
      if (result.verification.result === "verified") counts.verified += 1;
      else counts.failed += 1;
    }

    let replicaRows = [];
    const replicaCounts = { verified: 0, failed: 0 };
    let s3Cfg = null;
    let s3Client = null;
    let bucketError = null;
    let replicaSkipped = false;
    let needsRecoveryTest = false;
    try {
      s3Cfg = worm.configuration();
      if (!s3Cfg.configured) {
        replicaSkipped = true;
      } else {
        s3Client = worm.makeClient(s3Cfg);
        await worm.verifyBucketObjectLock(s3Client, s3Cfg);
        const heartbeat = await supabase.pokliciRpc(cfg, "pos_archive_provider_heartbeat", {
          p_environment: s3Cfg.liveEnabled ? "production" : "test",
          p_object_lock_mode: s3Cfg.liveEnabled ? "COMPLIANCE" : "GOVERNANCE",
          p_recovery_tested: false
        });
        const lastRecovery = heartbeat && heartbeat.recoveryTestedAt ? new Date(heartbeat.recoveryTestedAt) : null;
        needsRecoveryTest = !lastRecovery || Number.isNaN(lastRecovery.getTime()) || lastRecovery.getTime() < Date.now() - 90 * 86400000;
      }
    } catch (error) {
      bucketError = error;
      try {
        await supabase.pokliciRpc(cfg, "pos_archive_provider_fail", { p_error_code: worm.safeErrorCode(error) });
      } catch (_ignored) {}
    }

    if (!replicaSkipped && !bucketError) {
      try {
        replicaRows = await supabase.pokliciRpc(cfg, "pos_archive_replica_batch", { p_limit: 10 });
      } catch (error) {
        if (s3Client) s3Client.destroy();
        throw error;
      }
    }

    for (const record of (Array.isArray(replicaRows) ? replicaRows : [])) {
      try {
        const buffer = await archive.readObject(cfg, record);
        if (!buffer) throw Object.assign(new Error("Arhivirani izvirnik manjka."), { code: "SOURCE_OBJECT_MISSING" });
        const result = await worm.copyAndVerify(s3Client, s3Cfg, record, buffer);
        await supabase.pokliciRpc(cfg, "pos_archive_replica_complete", {
          p_replica_id: record.replica_id,
          p_bucket: result.bucket,
          p_object_key: result.objectKey,
          p_object_version_id: result.objectVersionId,
          p_object_etag: result.objectEtag,
          p_remote_checksum_sha256: result.remoteChecksumSha256,
          p_remote_byte_size: result.remoteByteSize,
          p_object_lock_mode: result.objectLockMode,
          p_retain_until: result.retainUntil
        });
        const expectedRecoveryMode = s3Cfg.liveEnabled ? "COMPLIANCE" : "GOVERNANCE";
        if (needsRecoveryTest && result.objectLockMode === expectedRecoveryMode) {
          await worm.recoverAndVerify(s3Client, s3Cfg, Object.assign({}, record, {
            replica_bucket: result.bucket,
            replica_object_key: result.objectKey,
            replica_object_version_id: result.objectVersionId
          }));
          await supabase.pokliciRpc(cfg, "pos_archive_provider_heartbeat", {
            p_environment: s3Cfg.liveEnabled ? "production" : "test",
            p_object_lock_mode: s3Cfg.liveEnabled ? "COMPLIANCE" : "GOVERNANCE",
            p_recovery_tested: true
          });
          needsRecoveryTest = false;
        }
        replicaCounts.verified += 1;
      } catch (error) {
        await supabase.pokliciRpc(cfg, "pos_archive_replica_fail", {
          p_replica_id: record.replica_id,
          p_error_code: worm.safeErrorCode(error)
        });
        try {
          await supabase.pokliciRpc(cfg, "pos_archive_provider_fail", { p_error_code: worm.safeErrorCode(error) });
        } catch (_ignored) {}
        replicaCounts.failed += 1;
      }
    }
    if (s3Client) s3Client.destroy();

    const providerFailed = Boolean(bucketError);
    const failed = documentCounts.failed + counts.failed + replicaCounts.failed + (providerFailed ? 1 : 0);
    return json(res, failed ? 409 : 200, {
      ok: failed === 0,
      documents: { checked: documentCounts.repaired + documentCounts.failed, counts: documentCounts },
      integrity: { checked: counts.verified + counts.failed, counts: counts },
      replicas: {
        checked: replicaCounts.verified + replicaCounts.failed,
        counts: replicaCounts,
        skipped: replicaSkipped,
        providerErrorCode: providerFailed ? worm.safeErrorCode(bucketError) : null
      }
    });
  } catch (error) {
    return json(res, Number(error && error.status || 500), { ok: false, napaka: "Periodično preverjanje arhiva ni uspelo." });
  }
};

module.exports._test = { repairMissingDocuments, safeEqual };
