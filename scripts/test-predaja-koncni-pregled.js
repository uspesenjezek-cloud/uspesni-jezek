"use strict";

/**
 * Integracijski test: prenos in obstojnost step.lawyerHandoff.preparedSnapshot
 * skozi dejanski tok Faza A→B→C (izbira odvetnika → priprava predaje →
 * shranjevanje → ponovno branje → odprtje končnega pregleda 10. koraka).
 * Uporablja iste N.* funkcije kot UI (opomin-nacrt-ui.js), brez brskalnika -
 * polni sessionStorage v pomnilniku, da je pot skozi shraniOsnutek/naloziOsnutek/
 * pridobiAliUstvari identična pravemu nalaganju strani.
 */

var assert = require("assert/strict");

/* Minimalen sessionStorage polnilnik za Node - opomin-nacrt.js ga uporablja
   neposredno (shraniOsnutek/naloziOsnutek), enako kot v brskalniku. */
var seja = Object.create(null);
global.sessionStorage = {
  getItem: function (k) {
    return Object.prototype.hasOwnProperty.call(seja, k) ? seja[k] : null;
  },
  setItem: function (k, v) {
    seja[k] = String(v);
  },
  removeItem: function (k) {
    delete seja[k];
  },
};

var N = require("../app/opomin-nacrt.js");

var passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (err) {
    console.error("  ✗ " + name);
    throw err;
  }
}

function najdiKorak10(plan) {
  return plan.steps.find(function (s) {
    return s.kind === "manual_lawyer";
  });
}

function k1() {
  return {
    imeDolznika: "Testni Dolznik d.o.o.",
    vrstaDolznika: "podjetje",
    telefonDolznika: "+38640123456",
    emailDolznika: "janez@example.com",
    znesek: 850,
    stevilkaRacuna: "R-2026-0042",
    datumZapadlosti: "2026-06-15",
  };
}

function k2() {
  return { toneRecommendation: { selectedToneId: "friendly" } };
}

console.log("\nKončni pregled 10. koraka – prenos preparedSnapshot");

var podatki1 = k1();
var podatki2 = k2();
var porocilo = {};

test("1. začetno stanje: brez pripravljene predaje", function () {
  var plan = N.pridobiAliUstvari(podatki1, podatki2);
  var korak10 = najdiKorak10(plan);
  assert.ok(korak10, "10. korak (manual_lawyer) mora obstajati");
  assert.equal(korak10.lawyerHandoff.status, "draft");
  assert.equal(korak10.lawyerHandoff.preparedSnapshot, null);
  porocilo.predPripravo = {
    status: korak10.lawyerHandoff.status,
    preparedSnapshot: korak10.lawyerHandoff.preparedSnapshot,
  };
});

var plan = N.pridobiAliUstvari(podatki1, podatki2);
var korak10 = najdiKorak10(plan);

test("2. izbran odvetnik in izbran paket", function () {
  plan = N.posodobiOdvetnika(plan, korak10.index, {
    name: "Ana Kovač",
    officeName: "Odvetniška pisarna Novak",
    email: "pisarna@novak.si",
    phone: "+38641000000",
  });
  plan = N.posodobiIzbraniPaket(plan, korak10.index, {
    packageId: "lawyer_demand_letter",
    priceCents: 2990,
    priceLabel: "29,90 € enkratno",
    currency: "EUR",
    title: "Odvetnik pošlje opomin",
    includedItems: [
      "Pregled podatkov in dokumentov",
      "Priprava uradnega odvetniškega opomina",
    ],
  });
  plan = N.dodajDokumentOdvetniku(plan, korak10.index, {
    type: "invoice",
    name: "racun.pdf",
    status: "ready",
  });
  korak10 = najdiKorak10(plan);
  assert.equal(korak10.lawyerHandoff.lawyerSnapshot.name, "Ana Kovač");
  assert.equal(korak10.lawyerHandoff.selectedPackage.packageId, "lawyer_demand_letter");
});

