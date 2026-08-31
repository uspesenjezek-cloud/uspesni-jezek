"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
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
  migrationContentSha256,
  migrationVersion,
  parseGitStatusPorcelainZ,
  parseDryRunOutput,
  runDeploymentPreflight,
} = require("./check-pos-migration-deployment");

const allowed = [...POS_MIGRATION_ALLOWLIST];
assert.deepEqual(allowed, Object.keys(POS_MIGRATION_MANIFEST), "allowlist mora izhajati iz vsebinskega manifesta");
assert.equal(
  migrationContentSha256("select 1;\r\n"),
  migrationContentSha256("select 1;\n"),
  "SHA-256 manifest mora biti neodvisen od CRLF/LF checkouta"
);

function validManifestRecords() {
  return Object.fromEntries(Object.entries(POS_MIGRATION_MANIFEST).map(([name, sha256]) => [
    name,
    { tracked: true, size: 1, sha256 },
  ]));
}

const validManifest = evaluateAllowlistedMigrationFiles(validManifestRecords());
assert.equal(validManifest.safe, true, "pregledan manifest mora biti varen");
assert.deepEqual(validManifest.issues, []);

const missingRecords = validManifestRecords();
delete missingRecords[allowed[0]];
assert.ok(
  evaluateAllowlistedMigrationFiles(missingRecords).issues.some((issue) => issue.name === allowed[0] && issue.code === "MISSING"),
  "manjkajoča dovoljena migracija mora blokirati deployment"
);

const untrackedRecords = validManifestRecords();
untrackedRecords[allowed[0]].tracked = false;
assert.ok(
  evaluateAllowlistedMigrationFiles(untrackedRecords).issues.some((issue) => issue.name === allowed[0] && issue.code === "UNTRACKED"),
  "nesledena dovoljena migracija mora blokirati deployment"
);

const emptyRecords = validManifestRecords();
emptyRecords[allowed[0]].size = 0;
assert.ok(
  evaluateAllowlistedMigrationFiles(emptyRecords).issues.some((issue) => issue.name === allowed[0] && issue.code === "EMPTY"),
  "prazna dovoljena migracija mora blokirati deployment"
);

const changedRecords = validManifestRecords();
changedRecords[allowed[0]].sha256 = "0".repeat(64);
assert.ok(
  evaluateAllowlistedMigrationFiles(changedRecords).issues.some((issue) => issue.name === allowed[0] && issue.code === "HASH_MISMATCH"),
  "vsebinsko spremenjena dovoljena migracija mora blokirati deployment"
);

const repositoryManifest = inspectAllowlistedMigrationFiles();
assert.equal(repositoryManifest.safe, true, "dejanske dovoljene migracije morajo biti sledene, neprazne in nespremenjene");
assert.deepEqual(repositoryManifest.issues, []);

const phase0bNames = Object.keys(PHASE_0B_MIGRATION_DEPENDENCIES);
assert.ok(
  phase0bNames.every((name) => !POS_MIGRATION_ALLOWLIST.has(name)),
  "Phase 0b dependency načrt ne sme razširiti deployment allowlista"
);

function validPhase0bRecords(names = phase0bNames) {
  return Object.fromEntries(names.map((name) => [
    name,
    { tracked: true, dirty: false, stable: true, size: 1 },
  ]));
}

const validPhase0b = evaluatePhase0bMigrationFiles(validPhase0bRecords());
assert.equal(validPhase0b.safe, true, "celoten urejen in stabilen Phase 0b načrt mora prestati statični pregled");
assert.deepEqual(validPhase0b.issues, []);

const phase0bCheckout = "20260826182713_pos_cash_checkout_state.sql";
const phase0bRefund = "20260826194158_pos_cash_refund_state.sql";
const missingPhase0bDependency = validPhase0bRecords();
delete missingPhase0bDependency[phase0bCheckout];
const missingPhase0bAssessment = evaluatePhase0bMigrationFiles(missingPhase0bDependency);
assert.equal(missingPhase0bAssessment.safe, false);
assert.ok(
  missingPhase0bAssessment.issues.some((issue) => (
    issue.name === phase0bRefund
    && issue.dependency === phase0bCheckout
    && issue.code === "MISSING_DEPENDENCY"
  )),
  "manjkajoči cash predecessor mora blokirati dependentno migracijo"
);

