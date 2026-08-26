"use strict";

const crypto = require("crypto");
const supabase = require("../_lib/supabase-server");
const providerJson = require("../_lib/provider-json");
const requestQuery = require("../_lib/pos-request-query");
const adjustmentXRechnung = require("../_lib/pos-adjustment-xrechnung");
const xrechnung = require("../_lib/pos-xrechnung");
const invoiceXRechnung = require("./pos-racun-xrechnung")._test;

const BUCKET = "pos-einvoice-originals";
const MAX_XML_BYTES = 2 * 1024 * 1024;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
}
function uuid(value) {
  const valueText = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valueText) ? valueText : "";
}
function objectPath(userId, adjustmentId) { return userId + "/adjustments/" + adjustmentId + "/xrechnung.xml"; }
function encodedPath(path) { return path.split("/").map(encodeURIComponent).join("/"); }
function sha256(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }

async function readAdjustment(cfg, userId, adjustmentId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_invoice_adjustments",
    "id=eq." + encodeURIComponent(adjustmentId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*");
  return rows.length === 1 ? rows[0] : null;
}
async function readDocument(cfg, userId, adjustmentId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_adjustment_einvoice_documents",
    "adjustment_id=eq." + encodeURIComponent(adjustmentId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*");
  return rows.length === 1 ? rows[0] : null;
}
async function downloadObject(cfg, path) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/storage/v1/object/" + BUCKET + "/" + encodedPath(path), {
    headers: supabase.serviceHeaders(cfg, { Accept: "application/xml" })
  }, 15000);
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw Object.assign(new Error("Arhiviranega strukturiranega popravka ni bilo mogoče prebrati."), { status: response.status });
  return providerJson.readBuffer(response, {
    maxBytes: MAX_XML_BYTES, code: "POS_ADJUSTMENT_XRECHNUNG_TOO_LARGE",
    message: "Arhivirani strukturirani popravek presega dovoljeno velikost."
  });
}
async function uploadObject(cfg, path, xml) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/storage/v1/object/" + BUCKET + "/" + encodedPath(path), {
    method: "POST", headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/xml", "x-upsert": "false" }), body: xml
  }, 20000);
  if (response.ok) return true;
  if (response.status === 400 || response.status === 409) return false;
  throw Object.assign(new Error("Strukturiranega popravka ni bilo mogoče arhivirati."), { status: response.status });
}
async function insertDocument(cfg, row) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_adjustment_einvoice_documents", {
    method: "POST", headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(row)
  }, 12000);
  if (response.ok) { const data = await response.json(); return Array.isArray(data) ? data[0] : data; }
  if (response.status === 409) return null;
  throw Object.assign(new Error("Metapodatkov strukturiranega popravka ni bilo mogoče shraniti."), { status: response.status });
}
async function updateValidation(cfg, userId, documentId, result) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_adjustment_einvoice_documents?id=eq." + encodeURIComponent(documentId) + "&user_id=eq." + encodeURIComponent(userId), {
    method: "PATCH", headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({
      validation_status: result.status, validator_name: "KoSIT", validator_version: xrechnung.KOSIT_VALIDATOR_VERSION,
      validator_config_version: xrechnung.KOSIT_CONFIG_VERSION, validation_report: result.report,
      validated_at: result.status === "validated" ? new Date().toISOString() : null, updated_at: new Date().toISOString()
    })
  }, 12000);
  if (!response.ok) throw Object.assign(new Error("KoSIT rezultata strukturiranega popravka ni bilo mogoče shraniti."), { status: response.status });
  const rows = await response.json(); return Array.isArray(rows) ? rows[0] : rows;
}
async function insertValidationEvent(cfg, userId, documentId, result) {
  try {
    await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_adjustment_einvoice_validation_events", {
      method: "POST", headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: userId, document_id: documentId, result: result.status, report: result.report })
    }, 8000);
  } catch (_) { /* trenutno stanje dokumenta je že shranjeno */ }
}
async function audit(cfg, userId, adjustment, action, details) {
  try {
    await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_audit_events", {
      method: "POST", headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: userId, entity_type: "invoice", entity_id: adjustment.original_invoice_id, action, details })
    }, 8000);
  } catch (_) { /* arhiviranje in validacija ostaneta veljavna */ }
}