test("3. pogoji za pripravo so izpolnjeni (isti check kot gumb 'Pripravi predajo')", function () {
  var preverjeno = N.preveriPogojeZaPripravoPredaje(plan, korak10.index, podatki1, []);
  assert.equal(preverjeno.ok, true, "manjkajo: " + preverjeno.manjkajoce.join(", "));
});

test("4. klik 'Pripravi predajo' ustvari preparedSnapshot v istem planu, ki ga uporablja UI", function () {
  plan = N.pripraviPredajoOdvetniku(plan, korak10.index, podatki1, []);
  korak10 = najdiKorak10(plan);
  assert.equal(korak10.lawyerHandoff.status, "prepared");
  assert.ok(korak10.lawyerHandoff.preparedSnapshot, "preparedSnapshot mora obstajati");
  assert.ok(korak10.lawyerHandoff.preparedAt, "preparedAt mora biti nastavljen");
  assert.equal(korak10.lawyerHandoff.preparedSnapshot.dolznik.ime, "Testni Dolznik d.o.o.");
  assert.equal(korak10.lawyerHandoff.preparedSnapshot.odvetnik.ime, "Ana Kovač");
  assert.equal(korak10.lawyerHandoff.preparedSnapshot.izbraniPaket.packageId, "lawyer_demand_letter");
  assert.equal(korak10.lawyerHandoff.preparedSnapshot.responseStatus, "unknown");
  assert.ok(Array.isArray(korak10.lawyerHandoff.preparedSnapshot.zgodovinaOpominov));
  porocilo.poPripravi = {
    status: korak10.lawyerHandoff.status,
    preparedSnapshot: korak10.lawyerHandoff.preparedSnapshot,
  };
});

test("5. shranjevanje: N.shraniOsnutek zapiše ta isti plan v sejo", function () {
  N.shraniOsnutek(plan);
  var surovo = global.sessionStorage.getItem("neplacilo-korak3-nacrt");
  assert.ok(surovo, "shraniOsnutek mora zapisati plan pod ključ neplacilo-korak3-nacrt");
  var shranjenPlan = JSON.parse(surovo);
  var shranjenKorak10 = najdiKorak10(shranjenPlan);
  assert.equal(shranjenKorak10.lawyerHandoff.status, "prepared");
  assert.ok(shranjenKorak10.lawyerHandoff.preparedSnapshot, "surov JSON v sessionStorage mora vsebovati snapshot");
});

test("6. ponovno branje: N.pridobiAliUstvari (enako kot pravo nalaganje strani) vrne isti snapshot", function () {
  var ponovnoPrebran = N.pridobiAliUstvari(podatki1, podatki2);
  var korak10Ponovno = najdiKorak10(ponovnoPrebran);
  assert.equal(korak10Ponovno.lawyerHandoff.status, "prepared");
  assert.ok(korak10Ponovno.lawyerHandoff.preparedSnapshot, "preparedSnapshot mora preživeti shrani→naloži cikel");
  assert.equal(korak10Ponovno.lawyerHandoff.preparedSnapshot.dolznik.ime, "Testni Dolznik d.o.o.");
  assert.equal(korak10Ponovno.lawyerHandoff.preparedSnapshot.izbraniPaket.packageId, "lawyer_demand_letter");
  plan = ponovnoPrebran;
  korak10 = korak10Ponovno;
  porocilo.poPonovnemBranju = {
    status: korak10.lawyerHandoff.status,
    preparedSnapshot: korak10.lawyerHandoff.preparedSnapshot,
  };
});

test("7. odprtje končnega pregleda: pogoj iz izrisiPotrditevPredajeOdvetniku ni fallback", function () {
  var lh = korak10.lawyerHandoff;
  var snap = lh.preparedSnapshot;
  /* Točno ista veja kot na začetku izrisiPotrditevPredajeOdvetniku(step)
     v opomin-nacrt-ui.js: if (!snap || lh.status === "draft") -> fallback. */
  var jeFallback = !snap || lh.status === "draft";
  assert.equal(jeFallback, false, "končni pregled ne sme pasti nazaj na 'Predaja še ni pripravljena'");
});

