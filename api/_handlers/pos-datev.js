"use strict";

const crypto = require("node:crypto");
const { DateTime } = require("luxon");
const supabase = require("../_lib/supabase-server");
const providerJson = require("../_lib/provider-json");
const requestJson = require("../_lib/pos-request-json");
const datev = require("../_lib/datev-cloud");
const Core = require("../../app/pos-terminal.js");
const BERLIN_ZONE = "Europe/Berlin";
const MAX_ARCHIVE_DOCUMENT_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 16 * 1024;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
}

function requestBody(req) {
  return requestJson(req, MAX_BODY_BYTES);
}

function uuid(value) {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : "";
}

function period(value) {
  const match = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(String(value || ""));
  if (!match) return null;
  const end = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
  return { key: match[0], start: match[1] + "-" + match[2] + "-01", end: match[1] + "-" + match[2] + "-" + String(end).padStart(2, "0") };
}

async function rest(cfg, table, options) {
  const opts = options || {};
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/" + table + (opts.query || ""), {
    method: opts.method || "GET",
    headers: supabase.serviceHeaders(cfg, Object.assign({ Prefer: opts.prefer || "return=representation" }, opts.headers || {})),
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }, opts.timeout || 12000);
  let data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    const error = new Error("DATEV podatkovne operacije ni bilo mogoče dokončati.");
    error.code = response.status === 409 ? "DATEV_DUPLICATE" : "DATEV_DATABASE_FAILED";
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return Array.isArray(data) ? data : data ? [data] : [];
}

async function connectionForUser(cfg, userId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_datev_connections",
    "user_id=eq." + encodeURIComponent(userId) + "&select=*&limit=1");
  return rows[0] || null;
}

async function saveConnection(cfg, row) {
  const rows = await rest(cfg, "pos_datev_connections", {
    method: "POST", query: "?on_conflict=user_id", headers: { "Content-Type": "application/json" },
    prefer: "resolution=merge-duplicates,return=representation", body: row,
  });
  return rows[0] || null;
}

async function patchConnection(cfg, userId, changes) {
  const rows = await rest(cfg, "pos_datev_connections", {
    method: "PATCH", query: "?user_id=eq." + encodeURIComponent(userId), headers: { "Content-Type": "application/json" },
    body: Object.assign({}, changes, { updated_at: new Date().toISOString() }),
  });
  return rows[0] || null;
}

function publicConnection(cfg, row) {
  return {
    configured: cfg.mode === "mock" || Boolean(cfg.clientId && cfg.clientSecret), environment: cfg.mode,
    connected: Boolean(row && row.status === "connected"), status: row && row.status || "disconnected",
    clientId: row && row.datev_client_id || "", consultantNumber: row && row.consultant_number || null,
    clientNumber: row && row.client_number || null, clientName: row && row.client_name || "",
    lastVerifiedAt: row && row.last_verified_at || null, lastErrorCode: row && row.last_error_code || "",
  };
}

async function profileSettings(cfg, userId) {
  const rows = await supabase.pridobiVrstice(cfg, "pos_business_profiles",
    "user_id=eq." + encodeURIComponent(userId) + "&select=datev_settings&limit=1");
  const settings = Core.normalizeDatevSettings(rows[0] && rows[0].datev_settings || {});
  const errors = Core.validateDatevSettings(settings, DateTime.now().setZone(BERLIN_ZONE).toFormat("yyyy-MM"));
  const identityErrors = errors.filter(function (message) { return /Beraternummer|Mandantennummer/.test(message); });
  if (identityErrors.length) throw new datev.DatevError(identityErrors[0], { code: "DATEV_SETTINGS_INCOMPLETE", status: 409 });
  return settings;
}

async function accessForConnection(cfg, db, connection) {
  if (cfg.mode === "mock") return { token: "datev-mock-token", connection };
  if (!connection || connection.status !== "connected") throw new datev.DatevError("DATEV še ni povezan.", { code: "DATEV_NOT_CONNECTED", status: 409 });
  if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() > Date.now() + 60000) {
    return { token: datev.decryptSecret(cfg, connection.access_token_encrypted), connection };
  }
  const refresh = datev.decryptSecret(cfg, connection.refresh_token_encrypted);
  if (!refresh) throw new datev.DatevError("DATEV seja je potekla. Povežite jo znova.", { code: "DATEV_RECONNECT_REQUIRED", status: 401 });
  const tokens = await datev.refreshAccessToken(cfg, refresh);
  const updated = await patchConnection(db, connection.user_id, {
    status: "connected",
    access_token_encrypted: datev.encryptSecret(cfg, tokens.access_token),
    refresh_token_encrypted: datev.encryptSecret(cfg, tokens.refresh_token || refresh),
    token_expires_at: new Date(Date.now() + Number(tokens.expires_in || 600) * 1000).toISOString(),
    last_error_code: "",
  });
  return { token: tokens.access_token, connection: updated };
}

