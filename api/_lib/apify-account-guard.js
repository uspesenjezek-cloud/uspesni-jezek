"use strict";

var crypto = require("node:crypto");
var API_ROOT = "https://api.apify.com/v2";
var EXPECTED_USERNAME = "ruly_caviar_jhh";
var EXPECTED_USER_ID = "jJ893WYgjamNcyFlV";
var verifiedTokens = new Set();
var verificationInFlight = new Map();

function fingerprint(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

async function verify(token, fetchImpl) {
  var value = String(token || "").trim();
  if (!value) throw Object.assign(new Error("Apify povezava ni nastavljena."), { code: "APIFY_NOT_CONFIGURED", status: 503 });
  var key = fingerprint(value);
  if (verifiedTokens.has(key)) return true;
  if (verificationInFlight.has(key)) return verificationInFlight.get(key);
  if (typeof fetchImpl !== "function") throw Object.assign(new Error("Apify računa ni mogoče preveriti."), { code: "APIFY_ACCOUNT_CHECK_UNAVAILABLE", status: 503 });
  var verification = (async function () {
    var response = await fetchImpl(API_ROOT + "/users/me", {
      method: "GET",
      headers: { Authorization: "Bearer " + value, Accept: "application/json" },
    });
    var payload = await response.json().catch(function () { return {}; });
    var username = String(payload && payload.data && (payload.data.username || payload.data.userName) || "").trim();
    var verified = response.ok && username === EXPECTED_USERNAME;
    // Scoped Actor tokens may not have permission for /users/me. In that case
    // verify the billing account through a readable run before any paid POST.
    if (!verified && (response.status === 401 || response.status === 403)) {
      var runsResponse = await fetchImpl(API_ROOT + "/actor-runs?desc=1&limit=1", {
        method: "GET",
        headers: { Authorization: "Bearer " + value, Accept: "application/json" },
      });
      var runsPayload = await runsResponse.json().catch(function () { return {}; });
      var runs = runsPayload && runsPayload.data && runsPayload.data.items;
      var runUserId = String(Array.isArray(runs) && runs[0] && runs[0].userId || "").trim();
      verified = runsResponse.ok && runUserId === EXPECTED_USER_ID;
    }
    if (!verified) {
      throw Object.assign(new Error("Aktivni Apify žeton ne pripada dovoljenemu računu."), {
        code: "APIFY_ACCOUNT_MISMATCH", status: 503,
      });
    }
    verifiedTokens.add(key);
    return true;
  })();
  verificationInFlight.set(key, verification);
  try {
    return await verification;
  } finally {
    if (verificationInFlight.get(key) === verification) verificationInFlight.delete(key);
  }
}

function resetForTests() {
  verifiedTokens.clear();
  verificationInFlight.clear();
}

module.exports = { EXPECTED_USERNAME: EXPECTED_USERNAME, EXPECTED_USER_ID: EXPECTED_USER_ID, verify: verify, _test: { reset: resetForTests } };
