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
const { izpeljiPrikazniModel, izpeljiPotekResitve, pripraviDokumente, steviloPoslanihOpominov, naloziVseStrani } = require(path.join(appRoot, "koncani-primeri.js"));
const core = require(path.join(apiRoot, "izvedba-core.js"));

var testi = 0;
function test(ime, fn) {
  fn();
  testi += 1;
}

async function testAsync(ime, fn) {
  await fn();
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
  assert.equal(model.datum, "2026-08-21T10:00:00Z");
});

test("delni dobropis + poznejše polno plačilo -> partial_then_full", function () {
  var placila = [{ id: "p-full", znesek: 700, vrsta: "full", datum_placila: "2026-08-21", created_at: "2026-08-21T09:00:00Z" }];
  var poravnave = [{ id: "s-credit", znesek: 300, vrsta: "credit_note", datum_poravnave: "2026-08-20", created_at: "2026-08-20T09:00:00Z" }];
  var model = izpeljiPrikazniModel(
    zadeva({ placano_skupaj: 700, poravnano_nedenarno: 300, preostali_dolg: 0 }),
    placila,
    poravnave,
    2
  );
  assert.equal(model.izidId, "partial_then_full");
  assert.equal(model.naslov, "Plačano po delih");
  assert.equal(model.datum, "2026-08-21T10:00:00Z");
});

test("poznejša nedenarna poravnava zmaga nad starejšim polnim plačilom", function () {
  var placila = [{ id: "p-full", znesek: 700, vrsta: "full", datum_placila: "2026-08-20", created_at: "2026-08-20T09:00:00Z" }];
  var poravnave = [{ id: "s-comp", znesek: 300, vrsta: "compensation", datum_poravnave: "2026-08-21", created_at: "2026-08-21T09:00:00Z" }];
  var model = izpeljiPrikazniModel(zadeva({ placano_skupaj: 700, poravnano_nedenarno: 300, preostali_dolg: 0 }), placila, poravnave, 2);
  assert.equal(model.izidId, "compensation");
});