const untrackedPhase0b = validPhase0bRecords();
untrackedPhase0b[phase0bNames[2]].tracked = false;
const untrackedPhase0bAssessment = evaluatePhase0bMigrationFiles(untrackedPhase0b);
assert.equal(untrackedPhase0bAssessment.safe, false);
assert.ok(
  untrackedPhase0bAssessment.issues.some((issue) => issue.code === "UNTRACKED"),
  "untracked Phase 0b migracija mora blokirati preflight"
);

const dirtyPhase0b = validPhase0bRecords();
dirtyPhase0b[phase0bNames[2]].dirty = true;
const dirtyPhase0bAssessment = evaluatePhase0bMigrationFiles(dirtyPhase0b);
assert.equal(dirtyPhase0bAssessment.safe, false);
assert.ok(
  dirtyPhase0bAssessment.issues.some((issue) => issue.code === "DIRTY"),
  "spremenjena sledena Phase 0b migracija mora blokirati preflight"
);

const emptyPhase0b = validPhase0bRecords();
emptyPhase0b[phase0bNames[2]].size = 0;
const emptyPhase0bAssessment = evaluatePhase0bMigrationFiles(emptyPhase0b);
assert.equal(emptyPhase0bAssessment.safe, false);
assert.ok(
  emptyPhase0bAssessment.issues.some((issue) => issue.code === "EMPTY"),
  "prazna Phase 0b migracija mora blokirati preflight"
);

const changedPhase0b = validPhase0bRecords();
changedPhase0b[phase0bNames[2]].stable = false;
const changedPhase0bAssessment = evaluatePhase0bMigrationFiles(changedPhase0b);
assert.equal(changedPhase0bAssessment.safe, false);
assert.ok(
  changedPhase0bAssessment.issues.some((issue) => issue.code === "CHANGED_DURING_INSPECTION"),
  "migracija, spremenjena med pregledom, mora blokirati preflight"
);

const reversedOrderPlan = {
  "20260830212909_pos_cash_provider_recovery_lock_order.sql": [
    "20260830213055_pos_archive_primary_object_recovery.sql",
  ],
  "20260830213055_pos_archive_primary_object_recovery.sql": [],
};
assert.ok(
  evaluatePhase0bMigrationFiles(validPhase0bRecords(Object.keys(reversedOrderPlan)), reversedOrderPlan)
    .issues.some((issue) => issue.code === "DEPENDENCY_ORDER"),
  "predpogoj z novejšim timestampom mora blokirati preflight"
);

const duplicateVersionPlan = {
  "20260830213055_phase0b_a.sql": [],
  "20260830213055_phase0b_b.sql": [],
};
assert.ok(
  evaluatePhase0bMigrationFiles(validPhase0bRecords(Object.keys(duplicateVersionPlan)), duplicateVersionPlan)
    .issues.some((issue) => issue.code === "DUPLICATE_VERSION"),
  "podvojen migracijski timestamp mora blokirati preflight"
);
assert.equal(migrationVersion("20260830213055_phase0b.sql"), "20260830213055");
assert.equal(migrationVersion("phase0b.sql"), "", "neveljavno ime ne sme dobiti migracijske različice");

const unknownClassification = validPhase0bRecords();
delete unknownClassification[phase0bNames[2]].dirty;
delete unknownClassification[phase0bNames[2]].stable;
const unknownClassificationAssessment = evaluatePhase0bMigrationFiles(unknownClassification);
assert.equal(unknownClassificationAssessment.safe, false);
assert.ok(unknownClassificationAssessment.issues.some((issue) => issue.code === "DIRTY_UNKNOWN"));
assert.ok(unknownClassificationAssessment.issues.some((issue) => issue.code === "STABILITY_UNKNOWN"));

