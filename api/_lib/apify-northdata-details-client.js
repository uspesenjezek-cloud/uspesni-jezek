"use strict";

var ACTOR_ID = "vKs8nu688v4F1se82";
var API_ROOT = "https://api.apify.com/v2";
var NORTH_DATA_ROOT = "https://www.northdata.com/";
var MAX_RESULTS = 1;
var MAX_TOTAL_CHARGE_USD = 0.01;
// Ta dopolnilni (2 $ / 1k) actor se po potrjenem OpenRegisterju začne hkrati z
// osnovnim North Data actorjem. Prvi odgovor ga ne čaka: shrani samo run ID,
// Plus pa pozneje prebere dataset istega runa. Plačljivega POST-a ne ponavljamo.
var POLL_WAIT_SECONDS = 25;
var START_TIMEOUT_MS = 8000;
var companyCache = require("./northdata-company-cache");
var primaryClient = require("./apify-northdata-client");
var accountGuard = require("./apify-account-guard");

function text(value, max) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 1000); }
function number(value) { var parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function safeUrl(value) { try { var url = new URL(text(value, 1000)); return url.protocol === "https:" && /(^|\.)northdata\.com$/i.test(url.hostname) ? url.toString() : ""; } catch (_) { return ""; } }
function companyRegister(company) {
  var direct = [company && company.register_type, company && company.register_number].filter(Boolean).join(" ");
  return primaryClient.registerFrom(direct || company && (company.registerNumber || company.registerId || company.registerKey));
}
function normalize(value) { return text(value, 300).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function namesCompatible(left, right) {
  var a = normalize(left), b = normalize(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  var aTokens = a.split(" ").filter(function (token) { return token.length > 1; });
  var bTokens = new Set(b.split(" ").filter(function (token) { return token.length > 1; }));
  var common = aTokens.filter(function (token) { return bTokens.has(token); }).length;
  return common / Math.max(1, aTokens.length) >= 0.75;
}
function buildInput(official) {
  return {
    compact: false, countries: ["DE"], emitExpired: false, emitUnchanged: false,
    excludeEmptyFields: true, includeEvents: true, includeFinancials: true,
    // Primarni actor že vrne osebe in povezane družbe. Dopolnilni actor zato
    // ne preiskuje še celotne mreže do sedmih subjektov, kar je povzročalo
    // 1–2-minutne rune za en sam rezultat.
    includeNetwork: false, includeOfficers: false, includeRunSummary: false,
    incrementalMode: false, maxResults: MAX_RESULTS,
    notifyOnlyChanges: true, onlyWithFinancials: false,
    queries: [text(official && official.name, 240)], language: "en", minEmployees: 0,
    notificationLimit: 10, maxConcurrency: 8, proxyConfiguration: { useApifyProxy: true },
  };
}
var ALLOWED_ITEMS = new Set(["Cash", "Receivables", "Liabilities", "Equity", "EquityRatio", "ROE", "Employees", "TotalAssets", "BalanceSheetTotal", "AssetsTotal", "Provisions", "Accruals"]);
function sanitizeItem(item) {
  if (!item || typeof item !== "object") return null;
  var value = number(item.value);
  if (value === null) return null;
  return { label: text(item.label, 120), value: value, formattedValue: text(item.formattedValue, 120), unit: item.unit == null ? null : text(item.unit, 20), estimate: item.estimate === true };
}
function sanitizeCompany(item) {
  if (!item || typeof item !== "object") return null;
  var sourceUrl = safeUrl(item.url || item.profileUrl || item.sourceUrl);
  if (!sourceUrl) return null;
  var financials = (Array.isArray(item.financials) ? item.financials : []).map(function (entry) {
    if (!entry || typeof entry !== "object") return null;
    var year = Number(entry.fiscalYear || String(entry.date || "").slice(0, 4));
    if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
    var items = {};
    Object.keys(entry.items && typeof entry.items === "object" ? entry.items : {}).forEach(function (key) {
      if (!ALLOWED_ITEMS.has(key)) return;
      var clean = sanitizeItem(entry.items[key]);
      if (clean) items[key] = clean;
    });
    return Object.keys(items).length ? { date: /^\d{4}-\d{2}-\d{2}$/.test(String(entry.date || "")) ? String(entry.date) : year + "-12-31", fiscalYear: year, consolidated: entry.consolidated === true, items: items, sourceTitle: text(entry.sourceTitle, 500), sourceDate: text(entry.sourceDate, 40) } : null;
  }).filter(Boolean).sort(function (a, b) { return a.fiscalYear - b.fiscalYear; });
  var events = (Array.isArray(item.events) ? item.events : []).slice(0, 100).map(function (event) {
    if (!event || typeof event !== "object") return null;
    return {
      category: text(event.category, 100), date: text(event.date, 40),
      title: text(event.title || event.category || event.source, 240),
      description: text(event.description || event.text, 2000),
      type: text(event.type || event.category, 80),
    };
  }).filter(function (event) { return event.date || event.title || event.description; });
  return {
    sourceUrl: sourceUrl, name: text(item.name, 240),
    registerNumber: text(item.registerNumber || item.registerId || item.registerKey, 200),
    city: text(item.city || item.address && item.address.city, 120),
    financials: financials, events: events,
  };
}
function selectCompany(items, official, primary) {
  var wanted = companyRegister(official), primaryRegister = companyRegister(primary && primary.company || {}), wantedName = normalize(official && official.name);
  var candidates = (Array.isArray(items) ? items : []).map(sanitizeCompany).filter(Boolean).filter(function (company) {
    var found = companyRegister(company), foundName = normalize(company.name);
    var registerMatch = wanted.type && wanted.number && found.type === wanted.type && found.number === wanted.number;
    var primaryMatch = primaryRegister.type && primaryRegister.number && found.type === primaryRegister.type && found.number === primaryRegister.number;
    var nameMatch = wantedName && foundName && (wantedName === foundName || wantedName.includes(foundName) || foundName.includes(wantedName));
    return Boolean((registerMatch || primaryMatch) && nameMatch);
  });
  if (candidates.length !== 1) return { status: candidates.length ? "ambiguous" : "not_found" };
  return { status: "found", company: candidates[0], match: { registerMatched: true, primaryMatched: true } };
}
function skipped(reason) { return { status: "skipped", reason: reason || "primary_northdata_required", source: "northdata_details_apify", sourceLabel: "North Data – dopolnilni podatki", sourceUrl: NORTH_DATA_ROOT, estimatedCostUsd: 0 }; }
function sourceEntry(value) {
  var item = value || skipped("not_run");
  return { id: "northdata_details", label: "North Data – dopolnilni podatki", status: item.status, reason: item.reason || "", sourceUrl: item.sourceUrl || NORTH_DATA_ROOT, message: item.status === "found" ? "Objavljene bilančne postavke in ocenjeni zaposleni so bili dopolnjeni po potrditvi istega podjetja." : item.status === "conflict" ? "Dopolnilni rezultat se ni ujemal z osnovnim North Data profilom, zato ni bil združen." : item.status === "pending_background" ? "Dodatni finančni podatki se nalagajo v ozadju; osnovni rezultat je že pripravljen." : item.status === "skipped" ? "Dopolnilni agent se izvede šele po potrjeni registrski identiteti." : "Dopolnilni podatki trenutno niso na voljo; osnovni rezultat ostaja nespremenjen." };
}

function validRunId(value) {
  var id = text(value, 80);
  return /^[A-Za-z0-9]{10,40}$/.test(id) ? id : "";
}

function officialForDetails(openregister, identity, options) {
  return primaryClient.officialForIdentity(openregister, identity, options);
}

async function startVerifiedIdentity(openregister, identity, options) {
  var opts = options || {};
  var official = officialForDetails(openregister, identity, opts);
  if (!official) return Object.assign(skipped("verified_company_required"), { status: "skipped" });
  var token = text(opts.token != null ? opts.token : process.env.APIFY_API_TOKEN, 5000);
  var fetchImpl = opts.fetch || global.fetch;
  if (!token) return Object.assign(skipped("token_missing"), { status: "not_configured" });
  if (typeof fetchImpl !== "function") return Object.assign(skipped("fetch_unavailable"), { status: "unavailable" });
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, START_TIMEOUT_MS);
  try {
    await accountGuard.verify(token, fetchImpl);
    // Dopolnilni actor teče izključno v ozadju in se ne sme ustaviti zaradi
    // uporabniškega časovnega proračuna. waitForFinish spodaj je le dolg poll
    // odjemalca in ne ustavlja Apify runa.
    var response = await fetchImpl(API_ROOT + "/acts/" + ACTOR_ID + "/runs?memory=512&maxTotalChargeUsd=" + MAX_TOTAL_CHARGE_USD, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(buildInput(official)),
      signal: controller.signal,
    });
    var payload = await response.json().catch(function () { return {}; });
    var run = payload && payload.data;
    var id = validRunId(run && run.id);
    if (!response.ok || !id) return Object.assign(skipped("start_failed"), { status: "unavailable", httpStatus: response.status });
    return {
      status: "started", actorId: ACTOR_ID, runId: id, datasetId: text(run.defaultDatasetId, 80),
      startedAt: new Date().toISOString(), source: "northdata_details_apify",
      sourceLabel: "North Data – dopolnilni podatki", sourceUrl: NORTH_DATA_ROOT,
    };
  } catch (error) {
    return Object.assign(skipped(error && error.code === "APIFY_ACCOUNT_MISMATCH" ? "account_mismatch" : error && error.name === "AbortError" ? "start_timeout" : "start_network_error"), { status: "unavailable" });
  } finally {
    clearTimeout(timer);
  }
}

async function finishStartedRun(started, official, primary, options) {
  var opts = options || {};
  var id = validRunId(started && started.runId);
  if (!id || started && started.actorId && started.actorId !== ACTOR_ID) return Object.assign(skipped("started_run_invalid"), { status: "unavailable" });
  var token = text(opts.token != null ? opts.token : process.env.APIFY_API_TOKEN, 5000);
  var fetchImpl = opts.fetch || global.fetch;
  if (!token) return Object.assign(skipped("token_missing"), { status: "not_configured" });
  if (typeof fetchImpl !== "function") return Object.assign(skipped("fetch_unavailable"), { status: "unavailable" });
  try {
    await accountGuard.verify(token, fetchImpl);
    var runResponse = await fetchImpl(API_ROOT + "/actor-runs/" + id + "?waitForFinish=" + POLL_WAIT_SECONDS, {
      method: "GET", headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    });
    var runPayload = await runResponse.json().catch(function () { return {}; });
    var run = runPayload && runPayload.data;
    if (!runResponse.ok || !run || run.actId && run.actId !== ACTOR_ID) return Object.assign(skipped("run_unavailable"), { status: "unavailable", httpStatus: runResponse.status });
    if (["READY", "RUNNING"].includes(run.status)) return Object.assign(skipped("run_still_running"), { status: "pending_background", actorId: ACTOR_ID, runId: id });
    if (run.status !== "SUCCEEDED") return Object.assign(skipped("run_failed"), { status: "unavailable" });
    var datasetId = text(run.defaultDatasetId || started && started.datasetId, 80);
    if (!/^[A-Za-z0-9]{10,40}$/.test(datasetId)) return Object.assign(skipped("dataset_missing"), { status: "unavailable" });
    var datasetResponse = await fetchImpl(API_ROOT + "/datasets/" + datasetId + "/items?clean=1&limit=" + MAX_RESULTS, {
      method: "GET", headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    });
    var rows = await datasetResponse.json().catch(function () { return []; });
    if (!datasetResponse.ok || !Array.isArray(rows)) return Object.assign(skipped("dataset_unavailable"), { status: "unavailable", httpStatus: datasetResponse.status });
    var selection = selectCompany(rows, official, primary);
    return confirmWithPrimary(Object.assign({
      actorId: ACTOR_ID, runId: id, source: "northdata_details_apify",
      sourceLabel: "North Data – dopolnilni podatki", sourceUrl: selection.company && selection.company.sourceUrl || NORTH_DATA_ROOT,
      fetchedAt: new Date().toISOString(), resultCount: rows.length, estimatedCostUsd: rows.length * 0.002,
    }, selection), primary);
  } catch (error) {
    return Object.assign(skipped(error && error.code === "APIFY_ACCOUNT_MISMATCH" ? "account_mismatch" : "run_network_error"), { status: "unavailable" });
  }
}

async function completeStartedRun(started, openregister, identity, primary, options) {
  var official = officialForDetails(openregister, identity, options);
  if (!official) {
    var noRun = skipped("verified_company_required");
    return { northDataDetails: noRun, source: sourceEntry(noRun) };
  }
  var details = await finishStartedRun(started, official, primary, options);
  return { northDataDetails: details, source: sourceEntry(details) };
}

async function enrichCompany(official, primary, options) {
  var opts = options || {}, token = text(opts.token != null ? opts.token : process.env.APIFY_API_TOKEN, 5000);
  if (!token) return Object.assign(skipped("token_missing"), { status: "not_configured" });
  var fetchImpl = opts.fetch || global.fetch;
  if (typeof fetchImpl !== "function") return Object.assign(skipped("fetch_unavailable"), { status: "unavailable" });
  // Testi lahko z notranjo opcijo uporabijo kratko mejo. HTTP handler te opcije
  // nikoli ne bere iz uporabniškega telesa.
  var timeoutSeconds = Number(opts.timeoutSeconds);
  var imaTestnoOmejitev = Number.isFinite(timeoutSeconds) && timeoutSeconds > 0;
  if (imaTestnoOmejitev) timeoutSeconds = Math.max(timeoutSeconds, 0.01);
  var controller = imaTestnoOmejitev ? new AbortController() : null;
  var timer = imaTestnoOmejitev ? setTimeout(function () { controller.abort(); }, timeoutSeconds * 1000) : null;
  try {
    await accountGuard.verify(token, fetchImpl);
    var syncUrl = API_ROOT + "/acts/" + ACTOR_ID + "/run-sync-get-dataset-items?memory=512&maxItems=" + MAX_RESULTS + "&maxTotalChargeUsd=" + MAX_TOTAL_CHARGE_USD + "&clean=1" + (imaTestnoOmejitev ? "&timeout=" + timeoutSeconds : "");
    var response = await fetchImpl(syncUrl, {
      method: "POST", headers: { Authorization: "Bearer " + token, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(buildInput(official)), signal: controller ? controller.signal : undefined,
    });
    if (!response.ok) return Object.assign(skipped("api_error"), { status: "unavailable", httpStatus: response.status });
    var rows = await response.json(), selection = selectCompany(rows, official, primary);
    return Object.assign({ actorId: ACTOR_ID, source: "northdata_details_apify", sourceLabel: "North Data – dopolnilni podatki", sourceUrl: selection.company && selection.company.sourceUrl || NORTH_DATA_ROOT, fetchedAt: new Date().toISOString(), resultCount: Array.isArray(rows) ? rows.length : 0, estimatedCostUsd: (Array.isArray(rows) ? rows.length : 0) * 0.002 }, selection);
  } catch (error) { return Object.assign(skipped(error && error.name === "AbortError" ? "timeout" : "network_error"), { status: "unavailable" }); }
  finally { if (timer) clearTimeout(timer); }
}
async function enrichAfterPrimary(openregister, identity, primary, options) {
  if (!primary || primary.status !== "found" || !primary.company) { var noRun = skipped("primary_northdata_required"); return { northDataDetails: noRun, source: sourceEntry(noRun) }; }
  var identityRegister = companyRegister(identity);
  var official = openregister && openregister.status === "found" && openregister.company ? openregister.company : { name: identity && (identity.naziv || identity.ime), register_type: identityRegister.type, register_number: identityRegister.number, address: { city: identity && identity.kraj } };
  var opts = Object.assign({}, options || {}, { cacheNamespace: "details-v1" }), result;
  try { result = await companyCache.getOrLoad(official, function () { return enrichCompany(official, primary, opts); }, opts); }
  catch (_) { result = Object.assign(skipped("unexpected_error"), { status: "unavailable" }); }
  return { northDataDetails: result, source: sourceEntry(result) };
}

async function enrichVerifiedIdentity(openregister, identity, options) {
  var opts = Object.assign({}, options || {});
  var official = officialForDetails(openregister, identity, opts);
  if (!official) {
    var noRun = skipped("verified_company_required");
    return { northDataDetails: noRun, source: sourceEntry(noRun) };
  }
  opts.cacheNamespace = "details-v2-openregister-parallel";
  var result;
  try { result = await companyCache.getOrLoad(official, function () { return enrichCompany(official, null, opts); }, opts); }
  catch (_) { result = Object.assign(skipped("unexpected_error"), { status: "unavailable" }); }
  return { northDataDetails: result, source: sourceEntry(result) };
}

function confirmWithPrimary(details, primary) {
  if (!details || details.status !== "found" || !details.company) return details;
  if (!primary || primary.status !== "found" || !primary.company) {
    return Object.assign(skipped("primary_confirmation_missing"), {
      status: "unavailable",
      verification: { status: "not_confirmed", registerMatched: false, nameMatched: false },
    });
  }
  var detailsRegister = companyRegister(details.company);
  var primaryRegister = companyRegister(primary.company);
  var registerMatched = Boolean(detailsRegister.type && detailsRegister.number &&
    detailsRegister.type === primaryRegister.type && detailsRegister.number === primaryRegister.number);
  var nameMatched = namesCompatible(details.company.name, primary.company.name);
  if (!registerMatched || !nameMatched) {
    return {
      status: "conflict", reason: !registerMatched ? "primary_register_mismatch" : "primary_name_mismatch",
      source: "northdata_details_apify", sourceLabel: "North Data – dopolnilni podatki",
      sourceUrl: details.sourceUrl || NORTH_DATA_ROOT, estimatedCostUsd: details.estimatedCostUsd || 0,
      verification: { status: "conflict", registerMatched: registerMatched, nameMatched: nameMatched },
    };
  }
  return Object.assign({}, details, {
    verification: { status: "confirmed", registerMatched: true, nameMatched: true },
  });
}

module.exports = { ACTOR_ID: ACTOR_ID, MAX_RESULTS: MAX_RESULTS, POLL_WAIT_SECONDS: POLL_WAIT_SECONDS, buildInput: buildInput, sanitizeCompany: sanitizeCompany, selectCompany: selectCompany, enrichCompany: enrichCompany, enrichAfterPrimary: enrichAfterPrimary, enrichVerifiedIdentity: enrichVerifiedIdentity, startVerifiedIdentity: startVerifiedIdentity, finishStartedRun: finishStartedRun, completeStartedRun: completeStartedRun, confirmWithPrimary: confirmWithPrimary, sourceEntry: sourceEntry };
