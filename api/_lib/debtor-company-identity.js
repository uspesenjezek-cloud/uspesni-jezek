"use strict";

var db = require("./supabase-server");
var profileStore = require("./boniteta-pro-store");
var identitySearch = require("./openregister-identity-search");

var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function clean(value, limit) {
  return String(value == null ? "" : value).trim().replace(/\s+/g, " ").slice(0, limit || 500);
}

function normalize(value) {
  return clean(value, 240).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE").replace(/[^a-z0-9]+/g, " ").trim();
}

function cacheKey(value) { return "v1|" + normalize(value); }

function sanitizeCompany(value) {
  var company = identitySearch.compactCompany(value);
  if (!company.company_id || !company.name) return null;
  return company;
}

function publicCompany(value, userId) {
  var company = sanitizeCompany(value);
  if (!company) return null;
  return Object.assign({}, company, {
    identity_proof: identitySearch.signCompany(company, userId),
    source: "openregister_verified_search",
  });
}

async function cacheRest(cfg, path, options) {
  return profileStore.rest(cfg, path, options);
}

async function getCached(cfg, query, userId) {
  var rows = await cacheRest(cfg, "openregister_identity_search_cache?select=results,searched_at,expires_at" +
    "&normalized_query=eq." + encodeURIComponent(cacheKey(query)) + "&status=eq.ready" +
    "&expires_at=gt." + encodeURIComponent(new Date().toISOString()) + "&limit=1");
  if (!Array.isArray(rows) || !rows[0]) return null;
  return {
    results: (Array.isArray(rows[0].results) ? rows[0].results : []).map(function (company) {
      return publicCompany(company, userId);
    }).filter(Boolean),
    searchedAt: rows[0].searched_at || "",
    expiresAt: rows[0].expires_at || "",
  };
}

async function claim(cfg, query) {
  return Boolean(await db.pokliciRpc(cfg, "claim_openregister_identity_search", {
    p_normalized_query: cacheKey(query),
    p_display_query: clean(query, 160),
    p_lock_seconds: 45,
  }));
}

function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

async function waitForCached(cfg, query, userId, timeoutMs) {
  var until = Date.now() + Math.max(0, Number(timeoutMs) || 0);
  while (Date.now() < until) {
    await wait(350);
    var cached = await getCached(cfg, query, userId);
    if (cached) return cached;
  }
  return null;
}

async function saveCache(cfg, query, results, failed) {
  var now = new Date();
  var sanitized = (Array.isArray(results) ? results : []).map(sanitizeCompany).filter(Boolean).slice(0, 10);
  await cacheRest(cfg, "openregister_identity_search_cache?normalized_query=eq." + encodeURIComponent(cacheKey(query)), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: {
      status: failed ? "failed" : "ready",
      results: sanitized,
      searched_at: now.toISOString(),
      expires_at: new Date(now.getTime() + (failed ? 5 * 60 * 1000 : CACHE_TTL_MS)).toISOString(),
      lock_until: null,
      updated_at: now.toISOString(),
    },
  });
  return sanitized;
}

async function search(userCfg, userId, query, dependencies) {
  var term = clean(query, 160);
  if (term.length < 3) throw Object.assign(new Error("Vnesite vsaj tri znake imena podjetja."), { status: 400, code: "QUERY_TOO_SHORT" });
  var deps = dependencies || {};
  var serviceCfg = deps.serviceCfg || db.konfiguracija();
  var cached = await getCached(serviceCfg, term, userId);
  if (cached) return { results: cached.results, cached: true, creditsUsed: 0 };
  if (!(await claim(serviceCfg, term))) {
    var shared = await waitForCached(serviceCfg, term, userId, 5000);
    if (shared) return { results: shared.results, cached: true, creditsUsed: 0 };
    throw Object.assign(new Error("Isto podjetje se že preverja. Poskusite znova čez nekaj sekund."), { status: 409, code: "IDENTITY_SEARCH_IN_PROGRESS" });
  }
  try {
    var found = await (deps.identitySearch || identitySearch).search(term, userId);
    await saveCache(serviceCfg, term, found.results, false);
    return { results: found.results, cached: found.cached, creditsUsed: found.cached ? 0 : 1 };
  } catch (error) {
    await saveCache(serviceCfg, term, [], true).catch(function () {});
    throw error;
  }
}