const allowlistOverlap = evaluatePhase0bMigrationFiles(
  validPhase0bRecords(),
  PHASE_0B_MIGRATION_DEPENDENCIES,
  new Set([phase0bNames[0]])
);
assert.equal(allowlistOverlap.safe, false, "Phase 0b načrt in deployment allowlist se ne smeta prekrivati");
assert.ok(allowlistOverlap.issues.some((issue) => issue.code === "ALLOWLIST_OVERLAP"));

const porcelainPaths = parseGitStatusPorcelainZ([
  "?? supabase/migrations/new phase0b.sql",
  " M supabase/migrations/modified.sql",
  "R  supabase/migrations/renamed.sql",
  "supabase/migrations/original.sql",
  "",
].join("\0"));
assert.deepEqual([...porcelainPaths].sort(), [
  "supabase/migrations/modified.sql",
  "supabase/migrations/new phase0b.sql",
  "supabase/migrations/original.sql",
  "supabase/migrations/renamed.sql",
].sort(), "porcelain -z parser mora ohraniti presledke ter oba rename pathname-a");
assert.throws(() => parseGitStatusPorcelainZ("R  target.sql\0"), /izvornega pathname-a/);

const phase0bPending = evaluatePendingMigrations(phase0bNames);
assert.equal(phase0bPending.safe, false, "dependency preflight sam ne sme odobriti Phase 0b vrste");
assert.deepEqual(phase0bPending.blocked, [...phase0bNames].sort());

const fakeRepositoryRoot = path.join(__dirname, "..", "canonical-pos-root");
let linkedCwd = null;
const linkedFromCanonicalRoot = inspectLinkedMigrations({
  repositoryRoot: fakeRepositoryRoot,
  spawnSync(_command, _args, options) {
    linkedCwd = options.cwd;
    return { status: 0, stdout: JSON.stringify({ migrations: [] }), stderr: "" };
  },
});
assert.deepEqual(linkedFromCanonicalRoot, []);
assert.equal(linkedCwd, fakeRepositoryRoot, "linked dry-run mora vedno uporabljati isti kanonični root kot manifest");

let sourceCwd = null;
const sourceFromCanonicalRoot = inspectLocalSource({
  repositoryRoot: fakeRepositoryRoot,
  spawnSync(_command, args, options) {
    sourceCwd = options.cwd;
    assert.ok(args.includes(fakeRepositoryRoot), "source attestation mora prejeti kanonični expected-root");
    return { status: 0, stdout: "Lokalni vir potrjen.\n", stderr: "" };
  },
});
assert.equal(sourceFromCanonicalRoot.safe, true);
assert.equal(sourceCwd, fakeRepositoryRoot, "source attestation mora teči iz kanoničnega roota");

const phase0bRelativePaths = phase0bNames.map((name) => `supabase/migrations/${name}`);
const untrackedPhase0bName = phase0bNames[2];
let phase0bStatusCalls = 0;
const inspectedPhase0b = inspectPhase0bMigrationFiles({
  repositoryRoot: fakeRepositoryRoot,
  spawnSync(_command, args, options) {
    assert.equal(options.cwd, fakeRepositoryRoot);
    if (args.includes("ls-files")) {
      return {
        status: 0,
        stdout: phase0bRelativePaths.filter((entry) => !entry.endsWith(untrackedPhase0bName)).join("\n"),
        stderr: "",
      };
    }
    if (args.includes("status")) {
      phase0bStatusCalls += 1;
      assert.ok(args.includes("-z"), "Git status mora uporabljati NUL-ločen porcelain izhod");
      return { status: 0, stdout: `?? supabase/migrations/${untrackedPhase0bName}\0`, stderr: "" };
    }
    throw new Error("Nepričakovan Git ukaz v Phase 0b inspector testu.");
  },
  readFileSync() {
    return "select 1;\n";
  },
  statSync() {
    return { size: 10, mtimeMs: 1 };
  },
});
assert.equal(phase0bStatusCalls, 2, "Git status se mora preveriti pred in po branju migracij");
assert.equal(inspectedPhase0b.safe, false);
assert.deepEqual(inspectedPhase0b.issues, [{ name: untrackedPhase0bName, code: "UNTRACKED" }]);

