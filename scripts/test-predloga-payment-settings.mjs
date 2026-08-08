/**
 * Testi: paymentSettings predloge + recept za Uporabi.
 * Zagon: node scripts/test-predloga-payment-settings.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const UJ = require(join(root, "app", "rok-placila-utils.js"));
const UJO = require(join(root, "app", "obrocno-utils.js"));
const api = require(join(root, "app", "predloga-payment-settings.js"));

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

test("null / undefined → ni paketa", () => {
  assert.equal(api.normalizirajPaymentSettings(null), null);
  assert.equal(api.normalizirajPaymentSettings(undefined), null);
  assert.equal(api.pripraviUveljavitev(null), null);
  assert.equal(api.imaPaymentSettings({ paymentSettings: null }), false);
});

test("XOR: rok + obročno → obročno off", () => {
  const p = api.normalizirajPaymentSettings({
    rok: { enabled: true, mode: "manual", termDays: 7, deadlineDate: "2099-01-01" },
    obrocno: { enabled: true, installmentCount: 4, intervalType: "monthly" },
    trr: { enabled: true },
  });
  assert.equal(p.rok.enabled, true);
  assert.equal(p.rok.mode, "automatic");
  assert.equal(p.rok.termDays, 7);
  assert.equal(p.rok.deadlineDate, undefined);
  assert.equal(p.obrocno.enabled, false);
  assert.equal(p.trr.enabled, true);

  const n = api.pripraviUveljavitev(p);
  assert.equal(n.resetDodatke, true);
  assert.deepEqual(n.rok, { termDays: 7, mode: "automatic" });
  assert.equal(n.obrocno, null);
  assert.equal(n.trr, true);
});

test("prazen paket: reset, nič vključeno", () => {
  const prazen = api.normalizirajPaymentSettings({
    rok: { enabled: false, termDays: 14 },
    obrocno: { enabled: false, installmentCount: 2 },
    trr: { enabled: false },
  });
  assert.ok(prazen != null);
  assert.equal(api.imaPaymentSettings({ paymentSettings: prazen }), true);
  const n = api.pripraviUveljavitev(prazen);
  assert.equal(n.resetDodatke, true);
  assert.equal(n.rok, null);
  assert.equal(n.obrocno, null);
  assert.equal(n.trr, false);
});

test("Uporabi z rok", () => {
  const n = api.pripraviUveljavitev({
    rok: { enabled: true, termDays: 10 },
    obrocno: { enabled: false },
    trr: { enabled: false },
  });
  assert.equal(n.resetDodatke, true);
  assert.equal(n.rok.termDays, 10);
  assert.equal(n.obrocno, null);
  assert.equal(n.trr, false);

  const base = "2026-08-08";
  const deadline = UJ.izracunajRok(base, n.rok.termDays);
  assert.equal(deadline, "2026-08-18");
  const vrstica = UJ.sestaviVrsticoRoka(deadline, "sl");
  const rez = UJ.posodobiSistemskoVrstico("Pozdravljeni.", "", vrstica, true);
  assert.match(String(rez.besedilo), /2026-08-18|18\.\s*8\.\s*2026|18\.08\.2026/);
});

test("Uporabi z obročno", () => {
  const n = api.pripraviUveljavitev({
    rok: { enabled: false },
    obrocno: { enabled: true, installmentCount: 3, intervalType: "biweekly" },
    trr: { enabled: false },
  });
  assert.equal(n.rok, null);
  assert.equal(n.obrocno.installmentCount, 3);
  assert.equal(n.obrocno.intervalType, "biweekly");

  let plan = UJO.getInstallmentSuggestion({
    totalDebtCents: 30000,
    plannedSendDate: "2026-08-08",
    language: "sl",
  });
  plan = UJO.nastaviSteviloObrokov(plan, n.obrocno.installmentCount);
  plan = UJO.nastaviRazmik(plan, n.obrocno.intervalType);
  plan = UJO.osveziAddon(plan, "sl");
  assert.equal(plan.installments.length, 3);
  assert.ok(String(plan.addonText || "").length > 0);
});

test("Uporabi z TRR", () => {
  const n = api.pripraviUveljavitev({
    rok: { enabled: false },
    obrocno: { enabled: false },
    trr: { enabled: true },
  });
  assert.equal(n.resetDodatke, true);
  assert.equal(n.rok, null);
  assert.equal(n.obrocno, null);
  assert.equal(n.trr, true);
  const iban = "SI56 1234 5678 9012 345";
  const vrstica = "TRR: " + iban + ".";
  const rez = UJ.posodobiSistemskoVrstico("Besedilo.", "", vrstica, true);
  assert.ok(String(rez.besedilo).includes(vrstica));
});

test("brez paketa: ne resetiraj (pusti dodatke)", () => {
  const n = api.pripraviUveljavitev(null);
  assert.equal(n, null);
  // Simulacija: če navodilo ni, stanje dodatkov ostane.
  const dodatkiPred = { rok: true, obrocno: false, trr: true };
  const dodatkiPo = n ? { rok: false, obrocno: false, trr: false } : { ...dodatkiPred };
  assert.deepEqual(dodatkiPo, dodatkiPred);
});

test("rok + TRR skupaj", () => {
  const n = api.pripraviUveljavitev({
    rok: { enabled: true, termDays: 5 },
    obrocno: { enabled: true, installmentCount: 4 },
    trr: { enabled: true },
  });
  assert.ok(n.rok);
  assert.equal(n.obrocno, null);
  assert.equal(n.trr, true);
});

console.log("Skupaj OK: " + ok);
