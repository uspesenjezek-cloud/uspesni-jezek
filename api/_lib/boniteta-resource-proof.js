"use strict";

var crypto = require("node:crypto");
var TTL_MS = 60 * 60 * 1000;

function clean(value, limit) {
  return String(value == null ? "" : value).trim().slice(0, limit || 240);
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function secret() {
  var value = clean(process.env.BONITETA_RESOURCE_PROOF_SECRET || process.env.OPENREGISTER_IDENTITY_PROOF_SECRET || process.env.OPENREGISTER_API_KEY, 1000);
  if (!value) throw Object.assign(new Error("Strežniška konfiguracija dokazila vira manjka."), { status: 503, code: "RESOURCE_PROOF_NOT_CONFIGURED" });
  return value;
}

function sign(userId, profileId, kind, resourceId, now) {
  var payload = {
    v: 1,
    uid: clean(userId, 80),
    pid: clean(profileId, 80),
    kind: clean(kind, 40),
    rid: clean(resourceId, 240),
    exp: Number(now || Date.now()) + TTL_MS,
  };
  if (!payload.uid || !payload.pid || !payload.kind || !payload.rid) throw Object.assign(new Error("Vira ni mogoče varno povezati s profilom."), { status: 409, code: "RESOURCE_BINDING_INCOMPLETE" });
  var encoded = encode(JSON.stringify(payload));
  return encoded + "." + crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
}

function verify(token, userId, profileId, kind, resourceId, now) {
  var parts = clean(token, 4000).split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  var expected = crypto.createHmac("sha256", secret()).update(parts[0]).digest();
  var supplied;
  try { supplied = Buffer.from(parts[1], "base64url"); } catch (_) { return false; }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return false;
  var payload;
  try { payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); } catch (_) { return false; }
  return Boolean(payload && payload.v === 1 && Number(payload.exp) >= Number(now || Date.now()) &&
    clean(payload.uid, 80) === clean(userId, 80) && clean(payload.pid, 80) === clean(profileId, 80) &&
    clean(payload.kind, 40) === clean(kind, 40) && clean(payload.rid, 240) === clean(resourceId, 240));
}

module.exports = { sign: sign, verify: verify, TTL_MS: TTL_MS };
