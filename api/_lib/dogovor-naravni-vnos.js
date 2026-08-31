"use strict";

/*
 * ATENA v7 — TRAJNI DOGOVORNI VZOREC
 *
 * Luna je prvi in edini semantični razlagalec surovega uporabnikovega vnosa.
 * Ta modul pred Lunino odločitvijo ne izvaja regex/fact parserja in po njej
 * ne popravlja tipa, zneska, datuma ali kanala. Lokalna odgovornost je samo:
 * zaprt katalog/schema, preslikava dovoljenih polj, ledger učinek 0 in
 * obvezen človeški pregled. Ob nedosegljivi ali strukturno neveljavni Luni
 * tok varno odpove; nikoli ne ugiba z lokalnim semantičnim fallbackom.
 *
 * Tega enginea ne združuj z zgodovinskim tokom. Prihodnja obljuba ni izvedeno
 * plačilo: promisedDate je prihodnji rok, occurredDate pa le izrecni datum
 * sklenitve dogovora. Neznani datum/rok/kanal ostanejo reviewable neznanke.
 */

var crypto = require("node:crypto");
var catalogContract = require("./atena-luna-catalog-contract");
var lunaPolicy = require("./atena-luna-policy");

var MODEL = lunaPolicy.MODEL;
var MODEL_TIMEOUT_MS = lunaPolicy.MODEL_TIMEOUT_MS;
var MODEL_TIMEOUT_MAX_MS = lunaPolicy.MODEL_TIMEOUT_MAX_MS;
var ATENA_ENGINE_VERSION = "atena-v7";
var CONTRACT_VERSION = "agreement-fact-v7";
var MAX_TEXT_LENGTH = lunaPolicy.MAX_SOURCE_TEXT_LENGTH;
var MAX_CLARIFICATION_ANSWER_LENGTH = lunaPolicy.MAX_CLARIFICATION_ANSWER_LENGTH;
var MAX_CLARIFICATION_ROUNDS = lunaPolicy.MAX_CLARIFICATION_ROUNDS;

