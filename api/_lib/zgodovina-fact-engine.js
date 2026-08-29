"use strict";

var installmentEngine = require("./zgodovina-installment-engine");
var numberEngine = require("./zgodovina-number-engine");
var temporalEngine = require("./zgodovina-temporal-engine");
var paymentSequenceEngine = require("./zgodovina-payment-sequence-engine");

var MAX_TEXT_LENGTH = 2000;
var FACT_CONTRACT_CACHE_LIMIT = 96;
var factContractCache = new Map();
var CLEAR_PAYMENT_STOP_PATTERN = /(?<![\p{L}\d])(?:(?:in\s+)?(?:potem|nato|zatem|na\s+koncu)(?:\s+pa)?|od\s+takrat(?:\s+pa)?)\s+(?:nič(?:esar)?\s+več|ni\s+(?:plač\w*|poravn\w*|naka\w*)\s+nič(?:esar)?\s+več|ni\s+več\s+(?:plač\w*|poravn\w*|naka\w*))(?![\p{L}\d])/giu;
var UNFULFILLED_PROMISE_PATTERN = /(?<![\p{L}\d])(?:(?:ampak|vendar|toda|pa|potem|nato|zatem)(?:\s+pa)?\s+)?(?:ni\s+nič(?:esar)?\s+(?:naredil\w*|storil\w*|izpolnil\w*|uresničil\w*)|ni\s+(?:naredil\w*|storil\w*|izpolnil\w*|uresničil\w*)\s+nič(?:esar)?|nič(?:esar)?\s+ni\s+(?:naredil\w*|storil\w*|izpolnil\w*|uresničil\w*))(?![\p{L}\d])/giu;
var CONTACT_ENDED_PATTERN = /(?<![\p{L}\d])(?:(?:prekinil\w*|prenehal\w*)[^.!?;]{0,25}(?:stik|stlk|komunikacij\w*|odziv\w*)|ni\s+(?:več\s+)?odziv\w*|ne\s+odziv\w*|ne\s+javlj\w*|se\s+ne\s+javlj\w*|(?:se\s+)?ni\s+(?:več\s+)?(?:javil\w*|javljal\w*|oglasil\w*|dvignil\w*)|(?:nič(?:esar)?\s+)?ni\s+(?:(?:mi|nam)\s+)?(?:odgovoril\w*|odpisal\w*)|(?:se\s+)?ni\s+(?:več\s+)?odzval\w*|brez\s+odgovor\w*|odgovor\w*\s+ni\s+bilo|postal\w*\s+nedosegljiv\w*|ignorira\w*|ghostal\w*|skenslal\w*|blokiral\w*)(?![\p{L}\d])/giu;
var COLLECTION_NONPAYMENT_PATTERN = /(?<![\p{L}\d])(?:(?:ga|je|tega|opomina|poziva|zahtevka)\s+)?ni\s+(?:nič(?:esar)?\s+)?(?:plačal\w*|poravnal\w*|nakazal\w*)(?![\p{L}\d])/giu;
var PAYMENT_REFUSAL_PATTERN = /\b(?:ne\s+bo(?:do|jo)?(?:\s+(?:nič(?:esar)?|nobenega))?(?:\s+več)?\s+(?:plačal\w*|poravnal\w*|nakazal\w*)|ne\s+bo(?:do|jo)?\s+(?:plačal\w*|poravnal\w*|nakazal\w*)\s+(?:nič(?:esar)?\s+)?več|noče(?:\s+(?:nič(?:esar)?\s+)?več)?\s+(?:plačati|poravnati|nakazati)|ne\s+želi(?:\s+(?:nič(?:esar)?\s+)?več)?\s+(?:plačati|poravnati|nakazati))\b/giu;
var COLLECTION_ACTION_PATTERN = /(?<![\p{L}\d])(?:(?:(?:sem|smo|sva|je|so|sta)\s+)?(?:(?:mu|ji|jim|dolžnik\w*|strank\w*)\s+)?(?:poslal\w*|posredoval\w*|vročil\w*|izdal\w*|odposlal\w*)[^.!?;]{0,35}(?:plačiln\w*\s+)?(?:opomin\w*|poziv\w*(?:\s+za\s+plačil\w*)?|zahtev\w*\s+za\s+plačil\w*)|(?:plačiln\w*\s+)?(?:opomin\w*|poziv\w*(?:\s+za\s+plačil\w*)?|zahtev\w*\s+za\s+plačil\w*)[^.!?;]{0,35}(?:(?:sem|smo|sva|je|so|sta|bil\w*)\s+){0,4}(?:poslal\w*|poslan\w*|posredoval\w*|posredovan\w*|vročil\w*|vročen\w*|izdal\w*|izdan\w*|odposlal\w*|odposlan\w*))(?![\p{L}\d])/giu;
var PHONE_COLLECTION_ACTION_PATTERN = /(?<![\p{L}\d])(?:(?:(?:sem|smo|sva|je|so|sta)\s+)?(?:(?:ga|jo|jih|mu|ji|jim)\s+)?(?:po|preko)\s+telefon\w*[^.!?;]{0,45}(?:pozval\w*|zahteval\w*)[^.!?;]{0,30}(?:plač\w*|poravn\w*|vrn\w*\s+denar)|(?:(?:sem|smo|sva|je|so|sta)\s+)?(?:(?:ga|jo|jih|mu|ji|jim)\s+)?(?:poklical\w*|klical\w*|telefoniral\w*)[^.!?;]{0,45}(?:(?:naj|da)\s+)?(?:plač\w*|poravn\w*|vrn\w*\s+denar|poplač\w*\s+dolg\w*))(?![\p{L}\d])/giu;
var RETROSPECTIVE_COLLECTION_ACTION_PATTERN = /(?<![\p{L}\d])po\s+(?:(?:poslanem|vročenem|pisnem|plačilnem)\s+)?(?:opominu\w*|pozivu\w*(?:\s+za\s+plačil\w*)?|zahtevku\w*\s+za\s+plačil\w*)(?![\p{L}\d])/giu;

function scenario(eventTypes, positive, negative, time, amountRelation, conflicts) {
  return Object.freeze({
    eventTypes: Object.freeze(eventTypes.slice()),
    positive: Object.freeze(positive.slice()),
    negative: Object.freeze(negative.slice()),
    time: Object.freeze(time.slice()),
    amountRelation: amountRelation,
    conflicts: Object.freeze(conflicts.slice()),
  });
}

var FATHER_ONTOLOGY = Object.freeze({
  partial: scenario(["partial_payment"], ["plačal", "poravnal", "nakazal", "delno", "samo"], ["ni plačal", "ne bo plačal"], ["past", "present"], "subtract_once", ["installment", "full", "payment_promised"]),
  installment: scenario(["installment_payment", "installment_agreement"], ["obrok", "obročno", "obročni načrt"], ["obrok ni plačan"], ["past", "present", "future"], "total_or_per_installment", ["unpaid_installment"]),
  unpaid_installment: scenario(["unpaid_installment", "remaining_unpaid"], ["obrok ni plačan", "nič več", "preostanek", "še dolguje"], ["poravnan obrok"], ["past", "present", "due"], "display_only", ["installment"]),
  payment_promised: scenario(["payment_promise", "deadline_extension"], ["obljubil", "bo plačal", "nov rok", "podaljšanje"], ["ni obljubil", "rok ni odobren"], ["present", "future"], "display_only", ["partial", "full"]),
  full: scenario(["paid_in_full"], ["v celoti", "ves preostanek", "račun poravnan"], ["ni v celoti", "preostanek"], ["past", "present"], "subtract_exact_balance", ["partial", "unpaid_installment"]),
  payment_failed: scenario(["payment_failed"], ["plačilo zavrnjeno", "nakazilo vrnjeno", "trajnik ni izveden"], ["ni bilo zavrnjeno"], ["past", "present"], "display_only", ["partial", "invoice_dispute"]),
  invoice_dispute: scenario(["invoice_dispute", "debtor_statement"], ["ugovor", "reklamacija", "zavrača račun", "ne bo plačal"], ["umik ugovora", "ne ugovarja"], ["past", "present"], "display_only", ["cancelled_invoice"]),
  credit_note: scenario(["credit_note"], ["dobropis", "dobropisna nota", "kreditna nota"], ["dobropis preklican", "brez dobropisa"], ["past", "present", "future"], "subtract_when_issued", ["cancelled_invoice"]),
  compensation: scenario(["compensation"], ["kompenzacija", "kompenziral", "pobot"], ["pobot zavrnjen", "brez pobota"], ["past", "present", "future"], "subtract_when_effective", ["payment_failed"]),
  cancelled_invoice: scenario(["cancelled_invoice"], ["račun storniran", "račun preklican", "terjatev odpisana"], ["ni storniran", "dolžnik zavrača"], ["past", "present"], "display_only", ["invoice_dispute", "full"]),
  insolvency: scenario(["insolvency"], ["stečaj", "prisilna poravnava", "insolventen", "plačilno nesposoben"], ["ni v stečaju"], ["past", "present"], "display_only", []),
  collection_action: scenario(["reminder_sent"], ["poslan opomin", "vročen poziv", "posredovan zahtevek za plačilo"], ["opomin ni bil poslan"], ["past", "present", "future"], "display_only", []),
  collection_outcome: scenario(["remaining_unpaid"], ["po opominu ni plačal", "ni se več javil", "ni odgovoril"], ["po opominu je plačal", "odgovoril je"], ["past", "present"], "display_only", []),
});

