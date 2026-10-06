/* ==========================================================
   scripts/test-promet-napoved.js — testi napovedi prometa.
   Poganja: node scripts/test-promet-napoved.js
   Brez omrežja: zunanji viri so podani kot posnetki odgovorov.
   ========================================================== */
"use strict";

var path = require("path");
var promet = require("../api/_lib/promet");

var OK = 0;
var FAIL = 0;
function assert(pogoj, opis) { if (pogoj) OK++; else { console.error("  ✗ NEUSPEŠNO: " + opis); FAIL++; } }
function section(ime) { console.log("\n" + ime); }
function fixture(ime) { return require(path.join(__dirname, "fixtures", "promet", ime)); }

var KOLEDAR_SI = {
  prazniki: [{ startDate: "2026-10-31", endDate: "2026-10-31", nationwide: true, subdivisions: [] }],
  solskePocitnice: [{ startDate: "2026-10-26", endDate: "2026-10-30", nationwide: true, subdivisions: [] }]
};
var KOLEDAR_DE = {
  prazniki: [{ startDate: "2026-10-03", endDate: "2026-10-03", nationwide: true, subdivisions: [] }],
  solskePocitnice: [{ startDate: "2026-11-02", endDate: "2026-11-06", nationwide: false, subdivisions: [{ code: "DE-BY" }] }]
};

section("Tip dneva");
var td = promet.tipDneva.tipDneva;
assert(td("2026-10-07", KOLEDAR_SI) === "delavnik", "sreda je delavnik");
assert(td("2026-10-09", KOLEDAR_SI) === "petek", "petek");
assert(td("2026-10-10", KOLEDAR_SI) === "sobota", "sobota");
assert(td("2026-10-11", KOLEDAR_SI) === "nedelja_praznik", "nedelja");
assert(td("2026-10-31", KOLEDAR_SI) === "nedelja_praznik", "dan reformacije (sobota + praznik) je praznik");
assert(td("2026-10-27", KOLEDAR_SI) === "pocitnice_delavnik", "jesenske počitnice SI");
assert(td("2026-10-30", KOLEDAR_SI) === "pocitnice_delavnik", "petek med počitnicami = počitnice");
assert(td("2026-11-03", KOLEDAR_DE, "DE-BY") === "pocitnice_delavnik", "bavarske počitnice za DE-BY");
assert(td("2026-11-03", KOLEDAR_DE, "DE-NW") === "delavnik", "bavarske počitnice ne veljajo za NRW");
assert(td("2026-11-03", KOLEDAR_DE) === "delavnik", "regionalne počitnice brez regije ne veljajo");
var napacen = false;
try { td("2026-13-40", KOLEDAR_SI); } catch (_) { napacen = true; }
assert(napacen, "neveljaven datum vrže napako");

section("Celice in odseki poti");
var c = promet.celice;
assert(c.celica(46.05, 14.5) === c.celica(46.051, 14.501), "bližnji točki sta v isti celici");
assert(c.celica(46.05, 14.5) !== c.celica(46.09, 14.5), "4 km severneje je druga celica");
assert(c.celica("x", 1) === null && c.celica(100, 0) === null, "neveljavne koordinate -> null");
var potLjMb = { trajanjeProstoS: 3600, tocke: [{ lat: 46.0569, lon: 14.5058 }, { lat: 46.2, lon: 14.9 }, { lat: 46.35, lon: 15.3 }, { lat: 46.5547, lon: 15.6459 }] };
var odseki = c.odsekiPoCelicah(potLjMb.tocke, potLjMb.trajanjeProstoS);
var vsota = odseki.reduce(function (s, o) { return s + o.trajanjeProstoS; }, 0);
assert(odseki.length >= 3, "pot ima več odsekov");
assert(Math.abs(vsota - 3600) < 0.001, "vsota časov odsekov = čas prostega toka");
assert(c.odsekiPoCelicah([{ lat: 46, lon: 14 }], 100).length === 0, "ena točka ni pot");

