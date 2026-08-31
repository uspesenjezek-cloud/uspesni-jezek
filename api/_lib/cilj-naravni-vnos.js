"use strict";

var crypto = require("node:crypto");
var catalogContract = require("./atena-luna-catalog-contract");
var lunaPolicy = require("./atena-luna-policy");

var ATENA_ENGINE_VERSION = "atena-v7";
var CONTRACT_VERSION = "goal-fact-v17";
var MODEL = lunaPolicy.MODEL;
var MAX_TEXT_LENGTH = lunaPolicy.MAX_SOURCE_TEXT_LENGTH;
var MAX_GOALS = lunaPolicy.MAX_STRUCTURED_ITEMS;
var MODEL_TIMEOUT_MS = lunaPolicy.MODEL_TIMEOUT_MS;
var MODEL_TIMEOUT_MAX_MS = lunaPolicy.MODEL_TIMEOUT_MAX_MS;
var MAX_CLARIFICATION_ROUNDS = lunaPolicy.MAX_CLARIFICATION_ROUNDS;

var GOAL_CATALOG = [
  { id: "full_payment", meaning: "The creditor wants the entire current remaining debt paid.", fields: ["targetAmount", "paymentDeadline", "contactChannel", "note"], required: ["targetAmount", "paymentDeadline", "contactChannel"] },
  { id: "partial_payment_now", meaning: "The creditor wants an immediate or near-term partial payment, with the remainder handled later, optionally by a stated remainder deadline.", fields: ["requestedAmount", "paymentDeadline", "remainingStrategy", "remainingDeadline"], required: ["requestedAmount", "paymentDeadline", "remainingStrategy"] },
  { id: "installment_plan", meaning: "The creditor wants the current remaining debt paid in installments.", fields: ["targetAmount", "installmentAmount", "installmentCount", "firstPaymentDate", "frequency"] },
  { id: "new_deadline", meaning: "The creditor wants the current remaining debt paid by a new deadline.", fields: ["targetAmount", "newDeadline", "contactChannel", "reason"] },
  { id: "amicable_settlement", meaning: "The creditor wants an amicable negotiated settlement.", fields: ["settlementAmount", "settlementDeadline", "settlementApproach"] },
  { id: "dispute_resolution", meaning: "The creditor first wants to resolve an objection or dispute about the invoice.", fields: ["disputeTopic", "desiredOutcome", "disputeDescription"] },
  { id: "compensation", meaning: "The creditor wants a set-off or compensation with a counterclaim.", fields: ["compensationAmount", "counterclaimReference", "settlementDate"] },
  { id: "payment_security", meaning: "The creditor wants security for payment, such as a guarantee, collateral or acknowledgment of debt.", fields: ["securityType", "securedAmount", "securityDeadline"] },
  { id: "legal_recovery", meaning: "The creditor explicitly wants a legal recovery result.", fields: ["legalOutcome", "legalAmount", "legalDeadline", "legalPriority", "legalNote"] },
  { id: "insolvency_claim", meaning: "The creditor wants to register or pursue the claim in insolvency proceedings.", fields: ["proceedingType", "caseReference", "filingDeadline"] },
  { id: "close_without_recovery", meaning: "The creditor wants to close or write off the debt without recovery.", fields: ["closureReason", "writeOffAmount", "closureNote"] },
  { id: "custom_goal", meaning: "Only when the intended outcome genuinely fits none of the defined goal cards.", fields: ["goalDescription", "desiredDeadline", "successMeasure"] },
];
var GOAL_CARD_CONTEXT = Object.freeze({
  full_payment: { title: "Full payment", useWhen: "The desired result is payment of all remaining debt in one completed payment.", doNotUseWhen: "Not for a partial first payment, installments, a mere deadline extension, or legal collection.", examples: ["pay the whole debt tomorrow", "settle everything by month end"] },
  partial_payment_now: { title: "Partial payment as soon as possible", useWhen: "One part is requested now or soon and the source describes how or by when the remainder should be handled.", doNotUseWhen: "Not for equal repeated installments or a completed historical payment.", examples: ["half tomorrow and the rest by month end", "100 now and the rest in installments"] },
  installment_plan: { title: "Payment in installments", useWhen: "The desired future structure contains two or more installments, their count, cadence, amount, or first date.", doNotUseWhen: "Not for past installments or one immediate partial payment followed by a different remainder strategy.", examples: ["pay everything in 5 monthly installments", "three payments every two weeks"] },
  new_deadline: { title: "Payment by a new deadline", useWhen: "The core outcome is moving or setting the deadline for all remaining debt without a distinct installment structure.", doNotUseWhen: "Not when the principal request is legal action, settlement, or a partial-now plan.", examples: ["extend the deadline to 30 September", "give him until Friday"] },
  amicable_settlement: { title: "Amicable settlement", useWhen: "The result is a negotiated compromise, mutual concession, reduced settlement amount, forgiveness, discount or write-off accepted in exchange for payment of the rest. If the creditor wants everything paid but explicitly forgives X EUR, this card represents one settlement for remainingDebtEur minus X.", doNotUseWhen: "Not for an unconditional full-payment demand, a dispute that must first be resolved, legal collection, or closing the entire debt without recovery.", examples: ["agree amicably on 300 euros", "settle with mutual concessions", "pay everything and I will forgive 100 euros"] },
  dispute_resolution: { title: "Resolve invoice dispute", useWhen: "The outcome concerns resolving objections about quality, scope, invoice content, contract, correction, or negotiation.", doNotUseWhen: "Not merely because payment is late or because a lawyer should collect an undisputed debt.", examples: ["resolve his objection about invoice items", "agree the correct quantity first"] },
  compensation: { title: "Set-off", useWhen: "The receivable should be offset against a debtor counterclaim or another referenced claim.", doNotUseWhen: "Not for a discount, ordinary settlement, credit note already issued, or payment security.", examples: ["offset 120 euros against invoice R-22", "compensate both claims"] },
  payment_security: { title: "Secure payment", useWhen: "The user requests a guarantee, collateral, debt acknowledgment, direct debit mandate, or another security.", doNotUseWhen: "Not for an ordinary promise, legal enforcement, or completed payment.", examples: ["obtain a guarantee", "have him acknowledge the debt"] },
  legal_recovery: { title: "Legal recovery", useWhen: "Use whenever the requested future action or result involves calling, contacting, instructing or handing the matter to a lawyer, attorney or legal representative; preparing or sending a legal reminder/payment demand; enforcement; payment order or claim; interim protection; cross-border recovery; or choosing a legal route. A lawyer plus a reminder or collection objective is this single specialized card, never custom_goal.", doNotUseWhen: "Not for recording a lawyer contact that already happened, an insolvency claim, or an ordinary debtor promise without requested legal involvement.", examples: ["call the lawyer and prepare the reminder", "send a legal demand", "start enforcement", "file a payment order", "let a lawyer review the best route"] },
  insolvency_claim: { title: "Claim in insolvency", useWhen: "The future action is filing or managing a claim in bankruptcy or compulsory-settlement proceedings.", doNotUseWhen: "Not for general enforcement or lawyer contact outside insolvency.", examples: ["file the claim in bankruptcy", "register it in compulsory settlement"] },
  close_without_recovery: { title: "Close without recovery", useWhen: "The outcome is an intentional write-off or closure as uncollectible, uneconomical, or a business decision.", doNotUseWhen: "Not for pausing recovery, extending a deadline, or trying a lawyer first.", examples: ["write off the uncollectible debt", "close it as uneconomical"] },
  custom_goal: { title: "Other goal", useWhen: "Only after comparing every specialized card and none describes the requested outcome.", doNotUseWhen: "Never for payment, installments, deadlines, settlement, dispute, set-off, security, lawyer or legal representative, legal reminder or recovery, insolvency, or write-off. Any requested lawyer action belongs to legal_recovery.", examples: ["return the borrowed compressor"] },
});
var LEGAL_OUTCOME_CONTEXT = Object.freeze([
  { valueId: 90101, key: "legal_notice_payment", title: "Payment after legal notice", useWhen: "A lawyer should prepare, complete, send or call about a formal payment reminder or demand before court enforcement.", doNotUseWhen: "Not when the user already wants enforcement, a court claim, interim protection or only an assessment of options.", examples: ["lawyer should send a formal reminder", "prepare a legal demand and call the debtor"] },
  { valueId: 90102, key: "enforcement", title: "Enforcement", useWhen: "The requested result is compulsory enforcement against accounts, income, movable assets or real estate on an enforceable basis.", doNotUseWhen: "Not when a court payment order or judgment must still be obtained first.", examples: ["start enforcement", "enforce against the debtor's bank account"] },
  { valueId: 90103, key: "payment_order_or_claim", title: "Payment order or claim", useWhen: "The user wants a court payment order, lawsuit or judicial decision establishing the claim.", doNotUseWhen: "Not for direct enforcement on an already enforceable title or for a pre-court reminder only.", examples: ["file a payment order", "bring a claim if he disputes the invoice"] },
  { valueId: 90104, key: "interim_protection", title: "Interim protection", useWhen: "The user requests a temporary injunction, freezing or preservation measure because recovery is at concrete risk.", doNotUseWhen: "Not for ordinary enforcement without a stated need for urgent protection.", examples: ["freeze assets before they disappear", "obtain interim protection"] },
  { valueId: 90105, key: "cross_border_recovery", title: "Cross-border recovery", useWhen: "Recovery involves a debtor, address, assets or procedure in another country and the user requests a cross-border legal route.", doNotUseWhen: "Not merely because the creditor is foreign when recovery itself is domestic.", examples: ["recover the debt from Austria", "start cross-border collection"] },
  { valueId: 90106, key: "legal_route_review", title: "Best legal route review", useWhen: "The user wants a lawyer to assess, compare or choose the best legal route before committing to a specific procedure.", doNotUseWhen: "Not when the user already clearly requests one of the five concrete legal results.", examples: ["lawyer should assess the best route", "compare enforcement and a lawsuit"] },
]);

