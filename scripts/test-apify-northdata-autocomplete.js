"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");
var client = require("../api/_lib/apify-northdata-autocomplete");

function source(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

async function main() {
  var oldSecret = process.env.NORTHDATA_SUGGESTION_PROOF_SECRET;
  process.env.NORTHDATA_SUGGESTION_PROOF_SECRET = "northdata-suggestion-test-secret";
  client.resetCache();
  var calls = [];
  var fetchMock = async function (url, options) {
    calls.push({ url: String(url), options: options });
    return {
      ok: true,
      status: 200,
      json: async function () {
        return [
          { name: "Neue Beispiel GmbH", city: "Berlin", country: "DE", profileUrl: "https://www.northdata.com/Neue+Beispiel+GmbH,+Berlin/HRB+123" },
          { name: "Neue Beispiel GmbH", city: "Berlin", country: "DE", profileUrl: "https://www.northdata.com/duplicate" },
          { name: "Example Ltd", city: "London", country: "GB", profileUrl: "https://www.northdata.com/example" },
        ];
      },
    };
  };

  try {
    assert.equal(client.ACTOR_ID, "Ja65ilbhWnUTs1Xeb");
    assert.doesNotMatch(source("api/_lib/apify-northdata-autocomplete.js"), /silentflow/i,
      "SilentFlow actor se ne sme uporabljati za autocomplete imen");
    await assert.rejects(client.search("ab", "user-a", { token: "token", fetch: fetchMock }), /vsaj tri znake/);
    var first = await client.search("Neue Beispiel", "user-a", { token: "token", fetch: fetchMock });
    assert.equal(calls.length, 1, "plačljivi North Data autocomplete se sme poklicati samo enkrat");
    assert.match(calls[0].url, /Ja65ilbhWnUTs1Xeb\/run-sync-get-dataset-items/);
    assert.match(calls[0].url, /maxTotalChargeUsd=0\.02/);
    assert.ok(!calls[0].url.includes("token"), "Apify žeton ne sme biti v URL-ju");
    assert.equal(calls[0].options.headers.Authorization, "Bearer token");
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      searchQueries: ["Neue Beispiel"], country: "DE", resultType: "companies",
      includeFinancials: false, includeOfficers: false, includeRelatedCompanies: false,
      includeEvents: false, includeNews: false, maxResults: 3,
    });
    assert.equal(first.results.length, 1, "podvojeni in nedomači zadetki se morajo odstraniti");
    assert.equal(first.results[0].source, "northdata_names");
    assert.equal(first.results[0].register_number, "", "North Data predlog ne sme postati uradna registrska identiteta");
    assert.ok(first.estimatedCostUsd <= 0.01205, "zagon mora ostati pod omejitvijo treh SolidCode rezultatov");
    assert.equal(client.verifySuggestionProof(first.results[0].suggestion_proof, "user-a").name, "Neue Beispiel GmbH");
    assert.equal(client.verifySuggestionProof(first.results[0].suggestion_proof, "user-b"), null,
      "podpisan imenski predlog ne sme veljati za drugega uporabnika");

    var second = await client.search("Neue Beispiel", "user-b", { token: "token", fetch: fetchMock });
    assert.equal(second.cached, true);
    assert.equal(second.estimatedCostUsd, 0);
    assert.equal(calls.length, 1, "enaka poizvedba mora uporabiti predpomnilnik brez novega plačljivega zagona");
    assert.equal(client.verifySuggestionProof(second.results[0].suggestion_proof, "user-b").name, "Neue Beispiel GmbH");

    var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "northdata-name-cache-test-"));
    var cacheFile = path.join(tempDir, "cache.json");
    try {
      client.resetCache();
      var diskCalls = 0;
      var diskOptions = {
        token: "token", cacheFile: cacheFile,
        fetch: async function () {
          diskCalls += 1;
          return { ok: true, status: 200, json: async function () { return [{
            name: "Rögner Sanitär GmbH", city: "Frankfurt a. Main", country: "DE",
            url: "https://www.northdata.com/R%C3%B6gner%20Sanit%C3%A4r%20GmbH",
          }]; } };
        },
      };
      var roegnerFirst = await client.search("Rögner Sanitär GmbH", "user-a", diskOptions);
      client.resetCache();
      var roegnerSecond = await client.search("Rögner Sanitär GmbH", "user-a", diskOptions);
      assert.equal(roegnerFirst.results[0].name, "Rögner Sanitär GmbH");
      assert.equal(roegnerSecond.cached, true, "ponovni zagon mora prebrati ime iz lokalnega diska");
      assert.equal(roegnerSecond.estimatedCostUsd, 0);
      assert.equal(diskCalls, 1, "ponovni zagon ne sme znova plačati SolidCode iskanja");
    } finally {
      var resolvedTemp = path.resolve(tempDir);
      if (resolvedTemp.startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(resolvedTemp, { recursive: true, force: true });
    }

    client.resetCache();
    var failedCalls = 0;
    await assert.rejects(client.search("Napaka GmbH", "user-a", {
      token: "token",
      fetch: async function () { failedCalls += 1; return { ok: false, status: 500, json: async function () { return {}; } }; },
    }));
    assert.equal(failedCalls, 1, "neuspešnega plačljivega actorja ni dovoljeno samodejno ponoviti");

    var frontend = source("app/bonitetna-preverba.js");
    var inputHandler = frontend.slice(frontend.indexOf('heroSpletnaPolje.addEventListener("input"'), frontend.indexOf('heroSpletnaPolje.addEventListener("keydown"'));
    assert.doesNotMatch(inputHandler, /northDataAutocompleteApi|northdata_autocomplete|poisciNorthDataPodjetja/,
      "tipkanje ne sme sprožiti plačljivega North Data actorja");
    assert.match(frontend, /body: JSON\.stringify\(\{ action: "northdata_autocomplete", query: query \}\)/);
    assert.match(frontend, /companyIndexProof:/);
    assert.match(frontend, /if \(northDataUradnaRezervaPoizvedba === query\)[\s\S]*?return poisciAutocompletePodjetja\(\)/,
      "OpenRegister se sme ročno ponuditi šele po neuspelem North Data iskanju");
    assert.doesNotMatch(frontend, /if \(northDataPrikazanaPoizvedba === query\)[\s\S]*?return poisciAutocompletePodjetja\(\)/,
      "ponoven klik po uspešnih North Data zadetkih ne sme porabiti OpenRegister kredita");
    assert.match(frontend, /selected\.source === "northdata_names" && Boolean\(selected\.suggestionProof\)/,
      "North Data ime mora biti izbirno samo s podpisanim predlogom");

    ["api/boniteta-pro.js", "api/_handlers/boniteta-pro.js"].forEach(function (file) {
      var api = source(file);
      assert.match(api, /action === "northdata_autocomplete"/);
      assert.match(api, /northdataAutocomplete\.search\(body\.query, auth\.user\.id, \{ readCfg: cfg, accessToken: auth\.token \}\)/);
    });
    ["api/_handlers/mehka-boniteta.js"].forEach(function (file) {
      var api = source(file);
      assert.match(api, /verifySuggestionProof\(telo\.companyIndexProof, auth\.user\.id\)/);
      assert.match(api, /NORTHDATA_SELECTION_INVALID/);
      assert.match(api, /podpisanNorthDataPredlog/);
    });
  } finally {
    client.resetCache();
    if (oldSecret == null) delete process.env.NORTHDATA_SUGGESTION_PROOF_SECRET;
    else process.env.NORTHDATA_SUGGESTION_PROOF_SECRET = oldSecret;
  }

  console.log("North Data autocomplete: OK");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
