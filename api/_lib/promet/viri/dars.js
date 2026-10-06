"use strict";

/* DARS / Prometno-informacijski center (www.promet.si) — brezplačni B2B
   viri. Dogodki (zastoji, dela, zapore) so v GeoJSON brez registracije;
   števci prometa in potovalni časi v DATEX II zahtevajo brezplačno
   registracijo na NAP (www.nap.si) in jih dodamo, ko dobimo dostop.

   Koordinate so lahko v WGS84 ali v slovenskem D96/TM (EPSG:3794).
   Oboje podpiramo; drugo pretvorimo z inverzno transverzalno Mercatorjevo. */

var skupno = require("./skupno");

var VIR = "dars";
var URL_DOGODKI = process.env.PROMET_DARS_DOGODKI_URL || "https://www.promet.si/dc/b2b.dogodki.geojson.sl_SI";

/* Inverzna TM (Snyder 1987) za GRS80, parametri D96/TM. */
function d96tmVWgs84(e, n) {
  var a = 6378137;
  var f = 1 / 298.257222101;
  var k0 = 0.9999;
  var lon0 = 15 * Math.PI / 180;
  var e2 = f * (2 - f);
  var ep2 = e2 / (1 - e2);
  var x = e - 500000;
  var y = n + 5000000;
  var M = y / k0;
  var mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
  var e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  var phi1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) +
    (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu) +
    (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu) + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);
  var C1 = ep2 * Math.pow(Math.cos(phi1), 2);
  var T1 = Math.pow(Math.tan(phi1), 2);
  var N1 = a / Math.sqrt(1 - e2 * Math.pow(Math.sin(phi1), 2));
  var R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.pow(Math.sin(phi1), 2), 1.5);
  var D = x / (N1 * k0);
  var lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4) / 24 +
    (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6) / 720);
  var lon = lon0 + (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 +
    (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5) / 120) / Math.cos(phi1);
  return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
}

function vTocko(par) {
  if (!Array.isArray(par) || par.length < 2) return null;
  var a = Number(par[0]);
  var b = Number(par[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) <= 180 && Math.abs(b) <= 90) return { lat: b, lon: a };
  // D96/TM: E ~ 370 000–630 000, N ~ 25 000–200 000; nekateri viri zamenjajo osi.
  var e = a;
  var n = b;
  if (a < 300000 && b > 300000) { e = b; n = a; }
  if (e < 300000 || e > 700000 || n < 0 || n > 250000) return null;
  return d96tmVWgs84(e, n);
}

function tockeIzGeometrije(g) {
  if (!g || !g.coordinates) return [];
  if (g.type === "Point") return [vTocko(g.coordinates)].filter(Boolean);
  if (g.type === "LineString" || g.type === "MultiPoint") return g.coordinates.map(vTocko).filter(Boolean);
  if (g.type === "MultiLineString") return [].concat.apply([], g.coordinates).map(vTocko).filter(Boolean);
  return [];
}

function lastnost(p, imena) {
  var kljuci = Object.keys(p || {});
  for (var ime of imena) {
    var k = kljuci.find(function (x) { return x.toLowerCase() === ime; });
    if (k && p[k] != null && p[k] !== "") return String(p[k]);
  }
  return "";
}

var ZASTOJ_RE = /zastoj|zastoji|kolona|gost promet|oviran promet|čakaln|cakaln|congestion|queue|stau/i;
var DELA_RE = /dela na cesti|delovna zapora|vzdrževalna dela|roadworks|baustelle/i;
var ZAPORA_RE = /zaprt|zapora ceste|closed|sperrung/i;

/* Iz besedila izlušči zamudo v minutah; pri razponu vzame zgornjo mejo. */
function zamudaIzBesedila(besedilo) {
  var t = String(besedilo || "").toLowerCase();
  var ura = t.match(/(\d+(?:[.,]\d+)?)\s*(?:ur[aoe]?|h)\b/);
  var razpon = t.match(/(\d+)\s*(?:-|–|do)\s*(\d+)\s*min/);
  if (razpon) return Number(razpon[2]);
  var min = t.match(/(\d+)\s*min/);
  if (min) return Number(min[1]);
  if (ura) return Math.round(Number(ura[1].replace(",", ".")) * 60);
  return null;
}

function razvrsti(p) {
  var besedilo = [lastnost(p, ["kategorija", "category", "vzrok", "tip", "type"]), lastnost(p, ["opis", "description", "naslov", "title"])].join(" ");
  if (ZASTOJ_RE.test(besedilo)) return "zastoj";
  if (ZAPORA_RE.test(besedilo)) return "zapora";
  if (DELA_RE.test(besedilo)) return "dela";
  return null;
}

/* Čista funkcija: GeoJSON dogodkov -> { opazovanja (zastoji), dogodki (dela/zapore) }. */
function razcleniDogodke(data) {
  if (!data || !Array.isArray(data.features)) throw skupno.napakaVira(VIR, "odgovor nima polja features");
  var opazovanja = [];
  var dogodki = [];
  data.features.forEach(function (ft) {
    var p = (ft && ft.properties) || {};
    var tip = razvrsti(p);
    if (!tip) return;
    var tocke = tockeIzGeometrije(ft.geometry);
    if (!tocke.length) return;
    var opis = lastnost(p, ["opis", "description", "naslov", "title"]);
    var cesta = lastnost(p, ["cesta", "road", "roadname"]);
    var id = lastnost(p, ["id", "idDogodka", "identifier"].map(function (x) { return x.toLowerCase(); }));
    if (tip === "zastoj") {
      var zMin = zamudaIzBesedila(opis);
      opazovanja = opazovanja.concat(skupno.opazovanjaIzGeometrije(tocke, {
        vir: VIR, drzava: "SI", cesta: cesta, tip: "zastoj",
        zamudaS: zMin != null ? zMin * 60 : null, hitrostKmh: null, zunanjiId: id
      }));
    } else {
      dogodki.push({ vir: VIR, drzava: "SI", cesta: cesta, tip: tip, naslov: cesta, opis: opis,
        zacetek: lastnost(p, ["veljavnostod", "zacetek", "vneseno", "start"]) || null, tocke: tocke, zaprto: tip === "zapora", zunanjiId: id });
    }
  });
  return { opazovanja: opazovanja, dogodki: dogodki };
}

async function zajemi(opcije) {
  var o = opcije || {};
  try {
    var data = await skupno.preberiJson(VIR, o.url || URL_DOGODKI, o.fetch);
    var r = razcleniDogodke(data);
    return { vir: VIR, opazovanja: r.opazovanja, dogodki: r.dogodki, napakeDogodkov: 0, napake: [], pokritost: 1, skupaj: 1 };
  } catch (e) {
    return { vir: VIR, opazovanja: [], dogodki: [], napakeDogodkov: 1, napake: [{ napaka: e.message }], pokritost: 0, skupaj: 1 };
  }
}

module.exports = { VIR: VIR, URL_DOGODKI: URL_DOGODKI, d96tmVWgs84: d96tmVWgs84, vTocko: vTocko, tockeIzGeometrije: tockeIzGeometrije, razvrsti: razvrsti, razcleniDogodke: razcleniDogodke, zamudaIzBesedila: zamudaIzBesedila, zajemi: zajemi };
