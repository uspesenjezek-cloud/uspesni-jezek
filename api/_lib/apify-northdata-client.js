"use strict";

var ACTOR_ID = "Ja65ilbhWnUTs1Xeb";
var companyCache = require("./northdata-company-cache");
var accountGuard = require("./apify-account-guard");
var API_ROOT = "https://api.apify.com/v2";
var NORTH_DATA_ROOT = "https://www.northdata.com/";
var MAX_RESULTS = 1;
var MAX_TOTAL_CHARGE_USD = 0.02;
var START_TIMEOUT_MS = 10000;
// Dolgi GET samo toliko časa čaka na spremembo statusa. Ta vrednost ne ustavlja
// Apify runa; actor nima več runtime omejitve in ga odjemalec ponovno preveri.
var POLL_WAIT_SECONDS = 25;

function text(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 5000);
}

function normalized(value) {
  return text(value, 500).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

var GENERIC_NAME_TOKENS = new Set(["gmbh", "mbh", "co", "kg", "ag", "ug", "ohg", "se", "ev", "e", "v"]);

function distinctiveNameTokens(value) {
  return normalized(value).split(" ").filter(function (token) {
    return token.length > 1 && !GENERIC_NAME_TOKENS.has(token);
  });
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

function sanitizeCompany(item) {
  if (!item || typeof item !== "object" || String(item.recordType || "company").toLowerCase() !== "company") return null;
  var sourceUrl = safeNorthDataUrl(item.url);
  if (!sourceUrl) return null;
  var address = item.address && typeof item.address === "object" ? item.address : {};
  return {
    recordType: "company", sourceUrl: sourceUrl, name: text(item.name, 240),
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
        status: text(officer.status, 60), action: text(officer.action, 80),
        startDate: text(officer.startDate || officer.appointedAt || officer.from, 40),
        endDate: text(officer.endDate || officer.endedAt || officer.to, 40),
      } : null;
    }),
    relatedCompanies: list(item.relatedCompanies, 50, function (related) {
      return related && typeof related === "object" ? {
        name: text(related.name, 240), type: text(related.type, 30).toLowerCase(), description: text(related.description, 500), city: text(related.city, 120),
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
    pending_background: "Dopolnilni podatki North Data se nalagajo v ozadju; registrski podatki OpenRegister so že pripravljeni.",
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

// North Data se sme začeti samo po dejanskem OpenRegister zadetku. Impressum
// je lahko iskalni kandidat za OpenRegister, nikoli pa samostojna dovolilnica
// za plačljivi North Data actor.
function officialForIdentity(openregister) {
  return openregister && openregister.status === "found" && openregister.company
    ? openregister.company
    : null;
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
  var wantedTokens = distinctiveNameTokens(official && official.name);
  var foundTokens = new Set(distinctiveNameTokens(candidate.name));
  var commonTokens = wantedTokens.filter(function (token) { return foundTokens.has(token); });
  var nameCompatible = Boolean(wantedName && foundName && (
    wantedName === foundName || wantedName.includes(foundName) || foundName.includes(wantedName) ||
    (commonTokens.length && commonTokens.length / Math.max(1, wantedTokens.length) >= 0.6)
  ));
  var wantedAddress = companyAddress(official);
  var candidateCity = normalized(candidate.address.city || candidate.city);
  var wantedCity = normalized(wantedAddress.city);
  var wantedCourt = normalized(official && (official.register_court || official.registerCourt));
  var locationCompatible = Boolean(
    (wantedAddress.postalCode && wantedAddress.postalCode === candidate.address.postalCode) ||
    (wantedCity && wantedCity === candidateCity) ||
    (wantedCourt && candidateCity && wantedCourt.includes(candidateCity))
  );
  // Registrska številka je enolična samo znotraj pristojnega sodišča. Zato
  // npr. HRA 19176 iz Augsburga ne sme preglasiti istoimenske številke iz Frankfurta.
  if (registerMatched && !nameCompatible && !locationCompatible) {
    return { candidate: candidate, score: 0, registerMatched: false };
  }
  if (wantedName && foundName) {
    if (wantedName === foundName) score += 300;
    else if (wantedName.includes(foundName) || foundName.includes(wantedName)) score += 120;
    else score += commonTokens.length * 20;
  }
  if (wantedAddress.postalCode && wantedAddress.postalCode === candidate.address.postalCode) score += 120;
  if (normalized(wantedAddress.city) && normalized(wantedAddress.city) === normalized(candidate.address.city || candidate.city)) score += 100;
  if (!wantedRegister.type && wantedName === foundName && score >= 300) score += 100;
  return { candidate: candidate, score: score, registerMatched: registerMatched };
}

async function readExistingRun(runId, official, options) {
  var id = text(runId, 80);
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) {
    throw Object.assign(new Error("Apify run ni veljaven."), { status: 400, code: "INVALID_APIFY_RUN" });
  }
  var opts = options || {};
  var token = text(opts.token != null ? opts.token : process.env.APIFY_API_TOKEN, 5000);
  if (!token) throw Object.assign(new Error("Apify povezava ni nastavljena."), { status: 503, code: "APIFY_NOT_CONFIGURED" });
  var fetchImpl = opts.fetch || global.fetch;
  if (typeof fetchImpl !== "function") throw Object.assign(new Error("Apify trenutno ni dosegljiv."), { status: 503, code: "APIFY_UNAVAILABLE" });
  var headers = { Authorization: "Bearer " + token, Accept: "application/json" };
  var runResponse = await fetchImpl(API_ROOT + "/actor-runs/" + id, { method: "GET", headers: headers });
  var runBody = await runResponse.json();
  var run = runBody && runBody.data;
  if (!runResponse.ok || !run) throw Object.assign(new Error("Apify runa ni bilo mogoče prebrati."), { status: runResponse.status || 502, code: "APIFY_RUN_UNAVAILABLE" });
  if (run.actId !== ACTOR_ID) throw Object.assign(new Error("Run ne pripada povezanemu North Data agentu."), { status: 409, code: "APIFY_ACTOR_MISMATCH" });
  if (run.status !== "SUCCEEDED" || !run.defaultDatasetId) throw Object.assign(new Error("Apify run še ni uspešno zaključen."), { status: 409, code: "APIFY_RUN_NOT_READY" });
  var datasetResponse = await fetchImpl(API_ROOT + "/datasets/" + encodeURIComponent(run.defaultDatasetId) + "/items?clean=1&limit=" + MAX_RESULTS, { method: "GET", headers: headers });
  var items = await datasetResponse.json();
  if (!datasetResponse.ok || !Array.isArray(items)) throw Object.assign(new Error("Rezultata Apify runa ni bilo mogoče prebrati."), { status: datasetResponse.status || 502, code: "APIFY_DATASET_UNAVAILABLE" });
  var selection = selectCompany(items, official);
  return Object.assign({
    source: "northdata_apify", sourceLabel: "North Data prek Apify",
    sourceUrl: selection.company && selection.company.sourceUrl || NORTH_DATA_ROOT,
    fetchedAt: new Date().toISOString(), resultCount: items.length,
    estimatedCostUsd: 0, importedRunId: id,
  }, selection);
}

function validRunId(value) {
  var id = text(value, 80);
  return /^[A-Za-z0-9]{10,40}$/.test(id) ? id : "";
}

async function startCompanyRun(official, options) {
  var opts = options || {};
  var token = text(opts.token != null ? opts.token : process.env.APIFY_API_TOKEN, 5000);
  var fetchImpl = opts.fetch || global.fetch;
  if (!token) return { status: "not_configured", reason: "token_missing", sourceUrl: NORTH_DATA_ROOT };
  if (typeof fetchImpl !== "function") return { status: "unavailable", reason: "fetch_unavailable", sourceUrl: NORTH_DATA_ROOT };
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, START_TIMEOUT_MS);
  try {
    await accountGuard.verify(token, fetchImpl);
    var response = await fetchImpl(API_ROOT + "/acts/" + ACTOR_ID + "/runs?memory=512&maxTotalChargeUsd=" + MAX_TOTAL_CHARGE_USD, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(buildInput(official)),
      signal: controller.signal,
    });
    var payload = await response.json().catch(function () { return {}; });
    var run = payload && payload.data;
    var id = validRunId(run && run.id);
    if (!response.ok || !id) {
      return { status: "unavailable", reason: reasonForStatus(response.status), httpStatus: response.status, sourceUrl: NORTH_DATA_ROOT };
    }
    return {
      status: "started", actorId: ACTOR_ID, runId: id,
      datasetId: text(run.defaultDatasetId, 80), startedAt: new Date().toISOString(),
      source: "northdata_apify", sourceLabel: "North Data prek Apify", sourceUrl: NORTH_DATA_ROOT,
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: error && error.code === "APIFY_ACCOUNT_MISMATCH" ? "account_mismatch" : error && error.name === "AbortError" ? "start_timeout" : "start_network_error",
      sourceUrl: NORTH_DATA_ROOT,
    };
  } finally { clearTimeout(timer); }
}

async function finishStartedRun(started, official, options) {
  var opts = options || {};
  var id = validRunId(started && started.runId);
  if (!id || started && started.actorId && started.actorId !== ACTOR_ID) {
    return { status: "unavailable", reason: "started_run_invalid", sourceUrl: NORTH_DATA_ROOT };
  }
  var token = text(opts.token != null ? opts.token : process.env.APIFY_API_TOKEN, 5000);
  var fetchImpl = opts.fetch || global.fetch;
  if (!token) return { status: "not_configured", reason: "token_missing", sourceUrl: NORTH_DATA_ROOT };
  if (typeof fetchImpl !== "function") return { status: "unavailable", reason: "fetch_unavailable", sourceUrl: NORTH_DATA_ROOT };
  try {
    await accountGuard.verify(token, fetchImpl);
    var runResponse = await fetchImpl(API_ROOT + "/actor-runs/" + id + "?waitForFinish=" + POLL_WAIT_SECONDS, {
      method: "GET", headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    });
    var runPayload = await runResponse.json().catch(function () { return {}; });
    var run = runPayload && runPayload.data;
    if (!runResponse.ok || !run || run.actId && run.actId !== ACTOR_ID) {
      return { status: "unavailable", reason: "run_unavailable", httpStatus: runResponse.status, sourceUrl: NORTH_DATA_ROOT };
    }
    if (["READY", "RUNNING"].includes(run.status)) {
      return { status: "pending_background", reason: "run_still_running", actorId: ACTOR_ID, runId: id, sourceUrl: NORTH_DATA_ROOT };
    }
    if (run.status !== "SUCCEEDED") {
      return { status: "unavailable", reason: "run_failed", sourceUrl: NORTH_DATA_ROOT };
    }
    var datasetId = text(run.defaultDatasetId || started && started.datasetId, 80);
    if (!/^[A-Za-z0-9]{10,40}$/.test(datasetId)) return { status: "unavailable", reason: "dataset_missing", sourceUrl: NORTH_DATA_ROOT };
    var datasetResponse = await fetchImpl(API_ROOT + "/datasets/" + datasetId + "/items?clean=1&limit=" + MAX_RESULTS, {
      method: "GET", headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    });
    var items = await datasetResponse.json().catch(function () { return []; });
    if (!datasetResponse.ok || !Array.isArray(items)) {
      return { status: "unavailable", reason: "dataset_unavailable", httpStatus: datasetResponse.status, sourceUrl: NORTH_DATA_ROOT };
    }
    var selection = selectCompany(items, official);
    return Object.assign({
      actorId: ACTOR_ID, runId: id, source: "northdata_apify", sourceLabel: "North Data prek Apify",
      sourceUrl: selection.company && selection.company.sourceUrl || NORTH_DATA_ROOT,
      fetchedAt: new Date().toISOString(), resultCount: items.length,
      estimatedCostUsd: 0.00005 + items.length * 0.004,
    }, selection);
  } catch (error) {
    return {
      status: "unavailable",
      reason: error && error.code === "APIFY_ACCOUNT_MISMATCH" ? "account_mismatch" : "run_network_error",
      sourceUrl: NORTH_DATA_ROOT,
    };
  }
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
  var query = text(official && official.name, 240) || (register.type && register.number ? register.type + " " + register.number : "");
  return {
    // Novi Jaka actor je preverjen s celotnim profilom podjetja v načinu
    // "companies"; dodatne sklope vedno zahtevamo eksplicitno spodaj.
    searchQueries: [query], country: "DE", resultType: "both",
    includeFinancials: true, includeOfficers: true, includeRelatedCompanies: true,
    // Dogodke že zbira vzporedni dopolnilni actor. Primarni rezultat jih ne
    // podvaja, da je prvi prikaz hitrejši; po zaključku se varno združijo nazaj.
    includeEvents: false, includeNews: false, maxResults: MAX_RESULTS,
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
    "?memory=512&maxItems=" + MAX_RESULTS +
    "&maxTotalChargeUsd=" + MAX_TOTAL_CHARGE_USD + "&clean=1";
  try {
    await accountGuard.verify(token, fetchImpl);
    // A paid POST is deliberately never retried automatically.
    var response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(buildInput(official)),
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
      status: "unavailable", reason: "network_error",
      sourceUrl: NORTH_DATA_ROOT,
    };
  }
}

async function enrichVerifiedIdentity(openregister, identity, options) {
  var opts = options || {};
  var sourceIdentity = officialForIdentity(openregister, identity, opts);
  if (!sourceIdentity) {
    var notRun = skipped("verified_company_required");
    return { identity: Object.assign({}, identity || {}), northData: notRun, source: sourceEntry(notRun) };
  }
  var enrichment;
  try {
    enrichment = await companyCache.getOrLoad(sourceIdentity, function () {
      return enrichCompany(sourceIdentity, opts);
    }, opts);
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

async function startVerifiedIdentity(openregister, identity, options) {
  var official = officialForIdentity(openregister, identity, options);
  if (!official) return { identity: Object.assign({}, identity || {}), start: skipped("verified_company_required") };
  return { identity: Object.assign({}, identity || {}), start: await startCompanyRun(official, options) };
}

async function completeStartedRun(started, openregister, identity, options) {
  var official = officialForIdentity(openregister, identity, options);
  if (!official) {
    var noRun = skipped("verified_company_required");
    return { identity: Object.assign({}, identity || {}), northData: noRun, source: sourceEntry(noRun) };
  }
  var enrichment = await finishStartedRun(started, official, options);
  return { identity: mergeIntoIdentity(identity, enrichment), northData: enrichment, source: sourceEntry(enrichment) };
}

module.exports = {
  ACTOR_ID: ACTOR_ID,
  MAX_RESULTS: MAX_RESULTS,
  POLL_WAIT_SECONDS: POLL_WAIT_SECONDS,
  NORTH_DATA_ROOT: NORTH_DATA_ROOT,
  buildInput: buildInput,
  registerFrom: registerFrom,
  selectCompany: selectCompany,
  sanitizeCompany: sanitizeCompany,
  enrichCompany: enrichCompany,
  readExistingRun: readExistingRun,
  mergeIntoIdentity: mergeIntoIdentity,
  sourceEntry: sourceEntry,
  officialForIdentity: officialForIdentity,
  enrichVerifiedIdentity: enrichVerifiedIdentity,
  startVerifiedIdentity: startVerifiedIdentity,
  completeStartedRun: completeStartedRun,
  startCompanyRun: startCompanyRun,
  finishStartedRun: finishStartedRun,
  companyCache: companyCache,
};
