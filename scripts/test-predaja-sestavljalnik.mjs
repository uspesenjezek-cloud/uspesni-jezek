/**
 * Testi: sestavljalnik "Predaja odvetniku" (Faza 7, 10. korak) – enoten vir
 * stanja dokumentov (N.dokumentnoStanjePredaje), validacija priprave predaje
 * in nekaj strukturnih preverjanj nad izvorno kodo (UI/CSS), da widget ostane
 * skladen s specifikacijo (brez notranjega scrolla, swipe kartice paketov
 * niso odstranjene, zaščita pred dvojnim klikom obstaja).
 * Zagon: node scripts/test-predaja-sestavljalnik.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

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

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const N = require(path.join(root, "..", "app", "opomin-nacrt.js"));
// Vir se normalizira na LF, da preverjanje niti ostane neodvisno od tega,
// ali je datoteka na disku trenutno shranjena s CRLF (Windows) ali LF
// (Unix) zaključki vrstic - to ni oslabitev testa, samo neobčutljivost
// na zaključke vrstic, ki jih lahko spremeni urejevalnik/orodje.
const uiSrc = fs.readFileSync(
  path.join(root, "..", "app", "opomin-nacrt-ui.js"),
  "utf8"
).replace(/\r\n/g, "\n");
const stylesSrc = fs.readFileSync(
  path.join(root, "..", "app", "styles.css"),
  "utf8"
).replace(/\r\n/g, "\n");
const obrocnoSrc = fs.readFileSync(
  path.join(root, "..", "app", "obrocno-sheet.js"),
  "utf8"
).replace(/\r\n/g, "\n");
const appSrc = fs.readFileSync(
  path.join(root, "..", "app", "app.js"),
  "utf8"
).replace(/\r\n/g, "\n");
const dolznikHtmlSrc = fs.readFileSync(
  path.join(root, "..", "app", "neplacila.html"),
  "utf8"
).replace(/\r\n/g, "\n");
const posiljanjeHtmlSrc = fs.readFileSync(
  path.join(root, "..", "app", "neplacila-posiljanje.html"),
  "utf8"
).replace(/\r\n/g, "\n");
const sporociloHtmlSrc = fs.readFileSync(
  path.join(root, "..", "app", "neplacila-sporocilo.html"),
  "utf8"
).replace(/\r\n/g, "\n");

let passed = 0;
function test(ime, fn) {
  try {
    fn();
    passed += 1;
    console.log("  ✓ " + ime);
  } catch (e) {
    console.error("  ✗ " + ime);
    throw e;
  }
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

function novPlanZKorakom10() {
  var plan = N.narediNovPlan(k1(), k2());
  var korak10 = plan.steps.find(function (s) {
    return s.kind === "manual_lawyer";
  });
  return { plan: plan, korak10: korak10 };
}

/** Poln, veljaven fixture – uporabljajo ga testi, ki preverjajo POSAMEZEN
    manjkajoč pogoj (vsi ostali pogoji so izpolnjeni). */
function pripravljenPlan() {
  var t = novPlanZKorakom10();
  var plan = t.plan;
  var idx = t.korak10.index;
  plan = N.posodobiOdvetnika(plan, idx, {
    name: "Ana Kovač",
    officeName: "Odvetniška pisarna Novak",
    email: "pisarna@novak.si",
    phone: "+38641000000",
  });
  plan = N.posodobiIzbraniPaket(plan, idx, {
    packageId: "lawyer_demand_letter",
    priceCents: 2990,
    priceLabel: "29,90 € enkratno",
    currency: "EUR",
    title: "Odvetnik pošlje opomin",
    includedItems: ["Pregled podatkov in dokumentov"],
  });
  plan = N.posodobiSporociloOdvetniku(
    plan,
    idx,
    "Pozdravljeni, prosim za pomoč pri izterjavi.",
    true
  );
  plan = N.dodajDokumentOdvetniku(plan, idx, {
    type: "invoice",
    name: "racun.pdf",
    status: "ready",
  });
  var korak10 = plan.steps.find(function (s) {
    return s.index === idx;
  });
  return { plan: plan, korak10: korak10, idx: idx };
}

console.log("\nSestavljalnik \"Predaja odvetniku\" (Faza 7)");

test("1. vedno obstajajo štiri osnovne dokumentne ploščice", function () {
  var t = novPlanZKorakom10();
  var stanje = N.dokumentnoStanjePredaje(t.plan, t.korak10.index, k1(), []);
  assert.equal(stanje.osnovniDokumenti.length, 4);
  assert.equal(stanje.baseTotal, 4);
  var tipi = stanje.osnovniDokumenti.map(function (d) {
    return d.type;
  });
  assert.deepEqual(tipi, ["invoice", "debtor_info", "reminder_history", "contract"]);
});

test("2. 2 pripravljena dokumenta pomenita 50% napredka", function () {
  var t = novPlanZKorakom10();
  // podatki dolžnika + zgodovina opominov sta samodejno pripravljena (2/4);
  // brez računa in pogodbe ostane natanko 50%.
  var stanje = N.dokumentnoStanjePredaje(t.plan, t.korak10.index, k1(), []);
  assert.equal(stanje.preparedCount, 2);
  var odstotek = Math.round((stanje.preparedCount / stanje.baseTotal) * 100);
  assert.equal(odstotek, 50);
});

test("3. dodatna dokazila ne spremenijo imenovalca 4", function () {
  var t = novPlanZKorakom10();
  var plan = N.dodajDokumentOdvetniku(t.plan, t.korak10.index, {
    type: "other",
    name: "Dopis.pdf",
    status: "ready",
  });
  plan = N.dodajDokumentOdvetniku(plan, t.korak10.index, {
    type: "other",
    name: "Slika.jpg",
    status: "ready",
  });
  var stanje = N.dokumentnoStanjePredaje(plan, t.korak10.index, k1(), []);
  assert.equal(stanje.baseTotal, 4);
  assert.equal(stanje.dodatniDokumenti.length, 2);
  assert.equal(stanje.allCount, 6);
});

test("4. račun iz prilogeKoraka šteje kot pripravljen", function () {
  var t = novPlanZKorakom10();
  var priloge = [{ status: "ready", name: "racun.pdf" }];
  var stanje = N.dokumentnoStanjePredaje(t.plan, t.korak10.index, k1(), priloge);
  var racun = stanje.osnovniDokumenti.find(function (d) {
    return d.type === "invoice";
  });
  assert.equal(racun.status, "ready");
});

test("5. račun iz lawyerHandoff.documents šteje kot pripravljen", function () {
  var t = novPlanZKorakom10();
  var plan = N.dodajDokumentOdvetniku(t.plan, t.korak10.index, {
    type: "invoice",
    name: "racun-2.pdf",
    status: "ready",
  });
  var stanje = N.dokumentnoStanjePredaje(plan, t.korak10.index, k1(), []);
  var racun = stanje.osnovniDokumenti.find(function (d) {
    return d.type === "invoice";
  });
  assert.equal(racun.status, "ready");
});

test("6. pogodba je neobvezna za nadaljevanje", function () {
  var t = pripravljenPlan();
  var preverjeno = N.preveriPogojeZaPripravoPredaje(t.plan, t.idx, k1(), []);
  assert.equal(preverjeno.ok, true, "manjkajo: " + preverjeno.manjkajoce.join(", "));
  assert.equal(preverjeno.manjkajoce.indexOf("Pogodba ali ponudba") >= 0, false);
});

test("7. neprazno sporočilo se shrani", function () {
  var t = novPlanZKorakom10();
  var plan = N.posodobiSporociloOdvetniku(t.plan, t.korak10.index, "Novo besedilo za odvetnika.", true);
  var korak = plan.steps.find(function (s) {
    return s.index === t.korak10.index;
  });
  assert.equal(korak.lawyerHandoff.message, "Novo besedilo za odvetnika.");
});

test("8. ročno spremenjeno sporočilo se ne prepiše samodejno", function () {
  var t = novPlanZKorakom10();
  var plan = N.posodobiSporociloOdvetniku(t.plan, t.korak10.index, "Ročno besedilo uporabnika.", true);
  plan = N.posodobiNamenPredaje(plan, t.korak10.index, "review", k1());
  var korak = plan.steps.find(function (s) {
    return s.index === t.korak10.index;
  });
  assert.equal(korak.lawyerHandoff.message, "Ročno besedilo uporabnika.");
  assert.equal(korak.lawyerHandoff.messageEditedManually, true);
});

test("9. prazno sporočilo blokira pregled", function () {
  var t = pripravljenPlan();
  var plan = N.posodobiSporociloOdvetniku(t.plan, t.idx, "", true);
  var preverjeno = N.preveriPogojeZaPripravoPredaje(plan, t.idx, k1(), []);
  assert.equal(preverjeno.ok, false);
  assert.ok(preverjeno.manjkajoce.indexOf("Sporočilo odvetniku") >= 0);
});

test("10. manjkajoč odvetnik blokira pregled", function () {
  var t = novPlanZKorakom10();
  var plan = N.posodobiIzbraniPaket(t.plan, t.korak10.index, {
    packageId: "lawyer_demand_letter",
  });
  plan = N.posodobiSporociloOdvetniku(plan, t.korak10.index, "Sporočilo.", true);
  var preverjeno = N.preveriPogojeZaPripravoPredaje(plan, t.korak10.index, k1(), []);
  assert.equal(preverjeno.ok, false);
  assert.ok(preverjeno.manjkajoce.indexOf("Izbran odvetnik") >= 0);
});

test("11. manjkajoč paket blokira pregled", function () {
  var t = novPlanZKorakom10();
  var plan = N.posodobiOdvetnika(t.plan, t.korak10.index, {
    name: "Ana Kovač",
    officeName: "Odvetniška pisarna Novak",
  });
  plan = N.posodobiSporociloOdvetniku(plan, t.korak10.index, "Sporočilo.", true);
  var preverjeno = N.preveriPogojeZaPripravoPredaje(plan, t.korak10.index, k1(), []);
  assert.equal(preverjeno.ok, false);
  assert.ok(preverjeno.manjkajoce.indexOf("Izbran paket") >= 0);
});

test("12. uspešen klik \"Nadaljuj na pregled\" ustvari preparedSnapshot", function () {
  var t = pripravljenPlan();
  var plan = N.pripraviPredajoOdvetniku(t.plan, t.idx, k1(), []);
  var korak = plan.steps.find(function (s) {
    return s.index === t.idx;
  });
  assert.equal(korak.lawyerHandoff.status, "prepared");
  assert.ok(korak.lawyerHandoff.preparedSnapshot);
});

test("13. ponoven klik pri \"prepared\" ne ustvari nove različice", function () {
  var t = pripravljenPlan();
  var plan = N.pripraviPredajoOdvetniku(t.plan, t.idx, k1(), []);
  var prvi = plan.steps.find(function (s) {
    return s.index === t.idx;
  }).lawyerHandoff.preparedSnapshot.pripravljenoOb;
  plan = N.pripraviPredajoOdvetniku(plan, t.idx, k1(), []);
  var korak = plan.steps.find(function (s) {
    return s.index === t.idx;
  });
  assert.equal(korak.lawyerHandoff.preparedSnapshot.pripravljenoOb, prvi);
  assert.equal(
    Array.isArray(korak.lawyerHandoff.snapshotHistory) ? korak.lawyerHandoff.snapshotHistory.length : 0,
    0
  );
});

