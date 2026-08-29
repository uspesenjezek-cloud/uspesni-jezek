"use strict";

var numberEngine = require("./zgodovina-number-engine");

var UNIT_SOURCE = "(?:dan|dneva|dnevi|dni|dnem|dnevih|dneh|dnevom|dnevoma|dnevu|teden|tedna|tedne|tedni|tednov|tednih|tednom|tednoma|tednu|mesec|meseca|mesece|meseci|mesecev|mesecih|mesecem|mesecema|mesecu|mesc|mesca|mesce|mesci|mescov|mescih|mescom|mescoma|mescu|leto|leta|leti|let|letih|letom|letoma|letu)";
var UNIT = "(" + UNIT_SOURCE + ")";
var ADJACENT_DIGIT_COUNT = "(?<![\\p{L}\\d])\\d+(?=" + UNIT_SOURCE + "(?![\\p{L}\\d]))";
var NUMBER = "(" + numberEngine.NUMBER_EXPRESSION_SOURCE + "|" + ADJACENT_DIGIT_COUNT + "|(?<![\\p{L}\\d])\\d+(?:-?(?:h|ih|eh))(?![\\p{L}\\d]))";
var NUMBER_UNIT_GAP = "\\s*";
var MONTH_DAY = "(\\d{1,2})(?:\\s*\\.|\\s*-?(?:ga|ega))";
var PREVIOUS_MONTH = "(?:prejšnj|prejsnj)(?:i|em|ega)\\s+mesec(?:u|a)?";
var RELATIVE_MONTH_DAY_PATTERNS = [
  new RegExp("(?<![\\p{L}\\d])" + MONTH_DAY + "\\s+(?:v\\s+)?" + PREVIOUS_MONTH + "(?![\\p{L}\\d])", "giu"),
  new RegExp("(?<![\\p{L}\\d])(?:v\\s+)?" + PREVIOUS_MONTH + "[\\s,]+" + MONTH_DAY + "(?![\\p{L}\\d])", "giu"),
];

function nearNazajTypo(value) {
  var token = String(value || "").toLowerCase();
  var canonical = "nazaj";
  if (token === canonical) return true;
  if (token.length !== canonical.length) return false;
  var differences = [];
  for (var index = 0; index < canonical.length; index += 1) {
    if (token.charAt(index) !== canonical.charAt(index)) differences.push(index);
  }
  if (differences.length <= 2) return true;
  return differences.length === 2 && differences[1] === differences[0] + 1
    && token.charAt(differences[0]) === canonical.charAt(differences[1])
    && token.charAt(differences[1]) === canonical.charAt(differences[0]);
}

function normalizeTemporalTypos(value) {
  var text = String(value == null ? "" : value)
    .replace(/\bdvem(?=\s+(?:dnevoma|tednoma|mesecema|letoma)\b)/giu, "dvema")
    .replace(/(?<![\p{L}\d])d[\p{L}]{3,5}(?![\p{L}\d])/giu, function (token) {
      var candidate = token.toLowerCase();
      var canonical = "danes";
      if (candidate === canonical) return canonical;
      if (Math.abs(candidate.length - canonical.length) > 1) return token;
      var left = 0;
      var right = 0;
      var edits = 0;
      while (left < candidate.length && right < canonical.length) {
        if (candidate.charAt(left) === canonical.charAt(right)) {
          left += 1;
          right += 1;
          continue;
        }
        edits += 1;
        if (edits > 1) return token;
        if (candidate.length > canonical.length) left += 1;
        else if (candidate.length < canonical.length) right += 1;
        else {
          left += 1;
          right += 1;
        }
      }
      edits += candidate.length - left + canonical.length - right;
      return edits <= 1 ? canonical : token;
    });
  var pattern = new RegExp("(" + UNIT_SOURCE + "(?:\\s+dni)?\\s+)([\\p{L}]{5})(?![\\p{L}\\d])", "giu");
  return text.replace(pattern, function (full, prefix, token) {
    return nearNazajTypo(token) ? prefix + "nazaj" : full;
  });
}

