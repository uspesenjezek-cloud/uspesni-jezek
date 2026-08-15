"use strict";

var db = require("./_lib/supabase-server");
var dns = require("node:dns").promises;
var net = require("node:net");
var fs = require("node:fs");

var HWK_RHEIN_MAIN = "https://hwk-rhein-main.odav.de";
var KAMMERFINDER = "https://www.kammerfinder.de/";
var HWK_PO_PLZ = "https://www.handwerkskammer.de/kontakte/zustaendige-handwerkskammer-5620,0,dazustaendig.html";
var INSOLVENCY_SEARCH = "https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf";
var OPENREGISTER_SEARCH = "https://api.openregister.de/v0/search/company";
var OPENREGISTER_WEB = "https://openregister.de";
var OFFENBACH_GEWERBE = "https://www.offenbach.de/vv/oe/verwaltung/Ordnungsamt_Gewerbe.php?loc=de";
var USER_AGENT = "Uspesni-Jezek-soft-business-check/1.0";
var MAX_IMPRESSUM_BYTES = 5 * 1024 * 1024;
var hwkIskalnikCache = new Map();
var HWK_ODAV_OVERRIDES = {
  "handwerkskammer aachen": "https://www.hwk-aachen.de/33,76,bdbsearch.html",
  "handwerkskammer berlin": "https://www.hwk-berlin.de/91,143,bdbsearch.html",
  "handwerkskammer braunschweig luneburg stade": "https://www.hwk-bls.de/22,0,bdbsearch.html",
  "handwerkskammer cottbus": "https://www.hwk-cottbus.de/7,891,bdbsearch.html",
  "handwerkskammer der pfalz": "https://www.hwk-pfalz.de/51,0,bdbsearch.html",
  "handwerkskammer dresden": "https://hwk-dresden.odav.de/2,0,bdbsearch.html",
  "handwerkskammer dusseldorf": "https://www.hwk-duesseldorf.de/31,0,bdbsearch.html",
  "handwerkskammer erfurt": "https://www.hwk-erfurt.de/4,0,bdbsearch.html",
  "handwerkskammer frankfurt rhein main": "https://hwk-rhein-main.odav.de/betriebe/suche-45,61,bdbsearch.html",
  "handwerkskammer fur munchen und oberbayern": "https://www.hwk-muenchen.de/74,3989,bdbsearch.html",
  "handwerkskammer fur oberfranken": "https://www.hwk-oberfranken.de/72,1130,bdbsearch.html",
  "handwerkskammer fur ostthuringen": "https://www.hwk-gera.de/5,0,bdbsearch.html",
  "handwerkskammer fur schwaben": "https://www.hwk-schwaben.de/71,0,bdbsearch.html",
  "handwerkskammer magdeburg": "https://www.hwk-magdeburg.de/16,1117,bdbsearch.html",
  "handwerkskammer mannheim rhein neckar odenwald": "https://www.hwk-mannheim.de/65,764,bdbsearch.html",
  "handwerkskammer niederbayern oberpfalz": "https://www.hwkno.de/76,3395,bdbsearch.html",
  "handwerkskammer ostmecklenburg vorpommern": "https://www.hwk-omv.de/18,0,bdbsearch.html",
  "handwerkskammer ostwestfalen lippe zu bielefeld": "https://www.handwerk-owl.de/35,0,bdbsearch.html",
  "handwerkskammer potsdam": "https://www.hwk-potsdam.de/9,0,bdbsearch.html",
  "handwerkskammer schwerin": "https://www.hwk-schwerin.de/19,0,bdbsearch.html",
  "handwerkskammer sudwestfalen": "https://www.hwk-swf.de/38,0,bdbsearch.html",
  "handwerkskammer trier": "https://www.hwk-trier.de/54,525,bdbsearch.html",
  "handwerkskammer wiesbaden": "https://www.hwk-wiesbaden.de/44,733,bdbsearch.html",
  "handwerkskammer zu koln": "https://www.hwk-koeln.de/32,943,bdbsearch.html",
  "handwerkskammer zu leipzig": "https://www.hwk-leipzig.de/3,0,bdbsearch.html",
};
var HWK_CUSTOM_OVERRIDES = {
  "handwerkskammer bremen": "https://www.hwk-bremen.de/service-center/handwerkersuche",
  "handwerkskammer des saarlandes": "https://www.hwk-saarland.de/handwerkersuche/",
  "handwerkskammer dortmund": "https://www.hwk-do.de/handwerkersuche/",
  "handwerkskammer flensburg": "https://www.hwk-flensburg.de/service-center/handwerker-finden/handwerkersuche",
  "handwerkskammer frankfurt oder region ostbrandenburg": "https://www.handwerker-radar.de/5100,111,hwrsearch.html",
  "handwerkskammer freiburg": "https://www.hwk-freiburg.de/handwerkersuche/",
  "handwerkskammer fur ostfriesland": "https://www.hwk-aurich.de/service-center/handwerkersuche",
  "handwerkskammer heilbronn franken": "https://www.hwk-heilbronn.de/handwerkerfinden/",
  "handwerkskammer konstanz": "https://www.hwk-konstanz.de/handwerker-suchen/",
  "handwerkskammer lubeck": "https://www.hwk-luebeck.de/service-center/handwerkersuche",
  "handwerkskammer munster": "https://www.hwk-muenster.de/de/service-center/handwerkskunden/handwerkersuche-digital",
  "handwerkskammer oldenburg": "https://www.hwk-oldenburg.de/service-center/handwerker-finden",
  "handwerkskammer osnabruck emsland grafschaft bentheim": "https://www.hwk-osnabrueck.de/handwerkersuche/",
  "handwerkskammer reutlingen": "https://www.hwk-reutlingen.de/service-center/handwerkersuche/",
  "handwerkskammer rheinhessen": "https://www.hwk.de/handwerkersuche/",
  "handwerkskammer sudthuringen": "https://www.hwk-suedthueringen.de/handwerkersuche/",
  "handwerkskammer ulm": "https://www.hwk-ulm.de/handwerkersuche/",
};

function odgovorJson(res, status, podatki) {
  res.status(status).json(podatki);
}