var CARD_ID_BY_GOAL = Object.freeze({ full_payment: 1, partial_payment_now: 2, installment_plan: 3, new_deadline: 4, amicable_settlement: 5, dispute_resolution: 6, compensation: 7, payment_security: 8, legal_recovery: 9, insolvency_claim: 10, close_without_recovery: 11, custom_goal: 12 });
var FIELD_ID_BY_KEY = Object.freeze({
  targetAmount: 101, paymentDeadline: 102, contactChannel: 103, note: 104,
  requestedAmount: 201, remainingStrategy: 202, remainingDeadline: 203,
  installmentAmount: 301, installmentCount: 302, firstPaymentDate: 303, frequency: 304,
  newDeadline: 401, reason: 402,
  settlementAmount: 501, settlementDeadline: 502, settlementApproach: 503,
  disputeTopic: 601, desiredOutcome: 602, disputeDescription: 603,
  compensationAmount: 701, counterclaimReference: 702, settlementDate: 703,
  securityType: 801, securedAmount: 802, securityDeadline: 803,
  legalOutcome: 901, legalAmount: 902, legalDeadline: 903, legalPriority: 904, legalNote: 905,
  proceedingType: 1001, caseReference: 1002, filingDeadline: 1003,
  closureReason: 1101, writeOffAmount: 1102, closureNote: 1103,
  goalDescription: 1201, desiredDeadline: 1202, successMeasure: 1203,
});
var FIELD_KEY_BY_ID = Object.freeze(Object.fromEntries(Object.keys(FIELD_ID_BY_KEY).map(function (key) { return [FIELD_ID_BY_KEY[key], key]; })));
var FIELD_DESCRIPTIONS = Object.freeze({
  targetAmount: "total EUR amount the creditor wants achieved", paymentDeadline: "desired payment deadline as ISO date", contactChannel: "preferred contact channel", note: "optional extra requirement",
  requestedAmount: "EUR amount requested as the first partial payment", remainingStrategy: "how the remaining debt should be handled", remainingDeadline: "deadline for paying the remainder as ISO date",
  installmentAmount: "EUR amount of one installment", installmentCount: "number of installments", firstPaymentDate: "first installment date as ISO", frequency: "installment frequency",
  newDeadline: "new payment deadline as ISO", reason: "reason for accepting or requesting the deadline",
  settlementAmount: "EUR settlement amount", settlementDeadline: "settlement deadline as ISO", settlementApproach: "settlement structure",
  disputeTopic: "subject of the dispute", desiredOutcome: "desired dispute resolution", disputeDescription: "what must be resolved",
  compensationAmount: "EUR set-off amount", counterclaimReference: "counterclaim document reference", settlementDate: "planned set-off date as ISO",
  securityType: "kind of payment security", securedAmount: "EUR amount to secure", securityDeadline: "deadline to arrange security as ISO",
  legalOutcome: "specific desired legal result", legalAmount: "EUR amount for the legal result", legalDeadline: "desired legal deadline as ISO", legalPriority: "main legal-route priority", legalNote: "optional information for legal review",
  proceedingType: "insolvency proceeding type", caseReference: "court or case reference", filingDeadline: "claim filing deadline as ISO",
  closureReason: "reason for closing without recovery", writeOffAmount: "EUR amount to close", closureNote: "justification for closure",
  goalDescription: "custom desired goal", desiredDeadline: "custom goal deadline as ISO", successMeasure: "how success will be recognized",
});
var VALUE_ROWS = [
  [10301, "contactChannel", "email", "E-mail"], [10302, "contactChannel", "sms", "SMS"], [10303, "contactChannel", "phone", "Phone"], [10304, "contactChannel", "registered_mail", "Registered mail"], [10305, "contactChannel", "written", "Written confirmation"], [10306, "contactChannel", "any", "Best available channel"],
  [20201, "remainingStrategy", "installments", "Handle remainder in installments"], [20202, "remainingStrategy", "new_deadline", "Set a new deadline for remainder"], [20203, "remainingStrategy", "later_agreement", "Make a later agreement"],
  [30401, "frequency", "weekly", "Weekly"], [30402, "frequency", "monthly", "Monthly"], [30403, "frequency", "custom", "Custom frequency"],
  [50301, "settlementApproach", "single_payment", "Single payment"], [50302, "settlementApproach", "installments", "Installments"], [50303, "settlementApproach", "mutual_concession", "Mutual concession"],
  [60101, "disputeTopic", "quality", "Quality"], [60102, "disputeTopic", "quantity", "Quantity or scope"], [60103, "disputeTopic", "invoice", "Invoice content"], [60104, "disputeTopic", "contract", "Contract"], [60105, "disputeTopic", "other", "Other"],
  [60201, "desiredOutcome", "full_payment", "Confirm full debt"], [60202, "desiredOutcome", "partial_agreement", "Partial agreement"], [60203, "desiredOutcome", "correction", "Correction"], [60204, "desiredOutcome", "negotiation", "Negotiation"],
  [80101, "securityType", "guarantee", "Guarantee"], [80102, "securityType", "collateral", "Collateral"], [80103, "securityType", "debt_acknowledgment", "Debt acknowledgment"], [80104, "securityType", "direct_debit", "Direct debit"], [80105, "securityType", "other", "Other"],
  [90101, "legalOutcome", "legal_notice_payment", "Payment after legal notice"], [90102, "legalOutcome", "enforcement", "Enforcement"], [90103, "legalOutcome", "payment_order_or_claim", "Payment order or claim"], [90104, "legalOutcome", "interim_protection", "Interim protection"], [90105, "legalOutcome", "cross_border_recovery", "Cross-border recovery"], [90106, "legalOutcome", "legal_route_review", "Best legal route review"],
  [90401, "legalPriority", "speed", "Speed"], [90402, "legalPriority", "cost", "Lowest cost"], [90403, "legalPriority", "success", "Highest success probability"], [90404, "legalPriority", "balanced", "Balanced route"],
  [100101, "proceedingType", "bankruptcy", "Bankruptcy"], [100102, "proceedingType", "compulsory_settlement", "Compulsory settlement"], [100103, "proceedingType", "unknown", "Unknown"],
  [110101, "closureReason", "uncollectible", "Uncollectible"], [110102, "closureReason", "uneconomical", "Uneconomical"], [110103, "closureReason", "business_decision", "Business decision"], [110104, "closureReason", "other", "Other"],
];
var VALUE_BY_ID = Object.freeze(Object.fromEntries(VALUE_ROWS.map(function (row) { return [row[0], { field: row[1], value: row[2] }]; })));
var VALUE_ID_BY_FIELD_VALUE = Object.freeze(Object.fromEntries(VALUE_ROWS.map(function (row) { return [row[1] + ":" + row[2], row[0]]; })));
var MODEL_CARDS = GOAL_CATALOG.map(function (goal) { return [CARD_ID_BY_GOAL[goal.id], goal.id, goal.meaning, goal.fields.map(function (field) { return FIELD_ID_BY_KEY[field]; }), (goal.required || []).map(function (field) { return FIELD_ID_BY_KEY[field]; })]; });
var MODEL_FIELDS = Object.keys(FIELD_ID_BY_KEY).map(function (key) { return [FIELD_ID_BY_KEY[key], key, FIELD_DESCRIPTIONS[key]]; });
var MODEL_CATALOG = Object.freeze({
  lexiconVersion: catalogContract.LEXICON_VERSION,
  languagePolicy: catalogContract.languagePolicy(),
  cards: MODEL_CARDS,
  fields: MODEL_FIELDS,
  values: VALUE_ROWS,
  legalOutcomes: LEGAL_OUTCOME_CONTEXT,
  guide: catalogContract.buildCardGuide(GOAL_CATALOG.map(function (goal) {
    var context = GOAL_CARD_CONTEXT[goal.id];
    return { cardId: CARD_ID_BY_GOAL[goal.id], key: goal.id, title: context.title, purpose: goal.meaning, useWhen: context.useWhen, doNotUseWhen: context.doNotUseWhen, examples: context.examples, fieldIds: goal.fields.map(function (field) { return FIELD_ID_BY_KEY[field]; }), requiredFieldIds: (goal.required || []).map(function (field) { return FIELD_ID_BY_KEY[field]; }) };
  }), MODEL_FIELDS, VALUE_ROWS, { flow: "goal" }),
});
var RESPONSE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["p", "q", "x"],
  properties: {
    p: { type: "array", minItems: 0, maxItems: MAX_GOALS, items: {
      type: "object", additionalProperties: false, required: ["n", "c", "k", "f", "e"],
      properties: {
        n: { type: "integer", minimum: 1, maximum: MAX_GOALS }, c: { type: "integer", enum: Object.values(CARD_ID_BY_GOAL) }, k: { type: "integer", enum: [1, 2, 3] },
        f: { type: "array", maxItems: 8, items: {
          type: "object", additionalProperties: false, required: ["i", "v", "o", "e"],
          properties: { i: { type: "integer", enum: Object.values(FIELD_ID_BY_KEY) }, v: { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] }, o: { anyOf: [{ type: "integer", enum: VALUE_ROWS.map(function (row) { return row[0]; }) }, { type: "null" }] }, e: { type: "string", maxLength: 500 } },
        } },
        e: { type: "string", maxLength: 500 },
      },
    } },
    q: { anyOf: [{ type: "string", minLength: 1, maxLength: 240 }, { type: "null" }] },
    x: { type: "string", maxLength: 500 },
  },
};
lunaPolicy.assertPortableResponseSchema(RESPONSE_SCHEMA);

