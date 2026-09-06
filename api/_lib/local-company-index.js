"use strict";

var fs = require("node:fs");
var path = require("node:path");
var zlib = require("node:zlib");

var INDEX_ROOT = path.resolve(__dirname, "../../app/company-index");
var SOURCE_URL = "https://offeneregister.de/daten/";
var SNAPSHOT_DATE = "2019-02-05";
var shardCache = globalThis.__ujLocalCompanyIndexShardCache ||
  (globalThis.__ujLocalCompanyIndexShardCache = new Map());
var additionsCache = globalThis.__ujLocalCompanyIndexAdditionsCache || null;

function normalize(value) {
  return String(value || "")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function shardKey(name) {
  return (normalize(name).replace(/\s+/g, "").slice(0, 2) + "__").slice(0, 2);
}

function parseRegister(value) {
  var match = String(value || "").match(/\b(HRA|HRB|PR|GNR|VR)\s*[-–—]?\s*(?:Nr\.?\s*:?\s*)?(\d{1,3}(?:[\s\u00a0\u202f]\d{3})+|\d+)\b/i);
  if (!match) return { type: "", number: "" };
  return {
    type: match[1].toUpperCase() === "GNR" ? "GNR" : match[1].toUpperCase(),
    number: match[2].replace(/\s+/g, ""),
  };
}

function decodeRows(buffer) {
  var payload = buffer;
  if (buffer && buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    payload = zlib.gunzipSync(buffer);
  }
  var rows = JSON.parse(Buffer.from(payload).toString("utf8"));
  if (!Array.isArray(rows)) throw new Error("LOCAL_COMPANY_INDEX_INVALID");
  return rows;
}

async function fetchRows(url, fetchFn) {
  var response = await fetchFn(url, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("LOCAL_COMPANY_INDEX_HTTP_" + response.status);
  return decodeRows(Buffer.from(await response.arrayBuffer()));
}

async function loadFileOrStaticUrl(fileName, options) {
  var localPath = path.join(INDEX_ROOT, fileName);
  try {
    return decodeRows(await fs.promises.readFile(localPath));
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
  }
  var baseUrl = String(options && options.baseUrl || "").replace(/\/$/, "");
  var fetchFn = options && options.fetch || global.fetch;
  if (!baseUrl || typeof fetchFn !== "function") throw new Error("LOCAL_COMPANY_INDEX_NOT_BUNDLED");
  return fetchRows(baseUrl + "/app/company-index/" + encodeURIComponent(fileName), fetchFn);
}

async function loadShard(key, options) {
  if (!/^[a-z0-9_]{2}$/.test(key)) return [];
  if (!shardCache.has(key)) {
    var loading = loadFileOrStaticUrl(key + ".json.gz", options).catch(function (error) {
      shardCache.delete(key);
      throw error;
    });
    shardCache.set(key, loading);
  }
  return shardCache.get(key);
}

async function loadAdditions(options) {
  if (!additionsCache) {
    additionsCache = loadFileOrStaticUrl("verified-additions.json", options).catch(function (error) {
      additionsCache = null;
      throw error;
    });
    globalThis.__ujLocalCompanyIndexAdditionsCache = additionsCache;
  }
  return additionsCache;
}

function rowMatches(row, input) {
  if (!Array.isArray(row) || !row[0]) return false;
  if (normalize(row[0]) !== normalize(input.name)) return false;
  var sourceId = String(input.sourceId || "").trim();
  if (sourceId && String(row[6] || "").trim() !== sourceId) return false;
  var expectedRegister = parseRegister(input.registerNumber);
  if (expectedRegister.number) {
    var rowType = String(row[2] || "").trim().toUpperCase();
    var rowNumber = String(row[3] || "").replace(/\s+/g, "");
    if (rowType !== expectedRegister.type || rowNumber !== expectedRegister.number) return false;
  }
  if (String(input.registerCourt || "").trim() && normalize(row[4]) !== normalize(input.registerCourt)) return false;
  return true;
}

function rowToCompany(row) {
  return {
    company_id: "",
    source_id: String(row[6] || ""),
    name: String(row[0] || ""),
    register_type: String(row[2] || ""),
    register_number: String(row[3] || ""),
    register_court: String(row[4] || ""),
    address: { street: "", postal_code: "", city: String(row[1] || ""), country: "DE" },
    // Posnetek iz leta 2019 potrjuje identiteto izbranega zapisa, ne pa
    // današnjega aktivnega statusa. Zato starega boolean polja ne povzdignemo
    // v svež registrski dokaz.
    active: null,
    directory_snapshot_active: row[5] === true ? true : row[5] === false ? false : null,
  };
}

async function resolveSelection(input, options) {
  var selection = input && typeof input === "object" ? input : {};
  if (!normalize(selection.name)) return { status: "invalid", reason: "name_missing" };
  var rows;
  try {
    var loaded = await Promise.all([loadShard(shardKey(selection.name), options), loadAdditions(options)]);
    rows = loaded[0].concat(loaded[1]);
  } catch (error) {
    return { status: "unavailable", reason: "local_company_index_unavailable", detail: error && error.message || "" };
  }
  var matches = rows.filter(function (row) { return rowMatches(row, selection); });
  if (!matches.length) return { status: "not_found", reason: "local_company_index_selection_mismatch" };
  if (matches.length > 1 && !String(selection.sourceId || "").trim()) {
    return { status: "ambiguous", reason: "local_company_index_selection_ambiguous" };
  }
  return {
    status: "found",
    source: "local_company_index",
    sourceUrl: SOURCE_URL,
    snapshotDate: SNAPSHOT_DATE,
    company: rowToCompany(matches[0]),
  };
}

function resetCache() {
  shardCache.clear();
  additionsCache = null;
  globalThis.__ujLocalCompanyIndexAdditionsCache = null;
}

module.exports = {
  SOURCE_URL: SOURCE_URL,
  SNAPSHOT_DATE: SNAPSHOT_DATE,
  normalize: normalize,
  shardKey: shardKey,
  parseRegister: parseRegister,
  resolveSelection: resolveSelection,
  resetCache: resetCache,
};
