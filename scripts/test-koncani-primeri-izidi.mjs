import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(root, "..", "app");
const apiRoot = path.join(root, "..", "api", "_lib");

global.window = global;
require(path.join(appRoot, "nastavitve-izidov.js"));
const { izpeljiPrikazniModel, izpeljiPotekResitve, pripraviDokumente, steviloPoslanihOpominov } = require(path.join(appRoot, "koncani-primeri.js"));
const core = require(path.join(apiRoot, "izvedba-core.js"));

var testi = 0;
function test(ime, fn) {
  fn();
  testi += 1;
}

var zadevaOsnova = {
  ime_dolznika: "Mizarstvo Novak d.o.o.",
  opis_dolga: "Izdelava pohištva",
  stevilka_racuna: "R-2026-0042",
  prvotni_znesek: 1000,
  placano_skupaj: 0,
  poravnano_nedenarno: 0,
  preostali_dolg: 1000,
  poravnano_at: "2026-08-21T10:00:00Z",
  datum_zapadlosti: "2026-07-01",
};

function zadeva(overrides) {
  return Object.assign({}, zadevaOsnova, overrides);
}

/* 1. full brez prejšnjih plačil */
test("full brez prejšnjih plačil", function () {
  var placila = [{ znesek: 1000, vrsta: "full", datum_placila: "2026-08-21" }];
  var model = izpeljiPrikazniModel(zadeva({ placano_skupaj: 1000, preostali_dolg: 0 }), placila, [], 3);
  assert.equal(model.izidId, "full");
  assert.equal(model.terminalen, true);
  assert.equal(model.naslov, "Plačano v celoti");
  assert.equal(model.barva, "#299b63");
  assert.equal(model.zneski.preostanek, 0);
});

/* 4. partial + final full → Plačano po delih */
test("partial + final full -> partial_then_full", function () {
  var placila = [
    { znesek: 400, vrsta: "partial", datum_placila: "2026-08-01" },
    { znesek: 600, vrsta: "full", datum_placila: "2026-08-21" },
  ];
  var model = izpeljiPrikazniModel(zadeva({ placano_skupaj: 1000, preostali_dolg: 0 }), placila, [], 2);
  assert.equal(model.izidId, "partial_then_full");
  assert.equal(model.naslov, "Plačano po delih");
  assert.equal(model.barva, "#3aa99c");
  assert.equal(model.datum, "2026-08-21");
});

/* 5. installment + final full → Plačano v obrokih */
test("installment + final full -> installment_completed", function () {
  var placila = [
    { znesek: 300, vrsta: "installment", datum_placila: "2026-07-01" },
    { znesek: 300, vrsta: "installment", datum_placila: "2026-07-15" },
    { znesek: 400, vrsta: "full", datum_placila: "2026-08-21" },
  ];
  var model = izpeljiPrikazniModel(zadeva({ placano_skupaj: 1000, preostali_dolg: 0 }), placila, [], 5);
  assert.equal(model.izidId, "installment_completed");
  assert.equal(model.naslov, "Plačano v obrokih");
  assert.equal(model.barva, "#397fd0");
});

/* 6. compensation brez denarnega priliva */
test("compensation brez denarnega priliva", function () {
  var poravnave = [{ vrsta: "compensation", znesek: 1000, datum_poravnave: "2026-08-21" }];
  var model = izpeljiPrikazniModel(zadeva({ poravnano_nedenarno: 1000, preostali_dolg: 0 }), [], poravnave, 1);
  assert.equal(model.izidId, "compensation");
  assert.equal(model.naslov, "Zaključeno s kompenzacijo");
  assert.equal(model.financniPrikaz, "kompenzacija");
  assert.equal(model.zneski.prejeto, 0, "kompenzacija ne sme šteti kot denarni priliv");
  assert.equal(model.zneski.nedenarnoPoravnano, 1000);
});