var EVENT_TO_FATHER = Object.freeze({
  partial_payment: "partial", paid_in_full: "full", installment_payment: "installment",
  unpaid_installment: "unpaid_installment", remaining_unpaid: "unpaid_installment",
  installment_agreement: "installment", payment_promise: "payment_promised",
  deadline_extension: "payment_promised", payment_failed: "payment_failed",
  invoice_dispute: "invoice_dispute", insolvency: "insolvency", credit_note: "credit_note",
  compensation: "compensation", cancelled_invoice: "cancelled_invoice",
  reminder_sent: "collection_action", debtor_statement: "invoice_dispute", custom: "custom",
});

var SIGNALS = [
  signal("collection_action", "reminder_sent", COLLECTION_ACTION_PATTERN),
  signal("collection_action", "reminder_sent", PHONE_COLLECTION_ACTION_PATTERN),
  signal("collection_action", "reminder_sent", RETROSPECTIVE_COLLECTION_ACTION_PATTERN),
  signal("credit_note", "credit_note", /\b(?:dobropis\w*|dobropisna\s+nota|kreditna\s+nota)\b/giu),
  signal("compensation", "compensation", /\b(?:kompenz\w*|pobot\w*)\b/giu),
  signal("cancelled_invoice", "cancelled_invoice", /\b(?:(?:račun|terjatev)[^.!?;]{0,55}(?:odpisan\w*|odpisal\w*|storniran\w*|storniral\w*|preklican\w*|preklical\w*))\b/giu),
  signal("insolvency", "insolvency", /\b(?:stečaj\w*|prisiln\w*\s+poravnav\w*|plačilno\s+nesposob\w*|insolvent\w*)\b/giu),
  signal("payment_failed", "payment_failed", /\b(?:(?:plačil\w*|nakazil\w*|trajnik|direktn\w*\s+obremenitev)[^.!?;]{0,55}(?:zavrnjen\w*|vrnjen\w*|ni\s+bil\w*\s+izveden\w*|storniran\w*)|(?:banka|kartica)[^.!?;]{0,50}(?:zavrnil\w*|vrnil\w*)\s+(?:plačil\w*|nakazil\w*))\b/giu),
  signal("invoice_dispute", "invoice_dispute", /\b(?:ugovarja\w*|ugovor\w*|reklamacij\w*|reklamiral\w*|izpodbija\w*|zavrača\w*\s+(?:del\s+)?računa|račun\s+zavrnil\w*)\b/giu),
  signal("invoice_dispute", "debtor_statement", PAYMENT_REFUSAL_PATTERN),
  signal("payment_promised", "deadline_extension", /\b(?:podaljšanj\w*\s+roka|dodatn\w*\s+rok|nov\s+rok\s+plačila|prestavitev\s+zapadlosti)\b/giu),
  signal("payment_promised", "payment_promise", /\b(?:obljub\w*|bo(?:do|jo)?[^.!?;]{0,35}(?:plač\w*|poravn\w*|naka\w*)|(?:plačam|poravnam|nakažem)\s+(?:jutri|pojutrišnjem|čez)|(?:rekel\w*|povedal\w*|trdil\w*|napisal\w*|sporočil\w*|odgovoril\w*|pravi)\s*[^.!?;]{0,45}(?:da\s+)?(?:bo\s+)?(?:plač\w*|poravn\w*|naka\w*)|obljub\w*[^.!?;]{0,24}(?:ni\s+držal\w*|ni\s+izpolnil\w*))\b/giu),
  signal("full", "paid_in_full", /\b(?:v\s+celoti|ves\s+preostanek|celoten\s+dolg|račun\s+(?:je\s+)?(?:bil\s+)?poravnan|(?:plačal\w*|poravnal\w*|nakazal\w*)\s+(?:je\s+)?vse|vse\s+(?:je\s+)?(?:plačal\w*|poravnal\w*|nakazal\w*))\b/giu),
  signal("unpaid_installment", "unpaid_installment", /\b(?:\d{1,2}\.?|prvi|drugi|tretji|četrti|peti|šesti|sedmi|osmi|deveti|deseti)\s+obrok\w*[^.!?;]{0,20}(?:ni|še\s+ni)\s+(?:bil\w*\s+)?(?:plačan\w*|poravnan\w*)/giu),
  signal("unpaid_installment", "remaining_unpaid", /\b(?:preostan\w*|preostal\w*|še\s+dolguje|ostal\w*\s+dolžan\w*|ni\s+več\s+odziv\w*)\b/giu),
  signal("unpaid_installment", "remaining_unpaid", /\b(?:(?:vse\s+)?ostal\w*|preostan\w*|drug\w*)(?:\s+(?:je|pa|še|se)){0,3}\s+(?:ni\s+(?:plač\w*|poravn\w*|naka\w*)|(?:je\s+)?ostal\w*\s+neplačan\w*)\b/giu),
  signal("unpaid_installment", "remaining_unpaid", /\b(?:nikoli\s+ni(?:\s+(?:plač\w*|poravn\w*|naka\w*))?|obljub\w*\s+(?:ni\s+držal\w*|ni\s+izpolnil\w*)|pa\s+(?:še\s+)?ni(?![\p{L}])(?:\s+(?:plač\w*|poravn\w*|naka\w*))?)/giu),
  signal("unpaid_installment", "remaining_unpaid", /\b(?:(?:potem|nato|zatem|od\s+takrat)(?:\s+pa)?\s+)?ni\s+več\s+(?:plač\w*|poravn\w*|naka\w*)/giu),
  signal("unpaid_installment", "remaining_unpaid", /\b(?:ampak|vendar|pa|potem|nato|zatem)(?:\s+pa)?\s+(?:ni\s+nič(?:\s+potem)?|nobenega\s+plačil\w*|ni\s+(?:nič\s+)?plač\w*)\b/giu),
  signal("installment", "installment_agreement", /\b(?:dogovor\w*|odobril\w*|predlagal\w*)[^.!?;]{0,55}\bobrok\w*\b/giu),
  signal("installment", "installment_payment", /\bobrok\w*\b/giu),
  signal("partial", "partial_payment", /\bdal(?:a|i|o)?(?:\s+je)?[^.!?;]{0,24}(?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,\d+)?\s*(?:€|eur(?:ov|a)?|evr(?:ov|a)?)\b/giu),
  signal("partial", "partial_payment", /\b(?:plačal\w*|poravnal\w*|nakazal\w*|plačan\w*|poravnan\w*)\b/giu),
];

function signal(fatherCategory, eventType, pattern) {
  return Object.freeze({ fatherCategory: fatherCategory, eventType: eventType, pattern: pattern });
}

function normalizeText(value) {
  var normalized = String(value == null ? "" : value).slice(0, MAX_TEXT_LENGTH).toLowerCase().normalize("NFC")
    .replace(/\bplacal(a|i|o)?\b/gu, "plačal$1")
    .replace(/\bplacan(a|i|o)?\b/gu, "plačan$1")
    .replace(/\bpredvcerajsnjim\b/gu, "predvčerajšnjim")
    .replace(/\bpredvceraj\b/gu, "predvčeraj")
    .replace(/\bvceraj\b/gu, "včeraj")
    .replace(/\bnic\b/gu, "nič")
    .replace(/\bvec\b/gu, "več")
    .replace(/\bneplacan(a|o|i|e)?\b/gu, "neplačan$1")
    .replace(/\b(?:dolzan|dovzan|douzan|dovžan|doužan)\b/gu, "dolžan")
    .replace(/\s+/g, " ");
  return temporalEngine.normalizeTemporalTypos(normalized);
}

function sourceSpan(text, start, end) {
  return { start: start, end: end, text: text.slice(start, end) };
}

function contactEndedConclusions(value) {
  var text = normalizeText(value);
  CONTACT_ENDED_PATTERN.lastIndex = 0;
  var results = [];
  var match;
  while ((match = CONTACT_ENDED_PATTERN.exec(text))) {
    results.push(sourceSpan(text, match.index, match.index + match[0].length));
    if (!match[0].length) CONTACT_ENDED_PATTERN.lastIndex += 1;
  }
  return results;
}

function hasContactEndedConclusion(value) {
  return contactEndedConclusions(value).length > 0;
}

function collectionNonpaymentConclusions(value, signals) {
  var text = normalizeText(value);
  var reminders = (Array.isArray(signals) ? signals : []).filter(function (item) {
    return item && item.assertion === "positive" && item.eventType === "reminder_sent" && item.evidence;
  });
  if (!reminders.length) return [];
  COLLECTION_NONPAYMENT_PATTERN.lastIndex = 0;
  var results = [];
  var match;
  while ((match = COLLECTION_NONPAYMENT_PATTERN.exec(text))) {
    if (reminders.some(function (reminder) { return reminder.evidence.end <= match.index; })) {
      results.push(sourceSpan(text, match.index, match.index + match[0].length));
    }
    if (!match[0].length) COLLECTION_NONPAYMENT_PATTERN.lastIndex += 1;
  }
  return results;
}

