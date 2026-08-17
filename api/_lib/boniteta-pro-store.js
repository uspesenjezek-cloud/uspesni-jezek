"use strict";

var crypto = require("node:crypto");
var db = require("./supabase-server");

async function rest(cfg, path, options) {
  var authHeaders = cfg.userToken ? {
    apikey: cfg.publicKey || cfg.serviceKey,
    Authorization: "Bearer " + cfg.userToken,
    Accept: "application/json",
  } : db.serviceHeaders(cfg);
  var response = await db.fetchZOmejitvijo(cfg.url + "/rest/v1/" + path, {
    method: options && options.method || "GET",
    headers: Object.assign({}, authHeaders, { "Content-Type": "application/json" }, options && options.headers || {}),
    body: options && options.body ? JSON.stringify(options.body) : undefined,
  }, 12000);
  var data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    var err = new Error("Podatkov profila ni bilo mogoče shraniti ali prebrati.");
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return data;
}

function companyKey(data) {
  var companyId = String(data && data.companyId || "").trim();
  if (companyId) return "company:" + companyId.toUpperCase();
  var raw = [data && data.legalName, data && data.postalCode, data && data.city]
    .map(function (value) { return String(value || "").toLowerCase().trim(); }).join("|");
  return "manual:" + crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function compactJson(value, depth) {
  var level = Number(depth || 0);
  if (level > 6 || value == null) return value == null ? null : "[skrajšano]";
  if (typeof value === "string") return value.slice(0, 5000);
  if (["number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(function (item) { return compactJson(item, level + 1); });
  if (typeof value !== "object") return String(value).slice(0, 5000);
  var output = {};
  Object.keys(value).slice(0, 100).forEach(function (key) {
    if (["imageDataUrl", "evidenceImage", "image_data_url", "evidence_image"].includes(key)) return;
    output[String(key).slice(0, 120)] = compactJson(value[key], level + 1);
  });
  return output;
}

function shortObject(input, allowed) {
  var result = {};
  var source = input && typeof input === "object" ? input : {};
  allowed.forEach(function (key) { if (source[key] != null) result[key] = String(source[key]).trim().slice(0, 500); });
  return result;
}

async function upsertProfile(cfg, userId, input) {
  var payload = {
    user_id: userId,
    company_key: companyKey(input),
    company_id: String(input.companyId || "").trim() || null,
    legal_name: String(input.legalName || "").trim().slice(0, 240),
    register_number: String(input.registerNumber || "").trim().slice(0, 120) || null,
    register_court: String(input.registerCourt || "").trim().slice(0, 120) || null,
    company_status: String(input.companyStatus || "").trim().slice(0, 40) || null,
    address: shortObject(input.address, ["street", "address", "postal_code", "postalCode", "city", "country"]),
    contact: shortObject(input.contact, ["website", "email", "phone"]),
    latest_check: compactJson(input.latestCheck && typeof input.latestCheck === "object" ? input.latestCheck : {}, 0),
    checked_at: input.checkedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!payload.legal_name) throw Object.assign(new Error("Manjka ime preverjenega podjetja."), { status: 400 });
  var rows = await rest(cfg, "boniteta_profili?on_conflict=user_id,company_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: payload,
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function listProfiles(cfg, userId, watchedOnly) {
  if (watchedOnly) {
    return rest(cfg, "boniteta_monitorji?user_id=eq." + encodeURIComponent(userId) +
      "&select=*,profile:boniteta_profili(*)&order=updated_at.desc");
  }
  return rest(cfg, "boniteta_profili?user_id=eq." + encodeURIComponent(userId) + "&select=*&order=updated_at.desc&limit=200");
}

async function getProfile(cfg, userId, profileId) {
  var rows = await rest(cfg, "boniteta_profili?id=eq." + encodeURIComponent(profileId) +
    "&user_id=eq." + encodeURIComponent(userId) + "&select=*");
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

async function getMonitorByProfile(cfg, userId, profileId) {
  var rows = await rest(cfg, "boniteta_monitorji?user_id=eq." + encodeURIComponent(userId) +
    "&profile_id=eq." + encodeURIComponent(profileId) + "&select=*&limit=1");
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function deleteProfile(cfg, userId, profileId) {
  if (!validUuid(profileId)) throw Object.assign(new Error("Manjka veljaven profil podjetja."), { status: 400 });
  var rows = await rest(cfg, "boniteta_profili?id=eq." + encodeURIComponent(profileId) +
    "&user_id=eq." + encodeURIComponent(userId), {
    method: "DELETE", headers: { Prefer: "return=representation" },
  });
  var deleted = Array.isArray(rows) ? rows[0] : rows;
  if (!deleted) throw Object.assign(new Error("Profila ni bilo mogoče izbrisati ali ne pripada prijavljenemu uporabniku."), { status: 404 });
  return deleted;
}

async function getCache(cfg, userId, profileId, section, allowExpired) {
  var path = "boniteta_pro_cache?user_id=eq." + encodeURIComponent(userId) +
    "&profile_id=eq." + encodeURIComponent(profileId) + "&section=eq." + encodeURIComponent(section) +
    (allowExpired ? "" : "&expires_at=gt." + encodeURIComponent(new Date().toISOString())) + "&select=*&limit=1";
  var rows = await rest(cfg, path);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function putCache(cfg, userId, profileId, section, result) {
  var expires = new Date(Date.now() + result.ttlHours * 3600000).toISOString();
  var rows = await rest(cfg, "boniteta_pro_cache?on_conflict=profile_id,section", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: {
      user_id: userId,
      profile_id: profileId,
      section: section,
      payload: result.payload || {},
      credits_used: result.credits || 0,
      source_mode: result.sourceMode || "cached",
      fetched_at: new Date().toISOString(),
      expires_at: expires,
    },
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function upsertMonitor(cfg, userId, profile, frequency, preferences, payload) {
  var rows = await rest(cfg, "boniteta_monitorji?on_conflict=user_id,entity_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: {
      user_id: userId,
      profile_id: profile.id,
      entity_id: profile.company_id,
      frequency: frequency,
      preferences: preferences,
      disabled: Boolean(payload && payload.disabled),
      openregister_payload: payload || {},
      updated_at: new Date().toISOString(),
    },
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function deleteMonitor(cfg, userId, entityId) {
  await rest(cfg, "boniteta_monitorji?user_id=eq." + encodeURIComponent(userId) + "&entity_id=eq." + encodeURIComponent(entityId), {
    method: "DELETE", headers: { Prefer: "return=minimal" },
  });
}

async function listAlerts(cfg, userId) {
  return rest(cfg, "boniteta_opozorila?user_id=eq." + encodeURIComponent(userId) +
    "&select=*,profile:boniteta_profili(legal_name,company_id)&order=occurred_at.desc&limit=200");
}

async function markAlertRead(cfg, userId, alertId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(alertId || ""))) {
    throw Object.assign(new Error("Manjka veljavno opozorilo."), { status: 400 });
  }
  var rows = await rest(cfg, "boniteta_opozorila?id=eq." + encodeURIComponent(alertId) + "&user_id=eq." + encodeURIComponent(userId), {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: { read_at: new Date().toISOString() },
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function saveCrifRequest(cfg, userId, input) {
  var rows = await rest(cfg, "rpc/ustvari_crif_pripravo", {
    method: "POST", body: { p_request: {
      subject_type: input.subjectType, provider_product: input.recommendation.product,
      project_reference: input.projectReference || null, project_value_cents: input.projectValueCents,
      open_exposure_cents: input.openExposureCents, currency: input.currency, payment_timing: input.paymentTiming,
      project_start_date: input.projectStartDate, project_end_date: input.projectEndDate,
      legitimate_interest: input.legitimateInterest || null, legal_basis: input.legalBasis,
      financial_risk_confirmed: input.financialRiskConfirmed, business_purpose_confirmed: input.businessPurposeConfirmed,
      subject_payload: input.subject, notice_required: input.noticeRequired, notice_version: input.noticeVersion,
      notice_method: input.noticeMethod, notice_delivered_at: input.noticeDeliveredAt,
      monitoring_requested: input.monitoringRequested, monitoring_end_date: input.monitoringEndDate,
      monitoring_reason: input.monitoringReason, recommendation: input.recommendation,
    } },
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function listCrifRequests(cfg, userId) {
  return rest(cfg, "boniteta_crif_zahteve?user_id=eq." + encodeURIComponent(userId) +
    "&select=id,subject_type,status,provider_product,project_reference,project_value_cents,open_exposure_cents,currency,project_start_date,project_end_date,monitoring_requested,contract_gate,subject_payload,human_decision,dispute_status,result_received_at,created_at&order=created_at.desc&limit=200");
}

function validUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }

async function getCrifRequest(cfg, userId, requestId) {
  if (!validUuid(requestId)) throw Object.assign(new Error("Manjka veljavna analiza."), { status: 400 });
  var rows = await rest(cfg, "boniteta_crif_zahteve?id=eq." + encodeURIComponent(requestId) + "&user_id=eq." + encodeURIComponent(userId) +
    "&select=id,subject_type,status,provider_product,provider_mode,provider_request_id,project_reference,project_value_cents,open_exposure_cents,currency,project_start_date,project_end_date,monitoring_requested,monitoring_end_date,subject_payload,provider_result,result_received_at,human_decision,human_decision_reason,human_decision_at,dispute_status,dispute_reason,dispute_requested_at,contract_gate,created_at");
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

async function saveCrifDecision(cfg, requestId, decision) {
  if (!validUuid(requestId)) throw Object.assign(new Error("Manjka veljavna analiza."), { status: 400 });
  var rows = await rest(cfg, "rpc/shrani_crif_odlocitev", { method: "POST", body: { p_request_id: requestId, p_decision: decision.decision, p_reason: decision.reason } });
  var saved = Array.isArray(rows) ? rows[0] : rows;
  if (!saved) throw Object.assign(new Error("Analize ni mogoče posodobiti. Morda ne pripada prijavljenemu uporabniku ali še nima rezultata."), { status: 409 });
  return saved;
}

async function openCrifDispute(cfg, requestId, dispute) {
  if (!validUuid(requestId)) throw Object.assign(new Error("Manjka veljavna analiza."), { status: 400 });
  var rows = await rest(cfg, "rpc/odpri_crif_ugovor", { method: "POST", body: { p_request_id: requestId, p_reason: dispute.reason } });
  var saved = Array.isArray(rows) ? rows[0] : rows;
  if (!saved) throw Object.assign(new Error("Ugovora ni mogoče odpreti. Morda analiza ne pripada prijavljenemu uporabniku ali še nima rezultata."), { status: 409 });
  return saved;
}

async function saveCrifProviderResult(cfg, requestId, providerRequestId, result) {
  if (!cfg || cfg.isService !== true || cfg.userToken) throw Object.assign(new Error("CRIF rezultat lahko shrani samo strežniški povezovalni sloj."), { status: 403 });
  if (!validUuid(requestId)) throw Object.assign(new Error("Manjka veljavna analiza."), { status: 400 });
  var status = result.state === "completed" ? "completed" : result.state === "insufficient" ? "insufficient" : "failed";
  var rows = await rest(cfg, "boniteta_crif_zahteve?id=eq." + encodeURIComponent(requestId), { method: "PATCH", headers: { Prefer: "return=representation" }, body: {
    status: status, provider_request_id: String(providerRequestId || "").slice(0, 200) || null, provider_result: result,
    result_received_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  } });
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = {
  rest: rest,
  companyKey: companyKey,
  upsertProfile: upsertProfile,
  listProfiles: listProfiles,
  getProfile: getProfile,
  getMonitorByProfile: getMonitorByProfile,
  deleteProfile: deleteProfile,
  getCache: getCache,
  putCache: putCache,
  upsertMonitor: upsertMonitor,
  deleteMonitor: deleteMonitor,
  listAlerts: listAlerts,
  markAlertRead: markAlertRead,
  saveCrifRequest: saveCrifRequest,
  listCrifRequests: listCrifRequests,
  getCrifRequest: getCrifRequest,
  saveCrifDecision: saveCrifDecision,
  openCrifDispute: openCrifDispute,
  saveCrifProviderResult: saveCrifProviderResult,
  compactJson: compactJson,
  _test: { validUuid: validUuid },
};