test("14. sprememba po pripravi ustvari \"needs_review\"", function () {
  var t = pripravljenPlan();
  var plan = N.pripraviPredajoOdvetniku(t.plan, t.idx, k1(), []);
  plan = N.posodobiSporociloOdvetniku(plan, t.idx, "Spremenjeno po pripravi.", true);
  var korak = plan.steps.find(function (s) {
    return s.index === t.idx;
  });
  assert.equal(korak.lawyerHandoff.status, "needs_review");
  assert.ok(korak.lawyerHandoff.preparedSnapshot, "prejšnji snapshot ostane shranjen");
});

test("15. sestavljalnik nima gumba \"Nadaljuj na pregled\"", function () {
  assert.ok(!uiSrc.includes('id="opomin-predaja-nadaljuj"'));
});

test("16. shranjevanje sporočila ne ustvari preparedSnapshot", function () {
  var t = pripravljenPlan();
  // Urejevalnikov gumb Shrani kliče samo posodobitev besedila in shrani osnutek.
  N.shraniOsnutek(t.plan);
  var surovo = JSON.parse(global.sessionStorage.getItem("neplacilo-korak3-nacrt"));
  var korak = surovo.steps.find(function (s) {
    return s.index === t.idx;
  });
  assert.equal(korak.lawyerHandoff.status, "draft");
  assert.equal(korak.lawyerHandoff.preparedSnapshot, null);

  var idx = uiSrc.indexOf('"#opomin-predaja-sporocilo-shrani"');
  assert.ok(idx >= 0);
  var funkcijaBlok = uiSrc.slice(idx, idx + 2600);
  assert.ok(funkcijaBlok.includes("flushPredajaSporocilo()"));
  assert.ok(funkcijaBlok.includes("shrani()"));
  assert.ok(!funkcijaBlok.includes("N.pripraviPredajoOdvetniku"));
});

test("17. CSS korenskega razreda sestavljalnika nima notranjega navpičnega drsenja", function () {
  var zacetek = stylesSrc.indexOf(".opomin-predaja-sestavljalnik {");
  assert.ok(zacetek >= 0, "korenski razred .opomin-predaja-sestavljalnik mora obstajati");
  var konec = stylesSrc.indexOf("\n}", zacetek);
  var korenskiBlok = stylesSrc.slice(zacetek, konec);
  assert.ok(!korenskiBlok.includes("overflow-y: auto"));
  assert.ok(!korenskiBlok.includes("overflow-y: scroll"));
  assert.ok(!korenskiBlok.includes("overflow: auto"));
});

test("18. obstoječe swipeable paketne kartice ostanejo prisotne", function () {
  assert.ok(uiSrc.includes("function htmlPredajaPovzetek"));
  assert.ok(uiSrc.includes("function htmlKajSeBoZgodilo"));
  assert.ok(uiSrc.includes("lp-enotni-widget"));
  assert.ok(uiSrc.includes("LAWYER_ACTION_PACKAGES"));
  assert.ok(uiSrc.includes("htmlPredajaSestavljalnik(plan, step, prilogeKoraka, opts.podatkiKorak1)"));
});

test("19. glavni CTA 10. koraka validira pred prehodom na pregled", function () {
  var zacetek = uiSrc.indexOf("var jeRocnaPredaja =");
  assert.ok(zacetek >= 0, "CTA mora prepoznati ročno predajo");
  var konec = uiSrc.indexOf("if (jeCasKorakaIzvenDovoljenega", zacetek);
  var blok = uiSrc.slice(zacetek, konec);
  var flush = blok.indexOf("flushPredajaSporocilo()");
  var validacija = blok.indexOf("N.preveriPogojeZaPripravoPredaje(");
  var priprava = blok.indexOf("N.pripraviPredajoOdvetniku(");
  var prehod = blok.indexOf("pokaziPotrditev(step.index)");
  assert.ok(flush >= 0 && flush < validacija, "zadnji vnos sporočila se shrani pred validacijo");
  assert.ok(validacija >= 0 && validacija < priprava, "validacija se izvede pred pripravo");
  assert.ok(priprava >= 0 && priprava < prehod, "pregled se odpre šele po uspešni pripravi");
  assert.ok(blok.includes('naslov: "Dopolnite podatke za predajo"'));
  assert.ok(blok.includes("if (!preverjenaPredaja.ok)"));
});

test("20. tri datoteke tipa invoice ostanejo tri", function () {
  var t = novPlanZKorakom10();
  var plan = t.plan;
  ["racun-1.pdf", "racun-2.pdf", "dobavnica.jpg"].forEach(function (ime, i) {
    plan = N.dodajDokumentOdvetniku(plan, t.korak10.index, {
      type: "invoice",
      name: ime,
      mimeType: i === 2 ? "image/jpeg" : "application/pdf",
      sizeBytes: 1000 + i,
      status: "ready",
    });
  });
  var korak = plan.steps.find(function (s) {
    return s.index === t.korak10.index;
  });
  var racuni = korak.lawyerHandoff.documents.filter(function (d) {
    return d.type === "invoice";
  });
  assert.equal(racuni.length, 3);
});

test("21. fileCount za račun je 3", function () {
  var t = novPlanZKorakom10();
  var plan = t.plan;
  ["a.pdf", "b.pdf", "c.pdf"].forEach(function (ime) {
    plan = N.dodajDokumentOdvetniku(plan, t.korak10.index, {
      type: "invoice",
      name: ime,
      status: "ready",
    });
  });
  var stanje = N.dokumentnoStanjePredaje(plan, t.korak10.index, k1(), []);
  var racun = stanje.osnovniDokumenti.find(function (d) {
    return d.type === "invoice";
  });
  assert.equal(racun.fileCount, 3);
  assert.equal(racun.files.length, 3);
});

test("22. tri računske datoteke povečajo preparedCount samo za eno kategorijo", function () {
  var t = novPlanZKorakom10();
  var plan = t.plan;
  ["a.pdf", "b.pdf", "c.pdf"].forEach(function (ime) {
    plan = N.dodajDokumentOdvetniku(plan, t.korak10.index, {
      type: "invoice",
      name: ime,
      status: "ready",
    });
  });
  var stanje = N.dokumentnoStanjePredaje(plan, t.korak10.index, k1(), []);
  // podatki dolžnika + zgodovina opominov + račun = 3 pripravljene kategorije
  assert.equal(stanje.preparedCount, 3);
});

test("23. odstranitev ene od treh ohrani drugi dve", function () {
  var t = novPlanZKorakom10();
  var plan = t.plan;
  var idji = [];
  ["a.pdf", "b.pdf", "c.pdf"].forEach(function (ime) {
    plan = N.dodajDokumentOdvetniku(plan, t.korak10.index, {
      type: "invoice",
      name: ime,
      status: "ready",
    });
    var korak = plan.steps.find(function (s) {
      return s.index === t.korak10.index;
    });
    idji.push(korak.lawyerHandoff.documents[korak.lawyerHandoff.documents.length - 1].id);
  });
  plan = N.odstraniDokumentOdvetniku(plan, t.korak10.index, idji[1]);
  var stanje = N.dokumentnoStanjePredaje(plan, t.korak10.index, k1(), []);
  var racun = stanje.osnovniDokumenti.find(function (d) {
    return d.type === "invoice";
  });
  assert.equal(racun.fileCount, 2);
  assert.equal(racun.files.length, 2);
  assert.equal(racun.status, "ready");
});

test("24. odstranitev zadnje spremeni stanje računa v manjkajoče", function () {
  var t = novPlanZKorakom10();
  var plan = N.dodajDokumentOdvetniku(t.plan, t.korak10.index, {
    type: "invoice",
    name: "edini.pdf",
    status: "ready",
  });
  var korak = plan.steps.find(function (s) {
    return s.index === t.korak10.index;
  });
  var id = korak.lawyerHandoff.documents[0].id;
  plan = N.odstraniDokumentOdvetniku(plan, t.korak10.index, id);
  var stanje = N.dokumentnoStanjePredaje(plan, t.korak10.index, k1(), []);
  var racun = stanje.osnovniDokumenti.find(function (d) {
    return d.type === "invoice";
  });
  assert.equal(racun.fileCount, 0);
  assert.equal(racun.status, "missing");
});

test("25. dve pogodbi sta obe vidni", function () {
  var t = novPlanZKorakom10();
  var plan = t.plan;
  ["pogodba.pdf", "ponudba.pdf"].forEach(function (ime) {
    plan = N.dodajDokumentOdvetniku(plan, t.korak10.index, {
      type: "contract",
      name: ime,
      status: "ready",
    });
  });
  var stanje = N.dokumentnoStanjePredaje(plan, t.korak10.index, k1(), []);
  var pogodba = stanje.osnovniDokumenti.find(function (d) {
    return d.type === "contract";
  });
  assert.equal(pogodba.fileCount, 2);
  assert.equal(pogodba.files.length, 2);
});

test("26. dodatna dokazila ne spremenijo baseTotal 4", function () {
  var t = novPlanZKorakom10();
  var plan = t.plan;
  ["a.pdf", "b.pdf", "c.pdf"].forEach(function (ime) {
    plan = N.dodajDokumentOdvetniku(plan, t.korak10.index, {
      type: "other",
      name: ime,
      status: "ready",
    });
  });
  var stanje = N.dokumentnoStanjePredaje(plan, t.korak10.index, k1(), []);
  assert.equal(stanje.baseTotal, 4);
  assert.equal(stanje.dodatniDokumenti.length, 3);
});

test("27. snapshot vsebuje vse datoteke", function () {
  var t = pripravljenPlan();
  var plan = t.plan;
  ["a.pdf", "b.pdf", "c.pdf"].forEach(function (ime) {
    plan = N.dodajDokumentOdvetniku(plan, t.idx, {
      type: "invoice",
      name: ime,
      status: "ready",
    });
  });
  plan = N.pripraviPredajoOdvetniku(plan, t.idx, k1(), []);
  var korak = plan.steps.find(function (s) {
    return s.index === t.idx;
  });
  var doki = korak.lawyerHandoff.preparedSnapshot.dokumenti.filter(function (d) {
    return d.type === "invoice";
  });
  assert.equal(doki.length, 4);
});

test("28. sizeBytes preživi shranjevanje in ponovno nalaganje načrta", function () {
  var t = novPlanZKorakom10();
  var plan = N.dodajDokumentOdvetniku(t.plan, t.korak10.index, {
    type: "invoice",
    name: "racun.pdf",
    sizeBytes: 2048,
    status: "ready",
  });
  N.shraniOsnutek(plan);
  var nalozen = N.naloziOsnutek();
  var korak = nalozen.steps.find(function (s) {
    return s.index === t.korak10.index;
  });
  var doc = korak.lawyerHandoff.documents.find(function (d) {
    return d.type === "invoice";
  });
  assert.equal(doc.sizeBytes, 2048);
});

test("29. dodajanje po prepared spremeni status v needs_review", function () {
  var t = pripravljenPlan();
  var plan = N.pripraviPredajoOdvetniku(t.plan, t.idx, k1(), []);
  plan = N.dodajDokumentOdvetniku(plan, t.idx, {
    type: "contract",
    name: "pogodba.pdf",
    status: "ready",
  });
  var korak = plan.steps.find(function (s) {
    return s.index === t.idx;
  });
  assert.equal(korak.lawyerHandoff.status, "needs_review");
});

