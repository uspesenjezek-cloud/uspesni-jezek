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
assert(r0.trajanjeVarnoMin === 42, "SI jutranja konica 1,4 -> 30 min * 1,4 = 42 min");
assert(r0.priporocenOdhodUra === "07:05", "08:00 − 42 − 10 rezerve = 07:08 -> zaokroženo navzdol 07:05");
assert(r0.opozorilo === true, "12 min dodatka je nad pragom opozorila");
// Prijavljen primer: Ljubljana, sreda, prihod 15:00, 14 min brez prometa.
// Stara tabela je konico začela ob 15:00 in dala le +1 min.
var popoldne = promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, { prihod: "2026-10-07T15:00", pot: { trajanjeProstoS: 14 * 60, tocke: potX.tocke } }));
assert(popoldne.dodatnaZamudaMin === 6 && popoldne.trajanjeVarnoMin === 20, "SI 14:40–15:00 je že popoldanska konica: 14 min -> +6 min");
assert(promet.napoved.faktorKonice("delavnik", 14.6, "DE") === 1.1 && promet.napoved.faktorKonice("delavnik", 14.6, "SI") === 1.45, "konice so ločene po državah");
assert(promet.napoved.faktorKonice("petek", 12.5, "SI") === 1.5, "SI petek: konica od 12:00");
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
  assert(brezSeznama.napakeDogodkov > 0, "nedosegljiv seznam cest ne prepiše zadnjih znanih del/zapor");
  var darsNapaka = await promet.viri.dars.zajemi({ url: "https://x.invalid/", fetch: async function () { throw new Error("ECONNRESET"); } });
  assert(darsNapaka.pokritost === 0 && /povezava/.test(darsNapaka.napake[0].napaka), "napaka DARS je zabeležena kot napaka vira");

  var abPolni = async function (url) {
    if (/\/$/.test(url)) return { ok: true, json: async function () { return { roads: ["A8"] }; } };
    if (/closure$/.test(url)) return { ok: true, json: async function () { return { closure: [{ identifier: "C1", title: "A8 Sperrung", isBlocked: "true", coordinate: { lat: "48.1", long: "11.5" } }] }; } };
    if (/roadworks$/.test(url)) return { ok: true, json: async function () { return { roadworks: [{ identifier: "R1", title: "A8 Baustelle", isBlocked: "false", coordinate: { lat: "48.2", long: "11.6" } }] }; } };
    return { ok: true, json: async function () { return { warning: [] }; } };
  };
  var polni = await promet.viri.autobahn.zajemi({ fetch: abPolni });
  assert(polni.napakeDogodkov === 0 && polni.dogodki.length === 2, "DE zapore in dela so zajeta");
  assert(polni.dogodki.find(function (x) { return x.zunanjiId === "C1"; }).zaprto === true, "zapora je označena kot zaprto");

  section("Lokalna shramba (računalnik brez baze)");
  var fs = require("fs");
  var os = require("os");
  var lok = promet.lokalno;
  var mapa = fs.mkdtempSync(path.join(os.tmpdir(), "promet-test-"));
  lok.dodajZajem(mapa, { vir: "dars", opazovanja: [{ vir: "dars", celica: celX, zamudaS: 60 }], dogodki: [{ zunanjiId: "D9" }], napakeDogodkov: 0, napake: [] }, "2026-01-01T06:00:00.000Z", true);
  lok.dodajZajem(mapa, { vir: "dars", opazovanja: [{ vir: "dars", celica: celX, zamudaS: 120 }], dogodki: [], napakeDogodkov: 1, napake: [] }, "2026-10-01T06:00:00.000Z", true);
  fs.appendFileSync(path.join(mapa, "zajemi.jsonl"), "{\"id\":\"prekinjen"); // izklop med pisanjem
  var zg = lok.preberiZgodovino(mapa, "2025-01-01T00:00:00Z");
  assert(zg.zajemi.length === 2 && zg.opazovanja.length === 2, "prekinjena vrstica je preskočena");
  var dg = lok.preberiDogodke(mapa, Date.parse("2026-01-01T07:00:00Z"), 2);
  assert(dg.dogodki.length === 1 && dg.dogodki[0].zunanjiId === "D9", "nepopoln seznam dogodkov ne prepiše zadnjega popolnega");
  var star = lok.preberiDogodke(mapa, Date.parse("2026-01-02T07:00:00Z"), 2);
  assert(star.dogodki.length === 0 && star.opozorila.length === 1, "zastareli dogodki se ne uporabijo in sprožijo opozorilo");
  var po = lok.pocisti(mapa, "2026-06-01T00:00:00Z");
  assert(po.zajemi.length === 1 && lok.preberiZgodovino(mapa, "2025-01-01T00:00:00Z").opazovanja.length === 1, "čiščenje odstrani stare zajeme in njihova opazovanja");
  var sirota = lok.obreziZgodovino([], [{ zajemId: "x", celica: celX, zamudaS: 1 }], "2025-01-01T00:00:00Z");
  assert(sirota.opazovanja.length === 0, "opazovanja brez zajema se ne štejejo");
  assert(JSON.stringify(lok.preberiProfil(mapa)) === JSON.stringify({ vrstice: [], pokritost: [] }), "brez profila -> prazen profil (začetna ocena)");
  fs.rmSync(mapa, { recursive: true, force: true });

  section("OSRM po državah");
  var u = promet.osrm.urlZaDrzavo;
  assert(u("SI", { PROMET_OSRM_URL_SI: "http://localhost:5000/" }) === "http://localhost:5000", "SI strežnik");
  assert(u("DE", { PROMET_OSRM_URL_SI: "a", PROMET_OSRM_URL: "http://skupni" }) === "http://skupni", "rezerva na skupni URL");
  assert(u("DE", {}) === "", "brez nastavitve prazno");

  var t0 = Date.parse("2026-10-07T10:00:00Z");
  section("Storitev: naslov -> odhod");
  var klici2 = { nominatim: 0, osrm: 0 };
  var svet = async function (url) {
    var odg = function (b) { return { ok: true, json: async function () { return b; } }; };
    if (/nominatim/.test(url)) {
      klici2.nominatim++;
      if (/neobstaja/.test(url)) return odg([]);
      var de = /M%C3%BCnchen|Munchen/.test(url);
      return odg([{ lat: de ? "48.137" : "46.25", lon: de ? "11.575" : "15.0", display_name: de ? "München" : "Celje",
        address: de ? { country_code: "de", "ISO3166-2-lvl4": "DE-BY" } : { country_code: "si" } }]);
    }
    if (/openholidaysapi/.test(url)) return odg([]);
    if (/route\/v1/.test(url)) { klici2.osrm++; return odg({ code: "Ok", routes: [{ duration: 1800, distance: 21000, geometry: { coordinates: potX.tocke.map(function (t) { return [t.lon, t.lat]; }) } }] }); }
    return { ok: false, status: 404 };
  };
  var smapa = fs.mkdtempSync(path.join(os.tmpdir(), "promet-storitev-"));
  var vhodN = { izhodisce: "Ljubljana, Slovenska 1", cilj: "Celje, Prešernova 1", datum: "2026-10-07", prihod: "08:00" };
  var s1 = await promet.storitev.napovejNalog(vhodN, { mapa: smapa, fetch: svet, zdajMs: t0 });
  assert(s1.virPoti === "lokalni" && s1.osnova === "zacetna_ocena" && s1.drzava === "SI", "lokalni OSRM + lastna ocena");
  assert(s1.priporocenOdhodUra === "07:05" && /07:05/.test(s1.sporocilo), "08:00 − 42 − 10 -> 07:05, v sporočilu");
  var s2 = await promet.storitev.napovejNalog(vhodN, { mapa: smapa, fetch: svet, zdajMs: t0 + 60000 });
  assert(klici2.nominatim === 2 && s2.priporocenOdhodUra === "07:05", "ponovitev: naslova iz predpomnilnika (brez novih klicev Nominatim)");
  var s4 = await promet.storitev.napovejNalog(Object.assign({}, vhodN, { cilj: "München, Marienplatz 1" }), { mapa: smapa, fetch: svet, zdajMs: t0 });
  assert(s4.drzava === "DE" && /Abfahrt|Ankunft/.test(promet.napoved.sporocilo(s4, "de")), "naslov v Nemčiji -> DE");
  var nn = null;
  try { await promet.storitev.napovejNalog(Object.assign({}, vhodN, { cilj: "neobstaja 123" }), { mapa: smapa, fetch: svet }); } catch (e) { nn = e.code; }
  assert(nn === "NASLOV_NI_NAJDEN", "neznan naslov -> jasna napaka");
  var nv = null;
  try { await promet.storitev.napovejNalog(Object.assign({}, vhodN, { prihod: "8" }), { mapa: smapa, fetch: svet }); } catch (e) { nv = e.code; }
  assert(nv === "NEVELJAVEN_VNOS", "napačna ura -> napaka vnosa");
  var st = await promet.storitev.stanje({ mapa: smapa, zdajMs: t0 });
  assert(st.zbiralnikTece === false && st.viri.length === 2, "stanje: zbiralnik še ni tekel");
  section("Dnevni načrt (veriga nalogov)");
  var D = promet.dan;
  var urejeni = D.pripraviNaloge([
    { id: "b", stranka: "BTC", naslov: "BTC, Ljubljana", zacetek: "10:30", konec: "12:00" },
    { id: "a", stranka: "Center", naslov: "Slovenska 1, Ljubljana", zacetek: "08:00", konec: "10:00" }
  ]);
  assert(urejeni[0].id === "a" && urejeni[1].id === "b", "nalogi so urejeni po začetku");
  var nap = function (naloge) { try { D.pripraviNaloge(naloge); return null; } catch (e) { return e.code; } };
  assert(nap([{ naslov: "x", zacetek: "08:00", konec: "10:00" }, { naslov: "y", zacetek: "09:30", konec: "11:00" }]) === "NEVELJAVEN_VNOS", "prekrivanje nalogov je napaka");
  assert(nap([{ naslov: "x", zacetek: "10:00", konec: "09:00" }]) === "NEVELJAVEN_VNOS", "konec pred začetkom je napaka");
  assert(nap([{ naslov: "x", zacetek: "10:00" }]) === "NEVELJAVEN_VNOS", "manjka konec");
  assert(nap([{ naslov: "", zacetek: "08:00", konec: "09:00" }]) === "NEVELJAVEN_VNOS", "manjka naslov");
  assert(nap([]) === "NEVELJAVEN_VNOS", "prazen dan");

  var lx = require("luxon").DateTime;
  var tz = "Europe/Ljubljana";
  var konecA = lx.fromISO("2026-10-07T10:00", { zone: tz });
  var zacB = lx.fromISO("2026-10-07T10:30", { zone: tz });
  var ev = D.ovrednotiPrehod({ priporocenOdhod: "2026-10-07T10:05:00+02:00", trajanjeVarnoMin: 15 }, konecA, zacB);
  assert(ev.stanje === "ok" && ev.rezervaMin === 5, "odhod po koncu -> ok, 5 min rezerve");
  var ev2 = D.ovrednotiPrehod({ priporocenOdhod: "2026-10-07T09:55:00+02:00", trajanjeVarnoMin: 25 }, konecA, zacB);
  assert(ev2.stanje === "tesno" && ev2.zamudaMin === 0, "vožnja gre v okno, a brez rezerve -> tesno");
  var ev3 = D.ovrednotiPrehod({ priporocenOdhod: "2026-10-07T09:40:00+02:00", trajanjeVarnoMin: 40 }, konecA, zacB);
  assert(ev3.stanje === "zamuda" && ev3.zamudaMin === 10 && ev3.predvidenPrihodUra === "10:40", "predviden prihod 10:40 -> 10 min zamude");

  var dmapa = fs.mkdtempSync(path.join(os.tmpdir(), "promet-dan-"));
  var dn = await D.izracunajDan({ izhodisce: "Šiška, Ljubljana", datum: "2026-10-07", naloge: [
    { id: "2", stranka: "Novak", naslov: "Celje, Mariborska 1", zacetek: "10:30", konec: "12:00" },
    { id: "1", stranka: "Kovač", naslov: "Celje, Prešernova 1", zacetek: "08:00", konec: "10:00" },
    { id: "3", stranka: "Novak – 2. del", naslov: "celje,  mariborska 1", zacetek: "12:30", konec: "14:00" },
    { id: "4", stranka: "Neznan", naslov: "neobstaja 5", zacetek: "15:00", konec: "16:00" }
  ] }, { mapa: dmapa, fetch: svet });
  var o = dn.odseki;
  assert(o.length === 4 && o[0].nalogId === "1" && o[0].prvi && o[0].priporocenOdhodUra === "07:05", "prvi odsek od doma: odhod 07:05");
  assert(o[1].stanje === "zamuda" && o[1].zamudaMin === 3 && o[1].predvidenPrihodUra === "10:33", "Kovač 10:00 -> Novak 10:30: 33 min vožnje -> 3 min zamude");
  assert(o[2].stanje === "isti_naslov", "isti naslov (drugače zapisan) -> brez vožnje");
  assert(o[3].stanje === "napaka" && /ni bilo mogoče najti/.test(o[3].napaka), "neznan naslov ne podre ostalih odsekov");
  assert(/07:05/.test(dn.sporocilo) && /3 min pozni/.test(dn.sporocilo), "sporočilo dneva navede odhod in zamudo");
  var dnDe = await D.izracunajDan({ izhodisce: "Šiška", datum: "2026-10-07", jezik: "de", naloge: [{ stranka: "Kovač", naslov: "Celje, Prešernova 1", zacetek: "08:00", konec: "10:00" }] }, { mapa: dmapa, fetch: svet });
  assert(/Abfahrt spätestens um 07:05/.test(dnDe.sporocilo), "nemško sporočilo dneva");
  var brezIzh = null;
  try { await D.izracunajDan({ datum: "2026-10-07", naloge: [] }, { mapa: dmapa, fetch: svet }); } catch (e) { brezIzh = e.code; }
  assert(brezIzh === "NEVELJAVEN_VNOS", "brez izhodišča -> napaka vnosa");
  fs.rmSync(dmapa, { recursive: true, force: true });

  section("Zemljevid v živo");
  var Z = promet.zemljevid;
  assert(Z.barvaStevca("Zastoj", 90) === "rdece", "opis »Zastoj« ima prednost pred hitrostjo");
  assert(Z.barvaStevca("Gost promet", 80) === "oranzno", "gost promet -> oranžno");
  assert(Z.barvaStevca("", 55, 100) === "oranzno" && Z.barvaStevca("", 85, 100) === "zeleno" && Z.barvaStevca("", 25, 100) === "rdece", "brez opisa: razmerje hitrost/omejitev");
  assert(Z.barvaStevca("", 0) === "ni_podatka" && Z.barvaStevca("", null) === "ni_podatka", "brez hitrosti -> ni podatka (ne zeleno)");
  var st2 = Z.razcleniStevce(fixture("dars-stevci.json"));
  assert(st2.length === 3, "en števec na lokacijo, neveljavna geometrija izločena");
  var sentvid = st2.find(function (f) { return f.properties.opis === "Šentvid"; });
  assert(sentvid && sentvid.properties.barva === "rdece", "na lokaciji z več pasovi velja najslabši pas");
  var kozarje = st2.find(function (f) { return f.properties.opis === "Kozarje"; });
  assert(kozarje && Math.abs(kozarje.geometry.coordinates[1] - 46.048) < 0.01, "D96/TM števec pretvorjen v WGS84");
  var abZ = Z.opozorilaAutobahn("A9", fixture("autobahn-a9-warning.json"));
  assert(abZ.length === 1 && abZ[0].geometry.type === "LineString" && abZ[0].properties.barva === "rdece" && abZ[0].properties.zamudaMin === 12, "Autobahn zastoj kot rdeča črta z zamudo");
  var dgZ = Z.dogodkiDars(fixture("dars-dogodki.json"));
  assert(dgZ.tocke.length === 3 && dgZ.tocke.filter(function (f) { return f.properties.vrsta === "zastoj"; }).length === 2, "DARS: 2 zastoja + 1 dela, veter izločen");

  Z._ponastavi();
  var zKlici = 0;
  var zSvet = async function (url) {
    zKlici++;
    var odg = function (b) { return { ok: true, json: async function () { return b; } }; };
    if (/stevci/.test(url)) return odg(fixture("dars-stevci.json"));
    if (/dogodki/.test(url)) return odg(fixture("dars-dogodki.json"));
    if (/autobahn\/$/.test(url)) return odg({ roads: ["A9", "A8"] });
    if (/A8/.test(url)) return { ok: false, status: 500 };
    return odg(fixture("autobahn-a9-warning.json"));
  };
  var zz = await Z.zemljevid({ fetch: zSvet, zdajMs: t0 });
  assert(zz.features.length === 3 + 3 + 1, "zemljevid združi števce, dogodke DARS in Autobahn");
  var abVir = zz.viri.find(function (v) { return v.vir === "autobahn"; });
  assert(abVir && !abVir.ok && /1 od 2/.test(abVir.napaka), "delna napaka Autobahn je vidna");
  var kliciPrej = zKlici;
  await Z.zemljevid({ fetch: zSvet, zdajMs: t0 + 60000 });
  assert(zKlici === kliciPrej, "v 3 minutah iz predpomnilnika");
  await Z.zemljevid({ fetch: zSvet, zdajMs: t0 + 4 * 60000 });
  assert(zKlici > kliciPrej, "po 3 minutah znova");
  Z._ponastavi();
  var zNic = await Z.zemljevid({ fetch: async function () { return { ok: false, status: 503 }; }, zdajMs: t0 });
  assert(zNic.features.length === 0 && zNic.viri.every(function (v) { return !v.ok; }), "vsi viri nedosegljivi -> prazno z razlogi");
  var zPo = await Z.zemljevid({ fetch: zSvet, zdajMs: t0 + 1000 });
  assert(zPo.features.length > 0, "neuspešen zajem se ne predpomni");
  Z._ponastavi();

  section("API (handler)");
  var H = require("../api/_handlers/promet");
  assert(H._test.akcijaIzZahteve({ url: "/api/pos?handler=promet&akcija=dan" }) === "dan", "akcija iz poizvedbe (Vercel rewrite prek api/pos.js)");
  assert(H._test.akcijaIzZahteve({ url: "/api/promet-zemljevid" }) === "zemljevid", "akcija iz poti");
  var lazniRes = function () { var r = { koda: 0, telo: null }; r.status = function (k) { r.koda = k; return r; }; r.json = function (t) { r.telo = t; return r; }; r.setHeader = function () {}; return r; };
  var rr = lazniRes();
  await H({ method: "GET", url: "/api/promet?akcija=dan", query: { akcija: "dan" } }, rr);
  assert(rr.koda === 405, "dan zahteva POST");
  var rr2 = lazniRes();
  process.env.VERCEL = "1";
  await H({ method: "GET", url: "/api/promet?akcija=stanje", query: { akcija: "stanje" }, headers: {} }, rr2);
  delete process.env.VERCEL;
  assert(rr2.koda === 401 || rr2.koda === 503, "na Vercelu brez prijave zavrnjeno");
  var rr3 = lazniRes();
  await H({ method: "POST", url: "/api/promet-dan", query: { akcija: "dan" }, body: { datum: "2026-10-07", naloge: [] } }, rr3);
  assert(rr3.koda === 400 && /izhodišče/.test(rr3.telo.napaka), "napaka vnosa ima jasno sporočilo");

  section("Vercel: omejitev funkcij (paket Hobby)");
  var koren = path.join(__dirname, "..");
  var prezrte = fs.readFileSync(path.join(koren, ".vercelignore"), "utf8").split(/\r?\n/).map(function (v) { return v.trim(); }).filter(function (v) { return v && v[0] !== "#"; });
  var funkcije = fs.readdirSync(path.join(koren, "api")).filter(function (f) { return /\.js$/.test(f); }).map(function (f) { return "api/" + f; })
    .filter(function (f) { return prezrte.indexOf(f) === -1; });
  assert(funkcije.length <= 12, "največ 12 Vercel funkcij (zdaj " + funkcije.length + ")");
  var vcfg = JSON.parse(fs.readFileSync(path.join(koren, "vercel.json"), "utf8"));
  assert(Object.keys(vcfg.functions || {}).every(function (f) { return funkcije.indexOf(f) !== -1; }), "vsaka nastavitev v »functions« ima objavljeno datoteko");
  var promRew = vcfg.rewrites.filter(function (r) { return /^\/api\/promet-/.test(r.source); });
  assert(promRew.length === 6 && promRew.every(function (r) { return funkcije.indexOf(r.destination.split("?")[0].slice(1) + ".js") !== -1; }), "poti /api/promet-* kažejo na objavljeno funkcijo");
  var posRes = lazniRes();
  await require("../api/pos.js")({ method: "GET", url: "/api/pos?handler=promet&akcija=neznano", query: { handler: "promet", akcija: "neznano" } }, posRes);
  assert(posRes.koda === 404 && posRes.telo.napaka === "Neznana akcija.", "api/pos.js preda promet handlerju");

  section("Zbiralnik na produkciji (Supabase + pg_cron)");
  var izvirniFetch = global.fetch;
  var zapisi = { zajemi: [], opazovanja: [], dogodki: 0 };
  var odg = function (b, status) { return new Response(JSON.stringify(b), { status: status || 200, headers: { "content-type": "application/json" } }); };
  global.fetch = async function (url, opts) {
    var u = String(url);
    var metoda = (opts && opts.method) || "GET";
    if (u.indexOf("https://sb.test/rest/v1/promet_zajem?select=cas") === 0) {
      var zadnji = zapisi.zajemi[zapisi.zajemi.length - 1];
      return odg(zadnji ? [{ cas: zadnji.cas }] : []);
    }
    if (u === "https://sb.test/rest/v1/promet_zajem" && metoda === "POST") {
      var v = JSON.parse(opts.body);
      v.id = zapisi.zajemi.length + 1;
      zapisi.zajemi.push(v);
      return odg([v], 201);
    }
    if (u === "https://sb.test/rest/v1/promet_opazovanje") { zapisi.opazovanja = zapisi.opazovanja.concat(JSON.parse(opts.body)); return new Response(null, { status: 201 }); }
    if (u.indexOf("https://sb.test/rest/v1/promet_dogodek") === 0) { zapisi.dogodki += JSON.parse(opts.body).length; return new Response(null, { status: 201 }); }
    if (/openholidays/.test(u)) return odg([]);
    if (/autobahn\/$/.test(u)) return odg({ roads: ["A9"] });
    if (/warning$/.test(u)) return odg(fixture("autobahn-a9-warning.json"));
    if (/closure$/.test(u)) return odg({ closure: [] });
    if (/roadworks$/.test(u)) return odg({ roadworks: [{ identifier: "RW1", title: "A9 Baustelle", coordinate: { lat: "48.4", long: "11.5" } }] });
    if (/dogodki/.test(u)) return odg(fixture("dars-dogodki.json"));
    return odg({}, 404);
  };
  try {
    var ZB = require("../api/_lib/promet/zbiralnik");
    var cfgT = { url: "https://sb.test", serviceKey: "k" };
    var tz0 = Date.parse("2026-10-07T05:31:00Z"); // sreda 07:31 v Ljubljani
    var z1 = await ZB.zberi(cfgT, { zdajMs: tz0 });
    assert(!z1.preskoceno && z1.viri.length === 2 && z1.viri.every(function (v) { return v.uspeh; }), "zajem obeh virov je uspel");
    assert(zapisi.zajemi.length === 2 && zapisi.zajemi.every(function (z) { return z.tip_dneva === "delavnik" && z.interval === 30; }), "zajem ima tip dneva in interval (07:30 -> 30)");
    assert(zapisi.opazovanja.length > 0 && zapisi.opazovanja.every(function (o) { return o.zajem_id && o.celica; }), "opazovanja so vezana na zajem");
    assert(zapisi.dogodki >= 2, "dela/zapore DE in SI so zapisani");
    var z2 = await ZB.zberi(cfgT, { zdajMs: tz0 + 5 * 60000 });
    assert(z2.preskoceno === true && zapisi.zajemi.length === 2, "ponoven klic v 12 min se preskoči (brez podvojenih vzorcev)");
    var z3 = await ZB.zberi(cfgT, { zdajMs: tz0 + 15 * 60000 });
    assert(!z3.preskoceno && zapisi.zajemi.length === 4 && zapisi.zajemi[3].interval === 31, "naslednji zajem 15 min pozneje -> interval 31");
  } finally {
    global.fetch = izvirniFetch;
  }

  section("Produkcija brez pripravljenih tabel");
  var fetchPrej = global.fetch;
  global.fetch = async function () { return new Response(JSON.stringify({ message: "relation \"promet_profil\" does not exist" }), { status: 404 }); };
  try {
    var bmapa = fs.mkdtempSync(path.join(os.tmpdir(), "promet-brezbaze-"));
    var rb = await promet.storitev.napovejNalog(vhodN, { mapa: bmapa, fetch: svet, cfg: { url: "https://sb.test", serviceKey: "k" }, zdajMs: t0 });
    assert(rb.priporocenOdhodUra && rb.osnova === "zacetna_ocena", "napoved deluje z oceno konic, ko zgodovina ni dosegljiva");
    assert(rb.opozorilaPodatkov.some(function (t) { return /Zgodovina prometa ni dosegljiva/.test(t); }), "in to jasno sporoči");
    var sb = await promet.storitev.stanje({ cfg: { url: "https://sb.test", serviceKey: "k" }, zdajMs: t0 });
    assert(sb.napaka && /niso pripravljene/.test(sb.napaka) && sb.zbiralnikTece === false, "stanje pove, da tabele niso pripravljene");
    fs.rmSync(bmapa, { recursive: true, force: true });
  } finally {
    global.fetch = fetchPrej;
  }

  section("NAP / DATEX II (osebni dostop)");
  var D2 = require("../api/_lib/promet/viri/datex2");
  var xml = function (ime) { return fs.readFileSync(path.join(__dirname, "fixtures", "promet", ime), "utf8"); };
  var sit = D2.razcleniSituacije(xml("nap-situacije.xml"));
  assert(sit.length === 3, "zastoj, dela, zapora; slabe vremenske razmere izločene");
  assert(sit[0].vrsta === "zastoj" && sit[0].zamudaMin === 10 && sit[0].tocke.length === 3 && sit[0].cesta === "H3", "zastoj: 600 s, posList (3 točke), cesta");
  assert(sit[1].vrsta === "dela" && sit[1].zamudaMin === null, "dela brez zamude -> null, ne 0");
  assert(sit[2].vrsta === "zapora" && sit[2].zaprto === true, "roadClosed -> zapora");
  var mesta = D2.razcleniMerilnaMesta(xml("nap-merilna-mesta.xml"));
  assert(mesta.get("0012") && mesta.get("0012").ime === "Šentvid", "oznaka »0012« ostane besedilo (ne 12)");
  var mer = D2.razcleniMeritve(xml("nap-meritve.xml"));
  assert(mer.get("0012").hitrost === 24 && mer.get("0012").pretok === 1200, "več pasov: najnižja hitrost, pretok seštet");
  var ptc = D2.razcleniPotovalneCase(xml("nap-potovalni-casi.xml"));
  assert(ptc.length === 2 && ptc[0].lokacija === "PL1" && ptc[0].casS === 1260 && ptc[0].prostoS === 840, "potovalni čas Kranj–Ljubljana 21 min proti 14 min");
  var lok = D2.razcleniLokacije(xml("nap-odseki.xml"));
  assert(lok.get("PL1").tocke.length === 2 && lok.get("PL1").ime === "Kranj – Ljubljana", "preddefinirani odsek s koordinatami");
  var neXml = null;
  try { D2.razcleniSituacije("{\"napaka\":1}"); } catch (e) { neXml = e.code; }
  assert(neXml === "ZUNANJI_VIR", "ne-XML odgovor je napaka vira");

  var NAP = require("../api/_lib/promet/viri/nap");
  NAP._ponastavi();
  var napEnv = {
    PROMET_NAP_UPORABNIK: "podjetje", PROMET_NAP_GESLO: "skrivnost123",
    PROMET_NAP_URL_DOGODKI: "https://nap.test/dogodki", PROMET_NAP_URL_STEVCI: "https://nap.test/stevci",
    PROMET_NAP_URL_STEVCI_LOKACIJE: "https://nap.test/mesta", PROMET_NAP_URL_POTOVALNI_CASI: "https://nap.test/casi",
    PROMET_NAP_URL_POTOVALNI_CASI_LOKACIJE: "https://nap.test/odseki"
  };
  var napGlave = [];
  var napSvet = async function (url, opts) {
    napGlave.push(opts && opts.headers && opts.headers.authorization);
    var m = { "https://nap.test/dogodki": "nap-situacije.xml", "https://nap.test/stevci": "nap-meritve.xml", "https://nap.test/mesta": "nap-merilna-mesta.xml",
      "https://nap.test/casi": "nap-potovalni-casi.xml", "https://nap.test/odseki": "nap-odseki.xml" }[url];
    return m ? new Response(xml(m), { status: 200 }) : new Response("ne", { status: 404 });
  };
  assert(NAP.nastavljen(napEnv) && !NAP.nastavljen({}), "NAP vključen samo z nastavljenimi naslovi");
  var napSt = await NAP.stevci({ env: napEnv, fetch: napSvet });
  assert(napSt.length === 2 && napSt.every(function (s) { return s.lat && s.lon; }), "števci z lokacijami; meritev brez mesta izločena");
  assert(napGlave[0] === "Basic " + Buffer.from("podjetje:skrivnost123").toString("base64"), "prijava HTTP Basic iz nastavitev okolja");
  var napPc = await NAP.potovalniCasi({ env: napEnv, fetch: napSvet });
  assert(napPc.length === 2 && napPc[0].ime === "Kranj – Ljubljana" && napPc[0].tocke.length === 2, "potovalni časi dobijo odseke");
  var zavrnjeno = null;
  try { await NAP.dogodki({ env: napEnv, fetch: async function () { return new Response("", { status: 401 }); } }); } catch (e) { zavrnjeno = e.message; }
  assert(/dostop zavrnjen/.test(zavrnjeno) && zavrnjeno.indexOf("skrivnost123") === -1, "401: jasno sporočilo, geslo ni izpisano");

  var DARS = promet.viri.dars;
  var napZajem = await DARS.zajemi({ env: napEnv, fetch: napSvet });
  assert(napZajem.napake.length === 0 && napZajem.pokritost === 3 && napZajem.skupaj === 3, "zajem SI prek NAP: vsi trije viri");
  var pocCelica = function (lat, lon) { return napZajem.opazovanja.filter(function (o) { return o.celica === c.celica(lat, lon); }); };
  assert(pocCelica(46.095, 14.48).length === 1, "ena vrednost na celico (največja izmed virov)");
  assert(pocCelica(46.04, 14.45)[0].zamudaS === 0, "števec s 110 km/h zapiše zamudo 0 (izmerjeno prosto, ne neznano)");
  assert(DARS.zamudaIzHitrosti(24) === Math.round(2000 / (24 / 3.6) - 72), "zamuda iz hitrosti 24 km/h na 2 km");
  assert(napZajem.dogodki.length === 2 && napZajem.dogodki.some(function (d) { return d.tip === "zapora" && d.zaprto; }), "dela in zapora za napoved");
  var napDelno = await DARS.zajemi({ env: napEnv, fetch: async function (u, o) { return /casi/.test(u) ? new Response("", { status: 500 }) : napSvet(u, o); } });
  assert(napDelno.napake.length === 1 && napDelno.pokritost === 2, "delna napaka vira je vidna (zajem ne bo štet kot uspešen)");
  var brezNap = await DARS.zajemi({ env: {}, url: "https://x.invalid/", fetch: async function () { return new Response("[]", { status: 404 }); } });
  assert(brezNap.napake.length === 1, "brez NAP ostane stari vir promet.si");

  var envPrej = {};
  Object.keys(napEnv).forEach(function (k) { envPrej[k] = process.env[k]; process.env[k] = napEnv[k]; });
  try {
    Z._ponastavi();
    NAP._ponastavi();
    var zNap = await Z.zemljevid({ fetch: async function (u, o) { return /autobahn/.test(u) ? new Response(JSON.stringify(/\/$/.test(u) ? { roads: [] } : { warning: [] })) : napSvet(u, o); }, zdajMs: t0 });
    var vrste = zNap.features.map(function (f) { return f.properties.vrsta; });
    assert(vrste.filter(function (v) { return v === "stevec"; }).length === 2 && vrste.filter(function (v) { return v === "potovalni_cas"; }).length === 2, "zemljevid: števci in potovalni časi NAP");
    var kl = zNap.features.find(function (f) { return f.properties.vrsta === "potovalni_cas" && f.properties.cesta === "Kranj – Ljubljana"; });
    assert(kl.properties.barva === "rdece" && kl.properties.zamudaMin === 7 && kl.geometry.type === "LineString", "Kranj–Ljubljana 21 min namesto 14 (1,5×) -> rdeče, +7 min");
    assert(Z.barvaPotovalnegaCasa(500, 480) === "zeleno" && Z.barvaPotovalnegaCasa(600, 480) === "oranzno" && Z.barvaPotovalnegaCasa(0, 480) === "ni_podatka", "meje barv potovalnega časa");
    assert(zNap.viri.some(function (v) { return v.vir === "nap-dogodki" && v.ok; }) && !zNap.viri.some(function (v) { return v.vir === "dars-stevci"; }), "z NAP se stari viri promet.si ne kličejo");
  } finally {
    Object.keys(napEnv).forEach(function (k) { if (envPrej[k] === undefined) delete process.env[k]; else process.env[k] = envPrej[k]; });
    Z._ponastavi();
    NAP._ponastavi();
  }

  section("Vreme (MET Norway)");
  var V = require("../api/_lib/promet/vreme");
  assert(V.razvrsti("clearsky_day", 0, 15) === "suho", "jasno -> suho");
  assert(V.razvrsti("lightrain", 0.6, 12) === "rahel_dez" && V.razvrsti("rain", 3.1, 12) === "zmeren_dez" && V.razvrsti("heavyrain", 9, 12) === "mocan_dez", "razredi dežja po mm/h");
  assert(V.razvrsti("lightsnow", 0.4, -2) === "rahel_sneg" && V.razvrsti("heavysnow", 3, -3) === "mocan_sneg", "sneg");
  assert(V.razvrsti("rain", 1, 0) === "mocan_sneg", "dež pri 0 °C -> poledica (najvišji razred)");
  assert(V.razvrsti("fog", 0, 8) === "megla", "megla");
  var metOdg = { properties: { timeseries: [
    { time: "2026-10-07T05:00:00Z", data: { instant: { details: { air_temperature: 11 } }, next_1_hours: { summary: { symbol_code: "cloudy" }, details: { precipitation_amount: 0 } } } },
    { time: "2026-10-07T06:00:00Z", data: { instant: { details: { air_temperature: 10 } }, next_1_hours: { summary: { symbol_code: "heavyrain" }, details: { precipitation_amount: 8.2 } } } },
    { time: "2026-10-07T07:00:00Z", data: { instant: { details: { air_temperature: 10 } }, next_1_hours: { summary: { symbol_code: "rain" }, details: { precipitation_amount: 3 } } } }
  ] } };
  var u1 = V.zaUro(metOdg, "2026-10-07T06:30:00Z");
  assert(u1.razred === "mocan_dez" && u1.faktor === 1.12 && u1.padavineMmH === 8.2, "ura 06:30Z -> vrsta 06:00Z (naliv)");
  assert(V.zaUro(metOdg, "2026-10-01T06:00:00Z") === null, "pred začetkom napovedi -> brez vremena");
  var vDez = promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, { prihod: "2026-10-07T03:00", vreme: { razred: "mocan_dez", faktor: 1.12, vir: "met.no" } }));
  assert(vDez.trajanjeVarnoMin === 34 && vDez.vreme.dodatekMin === 4, "naliv: 30 min × 1,12 = +4 min");
  assert(/močan dež \(\+4 min\)/.test(promet.napoved.sporocilo(vDez, "sl")) && /Starkregen/.test(promet.napoved.sporocilo(vDez, "de")), "sporočilo omeni vreme");
  var vSuho = promet.napoved.izracunajOdhod(Object.assign({}, osnovniVhod, { prihod: "2026-10-07T03:00", vreme: { razred: "suho", faktor: 1, vir: "met.no" } }));
  assert(vSuho.trajanjeVarnoMin === 30 && vSuho.vreme.dodatekMin === 0, "suho vreme ne spremeni časa");
  V._ponastavi();
  var metKlici = [];
  var svetZVremenom = async function (url, opts) {
    if (/api\.met\.no/.test(url)) { metKlici.push(opts && opts.headers && opts.headers["user-agent"]); return { ok: true, json: async function () { return metOdg; } }; }
    return svet(url, opts);
  };
  var wmapa = fs.mkdtempSync(path.join(os.tmpdir(), "promet-vreme-"));
  var sv = await promet.storitev.napovejNalog(Object.assign({}, vhodN, { prihod: "08:30" }), { mapa: wmapa, fetch: svetZVremenom, lokalno: true, zdajMs: t0 });
  assert(sv.vreme && sv.vreme.razred === "mocan_dez" && sv.vreme.dodatekMin > 0, "storitev upošteva napoved vremena na cilju");
  assert(metKlici.length === 1 && /UspesniJezek/.test(metKlici[0]), "MET Norway: prepoznaven User-Agent");
  await promet.storitev.napovejNalog(Object.assign({}, vhodN, { prihod: "08:45" }), { mapa: wmapa, fetch: svetZVremenom, lokalno: true, zdajMs: t0 + 60000 });
  assert(metKlici.length === 1, "vreme iz predpomnilnika (30 min)");
  fs.rmSync(wmapa, { recursive: true, force: true });
  V._ponastavi();

  section("Dejanske vožnje (Odhajam / Na lokaciji)");
  var VZ = require("../api/_lib/promet/voznje");
  var vmapa = fs.mkdtempSync(path.join(os.tmpdir(), "promet-voznje-"));
  var napovedV = { prihod: "08:00", odhod: "07:25", prostoMin: 20, varnoMin: 25, osnova: "zacetna_ocena", vreme: { razred: "rahel_dez", faktor: 1.03, padavineMmH: 0.8 } };
  var o1 = await VZ.zabelezi({ datum: "2026-10-07", nalogId: "a", dogodek: "odhod", stranka: "Kovač", od: "Šiška", do: "Center", napoved: napovedV }, { mapa: vmapa, zdajMs: Date.parse("2026-10-07T05:27:00Z") });
  assert(o1.odhod === "2026-10-07T05:27:00.000Z" && o1.prihod === null && o1.dejanskoMin === null, "odhod zabeležen s strežniškim časom");
  var o2 = await VZ.zabelezi({ datum: "2026-10-07", nalogId: "a", dogodek: "prihod" }, { mapa: vmapa, zdajMs: Date.parse("2026-10-07T05:55:00Z") });
  assert(o2.dejanskoMin === 28 && o2.napovedVarnoMin === 25 && o2.razlikaMin === 3, "prihod: dejansko 28 min, napoved 25, razlika +3");
  var shranjeno = JSON.parse(fs.readFileSync(path.join(vmapa, "voznje.json"), "utf8"))["2026-10-07|a"];
  assert(shranjeno.vreme.razred === "rahel_dez" && shranjeno.napoved_osnova === "zacetna_ocena", "shranjena napoved in vreme ob odhodu (za umerjanje)");
  var o3 = await VZ.zabelezi({ datum: "2026-10-07", nalogId: "b", dogodek: "prihod" }, { mapa: vmapa, zdajMs: Date.parse("2026-10-07T08:00:00Z") });
  assert(o3.prihod && o3.dejanskoMin === null, "prihod brez odhoda: brez dejanskega časa");
  var o4 = await VZ.zabelezi({ datum: "2026-10-07", nalogId: "a", dogodek: "odhod", napoved: napovedV }, { mapa: vmapa, zdajMs: Date.parse("2026-10-07T09:00:00Z") });
  assert(o4.prihod === null && o4.dejanskoMin === null, "ponoven odhod začne novo vožnjo");
  var stara = VZ.zdruzi({ odhod: "2026-10-07T01:00:00Z" }, { datum: "2026-10-07", nalogId: "x", dogodek: "prihod" }, "2026-10-07T09:00:00Z");
  assert(stara.dejansko_min === null, "nesmiselno dolga vožnja (>6 h, pozabljen gumb) se ne šteje");
  var napacnih = 0;
  for (var nv2 of [{}, { datum: "2026-10-07" }, { datum: "2026-10-07", nalogId: "a", dogodek: "x" }]) {
    try { await VZ.zabelezi(nv2, { mapa: vmapa }); } catch (e) { if (e.code === "NEVELJAVEN_VNOS") napacnih++; }
  }
  assert(napacnih === 3, "neveljaven vnos zavrnjen");
  fs.rmSync(vmapa, { recursive: true, force: true });

  var sbVoznje = [];
  var fetchPrejV = global.fetch;
  global.fetch = async function (url, opts) {
    var u = String(url);
    if (/promet_voznja\?select=\*/.test(u)) return new Response(JSON.stringify(sbVoznje.filter(function (r) { return u.indexOf("nalog_id=eq." + r.nalog_id) !== -1 && u.indexOf("user_id=eq." + r.user_id) !== -1; })), { status: 200 });
    if (/promet_voznja\?on_conflict/.test(u)) {
      var r = JSON.parse(opts.body);
      sbVoznje = sbVoznje.filter(function (x) { return !(x.user_id === r.user_id && x.nalog_id === r.nalog_id && x.datum === r.datum); }).concat([r]);
      return new Response(JSON.stringify([r]), { status: 201 });
    }
    return new Response("{}", { status: 404 });
  };
  try {
    var cfgSb = { url: "https://sb.test", serviceKey: "k" };
    await VZ.zabelezi({ datum: "2026-10-07", nalogId: "a", dogodek: "odhod", napoved: napovedV }, { cfg: cfgSb, userId: "u1", zdajMs: Date.parse("2026-10-07T05:27:00Z") });
    var sbR = await VZ.zabelezi({ datum: "2026-10-07", nalogId: "a", dogodek: "prihod" }, { cfg: cfgSb, userId: "u1", zdajMs: Date.parse("2026-10-07T05:55:00Z") });
    assert(sbR.dejanskoMin === 28 && sbVoznje.length === 1 && sbVoznje[0].user_id === "u1", "Supabase: ena vrstica na uporabnika in nalog, dejansko 28 min");
    var brezUp = null;
    try { await VZ.zabelezi({ datum: "2026-10-07", nalogId: "a", dogodek: "prihod" }, { cfg: cfgSb }); } catch (e) { brezUp = e.message; }
    assert(/Prijava/.test(brezUp), "brez uporabnika se v bazo ne zapiše");
  } finally {
    global.fetch = fetchPrejV;
  }

  section("Stran: prijavni žeton");
  var stranJs = fs.readFileSync(path.join(koren, "app", "promet-dan.js"), "utf8");
  var klientJs = fs.readFileSync(path.join(koren, "app", "supabase-client.js"), "utf8");
  assert(/const supabaseKlient\b/.test(klientJs) ? /typeof supabaseKlient !== "undefined"/.test(stranJs) : true,
    "stran bere »const supabaseKlient« neposredno (ni na window), sicer API vrne 401");

  section("Geokodiranje: različice naslova");
  var rz = promet.geokodiranje.razlicice("BTC, Šmartinska 152, Ljubljana");
  assert(rz[0] === "BTC, Šmartinska 152, Ljubljana" && rz[1] === "Šmartinska 152, Ljubljana" && rz[rz.length - 1] === "Ljubljana", "od natančnega do kraja");
  var gmapa = fs.mkdtempSync(path.join(os.tmpdir(), "promet-geo-"));
  var gKlici = [];
  var gSvet = async function (url) {
    var q = decodeURIComponent(url.split("q=")[1]);
    gKlici.push(q);
    return { ok: true, json: async function () { return q === "Šmartinska 152, Ljubljana" ? [{ lat: "46.066", lon: "14.542", display_name: "Šmartinska 152", address: { country_code: "si" } }] : []; } };
  };
  var gz = await promet.geokodiranje.poisci("BTC, Šmartinska 152, Ljubljana", { fetch: gSvet, predpomnilnik: path.join(gmapa, "g.json") });
  assert(gz.priblizno === true && gz.iskano === "Šmartinska 152, Ljubljana" && gKlici.length === 2, "ime objekta odstranjeno, najden drugi poskus");
  fs.rmSync(gmapa, { recursive: true, force: true });

  [smapa].forEach(function (m) { fs.rmSync(m, { recursive: true, force: true }); });

  console.log("\n" + OK + " uspešnih, " + FAIL + " neuspešnih");
  if (FAIL) process.exit(1);
})();
