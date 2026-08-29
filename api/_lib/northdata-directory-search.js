"use strict";

var db = require("./supabase-server");
var directory = require("./company-name-directory-store");
var northdata = require("./apify-northdata-autocomplete");

function sharedResult(results, userId, layer) {
  var prepared = northdata.storedSearchResult(results, userId);
  prepared.sharedCache = true;
  prepared.cacheLayer = layer;
  return prepared;
}

function directoryUnavailable(error) {
  return Boolean(error && ["COMPANY_DIRECTORY_FAILED", "DATABASE_RPC_FAILED", "SERVER_NOT_CONFIGURED"].includes(error.code));
}

async function search(query, userId, options) {
  var opts = options || {};
  var cfg = opts.cfg;
  if (!cfg) {
    try { cfg = db.konfiguracija(); } catch (_) { cfg = null; }
  }

  if (!cfg && opts.readCfg && opts.accessToken) {
    try {
      var readableNames = await directory.findNames(opts.readCfg, query, { accessToken: opts.accessToken });
      if (readableNames.length) return sharedResult(readableNames, userId, "directory");
    } catch (readError) {
      if (!directoryUnavailable(readError)) throw readError;
      console.warn("[company-directory-user-read]", String(readError.code || readError.message || "FAILED"));
    }
  }

  if (cfg) {
    try {
      var names = await directory.findNames(cfg, query);
      if (names.length) return sharedResult(names, userId, "directory");

      var ready = await directory.getReadyQuery(cfg, query);
      if (ready) return sharedResult(ready.results, userId, "query");

      var acquired = await directory.claim(cfg, query);
      if (!acquired) {
        var completed = await directory.waitForReady(cfg, query, 10000);
        if (completed) return sharedResult(completed.results, userId, "concurrent");
        var busy = new Error("Isto iskanje že poteka. Poskusite znova čez nekaj sekund.");
        busy.status = 503;
        busy.code = "COMPANY_SEARCH_IN_PROGRESS";
        busy.retryable = true;
        throw busy;
      }
    } catch (error) {
      if (!directoryUnavailable(error)) throw error;
      console.warn("[company-directory-read]", String(error.code || error.message || "FAILED"));
      cfg = null;
    }
  }

  try {
    var fresh = await northdata.search(query, userId, opts.northdataOptions);
    if (cfg) {
      try { await directory.saveReady(cfg, query, fresh.results); }
      catch (saveError) { console.warn("[company-directory-save]", String(saveError.code || saveError.message || "FAILED")); }
    }
    fresh.sharedCache = false;
    fresh.cacheLayer = fresh.cached ? "memory" : "northdata";
    return fresh;
  } catch (error) {
    if (cfg) {
      try { await directory.markFailed(cfg, query); }
      catch (saveError) { console.warn("[company-directory-failure]", String(saveError.code || saveError.message || "FAILED")); }
    }
    throw error;
  }
}

module.exports = { search: search };