var PATTERNS = [
  relationPattern("relative_after_next", 1, "naslednj\\w*\\s+" + UNIT, null, 1, 1),
  relationPattern("relative_after_cez", 1, "čez\\s+" + NUMBER + NUMBER_UNIT_GAP + UNIT, 1, 2),
  relationPattern("relative_after_cez_implicit_one", 1, "čez\\s+" + UNIT + "(?:\\s+dni)?", null, 1, 1),
  relationPattern("relative_after_later", 1, NUMBER + NUMBER_UNIT_GAP + UNIT + "\\s+(?:kasneje|pozneje)", 1, 2),
  relationPattern("relative_after_later_implicit_one", 1, UNIT + "(?:\\s+dni)?\\s+(?:kasneje|pozneje)", null, 1, 1),
  relationPattern("relative_after_that", 1, NUMBER + NUMBER_UNIT_GAP + UNIT + "\\s+po\\s+tem", 1, 2),
  relationPattern("relative_after_po", 1, "po\\s+" + NUMBER + NUMBER_UNIT_GAP + UNIT, 1, 2),
  relationPattern("relative_after_po_implicit_one", 1, "po\\s+" + UNIT + "(?:\\s+dni)?", null, 1, 1),
  relationPattern("relative_before_earlier", -1, NUMBER + NUMBER_UNIT_GAP + UNIT + "\\s+prej", 1, 2),
  relationPattern("relative_before_earlier_implicit_one", -1, UNIT + "(?:\\s+dni)?\\s+prej", null, 1, 1),
  relationPattern("relative_before_that", -1, NUMBER + NUMBER_UNIT_GAP + UNIT + "\\s+pred\\s+tem", 1, 2),
  relationPattern("relative_before_that_implicit_one", -1, UNIT + "(?:\\s+dni)?\\s+pred\\s+tem", null, 1, 1),
  relationPattern("relative_before_pred", -1, "pred\\s+" + NUMBER + NUMBER_UNIT_GAP + UNIT, 1, 2, null, "reference_date"),
  relationPattern("relative_before_pred_implicit_one", -1, "pred\\s+" + UNIT, null, 1, 1, "reference_date"),
  relationPattern("relative_before_back", -1, "za\\s+" + NUMBER + NUMBER_UNIT_GAP + UNIT + "\\s+nazaj", 1, 2, null, "reference_date"),
  relationPattern("relative_before_back_implicit_one", -1, "za\\s+" + UNIT + "(?:\\s+dni)?\\s+nazaj", null, 1, 1, "reference_date"),
  relationPattern("relative_before_reference", -1, NUMBER + NUMBER_UNIT_GAP + UNIT + "(?:\\s+dni)?\\s+nazaj", 1, 2, null, "reference_date"),
  relationPattern("relative_before_reference_implicit_one", -1, UNIT + "(?:\\s+dni)?\\s+nazaj", null, 1, 1, "reference_date"),
];

function relationPattern(reason, direction, source, countGroup, unitGroup, fixedAmount, anchor) {
  return Object.freeze({
    reason: reason,
    direction: direction,
    anchor: anchor || "previous_event",
    pattern: new RegExp("(?<![\\p{L}\\d])" + source + "(?![\\p{L}\\d])", "giu"),
    countGroup: countGroup,
    unitGroup: unitGroup,
    fixedAmount: fixedAmount || null,
  });
}

function sourceSpan(text, start, end) {
  return { start: start, end: end, text: text.slice(start, end) };
}

function canonicalUnit(value) {
  var unit = String(value || "").toLowerCase();
  if (/^(?:dan|dnev|dni|dne)/u.test(unit)) return "day";
  if (/^ted/u.test(unit)) return "week";
  if (/^mes(?:ec|c)/u.test(unit)) return "month";
  if (/^let/u.test(unit)) return "year";
  return null;
}

