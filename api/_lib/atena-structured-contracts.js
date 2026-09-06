"use strict";

var crypto = require("node:crypto");
var z = require("zod").z;

var CONTRACT_VERSION = "atena-structured-contracts-v1";
var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function sha256(value) {
  return crypto.createHash("sha256").update(String(value == null ? "" : value)).digest("hex");
}

function compactJsonSchema(value) {
  if (Array.isArray(value)) return value.map(compactJsonSchema);
  if (!value || typeof value !== "object") return value;
  var result = {};
  Object.keys(value).forEach(function (key) { result[key] = compactJsonSchema(value[key]); });
  if (Array.isArray(result.anyOf) && result.anyOf.length > 0 && result.anyOf.every(function (entry) {
    return entry && typeof entry === "object" && Object.keys(entry).length === 2 && entry.type === result.anyOf[0].type && Object.prototype.hasOwnProperty.call(entry, "const");
  })) return { type: result.anyOf[0].type, enum: result.anyOf.map(function (entry) { return entry.const; }) };
  return result;
}

function validIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  var date = new Date(value + "T12:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function literalUnion(values, label) {
  var unique = Array.from(new Set(values || []));
  if (!unique.length) throw new Error((label || "Contract") + " potrebuje najmanj eno dovoljeno vrednost.");
  return unique.length === 1 ? z.literal(unique[0]) : z.union(unique.map(function (value) { return z.literal(value); }));
}

