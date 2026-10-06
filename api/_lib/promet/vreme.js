"use strict";

/* Vremenska napoved za uro vožnje (MET Norway Locationforecast 2.0).
   Brezplačno, tudi za komercialno rabo (CC BY 4.0 / NLOD), brez ključa;
   pogoj je prepoznaven User-Agent in predpomnjenje. Pokriva SI in DE.
   Vir: https://api.met.no/weatherapi/locationforecast/2.0/documentation

   Razvrstitev padavin in faktorji časa vožnje so iz raziskave
   (docs/PROMET-RAZISKAVA.md, poglavje 4): HCM, FHWA, nemška FCD študija,
   London. Uporabljen je stolpec »regionalne ceste«; ko bo dovolj lastnih
   voženj z zabeleženim vremenom, se faktorji izračunajo iz njih. */

var skupno = require("./viri/skupno");

var URL_MET = process.env.PROMET_VREME_URL || "https://api.met.no/weatherapi/locationforecast/2.0/compact";
var VELJAVNOST_MS = 30 * 60 * 1000;
var predpomnilnik = new Map();

var RAZREDI = {
  suho: { faktor: 1, opis: { sl: "suho", de: "trocken" } },
  rahel_dez: { faktor: 1.03, opis: { sl: "rahel dež", de: "leichter Regen" } },
  zmeren_dez: { faktor: 1.06, opis: { sl: "dež", de: "Regen" } },
  mocan_dez: { faktor: 1.12, opis: { sl: "močan dež", de: "Starkregen" } },
  rahel_sneg: { faktor: 1.12, opis: { sl: "sneg", de: "Schnee" } },
  mocan_sneg: { faktor: 1.3, opis: { sl: "močan sneg ali poledica", de: "starker Schnee oder Glätte" } },
  megla: { faktor: 1.1, opis: { sl: "megla", de: "Nebel" } }
};

/* Čista funkcija: simbol MET Norway + padavine (mm v uri) + temperatura -> razred. */
function razvrsti(simbol, padavineMm, temperatura) {
  var s = String(simbol || "").toLowerCase();
  var mm = Number(padavineMm) || 0;
  var t = Number(temperatura);
  var mokro = mm >= 0.1 || /rain|snow|sleet|showers/.test(s);
  if (/snow|sleet/.test(s) || (mokro && Number.isFinite(t) && t <= 0.5)) {
    return /heavy/.test(s) || mm >= 2 || (Number.isFinite(t) && t <= 0.5 && /rain|sleet/.test(s)) ? "mocan_sneg" : "rahel_sneg";
  }
  if (/heavyrain/.test(s) || mm >= 7.5) return "mocan_dez";
  if (mm >= 2.5) return "zmeren_dez";
  if (mokro) return "rahel_dez";
  if (/fog/.test(s)) return "megla";
  return "suho";
}

/* Čista funkcija: odgovor MET -> vreme za uro, ki vsebuje casIso. */
function zaUro(data, casIso) {
  var vrste = data && data.properties && Array.isArray(data.properties.timeseries) ? data.properties.timeseries : null;
  if (!vrste) throw skupno.napakaVira("met.no", "odgovor nima časovne vrste");
  var cilj = Date.parse(casIso);
  var izbran = null;
  for (var i = 0; i < vrste.length; i++) {
    var t = Date.parse(vrste[i].time);
    if (t <= cilj && cilj - t < 6 * 3600 * 1000) izbran = vrste[i];
    if (t > cilj) break;
  }
  if (!izbran) return null; // izven obdobja napovedi
  var d = izbran.data || {};
  var naslednja = d.next_1_hours || d.next_6_hours || {};
  var mm = naslednja.details && naslednja.details.precipitation_amount;
  if (!d.next_1_hours && d.next_6_hours && mm != null) mm = mm / 6; // povprečje na uro
  var temp = d.instant && d.instant.details ? d.instant.details.air_temperature : null;
  var simbol = naslednja.summary ? naslednja.summary.symbol_code : "";
  var razred = razvrsti(simbol, mm, temp);
  return { razred: razred, faktor: RAZREDI[razred].faktor, padavineMmH: mm == null ? null : Math.round(mm * 10) / 10, temperatura: temp, simbol: simbol, cas: izbran.time, vir: "met.no" };
}

async function napoved(lat, lon, casIso, opcije) {
  var o = opcije || {};
  var la = Number(lat).toFixed(2);
  var lo = Number(lon).toFixed(2);
  var kljuc = la + "," + lo;
  var zdaj = o.zdajMs || Date.now();
  var p = predpomnilnik.get(kljuc);
  var data;
  if (p && zdaj - p.cas < VELJAVNOST_MS) data = p.data;
  else {
    var f = o.fetch || fetch;
    data = await skupno.preberiJson("met.no", URL_MET + "?lat=" + la + "&lon=" + lo, function (u, opts) {
      // MET Norway zahteva prepoznaven User-Agent z načinom stika.
      return f(u, Object.assign({}, opts, { headers: Object.assign({}, opts && opts.headers, { "user-agent": "UspesniJezek-promet/1.0 https://uspesni-jezek.vercel.app" }) }));
    });
    predpomnilnik.set(kljuc, { cas: zdaj, data: data });
  }
  return zaUro(data, casIso);
}

module.exports = { napoved: napoved, razvrsti: razvrsti, zaUro: zaUro, RAZREDI: RAZREDI, _ponastavi: function () { predpomnilnik.clear(); } };
