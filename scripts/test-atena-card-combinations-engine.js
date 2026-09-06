"use strict";

var assert = require("node:assert/strict");
var engine = require("../app/atena-card-combinations-engine");
var register = require("../app/atena-card-combinations");
var definicija = register.preberi("pogodbe-stej-ponovi-sestej");
var stevilo = 0;

function globokoZamrzni(vrednost) {
  if (!vrednost || typeof vrednost !== "object" || Object.isFrozen(vrednost)) return vrednost;
  Object.keys(vrednost).forEach(function (kljuc) { globokoZamrzni(vrednost[kljuc]); });
  return Object.freeze(vrednost);
}

function test(ime, fn) {
  fn();
  stevilo += 1;
  console.log("  OK  " + ime);
}

function nastaviStevilo(stanje, value) {
  var rezultat = engine.spremeni(definicija, stanje, { vrsta:"nastavi-stevilo", value:value });
  assert.equal(rezultat.ok, true);
  return rezultat;
}

function nastaviVrednost(stanje, instance, value) {
  var rezultat = engine.spremeni(definicija, stanje, { vrsta:"nastavi-vrednost", instance:instance, fieldKey:"cena", value:value });
  assert.equal(rezultat.ok, true);
  return rezultat;
}

test("T1: register in javni rezultati so globoko zamrznjeni", function () {
  assert.equal(engine.preveriDefinicijo(definicija).ok, true);
  assert.equal(Object.isFrozen(register.definicije), true);
  assert.equal(Object.isFrozen(definicija.ponovitev.fields[0]), true);
  assert.equal(Object.isFrozen(engine.ustvari(definicija).stanje.instance), true);
});

test("T2: nezamrznjena ali semanticno napacna definicija se zavrne", function () {
  assert.deepEqual(engine.podprtiVzorci, ["stej-ponovi-in-sestej"], "prvi rez mora posteno oglaševati en sestavljen vzorec");
  var laznoSestavljiva = JSON.parse(JSON.stringify(definicija));
  laznoSestavljiva.vzorci = ["stej-in-ponovi", "vnesi-in-sestej"];
  globokoZamrzni(laznoSestavljiva);
  assert.equal(engine.preveriDefinicijo(laznoSestavljiva).code, "VZORCI_NISO_PODPRTI");
  assert.equal(engine.preveriDefinicijo({}).code, "DEFINICIJA_NI_GLOBOKO_ZAMRZNJENA");
  var napacna = JSON.parse(JSON.stringify(definicija));
  napacna.ponovitev.writes = ["answers.5101"];
  Object.freeze(napacna.ponovitev.writes);
  Object.freeze(napacna.ponovitev.reads);
  Object.freeze(napacna.ponovitev.fields[0]);
  Object.freeze(napacna.ponovitev.fields);
  Object.freeze(napacna.ponovitev);
  Object.freeze(napacna.stevec.writes);
  Object.freeze(napacna.stevec);
  Object.freeze(napacna.vzorci);
  Object.freeze(napacna.agregati[0].reads);
  Object.freeze(napacna.agregati[0]);
  Object.freeze(napacna.agregati);
  Object.freeze(napacna);
  assert.equal(engine.preveriDefinicijo(napacna).code, "PONOVITEV_WRITES_NI_VELJAVEN");
});

test("T3: 1 na 3 ustvari natanko tri namespaced instance", function () {
  var zacetno = engine.ustvari(definicija).stanje;
  var ena = nastaviStevilo(zacetno, 1).stanje;
  var tri = nastaviStevilo(ena, 3);
  assert.deepEqual(Object.keys(tri.stanje.instance), ["1", "2", "3"]);
  assert.deepEqual(tri.pogled.instance.map(function (item) { return item.fields[0].storageKey; }), [
    "pogodbe-stej-ponovi-sestej.1.cena",
    "pogodbe-stej-ponovi-sestej.2.cena",
    "pogodbe-stej-ponovi-sestej.3.cena"
  ]);
});

test("T4: vrednosti instanc ostanejo locene", function () {
  var stanje = nastaviStevilo(engine.ustvari(definicija).stanje, 3).stanje;
  stanje = nastaviVrednost(stanje, 1, "10,00").stanje;
  stanje = nastaviVrednost(stanje, 2, "20,00").stanje;
  assert.equal(stanje.instance[1].cena, "10,00");
  assert.equal(stanje.instance[2].cena, "20,00");
  assert.equal(stanje.instance[3].cena, "");
});

test("T5: ziva vsota uporablja minor enote brez floating-point napake", function () {
  var stanje = nastaviStevilo(engine.ustvari(definicija).stanje, 3).stanje;
  stanje = nastaviVrednost(stanje, 1, "0,10").stanje;
  assert.equal(engine.preberiPogled(definicija, stanje).agregati[0].valueMinor, 10);
  stanje = nastaviVrednost(stanje, 2, "0.20").stanje;
  assert.equal(engine.preberiPogled(definicija, stanje).agregati[0].valueMinor, 30);
  stanje = nastaviVrednost(stanje, 3, "1.234,56 EUR").stanje;
  var agregat = engine.preberiPogled(definicija, stanje).agregati[0];
  assert.equal(agregat.valueMinor, 123486);
  assert.equal(agregat.status, "complete");
});

