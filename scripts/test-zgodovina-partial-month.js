"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var history = require("../api/_lib/zgodovina-naravni-vnos");
var relativeDates = require("../app/neplacila-zgodovina-relativni-datumi");

function item(eventNumber, relation, precision, status, evidence) {
  return {
    eventType: "installment_payment",
    amountEur: 10,
    amountEvidenceText: "10",
    occurredDate: null,
    occurredDateEvidenceText: evidence,
    occurredDateRelation: relation,
    occurredDatePrecision: precision,
    occurredDateStatus: status,
    occurredDateApproximate: status === "approximate",
    evidenceText: eventNumber === 1 ? "10 prejšnji mesec" : "2 obrok mislim da je bil teden dni po prvem",
    description: eventNumber + "/2 obrok",
    providedFieldIds: [1, 2, 8],
  };
}

var source = "plačal mi je 2 obroka vsak obrok po 10 prejšnji mesec 2 obrok mislim da je bil teden dni po prvem";
var firstRelation = { anchor: "reference_date", direction: -1, amount: 1, unit: "month", dayOfMonth: null };
var secondRelation = { anchor: "previous_event", direction: 1, amount: 1, unit: "week", dayOfMonth: null };
var result = history._test.materializeLunaFieldPlan({ items: [
  item(1, firstRelation, "month", "exact", "prejšnji mesec"),
  item(2, secondRelation, "exact", "exact", "teden dni po prvem"),
] }, { referenceDate: "2026-09-01", originalDebt: 220, remainingDebt: 220 }, source, null);

assert.equal(result.ok, true);
assert.equal(result.result.candidates[0].occurredDate, null);
assert.equal(result.result.candidates[0].occurredDateKnownYearMonth, "2026-08");
assert.equal(result.result.candidates[0].occurredDatePrecision, "month");
assert.equal(result.result.candidates[0].occurredDateApproximate, false);
assert.deepEqual(result.result.candidates[0].missing.includes("occurredDate"), true);
assert.equal(result.result.candidates[1].occurredDate, null);
assert.equal(result.result.candidates[1].dateRelation.anchor, "previous_event");

result.result.candidates[0].occurredDate = "2026-08-24";
relativeDates.oznaciRocniPopravek(result.result.candidates[0], "occurredDate");
relativeDates.razresiDatume(result.result.candidates);
assert.equal(result.result.candidates[1].occurredDate, "2026-08-31", "odvisni obrok mora ostati +1 teden po izbranem dnevu");

var rollover = history._test.materializeLunaFieldPlan({ items: [
  item(1, firstRelation, "month", "exact", "prejšnji mesec"),
] }, { referenceDate: "2026-01-15", originalDebt: 220, remainingDebt: 220 }, "10 prejšnji mesec", null);
assert.equal(rollover.ok, true);
assert.equal(rollover.result.candidates[0].occurredDateKnownYearMonth, "2025-12", "januarski prehod mora ohraniti prejšnje leto");

var approximate = history._test.materializeLunaFieldPlan({ items: [
  item(1, firstRelation, "month", "approximate", "približno prejšnji mesec"),
] }, { referenceDate: "2026-09-01", originalDebt: 220, remainingDebt: 220 }, "10 približno prejšnji mesec", null);
assert.equal(approximate.ok, true);
assert.equal(approximate.result.candidates[0].occurredDateApproximate, true);
assert.equal(approximate.result.candidates[0].occurredDateKnownYearMonth == null, true, "izrecno približen datum ne sme postati točen delni datum");

function expectedPreviousMonth(referenceDate, amount) {
  var parts = referenceDate.split("-").map(Number);
  var shifted = new Date(Date.UTC(parts[0], parts[1] - 1 - amount, 1));
  return shifted.getUTCFullYear() + "-" + String(shifted.getUTCMonth() + 1).padStart(2, "0");
}

for (var repetition = 0; repetition < 3; repetition += 1) {
  for (var caseIndex = 0; caseIndex < 100; caseIndex += 1) {
    var year = 2021 + (caseIndex % 9);
    var month = 1 + ((caseIndex * 7 + repetition) % 12);
    var day = 1 + ((caseIndex * 11) % 28);
    var amount = 1 + ((caseIndex + repetition) % 4);
    var reference = year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
    var matrixRelation = { anchor: "reference_date", direction: -1, amount: amount, unit: "month", dayOfMonth: null };
    var matrixResult = history._test.materializeLunaFieldPlan({ items: [
      item(1, matrixRelation, "month", "exact", amount === 1 ? "prejšnji mesec" : amount + " mesece nazaj"),
    ] }, { referenceDate: reference, originalDebt: 220, remainingDebt: 220 }, "10 EUR " + amount + " mesece nazaj", null);
    assert.equal(matrixResult.ok, true, "matrika " + repetition + "/" + caseIndex + " mora biti veljavna");
    assert.equal(matrixResult.result.candidates[0].occurredDateKnownYearMonth, expectedPreviousMonth(reference, amount));
    assert.equal(matrixResult.result.candidates[0].occurredDate, null);
    assert.equal(matrixResult.result.candidates[0].occurredDateApproximate, false);
    assert.equal(matrixResult.result.candidates[0].missing.includes("occurredDate"), true);
  }
}

var page = fs.readFileSync(path.join(__dirname, "../app/neplacila-zgodovina.js"), "utf8");
var css = fs.readFileSync(path.join(__dirname, "../app/neplacila-zgodovina.css"), "utf8");
assert.match(page, /data-ai-partial-date-day/);
assert.match(page, /type="month" data-ai-partial-date-month/, "Lunin izbrani mesec mora ostati ročno popravljiv");
assert.match(page, /data-ai-partial-year-month/);
assert.match(page, /new Date\(Date\.UTC\(year, month, 0\)\)\.getUTCDate\(\)/, "UI mora poznati 28\/29\/30\/31 dni");
assert.match(page, /delniKandidat\.occurredDateKnownYearMonth = delniYearMonth/, "ročni popravek meseca se mora zapisati v kandidata");
assert.match(page, /delniYearMonth \+ "-" \+ String\(delniDan\)\.padStart\(2, "0"\)/);
assert.match(css, /\.zgodovina-ai-vprasanje__delni-datum/);

console.log("✓ delni relativni mesec: znani YYYY-MM, samo dan, rollover, odvisna kadenca in 3 × 100 koledarskih primerov");
