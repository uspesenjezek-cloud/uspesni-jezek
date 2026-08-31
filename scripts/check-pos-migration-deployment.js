"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");
const POS_MIGRATION_MANIFEST = Object.freeze({
  "20260824172000_pos_openapi_webhook_submission_clock.sql": "d496952eea5582f155e5cf448967acf72864a4f159f4c8a0a9fff0e9418948d4",
  "20260824173301_pos_manual_payment_retry_idempotency.sql": "dfb0c46760c20f5b76932dd715f36e60ece5ae0c4e353855bf554a0942bc1f10",
  "20260824173649_pos_archive_durable_document_recovery.sql": "32e30ae425404e0dc9f518b0b364151bd921589988b6b568d04e04caf1f6aacb",
  "20260824181038_pos_public_rpc_invoker_hardening.sql": "d69541e6f06134e1fe8828da7fba77cb6d28278fc2b3fe4dd27e85c4c83da2b4",
  "20260824181626_pos_database_lint_cleanup.sql": "6c7c1ab485a94dcb6fcef764f5adbac8b1c73d85dfd588f4d01dcf62c4125e8b",
  "20260824182529_pos_openapi_reconciliation_tracking.sql": "bd5b0e75e5bc9c387327a223102142d9e9046dc92997bbb16042b7287abcd47d",
});
const POS_MIGRATION_ALLOWLIST = new Set(Object.keys(POS_MIGRATION_MANIFEST));

// Read-only catalog verification on 2026-08-24 confirmed that the remote
// schema already contains these migrations' effects, although their versions
// are absent from supabase_migrations.schema_migrations. They must stay
// blocked: replaying them is unsafe and repairing remote history requires an
// explicit production write approval.
const VERIFIED_SCHEMA_HISTORY_GAPS = new Set([
  "20260822231500_sinhronizacija_mojih_korakov.sql",
  "20260823150000_nedenarne_poravnave.sql",
  "20260824090000_delna_nedenarna_poravnava.sql",
]);

const ATOMIC_MIGRATION_GROUPS = [
  [
    "20260826182713_pos_cash_checkout_state.sql",
    "20260826194158_pos_cash_refund_state.sql",
  ],
];

// This plan describes local Phase 0b ordering only. It is intentionally
// separate from POS_MIGRATION_MANIFEST and never authorizes deployment.
const PHASE_0B_MIGRATION_DEPENDENCIES = Object.freeze({
  "20260826182713_pos_cash_checkout_state.sql": Object.freeze([]),
  "20260826194158_pos_cash_refund_state.sql": Object.freeze([
    "20260826182713_pos_cash_checkout_state.sql",
  ]),
  "20260829165203_pos_payment_safety_v2.sql": Object.freeze([
    "20260826182713_pos_cash_checkout_state.sql",
    "20260826194158_pos_cash_refund_state.sql",
  ]),
  "20260830172315_pos_stripe_event_invoice_lock.sql": Object.freeze([
    "20260829165203_pos_payment_safety_v2.sql",
  ]),
  "20260830212243_pos_stripe_refund_recovery.sql": Object.freeze([
    "20260829165203_pos_payment_safety_v2.sql",
  ]),
  "20260830212449_pos_bank_confirm_retry_idempotency.sql": Object.freeze([
    "20260829165203_pos_payment_safety_v2.sql",
  ]),
  "20260830212909_pos_cash_provider_recovery_lock_order.sql": Object.freeze([
    "20260826182713_pos_cash_checkout_state.sql",
    "20260826194158_pos_cash_refund_state.sql",
    "20260829165203_pos_payment_safety_v2.sql",
  ]),
  "20260830213055_pos_archive_primary_object_recovery.sql": Object.freeze([]),
});

