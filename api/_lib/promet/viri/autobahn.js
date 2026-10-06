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
  var opazovanja = [];
  var napake = [];
  var dogodki = [];
  var napakeDogodkov = 0;
  for (var cesta of ceste) {
    var osnova = OSNOVA + "/" + encodeURIComponent(cesta) + "/services/";
    try {
      opazovanja = opazovanja.concat(razcleniOpozorila(cesta, await skupno.preberiJson(VIR, osnova + "warning", o.fetch)));
    } catch (e) {
      napake.push({ cesta: cesta, napaka: e.message });
    }
    if (o.brezDogodkov) continue;
    for (var kljuc of ["closure", "roadworks"]) {
      try {
        dogodki = dogodki.concat(razcleniDogodke(cesta, await skupno.preberiJson(VIR, osnova + kljuc, o.fetch), kljuc));
      } catch (_) {
        napakeDogodkov++;
      }
    }
  }
  // Dela/zapore ne vplivajo na uspeh zajema zastojev; nepopoln seznam pa ne
  // sme prepisati zadnjega popolnega (napakeDogodkov > 0).
  return { vir: VIR, opazovanja: opazovanja, napake: napake, dogodki: o.brezDogodkov ? undefined : dogodki,
    napakeDogodkov: napakeDogodkov, pokritost: ceste.length - napake.length, skupaj: ceste.length };
}

module.exports = { VIR: VIR, OSNOVA: OSNOVA, razcleniOpozorila: razcleniOpozorila, razcleniDogodke: razcleniDogodke, seznamCest: seznamCest, zajemi: zajemi };
