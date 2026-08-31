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

async function preveriSupabaseAuthEgress(osnovniUrl) {
  var odgovor;
  var signal = AbortSignal.timeout(7000);
  try {
    odgovor = await fetch(osnovniUrl + "/__dev-auth-health", {
      headers: { Accept: "application/json" },
      signal: signal,
    });
  } catch (napaka) {
    var jeTimeout = napaka && (napaka.name === "TimeoutError" || napaka.name === "AbortError");
    throw new Error(jeTimeout
      ? "Supabase Auth egress preflight je presegel časovno omejitev lokalnega preverjanja."
      : "Supabase Auth egress preflight ni dosegljiv na lokalnem strežniku.");
  }

  var telo;
  try {
    telo = await odgovor.json();
  } catch (napaka) {
    if (signal.aborted || (napaka && (napaka.name === "TimeoutError" || napaka.name === "AbortError"))) {
      throw new Error("Supabase Auth egress preflight je presegel časovno omejitev lokalnega preverjanja.");
    }
    throw new Error("Supabase Auth egress preflight je vrnil neveljaven odgovor (HTTP " + odgovor.status + ").");
  }

  var code = telo && typeof telo.code === "string" ? telo.code : "UNKNOWN";
  if (odgovor.ok && code === "SUPABASE_AUTH_OK") return code;

  var pojasnila = {
    NOT_CONFIGURED: "SUPABASE_URL ni nastavljen ali ni veljaven HTTPS naslov.",
    TIMEOUT: "javni Supabase JWKS se ni odzval v omejenem času.",
    EGRESS_UNAVAILABLE: "izhodna povezava do javnega Supabase JWKS ni na voljo.",
    JWKS_INVALID: "javni Supabase endpoint ni vrnil veljavnega asimetričnega JWKS.",
  };
  throw new Error("Supabase Auth egress preflight ni uspel (" + code + "): "
    + (pojasnila[code] || "lokalni strežnik je vrnil nepričakovan rezultat."));
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
  var izpis = [
    "Lokalni vir potrjen.",
    "Mapa: " + pricakovanaMapa,
    "Veja: " + (vir.branch || "unknown"),
    "Commit: " + (vir.commit || "unknown"),
    "Stanje: " + (vir.dirty ? "lokalne spremembe" : "čisto"),
  ];
  if (process.argv.includes("--require-auth-egress")) {
    izpis.push("Supabase Auth egress: " + await preveriSupabaseAuthEgress(osnovniUrl));
  }
  process.stdout.write(izpis.join("\n") + "\n");
}

main().catch(function (napaka) {
  console.error(napaka.message);
  process.exitCode = 1;
});