function safeFilename(value) {
  return String(value || "Rechnung").normalize("NFC").replace(/[^A-Za-z0-9ÄÖÜäöüßÀ-ÿ&()+._ -]+/g, "_").slice(0, 120) || "Rechnung";
}

function encodedPath(path) {
  return String(path || "").split("/").map(encodeURIComponent).join("/");
}

async function archiveContent(cfg, record) {
  if (Number(record.byte_size) > MAX_ARCHIVE_DOCUMENT_BYTES) {
    throw new datev.DatevError("Arhivirani DATEV dokument presega dovoljeno velikost.", { code: "DATEV_ARCHIVE_TOO_LARGE", status: 409 });
  }
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/storage/v1/object/" + encodeURIComponent(record.storage_bucket) + "/" + encodedPath(record.storage_path), {
    headers: supabase.serviceHeaders(cfg, { Accept: record.original_media_type || "application/octet-stream" }),
  }, 20000);
  if (!response.ok) throw new datev.DatevError("Arhiviranega DATEV dokumenta ni mogoče prebrati.", { code: "DATEV_ARCHIVE_READ_FAILED", status: 502 });
  let buffer;
  try {
    buffer = await providerJson.readBuffer(response, {
      maxBytes: MAX_ARCHIVE_DOCUMENT_BYTES,
      code: "DATEV_ARCHIVE_TOO_LARGE",
      message: "Arhivirani DATEV dokument presega dovoljeno velikost.",
    });
  } catch (error) {
    if (error && error.code === "DATEV_ARCHIVE_TOO_LARGE") {
      throw new datev.DatevError(error.message, { code: error.code, status: 409 });
    }
    throw error;
  }
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  if (hash !== record.sha256 || buffer.length !== Number(record.byte_size)) {
    throw new datev.DatevError("Arhivirani dokument ni prestal preverjanja celovitosti.", { code: "DATEV_ARCHIVE_INTEGRITY_FAILED", status: 409 });
  }
  return buffer;
}

async function documentTransfer(cfg, userId, record) {
  const existing = await supabase.pridobiVrstice(cfg, "pos_datev_document_transfers",
    "user_id=eq." + encodeURIComponent(userId) + "&archive_record_id=eq." + encodeURIComponent(record.id) + "&select=*&limit=1");
  if (existing[0]) return existing[0];
  try {
    const rows = await rest(cfg, "pos_datev_document_transfers", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: {
        user_id: userId, archive_record_id: record.id, document_guid: crypto.randomUUID(), status: "pending",
      },
    });
    return rows[0];
  } catch (error) {
    if (error.code !== "DATEV_DUPLICATE") throw error;
    const rows = await supabase.pridobiVrstice(cfg, "pos_datev_document_transfers",
      "user_id=eq." + encodeURIComponent(userId) + "&archive_record_id=eq." + encodeURIComponent(record.id) + "&select=*&limit=1");
    return rows[0];
  }
}

async function patchDocumentTransfer(cfg, id, changes) {
  const rows = await rest(cfg, "pos_datev_document_transfers", {
    method: "PATCH", query: "?id=eq." + encodeURIComponent(id), headers: { "Content-Type": "application/json" },
    body: Object.assign({}, changes, { updated_at: new Date().toISOString() }),
  });
  return rows[0] || null;
}

function adjustmentLocal(row) {
  return {
    id: row.id, number: row.adjustment_number, type: row.adjustment_type,
    createdAt: berlinDate(row.issued_at), deltaGrossCents: Number(row.delta_gross_cents || 0), snapshot: row.snapshot || {},
    draft: row.snapshot && row.snapshot.effective_draft ? Core.draftFromDatabasePayload(row.snapshot.effective_draft, true) : null,
  };
}

