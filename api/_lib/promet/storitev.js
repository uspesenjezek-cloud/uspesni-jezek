"use strict";

/* Napoved odhoda za delovni nalog iz naslovov (lokalni način).
   Uporablja: geokodiranje (Nominatim), OSRM (lokalni, rezervno javni
   preizkusni), praznike (OpenHolidays, predpomnjeno po letih), lokalni
   profil zastojev in aktualna dela/zapore. */

var fs = require("fs");
var path = require("path");
var luxon = require("luxon");
var geokodiranje = require("./geokodiranje");
var osrm = require("./osrm");
var tipDneva = require("./tip-dneva");
var napoved = require("./napoved");
var lokalno = require("./lokalno");
var profilMod = require("./profil");

var LOKALNI_OSRM = { SI: "http://localhost:5000", DE: "http://localhost:5001" };
var JAVNI_OSRM = "https://router.project-osrm.org";

function napakaVnosa(sporocilo) {
  var e = new Error(sporocilo);
  e.code = "NEVELJAVEN_VNOS";
  return e;
}

async function koledar(mapa, drzava, leto, fetchFn) {
  var datoteka = path.join(mapa, "koledar-" + drzava + "-" + leto + ".json");
  try { return JSON.parse(fs.readFileSync(datoteka, "utf8")); } catch (_) {}
  var k = await tipDneva.pridobiKoledar(drzava, leto + "-01-01", leto + "-12-31", fetchFn);
  fs.mkdirSync(mapa, { recursive: true });
  lokalno.pisiJson(datoteka, k);
  return k;
}

/* Najprej lokalni OSRM; če ne teče, javni preizkusni strežnik (samo za
   preizkus — za redno rabo je treba zagnati lokalnega). */
async function poisciPot(od, doT, drzava, o) {
  var urlji = [];
  var nastavljen = osrm.urlZaDrzavo(drzava);
  urlji.push({ url: nastavljen || LOKALNI_OSRM[drzava], vir: "lokalni" });
  if (o.dovoliJavniOsrm !== false && process.env.PROMET_OSRM_JAVNI !== "0") urlji.push({ url: JAVNI_OSRM, vir: "javni_preizkusni" });
  var zadnja = null;
  for (var u of urlji) {
    try {
      var p = await osrm.pot(od, doT, { url: u.url, fetch: o.fetch });
      return Object.assign(p, { virPoti: u.vir });
    } catch (e) {
      zadnja = e;
      // Če lokalni strežnik odgovori, a poti ni, je to resen rezultat.
      if (/pot ni najdena/.test(e.message)) break;
    }
  }
  var err = new Error("Poti ni bilo mogoče izračunati: " + (zadnja ? zadnja.message : "ni strežnika"));
  err.code = "POT_NI_NA_VOLJO";
  throw err;
}

