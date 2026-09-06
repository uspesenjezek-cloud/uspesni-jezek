(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJAtenaCardSegments = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // Gradniki za SESTAVLJANJE novih kartic iz obstoječih, že odobrenih vizualnih
  // vzorcev NAZORJEVA — namesto da vsak nov widget piše svoj bespoke CSS.
  //
  // Pravilo: kjer že obstaja samostojen, neomejen CSS razred za ta vzorec
  // (npr. .uj-card-bullet__status, .uj-answer-card__save), ga ta modul uporabi
  // DOBESEDNO — nobenih novih razredov zanj. Nov, deljen razred (uj-card-info-box)
  // je dodan samo tam, kjer noben obstoječi samostojen vzorec ne ustreza, in je
  // namenoma splošen, da ga lahko uporabi katerakoli prihodnja sestavljena kartica,
  // ne samo ena konkretna.

  var VERSION = "atena-card-segments-v1";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char];
    });
  }

  var TONES = Object.freeze(["is-good", "is-warning", "is-bad", "is-neutral"]);
  function normalizeTone(tone) { return TONES.indexOf(tone) >= 0 ? tone : "is-good"; }

  /**
   * Velik ikonski krog na levi — EN skupni gradnik za vsako sestavljeno
   * kartico, ki potrebuje vidno ikono (namesto da vsaka kartica reši ikono
   * po svoje). "is-neutral" uporabi nevtralno teal barvo kartice namesto
   * barve tona.
   */
  function iconCircle(tone, iconSvg) {
    return '<span class="uj-card-icon-circle ' + normalizeTone(tone) + '" aria-hidden="true">' + (iconSvg || "") + '</span>';
  }

  /**
   * Statusna značka — ogrodje (obroba, barva ozadja, padding) je DOBESEDNA
   * ponovna uporaba .uj-card-bullet__status, ki je že odobrena in v
   * produkciji (widget "trend-odzivnosti"); postavitev v vrstico z velikim
   * ikonskim krogom je dodana samo za data-segment="status-badge", zato
   * obstoječa uporaba tega razreda pri widgetu 32 ostane nespremenjena.
   * @param {{tone:"is-good"|"is-warning"|"is-bad", iconSvg:string, title:string, detail:string}} opts
   */
  function statusBadge(opts) {
    opts = opts || {};
    var tone = normalizeTone(opts.tone);
    return '<div class="uj-card-bullet__status ' + tone + '" data-segment="status-badge">' +
      iconCircle(tone, opts.iconSvg) +
      '<span><b>' + esc(opts.title || "") + '</b>' + (opts.detail ? '<small>' + esc(opts.detail) + '</small>' : "") + '</span>' +
      '</div>';
  }

  /**
   * Splošen okvir z velikim ikonskim krogom, oznako (label) in besedilom.
   * Nov, a namenoma splošen razred (uj-card-info-box) — ni vezan na eno samo
   * kartico, katera koli prihodnja sestavljena kartica ga lahko uporabi.
   * @param {{iconSvg:string, label:string, text:string}} opts
   */
  function infoBox(opts) {
    opts = opts || {};
    return '<div class="uj-card-info-box" data-segment="info-box">' +
      iconCircle("is-neutral", opts.iconSvg) +
      '<div class="uj-card-info-box__content"><b>' + esc(opts.label || "") + '</b><p>' + esc(opts.text || "") + '</p></div>' +
      '</div>';
  }

  /**
   * Primarni akcijski gumb — DOBESEDNA ponovna uporaba .uj-answer-card__save,
   * samo z lastnim besedilom in ikono namesto privzetega "Shrani podatke".
   * @param {{label:string, iconSvg:string, dataAttr:string}} opts
   */
  function primaryAction(opts) {
    opts = opts || {};
    var attr = opts.dataAttr ? " " + opts.dataAttr : "";
    return '<button type="button" class="uj-answer-card__save is-saved" data-segment="primary-action"' + attr + '><span>' + esc(opts.label || "") + '</span>' + (opts.iconSvg || "") + '</button>';
  }

  // ============================================================
  // OD TU NAPREJ: razširitev na uporabnikovo izrecno zahtevo (2026-09-04),
  // da lahko sestavljam nove kartice iz VEČ atomarnih vrstic iz registra
  // (NAZORJEVA-VRSTICE.js), ne le treh gradnikov zgoraj. Vsaka funkcija
  // spodaj je DOBESEDNA ponovna uporaba že odobrenega CSS razreda za to
  // vrstico (glej komentar pri vsaki), parametrizirana z resnično vsebino.
  // Edina genuina novost je stepHeader() — noben obstoječi widget nima
  // SKUPNEGA razreda zanj (vsak ga scopa posebej, npr.
  // .uj-card-provenance__step > h3), zato dodaja EN nov, namenoma splošen
  // razred (.uj-card-step-header) — enako pravilo kot pri info-box zgoraj.
  // ============================================================

  /**
   * Oznaka + poljubna vsebina — dobesedna ponovna uporaba vrstice 9
   * (field-z-oznako, .uj-card-field + .uj-card-label).
   * @param {{label:string, contentHtml:string}} opts
   */
  function fieldLabel(opts) {
    opts = opts || {};
    return '<div class="uj-card-field" data-segment="field-label"><span class="uj-card-label">' + esc(opts.label || "") + '</span>' + (opts.contentHtml || "") + '</div>';
  }

  /**
   * Skupina izbirnih gumbov — dobesedna ponovna uporaba vrstice 10
   * (skupina-izbirnih-gumbov, .uj-card-choices).
   * @param {{options:Array<{id:string,label:string,selected?:boolean}>, threeColumn?:boolean, groupLabel?:string}} opts
   */
  function choiceGroup(opts) {
    opts = opts || {};
    var options = Array.isArray(opts.options) ? opts.options : [];
    var cls = "uj-card-choices" + (opts.threeColumn !== false ? " uj-card-choices--three" : "");
    var buttons = options.map(function (option) {
      var selected = Boolean(option.selected);
      return '<button type="button" data-card-choice="' + esc(option.id) + '" aria-pressed="' + (selected ? "true" : "false") + '" class="' + (selected ? "is-selected" : "") + '"><span>' + esc(option.label) + '</span></button>';
    }).join("");
    return '<div class="' + cls + '" data-card-choice-group data-segment="choice-group"' + (opts.groupLabel ? ' role="group" aria-label="' + esc(opts.groupLabel) + '"' : "") + '>' + buttons + '</div>';
  }

  /**
   * Denarno polje — dobesedna ponovna uporaba vrstice 12 (denarno-polje,
   * .uj-card-money), ikona identična že odobrenemu widgetu "natancen-znesek".
   * @param {{value:string|number, unit?:string, ariaLabel?:string}} opts
   */
  function moneyField(opts) {
    opts = opts || {};
    var unit = opts.unit || "€";
    return '<label class="uj-card-money" data-segment="money-field"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span><input type="text" inputmode="decimal" value="' + esc(opts.value == null ? "" : opts.value) + '" aria-label="' + esc(opts.ariaLabel || "Znesek") + '"><b>' + esc(unit) + '</b></label>';
  }

  /**
   * Minus/vnos/plus/enota — dobesedna ponovna uporaba vrstice 13
   * (stepper-nadzor, .uj-card-stepper).
   * @param {{value:number, unit?:string, ariaLabel?:string}} opts
   */
  function stepper(opts) {
    opts = opts || {};
    return '<div class="uj-card-stepper" data-card-stepper data-segment="stepper"><button type="button" data-step="-1" aria-label="Zmanjšaj"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/></svg></button><input type="number" value="' + esc(opts.value == null ? "" : opts.value) + '" aria-label="' + esc(opts.ariaLabel || "Vrednost") + '">' + (opts.unit ? '<select aria-label="Enota"><option selected>' + esc(opts.unit) + '</option></select>' : '<span></span>') + '<button type="button" data-step="1" aria-label="Povečaj"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>';
  }

  /**
   * Živa vrstica povzetka — dobesedna ponovna uporaba vrstice 5
   * (živa-vrstica-povzetka, .uj-card-live).
   * @param {{tone:"is-good"|"is-warning"|"is-bad", text:string}} opts
   */
  function liveSummary(opts) {
    opts = opts || {};
    var tone = normalizeTone(opts.tone);
    return '<p class="uj-card-live ' + tone + '" data-segment="live-summary" aria-live="polite">' + esc(opts.text || "") + '</p>';
  }

  /**
   * Gumb za ponastavitev — dobesedna ponovna uporaba vrstice 6
   * (gumb-ponastavi, .uj-card-reset).
   * @param {{label?:string}} opts
   */
  function resetButton(opts) {
    opts = opts || {};
    return '<button type="button" class="uj-card-reset" data-card-reset data-segment="reset-button"><span aria-hidden="true">↺</span> ' + esc(opts.label || "Ponastavi") + '</button>';
  }

  /**
   * Oštevilčen naslov koraka — NOV, namenoma splošen razred
   * (.uj-card-step-header), ker noben obstoječi widget nima skupnega
   * razreda zanj (vsak ga scopa posebej: .uj-card-provenance__step > h3,
   * .uj-card-cascade__step ...) — glej vrstico 26 v registru.
   * @param {{number:number|string, text:string}} opts
   */
  function stepHeader(opts) {
    opts = opts || {};
    return '<h3 class="uj-card-step-header" data-segment="step-header"><span>' + esc(opts.number == null ? "" : opts.number) + '</span>' + esc(opts.text || "") + '</h3>';
  }

  /**
   * SPAJANJE: združi poljubno število že izrisanih delov (izhod zgornjih
   * funkcij, v poljubnem vrstnem redu in številu) v eno kartico. To je
   * mehanizem, ki omogoča, da vsaka kartica uporabi TOČNO toliko vrstic,
   * kolikor jih potrebuje (2 ali 10) — ne fiksne oblike.
   * @param {string[]} deli - HTML nizi v vrstnem redu prikaza
   * @param {{extraClass?:string, dataAttrs?:Object<string,string>}} opts
   */
  function sestaviKartico(deli, opts) {
    opts = opts || {};
    var seznam = Array.isArray(deli) ? deli : [];
    var attrs = opts.dataAttrs || {};
    var attrString = Object.keys(attrs).map(function (key) {
      return ' ' + key + '="' + esc(attrs[key]) + '"';
    }).join("");
    var cls = "uj-card-composed" + (opts.extraClass ? " " + opts.extraClass : "");
    return '<div class="' + cls + '"' + attrString + '>' + seznam.join("") + '</div>';
  }

  return Object.freeze({
    version: VERSION,
    statusBadge: statusBadge,
    infoBox: infoBox,
    primaryAction: primaryAction,
    fieldLabel: fieldLabel,
    choiceGroup: choiceGroup,
    moneyField: moneyField,
    stepper: stepper,
    liveSummary: liveSummary,
    resetButton: resetButton,
    stepHeader: stepHeader,
    sestaviKartico: sestaviKartico
  });
});
