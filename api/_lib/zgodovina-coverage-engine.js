"use strict";

var PAYMENT_TYPES = new Set(["partial_payment", "paid_in_full", "installment_payment"]);
var VALUE_REQUIRED_TYPES = new Set(["partial_payment", "paid_in_full", "installment_payment", "remaining_unpaid", "credit_note", "compensation", "payment_promise"]);

function finiteSpan(span) {
  return span && Number.isInteger(span.start) && Number.isInteger(span.end)
    ? { start: span.start, end: span.end, text: typeof span.text === "string" ? span.text : undefined }
    : null;
}

function sameAmount(left, right) {
  return Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Math.abs(Number(left) - Number(right)) < 0.009;
}

function relationKey(relation) {
  if (!relation) return "";
  return [relation.anchor, relation.field, Number(relation.direction), Number(relation.amount), relation.unit, Number.isInteger(Number(relation.dayOfMonth)) ? Number(relation.dayOfMonth) : ""].join(":");
}

function equivalentEventType(expected, actual) {
  if (expected === actual) return true;
  return [expected, actual].every(function (type) { return ["remaining_unpaid", "unpaid_installment"].includes(type); });
}

function expectedEventCount(fact, contract) {
  var group = (contract.installmentGroups || []).find(function (item) {
    return item && item.completed === true && item.count > 0 && fact && fact.clauseId && item.span && (contract.clauses || []).some(function (clause) {
      return clause.id === fact.clauseId && clause.span && item.span.start >= clause.span.start && item.span.start < clause.span.end;
    });
  });
  if (group && fact.eventType === "installment_payment") return group.count;
  var repeat = (contract.facts || []).find(function (item) {
    return item && item.kind === "repeat" && item.clauseId === fact.clauseId && item.eventType === fact.eventType;
  });
  return repeat && Number.isInteger(repeat.value) && repeat.value > 0 ? repeat.value : 1;
}

function candidateClauseId(candidate) {
  return candidate && candidate.evidence && candidate.evidence.clauseId || null;
}

