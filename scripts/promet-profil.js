#!/usr/bin/env node
/* Izračun profila zastojev iz zadnjih 56 dni (enkrat na dan).
   node scripts/promet-profil.js [--lokalno MAPA | --supabase] */
"use strict";

var path = require("path");
var promet = require("../api/_lib/promet");
var nacin = require("./promet-nacin").nacin();

async function main() {
  var od = new Date(Date.now() - promet.lokalno.HRAMBA_DNI * 86400000);
  var odDatum = od.toISOString().slice(0, 10);
  var doDatum = new Date().toISOString().slice(0, 10);
  // DE šolske počitnice so po deželah; v skupnem profilu upoštevamo samo
  // državne praznike.
  var si = await promet.tipDneva.pridobiKoledar("SI", odDatum, doDatum);
  var de = await promet.tipDneva.pridobiKoledar("DE", odDatum, doDatum);
  var koledarji = { SI: si, DE: { prazniki: de.prazniki, solskePocitnice: [] } };

  var zgodovina;
  var cfg = null;
  if (nacin.supabase) {
    cfg = require("../api/_lib/supabase-server").konfiguracija();
    zgodovina = await require("../api/_lib/promet/shramba").preberiZgodovino(cfg, od.toISOString());
  } else {
    zgodovina = promet.lokalno.pocisti(nacin.mapa, od.toISOString()); // hkrati izbriše podatke, starejše od 56 dni
  }
  var profil = promet.profil.zgradiProfil(zgodovina.zajemi, zgodovina.opazovanja, koledarji);
  if (nacin.supabase) await require("../api/_lib/promet/shramba").zamenjajProfil(cfg, profil);
  else promet.lokalno.pisiJson(path.join(nacin.mapa, "profil.json"), profil);
  var uspesni = zgodovina.zajemi.filter(function (z) { return z.uspeh; }).length;
  console.log("Zajemov: " + zgodovina.zajemi.length + " (uspešnih " + uspesni + "), vrstic profila: " + profil.vrstice.length);
}

main().catch(function (e) { console.error(e.message); process.exit(1); });
