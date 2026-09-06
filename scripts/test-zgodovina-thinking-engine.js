"use strict";

var assert = require("node:assert/strict");
var engine = require("../api/_lib/zgodovina-thinking-engine");
var relativeDates = require("../app/neplacila-zgodovina-relativni-datumi");

var checks = 0;
function equal(actual, expected, message) { checks += 1; assert.equal(actual, expected, message); }
function deepEqual(actual, expected, message) { checks += 1; assert.deepEqual(actual, expected, message); }
function ok(value, message) { checks += 1; assert.ok(value, message); }

function completeEvent(type, amount) {
  var event = {
    type: type,
    amount: amount == null ? 100 : amount,
    occurredDate: "2026-08-26",
    promisedDate: "2026-08-30",
    paymentMethod: "bank_transfer",
    communicationChannel: "phone",
    reason: "Račun je bil izrecno storniran.",
    description: "Preverjeno dejstvo.",
    confidence: "high",
  };
  return event;
}

var types = Object.keys(engine.EVENT_RULES);
equal(types.length, 17, "vsak podprt tip mora imeti pravilo");
equal(Object.keys(engine.FATHER_CATEGORIES).length, 13, "register mora imeti natanko 13 FATHER kategorij");
deepEqual(engine.EVENT_TO_FATHERS.remaining_unpaid, ["unpaid_installment", "collection_outcome"], "remaining_unpaid sme pripadati običajnemu preostanku ali izidu izterjave");

types.forEach(function (type) {
  var rule = engine.EVENT_RULES[type];
  var amount = type === "paid_in_full" ? 1000 : 100;
  var result = engine.finalizeCandidates([completeEvent(type, amount)], { remainingDebt: 1000 });
  var candidate = result.candidates[0];
  equal(candidate.type, type, type + ": tip se mora ohraniti");
  equal(candidate.fatherCategory, engine.EVENT_TO_FATHER[type] || "custom", type + ": dogodek mora poznati svojo FATHER kategorijo");
  deepEqual(candidate.fieldOrder, rule.fieldOrder, type + ": vrstni red prihaja iz pogodbe");
  deepEqual(candidate.requiredFields, rule.requiredFields, type + ": zahtevana polja prihajajo iz pogodbe");
  deepEqual(candidate.missing, [], type + ": popoln dogodek nima vprašanj");
  equal(result.questionPlan.length, 0, type + ": popoln dogodek nima plana vprašanj");
  equal(candidate.ledger.beforeEur, 1000, type + ": ledger začne pri trenutnem dolgu");
  equal(candidate.ledger.afterEur, rule.balanceEffect === "subtract" ? 1000 - amount : 1000, type + ": balanceEffect je avtoritativen");

  var empty = engine.finalizeCandidates([{ type: type }], { remainingDebt: 1000 });
  deepEqual(empty.candidates[0].missing, rule.requiredFields, type + ": manjkajo natanko zahtevana polja");
  equal(empty.questionPlan.length, 1, type + ": nepopoln dogodek ima en vprašalni korak");
  deepEqual(empty.questionPlan[0].fields, rule.fieldOrder, type + ": vprašalni korak sledi fieldOrder");
  deepEqual(empty.questionPlan[0].missing, rule.requiredFields, type + ": plan izpostavi manjkajoča polja");
});

[null, 0, -1, -100].forEach(function (amount) {
  var result = engine.finalizeCandidates([{ type: "partial_payment", amount: amount }], { remainingDebt: 500 });
  equal(result.projectedRemainingDebtEur, 500, "ničeln, negativen ali prazen znesek ne spremeni dolga");
  ok(result.candidates[0].missing.includes("amount"), "neveljaven znesek ostane vprašanje");
});

