"use strict";

var luxon = require("luxon");

/* Tip dneva določa, kateri naučeni profil velja. Praznike in šolske
   počitnice dobimo iz OpenHolidays API (brezplačno, brez ključa) in jih
   podamo kot podatke, zato je izračun povsem determinističen. */

var TIPI = ["delavnik", "petek", "sobota", "nedelja_praznik", "pocitnice_delavnik"];
var OPENHOLIDAYS = "https://openholidaysapi.org";

function vObdobju(datum, z) {
  return datum >= z.startDate && datum <= z.endDate;
}

function velja(z, regija) {
  if (z.nationwide !== false) return true;
  if (!regija) return false;
  return (z.subdivisions || []).some(function (s) { return s && s.code === regija; });
}

/* datum: "YYYY-MM-DD" (lokalni datum), koledar: { prazniki: [], solskePocitnice: [] } */
function tipDneva(datum, koledar, regija) {
  var dt = luxon.DateTime.fromISO(String(datum), { zone: "utc" });
  if (!dt.isValid) throw new Error("Neveljaven datum: " + datum);
  var d = dt.toISODate();
  var k = koledar || {};
  var praznik = (k.prazniki || []).some(function (z) { return vObdobju(d, z) && velja(z, regija); });
  if (praznik || dt.weekday === 7) return "nedelja_praznik";
  if (dt.weekday === 6) return "sobota";
  var pocitnice = (k.solskePocitnice || []).some(function (z) { return vObdobju(d, z) && velja(z, regija); });
  if (pocitnice) return "pocitnice_delavnik";
  if (dt.weekday === 5) return "petek";
  return "delavnik";
}

function normalizirajZapis(z) {
  if (!z || typeof z.startDate !== "string" || typeof z.endDate !== "string") return null;
  return {
    startDate: z.startDate.slice(0, 10),
    endDate: z.endDate.slice(0, 10),
    nationwide: z.nationwide !== false,
    subdivisions: Array.isArray(z.subdivisions) ? z.subdivisions.map(function (s) { return { code: s && s.code }; }) : []
  };
}

async function pridobiKoledar(drzava, od, doDatum, fetchFn) {
  var f = fetchFn || fetch;
  var q = "?countryIsoCode=" + encodeURIComponent(drzava) + "&validFrom=" + od + "&validTo=" + doDatum;
  var out = {};
  var poti = { prazniki: "/PublicHolidays", solskePocitnice: "/SchoolHolidays" };
  for (var kljuc of Object.keys(poti)) {
    var res = await f(OPENHOLIDAYS + poti[kljuc] + q, { headers: { accept: "application/json" } });
    if (!res.ok) {
      var err = new Error("OpenHolidays " + poti[kljuc] + " je vrnil HTTP " + res.status);
      err.code = "ZUNANJI_VIR";
      throw err;
    }
    var data = await res.json();
    if (!Array.isArray(data)) {
      var e2 = new Error("OpenHolidays " + poti[kljuc] + " ni vrnil seznama.");
      e2.code = "ZUNANJI_VIR";
      throw e2;
    }
    out[kljuc] = data.map(normalizirajZapis).filter(Boolean);
  }
  return out;
}

module.exports = { TIPI: TIPI, tipDneva: tipDneva, pridobiKoledar: pridobiKoledar, normalizirajZapis: normalizirajZapis };