section("Vir: Autobahn API");
var ab = promet.viri.autobahn.razcleniOpozorila("A9", fixture("autobahn-a9-warning.json"));
assert(ab.length >= 2, "zastoj W1 se razporedi po več celicah");
assert(ab.every(function (o) { return o.zunanjiId === "W1"; }), "nevarnost brez zastoja (W2) in prihodnji (W3) sta izločena");
var abVsota = ab.reduce(function (s, o) { return s + o.zamudaS; }, 0);
assert(Math.abs(abVsota - 720) <= ab.length, "12 min zamude se razdeli, ne podvoji");
assert(ab[0].drzava === "DE" && ab[0].hitrostKmh === 8, "država in hitrost");
var abNapaka = false;
try { promet.viri.autobahn.razcleniOpozorila("A9", { napaka: true }); } catch (e) { abNapaka = e.code === "ZUNANJI_VIR"; }
assert(abNapaka, "nepričakovan odgovor je napaka zunanjega vira, ne prazen rezultat");

section("Vir: DARS promet.si");
var d = promet.viri.dars.razcleniDogodke(fixture("dars-dogodki.json"));
assert(d.opazovanja.length === 2, "dva zastoja (D1, D3)");
var d1 = d.opazovanja.find(function (o) { return o.zunanjiId === "D1"; });
assert(d1 && d1.zamudaS === 900, "razpon 10-15 min -> zgornja meja 15 min");
assert(d1 && d1.celica === c.celica(46.0477, 14.509), "D96/TM koordinate so pretvorjene v WGS84 (Ljubljana)");
var d3 = d.opazovanja.find(function (o) { return o.zunanjiId === "D3"; });
assert(d3 && d3.zamudaS === null, "zastoj brez navedene zamude ima null (ne 0)");
assert(d.dogodki.length === 1 && d.dogodki[0].tip === "dela", "delovna zapora je dogodek 'dela'");
assert(!d.dogodki.some(function (x) { return x.zunanjiId === "D4"; }), "veter ni prometni zastoj");
var dt = promet.viri.dars.d96tmVWgs84(500000, -5000000);
assert(Math.abs(dt.lon - 15) < 1e-9 && Math.abs(dt.lat) < 0.01, "D96/TM izhodišče: lon0 = 15°");
assert(promet.viri.dars.zamudaIzBesedila("čakalna doba približno 1 uro") === 60, "1 uro -> 60 min");
assert(promet.viri.dars.zamudaIzBesedila("brez podatka") === null, "brez podatka -> null");

section("Profil zastojev");
// 10 sred ob 07:30 (Ljubljana), zastoj v celici X vsako sredo razen dveh.
var celX = c.celica(46.2, 14.9);
var zajemi = [];
var opazovanja = [];
for (var i = 0; i < 10; i++) {
  var dan = new Date(Date.UTC(2026, 7, 5 + 7 * i, 5, 30)); // 07:30 CEST
  var id = "z" + i;
  zajemi.push({ id: id, vir: "dars", cas: dan.toISOString(), uspeh: true });
  if (i >= 2) opazovanja.push({ zajemId: id, vir: "dars", celica: celX, zamudaS: i * 60 });
}
zajemi.push({ id: "pokvarjen", vir: "dars", cas: "2026-08-05T05:31:00Z", uspeh: false });
opazovanja.push({ zajemId: "pokvarjen", vir: "dars", celica: celX, zamudaS: 99999 });
var prof = promet.profil.zgradiProfil(zajemi, opazovanja, { SI: { prazniki: [], solskePocitnice: [] } });
var vr = prof.vrstice.find(function (r) { return r.celica === celX; });
assert(vr && vr.tip_dneva === "delavnik" && vr.interval === 30, "07:30 lokalno -> interval 30");
assert(vr && vr.n_vzorcev === 10, "neuspešen zajem ni štet");
assert(vr && vr.p_zastoja === 0.8, "verjetnost zastoja 8/10");
assert(vr && vr.p85_s === 480, "p85 (nearest rank 9/10, z dvema ničlama) = 480 s");
assert(vr && vr.mediana_s === 240, "mediana (rang 5/10) = 240 s");
var prof2 = promet.profil.zgradiProfil(zajemi.slice().reverse(), opazovanja.slice().reverse(), { SI: { prazniki: [], solskePocitnice: [] } });
assert(JSON.stringify(prof) === JSON.stringify(prof2), "profil je neodvisen od vrstnega reda (determinističen)");
var zamik = promet.profil.zgradiProfil([{ id: "a", vir: "dars", cas: "2026-01-14T06:30:00Z", uspeh: true }], [{ zajemId: "a", vir: "dars", celica: celX, zamudaS: 60 }], {});
assert(zamik.vrstice[0].interval === 30, "pozimi (CET) 06:30Z je 07:30 lokalno");
assert(promet.profil.kvantil([], 0, 0.85) === 0, "brez vzorcev je kvantil 0");

