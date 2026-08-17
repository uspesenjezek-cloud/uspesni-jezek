"use strict";

var API = "https://api.openregister.de/v1";

var SECTION_CONFIG = {
  company: { path: "company/{id}", credits: 10, ttlHours: 24 },
  financials: { path: "company/{id}/financials", credits: 10, ttlHours: 168 },
  owners: { path: "company/{id}/owners", credits: 10, ttlHours: 168 },
  holdings: { path: "company/{id}/holdings", credits: 10, ttlHours: 168 },
  ubo: { path: "company/{id}/ubo", credits: 25, ttlHours: 168 },
  historical_owners: { path: "company/{id}/owners/historical", credits: 25, ttlHours: 168 },
  documents: { path: "company/{id}", credits: 10, ttlHours: 24 },
  insolvency: { path: "search/insolvency", credits: 10, ttlHours: 12, method: "POST" },
};

function napaka(message, status, code, details) {
  var err = new Error(message);
  err.status = status;
  err.code = code;
  err.details = details;
  return err;
}

function apiKey() {
  var key = String(process.env.OPENREGISTER_API_KEY || "").trim();
  if (!key) throw napaka("OpenRegister Pro še ni povezan.", 503, "OPENREGISTER_PRO_NOT_CONFIGURED");
  return key;
}

async function request(path, options) {
  var opts = options || {};
  var response;
  try {
    response = await fetch(API + "/" + path.replace(/^\/+/, ""), {
      method: opts.method || "GET",
      headers: {
        Authorization: "Bearer " + apiKey(),
        Accept: "application/json",
        "Content-Type": "application/json",
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeout || 30000),
    });
  } catch (_) {
    throw napaka("OpenRegister trenutno ni dosegljiv.", 502, "OPENREGISTER_UNAVAILABLE");
  }

  var data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    var code = response.status === 401 || response.status === 402 || response.status === 403
      ? "OPENREGISTER_PLAN_REQUIRED"
      : response.status === 404 ? "OPENREGISTER_NOT_FOUND" : "OPENREGISTER_REQUEST_FAILED";
    var message = response.status === 401 || response.status === 402 || response.status === 403
      ? "Ta sklop zahteva ustrezen OpenRegister Pro dostop."
      : response.status === 404 ? "Podatkov za ta sklop ni bilo mogoče najti."
        : "OpenRegister podatkov ni bilo mogoče pridobiti.";
    throw napaka(message, response.status, code, data);
  }
  return opts.includeStatus ? { data: data, status: response.status } : data;
}

function veljavenCompanyId(value) {
  var id = String(value || "").trim();
  return /^DE-[A-Z0-9.-]+$/i.test(id) ? id : "";
}