function assessCoverage(contract, result, options) {
  contract = contract && typeof contract === "object" ? contract : { clauses: [], facts: [], installmentGroups: [] };
  result = result && typeof result === "object" ? result : {};
  options = options || {};
  var candidates = Array.isArray(result.candidates) ? result.candidates : [];
  var facts = Array.isArray(contract.facts) ? contract.facts : [];
  var obligations = [];
  var consumed = [];
  var unconsumed = [];
  var duplicates = [];
  var unsupportedCandidates = [];
  var eventMatched = new Set();
  var moneyMatched = new Set();
  var installmentBreakdown = options.installmentBreakdown && typeof options.installmentBreakdown === "object" ? options.installmentBreakdown : null;

  var eventFacts = facts.filter(function (fact) {
    return fact && fact.kind === "category" && fact.assertion === "positive" && fact.eventType;
  }).filter(function (fact, index, list) {
    return list.findIndex(function (other) { return other.clauseId === fact.clauseId && other.eventType === fact.eventType; }) === index;
  });

  eventFacts.forEach(function (fact) {
    var expected = expectedEventCount(fact, contract);
    if (fact.eventType === "installment_payment" && !(contract.installmentGroups || []).length && installmentBreakdown && Number.isInteger(installmentBreakdown.repeat) && installmentBreakdown.repeat > expected) {
      expected = installmentBreakdown.repeat;
    }
    var exact = candidates.map(function (candidate, index) { return { candidate: candidate, index: index }; }).filter(function (entry) {
      return entry.candidate && equivalentEventType(fact.eventType, entry.candidate.type) && candidateClauseId(entry.candidate) === fact.clauseId;
    });
    var fallback = (options.requireClauseEvidence ? [] : candidates.map(function (candidate, index) { return { candidate: candidate, index: index }; })).filter(function (entry) {
      return entry.candidate && equivalentEventType(fact.eventType, entry.candidate.type) && !eventMatched.has(entry.index) && !candidateClauseId(entry.candidate);
    });
    var matches = exact.concat(fallback).filter(function (entry, index, list) {
      return list.findIndex(function (other) { return other.index === entry.index; }) === index;
    });
    var obligation = {
      id: "event:" + fact.clauseId + ":" + fact.eventType,
      kind: "event_clause",
      clauseId: fact.clauseId,
      eventType: fact.eventType,
      expectedCount: expected,
      sourceSpan: finiteSpan(fact.sourceSpan),
    };
    obligations.push(obligation);
    matches.slice(0, expected).forEach(function (entry) { eventMatched.add(entry.index); });
    if (matches.length >= expected) consumed.push(Object.assign({}, obligation, { candidateIndexes: matches.slice(0, expected).map(function (entry) { return entry.index; }) }));
    else unconsumed.push(Object.assign({}, obligation, { actualCount: matches.length }));
    if (matches.length > expected) duplicates.push(Object.assign({}, obligation, { candidateIndexes: matches.slice(expected).map(function (entry) { return entry.index; }) }));
  });

  facts.filter(function (fact) {
    if (!fact || fact.kind !== "money" || !Number.isFinite(Number(fact.value))) return false;
    var moneyStart = fact.sourceSpan && fact.sourceSpan.start;
    var nearestCategory = facts.filter(function (item) {
      return item && item.kind === "category" && item.clauseId === fact.clauseId && item.sourceSpan && Number.isFinite(moneyStart);
    }).sort(function (left, right) {
      function distance(item) {
        if (moneyStart < item.sourceSpan.start) return item.sourceSpan.start - moneyStart;
        if (moneyStart > item.sourceSpan.end) return moneyStart - item.sourceSpan.end;
        return 0;
      }
      return distance(left) - distance(right) || right.priority - left.priority;
    })[0];
    return !nearestCategory || nearestCategory.assertion === "positive";
  }).forEach(function (fact) {
    var group = (contract.installmentGroups || []).find(function (item) { return item && fact.groupId && item.id === fact.groupId; });
    var expected = group && group.completed === true ? group.count : 1;
    var installmentIndexes = candidates.map(function (candidate, index) {
      return candidate && candidate.type === "installment_payment"
        && (!fact.clauseId || !candidateClauseId(candidate) || candidateClauseId(candidate) === fact.clauseId) ? index : -1;
    }).filter(function (index) { return index >= 0; });
    var breakdownUsesAmount = installmentBreakdown && (sameAmount(installmentBreakdown.amount, fact.value)
      || (Array.isArray(installmentBreakdown.amounts) && installmentBreakdown.amounts.length === installmentBreakdown.repeat
        && installmentBreakdown.amounts.every(function (amount) { return sameAmount(amount, fact.value); })));
    var installmentClause = eventFacts.some(function (eventFact) {
      return eventFact.clauseId === fact.clauseId && eventFact.eventType === "installment_payment";
    });
    var inferredPerInstallmentEvidence = installmentClause && breakdownUsesAmount
      && installmentBreakdown && !sameAmount(installmentBreakdown.total, fact.value);
    var perInstallmentEvidence = fact.relation === "per_installment" || Boolean(fact.groupId) || inferredPerInstallmentEvidence;
    var groupInstallmentIndexes = group ? candidates.map(function (candidate, index) {
      return candidate && candidate.type === "installment_payment" && candidate.evidence
        && candidate.evidence.groupId === group.id && sameAmount(candidate.amount, fact.value) ? index : -1;
    }).filter(function (index) { return index >= 0; }) : [];
    var groupPerInstallmentAmount = Boolean(group) && groupInstallmentIndexes.length === expected;
    var perInstallmentAmount = !group && perInstallmentEvidence && breakdownUsesAmount
      && Number.isInteger(installmentBreakdown.repeat) && installmentIndexes.length === installmentBreakdown.repeat
      && installmentIndexes.every(function (index) { return sameAmount(candidates[index].amount, fact.value); });
    var matches = candidates.map(function (candidate, index) { return { candidate: candidate, index: index }; }).filter(function (entry) {
      if (!entry.candidate || moneyMatched.has(entry.index) || !sameAmount(entry.candidate.amount, fact.value)) return false;
      var clauseId = candidateClauseId(entry.candidate);
      return !clauseId || !fact.clauseId || clauseId === fact.clauseId;
    });
    var aggregateInstallments = false;
    if (!group && installmentBreakdown && sameAmount(installmentBreakdown.total, fact.value)) {
      var installmentTotal = candidates.filter(function (candidate) { return candidate && candidate.type === "installment_payment"; }).reduce(function (sum, candidate) {
        return sum + (Number(candidate.amount) || 0);
      }, 0);
      aggregateInstallments = sameAmount(installmentTotal, fact.value);
    }
    var contextualEventFact = eventFacts.find(function (eventFact) {
      return eventFact.clauseId === fact.clauseId && (!fact.category || eventFact.category === fact.category) && !VALUE_REQUIRED_TYPES.has(eventFact.eventType);
    });
    var contextualIndexes = contextualEventFact ? candidates.map(function (candidate, index) {
      return candidate && candidate.type === contextualEventFact.eventType && (!candidateClauseId(candidate) || candidateClauseId(candidate) === fact.clauseId) ? index : -1;
    }).filter(function (index) { return index >= 0; }) : [];
    var obligation = {
      id: "money:" + (fact.id || [fact.clauseId, fact.sourceSpan && fact.sourceSpan.start].join(":")),
      kind: "money",
      clauseId: fact.clauseId,
      value: Number(fact.value),
      expectedCount: expected,
      sourceSpan: finiteSpan(fact.sourceSpan),
    };
    obligations.push(obligation);
    if (contextualIndexes.length === 1 || groupPerInstallmentAmount || perInstallmentAmount || aggregateInstallments || matches.length >= expected) {
      var consumedIndexes = contextualIndexes.length === 1 ? contextualIndexes : groupPerInstallmentAmount ? groupInstallmentIndexes : perInstallmentAmount ? installmentIndexes : aggregateInstallments
        ? candidates.map(function (candidate, index) { return candidate && candidate.type === "installment_payment" && !moneyMatched.has(index) ? index : -1; }).filter(function (index) { return index >= 0; })
        : matches.slice(0, expected).map(function (entry) { return entry.index; });
      if (!groupPerInstallmentAmount && !perInstallmentAmount) consumedIndexes.forEach(function (index) { moneyMatched.add(index); });
      consumed.push(Object.assign({}, obligation, {
        candidateIndexes: consumedIndexes,
        mode: contextualIndexes.length === 1 ? "contextual_money_evidence" : groupPerInstallmentAmount || perInstallmentAmount ? "per_installment_amount" : aggregateInstallments ? "aggregate_installment_total" : "exact_amount",
      }));
    } else unconsumed.push(Object.assign({}, obligation, { actualCount: matches.length }));
    if (!contextualIndexes.length && !groupPerInstallmentAmount && !perInstallmentAmount && !aggregateInstallments && matches.length > expected) duplicates.push(Object.assign({}, obligation, { candidateIndexes: matches.slice(expected).map(function (entry) { return entry.index; }) }));
  });

  facts.filter(function (fact) { return fact && fact.kind === "amount_relation" && fact.relation; }).forEach(function (fact) {
    var relation = fact.relation;
    var targets = candidates.map(function (candidate, index) { return { candidate: candidate, index: index }; }).filter(function (entry) {
      return entry.candidate && PAYMENT_TYPES.has(entry.candidate.type) && candidateClauseId(entry.candidate) === fact.clauseId;
    });
    var target = targets.length === 1 ? targets[0] : null;
    var paymentEntries = candidates.map(function (candidate, index) { return { candidate: candidate, index: index }; }).filter(function (entry) {
      return entry.candidate && PAYMENT_TYPES.has(entry.candidate.type);
    });
    var anchor = null;
    if (target && relation.anchor === "previous_event") {
      anchor = paymentEntries.filter(function (entry) { return entry.index < target.index; }).slice(-1)[0] || null;
    } else if (target && relation.anchor === "event_index" && Number.isInteger(relation.anchorIndex)) {
      anchor = paymentEntries[relation.anchorIndex] || null;
    }
    var delta = Number(fact.value);
    var expectedAmount = anchor && Number.isFinite(Number(anchor.candidate.amount)) && Number.isFinite(delta)
      ? Number(anchor.candidate.amount) + Number(relation.direction) * delta
      : null;
    var valid = target && anchor && expectedAmount > 0 && sameAmount(target.candidate.amount, expectedAmount);
    var obligation = {
      id: "amount-relation:" + (fact.id || [fact.clauseId, fact.sourceSpan && fact.sourceSpan.start].join(":")),
      kind: "amount_relation",
      clauseId: fact.clauseId,
      relation: relation,
      expectedCount: 1,
      sourceSpan: finiteSpan(fact.sourceSpan),
    };
    obligations.push(obligation);
    if (valid) consumed.push(Object.assign({}, obligation, { candidateIndexes: [target.index], anchorCandidateIndex: anchor.index, resolvedAmount: expectedAmount }));
    else unconsumed.push(Object.assign({}, obligation, { actualCount: 0, candidateIndexes: target ? [target.index] : [], resolvedAmount: expectedAmount }));
  });

  facts.filter(function (fact) {
    return fact && fact.kind === "date_relation" && fact.relation && (!fact.assertion || fact.assertion === "positive");
  }).forEach(function (fact) {
    var expectedKey = relationKey(fact.relation);
    var groupId = fact.groupId || fact.relation.groupId || null;
    var group = (contract.installmentGroups || []).find(function (item) { return item && groupId && item.id === groupId; });
    var expected = group && group.completed === true ? group.count : 1;
    var matches = candidates.map(function (candidate, index) { return { candidate: candidate, index: index }; }).filter(function (entry) {
      if (!entry.candidate || relationKey(entry.candidate.dateRelation) !== expectedKey) return false;
      if (groupId && (!entry.candidate.evidence || entry.candidate.evidence.groupId !== groupId)) return false;
      var relationClause = entry.candidate.dateRelation && entry.candidate.dateRelation.clauseId;
      var clauseId = relationClause || candidateClauseId(entry.candidate);
      return !clauseId || !fact.clauseId || clauseId === fact.clauseId;
    });
    var obligation = {
      id: "relation:" + (fact.id || [fact.clauseId, fact.sourceSpan && fact.sourceSpan.start].join(":")),
      kind: "date_relation",
      clauseId: fact.clauseId,
      relation: fact.relation,
      expectedCount: expected,
      sourceSpan: finiteSpan(fact.sourceSpan),
    };
    obligations.push(obligation);
    if (matches.length === expected) consumed.push(Object.assign({}, obligation, { candidateIndexes: matches.map(function (entry) { return entry.index; }) }));
    else if (!matches.length) unconsumed.push(Object.assign({}, obligation, { actualCount: 0 }));
    else if (matches.length < expected) unconsumed.push(Object.assign({}, obligation, { actualCount: matches.length, candidateIndexes: matches.map(function (entry) { return entry.index; }) }));
    else {
      consumed.push(Object.assign({}, obligation, { candidateIndexes: matches.slice(0, expected).map(function (entry) { return entry.index; }) }));
      duplicates.push(Object.assign({}, obligation, { candidateIndexes: matches.slice(expected).map(function (entry) { return entry.index; }) }));
    }
  });

  facts.filter(function (fact) { return fact && fact.kind === "installment_cadence"; }).forEach(function (fact) {
    var expected = Number.isInteger(fact.expectedCount) ? fact.expectedCount : 0;
    var obligation = {
      id: "cadence:" + (fact.id || [fact.clauseId, fact.sourceSpan && fact.sourceSpan.start].join(":")),
      kind: "installment_cadence",
      clauseId: fact.clauseId,
      groupId: fact.groupId || null,
      relation: fact.relation || null,
      expectedCount: expected,
      sourceSpan: finiteSpan(fact.sourceSpan),
      conflict: fact.conflict || null,
    };
    obligations.push(obligation);
    if (fact.conflict || !fact.relation || expected < 1) {
      unconsumed.push(Object.assign({}, obligation, { actualCount: 0, reason: fact.conflict || "invalid_installment_cadence" }));
      return;
    }
    var groupIndexes = candidates.map(function (candidate, index) {
      return candidate && candidate.type === "installment_payment" && candidate.evidence && candidate.evidence.groupId === fact.groupId ? index : -1;
    }).filter(function (index) { return index >= 0; });
    var targetIndexes = groupIndexes.slice(1);
    var matches = targetIndexes.filter(function (index) {
      var candidate = candidates[index];
      return relationKey(candidate && candidate.dateRelation) === relationKey(fact.relation)
        && (!candidate.dateRelation.groupId || candidate.dateRelation.groupId === fact.groupId);
    });
    if (matches.length === expected && targetIndexes.length === expected) {
      consumed.push(Object.assign({}, obligation, { candidateIndexes: matches }));
    } else if (matches.length < expected || targetIndexes.length !== expected) {
      unconsumed.push(Object.assign({}, obligation, { actualCount: matches.length, candidateIndexes: matches }));
    } else {
      consumed.push(Object.assign({}, obligation, { candidateIndexes: matches.slice(0, expected) }));
      duplicates.push(Object.assign({}, obligation, { candidateIndexes: matches.slice(expected) }));
    }
  });

  candidates.forEach(function (candidate, index) {
    if (!candidate || !candidate.dateRelation) return;
    var supported = facts.some(function (fact) {
      if (!fact || !["date_relation", "installment_cadence"].includes(fact.kind) || relationKey(fact.relation) !== relationKey(candidate.dateRelation)) return false;
      if (fact.kind === "date_relation" && fact.assertion && fact.assertion !== "positive") return false;
      var factGroupId = fact.groupId || fact.relation && fact.relation.groupId || null;
      if (factGroupId && (!candidate.evidence || candidate.evidence.groupId !== factGroupId)) return false;
      var clauseId = candidate.dateRelation.clauseId || candidateClauseId(candidate);
      return !fact.clauseId || clauseId === fact.clauseId;
    });
    if (!supported) unsupportedCandidates.push({ candidateIndex: index, type: candidate.type, reason: "unsupported_date_relation" });
  });

  candidates.forEach(function (candidate, index) {
    if (eventMatched.has(index)) return;
    unsupportedCandidates.push({
      candidateIndex: index,
      type: candidate && candidate.type || null,
      amount: candidate && candidate.amount,
      reason: PAYMENT_TYPES.has(candidate && candidate.type) ? "payment_without_positive_clause" : "event_without_positive_clause",
    });
  });

  var complete = obligations.length > 0 && candidates.length > 0 && unconsumed.length === 0 && duplicates.length === 0 && unsupportedCandidates.length === 0;
  var reason = complete ? "all_explicit_evidence_consumed_once"
    : unconsumed.length ? "explicit_evidence_unconsumed"
      : duplicates.length ? "explicit_evidence_consumed_more_than_once"
        : unsupportedCandidates.length ? "unsupported_candidate"
          : "no_event_plan";
  return {
    complete: complete,
    reason: reason,
    obligations: obligations,
    consumed: consumed,
    unconsumed: unconsumed,
    duplicates: duplicates,
    unsupportedCandidates: unsupportedCandidates,
  };
}

module.exports = {
  assessCoverage: assessCoverage,
  _test: { relationKey: relationKey, expectedEventCount: expectedEventCount, sameAmount: sameAmount },
};
