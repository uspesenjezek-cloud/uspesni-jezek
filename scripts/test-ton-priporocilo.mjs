/**
 * Enotski testi: Ton sporočila (kategorije, zamuda, priporočilo, widget).
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

test("Kategorije dolga – mejne vrednosti", () => {
  assert.equal(UJ.getDebtCategory(75.64), "low");
  assert.equal(UJ.getDebtCategory(250), "low");
  assert.equal(UJ.getDebtCategory(250.01), "medium");
  assert.equal(UJ.getDebtCategory(1000), "medium");
  assert.equal(UJ.getDebtCategory(1000.01), "high");
  assert.equal(UJ.getDebtCategory(5000), "high");
  assert.equal(UJ.getDebtCategory(5000.01), "veryHigh");
  assert.equal(UJ.DEBT_CATEGORY_LABELS.low, "Nizek dolg");
});

test("Kategorije zamude – mejne vrednosti", () => {
  assert.equal(UJ.getOverdueCategory(-1), "notDue");
  assert.equal(UJ.getOverdueCategory(0), "dueToday");
  assert.equal(UJ.getOverdueCategory(1), "short");
  assert.equal(UJ.getOverdueCategory(7), "short");
  assert.equal(UJ.getOverdueCategory(8), "medium");
  assert.equal(UJ.getOverdueCategory(30), "medium");
  assert.equal(UJ.getOverdueCategory(31), "long");
  assert.equal(UJ.getOverdueCategory(60), "long");
  assert.equal(UJ.getOverdueCategory(61), "veryLong");
});

test("Oznake zapadlosti (slovenščina)", () => {
  assert.equal(UJ.oznakaCasovnosti(-3), "Ni zapadlo · Brez zamude");
  assert.equal(UJ.oznakaCasovnosti(0), "Zapade danes");
  assert.equal(UJ.oznakaCasovnosti(1), "Zamuda 1 dan · Kratka zamuda");
  assert.equal(UJ.oznakaCasovnosti(3), "Zamuda 3 dni · Kratka zamuda");
  assert.equal(UJ.oznakaCasovnosti(18), "Zamuda 18 dni · Srednja zamuda");
  assert.equal(UJ.oznakaCasovnosti(45), "Zamuda 45 dni · Dolga zamuda");
  assert.equal(UJ.oznakaCasovnosti(75), "Zamuda 75 dni · Zelo dolga zamuda");
});

test("75,64 € še ni zapadel → Nizek dolg + Prijazen", () => {
  const r = rec(-3, 7564);
  assert.equal(r.debtCategory, "low");
  assert.equal(r.debtCategoryLabel, "Nizek dolg");
  assert.equal(r.recommendedToneId, "friendly");
  assert.equal(r.timingLabel, "Ni zapadlo · Brez zamude");
  assert.ok(r.amountLabel.includes("75"));
});

test("Priporočilo glede na zamudo (nizek dolg)", () => {
  assert.equal(rec(-5, 7564).recommendedToneId, "friendly");
  assert.equal(rec(0, 7564).recommendedToneId, "friendly");
  assert.equal(rec(5, 7564).recommendedToneId, "friendly");
  assert.equal(rec(10, 7564).recommendedToneId, "neutral");
  assert.equal(rec(45, 7564).recommendedToneId, "firm");
  assert.equal(rec(75, 7564).recommendedToneId, "strict");
});

test("Znesek doda največ en korak (visok dolg, 10 dni)", () => {
  const r = rec(10, 200000); // 2000 € → high, overdue medium → base 2 + boost 1 = firm
  assert.equal(r.debtCategory, "high");
  assert.equal(r.recommendedToneId, "firm");
});

test("Pred zapadlostjo nikoli strožje od Prijazen", () => {
  const r = rec(-3, 500001); // > 5000 €
  assert.equal(r.debtCategory, "veryHigh");
  assert.equal(r.recommendedToneId, "friendly");
});

test("Ročna izbira se ohrani ob spremembi zneska", () => {
  const first = rec(10, 7564);
  let state = UJ.applyRecommendationToState(null, first);
  state = UJ.selectTone(state, "firm");
  assert.equal(state.selectionMode, "manual");
  assert.equal(state.isOverridden, true);
  const second = UJ.getRecommendedTone({
    totalDebtCents: 30000,
    originalDueDate: "2026-07-29",
    evaluationDate: "2026-08-09",
    overdueDays: 11,
  });
  state = UJ.applyRecommendationToState(state, second);
  assert.equal(state.selectedToneId, "firm");
  assert.equal(state.selectionMode, "manual");
  assert.notEqual(state.recommendedToneId, "firm");
});

test("Samodejni način posodobi ton ob spremembi", () => {
  let state = UJ.applyRecommendationToState(null, rec(-2, 7564));
  assert.equal(state.selectionMode, "automatic");
  assert.equal(state.selectedToneId, "friendly");
  state = UJ.applyRecommendationToState(state, rec(45, 7564));
  assert.equal(state.selectionMode, "automatic");
  assert.equal(state.selectedToneId, "firm");
});

test("Ponastavitev vrne priporočeni ton", () => {
  let state = UJ.applyRecommendationToState(null, rec(10, 7564));
  state = UJ.selectTone(state, "strict");
  assert.equal(state.selectionMode, "manual");
  state = UJ.resetToRecommended(state);
  assert.equal(state.selectedToneId, "neutral");
  assert.equal(state.selectionMode, "automatic");
  assert.equal(state.isOverridden, false);
});

test("Ikone tonov", () => {
  const map = {
    very_friendly: "smile-plus",
    friendly: "smile",
    neutral: "meh",
    firm: "triangle-alert",
    strict: "circle-alert",
  };
  assert.equal(UJ.TONI.length, 5);
  UJ.TONI.forEach((t) => {
    assert.equal(t.iconKey, map[t.id]);
    assert.ok(widgetSrc.includes(t.iconKey));
  });
});

test("UI: povzetek, Ponastavi v glavi, scroll-snap", () => {
  assert.ok(htmlSrc.includes("ton-widget__povzetek"));
  assert.ok(htmlSrc.includes('id="ton-ponastavi"'));
  assert.ok(htmlSrc.includes("ton-widget__glava-desno"));
  assert.ok(cssSrc.includes("scroll-snap-type: x mandatory"));
  assert.ok(cssSrc.includes("flex: 0 0 138px"));
  assert.ok(cssSrc.includes("min-height: 68px"));
  assert.ok(cssSrc.includes(".ton-widget__gumb--izbran"));
  assert.ok(/\.ton-widget__gumb--izbran[\s\S]*?color:\s*#ffffff/.test(cssSrc));
  assert.ok(!/\.ton-widget[\s\S]{0,400}height:\s*230px/.test(cssSrc));
  assert.ok(!cssSrc.includes("min-height: 148px"));
});

test("Predloge se filtrirajo po tonu", () => {
  const vsi = Predloge.sestaviSistemskePredloge(
    { znesek: 75.64, stevilkaRacuna: "1", datumZapadlosti: "2026-08-20" },
    "de"
  );
  assert.equal(vsi.length, 30);
  const vf = Predloge.filtrirajPredloge(vsi, "very_friendly", "de");
  assert.equal(vf.length, 6);
  assert.ok(vf.every((p) => p.toneId === "very_friendly"));
});

test("Predloge se filtrirajo po jeziku", () => {
  const vsi = Predloge.sestaviSistemskePredloge({ znesek: 10 }, "de");
  assert.equal(Predloge.filtrirajPredloge(vsi, "friendly", "sl").length, 0);
  assert.equal(Predloge.filtrirajPredloge(vsi, "friendly", "de").length, 6);
});

test("Menjava tona ne prepiše sporočila (app.js)", () => {
  assert.ok(appSrc.includes("ne prepiše glavnega sporočila"));
  assert.ok(!appSrc.includes("uporabiTonInPrivzetoPredlogo"));
  assert.ok(appSrc.includes("onToneSelected:"));
  assert.ok(appSrc.includes("nastaviIzbranTon(toneId, true)"));
  assert.ok(
    appSrc.includes(
      "Izberite predlogo, da uporabite novi ton v sporočilu."
    )
  );
});

test("Zakaj modal + Razumem", () => {
  assert.ok(appSrc.includes("onShowReasonDetail"));
  assert.ok(appSrc.includes("Razumem"));
  assert.ok(appSrc.includes("odstavki"));
  const razlaga = UJ.sestaviRazlagoZaModal(rec(-3, 7564));
  assert.equal(razlaga.naslov, "Zakaj priporočamo ta ton?");
  assert.equal(razlaga.odstavki.length, 3);
  assert.ok(razlaga.odstavki[2].besedilo.includes("prijazen"));
});

test("Osnutek shrani selectionMode + posnetek ob pošiljanju", () => {
  assert.ok(appSrc.includes("toneRecommendation"));
  assert.ok(appSrc.includes("selectionMode"));
  assert.ok(appSrc.includes("toneSnapshotAtSend"));
  assert.ok(appSrc.includes("recommendedToneAtSend"));
});

test("Brez datuma → Prijazen", () => {
  const r = UJ.getRecommendedTone({
    totalDebtCents: 500001,
    originalDueDate: null,
    evaluationDate: "2026-08-08",
  });
  assert.equal(r.recommendedToneId, "friendly");
  assert.equal(r.missingDue, true);
});

console.log("\nUspešnih: " + ok);
