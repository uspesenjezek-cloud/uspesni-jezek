"use strict";

var crypto = require("node:crypto");
var z = require("zod").z;
var catalogContract = require("./atena-luna-catalog-contract");
var structuredContracts = require("./atena-structured-contracts");
var lunaPolicy = require("./atena-luna-policy");
var lunaErrorKnowledge = require("./atena-luna-error-knowledge");

var ATENA_ENGINE_VERSION = "atena-v7";
var CONTRACT_VERSION = "goal-fact-v18";
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
var RESPONSE_ZOD_SCHEMA = structuredContracts.goalProposalSchema(Object.values(CARD_ID_BY_GOAL), Object.values(FIELD_ID_BY_KEY), VALUE_ROWS.map(function (row) { return row[0]; }), MAX_GOALS);
var RESPONSE_SCHEMA = structuredContracts.compactJsonSchema(z.toJSONSchema(RESPONSE_ZOD_SCHEMA));
lunaPolicy.assertPortableResponseSchema(RESPONSE_SCHEMA);

function trim(value, max) { return String(value == null ? "" : value).trim().slice(0, max); }
function lexicalSourceTokens(source) {
  var text = String(source || "");
  var tokens = [];
  var matcher = /\S+/gu;
  var match;
  while ((match = matcher.exec(text))) tokens.push({ id: tokens.length + 1, start: match.index, end: match.index + match[0].length, text: match[0] });
  return tokens;
}
function resolveEvidence(source, wireEvidence) {
  var evidence = String(wireEvidence == null ? "" : wireEvidence);
  if (!evidence) return null;
  if (lunaPolicy.evidenceIsLinked(source, evidence)) return evidence;
  var reference = evidence.match(/^@([1-9]\d*):([1-9]\d*)$/);
  if (!reference) return null;
  var firstId = Number(reference[1]);
  var lastId = Number(reference[2]);
  var tokens = lexicalSourceTokens(source);
  if (!Number.isInteger(firstId) || !Number.isInteger(lastId) || firstId > lastId || firstId < 1 || lastId > tokens.length) return null;
  var first = tokens[firstId - 1];
  var last = tokens[lastId - 1];
  return String(source || "").slice(first.start, last.end) || null;
}
function evidenceReferenceForQuote(source, evidence) {
  var value = String(evidence == null ? "" : evidence);
  if (/^@[1-9]\d*:[1-9]\d*$/.test(value) || value === "") return value;
  var start = String(source || "").indexOf(value);
  if (start < 0) return value;
  var end = start + value.length;
  var tokens = lexicalSourceTokens(source);
  var first = tokens.find(function (token) { return token.start === start; });
  var last = tokens.find(function (token) { return token.end === end; });
  return first && last && first.id <= last.id ? "@" + first.id + ":" + last.id : value;
}
function normalizeLegacyGoalEvidence(proposal, source) {
  if (!proposal || typeof proposal !== "object" || !Array.isArray(proposal.p)) return proposal;
  return Object.assign({}, proposal, {
    x: evidenceReferenceForQuote(source, proposal.x),
    p: proposal.p.map(function (item) {
      if (!item || typeof item !== "object") return item;
      return Object.assign({}, item, {
        e: evidenceReferenceForQuote(source, item.e),
        f: Array.isArray(item.f) ? item.f.map(function (field) {
          return field && typeof field === "object" ? Object.assign({}, field, { e: evidenceReferenceForQuote(source, field.e) }) : field;
        }) : item.f,
      });
    }),
  });
}
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
  var sourceText = trim(text, MAX_TEXT_LENGTH);
  var sourceTokens = lexicalSourceTokens(sourceText);
  var body = Object.assign(lunaPolicy.requestDefaults(), {
    safety_identifier: safetyIdentifier(userId),
    reasoning: { effort: "medium" },
    instructions: [
      "You are Luna, the sole semantic interpreter inside Atena's FUTURE DEBT GOAL flow.",
      "Convert the user's desired future outcomes into compact numbered FATHER review cards using catalog.cards, catalog.fields, catalog.values and catalog.legalOutcomes.",
      "Output p/q/x; return every ordered review step and every known compatible field.",
      "Before output, perform one internal clause-by-clause coverage audit inside this same response: every material future outcome, sequence, condition, fallback, alternative and exception must be represented by its own appropriate card or by the single clarification question.",
      "Luna alone decides the semantic number and order of cards. The local adapter must never split, merge, add, remove or reorder Luna's cards.",
      "When a stated installment arrangement represents N future installment actions, return N ordered installment_plan cards. Preserve installmentCount N on each installment card and include every other known compatible field on each card.",
      "For example, three future installments are three ordered installment_plan cards, not one setup card. Five future installments are five ordered installment_plan cards.",
      "HARD MULTI-STEP PREOUTPUT AUDIT: count every independent future action after expanding explicit multiplicity. For N installments output exactly N installment_plan cards and use each card's existing n value as its distinct ordinal; never invent a non-catalog installment_index field. The same shortest exact quantified source span may support shared plan facts on all N cards. Then verify that every later or earlier legal, dispute, security or other independent outcome has its own card in source order. Omit unstated optional values instead of inventing a value or evidence.",
      "FIELD-OPTION OWNERSHIP AUDIT: set o only when that catalog value ID belongs to the same field i. Never copy a value ID from a neighboring enum field into an optional free-text field. If optional free text is not literally stated, omit it by returning v=null, o=null and e empty.",
      "INSTALLMENT TARGET AUDIT: every installment_plan card should include targetAmount. Use the explicit stated total first; otherwise use exact installmentAmount multiplied by installmentCount; only when that product cannot be computed use remainingDebtEur. Never replace an explicit total with remainingDebtEur.",
      "MATERIAL VALUE AUDIT: evidence proves provenance but never substitutes for a value. Every materially explicit scalar must have non-null v or o. A field with v=null and o=null MUST have e empty; never return an evidence range for an unmaterialized value.",
      "FORWARD DEADLINE ATTACHMENT: in a clause shaped 'do DATE pa ACTION', the deadline normally governs the following explicit ACTION, not an earlier payment or remainder. Attach it exactly once to that action's compatible deadline field. If clause scope is genuinely ambiguous, ask one clarification; never duplicate or move the date by proximity.",
      "TOP-LEVEL COMPLETENESS: a valid installment proposal plus fallback must always produce the complete p/q/x object. Do not spend the output on explanation, omit the JSON object, or stop before all repeated installment cards and the fallback are serialized.",
      "LOSSLESS EVIDENCE WIRE: sourceTokens are exact non-whitespace tokens in source order with implicit 1-based IDs and sourceTokenCount is the last valid ID. Every card e, every asserted field e and top-level x MUST be a token range string @firstId:lastId with 1<=firstId<=lastId<=sourceTokenCount. Luna selects the semantic range; local code only slices the unchanged sourceText from the first token start through the last token end. Never return evidence prose. For an optional field with both v and o null, e may be empty. For a solution, top-level x should span from the first material card-evidence start token through the last material card-evidence end token, excluding unrelated conversational wrappers.",
      "SOLUTION STATE AND RESIDUAL STRATEGY: whenever p contains cards, q is null and top-level x is one non-empty @firstId:lastId range. partial_payment_now.remainingStrategy owns a bare residual instruction such as 'ostalo na obroke'. Do not add a separate installment_plan unless the source gives independently schedulable installment substance: count, installment amount, first date or cadence. Apply temporal operators before surface clause order: 'pred tem' means the referenced action occurs first.",
      "'Cel dolg', 'v celoti', 'vse' and 'ves preostanek' mean remainingDebtEur.",
      "SETTLEMENT FORGIVENESS HARD RULE: when the creditor wants the debtor to pay everything or settle the debt but explicitly accepts, forgives, writes off or discounts X EUR, return exactly one amicable_settlement cardId 5.",
      "Set settlementAmount fieldId 501 to remainingDebtEur minus X and settlementApproach fieldId 503 to single_payment valueId 50301 unless installments are explicit.",
      "With remainingDebtEur 434, 'hočem da mi vse plača, pripravljen sem na 100 evrov odpustka' means settlementAmount 334 and cardId 5.",
      "Never rely on the local adapter to correct this or any other semantic choice.",
      "Follow one independent future outcome or action per card, preserve source order, and apply this rule generally across all catalog families.",
      "A conditional legal fallback is always an additional legal_recovery cardId 9 after its primary ordered actions.",
      "When N installment actions are followed by a conditional legal fallback, return N ordered installment_plan cards followed by one legal_recovery card; derive N and the legal meaning from the whole source, not from a phrase match.",
      "If no concrete legal procedure is chosen, use legal_route_review valueId 90106 and preserve the handoff request in legalNote.",
      "Never merge, summarize or hide a requested future action in another card.",
      "Every independently requested legal result is its own legal_recovery cardId 9; return multiple ordered legal_recovery cards when multiple legal results are requested.",
      "Normalize stated relative dates from referenceDate, compute explicit fractions and remaining-debt arithmetic exactly, and return one concise Slovenian clarification question for material ambiguity.",
      "Do not invent IDs or values. Every card will be reviewed by a human.",
    ].join(" "),
    input: JSON.stringify({ contractVersion: CONTRACT_VERSION, sourceText: sourceText, sourceTokenization: "lossless-non-whitespace-v1; implicit token IDs are 1-based; @a:b slices original source from token a start through token b end", sourceTokenCount: sourceTokens.length, sourceTokens: sourceTokens.map(function (token) { return token.text; }), referenceDate: validIsoDate(context && context.referenceDate), remainingDebtEur: positiveAmount(context && context.remainingDebt), catalog: MODEL_CATALOG }),
    text: { format: { type: "json_schema", name: "debt_goal_compact_v18", strict: true, schema: RESPONSE_SCHEMA } },
  });
  body.instructions = "HARD COMPLETE-CATALOG ORDER: FIRST read every entry in catalog.guide, including useWhen, doNotUseWhen, examples, languageProfile, field IDs and allowed value IDs. Then choose the best specialized cardId yourself and fill only that card's available field IDs. " + catalogContract.semanticInstructions() + " " + lunaPolicy.semanticAuthorityInstructions() + " HARD GOAL EVIDENCE OVERRIDE: in this goal-fact-v18 wire, exact evidence is represented only by @firstTokenId:lastTokenId references into sourceTokens, never by generated evidence text. The adapter validates the range and mechanically slices the original sourceText; Luna still chooses every semantic span. Immediately before output audit every e/x against sourceTokens and ensure 1<=firstId<=lastId<=sourceTokenCount. Unknown, incompatible or duplicate IDs invalidate the entire answer; do not include them. " + body.instructions + " HARD LEGAL BOUNDARY: any requested future involvement of an odvetnik, lawyer, attorney or legal representative in contacting the debtor, preparing a reminder or demand, or pursuing recovery is legal_recovery cardId 9, never custom_goal cardId 12. A lawyer preparing, completing, sending or calling about an opomin or payment demand uses legalOutcome legal_notice_payment valueId 90101; a request to choose a route uses legal_route_review valueId 90106. Preserve additional requested legal action in legalNote. Apply these boundaries generally across wording and inflection, never as a phrase match. Every explicit compatible deadline must be returned on the card for the action it governs, including when the date phrase precedes that action. Before output, if the action is a concrete lawyer call/contact about payment, legalOutcome must be legal_notice_payment, never legal_route_review. The local adapter maps Luna's numeric card and compatible field IDs and never changes Luna's semantic selection. " + lunaErrorKnowledge.promptContext("goal");
  return body;
}
function responseText(payload) {
  return lunaPolicy.responseText(payload);
}
function canonicalScalar(fieldKey, field) {
  if (ENUM_FIELDS[fieldKey]) {
    if (Number.isInteger(field.o)) {
      var explicitOption = VALUE_BY_ID[field.o];
      if (!explicitOption || explicitOption.field !== fieldKey || !ENUM_FIELDS[fieldKey].includes(explicitOption.value)) return null;
      if (field.v === null) return explicitOption.value;
      if (typeof field.v !== "string") return null;
      var serializedValue = field.v.trim();
      if (serializedValue === explicitOption.value || serializedValue === String(field.o)) return explicitOption.value;
      // `o` is Luna's closed semantic selection. `v` is only an optional display
      // serialization and may be localized; never use it to replace the explicit ID.
      return explicitOption.value;
    }
    if (field.o === null && typeof field.v === "string" && ENUM_FIELDS[fieldKey].includes(field.v.trim())) return field.v.trim();
    if (field.v !== null || !Number.isInteger(field.o)) return null;
    var option = VALUE_BY_ID[field.o];
    return option && option.field === fieldKey && ENUM_FIELDS[fieldKey].includes(option.value) ? option.value : null;
  }
  if (field.o !== null || typeof field.v !== "string" || !field.v.trim() || field.v.length > 500) return null;
  var value = field.v.trim();
  if (DATE_FIELDS.includes(fieldKey)) return validIsoDate(value);
  if (AMOUNT_FIELDS.includes(fieldKey)) {
    var normalizedAmount = value.replace(/\s*(?:EUR|€)\s*$/i, "").replace(",", ".");
    if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(normalizedAmount)) return null;
    var amount = positiveAmount(normalizedAmount);
    return amount && amount <= 1000000000 ? normalizedAmount : null;
  }
  if (fieldKey === "installmentCount") {
    var count = Number(value);
    return /^\d+$/.test(value) && Number.isInteger(count) && count >= 2 && count <= 1000 ? String(count) : null;
  }
  if (["counterclaimReference", "caseReference"].includes(fieldKey)) return value.replace(/[\s.,;:!?…]+$/u, "");
  return value;
}
function equalInstallmentAmount(targetAmount, installmentCount) {
  var amount = Number(targetAmount);
  var count = Number(installmentCount);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(count) || count < 2) return null;
  var cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 0.000001 || cents % count !== 0) return null;
  return (cents / count / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
function installmentTargetAmount(installmentAmount, installmentCount) {
  var amount = Number(installmentAmount);
  var count = Number(installmentCount);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(count) || count < 2 || count > 1000) return null;
  var cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 0.000001) return null;
  var targetCents = cents * count;
  if (!Number.isSafeInteger(targetCents) || targetCents <= 0 || targetCents > 100000000000) return null;
  return (targetCents / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
function invalidProposal(diagnostics, reason) {
  if (diagnostics && typeof diagnostics === "object") diagnostics.reason = reason;
  return null;
}
function materialize(proposal, context, source, diagnostics) {
  lunaPolicy.assertAdapterOperations(["schema_validation", "catalog_id_mapping", "deterministic_arithmetic", "human_review_projection"]);
  proposal = normalizeLegacyGoalEvidence(proposal, source);
  var parsedProposal = RESPONSE_ZOD_SCHEMA.safeParse(proposal);
  if (parsedProposal.success) proposal = parsedProposal.data;
  else if (!lunaPolicy.hasExactKeys(proposal, ["p", "q", "x"])) return invalidProposal(diagnostics, "goal_top_shape");
  if (!Array.isArray(proposal.p) || !proposal.p.length || proposal.p.length > MAX_GOALS) return invalidProposal(diagnostics, "goal_plan_count");
  if (proposal.q !== null) return invalidProposal(diagnostics, "goal_plan_question_mixed");
  if (typeof proposal.x !== "string" || !resolveEvidence(source, proposal.x)) return invalidProposal(diagnostics, "goal_top_evidence_unlinked");
  var goals = [];
  var sourceDocument = structuredContracts.createDocument(source);
  for (var index = 0; index < proposal.p.length; index += 1) {
    var item = proposal.p[index];
    var goalId = item && Object.keys(CARD_ID_BY_GOAL).find(function (key) { return CARD_ID_BY_GOAL[key] === item.c; });
    var catalogGoal = GOAL_CATALOG.find(function (goal) { return goal.id === goalId; });
    if (!lunaPolicy.hasExactKeys(item, ["n", "c", "k", "f", "e"])) return invalidProposal(diagnostics, "goal_card_shape");
    if (!catalogGoal) return invalidProposal(diagnostics, "goal_card_id_unknown");
    if (item.n !== index + 1) return invalidProposal(diagnostics, "goal_card_order");
    if (![1, 2, 3].includes(item.k)) return invalidProposal(diagnostics, "goal_card_confidence");
    if (!Array.isArray(item.f) || item.f.length > 8) return invalidProposal(diagnostics, "goal_field_count");
    var evidence = typeof item.e === "string" ? resolveEvidence(source, item.e) : null;
    if (!evidence) return invalidProposal(diagnostics, "goal_card_evidence_unlinked");
    var evidenceSpan = structuredContracts.createEvidenceSpan(sourceDocument, evidence, "clause-goal-" + (index + 1));
    if (!evidenceSpan || !structuredContracts.verifyEvidenceSpan(sourceDocument, evidenceSpan)) return invalidProposal(diagnostics, "goal_card_evidence_span_invalid");
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
      if (field.v === null && field.o === null) {
        if (field.e !== "") return invalidProposal(diagnostics, "goal_field_value_missing_with_evidence:" + fieldKey);
        seenFieldIds.add(field.i);
        continue;
      }
      if (typeof field.e !== "string" || !resolveEvidence(source, field.e)) return invalidProposal(diagnostics, "goal_field_evidence_unlinked");
      var value = canonicalScalar(fieldKey, field);
      if (value == null) return invalidProposal(diagnostics, "goal_field_value_invalid:" + fieldKey);
      seenFieldIds.add(field.i);
      data[fieldKey] = value;
    }
    var derivedFields = [];
    if (goalId === "installment_plan" && !data.targetAmount) {
      var derivedTargetAmount = installmentTargetAmount(data.installmentAmount, data.installmentCount);
      if (derivedTargetAmount) {
        data.targetAmount = derivedTargetAmount;
        derivedFields.push("targetAmount");
      } else {
        var contextTargetAmount = positiveAmount(context && context.remainingDebt);
        if (contextTargetAmount != null && contextTargetAmount <= 1000000000) {
          data.targetAmount = String(contextTargetAmount);
          derivedFields.push("targetAmount");
        }
      }
    }
    if (goalId === "installment_plan" && !data.installmentAmount) {
      var derivedInstallmentAmount = equalInstallmentAmount(data.targetAmount, data.installmentCount);
      if (derivedInstallmentAmount) {
        data.installmentAmount = derivedInstallmentAmount;
        derivedFields.push("installmentAmount");
      }
    }
    var required = Array.isArray(catalogGoal.required) ? catalogGoal.required : catalogGoal.fields.filter(function (field) { return !["note", "reason", "settlementDate", "caseReference", "filingDeadline", "desiredDeadline", "successMeasure", "installmentAmount", "legalAmount", "legalDeadline", "legalPriority", "legalNote"].includes(field); });
    var missing = required.filter(function (field) { return !String(data[field] == null ? "" : data[field]).trim(); });
    if (goalId === "partial_payment_now" && data.remainingStrategy === "new_deadline" && !data.remainingDeadline) missing.push("remainingDeadline");
    goals.push({ goalId: goalId, cardId: item.c, stepNumber: goals.length + 1, confidence: ["high", "medium", "low"][item.k - 1] || "medium", goalData: data, derivedFields: derivedFields, fieldOrder: catalogGoal.fields.slice(), fieldIds: catalogGoal.fields.map(function (field) { return FIELD_ID_BY_KEY[field]; }), requiredFields: required, missing: missing, evidence: evidence, evidenceSpan: evidenceSpan, requiresHumanReview: true });
  }
  return goals.length ? goals : invalidProposal(diagnostics, "goal_plan_empty");
}
function clarificationResult(proposal, context, source) {
  proposal = normalizeLegacyGoalEvidence(proposal, source);
  var parsedProposal = RESPONSE_ZOD_SCHEMA.safeParse(proposal);
  if (parsedProposal.success) proposal = parsedProposal.data;
  else if (!lunaPolicy.hasExactKeys(proposal, ["p", "q", "x"])) return null;
  if (!Array.isArray(proposal.p) || proposal.p.length !== 0 || typeof proposal.q !== "string" || !proposal.q.trim() || proposal.q.length > 240) return null;
  var evidence = resolveEvidence(source, proposal.x);
  if (!evidence) return null;
  var sourceDocument = structuredContracts.createDocument(source);
  var evidenceSpan = structuredContracts.createEvidenceSpan(sourceDocument, evidence, "clause-1");
  if (!evidenceSpan || !structuredContracts.verifyEvidenceSpan(sourceDocument, evidenceSpan)) return null;
  var nextRound = Number(context && context.clarificationRound || 0) + 1;
  var exhausted = nextRound > MAX_CLARIFICATION_ROUNDS;
  return {
    goals: [],
    clarification: exhausted ? null : { question: proposal.q.trim(), clauseId: "clause-1", evidenceSpan: evidenceSpan, round: nextRound, maxRounds: MAX_CLARIFICATION_ROUNDS },
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
  var request = requestBody(source, context, options.userId);
  var responseAttemptLimit = Math.max(1, Math.min(2, Number(options.responseAttempts) || 2));
  try {
    var totalProviderAttempts = 0;
    var totalElapsedMs = 0;
    var lastInvalidReason = "goal_response_invalid";
    for (var responseAttempt = 1; responseAttempt <= responseAttemptLimit; responseAttempt += 1) {
      var attemptRequest = Object.assign({}, request);
      if (responseAttempt > 1) attemptRequest.instructions += " RESPONSE REPAIR ATTEMPT: the previous response was rejected by the compact contract for " + lastInvalidReason + ". Re-run Luna's semantic task from the unchanged input and emit one complete schema-valid p/q/x object. Do not explain the repair.";
      var transport = await lunaPolicy.requestOpenAi({ apiKey: apiKey, body: JSON.stringify(attemptRequest), fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs, maxAttempts: options.maxAttempts, sleepImpl: options.sleepImpl, randomImpl: options.randomImpl });
      totalProviderAttempts += transport.attempts;
      totalElapsedMs += transport.elapsedMs;
      var payload = transport.payload;
      var proposal = null;
      try { proposal = JSON.parse(responseText(payload)); } catch (_error) { proposal = null; }
      var diagnostics = {};
      var goals = materialize(proposal, context, source, diagnostics);
      var clarification = goals ? null : clarificationResult(proposal, context, source);
      if (goals || clarification) {
        var transportMeta = { attempts: totalProviderAttempts, elapsedMs: totalElapsedMs, responseAttempts: responseAttempt, responseRetries: responseAttempt - 1 };
        if (clarification) return Object.assign({}, clarification, {
          engineVersion: ATENA_ENGINE_VERSION, contractVersion: CONTRACT_VERSION,
          semanticPlan: { requested: true, attempted: true, source: "luna_goal_catalog_adapter", status: clarification.clarificationExhausted ? "CLARIFICATION_EXHAUSTED" : "CLARIFICATION_REQUIRED", reason: clarification.clarificationExhausted ? "luna_goal_clarification_exhausted" : "luna_goal_clarification", transport: transportMeta, usage: payload && payload.usage || null },
        });
        return { goals: goals, summary: "Atena je pripravila ciljne kartice za vaš pregled.", engineVersion: ATENA_ENGINE_VERSION, contractVersion: CONTRACT_VERSION,
          semanticPlan: { requested: true, attempted: true, source: "luna_goal_catalog_adapter", status: "OK", reason: "luna_goal_plan_applied", transport: transportMeta, usage: payload && payload.usage || null } };
      }
      lastInvalidReason = diagnostics.reason || "goal_response_invalid";
      if (process.env.NODE_ENV !== "production") console.warn("[goal-ai-plan]", lastInvalidReason);
    }
    throw aiError("Lunin odgovor ni skladen s ciljnim katalogom.", "LUNA_INVALID_GOAL_PLAN");
  } catch (error) {
    if (error && error.status) throw error;
    throw aiError("Luna trenutno ni dosegljiva.", "LUNA_UNAVAILABLE");
  }
}

module.exports = { analyze: analyze, requestBody: requestBody, ATENA_ENGINE_VERSION: ATENA_ENGINE_VERSION, CONTRACT_VERSION: CONTRACT_VERSION, MODEL: MODEL,
  MAX_TEXT_LENGTH: MAX_TEXT_LENGTH, MAX_GOALS: MAX_GOALS, MODEL_TIMEOUT_MS: MODEL_TIMEOUT_MS, MODEL_TIMEOUT_MAX_MS: MODEL_TIMEOUT_MAX_MS,
  MAX_CLARIFICATION_ROUNDS: MAX_CLARIFICATION_ROUNDS, RESPONSE_SCHEMA: RESPONSE_SCHEMA,
  RESPONSE_ZOD_SCHEMA: RESPONSE_ZOD_SCHEMA,
  _test: { materialize: materialize, clarificationResult: clarificationResult, equalInstallmentAmount: equalInstallmentAmount, installmentTargetAmount: installmentTargetAmount, lexicalSourceTokens: lexicalSourceTokens, resolveEvidence: resolveEvidence, catalog: GOAL_CATALOG, modelCatalog: MODEL_CATALOG, cardIdByGoal: CARD_ID_BY_GOAL, fieldIdByKey: FIELD_ID_BY_KEY, valueIdByFieldValue: VALUE_ID_BY_FIELD_VALUE } };
