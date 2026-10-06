"use strict";

/* Podatki za zemljevid prometa v živo (GeoJSON za MapLibre).
   - DARS števci prometa (SI, avtoceste in državne ceste): barva po
     izmerjenem stanju prometa oziroma hitrosti.
   - DARS dogodki (SI): zastoji, dela, zapore.
   - Autobahn GmbH (DE avtoceste): zastoji kot črte, zapore.
   Ceste brez števca ostanejo nepobarvane: tam podatka nimamo in ga ne
   izmišljujemo. Rezultat se predpomni 3 minute (viri se osvežujejo
   na 1–5 minut). */

var skupno = require("./viri/skupno");
var dars = require("./viri/dars");
var autobahn = require("./viri/autobahn");

var URL_STEVCI = process.env.PROMET_DARS_STEVCI_URL || "https://www.promet.si/dc/b2b.stevci.geojson.sl_SI";
var VELJAVNOST_MS = 3 * 60 * 1000;
var predpomnilnik = null;
var vTeku = null;

/* Prvo polje, ki ustreza vzorcem po vrsti prednosti. */
function lastnost(p, vzorci) {
  var kljuci = Object.keys(p || {});
  var seznam = Array.isArray(vzorci) ? vzorci : [vzorci];
  for (var i = 0; i < seznam.length; i++) {
    var k = kljuci.find(function (x) { return seznam[i].test(x) && p[x] != null && p[x] !== ""; });
    if (k != null) return p[k];
  }
  return null;
}

function stevilo(v) {
  return skupno.stevilo(v);
}

/* Čista funkcija: barva iz opisa stanja ali hitrosti.
   Opis ima prednost (DARS ga izračuna iz hitrosti, razmika in zasedenosti). */
function barvaStevca(opis, hitrost, omejitev) {
  var t = String(opis || "").toLowerCase();
  if (/zastoj|kolona|stoječ|stoji|stau/.test(t)) return "rdece";
  if (/zgoščen|zgoscen|gost|oviran|počas|pocas|dense|slow/.test(t)) return "oranzno";
  if (/normal|prost|tekoč|tekoc|povečan|povecan|free|light/.test(t)) return "zeleno";
  var h = stevilo(hitrost);
  if (h == null || h <= 0) return "ni_podatka";
  var meja = stevilo(omejitev);
  var r = meja && meja > 0 ? h / meja : h / 100;
  if (r >= 0.7) return "zeleno";
  if (r >= 0.4) return "oranzno";
  return "rdece";
}

var RANG = { rdece: 3, oranzno: 2, zeleno: 1, ni_podatka: 0 };

/* Čista funkcija: GeoJSON števcev -> točke (ena na lokacijo, najslabši pas). */
function razcleniStevce(data) {
  if (!data || !Array.isArray(data.features)) throw skupno.napakaVira("dars-stevci", "odgovor nima polja features");
  var poLokaciji = new Map();
  data.features.forEach(function (ft) {
    var p = (ft && ft.properties) || {};
    var g = ft && ft.geometry;
    var t = g && g.type === "Point" ? dars.vTocko(g.coordinates) : null;
    if (!t) return;
    var opis = lastnost(p, [/stat.*opis/i, /stanje/i, /status.*opis/i]);
    var hitrost = lastnost(p, /(^|_)(hit|hitrost|speed|avgspeed)$/i);
    var omejitev = lastnost(p, /vmax|omejitev|limit/i);
    var barva = barvaStevca(typeof opis === "string" ? opis : "", hitrost, omejitev);
    var kljuc = t.lat.toFixed(4) + "," + t.lon.toFixed(4);
    var obstojeci = poLokaciji.get(kljuc);
    if (obstojeci && RANG[obstojeci.properties.barva] >= RANG[barva]) return;
    poLokaciji.set(kljuc, {
      type: "Feature",
      geometry: { type: "Point", coordinates: [+t.lon.toFixed(5), +t.lat.toFixed(5)] },
      properties: {
        vrsta: "stevec",
        barva: barva,
        cesta: String(lastnost(p, /cesta/i) || ""),
        opis: String(lastnost(p, [/lokacija/i, /title/i, /description/i]) || ""),
        stanje: typeof opis === "string" ? opis : "",
        hitrost: stevilo(hitrost)
      }
    });
  });
  return Array.from(poLokaciji.values()).sort(function (a, b) { return a.geometry.coordinates[0] - b.geometry.coordinates[0] || a.geometry.coordinates[1] - b.geometry.coordinates[1]; });
}

