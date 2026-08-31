"use strict";

var crypto = require("node:crypto");
var catalogContract = require("./atena-luna-catalog-contract");
var lunaPolicy = require("./atena-luna-policy");
var thinkingEngine = require("./zgodovina-thinking-engine");
var factEngine = require("./zgodovina-fact-engine");
var installmentEngine = require("./zgodovina-installment-engine");
var numberEngine = require("./zgodovina-number-engine");
var coverageEngine = require("./zgodovina-coverage-engine");
var temporalEngine = require("./zgodovina-temporal-engine");

var HISTORY_REQUEST_PROFILE = lunaPolicy.requestProfile("history");
var MODEL = lunaPolicy.MODEL;
var MODEL_TIMEOUT_MS = HISTORY_REQUEST_PROFILE.timeoutMs;
var MODEL_TIMEOUT_MAX_MS = HISTORY_REQUEST_PROFILE.timeoutMaxMs;
var ATENA_ENGINE_VERSION = "atena-v7";
var CONTRACT_VERSION = "history-fact-v99";
var MAX_TEXT_LENGTH = lunaPolicy.MAX_SOURCE_TEXT_LENGTH;
var MAX_CLARIFICATION_ANSWER_LENGTH = lunaPolicy.MAX_CLARIFICATION_ANSWER_LENGTH;
var MAX_CLARIFICATION_ROUNDS = lunaPolicy.MAX_CLARIFICATION_ROUNDS;
var MAX_LUNA_CALLS_PER_DESCRIPTION = 1 + MAX_CLARIFICATION_ROUNDS;
var MAX_EVENTS = lunaPolicy.MAX_STRUCTURED_ITEMS;
var ALLOWED_TYPES = [
  "partial_payment",
  "paid_in_full",
  "installment_payment",
  "unpaid_installment",
  "remaining_unpaid",
  "installment_agreement",
  "payment_promise",
  "deadline_extension",
  "payment_failed",
  "invoice_dispute",
  "insolvency",
  "credit_note",
  "compensation",
  "cancelled_invoice",
  "reminder_sent",
  "debtor_statement",
  "custom",
];

var PAYMENT_METHODS = ["bank_transfer", "cash", "card", "direct_debit", "other", "unknown"];
var COMMUNICATION_CHANNELS = ["phone", "email", "sms", "in_person", "letter", "other", "unknown"];
var CANONICAL_FIELD_NAMES = ["amountEur", "occurredDate", "promisedDate", "paymentMethod", "communicationChannel", "documentReference", "reason", "description"];
var FIELD_ID_BY_NAME = Object.freeze(CANONICAL_FIELD_NAMES.reduce(function (map, name, index) {
  map[name] = index + 1;
  return map;
}, {}));
var FIELD_NAME_BY_ID = Object.freeze(CANONICAL_FIELD_NAMES.reduce(function (map, name, index) {
  map[index + 1] = name;
  return map;
}, {}));
var CATALOG_VALUES = Object.freeze([
  [401, "paymentMethod", "bank_transfer", "bančno nakazilo"], [402, "paymentMethod", "cash", "gotovina"],
  [403, "paymentMethod", "card", "kartica"], [404, "paymentMethod", "direct_debit", "direktna obremenitev"],
  [405, "paymentMethod", "other", "drugo"], [406, "paymentMethod", "unknown", "ne vem"],
  [501, "communicationChannel", "phone", "telefon"], [502, "communicationChannel", "email", "e-pošta"],
  [503, "communicationChannel", "sms", "SMS"], [504, "communicationChannel", "in_person", "osebno"],
  [505, "communicationChannel", "letter", "pismo"], [506, "communicationChannel", "other", "drugo"],
  [507, "communicationChannel", "unknown", "ne vem"],
  [601, "datePrecision", "exact", "točen dan"], [602, "datePrecision", "month", "samo mesec"], [603, "datePrecision", "year", "samo leto"],
  [611, "dateStatus", "exact", "znan datum"], [612, "dateStatus", "approximate", "približno"], [613, "dateStatus", "unknown", "ne vem"],
  [621, "relationAnchor", "reference_date", "danes/referenceDate"], [622, "relationAnchor", "previous_event", "prejšnja kartica"],
  [631, "relationDirection", -1, "nazaj"], [632, "relationDirection", 0, "isti dan"], [633, "relationDirection", 1, "naprej"],
  [641, "relationUnit", "day", "dan"], [642, "relationUnit", "week", "teden"], [643, "relationUnit", "month", "mesec"], [644, "relationUnit", "year", "leto"],
  [651, "amountRelation", "total", "skupni znesek skupine"], [652, "amountRelation", "each", "znesek posameznega obroka"],
]);
var CATALOG_VALUE_BY_ID = Object.freeze(CATALOG_VALUES.reduce(function (map, row) { map[row[0]] = row[2]; return map; }, {}));
var CATALOG_ROW_BY_ID = Object.freeze(CATALOG_VALUES.reduce(function (map, row) { map[row[0]] = row; return map; }, {}));
var CARD_ID_BY_TYPE = Object.freeze(ALLOWED_TYPES.reduce(function (map, type, index) {
  map[type] = index + 1;
  return map;
}, {}));
var CARD_TYPE_BY_ID = Object.freeze(ALLOWED_TYPES.reduce(function (map, type, index) {
  map[index + 1] = type;
  return map;
}, {}));

function modelFieldName(name) { return name === "amount" ? "amountEur" : name; }

function authoritativeRule(fieldOrder, requiredFields, balanceEffect, dateRoles, fatherCategory) {
  return Object.freeze({
    fieldOrder: Object.freeze(fieldOrder.slice()),
    requiredFields: Object.freeze(requiredFields.slice()),
    balanceEffect: balanceEffect,
    dateRoles: Object.freeze((dateRoles || []).slice()),
    fatherCategory: fatherCategory,
  });
}

var AUTHORITATIVE_RULES = Object.freeze({
  partial_payment: authoritativeRule(["amount", "occurredDate", "paymentMethod"], ["amount", "occurredDate"], "subtract", ["occurredDate"], "partial"),
  paid_in_full: authoritativeRule(["amount", "occurredDate", "paymentMethod"], ["amount", "occurredDate"], "subtract", ["occurredDate"], "full"),
  installment_payment: authoritativeRule(["amount", "occurredDate", "paymentMethod"], ["amount", "occurredDate"], "subtract", ["occurredDate"], "installment"),
  unpaid_installment: authoritativeRule(["occurredDate"], ["occurredDate"], "none", ["dueDate"], "unpaid_installment"),
  remaining_unpaid: authoritativeRule(["amount"], ["amount"], "none", [], "collection_outcome"),
  installment_agreement: authoritativeRule(["occurredDate", "description"], ["occurredDate", "description"], "none", ["occurredDate", "dueDate"], "installment"),
  payment_promise: authoritativeRule(["amount", "occurredDate", "promisedDate", "communicationChannel"], ["occurredDate", "promisedDate", "communicationChannel"], "none", ["occurredDate", "promisedDate"], "payment_promised"),
  deadline_extension: authoritativeRule(["occurredDate", "promisedDate", "communicationChannel", "description"], ["occurredDate", "promisedDate", "communicationChannel", "description"], "none", ["occurredDate", "promisedDate"], "payment_promised"),
  payment_failed: authoritativeRule(["occurredDate", "paymentMethod", "description"], ["occurredDate", "paymentMethod", "description"], "none", ["occurredDate"], "payment_failed"),
  invoice_dispute: authoritativeRule(["occurredDate", "communicationChannel", "description"], ["occurredDate", "communicationChannel", "description"], "none", ["occurredDate"], "invoice_dispute"),
  insolvency: authoritativeRule(["occurredDate", "description"], ["occurredDate", "description"], "none", ["occurredDate"], "insolvency"),
  credit_note: authoritativeRule(["amount", "occurredDate"], ["amount", "occurredDate"], "subtract", ["occurredDate"], "credit_note"),
  compensation: authoritativeRule(["amount", "occurredDate"], ["amount", "occurredDate"], "subtract", ["occurredDate"], "compensation"),
  cancelled_invoice: authoritativeRule(["occurredDate", "reason"], ["occurredDate", "reason"], "none", ["occurredDate"], "cancelled_invoice"),
  debtor_statement: authoritativeRule(["occurredDate", "communicationChannel", "description"], ["occurredDate", "communicationChannel", "description"], "none", ["occurredDate"], "invoice_dispute"),
  reminder_sent: authoritativeRule(["occurredDate", "communicationChannel"], ["occurredDate", "communicationChannel"], "none", ["occurredDate"], "collection_action"),
  custom: authoritativeRule(["occurredDate", "description"], ["occurredDate", "description"], "none", ["occurredDate"], "custom"),
});
var HISTORY_CARD_CONTEXT = Object.freeze({
  partial_payment: ["Partial payment completed", "A past payment reduced only part of the debt.", "Not a future promise, installment-plan agreement, credit note, or set-off.", ["paid 100 yesterday"]],
  paid_in_full: ["Full payment completed", "A past payment settled the full then-remaining debt.", "Not a future promise to pay everything.", ["paid the entire debt today"]],
  installment_payment: ["Installment paid", "One or more installments were actually paid in the past; expand repeated payments into separate cards.", "Not an agreed future installment or an unpaid installment.", ["paid 8 installments every two weeks"]],
  unpaid_installment: ["Installment missed", "A specific installment became due but was not paid.", "Not a generic remaining balance or future installment.", ["the second installment was not paid"]],
  remaining_unpaid: ["Remaining amount unpaid", "The source explicitly states what remained unpaid or that no more was paid after completed reductions.", "Never infer it merely from arithmetic without an explicit remaining/no-more-payment outcome.", ["100 was paid and 334 remained"]],
  installment_agreement: ["Installment agreement made", "A past event in which the parties formed an installment agreement.", "Not the future installment payments themselves.", ["we agreed yesterday on three installments"]],
  payment_promise: ["Payment promised", "A past communication in which the debtor made a future payment promise.", "Not an actually completed payment or a refusal.", ["he promised yesterday to pay Friday"]],
  deadline_extension: ["Deadline extended", "A past agreement or decision moved the future payment deadline.", "Not an ordinary future promise with an amount.", ["we extended the deadline last week"]],
  payment_failed: ["Payment attempt failed", "A past attempted payment, transfer, debit, card charge, or similar operation failed.", "Not an unpaid due installment without an attempted transaction.", ["the direct debit failed yesterday"]],
  invoice_dispute: ["Invoice disputed", "The debtor raised a past objection about the invoice, contract, work, amount, quality, or entitlement.", "Not a refusal based only on inability or unwillingness to pay.", ["he disputed the invoice by email"]],
  insolvency: ["Insolvency event", "A past bankruptcy, compulsory-settlement, or other insolvency event became known or occurred.", "Not the creditor's future goal to file a claim.", ["bankruptcy was opened last month"]],
  credit_note: ["Credit note issued", "A past credit note reduced the receivable.", "Not a cash payment, set-off, or cancelled invoice.", ["we issued a 50 euro credit note"]],
  compensation: ["Set-off completed", "A past set-off or compensation reduced the receivable.", "Not a future desired set-off.", ["we offset 120 euros yesterday"]],
  cancelled_invoice: ["Invoice cancelled", "The invoice was actually cancelled in the past.", "Not a write-off goal or disputed invoice.", ["we cancelled the invoice on Monday"]],
  reminder_sent: ["Reminder sent", "A reminder, demand, or collection communication was actually sent in the past.", "Not a future goal to have a lawyer prepare or send one.", ["we emailed a reminder yesterday"]],
  debtor_statement: ["Debtor statement", "A past debtor statement or refusal relevant to collection that is neither a promise nor substantive invoice dispute.", "Not a positive payment promise.", ["he said he would not pay"]],
  custom: ["Other historical event", "Only a past event that fits none of the specialized history cards.", "Never for payments, installments, promises, deadlines, failed payments, disputes, insolvency, credit notes, set-off, cancellation, reminders, or debtor statements.", ["another genuinely unsupported past event"]],
});
var HISTORY_MODEL_FIELDS = Object.freeze([
  [1, "amountEur", "final EUR amount for this one event"], [2, "occurredDate", "date this historical event occurred"], [3, "promisedDate", "future deadline stated inside a past promise/agreement"],
  [4, "paymentMethod", "method of an actual or attempted payment"], [5, "communicationChannel", "channel used for the past communication"], [6, "documentReference", "invoice, case, or other document reference"],
  [7, "reason", "explicit reason for the historical event"], [8, "description", "material detail of what happened or was said"],
]);

var MODEL_CATALOG = Object.freeze({
  lexiconVersion: catalogContract.LEXICON_VERSION,
  wire: Object.freeze([
    [1, "cardNumber"], [2, "cardId"], [3, "evidenceText"], [4, "fields"], [101, "fieldId"], [102, "numberValue"],
    [103, "textValue"], [104, "valueId"], [105, "fieldEvidenceText"], [106, "datePrecisionId"], [107, "dateStatusId"],
    [108, "relationAnchorId"], [109, "relationDirectionId"], [110, "relationAmount"], [111, "relationUnitId"], [112, "relationDayOfMonth"],
  ]),
  guideColumns: Object.freeze(["cardId", "key", "title", "useWhen", "doNotUseWhen", "aliases", "examples"]),
  fields: HISTORY_MODEL_FIELDS,
  cards: Object.freeze(ALLOWED_TYPES.map(function (type, index) {
    var rule = AUTHORITATIVE_RULES[type] || AUTHORITATIVE_RULES.custom;
    return Object.freeze([
      index + 1, type,
      rule.fieldOrder.map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }),
      rule.requiredFields.map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }),
    ]);
  })),
  values: CATALOG_VALUES,
  guide: Object.freeze(catalogContract.buildCardGuide(ALLOWED_TYPES.map(function (type, index) {
    var rule = AUTHORITATIVE_RULES[type] || AUTHORITATIVE_RULES.custom;
    var context = HISTORY_CARD_CONTEXT[type];
    return { cardId: index + 1, key: type, title: context[0], purpose: context[1], useWhen: context[1], doNotUseWhen: context[2], examples: context[3], fieldIds: rule.fieldOrder.map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }), requiredFieldIds: rule.requiredFields.map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }) };
  }), HISTORY_MODEL_FIELDS, CATALOG_VALUES, { flow: "history" }).map(function (card) {
    return Object.freeze([
      card.cardId, card.key, card.title, card.useWhen, card.doNotUseWhen,
      Object.freeze(card.languageProfile.synonyms.concat(card.languageProfile.colloquial)),
      card.examples,
    ]);
  })),
});
var RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["p", "q", "x", "k"],
  properties: {
    p: {
      type: "array",
      maxItems: MAX_EVENTS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["c", "e", "i", "v", "x", "r"],
        properties: {
          c: { type: "integer", minimum: 1, maximum: ALLOWED_TYPES.length },
          e: { type: "string", minLength: 1, maxLength: 500 },
          i: { type: "array", maxItems: 8, items: { type: "integer", minimum: 1, maximum: CANONICAL_FIELD_NAMES.length } },
          v: { type: "array", maxItems: 8, items: { type: ["number", "string", "null"], maxLength: 500 } },
          x: { type: "array", maxItems: 8, items: { type: "string", minLength: 1, maxLength: 500 } },
          r: {
            type: "array", maxItems: 8,
            items: { type: "array", maxItems: 7, items: { type: ["integer", "null"] } },
          },
        },
      },
    },
    q: { type: ["string", "null"], maxLength: 180 },
    x: { type: ["string", "null"], maxLength: 500 },
    k: { type: ["integer", "null"], enum: [1, 2, null] },
  },
};
lunaPolicy.assertPortableResponseSchema(RESPONSE_SCHEMA);

function trimText(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function validIsoDate(value) {
  var text = trimText(value, 10);
  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  var date = new Date(text + "T12:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
}

function positiveAmount(value) {
  if (value == null || value === "") return null;
  var amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function normalizeNaturalText(value) {
  return trimText(value, MAX_TEXT_LENGTH)
    .toLowerCase()
    .normalize("NFC")
    .replace(/\bplacal(a|i|o)?\b/gu, "plačal$1")
    .replace(/\bplacan(a|i|o)?\b/gu, "plačan$1")
    .replace(/\bneplacan(a|o|i|e)?\b/gu, "neplačan$1")
    .replace(/\b(?:dolzan|dovzan|douzan|dovžan|doužan|dožan)\b/gu, "dolžan")
    .replace(/\b(?:dolzna|dovzna|douzna|dovžna|doužna|dožna)\b/gu, "dolžna")
    .replace(/\s+/g, " ");
}

function slovenianNumber(value) {
  var text = trimText(value, 40).toLowerCase();
  var parsed = numberEngine.parseSlovenianNumber(text);
  if (Number.isFinite(parsed)) return parsed;
  var shares = { pol: 50, polovico: 50, četrtino: 25, četrt: 25 };
  return Object.prototype.hasOwnProperty.call(shares, text) ? shares[text] : null;
}

var FRACTION_NUMBER_SOURCE = "(?<![\\p{L}\\d])(?:pol|polovico|četrtino|četrt)(?![\\p{L}\\d])";
var NUMBER_PART = "(" + numberEngine.NUMBER_EXPRESSION_SOURCE + "|" + FRACTION_NUMBER_SOURCE + ")";
var INSTALLMENT_COUNT_SUFFIX = "(?:\\.|-?(?:h|ih|eh))?";
var PERCENT_PART = "(?:%|odstot(?:ek|ka|kov|ke|ki)?|procent(?:ov|a|i)?)";
var PAYMENT_PART = "(?:plačal(?:a|i|o)?|plačan(?:a|i|o)?|poravnal(?:a|i|o)?|poravnan(?:a|i|o)?|nakazal(?:a|i|o)?|nakazano|dal(?:a|i|o)?(?:\\s+je)?|prejel(?:a|i|o)?(?:\\s+(?:sem|smo))?\\s+nakazilo)";
var REMAINING_PART = "(?:dolžan|dolžna|dolguje|ostal(?:o|a)?|ostane|preostal(?:o|a)?|preostane|preostanek|odprto)";
var REMAINING_LINK = "(?:\\s+(?:je|pa|še|mu|ji|znaša|znašal|znašala|znašalo)){0,5}";

function firstNumber(text, expression) {
  var match = text.match(expression);
  return match ? slovenianNumber(match[1]) : null;
}

function inferAmountFromText(text, context) {
  var normalized = normalizeNaturalText(text);
  var debt = positiveAmount(context && context.remainingDebt);
  if (!debt) return { amount: null, source: null, ambiguous: false };
  var paymentScope = normalized;
  var paymentVerb = new RegExp(PAYMENT_PART, "i").exec(normalized);
  if (paymentVerb) {
    paymentScope = normalized.slice(paymentVerb.index);
    var remainingAfterPayment = new RegExp("\\b" + REMAINING_PART + "\\b", "i").exec(paymentScope.slice(paymentVerb[0].length));
    if (remainingAfterPayment) paymentScope = paymentScope.slice(0, paymentVerb[0].length + remainingAfterPayment.index);
  }
  var paidPercent = firstNumber(paymentScope, new RegExp(PAYMENT_PART + "[^.!?;]{0,50}?" + NUMBER_PART + "\\s*" + PERCENT_PART, "i"));
  var remainingPercent = firstNumber(normalized, new RegExp(REMAINING_PART + REMAINING_LINK + "[^.!?;]{0,12}?" + NUMBER_PART + "\\s*" + PERCENT_PART, "i"));
  var paidAmount = firstNumber(paymentScope, new RegExp(PAYMENT_PART + "[^.!?;]{0,50}?" + NUMBER_PART + "\\s*(?:€|eur(?:ov|a)?|evr(?:ov|a)?)", "i"));
  if (paidAmount == null) {
    paidAmount = firstNumber(paymentScope, new RegExp(PAYMENT_PART + "(?:\\s+(?:je|samo|le|zgolj|skupaj)){0,3}\\s+" + NUMBER_PART + "(?![a-zčšž0-9])(?![.,]\\d)(?!\\s*(?:obrok|dan|dni|%|odstot|procent))(?!\\s+(?:dolga|zneska|terjatve|obveznosti))", "i"));
  }
  var remainingAmount = firstNumber(normalized, new RegExp(REMAINING_PART + REMAINING_LINK + "[^.!?;]{0,12}?" + NUMBER_PART + "\\s*(?:€|eur(?:ov|a)?|evr(?:ov|a)?)", "i"));
  var amountContract = factEngine.buildFactContract(normalized);
  function contractAmount(category) {
    var fact = amountContract.facts.find(function (item) {
      return item.kind === "money" && item.category === category && Number.isFinite(item.value);
    });
    return fact ? fact.value : null;
  }
  if (paidAmount == null && paidPercent == null) paidAmount = contractAmount("partial") || contractAmount("installment") || contractAmount("full");
  if (paidPercent == null) {
    paidPercent = firstNumber(paymentScope, new RegExp(PAYMENT_PART + "[^.!?;]{0,30}?(polovico|pol|četrtino|četrt)\\s+(?:dolga|zneska|obveznosti)", "i"));
  }
  if (paidPercent != null && remainingPercent == null) {
    var unitlessRemainder = firstNumber(normalized, new RegExp(REMAINING_PART + REMAINING_LINK + "\\s*" + NUMBER_PART + "(?!\\s*(?:€|eur|%|odstot|procent))", "i"));
    if (unitlessRemainder != null) remainingPercent = unitlessRemainder;
  }
  if (remainingAmount == null && remainingPercent == null) remainingAmount = contractAmount("unpaid_installment");
  var proposals = [];
  function add(value, source) {
    if (Number.isFinite(value) && value >= 0 && value <= debt + 0.009) proposals.push({ amount: roundMoney(value), source: source });
  }
  if (paidPercent != null && paidPercent >= 0 && paidPercent <= 100) add(debt * paidPercent / 100, "paidPercent");
  if (remainingPercent != null && remainingPercent >= 0 && remainingPercent <= 100) add(debt * (100 - remainingPercent) / 100, "remainingPercent");
  if (paidAmount != null) add(paidAmount, "paidAmount");
  if (remainingAmount != null) add(debt - remainingAmount, "remainingAmount");
  var remainingBalance = remainingAmount != null && remainingAmount >= 0 && remainingAmount <= debt + 0.009
    ? roundMoney(remainingAmount)
    : remainingPercent != null && remainingPercent >= 0 && remainingPercent <= 100
      ? roundMoney(debt * remainingPercent / 100)
      : null;
  if (!proposals.length) return { amount: null, remainingAmount: remainingBalance, source: null, ambiguous: false };
  var amount = proposals[0].amount;
  var ambiguous = proposals.some(function (proposal) { return Math.abs(proposal.amount - amount) > 0.01; });
  return { amount: ambiguous || amount <= 0 ? null : amount, remainingAmount: remainingBalance, source: ambiguous ? null : proposals.map(function (proposal) { return proposal.source; }).join("+"), ambiguous: ambiguous };
}

function explicitEuroAmount(text) {
  return firstNumber(trimText(text, MAX_TEXT_LENGTH).toLowerCase(), new RegExp(NUMBER_PART + "\\s*(?:€|eur(?:ov|a)?|evr(?:ov|a)?)", "i"));
}

function isCreditNoteMentioned(text) {
  return factEngine.buildFactContract(text).fatherCategories.indexOf("credit_note") >= 0;
}

function isCompensationMentioned(text) {
  return factEngine.buildFactContract(text).fatherCategories.indexOf("compensation") >= 0;
}

function inferCategorizedEuroAmount(text, categoryPattern) {
  var normalized = normalizeNaturalText(text);
  var currency = "(?:€|eur(?:ov|a)?|evr(?:ov|a)?)";
  var before = firstNumber(normalized, new RegExp(NUMBER_PART + "\\s*" + currency + "[^.!?;]{0,18}\\b(?:" + categoryPattern + ")\\b", "i"));
  if (before != null) return roundMoney(before);
  var after = firstNumber(normalized, new RegExp("\\b(?:" + categoryPattern + ")\\b[^.!?;]{0,18}?" + NUMBER_PART + "\\s*" + currency, "i"));
  if (after != null) return roundMoney(after);
  var adjacentBefore = firstNumber(normalized, new RegExp(NUMBER_PART + "\\s+(?:" + categoryPattern + ")\\b", "i"));
  if (adjacentBefore != null) return roundMoney(adjacentBefore);
  var adjacentAfter = firstNumber(normalized, new RegExp("\\b(?:" + categoryPattern + ")\\b\\s*(?:za|v\\s+(?:višini|vrednosti))?\\s*" + NUMBER_PART + "\\b", "i"));
  if (adjacentAfter != null) return roundMoney(adjacentAfter);
  var category = normalized.match(new RegExp("\\b(?:" + categoryPattern + ")\\b", "i"));
  if (!category) return null;
  var start = Math.max(0, category.index - 60);
  var prefix = normalized.slice(start, category.index);
  var numberPattern = new RegExp(NUMBER_PART, "gi");
  var nearest = null;
  var numberMatch;
  while ((numberMatch = numberPattern.exec(prefix))) nearest = numberMatch;
  if (!nearest) return null;
  var bridge = prefix.slice(nearest.index + nearest[0].length).trim();
  if (bridge.length > 40 || /\bobrok\w*/i.test(bridge)) return null;
  if (bridge && !/^(?:(?:in|nato|potem|zatem|pa|je|bil|bila|bilo|sem|smo|mu|jim|dal|dala|dali|dobil|dobila|dobili|prejel|prejela|prejeli|izdal|izdala|izdali|v|za|kot|obliki|višini|vrednosti)\s*)+$/i.test(bridge)) return null;
  var anchored = slovenianNumber(nearest[1]);
  return Number.isFinite(anchored) && anchored > 0 ? roundMoney(anchored) : null;
}

function nearestFactAmount(contract, categoryName, sourceText) {
  var category = contract.facts.find(function (fact) { return fact.kind === "category" && fact.category === categoryName && fact.assertion === "positive"; });
  if (!category || !category.sourceSpan) return null;
  var moneyFacts = contract.facts.filter(function (fact) { return fact.kind === "money" && fact.clauseId === category.clauseId && fact.sourceSpan; });
  moneyFacts.sort(function (a, b) {
    function distance(fact) {
      if (fact.sourceSpan.end <= category.sourceSpan.start) return category.sourceSpan.start - fact.sourceSpan.end;
      if (category.sourceSpan.end <= fact.sourceSpan.start) return fact.sourceSpan.start - category.sourceSpan.end;
      return 0;
    }
    return distance(a) - distance(b);
  });
  var nearest = moneyFacts[0];
  if (!nearest) return null;
  var bridgeStart = Math.min(nearest.sourceSpan.end, category.sourceSpan.end);
  var bridgeEnd = Math.max(nearest.sourceSpan.start, category.sourceSpan.start);
  var bridge = String(sourceText || "").slice(bridgeStart, bridgeEnd);
  if (/\bobrok\w*\b/i.test(bridge)) return null;
  return positiveAmount(nearest.value);
}

function inferCreditNoteAmount(text, context) {
  if (!isCreditNoteMentioned(text)) return null;
  var contract = factEngine.buildFactContract(text);
  return nearestFactAmount(contract, "credit_note", text) || inferCategorizedEuroAmount(text, "dobropis\\w*|dobropisna\\s+nota|kreditna\\s+nota") || inferSettlementShare(text, context);
}

function inferCompensationAmount(text, context) {
  if (!isCompensationMentioned(text)) return null;
  var contract = factEngine.buildFactContract(text);
  return nearestFactAmount(contract, "compensation", text) || inferCategorizedEuroAmount(text, "kompenz\\w*|pobot\\w*") || inferSettlementShare(text, context);
}

function detectFatherCategories(text) {
  var discovered = new Set(factEngine.buildFactContract(text).fatherCategories || []);
  return Object.keys(factEngine.FATHER_ONTOLOGY).filter(function (father) { return discovered.has(father); });
}

function inferSettlementShare(text, context) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  var debt = positiveAmount(context && context.remainingDebt);
  if (!debt) return null;
  var percent = firstNumber(normalized, new RegExp(NUMBER_PART + "\\s*" + PERCENT_PART, "i"));
  if (percent != null && percent > 0 && percent <= 100) return roundMoney(debt * percent / 100);
  if (/\b(?:polovico|pol)\s+(?:dolga|terjatve|obveznosti)\b/i.test(normalized)) return roundMoney(debt / 2);
  if (/\b(?:četrtino|četrt)\s+(?:dolga|terjatve|obveznosti)\b/i.test(normalized)) return roundMoney(debt / 4);
  return null;
}

function inferRepeat(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  var groups = installmentEngine.extractInstallmentGroups(normalized).filter(function (group) { return group.completed === true; });
  if (groups.length === 1) return groups[0].count;
  var match = normalized.match(new RegExp(NUMBER_PART + INSTALLMENT_COUNT_SUFFIX + "\\s+(?:obrok(?:a|e|i|ov|u)?|plačil(?:a|i)?)\\b", "i"));
  var repeat = match ? slovenianNumber(match[1]) : null;
  return Number.isInteger(repeat) && repeat >= 1 && repeat <= MAX_EVENTS ? repeat : 1;
}

function splitMoneyEvenly(total, repeat) {
  var cents = Math.round(Number(total) * 100);
  if (!Number.isInteger(repeat) || repeat < 2 || !Number.isFinite(cents) || cents <= 0) return null;
  var base = Math.floor(cents / repeat);
  var remainder = cents - base * repeat;
  return Array.from({ length: repeat }, function (_, index) {
    return (base + (index >= repeat - remainder ? 1 : 0)) / 100;
  });
}

function inferInstallmentBreakdown(text) {
  var normalized = normalizeNaturalText(text);
  var installmentGroups = installmentEngine.extractInstallmentGroups(normalized).filter(function (group) { return group.completed === true; });
  if (installmentGroups.length) {
    var groupAmounts = installmentEngine.expandCompletedGroups(installmentGroups);
    var groupTotal = groupAmounts.reduce(function (sum, amount) { return sum + amount; }, 0);
    var groupBreakdown = {
      repeat: groupAmounts.length,
      amount: installmentGroups.length === 1 ? installmentGroups[0].amount : null,
      amounts: installmentGroups.length === 1 ? null : groupAmounts,
      total: roundMoney(groupTotal),
    };
    if (installmentGroups.length > 1) groupBreakdown.source = "explicit_installment_groups";
    else if (!installmentGroups[0].explicitNoun) groupBreakdown.source = installmentGroups[0].reason;
    return groupBreakdown;
  }
  var ordinalMap = { prvi: 1, prvega: 1, prva: 1, drugi: 2, drugega: 2, druga: 2, tretji: 3, tretjega: 3, tretja: 3, četrti: 4, četrtega: 4, četrta: 4, peti: 5, petega: 5, peta: 5, šesti: 6, šestega: 6, šesta: 6, sedmi: 7, sedmega: 7, sedma: 7, osmi: 8, osmega: 8, osma: 8, deveti: 9, devetega: 9, deveta: 9, deseti: 10, desetega: 10, deseta: 10 };
  var ordinalPart = "(prvi|prvega|prva|drugi|drugega|druga|tretji|tretjega|tretja|četrti|četrtega|četrta|peti|petega|peta|šesti|šestega|šesta|sedmi|sedmega|sedma|osmi|osmega|osma|deveti|devetega|deveta|deseti|desetega|deseta)";
  var ordinalAmounts = {};
  function collectOrdinal(pattern, amountGroup, ordinalGroup) {
    var match;
    while ((match = pattern.exec(normalized))) {
      var amount = slovenianNumber(match[amountGroup]);
      var ordinal = ordinalMap[String(match[ordinalGroup] || "").toLowerCase()];
      if (Number.isFinite(amount) && amount > 0 && Number.isInteger(ordinal) && !ordinalAmounts[ordinal]) ordinalAmounts[ordinal] = roundMoney(amount);
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }
  collectOrdinal(new RegExp(NUMBER_PART + "\\s*(?:€|eur(?:ov|a)?|evr(?:ov|a)?)[^,;.!?]{0,38}?\\b(?:kot\\s+)?" + ordinalPart + "(?:\\s+obrok\\w*)?", "gi"), 1, 2);
  collectOrdinal(new RegExp("\\b" + ordinalPart + "(?:\\s+obrok\\w*)?[^,;.!?]{0,38}?" + NUMBER_PART + "\\s*(?:€|eur(?:ov|a)?|evr(?:ov|a)?)", "gi"), 2, 1);
  var ordinalKeys = Object.keys(ordinalAmounts).map(Number).sort(function (a, b) { return a - b; });
  if (ordinalKeys.length >= 2 && ordinalKeys[0] === 1 && ordinalKeys.every(function (ordinal, index) { return ordinal === index + 1; })) {
    var orderedAmounts = ordinalKeys.map(function (ordinal) { return ordinalAmounts[ordinal]; });
    return { repeat: orderedAmounts.length, amount: null, amounts: orderedAmounts, total: roundMoney(orderedAmounts.reduce(function (sum, amount) { return sum + amount; }, 0)), source: "explicit_ordinal_installments" };
  }
  var multiplierMatch = normalized.match(/\b(\d{1,2}|dva|dve|tri)\s*(?:x|×|-\s*krat|\s+krat)\s*(?:vsak\s+)?po\s+/i);
  var wordMultiplierMatch = multiplierMatch ? null : normalized.match(/\b(dvakrat|trikrat)\s+(?:vsak\s+)?po\s+/i);
  var multiplierCount = multiplierMatch
    ? slovenianNumber(multiplierMatch[1])
    : wordMultiplierMatch && /^dvakrat$/i.test(wordMultiplierMatch[1]) ? 2
      : wordMultiplierMatch ? 3 : null;
  var multiplierEnd = multiplierMatch
    ? multiplierMatch.index + multiplierMatch[0].length
    : wordMultiplierMatch ? wordMultiplierMatch.index + wordMultiplierMatch[0].length : -1;
  if (Number.isInteger(multiplierCount) && multiplierCount >= 2 && multiplierCount <= MAX_EVENTS && multiplierEnd >= 0) {
    var multiplierAmount = firstNumber(normalized.slice(multiplierEnd), new RegExp("^" + NUMBER_PART + "\\s*(?:€|eur(?:ov|a)?|evr(?:ov|a)?)", "i"));
    if (Number.isFinite(multiplierAmount) && multiplierAmount > 0) {
      return { repeat: multiplierCount, amount: roundMoney(multiplierAmount), amounts: null, total: roundMoney(multiplierCount * multiplierAmount), source: "explicit_local_multiplier" };
    }
  }
  var aggregate = normalized.match(new RegExp(NUMBER_PART + "\\s*(?:€|eur(?:ov|a)?|evr(?:ov|a)?)[^.!?;]{0,24}?\\bv\\s+" + NUMBER_PART + INSTALLMENT_COUNT_SUFFIX + "\\s+obrok\\w*", "i"));
  if (!aggregate) {
    aggregate = normalized.match(new RegExp(NUMBER_PART + "\\s+(?:(?:skupaj|razdeljen\\w*)\\s+)?(?:v|na)\\s+" + NUMBER_PART + INSTALLMENT_COUNT_SUFFIX + "\\s+obrok\\w*", "i"));
  }
  var aggregateBreakdown = null;
  if (aggregate) {
    var aggregateTotal = slovenianNumber(aggregate[1]);
    var aggregateRepeat = slovenianNumber(aggregate[2]);
    if (Number.isInteger(aggregateRepeat) && aggregateRepeat >= 2 && aggregateRepeat <= MAX_EVENTS && Number.isFinite(aggregateTotal) && aggregateTotal > 0) {
      aggregateBreakdown = { repeat: aggregateRepeat, amount: null, amounts: splitMoneyEvenly(aggregateTotal, aggregateRepeat), total: roundMoney(aggregateTotal) };
    }
  }
  var perInstallment = normalized.match(new RegExp(NUMBER_PART + INSTALLMENT_COUNT_SUFFIX + "\\s+obrok\\w*[^.!?;]{0,24}?\\bpo\\s+" + NUMBER_PART + "\\s*(?:€|eur(?:ov|a)?|evr(?:ov|a)?)", "i"));
  if (!perInstallment) {
    perInstallment = normalized.match(new RegExp(NUMBER_PART + INSTALLMENT_COUNT_SUFFIX + "\\s+obrok\\w*[^.!?;]{0,24}?\\bpo\\s+(tisočaka|jurja)(?=\\s|$|[.!?,;])", "i"));
  }
  if (perInstallment) {
    var directRepeat = slovenianNumber(perInstallment[1]);
    var directAmount = slovenianNumber(perInstallment[2]);
    if (Number.isInteger(directRepeat) && directRepeat >= 2 && directRepeat <= MAX_EVENTS && Number.isFinite(directAmount) && directAmount > 0) {
      if (aggregateBreakdown && aggregateBreakdown.repeat === directRepeat && Math.abs(aggregateBreakdown.total - directRepeat * directAmount) > 0.009) return aggregateBreakdown;
      return { repeat: directRepeat, amount: roundMoney(directAmount), amounts: null, total: roundMoney(directRepeat * directAmount) };
    }
  }
  return aggregateBreakdown;
}

function inferUnpaidInstallment(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase().replace(/\s+/g, " ");
  var numeric = normalized.match(/\b(\d{1,2})\.?\s*obrok\w*(?:\s+pa)?\s+(?:še\s+ni|ni\s+(?:še\s+)?)(?:\s+(?:plačan|poravnan))?/i);
  var ordinalWords = {
    prvi: 1, prvega: 1, drugi: 2, drugega: 2, tretji: 3, tretjega: 3, četrti: 4, četrtega: 4,
    peti: 5, petega: 5, šesti: 6, šestega: 6, sedmi: 7, sedmega: 7, osmi: 8, osmega: 8,
    deveti: 9, devetega: 9, deseti: 10, desetega: 10,
  };
  var word = normalized.match(/(prvi|prvega|drugi|drugega|tretji|tretjega|četrti|četrtega|peti|petega|šesti|šestega|sedmi|sedmega|osmi|osmega|deveti|devetega|deseti|desetega)\b(?:\s+obrok\w*)?(?:\s+pa)?\s+(?:še\s+ni|ni\s+(?:še\s+)?)(?:\s+(?:plačan|poravnan))?/i);
  var paidSequence = normalized.match(/\b(?:prv(?:a|e|i|ih)\s+)?(\d{1,2}|en|ena|eno|dva|dve|dveh|tri|treh|štiri|štirih|pet|petih|šest|šestih|sedem|sedmih|osem|osmih|devet|devetih|deset|desetih)\s+obrok\w*(?=[^.!?]{0,100}\b(?:potem|nato)\b(?:\s+pa)?[^.!?]{0,35}\b(?:ni\s+(?:več\s+)?nič\s+(?:plačal\w*|poravnal\w*)|nič\s+več\s+ni\s+(?:plačal\w*|poravnal\w*)|nič\s+več)(?=\s|$|[.!?,;]))/i);
  var paidCount = paidSequence ? slovenianNumber(paidSequence[1]) : null;
  var explicitBreakdown = inferInstallmentBreakdown(normalized);
  var stoppedAfterSequence = /(?:\bna\s+koncu\s+|\bpotem(?:\s+pa)?\s+|\bnato(?:\s+pa)?\s+)?nič\s+več(?=\s|$|[.!?,;])/i.test(normalized);
  var completedInstallmentGroup = installmentEngine.extractInstallmentGroups(normalized).some(function (group) { return group.completed === true; });
  var repeatedCompletedSequence = explicitBreakdown && (explicitBreakdown.source === "explicit_local_multiplier" || new RegExp("\\b" + NUMBER_PART + INSTALLMENT_COUNT_SUFFIX + "\\s+obrok\\w*[^.!?;]{0,24}?\\bpo\\s+" + NUMBER_PART, "i").test(normalized));
  var installmentNumber = numeric ? Number(numeric[1]) : word ? ordinalWords[word[1]] : completedInstallmentGroup && stoppedAfterSequence ? null : Number.isInteger(paidCount) && !repeatedCompletedSequence ? paidCount + 1 : explicitBreakdown && !repeatedCompletedSequence && stoppedAfterSequence ? explicitBreakdown.repeat + 1 : null;
  if (!Number.isInteger(installmentNumber) || installmentNumber < 1 || installmentNumber > MAX_EVENTS) return null;
  return { installmentNumber: installmentNumber, description: installmentNumber + ". obrok ni plačan" };
}

function shiftIsoDate(iso, days) {
  var date = new Date(iso + "T12:00:00.000Z");
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function relativeDateCount(value) {
  var normalized = trimText(value, 30).toLowerCase();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  var counts = {
    "en": 1, "ena": 1, "eno": 1, "enim": 1, "enem": 1,
    "dva": 2, "dve": 2, "dveh": 2, "dvema": 2,
    "tri": 3, "treh": 3, "tremi": 3,
    "štiri": 4, "stiri": 4, "štirih": 4, "stirih": 4, "štirimi": 4, "stirimi": 4,
    "pet": 5, "petih": 5, "petimi": 5,
    "šest": 6, "sest": 6, "šestih": 6, "sestih": 6, "šestimi": 6, "sestimi": 6,
    "sedem": 7, "sedmih": 7, "sedmimi": 7,
    "osem": 8, "osmih": 8, "osmimi": 8,
    "devet": 9, "devetih": 9, "devetimi": 9,
    "deset": 10, "desetih": 10, "desetimi": 10,
  };
  return Object.prototype.hasOwnProperty.call(counts, normalized) ? counts[normalized] : null;
}

function shiftIsoMonths(iso, months) {
  var source = new Date(iso + "T12:00:00.000Z");
  if (Number.isNaN(source.getTime())) return null;
  var originalDay = source.getUTCDate();
  source.setUTCDate(1);
  source.setUTCMonth(source.getUTCMonth() + months);
  var lastDay = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 0, 12)).getUTCDate();
  source.setUTCDate(Math.min(originalDay, lastDay));
  return source.toISOString().slice(0, 10);
}

function inferOccurredDate(text, referenceDate) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  var reference = validIsoDate(referenceDate);
  if (!reference) return null;
  if (/\b(?:ne vem kdaj|datum (?:ni znan|je neznan)|neznanega datuma)\b/i.test(normalized)) return null;
  var iso = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return validIsoDate(iso[1]);
  if (/\bpredvčeraj(?:šnjim)?\b/i.test(normalized)) return shiftIsoDate(reference, -2);
  if (/\bvčeraj\b/i.test(normalized)) return shiftIsoDate(reference, -1);
  if (/\bdanes\b/i.test(normalized)) return reference;
  var anchoredRelation = temporalEngine.extractDateRelations(normalized).find(function (relation) {
    return relation && relation.anchor === "reference_date" && relation.field === "occurredDate";
  });
  if (anchoredRelation) {
    var anchoredDate = temporalEngine.shiftIsoDate(reference, anchoredRelation);
    if (anchoredDate) return anchoredDate;
  }
  var relative = normalized.match(/\bpred\s+(?:(\d+|en|ena|eno|enim|enem|dva|dve|dveh|dvema|tri|treh|tremi|štiri|stiri|štirih|stirih|štirimi|stirimi|pet|petih|petimi|šest|sest|šestih|sestih|šestimi|sestimi|sedem|sedmih|sedmimi|osem|osmih|osmimi|devet|devetih|devetimi|deset|desetih|desetimi)\s+)?(dnev\w*|tedn\w*|mesec\w*|let\w*)\b/i);
  if (relative) {
    var relativeCount = relativeDateCount(relative[1] || "en");
    if (relativeCount && /^dnev/i.test(relative[2])) return shiftIsoDate(reference, -relativeCount);
    if (relativeCount && /^tedn/i.test(relative[2])) return shiftIsoDate(reference, -relativeCount * 7);
    if (relativeCount && /^mesec/i.test(relative[2])) return shiftIsoMonths(reference, -relativeCount);
    if (relativeCount && /^let/i.test(relative[2])) return shiftIsoMonths(reference, -relativeCount * 12);
  }
  var dotted = normalized.match(/\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(20\d{2}))?/);
  if (dotted) {
    var year = dotted[3] || reference.slice(0, 4);
    var candidate = validIsoDate(year + "-" + String(dotted[2]).padStart(2, "0") + "-" + String(dotted[1]).padStart(2, "0"));
    if (candidate && !dotted[3] && candidate > reference) candidate = validIsoDate(String(Number(year) - 1) + candidate.slice(4));
    if (candidate) return candidate;
  }
  return null;
}