test("8. celotna vsebina (ne fallback) je na voljo za izris", function () {
  assert.ok(korak10.lawyerHandoff.preparedSnapshot.zgodovinaOpominov);
  assert.ok(korak10.lawyerHandoff.preparedSnapshot.dokumenti);
  assert.ok(korak10.lawyerHandoff.preparedSnapshot.sporociloOdvetniku !== undefined);
});

test("9. druga osvežitev strani (ponovni shrani→naloži cikel)", function () {
  N.shraniOsnutek(plan);
  var drugoBranje = N.pridobiAliUstvari(podatki1, podatki2);
  var korak10Drugo = najdiKorak10(drugoBranje);
  assert.equal(korak10Drugo.lawyerHandoff.status, "prepared");
  assert.ok(korak10Drugo.lawyerHandoff.preparedSnapshot);
  plan = drugoBranje;
  korak10 = korak10Drugo;
});

test("10. tudi po drugi osvežitvi celotna vsebina ostane prikazana (ne fallback)", function () {
  var lh = korak10.lawyerHandoff;
  var jeFallback = !lh.preparedSnapshot || lh.status === "draft";
  assert.equal(jeFallback, false);
});

var porociloNov = porocilo;

/* ==========================================================================
   LEGACY/OBSTOJEČI OSNUTEK - simulira korak 10, ki je bil izdelan pred
   uvedbo preparedSnapshot (ali s starejšo kodo): odvetnik, paket, dokumenti,
   sporočilo in namen že obstajajo, preparedSnapshot pa je null. Spodnja
   obnovaCeMozno() funkcija je namerno IDENTIČNA (isti klici, isti pogoj) kot
   varnostna obnova v izrisiPotrditevPredajeOdvetniku (opomin-nacrt-ui.js) -
   ne podvaja pravil, samo preverja, da je pot ponovljiva zunaj brskalnika.
   ========================================================================== */
console.log("\nLegacy osnutek (korak izdelan pred preparedSnapshot)");

function obnovaCeMozno(plan, index, k1, priloge) {
  var korak = N.najdiKorak(plan, index);
  var lh = korak.lawyerHandoff || {};
  if (lh.preparedSnapshot) return { plan: plan, manjkajoce: [] };
  if (lh.status === "needs_review" || lh.status === "handed_over") {
    return { plan: plan, manjkajoce: [] };
  }
  var preverjeno = N.preveriPogojeZaPripravoPredaje(plan, index, k1, priloge);
  if (!preverjeno.ok) return { plan: plan, manjkajoce: preverjeno.manjkajoce };
  plan = N.pripraviPredajoOdvetniku(plan, index, k1, priloge);
  N.shraniOsnutek(plan);
  return { plan: plan, manjkajoce: [] };
}

function legacyPlanZOdvetnikomInPaketom() {
  var p = N.narediNovPlan(k1(), k2());
  var k10 = najdiKorak10(p);
  k10.lawyerHandoff.status = "prepared"; // "star ekvivalent" - status brez snapshota
  k10.lawyerHandoff.preparedSnapshot = null;
  k10.lawyerHandoff.preparedAt = null;
  k10.lawyerHandoff.lawyerSnapshot = {
    name: "Ana Kovač",
    officeName: "Odvetniška pisarna Novak",
    email: "pisarna@novak.si",
    phone: "+38641000000",
  };
  k10.lawyerHandoff.selectedPackage = {
    packageId: "lawyer_demand_letter",
    priceCents: 2990,
    priceLabel: "29,90 € enkratno",
    currency: "EUR",
    title: "Odvetnik pošlje opomin",
    includedItems: ["Pregled podatkov in dokumentov"],
  };
  k10.lawyerHandoff.documents = [
    { id: "d1", type: "invoice", source: "uploaded", name: "Račun", status: "ready" },
  ];
  k10.lawyerHandoff.requestedAction = "debt_collection";
  k10.lawyerHandoff.message = "Pozdravljeni, prosim za pomoč pri izterjavi.";
  return p;
}

var porociloLegacy = {};
var legacyPlan = legacyPlanZOdvetnikomInPaketom();
var legacyKorak = najdiKorak10(legacyPlan);

