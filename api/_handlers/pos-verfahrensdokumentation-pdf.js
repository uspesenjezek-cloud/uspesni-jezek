"use strict";

const crypto = require("crypto");
const supabase = require("../_lib/supabase-server");
const providerJson = require("../_lib/provider-json");
const requestQuery = require("../_lib/pos-request-query");
const { GENERATOR_VERSION, createProcedureDocumentationPdf } = require("../_lib/pos-procedure-documentation-pdf");

const BUCKET = "pos-procedure-documents";
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
}

function safeFilename(value) {
  return String(value || "Unternehmen").normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "Unternehmen";
}

function uuid(value) {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : "";
}

function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(function (key) {
    return JSON.stringify(key) + ":" + stableJson(value[key]);
  }).join(",") + "}";
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sourceFingerprint(model) {
  return sha256(Buffer.from(stableJson({
    profile: model.profile, archive: model.archive, environment: model.environment,
    appVersion: model.appVersion, generatorVersion: GENERATOR_VERSION
  }), "utf8"));
}

function objectPath(userId, fingerprint) {
  return userId + "/" + fingerprint + ".pdf";
}

function encodedPath(value) {
  return String(value || "").split("/").map(encodeURIComponent).join("/");
}

async function readVersion(cfg, userId, fingerprint) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_procedure_document_versions",
    "user_id=eq." + encodeURIComponent(userId) + "&source_fingerprint=eq." + encodeURIComponent(fingerprint) + "&select=*&limit=1");
  return rows[0] || null;
}

async function readVersionById(cfg, userId, versionId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_procedure_document_versions",
    "id=eq." + encodeURIComponent(versionId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*&limit=1");
  return rows[0] || null;
}

async function listVersions(cfg, userId) {
  return supabase.pridobiVrstice(cfg, "pos_procedure_document_versions",
    "user_id=eq." + encodeURIComponent(userId) + "&select=id,version_number,sha256,byte_size,generator_version,created_at,retention_not_before&order=version_number.desc&limit=100");
}

async function downloadObject(cfg, path) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/storage/v1/object/" + BUCKET + "/" + encodedPath(path), {
    headers: supabase.serviceHeaders(cfg, { Accept: "application/pdf" })
  }, 15000);
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) throw Object.assign(new Error("Arhivirane Verfahrensdokumentation ni bilo mogoče prebrati."), { status: response.status });
  return providerJson.readBuffer(response, {
    maxBytes: MAX_PDF_BYTES, code: "POS_PROCEDURE_PDF_TOO_LARGE",
    message: "Arhivirana Verfahrensdokumentation presega dovoljeno velikost."
  });
}

async function uploadObject(cfg, path, pdf) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/storage/v1/object/" + BUCKET + "/" + encodedPath(path), {
    method: "POST",
    headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/pdf", "x-upsert": "false" }),
    body: pdf
  }, 20000);
  if (response.ok) return true;
  if (response.status === 400 || response.status === 409) return false;
  throw Object.assign(new Error("Verfahrensdokumentation ni bilo mogoče arhivirati."), { status: response.status });
}

async function archiveVersion(cfg, userId, fingerprint, path, pdf, model) {
  return supabase.pokliciRpc(cfg, "pos_archive_procedure_document_version", {
    p_user_id: userId, p_source_fingerprint: fingerprint, p_storage_path: path,
    p_sha256: sha256(pdf), p_byte_size: pdf.length, p_generator_version: GENERATOR_VERSION,
    p_profile_snapshot: model.profile, p_archive_snapshot: model.archive, p_environment: model.environment
  });
}

