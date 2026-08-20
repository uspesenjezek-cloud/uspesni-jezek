"use strict";

var ACTOR_ID = "9nsu4ZqEMU7DzdcW4";
var API_ROOT = "https://api.apify.com/v2";
var NORTH_DATA_ROOT = "https://www.northdata.com/";
var MAX_RESULTS = 3;
var MAX_TOTAL_CHARGE_USD = 0.02;
var TIMEOUT_SECONDS = 35;
var SNAPSHOT_MAX_BYTES = 200 * 1024;
var SNAPSHOT_MAX_DEPTH = 8;
var SNAPSHOT_MAX_KEYS = 250;
var SNAPSHOT_MAX_ITEMS = 200;
var SNAPSHOT_MAX_STRING = 10000;
var BLOCKED_SNAPSHOT_KEY = /(?:authorization|cookie|credential|password|secret|signature|token|api[_-]?key)/i;

function text(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 5000);
}

function normalized(value) {
  return text(value, 500).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function registerFrom(value) {
  var match = text(value, 200).toUpperCase().match(/\b(HRB|HRA|VR|PR|GNR)\s*([A-Z0-9-]+)\b/);
  return match ? { type: match[1], number: match[2].replace(/^0+/, "") || "0" } : { type: "", number: "" };
}

function companyRegister(company) {
  var direct = {
    type: text(company && company.register_type, 20).toUpperCase(),
    number: text(company && company.register_number, 80).toUpperCase().replace(/^0+/, ""),
  };
  return direct.type && direct.number ? direct : registerFrom(company && company.registerNumber);
}

function companyAddress(company) {
  var address = company && company.address || {};
  return {
    street: text(address.street || address.address, 200),
    postalCode: text(address.postal_code || address.postalCode, 20),
    city: text(address.city || company && company.city, 120),
    country: text(address.country || company && company.country, 10).toUpperCase(),
  };
}

function safeNorthDataUrl(value) {
  try {
    var url = new URL(text(value, 1000));
    return url.protocol === "https:" && /(^|\.)northdata\.com$/i.test(url.hostname) ? url.toString() : "";
  } catch (_) { return ""; }
}

function list(value, max, mapper) {
  return (Array.isArray(value) ? value : []).slice(0, max).map(mapper).filter(Boolean);
}

function number(value) {
  var parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function safeSnapshotKey(value) {
  var key = String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120);
  if (!key || key === "__proto__" || key === "prototype" || key === "constructor" || BLOCKED_SNAPSHOT_KEY.test(key)) return "";
  return key;
}

function sanitizeSnapshotValue(value, state, depth) {
  if (value == null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    var allowed = Math.max(0, Math.min(SNAPSHOT_MAX_STRING, state.remaining));
    var safe = value.slice(0, allowed);
    while (safe && Buffer.byteLength(safe, "utf8") > state.remaining) safe = safe.slice(0, Math.floor(safe.length * 0.9));
    state.remaining -= Buffer.byteLength(safe, "utf8");
    if (safe.length < value.length) state.truncated = true;
    return safe;
  }
  if (depth >= SNAPSHOT_MAX_DEPTH) {
    state.truncated = true;
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length > SNAPSHOT_MAX_ITEMS) state.truncated = true;
    return value.slice(0, SNAPSHOT_MAX_ITEMS).map(function (entry) {
      return sanitizeSnapshotValue(entry, state, depth + 1);
    }).filter(function (entry) { return entry !== undefined; });
  }
  if (typeof value === "object") {
    var output = {};
    var keys = Object.keys(value);
    if (keys.length > SNAPSHOT_MAX_KEYS) state.truncated = true;
    keys.slice(0, SNAPSHOT_MAX_KEYS).forEach(function (rawKey) {
      var key = safeSnapshotKey(rawKey);
      if (!key) {
        state.truncated = true;
        return;
      }
      var keyBytes = Buffer.byteLength(key, "utf8");
      if (state.remaining <= keyBytes) {
        state.truncated = true;
        return;
      }
      state.remaining -= keyBytes;
      var child = sanitizeSnapshotValue(value[rawKey], state, depth + 1);
      if (child !== undefined) output[key] = child;
    });
    return output;
  }
  state.truncated = true;
  return undefined;
}