let raceStatusCalls = 0;
const concurrentlyChangedPhase0b = inspectPhase0bMigrationFiles({
  repositoryRoot: fakeRepositoryRoot,
  spawnSync(_command, args) {
    if (args.includes("ls-files")) {
      return { status: 0, stdout: phase0bRelativePaths.join("\n"), stderr: "" };
    }
    raceStatusCalls += 1;
    return {
      status: 0,
      stdout: raceStatusCalls === 1 ? "" : ` M supabase/migrations/${untrackedPhase0bName}\0`,
      stderr: "",
    };
  },
  readFileSync() {
    return "select 1;\n";
  },
  statSync() {
    return { size: 10, mtimeMs: 1 };
  },
});
assert.equal(concurrentlyChangedPhase0b.safe, false);
assert.ok(concurrentlyChangedPhase0b.issues.some((issue) => issue.code === "DIRTY"));

let manifestCalls = 0;
let linkedCalls = 0;
const sourceBlocked = runDeploymentPreflight({
  repositoryRoot: fakeRepositoryRoot,
  inspectLocalSource: () => ({ safe: false, code: "SOURCE_ATTESTATION_FAILED" }),
  inspectAllowlistedMigrationFiles: () => {
    manifestCalls += 1;
    return { safe: true, issues: [] };
  },
  inspectLinkedMigrations: () => {
    linkedCalls += 1;
    return [];
  },
});
assert.equal(sourceBlocked.stage, "source");
assert.equal(manifestCalls, 0, "nepotrjen source mora ustaviti tok pred manifestom");
assert.equal(linkedCalls, 0, "nepotrjen source ne sme sprožiti Supabase dry-runa");

["MISSING", "UNTRACKED", "EMPTY", "HASH_MISMATCH"].forEach((code) => {
  let dryRunCalls = 0;
  const manifestBlocked = runDeploymentPreflight({
    repositoryRoot: fakeRepositoryRoot,
    inspectLocalSource: () => ({ safe: true, code: "SOURCE_ATTESTATION_OK" }),
    inspectAllowlistedMigrationFiles: () => ({ safe: false, issues: [{ name: allowed[0], code }] }),
    inspectLinkedMigrations: () => {
      dryRunCalls += 1;
      return [];
    },
  });
  assert.equal(manifestBlocked.stage, "manifest");
  assert.equal(dryRunCalls, 0, `${code} mora ustaviti tok pred Supabase dry-runom`);
});

let phase0bLinkedCalls = 0;
const phase0bBlocked = runDeploymentPreflight({
  repositoryRoot: fakeRepositoryRoot,
  inspectLocalSource: () => ({ safe: true, code: "SOURCE_ATTESTATION_OK" }),
  inspectAllowlistedMigrationFiles: () => ({ safe: true, issues: [] }),
  inspectPhase0bMigrationFiles: () => ({
    safe: false,
    issues: [{ name: phase0bNames[2], code: "UNTRACKED" }],
  }),
  inspectLinkedMigrations: () => {
    phase0bLinkedCalls += 1;
    return [];
  },
});
assert.equal(phase0bBlocked.stage, "phase0b");
assert.equal(phase0bLinkedCalls, 0, "Phase 0b statična napaka mora ustaviti tok pred Supabase dry-runom");