function normaliziraj(vrednost) {
  return String(vrednost || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(herr|frau|firma)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function decodeHtml(vrednost) {
  return String(vrednost || "")
    .replace(/&#(\d+);/g, function (_, koda) { return String.fromCharCode(Number(koda)); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, koda) { return String.fromCharCode(parseInt(koda, 16)); })
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&auml;/gi, "ä")
    .replace(/&ouml;/gi, "ö")
    .replace(/&uuml;/gi, "ü")
    .replace(/&szlig;/gi, "ß")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function besediloIzHtml(html) {
  return decodeHtml(String(html || ""))
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\r]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function varnoBesedilo(vrednost, najvec) {
  return String(vrednost || "").trim().replace(/\s+/g, " ").slice(0, najvec);
}

function pocistiImeOsebe(vrednost) {
  return String(vrednost || "")
    .replace(/^(?:herr|frau)\s+/i, "")
    .replace(/\s*\([^)]*(?:einzelvertret|vertretungsberechtigt|gesch(?:ä|a)ftsf(?:ü|u)hr)[^)]*\)\s*/gi, " ")
    .replace(/\s+(?:telefon|tel\.?|e-?mail|anschrift|adresse)\b[\s\S]*$/i, "")
    .replace(/[;,]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function jeVerjetnoImeOsebe(vrednost) {
  var ime = pocistiImeOsebe(vrednost);
  if (/\d|[<>{}=]|&(?:[a-z]+|#\d+);/i.test(ime)) return false;
  var deli = ime.split(/\s+/).filter(Boolean);
  if (deli.length < 2 || deli.length > 6 || ime.length > 100) return false;
  var normaliziraniDeli = deli.map(normaliziraj);
  if (new Set(normaliziraniDeli).size !== normaliziraniDeli.length) return false;
  if (normaliziraniDeli.some(function (del) {
    return /^(?:location|kontakt|contact|impressum|imprint|datenschutz|privacy|adresse|address|anschrift|telefon|email|mail|home|start|menu|menue|uber|uns|about|willkommen|anbieterkennung|gesetzliche|seiten|seite|navigation|footer|header|haustechnik|sanitar|sanitaer|heizung|elektro|meisterbetrieb|installateur|rohrreinigung|kanalreinigung|kanalsanierung|klempner)$/.test(del);
  })) return false;
  if (/\b(?:gmbh|ug|ag|kg|ohg|gbr|inhaber|geschäftsführer|telefon|e-?mail|umsatzsteuer|angaben|inhaltlich|verantwortlich)\b/i.test(ime)) return false;
  var jedro = deli.filter(function (del) { return !/^(?:dr\.?|prof\.?|dipl\.-?ing\.?)$/i.test(del); });
  var vezniki = new Set(["von", "van", "der", "den", "de", "del", "di", "zu", "zur", "zum"]);
  var imenskeBesede = jedro.filter(function (del) { return !vezniki.has(normaliziraj(del)); });
  if (imenskeBesede.length < 2 || imenskeBesede.length > 3) return false;
  return jedro.every(function (del) {
    if (vezniki.has(normaliziraj(del))) return /^[\p{Ll}]+$/u.test(del);
    return /^[\p{Lu}][\p{Ll}]+(?:[-'’][\p{Lu}]?[\p{Ll}]+)*$/u.test(del);
  });
}

function jeZasebenIp(ip) {
  var naslov = String(ip || "").toLowerCase();
  if (net.isIPv4(naslov)) {
    var deli = naslov.split(".").map(Number);
    return deli[0] === 10 || deli[0] === 127 || deli[0] === 0 ||
      (deli[0] === 169 && deli[1] === 254) ||
      (deli[0] === 172 && deli[1] >= 16 && deli[1] <= 31) ||
      (deli[0] === 192 && deli[1] === 168) ||
      (deli[0] >= 224);
  }
  if (net.isIPv6(naslov)) {
    return naslov === "::1" || naslov === "::" || naslov.startsWith("fc") ||
      naslov.startsWith("fd") || /^fe[89ab]/.test(naslov) || naslov.startsWith("::ffff:127.");
  }
  return true;
}

async function preveriJavniSpletniNaslov(vrednost) {
  var vnos = String(vrednost || "").trim();
  if (!vnos) return null;
  if (!/^https?:\/\//i.test(vnos)) vnos = "https://" + vnos;
  var url;
  try { url = new URL(vnos); } catch (_) { throw new Error("WEBSITE_INVALID"); }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || net.isIP(url.hostname) ||
      /(?:^|\.)(?:localhost|local|internal)$/i.test(url.hostname)) {
    throw new Error("WEBSITE_INVALID");
  }
  var naslovi = await dns.lookup(url.hostname, { all: true });
  if (!naslovi.length || naslovi.some(function (zapis) { return jeZasebenIp(zapis.address); })) {
    throw new Error("WEBSITE_NOT_PUBLIC");
  }
  return url;
}

async function fetchJavniHtml(zacetniUrl) {
  var url = zacetniUrl;
  for (var preusmeritev = 0; preusmeritev < 4; preusmeritev += 1) {
    await preveriJavniSpletniNaslov(url.toString());
    var odgovor = await fetchZRokom(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    }, 10000);
    if (odgovor.status >= 300 && odgovor.status < 400) {
      var lokacija = odgovor.headers.get("location");
      if (!lokacija) throw new Error("WEBSITE_REDIRECT_FAILED");
      url = new URL(lokacija, url);
      continue;
    }
    if (!odgovor.ok) throw new Error("WEBSITE_FETCH_FAILED");
    var tip = String(odgovor.headers.get("content-type") || "");
    if (tip && !/text\/html|application\/xhtml\+xml/i.test(tip)) throw new Error("WEBSITE_NOT_HTML");
    var dolzina = Number(odgovor.headers.get("content-length") || 0);
    if (dolzina > MAX_IMPRESSUM_BYTES) throw new Error("WEBSITE_TOO_LARGE");
    var html = await odgovor.text();
    if (html.length > MAX_IMPRESSUM_BYTES) throw new Error("WEBSITE_TOO_LARGE");
    return { html: html, url: url.toString() };
  }
  throw new Error("WEBSITE_TOO_MANY_REDIRECTS");
}

function razcleniImpressumLegacy(html, sourceUrl, vnos) {
  var strukturiranHtml = String(html || "").replace(/<\/(?:h[1-6]|p|div|li|section|article)>/gi, "$&\n");
  var tekst = besediloIzHtml(strukturiranHtml).replace(/\s*\n\s*/g, "\n");
  var vrstice = tekst.split("\n").map(function (vrstica) { return vrstica.trim(); }).filter(Boolean);
  var vzorci = [
    /Vertreten\s+durch\s*:?\s*\n?([^\n]{2,100})/i,
    /Vertretungsberechtigte(?:r|n)?\s+Gesellschafter(?:in)?\s*:?\s*\n?([^\n]{2,100})/i,
    /Inhaber(?:in)?\s*:?\s*\n?([^\n]{2,100})/i,
    /Geschäftsführer(?:in)?\s*:?\s*\n?([^\n]{2,100})/i,
  ];
  var nosilec = "";
  for (var i = 0; i < vzorci.length && !nosilec; i += 1) {
    var ujemanje = tekst.match(vzorci[i]);
    if (ujemanje && jeVerjetnoImeOsebe(ujemanje[1])) nosilec = pocistiImeOsebe(ujemanje[1]);
  }
  if (!nosilec) {
    var mocniPoudarki = Array.from(String(html || "").matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi))
      .map(function (ujemanje) { return besediloIzHtml(ujemanje[1]); })
      .filter(function (vrednost) {
        return !/\b(?:und|installateur|heizungsbauer|meisterbetrieb|handwerk|sanit[aä]r|elektro(?:techniker|meister)?)\b/i.test(vrednost);
      });
    nosilec = mocniPoudarki.find(jeVerjetnoImeOsebe) || "";
  }
  if (!nosilec) {
    for (var vrsticaIndex = 0; vrsticaIndex < vrstice.length && !nosilec; vrsticaIndex += 1) {
      if (!/\b\d{5}\s+[\p{L}]/u.test(vrstice[vrsticaIndex])) continue;
      var kandidatiPredNaslovom = [];
      for (var nazaj = vrsticaIndex - 1; nazaj >= Math.max(0, vrsticaIndex - 4); nazaj -= 1) {
        if (jeVerjetnoImeOsebe(vrstice[nazaj])) {
          kandidatiPredNaslovom.push(pocistiImeOsebe(vrstice[nazaj]));
        }
      }
      kandidatiPredNaslovom.sort(function (a, b) {
        return a.split(/\s+/).length - b.split(/\s+/).length || a.length - b.length;
      });
      nosilec = kandidatiPredNaslovom[0] || "";
    }
  }
  if (!nosilec) return null;
  var lokacija = tekst.match(/\b(\d{5})\s+([^\n,]{2,80})/u);
  return {
    ime: nosilec,
    naziv: vnos.ime,
    postnaStevilka: lokacija ? lokacija[1] : vnos.postnaStevilka,
    kraj: lokacija ? lokacija[2].trim() : vnos.kraj,
    sourceUrl: sourceUrl,
  };
}

function razcleniImpressum(html, sourceUrl, vnos) {
  var strukturiranHtml = String(html || "").replace(/<\/(?:h[1-6]|p|div|li|section|article|address|td|dd)>/gi, "$&\n");
  var tekst = besediloIzHtml(strukturiranHtml).replace(/\s*\n\s*/g, "\n");
  var vrstice = tekst.split("\n").map(function (vrstica) { return vrstica.trim(); }).filter(Boolean);
  var oznakaVloge = [
    "Vertreten\\s+durch",
    "Gesetzliche\\s+Anbieterkennung",
    "Anbieterkennzeichnung",
    "Vertretungsberechtigte(?:r|n)?(?:\\s+(?:Gesellschafter(?:in)?|Gesch(?:ä|a)ftsf(?:ü|u)hrer(?:in)?|Person|Vorstand|Partner(?:in)?))?",
    "Gesetzliche(?:r|n)?\\s+Vertreter(?:in)?",
    "Gesch(?:ä|a)ftsf(?:ü|u)hrende(?:r)?\\s+Gesellschafter(?:in)?",
    "Pers(?:ö|o)nlich\\s+haftende(?:r)?\\s+Gesellschafter(?:in)?",
    "Gesch(?:ä|a)ftsf(?:ü|u)hrer(?:in)?",
    "Gesch(?:ä|a)ftsf(?:ü|u)hrung",
    "Betriebsinhaber(?:in)?",
    "Firmeninhaber(?:in)?",
    "Gesch(?:ä|a)ftsinhaber(?:in)?",
    "Inhaber(?:in)?",
    "Gesellschafter(?:in)?",
    "Vorstandsvorsitzende(?:r)?",
    "Vorstand",
    "Komplement(?:ä|a)r(?:in)?",
    "Partner(?:in)?",
  ].join("|");
  var vzorecVloge = new RegExp("(?:" + oznakaVloge + ")\\s*:?\\s*\\n?([^\\n]{2,180})", "gi");
  var nosilci = [];
  var ujemanjeVloge;
  while ((ujemanjeVloge = vzorecVloge.exec(tekst)) && nosilci.length < 6) {
    var suroviNosilci = ujemanjeVloge[1].split(/\s*(?:;|\bund\b|\s&\s)\s*/i);
    for (var i = 0; i < suroviNosilci.length && nosilci.length < 6; i += 1) {
      var kandidat = pocistiImeOsebe(suroviNosilci[i]);
      if (jeVerjetnoImeOsebe(kandidat) && !nosilci.some(function (oseba) {
        return normaliziraj(oseba) === normaliziraj(kandidat);
      })) nosilci.push(kandidat);
    }
  }

  // Ta oznaka pogosto pomeni uredniško odgovorno osebo, zato je samo rezervni
  // kandidat. Končno identiteto mora še vedno potrditi register ali HWK.
  if (!nosilci.length) {
    var odgovornaOseba = tekst.match(/(?:Inhaltlich\s+verantwortlich|Verantwortlich\s+f(?:ĂĽ|u)r\s+den\s+Inhalt)\s*:?\s*\n?([^\n]{2,100})/i);
    if (odgovornaOseba && jeVerjetnoImeOsebe(odgovornaOseba[1])) {
      nosilci.push(pocistiImeOsebe(odgovornaOseba[1]));
    }
  }

  if (!nosilci.length) {
    var zacetekPravnegaBloka = String(html || "").search(/<(?:h1|h2|h3|p)\b[^>]*>\s*(?:<[^>]+>\s*)*Impressum\s*(?:<\/[^>]+>\s*)*<\/(?:h1|h2|h3|p)>/i);
    if (zacetekPravnegaBloka >= 0) {
      var pravniBlok = String(html || "").slice(zacetekPravnegaBloka, zacetekPravnegaBloka + 2500);
      var vrsticeBloka = besediloIzHtml(pravniBlok.replace(/<\/(?:h[1-6]|p|div|li|section|article|address|td|dd)>/gi, "$&\n"))
        .replace(/\s*\n\s*/g, "\n").split("\n").map(function (vrstica) { return vrstica.trim(); }).filter(Boolean);
      var naslovniIndex = vrsticeBloka.findIndex(function (vrstica) { return /\b\d{5}\s+[\p{L}]/u.test(vrstica); });
      if (naslovniIndex > 0) {
        var zacetniKandidati = vrsticeBloka.slice(1, naslovniIndex).slice(-4).filter(jeVerjetnoImeOsebe);
        if (zacetniKandidati[0]) nosilci.push(pocistiImeOsebe(zacetniKandidati[0]));
      }
    }
  }
  if (!nosilci.length) return null;

  var lokacija = tekst.match(/\b(\d{5})\s+([^\n,]{2,80})/u);
  var nazivDruzbe = vrstice.find(function (vrstica) {
    return /\b(?:GmbH|UG(?:\s*\(haftungsbeschr(?:ä|a)nkt\))?|AG|GbR|OHG|KG|e\.?\s*K\.?|PartG|eG)\b/i.test(vrstica) && vrstica.length <= 140;
  }) || vnos.ime;
  var register = tekst.match(/\b((?:HR[AB]|GnR|PR|VR)\s*[A-Z]?\s*\d+[A-Z0-9-]*)\b/i);
  var registergericht = tekst.match(/(?:Registergericht|Amtsgericht)\s*:?\s*([^\n]{2,100})/i);
  var ustId = tekst.match(/\b(?:USt\.?-?IdNr\.?|Umsatzsteuer(?:-|\s*)Identifikationsnummer)\s*:?\s*(DE\s*\d{9})\b/i);
  var email = tekst.match(/\b(?:E-?Mail)\s*:?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i);
  var telefon = tekst.match(/\b(?:Telefon|Tel\.?)\s*:?\s*(\+?[\d][\d\s()/.-]{5,}\d)/i);
  return {
    ime: nosilci[0],
    naziv: nazivDruzbe,
    zastopniki: nosilci,
    postnaStevilka: lokacija ? lokacija[1] : vnos.postnaStevilka,
    kraj: lokacija ? lokacija[2].trim() : vnos.kraj,
    registerNumber: register ? register[1].replace(/\s+/g, " ").trim() : "",
    registerCourt: registergericht ? registergericht[1].trim() : "",
    vatId: ustId ? ustId[1].replace(/\s+/g, "") : "",
    email: email ? email[1] : "",
    telefon: telefon ? telefon[1].trim() : "",
    sourceUrl: sourceUrl,
  };
}

function najdiImpressumPovezave(html, sourceUrl) {
  var rezultat = [];
  var vzorec = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var osnovni = new URL(sourceUrl);
  var ujemanje;
  while ((ujemanje = vzorec.exec(String(html || ""))) && rezultat.length < 5) {
    var oznaka = besediloIzHtml(ujemanje[2]);
    if (!/impressum/i.test(oznaka) && !/impressum/i.test(ujemanje[1])) continue;
    try {
      var povezava = new URL(decodeHtml(ujemanje[1]), osnovni);
      if (/^https?:$/.test(povezava.protocol) && !rezultat.includes(povezava.toString())) {
        rezultat.push(povezava.toString());
      }
    } catch (_) {}
  }
  return rezultat;
}

function jeImpressumDokument(html, sourceUrl) {
  var url;
  try { url = new URL(sourceUrl); } catch (_) { return false; }
  if (/\b(?:impressum|imprint)\b/i.test(url.pathname)) return true;
  return najdiImpressumPovezave(html, sourceUrl).some(function (povezava) {
    try {
      var kandidat = new URL(povezava);
      kandidat.hash = "";
      var trenutni = new URL(sourceUrl);
      trenutni.hash = "";
      return kandidat.toString().replace(/\/$/, "") === trenutni.toString().replace(/\/$/, "");
    } catch (_) { return false; }
  });
}

async function poisciVImpressumu(vnos) {
  if (!vnos.spletnaStran) return { status: "not_provided" };
  try {
    var osnova = await preveriJavniSpletniNaslov(vnos.spletnaStran);
    var poti = [osnova, new URL("/impressum", osnova), new URL("/impressum.html", osnova)];
    var obiskane = new Set();
    var najdenImpressumBrezNosilca = "";
    for (var i = 0; i < poti.length && obiskane.size < 7; i += 1) {
      var cilj = poti[i].toString();
      if (obiskane.has(cilj)) continue;
      obiskane.add(cilj);
      try {
        var stran = await fetchJavniHtml(cilj);
        var noveImpressumPovezave = najdiImpressumPovezave(stran.html, stran.url).filter(function (povezava) {
          return !obiskane.has(povezava);
        });
        noveImpressumPovezave.forEach(function (povezava) {
          poti.splice(i + 1, 0, povezava);
        });
        var jeImpressum = jeImpressumDokument(stran.html, stran.url);
        var subjekt = jeImpressum ? razcleniImpressum(stran.html, stran.url, vnos) : null;
        if (subjekt) {
          return { status: "found", subjekt: subjekt, sourceUrl: stran.url };
        }
        if (jeImpressum) najdenImpressumBrezNosilca = stran.url;
      } catch (_) {}
    }
    return {
      status: "not_found",
      reason: najdenImpressumBrezNosilca ? "holder_not_reliably_identified" : "impressum_not_found",
      sourceUrl: najdenImpressumBrezNosilca || osnova.toString(),
    };
  } catch (_) {
    return { status: "unavailable" };
  }
}

function frankfurtskaPosta(postna) {
  return /^(60[3-5]\d{2}|630\d{2}|631\d{2}|632\d{2}|633\d{2}|659\d{2})$/.test(String(postna || ""));
}

function jeFrankfurt(postna, kraj) {
  return frankfurtskaPosta(postna) || /\b(?:frankfurt(?:\s+am\s+main)?|offenbach(?:\s+am\s+main)?)\b/i.test(String(kraj || ""));
}

function razcleniOpenRegisterVnos(vrednost) {
  var vnos = String(vrednost || "").trim();
  var id = vnos.match(/\bDE-(HRA|HRB|PR|GNR|VR)-[A-Z0-9]+-(\d+)\b/i);
  if (id) {
    return {
      companyId: id[0].toUpperCase(),
      registerType: id[1].toUpperCase() === "GNR" ? "GnR" : id[1].toUpperCase(),
      registerNumber: id[2],
    };
  }
  var register = vnos.match(/\b(HRA|HRB|PR|GNR|VR)\s*[- ]?\s*(\d+)\b/i);
  if (register) {
    return {
      companyId: "",
      registerType: register[1].toUpperCase() === "GNR" ? "GnR" : register[1].toUpperCase(),
      registerNumber: register[2],
    };
  }
  return { companyId: "", registerType: "", registerNumber: "" };
}

function oceniOpenRegisterZadetek(kandidat, vnos) {
  var register = razcleniOpenRegisterVnos(vnos && vnos.ime);
  if (register.companyId && String(kandidat && kandidat.company_id || "").toUpperCase() === register.companyId) return 500;
  if (register.registerNumber && String(kandidat && kandidat.register_number || "") === register.registerNumber &&
      (!register.registerType || String(kandidat && kandidat.register_type || "").toUpperCase() === register.registerType.toUpperCase())) return 450;
  var iskano = normaliziraj(vnos.ime);
  var najdeno = normaliziraj(kandidat && kandidat.name);
  if (!iskano || !najdeno) return 0;
  var lokacijskeTocke = 0;
  var naslov = kandidat && kandidat.address || {};
  if (vnos.postnaStevilka && String(naslov.postal_code || "") === vnos.postnaStevilka) lokacijskeTocke += 80;
  if (vnos.kraj && normaliziraj(naslov.city) === normaliziraj(vnos.kraj)) lokacijskeTocke += 30;
  if (iskano === najdeno) return 200 + lokacijskeTocke;
  var iskaniDeli = iskano.split(" ").filter(function (del) { return del.length > 1; });
  var najdeniDeli = new Set(najdeno.split(" "));
  var skupni = iskaniDeli.filter(function (del) { return najdeniDeli.has(del); }).length;
  return skupni * 25 + (najdeno.includes(iskano) || iskano.includes(najdeno) ? 45 : 0) + lokacijskeTocke;
}

function izberiOpenRegisterZadetek(rezultati, vnos) {
  var ocenjeni = (Array.isArray(rezultati) ? rezultati : []).map(function (kandidat) {
    return { kandidat: kandidat, ocena: oceniOpenRegisterZadetek(kandidat, vnos) };
  }).sort(function (a, b) { return b.ocena - a.ocena; });
  if (!ocenjeni.length || ocenjeni[0].ocena < 70) return { status: "not_found" };
  if (ocenjeni[1] && ocenjeni[1].ocena >= 70 && ocenjeni[0].ocena - ocenjeni[1].ocena < 20) {
    return { status: "ambiguous", candidates: ocenjeni.slice(0, 3).map(function (x) { return x.kandidat; }) };
  }
  return { status: "found", company: ocenjeni[0].kandidat };
}

async function poisciOpenRegister(vnos) {
  var kljuc = String(process.env.OPENREGISTER_API_KEY || "").trim();
  if (!kljuc) return { status: "not_configured", sourceUrl: OPENREGISTER_WEB };
  var url = new URL(OPENREGISTER_SEARCH);
  var register = razcleniOpenRegisterVnos(vnos.ime);
  if (register.registerNumber) {
    url.searchParams.set("register_number", register.registerNumber);
    if (register.registerType) url.searchParams.set("register_type", register.registerType);
  } else {
    url.searchParams.set("query", vnos.ime);
  }
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "10");
  try {
    var odgovor = await fetchZRokom(url, {
      headers: { Authorization: "Bearer " + kljuc, Accept: "application/json", "User-Agent": USER_AGENT },
    }, 12000);
    if (odgovor.status === 401 || odgovor.status === 403) return { status: "not_configured", sourceUrl: OPENREGISTER_WEB };
    if (!odgovor.ok) return { status: "unavailable", sourceUrl: OPENREGISTER_WEB };
    var podatki = await odgovor.json();
    var izbor = izberiOpenRegisterZadetek(podatki.results, vnos);
    var sourceUrl = izbor.status === "found" && izbor.company && izbor.company.company_id
      ? OPENREGISTER_WEB + "/company/" + encodeURIComponent(izbor.company.company_id)
      : OPENREGISTER_WEB;
    return Object.assign({ sourceUrl: sourceUrl, queryUrl: url.toString() }, izbor);
  } catch (_) {
    return { status: "unavailable", sourceUrl: OPENREGISTER_WEB };
  }
}

async function fetchZRokom(url, moznosti, rokMs) {
  var zadnjaNapaka;
  for (var poskus = 0; poskus < 2; poskus += 1) {
    var kontrolnik = new AbortController();
    var casovnik = setTimeout(function () { kontrolnik.abort(); }, rokMs || 12000);
    try {
      return await fetch(url, Object.assign({}, moznosti || {}, { signal: kontrolnik.signal }));
    } catch (napaka) {
      zadnjaNapaka = napaka;
      if (poskus === 0) await new Promise(function (resolve) { setTimeout(resolve, 300); });
    } finally {
      clearTimeout(casovnik);
    }
  }
  throw zadnjaNapaka;
}

function razcleniKammerfinderRezultat(html) {
  var vrstice = String(html || "").match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  for (var i = 0; i < vrstice.length; i += 1) {
    if (!/\/img\/hwk\.png/i.test(vrstice[i])) continue;
    var povezava = vrstice[i].match(/<a\b[^>]*href\s*=\s*["']([^"']*kammerinfos\?knr=\d+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (povezava) {
      return {
        name: besediloIzHtml(povezava[2]).replace(/\s+/g, " ").trim(),
        infoUrl: new URL(decodeHtml(povezava[1]), KAMMERFINDER).toString(),
      };
    }
  }
  return null;
}

function razcleniKammerfinderInfo(html, infoUrl) {
  var internet = String(html || "").match(/<b>\s*Internet:\s*<\/b>\s*<a\b[^>]*href\s*=\s*["']([^"']+)["']/i);
  if (!internet) {
    internet = String(html || "").match(/<a\b[^>]*href\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>\s*https?:\/\//i);
  }
  return internet ? new URL(decodeHtml(internet[1]), infoUrl).toString() : "";
}

function razcleniCentralnoHwk(html, sourceUrl) {
  var vsebina = String(html || "");
  var naslovi = vsebina.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || [];
  var name = "";
  for (var i = 0; i < naslovi.length; i += 1) {
    var kandidat = besediloIzHtml(naslovi[i]).replace(/\s+/g, " ").trim();
    if (/^handwerkskammer\b/i.test(kandidat)) {
      name = kandidat;
      break;
    }
  }
  if (!name) return null;

  var povezave = [];
  var vzorec = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var ujemanje;
  while ((ujemanje = vzorec.exec(vsebina))) {
    try {
      var url = new URL(decodeHtml(ujemanje[1]), sourceUrl).toString();
      var oznaka = besediloIzHtml(ujemanje[2]).replace(/\s+/g, " ").trim();
      var gostitelj = new URL(url).hostname.toLowerCase();
      if (!/^https?:/i.test(url) || /(^|\.)handwerkskammer\.de$/i.test(gostitelj)) continue;
      povezave.push({ url: url, label: oznaka });
    } catch (_) {}
  }
  var iskalna = povezave.find(function (povezava) {
    return /handwerker.?suche|betriebs.?suche|handwerker.{0,15}finden|bdbsearch/i.test(povezava.label + " " + povezava.url);
  });
  var domaca = povezave.find(function (povezava) {
    return !/handwerker.?suche|betriebs.?suche|handwerker.{0,15}finden|bdbsearch/i.test(povezava.label + " " + povezava.url);
  }) || iskalna;
  return {
    name: name,
    homepage: domaca ? new URL(domaca.url).origin + "/" : "",
    searchUrl: iskalna ? iskalna.url : "",
    sourceUrl: sourceUrl,
  };
}

async function dolociPristojnoHwkCentralno(vnos) {
  var posta = String(vnos && vnos.postnaStevilka || "").match(/\b\d{5}\b/);
  if (!posta) return { status: "not_found", sourceUrl: HWK_PO_PLZ };
  var url = new URL(HWK_PO_PLZ);
  url.searchParams.set("plzonr", posta[0]);
  var odgovor = await fetchZRokom(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } }, 15000);
  if (!odgovor.ok) throw new Error("HWK_PLZ_SEARCH_FAILED");
  var izbor = razcleniCentralnoHwk(await odgovor.text(), odgovor.url || url.toString());
  if (!izbor) return { status: "not_found", sourceUrl: url.toString() };
  return Object.assign({ status: "found", resolutionSource: "handwerkskammer.de" }, izbor);
}

async function dolociPristojnoHwkKammerfinder(vnos) {
  var prvi = await fetchZRokom(KAMMERFINDER, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } }, 15000);
  if (!prvi.ok) throw new Error("KAMMERFINDER_OPEN_FAILED");
  var prviHtml = await prvi.text();
  var csrf = decodeHtml((prviHtml.match(/name=["']_csrfToken["'][^>]*value=["']([^"']+)/i) || [null, ""])[1]);
  if (!csrf) throw new Error("KAMMERFINDER_FORM_CHANGED");
  var naslov = [vnos.postnaStevilka, vnos.kraj].filter(Boolean).join(" ");
  var drugi = await fetchZRokom(KAMMERFINDER, {
    method: "POST",
    redirect: "follow",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookiesIzOdgovora(prvi),
      Origin: "https://www.kammerfinder.de",
      Referer: KAMMERFINDER,
    },
    body: new URLSearchParams({ _csrfToken: csrf, adresse: naslov, bundesland: "" }),
  }, 18000);
  if (!drugi.ok) throw new Error("KAMMERFINDER_SEARCH_FAILED");
  var izbor = razcleniKammerfinderRezultat(await drugi.text());
  if (!izbor) return { status: "not_found", sourceUrl: KAMMERFINDER };
  var info = await fetchZRokom(izbor.infoUrl, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } }, 15000);
  var homepage = info.ok ? razcleniKammerfinderInfo(await info.text(), izbor.infoUrl) : "";
  return {
    status: "found",
    name: izbor.name,
    homepage: homepage,
    infoUrl: izbor.infoUrl,
    sourceUrl: KAMMERFINDER,
    resolutionSource: "kammerfinder.de",
  };
}

async function dolociPristojnoHwk(vnos) {
  try {
    var uradna = await dolociPristojnoHwkCentralno(vnos);
    if (uradna.status === "found") return uradna;
  } catch (_) {}
  return dolociPristojnoHwkKammerfinder(vnos);
}

function najdiHwkIskalnePovezave(html, osnovniUrl) {
  var povezave = [];
  var vzorec = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var ujemanje;
  while ((ujemanje = vzorec.exec(String(html || ""))) && povezave.length < 12) {
    var oznaka = besediloIzHtml(ujemanje[2]).replace(/\s+/g, " ").trim();
    var skupno = (oznaka + " " + ujemanje[1]).toLowerCase();
    if (!/bdbsearch|handwerker.?suche|betriebs.?suche|handwerker.{0,15}finden/.test(skupno)) continue;
    try {
      var url = new URL(decodeHtml(ujemanje[1]), osnovniUrl).toString();
      if (!/handwerkskammer\.de\/artikel\/handwerkersuche/i.test(url) && !povezave.some(function (x) { return x.url === url; })) {
        povezave.push({ label: oznaka, url: url });
      }
    } catch (_) {}
  }
  return povezave;
}

function najdiBdbSearchUrl(html, osnovniUrl) {
  var neposredna = najdiHwkIskalnePovezave(html, osnovniUrl).find(function (povezava) {
    return /bdbsearch/i.test(povezava.url);
  });
  return neposredna ? neposredna.url.replace(/#.*$/, "") : "";
}

async function dolociHwkIskalnik(zbornica) {
  if (!zbornica || zbornica.status !== "found") return { type: "none", searchUrl: KAMMERFINDER };
  var kljuc = normaliziraj(zbornica.name);
  if (hwkIskalnikCache.has(kljuc)) return hwkIskalnikCache.get(kljuc);
  var override = HWK_ODAV_OVERRIDES[kljuc];
  var customOverride = HWK_CUSTOM_OVERRIDES[kljuc];
  var rezultat = override ? { type: "odav", searchUrl: override } : (customOverride ? { type: "custom", searchUrl: customOverride } : null);
  if (zbornica.searchUrl) {
    if (/bdbsearch/i.test(zbornica.searchUrl)) {
      rezultat = { type: "odav", searchUrl: zbornica.searchUrl.replace(/#.*$/, "") };
    } else {
      try {
        var neposredna = await fetchZRokom(zbornica.searchUrl, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } }, 14000);
        if (neposredna.ok) {
          var neposrednaUrl = neposredna.url || zbornica.searchUrl;
          var neposredniHtml = await neposredna.text();
          var bdb = najdiBdbSearchUrl(neposredniHtml, neposrednaUrl);
          rezultat = bdb ? { type: "odav", searchUrl: bdb } : { type: "custom", searchUrl: neposrednaUrl };
        }
      } catch (_) {
        if (!rezultat) rezultat = { type: "custom", searchUrl: zbornica.searchUrl };
      }
    }
  }
  if (zbornica.homepage) {
    try {
      var domaca = await fetchZRokom(zbornica.homepage, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } }, 14000);
      if (domaca.ok) {
        var domaciHtml = await domaca.text();
        var domaciUrl = domaca.url || zbornica.homepage;
        var neposredniBdb = najdiBdbSearchUrl(domaciHtml, domaciUrl);
        if (neposredniBdb) rezultat = { type: "odav", searchUrl: neposredniBdb };
        var kandidati = najdiHwkIskalnePovezave(domaciHtml, domaciUrl);
        for (var i = 0; !neposredniBdb && i < Math.min(kandidati.length, 4); i += 1) {
          try {
            var kandidat = await fetchZRokom(kandidati[i].url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } }, 12000);
            if (!kandidat.ok) continue;
            var kandidatHtml = await kandidat.text();
            var kandidatUrl = kandidat.url || kandidati[i].url;
            neposredniBdb = /bdbsearch/i.test(kandidatUrl) ? kandidatUrl.replace(/#.*$/, "") : najdiBdbSearchUrl(kandidatHtml, kandidatUrl);
            if (neposredniBdb) rezultat = { type: "odav", searchUrl: neposredniBdb };
            else if (!rezultat) rezultat = { type: "custom", searchUrl: kandidatUrl };
          } catch (_) {}
        }
        if (!rezultat && kandidati[0]) rezultat = { type: "custom", searchUrl: kandidati[0].url };
      }
    } catch (_) {}
  }
  rezultat = rezultat || { type: "manual", searchUrl: zbornica.homepage || zbornica.infoUrl || KAMMERFINDER };
  rezultat.chamberName = zbornica.name;
  rezultat.chamberUrl = zbornica.homepage || zbornica.infoUrl;
  hwkIskalnikCache.set(kljuc, rezultat);
  return rezultat;
}

function razcleniHwkRezultate(html, osnovniUrl) {
  var rezultati = [];
  var vzorec = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
  var ujemanje;
  while ((ujemanje = vzorec.exec(String(html || "")))) {
    var blok = ujemanje[1];
    var povezava = blok.match(/<a\b[^>]*href=["']([^"']*bdbdetail[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!povezava) continue;
    var tekst = besediloIzHtml(blok).replace(/\s+/g, " ").trim();
    var posta = (tekst.match(/\b\d{5}\b/) || [""])[0];
    rezultati.push({
      ime: besediloIzHtml(povezava[2]).replace(/\s+/g, " ").trim(),
      postnaStevilka: posta,
      povzetek: tekst,
      url: new URL(decodeHtml(povezava[1]), osnovniUrl).toString(),
    });
  }
  return rezultati;
}

function oceniHwkZadetek(kandidat, vnos) {
  var iskano = normaliziraj(vnos.ime);
  var najdeno = normaliziraj(kandidat.ime);
  var iskaniDeli = iskano.split(" ").filter(Boolean);
  var najdeniDeli = new Set(najdeno.split(" ").filter(Boolean));
  var skupni = iskaniDeli.filter(function (del) { return najdeniDeli.has(del); }).length;
  var ocena = skupni * 22;
  if (iskano && iskano === najdeno) ocena += 90;
  if (vnos.postnaStevilka && kandidat.postnaStevilka === vnos.postnaStevilka) ocena += 65;
  if (vnos.kraj && normaliziraj(kandidat.povzetek).includes(normaliziraj(vnos.kraj))) ocena += 18;
  return ocena;
}

function izberiHwkZadetek(rezultati, vnos) {
  var ocenjeni = rezultati.map(function (kandidat) {
    return { kandidat: kandidat, ocena: oceniHwkZadetek(kandidat, vnos) };
  }).sort(function (a, b) { return b.ocena - a.ocena; });
  if (!ocenjeni.length || ocenjeni[0].ocena < 65) return { status: "not_found", kandidati: [] };
  if (ocenjeni[1] && ocenjeni[1].ocena >= 65 && ocenjeni[0].ocena - ocenjeni[1].ocena < 18) {
    return { status: "ambiguous", kandidati: ocenjeni.slice(0, 3).map(function (x) { return x.kandidat; }) };
  }
  return { status: "found", kandidat: ocenjeni[0].kandidat, kandidati: [] };
}

function razcleniHwkPodrobnosti(html, url) {
  var vsebina = String(html || "");
  var h1 = vsebina.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  var blok = vsebina.match(/>Betrieb<\/h[1-6]>\s*<p\b[^>]*>([\s\S]*?)<\/p>/i);
  var vrstice = blok
    ? blok[1].split(/<br\s*\/?>/i).map(besediloIzHtml).map(function (x) { return x.trim(); }).filter(Boolean)
    : [];
  var lokacija = vrstice.find(function (x) { return /\b\d{5}\b/.test(x); }) || "";
  var posta = (lokacija.match(/\b\d{5}\b/) || [""])[0];
  var kraj = posta ? lokacija.slice(lokacija.indexOf(posta) + 5).trim() : "";
  var pokliciBlok = vsebina.match(/>Eingetragene Berufe<\/h[1-6]>\s*<p\b[^>]*>([\s\S]*?)<\/p>/i);
  var poklici = pokliciBlok
    ? besediloIzHtml(pokliciBlok[1]).split(/,|\n/).map(function (x) { return x.trim(); }).filter(Boolean)
    : [];
  var kontaktBlok = vsebina.match(/>Kontakt<\/h[1-6]>\s*<p\b[^>]*>([\s\S]*?)<\/p>/i);
  var kontaktHtml = kontaktBlok ? kontaktBlok[1] : "";
  var telefon = (besediloIzHtml(kontaktHtml).match(/Telefon\s+([+()\d][\d\s()\/-]{5,})/i) || [null, ""])[1].trim();
  var email = (kontaktHtml.match(/(?:href=["'](?:mailto:)?)([^"']+--at--[^"']+|[^"']+@[^"']+)/i) || [null, ""])[1];
  return {
    ime: (h1 ? besediloIzHtml(h1[1]) : vrstice[0] || "").replace(/^Firma\s+/i, "").trim(),
    naslov: vrstice[1] || "",
    postnaStevilka: posta,
    kraj: kraj,
    okrozje: vrstice[3] || "",
    poklici: poklici,
    telefon: telefon,
    email: decodeHtml(email).replace(/--at--/gi, "@").trim(),
    sourceUrl: url,
  };
}

async function poisciPriHwk(vnos, zbornica, iskalnik) {
  if (!iskalnik || iskalnik.type !== "odav") {
    return {
      status: "manual_available",
      searchUrl: iskalnik && iskalnik.searchUrl || zbornica && zbornica.homepage || KAMMERFINDER,
      searchedName: vnos.ime,
      chamberName: zbornica && zbornica.name || "",
      chamberUrl: zbornica && (zbornica.homepage || zbornica.infoUrl) || "",
    };
  }
  var iskalniUrlObjekt = new URL(iskalnik.searchUrl);
  iskalniUrlObjekt.hash = "";
  iskalniUrlObjekt.searchParams.set("limit", "20");
  iskalniUrlObjekt.searchParams.set("search-searchterm", vnos.ime);
  iskalniUrlObjekt.searchParams.set("search-local", "0");
  iskalniUrlObjekt.searchParams.set("search-filter-zipcode", vnos.postnaStevilka);
  iskalniUrlObjekt.searchParams.set("search-filter-radius", "20");
  iskalniUrlObjekt.searchParams.set("offset", "0");
  var iskalniUrl = iskalniUrlObjekt.toString();
  var odgovor = await fetchZRokom(iskalniUrl, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  if (!odgovor.ok) throw new Error("HWK_SEARCH_FAILED");
  var html = await odgovor.text();
  var izbor = izberiHwkZadetek(razcleniHwkRezultate(html, iskalniUrl), vnos);
  if (izbor.status !== "found") return Object.assign({
    searchUrl: iskalniUrl,
    searchedName: vnos.ime,
    chamberName: zbornica && zbornica.name || iskalnik.chamberName || "",
    chamberUrl: zbornica && (zbornica.homepage || zbornica.infoUrl) || iskalnik.chamberUrl || "",
  }, izbor);

  var detail = await fetchZRokom(izbor.kandidat.url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  if (!detail.ok) throw new Error("HWK_DETAIL_FAILED");
  return {
    status: "found",
    searchUrl: iskalniUrl,
    searchedName: vnos.ime,
    chamberName: zbornica && zbornica.name || iskalnik.chamberName || "",
    chamberUrl: zbornica && (zbornica.homepage || zbornica.infoUrl) || iskalnik.chamberUrl || "",
    kandidat: izbor.kandidat,
    subjekt: razcleniHwkPodrobnosti(await detail.text(), izbor.kandidat.url),
  };
}

function sestaviHwkIskanja(vnos, javniProfil) {
  var iskanja = [Object.assign({}, vnos)];
  var nosilec = javniProfil && javniProfil.status === "found" && javniProfil.subjekt
    ? String(javniProfil.subjekt.ime || "").trim()
    : "";
  if (nosilec && normaliziraj(nosilec) !== normaliziraj(vnos.ime)) {
    iskanja.push(Object.assign({}, vnos, {
      ime: nosilec,
      postnaStevilka: javniProfil.subjekt.postnaStevilka || vnos.postnaStevilka,
      kraj: javniProfil.subjekt.kraj || vnos.kraj,
    }));
  }
  return iskanja;
}

function sestaviIdentiteto(openregister, hwk, javniProfil, vnos) {
  if (openregister && openregister.status === "found" && openregister.company) {
    var podjetje = openregister.company;
    var naslov = podjetje.address || {};
    return {
      status: "verified_register",
      confidence: "high",
      entityType: "company",
      ime: podjetje.name,
      naziv: podjetje.name,
      naslov: naslov.street || "",
      postnaStevilka: naslov.postal_code || vnos.postnaStevilka,
      kraj: naslov.city || vnos.kraj,
      companyId: podjetje.company_id || "",
      legalForm: podjetje.legal_form || "",
      registerNumber: [podjetje.register_type, podjetje.register_number].filter(Boolean).join(" "),
      registerCourt: podjetje.register_court || "",
      active: podjetje.active !== false,
      source: "openregister",
    };
  }
  if (hwk && hwk.status === "found" && hwk.subjekt) {
    return Object.assign({}, hwk.subjekt, {
      status: "verified_directory",
      confidence: "medium",
      entityType: razdeliImeZaInsolvenco(hwk.subjekt.ime).vrsta,
      naziv: vnos.ime,
      source: "hwk",
    });
  }
  if (javniProfil && javniProfil.status === "found" && javniProfil.subjekt) {
    return Object.assign({}, javniProfil.subjekt, {
      status: "probable_impressum",
      confidence: "medium",
      entityType: "person",
      source: "impressum",
    });
  }
  return {
    status: "unresolved",
    confidence: "low",
    entityType: "unknown",
    ime: "",
    naziv: vnos.ime,
    postnaStevilka: vnos.postnaStevilka,
    kraj: vnos.kraj,
    source: "none",
  };
}

function normalizirajNaslov(vrednost) {
  return String(vrednost || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/str\.(?=\s|\d|$)/g, "strasse")
    .replace(/\bstr(?:a(?:ss|ß)e)?\.?\b/g, "strasse")
    .replace(/\bstra(?:ss|ß)e\b/g, "strasse")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function preveriUjemanjeLokacije(vnos, identiteta) {
  var vneseno = {
    naslov: String(vnos && vnos.naslov || "").trim(),
    postnaStevilka: String(vnos && vnos.postnaStevilka || "").trim(),
    kraj: String(vnos && vnos.kraj || "").trim(),
  };
  var uradno = {
    naslov: String(identiteta && identiteta.naslov || "").trim(),
    postnaStevilka: String(identiteta && identiteta.postnaStevilka || "").trim(),
    kraj: String(identiteta && identiteta.kraj || "").trim(),
  };
  var polja = {
    postnaStevilka: Boolean(vneseno.postnaStevilka && uradno.postnaStevilka) && vneseno.postnaStevilka === uradno.postnaStevilka,
    kraj: Boolean(vneseno.kraj && uradno.kraj) && normaliziraj(vneseno.kraj) === normaliziraj(uradno.kraj),
    naslov: Boolean(vneseno.naslov && uradno.naslov) && normalizirajNaslov(vneseno.naslov) === normalizirajNaslov(uradno.naslov),
  };
  var manjkajoca = Object.keys(polja).filter(function (polje) {
    return !vneseno[polje] || !uradno[polje];
  });
  var neujemanja = Object.keys(polja).filter(function (polje) {
    return vneseno[polje] && uradno[polje] && !polja[polje];
  });
  return {
    status: manjkajoca.length ? "unverifiable" : (neujemanja.length ? "mismatch" : "matched"),
    entered: vneseno,
    official: uradno,
    fields: polja,
    missingFields: manjkajoca,
    mismatchedFields: neujemanja,
  };
}

function sestaviVire(openregister, hwk, javniProfil, vnos) {
  var viri = [
    {
      id: "openregister",
      label: "Register podjetij",
      status: openregister.status,
      sourceUrl: openregister.sourceUrl || OPENREGISTER_WEB,
      message: openregister.status === "found"
        ? "Registrirana družba je najdena."
        : openregister.status === "not_configured"
          ? "API še ni povezan; preverjanje se nadaljuje z rezervnimi viri."
          : openregister.status === "ambiguous"
            ? "Najdenih je več možnih družb."
            : openregister.status === "unavailable"
              ? "Vir trenutno ni dosegljiv."
              : "Registrirana družba s tem imenom ni najdena.",
    },
    {
      id: "hwk",
      label: hwk.chamberName || "Handwerkskammer",
      status: hwk.status,
      sourceUrl: hwk.status === "found" && hwk.subjekt ? hwk.subjekt.sourceUrl : (hwk.searchUrl || hwk.chamberUrl || KAMMERFINDER),
      message: hwk.status === "found"
        ? "Javni obrtni vpis je najden."
        : hwk.status === "manual_available"
          ? "Pristojna zbornica je določena; njen javni iskalnik uporablja drugačen sistem."
          : hwk.status === "unavailable"
            ? "Javni imenik trenutno ni dosegljiv."
            : "V javnem HWK-imeniku ni zadetka.",
    },
    {
      id: "impressum",
      label: "Impressum podjetja",
      status: javniProfil.status,
      sourceUrl: javniProfil.sourceUrl || (vnos.spletnaStran || ""),
      message: javniProfil.status === "found"
        ? "Pravni nosilec je prepoznan na spletni strani."
        : javniProfil.status === "not_provided"
          ? "Spletna stran ni bila vnesena."
          : javniProfil.status === "unavailable"
            ? "Spletne strani ni bilo mogoče varno prebrati."
            : javniProfil.reason === "holder_not_reliably_identified"
              ? "Impressum je najden, vendar nosilca ni bilo mogoče zanesljivo prepoznati."
              : "Impressum ni bil najden.",
    },
  ];
  if (/\boffenbach(?:\s+am\s+main)?\b/i.test(vnos.kraj) || /^63[0-3]\d{2}$/.test(vnos.postnaStevilka)) {
    viri.push({
      id: "gewerbe",
      label: "Gewerberegister Offenbach",
      status: "manual_available",
      sourceUrl: OFFENBACH_GEWERBE,
      message: "Uradna občinska pot za dokončno potrditev dejavnosti; zahtevek ni avtomatski.",
    });
  }
  return viri;
}

function razdeliImeZaInsolvenco(ime) {
  var cisto = String(ime || "").replace(/^(Herr|Frau|Firma)\s+/i, "").trim();
  var jeDruzba = /\b(gmbh|ug|ag|kg|ohg|gbr|e\.?\s*k\.?)\b/i.test(cisto);
  if (jeDruzba) return { firmaPriimek: cisto, ime: "", vrsta: "company" };
  var deli = cisto.split(/\s+/).filter(Boolean);
  if (deli.length < 2) return { firmaPriimek: cisto, ime: "", vrsta: "unknown" };
  return { firmaPriimek: deli.pop(), ime: deli.join(" "), vrsta: "person" };
}

function pridobiViewState(html) {
  var naprej = String(html || "").match(/name=["']jakarta\.faces\.ViewState["'][^>]*value=["']([^"']+)/i);
  var nazaj = String(html || "").match(/value=["']([^"']+)["'][^>]*name=["']jakarta\.faces\.ViewState["']/i);
  return decodeHtml((naprej || nazaj || [null, ""])[1]);
}

function cookiesIzOdgovora(odgovor) {
  var vrednosti = typeof odgovor.headers.getSetCookie === "function"
    ? odgovor.headers.getSetCookie()
    : [odgovor.headers.get("set-cookie") || ""];
  return vrednosti.filter(Boolean).map(function (vrednost) { return vrednost.split(";", 1)[0]; }).join("; ");
}

async function zazeniBrskalnikZaDokazilo() {
  var puppeteer = require("puppeteer-core");
  if (process.platform === "win32") {
    var lokalnePoti = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    var lokalniBrskalnik = lokalnePoti.find(function (pot) { return fs.existsSync(pot); });
    if (!lokalniBrskalnik) throw new Error("LOCAL_BROWSER_NOT_FOUND");
    return puppeteer.launch({
      executablePath: lokalniBrskalnik,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  var chromiumModul = require("@sparticuz/chromium");
  var chromium = chromiumModul.default || chromiumModul;
  chromium.setGraphicsMode = false;
  return puppeteer.launch({
    args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    defaultViewport: { width: 1280, height: 1000, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(),
    headless: "shell",
  });
}

function dolociVirDokazilaIdentitete(identiteta, openregister, hwk) {
  if (identiteta && identiteta.status === "verified_register") {
    return {
      sourceUrl: openregister && openregister.sourceUrl || "",
      sourceLabel: "OpenRegister",
    };
  }
  if (identiteta && identiteta.status === "verified_directory") {
    return {
      sourceUrl: hwk && hwk.subjekt && hwk.subjekt.sourceUrl || "",
      sourceLabel: hwk && hwk.chamberName || "Handwerkskammer",
    };
  }
  return null;
}

async function zajemiDokaziloIdentitete(identiteta, openregister, hwk) {
  var vir = dolociVirDokazilaIdentitete(identiteta, openregister, hwk);
  if (!vir || !vir.sourceUrl) return null;
  var varenUrl = await preveriJavniSpletniNaslov(vir.sourceUrl);
  var browser = await zazeniBrskalnikZaDokazilo();
  try {
    var stran = await browser.newPage();
    await stran.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
    await stran.setUserAgent(USER_AGENT);
    await stran.goto(varenUrl.toString(), { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise(function (resolve) { setTimeout(resolve, 1200); });
    var posnetek = await stran.screenshot({
      type: "jpeg",
      quality: 72,
      fullPage: true,
      encoding: "base64",
    });
    return {
      imageDataUrl: "data:image/jpeg;base64," + posnetek,
      capturedAt: new Date().toISOString(),
      sourceUrl: stran.url() || varenUrl.toString(),
      sourceLabel: vir.sourceLabel,
    };
  } finally {
    await browser.close();
  }
}

async function zajemiUradnoInsolvencnoDokazilo(subjekt) {
  var razdeljenoIme = razdeliImeZaInsolvenco(subjekt.ime);
  var browser = await zazeniBrskalnikZaDokazilo();
  try {
    var stran = await browser.newPage();
    await stran.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
    await stran.goto(INSOLVENCY_SEARCH, { waitUntil: "domcontentloaded", timeout: 25000 });

    async function izpolni(polje, vrednost) {
      var selector = '[name="' + polje + '"]';
      await stran.waitForSelector(selector, { timeout: 12000 });
      await stran.$eval(selector, function (element, novaVrednost) {
        element.value = novaVrednost;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }, vrednost || "");
    }

    await izpolni("frm_suche:litx_firmaNachName:text", razdeljenoIme.firmaPriimek);
    await izpolni("frm_suche:litx_vorname:text", razdeljenoIme.ime);
    await izpolni("frm_suche:litx_sitzWohnsitz:text", subjekt.kraj);
    await izpolni("frm_suche:ldi_datumVon:datumHtml5", "2005-01-01");
    await izpolni("frm_suche:ldi_datumBis:datumHtml5", new Date().toISOString().slice(0, 10));

    await Promise.all([
      stran.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 }).catch(function () {}),
      stran.click('[name="frm_suche:cbt_suchen"]'),
    ]);
    await stran.waitForFunction(function () {
      return /Suchergebnis|Keine Treffer/i.test(document.body.innerText || "");
    }, { timeout: 20000 });

    var rezultatBesedilo = await stran.evaluate(function () { return document.body.innerText || ""; });
    var posnetek = await stran.screenshot({
      type: "jpeg",
      quality: 72,
      fullPage: true,
      encoding: "base64",
    });
    return {
      imageDataUrl: "data:image/jpeg;base64," + posnetek,
      capturedAt: new Date().toISOString(),
      noResults: /Keine Treffer/i.test(rezultatBesedilo),
    };
  } finally {
    await browser.close();
  }
}

function sestaviInsolvencnoTelo(subjekt, viewState, datumDo) {
  var ime = razdeliImeZaInsolvenco(subjekt.ime);
  return {
    ime: ime,
    telo: new URLSearchParams({
      frm_suche: "frm_suche",
      "frm_suche:lsom_bundesland:codelist:scl_bundesland:mysom": "NO_CODE",
      "frm_suche:ldi_datumVon:datumHtml5": "2005-01-01",
      "frm_suche:ldi_datumBis:datumHtml5": datumDo || new Date().toISOString().slice(0, 10),
      "frm_suche:lsom_wildcard:lsom": "0",
      "frm_suche:litx_firmaNachName:text": ime.firmaPriimek,
      "frm_suche:litx_vorname:text": ime.ime,
      "frm_suche:litx_sitzWohnsitz:text": subjekt.kraj,
      "frm_suche:iaz_aktenzeichen:itx_abteilung": "",
      "frm_suche:iaz_aktenzeichen:som_registerzeichen:mysom": "NO_CODE",
      "frm_suche:iaz_aktenzeichen:itx_lfdNr": "",
      "frm_suche:iaz_aktenzeichen:itx_jahr": "",
      "frm_suche:iaz_aktenzeichen:ih_aktenzeichen": "true",
      "frm_suche:lsom_gegenstand:codelist:mysom": "NO_CODE",
      "frm_suche:ir_registereintrag:som_registergericht:mysom": "NO_CODE",
      "frm_suche:ir_registereintrag:som_registerart:mysom": "NO_CODE",
      "frm_suche:ir_registereintrag:itx_registernummer": "",
      "frm_suche:ir_registereintrag:ih_registereintrag": "true",
      "frm_suche:cbt_suchen": "Suchen",
      "jakarta.faces.ViewState": viewState,
    }),
  };
}

async function preveriInsolvenco(subjekt) {
  var prvi = await fetchZRokom(INSOLVENCY_SEARCH, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  if (!prvi.ok) throw new Error("INSOLVENCY_OPEN_FAILED");
  var prviHtml = await prvi.text();
  var viewState = pridobiViewState(prviHtml);
  if (!viewState) throw new Error("INSOLVENCY_FORM_CHANGED");

  var priprava = sestaviInsolvencnoTelo(subjekt, viewState);
  var ime = priprava.ime;
  var telo = priprava.telo;
  var drugi = await fetchZRokom(INSOLVENCY_SEARCH, {
    method: "POST",
    redirect: "follow",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://neu.insolvenzbekanntmachungen.de",
      Referer: INSOLVENCY_SEARCH,
      Cookie: cookiesIzOdgovora(prvi),
    },
    body: telo,
  });
  if (!drugi.ok) throw new Error("INSOLVENCY_SEARCH_FAILED");
  var rezultat = await drugi.text();
  if (!/Suchergebnis/i.test(rezultat)) throw new Error("INSOLVENCY_RESULT_CHANGED");
  var brezZadetka = /Keine Treffer/i.test(rezultat);
  var dokazilo = null;
  try {
    dokazilo = await zajemiUradnoInsolvencnoDokazilo(subjekt);
  } catch (napakaDokazila) {
    console.error("[mehka-boniteta:insolvency-evidence]", napakaDokazila.message);
  }
  return {
    status: brezZadetka ? "clear" : "possible_match",
    searchedName: [ime.ime, ime.firmaPriimek].filter(Boolean).join(" "),
    searchedFirstName: ime.ime,
    searchedLastName: ime.firmaPriimek,
    searchedCity: subjekt.kraj,
    sourceUrl: INSOLVENCY_SEARCH,
    period: "01.01.2005–danes",
    evidenceImage: dokazilo ? dokazilo.imageDataUrl : "",
    evidenceCapturedAt: dokazilo ? dokazilo.capturedAt : "",
    evidenceStatus: dokazilo ? "captured" : "unavailable",
  };
}

function sestaviSklep(identiteta, insolvenca) {
  if (!identiteta || identiteta.status === "unresolved") {
    return { level: "yellow", title: "Identitete ni bilo mogoče potrditi", message: "Preverjeni viri niso vrnili dovolj zanesljivega pravnega imena za insolvenčno preverbo." };
  }
  if (identiteta.status === "probable_impressum") {
    return { level: "yellow", title: "Nosilec je najden, identiteta ni potrjena", message: "Impressum je pomagal določiti nosilca, vendar brez potrditve v registru ali HWK insolvenčna preverba ni bila izvedena." };
  }
  if (insolvenca && insolvenca.reason === "location_mismatch") {
    return { level: "red", title: "Naslov se ne ujema z uradnim virom", message: "Najdeno podjetje ali obrtnik ima drugačen naslov, kraj ali poštno številko. Insolvenčna preverba ni bila izvedena." };
  }
  if (insolvenca && insolvenca.reason === "location_unverifiable") {
    return { level: "yellow", title: "Lokacije ni bilo mogoče potrditi", message: "Uradni vir nima vseh podatkov za zanesljivo primerjavo naslova. Insolvenčna preverba ni bila izvedena." };
  }
  if (insolvenca && insolvenca.status === "not_checked") {
    return { level: "yellow", title: "Identiteta je najdena, dokazilo manjka", message: "Brez dokaznega posnetka registrskega vira insolvenčna preverba ni bila izvedena." };
  }
  if (!insolvenca || insolvenca.status === "unavailable") {
    return { level: "yellow", title: "Identiteta je najdena, insolvenčna preverba ni uspela", message: "Poizvedbo ponovite pozneje." };
  }
  if (insolvenca.status === "possible_match") {
    return { level: "red", title: "Najdena je možna insolvenčna objava", message: "Pred sodelovanjem je potreben ročni pregled uradne objave in potrditev identitete." };
  }
  return { level: "green", title: "Osnovna mehka preverba je uspešna", message: "Identiteta je najdena v registrskem viru, v javnih insolvenčnih objavah pa ni zadetka." };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return odgovorJson(res, 405, { ok: false, napaka: "Samo POST." });

  var cfg;
  try {
    cfg = db.konfiguracija();
  } catch (_) {
    var lokalniUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
    var lokalniAnonKljuc = String(process.env.SUPABASE_ANON_KEY || "");
    if (!lokalniUrl || !lokalniAnonKljuc) {
      return odgovorJson(res, 500, { ok: false, napaka: "Strežniška konfiguracija manjka." });
    }
    cfg = { url: lokalniUrl, serviceKey: lokalniAnonKljuc };
  }
  var auth = await db.preveriUporabnika(req, cfg);
  if (!auth.ok) return odgovorJson(res, auth.status, { ok: false, napaka: auth.napaka });

  var telo = req.body && typeof req.body === "object" ? req.body : {};
  var vnos = {
    ime: varnoBesedilo(telo.ime, 140),
    naslov: varnoBesedilo(telo.naslov, 140),
    postnaStevilka: varnoBesedilo(telo.postnaStevilka, 5),
    kraj: varnoBesedilo(telo.kraj, 80),
    spletnaStran: varnoBesedilo(telo.spletnaStran, 240),
  };
  if (vnos.ime.length < 3 || vnos.naslov.length < 3 || !/^\d{5}$/.test(vnos.postnaStevilka) || vnos.kraj.length < 2) {
    return odgovorJson(res, 400, { ok: false, code: "INVALID_INPUT", napaka: "Vnesite ime, naslov, kraj in veljavno petmestno poštno številko." });
  }
  try {
    var openregister = await poisciOpenRegister(vnos);
    var javniProfil = await poisciVImpressumu(vnos);
    var hwk;
    var pristojnaHwk;
    var hwkIskalnik;
    try {
      pristojnaHwk = await dolociPristojnoHwk(vnos);
      hwkIskalnik = await dolociHwkIskalnik(pristojnaHwk);
    } catch (_) {
      pristojnaHwk = { status: "unavailable", sourceUrl: KAMMERFINDER };
      hwkIskalnik = { type: "none", searchUrl: KAMMERFINDER };
    }
    if (pristojnaHwk.status === "found") {
      var hwkIskanja = sestaviHwkIskanja(vnos, javniProfil);
      for (var h = 0; h < hwkIskanja.length; h += 1) {
        try { hwk = await poisciPriHwk(hwkIskanja[h], pristojnaHwk, hwkIskalnik); }
        catch (_) {
          hwk = {
            status: "unavailable",
            searchUrl: hwkIskalnik.searchUrl || pristojnaHwk.homepage || KAMMERFINDER,
            searchedName: hwkIskanja[h].ime,
            chamberName: pristojnaHwk.name,
            chamberUrl: pristojnaHwk.homepage || pristojnaHwk.infoUrl,
          };
        }
        if (hwk.status === "found") break;
      }
    } else {
      hwk = { status: "unavailable", searchUrl: KAMMERFINDER };
    }
    var identiteta = sestaviIdentiteto(openregister, hwk, javniProfil, vnos);
    var viri = sestaviVire(openregister, hwk, javniProfil, vnos);
    if (identiteta.status === "unresolved" || identiteta.status === "probable_impressum") {
      return odgovorJson(res, 200, {
        ok: true,
        checkedAt: new Date().toISOString(),
        scope: "Nemčija – mehka preverba",
        identity: identiteta,
        sources: viri,
        openregister: openregister,
        hwk: hwk,
        publicProfile: javniProfil,
        competentChamber: pristojnaHwk,
        identityEvidence: { status: "not_captured", reason: "identity_not_verified" },
        insolvency: { status: "not_checked", reason: "identity_not_verified" },
        result: sestaviSklep(identiteta, null),
      });
    }

    var ujemanjeLokacije = preveriUjemanjeLokacije(vnos, identiteta);
    var dokaziloIdentitete = null;
    try {
      dokaziloIdentitete = await zajemiDokaziloIdentitete(identiteta, openregister, hwk);
    } catch (napakaDokazilaIdentitete) {
      console.error("[mehka-boniteta:identity-evidence]", napakaDokazilaIdentitete.message);
    }
    if (!dokaziloIdentitete) {
      var razlogBrezPreverbe = ujemanjeLokacije.status === "mismatch"
        ? "location_mismatch"
        : (ujemanjeLokacije.status === "unverifiable" ? "location_unverifiable" : "identity_evidence_unavailable");
      var nepreverjenaInsolvenca = { status: "not_checked", reason: razlogBrezPreverbe };
      return odgovorJson(res, 200, {
        ok: true,
        checkedAt: new Date().toISOString(),
        scope: "Nemčija – mehka preverba",
        identity: identiteta,
        identityEvidence: { status: "unavailable", reason: "capture_failed" },
        locationMatch: ujemanjeLokacije,
        sources: viri,
        openregister: openregister,
        hwk: hwk,
        publicProfile: javniProfil,
        competentChamber: pristojnaHwk,
        insolvency: nepreverjenaInsolvenca,
        result: sestaviSklep(identiteta, nepreverjenaInsolvenca),
      });
    }

    var dokaziloIdentiteteOdgovor = {
      status: "captured",
      imageDataUrl: dokaziloIdentitete.imageDataUrl,
      capturedAt: dokaziloIdentitete.capturedAt,
      sourceUrl: dokaziloIdentitete.sourceUrl,
      sourceLabel: dokaziloIdentitete.sourceLabel,
    };
    if (ujemanjeLokacije.status !== "matched") {
      var lokacijskaInsolvenca = {
        status: "not_checked",
        reason: ujemanjeLokacije.status === "mismatch" ? "location_mismatch" : "location_unverifiable",
      };
      return odgovorJson(res, 200, {
        ok: true,
        checkedAt: new Date().toISOString(),
        scope: "Nemčija – mehka preverba",
        identity: identiteta,
        identityEvidence: dokaziloIdentiteteOdgovor,
        locationMatch: ujemanjeLokacije,
        sources: viri,
        openregister: openregister,
        hwk: hwk,
        publicProfile: javniProfil,
        competentChamber: pristojnaHwk,
        insolvency: lokacijskaInsolvenca,
        result: sestaviSklep(identiteta, lokacijskaInsolvenca),
      });
    }

    var insolvenca;
    try {
      insolvenca = await preveriInsolvenco(identiteta);
    } catch (insolventnaNapaka) {
      console.error("[mehka-boniteta:insolvency]", insolventnaNapaka.message);
      insolvenca = { status: "unavailable", sourceUrl: INSOLVENCY_SEARCH };
    }
    return odgovorJson(res, 200, {
      ok: true,
      checkedAt: new Date().toISOString(),
      scope: "Nemčija – mehka preverba",
      identity: identiteta,
      identityEvidence: dokaziloIdentiteteOdgovor,
      locationMatch: ujemanjeLokacije,
      sources: viri,
      openregister: openregister,
      hwk: hwk,
      publicProfile: javniProfil,
      competentChamber: pristojnaHwk,
      insolvency: insolvenca,
      result: sestaviSklep(identiteta, insolvenca),
    });
  } catch (napaka) {
    console.error("[mehka-boniteta]", napaka.message);
    return odgovorJson(res, 502, { ok: false, code: "SOURCE_UNAVAILABLE", napaka: "Uradnega vira trenutno ni bilo mogoče preveriti. Poskusite ponovno čez nekaj minut." });
  }
}

handler._test = {
  normaliziraj: normaliziraj,
  razcleniHwkRezultate: razcleniHwkRezultate,
  razcleniKammerfinderRezultat: razcleniKammerfinderRezultat,
  razcleniKammerfinderInfo: razcleniKammerfinderInfo,
  razcleniCentralnoHwk: razcleniCentralnoHwk,
  dolociPristojnoHwkCentralno: dolociPristojnoHwkCentralno,
  dolociPristojnoHwkKammerfinder: dolociPristojnoHwkKammerfinder,
  najdiHwkIskalnePovezave: najdiHwkIskalnePovezave,
  najdiBdbSearchUrl: najdiBdbSearchUrl,
  dolociPristojnoHwk: dolociPristojnoHwk,
  dolociHwkIskalnik: dolociHwkIskalnik,
  poisciPriHwk: poisciPriHwk,
  izberiHwkZadetek: izberiHwkZadetek,
  razcleniHwkPodrobnosti: razcleniHwkPodrobnosti,
  razdeliImeZaInsolvenco: razdeliImeZaInsolvenco,
  sestaviInsolvencnoTelo: sestaviInsolvencnoTelo,
  zajemiUradnoInsolvencnoDokazilo: zajemiUradnoInsolvencnoDokazilo,
  dolociVirDokazilaIdentitete: dolociVirDokazilaIdentitete,
  zajemiDokaziloIdentitete: zajemiDokaziloIdentitete,
  pridobiViewState: pridobiViewState,
  sestaviSklep: sestaviSklep,
  jeFrankfurt: jeFrankfurt,
  razcleniImpressum: razcleniImpressum,
  najdiImpressumPovezave: najdiImpressumPovezave,
  jeImpressumDokument: jeImpressumDokument,
  jeVerjetnoImeOsebe: jeVerjetnoImeOsebe,
  sestaviHwkIskanja: sestaviHwkIskanja,
  jeZasebenIp: jeZasebenIp,
  poisciVImpressumu: poisciVImpressumu,
  izberiOpenRegisterZadetek: izberiOpenRegisterZadetek,
  razcleniOpenRegisterVnos: razcleniOpenRegisterVnos,
  sestaviIdentiteto: sestaviIdentiteto,
  normalizirajNaslov: normalizirajNaslov,
  preveriUjemanjeLokacije: preveriUjemanjeLokacije,
  sestaviVire: sestaviVire,
  preveriInsolvenco: preveriInsolvenco,
};

module.exports = handler;
