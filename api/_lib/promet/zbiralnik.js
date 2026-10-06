"use strict";

/* Zbiralnik na produkciji: en klic = en zajem obeh virov v Supabase.
   Kliče ga Supabase pg_cron vsakih 15 min (GET /api/promet-zbiraj).
   Če je bil zadnji zajem pred manj kot 12 min, klic ničesar ne naredi,
   zato podvojeni ali ročni klici ne podvajajo vzorcev. */

var os = require("os");
var path = require("path");
var autobahn = require("./viri/autobahn");
var dars = require("./viri/dars");
var profil = require("./profil");
var storitev = require("./storitev");
var shramba = require("./shramba");

var MIN_RAZMIK_MS = 12 * 60 * 1000;
var MAPA_KOLEDARJEV = path.join(os.tmpdir(), "promet-koledar");

async function koledarji(leto, fetchFn) {
  var out = {};
  for (var d of ["SI", "DE"]) {
    try { out[d] = await storitev.koledar(MAPA_KOLEDARJEV, d, leto, fetchFn); }
    catch (_) { out[d] = { prazniki: [], solskePocitnice: [] }; } // brez koledarja: samo dan v tednu
  }
  // DE šolske počitnice so po deželah; skupni profil jih ne loči.
  out.DE = { prazniki: out.DE.prazniki, solskePocitnice: [] };
  return out;
}

async function zberi(cfg, opcije) {
  var o = opcije || {};
  var zdaj = o.zdajMs || Date.now();
  var zadnji = await shramba.zadnjiZajem(cfg);
  if (!o.vsiljeno && zadnji && zdaj - Date.parse(zadnji) < MIN_RAZMIK_MS) {
    return { preskoceno: true, zadnjiZajem: zadnji };
  }
  var cas = new Date(zdaj).toISOString();
  var kol = await koledarji(new Date(zdaj).getUTCFullYear(), o.fetch);
  var rezultati = await Promise.all([autobahn.zajemi({ fetch: o.fetch }), dars.zajemi({ fetch: o.fetch })]);
  var povzetek = [];
  for (var r of rezultati) {
    var kontekst = profil.kontekstZajema({ vir: r.vir, cas: cas }, kol);
    var zapis = await shramba.zapisiZajem(cfg, r, cas, kontekst);
    povzetek.push({ vir: r.vir, uspeh: zapis.uspeh, zastojev: r.opazovanja.length, pokritost: r.pokritost + "/" + r.skupaj,
      napaka: r.napake.length ? String(r.napake[0].napaka || "").slice(0, 200) : null });
  }
  return { preskoceno: false, cas: cas, viri: povzetek };
}

module.exports = { zberi: zberi, MIN_RAZMIK_MS: MIN_RAZMIK_MS };
