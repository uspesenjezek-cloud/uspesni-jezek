#!/usr/bin/env node
/* Zbiralnik prometnih podatkov (zažene se vsakih 15 min).
   node scripts/promet-zbiralnik.js                 -> zapis v Supabase
   node scripts/promet-zbiralnik.js --lokalno DIR   -> zapis v DIR/zajemi.jsonl (brez baze)
   Viri: Autobahn API (DE, avtoceste), DARS promet.si dogodki (SI). */
"use strict";

var fs = require("fs");
var path = require("path");
var promet = require("../api/_lib/promet");

function argument(ime) {
  var i = process.argv.indexOf(ime);
  return i === -1 ? null : process.argv[i + 1];
}

async function main() {
  var lokalno = argument("--lokalno");
  var cas = new Date().toISOString();
  var rezultati = await Promise.all([promet.viri.autobahn.zajemi(), promet.viri.dars.zajemi()]);
  var napaka = false;
  for (var r of rezultati) {
    var uspeh = r.napake.length === 0 && r.pokritost > 0;
    if (!uspeh) napaka = true;
    if (lokalno) {
      fs.mkdirSync(lokalno, { recursive: true });
      var id = r.vir + "-" + cas;
      fs.appendFileSync(path.join(lokalno, "zajemi.jsonl"), JSON.stringify({ id: id, vir: r.vir, cas: cas, uspeh: uspeh, napake: r.napake }) + "\n");
      fs.appendFileSync(path.join(lokalno, "opazovanja.jsonl"), r.opazovanja.map(function (o) { return JSON.stringify(Object.assign({ zajemId: id }, o)); }).join("\n") + (r.opazovanja.length ? "\n" : ""));
      if (r.dogodki) fs.writeFileSync(path.join(lokalno, "dogodki-" + r.vir + ".json"), JSON.stringify(r.dogodki));
    } else {
      var supa = require("../api/_lib/supabase-server");
      var shramba = require("../api/_lib/promet/shramba");
      await shramba.zapisiZajem(supa.konfiguracija(), r, cas);
    }
    console.log(r.vir + ": " + (uspeh ? "OK" : "NEPOPOLNO") + ", zastojev (celic): " + r.opazovanja.length +
      ", pokritost " + r.pokritost + "/" + r.skupaj + (r.napake.length ? ", napake: " + JSON.stringify(r.napake.slice(0, 3)) : ""));
  }
  // Nepopoln zajem je zapisan z uspeh=false in se ne šteje v profil.
  if (napaka) process.exitCode = 2;
}

main().catch(function (e) { console.error(e.message); process.exit(1); });