section("Napoved odhoda");
var potX = { trajanjeProstoS: 1800, tocke: [{ lat: 46.15, lon: 14.8 }, { lat: 46.2, lon: 14.9 }, { lat: 46.25, lon: 15.0 }] };
var osnovniVhod = { prihod: "2026-10-07T08:00", drzava: "SI", koledar: KOLEDAR_SI, pot: potX, profil: { vrstice: [], pokritost: [] }, dogodki: [] };
var r0 = promet.napoved.izracunajOdhod(osnovniVhod);
assert(r0.osnova === "zacetna_ocena", "brez meritev -> začetna ocena");
assert(r0.trajanjeVarnoMin === 39, "07:20–08:00 konica 1,3 -> 30 min * 1,3 = 39 min");
assert(r0.priporocenOdhodUra === "07:10", "08:00 − 39 − 10 rezerve = 07:11 -> zaokroženo navzdol 07:10");
assert(r0.opozorilo === false, "9 min dodatka je pod pragom opozorila");
var r0b = promet.napoved.izracunajOdhod(osnovniVhod);
assert(JSON.stringify(r0) === JSON.stringify(r0b), "isti vhod -> isti izhod");

var nocni = promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, { prihod: "2026-10-07T03:00" }));
assert(nocni.trajanjeVarnoMin === 30 && nocni.priporocenOdhodUra === "02:20", "ponoči brez konice");
var nedelja = promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, { prihod: "2026-10-11T08:00" }));
assert(nedelja.tipDneva === "nedelja_praznik" && nedelja.trajanjeVarnoMin === 30, "nedelja brez konice");

// Merjen profil: delavnik 07:00–08:00, celica X ima p85 = 20 min, mediana 10 min.
var pokritost = [];
for (var iv = 0; iv < 96; iv++) pokritost.push({ vir: "dars", tip_dneva: "delavnik", interval: iv, n_vzorcev: 20 });
var profil = { vrstice: [28, 29, 30, 31].map(function (ivk) { return { vir: "dars", celica: celX, tip_dneva: "delavnik", interval: ivk, n_vzorcev: 20, p_zastoja: 0.9, mediana_s: 600, p85_s: 1200 }; }), pokritost: pokritost };
// Vse celice poti označimo kot opazovane (ponoči brez zastoja), da gre za čiste meritve.
odseki = c.odsekiPoCelicah(potX.tocke, potX.trajanjeProstoS);
odseki.forEach(function (o) { if (o.celica !== celX) profil.vrstice.push({ vir: "dars", celica: o.celica, tip_dneva: "delavnik", interval: 12, n_vzorcev: 20, p_zastoja: 0.05, mediana_s: 0, p85_s: 0 }); });
var r1 = promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, { profil: profil }));
assert(r1.osnova === "meritve", "s profilom -> meritve");
assert(r1.opozorilo === true && r1.dodatnaZamudaMin === 20, "20 min p85 -> opozorilo");
assert(r1.priporocenOdhodUra === "07:00", "08:00 − 50 min − 10 = 07:00");
assert(r1.trajanjeObicajnoMin === 40, "običajno (mediana) 40 min");
assert(r1.razlogi.length === 1 && r1.razlogi[0].celica === celX && r1.razlogi[0].ura.slice(0, 2) === "07", "razlog: celica X okoli 07h");

// Zastoj samo v enem 15-min intervalu: najkasnejši odhod, ki ga obide, je veljaven.
var ozek = JSON.parse(JSON.stringify(profil));
ozek.vrstice = ozek.vrstice.filter(function (v) { return v.celica !== celX || v.interval === 30; });
var r1b = promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, { profil: ozek }));
assert(r1b.priporocenOdhodUra === "07:20" && r1b.dodatnaZamudaMin === 0, "odhod 07:30 pripelje v X ob 07:45 (po konici) -> brez zamude");

var premalo = JSON.parse(JSON.stringify(profil));
premalo.pokritost.forEach(function (p) { p.n_vzorcev = 3; });
var r2 = promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, { profil: premalo }));
assert(r2.osnova === "zacetna_ocena", "premalo vzorcev -> začetna ocena, ne meritev");

var r3 = promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, { prihod: "2026-10-07T10:00", profil: profil }));
assert(r3.dodatnaZamudaMin === 0 && r3.opozorilo === false, "ob 10h v merjenih celicah ni zastoja");

