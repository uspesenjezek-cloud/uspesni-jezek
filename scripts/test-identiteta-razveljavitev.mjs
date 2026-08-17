/* Preverja razveljavitev potrditev ob spremembi podatkov o dolžniku
   (plan.identityHash). Bug, ki ga to pokriva: vhodniHash pozna samo znesek, ton
   in dneve zamude, zato je uskladiZVhodi ob spremembi IMENA dolžnika izstopil v
   prazno – kartica predaje je še naprej kazala staro ime iz preparedSnapshot,
   brez opozorila "Podatki so se spremenili po pripravi".

   Poganjaj: node scripts/test-identiteta-razveljavitev.mjs */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const N = require("../app/opomin-nacrt.js");

let uspesnih = 0;
const napake = [];

function preveri(opis, pogoj) {
  if (pogoj) {
    uspesnih++;
    console.log("  ✓ " + opis);
  } else {
    napake.push(opis);
    console.log("  ✗ " + opis);
  }
}

const KORAK1 = {
  imeDolznika: "dwdwefe",
  vrstaDolznika: "podjetje",
  davcnaStevilka: "SI12345678",
  kontaktnaOseba: "Janez",
  telefonDolznika: "+38640111222",
  emailDolznika: "test@primer.si",
  /* Pika, ne vejica: eurosToCents vejice kot decimalnega ločila ne prepozna
     ("11,00" vrne 0). Obrazec 1. koraka uporablja number input, ki da piko. */
  znesek: "11.00",
  stevilkaRacuna: "2026-001",
  datumZapadlosti: "2026-08-01",
};
const KORAK2 = { sporociloDolzniku: "Prosim za plačilo.", tonId: "prijazen" };

function novPlan(k1 = KORAK1) {
  return N.narediNovPlan(k1, KORAK2);
}

/* Potrdi prvi SMS korak, da imamo kaj razveljaviti. */
function potrdiPrviSmsKorak(plan) {
  const korak = (plan.steps || []).find((s) => s.kind !== "manual_lawyer");
  korak.status = "confirmed";
  korak.confirmedAt = new Date().toISOString();
  return korak;
}

console.log("\nRazveljavitev ob spremembi podatkov o dolžniku\n");

/* --- 1) Sprememba imena razveljavi potrjen korak --------------------------- */
{
  let plan = novPlan();
  const korak = potrdiPrviSmsKorak(plan);
  const indeks = korak.index;

  plan = N.uskladiZVhodi(plan, { ...KORAK1, imeDolznika: "xkkxxk" }, KORAK2);

  const po = (plan.steps || []).find((s) => s.index === indeks);
  preveri(
    "sprememba IMENA dolžnika postavi potrjen korak na needs_review",
    po.status === "needs_review"
  );
  preveri("confirmedAt se ob tem počisti", po.confirmedAt === null);
}

/* --- 2) Sprememba imena NE premakne datumov -------------------------------- */
{
  let plan = novPlan();
  const prviPred = plan.steps[0];
  const sendAtPred = prviPred.sendAt;

  /* Ročni urnik, ki ga popravek ne sme povoziti. */
  plan.steps[1].manualScheduleOverride = true;
  const drugiSendAtPred = plan.steps[1].sendAt;

  plan = N.uskladiZVhodi(plan, { ...KORAK1, imeDolznika: "xkkxxk" }, KORAK2);

  preveri(
    "sprememba imena ne premakne sendAt prvega koraka",
    plan.steps[0].sendAt === sendAtPred
  );
  preveri(
    "sprememba imena ne povozi ročnega urnika (manualScheduleOverride ostane)",
    plan.steps[1].manualScheduleOverride === true &&
      plan.steps[1].sendAt === drugiSendAtPred
  );
}

/* --- 3) Enaki podatki ne razveljavijo ničesar ------------------------------ */
{
  let plan = novPlan();
  const korak = potrdiPrviSmsKorak(plan);
  const indeks = korak.index;

  plan = N.uskladiZVhodi(plan, { ...KORAK1 }, KORAK2);

  const po = (plan.steps || []).find((s) => s.index === indeks);
  preveri(
    "nespremenjeni podatki potrjen korak PUSTIJO potrjen",
    po.status === "confirmed"
  );
}

