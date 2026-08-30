var sentry = require("../_lib/sentry");
"use strict";

var db = require("../_lib/supabase-server");
var store = require("../_lib/boniteta-pro-store");
var queue = require("../_lib/mehka-boniteta-queue");
var openregister = require("../_lib/openregister-pro-client");
var identitySearch = require("../_lib/openregister-identity-search");
var debtorCompanyIdentity = require("../_lib/debtor-company-identity");
var northdataAutocomplete = require("../_lib/northdata-directory-search");
var northdataClient = require("../_lib/apify-northdata-client");
var projectMonitor = require("../_lib/projektno-spremljanje");
var financialRecheck = require("../_lib/financno-ponovno-preverjanje");
var crif = require("../_lib/crif-priprava");
var crifResult = require("../_lib/crif-rezultat");
var bau650f = require("../_lib/bauhandwerkersicherung-service");
var resourceProof = require("../_lib/boniteta-resource-proof");
var MONITOR_PREFERENCES = new Set(["basic", "representation", "financials", "documents", "ownership", "holdings", "insolvencies"]);

function json(res, status, body) { res.setHeader("Cache-Control", "no-store"); return res.status(status).json(body); }
function query(req, name) { if (req.query && req.query[name] != null) return String(req.query[name]); try { return new URL(req.url, "http://localhost").searchParams.get(name) || ""; } catch (_) { return ""; } }
function preferences(input) { var values = (Array.isArray(input) ? input : []).map(String).filter(function (v) { return MONITOR_PREFERENCES.has(v); }); return Array.from(new Set(values)).slice(0, 7); }
function monitoringFrequency(input) { var value = String(input || ""); if (!["daily", "weekly", "monthly"].includes(value)) throw Object.assign(new Error("Izberite veljavno pogostost spremljanja."), { status: 400, code: "INVALID_MONITORING_FREQUENCY" }); return value; }
function monitoringToday(date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana", year: "numeric", month: "2-digit", day: "2-digit" }).format(date || new Date()); }
function route(req) { var named = query(req, "route"); if (named) return named; return String(req.url || "").includes("boniteta-profili") ? "profiles" : "openregister"; }

function authoritativeConfig() {
  try { return db.konfiguracija(); }
  catch (_) { throw Object.assign(new Error("Strežniška shramba za preverjene podatke ni povezana."), { status: 503, code: "SERVER_WRITE_NOT_CONFIGURED" }); }
}

function firstValue(source, keys) {
  var input = source && typeof source === "object" ? source : {};
  for (var i = 0; i < keys.length; i += 1) if (input[keys[i]] != null && String(input[keys[i]]).trim()) return String(input[keys[i]]).trim();
  return "";
}

function profileFromCompletedJob(job) {
  if (!job || job.status !== "completed" || !job.result) throw Object.assign(new Error("Zaključena preverba ni bila najdena ali ne pripada prijavljenemu uporabniku."), { status: 409, code: "COMPLETED_CHECK_REQUIRED" });
  if (!store.imaPopolnUradniInsolvencniRezultat(job.result)) throw Object.assign(new Error("Brez zajetega uradnega insolvenčnega dokazila preverbe ni mogoče shraniti."), { status: 409, code: "INSOLVENCY_EVIDENCE_INCOMPLETE" });
  var result = job.result, identity = result.identity || {}, evidence = result.identityEvidence || {}, request = job.request || {};
  var identityStatus = firstValue(identity, ["status"]), legalName = firstValue(identity, ["naziv", "ime", "legalName", "name"]) || firstValue(evidence, ["naziv", "ime", "legalName", "name"]);
  if (!legalName || !["verified_register", "confirmed_impressum"].includes(identityStatus)) throw Object.assign(new Error("Zaključena preverba nima potrjene identitete podjetja."), { status: 409, code: "VERIFIED_IDENTITY_REQUIRED" });
  var companyId = firstValue(identity, ["companyId", "company_id"]) || firstValue(evidence, ["companyId", "company_id"]) || request.openRegisterCompanyId || "";
  var insolvency = Object.assign({}, result.insolvency || {}), officialVerification = Object.assign({}, insolvency.officialVerification || {}, { serverEvidenceVerified: true });
  insolvency.officialVerification = officialVerification;
  var latestCheck = Object.assign({}, result, {
    insolvency: insolvency,
    identityStatus: identityStatus,
    entityType: firstValue(identity, ["entityType", "entity_type"]),
    identityName: firstValue(identity, ["ime", "name"]),
    businessName: firstValue(identity, ["naziv", "businessName", "legalName"]),
    queueJobId: job.id,
  });
  return {
    companyId: companyId,
    legalName: legalName,
    registerNumber: companyId ? firstValue(identity, ["registerNumber", "register_number"]) || firstValue(evidence, ["registerNumber", "register_number"]) || request.registerNumber || "" : "",
    registerCourt: companyId ? firstValue(identity, ["registerCourt", "register_court"]) || firstValue(evidence, ["registerCourt", "register_court"]) || request.registerCourt || "" : "",
    companyStatus: identity.active === false ? "inactive" : identity.active === true ? "active" : "unknown",
    address: { street: firstValue(identity, ["naslov", "street", "address"]), postal_code: firstValue(identity, ["postnaStevilka", "postalCode", "postal_code"]), city: firstValue(identity, ["kraj", "city"]) },
    contact: { website: request.spletnaStran || "" },
    checkedAt: result.checkedAt || job.updatedAt || new Date().toISOString(),
    latestCheck: latestCheck,
  };
}

function registryProfile(company) {
  var address = company.address || {};
  return {
    companyId: company.company_id,
    legalName: company.name,
    registerNumber: [company.register_type, company.register_number].filter(Boolean).join(" "),
    registerCourt: company.register_court,
    companyStatus: company.active === false ? "inactive" : "active",
    address: { street: address.street || "", postal_code: address.postal_code || "", city: address.city || "" },
    checkedAt: new Date().toISOString(),
    latestCheck: { source: "openregister_verified_search", identityStatus: "verified_register", identity: { status: "verified_register", companyId: company.company_id, naziv: company.name, registerNumber: company.register_number, registerCourt: company.register_court, active: company.active !== false, naslov: address.street || "", postnaStevilka: address.postal_code || "", kraj: address.city || "" }, result: { level: "yellow", title: "Profil ustvarjen iz preverjenega registrskega zadetka" } },
  };
}

function filteredIdentityResults(results, filters) {
  return (Array.isArray(results) ? results : []).filter(function (company) {
    return (Array.isArray(filters) ? filters : []).every(function (filter) {
      var field = String(filter && filter.field || ""), wanted = String(filter && filter.value || "").trim().toLocaleLowerCase("de-DE");
      if (!wanted) return true;
      if (field === "city") return String(company.address && company.address.city || "").toLocaleLowerCase("de-DE").includes(wanted);
      if (field === "legal_form") return String(company.legal_form || "").toLocaleLowerCase("de-DE") === wanted;
      return true;
    });
  });
}

function containsResourceId(value, expected, depth, seen) {
  if (!value || typeof value !== "object" || Number(depth || 0) > 8) return false;
  var visited = seen || new Set(); if (visited.has(value)) return false; visited.add(value);
  if (Array.isArray(value)) return value.slice(0, 200).some(function (item) { return containsResourceId(item, expected, Number(depth || 0) + 1, visited); });
  return Object.keys(value).slice(0, 200).some(function (key) {
    if (["id", "documentId", "document_id"].includes(key) && String(value[key] || "") === expected) return true;
    return containsResourceId(value[key], expected, Number(depth || 0) + 1, visited);
  });
}

async function requireBoundDocument(cfg, userId, profile, documentId) {
  var id = String(documentId || "").trim();
  if (!id) throw Object.assign(new Error("Manjka dokument."), { status: 400, code: "DOCUMENT_ID_REQUIRED" });
  var cached = await store.getCache(cfg, userId, profile.id, "documents", true);
  if (!containsResourceId([cached && cached.payload, profile.latest_check], id, 0)) throw Object.assign(new Error("Dokument ni vezan na izbrani profil."), { status: 404, code: "DOCUMENT_NOT_BOUND_TO_PROFILE" });
  return id;
}

function validateMonitoringSchedule(input, todayOverride) {
  var projectStartDate = String(input && input.projectStartDate || "").trim();
  var projectEndDate = String(input && input.projectEndDate || "").trim();
  var rawCheckTime = input && input.checkTime;
  var checkTime = rawCheckTime == null || rawCheckTime === "" ? "12:00" : String(rawCheckTime).trim();
  var startImmediately = input && input.startImmediately;
  var explicitMonitoringStartDate = String(input && input.monitoringStartDate || "").trim();
  function validDate(value) {
    var match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    var parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return parsed.toISOString().slice(0, 10) === value;
  }
  if (!validDate(projectStartDate) || !validDate(projectEndDate) || (!explicitMonitoringStartDate && typeof startImmediately !== "boolean")) {
    throw Object.assign(new Error("Vnesite veljaven začetek in predvideni konec projekta."), { status: 400, code: "INVALID_MONITORING_SCHEDULE" });
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(checkTime)) {
    throw Object.assign(new Error("Izberite veljavno uro preverbe."), { status: 400, code: "INVALID_MONITORING_TIME" });
  }
  var today = String(todayOverride || monitoringToday());
  var monitoringStartDate = explicitMonitoringStartDate || (startImmediately ? today : projectStartDate);
  if (!validDate(monitoringStartDate)) {
    throw Object.assign(new Error("Izberite veljaven datum prve poizvedbe."), { status: 400, code: "INVALID_MONITORING_START_DATE" });
  }
  if (projectEndDate < projectStartDate) {
    throw Object.assign(new Error("Konec projekta ne sme biti pred začetkom projekta."), { status: 400, code: "MONITORING_END_BEFORE_PROJECT_START" });
  }
  if (monitoringStartDate < today) {
    throw Object.assign(new Error("Prva poizvedba se ne sme začeti v preteklosti."), { status: 400, code: "MONITORING_START_IN_PAST" });
  }
  if (projectEndDate < monitoringStartDate) {
    throw Object.assign(new Error("Konec projekta ne sme biti pred prvo poizvedbo."), { status: 400, code: "MONITORING_END_BEFORE_MONITORING_START" });
  }
  return { projectStartDate: projectStartDate, projectEndDate: projectEndDate, checkTime: checkTime, startImmediately: monitoringStartDate === today, monitoringStartDate: monitoringStartDate };
}

function foundationDateEvidence(input, profile) {
  var companyId = String(input && input.companyId || "").trim().toUpperCase();
  var expectedId = String(profile && profile.company_id || "").trim().toUpperCase();
  var date = String(input && input.date || "").trim();
  if (!expectedId || companyId !== expectedId) throw Object.assign(new Error("Datum ni vezan na izbrano registrirano podjetje."), { status: 409, code: "COMPANY_ID_MISMATCH" });
  var match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw Object.assign(new Error("Vnesite veljaven datum ustanovitve."), { status: 400, code: "INVALID_FOUNDATION_DATE" });
  var parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  var normalized = parsed.toISOString().slice(0, 10);
  if (normalized !== date || Number(match[1]) < 1800 || normalized > new Date().toISOString().slice(0, 10)) {
    throw Object.assign(new Error("Datum ustanovitve mora biti resničen pretekli datum."), { status: 400, code: "INVALID_FOUNDATION_DATE" });
  }
  return {
    date: date,
    companyId: expectedId,
    source: "openregister_public_profile",
    sourceUrl: "https://openregister.de/company/" + encodeURIComponent(expectedId),
    captureMethod: "manual_user_transcription",
    verificationStatus: "user_transcribed",
    recordedAt: new Date().toISOString(),
  };
}

async function watchedProfilesWithSchedule(cfg, userId) {
  var rows = await store.listProfiles(cfg, userId, true);
  return Promise.all((rows || []).map(async function (monitor) {
    var schedule = await projectMonitor.get(cfg, userId, monitor.profile_id);
    var profile = monitor && monitor.profile || {}, latest = profile.latest_check || {}, requestPayload = schedule && schedule.request_payload || {}, cardState = requestPayload.monitoringCardState || monitor.card_state || monitor.latest_comparison || monitor.openregister_payload && (monitor.openregister_payload.monitoringCardState || monitor.openregister_payload.latestComparison) || latest.monitoringCardState || null;
    var lastStatus = String(schedule && schedule.last_result_status || "").toLowerCase(), completedStatus = ["clear", "not_found", "found", "possible_match", "match", "warning", "checked"].includes(lastStatus);
    if (!cardState && schedule && schedule.last_check_at && completedStatus && requestPayload.monitoringBaseline) {
      var current = Object.assign({ checkedAt: profile.checked_at || null }, latest);
      try { cardState = projectMonitor.monitoringComparison(requestPayload.monitoringBaseline, current); } catch (_) { cardState = null; }
    }
    return Object.assign({}, monitor, { schedule: schedule || null, card_state: cardState });
  }));
}

async function monitoringStateForProfile(cfg, userId, profile) {
  var schedule = await projectMonitor.get(cfg, userId, profile.id);
  if (!schedule) return null;
  var latest = profile.latest_check || {}, requestPayload = schedule.request_payload || {}, cardState = requestPayload.monitoringCardState || latest.monitoringCardState || null;
  var lastStatus = String(schedule.last_result_status || "").toLowerCase(), completedStatus = ["clear", "not_found", "found", "possible_match", "match", "warning", "checked"].includes(lastStatus);
  if (!cardState && schedule.last_check_at && completedStatus && requestPayload.monitoringBaseline) {
    try { cardState = projectMonitor.monitoringComparison(requestPayload.monitoringBaseline, Object.assign({ checkedAt: profile.checked_at || null }, latest)); } catch (_) { cardState = null; }
  }
  return { schedule: schedule, card_state: cardState };
}

async function profiles(req, res, cfg, auth) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  if (req.method === "GET") {
    var view = query(req, "view");
    if (view === "alerts") return json(res, 200, { ok: true, alerts: await store.listAlerts(cfg, auth.user.id) });
    var id = query(req, "id");
    if (id) { var profile = await store.getProfile(cfg, auth.user.id, id); return profile ? json(res, 200, { ok: true, profile: profile, monitoring: await monitoringStateForProfile(cfg, auth.user.id, profile) }) : json(res, 404, { ok: false, napaka: "Profil ni bil najden." }); }
    if (view === "watched") return json(res, 200, { ok: true, profiles: await watchedProfilesWithSchedule(cfg, auth.user.id) });
    return json(res, 200, { ok: true, profiles: await store.listProfiles(cfg, auth.user.id, false) });
  }
  var body = req.body && typeof req.body === "object" ? req.body : {};
  if (req.method === "DELETE") {
    var profileId = String(body.profileId || "");
    var profile = await store.getProfile(cfg, auth.user.id, profileId);
    if (!profile) return json(res, 404, { ok: false, napaka: "Profil ni bil najden." });
    // Spremljanje je izključno naš lokalni urnik in se ob brisanju profila
    // odstrani prek preverjenih povezav ON DELETE CASCADE.
    // Profil in čakalna vrsta sta namensko ločena. Pred brisanjem profila zato
    // odstranimo tudi vse rezultate, dokazne posnetke in ponovne poskuse tega
    // podjetja, vendar izključno za prijavljenega uporabnika.
    // Če poseben service-role ključ ni nameščen, uporabimo prijavno sejo.
    // RLS v bazi tej seji dovoljuje izključno njene lastne vrstice.
    var purgeCfg;
    try { purgeCfg = db.konfiguracija(); } catch (_) { purgeCfg = cfg; }
    var purgedChecks = await queue.izbrisiPodatkeProfila(purgeCfg, auth.user.id, profile);
    var deleted = await store.deleteProfile(cfg, auth.user.id, profile.id);
    return json(res, 200, { ok: true, deleted: { id: deleted.id, legalName: deleted.legal_name, purgedChecks: purgedChecks } });
  }
  if (body.action === "save_foundation_date") {
    var foundationProfile = await store.getProfile(cfg, auth.user.id, String(body.profileId || ""));
    if (!foundationProfile) return json(res, 404, { ok: false, napaka: "Profil podjetja ni bil najden." });
    var evidence = foundationDateEvidence(body, foundationProfile);
    return json(res, 200, { ok: true, profile: await store.saveFoundationDateEvidence(authoritativeConfig(), auth.user.id, foundationProfile, evidence), evidence: evidence });
  }
  if (body.action === "import_northdata_run") {
    var northDataProfile = await store.getProfile(cfg, auth.user.id, String(body.profileId || ""));
    if (!northDataProfile) return json(res, 404, { ok: false, napaka: "Profil podjetja ni bil najden." });
    var northData = await northdataClient.readExistingRun(body.runId, {
      name: northDataProfile.legal_name,
      registerNumber: northDataProfile.register_number,
      registerCourt: northDataProfile.register_court,
      address: northDataProfile.address || {},
    });
    if (northData.status !== "found") return json(res, 409, { ok: false, code: "NORTHDATA_COMPANY_MISMATCH", napaka: "Rezultat runa se ne ujema z izbranim podjetjem." });
    return json(res, 200, { ok: true, profile: await store.saveNorthDataPayload(authoritativeConfig(), auth.user.id, northDataProfile, northData), northData: northData });
  }
  if (body.action === "mark_alert_read") return json(res, 200, { ok: true, alert: await store.markAlertRead(authoritativeConfig(), auth.user.id, String(body.alertId || "")) });
  if (body.action === "save_registry_profile") {
    var company = identitySearch.verifyCompanyProof(body.identityProof, auth.user.id);
    if (!company) throw Object.assign(new Error("Registrski zadetek ni več veljaven. Podjetje poiščite znova."), { status: 409, code: "IDENTITY_PROOF_INVALID" });
    return json(res, 200, { ok: true, profile: await store.upsertProfile(authoritativeConfig(), auth.user.id, registryProfile(company)) });
  }
  if (body.action !== "save_check") return json(res, 400, { ok: false, napaka: "Neznana operacija." });
  var completedJob = await queue.pridobi(cfg, auth.user.id, String(body.jobId || ""));
  return json(res, 200, { ok: true, profile: await store.upsertProfile(authoritativeConfig(), auth.user.id, profileFromCompletedJob(completedJob)) });
}

