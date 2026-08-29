"use strict";

var WORD_VALUES = Object.freeze({
  nic: 0, "nič": 0,
  en: 1, ena: 1, eno: 1, enega: 1, enem: 1, enim: 1,
  dva: 2, dve: 2, dveh: 2, dvema: 2,
  tri: 3, treh: 3, trem: 3, tremi: 3,
  "štiri": 4, "štirje": 4, "štirih": 4, "štirim": 4, "štirimi": 4,
  pet: 5, petih: 5, petim: 5, petimi: 5,
  "šest": 6, "šestih": 6, "šestim": 6, "šestimi": 6,
  sedem: 7, sedmih: 7, sedmim: 7, sedmimi: 7,
  osem: 8, osmih: 8, osmim: 8, osmimi: 8,
  devet: 9, devetih: 9, devetim: 9, devetimi: 9,
  deset: 10, desetih: 10, desetim: 10, desetimi: 10,
  enajst: 11, enajstih: 11, dvanajst: 12, dvanajstih: 12,
  trinajst: 13, trinajstih: 13, "štirinajst": 14, "štirinajstih": 14,
  petnajst: 15, petnajstih: 15, "šestnajst": 16, "šestnajstih": 16,
  sedemnajst: 17, sedemnajstih: 17, osemnajst: 18, osemnajstih: 18,
  devetnajst: 19, devetnajstih: 19,
  dvajset: 20, dvajsetih: 20, trideset: 30, tridesetih: 30,
  "štirideset": 40, "štiridesetih": 40, petdeset: 50, petdesetih: 50,
  "šestdeset": 60, "šestdesetih": 60, sedemdeset: 70, sedemdesetih: 70,
  osemdeset: 80, osemdesetih: 80, devetdeset: 90, devetdesetih: 90,
  dvesto: 200, dvestotih: 200, tristo: 300, tristotih: 300,
  "štiristo": 400, "štiristotih": 400, petsto: 500, petstotih: 500,
  "šeststo": 600, "šeststotih": 600, sedemsto: 700, sedemstotih: 700,
  osemsto: 800, osemstotih: 800, devetsto: 900, devetstotih: 900,
});

var THOUSAND_WORDS = new Set([
  "tisoč", "tisoča", "tisoču", "tisočem", "tisočih", "tisočaka", "tisočakov",
  "jur", "jurja", "jurju", "jurjev",
]);
var HUNDRED_WORDS = new Set(["sto", "stotih", "stotim", "stotimi"]);

var DIGIT_TOKEN_SOURCE = "(?:\\d{1,3}(?:[.\\s]\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)";
var BASIC_WORD_TOKEN_SOURCE = "(?:nič|nic|en(?:a|o|ega|em|im)?|dve(?:h|ma)?|dva|tri|treh|trem|tremi|štiri|štirje|štirih|štirim|štirimi|pet(?:ih|im|imi)?|šest(?:ih|im|imi)?|sedem|sedmih|sedmim|sedmimi|osem|osmih|osmim|osmimi|devet(?:ih|im|imi)?|deset(?:ih|im|imi)?|enajst(?:ih)?|dvanajst(?:ih)?|trinajst(?:ih)?|štirinajst(?:ih)?|petnajst(?:ih)?|šestnajst(?:ih)?|sedemnajst(?:ih)?|osemnajst(?:ih)?|devetnajst(?:ih)?|dvajset(?:ih)?|trideset(?:ih)?|štirideset(?:ih)?|petdeset(?:ih)?|šestdeset(?:ih)?|sedemdeset(?:ih)?|osemdeset(?:ih)?|devetdeset(?:ih)?|(?:ena|en|dva|dve|tri|štiri|pet|šest|sedem|osem|devet)in(?:dvajset|trideset|štirideset|petdeset|šestdeset|sedemdeset|osemdeset|devetdeset)(?:ih)?|(?:dve|tri|štiri|pet|šest|sedem|osem|devet)sto(?:tih)?|sto|stotih|stotim|stotimi|tisoč(?:a|u|em|ih|aka|akov)?|jur(?:ja|ju|jev)?)";
var CURRENCY_SOURCE = "(?:€|eur(?:ov|a|i|om|ih)?|evr(?:ov|a|i|om|ih)?|eurov?)";
var NUMBER_TERMINATOR_SOURCE = "(?:(?![\\p{L}\\d])|(?=" + CURRENCY_SOURCE + "(?=\\s|$|[.,;!?])))";
var NUMBER_EXPRESSION_SOURCE = "(?<![\\p{L}\\d])(?:" + DIGIT_TOKEN_SOURCE + "(?:[ \\t-]+(?:" + DIGIT_TOKEN_SOURCE + "|" + BASIC_WORD_TOKEN_SOURCE + ")){0,5}|" + BASIC_WORD_TOKEN_SOURCE + "(?:[ \\t-]+(?:" + DIGIT_TOKEN_SOURCE + "|" + BASIC_WORD_TOKEN_SOURCE + ")){0,5})" + NUMBER_TERMINATOR_SOURCE;