function berlinMonthKey(value) {
  const date = DateTime.fromISO(String(value || ""), { setZone: true });
  return date.isValid ? date.setZone(BERLIN_ZONE).toFormat("yyyy-MM") : "";
}

function berlinDate(value) {
  const date = DateTime.fromISO(String(value || ""), { setZone: true });
  return date.isValid ? date.setZone(BERLIN_ZONE).toISODate() : "";
}

function berlinPeriodBounds(selectedPeriod) {
  if (!selectedPeriod) return null;
  const start = DateTime.fromISO(selectedPeriod.start, { zone: BERLIN_ZONE }).startOf("day");
  if (!start.isValid) return null;
  return { startUtc: start.toUTC().toISO(), endUtc: start.plus({ months: 1 }).toUTC().toISO() };
}

function chunks(values, size) {
  const result = [];
  const width = Math.min(Math.max(Number(size) || 100, 1), 200);
  for (let index = 0; index < values.length; index += width) result.push(values.slice(index, index + width));
  return result;
}

async function pagedRows(cfg, table, query, pageSize) {
  const size = Math.min(Math.max(Number(pageSize) || 500, 1), 1000);
  const baseQuery = String(query || "").replace(/^&/, "");
  const rows = [];
  let offset = 0;
  while (true) {
    const page = await supabase.pridobiVrstice(cfg, table,
      baseQuery + "&limit=" + size + "&offset=" + offset);
    rows.push.apply(rows, page);
    if (page.length < size) return rows;
    offset += page.length;
    if (offset >= 20000) {
      throw new datev.DatevError("Izbrano DATEV obdobje vsebuje preveč zapisov za varen enkratni prenos.", {
        code: "DATEV_DATASET_TOO_LARGE", status: 409,
      });
    }
  }
}

async function rowsForIds(cfg, table, userId, column, ids, suffix) {
  const rows = [];
  for (const part of chunks(ids, 100)) {
    const inFilter = "(" + part.map(encodeURIComponent).join(",") + ")";
    const page = await pagedRows(cfg, table,
      "user_id=eq." + encodeURIComponent(userId) + "&" + column + "=in." + inFilter + suffix);
    rows.push.apply(rows, page);
  }
  return rows;
}

async function periodPackage(cfg, userId, selectedPeriod, options) {
  const testOnly = Boolean(options && options.testOnly);
  const testFilter = testOnly ? "true" : "false";
  const bounds = berlinPeriodBounds(selectedPeriod);
  if (!bounds) throw new datev.DatevError("DATEV obdobje ni veljavno.", { code: "DATEV_PERIOD_INVALID", status: 400 });
  const periodInvoices = await pagedRows(cfg, "pos_invoices",
    "user_id=eq." + encodeURIComponent(userId) + "&is_test=eq." + testFilter + "&issue_date=gte." + selectedPeriod.start +
    "&issue_date=lte." + selectedPeriod.end + "&select=*&order=issued_at.asc,id.asc");
  const periodAdjustments = await pagedRows(cfg, "pos_invoice_adjustments",
    "user_id=eq." + encodeURIComponent(userId) + "&issued_at=gte." + encodeURIComponent(bounds.startUtc) +
    "&issued_at=lt." + encodeURIComponent(bounds.endUtc) +
    "&select=id,original_invoice_id&order=issued_at.asc,id.asc");
  const existingIds = new Set(periodInvoices.map(function (row) { return row.id; }));
  const additionalIds = Array.from(new Set(periodAdjustments.map(function (row) { return row.original_invoice_id; }).filter(function (id) { return id && !existingIds.has(id); })));
  let additionalInvoices = [];
  if (additionalIds.length) {
    additionalInvoices = await rowsForIds(cfg, "pos_invoices", userId, "id", additionalIds,
      "&is_test=eq." + testFilter + "&select=*&order=issued_at.asc,id.asc");
  }
  const invoices = periodInvoices.concat(additionalInvoices);
  if (!invoices.length) return { invoices: [], records: [] };
  const ids = invoices.map(function (row) { return row.id; });
  const [adjustments, records] = await Promise.all([
    rowsForIds(cfg, "pos_invoice_adjustments", userId, "original_invoice_id", ids,
      "&select=*&order=issued_at.asc,id.asc"),
    rowsForIds(cfg, "pos_archive_records", userId, "invoice_id", ids,
      "&source_table=in.(pos_invoice_documents,pos_adjustment_documents)&select=*&order=archived_at.asc,id.asc"),
  ]);
  const adjustmentsByInvoice = Object.create(null);
  adjustments.forEach(function (row) {
    if (!adjustmentsByInvoice[row.original_invoice_id]) adjustmentsByInvoice[row.original_invoice_id] = [];
    adjustmentsByInvoice[row.original_invoice_id].push(adjustmentLocal(row));
  });
  const periodInvoiceIds = new Set(periodInvoices.map(function (row) { return row.id; }));
  const periodAdjustmentIds = new Set(adjustments.filter(function (row) {
    return berlinMonthKey(row.issued_at) === selectedPeriod.key;
  }).map(function (row) { return row.id; }));
  return {
    records: records.filter(function (record) {
      return record.source_table === "pos_invoice_documents"
        ? periodInvoiceIds.has(record.invoice_id)
        : periodAdjustmentIds.has(record.source_id);
    }),
    invoices: invoices.map(function (row) {
      const localAdjustments = adjustmentsByInvoice[row.id] || [];
      const payload = row.snapshot && row.snapshot.draft || {};
      const draft = Core.draftFromDatabasePayload(payload, true);
      return {
        id: row.id, number: row.invoice_number, dueDate: payload.due_date || row.due_date,
        draft, totals: Core.calculateTotals(draft), isTest: false, inPeriod: periodInvoiceIds.has(row.id), adjustments: localAdjustments,
      };
    }),
  };
}

