/* ==========================================================
   scripts/test-random.js — Node.js testi za logiko
   naključnega časa pošiljanja. Poganja se lokalno:
   node scripts/test-random.js

   Testira: razpon, omejitve, časovni pas, idempotentnost.
   ========================================================== */

var crypto = require("crypto");

var OK = 0;
var FAIL = 0;

function assert(condition, label) {
  if (condition) {
    OK++;
  } else {
    FAIL++;
    console.error("  ✗ NEUSPEŠNO: " + label);
  }
}

function section(name) {
  console.log("\n" + name);
}

/* ---------- Pomožne funkcije (kopija iz API) ---------- */

function parseTimeToMinutes(timeStr) {
  var parts = String(timeStr).split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
}

function minutesToTime(t) {
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
}

function ljubljanskaUraInMinute(isoString) {
  try {
    var deli = new Intl.DateTimeFormat("sl-SI", {
      timeZone: "Europe/Ljubljana",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(isoString));
    var ura = 0, min = 0;
    deli.forEach(function (p) {
      if (p.type === "hour") ura = parseInt(p.value);
      if (p.type === "minute") min = parseInt(p.value);
    });
    return ura * 60 + min;
  } catch (_) {
    var d = new Date(isoString);
    return d.getHours() * 60 + d.getMinutes();
  }
}

function izracunajNakljucniMinute(earliestAllowed, latestAllowed) {
  var rangeMinutes = latestAllowed - earliestAllowed;
  if (rangeMinutes <= 0) return earliestAllowed;
  if (typeof crypto.randomInt === "function") {
    return earliestAllowed + crypto.randomInt(rangeMinutes + 1);
  }
  var buf = crypto.randomBytes(4);
  return earliestAllowed + (buf.readUInt32BE(0) % (rangeMinutes + 1));
}

function izracunajRazpon(baseMn, minMn, maxMn, halfWindow) {
  var earliest = Math.max(baseMn - halfWindow, minMn);
  var latest = Math.min(baseMn + halfWindow, maxMn);
  return { earliest: earliest, latest: latest };
}

/* ---------- TESTI ---------- */

/* 1. Razpon ±15 minut ne preseže meja */
section("1. Razpon ±15 minut (osnovna ura 15:00, meje 07:00-21:00)");
for (var i = 0; i < 100; i++) {
  var r = izracunajRazpon(15 * 60, 7 * 60, 21 * 60, 15);
  if (r.earliest >= r.latest) continue;
  var c = izracunajNakljucniMinute(r.earliest, r.latest);
  assert(c >= 14 * 60 + 45 && c <= 15 * 60 + 15, "±15 okoli 15:00: " + minutesToTime(c));
}

/* 2. Omejitev 07:00-21:00 — čas ob 06:00 ne sme iti pod 07:00 */
section("2. Omejitev 07:00 — ura 06:00 z ±30 min");
var r2 = izracunajRazpon(6 * 60, 7 * 60, 21 * 60, 30);
assert(r2.earliest === 7 * 60, "Spodnja meja pri 06:00 je 07:00");
for (var j = 0; j < 50; j++) {
  var c2 = izracunajNakljucniMinute(r2.earliest, r2.latest);
  assert(c2 >= 7 * 60, "Nikoli pred 07:00: " + minutesToTime(c2));
}

/* 3. Omejitev 21:00 — ura 21:30 z ±30 min */
section("3. Omejitev 21:00 — ura 21:30 z ±30 min");
var r3 = izracunajRazpon(21 * 60 + 30, 7 * 60, 21 * 60, 30);
assert(r3.latest === 21 * 60, "Zgornja meja pri 21:30 je 21:00");
for (var k = 0; k < 50; k++) {
  var c3 = izracunajNakljucniMinute(r3.earliest, r3.latest);
  assert(c3 <= 21 * 60, "Nikoli po 21:00: " + minutesToTime(c3));
}

/* 4. Europe/Ljubljana časovni pas */
section("4. Europe/Ljubljana — poletni čas (CEST, UTC+2)");
var poletniISO = "2026-07-15T10:00:00Z"; /* 10:00 UTC = 12:00 LJ */
var poletniMn = ljubljanskaUraInMinute(poletniISO);
assert(poletniMn === 12 * 60, "Poleti 10:00 UTC = 12:00 LJ: " + minutesToTime(poletniMn));

section("4b. Europe/Ljubljana — zimski čas (CET, UTC+1)");
var zimskiISO = "2026-01-15T10:00:00Z"; /* 10:00 UTC = 11:00 LJ */
var zimskiMn = ljubljanskaUraInMinute(zimskiISO);
assert(zimskiMn === 11 * 60, "Pozimi 10:00 UTC = 11:00 LJ: " + minutesToTime(zimskiMn));

/* 5. Idempotentnost — isti vhod da isti razpon */
section("5. Idempotentnost razpona");
var r1a = izracunajRazpon(15 * 60, 7 * 60, 21 * 60, 15);
var r1b = izracunajRazpon(15 * 60, 7 * 60, 21 * 60, 15);
assert(r1a.earliest === r1b.earliest && r1a.latest === r1b.latest, "Enak vhod = enak razpon");

/* 6. Prazen razpon vrne napako */
section("6. Prazen razpon (osnovna ura 22:00 izven 07:00-21:00)");
var r6 = izracunajRazpon(22 * 60, 7 * 60, 21 * 60, 30);
assert(r6.earliest >= r6.latest, "Razpon je prazen: " + r6.earliest + "-" + r6.latest);

/* 7. ±30 minut */
section("7. ±30 minut okoli 12:00");
var r7 = izracunajRazpon(12 * 60, 7 * 60, 21 * 60, 30);
assert(r7.earliest === 11 * 60 + 30, "Spodaj: 11:30");
assert(r7.latest === 12 * 60 + 30, "Zgoraj: 12:30");
for (var m = 0; m < 100; m++) {
  var c7 = izracunajNakljucniMinute(r7.earliest, r7.latest);
  assert(c7 >= 11 * 60 + 30 && c7 <= 12 * 60 + 30, "±30 okoli 12:00: " + minutesToTime(c7));
}

/* 8. Naključnost — dva zaporedna klica data različne vrednosti */
section("8. Naključnost — 100 klicev, vsaj 2 različna rezultata");
var rezultati = {};
for (var n = 0; n < 100; n++) {
  var c8 = izracunajNakljucniMinute(10 * 60, 14 * 60);
  rezultati[c8] = true;
}
var razlicnih = Object.keys(rezultati).length;
assert(razlicnih >= 2, "Vsaj 2 različna rezultata v 100 klicih: " + razlicnih);

/* 9. Prehod na poletni čas (marec 2026) */
section("9. Prehod na poletni čas — 29.3.2026 02:30 CET → 03:30 CEST");
/* Prehod se zgodi 29.3.2026 ob 02:00 CET (= 01:00 UTC). */
/* Pred prehodom: 00:00 UTC = 01:00 CET */
var predPrehodom = "2026-03-29T00:00:00Z";
/* Po prehodu: 02:00 UTC = 04:00 CEST */
var poPrehodu = "2026-03-29T02:00:00Z";
var ppMn = ljubljanskaUraInMinute(predPrehodom);
var poMn = ljubljanskaUraInMinute(poPrehodu);
assert(ppMn === 1 * 60, "Pred prehodom 00:00 UTC = 01:00 CET: " + minutesToTime(ppMn));
assert(poMn === 4 * 60, "Po prehodu 02:00 UTC = 04:00 CEST: " + minutesToTime(poMn));

/* ---------- Rezultati ---------- */
console.log("\n==============================");
console.log("  Uspešnih: " + OK);
console.log("  Neuspešnih: " + FAIL);
console.log("==============================");

if (FAIL > 0) {
  process.exit(1);
}