function clearPaymentStopConclusions(value) {
  var text = normalizeText(value);
  CLEAR_PAYMENT_STOP_PATTERN.lastIndex = 0;
  var results = [];
  var match;
  while ((match = CLEAR_PAYMENT_STOP_PATTERN.exec(text))) {
    if (/^\s+(?:ni\s+)?(?:dolžan\w*|dolžna\w*|dolguje\w*|odprt\w*\s+dolg)/u.test(text.slice(match.index + match[0].length))) continue;
    var before = text.slice(0, match.index);
    var completedGroup = installmentEngine.extractInstallmentGroups(before).some(function (group) { return group.completed === true; });
    var beforeNumbers = numberEngine.extractNumberExpressions(before);
    var ordinalInstallments = (before.match(/\b(?:prvi|prvega|drugi|drugega|tretji|tretjega|četrti|četrtega)\b/giu) || []).length >= 2
      && /\bobrok\w*\b/iu.test(before)
      && beforeNumbers.filter(function (expression) { return expression.role === "money"; }).length >= 2;
    var paymentTail = before.slice(Math.max(0, before.length - 90));
    var negatedOrFailedPayment = /\b(?:ni|ne|nikoli)\s+(?:več\s+)?(?:plačal\w*|poravnal\w*|nakazal\w*)\b/iu.test(paymentTail)
      || /\b(?:plačil\w*|nakazil\w*)[^.!?;]{0,28}\b(?:ni\s+uspel\w*|ni\s+uspelo|zavrnjen\w*|neuspešen\w*)\b/iu.test(paymentTail);
    var completedPayment = !negatedOrFailedPayment && (/(?<![\p{L}])(?:plačal\w*|poravnal\w*|nakazal\w*|plačan\w*|poravnan\w*)(?![\p{L}])/iu.test(before)
      || /\bdal\w*[^.!?;]{0,55}\b(?:prvi|drugi|tretji|četrti|peti|šesti|sedmi|osmi|deveti|deseti)\s+obrok\w*/iu.test(before)
      || ordinalInstallments);
    var explicitAmount = beforeNumbers.some(function (expression) { return expression.role === "money"; });
    if (!completedGroup && !(completedPayment && explicitAmount)) continue;
    var conclusionOffset = match[0].search(/(?:nič(?:esar)?\s+več|ni\s+(?:plač\w*|poravn\w*|naka\w*)\s+nič(?:esar)?\s+več|ni\s+več\s+(?:plač\w*|poravn\w*|naka\w*))/iu);
    var conclusionStart = match.index + Math.max(0, conclusionOffset);
    results.push(sourceSpan(text, conclusionStart, match.index + match[0].length));
    if (match[0].length === 0) CLEAR_PAYMENT_STOP_PATTERN.lastIndex += 1;
  }
  return results;
}

function hasClearRemainingConclusion(value) {
  return clearPaymentStopConclusions(value).length > 0;
}

function unfulfilledPromiseConclusions(value, signals) {
  var text = normalizeText(value);
  var positivePromises = (Array.isArray(signals) ? signals : []).filter(function (item) {
    return item && item.eventType === "payment_promise" && item.assertion === "positive" && item.evidence;
  });
  if (!positivePromises.length) return [];
  UNFULFILLED_PROMISE_PATTERN.lastIndex = 0;
  var results = [];
  var match;
  while ((match = UNFULFILLED_PROMISE_PATTERN.exec(text))) {
    if (!positivePromises.some(function (promise) { return promise.evidence.end <= match.index; })) continue;
    results.push(sourceSpan(text, match.index, match.index + match[0].length));
    if (match[0].length === 0) UNFULFILLED_PROMISE_PATTERN.lastIndex += 1;
  }
  return results;
}

function tenseFor(text, start) {
  var before = text.slice(Math.max(0, start - 35), start).split(/[.!?;,]|\b(?:nato|potem|zatem|ampak|vendar)\b/u).pop();
  var after = text.slice(start, Math.min(text.length, start + 75)).split(/[.!?;,]|\b(?:nato|potem|zatem|ampak|vendar)\b|\b(?:ostalo|preostanek|preostalo)\b(?=[^.!?;,]{0,55}\b(?:rekel\w*|povedal\w*|obljubil\w*))/u)[0];
  if (/^(?:ampak|vendar|pa)?\s*(?:ni|nobenega)\b/u.test(after)) before = "";
  var around = before + after;
  if (/\b(?:bo|bodo|bojo|jutri|pojutrišnjem|čez\s+\w+)\b/u.test(around)) return "future";
  if (/\b(?:je|so|sem|smo|bil|bila|bilo|včeraj|danes)\b/u.test(around)) return "past";
  return "present";
}

function isNegated(text, start, eventType) {
  var before = text.slice(Math.max(0, start - 28), start).split(/[.!?;]/u).pop();
  var after = text.slice(start, Math.min(text.length, start + 55)).split(/[.!?;]/u)[0];
  if (eventType === "unpaid_installment" || eventType === "remaining_unpaid" || eventType === "payment_failed" || eventType === "debtor_statement") return false;
  if (eventType === "cancelled_invoice" && /\b(?:račun|terjatev)[^.!?;]{0,24}\b(?:ni|ne)\s+(?:bil\w*\s+)?(?:odpisan\w*|storniran\w*|preklican\w*)\b/u.test(after)) return true;
  if (eventType === "payment_promise") {
    PAYMENT_REFUSAL_PATTERN.lastIndex = 0;
    if (PAYMENT_REFUSAL_PATTERN.test(text.slice(Math.max(0, start - 35), Math.min(text.length, start + 80)))) return true;
  }
  if (eventType === "payment_promise" && (
    /\bne\s+bo(?:do|jo)?(?:\s+(?:nič(?:esar)?|nobenega))?(?:\s+več)?\s+(?:plač\w*|poravn\w*|naka\w*)\b/u.test(after)
    || /\bne\s+bo(?:do|jo)?\s+(?:plač\w*|poravn\w*|naka\w*)\s+(?:nič(?:esar)?\s+)?več\b/u.test(after)
    || /\bni\s+obljub\w*[^.!?;]{0,24}(?:,\s*)?(?:da\s+)?$/u.test(before)
  )) return true;
  if ((eventType === "partial_payment" || eventType === "installment_payment") && (
    /^[^.!?;]{0,32}\b(?:ni|še\s+ni)\s+(?:bil\w*\s+)?(?:plačan\w*|poravnan\w*|izveden\w*)\b/u.test(after)
    || /\b(?:ni|še\s+ni)\s+(?:bil\w*\s+)?$/u.test(before)
  )) return true;
  if (eventType === "reminder_sent") {
    var reminderWindow = text.slice(Math.max(0, start - 45), Math.min(text.length, start + 80));
    if (/\b(?:nisem|nismo|nista|niso|ni)\b[^.!?;]{0,38}(?:poslal\w*|poslan\w*|posredoval\w*|posredovan\w*|vročil\w*|vročen\w*|izdal\w*|izdan\w*|odposlal\w*|odposlan\w*)\b/u.test(reminderWindow)) return true;
  }
  return /\b(?:ni|ne|nikoli|brez)\s+(?:(?:še|več|nič|v)\s+){0,3}$/u.test(before) || /\b(?:preklican\w*|zavrnjen\w*)\b/u.test(after);
}

function isProposed(text, start, end, eventType) {
  if (eventType === "payment_promise" || eventType === "deadline_extension") return false;
  if ((eventType === "unpaid_installment" || eventType === "remaining_unpaid") && /(?:nič\s+več|nikoli\s+ni|pa\s+(?:še\s+)?ni|ni\s+nič|nobenega\s+plačil\w*|ni\s+(?:nič\s+)?plač\w*|obljub\w*\s+ni\s+(?:držal\w*|izpolnil\w*))/u.test(text.slice(start, end))) return false;
  if (eventType === "debtor_statement") return false;
  var clauseStart = Math.max(text.lastIndexOf(".", start), text.lastIndexOf("!", start), text.lastIndexOf("?", start), text.lastIndexOf(";", start), text.lastIndexOf(",", start));
  var before = text.slice(Math.max(clauseStart + 1, start - 65), start)
    .split(/\b(?:nato|potem|zatem|kasneje|pozneje|na\s+koncu|ampak|vendar)(?:\s+je)?(?:\s+pa)?\b/u).pop();
  var after = text.slice(end, Math.min(text.length, end + 55)).split(/[.!?;]/u)[0];
  if (eventType === "reminder_sent") {
    var reminderWindow = text.slice(Math.max(clauseStart + 1, start - 65), Math.min(text.length, end + 45));
    if (/\b(?:bom|bomo|boš|bo|bosta|bodo|naj\s+bi|namerav\w*|načrtuj\w*|moram\w*)\b[^.!?;]{0,55}(?:poslal\w*|poslan\w*|posredoval\w*|posredovan\w*|vročil\w*|vročen\w*|izdal\w*|izdan\w*|odposlal\w*|odposlan\w*)\b/u.test(reminderWindow)) return true;
    if (/^po\s+/iu.test(text.slice(start, end))
      && /^\s*(?:(?:mi|mu|ji|nam|jim|je|so|pa|še)\s+){0,5}(?:bo|bodo|bojo|naj\s+bi)\b/iu.test(after)) return true;
  }
  var proposalCue = /\b(?:obljub\w*|napoved\w*|predlag\w*|namerav\w*|pričakov\w*|rekel\w*\s+(?:je\s+)?(?:da\s+)?bo|naj\s+bi|bo)\b/u.test(before);
  var proposalAfter = /^\s*(?:(?:mi|mu|ji|nam|jim|je|so|samo|le)\s+){0,4}(?:obljub\w*|napoved\w*|predlag\w*|namerav\w*)\b/u.test(after);
  var completedAfter = /\b(?:je\s+)?(?:izdal\w*|izvedel\w*|odobril\w*|upošteval\w*|knjižil\w*|prejel\w*|velja\w*|začel\w*)\b/u.test(after);
  return (proposalCue || proposalAfter) && !completedAfter;
}

function phoneActionCrossesDistinctTime(text, start, end) {
  var local = text.slice(start, end);
  var relations = temporalEngine.extractDateRelations(local);
  var namedDays = paymentSequenceEngine.namedDayAnchors(local, { start: 0, end: local.length });
  return relations.some(function (relation) {
    return namedDays.some(function (namedDay) {
      if (!relation.sourceSpan || relation.sourceSpan.end > namedDay.start) return false;
      var bridge = local.slice(relation.sourceSpan.end, namedDay.start);
      return /^\s*(?:(?:in|pa|nato|potem|zatem)(?:\s+pa)?\s*)+$/iu.test(bridge);
    });
  });
}

