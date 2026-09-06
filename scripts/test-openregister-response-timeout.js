"use strict";

var assert = require("node:assert/strict");
var identitySearch = require("../api/_lib/openregister-identity-search");
var mehka = require("../api/mehka-boniteta")._test;

async function run() {
  var originalFetch = global.fetch;
  var originalSetTimeout = global.setTimeout;
  var originalClearTimeout = global.clearTimeout;
  var originalKey = process.env.OPENREGISTER_API_KEY;
  var delays = [];
  process.env.OPENREGISTER_API_KEY = "test-key";
  global.setTimeout = function (callback, delay) {
    delays.push(delay);
    return { callback: callback, delay: delay };
  };
  global.clearTimeout = function () {};
  global.fetch = async function (url) {
    assert.doesNotMatch(String(url), /\/v1\/company\//,
      "mehka preverba ne sme priklicati plačljivega Company endpointa");
    return { ok: true, status: 200, json: async function () { return { results: [{
      company_id: "DE-HRB-B1201-99999", name: "KLAR GmbH", register_type: "HRB",
      register_number: "99999", register_court: "Berlin", active: true,
      address: { street: "Musterweg 1", postal_code: "10115", city: "Berlin" },
    }] }; } };
  };

  try {
    identitySearch.resetCache();
    mehka.ponastaviOpenRegisterIdentityCache();
    await identitySearch.search("KLAR GmbH", "00000000-0000-4000-8000-000000000001");
    await mehka.poisciOpenRegister({ ime: "KLAR GmbH" });
    assert.deepEqual(delays, [30000, 30000],
      "obe dovoljeni Search poti morata veljaven odgovor čakati do 30 sekund");
  } finally {
    identitySearch.resetCache();
    mehka.ponastaviOpenRegisterIdentityCache();
    global.fetch = originalFetch;
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    if (originalKey == null) delete process.env.OPENREGISTER_API_KEY;
    else process.env.OPENREGISTER_API_KEY = originalKey;
  }
  console.log("✓ OpenRegister veljaven odgovor ima 30-sekundno okno brez samodejne ponovitve.");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
