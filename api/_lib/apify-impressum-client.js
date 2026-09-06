"use strict";

var accountGuard = require("./apify-account-guard");

// Apify is a fast discovery source for a genuine German legal notice.  It is
// deliberately not identity proof: the handler still validates the returned
// name/address against the entered party and OpenRegister remains the only
// route that can unlock automatic insolvency.
var ACTOR_ID = "LGk761bRGOtWHgBSw";
var API_ROOT = "https://api.apify.com/v2";
var TIMEOUT_MS = 130000;
var POSITIVE_TTL_MS = 15 * 60 * 1000;
var NEGATIVE_TTL_MS = 2 * 60 * 1000;
var cache = globalThis.__ujApifyImpressumCache || (globalThis.__ujApifyImpressumCache = new Map());
var inFlight = globalThis.__ujApifyImpressumInFlight || (globalThis.__ujApifyImpressumInFlight = new Map());
var fetchImplementation = null;

function text(value, max) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 300);
}

function firstValue(item, names) {
  var source = item && typeof item === "object" ? item : {};
  for (var i = 0; i < names.length; i += 1) {
    var path = names[i].split(".");
    var value = source;
    for (var j = 0; j < path.length && value != null; j += 1) value = value[path[j]];
    if (typeof value === "string" && text(value)) return text(value);
  }
  return "";
}

function splitAddress(value) {
  var raw = String(value || "");
  // Actor lahko pred ulico v isti vrednosti ponovi naziv podjetja. Ulico zato
  // iščemo tik pred PLZ, namesto da bi predpostavili, da je prva vrstica naslov.
  var streetMatches = Array.from(raw.matchAll(/([^,;\n]{2,120}?\s+\d+[a-z]?)\s+(\d{5})\s+([^,;\n]{2,120})/giu));
  if (streetMatches.length) {
    var match = streetMatches[streetMatches.length - 1];
    var street = text(match[1], 220).replace(/^.*[,;]\s*/, "");
    return { street: street, postalCode: match[2], city: text(match[3], 120) };
  }
  var lines = raw.split(/[\n,;]+/).map(function (line) { return text(line, 220); }).filter(Boolean);
  var postalIndex = lines.findIndex(function (line) { return /\b\d{5}\s+[^\d]{2,}/.test(line); });
  var postalLine = postalIndex >= 0 ? lines[postalIndex] : "";
  var postal = postalLine.match(/\b(\d{5})\s+(.+)$/);
  return {
    street: postalIndex > 0 ? lines.slice(0, postalIndex).join(", ") : "",
    postalCode: postal ? postal[1] : "",
    city: postal ? text(postal[2], 120) : "",
  };
}

function validSourceUrl(value) {
  try {
    var url = new URL(String(value || ""));
    return /^https?:$/.test(url.protocol) ? url.toString() : "";
  } catch (_) { return ""; }
}

function normalizeItem(item) {
  var rawAddress = firstValue(item, ["address", "fullAddress", "company.address", "legalNotice.address"]);
  var parsed = splitAddress(rawAddress);
  var street = firstValue(item, ["street", "streetAddress", "address.street", "company.address.street", "legalNotice.street"]) || parsed.street;
  var postalCode = firstValue(item, ["postalCode", "postal_code", "zip", "zipCode", "address.postalCode", "address.zip", "company.address.postalCode"]) || parsed.postalCode;
  var city = firstValue(item, ["city", "address.city", "company.address.city", "legalNotice.city"]) || parsed.city;
  var legalName = firstValue(item, ["legalName", "companyName", "company_name", "businessName", "company.name", "legalNotice.companyName"]);
  var owner = firstValue(item, ["owner", "ownerName", "proprietor", "proprietorName", "holder", "inhalber", "managingDirector", "managing_director", "representative", "company.owner"]);
  var sourceUrl = validSourceUrl(firstValue(item, ["legalPageUrl", "legal_page_url", "sourceUrl", "source_url", "impressumUrl", "imprintUrl", "legalNoticeUrl", "url", "legalNotice.url"]));
  // Actor je samo iskalec kandidata. Delni rezultat (npr. samo oseba in
  // neposredni /impressum URL) je še vedno uporaben za en OpenRegister poskus,
  // nikoli pa sam po sebi ne postane dokaz ali dovoljenje za insolvenco.
  if (!(legalName || owner) || !sourceUrl) return null;
  return {
    legalName: legalName,
    owner: owner,
    street: text(street, 220),
    postalCode: postalCode,
    city: text(city, 120),
    sourceUrl: sourceUrl,
    registerNumber: firstValue(item, ["registrationNumber", "registerNumber", "commercialRegisterNumber"]),
    registerCourt: firstValue(item, ["registerCourt", "court", "commercialRegisterCourt"]),
    vatId: firstValue(item, ["vatId", "vatNumber", "vat_id"]),
  };
}

