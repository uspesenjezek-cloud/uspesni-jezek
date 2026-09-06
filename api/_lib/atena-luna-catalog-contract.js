"use strict";

var semanticLexicon = require("./atena-luna-semantic-lexicon");

/*
 * Skupna predstavitev Ateninih kartic Luni.
 *
 * Ta modul ne razlaga uporabnikovega besedila in ne izbira kartice. Njegova
 * edina naloga je, da vsak semantični motor Luni pošlje popoln, enako oblikovan
 * katalog: kaj kartica pomeni, kdaj se uporabi, kdaj se ne uporabi ter katera
 * polja in vrednosti so na njej na voljo.
 */

function buildCardGuide(cards, fields, values, options) {
  options = options || {};
  return Object.freeze((cards || []).map(function (card) {
    var languageProfile = semanticLexicon.getProfile(options.flow, card.key);
    if (!languageProfile) throw new Error("ATENA_LANGUAGE_PROFILE_MISSING:" + String(options.flow || "unknown") + ":" + String(card.key || "unknown"));
    var fieldIds = Object.freeze((card.fieldIds || []).map(Number));
    var required = new Set((card.requiredFieldIds || []).map(Number));
    return Object.freeze({
      cardId: Number(card.cardId),
      key: card.key,
      title: card.title,
      useWhen: card.useWhen,
      doNotUseWhen: card.doNotUseWhen,
      examples: Object.freeze((card.examples || []).slice()),
      languageProfile: languageProfile,
      fieldIds: fieldIds,
      requiredFieldIds: Object.freeze(fieldIds.filter(function (fieldId) { return required.has(fieldId); })),
    });
  }));
}

module.exports = {
  buildCardGuide: buildCardGuide,
  LEXICON_VERSION: semanticLexicon.VERSION,
  languagePolicy: semanticLexicon.languagePolicy,
  semanticInstructions: semanticLexicon.semanticInstructions,
};
