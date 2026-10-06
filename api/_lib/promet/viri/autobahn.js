"use strict";

/* Autobahn GmbH des Bundes — javni, brezplačen API brez ključa
   (https://autobahn.api.bund.dev). Za vsako avtocesto vrne aktualna
   opozorila o zastojih (warning), dela (roadworks) in zapore (closure).
   Opomba: pokriva samo avtoceste (A*), ne mestnih in deželnih cest. */

var skupno = require("./skupno");

var VIR = "autobahn";
var OSNOVA = "https://verkehr.autobahn.de/o/autobahn";
var ZASTOJ_TIPI = ["STATIONARY_TRAFFIC", "QUEUING_TRAFFIC", "SLOW_TRAFFIC", "HEAVY_TRAFFIC"];

function tockeIzOpozorila(w) {
  var g = w && w.geometry;
  if (g && g.type === "LineString" && Array.isArray(g.coordinates)) {
    return g.coordinates.map(function (c) { return { lat: Number(c[1]), lon: Number(c[0]) }; });
  }
  if (g && g.type === "Point" && Array.isArray(g.coordinates)) {
    return [{ lat: Number(g.coordinates[1]), lon: Number(g.coordinates[0]) }];
  }
  if (w && w.coordinate) return [{ lat: Number(w.coordinate.lat), lon: Number(w.coordinate.long) }];
  return [];
}

function jeZastoj(w) {
  if (ZASTOJ_TIPI.indexOf(String(w.abnormalTrafficType || "").toUpperCase()) !== -1) return true;
  return /\bstau\b|stockender verkehr|zähfließend/i.test([w.title, w.subtitle].concat(w.description || []).join(" "));
}

/* Čista funkcija: odgovor /services/warning -> opazovanja zastojev. */
function razcleniOpozorila(cesta, data) {
  if (!data || !Array.isArray(data.warning)) throw skupno.napakaVira(VIR, "odgovor za " + cesta + " nima polja warning");
  var out = [];
  data.warning.forEach(function (w) {
    if (!w || w.future === true || String(w.future) === "true" || !jeZastoj(w)) return;
    var zamudaMin = skupno.stevilo(w.delayTimeValue);
    out = out.concat(skupno.opazovanjaIzGeometrije(tockeIzOpozorila(w), {
      vir: VIR,
      drzava: "DE",
      cesta: cesta,
      tip: "zastoj",
      zamudaS: zamudaMin != null ? Math.round(zamudaMin * 60) : null,
      hitrostKmh: skupno.stevilo(w.averageSpeed),
      zunanjiId: String(w.identifier || "")
    }));
  });
  return out;
}

/* Dela in zapore — za napoved za jutri (znani dogodki, ne profil). */
function razcleniDogodke(cesta, data, kljuc) {
  var seznam = data && data[kljuc];
  if (!Array.isArray(seznam)) throw skupno.napakaVira(VIR, "odgovor za " + cesta + " nima polja " + kljuc);
  return seznam.map(function (w) {
    return {
      vir: VIR,
      drzava: "DE",
      cesta: cesta,
      tip: kljuc === "closure" ? "zapora" : "dela",
      naslov: String(w.title || ""),
      opis: (w.description || []).join(" "),
      zacetek: w.startTimestamp || null,
      tocke: tockeIzOpozorila(w),
      zaprto: String(w.isBlocked) === "true",
      zunanjiId: String(w.identifier || "")
    };
  });
}

async function vzporedno(seznam, n, fn) {
  var out = new Array(seznam.length);
  var i = 0;
  async function delavec() { while (i < seznam.length) { var j = i++; out[j] = await fn(seznam[j]); } }
  await Promise.all(Array.from({ length: Math.min(n, seznam.length) }, delavec));
  return out;
}

async function seznamCest(fetchFn) {
  var data = await skupno.preberiJson(VIR, OSNOVA + "/", fetchFn);
  if (!data || !Array.isArray(data.roads)) throw skupno.napakaVira(VIR, "seznam cest ni na voljo");
  return data.roads.map(function (r) { return String(r).trim(); }).filter(function (r) { return /^A\d+$/.test(r); }).sort();
}

async function zajemi(opcije) {
  var o = opcije || {};
  var ceste;
  try {
    ceste = o.ceste || await seznamCest(o.fetch);
  } catch (e) {
    return { vir: VIR, opazovanja: [], dogodki: [], napakeDogodkov: 1, napake: [{ napaka: e.message }], pokritost: 0, skupaj: 0 };
  }
  var napakeDogodkov = 0;
  // Ceste obdelamo vzporedno (do 8 hkrati), da zajem vseh ~100 avtocest
  // ostane v časovni omejitvi strežniške funkcije. Rezultat je urejen po
  // vrstnem redu cest, zato ni odvisen od hitrosti odgovorov.
  var poCestah = await vzporedno(ceste, o.vzporedno || 8, async function (cesta) {
    var osnova = OSNOVA + "/" + encodeURIComponent(cesta) + "/services/";
    var r = { opazovanja: [], dogodki: [], napaka: null };
    try {
      r.opazovanja = razcleniOpozorila(cesta, await skupno.preberiJson(VIR, osnova + "warning", o.fetch));
    } catch (e) {
      r.napaka = { cesta: cesta, napaka: e.message };
    }
    if (o.brezDogodkov) return r;
    for (var kljuc of ["closure", "roadworks"]) {
      try {
        r.dogodki = r.dogodki.concat(razcleniDogodke(cesta, await skupno.preberiJson(VIR, osnova + kljuc, o.fetch), kljuc));
      } catch (_) {
        napakeDogodkov++;
      }
    }
    return r;
  });
  var opazovanja = [].concat.apply([], poCestah.map(function (r) { return r.opazovanja; }));
  var dogodki = [].concat.apply([], poCestah.map(function (r) { return r.dogodki; }));
  var napake = poCestah.map(function (r) { return r.napaka; }).filter(Boolean);
  // Dela/zapore ne vplivajo na uspeh zajema zastojev; nepopoln seznam pa ne
  // sme prepisati zadnjega popolnega (napakeDogodkov > 0).
  return { vir: VIR, opazovanja: opazovanja, napake: napake, dogodki: o.brezDogodkov ? undefined : dogodki,
    napakeDogodkov: napakeDogodkov, pokritost: ceste.length - napake.length, skupaj: ceste.length };
}

module.exports = { VIR: VIR, OSNOVA: OSNOVA, razcleniOpozorila: razcleniOpozorila, razcleniDogodke: razcleniDogodke, seznamCest: seznamCest, zajemi: zajemi };