for (var amount = 1; amount <= 40; amount += 1) {
  var matrix = engine.finalizeCandidates([completeEvent("partial_payment", amount)], { remainingDebt: 100 });
  equal(matrix.projectedRemainingDebtEur, 100 - amount, "generirana matrika odštevanja " + amount);
  equal(matrix.candidates[0].ledger.effectEur, -amount, "ledger učinek " + amount);
}

var exact = engine.finalizeCandidates([completeEvent("paid_in_full", 500)], { remainingDebt: 500 });
equal(exact.projectedRemainingDebtEur, 0, "točno celotno plačilo zapre dolg");
deepEqual(exact.candidates[0].missing, [], "točno celotno plačilo je veljavno");

var falseFull = engine.finalizeCandidates([completeEvent("paid_in_full", 400)], { remainingDebt: 500 });
equal(falseFull.projectedRemainingDebtEur, 500, "paid_in_full z delnim zneskom ne sme zmanjšati dolga");
equal(falseFull.candidates[0].amount, null, "napačen celotni znesek se zavrne");
ok(falseFull.candidates[0].missing.includes("amount"), "napačen celotni znesek zahteva popravek");

var over = engine.finalizeCandidates([completeEvent("partial_payment", 501)], { remainingDebt: 500 });
equal(over.projectedRemainingDebtEur, 500, "znesek nad dolgom se ne odšteje");
equal(over.candidates[0].amount, null, "znesek nad dolgom se zavrne");

var explicitOver = engine.finalizeCandidates([Object.assign(completeEvent("installment_payment", 6000), {
  evidence: { explicit: true, sourceSpan: { start: 42, end: 46, text: "6000" }, clauseId: "clause-3" },
})], { remainingDebt: 5246 });
equal(explicitOver.candidates[0].amount, 6000, "izrecno dokazani znesek nad saldom mora ostati v kandidatu");
equal(explicitOver.candidates[0].evidence.explicitAmountEur, 6000, "UI mora dobiti nespremenljiv dokaz izvornega presežnega zneska");
equal(explicitOver.projectedRemainingDebtEur, 0, "izrecni overpayment mora ledger varno clampati na nič");
ok(explicitOver.diagnostics.includes("explicit_amount_exceeds_balance_clamped:0"), "clamp izrecnega overpaymenta mora biti diagnosticiran");

var reductions = engine.finalizeCandidates([
  completeEvent("partial_payment", 100),
  completeEvent("credit_note", 50),
  completeEvent("compensation", 25),
  completeEvent("remaining_unpaid", 325),
  completeEvent("unpaid_installment", 325),
], { remainingDebt: 500 });
equal(reductions.projectedRemainingDebtEur, 325, "več zmanjšanj se odšteje samo enkrat");
deepEqual(reductions.ledger.map(function (row) { return row.afterEur; }), [400, 350, 325, 325, 325], "neplačani dogodki ne spreminjajo ledgerja");

var installment = engine.reconcileProposals([{ type: "credit_note", amount: 3000 }], {
  installmentBreakdown: { repeat: 3, amount: 1000 },
});
var installments = engine.expandEvents(installment.events);
deepEqual(installments.map(function (event) { return event.type; }), ["installment_payment", "installment_payment", "installment_payment"], "struktura obrokov premaga hallucinated dobropis");
deepEqual(installments.map(function (event) { return event.amount; }), [1000, 1000, 1000], "vsak obrok dobi posamezni znesek");
installments[0].amount = 999;
equal(installments[1].amount, 1000, "razširjeni dogodki ne smejo deliti istega objekta");

var explicitCredit = engine.reconcileProposals([{ type: "partial_payment", amount: 3000 }], {
  installmentBreakdown: { repeat: 3, amount: 1000 }, creditNoteMentioned: true, creditNoteAmountEur: 1000,
});
deepEqual(engine.expandEvents(explicitCredit.events).map(function (event) { return [event.type, event.amount]; }), [
  ["installment_payment", 1000], ["installment_payment", 1000], ["installment_payment", 1000], ["credit_note", 1000],
], "izrecni dobropis mora ostati ločen od strukture obrokov");

