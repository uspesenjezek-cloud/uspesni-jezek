"use strict";

/* NAP Slovenija (nap.si) — DATEX II v3.3 viri DARS/DRSI (NCUP), licenca
   CC BY-SA 4.0. Uradni naslovi so privzeti (preverjeno na nap.si, 6. 10. 2026);
   potrebna je samo prijava, ki je SAMO v nastavitvah okolja (Vercel →
   Environment Variables), nikoli v kodi:
     PROMET_NAP_UPORABNIK, PROMET_NAP_GESLO
   Naslove je mogoče preglasiti s PROMET_NAP_URL_* (npr. PROMET_NAP_URL_FCD="-"
   izklopi vir). */

var datex2 = require("./datex2");
var skupno = require("./skupno");

var VIR = "nap";
var LOKACIJE_VELJAVNOST_MS = 6 * 3600 * 1000; // tabele lokacij se redko spreminjajo
var predpomnilnikLokacij = new Map();

var B2B = "https://b2b.ncup.si/data/";
var PRIVZETI = {
  DOGODKI: B2B + "b2b.events.datexii33",                       // prometni dogodki (zastoji, dela, zapore)
  STEVCI: B2B + "b2b.counters.datexii33",                      // števci: AC, državne in regionalne ceste, do 5 min
  STEVCI_LOKACIJE: B2B + "b2b.counters.datexii33.locations",
  POTOVALNI_CASI: B2B + "b2b.traveltimes.promet.datexii33",    // potovalni časi AC, do 1 min
  POTOVALNI_CASI_LOKACIJE: "",                                 // lokacija je v samem zapisu
  FCD: B2B + "b2b.fcd.datexii33.status",                       // Floating Car Data, AC, do 1 min
  FCD_LOKACIJE: B2B + "b2b.fcd.datexii33.locations"
};

function url(e, ime) {
  var v = e["PROMET_NAP_URL_" + ime];
  if (v === "-") return ""; // izrecno izklopljeno
  return v || PRIVZETI[ime];
}

function nastavitve(env) {
  var e = env || process.env;
  return {
    uporabnik: e.PROMET_NAP_UPORABNIK || "",
    geslo: e.PROMET_NAP_GESLO || "",
    dogodki: url(e, "DOGODKI"),
    stevci: url(e, "STEVCI"),
    stevciLokacije: url(e, "STEVCI_LOKACIJE"),
    potovalniCasi: url(e, "POTOVALNI_CASI"),
    potovalniCasiLokacije: url(e, "POTOVALNI_CASI_LOKACIJE"),
    fcd: url(e, "FCD"),
    fcdLokacije: url(e, "FCD_LOKACIJE")
  };
}

/* Vključen, ko je nastavljena prijava (naslovi so privzeti). */
function nastavljen(env) {
  var n = nastavitve(env);
  return !!(n.uporabnik && n.geslo);
}

function skrij(besedilo, n) {
  var t = String(besedilo || "");
  [n.geslo, n.uporabnik].filter(function (x) { return x && x.length >= 3; }).forEach(function (x) { t = t.split(x).join("***"); });
  return t;
}

async function preberiXml(url, n, fetchFn) {
  var f = fetchFn || fetch;
  var glave = { accept: "application/xml, text/xml, */*", "user-agent": "UspesniJezek-promet/1.0" };
  if (n.uporabnik || n.geslo) glave.authorization = "Basic " + Buffer.from(n.uporabnik + ":" + n.geslo).toString("base64");
  var opts = { headers: glave };
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) opts.signal = AbortSignal.timeout(25000);
  var res;
  try { res = await f(url, opts); } catch (e) {
    throw skupno.napakaVira(VIR, skrij("povezava ni uspela (" + (e && (e.cause && e.cause.code || e.message)) + ") — " + url, n));
  }
  if (res.status === 401 || res.status === 403) throw skupno.napakaVira(VIR, "dostop zavrnjen (HTTP " + res.status + "): preverite uporabniško ime, geslo in ali je vir na nap.si naročen — " + url);
  if (!res.ok) throw skupno.napakaVira(VIR, "HTTP " + res.status + " — " + url);
  return res.text();
}

