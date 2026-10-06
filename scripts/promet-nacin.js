"use strict";

/* Izbira shrambe za ukaze promet-*:
   --lokalno [MAPA]  -> lokalne datoteke (privzeto .promet-podatki)
   --supabase        -> Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
   brez zastavic     -> lokalno; Supabase samo, če je izrecno izbran. */

var path = require("path");
var lokalno = require("../api/_lib/promet/lokalno");

function argument(ime) {
  var i = process.argv.indexOf(ime);
  if (i === -1) return null;
  var v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "";
}

function nacin() {
  if (process.argv.indexOf("--supabase") !== -1) return { supabase: true };
  var mapa = argument("--lokalno") || process.env.PROMET_MAPA || lokalno.PRIVZETA_MAPA;
  return { supabase: false, mapa: path.resolve(mapa) };
}

module.exports = { argument: argument, nacin: nacin };
