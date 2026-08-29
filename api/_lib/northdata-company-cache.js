"use strict";

var crypto = require("node:crypto");
var fs = require("node:fs");
var path = require("node:path");
var db = require("./supabase-server");

// Nova različica je vezana na Jaka actor; rezultatov prejšnjega actorja ne
// mešamo z novimi dodatnimi sklopi podjetja.
var CACHE_VERSION = "northdata-jaka-v6-financial-invariants";
var SOURCE_ACTOR_ID = "Ja65ilbhWnUTs1Xeb";
var FOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000;
var NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000;
var FAILED_TTL_MS = 5 * 60 * 1000;
var MAX_LOCAL_ENTRIES = 5000;
var memory = new Map();
var inFlight = new Map();

function clean(value, max) {
  return String(value == null ? "" : value).trim().replace(/\s+/g, " ").slice(0, max || 500);
}

function normalized(value) {
  return clean(value, 240).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function registerFrom(company) {
  var type = clean(company && (company.register_type || company.registerType), 20).toUpperCase();
  var number = clean(company && (company.register_number || company.registerNumber), 160).toUpperCase();
  var match = (type + " " + number).match(/\b(HRB|HRA|VR|PR|GNR)\s*([A-Z0-9-]+)\b/);
  return match ? { type: match[1], number: match[2].replace(/^0+/, "") || "0" } : { type: "", number: "" };
}

function identityFor(company) {
  var officialId = clean(company && (company.company_id || company.companyId), 240).toUpperCase();
  var fingerprint = "";
  if (officialId) {
    fingerprint = "OPENREGISTER|" + officialId;
  } else {
    var register = registerFrom(company);
    if (!register.type || !register.number) return null;
    var address = company && company.address || {};
    var court = normalized(company && (company.register_court || company.registerCourt));
    var city = normalized(address.city || company && company.city);
    var country = normalized(address.country || company && company.country || "DE") || "DE";
    if (!court && !city) return null;
    fingerprint = [country, register.type, register.number, court || city].join("|");
  }
  var key = crypto.createHash("sha256").update(fingerprint, "utf8").digest("hex");
  return { key: key, fingerprint: key };
}

function cacheFile(options) {
  return clean(options && options.cacheFile, 2000) || clean(process.env.NORTHDATA_CACHE_FILE, 2000) ||
    path.join(process.cwd(), ".cache", "northdata-company-cache.json");
}

function localEnabled(options) {
  if (options && options.disableLocalCache === true) return false;
  return Boolean(options && options.cacheFile) || process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE === "true" ||
    !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function readLocal(options) {
  if (!localEnabled(options)) return { version: CACHE_VERSION, entries: {} };
  try {
    var parsed = JSON.parse(fs.readFileSync(cacheFile(options), "utf8"));
    if (!parsed || parsed.version !== CACHE_VERSION || !parsed.entries || typeof parsed.entries !== "object") {
      return { version: CACHE_VERSION, entries: {} };
    }
    return parsed;
  } catch (_) {
    return { version: CACHE_VERSION, entries: {} };
  }
}

function writeLocal(store, options) {
  if (!localEnabled(options)) return;
  try {
    var target = cacheFile(options);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    var temporary = target + "." + process.pid + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(store), "utf8");
    fs.renameSync(temporary, target);
  } catch (_) {
    // Lokalni predpomnilnik je optimizacija. Napaka pri zapisu ne sme ustaviti preverbe.
  }
}

function validEntry(entry) {
  return Boolean(entry && entry.version === CACHE_VERSION && entry.payload &&
    ["found", "not_found", "ambiguous"].includes(entry.payload.status) &&
    Date.parse(entry.expiresAt || "") > Date.now());
}

function hit(payload, layer) {
  return Object.assign({}, payload, {
    cacheHit: true,
    cacheLayer: layer,
    estimatedCostUsd: 0,
  });
}

function getMemory(key) {
  var entry = memory.get(key);
  if (!validEntry(entry)) {
    memory.delete(key);
    return null;
  }
  return hit(entry.payload, "memory");
}

function getLocal(key, options) {
  var store = readLocal(options);
  var entry = store.entries[key];
  if (!validEntry(entry)) return null;
  memory.set(key, entry);
  return hit(entry.payload, "local_disk");
}

function saveLocal(key, payload, expiresAt, options) {
  var entry = { version: CACHE_VERSION, payload: payload, expiresAt: expiresAt };
  memory.set(key, entry);
  if (!localEnabled(options)) return;
  var store = readLocal(options);
  store.entries[key] = entry;
  var keys = Object.keys(store.entries);
  keys.forEach(function (candidate) {
    if (!validEntry(store.entries[candidate])) delete store.entries[candidate];
  });
  keys = Object.keys(store.entries);
  if (keys.length > MAX_LOCAL_ENTRIES) {
    keys.sort(function (a, b) {
      return Date.parse(store.entries[a].expiresAt || "") - Date.parse(store.entries[b].expiresAt || "");
    }).slice(0, keys.length - MAX_LOCAL_ENTRIES).forEach(function (candidate) { delete store.entries[candidate]; });
  }
  writeLocal(store, options);
}

function serviceConfig() {
  try { return db.konfiguracija(); } catch (_) { return null; }
}

async function rest(cfg, resource, options) {
  var opts = options || {};
  var response = await db.fetchZOmejitvijo(cfg.url + "/rest/v1/" + resource, {
    method: opts.method || "GET",
    headers: db.serviceHeaders(cfg, Object.assign({ "Content-Type": "application/json" }, opts.headers || {})),
    body: opts.body == null ? undefined : JSON.stringify(opts.body),
  }, 8000);
  var data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    var error = new Error("North Data predpomnilnika ni bilo mogoče uporabiti.");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function getRemote(cfg, identity) {
  var rows = await rest(cfg, "northdata_company_cache?select=payload,expires_at,cache_version" +
    "&company_key=eq." + encodeURIComponent(identity.key) + "&status=eq.ready" +
    "&cache_version=eq." + encodeURIComponent(CACHE_VERSION) +
    "&expires_at=gt." + encodeURIComponent(new Date().toISOString()) + "&limit=1");
  if (!Array.isArray(rows) || !rows[0]) return null;
  var entry = { version: CACHE_VERSION, payload: rows[0].payload, expiresAt: rows[0].expires_at };
  if (!validEntry(entry)) return null;
  memory.set(identity.key, entry);
  return hit(entry.payload, "supabase");
}

async function claimRemote(cfg, identity) {
  return Boolean(await db.pokliciRpc(cfg, "claim_northdata_company_cache", {
    p_company_key: identity.key,
    p_identity_fingerprint: identity.fingerprint,
    p_cache_version: CACHE_VERSION,
    p_lock_seconds: 55,
  }));
}

async function saveRemote(cfg, identity, payload, expiresAt) {
  var now = new Date().toISOString();
  await rest(cfg, "northdata_company_cache?company_key=eq." + encodeURIComponent(identity.key), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: {
      status: "ready", payload: payload, cache_version: CACHE_VERSION,
      source_actor_id: clean(payload.actorId || SOURCE_ACTOR_ID, 80), fetched_at: payload.fetchedAt || now,
      expires_at: expiresAt, lock_until: null, updated_at: now,
    },
  });
}

async function markRemoteFailed(cfg, identity) {
  var now = new Date();
  try {
    await rest(cfg, "northdata_company_cache?company_key=eq." + encodeURIComponent(identity.key), {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: {
        status: "failed", payload: {}, expires_at: new Date(now.getTime() + FAILED_TTL_MS).toISOString(),
        lock_until: null, updated_at: now.toISOString(),
      },
    });
  } catch (_) {}
}

function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

async function waitRemote(cfg, identity, timeoutMs) {
  var until = Date.now() + Math.max(0, Number(timeoutMs) || 0);
  while (Date.now() < until) {
    await wait(400);
    var ready = await getRemote(cfg, identity);
    if (ready) return ready;
  }
  return null;
}

function cacheable(payload) {
  return Boolean(payload && ["found", "not_found", "ambiguous"].includes(payload.status));
}

function ttl(payload) {
  return payload && payload.status === "found" ? FOUND_TTL_MS : NEGATIVE_TTL_MS;
}

async function getOrLoad(company, loader, options) {
  var opts = options || {};
  var identity = identityFor(company);
  if (!identity || opts.disableCache === true) return loader();
  // Različni North Data actorji lahko za isto podjetje vrnejo različni shemi.
  // Namespace prepreči, da bi dopolnilni rezultat prepisal osnovnega.
  var namespace = clean(opts.cacheNamespace, 80) || "primary";
  if (namespace !== "primary") {
    identity = {
      key: crypto.createHash("sha256").update(namespace + "|" + identity.key, "utf8").digest("hex"),
      fingerprint: crypto.createHash("sha256").update(namespace + "|" + identity.fingerprint, "utf8").digest("hex"),
    };
  }
  var cached = getMemory(identity.key) || getLocal(identity.key, opts);
  if (cached) return cached;
  if (inFlight.has(identity.key)) return hit(await inFlight.get(identity.key), "in_process");

  var task = (async function () {
    var cfg = opts.disableRemoteCache === true ? null : serviceConfig();
    if (cfg) {
      try {
        var remote = await getRemote(cfg, identity);
        if (remote) return remote;
        var claimed = await claimRemote(cfg, identity);
        if (!claimed) {
          var waited = await waitRemote(cfg, identity, opts.cacheWaitMs == null ? 10000 : opts.cacheWaitMs);
          return waited || {
            status: "unavailable", reason: "cache_refresh_in_progress", source: "northdata_apify",
            sourceLabel: "North Data prek Apify", sourceUrl: "https://www.northdata.com/", estimatedCostUsd: 0,
          };
        }
      } catch (_) {
        // V objavljenem okolju ob napaki skupnega predpomnilnika ne tvegamo
        // novega plačljivega klica. Lokalni 8001 brez service ključa uporablja disk.
        return {
          status: "unavailable", reason: "cache_unavailable", source: "northdata_apify",
          sourceLabel: "North Data prek Apify", sourceUrl: "https://www.northdata.com/", estimatedCostUsd: 0,
        };
      }
    }

    var payload;
    try {
      payload = await loader();
    } catch (error) {
      if (cfg) await markRemoteFailed(cfg, identity);
      throw error;
    }
    if (cacheable(payload)) {
      payload = Object.assign({}, payload, { cacheHit: false, cacheLayer: "fresh_actor" });
      var expiresAt = new Date(Date.now() + ttl(payload)).toISOString();
      saveLocal(identity.key, payload, expiresAt, opts);
      if (cfg) {
        try { await saveRemote(cfg, identity, payload, expiresAt); } catch (_) {}
      }
    } else if (cfg) {
      await markRemoteFailed(cfg, identity);
    }
    return payload;
  })();

  inFlight.set(identity.key, task);
  try { return await task; } finally { inFlight.delete(identity.key); }
}

module.exports = {
  CACHE_VERSION: CACHE_VERSION,
  SOURCE_ACTOR_ID: SOURCE_ACTOR_ID,
  identityFor: identityFor,
  getOrLoad: getOrLoad,
  _test: {
    readLocal: readLocal,
    getLocal: getLocal,
    saveLocal: saveLocal,
    clearMemory: function () { memory.clear(); inFlight.clear(); },
  },
};