/* vhod: { izhodisce, cilj (naslova), datum "YYYY-MM-DD", prihod "HH:mm", jezik } */
async function napovejNalog(vhod, opcije) {
  var o = opcije || {};
  var mapa = o.mapa || lokalno.PRIVZETA_MAPA;
  var v = vhod || {};
  var izhodisce = String(v.izhodisce || "").trim().slice(0, 300);
  var cilj = String(v.cilj || "").trim().slice(0, 300);
  if (!izhodisce) throw napakaVnosa("Vnesite izhodišče (od kod se odpravite).");
  if (!cilj) throw napakaVnosa("Vnesite naslov stranke.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.datum || ""))) throw napakaVnosa("Izberite datum naloga.");
  if (!/^\d{2}:\d{2}$/.test(String(v.prihod || ""))) throw napakaVnosa("Vnesite uro prihoda (HH:MM).");

  var predpomnilnik = path.join(mapa, "geokode.json");
  var od = await geokodiranje.poisci(izhodisce, { predpomnilnik: predpomnilnik, fetch: o.fetch });
  var doT = await geokodiranje.poisci(cilj, { predpomnilnik: predpomnilnik, fetch: o.fetch });
  var drzava = doT.drzava === "DE" ? "DE" : "SI";
  var tz = profilMod.CASOVNI_PAS[drzava];
  var prihod = luxon.DateTime.fromISO(v.datum + "T" + v.prihod, { zone: tz });
  if (!prihod.isValid) throw napakaVnosa("Datum ali ura prihoda ni veljavna.");

  var pot = await poisciPot(od, doT, drzava, o);
  var kol = await koledar(mapa, drzava, prihod.year, o.fetch);
  // Profil za DE ne loči šolskih počitnic (so po deželah).
  if (drzava === "DE") kol = { prazniki: kol.prazniki, solskePocitnice: [] };
  var d = lokalno.preberiDogodke(mapa, o.zdajMs || Date.now(), 2);
  var r = napoved.izracunajOdhod({
    prihod: prihod.toISO(), drzava: drzava, regija: doT.regija, koledar: kol,
    pot: pot, profil: lokalno.preberiProfil(mapa), dogodki: d.dogodki
  });
  var jezik = v.jezik === "de" ? "de" : "sl";
  return Object.assign({}, r, {
    razlogi: r.razlogi.slice(0, 5),
    sporocilo: napoved.sporocilo(r, jezik),
    izhodisce: od.prikaz,
    cilj: doT.prikaz,
    izhodisceTocka: [od.lon, od.lat],
    ciljTocka: [doT.lon, doT.lat],
    ciljPriblizno: !!doT.priblizno,
    ciljIskano: doT.iskano || null,
    geometrija: poenostavi(pot.tocke, 200),
    drzava: drzava,
    razdaljaKm: Math.round(pot.razdaljaM / 100) / 10,
    virPoti: pot.virPoti,
    opozorilaPodatkov: d.opozorila
  });
}

/* Za zemljevid: največ ~200 točk, [lon, lat] z 5 decimalkami (~1 m). */
function poenostavi(tocke, najvec) {
  var n = tocke.length;
  var korak = Math.max(1, Math.ceil(n / (najvec || 200)));
  var out = [];
  for (var i = 0; i < n; i += korak) out.push([+tocke[i].lon.toFixed(5), +tocke[i].lat.toFixed(5)]);
  var zadnja = tocke[n - 1];
  if (n && (i - korak) !== n - 1) out.push([+zadnja.lon.toFixed(5), +zadnja.lat.toFixed(5)]);
  return out;
}

function stanje(opcije) {
  var o = opcije || {};
  var mapa = o.mapa || lokalno.PRIVZETA_MAPA;
  var zdaj = o.zdajMs || Date.now();
  var z = lokalno.preberiZgodovino(mapa, new Date(zdaj - lokalno.HRAMBA_DNI * 86400000).toISOString());
  var profil = lokalno.preberiProfil(mapa);
  var minVzorcev = napoved.PRIVZETO.minVzorcev;
  var viri = ["dars", "autobahn"].map(function (vir) {
    var vsi = z.zajemi.filter(function (x) { return x.vir === vir; });
    var zadnji = vsi[vsi.length - 1] || null;
    var delavnik = profil.pokritost.filter(function (p) { return p.vir === vir && p.tip_dneva === "delavnik" && p.n_vzorcev >= minVzorcev; }).length;
    return {
      vir: vir,
      zajemov: vsi.length,
      uspesnih: vsi.filter(function (x) { return x.uspeh; }).length,
      zadnji: zadnji ? { cas: zadnji.cas, uspeh: zadnji.uspeh } : null,
      // delež 15-min intervalov delavnika med 6:00 in 20:00 z dovolj meritvami
      pokritostDelavnik: Math.round(Math.min(1, delavnik / 56) * 100)
    };
  });
  var zadnjiCas = viri.map(function (v) { return v.zadnji && Date.parse(v.zadnji.cas); }).filter(Boolean);
  var zadnji = zadnjiCas.length ? Math.max.apply(null, zadnjiCas) : null;
  return { viri: viri, zbiralnikTece: !!zadnji && zdaj - zadnji < 40 * 60000, zadnjiZajem: zadnji ? new Date(zadnji).toISOString() : null };
}

module.exports = { napovejNalog: napovejNalog, stanje: stanje, poenostavi: poenostavi, poisciPot: poisciPot, JAVNI_OSRM: JAVNI_OSRM };