/* --- 4) Tudi polja, ki niso v sporočilu, razveljavijo ---------------------- */
for (const [polje, novaVrednost] of [
  ["datumZapadlosti", "2026-09-15"],
  ["davcnaStevilka", "SI99999999"],
  ["kontaktnaOseba", "Metka"],
  ["stevilkaRacuna", "2026-999"],
]) {
  let plan = novPlan();
  const korak = potrdiPrviSmsKorak(plan);
  const indeks = korak.index;

  plan = N.uskladiZVhodi(plan, { ...KORAK1, [polje]: novaVrednost }, KORAK2);

  const po = (plan.steps || []).find((s) => s.index === indeks);
  preveri(
    "sprememba polja '" + polje + "' razveljavi potrditev",
    po.status === "needs_review"
  );
}

/* --- 5) Star načrt brez identityHash: izhodišče iz posnetka ---------------- */
{
  let plan = novPlan();
  const predaja = (plan.steps || []).find((s) => s.kind === "manual_lawyer");
  preveri("načrt vsebuje korak manual_lawyer", Boolean(predaja));

  /* Simuliraj pripravljeno predajo s posnetkom STARIH podatkov ... */
  predaja.lawyerHandoff = predaja.lawyerHandoff || {};
  predaja.lawyerHandoff.status = "prepared";
  predaja.lawyerHandoff.preparedSnapshot = {
    dolznik: {
      ime: "dwdwefe",
      vrsta: "podjetje",
      davcnaStevilka: "SI12345678",
      kontaktnaOseba: "Janez",
      telefon: "+38640111222",
      email: "test@primer.si",
      znesekCentov: 1100,
      stevilkaRacuna: "2026-001",
      datumZapadlosti: "2026-08-01",
    },
  };
  /* ... in star načrt, ki polja identityHash še ne pozna. */
  delete plan.identityHash;

  plan = N.uskladiZVhodi(plan, { ...KORAK1, imeDolznika: "xkkxxk" }, KORAK2);

  const po = (plan.steps || []).find((s) => s.kind === "manual_lawyer");
  preveri(
    "star načrt brez identityHash: predaja gre na needs_review (izhodišče iz posnetka)",
    po.lawyerHandoff.status === "needs_review"
  );
  preveri(
    "preparedSnapshot ostane kot revizijska sled",
    Boolean(po.lawyerHandoff.preparedSnapshot)
  );
}

/* --- 6) Star načrt z UJEMAJOČIM posnetkom se ne razveljavi ----------------- */
{
  let plan = novPlan();
  const predaja = (plan.steps || []).find((s) => s.kind === "manual_lawyer");
  predaja.lawyerHandoff = predaja.lawyerHandoff || {};
  predaja.lawyerHandoff.status = "prepared";
  predaja.lawyerHandoff.preparedSnapshot = {
    dolznik: {
      ime: "dwdwefe",
      vrsta: "podjetje",
      davcnaStevilka: "SI12345678",
      kontaktnaOseba: "Janez",
      telefon: "+38640111222",
      email: "test@primer.si",
      znesekCentov: 1100,
      stevilkaRacuna: "2026-001",
      datumZapadlosti: "2026-08-01",
    },
  };
  delete plan.identityHash;

  plan = N.uskladiZVhodi(plan, { ...KORAK1 }, KORAK2);

  const po = (plan.steps || []).find((s) => s.kind === "manual_lawyer");
  preveri(
    "star načrt z ujemajočim posnetkom ostane 'prepared'",
    po.lawyerHandoff.status === "prepared"
  );
}

console.log("\nUspešnih: " + uspesnih + "  Neuspešnih: " + napake.length + "\n");
if (napake.length) {
  for (const n of napake) console.log("  NEUSPEH: " + n);
  process.exit(1);
}