var AGREEMENT_CATALOG = [
  { id: 1, type: "payment_promise", semanticRule: "A future promise to pay one amount or the full remaining debt. amount is the promised amount; promisedDate is its future deadline.", fields: ["amount", "occurredDate", "promisedDate", "communicationChannel"] },
  { id: 2, type: "installment_agreement", semanticRule: "An accepted future installment plan. amount is the amount of ONE installment, not the sum of all installments; promisedDate is the first installment date.", fields: ["amount", "occurredDate", "promisedDate", "communicationChannel", "description"] },
  { id: 3, type: "deadline_extension", semanticRule: "An accepted or requested new payment deadline without a promised payment amount. amount must be null; promisedDate is the new requested or accepted deadline.", fields: ["occurredDate", "promisedDate", "communicationChannel", "description"] },
  { id: 4, type: "invoice_dispute", semanticRule: "A dispute, objection, or complaint about the invoice. amount and promisedDate are null unless the source separately states them.", fields: ["occurredDate", "communicationChannel", "description"] },
  { id: 5, type: "debtor_statement", semanticRule: "A refusal to pay or another debtor statement that is not a positive payment promise. amount and promisedDate are null unless independently stated.", fields: ["occurredDate", "communicationChannel", "description"] },
  { id: 6, type: "custom", semanticRule: "Only for a future agreement that genuinely fits none of the defined cards.", fields: ["occurredDate", "description"] },
];
var AGREEMENT_FIELD_IDS = Object.freeze({ amount: 1, occurredDate: 2, promisedDate: 3, communicationChannel: 4, description: 5 });
var AGREEMENT_FIELDS = Object.freeze([
  [1, "amount", "promised EUR amount; on installment_agreement this is one installment"],
  [2, "occurredDate", "date the agreement or statement itself was made, never the future payment deadline"],
  [3, "promisedDate", "future promised payment date, first installment date, or extended deadline"],
  [4, "communicationChannel", "channel through which the agreement or statement was made"],
  [5, "description", "material agreement, dispute, refusal, or other future-oriented detail"],
]);
var AGREEMENT_VALUES = Object.freeze([
  [401, 4, "phone", "telefon"], [402, 4, "email", "e-pošta"], [403, 4, "message", "sporočilo"],
  [404, 4, "in_person", "osebno"], [405, 4, "letter", "pismo"], [406, 4, "unknown", "neznano"],
]);
var AGREEMENT_CARD_CONTEXT = Object.freeze({
  payment_promise: { title: "Future payment promise", useWhen: "The debtor positively promises one future payment amount or all remaining debt, with or without a known deadline.", doNotUseWhen: "Not for completed payment, refusal, dispute, installments, or a deadline-only request without a payment promise.", examples: ["he will pay everything in three months", "he promised 100 euros Friday"] },
  installment_agreement: { title: "Accepted installment agreement", useWhen: "The parties accepted a future plan with two or more installments; amount means one installment and promisedDate means the first installment.", doNotUseWhen: "Not for historical installments already paid, a single payment promise, or a mere proposed deadline.", examples: ["we agreed on four monthly installments", "he accepted 100 every Friday"] },
  deadline_extension: { title: "Deadline extension", useWhen: "A new payment deadline was requested or accepted without a distinct promised payment amount.", doNotUseWhen: "Not when the debtor positively promises a stated amount or an installment plan.", examples: ["we extended his deadline to October", "he asked for another week"] },
  invoice_dispute: { title: "Invoice dispute", useWhen: "The debtor objects to quality, quantity, contract, invoice contents, entitlement, or another basis of the receivable.", doNotUseWhen: "Not for inability or refusal to pay without disputing the invoice.", examples: ["he disputes the billed quantity", "he says the work was defective"] },
  debtor_statement: { title: "Debtor statement or refusal", useWhen: "The debtor refuses payment, says they cannot or will not pay, or makes another relevant statement that is not a positive promise.", doNotUseWhen: "Not for a positive future promise or a substantive invoice dispute.", examples: ["he said he will not pay", "he currently cannot pay"] },
  custom: { title: "Other agreement", useWhen: "Only after every specialized agreement card was considered and none fits.", doNotUseWhen: "Never for a payment promise, installment agreement, deadline extension, invoice dispute, or debtor refusal/statement.", examples: ["another genuinely unsupported future agreement"] },
});
var AGREEMENT_GUIDE = catalogContract.buildCardGuide(AGREEMENT_CATALOG.map(function (card) {
  var context = AGREEMENT_CARD_CONTEXT[card.type];
  return { cardId: card.id, key: card.type, title: context.title, purpose: card.semanticRule, useWhen: context.useWhen, doNotUseWhen: context.doNotUseWhen, examples: context.examples, fieldIds: card.fields.map(function (field) { return AGREEMENT_FIELD_IDS[field]; }), requiredFieldIds: [] };
}), AGREEMENT_FIELDS, AGREEMENT_VALUES, { flow: "agreement" });

var RESPONSE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["agreements", "question", "evidence"],
  properties: {
    agreements: { type: "array", maxItems: lunaPolicy.MAX_STRUCTURED_ITEMS, items: {
      type: "object", additionalProperties: false, required: ["cardId", "amount", "occurredDate", "promisedDate", "communicationChannel", "description", "evidence"],
      properties: {
        cardId: { type: "integer", enum: AGREEMENT_CATALOG.map(function (item) { return item.id; }) },
        amount: { anyOf: [{ type: "number" }, { type: "null" }] },
        occurredDate: { anyOf: [{ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, { type: "null" }] },
        promisedDate: { anyOf: [{ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, { type: "null" }] },
        communicationChannel: { anyOf: [{ type: "string", enum: ["phone", "email", "message", "in_person", "letter", "unknown"] }, { type: "null" }] },
        description: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] },
        evidence: { type: "string", maxLength: 500 },
      },
    } },
    question: { anyOf: [{ type: "string", maxLength: 180 }, { type: "null" }] },
    evidence: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] },
  },
};
lunaPolicy.assertPortableResponseSchema(RESPONSE_SCHEMA);

