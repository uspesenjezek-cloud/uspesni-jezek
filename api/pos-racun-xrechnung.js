"use strict";

const crypto = require("crypto");
const supabase = require("./_lib/supabase-server");
const {
  GENERATOR_VERSION, XRECHNUNG_VERSION, KOSIT_VALIDATOR_VERSION, KOSIT_CONFIG_VERSION, buildXRechnung
} = require("./_lib/pos-xrechnung");

const BUCKET = "pos-einvoice-originals";
const MAX_REPORT_LENGTH = 65536;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}
function uuid(value) {
  const valueText = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valueText) ? valueText : "";
}
function objectPath(userId, invoiceId) { return userId + "/" + invoiceId + "/xrechnung.xml"; }
function encodedPath(path) { return path.split("/").map(encodeURIComponent).join("/"); }
function sha256(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
function validatorSettings(env) {
  const source = env || process.env;
  const rawUrl = String(source.KOSIT_VALIDATOR_URL || "").trim();
  const token = String(source.KOSIT_VALIDATOR_TOKEN || "").trim();
  if (!rawUrl) return { configured: false, message: "KoSIT validator še ni povezan." };
  let parsed;
  try { parsed = new URL(rawUrl); } catch (_) { return { configured: false, message: "KoSIT URL ni veljaven." }; }
  const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    return { configured: false, message: "KoSIT validator mora uporabljati HTTPS." };
  }
  if (token.length < 32) return { configured: false, message: "KoSIT dostopni token ni varno nastavljen." };
  return { configured: true, url: parsed.toString().replace(/\/+$/, ""), token };
}
function validatorConfigured() { return validatorSettings().configured; }

async function readInvoice(cfg, userId, invoiceId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_invoices", "id=eq." + encodeURIComponent(invoiceId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*");
  return rows.length === 1 ? rows[0] : null;
}
async function readDocument(cfg, userId, invoiceId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_einvoice_documents", "invoice_id=eq." + encodeURIComponent(invoiceId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*");
  return rows.length === 1 ? rows[0] : null;
}
async function invoiceIsCancelled(cfg, userId, invoiceId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_invoice_adjustments", "original_invoice_id=eq." + encodeURIComponent(invoiceId) + "&user_id=eq." + encodeURIComponent(userId) + "&adjustment_type=eq.cancellation&select=id&limit=1");
  return rows.length > 0;
}
async function downloadObject(cfg, path) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/storage/v1/object/" + BUCKET + "/" + encodedPath(path), {
    headers: supabase.serviceHeaders(cfg, { Accept: "application/xml" })
  }, 15000);
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw Object.assign(new Error("Arhiviranega XRechnung dokumenta ni bilo mogoče prebrati."), { status: response.status });
  return Buffer.from(await response.arrayBuffer());
}
async function uploadObject(cfg, path, xml) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/storage/v1/object/" + BUCKET + "/" + encodedPath(path), {
    method: "POST",
    headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/xml", "x-upsert": "false" }), body: xml
  }, 20000);
  if (response.ok) return true;
  if (response.status === 400 || response.status === 409) return false;
  throw Object.assign(new Error("XRechnung originala ni bilo mogoče arhivirati."), { status: response.status });
}
async function insertDocument(cfg, row) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_einvoice_documents", {
    method: "POST", headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }), body: JSON.stringify(row)
  }, 12000);
  if (response.ok) { const data = await response.json(); return Array.isArray(data) ? data[0] : data; }
  if (response.status === 409) return null;
  throw Object.assign(new Error("Metapodatkov XRechnung dokumenta ni bilo mogoče shraniti."), { status: response.status });
}
async function updateValidation(cfg, userId, documentId, result) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_einvoice_documents?id=eq." + encodeURIComponent(documentId) + "&user_id=eq." + encodeURIComponent(userId), {
    method: "PATCH",
    headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({
      validation_status: result.status, validator_name: "KoSIT", validator_version: KOSIT_VALIDATOR_VERSION,
      validator_config_version: KOSIT_CONFIG_VERSION, validation_report: result.report,
      validated_at: result.status === "validated" ? new Date().toISOString() : null, updated_at: new Date().toISOString()
    })
  }, 12000);
  if (!response.ok) throw Object.assign(new Error("Rezultata KoSIT validacije ni bilo mogoče shraniti."), { status: response.status });
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : rows;
}
async function insertValidationEvent(cfg, userId, documentId, result) {
  try {
    await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_einvoice_validation_events", {
      method: "POST", headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: userId, document_id: documentId, result: result.status, report: result.report })
    }, 8000);
  } catch (_) { /* trenutno stanje dokumenta je že shranjeno */ }
}
async function audit(cfg, userId, invoiceId, action, details) {
  try {
    await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_audit_events", {
      method: "POST", headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json" }),
      body: JSON.stringify({ user_id: userId, entity_type: "invoice", entity_id: invoiceId, action, details })
    }, 8000);
  } catch (_) { /* arhiviranje in validacija ostaneta veljavna */ }
}

