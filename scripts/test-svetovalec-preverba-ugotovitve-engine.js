"use strict";
const assert = require("node:assert/strict");
const engine = require("../app/svetovalec-preverba-ugotovitve-engine");

assert.equal(engine.version, "svetovalec-preverba-ugotovitve-v1");

// T1 — prazen vhod: brez ugotovitev, izid A.
(function () {
  const r = engine.izracunajUgotovitve([]);
  assert.deepEqual(r.ugotovitve, []);
  assert.equal(r.glavniIzid.koda, "A");
  assert.deepEqual(r.vprasanjaZaPonudnika, []);
})();

// T2 — neznan fieldId se ignorira, ne ustvari ugotovitve.
(function () {
  const r = engine.izracunajUgotovitve([{ fieldId: 9999, value: "karkoli", evidence: "x" }]);
  assert.deepEqual(r.ugotovitve, []);
  assert.equal(r.glavniIzid.koda, "A");
})();

// T3 — "ni navedeno" / prazna vrednost na znanem field ne ustvari ugotovitve.
(function () {
  const r = engine.izracunajUgotovitve([{ fieldId: 5403, value: "Ni navedeno", evidence: "x" }]);
  assert.deepEqual(r.ugotovitve, []);
  assert.equal(r.glavniIzid.koda, "A");
})();

// T4 — jasna cena/majhen delež predplačila -> opozorilo, izid A (visoka pomembnost NE blokira sama po sebi).
(function () {
  const r = engine.izracunajUgotovitve([{ fieldId: 5303, value: "20 % ob podpisu", evidence: "20% ob podpisu" }]);
  assert.equal(r.ugotovitve.length, 1);
  assert.equal(r.ugotovitve[0].potrebnostUkrepanja, "opozorilo");
  assert.equal(r.glavniIzid.koda, "A");
})();

// T5 — 100-odstotno predplačilo -> ugotovitev visoke pomembnosti, ne-podpisujte, izid C.
(function () {
  const r = engine.izracunajUgotovitve([{ fieldId: 5303, value: "100 % vnaprej", evidence: "100% vnaprej" }]);
  assert.equal(r.ugotovitve.length, 1);
  assert.equal(r.ugotovitve[0].pomembnost, "visoka");
  assert.equal(r.ugotovitve[0].potrebnostUkrepanja, "ne-podpisujte-pred-razjasnitvijo");
  assert.equal(r.glavniIzid.koda, "C");
  assert.equal(r.vprasanjaZaPonudnika.length, 1);
  assert.equal(r.vprasanjaZaPonudnika[0].fieldId, 5303);
})();

// T6 — jasno samodejno podaljšanje samo po sebi ne blokira izida A (samo opozorilo).
(function () {
  const r = engine.izracunajUgotovitve([{ fieldId: 5403, value: "Podaljša se za 12 mesecev, če ni odpovedi 60 dni prej.", evidence: "x" }]);
  assert.equal(r.ugotovitve.length, 1);
  assert.equal(r.ugotovitve[0].potrebnostUkrepanja, "opozorilo");
  assert.equal(r.glavniIzid.koda, "A");
})();

// T7 — visoka pogodbena kazen (zamudne obresti >=1% dnevno) -> izid D, pravna meja "potreben-pravni-pregled".
(function () {
  const r = engine.izracunajUgotovitve([{ fieldId: 5306, value: "2 % dnevno od zapadlega zneska", evidence: "2% dnevno" }]);
  assert.equal(r.ugotovitve.length, 1);
  assert.equal(r.ugotovitve[0].potrebnostUkrepanja, "potreben-strokovni-pregled");
  assert.equal(r.ugotovitve[0].pravnaMeja, "potreben-pravni-pregled");
  assert.equal(r.glavniIzid.koda, "D");
})();

