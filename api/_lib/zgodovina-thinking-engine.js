"use strict";

var MAX_EVENTS = 20;
var MONEY_EPSILON = 0.009;

var FATHER_CATEGORIES = Object.freeze({
  partial: Object.freeze(["partial_payment"]),
  installment: Object.freeze(["installment_payment", "installment_agreement"]),
  unpaid_installment: Object.freeze(["unpaid_installment", "remaining_unpaid"]),
  payment_promised: Object.freeze(["payment_promise", "deadline_extension"]),
  full: Object.freeze(["paid_in_full"]),
  payment_failed: Object.freeze(["payment_failed"]),
  invoice_dispute: Object.freeze(["invoice_dispute", "debtor_statement"]),
  credit_note: Object.freeze(["credit_note"]),
  compensation: Object.freeze(["compensation"]),
  cancelled_invoice: Object.freeze(["cancelled_invoice"]),
  insolvency: Object.freeze(["insolvency"]),
  collection_action: Object.freeze(["reminder_sent"]),
  collection_outcome: Object.freeze(["remaining_unpaid"]),
});

var EVENT_TO_FATHERS = Object.keys(FATHER_CATEGORIES).reduce(function (map, father) {
  FATHER_CATEGORIES[father].forEach(function (type) {
    if (!map[type]) map[type] = [];
    map[type].push(father);
  });
  return map;
}, {});
Object.keys(EVENT_TO_FATHERS).forEach(function (type) { Object.freeze(EVENT_TO_FATHERS[type]); });
Object.freeze(EVENT_TO_FATHERS);
var EVENT_TO_FATHER = Object.freeze(Object.keys(EVENT_TO_FATHERS).reduce(function (map, type) {
  map[type] = EVENT_TO_FATHERS[type][0];
  return map;
}, {}));

function fatherCategoriesForEvent(type) {
  return EVENT_TO_FATHERS[type] || [];
}

function fatherCategoryForEvent(event, factContract) {
  var fathers = fatherCategoriesForEvent(event && event.type);
  var clauseId = event && event.evidence && event.evidence.clauseId;
  var clause = clauseId && factContract && Array.isArray(factContract.clauses) ? factContract.clauses.find(function (item) {
    return item && item.id === clauseId;
  }) : null;
  var specific = clause && Array.isArray(clause.fatherCategories) ? clause.fatherCategories.find(function (father) {
    return fathers.includes(father);
  }) : null;
  return specific || fathers[0] || "custom";
}

var EVENT_RULES = {
  partial_payment: rule(["amount", "occurredDate", "paymentMethod"], ["amount", "occurredDate", "paymentMethod"], "subtract"),
  paid_in_full: rule(["amount", "occurredDate", "paymentMethod"], ["amount", "occurredDate", "paymentMethod"], "subtract"),
  installment_payment: rule(["amount", "occurredDate", "paymentMethod"], ["amount", "occurredDate", "paymentMethod"], "subtract"),
  unpaid_installment: rule(["occurredDate"], ["occurredDate"], "none"),
  remaining_unpaid: rule(["amount"], ["amount"], "none"),
  installment_agreement: rule(["occurredDate", "description"], ["occurredDate", "description"], "none"),
  payment_promise: rule(["amount", "occurredDate", "promisedDate", "communicationChannel"], ["occurredDate", "promisedDate", "communicationChannel"], "none"),
  deadline_extension: rule(["occurredDate", "promisedDate", "communicationChannel", "description"], ["occurredDate", "promisedDate", "communicationChannel", "description"], "none"),
  payment_failed: rule(["occurredDate", "paymentMethod", "description"], ["occurredDate", "paymentMethod", "description"], "none"),
  invoice_dispute: rule(["occurredDate", "communicationChannel", "description"], ["occurredDate", "communicationChannel", "description"], "none"),
  insolvency: rule(["occurredDate", "description"], ["occurredDate", "description"], "none"),
  credit_note: rule(["amount", "occurredDate"], ["amount", "occurredDate"], "subtract"),
  compensation: rule(["amount", "occurredDate"], ["amount", "occurredDate"], "subtract"),
  cancelled_invoice: rule(["occurredDate", "reason"], ["occurredDate", "reason"], "none"),
  debtor_statement: rule(["occurredDate", "communicationChannel", "description"], ["occurredDate", "communicationChannel", "description"], "none"),
  reminder_sent: rule(["occurredDate", "communicationChannel"], ["occurredDate", "communicationChannel"], "none"),
  custom: rule(["occurredDate", "description"], ["occurredDate", "description"], "none"),
};

