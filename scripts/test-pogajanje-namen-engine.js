"use strict";

var assert = require("node:assert");
var engine = require("../app/pogajanje-namen-engine");

var stevilo = 0;
function test(ime, fn) {
  fn();
  stevilo += 1;
  console.log("  OK  " + ime);
}

// T1: uporabnikov lasten primer iz pogovora — mora prepoznati znizanje-stroska.
test("T1: prepozna 'preveč mi računajo za naročnino' kot znižanje stroška", function () {
  var besedilo = "veste kaj... preveč mi raunajo za naročnino za telefon dejte preverte cene, dejte prevert konkurenco in povejte če dobite nizjo ceno in sporočite";
  var rezultat = engine.prepoznajNamen(besedilo);
  assert.strictEqual(rezultat.namen, engine.NAMEN.ZNIZANJE_STROSKA);
  assert.ok(rezultat.zaupanje > 0, "zaupanje mora biti > 0");
});

test("T2: prepozna brez šumnikov ('narocnina', 'znizajte')", function () {
  var rezultat = engine.prepoznajNamen("Prosim znizajte narocnino, je predrago.");
  assert.strictEqual(rezultat.namen, engine.NAMEN.ZNIZANJE_STROSKA);
});

test("T3: prazno besedilo -> neznan namen, zaupanje 0", function () {
  var rezultat = engine.prepoznajNamen("");
  assert.strictEqual(rezultat.namen, engine.NAMEN.NEZNAN);
  assert.strictEqual(rezultat.zaupanje, 0);
});

test("T4: nepovezano besedilo -> neznan namen", function () {
  var rezultat = engine.prepoznajNamen("Kdaj se vidiva jutri za kosilo?");
  assert.strictEqual(rezultat.namen, engine.NAMEN.NEZNAN);
});

test("T5: nacrtujPogovor za znizanje-stroska vrne neprazen, urejen seznam", function () {
  var nacrt = engine.nacrtujPogovor(engine.NAMEN.ZNIZANJE_STROSKA);
  assert.ok(nacrt.length >= 5, "načrt mora imeti vsaj 5 kartičnih namenov");
  assert.strictEqual(nacrt[0].id, "trenutno-stanje", "prvi korak mora biti pregled trenutnega stanja");
  nacrt.forEach(function (korak) {
    assert.ok(korak.id && korak.naslov && korak.vir, "vsak korak mora imeti id, naslov in vir");
  });
});

test("T6: nacrtujPogovor za neznan namen vrne prazen seznam (ne izmišlja kartic)", function () {
  var nacrt = engine.nacrtujPogovor(engine.NAMEN.NEZNAN);
  assert.strictEqual(nacrt.length, 0);
});

test("T7: nacrtujIzBesedila kombinira oba koraka v enem klicu", function () {
  var rezultat = engine.nacrtujIzBesedila("Preverite konkurenco za mojo narocnino.");
  assert.strictEqual(rezultat.namen, engine.NAMEN.ZNIZANJE_STROSKA);
  assert.ok(rezultat.nacrt.length > 0);
});

test("T8: vsi objekti so zamrznjeni (Object.freeze) — ni naključnih mutacij", function () {
  var nacrt = engine.nacrtujPogovor(engine.NAMEN.ZNIZANJE_STROSKA);
  assert.ok(Object.isFrozen(nacrt));
  assert.ok(Object.isFrozen(nacrt[0]));
});

test("T9: determinizem — isti vnos vedno vrne isti rezultat", function () {
  var a = engine.nacrtujIzBesedila("Prosim znizajte narocnino.");
  var b = engine.nacrtujIzBesedila("Prosim znizajte narocnino.");
  assert.deepStrictEqual(a.namen, b.namen);
  assert.strictEqual(a.nacrt.length, b.nacrt.length);
});

console.log("Pogajanje namen engine: OK (" + stevilo + " testov)");