test("isti poslovni datum uporabi created_at deterministično tudi pri obrnjenih vhodih", function () {
  var placila = [
    { id: "p-delno", znesek: 100, vrsta: "partial", datum_placila: "2026-08-21", created_at: "2026-08-21T07:00:00Z" },
    { id: "p-full", znesek: 600, vrsta: "full", datum_placila: "2026-08-21", created_at: "2026-08-21T09:00:00Z" },
  ];
  var poravnave = [
    { id: "s-comp", znesek: 100, vrsta: "compensation", datum_poravnave: "2026-08-21", created_at: "2026-08-21T08:00:00Z" },
    { id: "s-credit", znesek: 200, vrsta: "credit_note", datum_poravnave: "2026-08-21", created_at: "2026-08-21T10:00:00Z" },
  ];
  var podatki = zadeva({ placano_skupaj: 700, poravnano_nedenarno: 300, preostali_dolg: 0 });
  var a = izpeljiPrikazniModel(podatki, placila, poravnave, 2);
  var b = izpeljiPrikazniModel(podatki, placila.slice().reverse(), poravnave.slice().reverse(), 2);
  assert.equal(a.izidId, "credit_note");
  assert.equal(b.izidId, "credit_note");
  assert.deepEqual(a, b);
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

test("partial_settlement kompenzacija ohrani kind in vrsto finančnega zapisa", function () {
  var res = core.validirajNastavitve(
    "partial_settlement",
    { kind: "compensation", amount: 250, settledAt: "2026-08-20T09:00:00Z" },
    { preostaliDolg: 1000 }
  );
  assert.equal(res.ok, true);
  assert.equal(res.settings.kind, "compensation");
  assert.equal(res.placiloVrsta, "compensation");
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
  assert.equal(potek[1].barvaKontrast, "#2566b0");
  assert.equal(potek[2].barvaKontrast, "#9a5700");
});

test("predogled dokumentov mapira samo dejanske zasebne priponke", function () {
  var model = {
    racunDatotekePoti: ["user/case/1700000-abcd-racun.pdf", "user/case/1700001-efgh-racun.jpg", "", null],
  };
  var dokumenti = pripraviDokumente(model);
  assert.equal(dokumenti.length, 2);
  assert.equal(dokumenti[0].naslov, "Račun PDF");
  assert.equal(dokumenti[1].naslov, "Slika računa");
  assert.equal(dokumenti[0].pot, "user/case/1700000-abcd-racun.pdf");
  assert.equal("pred" in dokumenti[0], false);
  assert.equal("po" in dokumenti[0], false);
});

test("podrobnosti uporabljajo podpisane povezave in nimajo lažnega PDF-ja", function () {
  var src = fs.readFileSync(path.join(appRoot, "koncani-primeri.js"), "utf8");
  var css = fs.readFileSync(path.join(appRoot, "koncani-primeri.css"), "utf8");
  assert.doesNotMatch(src, /htmlFinancniTok|aria-label="Finančni tok"/);
  assert.doesNotMatch(src, /koncani-dokumenti__chevron/);
  assert.doesNotMatch(src, /PDF PREDOGLED/);
  assert.match(src, /racun_datoteke_poti/);
  assert.match(src, /storage\.from\("racuni-priloge"\)\.createSignedUrl\(dokument\.pot, 60\)/);
  assert.doesNotMatch(src, /href[^\n]+dokument\.pot/);
  assert.match(src, /data-koncani-dokument-drsnik/);
  assert.match(src, /koncani-dokumenti__pikica/);
  assert.match(src, /Math\.round\(drsnik\.scrollLeft \/ korakDrsnika\(\)\)/);
  assert.match(src, /drsnik\.scrollLeft >= skrajniOdmik - 2/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /flex:\s*0 0 calc\(66\.6667% - 5px\)/);
  assert.match(css, /\.koncani-mreza__polje\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.koncani-vec-info__gumb\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.koncani-dokumenti__zavihek\s*\{[\s\S]*?height:\s*44px/);
  assert.match(css, /\.koncani-dokumenti__pikica\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px/);
  assert.match(css, /\.koncani-dokument__odpri\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 430px\)[\s\S]*?width:\s*100vw/);
  assert.match(css, /\[data-koncani-fit\]\.is-preveliko[\s\S]*?overflow-wrap:\s*anywhere/);
});

await testAsync("naloziVseStrani vrne več kot 1000 vrstic", async function () {
  var podatki = Array.from({ length: 1037 }, function (_, indeks) { return { id: indeks + 1 }; });
  var klici = [];
  var rezultat = await naloziVseStrani(async function (od, doVkljucno) {
    klici.push([od, doVkljucno]);
    return { data: podatki.slice(od, doVkljucno + 1), error: null };
  }, 500);
  assert.equal(rezultat.length, 1037);
  assert.deepEqual(klici, [[0, 499], [500, 999], [1000, 1499]]);
});

await testAsync("naloziVseStrani ne skrije napake vmesne strani", async function () {
  var stran = 0;
  await assert.rejects(function () {
    return naloziVseStrani(async function () {
      stran += 1;
      return stran === 2 ? { data: null, error: new Error("vmesna napaka") } : { data: Array.from({ length: 500 }, function () { return {}; }), error: null };
    }, 500);
  }, /vmesna napaka/);
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

test("legacy finančni koraki 40 + 60 se porabijo enkrat in stabilno razvrstijo", function () {
  var ukrepi = [
    { action_id: "legacy-a", action_type: "partial_payment", status: "completed", settings: { paymentAmount: 40 }, completed_at: "2026-08-20T09:00:00Z" },
    { action_id: "legacy-b", action_type: "partial_payment", status: "completed", settings: { paymentAmount: 60 }, completed_at: "2026-08-21T09:00:00Z" },
  ];
  var placila = [
    { action_id: "backfill-b", znesek: 60, vrsta: "partial", datum_placila: "2026-08-21" },
    { action_id: "backfill-a", znesek: 40, vrsta: "partial", datum_placila: "2026-08-20" },
  ];
  var a = izpeljiPotekResitve(ukrepi, placila, []);
  var b = izpeljiPotekResitve(ukrepi.slice().reverse(), placila.slice().reverse(), []);
  assert.deepEqual(a.map(function (k) { return k.znesek; }), [40, 60]);
  assert.deepEqual(b.map(function (k) { return k.znesek; }), [40, 60]);
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

test("seznam ima osveževanje, timeout, retry in čiščenje query parametrov", function () {
  var src = fs.readFileSync(path.join(appRoot, "koncani-primeri.js"), "utf8");
  var html = fs.readFileSync(path.join(appRoot, "koncani-primeri.html"), "utf8");
  assert.match(src, /addEventListener\("pageshow"/);
  assert.match(src, /addEventListener\("visibilitychange"/);
  assert.match(src, /postgres_changes/);
  assert.match(src, /\.subscribe\(\)/);
  assert.match(src, /sCasovnoOmejitvijo\(naloziPrimere\(\), 20000\)/);
  assert.match(html, /data-koncani-ponovi/);
  assert.match(src, /searchParams\.delete\("nov"\)/);
  assert.match(src, /state\.novPrimerId = null/);
  assert.match(src, /odstraniPrimerIzUrl\(\)/);
  assert.match(src, /searchParams\.delete\("primer"\)/);
});

test("izvedba je za rešen primer resnično samo za branje", function () {
  var src = fs.readFileSync(path.join(appRoot, "izvedba.js"), "utf8");
  var html = fs.readFileSync(path.join(appRoot, "izvedba.html"), "utf8");
  var css = fs.readFileSync(path.join(appRoot, "izvedba.css"), "utf8");
  assert.match(src, /readonly:\s*url\.searchParams\.get\("readonly"\) === "1"/);
  assert.match(src, /state\.readonlyRequested === true[\s\S]*?state\.zadeva\.status === "Rešeno"/);
  ["odstraniIzvedenKorak", "nastaviNovNacrt", "submitSelectedAction", "posljiOpominZdaj", "submitLawyerWizard", "racunPoravnan", "odpriActionSheet"].forEach(function (ime) {
    assert.match(src, new RegExp("(?:async\\s+)?function\\s+" + ime + "\\([^)]*\\)\\s*\\{\\s*if \\(zavrniSprememboCeSamoZaBranje\\(\\)\\) return;"), ime + " nima fail-closed read-only guarda");
  });
  assert.match(src, /function izrisiActionSheet\(\)[\s\S]*?if \(jeSamoZaBranje\(\)\)/);
  assert.match(src, /function izrisiSticky\(\)[\s\S]*?if \(jeSamoZaBranje\(\) \|\|/);
  assert.match(src, /readonly aria-readonly="true"/);
  assert.match(src, /if \(!samoZaBranje\) dodajHitraDejanja\(\)/);
  assert.match(html, /id="izvedba-readonly-banner"/);
  assert.match(css, /body\.izvedba-readonly \.zo-akcije/);
  assert.match(css, /\.zo-sporocilo__telo\[readonly\]/);
  assert.match(src, /Zaključen korak:/);
  assert.match(src, /Kompenzacija \(pobot\)/);
});

test("oba mutacijska API-ja zavrneta CASE_RESOLVED in prevedeta DB race marker", function () {
  ["izvedi-opomin-ukrep.js", "poslji-opomin-zdaj.js"].forEach(function (ime) {
    var src = fs.readFileSync(path.join(root, "..", "api", ime), "utf8");
    assert.match(src, /CASE_RESOLVED:\s*409/);
    assert.match(src, /zadeva\.status === "Rešeno"/);
    assert.match(src, /res\.status\(409\)\.json\(\{ ok: false, code: "CASE_RESOLVED"/);
    assert.match(src, /err && err\.message[\s\S]*?CASE_RESOLVED/);
  });
});

test("migracija popravi delne kompenzacije in zaklene spremembe rešenih zadev", function () {
  var migPot = path.join(root, "..", "supabase", "migrations", "20260831120000_koncani_primeri_integrity.sql");
  var sql = fs.readFileSync(migPot, "utf8");

  assert.match(sql, /create or replace function public\.popravi_vrsto_delne_kompenzacije\(\)[\s\S]*?security invoker[\s\S]*?set search_path = ''/i);
  assert.match(sql, /create trigger zadeva_poravnave_delna_kompenzacija_trg[\s\S]*?before insert on public\.zadeva_poravnave/i);
  assert.match(sql, /new\.vrsta = 'credit_note'[\s\S]*?u\.action_id = new\.action_id[\s\S]*?u\.zadeva_id = new\.zadeva_id[\s\S]*?u\.obrtnik_id = new\.obrtnik_id/i);
  assert.match(sql, /u\.action_type = 'partial_settlement'[\s\S]*?u\.settings->>'kind' = 'compensation'[\s\S]*?new\.vrsta := 'compensation'/i);

  var backfillZacetek = sql.indexOf("update public.zadeva_poravnave p");
  var backfillKonec = sql.indexOf("create or replace function public.prepreci_spremembe_resene_zadeve");
  var backfill = sql.slice(backfillZacetek, backfillKonec);
  assert.ok(backfillZacetek >= 0 && backfillKonec > backfillZacetek, "manjka omejen backfill delnih kompenzacij");
  assert.match(backfill, /set vrsta = 'compensation'/i);
  assert.match(backfill, /u\.action_id = p\.action_id[\s\S]*?u\.zadeva_id = p\.zadeva_id[\s\S]*?u\.obrtnik_id = p\.obrtnik_id/i);
  assert.match(backfill, /u\.action_type = 'partial_settlement'[\s\S]*?u\.settings->>'kind' = 'compensation'/i);
  assert.doesNotMatch(backfill, /status\s*=\s*'completed'/i);

  assert.match(sql, /create or replace function public\.prepreci_spremembe_resene_zadeve\(\)[\s\S]*?security invoker[\s\S]*?set search_path = ''/i);
  assert.match(sql, /old\.status = 'Rešeno'[\s\S]*?new\.\* is distinct from old\.\*/i);
  assert.match(sql, /errcode = 'P0001'[\s\S]*?message = 'CASE_RESOLVED'/i);
  assert.match(sql, /create trigger zadeve_resen_primer_immutable_trg[\s\S]*?before update on public\.zadeve/i);
});

/* Barve/RGB morajo ustrezati zahtevanim vrednostim iz naloge - preveri
   neposredno v skupni konfiguraciji, da izvedba.js in koncani-primeri.js
   ne moreta razpasti narazen. */
test("nastavitve-izidov.js vsebuje zahtevane barve in kontraste", function () {
  var src = fs.readFileSync(path.join(appRoot, "nastavitve-izidov.js"), "utf8");
  assert.match(src, /full:[\s\S]{0,300}barva: "#299b63"/);
  assert.match(src, /partial:[\s\S]{0,300}barva: "#3aa99c"/);
  assert.match(src, /compensation:[\s\S]{0,300}barva: "#448bd3"/);
  assert.match(src, /installment:[\s\S]{0,400}barva: "#397fd0"/);
  assert.match(src, /credit_note:[\s\S]{0,300}barva: "#e89524"/);
  assert.match(src, /cancelled_invoice:[\s\S]{0,300}barva: "#cf4c4c"/);
  var pricakovaniKontrasti = {
    full: "#217a4d",
    partial: "#237f75",
    compensation: "#236cae",
    installment: "#2566b0",
    credit_note: "#9a5700",
    cancelled_invoice: "#a53333",
    installment_completed: "#2566b0",
    partial_then_full: "#237f75",
    legacy: "#2d6262",
  };
  Object.entries(pricakovaniKontrasti).forEach(function ([id, barva]) {
    assert.equal(global.UJNastavitveIzidov.izid(id).barvaKontrast, barva, id);
  });
  var model = izpeljiPrikazniModel(zadeva({ placano_skupaj: 1000, preostali_dolg: 0 }), [{ znesek: 1000, vrsta: "full", datum_placila: "2026-08-21" }], [], 0);
  assert.equal(model.barvaKontrast, "#217a4d");
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