function isDebtorRefusal(text) {
  var normalized = normalizeNaturalText(text);
  if (/\b(?:banka|kartica)\b[^.!?]{0,60}\bzavrnil(?:a)?\b[^.!?]{0,40}\bplačil(?:o|a)\b/i.test(normalized)) return false;
  return /\b(?:ne\s+bo\s+(?:več\s+)?plačal\w*|ne\s+želi\s+plačati|noče\s+plačati|(?:dolžnik|dolžnica|stranka)\s+(?:je\s+)?zavrnil(?:a)?\s+plačilo|preostanka\s+ne\s+bo\s+plačal\w*)\b/i.test(normalized);
}

function isDebtorExcuse(text) {
  var normalized = normalizeNaturalText(text);
  return /\b(?:izgovar\w*|izgovor\w*|ne\s+more\s+(?:še\s+|trenutno\s+)?plačati|trenutno\s+ne\s+more\s+plačati|nima\s+(?:dovolj\s+)?denarja|nima\s+sredstev|težav\w*\s+z\s+likvidnostjo)\b/i.test(normalized);
}

function hasExplicitDebtorResponse(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).replace(/\s+/g, " ");
  return /\b(?:rekel\w*|povedal\w*|odgovoril\w*|sporočil\w*|napisal\w*|zapisal\w*|pojasnil\w*|navedel\w*)\b[^.!?]{0,45}(?:\bda\b|[:»"])/i.test(normalized);
}

function inferDebtorResponse(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).replace(/\s+/g, " ");
  if (!hasExplicitDebtorResponse(normalized)) return null;
  var direct = normalized.match(/\b(?:rekel\w*|povedal\w*|odgovoril\w*|sporočil\w*|napisal\w*|zapisal\w*|pojasnil\w*|navedel\w*)\b[^.!?]{0,45}?(?:\bda\s+|[:»"]\s*)([^.!?;]+)/i);
  if (!direct) return null;
  var response = direct[1];
  response = response.split(/\s+(?:in\s+)?zato\b/i)[0];
  response = trimText(response, 500).replace(/^[,\s]+|[,\s]+$/g, "");
  if (!response) return null;
  return response.charAt(0).toUpperCase() + response.slice(1).replace(/[.!?]*$/, ".");
}

function isContactEnded(text) {
  return factEngine.hasContactEndedConclusion(normalizeNaturalText(text));
}

function isReminderSent(text) {
  return factEngine.buildFactContract(text).facts.some(function (fact) {
    return fact && fact.kind === "category" && fact.eventType === "reminder_sent" && fact.assertion === "positive";
  });
}

function isExplicitNonResponse(text) {
  return factEngine.contactEndedConclusions(text).some(function (span) {
    return /(?:odgovor\w*|odpisal\w*|odzval\w*|brez\s+odgovor\w*)/iu.test(String(span && span.text || ""));
  });
}

function inferRemainingUnpaidDescription(text) {
  if (isUnfulfilledPromise(text)) return "Obljuba plačila ni bila izpolnjena.";
  if (isExplicitNonResponse(text)) return isReminderSent(text) ? "Dolžnik se na opomin ni odzval." : "Dolžnik se ni odzval.";
  return inferDebtorResponse(text) || (isContactEnded(text) ? "Dolžnik je prekinil stik." : null);
}

function isRemainingUnpaid(text) {
  var normalized = normalizeNaturalText(text);
  var completed = hasCompletedPayment(normalized) || Boolean(inferInstallmentBreakdown(normalized));
  var semanticRemainingAmount = numberEngine.extractNumberExpressions(normalized).some(function (expression) {
    if (expression.role !== "money") return false;
    var beforeAmount = normalized.slice(Math.max(0, expression.evidence.start - 45), expression.evidence.start);
    return /\b(?:preostanek|preostalo|dolguje\w*|dolžan\w*|dolžna\w*|ostane|odprto)(?:\s+(?:je|pa|še|mu|ji|znaša\w*)){0,5}\s*$/i.test(beforeAmount);
  });
  return factEngine.hasClearRemainingConclusion(normalized) ||
    /\b(?:potem(?:\s+pa)?\s+(?:nič\s+)?več\s+ni\s+(?:plačal\w*|poravnal\w*)|nato(?:\s+pa)?\s+(?:nič\s+)?več\s+ni\s+(?:plačal\w*|poravnal\w*)|preostanka\s+(?:še\s+)?ni\s+(?:plačal\w*|poravnal\w*)|naprej\s+ni\s+(?:plačeval\w*|poravnaval\w*))\b/i.test(normalized) ||
    /\b(?:(?:potem|nato|zatem|od\s+takrat)(?:\s+pa)?\s+)?ni\s+več\s+(?:plačal\w*|poravnal\w*|nakazal\w*)\b/i.test(normalized) ||
    (completed && /\b(?:(?:vse\s+)?ostal\w*|preostan\w*|preostal\w*|drug\w*)(?:\s+(?:je|pa|še|se)){0,4}\s+(?:ni\s+(?:plač\w*|poravn\w*|naka\w*)|(?:je\s+)?ostal\w*\s+neplačan\w*)\b/i.test(normalized)) ||
    (completed && (/\b(?:preostalo|preostanek)(?:\s+(?:je|pa|še)){0,3}\s+(?:dolžan\w*|dolžna\w*|dolguje\w*|ni\s+(?:plačal\w*|poravnal\w*|nakazal\w*))\b/i.test(normalized) ||
      /\b(?:vse\s+)?ostalo(?:\s+(?:je|pa|še)){0,3}\s+ni\s+plačal\w*\b/i.test(normalized))) ||
    (completed && /(?:\bna\s+koncu\s+|\bpotem(?:\s+pa)?\s+|\bnato(?:\s+pa)?\s+)?nič\s+več(?=\s|$|[.!?,;])/i.test(normalized)) ||
    (hasCompletedPayment(normalized) && /\b(?:samo|zgolj|le)\b[^.!?;]{0,35}(?:€|\beur(?:ov|a)?\b|\bevr(?:ov|a)?\b)/i.test(normalized)) ||
    (hasCompletedPayment(normalized) && (isDebtorExcuse(normalized) || isContactEnded(normalized))) ||
    (isReminderSent(normalized) && isContactEnded(normalized)) ||
    new RegExp(REMAINING_PART + REMAINING_LINK + "[^.!?;]{0,12}?" + NUMBER_PART + "\\s*(?:€|eur(?:ov|a)?|evr(?:ov|a)?|" + PERCENT_PART + ")", "i").test(normalized) ||
    /\b(?:ampak|vendar|pa|potem|nato|zatem)(?:\s+pa)?\s+(?:ni\s+nič(?:\s+potem)?|nobenega\s+plačil\w*|ni\s+(?:nič\s+)?plač\w*)\b/i.test(normalized) ||
    semanticRemainingAmount || isUnfulfilledPromise(normalized);
}

function isExplicitCancellation(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  return /(?:(?:sem|smo)[\s\S]{0,60}(?:račun|terjatev)[\s\S]{0,60}(?:odpisal\w*|storniral\w*|preklical\w*)|(?:račun|terjatev)[\s\S]{0,120}(?:odpisal\w*|storniral\w*|preklical\w*|odpisan\w*|storniran\w*|preklican\w*))/i.test(normalized);
}

function isPaidInFull(text) {
  var normalized = normalizeNaturalText(text);
  return /\b(?:v\s+celoti|celoten\s+(?:dolg|preostanek)|celotni\s+(?:dolg|preostanek)|ves\s+preostanek|vseh\s+\d|končni\s+znesek|račun\s+(?:je\s+)?(?:bil\s+)?(?:v\s+celoti\s+)?poravnan)\b/i.test(normalized) ||
    new RegExp("(?:\\bvse\\s+(?:je\\s+)?" + PAYMENT_PART + "\\b|\\b" + PAYMENT_PART + "(?:\\s+je)?\\s+vse\\b)", "i").test(normalized);
}

function hasCompletedPayment(text) {
  return factEngine.buildFactContract(text).facts.some(function (fact) {
    return fact && fact.kind === "category" && fact.assertion === "positive"
      && ["partial_payment", "installment_payment", "paid_in_full"].includes(fact.eventType);
  });
}

function isPaymentFailed(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  return /(?:plačil(?:o|a)|nakazil(?:o|a)|direktn(?:a|e)\s+obremenitev|trajnik|ček)[^.!?]{0,80}(?:zavrnjen\w*|vrnjen\w*|vrnil\w*|ni\s+bil(?:a|o)?\s+(?:izveden\w*|unovčen\w*)|storniral\w*|stornirano)/i.test(normalized) ||
    /\b(?:banka|kartica)\b[^.!?]{0,60}\b(?:zavrnil(?:a)?|vrnil(?:a)?|storniral(?:a)?)\b[^.!?]{0,40}\b(?:plačil(?:o|a)|nakazil(?:o|a)|denar)\b/i.test(normalized);
}

function isInvoiceDispute(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  return /\b(?:ugovarja|ugovarjal(?:a)?|ugovor|reklamiral(?:a)?|reklamacija|izpodbija|zadržuje|zadržal(?:a)?|zahteva\s+odpravo\s+napak|račun\s+(?:je\s+)?zavrnil(?:a)?|zavrača\s+(?:del\s+)?računa|ostalemu\s+ugovarja|cena\s+(?:je\s+)?višja\s+od\s+ponudbe)\b/i.test(normalized);
}

function isDeadlineExtension(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  return /\b(?:podaljšanj(?:e|a)\s+roka|dodatn(?:i|ega)\s+rok|\d+\s+dni\s+dodatnega\s+roka|nov\s+rok\s+plačila|prestavitev\s+zapadlosti|prestaviti(?:\s+\w+){0,3}\s+(?:rok|zapadlost)|zaprosil(?:a)?\s+za\s+\d+\s+dni)\b/i.test(normalized);
}

function isInstallmentAgreement(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  return /(?:dogovoril\w*|predlagal\w*|odobril\w*)[^.!?]{0,100}(?:obrok\w*|obročn\w*\s+(?:načrt|plačil\w*))|obročn\w*\s+(?:načrt|plačil\w*)/i.test(normalized);
}

function isInsolvency(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  return /\b(?:stečaj\w*(?:\s+postopek)?|prisiln(?:a|i)\s+poravnav(?:a|i)|plačilno\s+nesposoben|insolvent(?:en|na|nost))\b/i.test(normalized);
}

function inferPaymentMethod(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  if (/\b(?:nakazal|nakazilo|bančn(?:o|im)\s+nakazil)/i.test(normalized)) return "bank_transfer";
  if (/\b(?:gotovin(?:a|i|o)|na\s+roke)\b/i.test(normalized)) return "cash";
  if (/\b(?:kartic(?:a|e|i|o)|pos(?:\s+terminal)?)\b/i.test(normalized)) return "card";
  if (/\b(?:direktn(?:a|o)\s+obremenitev|trajnik)\b/i.test(normalized)) return "direct_debit";
  return null;
}

function inferCommunicationChannel(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  if (/\b(?:po\s+telefonu|telefonsk(?:o|i)|poklical|klicu)\b/i.test(normalized)) return "phone";
  if (/\b(?:e-?pošt(?:a|i|o)|email(?:u|om)?)\b/i.test(normalized)) return "email";
  if (/\b(?:sms|sporočil(?:o|u))\b/i.test(normalized)) return "sms";
  if (/\b(?:osebno|v\s+živo)\b/i.test(normalized)) return "in_person";
  if (/\b(?:pisno|pism(?:o|u|om))\b/i.test(normalized)) return "letter";
  return null;
}

function mentionedPaymentMethods(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  var methods = new Set();
  if (/\b(?:nakazal\w*|nakazil\w*|bančn\w*\s+nakazil\w*)\b/i.test(normalized)) methods.add("bank_transfer");
  if (/\b(?:gotovin\w*|na\s+roke)\b/i.test(normalized)) methods.add("cash");
  if (/\b(?:kartic\w*|pos(?:\s+terminal)?)\b/i.test(normalized)) methods.add("card");
  if (/\b(?:direktn\w*\s+obremenitev|trajnik)\b/i.test(normalized)) methods.add("direct_debit");
  return methods;
}

function mentionedCommunicationChannels(text) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  var channels = new Set();
  if (/\b(?:po\s+telefonu|telefonsk\w*|poklical\w*|klicu)\b/i.test(normalized)) channels.add("phone");
  if (/\b(?:e-?pošt\w*|email\w*)\b/i.test(normalized)) channels.add("email");
  if (/\b(?:sms|sporočil(?:o|u))\b/i.test(normalized)) channels.add("sms");
  if (/\b(?:osebno|v\s+živo)\b/i.test(normalized)) channels.add("in_person");
  if (/\b(?:pisno|pism\w*)\b/i.test(normalized)) channels.add("letter");
  return channels;
}

function sanitizeStructuredEvidence(events, inferenceContext) {
  var text = inferenceContext && inferenceContext.text || "";
  if (!text) return { events: events, diagnostics: [] };
  var diagnostics = [];
  var methods = mentionedPaymentMethods(text);
  var channels = mentionedCommunicationChannels(text);
  var allowedAmounts = new Set();
  var contract = factEngine.buildFactContract(text);
  contract.facts.forEach(function (fact) {
    var amount = fact && fact.kind === "money" ? positiveAmount(fact.value) : null;
    if (amount != null) allowedAmounts.add(amount.toFixed(2));
  });
  var inferred = inferAmountFromText(text, inferenceContext || {});
  [inferred.amount, inferred.remainingAmount, inferPromisedAmount(text), inferCreditNoteAmount(text, inferenceContext || {}), inferCompensationAmount(text, inferenceContext || {})].forEach(function (value) {
    var amount = positiveAmount(value);
    if (amount != null) allowedAmounts.add(amount.toFixed(2));
  });
  var breakdown = inferInstallmentBreakdown(text);
  if (breakdown) [breakdown.amount, breakdown.total].concat(breakdown.amounts || []).forEach(function (value) {
    var amount = positiveAmount(value);
    if (amount != null) allowedAmounts.add(amount.toFixed(2));
  });
  if (isPaidInFull(text)) {
    var fullAmount = positiveAmount(inferenceContext.remainingDebt);
    if (fullAmount != null) allowedAmounts.add(fullAmount.toFixed(2));
  }
  var explicitOccurredDates = new Set();
  var explicitPromisedDates = new Set();
  function addDate(target, value) { if (validIsoDate(value)) target.add(value); }
  addDate(explicitOccurredDates, inferOccurredDate(text, inferenceContext.referenceDate));
  addDate(explicitPromisedDates, inferPromisedDate(text, inferenceContext.referenceDate));
  contract.clauses.forEach(function (clause) {
    addDate(explicitOccurredDates, inferOccurredDate(clause.text, inferenceContext.referenceDate));
    addDate(explicitPromisedDates, inferPromisedDate(clause.text, inferenceContext.referenceDate));
  });
  return {
    events: events.map(function (raw, index) {
      var event = Object.assign({}, raw || {});
      if (event.paymentMethod && !methods.has(event.paymentMethod)) {
        event.paymentMethod = null;
        diagnostics.push("unsupported_payment_method_rejected:" + index);
      }
      if (event.communicationChannel && !channels.has(event.communicationChannel)) {
        event.communicationChannel = null;
        diagnostics.push("unsupported_communication_channel_rejected:" + index);
      }
      var amount = positiveAmount(event.amount);
      if (amount != null && !allowedAmounts.has(amount.toFixed(2))) {
        event.amount = null;
        diagnostics.push("unsupported_amount_rejected:" + index);
      }
      if (event.occurredDate && !explicitOccurredDates.has(event.occurredDate) && text.indexOf(String(event.occurredDate)) < 0) {
        if (validIsoDate(event.occurredDate) && validIsoDate(inferenceContext.referenceDate) && event.occurredDate > inferenceContext.referenceDate) event.temporalStatus = "planned";
        event.occurredDate = null;
        diagnostics.push("unsupported_occurred_date_rejected:" + index);
      }
      if (event.promisedDate && !explicitPromisedDates.has(event.promisedDate) && text.indexOf(String(event.promisedDate)) < 0) {
        event.promisedDate = null;
        diagnostics.push("unsupported_promised_date_rejected:" + index);
      }
      return event;
    }),
    diagnostics: diagnostics,
  };
}

function inferPromisedDate(text, referenceDate) {
  var normalized = trimText(text, MAX_TEXT_LENGTH).toLowerCase();
  var reference = validIsoDate(referenceDate);
  if (!reference) return null;
  if (/\b(?:ne vem kdaj|rok (?:ni znan|je neznan)|brez roka)\b/i.test(normalized)) return null;
  if (/\bpojutrišnjem\b/i.test(normalized)) return shiftIsoDate(reference, 2);
  if (/\bjutri\b/i.test(normalized)) return shiftIsoDate(reference, 1);
  var afterDays = normalized.match(new RegExp("(?:^|\\s)čez\\s+" + NUMBER_PART + "\\s+(?:dan|dni|dneve|dnevih)\\b", "i"));
  if (afterDays) {
    var days = slovenianNumber(afterDays[1]);
    if (Number.isFinite(days) && days >= 0 && days <= 3660) return shiftIsoDate(reference, days);
  }
  var iso = normalized.match(/\b(?:do|najkasneje|rok)?\s*(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return validIsoDate(iso[1]);
  var dotted = normalized.match(/\b(?:do|najkasneje|rok(?:a|om)?(?:\s+plačila)?|plačal(?:a)?|poravnal(?:a)?)\s+(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(20\d{2}))?/);
  if (dotted) {
    var year = dotted[3] || reference.slice(0, 4);
    var candidate = validIsoDate(year + "-" + String(dotted[2]).padStart(2, "0") + "-" + String(dotted[1]).padStart(2, "0"));
    if (candidate && !dotted[3] && candidate < reference) candidate = validIsoDate(String(Number(year) + 1) + candidate.slice(4));
    return candidate;
  }
  var promiseRelationFact = factEngine.buildFactContract(normalized).facts.find(function (fact) {
    return fact && fact.kind === "date_relation" && fact.assertion === "positive"
      && ["payment_promise", "deadline_extension"].includes(fact.eventType)
      && fact.relation && fact.relation.field === "promisedDate";
  });
  if (promiseRelationFact) return canonicalDateFromRelation(promiseRelationFact.relation, reference, null);
  return null;
}

function isPaymentPromiseMentioned(text) {
  return factEngine.buildFactContract(text).fatherCategories.indexOf("payment_promised") >= 0;
}

function isUnfulfilledPromise(text) {
  var normalized = normalizeNaturalText(text);
  if (/\b(?:obljub\w*\s+(?:ni\s+držal\w*|ni\s+izpolnil\w*)|nikoli\s+ni(?:\s+(?:plač\w*|poravn\w*|naka\w*))?)\b/i.test(normalized)) return true;
  return isPaymentPromiseMentioned(normalized) && (
    /\b(?:pa\s+(?:še\s+)?ni|(?:ampak|vendar|toda|potem|nato|zatem)(?:\s+pa)?\s+(?:ni\s+nič(?:\s+potem)?|nobenega\s+plačil\w*|ni\s+(?:nič\s+)?plač\w*))\b/i.test(normalized)
    || /(?<![\p{L}\d])(?:(?:ampak|vendar|toda|pa|potem|nato|zatem)(?:\s+pa)?\s+)?(?:ni\s+nič(?:esar)?\s+(?:naredil\w*|storil\w*|izpolnil\w*|uresničil\w*)|ni\s+(?:naredil\w*|storil\w*|izpolnil\w*|uresničil\w*)\s+nič(?:esar)?|nič(?:esar)?\s+ni\s+(?:naredil\w*|storil\w*|izpolnil\w*|uresničil\w*))(?![\p{L}\d])/iu.test(normalized)
  );
}

function inferPromisedAmount(text) {
  var normalized = normalizeNaturalText(text);
  var promise = "(?:obljub\\w*|bo(?:do|jo)?\\s+(?:plač\\w*|poravn\\w*|naka\\w*)|(?:rekel\\w*|povedal\\w*|trdil\\w*|napisal\\w*|sporočil\\w*|odgovoril\\w*|pravi)[^.!?;]{0,35}(?:da\\s+)?(?:bo\\s+)?(?:plač\\w*|poravn\\w*|naka\\w*))";
  var amount = firstNumber(normalized, new RegExp(promise + "[^.!?;]{0,30}?" + NUMBER_PART + "\\s*(?:€|eur(?:ov|a)?|evr(?:ov|a)?)", "i"));
  if (amount == null) {
    var promiseMatch = normalized.match(new RegExp(promise, "i"));
    var promiseEnd = promiseMatch ? promiseMatch.index + promiseMatch[0].length : -1;
    var semanticAmount = numberEngine.extractNumberExpressions(normalized).find(function (expression) {
      return expression.role === "money" && expression.evidence && expression.evidence.start >= promiseEnd && expression.evidence.start - promiseEnd <= 35;
    });
    amount = semanticAmount ? semanticAmount.value : null;
  }
  if (!(Number.isFinite(amount) && amount > 0)) {
    amount = nearestFactAmount(factEngine.buildFactContract(normalized), "payment_promised", normalized);
  }
  return Number.isFinite(amount) && amount > 0 ? roundMoney(amount) : null;
}

function eventTypeFromText(text) {
  var normalized = normalizeNaturalText(text);
  if (inferInstallmentBreakdown(normalized) && hasCompletedPayment(normalized)) return "installment_payment";
  if (inferUnpaidInstallment(normalized)) return "unpaid_installment";
  if (isReminderSent(normalized)) return "reminder_sent";
  if (isRemainingUnpaid(normalized)) return "remaining_unpaid";
  if (isInsolvency(normalized)) return "insolvency";
  if (isPaymentFailed(normalized)) return "payment_failed";
  if (isInvoiceDispute(normalized)) return "invoice_dispute";
  if (isDeadlineExtension(normalized)) return "deadline_extension";
  if (isInstallmentAgreement(normalized)) return "installment_agreement";
  if (isDebtorRefusal(normalized)) return "debtor_statement";
  if (isPaymentPromiseMentioned(normalized)) return "payment_promise";
  if (isCreditNoteMentioned(normalized)) return "credit_note";
  if (isCompensationMentioned(normalized)) return "compensation";
  if (isExplicitCancellation(normalized)) return "cancelled_invoice";
  return completedPaymentType(normalized);
}

function completedPaymentType(text) {
  var normalized = normalizeNaturalText(text);
  if (!hasCompletedPayment(normalized)) return null;
  if (/\b(?:bo|bojo|bodo|obljubil|obljubila|obljuba)\b/i.test(normalized)) return null;
  if (isPaidInFull(normalized)) return "paid_in_full";
  return /\bobrok\w*\b/i.test(normalized) ? "installment_payment" : "partial_payment";
}

function deterministicClauseResult(text, context, hints) {
  hints = hints && typeof hints === "object" ? hints : {};
  var hintedEventTypes = Array.isArray(hints.eventTypes) ? hints.eventTypes : [];
  var type = hints.type || eventTypeFromText(text);
  if (!type) return null;
  var hintedAmount = positiveAmount(hints.amount);
  var inferred = hints.simpleMoney && hintedAmount != null
    ? { amount: hintedAmount, remainingAmount: null, source: "factContract", ambiguous: false }
    : inferAmountFromText(text, context);
  var installmentBreakdown = type === "installment_payment" || hintedEventTypes.includes("installment_payment")
    ? inferInstallmentBreakdown(text) : null;
  var creditNoteAmount = type === "credit_note" && hintedAmount != null ? hintedAmount : inferCreditNoteAmount(text, context);
  var compensationAmount = type === "compensation" && hintedAmount != null ? hintedAmount : inferCompensationAmount(text, context);
  var unpaid = hints.hasUnpaidInstallment === false ? null : inferUnpaidInstallment(text);
  var remainingUnpaid = hints.hasRemainingUnpaid === false ? false : isRemainingUnpaid(text);
  var dodatniNeplacaniPreostanek = remainingUnpaid && inferred.remainingAmount !== 0 && !(unpaid && inferred.remainingAmount == null);
  var amount = inferred.ambiguous ? null : inferred.amount;
  if (type === "payment_promise") amount = inferPromisedAmount(text);
  if (type === "installment_payment" && installmentBreakdown) amount = installmentBreakdown.amount || installmentBreakdown.total;
  if (!amount && !dodatniNeplacaniPreostanek) amount = explicitEuroAmount(text);
  if (type === "credit_note" && !amount) amount = creditNoteAmount;
  if (type === "compensation" && !amount) amount = compensationAmount;
  if (["credit_note", "compensation"].includes(type) && !amount) amount = inferSettlementShare(text, context);
  if (type === "paid_in_full" && positiveAmount(context && context.remainingDebt)) amount = positiveAmount(context.remainingDebt);
  var debtorRefusal = hints.hasDebtorRefusal === false ? false : isDebtorRefusal(text);
  var paymentText = debtorRefusal
    ? trimText(text, MAX_TEXT_LENGTH).split(/\b(?:da\s+)?ne\s+bo\b/i)[0]
    : dodatniNeplacaniPreostanek
      ? trimText(text, MAX_TEXT_LENGTH).split(/\b(?:potem|nato|preostanka|naprej)\b/i)[0]
      : text;
  var paymentType = ["partial_payment", "installment_payment", "paid_in_full"].includes(type)
    ? type
    : completedPaymentType(paymentText);
  var categorizedSettlementAmount = type === "credit_note" ? creditNoteAmount : type === "compensation" ? compensationAmount : null;
  if (!installmentBreakdown && categorizedSettlementAmount && amount && Math.abs(categorizedSettlementAmount - amount) <= 0.009) paymentType = null;
  var dolg = positiveAmount(context && context.remainingDebt);
  var preostanek = inferred.remainingAmount;
  var skupnoPlacilo = installmentBreakdown && positiveAmount(installmentBreakdown.total) || amount;
  if (dodatniNeplacaniPreostanek && preostanek == null && dolg) {
    preostanek = roundMoney(Math.max(0, dolg - (positiveAmount(skupnoPlacilo) || 0) - (positiveAmount(creditNoteAmount) || 0) - (positiveAmount(compensationAmount) || 0)));
  }
  if (dodatniNeplacaniPreostanek && (hints.hasCompletedPayment === true || hasCompletedPayment(text)) && !installmentBreakdown) paymentType = "partial_payment";
  if (["partial_payment", "installment_payment", "credit_note", "compensation"].includes(type) && (!amount || inferred.ambiguous) && !dodatniNeplacaniPreostanek) return null;
  if (type === "paid_in_full" && !amount) return null;
  if (paymentType && paymentType !== "paid_in_full" && (!amount || inferred.ambiguous) && !dodatniNeplacaniPreostanek && !unpaid) return null;
  var promisedDate = ["payment_promise", "deadline_extension"].includes(type) ? inferPromisedDate(text, context && context.referenceDate) : null;
  var reason = type === "cancelled_invoice" ? trimText(text, 300) : null;
  var opis = ["payment_failed", "invoice_dispute", "deadline_extension", "installment_agreement", "insolvency"].includes(type) ? trimText(text, 500) : null;
  var events = [];
  if (paymentType) {
    events.push({
      type: paymentType, repeat: paymentType === "installment_payment" ? (installmentBreakdown ? installmentBreakdown.repeat : inferRepeat(text)) : 1, amount: amount, currency: "EUR",
      occurredDate: inferOccurredDate(text, context && context.referenceDate),
      promisedDate: null, paymentMethod: inferPaymentMethod(text), communicationChannel: null, documentReference: null,
      reason: null, description: null, confidence: "high", missing: [],
    });
  }
  if (debtorRefusal) {
    events.push({
      type: "debtor_statement", repeat: 1, amount: null, currency: "EUR",
      occurredDate: inferOccurredDate(text, context && context.referenceDate),
      promisedDate: null, paymentMethod: null, communicationChannel: inferCommunicationChannel(text), documentReference: null,
      reason: null, description: "Dolžnik je povedal, da preostanka ne bo plačal.", confidence: "high", missing: [],
    });
  }
  if (unpaid && paymentType) {
    events.push({
      type: "unpaid_installment", repeat: 1, amount: null, currency: "EUR",
      occurredDate: null, promisedDate: null, paymentMethod: null, communicationChannel: null, documentReference: null,
      reason: null, description: unpaid.description, confidence: "high", missing: [],
    });
  }
  if (isCreditNoteMentioned(text) && !events.some(function (event) { return event.type === "credit_note"; })) {
    events.push({
      type: "credit_note", repeat: 1, amount: creditNoteAmount, currency: "EUR",
      occurredDate: inferOccurredDate(text, context && context.referenceDate), promisedDate: null, paymentMethod: null,
      communicationChannel: null, documentReference: null, reason: null, description: null, confidence: "high", missing: [],
    });
  }
  if (isCompensationMentioned(text) && !events.some(function (event) { return event.type === "compensation"; })) {
    events.push({
      type: "compensation", repeat: 1, amount: compensationAmount, currency: "EUR",
      occurredDate: inferOccurredDate(text, context && context.referenceDate), promisedDate: null, paymentMethod: null,
      communicationChannel: null, documentReference: null, reason: null, description: null, confidence: "high", missing: [],
    });
  }
  if (dodatniNeplacaniPreostanek) {
    events.push({
      type: "remaining_unpaid", repeat: 1, amount: preostanek, currency: "EUR",
      occurredDate: null, promisedDate: null, paymentMethod: null, communicationChannel: inferCommunicationChannel(text), documentReference: null,
      reason: null, description: inferRemainingUnpaidDescription(text), confidence: "high", missing: [],
    });
  }
  if (type && !events.some(function (event) { return event.type === type; })) {
    events.push({
      type: type, repeat: 1,
      amount: type === "credit_note" ? creditNoteAmount : type === "compensation" ? compensationAmount : amount,
      currency: "EUR", occurredDate: inferOccurredDate(text, context && context.referenceDate), promisedDate: promisedDate,
      paymentMethod: inferPaymentMethod(text), communicationChannel: inferCommunicationChannel(text), documentReference: null,
      reason: reason, description: unpaid ? unpaid.description : opis, confidence: "high", missing: [],
    });
  }
  if (events.length) {
    if (hints.skipNormalization) return { summary: "Prepoznani dogodki.", candidates: events };
    return normalizeResult({ summary: "Prepoznani dogodki.", needsClarification: false, events: events }, context && context.remainingDebt, Object.assign({ text: text }, context));
  }
  var fallback = {
    summary: "Prepoznan dogodek.", needsClarification: false,
    events: [{
      type: type, repeat: 1, amount: amount, currency: "EUR",
      occurredDate: inferOccurredDate(text, context && context.referenceDate),
      promisedDate: promisedDate, paymentMethod: inferPaymentMethod(text), communicationChannel: inferCommunicationChannel(text), documentReference: null,
      reason: reason, description: unpaid ? unpaid.description : opis, confidence: "high", missing: [],
    }],
  };
  if (hints.skipNormalization) return { summary: fallback.summary, candidates: fallback.events };
  return normalizeResult(fallback, context && context.remainingDebt, Object.assign({ text: text }, context));
}

function fastContractClauseResult(clause, context) {
  var eventTypes = clause && Array.isArray(clause.eventTypes) ? clause.eventTypes : [];
  if (eventTypes.length !== 1) return null;
  var type = eventTypes[0];
  if (!["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation"].includes(type)) return null;
  if (Array.isArray(clause.fatherCategories) && clause.fatherCategories.indexOf("unpaid_installment") >= 0) return null;
  var moneyValues = (Array.isArray(clause.values) ? clause.values : []).filter(function (item) {
    return item && item.kind === "money" && positiveAmount(item.value) != null;
  });
  if (moneyValues.length > 1) return null;
  var breakdown = type === "installment_payment" ? inferInstallmentBreakdown(clause.text) : null;
  var amount = type === "paid_in_full" && positiveAmount(context && context.remainingDebt)
    ? positiveAmount(context.remainingDebt)
    : breakdown && (positiveAmount(breakdown.amount) || positiveAmount(breakdown.total)) || positiveAmount(moneyValues[0] && moneyValues[0].value);
  if (amount == null) return null;
  return {
    summary: "Prepoznani dogodki.",
    candidates: [{
      type: type,
      repeat: type === "installment_payment" && breakdown && Number.isInteger(breakdown.repeat) ? breakdown.repeat : 1,
      amount: amount,
      currency: "EUR",
      occurredDate: inferOccurredDate(clause.text, context && context.referenceDate),
      promisedDate: null,
      paymentMethod: ["partial_payment", "paid_in_full", "installment_payment"].includes(type) ? inferPaymentMethod(clause.text) : null,
      communicationChannel: null,
      documentReference: null,
      reason: null,
      description: null,
      confidence: "high",
      missing: [],
    }],
  };
}

function deterministicResult(text, context) {
  var contract = factEngine.buildFactContract(text);
  var activeClauses = contract.clauses.filter(function (clause) { return clause.fatherCategories.length > 0; });
  if (activeClauses.length < 2) return deterministicClauseResult(text, context);
  var events = [];
  activeClauses.forEach(function (clause) {
    var firstClauseEvent = events.length;
    var moneyValues = clause.values.filter(function (item) { return item.kind === "money" && positiveAmount(item.value) != null; });
    var clauseEventTypes = clause.eventTypes.slice();
    var result = fastContractClauseResult(clause, context) || deterministicClauseResult(clause.text, context, {
      type: clauseEventTypes.length === 1 ? clauseEventTypes[0] : null,
      eventTypes: clauseEventTypes,
      amount: moneyValues.length === 1 ? moneyValues[0].value : null,
      simpleMoney: moneyValues.length === 1 && clause.fatherCategories.indexOf("unpaid_installment") < 0,
      hasUnpaidInstallment: clauseEventTypes.indexOf("unpaid_installment") >= 0,
      hasRemainingUnpaid: clauseEventTypes.indexOf("remaining_unpaid") >= 0,
      hasDebtorRefusal: clauseEventTypes.indexOf("debtor_statement") >= 0,
      hasCompletedPayment: clauseEventTypes.some(function (eventType) { return ["partial_payment", "installment_payment", "paid_in_full"].includes(eventType); }),
      skipNormalization: true,
    });
    if (result && Array.isArray(result.candidates)) {
      result.candidates.forEach(function (candidate) {
        var candidateFathers = thinkingEngine.EVENT_TO_FATHERS[candidate.type] || [thinkingEngine.EVENT_TO_FATHER[candidate.type] || "custom"];
        if (!candidateFathers.some(function (father) { return clause.fatherCategories.indexOf(father) >= 0; })) return;
        if (clause.eventTypes.length && clause.eventTypes.indexOf(candidate.type) < 0) return;
        events.push(Object.assign({}, candidate, {
          evidence: { sourceSpan: clause.span, clauseId: clause.id, explicit: true, reason: "father_clause_extraction" },
        }));
      });
    }
    clause.eventTypes.forEach(function (eventType) {
      var eventFathers = thinkingEngine.EVENT_TO_FATHERS[eventType] || [thinkingEngine.EVENT_TO_FATHER[eventType] || "custom"];
      var fatherAlreadyRepresented = events.slice(firstClauseEvent).some(function (event) {
        var existingFathers = thinkingEngine.EVENT_TO_FATHERS[event.type] || [thinkingEngine.EVENT_TO_FATHER[event.type] || "custom"];
        return existingFathers.some(function (father) { return eventFathers.includes(father); });
      });
      if (fatherAlreadyRepresented) return;
      var clauseAmount = clause.values.reduce(function (value, item) {
        return value != null || item.kind !== "money" ? value : positiveAmount(item.value);
      }, null);
      events.push({
        type: eventType, repeat: eventType === "installment_payment" ? inferRepeat(clause.text) : 1, amount: ["partial_payment", "installment_payment", "paid_in_full", "credit_note", "compensation"].includes(eventType) ? clauseAmount : null, currency: "EUR",
        occurredDate: inferOccurredDate(clause.text, context && context.referenceDate),
        promisedDate: ["payment_promise", "deadline_extension"].includes(eventType) ? inferPromisedDate(clause.text, context && context.referenceDate) : null,
        paymentMethod: inferPaymentMethod(clause.text), communicationChannel: inferCommunicationChannel(clause.text),
        documentReference: null, reason: eventType === "cancelled_invoice" ? trimText(clause.text, 300) : null,
        description: eventType === "remaining_unpaid" ? inferRemainingUnpaidDescription(clause.text) : eventType === "payment_promise" ? inferPromiseDescription(clause) : ["payment_failed", "invoice_dispute", "installment_agreement", "insolvency"].includes(eventType) ? trimText(clause.text, 500) : null,
        confidence: "high", missing: [],
        evidence: { sourceSpan: clause.span, clauseId: clause.id, explicit: true, reason: "father_signal_preserved" },
      });
    });
    var clauseEvents = events.splice(firstClauseEvent);
    clauseEvents.sort(function (a, b) {
      return clause.eventTypes.indexOf(a.type) - clause.eventTypes.indexOf(b.type);
    });
    Array.prototype.push.apply(events, clauseEvents);
  });
  if (!events.length) return deterministicClauseResult(text, context);
  var fullInstallmentSequence = inferInstallmentBreakdown(text);
  if (fullInstallmentSequence && Number.isInteger(fullInstallmentSequence.repeat)) {
    events.forEach(function (event) {
      if (event.type === "unpaid_installment" && !event.description) event.description = (fullInstallmentSequence.repeat + 1) + ". obrok ni plačan";
    });
  }
  return normalizeResult({ summary: "Prepoznani dogodki po pomenskih delih.", needsClarification: false, events: events }, context && context.remainingDebt, Object.assign({ text: text, factContract: contract }, context));
}

function inferPromiseDescription(clause) {
  if (!clause || !Array.isArray(clause.signals)) return null;
  var proposed = clause.signals.find(function (signal) {
    return signal && signal.assertion === "proposed" && ["credit_note", "compensation", "cancelled_invoice"].includes(signal.eventType);
  });
  if (!proposed) return null;
  return {
    credit_note: "Dolžnik je obljubil dobropis.",
    compensation: "Dolžnik je obljubil pobot.",
    cancelled_invoice: "Dolžnik je obljubil storno računa.",
  }[proposed.eventType] || null;
}

function eventDisplayPriority(type) {
  if (["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation", "cancelled_invoice"].includes(type)) return 0;
  if (["payment_promise", "deadline_extension"].includes(type)) return 1;
  if (["unpaid_installment", "remaining_unpaid"].includes(type)) return 3;
  return 2;
}

function sortEventsForDisplay(events, factContract) {
  var clauses = factContract && Array.isArray(factContract.clauses) ? factContract.clauses : [];
  var clauseOrder = new Map(clauses.map(function (clause, index) {
    return [clause.id, { index: index, eventTypes: clause.eventTypes || [] }];
  }));
  return events.map(function (event, index) {
    var evidence = event && event.evidence && typeof event.evidence === "object" ? event.evidence : {};
    var clauseId = evidence.clauseId || event && event.evidenceClauseId || null;
    var clause = clauseOrder.get(clauseId);
    if (!clause && event && event.type) {
      var compatible = clauses.filter(function (item) { return (item.eventTypes || []).includes(event.type); });
      if (compatible.length === 1) clause = clauseOrder.get(compatible[0].id);
    }
    var span = evidence.sourceSpan;
    return {
      event: event,
      index: index,
      terminalState: event && event.type === "remaining_unpaid" ? 1 : 0,
      clause: clause ? clause.index : Infinity,
      eventType: clause && clause.eventTypes.includes(event && event.type) ? clause.eventTypes.indexOf(event.type) : Infinity,
      start: Number.isFinite(span && span.start) ? span.start : Infinity,
    };
  }).sort(function (a, b) {
    // Kartice so časovnica dokazov. Poslovna/display prioriteta tipa ne sme
    // prestaviti opomina, odziva ali drugega dogodka čez poznejšo klavzulo.
    return a.terminalState - b.terminalState || a.clause - b.clause || a.eventType - b.eventType || a.start - b.start || a.index - b.index;
  }).map(function (item) { return item.event; });
}

function reorderNarrativeBeforePrevious(events, factContract) {
  var clauses = factContract && Array.isArray(factContract.clauses) ? factContract.clauses : [];
  var ordered = [];
  (events || []).forEach(function (event) {
    var evidence = event && event.evidence && typeof event.evidence === "object" ? event.evidence : {};
    var clauseId = evidence.clauseId || event && event.evidenceClauseId || null;
    var clause = clauses.find(function (item) { return item && item.id === clauseId; });
    var text = normalizeNaturalText(clause && clause.text || "");
    var beforePrevious = /^pred\s+tem\s+(?:obrok\w*|plačil\w*)\s+(?:pa\s+)?(?:je\s+)?(?:plačal\w*|poravnal\w*|nakazal\w*)/iu.test(text);
    if (beforePrevious && ordered.length && ["partial_payment", "installment_payment", "paid_in_full"].includes(event && event.type)) {
      ordered.splice(ordered.length - 1, 0, event);
      return;
    }
    ordered.push(event);
  });
  return ordered;
}

function bindRemainingPromiseAmounts(events, inferenceContext) {
  var debt = positiveAmount(inferenceContext && inferenceContext.remainingDebt);
  if (!debt) return events;
  return events.map(function (event) {
    if (!event || event.type !== "payment_promise" || positiveAmount(event.amount)) return event;
    var span = event.evidence && event.evidence.sourceSpan;
    var localText = normalizeNaturalText(span && span.text || "");
    if (!/\b(?:ostalo|preostanek|preostalo|vse\s+ostalo)\b/i.test(localText)) return event;
    var promiseStart = Number.isFinite(span && span.start) ? span.start : Infinity;
    var reductionsBeforePromise = events.reduce(function (sum, candidate) {
      var candidateSpan = candidate && candidate.evidence && candidate.evidence.sourceSpan;
      var candidateStart = Number.isFinite(candidateSpan && candidateSpan.start) ? candidateSpan.start : Infinity;
      if (candidateStart >= promiseStart || !["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation"].includes(candidate && candidate.type)) return sum;
      return sum + (positiveAmount(candidate.amount) || 0);
    }, 0);
    if (!reductionsBeforePromise) return event;
    return Object.assign({}, event, { amount: roundMoney(Math.max(0, debt - reductionsBeforePromise)) || null });
  });
}

function normalizeEvent(raw, index) {
  var type = ALLOWED_TYPES.includes(raw && raw.type) ? raw.type : "custom";
  var amount = positiveAmount(raw && raw.amount);
  if (type === "unpaid_installment") amount = null;
  var occurredDate = validIsoDate(raw && raw.occurredDate);
  var promisedDate = validIsoDate(raw && raw.promisedDate);
  var paymentMethod = PAYMENT_METHODS.includes(raw && raw.paymentMethod) ? raw.paymentMethod : null;
  var communicationChannel = COMMUNICATION_CHANNELS.includes(raw && raw.communicationChannel) ? raw.communicationChannel : null;
  var documentReference = trimText(raw && raw.documentReference, 120) || null;
  var reason = trimText(raw && raw.reason, 300) || null;
  var description = trimText(raw && raw.description, 500) || null;
  return {
    candidateId: "candidate-" + (index + 1),
    type: type,
    amount: amount,
    currency: "EUR",
    occurredDate: occurredDate,
    occurredDateUnknown: raw && raw.occurredDateUnknown === true,
    occurredDateApproximate: raw && raw.occurredDateApproximate === true,
    occurredDateApproximation: trimText(raw && raw.occurredDateApproximation, 120) || null,
    promisedDate: promisedDate,
    promisedDateUnknown: raw && raw.promisedDateUnknown === true,
    promisedDateApproximate: raw && raw.promisedDateApproximate === true,
    promisedDateApproximation: trimText(raw && raw.promisedDateApproximation, 120) || null,
    paymentMethod: paymentMethod,
    communicationChannel: communicationChannel,
    documentReference: documentReference,
    reason: reason,
    description: description,
    confidence: ["high", "medium", "low"].includes(raw && raw.confidence) ? raw.confidence : "low",
    temporalStatus: ["planned", "occurred", "overdue"].includes(raw && raw.temporalStatus) ? raw.temporalStatus : null,
    evidence: raw && raw.evidence && typeof raw.evidence === "object" ? raw.evidence : null,
    inheritedFrom: trimText(raw && raw.inheritedFrom, 80) || null,
    dueDate: validIsoDate(raw && raw.dueDate),
    dateRelation: normalizeDateRelation(raw && raw.dateRelation),
    missing: [],
  };
}

function normalizeDateRelation(raw) {
  if (!raw || !["previous_event", "reference_date"].includes(raw.anchor) || !["occurredDate", "promisedDate"].includes(raw.field)) return null;
  var direction = Number(raw.direction);
  var amount = Number(raw.amount);
  var unit = String(raw.unit || "");
  if (![1, -1].includes(direction) || !Number.isInteger(amount) || amount < 1 || amount > 10000 || !["day", "week", "month", "year"].includes(unit)) return null;
  var relation = {
    anchor: raw.anchor, field: raw.field, direction: direction,
    amount: amount, unit: unit,
    sourceSpan: raw.sourceSpan && Number.isInteger(raw.sourceSpan.start) && Number.isInteger(raw.sourceSpan.end)
      ? { start: raw.sourceSpan.start, end: raw.sourceSpan.end, text: trimText(raw.sourceSpan.text, 160) || undefined }
      : null,
    reason: trimText(raw.reason, 120) || "relative_event_date",
    clauseId: trimText(raw.clauseId, 80) || null,
  };
  if (raw.groupId) relation.groupId = trimText(raw.groupId, 80) || null;
  if (raw.anchorCandidateId) relation.anchorCandidateId = trimText(raw.anchorCandidateId, 80) || null;
  if (Number.isInteger(Number(raw.dayOfMonth)) && Number(raw.dayOfMonth) >= 1 && Number(raw.dayOfMonth) <= 31) relation.dayOfMonth = Number(raw.dayOfMonth);
  return relation;
}

function bindDateRelationAnchors(candidates) {
  candidates.forEach(function (candidate, index) {
    if (!candidate.dateRelation || candidate.dateRelation.anchor !== "previous_event") return;
    if (candidate.dateRelation.groupId) {
      for (var priorIndex = index - 1; priorIndex >= 0; priorIndex -= 1) {
        var prior = candidates[priorIndex];
        if (prior && prior.evidence && prior.evidence.groupId === candidate.dateRelation.groupId) {
          candidate.dateRelation.anchorCandidateId = prior.candidateId;
          return;
        }
      }
    }
    var targetStart = candidate.dateRelation.sourceSpan && candidate.dateRelation.sourceSpan.start;
    var anchorIndex = -1;
    var anchorStart = -Infinity;
    candidates.forEach(function (possibleAnchor, possibleIndex) {
      if (possibleIndex === index) return;
      var span = possibleAnchor && possibleAnchor.evidence && possibleAnchor.evidence.sourceSpan;
      var start = span && Number.isFinite(span.start) ? span.start : null;
      if (start == null || !Number.isFinite(targetStart) || start >= targetStart) return;
      if (start > anchorStart || (start === anchorStart && possibleIndex > anchorIndex)) {
        anchorStart = start;
        anchorIndex = possibleIndex;
      }
    });
    if (anchorIndex < 0 && index > 0) anchorIndex = index - 1;
    if (anchorIndex >= 0) candidate.dateRelation.anchorCandidateId = candidates[anchorIndex].candidateId;
  });
  return candidates;
}

function resolveReferenceDateRelations(candidates, referenceDate) {
  var anchorDate = validIsoDate(referenceDate);
  if (!anchorDate) return candidates;
  candidates.forEach(function (candidate) {
    var relation = candidate && candidate.dateRelation;
    if (!relation || relation.anchor !== "reference_date" || relation.field !== "occurredDate") return;
    var derived = temporalEngine.shiftIsoDate(anchorDate, relation);
    if (!derived) return;
    candidate.occurredDate = derived;
    candidate.occurredDateDerived = true;
    candidate.occurredDateManualOverride = false;
    candidate.occurredDateDerivedFrom = "reference_date";
  });
  return candidates;
}

function applyDeterministicClauseFields(candidates, context, factContract) {
  if (!factContract || !Array.isArray(factContract.clauses)) return candidates;
  var referenceDate = context && context.referenceDate;
  candidates.forEach(function (candidate) {
    if (!candidate) return;
    var clauseId = candidate.evidence && candidate.evidence.clauseId || candidate.dateRelation && candidate.dateRelation.clauseId || null;
    var clause = factContract.clauses.find(function (item) { return item && item.id === clauseId; });
    if (!clause) return;
    var occurredDate = inferOccurredDate(clause.text, referenceDate);
    var paymentMethod = inferPaymentMethod(clause.text);
    var communicationChannel = inferCommunicationChannel(clause.text);
    var promisedDate = inferPromisedDate(clause.text, referenceDate);
    if (validIsoDate(occurredDate)) {
      candidate.occurredDate = occurredDate;
      candidate.occurredDateDerived = true;
      candidate.occurredDateManualOverride = false;
      candidate.occurredDateDerivedFrom = "clause_fact";
    }
    if (paymentMethod && ["partial_payment", "paid_in_full", "installment_payment", "payment_failed"].includes(candidate.type)) candidate.paymentMethod = paymentMethod;
    if (communicationChannel) candidate.communicationChannel = communicationChannel;
    if (validIsoDate(promisedDate) && ["payment_promise", "deadline_extension"].includes(candidate.type)) candidate.promisedDate = promisedDate;
    if (candidate.type === "payment_promise") candidate.description = inferPromiseDescription(clause) || candidate.description;
  });
  return candidates;
}

function resolvePreviousEventDateRelations(candidates) {
  var candidatesById = new Map(candidates.map(function (candidate) { return [candidate && candidate.candidateId, candidate]; }));
  candidates.forEach(function (candidate, index) {
    var relation = candidate && candidate.dateRelation;
    if (!relation || relation.anchor !== "previous_event" || relation.field !== "occurredDate") return;
    var anchor = candidatesById.get(relation.anchorCandidateId) || candidates[index - 1];
    var anchorDate = anchor && validIsoDate(anchor.occurredDate);
    if (!anchorDate) return;
    var derived = temporalEngine.shiftIsoDate(anchorDate, relation);
    if (!derived) return;
    candidate.occurredDate = derived;
    candidate.occurredDateDerived = true;
    candidate.occurredDateManualOverride = false;
    candidate.occurredDateDerivedFrom = anchor.candidateId;
  });
  return candidates;
}

function resolveRemainingStateDates(candidates, text) {
  candidates.forEach(function (candidate, index) {
    if (!candidate || candidate.type !== "remaining_unpaid" || validIsoDate(candidate.occurredDate)) return;
    var span = candidate.evidence && candidate.evidence.sourceSpan;
    if (!span || !Number.isInteger(span.start)) return;
    var before = normalizeNaturalText(String(text || "").slice(Math.max(0, span.start - 36), span.start));
    if (!/\bod\s+takrat\s*$/i.test(before)) return;
    var anchor = candidates.slice(0, index).reverse().find(function (prior) {
      return prior && ["partial_payment", "installment_payment", "paid_in_full"].includes(prior.type) && validIsoDate(prior.occurredDate);
    });
    if (!anchor) return;
    candidate.occurredDate = anchor.occurredDate;
    candidate.occurredDateDerived = true;
    candidate.occurredDateManualOverride = false;
    candidate.occurredDateDerivedFrom = anchor.candidateId;
  });
  return candidates;
}

function reconcileBalanceEvents(events, inferenceContext) {
  if (!inferenceContext) return events;
  var remainingContract = inferenceContext.factContract || factEngine.buildFactContract(inferenceContext.text);
  var hasRemainingState = isRemainingUnpaid(inferenceContext.text) || (remainingContract.facts || []).some(function (fact) {
    return fact && fact.kind === "category" && fact.assertion === "positive" && ["remaining_unpaid", "unpaid_installment"].includes(fact.eventType);
  });
  if (!hasRemainingState) return events;
  var remainingFact = (remainingContract.facts || []).find(function (fact) {
    return fact && fact.kind === "category" && fact.assertion === "positive" && fact.eventType === "remaining_unpaid";
  });
  var remainingClause = remainingFact && Array.isArray(remainingContract.clauses) ? remainingContract.clauses.find(function (clause) {
    return clause && clause.id === remainingFact.clauseId;
  }) : null;
  var remainingEvidence = remainingFact ? {
    clauseId: remainingFact.clauseId,
    sourceSpan: remainingClause && remainingClause.span || remainingFact.sourceSpan || null,
    explicit: true,
    reason: remainingFact.reason || "explicit_remaining_state",
  } : null;
  var debt = positiveAmount(inferenceContext.remainingDebt);
  if (!debt) return events;
  var inferred = inferAmountFromText(inferenceContext.text, inferenceContext);
  var communicationChannel = inferCommunicationChannel(inferenceContext.text);
  var reconciled = events.map(function (event) { return Object.assign({}, event); });
  var paymentTypes = ["partial_payment", "installment_payment", "paid_in_full"];
  var completedByFact = (remainingContract.facts || []).some(function (fact) {
    return fact && fact.kind === "category" && fact.assertion === "positive" && paymentTypes.includes(fact.eventType);
  });
  var completed = completedByFact || hasCompletedPayment(inferenceContext.text) || Boolean(inferInstallmentBreakdown(inferenceContext.text));
  if (!completed) {
    reconciled = reconciled.filter(function (event) { return paymentTypes.indexOf(event && event.type) < 0; });
  } else if (!reconciled.some(function (event) { return paymentTypes.indexOf(event && event.type) >= 0; }) && !inferred.ambiguous && positiveAmount(inferred.amount)) {
    reconciled.unshift({ type: "partial_payment", repeat: 1, amount: inferred.amount, currency: "EUR", confidence: "high" });
  }

  var paymentIndexes = reconciled.map(function (event, index) {
    return paymentTypes.indexOf(event && event.type) >= 0 ? index : -1;
  }).filter(function (index) { return index >= 0; });
  if (!inferred.ambiguous && inferred.remainingAmount != null && paymentIndexes.length === 1 && !inferInstallmentBreakdown(inferenceContext.text)) {
    var otherReductions = reconciled.reduce(function (sum, event) {
      return sum + (["credit_note", "compensation"].indexOf(event && event.type) >= 0 ? positiveAmount(event.amount) || 0 : 0);
    }, 0);
    var correctedPayment = roundMoney(Math.max(0, debt - inferred.remainingAmount - otherReductions));
    if (correctedPayment > 0) {
      reconciled[paymentIndexes[0]].type = "partial_payment";
      reconciled[paymentIndexes[0]].amount = correctedPayment;
    }
  }

  var reductionTypes = ["partial_payment", "installment_payment", "paid_in_full", "credit_note", "compensation"];
  var reductions = reconciled.reduce(function (sum, event) {
    return sum + (reductionTypes.indexOf(event && event.type) >= 0 ? positiveAmount(event.amount) || 0 : 0);
  }, 0);
  var remainingAmount = inferred.remainingAmount;
  if (remainingAmount == null && reductions > 0) remainingAmount = roundMoney(Math.max(0, debt - reductions));
  var unpaidSequence = inferUnpaidInstallment(inferenceContext.text);
  if (unpaidSequence && (inferInstallmentBreakdown(inferenceContext.text) || reconciled.some(function (event) { return event && event.type === "installment_payment"; }))) {
    reconciled = reconciled.filter(function (event) { return event && event.type !== "remaining_unpaid"; });
    var unpaidEvent = reconciled.find(function (event) { return event && event.type === "unpaid_installment"; });
    if (unpaidEvent) unpaidEvent.description = unpaidSequence.description;
    else reconciled.push({ type: "unpaid_installment", repeat: 1, amount: null, currency: "EUR", description: unpaidSequence.description, confidence: "high" });
    return reconciled.slice(0, MAX_EVENTS);
  }
  if (remainingAmount == null || remainingAmount < 0 || remainingAmount > debt + 0.009) return reconciled.slice(0, MAX_EVENTS);

  var remainingIndex = reconciled.findIndex(function (event) { return event && event.type === "remaining_unpaid"; });
  if (remainingAmount === 0) {
    return reconciled.filter(function (event) { return event && event.type !== "remaining_unpaid"; });
  }
  if (remainingIndex < 0) {
    reconciled.push({ type: "remaining_unpaid", repeat: 1, amount: remainingAmount, currency: "EUR", communicationChannel: communicationChannel, description: inferRemainingUnpaidDescription(inferenceContext.text), confidence: "high", evidence: remainingEvidence });
  } else {
    reconciled[remainingIndex].amount = remainingAmount;
    if (!reconciled[remainingIndex].evidence && remainingEvidence) reconciled[remainingIndex].evidence = remainingEvidence;
    if (!reconciled[remainingIndex].communicationChannel) reconciled[remainingIndex].communicationChannel = communicationChannel;
    reconciled[remainingIndex].description = inferRemainingUnpaidDescription(inferenceContext.text);
    reconciled = reconciled.filter(function (event, index) { return event && (event.type !== "remaining_unpaid" || index === remainingIndex); });
  }
  return reconciled.slice(0, MAX_EVENTS);
}

function resolverFacts(text, context, contract) {
  var factContract = contract && typeof contract === "object" ? contract : factEngine.buildFactContract(text);
  var positive = factContract.facts.filter(function (fact) { return fact.kind === "category" && fact.assertion === "positive"; });
  function hasEvent(type) { return positive.some(function (fact) { return fact.eventType === type; }); }
  var inferred = inferAmountFromText(text, context || {});
  return {
    factContract: factContract,
    referenceDate: validIsoDate(context && context.referenceDate),
    occurredDate: inferOccurredDate(text, context && context.referenceDate),
    historicalDateInferenceBlocked: /\b(?:ne\s+vem|datum\w*\s+(?:ni|niso)\s+znan\w*|približ\w*)\b/iu.test(normalizeNaturalText(text)),
    installmentGroups: factContract.installmentGroups || [],
    installmentCadences: factContract.installmentCadences || [],
    installmentBreakdown: inferInstallmentBreakdown(text),
    paidInFull: hasEvent("paid_in_full") || isPaidInFull(text),
    remainingUnpaid: hasEvent("remaining_unpaid") || hasEvent("unpaid_installment") || isRemainingUnpaid(text),
    paymentFailed: hasEvent("payment_failed") || isPaymentFailed(text),
    invoiceDispute: hasEvent("invoice_dispute") || isInvoiceDispute(text),
    debtorRefused: isDebtorRefusal(text),
    creditNoteMentioned: hasEvent("credit_note") || isCreditNoteMentioned(text),
    creditNoteAmountEur: nearestFactAmount(factContract, "credit_note", text),
    compensationMentioned: hasEvent("compensation") || isCompensationMentioned(text),
    compensationAmountEur: nearestFactAmount(factContract, "compensation", text),
    explicitCancellation: hasEvent("cancelled_invoice") || isExplicitCancellation(text),
    installmentAgreement: hasEvent("installment_agreement") || isInstallmentAgreement(text),
    insolvency: hasEvent("insolvency") || isInsolvency(text),
    inferredRemainingAmountEur: inferred.remainingAmount == null ? null : inferred.remainingAmount,
  };
}

function bindSemanticPlanEvidence(events, factContract) {
  if (!factContract || !Array.isArray(factContract.clauses)) return events;
  return events.map(function (raw) {
    var event = Object.assign({}, raw || {});
    var clauseId = trimText(event.evidenceClauseId, 80) || null;
    if (!clauseId) return event;
    var clause = factContract.clauses.find(function (item) { return item && item.id === clauseId; });
    if (!clause) return event;
    event.evidence = {
      clauseId: clause.id,
      sourceSpan: clause.span || null,
      explicit: false,
      reason: "semantic_plan_bound_to_clause",
    };
    if (event.dateRelation && typeof event.dateRelation === "object") {
      event.dateRelation = Object.assign({}, event.dateRelation, { clauseId: clause.id });
    }
    return event;
  });
}

function normalizeResult(raw, debtAmount, inferenceContext) {
  var sourceEvents = raw && Array.isArray(raw.events) ? raw.events.slice(0, MAX_EVENTS).map(function (event) { return Object.assign({}, event); }) : [];
  var normalizedContract = inferenceContext && inferenceContext.factContract || (inferenceContext && inferenceContext.text ? factEngine.buildFactContract(inferenceContext.text) : null);
  sourceEvents = bindSemanticPlanEvidence(sourceEvents, normalizedContract);
  var sanitized = sanitizeStructuredEvidence(sourceEvents, inferenceContext);
  sourceEvents = sanitized.events;
  var facts = inferenceContext && inferenceContext.text
    ? resolverFacts(inferenceContext.text, inferenceContext, inferenceContext.factContract)
    : {};
  var reconciled = thinkingEngine.reconcileProposals(sourceEvents, facts);
  reconciled.diagnostics = sanitized.diagnostics.concat(reconciled.diagnostics || []);
  var expanded = thinkingEngine.expandEvents(reconciled.events);
  var unpaid = inferenceContext && inferUnpaidInstallment(inferenceContext.text);
  if (unpaid) {
    var unpaidEvent = expanded.find(function (event) { return event && event.type === "unpaid_installment"; });
    if (unpaidEvent) unpaidEvent.description = unpaid.description;
    else if (expanded.length < MAX_EVENTS) {
      expanded.push({
        type: "unpaid_installment", repeat: 1, amount: null, currency: "EUR", occurredDate: null,
        promisedDate: null, paymentMethod: null, communicationChannel: null, documentReference: null,
        reason: null, description: unpaid.description, confidence: "high", missing: ["occurredDate"],
      });
    }
  }
  expanded = reconcileBalanceEvents(expanded, inferenceContext);
  expanded = bindRemainingPromiseAmounts(expanded, inferenceContext);
  expanded = sortEventsForDisplay(expanded, facts.factContract || normalizedContract);
  expanded = reorderNarrativeBeforePrevious(expanded, facts.factContract || normalizedContract);
  var candidates = expanded.map(function (event, index) {
    var enriched = event;
    if (expanded.length === 1 && inferenceContext) {
      enriched = Object.assign({}, event);
      if (enriched.type === "cancelled_invoice" && isDebtorRefusal(inferenceContext.text) && !isExplicitCancellation(inferenceContext.text)) {
        enriched.type = "debtor_statement";
        enriched.reason = null;
        enriched.description = trimText(inferenceContext.text, 500);
      }
      if (positiveAmount(enriched.amount) == null) {
        if (enriched.type === "payment_promise") enriched.amount = inferPromisedAmount(inferenceContext.text);
        else {
          var inferred = inferAmountFromText(inferenceContext.text, inferenceContext);
          if (!inferred.ambiguous && inferred.amount) enriched.amount = inferred.amount;
          else if (!inferred.ambiguous && ["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation"].includes(enriched.type)) enriched.amount = explicitEuroAmount(inferenceContext.text);
        }
      }
      if (!validIsoDate(enriched.occurredDate) && eventTypeFromText(inferenceContext.text)) {
        enriched.occurredDate = inferOccurredDate(inferenceContext.text, inferenceContext.referenceDate);
      }
      if (["payment_promise", "deadline_extension"].includes(enriched.type) && !validIsoDate(enriched.promisedDate)) enriched.promisedDate = inferPromisedDate(inferenceContext.text, inferenceContext.referenceDate);
      if (!enriched.paymentMethod) enriched.paymentMethod = inferPaymentMethod(inferenceContext.text);
      if (!enriched.communicationChannel) enriched.communicationChannel = inferCommunicationChannel(inferenceContext.text);
      if (enriched.type === "cancelled_invoice" && !trimText(enriched.reason, 300)) enriched.reason = trimText(inferenceContext.text, 300);
      if (enriched.type === "debtor_statement" && !trimText(enriched.description, 500)) enriched.description = trimText(inferenceContext.text, 500);
      if (["payment_failed", "invoice_dispute", "deadline_extension", "installment_agreement", "insolvency"].includes(enriched.type) && !trimText(enriched.description, 500)) enriched.description = trimText(inferenceContext.text, 500);
      if (enriched.type === "custom" && !trimText(enriched.description, 500)) enriched.description = trimText(inferenceContext.text, 500);
    }
    return normalizeEvent(enriched, index);
  });
  applyDeterministicClauseFields(candidates, inferenceContext, facts.factContract || normalizedContract);
  bindDateRelationAnchors(candidates);
  resolveReferenceDateRelations(candidates, inferenceContext && inferenceContext.referenceDate);
  resolvePreviousEventDateRelations(candidates);
  resolveRemainingStateDates(candidates, inferenceContext && inferenceContext.text);
  var finalized = thinkingEngine.finalizeCandidates(candidates, {
    originalDebt: inferenceContext && inferenceContext.originalDebt,
    remainingDebt: Number(debtAmount) || (inferenceContext && inferenceContext.remainingDebt),
    referenceDate: inferenceContext && inferenceContext.referenceDate,
    factContract: facts.factContract || normalizedContract,
  }, reconciled.diagnostics);
  var coverage = coverageEngine.assessCoverage(facts.factContract || normalizedContract, { candidates: finalized.candidates }, {
    installmentBreakdown: facts.installmentBreakdown,
  });
  return {
    summary: trimText(raw && raw.summary, 240),
    needsClarification: Boolean(raw && raw.needsClarification) || finalized.questionPlan.length > 0,
    candidates: finalized.candidates,
    initialDebtEur: finalized.initialDebtEur,
    projectedRemainingDebtEur: finalized.projectedRemainingDebtEur,
    questionPlan: finalized.questionPlan,
    ledger: finalized.ledger,
    fieldOrder: finalized.fieldOrder,
    requiredFields: finalized.requiredFields,
    missing: finalized.missing,
    diagnostics: finalized.diagnostics,
    coverage: coverage,
  };
}

function safetyIdentifier(userId) {
  return crypto.createHash("sha256").update(String(userId || "unknown")).digest("hex").slice(0, 64);
}

function anonymizeModelText(value) {
  var redacted = trimText(value, MAX_TEXT_LENGTH)
    .replace(/\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){10,30}\b/gi, " ")
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi, " ")
    .replace(/(?:\+|00)?\d[\d\s()/-]{7,}\d/g, " ");
  var normalized = normalizeNaturalText(redacted);
  var exact = new Set([
    "je", "so", "sem", "smo", "sva", "sta", "bil", "bila", "bilo", "v", "na", "po", "do", "od", "za", "z", "s", "in", "ali", "pa", "še", "potem", "nato", "pred", "brez", "ni", "ne", "bo", "bodo", "rekel", "rekla", "povedal", "povedala", "napisal", "napisala", "pravi", "skupaj", "vsak", "vsakega", "prvi", "prva", "prvega", "drugi", "drugega", "tretji", "tretjega", "četrti", "četrtega", "samo", "zgolj", "le", "več", "nič", "eur", "evrov", "evra", "€", "%",
    "en", "ena", "eno", "enega", "dva", "dve", "dveh", "tri", "treh", "štiri", "štirih", "pet", "petih", "šest", "šestih", "sedem", "sedmih", "osem", "osmih", "devet", "devetih", "deset", "desetih",
  ]);
  var prefixes = [
    "plač", "poravn", "nakaz", "obrok", "dolg", "dolž", "preost", "ostal", "račun", "terjat", "ugovor", "reklam", "stečaj", "insolvent", "dobropis", "kompenz", "pobot", "storn", "odpis", "preklic", "obljub", "opomin", "poziv", "poslal", "posredoval", "vročil", "rok", "zapadl", "zavrn", "vrn", "bank", "kartic", "gotovin", "telefon", "email", "sms", "sporoč", "oseb", "pism", "včer", "danes", "jutri", "predvčer", "pojutri", "izgovor", "likvid", "denar", "sredst", "celot", "polov", "četrt", "procent", "odstot", "direkt", "trajnik", "ček", "napak", "cen", "ponudb", "obremen",
  ];
  return (normalized.match(/[\p{L}]+|\d+(?:[.,]\d+)?|[%€]/gu) || []).filter(function (token) {
    if (/^\d{1,6}(?:[.,]\d+)?$/.test(token)) return true;
    if (Number.isFinite(numberEngine.parseSlovenianNumber(token))) return true;
    if (exact.has(token)) return true;
    return prefixes.some(function (prefix) { return token.indexOf(prefix) === 0; });
  }).join(" ").slice(0, MAX_TEXT_LENGTH);
}

function modelFacts(text, context) {
  var inferred = inferAmountFromText(text, context || {});
  var factContract = factEngine.buildFactContract(text);
  var installmentGroups = installmentEngine.extractInstallmentGroups(text);
  var anonymizedFactContract = {
    version: factContract.version,
    fatherCategories: factContract.fatherCategories.slice(),
    clauses: factContract.clauses.map(function (clause) {
      return {
        id: clause.id, index: clause.index, fatherCategories: clause.fatherCategories.slice(), eventTypes: clause.eventTypes.slice(),
        span: { start: clause.span.start, end: clause.span.end },
      };
    }),
    facts: factContract.facts.map(function (fact) {
      return {
        id: fact.id, kind: fact.kind, category: fact.category || null, eventType: fact.eventType || null,
        value: fact.value, currency: fact.currency || null, explicit: fact.explicit, priority: fact.priority,
        confidence: fact.confidence, assertion: fact.assertion || null, tense: fact.tense || null,
        sourceSpan: fact.sourceSpan ? { start: fact.sourceSpan.start, end: fact.sourceSpan.end } : null,
        clauseId: fact.clauseId, reason: fact.reason, groupId: fact.groupId || null,
        expectedCount: Number.isInteger(fact.expectedCount) ? fact.expectedCount : null,
        conflict: fact.conflict || null,
        relation: fact.relation && typeof fact.relation === "object" ? {
          anchor: fact.relation.anchor, field: fact.relation.field,
          direction: fact.relation.direction, amount: fact.relation.amount, unit: fact.relation.unit,
          dayOfMonth: Number.isInteger(fact.relation.dayOfMonth) ? fact.relation.dayOfMonth : null,
          sourceSpan: fact.relation.sourceSpan ? { start: fact.relation.sourceSpan.start, end: fact.relation.sourceSpan.end } : null,
          reason: fact.relation.reason,
        } : fact.relation || null,
      };
    }),
    installmentGroups: installmentGroups.map(function (group) {
      return {
        id: group.id, count: group.count, amount: group.amount, total: group.total,
        currency: group.currency, explicitNoun: group.explicitNoun, completed: group.completed,
        span: { start: group.span.start, end: group.span.end },
        countSpan: { start: group.countSpan.start, end: group.countSpan.end },
        amountSpan: { start: group.amountSpan.start, end: group.amountSpan.end }, reason: group.reason,
      };
    }),
    installmentCadences: (factContract.installmentCadences || []).map(function (cadence) {
      return {
        id: cadence.id, groupId: cadence.groupId, installmentCount: cadence.installmentCount,
        periodCount: cadence.periodCount, intervalAmount: cadence.intervalAmount, unit: cadence.unit,
        expectedRelationCount: cadence.expectedRelationCount, conflict: cadence.conflict,
        sourceSpan: cadence.sourceSpan ? { start: cadence.sourceSpan.start, end: cadence.sourceSpan.end } : null,
        countSpan: cadence.countSpan ? { start: cadence.countSpan.start, end: cadence.countSpan.end } : null,
        reason: cadence.reason,
      };
    }),
  };
  return {
    anonymizedDescription: anonymizeModelText(text),
    detectedType: eventTypeFromText(text),
    installmentBreakdown: inferInstallmentBreakdown(text),
    installmentGroups: installmentGroups,
    installmentCadences: factContract.installmentCadences || [],
    fatherCategories: detectFatherCategories(text),
    creditNoteMentioned: isCreditNoteMentioned(text),
    creditNoteAmountEur: inferCreditNoteAmount(text, context || {}),
    compensationMentioned: isCompensationMentioned(text),
    compensationAmountEur: inferCompensationAmount(text, context || {}),
    repeat: inferRepeat(text),
    inferredPaymentAmountEur: inferred.ambiguous ? null : inferred.amount,
    inferredRemainingAmountEur: inferred.remainingAmount == null ? null : inferred.remainingAmount,
    occurredDate: inferOccurredDate(text, context && context.referenceDate),
    promisedDate: inferPromisedDate(text, context && context.referenceDate),
    paymentMethod: inferPaymentMethod(text),
    communicationChannel: inferCommunicationChannel(text),
    debtorRefused: isDebtorRefusal(text),
    remainingUnpaid: isRemainingUnpaid(text),
    paymentFailed: isPaymentFailed(text),
    invoiceDispute: isInvoiceDispute(text),
    contactEnded: isContactEnded(text),
    explicitCancellation: isExplicitCancellation(text),
    paidInFull: isPaidInFull(text),
    completedPayment: hasCompletedPayment(text),
    installmentAgreement: isInstallmentAgreement(text),
    insolvency: isInsolvency(text),
    reminderSent: isReminderSent(text),
    factContract: anonymizedFactContract,
  };
}

function semanticPlanDecision(text, contract, localResult) {
  var factContract = contract && typeof contract === "object" ? contract : factEngine.buildFactContract(text);
  var facts = Array.isArray(factContract.facts) ? factContract.facts : [];
  var activeClauses = (factContract.clauses || []).filter(function (clause) {
    return clause && Array.isArray(clause.fatherCategories) && clause.fatherCategories.length > 0;
  });
  var reasons = ["always_luna_review"];
  if (!factContract.fatherCategories || factContract.fatherCategories.length === 0) reasons.push("no_father_category");
  if (activeClauses.length > 1) reasons.push("multiple_event_clauses");
  if (facts.filter(function (fact) { return fact && fact.kind === "money"; }).length > 1) reasons.push("multiple_money_spans");
  if (facts.filter(function (fact) { return fact && fact.kind === "date_relation"; }).length > 1) reasons.push("multiple_date_relations");
  if (facts.some(function (fact) { return fact && /(?:sequential|inherited)/.test(String(fact.reason || "")); })) reasons.push("elliptical_event_inheritance");
  if (localResult && (!localResult.coverage || localResult.coverage.complete !== true)) reasons.push("incomplete_local_coverage");
  return {
    shouldRequest: true,
    reasons: reasons,
    coverage: localResult && localResult.coverage || null,
    factContract: factContract,
  };
}

function shouldRequestSemanticPlan(text, contract, localResult) {
  return semanticPlanDecision(text, contract, localResult).shouldRequest;
}

function requiresModelReasoning(text) {
  return shouldRequestSemanticPlan(text, factEngine.buildFactContract(text), null);
}

function legacyRequestBody(text, context, userId) {
  return {
    model: MODEL,
    store: false,
    reasoning: { effort: lunaPolicy.REASONING_EFFORT },
    max_output_tokens: lunaPolicy.MAX_OUTPUT_TOKENS,
    safety_identifier: safetyIdentifier(userId),
    instructions: [
      "Razčleni slovenski opis že preteklih dogodkov pri izterjavi računa.",
      "Vhod je anonimiziran: ne išči, ne ugibaj in ne vračaj imen, kontaktov ali drugih identifikatorjev. Uporabi samo posredovana dejstva o dogodkih in zneskih.",
      "Besedilo je lahko zapisano kot običajen pogovor: brez ločil ali šumnikov, z mašili, skrajšanimi stavki, pogovornimi glagoli in manjšimi tipkarskimi napakami. Ohraniti moraš pomen, ne slovnične oblike.",
      "Vrni samo dogodke iz podane sheme. Ne izmišljaj zneskov, datumov, razlogov ali opisov.",
      "Za vsak dogodek nastavi evidenceClauseId na obstoječi ID klavzule iz factContract. Če glagol podeduje iz neposredno prejšnje klavzule, inheritedFrom nastavi na njen ID; sicer null.",
      "Vsak eksplicitni denarni span in vsako aktivno dogodkovno klavzulo porabi natanko enkrat. Ne izpusti zadnjega zneska, ne podvajaj ga in ne dodajaj dogodka brez dokazne klavzule.",
      "Relativni datum vrni kot dateRelation samo, kadar je enaka relacija že v factContract. Absolutnega datuma ne ugibaj in ne spreminjaj deterministične smeri, količine ali enote.",
      "Če en opis vsebuje več zaporednih dogodkov, jih vrni kot ločene dogodke v kronološkem vrstnem redu; ne združi plačila, neplačanega preostanka, ugovora ali obljube v eno kartico.",
      "Pri zapisu 'plačal A EUR, nato B EUR' drugi znesek pomeni drugo izvedeno plačilo, tudi če glagol plačal ni ponovljen. Vrni dva partial_payment dogodka A in B; načina plačila ne ugibaj.",
      "Vsak nov izrecni časovni sidrni izraz, na primer 'tri tedne nazaj', 'včeraj' ali 'danes', skupaj s svojim sosednjim zneskom začne nov plačilni dogodek, kadar nadaljuje že vzpostavljeno zaporedje plačil. To velja za oba vrstna reda datum-znesek in znesek-datum ter tudi brez ponovljenega glagola.",
      "Časovnega števila nikoli ne prištej denarnemu znesku in datuma ene klavzule ne prenesi na naslednjo. Če metoda ni izrecno navedena ob pripadajočem dogodku, mora paymentMethod ostati null; zlasti ne izberi direct_debit samo zato, ker je polje zahtevano.",
      "Če uporabnik navede več ponovitev istega dogodka, nastavi repeat na točno število; strežnik jih bo razširil v ločene osnutke.",
      "Pri zapisu 'skupaj X EUR v N obrokih po Y EUR' vrni N dogodkov installment_payment z zneskom Y za vsak obrok. X je skupna vsota in nikoli znesek posameznega obroka; preveri, da je N × Y = X, sicer zahtevaj pojasnilo.",
      "Vsak pomenski del stavka razvrsti neodvisno. Če opis vsebuje N plačanih obrokov in izrecen dobropis, vrni N dogodkov installment_payment ter dodaten credit_note; dobropisa ne porabi kot nadomestilo za obrok in ga ne izpusti.",
      "Vedno preveri vseh 13 FATHER kategorij: partial, installment, unpaid_installment, payment_promised, full, payment_failed, invoice_dispute, credit_note, compensation, cancelled_invoice, insolvency, collection_action in collection_outcome. En stavek sme ustvariti več različnih kategorij.",
      "Delno plačilo je partial_payment, celotno plačilo je paid_in_full, že plačan obrok je installment_payment, dogovor o prihodnjih obrokih je installment_agreement, zapadel oziroma neplačan obrok je unpaid_installment, po delnem plačilu neplačan preostanek je remaining_unpaid, obljuba prihodnjega plačila je payment_promise, prošnja ali odobritev novega roka je deadline_extension, neuspešno ali vrnjeno plačilo je payment_failed, ugovor oziroma reklamacija računa je invoice_dispute, stečaj ali prisilna poravnava je insolvency, dobropis ali nota je credit_note, pobot je compensation, izrecen odpis/storno računa je cancelled_invoice, izvedeni opomin ali poziv za plačilo je reminder_sent, izjava ali zavrnitev dolžnika je debtor_statement, vse drugo je custom.",
      "Če pomemben podatek manjka, uporabi null, ga dodaj v missing in nastavi needsClarification. Nikoli ne sklepaj datuma iz besed danes/včeraj brez referenceDate.",
      "Pri odstotkih izračunaj znesek iz remainingDebtEur: plačanih X odstotkov pomeni X % trenutnega preostanka; če je naveden preostanek Y odstotkov, je plačilo 100-Y %. Enako uporabi razliko, kadar uporabnik navede preostali znesek v EUR. Če se dve navedbi ne ujemata, ne ugibaj.",
      "Izrecni preostanek ima prednost pred besedami 'vse je plačal': če je dolg D in uporabnik pove, da je dolžan še R, vrni partial_payment z D-R in ločeni remaining_unpaid z R. Nikoli ne vrni paid_in_full, kadar je R večji od nič.",
      "Če uporabnik pove, da je dolžnik plačal samo, le ali zgolj znesek P, ali da se izgovarja oziroma ne more plačati in je zato plačal P, sklepaj partial_payment P in remaining_unpaid remainingDebtEur-P.",
      "Description dogodka remaining_unpaid izpolni samo, kadar uporabnik izrecno navede dolžnikov odgovor ali pove, da je dolžnik prekinil stik oziroma se ne odziva. Pri prekinitvi stika uporabi kratek opis tega dejstva. Sam opis izgovarjanja, nezmožnosti plačila ali izračunanega preostanka ni dolžnikov odgovor; takrat mora description ostati null.",
      "FATHER collection_outcome pomeni dokazani neuspešni izid po že izvedenem plačilu ali collection_action: po opominu ni plačal, ni odgovoril, se ne javlja ali je postal nedosegljiv. Ustvari remaining_unpaid brez dodatnega zmanjšanja salda; brez predhodnega izvedenega plačila ali opomina ga ne ustvari.",
      "Razumi pogoste tipkarske zapise brez šumnikov in glasovne približke besede dolžan, na primer dolzan, dovzan, douzan in dovžan, kot dolžan.",
      "Besede danes, včeraj in predvčerajšnjim pretvori glede na referenceDate. Če datum ni izrecno povedan, pusti occurredDate null; nikoli ga samodejno ne nastavi na referenceDate.",
      "Način plačila paymentMethod in kanal komunikacije communicationChannel vrni samo, če sta izrecno povedana, sicer null.",
      "Dolžnikova izjava, da ne bo plačal, ni odpis ali storno. cancelled_invoice uporabi samo, ko uporabnik izrecno pove, da je sam račun odpisal, storniral ali preklical.",
      "Zavrnjeno plačilo banke, kartice ali trajnika je payment_failed in ni debtor_statement. debtor_statement uporabi samo za izrecno izjavo ali zavrnitev dolžnika oziroma stranke.",
      "Za payment_promise loči occurredDate (datum obljube) in promisedDate (obljubljeni rok). Za že plačane dogodke sta potrebna amount in occurredDate; paymentMethod je neobvezen in ostane null, kadar ga uporabnik ni izrecno navedel.",
      "Če je dolžnik večkrat, vedno znova ali non stop obljubljal plačilo brez konkretnega roka, ohrani en payment_promise z manjkajočim promisedDate; resničnega dogodka ne zavrzi. Če opis nato pove 'nikoli ni', 'pa ni plačal' ali 'obljube ni držal', dodaj še remaining_unpaid, ki ne zmanjša salda. Predhodno izvedeno plačilo ostane ločen dogodek.",
      "Pika ali vejica znotraj denarnega zapisa, na primer 4.000 ali 4,50, ni meja stavka. Števila ne jemlji iz dela besede: 'non stop' ne pomeni zneska sto.",
      "Za unpaid_installment v description zapiši zaporedno številko, na primer '3. obrok ni plačan'; occurredDate pomeni datum zapadlosti in ostane null, če ni znan.",
      "Če uporabnik pove, da je plačal prvih N obrokov, potem pa nič več, je prvi neplačani obrok N+1. Nikoli ne napiši samo 'naslednji obrok', kadar je zaporedno številko mogoče izračunati.",
    ].join(" "),
    input: JSON.stringify({
      facts: modelFacts(text, context),
      referenceDate: context.referenceDate,
      originalDebtEur: context.originalDebt,
      remainingDebtEur: context.remainingDebt,
    }),
    text: {
      format: {
        type: "json_schema",
        name: "debt_history_candidates",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
  };
}

function compactDateRelation(relation) {
  if (!relation || typeof relation !== "object") return null;
  return {
    anchor: relation.anchor,
    direction: relation.direction,
    amount: relation.amount,
    unit: relation.unit,
    dayOfMonth: Number.isInteger(relation.dayOfMonth) ? relation.dayOfMonth : null,
    groupId: relation.groupId || null,
    assertion: relation.assertion || "positive",
    eventType: relation.eventType || null,
  };
}

function proposalLinks(localResult, contract) {
  var expected = expectedBareLinks(contract);
  return (localResult && Array.isArray(localResult.candidates) ? localResult.candidates : []).map(function (candidate, index) {
    var evidence = candidate && candidate.evidence && typeof candidate.evidence === "object" ? candidate.evidence : {};
    var clauseId = evidence.clauseId || candidate.evidenceClauseId || (expected[index] && expected[index].clauseId) || null;
    var clauseIndex = (contract && Array.isArray(contract.clauses) ? contract.clauses : []).findIndex(function (clause) { return clause.id === clauseId; });
    var clause = clauseIndex >= 0 ? contract.clauses[clauseIndex] : null;
    var inheritedFrom = candidate && candidate.inheritedFrom || evidence.inheritedFrom || null;
    if (!inheritedFrom && clause && (clause.signals || []).some(function (signal) {
      return signal && signal.assertion === "positive" && /(?:sequential|lineage|inherited)/u.test(String(signal.reason || ""));
    })) {
      inheritedFrom = clauseIndex > 0 ? contract.clauses[clauseIndex - 1].id : null;
    }
    return {
      index: index,
      clauseId: clauseId,
      eventType: candidate && candidate.type || (expected[index] && expected[index].eventType) || null,
      inheritedFrom: inheritedFrom,
    };
  });
}

function bareFactsInput(text, context, contract) {
  var factContract = contract && typeof contract === "object" ? contract : factEngine.buildFactContract(text);
  return {
    version: factContract.version,
    contractVersion: CONTRACT_VERSION,
    sourceText: trimText(text, MAX_TEXT_LENGTH),
    referenceDate: validIsoDate(context && context.referenceDate),
    debtEur: {
      original: positiveAmount(context && context.originalDebt),
      remaining: positiveAmount(context && context.remainingDebt),
    },
    clarification: context && context.clarification ? {
      question: trimText(context.clarification.question, 180) || null,
      answer: trimText(context.clarification.answer, MAX_CLARIFICATION_ANSWER_LENGTH) || null,
      clauseId: trimText(context.clarification.clauseId, 80) || null,
      round: Math.max(1, Math.min(MAX_CLARIFICATION_ROUNDS, Number(context.clarification.round) || 1)),
    } : null,
    clauses: factContract.clauses.map(function (clause) {
      var positiveSignals = clause.signals.filter(function (signal) { return signal.assertion === "positive"; });
      return {
        id: clause.id,
        index: clause.index,
        sourceSpan: clause.span ? { start: clause.span.start, end: clause.span.end } : null,
        money: clause.values.filter(function (value) { return value.kind === "money"; }).map(function (value) {
          return { value: value.value, currency: value.currency || "EUR" };
        }),
        amountRelations: clause.values.filter(function (value) { return value.kind === "amount_relation" && value.relation; }).map(function (value) {
          return {
            deltaEur: value.value,
            direction: value.relation.direction,
            anchor: value.relation.anchor,
            anchorIndex: Number.isInteger(value.relation.anchorIndex) ? value.relation.anchorIndex : null,
          };
        }),
        dates: clause.dateRelations.map(compactDateRelation),
        paymentMethod: inferPaymentMethod(clause.text),
        communicationChannel: inferCommunicationChannel(clause.text),
        inherited: positiveSignals.some(function (signal) { return /(?:sequential|lineage|inherited)/u.test(String(signal.reason || "")); }),
      };
    }),
  };
}

function expectedBareLinks(contract) {
  var links = [];
  (contract && Array.isArray(contract.clauses) ? contract.clauses : []).forEach(function (clause) {
    (clause.eventTypes || []).forEach(function (eventType) {
      links.push({ clauseId: clause.id, eventType: eventType });
    });
  });
  return links;
}

function validateBareFactsPlan(parsed, contract) {
  var links = parsed && Array.isArray(parsed.links) ? parsed.links : null;
  if (!links) return { ok: false, reason: "bare_facts_links_missing", links: [] };
  var expected = expectedBareLinks(contract);
  if (links.length !== expected.length) return { ok: false, reason: "bare_facts_link_count", links: links };
  var seen = new Set();
  for (var index = 0; index < links.length; index += 1) {
    var link = links[index] || {};
    var clause = contract.clauses.find(function (item) { return item.id === link.clauseId; });
    if (!clause) return { ok: false, reason: "bare_facts_unknown_clause", links: links };
    if (!clause.eventTypes.includes(link.eventType)) return { ok: false, reason: "bare_facts_unsupported_type", links: links };
    var key = link.clauseId + ":" + link.eventType;
    if (seen.has(key)) return { ok: false, reason: "bare_facts_duplicate_link", links: links };
    seen.add(key);
    if (link.clauseId !== expected[index].clauseId || link.eventType !== expected[index].eventType) {
      return { ok: false, reason: "bare_facts_wrong_order", links: links };
    }
    if (link.inheritedFrom != null) {
      var clauseIndex = contract.clauses.findIndex(function (item) { return item.id === link.clauseId; });
      var previousClause = clauseIndex > 0 ? contract.clauses[clauseIndex - 1] : null;
      if (!previousClause || link.inheritedFrom !== previousClause.id) return { ok: false, reason: "bare_facts_invalid_inheritance", links: links };
    }
  }
  return { ok: true, reason: "bare_facts_plan_covered", links: links };
}

function validateReviewLinks(links, contract) {
  if (!Array.isArray(links) || links.length > MAX_EVENTS) return { ok: false, reason: "luna_review_link_count" };
  var previousOrder = null;
  for (var index = 0; index < links.length; index += 1) {
    var link = links[index] || {};
    var clauseIndex = contract.clauses.findIndex(function (item) { return item.id === link.clauseId; });
    var clause = clauseIndex >= 0 ? contract.clauses[clauseIndex] : null;
    if (!clause) return { ok: false, reason: "luna_review_unknown_clause" };
    if (!ALLOWED_TYPES.includes(link.eventType)) return { ok: false, reason: "luna_review_unsupported_type" };
    if (["partial_payment", "installment_payment"].includes(link.eventType)) {
      var provenPaymentTypes = clause.eventTypes.filter(function (type) {
        return type === "partial_payment" || type === "installment_payment";
      });
      if (provenPaymentTypes.length === 1) link.eventType = provenPaymentTypes[0];
    }
    var father = factEngine.EVENT_TO_FATHER[link.eventType] || "custom";
    var sameFatherSignals = (clause.signals || []).filter(function (signal) {
      return signal && signal.fatherCategory === father;
    });
    var exactPositive = sameFatherSignals.some(function (signal) {
      return signal.eventType === link.eventType && signal.assertion === "positive";
    });
    var contradictory = sameFatherSignals.some(function (signal) {
      return signal.assertion !== "positive" || signal.eventType !== link.eventType;
    });
    if (!exactPositive && contradictory) return { ok: false, reason: "luna_review_semantic_contradiction" };
    var knownEventIndex = clause.eventTypes.indexOf(link.eventType);
    var currentOrder = { clause: clauseIndex, event: knownEventIndex >= 0 ? knownEventIndex : clause.eventTypes.length + index };
    if (previousOrder && (currentOrder.clause < previousOrder.clause
      || (currentOrder.clause === previousOrder.clause && currentOrder.event < previousOrder.event))) {
      return { ok: false, reason: "luna_review_wrong_order" };
    }
    previousOrder = currentOrder;
    if (link.inheritedFrom != null) {
      var previousClause = clauseIndex > 0 ? contract.clauses[clauseIndex - 1] : null;
      if (!previousClause || link.inheritedFrom !== previousClause.id) return { ok: false, reason: "luna_review_invalid_inheritance" };
    }
  }
  return { ok: true, reason: "luna_review_links_valid" };
}

function evidenceClauseLink(contract, sourceText, evidenceText, minimumClauseIndex) {
  var quote = trimText(evidenceText, 500);
  if (!quote || !contract || !Array.isArray(contract.clauses)) return null;
  var start = 0;
  while (start <= sourceText.length) {
    var evidenceStart = sourceText.indexOf(quote, start);
    if (evidenceStart < 0) break;
    var evidenceEnd = evidenceStart + quote.length;
    var clauseIndex = contract.clauses.findIndex(function (clause) {
      return clause && clause.span && evidenceStart < clause.span.end && evidenceEnd > clause.span.start;
    });
    if (clauseIndex >= Math.max(0, Number(minimumClauseIndex) || 0)) {
      return { clauseId: contract.clauses[clauseIndex].id, clauseIndex: clauseIndex, start: evidenceStart, end: evidenceEnd };
    }
    start = evidenceStart + Math.max(1, quote.length);
  }
  return null;
}

function evidenceClauseLinkFromFields(contract, sourceText, fields, minimumClauseIndex) {
  var quotes = (Array.isArray(fields) ? fields : []).map(function (field) {
    return trimText(field && field.evidenceText, 500);
  }).filter(Boolean);
  if (!quotes.length || !contract || !Array.isArray(contract.clauses)) return null;
  for (var clauseIndex = Math.max(0, Number(minimumClauseIndex) || 0); clauseIndex < contract.clauses.length; clauseIndex += 1) {
    var clause = contract.clauses[clauseIndex];
    if (!clause || !clause.span) continue;
    var spans = quotes.map(function (quote) { return exactEvidenceSpan(sourceText, quote, clause.span); });
    if (spans.some(Boolean)) {
      return {
        clauseId: clause.id, clauseIndex: clauseIndex,
        start: clause.span.start, end: clause.span.end,
      };
    }
  }
  return null;
}

function exactEvidenceSpan(sourceText, evidenceText, withinSpan) {
  var quote = trimText(evidenceText, 500);
  if (!quote) return null;
  var startAt = withinSpan && Number.isInteger(withinSpan.start) ? withinSpan.start : 0;
  var endAt = withinSpan && Number.isInteger(withinSpan.end) ? withinSpan.end : String(sourceText || "").length;
  var start = String(sourceText || "").indexOf(quote, startAt);
  while (start >= 0 && start + quote.length <= endAt) {
    return { start: start, end: start + quote.length, text: quote };
  }
  return null;
}

function canonicalFieldEvidence(item, valueField, evidenceField, sourceText, eventSpan, textualValue, allowEventSpanFallback) {
  var value = item[valueField];
  var evidenceText = item[evidenceField];
  if (value == null) return evidenceText == null || trimText(evidenceText, 500) === "" ? { ok: true, span: null } : { ok: false, reason: "luna_canonical_orphan_evidence:" + valueField };
  var span = exactEvidenceSpan(sourceText, evidenceText, eventSpan);
  if (!span && allowEventSpanFallback && eventSpan) {
    span = { start: eventSpan.start, end: eventSpan.end, text: String(sourceText || "").slice(eventSpan.start, eventSpan.end) };
  }
  if (!span) return { ok: false, reason: "luna_canonical_field_evidence_not_found:" + valueField };
  if (textualValue && span.text.indexOf(String(value)) < 0) return { ok: false, reason: "luna_canonical_text_not_copied:" + valueField };
  return { ok: true, span: span };
}

function canonicalAmountSupported(amount, evidenceText) {
  var expressions = numberEngine.extractNumberExpressions(evidenceText || "").filter(function (expression) {
    return expression && ["money", "number"].includes(expression.role);
  });
  if (!expressions.length) return false;
  return expressions.some(function (expression) { return Math.abs(Number(expression.value) - Number(amount)) < 0.005; });
}

function canonicalDateFromRelation(relation, referenceDate, previousDate) {
  if (!relation || typeof relation !== "object") return null;
  var direction = Number(relation.direction);
  var amount = Number(relation.amount);
  var anchorDate = relation.anchor === "previous_event" ? validIsoDate(previousDate) : validIsoDate(referenceDate);
  if (!anchorDate || ![-1, 0, 1].includes(direction) || !Number.isInteger(amount) || amount < 0) return null;
  if ((amount === 0) !== (direction === 0)) return null;
  if (amount === 0) return relation.dayOfMonth == null ? anchorDate : null;
  return temporalEngine.shiftIsoDate(anchorDate, {
    direction: direction, amount: amount, unit: relation.unit, dayOfMonth: relation.dayOfMonth,
  });
}

function canonicalRelationNumbersSupported(relation, evidenceText) {
  var numbers = numberEngine.extractNumberExpressions(evidenceText || "").map(function (item) { return Number(item.value); });
  if (!numbers.length) return true;
  var expected = [Number(relation.amount)];
  if (relation.dayOfMonth != null) expected.push(Number(relation.dayOfMonth));
  return numbers.every(function (value) { return expected.includes(value); });
}

function canonicalItemFromWire(planItem) {
  if (!Array.isArray(planItem && planItem.fields)) return { ok: Object.prototype.hasOwnProperty.call(planItem || {}, "amountEur"), item: Object.assign({}, planItem) };
  var item = Object.assign({}, planItem, {
    eventType: CARD_TYPE_BY_ID[Number(planItem.cardId)] || trimText(planItem.eventType, 80) || null,
    amountEur: null, amountEvidenceText: null, amountRelation: null,
    occurredDate: null, occurredDateEvidenceText: null, occurredDateRelation: null, occurredDatePrecision: null, occurredDateStatus: null, occurredDateUnknown: false, occurredDateApproximate: false,
    promisedDate: null, promisedDateEvidenceText: null, promisedDateRelation: null, promisedDatePrecision: null, promisedDateStatus: null, promisedDateUnknown: false, promisedDateApproximate: false,
    paymentMethod: null, paymentMethodEvidenceText: null,
    communicationChannel: null, communicationChannelEvidenceText: null,
    documentReference: null, documentReferenceEvidenceText: null,
    reason: null, reasonEvidenceText: null, description: null, descriptionEvidenceText: null,
    providedFieldIds: [],
  });
  var seen = new Set();
  for (var index = 0; index < planItem.fields.length; index += 1) {
    var field = planItem.fields[index] || {};
    var name = FIELD_NAME_BY_ID[Number(field.fieldId)] || String(field.name || "");
    if (!CANONICAL_FIELD_NAMES.includes(name)) return { ok: false, reason: "luna_canonical_field_domain" };
    if (seen.has(name)) return { ok: false, reason: "luna_compact_field_duplicate" };
    seen.add(name);
    item.providedFieldIds.push(Number(field.fieldId));
    var isAmount = name === "amountEur";
    var isDate = name === "occurredDate" || name === "promisedDate";
    var catalogRow = CATALOG_ROW_BY_ID[Number(field.valueId)];
    var catalogValue = catalogRow && catalogRow[2];
    if (field.valueId != null && (!catalogRow || !["paymentMethod", "communicationChannel"].includes(name) || catalogRow[1] !== name)) {
      return { ok: false, reason: "luna_canonical_value_id_domain" };
    }
    var datePrecision = CATALOG_VALUE_BY_ID[Number(field.datePrecisionId)] || field.datePrecision;
    var dateStatus = CATALOG_VALUE_BY_ID[Number(field.dateStatusId)] || null;
    var relationAnchor = CATALOG_VALUE_BY_ID[Number(field.relationAnchorId)] || field.relationAnchor;
    var relationDirection = CATALOG_VALUE_BY_ID[Number(field.relationDirectionId)];
    if (relationDirection == null) relationDirection = field.relationDirection;
    var relationUnit = CATALOG_VALUE_BY_ID[Number(field.relationUnitId)] || field.relationUnit;
    var amountRelation = CATALOG_VALUE_BY_ID[Number(field.amountRelationId)] || field.amountRelation;
    var relationParts = [relationAnchor, relationDirection, field.relationAmount, relationUnit, field.relationDayOfMonth];
    var hasRelation = relationParts.slice(0, 4).some(function (value) { return value != null; });
    var completeRelation = relationParts.slice(0, 4).every(function (value) { return value != null; });
    if (isDate && dateStatus === "unknown") {
      item[name + "Unknown"] = true;
    } else if (isAmount) {
      var numericValue = Number(field.numberValue);
      if (!Number.isFinite(numericValue)) continue;
      item[name] = numericValue;
      if (amountRelation != null) {
        var amountRelationRow = CATALOG_ROW_BY_ID[Number(field.amountRelationId)];
        if (!amountRelationRow || amountRelationRow[1] !== "amountRelation" || !["total", "each"].includes(amountRelation)) {
          return { ok: false, reason: "luna_canonical_amount_relation_domain" };
        }
        item.amountRelation = amountRelation;
      }
    } else if ((name === "paymentMethod" || name === "communicationChannel") && catalogValue != null) {
      item[name] = catalogValue;
    } else {
      if (field.textValue == null || field.textValue === "") {
        if (!isDate || !completeRelation) continue;
      } else {
        item[name] = field.textValue;
      }
    }
    item[name === "amountEur" ? "amountEvidenceText" : name + "EvidenceText"] = field.evidenceText;
    if (isDate) item[name + "Precision"] = ["exact", "month", "year"].includes(datePrecision) ? datePrecision : null;
    if (isDate) item[name + "Status"] = ["exact", "approximate", "unknown"].includes(dateStatus) ? dateStatus : null;
    if (isDate) item[name + "Approximate"] = dateStatus === "approximate";
    if (isDate) item[name + "Relation"] = hasRelation && completeRelation ? {
      anchor: relationAnchor, direction: relationDirection, amount: field.relationAmount,
      unit: relationUnit, dayOfMonth: field.relationDayOfMonth,
    } : null;
  }
  delete item.fields;
  return { ok: true, item: item };
}

function validateCanonicalLinks(links, contract) {
  if (!Array.isArray(links) || links.length > MAX_EVENTS) return { ok: false, reason: "luna_review_link_count" };
  var previousClauseIndex = -1;
  for (var index = 0; index < links.length; index += 1) {
    var link = links[index] || {};
    var clauseIndex = contract.clauses.findIndex(function (item) { return item.id === link.clauseId; });
    if (clauseIndex < 0) return { ok: false, reason: "luna_review_unknown_clause" };
    if (!ALLOWED_TYPES.includes(link.eventType)) return { ok: false, reason: "luna_review_unsupported_type" };
    var clause = contract.clauses[clauseIndex];
    var father = factEngine.EVENT_TO_FATHER[link.eventType] || "custom";
    var contradicted = (clause.signals || []).some(function (signal) {
      return signal && signal.fatherCategory === father && signal.assertion !== "positive";
    });
    if (contradicted) return { ok: false, reason: "luna_canonical_known_contradiction" };
    if (clauseIndex < previousClauseIndex) return { ok: false, reason: "luna_review_wrong_order" };
    previousClauseIndex = clauseIndex;
    if (link.inheritedFrom != null) {
      var inheritedIndex = contract.clauses.findIndex(function (item) { return item.id === link.inheritedFrom; });
      if (inheritedIndex < 0 || inheritedIndex >= clauseIndex) return { ok: false, reason: "luna_review_invalid_inheritance" };
    }
  }
  return { ok: true, reason: "luna_canonical_structure_valid" };
}

function canonicalRepeatCount(evidenceText) {
  var counts = [];
  var expressions = numberEngine.extractNumberExpressions(evidenceText || "");
  expressions.forEach(function (expression) {
    var value = Number(expression && expression.value);
    if (expression && expression.role === "count" && Number.isInteger(value) && value >= 2 && value <= MAX_EVENTS) counts.push(value);
  });
  var countBesideInstallment = normalizeNaturalText(evidenceText || "").match(/\b(\d+(?:h|ih|eh)?|dva|dve|dveh|tri|treh|štiri|štirih|pet|petih|šest|šestih|sedem|sedmih|osem|osmih|devet|devetih|deset|desetih)\s+obrok\w*/u);
  if (countBesideInstallment) counts.push(Number(installmentEngine.parseSlovenianNumber(countBesideInstallment[1], { count: true })));
  installmentEngine.extractInstallmentGroups(evidenceText || "").forEach(function (group) {
    if (group && Number.isInteger(Number(group.count))) counts.push(Number(group.count));
  });
  counts = counts.filter(function (value, index) { return Number.isInteger(value) && value >= 2 && value <= MAX_EVENTS && counts.indexOf(value) === index; });
  return counts.length === 1 ? counts[0] : null;
}

function canonicalRepeatSupported(evidenceText, expectedCount) {
  return Number.isInteger(expectedCount) && expectedCount >= 2 && canonicalRepeatCount(evidenceText) === expectedCount;
}

function canonicalRepeatKey(item) {
  var span = item && item._eventSpan || {};
  return [span.start, span.end, item && item.eventType, item && item.amountEur, item && item.occurredDate, item && item.promisedDate].join(":");
}

function materializeCanonicalPlan(review, context, contract, sourceText) {
  var items = review && Array.isArray(review.items) ? review.items : [];
  var events = [];
  var materialEvidenceSpans = [];
  var previousDate = null;
  var balance = positiveAmount(context && context.remainingDebt) || positiveAmount(context && context.originalDebt) || 0;
  var reducingTypes = ["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation"];
  var seen = new Set();
  var repeatTotals = items.reduce(function (totals, item) {
    var key = canonicalRepeatKey(item);
    var current = totals.get(key) || { itemCount: 0, eventCount: 0 };
    totals.set(key, {
      itemCount: current.itemCount + 1,
      eventCount: current.eventCount + Number(item && item.count || 1),
    });
    return totals;
  }, new Map());
  var spanTotals = items.reduce(function (totals, item) {
    var span = item && item._eventSpan || {};
    var key = span.start + ":" + span.end;
    totals.set(key, (totals.get(key) || 0) + Number(item && item.count || 1));
    return totals;
  }, new Map());
  for (var index = 0; index < items.length; index += 1) {
    var item = items[index];
    var eventSpan = item._eventSpan;
    var evidenceChecks = [
      canonicalFieldEvidence(item, "amountEur", "amountEvidenceText", sourceText, eventSpan, false),
      canonicalFieldEvidence(item, "occurredDate", "occurredDateEvidenceText", sourceText, eventSpan, false, Boolean(item.occurredDateRelation)),
      canonicalFieldEvidence(item, "promisedDate", "promisedDateEvidenceText", sourceText, eventSpan, false, Boolean(item.promisedDateRelation)),
      canonicalFieldEvidence(item, "paymentMethod", "paymentMethodEvidenceText", sourceText, eventSpan, false),
      canonicalFieldEvidence(item, "communicationChannel", "communicationChannelEvidenceText", sourceText, eventSpan, false),
      canonicalFieldEvidence(item, "documentReference", "documentReferenceEvidenceText", sourceText, eventSpan, true),
      canonicalFieldEvidence(item, "reason", "reasonEvidenceText", sourceText, eventSpan, true),
      canonicalFieldEvidence(item, "description", "descriptionEvidenceText", sourceText, eventSpan, true),
    ];
    var invalidEvidence = evidenceChecks.find(function (check) { return !check.ok; });
    if (invalidEvidence) return { ok: false, reason: invalidEvidence.reason };
    evidenceChecks.forEach(function (check) { if (check.span) materialEvidenceSpans.push(check.span); });
    if (item.amountEur != null && (!positiveAmount(item.amountEur) || !canonicalAmountSupported(item.amountEur, item.amountEvidenceText))) {
      return { ok: false, reason: "luna_canonical_amount_unsupported" };
    }
    if (item.paymentMethod != null && !PAYMENT_METHODS.includes(item.paymentMethod)) return { ok: false, reason: "luna_canonical_payment_method" };
    if (item.communicationChannel != null && !COMMUNICATION_CHANNELS.includes(item.communicationChannel)) return { ok: false, reason: "luna_canonical_communication_channel" };
    var occurredDate = item.occurredDate == null ? null : validIsoDate(item.occurredDate);
    var promisedDate = item.promisedDate == null ? null : validIsoDate(item.promisedDate);
    if (item.occurredDate != null && !occurredDate) return { ok: false, reason: "luna_canonical_invalid_occurred_date" };
    if (item.promisedDate != null && !promisedDate) return { ok: false, reason: "luna_canonical_invalid_promised_date" };
    if ((item.occurredDate == null) !== (item.occurredDateRelation == null)) {
      if (item.occurredDate == null || item.occurredDateRelation != null) return { ok: false, reason: "luna_canonical_occurred_date_pair" };
    }
    if ((item.promisedDate == null) !== (item.promisedDateRelation == null)) {
      if (item.promisedDate == null || item.promisedDateRelation != null) return { ok: false, reason: "luna_canonical_promised_date_pair" };
    }
    if (item.occurredDateRelation) {
      if (!canonicalRelationNumbersSupported(item.occurredDateRelation, item.occurredDateEvidenceText)) return { ok: false, reason: "luna_canonical_occurred_relation_numbers" };
      if (canonicalDateFromRelation(item.occurredDateRelation, context && context.referenceDate, previousDate) !== occurredDate) return { ok: false, reason: "luna_canonical_occurred_date_conflict" };
    }
    if (item.promisedDateRelation) {
      if (!canonicalRelationNumbersSupported(item.promisedDateRelation, item.promisedDateEvidenceText)) return { ok: false, reason: "luna_canonical_promised_relation_numbers" };
      if (canonicalDateFromRelation(item.promisedDateRelation, context && context.referenceDate, previousDate) !== promisedDate) return { ok: false, reason: "luna_canonical_promised_date_conflict" };
    }
    if (occurredDate && validIsoDate(context && context.referenceDate) && occurredDate > context.referenceDate) return { ok: false, reason: "luna_canonical_future_occurred_date" };
    var duplicateKey = canonicalRepeatKey(item);
    var repeatTotal = repeatTotals.get(duplicateKey) || { itemCount: 1, eventCount: 1 };
    var repeatProven = repeatTotal.itemCount > 1 && canonicalRepeatSupported(item.evidenceText, repeatTotal.eventCount);
    if (repeatTotal.itemCount > 1 && !repeatProven) return { ok: false, reason: "luna_canonical_duplicate_event" };
    if (seen.has(duplicateKey) && !repeatProven) return { ok: false, reason: "luna_canonical_duplicate_event" };
    seen.add(duplicateKey);
    var count = Number(item.count);
    var itemRepeatProven = count > 1 && canonicalRepeatSupported(item.evidenceText, count);
    if (count > 1 && !itemRepeatProven) {
      return { ok: false, reason: "luna_canonical_repeat_unsupported" };
    }
    var spanCount = spanTotals.get(eventSpan.start + ":" + eventSpan.end) || 1;
    var spanRepeatProven = spanCount > 1 && canonicalRepeatSupported(eventSpan.text, spanCount);
    if (repeatProven || itemRepeatProven || spanRepeatProven) materialEvidenceSpans.push(eventSpan);
    for (var repeatIndex = 0; repeatIndex < count; repeatIndex += 1) {
      var amount = positiveAmount(item.amountEur);
      if (reducingTypes.includes(item.eventType) && amount != null) {
        if (amount > balance + 0.005) return { ok: false, reason: "luna_canonical_negative_ledger" };
        if (item.eventType === "paid_in_full" && Math.abs(amount - balance) > 0.005) return { ok: false, reason: "luna_canonical_full_payment_conflict" };
        balance = roundMoney(balance - amount);
      }
      var description = item.description;
      if (item.eventType === "installment_payment" && count > 1 && !description) description = (repeatIndex + 1) + "/" + count + " obrok";
      events.push(normalizeEvent({
        type: item.eventType, amount: amount, occurredDate: occurredDate, promisedDate: promisedDate,
        paymentMethod: item.paymentMethod, communicationChannel: item.communicationChannel,
        documentReference: item.documentReference, reason: item.reason, description: description,
        confidence: "high", inheritedFrom: item.inheritedFrom || null,
        evidence: {
          clauseId: item.clauseId, sourceSpan: eventSpan, explicit: true, reason: "luna_canonical_exact_evidence",
          fieldSpans: {
            amountEur: evidenceChecks[0].span, occurredDate: evidenceChecks[1].span, promisedDate: evidenceChecks[2].span,
            paymentMethod: evidenceChecks[3].span, communicationChannel: evidenceChecks[4].span,
            documentReference: evidenceChecks[5].span, reason: evidenceChecks[6].span, description: evidenceChecks[7].span,
          },
        },
      }, events.length));
    }
    if (occurredDate) previousDate = occurredDate;
  }
  var uncoveredNumber = numberEngine.extractNumberExpressions(sourceText || "").find(function (expression) {
    var span = expression && expression.evidence;
    return span && !materialEvidenceSpans.some(function (materialSpan) {
      return span.start >= materialSpan.start && span.end <= materialSpan.end;
    });
  });
  if (uncoveredNumber) return {
    ok: false,
    reason: "luna_canonical_numeric_evidence_omitted:" + Number(uncoveredNumber.value) + "@" + uncoveredNumber.evidence.start,
  };
  var finalized = thinkingEngine.finalizeCandidates(events, {
    originalDebt: context && context.originalDebt, remainingDebt: context && context.remainingDebt,
    referenceDate: context && context.referenceDate, factContract: contract,
  }, ["luna_canonical_plan_materialized"]);
  if (finalized.projectedRemainingDebtEur < 0 || finalized.diagnostics.some(function (item) { return /amount_exceeds_balance|paid_in_full_must_match/.test(item); })) {
    return { ok: false, reason: "luna_canonical_ledger_conflict" };
  }
  finalized.candidates = finalized.candidates.map(function (candidate, index) {
    return Object.assign({}, candidate, {
      cardNumber: index + 1,
      cardTypeId: CARD_ID_BY_TYPE[candidate.type] || CARD_ID_BY_TYPE.custom,
      fieldIds: (candidate.fieldOrder || []).map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }),
    });
  });
  finalized.questionPlan = finalized.questionPlan.map(function (question) {
    var candidate = finalized.candidates[question.candidateIndex];
    return Object.assign({}, question, {
      cardNumber: question.candidateIndex + 1,
      cardTypeId: candidate && candidate.cardTypeId || CARD_ID_BY_TYPE.custom,
      fieldIds: question.fields.map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }),
      missingFieldIds: question.missing.map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }),
    });
  });
  return { ok: true, result: Object.assign({
    summary: "Luna je pripravila dokazno preverjen načrt.", needsClarification: finalized.questionPlan.length > 0,
    coverage: { complete: true, reason: "canonical_exact_evidence_validated", unconsumed: [], duplicates: [], unsupportedCandidates: [] },
  }, finalized) };
}

