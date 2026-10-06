"use strict";

/* Lokalni API za napoved odhoda (faza »vse na mojem računalniku«).
   GET  /api/promet-stanje   -> koliko podatkov je zbranih
   POST /api/promet-napoved  -> { izhodisce, cilj, datum, prihod, jezik } */

var fs = require("fs");
var path = require("path");
var storitev = require("../_lib/promet/storitev");

/* Lokalno: nastavitve PROMET_* (npr. PROMET_OSRM_URL_SI) preberemo iz .env.local. */
function naloziLokalneNastavitve() {
  try {
    var vsebina = fs.readFileSync(path.join(__dirname, "..", "..", ".env.local"), "utf8");
    vsebina.split(/\r?\n/).forEach(function (vrstica) {
      var m = vrstica.match(/^\s*(PROMET_[A-Z0-9_]+)\s*=\s*["']?([^"'\r\n]*)["']?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
  } catch (_) {}
}

var STATUS = { NEVELJAVEN_VNOS: 400, NASLOV_NI_NAJDEN: 422, POT_NI_NA_VOLJO: 503, ZUNANJI_VIR: 502 };

module.exports = async function promet(req, res) {
  naloziLokalneNastavitve();
  var akcija = req.query && req.query.akcija;
  try {
    if (akcija === "stanje") {
      if (req.method !== "GET") return res.status(405).json({ ok: false, napaka: "Metoda ni dovoljena." });
      return res.status(200).json(Object.assign({ ok: true }, storitev.stanje()));
    }
    if (akcija === "napoved") {
      if (req.method !== "POST") return res.status(405).json({ ok: false, napaka: "Metoda ni dovoljena." });
      var r = await storitev.napovejNalog(req.body || {});
      return res.status(200).json(Object.assign({ ok: true }, r));
    }
    return res.status(404).json({ ok: false, napaka: "Neznana akcija." });
  } catch (e) {
    var status = STATUS[e.code] || 500;
    if (status === 500) console.error("[promet]", e && e.stack);
    return res.status(status).json({ ok: false, koda: e.code || "NAPAKA", napaka: status === 500 ? "Napoved ni uspela." : e.message });
  }
};
