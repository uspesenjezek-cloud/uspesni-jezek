/**
 * Enotski testi: Obročno plačilo.
 * Zagon: node scripts/test-obrocno.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const UJ = require(path.join(root, "..", "app", "obrocno-utils.js"));

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

test("1–2. Enakomerna delitev 75,64 € / 5", () => {
  const parts = UJ.splitCentsEvenly(7564, 5);
  assert.deepEqual(parts, [1513, 1513, 1513, 1513, 1512]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 7564);
});

test("3–4. Ročni prvi 50 € → 6,41 × 4", () => {
  let plan = UJ.getInstallmentSuggestion({
    totalDebtCents: 7564,
    originalDueDate: "2026-07-01",
    plannedSendDate: "2026-08-08",
    overdueDays: 38,
    priority: 5,
    language: "sl",
  });
  plan = UJ.nastaviSteviloObrokov(plan, 5);
  const firstId = plan.installments[0].id;
  plan = UJ.nastaviRocniZnesek(plan, firstId, 5000);
  const cents = plan.installments.map((r) => r.amountCents);
  assert.deepEqual(cents, [5000, 641, 641, 641, 641]);
  assert.equal(plan.installments[0].amountMode, "manual");
  assert.equal(UJ.vsotaCents(plan.installments), 7564);
});

test("5. Dva ročna zneska", () => {
  let plan = UJ.getInstallmentSuggestion({
    totalDebtCents: 7564,
    plannedSendDate: "2026-08-08",
    priority: 5,
  });
  plan = UJ.nastaviSteviloObrokov(plan, 5);
  plan = UJ.nastaviRocniZnesek(plan, plan.installments[0].id, 5000);
  plan = UJ.nastaviRocniZnesek(plan, plan.installments[1].id, 1000);
  const auto = plan.installments.slice(2).map((r) => r.amountCents);
  assert.deepEqual(auto, [522, 521, 521]);
  assert.equal(UJ.vsotaCents(plan.installments), 7564);
});

test("6. Brez izgube centov", () => {
  for (let n = 2; n <= 20; n++) {
    const p = UJ.splitCentsEvenly(7564, n);
    assert.equal(p.reduce((a, b) => a + b, 0), 7564);
  }
});

test("7–8. Zavrnitev 0 in negativnega", () => {
  let plan = UJ.getInstallmentSuggestion({ totalDebtCents: 7564, priority: 5 });
  plan = UJ.nastaviSteviloObrokov(plan, 3);
  plan.installments[0].amountCents = 0;
  plan.installments[0].amountMode = "manual";
  let v = UJ.validatePlan(plan);
  assert.equal(v.ok, false);
  plan.installments[0].amountCents = -100;
  v = UJ.validatePlan(plan);
  assert.equal(v.ok, false);
});

test("9. Ročni zneski nad dolgom", () => {
  let plan = UJ.getInstallmentSuggestion({ totalDebtCents: 7564, priority: 5 });
  plan = UJ.nastaviSteviloObrokov(plan, 3);
  plan = UJ.nastaviRocniZnesek(plan, plan.installments[0].id, 8000);
  const v = UJ.validatePlan(plan);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.code === "manual_over"));
});

test("10–11. Odstranitev + razveljavi", () => {
  let plan = UJ.getInstallmentSuggestion({ totalDebtCents: 7564, priority: 5 });
  plan = UJ.nastaviSteviloObrokov(plan, 5);
  plan = UJ.nastaviRocniZnesek(plan, plan.installments[0].id, 5000);
  const id = plan.installments[2].id;
  const rez = UJ.odstraniObrok(plan, id);
  assert.equal(rez.ok, true);
  assert.equal(rez.plan.installmentCount, 4);
  const auto = rez.plan.installments.slice(1).map((r) => r.amountCents);
  assert.deepEqual(auto, [855, 855, 854]);
  assert.equal(UJ.vsotaCents(rez.plan.installments), 7564);
  plan = UJ.razveljaviOdstranitev(rez.plan, rez.undo);
  assert.equal(plan.installmentCount, 5);
  assert.equal(UJ.vsotaCents(plan.installments), 7564);
});

test("12–13. Min 2 / max 20", () => {
  let plan = UJ.getInstallmentSuggestion({ totalDebtCents: 7564, priority: 5 });
  plan = UJ.nastaviSteviloObrokov(plan, 2);
  const rez = UJ.odstraniObrok(plan, plan.installments[0].id);
  assert.equal(rez.ok, false);
  assert.equal(rez.code, "min_two");
  plan = UJ.nastaviSteviloObrokov(plan, 25);
  assert.equal(plan.installmentCount, 20);
});

test("14–16. Tedenski / dvotedenski / mesečni datumi", () => {
  let plan = UJ.getInstallmentSuggestion({
    totalDebtCents: 7564,
    plannedSendDate: "2026-08-08",
    originalDueDate: "2026-07-01",
    priority: 5,
  });
  plan = UJ.nastaviSteviloObrokov(plan, 3);
  plan.firstDueDate = "2026-08-28";
  plan = UJ.nastaviRazmik(plan, "weekly");
  assert.equal(plan.installments[1].dueDate, "2026-09-04");
  plan = UJ.nastaviRazmik(plan, "biweekly");
  assert.equal(plan.installments[1].dueDate, "2026-09-11");
  plan = UJ.nastaviRazmik(plan, "monthly");
  assert.equal(plan.installments[1].dueDate, "2026-09-28");
  assert.equal(plan.installments[2].dueDate, "2026-10-28");
});

test("17. Konec meseca / februar", () => {
  assert.equal(UJ.dodajKoledarskeMesce("2026-01-31", 1), "2026-02-28");
  assert.equal(UJ.dodajKoledarskeMesce("2024-01-31", 1), "2024-02-29");
  assert.equal(UJ.dodajKoledarskeMesce("2026-01-31", 2), "2026-03-31");
});

test("18. Ročni datum → Po meri", () => {
  let plan = UJ.getInstallmentSuggestion({
    totalDebtCents: 7564,
    plannedSendDate: "2026-08-08",
    priority: 5,
  });
  plan = UJ.nastaviSteviloObrokov(plan, 3);
  plan = UJ.nastaviRazmik(plan, "monthly");
  plan = UJ.nastaviDatum(plan, plan.installments[1].id, "2026-10-15");
  assert.equal(plan.intervalType, "custom");
});

test("19. Brez UTC premika", () => {
  const d = UJ.parseLocalYYYYMMDD("2026-08-28");
  assert.equal(d.getDate(), 28);
  assert.equal(UJ.formatLocalYYYYMMDD(d), "2026-08-28");
});

test("20. Skupaj = dolg", () => {
  let plan = UJ.getInstallmentSuggestion({ totalDebtCents: 7564, priority: 5 });
  plan = UJ.nastaviSteviloObrokov(plan, 5);
  plan = UJ.nastaviRocniZnesek(plan, plan.installments[0].id, 5000);
  assert.equal(UJ.vsotaCents(plan.installments), plan.totalDebtCents);
  const v = UJ.validatePlan(plan);
  assert.equal(v.ok, true);
});

test("eurosToCents podpira vejico", () => {
  assert.equal(UJ.eurosToCents("75,64"), 7564);
  assert.equal(UJ.eurosToCents("75.64"), 7564);
  assert.equal(UJ.eurosToCents(75.64), 7564);
  assert.equal(UJ.formatCentsSl(7564), "75,64 €");
});

test("jePlanUporaben zavrne neusklajen dolg / 1 vrstico", () => {
  let plan = UJ.getInstallmentSuggestion({
    totalDebtCents: 7564,
    priority: 5,
    plannedSendDate: "2026-08-08",
  });
  plan = UJ.nastaviSteviloObrokov(plan, 5);
  plan.enabled = true;
  assert.equal(UJ.jePlanUporaben(plan, 7564), true);
  assert.equal(UJ.jePlanUporaben(plan, 9999), false);
  plan.installments = plan.installments.slice(0, 1);
  plan.installmentCount = 5;
  assert.equal(UJ.jePlanUporaben(plan, 7564), false);
  plan = UJ.uskladiSteviloVrstic({
    totalDebtCents: 7564,
    installmentCount: 5,
    installments: [{ id: "a", order: 1, amountCents: 100, amountMode: "automatic", dueDate: "2026-08-28" }],
    intervalType: "monthly",
    firstDueDate: "2026-08-28",
  });
  assert.equal(plan.installments.length, 5);
  assert.equal(plan.installmentCount, 5);
});

test("Sprejemni: 75,64 € / 5 obrokov", () => {
  const cents = UJ.eurosToCents("75,64");
  assert.equal(cents, 7564);
  let plan = UJ.getInstallmentSuggestion({
    totalDebtCents: cents,
    priority: 5,
    plannedSendDate: "2026-08-08",
    originalDueDate: "2026-07-01",
    language: "sl",
  });
  plan = UJ.nastaviSteviloObrokov(plan, 5);
  plan = UJ.uskladiSteviloVrstic(plan);
  assert.equal(UJ.formatCentsSl(plan.totalDebtCents), "75,64 €");
  assert.equal(plan.installments.length, 5);
  assert.deepEqual(
    plan.installments.map((r) => r.amountCents),
    [1513, 1513, 1513, 1513, 1512]
  );
  assert.equal(UJ.validatePlan(plan).ok, true);
});

test("Addon SL s 50 €", () => {
  let plan = UJ.getInstallmentSuggestion({
    totalDebtCents: 7564,
    plannedSendDate: "2026-08-01",
    originalDueDate: "2026-07-01",
    priority: 5,
    language: "sl",
  });
  plan = UJ.nastaviSteviloObrokov(plan, 5);
  plan.firstDueDate = "2026-08-28";
  plan = UJ.nastaviRazmik(plan, "monthly");
  plan = UJ.nastaviRocniZnesek(plan, plan.installments[0].id, 5000);
  plan = UJ.osveziAddon(plan, "sl");
  assert.ok(plan.addonText.includes("5 obrokih"));
  assert.ok(plan.addonText.includes("50,00 €"));
  assert.ok(plan.addonText.includes("6,41 €"));
  assert.ok(plan.addonText.includes("28. 8. 2026"));
});

console.log("\nUspešnih: " + ok);