function domainFromWebsite(website) {
  try {
    var url = new URL(String(website || ""));
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch (_) { return ""; }
}

function cacheKey(website) { return domainFromWebsite(website); }

function normalizedWebsiteUrl(website) {
  try {
    var url = new URL(String(website || "").trim());
    return /^https?:$/.test(url.protocol) ? url.toString() : "";
  } catch (_) { return ""; }
}

function configuration(options) {
  var token = text(options && options.token != null ? options.token : process.env.APIFY_API_TOKEN, 5000);
  return token ? { enabled: true, token: token } : { enabled: false, reason: "not_configured" };
}

async function findLegalNotice(website, options) {
  var domain = domainFromWebsite(website);
  var websiteUrl = normalizedWebsiteUrl(website);
  if (!domain || !websiteUrl) return { status: "not_provided", reason: "website_invalid" };
  var config = configuration(options);
  if (!config.enabled) return { status: config.reason, reason: config.reason };
  var key = cacheKey(website);
  var existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value;
  if (existing) cache.delete(key);
  if (inFlight.has(key)) return inFlight.get(key);
  var promise = (async function () {
    var fetchFn = options && options.fetch || fetchImplementation || global.fetch;
    if (typeof fetchFn !== "function") return { status: "unavailable", reason: "fetch_unavailable" };
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    try {
      await accountGuard.verify(config.token, fetchFn);
      var response = await fetchFn(API_ROOT + "/acts/" + ACTOR_ID + "/run-sync-get-dataset-items?timeout=120&memory=1024&clean=1", {
        method: "POST",
        headers: { Authorization: "Bearer " + config.token, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ domains: [websiteUrl], contactPageFallback: true, maxItems: 1, maxConcurrency: 2, proxyConfiguration: { useApifyProxy: false } }),
        signal: controller.signal,
      });
      if (!response.ok) return { status: response.status === 401 || response.status === 403 ? "not_configured" : "unavailable", reason: "http_" + response.status, httpStatus: response.status };
      var items = await response.json();
      var candidate = Array.isArray(items) ? items.map(normalizeItem).find(Boolean) : null;
      if (candidate) return { status: "found", candidate: candidate, sourceUrl: candidate.sourceUrl, source: "apify_impressum" };
      var firstItem = Array.isArray(items) && items[0] && typeof items[0] === "object" ? items[0] : {};
      var legalPageType = text(firstItem.legalPageType || firstItem.legal_page_type, 80).toLowerCase();
      var sourceUrl = validSourceUrl(firstValue(firstItem, ["legalPageUrl", "legal_page_url", "sourceUrl", "source_url", "url"]));
      var actorError = text(firstItem.error, 300);
      return {
        status: "not_found",
        reason: legalPageType === "contact" ? "contact_page_only" : actorError ? "legal_identity_unreadable" : "legal_identity_missing",
        sourceUrl: sourceUrl,
        legalPageType: legalPageType,
        actorError: actorError,
        source: "apify_impressum",
      };
    } catch (error) {
      return {
        status: error && error.code === "APIFY_NOT_CONFIGURED" ? "not_configured" : "unavailable",
        reason: error && error.code === "APIFY_ACCOUNT_MISMATCH" ? "account_mismatch" :
          error && error.code === "APIFY_ACCOUNT_CHECK_UNAVAILABLE" ? "account_check_unavailable" :
            error && error.name === "AbortError" ? "timeout" : "network_error",
      };
    } finally { clearTimeout(timer); }
  })().then(function (result) {
    cache.set(key, { value: result, expiresAt: Date.now() + (result.status === "found" ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) });
    return result;
  }).finally(function () { inFlight.delete(key); });
  inFlight.set(key, promise);
  return promise;
}

function resetForTests() {
  cache.clear();
  inFlight.clear();
  fetchImplementation = null;
  accountGuard._test.reset();
}

module.exports = {
  ACTOR_ID: ACTOR_ID,
  findLegalNotice: findLegalNotice,
  normalizeItem: normalizeItem,
  domainFromWebsite: domainFromWebsite,
  normalizedWebsiteUrl: normalizedWebsiteUrl,
  _test: { reset: resetForTests, setFetch: function (value) { fetchImplementation = value; }, timeoutMs: TIMEOUT_MS },
};
