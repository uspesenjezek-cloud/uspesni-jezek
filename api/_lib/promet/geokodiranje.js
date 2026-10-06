"use strict";

/* Naslov -> koordinate prek OpenStreetMap Nominatim (brezplačno).
   Pravila javnega strežnika: največ 1 zahteva na sekundo, prepoznaven
   User-Agent, rezultate predpomnimo. Zato vsak naslov iščemo samo enkrat. */

var fs = require("fs");
var path = require("path");
var skupno = require("./viri/skupno");

var URL_NOMINATIM = process.env.PROMET_NOMINATIM_URL || "https://nominatim.openstreetmap.org";
var USER_AGENT = "UspesniJezek-promet/1.0 (+https://uspesni-jezek.vercel.app)";
var zadnjaZahteva = 0;
var vrsta = Promise.resolve();

function kljuc(naslov) {
  return String(naslov || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function beriPredpomnilnik(datoteka) {
  try { return JSON.parse(fs.readFileSync(datoteka, "utf8")); } catch (_) { return {}; }
}

function pisiPredpomnilnik(datoteka, vsebina) {
  fs.mkdirSync(path.dirname(datoteka), { recursive: true });
  fs.writeFileSync(datoteka + ".tmp", JSON.stringify(vsebina));
  fs.renameSync(datoteka + ".tmp", datoteka);
}

function izZadetka(z) {
  var a = z.address || {};
  var drzava = String(a.country_code || "").toUpperCase();
  return {
    lat: Number(z.lat),
    lon: Number(z.lon),
    prikaz: String(z.display_name || ""),
    drzava: drzava,
    regija: drzava === "DE" ? (a["ISO3166-2-lvl4"] || null) : null
  };
}

function pocakajNaVrsto(fn) {
  var naslednji = vrsta.then(async function () {
    var cakaj = zadnjaZahteva + 1100 - Date.now();
    if (cakaj > 0) await new Promise(function (r) { setTimeout(r, cakaj); });
    zadnjaZahteva = Date.now();
    return fn();
  });
  vrsta = naslednji.catch(function () {});
  return naslednji;
}

async function poisci(naslov, opcije) {
  var o = opcije || {};
  var k = kljuc(naslov);
  if (k.length < 3) {
    var e = new Error("Naslov je prekratek.");
    e.code = "NEVELJAVEN_VNOS";
    throw e;
  }
  var datoteka = o.predpomnilnik;
  var pomnilnik = datoteka ? beriPredpomnilnik(datoteka) : {};
  if (pomnilnik[k]) return Object.assign({ izPredpomnilnika: true }, pomnilnik[k]);

  var url = URL_NOMINATIM + "/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=si,de&accept-language=sl&q=" + encodeURIComponent(naslov);
  var f = o.fetch || fetch;
  var data = await pocakajNaVrsto(function () {
    return skupno.preberiJson("nominatim", url, function (u, opts) {
      return f(u, Object.assign({}, opts, { headers: Object.assign({}, opts && opts.headers, { "User-Agent": USER_AGENT }) }));
    });
  });
  if (!Array.isArray(data)) throw skupno.napakaVira("nominatim", "nepričakovan odgovor");
  if (!data.length) {
    var n = new Error("Naslova »" + String(naslov).trim() + "« ni bilo mogoče najti v Sloveniji ali Nemčiji.");
    n.code = "NASLOV_NI_NAJDEN";
    throw n;
  }
  var rezultat = izZadetka(data[0]);
  if (!Number.isFinite(rezultat.lat) || !Number.isFinite(rezultat.lon)) throw skupno.napakaVira("nominatim", "zadetek nima koordinat");
  if (datoteka) {
    pomnilnik[k] = rezultat;
    pisiPredpomnilnik(datoteka, pomnilnik);
  }
  return rezultat;
}

module.exports = { poisci: poisci, izZadetka: izZadetka, kljuc: kljuc };