function migrationContentSha256(content) {
  const normalized = String(content || "").replace(/\r\n?/g, "\n");
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

function evaluateAllowlistedMigrationFiles(recordsByName) {
  const records = recordsByName && typeof recordsByName === "object" ? recordsByName : {};
  const issues = [];

  Object.entries(POS_MIGRATION_MANIFEST).forEach(function ([name, expectedSha256]) {
    const record = records[name];
    if (!record) {
      issues.push({ name, code: "MISSING" });
      return;
    }
    if (record.tracked !== true) issues.push({ name, code: "UNTRACKED" });
    if (!Number.isSafeInteger(record.size) || record.size <= 0) {
      issues.push({ name, code: "EMPTY" });
      return;
    }
    if (String(record.sha256 || "").toLowerCase() !== expectedSha256) {
      issues.push({ name, code: "HASH_MISMATCH" });
    }
  });

  return { issues, safe: issues.length === 0 };
}

function inspectAllowlistedMigrationFiles(options = {}) {
  const repositoryRoot = options.repositoryRoot || REPOSITORY_ROOT;
  const readFileSync = options.readFileSync || fs.readFileSync;
  const runSync = options.spawnSync || spawnSync;
  const names = Object.keys(POS_MIGRATION_MANIFEST);
  const relativePaths = names.map((name) => `supabase/migrations/${name}`);
  const gitSafeDirectory = repositoryRoot.replace(/\\/g, "/");
  const trackedResult = runSync(
    "git",
    ["-c", `safe.directory=${gitSafeDirectory}`, "ls-files", "--", ...relativePaths],
    { cwd: repositoryRoot, encoding: "utf8", shell: false }
  );

  if (trackedResult.error || trackedResult.status !== 0) {
    return {
      issues: [{ name: "POS_MIGRATION_MANIFEST", code: "TRACKING_CHECK_FAILED" }],
      safe: false,
    };
  }

  const tracked = new Set(
    String(trackedResult.stdout || "").split(/\r?\n/).map((entry) => entry.trim().replace(/\\/g, "/")).filter(Boolean)
  );
  const records = {};

  names.forEach(function (name) {
    const relativePath = `supabase/migrations/${name}`;
    const absolutePath = path.join(repositoryRoot, "supabase", "migrations", name);
    let content;
    try {
      content = readFileSync(absolutePath, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") return;
      throw error;
    }
    records[name] = {
      tracked: tracked.has(relativePath),
      size: Buffer.byteLength(content, "utf8"),
      sha256: migrationContentSha256(content),
    };
  });

  return evaluateAllowlistedMigrationFiles(records);
}

function migrationVersion(name) {
  const match = /^(\d{14})_[a-z0-9][a-z0-9_]*\.sql$/.exec(String(name || ""));
  return match ? match[1] : "";
}

function evaluatePhase0bMigrationFiles(
  recordsByName,
  dependencies = PHASE_0B_MIGRATION_DEPENDENCIES,
  deploymentAllowlist = POS_MIGRATION_ALLOWLIST
) {
  const records = recordsByName && typeof recordsByName === "object" ? recordsByName : {};
  const plan = dependencies && typeof dependencies === "object" ? dependencies : {};
  const names = Object.keys(plan);
  const planned = new Set(names);
  const versionOwners = new Map();
  const issues = [];

  names.forEach(function (name) {
    if (deploymentAllowlist && deploymentAllowlist.has(name)) {
      issues.push({ name, code: "ALLOWLIST_OVERLAP" });
    }

    const version = migrationVersion(name);
    if (!version) {
      issues.push({ name, code: "INVALID_NAME" });
    } else if (versionOwners.has(version)) {
      issues.push({ name, code: "DUPLICATE_VERSION", otherName: versionOwners.get(version) });
    } else {
      versionOwners.set(version, name);
    }

    const record = records[name];
    if (!record) {
      issues.push({ name, code: "MISSING" });
      return;
    }
    if (record.tracked !== true) {
      issues.push({ name, code: "UNTRACKED" });
    } else if (record.dirty === true) {
      issues.push({ name, code: "DIRTY" });
    } else if (record.dirty !== false) {
      issues.push({ name, code: "DIRTY_UNKNOWN" });
    }
    if (record.stable === false) {
      issues.push({ name, code: "CHANGED_DURING_INSPECTION" });
    } else if (record.stable !== true) {
      issues.push({ name, code: "STABILITY_UNKNOWN" });
    }
    if (!Number.isSafeInteger(record.size) || record.size <= 0) issues.push({ name, code: "EMPTY" });
  });

  names.forEach(function (dependent) {
    const prerequisites = plan[dependent];
    if (!Array.isArray(prerequisites)) {
      issues.push({ name: dependent, code: "INVALID_DEPENDENCY_LIST" });
      return;
    }

    const seen = new Set();
    prerequisites.forEach(function (prerequisite) {
      if (seen.has(prerequisite)) {
        issues.push({ name: dependent, dependency: prerequisite, code: "DUPLICATE_DEPENDENCY" });
        return;
      }
      seen.add(prerequisite);

      if (!planned.has(prerequisite)) {
        issues.push({ name: dependent, dependency: prerequisite, code: "UNDECLARED_DEPENDENCY" });
        return;
      }
      if (records[dependent] && !records[prerequisite]) {
        issues.push({ name: dependent, dependency: prerequisite, code: "MISSING_DEPENDENCY" });
      }

      const dependentVersion = migrationVersion(dependent);
      const prerequisiteVersion = migrationVersion(prerequisite);
      if (dependentVersion && prerequisiteVersion && prerequisiteVersion >= dependentVersion) {
        issues.push({ name: dependent, dependency: prerequisite, code: "DEPENDENCY_ORDER" });
      }
    });
  });

  return { issues, safe: issues.length === 0 };
}

function parseGitStatusPorcelainZ(output) {
  const entries = String(output || "").split("\0");
  const paths = new Set();

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) continue;
    if (entry.length < 4 || entry[2] !== " ") {
      throw new Error("Git status ni vrnil veljavnega porcelain v1 -z zapisa.");
    }

    const status = entry.slice(0, 2);
    const currentPath = entry.slice(3).replace(/\\/g, "/");
    if (!currentPath) throw new Error("Git status je vrnil prazen pathname.");
    paths.add(currentPath);

    if (/[RC]/.test(status)) {
      const originalPath = entries[index + 1];
      if (!originalPath) throw new Error("Git rename/copy status nima izvornega pathname-a.");
      paths.add(originalPath.replace(/\\/g, "/"));
      index += 1;
    }
  }

  return paths;
}