/* 7. partial + compensation */
test("partial + compensation - prejeto pred zaključkom se ne meša s kompenzacijo", function () {
  var placila = [{ znesek: 300, vrsta: "partial", datum_placila: "2026-07-01" }];
  var poravnave = [{ vrsta: "compensation", znesek: 700, datum_poravnave: "2026-08-21" }];
  var model = izpeljiPrikazniModel(zadeva({ placano_skupaj: 300, poravnano_nedenarno: 700, preostali_dolg: 0 }), placila, poravnave, 4);
  assert.equal(model.izidId, "compensation");
  assert.equal(model.zneski.prejetoPredZakljuckom, 300, "Več informacij mora ločeno pokazati denar prejet pred nedenarnim zaključkom");
  assert.equal(model.zneski.nedenarnoPoravnano, 700);
  assert.equal(model.zneski.prejeto, 300, "prejeto ostaja dejansko prejet denar (za Več informacij), tudi če je primer zaključen nedenarno");
  assert.equal(model.financniPrikaz, "kompenzacija", "glavni finančni tok mora prikazati Kompenzirano, ne Prejeto");
  assert.equal(
    round2(model.zneski.prejeto + model.zneski.nedenarnoPoravnano + model.zneski.preostanek),
    round2(model.zneski.prvotniDolg)
  );
});

/* credit_note pokrije celoten preostanek (validacija) */
test("credit_note pokrije celoten preostanek je sprejet", function () {
  var res = core.validirajNastavitve(
    "paid_in_full",
    { settlementType: "credit_note", settlementAmount: 250 },
    { preostaliDolg: 250 }
  );
  assert.equal(res.ok, true);
  assert.equal(res.settings.settlementType, "credit_note");
});

/* 9. credit_note z napačnim zneskom je zavrnjen */
test("credit_note z napačnim zneskom je zavrnjen", function () {
  var res = core.validirajNastavitve(
    "paid_in_full",
    { settlementType: "credit_note", settlementAmount: 100 },
    { preostaliDolg: 250 }
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, "INVALID_SETTINGS");
});

/* 10. cancelled_invoice brez razloga je zavrnjen */
test("cancelled_invoice brez razloga je zavrnjen", function () {
  var res = core.validirajNastavitve(
    "paid_in_full",
    { settlementType: "cancelled_invoice", reason: "" },
    { preostaliDolg: 250 }
  );
  assert.equal(res.ok, false);
  assert.equal(res.code, "INVALID_SETTINGS");
});

test("cancelled_invoice z razlogom je sprejet", function () {
  var res = core.validirajNastavitve(
    "paid_in_full",
    { settlementType: "cancelled_invoice", reason: "agreement" },
    { preostaliDolg: 250 }
  );
  assert.equal(res.ok, true);
  assert.equal(res.settings.reason, "agreement");
});

/* 12. stop_plan ne ustvari Končanega primera - status postane "paused", ne "Rešeno" */
test("stop_plan ne zaključi zadeve (status postane paused)", function () {
  var plan = { steps: [], version: "0" };
  var res = core._test.izracunajUstavitevNacrta({ plan: plan, koraki: [], settings: { resumeMode: "manual", resumeAt: null } });
  assert.equal(res.ok, true);
  assert.equal(res.newPlan.status, "paused");
  assert.notEqual(res.newPlan.status, "Rešeno");
});

/* 13. payment_promised ne ustvari Končanega primera */
test("payment_promised ne zaključi zadeve (status postane waiting_for_promised_payment)", function () {
  var plan = { steps: [], version: "0" };
  var res = core._test.izracunajObljuboPlacila({ plan: plan, koraki: [], settings: { waitDays: 4 } });
  assert.equal(res.ok, true);
  assert.equal(res.newPlan.status, "waiting_for_promised_payment");
});

