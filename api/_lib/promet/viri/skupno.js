"use strict";

var celice = require("../celice");

function napakaVira(vir, sporocilo, vzrok) {
  var err = new Error(vir + ": " + sporocilo);
  err.code = "ZUNANJI_VIR";
  err.vir = vir;
  if (vzrok) err.cause = vzrok;
  return err;
}

async function preberiJson(vir, url, fetchFn, timeoutMs) {
  var f = fetchFn || fetch;
  var opts = { headers: { accept: "application/json", "user-agent": "UspesniJezek-promet/1.0 (+https://uspesni-jezek.vercel.app)" } };
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) opts.signal = AbortSignal.timeout(timeoutMs || 15000);
  var res;
  try { res = await f(url, opts); } catch (e) {
    var vzrok = e && (e.cause && (e.cause.code || e.cause.message) || e.name || e.message);
    throw napakaVira(vir, "povezava ni uspela" + (vzrok ? " (" + vzrok + ")" : "") + " — " + url, e);
  }
  if (!res.ok) throw napakaVira(vir, "HTTP " + res.status + " — " + url);
  // Besedilo najprej preberemo samo, da pri ne-JSON odgovoru (npr. HTML
  // strani po selitvi naslova) pokažemo, kaj je vir dejansko vrnil.
  var besedilo = typeof res.text === "function" ? await res.text() : null;
  try { return besedilo == null ? await res.json() : JSON.parse(besedilo); } catch (e) {
    var tip = res.headers && typeof res.headers.get === "function" ? res.headers.get("content-type") : "";
    throw napakaVira(vir, "odgovor ni JSON (" + (tip || "neznan tip") + ": " + String(besedilo || "").replace(/\s+/g, " ").slice(0, 80) + ") — " + url, e);
  }
}

/* Linijo/točko preslika v zaporedje edinstvenih celic in nanje enakomerno
   razdeli zamudo, da se ista gneča ne šteje večkrat. */
function opazovanjaIzGeometrije(tocke, osnova) {
  var videne = [];
  (tocke || []).forEach(function (t) {
    var c = celice.celica(t.lat, t.lon);
    if (c && videne.indexOf(c) === -1) videne.push(c);
  });
  if (!videne.length) return [];
  var delez = osnova.zamudaS != null ? Math.round(osnova.zamudaS / videne.length) : null;
  return videne.map(function (c) {
    return Object.assign({}, osnova, { celica: c, zamudaS: delez });
  });
}

function stevilo(v) {
  if (v == null || v === "") return null;
  var n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

module.exports = { napakaVira: napakaVira, preberiJson: preberiJson, opazovanjaIzGeometrije: opazovanjaIzGeometrije, stevilo: stevilo };
