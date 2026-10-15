"use strict";
const fs = require("node:fs");
const { run } = require("./pos-openapi-monitor");
const STATE = ".openapi-monitor-state/state.json";
function decide(result, previous) {
  const fingerprint = result.exitCode === 1 && /^[a-f0-9]{64}$/.test(result.incidentFingerprint || "")
    ? result.incidentFingerprint : null;
  const repeated = !!fingerprint && previous?.version === 1 && previous.fingerprint === fingerprint;
  return { repeated, exitCode: repeated ? 0 : result.exitCode,
    state: { version: 1, fingerprint } };
}
async function main() {
  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(STATE, "utf8")); } catch (_) { /* Missing state alerts again. */ }
  const result = await run({ releaseVerified: process.env.POS_OPENAPI_DIAGNOSTICS_RELEASE_VERIFIED === "true" });
  const decision = decide(result, previous);
  fs.mkdirSync(".openapi-monitor-state", { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(decision.state));
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `exit_code=${decision.exitCode}\n`);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), ...result,
    notificationRepeated: decision.repeated, notificationExitCode: decision.exitCode }));
  const message = decision.repeated
    ? "Unresolved Openapi incident unchanged; duplicate notification suppressed. This is not healthy delivery status."
    : `Openapi diagnostic result: ${result.code}.`;
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n\nDiagnostic healthy: ${result.ok}. Recovery count: ${result.recoveryCount ?? "unavailable"}.\n`);
  if (decision.repeated) console.log(`::warning::${message}`);
}
if (require.main === module) main().catch(() => { console.error("MONITOR_NOTIFICATION_STATE_FAILED"); process.exitCode = 2; });
module.exports = { decide };