function discoverSignals(value) {
  var text = normalizeText(value);
  var found = [];
  SIGNALS.forEach(function (definition) {
    definition.pattern.lastIndex = 0;
    var match;
    while ((match = definition.pattern.exec(text))) {
      if (definition.pattern === PHONE_COLLECTION_ACTION_PATTERN
        && phoneActionCrossesDistinctTime(text, match.index, match.index + match[0].length)) continue;
      var negated = isNegated(text, match.index, definition.eventType);
      var proposed = !negated && isProposed(text, match.index, match.index + match[0].length, definition.eventType);
      found.push({
        id: "signal-" + (found.length + 1), fatherCategory: definition.fatherCategory,
        eventType: definition.eventType, value: true, explicit: true,
        priority: negated ? 100 : proposed ? 200 : 300, confidence: negated ? "medium" : "high",
        assertion: negated ? "negated" : proposed ? "proposed" : "positive",
        tense: proposed ? "future" : definition.pattern === RETROSPECTIVE_COLLECTION_ACTION_PATTERN ? "past" : tenseFor(text, match.index),
        evidence: sourceSpan(text, match.index, match.index + match[0].length),
        reason: negated ? "explicit_negation" : proposed ? "proposed_not_occurred" : "explicit_father_signal",
      });
      if (match[0].length === 0) definition.pattern.lastIndex += 1;
    }
  });
  installmentEngine.extractInstallmentGroups(text).filter(function (group) { return group.completed === true; }).forEach(function (group) {
    found.push({
      id: "signal-installment-group-" + (found.length + 1), fatherCategory: "installment",
      eventType: "installment_payment", value: true, explicit: true,
      priority: 320, confidence: "high", assertion: "positive", tense: "past",
      evidence: sourceSpan(text, group.span.start, group.span.end),
      reason: group.reason,
    });
  });
  clearPaymentStopConclusions(text).forEach(function (evidence) {
    found.push({
      id: "signal-clear-remaining-" + (found.length + 1), fatherCategory: "unpaid_installment",
      eventType: "remaining_unpaid", value: true, explicit: true,
      priority: 330, confidence: "high", assertion: "positive", tense: "past",
      evidence: evidence, reason: "clear_payment_stop_conclusion",
    });
  });
  unfulfilledPromiseConclusions(text, found).forEach(function (evidence) {
    found.push({
      id: "signal-unfulfilled-promise-" + (found.length + 1), fatherCategory: "unpaid_installment",
      eventType: "remaining_unpaid", value: true, explicit: true,
      priority: 335, confidence: "high", assertion: "positive", tense: "past",
      evidence: evidence, reason: "unfulfilled_payment_promise",
    });
  });
  var collectionNonpayments = collectionNonpaymentConclusions(text, found);
  var collectionOutcomes = collectionNonpayments.slice();
  var refusalOutcomes = [];
  found.filter(function (item) {
    return item && item.assertion === "positive" && item.eventType === "debtor_statement" && item.evidence;
  }).forEach(function (refusal) {
    var hasPriorRemainingOutcome = found.some(function (item) {
      return item && item.assertion === "positive" && item.eventType === "remaining_unpaid"
        && item.evidence && item.evidence.end <= refusal.evidence.start;
    });
    if (hasPriorRemainingOutcome) return;
    var hasPriorCollectionEvent = found.some(function (item) {
      return item && item.assertion === "positive" && ["partial_payment", "installment_payment", "reminder_sent"].includes(item.eventType)
        && item.evidence && item.evidence.end <= refusal.evidence.start;
    });
    if (!hasPriorCollectionEvent) return;
    refusalOutcomes.push(refusal.evidence);
    collectionOutcomes.push(refusal.evidence);
  });
  contactEndedConclusions(text).forEach(function (evidence) {
    var priorCompletedPayment = found.some(function (item) {
      return item && item.assertion === "positive" && ["partial_payment", "installment_payment"].includes(item.eventType)
        && item.evidence && item.evidence.end <= evidence.start;
    });
    var priorCollectionAction = found.some(function (item) {
      return item && item.assertion === "positive" && item.eventType === "reminder_sent"
        && item.evidence && item.evidence.end <= evidence.start;
    });
    if (!priorCompletedPayment && !priorCollectionAction) return;
    collectionOutcomes.push(evidence);
  });
  if (collectionOutcomes.length) {
    collectionOutcomes.sort(function (left, right) { return left.start - right.start || left.end - right.end; });
    var firstOutcome = collectionOutcomes[0];
    var lastOutcome = collectionOutcomes.reduce(function (latest, item) { return item.end > latest.end ? item : latest; }, firstOutcome);
    found.push({
      id: "signal-collection-outcome-" + (found.length + 1), fatherCategory: "collection_outcome",
      eventType: "remaining_unpaid", value: true, explicit: true,
      priority: 345, confidence: "high", assertion: "positive", tense: "past",
      evidence: sourceSpan(text, firstOutcome.start, lastOutcome.end),
      reason: collectionNonpayments.length ? "explicit_nonpayment_after_collection_action"
        : refusalOutcomes.length ? "explicit_refusal_after_collection_action" : "explicit_contact_ended_conclusion",
    });
  }
  found.sort(function (a, b) { return a.evidence.start - b.evidence.start || b.priority - a.priority; });
  return resolveSignalConflicts(found, text);
}

function sameWindow(a, b, text) {
  var left = Math.min(a.evidence.end, b.evidence.end);
  var right = Math.max(a.evidence.start, b.evidence.start);
  var bridge = text.slice(left, right);
  var punctuationBoundary = /[!?;]/u.test(bridge) || /(?:^|[^\d])[.,]|[.,](?:$|[^\d])/u.test(bridge);
  var namedDayBoundary = /\b(?:in|pa|nato|potem|zatem)\s+(?:(?:pa|še|se|je|so)\s+)*(?:predvčeraj(?:šnjim)?|včeraj|danes)\b/u.test(bridge);
  return right - left <= 45 && !punctuationBoundary && !namedDayBoundary && !/\b(?:nato|potem|zatem|vendar|ampak)\b/u.test(bridge);
}

function resolveSignalConflicts(signals, text) {
  return signals.filter(function (item, index) {
    if (item.assertion === "negated") return true;
    if (item.assertion === "proposed") return true;
    if (item.eventType === "payment_promise" && signals.some(function (other, otherIndex) {
      return otherIndex !== index && other.assertion === "positive" && other.eventType === "remaining_unpaid"
        && item.evidence.start >= other.evidence.start && item.evidence.end <= other.evidence.end
        && signals.some(function (prior, priorIndex) {
          return priorIndex !== index && prior.eventType === "payment_promise" && prior.assertion === "positive" && prior.evidence.end < other.evidence.start;
        });
    })) return false;
    if (item.eventType === "remaining_unpaid" && item.assertion === "positive") {
      var remainingPeers = signals.filter(function (peer) {
        return peer.eventType === "remaining_unpaid" && peer.assertion === "positive" && (peer === item || sameWindow(peer, item, text));
      }).sort(function (left, right) {
        return right.priority - left.priority || left.evidence.start - right.evidence.start || (right.evidence.end - right.evidence.start) - (left.evidence.end - left.evidence.start);
      });
      if (remainingPeers[0] !== item) return false;
    }
    if (item.eventType === "payment_promise" && !/\bobljub\w*/u.test(String(item.evidence && item.evidence.text || "")) && signals.some(function (other, otherIndex) {
      return otherIndex !== index && other.assertion === "proposed" && ["credit_note", "compensation", "cancelled_invoice", "insolvency", "invoice_dispute", "payment_failed", "collection_action"].includes(other.fatherCategory) && sameWindow(item, other, text);
    })) return false;
    var peers = signals.filter(function (other, otherIndex) { return otherIndex !== index && other.assertion === "positive" && sameWindow(item, other, text); });
    if (item.fatherCategory === "partial" && peers.some(function (peer) { return ["installment", "full", "payment_failed"].includes(peer.fatherCategory); })) return false;
    if (item.fatherCategory === "installment" && item.eventType === "installment_payment" && peers.some(function (peer) { return peer.eventType === "installment_agreement" || peer.eventType === "unpaid_installment"; })) return false;
    if (item.eventType === "remaining_unpaid" && item.assertion === "positive") return true;
    return !signals.slice(0, index).some(function (previous) {
      return previous.fatherCategory === item.fatherCategory && previous.eventType === item.eventType && previous.assertion === item.assertion && Math.abs(previous.evidence.start - item.evidence.start) < 4;
    });
  });
}