let pendingLinkedCalls = 0;
const pendingFromPreflight = runDeploymentPreflight({
  repositoryRoot: fakeRepositoryRoot,
  inspectLocalSource: () => ({ safe: true, code: "SOURCE_ATTESTATION_OK" }),
  inspectAllowlistedMigrationFiles: () => ({ safe: true, issues: [] }),
  inspectPhase0bMigrationFiles: () => ({ safe: true, issues: [] }),
  inspectLinkedMigrations: () => {
    pendingLinkedCalls += 1;
    return [allowed[0]];
  },
});
assert.equal(pendingFromPreflight.stage, "pending");
assert.equal(pendingFromPreflight.assessment.safe, true);
assert.deepEqual(pendingFromPreflight.assessment.allowed, [allowed[0]]);
assert.equal(pendingLinkedCalls, 1, "veljaven statični načrt sme nadaljevati v en sam linked dry-run");

const parsed = parseDryRunOutput([
  "DRY RUN: migrations will *not* be pushed to the database.",
  JSON.stringify({ dryRun: true, migrations: allowed }),
].join("\n"));
assert.deepEqual(parsed, allowed, "dry-run JSON mora ostati strojno berljiv");

const safe = evaluatePendingMigrations([allowed[0], allowed[0], allowed[1]]);
assert.equal(safe.safe, true, "podmnožica dovoljene POS vrste mora biti varna");
assert.deepEqual(safe.blocked, []);
assert.deepEqual(safe.historyGaps, []);
assert.equal(safe.pending.length, 2, "podvojene migracije se morajo odstraniti");

const historyGapName = [...VERIFIED_SCHEMA_HISTORY_GAPS][0];
const historyGap = evaluatePendingMigrations([
  allowed[0],
  historyGapName,
]);
assert.equal(historyGap.safe, false, "manjkajoči zapis zgodovine mora blokirati POS deployment");
assert.deepEqual(historyGap.historyGaps, [historyGapName]);
assert.deepEqual(historyGap.blocked, []);

const unrelatedName = "20990101000000_unapproved_feature.sql";
const mixed = evaluatePendingMigrations([allowed[0], unrelatedName]);
assert.equal(mixed.safe, false, "neodobrena migracija mora blokirati POS deployment");
assert.deepEqual(mixed.blocked, [unrelatedName]);
assert.deepEqual(mixed.historyGaps, []);

const cashMigrationGroup = ATOMIC_MIGRATION_GROUPS.find((group) => group.includes("20260826182713_pos_cash_checkout_state.sql"));
assert.ok(cashMigrationGroup, "Gotovinski checkout in refund morata biti registrirana kot atomska migracijska skupina.");
const partialCash = evaluatePendingMigrations([cashMigrationGroup[0]]);
assert.equal(partialCash.safe, false, "Samo ena gotovinska migracija mora blokirati deployment.");
assert.deepEqual(partialCash.incompleteGroups, [cashMigrationGroup]);
const completeCashPair = evaluatePendingMigrations(cashMigrationGroup);
assert.deepEqual(completeCashPair.incompleteGroups, [], "Celoten checkout/refund par ne sme biti označen kot nepopoln.");
assert.deepEqual(completeCashPair.blocked, cashMigrationGroup, "Par ostaja neodobren in ga atomsko pravilo ne sme samodejno allowlistati.");

const succeededStateMigration = fs.readdirSync(path.join(__dirname, "..", "supabase", "migrations"))
  .find((name) => /pos_openapi_succeeded_delivery_state\.sql$/.test(name));
assert.ok(succeededStateMigration, "Manjka SENT/succeeded migracija.");
const unexpectedlyPending = evaluatePendingMigrations([succeededStateMigration]);
assert.equal(unexpectedlyPending.safe, false, "Že nameščena Openapi migracija mora ob ponovnem pojavu v čakalni vrsti odpovedati varno.");
assert.deepEqual(unexpectedlyPending.blocked, [succeededStateMigration]);

assert.throws(
  () => parseDryRunOutput("Would push these migrations, but JSON is missing"),
  /strojno berljivega/,
  "neznan CLI izhod mora odpovedati varno"
);

console.log("POS migration deployment guard tests passed.");