function authoritativeFieldPresent(event, field) {
  if (field === "amount") return positiveAmount(event.amount) != null;
  if (field === "occurredDate") return event.occurredDateUnknown === true || event.occurredDateApproximate === true && Boolean(trimText(event.occurredDateApproximation, 120)) || Boolean(validIsoDate(event.occurredDate));
  if (field === "promisedDate") return event.promisedDateUnknown === true || event.promisedDateApproximate === true && Boolean(trimText(event.promisedDateApproximation, 120)) || Boolean(validIsoDate(event.promisedDate));
  return Boolean(trimText(event[field], 500));
}

function finalizeSystemCandidates(candidates, context, inheritedDiagnostics) {
  var initialDebt = positiveAmount(context && context.remainingDebt) || positiveAmount(context && context.originalDebt) || 0;
  var balance = initialDebt;
  var diagnostics = Array.isArray(inheritedDiagnostics) ? inheritedDiagnostics.slice() : [];
  var ledger = [];
  var finalized = (Array.isArray(candidates) ? candidates : []).slice(0, MAX_EVENTS).map(function (candidate, index) {
    var event = Object.assign({}, candidate || {});
    var spec = AUTHORITATIVE_RULES[event.type] || AUTHORITATIVE_RULES.custom;
    if (!AUTHORITATIVE_RULES[event.type]) event.type = "custom";
    var before = balance;
    var amount = positiveAmount(event.amount);
    if (spec.balanceEffect === "subtract" && amount != null) balance = roundMoney(Math.max(0, balance - amount));
    event.fieldOrder = spec.fieldOrder.slice();
    event.requiredFields = spec.requiredFields.slice();
    event.fatherCategory = spec.fatherCategory;
    event.dateRoles = spec.dateRoles.slice();
    if (event.type === "unpaid_installment" && !validIsoDate(event.dueDate) && validIsoDate(event.occurredDate)) event.dueDate = event.occurredDate;
    event.temporalStatus = ["payment_promise", "deadline_extension", "installment_agreement"].includes(event.type) ? "planned" : "occurred";
    event.missing = spec.requiredFields.filter(function (field) { return !authoritativeFieldPresent(event, field); });
    event.ledger = { beforeEur: before, effectEur: roundMoney(balance - before), afterEur: balance };
    ledger.push({ candidateIndex: index, type: event.type, beforeEur: before, effectEur: roundMoney(balance - before), afterEur: balance });
    return event;
  });
  return {
    candidates: finalized,
    initialDebtEur: initialDebt,
    projectedRemainingDebtEur: balance,
    questionPlan: finalized.map(function (event, candidateIndex) {
      return { candidateIndex: candidateIndex, fields: event.fieldOrder.slice(), missing: event.missing.slice() };
    }),
    ledger: ledger,
    fieldOrder: finalized.map(function (event, candidateIndex) { return { candidateIndex: candidateIndex, fields: event.fieldOrder.slice() }; }),
    requiredFields: finalized.map(function (event, candidateIndex) { return { candidateIndex: candidateIndex, fields: event.requiredFields.slice() }; }),
    missing: finalized.map(function (event, candidateIndex) { return { candidateIndex: candidateIndex, fields: event.missing.slice() }; }),
    diagnostics: diagnostics,
  };
}