function trim(value, max) { return String(value == null ? "" : value).trim().slice(0, max); }
function positiveAmount(value) { var number = Number(value); return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null; }
function validIsoDate(value) {
  var text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  var date = new Date(text + "T12:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
}
var DATE_FIELDS = ["paymentDeadline", "remainingDeadline", "firstPaymentDate", "newDeadline", "settlementDeadline", "settlementDate", "securityDeadline", "filingDeadline", "desiredDeadline", "legalDeadline"];
var AMOUNT_FIELDS = ["targetAmount", "requestedAmount", "installmentAmount", "settlementAmount", "compensationAmount", "securedAmount", "writeOffAmount", "legalAmount"];
var ENUM_FIELDS = {
  contactChannel: ["email", "sms", "phone", "registered_mail", "written", "any"], remainingStrategy: ["installments", "new_deadline", "later_agreement"],
  frequency: ["weekly", "monthly", "custom"], settlementApproach: ["single_payment", "installments", "mutual_concession"],
  disputeTopic: ["quality", "quantity", "invoice", "contract", "other"], desiredOutcome: ["full_payment", "partial_agreement", "correction", "negotiation"],
  securityType: ["guarantee", "collateral", "debt_acknowledgment", "direct_debit", "other"], proceedingType: ["bankruptcy", "compulsory_settlement", "unknown"],
  closureReason: ["uncollectible", "uneconomical", "business_decision", "other"],
  legalOutcome: ["legal_notice_payment", "enforcement", "payment_order_or_claim", "interim_protection", "cross_border_recovery", "legal_route_review"],
  legalPriority: ["speed", "cost", "success", "balanced"],
};
function safetyIdentifier(userId) { return "goal-" + crypto.createHash("sha256").update(String(userId || "anonymous")).digest("hex").slice(0, 32); }
function requestBody(text, context, userId) {
  var body = Object.assign(lunaPolicy.requestDefaults(), {
    safety_identifier: safetyIdentifier(userId),
    reasoning: { effort: "medium" },
    instructions: "You are Luna, the sole semantic interpreter inside Atena's FUTURE DEBT GOAL flow. Convert the user's desired future outcomes into compact numbered FATHER review cards using catalog.cards, catalog.fields, catalog.values and catalog.legalOutcomes. Output p/q/x; return every ordered review step and every known compatible field. 'Cel dolg', 'v celoti', 'vse' and 'ves preostanek' mean remainingDebtEur. SETTLEMENT FORGIVENESS HARD RULE: when the creditor wants the debtor to pay everything or settle the debt but explicitly accepts, forgives, writes off or discounts X EUR, return exactly one amicable_settlement cardId 5. Set settlementAmount fieldId 501 to remainingDebtEur minus X and settlementApproach fieldId 503 to single_payment valueId 50301 unless installments are explicit. With remainingDebtEur 434, 'hočem da mi vse plača, pripravljen sem na 100 evrov odpustka' means settlementAmount 334 and cardId 5. Never rely on the local adapter to correct this or any other semantic choice. Follow one independent future outcome or action per card, preserve source order, and apply this rule generally across all catalog families. When the shared compositional method identifies a conditional legal fallback, return its primary outcome first and legal_recovery cardId 9 next. If no concrete legal procedure is chosen, use legal_route_review valueId 90106 and preserve the handoff request in legalNote. Never merge, summarize or hide a second requested outcome in another card. Clauses that jointly describe one payment structure stay on one appropriate payment card. Expand installments into separate cards whenever the supplied schema can represent them. Every independently requested legal result is its own legal_recovery cardId 9; return multiple ordered legal_recovery cards when multiple legal results are requested. Normalize stated relative dates from referenceDate, compute explicit fractions and remaining-debt arithmetic exactly, and return one concise Slovenian clarification question for material ambiguity. Do not invent IDs or values. Every card will be reviewed by a human.",
    input: JSON.stringify({ contractVersion: CONTRACT_VERSION, sourceText: trim(text, MAX_TEXT_LENGTH), referenceDate: validIsoDate(context && context.referenceDate), remainingDebtEur: positiveAmount(context && context.remainingDebt), catalog: MODEL_CATALOG }),
    text: { format: { type: "json_schema", name: "debt_goal_compact_v17", strict: true, schema: RESPONSE_SCHEMA } },
  });
  body.instructions = "HARD COMPLETE-CATALOG ORDER: FIRST read every entry in catalog.guide, including useWhen, doNotUseWhen, examples, languageProfile, field IDs and allowed value IDs. Then choose the best specialized cardId yourself and fill only that card's available field IDs. " + catalogContract.semanticInstructions() + " " + lunaPolicy.semanticAuthorityInstructions() + " HARD OUTPUT INVARIANTS: never return p and q together. Every card e, every field e and top-level x must be a non-empty exact contiguous quote copied verbatim from sourceText. Unknown, incompatible or duplicate IDs invalidate the entire answer; do not include them. " + body.instructions + " HARD LEGAL BOUNDARY: any requested future involvement of an odvetnik, lawyer, attorney or legal representative in contacting the debtor, preparing a reminder or demand, or pursuing recovery is legal_recovery cardId 9, never custom_goal cardId 12. A lawyer preparing, completing, sending or calling about an opomin or payment demand uses legalOutcome legal_notice_payment valueId 90101; a request to choose a route uses legal_route_review valueId 90106. Preserve additional requested legal action in legalNote. Apply these boundaries generally across wording and inflection, never as a phrase match. The local adapter maps Luna's numeric card and compatible field IDs and never changes Luna's semantic selection.";
  return body;
}
function responseText(payload) {
  return lunaPolicy.responseText(payload);
}
function canonicalScalar(fieldKey, field) {
  if (ENUM_FIELDS[fieldKey]) {
    if (field.v !== null || !Number.isInteger(field.o)) return null;
    var option = VALUE_BY_ID[field.o];
    return option && option.field === fieldKey && ENUM_FIELDS[fieldKey].includes(option.value) ? option.value : null;
  }
  if (field.o !== null || typeof field.v !== "string" || !field.v.trim() || field.v.length > 500) return null;
  var value = field.v.trim();
  if (DATE_FIELDS.includes(fieldKey)) return validIsoDate(value);
  if (AMOUNT_FIELDS.includes(fieldKey)) {
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) return null;
    var amount = positiveAmount(value);
    return amount && amount <= 1000000000 ? value : null;
  }
  if (fieldKey === "installmentCount") {
    var count = Number(value);
    return /^\d+$/.test(value) && Number.isInteger(count) && count >= 2 && count <= 1000 ? String(count) : null;
  }
  return value;
}
function invalidProposal(diagnostics, reason) {
  if (diagnostics && typeof diagnostics === "object") diagnostics.reason = reason;
  return null;
}
function materialize(proposal, context, source, diagnostics) {
  lunaPolicy.assertAdapterOperations(["schema_validation", "catalog_id_mapping", "deterministic_arithmetic", "human_review_projection"]);
  if (!lunaPolicy.hasExactKeys(proposal, ["p", "q", "x"])) return invalidProposal(diagnostics, "goal_top_shape");
  if (!Array.isArray(proposal.p) || !proposal.p.length || proposal.p.length > MAX_GOALS) return invalidProposal(diagnostics, "goal_plan_count");
  if (proposal.q !== null) return invalidProposal(diagnostics, "goal_plan_question_mixed");
  if (typeof proposal.x !== "string" || !proposal.x || proposal.x.length > 500 || !lunaPolicy.evidenceIsLinked(source, proposal.x)) return invalidProposal(diagnostics, "goal_top_evidence_unlinked");
  var goals = [];
  for (var index = 0; index < proposal.p.length; index += 1) {
    var item = proposal.p[index];
    var goalId = item && Object.keys(CARD_ID_BY_GOAL).find(function (key) { return CARD_ID_BY_GOAL[key] === item.c; });
    var catalogGoal = GOAL_CATALOG.find(function (goal) { return goal.id === goalId; });
    if (!lunaPolicy.hasExactKeys(item, ["n", "c", "k", "f", "e"])) return invalidProposal(diagnostics, "goal_card_shape");
    if (!catalogGoal) return invalidProposal(diagnostics, "goal_card_id_unknown");
    if (item.n !== index + 1) return invalidProposal(diagnostics, "goal_card_order");
    if (![1, 2, 3].includes(item.k)) return invalidProposal(diagnostics, "goal_card_confidence");
    if (!Array.isArray(item.f) || item.f.length > 8) return invalidProposal(diagnostics, "goal_field_count");
    if (typeof item.e !== "string" || !item.e || item.e.length > 500 || !lunaPolicy.evidenceIsLinked(source, item.e)) return invalidProposal(diagnostics, "goal_card_evidence_unlinked");
    var evidence = item.e;
    var data = {};
    var seenFieldIds = new Set();
    var fields = Array.isArray(item.f) ? item.f : [];
    for (var fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
      var field = fields[fieldIndex];
      var fieldKey = field && FIELD_KEY_BY_ID[field.i];
      if (!lunaPolicy.hasExactKeys(field, ["i", "v", "o", "e"]) || !Number.isInteger(field.i)) return invalidProposal(diagnostics, "goal_field_shape");
      if (!fieldKey) return invalidProposal(diagnostics, "goal_field_id_unknown");
      if (!catalogGoal.fields.includes(fieldKey)) return invalidProposal(diagnostics, "goal_field_incompatible");
      if (seenFieldIds.has(field.i)) return invalidProposal(diagnostics, "goal_field_duplicate");
      if (typeof field.e !== "string" || !field.e || field.e.length > 500 || !lunaPolicy.evidenceIsLinked(source, field.e)) return invalidProposal(diagnostics, "goal_field_evidence_unlinked");
      var value = canonicalScalar(fieldKey, field);
      if (value == null) return invalidProposal(diagnostics, "goal_field_value_invalid");
      seenFieldIds.add(field.i);
      data[fieldKey] = value;
    }
    var required = Array.isArray(catalogGoal.required) ? catalogGoal.required : catalogGoal.fields.filter(function (field) { return !["note", "reason", "settlementDate", "caseReference", "filingDeadline", "desiredDeadline", "successMeasure", "installmentAmount", "legalAmount", "legalDeadline", "legalPriority", "legalNote"].includes(field); });
    var missing = required.filter(function (field) { return !String(data[field] == null ? "" : data[field]).trim(); });
    if (goalId === "partial_payment_now" && data.remainingStrategy === "new_deadline" && !data.remainingDeadline) missing.push("remainingDeadline");
    goals.push({ goalId: goalId, cardId: item.c, stepNumber: goals.length + 1, confidence: ["high", "medium", "low"][item.k - 1] || "medium", goalData: data, fieldOrder: catalogGoal.fields.slice(), fieldIds: catalogGoal.fields.map(function (field) { return FIELD_ID_BY_KEY[field]; }), requiredFields: required, missing: missing, evidence: evidence, requiresHumanReview: true });
  }
  return goals.length ? goals : invalidProposal(diagnostics, "goal_plan_empty");
}
function clarificationResult(proposal, context, source) {
  if (!lunaPolicy.hasExactKeys(proposal, ["p", "q", "x"]) || !Array.isArray(proposal.p) || proposal.p.length !== 0 ||
      typeof proposal.q !== "string" || !proposal.q.trim() || proposal.q.length > 240 || typeof proposal.x !== "string" ||
      proposal.x.length > 500 || !lunaPolicy.evidenceIsLinked(source, proposal.x)) return null;
  var nextRound = Number(context && context.clarificationRound || 0) + 1;
  var exhausted = nextRound > MAX_CLARIFICATION_ROUNDS;
  return {
    goals: [],
    clarification: exhausted ? null : { question: proposal.q.trim(), clauseId: "clause-1", round: nextRound, maxRounds: MAX_CLARIFICATION_ROUNDS },
    clarificationExhausted: exhausted,
    summary: exhausted ? "Opisa ni bilo mogoče dovolj zanesljivo razumeti. Cilj izberite ročno." : "Atena potrebuje eno pojasnilo pred pripravo cilja.",
  };
}
function aiError(message, code) { var error = new Error(message); error.code = code; error.status = 503; return error; }
async function analyze(text, context, options) {
  context = context || {}; options = options || {};
  var source = trim(text, MAX_TEXT_LENGTH + 1);
  if (!source || source.length > MAX_TEXT_LENGTH) { var inputError = new Error(source ? "Opis je predolg." : "Vpišite želeni cilj."); inputError.code = "INVALID_TEXT"; inputError.status = 400; throw inputError; }
  var clarificationRound = context.clarificationRound == null ? 0 : context.clarificationRound;
  if (!Number.isInteger(clarificationRound) || clarificationRound < 0 || clarificationRound > MAX_CLARIFICATION_ROUNDS) {
    var clarificationError = new Error("Pojasnilo ni veljavno."); clarificationError.code = "INVALID_CLARIFICATION"; clarificationError.status = 400; throw clarificationError;
  }
  var apiKey = Object.prototype.hasOwnProperty.call(options, "apiKey") ? options.apiKey : process.env.OPENAI_API_KEY;
  if (!apiKey) throw aiError("Luna trenutno ni konfigurirana.", "LUNA_NOT_CONFIGURED");
  var json = JSON.stringify(requestBody(source, context, options.userId));
  try {
    var transport = await lunaPolicy.requestOpenAi({ apiKey: apiKey, body: json, fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs, maxAttempts: options.maxAttempts, sleepImpl: options.sleepImpl, randomImpl: options.randomImpl });
    var payload = transport.payload;
    var transportMeta = { attempts: transport.attempts, elapsedMs: transport.elapsedMs };
    var proposal = null;
    try { proposal = JSON.parse(responseText(payload)); } catch (_error) { proposal = null; }
    var diagnostics = {};
    var goals = materialize(proposal, context, source, diagnostics);
    var clarification = goals ? null : clarificationResult(proposal, context, source);
    if (!goals && !clarification) {
      if (process.env.NODE_ENV !== "production") console.warn("[goal-ai-plan]", diagnostics.reason || "goal_response_invalid");
      throw aiError("Lunin odgovor ni skladen s ciljnim katalogom.", "LUNA_INVALID_GOAL_PLAN");
    }
    if (clarification) return Object.assign({}, clarification, {
      engineVersion: ATENA_ENGINE_VERSION, contractVersion: CONTRACT_VERSION,
      semanticPlan: { requested: true, attempted: true, source: "luna_goal_catalog_adapter", status: clarification.clarificationExhausted ? "CLARIFICATION_EXHAUSTED" : "CLARIFICATION_REQUIRED", reason: clarification.clarificationExhausted ? "luna_goal_clarification_exhausted" : "luna_goal_clarification", transport: transportMeta, usage: payload && payload.usage || null },
    });
    return { goals: goals, summary: "Atena je pripravila ciljne kartice za vaš pregled.", engineVersion: ATENA_ENGINE_VERSION, contractVersion: CONTRACT_VERSION,
      semanticPlan: { requested: true, attempted: true, source: "luna_goal_catalog_adapter", status: "OK", reason: "luna_goal_plan_applied", transport: transportMeta, usage: payload && payload.usage || null } };
  } catch (error) {
    if (error && error.status) throw error;
    throw aiError("Luna trenutno ni dosegljiva.", "LUNA_UNAVAILABLE");
  }
}

module.exports = { analyze: analyze, requestBody: requestBody, ATENA_ENGINE_VERSION: ATENA_ENGINE_VERSION, CONTRACT_VERSION: CONTRACT_VERSION, MODEL: MODEL,
  MAX_TEXT_LENGTH: MAX_TEXT_LENGTH, MAX_GOALS: MAX_GOALS, MODEL_TIMEOUT_MS: MODEL_TIMEOUT_MS, MODEL_TIMEOUT_MAX_MS: MODEL_TIMEOUT_MAX_MS,
  MAX_CLARIFICATION_ROUNDS: MAX_CLARIFICATION_ROUNDS, RESPONSE_SCHEMA: RESPONSE_SCHEMA,
  _test: { materialize: materialize, clarificationResult: clarificationResult, catalog: GOAL_CATALOG, modelCatalog: MODEL_CATALOG, cardIdByGoal: CARD_ID_BY_GOAL, fieldIdByKey: FIELD_ID_BY_KEY, valueIdByFieldValue: VALUE_ID_BY_FIELD_VALUE } };