/* DARS dogodki -> točke (zastoji, dela, zapore). */
function dogodkiDars(data) {
  var r = dars.razcleniDogodke(data);
  var out = [];
  (data.features || []).forEach(function (ft) {
    var p = (ft && ft.properties) || {};
    var vrsta = dars.razvrsti(p);
    var tocke = dars.tockeIzGeometrije(ft.geometry);
    if (!vrsta || !tocke.length) return;
    out.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [+tocke[0].lon.toFixed(5), +tocke[0].lat.toFixed(5)] },
      properties: { vrsta: vrsta, barva: vrsta === "zastoj" ? "rdece" : "oranzno", cesta: String(p.Cesta || p.cesta || ""), opis: String(p.Opis || p.opis || p.Description || "") }
    });
  });
  return { tocke: out, steviloZastojev: r.opazovanja.length };
}

var BARVA_AB = { STATIONARY_TRAFFIC: "rdece", QUEUING_TRAFFIC: "rdece", SLOW_TRAFFIC: "oranzno", HEAVY_TRAFFIC: "oranzno" };

/* Autobahn opozorila -> črte zastojev. */
function opozorilaAutobahn(cesta, data) {
  return ((data && data.warning) || []).filter(function (w) {
    return w && String(w.future) !== "true" && BARVA_AB[String(w.abnormalTrafficType || "").toUpperCase()];
  }).map(function (w) {
    var g = w.geometry && w.geometry.type === "LineString" && w.geometry.coordinates.length >= 2
      ? { type: "LineString", coordinates: w.geometry.coordinates.map(function (c) { return [+Number(c[0]).toFixed(5), +Number(c[1]).toFixed(5)]; }) }
      : { type: "Point", coordinates: [Number(w.coordinate && w.coordinate.long), Number(w.coordinate && w.coordinate.lat)] };
    return {
      type: "Feature",
      geometry: g,
      properties: { vrsta: "zastoj", barva: BARVA_AB[String(w.abnormalTrafficType).toUpperCase()], cesta: cesta, opis: [w.title, w.subtitle].filter(Boolean).join(" · "),
        zamudaMin: skupno.stevilo(w.delayTimeValue), hitrost: skupno.stevilo(w.averageSpeed) }
    };
  }).filter(function (f) { return f.geometry.type === "LineString" || Number.isFinite(f.geometry.coordinates[0]); });
}

async function vzporedno(seznam, n, fn) {
  var out = new Array(seznam.length);
  var i = 0;
  async function delavec() { while (i < seznam.length) { var j = i++; out[j] = await fn(seznam[j]); } }
  await Promise.all(Array.from({ length: Math.min(n, seznam.length) }, delavec));
  return out;
}

function vCrto(tocke) {
  return tocke.length >= 2
    ? { type: "LineString", coordinates: tocke.map(function (t) { return [+t.lon.toFixed(5), +t.lat.toFixed(5)]; }) }
    : { type: "Point", coordinates: [+tocke[0].lon.toFixed(5), +tocke[0].lat.toFixed(5)] };
}

/* Barva odseka iz potovalnega časa: razmerje trenutni / prosti čas. */
function barvaPotovalnegaCasa(casS, prostoS) {
  if (!(prostoS > 0) || !(casS > 0)) return "ni_podatka";
  var r = casS / prostoS;
  if (r >= 1.5) return "rdece";
  if (r >= 1.15) return "oranzno";
  return "zeleno";
}

