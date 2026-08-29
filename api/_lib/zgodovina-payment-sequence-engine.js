"use strict";

var numberEngine = require("./zgodovina-number-engine");

var NAMED_DAY_PATTERN = /(?<![\p{L}\d])(?:predvčeraj(?:šnjim)?|včeraj|danes)(?![\p{L}\d])/giu;

function sourceSpan(text, start, end) {
  return { start: start, end: end, text: text.slice(start, end) };
}

function clipExpressionBeforeTemporalCount(text, expression, dateRelations) {
  var relation = (dateRelations || []).find(function (item) {
    return item.countSpan && expression.evidence.start < item.countSpan.start
      && expression.evidence.end <= item.countSpan.end && expression.evidence.end > item.countSpan.start;
  });
  if (!relation) return expression;
  var end = relation.countSpan.start;
  while (end > expression.evidence.start && /\s/u.test(text.charAt(end - 1))) end -= 1;
  var raw = text.slice(expression.evidence.start, end);
  var value = numberEngine.parseSlovenianNumber(raw);
  if (!Number.isFinite(value)) return expression;
  return Object.assign({}, expression, { value: value, evidence: sourceSpan(text, expression.evidence.start, end) });
}

function extractPaymentExpressions(text, dateRelations) {
  return numberEngine.extractNumberExpressions(text, { defaultRole: "money" }).map(function (expression) {
    return clipExpressionBeforeTemporalCount(text, expression, dateRelations);
  }).filter(function (expression) {
    if (expression.role !== "money") return false;
    return !(dateRelations || []).some(function (relation) {
      return relation.countSpan && expression.evidence.start >= relation.countSpan.start
        && expression.evidence.end <= relation.countSpan.end;
    });
  });
}

function positivePaymentSignal(signal) {
  return Boolean(signal && signal.assertion === "positive"
    && ["partial_payment", "installment_payment"].includes(signal.eventType));
}

function splitReferenceDateContinuations(text, spans, signals, dateRelations, expressions) {
  var refined = [];
  (spans || []).forEach(function (span) {
    var cuts = [span.start];
    (dateRelations || []).filter(function (relation) {
      return ["reference_date", "previous_event"].includes(relation.anchor)
        && relation.sourceSpan.start > span.start && relation.sourceSpan.start < span.end;
    }).forEach(function (relation) {
      var priorPaymentSignal = (signals || []).some(function (signal) {
        return positivePaymentSignal(signal) && signal.evidence.start >= span.start && signal.evidence.end <= relation.sourceSpan.start;
      });
      if (!priorPaymentSignal) return;
      var priorAmount = expressions.some(function (expression) {
        return expression.evidence.start >= span.start && expression.evidence.end <= relation.sourceSpan.start;
      });
      if (!priorAmount) return;
      var followingAmount = expressions.filter(function (expression) {
        return expression.evidence.start >= relation.sourceSpan.end && expression.evidence.start < span.end;
      }).sort(function (left, right) { return left.evidence.start - right.evidence.start; })[0];
      if (!followingAmount) return;
      var interveningRelation = (dateRelations || []).some(function (other) {
        return other !== relation && other.sourceSpan.start >= relation.sourceSpan.end
          && other.sourceSpan.end <= followingAmount.evidence.start;
      });
      var interveningNamedDay = namedDayAnchors(text, span).some(function (anchor) {
        return anchor.start >= relation.sourceSpan.end && anchor.end <= followingAmount.evidence.start;
      });
      if (interveningRelation || interveningNamedDay) return;
      var followingPaymentSignal = (signals || []).some(function (signal) {
        return positivePaymentSignal(signal) && signal.evidence.start >= relation.sourceSpan.end
          && signal.evidence.end <= followingAmount.evidence.start;
      });
      var bridge = text.slice(relation.sourceSpan.end, followingAmount.evidence.start);
      var ellipticalBridge = /^\s*[,–—:-]?\s*(?:(?:pa(?:\s+še)?|še)\s*)?$/iu.test(bridge);
      if (!followingPaymentSignal && !ellipticalBridge) return;
      cuts.push(relation.sourceSpan.start);
    });
    cuts.push(span.end);
    var ordered = Array.from(new Set(cuts)).sort(function (left, right) { return left - right; });
    ordered.forEach(function (cut, index) {
      if (index === ordered.length - 1 || ordered[index + 1] <= cut) return;
      refined.push({ start: cut, end: ordered[index + 1] });
    });
  });
  return refined.filter(function (span) { return text.slice(span.start, span.end).trim(); });
}

function namedDayAnchors(text, span) {
  var local = text.slice(span.start, span.end);
  var anchors = [];
  NAMED_DAY_PATTERN.lastIndex = 0;
  var match;
  while ((match = NAMED_DAY_PATTERN.exec(local))) {
    anchors.push(sourceSpan(text, span.start + match.index, span.start + match.index + match[0].length));
    if (!match[0].length) NAMED_DAY_PATTERN.lastIndex += 1;
  }
  return anchors;
}

function namedDayBridgeAllowed(bridge) {
  return /^\s*[,–—:;-]?\s*(?:(?:in|pa)\s+)?(?:(?:pa|še|se|je|so|sem|smo|dodatnih?|dodatno)\s+)*(?:(?:plačal\w*|poravnal\w*|nakazal\w*)\s+)?(?:(?:pa|še|se|je|so|sem|smo|dodatnih?|dodatno)\s*)*$/iu.test(bridge);
}