function inspectPhase0bMigrationFiles(options = {}) {
  const repositoryRoot = options.repositoryRoot || REPOSITORY_ROOT;
  const readFileSync = options.readFileSync || fs.readFileSync;
  const statSync = options.statSync || fs.statSync;
  const runSync = options.spawnSync || spawnSync;
  const names = Object.keys(PHASE_0B_MIGRATION_DEPENDENCIES);
  const relativePaths = names.map((name) => `supabase/migrations/${name}`);
  const gitSafeDirectory = repositoryRoot.replace(/\\/g, "/");
  const gitOptions = { cwd: repositoryRoot, encoding: "utf8", shell: false };
  const trackedResult = runSync(
    "git",
    ["-c", `safe.directory=${gitSafeDirectory}`, "ls-files", "--", ...relativePaths],
    gitOptions
  );

  if (trackedResult.error || trackedResult.status !== 0) {
    return {
      issues: [{ name: "PHASE_0B_MIGRATION_DEPENDENCIES", code: "TRACKING_CHECK_FAILED" }],
      safe: false,
    };
  }

  function inspectStatus() {
    return runSync(
      "git",
      ["-c", `safe.directory=${gitSafeDirectory}`, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...relativePaths],
      gitOptions
    );
  }

  const statusBefore = inspectStatus();
  if (statusBefore.error || statusBefore.status !== 0) {
    return {
      issues: [{ name: "PHASE_0B_MIGRATION_DEPENDENCIES", code: "STATUS_CHECK_FAILED" }],
      safe: false,
    };
  }

  const tracked = new Set(
    String(trackedResult.stdout || "").split(/\r?\n/).map((entry) => entry.trim().replace(/\\/g, "/")).filter(Boolean)
  );
  const records = {};

  names.forEach(function (name) {
    const relativePath = `supabase/migrations/${name}`;
    const absolutePath = path.join(repositoryRoot, "supabase", "migrations", name);
    let before;
    let content;
    let after;
    try {
      before = statSync(absolutePath);
      content = readFileSync(absolutePath, "utf8");
      after = statSync(absolutePath);
    } catch (error) {
      if (error && error.code === "ENOENT") return;
      throw error;
    }
    records[name] = {
      tracked: tracked.has(relativePath),
      stable: before.size === after.size && before.mtimeMs === after.mtimeMs,
      size: Buffer.byteLength(content, "utf8"),
    };
  });

  const statusAfter = inspectStatus();
  if (statusAfter.error || statusAfter.status !== 0) {
    return {
      issues: [{ name: "PHASE_0B_MIGRATION_DEPENDENCIES", code: "STATUS_RECHECK_FAILED" }],
      safe: false,
    };
  }

  let dirty;
  try {
    dirty = new Set([
      ...parseGitStatusPorcelainZ(statusBefore.stdout),
      ...parseGitStatusPorcelainZ(statusAfter.stdout),
    ]);
  } catch (_error) {
    return {
      issues: [{ name: "PHASE_0B_MIGRATION_DEPENDENCIES", code: "STATUS_PARSE_FAILED" }],
      safe: false,
    };
  }
  names.forEach(function (name) {
    if (!records[name]) return;
    records[name].dirty = dirty.has(`supabase/migrations/${name}`);
  });

  return evaluatePhase0bMigrationFiles(records);
}

