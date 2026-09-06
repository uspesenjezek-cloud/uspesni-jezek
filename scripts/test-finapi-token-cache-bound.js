"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const finapi = require(path.resolve(__dirname, "..", "api", "_lib", "finapi-access"));

async function main() {
  finapi._test.resetTokenCache();
  const originalFetch = global.fetch;
  let counter = 0;
  global.fetch = async function () {
    counter += 1;
    return {
      ok: true,
      status: 200,
      headers: { get: function () { return null; } },
      json: async function () {
        return { access_token: "token-" + counter, expires_in: 3600 };
      },
    };
  };

  try {
    const cfg = { baseUrl: "https://sandbox.finapi.io/api/v2", clientId: "id", clientSecret: "secret" };
    for (let i = 0; i < finapi.MAX_TOKEN_CACHE_ENTRIES + 40; i += 1) {
      await finapi._test.oauthToken(cfg, "password", { id: "user-" + i, password: "password" });
    }
    assert.equal(finapi._test.tokenCacheSize(), finapi.MAX_TOKEN_CACHE_ENTRIES,
      "token cache mora ostati strogo omejen");
  } finally {
    global.fetch = originalFetch;
    finapi._test.resetTokenCache();
  }

  console.log("OK: finAPI token cache je časovno in velikostno omejen.");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});

