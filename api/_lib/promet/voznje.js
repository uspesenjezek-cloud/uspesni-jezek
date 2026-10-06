"use strict";

/* Dejanske vožnje: gumba »Odhajam« in »Na lokaciji« pri nalogu.
   Shranimo napoved (ob času beleženja) in dejanski čas vožnje, da se
   napoved pozneje umeri in da se meri točnost (delež pravočasnih prihodov).
   Čas beleži strežnik, ne naprava, da ure na telefonih ne vplivajo.
   Produkcija: Supabase (promet_voznja, po uporabniku); lokalno: datoteka. */

var fs = require("fs");
var path = require("path");
var supa = require("../supabase-server");
var lokalno = require("./lokalno");

var NAJDALJSA_VOZNJA_MIN = 6 * 60;

function napakaVnosa(sporocilo) {
  var e = new Error(sporocilo);
  e.code = "NEVELJAVEN_VNOS";
  return e;
}

function besedilo(v, n) {
  return v == null ? null : String(v).trim().slice(0, n || 300) || null;
}

function celo(v) {
  var n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n < 100000 ? n : null;
}

/* Čista funkcija: združi obstoječi zapis z novim dogodkom. */
function zdruzi(obstojeci, vhod, casIso) {
  var z = Object.assign({}, obstojeci || {});
  var n = vhod.napoved || {};
  z.datum = vhod.datum;
  z.nalog_id = vhod.nalogId;
  z.stranka = besedilo(vhod.stranka, 120) || z.stranka || null;
  z.od_naslov = besedilo(vhod.od) || z.od_naslov || null;
  z.do_naslov = besedilo(vhod.do) || z.do_naslov || null;
  if (vhod.dogodek === "odhod") {
    z.odhod = casIso;
    z.prihod = null; // nov odhod začne novo vožnjo
    // napoved shranimo ob odhodu: to je napoved, po kateri je obrtnik ravnal
    z.nacrtovan_prihod = besedilo(n.prihod, 5) || z.nacrtovan_prihod || null;
    z.napoved_odhod = besedilo(n.odhod, 5) || null;
    z.napoved_prosto_min = celo(n.prostoMin);
    z.napoved_varno_min = celo(n.varnoMin);
    z.napoved_osnova = besedilo(n.osnova, 40);
    z.vreme = n.vreme && typeof n.vreme === "object" ? { razred: besedilo(n.vreme.razred, 30), faktor: Number(n.vreme.faktor) || null, padavineMmH: n.vreme.padavineMmH == null ? null : Number(n.vreme.padavineMmH) } : null;
  } else {
    z.prihod = casIso;
  }
  z.dejansko_min = null;
  if (z.odhod && z.prihod) {
    var min = Math.round((Date.parse(z.prihod) - Date.parse(z.odhod)) / 60000);
    if (min >= 0 && min <= NAJDALJSA_VOZNJA_MIN) z.dejansko_min = min;
  }
  return z;
}

function povzetek(z) {
  return {
    nalogId: z.nalog_id,
    odhod: z.odhod || null,
    prihod: z.prihod || null,
    dejanskoMin: z.dejansko_min == null ? null : z.dejansko_min,
    napovedVarnoMin: z.napoved_varno_min == null ? null : z.napoved_varno_min,
    razlikaMin: z.dejansko_min != null && z.napoved_varno_min != null ? z.dejansko_min - z.napoved_varno_min : null
  };
}

function preveri(vhod) {
  var v = vhod || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.datum || ""))) throw napakaVnosa("Manjka datum naloga.");
  if (!v.nalogId || String(v.nalogId).length > 80) throw napakaVnosa("Manjka nalog.");
  if (v.dogodek !== "odhod" && v.dogodek !== "prihod") throw napakaVnosa("Neznan dogodek (odhod ali prihod).");
  return Object.assign({}, v, { nalogId: String(v.nalogId) });
}

async function zahteva(cfg, pot, opcije) {
  var res = await fetch(cfg.url + "/rest/v1/" + pot, Object.assign({}, opcije, {
    headers: supa.serviceHeaders(cfg, Object.assign({ "Content-Type": "application/json" }, (opcije && opcije.headers) || {}))
  }));
  var t = await res.text();
  if (!res.ok) {
    var e = new Error("Shranjevanje vožnje ni uspelo (HTTP " + res.status + ").");
    e.code = "DATABASE_FAILED";
    throw e;
  }
  return t ? JSON.parse(t) : null;
}

/* opcije: { cfg, userId } za Supabase ali { mapa } za lokalno; zdajMs za teste. */
async function zabelezi(vhod, opcije) {
  var o = opcije || {};
  var v = preveri(vhod);
  var cas = new Date(o.zdajMs || Date.now()).toISOString();
  if (o.cfg) {
    if (!o.userId) throw napakaVnosa("Prijava je obvezna.");
    var filter = "user_id=eq." + encodeURIComponent(o.userId) + "&datum=eq." + v.datum + "&nalog_id=eq." + encodeURIComponent(v.nalogId);
    var obst = await zahteva(o.cfg, "promet_voznja?select=*&" + filter, {});
    var z = zdruzi(obst && obst[0], v, cas);
    z.user_id = o.userId;
    z.posodobljeno = cas;
    delete z.id;
    delete z.ustvarjeno;
    var zapisano = await zahteva(o.cfg, "promet_voznja?on_conflict=user_id,datum,nalog_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(z)
    });
    return povzetek((zapisano && zapisano[0]) || z);
  }
  var mapa = o.mapa || lokalno.PRIVZETA_MAPA;
  var datoteka = path.join(mapa, "voznje.json");
  var vse = {};
  try { vse = JSON.parse(fs.readFileSync(datoteka, "utf8")); } catch (_) {}
  var kljuc = v.datum + "|" + v.nalogId;
  vse[kljuc] = zdruzi(vse[kljuc], v, cas);
  fs.mkdirSync(mapa, { recursive: true });
  lokalno.pisiJson(datoteka, vse);
  return povzetek(vse[kljuc]);
}

module.exports = { zabelezi: zabelezi, zdruzi: zdruzi, povzetek: povzetek };