function trimText(value, max) { return String(value == null ? "" : value).trim().slice(0, max); }
function positiveAmount(value) {
  var number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null;
}
function validIsoDate(value) {
  var text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  var date = new Date(text + "T12:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
}
function safetyIdentifier(userId) {
  return "agreement-" + crypto.createHash("sha256").update(String(userId || "anonymous")).digest("hex").slice(0, 32);
}
function wholeSpan(source) { return { start: 0, end: String(source || "").length, text: String(source || "") }; }
function requestBody(text, context, userId) {
  var body = Object.assign(lunaPolicy.requestDefaults(), {
    safety_identifier: safetyIdentifier(userId),
    instructions: "You are Luna, the sole semantic interpreter for Atena's FUTURE DEBTOR AGREEMENT flow. Read the complete Slovenian source and clarification, determine its meaning, and return only cards from the supplied agreement catalog. Follow each catalog item's semanticRule exactly. The local adapter only maps your catalog IDs and validates structure; it never reinterprets, corrects, or replaces your semantic decisions. A promise of future payment is payment_promise, never completed payment. 'Cel dolg', 'vse' or 'ves preostanek' means the supplied remaining debt. For installment_agreement, amount is always one installment and promisedDate is the first installment deadline. For deadline_extension, amount is null and promisedDate is the requested or accepted new deadline. For invoice_dispute and debtor_statement, amount and promisedDate are normally null. Resolve relative dates from referenceDate, including inflected forms such as 'po 3h mesecih'. occurredDate is only the explicitly stated date when the agreement was made; never copy a future deadline into occurredDate. If date, deadline, or channel is unknown, return null or unknown and still produce a reviewable card. A clarification answer such as 'ne' or 'ne vem' means the missing details stay unknown: do not repeat the same scheduling question. Ask a question only when the agreement category or essential meaning truly cannot be determined. Negated promises are not payment_promise. Never claim a ledger effect; every agreement card has zero ledger effect. Return only the strict JSON schema.",
    input: JSON.stringify({ contractVersion: CONTRACT_VERSION, sourceText: trimText(text, MAX_TEXT_LENGTH), referenceDate: validIsoDate(context && context.referenceDate), debtEur: { original: positiveAmount(context && context.originalDebt), remaining: positiveAmount(context && context.remainingDebt) }, catalog: { lexiconVersion: catalogContract.LEXICON_VERSION, languagePolicy: catalogContract.languagePolicy(), cards: AGREEMENT_CATALOG, fields: AGREEMENT_FIELDS, values: AGREEMENT_VALUES, guide: AGREEMENT_GUIDE }, clarification: context && context.clarification || null }),
    text: { format: { type: "json_schema", name: "future_agreement_proposal_v7", strict: true, schema: RESPONSE_SCHEMA } },
  });
  body.instructions = "HARD COMPLETE-CATALOG ORDER: FIRST read every entry in catalog.guide, including useWhen, doNotUseWhen, examples, languageProfile, numeric cardId, field IDs and allowed value IDs. Choose and return cardId yourself; never return a free-form card type. " + catalogContract.semanticInstructions() + " " + lunaPolicy.semanticAuthorityInstructions() + " HARD OUTPUT INVARIANTS: never return agreements and question together. Every agreement evidence must be a non-empty exact contiguous quote copied verbatim from sourceText. For a clarification, top-level evidence must be such a quote. " + body.instructions + " The local adapter maps that numeric cardId to the existing card and does not make or correct a semantic choice.";
  return body;
}
function responseText(payload) {
  return lunaPolicy.responseText(payload);
}
function materializeLunaProposal(proposal, context, source) {
  lunaPolicy.assertAdapterOperations(["schema_validation", "catalog_id_mapping", "ledger_application", "human_review_projection"]);
  if (!lunaPolicy.hasExactKeys(proposal, ["agreements", "question", "evidence"]) || !Array.isArray(proposal.agreements) ||
      proposal.agreements.length < 1 || proposal.agreements.length > lunaPolicy.MAX_STRUCTURED_ITEMS || proposal.question !== null ||
      !(proposal.evidence === null || (typeof proposal.evidence === "string" && proposal.evidence.length <= 500 && lunaPolicy.evidenceIsLinked(source, proposal.evidence)))) return null;
  var initialDebt = positiveAmount(context && context.remainingDebt) || positiveAmount(context && context.originalDebt) || 0;
  var allowedChannels = ["phone", "email", "message", "in_person", "letter", "unknown"];
  var candidates = [];
  for (var index = 0; index < proposal.agreements.length; index += 1) {
    var item = proposal.agreements[index];
    var catalogItem = item && AGREEMENT_CATALOG.find(function (card) { return card.id === item.cardId; });
    if (!lunaPolicy.hasExactKeys(item, ["cardId", "amount", "occurredDate", "promisedDate", "communicationChannel", "description", "evidence"]) ||
        !catalogItem || typeof item.evidence !== "string" || item.evidence.length > 500 || !lunaPolicy.evidenceIsLinked(source, item.evidence)) return null;
    var amount = item.amount == null ? null : typeof item.amount === "number" ? positiveAmount(item.amount) : null;
    if (item.amount != null && (amount == null || amount > 1000000000)) return null;
    var occurredDate = item.occurredDate == null ? null : validIsoDate(item.occurredDate);
    var promisedDate = item.promisedDate == null ? null : validIsoDate(item.promisedDate);
    if ((item.occurredDate != null && (typeof item.occurredDate !== "string" || !occurredDate)) ||
        (item.promisedDate != null && (typeof item.promisedDate !== "string" || !promisedDate))) return null;
    var channel = item.communicationChannel == null ? "unknown" : item.communicationChannel;
    if ((item.communicationChannel != null && typeof item.communicationChannel !== "string") || !allowedChannels.includes(channel) ||
        !(item.description === null || (typeof item.description === "string" && item.description.length <= 500))) return null;
    var fields = catalogItem.fields.slice();
    var evidenceSpan = lunaPolicy.exactEvidenceSpan(source, item.evidence);
    candidates.push({
      type: catalogItem.type, cardId: catalogItem.id, amount: amount, currency: "EUR", occurredDate: occurredDate, occurredDateUnknown: !occurredDate,
      occurredDateApproximate: false, occurredDateApproximation: "", promisedDate: promisedDate,
      promisedDateUnknown: !promisedDate, promisedDateApproximate: false, promisedDateApproximation: "",
      paymentMethod: null, communicationChannel: channel, reason: null,
      description: item.description == null ? null : item.description.trim() || null, temporalStatus: "planned", confidence: "high",
      fieldOrder: fields, requiredFields: fields.slice(), missing: [],
      evidence: { clauseId: "clause-" + (index + 1), sourceSpan: evidenceSpan, explicit: false, reason: "luna_agreement_catalog_adapter" },
      requiresHumanReview: true,
    });
  }
  var ledger = candidates.map(function (candidate, candidateIndex) {
    return { candidateIndex: candidateIndex, type: candidate.type, effectEur: 0, remainingDebtEur: initialDebt };
  });
  return {
    summary: "Atena je pripravila dogovor za vaš pregled.", needsClarification: false, clarification: null,
    candidates: candidates, initialDebtEur: initialDebt, projectedRemainingDebtEur: initialDebt,
    questionPlan: candidates.map(function (candidate, candidateIndex) { return { candidateIndex: candidateIndex, fields: candidate.fieldOrder.slice(), missing: [] }; }),
    ledger: ledger, fieldOrder: candidates[0].fieldOrder.slice(), requiredFields: candidates[0].requiredFields.slice(), missing: [],
    coverage: { complete: true, reason: "luna_agreement_catalog_complete", unconsumed: [], unsupportedCandidates: [] },
    enginePath: ["luna_only_semantics", "local_id_mapping_only", "zero_ledger", "human_review"],
  };
}
function clarificationResult(proposal, context, source) {
  var initialDebt = positiveAmount(context && context.remainingDebt) || positiveAmount(context && context.originalDebt) || 0;
  var round = Number(context && context.clarification && context.clarification.round) || 0;
  if (!lunaPolicy.hasExactKeys(proposal, ["agreements", "question", "evidence"]) || !Array.isArray(proposal.agreements) || proposal.agreements.length ||
      typeof proposal.question !== "string" || !proposal.question.trim() || proposal.question.length > 180 || typeof proposal.evidence !== "string" ||
      proposal.evidence.length > 500 || !lunaPolicy.evidenceIsLinked(source, proposal.evidence)) return null;
  var nextRound = round + 1;
  var exhausted = nextRound > MAX_CLARIFICATION_ROUNDS;
  return {
    summary: exhausted ? "Opisa ni bilo mogoče dovolj zanesljivo razumeti. Dogovor dodajte ročno." : "Atena potrebuje kratko pojasnilo.", needsClarification: !exhausted,
    clarification: exhausted ? null : { question: proposal.question.trim(), clauseId: "clause-1", round: nextRound, maxRounds: MAX_CLARIFICATION_ROUNDS },
    clarificationExhausted: exhausted, candidates: [], initialDebtEur: initialDebt,
    projectedRemainingDebtEur: initialDebt, questionPlan: [], ledger: [], fieldOrder: [], requiredFields: [], missing: [],
    coverage: { complete: false, reason: "luna_agreement_clarification", unconsumed: [wholeSpan(source)], unsupportedCandidates: [] },
    enginePath: ["luna_only_semantics", "clarification"],
  };
}
function aiError(message, code) {
  var error = new Error(message); error.code = code; error.status = 503; return error;
}
function tagResult(result, requestJson, payload, attempted, status, reason) {
  return Object.assign({}, result, {
    engineVersion: ATENA_ENGINE_VERSION, contractVersion: CONTRACT_VERSION,
    semanticPlan: { requested: true, attempted: attempted === true, source: "luna_agreement_catalog_adapter", status: status, reason: reason,
      requestBytes: attempted ? Buffer.byteLength(requestJson || "", "utf8") : null,
      transport: attempted && payload && payload._atenaTransport ? payload._atenaTransport : null,
      usage: attempted && payload && payload.usage ? { inputTokens: Number(payload.usage.input_tokens) || 0, outputTokens: Number(payload.usage.output_tokens) || 0, totalTokens: Number(payload.usage.total_tokens) || 0 } : null },
  });
}
async function analyze(text, context, options) {
  context = context || {}; options = options || {};
  var source = trimText(text, MAX_TEXT_LENGTH + 1);
  if (!source || source.length > MAX_TEXT_LENGTH) { var inputError = new Error(source ? "Opis je predolg." : "Vpišite dogovor."); inputError.code = "INVALID_TEXT"; inputError.status = 400; throw inputError; }
  var clarification = context.clarification;
  if (clarification && !lunaPolicy.validClarification(clarification)) {
    var clarificationError = new Error("Vpišite kratek odgovor na vprašanje."); clarificationError.code = "INVALID_CLARIFICATION"; clarificationError.status = 400; throw clarificationError;
  }
  var apiKey = Object.prototype.hasOwnProperty.call(options, "apiKey") ? options.apiKey : process.env.OPENAI_API_KEY;
  if (!apiKey) throw aiError("Luna trenutno ni konfigurirana.", "LUNA_NOT_CONFIGURED");
  var requestJson = JSON.stringify(requestBody(source, context, options.userId));
  var payload = null;
  try {
    var transport = await lunaPolicy.requestOpenAi({ apiKey: apiKey, body: requestJson, fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs, maxAttempts: options.maxAttempts, sleepImpl: options.sleepImpl, randomImpl: options.randomImpl });
    payload = transport.payload && typeof transport.payload === "object" ? transport.payload : {};
    payload._atenaTransport = { attempts: transport.attempts, elapsedMs: transport.elapsedMs };
    var proposal;
    try { proposal = JSON.parse(responseText(payload)); } catch (_error) { proposal = null; }
    var result = materializeLunaProposal(proposal, context, source) || clarificationResult(proposal, context, source);
    if (!result) throw aiError("Lunin odgovor ni skladen z dogovornim katalogom.", "LUNA_INVALID_AGREEMENT_PLAN");
    var status = result.clarificationExhausted ? "CLARIFICATION_EXHAUSTED" : result.needsClarification ? "CLARIFICATION_REQUIRED" : "OK";
    var reason = result.clarificationExhausted ? "luna_agreement_clarification_exhausted" : result.needsClarification ? "luna_agreement_clarification" : "luna_agreement_plan_applied";
    return tagResult(result, requestJson, payload, true, status, reason);
  } catch (error) {
    if (error && error.status) throw error;
    throw aiError("Luna trenutno ni dosegljiva.", "LUNA_UNAVAILABLE");
  }
}

module.exports = {
  analyze: analyze, requestBody: requestBody,
  ATENA_ENGINE_VERSION: ATENA_ENGINE_VERSION, CONTRACT_VERSION: CONTRACT_VERSION, MODEL: MODEL,
  MODEL_TIMEOUT_MS: MODEL_TIMEOUT_MS, MODEL_TIMEOUT_MAX_MS: MODEL_TIMEOUT_MAX_MS,
  MAX_TEXT_LENGTH: MAX_TEXT_LENGTH, MAX_CLARIFICATION_ANSWER_LENGTH: MAX_CLARIFICATION_ANSWER_LENGTH,
  MAX_CLARIFICATION_ROUNDS: MAX_CLARIFICATION_ROUNDS, RESPONSE_SCHEMA: RESPONSE_SCHEMA,
  _test: { materializeLunaProposal: materializeLunaProposal, clarificationResult: clarificationResult },
};