async function lokacije(kljuc, url, razcleniFn, n, o) {
  var zdaj = o.zdajMs || Date.now();
  var p = predpomnilnikLokacij.get(kljuc);
  if (p && p.url === url && zdaj - p.cas < LOKACIJE_VELJAVNOST_MS) return p.vrednost;
  var vrednost = razcleniFn(await preberiXml(url, n, o.fetch));
  predpomnilnikLokacij.set(kljuc, { url: url, cas: zdaj, vrednost: vrednost });
  return vrednost;
}

/* Dogodki -> enaka oblika kot drugi viri (za zemljevid in zbiralnik). */
async function dogodki(o) {
  var n = nastavitve(o.env);
  if (!n.dogodki) return null;
  return datex2.razcleniSituacije(await preberiXml(n.dogodki, n, o.fetch));
}

/* Števci: meritve + koordinate merilnih mest. */
async function stevci(o) {
  var n = nastavitve(o.env);
  if (!n.stevci) return null;
  var xml = await preberiXml(n.stevci, n, o.fetch);
  var drevo = datex2.razcleni(xml);
  var meritve = datex2.razcleniMeritve(drevo);
  // Nekateri viri imajo lokacije v istem dokumentu; sicer jih preberemo posebej.
  var mesta = datex2.razcleniMerilnaMesta(drevo);
  if (!mesta.size && n.stevciLokacije && n.stevciLokacije !== n.stevci) {
    mesta = await lokacije("stevci", n.stevciLokacije, datex2.razcleniMerilnaMesta, n, o);
  }
  var out = [];
  meritve.forEach(function (m) {
    var mesto = mesta.get(m.id);
    if (!mesto) return;
    out.push(Object.assign({}, mesto, { hitrost: m.hitrost, pretok: m.pretok, zasedenost: m.zasedenost }));
  });
  if (meritve.size && !out.length) throw skupno.napakaVira(VIR, "meritve števcev nimajo ujemajočih merilnih mest (" + meritve.size + " meritev) — preverite PROMET_NAP_URL_STEVCI_LOKACIJE");
  return out;
}

/* Potovalni časi: odsek s točkami, trenutni in prosti čas. */
async function potovalniCasi(o) {
  var n = nastavitve(o.env);
  if (!n.potovalniCasi) return null;
  var casi = datex2.razcleniPotovalneCase(await preberiXml(n.potovalniCasi, n, o.fetch));
  var lok = n.potovalniCasiLokacije ? await lokacije("potovalni", n.potovalniCasiLokacije, datex2.razcleniLokacije, n, o) : new Map();
  return casi.map(function (c) {
    var l = c.lokacija && lok.get(c.lokacija);
    return Object.assign({}, c, { tocke: c.tocke.length ? c.tocke : (l ? l.tocke : []), ime: c.ime || (l ? l.ime : "") });
  }).filter(function (c) { return c.tocke.length; });
}

/* FCD (podatki iz vozil): stanje po preddefiniranih odsekih + lokacije odsekov. */
async function fcd(o) {
  var n = nastavitve(o.env);
  if (!n.fcd) return null;
  var casi = datex2.razcleniPotovalneCase(await preberiXml(n.fcd, n, o.fetch));
  var lok = n.fcdLokacije ? await lokacije("fcd", n.fcdLokacije, datex2.razcleniLokacije, n, o) : new Map();
  var out = casi.map(function (c) {
    var l = c.lokacija && lok.get(c.lokacija);
    return Object.assign({}, c, { tocke: c.tocke.length ? c.tocke : (l ? l.tocke : []), ime: c.ime || (l ? l.ime : "") });
  }).filter(function (c) { return c.tocke.length; });
  if (casi.length && !out.length) throw skupno.napakaVira(VIR, "stanje FCD nima ujemajočih odsekov (" + casi.length + ") — preverite PROMET_NAP_URL_FCD_LOKACIJE");
  return out;
}

module.exports = { VIR: VIR, PRIVZETI: PRIVZETI, nastavitve: nastavitve, nastavljen: nastavljen, dogodki: dogodki, stevci: stevci, potovalniCasi: potovalniCasi, fcd: fcd,
  _ponastavi: function () { predpomnilnikLokacij.clear(); } };