function normalizeText(value) {
  return String(value == null ? "" : value).toLowerCase().normalize("NFC").replace(/\s+/gu, " ").trim();
}

function parseDigit(value, countMode) {
  var text = String(value || "").toLowerCase();
  if (countMode) text = text.replace(/-?(?:ih|eh|h)$/u, "");
  if (/^\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?$/u.test(text)) return Number(text.replace(/[.\s]/gu, "").replace(",", "."));
  if (/^\d+(?:[.,]\d+)?$/u.test(text)) return Number(text.replace(",", "."));
  return null;
}

function compoundValue(word) {
  var normalized = word.replace(/ih$/u, "");
  var match = normalized.match(/^(ena|en|dva|dve|tri|štiri|pet|šest|sedem|osem|devet)in(dvajset|trideset|štirideset|petdeset|šestdeset|sedemdeset|osemdeset|devetdeset)$/u);
  if (!match) return null;
  return WORD_VALUES[match[1]] + WORD_VALUES[match[2]];
}

function parseSlovenianNumber(value, options) {
  var countMode = Boolean(options && options.count);
  var text = normalizeText(value).replace(/-/gu, " ");
  var digit = parseDigit(text, countMode);
  if (Number.isFinite(digit)) return digit;
  var words = text.split(/\s+/u).filter(Boolean);
  if (!words.length) return null;
  var total = 0;
  var current = 0;
  for (var i = 0; i < words.length; i += 1) {
    var word = words[i];
    if (THOUSAND_WORDS.has(word)) {
      total += (current || 1) * 1000;
      current = 0;
      continue;
    }
    if (HUNDRED_WORDS.has(word)) {
      current = current > 0 && current < 10 ? current * 100 : current + 100;
      continue;
    }
    var partDigit = parseDigit(word, countMode);
    if (Number.isFinite(partDigit)) {
      if (!Number.isInteger(partDigit) && words.length > 1) return null;
      current += partDigit;
      continue;
    }
    var direct = Object.prototype.hasOwnProperty.call(WORD_VALUES, word) ? WORD_VALUES[word] : compoundValue(word);
    if (!Number.isFinite(direct)) return null;
    current += direct;
  }
  return total + current;
}

function sourceSpan(text, start, end) {
  return { start: start, end: end, text: text.slice(start, end) };
}