async function ensureVersion(cfg, userId, model) {
  const fingerprint = sourceFingerprint(model);
  let version = await readVersion(cfg, userId, fingerprint);
  let pdf;
  if (version) {
    pdf = await downloadObject(cfg, version.storage_path);
    if (!pdf || pdf.length !== Number(version.byte_size) || sha256(pdf) !== version.sha256) {
      throw new Error("Arhivirana Verfahrensdokumentation ni prestala preverjanja celovitosti.");
    }
    return { version, pdf };
  }

  const path = objectPath(userId, fingerprint);
  pdf = await downloadObject(cfg, path);
  if (!pdf) {
    pdf = await createProcedureDocumentationPdf(model);
    if (pdf.length > MAX_PDF_BYTES) throw new Error("Ustvarjena Verfahrensdokumentation je nepričakovano prevelika.");
    const uploaded = await uploadObject(cfg, path, pdf);
    if (!uploaded) pdf = await downloadObject(cfg, path);
  }
  if (!pdf) throw new Error("Verfahrensdokumentation ni bilo mogoče ustvariti.");

  version = await archiveVersion(cfg, userId, fingerprint, path, pdf, model);
  version = Array.isArray(version) ? version[0] : version;
  if (!version) version = await readVersion(cfg, userId, fingerprint);
  const archivedPdf = await downloadObject(cfg, version && version.storage_path);
  if (!version || !archivedPdf || archivedPdf.length !== Number(version.byte_size) || sha256(archivedPdf) !== version.sha256) {
    throw new Error("Verfahrensdokumentation je nastala, vendar njena arhivska evidenca ni pravilna.");
  }
  return { version, pdf: archivedPdf };
}

async function loadModel(cfg, userId) {
  const values = await Promise.all([
    supabase.pridobiVrstice(cfg, "pos_business_profiles", "user_id=eq." + encodeURIComponent(userId) + "&select=*&limit=1"),
    supabase.pokliciRpc(cfg, "pos_archive_readiness", {}),
    supabase.pokliciRpc(cfg, "pos_archive_user_summary", { p_user_id: userId })
  ]);
  const profile = values[0] && values[0][0];
  if (!profile) throw Object.assign(new Error("Najprej shranite podatke podjetja."), { status: 409 });
  return {
    profile,
    archive: Object.assign({}, values[1] || {}, values[2] || {}),
    generatedAt: new Date(),
    environment: process.env.VERCEL_ENV === "production" ? "production" : "test",
    appVersion: GENERATOR_VERSION
  };
}

async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  const query = requestQuery(req);
  try {
    if (String(query.mode || "") === "list") {
      const versions = await listVersions(cfg, auth.user.id);
      return json(res, 200, { ok: true, versions: versions.map(function (version) {
        return {
          id: version.id, versionNumber: version.version_number, sha256: version.sha256,
          byteSize: version.byte_size, generatorVersion: version.generator_version,
          createdAt: version.created_at, retentionNotBefore: version.retention_not_before
        };
      }) });
    }
    const requestedVersionId = uuid(query.versionId);
    if (query.versionId && !requestedVersionId) return json(res, 400, { ok: false, napaka: "Neveljavna različica dokumenta." });
    let model = null;
    let result;
    if (requestedVersionId) {
      const version = await readVersionById(cfg, auth.user.id, requestedVersionId);
      if (!version) return json(res, 404, { ok: false, napaka: "Različica dokumenta ne obstaja ali ni vaša." });
      const archivedPdf = await downloadObject(cfg, version.storage_path);
      if (!archivedPdf || archivedPdf.length !== Number(version.byte_size) || sha256(archivedPdf) !== version.sha256) {
        throw new Error("Arhivirana Verfahrensdokumentation ni prestala preverjanja celovitosti.");
      }
      result = { version: version, pdf: archivedPdf };
    } else {
      model = await loadModel(cfg, auth.user.id);
      result = await ensureVersion(cfg, auth.user.id, model);
    }
    const pdf = result.pdf;
    const filename = safeFilename(model && model.profile.legal_name) + "-Verfahrensdokumentation-v" + result.version.version_number + ".pdf";
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    res.setHeader("X-UJ-Document-Version", String(result.version.version_number));
    res.setHeader("X-UJ-Document-SHA256", result.version.sha256);
    res.setHeader("X-UJ-Retention-Not-Before", result.version.retention_not_before);
    res.end(pdf);
  } catch (error) {
    console.error("[pos-verfahrensdokumentation-pdf]", error && error.stack || error);
    return json(res, Number(error && error.status || 500), { ok: false, napaka: error && error.message || "Verfahrensdokumentation ni bilo mogoče ustvariti." });
  }
}

module.exports = handler;
module.exports._test = { safeFilename, uuid, stableJson, sha256, sourceFingerprint, objectPath, encodedPath, readVersionById, listVersions, loadModel, ensureVersion };
