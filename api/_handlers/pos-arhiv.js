"use strict";

const supabase = require("../_lib/supabase-server");
const archive = require("../_lib/pos-archive");

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
}

function uuid(value) {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : "";
}

async function integrityBatchForUser(cfg, userId, limit) {
  const rows = await supabase.pokliciRpc(cfg, "pos_archive_user_integrity_batch", {
    p_user_id: userId,
    p_limit: Math.min(Math.max(Number(limit) || 10, 1), 25)
  });
  return Array.isArray(rows) ? rows : [];
}

async function recordForUser(cfg, userId, archiveId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_archive_records",
    "user_id=eq." + encodeURIComponent(userId) +
    "&id=eq." + encodeURIComponent(archiveId) +
    "&select=id,user_id,invoice_id,document_kind,original_media_type,sha256,byte_size,storage_bucket,storage_path,archived_at,retention_not_before&limit=1");
  return rows.length === 1 ? rows[0] : null;
}

async function verifyRecords(cfg, records) {
  await Promise.all((records || []).map(function (record) {
    return archive.verifyAndRecord(cfg, record);
  }));
  return (records || []).length;
}

function publicSummary(readiness, records, events, replicas) {
  const latestByRecord = Object.create(null);
  const replicaByRecord = Object.create(null);
  events.forEach(function (event) {
    if (!latestByRecord[event.archive_record_id]) latestByRecord[event.archive_record_id] = event;
  });
  (replicas || []).forEach(function (replica) {
    if (!replicaByRecord[replica.archive_record_id]) replicaByRecord[replica.archive_record_id] = replica;
  });
  const verified = records.filter(function (record) {
    return latestByRecord[record.id] && latestByRecord[record.id].result === "verified";
  }).length;
  const failures = records.filter(function (record) {
    return latestByRecord[record.id] && latestByRecord[record.id].result !== "verified";
  }).length;
  const replicated = records.filter(function (record) {
    return replicaByRecord[record.id] && replicaByRecord[record.id].status === "verified";
  }).length;
  const replicaFailures = records.filter(function (record) {
    return replicaByRecord[record.id] && replicaByRecord[record.id].status === "failed";
  }).length;
  return {
    retentionYears: Number(readiness.retentionYears || 8),
    encryptionScope: readiness.encryptionScope || "provider_managed_at_rest",
    independentBackupReady: Boolean(readiness.independentBackupReady),
    recoveryTestedAt: readiness.recoveryTestedAt || null,
    wormProvider: readiness.wormProvider || "aws_s3_object_lock",
    wormEnvironment: readiness.wormEnvironment || "not_configured",
    objectLockMode: readiness.objectLockMode || null,
    wormProviderReady: Boolean(readiness.wormProviderReady),
    wormConnectivityTestedAt: readiness.wormConnectivityTestedAt || null,
    productionReady: Boolean(readiness.productionReady),
    documentCount: records.length,
    verifiedCount: verified,
    uncheckedCount: records.length - verified - failures,
    failureCount: failures,
    replicatedCount: replicated,
    replicaPendingCount: records.length - replicated - replicaFailures,
    replicaFailureCount: replicaFailures,
    earliestRetentionNotBefore: records.reduce(function (earliest, record) {
      return !earliest || record.retention_not_before < earliest ? record.retention_not_before : earliest;
    }, null),
    records: records.map(function (record) {
      const latest = latestByRecord[record.id] || null;
      const replica = replicaByRecord[record.id] || null;
      return {
        id: record.id,
        invoiceId: record.invoice_id,
        documentKind: record.document_kind,
        mediaType: record.original_media_type,
        archivedAt: record.archived_at,
        retentionNotBefore: record.retention_not_before,
        integrity: latest ? latest.result : "unchecked",
        checkedAt: latest ? latest.checked_at : null,
        replicaStatus: replica ? replica.status : "pending",
        objectLockMode: replica ? replica.object_lock_mode : null,
        replicaRetainUntil: replica ? replica.retain_until : null,
        replicaVerifiedAt: replica ? replica.verified_at : null,
        replicaErrorCode: replica ? replica.last_error_code : null
      };
    })
  };
}

function publicDatabaseSummary(readiness, totals) {
  const summary = totals && typeof totals === "object" ? totals : {};
  return {
    retentionYears: Number(readiness.retentionYears || 8),
    encryptionScope: readiness.encryptionScope || "provider_managed_at_rest",
    independentBackupReady: Boolean(readiness.independentBackupReady),
    recoveryTestedAt: readiness.recoveryTestedAt || null,
    wormProvider: readiness.wormProvider || "aws_s3_object_lock",
    wormEnvironment: readiness.wormEnvironment || "not_configured",
    objectLockMode: readiness.objectLockMode || null,
    wormProviderReady: Boolean(readiness.wormProviderReady),
    wormConnectivityTestedAt: readiness.wormConnectivityTestedAt || null,
    productionReady: Boolean(readiness.productionReady),
    documentCount: Number(summary.documentCount || 0),
    verifiedCount: Number(summary.verifiedCount || 0),
    uncheckedCount: Number(summary.uncheckedCount || 0),
    failureCount: Number(summary.failureCount || 0),
    replicatedCount: Number(summary.replicatedCount || 0),
    replicaPendingCount: Number(summary.replicaPendingCount || 0),
    replicaFailureCount: Number(summary.replicaFailureCount || 0),
    earliestRetentionNotBefore: summary.earliestRetentionNotBefore || null,
    records: []
  };
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });

  try {
    let checkedNow = 0;
    if (req.method === "POST") {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const action = String(body.action || "verify-all");
      const archiveId = uuid(body.archiveId);
      if (action !== "verify-one" && action !== "verify-all") return json(res, 400, { ok: false, napaka: "Neveljavno arhivsko dejanje." });
      const selectedRecord = action === "verify-one" && archiveId
        ? await recordForUser(cfg, auth.user.id, archiveId)
        : null;
      const selected = action === "verify-one"
        ? (selectedRecord ? [selectedRecord] : [])
        : await integrityBatchForUser(cfg, auth.user.id, 10);
      if (action === "verify-one" && selected.length !== 1) return json(res, 404, { ok: false, napaka: "Arhivski zapis ne obstaja ali ni vaš." });
      checkedNow = await verifyRecords(cfg, selected);
    }
    const values = await Promise.all([
      supabase.pokliciRpc(cfg, "pos_archive_readiness", {}),
      supabase.pokliciRpc(cfg, "pos_archive_user_summary", { p_user_id: auth.user.id })
    ]);
    return json(res, 200, { ok: true, archive: Object.assign(publicDatabaseSummary(values[0] || {}, values[1] || {}), { checkedNow }) });
  } catch (error) {
    return json(res, Number(error && error.status || 500), { ok: false, napaka: error.message || "Arhiva ni bilo mogoče preveriti." });
  }
}

module.exports = handler;
module.exports._test = { publicSummary, publicDatabaseSummary, integrityBatchForUser, verifyRecords };