async function createJob(cfg, userId, requestId, selectedPeriod, mode, options) {
  const repeatableMock = mode === "mock" && Boolean(options && options.testOnly);
  try {
    const rows = await rest(cfg, "pos_datev_transfer_jobs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: {
        user_id: userId, request_id: requestId, period: selectedPeriod.key, environment: mode, status: "preparing",
      },
    });
    return rows[0];
  } catch (error) {
    if (error.code !== "DATEV_DUPLICATE") throw error;
    const sameRequest = await supabase.pridobiVrstice(cfg, "pos_datev_transfer_jobs",
      "user_id=eq." + encodeURIComponent(userId) + "&request_id=eq." + encodeURIComponent(requestId) +
      "&select=*&limit=1");
    if (sameRequest[0]) return sameRequest[0];
    const reusableStatuses = repeatableMock ? "preparing,processing" : "preparing,processing,succeeded";
    const rows = await supabase.pridobiVrstice(cfg, "pos_datev_transfer_jobs",
      "user_id=eq." + encodeURIComponent(userId) + "&period=eq." + encodeURIComponent(selectedPeriod.key) +
      "&environment=eq." + encodeURIComponent(mode) + "&status=in.(" + reusableStatuses + ")&select=*&order=created_at.desc&limit=1");
    if (rows[0]) return rows[0];
    throw error;
  }
}

async function patchJob(cfg, id, changes) {
  const rows = await rest(cfg, "pos_datev_transfer_jobs", {
    method: "PATCH", query: "?id=eq." + encodeURIComponent(id), headers: { "Content-Type": "application/json" },
    body: Object.assign({}, changes, { updated_at: new Date().toISOString() }),
  });
  return rows[0] || null;
}

function publicJob(row) {
  return row ? {
    id: row.id, period: row.period, environment: row.environment, status: row.status,
    bookingCount: Number(row.booking_count || 0), documentCount: Number(row.document_count || 0),
    fileName: row.file_name || "", fileSha256: row.file_sha256 || "", retryAfterSeconds: Number(row.retry_after_seconds || 0),
    errorCode: row.error_code || "", errorMessage: row.error_message || "", completedAt: row.completed_at || null,
  } : null;
}