function safeHttpUrl(value) {
  try {
    var url = new URL(String(value || ""));
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch (_) { return ""; }
}

function sanitizeDocumentResult(input) {
  if (!input || typeof input !== "object") return input;
  var output = Object.assign({}, input);
  ["url", "download_url", "file_url", "document_url"].forEach(function (key) {
    if (key in output) output[key] = safeHttpUrl(output[key]);
  });
  return output;
}

async function section(companyId, sectionName, realtime) {
  var id = veljavenCompanyId(companyId);
  var config = SECTION_CONFIG[sectionName];
  if (!id || !config) throw napaka("Manjka veljaven profil podjetja ali sklop.", 400, "INVALID_REQUEST");
  var path = config.path.replace("{id}", encodeURIComponent(id));
  var method = config.method || "GET";
  var body;
  if (sectionName === "insolvency") {
    body = { filters: [{ field: "company_id", value: id }], pagination: { page: 1, per_page: 25 } };
  } else if (realtime && sectionName === "company") {
    path += "?realtime=true";
  }
  var response = await request(path, { method: method, body: body, includeStatus: true });
  var payload = response.data;
  var pending = response.status === 202;
  if (sectionName === "documents") payload = { documents: (payload && payload.documents || []).slice(0, 100).map(sanitizeDocumentResult) };
  return {
    payload: payload,
    credits: pending ? 0 : config.credits + (realtime && sectionName === "company" ? 10 : 0),
    ttlHours: pending ? 1 / 60 : realtime ? 6 : config.ttlHours,
    sourceMode: pending ? "processing" : realtime ? "realtime" : "cached",
  };
}

function dovoljeniFiltri(filters) {
  var dovoljeni = new Set([
    "name", "register_number", "register_court", "status", "legal_form",
    "city", "postal_code", "industry_code", "revenue", "employees", "incorporated_at"
  ]);
  return (Array.isArray(filters) ? filters : []).filter(function (filter) {
    return filter && dovoljeni.has(String(filter.field || ""));
  }).slice(0, 12).map(function (filter) {
    return {
      field: String(filter.field),
      value: filter.value == null ? undefined : String(filter.value).slice(0, 200),
      min: filter.min == null ? undefined : String(filter.min).slice(0, 80),
      max: filter.max == null ? undefined : String(filter.max).slice(0, 80),
      values: Array.isArray(filter.values) ? filter.values.slice(0, 30).map(String) : undefined,
    };
  });
}

async function advancedSearch(input) {
  var query = String(input && input.query || "").trim().slice(0, 240);
  return request("search/company", {
    method: "POST",
    body: {
      query: query ? { value: query } : undefined,
      filters: dovoljeniFiltri(input && input.filters),
      pagination: { page: Math.max(1, Number(input && input.page) || 1), per_page: 25 },
    },
  });
}

async function document(documentId, realtime) {
  var id = String(documentId || "").trim();
  if (!/^[0-9a-z-]{8,80}$/i.test(id)) throw napaka("Manjka veljaven dokument.", 400, "INVALID_DOCUMENT");
  return sanitizeDocumentResult(await request("document/" + encodeURIComponent(id) + (realtime ? "?realtime=true" : "")));
}

var DOCUMENT_CATEGORIES = new Set([
  "current_printout", "chronological_printout", "historical_printout",
  "structured_information", "shareholder_list", "articles_of_association"
]);

async function realtimeDocument(companyId, category) {
  var id = veljavenCompanyId(companyId);
  var kind = String(category || "");
  if (!id || !DOCUMENT_CATEGORIES.has(kind)) throw napaka("Manjka veljavno podjetje ali vrsta dokumenta.", 400, "INVALID_DOCUMENT");
  return sanitizeDocumentResult(await request("document?company_id=" + encodeURIComponent(id) + "&document_category=" + encodeURIComponent(kind)));
}

async function transparencyOrder(companyId) {
  var id = veljavenCompanyId(companyId);
  if (!id) throw napaka("Manjka registrirano podjetje.", 400, "COMPANY_ID_REQUIRED");
  return request("transparenzregister/extracts", {
    method: "POST",
    body: { company_id: id },
    headers: { "X-Credential-Name": "default" },
  });
}

async function transparencyGet(extractId) {
  var id = String(extractId || "").trim();
  if (!/^tre_[0-9a-z_-]{4,100}$/i.test(id)) throw napaka("Manjka veljaven izpis Transparenzregister.", 400, "INVALID_EXTRACT");
  return request("transparenzregister/extracts/" + encodeURIComponent(id));
}

async function listMonitors() { return request("monitor"); }
async function createMonitor(companyId, frequency, preferences) {
  var id = veljavenCompanyId(companyId);
  if (!id) throw napaka("Spremljanje je mogoče šele po uradni identifikaciji podjetja.", 400, "COMPANY_ID_REQUIRED");
  return request("monitor", {
    method: "POST",
    body: {
      entity_id: id,
      entity_type: "company",
      update_frequency: frequency === "daily" ? "daily" : "weekly",
      preferences: preferences,
    },
  });
}
async function deleteMonitor(companyId) {
  var id = veljavenCompanyId(companyId);
  if (!id) throw napaka("Manjka podjetje za spremljanje.", 400, "COMPANY_ID_REQUIRED");
  return request("monitor/" + encodeURIComponent(id), { method: "DELETE" });
}

module.exports = {
  SECTION_CONFIG: SECTION_CONFIG,
  request: request,
  section: section,
  advancedSearch: advancedSearch,
  document: document,
  realtimeDocument: realtimeDocument,
  transparencyOrder: transparencyOrder,
  transparencyGet: transparencyGet,
  listMonitors: listMonitors,
  createMonitor: createMonitor,
  deleteMonitor: deleteMonitor,
  veljavenCompanyId: veljavenCompanyId,
  dovoljeniFiltri: dovoljeniFiltri,
  safeHttpUrl: safeHttpUrl,
};
