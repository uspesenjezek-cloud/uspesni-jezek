const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const indexRoot = path.join(root, "app", "company-index");
const outputRoot = path.join(root, "output", "playwright", "boniteta-100-gmbh");
const source = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(indexRoot, "manifest.json"), "utf8"));

assert.match(source, /window\.UJBonitetaAuditIzrisi[\s\S]*?lokalniAudit: true/,
  "100-primerov pregled mora uporabljati dejanski prikazovalnik, omejen na localhost.");
assert.match(source, /insolvencaPodatki\.innerHTML = "";[\s\S]*?insolvencaSlika\.removeAttribute\("src"\)/,
  "Vsak nov rezultat mora pred prikazom odstraniti podatke in sliko prejšnjega podjetja.");
assert.match(source, /if \(!jeLokalniAudit\) void shraniZakljucenoPreverbo/,
  "Lokalni audit ne sme shranjevati testnih podjetij ali klicati produkcijske persistence.");

const fixtures = [];
const seen = new Set();
let eligibleWildcardIndex = 0;
for (const shard of manifest.shards) {
  if (fixtures.length >= 100) break;
  const shardPath = path.join(indexRoot, shard.key + ".json.gz");
  if (!fs.existsSync(shardPath)) continue;
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(shardPath)).toString("utf8"));
  for (const row of rows) {
    const [name, city, registerType, registerNumber, registerCourt, active, companyId] = row;
    if (fixtures.length >= 100) break;
    if (active !== true || !/\bGmbH\b/i.test(String(name || ""))) continue;
    if (!name || !city || !registerType || !registerNumber || !registerCourt || !companyId) continue;
    const key = [name, city, registerType, registerNumber, registerCourt].join("|").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const legalName = String(name).replace(/\s+/g, " ").trim();
    const core = legalName.replace(/\s+GmbH\b.*$/i, "").trim();
    const wildcardEligible = core.length > 5;
    const wildcard = wildcardEligible && eligibleWildcardIndex % 2 === 1;
    if (wildcardEligible) eligibleWildcardIndex += 1;
    const searchName = wildcard && core.length > 5 ? core.slice(0, -1) + "*" : legalName;
    const postalCode = String(10000 + fixtures.length).slice(0, 5);
    fixtures.push({
      caseNumber: fixtures.length + 1,
      legalName,
      searchName,
      city: String(city),
      postalCode,
      street: "Auditstraße " + (fixtures.length + 1),
      registerType: String(registerType),
      registerNumber: String(registerNumber),
      registerCourt: String(registerCourt),
      companyId: String(companyId),
      wildcard,
    });
  }
}

assert.equal(fixtures.length, 100, "Lokalni registrski indeks mora zagotoviti 100 različnih aktivnih GmbH.");
assert.equal(new Set(fixtures.map((item) => item.legalName + "|" + item.companyId)).size, 100,
  "Vsak primer mora predstavljati drugo registrsko identiteto.");
assert.ok(fixtures.filter((item) => item.wildcard).length >= 30,
  "Najmanj 30 primerov mora preveriti jasno ločitev wildcard iskalnega niza od pravnega imena.");

fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, "fixtures.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: manifest.source,
  sourceSnapshotDate: manifest.snapshotDate,
  count: fixtures.length,
  fixtures,
}, null, 2));

console.log("✓ Pripravljenih je 100 različnih GmbH; " + fixtures.filter((item) => item.wildcard).length + " uporablja wildcard.");