test("11. legacy fixture: pred migracijo status='prepared', preparedSnapshot=null, ostali podatki že obstajajo", function () {
  assert.equal(legacyKorak.lawyerHandoff.status, "prepared");
  assert.equal(legacyKorak.lawyerHandoff.preparedSnapshot, null);
  assert.equal(legacyKorak.lawyerHandoff.lawyerSnapshot.name, "Ana Kovač");
  assert.equal(legacyKorak.lawyerHandoff.selectedPackage.packageId, "lawyer_demand_letter");
  porociloLegacy.predMigracijo = {
    status: legacyKorak.lawyerHandoff.status,
    preparedSnapshot: legacyKorak.lawyerHandoff.preparedSnapshot,
  };
});

test("12. legacy fixture: varna obnova (ista kanonična funkcija kot gumb) ustvari snapshot, brez čiščenja seje", function () {
  var rezultat = obnovaCeMozno(legacyPlan, legacyKorak.index, podatki1, []);
  legacyPlan = rezultat.plan;
  legacyKorak = najdiKorak10(legacyPlan);
  assert.equal(rezultat.manjkajoce.length, 0);
  assert.equal(legacyKorak.lawyerHandoff.status, "prepared");
  assert.ok(legacyKorak.lawyerHandoff.preparedSnapshot, "obnova mora ustvariti snapshot");
  assert.equal(legacyKorak.lawyerHandoff.preparedSnapshot.odvetnik.ime, "Ana Kovač");
  assert.equal(legacyKorak.lawyerHandoff.preparedSnapshot.izbraniPaket.packageId, "lawyer_demand_letter");
  porociloLegacy.poMigraciji = {
    status: legacyKorak.lawyerHandoff.status,
    preparedSnapshot: legacyKorak.lawyerHandoff.preparedSnapshot,
  };
});

test("13. legacy fixture: obnova je izvedena največ enkrat (ponovni klic ne ustvari druge različice)", function () {
  var snapshotPredPonovnimKlicem = legacyKorak.lawyerHandoff.preparedSnapshot;
  var rezultat = obnovaCeMozno(legacyPlan, legacyKorak.index, podatki1, []);
  legacyPlan = rezultat.plan;
  legacyKorak = najdiKorak10(legacyPlan);
  assert.equal(
    legacyKorak.lawyerHandoff.preparedSnapshot.pripravljenoOb,
    snapshotPredPonovnimKlicem.pripravljenoOb,
    "ponovni klic ne sme ustvariti nove različice snapshota"
  );
  assert.equal(
    Array.isArray(legacyKorak.lawyerHandoff.snapshotHistory) ? legacyKorak.lawyerHandoff.snapshotHistory.length : 0,
    0,
    "brez podvajanja zgodovine"
  );
});

test("14. legacy fixture: po osvežitvi strani je celoten pregled dostopen (ne fallback)", function () {
  var ponovnoPrebran = N.pridobiAliUstvari(podatki1, podatki2);
  var korakPonovno = najdiKorak10(ponovnoPrebran);
  var lh = korakPonovno.lawyerHandoff;
  var jeFallback = !lh.preparedSnapshot || lh.status === "draft";
  assert.equal(jeFallback, false);
  porociloLegacy.poReloadu = {
    status: lh.status,
    preparedSnapshot: lh.preparedSnapshot,
  };
});

/* Drug fixture: odvetnik RESNIČNO manjka - obnova se NE sme izvesti, fallback
   mora konkretno navesti "Izbran odvetnik". */
var planBrezOdvetnika = N.narediNovPlan(k1(), k2());
var korakBrezOdvetnika = najdiKorak10(planBrezOdvetnika);
korakBrezOdvetnika.lawyerHandoff.status = "prepared";
korakBrezOdvetnika.lawyerHandoff.preparedSnapshot = null;
// lawyerSnapshot ostane prazen (privzeto iz praznaPredajaOdvetniku) - odvetnik ni izbran.

