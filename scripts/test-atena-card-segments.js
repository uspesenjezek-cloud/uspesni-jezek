"use strict";

var assert = require("node:assert");
var segments = require("../app/atena-card-segments");

var stevilo = 0;
function test(ime, fn) {
  fn();
  stevilo += 1;
  console.log("  OK  " + ime);
}

test("T1: fieldLabel ovije vsebino z oznako (vrstica 9)", function () {
  var html = segments.fieldLabel({ label: "Osnovna cena", contentHtml: "<b>1.342 €</b>" });
  assert.ok(html.indexOf('class="uj-card-field"') >= 0);
  assert.ok(html.indexOf('class="uj-card-label"') >= 0);
  assert.ok(html.indexOf("Osnovna cena") >= 0);
  assert.ok(html.indexOf("<b>1.342 €</b>") >= 0);
});

test("T2: choiceGroup izriše gumbe, pravilno označi izbranega (vrstica 10)", function () {
  var html = segments.choiceGroup({
    options: [{ id: "a", label: "Da" }, { id: "b", label: "Ne", selected: true }],
    groupLabel: "Ali se strinjate?"
  });
  assert.ok(html.indexOf('data-card-choice="a"') >= 0);
  assert.ok(html.indexOf('data-card-choice="b"') >= 0);
  assert.ok(html.indexOf('aria-label="Ali se strinjate?"') >= 0);
  var bIndex = html.indexOf('data-card-choice="b"');
  var bButton = html.slice(bIndex - 60, bIndex + 80);
  assert.ok(bButton.indexOf("is-selected") >= 0, "izbrani gumb mora imeti is-selected");
});

test("T3: moneyField prikaže vrednost in enoto (vrstica 12)", function () {
  var html = segments.moneyField({ value: "1.500", unit: "€" });
  assert.ok(html.indexOf('class="uj-card-money"') >= 0);
  assert.ok(html.indexOf('value="1.500"') >= 0);
  assert.ok(html.indexOf("<b>€</b>") >= 0);
});

test("T4: stepper prikaže vrednost in enoto (vrstica 13)", function () {
  var html = segments.stepper({ value: 4, unit: "obroki" });
  assert.ok(html.indexOf('data-card-stepper') >= 0);
  assert.ok(html.indexOf('value="4"') >= 0);
  assert.ok(html.indexOf("obroki") >= 0);
});

test("T5: liveSummary uporabi pravilen ton (vrstica 5)", function () {
  var html = segments.liveSummary({ tone: "is-bad", text: "Pod mejo ne bomo šli." });
  assert.ok(html.indexOf('class="uj-card-live is-bad"') >= 0);
  assert.ok(html.indexOf('aria-live="polite"') >= 0);
  assert.ok(html.indexOf("Pod mejo ne bomo šli.") >= 0);
});

test("T6: resetButton ima privzeto besedilo 'Ponastavi' (vrstica 6)", function () {
  var html = segments.resetButton({});
  assert.ok(html.indexOf("Ponastavi") >= 0);
  assert.ok(html.indexOf('class="uj-card-reset"') >= 0);
});

test("T7: stepHeader oštevilči korak (nov, splošen gradnik)", function () {
  var html = segments.stepHeader({ number: 1, text: "Izberite cilj" });
  assert.ok(html.indexOf('class="uj-card-step-header"') >= 0);
  assert.ok(html.indexOf("<span>1</span>") >= 0);
  assert.ok(html.indexOf("Izberite cilj") >= 0);
});

test("T8: sestaviKartico spoji poljubno število delov (2 dela)", function () {
  var html = segments.sestaviKartico([
    segments.fieldLabel({ label: "Cilj", contentHtml: segments.moneyField({ value: "415" }) }),
    segments.resetButton({})
  ]);
  assert.ok(html.indexOf('class="uj-card-composed"') >= 0);
  assert.ok(html.indexOf("Cilj") >= 0);
  assert.ok(html.indexOf("Ponastavi") >= 0);
});

test("T9: sestaviKartico spoji večje število delov (5), vrstni red ohranjen", function () {
  var deli = [
    segments.stepHeader({ number: 1, text: "Korak ena" }),
    segments.choiceGroup({ options: [{ id: "x", label: "X", selected: true }] }),
    segments.stepHeader({ number: 2, text: "Korak dva" }),
    segments.moneyField({ value: "100" }),
    segments.liveSummary({ tone: "is-good", text: "Vse pripravljeno." })
  ];
  var html = segments.sestaviKartico(deli, { dataAttrs: { "data-finding": "primer" } });
  assert.ok(html.indexOf('data-finding="primer"') >= 0);
  var indexKorak1 = html.indexOf("Korak ena");
  var indexKorak2 = html.indexOf("Korak dva");
  var indexPovzetek = html.indexOf("Vse pripravljeno.");
  assert.ok(indexKorak1 < indexKorak2 && indexKorak2 < indexPovzetek, "vrstni red delov mora biti ohranjen");
});

test("T10: vse funkcije pravilno pobegnejo (escape) HTML v vsebini", function () {
  var html = segments.fieldLabel({ label: '<script>alert(1)</script>', contentHtml: "" });
  assert.ok(html.indexOf("<script>alert") < 0, "oznaka ne sme vsebovati neubežanega HTML");
  assert.ok(html.indexOf("&lt;script&gt;") >= 0);
});

console.log("Atena card segments (razširjen engine): OK (" + stevilo + " testov)");
