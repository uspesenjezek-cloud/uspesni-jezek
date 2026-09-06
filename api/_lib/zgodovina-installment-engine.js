"use strict";

var numberEngine = require("./zgodovina-number-engine");

var MAX_EVENTS = 20;
var NUMBER_TOKEN = /^(?:\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?(?:-?(?:h|ih|eh))?|[\p{L}]+)$/u;

function normalizeText(value) {
  return String(value == null ? "" : value).toLowerCase().normalize("NFC")
    .replace(/\bplacal(a|i|o)?\b/gu, "plačal$1")
    .replace(/\bplacan(a|i|o)?\b/gu, "plačan$1")
    .replace(/\s+/g, " ").trim();
}

var parseSlovenianNumber = numberEngine.parseSlovenianNumber;

function tokenize(text) {
  var expression = /\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?(?:-?(?:h|ih|eh))?|[\p{L}]+|€/gu;
  var tokens = [];
  var match;
  while ((match = expression.exec(text))) {
    tokens.push({ text: match[0], lower: match[0].toLowerCase(), start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function numberSequence(tokens, start, countMode) {
  if (!tokens[start] || !NUMBER_TOKEN.test(tokens[start].lower)) return null;
  var best = null;
  var parts = [];
  for (var i = start; i < tokens.length && i < start + 5; i += 1) {
    if (!NUMBER_TOKEN.test(tokens[i].lower)) break;
    parts.push(tokens[i].lower);
    var value = parseSlovenianNumber(parts.join(" "), { count: countMode });
    if (Number.isFinite(value)) best = { value: value, start: tokens[start].start, end: tokens[i].end, tokenEnd: i };
  }
  return best;
}

function completedCue(text, start, previousGroup) {
  var prefixStart = Math.max(0, Math.max(
    text.lastIndexOf(".", start), text.lastIndexOf("!", start), text.lastIndexOf("?", start),
    text.lastIndexOf(";", start), text.lastIndexOf(",", start)
  ) + 1);
  var prefix = text.slice(prefixStart, start);
  if (/\b(?:ni|ne|nikoli)\s+(?:(?:še|več|nič)\s+){0,3}(?:plačal\w*|poravnal\w*|nakazal\w*)\b/u.test(prefix)) return false;
  if (/\b(?:bo|bodo|bojo|obljubil\w*|predlagal\w*|dogovoril\w*)\b[^.!?;]{0,45}\b(?:plačal\w*|poravnal\w*|nakazal\w*)\b/u.test(prefix)) return false;
  if (/\b(?:plačal\w*|poravnal\w*|nakazal\w*|plačan\w*|poravnan\w*|dal(?:a|i|o)?(?:\s+je)?)\b/u.test(prefix)) return true;
  if (!previousGroup || previousGroup.completed !== true) return false;
  var bridge = text.slice(previousGroup.span.end, start);
  return /\b(?:nato|potem|zatem|kasneje|pozneje|in|pa)\b/u.test(bridge);
}

function strongBoundaryBetween(text, start, end) {
  return /[.!?;]/u.test(text.slice(Math.max(0, start), Math.max(0, end)));
}

function previousGroupBefore(groups, start) {
  return groups.filter(function (group) { return group && group.span && group.span.end <= start; }).sort(function (left, right) {
    return right.span.end - left.span.end;
  })[0] || null;
}

function addGroup(text, tokens, groups, countIndex, explicitNoun, poIndex) {
  var count = parseSlovenianNumber(tokens[countIndex] && tokens[countIndex].lower, { count: true });
  if (!Number.isInteger(count) || count < 1 || count > MAX_EVENTS) return false;
  var amount = numberSequence(tokens, poIndex + 1, false);
  if (!amount || !Number.isFinite(amount.value) || amount.value <= 0) return false;
  if (strongBoundaryBetween(text, tokens[countIndex].end, tokens[poIndex].start)) return false;
  var currencyToken = tokens[amount.tokenEnd + 1];
  var hasCurrency = Boolean(currencyToken && (currencyToken.lower === "€" || /^(?:eur|evr|euro)/u.test(currencyToken.lower)));
  var end = hasCurrency ? currencyToken.end : amount.end;
  if (groups.some(function (group) {
    return group.countSpan.start === tokens[countIndex].start && group.amountSpan.start === amount.start;
  })) return false;
  var previous = previousGroupBefore(groups, tokens[countIndex].start);
  groups.push({
    id: null, count: count,
    amount: Math.round(amount.value * 100) / 100, total: Math.round(count * amount.value * 100) / 100,
    currency: hasCurrency ? "EUR" : null, explicitNoun: explicitNoun, completed: completedCue(text, tokens[countIndex].start, previous),
    span: { start: tokens[countIndex].start, end: end, text: text.slice(tokens[countIndex].start, end) },
    countSpan: { start: tokens[countIndex].start, end: tokens[countIndex].end, text: tokens[countIndex].text },
    amountSpan: { start: amount.start, end: amount.end, text: text.slice(amount.start, amount.end) },
    reason: explicitNoun ? "explicit_installment_group" : "elliptical_installment_group",
  });
  return true;
}

function addTrailingGroup(text, tokens, groups, countIndex, nounIndex) {
  var count = parseSlovenianNumber(tokens[countIndex] && tokens[countIndex].lower, { count: true });
  if (!Number.isInteger(count) || count < 2 || count > MAX_EVENTS) return false;
  var amount = numberSequence(tokens, nounIndex + 1, false);
  if (!amount || !Number.isFinite(amount.value) || amount.value <= 0) return false;
  if (strongBoundaryBetween(text, tokens[nounIndex].end, amount.start)) return false;
  if (/^\s*(?:več|manj)\b/u.test(text.slice(amount.end))) return false;
  var currencyToken = tokens[amount.tokenEnd + 1];
  var hasCurrency = Boolean(currencyToken && (currencyToken.lower === "€" || /^(?:eur|evr|euro)/u.test(currencyToken.lower)));
  var end = hasCurrency ? currencyToken.end : amount.end;
  if (!/^\s*(?:$|[.!?;,]|\b(?:in|nato|potem|zatem|danes|včeraj|predvčeraj|čez|pred)\b)/u.test(text.slice(end))) return false;
  if (groups.some(function (group) {
    return group.countSpan.start === tokens[countIndex].start && group.amountSpan.start === amount.start;
  })) return false;
  var previous = previousGroupBefore(groups, tokens[countIndex].start);
  groups.push({
    id: null, count: count,
    amount: Math.round(amount.value * 100) / 100, total: Math.round(count * amount.value * 100) / 100,
    currency: hasCurrency ? "EUR" : null, explicitNoun: true, completed: completedCue(text, tokens[countIndex].start, previous),
    span: { start: tokens[countIndex].start, end: end, text: text.slice(tokens[countIndex].start, end) },
    countSpan: { start: tokens[countIndex].start, end: tokens[countIndex].end, text: tokens[countIndex].text },
    amountSpan: { start: amount.start, end: amount.end, text: text.slice(amount.start, amount.end) },
    reason: "trailing_per_installment_amount",
  });
  return true;
}

function addSeparatedPerInstallmentGroup(text, tokens, groups, countIndex, nounIndex) {
  var count = parseSlovenianNumber(tokens[countIndex] && tokens[countIndex].lower, { count: true });
  if (!Number.isInteger(count) || count < 2 || count > MAX_EVENTS) return false;
  for (var amountIndex = nounIndex + 1; amountIndex < tokens.length && amountIndex <= nounIndex + 24; amountIndex += 1) {
    var amount = numberSequence(tokens, amountIndex, false);
    if (!amount || !Number.isFinite(amount.value) || amount.value <= 0) continue;
    var cue = text.slice(tokens[nounIndex].end, amount.start);
    if (!/(?:\bvsak\w*\s+obrok\w*\b|\bznesk\w*\b|\bvišin\w*\b|\bznašal\w*\b)/u.test(cue)) continue;
    var currencyToken = tokens[amount.tokenEnd + 1];
    var hasCurrency = Boolean(currencyToken && (currencyToken.lower === "€" || /^(?:eur|evr|euro)/u.test(currencyToken.lower)));
    if (!hasCurrency && !/(?:\bznesk\w*\b|\bvišin\w*\b|\bznašal\w*\b)/u.test(cue)) continue;
    var end = hasCurrency ? currencyToken.end : amount.end;
    if (groups.some(function (group) {
      return group.countSpan.start === tokens[countIndex].start && group.amountSpan.start === amount.start;
    })) return false;
    var previous = previousGroupBefore(groups, tokens[countIndex].start);
    groups.push({
      id: null, count: count,
      amount: Math.round(amount.value * 100) / 100, total: Math.round(count * amount.value * 100) / 100,
      currency: hasCurrency ? "EUR" : null, explicitNoun: true, completed: completedCue(text, tokens[countIndex].start, previous),
      span: { start: tokens[countIndex].start, end: end, text: text.slice(tokens[countIndex].start, end) },
      countSpan: { start: tokens[countIndex].start, end: tokens[countIndex].end, text: tokens[countIndex].text },
      amountSpan: { start: amount.start, end: amount.end, text: text.slice(amount.start, amount.end) },
      reason: "separated_per_installment_amount",
    });
    return true;
  }
  return false;
}

function extractInstallmentGroups(value) {
  var text = normalizeText(value);
  var tokens = tokenize(text);
  var groups = [];
  for (var nounIndex = 1; nounIndex < tokens.length; nounIndex += 1) {
    if (!/^(?:obrok|plačil)/u.test(tokens[nounIndex].lower)) continue;
    var countIndex = nounIndex - 1;
    if (!Number.isInteger(parseSlovenianNumber(tokens[countIndex].lower, { count: true }))) continue;
    var addedWithPo = false;
    for (var searchIndex = nounIndex + 1; searchIndex < tokens.length && searchIndex <= nounIndex + 8; searchIndex += 1) {
      if (strongBoundaryBetween(text, tokens[nounIndex].end, tokens[searchIndex].start)) break;
      if (tokens[searchIndex].lower !== "po") continue;
      addedWithPo = addGroup(text, tokens, groups, countIndex, true, searchIndex);
      break;
    }
    if (!addedWithPo && !addTrailingGroup(text, tokens, groups, countIndex, nounIndex)) {
      addSeparatedPerInstallmentGroup(text, tokens, groups, countIndex, nounIndex);
    }
  }
  for (var i = 0; i < tokens.length; i += 1) {
    if (tokens[i].lower !== "po") continue;
    var immediateNounIndex = i - 1;
    var explicitNoun = immediateNounIndex >= 0 && /^(?:obrok|plačil)/u.test(tokens[immediateNounIndex].lower);
    var directCountIndex = explicitNoun ? immediateNounIndex - 1 : immediateNounIndex;
    if (directCountIndex < 0) continue;
    var added = addGroup(text, tokens, groups, directCountIndex, explicitNoun, i);
    if (!added) continue;
    var latest = groups[groups.length - 1];
    if (!explicitNoun && latest.completed !== true) groups.pop();
  }
  groups.sort(function (left, right) { return left.span.start - right.span.start; });
  groups.forEach(function (group, index) { group.id = "installment-group-" + (index + 1); });
  return groups;
}

function expandCompletedGroups(groups) {
  var amounts = [];
  (Array.isArray(groups) ? groups : []).forEach(function (group) {
    if (!group || group.completed !== true || !Number.isInteger(group.count) || group.count < 1) return;
    for (var i = 0; i < group.count && amounts.length < MAX_EVENTS; i += 1) amounts.push(group.amount);
  });
  return amounts;
}

module.exports = {
  parseSlovenianNumber: parseSlovenianNumber,
  extractInstallmentGroups: extractInstallmentGroups,
  expandCompletedGroups: expandCompletedGroups,
  normalizeText: normalizeText,
};
