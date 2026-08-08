/**
 * Enotski testi: Ton sporočila (5 tonov, kompaktni widget).
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

test("1. Priporočilo glede na datum (še ni zapadel → Zelo prijazen)", () => {
  assert.equal(rec(-5, 7564).recommendedToneId, "very_friendly");
  assert.equal(rec(5, 7564).recommendedToneId, "very_friendly");
  assert.equal(rec(10, 7564).recommendedToneId, "friendly");
  assert.equal(rec(20, 7564).recommendedToneId, "neutral");
  assert.equal(rec(45, 7564).recommendedToneId, "firm");
  assert.equal(rec(90, 7564).recommendedToneId, "strict");
});

test("2. Znesek premakne največ za eno stopnjo", () => {
  const r = rec(20, 200000);
  assert.equal(r.recommendedToneId, "firm");
});

test("3. Račun pred zapadlostjo ni strog", () => {
  const r = rec(-3, 500000);
  assert.equal(r.recommendedToneId, "very_friendly");
});

test("4. Ročna izbira se ohrani", () => {
  const first = rec(10, 7564);
  let state = UJ.applyRecommendationToState(null, first);
  state = UJ.selectTone(state, "firm");
  assert.equal(state.isOverridden, true);
  const second = UJ.getRecommendedTone({
    totalDebtCents: 7564,
    originalDueDate: "2026-07-29",
    evaluationDate: "2026-08-09",
    overdueDays: 11,
  });
  state = UJ.applyRecommendationToState(state, second);
  assert.equal(state.selectedToneId, "firm");
  assert.equal(state.isOverridden, true);
});

test("5. Ponastavitev izbere priporočeni ton", () => {
  let state = UJ.applyRecommendationToState(null, rec(10, 7564));
  state = UJ.selectTone(state, "strict");
  state = UJ.resetToRecommended(state);
  assert.equal(state.selectedToneId, "friendly");
  assert.equal(state.isOverridden, false);
});

test("6. Vsak ton ima pravilno ikono", () => {
  const map = {
    very_friendly: "smile-plus",
    friendly: "smile",
    neutral: "meh",
    firm: "shield",
    strict: "circle-alert",
  };
  assert.equal(UJ.TONI.length, 5);
  UJ.TONI.forEach((t) => {
    assert.equal(t.iconKey, map[t.id]);
    assert.ok(widgetSrc.includes('"' + t.iconKey + '"') || widgetSrc.includes("'" + t.iconKey + "'") || widgetSrc.includes(t.iconKey + ":"));
  });
});

test("7. Izbrana ikona postane bela (CSS)", () => {
  assert.ok(cssSrc.includes(".ton-widget__gumb--izbran"));
  assert.ok(/\.ton-widget__gumb--izbran[\s\S]*?color:\s*#ffffff/.test(cssSrc));
});

test("8. Predloge se filtrirajo po tonu", () => {
  const vsi = Predloge.sestaviSistemskePredloge(
    { znesek: 75.64, stevilkaRacuna: "1", datumZapadlosti: "2026-08-20" },
    "de"
  );
  assert.equal(vsi.length, 30);
  const vf = Predloge.filtrirajPredloge(vsi, "very_friendly", "de");
  assert.equal(vf.length, 6);
  assert.ok(vf.every((p) => p.toneId === "very_friendly"));
});

test("9. Predloge se filtrirajo po jeziku", () => {
  const vsi = Predloge.sestaviSistemskePredloge({ znesek: 10 }, "de");
  assert.equal(Predloge.filtrirajPredloge(vsi, "friendly", "sl").length, 0);
  assert.equal(Predloge.filtrirajPredloge(vsi, "friendly", "de").length, 6);
});

test("10. Priporočena predloga je prva", () => {
  const vsi = Predloge.sestaviSistemskePredloge({ znesek: 10 }, "de");
  const firm = Predloge.sortirajPredlogeZaTon(
    Predloge.filtrirajPredloge(vsi, "firm", "de")
  );
  assert.equal(firm[0].isRecommended, true);
});

test("11. Menjava tona ne prepiše sporočila (app.js)", () => {
  assert.ok(appSrc.includes("ne prepiše glavnega sporočila"));
  assert.ok(!appSrc.includes("uporabiTonInPrivzetoPredlogo"));
  assert.ok(appSrc.includes("onToneSelected:"));
  assert.ok(appSrc.includes("nastaviIzbranTon(toneId, true)"));
});

test("12. Uporabi zamenja sporočilo z zaščito", () => {
  assert.ok(appSrc.includes("async function uporabiPredlog"));
  assert.ok(appSrc.includes("Uporaba predloge bo zamenjala trenutno urejeno besedilo"));
  assert.ok(appSrc.includes("besediloPolje.value = predlog.besedilo"));
});

test("13. Obvestilo samo pri neusklajenem tonu", () => {
  assert.ok(
    appSrc.includes(
      "Izberite predlogo, da uporabite novi ton v sporočilu."
    )
  );
  assert.ok(appSrc.includes("applied === selected"));
});

test("14. Števec predlog / 6 na ton", () => {
  const vsi = Predloge.sestaviSistemskePredloge({ znesek: 1 }, "de");
  UJ.TONI.forEach((t) => {
    assert.equal(Predloge.filtrirajPredloge(vsi, t.id, "de").length, 6);
  });
});

test("15. Osnutek obnovi toneRecommendation", () => {
  assert.ok(appSrc.includes("toneRecommendation"));
  assert.ok(appSrc.includes("applyRecommendationToState"));
  assert.ok(appSrc.includes("sporociloRocnoUrejeno"));
});

test("Sprejemni: 75,64 € še ni zapadel → Zelo prijazen", () => {
  const r = rec(-3, 7564);
  assert.equal(r.recommendedToneId, "very_friendly");
  assert.equal(r.timingLabel, "Še ni zapadlo");
  assert.ok(r.amountLabel.includes("75"));
});

test("Kompaktni UI: pills, brez pik, višina seznama", () => {
  assert.ok(cssSrc.includes(".ton-widget__gumb"));
  assert.ok(!cssSrc.includes(".ton-widget__pika--aktivna"));
  assert.ok(cssSrc.includes("height: 230px"));
  assert.ok(!widgetSrc.includes("Povlecite levo"));
});

console.log("\nUspešnih: " + ok);