function profilePayload(company) {
  var address = company.address || {};
  return {
    companyId: company.company_id,
    legalName: company.name,
    registerNumber: [company.register_type, company.register_number].filter(Boolean).join(" "),
    registerCourt: company.register_court,
    companyStatus: company.active === false ? "inactive" : "active",
    address: { street: address.street || "", postal_code: address.postal_code || "", city: address.city || "" },
    latestCheck: {
      source: "debtor_company_identity_search",
      identityStatus: "verified_register",
      identity: {
        status: "verified_register", companyId: company.company_id, naziv: company.name,
        registerType: company.register_type, registerNumber: company.register_number,
        registerCourt: company.register_court, legalForm: company.legal_form,
        active: company.active !== false, naslov: address.street || "",
        postnaStevilka: address.postal_code || "", kraj: address.city || "",
      },
    },
    checkedAt: new Date().toISOString(),
  };
}

async function saveSelection(cfg, userId, proof) {
  var company = identitySearch.verifyCompanyProof(proof, userId);
  if (!company) throw Object.assign(new Error("Izbrani registrski rezultat ni več veljaven. Podjetje poiščite znova."), { status: 409, code: "IDENTITY_PROOF_INVALID" });
  var existing = await profileStore.getProfileByCompanyId(cfg, userId, company.company_id);
  var profile = existing || await profileStore.upsertProfile(cfg, userId, profilePayload(company));
  var rows = await profileStore.rest(cfg, "dolznik_podjetja?on_conflict=user_id,company_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: {
      user_id: userId,
      profile_id: profile && profile.id || null,
      company_id: company.company_id,
      legal_name: company.name,
      register_type: company.register_type || null,
      register_number: company.register_number || null,
      register_court: company.register_court || null,
      legal_form: company.legal_form || null,
      company_status: company.active === false ? "inactive" : "active",
      checked_at: new Date().toISOString(),
      next_check_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      last_credits_used: 0,
      disabled: true,
      updated_at: new Date().toISOString(),
    },
  });
  return { company: company, profile: profile, record: Array.isArray(rows) ? rows[0] : rows };
}

async function list(cfg, userId) {
  return profileStore.rest(cfg, "dolznik_podjetja?user_id=eq." + encodeURIComponent(userId) +
    "&select=company_id,legal_name,register_type,register_number,register_court,legal_form,company_status,checked_at" +
    "&order=updated_at.desc&limit=200");
}

function exactCompany(results, companyId) {
  var wanted = clean(companyId, 140).toUpperCase();
  return (Array.isArray(results) ? results : []).map(sanitizeCompany).find(function (company) {
    return company && company.company_id.toUpperCase() === wanted;
  }) || null;
}

async function refreshDue(dependencies) {
  var deps = dependencies || {};
  var serviceCfg = deps.serviceCfg || db.konfiguracija();
  var claimedValue = await db.pokliciRpc(serviceCfg, "claim_due_debtor_company_refresh", { p_lease_seconds: 75 });
  var claimed = Array.isArray(claimedValue) ? claimedValue[0] : claimedValue;
  if (!claimed || !claimed.id) return null;
  var creditsUsed = 0;
  var providerAttempted = false;
  try {
    providerAttempted = true;
    var found = await (deps.identitySearch || identitySearch).search(claimed.legal_name, claimed.user_id);
    creditsUsed = found.cached ? 0 : 1;
    var company = exactCompany(found.results, claimed.company_id);
    if (!company) throw Object.assign(new Error("OpenRegister ni vrnil istega podjetja."), { code: "COMPANY_ID_MISMATCH" });
    await saveCache(serviceCfg, claimed.legal_name, found.results, false);
    await db.pokliciRpc(serviceCfg, "finish_debtor_company_refresh", {
      p_id: claimed.id, p_success: true, p_company: company, p_credits_used: creditsUsed, p_error: null,
    });
    return { id: claimed.id, companyId: company.company_id, creditsUsed: creditsUsed, success: true };
  } catch (error) {
    if (providerAttempted) creditsUsed = 1;
    await db.pokliciRpc(serviceCfg, "finish_debtor_company_refresh", {
      p_id: claimed.id, p_success: false, p_company: {}, p_credits_used: Math.min(1, creditsUsed),
      p_error: clean(error && error.message || "Preverjanje ni uspelo.", 500),
    });
    return { id: claimed.id, companyId: claimed.company_id, creditsUsed: Math.min(1, creditsUsed), success: false, code: error && error.code || "REFRESH_FAILED" };
  }
}

module.exports = {
  CACHE_TTL_MS: CACHE_TTL_MS,
  normalize: normalize,
  cacheKey: cacheKey,
  sanitizeCompany: sanitizeCompany,
  search: search,
  saveSelection: saveSelection,
  list: list,
  exactCompany: exactCompany,
  refreshDue: refreshDue,
  _test: { getCached: getCached, saveCache: saveCache, profilePayload: profilePayload },
};