function inspectLocalSource(options = {}) {
  const repositoryRoot = options.repositoryRoot || REPOSITORY_ROOT;
  const runSync = options.spawnSync || spawnSync;
  const result = runSync(
    process.execPath,
    [
      path.join(repositoryRoot, "scripts", "verify-local-source.js"),
      "--expected-root",
      repositoryRoot,
      "--url",
      "http://localhost:8001",
      "--require-auth-egress",
    ],
    { cwd: repositoryRoot, encoding: "utf8", shell: false }
  );
  const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

  if (result.error || result.status !== 0) {
    return { code: "SOURCE_ATTESTATION_FAILED", details, safe: false };
  }
  return { code: "SOURCE_ATTESTATION_OK", safe: true };
}

function parseDryRunOutput(output) {
  const clean = String(output || "").replace(/\u001b\[[0-9;]*m/g, "");
  const lines = clean.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!lines[index].startsWith("{")) continue;
    try {
      const payload = JSON.parse(lines[index]);
      if (Array.isArray(payload.migrations)) return payload.migrations;
    } catch (_error) {
      // Earlier CLI status lines can contain braces; only the final JSON result matters.
    }
  }

  throw new Error("Supabase dry-run ni vrnil strojno berljivega seznama migracij.");
}

function evaluatePendingMigrations(migrations) {
  const pending = [...new Set(migrations.map((name) => String(name).trim()))].sort();
  const pendingSet = new Set(pending);
  const historyGaps = pending.filter((name) => VERIFIED_SCHEMA_HISTORY_GAPS.has(name));
  const blocked = pending.filter(
    (name) => !POS_MIGRATION_ALLOWLIST.has(name) && !VERIFIED_SCHEMA_HISTORY_GAPS.has(name)
  );
  const allowed = pending.filter((name) => POS_MIGRATION_ALLOWLIST.has(name));
  const incompleteGroups = ATOMIC_MIGRATION_GROUPS.filter(function (group) {
    const count = group.filter((name) => pendingSet.has(name)).length;
    return count > 0 && count < group.length;
  });
  return {
    pending,
    allowed,
    historyGaps,
    blocked,
    incompleteGroups,
    safe: blocked.length === 0 && historyGaps.length === 0 && incompleteGroups.length === 0,
  };
}

