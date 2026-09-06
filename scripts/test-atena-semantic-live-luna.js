"use strict";

var assert = require("node:assert/strict");

var BASE = "http://localhost:8001/api/";
var CASES = [
  { flow: "goal", endpoint: "razcleni-cilj", text: "sprejmem haircut 100 evrov, če nato poravna vse", expected: "amicable_settlement" },
  { flow: "goal", endpoint: "razcleni-cilj", text: "naj za dolg zagotovi Bürgschaft", expected: "payment_security" },
  { flow: "goal", endpoint: "razcleni-cilj", text: "dajmo dolg v Aufrechnung z njegovo nasprotno terjatvijo", expected: "compensation" },
  { flow: "goal", endpoint: "razcleni-cilj", text: "hočem, da ga odvetnik pokliče glede plačila", expected: "legal_recovery" },
  { flow: "agreement", endpoint: "razcleni-dogovor", text: "pristal je na Ratenvereinbarung po 100 evrov mesečno", expected: "installment_agreement" },
  { flow: "agreement", endpoint: "razcleni-dogovor", text: "prosil je za Stundung do 1. oktobra 2026", expected: "deadline_extension" },
  { flow: "history", endpoint: "razcleni-zgodovino", text: "včeraj je bil Rücklastschrift za 100 evrov", expected: "payment_failed" },
  { flow: "history", endpoint: "razcleni-zgodovino", text: "včeraj smo izdali Gutschrift za 50 evrov", expected: "credit_note" },
  { flow: "history", endpoint: "razcleni-zgodovino", text: "včeraj smo mu po e-pošti poslali Mahnung", expected: "reminder_sent" },
];

function percentile(values, ratio) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function main() {
  var durations = [];
  for (var index = 0; index < CASES.length; index += 1) {
    var item = CASES[index];
    var started = Date.now();
    var response = await fetch(BASE + item.endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer local-preview", "X-UJ-Local-Preview": "1", "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "semantic-live-" + Date.now() + "-" + index,
        text: item.text,
        referenceDate: "2026-08-30",
        originalDebt: 434,
        remainingDebt: 434,
      }),
    });
    var payload = await response.json();
    durations.push(Date.now() - started);
    assert.equal(response.ok, true, item.text + ": " + JSON.stringify(payload));
    var actual = item.flow === "goal"
      ? payload.goals && payload.goals[0] && payload.goals[0].goalId
      : payload.candidates && payload.candidates[0] && payload.candidates[0].type;
    assert.equal(actual, item.expected, item.text);
  }
  console.log("Live Luna semantic lexicon: " + CASES.length + "/" + CASES.length +
    "; p50 " + percentile(durations, 0.5) + " ms, p95 " + percentile(durations, 0.95) +
    " ms, max " + Math.max.apply(null, durations) + " ms.");
}

main().catch(function (error) { console.error(error); process.exit(1); });