function refineAdjacentDigitCount(value) {
  var text = String(value == null ? "" : value);
  if (!/[ \t]/u.test(text)) return { text: text, offset: 0 };
  if (/^\d{1,3}(?:[ \t]\d{3})+$/u.test(text)) return { text: text, offset: 0 };
  var tokens = Array.from(text.matchAll(/[^ \t]+/gu));
  var hasDigitToken = tokens.some(function (token) { return /^\d/u.test(token[0]); });
  var hasWordToken = tokens.some(function (token) { return /^[\p{L}]/u.test(token[0]); });
  if (hasDigitToken && hasWordToken) {
    var lastToken = tokens[tokens.length - 1];
    var firstToken = tokens[0];
    var multiplier = /^(?:sto|stot\w*|tisoč\w*|jur\w*)$/u.test(lastToken[0]);
    if (!(tokens.length === 2 && /^\d$/u.test(firstToken[0]) && multiplier)) {
      return { text: lastToken[0], offset: lastToken.index };
    }
  }
  if (/^\d+(?:[ \t]+\d+)+$/u.test(text)) {
    var last = text.match(/\d+$/u);
    if (last) return { text: last[0], offset: last.index };
  }
  return { text: text, offset: 0 };
}

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}

function likelyMoneyBeforeImplicitReference(text, relation) {
  if (!relation || relation.reason !== "relative_before_reference" || relation.amount <= 31 || !relation.countSpan) return false;
  var tail = text.slice(relation.countSpan.end, relation.sourceSpan.end);
  if (!/^\s+(?:mesec|teden|leto)(?:\s+dni)?\s+nazaj$/u.test(tail)) return false;
  var before = text.slice(Math.max(0, relation.countSpan.start - 40), relation.countSpan.start);
  return /(?:plačal\w*|poravnal\w*|nakazal\w*)(?:\s+je)?\s*$/u.test(before);
}

function extractDateRelations(value) {
  var text = normalizeTemporalTypos(String(value == null ? "" : value).toLowerCase().normalize("NFC"));
  var directionalCue = /(?:čez|kasneje|pozneje|prej|nazaj|naslednj\w*\s+(?:dan|teden|mesec|leto)|(?:prejšnj|prejsnj)(?:i|em|ega)\s+mesec(?:u|a)?|(?:po|pred)\s+tem)/u.test(text);
  var explicitRelativeDuration = /\b(?:po|pred)\s+(?:(?:[\p{L}\d.,-]+\s+){0,7}|\d+\s*)(?:dan|dnev|dni|teden|tedn|mesec|let)/u.test(text + " ");
  if (!directionalCue && !explicitRelativeDuration) return [];
  var matches = [];
  RELATIVE_MONTH_DAY_PATTERNS.forEach(function (pattern, priority) {
    pattern.lastIndex = 0;
    var match;
    while ((match = pattern.exec(text))) {
      var dayText = match[1];
      var dayOfMonth = Number(dayText);
      if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) continue;
      var localDayStart = match[0].indexOf(dayText);
      matches.push({
        priority: -20 + priority,
        anchor: "reference_date",
        field: "occurredDate",
        direction: -1,
        amount: 1,
        unit: "month",
        dayOfMonth: dayOfMonth,
        sourceSpan: sourceSpan(text, match.index, match.index + match[0].length),
        countSpan: sourceSpan(text, match.index + localDayStart, match.index + localDayStart + dayText.length),
        reason: "relative_previous_month_day",
      });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  });
  PATTERNS.forEach(function (definition, priority) {
    definition.pattern.lastIndex = 0;
    var match;
    while ((match = definition.pattern.exec(text))) {
      var capturedCount = definition.countGroup == null ? match[definition.unitGroup] : match[definition.countGroup];
      var refinedCount = definition.countGroup == null ? { text: capturedCount, offset: 0 } : refineAdjacentDigitCount(capturedCount);
      var amount = definition.fixedAmount || numberEngine.parseSlovenianNumber(refinedCount.text, { count: true });
      var unit = canonicalUnit(match[definition.unitGroup]);
      if (!Number.isInteger(amount) || amount < 1 || amount > 10000 || !unit) continue;
      var raw = match[0];
      var localCountStart = raw.indexOf(capturedCount) + refinedCount.offset;
      var start = match.index;
      var sourceStart = refinedCount.offset > 0 ? start + localCountStart : start;
      var end = start + raw.length;
      matches.push({
        priority: priority,
        anchor: definition.anchor,
        field: "occurredDate",
        direction: definition.direction,
        amount: amount,
        unit: unit,
        sourceSpan: sourceSpan(text, sourceStart, end),
        countSpan: sourceSpan(text, start + localCountStart, start + localCountStart + refinedCount.text.length),
        reason: definition.reason,
      });
      if (match[0].length === 0) definition.pattern.lastIndex += 1;
    }
  });
  matches = matches.filter(function (candidate) { return !likelyMoneyBeforeImplicitReference(text, candidate); });
  matches.sort(function (a, b) {
    return a.sourceSpan.start - b.sourceSpan.start || (b.sourceSpan.end - b.sourceSpan.start) - (a.sourceSpan.end - a.sourceSpan.start) || a.priority - b.priority;
  });
  var selected = [];
  matches.forEach(function (candidate) {
    if (selected.some(function (existing) { return overlaps(existing.sourceSpan, candidate.sourceSpan); })) return;
    var relation = Object.assign({}, candidate);
    delete relation.priority;
    selected.push(relation);
  });
  return selected;
}