async function crifRequests(req, res, cfg, auth) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  if (req.method === "GET") {
    var requestId = query(req, "id");
    if (requestId) { var detail = await store.getCrifRequest(cfg, auth.user.id, requestId); return detail ? json(res, 200, { ok: true, request: detail, provider: crif.providerStatus() }) : json(res, 404, { ok: false, napaka: "Analiza ni bila najdena." }); }
    return json(res, 200, { ok: true, requests: await store.listCrifRequests(cfg, auth.user.id), provider: crif.providerStatus() });
  }
  var body = req.body && typeof req.body === "object" ? req.body : {};
  if (body.action === "save_decision") return json(res, 200, { ok: true, request: await store.saveCrifDecision(cfg, String(body.requestId || ""), crifResult.decision(body)) });
  if (body.action === "open_dispute") return json(res, 200, { ok: true, request: await store.openCrifDispute(cfg, String(body.requestId || ""), crifResult.dispute(body)) });
  if (body.action === "activate" || body.action === "query" || body.action === "report") {
    var provider = crif.providerStatus();
    if (!provider.enabled) return json(res, 409, { ok: false, code: "CRIF_CONTRACT_REQUIRED", napaka: "CRIF poizvedba bo na voljo po sklenitvi platformske pogodbe in vnosu API dovoljenj." });
    return json(res, 501, { ok: false, code: "CRIF_ADAPTER_MAPPING_REQUIRED", napaka: "Pogodbeni CRIF-produkt je aktiviran, manjka pa še potrjena preslikava njegovega API-odziva." });
  }
  if (body.action !== "prepare_request") return json(res, 400, { ok: false, napaka: "Neznana operacija." });
  var prepared = crif.validate(body);
  return json(res, 200, { ok: true, request: await store.saveCrifRequest(cfg, auth.user.id, prepared), provider: prepared.provider, recommendation: prepared.recommendation });
}