function splitCoarse(text) {
  var separator = /(?<!\d)[.!?;]+|[.!?;]+(?!\s*(?:\d|obrok\w*))|,\s+(?=(?:nato|potem|zatem|za\s+tem|kasneje|pozneje|sedaj|zdaj|trenutno|vendar|ampak|obljub\w*|dobropis\w*|kompenz\w*|pobot\w*|stečaj\w*|preostanek)\b)|\s+(?=(?:ostalo|preostanek|preostalo|vse\s+ostalo)\b[^.!?;]{0,55}\b(?:rekel\w*|povedal\w*|obljubil\w*))|\s+(?=(?:ostalo|preostanek|preostalo|vse\s+ostalo)\b(?:\s+(?:je|pa|še)){0,3}\s+(?:dolžan\w*|dolžna\w*|dolguje\w*|ni\s+plač\w*))|\s+(?=(?:ampak|vendar|toda|pa)\s+(?:ni\s+nič(?![\p{L}\d])|nobenega\s+plačil\w*(?![\p{L}\d])|ni\s+plač\w*(?![\p{L}\d])))|\s+(?:(?:(?:in\s+)?(?:nato|na\s+to|potem|zatem|za\s+tem|kasneje|pozneje|na\s+koncu)(?:\s+(?:je|pa|še)){0,2}|in\s+pa|in\s+še|pa\s+še|(?:ampak|vendar|toda)(?:\s+(?:je|pa|še)){0,2})\s+|(?:sedaj|zdaj|trenutno)(?:\s+(?:je|pa|še)){0,3}\s+(?=(?:obljub\w*|rekel\w*|povedal\w*|trdil\w*|napisal\w*|sporočil\w*|dogovor\w*|predlagal\w*|napovedal\w*|izdal\w*|izvedel\w*|odobril\w*|upošteval\w*|knjižil\w*|storniral\w*|odpisal\w*|preklical\w*|zavrnil\w*|vrnil\w*|kompenziral\w*|dobropis\w*|kompenz\w*|pobot\w*|stečaj\w*|prisiln\w*|insolvent\w*|ugovor\w*|reklamacij\w*|račun\w*|plačil\w*|nakazil\w*|obrok\w*|banka\b|kartica\b|noče\b|ne\s+bo\b)))|\s+(?:in|vendar|ampak|toda|pa)\s+(?=nikoli\b|pa\s+(?:še\s+)?ni\b|ni\s+nič(?![\p{L}\d])|nobenega\s+plačil\w*(?![\p{L}\d])|ni\s+plač\w*(?![\p{L}\d]))/giu;
  var spans = [];
  var start = 0;
  var match;
  while ((match = separator.exec(text))) {
    if (match.index > start) spans.push({ start: start, end: match.index });
    start = match.index + match[0].length;
  }
  if (start < text.length) spans.push({ start: start, end: text.length });
  var beforePrevious = /,?\s+(?=pred\s+tem\s+(?:obrok\w*|plačil\w*)\s+(?:pa\s+)?(?:je\s+)?(?:plačal\w*|poravnal\w*|nakazal\w*))/giu;
  spans = spans.reduce(function (result, span) {
    var local = text.slice(span.start, span.end);
    var cuts = [span.start];
    var localMatch;
    beforePrevious.lastIndex = 0;
    while ((localMatch = beforePrevious.exec(local))) cuts.push(span.start + localMatch.index + localMatch[0].length);
    cuts.push(span.end);
    Array.from(new Set(cuts)).sort(function (left, right) { return left - right; }).forEach(function (cut, index, ordered) {
      if (index < ordered.length - 1 && ordered[index + 1] > cut) result.push({ start: cut, end: ordered[index + 1] });
    });
    return result;
  }, []);
  var merged = [];
  for (var spanIndex = 0; spanIndex < spans.length; spanIndex += 1) {
    var current = spans[spanIndex];
    var next = spans[spanIndex + 1];
    var currentText = text.slice(current.start, current.end).trim();
    var bridge = next ? text.slice(current.end, next.start) : "";
    var nextText = next ? text.slice(next.start, next.end) : "";
    var endsWithNamedDay = /(?:^|[\s,])(?:predvčeraj(?:šnjim)?|včeraj|danes)$/iu.test(currentText);
    var endsWithReferenceRelation = temporalEngine.extractDateRelations(currentText).some(function (relation) {
      return relation.anchor === "reference_date" && relation.sourceSpan.end === currentText.length;
    });
    if (next && (endsWithNamedDay || endsWithReferenceRelation)
      && /^\s*(?:pa\s+)?še\s*$/iu.test(bridge)
      && numberEngine.extractNumberExpressions(nextText).some(function (expression) { return expression.evidence.start === 0; })) {
      merged.push({ start: current.start, end: next.end });
      spanIndex += 1;
      continue;
    }
    merged.push(current);
  }
  spans = merged;
  return spans.filter(function (span) { return text.slice(span.start, span.end).trim(); });
}

function splitAtRemainingSignals(text, spans, signals, dateRelations) {
  var refined = [];
  (spans || []).forEach(function (span) {
    var cuts = [span.start];
    (signals || []).filter(function (signal) {
      if (signal.eventType !== "remaining_unpaid" || signal.assertion !== "positive"
        || signal.evidence.start <= span.start || signal.evidence.start >= span.end) return false;
      if (signal.reason === "explicit_refusal_after_collection_action") return false;
      var priorSignal = (signals || []).some(function (prior) {
        return prior !== signal && prior.evidence && prior.evidence.start >= span.start && prior.evidence.end <= signal.evidence.start;
      });
      var priorPaymentAmount = paymentSequenceEngine.extractPaymentExpressions(text, dateRelations).some(function (expression) {
        return expression.evidence.start >= span.start && expression.evidence.end <= signal.evidence.start;
      });
      return priorSignal || priorPaymentAmount;
    }).forEach(function (signal) { cuts.push(signal.evidence.start); });
    cuts.push(span.end);
    var ordered = Array.from(new Set(cuts)).sort(function (left, right) { return left - right; });
    ordered.forEach(function (cut, index) {
      if (index < ordered.length - 1 && ordered[index + 1] > cut) refined.push({ start: cut, end: ordered[index + 1] });
    });
  });
  return refined.filter(function (span) { return text.slice(span.start, span.end).trim(); });
}

function splitAtEmbeddedRelationSignals(text, spans, signals) {
  var refined = [];
  (spans || []).forEach(function (span) {
    var cuts = [span.start, span.end];
    (signals || []).filter(function (signal) {
      return signal && signal.assertion === "positive" && signal.eventType === "reminder_sent"
        && signal.evidence && signal.evidence.start >= span.start && signal.evidence.end <= span.end
        && /^po\s+/iu.test(signal.evidence.text || "");
    }).forEach(function (signal) {
      if (signal.evidence.start > span.start) cuts.push(signal.evidence.start);
      var trailing = text.slice(signal.evidence.end, span.end);
      var trailingStartsWithNamedDay = /^\s*(?:predvčeraj(?:šnjim)?|včeraj|danes)\b/iu.test(trailing);
      if (signal.evidence.end < span.end && !trailingStartsWithNamedDay) cuts.push(signal.evidence.end);
    });
    var ordered = Array.from(new Set(cuts)).sort(function (left, right) { return left - right; });
    ordered.forEach(function (cut, index) {
      if (index < ordered.length - 1 && ordered[index + 1] > cut) refined.push({ start: cut, end: ordered[index + 1] });
    });
  });
  return refined.filter(function (span) { return text.slice(span.start, span.end).trim(); });
}

function temporalLeadBridgeAllowed(text, anchor, signal) {
  if (!anchor || !signal || !anchor.sourceSpan || !signal.evidence) return false;
  var bridge = text.slice(anchor.sourceSpan.end, signal.evidence.start);
  if (bridge.length > 70 || /[.!?;]/u.test(bridge) || /\d|€|\beur\w*|\bevr\w*/iu.test(bridge)) return false;
  if (temporalEngine.extractDateRelations(bridge).length) return false;
  if (paymentSequenceEngine.namedDayAnchors(bridge, { start: 0, end: bridge.length }).length) return false;
  var words = bridge.match(/[\p{L}]+/gu) || [];
  return words.length <= 8;
}

function splitAtTemporalFatherLeads(text, spans, signals, dateRelations) {
  var namedDays = paymentSequenceEngine.namedDayAnchors(text, { start: 0, end: text.length }).map(function (span) {
    return { sourceSpan: span, reason: "named_day_reference" };
  });
  var anchors = (dateRelations || []).concat(namedDays).sort(function (left, right) {
    return left.sourceSpan.start - right.sourceSpan.start || left.sourceSpan.end - right.sourceSpan.end;
  });
  var refined = [];
  (spans || []).forEach(function (span) {
    var cuts = [span.start];
    anchors.filter(function (anchor) {
      return anchor.sourceSpan.start > span.start && anchor.sourceSpan.start < span.end;
    }).forEach(function (anchor) {
      var priorSignal = (signals || []).some(function (signal) {
        return signal.evidence && signal.evidence.start >= span.start && signal.evidence.end <= anchor.sourceSpan.start;
      });
      if (!priorSignal) return;
      var followingSignal = (signals || []).filter(function (signal) {
        return signal.evidence && signal.evidence.start >= anchor.sourceSpan.end && signal.evidence.start < span.end;
      }).sort(function (left, right) { return left.evidence.start - right.evidence.start; })[0];
      if (!followingSignal || !temporalLeadBridgeAllowed(text, anchor, followingSignal)) return;
      cuts.push(anchor.sourceSpan.start);
    });
    cuts.push(span.end);
    var ordered = Array.from(new Set(cuts)).sort(function (left, right) { return left - right; });
    ordered.forEach(function (cut, index) {
      if (index < ordered.length - 1 && ordered[index + 1] > cut) refined.push({ start: cut, end: ordered[index + 1] });
    });
  });
  return refined.filter(function (span) { return text.slice(span.start, span.end).trim(); });
}

function splitAtNamedDayNarrativeTransitions(text, spans, signals, dateRelations) {
  var namedDays = paymentSequenceEngine.namedDayAnchors(text, { start: 0, end: text.length });
  var refined = [];
  (spans || []).forEach(function (span) {
    var cuts = [span.start];
    namedDays.filter(function (anchor) {
      return anchor.start > span.start && anchor.start < span.end;
    }).forEach(function (anchor) {
      var followingSignal = (signals || []).filter(function (signal) {
        return signal && signal.assertion === "positive" && signal.evidence
          && signal.evidence.start >= anchor.end && signal.evidence.start < span.end;
      }).sort(function (left, right) { return left.evidence.start - right.evidence.start; })[0];
      if (!followingSignal || !temporalLeadBridgeAllowed(text, { sourceSpan: anchor }, followingSignal)) return;
      var priorText = text.slice(span.start, anchor.start).trim();
      var priorHasOwnTime = (dateRelations || []).some(function (relation) {
        return relation && relation.sourceSpan && relation.sourceSpan.start >= span.start && relation.sourceSpan.end <= anchor.start;
      });
      var priorHasNarrativeAction = /\b(?:kontaktiral\w*|poklical\w*|klical\w*|telefoniral\w*|govoril\w*|pogovarjal\w*|pisal\w*|sporočil\w*|opomnil\w*)\b/iu.test(priorText);
      if (priorHasOwnTime && priorHasNarrativeAction) cuts.push(anchor.start);
    });
    cuts.push(span.end);
    var ordered = Array.from(new Set(cuts)).sort(function (left, right) { return left - right; });
    ordered.forEach(function (cut, index) {
      if (index < ordered.length - 1 && ordered[index + 1] > cut) refined.push({ start: cut, end: ordered[index + 1] });
    });
  });
  return refined.filter(function (span) { return text.slice(span.start, span.end).trim(); });
}