function inspectLinkedMigrations(options = {}) {
  const repositoryRoot = options.repositoryRoot || REPOSITORY_ROOT;
  const runSync = options.spawnSync || spawnSync;
  const result = runSync(
    "supabase",
    ["db", "push", "--linked", "--dry-run", "--include-all", "--yes", "--output-format", "json"],
    { cwd: repositoryRoot, encoding: "utf8", shell: false }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Supabase dry-run ni uspel.${details ? `\n${details}` : ""}`);
  }

  return parseDryRunOutput([result.stdout, result.stderr].filter(Boolean).join("\n"));
}

function runDeploymentPreflight(options = {}) {
  const repositoryRoot = options.repositoryRoot || REPOSITORY_ROOT;
  const sourceInspector = options.inspectLocalSource || inspectLocalSource;
  const manifestInspector = options.inspectAllowlistedMigrationFiles || inspectAllowlistedMigrationFiles;
  const phase0bInspector = options.inspectPhase0bMigrationFiles || inspectPhase0bMigrationFiles;
  const linkedInspector = options.inspectLinkedMigrations || inspectLinkedMigrations;
  const sourceAssessment = sourceInspector({ repositoryRoot });
  if (!sourceAssessment.safe) {
    return { sourceAssessment, stage: "source" };
  }
  const manifestAssessment = manifestInspector({ repositoryRoot });
  if (!manifestAssessment.safe) {
    return { manifestAssessment, sourceAssessment, stage: "manifest" };
  }
  const phase0bAssessment = phase0bInspector({ repositoryRoot });
  if (!phase0bAssessment.safe) {
    return { manifestAssessment, phase0bAssessment, sourceAssessment, stage: "phase0b" };
  }
  const assessment = evaluatePendingMigrations(linkedInspector({ repositoryRoot }));
  return { assessment, manifestAssessment, phase0bAssessment, sourceAssessment, stage: "pending" };
}

function main() {
  const preflight = runDeploymentPreflight();
  if (preflight.stage === "source") {
    console.error("BLOKIRANO: kanonični lokalni vir ali Supabase Auth egress ni potrjen.");
    if (preflight.sourceAssessment.details) console.error(preflight.sourceAssessment.details);
    console.error("\nVarovalka se je ustavila pred Supabase dry-runom. Nobena migracija ni bila objavljena.");
    process.exitCode = 1;
    return;
  }

  if (preflight.stage === "manifest") {
    console.error("BLOKIRANO: lokalni manifest dovoljenih POS migracij ni veljaven:");
    preflight.manifestAssessment.issues.forEach((issue) => console.error(`  - ${issue.name}: ${issue.code}`));
    console.error("\nVarovalka se je ustavila pred Supabase dry-runom. Nobena migracija ni bila objavljena.");
    process.exitCode = 1;
    return;
  }

  if (preflight.stage === "phase0b") {
    console.error("BLOKIRANO: lokalni Phase 0b migracijski načrt ni pripravljen:");
    preflight.phase0bAssessment.issues.forEach((issue) => {
      const dependency = issue.dependency ? ` (odvisnost: ${issue.dependency})` : "";
      const otherName = issue.otherName ? ` (isti timestamp: ${issue.otherName})` : "";
      console.error(`  - ${issue.name}: ${issue.code}${dependency}${otherName}`);
    });
    console.error("\nUspešen dependency preflight migracij ne odobri in jih ne doda v SHA manifest.");
    console.error("Varovalka se je ustavila pred Supabase dry-runom. Nobena migracija ni bila objavljena.");
    process.exitCode = 1;
    return;
  }

  const assessment = preflight.assessment;

  if (assessment.allowed.length) {
    console.log("Dovoljene čakajoče POS migracije:");
    assessment.allowed.forEach((name) => console.log(`  - ${name}`));
  }

  if (assessment.historyGaps.length) {
    console.error("\nBLOKIRANO: oddaljena shema vsebuje učinke, zgodovina migracij pa nima različic:");
    assessment.historyGaps.forEach((name) => console.error(`  - ${name}`));
    console.error("Teh migracij ni varno ponovno izvesti; potreben je ločeno odobren popravek zgodovine.");
  }

  if (assessment.blocked.length) {
    console.error("\nBLOKIRANO: v Supabase čakalni vrsti so tudi neodobrene migracije:");
    assessment.blocked.forEach((name) => console.error(`  - ${name}`));
  }

  if (assessment.incompleteGroups.length) {
    console.error("\nBLOKIRANO: odvisne migracije morajo biti v čakalni vrsti skupaj:");
    assessment.incompleteGroups.forEach((group) => console.error(`  - ${group.join(" + ")}`));
  }

  if (assessment.historyGaps.length || assessment.blocked.length || assessment.incompleteGroups.length) {
    console.error("\nVarovalka je izvedla samo --dry-run. Nobena migracija ni bila objavljena.");
    process.exitCode = 1;
    return;
  }

  if (!assessment.pending.length) {
    console.log("Supabase nima čakajočih migracij.");
  } else {
    console.log("\nPASS: čakalna vrsta vsebuje samo dovoljene POS migracije.");
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  POS_MIGRATION_MANIFEST,
  POS_MIGRATION_ALLOWLIST,
  VERIFIED_SCHEMA_HISTORY_GAPS,
  ATOMIC_MIGRATION_GROUPS,
  PHASE_0B_MIGRATION_DEPENDENCIES,
  evaluateAllowlistedMigrationFiles,
  evaluatePendingMigrations,
  evaluatePhase0bMigrationFiles,
  inspectAllowlistedMigrationFiles,
  inspectLinkedMigrations,
  inspectLocalSource,
  inspectPhase0bMigrationFiles,
  migrationVersion,
  migrationContentSha256,
  parseGitStatusPorcelainZ,
  parseDryRunOutput,
  runDeploymentPreflight,
};
