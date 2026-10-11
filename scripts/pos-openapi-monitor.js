"use strict";

// Run only after deployment of the authenticated diagnostics-only worker path.
// The deployment acceptance check must precede activation of this monitor.
const ENDPOINT = "https://uspesni-jezek.vercel.app/api/pos-dostava-delavec?diagnostics=1";
const MAX_RESPONSE_BYTES = 65536;
const KNOWN_RECOVERY_CODES = new Set([
  "OPENAPI_SUBMISSION_OUTCOME_UNKNOWN_REVIEW_REQUIRED",
  "OPENAPI_RECONCILIATION_ATTEMPTS_EXHAUSTED",
  "DELIVERY_ATTEMPTS_EXHAUSTED_RECONCILIATION_REQUIRED",
]);

function summarize(status, body) {
  if (status === 401 || status === 403) return { ok: false, code: "MONITOR_AUTH_FAILED", exitCode: 2 };
  if (!body || body.diagnosticsOnly !== true || body.processed !== 0 || body.reconciled !== 0) {
    return { ok: false, code: "MONITOR_DIAGNOSTIC_CONTRACT_MISSING", exitCode: 2 };
  }
  if (![200, 503].includes(status) || typeof body.degraded !== "boolean"
      || typeof body.ok !== "boolean" || typeof body.recoveryDiagnosticsUnavailable !== "boolean"
      || !Array.isArray(body.recoveryRequired)) {
    return { ok: false, code: "MONITOR_INVALID_RESPONSE", exitCode: 2 };
  }
  const recovery = {};
  for (const item of body.recoveryRequired) {
    const code = item && KNOWN_RECOVERY_CODES.has(item.code) ? item.code : "UNKNOWN_RECOVERY_REASON";
    recovery[code] = (recovery[code] || 0) + 1;
  }
  const unhealthy = status === 503 || !body.ok || body.degraded
    || body.recoveryDiagnosticsUnavailable || body.recoveryDiagnosticsDeferred === true
    || body.recoveryRequired.length > 0;
  return {
    ok: !unhealthy,
    code: unhealthy ? "OPENAPI_OPERATOR_REVIEW_REQUIRED" : "OPENAPI_DIAGNOSTICS_HEALTHY",
    exitCode: unhealthy ? 1 : 0,
    status,
    recoveryCount: body.recoveryRequired.length,
    recovery,
    diagnosticsUnavailable: body.recoveryDiagnosticsUnavailable,
  };
}

async function run(options = {}) {
  const secret = options.secret === undefined ? process.env.POS_OPENAPI_DIAGNOSTICS_SECRET : options.secret;
  if (typeof secret !== "string" || secret.length < 32) return { ok: false, code: "MONITOR_SECRET_MISSING", exitCode: 2 };
  // This acknowledgement records deployment acceptance; it does not bypass auth.
  if (options.releaseVerified !== true) return { ok: false, code: "MONITOR_RELEASE_NOT_VERIFIED", exitCode: 2 };
  try {
    const response = await (options.fetch || fetch)(ENDPOINT, {
      method: "GET",
      redirect: "error",
      headers: { Authorization: "Bearer " + secret, Accept: "application/json" },
      signal: AbortSignal.timeout(25000),
    });
    if ([401, 403].includes(response.status)) return summarize(response.status, null);
    const reader = response.body && response.body.getReader();
    if (!reader) return { ok: false, code: "MONITOR_EMPTY_RESPONSE", exitCode: 2 };
    const chunks = [];
    let bytes = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return { ok: false, code: "MONITOR_RESPONSE_TOO_LARGE", exitCode: 2 };
      }
      chunks.push(Buffer.from(next.value));
    }
    return summarize(response.status, JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (_) {
    // Transport/provider response text may contain credentials or customer data.
    return { ok: false, code: "MONITOR_REQUEST_FAILED", exitCode: 2 };
  }
}

if (require.main === module) {
  run({ releaseVerified: process.env.POS_OPENAPI_DIAGNOSTICS_RELEASE_VERIFIED === "true" }).then(result => {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), ...result }));
    process.exitCode = result.exitCode;
  });
}

module.exports = { ENDPOINT, MAX_RESPONSE_BYTES, summarize, run };