function materializeAuthoritativeLunaPlan(review, context, sourceText) {
  var items = review && Array.isArray(review.items) ? review.items : [];
  var events = [];
  var fullSpan = { start: 0, end: String(sourceText || "").length, text: String(sourceText || "") };
  var numericBalance = positiveAmount(context && context.remainingDebt) || positiveAmount(context && context.originalDebt) || 0;
  var previousOccurredDate = null;
  var reducingTypes = ["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation"];
  for (var validationIndex = 0; validationIndex < items.length; validationIndex += 1) {
    if (Number(items[validationIndex] && items[validationIndex].cardNumber) !== validationIndex + 1 || Number(items[validationIndex] && items[validationIndex].count) !== 1) {
      return { ok: false, reason: "luna_canonical_card_number_sequence" };
    }
  }
  for (var amountIndex = 0; amountIndex < items.length; amountIndex += 1) {
    var amountItem = items[amountIndex];
    if (!amountItem || amountItem.amountEur == null) continue;
    if (amountItem.eventType !== "installment_payment") {
      if (amountItem.amountRelation != null) return { ok: false, reason: "luna_canonical_amount_relation_non_installment" };
      continue;
    }
    if (!["total", "each"].includes(amountItem.amountRelation)) {
      var ambiguousCount = canonicalRepeatCount(amountItem.evidenceText);
      if (ambiguousCount >= 2 && amountIndex + ambiguousCount <= items.length && items.slice(amountIndex, amountIndex + ambiguousCount).every(function (candidate) {
        return candidate && candidate.eventType === "installment_payment" && candidate.amountRelation == null && candidate.amountEur === amountItem.amountEur;
      })) return { ok: false, reason: "luna_canonical_installment_amount_relation_missing" };
      continue;
    }
    var groupCount = canonicalRepeatCount(amountItem.evidenceText);
    if (!Number.isInteger(groupCount) || groupCount < 2 || amountIndex + groupCount > items.length) return { ok: false, reason: "luna_canonical_installment_group_count" };
    var groupEnd = amountIndex + groupCount;
    if (!items.slice(amountIndex, groupEnd).every(function (candidate) {
      return candidate && candidate.eventType === "installment_payment"
        && candidate.amountRelation === amountItem.amountRelation
        && candidate.amountEvidenceText === amountItem.amountEvidenceText;
    })) return { ok: false, reason: "luna_canonical_total_each_conflict" };
    if (amountItem.amountRelation === "each") {
      for (var eachIndex = amountIndex; eachIndex < groupEnd; eachIndex += 1) {
        if (!canonicalAmountSupported(items[eachIndex].amountEur, items[eachIndex].amountEvidenceText)) return { ok: false, reason: "luna_canonical_each_amount_conflict" };
        items[eachIndex]._installmentGroupIndex = eachIndex - amountIndex;
        items[eachIndex]._installmentGroupCount = groupCount;
      }
    } else {
      var totals = numberEngine.extractNumberExpressions(amountItem.amountEvidenceText || "").filter(function (expression) {
        return expression && expression.role === "money" && Number(expression.value) > 0;
      });
      if (totals.length !== 1) return { ok: false, reason: "luna_canonical_total_amount_evidence" };
      var totalCents = Math.round(Number(totals[0].value) * 100);
      if (totalCents % groupCount !== 0) return { ok: false, reason: "luna_canonical_total_amount_not_divisible" };
      var expectedAmounts = splitMoneyEvenly(Number(totals[0].value), groupCount);
      if (expectedAmounts.length !== groupCount) return { ok: false, reason: "luna_canonical_total_amount_split" };
      for (var totalIndex = amountIndex; totalIndex < groupEnd; totalIndex += 1) {
        amountItem = items[totalIndex];
        amountItem.amountEur = expectedAmounts[totalIndex - amountIndex];
        amountItem._installmentGroupIndex = totalIndex - amountIndex;
        amountItem._installmentGroupCount = groupCount;
        amountItem._statedTotalEur = Number(totals[0].value);
      }
    }
    amountIndex = groupEnd - 1;
  }
  items.forEach(function (item) {
    var count = Math.max(1, Math.min(MAX_EVENTS - events.length, Number(item && item.count) || 1));
    for (var repeatIndex = 0; repeatIndex < count; repeatIndex += 1) {
      var amount = positiveAmount(item.amountEur);
      var occurredDate = item.occurredDate == null ? null : validIsoDate(item.occurredDate);
      var occurredDateUnknown = item.occurredDateUnknown === true || item.occurredDateStatus === "unknown";
      var monthOnlyApproximation = Boolean(item.occurredDateRelation
        && ["month", "year"].includes(item.occurredDatePrecision)
        && item.occurredDateRelation.dayOfMonth == null);
      var occurredDateApproximate = item.occurredDateApproximate === true || item.occurredDateStatus === "approximate" || monthOnlyApproximation;
      if (item.occurredDateRelation && !monthOnlyApproximation) {
        occurredDate = canonicalDateFromRelation(item.occurredDateRelation, context && context.referenceDate, previousOccurredDate) || occurredDate;
      }
      if (item.eventType === "remaining_unpaid") amount = roundMoney(numericBalance);
      var description = item.description;
      if (item.eventType === "installment_payment" && item._installmentGroupCount > 1 && !description) {
        description = (item._installmentGroupIndex + 1) + "/" + item._installmentGroupCount + " obrok";
      }
      if (item.eventType === "installment_payment" && count > 1 && !description) {
        description = (repeatIndex + 1) + "/" + count + " obrok";
      }
      events.push(normalizeEvent({
        type: item.eventType,
        amount: amount,
        occurredDate: occurredDate,
        occurredDateUnknown: occurredDateUnknown,
        occurredDateApproximate: occurredDateApproximate,
        occurredDateApproximation: occurredDateApproximate
          ? item.occurredDatePrecision === "month" && item.occurredDateRelation && item.occurredDateRelation.direction === -1 && item.occurredDateRelation.amount === 1
            ? "prejšnji mesec"
            : trimText(item.occurredDate, 120) || trimText(item.occurredDateEvidenceText, 120)
          : null,
        promisedDate: item.promisedDate == null ? null : validIsoDate(item.promisedDate),
        promisedDateUnknown: item.promisedDateUnknown === true || item.promisedDateStatus === "unknown",
        promisedDateApproximate: item.promisedDateApproximate === true || item.promisedDateStatus === "approximate",
        promisedDateApproximation: item.promisedDateStatus === "approximate" ? trimText(item.promisedDate, 120) || trimText(item.promisedDateEvidenceText, 120) : null,
        paymentMethod: item.paymentMethod,
        communicationChannel: item.communicationChannel,
        documentReference: item.documentReference,
        reason: item.reason,
        description: description,
        confidence: "high",
        inheritedFrom: null,
        evidence: {
          clauseId: null, sourceSpan: fullSpan, explicit: false,
          reason: "luna_authoritative_human_review",
          amountRelation: item.amountRelation || null,
          statedTotalEur: item._statedTotalEur || null,
        },
      }, events.length));
      if (reducingTypes.includes(item.eventType) && amount != null) numericBalance = roundMoney(Math.max(0, numericBalance - amount));
      if (occurredDate) previousOccurredDate = occurredDate;
    }
  });
  var finalized = finalizeSystemCandidates(events, {
    originalDebt: context && context.originalDebt,
    remainingDebt: context && context.remainingDebt,
    referenceDate: context && context.referenceDate,
  }, ["luna_authoritative_human_review"]);
  if (finalized.diagnostics.some(function (diagnostic) {
    return /amount_exceeds_balance|paid_in_full_must_match|future_reduction_not_booked/.test(diagnostic);
  })) return { ok: false, reason: "luna_authoritative_ledger_or_time_conflict" };
  finalized.candidates = finalized.candidates.map(function (candidate, index) {
    return Object.assign({}, candidate, {
      cardNumber: index + 1,
      cardTypeId: CARD_ID_BY_TYPE[candidate.type] || CARD_ID_BY_TYPE.custom,
      fieldIds: (candidate.fieldOrder || []).map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }),
      requiresHumanReview: true,
    });
  });
  finalized.questionPlan = finalized.candidates.map(function (candidate, candidateIndex) {
    return {
      candidateIndex: candidateIndex,
      fields: candidate.fieldOrder.slice(),
      missing: candidate.missing.slice(),
      cardNumber: candidateIndex + 1,
      cardTypeId: candidate && candidate.cardTypeId || CARD_ID_BY_TYPE.custom,
      fieldIds: candidate.fieldOrder.map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }),
      missingFieldIds: candidate.missing.map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }),
    };
  });
  return {
    ok: true,
    result: Object.assign({
      summary: "Luna je pripravila kartice za uporabnikov pregled.",
      needsClarification: finalized.candidates.some(function (candidate) { return candidate.missing.length > 0; }),
      coverage: { complete: true, reason: "luna_authoritative_human_review", unconsumed: [], duplicates: [], unsupportedCandidates: [] },
    }, finalized),
  };
}

