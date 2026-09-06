"use strict";

var EVIDENCE_VERSION = "registry-status-v1";
var MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;
var ALLOWED_INACTIVE_SOURCES = new Set(["openregister_company_detail"]);

function clean(value) {
  return String(value || "").trim();
}

function evidenceFrom(context) {
  var source = context && typeof context === "object" ? context : {};
  return source.registryStatusEvidence || source.activityStatusEvidence ||
    source.latestCheck && (source.latestCheck.registryStatusEvidence || source.latestCheck.activityStatusEvidence) ||
    source.latest_check && (source.latest_check.registryStatusEvidence || source.latest_check.activityStatusEvidence) || null;
}

function hasVerifiedInactiveEvidence(context, expectedCompanyId, nowValue) {
  var evidence = evidenceFrom(context);
  if (!evidence || evidence.verified !== true || evidence.version !== EVIDENCE_VERSION ||
      evidence.status !== "inactive" || !ALLOWED_INACTIVE_SOURCES.has(clean(evidence.source))) return false;
  var expected = clean(expectedCompanyId).toUpperCase();
  var actual = clean(evidence.companyId || evidence.company_id).toUpperCase();
  if (!expected || !actual || expected !== actual) return false;
  var checkedAt = new Date(evidence.checkedAt || evidence.checked_at).getTime();
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  return Number.isFinite(checkedAt) && checkedAt <= now + 5 * 60 * 1000 && now - checkedAt <= MAX_EVIDENCE_AGE_MS;
}

function safeActive(value, context, companyId, nowValue) {
  if (value === true) return true;
  if (value === false && hasVerifiedInactiveEvidence(context, companyId, nowValue)) return false;
  return null;
}

function safeCompanyStatus(value, context, companyId, nowValue) {
  var normalized = clean(value).toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "inactive" && hasVerifiedInactiveEvidence(context, companyId, nowValue)) return "inactive";
  return "unknown";
}

function expectedGermanRegisterType(legalName) {
  var name = clean(legalName);
  if (!name) return "";
  // Pravno obliko sklepamo samo iz končnice naziva. Besede KG/OHG se lahko
  // pojavijo tudi prej (npr. "KG Verwaltungsgesellschaft GmbH") in takrat
  // ne smejo preglasiti dejanske končne oblike GmbH.
  if (/\b(?:gmbh|ug(?:\s*\(haftungsbeschr(?:ä|a)nkt\))?|ag|se)\s*&\s*co\.?\s*(?:kg|ohg)\.?\s*$/i.test(name)) return "HRA";
  if (/\b(?:e\.?\s*k\.?|ohg|kg)\.?\s*$/i.test(name)) return "HRA";
  if (/\b(?:gmbh|ug(?:\s*\(haftungsbeschr(?:ä|a)nkt\))?|ag|kgaa|se)\.?\s*$/i.test(name)) return "HRB";
  return "";
}

function safeImpressumRegisterNumber(legalName, registerNumber) {
  var value = clean(registerNumber);
  var match = value.match(/\b(HRA|HRB|PR|GNR|VR)\s*[-–—]?\s*(?:Nr\.?\s*:?\s*)?((?:\d{1,3}(?:[\s\u00a0\u202f]\d{3})+|\d+)(?:\s*[A-Z])?)\b/i);
  if (!match) return "";
  var number = match[2].replace(/\s+/g, "");
  var digits = number.replace(/\D/g, "");
  if (!/[1-9]/.test(digits) || digits.length > 7) return "";
  var expected = expectedGermanRegisterType(legalName);
  if (match && expected && match[1].toUpperCase() !== expected) return "";
  return match[1].toUpperCase().replace("GNR", "GnR") + " " + number.toUpperCase();
}

module.exports = {
  EVIDENCE_VERSION: EVIDENCE_VERSION,
  MAX_EVIDENCE_AGE_MS: MAX_EVIDENCE_AGE_MS,
  hasVerifiedInactiveEvidence: hasVerifiedInactiveEvidence,
  safeActive: safeActive,
  safeCompanyStatus: safeCompanyStatus,
  expectedGermanRegisterType: expectedGermanRegisterType,
  safeImpressumRegisterNumber: safeImpressumRegisterNumber,
};