/* Slovenija prek NAP (osebni dostop): števci, potovalni časi, dogodki. */
async function zberiNap(f, viri) {
  var nap = require("./viri/nap");
  var features = [];
  var o = { fetch: f };
  try {
    var st = await nap.stevci(o);
    if (st) {
      st.forEach(function (s) {
        features.push({ type: "Feature", geometry: { type: "Point", coordinates: [+s.lon.toFixed(5), +s.lat.toFixed(5)] },
          properties: { vrsta: "stevec", barva: barvaStevca("", s.hitrost, 100), cesta: s.cesta, opis: s.ime, stanje: "", hitrost: s.hitrost } });
      });
      viri.push({ vir: "nap-stevci", ok: true, st: st.length });
    }
  } catch (e) { viri.push({ vir: "nap-stevci", ok: false, napaka: e.message }); }
  try {
    var pc = await nap.potovalniCasi(o);
    if (pc) {
      pc.forEach(function (c) {
        features.push({ type: "Feature", geometry: vCrto(c.tocke),
          properties: { vrsta: "potovalni_cas", barva: barvaPotovalnegaCasa(c.casS, c.prostoS), cesta: c.ime, opis: "Potovalni čas: " + Math.round(c.casS / 60) + " min",
            zamudaMin: c.prostoS > 0 ? Math.max(0, Math.round((c.casS - c.prostoS) / 60)) : null } });
      });
      viri.push({ vir: "nap-potovalni-casi", ok: true, st: pc.length });
    }
  } catch (e) { viri.push({ vir: "nap-potovalni-casi", ok: false, napaka: e.message }); }
  try {
    var dg = await nap.dogodki(o);
    if (dg) {
      dg.forEach(function (d) {
        features.push({ type: "Feature", geometry: vCrto(d.tocke),
          properties: { vrsta: d.vrsta, barva: d.barva, cesta: d.cesta, opis: d.opis, zamudaMin: d.zamudaMin } });
      });
      viri.push({ vir: "nap-dogodki", ok: true, st: dg.length });
    }
  } catch (e) { viri.push({ vir: "nap-dogodki", ok: false, napaka: e.message }); }
  return features;
}

async function zberi(f) {
  var viri = [];
  var features = [];
  if (require("./viri/nap").nastavljen()) {
    // Slovenija z osebnim dostopom NAP (števci, potovalni časi, dogodki).
    features = features.concat(await zberiNap(f, viri));
  } else {
    // Brez NAP: javni viri promet.si (brez prijave pogosto niso dosegljivi).
    try {
      var st = razcleniStevce(await skupno.preberiJson("dars-stevci", URL_STEVCI, f));
      features = features.concat(st);
      viri.push({ vir: "dars-stevci", ok: true, st: st.length });
    } catch (e) { viri.push({ vir: "dars-stevci", ok: false, napaka: e.message + " — nastavite dostop NAP (PROMET_NAP_*)" }); }
    try {
      var dg = dogodkiDars(await skupno.preberiJson("dars", dars.URL_DOGODKI, f));
      features = features.concat(dg.tocke);
      viri.push({ vir: "dars-dogodki", ok: true, st: dg.tocke.length });
    } catch (e) { viri.push({ vir: "dars-dogodki", ok: false, napaka: e.message + " — nastavite dostop NAP (PROMET_NAP_*)" }); }
  }
  try {
    var ceste = await autobahn.seznamCest(f);
    var napake = 0;
    var rez = await vzporedno(ceste, 8, async function (cesta) {
      try { return opozorilaAutobahn(cesta, await skupno.preberiJson("autobahn", autobahn.OSNOVA + "/" + encodeURIComponent(cesta) + "/services/warning", f)); }
      catch (_) { napake++; return []; }
    });
    var ab = [].concat.apply([], rez);
    features = features.concat(ab);
    viri.push({ vir: "autobahn", ok: napake === 0, st: ab.length, napaka: napake ? napake + " od " + ceste.length + " cest ni odgovorilo" : undefined });
  } catch (e) { viri.push({ vir: "autobahn", ok: false, napaka: e.message }); }
  return { type: "FeatureCollection", features: features, viri: viri };
}

async function zemljevid(opcije) {
  var o = opcije || {};
  var zdaj = o.zdajMs || Date.now();
  if (!o.brezPredpomnilnika && predpomnilnik && zdaj - predpomnilnik.casMs < VELJAVNOST_MS) return predpomnilnik.podatki;
  if (!vTeku) {
    vTeku = zberi(o.fetch || fetch).then(function (podatki) {
      podatki.posodobljeno = new Date(zdaj).toISOString();
      if (podatki.viri.some(function (v) { return v.ok; })) predpomnilnik = { casMs: zdaj, podatki: podatki };
      return podatki;
    }).finally(function () { vTeku = null; });
  }
  return vTeku;
}

module.exports = { zemljevid: zemljevid, razcleniStevce: razcleniStevce, barvaStevca: barvaStevca, barvaPotovalnegaCasa: barvaPotovalnegaCasa, opozorilaAutobahn: opozorilaAutobahn, dogodkiDars: dogodkiDars, URL_STEVCI: URL_STEVCI,
  _ponastavi: function () { predpomnilnik = null; vTeku = null; } };