function cadenceWindow(text, group, span) {
  if (!group || group.completed !== true || !group.span || !span) return false;
  if (span.start < group.countSpan.end) return false;
  if (span.start >= group.span.start && span.start < group.span.end) return true;
  if (span.start < group.span.end || span.start - group.span.end > 42) return false;
  var bridge = text.slice(group.span.end, span.start);
  return !/[.!?;]/u.test(bridge) && !/\b(?:potem|nato|zatem|sedaj|zdaj|trenutno|ampak|vendar|toda|obljub\w*|račun\w*|ugovor\w*|reklamacij\w*)\b/u.test(bridge);
}

function extractInstallmentCadences(value, installmentGroups) {
  var text = String(value == null ? "" : value).toLowerCase().normalize("NFC");
  var groups = (Array.isArray(installmentGroups) ? installmentGroups : []).filter(function (group) {
    return group && group.completed === true && Number.isInteger(group.count) && group.count >= 2;
  });
  if (!groups.length) return [];
  var candidates = [];
  var durationPattern = new RegExp("(?<![\\p{L}\\d])v\\s+" + NUMBER + NUMBER_UNIT_GAP + UNIT + "(?![\\p{L}\\d])", "giu");
  var durationMatch;
  while ((durationMatch = durationPattern.exec(text))) {
    var periodCount = numberEngine.parseSlovenianNumber(durationMatch[1], { count: true });
    var unit = canonicalUnit(durationMatch[2]);
    if (!Number.isInteger(periodCount) || periodCount < 1 || !unit) continue;
    var raw = durationMatch[0];
    var localCountStart = raw.indexOf(durationMatch[1]);
    candidates.push({
      priority: 0, periodCount: periodCount, unit: unit,
      sourceSpan: sourceSpan(text, durationMatch.index, durationMatch.index + raw.length),
      countSpan: sourceSpan(text, durationMatch.index + localCountStart, durationMatch.index + localCountStart + durationMatch[1].length),
      reason: "equal_installment_duration",
    });
    if (!raw.length) durationPattern.lastIndex += 1;
  }
  [
    { pattern: /(?<![\p{L}\d])vsak\s+dan(?![\p{L}\d])/giu, unit: "day", reason: "installment_every_day" },
    { pattern: /(?<![\p{L}\d])vsak\s+teden(?![\p{L}\d])/giu, unit: "week", reason: "installment_every_week" },
    { pattern: /(?<![\p{L}\d])vsak\s+mesec(?![\p{L}\d])/giu, unit: "month", reason: "installment_every_month" },
    { pattern: /(?<![\p{L}\d])vsako\s+leto(?![\p{L}\d])/giu, unit: "year", reason: "installment_every_year" },
    { pattern: /(?<![\p{L}\d])dnevno(?![\p{L}\d])/giu, unit: "day", reason: "installment_daily" },
    { pattern: /(?<![\p{L}\d])tedensko(?![\p{L}\d])/giu, unit: "week", reason: "installment_weekly" },
    { pattern: /(?<![\p{L}\d])mesečno(?![\p{L}\d])/giu, unit: "month", reason: "installment_monthly" },
    { pattern: /(?<![\p{L}\d])letno(?![\p{L}\d])/giu, unit: "year", reason: "installment_yearly" },
  ].forEach(function (definition) {
    definition.pattern.lastIndex = 0;
    var match;
    while ((match = definition.pattern.exec(text))) {
      candidates.push({
        priority: 1, periodCount: null, unit: definition.unit,
        sourceSpan: sourceSpan(text, match.index, match.index + match[0].length),
        countSpan: null, reason: definition.reason,
      });
      if (!match[0].length) definition.pattern.lastIndex += 1;
    }
  });
  candidates.sort(function (left, right) { return left.priority - right.priority || left.sourceSpan.start - right.sourceSpan.start; });
  var usedGroups = new Set();
  var cadences = [];
  candidates.forEach(function (candidate) {
    var group = groups.filter(function (item) { return !usedGroups.has(item.id) && cadenceWindow(text, item, candidate.sourceSpan); }).sort(function (left, right) {
      return Math.abs(candidate.sourceSpan.start - left.span.end) - Math.abs(candidate.sourceSpan.start - right.span.end);
    })[0];
    if (!group) return;
    usedGroups.add(group.id);
    var conflict = candidate.periodCount != null && candidate.periodCount !== group.count ? "installment_duration_count_mismatch" : null;
    var relation = conflict ? null : {
      anchor: "previous_event", field: "occurredDate", direction: 1, amount: 1, unit: candidate.unit,
      sourceSpan: candidate.sourceSpan, reason: candidate.reason,
    };
    cadences.push({
      id: "installment-cadence-" + (cadences.length + 1), groupId: group.id,
      installmentCount: group.count, periodCount: candidate.periodCount,
      intervalAmount: conflict ? null : 1, unit: candidate.unit,
      expectedRelationCount: conflict ? 0 : Math.max(0, group.count - 1),
      sourceSpan: candidate.sourceSpan, countSpan: candidate.countSpan,
      reason: candidate.reason, conflict: conflict, relation: relation,
    });
  });
  return cadences;
}