// T8 — kombinacija ene "ne-podpisujte" in ene "strokovni-pregled" ugotovitve -> glavni izid C, D kot dodatno priporočilo.
// Preverja pravilo prednosti: C vedno prevlada nad D, ne glede na vrstni red vhoda.
(function () {
  const r = engine.izracunajUgotovitve([
    { fieldId: 5303, value: "100 % vnaprej", evidence: "100% vnaprej" },
    { fieldId: 5306, value: "3 % dnevno", evidence: "3% dnevno" }
  ]);
  assert.equal(r.glavniIzid.koda, "C");
  assert.equal(r.glavniIzid.dodatnaPriporocila.length, 1);
  assert.ok(r.glavniIzid.dodatnaPriporocila[0].indexOf("strokovnjak") >= 0);
})();

// T9 — ena resna ugotovitev (razjasnite) med sicer informativnimi/opozorilnimi -> izid B, ne A.
// Preverja, da se izid določa po najvišji potrebnosti ukrepanja, ne po številu ugotovitev.
(function () {
  const r = engine.izracunajUgotovitve([
    { fieldId: 5307, value: "10 % zadržanega zneska do prevzema", evidence: "x" }, // opozorilo
    { fieldId: 5609, value: "500 EUR ob predčasnem izstopu", evidence: "x" } // razjasnite
  ]);
  assert.equal(r.glavniIzid.koda, "B");
  assert.equal(r.glavniIzid.najvisjaPotrebnost, "razjasnite-pred-odlocitvijo");
})();

// T10 — čista funkcija: enak vhod vedno vrne enak rezultat (Preverba in Svetovalec
// bi za isti nabor dejstev morala dobiti identičen rezultat, ker gre za isto jedro).
(function () {
  const facts = [{ fieldId: 5303, value: "100 % vnaprej", evidence: "100% vnaprej" }];
  const r1 = engine.izracunajUgotovitve(facts);
  const r2 = engine.izracunajUgotovitve(facts);
  assert.deepEqual(r1, r2);
})();

// T11 — jasno navedeno lastništvo pri naročniku -> samo informacija, ne razjasnite.
(function () {
  const r = engine.izracunajUgotovitve([{ fieldId: 5408, value: "Vse datoteke in dostopi ostanejo vam.", evidence: "x" }]);
  assert.equal(r.ugotovitve[0].potrebnostUkrepanja, "samo-informacija");
  assert.equal(r.glavniIzid.koda, "A");
})();

// T12 — nejasno lastništvo (ne omenja naročnika) -> razjasnite, z vprašanjem za ponudnika.
(function () {
  const r = engine.izracunajUgotovitve([{ fieldId: 5408, value: "Dostopi ostanejo pri izvajalcu.", evidence: "x" }]);
  assert.equal(r.ugotovitve[0].potrebnostUkrepanja, "razjasnite-pred-odlocitvijo");
  assert.equal(r.glavniIzid.koda, "B");
  assert.ok(r.vprasanjaZaPonudnika.length >= 1);
})();

// T13 — regresija: "dnevno" ne sme biti napačno prepoznano kot prazno/negativno polje
// samo zato, ker vsebuje podniz "ne" (dNEvno). Enako za "mojster" in besedo "moj".
(function () {
  const r = engine.izracunajUgotovitve([{ fieldId: 5306, value: "3 % dnevno", evidence: "3% dnevno" }]);
  assert.equal(r.ugotovitve.length, 1, "polje z besedo 'dnevno' se ne sme obravnavati kot prazno");
  assert.equal(r.ugotovitve[0].potrebnostUkrepanja, "potreben-strokovni-pregled");
})();
(function () {
  const r = engine.izracunajUgotovitve([{ fieldId: 5408, value: "Dostope obdrži mojster kot izvajalec.", evidence: "x" }]);
  assert.equal(r.ugotovitve.length, 1);
  assert.equal(r.ugotovitve[0].potrebnostUkrepanja, "razjasnite-pred-odlocitvijo", "'mojster' se ne sme napačno prepoznati kot 'moj' (naročnikovo lastništvo)");
})();

console.log("test-svetovalec-preverba-ugotovitve-engine.js OK (" + 14 + " preverb)");
