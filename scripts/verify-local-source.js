"use strict";

var crypto = require("node:crypto");
var fs = require("node:fs");
var path = require("node:path");

function argument(ime, privzeto) {
  var indeks = process.argv.indexOf(ime);
  return indeks >= 0 && process.argv[indeks + 1] ? process.argv[indeks + 1] : privzeto;
}

function prstniOdtisMape(mapa) {
  var resenaPot = fs.realpathSync(path.resolve(mapa));
  var kanonicnaPot = process.platform === "win32" ? resenaPot.toLowerCase() : resenaPot;
  return crypto.createHash("sha256").update(kanonicnaPot).digest("hex").slice(0, 16);
}

async function main() {
  var projektnaMapa = path.resolve(__dirname, "..");
  var pricakovanaMapa = path.resolve(argument("--expected-root", projektnaMapa));
  var osnovniUrl = String(argument("--url", "http://localhost:8001")).replace(/\/$/, "");
  var odgovor;
  try {
    odgovor = await fetch(osnovniUrl + "/__dev-source", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
  } catch (napaka) {
    throw new Error("Lokalni strežnik ni dosegljiv ali nima varovalke /__dev-source: " + napaka.message);
  }
  if (!odgovor.ok) throw new Error("Lokalni strežnik ni vrnil identitete vira (HTTP " + odgovor.status + ").");
  var telo = await odgovor.json();
  var vir = telo && telo.localSource || {};
  var pricakovaniHash = prstniOdtisMape(pricakovanaMapa);
  if (!vir.workspaceHash || vir.workspaceHash !== pricakovaniHash) {
    throw new Error([
      "NAPAČNA LOKALNA DELOVNA KOPIJA.",
      "Pričakovana mapa: " + pricakovanaMapa,
      "Strežnik kaže: " + (vir.workspaceName || "neznana mapa") + " · " + (vir.branch || "neznana veja") + " · " + (vir.commit || "neznan commit"),
      "Ustavi strežnik na tem portu ali zaženi npm run dev iz mape, ki jo dejansko popravljaš.",
    ].join("\n"));
  }
  process.stdout.write([
    "Lokalni vir potrjen.",
    "Mapa: " + pricakovanaMapa,
    "Veja: " + (vir.branch || "unknown"),
    "Commit: " + (vir.commit || "unknown"),
    "Stanje: " + (vir.dirty ? "lokalne spremembe" : "čisto"),
  ].join("\n") + "\n");
}

main().catch(function (napaka) {
  console.error(napaka.message);
  process.exitCode = 1;
});