test("30. HTML-input vsebuje multiple in ne uporablja files[0]", function () {
  var idx = uiSrc.indexOf('id="opomin-dokument-datoteka"');
  assert.ok(idx >= 0);
  var vrstica = uiSrc.slice(idx, idx + 200);
  assert.ok(vrstica.includes("multiple"));
  assert.ok(uiSrc.includes("Array.from(dokumentDatoteka.files"));
  assert.ok(!uiSrc.includes("dokumentDatoteka.files[0]"));
  assert.ok(!uiSrc.includes("dokumentDatoteka.files && dokumentDatoteka.files[0]"));
});

test("31. pripravljena ploščica je klikljiv button z data-dokument-odpri-tip", function () {
  var idx = uiSrc.indexOf("function htmlPredajaDokumentPloscica");
  assert.ok(idx >= 0);
  var blok = uiSrc.slice(idx, idx + 2200);
  assert.ok(blok.includes("data-dokument-odpri-tip"));
  assert.ok(blok.includes("<button type="));
});

test("32. naslov ploščice uporablja število datotek", function () {
  var t = novPlanZKorakom10();
  var plan = t.plan;
  ["a.pdf", "b.pdf", "c.pdf"].forEach(function (ime) {
    plan = N.dodajDokumentOdvetniku(plan, t.korak10.index, {
      type: "invoice",
      name: ime,
      status: "ready",
    });
  });
  var stanje = N.dokumentnoStanjePredaje(plan, t.korak10.index, k1(), []);
  var racun = stanje.osnovniDokumenti.find(function (d) {
    return d.type === "invoice";
  });
  assert.equal(racun.subtitle, "3 datoteke");
});

test("33. kategorijski sheet ima dodajanje in enoten modal za ogled ter odstranjevanje", function () {
  assert.ok(uiSrc.includes("data-kategorija-uvozi"));
  assert.ok(uiSrc.includes("data-kategorija-slikaj"));
  assert.ok(uiSrc.includes("data-kategorija-odpri"));
  assert.ok(uiSrc.includes("data-predaja-datoteka-odstrani"));
  assert.ok(uiSrc.includes("data-predaja-datoteka-shrani"));
  assert.ok(uiSrc.includes("opomin-predaja-kategorija-dokumenti-sheet"));
  assert.ok(uiSrc.includes("+ Dodaj še datoteke"));
  assert.ok(uiSrc.includes("V tej kategoriji še ni datotek."));
});

test("34. akciji sporočila sta skriti do urejanja in po akciji znova izgineta", function () {
  assert.ok(!uiSrc.includes('id="opomin-predaja-shrani-osnutek"'));
  assert.ok(uiSrc.includes('id="opomin-predaja-sporocilo-akcije" hidden'));
  assert.ok(uiSrc.includes('id="opomin-predaja-sporocilo-vrni"'));
  assert.ok(uiSrc.includes('id="opomin-predaja-sporocilo-shrani"'));
  assert.ok(uiSrc.includes("predajaSporociloTextarea.value = predajaSporociloPrejsnjaVrednost"));
  assert.ok(uiSrc.includes("skrijPredajaSporociloAkcije()"));
  assert.ok(stylesSrc.includes(".opomin-predaja-sestavljalnik__sporocilo-akcije[hidden]"));
  assert.ok(!uiSrc.includes('id="opomin-predaja-nadaljuj"'));
});

test("35. novi korak odvetnika ima privzeto izbrane delovne dni", function () {
  var t = novPlanZKorakom10();
  assert.deepEqual(t.korak10.lawyerHandoff.availableHandoffDays, [true, true, true, true, true, false, false]);
});

test("36. uporabnik lahko spremeni dneve, najmanj en dan pa mora ostati", function () {
  var t = novPlanZKorakom10();
  var plan = N.posodobiDnevePredaje(t.plan, t.korak10.index, [true, false, true, false, true, false, false]);
  var korak = N.najdiKorak(plan, t.korak10.index);
  assert.deepEqual(korak.lawyerHandoff.availableHandoffDays, [true, false, true, false, true, false, false]);
  assert.equal(korak.lawyerHandoff.availableHandoffDaysEditedManually, true);
  plan = N.posodobiDnevePredaje(plan, t.korak10.index, [false, false, false, false, false, false, false]);
  assert.deepEqual(N.najdiKorak(plan, t.korak10.index).lawyerHandoff.availableHandoffDays, [true, false, true, false, true, false, false]);
});

test("37. zamenjava odvetnika naloži njegove privzete dneve", function () {
  var t = novPlanZKorakom10();
  var plan = N.posodobiDnevePredaje(t.plan, t.korak10.index, [true, false, false, false, false, false, false]);
  plan = N.posodobiOdvetnika(plan, t.korak10.index, {
    name: "Odvetnik Test",
    availableHandoffDays: [false, true, true, true, true, false, false],
  }, "test_lawyer");
  var lh = N.najdiKorak(plan, t.korak10.index).lawyerHandoff;
  assert.deepEqual(lh.availableHandoffDays, [false, true, true, true, true, false, false]);
  assert.equal(lh.availableHandoffDaysEditedManually, false);
  assert.equal(lh.availableHandoffDaysSourceLawyerId, "test_lawyer");
});

test("38. pripravljeni posnetek vsebuje izbrane dneve predaje", function () {
  var t = pripravljenPlan();
  var plan = N.posodobiDnevePredaje(t.plan, t.idx, [true, false, true, false, true, false, false]);
  plan = N.pripraviPredajoOdvetniku(plan, t.idx, k1(), []);
  var snap = N.najdiKorak(plan, t.idx).lawyerHandoff.preparedSnapshot;
  assert.deepEqual(snap.odvetnik.mozniDneviPredaje, [true, false, true, false, true, false, false]);
  assert.equal(snap.odvetnik.dneviPredajeSpremenjeniRocno, true);
});

test("39. vrstica dni je med izbiro odvetnika in dokumenti ter ima mobilni CSS", function () {
  var sestavljalnik = uiSrc.slice(uiSrc.indexOf("function htmlPredajaSestavljalnik"), uiSrc.indexOf("function htmlKoncniPregledVsebina"));
  assert.ok(sestavljalnik.indexOf("htmlPredajaOdvetnikPill") < sestavljalnik.indexOf("htmlPredajaDnevi"));
  assert.ok(sestavljalnik.indexOf("htmlPredajaDnevi") < sestavljalnik.indexOf("htmlPredajaDokumenti"));
  assert.ok(uiSrc.includes("Možni dnevi predaje"));
  assert.ok(uiSrc.includes("Po navodilih odvetnika"));
  assert.ok(uiSrc.includes("data-predaja-dan"));
  assert.ok(stylesSrc.includes(".opomin-predaja-sestavljalnik__dnevi-vrstica"));
  assert.ok(stylesSrc.includes("grid-template-columns: repeat(7, minmax(0, 1fr))"));
});

test("40. čas predaje podpira čimprej in ročno določen termin", function () {
  var t = novPlanZKorakom10();
  var iso = "2026-08-17T08:30:00.000Z";
  var plan = N.posodobiCasPredajeOdvetniku(t.plan, t.korak10.index, "custom", iso);
  var korak = N.najdiKorak(plan, t.korak10.index);
  assert.equal(korak.lawyerHandoff.handoffTimingMode, "custom");
  assert.equal(korak.lawyerHandoff.scheduledHandoffAt, iso);
  assert.equal(korak.sendAt, iso);
  assert.equal(korak.manualScheduleOverride, true);
  plan = N.posodobiCasPredajeOdvetniku(plan, t.korak10.index, "asap", "2026-08-14T07:00:00.000Z");
  korak = N.najdiKorak(plan, t.korak10.index);
  assert.equal(korak.lawyerHandoff.handoffTimingMode, "asap");
  assert.equal(korak.manualScheduleOverride, false);
});

test("41. neveljaven čas predaje ne spremeni načrta", function () {
  var t = novPlanZKorakom10();
  var prej = t.korak10.sendAt;
  var plan = N.posodobiCasPredajeOdvetniku(t.plan, t.korak10.index, "custom", "ni-datum");
  assert.equal(N.najdiKorak(plan, t.korak10.index).sendAt, prej);
});

test("42. pripravljeni posnetek vsebuje način ter termin predaje", function () {
  var t = pripravljenPlan();
  var iso = "2026-08-17T08:30:00.000Z";
  var plan = N.posodobiCasPredajeOdvetniku(t.plan, t.idx, "custom", iso);
  plan = N.pripraviPredajoOdvetniku(plan, t.idx, k1(), []);
  var snap = N.najdiKorak(plan, t.idx).lawyerHandoff.preparedSnapshot;
  assert.deepEqual(snap.casPredaje, { nacin: "custom", scheduledAt: iso });
});

test("43. UI vsebuje vrstici Čimprej ter Določi čas z datumom in uro", function () {
  assert.ok(uiSrc.includes('data-predaja-cas-nacin="asap"'));
  assert.ok(uiSrc.includes('data-predaja-cas-nacin="custom"'));
  assert.ok(uiSrc.includes('id="opomin-predaja-cas-datum"'));
  assert.ok(uiSrc.includes('id="opomin-predaja-cas-ura"'));
  assert.ok(!uiSrc.includes("Izberite termin"));
  var rocnaVrstica = uiSrc.slice(
    uiSrc.indexOf('opomin-predaja-sestavljalnik__cas-vrstica--rocno'),
    uiSrc.indexOf('opomin-predaja-sestavljalnik__cas-napaka')
  );
  assert.ok(rocnaVrstica.includes('data-predaja-cas-nacin="custom"'));
  assert.ok(rocnaVrstica.includes('id="opomin-predaja-cas-datum"'));
  assert.ok(rocnaVrstica.includes('id="opomin-predaja-cas-ura"'));
  assert.ok(uiSrc.includes("Izberite enega od označenih dni predaje."));
  assert.ok(stylesSrc.includes(".opomin-predaja-sestavljalnik__cas-vrstica"));
  assert.ok(stylesSrc.includes(".opomin-predaja-sestavljalnik__cas-vnosa"));
  assert.ok(stylesSrc.includes(".opomin-predaja-sestavljalnik__cas-polje:focus-within"));
  assert.ok(uiSrc.includes('jeNemsko ? "Heute" : "Danes"'));
  assert.ok(uiSrc.includes('jeNemsko ? "Morgen" : "Jutri"'));
  assert.ok(uiSrc.includes('"Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek"'));
  assert.ok(uiSrc.includes('"Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"'));
  assert.ok(uiSrc.includes("opomin-predaja-sestavljalnik__cas-datum-ura"));
  assert.ok(uiSrc.includes("esc(formatDatumKratekDDMM(casIso))"));
  var rezultatCss = stylesSrc.slice(
    stylesSrc.indexOf(".opomin-predaja-sestavljalnik__cas-rezultat"),
    stylesSrc.indexOf(".opomin-predaja-sestavljalnik__cas-vnosa")
  );
  assert.ok(rezultatCss.includes("grid-template-columns: minmax(0, 1fr) auto"));
  assert.ok(rezultatCss.includes("justify-self: center"));
  assert.ok(rezultatCss.includes("font-size: 16px"));
  assert.ok(rezultatCss.includes("font-size: 11px"));
  assert.ok(rezultatCss.includes("opomin-predaja-sestavljalnik__cas-dan--dolg"));
  assert.ok(rezultatCss.includes("transform: scaleX(0.75)"));
  assert.ok(uiSrc.includes("oznakaDneva.length > 7"));
});