function reportBody(body) { return String(body || "").slice(0, MAX_REPORT_LENGTH); }
async function validateWithKosit(xml, filename, env) {
  const settings = validatorSettings(env);
  if (!settings.configured) return { status: "pending", report: { configured: false, message: settings.message } };
  const url = settings.url + "/" + encodeURIComponent(filename || "xrechnung.xml");
  const headers = { "Content-Type": "application/xml", Accept: "application/xml, text/html;q=0.9" };
  headers.Authorization = "Bearer " + settings.token;
  try {
    const options = { method: "POST", headers, body: xml };
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") options.signal = AbortSignal.timeout(50000);
    const response = await supabase.fetchZOmejitvijo(url, options, 30000);
    const body = reportBody(await response.text());
    if (response.status === 200) return { status: "validated", report: { configured: true, httpStatus: 200, accepted: true, body } };
    if (response.status === 406) return { status: "failed", report: { configured: true, httpStatus: 406, accepted: false, body } };
    const message = response.status === 401 || response.status === 403
      ? "KoSIT validator je zavrnil strežniško prijavo."
      : "Validator trenutno ni vrnil dokončnega rezultata.";
    return { status: "pending", report: { configured: true, httpStatus: response.status, accepted: false, message, body } };
  } catch (error) {
    return { status: "pending", report: { configured: true, accepted: false, message: "KoSIT validator trenutno ni dosegljiv.", error: String(error && error.message || error).slice(0, 500) } };
  }
}

