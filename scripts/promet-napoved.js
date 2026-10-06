#!/usr/bin/env node
/* Napoved odhoda za en delovni nalog.
   node scripts/promet-napoved.js --od 46.0569,14.5058 --do 46.5547,15.6459 \
     --prihod 2026-10-07T07:30 --drzava SI [--regija DE-BY] [--jezik de] [--lokalno MAPA | --supabase]
   OSRM: PROMET_OSRM_URL_SI / PROMET_OSRM_URL_DE (privzeto http://localhost:5000 oz. :5001). */
"use strict";

var promet = require("../api/_lib/promet");
var nacinMod = require("./promet-nacin");
var argument = nacinMod.argument;
var nacin = nacinMod.nacin();

var PRIVZETI_OSRM = { SI: "http://localhost:5000", DE: "http://localhost:5001" };

function tocka(v) {
  var d = String(v || "").split(",").map(Number);
  if (d.length !== 2 || !d.every(Number.isFinite)) throw new Error("Točka mora biti lat,lon.");
  return { lat: d[0], lon: d[1] };
}

async function main() {
  var drzava = (argument("--drzava") || "SI").toUpperCase();
  var prihod = argument("--prihod");
  if (!prihod) throw new Error("Manjka --prihod (npr. 2026-10-07T07:30).");
  var datum = String(prihod).slice(0, 10);
  var osrmUrl = promet.osrm.urlZaDrzavo(drzava) || PRIVZETI_OSRM[drzava];
  var pot = await promet.osrm.pot(tocka(argument("--od")), tocka(argument("--do")), { url: osrmUrl });
  var koledar = await promet.tipDneva.pridobiKoledar(drzava, datum, datum);
  // Profil za DE ne loči šolskih počitnic (te so po deželah), zato jih tu ne uporabimo.
  if (drzava === "DE") koledar.solskePocitnice = [];

  var profil;
  var dogodki;
  var opozorila = [];
  if (nacin.supabase) {
    var cfg = require("../api/_lib/supabase-server").konfiguracija();
    var shramba = require("../api/_lib/promet/shramba");
    var celiceNaPoti = Array.from(new Set(promet.celice.odsekiPoCelicah(pot.tocke, pot.trajanjeProstoS).map(function (o) { return o.celica; })));
    profil = await shramba.preberiProfil(cfg, celiceNaPoti);
    dogodki = await shramba.preberiDogodke(cfg);
  } else {
    profil = promet.lokalno.preberiProfil(nacin.mapa);
    var d = promet.lokalno.preberiDogodke(nacin.mapa, Date.now(), 2);
    dogodki = d.dogodki;
    opozorila = d.opozorila;
  }
  var r = promet.napoved.izracunajOdhod({ prihod: prihod, drzava: drzava, regija: argument("--regija"), koledar: koledar, pot: pot, profil: profil, dogodki: dogodki });
  console.log(JSON.stringify(Object.assign({}, r, { razlogi: r.razlogi.slice(0, 10) }), null, 2));
  opozorila.forEach(function (o) { console.warn("Opozorilo: " + o + " (zbiralnik ne teče?) — dela/zapore niso upoštevani."); });
  console.log("\n" + promet.napoved.sporocilo(r, argument("--jezik") || (drzava === "DE" ? "de" : "sl")));
}

main().catch(function (e) { console.error(e.message); process.exit(1); });
