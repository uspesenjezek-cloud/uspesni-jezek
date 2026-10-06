"use strict";

/* NAP Slovenija (nap.si) — DATEX II v3.3 viri DARS/DRSI (NCUP), licenca
   CC BY-SA 4.0. Uradni naslovi so privzeti (preverjeno na nap.si, 6. 10. 2026).
   Prijava po uradnih navodilih »NAP navodila za dostop do podatkov B2B«
   (https://www.nap.si/resources/doc/nap_B2B_sl.pdf): OAuth2 — POST
   https://b2b.nap.si/uc/user/token (grant_type=password) vrne access_token,
   s katerim beremo vire (Authorization: bearer). Vsak vir mora biti v profilu
   na nap.si zaprošen in odobren (stolpec »Pravice«), sicer strežnik vrne 401.
   Prijava je SAMO v nastavitvah okolja (Vercel → Environment Variables):
     PROMET_NAP_UPORABNIK (e-pošta), PROMET_NAP_GESLO
   Naslove je mogoče preglasiti s PROMET_NAP_URL_* (npr. PROMET_NAP_URL_FCD="-"
   izklopi vir). */

var datex2 = require("./datex2");
var skupno = require("./skupno");

var VIR = "nap";
var LOKACIJE_VELJAVNOST_MS = 6 * 3600 * 1000; // tabele lokacij se redko spreminjajo
var predpomnilnikLokacij = new Map();

var B2B = process.env.PROMET_NAP_B2B || "https://b2b.nap.si/data/";
var URL_ZETON = process.env.PROMET_NAP_URL_ZETON || "https://b2b.nap.si/uc/user/token";
var zeton = null; // { access, refresh, potece, kljuc }
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

function napakaPrijave(sporocilo) {
  var e = skupno.napakaVira(VIR, sporocilo);
  e.koda = "NAP_PRIJAVA";
  return e;
}

/* OAuth2: žeton se predpomni do 1 min pred iztekom; nato refresh_token,
   ob neuspehu ponovna prijava z uporabniškim imenom in geslom. */
async function pridobiZeton(n, f, vsiliNovega) {
  var kljuc = n.uporabnik;
  var zdaj = Date.now();
  if (!vsiliNovega && zeton && zeton.kljuc === kljuc && zeton.potece - 60000 > zdaj) return zeton.access;
  async function zahtevaj(telo) {
    var res;
    try {
      res = await f(URL_ZETON, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "UspesniJezek-promet/1.0" }, body: telo.toString() });
    } catch (e) {
      throw skupno.napakaVira(VIR, "prijava NAP: povezava ni uspela (" + (e && (e.cause && e.cause.code || e.message)) + ")");
    }
    if (!res.ok) return null;
    var d = null;
    try { d = await res.json(); } catch (_) {}
    return d && d.access_token ? d : null;
  }
  var d = null;
  if (zeton && zeton.kljuc === kljuc && zeton.refresh && !vsiliNovega) {
    d = await zahtevaj(new URLSearchParams({ grant_type: "refresh_token", refresh_token: zeton.refresh }));
  }
  if (!d) d = await zahtevaj(new URLSearchParams({ grant_type: "password", username: n.uporabnik, password: n.geslo }));
  if (!d) throw napakaPrijave("prijava NAP zavrnjena: preverite PROMET_NAP_UPORABNIK (e-pošta) in PROMET_NAP_GESLO");
  zeton = { access: d.access_token, refresh: d.refresh_token || null, potece: zdaj + (Number(d.expires_in) || 3600) * 1000, kljuc: kljuc };
  return zeton.access;
}

async function preberiXml(url, n, fetchFn) {
  var f = fetchFn || fetch;
  async function poskus(vsiliNovZeton) {
    var glave = { accept: "application/xml, text/xml, */*", "user-agent": "UspesniJezek-promet/1.0" };
    if (n.uporabnik && n.geslo) glave.authorization = "bearer " + await pridobiZeton(n, f, vsiliNovZeton);
    var opts = { headers: glave };
    if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) opts.signal = AbortSignal.timeout(25000);
    try { return await f(url, opts); } catch (e) {
      throw skupno.napakaVira(VIR, skrij("povezava ni uspela (" + (e && (e.cause && e.cause.code || e.message)) + ") — " + url, n));
    }
  }
  var res = await poskus(false);
  // Po navodilih NAP: ob 401 osveži žeton in poskusi še enkrat.
  if (res.status === 401 && n.uporabnik && n.geslo) res = await poskus(true);
  if (res.status === 401 || res.status === 403) {
    throw skupno.napakaVira(VIR, "dostop do vira ni odobren (HTTP " + res.status + "): na nap.si v profilu zaprosite za ta vir in počakajte na odobritev (stolpec »Pravice«) — " + url);
  }
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
  _ponastavi: function () { predpomnilnikLokacij.clear(); zeton = null; } };
