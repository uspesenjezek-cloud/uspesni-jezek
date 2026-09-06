"use strict";

var assert = require("node:assert/strict");
var relativeDates = require("../app/neplacila-zgodovina-relativni-datumi");

var URL = "http://localhost:8001/api/razcleni-zgodovino";
var REFERENCE_DATE = "2026-08-30";
var cases = [
  { text: "plačal je 4 obroke vsak obrok po 100 in vsak obrok 2tedna narazen", amount: 2, unit: "week" },
  { text: "plačal je 4 obroke po 100, vsak 2 tedna narazen", amount: 2, unit: "week" },
  { text: "plačal je 4 obroke po 100 na dva tedna", amount: 2, unit: "week" },
  { text: "plačal je 4 obroke po 100, vsakih 14 dni", amount: 14, unit: "day" },
  { text: "plačal je 4 obroke..vsak obrok je bil 2 tedna narazen in vska obrok je bil 100... danes je pa rekel da ne bo več plačeval", amount: 2, unit: "week", extraType: "debtor_statement" },
  {
    text: "plačal je 40 prvi obrok in nato 4obroke vsak teden dni narazen v vrednosti 10 prvi obrok je plačal mesec dn nazaj",
    count: 5,
    amounts: [40, 10, 10, 10, 10],
    dates: ["2026-07-30", "2026-08-06", "2026-08-13", "2026-08-20", "2026-08-27"],
    total: 80,
    amount: 1,
    unit: "week",
  },
];

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function main() {
  var durations = [];
  var failures = [];
  for (var index = 0; index < cases.length; index += 1) {
    var started = Date.now();
    var response = await fetch(URL, {
      method: "POST",
      headers: { Authorization: "Bearer local-preview", "X-UJ-Local-Preview": "1", "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "installment-live-" + Date.now() + "-" + index,
        text: cases[index].text, referenceDate: REFERENCE_DATE, originalDebt: 9446, remainingDebt: 9446,
      }),
    });
    var payload = await response.json();
    durations.push(Date.now() - started);
    try {
      assert.equal(response.ok, true, JSON.stringify(payload));
      assert.equal(payload.contractVersion, "history-fact-v99");
      var installments = payload.candidates.filter(function (candidate) { return candidate.type === "installment_payment"; });
      var count = cases[index].count || 4;
      assert.deepEqual(installments.map(function (candidate) { return candidate.description; }), Array.from({ length: count }, function (_, cardIndex) { return (cardIndex + 1) + "/" + count + " obrok"; }));
      assert.deepEqual(installments.map(function (candidate) { return candidate.amount; }), cases[index].amounts || Array.from({ length: count }, function () { return 100; }));
      assert.deepEqual(installments.map(function (candidate) { return candidate.occurredDate; }), cases[index].dates || Array.from({ length: count }, function () { return null; }));
      assert.deepEqual(installments.slice(1).map(function (candidate) { return [candidate.dateRelation.direction, candidate.dateRelation.amount, candidate.dateRelation.unit]; }), Array.from({ length: count - 1 }, function () { return [1, cases[index].amount, cases[index].unit]; }));
      if (cases[index].extraType) assert.ok(payload.candidates.some(function (candidate) { return candidate.type === cases[index].extraType; }));
      if (cases[index].dates) {
        assert.equal(installments.reduce(function (sum, candidate) { return sum + candidate.amount; }, 0), cases[index].total);
      } else {
        assert.equal(relativeDates.najpoznejsiDatumZaKandidata(payload.candidates, installments[0], REFERENCE_DATE), "2026-07-19");
      }
    } catch (error) {
      failures.push({ text: cases[index].text, error: error.message });
    }
  }
  console.log("Live Luna installment family: " + (cases.length - failures.length) + "/" + cases.length +
    "; p50 " + percentile(durations, 0.5) + " ms, p95 " + percentile(durations, 0.95) + " ms, max " + Math.max.apply(null, durations) + " ms, failed " + failures.length + ".");
  if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exit(1); }
}

main().catch(function (error) { console.error(error); process.exit(1); });