var zapora = [{ vir: "dars", zunanjiId: "Z1", tip: "zapora", cesta: "R3-641", zaprto: true, tocke: [{ lat: 46.2001, lon: 14.9001 }] },
  { vir: "dars", zunanjiId: "Z2", tip: "dela", cesta: "daleč", zaprto: false, tocke: [{ lat: 45.5, lon: 13.7 }] }];
var r4 = promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, { prihod: "2026-10-07T03:00", dogodki: zapora }));
assert(r4.dogodki.length === 1 && r4.dogodki[0].cesta === "R3-641", "samo dogodek na poti");
assert(r4.trajanjeVarnoMin === 45, "zapora doda 15 min");

// DST: nedelja 25. 10. 2026 ob 03:00 se ura premakne nazaj.
var dst = promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, { prihod: "2026-10-25T03:30" }));
assert(dst.priporocenOdhodUra === "02:50", "prehod na zimski čas: 03:30 − 30 − 10 min = 02:50");

var napake = 0;
[{ prihod: "x" }, { prihod: "2026-10-07T08:00", pot: {} }, { prihod: "2026-10-07T08:00", pot: { trajanjeProstoS: 10, tocke: [] } }].forEach(function (v) {
  try { promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, v)); } catch (_) { napake++; }
});
assert(napake === 3, "neveljaven vhod vrže napako");

section("Sporočilo");
var sl = promet.napoved.sporocilo(r1, "sl");
assert(/gneča/.test(sl) && /07:00/.test(sl) && /08:00/.test(sl), "SI opozorilo vsebuje gnečo, odhod in prihod");
assert(!/Ocena/.test(sl), "meritve nimajo opombe o oceni");
var de = promet.napoved.sporocilo(r1, "de");
assert(/Stau/.test(de) && /07:00/.test(de), "DE sporočilo");
assert(/tipičnih konic/.test(promet.napoved.sporocilo(r0, "sl")), "začetna ocena je jasno označena");
assert(/R3-641/.test(promet.napoved.sporocilo(r4, "sl")), "sporočilo navede zaporo");

section("OpenHolidays odjemalec");
(async function () {
  var klici = [];
  var lazen = async function (url) { klici.push(url); return { ok: true, json: async function () { return [{ startDate: "2026-12-25", endDate: "2026-12-25", nationwide: true }, { foo: 1 }]; } }; };
  var k = await promet.tipDneva.pridobiKoledar("SI", "2026-12-01", "2026-12-31", lazen);
  assert(klici.length === 2 && /countryIsoCode=SI/.test(klici[0]), "kliče PublicHolidays in SchoolHolidays");
  assert(k.prazniki.length === 1, "neveljavni zapisi so izločeni");
  var napakaVira = null;
  try { await promet.tipDneva.pridobiKoledar("SI", "2026-12-01", "2026-12-31", async function () { return { ok: false, status: 503 }; }); } catch (e) { napakaVira = e.code; }
  assert(napakaVira === "ZUNANJI_VIR", "HTTP napaka je napaka zunanjega vira");

  var abKlici = 0;
  var abLazen = async function (url) {
    abKlici++;
    if (/\/$/.test(url)) return { ok: true, json: async function () { return { roads: ["A9", "A99", "A1 ", "B2"] }; } };
    if (/A99/.test(url)) return { ok: false, status: 500 };
    return { ok: true, json: async function () { return fixture("autobahn-a9-warning.json"); } };
  };
  var zajem = await promet.viri.autobahn.zajemi({ fetch: abLazen });
  assert(zajem.skupaj === 3 && zajem.pokritost === 2, "B2 izločen, A99 napaka zabeležena");
  assert(zajem.napake.length === 1 && zajem.napake[0].cesta === "A99", "napaka ene ceste je vidna (zajem bo uspeh=false)");

  var brezSeznama = await promet.viri.autobahn.zajemi({ fetch: async function () { return { ok: false, status: 403 }; } });
  assert(brezSeznama.pokritost === 0 && brezSeznama.napake.length === 1, "nedosegljiv seznam cest ne zruši zbiralnika");
  var darsNapaka = await promet.viri.dars.zajemi({ url: "https://x.invalid/", fetch: async function () { throw new Error("ECONNRESET"); } });
  assert(darsNapaka.pokritost === 0 && /povezava/.test(darsNapaka.napake[0].napaka), "napaka DARS je zabeležena kot napaka vira");

  console.log("\n" + OK + " uspešnih, " + FAIL + " neuspešnih");
  if (FAIL) process.exit(1);
})();
