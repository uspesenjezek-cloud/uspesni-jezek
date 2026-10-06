"use strict";

/* Čas poti v prostem toku iz lastnega OSRM strežnika nad OpenStreetMap.
   Javni demo router.project-osrm.org ni za produkcijo.
   Na enem računalniku lahko tečeta ločena strežnika za SI in DE:
   PROMET_OSRM_URL_SI, PROMET_OSRM_URL_DE; skupni PROMET_OSRM_URL je rezerva. */

function urlZaDrzavo(drzava, env) {
  var e = env || process.env;
  var d = String(drzava || "").toUpperCase();
  return String((d && e["PROMET_OSRM_URL_" + d]) || e.PROMET_OSRM_URL || "").replace(/\/$/, "");
}

var skupno = require("./viri/skupno");

async function pot(od, doTocke, opcije) {
  var o = opcije || {};
  var osnova = String(o.url || urlZaDrzavo(o.drzava)).replace(/\/$/, "");
  if (!osnova) {
    var err = new Error("OSRM ni nastavljen (PROMET_OSRM_URL_" + String(o.drzava || "SI").toUpperCase() + " ali PROMET_OSRM_URL).");
    err.code = "SERVER_NOT_CONFIGURED";
    throw err;
  }
  var koord = [od, doTocke].map(function (t) { return Number(t.lon).toFixed(6) + "," + Number(t.lat).toFixed(6); }).join(";");
  var data = await skupno.preberiJson("osrm", osnova + "/route/v1/driving/" + koord + "?overview=full&geometries=geojson&alternatives=false", o.fetch);
  var r = data && data.code === "Ok" && Array.isArray(data.routes) && data.routes[0];
  if (!r || !r.geometry || !Array.isArray(r.geometry.coordinates)) throw skupno.napakaVira("osrm", "pot ni najdena (" + (data && data.code) + ")");
  return {
    trajanjeProstoS: Math.round(r.duration),
    razdaljaM: Math.round(r.distance),
    tocke: r.geometry.coordinates.map(function (c) { return { lat: c[1], lon: c[0] }; })
  };
}

module.exports = { pot: pot, urlZaDrzavo: urlZaDrzavo };