function canonicalizeCompletedInstallmentOrdinals(items, contract) {
  var list = Array.isArray(items) ? items : [];
  var groups = contract && Array.isArray(contract.installmentGroups) ? contract.installmentGroups.filter(function (group) {
    return group && group.completed === true && Number.isInteger(Number(group.count));
  }) : [];
  var installmentIndexes = list.map(function (item, index) {
    return item && item.eventType === "installment_payment" ? index : -1;
  }).filter(function (index) { return index >= 0; });
  var offset = 0;
  var changed = false;
  groups.forEach(function (group) {
    var count = Number(group.count);
    var indexes = installmentIndexes.slice(offset, offset + count);
    offset += count;
    if (indexes.length !== count) return;
    indexes.forEach(function (itemIndex, groupIndex) {
      var canonicalDescription = (groupIndex + 1) + "/" + count + " obrok";
      if (list[itemIndex].description !== canonicalDescription) changed = true;
      list[itemIndex].description = canonicalDescription;
    });
  });
  return changed;
}

function standaloneCompletedInstallmentGroup(sourceText, expectedCount, contract) {
  var text = trimText(sourceText, MAX_TEXT_LENGTH).toLowerCase().normalize("NFC");
  var count = Number(expectedCount);
  if (!Number.isInteger(count) || count < 2 || count > MAX_EVENTS) return null;
  var pattern = new RegExp("(?<![\\p{L}\\d])(?:" + numberEngine.NUMBER_EXPRESSION_SOURCE + ")\\s+obrok\\w*", "giu");
  var matches = [];
  var match;
  while ((match = pattern.exec(text))) {
    var countText = match[0].replace(/\s+obrok\w*$/iu, "").trim();
    var parsedCount = numberEngine.parseSlovenianNumber(countText, { count: true });
    if (parsedCount !== count) continue;
    var prefix = text.slice(Math.max(0, match.index - 90), match.index);
    if (!/(?:plačal\w*|poravnal\w*|nakazal\w*|plačan\w*|poravnan\w*)\s*(?:je\s*)?$/iu.test(prefix)) continue;
    if (/(?:\bni|\bne|\bnikoli|\bbo|\bbodo|\bobljubil\w*|\bpredlagal\w*)[^.!?;]{0,45}$/iu.test(prefix)) continue;
    matches.push({ start: match.index, end: match.index + countText.length, text: countText });
  }
  if (matches.length !== 1) return null;
  var seriesEnd = text.length;
  var clauses = contract && Array.isArray(contract.clauses) ? contract.clauses : [];
  clauses.some(function (clause) {
    var clauseStart = Number(clause && clause.span && clause.span.start);
    if (!Number.isInteger(clauseStart) || clauseStart <= matches[0].end) return false;
    var clauseText = trimText(clause && clause.text, MAX_TEXT_LENGTH);
    var installmentReference = /\b(?:obrok\w*|prvi\w*|začetn\w*)\b/iu.test(clauseText);
    var differentEvent = Array.isArray(clause && clause.eventTypes) && clause.eventTypes.some(function (eventType) {
      return eventType && eventType !== "installment_payment";
    });
    var separateDatedEvent = !installmentReference && Boolean(inferOccurredDate(clauseText, "2000-01-15"));
    if (!differentEvent && !separateDatedEvent) return false;
    seriesEnd = clauseStart;
    return true;
  });
  return {
    id: "standalone-installment-series-1", count: count, completed: true,
    span: { start: 0, end: seriesEnd, text: text.slice(0, seriesEnd) },
    countSpan: matches[0],
    reason: "explicit_completed_installment_count_without_uniform_amount",
  };
}