async function pro(req, res, cfg, auth) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  var body = req.body && typeof req.body === "object" ? req.body : {};
  var action = req.method === "GET" ? query(req, "action") : String(body.action || "");
  if (action === "credits") return json(res, 200, { ok: true, credits: await openregister.credits() });
  if (action === "autocomplete") {
    return json(res, 410, { ok: false, code: "PAID_AUTOCOMPLETE_DISABLED", napaka: "Plačljivi autocomplete je izklopljen." });
  }
  if (action === "northdata_autocomplete") {
    var northdata = await northdataAutocomplete.search(body.query, auth.user.id, { readCfg: cfg, accessToken: auth.token });
    return json(res, 200, {
      ok: true,
      results: northdata.results,
      cached: northdata.cached,
      sharedCache: northdata.sharedCache,
      cacheLayer: northdata.cacheLayer,
      estimatedCostUsd: northdata.estimatedCostUsd,
      sourceUrl: northdata.sourceUrl,
    });
  }
  if (action === "identity_search") {
    var identity = await identitySearch.search(body.query, auth.user.id);
    return json(res, 200, { ok: true, results: identity.results, cached: identity.cached, creditsUsed: identity.cached ? 0 : 1 });
  }
  if (action === "debtor_company_search") {
    var debtorSearch = await debtorCompanyIdentity.search(cfg, auth.user.id, body.query);
    return json(res, 200, { ok: true, results: debtorSearch.results, cached: debtorSearch.cached, creditsUsed: debtorSearch.creditsUsed, maxCredits: 1 });
  }
  if (action === "debtor_company_select") {
    var debtorSelection = await debtorCompanyIdentity.saveSelection(authoritativeConfig(), auth.user.id, body.identityProof);
    return json(res, 200, { ok: true, company: debtorSelection.company, profileId: debtorSelection.profile && debtorSelection.profile.id || null, creditsUsed: 0, maxCredits: 1 });
  }
  if (action === "debtor_company_list") {
    return json(res, 200, { ok: true, companies: await debtorCompanyIdentity.list(cfg, auth.user.id), creditsUsed: 0, maxCredits: 1 });
  }
  if (action === "company_lookup") {
    var companyId = openregister.veljavenCompanyId(body.companyId);
    if (!companyId) throw Object.assign(new Error("Izberite veljavno podjetje iz registra."), { status: 400, code: "COMPANY_ID_REQUIRED" });
    return json(res, 200, { ok: true, company: await openregister.companyDetails(companyId), creditsUsed: 10 });
  }
  if (action === "search") {
    var searched = await identitySearch.search(body.query, auth.user.id);
    return json(res, 200, { ok: true, results: filteredIdentityResults(searched.results, body.filters), cached: searched.cached, creditsUsed: searched.cached ? 0 : 1 });
  }
  var profileId = req.method === "GET" ? query(req, "profileId") : String(body.profileId || "");
  var profile = await store.getProfile(cfg, auth.user.id, profileId);
  if (!profile) return json(res, 404, { ok: false, napaka: "Profil ni bil najden." });
  // Plačljiv dokument mora biti vedno vezan na profil trenutnega uporabnika.
  // Sicer bi poljuben prijavljen uporabnik lahko po ID-ju naročil tuj dokument.
  if (action === "document") {
    var boundDocumentId = openregister.veljavenDocumentId(await requireBoundDocument(cfg, auth.user.id, profile, body.documentId));
    if (!boundDocumentId) throw Object.assign(new Error("Manjka veljaven dokument."), { status: 400, code: "INVALID_DOCUMENT" });
    return json(res, 200, { ok: true, document: await openregister.document(boundDocumentId, false), creditsUsed: 10 });
  }
  if (action === "document_realtime") {
    var documentCategory = openregister.veljavnaKategorijaDokumenta(body.category);
    if (!profile.company_id || !documentCategory) throw Object.assign(new Error("Manjka veljavno podjetje ali vrsta dokumenta."), { status: 400, code: "INVALID_DOCUMENT" });
    return json(res, 200, { ok: true, document: await openregister.realtimeDocument(profile.company_id, documentCategory), creditsUsed: 10 });
  }
  if (action === "transparency_order") {
    var transparencyCompanyId = openregister.veljavenCompanyId(profile.company_id);
    if (!transparencyCompanyId) throw Object.assign(new Error("Manjka registrirano podjetje."), { status: 400, code: "COMPANY_ID_REQUIRED" });
    var orderedExtract = await openregister.transparencyOrder(transparencyCompanyId), orderedId = firstValue(orderedExtract, ["id", "extractId", "extract_id"]);
    return json(res, 200, { ok: true, extract: orderedExtract, extractProof: resourceProof.sign(auth.user.id, profile.id, "transparency_extract", orderedId), creditsUsed: 25 });
  }
  if (action === "transparency_get") {
    var extractId = String(body.extractId || "").trim();
    if (!resourceProof.verify(body.extractProof, auth.user.id, profile.id, "transparency_extract", extractId)) throw Object.assign(new Error("Izpis ni vezan na izbrani profil ali je dokazilo poteklo."), { status: 403, code: "EXTRACT_NOT_BOUND_TO_PROFILE" });
    return json(res, 200, { ok: true, extract: await openregister.transparencyGet(extractId), extractProof: body.extractProof, creditsUsed: 0 });
  }
  if (action === "project_monitor_get") return json(res, 200, { ok: true, monitor: await projectMonitor.get(cfg, auth.user.id, profile.id), policy: projectMonitor.policy(Number(body.projectValue || 0)) });
  if (action === "project_monitor_save") return json(res, 200, { ok: true, monitor: await projectMonitor.save(authoritativeConfig(), auth.user.id, profile, body) });
  if (action === "project_monitor_delete") { await projectMonitor.remove(cfg, auth.user.id, profile.id); return json(res, 200, { ok: true }); }
  if (action === "financial_recheck_get") return json(res, 200, { ok: true, recheck: await financialRecheck.get(cfg, auth.user.id, profile.id, req.method === "GET" ? query(req, "reason") : body.reason) });
  if (action === "financial_recheck_save") return json(res, 200, { ok: true, recheck: await financialRecheck.save(authoritativeConfig(), auth.user.id, profile, body) });
  if (action === "financial_recheck_delete") { await financialRecheck.remove(cfg, auth.user.id, profile.id, body.reason); return json(res, 200, { ok: true }); }
  if (action === "section") {
    var section = req.method === "GET" ? query(req, "section") : String(body.section || "");
    var force = req.method === "GET" ? query(req, "refresh") === "1" : Boolean(body.refresh);
    var realtime = req.method === "GET" ? query(req, "realtime") === "1" : Boolean(body.realtime);
    var cached = !force ? await store.getCache(cfg, auth.user.id, profile.id, section, false) : null;
    if (cached) return json(res, 200, { ok: true, section: section, data: cached.payload, cache: { hit: true, fetchedAt: cached.fetched_at, expiresAt: cached.expires_at, creditsUsed: 0, sourceMode: cached.source_mode } });
    if (!profile.company_id) return json(res, 409, { ok: false, code: "REGISTERED_COMPANY_REQUIRED", napaka: "Ta sklop je na voljo za uradno registrirana podjetja z OpenRegister ID." });
    var sectionConfig = openregister.SECTION_CONFIG[section];
    if (!sectionConfig) throw Object.assign(new Error("Manjka veljaven profil podjetja ali sklop."), { status: 400, code: "INVALID_REQUEST" });
    var normalizedRealtime = realtime && section === "company";
    var result = await openregister.section(profile.company_id, section, normalizedRealtime), saved = await store.putCache(authoritativeConfig(), auth.user.id, profile.id, section, result);
    return json(res, 200, { ok: true, section: section, data: saved.payload, cache: { hit: false, fetchedAt: saved.fetched_at, expiresAt: saved.expires_at, creditsUsed: saved.credits_used, sourceMode: saved.source_mode } });
  }
  if (action === "monitor_create") {
    var prefs = preferences(body.preferences); if (!prefs.length) return json(res, 400, { ok: false, napaka: "Izberite vsaj eno vrsto sprememb." });
    var schedule = validateMonitoringSchedule(body);
    var frequency = monitoringFrequency(body.frequency), previousSchedule = await projectMonitor.get(cfg, auth.user.id, profile.id), monitor;
    await projectMonitor.saveMonitoring(authoritativeConfig(), auth.user.id, profile, Object.assign({}, schedule, { frequency: frequency }));
    try {
      monitor = await store.upsertMonitor(authoritativeConfig(), auth.user.id, profile, frequency, prefs, {
        source: "internal_recheck",
        provider: "internal_recheck",
        billing: "per_completed_recheck",
        activationCredits: 0,
        maxCreditsPerCompletedRecheck: 1,
        intervalDays: projectMonitor.intervalDays(frequency),
        monitoringSchedule: schedule,
      });
    } catch (saveError) {
      if (previousSchedule) await projectMonitor.restore(authoritativeConfig(), previousSchedule);
      else await projectMonitor.remove(cfg, auth.user.id, profile.id);
      throw saveError;
    }
    return json(res, 200, { ok: true, monitor: monitor, creditsUsed: 0, billing: "per_completed_recheck", maxCreditsPerCompletedRecheck: 1 });
  }
  if (action === "monitor_delete") {
    await projectMonitor.remove(cfg, auth.user.id, profile.id);
    await store.deleteMonitorByProfile(cfg, auth.user.id, profile.id);
    return json(res, 200, { ok: true });
  }
  return json(res, 400, { ok: false, napaka: "Neznana OpenRegister Pro operacija." });
}