function explicitInstallmentRepeat(text, span, expression, localSignals) {
  if (!expression || !expression.evidence || !Number.isInteger(expression.value) || expression.value < 2 || expression.value > 20) return false;
  if (!(localSignals || []).some(function (signal) {
    return signal && signal.assertion === "positive" && signal.eventType === "installment_payment";
  })) return false;
  var tail = text.slice(expression.evidence.end, Math.min(span.end, expression.evidence.end + 28));
  return /^\s+obrok(?:a|e|i|ov|ih)\w*/iu.test(tail);
}

function extractValues(text, span, installmentGroups, localSignals, dateRelations, installmentCadences, hasPreviousClause) {
  var local = text.slice(span.start, span.end);
  var values = [];
  var inheritedMoney = (localSignals || []).some(function (item) {
    return item && item.assertion === "positive" && (item.eventType === "partial_payment" || item.eventType === "installment_payment");
  });
  numberEngine.extractNumberExpressions(text, { defaultRole: inheritedMoney ? "money" : "number" }).map(function (expression) {
    return paymentSequenceEngine.clipExpressionBeforeTemporalCount(text, expression, dateRelations);
  }).filter(function (expression) {
    return expression.evidence.start >= span.start && expression.evidence.start < span.end;
  }).forEach(function (expression) {
    var absoluteStart = expression.evidence.start;
    var absoluteEnd = expression.evidence.end;
    if ((dateRelations || []).some(function (relation) {
      return absoluteStart >= relation.countSpan.start && absoluteEnd <= relation.countSpan.end;
    })) return;
    if ((installmentCadences || []).some(function (cadence) {
      return cadence.countSpan && absoluteStart >= cadence.countSpan.start && absoluteEnd <= cadence.countSpan.end;
    })) return;
    var group = (installmentGroups || []).find(function (item) {
      return absoluteStart >= item.countSpan.start && absoluteStart < item.countSpan.end;
    });
    if (group) return;
    var amountGroup = (installmentGroups || []).find(function (item) {
      return absoluteStart >= item.amountSpan.start && absoluteStart < item.amountSpan.end;
    });
    var amountRelation = amountRelationForExpression(text, expression, hasPreviousClause);
    var isInstallmentRepeat = explicitInstallmentRepeat(text, span, expression, localSignals);
    var role = isInstallmentRepeat ? "repeat" : amountRelation ? "amount_relation" : amountGroup ? "money" : expression.value === 0 && !expression.currency ? "number" : expression.role;
    values.push({
      kind: role, value: expression.value, currency: role === "money" || role === "amount_relation" ? expression.currency : null,
      explicit: true, confidence: "high", priority: 250,
      evidence: amountRelation ? amountRelation.sourceSpan : sourceSpan(text, absoluteStart, absoluteEnd),
      reason: isInstallmentRepeat ? "explicit_installment_count" : amountRelation ? amountRelation.reason : amountGroup ? "per_installment_amount" : expression.reason,
      relation: isInstallmentRepeat ? "repeat" : amountRelation || (amountGroup ? "per_installment" : null),
      groupId: amountGroup ? amountGroup.id : null,
    });
  });
  (installmentGroups || []).forEach(function (group) {
    if (group.amountSpan.start < span.start || group.amountSpan.start >= span.end) return;
    if (values.some(function (item) { return item.groupId === group.id; })) return;
    values.push({
      kind: "money", value: group.amount, currency: group.currency,
      explicit: true, confidence: "high", priority: 270,
      evidence: sourceSpan(text, group.amountSpan.start, group.amountSpan.end),
      reason: "per_installment_amount", relation: "per_installment", groupId: group.id,
    });
  });
  values.sort(function (a, b) { return a.evidence.start - b.evidence.start; });
  return values;
}

function ordinalEventIndex(value) {
  var token = String(value || "").toLowerCase();
  if (/^prv/u.test(token)) return 0;
  if (/^drug/u.test(token)) return 1;
  if (/^tretj/u.test(token)) return 2;
  if (/^četrt/u.test(token)) return 3;
  if (/^pet/u.test(token)) return 4;
  if (/^šest/u.test(token)) return 5;
  if (/^sedm/u.test(token)) return 6;
  if (/^osm/u.test(token)) return 7;
  if (/^devet/u.test(token)) return 8;
  if (/^deset/u.test(token)) return 9;
  return null;
}

function amountRelationForExpression(text, expression, allowImplicitPrevious) {
  if (!expression || !Number.isFinite(Number(expression.value)) || Number(expression.value) <= 0 || !expression.evidence) return null;
  var tail = text.slice(expression.evidence.end, Math.min(text.length, expression.evidence.end + 72));
  var match = tail.match(/^\s*(?:€|eur\w*|evr\w*)?\s*(več|manj)\s+kot\s+(prejšnj\w*|predhodn\w*|prv\w*|drug\w*|tretj\w*|četrt\w*|pet\w*|šest\w*|sedm\w*|osm\w*|devet\w*|deset\w*)(?:\s+(?:obrok\w*|mesec\w*|plačil\w*))?/iu);
  var implicit = false;
  if (!match && allowImplicitPrevious) {
    match = tail.match(/^\s*(?:€|eur\w*|evr\w*)?\s*(več|manj)(?=\s*(?:$|[,;.!?]|\b(?:nato|potem|zatem|in|pa|danes|včeraj|predvčeraj|čez|pred)\b))/iu);
    implicit = Boolean(match);
  }
  if (!match) return null;
  var previous = implicit || /^(?:prejšnj|predhodn)/u.test(match[2] || "");
  var anchorIndex = previous ? null : ordinalEventIndex(match[2]);
  if (!previous && anchorIndex == null) return null;
  return {
    anchor: previous ? "previous_event" : "event_index",
    anchorIndex: anchorIndex,
    field: "amount",
    direction: match[1].toLowerCase() === "več" ? 1 : -1,
    deltaEur: Number(expression.value),
    sourceSpan: sourceSpan(text, expression.evidence.start, expression.evidence.end + match[0].length),
    reason: "relative_payment_amount",
  };
}

function continuationPaymentAmount(local) {
  var expressions = numberEngine.extractNumberExpressions(local, { defaultRole: "money" });
  for (var i = 0; i < expressions.length; i += 1) {
    var expression = expressions[i];
    if (expression.role !== "money") continue;
    var before = local.slice(0, expression.evidence.start).trim()
      .replace(/\s+(?:pa\s+)?(?:še|se|dodatnih?|dodatno)$/iu, "")
      .replace(/\s+pa$/iu, "")
      .replace(/(?:^|\s)za$/iu, "")
      .trim();
    var after = local.slice(expression.evidence.end);
    if (/^\s*(?:dan|dni|dnev\w*|teden|tedn\w*|mesec\w*|let\w*)\b/iu.test(after)) continue;
    var immediate = !before;
    var namedDay = /^(?:predvčeraj(?:šnjim)?|včeraj|danes)(?:\s+pa)?(?:\s+(?:še|se))?$/iu.test(before);
    var relativeReference = /^pred\s+(?:(?:\d+|[\p{L}]+)\s+)?(?:dan|dni|dnev\w*|tedn\w*|mesec\w*|let\w*)(?:\s+(?:dni|nazaj))?(?:\s+pa)?$/iu.test(before);
    var relativeEvent = temporalEngine.extractDateRelations(before).some(function (relation) {
      return relation.sourceSpan.start === 0 && relation.sourceSpan.end === before.length;
    });
    var isoDate = /^20\d{2}-\d{1,2}-\d{1,2}(?:\s+pa)?$/u.test(before);
    var dottedDate = /^\d{1,2}\.\s*\d{1,2}\.(?:\s*20\d{2})?(?:\s+pa)?$/u.test(before);
    if (immediate || namedDay || relativeReference || relativeEvent || isoDate || dottedDate) {
      return { text: expression.evidence.text, index: expression.evidence.start, length: expression.evidence.end - expression.evidence.start };
    }
  }
  return null;
}

