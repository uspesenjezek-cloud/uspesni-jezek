"use strict";

/* Iz zgodovine zajemov zgradi profil zastojev:
   (vir, celica, tip dneva, 15-min interval) -> verjetnost zastoja, mediana, p85.
   Vsak uspešen zajem vira šteje kot en vzorec za vse celice tega vira;
   celica brez opazovanja v tem zajemu ima zamudo 0. Izračun je čista
   funkcija vhodnih podatkov (brez naključja, brez ure sistema). */

var luxon = require("luxon");
var tipDneva = require("./tip-dneva");

var INTERVAL_MIN = 15;
var VERZIJA = 1;
var PRIVZETA_ZAMUDA_CELICE_S = 120; // zastoj brez navedene zamude: ~2 km v koloni
var CASOVNI_PAS = { SI: "Europe/Ljubljana", DE: "Europe/Berlin" };
var DRZAVA_VIRA = { dars: "SI", autobahn: "DE" };

function interval(dtLokalno) {
  return Math.floor((dtLokalno.hour * 60 + dtLokalno.minute) / INTERVAL_MIN);
}

function kvantil(urejeneNenicelne, n, q) {
  // nearest-rank nad n vzorci, kjer je (n - urejeneNenicelne.length) ničel na začetku
  if (!n) return 0;
  var rang = Math.max(1, Math.ceil(q * n));
  var nicle = n - urejeneNenicelne.length;
  if (rang <= nicle) return 0;
  return urejeneNenicelne[rang - nicle - 1];
}

function kontekstZajema(z, koledarji) {
  var drzava = z.drzava || DRZAVA_VIRA[z.vir];
  var tz = CASOVNI_PAS[drzava] || "Europe/Ljubljana";
  var dt = luxon.DateTime.fromISO(String(z.cas), { zone: "utc" }).setZone(tz);
  if (!dt.isValid) return null;
  return { tip: tipDneva.tipDneva(dt.toISODate(), (koledarji || {})[drzava]), interval: interval(dt) };
}

/* zajemi: [{id, vir, cas (ISO), uspeh}], opazovanja: [{zajemId, vir, celica, zamudaS}] */
function zgradiProfil(zajemi, opazovanja, koledarji) {
  var kontekst = new Map();
  var pokritost = new Map();
  (zajemi || []).forEach(function (z) {
    if (!z || z.uspeh === false) return;
    var k = kontekstZajema(z, koledarji);
    if (!k) return;
    kontekst.set(String(z.id), Object.assign({ vir: z.vir }, k));
    var kp = z.vir + "|" + k.tip + "|" + k.interval;
    pokritost.set(kp, (pokritost.get(kp) || 0) + 1);
  });

  // vsota zamude na (zajem, celica)
  var naZajem = new Map();
  (opazovanja || []).forEach(function (o) {
    var k = kontekst.get(String(o.zajemId));
    if (!k || !o.celica) return;
    var kljuc = String(o.zajemId) + "|" + o.celica;
    var z = o.zamudaS == null ? PRIVZETA_ZAMUDA_CELICE_S : Math.max(0, Number(o.zamudaS) || 0);
    naZajem.set(kljuc, (naZajem.get(kljuc) || 0) + z);
  });

  var vzorci = new Map();
  naZajem.forEach(function (zamuda, kljuc) {
    var deli = kljuc.split("|");
    var k = kontekst.get(deli[0]);
    var kv = k.vir + "|" + deli[1] + "|" + k.tip + "|" + k.interval;
    if (!vzorci.has(kv)) vzorci.set(kv, []);
    vzorci.get(kv).push(zamuda);
  });

  var vrstice = [];
  Array.from(vzorci.keys()).sort().forEach(function (kv) {
    var d = kv.split("|");
    var n = pokritost.get(d[0] + "|" + d[2] + "|" + d[3]) || 0;
    var s = vzorci.get(kv).slice().sort(function (a, b) { return a - b; });
    vrstice.push({
      vir: d[0], celica: d[1], tip_dneva: d[2], interval: Number(d[3]),
      n_vzorcev: n,
      p_zastoja: Math.round(s.length / n * 1000) / 1000,
      mediana_s: Math.round(kvantil(s, n, 0.5)),
      p85_s: Math.round(kvantil(s, n, 0.85)),
      verzija: VERZIJA
    });
  });

  var pokr = Array.from(pokritost.keys()).sort().map(function (kp) {
    var d = kp.split("|");
    return { vir: d[0], tip_dneva: d[1], interval: Number(d[2]), n_vzorcev: pokritost.get(kp) };
  });
  return { vrstice: vrstice, pokritost: pokr, verzija: VERZIJA };
}

module.exports = { zgradiProfil: zgradiProfil, kvantil: kvantil, INTERVAL_MIN: INTERVAL_MIN, CASOVNI_PAS: CASOVNI_PAS, DRZAVA_VIRA: DRZAVA_VIRA, PRIVZETA_ZAMUDA_CELICE_S: PRIVZETA_ZAMUDA_CELICE_S, VERZIJA: VERZIJA };