async function ensureDocument(cfg, adjustment, userId) {
  let document = await readDocument(cfg, userId, adjustment.id);
  let xml;
  if (document) {
    xml = await downloadObject(cfg, document.storage_path);
    if (!xml || sha256(xml) !== document.sha256) throw new Error("Arhivirani strukturirani popravek ni prestal preverjanja celovitosti.");
    return { document, xml };
  }
  const path = objectPath(userId, adjustment.id);
  xml = await downloadObject(cfg, path);
  if (!xml) {
    xml = adjustmentXRechnung.buildAdjustmentXRechnung(adjustment);
    if (xml.length > MAX_XML_BYTES) throw new Error("Ustvarjeni strukturirani popravek je nepričakovano prevelik.");
    const uploaded = await uploadObject(cfg, path, xml);
    if (!uploaded) xml = await downloadObject(cfg, path);
  }
  if (!xml) throw new Error("Strukturiranega popravka ni bilo mogoče ustvariti.");
  const hash = sha256(xml);
  document = await insertDocument(cfg, {
    user_id: userId, adjustment_id: adjustment.id, storage_path: path, sha256: hash, byte_size: xml.length,
    media_type: "application/xml", generator_version: adjustmentXRechnung.GENERATOR_VERSION,
    xrechnung_version: adjustmentXRechnung.XRECHNUNG_VERSION, validation_status: "pending", validator_name: "KoSIT",
    validator_version: xrechnung.KOSIT_VALIDATOR_VERSION, validator_config_version: xrechnung.KOSIT_CONFIG_VERSION,
    validation_report: { configured: invoiceXRechnung.validatorConfigured() }
  });
  if (!document) document = await readDocument(cfg, userId, adjustment.id);
  if (!document || document.sha256 !== hash) throw new Error("Strukturirani popravek je nastal, vendar njegova arhivska evidenca ni pravilna.");
  await audit(cfg, userId, adjustment, "adjustment_xrechnung_archived", { document_id: document.id, sha256: hash, generator_version: adjustmentXRechnung.GENERATOR_VERSION });
  return { document, xml };
}
async function runValidation(cfg, userId, adjustment, document, xml) {
  const result = await invoiceXRechnung.validateWithKosit(xml, adjustment.adjustment_number + "-XRechnung.xml");
  const updated = await updateValidation(cfg, userId, document.id, result);
  await insertValidationEvent(cfg, userId, document.id, result);
  await audit(cfg, userId, adjustment, "adjustment_xrechnung_validation_" + result.status, { document_id: document.id, validator_version: xrechnung.KOSIT_VALIDATOR_VERSION, config_version: xrechnung.KOSIT_CONFIG_VERSION });
  return updated;
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  let cfg;
  try { cfg = supabase.konfiguracija(); } catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  const query = requestQuery(req);
  const adjustmentId = uuid(query.adjustmentId);
  const mode = String(query.mode || (req.method === "POST" ? "metadata" : "download"));
  if (!adjustmentId) return json(res, 400, { ok: false, napaka: "Neveljaven popravek." });
  try {
    const adjustment = await readAdjustment(cfg, auth.user.id, adjustmentId);
    if (!adjustment) return json(res, 404, { ok: false, napaka: "Popravek ne obstaja ali ni vaš." });
    const result = await ensureDocument(cfg, adjustment, auth.user.id);
    if (mode === "validate" || (req.method === "POST" && result.document.validation_status !== "validated")) {
      result.document = await runValidation(cfg, auth.user.id, adjustment, result.document, result.xml);
    }
    if (req.method === "POST" || mode === "metadata" || mode === "validate") {
      return json(res, 200, { ok: true, document: invoiceXRechnung.publicDocument(result.document) });
    }
    const filename = String(adjustment.adjustment_number || "Korrektur").replace(/[^A-Za-z0-9._-]+/g, "-") + "-XRechnung.xml";
    res.status(200).setHeader("Content-Type", "application/xml; charset=utf-8")
      .setHeader("Content-Length", String(result.xml.length)).setHeader("Cache-Control", "private, no-store, max-age=0")
      .setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"").end(result.xml);
  } catch (error) {
    console.error("[pos-racun-korekcija-xrechnung]", error && error.stack || error);
    json(res, Number(error && error.status) || 500, { ok: false, napaka: error && error.message || "Strukturirani popravek ni bil ustvarjen." });
  }
}

module.exports = handler;
module.exports._test = { uuid, objectPath, encodedPath, sha256, ensureDocument };
