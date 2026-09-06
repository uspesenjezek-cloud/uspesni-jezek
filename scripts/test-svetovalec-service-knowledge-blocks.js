"use strict";

const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const knowledge = require("../app/svetovalec-service-knowledge-blocks");
const capabilities = require("../app/svetovalec-capability-catalog");
const approved = require("../NAZORJEVA");

const validation = knowledge.validate();
assert.equal(validation.valid, true, validation.errors.join("\n"));
assert.equal(validation.metrics.profiles, 43, "Katalog mora pokriti vseh 43 storitev.");
assert.equal(validation.metrics.families, 16, "Katalog mora pokriti vseh 16 družin.");
assert.equal(Object.keys(knowledge.profileBlueprints).length, 43, "Vsak profil potrebuje konkreten blueprint.");
assert.ok(validation.metrics.facts >= 200, "Katalog mora vsebovati dovolj konkretnih podatkovnih potreb.");
assert.ok(validation.metrics.approximateTokens < 1000, "Podporni Luninin kontekst mora ostati pod 1000 približnimi tokeni.");

const blockIds = new Set();
const promptCodes = new Set();
const interfaceIds = new Set();
const factIds = new Set();
const approvedWidgets = new Set(approved.ids);
for (const block of knowledge.blocks) {
  assert.ok(!blockIds.has(block.id), `Podvojen block ID: ${block.id}`);
  assert.ok(!promptCodes.has(block.promptCode), `Podvojen prompt code: ${block.promptCode}`);
  assert.ok(!interfaceIds.has(block.interfaceId), `Podvojen interfaceId: ${block.interfaceId}`);
  blockIds.add(block.id);
  promptCodes.add(block.promptCode);
  interfaceIds.add(block.interfaceId);
  assert.ok(block.purpose && block.promptSummary, `Blok ${block.id} potrebuje namen in kratek povzetek.`);
  assert.ok(block.completionGate.length, `Blok ${block.id} potrebuje completion gate.`);
  for (const dependency of block.dependsOn) assert.ok(knowledge.blockById[dependency], `Manjka odvisnost ${dependency}.`);
  for (const field of block.facts) {
    assert.ok(!factIds.has(field.id), `Podvojen fact ID: ${field.id}`);
    assert.ok(!interfaceIds.has(field.interfaceId), `Podvojen field interfaceId: ${field.interfaceId}`);
    assert.ok(approvedWidgets.has(field.widgetId), `Widget ${field.widgetId} ni odobren v NAZORJEVA.`);
    assert.equal(field.contextVersion, knowledge.contextVersion);
    factIds.add(field.id);
    interfaceIds.add(field.interfaceId);
  }
}

for (const profile of capabilities.profiles) {
  const blueprint = knowledge.profileBlueprints[profile.profileId];
  assert.ok(blueprint, `Manjka blueprint profila ${profile.profileId}.`);
  assert.ok(blueprint.blockIds.includes(`svc:f:${profile.familyCode}`), `Profil ${profile.profileId} mora vključiti svojo družino.`);
  assert.ok(blueprint.blockIds.includes(`svc:p:${profile.profileId}`), `Profil ${profile.profileId} mora vključiti lastni specifični blok.`);
  for (const action of capabilities.actions) {
    const plan = knowledge.resolve(profile.profileId, action.code);
    assert.ok(plan.blockIds.includes("svc:c:action"), `${profile.profileId}/${action.code} nima zaključnega gatea.`);
    assert.ok(plan.blockIds.includes(`svc:f:${profile.familyCode}`));
    assert.ok(plan.blockIds.includes(`svc:p:${profile.profileId}`));
  }
}

const marketingContract = knowledge.resolve(1022, "pogajanje");
for (const expected of [
  "svc:c:provider", "svc:c:scope", "svc:c:price", "svc:c:performance", "svc:c:term",
  "svc:c:exit", "svc:c:evidence", "svc:c:negotiate", "svc:f:marketing", "svc:p:1022", "svc:c:action"
]) assert.ok(marketingContract.blockIds.includes(expected), `Marketing pogodba mora vključiti ${expected}.`);

