#!/usr/bin/env node
/* Nočni izračun profila zastojev iz zadnjih 56 dni.
   node scripts/promet-profil.js                -> Supabase
   node scripts/promet-profil.js --lokalno DIR  -> DIR/profil.json */
"use strict";

var fs = require("fs");
var path = require("path");
var promet = require("../api/_lib/promet");

var DNI = 56;

function argument(ime) {
  var i = process.argv.indexOf(ime);
  return i === -1 ? null : process.argv[i + 1];
}

function jsonl(datoteka) {
  if (!fs.existsSync(datoteka)) return [];
  return fs.readFileSync(datoteka, "utf8").split("\n").filter(Boolean).map(function (v) { return JSON.parse(v); });
}

async function koledarji(od, doDatum) {
  return {
    SI: await promet.tipDneva.pridobiKoledar("SI", od, doDatum),
    DE: await promet.tipDneva.pridobiKoledar("DE", od, doDatum)
  };
}

async function main() {
  var lokalno = argument("--lokalno");
  var od = new Date(Date.now() - DNI * 86400000);
  var odDatum = od.toISOString().slice(0, 10);
  var doDatum = new Date().toISOString().slice(0, 10);
  // DE šolske počitnice so po deželah; v profilu (ki je skupen) upoštevamo
  // samo državne praznike, počitnice pa pri napovedi za regijo naloga.
  var kol = await koledarji(odDatum, doDatum);
  var kolProfil = { SI: { prazniki: kol.SI.prazniki, solskePocitnice: kol.SI.solskePocitnice }, DE: { prazniki: kol.DE.prazniki, solskePocitnice: [] } };

  var zgodovina;
  if (lokalno) {
    zgodovina = { zajemi: jsonl(path.join(lokalno, "zajemi.jsonl")), opazovanja: jsonl(path.join(lokalno, "opazovanja.jsonl")) };
  } else {
    var supa = require("../api/_lib/supabase-server");
    zgodovina = await require("../api/_lib/promet/shramba").preberiZgodovino(supa.konfiguracija(), od.toISOString());
  }
  var profil = promet.profil.zgradiProfil(zgodovina.zajemi, zgodovina.opazovanja, kolProfil);
  if (lokalno) {
    fs.writeFileSync(path.join(lokalno, "profil.json"), JSON.stringify(profil));
  } else {
    var s = require("../api/_lib/supabase-server");
    await require("../api/_lib/promet/shramba").zamenjajProfil(s.konfiguracija(), profil);
  }
  console.log("Zajemov: " + zgodovina.zajemi.length + ", vrstic profila: " + profil.vrstice.length + ", intervalov pokritosti: " + profil.pokritost.length);
}

main().catch(function (e) { console.error(e.message); process.exit(1); });
