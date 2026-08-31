"use strict";

var crypto = require("node:crypto");
var TTL_MS = 10 * 60 * 1000;

function clean(value, limit) {
  return String(value == null ? "" : value).trim().replace(/\s+/g, " ").slice(0, limit || 240);
}

function secret() {
  var value = clean(process.env.BONITETA_RESOURCE_PROOF_SECRET || process.env.OPENREGISTER_IDENTITY_PROOF_SECRET || process.env.OPENREGISTER_API_KEY, 1000);
  if (!value) throw Object.assign(new Error("Strežniška konfiguracija dokazila za dopolnilne podatke manjka."), {
    status: 503,
    code: "NORTHDATA_DETAILS_PROOF_NOT_CONFIGURED",
  });
  return value;
}

function companyRegister(company) {
  var value = company && typeof company === "object" ? company : {};
  return clean([value.register_type, value.register_number].filter(Boolean).join(" ") || value.registerNumber || value.registerId || value.registerKey, 160);
}

function compactBinding(official, primary) {
  var officialCompany = official && official.status === "found" && official.company ? official.company : official || {};
  var primaryCompany = primary && primary.status === "found" && primary.company ? primary.company : {};
  return {
    companyId: clean(officialCompany.company_id || officialCompany.companyId, 140),
    legalName: clean(officialCompany.name, 240),
    register: companyRegister(officialCompany),
    registerCourt: clean(officialCompany.register_court || officialCompany.registerCourt, 140),
    primaryRegister: companyRegister(primaryCompany),
    primarySourceUrl: clean(primaryCompany.sourceUrl || primaryCompany.url, 1000),
  };
}

function sign(userId, official, primary, now) {
  var binding = compactBinding(official, primary);
  if (!clean(userId, 80) || !binding.companyId || !binding.legalName || !binding.register || !binding.primaryRegister || !binding.primarySourceUrl) {
    throw Object.assign(new Error("Dopolnilnega vira ni mogoče varno povezati s preverjenim podjetjem."), {
      status: 409,
      code: "NORTHDATA_DETAILS_BINDING_INCOMPLETE",
    });
  }
  var payload = { v: 1, uid: clean(userId, 80), exp: Number(now || Date.now()) + TTL_MS, binding: binding };
  var encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return encoded + "." + crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
}

function verify(token, userId, now) {
  var parts = clean(token, 8000).split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  var expected = crypto.createHmac("sha256", secret()).update(parts[0]).digest();
  var supplied;
  try { supplied = Buffer.from(parts[1], "base64url"); } catch (_) { return null; }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  var payload;
  try { payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); } catch (_) { return null; }
  if (!payload || payload.v !== 1 || Number(payload.exp) < Number(now || Date.now()) || clean(payload.uid, 80) !== clean(userId, 80)) return null;
  var binding = compactBinding(payload.binding || {}, { status: "found", company: {
    registerNumber: payload.binding && payload.binding.primaryRegister,
    sourceUrl: payload.binding && payload.binding.primarySourceUrl,
  } });
  binding.companyId = clean(payload.binding && payload.binding.companyId, 140);
  binding.legalName = clean(payload.binding && payload.binding.legalName, 240);
  binding.register = clean(payload.binding && payload.binding.register, 160);
  binding.registerCourt = clean(payload.binding && payload.binding.registerCourt, 140);
  binding.primaryRegister = clean(payload.binding && payload.binding.primaryRegister, 160);
  binding.primarySourceUrl = clean(payload.binding && payload.binding.primarySourceUrl, 1000);
  return binding.companyId && binding.legalName && binding.register && binding.primaryRegister && binding.primarySourceUrl
    ? { exp: Number(payload.exp), binding: binding }
    : null;
}

function matches(payload, official, primary) {
  if (!payload || !payload.binding) return false;
  var actual = compactBinding(official, primary);
  return Object.keys(actual).every(function (key) { return actual[key] === payload.binding[key]; });
}

module.exports = { TTL_MS: TTL_MS, compactBinding: compactBinding, sign: sign, verify: verify, matches: matches };