const term = knowledge.blockById["svc:c:term"];
for (const expectedFact of ["term.start", "term.end", "term.minimumMonths", "term.renewal"])
  assert.ok(term.facts.some((field) => field.id === expectedFact), `Pogodbeni blok mora lokalno poznati ${expectedFact}.`);
assert.ok(term.unlocks.includes("svc:c:exit"), "Trajanje mora brez novega modelskega klica odkleniti izstop.");
const exit = knowledge.blockById["svc:c:exit"];
for (const expectedFact of ["exit.notice", "exit.method", "exit.penalty", "exit.handover"])
  assert.ok(exit.facts.some((field) => field.id === expectedFact), `Izstopni blok mora lokalno poznati ${expectedFact}.`);

const missing = knowledge.missingFacts(marketingContract, {
  "situation.goal":"Znižati ceno ali odpovedati",
  "provider.relationship":"obstoječ",
  "scope.subject":"Pogodba z marketing agencijo"
});
assert.ok(missing.some((entry) => entry.factId === "price.baseEur"));
assert.ok(missing.some((entry) => entry.factId === "term.renewal"));
assert.ok(missing.some((entry) => entry.factId === "exit.notice"));
assert.ok(missing.some((entry) => entry.factId === "performance.metric"));
assert.ok(missing.every((entry) => approvedWidgets.has(entry.widgetId)));

const selectedMarketing = knowledge.resolveSelection(1022, "pogajanje", ["c3", "c4", "c5", "c6"]);
for (const selectedId of ["svc:c:price", "svc:c:term", "svc:c:exit", "svc:c:performance", "svc:f:marketing", "svc:p:1022"])
  assert.ok(selectedMarketing.blockIds.includes(selectedId), `Izbor Lune mora lokalno razrešiti ${selectedId}.`);
assert.ok(!selectedMarketing.blockIds.includes("svc:c:action"), "Vmesni izbor Lune ne sme prezgodaj odpreti zaključnega koraka.");
assert.throws(() => knowledge.resolveSelection(1022, "pogajanje", ["ne-obstaja"]), /Neznan izbrani blok/);
assert.throws(() => knowledge.resolveSelection(1022, "ponudba", ["c5"]), /ni dovoljen/);

const profileUpsells = knowledge.blockById["svc:p:1022"].upsellRules;
assert.ok(profileUpsells.length >= 1, "Profil mora imeti le pogojne, dokazljive povezane predloge.");
assert.ok(profileUpsells.every((rule) => rule.mode === "suggest-only" && rule.when.length), "Upsell ne sme biti brez pogoja ali samodejen.");

const compact = knowledge.compactOperatingModel();
assert.equal(compact.profiles.length, 43);
assert.equal(Object.keys(compact.families).length, 16);
assert.match(compact.output, /suggestions/);
assert.ok(!JSON.stringify(compact).includes("Katere rezultate mora ponudnik"), "Compact index ne sme vsebovati polnih vprašanj.");

const samples = [];
const iterations = 10000;
const actions = capabilities.actions.map((item) => item.code);
for (let index = 0; index < iterations; index += 1) {
  const profile = capabilities.profiles[index % capabilities.profiles.length];
  const started = performance.now();
  const plan = knowledge.resolve(profile.profileId, actions[index % actions.length]);
  knowledge.missingFacts(plan, {});
  samples.push(performance.now() - started);
}
samples.sort((a, b) => a - b);
const percentile = (value) => samples[Math.min(samples.length - 1, Math.floor(samples.length * value))];
const timings = {
  iterations,
  p50Ms:Number(percentile(0.50).toFixed(4)),
  p95Ms:Number(percentile(0.95).toFixed(4)),
  maxMs:Number(samples[samples.length - 1].toFixed(4))
};
assert.ok(timings.p95Ms < 5, `Lokalni resolver je prepočasen: p95=${timings.p95Ms} ms.`);

console.log(JSON.stringify({
  ok:true,
  version:knowledge.version,
  coverage:{ profiles:validation.metrics.profiles, families:validation.metrics.families, blocks:validation.metrics.blocks, facts:validation.metrics.facts },
  compact:{ characters:validation.metrics.compactCharacters, approximateTokens:validation.metrics.approximateTokens },
  timings
}, null, 2));
