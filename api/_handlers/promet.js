"use strict";

/* API napovedi prometa.
   GET  /api/promet-stanje     -> koliko podatkov je zbranih
   GET  /api/promet-zemljevid  -> GeoJSON prometa v živo (števci, zastoji, zapore)
   POST /api/promet-napoved    -> { izhodisce, cilj, datum, prihod, jezik }
   POST /api/promet-dan        -> { izhodisce, datum, jezik, naloge: [{ id, stranka, naslov, zacetek, konec }] }
   Na Vercelu je obvezna prijava (Bearer žeton Supabase); lokalni razvojni
   strežnik je dosegljiv samo v domačem omrežju in prijave ne preverja. */

var fs = require("fs");
var path = require("path");
var storitev = require("../_lib/promet/storitev");
var dan = require("../_lib/promet/dan");
var zemljevid = require("../_lib/promet/zemljevid");

var STATUS = { NEVELJAVEN_VNOS: 400, NASLOV_NI_NAJDEN: 422, POT_NI_NA_VOLJO: 503, ZUNANJI_VIR: 502 };
var AKCIJE = { stanje: "GET", zemljevid: "GET", napoved: "POST", dan: "POST" };

/* Lokalno: nastavitve PROMET_* (npr. PROMET_OSRM_URL_SI) preberemo iz .env.local. */
function naloziLokalneNastavitve() {
  if (process.env.VERCEL) return;
  try {
    var vsebina = fs.readFileSync(path.join(__dirname, "..", "..", ".env.local"), "utf8");
    vsebina.split(/\r?\n/).forEach(function (vrstica) {
      var m = vrstica.match(/^\s*(PROMET_[A-Z0-9_]+)\s*=\s*["']?([^"'\r\n]*)["']?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
  } catch (_) {}
}

function akcijaIzZahteve(req) {
  if (req.query && req.query.akcija) return String(req.query.akcija);
  try {
    var url = new URL(req.url || "/", "http://localhost");
    return url.searchParams.get("akcija") || (url.pathname.match(/\/api\/promet-([a-z]+)/) || [])[1] || "";
  } catch (_) { return ""; }
}

function telo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (_) { return {}; } }
  return {};
}

async function preveriPrijavo(req) {
  if (!process.env.VERCEL) return { ok: true };
  var db = require("../_lib/supabase-server");
  var cfg;
  try { cfg = db.uporabniskaKonfiguracija(); } catch (_) { return { ok: false, status: 503, napaka: "Strežnik ni nastavljen." }; }
  return db.preveriUporabnika(req, cfg);
}

module.exports = async function promet(req, res) {
  naloziLokalneNastavitve();
  var akcija = akcijaIzZahteve(req);
  try {
    if (!AKCIJE[akcija]) return res.status(404).json({ ok: false, napaka: "Neznana akcija." });
    if (req.method !== AKCIJE[akcija]) return res.status(405).json({ ok: false, napaka: "Metoda ni dovoljena." });
    var auth = await preveriPrijavo(req);
    if (!auth.ok) return res.status(auth.status || 401).json({ ok: false, koda: auth.code || "AUTH", napaka: auth.napaka || "Prijava je obvezna." });

    if (akcija === "stanje") return res.status(200).json(Object.assign({ ok: true }, storitev.stanje()));
    if (akcija === "zemljevid") {
      var z = await zemljevid.zemljevid();
      if (res.setHeader) res.setHeader("Cache-Control", "private, max-age=60");
      return res.status(200).json(Object.assign({ ok: true }, z));
    }
    if (akcija === "napoved") return res.status(200).json(Object.assign({ ok: true }, await storitev.napovejNalog(telo(req))));
    return res.status(200).json(Object.assign({ ok: true }, await dan.izracunajDan(telo(req))));
  } catch (e) {
    var status = STATUS[e.code] || 500;
    if (status === 500) console.error("[promet]", e && e.stack);
    return res.status(status).json({ ok: false, koda: e.code || "NAPAKA", napaka: status === 500 ? "Izračun ni uspel (" + String(e && e.message || "neznana napaka").slice(0, 200) + ")." : e.message });
  }
};

module.exports._test = { akcijaIzZahteve: akcijaIzZahteve };
