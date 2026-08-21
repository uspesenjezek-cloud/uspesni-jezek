"use strict";

const supabase = require("../_lib/supabase-server");
const archive = require("../_lib/pos-archive");

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function uuid(value) {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : "";
}

async function recordsForUser(cfg, userId) {
  return supabase.pridobiVrstice(cfg, "pos_archive_records",
    "user_id=eq." + encodeURIComponent(userId) +
    "&select=id,user_id,invoice_id,document_kind,original_media_type,sha256,byte_size,storage_bucket,storage_path,archived_at,retention_not_before&order=archived_at.desc&limit=100");
}

async function eventsForUser(cfg, userId) {
  return supabase.pridobiVrstice(cfg, "pos_archive_integrity_events",
    "user_id=eq." + encodeURIComponent(userId) +
    "&select=archive_record_id,result,checked_at&order=checked_at.desc&limit=500");
}

function publicSummary(readiness, records, events) {
  const latestByRecord = Object.create(null);
  events.forEach(function (event) {
    if (!latestByRecord[event.archive_record_id]) latestByRecord[event.archive_record_id] = event;
  });
  const verified = records.filter(function (record) {
    return latestByRecord[record.id] && latestByRecord[record.id].result === "verified";
  }).length;
  const failures = records.filter(function (record) {
    return latestByRecord[record.id] && latestByRecord[record.id].result !== "verified";
  }).length;
  return {
    retentionYears: Number(readiness.retentionYears || 8),
    encryptionScope: readiness.encryptionScope || "provider_managed_at_rest",
    independentBackupReady: Boolean(readiness.independentBackupReady),
    recoveryTestedAt: readiness.recoveryTestedAt || null,
    productionReady: Boolean(readiness.productionReady),
    documentCount: records.length,
    verifiedCount: verified,
    uncheckedCount: records.length - verified - failures,
    failureCount: failures,
    earliestRetentionNotBefore: records.reduce(function (earliest, record) {
      return !earliest || record.retention_not_before < earliest ? record.retention_not_before : earliest;
    }, null),
    records: records.map(function (record) {
      const latest = latestByRecord[record.id] || null;
      return {
        id: record.id,
        invoiceId: record.invoice_id,
        documentKind: record.document_kind,
        mediaType: record.original_media_type,
        archivedAt: record.archived_at,
        retentionNotBefore: record.retention_not_before,
        integrity: latest ? latest.result : "unchecked",
        checkedAt: latest ? latest.checked_at : null
      };
    })
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
    let records = await recordsForUser(cfg, auth.user.id);
    if (req.method === "POST") {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const action = String(body.action || "verify-all");
      const archiveId = uuid(body.archiveId);
      const selected = action === "verify-one"
        ? records.filter(function (record) { return record.id === archiveId; })
        : records.slice(0, 25);
      if (action !== "verify-one" && action !== "verify-all") return json(res, 400, { ok: false, napaka: "Neveljavno arhivsko dejanje." });
      if (action === "verify-one" && selected.length !== 1) return json(res, 404, { ok: false, napaka: "Arhivski zapis ne obstaja ali ni vaš." });
      for (const record of selected) await archive.verifyAndRecord(cfg, record);
    }
    const values = await Promise.all([
      supabase.pokliciRpc(cfg, "pos_archive_readiness", {}),
      eventsForUser(cfg, auth.user.id)
    ]);
    records = await recordsForUser(cfg, auth.user.id);
    return json(res, 200, { ok: true, archive: publicSummary(values[0] || {}, records, values[1] || []) });
  } catch (error) {
    return json(res, Number(error && error.status || 500), { ok: false, napaka: error.message || "Arhiva ni bilo mogoče preveriti." });
  }
}

module.exports = handler;
module.exports._test = { publicSummary };
