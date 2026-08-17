"use strict";

/**
 * Testi: slovenska sklanjatev za modul "Potek opominov" (zgornji widget na
 * koraku "Predaja odvetniku"). N.slovenskaOblika/stevecPoslanih/stevecNacrtovanih
 * so čiste funkcije brez brskalniških odvisnosti - glej app/opomin-nacrt.js.
 */

var assert = require("assert/strict");
var N = require("../app/opomin-nacrt.js");

var passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (err) {
    console.error("  ✗ " + name);
    throw err;
  }
}

console.log("\nPotek opominov – slovenska sklanjatev");

test("slovenskaOblika: osnovna pravila (1/2/3-4/5+)", function () {
  var oblike = ["ena", "dve", "tri-štiri", "pet+"];
  assert.equal(N.slovenskaOblika(1, oblike), "ena");
  assert.equal(N.slovenskaOblika(2, oblike), "dve");
  assert.equal(N.slovenskaOblika(3, oblike), "tri-štiri");
  assert.equal(N.slovenskaOblika(4, oblike), "tri-štiri");
  assert.equal(N.slovenskaOblika(5, oblike), "pet+");
});

test("slovenskaOblika: 11 in 12 padeta v 'pet_in_vec', ne v ednino/dvojino", function () {
  var oblike = ["ena", "dve", "tri-štiri", "pet+"];
  assert.equal(N.slovenskaOblika(11, oblike), "pet+");
  assert.equal(N.slovenskaOblika(12, oblike), "pet+");
});

var pricakovanoPoslanih = {
  0: "0 poslanih",
  1: "1 poslan",
  2: "2 poslana",
  3: "3 poslani",
  4: "4 poslani",
  5: "5 poslanih",
  11: "11 poslanih",
  12: "12 poslanih",
};
Object.keys(pricakovanoPoslanih).forEach(function (n) {
  test("stevecPoslanih(" + n + ") = '" + pricakovanoPoslanih[n] + "'", function () {
    assert.equal(N.stevecPoslanih(Number(n)), pricakovanoPoslanih[n]);
  });
});

var pricakovanoNacrtovanih = {
  0: "0 načrtovanih",
  1: "1 načrtovan",
  2: "2 načrtovana",
  3: "3 načrtovani",
  4: "4 načrtovani",
  5: "5 načrtovanih",
  11: "11 načrtovanih",
  12: "12 načrtovanih",
};
Object.keys(pricakovanoNacrtovanih).forEach(function (n) {
  test("stevecNacrtovanih(" + n + ") = '" + pricakovanoNacrtovanih[n] + "'", function () {
    assert.equal(N.stevecNacrtovanih(Number(n)), pricakovanoNacrtovanih[n]);
  });
});

test("kombinirani primeri iz specifikacije (odsek 7)", function () {
  assert.equal(N.stevecPoslanih(0) + " · " + N.stevecNacrtovanih(9), "0 poslanih · 9 načrtovanih");
  assert.equal(N.stevecPoslanih(1) + " · " + N.stevecNacrtovanih(8), "1 poslan · 8 načrtovanih");
  assert.equal(N.stevecPoslanih(2) + " · " + N.stevecNacrtovanih(7), "2 poslana · 7 načrtovanih");
  assert.equal(N.stevecPoslanih(3) + " · " + N.stevecNacrtovanih(6), "3 poslani · 6 načrtovanih");
  assert.equal(N.stevecPoslanih(5) + " · " + N.stevecNacrtovanih(4), "5 poslanih · 4 načrtovani");
});

console.log("\n  Uspešnih: " + passed + "/" + (2 + Object.keys(pricakovanoPoslanih).length + Object.keys(pricakovanoNacrtovanih).length + 1));
console.log("Potek opominov: slovnica preverjena — vsi testi uspešni\n");
