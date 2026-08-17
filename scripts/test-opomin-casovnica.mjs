/**
 * Testi: časovnica načrta opominjanja (premiki datumov).
 * Zagon: node scripts/test-opomin-casovnica.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const N = require(path.join(root, "..", "app", "opomin-nacrt.js"));
const uiSrc = fs.readFileSync(
  path.join(root, "..", "app", "opomin-nacrt-ui.js"),
  "utf8"
);
const stylesSrc = fs.readFileSync(
  path.join(root, "..", "app", "styles.css"),
  "utf8"
);
const karticeSyncSrc = fs.readFileSync(
  path.join(root, "..", "app", "opomin-kartice-sync.js"),
  "utf8"
);
const karticeMigracijaSrc = fs.readFileSync(
  path.join(
    root,
    "..",
    "supabase",
    "migrations",
    "20260812215817_sinhronizacija_kartic_med_napravami.sql"
  ),
  "utf8"
);
const predajaMigracijaSrc = fs.readFileSync(
  path.join(
    root,
    "..",
    "supabase",
    "migrations",
    "20260814173000_sinhronizacija_predaje_odvetniku.sql"
  ),
  "utf8"
);
const osnutekMigracijaSrc = fs.readFileSync(
  path.join(
    root,
    "..",
    "supabase",
    "migrations",
    "20260814181000_sinhronizacija_celotnega_osnutka.sql"
  ),
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

function lokalniIso(y, m, d, h = 12, min = 0) {
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString();
}

function offsets(plan) {
  N.uskladiOffseteIzDatumov(plan);
  return plan.steps.map((s) => s.scheduledOffsetDays);
}

function planZOffseti(odmiki) {
  const plan = N.narediNovPlan(
    { znesek: 75.64, datumZapadlosti: "2026-07-01", imeDolznika: "Test" },
    { toneRecommendation: { selectedToneId: "friendly" } }
  );
  const base = new Date(2026, 7, 8, 12, 0, 0, 0); // 8. 8. 2026
  plan.steps.forEach((s, i) => {
    const d = new Date(base);
    const fallback =
      odmiki[odmiki.length - 1] +
      Math.max(0, i - odmiki.length + 1) * 8;
    d.setDate(d.getDate() + (odmiki[i] != null ? odmiki[i] : fallback));
    s.sendAt = d.toISOString();
    s.scheduledAt = s.sendAt;
    s.status = "draft";
  });
  plan.keepStageIntervals = true;
  N.uskladiOffseteIzDatumov(plan);
  return plan;
}

test("Napredovanje preskoci izklopljene kartice", () => {
  const plan = {
    steps: [
      { id: "prvi", index: 1, isExcluded: false },
      { id: "izklopljen-2", index: 2, isExcluded: true },
      { id: "izklopljen-3", index: 3, isExcluded: true },
      { id: "drugi-vidni", index: 6, isExcluded: false },
      { id: "tretji-vidni", index: 10, isExcluded: false },
    ],
  };

  assert.equal(N.najdiNaslednjiVkljuceniKorak(plan, 1)?.id, "drugi-vidni");
  assert.equal(N.najdiNaslednjiVkljuceniKorak(plan, 6)?.id, "tretji-vidni");
  assert.equal(N.najdiNaslednjiVkljuceniKorak(plan, 10), null);
  assert.equal(N.najdiNaslednjiVkljuceniKorak(plan, 99), null);
});

test("Potrditev uporabi naslednjo vidno kartico za napis, obvestilo in izbor", () => {
  const klici = uiSrc.match(
    /N\.najdiNaslednjiVkljuceniKorak\(\s*plan,\s*step\.index\s*\)/g
  );
  assert.equal(klici?.length, 3);
  assert.ok(uiSrc.includes('aria-label="Naslednja potrditev"'));
  assert.ok(uiSrc.includes("prikazniRedKoraka(naslednji)"));
  assert.ok(uiSrc.includes("opomin-nacrt-potrdi__obvestilo--barvno"));
  assert.ok(uiSrc.includes("opomin-nacrt-potrdi__readonly--barvno"));
  assert.ok(uiSrc.includes("dolociBarvniNivo("));
  assert.ok(!uiSrc.includes("Obvestilo vključeno"));
  assert.ok(uiSrc.includes("boste prejeli obvestilo za potrditev"));
  assert.ok(uiSrc.includes("Pred potrditvijo ga boste lahko še enkrat pregledali."));
  assert.ok(uiSrc.includes("preklopiAktivniKorak(naslednjiKorak.index)"));
  assert.ok(uiSrc.includes("plan.selectedStageId = naslednjiKorak.id"));
});

test("Začetni načrt vsebuje 9 SMS korakov in ročno predajo", () => {
  const plan = N.narediNovPlan(
    { znesek: 75.64, datumZapadlosti: "2026-07-01" },
    { toneRecommendation: { selectedToneId: "friendly" } }
  );
  assert.equal(plan.steps.length, 10);
  assert.equal(plan.steps.filter((s) => s.kind === "sms").length, 9);
  assert.equal(plan.steps[9].kind, "manual_lawyer");
  assert.ok(plan.steps.every((s) => s.sendAt && s.scheduledAt));
  assert.equal(plan.steps[0].scheduledOffsetDays, 0);
  assert.ok(plan.recommendedGapDays >= 8);
});

test("Premik z ohranitvijo razmikov: +3 dni na 2. koraku", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  assert.deepEqual(offsets(plan).slice(0, 4), [0, 11, 22, 33]);
  const nov = lokalniIso(2026, 8, 22, 12, 0); // 19.+3
  plan = N.posodobiCasKoraka(plan, 2, nov, { shiftFollowing: true });
  assert.deepEqual(offsets(plan).slice(0, 4), [0, 14, 28, 42]);
});

test("Premik samo enega koraka", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  const nov = lokalniIso(2026, 8, 22, 12, 0);
  plan = N.posodobiCasKoraka(plan, 2, nov, { shiftFollowing: false });
  assert.deepEqual(offsets(plan).slice(0, 4), [0, 14, 22, 33]);
});

test("Premik prvega koraka z ohranitvijo", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  const nov = lokalniIso(2026, 8, 9, 12, 0); // +1 dan
  plan = N.posodobiCasKoraka(plan, 1, nov, { shiftFollowing: true });
  assert.deepEqual(offsets(plan).slice(0, 4), [0, 11, 22, 33]);
  // Absolutni datumi: vsi +1 dan glede na prejšnje
  const d0 = new Date(plan.steps[0].sendAt).getDate();
  assert.equal(d0, 9);
  assert.equal(new Date(plan.steps[1].sendAt).getDate(), 20);
});

test("Sprememba ure prestavi tudi prihodnje (+3 ure)", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  const nov = lokalniIso(2026, 8, 19, 15, 0);
  plan = N.posodobiCasKoraka(plan, 2, nov, { shiftFollowing: true });
  assert.equal(new Date(plan.steps[1].sendAt).getHours(), 15);
  assert.equal(new Date(plan.steps[2].sendAt).getHours(), 15);
  assert.equal(new Date(plan.steps[3].sendAt).getHours(), 15);
});

test("Zadnji korak: validacija brez naslednjih", () => {
  const plan = planZOffseti([0, 11, 22, 33]);
  const novDatum = new Date(plan.steps[9].sendAt);
  novDatum.setDate(novDatum.getDate() + 1);
  const v = N.validirajCasKoraka(
    plan,
    10,
    novDatum.toISOString(),
    true
  );
  assert.equal(v.ok, true);
  assert.equal(v.preview.shiftedCount, 0);
});

test("Poslan korak ni premakljiv", () => {
  const plan = planZOffseti([0, 11, 22, 33]);
  plan.steps[0].status = "sent";
  assert.equal(N.jeKorakPremakljiv(plan.steps[0]), false);
  const before = plan.steps[0].sendAt;
  N.posodobiCasKoraka(plan, 1, lokalniIso(2026, 8, 10, 12, 0), {
    shiftFollowing: true,
  });
  assert.equal(plan.steps[0].sendAt, before);
});

test("UI: ni stalnega stikala Ohrani razmike", () => {
  assert.ok(!uiSrc.includes("Ohrani razmike med koraki"));
  assert.ok(uiSrc.includes("Prestavi tudi naslednje korake"));
  assert.ok(uiSrc.includes("odpriCasSheet"));
  assert.ok(uiSrc.includes("opomin-cas-sheet"));
});

test("Slovenske oznake dni", () => {
  assert.equal(N.oznakaCezDni(1), "Čez 1 dan");
  assert.equal(N.oznakaCezDni(2), "Čez 2 dni");
  assert.equal(N.oznakaCezDni(11), "Čez 11 dni");
  assert.equal(N.oznakaPoPrejsnjem(1), "1 dan po prejšnjem koraku");
});

test("Privzeto dovoljeno okno je 07:00–21:00", () => {
  const plan = planZOffseti([0, 11, 22, 33]);
  assert.deepEqual(plan.allowedSendWindow, { start: "07:00", end: "21:00" });
  assert.equal(N.validirajCasKoraka(plan, 2, lokalniIso(2026, 8, 19, 6, 59), false).ok, false);
  assert.equal(N.validirajCasKoraka(plan, 2, lokalniIso(2026, 8, 19, 7, 0), false).ok, true);
  assert.equal(N.validirajCasKoraka(plan, 2, lokalniIso(2026, 8, 19, 21, 0), false).ok, true);
  assert.equal(N.validirajCasKoraka(plan, 2, lokalniIso(2026, 8, 19, 21, 1), false).ok, false);
});

test("Sprememba dovoljenega okna se prenese v Random", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  plan.steps[1]._randomSchedule = {
    enabled: true,
    minSendTime: "07:00",
    maxSendTime: "21:00",
    _previewResolvedAt: lokalniIso(2026, 8, 19, 12, 5),
  };
  plan = N.nastaviDovoljenoOkno(plan, "08:00", "20:00");
  assert.deepEqual(plan.allowedSendWindow, { start: "08:00", end: "20:00" });
  assert.equal(plan.steps[1]._randomSchedule.minSendTime, "08:00");
  assert.equal(plan.steps[1]._randomSchedule.maxSendTime, "20:00");
  assert.equal(plan.steps[1]._randomSchedule._previewResolvedAt, undefined);
});

test("Dovoljen čas se lahko omeji samo za izbrani korak", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  plan.steps[1]._randomSchedule = {
    enabled: true,
    minSendTime: "07:00",
    maxSendTime: "21:00",
  };
  plan = N.nastaviDovoljenoOknoKoraka(plan, 2, "09:00", "18:00");
  assert.equal(plan.allowedSendWindowMode, "per_step");
  assert.deepEqual(plan.allowedSendWindow, { start: "07:00", end: "21:00" });
  assert.deepEqual(plan.steps[1].allowedSendWindow, {
    start: "09:00",
    end: "18:00",
  });
  assert.deepEqual(N.dovoljenoOknoZaKorak(plan, 1), {
    start: "07:00",
    end: "21:00",
  });
  assert.deepEqual(N.dovoljenoOknoZaKorak(plan, 2), {
    start: "09:00",
    end: "18:00",
  });
  assert.equal(plan.steps[1]._randomSchedule.minSendTime, "09:00");
  assert.equal(plan.steps[1]._randomSchedule.maxSendTime, "18:00");
  assert.equal(plan.steps[0].allowedSendWindow, undefined);
  assert.equal(plan.steps[2].allowedSendWindow, undefined);
  assert.equal(plan.steps[3].allowedSendWindow, undefined);
});

test("Tudi prva kartica lahko dobi svojo dovoljeno mejo", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  plan = N.nastaviDovoljenoOknoKoraka(plan, 1, "08:30", "19:15");
  assert.equal(plan.allowedSendWindowMode, "per_step");
  assert.deepEqual(N.dovoljenoOknoZaKorak(plan, 1), {
    start: "08:30",
    end: "19:15",
  });
  assert.deepEqual(N.dovoljenoOknoZaKorak(plan, 2), {
    start: "07:00",
    end: "21:00",
  });
});

test("Izbira za vse korake odstrani posamezne izjeme", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  plan = N.nastaviDovoljenoOknoKoraka(plan, 2, "09:00", "18:00");
  plan = N.nastaviDovoljenoOkno(plan, "08:00", "20:00");
  assert.equal(plan.allowedSendWindowMode, "all");
  assert.equal(plan.steps[1].allowedSendWindow, undefined);
  assert.deepEqual(N.dovoljenoOknoZaKorak(plan, 2), {
    start: "08:00",
    end: "20:00",
  });
});

test("Skupni način ne uporabi stare izjeme koraka", () => {
  const plan = planZOffseti([0, 11, 22, 33]);
  plan.allowedSendWindowMode = "all";
  plan.allowedSendWindow = { start: "08:00", end: "20:00" };
  plan.steps[1].allowedSendWindow = { start: "10:00", end: "16:00" };
  assert.deepEqual(N.dovoljenoOknoZaKorak(plan, 2), {
    start: "08:00",
    end: "20:00",
  });
});

test("Potrjen korak zunaj nove omejitve zahteva ponovni pregled", () => {
  let plan = planZOffseti([0, 11, 22, 33]);
  plan.steps[1].sendAt = lokalniIso(2026, 8, 19, 20, 30);
  plan.steps[1].scheduledAt = plan.steps[1].sendAt;
  plan.steps[1].status = "confirmed";
  plan.steps[1].confirmedAt = new Date().toISOString();
  plan = N.nastaviDovoljenoOkno(plan, "08:00", "20:00");
  assert.equal(plan.steps[1].status, "needs_review");
  assert.equal(plan.steps[1].confirmedAt, null);
});

test("UI vsebuje opozorilo kartice in ponastavitev ure", () => {
  assert.ok(uiSrc.includes("opomin-nacrt__stage--hard-opozorilo"));
  assert.ok(uiSrc.includes("Ponastavi uro"));
  assert.ok(uiSrc.includes("jeCasKorakaIzvenDovoljenega"));
});

test("Izbirniki zavrnejo nedovoljeno uro in pokažejo opozorilo", () => {
  assert.ok(uiSrc.includes("jeUraZnotrajDovoljenegaOkna"));
  assert.ok(uiSrc.includes("zavrniNedovoljenoPoljeUre"));
  assert.ok(uiSrc.includes("ni mogoče izbrati. Dovoljeno je od"));
  assert.ok(uiSrc.includes('id="opomin-hitra-ura-input" min="'));
  assert.ok(uiSrc.includes('id="opomin-cas-sheet-ura-napaka"'));
  assert.ok(uiSrc.includes('id="opomin-hitra-ura-napaka"'));
  assert.ok(uiSrc.includes("prikaziHitroNapakoUre"));
  assert.ok(uiSrc.includes('data-okno-obseg="vsi"'));
  assert.ok(uiSrc.includes('data-okno-obseg="korak"'));
  assert.ok(uiSrc.includes("Velja samo za ta korak"));
  assert.ok(uiSrc.includes('plan.allowedSendWindowMode === "per_step"'));
  assert.ok(uiSrc.includes("planZNovoMejoZaPredogled"));
  assert.ok(uiSrc.includes("uporabiDovoljenoOknoKotMejo"));
});

test("Mobilno okno za čas je stabilno brez drsenja", () => {
  assert.ok(
    stylesSrc.includes("#opomin-cas-sheet .opomin-cas-sheet__telo") &&
      stylesSrc.includes("overflow-y: hidden") &&
      stylesSrc.includes("justify-content: space-between")
  );
  assert.ok(stylesSrc.includes("grid-template-rows: repeat(2, auto)"));
  assert.ok(stylesSrc.includes("height: calc(100svh - 10px)"));
  assert.ok(stylesSrc.includes("min-height: 52px"));
  assert.ok(stylesSrc.includes("zoom: 0.9"));
  assert.ok(
    stylesSrc.includes(".opomin-cas-sheet__dovoljeno-cas input") &&
      stylesSrc.includes("font-size: 16px")
  );
});

test("Križci hitrih predlogov so poravnani na istem mestu", () => {
  assert.ok(uiSrc.includes("opomin-cas-sheet__bliznjica-besedilo"));
  assert.ok(stylesSrc.includes("grid-template-columns: 12px minmax(0, 1fr) 16px"));
  assert.ok(stylesSrc.includes("justify-self: end"));
});

test("Deset kartic uporablja gladko stopnjevane gradiente", () => {
  for (let nivo = 1; nivo <= 9; nivo += 1) {
    assert.ok(stylesSrc.includes(`.opomin-nacrt__stage--eskalacija-${nivo}`));
  }
  assert.ok(stylesSrc.includes(".opomin-nacrt__stage--predaja"));
  assert.ok(stylesSrc.includes("--stage-gradient-from"));
  assert.ok(stylesSrc.includes("--stage-gradient-to"));
  assert.match(stylesSrc, /linear-gradient\(\r?\n\s+145deg/);
  assert.ok(stylesSrc.includes("var(--stage-accent-strong)"));
});

test("Izbrana kartica uporablja svojo močno barvo namesto skupne zelene", () => {
  assert.match(
    stylesSrc,
    /\.opomin-nacrt__stage--barvna\.opomin-nacrt__stage--izbran[\s\S]*?background:\s*linear-gradient\([\s\S]*?var\(--stage-accent\)[\s\S]*?var\(--stage-accent-strong\)/
  );
  assert.ok(stylesSrc.includes("border-width: 2px"));
  assert.ok(stylesSrc.includes("border-color: var(--stage-accent-strong)"));
  assert.ok(stylesSrc.includes("inset 0 0 0 2px #ffffff"));
  assert.ok(stylesSrc.includes("0 4px 10px rgba(32, 54, 54, 0.2)"));
  assert.ok(!stylesSrc.includes("0 0 0 4px var(--stage-accent-strong)"));
  assert.match(
    stylesSrc,
    /\.opomin-nacrt__stage--barvna\.opomin-nacrt__stage--izbran[\s\S]*?\.opomin-nacrt__stage-cas-datum[\s\S]*?color:\s*#ffffff\s*!important;/
  );
});

test("Spodnje stevilcne oznake niso polno zeleno zapolnjene", () => {
  assert.match(
    stylesSrc,
    /\.lp-korak__st\s*\{[\s\S]*?border:\s*1\.5px solid #087f83;[\s\S]*?background:\s*#ffffff;[\s\S]*?color:\s*#087f83;/
  );
  assert.match(
    stylesSrc,
    /\.lp-korak--aktiven \.lp-korak__st\s*\{[\s\S]*?background:\s*#e8f4f3;/
  );
});

test("Pill izbranega odvetnika je enako sirok na telefonu in racunalniku", () => {
  assert.match(
    stylesSrc,
    /\.opomin-predaja-sestavljalnik__odvetnik-pill\s*\{[\s\S]*?left:\s*6px;[\s\S]*?right:\s*6px;[\s\S]*?width:\s*auto;[\s\S]*?transform:\s*none;/
  );
});

test("Med napravami se sinhronizirajo kartice in celotna predaja odvetniku", () => {
  assert.ok(karticeSyncSrc.includes('var TABELA = "opomin_kartice_nastavitve"'));
  assert.ok(karticeSyncSrc.includes("vkljuceni_indeksi"));
  assert.ok(karticeSyncSrc.includes("predaja_odvetniku"));
  assert.ok(karticeSyncSrc.includes("predaja_updated_at"));
  assert.ok(karticeSyncSrc.includes("lawyerHandoff"));
  assert.ok(karticeSyncSrc.includes('rpc("sinhroniziraj_opomin_kartice"'));
  assert.ok(karticeSyncSrc.includes("narociShranjevanje"));
  assert.ok(karticeSyncSrc.includes("naloziPredZagonom"));
  assert.ok(karticeSyncSrc.includes("var zapisovalnaVrsta = Promise.resolve()"));
  assert.ok(karticeSyncSrc.includes("remoteCas >= localCas"));
  assert.ok(karticeSyncSrc.includes("lokalniCas > oddaljeniCas"));
  assert.ok(!karticeSyncSrc.includes("imeDolznika"));
  assert.ok(!karticeSyncSrc.includes("znesek"));
  assert.ok(!karticeSyncSrc.includes("sporociloDolzniku"));
  assert.ok(uiSrc.includes("UJOpominKarticeSync.narociShranjevanje(plan)"));
});

test("Nastavitve kartic so v bazi zascitene po uporabniku", () => {
  assert.ok(karticeMigracijaSrc.includes("enable row level security"));
  assert.ok(karticeMigracijaSrc.includes("(select auth.uid()) = user_id"));
  assert.ok(karticeMigracijaSrc.includes("to authenticated"));
  assert.ok(karticeMigracijaSrc.includes("grant select, insert, update"));
  assert.ok(!karticeMigracijaSrc.includes("service_role"));
  assert.ok(predajaMigracijaSrc.includes("security invoker"));
  assert.ok(predajaMigracijaSrc.includes("set search_path = ''"));
  assert.ok(predajaMigracijaSrc.includes("(select auth.uid())"));
  assert.ok(predajaMigracijaSrc.includes("lawyerSnapshot,name"));
  assert.ok(predajaMigracijaSrc.includes("nullif(btrim"));
  assert.ok(predajaMigracijaSrc.includes("to authenticated"));
  assert.ok(predajaMigracijaSrc.includes("revoke all"));
  assert.ok(osnutekMigracijaSrc.includes("enable row level security"));
  assert.ok(osnutekMigracijaSrc.includes("(select auth.uid()) = user_id"));
  assert.ok(osnutekMigracijaSrc.includes("security invoker"));
  assert.ok(osnutekMigracijaSrc.includes("set search_path = ''"));
  assert.ok(osnutekMigracijaSrc.includes("supabase_realtime"));
  assert.ok(karticeSyncSrc.includes('var TABELA_OSNUTEK = "opomin_osnutek_sync"'));
  assert.ok(karticeSyncSrc.includes('rpc("sinhroniziraj_opomin_osnutek"'));
  assert.ok(karticeSyncSrc.includes("jeAppleMobilnaNaprava"));
});

console.log("\nUspešnih: " + ok);