async function ensureDocument(cfg, invoice, userId) {
  let document = await readDocument(cfg, userId, invoice.id);
  let xml;
  if (document) {
    xml = await downloadObject(cfg, document.storage_path);
    if (!xml || sha256(xml) !== document.sha256) throw new Error("Arhivirani XRechnung ni prestal preverjanja celovitosti.");
    return { document, xml };
  }
  const path = objectPath(userId, invoice.id);
  xml = await downloadObject(cfg, path);
  if (!xml) {
    xml = buildXRechnung(invoice);
    if (xml.length > 2 * 1024 * 1024) throw new Error("Ustvarjeni XRechnung je nepričakovano prevelik.");
    const uploaded = await uploadObject(cfg, path, xml);
    if (!uploaded) xml = await downloadObject(cfg, path);
  }
  if (!xml) throw new Error("XRechnung originala ni bilo mogoče ustvariti.");
  const hash = sha256(xml);
  document = await insertDocument(cfg, {
    user_id: userId, invoice_id: invoice.id, storage_path: path, sha256: hash, byte_size: xml.length,
    media_type: "application/xml", generator_version: GENERATOR_VERSION, xrechnung_version: XRECHNUNG_VERSION,
    validation_status: "pending", validator_name: "KoSIT", validator_version: KOSIT_VALIDATOR_VERSION,
    validator_config_version: KOSIT_CONFIG_VERSION, validation_report: { configured: validatorConfigured() }
  });
  if (!document) document = await readDocument(cfg, userId, invoice.id);
  if (!document || document.sha256 !== hash) throw new Error("XRechnung je nastal, vendar njegova arhivska evidenca ni pravilna.");
  await audit(cfg, userId, invoice.id, "xrechnung_archived", { document_id: document.id, sha256: hash, generator_version: GENERATOR_VERSION, xrechnung_version: XRECHNUNG_VERSION });
  return { document, xml };
}
async function runValidation(cfg, userId, invoice, document, xml) {
  const result = await validateWithKosit(xml, invoice.invoice_number + "-XRechnung.xml");
  const updated = await updateValidation(cfg, userId, document.id, result);
  await insertValidationEvent(cfg, userId, document.id, result);
  await audit(cfg, userId, invoice.id, "xrechnung_validation_" + result.status, { document_id: document.id, validator_version: KOSIT_VALIDATOR_VERSION, config_version: KOSIT_CONFIG_VERSION });
  return updated;
}
function publicDocument(document) {
  const report = document.validation_report && typeof document.validation_report === "object" ? document.validation_report : {};
  const defaultMessage = document.validation_status === "validated" ? "KoSIT validacija uspešna."
    : document.validation_status === "failed" ? "KoSIT je dokument zavrnil." : "KoSIT validacija še čaka.";
  return {
    id: document.id, sha256: document.sha256, byteSize: document.byte_size, createdAt: document.created_at,
    generatorVersion: document.generator_version, xrechnungVersion: document.xrechnung_version,
    validationStatus: document.validation_status, validatorVersion: document.validator_version,
    validatorConfigVersion: document.validator_config_version, validatedAt: document.validated_at,
    validatorConfigured: validatorConfigured(), validationAccepted: report.accepted === true,
    validationHttpStatus: Number(report.httpStatus) || null,
    validationMessage: String(report.message || defaultMessage).slice(0, 240)
  };
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  let cfg;
  try { cfg = supabase.konfiguracija(); } catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  const invoiceId = uuid(req.query && req.query.invoiceId);
  const mode = String(req.query && req.query.mode || (req.method === "POST" ? "metadata" : "download"));
  if (!invoiceId) return json(res, 400, { ok: false, napaka: "Neveljaven račun." });
  try {
    const invoice = await readInvoice(cfg, auth.user.id, invoiceId);
    if (!invoice) return json(res, 404, { ok: false, napaka: "Račun ne obstaja ali ni vaš." });
    if (await invoiceIsCancelled(cfg, auth.user.id, invoiceId)) return json(res, 409, { ok: false, napaka: "Storniranega računa ni dovoljeno pripraviti za pošiljanje." });
    const result = await ensureDocument(cfg, invoice, auth.user.id);
    if (mode === "validate" || (req.method === "POST" && result.document.validation_status !== "validated")) {
      result.document = await runValidation(cfg, auth.user.id, invoice, result.document, result.xml);
    }
    if (req.method === "POST" || mode === "metadata" || mode === "validate") return json(res, 200, { ok: true, document: publicDocument(result.document) });
    const filename = String(invoice.invoice_number || "Rechnung").replace(/[^A-Za-z0-9._-]+/g, "-") + "-XRechnung.xml";
    res.status(200);
    res.setHeader("Content-Type", "application/xml; charset=utf-8"); res.setHeader("Content-Length", String(result.xml.length));
    res.setHeader("Cache-Control", "private, no-store, max-age=0"); res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    res.end(result.xml);
  } catch (error) {
    console.error("[pos-racun-xrechnung]", error && error.stack || error);
    json(res, Number(error && error.status) || 500, { ok: false, napaka: error && error.message || "XRechnung ni bil ustvarjen." });
  }
}

module.exports = handler;
module.exports._test = { uuid, objectPath, encodedPath, sha256, validatorSettings, validatorConfigured, reportBody, validateWithKosit, publicDocument, ensureDocument };