var repairedSettlementAmounts = engine.reconcileProposals([
  { type: "credit_note", amount: null },
  { type: "compensation", amount: 25 },
], {
  creditNoteMentioned: true, creditNoteAmountEur: 1000,
  compensationMentioned: true, compensationAmountEur: 250,
});
deepEqual(repairedSettlementAmounts.events.map(function (event) { return [event.type, event.amount]; }), [
  ["credit_note", 1000], ["compensation", 250],
], "izrecni FATHER znesek mora popraviti prazen ali napačen modelski predlog");
ok(repairedSettlementAmounts.diagnostics.includes("explicit_credit_note_amount_wins"), "popravek praznega dobropisa mora biti diagnosticiran");
ok(repairedSettlementAmounts.diagnostics.includes("explicit_compensation_amount_wins"), "popravek napačne kompenzacije mora biti diagnosticiran");

var aggregateInstallments = engine.reconcileProposals([{ type: "partial_payment", amount: 4000 }], {
  installmentBreakdown: { repeat: 3, amount: null, amounts: [1333.33, 1333.33, 1333.34], total: 4000 },
  creditNoteMentioned: true, creditNoteAmountEur: 1000,
});
deepEqual(aggregateInstallments.events.map(function (event) { return [event.type, event.amount]; }), [
  ["installment_payment", 1333.33], ["installment_payment", 1333.33], ["installment_payment", 1333.34], ["credit_note", 1000],
], "skupna vsota obrokov mora popraviti modelsko delno plačilo in ohraniti centno vsoto");
equal(aggregateInstallments.events.slice(0, 3).reduce(function (sum, event) { return sum + event.amount; }, 0), 4000, "razdeljeni obroki morajo skupaj ostati točna navedena vsota");

var failed = engine.reconcileProposals([{ type: "debtor_statement", amount: 100 }], { paymentFailed: true });
equal(failed.events[0].type, "payment_failed", "bančna zavrnitev ni izjava dolžnika");
equal(failed.events[0].amount, null, "neuspešno plačilo ne zmanjšuje dolga");

var refusal = engine.reconcileProposals([{ type: "cancelled_invoice", reason: "ne bo plačal" }], { debtorRefused: true, explicitCancellation: false });
equal(refusal.events[0].type, "debtor_statement", "zavrnitev dolžnika ni storno");

var cancellation = engine.reconcileProposals([{ type: "debtor_statement" }], { debtorRefused: true, explicitCancellation: true });
equal(cancellation.events[0].type, "cancelled_invoice", "izrecen storno premaga splošno izjavo");

var dispute = engine.reconcileProposals([{ type: "debtor_statement" }], { invoiceDispute: true });
equal(dispute.events[0].type, "invoice_dispute", "ugovor računa dobi namenski tip");

var remainder = engine.reconcileProposals([{ type: "paid_in_full", amount: 900 }], { paidInFull: true, inferredRemainingAmountEur: 100 });
equal(remainder.events[0].type, "partial_payment", "pozitiven preostanek blokira paid_in_full");

var unknown = engine.finalizeCandidates([{ type: "invented_model_type", occurredDate: "2026-08-26", description: "Model si je izmislil tip." }], { remainingDebt: 500 });
equal(unknown.candidates[0].type, "custom", "neznan modelski tip se varno skrči v custom");
deepEqual(unknown.candidates[0].requiredFields, engine.EVENT_RULES.custom.requiredFields, "neznan tip ne more izumiti zahtev");

var unknownDate = engine.finalizeCandidates([{ type: "unpaid_installment", occurredDateUnknown: true }], { remainingDebt: 500 });
deepEqual(unknownDate.candidates[0].missing, [], "izrecno neznan datum je veljaven odgovor");