function deferUnanchoredInstallmentDates(items, context, sourceText, contract) {
  var list = Array.isArray(items) ? items : [];
  var referenceDate = context && context.referenceDate;
  var cadences = contract && Array.isArray(contract.installmentCadences) ? contract.installmentCadences : [];
  var groups = contract && Array.isArray(contract.installmentGroups) ? contract.installmentGroups.filter(function (group) {
    return group && group.completed === true && Number.isInteger(Number(group.count));
  }) : [];
  var installmentIndexes = list.map(function (item, index) {
    return item && item.eventType === "installment_payment" ? index : -1;
  }).filter(function (index) { return index >= 0; });
  if (!groups.length && installmentIndexes.length >= 2) {
    var standaloneGroup = standaloneCompletedInstallmentGroup(sourceText, installmentIndexes.length, contract);
    if (standaloneGroup) {
      groups = [standaloneGroup];
      cadences = temporalEngine.extractInstallmentCadences(sourceText, groups);
    }
  }
  var groupOffsets = new Map();
  var offset = 0;
  groups.forEach(function (group) {
    groupOffsets.set(group.id, offset);
    offset += Number(group.count);
  });
  var changed = false;
  cadences.forEach(function (cadence) {
    var count = Number(cadence && cadence.installmentCount);
    var interval = Number(cadence && cadence.intervalAmount);
    if (!cadence || cadence.conflict || !Number.isInteger(count) || count < 2 || !Number.isInteger(interval) || interval < 1 || !cadence.unit) return;
    var groupOffset = groupOffsets.get(cadence.groupId);
    if (!Number.isInteger(groupOffset)) return;
    var groupClause = contract && Array.isArray(contract.clauses) ? contract.clauses.find(function (clause) {
      return clause && Array.isArray(clause.installmentGroups) && clause.installmentGroups.some(function (group) { return group && group.id === cadence.groupId; });
    }) : null;
    var cadenceGroup = groups.find(function (group) { return group && group.id === cadence.groupId; });
    var groupSource = groupClause && groupClause.text || cadenceGroup && cadenceGroup.span && cadenceGroup.span.text || sourceText;
    if (inferOccurredDate(groupSource, referenceDate)) return;
    var indexes = installmentIndexes.slice(groupOffset, groupOffset + count);
    if (indexes.length !== count) return;
    indexes.forEach(function (itemIndex, groupIndex) {
      var item = list[itemIndex];
      if (item.occurredDate != null || item.occurredDateRelation != null) changed = true;
      item.occurredDate = null;
      item.occurredDateUnknown = false;
      item.occurredDateApproximate = false;
      item.occurredDateStatus = null;
      item.occurredDateRelation = groupIndex === 0 ? null : {
        anchor: "previous_event", direction: 1, amount: interval, unit: cadence.unit, dayOfMonth: null,
      };
    });
  });
  return changed;
}

function completedInstallmentSeries(list, start, end, sourceText) {
  if (end - start <= 1) return { ok: true, ranges: [{ start: start, end: end }] };
  var ranges = [];
  var cursor = start;
  while (cursor < end) {
    var first = installmentOrdinalParts(list[cursor] && list[cursor].description);
    if (!first || first.ordinal !== 1 || cursor + first.count > end) return { ok: false, reason: "luna_installment_ordinal_invalid" };
    for (var offset = 0; offset < first.count; offset += 1) {
      var ordinal = installmentOrdinalParts(list[cursor + offset] && list[cursor + offset].description);
      if (!ordinal || ordinal.ordinal !== offset + 1 || ordinal.count !== first.count) {
        return { ok: false, reason: "luna_installment_ordinal_invalid" };
      }
    }
    ranges.push({ start: cursor, end: cursor + first.count });
    cursor += first.count;
  }
  if (ranges.length > 1) {
    var explicitGroups = installmentEngine.extractInstallmentGroups(sourceText).filter(function (group) {
      return group && group.completed === true && Number.isInteger(Number(group.count));
    });
    var matchingGroups = null;
    for (var groupOffset = 0; groupOffset + ranges.length <= explicitGroups.length; groupOffset += 1) {
      var candidateGroups = explicitGroups.slice(groupOffset, groupOffset + ranges.length);
      var matches = candidateGroups.every(function (group, groupIndex) {
        var range = ranges[groupIndex];
        if (Number(group.count) !== range.end - range.start) return false;
        var groupAmount = positiveAmount(group.amount);
        return groupAmount == null || list.slice(range.start, range.end).every(function (item) {
          return Math.abs(Number(item && item.amountEur) - groupAmount) < 0.005;
        });
      });
      if (matches) { matchingGroups = candidateGroups; break; }
    }
    if (!matchingGroups) return { ok: false, reason: "luna_installment_ordinal_invalid" };
  }
  return { ok: true, ranges: ranges };
}

function evidenceContainsInstallmentGroup(sourceText, evidenceText, group) {
  var source = String(sourceText || "");
  var evidence = trimText(evidenceText, 500);
  var span = group && group.span;
  if (!evidence || !span || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.end <= span.start) return false;
  var cursor = source.indexOf(evidence);
  while (cursor >= 0) {
    if (cursor <= span.start && cursor + evidence.length >= span.end) return true;
    cursor = source.indexOf(evidence, cursor + 1);
  }
  return false;
}

function explicitInstallmentOrdinalGroups(list, start, end, sourceText) {
  var source = String(sourceText || "");
  var length = end - start;
  if (!source || length < 2) return null;
  var groups = installmentEngine.extractInstallmentGroups(source).filter(function (group) {
    return group && group.completed === true && Number.isInteger(Number(group.count)) && Number(group.count) > 0
      && positiveAmount(group.amount) != null;
  });
  var matches = [];
  for (var groupStart = 0; groupStart < groups.length; groupStart += 1) {
    var candidateGroups = [];
    var totalCount = 0;
    for (var groupIndex = groupStart; groupIndex < groups.length && totalCount < length; groupIndex += 1) {
      candidateGroups.push(groups[groupIndex]);
      totalCount += Number(groups[groupIndex].count);
    }
    if (totalCount !== length || candidateGroups.length < 2) continue;
    var boundariesAreExplicit = candidateGroups.every(function (group, candidateIndex) {
      if (candidateIndex === 0) return true;
      var previous = candidateGroups[candidateIndex - 1];
      return Number(group.count) !== Number(previous.count)
        || Math.abs(positiveAmount(group.amount) - positiveAmount(previous.amount)) >= 0.005;
    });
    if (!boundariesAreExplicit) continue;
    var itemOffset = 0;
    var supported = candidateGroups.every(function (group) {
      var count = Number(group.count);
      var amount = positiveAmount(group.amount);
      var groupItems = list.slice(start + itemOffset, start + itemOffset + count);
      itemOffset += count;
      return groupItems.length === count && groupItems.every(function (item) {
        return item && item.eventType === "installment_payment"
          && installmentOrdinalParts(item.description)
          && Math.abs(Number(item.amountEur) - amount) < 0.005
          && evidenceContainsInstallmentGroup(source, item.evidenceText, group);
      });
    });
    if (supported) matches.push(candidateGroups);
  }
  return matches.length === 1 ? matches[0] : null;
}

function canonicalizeExplicitInstallmentGroupOrdinals(items, sourceText) {
  var list = Array.isArray(items) ? items : [];
  var changed = false;
  var start = 0;
  while (start < list.length) {
    if (!list[start] || list[start].eventType !== "installment_payment") { start += 1; continue; }
    var end = start + 1;
    while (end < list.length && list[end] && list[end].eventType === "installment_payment") end += 1;
    var groups = explicitInstallmentOrdinalGroups(list, start, end, sourceText);
    if (groups) {
      var offset = 0;
      groups.forEach(function (group) {
        var count = Number(group.count);
        for (var ordinal = 1; ordinal <= count; ordinal += 1) {
          var description = ordinal + "/" + count + " obrok";
          if (list[start + offset].description !== description) changed = true;
          list[start + offset].description = description;
          offset += 1;
        }
      });
    }
    start = end;
  }
  return changed;
}

function validateLunaInstallmentSeries(items, sourceText) {
  var list = Array.isArray(items) ? items : [];
  var start = 0;
  while (start < list.length) {
    if (!list[start] || list[start].eventType !== "installment_payment") { start += 1; continue; }
    var end = start + 1;
    while (end < list.length && list[end] && list[end].eventType === "installment_payment") end += 1;
    var series = completedInstallmentSeries(list, start, end, sourceText);
    if (!series.ok) return series.reason;
    for (var seriesIndex = 0; seriesIndex < series.ranges.length; seriesIndex += 1) {
      var range = series.ranges[seriesIndex];
      var count = range.end - range.start;
      if (count <= 1) continue;
      var unanchored = list.slice(range.start, range.end).every(function (item) { return !item.occurredDate; });
      var hasStructuredCadence = list.slice(range.start, range.end).some(function (item) { return Boolean(item.occurredDateRelation); });
      var hasLaterStructuredCadence = list.slice(range.start + 1, range.end).some(function (item) {
        return Boolean(item.occurredDateRelation && item.occurredDateRelation.anchor === "previous_event");
      });
      if (unanchored && hasStructuredCadence && list[range.start].occurredDateRelation) return "luna_unanchored_first_installment_relation_forbidden";
      if ((unanchored && hasStructuredCadence) || hasLaterStructuredCadence) {
        for (var relationOffset = 1; relationOffset < count; relationOffset += 1) {
          var relation = list[range.start + relationOffset].occurredDateRelation;
          if (!relation || relation.anchor !== "previous_event" || relation.direction !== 1 || !Number.isInteger(Number(relation.amount)) || Number(relation.amount) < 1 || !relation.unit) {
            return "luna_installment_relation_missing";
          }
        }
      }
    }
    start = end;
  }
  return null;
}

function sourceHasExplicitInstallmentCadence(sourceText, installmentCount) {
  var source = String(sourceText || "");
  var count = Number(installmentCount);
  if (!source || !Number.isInteger(count) || count < 2) return false;
  return temporalEngine.extractInstallmentCadences(source, [{
    id: "luna-installment-review", count: count, completed: true,
    span: { start: 0, end: source.length, text: source },
    countSpan: { start: 0, end: 0, text: "" },
  }]).length > 0;
}

function lunaInstallmentSeriesNeedsCadenceReview(items, sourceText) {
  var list = Array.isArray(items) ? items : [];
  var start = 0;
  while (start < list.length) {
    if (!list[start] || list[start].eventType !== "installment_payment") { start += 1; continue; }
    var end = start + 1;
    while (end < list.length && list[end] && list[end].eventType === "installment_payment") end += 1;
    var series = completedInstallmentSeries(list, start, end, sourceText);
    if (!series.ok) return false;
    if (series.ranges.some(function (range) {
      var group = list.slice(range.start, range.end);
      return group.length > 1
        && group.slice(1).every(function (item) { return !item.occurredDateRelation; })
        && sourceHasExplicitInstallmentCadence(sourceText, group.length);
    })) return true;
    start = end;
  }
  return false;
}

function lunaRelativeDatePrecisionNeedsReview(items) {
  return (Array.isArray(items) ? items : []).some(function (item) {
    return Boolean(item && item.occurredDateApproximate === true && item.occurredDateRelation);
  });
}

function formatEuroCents(cents) {
  return (Math.max(0, Number(cents) || 0) / 100).toFixed(2).replace(".", ",");
}

function installmentOrdinalParts(description) {
  var match = trimText(description, 80).match(/^(\d+)\/(\d+) obrok$/u);
  if (!match) return null;
  var ordinal = Number(match[1]);
  var count = Number(match[2]);
  return Number.isInteger(ordinal) && Number.isInteger(count) && ordinal >= 1 && ordinal <= count && count >= 1
    ? { ordinal: ordinal, count: count }
    : null;
}

function amountClarification(context, evidenceText, eventType) {
  var nextRound = Number(context && context.clarification && context.clarification.round || 0) + 1;
  if (nextRound > MAX_CLARIFICATION_ROUNDS) return null;
  return {
    question: eventType === "installment_payment"
      ? "Kolikšen je bil znesek vsakega od naslednjih obrokov?"
      : "Kolikšen je bil točen znesek tega dogodka?",
    clauseId: "clause-1",
    evidenceText: trimText(evidenceText, 500),
    round: nextRound,
    maxRounds: MAX_CLARIFICATION_ROUNDS,
  };
}

function validateLeanAmountEvidence(items, context, sourceText) {
  var list = Array.isArray(items) ? items : [];
  var balance = positiveAmount(context && context.remainingDebt) || positiveAmount(context && context.originalDebt) || 0;
  var reducingTypes = ["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation"];
  for (var index = 0; index < list.length; index += 1) {
    var item = list[index] || {};
    if (item.amountEur == null) continue;
    var amount = positiveAmount(item.amountEur);
    var eventEvidence = trimText(item.evidenceText, 500);
    var amountEvidence = trimText(item.amountEvidenceText, 500);
    var reason = null;
    if (!amount) reason = "luna_amount_invalid";
    else if (!lunaPolicy.evidenceIsLinked(sourceText, eventEvidence) || !lunaPolicy.evidenceIsLinked(sourceText, amountEvidence)) reason = "luna_amount_evidence_unlinked";
    else if (!eventEvidence.includes(amountEvidence)) reason = "luna_amount_evidence_outside_event";
    else if (item.eventType === "installment_payment" && item.amountRelation === "total") {
      var ordinal = installmentOrdinalParts(item.description);
      var groupCount = ordinal && ordinal.count || canonicalRepeatCount(eventEvidence);
      var totals = numberEngine.extractNumberExpressions(amountEvidence).filter(function (expression) {
        return expression && ["money", "number"].includes(expression.role) && Number(expression.value) > 0;
      });
      var split = groupCount >= 2 && totals.length === 1 ? splitMoneyEvenly(Number(totals[0].value), groupCount) : [];
      var splitIndex = ordinal ? ordinal.ordinal - 1 : 0;
      if (!split.length || splitIndex >= split.length || Math.abs(Number(split[splitIndex]) - amount) >= 0.005) reason = "luna_total_amount_evidence_unsupported";
      else item.amountEur = split[splitIndex];
    } else {
      var directlySupported = canonicalAmountSupported(amount, amountEvidence);
      var noAmountNumber = !numberEngine.extractNumberExpressions(amountEvidence).some(function (expression) {
        return expression && ["money", "number"].includes(expression.role);
      });
      var contextDerived = noAmountNumber && (
        item.eventType === "paid_in_full" && Math.abs(amount - balance) < 0.005
        || item.eventType === "remaining_unpaid" && Math.abs(amount - balance) < 0.005
      );
      if (!directlySupported && !contextDerived) reason = "luna_amount_evidence_unsupported";
    }
    if (reason) {
      var clarification = amountClarification(context, eventEvidence, item.eventType);
      return { ok: false, reason: reason, clarification: clarification, clarificationExhausted: !clarification };
    }
    if (item.amountRelation != null && item.eventType !== "installment_payment") {
      return { ok: false, reason: "luna_amount_relation_non_installment" };
    }
    if (reducingTypes.includes(item.eventType) && amount != null) balance = roundMoney(Math.max(0, balance - amount));
  }
  return { ok: true };
}

function validateLunaDebtInvariant(items, context) {
  var debt = positiveAmount(context && context.remainingDebt) || positiveAmount(context && context.originalDebt) || 0;
  var debtCents = Math.round(debt * 100);
  var totalCents = (Array.isArray(items) ? items : []).reduce(function (sum, item) {
    var rule = AUTHORITATIVE_RULES[item && item.eventType];
    var amount = positiveAmount(item && item.amountEur);
    return rule && rule.balanceEffect === "subtract" && amount != null
      ? sum + Math.round(amount * 100)
      : sum;
  }, 0);
  if (totalCents <= debtCents) return { ok: true, totalCents: totalCents, debtCents: debtCents };
  var original = positiveAmount(context && context.originalDebt);
  var debtLabel = original != null && Math.round(original * 100) === debtCents ? "prvotni dolg" : "preostali dolg";
  return {
    ok: false,
    reason: "luna_payment_total_exceeds_debt",
    clarification: {
      question: "Skupaj si navedel " + formatEuroCents(totalCents) + " €, " + debtLabel + " pa je " + formatEuroCents(debtCents) + " €. Popravi znesek ali število obrokov.",
      clauseId: "clause-1",
      round: Math.max(1, Math.min(MAX_CLARIFICATION_ROUNDS, Number(context && context.clarification && context.clarification.round || 0) + 1)),
      maxRounds: MAX_CLARIFICATION_ROUNDS,
    },
  };
}

function ignorableLeanEvidenceGap(value) {
  var normalized = String(value || "").toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (!normalized) return true;
  var connectors = new Set(["in", "pa", "ter", "nato", "potem", "zatem", "nakar", "ampak", "vendar", "toda", "še", "tudi", "obenem", "hkrati", "je", "and", "then", "but", "und", "dann", "aber"]);
  return normalized.split(/\s+/u).every(function (token) { return connectors.has(token); });
}

function validateLeanEvidenceCoverage(items, sourceText) {
  var source = String(sourceText || "");
  var spans = [];
  var cursor = 0;
  var previousEvidence = "";
  (Array.isArray(items) ? items : []).forEach(function (item) {
    var evidence = trimText(item && item.evidenceText, 500);
    var span = exactLeanEvidenceSpan(source, evidence, cursor, previousEvidence);
    if (!span) return;
    spans.push(span);
    cursor = Math.max(cursor, span.end);
    previousEvidence = evidence;
  });
  if (!spans.length) return { ok: false, reason: "luna_compact_source_coverage_gap" };
  spans.sort(function (left, right) { return left.start - right.start || left.end - right.end; });
  var coveredEnd = 0;
  for (var index = 0; index < spans.length; index += 1) {
    if (spans[index].start > coveredEnd && !ignorableLeanEvidenceGap(source.slice(coveredEnd, spans[index].start))) {
      return { ok: false, reason: "luna_compact_source_coverage_gap" };
    }
    coveredEnd = Math.max(coveredEnd, spans[index].end);
  }
  if (!ignorableLeanEvidenceGap(source.slice(coveredEnd))) return { ok: false, reason: "luna_compact_source_coverage_gap" };
  return { ok: true, spans: spans };
}

