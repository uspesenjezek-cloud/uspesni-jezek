"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
var handlerSource = fs.readFileSync(path.join(root, "api/_handlers/mehka-boniteta.js"), "utf8");

assert.doesNotMatch(handlerSource, /\/v1\/company\//,
  "mehka preverba ne sme uporabljati plačljivega OpenRegister Company endpointa");
assert.doesNotMatch(handlerSource, /OPENREGISTER_COMPANY_DETAIL|pridobiOpenRegisterPodjetjePoId|obogatiNeaktivniStatusOpenRegister/,
  "mehka preverba ne sme imeti skrite poti do Company detail klica");

var test = require(path.join(root, "api/mehka-boniteta.js"))._test;

async function verifyInactiveSearchDoesNotFetchDetail() {
  var originalFetch = global.fetch;
  var originalKey = process.env.OPENREGISTER_API_KEY;
  var urls = [];
  process.env.OPENREGISTER_API_KEY = "test-key-no-live-call";
  global.fetch = async function (url) {
    urls.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async function () { return { results: [{
        company_id: "DE-HRB-P3210-22117",
        name: "KLAR GmbH",
        register_type: "HRB",
        register_number: "22117",
        register_court: "Potsdam",
        active: false,
        address: { postal_code: "14467", city: "Potsdam" },
      }] }; },
    };
  };

  test.ponastaviOpenRegisterIdentityCache();
  try {
    var result = await test.poisciOpenRegister({
      ime: "KLAR GmbH",
      registerNumber: "HRB 22117",
      registerCourt: "Potsdam",
    }, { forceFresh: true });
    assert.strictEqual(result.status, "found");
    assert.strictEqual(urls.length, 1, "ena preverba sme narediti največ en zunanji klic");
    assert.match(urls[0], /\/v0\/search\/company/);
    assert.doesNotMatch(urls[0], /\/v1\/company\//);
  } finally {
    global.fetch = originalFetch;
    if (originalKey == null) delete process.env.OPENREGISTER_API_KEY;
    else process.env.OPENREGISTER_API_KEY = originalKey;
    test.ponastaviOpenRegisterIdentityCache();
  }
}

verifyInactiveSearchDoesNotFetchDetail().then(function () {
  console.log("OpenRegister search-only invariant passed.");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
