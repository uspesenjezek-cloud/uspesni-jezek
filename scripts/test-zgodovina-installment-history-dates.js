"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var parser = require("../api/_lib/zgodovina-naravni-vnos");
var relativeDates = require("../app/neplacila-zgodovina-relativni-datumi");

function lunaResponse(plan) {
  return async function () {
    return {
      ok: true,
      status: 200,
      json: async function () { return { output_text: JSON.stringify({ p: plan, q: null, x: null }) }; },
    };
  };
}

function installmentPlan(source, dates, amount, intervalAmount, unitId, explicitStart, descriptions, cadenceEvidence) {
  return dates.map(function (date, index) {
    var relation = index === 0
      ? []
      : [601, 611, 622, 633, intervalAmount, unitId, null];
    return {
      n: index + 1,
      c: 3,
      e: source,
      f: [
        { i: 1, v: amount, e: source, r: [652] },
        { i: 2, v: explicitStart ? date : null, e: index === 0 ? source : cadenceEvidence, r: relation },
        { i: 8, v: descriptions && descriptions[index] || (index + 1) + "/" + dates.length + " obrok", e: source, r: [] },
      ],
    };
  });
}

async function analyzeWithLuna(source, context, plan) {
  return parser.analyze(source, context, {
    apiKey: "mock-luna-structured-installments",
    fetchImpl: lunaResponse(plan),
  });
}

