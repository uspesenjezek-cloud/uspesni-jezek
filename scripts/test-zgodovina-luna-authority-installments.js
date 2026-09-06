"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var parser = require("../api/_lib/zgodovina-naravni-vnos");

var body = parser.requestBody(
  "plačal je 100 evrov razdrobljeno na 4 obroke prvi obrok je plačal mesec dni nazaj",
  { referenceDate: "2026-08-30", originalDebt: 232, remainingDebt: 232 },
  "luna-authority-regression"
);
var input = JSON.parse(body.input);
var installment = input.catalog.cards.find(function (row) { return row[1] === "installment_payment"; });

assert.ok(installment, "Lunin katalog mora vsebovati kartico plačanega obroka");
assert.deepEqual(installment[2], [1, 2, 4], "Luna mora še vedno poznati vsa razpoložljiva polja obroka");
assert.deepEqual(installment[3], [1, 2], "Atena ne sme sama zahtevati načina plačila, ki ga uporabnik ni navedel");
assert.match(body.instructions, /field 4 is omitted when method is unstated/);
assert.match(body.instructions, /plan\/split count is not a paid count/i);
assert.match(body.instructions, /output one installment_payment/);
assert.doesNotMatch(body.instructions, /completed payments[^.]*payment method is required/i);

var izvedba = fs.readFileSync(path.join(__dirname, "..", "app", "izvedba.js"), "utf8");
assert.doesNotMatch(izvedba, /if \(!String\(kandidat\.paymentMethod \|\| ""\)\) \{ state\.error = "Izberite način plačila\.";/, "neizrečen način plačila ne sme po Lunini potrditvi znova blokirati dogodka");
assert.match(izvedba, /paymentMethod = kandidat\.paymentMethod \|\| "unknown"/);

console.log("PASS Luna ostane glavna pri plačanih obrokih; Atena ne izmišlja vprašanja o načinu plačila.");