/* 14. handoff_to_lawyer ne ustvari finančno zaključenega primera */
test("handoff_to_lawyer ne spremeni zadeve.status", function () {
  var plan = { steps: [{ id: "s1", kind: "manual_lawyer", lawyerHandoff: {
    lawyerId: "l1", selectedPackage: { packageId: "p1" }, documents: [{ id: "d1" }], message: "Prosim za obravnavo.",
  } }], version: "0" };
  var res = core._test.izracunajPredajoOdvetniku({ plan: plan, koraki: [], settings: { timingMode: "asap" } });
  assert.equal(res.ok, true);
  assert.equal(res.newPlan.status, undefined, "predaja odvetniku ne sme nastaviti plan.status na Rešeno");
});

/* 16. finančna enačba vedno drži */
test("finančna enačba: prvotniDolg = prejeto + nedenarnoPoravnano + preostanek (full)", function () {
  var placila = [{ znesek: 1000, vrsta: "full", datum_placila: "2026-08-21" }];
  var model = izpeljiPrikazniModel(zadeva({ placano_skupaj: 1000, preostali_dolg: 0 }), placila, [], 1);
  var z = model.zneski;
  assert.equal(round2(z.prejeto + z.nedenarnoPoravnano + z.preostanek), round2(z.prvotniDolg));
});

test("finančna enačba drži tudi za credit_note", function () {
  var poravnave = [{ vrsta: "credit_note", znesek: 1000, datum_poravnave: "2026-08-21" }];
  var model = izpeljiPrikazniModel(zadeva({ poravnano_nedenarno: 1000, preostali_dolg: 0 }), [], poravnave, 0);
  var z = model.zneski;
  assert.equal(round2(z.prejeto + z.nedenarnoPoravnano + z.preostanek), round2(z.prvotniDolg));
});

function round2(n) { return Math.round(Number(n) * 100) / 100; }

/* 17. opomini se štejejo po unikatnem step_id, ne po kanalu */
test("opomini: unikatni step_id, ne kanali", function () {
  var koraki = [
    { step_id: "s1", execution_state: "sent" },
    { step_id: "s1", execution_state: "sent" },
    { step_id: "s2", execution_state: "sent" },
    { step_id: "s3", execution_state: "scheduled" },
  ];
  assert.equal(steviloPoslanihOpominov(koraki), 2);
});

/* 18. po osvežitvi (ponovnem klicu s istimi podatki) ostanejo isti izid/barva/datum/zneski */
test("izpeljiPrikazniModel je čista/deterministična funkcija", function () {
  var placila = [{ znesek: 1000, vrsta: "full", datum_placila: "2026-08-21" }];
  var a = izpeljiPrikazniModel(zadeva({ placano_skupaj: 1000, preostali_dolg: 0 }), placila, [], 3);
  var b = izpeljiPrikazniModel(zadeva({ placano_skupaj: 1000, preostali_dolg: 0 }), placila, [], 3);
  assert.deepEqual(a, b);
});

/* 19. Več informacij pokaže dejansko revizijsko zgodovino */
test("zgodovina plačil/poravnav odraža dejanske vhodne podatke", function () {
  var placila = [
    { znesek: 400, vrsta: "partial", datum_placila: "2026-08-01", action_id: "a1" },
    { znesek: 600, vrsta: "full", datum_placila: "2026-08-21", action_id: "a2" },
  ];
  var model = izpeljiPrikazniModel(zadeva({ placano_skupaj: 1000, preostali_dolg: 0 }), placila, [], 0);
  assert.equal(model.zgodovinaPlacil.length, 2);
  assert.equal(model.zgodovinaPlacil[0].vrsta, "partial");
  assert.equal(model.zgodovinaPlacil[1].vrsta, "full");
});