test("44. dnevni gumbi prejšnjih kartic so popolnoma okrogli", function () {
  var sklopZacetek = stylesSrc.indexOf(".opomin-nacrt__dnevi-teden {");
  var zacetek = stylesSrc.indexOf(".opomin-nacrt__dnevi-teden-vrstica", sklopZacetek);
  var konec = stylesSrc.indexOf(".opomin-nacrt__dnevi-opomba", zacetek);
  var sklop = stylesSrc.slice(sklopZacetek, konec);
  var blok = stylesSrc.slice(zacetek, konec);
  assert.ok(blok.includes("grid-template-columns: repeat(7, minmax(0, 1fr))"));
  assert.ok(blok.includes("aspect-ratio: 1"));
  assert.ok(blok.includes("border-radius: 50%"));
  assert.ok(sklop.includes("background: transparent"));
  assert.ok(blok.includes("max-width: 38px"));
  assert.ok(sklop.includes("margin: 4px 0 0"));
  assert.ok(!blok.includes("linear-gradient"));
});

test("45. krogi pri predaji odvetniku imajo enake mere in barve", function () {
  var zacetek = stylesSrc.indexOf(".opomin-predaja-sestavljalnik__dnevi-vrstica");
  var konec = stylesSrc.indexOf(".opomin-predaja-sestavljalnik__dnevi-pomoc", zacetek);
  var blok = stylesSrc.slice(zacetek, konec);
  assert.ok(blok.includes("gap: 2px"));
  assert.ok(blok.includes("max-width: 38px"));
  assert.ok(blok.includes("min-height: 32px"));
  assert.ok(blok.includes("border-radius: 50%"));
  assert.ok(blok.includes("background: var(--color-primary)"));
  assert.ok(blok.includes("border-color: var(--color-primary)"));
});

test("46. izbira odvetnika in dnevi so vizualno povezani", function () {
  var rootZacetek = stylesSrc.indexOf(".opomin-predaja-sestavljalnik {");
  var pillZacetek = stylesSrc.indexOf(".opomin-predaja-sestavljalnik__odvetnik-pill", rootZacetek);
  var dneviZacetek = stylesSrc.indexOf(".opomin-predaja-sestavljalnik__dnevi {", pillZacetek);
  var rootBlok = stylesSrc.slice(rootZacetek, pillZacetek);
  var pillBlok = stylesSrc.slice(pillZacetek, dneviZacetek);
  var dneviBlok = stylesSrc.slice(dneviZacetek, stylesSrc.indexOf(".opomin-predaja-sestavljalnik__dnevi-glava", dneviZacetek));
  assert.ok(rootBlok.includes("padding: 24px 18px 20px"));
  assert.ok(pillBlok.includes("z-index: 2"));
  assert.ok(dneviBlok.includes("margin: 0 -12px 20px"));
  assert.ok(dneviBlok.includes("border-top: 0"));
  assert.ok(dneviBlok.includes("border-radius: 0 0 16px 16px"));
});

