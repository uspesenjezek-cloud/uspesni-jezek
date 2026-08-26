"use strict";

const crypto = require("crypto");
const supabase = require("../_lib/supabase-server");
const providerJson = require("../_lib/provider-json");
const requestQuery = require("../_lib/pos-request-query");
const { GENERATOR_VERSION, ustvariKorekcijskiPdf } = require("../_lib/pos-adjustment-pdf");

const BUCKET = "pos-invoice-originals";
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
}

function uuid(value) {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : "";
}

function objectPath(userId, adjustmentId) {
  return userId + "/adjustments/" + adjustmentId + "/korrektur.pdf";
}

function encodedPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function readAdjustment(cfg, userId, adjustmentId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_invoice_adjustments",
    "id=eq." + encodeURIComponent(adjustmentId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*");
  return rows.length === 1 ? rows[0] : null;
}

async function readDocument(cfg, userId, adjustmentId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_adjustment_documents",
    "adjustment_id=eq." + encodeURIComponent(adjustmentId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*");
  return rows.length === 1 ? rows[0] : null;
}

async function downloadObject(cfg, path) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/storage/v1/object/" + BUCKET + "/" + encodedPath(path), {
    headers: supabase.serviceHeaders(cfg, { Accept: "application/pdf" })
  }, 15000);
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error("Arhiviranega popravka ni bilo mogoče prebrati.");
  return providerJson.readBuffer(response, {
    maxBytes: MAX_PDF_BYTES,
    code: "POS_ADJUSTMENT_PDF_TOO_LARGE",
    message: "Arhivirani PDF popravka presega dovoljeno velikost."
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
  throw new Error("PDF popravka ni bilo mogoče arhivirati.");
}

async function insertDocument(cfg, row) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_adjustment_documents", {
    method: "POST",
    headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(row)
  }, 12000);
  if (response.ok) {
    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }
  if (response.status === 409) return null;
  throw new Error("Metapodatkov popravka ni bilo mogoče shraniti.");
}

async function audit(cfg, adjustment, userId, documentId, hash) {
  try {
    await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_audit_events", {
      method: "POST",
      headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        user_id: userId,
        entity_type: "invoice",
        entity_id: adjustment.original_invoice_id,
        action: "adjustment_pdf_archived",
        details: { adjustment_id: adjustment.id, document_id: documentId, sha256: hash, generator_version: GENERATOR_VERSION }
      })
    }, 8000);
  } catch (_) { /* arhivski dokument je veljaven tudi ce audit naknadno zacasno odpove */ }
}

async function ensureDocument(cfg, adjustment, userId) {
  let document = await readDocument(cfg, userId, adjustment.id);
  let pdf = null;
  if (document) {
    pdf = await downloadObject(cfg, document.storage_path);
    if (!pdf || sha256(pdf) !== document.sha256) throw new Error("Arhivirani popravek ni prestal preverjanja celovitosti.");
    return { document, pdf };
  }

  const path = objectPath(userId, adjustment.id);
  pdf = await downloadObject(cfg, path);
  if (!pdf) {
    pdf = await ustvariKorekcijskiPdf(adjustment);
    if (pdf.length > 5 * 1024 * 1024) throw new Error("Ustvarjeni popravek je nepričakovano prevelik.");
    const uploaded = await uploadObject(cfg, path, pdf);
    if (!uploaded) pdf = await downloadObject(cfg, path);
  }
  if (!pdf) throw new Error("PDF popravka ni bilo mogoče ustvariti.");

  const hash = sha256(pdf);
  document = await insertDocument(cfg, {
    user_id: userId,
    adjustment_id: adjustment.id,
    storage_path: path,
    sha256: hash,
    byte_size: pdf.length,
    media_type: "application/pdf",
    generator_version: GENERATOR_VERSION
  });
  if (!document) document = await readDocument(cfg, userId, adjustment.id);
  if (!document || document.sha256 !== hash) throw new Error("Popravek je nastal, vendar njegova arhivska evidenca ni pravilna.");
  await audit(cfg, adjustment, userId, document.id, hash);
  return { document, pdf };
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }

  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  const query = requestQuery(req);
  const adjustmentId = uuid(query.adjustmentId);
  if (!adjustmentId) return json(res, 400, { ok: false, napaka: "Neveljaven popravek." });

  try {
    const adjustment = await readAdjustment(cfg, auth.user.id, adjustmentId);
    if (!adjustment) return json(res, 404, { ok: false, napaka: "Popravek ne obstaja ali ni vaš." });
    const result = await ensureDocument(cfg, adjustment, auth.user.id);
    if (req.method === "POST" || String(query.mode) === "metadata") {
      return json(res, 200, { ok: true, document: {
        id: result.document.id,
        sha256: result.document.sha256,
        byteSize: result.document.byte_size,
        createdAt: result.document.created_at,
        generatorVersion: result.document.generator_version
      } });
    }
    const filename = String(adjustment.adjustment_number || "Korrektur").replace(/[^A-Za-z0-9._-]+/g, "-") + ".pdf";
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(result.pdf.length));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    res.end(result.pdf);
  } catch (error) {
    console.error("[pos-racun-korekcija]", error && error.stack || error);
    json(res, 500, { ok: false, napaka: error && error.message || "Popravek ni bil ustvarjen." });
  }
}

module.exports = handler;
module.exports._test = { uuid, objectPath, encodedPath, sha256, ensureDocument };
