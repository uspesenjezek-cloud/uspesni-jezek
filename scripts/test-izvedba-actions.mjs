/**
 * Testi: produkcijska stran "Izvedba" (api/_lib/izvedba-core.js + varnostne
 * lastnosti API poti/migracije/frontenda).
 *
 * Poslovna logika (izracunaj* funkcije) je testirana FUNKCIONALNO, brez žive
 * baze - enako kot obstoječi vzorec v scripts/test-scheduler.js (_test
 * exports). Nekatere zahteve iz razdelka 21 specifikacije (idempotenca
 * action_id, VERSION_CONFLICT/403 odgovori, obnašanje schedulerja) ni mogoče
 * preveriti brez prave Postgres povezave - za te je tu STRUKTURNI test nad
 * izvorno kodo API poti/migracije/frontenda (enak vzorec kot obstoječi testi
 * "migracija omeji RPC funkcije na service_role" / "Random sheet vsebuje..."
 * v test-scheduler.js). Pravi integracijski testi nad RPC-ji so v ločeni
 * scripts/test-izvedba-rpc-integration.mjs (zahteva TEST_DATABASE_URL).
 *
 * Zagon: node scripts/test-izvedba-actions.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const core = require(path.join(root, "..", "api", "_lib", "izvedba-core.js"));

function citaj(relPot) {
  return fs.readFileSync(path.join(root, "..", relPot), "utf8");
}

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (err) {
    console.error("  ✗ " + name);
    throw err;
  }
}

function korak(prekritje) {
  return Object.assign(
    {
      id: "s1", stepId: "s1", stepIndex: 1, recipientIndex: 0, kanal: "sms",
      status: "scheduled", executionState: "scheduled",
      scheduledAt: "2026-08-20T08:00:00.000Z", sentAt: null,
      sporocilo: "Prosimo poravnajte 100,00 €.", prejemnik: "+38640111222",
    },
    prekritje
  );
}

function osnovniPlan(steps) {
  return { id: "plan-1", version: "3", status: "active", steps: steps };
}

async function main() {
  console.log("\nIzvedba - poslovna logika in strukturne varnostne preverbe");

  // ---------- 1-8: dostopnost/varnost UI (strukturno) ----------

  await test("1) selectedActionType je skalar - naenkrat izbrana samo ena kartica", function () {
    const src = citaj("app/izvedba.js");
    assert.match(src, /function izberiAkcijo\(actionType\)\s*{[\s\S]*?state\.selectedActionType = actionType;/);
  });

  await test("2) izbrana kartica dobi obrobo in kljukico (CSS)", function () {
    const css = citaj("app/izvedba.css");
    assert.match(css, /\.izvedba-kartica\.is-selected\s*{[^}]*border-color/);
    assert.match(css, /\.izvedba-kartica\.is-selected \.izvedba-kartica__kljukica\s*{[^}]*display:\s*flex/);
  });

  await test("3) klik +/- najprej izbere pripadajočo kartico, nato spremeni vrednost", function () {
    const src = citaj("app/izvedba.js");
    assert.match(
      src,
      /izberiAkcijo\((\w+)\);\s*posodobiStevec\(\1,/,
      "izberiAkcijo mora biti klican pred posodobiStevec v istem handlerju"
    );
  });

  await test("4) klik kontrolnika ne sproži izbire druge kartice (stopPropagation)", function () {
    const src = citaj("app/izvedba.js");
    const steviloPojavitev = (src.match(/event\.stopPropagation\(\)/g) || []).length;
    assert.ok(steviloPojavitev >= 2, "pričakovan stopPropagation() tako za stevec kot za segment kontrolnik");
  });

  await test("5) dvojni klik ne podvoji ukrepa (isSubmitting guard)", function () {
    const src = citaj("app/izvedba.js");
    assert.match(src, /async function submitSelectedAction\(\)\s*{\s*if \(state\.isSubmitting\) return;/);
    assert.match(src, /if \(!pripravljeno\)/);
  });

  await test("6) isti actionId se ponovno uporabi pri istem izbranem dejanju (retry)", function () {
    const src = citaj("app/izvedba.js");
    assert.match(src, /state\.pendingActionId && state\.pendingActionType === pendingType\s*\?\s*state\.pendingActionId/);
  });

  await test("7) VERSION_CONFLICT se preslika v HTTP 409 v obeh API poteh", function () {
    assert.match(citaj("api/izvedi-opomin-ukrep.js"), /VERSION_CONFLICT:\s*409/);
    assert.match(citaj("api/poslji-opomin-zdaj.js"), /VERSION_CONFLICT:\s*409/);
  });

  await test("8) tuj uporabnik (ni lastnik zadeve) dobi HTTP 403", function () {
    for (const pot of ["api/izvedi-opomin-ukrep.js", "api/poslji-opomin-zdaj.js", "api/pridobi-izvedbo.js"]) {
      const src = citaj(pot);
      assert.match(src, /obrtnik_id !== auth\.user\.id/, pot + " mora preveriti lastništvo zadeve");
      assert.match(src, /status\(403\)/, pot + " mora vrniti 403 ob tujem lastniku");
    }
  });

  // ---------- 9-16: funkcionalna poslovna logika ----------

  await test("9) preklic koraka premakne naslednji neposlani korak naprej", function () {
    const koraki = [korak({ id: "k1", stepId: "s1", stepIndex: 1 }), korak({ id: "k2", stepId: "s2", stepIndex: 2, scheduledAt: "2026-08-22T08:00:00.000Z" })];
    const plan = osnovniPlan([
      { id: "s1", index: 1, kind: "sms", isExcluded: false, status: "scheduled" },
      { id: "s2", index: 2, kind: "sms", isExcluded: false, status: "scheduled", sendAt: "2026-08-22T08:00:00.000Z", scheduledAt: "2026-08-22T08:00:00.000Z" },
    ]);
    const rezultat = core._test.izracunajPreklicKoraka({ plan, koraki, stepId: "s1", settings: { nextDelayDays: 3 } });
    assert.equal(rezultat.ok, true);
    assert.equal(rezultat.nextStepId, "s2");
    const posodobitevK2 = rezultat.korakiUpdates.find((u) => u.id === "k2");
    assert.ok(posodobitevK2 && posodobitevK2.scheduled_at, "naslednji korak mora dobiti nov termin");
    assert.ok(Date.parse(posodobitevK2.scheduled_at) > Date.now(), "nov termin naslednjega koraka mora biti v prihodnosti");
    const posodobitevK1 = rezultat.korakiUpdates.find((u) => u.id === "k1");
    assert.equal(posodobitevK1.execution_state, "skipped");
  });

  await test("preklic že poslanega koraka je zavrnjen", function () {
    const koraki = [korak({ id: "k1", stepId: "s1", executionState: "sent" })];
    const plan = osnovniPlan([{ id: "s1", index: 1, kind: "sms", isExcluded: false }]);
    const rezultat = core._test.izracunajPreklicKoraka({ plan, koraki, stepId: "s1", settings: { nextDelayDays: 3 } });
    assert.equal(rezultat.ok, false);
    assert.equal(rezultat.code, "STEP_ALREADY_SENT");
  });

  await test("10) ustavitev načrta postavi vse neposlane korake na 'paused' (worker jih ne sme prevzeti)", function () {
    const koraki = [
      korak({ id: "k1", stepId: "s1", executionState: "sent" }),
      korak({ id: "k2", stepId: "s2", executionState: "scheduled" }),
      korak({ id: "k3", stepId: "s3", executionState: "awaiting_confirmation" }),
    ];
    const plan = osnovniPlan([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);
    const rezultat = core._test.izracunajUstavitevNacrta({ plan, koraki, settings: { resumeMode: "manual", resumeAt: null } });
    assert.equal(rezultat.ok, true);
    assert.equal(rezultat.korakiUpdates.length, 2, "poslani korak (k1) se ne sme dotakniti");
    assert.ok(rezultat.korakiUpdates.every((u) => u.execution_state === "paused"));
    assert.equal(rezultat.newPlan.status, "paused");
  });

  await test("scheduler (SQL) prevzame samo execution_state='ready_to_send' - 'paused' ni med vejami", function () {
    const sql = citaj("supabase/migrations/20260814200000_izvedba.sql");
    const funkcija = sql.slice(sql.indexOf("function public.prevzemi_zapadle_opomine"), sql.indexOf("$$;", sql.indexOf("function public.prevzemi_zapadle_opomine")));
    assert.match(funkcija, /execution_state = 'ready_to_send'/);
    assert.doesNotMatch(funkcija, /execution_state = 'awaiting_confirmation'/);
    assert.doesNotMatch(funkcija, /execution_state = 'paused'/);
  });

  await test("11) prestavitev opomina premakne trenutni in vse prihodnje neposlane korake za enak zamik", function () {
    const koraki = [
      korak({ id: "k1", stepId: "s1", scheduledAt: "2026-08-20T08:00:00.000Z" }),
      korak({ id: "k2", stepId: "s2", scheduledAt: "2026-08-23T08:00:00.000Z" }),
      korak({ id: "k3", stepId: "s3", executionState: "sent", scheduledAt: "2026-08-25T08:00:00.000Z" }),
    ];
    const plan = osnovniPlan([
      { id: "s1", index: 1, sendAt: "2026-08-20T08:00:00.000Z", scheduledAt: "2026-08-20T08:00:00.000Z" },
      { id: "s2", index: 2, sendAt: "2026-08-23T08:00:00.000Z", scheduledAt: "2026-08-23T08:00:00.000Z" },
      { id: "s3", index: 3, sendAt: "2026-08-25T08:00:00.000Z", scheduledAt: "2026-08-25T08:00:00.000Z" },
    ]);
    const rezultat = core._test.izracunajPrestavitevOpomina({ plan, koraki, stepId: "s1", settings: { delayDays: 5 } });
    assert.equal(rezultat.ok, true);
    const u1 = rezultat.korakiUpdates.find((u) => u.id === "k1");
    const u2 = rezultat.korakiUpdates.find((u) => u.id === "k2");
    const u3 = rezultat.korakiUpdates.find((u) => u.id === "k3");
    assert.equal(Date.parse(u1.scheduled_at), Date.parse("2026-08-25T08:00:00.000Z"));
    assert.equal(Date.parse(u2.scheduled_at), Date.parse("2026-08-28T08:00:00.000Z"));
    assert.equal(u3, undefined, "že poslan korak se ne sme premakniti");
  });

  await test("12) obljubljeno plačilo ničesar ne pošlje - samo zaklene korake (paused)", function () {
    const koraki = [korak({ id: "k1", stepId: "s1", executionState: "awaiting_confirmation" })];
    const plan = osnovniPlan([{ id: "s1" }]);
    const rezultat = core._test.izracunajObljuboPlacila({ plan, koraki, settings: { waitDays: 4 } });
    assert.equal(rezultat.ok, true);
    assert.equal(rezultat.korakiUpdates.length, 1);
    assert.equal(rezultat.korakiUpdates[0].execution_state, "paused");
    assert.notEqual(rezultat.korakiUpdates[0].execution_state, "ready_to_send");
    assert.equal(rezultat.newPlan.status, "waiting_for_promised_payment");
    assert.ok(rezultat.newPlan.promisedPaymentUntil);
  });

  await test("13) delno plačilo: validacija izračuna pravilen znesek plačila in mejo", function () {
    const validacija = core.validirajNastavitve("partial_payment", { remainingAmount: 40, settledAt: "2026-08-20T10:30:00Z" }, { preostaliDolg: 100 });
    assert.equal(validacija.ok, true);
    assert.equal(validacija.placiloZnesek, 60);
    assert.equal(validacija.settings.settledAt, "2026-08-20T10:30:00.000Z");

    const previsoko = core.validirajNastavitve("partial_payment", { remainingAmount: 150 }, { preostaliDolg: 100 });
    assert.equal(previsoko.ok, false);
    assert.equal(previsoko.code, "PAYMENT_EXCEEDS_DEBT");

    const nicelno = core.validirajNastavitve("partial_payment", { remainingAmount: 0 }, { preostaliDolg: 100 });
    assert.equal(nicelno.ok, false);
  });

  await test("13b) delno plačilo regenerira sporočila prihodnjih neposlanih, neurejenih korakov z novim zneskom", function () {
    const koraki = [korak({ id: "k1", stepId: "s1", executionState: "scheduled" })];
    const plan = osnovniPlan([
      { id: "s1", finalMessage: "Prosimo poravnajte 100,00 €.", messageEditedManually: false },
    ]);
    const rezultat = core._test.izracunajDelnoPlacilo({ plan, koraki, placiloZnesek: 60, novPreostanek: 40 });
    assert.equal(rezultat.ok, true);
    assert.match(rezultat.newPlan.steps[0].finalMessage, /40,00 €/);
  });

  await test("partial_settlement (dobropis) - uspesen delni dobropis ne zapre primera", () => {
    const rezultat = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 40, settledAt: "2026-08-20T11:45:00Z" },
      { preostaliDolg: 100 }
    );
    assert.equal(rezultat.ok, true);
    assert.equal(rezultat.placiloZnesek, 40);
    assert.equal(rezultat.placiloVrsta, "credit_note");
    assert.equal(rezultat.settings.remainingAmount, 60);
    assert.equal(rezultat.settings.reason, null);
    assert.equal(rezultat.settings.settledAt, "2026-08-20T11:45:00.000Z");
  });

  await test("partial_settlement (odpust) - zahteva razlog", () => {
    const brezRazloga = core.validirajNastavitve(
      "partial_settlement",
      { kind: "writeoff", amount: 40 },
      { preostaliDolg: 100 }
    );
    assert.equal(brezRazloga.ok, false);
    assert.equal(brezRazloga.code, "INVALID_SETTINGS");

    const zRazlogom = core.validirajNastavitve(
      "partial_settlement",
      { kind: "writeoff", amount: 40, reason: "Dogovor z dolžnikom" },
      { preostaliDolg: 100 }
    );
    assert.equal(zRazlogom.ok, true);
    assert.equal(zRazlogom.placiloVrsta, "cancelled_invoice");
    assert.equal(zRazlogom.settings.reason, "Dogovor z dolžnikom");
  });

  await test("partial_settlement - znesek mora biti vecji od 0 in manjsi od preostanka", () => {
    const nicelni = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 0 },
      { preostaliDolg: 100 }
    );
    assert.equal(nicelni.ok, false);
    assert.equal(nicelni.code, "INVALID_SETTINGS");

    const previsoki = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 150 },
      { preostaliDolg: 100 }
    );
    assert.equal(previsoki.ok, false);
    assert.equal(previsoki.code, "PAYMENT_EXCEEDS_DEBT");

    const enakPreostanku = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 100 },
      { preostaliDolg: 100 }
    );
    assert.equal(enakPreostanku.ok, false);
    assert.equal(enakPreostanku.code, "PAYMENT_EXCEEDS_DEBT");
  });

  await test("partial_settlement - zaokrozi znesek na 2 decimalki", () => {
    const rezultat = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 33.336 },
      { preostaliDolg: 100 }
    );
    assert.equal(rezultat.ok, true);
    assert.equal(rezultat.placiloZnesek, 33.34);
    assert.equal(rezultat.settings.remainingAmount, 66.66);
  });

  await test("partial_settlement - rounding boundary: unrounded fits but rounded exceeds debt", () => {
    const rezultat = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 99.996 },
      { preostaliDolg: 100 }
    );
    assert.equal(rezultat.ok, false);
    assert.equal(rezultat.code, "PAYMENT_EXCEEDS_DEBT");
  });

  await test("partial_settlement - sub-cent znesek (0.004) se ne sme sprejeti kot veljaven z zaokrozenim 0", () => {
    const rezultat = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 0.004 },
      { preostaliDolg: 100 }
    );
    assert.equal(rezultat.ok, false);
    assert.equal(rezultat.code, "INVALID_SETTINGS");
  });

  await test("migracija: RPC izvedi_opomin_ukrep obravnava partial_settlement brez zapiranja primera", () => {
    const sql = citaj("supabase/migrations/20260824090000_delna_nedenarna_poravnava.sql");
    assert.match(sql, /p_action_type\s*=\s*'partial_settlement'/);
    assert.match(sql, /poravnano_nedenarno\s*=\s*poravnano_nedenarno\s*\+\s*p_placilo_znesek/);
    assert.match(sql, /insert into public\.zadeva_poravnave/);
    // primer se pri partial_settlement NE sme zapreti - noben del te veje ne sme nastaviti status='Rešeno'
    const partialSettlementVeja = sql.split("p_action_type = 'partial_settlement'")[1].split("elsif p_action_type")[0];
    assert.doesNotMatch(partialSettlementVeja, /status\s*=\s*'Rešeno'/);
  });

  await test("14) polno plačilo zaključi primer - vsi neposlani koraki cancelled, plan completed_paid", function () {
    const koraki = [
      korak({ id: "k1", stepId: "s1", executionState: "sent" }),
      korak({ id: "k2", stepId: "s2", executionState: "scheduled" }),
    ];
    const plan = osnovniPlan([{ id: "s1" }, { id: "s2" }]);
    const rezultat = core._test.izracunajPolnoPlacilo({ plan, koraki });
    assert.equal(rezultat.ok, true);
    assert.equal(rezultat.newPlan.status, "completed_paid");
    assert.equal(rezultat.korakiUpdates.length, 1);
    assert.equal(rezultat.korakiUpdates[0].id, "k2");
    assert.equal(rezultat.korakiUpdates[0].execution_state, "cancelled");
  });

  await test("14b) novi načini poravnave ohranijo pravilen poslovni pomen", function () {
    const delno = core.validirajNastavitve("partial_payment", { paymentAmount: 25, settlementType: "installment" }, { preostaliDolg: 100 });
    assert.equal(delno.ok, true);
    assert.equal(delno.settings.remainingAmount, 75);
    assert.equal(delno.placiloZnesek, 25);
    assert.equal(delno.placiloVrsta, "installment");

    const dobropis = core.validirajNastavitve("paid_in_full", { settlementType: "credit_note", settlementAmount: 100 }, { preostaliDolg: 100 });
    assert.equal(dobropis.ok, true);
    const delniDobropis = core.validirajNastavitve("paid_in_full", { settlementType: "credit_note", settlementAmount: 22 }, { preostaliDolg: 100 });
    assert.equal(delniDobropis.ok, false, "delni dobropis ne sme zaključiti primera");
    const plan = osnovniPlan([{ id: "s1" }]);
    const rezultat = core._test.izracunajPolnoPlacilo({ plan, koraki: [korak({ id: "k1", stepId: "s1", executionState: "scheduled" })], settings: dobropis.settings });
    assert.equal(rezultat.newPlan.status, "completed_credited");
    assert.equal(rezultat.newPlan.settlement.type, "credit_note");
    assert.equal(rezultat.korakiUpdates[0].cancel_reason, "credit_note");

    const brezRazloga = core.validirajNastavitve("paid_in_full", { settlementType: "cancelled_invoice" }, { preostaliDolg: 100 });
    assert.equal(brezRazloga.ok, false);
  });

  await test("14c) migracija ne beleži storna ali dobropisa kot denarno plačilo", function () {
    const sql = citaj("supabase/migrations/20260814233000_poravnava_nacini.sql");
    assert.match(sql, /if v_settlement_type = 'full' then[\s\S]*insert into public\.zadeva_placila/);
    assert.match(sql, /case when v_settlement_type = 'full' then placano_skupaj \+ preostali_dolg else placano_skupaj end/);
  });

  await test("14d) baza dovoljuje obročno vrsto delnega plačila", function () {
    const sql = citaj("supabase/migrations/20260817155300_dovoli_obrocna_placila.sql");
    assert.match(sql, /check \(vrsta in \('partial', 'full', 'installment'\)\)/);
    assert.match(sql, /pg_get_constraintdef\(oid\) ilike '%vrsta%'/);
  });

  await test("14e) javni RPC za obvestilo nima privilegijev lastnika baze", function () {
    const sql = citaj("supabase/migrations/20260817155634_utrdi_privilegirane_rpc_in_rls.sql");
    assert.match(sql, /function public\.oznaci_obvestilo_prebrano[\s\S]*?security invoker/);
    assert.match(sql, /function private\._oznaci_obvestilo_prebrano[\s\S]*?security definer/);
    assert.match(sql, /obrtnik_id = v_user/);
    assert.match(sql, /v_user uuid := \(select auth\.uid\(\)\)/);
  });

  await test("15) že poslana sporočila se pri delnem plačilu ne spremenijo", function () {
    const koraki = [korak({ id: "k1", stepId: "s1", executionState: "sent" })];
    const plan = osnovniPlan([{ id: "s1", finalMessage: "Prosimo poravnajte 100,00 €.", messageEditedManually: false }]);
    const rezultat = core._test.izracunajDelnoPlacilo({ plan, koraki, placiloZnesek: 60, novPreostanek: 40 });
    assert.equal(rezultat.newPlan.steps[0].finalMessage, "Prosimo poravnajte 100,00 €.");
  });

  await test("15b) ročno urejeno sporočilo se pri delnem plačilu ne prepiše", function () {
    const koraki = [korak({ id: "k1", stepId: "s1", executionState: "scheduled" })];
    const plan = osnovniPlan([{ id: "s1", finalMessage: "Posebno besedilo, ni predloga.", messageEditedManually: true }]);
    const rezultat = core._test.izracunajDelnoPlacilo({ plan, koraki, placiloZnesek: 60, novPreostanek: 40 });
    assert.equal(rezultat.newPlan.steps[0].finalMessage, "Posebno besedilo, ni predloga.");
  });

  await test("16) predaja odvetniku ne uspe brez obveznih podatkov (manjkajoč paket/dokumenti/sporočilo)", function () {
    const koraki = [];
    const plan = osnovniPlan([{ id: "s1", kind: "sms" }, { id: "s10", kind: "manual_lawyer", lawyerHandoff: { lawyerSnapshot: { name: "Odv. Novak" } } }]);
    const rezultat = core._test.izracunajPredajoOdvetniku({ plan, koraki, settings: { timingMode: "asap", scheduledHandoffAt: null } });
    assert.equal(rezultat.ok, false);
    assert.equal(rezultat.code, "MISSING_HANDOFF_DATA");
    assert.ok(rezultat.missing.includes("Izbran paket"));
    assert.ok(rezultat.missing.includes("Zahtevani dokumenti"));
    assert.ok(rezultat.missing.includes("Sporočilo odvetniku"));
  });

  await test("16b) predaja odvetniku s popolnimi podatki prekliče vmesne neposlane opomine", function () {
    const koraki = [korak({ id: "k1", stepId: "s1", executionState: "scheduled" })];
    const plan = osnovniPlan([
      { id: "s1", kind: "sms" },
      {
        id: "s10", kind: "manual_lawyer",
        lawyerHandoff: {
          lawyerSnapshot: { name: "Odv. Novak" },
          selectedPackage: { packageId: "osnovni" },
          documents: [{ type: "invoice" }],
          message: "Prosim za obravnavo.",
        },
      },
    ]);
    const rezultat = core._test.izracunajPredajoOdvetniku({ plan, koraki, settings: { timingMode: "asap", scheduledHandoffAt: null } });
    assert.equal(rezultat.ok, true);
    const u1 = rezultat.korakiUpdates.find((u) => u.id === "k1");
    assert.equal(u1.execution_state, "cancelled");
    assert.equal(u1.cancel_reason, "handoff_to_lawyer");
  });

  await test("16bb) zgodovina in ocena tveganja se varno shranita v podatke predaje", function () {
    const rezultat = core.validirajNastavitve("handoff_to_lawyer", {
      lawyerHandoff: {
        lawyerId: "joze_kovac",
        historyBeforePlan: [{
          tip: "partial",
          naslov: "Delno plačilo",
          znesek: 944,
          settings: { paymentAmount: 944, settlementType: "partial" },
        }],
        riskAssessment: { latePayments: "2" },
      },
    });
    assert.equal(rezultat.ok, true);
    assert.equal(rezultat.settings.lawyerHandoff.historyBeforePlan[0].znesek, 944);
    assert.equal(rezultat.settings.lawyerHandoff.riskAssessment.latePayments, "2");
  });

  await test("8b) vsi izvedbeni paneli ponujajo varen lastni opis", function () {
    const js = citaj("app/izvedba.js");
    const css = citaj("app/izvedba.css");
    assert.ok((js.match(/gumbi \+= izrisiDrugoGumb/g) || []).length >= 2, "gumb Drugo mora biti v akcijskih in poravnalnih panelih");
    assert.match(js, /data-action-custom-description/);
    assert.match(js, /customActionActive[\s\S]*?izrisiDrugoPodrobnosti/);
    assert.doesNotMatch(js, /Api\.executeAction\([\s\S]{0,300}actionType:\s*["']history_custom["']/, "lastni zgodovinski dogodek ne sme biti poslan kot izvršitvena akcija");
    assert.match(css, /\.izvedba-poravnava-svicer__gumb--drugo\s*\{[^}]*grid-column:\s*1 \/ -1/);
    assert.match(css, /\.izvedba-drugo__polje\s*\{[^}]*font-size:\s*16px/);
    assert.match(css, /\.izvedba-poravnava-korak--drugo\s*\{[^}]*--korak-accent:\s*#567392/);
    assert.match(css, /\.izvedba-poravnava-svicer__gumb--drugo\s*\{[^}]*--svicer-rgb:\s*82,111,145/);
    assert.match(css, /panel--odvetnik-zgodovina \.izvedba-poravnava-svicer__gumb--drugo,[\s\S]*?panel--poravnano \.izvedba-poravnava-svicer__gumb--drugo\s*\{[^}]*grid-column:\s*auto;[^}]*min-height:\s*66px;[^}]*flex-direction:\s*column;/);
    assert.match(citaj("app/neplacila-zgodovina.js"), /obstojeciDrugo\.removeAttribute\("data-action-custom"\)[\s\S]*obstojeciDrugo\.setAttribute\("data-zgodovina-drugo", ""\)/);
    assert.match(citaj("app/neplacila-zgodovina.js"), /classList\.toggle\("is-selected", customActive\)[\s\S]*setAttribute\("aria-pressed", String\(customActive\)\)/);
    assert.match(css, /\.izvedba-poravnava-cona__stevilka\s*\{[^}]*background:\s*rgba\(23,157,164,\.12\)[^}]*color:\s*#10797d/);
    assert.match(css, /\.izvedba-poravnava-korak__stevilka\s*\{[^}]*background:\s*rgba\(var\(--korak-accent-rgb,[^)]+\),\s*\.12\)[^}]*color:\s*var\(--korak-accent,\s*#10797d\)/);
    assert.match(css, /\.izvedba-poravnava-korak__odstrani\s*\{[^}]*padding:\s*0/);
    assert.match(css, /\.izvedba-poravnava-svicer__gumb--kompenzacija\s*\{[^}]*--svicer-rgb:\s*86,160,94/);
    assert.match(css, /\.izvedba-poravnava-podrobnosti--kompenzacija\s*\{[^}]*--action-rgb:\s*86,160,94/);
    assert.match(css, /\.izvedba-poravnava-korak--compensation\s*\{[^}]*--korak-accent-rgb:\s*86,160,94/);
    assert.match(css, /\.izvedba-poravnava-svicer__gumb--dobropis\s*\{[^}]*--svicer-rgb:\s*199,157,0/);
    assert.match(css, /\.izvedba-poravnava-podrobnosti--dobropis\s*\{[^}]*--action-rgb:\s*199,157,0/);
    assert.match(css, /\.izvedba-poravnava-korak--credit_note\s*\{[^}]*--korak-accent-rgb:\s*199,157,0/);
    assert.match(js, /compensation:\s*\{[^}]*settlementAmount:\s*null[^}]*rocnoUrejeno:\s*false/);
    assert.match(js, /tip === "compensation" && jeVnosZgodovine\(\)[\s\S]*?Vnesite znesek kompenzacije\.[\s\S]*?kind:\s*"compensation"/);
    assert.match(js, /tip === "compensation"[\s\S]{0,300}izrisiPoravnavaZnesek\(tip, "settlementAmount", nastavitve\.settlementAmount, "Znesek kompenzacije", true\)/);
    assert.match(js, /znesekTip === "credit_note" \|\| znesekTip === "compensation"/);
    assert.match(js, /function pomakniPotekNaDno[\s\S]*scrollIntoView\(\{ behavior: "smooth", block: "center"/);
    assert.match(js, /classList\.add\("is-pravkar-dodan"\)/);
    assert.match(css, /@keyframes izvedba-korak-dodan/);
    assert.match(citaj("app/neplacila-zgodovina.js"), /debug\.pomakniPotekNaDno\(\)/);
  });

  await test("16c) predaja ima štiri ločene funkcionalne korake in ohrani vse podatke", function () {
    const src = citaj("app/izvedba.js");
    const css = citaj("app/izvedba.css");
    const historyCss = citaj("app/neplacila-zgodovina.css");
    const html = citaj("app/izvedba.html");
    assert.match(src, /lawyerHandoff\.status === "prepared"[\s\S]*lawyerHandoff\.preparedSnapshot/);
    assert.match(src, /screen: "zgodovina"/);
    assert.match(src, /snapshot\.izbraniPaket \|\| lh\.selectedPackage/);
    assert.match(src, /snapshot\.dokumenti \|\| lh\.documents/);
    assert.match(src, /snapshot\.sporociloOdvetniku \|\| lh\.message/);
    assert.match(src, /function dokumentiZaWizard[\s\S]*w\.preparedData\.documents/);
    assert.match(src, /Možni dnevi predaje/);
    assert.match(src, /opomin-predaja-sestavljalnik__cas-rezultat[\s\S]*opomin-predaja-sestavljalnik__cas-datum-ura/);
    assert.match(src, /data-lawyer-handoff-date[\s\S]*data-lawyer-handoff-time/);
    assert.match(src, /najzgodnejsiCasLawyerPredaje/);
    assert.match(src, /Zgodovina[\s\S]*naslov: "Paket"[\s\S]*naslov: "Predaja"[\s\S]*naslov: "Pregled"/);
    assert.match(src, /w\.screen === "zgodovina" \? izrisiOdvetnikZgodovino\(\)/);
    assert.doesNotMatch(src, /data-lawyer-history-delay/);
    assert.doesNotMatch(src, /function izrisiOdvetnikOcenoTveganja/);
    assert.match(src, /historyBeforePlan: kopirajPodatke\(w\.historyEvents/);
    assert.match(src, /riskAssessment: \{ latePayments: w\.historyLatePayments \}/);
    assert.match(src, /Nadaljuj na izbiro paketa/);
    assert.match(src, /w\.screen === "podrobnosti" \? izrisiOdvetnikPodrobnosti\(\)/);
    assert.match(src, /Nadaljuj na podatke predaje/);
    assert.match(src, /Preveri in potrdi podatke/);
    assert.match(src, /lawyerDokumentPregledIkona[\s\S]*steviloVsehDokumentovZaWizard/);
    assert.match(src, /opomin-predaja-sestavljalnik__sporocilo-svincnik[\s\S]*lawyerSvincnikIkona/);
    assert.match(src, /data-lawyer-delete-details[\s\S]*state\.lawyerWizard\.screen = "paket"/);
    assert.match(src, /opomin-predaja-sestavljalnik__locilo/);
    assert.match(src, /zapustiOdvetnikZgodovino\(true\)[\s\S]*state\.lawyerWizard\.screen = "paket"/);
    assert.match(src, /if \(!w\.preservePlanHandoff\) \{[\s\S]*settings\.lawyerHandoff/);
    assert.match(src, /Potrdi oddajo/);
    assert.match(src, /Potrditev ne pošlje ničesar odvetniku/);
    assert.match(src, /Razumem, da moram paket odvetniku predati sam/);
    assert.match(src, /opomin-predaja-pregled__cena[\s\S]*Končna cena[\s\S]*Skupaj/);
    assert.match(src, /Kaj se je zgodilo\?/);
    assert.match(src, /Kratek pregled neuspešnih korakov pred predajo odvetniku/);
    assert.match(src, /vkljuceniKorakiZaSwipe\(\)[\s\S]*executionState === "sent"[\s\S]*state\.currentStepId/);
    assert.match(src, /data-lawyer-history-toggle[\s\S]*data-lawyer-history-details/);
    assert.match(src, /opomin-predaja-pregled__prihodnji-kartica[\s\S]*data-izvedba-fit data-fit-min="12"/);
    assert.match(src, /expandedHistoryStepId[\s\S]*izrisiOdvetnikSheetZOhranjenimPomikom\(\)/);
    assert.doesNotMatch(src, /Kaj se bo zgodilo naprej\?/);
    assert.match(src, /data-lawyer-case-toggle[\s\S]*Vsi podatki o primeru/);
    assert.match(src, /data-lawyer-details>Podrobno/);
    assert.match(src, /data-lawyer-package-preview=[\s\S]*Preglej paket/);
    assert.match(src, /data-lawyer-review-message[\s\S]*Vrni v prejšnje stanje[\s\S]*Shrani/);
    assert.match(src, /Nazaj na 2\. korak[\s\S]*Izbriši 2\. korak[\s\S]*Shrani kot osnutek/);
    assert.match(src, /Paket predate odvetniku[\s\S]*Običajno v 1–3 delovnih dneh[\s\S]*Po e-pošti ali telefonu/);
    assert.match(src, /data-lawyer-handoff-date-display[\s\S]*data-lawyer-handoff-time-display/);
    assert.match(css, /opomin-predaja-sestavljalnik__cas-vnosa input[\s\S]*position:\s*absolute;[\s\S]*opacity:\s*0/);
    assert.match(css, /opomin-predaja-pregled__proces-korak[\s\S]*grid-template-rows:\s*38px minmax\(40px, auto\) minmax\(34px, auto\)/);
    assert.match(css, /izvedba-action-sheet__panel--odvetnik-pregled[\s\S]*height:\s*100lvh;[\s\S]*border-radius:\s*0;/);
    assert.match(css, /panel--odvetnik-pregled > \.izvedba-action-sheet__header[\s\S]*display:\s*none/);
    assert.match(css, /panel--odvetnik-pregled \.izvedba-odvetnik-zgodovina__povzetek[\s\S]*border:\s*1px solid var\(--stage-border[\s\S]*background:\s*linear-gradient/);
    assert.match(css, /\.izvedba-odvetnik-korak__naslov\s*\{[\s\S]*?font-size:\s*8px;[\s\S]*?white-space:\s*nowrap;/);
    assert.match(src, /\(zgodovinaVnos \|\| jePlacilniEngine\(\)\) && typeof window\.UJZgodovinaPoIzrisu === "function"/);
    assert.match(html, /neplacila-zgodovina\.css\?v=20260828-lawyer-history-natural-v1-atena-v15-synced-action-speed-v1/);
    assert.match(html, /neplacila-zgodovina\.js\?v=20260828-payment-history-natural-v1-atena-v16-stable-recording-v1/);
    assert.match(html, /izvedba\.js\?v=20260828-payment-history-natural-v2-atena-v3/);
    assert.match(src, /function jeAtena\(\)/);
    assert.match(src, /Pripravljeni dogodki/);
    assert.match(src, /jeAtenaVnos \? '' : '<span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">3<\/span>'/);
    assert.match(src, /atena__nadaljuj-brez/);
    assert.match(src, /jeAtena\(\) \? 'Kaj se je do zdaj zgodilo\?'/);
    assert.match(src, /jeRazsirjeniPlacilniEngine[\s\S]*?\["full", "partial", "compensation", "installment", "credit_note", "payment_promised", "unpaid_installment", "payment_failed", "invoice_dispute", "cancelled_invoice", "insolvency"\]/);
    assert.match(src, /function jePlacilniDogodkovniTip\(tip\)[\s\S]*?"unpaid_installment"[\s\S]*?"payment_failed"[\s\S]*?"invoice_dispute"[\s\S]*?"cancelled_invoice"[\s\S]*?"insolvency"/);
    assert.match(src, /state\.assistedHistoryInputActive = true;[\s\S]*?finally[\s\S]*?state\.assistedHistoryInputActive = prejsnjiAssistedHistoryInput/);
    assert.match(css, /panel--poravnano \.izvedba-poravnava-svicer__gumb--drugo[\s\S]*?grid-column:\s*auto/);
    assert.match(historyCss, /\.atena \.atena__ponastavi\s*\{[\s\S]*?align-self:\s*start;[\s\S]*?margin-top:\s*4px;/);
    assert.match(historyCss, /\.zgodovina-ai__vnos textarea\s*\{[\s\S]*?max-height:\s*none;[\s\S]*?resize:\s*none;[\s\S]*?overflow-y:\s*hidden;/);
  });

  await test("hitra dejanja so trije kompaktni gumbi, Pošlji pa ostane ločen v kartici", function () {
    const src = citaj("app/izvedba.js");
    const css = citaj("app/izvedba.css");
    const html = citaj("app/izvedba.html");
    assert.match(src, /izvedba-hitre-akcije[\s\S]*?Ne bo pla\\u010Dal[\s\S]*?Bo pla\\u010Dal[\s\S]*?Prekli\\u010Di opomin/);
    assert.match(src, /izvedba-hitra-akcija--opomin[^>]*id="izvedba-gumb-preklici-hitro"/);
    assert.match(src, /<div class="izvedba-posljizdaj-vrstica"><button[^>]*id="izvedba-gumb-posljizdaj"[^>]*>Pošlji<\/button><\/div>/);
    assert.doesNotMatch(src, /id="izvedba-gumb-pozneje"/);
    assert.match(css, /\.izvedba-posljizdaj-vrstica\s*\{[\s\S]*?margin-top:\s*4px;/);
    assert.match(css, /\.izvedba-hitre-akcije\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(css, /\.izvedba-hitra-akcija\s*\{[\s\S]*?grid-template-rows:\s*24px auto;[\s\S]*?height:\s*66px;[\s\S]*?border-radius:\s*11px;[\s\S]*?font-weight:\s*800;/);
    assert.match(css, /\.izvedba-hitra-akcija\s*\{[\s\S]*?box-shadow:\s*none;/);
    assert.match(css, /\.izvedba-hitra-akcija--preklic\s*\{[\s\S]*?--hitra-rgb:\s*222, 79, 69;/);
    assert.match(css, /\.izvedba-hitra-akcija--poravnano\s*\{[\s\S]*?--hitra-rgb:\s*41, 155, 99;/);
    assert.match(css, /\.izvedba-hitra-akcija--opomin\s*\{[\s\S]*?--hitra-rgb:\s*83, 119, 158;/);
    assert.match(css, /\.izvedba-hitra-akcija--opomin \.izvedba-hitra-akcija__besedilo\s*\{[\s\S]*?width:\s*min\(100%, 66px\);[\s\S]*?white-space:\s*normal;/);
    assert.match(css, /@media \(max-width: 520px\)[\s\S]*?\.izvedba-hitra-akcija\s*\{[\s\S]*?grid-template-rows:\s*24px auto;[\s\S]*?height:\s*66px;[\s\S]*?border-radius:\s*11px;/);
    assert.match(html, /izvedba\.css\?v=2026082[5678]-[\w-]+/);
    assert.match(html, /izvedba\.js\?v=2026082[5678]-[\w-]+/);
  });

  await test("16c) vseh 6 ukrepov deluje tudi na starejšem načrtu brez materializiranih opomin_koraki", function () {
    function legacyPlan() {
      return osnovniPlan([
        {
          stepId: "stage-1", index: 1, kind: "sms", status: "confirmed",
          sendAt: "2026-08-20T08:00:00.000Z", scheduledAt: "2026-08-20T08:00:00.000Z",
          finalMessage: "Prosimo poravnajte 100,00 €.", messageEditedManually: false,
        },
        {
          stepId: "stage-2", index: 2, kind: "sms", status: "confirmed",
          sendAt: "2026-08-24T08:00:00.000Z", scheduledAt: "2026-08-24T08:00:00.000Z",
          finalMessage: "Prosimo poravnajte 100,00 €.", messageEditedManually: false,
        },
        {
          stepId: "stage-3", index: 3, kind: "manual_lawyer", status: "confirmed",
          sendAt: "2026-08-28T08:00:00.000Z", scheduledAt: "2026-08-28T08:00:00.000Z",
          lawyerHandoff: {
            lawyerSnapshot: { name: "Odv. Novak" },
            selectedPackage: { packageId: "osnovni" },
            documents: [{ type: "invoice" }],
            message: "Prosim za obravnavo.",
          },
        },
      ]);
    }

    const rezultati = {
      skip_current_step: core.izracunajUkrep("skip_current_step", {
        plan: legacyPlan(), koraki: [], stepId: "stage-1", settings: { nextDelayDays: 0 },
      }),
      stop_plan: core.izracunajUkrep("stop_plan", {
        plan: legacyPlan(), koraki: [], settings: { resumeMode: "manual", resumeAt: null },
      }),
      handoff_to_lawyer: core.izracunajUkrep("handoff_to_lawyer", {
        plan: legacyPlan(), koraki: [], settings: { timingMode: "asap", scheduledHandoffAt: null },
      }),
      postpone_reminder: core.izracunajUkrep("postpone_reminder", {
        plan: legacyPlan(), koraki: [], stepId: "stage-1", settings: { delayDays: 3 },
      }),
      payment_promised: core.izracunajUkrep("payment_promised", {
        plan: legacyPlan(), koraki: [], settings: { waitDays: 4 },
      }),
      partial_payment: core.izracunajUkrep("partial_payment", {
        plan: legacyPlan(), koraki: [], placiloZnesek: 25, novPreostanek: 75,
      }),
    };

    Object.entries(rezultati).forEach(function ([tip, rezultat]) {
      assert.equal(rezultat.ok, true, tip + " mora uspeti brez opomin_koraki vrstic");
      assert.equal(rezultat.newPlan.version, "4", tip + " mora povečati verzijo načrta");
    });
    assert.equal(rezultati.skip_current_step.newPlan.steps[0].status, "skipped");
    assert.equal(rezultati.skip_current_step.nextStepId, "stage-2");
    assert.equal(rezultati.stop_plan.newPlan.status, "paused");
    assert.equal(rezultati.payment_promised.newPlan.status, "waiting_for_promised_payment");
    assert.equal(Date.parse(rezultati.postpone_reminder.newPlan.steps[0].sendAt), Date.parse("2026-08-23T08:00:00.000Z"));
    assert.match(rezultati.partial_payment.newPlan.steps[0].finalMessage, /75,00 €/);
  });

  // ---------- 17-20: strukturne preverbe (realtime, brez localStorage, fail-closed) ----------

  await test("17) Realtime dedupe primerja verzijo NUMERIČNO, ne kot niz", function () {
    const src = citaj("app/izvedba.js");
    assert.match(src, /Number\(\(odgovor\.plan[^)]*\)\s*\|\|\s*odgovor\.version\s*\|\|\s*0\)/);
    assert.match(src, /novaVerzija <= trenutnaVerzija/);
  });

  await test("18) izvedba.js ne piše produkcijskih podatkov v localStorage", function () {
    const src = citaj("app/izvedba.js");
    assert.doesNotMatch(src, /localStorage\.setItem/);
  });

  await test("19) offline/napaka pri pošiljanju ne prikaže lažnega uspeha (selectedActionType se počisti SAMO ob ok:true)", function () {
    const src = citaj("app/izvedba.js");
    const zacetekFunkcije = src.indexOf("async function submitSelectedAction");
    const blok = src.slice(src.indexOf("if (!odgovor || odgovor.ok !== true) {", zacetekFunkcije), src.indexOf("} catch (err) {", zacetekFunkcije));
    assert.match(blok, /state\.selectedActionType = null;/);
    const idxNapake = blok.indexOf("obravnavajNapakoUkrepa(odgovor);");
    const idxUspeh = blok.indexOf("state.selectedActionType = null;");
    assert.ok(idxNapake < idxUspeh, "čiščenje izbire sme slediti samo uspešni veji, ne obravnavi napake");
  });

  await test("20) scheduler ne pošlje 'awaiting_confirmation' koraka - claim RPC zahteva 'ready_to_send'", function () {
    const sql = citaj("supabase/migrations/20260814200000_izvedba.sql");
    assert.match(sql, /oznaci_zapadle_za_potrditev/);
    assert.match(sql, /execution_state = 'awaiting_confirmation', posodobljeno_at = now\(\)/);
    const claimFn = sql.slice(sql.indexOf("function public.prevzemi_zapadle_opomine"), sql.indexOf("$$;", sql.indexOf("function public.prevzemi_zapadle_opomine")));
    assert.doesNotMatch(claimFn, /'awaiting_confirmation'/);
  });

  // ---------- Dodatne varovalke iz krogov popravkov ----------

  await test("kanal='sms' filter je prisoten na vseh treh vejah prevzem-a (KROG 2-2/3-1)", function () {
    const sql = citaj("supabase/migrations/20260814200000_izvedba.sql");
    const claimFn = sql.slice(sql.indexOf("function public.prevzemi_zapadle_opomine"), sql.indexOf("$$;", sql.indexOf("function public.prevzemi_zapadle_opomine")));
    assert.match(claimFn, /k\.kanal = 'sms'/);
  });

  await test("sistem_stikala je privzeto izklopljeno (fail-closed, KROG 3-2)", function () {
    const sql = citaj("supabase/migrations/20260814200000_izvedba.sql");
    assert.match(sql, /insert into public\.sistem_stikala \(ime, vklopljeno\) values \('opomin_scheduler', false\)/);
  });

  await test("idempotenca RPC uporablja INSERT ... ON CONFLICT (atomska rezervacija, KROG 2-3/2-4)", function () {
    const sql = citaj("supabase/migrations/20260814200000_izvedba.sql");
    assert.match(sql, /on conflict \(action_id\) do nothing/);
    assert.match(sql, /zahteva_fingerprint <> p_fingerprint/);
  });

  await test("denarni stolpci so zaščiteni s trigerjem na app.dovoli_denarne_spremembe (KROG 3-3)", function () {
    const sql = citaj("supabase/migrations/20260814200000_izvedba.sql");
    assert.match(sql, /zadeve_zascita_denarnih_stolpcev/);
    assert.match(sql, /perform set_config\('app\.dovoli_denarne_spremembe', 'true', true\)/);
  });

  await test("poslji_opomin_zdaj zahteva VSE čakajoče SMS vrstice koraka (KROG 3-4)", function () {
    const sql = citaj("supabase/migrations/20260814200000_izvedba.sql");
    assert.match(sql, /INCOMPLETE_RECIPIENTS/);
    assert.match(sql, /v_pricakovani is distinct from v_prejeti/);
  });

  await test("scheduler-core.js payload vsebuje channel (KROG 3-1)", function () {
    const src = citaj("api/_lib/scheduler-core.js");
    assert.match(src, /channel:\s*row\.kanal/);
  });

  await test("znesek obroka in dobropisa uporablja fokusno barvo svoje kartice", function () {
    const src = citaj("app/izvedba.js");
    const css = citaj("app/izvedba.css");
    assert.match(css, /\.izvedba-action-card--poravnava-obrok\s*\{\s*--action-accent:#397fd0;/);
    assert.match(css, /\.izvedba-action-card--poravnava-dobropis\s*\{\s*--action-accent:#e89524;/);
    assert.match(
      css,
      /\.izvedba-action-sheet \.izvedba-znesek__vnos:focus,[\s\S]{0,160}border: 2px solid var\(--action-accent\);[\s\S]{0,100}outline: 0;/
    );
    assert.match(src, /credit_note: \{ nastavitev: "Celotni preostali dolg", badge: "Samodejno" \}/);
    assert.match(src, /if \(tip === "credit_note"\) \{[\s\S]*?if \(!nastavitve\.rocnoUrejeno\) nastavitve\.settlementAmount = preostaliDolgPoNacrtu\(\);[\s\S]*?izrisiPoravnavaZnesek\(tip, "settlementAmount"/);
    assert.match(src, /if \(tip === "credit_note"\) \{[\s\S]*?var vnesenDobropis = Number\(nastavitve\.settlementAmount\);[\s\S]*?actionType: "paid_in_full"[\s\S]*?actionType: "partial_settlement"/);
  });

  await test("19b) uspešen zaključek odpre Končane primere in označi pravkar rešeno zadevo", function () {
    const izvedba = citaj("app/izvedba.js");
    const koncani = citaj("app/koncani-primeri.js");
    assert.match(izvedba, /if \(actionType === "paid_in_full"\)[\s\S]*?koncani-primeri\.html[\s\S]*?searchParams\.set\("nov", state\.zadevaId\)[\s\S]*?window\.location\.assign/);
    assert.match(koncani, /searchParams\.get\("nov"\)/);
    assert.match(koncani, /data-koncani-primer-id/);
    assert.match(koncani, /\.koncani-kartica\.is-newly-completed/);
  });

  await test("izbrana poravnava je jasno poudarjena v barvi svoje kartice", function () {
    const css = citaj("app/izvedba.css");
    assert.match(
      css,
      /\.izvedba-action-card\.is-selected\s*\{[\s\S]*?border-color:\s*var\(--action-accent\);[\s\S]*?inset 0 0 0 1\.5px var\(--action-accent\)/
    );
    assert.match(
      css,
      /\.izvedba-action-card\.is-selected::after\s*\{[\s\S]*?content:\s*"\\2713";[\s\S]*?background:\s*var\(--action-accent\);[\s\S]*?color:\s*#fff/
    );
  });

  await test("glavni gumb poravnave sledi barvi izbrane kartice", function () {
    const src = citaj("app/izvedba.js");
    const css = citaj("app/izvedba.css");
    assert.match(src, /izvedba-action-sheet__panel--poravnava-' \+ K\.esc\(meta\.razred\)/);
    assert.match(css, /\.izvedba-action-sheet__panel--poravnava-obrok\s*\{[^}]*--sheet-action:#397fd0;[^}]*--sheet-action-rgb:57,127,208/);
    assert.match(css, /\.izvedba-action-sheet__panel--poravnava-dobropis\s*\{[^}]*--sheet-action:#e89524/);
    assert.match(css, /\.izvedba-action-sheet__dejanje\s*\{[\s\S]*?rgba\(var\(--sheet-action-rgb\), \.92\)/);
  });

  await test("razlog za storno uporablja lasten meni v slogu kartice", function () {
    const src = citaj("app/izvedba.js");
    const css = citaj("app/izvedba.css");
    assert.match(src, /data-settlement-reason-toggle/);
    assert.match(src, /data-settlement-reason-option/);
    assert.doesNotMatch(src, /<select data-settlement-reason/);
    assert.match(src, /state\.settlementSettings\[razlogTip\]\.reason = razlogMoznost\.getAttribute/);
    assert.match(css, /\.izvedba-poravnava__razlog-meni\s*\{[\s\S]*?border-radius:\s*14px;[\s\S]*?box-shadow:/);
  });

  await test("dolg izbran razlog poveča polje in se ne odreže", function () {
    const css = citaj("app/izvedba.css");
    assert.match(css, /\.izvedba-poravnava__razlog-sprozi > span:first-child,[\s\S]*?white-space:\s*normal;[\s\S]*?word-break:\s*normal/);
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.izvedba-poravnava__razlog-sprozi\s*\{[^}]*min-height:\s*32px;[^}]*height:\s*auto/);
  });

  await test("izracunajUkrep(partial_settlement) - uporabi izracunajDelnoPlacilo, primer ostane odprt", () => {
    const ctx = {
      plan: { version: "3", steps: [] },
      koraki: [],
      placiloZnesek: 40,
      novPreostanek: 60,
    };
    const izracun = core.izracunajUkrep("partial_settlement", ctx);
    assert.equal(izracun.ok, true);
    assert.equal(izracun.placiloZnesek, 40);
    assert.equal(izracun.newPlan.version, "4");
    assert.deepEqual(izracun.korakiUpdates, []);
  });

  await test("partial_settlement - validirajNastavitve.settings.remainingAmount napaja izracunajUkrep.ctx.novPreostanek", () => {
    const validacija = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 40 },
      { preostaliDolg: 100 }
    );
    assert.equal(validacija.ok, true);

    const ctx = {
      plan: { version: "3", steps: [] },
      koraki: [],
      placiloZnesek: validacija.placiloZnesek,
      novPreostanek: validacija.settings.remainingAmount,
    };
    const izracun = core.izracunajUkrep("partial_settlement", ctx);
    assert.equal(izracun.ok, true);
    assert.equal(izracun.newPlan.version, "4");
  });

  await test("izvedba.js: denarna tokova sta ločena, kartica dobropisa pa preklaplja Dobropis/Odpust", () => {
    const src = citaj("app/izvedba.js");
    assert.match(src, /function izrisiPoravnavaRazlog\(tip\)/);
    assert.match(src, /izrisiPoravnavaSegment\(tip,\s*"kind"/);
    assert.match(src, /tip === "partial"/);
    assert.match(src, /tip === "installment"/);
    assert.match(src, /oznaka:\s*"Dobropis"/);
    assert.match(src, /oznaka:\s*"Odpust"/);
  });

  await test("izvedba.js: razlog-izbirnik ni vec trdo vezan samo na cancelled_invoice", () => {
    const src = citaj("app/izvedba.js");
    assert.match(src, /razlogMoznost\.getAttribute\("data-settlement-type"\)/);
    assert.match(src, /razlogSprozi\.getAttribute\("data-settlement-type"\)/);
    assert.doesNotMatch(src, /state\.selectedSettlementType = "cancelled_invoice";\s*\n\s*state\.settlementSettings\.cancelled_invoice\.reason/);
  });

  await test("izvedba.js: pripraviPoravnavoZaOddajo poslje partial_settlement za dobropis/odpust", () => {
    const src = citaj("app/izvedba.js");
    assert.match(src, /actionType:\s*"partial_settlement"/);
    assert.match(src, /kindDobropisOdpust === "writeoff" && !efektivenRazlog\(nastavitve\)/);
  });

  await test("izvedba.js: preklop kind segmenta ponastavi odprt razlog meni", () => {
    const src = citaj("app/izvedba.js");
    assert.match(src, /var poravnavaSegment = event\.target\.closest\("\[data-settlement-segment\]"\);\s*\n\s*if \(poravnavaSegment\) \{\s*\n\s*var poravnavaTip = poravnavaSegment\.getAttribute\("data-settlement-type"\);\s*\n\s*state\.selectedSettlementType = poravnavaTip;\s*\n\s*state\.settlementReasonMenuOpen = false;\s*\n\s*state\.settlementReasonMenuTip = null;/);
  });

  await test("19a) HTTP 409 uporabi strukturirano VERSION_CONFLICT napako in osveži stanje", function () {
    const src = citaj("app/izvedba.js");
    const zacetek = src.indexOf("async function submitSelectedAction");
    const konec = src.indexOf("function obravnavajNapakoUkrepa", zacetek);
    const blok = src.slice(zacetek, konec);
    assert.match(blok, /err\s*&&\s*err\.podatki/);
    assert.match(blok, /obravnavajNapakoUkrepa\(err\.podatki\)/);
    assert.match(src, /koda === "VERSION_CONFLICT"[\s\S]*Api\.nalozi/);
  });

  await test("osnutek in že knjižena delna poravnava imata delujoč gumb za odstranitev", () => {
    const src = citaj("app/izvedba.js");
    const css = citaj("app/izvedba.css");
    const api = citaj("api/izvedi-opomin-ukrep.js");
    const migracija = citaj("supabase/migrations/20260824174942_undo_completed_settlement.sql");
    assert.match(src, /data-nacrt-odstrani=\"' \+ i \+ '\" aria-label=\"Odstrani korak iz osnutka\"/);
    assert.match(src, /data-ukrep-odstrani=\"' \+ K\.esc\(korak\.actionId\) \+ '\" data-ukrep-tip=\"' \+ K\.esc\(korak\.actionType\) \+ '\" aria-label=\"Odstrani izvedeni korak\"/);
    assert.match(src, /async function odstraniIzvedenKorak\(actionId, actionType\)/);
    assert.match(src, /actionType:\s*tipRazveljavitveUkrepa\(actionType\)/);
    assert.match(src, /function ponastaviOsnutekPoravnave\(\)/);
    assert.match(src, /function zapriActionSheet\(\) \{[\s\S]*?if \(state\.actionSheetMode === \"payment\"\) ponastaviOsnutekPoravnave\(\)/);
    assert.match(src, /if \(!state\.nacrtKoraki\.length && state\.actionSheetStep === \"povzetek\"\) \{\s*state\.actionSheetStep = \"izbira\"/);
    assert.match(api, /razveljavi_opomin_poravnavo/);
    assert.match(migracija, /delete from public\.zadeva_placila/);
    assert.match(migracija, /placano_skupaj = placano_skupaj - v_znesek/);
    assert.match(migracija, /preostali_dolg = preostali_dolg \+ v_znesek/);
    assert.match(migracija, /revoke all on function public\.razveljavi_opomin_poravnavo[^;]+from public, anon, authenticated/);
    assert.match(css, /\.izvedba-poravnava-korak__akcije\s*\{[^}]*display:\s*inline-flex/);
  });

  await test("zaključno plačilo je mogoče odstraniti ter atomsko ponovno odpreti primer", () => {
    const src = citaj("app/izvedba.js");
    const api = citaj("api/izvedi-opomin-ukrep.js");
    const migracija = citaj("supabase/migrations/20260824203035_undo_paid_in_full.sql");
    const rezultat = core.izracunajRazveljavitevPoravnave({
      plan: {
        version: "7",
        status: "completed_paid",
        settlement: { type: "full", amount: 100 },
        steps: [{ id: "s1", finalMessage: "Poravnajte 0,00 €.", status: "scheduled" }],
      },
      koraki: [{ stepId: "s1", executionState: "cancelled", status: "cancelled" }],
      novPreostanek: 100,
      zakljucnaPoravnava: true,
    });
    assert.equal(rezultat.ok, true);
    assert.equal(rezultat.newPlan.status, "active");
    assert.equal(rezultat.newPlan.version, "8");
    assert.equal(Object.hasOwn(rezultat.newPlan, "settlement"), false);
    assert.equal(rezultat.newPlan.steps[0].finalMessage, "Poravnajte 100,00 €.");
    assert.match(src, /\["partial_payment", "partial_settlement", "paid_in_full", "payment_promised", "stop_plan"\]/);
    assert.match(api, /\["partial_payment", "partial_settlement", "paid_in_full"\]/);
    assert.match(api, /select=action_id,action_type,status,settings/);
    assert.match(api, /ciljniUkrep\.action_type === "paid_in_full"[\s\S]*settlementType[\s\S]*tabelaPoravnave = jeDenarnaPoravnava \? "zadeva_placila" : "zadeva_poravnave"/);
    assert.match(api, /zakljucnaPoravnava:\s*ciljniUkrep\.action_type === "paid_in_full"/);
    assert.match(migracija, /action_type not in \('partial_payment', 'partial_settlement', 'paid_in_full'\)/);
    assert.match(migracija, /v_ukrep_verzija <> v_verzija/);
    assert.match(migracija, /status = case when v_ukrep\.action_type = 'paid_in_full' then v_prejsnji_status else status end/);
    assert.match(migracija, /poravnano_at = case when v_ukrep\.action_type = 'paid_in_full' then null else poravnano_at end/);
    assert.match(migracija, /cancel_reason = v_settlement_type/);
    assert.match(migracija, /execution_state = 'scheduled'/);
    assert.match(migracija, /delete from public\.zadeva_placila/);
    assert.match(migracija, /delete from public\.zadeva_poravnave/);
    assert.match(migracija, /revoke all on function public\.razveljavi_opomin_poravnavo[^;]+from public, anon, authenticated/);
  });

  await test("že zabeleženo obljubo plačila je mogoče odstraniti in varno razveljaviti", () => {
    const src = citaj("app/izvedba.js");
    const api = citaj("api/izvedi-opomin-ukrep.js");
    const migracija = citaj("supabase/migrations/20260824183532_undo_payment_promise.sql");
    const lokalniStreznik = citaj("scripts/local-server.js");
    assert.match(src, /\["partial_payment", "partial_settlement", "paid_in_full", "payment_promised", "stop_plan"\]/);
    assert.match(src, /if \(actionType === "payment_promised"\) return "undo_payment_promise"/);
    assert.match(api, /actionType === "undo_payment_promise"/);
    assert.match(api, /razveljavi_obljubo_placila/);
    assert.match(migracija, /action_type <> 'payment_promised'/);
    assert.match(migracija, /delete from public\.opomin_ukrepi/);
    assert.match(migracija, /execution_state = case when v_prejsnji_rok is null then 'scheduled' else 'paused' end/);
    assert.match(migracija, /revoke all on function public\.razveljavi_obljubo_placila[^;]+from public, anon, authenticated/);
    assert.match(lokalniStreznik, /const izvediOpominUkrepModul = require\.resolve\("\.\.\/api\/izvedi-opomin-ukrep"\)/);
    assert.match(lokalniStreznik, /pathname === "\/api\/izvedi-opomin-ukrep"/);
    assert.match(lokalniStreznik, /izvediLokalniApi\(req, res, lokalniModul\)/);
  });

  await test("localhost uporablja isto aktualno izvedba kodo za branje in spremembo", () => {
    const lokalniStreznik = citaj("scripts/local-server.js");
    assert.match(lokalniStreznik, /const pridobiIzvedboModul = require\.resolve\("\.\.\/api\/pridobi-izvedbo"\)/);
    assert.match(lokalniStreznik, /"\.vercel", "\.env\.production\.local"/);
    assert.match(lokalniStreznik, /\^\\\[\(\?:SENSITIVE\|REDACTED\)\\\]\$\/i/);
    assert.match(lokalniStreznik, /pathname === "\/api\/pridobi-izvedbo" \|\| pathname === "\/api\/izvedi-opomin-ukrep"/);
    assert.match(lokalniStreznik, /pathname === "\/api\/pridobi-izvedbo" \? pridobiIzvedboModul : izvediOpominUkrepModul/);
  });

  await test("ustavitev načrta ima delujoč gumb za odstranitev in atomsko razveljavitev", () => {
    const src = citaj("app/izvedba.js");
    const api = citaj("api/izvedi-opomin-ukrep.js");
    const migracija = citaj("supabase/migrations/20260824190948_undo_stopped_plan.sql");
    assert.match(src, /\["partial_payment", "partial_settlement", "paid_in_full", "payment_promised", "stop_plan"\]/);
    assert.match(src, /if \(actionType === "stop_plan"\) return "undo_stop_plan"/);
    assert.match(api, /actionType === "undo_stop_plan"/);
    assert.match(api, /razveljavi_ustavitev_opomin_nacrta/);
    assert.match(migracija, /action_type <> 'stop_plan'/);
    assert.match(migracija, /v_novi_plan := v_zadeva\.opomin_nacrt - 'pausedAt' - 'resumeAt' - 'resumeMode'/);
    assert.match(migracija, /execution_state = 'scheduled'/);
    assert.match(migracija, /delete from public\.opomin_ukrepi/);
    assert.match(migracija, /revoke all on function public\.razveljavi_ustavitev_opomin_nacrta[^;]+from public, anon, authenticated/);
  });

  await test("povzetek plačilnega načrta jasno opiše dolžnika, dolg, datum in opomin", () => {
    const src = citaj("app/izvedba.js");
    assert.match(src, /state\.poravnavaDogovorAt = new Date\(\)\.toISOString\(\)/);
    assert.match(src, /zadeva\.imeDolznika/);
    assert.match(src, /var znesekDolga = trenutniPreostaliDolg\(\)/);
    assert.match(src, /Intl\.DateTimeFormat\("sl-SI"/);
    assert.match(src, /izvedba-poravnava-pripoved__datum/);
    assert.match(src, /dolga v višini/);
    assert.match(src, /ni poravnal/);
    assert.match(src, /\. opominu<\/b> je pristal/);
    assert.doesNotMatch(src, /Zdaj sledi nov plačilni plan/);
  });

  await test("vnos zgodovine uporablja ločene pretekle dogodke brez prihodnjega načrtovalca", () => {
    const src = citaj("app/izvedba.js");
    const zgodovina = citaj("app/neplacila-zgodovina.js");
    const css = citaj("app/izvedba.css");
    assert.match(src, /function izrisiZgodovinaKontrolnik\(tip\)/);
    assert.match(src, /tip === "partial" \|\| tip === "installment"/);
    assert.match(src, /Podatki o dogodku/);
    assert.match(src, /\+ Dodaj dogodek/);
    assert.match(src, /korakDodan && jeVnosZgodovine\(\)\) state\.selectedSettlementType = null/);
    assert.match(src, /jeZgodovina \? 'Dogodek ' : 'Korak '/);
    assert.match(src, /besedaZaSteviloDogodkov/);
    assert.match(src, /occurredAt/);
    assert.match(zgodovina, /\+ Dodaj dogodek/);
    assert.match(css, /\.stran--neplacila-zgodovina \.izvedba-poravnava-podrobnosti__naslov \{ margin-bottom: 8px; \}/);
  });

  await test("plačane obroke v zgodovini je mogoče vnesti kot strnjen seznam", () => {
    const src = citaj("app/izvedba.js");
    assert.match(src, /if \(tip === "installment"\)[\s\S]*?Obrok je plačan[\s\S]*?Dogovor o obrokih/);
    assert.match(src, /zagotoviObrokPlaner\(\);\s*return obrokiIzbira \+ izrisiObrokPlaner\(\);/);
    assert.match(src, /jePlacanaZgodovina[\s\S]*?nastavitve\.paymentMethod/);
    assert.match(src, /jePlacanaZgodovina \? 'Dodaj ' \+ K\.esc\(sklonjenoDodajObroke/);
    assert.match(src, /var omejitevDatuma = jePlacanaZgodovina \? ' max=/);
    assert.match(src, /if \(jeVnosZgodovine\(\)\) state\.selectedSettlementType = null;/);
  });

  await test("vsak datum dogodka omogoča neznan ali približen vnos", () => {
    const src = citaj("app/izvedba.js");
    const css = citaj("app/neplacila-zgodovina.css");
    assert.match(src, /data-history-date-unknown/);
    assert.match(src, /data-history-date-approx=/);
    assert.match(src, /data-history-date-approximation=/);
    assert.match(src, /placeholder="Npr\. začetek maja 2025"/);
    assert.match(src, /function zgodovinaDatumJeVeljaven/);
    assert.match(src, /data-obrok-planer-datum-unknown/);
    assert.match(src, /data-obrok-planer-datum-approx=/);
    assert.match(src, /data-obrok-planer-datum-approximation=/);
    assert.match(src, /datumPribliznoAktivno/);
    assert.match(css, /\.zgodovina-dogodek__datum\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto auto/);
    assert.match(css, /\.zgodovina-dogodek__datum-priblizno/);
    assert.match(css, /\.izvedba-obrok-planer__datum-moznosti/);
  });

  await test("izbira kartice ohrani vodoravni položaj seznama", () => {
    const src = citaj("app/izvedba.js");
    assert.match(src, /var prejsnjiSvicerScrollLeft = prejsnjiSvicer \? prejsnjiSvicer\.scrollLeft : null/);
    assert.match(src, /noviSvicer\.scrollLeft = Math\.min\(prejsnjiSvicerScrollLeft/);
  });

  console.log("\nUspešnih izvedba testov: " + passed);
}

main().catch(function (err) {
  console.error(err.stack || err);
  process.exit(1);
});