function numberRole(text, start, end, options) {
  var raw = text.slice(start, end);
  var before = text.slice(Math.max(0, start - 55), start);
  var after = text.slice(end, Math.min(text.length, end + 55));
  var immediateBefore = before.slice(-28);
  var immediateAfter = after.slice(0, 28);
  var currencyBefore = new RegExp(CURRENCY_SOURCE + "\\s*$", "iu").test(immediateBefore);
  var currencyAfter = new RegExp("^\\s*" + CURRENCY_SOURCE + "(?=\\s|$|[.,;!?])", "iu").test(immediateAfter);
  if (currencyBefore || currencyAfter) return "money";
  if (/^\s*(?:%|odstot\w*|procent\w*)(?=\s|$|[.,;!?])/iu.test(immediateAfter)) return "percent";
  if (/^\s*[.\/-]\s*\d/u.test(immediateAfter) || /\d\s*[.\/-]\s*$/u.test(immediateBefore) || /^\s*-\s*\d{1,2}\s*-\s*\d{1,4}\b/u.test(immediateAfter)) return "date";
  if (/\b(?:pred|čez)\s*$/iu.test(immediateBefore) && /^\s*(?:dnev\w*|dni|tedn\w*|mesec\w*|let\w*)\b/iu.test(immediateAfter)) return "date";
  if (/\b(?:leta|leto)\s*$/iu.test(immediateBefore) && /^\s*(?:19|20)\d{2}\b/u.test(raw)) return "date";
  if (/^\s*\.\s*[\p{L}]/iu.test(immediateAfter)) return "ordinal";
  if (/^\s*(?:(?:-?(?:h|ih|eh))?\s*(?:obrok\w*|plačil\w*|ponovitev\w*)|-?\s*krat)\b/iu.test(immediateAfter)) return "count";
  if (/\b(?:račun|faktur\w*|invoice)(?:\s+(?:št\.?|st\.?|številk\w*))?\s*[:#-]?\s*$/iu.test(immediateBefore) && !/\b(?:za|v\s+(?:višini|vrednosti|znesku))\s*$/iu.test(immediateBefore)) return "reference";
  if (/\b(?:št\.?|st\.?|številk\w*|sklic)\s*[:#-]?\s*$/iu.test(immediateBefore)) return "reference";
  if (/\bpo\s*$/iu.test(immediateBefore)) return "money";
  if (/\b(?:dobropis\w*|pobot\w*|kompenz\w*|ugovarj\w*|ugovor\w*|račun\w*|terjatev\w*)[^.!?;]{0,35}\b(?:za|v\s+(?:višini|vrednosti|znesku))\s*$/iu.test(before)) return "money";
  var moneyBefore = /\b(?:plačal\w*|plačan\w*|poravnal\w*|poravnan\w*|nakazal\w*|nakazil\w*|dal\w*|prejel\w*|dobropis\w*|pobot\w*|kompenz\w*|obljub\w*|ugovarj\w*|ugovor\w*|plačati|poravnati|nakazati|preostanek|preostalo|dolguje\w*|dolžan\w*|dolžna\w*|znaša\w*|znesek|zneska|terjatev|plačilo|nakazilo|račun|faktur\w*)(?:\s+(?:je|so|sem|smo|pa|še|samo|le|zgolj|skupaj|za|v|višini|vrednosti|znesku|bil\w*|izdan\w*|izveden\w*)){0,5}\s*$/iu.test(before);
  var moneyAfter = /^\s*(?:(?:je|so|pa|še|bil\w*|bila|bilo|kot|v|za|izdan\w*|izveden\w*)\s+){0,4}(?:plačal\w*|poravnal\w*|nakazal\w*|dobropis\w*|pobot\w*|kompenz\w*|preostanek|dolga|terjatve)\b/iu.test(after);
  if (moneyBefore || moneyAfter) return "money";
  return options && options.defaultRole || "number";
}

function extractNumberExpressions(value, options) {
  var text = String(value == null ? "" : value).toLowerCase().normalize("NFC");
  var expression = new RegExp(NUMBER_EXPRESSION_SOURCE, "giu");
  var found = [];
  var match;
  while ((match = expression.exec(text))) {
    var raw = match[0];
    var valueNumber = parseSlovenianNumber(raw, options);
    if (!Number.isFinite(valueNumber)) continue;
    var start = match.index;
    var end = start + raw.length;
    var role = numberRole(text, start, end, options);
    var currencyBefore = new RegExp(CURRENCY_SOURCE + "\\s*$", "iu").test(text.slice(Math.max(0, start - 14), start));
    var currencyAfter = new RegExp("^\\s*" + CURRENCY_SOURCE + "(?=\\s|$|[.,;!?])", "iu").test(text.slice(end, Math.min(text.length, end + 18)));
    found.push({
      value: valueNumber, role: role, currency: currencyBefore || currencyAfter ? "EUR" : null,
      explicit: true, confidence: "high", evidence: sourceSpan(text, start, end),
      reason: role === "money" ? "semantic_money_expression" : "non_money_number_expression",
    });
    if (match[0].length === 0) expression.lastIndex += 1;
  }
  return found;
}

module.exports = {
  WORD_VALUES: WORD_VALUES,
  NUMBER_EXPRESSION_SOURCE: NUMBER_EXPRESSION_SOURCE,
  CURRENCY_SOURCE: CURRENCY_SOURCE,
  parseSlovenianNumber: parseSlovenianNumber,
  extractNumberExpressions: extractNumberExpressions,
  normalizeText: normalizeText,
};