function inheritedSequentialPaymentSignal(text, span, previousClause) {
  if (!previousClause || !Array.isArray(previousClause.eventTypes)) return null;
  var inheritedType = previousClause.eventTypes.slice().reverse().find(function (type) {
    return type === "partial_payment" || type === "installment_payment";
  });
  if (!inheritedType) return null;
  var bridge = text.slice(previousClause.span.end, span.start);
  var raw = text.slice(span.start, span.end);
  var local = raw.trim();
  var leadingConnector = local.match(/^(?:(?:in\s+)?(?:nato|potem|zatem|za\s+tem|kasneje|pozneje)(?:\s+(?:pa|še))?|in\s+še|pa\s+še)\s+/iu);
  if (leadingConnector) local = local.slice(leadingConnector[0].length);
  var connectorContext = bridge + (leadingConnector ? leadingConnector[0] : "");
  var amount = continuationPaymentAmount(local);
  if (!amount) return null;
  var previousWasBoundedInstallmentGroup = inheritedType === "installment_payment"
    && Array.isArray(previousClause.installmentGroups)
    && previousClause.installmentGroups.some(function (group) {
      return group && group.completed === true && Number.isInteger(group.count) && group.count >= 1;
    });
  if (previousWasBoundedInstallmentGroup && !/\bobrok\w*\b/iu.test(local)) inheritedType = "partial_payment";
  var namedDayContinuation = /^(?:predvčeraj(?:šnjim)?|včeraj|danes)(?:\s+pa)?(?:\s+(?:še|se))?\s+/iu.test(local);
  var namedDayAfterAmount = new RegExp("^\\s*(?:pa\\s+)?(?:predvčeraj(?:šnjim)?|včeraj|danes)(?![\\p{L}\\d])", "iu").test(local.slice(amount.index + amount.length));
  var beforeAmount = local.slice(0, amount.index).trim().replace(/\s+(?:(?:pa\s+)?še|pa)$/iu, "").trim();
  var temporalContinuation = temporalEngine.extractDateRelations(beforeAmount).some(function (relation) {
    return ["reference_date", "previous_event"].includes(relation.anchor)
      && relation.sourceSpan.start === 0 && relation.sourceSpan.end === beforeAmount.length;
  });
  if (!/\b(?:nato|potem|zatem|za\s+tem|kasneje|pozneje)\b|\b(?:in|pa)\s+še\b/iu.test(connectorContext)
    && !namedDayContinuation && !namedDayAfterAmount && !temporalContinuation) return null;
  var precedingContext = text.slice(Math.max(0, previousClause.span.end - 45), span.start) + connectorContext;
  if (/\b(?:dolžan\w*|dolguje\w*|preostanek|preostalo|ostalo|ostane|odprto)\b/iu.test(precedingContext)) return null;
  var start = span.start + raw.indexOf(local) + amount.index;
  return {
    id: "signal-inherited-" + span.start,
    fatherCategory: inheritedType === "installment_payment" ? "installment" : "partial",
    eventType: inheritedType,
    value: true,
    explicit: true,
    priority: 290,
    confidence: "high",
    assertion: "positive",
    tense: "past",
    evidence: sourceSpan(text, start, start + amount.length),
    reason: "sequential_payment_continuation",
  };
}

function adjacentTemporalPaymentSignal(text, span, signals, dateRelations) {
  var hasPaymentLineage = (signals || []).some(function (signal) {
    return signal.assertion === "positive" && ["partial_payment", "installment_payment"].includes(signal.eventType);
  });
  if (!hasPaymentLineage) return null;
  var localRelations = (dateRelations || []).filter(function (relation) {
    return relation.anchor === "reference_date" && relation.sourceSpan.start >= span.start && relation.sourceSpan.start < span.end;
  });
  var amounts = paymentSequenceEngine.extractPaymentExpressions(text, dateRelations).filter(function (expression) {
    return expression.evidence.start >= span.start && expression.evidence.start < span.end;
  });
  if (localRelations.length !== 1 || amounts.length !== 1) return null;
  var local = text.slice(span.start, span.end);
  if (/\b(?:ni|ne|nikoli|obljub\w*|račun\w*|dobropis\w*|pobot\w*|ugovor\w*|reklamacij\w*)\b/u.test(local)) return null;
  var amount = amounts[0];
  var relation = localRelations[0];
  var bridgeStart = Math.min(amount.evidence.end, relation.sourceSpan.end);
  var bridgeEnd = Math.max(amount.evidence.start, relation.sourceSpan.start);
  var bridge = text.slice(bridgeStart, bridgeEnd);
  if (!/^\s*(?:(?:pa|še|se|in)\s*)*$/u.test(bridge)) return null;
  return {
    id: "signal-temporal-lineage-" + span.start,
    fatherCategory: "partial", eventType: "partial_payment", value: true,
    explicit: true, priority: 288, confidence: "high", assertion: "positive", tense: "past",
    evidence: sourceSpan(text, amount.evidence.start, amount.evidence.end),
    reason: "temporal_amount_payment_lineage",
  };
}

function targetClauseForDateRelation(text, clauses, relation) {
  var containing = clauses.find(function (clause) {
    return relation.sourceSpan.start >= clause.span.start && relation.sourceSpan.start < clause.span.end;
  }) || null;
  var clarificationLead = containing && containing.semanticStatus === "neutral"
    && /\bdopolnitev uporabnika\s*:/iu.test(containing.text || "");
  if (clarificationLead) {
    var clarificationIndex = clauses.indexOf(containing);
    var clarified = clauses.slice(clarificationIndex + 1).find(function (clause) {
      return (clause.signals || []).some(function (signal) { return signal && signal.assertion === "positive"; });
    });
    if (clarified) return clarified;
  }
  var pureTemporalLead = containing && !(containing.signals || []).some(function (signal) {
    return signal && signal.assertion === "positive";
  }) && !(containing.values || []).length
    && containing.span.start >= relation.sourceSpan.start && containing.span.end <= relation.sourceSpan.end;
  if (pureTemporalLead) {
    var containingIndex = clauses.indexOf(containing);
    var following = clauses.slice(containingIndex + 1).find(function (clause) {
      return (clause.signals || []).some(function (signal) { return signal && signal.assertion === "positive"; })
        || (clause.values || []).some(function (value) { return value && value.kind === "money"; });
    });
    if (following) return following;
  }
  if (relation.anchor !== "previous_event") return containing;
  var containingSignalBefore = containing && containing.signals.some(function (signal) {
    return signal.assertion === "positive" && signal.evidence && signal.evidence.start < relation.sourceSpan.start;
  });
  if (containingSignalBefore) {
    var next = clauses.map(function (clause) {
      var signal = clause.signals.find(function (item) {
        return item.assertion === "positive" && item.evidence && item.evidence.start >= relation.sourceSpan.end;
      });
      return signal ? { clause: clause, signal: signal } : null;
    }).filter(Boolean).sort(function (left, right) {
      return left.signal.evidence.start - right.signal.evidence.start;
    })[0];
    if (next && next.clause !== containing) {
      var bridge = text.slice(relation.sourceSpan.end, next.signal.evidence.start);
      if (/^\s*(?:(?:je|so|pa|še)\s*){0,3}$/iu.test(bridge)) return next.clause;
    }
  }
  if (containing) return containing;
  return clauses.find(function (clause) {
    return clause.signals.some(function (signal) {
      return signal.assertion === "positive" && signal.evidence && signal.evidence.start >= relation.sourceSpan.end;
    });
  }) || null;
}

function annotateDateRelationForClause(relation, clause) {
  if (!relation || !clause || !Array.isArray(clause.signals)) return relation;
  var signal = clause.signals.slice().sort(function (left, right) {
    function distance(item) {
      if (!item || !item.evidence) return Infinity;
      if (item.evidence.start >= relation.sourceSpan.end) return item.evidence.start - relation.sourceSpan.end;
      if (item.evidence.end <= relation.sourceSpan.start) return relation.sourceSpan.start - item.evidence.end;
      return 0;
    }
    return distance(left) - distance(right) || left.evidence.start - right.evidence.start;
  })[0];
  return Object.assign({}, relation, {
    assertion: signal && signal.assertion || "positive",
    eventType: signal && signal.eventType || null,
    fatherCategory: signal && signal.fatherCategory || null,
  });
}

function groupDateBridgeAllowed(text, group, relation) {
  if (!group || !group.span || !relation || !relation.sourceSpan) return false;
  var start = Math.min(group.span.end, relation.sourceSpan.end);
  var end = Math.max(group.span.start, relation.sourceSpan.start);
  if (end <= start) return true;
  return /^\s*(?:(?:in|pa|nato|potem|zatem|je|so|sem|smo|sta|bila?|bili?|plačal\w*|poravnal\w*|nakazal\w*)\s*)*$/iu.test(text.slice(start, end));
}

function bindSharedInstallmentGroupDates(text, clauses) {
  clauses.forEach(function (clause) {
    var groups = (clause.installmentGroups || []).filter(function (group) {
      return group && group.completed === true && Number.isInteger(group.count) && group.count > 1;
    });
    if (groups.length !== 1 || (clause.dateRelations || []).length !== 1 || (clause.installmentCadences || []).length) return;
    if ((clause.eventTypes || []).length !== 1 || clause.eventTypes[0] !== "installment_payment") return;
    var relation = clause.dateRelations[0];
    if (relation.anchor !== "reference_date" || !groupDateBridgeAllowed(text, groups[0], relation)) return;
    clause.dateRelations[0] = Object.assign({}, relation, { groupId: groups[0].id });
  });
}

