"use strict";

const crypto = require("crypto");
const supabase = require("../_lib/supabase-server");
const providerJson = require("../_lib/provider-json");
const {
  CONTRACT_CONFIRMATION_GENERATOR_VERSION,
  ustvariPogodbenoPotrdiloPdf
} = require("../_lib/pos-offer-pdf");

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
  return userId + "/" + workOrderId + "/vertragsbestaetigung.pdf";
}

function encodedPath(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function readOne(cfg, table, filter) {
  const rows = await supabase.pridobiVrstice(cfg, table, filter + "&select=*");
  return rows.length === 1 ? rows[0] : null;
}

async function downloadObject(cfg, path, missingAllowed) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/storage/v1/object/" + BUCKET + "/" + encodedPath(path), {
    headers: supabase.serviceHeaders(cfg, { Accept: "application/pdf" })
  }, 15000);
  if (missingAllowed && (response.status === 404 || response.status === 400)) return null;
  if (!response.ok) throw Object.assign(new Error("Arhiviranega PDF-ja ni bilo mogoče prebrati."), { status: response.status });
  return providerJson.readBuffer(response, {
    maxBytes: MAX_PDF_BYTES,
    code: "POS_CONTRACT_CONFIRMATION_PDF_TOO_LARGE",
    message: "Arhivirani PDF pogodbenega potrdila presega dovoljeno velikost."
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
  throw Object.assign(new Error("PDF pogodbenega potrdila ni bilo mogoče arhivirati."), { status: response.status });
}

async function insertDocument(cfg, row) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_contract_confirmation_documents", {
    method: "POST",
    headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(row)
  }, 12000);
  if (response.ok) {
    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }
  if (response.status === 409) return null;
  throw Object.assign(new Error("Metapodatkov pogodbenega potrdila ni bilo mogoče shraniti."), { status: response.status });
}

async function ensureDocument(cfg, workOrder, userId) {
  const source = workOrder.locked_payload || {};
  if (source.customer_type !== "private" || !["distance", "off_premises", "urgent_repair"].includes(source.consumer_contract_context)) {
    throw new Error("Posebno pogodbeno potrdilo je namenjeno potrošniški pogodbi na daljavo ali zunaj poslovnih prostorov.");
  }
  if (!["accepted", "in_progress", "completed", "invoiced", "withdrawn"].includes(workOrder.status)) {
    throw new Error("Pogodbeno potrdilo je na voljo šele po sprejemu ponudbe.");
  }

  const baseFilter = "work_order_id=eq." + encodeURIComponent(workOrder.id) + "&user_id=eq." + encodeURIComponent(userId);
  let document = await readOne(cfg, "pos_contract_confirmation_documents", baseFilter);
  let pdf = null;
  if (document) {
    pdf = await downloadObject(cfg, document.storage_path, false);
    if (sha256(pdf) !== document.sha256) throw new Error("Arhivirano pogodbeno potrdilo ni prestalo preverjanja celovitosti.");
    return { document, pdf };
  }

  const acceptance = await readOne(cfg, "pos_work_order_acceptances", baseFilter);
  if (!acceptance || !acceptance.accepted_on || !acceptance.offer_document_id || !acceptance.offer_sha256) {
    throw new Error("Manjka nespremenljivi dokaz sprejema ponudbe.");
  }
  const offerDocument = await readOne(cfg, "pos_offer_documents",
    "id=eq." + encodeURIComponent(acceptance.offer_document_id) + "&user_id=eq." + encodeURIComponent(userId));
  if (!offerDocument || offerDocument.work_order_id !== workOrder.id || offerDocument.sha256 !== acceptance.offer_sha256) {
    throw new Error("Sprejem ni pravilno vezan na arhivirani original ponudbe.");
  }
  const offerPdf = await downloadObject(cfg, offerDocument.storage_path, false);
  if (sha256(offerPdf) !== offerDocument.sha256) throw new Error("Arhivirani original ponudbe ni prestal preverjanja celovitosti.");

  const path = objectPath(userId, workOrder.id);
  pdf = await downloadObject(cfg, path, true);
  if (!pdf) {
    pdf = await ustvariPogodbenoPotrdiloPdf(workOrder, acceptance, offerPdf);
    if (pdf.length > MAX_PDF_BYTES) throw new Error("Ustvarjeni PDF pogodbenega potrdila je nepričakovano prevelik.");
    const uploaded = await uploadObject(cfg, path, pdf);
    if (!uploaded) pdf = await downloadObject(cfg, path, false);
  }
  if (!pdf) throw new Error("PDF pogodbenega potrdila ni bilo mogoče ustvariti.");

  const hash = sha256(pdf);
  document = await insertDocument(cfg, {
    user_id: userId,
    work_order_id: workOrder.id,
    acceptance_id: acceptance.id,
    offer_document_id: offerDocument.id,
    offer_sha256: offerDocument.sha256,
    accepted_on: acceptance.accepted_on,
    storage_path: path,
    sha256: hash,
    byte_size: pdf.length,
    media_type: "application/pdf",
    generator_version: CONTRACT_CONFIRMATION_GENERATOR_VERSION
  });
  if (!document) document = await readOne(cfg, "pos_contract_confirmation_documents", baseFilter);
  if (!document || document.sha256 !== hash || document.offer_sha256 !== offerDocument.sha256) {
    throw new Error("Pogodbeno potrdilo je nastalo, vendar njegova arhivska evidenca ni pravilna.");
  }
  return { document, pdf };
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }

  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  const workOrderId = uuid(req.query && req.query.workOrderId);
  if (!workOrderId) return json(res, 400, { ok: false, napaka: "Neveljavno naročilo." });

  try {
    const workOrder = await readOne(cfg, "pos_work_orders",
      "id=eq." + encodeURIComponent(workOrderId) + "&user_id=eq." + encodeURIComponent(auth.user.id));
    if (!workOrder) return json(res, 404, { ok: false, napaka: "Naročilo ne obstaja ali ni vaše." });
    const result = await ensureDocument(cfg, workOrder, auth.user.id);
    if (req.method === "POST" || String(req.query && req.query.mode) === "metadata") {
      return json(res, 200, { ok: true, document: {
        id: result.document.id,
        sha256: result.document.sha256,
        offerSha256: result.document.offer_sha256,
        acceptedOn: result.document.accepted_on,
        byteSize: result.document.byte_size,
        createdAt: result.document.created_at,
        generatorVersion: result.document.generator_version
      } });
    }
    const filename = String(workOrder.order_number || "Vertragsbestaetigung").replace(/[^A-Za-z0-9._-]+/g, "-") + "-Vertragsbestaetigung.pdf";
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(result.pdf.length));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    res.end(result.pdf);
  } catch (error) {
    console.error("[pos-pogodba-pdf]", error && error.stack || error);
    json(res, 500, { ok: false, napaka: error && error.message || "PDF pogodbenega potrdila ni bil ustvarjen." });
  }
}

module.exports = handler;
module.exports._test = { uuid, objectPath, encodedPath, sha256, ensureDocument };