async function executeTransfer(datevCfg, db, connection, token, userId, settings, selectedPeriod, requestId, options) {
  const testOnly = Boolean(options && options.testOnly);
  let job = await createJob(db, userId, requestId, selectedPeriod, datevCfg.mode, { testOnly });
  if (job.status === "succeeded" || job.status === "processing") return job;
  const pack = await periodPackage(db, userId, selectedPeriod, { testOnly });
  if (!pack.invoices.length) throw new datev.DatevError(testOnly ? "V izbranem mesecu ni testnih računov za DATEV mock preizkus." : "V izbranem mesecu ni pravnih računov za DATEV.", { code: "DATEV_PERIOD_EMPTY", status: 409 });
  const client = datevCfg.mode === "mock"
    ? datev.mockClient(settings.adviserNumber, settings.clientNumber)
    : await datev.getClient(datevCfg, token, settings.adviserNumber, settings.clientNumber);
  if (datevCfg.mode !== "mock") {
    const duoVersion = await datev.getDuoVersion(datevCfg, token, client.id);
    if (!datev.supportsDocumentExtension(duoVersion, "pdf")) throw new datev.DatevError("Izbrani DATEV mandant ne dovoljuje prenosa PDF dokumentov.", { code: "DATEV_PDF_NOT_ALLOWED", status: 409 });
  }
  const recordsByInvoice = Object.create(null);
  const recordsByAdjustment = Object.create(null);
  for (const record of pack.records) {
    const transfer = await documentTransfer(db, userId, record);
    record.datevTransfer = transfer;
    if (record.source_table === "pos_invoice_documents") recordsByInvoice[record.invoice_id] = record;
    else recordsByAdjustment[record.source_id] = record;
  }
  for (const invoice of pack.invoices) {
    const original = recordsByInvoice[invoice.id];
    if (invoice.inPeriod && !original) throw new datev.DatevError("Račun " + invoice.number + " nima arhiviranega PDF-ja.", { code: "DATEV_DOCUMENT_MISSING", status: 409 });
    if (original) invoice.documentGuid = original.datevTransfer.document_guid;
    for (const adjustment of invoice.adjustments) {
      if (String(adjustment.createdAt || "").slice(0, 7) !== selectedPeriod.key) continue;
      const record = recordsByAdjustment[adjustment.id];
      if (!record) throw new datev.DatevError("Popravek " + adjustment.number + " nima arhiviranega PDF-ja.", { code: "DATEV_DOCUMENT_MISSING", status: 409 });
      adjustment.documentGuid = record.datevTransfer.document_guid;
    }
  }
  let transferredCount = 0;
  for (const record of pack.records) {
    const transfer = record.datevTransfer;
    if (transfer.status === "transferred") { transferredCount += 1; continue; }
    try {
      const label = record.source_table === "pos_invoice_documents"
        ? pack.invoices.find(function (invoice) { return invoice.id === record.invoice_id; }).number
        : pack.invoices.flatMap(function (invoice) { return invoice.adjustments; }).find(function (entry) { return entry.id === record.source_id; }).number;
      let provider = { id: transfer.document_guid };
      if (datevCfg.mode !== "mock") {
        provider = await datev.uploadDocument(datevCfg, token, client.id, {
          guid: transfer.document_guid,
          filename: safeFilename(label) + ".pdf",
          mediaType: record.original_media_type,
          content: await archiveContent(db, record),
          metadata: { category: "WerkTech Lab", folder: "Ausgangsrechnungen", register: selectedPeriod.key, note: label },
        });
      }
      await patchDocumentTransfer(db, transfer.id, {
        status: "transferred", provider_document_id: String(provider.id || transfer.document_guid),
        transferred_at: new Date().toISOString(), last_error_code: "",
      });
      transferredCount += 1;
    } catch (error) {
      await patchDocumentTransfer(db, transfer.id, { status: "error", transferred_at: null, last_error_code: error.code || "DATEV_DOCUMENT_FAILED" });
      throw error;
    }
  }
  const result = Core.buildDatevExport(pack.invoices, settings, selectedPeriod.key, new Date(), { requireDocumentLinks: true });
  if (result.errors.length) throw new datev.DatevError(result.errors[0], { code: "DATEV_EXTF_INVALID", status: 409, details: result.errors });
  if (testOnly) result.filename = "EXTF_TEST_Buchungsstapel_" + selectedPeriod.key.replace("-", "") + ".csv";
  const hash = crypto.createHash("sha256").update(result.content, "utf8").digest("hex");
  if (datevCfg.mode === "mock") {
    return patchJob(db, job.id, {
      status: "succeeded", provider_job_id: "mock-" + job.id, provider_location: "", retry_after_seconds: 0,
      file_name: result.filename, file_sha256: hash, booking_count: result.bookings.length,
      document_count: transferredCount, completed_at: new Date().toISOString(), error_code: "", error_message: "",
    });
  }
  const upload = await datev.uploadExtf(datevCfg, token, client.id, {
    filename: result.filename, content: result.content,
    referenceId: "WerkTech_" + selectedPeriod.key.replace("-", "_") + "_" + job.id,
  });
  return patchJob(db, job.id, {
    status: "processing", provider_job_id: upload.jobId, provider_location: upload.location,
    retry_after_seconds: upload.retryAfter, file_name: result.filename, file_sha256: hash,
    booking_count: result.bookings.length, document_count: transferredCount, error_code: "", error_message: "",
  });
}