test("T6: manjkajoc vnos je incomplete, ne nicla", function () {
  var stanje = nastaviStevilo(engine.ustvari(definicija).stanje, 2).stanje;
  stanje = nastaviVrednost(stanje, 1, "12").stanje;
  var agregat = engine.preberiPogled(definicija, stanje).agregati[0];
  assert.equal(agregat.status, "incomplete");
  assert.deepEqual(agregat.missingInstances, [2]);
  assert.equal(agregat.valueMinor, 1200);
});

test("T7: neveljaven raw ostane za popravek in ni pristet kot nic", function () {
  var stanje = nastaviStevilo(engine.ustvari(definicija).stanje, 1).stanje;
  stanje = nastaviVrednost(stanje, 1, "12,345").stanje;
  var agregat = engine.preberiPogled(definicija, stanje).agregati[0];
  assert.equal(stanje.instance[1].cena, "12,345");
  assert.equal(agregat.status, "invalid");
  assert.deepEqual(agregat.invalidInstances, [1]);
});

test("T8: 3 na 2 izbrise presezno instanco, 2 na 3 ustvari prazno", function () {
  var stanje = nastaviStevilo(engine.ustvari(definicija).stanje, 3).stanje;
  stanje = nastaviVrednost(stanje, 3, "99,00").stanje;
  stanje = nastaviStevilo(stanje, 2).stanje;
  assert.equal(stanje.instance[3], undefined);
  stanje = nastaviStevilo(stanje, 3).stanje;
  assert.equal(stanje.instance[3].cena, "");
});

test("T9: count se omeji na max in ne ustvari presezka", function () {
  var rezultat = nastaviStevilo(engine.ustvari(definicija).stanje, 500);
  assert.equal(rezultat.stanje.stevilo, 20);
  assert.equal(Object.keys(rezultat.stanje.instance).length, 20);
});

test("T10: poskodovan shranjeni objekt se fail-closed normalizira", function () {
  var obnovljeno = engine.obnovi(definicija, {
    version:engine.stateVersion,
    stevilo:2,
    instance:{ "1":{ cena:"15", skrivnost:"ne" }, "2":"pokvarjeno", "9":{ cena:"900" } },
    izracunano:{ skupaj:915 }
  });
  assert.equal(obnovljeno.ok, true);
  assert.deepEqual(obnovljeno.stanje, { version:engine.stateVersion, stevilo:2, instance:{ "1":{ cena:"15" }, "2":{ cena:"" } } });
  assert.ok(obnovljeno.diagnostics.includes("STATE_SHAPE_NORMALIZED"));
});

test("T11: nezdruzljiva verzija se resetira z diagnostiko", function () {
  var obnovljeno = engine.obnovi(definicija, { version:"staro", stevilo:9, instance:{ "1":{ cena:"50" } } });
  assert.equal(obnovljeno.stanje.stevilo, definicija.stevec.min);
  assert.deepEqual(obnovljeno.diagnostics, ["STATE_VERSION_RESET"]);
});

test("T12: JSON round-trip ohrani samo surovo stanje brez agregata", function () {
  var stanje = nastaviStevilo(engine.ustvari(definicija).stanje, 2).stanje;
  stanje = nastaviVrednost(stanje, 1, "850,50").stanje;
  var json = JSON.stringify(stanje);
  assert.doesNotMatch(json, /agregat|valueMinor|izracunano/);
  assert.deepEqual(engine.obnovi(definicija, JSON.parse(json)).stanje, stanje);
});

test("T13: neveljavna sprememba ne spremeni snapshot vsebine", function () {
  var stanje = nastaviStevilo(engine.ustvari(definicija).stanje, 1).stanje;
  var prej = JSON.stringify(stanje);
  var rezultat = engine.spremeni(definicija, stanje, { vrsta:"nastavi-vrednost", instance:2, fieldKey:"cena", value:"5" });
  assert.equal(rezultat.ok, false);
  assert.equal(JSON.stringify(rezultat.stanje), prej);
  assert.equal(JSON.stringify(stanje), prej);
});

test("T14: runtime scope loci dve uporabi iste definicije", function () {
  var stanje = nastaviStevilo(engine.ustvari(definicija).stanje, 1).stanje;
  var prvi = engine.preberiPogled(definicija, stanje, "ponudba:4009:pogodbe-stej-ponovi-sestej");
  var drugi = engine.preberiPogled(definicija, stanje, "narocnina:6115:pogodbe-stej-ponovi-sestej");
  assert.equal(prvi.instance[0].fields[0].storageKey, "ponudba:4009:pogodbe-stej-ponovi-sestej.1.cena");
  assert.equal(drugi.instance[0].fields[0].storageKey, "narocnina:6115:pogodbe-stej-ponovi-sestej.1.cena");
  assert.notEqual(prvi.instance[0].fields[0].storageKey, drugi.instance[0].fields[0].storageKey);
});

test("T15: agregat zazna overflow varnih minor enot", function () {
  var stanje = nastaviStevilo(engine.ustvari(definicija).stanje, 2).stanje;
  stanje = nastaviVrednost(stanje, 1, "45035996273704.96").stanje;
  stanje = nastaviVrednost(stanje, 2, "45035996273704.96").stanje;
  var agregat = engine.preberiPogled(definicija, stanje).agregati[0];
  assert.equal(agregat.status, "overflow");
  assert.equal(agregat.overflow, true);
  assert.equal(agregat.valueMinor, null);
});

console.log("Atena card combinations engine: OK (" + stevilo + " testov)");
