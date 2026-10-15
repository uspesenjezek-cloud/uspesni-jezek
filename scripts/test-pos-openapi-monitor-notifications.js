"use strict";
const assert = require("node:assert/strict");
const { summarize } = require("./pos-openapi-monitor");
const { decide } = require("./pos-openapi-monitor-notifications");
const base = { diagnosticsOnly: true, processed: 0, reconciled: 0, ok: false, degraded: true,
  recoveryDiagnosticsUnavailable: false,
  recoveryRequired: [{ id: "synthetic-a", code: "OPENAPI_SUBMISSION_OUTCOME_UNKNOWN_REVIEW_REQUIRED" }] };
const incident = summarize(503, base);
const first = decide(incident, null);
assert.equal(first.exitCode, 1);
assert.equal(decide(incident, first.state).exitCode, 0);
assert.equal(incident.ok, false);
for (const body of [
  { ...base, recoveryRequired: [{ ...base.recoveryRequired[0], id: "synthetic-b" }] },
  { ...base, recoveryRequired: [{ ...base.recoveryRequired[0], code: "OPENAPI_LOCAL_FAILURE_REVIEW_REQUIRED" }] },
  { ...base, recoveryRequired: [...base.recoveryRequired, ...base.recoveryRequired] },
  { ...base, recoveryRequired: [{ code: base.recoveryRequired[0].code }] },
  { ...base, recoveryDiagnosticsUnavailable: true },
  { ...base, recoveryDiagnosticsDeferred: true },
]) assert.notEqual(decide(summarize(503, body), first.state).exitCode, 0);
for (const result of [summarize(401, null), summarize(500, null), { exitCode: 2, code: "MONITOR_REQUEST_FAILED" }])
  assert.equal(decide(result, first.state).exitCode, 2);
for (const previous of [null, {}, { version: 0, fingerprint: incident.incidentFingerprint }, "invalid"])
  assert.equal(decide(incident, previous).exitCode, 1);
const healthy = decide({ ok: true, exitCode: 0 }, first.state);
assert.equal(healthy.state.fingerprint, null);
assert.equal(decide(incident, healthy.state).exitCode, 1);
assert(!JSON.stringify(incident).includes("synthetic-a"));
console.log("Openapi notification regression: PASS (repeat, identity, count, reason, recovery, fail-closed, redaction)");