async function handler(req, res) {
  var cfg; try { cfg = db.uporabniskaKonfiguracija(); } catch (_) { return json(res, 503, { ok: false, napaka: "Strežniška shramba ni povezana." }); }
  var auth = await db.preveriUporabnika(req, cfg); if (!auth.ok) return json(res, auth.status, { ok: false, napaka: auth.napaka }); cfg.userToken = auth.token;
  try { var selected = route(req); if (selected === "650f") { if (req.method !== "POST") return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." }); return json(res, 200, Object.assign({ ok: true }, await bau650f.handle(authoritativeConfig(), auth.user.id, req.body || {}, store))); } return selected === "profiles" ? await profiles(req, res, cfg, auth) : selected === "crif" ? await crifRequests(req, res, cfg, auth) : await pro(req, res, cfg, auth); }
  catch (err) { console.error("[boniteta-pro]", err.code || err.message, err.details || ""); return json(res, err.status || 502, { ok: false, code: err.code || "BONITETA_PRO_FAILED", napaka: err.message || "Operacija ni uspela." }); }
}

module.exports = sentry.wrapHandler(handler, "/api/boniteta-pro");
module.exports._test = { preferences: preferences, monitoringFrequency: monitoringFrequency, monitoringToday: monitoringToday, query: query, route: route, validateMonitoringSchedule: validateMonitoringSchedule, foundationDateEvidence: foundationDateEvidence, watchedProfilesWithSchedule: watchedProfilesWithSchedule, crifRequests: crifRequests, normalizeCrifResult: crifResult.normalize, profileFromCompletedJob: profileFromCompletedJob, registryProfile: registryProfile, filteredIdentityResults: filteredIdentityResults, containsResourceId: containsResourceId };
