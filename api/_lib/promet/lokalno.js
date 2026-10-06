"use strict";

/* Lokalna shramba (brez baze) za zagon na lastnem računalniku.
   Mapa vsebuje zajemi.jsonl, opazovanja.jsonl, dogodki-<vir>.json, profil.json. */

var fs = require("fs");
var path = require("path");

var HRAMBA_DNI = 56;
// Na Vercelu je zapisljiv samo začasni imenik; lokalno podatki ostanejo v repozitoriju.
var PRIVZETA_MAPA = process.env.PROMET_MAPA
  || (process.env.VERCEL ? path.join(require("os").tmpdir(), "promet-podatki") : path.join(__dirname, "..", "..", "..", ".promet-podatki"));

function beriJsonl(datoteka) {
  if (!fs.existsSync(datoteka)) return [];
  return fs.readFileSync(datoteka, "utf8").split(/\r?\n/).filter(Boolean).map(function (v) {
    try { return JSON.parse(v); } catch (_) { return null; } // prekinjen zapis (npr. izklop računalnika)
  }).filter(Boolean);
}

function pisiJsonl(datoteka, vrstice) {
  var zacasna = datoteka + ".tmp";
  fs.writeFileSync(zacasna, vrstice.map(function (v) { return JSON.stringify(v); }).join("\n") + (vrstice.length ? "\n" : ""));
  fs.renameSync(zacasna, datoteka);
}

function pisiJson(datoteka, vrednost) {
  var zacasna = datoteka + ".tmp";
  fs.writeFileSync(zacasna, JSON.stringify(vrednost));
  fs.renameSync(zacasna, datoteka);
}

function dodajZajem(mapa, rezultat, cas, uspeh) {
  fs.mkdirSync(mapa, { recursive: true });
  var id = rezultat.vir + "-" + cas;
  // Najprej opazovanja, nato zajem: prekinjen zapis pusti opazovanja brez
  // zajema, ki jih profil ignorira, nikoli zajema z manjkajočimi opazovanji.
  if (rezultat.opazovanja.length) {
    fs.appendFileSync(path.join(mapa, "opazovanja.jsonl"), rezultat.opazovanja.map(function (o) {
      return JSON.stringify({ zajemId: id, vir: o.vir, celica: o.celica, cesta: o.cesta, zamudaS: o.zamudaS, hitrostKmh: o.hitrostKmh, zunanjiId: o.zunanjiId });
    }).join("\n") + "\n");
  }
  fs.appendFileSync(path.join(mapa, "zajemi.jsonl"), JSON.stringify({ id: id, vir: rezultat.vir, cas: cas, uspeh: uspeh, napake: rezultat.napake }) + "\n");
  if (Array.isArray(rezultat.dogodki) && !rezultat.napakeDogodkov) {
    pisiJson(path.join(mapa, "dogodki-" + rezultat.vir + ".json"), { cas: cas, dogodki: rezultat.dogodki });
  }
  return id;
}

/* Čista funkcija: obdrži samo zajeme po meji in njihova opazovanja. */
function obreziZgodovino(zajemi, opazovanja, odIso) {
  var meja = Date.parse(odIso);
  var ostanejo = zajemi.filter(function (z) { return Date.parse(z.cas) >= meja; });
  var idji = new Set(ostanejo.map(function (z) { return String(z.id); }));
  return { zajemi: ostanejo, opazovanja: opazovanja.filter(function (o) { return idji.has(String(o.zajemId)); }) };
}

function preberiZgodovino(mapa, odIso) {
  return obreziZgodovino(beriJsonl(path.join(mapa, "zajemi.jsonl")), beriJsonl(path.join(mapa, "opazovanja.jsonl")), odIso);
}

function pocisti(mapa, odIso) {
  var z = preberiZgodovino(mapa, odIso);
  if (!fs.existsSync(path.join(mapa, "zajemi.jsonl"))) return z;
  pisiJsonl(path.join(mapa, "zajemi.jsonl"), z.zajemi);
  pisiJsonl(path.join(mapa, "opazovanja.jsonl"), z.opazovanja);
  return z;
}

function preberiProfil(mapa) {
  var p = path.join(mapa, "profil.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : { vrstice: [], pokritost: [] };
}

/* Dogodki, starejši od maxStarostH, se ne uporabijo (zbiralnik ni tekel). */
function preberiDogodke(mapa, zdajMs, maxStarostH) {
  var out = [];
  var opozorila = [];
  ["autobahn", "dars"].forEach(function (vir) {
    var f = path.join(mapa, "dogodki-" + vir + ".json");
    if (!fs.existsSync(f)) return;
    var d = JSON.parse(fs.readFileSync(f, "utf8"));
    var starost = (zdajMs - Date.parse(d.cas)) / 3600000;
    if (!(starost <= (maxStarostH || 2))) { opozorila.push(vir + ": dogodki so stari " + Math.round(starost) + " h"); return; }
    out = out.concat(d.dogodki || []);
  });
  return { dogodki: out, opozorila: opozorila };
}

module.exports = { HRAMBA_DNI: HRAMBA_DNI, PRIVZETA_MAPA: PRIVZETA_MAPA, beriJsonl: beriJsonl, pisiJson: pisiJson, dodajZajem: dodajZajem,
  obreziZgodovino: obreziZgodovino, preberiZgodovino: preberiZgodovino, pocisti: pocisti, preberiProfil: preberiProfil, preberiDogodke: preberiDogodke };