test("potek rešitve ohrani vmesni postopek in vse dodane finančne korake", function () {
  var placila = [
    { action_id: "a2", znesek: 150, vrsta: "installment", datum_placila: "2026-08-23" },
  ];
  var poravnave = [
    { action_id: "a3", znesek: 850, vrsta: "credit_note", datum_poravnave: "2026-08-24", razlog: null },
  ];
  var ukrepi = [
    { action_id: "a1", action_type: "stop_plan", status: "completed", settings: { resumeMode: "manual" }, completed_at: "2026-08-21T21:25:00Z" },
    { action_id: "a2", action_type: "partial_payment", status: "completed", settings: { settlementType: "installment", paymentAmount: 150, settledAt: "2026-08-23T09:30:00Z" }, completed_at: "2026-08-23T09:31:00Z" },
    { action_id: "a3", action_type: "paid_in_full", status: "completed", settings: { settlementType: "credit_note", settlementAmount: 850, settledAt: "2026-08-24T19:03:00Z" }, completed_at: "2026-08-24T19:03:30Z" },
  ];
  var potek = izpeljiPotekResitve(ukrepi, placila, poravnave);
  assert.deepEqual(potek.map(function (k) { return k.naslov; }), ["Načrt ustavljen", "Prejeti obrok", "Dobropis"]);
  assert.deepEqual(potek.map(function (k) { return k.znesek; }), [null, 150, 850]);
  assert.equal(potek[1].datum, "2026-08-23T09:30:00Z");
  assert.equal(potek[2].barva, "#e89524");
});

test("predogled dokumentov pravilno upošteva vse vmesne finančne korake", function () {
  var model = {
    racun: "Nsjs",
    zneski: { prvotniDolg: 9446 },
    potekResitve: [
      { naslov: "Prejeti obrok", razred: "obrok", znesek: 31, datum: "2026-08-23" },
      { naslov: "Delno plačilo", razred: "delno", znesek: 32, datum: "2026-08-23" },
      { naslov: "Delno plačilo", razred: "delno", znesek: 22, datum: "2026-08-23" },
      { naslov: "Zaključeno z dobropisom", razred: "dobropis", znesek: 9361, datum: "2026-08-24" },
    ],
  };
  var dokumenti = pripraviDokumente(model);
  assert.equal(dokumenti.length, 4);
  assert.equal(dokumenti[3].naslov, "Dobropis");
  assert.equal(dokumenti[3].pred, 9361);
  assert.equal(dokumenti[3].po, 0);
});