async function main() {
  var source = "plačal je 8 obrokov vsak obrok je bil 1 teden dni razmaka in je bil v znesku 10 evrov";
  var context = { referenceDate: "2026-08-30", originalDebt: 434, remainingDebt: 434 };
  var expectedWeeklyDates = [
    "2026-07-05", "2026-07-12", "2026-07-19", "2026-07-26",
    "2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23",
  ];
  var contract = parser._test.buildFactContract(source);
  assert.deepEqual(contract.installmentGroups.map(function (group) { return [group.count, group.amount, group.completed]; }), [[8, 10, true]]);
  assert.deepEqual(contract.installmentCadences.map(function (cadence) { return [cadence.intervalAmount, cadence.unit]; }), [[1, "week"]]);

  [
    ["plačal je 4 obroke po 100, vsak 2 tedna narazen", 2, "week"],
    ["plačal je 4 obroke po 100, vsak 2tedna narazen", 2, "week"],
    ["plačal je 4 obroke po 100 na dva tedna", 2, "week"],
    ["plačal je 4 obroke po 100, vsakih 14 dni", 14, "day"],
  ].forEach(function (primer) {
    var cadence = parser._test.buildFactContract(primer[0]).installmentCadences[0];
    assert.deepEqual(cadence && [cadence.installmentCount, cadence.intervalAmount, cadence.unit], [4, primer[1], primer[2]], primer[0]);
  });

  var weekly = await analyzeWithLuna(source, context, installmentPlan(source, expectedWeeklyDates, 10, 1, 642, false, null, "1 teden dni razmaka"));
  assert.equal(weekly.semanticPlan.reason, "luna_compact_plan_applied");
  assert.deepEqual(weekly.candidates.map(function (candidate) { return candidate.occurredDate; }), Array(8).fill(null));
  assert.equal(weekly.candidates[0].dateRelation, null);
  assert.deepEqual(weekly.candidates.slice(1).map(function (candidate) {
    return [candidate.dateRelation.anchor, candidate.dateRelation.direction, candidate.dateRelation.amount, candidate.dateRelation.unit];
  }), Array.from({ length: 7 }, function () { return ["previous_event", 1, 1, "week"]; }));
  assert.ok(weekly.diagnostics.includes("luna-semantic-authority-v3"));
  assert.ok(!weekly.diagnostics.some(function (item) { return /explicit_installment_groups_rebuilt|historical_installment_cadence_applied/.test(item); }));

  var biweeklySource = "plačal je 4 obroke, vsak obrok je bil v dveh tednih razmaka in je znašal 25 EUR";
  var expectedBiweeklyDates = ["2026-07-05", "2026-07-19", "2026-08-02", "2026-08-16"];
  var biweekly = await analyzeWithLuna(biweeklySource, context, installmentPlan(biweeklySource, expectedBiweeklyDates, 25, 2, 642, false, null, "dveh tednih razmaka"));
  assert.equal(biweekly.semanticPlan.reason, "luna_compact_plan_applied");
  assert.deepEqual(biweekly.candidates.map(function (candidate) { return candidate.occurredDate; }), Array(4).fill(null));
  assert.equal(relativeDates.najpoznejsiDatumZaKandidata(biweekly.candidates, biweekly.candidates[0], context.referenceDate), "2026-07-19");

  var exactSource = "plačal je 4 obroke vsak obrok po 100 in vsak obrok 2tedna narazen";
  var hallucinatedDescriptions = ["100/4 obrok", "100/4 obrok", "100/4 obrok", "100/4 obrok"];
  var invalidOrdinal = await analyzeWithLuna(exactSource, context, installmentPlan(exactSource, expectedBiweeklyDates, 100, 2, 642, false, hallucinatedDescriptions, "2tedna narazen"));
  assert.equal(invalidOrdinal.semanticPlan.reason, "luna_compact_plan_applied");
  assert.deepEqual(invalidOrdinal.candidates.map(function (candidate) { return candidate.description; }), hallucinatedDescriptions,
    "lokalni adapter mora Lunine ordinale nespremenjene prepustiti človeškemu pregledu");
  assert.ok(invalidOrdinal.candidates.every(function (candidate) { return candidate.requiresHumanReview === true; }));
  var exact = await analyzeWithLuna(exactSource, context, installmentPlan(exactSource, expectedBiweeklyDates, 100, 2, 642, false, null, "2tedna narazen"));
  assert.equal(relativeDates.najpoznejsiDatumZaKandidata(exact.candidates, exact.candidates[0], context.referenceDate), "2026-07-19");

  var variableAmountSource = "plačal je 5 obrokov...vsak obrok je bil 2 tedna narazen prvi obrok je bil 130 vsi ostali so bili 300";
  var variableAmountPlan = [130, 300, 300, 300, 300].map(function (amount, index) {
    return {
      n: index + 1, c: 3, e: variableAmountSource,
      f: [
        { i: 1, v: amount, e: String(amount), r: [652] },
        { i: 2, v: null, e: index === 0 ? variableAmountSource : "2 tedna narazen", r: index === 0 ? [] : [601, 611, 622, 633, 2, 642, null] },
        { i: 8, v: (index + 1) + "/5 obrok", e: variableAmountSource, r: [] },
      ],
    };
  });
  var variableAmount = await analyzeWithLuna(variableAmountSource, { referenceDate: "2026-08-30", originalDebt: 3232, remainingDebt: 3232 }, variableAmountPlan);
  assert.deepEqual(variableAmount.candidates.map(function (candidate) { return candidate.occurredDate; }), Array(5).fill(null));
  assert.equal(variableAmount.candidates[0].dateRelation, null);
  assert.deepEqual(variableAmount.candidates.slice(1).map(function (candidate) {
    return [candidate.dateRelation.anchor, candidate.dateRelation.direction, candidate.dateRelation.amount, candidate.dateRelation.unit];
  }), Array.from({ length: 4 }, function () { return ["previous_event", 1, 2, "week"]; }));
  assert.equal(relativeDates.najpoznejsiDatumZaKandidata(variableAmount.candidates, variableAmount.candidates[0], "2026-08-30"), "2026-07-05",
    "neenaki zneski in ločilo med številom ter kadenco ne smejo odstraniti (N−1)×K meje");

  var refusalAfterInstallmentsSource = "plačal je 4 obroke..vsak obrok je bil 2 tedna narazen in vsak obrok je bil 100... danes je pa rekel da ne bo več plačeval";
  var refusalAfterInstallmentsPlan = [0, 1, 2, 3].map(function (index) {
    return {
      n: index + 1, c: 3, e: refusalAfterInstallmentsSource,
      f: [
        { i: 1, v: 100, e: "100", r: [652] },
        { i: 2, v: null, e: index === 0 ? refusalAfterInstallmentsSource : "2 tedna narazen", r: index === 0 ? [] : [601, 611, 622, 633, 2, 642, null] },
        { i: 8, v: (index + 1) + "/4 obrok", e: refusalAfterInstallmentsSource, r: [] },
      ],
    };
  });
  refusalAfterInstallmentsPlan.push({
    n: 5, c: 16, e: "danes je pa rekel da ne bo več plačeval",
    f: [
      { i: 2, v: "2026-08-30", e: "danes", r: [601, 611, 621, 632, 0, 641, null] },
      { i: 8, v: "Ne bo več plačeval.", e: "rekel da ne bo več plačeval", r: [] },
    ],
  });
  var refusalAfterInstallments = await analyzeWithLuna(refusalAfterInstallmentsSource,
    { referenceDate: "2026-08-30", originalDebt: 12000, remainingDebt: 12000 }, refusalAfterInstallmentsPlan);
  assert.deepEqual(refusalAfterInstallments.candidates.map(function (candidate) { return candidate.type; }),
    ["installment_payment", "installment_payment", "installment_payment", "installment_payment", "debtor_statement"]);
  assert.equal(relativeDates.najpoznejsiDatumZaKandidata(
    refusalAfterInstallments.candidates, refusalAfterInstallments.candidates[0], "2026-08-30"), "2026-07-19",
  "datum poznejše zavrnitve ne sme odstraniti 3 × 2 tedna meje prvega obroka");

  var explicitSource = "plačal je 4 obroke po 25 EUR vsak teden, prvi 1. 7. 2026";
  var explicitDates = ["2026-07-01", "2026-07-08", "2026-07-15", "2026-07-22"];
  var explicit = await analyzeWithLuna(explicitSource, context, installmentPlan(explicitSource, explicitDates, 25, 1, 642, true, null, "vsak teden"));
  assert.deepEqual(explicit.candidates.map(function (candidate) { return candidate.occurredDate; }), explicitDates);
  assert.equal(explicit.candidates[0].dateRelation, null);

  var conflictPlan = installmentPlan(explicitSource, explicitDates, 25, 1, 642, true, null, "vsak teden");
  conflictPlan[3].f[1].v = "2026-08-30";
  var conflict = await analyzeWithLuna(explicitSource, context, conflictPlan);
  assert.equal(conflict.semanticPlan.reason, "luna_compact_plan_applied");
  assert.deepEqual(conflict.candidates.map(function (candidate) { return candidate.occurredDate; }), ["2026-07-01", "2026-07-08", "2026-07-15", "2026-08-30"],
    "Lunin končni datum se ne sme lokalno preračunati ali zavrniti");
  assert.ok(conflict.candidates.every(function (candidate) { return candidate.requiresHumanReview === true; }));

  var instructions = parser.requestBody(source, context, "test-user").instructions;
  assert.match(instructions, /only semantic authority/);
  assert.match(instructions, /Cadence alone never invents the first date/);
  assert.match(instructions, /Only with no endpoint may card 1 omit field 2/);
  assert.match(instructions, /referenceDate is only a human-input boundary/);
  assert.match(instructions, /r=\[601,611,622,633,K,unitId,null\]/);
  assert.match(instructions, /two weeks=2\/week, 14 days=14\/day/);
  assert.match(instructions, /Explicit cadence is material: every card 2\.\.N MUST include field 2 with previous_event \+K relation/);
  assert.match(instructions, /number all cards 1\/\(N\+1\) through \(N\+1\)\/\(N\+1\)/);

  var manuallyAnchored = biweekly.candidates.map(function (candidate) {
    return JSON.parse(JSON.stringify(candidate));
  });
  manuallyAnchored[0].occurredDate = "2026-05-10";
  relativeDates.oznaciRocniPopravek(manuallyAnchored[0], "occurredDate");
  relativeDates.razresiDatume(manuallyAnchored);
  assert.deepEqual(manuallyAnchored.map(function (candidate) { return candidate.occurredDate; }), [
    "2026-05-10", "2026-05-24", "2026-06-07", "2026-06-21",
  ]);

  var fiveBiweekly = Array.from({ length: 5 }, function (_, index) {
    return {
      type: "installment_payment", candidateId: "five-" + index, occurredDate: null, description: (index + 1) + "/5 obrok",
      dateRelation: index === 0 ? null : { anchor: "previous_event", field: "occurredDate", direction: 1, amount: 2, unit: "week", anchorCandidateId: "five-" + (index - 1) },
    };
  });
  assert.equal(relativeDates.najpoznejsiDatumZaKandidata(fiveBiweekly, fiveBiweekly[0], context.referenceDate), "2026-07-05", "5 obrokov × 2 tedna mora omejiti prvi datum za štiri razmake oziroma 56 dni");
  assert.equal(relativeDates.najpoznejsiDatumZaKandidata(fiveBiweekly, fiveBiweekly[4], context.referenceDate), "2026-08-30", "zadnji obrok sme biti na referenčni dan");

  var staleDescriptions = fiveBiweekly.map(function (candidate) { return Object.assign({}, candidate, { description: "100/5 obrok" }); });
  assert.equal(relativeDates.najpoznejsiDatumZaKandidata(staleDescriptions, staleDescriptions[0], context.referenceDate), "2026-07-05", "časovna meja ne sme biti odvisna od Luninega description");

  var exactWeeklyFive = Array.from({ length: 5 }, function (_, index) {
    return {
      type: "installment_payment", candidateId: "exact-weekly-" + index, occurredDate: null, description: (index + 1) + "/5 obrok",
      dateRelation: index === 0 ? null : { anchor: "previous_event", field: "occurredDate", direction: 1, amount: 1, unit: "week", anchorCandidateId: "exact-weekly-" + (index - 1) },
    };
  });
  assert.deepEqual(exactWeeklyFive.map(function (candidate) {
    return relativeDates.najpoznejsiDatumZaKandidata(exactWeeklyFive, candidate, context.referenceDate);
  }), ["2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23", "2026-08-30"], "5 tedenskih obrokov ima natanko štiri razmake");
  assert.ok("2026-07-30" <= relativeDates.najpoznejsiDatumZaKandidata(exactWeeklyFive, exactWeeklyFive[0], context.referenceDate),
    "uporabnikov prvi datum 2026-07-30 mora biti dovoljen");

  var clientSource = fs.readFileSync(path.join(__dirname, "../app/neplacila-zgodovina.js"), "utf8");
  var embeddedHost = fs.readFileSync(path.join(__dirname, "../app/izvedba.html"), "utf8");
  var standaloneHost = fs.readFileSync(path.join(__dirname, "../app/neplacila-zgodovina.html"), "utf8");
  assert.doesNotMatch(clientSource, /lokalniDatumPlacila|dopolniLokalniDatumPlacila/);
  assert.match(clientSource, /dopolniRelativneDatume\(naravni\.candidates\)/);
  assert.match(clientSource, /data-ai-picker-preview/);
  [embeddedHost, standaloneHost].forEach(function (host) {
    assert.match(host, /neplacila-zgodovina-relativni-datumi\.js\?v=20260830-installment-picker-boundary-v5/,
      "vsak Atena gostitelj mora naložiti svež skupni (N−1)×K datumski resolver");
    assert.match(host, /neplacila-zgodovina\.js\?v=[^"\n]*history-v99-debt-warning-v2-agreement-v5[^"\n]*installment-picker-boundary-v5/,
      "vsak Atena gostitelj mora naložiti isti history/agreement contract in datumsko mejo");
  });

  console.log("Installment history date tests passed: no invented anchor, (N−1)×K picker boundary, derived cadence chain.");
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});
