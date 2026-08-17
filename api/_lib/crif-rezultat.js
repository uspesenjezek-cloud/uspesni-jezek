"use strict";

var RESULT_STATES = new Set(["completed", "insufficient", "error"]);
var IDENTITY_STATES = new Set(["matched", "partial", "unmatched", "unknown"]);
var DECISIONS = new Set(["approve", "review", "decline"]);

function text(value, max) { return String(value == null ? "" : value).trim().slice(0, max || 500); }
function finite(value, min, max) { var number = Number(value); return Number.isFinite(number) && number >= min && number <= max ? number : null; }
function iso(value) { var date = new Date(value); return value && !Number.isNaN(date.getTime()) ? date.toISOString() : null; }
function textList(value, maxItems, maxLength) { return (Array.isArray(value) ? value : []).slice(0, maxItems).map(function (item) { return text(item, maxLength); }).filter(Boolean); }
function rows(value) {
  return (Array.isArray(value) ? value : []).slice(0, 20).map(function (row) {
    var source = row && typeof row === "object" ? row : {};
    return { label: text(source.label, 120), value: text(source.value, 160), note: text(source.note, 300), date: text(source.date, 30), source: text(source.source, 120) };
  }).filter(function (row) { return row.label && row.value; });
}

function normalize(input) {
  var source = input && typeof input === "object" ? input : {};
  var state = text(source.state || source.status, 30).toLowerCase();
  if (!RESULT_STATES.has(state)) throw Object.assign(new Error("CRIF odgovor nima veljavnega stanja."), { status: 400, code: "CRIF_RESULT_INVALID" });
  var identitySource = source.identity && typeof source.identity === "object" ? source.identity : {};
  var identityStatus = text(identitySource.status, 30).toLowerCase();
  if (!IDENTITY_STATES.has(identityStatus)) identityStatus = "unknown";
  var result = {
    schemaVersion: 1,
    state: state,
    checkedAt: iso(source.checkedAt) || new Date().toISOString(),
    rating: { grade: text(source.rating && source.rating.grade, 40), label: text(source.rating && source.rating.label, 160) },
    probabilityOfDefault: { percent: finite(source.probabilityOfDefault && source.probabilityOfDefault.percent, 0, 100), periodMonths: finite(source.probabilityOfDefault && source.probabilityOfDefault.periodMonths, 1, 120), model: text(source.probabilityOfDefault && source.probabilityOfDefault.model, 120) },
    recommendedLimitCents: finite(source.recommendedLimitCents, 0, 100000000000),
    identity: { status: identityStatus, label: text(identitySource.label, 160), matchedFields: textList(identitySource.matchedFields, 12, 80), differences: textList(identitySource.differences, 12, 160) },
    factors: { positive: textList(source.factors && source.factors.positive, 12, 240), warning: textList(source.factors && source.factors.warning, 12, 240) },
    financialSummary: rows(source.financialSummary), paymentExperiences: rows(source.paymentExperiences), negativeEvents: rows(source.negativeEvents),
    monitoring: { status: text(source.monitoring && source.monitoring.status, 40), lastCheckedAt: iso(source.monitoring && source.monitoring.lastCheckedAt), nextCheckAt: iso(source.monitoring && source.monitoring.nextCheckAt), alerts: textList(source.monitoring && source.monitoring.alerts, 20, 240) },
    report: { available: Boolean(source.report && source.report.available), documentId: text(source.report && source.report.documentId, 200), filename: text(source.report && source.report.filename, 160), mimeType: text(source.report && source.report.mimeType, 80) },
    insufficientReason: text(source.insufficientReason, 500), errorCode: text(source.errorCode, 80), errorMessage: text(source.errorMessage, 500),
  };
  if (state === "completed" && !result.rating.grade && result.probabilityOfDefault.percent == null && result.recommendedLimitCents == null) {
    throw Object.assign(new Error("Zaključen CRIF odgovor ne vsebuje nobenega glavnega kazalnika."), { status: 400, code: "CRIF_RESULT_EMPTY" });
  }
  if (state === "insufficient" && !result.insufficientReason) result.insufficientReason = "Ponudnik ni vrnil dovolj podatkov za zanesljivo oceno.";
  if (state === "error" && !result.errorMessage) result.errorMessage = "Poizvedbe ni bilo mogoče dokončati.";
  if (!result.report.documentId) result.report.available = false;
  return result;
}

function decision(input) {
  var source = input && typeof input === "object" ? input : {}, value = text(source.decision, 30), reason = text(source.reason, 1200);
  if (!DECISIONS.has(value)) throw Object.assign(new Error("Izberite veljavno končno odločitev."), { status: 400 });
  if (reason.length < 10) throw Object.assign(new Error("Na kratko pojasnite končno odločitev."), { status: 400 });
  return { decision: value, reason: reason };
}

function dispute(input) {
  var reason = text(input && input.reason, 1600);
  if (reason.length < 20) throw Object.assign(new Error("Opišite, kateri podatek je napačen ali zahteva človeški pregled."), { status: 400 });
  return { reason: reason };
}

module.exports = { normalize: normalize, decision: decision, dispute: dispute, RESULT_STATES: RESULT_STATES, DECISIONS: DECISIONS, _test: { rows: rows, finite: finite } };
