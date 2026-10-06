#!/usr/bin/env node
/* Zbiralnik prometnih podatkov (zažene se vsakih 15 min).
   node scripts/promet-zbiralnik.js              -> lokalno v .promet-podatki
   node scripts/promet-zbiralnik.js --lokalno D  -> lokalno v mapo D
   node scripts/promet-zbiralnik.js --supabase   -> Supabase
   Viri: Autobahn API (DE, avtoceste), DARS promet.si dogodki (SI). */
"use strict";

var promet = require("../api/_lib/promet");
var nacin = require("./promet-nacin").nacin();

async function main() {
  var cas = new Date().toISOString();
  var rezultati = await Promise.all([promet.viri.autobahn.zajemi(), promet.viri.dars.zajemi()]);
  var napaka = false;
  for (var r of rezultati) {
    var uspeh = r.napake.length === 0 && r.pokritost > 0;
    if (!uspeh) napaka = true;
    if (nacin.supabase) {
      var supa = require("../api/_lib/supabase-server");
      await require("../api/_lib/promet/shramba").zapisiZajem(supa.konfiguracija(), r, cas);
    } else {
      promet.lokalno.dodajZajem(nacin.mapa, r, cas, uspeh);
    }
    console.log(cas + " " + r.vir + ": " + (uspeh ? "OK" : "NEPOPOLNO") + ", zastojev (celic): " + r.opazovanja.length +
      ", dela/zapore: " + (r.dogodki ? r.dogodki.length : "-") + ", pokritost " + r.pokritost + "/" + r.skupaj +
      (r.napake.length ? ", napake: " + JSON.stringify(r.napake.slice(0, 3)) : ""));
  }
  // Nepopoln zajem je zapisan z uspeh=false in se ne šteje v profil.
  if (napaka) process.exitCode = 2;
}

main().catch(function (e) { console.error(e.message); process.exit(1); });