equal(relativeDates.premakniDatum("2026-01-31", { direction: 1, amount: 1, unit: "month" }), "2026-02-28", "mesec mora clampati konec meseca");
equal(relativeDates.premakniDatum("2024-02-29", { direction: 1, amount: 1, unit: "year" }), "2025-02-28", "leto mora clampati prestopni dan");
equal(relativeDates.premakniDatum("2026-03-31", { direction: -1, amount: 1, unit: "month" }), "2026-02-28", "odštevanje meseca mora clampati konec meseca");
equal(relativeDates.premakniDatum("2026-01-31", { direction: 1, amount: 2, unit: "month" }), "2026-03-31", "dva koledarska meseca ohranita dan, kadar obstaja");
equal(relativeDates.premakniDatum("2026-03-10", { direction: -1, amount: 2, unit: "week" }), "2026-02-24", "tedni se odštevajo po sedem dni");

var chainedDates = [
  { candidateId: "candidate-1", occurredDate: "2026-01-31" },
  { candidateId: "candidate-2", occurredDate: null, dateRelation: { anchor: "previous_event", anchorCandidateId: "candidate-1", field: "occurredDate", direction: 1, amount: 2, unit: "month" } },
  { candidateId: "candidate-3", occurredDate: null, dateRelation: { anchor: "previous_event", anchorCandidateId: "candidate-2", field: "occurredDate", direction: 1, amount: 10, unit: "day" } },
];
relativeDates.razresiDatume(chainedDates);
deepEqual(chainedDates.map(function (candidate) { return candidate.occurredDate; }), ["2026-01-31", "2026-03-31", "2026-04-10"], "relacije se morajo verižno razrešiti");

var exactSequentialDates = [
  { candidateId: "candidate-1", occurredDate: "2026-08-04" },
  { candidateId: "candidate-2", occurredDate: null, dateRelation: { anchor: "previous_event", anchorCandidateId: "candidate-1", field: "occurredDate", direction: 1, amount: 1, unit: "month" } },
  { candidateId: "candidate-3", occurredDate: null, dateRelation: { anchor: "previous_event", anchorCandidateId: "candidate-2", field: "occurredDate", direction: 1, amount: 2, unit: "week" } },
];
relativeDates.razresiDatume(exactSequentialDates);
deepEqual(exactSequentialDates.map(function (candidate) { return candidate.occurredDate; }), ["2026-08-04", "2026-09-04", "2026-09-18"], "exact eliptična veriga mora izračunati oba naslednja datuma");
chainedDates[0].occurredDate = "2026-02-28";
relativeDates.razresiDatume(chainedDates);
deepEqual(chainedDates.map(function (candidate) { return candidate.occurredDate; }), ["2026-02-28", "2026-04-28", "2026-05-08"], "sprememba sidra mora osvežiti vso verigo");
relativeDates.oznaciRocniPopravek(chainedDates[1], "occurredDate");
chainedDates[1].occurredDate = "2026-06-15";
chainedDates[0].occurredDate = "2026-03-31";
relativeDates.razresiDatume(chainedDates);
deepEqual(chainedDates.map(function (candidate) { return candidate.occurredDate; }), ["2026-03-31", "2026-06-15", "2026-06-25"], "ročni popravek se ne prepiše in postane sidro naslednji relaciji");
chainedDates[0].occurredDate = null;
relativeDates.razresiDatume(chainedDates);
equal(chainedDates[1].occurredDate, "2026-06-15", "brisanje sidra ne sme izbrisati ročnega popravka");

var autoClear = [
  { candidateId: "anchor", occurredDate: "2026-01-01" },
  { candidateId: "derived", occurredDate: null, dateRelation: { anchor: "previous_event", anchorCandidateId: "anchor", field: "occurredDate", direction: 1, amount: 1, unit: "day" } },
];
relativeDates.razresiDatume(autoClear);
autoClear[0].occurredDate = null;
relativeDates.razresiDatume(autoClear);
equal(autoClear[1].occurredDate, null, "brisanje sidra mora izbrisati samo avtomatsko izpeljan datum");