test("15. fixture brez odvetnika: obnova NE ustvari snapshota in fallback konkretno navede manjkajoč pogoj", function () {
  var rezultat = obnovaCeMozno(planBrezOdvetnika, korakBrezOdvetnika.index, podatki1, []);
  var korakPo = najdiKorak10(rezultat.plan);
  assert.equal(korakPo.lawyerHandoff.preparedSnapshot, null, "brez odvetnika se snapshot ne sme samodejno ustvariti");
  assert.ok(rezultat.manjkajoce.indexOf("Izbran odvetnik") >= 0, "manjkajoce mora vsebovati 'Izbran odvetnik', dobil: " + rezultat.manjkajoce.join(", "));
});

function izpisiSnapshotPovzetek(oznaka, vrednost) {
  if (!vrednost) {
    console.log("    " + oznaka + " = null");
    return;
  }
  console.log(
    "    " +
      oznaka +
      " = { dolznik.ime: " +
      JSON.stringify(vrednost.dolznik && vrednost.dolznik.ime) +
      ", odvetnik.ime: " +
      JSON.stringify(vrednost.odvetnik && vrednost.odvetnik.ime) +
      ", izbraniPaket: " +
      JSON.stringify(vrednost.izbraniPaket && vrednost.izbraniPaket.packageId) +
      ", zgodovinaOpominov: " +
      (vrednost.zgodovinaOpominov ? vrednost.zgodovinaOpominov.length + " zapisov" : "0") +
      ", responseStatus: " +
      JSON.stringify(vrednost.responseStatus) +
      " }"
  );
}

console.log("\n========== 1. NOV OSNUTEK ==========");
console.log("  pred pripravo:");
console.log("    step.lawyerHandoff.status = " + porociloNov.predPripravo.status);
izpisiSnapshotPovzetek("step.lawyerHandoff.preparedSnapshot", porociloNov.predPripravo.preparedSnapshot);
console.log("  po pripravi:");
console.log("    step.lawyerHandoff.status = " + porociloNov.poPripravi.status);
izpisiSnapshotPovzetek("step.lawyerHandoff.preparedSnapshot", porociloNov.poPripravi.preparedSnapshot);
console.log("  po reloadu:");
console.log("    step.lawyerHandoff.status = " + porociloNov.poPonovnemBranju.status);
izpisiSnapshotPovzetek("step.lawyerHandoff.preparedSnapshot", porociloNov.poPonovnemBranju.preparedSnapshot);
console.log("  rezultat pregleda: CELOTEN PREGLED (ni fallback)");

console.log("\n========== 2. LEGACY/OBSTOJEČI OSNUTEK ==========");
console.log("  (status='prepared' + preparedSnapshot=null + obstoječi odvetnik/paket/dokumenti/sporočilo - PRED popravkom bi to padlo na fallback)");
console.log("  pred migracijo:");
console.log("    step.lawyerHandoff.status = " + porociloLegacy.predMigracijo.status);
izpisiSnapshotPovzetek("step.lawyerHandoff.preparedSnapshot", porociloLegacy.predMigracijo.preparedSnapshot);
console.log("    pogoji za pripravo izpolnjeni: da (obstoječi odvetnik, paket, sporočilo, namen, znesek, št. računa)");
console.log("  po migraciji (varna obnova prek N.pripraviPredajoOdvetniku):");
console.log("    step.lawyerHandoff.status = " + porociloLegacy.poMigraciji.status);
izpisiSnapshotPovzetek("step.lawyerHandoff.preparedSnapshot", porociloLegacy.poMigraciji.preparedSnapshot);
console.log("  po reloadu:");
console.log("    step.lawyerHandoff.status = " + porociloLegacy.poReloadu.status);
izpisiSnapshotPovzetek("step.lawyerHandoff.preparedSnapshot", porociloLegacy.poReloadu.preparedSnapshot);
console.log("  rezultat pregleda: CELOTEN PREGLED (ni fallback) - migracija se je shranila in preživela reload");

console.log("\n  Uspešnih: " + passed + "/15");
console.log("Predaja: prenos, obstojnost IN varna migracija legacy osnutkov — vsi testi uspešni\n");
