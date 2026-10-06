"use strict";

/* Čas poti v prostem toku iz lastnega OSRM strežnika nad OpenStreetMap
   (Slovenija + Nemčija). Javni demo router.project-osrm.org ni za
   produkcijo — PROMET_OSRM_URL mora kazati na lasten strežnik. */

var skupno = require("./viri/skupno");

async function pot(od, doTocke, opcije) {
  var o = opcije || {};
  var osnova = String(o.url || process.env.PROMET_OSRM_URL || "").replace(/\/$/, "");
  if (!osnova) {
    var err = new Error("PROMET_OSRM_URL ni nastavljen.");
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

module.exports = { pot: pot };