function namedWindowIsPayment(text, windowStart, anchor, amount, signals, inheritedLineage) {
  if (!amount || !anchor) return false;
  var explicit = (signals || []).some(function (signal) {
    return positivePaymentSignal(signal) && signal.evidence.start >= windowStart
      && signal.evidence.end <= amount.evidence.end;
  });
  if (explicit) return true;
  return inheritedLineage && namedDayBridgeAllowed(text.slice(anchor.end, amount.evidence.start));
}

function splitNamedDayContinuations(text, spans, signals, expressions, dateRelations) {
  var refined = [];
  (spans || []).forEach(function (span) {
    var anchors = namedDayAnchors(text, span);
    if (anchors.length < 2 && (!anchors.length || anchors[0].start === span.start)) {
      refined.push(span);
      return;
    }
    var cuts = [span.start];
    anchors.forEach(function (anchor, anchorIndex) {
      if (anchor.start <= span.start) return;
      var windowStart = cuts[cuts.length - 1];
      var inheritedLineage = (signals || []).some(function (signal) {
        return positivePaymentSignal(signal) && signal.evidence.start < span.end;
      });
      var previousAnchors = anchors.filter(function (item) { return item.start >= windowStart && item.start < anchor.start; });
      var previousAnchor = previousAnchors.length ? previousAnchors[previousAnchors.length - 1] : null;
      var amountsBeforeAnchor = expressions.filter(function (expression) {
        return expression.evidence.start >= windowStart && expression.evidence.end <= anchor.start;
      }).sort(function (left, right) { return left.evidence.start - right.evidence.start; });
      var previousAmount = amountsBeforeAnchor.slice().sort(function (left, right) { return right.evidence.start - left.evidence.start; })[0];
      var nextAnchor = anchors.slice(anchorIndex + 1).find(function (item) { return item.start > anchor.start; });
      var followingLimit = nextAnchor ? nextAnchor.start : span.end;
      var followingAmount = expressions.filter(function (expression) {
        return expression.evidence.start >= anchor.end && expression.evidence.start < followingLimit;
      }).sort(function (left, right) { return left.evidence.start - right.evidence.start; })[0];
      if (!followingAmount && previousAmount && amountsBeforeAnchor.length >= 2 && inheritedLineage
        && namedDayBridgeAllowed(text.slice(previousAmount.evidence.end, anchor.start))) {
        var earlierAmount = amountsBeforeAnchor[amountsBeforeAnchor.length - 2];
        var earlierReferenceRelation = (dateRelations || []).some(function (relation) {
          return relation.anchor === "reference_date" && relation.sourceSpan.start >= windowStart
            && relation.sourceSpan.end > earlierAmount.evidence.start
            && relation.sourceSpan.end <= previousAmount.evidence.start;
        });
        if (earlierReferenceRelation) cuts.push(previousAmount.evidence.start);
        return;
      }
      if (!previousAmount || !followingAmount) return;
      var priorExplicit = (signals || []).some(function (signal) {
        if (!positivePaymentSignal(signal) || signal.evidence.start < windowStart) return false;
        if (signal.evidence.end <= previousAmount.evidence.end) return true;
        return signal.eventType === "installment_payment"
          && signal.evidence.start <= previousAmount.evidence.start
          && signal.evidence.end >= previousAmount.evidence.end;
      });
      var previousReferenceRelation = (dateRelations || []).filter(function (relation) {
        return ["reference_date", "previous_event"].includes(relation.anchor) && relation.sourceSpan.start >= windowStart
          && relation.sourceSpan.end <= previousAmount.evidence.start;
      }).sort(function (left, right) { return right.sourceSpan.start - left.sourceSpan.start; })[0];
      var priorReferenceContinuation = Boolean(previousReferenceRelation && inheritedLineage
        && namedDayBridgeAllowed(text.slice(previousReferenceRelation.sourceSpan.end, previousAmount.evidence.start)));
      var priorPayment = priorExplicit || (previousAnchor
        && namedWindowIsPayment(text, windowStart, previousAnchor, previousAmount, signals, inheritedLineage))
        || priorReferenceContinuation;
      var followingPayment = namedWindowIsPayment(text, anchor.start, anchor, followingAmount, signals, inheritedLineage || priorPayment);
      if (priorPayment && followingPayment) cuts.push(anchor.start);
    });
    cuts.push(span.end);
    var ordered = Array.from(new Set(cuts)).sort(function (left, right) { return left - right; });
    ordered.forEach(function (cut, index) {
      if (index === ordered.length - 1 || ordered[index + 1] <= cut) return;
      refined.push({ start: cut, end: ordered[index + 1] });
    });
  });
  return refined.filter(function (span) { return text.slice(span.start, span.end).trim(); });
}

function splitPaymentContinuations(text, spans, signals, dateRelations) {
  var expressions = extractPaymentExpressions(text, dateRelations);
  var referenceSpans = splitReferenceDateContinuations(text, spans, signals, dateRelations, expressions);
  return splitNamedDayContinuations(text, referenceSpans, signals, expressions, dateRelations);
}

module.exports = {
  clipExpressionBeforeTemporalCount: clipExpressionBeforeTemporalCount,
  extractPaymentExpressions: extractPaymentExpressions,
  splitPaymentContinuations: splitPaymentContinuations,
  namedDayAnchors: namedDayAnchors,
  namedDayBridgeAllowed: namedDayBridgeAllowed,
};
