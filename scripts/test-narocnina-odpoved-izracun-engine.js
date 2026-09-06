"use strict";

var assert = require("node:assert");
var engine = require("../app/narocnina-odpoved-izracun-engine");

var stevilo = 0;
function test(ime, fn) {
  fn();
  stevilo += 1;
  console.log("  OK  " + ime);
}

test("T1: znan začetek + znana vezava (meseci) izračuna pravilen datum", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"2024-01-15", vezava:"12 meseci", trajanje:"24 meseci" });
  assert.strictEqual(rezultat.status, "izracunano");
  assert.strictEqual(rezultat.datum, "2025-01-15");
  assert.strictEqual(rezultat.viraTrajanja, "vezava", "vezava ima prednost pred splošnim trajanjem");
});

test("T2: brez vezave se uporabi trajanje", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"2024-01-15", vezava:"", trajanje:"6 mesecev".replace("mesecev", "meseci") });
  assert.strictEqual(rezultat.status, "izracunano");
  assert.strictEqual(rezultat.viraTrajanja, "trajanje");
});

test("T3: manjka začetek vrne manjka-zacetek, ne napačnega datuma", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"", vezava:"12 meseci" });
  assert.strictEqual(rezultat.status, "manjka-zacetek");
  assert.strictEqual(rezultat.datum, null);
});

test("T4: 'Ne vem' kot začetek se obravnava enako kot manjkajoč", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"Ne vem", vezava:"12 meseci" });
  assert.strictEqual(rezultat.status, "manjka-zacetek");
});

test("T5: neveljaven format začetka se loči od manjkajočega", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"15.1.2024", vezava:"12 meseci" });
  assert.strictEqual(rezultat.status, "neveljaven-zacetek");
});

test("T6: 'Enkratno' trajanje vrne ni-vezave", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"2024-01-15", vezava:"", trajanje:"Enkratno" });
  assert.strictEqual(rezultat.status, "ni-vezave");
});

test("T7: 'Nedoločen čas' brez znane vezave vrne ni-znane-vezave", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"2024-01-15", vezava:"", trajanje:"Nedoločen čas" });
  assert.strictEqual(rezultat.status, "ni-znane-vezave");
});

test("T8: popolnoma prazno trajanje in vezava vrneta manjka-trajanje", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"2024-01-15", vezava:"", trajanje:"" });
  assert.strictEqual(rezultat.status, "manjka-trajanje");
});

test("T9: približen začetek se izračuna in označi kot priblizno", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"Približno: 2024-03-01", vezava:"3 meseci" });
  assert.strictEqual(rezultat.status, "izracunano");
  assert.strictEqual(rezultat.datum, "2024-06-01");
  assert.strictEqual(rezultat.priblizno, true);
});

test("T10: dnevi in tedni se seštevajo natančno na dan", function () {
  var vTednih = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"2024-01-01", vezava:"2 tedni" });
  assert.strictEqual(vTednih.datum, "2024-01-15");
  var vDneh = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"2024-01-01", vezava:"10 dni" });
  assert.strictEqual(vDneh.datum, "2024-01-11");
});

test("T11: dodajanje mesecev na 31. dan se pravilno omeji na zadnji dan krajšega meseca", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"2024-01-31", vezava:"1 meseci" });
  assert.strictEqual(rezultat.status, "izracunano");
  assert.strictEqual(rezultat.datum, "2024-02-29", "2024 je prestopno leto, februar ima 29 dni");
});

test("T12: dodajanje let prek meje stoletja/prestopnega leta deluje pravilno", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"2023-02-28", vezava:"1 leta" });
  assert.strictEqual(rezultat.datum, "2024-02-28");
});

test("T13: neveljaven format trajanja (npr. brez enote) vrne manjka-trajanje", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"2024-01-15", vezava:"dvanajst mesecev", trajanje:"" });
  assert.strictEqual(rezultat.status, "manjka-trajanje");
});

test("T14: vsi javni rezultati in vmesnik so zamrznjeni (immutability)", function () {
  var rezultat = engine.izracunajNajzgodnejsoOdpoved({ zacetek:"2024-01-15", vezava:"12 meseci" });
  assert.ok(Object.isFrozen(rezultat));
  assert.ok(Object.isFrozen(engine));
  assert.throws(function () { rezultat.status = "spremenjeno"; }, /|/, "strict mode bi moral preprečiti spremembo, vrednost pa mora ostati enaka");
  assert.strictEqual(rezultat.status, "izracunano");
});

test("T15: razberiDatum in razberiTrajanje sta javno dostopna in samostojno testljiva", function () {
  assert.strictEqual(engine.razberiDatum("2024-05-01").status, "znan");
  assert.strictEqual(engine.razberiTrajanje("5 leta").status, "doloceno");
});

console.log("Naročnina — izračun najzgodnejše odpovedi: OK (" + stevilo + " testov)");
