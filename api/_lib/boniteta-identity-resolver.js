"use strict";

// Isolated, side-effect free identity resolver.  It is intentionally not wired
// into the production handler until its contract beats the legacy path.

var REGISTERED_FORM = /\b(?:gmbh|ug\s*\(?haftungsbeschr[aä]nkt\)?|ag|gmbh\s*&\s*co\.??\s*kg|kg|ohg|eg|e\.??k\.?)\b/i;

function clean(value) {
  return String(value || "").trim();
}

function normalized(value) {
  return clean(value).toLocaleLowerCase("de-DE")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizedAddress(value) {
  return normalized(value).replace(/\bstrasse\b/g, "str").replace(/\bstr\b/g, "str");
}

function canonicalWebsite(raw) {
  var url = new URL(clean(raw));
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  Array.from(url.searchParams.keys()).forEach(function (key) {
    if (/^(?:utm_.+|gclid|fbclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
  });
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

function registeredCandidate(candidate) {
  return Boolean(clean(candidate && candidate.registerNumber) ||
    REGISTERED_FORM.test([candidate && candidate.legalName, candidate && candidate.legalForm].join(" ")));
}

function hasLocation(candidate) {
  return /^\d{5}$/.test(clean(candidate && candidate.postalCode)) && Boolean(clean(candidate && candidate.city));
}

function hasSoleTraderIdentity(candidate) {
  return Boolean(clean(candidate && candidate.personName)) && hasLocation(candidate) && Boolean(clean(candidate && candidate.street));
}

function addPhase(timeline, name, result) {
  timeline.push({ name: name, durationMs: Math.max(0, Number(result && result.durationMs) || 0), status: result && result.status || "unknown" });
}

function timing(timeline) {
  return {
    totalMs: timeline.reduce(function (sum, phase) { return sum + phase.durationMs; }, 0),
    phases: timeline,
  };
}

function compareRegisteredCandidate(candidate, company) {
  var candidateRegister = normalized(candidate && candidate.registerNumber);
  var officialRegister = normalized(company && company.registerNumber);
  var registerMatch = Boolean(candidateRegister && officialRegister && candidateRegister === officialRegister);
  var nameMatch = normalized(candidate && candidate.legalName) === normalized(company && company.legalName);
  var plzMatch = clean(candidate && candidate.postalCode) === clean(company && company.postalCode);
  var cityMatch = normalized(candidate && candidate.city) === normalized(company && company.city);
  var streetMatch = normalizedAddress(candidate && candidate.street) === normalizedAddress(company && company.street);
  var locationMatch = plzMatch && cityMatch;

  if (candidateRegister && !registerMatch) return { status: "identity_mismatch", reason: "register_number_mismatch" };
  if (!registerMatch && !(nameMatch && locationMatch)) return { status: "identity_mismatch", reason: "legal_name_or_location_mismatch" };
  return {
    status: "matched",
    method: registerMatch ? "register_number" : "legal_name_and_location",
    addressDrift: Boolean(locationMatch && !streetMatch),
  };
}

async function resolve(input, adapters) {
  var timeline = [];
  var website;
  try {
    website = canonicalWebsite(input.website);
  } catch (_) {
    return { status: "website_not_found", reason: "invalid_website_url", canRunInsolvency: false, timing: timing(timeline) };
  }
  var collected = await adapters.collectCandidate({ website: website });
  addPhase(timeline, "collect_candidate", collected);
  if (!collected || collected.status === "access_blocked") {
    return { status: "access_blocked", reason: collected && collected.reason || "access_blocked", website: website, canRunInsolvency: false, timing: timing(timeline) };
  }
  if (collected.status === "unavailable" || collected.status === "transport_error") {
    return { status: "transport_error", reason: collected.reason || "transport_error", website: website, canRunInsolvency: false, timing: timing(timeline) };
  }
  if (collected.status === "website_not_found") {
    return { status: "website_not_found", reason: collected.reason || "website_not_found", website: website, canRunInsolvency: false, timing: timing(timeline) };
  }
  if (collected.status !== "found" || !collected.candidate) {
    return { status: "impressum_missing", reason: collected.reason || "impressum_missing", website: website, canRunInsolvency: false, timing: timing(timeline) };
  }
  var candidate = collected.candidate;
  if (!registeredCandidate(candidate)) {
    if (!hasSoleTraderIdentity(candidate)) {
      return { status: "identity_mismatch", reason: "sole_trader_identity_incomplete", website: website, candidate: candidate, canRunInsolvency: false, timing: timing(timeline) };
    }
    return { status: "verified_impressum", path: "sole_trader", website: website, identity: candidate, canRunInsolvency: true, timing: timing(timeline) };
  }

  var register = await adapters.findOpenRegister({ candidate: candidate, website: website });
  addPhase(timeline, "openregister", register);
  if (register.status === "no_match") {
    return { status: "register_not_found", reason: "openregister_no_match", website: website, candidate: candidate, canRunInsolvency: false, timing: timing(timeline) };
  }
  if (register.status !== "found" || !register.company) {
    return { status: "register_unavailable", reason: register.reason || "openregister_unavailable", website: website, candidate: candidate, canRunInsolvency: false, timing: timing(timeline) };
  }
  var comparison = compareRegisteredCandidate(candidate, register.company);
  if (comparison.status !== "matched") {
    return { status: "identity_mismatch", reason: comparison.reason, website: website, candidate: candidate, officialCandidate: register.company, canRunInsolvency: false, timing: timing(timeline) };
  }
  return {
    status: "verified_register",
    path: "registered_company",
    website: website,
    identity: register.company,
    crossReference: comparison,
    canRunInsolvency: true,
    timing: timing(timeline),
  };
}

module.exports = {
  canonicalWebsite: canonicalWebsite,
  compareRegisteredCandidate: compareRegisteredCandidate,
  resolve: resolve,
};
