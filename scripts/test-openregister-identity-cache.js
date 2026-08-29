"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var mehka = require("../api/mehka-boniteta")._test;

async function run() {
  var prejsnjiKljuc = process.env.OPENREGISTER_API_KEY;
  var prejsnjiFetch = global.fetch;
  var klici = 0;
  process.env.OPENREGISTER_API_KEY = "test-key";
  mehka.ponastaviOpenRegisterIdentityCache();
  global.fetch = async function () {
    klici += 1;
    await new Promise(function (resolve) { setTimeout(resolve, 20); });
    return {
      ok: true,
      status: 200,
      json: async function () {
        return { results: [{
          company_id: "DE-HRB-F1103-267645",
          name: "Medienorbis GmbH",
          register_type: "HRB",
          register_number: "267645",
          register_court: "Berlin (Charlottenburg)",
          active: true,
          address: { street: "Musterstraße 1", postal_code: "10115", city: "Berlin" },
        }] };
      },
    };
  };

  try {
    var vnos = { ime: "Medienorbis GmbH", naslov: "", postnaStevilka: "", kraj: "" };
    var hkrati = await Promise.all([
      mehka.poisciOpenRegister(vnos),
      mehka.poisciOpenRegister(vnos),
    ]);
    assert.equal(klici, 1, "sočasni enaki poizvedbi se morata združiti v en plačljiv klic");
    assert.equal(hkrati[0].status, "found");
    assert.equal(hkrati[1].status, "found");

    var ponovljeno = await mehka.poisciOpenRegister(vnos);
    assert.equal(klici, 1, "ponovljena enaka poizvedba mora uporabiti 24-urni predpomnilnik");
    assert.equal(ponovljeno.cached, true);

    mehka.ponastaviOpenRegisterIdentityCache();
    klici = 0;
    global.fetch = async function () { klici += 1; throw new Error("network"); };
    var nedosegljivo = await mehka.poisciOpenRegister(vnos);
    assert.equal(nedosegljivo.status, "unavailable");
    assert.equal(klici, 1, "plačljivega klica ob omrežni napaki ne smemo samodejno ponoviti");

    ["api/_handlers/mehka-boniteta.js"].forEach(function (datoteka) {
      var vir = fs.readFileSync(path.join(__dirname, "..", datoteka), "utf8");
      assert.match(vir, /OPENREGISTER_IDENTITY_CACHE_TTL_MS = 24 \* 60 \* 60 \* 1000/);
      assert.match(vir, /fetchPlacljiviVirEnkrat\(OPENREGISTER_INSOLVENCY_SEARCH/,
        "tudi plačljiva insolvenčna poizvedba mora biti brez samodejne ponovitve");
      assert.doesNotMatch(vir, /fetchZRokom\(OPENREGISTER_INSOLVENCY_SEARCH/);
    });
  } finally {
    mehka.ponastaviOpenRegisterIdentityCache();
    global.fetch = prejsnjiFetch;
    if (prejsnjiKljuc == null) delete process.env.OPENREGISTER_API_KEY;
    else process.env.OPENREGISTER_API_KEY = prejsnjiKljuc;
  }

  console.log("✓ OpenRegister plačljivi klici so združeni, predpomnjeni in brez samodejnih ponovitev.");
}

run().catch(function (napaka) {
  console.error(napaka);
  process.exitCode = 1;
});