function selectedCompanySnapshot(item) {
  var budget = Math.floor(SNAPSHOT_MAX_BYTES * 0.72);
  var result = null;
  var state = null;
  for (var attempt = 0; attempt < 5; attempt += 1) {
    state = { remaining: budget, truncated: false };
    result = sanitizeSnapshotValue(item, state, 0);
    if (jsonBytes(result) <= SNAPSHOT_MAX_BYTES) break;
    budget = Math.floor(budget * 0.7);
    state.truncated = true;
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) result = {};
  while (jsonBytes(result) > SNAPSHOT_MAX_BYTES && Object.keys(result).length) {
    var largestKey = Object.keys(result).sort(function (a, b) {
      return jsonBytes(result[b]) - jsonBytes(result[a]);
    })[0];
    delete result[largestKey];
    state.truncated = true;
  }
  return {
    data: result,
    fields: Object.keys(result).sort(),
    truncated: Boolean(state && state.truncated) || jsonBytes(result) > SNAPSHOT_MAX_BYTES,
    sizeBytes: jsonBytes(result),
  };
}

function sanitizeCompany(item) {
  if (!item || typeof item !== "object" || String(item.recordType || "company").toLowerCase() !== "company") return null;
  var sourceUrl = safeNorthDataUrl(item.url);
  if (!sourceUrl) return null;
  var address = item.address && typeof item.address === "object" ? item.address : {};
  var snapshot = selectedCompanySnapshot(item);
  return {
    recordType: "company", sourceUrl: sourceUrl, name: text(item.name, 240),
    companyId: text(item.companyId, 120),
    status: text(item.status, 60), legalForm: text(item.legalForm, 80),
    foundingDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.foundingDate || "")) ? String(item.foundingDate) : "",
    corporatePurpose: text(item.corporatePurpose, 5000), registerNumber: text(item.registerNumber, 200),
    nationalIds: list(item.nationalIds, 20, function (id) {
      return id && typeof id === "object" ? { source: text(id.source, 100), value: text(id.value, 200) } : null;
    }),
    leiCode: text(item.leiCode, 80),
    address: {
      street: text(address.street, 200), postalCode: text(address.postalCode, 20),
      city: text(address.city || item.city, 120), country: text(address.country || item.country, 10).toUpperCase(),
    },
    city: text(item.city || address.city, 120), country: text(item.country || address.country, 10).toUpperCase(),
    employees: number(item.employees), revenue: number(item.revenue), earnings: number(item.earnings),
    riskLevel: /^(green|yellow|red)$/i.test(String(item.riskLevel || "")) ? String(item.riskLevel).toLowerCase() : "",
    riskFlags: list(item.riskFlags, 30, function (flag) {
      return flag && typeof flag === "object" ? {
        name: text(flag.name, 160), level: text(flag.level, 20).toLowerCase(), evaluation: text(flag.evaluation, 1000),
      } : null;
    }),
    officers: list(item.officers, 60, function (officer) {
      return officer && typeof officer === "object" ? {
        name: text(officer.name, 200), givenName: text(officer.givenName, 100),
        familyName: text(officer.familyName, 100), role: text(officer.role, 200), url: safeNorthDataUrl(officer.url),
      } : null;
    }),
    relatedCompanies: list(item.relatedCompanies, 50, function (related) {
      return related && typeof related === "object" ? {
        name: text(related.name, 240), description: text(related.description, 500), city: text(related.city, 120),
        registerKey: text(related.registerKey, 200),
        relationships: list(related.relationships, 20, function (v) { return text(v, 120); }),
        url: safeNorthDataUrl(related.url),
      } : null;
    }),
    financials: list(item.financials, 30, function (metric) {
      return metric && typeof metric === "object" ? {
        metric: text(metric.metric, 120),
        values: list(metric.values, 30, function (entry) {
          return entry && typeof entry === "object" ? {
            year: Number.isFinite(Number(entry.year)) ? Number(entry.year) : null, value: number(entry.value),
            formattedValue: text(entry.formattedValue, 120), consolidated: Boolean(entry.consolidated),
            estimate: Boolean(entry.estimate), publicationTitle: text(entry.publicationTitle, 240),
            publicationDate: text(entry.publicationDate, 40),
          } : null;
        }),
      } : null;
    }),
    balanceSheets: list(item.balanceSheets, 20, function (sheet) {
      return sheet && typeof sheet === "object" ? {
        section: text(sheet.section, 120), date: text(sheet.date, 40),
        lines: list(sheet.lines, 100, function (line) {
          return line && typeof line === "object" ? {
            name: text(line.name, 240), value: number(line.value),
            formattedValue: text(line.formattedValue, 120), level: Number(line.level) || 0,
          } : null;
        }),
      } : null;
    }),
    events: list(item.events, 100, function (event) {
      return event && typeof event === "object" ? {
        category: text(event.category, 100), date: text(event.date, 40), title: text(event.title, 240),
        description: text(event.description, 2000), type: text(event.type, 80),
      } : null;
    }),
    news: list(item.news, 100, function (entry) {
      return entry && typeof entry === "object" ? {
        title: text(entry.title, 300), date: text(entry.date || entry.publishedAt, 60),
        source: text(entry.source || entry.publisher, 160), summary: text(entry.summary || entry.description, 3000),
        url: /^https:\/\//i.test(String(entry.url || "")) ? text(entry.url, 1000) : "",
      } : null;
    }),
    availableData: snapshot.data,
    dataAvailability: {
      schemaVersion: "northdata-selected-company-v1", fields: snapshot.fields,
      truncated: snapshot.truncated, sizeBytes: snapshot.sizeBytes,
    },
    scrapedAt: text(item.scrapedAt || item.fetchedAt, 60),
  };
}

