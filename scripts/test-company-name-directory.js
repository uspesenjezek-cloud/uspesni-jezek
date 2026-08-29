"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var store = require("../api/_lib/company-name-directory-store");

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

async function main() {
  assert.equal(store.normalize("  MedienÖrbis GmbH  "), "medienorbis gmbh");
  assert.equal(store.queryCacheKey("MedienOrbis GmbH"), "v2-word-match|medienorbis gmbh");
  assert.deepEqual(store.searchTokens("Paul Hartmann GmbH & Co. KG"), ["paul", "hartmann"]);
  assert.ok(
    store.candidateScore({ name: "Paul Hartmann Spenglerei und Installations GmbH & Co. KG" }, "Paul Hartmann GmbH & Co. KG") >
    store.candidateScore({ name: "Paul Hartmann Logistik GmbH" }, "Paul Hartmann GmbH & Co. KG"),
    "manjkajoče vmesne besede morajo biti dovoljene, pravna oblika pa mora izboljšati razvrstitev"
  );
  assert.ok(
    store.candidateScore({ name: "Müller Elektro Anlagenbau GmbH" }, "Müller GmbH") >= 0,
    "splošno pravilo mora veljati tudi za drugo podjetje"
  );
  assert.equal(
    store.candidateScore({ name: "Hartmann Internationale Transporte GmbH" }, "Paul Hartmann GmbH & Co. KG"),
    -1,
    "kandidat brez vseh razlikovalnih besed ne sme postati veljaven predlog"
  );
  assert.equal(store.sanitizeResult({ name: "", city: "Berlin" }), null);
  assert.equal(store.sanitizeResult({ name: "Test GmbH", source_id: "https://evil.example/test" }).source_id, "");

  var oldFetch = global.fetch;
  var calls = [];
  var cacheRow = { results: [], searched_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString() };
  global.fetch = async function (url, options) {
    var call = { url: String(url), options: options || {} };
    calls.push(call);
    if (call.url.includes("/rpc/claim_company_name_search")) {
      return { ok: true, status: 200, json: async function () { return true; } };
    }
    if (call.url.includes("company_name_directory?") && call.options.method === "GET") {
      var decoded = decodeURIComponent(call.url);
      var rows = decoded.includes("hartmann") ? [
        { legal_name: "Paul Hartmann Logistik GmbH", city: "Neuss", source_url: "https://www.northdata.com/Paul-Hartmann-Logistik" },
        { legal_name: "Paul Hartmann Spenglerei und Installations GmbH & Co. KG", city: "Frankfurt am Main", source_url: "https://www.northdata.com/Paul-Hartmann-Spenglerei" },
      ] : [{ legal_name: "MedienOrbis GmbH", city: "Berlin", source_url: "https://www.northdata.com/MedienOrbis" }];
      return { ok: true, status: 200, json: async function () { return rows; } };
    }
    if (call.url.includes("company_name_search_cache?") && call.options.method === "GET") {
      return { ok: true, status: 200, json: async function () { return [cacheRow]; } };
    }
    return { ok: true, status: 204, json: async function () { throw new Error("no body"); } };
  };

  var cfg = { url: "https://project.supabase.co", serviceKey: "service-test" };
  try {
    var names = await store.findNames(cfg, "Medienorbis");
    assert.equal(names.length, 1);
    assert.equal(names[0].name, "MedienOrbis GmbH");
    assert.match(calls[0].url, /normalized_name=like\.\*medienorbis\*/);
    assert.equal(calls[0].options.headers.Authorization, "Bearer service-test");

    var hartmann = await store.findNames(cfg, "Paul Hartmann GmbH & Co. KG");
    assert.equal(hartmann[0].name, "Paul Hartmann Spenglerei und Installations GmbH & Co. KG");
    var hartmannCall = calls.find(function (call) { return decodeURIComponent(call.url).includes("normalized_name.like.*hartmann*"); });
    assert.ok(hartmannCall, "imenik mora iskati po več razlikovalnih besedah, ne po celotnem dobesednem nizu");
    assert.match(decodeURIComponent(hartmannCall.url), /and=\(normalized_name\.like\.\*hartmann\*,normalized_name\.like\.\*paul\*\)/);

    await store.findNames(cfg, "Medienorbis", { accessToken: "signed-user-token" });
    var userRead = calls.find(function (call) { return call.options.headers && call.options.headers.Authorization === "Bearer signed-user-token"; });
    assert.ok(userRead);
    assert.equal(userRead.options.headers.Authorization, "Bearer signed-user-token",
      "localhost mora skupni imenik brati s prijavno sejo, ne s skrbniškim ključem");

    var ready = await store.getReadyQuery(cfg, "Medienorbis");
    assert.deepEqual(ready.results, [], "svež prazen zadetek mora kratek čas preprečiti podvojeni plačljivi klic");

    cacheRow = { results: [], searched_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(), expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() };
    var stale = await store.getReadyQuery(cfg, "Paul Hartmann GmbH & Co. KG");
    assert.equal(stale, null, "star prazen rezultat ne sme več tedne blokirati veljavnega North Data iskanja");
    var staleExpiry = calls.find(function (call) {
      return call.url.includes("company_name_search_cache?normalized_query=eq.v2-word-match%7Cpaul%20hartmann%20gmbh%20co%20kg") && call.options.method === "PATCH";
    });
    assert.ok(staleExpiry, "stari prazni predpomnilnik se mora ob branju razveljaviti");

    assert.equal(await store.claim(cfg, "Medienorbis"), true);
    var rpcBody = JSON.parse(calls.find(function (call) { return call.url.includes("/rpc/claim_company_name_search"); }).options.body);
    assert.equal(rpcBody.p_normalized_query, "v2-word-match|medienorbis");

    await store.saveReady(cfg, "Medienorbis", [{ name: "MedienOrbis GmbH", city: "Berlin", source_id: "https://www.northdata.com/MedienOrbis" }]);
    var directoryWrite = calls.find(function (call) { return call.url.includes("company_name_directory?on_conflict="); });
    assert.ok(directoryWrite, "novi NorthData zadetki se morajo zapisati v skupni imenik");
    assert.equal(JSON.parse(directoryWrite.options.body)[0].normalized_name, "medienorbis gmbh");
    var queryWrite = calls.find(function (call) {
      if (!call.url.includes("company_name_search_cache?normalized_query=") || call.options.method !== "PATCH") return false;
      try { return JSON.parse(call.options.body).status === "ready"; } catch (_) { return false; }
    });
    assert.equal(JSON.parse(queryWrite.options.body).status, "ready");

    await store.saveReady(cfg, "Ni zadetka", []);
    var emptyWrite = calls.filter(function (call) {
      return call.url.includes("company_name_search_cache?normalized_query=eq.v2-word-match%7Cni%20zadetka") && call.options.method === "PATCH";
    }).pop();
    var emptyBody = JSON.parse(emptyWrite.options.body);
    assert.ok(new Date(emptyBody.expires_at).getTime() - new Date(emptyBody.searched_at).getTime() <= 16 * 60 * 1000,
      "prazen rezultat se sme hraniti največ približno 15 minut");
  } finally {
    global.fetch = oldFetch;
  }

  var migration = source("supabase/migrations/20260821211238_company_name_directory_cache.sql");
  assert.match(migration, /alter table public\.company_name_directory enable row level security/i);
  assert.match(migration, /revoke all on table public\.company_name_directory from anon, authenticated/i);
  assert.match(migration, /security invoker/i);
  assert.doesNotMatch(migration, /security definer/i);
  var readMigration = source("supabase/migrations/20260821211859_company_name_directory_authenticated_read.sql");
  assert.match(readMigration, /for select\s+to authenticated\s+using \(true\)/i);
  assert.doesNotMatch(readMigration, /company_name_search_cache[\s\S]*?to authenticated/i,
    "uporabniški iskalni izrazi ne smejo biti dostopni drugim uporabnikom");

  ["api/boniteta-pro.js", "api/_handlers/boniteta-pro.js"].forEach(function (file) {
    var api = source(file);
    assert.match(api, /northdata-directory-search/);
    assert.match(api, /sharedCache: northdata\.sharedCache/);
    assert.match(api, /readCfg: cfg, accessToken: auth\.token/);
  });
  var orchestrator = source("api/_lib/northdata-directory-search.js");
  assert.ok(orchestrator.indexOf("directory.findNames") < orchestrator.indexOf("northdata.search"),
    "skupni imenik se mora preveriti pred plačljivim actorjem");
  assert.match(orchestrator, /directory\.claim/);
  assert.match(orchestrator, /directory\.saveReady/);

  console.log("Skupni imenik imen podjetij: OK");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
