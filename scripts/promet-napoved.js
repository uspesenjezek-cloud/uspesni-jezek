#!/usr/bin/env node
/* Napoved odhoda za en delovni nalog (preizkus iz ukazne vrstice).
   node scripts/promet-napoved.js --od 46.0569,14.5058 --do 46.5547,15.6459 \
     --prihod 2026-10-07T07:30 --drzava SI [--regija DE-BY] [--jezik de] [--lokalno DIR]
   Potrebuje PROMET_OSRM_URL (lasten OSRM strežnik). */
"use strict";

var fs = require("fs");
var path = require("path");
var promet = require("../api/_lib/promet");

function argument(ime) {
  var i = process.argv.indexOf(ime);
  return i === -1 ? null : process.argv[i + 1];
}

function tocka(v) {
  var d = String(v || "").split(",").map(Number);
  if (d.length !== 2 || !d.every(Number.isFinite)) throw new Error("Točka mora biti lat,lon.");
  return { lat: d[0], lon: d[1] };
}

async function main() {
  var drzava = (argument("--drzava") || "SI").toUpperCase();
  var prihod = argument("--prihod");
  var datum = String(prihod).slice(0, 10);
  var lokalno = argument("--lokalno");
  var pot = await promet.osrm.pot(tocka(argument("--od")), tocka(argument("--do")));
  var koledar = await promet.tipDneva.pridobiKoledar(drzava, datum, datum);
  // Profil za DE ne loči šolskih počitnic (te so po deželah), zato jih tu ne uporabimo.
  if (drzava === "DE") koledar.solskePocitnice = [];
  var profil = { vrstice: [], pokritost: [] };
  var dogodki = [];
  if (lokalno) {
    var p = path.join(lokalno, "profil.json");
    if (fs.existsSync(p)) profil = JSON.parse(fs.readFileSync(p, "utf8"));
    ["autobahn", "dars"].forEach(function (v) {
      var f = path.join(lokalno, "dogodki-" + v + ".json");
      if (fs.existsSync(f)) dogodki = dogodki.concat(JSON.parse(fs.readFileSync(f, "utf8")));
    });
  } else if (process.env.SUPABASE_URL) {
    var supa = require("../api/_lib/supabase-server");
    var shramba = require("../api/_lib/promet/shramba");
    var cfg = supa.konfiguracija();
    var celiceNaPoti = Array.from(new Set(promet.celice.odsekiPoCelicah(pot.tocke, pot.trajanjeProstoS).map(function (o) { return o.celica; })));
    profil = await shramba.preberiProfil(cfg, celiceNaPoti);
    dogodki = await shramba.preberiDogodke(cfg);
  }
  var r = promet.napoved.izracunajOdhod({ prihod: prihod, drzava: drzava, regija: argument("--regija"), koledar: koledar, pot: pot, profil: profil, dogodki: dogodki });
  console.log(JSON.stringify(Object.assign({}, r, { razlogi: r.razlogi.slice(0, 10) }), null, 2));
  console.log("\n" + promet.napoved.sporocilo(r, argument("--jezik") || (drzava === "DE" ? "de" : "sl")));
}

main().catch(function (e) { console.error(e.message); process.exit(1); });