var ISO_DATE_SCHEMA = z.string().regex(ISO_DATE).refine(validIsoDate, "Datum mora biti veljaven ISO datum.");
var SOURCE_SPAN_SCHEMA = z.object({
  start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().min(1),
}).strict().superRefine(function (span, context) {
  if (span.end <= span.start || span.end - span.start !== span.text.length) context.addIssue({ code: "custom", message: "Odmik dokaza se ne ujema z dolžino besedila." });
});
var DOCUMENT_SCHEMA = z.object({
  contractVersion: z.literal(CONTRACT_VERSION), documentId: z.string().regex(/^document-[a-f0-9]{16}$/),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/), normalizedText: z.string(),
}).strict();
var CLAUSE_SCHEMA = z.object({
  contractVersion: z.literal(CONTRACT_VERSION), documentId: z.string().regex(/^document-[a-f0-9]{16}$/),
  clauseId: z.string().regex(/^clause-[a-z0-9-]+$/), start: z.number().int().nonnegative(), end: z.number().int().positive(),
  text: z.string().min(1), sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
var EVIDENCE_SPAN_SCHEMA = z.object({
  contractVersion: z.literal(CONTRACT_VERSION), documentId: z.string().regex(/^document-[a-f0-9]{16}$/),
  clauseId: z.string().regex(/^clause-[a-z0-9-]+$/), start: z.number().int().nonnegative(), end: z.number().int().positive(),
  quote: z.string().min(1).max(500), sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().superRefine(function (span, context) {
  if (span.end <= span.start || span.end - span.start !== span.quote.length) context.addIssue({ code: "custom", message: "Odmik dokaza se ne ujema z dolžino citata." });
});

function agreementProposalSchema(cardIds, maxItems, ambiguityCodes) {
  var ids = Array.from(new Set((cardIds || []).filter(Number.isInteger)));
  if (!ids.length) throw new Error("Dogovorni contract potrebuje najmanj en cardId.");
  var cardIdSchema = z.union(ids.map(function (id) { return z.literal(id); }));
  var codes = Array.from(new Set((ambiguityCodes || []).filter(function (code) { return typeof code === "string" && code; })));
  var questionSchema = codes.length ? z.union(codes.map(function (code) { return z.literal(code); })) : z.string().min(1).max(180);
  var itemSchema = z.object({
    cardId: cardIdSchema, amount: z.number().nullable(), occurredDate: ISO_DATE_SCHEMA.nullable(),
    promisedDate: ISO_DATE_SCHEMA.nullable(), communicationChannel: z.enum(["phone", "email", "message", "in_person", "letter", "unknown"]).nullable(),
    description: z.string().max(500).nullable(), evidence: z.string().min(1).max(500),
  }).strict();
  return z.object({
    agreements: z.array(itemSchema).max(Number(maxItems) || 50), question: questionSchema.nullable(),
    evidence: z.string().min(1).max(500).nullable(),
  }).strict().superRefine(function (proposal, context) {
    var hasPlan = proposal.agreements.length > 0, hasQuestion = proposal.question !== null;
    if (hasPlan === hasQuestion) context.addIssue({ code: "custom", message: "Rezultat mora vsebovati dogovor ali vprašanje, nikoli obojega." });
    if (hasPlan && proposal.evidence !== null) context.addIssue({ code: "custom", path: ["evidence"], message: "Plan ne uporablja vrhnjega dokaza." });
    if (hasQuestion && proposal.evidence === null) context.addIssue({ code: "custom", path: ["evidence"], message: "Vprašanje potrebuje dokaz." });
  });
}

function advisorBlockPlanSchema(actionCodes, profileIds, blockCodes) {
  var actionSchema = z.union(Array.from(new Set(actionCodes || [])).map(function (code) { return z.literal(code); }));
  var profileSchema = z.union(Array.from(new Set(profileIds || [])).map(function (id) { return z.literal(id); }));
  var blockSchema = z.union(Array.from(new Set(blockCodes || [])).map(function (code) { return z.literal(code); }));
  return z.object({
    state: z.enum(["ask", "review"]), actionCode: actionSchema, profileId: profileSchema.nullable(),
    batchTitle: z.string().min(3).max(100), rationale: z.string().min(3).max(240),
    evidence: z.string().min(1).max(180), blockCodes: z.array(blockSchema).max(4),
  }).strict().superRefine(function (plan, context) {
    if (new Set(plan.blockCodes).size !== plan.blockCodes.length) context.addIssue({ code: "custom", path: ["blockCodes"], message: "Block codes se ne smejo podvajati." });
    if (plan.state === "ask" && (!plan.profileId || plan.blockCodes.length < 1)) context.addIssue({ code: "custom", message: "Ask plan potrebuje profil in najmanj en block code." });
    if (plan.state === "review" && plan.blockCodes.length !== 0) context.addIssue({ code: "custom", path: ["blockCodes"], message: "Review plan ne sme vsebovati block codes." });
  });
}

function historyProposalSchema(cardIds, fieldIds, maxItems) {
  var cardValues = Array.from(new Set((cardIds || []).filter(Number.isInteger))).sort(function (left, right) { return left - right; });
  var fieldValues = Array.from(new Set((fieldIds || []).filter(Number.isInteger))).sort(function (left, right) { return left - right; });
  if (!cardValues.length || !fieldValues.length) throw new Error("History contract potrebuje zaprte card in field ID-je.");
  var cardSet = new Set(cardValues), fieldSet = new Set(fieldValues);
  var cardIdSchema = z.number().int().min(cardValues[0]).max(cardValues[cardValues.length - 1]).refine(function (value) { return cardSet.has(value); }, "Neveljaven history cardId.");
  var fieldIdSchema = z.number().int().min(fieldValues[0]).max(fieldValues[fieldValues.length - 1]).refine(function (value) { return fieldSet.has(value); }, "Neveljaven history fieldId.");
  var valueSchema = z.union([z.number(), z.string().max(500), z.null()]);
  var relationSchema = z.array(z.union([z.number().int(), z.null()])).max(7);
  var itemSchema = z.object({
    c: cardIdSchema, e: z.string().min(1).max(500), i: z.array(fieldIdSchema).max(8),
    v: z.array(valueSchema).max(8), x: z.array(z.string().min(1).max(500)).max(8),
    r: z.array(relationSchema).max(8),
  }).strict().superRefine(function (item, context) {
    var length = item.i.length;
    if (item.v.length !== length || item.x.length !== length || item.r.length !== length) context.addIssue({ code: "custom", message: "History field stolpci morajo imeti enako dolžino." });
    if (new Set(item.i).size !== length) context.addIssue({ code: "custom", path: ["i"], message: "History field ID-ji se ne smejo podvajati." });
  });
  return z.object({
    p: z.array(itemSchema).max(Number(maxItems) || 50), q: z.string().min(1).max(180).nullable(),
    x: z.string().min(1).max(500).nullable(), k: z.union([z.literal(1), z.literal(2), z.null()]),
  }).strict().superRefine(function (proposal, context) {
    var hasPlan = proposal.p.length > 0, hasQuestion = proposal.q !== null;
    if (hasPlan && (hasQuestion || proposal.x !== null || proposal.k !== null)) context.addIssue({ code: "custom", message: "History plan ne sme vsebovati vprašanja ali opozorila." });
    if (!hasPlan && (!hasQuestion || proposal.x === null || (proposal.k !== 1 && proposal.k !== 2))) context.addIssue({ code: "custom", message: "Prazen history plan potrebuje vprašanje ali opozorilo z dokazom." });
  });
}

function goalProposalSchema(cardIds, fieldIds, valueIds, maxItems) {
  var evidenceReference = z.string().regex(/^@[1-9][0-9]*:[1-9][0-9]*$/).max(40);
  var cardIdSchema = literalUnion((cardIds || []).filter(Number.isInteger), "Goal card contract");
  var fieldIdSchema = literalUnion((fieldIds || []).filter(Number.isInteger), "Goal field contract");
  var valueIdSchema = literalUnion((valueIds || []).filter(Number.isInteger), "Goal value contract");
  var fieldSchema = z.object({
    i: fieldIdSchema, v: z.string().max(500).nullable(), o: valueIdSchema.nullable(),
    e: z.union([evidenceReference, z.literal("")]),
  }).strict();
  var itemSchema = z.object({
    n: z.number().int().min(1).max(Number(maxItems) || 50), c: cardIdSchema,
    k: z.union([z.literal(1), z.literal(2), z.literal(3)]), f: z.array(fieldSchema).max(8), e: evidenceReference,
  }).strict().superRefine(function (item, context) {
    var fieldIdsSeen = item.f.map(function (field) { return field.i; });
    if (new Set(fieldIdsSeen).size !== fieldIdsSeen.length) context.addIssue({ code: "custom", path: ["f"], message: "Goal field ID-ji se ne smejo podvajati." });
  });
  return z.object({
    p: z.array(itemSchema).max(Number(maxItems) || 50), q: z.string().min(1).max(240).nullable(), x: evidenceReference,
  }).strict().superRefine(function (proposal, context) {
    var hasPlan = proposal.p.length > 0, hasQuestion = proposal.q !== null;
    if (hasPlan === hasQuestion) context.addIssue({ code: "custom", message: "Goal rezultat mora vsebovati plan ali vprašanje, nikoli obojega." });
  });
}

function createDocument(sourceText) {
  var normalizedText = String(sourceText == null ? "" : sourceText), sourceHash = sha256(normalizedText);
  return Object.freeze(DOCUMENT_SCHEMA.parse({ contractVersion: CONTRACT_VERSION, documentId: "document-" + sourceHash.slice(0, 16), sourceHash: sourceHash, normalizedText: normalizedText }));
}

function createClause(document, clauseId, start, end) {
  document = DOCUMENT_SCHEMA.parse(document);
  var text = document.normalizedText.slice(start, end);
  if (!text || start < 0 || end > document.normalizedText.length) return null;
  return Object.freeze(CLAUSE_SCHEMA.parse({ contractVersion: CONTRACT_VERSION, documentId: document.documentId, clauseId: clauseId, start: start, end: end, text: text, sourceHash: document.sourceHash }));
}

function createEvidenceSpan(document, quote, clauseId, startHint) {
  var parsed = DOCUMENT_SCHEMA.safeParse(document);
  if (!parsed.success || typeof quote !== "string" || !quote.trim()) return null;
  document = parsed.data;
  var start = Number.isInteger(startHint) && document.normalizedText.slice(startHint, startHint + quote.length) === quote ? startHint : document.normalizedText.indexOf(quote);
  if (start < 0) return null;
  return Object.freeze(EVIDENCE_SPAN_SCHEMA.parse({ contractVersion: CONTRACT_VERSION, documentId: document.documentId, clauseId: clauseId, start: start, end: start + quote.length, quote: quote, sourceHash: document.sourceHash }));
}

function verifyEvidenceSpan(document, span) {
  var parsedDocument = DOCUMENT_SCHEMA.safeParse(document), parsedSpan = EVIDENCE_SPAN_SCHEMA.safeParse(span);
  if (!parsedDocument.success || !parsedSpan.success) return false;
  document = parsedDocument.data; span = parsedSpan.data;
  return span.documentId === document.documentId && span.sourceHash === document.sourceHash && span.end <= document.normalizedText.length && document.normalizedText.slice(span.start, span.end) === span.quote;
}

function legacySourceSpan(span) {
  return span ? SOURCE_SPAN_SCHEMA.parse({ start: span.start, end: span.end, text: span.quote }) : null;
}

module.exports = Object.freeze({
  CONTRACT_VERSION: CONTRACT_VERSION, ISO_DATE_SCHEMA: ISO_DATE_SCHEMA, SOURCE_SPAN_SCHEMA: SOURCE_SPAN_SCHEMA,
  DOCUMENT_SCHEMA: DOCUMENT_SCHEMA, CLAUSE_SCHEMA: CLAUSE_SCHEMA, EVIDENCE_SPAN_SCHEMA: EVIDENCE_SPAN_SCHEMA,
  agreementProposalSchema: agreementProposalSchema, advisorBlockPlanSchema: advisorBlockPlanSchema,
  historyProposalSchema: historyProposalSchema, goalProposalSchema: goalProposalSchema,
  createDocument: createDocument, createClause: createClause,
  createEvidenceSpan: createEvidenceSpan, verifyEvidenceSpan: verifyEvidenceSpan, legacySourceSpan: legacySourceSpan,
  compactJsonSchema: compactJsonSchema, sha256: sha256,
});
