#!/usr/bin/env node
/* Koliko podatkov je že zbranih (lokalni način).
   node scripts/promet-stanje.js [--lokalno MAPA] */
"use strict";

var promet = require("../api/_lib/promet");
var nacin = require("./promet-nacin").nacin();

if (nacin.supabase) { console.error("Stanje je na voljo samo za lokalni način."); process.exit(1); }
var z = promet.lokalno.preberiZgodovino(nacin.mapa, new Date(Date.now() - promet.lokalno.HRAMBA_DNI * 86400000).toISOString());
var profil = promet.lokalno.preberiProfil(nacin.mapa);
var minVzorcev = promet.napoved.PRIVZETO.minVzorcev;
console.log("Mapa: " + nacin.mapa);
["autobahn", "dars"].forEach(function (vir) {
  var vsi = z.zajemi.filter(function (x) { return x.vir === vir; });
  var ok = vsi.filter(function (x) { return x.uspeh; });
  var zadnji = vsi[vsi.length - 1];
  var pokriti = profil.pokritost.filter(function (p) { return p.vir === vir && p.n_vzorcev >= minVzorcev; });
  console.log(vir + ": zajemov " + vsi.length + " (uspešnih " + ok.length + "), zadnji " + (zadnji ? zadnji.cas + (zadnji.uspeh ? " OK" : " NEPOPOLNO") : "—") +
    ", intervalov z meritvami (≥" + minVzorcev + " vzorcev): " + pokriti.length + " / " + 96 * 5);
});
