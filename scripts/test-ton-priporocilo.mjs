/**
 * Enotski testi: priporočilo tona sporočila.
 * Zagon: node scripts/test-ton-priporocilo.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const UJ = require(path.join(root, "..", "app", "ton-priporocilo.js"));

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

function rec(overdueDays, cents, due) {
  const evaluationDate = "2026-08-08";
  let originalDueDate = due;
  if (originalDueDate == null && overdueDays != null) {
    // due = evaluation - overdueDays
    const dt = UJ.parseLocalYYYYMMDD(evaluationDate);
    dt.setDate(dt.getDate() - overdueDays);
    originalDueDate = UJ.formatLocalYYYYMMDD(dt);
  }
  return UJ.getRecommendedTone({
    totalDebtCents: cents,
    originalDueDate,
    evaluationDate,
    overdueDays,
  });
}

test("1. Račun še ni zapadel → Zelo prijazen", () => {
  assert.equal(rec(-5, 7564).recommendedToneId, "very_friendly");
});

test("2. 5 dni zamude → Zelo prijazen", () => {
  assert.equal(rec(5, 7564).recommendedToneId, "very_friendly");
});

test("3. 10 dni zamude → Prijazen", () => {
  assert.equal(rec(10, 7564).recommendedToneId, "friendly");
});

test("4. 20 dni zamude → Nevtralen", () => {
  assert.equal(rec(20, 7564).recommendedToneId, "neutral");
});

test("5. 45 dni zamude → Odločen", () => {
  assert.equal(rec(45, 7564).recommendedToneId, "firm");
});

test("6. 90 dni zamude → Strog", () => {
  assert.equal(rec(90, 7564).recommendedToneId, "strict");
});

test("7. Visok znesek premakne največ za eno stopnjo", () => {
  // 20 dni = nevtralen (3); znesek >1500€ in zapadel → +1 = firm (4), ne strict
  const r = rec(20, 200000);
  assert.equal(r.recommendedToneId, "firm");
});

test("8. Visok znesek pred zapadlostjo ne povzroči strogega tona", () => {
  const r = rec(-3, 500000);
  assert.equal(r.recommendedToneId, "very_friendly");
});

test("9. Manjkajoči rok → varen nevtralni ton", () => {
  const r = UJ.getRecommendedTone({
    totalDebtCents: 7564,
    originalDueDate: null,
    evaluationDate: "2026-08-08",
  });
  assert.equal(r.recommendedToneId, "neutral");
  assert.ok(r.reasonText.includes("Rok plačila ni vnesen"));
});

test("10. Manjkajoči znesek → priporočilo samo glede na čas", () => {
  const r = UJ.getRecommendedTone({
    totalDebtCents: null,
    originalDueDate: "2026-07-29",
    evaluationDate: "2026-08-08",
    overdueDays: 10,
  });
  assert.equal(r.recommendedToneId, "friendly");
  assert.ok(r.reasonText.includes("samo glede na zapadlost"));
  assert.equal(r.amountLabel, "");
});

test("11. Ročna izbira se ob ponovnem izračunu ohrani", () => {
  const first = UJ.getRecommendedTone({
    totalDebtCents: 7564,
    originalDueDate: "2026-07-29",
    evaluationDate: "2026-08-08",
    overdueDays: 10,
  });
  let state = UJ.applyRecommendationToState(null, first);
  state = UJ.selectTone(state, "firm");
  assert.equal(state.isOverridden, true);
  assert.equal(state.selectedToneId, "firm");

  const second = UJ.getRecommendedTone({
    totalDebtCents: 7564,
    originalDueDate: "2026-07-29",
    evaluationDate: "2026-08-09",
    overdueDays: 11,
  });
  state = UJ.applyRecommendationToState(state, second);
  assert.equal(state.selectedToneId, "firm");
  assert.equal(state.isOverridden, true);
  assert.equal(state.recommendedToneId, "friendly");
});

test("12. Ponastavitev vrne priporočeni ton", () => {
  const first = UJ.getRecommendedTone({
    totalDebtCents: 7564,
    originalDueDate: "2026-07-29",
    evaluationDate: "2026-08-08",
    overdueDays: 10,
  });
  let state = UJ.applyRecommendationToState(null, first);
  state = UJ.selectTone(state, "strict");
  state = UJ.resetToRecommended(state);
  assert.equal(state.selectedToneId, "friendly");
  assert.equal(state.isOverridden, false);
});

test("Sprejemni: 75,64 € + krajša zamuda → Prijazen", () => {
  const r = rec(10, 7564);
  assert.equal(r.recommendedToneId, "friendly");
  assert.equal(r.timingLabel, "Krajša zamuda");
  assert.ok(r.amountLabel.includes("75"));
});

console.log("\nUspešnih: " + ok);