function validIsoDate(value) {
  var iso = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  var parts = iso.split("-").map(Number);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
}

function shiftIsoDate(iso, relation) {
  if (!validIsoDate(iso) || !relation || ![1, -1].includes(Number(relation.direction))) return null;
  var amount = Number(relation.amount);
  var unit = String(relation.unit || "");
  if (!Number.isInteger(amount) || amount < 1 || !["day", "week", "month", "year"].includes(unit)) return null;
  var parts = iso.split("-").map(Number);
  var direction = Number(relation.direction);
  if (unit === "day" || unit === "week") {
    var days = amount * direction * (unit === "week" ? 7 : 1);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days)).toISOString().slice(0, 10);
  }
  var monthDelta = amount * direction * (unit === "year" ? 12 : 1);
  var targetMonthNumber = parts[0] * 12 + parts[1] - 1 + monthDelta;
  var targetYear = Math.floor(targetMonthNumber / 12);
  var targetMonth = ((targetMonthNumber % 12) + 12) % 12;
  var lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  var explicitDay = relation.dayOfMonth == null ? null : Number(relation.dayOfMonth);
  if (explicitDay != null && (!Number.isInteger(explicitDay) || explicitDay < 1 || explicitDay > lastDay)) return null;
  return new Date(Date.UTC(targetYear, targetMonth, explicitDay == null ? Math.min(parts[2], lastDay) : explicitDay)).toISOString().slice(0, 10);
}

module.exports = {
  extractDateRelations: extractDateRelations,
  extractInstallmentCadences: extractInstallmentCadences,
  canonicalUnit: canonicalUnit,
  normalizeTemporalTypos: normalizeTemporalTypos,
  shiftIsoDate: shiftIsoDate,
};
