/**
 * Testi: časovnica načrta opominjanja (premiki datumov).
 * Zagon: node scripts/test-opomin-casovnica.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const N = require(path.join(root, "..", "app", "opomin-nacrt.js"));
const uiSrc = fs.readFileSync(
  path.join(root, "..", "app", "opomin-nacrt-ui.js"),
  "utf8"
);

let ok = 0;
function test(ime, fn) {
  try {
    fn();
    ok += 1;
    console.log("OK  " + ime);
  } catch (e) {
    console.error("FAIL " + ime);
    console.error("  " + (e && e.message ? e.message : e));
    process.exitCode = 1;
  }
}

function lokalniIso(y, m, d, h = 12, min = 0) {
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString();
}

function offsets(plan) {
  N.uskladiOffseteIzDatumov(plan);
  return plan.steps.map((s) => s.scheduledOffsetDays);
}

function planZOffseti(odmiki) {
  const plan = N.narediNovPlan(
    { znesek: 75.64, datumZapadlosti: "2026-07-01", imeDolznika: "Test" },
    { toneRecommendation: { selectedToneId: "friendly" } }
  );
  const base = new Date(2026, 7, 8, 12, 0, 0, 0); // 8. 8. 2026
  plan.steps.forEach((s, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + odmiki[i]);
    s.sendAt = d.toISOString();
    s.scheduledAt = s.sendAt;
    s.status = "draft";
  });
  plan.keepStageIntervals = true;
  N.uskladiOffseteIzDatumov(plan);
  return plan;
}

test("Začetni odmiki friendly ≈ 0,11,22,30", () => {
  const plan = N.narediNovPlan(
    { znesek: 75.64, datumZapadlosti: "2026-07-01" },
    { toneRecommendation: { selectedToneId: "friendly" } }
  );
  assert.equal(plan.steps.length, 4);
  assert.ok(plan.steps.every((s) => s.sendAt && s.scheduledAt));
  assert.equal(plan.steps[0].scheduledOffsetDays, 0);
  assert.ok(plan.recommendedGapDays >= 8);
});

test("Premik z ohranitvijo razmikov: +3 dni na 2. koraku", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  assert.deepEqual(offsets(plan), [0, 11, 22, 33]);
  const nov = lokalniIso(2026, 8, 22, 12, 0); // 19.+3
  plan = N.posodobiCasKoraka(plan, 2, nov, { shiftFollowing: true });
  assert.deepEqual(offsets(plan), [0, 14, 25, 36]);
});

test("Premik samo enega koraka", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  const nov = lokalniIso(2026, 8, 22, 12, 0);
  plan = N.posodobiCasKoraka(plan, 2, nov, { shiftFollowing: false });
  assert.deepEqual(offsets(plan), [0, 14, 22, 33]);
});

test("Premik prvega koraka z ohranitvijo", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  const nov = lokalniIso(2026, 8, 9, 12, 0); // +1 dan
  plan = N.posodobiCasKoraka(plan, 1, nov, { shiftFollowing: true });
  assert.deepEqual(offsets(plan), [0, 11, 22, 33]);
  // Absolutni datumi: vsi +1 dan glede na prejšnje
  const d0 = new Date(plan.steps[0].sendAt).getDate();
  assert.equal(d0, 9);
  assert.equal(new Date(plan.steps[1].sendAt).getDate(), 20);
});

test("Sprememba ure prestavi tudi prihodnje (+3 ure)", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  const nov = lokalniIso(2026, 8, 19, 15, 0);
  plan = N.posodobiCasKoraka(plan, 2, nov, { shiftFollowing: true });
  assert.equal(new Date(plan.steps[1].sendAt).getHours(), 15);
  assert.equal(new Date(plan.steps[2].sendAt).getHours(), 15);
  assert.equal(new Date(plan.steps[3].sendAt).getHours(), 15);
});

test("Zadnji korak: validacija brez naslednjih", () => {
  const plan = planZOffseti([0, 11, 22, 33]);
  const v = N.validirajCasKoraka(
    plan,
    4,
    lokalniIso(2026, 9, 12, 12, 0),
    true
  );
  assert.equal(v.ok, true);
  assert.equal(v.preview.shiftedCount, 0);
});

test("Poslan korak ni premakljiv", () => {
  const plan = planZOffseti([0, 11, 22, 33]);
  plan.steps[0].status = "sent";
  assert.equal(N.jeKorakPremakljiv(plan.steps[0]), false);
  const before = plan.steps[0].sendAt;
  N.posodobiCasKoraka(plan, 1, lokalniIso(2026, 8, 10, 12, 0), {
    shiftFollowing: true,
  });
  assert.equal(plan.steps[0].sendAt, before);
});

test("UI: ni stalnega stikala Ohrani razmike", () => {
  assert.ok(!uiSrc.includes("Ohrani razmike med koraki"));
  assert.ok(uiSrc.includes("Prestavi tudi naslednje korake"));
  assert.ok(uiSrc.includes("odpriCasSheet"));
  assert.ok(uiSrc.includes("opomin-cas-sheet"));
});

test("Slovenske oznake dni", () => {
  assert.equal(N.oznakaCezDni(1), "Čez 1 dan");
  assert.equal(N.oznakaCezDni(2), "Čez 2 dni");
  assert.equal(N.oznakaCezDni(11), "Čez 11 dni");
  assert.equal(N.oznakaPoPrejsnjem(1), "1 dan po prejšnjem koraku");
});

console.log("\nUspešnih: " + ok);