function skipped(reason) {
  return {
    status: "skipped", reason: text(reason, 80) || "verified_company_required",
    source: "northdata_apify", sourceLabel: "North Data prek Apify", sourceUrl: NORTH_DATA_ROOT,
  };
}

function mergeIntoIdentity(identity, enrichment) {
  var merged = Object.assign({}, identity || {});
  if (!enrichment || enrichment.status !== "found" || !enrichment.company) return merged;
  var company = enrichment.company;
  // North Data je samo dopolnilni vir. Uradnega imena, naslova, registra,
  // statusa in vrste subjekta nikoli ne prepiše.
  if (!merged.incorporatedAt && company.foundingDate) merged.incorporatedAt = company.foundingDate;
  if (!merged.purpose && company.corporatePurpose) merged.purpose = company.corporatePurpose;
  merged.northDataSourceUrl = company.sourceUrl || enrichment.sourceUrl || "";
  return merged;
}

function sourceEntry(enrichment) {
  var value = enrichment || skipped("not_run");
  var messages = {
    found: "Dopolnilni podatki podjetja so bili pridobljeni in vezani na potrjen registrski zapis.",
    not_found: "North Data za potrjeno registrsko oznako ni vrnil ujemajočega podjetja.",
    ambiguous: "North Data je vrnil več podobnih zadetkov, zato podatki niso bili samodejno združeni.",
    not_configured: "North Data povezava še ni nastavljena; osnovna preverba se nadaljuje brez nje.",
    unavailable: "North Data trenutno ni dosegljiv; osnovna preverba se nadaljuje brez njega.",
    skipped: "North Data se uporabi šele po zanesljivi potrditvi registriranega podjetja.",
  };
  return {
    id: "northdata", label: "North Data", status: value.status || "unavailable",
    reason: value.reason || "", sourceUrl: value.sourceUrl || NORTH_DATA_ROOT,
    message: messages[value.status] || messages.unavailable,
  };
}

function scoreCandidate(item, official) {
  var candidate = sanitizeCompany(item);
  if (!candidate) return { candidate: null, score: 0, registerMatched: false };
  var wantedRegister = companyRegister(official);
  var foundRegister = registerFrom(candidate.registerNumber);
  var registerMatched = Boolean(wantedRegister.type && wantedRegister.number &&
    wantedRegister.type === foundRegister.type && wantedRegister.number === foundRegister.number);
  if (wantedRegister.type && wantedRegister.number && !registerMatched) {
    return { candidate: candidate, score: 0, registerMatched: false };
  }
  var score = registerMatched ? 1000 : 0;
  var wantedName = normalized(official && official.name);
  var foundName = normalized(candidate.name);
  if (wantedName && foundName) {
    if (wantedName === foundName) score += 300;
    else if (wantedName.includes(foundName) || foundName.includes(wantedName)) score += 120;
    else {
      var tokens = wantedName.split(" ").filter(function (token) { return token.length > 1; });
      var foundTokens = new Set(foundName.split(" "));
      score += tokens.filter(function (token) { return foundTokens.has(token); }).length * 20;
    }
  }
  var wantedAddress = companyAddress(official);
  if (wantedAddress.postalCode && wantedAddress.postalCode === candidate.address.postalCode) score += 120;
  if (normalized(wantedAddress.city) && normalized(wantedAddress.city) === normalized(candidate.address.city || candidate.city)) score += 100;
  if (!wantedRegister.type && wantedName === foundName && score >= 300) score += 100;
  return { candidate: candidate, score: score, registerMatched: registerMatched };
}

