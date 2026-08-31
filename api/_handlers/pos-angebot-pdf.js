"use strict";

const crypto = require("crypto");
const supabase = require("../_lib/supabase-server");
const providerJson = require("../_lib/provider-json");
const requestQuery = require("../_lib/pos-request-query");
const pdfCapacity = require("../_lib/runtime-capacity").sharedGate("pos-pdf-generation", {
  maxActive: 2, maxQueue: 32, waitTimeoutMs: 8000, retryAfterMs: 1500,
  busyMessage: "Ustvarjanje PDF-jev je trenutno zasedeno. Poskusite znova čez trenutek."
});
const { GENERATOR_VERSION, ustvariPonudboPdf } = require("../_lib/pos-offer-pdf");

const BUCKET = "pos-offer-originals";
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
}

function uuid(value) {
  const valueText = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valueText) ? valueText : "";
}

function objectPath(userId, workOrderId) {
  return userId + "/" + workOrderId + "/angebot.pdf";
}

function encodedPath(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function readWorkOrder(cfg, userId, workOrderId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_work_orders",
    "id=eq." + encodeURIComponent(workOrderId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*");
  return rows.length === 1 ? rows[0] : null;
}

async function readDocument(cfg, userId, workOrderId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_offer_documents",
    "work_order_id=eq." + encodeURIComponent(workOrderId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*");
  return rows.length === 1 ? rows[0] : null;
}

async function downloadObject(cfg, path) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/storage/v1/object/" + BUCKET + "/" + encodedPath(path), {
    headers: supabase.serviceHeaders(cfg, { Accept: "application/pdf" })
  }, 15000);
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw Object.assign(new Error("Arhivirane ponudbe ni bilo mogoče prebrati."), { status: response.status });
  return providerJson.readBuffer(response, {
    maxBytes: MAX_PDF_BYTES, code: "POS_OFFER_PDF_TOO_LARGE", message: "Arhivirani PDF ponudbe presega dovoljeno velikost."
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
  throw Object.assign(new Error("PDF ponudbe ni bilo mogoče arhivirati."), { status: response.status });
}

async function insertDocument(cfg, row) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_offer_documents", {
    method: "POST",
    headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(row)
  }, 12000);
  if (response.ok) {
    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }
  if (response.status === 409) return null;
  throw Object.assign(new Error("Metapodatkov ponudbe ni bilo mogoče shraniti."), { status: response.status });
}

async function ensureDocumentCore(cfg, workOrder, userId) {
  let document = await readDocument(cfg, userId, workOrder.id);
  let pdf = null;
  if (document) {
    pdf = await downloadObject(cfg, document.storage_path);
    if (!pdf || sha256(pdf) !== document.sha256) throw new Error("Arhivirani PDF ponudbe ni prestal preverjanja celovitosti.");
    return { document, pdf };
  }

  const path = objectPath(userId, workOrder.id);
  pdf = await downloadObject(cfg, path);
  if (!pdf) {
    pdf = await ustvariPonudboPdf(workOrder);
    if (pdf.length > MAX_PDF_BYTES) throw new Error("Ustvarjeni PDF ponudbe je nepričakovano prevelik.");
    const uploaded = await uploadObject(cfg, path, pdf);
    if (!uploaded) pdf = await downloadObject(cfg, path);
  }
  if (!pdf) throw new Error("PDF ponudbe ni bilo mogoče ustvariti.");

  const hash = sha256(pdf);
  document = await insertDocument(cfg, {
    user_id: userId, work_order_id: workOrder.id, storage_path: path, sha256: hash,
    byte_size: pdf.length, media_type: "application/pdf", generator_version: GENERATOR_VERSION
  });
  if (!document) document = await readDocument(cfg, userId, workOrder.id);
  if (!document || document.sha256 !== hash) throw new Error("Ponudba je nastala, vendar njena arhivska evidenca ni pravilna.");
  return { document, pdf };
}

function ensureDocument(cfg, workOrder, userId) {
  return pdfCapacity.run("offer:" + userId + ":" + workOrder.id, function () {
    return ensureDocumentCore(cfg, workOrder, userId);
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
  const workOrderId = uuid(query.workOrderId);
  if (!workOrderId) return json(res, 400, { ok: false, napaka: "Neveljavna ponudba." });

  try {
    const workOrder = await readWorkOrder(cfg, auth.user.id, workOrderId);
    if (!workOrder) return json(res, 404, { ok: false, napaka: "Ponudba ne obstaja ali ni vaša." });
    const result = await ensureDocument(cfg, workOrder, auth.user.id);
    if (req.method === "POST" || String(query.mode) === "metadata") {
      return json(res, 200, { ok: true, document: {
        id: result.document.id, sha256: result.document.sha256, byteSize: result.document.byte_size,
        createdAt: result.document.created_at, generatorVersion: result.document.generator_version
      } });
    }
    const filename = String(workOrder.offer_number || "Angebot").replace(/[^A-Za-z0-9._-]+/g, "-") + ".pdf";
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(result.pdf.length));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    res.end(result.pdf);
  } catch (error) {
    console.error("[pos-angebot-pdf]", error && error.stack || error);
    json(res, Number(error && error.status || 500), { ok: false, code: error && error.code, retryable: error && error.retryable === true, retryAfterMs: error && error.retryAfterMs, napaka: error && error.message || "PDF ponudbe ni bil ustvarjen." });
  }
}

module.exports = handler;
module.exports._test = { uuid, objectPath, encodedPath, sha256, ensureDocument };