test("podrobnosti zamenjajo stari finančni tok s PDF predogledom računov", function () {
  var src = fs.readFileSync(path.join(appRoot, "koncani-primeri.js"), "utf8");
  var css = fs.readFileSync(path.join(appRoot, "koncani-primeri.css"), "utf8");
  assert.doesNotMatch(src, /htmlFinancniTok|aria-label="Finančni tok"/);
  assert.doesNotMatch(src, /koncani-dokumenti__chevron/);
  assert.match(src, /Predogled računov/);
  assert.match(src, /PDF PREDOGLED/);
  assert.match(src, /Preglej celoten račun/);
  assert.match(src, /data-koncani-dokument-drsnik/);
  assert.match(src, /koncani-dokumenti__pikica/);
  assert.match(src, /Math\.round\(drsnik\.scrollLeft \/ korakDrsnika\(\)\)/);
  assert.match(src, /drsnik\.scrollLeft >= skrajniOdmik - 2/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /flex:\s*0 0 calc\(66\.6667% - 5px\)/);
  assert.match(css, /\.koncani-mreza__polje\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.koncani-vec-info__gumb\s*\{[\s\S]*?min-height:\s*40px/);
});

test("potek rešitve za starejši primer uporabi finančne zapise tudi brez opomin_ukrepi", function () {
  var potek = izpeljiPotekResitve([], [
    { action_id: "p1", znesek: 400, vrsta: "partial", datum_placila: "2026-08-01" },
    { action_id: "p2", znesek: 600, vrsta: "full", datum_placila: "2026-08-21" },
  ], []);
  assert.deepEqual(potek.map(function (k) { return k.naslov; }), ["Delno plačilo", "Plačano v celoti"]);
  assert.deepEqual(potek.map(function (k) { return k.znesek; }), [400, 600]);
});

test("starejši nedenarni zapis z drugim action_id se v poteku ne podvoji", function () {
  var potek = izpeljiPotekResitve([
    { action_id: "stari-ukrep", action_type: "paid_in_full", status: "completed", settings: { settlementType: "credit_note" }, completed_at: "2026-08-21T10:00:00Z" },
  ], [], [
    { action_id: "backfill-zapis", znesek: 1000, vrsta: "credit_note", datum_poravnave: "2026-08-21" },
  ]);
  assert.equal(potek.length, 1);
  assert.equal(potek[0].naslov, "Dobropis");
  assert.equal(potek[0].znesek, 1000);
});

test("cancelled_invoice zgodovina vsebuje razlog storna", function () {
  var poravnave = [{ vrsta: "cancelled_invoice", znesek: 1000, datum_poravnave: "2026-08-21", razlog: "agreement" }];
  var model = izpeljiPrikazniModel(zadeva({ poravnano_nedenarno: 1000, preostali_dolg: 0 }), [], poravnave, 0);
  assert.equal(model.izidId, "cancelled_invoice");
  assert.equal(model.zgodovinaPoravnav[0].razlog, "agreement");
});

/* legacy fallback samo za stare nepopolne podatke */
test("brez placil in poravnav pade v legacy fallback", function () {
  var model = izpeljiPrikazniModel(zadeva({}), [], [], 0);
  assert.equal(model.izidId, "legacy");
  assert.equal(model.naslov, "Primer zaključen");
});

/* Barve/RGB morajo ustrezati zahtevanim vrednostim iz naloge - preveri
   neposredno v skupni konfiguraciji, da izvedba.js in koncani-primeri.js
   ne moreta razpasti narazen. */
test("nastavitve-izidov.js vsebuje zahtevane barve", function () {
  var src = fs.readFileSync(path.join(appRoot, "nastavitve-izidov.js"), "utf8");
  assert.match(src, /full:[\s\S]{0,300}barva: "#299b63"/);
  assert.match(src, /partial:[\s\S]{0,300}barva: "#3aa99c"/);
  assert.match(src, /compensation:[\s\S]{0,300}barva: "#448bd3"/);
  assert.match(src, /installment:[\s\S]{0,400}barva: "#397fd0"/);
  assert.match(src, /credit_note:[\s\S]{0,300}barva: "#e89524"/);
  assert.match(src, /cancelled_invoice:[\s\S]{0,300}barva: "#cf4c4c"/);
});

test("izvedba.js uporablja skupno konfiguracijo namesto podvojene", function () {
  var src = fs.readFileSync(path.join(appRoot, "izvedba.js"), "utf8");
  assert.match(src, /UJNastavitveIzidov/);
  assert.doesNotMatch(src, /naslov: "Plačilo v celoti", opis: "Celotni dolg je poravnan\./);
});

test("koncani-primeri.js uporablja skupno konfiguracijo namesto podvojene", function () {
  var src = fs.readFileSync(path.join(appRoot, "koncani-primeri.js"), "utf8");
  assert.match(src, /UJNastavitveIzidov/);
  assert.doesNotMatch(src, /full: \{\s*filter: "paid"/);
});

/* Migracija: nedenarna poravnava ne sme povečati placano_skupaj. */
test("migracija: nedenarna poravnava ne spremeni placano_skupaj", function () {
  var migPot = path.join(root, "..", "supabase", "migrations", "20260823150000_nedenarne_poravnave.sql");
  var sql = fs.readFileSync(migPot, "utf8");
  assert.match(sql, /poravnano_nedenarno = poravnano_nedenarno \+ v_nedenarni_znesek/);
  var nedenarniBlok = sql.slice(sql.indexOf("-- compensation / credit_note"), sql.indexOf("insert into public.zadeva_poravnave"));
  assert.doesNotMatch(nedenarniBlok, /placano_skupaj\s*=/);
  assert.match(sql, /zadeve_vsota_uravnotezena[\s\S]{0,200}placano_skupaj \+ poravnano_nedenarno \+ preostali_dolg/);
});

console.log("Podrobnosti zaključka (koncani-primeri): " + testi + " testov uspešnih");