var cadenceMonthEnd = [
  { candidateId: "installment-1", occurredDate: "2026-01-31" },
  { candidateId: "installment-2", occurredDate: null, dateRelation: { anchor: "previous_event", anchorCandidateId: "installment-1", field: "occurredDate", direction: 1, amount: 1, unit: "month" } },
  { candidateId: "installment-3", occurredDate: null, dateRelation: { anchor: "previous_event", anchorCandidateId: "installment-2", field: "occurredDate", direction: 1, amount: 1, unit: "month" } },
];
relativeDates.razresiDatume(cadenceMonthEnd);
deepEqual(cadenceMonthEnd.map(function (candidate) { return candidate.occurredDate; }), ["2026-01-31", "2026-02-28", "2026-03-28"], "mesečni cadence mora uporabiti verižni calendar clamp");
cadenceMonthEnd[0].occurredDate = "2026-02-28";
relativeDates.razresiDatume(cadenceMonthEnd);
deepEqual(cadenceMonthEnd.map(function (candidate) { return candidate.occurredDate; }), ["2026-02-28", "2026-03-28", "2026-04-28"], "sprememba prvega obroka mora ponovno izračunati avtomatsko verigo");
relativeDates.oznaciRocniPopravek(cadenceMonthEnd[1], "occurredDate");
cadenceMonthEnd[1].occurredDate = "2026-04-30";
relativeDates.razresiDatume(cadenceMonthEnd);
deepEqual(cadenceMonthEnd.map(function (candidate) { return candidate.occurredDate; }), ["2026-02-28", "2026-04-30", "2026-05-30"], "ročni drugi obrok mora ostati in postati sidro tretjega");

var weeklyInstallmentsAfterManualAnchor = Array.from({ length: 8 }, function (_item, index) {
  return index === 0
    ? { candidateId: "weekly-installment-1", occurredDate: null }
    : {
      candidateId: "weekly-installment-" + (index + 1),
      occurredDate: null,
      dateRelation: {
        anchor: "previous_event",
        anchorCandidateId: "weekly-installment-" + index,
        field: "occurredDate",
        direction: 1,
        amount: 1,
        unit: "week",
      },
    };
});
weeklyInstallmentsAfterManualAnchor[0].occurredDate = "2026-07-05";
relativeDates.razresiDatume(weeklyInstallmentsAfterManualAnchor);
deepEqual(weeklyInstallmentsAfterManualAnchor.map(function (candidate) { return candidate.occurredDate; }), [
  "2026-07-05", "2026-07-12", "2026-07-19", "2026-07-26",
  "2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23",
], "ročni datum prvega od osmih obrokov mora izpolniti vso tedensko verigo");

var cadenceAutoClear = [
  { candidateId: "installment-anchor", occurredDate: "2026-01-31" },
  { candidateId: "installment-derived-2", occurredDate: null, dateRelation: { anchor: "previous_event", anchorCandidateId: "installment-anchor", field: "occurredDate", direction: 1, amount: 1, unit: "month" } },
  { candidateId: "installment-derived-3", occurredDate: null, dateRelation: { anchor: "previous_event", anchorCandidateId: "installment-derived-2", field: "occurredDate", direction: 1, amount: 1, unit: "month" } },
];
relativeDates.razresiDatume(cadenceAutoClear);
cadenceAutoClear[0].occurredDate = null;
relativeDates.razresiDatume(cadenceAutoClear);
deepEqual(cadenceAutoClear.map(function (candidate) { return candidate.occurredDate; }), [null, null, null], "brisanje prvega obroka mora pobrisati samo avtomatsko izpeljana datuma");

ok(checks >= 150, "testna matrika mora imeti vsaj 150 preveritev, ima jih " + checks);
console.log("✓ thinking engine: " + checks + " preveritev, 17 tipov, konflikti in ledger");