var EVENT_TEMPORAL_ROLES = Object.freeze({
  partial_payment: Object.freeze(["occurredDate"]), paid_in_full: Object.freeze(["occurredDate"]), installment_payment: Object.freeze(["occurredDate"]),
  unpaid_installment: Object.freeze(["dueDate"]), remaining_unpaid: Object.freeze([]), installment_agreement: Object.freeze(["occurredDate", "dueDate"]),
  payment_promise: Object.freeze(["occurredDate", "promisedDate"]), deadline_extension: Object.freeze(["occurredDate", "promisedDate"]),
  payment_failed: Object.freeze(["occurredDate"]), invoice_dispute: Object.freeze(["occurredDate"]), insolvency: Object.freeze(["occurredDate"]),
  credit_note: Object.freeze(["occurredDate"]), compensation: Object.freeze(["occurredDate"]), cancelled_invoice: Object.freeze(["occurredDate"]),
  debtor_statement: Object.freeze(["occurredDate"]), reminder_sent: Object.freeze(["occurredDate"]), custom: Object.freeze(["occurredDate"]),
});

function rule(fieldOrder, requiredFields, balanceEffect) {
  return Object.freeze({ fieldOrder: Object.freeze(fieldOrder.slice()), requiredFields: Object.freeze(requiredFields.slice()), balanceEffect: balanceEffect });
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function positiveMoney(value) {
  var number = Number(value);
  return Number.isFinite(number) && number > 0 ? roundMoney(number) : null;
}

function validIsoDate(value) {
  var text = String(value || "");
  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  var date = new Date(text + "T12:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function fieldPresent(event, field) {
  if (field === "amount") return positiveMoney(event.amount) != null;
  if (field === "occurredDate") return event.occurredDateUnknown === true || event.occurredDateApproximate === true && Boolean(String(event.occurredDateApproximation || "").trim()) || validIsoDate(event.occurredDate);
  if (field === "promisedDate") return event.promisedDateUnknown === true || event.promisedDateApproximate === true && Boolean(String(event.promisedDateApproximation || "").trim()) || validIsoDate(event.promisedDate);
  if (field === "paymentMethod") return Boolean(String(event.paymentMethod || "").trim());
  if (field === "communicationChannel") return Boolean(String(event.communicationChannel || "").trim());
  return Boolean(String(event[field] || "").trim());
}

function cloneEvents(events) {
  return (Array.isArray(events) ? events : []).slice(0, MAX_EVENTS).map(function (event) { return Object.assign({}, event || {}); });
}

function reconcileProposals(events, facts) {
  var proposals = cloneEvents(events);
  var paymentTypes = ["partial_payment", "installment_payment"];
  var initialPaymentProposals = proposals.filter(function (event) { return paymentTypes.includes(event && event.type); });
  var diagnostics = [];
  var explicitInstallmentGroups = [];
  var groupEvents = [];
  var structuredGroupClauseIds = new Set();
  var hasStructuredInstallmentGroups = false;
  facts = facts || {};
  var factContract = facts.factContract && typeof facts.factContract === "object" ? facts.factContract : null;
  if (factContract && Array.isArray(factContract.facts)) {
    var positiveFathers = new Set(factContract.facts.filter(function (fact) { return fact.kind === "category" && fact.assertion === "positive"; }).map(function (fact) { return fact.category; }));
    if (facts.paidInFull) positiveFathers.add("full");
    if (facts.remainingUnpaid) positiveFathers.add("unpaid_installment");
    if (facts.paymentFailed) positiveFathers.add("payment_failed");
    if (facts.invoiceDispute || facts.debtorRefused) positiveFathers.add("invoice_dispute");
    if (facts.creditNoteMentioned) positiveFathers.add("credit_note");
    if (facts.compensationMentioned) positiveFathers.add("compensation");
    if (facts.explicitCancellation) positiveFathers.add("cancelled_invoice");
    if (facts.installmentAgreement) positiveFathers.add("installment");
    if (facts.insolvency) positiveFathers.add("insolvency");
    var negatedOnly = new Set(factContract.facts.filter(function (fact) { return fact.kind === "category" && fact.assertion === "negated" && !positiveFathers.has(fact.category); }).map(function (fact) { return fact.category; }));
    proposals = proposals.filter(function (event) {
      var fathers = fatherCategoriesForEvent(event && event.type);
      if (!fathers.length || fathers.some(function (father) { return positiveFathers.has(father); }) || !fathers.some(function (father) { return negatedOnly.has(father); })) return true;
      diagnostics.push("negated_father_rejected:" + fathers.filter(function (father) { return negatedOnly.has(father); }).join("+"));
      return false;
    });
    if (positiveFathers.size) {
      proposals = proposals.filter(function (event) {
        var fathers = fatherCategoriesForEvent(event && event.type);
        if (!fathers.length || fathers.some(function (father) { return positiveFathers.has(father); })) return true;
        if (event && event.type === "cancelled_invoice" && (facts.debtorRefused || facts.invoiceDispute) && !facts.explicitCancellation) return true;
        if (event && event.type === "debtor_statement" && (facts.paymentFailed || facts.explicitCancellation)) return true;
        diagnostics.push("unsupported_father_rejected:" + fathers.join("+"));
        return false;
      });
    }
    var structuredInstallmentGroups = (Array.isArray(facts.installmentGroups)
      ? facts.installmentGroups
      : Array.isArray(factContract.installmentGroups) ? factContract.installmentGroups : []);
    hasStructuredInstallmentGroups = structuredInstallmentGroups.length > 0;
    explicitInstallmentGroups = structuredInstallmentGroups.filter(function (group) {
        return group && group.completed === true && Number.isInteger(group.count) && group.count >= 1 && positiveMoney(group.amount) != null;
      });
    if (explicitInstallmentGroups.length) {
      var existingInstallments = proposals.filter(function (event) { return event && event.type === "installment_payment"; });
      var groupInsertionIndex = proposals.findIndex(function (event) { return event && event.type === "installment_payment"; });
      if (groupInsertionIndex < 0) groupInsertionIndex = 0;
      explicitInstallmentGroups.forEach(function (group) {
        var groupClause = Array.isArray(factContract.clauses) ? factContract.clauses.find(function (clause) {
          return clause && clause.span && group.span && group.span.start >= clause.span.start && group.span.start < clause.span.end;
        }) : null;
        if (groupClause && groupClause.id) structuredGroupClauseIds.add(groupClause.id);
        for (var repeatIndex = 0; repeatIndex < group.count && groupEvents.length < MAX_EVENTS; repeatIndex += 1) {
          var baseInstallment = existingInstallments[groupEvents.length] || {};
          groupEvents.push(Object.assign({}, baseInstallment, {
            type: "installment_payment", repeat: 1, amount: positiveMoney(group.amount), currency: "EUR", confidence: "high",
            occurredDate: null, promisedDate: null, dateRelation: null, paymentMethod: null, communicationChannel: null,
            description: (repeatIndex + 1) + "/" + group.count + " obrok",
            evidence: {
              clauseId: groupClause && groupClause.id || null, sourceSpan: group.span || null,
              explicit: true, reason: "explicit_installment_group", groupId: group.id,
            },
          }));
        }
      });
      proposals = proposals.filter(function (event) { return !event || event.type !== "installment_payment"; });
      proposals.splice.apply(proposals, [Math.min(groupInsertionIndex, proposals.length), 0].concat(groupEvents));
      diagnostics.push("explicit_installment_groups_rebuilt");
    }
    var clausePayments = [];
    var clauseIds = Array.from(new Set(factContract.facts.filter(function (fact) {
      return fact.kind === "category" && fact.assertion === "positive" && (fact.eventType === "partial_payment" || fact.eventType === "installment_payment");
    }).map(function (fact) { return fact.clauseId; })));
    clauseIds.forEach(function (clauseId) {
      var categoryFact = factContract.facts.find(function (fact) {
        return fact.clauseId === clauseId && fact.kind === "category" && fact.assertion === "positive" && (fact.eventType === "partial_payment" || fact.eventType === "installment_payment");
      });
      var amountFact = factContract.facts.find(function (fact) { return fact.clauseId === clauseId && fact.kind === "money"; });
      var amountRelationFact = factContract.facts.find(function (fact) { return fact.clauseId === clauseId && fact.kind === "amount_relation" && fact.relation; });
      var amount = positiveMoney(amountFact && amountFact.value);
      if (amount == null && amountRelationFact) {
        var relation = amountRelationFact.relation;
        var anchorPayment = relation.anchor === "previous_event"
          ? clausePayments[clausePayments.length - 1]
          : relation.anchor === "event_index" && Number.isInteger(relation.anchorIndex)
            ? clausePayments[relation.anchorIndex]
            : null;
        var anchorAmount = positiveMoney(anchorPayment && anchorPayment.amount);
        var delta = positiveMoney(amountRelationFact.value);
        if (anchorAmount != null && delta != null && [1, -1].includes(Number(relation.direction))) {
          amount = positiveMoney(anchorAmount + Number(relation.direction) * delta);
        }
      }
      if (categoryFact && amount != null) clausePayments.push({
        type: categoryFact.eventType,
        amount: amount,
        clauseId: clauseId,
        sourceSpan: amountRelationFact && amountRelationFact.sourceSpan || categoryFact.sourceSpan || null,
        amountRelation: amountRelationFact && amountRelationFact.relation || null,
      });
    });
    var standaloneClausePayments = clausePayments.filter(function (payment) { return !structuredGroupClauseIds.has(payment.clauseId); });
    if (explicitInstallmentGroups.length && standaloneClausePayments.length) {
      var mixedInsertionIndex = proposals.findIndex(function (event) { return paymentTypes.includes(event && event.type); });
      if (mixedInsertionIndex < 0) mixedInsertionIndex = 0;
      var mixedPayments = groupEvents.concat(standaloneClausePayments.map(function (fact) {
        var base = initialPaymentProposals.find(function (event) {
          return event && event.type === fact.type && positiveMoney(event.amount) === fact.amount;
        }) || {};
        return Object.assign({}, base, {
          type: fact.type, repeat: 1, amount: fact.amount, currency: "EUR", confidence: "high",
          evidence: { clauseId: fact.clauseId, sourceSpan: fact.sourceSpan, explicit: true, reason: fact.amountRelation ? "explicit_amount_relation" : "explicit_payment_sequence", amountRelation: fact.amountRelation || null },
        });
      })).map(function (event, index) { return { event: event, index: index }; });
      mixedPayments.sort(function (left, right) {
        var leftStart = left.event && left.event.evidence && left.event.evidence.sourceSpan && left.event.evidence.sourceSpan.start;
        var rightStart = right.event && right.event.evidence && right.event.evidence.sourceSpan && right.event.evidence.sourceSpan.start;
        return (Number.isFinite(leftStart) ? leftStart : Infinity) - (Number.isFinite(rightStart) ? rightStart : Infinity) || left.index - right.index;
      });
      proposals = proposals.filter(function (event) { return !paymentTypes.includes(event && event.type); });
      proposals.splice.apply(proposals, [Math.min(mixedInsertionIndex, proposals.length), 0].concat(mixedPayments.map(function (item) { return item.event; })));
      diagnostics.push("mixed_installment_payment_sequence_rebuilt");
    }
    if (!explicitInstallmentGroups.length && clausePayments.length === 1) {
      var singleFact = clausePayments[0];
      var singleIndex = proposals.findIndex(function (event) {
        return paymentTypes.includes(event && event.type) && event.evidence && event.evidence.clauseId === singleFact.clauseId;
      });
      if (singleIndex >= 0) {
        proposals[singleIndex] = Object.assign({}, proposals[singleIndex], {
          type: singleFact.type, repeat: 1, amount: singleFact.amount, currency: "EUR", confidence: "high",
          evidence: { clauseId: singleFact.clauseId, sourceSpan: singleFact.sourceSpan, explicit: true, reason: singleFact.amountRelation ? "explicit_amount_relation" : "explicit_payment_sequence", amountRelation: singleFact.amountRelation || null },
        });
        diagnostics.push("single_payment_fact_materialized");
      }
    } else if (!explicitInstallmentGroups.length && clausePayments.length >= 2) {
      var existingPayments = proposals.filter(function (event) { return paymentTypes.includes(event && event.type); });
      var insertionIndex = proposals.findIndex(function (event) { return paymentTypes.includes(event && event.type); });
      if (insertionIndex < 0) insertionIndex = 0;
      var used = new Set();
      var rebuilt = clausePayments.map(function (fact) {
        var matchedIndex = existingPayments.findIndex(function (event, index) {
          return !used.has(index) && event.type === fact.type && positiveMoney(event.amount) === fact.amount;
        });
        var base = matchedIndex >= 0 ? existingPayments[matchedIndex] : {};
        if (matchedIndex >= 0) used.add(matchedIndex);
        return Object.assign({}, base, {
          type: fact.type, repeat: 1, amount: fact.amount, currency: "EUR", confidence: "high",
          evidence: { clauseId: fact.clauseId, sourceSpan: fact.sourceSpan, explicit: true, reason: fact.amountRelation ? "explicit_amount_relation" : "explicit_payment_sequence", amountRelation: fact.amountRelation || null },
        });
      });
      proposals = proposals.filter(function (event) { return !paymentTypes.includes(event && event.type); });
      proposals.splice.apply(proposals, [Math.min(insertionIndex, proposals.length), 0].concat(rebuilt));
      diagnostics.push("explicit_payment_sequence_rebuilt");
    }
  }
  var breakdown = facts.installmentBreakdown;
  var breakdownAmounts = breakdown && Array.isArray(breakdown.amounts) && breakdown.amounts.length === breakdown.repeat
    ? breakdown.amounts.map(positiveMoney)
    : null;
  if (breakdownAmounts && breakdownAmounts.some(function (amount) { return amount == null; })) breakdownAmounts = null;
  if (!hasStructuredInstallmentGroups && breakdown && Number.isInteger(breakdown.repeat) && breakdown.repeat >= 2 && (positiveMoney(breakdown.amount) || breakdownAmounts)) {
    proposals = proposals.filter(function (event) {
      if (event.type === "credit_note") return facts.creditNoteMentioned === true;
      if (event.type === "compensation") return facts.compensationMentioned === true;
      return true;
    });
    var paymentIndexes = proposals.map(function (event, index) {
      return ["partial_payment", "paid_in_full", "installment_payment"].includes(event.type) ? index : -1;
    }).filter(function (index) { return index >= 0; });
    if (breakdownAmounts && paymentIndexes.length <= 1) {
      var seriesBase = paymentIndexes.length ? proposals[paymentIndexes[0]] : {};
      var series = breakdownAmounts.map(function (amount) {
        return Object.assign({}, seriesBase, { type: "installment_payment", repeat: 1, amount: amount, currency: "EUR", confidence: "high" });
      });
      if (paymentIndexes.length) proposals.splice.apply(proposals, [paymentIndexes[0], 1].concat(series));
      else proposals = series.concat(proposals);
      diagnostics.push("aggregate_installment_total_distributed");
    } else if (paymentIndexes.length <= 1) {
      var base = paymentIndexes.length ? proposals[paymentIndexes[0]] : {};
      var replacement = Object.assign({}, base, {
        type: "installment_payment",
        repeat: breakdown.repeat,
        amount: breakdown.amount,
        currency: "EUR",
        confidence: "high",
      });
      if (paymentIndexes.length) proposals[paymentIndexes[0]] = replacement;
      else proposals.unshift(replacement);
      diagnostics.push("installment_structure_normalized");
    } else if (paymentIndexes.length === breakdown.repeat) {
      paymentIndexes.forEach(function (index) {
        proposals[index].type = "installment_payment";
        proposals[index].repeat = 1;
        proposals[index].amount = breakdownAmounts ? breakdownAmounts[paymentIndexes.indexOf(index)] : breakdown.amount;
        proposals[index].currency = "EUR";
      });
      diagnostics.push("installment_series_normalized");
    }
  }

  if (facts.creditNoteMentioned && !proposals.some(function (event) { return event.type === "credit_note"; })) {
    proposals.push({ type: "credit_note", repeat: 1, amount: positiveMoney(facts.creditNoteAmountEur), currency: "EUR", confidence: "high" });
    diagnostics.push("explicit_credit_note_added");
  }
  if (facts.compensationMentioned && !proposals.some(function (event) { return event.type === "compensation"; })) {
    proposals.push({ type: "compensation", repeat: 1, amount: positiveMoney(facts.compensationAmountEur), currency: "EUR", confidence: "high" });
    diagnostics.push("explicit_compensation_added");
  }

  proposals.forEach(function (event) {
    if (event.type === "credit_note" && facts.creditNoteMentioned && positiveMoney(facts.creditNoteAmountEur) != null) {
      if (positiveMoney(event.amount) !== positiveMoney(facts.creditNoteAmountEur)) diagnostics.push("explicit_credit_note_amount_wins");
      event.amount = positiveMoney(facts.creditNoteAmountEur);
      event.currency = "EUR";
    }
    if (event.type === "compensation" && facts.compensationMentioned && positiveMoney(facts.compensationAmountEur) != null) {
      if (positiveMoney(event.amount) !== positiveMoney(facts.compensationAmountEur)) diagnostics.push("explicit_compensation_amount_wins");
      event.amount = positiveMoney(facts.compensationAmountEur);
      event.currency = "EUR";
    }
    if (facts.paymentFailed && event.type === "debtor_statement") {
      event.type = "payment_failed";
      event.amount = null;
      diagnostics.push("bank_rejection_not_debtor_refusal");
    }
    if (facts.debtorRefused && !facts.explicitCancellation && event.type === "cancelled_invoice") {
      event.type = "debtor_statement";
      event.reason = null;
      diagnostics.push("debtor_refusal_not_cancellation");
    }
    if (facts.explicitCancellation && event.type === "debtor_statement") {
      event.type = "cancelled_invoice";
      diagnostics.push("explicit_cancellation_wins");
    }
    if (facts.invoiceDispute && event.type === "debtor_statement") {
      event.type = "invoice_dispute";
      diagnostics.push("invoice_dispute_wins");
    }
    if (facts.paidInFull && positiveMoney(facts.inferredRemainingAmountEur) && event.type === "paid_in_full") {
      event.type = "partial_payment";
      diagnostics.push("positive_remainder_blocks_paid_in_full");
    }
  });
  if (factContract && Array.isArray(factContract.facts)) {
    var relationTargets = new Set();
    factContract.facts.filter(function (fact) {
      return fact && fact.kind === "date_relation" && fact.relation && ["previous_event", "reference_date"].includes(fact.relation.anchor);
    }).forEach(function (fact) {
      var sharedGroupId = fact.groupId || fact.relation.groupId || null;
      if (sharedGroupId) {
        var sharedTargets = proposals.map(function (event, index) {
          return event && event.type === "installment_payment" && event.evidence
            && event.evidence.groupId === sharedGroupId && event.evidence.clauseId === fact.clauseId ? index : -1;
        }).filter(function (index) { return index >= 0 && !relationTargets.has(index); });
        sharedTargets.forEach(function (targetIndex) {
          var sharedRelation = Object.assign({}, fact.relation, {
            sourceSpan: fact.sourceSpan || fact.relation.sourceSpan || null,
            clauseId: fact.clauseId,
            groupId: sharedGroupId,
          });
          if (proposals[targetIndex].occurredDate) diagnostics.push("deterministic_date_relation_rejected_proposed_date:" + targetIndex);
          proposals[targetIndex].occurredDate = null;
          proposals[targetIndex].dateRelation = sharedRelation;
          relationTargets.add(targetIndex);
          diagnostics.push("deterministic_group_date_relation_applied:" + targetIndex);
        });
        return;
      }
      var targetIndex = proposals.findIndex(function (event, index) {
        return !relationTargets.has(index) && event && event.evidence && event.evidence.clauseId === fact.clauseId && (!fact.eventType || event.type === fact.eventType);
      });
      if (targetIndex < 0 && fact.eventType) {
        targetIndex = proposals.findIndex(function (event, index) {
          return !relationTargets.has(index) && event && (!fact.eventType || event.type === fact.eventType);
        });
      }
      if (targetIndex < 0) return;
      var relation = Object.assign({}, fact.relation, {
        sourceSpan: fact.sourceSpan || fact.relation.sourceSpan || null,
        clauseId: fact.clauseId,
      });
      if (proposals[targetIndex].occurredDate) diagnostics.push("deterministic_date_relation_rejected_proposed_date:" + targetIndex);
      proposals[targetIndex].occurredDate = null;
      proposals[targetIndex].dateRelation = relation;
      relationTargets.add(targetIndex);
      diagnostics.push("deterministic_date_relation_applied:" + targetIndex);
    });
    var structuredCadences = Array.isArray(facts.installmentCadences)
      ? facts.installmentCadences
      : Array.isArray(factContract.installmentCadences) ? factContract.installmentCadences : [];
    structuredCadences.forEach(function (cadence) {
      if (!cadence || cadence.conflict || !cadence.relation || !cadence.groupId) return;
      var targetIndexes = proposals.map(function (event, index) {
        return event && event.type === "installment_payment" && event.evidence && event.evidence.groupId === cadence.groupId ? index : -1;
      }).filter(function (index) { return index >= 0; });
      if (targetIndexes.length !== cadence.installmentCount) return;
      targetIndexes.slice(1).forEach(function (targetIndex) {
        var relation = Object.assign({}, cadence.relation, {
          sourceSpan: cadence.sourceSpan || cadence.relation.sourceSpan || null,
          clauseId: proposals[targetIndex].evidence && proposals[targetIndex].evidence.clauseId || null,
          groupId: cadence.groupId,
        });
        if (proposals[targetIndex].occurredDate || proposals[targetIndex].dateRelation) diagnostics.push("deterministic_installment_cadence_replaced_proposed_date:" + targetIndex);
        proposals[targetIndex].occurredDate = null;
        proposals[targetIndex].dateRelation = relation;
        diagnostics.push("deterministic_installment_cadence_applied:" + targetIndex);
      });
    });
  }
  return { events: proposals.slice(0, MAX_EVENTS), diagnostics: diagnostics };
}

function expandEvents(events) {
  var expanded = [];
  cloneEvents(events).forEach(function (event) {
    var repeat = Math.max(1, Math.min(MAX_EVENTS, Math.floor(Number(event.repeat) || 1)));
    for (var i = 0; i < repeat && expanded.length < MAX_EVENTS; i += 1) {
      var item = Object.assign({}, event, { repeat: 1 });
      if (item.type === "installment_payment" && repeat > 1 && !String(item.description || "").trim()) {
        item.description = (i + 1) + "/" + repeat + " obrok";
      }
      expanded.push(item);
    }
  });
  return expanded;
}

function finalizeCandidates(candidates, context, inheritedDiagnostics) {
  var initialDebt = positiveMoney(context && context.remainingDebt) || positiveMoney(context && context.originalDebt) || 0;
  var balance = initialDebt;
  var diagnostics = Array.isArray(inheritedDiagnostics) ? inheritedDiagnostics.slice() : [];
  var ledger = [];
  var referenceDate = validIsoDate(context && context.referenceDate) ? context.referenceDate : null;
  var finalized = cloneEvents(candidates).map(function (candidate, index) {
    var event = Object.assign({}, candidate);
    var spec = EVENT_RULES[event.type] || EVENT_RULES.custom;
    if (!EVENT_RULES[event.type]) event.type = "custom";
    var before = balance;
    var amount = positiveMoney(event.amount);
    var sourcedAmountEvidence = amount != null && event.evidence && event.evidence.explicit === true && event.evidence.sourceSpan && Number.isFinite(event.evidence.sourceSpan.start) && Number.isFinite(event.evidence.sourceSpan.end);
    if (sourcedAmountEvidence) event.evidence = Object.assign({}, event.evidence, { explicitAmountEur: amount });
    var futureOccurrence = Boolean(referenceDate && validIsoDate(event.occurredDate) && event.occurredDate > referenceDate);
    var plannedReduction = futureOccurrence || event.temporalStatus === "planned";
    if (plannedReduction && spec.balanceEffect === "subtract") {
      diagnostics.push("future_reduction_not_booked:" + index);
      event.temporalStatus = "planned";
    }
    if (event.type === "paid_in_full" && amount != null && Math.abs(amount - balance) > MONEY_EPSILON) {
      event.amount = null;
      amount = null;
      diagnostics.push("paid_in_full_must_match_balance:" + index);
    }
    if (spec.balanceEffect === "subtract" && amount != null && !plannedReduction) {
      if (amount > balance + MONEY_EPSILON) {
        if (sourcedAmountEvidence) {
          balance = 0;
          diagnostics.push("explicit_amount_exceeds_balance_clamped:" + index);
        } else {
          event.amount = null;
          diagnostics.push("amount_exceeds_balance:" + index);
        }
      } else {
        balance = roundMoney(Math.max(0, balance - amount));
      }
    }
    event.fieldOrder = spec.fieldOrder.slice();
    event.requiredFields = spec.requiredFields.slice();
    event.fatherCategory = fatherCategoryForEvent(event, context && context.factContract);
    event.dateRoles = (EVENT_TEMPORAL_ROLES[event.type] || EVENT_TEMPORAL_ROLES.custom).slice();
    if (event.type === "unpaid_installment" && !validIsoDate(event.dueDate) && validIsoDate(event.occurredDate)) event.dueDate = event.occurredDate;
    if (!event.temporalStatus) {
      if (["payment_promise", "deadline_extension", "installment_agreement"].includes(event.type)) event.temporalStatus = "planned";
      else if (validIsoDate(event.dueDate) && referenceDate && event.dueDate < referenceDate) event.temporalStatus = "overdue";
      else event.temporalStatus = "occurred";
    }
    event.missing = spec.requiredFields.filter(function (field) { return !fieldPresent(event, field); });
    event.ledger = { beforeEur: before, effectEur: roundMoney(balance - before), afterEur: balance };
    ledger.push({ candidateIndex: index, type: event.type, beforeEur: before, effectEur: roundMoney(balance - before), afterEur: balance });
    return event;
  });
  var questionPlan = finalized.map(function (event, index) {
    return event.missing.length ? { candidateIndex: index, fields: event.fieldOrder.slice(), missing: event.missing.slice() } : null;
  }).filter(Boolean);
  return {
    candidates: finalized,
    initialDebtEur: initialDebt,
    projectedRemainingDebtEur: balance,
    questionPlan: questionPlan,
    ledger: ledger,
    fieldOrder: finalized.map(function (event, index) { return { candidateIndex: index, fields: event.fieldOrder.slice() }; }),
    requiredFields: finalized.map(function (event, index) { return { candidateIndex: index, fields: event.requiredFields.slice() }; }),
    missing: finalized.map(function (event, index) { return { candidateIndex: index, fields: event.missing.slice() }; }),
    diagnostics: diagnostics,
  };
}

module.exports = {
  FATHER_CATEGORIES: FATHER_CATEGORIES,
  EVENT_TO_FATHER: EVENT_TO_FATHER,
  EVENT_TO_FATHERS: EVENT_TO_FATHERS,
  EVENT_RULES: EVENT_RULES,
  EVENT_TEMPORAL_ROLES: EVENT_TEMPORAL_ROLES,
  reconcileProposals: reconcileProposals,
  expandEvents: expandEvents,
  finalizeCandidates: finalizeCandidates,
  fieldPresent: fieldPresent,
  _test: { positiveMoney: positiveMoney, validIsoDate: validIsoDate, roundMoney: roundMoney },
};
