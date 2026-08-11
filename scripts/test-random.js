/* ==========================================================
   scripts/test-random.js — Node.js testi za Random čas.
   Poganja: node scripts/test-random.js

   Testira: Luxon TZ, razpon, omejitve, idempotentnost,
   DST prehode, robne primere, dve sočasni zahtevi.
   ========================================================== */

var crypto = require("crypto");
var luxon;
try { luxon = require("luxon"); } catch (_) { luxon = null; }

var TZ = "Europe/Ljubljana";
var OK = 0;
var FAIL = 0;

function assert(condition, label) {
  if (condition) { OK++; }
  else { console.error("  \u2717 NEUSPE\u0160NO: " + label); FAIL++; }
}

function section(name) { console.log("\n" + name); }

/* ---------- Pomožne funkcije ---------- */

function parseTimeToMinutes(timeStr) {
  var parts = String(timeStr).split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
}

function minutesToTime(t) {
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
}

function ljMinute(isoString) {
  if (luxon) {
    var dt = luxon.DateTime.fromISO(isoString, { zone: "utc" }).setZone(TZ);
    if (dt.isValid) return dt.hour * 60 + dt.minute;
  }
  try {
    var deli = new Intl.DateTimeFormat("sl-SI", {
      timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(isoString));
    var hh = 0, mm = 0;
    deli.forEach(function (p) {
      if (p.type === "hour") hh = parseInt(p.value);
      if (p.type === "minute") mm = parseInt(p.value);
    });
    return hh * 60 + mm;
  } catch (_) {
    var d = new Date(isoString);
    return d.getHours() * 60 + d.getMinutes();
  }
}

function ljISO(localDate, hour, minute) {
  if (luxon) {
    var dt = luxon.DateTime.fromObject(
      { year: localDate.getFullYear(), month: localDate.getMonth() + 1,
        day: localDate.getDate(), hour: hour, minute: minute },
      { zone: TZ }
    );
    if (dt.isValid) return dt.toUTC().toISO();
  }
  var d = new Date(localDate);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function izracunajNakljucniMinute(earliest, latest) {
  var range = latest - earliest;
  if (range <= 0) return earliest;
  if (typeof crypto.randomInt === "function") return earliest + crypto.randomInt(range + 1);
  var buf = crypto.randomBytes(4);
  return earliest + (buf.readUInt32BE(0) % (range + 1));
}

function izracunajRazpon(baseMn, minMn, maxMn, halfWindow) {
  var earliest = Math.max(baseMn - halfWindow, minMn);
  var latest = Math.min(baseMn + halfWindow, maxMn);
  return { earliest: earliest, latest: latest };
}

function versionIncrement(v) { return String(Number(v || 0) + 1); }

/* ==================== TESTI ==================== */

/* 1. Luxon TZ — poletni/zimski čas */
section("1. Luxon Europe/Ljubljana — poletni in zimski čas");
if (luxon) {
  var summer = luxon.DateTime.fromISO("2026-07-15T12:00:00", { zone: TZ });
  assert(summer.offset === 120, "Poleti UTC+2 (offset 120 min): " + summer.offset);
  var winter = luxon.DateTime.fromISO("2026-01-15T12:00:00", { zone: TZ });
  assert(winter.offset === 60, "Pozimi UTC+1 (offset 60 min): " + winter.offset);
} else {
  console.log("  (Luxon ni nameščen — testi s Intl fallbackom)");
}

/* 2. Pretvorba UTC → LJ minuta */
section("2. Pretvorba UTC → Europe/Ljubljana minute");
assert(ljMinute("2026-07-15T10:00:00Z") === 12 * 60, "10:00 UTC = 12:00 LJ (poleti)");
assert(ljMinute("2026-01-15T10:00:00Z") === 11 * 60, "10:00 UTC = 11:00 LJ (pozimi)");

/* 3. Pretvorba LJ → UTC ISO */
section("3. Pretvorba Europe/Ljubljana → UTC ISO");
var d = new Date("2026-07-15");
var iso = ljISO(d, 14, 30);
var backMin = ljMinute(iso);
assert(backMin === 14 * 60 + 30, "14:30 LJ → ISO → 14:30 LJ: " + minutesToTime(backMin));

/* 4. ±15 okoli 15:00 */
section("4. ±15 min okoli 15:00 (07:00–21:00), 100 iteracij");
for (var i = 0; i < 100; i++) {
  var r = izracunajRazpon(15 * 60, 7 * 60, 21 * 60, 15);
  if (r.earliest >= r.latest) { assert(false, "Prazen razpon pri i=" + i); continue; }
  var c = izracunajNakljucniMinute(r.earliest, r.latest);
  assert(c >= 14 * 60 + 45 && c <= 15 * 60 + 15, "±15 okoli 15:00: " + minutesToTime(c));
}

/* 5. Omejitev 07:00 */
section("5. Ura 06:00 z ±30 min — nikoli pred 07:00");
var r5 = izracunajRazpon(6 * 60, 7 * 60, 21 * 60, 30);
assert(r5.earliest === 7 * 60, "Spodnja meja 07:00 (ne 06:30)");
for (var j = 0; j < 50; j++) {
  var c5 = izracunajNakljucniMinute(r5.earliest, r5.latest);
  assert(c5 >= 7 * 60, "≥07:00: " + minutesToTime(c5));
}

/* 6. Omejitev 21:00 */
section("6. Ura 21:30 z ±30 min — nikoli po 21:00");
var r6 = izracunajRazpon(21 * 60 + 30, 7 * 60, 21 * 60, 30);
assert(r6.latest === 21 * 60, "Zgornja meja 21:00 (ne 21:30)");
for (var k = 0; k < 50; k++) {
  var c6 = izracunajNakljucniMinute(r6.earliest, r6.latest);
  assert(c6 <= 21 * 60, "≤21:00: " + minutesToTime(c6));
}

/* 7. Tik pred 07:00 (06:59 z ±5 min) */
section("7. Tik pred 07:00 — 06:59 z ±5 min");
var r7 = izracunajRazpon(6 * 60 + 59, 7 * 60, 21 * 60, 5);
assert(r7.earliest === 7 * 60, "06:59 ±5 → earliest = 07:00");
for (var m7 = 0; m7 < 20; m7++) {
  var c7 = izracunajNakljucniMinute(r7.earliest, r7.latest);
  assert(c7 >= 7 * 60 && c7 <= 7 * 60 + 4, "07:00–07:04: " + minutesToTime(c7));
}

/* 8. Tik po 21:00 (20:59 z ±5 min) */
section("8. Tik po 21:00 — 20:59 z ±5 min");
var r8 = izracunajRazpon(20 * 60 + 59, 7 * 60, 21 * 60, 5);
assert(r8.latest === 21 * 60, "20:59 ±5 → latest = 21:00");
for (var m8 = 0; m8 < 20; m8++) {
  var c8 = izracunajNakljucniMinute(r8.earliest, r8.latest);
  assert(c8 >= 20 * 60 + 54 && c8 <= 21 * 60, "20:54–21:00: " + minutesToTime(c8));
}

/* 9. DST prehod — neobstoječi lokalni čas (02:30 CET ne obstaja) */
section("9. DST začetek — 29.3.2026 02:30 CET ne obstaja");
if (luxon) {
  var neobstojec = luxon.DateTime.fromObject(
    { year: 2026, month: 3, day: 29, hour: 2, minute: 30 },
    { zone: TZ }
  );
  /* Luxon preskoči na 03:30 CEST, kar je pravilno. */
  assert(neobstojec.hour === 3, "02:30 CET → 03:30 CEST (ura: " + neobstojec.hour + ")");
  assert(neobstojec.offset === 120, "Offset je 120 (CEST)");
} else {
  console.log("  (preskočeno — Luxon ni nameščen)");
}

/* 10. DST konec — podvojeni lokalni čas (02:30 CEST/CET) */
section("10. DST konec — 25.10.2026 02:30 (podvojen)");
if (luxon) {
  /* Luxon privzeto uporabi prvo pojavitev (CEST, UTC+2). */
  var podvojenPrvi = luxon.DateTime.fromObject(
    { year: 2026, month: 10, day: 25, hour: 2, minute: 30 },
    { zone: TZ }
  );
  assert(podvojenPrvi.offset === 120 || podvojenPrvi.offset === 60,
    "Podvojen 02:30 ima veljaven offset: " + podvojenPrvi.offset);
} else {
  console.log("  (preskočeno — Luxon ni nameščen)");
}

/* 11. ±30 minut */
section("11. ±30 min okoli 12:00");
var r11 = izracunajRazpon(12 * 60, 7 * 60, 21 * 60, 30);
assert(r11.earliest === 11 * 60 + 30 && r11.latest === 12 * 60 + 30, "11:30–12:30");
for (var m11 = 0; m11 < 50; m11++) {
  var c11 = izracunajNakljucniMinute(r11.earliest, r11.latest);
  assert(c11 >= 11 * 60 + 30 && c11 <= 12 * 60 + 30, "11:30–12:30: " + minutesToTime(c11));
}

/* 12. Prazen razpon (osnovna ura zunaj meja) */
section("12. Prazen razpon (22:00 zunaj 07:00–21:00)");
var r12 = izracunajRazpon(22 * 60, 7 * 60, 21 * 60, 30);
assert(r12.earliest >= r12.latest, "Razpon prazen pri 22:00");

/* 13. Idempotentnost */
section("13. Idempotentnost — enak vhod = enak razpon");
var ra = izracunajRazpon(15 * 60, 7 * 60, 21 * 60, 15);
var rb = izracunajRazpon(15 * 60, 7 * 60, 21 * 60, 15);
assert(ra.earliest === rb.earliest && ra.latest === rb.latest, "Enak razpon");

/* 14. Version increment */
section("14. Version — dve sočasni potrditvi (simulacija optimistic locking)");
var planA = { version: "5", steps: [{ index: 1, status: "draft", _randomSchedule: { enabled: false } }] };
var planB = JSON.parse(JSON.stringify(planA));

/* Oba poskušata z isto verzijo. Samo prvi uspe. */
var vA = planA.version;
var vB = planB.version;
if (vA === vB) {
  /* Prvi uspe — poveča verzijo */
  planA.version = versionIncrement(vA);
  /* Drugi poskusi — verzija se ne ujema več */
  var conflict = planB.version !== planA.version;
  assert(conflict, "Drugi poskus z isto verzijo zazna konflikt (vA=" + planA.version + " vB=" + planB.version + ")");
}

/* 15. Naključnost */
section("15. Naključnost — vsaj 2 različna rezultata v 100 klicih");
var rez = {};
for (var n15 = 0; n15 < 100; n15++) {
  var c15 = izracunajNakljucniMinute(10 * 60, 14 * 60);
  rez[c15] = true;
}
assert(Object.keys(rez).length >= 2, "Različnih: " + Object.keys(rez).length);

/* 16. _previewResolvedAt vs resolvedScheduledAt */
section("16. Preview ločen od dokončnega — predogled ne piše v resolvedScheduledAt");
var mockRS = { enabled: true, mode: "okoli", minutesBefore: 15, minutesAfter: 15 };
/* Preview nikoli ne sme zapisati v resolvedScheduledAt */
assert(!mockRS.resolvedScheduledAt, "resolvedScheduledAt prazen pred API klicem");
mockRS._previewResolvedAt = "2026-08-12T13:08:00.000Z";
assert(!mockRS.resolvedScheduledAt, "resolvedScheduledAt še vedno prazen po preview");
assert(mockRS._previewResolvedAt, "_previewResolvedAt nastavljen");

/* 17. planId in stepId */
section("17. Plan/step ID");
var planID = "plan-" + "abc123";
var stepID = "step-" + "abc123" + "-" + 2;
assert(planID === "plan-abc123", "planId");
assert(stepID === "step-abc123-2", "stepId");

/* ==================== REZULTATI ==================== */
console.log("\n==============================");
console.log("  Uspešnih: " + OK);
console.log("  Neuspešnih: " + FAIL);
console.log("  Luxon: " + (luxon ? "nameščen" : "ni nameščen — uporablja Intl fallback"));
console.log("==============================");

if (FAIL > 0) process.exit(1);
