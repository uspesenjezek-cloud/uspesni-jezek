"use strict";

// Crawler-first collection contract.  This module is deliberately isolated
// from the legacy handler until comparison tests prove that it is safer.

function phase(name, result) {
  return {
    name: name,
    status: String(result && result.status || "unknown"),
    durationMs: Math.max(0, Number(result && result.durationMs) || 0),
  };
}

function resultWithTiming(result, phases) {
  return Object.assign({}, result, {
    timing: {
      totalMs: phases.reduce(function (sum, item) { return sum + item.durationMs; }, 0),
      phases: phases,
    },
  });
}

async function collect(input, adapters) {
  var website = String(input && input.website || "").trim();
  if (!website) return resultWithTiming({ status: "website_not_found", reason: "website_missing" }, []);
  var fetched = await adapters.fetchImpressum(website);
  var phases = [phase("scrapling_impressum", fetched)];

  if (!fetched || fetched.status === "robots_disallowed" || fetched.status === "rate_limited") {
    return resultWithTiming({
      status: "access_blocked",
      reason: fetched && fetched.reason || "crawler_access_blocked",
      source: "scrapling",
    }, phases);
  }
  if (fetched.status !== "found") {
    return resultWithTiming({
      status: "transport_error",
      reason: fetched && fetched.reason || "crawler_unavailable",
      source: "scrapling",
    }, phases);
  }

  var candidate = await adapters.parseLegalDocument({
    html: fetched.html,
    text: fetched.text,
    finalUrl: fetched.finalUrl,
  });
  phases.push(phase("parse_legal_candidate", candidate));
  if (!candidate || candidate.status !== "found" || !candidate.value) {
    return resultWithTiming({
      status: "impressum_missing",
      reason: candidate && candidate.reason || "legal_identity_missing",
      source: "scrapling",
      sourceUrl: fetched.finalUrl || website,
    }, phases);
  }
  return resultWithTiming({
    status: "found",
    candidate: candidate.value,
    source: "scrapling",
    sourceUrl: fetched.finalUrl || website,
  }, phases);
}

module.exports = { collect: collect };