async function callback(req, res, datevCfg, db) {
  const query = req.query || {};
  const fallback = "/app/pos-terminal.html?datev=error";
  try {
    if (datevCfg.mode === "mock") return res.status(302).setHeader("Location", fallback).end();
    if (query.error) throw new datev.DatevError("DATEV povezava je bila preklicana.", { code: "DATEV_AUTH_CANCELLED", status: 400 });
    const state = datev.openState(datevCfg, query.state);
    if (!uuid(state.userId) || !query.code) throw new datev.DatevError("DATEV povratna povezava ni veljavna.", { code: "DATEV_CALLBACK_INVALID", status: 400 });
    const settings = await profileSettings(db, state.userId);
    const tokens = await datev.exchangeCode(datevCfg, query.code, state.verifier);
    const client = await datev.getClient(datevCfg, tokens.access_token, settings.adviserNumber, settings.clientNumber);
    await saveConnection(db, {
      user_id: state.userId, environment: datevCfg.mode, status: "connected", datev_client_id: client.id,
      consultant_number: Number(client.consultant_number), client_number: Number(client.client_number),
      client_name: String(client.name || ""), services: client.services || [],
      access_token_encrypted: datev.encryptSecret(datevCfg, tokens.access_token),
      refresh_token_encrypted: datev.encryptSecret(datevCfg, tokens.refresh_token || ""),
      token_expires_at: new Date(Date.now() + Number(tokens.expires_in || 600) * 1000).toISOString(),
      last_verified_at: new Date().toISOString(), last_error_code: "", updated_at: new Date().toISOString(),
    });
    return res.status(302).setHeader("Location", "/app/pos-terminal.html?datev=connected").end();
  } catch (error) {
    console.error("[pos-datev-callback]", String(error && (error.code || error.name) || "UNKNOWN"));
    return res.status(302).setHeader("Location", fallback + "&datev_code=" + encodeURIComponent(error.code || "DATEV_CALLBACK_FAILED")).end();
  }
}