function selectCompany(items, official) {
  var ranked = (Array.isArray(items) ? items : []).map(function (item) { return scoreCandidate(item, official); })
    .filter(function (entry) { return entry.candidate && entry.score > 0; })
    .sort(function (a, b) { return b.score - a.score; });
  var officialRegister = companyRegister(official);
  var minimum = officialRegister.type && officialRegister.number ? 1000 : 400;
  if (!ranked.length || ranked[0].score < minimum) return { status: "not_found" };
  if (ranked[1] && ranked[1].score >= minimum && ranked[0].score - ranked[1].score < 50) {
    return {
      status: "ambiguous",
      candidates: ranked.slice(0, 3).map(function (entry) {
        return { name: entry.candidate.name, sourceUrl: entry.candidate.sourceUrl, registerNumber: entry.candidate.registerNumber };
      }),
    };
  }
  return {
    status: "found", company: ranked[0].candidate,
    match: { score: ranked[0].score, registerMatched: ranked[0].registerMatched },
  };
}

function buildInput(official) {
  var register = companyRegister(official);
  var query = register.type && register.number ? register.type + " " + register.number : text(official && official.name, 240);
  return {
    searchQueries: [query], country: "DE", resultType: "companies",
    includeFinancials: true, includeOfficers: true, includeRelatedCompanies: true,
    includeEvents: true, includeNews: true, maxResults: MAX_RESULTS,
  };
}

function reasonForStatus(status) {
  if (status === 401 || status === 403) return "not_configured";
  if (status === 402) return "payment_required";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limited";
  return "api_error";
}

async function enrichCompany(official, options) {
  var opts = options || {};
  var token = text(opts.token != null ? opts.token : process.env.APIFY_API_TOKEN, 5000);
  if (!token) return { status: "not_configured", reason: "token_missing", sourceUrl: NORTH_DATA_ROOT };
  var fetchImpl = opts.fetch || global.fetch;
  if (typeof fetchImpl !== "function") {
    return { status: "unavailable", reason: "fetch_unavailable", sourceUrl: NORTH_DATA_ROOT };
  }
  var url = API_ROOT + "/acts/" + ACTOR_ID + "/run-sync-get-dataset-items" +
    "?timeout=" + TIMEOUT_SECONDS + "&memory=512&maxItems=" + MAX_RESULTS +
    "&maxTotalChargeUsd=" + MAX_TOTAL_CHARGE_USD + "&clean=1";
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, (TIMEOUT_SECONDS + 5) * 1000);
  try {
    // A paid POST is deliberately never retried automatically.
    var response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(buildInput(official)), signal: controller.signal,
    });
    if (!response.ok) {
      return {
        status: response.status === 401 || response.status === 403 ? "not_configured" : "unavailable",
        reason: reasonForStatus(response.status), httpStatus: response.status, sourceUrl: NORTH_DATA_ROOT,
      };
    }
    var items = await response.json();
    var selection = selectCompany(items, official);
    return Object.assign({
      source: "northdata_apify", sourceLabel: "North Data prek Apify",
      sourceUrl: selection.company && selection.company.sourceUrl || NORTH_DATA_ROOT,
      fetchedAt: new Date().toISOString(), resultCount: Array.isArray(items) ? items.length : 0,
      estimatedCostUsd: 0.00005 + (Array.isArray(items) ? items.length : 0) * 0.004,
    }, selection);
  } catch (error) {
    return {
      status: "unavailable", reason: error && error.name === "AbortError" ? "timeout" : "network_error",
      sourceUrl: NORTH_DATA_ROOT,
    };
  } finally { clearTimeout(timer); }
}

async function enrichVerifiedIdentity(openregister, identity, options) {
  if (!openregister || openregister.status !== "found" || !openregister.company ||
      !identity || identity.status !== "verified_register" || identity.entityType !== "company") {
    var notRun = skipped("verified_company_required");
    return { identity: Object.assign({}, identity || {}), northData: notRun, source: sourceEntry(notRun) };
  }
  var enrichment;
  try {
    enrichment = await enrichCompany(openregister.company, options);
  } catch (_) {
    enrichment = {
      status: "unavailable", reason: "unexpected_error", source: "northdata_apify",
      sourceLabel: "North Data prek Apify", sourceUrl: NORTH_DATA_ROOT,
    };
  }
  return {
    identity: mergeIntoIdentity(identity, enrichment), northData: enrichment,
    source: sourceEntry(enrichment),
  };
}

module.exports = {
  ACTOR_ID: ACTOR_ID,
  NORTH_DATA_ROOT: NORTH_DATA_ROOT,
  buildInput: buildInput,
  registerFrom: registerFrom,
  selectCompany: selectCompany,
  sanitizeCompany: sanitizeCompany,
  selectedCompanySnapshot: selectedCompanySnapshot,
  SNAPSHOT_MAX_BYTES: SNAPSHOT_MAX_BYTES,
  enrichCompany: enrichCompany,
  mergeIntoIdentity: mergeIntoIdentity,
  sourceEntry: sourceEntry,
  enrichVerifiedIdentity: enrichVerifiedIdentity,
};
