/**
 * Enotski testi: Ton sporočila (3 toni + kategorije).
 * Zagon: node scripts/test-ton-priporocilo.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const UJ = require(path.join(root, "..", "app", "ton-priporocilo.js"));
const Predloge = require(path.join(root, "..", "app", "ton-predloge.js"));
const widgetSrc = fs.readFileSync(
  path.join(root, "..", "app", "ton-widget.js"),
  "utf8"
);
const appSrc = fs.readFileSync(path.join(root, "..", "app", "app.js"), "utf8");
const cssSrc = fs.readFileSync(
  path.join(root, "..", "app", "styles.css"),
  "utf8"
);
const htmlSrc = fs.readFileSync(
  path.join(root, "..", "app", "neplacila-sporocilo.html"),
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

function rec(overdueDays, cents, due) {
  const evaluationDate = "2026-08-08";
  let originalDueDate = due;
  if (originalDueDate == null && overdueDays != null) {
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

test("Samo 3 aktivni toni", () => {
  assert.equal(UJ.TONI.length, 3);
  assert.deepEqual(
    UJ.TONI.map((t) => t.id),
    ["friendly", "firm", "strict"]
  );
  assert.equal(UJ.TONI[0].labelSl, "Prijazen");
  assert.equal(UJ.TONI[1].labelSl, "Odločen");
  assert.equal(UJ.TONI[2].labelSl, "Strog");
});

test("Migracija starih ID-jev", () => {
  assert.equal(UJ.normalizirajTonId("very_friendly"), "friendly");
  assert.equal(UJ.normalizirajTonId("neutral"), "firm");
  assert.equal(UJ.normalizirajTonId("firm"), "firm");
});

test("Kategorije dolga – mejne vrednosti", () => {
  assert.equal(UJ.getDebtCategory(75.64), "low");
  assert.equal(UJ.getDebtCategory(250), "low");
  assert.equal(UJ.getDebtCategory(250.01), "medium");
  assert.equal(UJ.getDebtCategory(1000), "medium");
  assert.equal(UJ.getDebtCategory(1000.01), "high");
  assert.equal(UJ.getDebtCategory(5000), "high");
  assert.equal(UJ.getDebtCategory(5000.01), "veryHigh");
});

test("75,64 € še ni zapadel → Prijazen", () => {
  const r = rec(-3, 7564);
  assert.equal(r.debtCategory, "low");
  assert.equal(r.recommendedToneId, "friendly");
});

test("Priporočilo glede na zamudo (nizek dolg)", () => {
  assert.equal(rec(-5, 7564).recommendedToneId, "friendly");
  assert.equal(rec(0, 7564).recommendedToneId, "friendly");
  assert.equal(rec(5, 7564).recommendedToneId, "friendly");
  assert.equal(rec(10, 7564).recommendedToneId, "firm");
  assert.equal(rec(45, 7564).recommendedToneId, "strict");
  assert.equal(rec(75, 7564).recommendedToneId, "strict");
});

test("Pred zapadlostjo nikoli strožje od Prijazen", () => {
  const r = rec(-3, 500001);
  assert.equal(r.recommendedToneId, "friendly");
});

test("Ročna izbira se ohrani; stari ID se preslika", () => {
  let state = UJ.applyRecommendationToState(null, rec(10, 7564));
  state = UJ.selectTone(state, "strict");
  assert.equal(state.selectionMode, "manual");
  state = UJ.applyRecommendationToState(
    { ...state, selectedToneId: "neutral", selectionMode: "manual" },
    rec(10, 7564)
  );
  assert.equal(state.selectedToneId, "firm");
});

test("Ponastavitev", () => {
  let state = UJ.applyRecommendationToState(null, rec(10, 7564));
  state = UJ.selectTone(state, "strict");
  state = UJ.resetToRecommended(state);
  assert.equal(state.selectedToneId, "firm");
  assert.equal(state.selectionMode, "automatic");
});

test("Ikone tonov", () => {
  const map = {
    friendly: "smile",
    firm: "shield",
    strict: "circle-alert",
  };
  UJ.TONI.forEach((t) => {
    assert.equal(t.iconKey, map[t.id]);
    assert.ok(widgetSrc.includes(t.iconKey));
  });
});

test("UI glava: naslov in značka ločena", () => {
  assert.ok(cssSrc.includes("flex-direction: column"));
  assert.ok(htmlSrc.includes("ton-widget__glava-desno"));
});

test("Predloge: 3×6", () => {
  const vsi = Predloge.sestaviSistemskePredloge({ znesek: 75.64 }, "de");
  assert.equal(vsi.length, 18);
  assert.equal(Predloge.filtrirajPredloge(vsi, "friendly", "de").length, 6);
  assert.equal(Predloge.filtrirajPredloge(vsi, "very_friendly", "de").length, 6);
  assert.equal(Predloge.filtrirajPredloge(vsi, "neutral", "de").length, 6);
});

test("Menjava tona ne prepiše sporočila", () => {
  assert.ok(appSrc.includes("ne prepiše glavnega sporočila"));
});

console.log("\nUspešnih: " + ok);