test("47. dokumentne zahteve so kompaktni in razsirljivi mini gradniki", function () {
  var zacetek = stylesSrc.indexOf(".opomin-predaja-sestavljalnik__mreza {");
  var konec = stylesSrc.indexOf("button.opomin-predaja-sestavljalnik__ploscica", zacetek);
  var blok = stylesSrc.slice(zacetek, konec);
  assert.ok(blok.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"));
  assert.ok(blok.includes("height: 68px"));
  assert.ok(blok.includes("grid-template-columns: 24px minmax(0, 1fr) 20px"));
  assert.ok(stylesSrc.includes("-webkit-line-clamp: 2"));
  assert.ok(stylesSrc.includes("white-space: nowrap"));
  assert.ok(uiSrc.includes("Mreža sprejme poljubno"));
});

test("48. fokusiran naslov dokumentnega okna nima grdega okvirja", function () {
  var zacetek = stylesSrc.indexOf(".opomin-cas-sheet__naslov:focus,");
  var konec = stylesSrc.indexOf("}", zacetek);
  var blok = stylesSrc.slice(zacetek, konec);
  assert.ok(zacetek >= 0);
  assert.ok(blok.includes("outline: 0 !important"));
  assert.ok(blok.includes("box-shadow: none !important"));
  assert.ok(stylesSrc.includes("-webkit-tap-highlight-color: transparent"));
  assert.ok(stylesSrc.includes('[tabindex="-1"]:focus-visible'));
  assert.ok(uiSrc.includes('id="opomin-predaja-kategorija-dokumenti-sheet-naslov" tabindex="-1"'));
});

test("49. dokument hrani vprašanje, odgovor in obveznost", function () {
  var t = pripravljenPlan();
  var plan = N.dodajDokumentOdvetniku(t.plan, t.idx, {
    type: "contract",
    name: "slika.jpg",
    descriptionQuestion: "Kdaj je nastala slika?",
    description: "Na dan prevzema.",
    descriptionRequired: true,
  });
  var dokument = N.najdiKorak(plan, t.idx).lawyerHandoff.documents.find(function (d) {
    return d.type === "contract";
  });
  assert.equal(dokument.descriptionQuestion, "Kdaj je nastala slika?");
  assert.equal(dokument.description, "Na dan prevzema.");
  assert.equal(dokument.descriptionRequired, true);
});

test("50. manjkajoč obvezen odgovor blokira predajo", function () {
  var t = pripravljenPlan();
  var plan = N.dodajDokumentOdvetniku(t.plan, t.idx, {
    type: "contract",
    name: "dokaz.pdf",
    descriptionRequired: true,
  });
  var dokument = N.najdiKorak(plan, t.idx).lawyerHandoff.documents.find(function (d) {
    return d.type === "contract";
  });
  var pred = N.preveriPogojeZaPripravoPredaje(plan, t.idx, k1(), []);
  assert.equal(pred.ok, false);
  assert.ok(pred.manjkajoce.includes("Opis obveznih prilog"));
  plan = N.posodobiOpisDokumentaOdvetniku(plan, t.idx, dokument.id, "Dokument je nastal ob prevzemu.");
  var po = N.preveriPogojeZaPripravoPredaje(plan, t.idx, k1(), []);
  assert.equal(po.ok, true);
});

test("51. priloga prvega koraka se z opisom prenese v končni posnetek", function () {
  var t = pripravljenPlan();
  var priloge = [{
    attachmentId: "prvi-1",
    storagePath: "uporabnik/racun.jpg",
    originalFileName: "racun.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1234,
    status: "ready",
    descriptionQuestion: "Kdaj je nastala slika?",
    description: "13. avgusta 2026.",
    descriptionRequired: false,
  }];
  var plan = N.pripraviPredajoOdvetniku(t.plan, t.idx, k1(), priloge);
  var snap = N.najdiKorak(plan, t.idx).lawyerHandoff.preparedSnapshot;
  var prenesena = snap.dokumenti.find(function (d) { return d.attachmentId === "prvi-1"; });
  assert.ok(prenesena);
  assert.equal(prenesena.description, "13. avgusta 2026.");
  assert.equal(prenesena.descriptionQuestion, "Kdaj je nastala slika?");
});

test("52. oba zaslona vsebujeta enoten urejevalnik opisa priloge", function () {
  var appSrc = fs.readFileSync(path.join(root, "..", "app", "app.js"), "utf8");
  var prviHtml = fs.readFileSync(path.join(root, "..", "app", "neplacila.html"), "utf8");
  assert.ok(appSrc.includes("racun-posiljanje__opis-vnos"));
  assert.ok(uiSrc.includes("data-predaja-datoteka-vnos"));
  assert.ok(prviHtml.includes("opravljeno-bubble"));
  assert.ok(prviHtml.includes("data-opravljeno-zahteva"));
  assert.ok(prviHtml.indexOf("data-opravljeno-zahteva") > prviHtml.indexOf("Kaj je bilo opravljeno?"));
  assert.ok(uiSrc.includes("Brez dodatnega opisa"));
});

test("53. izbrani odvetnik določi vprašanje in obveznost po vrsti dokumenta", function () {
  var t = pripravljenPlan();
  var plan = N.posodobiOdvetnika(t.plan, t.idx, {
    name: "Odvetnik z zahtevami",
    attachmentRequirements: {
      invoice: { question: "Kdaj je račun zapadel?", required: true },
    },
  }, "zahtevni_odvetnik");
  var stanje = N.dokumentnoStanjePredaje(plan, t.idx, k1(), [{
    attachmentId: "racun-zahteva",
    storagePath: "u/racun.pdf",
    originalFileName: "racun.pdf",
    status: "ready",
  }]);
  var racun = stanje.osnovniDokumenti.find(function (d) { return d.type === "invoice"; });
  assert.equal(racun.files[0].descriptionQuestion, "Kdaj je račun zapadel?");
  assert.equal(racun.files[0].descriptionRequired, true);
});

test("54. račun in dokazilo opravljenega ostaneta ločeni vrsti", function () {
  var t = novPlanZKorakom10();
  var priloge = [
    {
      documentType: "invoice",
      attachmentId: "racun-1",
      storagePath: "u/racun.pdf",
      originalFileName: "racun.pdf",
      status: "ready",
    },
    {
      documentType: "work_evidence",
      attachmentId: "dokaz-1",
      storagePath: "u/delo.jpg",
      originalFileName: "delo.jpg",
      status: "ready",
      description: "Fotografija po končanem delu.",
    },
  ];
  var stanje = N.dokumentnoStanjePredaje(t.plan, t.korak10.index, k1(), priloge);
  var racun = stanje.osnovniDokumenti.find(function (d) { return d.type === "invoice"; });
  assert.equal(racun.fileCount, 1);
  assert.equal(racun.files[0].attachmentId, "racun-1");
  var dokazilo = stanje.dodatniDokumenti.find(function (d) { return d.type === "work_evidence"; });
  assert.ok(dokazilo);
  assert.equal(dokazilo.files[0].attachmentId, "dokaz-1");
});

test("55. dokazilo se poveča in ureja v aplikaciji brez novega okna", function () {
  var appSrc = fs.readFileSync(path.join(root, "..", "app", "app.js"), "utf8");
  var prviHtml = fs.readFileSync(path.join(root, "..", "app", "neplacila.html"), "utf8");
  var zacetek = appSrc.indexOf("async function odpriOpravljenoModal");
  var konec = appSrc.indexOf("function izrisiDokazilaOpravljenega", zacetek);
  var modalSrc = appSrc.slice(zacetek, konec);
  assert.ok(prviHtml.includes('id="opravljeno-modal-slika"'));
  assert.ok(prviHtml.includes('id="opravljeno-modal-pdf"'));
  assert.ok(prviHtml.includes('id="opravljeno-modal-vnos"'));
  assert.ok(prviHtml.includes('id="opravljeno-modal-izbrisi">Odstrani'));
  assert.ok(prviHtml.includes('id="opravljeno-modal-shrani">Shrani'));
  assert.ok(appSrc.includes("odpriOpravljenoModal(priloga, indeks)"));
  assert.equal(modalSrc.includes("window.open"), false);
  assert.ok(stylesSrc.includes(".opravljeno-modal__medij"));
});

test("56. izbrani odvetnik določi zahtevo za dokazilo opravljenega dela", function () {
  var t = pripravljenPlan();
  var plan = N.posodobiOdvetnika(t.plan, t.idx, {
    name: "Odvetnik z zahtevo za slike",
    attachmentRequirements: {
      work_evidence: {
        recommendation: "Priložite slike prvotnega stanja.",
        question: "Kaj prikazuje fotografija?",
        required: true,
      },
    },
  }, "odvetnik_s_slikami");
  var stanje = N.dokumentnoStanjePredaje(plan, t.idx, k1(), [{
    documentType: "work_evidence",
    attachmentId: "slika-1",
    storagePath: "u/slika.jpg",
    originalFileName: "slika.jpg",
    mimeType: "image/jpeg",
    status: "ready",
  }]);
  var dokazilo = stanje.dodatniDokumenti.find(function (d) {
    return d.type === "work_evidence";
  });
  assert.equal(dokazilo.files[0].descriptionQuestion, "Kaj prikazuje fotografija?");
  assert.equal(dokazilo.files[0].descriptionRequired, true);
});

test("57. uvoz dokazila takoj odpre zaporedni obrazec s priporočilom", function () {
  var appSrc = fs.readFileSync(path.join(root, "..", "app", "app.js"), "utf8");
  var prviHtml = fs.readFileSync(path.join(root, "..", "app", "neplacila.html"), "utf8");
  assert.ok(prviHtml.includes('id="opravljeno-priporocilo-besedilo"'));
  assert.ok(prviHtml.includes("Po priporočilu odvetnika priložite slike prvotnega stanja."));
  assert.ok(appSrc.includes("PRIVZETA_ZAHTEVA_DOKAZILA_OPRAVLJENEGA"));
  assert.ok(appSrc.includes("descriptionRequired: zahteva.required"));
  assert.ok(appSrc.includes("requestAnimationFrame(odpriNaslednjeCakajoceDokazilo)"));
  assert.ok(uiSrc.includes("shraniZahtevePrilogIzbranegaOdvetnika"));
  assert.ok(uiSrc.includes("work_evidence:"));
});

test("58. brez slike odpre isti obvezni obrazec in se prenese v dokumente", function () {
  var appSrc = fs.readFileSync(path.join(root, "..", "app", "app.js"), "utf8");
  var prviHtml = fs.readFileSync(path.join(root, "..", "app", "neplacila.html"), "utf8");
  var pvSrc = fs.readFileSync(path.join(root, "..", "app", "priloge-vsebina.js"), "utf8");
  assert.ok(prviHtml.includes("data-opravljeno-brez-slike"));
  assert.ok(prviHtml.includes("Nimam slike"));
  assert.ok(appSrc.includes("function dodajOpisBrezSlike"));
  assert.ok(appSrc.includes("opravljenoBrezSlike"));
  assert.ok(pvSrc.includes("textOnly: true"));
  assert.ok(uiSrc.includes("data-predaja-datoteka-brez-slike"));
});

test("59. več slik iste zahteve je združenih v eni galeriji z enim opisom", function () {
  var appSrc = fs.readFileSync(path.join(root, "..", "app", "app.js"), "utf8");
  var prviHtml = fs.readFileSync(path.join(root, "..", "app", "neplacila.html"), "utf8");
  assert.ok(prviHtml.includes('id="opravljeno-modal-galerija"'));
  assert.ok(prviHtml.includes('id="opravljeno-modal-dodaj"'));
  assert.ok(prviHtml.includes('class="opravljeno-bubble__zahteva"'));
  assert.ok(stylesSrc.includes(".opravljeno-bubble__zahteva > .opravljeno-bubble__seznam:not(:empty)"));
  assert.ok(appSrc.includes("groupId"));
  assert.ok(appSrc.includes("prilogeSkupineDokazila"));
  assert.ok(appSrc.includes("clan.description = opis"));
  assert.ok(stylesSrc.includes(".opravljeno-modal__galerija"));
  assert.ok(stylesSrc.includes(".opravljeno-modal__vnos:focus-visible"));
  assert.ok(stylesSrc.includes(".korak2-textarea:focus-visible"));
});

test("60. vse kategorije dokumentov uporabljajo enoten priporočilni skupinski sistem", function () {
  var ui = fs.readFileSync(path.join(root, "..", "app", "opomin-nacrt-ui.js"), "utf8");
  assert.ok(ui.includes("function zahtevaDokumentaPredaja"));
  assert.ok(ui.includes("data-kategorija-uvozi"));
  assert.ok(ui.includes("data-kategorija-slikaj"));
  assert.ok(ui.includes("data-kategorija-brez"));
  assert.ok(ui.includes("data-predaja-datoteka-galerija"));
  var t = pripravljenPlan();
  var groupId = "pogodba-skupina-1";
  var plan = N.dodajDokumentOdvetniku(t.plan, t.idx, {
    type: "contract", name: "pogodba-1.jpg", groupId: groupId,
    mimeType: "image/jpeg", status: "ready", description: "Skupni opis",
  });
  plan = N.dodajDokumentOdvetniku(plan, t.idx, {
    type: "contract", name: "pogodba-2.jpg", groupId: groupId,
    mimeType: "image/jpeg", status: "ready", description: "Skupni opis",
  });
  var datoteke = N.dokumentiPredajePoTipu(plan, t.idx, "contract", k1(), []);
  assert.equal(datoteke.length, 2);
  assert.equal(datoteke[0].groupId, groupId);
  assert.equal(datoteke[1].groupId, groupId);
});

test("61. prvi korak uporablja vprašalne widgete namesto generičnega polja", function () {
  var prviHtml = fs.readFileSync(path.join(root, "..", "app", "neplacila.html"), "utf8");
  assert.ok(prviHtml.includes("Od vas potrebujemo nekaj odgovorov"));
  assert.ok(prviHtml.includes("opravljeno-vprasanje--besedilo"));
  assert.ok(prviHtml.includes('id="opis-dolga"'));
  assert.ok(prviHtml.includes("data-opravljeno-zahteva"));
  assert.ok(stylesSrc.includes(".opravljeno-vprasanje__glava"));
});

test("62. besedilni vprašalni widget se razširi in ima majhna gumba desno", function () {
  var prviHtml = fs.readFileSync(path.join(root, "..", "app", "neplacila.html"), "utf8");
  var appSrc = fs.readFileSync(path.join(root, "..", "app", "app.js"), "utf8");
  assert.ok(prviHtml.includes('id="opis-dolga-izbrisi"'));
  assert.ok(prviHtml.includes('id="opis-dolga-shrani"'));
  assert.ok(appSrc.includes("nastaviUrejanjeOpisnegaVprasanja"));
  assert.ok(stylesSrc.includes(".opravljeno-vprasanje--urejanje #opis-dolga"));
  assert.ok(stylesSrc.includes("justify-content: flex-end"));
});

test("63. račun je ob datumih, vprašanja pa so drsni sklop", function () {
  var prviHtml = fs.readFileSync(path.join(root, "..", "app", "neplacila.html"), "utf8");
  var appSrc = fs.readFileSync(path.join(root, "..", "app", "app.js"), "utf8");
  assert.ok(prviHtml.includes("racun-posiljanje__naslov-besedilo\">Priložite račun</span><span class=\"racun-posiljanje__stevec\""));
  assert.ok(!prviHtml.includes(">Račun za pošiljanje</h3>"));
  assert.ok(prviHtml.indexOf('id="racun-posiljanje"') < prviHtml.indexOf('id="opravljeno-vprasanja-viewport"'));
  assert.ok(prviHtml.includes('data-opravljeno-vprasanje="0"'));
  assert.ok(prviHtml.includes('data-opravljeno-vprasanje="1"'));
  assert.ok(prviHtml.includes("obrazec-razdelek--dolg"));
  assert.ok(prviHtml.includes("obrazec-racun-widget"));
  assert.ok(prviHtml.includes("obrazec__polje--opravljeno-vprasanja"));
  assert.ok(appSrc.includes("prikaziOpravljenoVprasanje"));
  assert.ok(stylesSrc.includes("scroll-snap-type: x mandatory"));
});

test("64. obvezna vprašanja blokirajo nadaljevanje in niso vezana na fiksno število", function () {
  var prviHtml = fs.readFileSync(path.join(root, "..", "app", "neplacila.html"), "utf8");
  var appSrc = fs.readFileSync(path.join(root, "..", "app", "app.js"), "utf8");
  assert.ok(prviHtml.includes('data-opravljeno-obvezno="true"'));
  assert.ok(prviHtml.includes('data-opravljeno-tip="text"'));
  assert.ok(prviHtml.includes('data-opravljeno-tip="evidence"'));
  assert.ok(appSrc.includes("validirajOpravljenoVprasanja"));
  assert.ok(appSrc.includes("opravljenoVprasanjaStrani.filter"));
  assert.ok(appSrc.includes("if (!(await validirajOpravljenoVprasanja())) return;"));
  assert.ok(appSrc.includes("Pred nadaljevanjem odgovorite na vsa obvezna vprašanja."));
});

test("65. izbira paketa samodejno izbere tudi odvetnika v spodnjem pillu", function () {
  var t = novPlanZKorakom10();
  var idx = t.korak10.index;
  var plan = N.posodobiPaketInOdvetnika(
    t.plan,
    idx,
    { packageId: "lawyer_demand_letter", title: "Odvetnik pošlje opomin", priceCents: 2990 },
    { name: "Odvetnik Jože", officeName: "Pisarna Jože", email: "joze@example.com" },
    "joze_kovac"
  );
  var korak = N.najdiKorak(plan, idx);
  assert.equal(korak.lawyerHandoff.selectedPackage.packageId, "lawyer_demand_letter");
  assert.equal(korak.lawyerHandoff.lawyerId, "joze_kovac");
  assert.equal(korak.lawyerHandoff.lawyerSnapshot.name, "Odvetnik Jože");
  assert.ok(uiSrc.includes("izberiPaketInPrikazanegaOdvetnika"));
  assert.ok(uiSrc.includes("shraniZahtevePrilogIzbranegaOdvetnika(lawyer)"));
});

test("66. pill odvetnika ima desno akcijo za pregled vseh odvetnikov", function () {
  assert.ok(uiSrc.includes("Preglej vse odvetnike"));
  assert.ok(uiSrc.includes("opomin-predaja-sestavljalnik__odvetnik-vsi"));
  assert.ok(stylesSrc.includes(".opomin-predaja-sestavljalnik__odvetnik-vsi"));
  assert.ok(uiSrc.includes('marketplaceTrigger.click()'));
});

test("67. končni pregled omogoča neposredno urejanje celotnega sporočila", function () {
  assert.ok(uiSrc.includes('id="opomin-predaja-pregled-sporocilo"'));
  assert.ok(!uiSrc.includes('id="opomin-predaja-pregled-uredi-sporocilo"'));
  assert.ok(uiSrc.includes('id="opomin-predaja-pregled-sporocilo-akcije" hidden'));
  assert.ok(uiSrc.includes('id="opomin-predaja-pregled-sporocilo-vrni"'));
  assert.ok(uiSrc.includes('id="opomin-predaja-pregled-sporocilo-shrani"'));
  assert.ok(uiSrc.includes("pregledSporociloEl.value = pregledSporociloPrejsnjaVrednost"));
  assert.ok(uiSrc.includes("skrijPregledSporociloAkcije()"));
  assert.ok(!uiSrc.includes("pregledSporociloTimer = setTimeout(shraniPregledSporocilo, 700)"));
  assert.ok(!uiSrc.includes('pregledSporociloEl.addEventListener("blur", shraniPregledSporocilo)'));
  assert.ok(uiSrc.includes("prilagodiVisinoPregledSporocila"));
  assert.ok(uiSrc.includes("shraniPregledSporocilo"));
  assert.ok(uiSrc.includes("N.posodobiSporociloOdvetniku(plan, step.index, novoSporocilo, true)"));
  assert.ok(stylesSrc.includes(".opomin-predaja-pregled__sporocilo-akcije[hidden]"));
  assert.ok(stylesSrc.includes("background: var(--teal, #159195)"));
  assert.ok(stylesSrc.includes("overflow-y: hidden"));
  assert.ok(stylesSrc.includes(".opomin-predaja-pregled__casovnica-krog"));
  assert.ok(stylesSrc.includes("background: var(--lp2-coral, #d8655b)"));
});

test("68. potrditvena kljukica ostane klikljiva in osveži paket po spremembah", function () {
  assert.ok(!uiSrc.includes('(jePregled || jeZeDokoncano ? " disabled" : "")'));
  assert.ok(!uiSrc.includes('(jeZeDokoncano ? " disabled" : "")'));
  assert.ok(uiSrc.includes("if (checkboxEl.checked && jePregled)"));
  assert.ok(uiSrc.includes("preverjenoZaOsvezitev.ok"));
  assert.ok(stylesSrc.includes("touch-action: manipulation"));
  assert.ok(stylesSrc.includes("accent-color: var(--teal, #159195)"));
});

test("69. widget naslednjega koraka je kompaktnejši brez odstranitve vsebine", function () {
  assert.ok(stylesSrc.includes("min-height: 232px"));
  assert.ok(stylesSrc.includes("min-height: 112px"));
  assert.ok(stylesSrc.includes("width: 54px"));
  assert.ok(uiSrc.includes("Izberite naslednji korak"));
  assert.ok(uiSrc.includes('id="lp-paket-carousel"'));
});

test("70. kartice se začnejo višje brez povezave Zakaj priporočamo", function () {
  assert.ok(!uiSrc.includes('id="lp-zakaj-priporocamo"'));
  assert.ok(!uiSrc.includes(">Zakaj priporočamo?</button>"));
  assert.ok(!uiSrc.includes('<p class="lp-kaj-se-bo-zgodilo__opis">'));
  assert.ok(stylesSrc.includes("padding: 13px 18px 9px"));
  assert.ok(stylesSrc.includes("margin-bottom: 2px"));
});

test("71. spodnje opozorilo je odstranjeno in prostor zaprt", function () {
  assert.ok(!uiSrc.includes("Brez vaše potrditve se odvetniku nič ne pošlje."));
  assert.ok(!uiSrc.includes('class="lp-kaj-se-bo-zgodilo__varnost"'));
  assert.ok(!stylesSrc.includes(".lp-kaj-se-bo-zgodilo__varnost {"));
  assert.ok(stylesSrc.includes("min-height: 112px"));
});

/* NAPOTEK (Faza 8): stari test 72 je preverjal vizualni blok "Pred
   potrditvijo" (mreža Prejemnik/Predaja/Strošek/Dokumenti). Ta blok je bil po
   novi, potrjeni specifikaciji NAMENOMA odstranjen iz končnega renderja (glej
   htmlPredajaGumbi/izrisiPotrditevPredajeOdvetniku) - validacijska logika
   (dokumentiPopolni, canonical preveriPogojeZaPripravoPredaje) je ostala,
   spremenila se je le vidna predstavitev. Test je zato posodobljen, da
   preverja odsotnost STAREGA vizualnega bloka in prisotnost NOVE kartice
   "Končna cena", namesto da bi zahteval regresijo nazaj na star dizajn. */
test("72. \"Pred potrditvijo\" mreža je odstranjena, nadomešča jo kartica \"Končna cena\"", function () {
  assert.ok(!uiSrc.includes("opomin-predaja-pregled__pred-potrditev"));
  assert.ok(!uiSrc.includes('<h3 class="opomin-predaja-pregled__pred-potrditev-naslov">Pred potrditvijo</h3>'));
  assert.ok(uiSrc.includes("opomin-predaja-pregled__cena"));
  assert.ok(uiSrc.includes("Končna cena"));
  assert.ok(uiSrc.includes("Plačate samo izbrane pakete."));
  assert.ok(uiSrc.includes("N.povzetekCenePredaje(snap.izbraniPaket)"));
});

test("73. paket ima gumb \"Preglej paket\" v turkizni barvi, brez ločenega gumba Spremeni", function () {
  assert.ok(uiSrc.includes("opomin-predaja-pregled__paket-zgoraj"));
  assert.ok(uiSrc.includes("opomin-predaja-pregled__paket-akcije"));
  assert.ok(uiSrc.includes("opomin-predaja-pregled__paket-preglej"));
  assert.ok(uiSrc.includes("Preglej paket"));
  assert.ok(uiSrc.includes('id="opomin-predaja-pregled-poglej-paket"'));
  assert.ok(!uiSrc.includes('id="opomin-predaja-pregled-spremeni-odvetnika"'));
  assert.ok(uiSrc.includes('id="opomin-predaja-pregled-odvetnik-podrobno">Podrobno</button>'));
});

test("74. brez priloženega računa in zahtevanih dokazil ni prehoda na potrditev", function () {
  var t = pripravljenPlan();
  var invoice = N.najdiKorak(t.plan, t.idx).lawyerHandoff.documents.find(function (d) {
    return d.type === "invoice";
  });
  var plan = N.odstraniDokumentOdvetniku(t.plan, t.idx, invoice.id);
  plan = N.posodobiOdvetnika(plan, t.idx, {
    name: "Ana Kovač",
    officeName: "Odvetniška pisarna Novak",
    attachmentRequirements: {
      contract: { required: true },
      work_evidence: { required: true },
    },
  });
  var preverjeno = N.preveriPogojeZaPripravoPredaje(plan, t.idx, k1(), []);
  assert.equal(preverjeno.ok, false);
  assert.ok(preverjeno.manjkajoce.includes("Priložen račun"));
  assert.ok(preverjeno.manjkajoce.includes("Pogodba ali ponudba"));
  assert.ok(preverjeno.manjkajoce.includes("Dokazilo opravljenega dela"));
  plan = N.pripraviPredajoOdvetniku(plan, t.idx, k1(), []);
  assert.equal(N.najdiKorak(plan, t.idx).lawyerHandoff.preparedSnapshot, null);
});

test("74a. dokazilo iz 1. koraka omogoči prehod na končni pregled", function () {
  var t = pripravljenPlan();
  var plan = N.posodobiOdvetnika(t.plan, t.idx, {
    name: "Ana Kovač",
    officeName: "Odvetniška pisarna Novak",
    attachmentRequirements: {
      work_evidence: { required: true },
    },
  });
  var podatki = Object.assign({}, k1(), {
    opravljenoDatotekePoti: ["u/dokazilo-opravljenega-dela.jpg"],
    opravljenoAttachmentMeta: [{
      id: "dokazilo-korak-1",
      originalFileName: "opravljeno-delo.jpg",
      mimeType: "image/jpeg",
      description: "Fotografija prikazuje opravljeno delo.",
      descriptionRequired: true,
    }],
  });
  var preverjeno = N.preveriPogojeZaPripravoPredaje(plan, t.idx, podatki, []);
  assert.equal(preverjeno.ok, true);
  assert.ok(!preverjeno.manjkajoce.includes("Dokazilo opravljenega dela"));
});

test("74b. obvezen opis brez slike iz 1. koraka šteje kot dokazilo", function () {
  var t = pripravljenPlan();
  var plan = N.posodobiOdvetnika(t.plan, t.idx, {
    name: "Ana Kovač",
    officeName: "Odvetniška pisarna Novak",
    attachmentRequirements: {
      work_evidence: { required: true },
    },
  });
  var podatki = Object.assign({}, k1(), {
    opravljenoBrezSlike: [{
      id: "opis-brez-slike-1",
      originalFileName: "Opis opravljenega dela",
      descriptionQuestion: "Opišite opravljeno delo.",
      description: "Delo je bilo izvedeno in predano naročniku.",
      textOnly: true,
    }],
  });
  var preverjeno = N.preveriPogojeZaPripravoPredaje(plan, t.idx, podatki, []);
  assert.equal(preverjeno.ok, true);
  assert.ok(!preverjeno.manjkajoce.includes("Dokazilo opravljenega dela"));
});

test("75. dokumentno okno ima jasna gumba Prekliči in Shrani brez X", function () {
  assert.ok(uiSrc.includes('id="opomin-predaja-kategorija-dokumenti-sheet-shrani"'));
  assert.ok(uiSrc.includes('id="opomin-predaja-kategorija-dokumenti-sheet-preklici"'));
  assert.ok(!uiSrc.includes('id="opomin-predaja-kategorija-dokumenti-sheet-zapri"'));
  assert.ok(uiSrc.includes("el._osnutekPredOdprtjem"));
  assert.ok(uiSrc.includes("function prekliciInZapri()"));
  assert.ok(uiSrc.includes("function shraniInZapri()"));
  assert.ok(uiSrc.includes("plan = osnutek.plan"));
  assert.ok(uiSrc.includes('"click",\n        prekliciInZapri'));
  assert.ok(uiSrc.includes('"click",\n        shraniInZapri'));
  assert.ok(stylesSrc.includes(".opomin-predaja-kategorija-dok__shrani"));
  assert.ok(stylesSrc.includes(".opomin-predaja-kategorija-dok__preklici"));
});

/* ==========================================================================
   Faza 8 – nov končni pregled "Predaja odvetniku" po potrjenem mockupu.
   ========================================================================== */

function dolociBarvniNivoTest(pozicija, steviloKorakov) {
  var skupaj = Math.max(1, Number(steviloKorakov) || 1);
  var mesto = Math.max(0, Math.min(skupaj - 1, Number(pozicija) || 0));
  if (skupaj === 1) return 1;
  return Math.round((mesto * 8) / (skupaj - 1)) + 1;
}

test("76. dolociBarvniNivo(0, 4) === 1", function () {
  assert.equal(dolociBarvniNivoTest(0, 4), 1);
});

test("77. dolociBarvniNivo(1, 4) === 4", function () {
  assert.equal(dolociBarvniNivoTest(1, 4), 4);
});

test("78. dolociBarvniNivo(2, 4) === 6", function () {
  assert.equal(dolociBarvniNivoTest(2, 4), 6);
});

test("79. dolociBarvniNivo(3, 4) === 9", function () {
  assert.equal(dolociBarvniNivoTest(3, 4), 9);
});

test("80. prihodnja časovnica uporablja dinamični dolociBarvniNivo, ne statične barve", function () {
  assert.ok(uiSrc.includes("dolociBarvniNivo(i, steviloSamodejnihKorakov)"));
  assert.ok(uiSrc.includes('"opomin-nacrt__stage--eskalacija-" + barvniNivo'));
});

test("81. ročni korak \"Predaja odvetniku\" dobi opomin-nacrt__stage--predaja in je vedno zadnji", function () {
  assert.ok(uiSrc.includes('"opomin-nacrt__stage--predaja"'));
  assert.ok(uiSrc.includes("steviloSamodejnihKorakov + 1"));
  assert.ok(uiSrc.includes('"Predaja odvetniku"'));
});

test("82. izključeni koraki niso v prihodnji časovnici – vir je izključno snap.zgodovinaOpominov", function () {
  assert.ok(uiSrc.includes("var zgodovina = snap.zgodovinaOpominov || [];"));
  assert.ok(uiSrc.includes("zgodovina.map(function (z, i)"));
});

test("83. vsaka kartica prihodnje časovnice ima affordance \"Preglej →\"", function () {
  assert.ok(uiSrc.includes('opomin-predaja-pregled__prihodnji-preglej">Preglej →'));
});

test("84. avtomatske kartice dobijo dinamični barvni razred, ročna kartica --predaja", function () {
  var idx = uiSrc.indexOf("var prihodnjeVrsticeDeli = zgodovina.map");
  assert.ok(idx >= 0);
  var blok = uiSrc.slice(idx, idx + 900);
  assert.ok(blok.includes("dolociBarvniNivo"));
  var idxRocni = uiSrc.indexOf("var rocniKorakVrstica = htmlPredajaPrihodnjaVrstica");
  assert.ok(idxRocni >= 0);
  var blokRocni = uiSrc.slice(idxRocni, idxRocni + 400);
  assert.ok(blokRocni.includes('"opomin-nacrt__stage--predaja"'));
});

test("85. \"Podrobno\" odpre read-only profil odvetnika, ne izbiro odvetnika", function () {
  assert.ok(uiSrc.includes("function odpriPredajaOdvetnikPodrobnoSheet(odv)"));
  assert.ok(uiSrc.includes('id="opomin-predaja-pregled-odvetnik-podrobno">Podrobno</button>'));
  var idx = uiSrc.indexOf("odvetnikPodrobnoBtn.addEventListener");
  assert.ok(idx >= 0);
  var blok = uiSrc.slice(idx, idx + 200);
  assert.ok(!blok.includes("odpriOdvetnikSheet"));
  assert.ok(!blok.includes("pokaziGlavni"));
});

test("86. \"Možni dnevi predaje\" in \"Čas predaje: Čimprej\" v lawyer bublu končnega pregleda ne obstajata več", function () {
  var idx = uiSrc.indexOf("var odvetnikVrstica =");
  assert.ok(idx >= 0);
  var konec = uiSrc.indexOf("var paketVrstica", idx);
  var blok = uiSrc.slice(idx, konec);
  assert.ok(!blok.includes("Možni dnevi predaje"));
  assert.ok(!blok.includes("Čas predaje: Čimprej"));
  assert.ok(!blok.includes(">Spremeni<"));
  assert.ok(!uiSrc.includes('id="opomin-predaja-pregled-spremeni-odvetnika"'));
});

test("87. \"Preglej paket\" obstaja in odpira odpriPredajaPaketSheet", function () {
  assert.ok(uiSrc.includes("Preglej paket"));
  var idx = uiSrc.indexOf("poglejPaketBtn.addEventListener");
  assert.ok(idx >= 0);
  var blok = uiSrc.slice(idx, idx + 200);
  assert.ok(blok.includes("odpriPredajaPaketSheet(pak)"));
});

test("88. sporočilo ostane textarea in uporablja samodejno rast (scrollHeight, brez fiksnega max-height)", function () {
  assert.ok(uiSrc.includes('id="opomin-predaja-pregled-sporocilo"'));
  assert.ok(uiSrc.includes("function prilagodiVisinoPregledSporocila()"));
  assert.ok(uiSrc.includes("pregledSporociloEl.scrollHeight"));
  var idxCss = stylesSrc.indexOf(".opomin-predaja-pregled__sporocilo-besedilo {");
  assert.ok(idxCss >= 0);
  var konecCss = stylesSrc.indexOf("\n}", idxCss);
  var blokCss = stylesSrc.slice(idxCss, konecCss);
  assert.ok(!blokCss.includes("max-height"));
  assert.ok(!blokCss.includes("overflow-y: auto"));
});

test("89. navaden paket da eno cenovno postavko", function () {
  var enostaven = N.povzetekCenePredaje({
    packageId: "x",
    titleSnapshot: "Odvetnik pošlje opomin",
    priceCents: 2990,
  });
  assert.equal(enostaven.postavke.length, 1);
  assert.equal(enostaven.znaniSkupajCents, 2990);
  assert.equal(enostaven.imaCenoPoPonudbi, false);
});

test("90. paket po meri da več cenovnih postavk, cene se seštejejo iz priceCents", function () {
  var poMeri = N.povzetekCenePredaje({
    packageId: "custom_lawyer_services",
    services: [
      { serviceId: "a", titleSnapshot: "Odvetnik pošlje opomin", priceCents: 2990 },
      { serviceId: "b", titleSnapshot: "Pregled dokumentacije", priceCents: 1990 },
    ],
  });
  assert.equal(poMeri.postavke.length, 2);
  assert.equal(poMeri.znaniSkupajCents, 4980);
});

test("91. postavka po ponudbi se ne prišteje kot 0 in pravilno označi total", function () {
  var mesano = N.povzetekCenePredaje({
    packageId: "custom_lawyer_services",
    services: [
      { serviceId: "a", titleSnapshot: "Odvetnik pošlje opomin", priceCents: 2990 },
      { serviceId: "b", titleSnapshot: "Pravni postopek", priceCents: null },
    ],
  });
  assert.equal(mesano.imaCenoPoPonudbi, true);
  assert.equal(mesano.znaniSkupajCents, 2990);

  var samoPonudba = N.povzetekCenePredaje({
    packageId: "custom_lawyer_services",
    services: [{ serviceId: "a", titleSnapshot: "Pravni postopek", priceCents: null }],
  });
  assert.equal(samoPonudba.znaniSkupajCents, 0);
  assert.equal(samoPonudba.imaCenoPoPonudbi, true);
});

test("92. cena 0 se prikaže kot \"Vključeno\"", function () {
  assert.equal(N.povzetekCenePredaje({ packageId: "x", titleSnapshot: "Brezplačno", priceCents: 0 }).postavke[0].priceCents, 0);
  assert.ok(uiSrc.includes('if (p.priceCents === 0) return "Vključeno";'));
});

test("93. CTA ima besedilo \"Potrdi oddajo\" in ne staro besedilo", function () {
  assert.ok(uiSrc.includes('"Potrdi oddajo →"'));
  assert.ok(!uiSrc.includes('"Dokončaj načrt in pripravi paket →"'));
});

test("93a. pripravljen paket omogoči nadaljevanje in aktivacijo načrta", function () {
  assert.ok(uiSrc.includes('(jeZeDokoncano ? "Nadaljuj →" : "Potrdi oddajo →")'));
  assert.ok(uiSrc.includes('glavniGumb.disabled = zaposleno || !N.soVsiSmsPotrjeni(plan);'));
  assert.ok(uiSrc.includes('glavniGumb.textContent = "Aktiviram načrt …";'));
  assert.ok(uiSrc.includes('if (N.soVsiSmsPotrjeni(plan)) {'));
});

test("94. CTA še vedno kliče N.dokoncajRocnoPredajoNacrta in nikoli N.izvediPredajoOdvetniku", function () {
  var idx = uiSrc.indexOf('glavniGumb.addEventListener("click"');
  assert.ok(idx >= 0);
  var blok = uiSrc.slice(idx, idx + 1800);
  assert.ok(blok.includes("N.potrdiCelotenNacrtZaOddajo(plan, step.index)"));
  assert.ok(!blok.includes("N.izvediPredajoOdvetniku"));
});

test("95. brez checkboxa/manjkajočimi dokumenti CTA ostane disabled (canonical validacija)", function () {
  var idx = uiSrc.indexOf("function osveziGlavniGumb");
  assert.ok(idx >= 0);
  var blok = uiSrc.slice(idx, idx + 700);
  assert.ok(!blok.includes("!dokumentiPopolni"));
  assert.ok(blok.includes("checkboxEl.checked"));
  assert.ok(blok.includes("!N.moznaPredajaOdvetniku(lh)"));
});

test("96. ponoven klik med izvajanjem ne izvede dvojnega zaključka", function () {
  var idx = uiSrc.indexOf('glavniGumb.addEventListener("click"');
  assert.ok(idx >= 0);
  var blok = uiSrc.slice(idx, idx + 400);
  assert.ok(blok.includes("if (glavniGumb.disabled || zaposleno) return;"));
});

test("99. izbira paketa ostane vezana na dejansko prikazano kartico", function () {
  assert.ok(uiSrc.includes('aktivnaKartica.getAttribute("data-paket-id")'));
  assert.ok(uiSrc.includes('kartica.getAttribute("data-paket-id") === aktivenId'));
  assert.ok(!uiSrc.includes("var pkg = paketiZaCarousel()[aktivna];"));
  assert.ok(uiSrc.includes("if (dejanskoIzbranId !== pkg.id)"));
});

test("100. proces po potrditvi ima enaka razmerja in samodejno manjša daljše besedilo", function () {
  assert.ok(
    stylesSrc.includes(
      "grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr) 12px minmax(0, 1fr);"
    )
  );
  assert.ok(stylesSrc.includes("grid-template-rows: 38px 28px 22px;"));
  assert.ok(stylesSrc.includes("left: calc(50% - 24px);"));
  assert.ok(uiSrc.includes('data-pregled-auto-fit="block" data-min-font="8"'));
  assert.ok(uiSrc.includes('data-pregled-auto-fit="block" data-min-font="7.5"'));
  assert.ok(
    uiSrc.includes('[data-prihodnji-auto-fit], [data-pregled-auto-fit]')
  );
});

test("101. končna oddaja ne potrdi neizpolnjenih prejšnjih kartic", function () {
  var t = pripravljenPlan();
  var plan = N.pripraviPredajoOdvetniku(t.plan, t.idx, k1(), []);
  assert.equal(N.soVsiSmsPotrjeni(plan), false);
  plan = N.potrdiCelotenNacrtZaOddajo(plan, t.idx);
  assert.equal(
    N.najdiKorak(plan, t.idx).status,
    "draft"
  );
  assert.ok(N.prviNepotrjenPredZadnjimKorakom(plan, t.idx));
  plan.steps.forEach(function (step) {
    if (!step.isExcluded && step.kind !== "manual_lawyer") {
      N.potrdiKorak(plan, step.index, step.finalMessage || step.generatedMessage);
    }
  });
  assert.equal(N.prviNepotrjenPredZadnjimKorakom(plan, t.idx), null);
  plan = N.potrdiCelotenNacrtZaOddajo(plan, t.idx);
  assert.ok(N.najdiKorak(plan, t.idx).lawyerHandoff.manualHandoffAcknowledgedAt);
  assert.equal(N.soVsiSmsPotrjeni(plan), true);
});

test("102. obnovljen že aktiviran načrt lahko dokonča zadnji pripravljeni korak", function () {
  var t = pripravljenPlan();
  var plan = N.pripraviPredajoOdvetniku(t.plan, t.idx, k1(), []);
  plan.steps.forEach(function (step) {
    if (!step.isExcluded && step.kind !== "manual_lawyer") {
      step.status = "confirmed";
    }
  });
  plan.status = "activated";
  assert.equal(N.soVsiSmsPotrjeni(plan), false);
  plan = N.potrdiCelotenNacrtZaOddajo(plan, t.idx);
  assert.equal(N.najdiKorak(plan, t.idx).status, "confirmed");
  assert.equal(N.soVsiSmsPotrjeni(plan), true);
});

test("103. izključena kartica ne zaklene zadnjega koraka", function () {
  var t = novPlanZKorakom10();
  t.plan.steps.forEach(function (step) {
    if (step.kind !== "manual_lawyer") {
      step.status = "confirmed";
    }
  });
  t.plan.steps[4].status = "draft";
  t.plan.steps[4].isExcluded = true;
  assert.equal(
    N.prviNepotrjenPredZadnjimKorakom(t.plan, t.korak10.index),
    null
  );
});

test("104. UI zaklene zadnjo kartico in ob kliku pokaže manjkajoči korak", function () {
  assert.ok(uiSrc.includes("opomin-nacrt__stage--zaklenjen"));
  assert.match(
    uiSrc,
    /if \(blokirajociKorak\) \{[\s\S]{0,900}opts\.potrdiVprasanje\(\{[\s\S]{0,350}naslov: "Zadnji korak še ni na voljo"[\s\S]{0,500}potrdiBesedilo: "V redu"[\s\S]{0,120}samoEnGumb: true/
  );
  var zaklepKlikBlok = uiSrc.match(/if \(blokirajociKorak\) \{[\s\S]{0,1200}?return;\s*\}/);
  assert.ok(zaklepKlikBlok, "klik zaklenjene zadnje kartice mora imeti svoj opozorilni blok");
  assert.ok(!zaklepKlikBlok[0].includes("opts.pokaziNapako"), "opozorilo ne sme več v zgornjo vrstico");
  assert.ok(stylesSrc.includes(".opomin-nacrt__stage--zaklenjen"));
});

test("105. povzetek nastavitev prvih devetih kartic je 30 % nižji, predaja pa ostane nespremenjena", function () {
  assert.ok(uiSrc.includes('(jeManual ? "" : " opomin-nacrt-potrdi__readonly--kompakt")'));
  assert.match(
    stylesSrc,
    /\.opomin-nacrt-potrdi__readonly--kompakt[\s\S]{0,180}\.opomin-nacrt-potrdi__readonly-postavka[\s\S]{0,180}height: 48px;[\s\S]{0,80}min-height: 48px;/
  );
  assert.ok(uiSrc.includes("prilagodiKompaktneNastavitve"));
  assert.ok(uiSrc.includes('var najmanjsa = 9.5'));
});

test("106. prehod na 9. kartico premakne samo karusel in ne zamakne celotne strani", function () {
  assert.ok(uiSrc.includes("function poravnajKarticoVKaruselu(index, behavior)"));
  assert.ok(uiSrc.includes('karusel.scrollTo({ left: cilj, top: 0'));
  assert.ok(uiSrc.includes('poravnajKarticoVKaruselu(aktivenIndex, "smooth")'));
  assert.ok(!uiSrc.includes('naslednjaKartica.scrollIntoView'));
  assert.ok(uiSrc.includes('window.scrollTo({ top: 0, left: 0, behavior: "smooth" })'));
});

test("107. obvestilo za naslednjo potrditev uporablja odobreno kompaktno postavitev", function () {
  assert.ok(uiSrc.includes("opomin-nacrt-potrdi__obvestilo-glava"));
  assert.ok(uiSrc.includes("opomin-nacrt-potrdi__obvestilo-korak"));
  assert.ok(uiSrc.includes("opomin-nacrt-potrdi__obvestilo-pika"));
  assert.ok(uiSrc.includes("prilagodiKompaktnoObvestilo"));
  assert.match(stylesSrc, /\.opomin-nacrt-potrdi__obvestilo-naslov[\s\S]{0,180}height: 34px;/);
  assert.match(stylesSrc, /\.opomin-nacrt-potrdi__obvestilo-opis[\s\S]{0,180}height: 26px;/);
});

test("108. obvestilo in nastavitve vseh samodejnih kartic so en zložen element", function () {
  assert.ok(uiSrc.includes("opomin-nacrt-potrdi__zlozen-povzetek"));
  assert.ok(uiSrc.includes("zlozenPovzetekHtml"));
  assert.match(stylesSrc, /\.opomin-nacrt-potrdi__zlozen-povzetek[\s\S]{0,140}gap: 0;/);
  assert.match(stylesSrc, /\.opomin-nacrt-potrdi__zlozen-povzetek[\s\S]{0,900}margin-top: -11px;/);
  assert.match(stylesSrc, /\.opomin-nacrt-potrdi__zlozen-povzetek[\s\S]{0,420}box-shadow:/);
  assert.match(stylesSrc, /\.opomin-nacrt-potrdi__readonly--kompakt[\s\S]{0,220}border-radius: 0 0 14px 14px;/);
  assert.match(stylesSrc, /\.opomin-nacrt-potrdi__readonly--kompakt[\s\S]{0,650}background: rgba\(255, 255, 255, 0\.52\);/);
  assert.match(stylesSrc, /\.opomin-nacrt-potrdi__obvestilo--barvno\s*\{[\s\S]{0,160}background: var\(--stage-tint\);/);
});

test("109. male kartice imajo prvotno časovno hierarhijo iz referenčne zasnove", function () {
  assert.match(uiSrc, /class="opomin-nacrt__stage-cas-vrh"[\s\S]{0,260}class="opomin-nacrt__stage-cas-crta"[\s\S]{0,220}class="opomin-nacrt__stage-cas-dno"[\s\S]{0,260}class="opomin-nacrt__stage-cas-dan-datum"/);
  assert.match(uiSrc, /var dnevi = \["Ned", "Pon", "Tor", "Sre", "Čet", "Pet", "Sob"\]/);
  assert.match(stylesSrc, /\.opomin-nacrt__stage-cas\s*\{[\s\S]{0,260}min-height: 43px;[\s\S]{0,180}align-items: flex-start;/);
  assert.match(stylesSrc, /\.opomin-nacrt__stage-cas-dan-datum\s*\{[\s\S]{0,220}justify-content: space-between;/);
});

test("110. dodatki so na 3. koraku pod SMS-oknom in uporabljajo obstoječe akcije", function () {
  const smsOkno = uiSrc.indexOf('class="sms-preview__okno"');
  const dodatki = uiSrc.indexOf('class="opomin-sporocilo-dodatki"');
  assert.ok(smsOkno >= 0 && dodatki > smsOkno, "dodatki morajo biti pod SMS-oknom");
  assert.match(uiSrc, /htmlAddonKartica\(\{[\s\S]{0,220}akcija: "rok"/);
  assert.match(uiSrc, /htmlAddonKartica\(\{[\s\S]{0,260}akcija: "obrocno"/);
  assert.match(uiSrc, /htmlAddonKartica\(\{[\s\S]{0,220}akcija: "trr"/);
  assert.doesNotMatch(uiSrc, /vklopljeno: (?:rokAktiven|obrocAktiven|trrAktiven)/);
  assert.doesNotMatch(uiSrc, /class="step-addons-list"/);
  assert.match(stylesSrc, /\.opomin-sporocilo-dodatki\s*\{[\s\S]{0,180}margin-top: 12px/);
  assert.match(sporociloHtmlSrc, /aria-labelledby="dodatki-naslov" hidden aria-hidden="true"/);
});

test("111. obrocno placilo ob odprtju vedno pokaze spodnja gumba", function () {
  assert.match(obrocnoSrc, /sheet\.classList\.remove\("obrocno-sheet--ureja-znesek"\);[\s\S]{0,160}editAkcije\.hidden = true;[\s\S]{0,100}nogaGlobal\.hidden = false;/);
  assert.match(stylesSrc, /\.obrocno-sheet \.rok-sheet__noga\s*\{[\s\S]{0,180}grid-row: 3;[\s\S]{0,100}display: block;/);
});

test("112. postopek ima samo Dolznika in Posiljanje, sporocilo pa ostane varno izklopljeno", function () {
  assert.match(appSrc, /const KORAK_SPOROCILO_VKLJUCEN = false;/);
  assert.match(appSrc, /function zagotoviPodatkeSporocilaZaPosiljanje/);
  assert.match(appSrc, /zagotoviPodatkeSporocilaZaPosiljanje\(noviKorak1\);[\s\S]{0,100}prehodNaStran\("neplacila-posiljanje\.html"\)/);
  assert.doesNotMatch(dolznikHtmlSrc, /data-korak="3"|>Sporočilo<|od 3:/);
  assert.doesNotMatch(posiljanjeHtmlSrc, /data-korak="3"|>Sporočilo<|od 3:/);
  assert.match(stylesSrc, /\.debt-stepper\s*\{[\s\S]{0,520}grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test("113. komentar racuna se shrani, skrči in prikaze tudi na Posiljanju", function () {
  assert.match(appSrc, /collapsed: Boolean\(metaArr\[i\] && metaArr\[i\]\.collapsed\)/);
  assert.match(appSrc, /racun-posiljanje__opis-gumb--izbrisi/);
  assert.match(appSrc, /racun-posiljanje__opis-gumb--shrani/);
  assert.match(appSrc, /priloga\.collapsed = true;[\s\S]{0,120}syncPrilogeVSejoKorak1\(\);[\s\S]{0,100}izrisiIzbranePriloge\(\);/);
  assert.match(uiSrc, /var komentar = String\(p\.description \|\| ""\)\.trim\(\);/);
  assert.match(uiSrc, /vk-racun-kartica__komentar-besedilo/);
  assert.match(stylesSrc, /\.racun-posiljanje__opis-priloge--urejanje \.racun-posiljanje__opis-akcije/);
  assert.match(appSrc, /datotekaVrstica\.className = "racun-posiljanje__datoteka-vrstica"/);
  assert.match(stylesSrc, /#obrazec-neplacilo \.racun-posiljanje__kartica\s*\{[\s\S]{0,260}overflow: hidden;[\s\S]{0,180}border: 1px solid/);
  assert.match(stylesSrc, /#obrazec-neplacilo \.racun-posiljanje__datoteka-vrstica::after\s*\{[\s\S]{0,420}linear-gradient\([\s\S]{0,180}rgba\(226, 236, 234, 0\) 100%/);
  assert.match(stylesSrc, /#obrazec-neplacilo \.racun-posiljanje--kompaktno \.racun-posiljanje__vrstica\s*\{[\s\S]{0,120}padding-inline: 0;/);
  assert.match(stylesSrc, /#obrazec-neplacilo \.racun-posiljanje--kompaktno \.racun-posiljanje__seznam:not\(:empty\)\s*\{[\s\S]{0,100}padding: 0 0 8px;/);
  assert.match(stylesSrc, /\.vk-racun-kartica__komentar\s*\{/);
});

test("114. zgornja obvestilna kartica ima faded poudarek samo na levem in zgornjem robu", function () {
  assert.match(stylesSrc, /\.opomin-nacrt-potrdi__obvestilo--barvno::before,[\s\S]{0,100}\.opomin-nacrt-potrdi__obvestilo--barvno::after/);
  assert.match(stylesSrc, /\.opomin-nacrt-potrdi__obvestilo--barvno::before\s*\{[\s\S]{0,180}border-top: 2px solid var\(--stage-accent-strong\);[\s\S]{0,100}border-left: 2px solid var\(--stage-accent-strong\);[\s\S]{0,80}border-radius: inherit;/);
  assert.match(stylesSrc, /\.opomin-nacrt-potrdi__obvestilo--barvno::after\s*\{[\s\S]{0,520}90deg[\s\S]{0,520}180deg/);
});

console.log("\n  Uspešnih: " + passed + "/115");
console.log("Sestavljalnik \"Predaja odvetniku\": vsi testi uspešni\n");