function segmentClauses(value) {
  var text = normalizeText(value);
  var signals = discoverSignals(text);
  var installmentGroups = installmentEngine.extractInstallmentGroups(text);
  var dateRelations = temporalEngine.extractDateRelations(text);
  var installmentCadences = temporalEngine.extractInstallmentCadences(text, installmentGroups);
  var coarseSpans = splitAtTemporalFatherLeads(text, splitCoarse(text), signals, dateRelations);
  coarseSpans = splitAtNamedDayNarrativeTransitions(text, coarseSpans, signals, dateRelations);
  coarseSpans = splitAtEmbeddedRelationSignals(text, coarseSpans, signals);
  coarseSpans = splitAtRemainingSignals(text, coarseSpans, signals, dateRelations);
  var spans = paymentSequenceEngine.splitPaymentContinuations(text, coarseSpans, signals, dateRelations);
  var clauses = [];
  spans.forEach(function (span, spanIndex) {
    var localSignals = signals.filter(function (item) {
      if (item.evidence.start >= span.start && item.evidence.start < span.end) return true;
      if (!(item.evidence.start < span.end && item.evidence.end > span.start)) return false;
      return !spans.slice(0, spanIndex).some(function (previousSpan) {
        return item.evidence.start < previousSpan.end && item.evidence.end > previousSpan.start;
      });
    });
    if (!localSignals.some(function (item) { return item.assertion === "positive"; })) {
      var previousActiveClause = clauses.slice().reverse().find(function (clause) {
        return clause && Array.isArray(clause.eventTypes) && clause.eventTypes.length > 0;
      }) || null;
      var inherited = inheritedSequentialPaymentSignal(text, span, previousActiveClause);
      if (inherited) localSignals.push(inherited);
      else {
        var temporalLineage = adjacentTemporalPaymentSignal(text, span, signals, dateRelations);
        if (temporalLineage) localSignals.push(temporalLineage);
      }
    }
    var active = localSignals.filter(function (item) { return item.assertion === "positive"; });
    var fathers = Array.from(new Set(active.map(function (item) { return item.fatherCategory; })));
    var localGroups = installmentGroups.filter(function (group) { return group.span.start >= span.start && group.span.start < span.end; });
    var localDateRelations = dateRelations.filter(function (relation) { return relation.sourceSpan.start >= span.start && relation.sourceSpan.start < span.end; });
    var localInstallmentCadences = installmentCadences.filter(function (cadence) { return cadence.sourceSpan.start >= span.start && cadence.sourceSpan.start < span.end; });
    clauses.push({
      id: "clause-" + (clauses.length + 1), index: clauses.length,
      span: sourceSpan(text, span.start, span.end), text: text.slice(span.start, span.end).trim(),
      fatherCategories: fathers, eventTypes: Array.from(new Set(active.map(function (item) { return item.eventType; }))),
      semanticStatus: active.length ? "recognized" : "neutral",
      signals: localSignals, values: extractValues(text, span, localGroups, localSignals, dateRelations, localInstallmentCadences, clauses.length > 0),
      installmentGroups: localGroups, dateRelations: localDateRelations, installmentCadences: localInstallmentCadences,
    });
  });
  clauses.forEach(function (clause) { clause.dateRelations = []; });
  dateRelations.forEach(function (relation) {
    var target = targetClauseForDateRelation(text, clauses, relation);
    if (target) target.dateRelations.push(annotateDateRelationForClause(relation, target));
  });
  bindSharedInstallmentGroupDates(text, clauses);
  return { text: text, signals: signals, clauses: clauses, installmentGroups: installmentGroups, dateRelations: dateRelations, installmentCadences: installmentCadences };
}

function buildFactContract(value) {
  var normalized = normalizeText(value);
  if (factContractCache.has(normalized)) return factContractCache.get(normalized);
  var segmented = segmentClauses(normalized);
  var facts = [];
  segmented.clauses.forEach(function (clause) {
    clause.signals.forEach(function (item) {
      facts.push({
        id: "fact-" + (facts.length + 1), kind: "category", category: item.fatherCategory,
        eventType: item.eventType, value: item.value, explicit: item.explicit,
        priority: item.priority, confidence: item.confidence, assertion: item.assertion,
        tense: item.tense, sourceSpan: item.evidence, clauseId: clause.id, reason: item.reason,
      });
    });
    clause.values.forEach(function (item) {
      facts.push({
        id: "fact-" + (facts.length + 1), kind: item.kind, category: clause.fatherCategories.length === 1 ? clause.fatherCategories[0] : null,
        value: item.value, currency: item.currency, explicit: item.explicit,
        priority: item.priority, confidence: item.confidence, sourceSpan: item.evidence,
        clauseId: clause.id, reason: item.reason, relation: item.relation || null, groupId: item.groupId || null,
        eventType: item.kind === "repeat" ? "installment_payment" : null,
      });
    });
    clause.installmentGroups.forEach(function (group) {
      facts.push({
        id: "fact-" + (facts.length + 1), kind: "repeat", category: "installment",
        eventType: "installment_payment", value: group.count, explicit: true,
        priority: 275, confidence: "high", assertion: "positive", tense: group.completed ? "past" : "future",
        sourceSpan: group.countSpan, clauseId: clause.id, reason: "installment_group_count",
        relation: "repeat", groupId: group.id,
      });
    });
    clause.installmentCadences.forEach(function (cadence) {
      facts.push({
        id: "fact-" + (facts.length + 1), kind: "installment_cadence", category: "installment",
        eventType: "installment_payment", value: cadence.intervalAmount, explicit: true,
        priority: 286, confidence: cadence.conflict ? "medium" : "high", assertion: cadence.conflict ? "conflict" : "positive", tense: "past",
        sourceSpan: cadence.sourceSpan, clauseId: clause.id, reason: cadence.reason,
        relation: cadence.relation, groupId: cadence.groupId, expectedCount: cadence.expectedRelationCount,
        periodCount: cadence.periodCount, installmentCount: cadence.installmentCount, conflict: cadence.conflict,
      });
    });
    clause.dateRelations.forEach(function (relation) {
      facts.push({
        id: "fact-" + (facts.length + 1), kind: "date_relation",
        category: relation.fatherCategory || (clause.fatherCategories.length === 1 ? clause.fatherCategories[0] : null),
        eventType: relation.eventType || (clause.eventTypes.length === 1 ? clause.eventTypes[0] : null),
        assertion: relation.assertion || "positive",
        value: relation.amount, explicit: true, priority: 285, confidence: "high",
        sourceSpan: relation.sourceSpan, clauseId: clause.id, reason: relation.reason,
        relation: relation, groupId: relation.groupId || null,
      });
    });
  });
  var contract = {
    version: 26, textLength: segmented.text.length, clauses: segmented.clauses,
    facts: facts, fatherCategories: Array.from(new Set(facts.filter(function (fact) { return fact.kind === "category" && fact.assertion === "positive"; }).map(function (fact) { return fact.category; }))),
    installmentGroups: segmented.installmentGroups, dateRelations: segmented.dateRelations, installmentCadences: segmented.installmentCadences,
    invariants: Object.freeze(["all_nonempty_source_spans_preserved", "all_father_signals_discovered", "temporal_father_leads_start_clauses", "named_day_event_transitions_preserve_prior_narrative", "modal_temporal_facts_are_non_executed", "collection_actions_are_independent_events", "collection_outcomes_require_prior_completed_payment_or_collection_action", "numbers_bound_inside_clause", "temporal_counts_never_money", "relative_dates_keep_explicit_anchor", "relative_amounts_keep_explicit_anchor", "installment_cadence_chains_previous_events", "non_money_numbers_never_reduce_balance", "explicit_installment_counts_preserved", "repeated_groups_preserved", "canonical_model_values_require_exact_evidence", "explicit_over_inferred", "future_not_occurred", "ledger_never_negative"]),
  };
  factContractCache.set(normalized, contract);
  if (factContractCache.size > FACT_CONTRACT_CACHE_LIMIT) factContractCache.delete(factContractCache.keys().next().value);
  return contract;
}

function withSemanticPlan(contract, links) {
  contract = contract && typeof contract === "object" ? contract : { clauses: [], facts: [], fatherCategories: [] };
  var clauses = (contract.clauses || []).map(function (clause) {
    return Object.assign({}, clause, {
      fatherCategories: (clause.fatherCategories || []).slice(),
      eventTypes: (clause.eventTypes || []).slice(),
      signals: (clause.signals || []).slice(),
      values: (clause.values || []).slice(),
      dateRelations: (clause.dateRelations || []).slice(),
    });
  });
  var facts = (contract.facts || []).slice();
  var seen = new Set(facts.filter(function (fact) {
    return fact && fact.kind === "category" && fact.assertion === "positive";
  }).map(function (fact) { return fact.clauseId + ":" + fact.eventType; }));
  (Array.isArray(links) ? links : []).forEach(function (link) {
    var clause = clauses.find(function (item) { return item && item.id === (link && link.clauseId); });
    var eventType = link && link.eventType;
    if (!clause || !eventType) return;
    var key = clause.id + ":" + eventType;
    if (seen.has(key)) return;
    seen.add(key);
    var father = EVENT_TO_FATHER[eventType] || "custom";
    if (!clause.eventTypes.includes(eventType)) clause.eventTypes.push(eventType);
    if (!clause.fatherCategories.includes(father)) clause.fatherCategories.push(father);
    clause.signals.push({
      id: "signal-semantic-" + clause.id + "-" + eventType,
      fatherCategory: father,
      eventType: eventType,
      value: true,
      explicit: false,
      priority: 180,
      confidence: "model",
      assertion: "positive",
      tense: null,
      evidence: clause.span || null,
      reason: "luna_semantic_classification",
    });
    facts.push({
      id: "fact-semantic-" + clause.id + "-" + eventType,
      kind: "category",
      category: father,
      eventType: eventType,
      value: true,
      explicit: false,
      priority: 180,
      confidence: "model",
      assertion: "positive",
      tense: null,
      sourceSpan: clause.span || null,
      clauseId: clause.id,
      reason: "luna_semantic_classification",
    });
  });
  return Object.assign({}, contract, {
    clauses: clauses,
    facts: facts,
    fatherCategories: Array.from(new Set(facts.filter(function (fact) {
      return fact && fact.kind === "category" && fact.assertion === "positive";
    }).map(function (fact) { return fact.category; }))),
    semanticPlanApplied: true,
  });
}

module.exports = {
  FATHER_ONTOLOGY: FATHER_ONTOLOGY,
  EVENT_TO_FATHER: EVENT_TO_FATHER,
  discoverSignals: discoverSignals,
  segmentClauses: segmentClauses,
  buildFactContract: buildFactContract,
  withSemanticPlan: withSemanticPlan,
  normalizeText: normalizeText,
  hasClearRemainingConclusion: hasClearRemainingConclusion,
  clearPaymentStopConclusions: clearPaymentStopConclusions,
  unfulfilledPromiseConclusions: unfulfilledPromiseConclusions,
  collectionNonpaymentConclusions: collectionNonpaymentConclusions,
  contactEndedConclusions: contactEndedConclusions,
  hasContactEndedConclusion: hasContactEndedConclusion,
};
