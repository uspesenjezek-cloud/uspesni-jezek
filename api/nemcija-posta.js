var sentry = require("./_lib/sentry");
"use strict";

var OPENPLZ_URL = "https://openplzapi.org/de/Localities";

function poslji(res, status, podatki, cache) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache || "no-store");
  res.end(JSON.stringify(podatki));
}

async function handler(req, res) {
  if (req.method !== "GET") return poslji(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  var url = new URL(req.url, "http://localhost");
  var posta = String(url.searchParams.get("postalCode") || "").replace(/\D/g, "").slice(0, 5);
  if (!/^\d{5}$/.test(posta)) return poslji(res, 400, { ok: false, napaka: "Poštna številka ni veljavna." });

  var kontrolnik = new AbortController();
  var casovnik = setTimeout(function () { kontrolnik.abort(); }, 7000);
  try {
    var odgovor = await fetch(OPENPLZ_URL + "?postalCode=" + encodeURIComponent(posta), {
      headers: { Accept: "application/json", "User-Agent": "Uspesni-Jezek-postal-lookup/1.0" },
      signal: kontrolnik.signal,
    });
    if (!odgovor.ok) return poslji(res, 502, { ok: false, napaka: "Kraja trenutno ni bilo mogoče določiti." });
    var zapisi = await odgovor.json();
    var kraji = Array.from(new Set((Array.isArray(zapisi) ? zapisi : []).map(function (zapis) {
      return String(zapis && zapis.name || "").trim();
    }).filter(Boolean)));
    return poslji(res, 200, { ok: true, postalCode: posta, cities: kraji }, "public, max-age=86400, stale-while-revalidate=604800");
  } catch (_) {
    return poslji(res, 502, { ok: false, napaka: "Kraja trenutno ni bilo mogoče določiti." });
  } finally {
    clearTimeout(casovnik);
  }
}

module.exports = sentry.wrapHandler(handler, "/api/nemcija-posta");