async function handler(req, res) {
  let datevCfg;
  let db;
  try { datevCfg = datev.configuration(); db = supabase.konfiguracija(); }
  catch (error) { return json(res, error.status || 503, { ok: false, code: error.code || "DATEV_NOT_CONFIGURED", napaka: error.message }); }
  const query = req.query || {};
  if (req.method === "GET" && String(query.action || "") === "callback") return callback(req, res, datevCfg, db);
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Dovoljena sta samo GET in POST." });
  const auth = await supabase.preveriUporabnika(req, db);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  let body;
  try { body = requestBody(req); }
  catch (error) { return json(res, error.status || 400, { ok: false, code: error.code, napaka: error.message }); }
  const action = String(req.method === "GET" ? query.action || "status" : body.action || "status");
  try {
    let connection = await connectionForUser(db, auth.user.id);
    if (action === "status") {
      let latest = null;
      const jobs = await supabase.pridobiVrstice(db, "pos_datev_transfer_jobs",
        "user_id=eq." + encodeURIComponent(auth.user.id) + "&select=*&order=created_at.desc&limit=1");
      latest = jobs[0] || null;
      if (latest && latest.status === "processing" && connection) {
        const access = await accessForConnection(datevCfg, db, connection);
        const result = await datev.getJob(datevCfg, access.token, latest.provider_location);
        if (result.status !== "processing") latest = await patchJob(db, latest.id, {
          status: result.status, completed_at: new Date().toISOString(), error_code: result.code,
          error_message: result.message.slice(0, 500), retry_after_seconds: 0,
        });
      }
      return json(res, 200, { ok: true, datev: publicConnection(datevCfg, connection), latestTransfer: publicJob(latest) });
    }
    if (action === "connect") {
      const settings = await profileSettings(db, auth.user.id);
      if (datevCfg.mode === "mock") {
        const client = datev.mockClient(settings.adviserNumber, settings.clientNumber);
        connection = await saveConnection(db, {
          user_id: auth.user.id, environment: "mock", status: "connected", datev_client_id: client.id,
          consultant_number: Number(client.consultant_number), client_number: Number(client.client_number), client_name: client.name,
          services: client.services, access_token_encrypted: "", refresh_token_encrypted: "", token_expires_at: null,
          last_verified_at: new Date().toISOString(), last_error_code: "", updated_at: new Date().toISOString(),
        });
        return json(res, 200, { ok: true, datev: publicConnection(datevCfg, connection) });
      }
      return json(res, 200, { ok: true, authorizationUrl: datev.authorizationUrl(datevCfg, { userId: auth.user.id }) });
    }
    if (action === "disconnect") {
      if (connection && datevCfg.mode !== "mock") {
        const accessToken = datev.decryptSecret(datevCfg, connection.access_token_encrypted);
        const refreshToken = datev.decryptSecret(datevCfg, connection.refresh_token_encrypted);
        const revoked = await Promise.allSettled([
          datev.revokeToken(datevCfg, accessToken, "access_token"),
          datev.revokeToken(datevCfg, refreshToken, "refresh_token"),
        ]);
        if (revoked.some(function (entry) { return entry.status === "rejected"; })) throw new datev.DatevError("DATEV dovoljenja ni bilo mogoče varno preklicati.", { code: "DATEV_REVOKE_FAILED", status: 503, retryable: true });
      }
      if (connection) connection = await patchConnection(db, auth.user.id, {
        status: "disconnected", access_token_encrypted: "", refresh_token_encrypted: "", token_expires_at: null,
        last_error_code: "", datev_client_id: "", consultant_number: null, client_number: null, client_name: "", services: [],
      });
      return json(res, 200, { ok: true, datev: publicConnection(datevCfg, connection) });
    }
    if (action === "transfer" || action === "test-transfer") {
      const testOnly = action === "test-transfer";
      if (testOnly && datevCfg.mode !== "mock") throw new datev.DatevError("Testni DATEV paket je dovoljen samo v mock okolju.", { code: "DATEV_TEST_ONLY_MOCK", status: 409 });
      const selectedPeriod = period(body.period);
      const requestId = uuid(body.requestId);
      if (!selectedPeriod || !requestId) return json(res, 400, { ok: false, napaka: "DATEV obdobje ali zahtevek ni veljaven." });
      const settings = await profileSettings(db, auth.user.id);
      if (!connection || connection.status !== "connected") throw new datev.DatevError("Najprej povežite DATEV.", { code: "DATEV_NOT_CONNECTED", status: 409 });
      const access = await accessForConnection(datevCfg, db, connection);
      try {
        const job = await executeTransfer(datevCfg, db, access.connection, access.token, auth.user.id, settings, selectedPeriod, requestId, { testOnly });
        return json(res, job.status === "succeeded" ? 200 : 202, { ok: true, datev: publicConnection(datevCfg, access.connection), transfer: publicJob(job) });
      } catch (error) {
        const jobs = await supabase.pridobiVrstice(db, "pos_datev_transfer_jobs",
          "user_id=eq." + encodeURIComponent(auth.user.id) + "&request_id=eq." + encodeURIComponent(requestId) + "&select=*&limit=1");
        if (jobs[0] && ["preparing", "processing"].includes(jobs[0].status)) await patchJob(db, jobs[0].id, {
          status: "failed", completed_at: new Date().toISOString(), retry_after_seconds: 0,
          error_code: String(error.code || "DATEV_TRANSFER_FAILED").slice(0, 100),
          error_message: String(error.message || "DATEV prenos ni uspel.").slice(0, 500),
        });
        throw error;
      }
    }
    return json(res, 400, { ok: false, napaka: "Neznano DATEV opravilo." });
  } catch (error) {
    console.error("[pos-datev]", String(error && (error.code || error.name) || "UNKNOWN"));
    return json(res, Number(error.status || 502), {
      ok: false, code: error.code || "DATEV_FAILED",
      napaka: error.retryable ? "DATEV je začasno nedosegljiv. Poskusite znova." : error.message || "DATEV opravilo ni uspelo.",
    });
  }
}

module.exports = handler;
module.exports._test = {
  adjustmentLocal, archiveContent, berlinDate, berlinMonthKey, berlinPeriodBounds, chunks, pagedRows, period, periodPackage,
  publicConnection, publicJob, requestBody, rowsForIds, safeFilename, uuid, MAX_ARCHIVE_DOCUMENT_BYTES, MAX_BODY_BYTES,
};