// Adapter ne razlaga ali preverja Luninega pomena. Kataloške ID-je samo
// preslika v UI-polja; vse vsebinske vrednosti ostanejo za človeški pregled.
function materializeLunaFieldPlan(review, context, sourceText, contract) {
  var items = review && Array.isArray(review.items) ? review.items.slice(0, MAX_EVENTS).map(function (item) { return Object.assign({}, item); }) : [];
  lunaPolicy.assertAdapterOperations(["schema_validation", "catalog_id_mapping", "human_review_projection"]);
  var fullSpan = { start: 0, end: String(sourceText || "").length, text: String(sourceText || "") };
  var evidenceCursor = 0;
  var events = items.map(function (item, index) {
    var evidenceText = trimText(item.evidenceText, 500);
    var evidenceStart = evidenceText ? String(sourceText || "").indexOf(evidenceText, evidenceCursor) : -1;
    if (evidenceStart < 0 && evidenceText) evidenceStart = String(sourceText || "").indexOf(evidenceText);
    var eventSpan = evidenceStart >= 0
      ? { start: evidenceStart, end: evidenceStart + evidenceText.length, text: evidenceText }
      : fullSpan;
    if (evidenceStart >= 0) evidenceCursor = Math.max(evidenceCursor, eventSpan.end);
    var occurredDateApproximate = item.occurredDateApproximate === true || item.occurredDateStatus === "approximate";
    var occurredDateUnknown = item.occurredDateUnknown === true || item.occurredDateStatus === "unknown";
    var occurredDate = item.occurredDate == null ? null : trimText(item.occurredDate, 120) || null;
    var dateRelation = item.occurredDateRelation && !occurredDateUnknown && !occurredDateApproximate
      ? Object.assign({ field: "occurredDate" }, item.occurredDateRelation)
      : null;
    return {
      candidateId: "candidate-" + (index + 1),
      type: item.eventType,
      amount: typeof item.amountEur === "number" && Number.isFinite(item.amountEur) ? item.amountEur : null,
      currency: "EUR",
      occurredDate: occurredDate,
      occurredDateUnknown: occurredDateUnknown,
      occurredDateApproximate: occurredDateApproximate,
      occurredDateApproximation: occurredDateApproximate ? trimText(item.occurredDate, 120) || trimText(item.occurredDateEvidenceText, 120) : null,
      dateRelation: dateRelation,
      promisedDate: item.promisedDate == null ? null : trimText(item.promisedDate, 120) || null,
      promisedDateUnknown: item.promisedDateUnknown === true || item.promisedDateStatus === "unknown",
      promisedDateApproximate: item.promisedDateApproximate === true || item.promisedDateStatus === "approximate",
      promisedDateApproximation: item.promisedDateStatus === "approximate" ? trimText(item.promisedDate, 120) || trimText(item.promisedDateEvidenceText, 120) : null,
      paymentMethod: item.paymentMethod || null,
      communicationChannel: item.communicationChannel || null,
      documentReference: trimText(item.documentReference, 120) || null,
      reason: trimText(item.reason, 300) || null,
      description: trimText(item.description, 500) || null,
      confidence: "high",
      temporalStatus: null,
      inheritedFrom: null,
      dueDate: null,
      missing: [],
      providedFieldIds: Array.isArray(item.providedFieldIds) ? item.providedFieldIds.slice() : [],
      evidence: {
        clauseId: null,
        sourceSpan: eventSpan,
        explicit: true,
        reason: "luna_id_to_field_adapter",
        amountRelation: item.amountRelation || null,
      },
    };
  });
  var finalized = finalizeSystemCandidates(events, {
    originalDebt: context && context.originalDebt,
    remainingDebt: context && context.remainingDebt,
    referenceDate: context && context.referenceDate,
  }, ["luna_id_to_field_adapter", "luna_values_accepted_for_human_review", lunaPolicy.SEMANTIC_AUTHORITY_VERSION]);
  finalized.candidates = finalized.candidates.map(function (candidate, index) {
    return Object.assign({}, candidate, {
      cardNumber: index + 1,
      cardTypeId: CARD_ID_BY_TYPE[candidate.type] || CARD_ID_BY_TYPE.custom,
      fieldIds: candidate.providedFieldIds.slice(),
      requiresHumanReview: true,
    });
  });
  finalized.questionPlan = finalized.candidates.map(function (candidate, candidateIndex) {
    return {
      candidateIndex: candidateIndex,
      fields: candidate.fieldOrder.slice(),
      missing: candidate.missing.slice(),
      cardNumber: candidateIndex + 1,
      cardTypeId: candidate.cardTypeId,
      fieldIds: candidate.fieldIds.slice(),
      missingFieldIds: candidate.missing.map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }),
    };
  });
  return {
    ok: true,
    result: Object.assign({
      summary: "Luna je pripravila kartice za uporabnikov pregled.",
      needsClarification: finalized.candidates.some(function (candidate) { return candidate.missing.length > 0; }),
      coverage: { complete: true, reason: "luna_authoritative_human_review", unconsumed: [], duplicates: [], unsupportedCandidates: [] },
    }, finalized),
  };
}

function compactFieldRows(compactItem) {
  compactItem = compactItem || {};
  var legacy = Array.isArray(compactItem.f);
  var rows;
  if (legacy) {
    if (!lunaPolicy.hasExactKeys(compactItem, ["n", "c", "e", "f"]) || !Number.isInteger(compactItem.n) || compactItem.n < 1 || compactItem.f.length > 8 ||
        compactItem.f.some(function (field) { return !lunaPolicy.hasExactKeys(field, ["i", "v", "e", "r"]); })) return { ok: false, reason: "luna_compact_card_shape" };
    rows = compactItem.f;
  } else {
    if (!lunaPolicy.hasExactKeys(compactItem, ["c", "e", "i", "v", "x", "r"])) return { ok: false, reason: "luna_compact_card_shape" };
    var columns = [compactItem.i, compactItem.v, compactItem.x, compactItem.r];
    if (!columns.every(Array.isArray)) return { ok: false, reason: "luna_compact_field_columns" };
    if (columns.some(function (column) { return column.length !== columns[0].length || column.length > 8; })) {
      return { ok: false, reason: "luna_compact_column_lengths" };
    }
    rows = compactItem.i.map(function (fieldId, index) {
      return { i: fieldId, v: compactItem.v[index], e: compactItem.x[index], r: compactItem.r[index] };
    });
  }
  if (rows.length > 8) return { ok: false, reason: "luna_compact_field_count" };
  var seen = new Set();
  for (var index = 0; index < rows.length; index += 1) {
    var row = rows[index] || {};
    var fieldId = row.i;
    var valueType = typeof row.v;
    if (!Number.isInteger(fieldId) || !FIELD_NAME_BY_ID[fieldId] || !Array.isArray(row.r) || row.r.length > 7 ||
        row.r.some(function (value) { return value !== null && !Number.isInteger(value); }) ||
        !(row.v === null || valueType === "number" || (valueType === "string" && row.v.length <= 500)) ||
        typeof row.e !== "string" || !row.e.trim() || row.e.length > 500) return { ok: false, reason: "luna_compact_field_domain" };
    if (seen.has(fieldId)) return { ok: false, reason: "luna_compact_field_duplicate" };
    seen.add(fieldId);
  }
  return { ok: true, rows: rows };
}

function expandCompactPlanResponse(parsed) {
  if (!parsed || !Array.isArray(parsed.p)) return parsed;
  return {
    plan: parsed.p.map(function (compactItem, itemIndex) {
      compactItem = compactItem || {};
      var compactFields = compactFieldRows(compactItem);
      return {
        cardNumber: compactItem.n == null ? itemIndex + 1 : compactItem.n,
        cardId: compactItem.c,
        evidenceText: compactItem.e,
        count: 1,
        inheritedFromEvidenceText: null,
        fields: (compactFields.ok ? compactFields.rows : []).map(function (compactField) {
          compactField = compactField || {};
          var fieldId = Number(compactField.i);
          var relation = Array.isArray(compactField.r) ? compactField.r : [];
          var enumerated = fieldId === FIELD_ID_BY_NAME.paymentMethod || fieldId === FIELD_ID_BY_NAME.communicationChannel;
          return {
            fieldId: fieldId,
            numberValue: fieldId === FIELD_ID_BY_NAME.amountEur ? compactField.v : null,
            textValue: fieldId !== FIELD_ID_BY_NAME.amountEur && !enumerated ? compactField.v : null,
            valueId: enumerated ? compactField.v : null,
            evidenceText: compactField.e,
            datePrecisionId: relation[0] == null ? null : relation[0],
            dateStatusId: relation[1] == null ? null : relation[1],
            relationAnchorId: relation[2] == null ? null : relation[2],
            relationDirectionId: relation[3] == null ? null : relation[3],
            relationAmount: relation[4] == null ? null : relation[4],
            relationUnitId: relation[5] == null ? null : relation[5],
            relationDayOfMonth: relation[6] == null ? null : relation[6],
            amountRelationId: fieldId === FIELD_ID_BY_NAME.amountEur && relation[0] != null ? relation[0] : null,
          };
        }),
      };
    }),
    clarificationQuestion: parsed.q,
    clarificationEvidenceText: parsed.x,
  };
}

function parsePlanReview(output, proposal, contract, sourceText) {
  var compact = trimText(output, 16000);
  var current = Array.isArray(proposal) ? proposal.map(function (link) { return Object.assign({}, link); }) : [];
  if (compact === "OK") return { ok: true, verdict: "ok", reason: "luna_review_ok", links: current };
  var parsed;
  try { parsed = expandCompactPlanResponse(JSON.parse(compact)); }
  catch (_error) { return { ok: false, verdict: "invalid", reason: "luna_review_invalid_response", links: current }; }
  if (parsed && Array.isArray(parsed.plan)) {
    var clarificationQuestion = trimText(parsed.clarificationQuestion, 180);
    var clarificationClauseId = trimText(parsed.clarificationClauseId, 80);
    var clarificationEvidenceText = trimText(parsed.clarificationEvidenceText, 500);
    if (!clarificationClauseId && clarificationEvidenceText) {
      var clarificationEvidence = evidenceClauseLink(contract, String(sourceText || ""), clarificationEvidenceText, 0);
      clarificationClauseId = clarificationEvidence && clarificationEvidence.clauseId || "";
    }
    if (!parsed.plan.length && clarificationQuestion && contract.clauses.some(function (clause) { return clause.id === clarificationClauseId; })) {
      return { ok: true, verdict: "clarification", reason: "luna_clarification_requested", links: [], question: clarificationQuestion, clauseId: clarificationClauseId };
    }
    var solutionLinks = [];
    var canonicalItems = [];
    var previousClauseIndex = 0;
    var previousEvidenceStart = -1;
    for (var planIndex = 0; planIndex < parsed.plan.length; planIndex += 1) {
      var planItem = parsed.plan[planIndex] || {};
      var count = planItem.count == null ? 1 : Number(planItem.count);
      if (!Number.isInteger(count) || count < 1 || solutionLinks.length + count > MAX_EVENTS) {
        return { ok: false, verdict: "solution", reason: "luna_review_solution_count", links: current };
      }
      var authoritativeWire = canonicalItemFromWire(planItem);
      if (authoritativeWire.ok && Array.isArray(planItem.fields)) {
        var authoritativeClause = contract.clauses[Math.min(planIndex, Math.max(0, contract.clauses.length - 1))] || null;
        var authoritativeClauseId = authoritativeClause && authoritativeClause.id || null;
        canonicalItems.push(Object.assign({}, authoritativeWire.item, {
          clauseId: authoritativeClauseId, inheritedFrom: null,
          _eventSpan: { start: 0, end: String(sourceText || "").length, text: String(sourceText || "") },
        }));
        for (var authoritativeIndex = 0; authoritativeIndex < count; authoritativeIndex += 1) {
          solutionLinks.push({
            index: solutionLinks.length, clauseId: authoritativeClauseId,
            eventType: authoritativeWire.item.eventType, inheritedFrom: null,
          });
        }
        continue;
      }
      var clauseId = trimText(planItem.clauseId, 80) || null;
      var inheritedFrom = trimText(planItem.inheritedFrom, 80) || null;
      var eventSpan = null;
      if (!clauseId) {
        var evidenceLink = evidenceClauseLink(contract, String(sourceText || ""), planItem.evidenceText, 0);
        if (!evidenceLink) evidenceLink = evidenceClauseLinkFromFields(contract, String(sourceText || ""), planItem.fields, previousClauseIndex);
        if (!evidenceLink) return { ok: false, verdict: "solution", reason: "luna_review_evidence_not_found", links: current };
        if (evidenceLink.start < previousEvidenceStart) return { ok: false, verdict: "solution", reason: "luna_review_wrong_evidence_order", links: current };
        clauseId = evidenceLink.clauseId;
        var evidenceClause = contract.clauses[evidenceLink.clauseIndex];
        eventSpan = evidenceClause && evidenceClause.span ? {
          start: evidenceClause.span.start, end: evidenceClause.span.end,
          text: String(sourceText || "").slice(evidenceClause.span.start, evidenceClause.span.end),
        } : {
          start: evidenceLink.start, end: evidenceLink.end,
          text: String(sourceText || "").slice(evidenceLink.start, evidenceLink.end),
        };
        previousEvidenceStart = evidenceLink.start;
        previousClauseIndex = evidenceLink.clauseIndex;
        var inheritedEvidence = trimText(planItem.inheritedFromEvidenceText, 500);
        if (inheritedEvidence) {
          var inheritedLink = evidenceClauseLink(contract, String(sourceText || ""), inheritedEvidence, 0);
          if (!inheritedLink) return { ok: false, verdict: "solution", reason: "luna_review_inherited_evidence_not_found", links: current };
          inheritedFrom = inheritedLink.clauseId;
        }
      } else {
        var legacyClauseIndex = contract.clauses.findIndex(function (clause) { return clause.id === clauseId; });
        if (legacyClauseIndex >= 0) previousClauseIndex = legacyClauseIndex;
        var legacyClause = legacyClauseIndex >= 0 ? contract.clauses[legacyClauseIndex] : null;
        eventSpan = legacyClause && legacyClause.span || null;
      }
      var canonicalWire = canonicalItemFromWire(planItem);
      if (!canonicalWire.ok && (Array.isArray(planItem.fields) || Object.prototype.hasOwnProperty.call(planItem, "amountEur"))) return { ok: false, verdict: "solution", reason: canonicalWire.reason || "luna_canonical_invalid_field", links: current };
      var isCanonical = canonicalWire.ok;
      if (isCanonical) canonicalItems.push(Object.assign({}, canonicalWire.item, { clauseId: clauseId, inheritedFrom: inheritedFrom, _eventSpan: eventSpan }));
      for (var repeatIndex = 0; repeatIndex < count; repeatIndex += 1) {
        solutionLinks.push({
          index: solutionLinks.length,
          clauseId: clauseId,
          eventType: canonicalWire.ok ? canonicalWire.item.eventType : trimText(planItem.eventType, 80) || null,
          inheritedFrom: inheritedFrom,
        });
      }
    }
    if (!solutionLinks.length) return { ok: false, verdict: "solution", reason: "luna_review_solution_missing", links: current };
    var canonicalPlan = canonicalItems.length === parsed.plan.length;
    var solutionValidation = canonicalPlan ? { ok: true, reason: "luna_authoritative_structure" } : validateReviewLinks(solutionLinks, contract);
    return { ok: solutionValidation.ok, verdict: "solution", reason: solutionValidation.ok ? "luna_review_solution_valid" : solutionValidation.reason, links: solutionLinks, items: canonicalItems, canonical: canonicalItems.length === parsed.plan.length };
  }
  var fixes = parsed && Array.isArray(parsed.fix) ? parsed.fix : null;
  if (!fixes || !fixes.length || fixes.length > 8) return { ok: false, verdict: "invalid", reason: "luna_review_fix_missing", links: current };
  for (var fixIndex = 0; fixIndex < fixes.length; fixIndex += 1) {
    var fix = fixes[fixIndex] || {};
    var operation = fix.op || "set";
    var targetIndex = Number(fix.index);
    if (!Number.isInteger(targetIndex)) return { ok: false, verdict: "fix", reason: "luna_review_invalid_index", links: current };
    if (operation === "remove") {
      if (targetIndex < 0 || targetIndex >= current.length) return { ok: false, verdict: "fix", reason: "luna_review_invalid_index", links: current };
      current.splice(targetIndex, 1);
      continue;
    }
    var replacement = {
      index: targetIndex,
      clauseId: trimText(fix.clauseId, 80) || null,
      eventType: trimText(fix.eventType, 80) || null,
      inheritedFrom: trimText(fix.inheritedFrom, 80) || null,
    };
    if (operation === "add") {
      if (targetIndex < 0 || targetIndex > current.length) return { ok: false, verdict: "fix", reason: "luna_review_invalid_index", links: current };
      current.splice(targetIndex, 0, replacement);
    } else if (operation === "set") {
      if (targetIndex < 0 || targetIndex >= current.length) return { ok: false, verdict: "fix", reason: "luna_review_invalid_index", links: current };
      current[targetIndex] = replacement;
    } else {
      return { ok: false, verdict: "fix", reason: "luna_review_invalid_operation", links: current };
    }
  }
  current.forEach(function (link, index) { link.index = index; });
  var validation = validateReviewLinks(current, contract);
  return { ok: validation.ok, verdict: "fix", reason: validation.ok ? "luna_review_fix_valid" : validation.reason, links: current };
}

function reviewEventsFromLinks(links) {
  return links.map(function (link) {
    return {
      type: link.eventType, repeat: 1, amount: null, currency: "EUR", occurredDate: null, promisedDate: null,
      paymentMethod: null, communicationChannel: null, documentReference: null, reason: null, description: null,
      confidence: "high", missing: [], evidenceClauseId: link.clauseId, inheritedFrom: link.inheritedFrom || null,
    };
  });
}

var HISTORY_LUNA_INSTRUCTIONS = [
  "You are Luna, Atena history's only semantic authority. Read the whole source; choose all card IDs, field IDs and values. Local code only validates JSON and closed IDs, then copies values to ID-matched UI fields for mandatory human review. It never checks or repairs semantics, evidence, amounts, dates, order, installments, coverage or debt.",
  "DEBT-FIRST HARD BOUNDARY: Active debt is debtEur.remaining, falling back to original only when absent. Sum every completed reduction in the whole source: N*each installment, stated group totals, credit notes and compensations. STRICT ONE-SIDED GREATER-THAN TEST: warn only when aggregate>active debt; never require equality. Every aggregate<=active debt is valid partial history unless an explicit remaining balance contradicts arithmetic. Exact regression: debt 232 plus 'plačal je 2 obroka po 10 mesec dni nazaj i v razmaku 2h dneh.. potem pa je danes plačal 100' is 2*10+100=120; because 120<232, return k=null and three payment cards, never a warning or inferred remaining_unpaid. Only for aggregate>debt or an explicit contradictory remainder return p=[],k=2 and short Slovenian q naming aggregate and debt and asking to verify possible overpayment or correct debt, amount or event count; x is the exact source span. k=2 blocks with Edit description, no answer, partial cards, capping, altering or dropping. If meaning is genuinely ambiguous use p=[],k=1 instead.",
  "Read catalog.guide rows by catalog.guideColumns and catalog.cards [cardId,type,fieldIds,requiredFieldIds]. useWhen/doNotUseWhen/aliases/examples form a meaning map, not a keyword list. Infer unseen wording, inflection, slang, dialect and mixed Slovenian/German/English. Treat fused number+noun forms and dropped-letter typos as noise, never ambiguity. Prefer specialized cards; custom is last resort. Ask one short Slovenian q only when material meaning is ambiguous.",
  "VAGUE TALK HARD BOUNDARY: invoice/debt talk without a concrete act or outcome is no card; even with clear clauses, return p=[] and q, never omit or force it.",
  "Only map past events: one atomic event per card, source order, all completed repeats expanded; future agreements are not payments. Output p/q/x/k with card {c,e,i:[],v:[],x:[],r:[]}; k=null with a plan, k=1 only for a genuine clarification question, k=2 only for a blocking validation warning. Equal indexes form one field, all four arrays have equal length <=8, IDs are unique, and p order is card order. Each card e is the smallest complete atomic clause span, and all card e spans together cover the full material source; field x stays the shortest exact contiguous source quote. e/x are raw copies: never add currency, diacritics or spelling fixes. Return final per-card EUR and ISO dates; never alter an amount to fit the debt.",
  "A plan/split count is not a paid count. If only the first of N is paid, output one installment_payment with total/N and field 8='1/N obrok'. For N completed installments use chronological k/N cards. Adjacent groups with distinct count or per-installment amount remain separate 1/N series. Merge an explicit first plus N additional only when they are the same series; number all cards 1/(N+1) through (N+1)/(N+1).",
  "Amounts: 'N obrokov skupaj X'=>split X,r=[651]; 'N obrokov po X'/'vsak X'=>X each,r=[652]. Amount x is exact and inside the same card e; count/cadence is never amount. If later N amounts are missing return p=[], one grouped Slovenian q and exact x, at most clarification.maxRounds. Preserve cadence numeral+unit: two weeks=2/week, 14 days=14/day.",
  "Installment dates: preserve explicit/unknown/approximate dates. A relative phrase such as 'mesec dni nazaj' is exact: output final ISO v plus its relation. Mark it approximate only when the source explicitly expresses approximation; a fused token or dropped-letter typo never makes an otherwise clear relation approximate. Explicit cadence is material: every card 2..N MUST include field 2 with previous_event +K relation, even when v is null; omitting that relation is invalid. With explicit first, later cards use previous_event +K. With explicit last, calculate earlier dates backward, but cards 2..N still carry previous_event +K. Only with no endpoint may card 1 omit field 2; then cards 2..N use v=null,r=[601,611,622,633,K,unitId,null]. Cadence alone never invents the first date; referenceDate is only a human-input boundary.",
  "Add remaining_unpaid only for an explicit remaining/no-more-payment outcome, amount=debt.remaining minus completed reductions. Omit unstated values; field 4 is omitted when method is unstated and 406 means explicitly unknown. Never invent an event. If uncertain return p=[], q and exact source x."
].join(" ");

function leanContractRepairInstruction(reason) {
  var instructions = {
    luna_compact_invalid_json: "The previous answer was incomplete or invalid JSON. Return one complete schema-valid answer, keep every evidence quote minimal, and close the full JSON object.",
    luna_compact_evidence_unlinked: "The previous plan copied or normalized evidence that is not an exact contiguous substring of sourceText. Copy every card e and field x character-for-character from sourceText: do not add a currency symbol, diacritic, corrected spelling or omitted word. Keep the same supported meaning and return one complete schema-valid answer; if exact evidence cannot support it, return p=[] and one Slovenian clarification q with exact source x.",
    luna_installment_ordinal_invalid: "The previous plan used invalid installment ordinals. Keep distinct explicit completed-installment groups separate: within each group return exactly N cards numbered 1/N through N/N, even when another installment group follows immediately. Only an explicit first installment plus N additional completed installments of that same series becomes one N+1 series numbered 1/(N+1) through (N+1)/(N+1).",
    luna_installment_relation_missing: "The previous plan omitted an explicit installment cadence. Every card after the first must include occurredDate field 2 with the previous_event +K relation stated by the source, even when the first date is unknown.",
    luna_unanchored_first_installment_relation_forbidden: "The source states an installment cadence but no first or last date. Do not invent an endpoint: omit occurredDate field 2 entirely from the first installment, then put the exact previous_event +K relation on every later installment.",
    luna_installment_cadence_review_required: "The previous plan had multiple completed installments but no structured cadence relation on cards 2..N. Re-read the source. If it states a cadence, every card 2..N must include field {i:2,v:final ISO or null,e:short exact cadence quote,r:[601,611,622,633,K,unitId,null]}; r:[] or an omitted field is invalid even when all final dates are already present. Preserve any stated relative endpoint as its own structured relation too. If the source truly states no cadence, return the same no-relation plan; never invent one.",
    luna_canonical_occurred_relation_numbers: "The previous date relation amount did not match its exact field evidence. Preserve both the source numeral and its named unit: two weeks is amount=2/unit=week; 14 days is amount=14/unit=day. Return a corrected schema-valid plan.",
    luna_relative_date_precision_review_required: "The previous plan marked a structured relative date approximate. Re-read the exact evidence. Keep approximate status only when the source explicitly expresses approximation; spelling noise alone does not change an otherwise clear relative date from exact to approximate.",
    luna_amount_invalid: "The previous plan returned an invalid payment amount. Return p=[] and one grouped Slovenian clarification q with exact source x when the amount is missing; otherwise correct it using exact amount evidence inside the same card evidence.",
    luna_amount_evidence_unlinked: "The previous payment amount was not supported by exact source evidence. Never infer an amount from count or cadence. Return p=[] and one grouped Slovenian clarification q with exact source x when the amount is missing.",
    luna_amount_evidence_outside_event: "The previous plan copied an amount from another event. Amount evidence must be inside the same card evidence. Return p=[] and one grouped Slovenian clarification q with exact source x for the installments whose amount is missing.",
    luna_amount_evidence_unsupported: "The previous amount did not match an exact money or bare-number expression in its same-card evidence. A count or cadence is not amount evidence. Return p=[] and one grouped Slovenian clarification q with exact source x when the amount is missing.",
    luna_total_amount_evidence_unsupported: "The previous per-installment amount did not equal the deterministic split of the exact stated group total. Correct the per-card amounts from the exact total relation or ask one grouped clarification when the total is missing.",
    luna_compact_source_coverage_gap: "The previous plan left material source text outside every card evidence span. Re-read the whole source. Make each card e the smallest complete atomic clause span so all material source is covered. If an uncovered span lacks a concrete historical action, statement, agreement or outcome, return p=[] and one Slovenian clarification q with exact source x; never omit it or force it into custom.",
  };
  return instructions[reason] || null;
}

