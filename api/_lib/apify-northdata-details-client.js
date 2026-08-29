"use strict";

var ACTOR_ID = "vKs8nu688v4F1se82";
var API_ROOT = "https://api.apify.com/v2";
var NORTH_DATA_ROOT = "https://www.northdata.com/";
var MAX_TOTAL_CHARGE_USD = 0.01;
// Ta dopolnilni (2 $ / 1k) actor ne sme zadržati celotne bonitetne preverbe.
// Po 10 sekundah ga opustimo in nadaljujemo samo z osnovnim North Data rezultatom.
var TIMEOUT_SECONDS = 10;
var companyCache = require("./northdata-company-cache");
var primaryClient = require("./apify-northdata-client");

function text(value, max) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 1000); }
function number(value) { var parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function safeUrl(value) { try { var url = new URL(text(value, 1000)); return url.protocol === "https:" && /(^|\.)northdata\.com$/i.test(url.hostname) ? url.toString() : ""; } catch (_) { return ""; } }
function companyRegister(company) {
  var direct = [company && company.register_type, company && company.register_number].filter(Boolean).join(" ");
  return primaryClient.registerFrom(direct || company && (company.registerNumber || company.registerId || company.registerKey));
}
function normalize(value) { return text(value, 300).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function buildInput(official) {
  return {
    compact: false, countries: ["DE"], emitExpired: false, emitUnchanged: false,
    excludeEmptyFields: false, includeEvents: true, includeFinancials: true,
    includeNetwork: true, includeOfficers: true, includeRunSummary: true,
    incrementalMode: false, maxResults: 1, networkMaxNodes: 7,
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
  return { sourceUrl: sourceUrl, name: text(item.name, 240), registerNumber: text(item.registerNumber || item.registerId || item.registerKey, 200), city: text(item.city || item.address && item.address.city, 120), financials: financials };
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
  return { id: "northdata_details", label: "North Data – dopolnilni podatki", status: item.status, reason: item.reason || "", sourceUrl: item.sourceUrl || NORTH_DATA_ROOT, message: item.status === "found" ? "Objavljene bilančne postavke in ocenjeni zaposleni so bili dopolnjeni po potrditvi istega podjetja." : item.status === "skipped" ? "Dopolnilni agent se izvede šele po uspešnem osnovnem North Data ujemanju." : "Dopolnilni podatki trenutno niso na voljo; osnovni rezultat ostaja nespremenjen." };
}
async function enrichCompany(official, primary, options) {
  var opts = options || {}, token = text(opts.token != null ? opts.token : process.env.APIFY_API_TOKEN, 5000);
  if (!token) return Object.assign(skipped("token_missing"), { status: "not_configured" });
  var fetchImpl = opts.fetch || global.fetch;
  if (typeof fetchImpl !== "function") return Object.assign(skipped("fetch_unavailable"), { status: "unavailable" });
  var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, TIMEOUT_SECONDS * 1000);
  try {
    var response = await fetchImpl(API_ROOT + "/acts/" + ACTOR_ID + "/run-sync-get-dataset-items?timeout=" + TIMEOUT_SECONDS + "&memory=512&maxItems=1&maxTotalChargeUsd=" + MAX_TOTAL_CHARGE_USD + "&clean=1", {
      method: "POST", headers: { Authorization: "Bearer " + token, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(buildInput(official)), signal: controller.signal,
    });
    if (!response.ok) return Object.assign(skipped("api_error"), { status: "unavailable", httpStatus: response.status });
    var rows = await response.json(), selection = selectCompany(rows, official, primary);
    return Object.assign({ actorId: ACTOR_ID, source: "northdata_details_apify", sourceLabel: "North Data – dopolnilni podatki", sourceUrl: selection.company && selection.company.sourceUrl || NORTH_DATA_ROOT, fetchedAt: new Date().toISOString(), resultCount: Array.isArray(rows) ? rows.length : 0, estimatedCostUsd: (Array.isArray(rows) ? rows.length : 0) * 0.002 }, selection);
  } catch (error) { return Object.assign(skipped(error && error.name === "AbortError" ? "timeout" : "network_error"), { status: "unavailable" }); }
  finally { clearTimeout(timer); }
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
module.exports = { ACTOR_ID: ACTOR_ID, TIMEOUT_SECONDS: TIMEOUT_SECONDS, buildInput: buildInput, sanitizeCompany: sanitizeCompany, selectCompany: selectCompany, enrichCompany: enrichCompany, enrichAfterPrimary: enrichAfterPrimary, sourceEntry: sourceEntry };
