/**
 * Simulacija UI tokov: blur/Done mora potrditi ročni znesek (ne zavreči).
 * Zagon: node scripts/test-obrocno-blur-ui.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const UJ = require(path.join(root, "..", "app", "obrocno-utils.js"));

// 1) Parse "3000" (brez vejice) → 300000 centov
assert.equal(UJ.parseAmountToCents("3000"), 300000);
assert.equal(UJ.parseAmountToCents("3000,00"), 300000);
assert.equal(UJ.parseAmountToCents("3.000,00"), 300000);

// 2) Simulacija: uporabnik vneše "3000" in potrdi (blur/V redu)
let plan = UJ.getInstallmentSuggestion({
  totalDebtCents: 500000,
  priority: 5,
  plannedSendDate: "2026-08-08",
  language: "sl",
});
plan = UJ.nastaviSteviloObrokov(plan, 3);
const firstId = plan.installments[0].id;

// Uporabnik med fokusom vidi editable obliko
const editable = UJ.formatCentsEditable(plan.installments[0].amountCents);
assert.match(editable, /^\d+,\d{2}$/);

// Vnos "3000" + potrditev = nastaviRocniZnesek
const vneseno = UJ.filtrirajZnesekVnos("3000");
const cents = UJ.parseAmountToCents(vneseno);
assert.equal(cents, 300000);
plan = UJ.nastaviRocniZnesek(plan, firstId, cents);
plan = UJ.osveziAddon(plan, "sl");

assert.equal(plan.installments[0].amountMode, "manual");
assert.deepEqual(
  plan.installments.map((r) => r.amountCents),
  [300000, 100000, 100000]
);
assert.equal(UJ.vsotaCents(plan.installments), 500000);
assert.equal(UJ.validatePlan(plan).ok, true);
assert.ok(plan.addonText.includes("3000,00 €"));
assert.ok(plan.addonText.includes("1000,00 €"));

console.log("OK  blur/Done tok: 5000 € / 3 → prvi 3000 € (Ročno), ostala 1000 €");
console.log(
  "    ",
  plan.installments.map((r) => UJ.formatCentsSl(r.amountCents) + " [" + r.amountMode + "]").join(" | ")
);
console.log("    vsota:", UJ.formatCentsSl(UJ.vsotaCents(plan.installments)));
