"use strict";

const crypto = require("crypto");
const supabase = require("../_lib/supabase-server");
const providerJson = require("../_lib/provider-json");
const requestQuery = require("../_lib/pos-request-query");
const pdfCapacity = require("../_lib/runtime-capacity").sharedGate("pos-pdf-generation", {
  maxActive: 2, maxQueue: 32, waitTimeoutMs: 8000, retryAfterMs: 1500,
  busyMessage: "Ustvarjanje PDF-jev je trenutno zasedeno. Poskusite znova čez trenutek."
});
const { GENERATOR_VERSION, ustvariRacunPdf } = require("../_lib/pos-pdf");

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

function objectPath(userId, invoiceId) {
  return userId + "/" + invoiceId + "/rechnung.pdf";
}

function encodedPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function readInvoice(cfg, userId, invoiceId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_invoices",
    "id=eq." + encodeURIComponent(invoiceId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*");
  return rows.length === 1 ? rows[0] : null;
}

async function readDocument(cfg, userId, invoiceId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_invoice_documents",
    "invoice_id=eq." + encodeURIComponent(invoiceId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*");
  return rows.length === 1 ? rows[0] : null;
}

async function downloadObject(cfg, path) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/storage/v1/object/" + BUCKET + "/" + encodedPath(path), {
    headers: supabase.serviceHeaders(cfg, { Accept: "application/pdf" })
  }, 15000);
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) {
    const error = new Error("Arhiviranega dokumenta ni bilo mogoče prebrati.");
    error.status = response.status;
    throw error;
  }
  return providerJson.readBuffer(response, {
    maxBytes: MAX_PDF_BYTES,
    code: "POS_PDF_ORIGINAL_TOO_LARGE",
    message: "Arhivirani PDF presega dovoljeno velikost."
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
  const error = new Error("PDF originala ni bilo mogoče arhivirati.");
  error.status = response.status;
  throw error;
}

async function insertDocument(cfg, row) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_invoice_documents", {
    method: "POST",
    headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(row)
  }, 12000);
  if (response.ok) {
    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }
  if (response.status === 409) return null;
  const error = new Error("Metapodatkov dokumenta ni bilo mogoče shraniti.");
  error.status = response.status;
  throw error;
}

async function audit(cfg, userId, invoiceId, documentId, hash) {
  try {
    await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_audit_events", {
      method: "POST",
      headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        user_id: userId, entity_type: "invoice", entity_id: invoiceId, action: "pdf_archived",
        details: { document_id: documentId, sha256: hash, generator_version: GENERATOR_VERSION }
      })
    }, 8000);
  } catch (_) { /* račun in dokument sta že varno shranjena; audit ne blokira prenosa */ }
}

async function ensureDocumentCore(cfg, invoice, userId) {
  let document = await readDocument(cfg, userId, invoice.id);
  let pdf = null;
  if (document) {
    pdf = await downloadObject(cfg, document.storage_path);
    if (!pdf || sha256(pdf) !== document.sha256) throw new Error("Arhivirani PDF ni prestal preverjanja celovitosti.");
    return { document, pdf };
  }

  const path = objectPath(userId, invoice.id);
  pdf = await downloadObject(cfg, path);
  if (!pdf) {
    pdf = await ustvariRacunPdf(invoice);
    if (pdf.length > MAX_PDF_BYTES) throw new Error("Ustvarjeni PDF je nepričakovano prevelik.");
    const uploaded = await uploadObject(cfg, path, pdf);
    if (!uploaded) pdf = await downloadObject(cfg, path);
  }
  if (!pdf) throw new Error("PDF originala ni bilo mogoče ustvariti.");

  const hash = sha256(pdf);
  document = await insertDocument(cfg, {
    user_id: userId, invoice_id: invoice.id, storage_path: path, sha256: hash,
    byte_size: pdf.length, media_type: "application/pdf", generator_version: GENERATOR_VERSION
  });
  if (!document) document = await readDocument(cfg, userId, invoice.id);
  if (!document || document.sha256 !== hash) throw new Error("Dokument je nastal, vendar njegova arhivska evidenca ni pravilna.");
  await audit(cfg, userId, invoice.id, document.id, hash);
  return { document, pdf };
}

function ensureDocument(cfg, invoice, userId) {
  return pdfCapacity.run("invoice:" + userId + ":" + invoice.id, function () {
    return ensureDocumentCore(cfg, invoice, userId);
  });
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }

  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  const query = requestQuery(req);
  const invoiceId = uuid(query.invoiceId);
  if (!invoiceId) return json(res, 400, { ok: false, napaka: "Neveljaven račun." });

  try {
    const invoice = await readInvoice(cfg, auth.user.id, invoiceId);
    if (!invoice) return json(res, 404, { ok: false, napaka: "Račun ne obstaja ali ni vaš." });
    const result = await ensureDocument(cfg, invoice, auth.user.id);
    if (req.method === "POST" || String(query.mode) === "metadata") {
      return json(res, 200, { ok: true, document: {
        id: result.document.id, sha256: result.document.sha256, byteSize: result.document.byte_size,
        createdAt: result.document.created_at, generatorVersion: result.document.generator_version
      } });
    }
    const filename = String(invoice.invoice_number || "Rechnung").replace(/[^A-Za-z0-9._-]+/g, "-") + ".pdf";
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(result.pdf.length));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    res.end(result.pdf);
  } catch (error) {
    console.error("[pos-racun-pdf]", error && error.stack || error);
    json(res, Number(error && error.status || 500), { ok: false, code: error && error.code, retryable: error && error.retryable === true, retryAfterMs: error && error.retryAfterMs, napaka: error && error.message || "PDF ni bil ustvarjen." });
  }
}

module.exports = handler;
module.exports._test = { uuid, objectPath, encodedPath, sha256, ensureDocument };