function requestBody(text, context, userId) {
  context = context || {};
  var requestInput = {
    contractVersion: CONTRACT_VERSION,
    // Prompt cache primerja skupni predponi. Velik, nespremenljiv katalog mora
    // zato ostati pred dolgom, opisom in datumom, ki se menjajo pri vsakem vnosu.
    catalog: MODEL_CATALOG,
    debtEur: {
      original: positiveAmount(context.originalDebt),
      remaining: positiveAmount(context.remainingDebt),
    },
    sourceText: trimText(text, MAX_TEXT_LENGTH),
    referenceDate: validIsoDate(context.referenceDate),
    clarification: context.clarification ? {
      question: trimText(context.clarification.question, 180) || null,
      answer: trimText(context.clarification.answer, MAX_CLARIFICATION_ANSWER_LENGTH) || null,
      sourceReference: trimText(context.clarification.clauseId, 80) || null,
      round: Math.max(1, Math.min(MAX_CLARIFICATION_ROUNDS, Number(context.clarification.round) || 1)),
    } : null,
  };
  return Object.assign(lunaPolicy.requestDefaults("history"), {
    prompt_cache_key: "atena-history:" + CONTRACT_VERSION + ":" + MODEL,
    prompt_cache_options: { mode: "implicit", ttl: "30m" },
    safety_identifier: safetyIdentifier(userId),
    instructions: HISTORY_LUNA_INSTRUCTIONS,
    input: JSON.stringify(requestInput),
    text: {
      format: {
        type: "json_schema",
        name: "debt_history_plan",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
  });
}

function responseText(payload) {
  return lunaPolicy.responseText(payload);
}

function fallbackClarificationQuestion(contract, preferredClause) {
  var clause = preferredClause || (contract && Array.isArray(contract.clauses) ? contract.clauses.find(function (item) {
    return item && item.semanticStatus === "neutral" && item.span && trimText(item.span.text, 120).length >= 3;
  }) : null);
  if (!clause) return null;
  var excerpt = trimText(clause.span.text, 105).replace(/[?]+$/u, "");
  return { question: trimText("Kaj natančno se je zgodilo pri delu »" + excerpt + "«?", 180), clauseId: clause.id };
}

function unresolvedNeutralClarification(contract, links, resolvedClauseId) {
  var linkedClauses = new Set((Array.isArray(links) ? links : []).map(function (link) { return link && link.clauseId; }));
  var clause = contract && Array.isArray(contract.clauses) ? contract.clauses.find(function (item) {
    if (!item || item.semanticStatus !== "neutral" || !item.span || item.id === resolvedClauseId || linkedClauses.has(item.id)) return false;
    var text = normalizeNaturalText(item.span.text);
    return /\b(?:nekaj|stvar\w*|zgodil\w*|dogajal\w*|govoril\w*|pogovarjal\w*|zmenil\w*|uredil\w*|rešil\w*)\b/u.test(text)
      && /\b(?:račun\w*|dolg\w*|plačil\w*|denar\w*|terjatev\w*)\b/u.test(text);
  }) : null;
  return clause ? fallbackClarificationQuestion(contract, clause) : null;
}

function exactLeanEvidenceSpan(sourceText, evidenceText, previousStart, previousEvidenceText) {
  var evidence = trimText(evidenceText, 500);
  if (!evidence) return null;
  var source = String(sourceText || "");
  var start = source.indexOf(evidence, Math.max(0, Number(previousStart) || 0));
  if (start < 0 && evidence === previousEvidenceText) start = source.indexOf(evidence);
  if (start < 0) return null;
  return { start: start, end: start + evidence.length, text: evidence };
}

var LEAN_EURO_EVIDENCE_TOKENS = new Set(["eur", "euro", "euros", "evro", "evra", "evri", "evrov", "eurov", "€"]);

function leanEvidenceTokens(value, baseOffset) {
  var text = String(value || "");
  var tokens = [];
  var pattern = /[\p{L}\p{N}]+|€/gu;
  var match;
  while ((match = pattern.exec(text))) {
    var key = match[0].normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
    if (LEAN_EURO_EVIDENCE_TOKENS.has(key)) continue;
    tokens.push({ key: key, start: (Number(baseOffset) || 0) + match.index, end: (Number(baseOffset) || 0) + match.index + match[0].length });
  }
  return tokens;
}

function expandLeanEvidenceCurrencyEdges(source, start, end, from, to) {
  var prefix = source.slice(from, start).match(/(?:(?:eur|euro|euros|evro|evra|evri|evrov|eurov)\b|€)\s*$/iu);
  var suffix = source.slice(end, to).match(/^\s*(?:(?:eur|euro|euros|evro|evra|evri|evrov|eurov)\b|€)/iu);
  return {
    start: prefix ? from + prefix.index : start,
    end: suffix ? end + suffix[0].length : end,
  };
}

function alignLeanEvidenceQuote(sourceText, evidenceText, withinSpan) {
  var source = String(sourceText || "");
  var evidence = trimText(evidenceText, 500);
  if (!evidence) return null;
  var from = withinSpan && Number.isInteger(withinSpan.start) ? withinSpan.start : 0;
  var to = withinSpan && Number.isInteger(withinSpan.end) ? withinSpan.end : source.length;
  var exactStart = source.indexOf(evidence, from);
  if (exactStart >= 0 && exactStart + evidence.length <= to) {
    return { start: exactStart, end: exactStart + evidence.length, text: evidence, aligned: false };
  }
  var quoteTokens = leanEvidenceTokens(evidence, 0);
  var sourceTokens = leanEvidenceTokens(source.slice(from, to), from);
  if (!quoteTokens.length || quoteTokens.length > sourceTokens.length) return null;
  var matches = [];
  for (var tokenIndex = 0; tokenIndex + quoteTokens.length <= sourceTokens.length; tokenIndex += 1) {
    var equal = quoteTokens.every(function (token, quoteIndex) {
      return token.key === sourceTokens[tokenIndex + quoteIndex].key;
    });
    if (!equal) continue;
    var matchStart = sourceTokens[tokenIndex].start;
    var matchEnd = sourceTokens[tokenIndex + quoteTokens.length - 1].end;
    var expanded = expandLeanEvidenceCurrencyEdges(source, matchStart, matchEnd, from, to);
    matchStart = expanded.start;
    matchEnd = expanded.end;
    if (!matches.some(function (item) { return item.start === matchStart && item.end === matchEnd; })) {
      matches.push({ start: matchStart, end: matchEnd, text: source.slice(matchStart, matchEnd), aligned: true });
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

function parseLeanCompactPlan(output, sourceText) {
  var parsed;
  try { parsed = JSON.parse(trimText(output, 16000)); }
  catch (_error) { return { ok: false, reason: "luna_compact_invalid_json" }; }
  var hasResponseKind = lunaPolicy.hasExactKeys(parsed, ["p", "q", "x", "k"]);
  var legacyResponse = lunaPolicy.hasExactKeys(parsed, ["p", "q", "x"]);
  if ((!hasResponseKind && !legacyResponse) || !Array.isArray(parsed.p) || parsed.p.length > MAX_EVENTS) return { ok: false, reason: "luna_compact_invalid_plan" };
  if (!parsed.p.length) {
    if (typeof parsed.q !== "string" || !parsed.q.trim() || parsed.q.length > 180 || typeof parsed.x !== "string" || !parsed.x.trim() || parsed.x.length > 500) return { ok: false, reason: "luna_compact_empty_without_clarification" };
    if (hasResponseKind && parsed.k !== 1 && parsed.k !== 2) return { ok: false, reason: "luna_compact_empty_without_response_kind" };
    return {
      ok: true, verdict: parsed.k === 2 ? "warning" : "clarification", question: parsed.q.trim(),
      responseKind: parsed.k === 2 ? "warning" : "question",
      evidenceText: parsed.x.trim(),
      clarificationSpan: null,
    };
  }
  if (parsed.q != null || parsed.x != null || (hasResponseKind && parsed.k != null)) return { ok: false, reason: "luna_compact_plan_with_clarification" };
  for (var shapeIndex = 0; shapeIndex < parsed.p.length; shapeIndex += 1) {
    var shape = compactFieldRows(parsed.p[shapeIndex]);
    if (!shape.ok) return shape;
    if (!Number.isInteger(parsed.p[shapeIndex].c) || typeof parsed.p[shapeIndex].e !== "string" || !parsed.p[shapeIndex].e.trim() || parsed.p[shapeIndex].e.length > 500) {
      return { ok: false, reason: "luna_compact_card_shape" };
    }
  }
  var expanded = expandCompactPlanResponse(parsed);
  var items = [];
  for (var index = 0; index < expanded.plan.length; index += 1) {
    var planItem = expanded.plan[index] || {};
    if (!CARD_TYPE_BY_ID[Number(planItem.cardId)]) return { ok: false, reason: "luna_compact_card_domain" };
    var canonical = canonicalItemFromWire(planItem);
    if (!canonical.ok) return { ok: false, reason: canonical.reason || "luna_compact_field_domain" };
    items.push(Object.assign({}, canonical.item, { clauseId: null, inheritedFrom: null }));
  }
  return { ok: true, verdict: "solution", canonical: true, items: items };
}

function leanSemanticResult(result, requestJson, payload, attempted, reason, status) {
  return Object.assign({}, result, {
    engineVersion: ATENA_ENGINE_VERSION,
    contractVersion: CONTRACT_VERSION,
    semanticPlan: {
      requested: true,
      attempted: attempted === true,
      source: "luna_compact_contract",
      reasons: ["luna_only_semantics", "local_id_mapping_only", "human_review_before_save"],
      reason: reason,
      status: status,
      requestBytes: attempted === true ? Buffer.byteLength(requestJson || "", "utf8") : null,
      transport: attempted === true && payload && payload._atenaTransport ? payload._atenaTransport : null,
      usage: attempted === true && payload && payload.usage ? {
        inputTokens: Number(payload.usage.input_tokens) || 0,
        outputTokens: Number(payload.usage.output_tokens) || 0,
        totalTokens: Number(payload.usage.total_tokens) || 0,
      } : null,
    },
  });
}

function leanBlockedResult(context, requestJson, payload, attempted, reason, status, clarification) {
  var initialDebt = positiveAmount(context && context.remainingDebt) || positiveAmount(context && context.originalDebt) || 0;
  return leanSemanticResult({
    summary: status === "VALIDATION_WARNING"
      ? "Opis vsebuje nepravilne ali med seboj neskladne podatke. Uredite izvirni opis; dogodki niso bili pripravljeni."
      : status === "CLARIFICATION_EXHAUSTED"
      ? "Oprostite, Luna opisa po dovoljenih pojasnilih še vedno ne razume dovolj zanesljivo. Dogodke raje dodajte ročno."
      : clarification ? "Luna potrebuje še eno kratko pojasnilo. Dogodki še niso pripravljeni." : "Luna ni vrnila tehnično preslikljivega odgovora. Dogodki niso bili pripravljeni.",
    needsClarification: true,
    clarification: clarification || null,
    clarificationExhausted: status === "CLARIFICATION_EXHAUSTED",
    candidates: [], initialDebtEur: initialDebt, projectedRemainingDebtEur: initialDebt,
    questionPlan: [], ledger: [], fieldOrder: [], requiredFields: [], missing: [],
    diagnostics: ["lean_contract_blocked:" + reason],
    coverage: { complete: false, reason: reason, unconsumed: [], duplicates: [], unsupportedCandidates: [] },
    enginePath: ["luna", "compact_schema", "id_to_field_adapter", "ledger", "human_review"],
  }, requestJson, payload, attempted, reason, status);
}

function isReviewableMissingFieldClarification(question) {
  var text = normalizeNaturalText(question || "");
  var missingAnchor = /\bmanjka\s+datum\s+prv(?:ega|e)\s+(?:plačila|obroka)\b/iu.test(text)
    || /\bprv(?:i|ega)\s+(?:obrok|plačilo)\w*[^.!?]{0,55}\b(?:nima|brez)\b[^.!?]{0,30}\bdatuma?\b/iu.test(text);
  var dependentDates = /\bdatumov?\b[^.!?]{0,120}\b(?:naslednj|poznejš|plačil|obrok|čez)\w*\b/iu.test(text);
  return missingAnchor && dependentDates;
}

function hasRetrospectivePaymentInsertion(text) {
  return /\bpred\s+tem\s+(?:obrok\w*|plačil\w*)\s+(?:pa\s+)?(?:je\s+)?(?:plačal\w*|poravnal\w*|nakazal\w*)/iu.test(normalizeNaturalText(text || ""));
}

function normalizeShortClarificationAnswer(question, answer) {
  var raw = trimText(answer, MAX_CLARIFICATION_ANSWER_LENGTH);
  var normalizedQuestion = normalizeNaturalText(question || "");
  var normalizedAnswer = normalizeNaturalText(raw);
  var missingSchedulingContext = /\b(?:datum|kdaj|rok|kanal|komunikacij)\w*\b/iu.test(normalizedQuestion);
  var explicitYesNoQuestion = /^\s*(?:ali|je|so)\b/iu.test(normalizedQuestion);
  var noKnownDetail = /^(?:ne|ne vem|ni (?:znano|doloceno)|nimam (?:tega )?podatka|datum ni znan|rok ni dolocen)[.!]?$/iu.test(normalizedAnswer);
  if (missingSchedulingContext && !explicitYesNoQuestion && noKnownDetail) {
    return "Datum dogodka, rok plačila in komunikacijski kanal niso znani oziroma določeni.";
  }
  return raw;
}

function isUnknownSchedulingAnswer(answer) {
  var text = normalizeNaturalText(answer || "");
  return /\bdatum\s+dogodka\b/iu.test(text)
    && /\brok\s+plačila\b/iu.test(text)
    && /\bkomunikacijsk\w*\s+kanal\b/iu.test(text)
    && /\b(?:ni|niso)\w*\s+(?:znan\w*|določen\w*)\b/iu.test(text);
}

function isSchedulingClarification(question) {
  return /\b(?:datum|kdaj|rok|kanal|komunikacij)\w*\b/iu.test(normalizeNaturalText(question || ""));
}

function canonicalPaymentPromiseFromContract(contract, sourceText, context, diagnostic) {
  if (!contract || !Array.isArray(contract.facts)) return null;
  var positiveEvents = contract.facts.filter(function (fact) {
    return fact && fact.kind === "category" && fact.assertion === "positive" && fact.eventType;
  });
  if (!positiveEvents.length || !positiveEvents.every(function (fact) { return fact.eventType === "payment_promise"; })) return null;
  var promiseFact = positiveEvents[0];
  var clause = (contract.clauses || []).find(function (item) { return item && item.id === promiseFact.clauseId; });
  if (!clause || !clause.span) return null;
  var amount = inferPromisedAmount(sourceText) || nearestFactAmount(contract, "payment_promised", sourceText);
  var promisesWholeDebt = contract.facts.some(function (fact) {
    return fact && fact.kind === "category" && fact.assertion === "proposed" && fact.eventType === "paid_in_full";
  }) || /\b(?:vse|cel(?:oten|otni)?\s+dolg|ves\s+preostanek|cel(?:oten|otni)?\s+preostanek)\b/iu.test(sourceText);
  if (promisesWholeDebt) amount = positiveAmount(context && context.remainingDebt) || positiveAmount(context && context.originalDebt) || amount;
  var occurredDate = inferOccurredDate(sourceText, context && context.referenceDate);
  var promisedDate = inferPromisedDate(sourceText, context && context.referenceDate);
  var promisedDateFact = contract.facts.find(function (fact) {
    return fact && fact.kind === "date_relation" && fact.assertion === "positive" && fact.eventType === "payment_promise"
      && fact.relation && fact.relation.field === "promisedDate";
  });
  if (promisedDateFact && occurredDate === validIsoDate(context && context.referenceDate) && /\bod\s+danes\b/iu.test(sourceText)) occurredDate = null;
  var communicationChannel = inferCommunicationChannel(sourceText) || "unknown";
  var event = normalizeEvent({
    type: "payment_promise", repeat: 1, amount: amount, currency: "EUR",
    occurredDate: occurredDate, occurredDateUnknown: !occurredDate,
    promisedDate: promisedDate, promisedDateUnknown: !promisedDate,
    paymentMethod: null, communicationChannel: communicationChannel, documentReference: null,
    reason: null, description: trimText(sourceText, 500), confidence: "high", temporalStatus: "planned",
    dateRelation: promisedDateFact ? Object.assign({}, promisedDateFact.relation, { clauseId: promisedDateFact.clauseId }) : null,
    evidence: { clauseId: clause.id, sourceSpan: clause.span, explicit: true, reason: "deterministic_payment_promise_contract" },
  }, 0);
  var finalized = finalizeSystemCandidates([event], {
    originalDebt: context && context.originalDebt,
    remainingDebt: context && context.remainingDebt,
    referenceDate: context && context.referenceDate,
  }, [diagnostic || "payment_promise_contract_resolved"]);
  var coverage = coverageEngine.assessCoverage(contract, { candidates: finalized.candidates }, { requireClauseEvidence: true });
  if (!coverage.complete) return null;
  finalized.candidates = finalized.candidates.map(function (candidate, index) {
    return Object.assign({}, candidate, {
      cardNumber: index + 1,
      cardTypeId: CARD_ID_BY_TYPE[candidate.type] || CARD_ID_BY_TYPE.custom,
      fieldIds: candidate.fieldOrder.map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }),
      requiresHumanReview: true,
    });
  });
  finalized.questionPlan = finalized.candidates.map(function (candidate, candidateIndex) {
    return {
      candidateIndex: candidateIndex, fields: candidate.fieldOrder.slice(), missing: candidate.missing.slice(),
      cardNumber: candidateIndex + 1, cardTypeId: candidate.cardTypeId,
      fieldIds: candidate.fieldIds.slice(), missingFieldIds: candidate.missing.map(function (name) { return FIELD_ID_BY_NAME[modelFieldName(name)]; }),
    };
  });
  return Object.assign({
    summary: "Atena je pripravila dogovor za vaš pregled.", needsClarification: false,
    coverage: coverage, enginePath: ["fact_contract", "deterministic_promise_resolver", "ledger", "human_review"],
  }, finalized);
}

async function analyze(text, context, options) {
  options = options || {};
  context = context || {};
  var sourceInput = trimText(text, MAX_TEXT_LENGTH + 1);
  var clarificationContext = context.clarification && typeof context.clarification === "object" ? context.clarification : null;
  var clarificationAnswer = clarificationContext ? trimText(clarificationContext.answer, MAX_CLARIFICATION_ANSWER_LENGTH + 1) : "";
  var clarificationClauseId = clarificationContext ? trimText(clarificationContext.clauseId, 80) : "";
  var clarificationRound = clarificationContext ? Number(clarificationContext.round) || 0 : 0;
  if (clarificationContext && !lunaPolicy.validClarification(clarificationContext)) {
    var clarificationError = new Error("Vpišite kratek odgovor na vprašanje.");
    clarificationError.code = "INVALID_CLARIFICATION";
    clarificationError.status = 400;
    throw clarificationError;
  }
  var input = sourceInput;
  if (!sourceInput || sourceInput.length > MAX_TEXT_LENGTH) {
    var inputError = new Error(sourceInput ? "Opis je predolg." : "Vpišite, kaj se je zgodilo.");
    inputError.code = "INVALID_TEXT";
    inputError.status = 400;
    throw inputError;
  }
  var sourceContract = null;
  var factContract = null;
  var clarificationClause = null;
  var localResult = null;
  var payload = null;
  var lunaRequestJson = "";
  var planDecision = { shouldRequest: true, reasons: ["luna_first_raw_source", "local_id_mapping_only", "human_review_before_save"], coverage: null, factContract: null };
  function ensureContracts() {
    if (factContract) return factContract;
    sourceContract = factEngine.buildFactContract(sourceInput);
    if (clarificationAnswer) {
      clarificationClause = sourceContract.clauses.find(function (clause) { return clause.id === clarificationClauseId; }) || null;
      if (!clarificationClause) {
        var invalidClarification = new Error("Vpišite kratek odgovor na vprašanje.");
        invalidClarification.code = "INVALID_CLARIFICATION";
        invalidClarification.status = 400;
        throw invalidClarification;
      }
      var insertion = " Dopolnitev uporabnika: " + clarificationAnswer;
      input = sourceInput.slice(0, clarificationClause.span.end) + insertion + sourceInput.slice(clarificationClause.span.end);
      if (input.length > MAX_TEXT_LENGTH) {
        var longClarification = new Error("Opis z dopolnitvijo je predolg.");
        longClarification.code = "INVALID_TEXT";
        longClarification.status = 400;
        throw longClarification;
      }
    }
    factContract = factEngine.buildFactContract(input);
    var deterministicDecision = semanticPlanDecision(input, factContract, null);
    planDecision = Object.assign({}, deterministicDecision, {
      reasons: ["luna_first_raw_source"].concat(deterministicDecision.reasons.filter(function (reason) { return reason !== "always_luna_review"; })),
    });
    return factContract;
  }
  function ensureLocalResult() {
    ensureContracts();
    if (!localResult) localResult = deterministicResult(input, context);
    return localResult;
  }
  function tagged(result, source, attempted, reason) {
    var status = reason === "luna_review_ok" || reason === "luna_canonical_plan_applied" ? "OK"
      : reason === "luna_review_solution_applied" || reason === "luna_review_fix_applied" || reason === "clarification_answer_applied" || reason === "luna_clarification_not_needed" || reason === "luna_missing_anchor_deferred_to_review" || reason === "luna_retrospective_order_applied" ? "CORRECTED"
        : result && result.clarificationExhausted ? "CLARIFICATION_EXHAUSTED"
        : result && result.clarification ? "CLARIFICATION_REQUIRED"
        : attempted === true ? "FAILED" : "NOT_ATTEMPTED";
    return Object.assign({}, result, {
      engineVersion: ATENA_ENGINE_VERSION,
      contractVersion: CONTRACT_VERSION,
      semanticPlan: {
        requested: planDecision.shouldRequest,
        attempted: attempted === true,
        source: source,
        reasons: planDecision.reasons.slice(),
        reason: reason || null,
        status: status,
        requestBytes: attempted === true ? Buffer.byteLength(lunaRequestJson || "", "utf8") : null,
        usage: attempted === true && payload && payload.usage ? {
          inputTokens: Number(payload.usage.input_tokens) || 0,
          outputTokens: Number(payload.usage.output_tokens) || 0,
          totalTokens: Number(payload.usage.total_tokens) || 0,
        } : null,
      },
    });
  }
  function clarification(coverage, reason, attempted, clarificationPrompt) {
    ensureContracts();
    var initialDebt = positiveAmount(context.remainingDebt) || positiveAmount(context.originalDebt) || 0;
    var nextRound = clarificationRound + 1;
    var safeQuestion = nextRound <= MAX_CLARIFICATION_ROUNDS && clarificationPrompt ? trimText(clarificationPrompt.question, 180) : "";
    var safeClauseId = nextRound <= MAX_CLARIFICATION_ROUNDS && clarificationPrompt ? trimText(clarificationPrompt.clauseId, 80) : "";
    var exhausted = Boolean(clarificationContext && nextRound > MAX_CLARIFICATION_ROUNDS && clarificationPrompt);
    return tagged({
      summary: exhausted
        ? "Oprostite, Luna opisa po dovoljenih pojasnilih še vedno ne razume dovolj zanesljivo. Dogodke raje dodajte ročno."
        : safeQuestion ? "Luna potrebuje še eno kratko pojasnilo. Dogodki še niso pripravljeni." : "Lunino preverjanje ni vrnilo dokazno veljavne rešitve. Dopolnite izvirni opis; dogodki niso bili pripravljeni.",
      needsClarification: true,
      clarification: safeQuestion && safeClauseId ? { question: safeQuestion, clauseId: safeClauseId, round: nextRound, maxRounds: MAX_CLARIFICATION_ROUNDS } : null,
      clarificationExhausted: exhausted,
      candidates: [],
      initialDebtEur: initialDebt,
      projectedRemainingDebtEur: initialDebt,
      questionPlan: [], ledger: [], fieldOrder: [], requiredFields: [], missing: [],
      diagnostics: ["semantic_plan_blocked:" + reason],
      coverage: coverage || coverageEngine.assessCoverage(factContract, { candidates: [] }),
    }, "clarification", attempted, reason);
  }
  function localFallback(reason, attempted) {
    var fallback = ensureLocalResult();
    return clarification(fallback && fallback.coverage, reason, attempted);
  }
  function clarificationAddsEvidence() {
    ensureContracts();
    if (!clarificationAnswer) return false;
    var sourceSignals = sourceContract.clauses.reduce(function (count, clause) { return count + (Array.isArray(clause.signals) ? clause.signals.length : 0); }, 0);
    var clarifiedSignals = factContract.clauses.reduce(function (count, clause) { return count + (Array.isArray(clause.signals) ? clause.signals.length : 0); }, 0);
    var explicitlyNoEvent = /\b(?:nič\s+(?:se\s+)?ni\s+(?:zgodilo|dogajalo|bilo|dogovorjeno)|ni\s+bilo\s+(?:ničesar|nobenega)\s+(?:novega|dogovora|opomina|plačila))\b/iu.test(clarificationAnswer);
    var userUncertainty = /\b(?:ne\s+vem|nisem\s+(?:prepričan|siguren)|ne\s+spomnim\s+se|ne\s+znam\s+povedati|ni\s+mi\s+jasno)\b/iu.test(clarificationAnswer);
    var explicitEventAction = /\b(?:plačal\w*|nakazal\w*|opomin\w*|pozval\w*|zahteval\w*|obljubil\w*|dogovoril\w*|podaljšal\w*|zavrnil\w*|klical\w*|pisal\w*|dobropis\w*|pobot\w*|storn\w*)\b/iu.test(clarificationAnswer);
    if (userUncertainty && !explicitEventAction) return false;
    return clarifiedSignals > sourceSignals || explicitlyNoEvent;
  }
  function clarifiedDeterministicFallback() {
    if (!clarificationAddsEvidence()) return null;
    var fallback = ensureLocalResult();
    if (!fallback || !fallback.coverage || fallback.coverage.complete !== true) return null;
    fallback.diagnostics = (fallback.diagnostics || []).concat(["clarification_answer_applied"]);
    return tagged(fallback, "validated_clarification_answer", true, "clarification_answer_applied");
  }
  function completeDeterministicFallback() {
    ensureContracts();
    var hasNeutralEvidence = (factContract.clauses || []).some(function (clause) {
      return clause && clause.semanticStatus === "neutral" && trimText(clause.span && clause.span.text, 120).length >= 3;
    });
    if (hasNeutralEvidence) return null;
    var fallback = ensureLocalResult();
    if (!fallback || !fallback.coverage || fallback.coverage.complete !== true) return null;
    fallback.diagnostics = (fallback.diagnostics || []).concat(["unnecessary_luna_clarification_suppressed"]);
    return tagged(fallback, "validated_semantic_plan", true, "luna_clarification_not_needed");
  }
  var apiKey = Object.prototype.hasOwnProperty.call(options, "apiKey") ? options.apiKey : process.env.OPENAI_API_KEY;
  if (!apiKey) return options._legacyTestMode === true
    ? localFallback("luna_review_not_configured", false)
    : leanBlockedResult(context, lunaRequestJson, payload, false, "luna_not_configured", "NOT_ATTEMPTED", null);
  lunaRequestJson = JSON.stringify(requestBody(input, context, options.userId));
  var historyTimeoutMs = options.timeoutMs == null
    ? MODEL_TIMEOUT_MS
    : Math.min(MODEL_TIMEOUT_MAX_MS, Math.max(100, Number(options.timeoutMs) || MODEL_TIMEOUT_MS));
  try {
    var transport = await lunaPolicy.requestOpenAi({
      apiKey: apiKey, body: lunaRequestJson, fetchImpl: options.fetchImpl,
      timeoutMs: historyTimeoutMs, maxAttempts: options._legacyTestMode === true ? 1 : options.maxAttempts,
      sleepImpl: options.sleepImpl, randomImpl: options.randomImpl,
    });
    payload = transport.payload;
    payload._atenaTransport = { attempts: transport.attempts, elapsedMs: transport.elapsedMs };
  } catch (error) {
    var reasonByCode = { LUNA_TIMEOUT: "luna_timeout", LUNA_RATE_LIMITED: "luna_rate_limited", LUNA_PROVIDER_ERROR: "luna_provider_error", LUNA_PROVIDER_REJECTED: "luna_provider_rejected", LUNA_UNAVAILABLE: "luna_unavailable" };
    var failureReason = reasonByCode[error && error.code] || "luna_unavailable";
    payload = { _atenaTransport: { attempts: Number(error && error.attempts) || 1, elapsedMs: Number(error && error.elapsedMs) || 0, retryable: error && error.retryable === true } };
    if (options._legacyTestMode === true) return localFallback("luna_review_" + failureReason.slice(5), true);
    return leanBlockedResult(context, lunaRequestJson, payload, true, failureReason, "FAILED", null);
  }
  var textOutput = responseText(payload);
  var compactPlan = parseLeanCompactPlan(textOutput, sourceInput);
  var leanMaterialized = compactPlan.ok && compactPlan.verdict === "solution"
    ? materializeLunaFieldPlan(compactPlan, context, sourceInput, null)
    : null;
  if (!compactPlan.ok && options._legacyTestMode !== true) {
    return leanBlockedResult(context, lunaRequestJson, payload, true, compactPlan.reason, "FAILED", null);
  }
  if (compactPlan.ok && (compactPlan.verdict === "clarification" || compactPlan.verdict === "warning")) {
    if (compactPlan.verdict === "warning") {
      return leanBlockedResult(context, lunaRequestJson, payload, true, "luna_validation_warning", "VALIDATION_WARNING", {
        question: compactPlan.question, clauseId: "clause-1", round: 0, maxRounds: MAX_CLARIFICATION_ROUNDS, kind: "warning",
      });
    }
    var currentRound = clarificationContext ? clarificationRound : 0;
    var nextRound = currentRound + 1;
    if (nextRound > MAX_CLARIFICATION_ROUNDS) return leanBlockedResult(context, lunaRequestJson, payload, true, "clarification_exhausted", "CLARIFICATION_EXHAUSTED", null);
    return leanBlockedResult(context, lunaRequestJson, payload, true, "luna_clarification_requested", "CLARIFICATION_REQUIRED", {
      question: compactPlan.question, clauseId: "clause-1", round: nextRound, maxRounds: MAX_CLARIFICATION_ROUNDS, kind: "question",
    });
  }
  if (compactPlan.ok) {
    if (!leanMaterialized) leanMaterialized = materializeLunaFieldPlan(compactPlan, context, sourceInput, null);
    if (!leanMaterialized.ok) return leanBlockedResult(
      context,
      lunaRequestJson,
      payload,
      true,
      leanMaterialized.reason,
      "FAILED",
      null
    );
    leanMaterialized.result.diagnostics = (leanMaterialized.result.diagnostics || []).concat(["lean_luna_contract_applied"]);
    leanMaterialized.result.enginePath = ["luna", "compact_schema", "id_to_field_adapter", "human_review"];
    return leanSemanticResult(leanMaterialized.result, lunaRequestJson, payload, true, "luna_compact_plan_applied", "OK");
  }

  /* Legacy semantic planner path intentionally retained below only until its direct test exports are removed. */
  ensureContracts();
  var proposedPlan = trimText(textOutput, 16000) === "OK" ? proposalLinks(ensureLocalResult(), factContract) : [];
  var review = parsePlanReview(textOutput, proposedPlan, factContract, input);
  if (review.ok && review.verdict === "clarification") {
    var clarifiedAfterQuestion = clarifiedDeterministicFallback();
    if (clarifiedAfterQuestion) return clarifiedAfterQuestion;
    var completeWithoutQuestion = completeDeterministicFallback();
    if (completeWithoutQuestion) return completeWithoutQuestion;
    return clarification(coverageEngine.assessCoverage(factContract, { candidates: [] }), review.reason, true, { question: review.question, clauseId: review.clauseId });
  }
  if (review.ok && review.verdict === "ok") {
    var legacyLocalResult = ensureLocalResult();
    if (legacyLocalResult && legacyLocalResult.coverage && legacyLocalResult.coverage.complete === true) {
      return tagged(Object.assign({}, legacyLocalResult, {
        diagnostics: (legacyLocalResult.diagnostics || []).concat(["luna_review_ok"]),
      }), "validated_semantic_plan", true, "luna_review_ok");
    }
    return clarification(legacyLocalResult && legacyLocalResult.coverage, "luna_review_ok_local_incomplete", true);
  }
  if (review.ok && (review.verdict === "solution" || review.verdict === "fix")) {
    if (clarificationAnswer && !clarificationAddsEvidence()) {
      return clarification(coverageEngine.assessCoverage(factContract, { candidates: [] }), "clarification_answer_still_ambiguous", true, fallbackClarificationQuestion(sourceContract, clarificationClause));
    }
    if (review.verdict === "solution" && review.canonical) {
      var canonicalMaterialized = materializeAuthoritativeLunaPlan(review, context, input);
      if (!canonicalMaterialized.ok) return clarification(coverageEngine.assessCoverage(factContract, { candidates: [] }), canonicalMaterialized.reason, true, fallbackClarificationQuestion(factContract));
      canonicalMaterialized.result.diagnostics = (canonicalMaterialized.result.diagnostics || []).concat(["luna_canonical_plan_applied"]);
      return tagged(canonicalMaterialized.result, "validated_canonical_plan", true, "luna_canonical_plan_applied");
    }
    var unresolvedNeutral = unresolvedNeutralClarification(factContract, review.links, clarificationAddsEvidence() ? clarificationClauseId : null);
    if (unresolvedNeutral) return clarification(coverageEngine.assessCoverage(factContract, { candidates: [] }), "neutral_clause_unresolved", true, unresolvedNeutral);
    var semanticContract = factEngine.withSemanticPlan(factContract, review.links);
    var correctedResult = normalizeResult({ summary: "Luna je popravila povezavo plana.", events: reviewEventsFromLinks(review.links) }, context.remainingDebt, {
      text: input,
      referenceDate: context.referenceDate,
      originalDebt: context.originalDebt,
      remainingDebt: context.remainingDebt,
      factContract: semanticContract,
    });
    var correctedCoverage = coverageEngine.assessCoverage(semanticContract, correctedResult, {
      installmentBreakdown: inferInstallmentBreakdown(input),
      requireClauseEvidence: true,
    });
    correctedResult.coverage = correctedCoverage;
    if (correctedCoverage.complete) {
      var appliedReason = review.verdict === "solution" ? "luna_review_solution_applied" : "luna_review_fix_applied";
      correctedResult.diagnostics = (correctedResult.diagnostics || []).concat([appliedReason]);
      return tagged(correctedResult, "validated_semantic_plan", true, appliedReason);
    }
    var clarifiedAfterIncompletePlan = clarifiedDeterministicFallback();
    if (clarifiedAfterIncompletePlan) return clarifiedAfterIncompletePlan;
    return clarification(correctedCoverage, "luna_review_fix_incomplete", true, fallbackClarificationQuestion(factContract));
  }
  if (review.verdict === "fix" || review.verdict === "solution") {
    var clarifiedAfterInvalidPlan = clarifiedDeterministicFallback();
    if (clarifiedAfterInvalidPlan) return clarifiedAfterInvalidPlan;
    return clarification(localResult && localResult.coverage, review.reason, true, fallbackClarificationQuestion(factContract));
  }
  var parsed;
  try { parsed = JSON.parse(textOutput); }
  catch (_error) { return localFallback(review.reason, true); }
  if (parsed && (Array.isArray(parsed.links) || Array.isArray(parsed.events))) {
    return localFallback("luna_review_legacy_response_rejected", true);
  }
  var clarifiedAfterInvalidResponse = clarifiedDeterministicFallback();
  if (clarifiedAfterInvalidResponse) return clarifiedAfterInvalidResponse;
  return clarification(ensureLocalResult().coverage, review.reason, true, fallbackClarificationQuestion(factContract));
}

module.exports = {
  analyze: analyze,
  normalizeResult: normalizeResult,
  requestBody: requestBody,
  ATENA_ENGINE_VERSION: ATENA_ENGINE_VERSION,
  CONTRACT_VERSION: CONTRACT_VERSION,
  MODEL: MODEL,
  MODEL_TIMEOUT_MS: MODEL_TIMEOUT_MS,
  MODEL_TIMEOUT_MAX_MS: MODEL_TIMEOUT_MAX_MS,
  MAX_TEXT_LENGTH: MAX_TEXT_LENGTH,
  MAX_CLARIFICATION_ANSWER_LENGTH: MAX_CLARIFICATION_ANSWER_LENGTH,
  MAX_CLARIFICATION_ROUNDS: MAX_CLARIFICATION_ROUNDS,
  MAX_LUNA_CALLS_PER_DESCRIPTION: MAX_LUNA_CALLS_PER_DESCRIPTION,
  ALLOWED_TYPES: ALLOWED_TYPES,
  RESPONSE_SCHEMA: RESPONSE_SCHEMA,
  _test: {
    validIsoDate: validIsoDate, positiveAmount: positiveAmount, responseText: responseText,
    safetyIdentifier: safetyIdentifier, slovenianNumber: slovenianNumber, normalizeNaturalText: normalizeNaturalText, anonymizeModelText: anonymizeModelText, modelFacts: modelFacts,
    inferAmountFromText: inferAmountFromText, inferOccurredDate: inferOccurredDate,
    inferPromisedDate: inferPromisedDate, eventTypeFromText: eventTypeFromText,
    completedPaymentType: completedPaymentType, deterministicResult: deterministicResult,
    deterministicClauseResult: deterministicClauseResult,
    isDebtorRefusal: isDebtorRefusal, isDebtorExcuse: isDebtorExcuse, hasExplicitDebtorResponse: hasExplicitDebtorResponse, inferDebtorResponse: inferDebtorResponse, isRemainingUnpaid: isRemainingUnpaid, isExplicitCancellation: isExplicitCancellation, hasCompletedPayment: hasCompletedPayment,
    isPaidInFull: isPaidInFull, isPaymentFailed: isPaymentFailed, isInvoiceDispute: isInvoiceDispute,
    isDeadlineExtension: isDeadlineExtension, isInstallmentAgreement: isInstallmentAgreement, isInsolvency: isInsolvency,
    inferPaymentMethod: inferPaymentMethod, inferCommunicationChannel: inferCommunicationChannel,
    inferRepeat: inferRepeat, inferInstallmentBreakdown: inferInstallmentBreakdown, requiresModelReasoning: requiresModelReasoning, shouldRequestSemanticPlan: shouldRequestSemanticPlan, semanticPlanDecision: semanticPlanDecision, reconcileBalanceEvents: reconcileBalanceEvents,
    inferInstallmentGroups: installmentEngine.extractInstallmentGroups, parseSlovenianNumber: numberEngine.parseSlovenianNumber,
    extractNumberExpressions: numberEngine.extractNumberExpressions,
    detectFatherCategories: detectFatherCategories, inferCreditNoteAmount: inferCreditNoteAmount, inferCompensationAmount: inferCompensationAmount,
    isContactEnded: isContactEnded, splitMoneyEvenly: splitMoneyEvenly,
    isPaymentPromiseMentioned: isPaymentPromiseMentioned, isUnfulfilledPromise: isUnfulfilledPromise, inferPromisedAmount: inferPromisedAmount,
    eventDisplayPriority: eventDisplayPriority, sortEventsForDisplay: sortEventsForDisplay, bindRemainingPromiseAmounts: bindRemainingPromiseAmounts,
    buildFactContract: factEngine.buildFactContract, resolverFacts: resolverFacts,
    normalizeDateRelation: normalizeDateRelation, bindDateRelationAnchors: bindDateRelationAnchors,
    applyDeterministicClauseFields: applyDeterministicClauseFields, resolvePreviousEventDateRelations: resolvePreviousEventDateRelations,
    assessCoverage: coverageEngine.assessCoverage, bindSemanticPlanEvidence: bindSemanticPlanEvidence,
    bareFactsInput: bareFactsInput, proposalLinks: proposalLinks, expectedBareLinks: expectedBareLinks, validateBareFactsPlan: validateBareFactsPlan,
    validateReviewLinks: validateReviewLinks, parsePlanReview: parsePlanReview,
    parseLeanCompactPlan: parseLeanCompactPlan, materializeLunaFieldPlan: materializeLunaFieldPlan,
    normalizeShortClarificationAnswer: normalizeShortClarificationAnswer,
  },
};
