var sentry = require("../_lib/sentry");
"use strict";

var db = require("../_lib/supabase-server");
var identityEvidenceContract = require("../_lib/identity-evidence");
var dns = require("node:dns").promises;
var net = require("node:net");
var fs = require("node:fs");
var os = require("node:os");
var path = require("node:path");

var HWK_RHEIN_MAIN = "https://hwk-rhein-main.odav.de";
var KAMMERFINDER = "https://www.kammerfinder.de/";
var HWK_PO_PLZ = "https://www.handwerkskammer.de/kontakte/zustaendige-handwerkskammer-5620,0,dazustaendig.html";
var HANDWERKER_RADAR_SEARCH = "https://www.handwerker-radar.de/5100,0,hwrsearch.html";
var INSOLVENCY_PORTAL = "https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf";
var OPENREGISTER_INSOLVENCY_SEARCH = "https://api.openregister.de/v1/search/insolvency";
var OPENREGISTER_INSOLVENCY_DETAIL = "https://api.openregister.de/v1/insolvency/";
var OPENREGISTER_SEARCH = "https://api.openregister.de/v0/search/company";
var OPENREGISTER_WEB = "https://openregister.de";
var OFFENBACH_GEWERBE = "https://www.offenbach.de/vv/oe/verwaltung/Ordnungsamt_Gewerbe.php?loc=de";
var USER_AGENT = "Uspesni-Jezek-soft-business-check/1.0";
var BROWSER_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var IDENTITY_EVIDENCE_VERSION = identityEvidenceContract.CAPTURE_VERSION;
var OFFICIAL_INSOLVENCY_EVIDENCE_VERSION = "official-insolvency-v7-visible-person-full-name-highlight";
var MAX_IMPRESSUM_BYTES = 5 * 1024 * 1024;
var IMPRESSUM_HEADING_PATTERN = /\b(?:impressum|imprint|anbieterkennzeichnung|anbieterkennung)\b/i;
var LEGAL_PROVIDER_IDENTITY_PATTERN = /(?:Informationen\s+(?:ü|u)ber\s+uns\s+als\s+Verantwortliche|Anbieter\s+dieser\s+(?:Website|Webseite)|Verantwortliche(?:r)?\s+Anbieter(?:\s+dieses\s+Internetauftritts)?(?:\s+im\s+datenschutzrechtlichen\s+Sinne)?\s+ist|Verantwortliche\s+Stelle(?:\s+im\s+Sinne\s+der\s+Datenschutzgesetze)?\s*(?:ist|:)|Diensteanbieter\s+(?:im\s+Sinne|gem(?:äß|ass)))/i;
var LEGAL_POLICY_LINK_PATTERN = /^(?:datenschutzerkl(?:ä|a)rung|datenschutz|privacy(?:\s+policy)?|rechtliches|legal\s+notice)$/i;
var LEGAL_ROLE_LABEL_SOURCE = [
  "Vertreten\\s+durch",
  "Verantwortlich\\s+im\\s+Sinne\\s+des\\s+(?:TDG|TMG|DDG|Teledienstgesetz|Digitale-Dienste-Gesetz)(?:[^\\n:]{0,180}?\\s+ist)?",
  "Gesetzliche\\s+Anbieterkennung",
  "Anbieterkennzeichnung",
  "Vertretungsberechtigte(?:r|n)?(?:\\s+(?:Gesellschafter(?:in)?|Gesch(?:ä|a)ftsf(?:ü|u)hrer(?:in)?|Person|Vorstand|Partner(?:in)?))?",
  "Gesetzliche(?:r|n)?\\s+Vertreter(?:in)?",
  "Gesch(?:ä|a)ftsf(?:ü|u)hrende(?:r)?\\s+Gesellschafter(?:in)?",
  "Pers(?:ö|o)nlich\\s+haftende(?:r)?\\s+Gesellschafter(?:in)?",
  "Gesch(?:ä|a)ftsf(?:ü|u)hrer(?:in)?",
  "Gesch(?:ä|a)ftsf(?:ü|u)hrung",
  "\\bGF\\b",
  "Betriebsinhaber(?:in)?",
  "Firmeninhaber(?:in)?",
  "Gesch(?:ä|a)ftsinhaber(?:in)?",
  "\\bInh(?:\\.|\\b)(?=\\s|:|$)",
  "\\bInhaber(?:in|\\s*\\/\\s*-?\\s*in)?\\b",
  "Gesellschafter(?:in)?",
  "Vorstandsvorsitzende(?:r)?",
  "Vorstand",
  "Komplement(?:ä|a)r(?:in)?",
  "\\bPartner(?:in)?(?=\\s*:)",
].join("|");
var LEGAL_IMPRESSUM_DATA_PATTERN = new RegExp("(?:Angaben\\s+gem(?:äß|ass)|" + LEGAL_ROLE_LABEL_SOURCE + "|Umsatzsteuer(?:-Identifikationsnummer|nummer|-ID)|USt\\.?-?Id|Registergericht|Amtsgericht|Handelsregister|\\b(?:n\\.?\\s*)?e\\.?\\s*V\\.?\\b|\\b(?:HR[AB]|GnR|PR|VR)\\s*(?:[-–—:]\\s*)?(?:Nr\\.?\\s*:?\\s*)?\\d+)", "i");
var GERMAN_POSTAL_CITY_PATTERN = /\b\d{5}\s+[\p{L}]/u;
// Besede in sestavljenke, ki opisujejo dejavnost, obrat ali storitev, niso
// osebna imena. Pravilo je oblikovno in domensko neodvisno: zajame tudi nove
// kombinacije, kot so Innenausbau, Parkettverlegung ali Montageservice.
var POSLOVNI_OPIS_TOKEN_PATTERN = /(?:arbeiten|leistungen|unternehmen|handwerk|handwerksbetrieb|meisterbetrieb|meisterwerkstatt|installateur|heizungsbauer|bodenleger|fliesenleger|dachdecker|dachdeckerei|elektriker|elektro|photovoltaik|solar|schrott|buntmetallhandel|kaminholz|malerbetrieb|lackiererbetrieb|lackiererei|karosseriefachbetrieb|fahrzeugpflege|fahrzeugaufbereitung|fahrzeugtechnik|kfz|autopflege|autoservice|autowerkstatt|garage|fahrrad|fahrräder|fahrraeder|bike|bikes|innenausstattung|raumausstattung|objektbetreuung|facility|immobilien|architektur|architekturbüro|architekturbuero|planung|steuerberater|fachberater|rechtsanwalt|anwalt|sachverständiger|sachverstaendiger|gutachter|ingenieur|personalvermittler|brandschutz|catering|imbiss|logistik|transport|umzug|umzuge|umzüge|umzuege|entrumpel|entrümpel|entruempel|raumung|räumung|raeumung|entsorgung|mobeltaxi|möbeltaxi|moebeltaxi|(?:innen|außen|aussen|trocken|hoch|tief|holz|garten|landschafts)?bau|bautenschutz|(?:parkett|boden|fliesen)?verlegung|(?:gebäude|gebaeude|rohr|kanal|solar)?reinigung|(?:bau|hausmeister|montage|elektro|umzugs|transport)?service|(?:reinigungs|transport|umzugs)?dienste|(?:sanitär|sanitaer|heizungs|klima|elektro|haus|solar)?technik|sanierung|renovierung|montage)$/i;
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
var HWK_MANUAL_FALLBACK_OVERRIDES = {
  "handwerkskammer frankfurt rhein main": HANDWERKER_RADAR_SEARCH,
};

function odgovorJson(res, status, podatki) {
  res.status(status).json(podatki);
}

function normaliziraj(vrednost) {
  return String(vrednost || "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
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
    .replace(/&(?:rsquo|lsquo|apos);/gi, "’")
    .replace(/&quot;/gi, "\"")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
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

function jeSpletniNaslovNamestoImena(vrednost) {
  var vnos = String(vrednost || "").trim();
  return /^(?:https?:\/\/|www\.)/i.test(vnos) && !/openregister\.de\/company\//i.test(vnos);
}

function pripraviVnosZaPreverbo(telo) {
  var vnos = {
    ime: varnoBesedilo(telo && telo.ime, 240),
    naslov: varnoBesedilo(telo && telo.naslov, 140),
    postnaStevilka: varnoBesedilo(telo && telo.postnaStevilka, 5),
    kraj: varnoBesedilo(telo && telo.kraj, 80),
    spletnaStran: varnoBesedilo(telo && telo.spletnaStran, 240),
    registerNumber: varnoBesedilo(telo && telo.registerNumber, 120),
    vatId: varnoBesedilo(telo && telo.vatId, 80),
  };
  if (jeSpletniNaslovNamestoImena(vnos.ime)) {
    if (!vnos.spletnaStran) vnos.spletnaStran = vnos.ime;
    vnos.ime = "";
  } else if (!jeNazivPravneDruzbe(vnos.ime) && jeVerjetnoImeOsebe(vnos.ime)) {
    vnos.ime = pocistiImeOsebe(vnos.ime);
  }
  return vnos;
}

function uporabiOpenRegisterZaIdentiteto(telo) {
  return !(telo && telo.uporabiOpenRegisterIdentiteto === false);
}

function pripraviOpenRegisterVnosZaPotrditev(telo, vnos) {
  var referenca = telo && telo.confirmedIdentity && telo.confirmedIdentity.companyId;
  var companyId = razcleniOpenRegisterVnos(varnoBesedilo(referenca, 120)).companyId;
  if (companyId) return Object.assign({}, vnos, { ime: companyId });
  if (vnos && razcleniOpenRegisterVnos(vnos.registerNumber).registerNumber) {
    return Object.assign({}, vnos, { ime: vnos.registerNumber });
  }
  return vnos;
}

function pripraviRocnoHwkDokazilo(telo, vnos, javniProfil, zbornica) {
  var surovo = telo && telo.manualHwkEvidence;
  if (!surovo || typeof surovo !== "object") return { status: "not_provided" };
  var slika = String(surovo.imageDataUrl || "");
  var uradnoIme = varnoBesedilo(surovo.officialName, 180);
  var uradniNaslov = varnoBesedilo(surovo.officialStreet, 140);
  var uradnaPosta = varnoBesedilo(surovo.officialPostalCode, 5);
  var uradniKraj = varnoBesedilo(surovo.officialCity, 80);
  var kandidat = javniProfil && javniProfil.status === "found" && javniProfil.subjekt
    ? varnoBesedilo(javniProfil.subjekt.ime || javniProfil.subjekt.naziv, 180)
    : vnos.ime;
  var normalnoUradno = normaliziraj(uradnoIme);
  var normalnoKandidat = normaliziraj(kandidat);
  var imeSeUjema = Boolean(normalnoUradno && normalnoKandidat) && (
    normalnoUradno === normalnoKandidat ||
    normalnoUradno.indexOf(normalnoKandidat) >= 0 ||
    normalnoKandidat.indexOf(normalnoUradno) >= 0
  );
  if (surovo.confirmed !== true) return { status: "invalid", reason: "confirmation_missing" };
  if (!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i.test(slika) || slika.length > 2200000) {
    return { status: "invalid", reason: "invalid_evidence_image" };
  }
  if (!imeSeUjema) return { status: "invalid", reason: "name_mismatch" };
  if (uradniNaslov.length < 3 || !/^\d{5}$/.test(uradnaPosta) || uradniKraj.length < 2) {
    return { status: "invalid", reason: "official_location_missing" };
  }
  return {
    status: "valid",
    hwk: {
      status: "found",
      searchedName: kandidat,
      chamberName: zbornica && zbornica.name || "Handwerkskammer",
      chamberUrl: zbornica && (zbornica.homepage || zbornica.infoUrl) || "",
      searchUrl: HANDWERKER_RADAR_SEARCH,
      evidenceMode: "user_uploaded_official_screenshot",
      manualEvidence: {
        imageDataUrl: slika,
        capturedAt: new Date().toISOString(),
        sourceUrl: HANDWERKER_RADAR_SEARCH,
      },
      subjekt: {
        ime: uradnoIme,
        naziv: vnos.ime || uradnoIme,
        naslov: uradniNaslov,
        postnaStevilka: uradnaPosta,
        kraj: uradniKraj,
        poklici: [],
        sourceUrl: HANDWERKER_RADAR_SEARCH,
      },
    },
  };
}

function pripraviPotrditevIdentitete(telo, identiteta) {
  var surovo = telo && telo.confirmedIdentity;
  if (!surovo || typeof surovo !== "object") return { status: "not_provided" };
  if (surovo.confirmed !== true) return { status: "invalid", reason: "confirmation_missing" };

  var ime = varnoBesedilo(surovo.name, 180);
  // Brskalnik lahko kot naziv vrne naslov strani, ki pravnemu imenu doda
  // marketinški slogan. Uradni register sprejme samo pravno ime družbe.
  var naziv = kanonicniPravniNaziv(varnoBesedilo(surovo.businessName, 180) || ime);
  var naslov = varnoBesedilo(surovo.street, 140);
  var postnaStevilka = varnoBesedilo(surovo.postalCode, 5);
  var kraj = varnoBesedilo(surovo.city, 80);
  var potrjeniNosilecVnosa = pocistiImeOsebe(varnoBesedilo(surovo.representativeName, 180));
  var jePravnaDruzba = jeNazivPravneDruzbe(ime);
  var nazivJePravnaDruzba = jeNazivPravneDruzbe(naziv);
  var imaMocnoPravnoVlogo = function (osebnoIme) {
    return Boolean(osebnoIme && identiteta && Array.isArray(identiteta.vloge) && identiteta.vloge.some(function (vloga) {
      return normaliziraj(vloga && vloga.ime) === normaliziraj(osebnoIme) &&
        !/^(?:Neoznačena oseba|Inhaltlich verantwortlich)$/i.test(String(vloga && vloga.vloga || ""));
    }));
  };
  var jeVeljavnoPotrjenoIme = jeVerjetnoImeOsebe(ime) ||
    (imaMocnoPravnoVlogo(ime) && (
      jeVerjetnoDaljseOznacenoImeOsebe(ime) ||
      jeVerjetnoPonovljenoOznacenoImeOsebe(ime)
    ));
  var jeVeljavenPotrjeniNosilec = !potrjeniNosilecVnosa ||
    jeVerjetnoImeOsebe(potrjeniNosilecVnosa) ||
    (imaMocnoPravnoVlogo(potrjeniNosilecVnosa) && (
      jeVerjetnoDaljseOznacenoImeOsebe(potrjeniNosilecVnosa) ||
      jeVerjetnoPonovljenoOznacenoImeOsebe(potrjeniNosilecVnosa)
    ));
  if (!jePravnaDruzba) ime = pocistiImeOsebe(ime);
  if (!nazivJePravnaDruzba && jeVerjetnoImeOsebe(naziv)) naziv = pocistiImeOsebe(naziv);
  if (jeSpletnoAliKontaktnoIme(naziv)) return { status: "invalid", reason: "confirmed_business_name_invalid" };
  if ((!jePravnaDruzba && !jeVeljavnoPotrjenoIme) || naslov.length < 3 || !/\d/.test(naslov) || !/^\d{5}$/.test(postnaStevilka) || kraj.length < 2) {
    return { status: "invalid", reason: "confirmed_data_incomplete" };
  }
  if (!identiteta || !["verified_register", "probable_impressum", "manual_input"].includes(identiteta.status)) {
    return { status: "invalid", reason: "identity_unavailable" };
  }
  identiteta = normalizirajOsebnaPoljaIdentitete(identiteta);
  if (!jeVeljavenPotrjeniNosilec) {
    return { status: "invalid", reason: "confirmed_representative_invalid" };
  }
  var poslovnaImenaIdentitete = Array.isArray(identiteta.businessIdentityNames) ? identiteta.businessIdentityNames : [];
  var mocnaVlogaPotrjenegaImena = Array.isArray(identiteta.vloge) && identiteta.vloge.some(function (vloga) {
    return normaliziraj(vloga && vloga.ime) === normaliziraj(ime) &&
      !/^(?:Neoznačena oseba|Inhaltlich verantwortlich)$/i.test(String(vloga && vloga.vloga || ""));
  });
  if (!jePravnaDruzba && poslovnaImenaIdentitete.some(function (poslovnoIme) {
    return normaliziraj(poslovnoIme) === normaliziraj(ime);
  }) && !mocnaVlogaPotrjenegaImena) {
    return { status: "invalid", reason: "confirmed_person_is_business_identity" };
  }

  if (identiteta.status === "verified_register") {
    var uradnaPolja = [
      [ime, identiteta.ime, normaliziraj],
      [naslov, identiteta.naslov, normalizirajNaslov],
      [postnaStevilka, identiteta.postnaStevilka, String],
      [kraj, identiteta.kraj, normaliziraj],
    ];
    var seUjema = uradnaPolja.every(function (polje) {
      return polje[1] && polje[2](polje[0]) === polje[2](polje[1]);
    });
    if (!seUjema) return { status: "invalid", reason: "official_data_mismatch" };
    return {
      status: "valid",
      identity: Object.assign({}, identiteta, {
        userConfirmed: true,
        verificationMode: "openregister_confirmed",
      }),
    };
  }

  if (identiteta.status === "manual_input") {
    return {
      status: "valid",
      identity: Object.assign({}, identiteta, {
        status: "confirmed_manual",
        confidence: "user_confirmed_unverified",
        entityType: nazivJePravnaDruzba || jePravnaDruzba ? "company" : razdeliImeZaInsolvenco(ime).vrsta,
        ime: nazivJePravnaDruzba ? naziv : ime,
        naziv: naziv,
        nosilec: nazivJePravnaDruzba ? potrjeniNosilecVnosa : "",
        zastopniki: nazivJePravnaDruzba && potrjeniNosilecVnosa ? [potrjeniNosilecVnosa] : [],
        vloge: nazivJePravnaDruzba && potrjeniNosilecVnosa ? [{
          ime: potrjeniNosilecVnosa,
          vloga: "Uporabniško vneseni nosilec oziroma zastopnik",
          confidence: "user_confirmed_unverified",
        }] : [],
        naslov: naslov,
        postnaStevilka: postnaStevilka,
        kraj: kraj,
        source: "user_input",
        userConfirmed: true,
        verificationMode: "user_confirmed_manual",
      }),
    };
  }

  var potrjeniNosilec = potrjeniNosilecVnosa || (jeVeljavnoPotrjenoIme
    ? ime
    : jeVerjetnoImeOsebe(identiteta.nosilec) ? identiteta.nosilec
      : jeVerjetnoImeOsebe(identiteta.ime) ? identiteta.ime : "");
  var pravneVlogeZaPotrditev = Array.isArray(identiteta.vloge)
    ? identiteta.vloge.map(function (vloga) { return Object.assign({}, vloga); })
    : [];
  if (potrjeniNosilec && pravneVlogeZaPotrditev.length) {
    pravneVlogeZaPotrditev[0].ime = potrjeniNosilec;
  } else if (potrjeniNosilec) {
    pravneVlogeZaPotrditev.push({
      ime: potrjeniNosilec,
      vloga: "Potrjeni nosilec oziroma zastopnik",
      confidence: "user_confirmed",
    });
  }
  return {
    status: "valid",
    identity: Object.assign({}, identiteta, {
      status: "confirmed_impressum",
      confidence: "user_confirmed",
      entityType: nazivJePravnaDruzba ? "company" : razdeliImeZaInsolvenco(ime).vrsta,
      ime: nazivJePravnaDruzba ? naziv : ime,
      naziv: naziv,
      nosilec: potrjeniNosilec || identiteta.nosilec || "",
      zastopniki: potrjeniNosilec ? [potrjeniNosilec] : identiteta.zastopniki,
      vloge: pravneVlogeZaPotrditev,
      naslov: naslov,
      postnaStevilka: postnaStevilka,
      kraj: kraj,
      source: "impressum",
      userConfirmed: true,
      verificationMode: "user_confirmed_impressum",
    }),
  };
}

function pocistiNazivDruzbe(vrednost) {
  var naziv = String(vrednost || "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/(?:<!--|-->)/g, " ")
    .replace(/^\s*(?:impressum|imprint|anbieterkennzeichnung|anbieterkennung)\s*(?:[-–—|:]\s*)?/i, "")
    .replace(/\s*[|–—-]\s*(?:impressum|imprint|anbieterkennzeichnung|anbieterkennung)\s*$/i, "")
    .replace(/\s+(?:impressum|imprint|anbieterkennzeichnung|anbieterkennung)\s*$/i, "")
    .trim();
  var pravnaOblika = /\b(?:gmbh\s*&\s*co\.?\s*kg|ug\s*\(haftungsbeschr(?:ä|a)nkt\)|gmbh|mbh|partg|gbr|ohg|ag|kg|eg|(?:n\.?\s*)?e\.?\s*v\.?)\b/i;
  if (pravnaOblika.test(naziv)) {
    naziv = naziv.replace(/^\s*(?:der|die|das)\s+/i, "");
    var jedro = naziv.match(new RegExp("^([\\s\\S]*?" + pravnaOblika.source + ")", "i"));
    if (jedro) naziv = jedro[1];
  }
  return naziv
    .replace(/\bCo\.\s*(?=KG\b)/gi, "Co. ")
    .replace(/\s+/g, " ")
    .replace(/[,:;]\s*$/, "")
    .replace(/\bn\.?\s*e\.?\s*v\.?$/i, "n. e. V.")
    .replace(/\be\.?\s*v\.?$/i, "e. V.")
    .trim();
}

function kanonicniPravniNaziv(vrednost) {
  var naziv = pocistiNazivDruzbe(vrednost);
  if (!naziv) return "";
  var deli = naziv.split(/\s*[|•·]\s*/).map(function (del) { return del.trim(); }).filter(Boolean);
  var pravnaOblika = /\b(?:gmbh|mbh|ug(?:\s*\(haftungsbeschr(?:ä|a)nkt\))?|ag|gbr|kg|ohg|e\.?\s*k\.?|partg|eg|(?:n\.?\s*)?e\.?\s*v\.?)\b/i;
  var kandidat = deli.length < 2 ? naziv : deli.find(function (del) { return pravnaOblika.test(del); }) || deli[0];
  return !jeNazivPravneDruzbe(kandidat) && jeVerjetnoImeOsebe(kandidat)
    ? pocistiImeOsebe(kandidat)
    : kandidat;
}

function jeNazivPravneDruzbe(vrednost) {
  return /\b(?:GmbH|mbH|UG(?:\s*\(haftungsbeschr(?:ä|a)nkt\))?|AG|GbR|OHG|KG|e\.?\s*K\.?|PartG|eG|(?:n\.?\s*)?e\.?\s*V\.?)\b/i.test(String(vrednost || ""));
}

var OSEBNI_NAZIVI_PRED_IMENOM = [
  /^(?:herr|frau|hr\.?|fr\.?)\s+/iu,
  /^(?:univ\.?\s*[-–—]?\s*)?prof(?:essor)?\.?\s*(?:h\.?\s*c\.?)?\s+/iu,
  /^(?:priv(?:at)?\.?\s*[-–—]?\s*doz(?:ent)?\.?|pd)\s+/iu,
  /^dr\.?\s*(?:[-–—]\s*)?(?:ing|med(?:\.?\s*dent)?|rer\.?\s*(?:nat|pol|soc|oec)|phil|jur|theol|oec|techn|sc|h\.?\s*c)\.?\s+/iu,
  /^dr\.?\s+/iu,
  /^dipl(?:om)?\.?\s*[-–—]?\s*(?:ing(?:enieur)?|kfm|kffr|betriebsw|volksw|(?:wirt|wirtsch)\.?\s*[-–—]?\s*ing|inform|math|phys|chem|biol|geol|p(?:ä|a)d|psych|soz|verw|arch)\.?\s*(?:\(\s*(?:fh|univ)\s*\))?\s+/iu,
  /^mag(?:ister)?\.?\s*(?:(?:rer|phil|jur|theol|art)\.?\s*(?:soc\.?\s*oec\.?)?)?\s+/iu,
  /^(?:ph\.?\s*d\.?|d\.?\s*sc\.?|ll\.?\s*[mb]\.?|[bm]\.?\s*(?:sc|eng|a|ed|phil|jur)\.?|mba|emba)\s+/iu,
  /^(?:ing(?:enieur)?|arch(?:itekt)?|rechtsanw(?:ä|a)lt(?:in)?|ra|steuerberater(?:in)?|stb|wirtschaftspr(?:ü|u)fer(?:in)?|wp|sachverst(?:ä|a)ndige(?:r|n)?|meister(?:in)?|staatl\.?\s*gepr\.?\s*(?:techniker(?:in)?|betriebswirt(?:in)?))\.?\s+/iu,
];

var OSEBNI_NAZIVI_ZA_IMENOM = [
  /\s*,\s*(?:dipl(?:om)?\.?\s*[-–—]?\s*(?:ing|kfm|kffr|betriebsw|volksw|(?:wirt|wirtsch)\.?\s*[-–—]?\s*ing|inform|math|phys|chem|biol|geol|p(?:ä|a)d|psych|soz|verw|arch)\.?\s*(?:\(\s*(?:fh|univ)\s*\))?|ph\.?\s*d\.?|d\.?\s*sc\.?|ll\.?\s*[mb]\.?|[bm]\.?\s*(?:sc|eng|a|ed|phil|jur)\.?|mba|emba|mag(?:ister)?\.?)\s*$/iu,
];

function odstraniNaziveIzOsebnegaImena(vrednost) {
  var ime = String(vrednost || "").trim();
  var prejsnje;
  do {
    prejsnje = ime;
    OSEBNI_NAZIVI_PRED_IMENOM.forEach(function (vzorec) { ime = ime.replace(vzorec, "").trim(); });
    OSEBNI_NAZIVI_ZA_IMENOM.forEach(function (vzorec) { ime = ime.replace(vzorec, "").trim(); });
  } while (ime && ime !== prejsnje);
  return ime;
}

function vsebujePoslovniOpis(vrednost) {
  return normaliziraj(vrednost).split(/\s+/).filter(Boolean).some(function (token) {
    return POSLOVNI_OPIS_TOKEN_PATTERN.test(token);
  });
}

function imaRazlikovalniDelPoslovnegaNaziva(vrednost) {
  return normaliziraj(vrednost).split(/\s+/).filter(Boolean).some(function (token) {
    return !POSLOVNI_OPIS_TOKEN_PATTERN.test(token) &&
      !/^(?:und|oder|der|die|das|fur|fuer|von|mit|boden|wand|decke|holz|akustik)$/.test(token);
  });
}

function odstraniPoslovniDodatekZaLocilom(vrednost) {
  var deli = String(vrednost || "").split(/\s*(?:[|•·]|\s[-–—]\s)\s*/).map(function (del) { return del.trim(); }).filter(Boolean);
  if (deli.length > 1 && vsebujePoslovniOpis(deli.slice(1).join(" "))) return deli[0];
  return String(vrednost || "");
}

function razcleniOseboInPoslovniNaziv(vrednost) {
  var vrstica = String(vrednost || "").replace(/^\s*(?:Anbieter|Betreiber)\s*:\s*/i, "").trim();
  var deli = vrstica.split(/\s+[-–—]\s+/).map(function (del) { return del.trim(); }).filter(Boolean);
  if (deli.length !== 2 || !jeVerjetnoImeOsebe(deli[0]) ||
      !vsebujePoslovniOpis(deli[1]) || !imaRazlikovalniDelPoslovnegaNaziva(deli[1])) return null;
  return { ime: pocistiImeOsebe(deli[0]), naziv: kanonicniPravniNaziv(deli[1]) };
}

function pocistiImeOsebe(vrednost) {
  return odstraniNaziveIzOsebnegaImena(odstraniPoslovniDodatekZaLocilom(vrednost))
    .replace(/\b([\p{Lu}])\.(?=[\p{Lu}])/gu, "$1. ")
    .replace(/\s*\([^)]*(?:einzelvertret|vertretungsberechtigt|gesch(?:ä|a)ftsf(?:ü|u)hr)[^)]*\)\s*/gi, " ")
    // Nekateri pravni bloki pripnejo naslov isti vrstici za zastopnikom,
    // npr. "Philipp Beispiel, Musterstraße 1, 12345 Berlin". Naslov ni del
    // imena in ga odstranimo samo, kadar rep po vejici vsebuje številko.
    .replace(/\s*,\s*(?=[^\n]*\d)[\s\S]*$/u, "")
    .replace(/\s+(?:telefon|tel\.?|e-?mail|anschrift|adresse)\b[\s\S]*$/i, "")
    .replace(/\s+(?:installateur|heizungsbau(?:er)?|sanit(?:ä|a)r(?:technik)?|heizung(?:stechnik)?|elektro(?:technik)?|meisterbetrieb|meisterwerkstatt|handwerker|klempner|rohrreinigung|kanalreinigung)\b[\s\S]*$/i, "")
    .replace(/[;,]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function jeVerjetnoImeOsebe(vrednost) {
  var ime = pocistiImeOsebe(vrednost);
  if (/\d|[<>{}=]|&(?:[a-z]+|#\d+);/i.test(ime)) return false;
  if (jeSplosnaOznakaPoslovnegaNaziva(ime) || /^Familie\s+/i.test(ime)) return false;
  if (/^(?:Notwendig|Funktionell|Analyse|Werbung)\s+(?:Immer\s+)?Aktiv$/i.test(ime)) return false;
  if (/^(?:Google|Microsoft|Meta|Amazon|Adobe|Certified)\s+Partner$/i.test(ime)) return false;
  var deli = ime.split(/\s+/).filter(Boolean);
  if (deli.length < 2 || deli.length > 6 || ime.length > 100) return false;
  var normaliziraniDeli = deli.map(normaliziraj);
  if (new Set(normaliziraniDeli).size !== normaliziraniDeli.length) return false;
  if (vsebujePoslovniOpis(ime)) return false;
  if (normaliziraniDeli.some(function (del) {
    return /^(?:location|kontakt|contact|impressum|imprint|datenschutz|privacy|adresse|address|anschrift|telefon|email|mail|home|start|menu|menue|uber|uns|about|willkommen|anbieterkennung|gesetzliche|seiten|seite|navigation|footer|header|hauptinhalt|kostenfrei|registrieren|anmelden|login|haustechnik|sanitar|sanitaer|heizung|elektro|meisterbetrieb|installateur|rohrreinigung|kanalreinigung|kanalsanierung|klempner)$/.test(del);
  })) return false;
  if (/\b(?:gmbh|ug|ag|kg|ohg|gbr|inhaber|geschäftsführer|telefon|e-?mail|umsatzsteuer|angaben|inhaltlich|verantwortlich)\b/i.test(ime)) return false;
  var jedro = deli;
  var vezniki = new Set(["von", "van", "der", "den", "de", "del", "di", "zu", "zur", "zum"]);
  var imenskeBesede = jedro.filter(function (del) { return !vezniki.has(normaliziraj(del)); });
  if (imenskeBesede.length < 2 || imenskeBesede.length > 3) return false;
  return jedro.every(function (del) {
    if (vezniki.has(normaliziraj(del))) return /^[\p{Ll}]+$/u.test(del);
    if (/^[\p{Lu}]\.$/u.test(del)) return true;
    return /^[\p{Lu}][\p{Ll}]+(?:[-'’][\p{Lu}]?[\p{Ll}]+)*$/u.test(del);
  });
}

function jeVerjetnoDaljseOznacenoImeOsebe(vrednost) {
  var ime = pocistiImeOsebe(vrednost);
  if (/\d|[<>{}=]|&(?:[a-z]+|#\d+);/i.test(ime) || vsebujePoslovniOpis(ime) || jeNazivPravneDruzbe(ime)) return false;
  var deli = ime.split(/\s+/).filter(Boolean);
  if (deli.length !== 4 || new Set(deli.map(normaliziraj)).size !== deli.length) return false;
  return deli.every(function (del) {
    return /^[\p{Lu}][\p{Ll}]+(?:[-'’][\p{Lu}]?[\p{Ll}]+)*$/u.test(del);
  });
}

function jeVerjetnoPonovljenoOznacenoImeOsebe(vrednost) {
  var ime = pocistiImeOsebe(vrednost);
  if (/\d|[<>{}=]/.test(ime) || vsebujePoslovniOpis(ime) || jeNazivPravneDruzbe(ime)) return false;
  var deli = ime.split(/\s+/).filter(Boolean);
  return deli.length === 2 && normaliziraj(deli[0]) === normaliziraj(deli[1]) &&
    deli.every(function (del) { return /^[\p{Lu}][\p{Ll}]+(?:[-'’][\p{Lu}]?[\p{Ll}]+)*$/u.test(del); });
}

function normalizirajOsebnaPoljaIdentitete(subjekt) {
  if (!subjekt || typeof subjekt !== "object") return subjekt;
  var rezultat = Object.assign({}, subjekt);
  if (rezultat.ime && !jeNazivPravneDruzbe(rezultat.ime) && jeVerjetnoImeOsebe(rezultat.ime)) {
    rezultat.ime = pocistiImeOsebe(rezultat.ime);
  }
  rezultat.nosilec = pocistiImeOsebe(rezultat.nosilec);
  rezultat.zastopniki = (rezultat.zastopniki || []).map(pocistiImeOsebe).filter(function (ime, index, seznam) {
    return ime && seznam.indexOf(ime) === index;
  });
  rezultat.vloge = (rezultat.vloge || []).map(function (vloga) {
    return Object.assign({}, vloga, { ime: pocistiImeOsebe(vloga && vloga.ime) });
  }).filter(function (vloga) { return vloga.ime; });
  if (!jeNazivPravneDruzbe(rezultat.naziv) && jeVerjetnoImeOsebe(rezultat.naziv)) {
    rezultat.naziv = pocistiImeOsebe(rezultat.naziv);
  }
  return rezultat;
}

function jeSpletnoAliKontaktnoIme(vrednost) {
  var kandidat = String(vrednost || "").trim();
  return /^(?:https?:\/\/|www\.)/i.test(kandidat) ||
    /^(?:[\p{L}\d](?:[\p{L}\d-]*[\p{L}\d])?\.)+(?:de|com|net|org|eu|info|biz)$/iu.test(kandidat) ||
    /^[\p{L}\d\s-]+\.(?:de|com|net|org|eu|info|biz)$/iu.test(kandidat) ||
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(kandidat) ||
    /^(?:Homepage|Website|Webseite|Internet|E-?Mail|Telefon|Tel\.?|Fax)\b/i.test(kandidat);
}

function jeSplosnaOznakaPoslovnegaNaziva(vrednost) {
  var kandidat = String(vrednost || "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/(?:<!--|-->)/g, " ").replace(/\s+/g, " ").trim();
  return !kandidat || /^(?:Information(?:en)?|Vollst(?:ä|a)ndiger\s+Firmenname|Firmenname|Unternehmensname|Unternehmensinformationen|Name\s+des\s+Unternehmens|Verwaltung(?:\s+und\s+Betriebssitz)?|Eingetragener\s+Firmensitz|N(?:ü|u)tzliche\s+Weiterleitungen|Wir\s+sch(?:ä|a)tzen\s+Ihre\s+Privatsph(?:ä|a)re|Transport\s+nach|Umzug|Anpassen|Einstellungen|Alle(?:s)?\s+(?:ablehnen|akzeptieren|annehmen)|Rechtliche\s+Information(?:en)?(?:\s+zu\s+unserem\s+Unternehmen)?|Anbieter|Betreiber)$/i.test(kandidat) ||
    /^(?:Verwaltung|Betriebssitz)(?:\s*[|•·–—-]\s*(?:Verwaltung|Betriebssitz))*$/i.test(kandidat) ||
    /^(?:Umzug|Umz(?:ü|u)ge|Transport|Transporte)(?:\s*[|•·–—-]\s*(?:Umzug|Umz(?:ü|u)ge|Transport|Transporte))*$/i.test(kandidat) ||
    /^Hier\s+finden\s+Sie\s+die\s+rechtlichen\s+Angaben\b/i.test(kandidat) ||
    /^(?:f(?:ü|u)r)\s+/i.test(kandidat) ||
    /^(?:(?:Steuerberater(?:in)?|Fachberater(?:in)?|Rechtsanw(?:ä|a)lt(?:in)?|Fachanw(?:ä|a)lt(?:in)?|Architekt(?:in)?|Sachverst(?:ä|a)ndige(?:r|n)?|Gutachter(?:in)?|Ingenieur(?:in)?)(?:\s*(?:,|\/|&|und)\s*)?)+$/i.test(kandidat) ||
    /^(?:Installation|Montage|Herstellung|Verkauf|Vermietung|Reparatur|Wartung|Planung|Beratung|Dienstleistungen?)\s+(?:von|für|im|in|und|&|rund\s+um)\b/i.test(kandidat) ||
    kandidat.length > 90 || /:\s+/.test(kandidat) || /[.!?]\s*$/.test(kandidat);
}

function oceniUjemanjePoslovnihNazivov(prvi, drugi) {
  var a = normaliziraj(prvi).split(/\s+/).filter(function (token) { return token.length > 1; });
  var b = normaliziraj(drugi).split(/\s+/).filter(function (token) { return token.length > 1; });
  if (!a.length || !b.length) return 0;
  var skupni = a.filter(function (token) { return b.includes(token); }).length;
  return skupni / Math.max(a.length, b.length);
}

function domenskiNaziv(sourceUrl) {
  try {
    var gostitelj = new URL(sourceUrl).hostname.replace(/^www\./i, "").split(".");
    if (gostitelj.length > 1) gostitelj.pop();
    return normaliziraj(gostitelj.join(" ").replace(/[-_]+/g, " "));
  } catch (_) {
    return "";
  }
}

function izlociStrukturiranaPoslovnaImena(html) {
  var imena = [];
  function dodajIme(vrednost) {
    var ime = kanonicniPravniNaziv(String(vrednost || "").trim());
    if (!ime || jeSpletnoAliKontaktnoIme(ime) || imena.some(function (obstojece) {
      return normaliziraj(obstojece) === normaliziraj(ime);
    })) return;
    imena.push(ime);
  }
  function preglej(vrednost) {
    if (!vrednost || typeof vrednost !== "object") return;
    if (Array.isArray(vrednost)) {
      vrednost.forEach(preglej);
      return;
    }
    var tipi = Array.isArray(vrednost["@type"]) ? vrednost["@type"] : [vrednost["@type"]];
    var poslovniTip = tipi.some(function (tip) {
      return /^(?:Organization|Corporation|LocalBusiness|ProfessionalService|HomeAndConstructionBusiness|Store)$/i.test(String(tip || ""));
    });
    if (poslovniTip) {
      dodajIme(vrednost.legalName);
      dodajIme(vrednost.name);
    }
    Object.keys(vrednost).forEach(function (kljuc) {
      if (vrednost[kljuc] && typeof vrednost[kljuc] === "object") preglej(vrednost[kljuc]);
    });
  }
  Array.from(String(html || "").matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .forEach(function (ujemanje) {
      try { preglej(JSON.parse(decodeHtml(ujemanje[1]))); } catch (_) { /* Neveljaven JSON-LD ni dokaz. */ }
    });
  return imena;
}

function najdiPrimarniPoslovniNaziv(vrstice, lokacijaIndex, vnos) {
  var seznam = Array.isArray(vrstice) ? vrstice : [];
  if (lokacijaIndex < 1) return "";
  var ulicaIndex = lokacijaIndex - 1;
  var zacetek = -1;
  for (var i = 0; i < ulicaIndex; i += 1) {
    if (IMPRESSUM_HEADING_PATTERN.test(seznam[i]) || LEGAL_PROVIDER_IDENTITY_PATTERN.test(seznam[i])) zacetek = i;
  }
  var vneseniNaziv = String(vnos && vnos.ime || "").trim();
  var kandidati = seznam.slice(Math.max(0, zacetek + 1), ulicaIndex).filter(function (vrstica) {
    return vrstica.length <= 140 && !jeSpletnoAliKontaktnoIme(vrstica) && !jeSplosnaOznakaPoslovnegaNaziva(vrstica) &&
      !/^(?:Angaben\s+gem(?:äß|ass)|Kontakt|Deutschland|Inhaltlich\s+verantwortlich|Verantwortlich\s+f(?:ü|u)r|Herausgeber|Diensteanbieter|Anbieter|Betreiber)\b/i.test(vrstica) &&
      !new RegExp("^(?:" + LEGAL_ROLE_LABEL_SOURCE + ")\\b", "i").test(vrstica) &&
      !/^(?:Installateur|Heizungsbauer|Sanit(?:ä|a)r|Heizung|Elektro|Meisterbetrieb)$/i.test(vrstica) &&
      !(/\p{L}/u.test(vrstica) && /\d/.test(vrstica));
  });
  var pravniNaziv = kandidati.find(jeNazivPravneDruzbe);
  if (pravniNaziv) return kanonicniPravniNaziv(pravniNaziv);
  var nazivPoUjemanju = vneseniNaziv && kandidati.filter(function (kandidat) {
    return !jeVerjetnoImeOsebe(kandidat) && (vsebujePoslovniOpis(kandidat) || jeNazivPravneDruzbe(kandidat));
  }).map(function (kandidat) {
    return { kandidat: kandidat, ocena: oceniUjemanjePoslovnihNazivov(kandidat, vneseniNaziv) };
  }).filter(function (rezultat) { return rezultat.ocena >= 0.6; }).sort(function (a, b) {
    return b.ocena - a.ocena;
  })[0];
  if (nazivPoUjemanju) return kanonicniPravniNaziv(nazivPoUjemanju.kandidat);
  var povezanaOsebaInNaziv = seznam.slice(Math.max(0, zacetek + 1), ulicaIndex)
    .map(razcleniOseboInPoslovniNaziv).find(Boolean);
  if (povezanaOsebaInNaziv) return povezanaOsebaInNaziv.naziv;
  var opisniNaziv = kandidati.find(function (kandidat) {
    return vsebujePoslovniOpis(kandidat) && imaRazlikovalniDelPoslovnegaNaziva(kandidat);
  });
  if (opisniNaziv) return kanonicniPravniNaziv(opisniNaziv);
  var normaliziraniVneseniNaziv = normaliziraj(vneseniNaziv);
  var jeVneseniNazivVidenVViru = normaliziraniVneseniNaziv && seznam.some(function (vrstica) {
    return normaliziraj(vrstica).includes(normaliziraniVneseniNaziv);
  });
  if (jeVneseniNazivVidenVViru && !jeVerjetnoImeOsebe(vneseniNaziv) && vsebujePoslovniOpis(vneseniNaziv)) {
    return kanonicniPravniNaziv(vneseniNaziv);
  }
  var osebniNaziv = kandidati.find(jeVerjetnoImeOsebe);
  if (osebniNaziv && vneseniNaziv && vsebujePoslovniOpis(vneseniNaziv) &&
      normaliziraj(vneseniNaziv).includes(normaliziraj(osebniNaziv))) return kanonicniPravniNaziv(vneseniNaziv);
  if (kandidati[0]) return kanonicniPravniNaziv(kandidati[0]);
  return jeSpletnoAliKontaktnoIme(vneseniNaziv) ? "" : kanonicniPravniNaziv(vneseniNaziv);
}

function jeStrukturiranoPoslovnoIme(kandidat, poslovnaImena, sourceUrl) {
  var normalniKandidat = normaliziraj(kandidat);
  if (!normalniKandidat) return false;
  if ((poslovnaImena || []).some(function (ime) { return normaliziraj(ime) === normalniKandidat; })) return true;
  return domenskiNaziv(sourceUrl) === normalniKandidat;
}

function najdiNeoznacenoOseboPrimarnegaBloka(vrstice, lokacijaIndex, poslovnaImena, sourceUrl, primarniNaziv) {
  if (lokacijaIndex < 2 || jeNazivPravneDruzbe(primarniNaziv)) return "";
  var seznam = Array.isArray(vrstice) ? vrstice : [];
  var zacetek = -1;
  for (var i = 0; i < lokacijaIndex; i += 1) {
    if (IMPRESSUM_HEADING_PATTERN.test(seznam[i]) || LEGAL_PROVIDER_IDENTITY_PATTERN.test(seznam[i])) zacetek = i;
  }
  var kandidati = seznam.slice(Math.max(0, zacetek + 1), lokacijaIndex - 1)
    .map(pocistiImeOsebe)
    .filter(function (kandidat) {
      return jeVerjetnoImeOsebe(kandidat) &&
        !jeSpletnoAliKontaktnoIme(kandidat) &&
        !jeStrukturiranoPoslovnoIme(kandidat, poslovnaImena, sourceUrl);
    });
  kandidati.sort(function (a, b) {
    return a.split(/\s+/).length - b.split(/\s+/).length || a.length - b.length;
  });
  return kandidati[0] || "";
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

function jeNedosegljivaNadomestnaStran(html) {
  var vir = String(html || "");
  var naslov = (vir.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [null, ""])[1];
  var zacetek = besediloIzHtml(vir).slice(0, 2500);
  var oznakaNedosegljivosti = /(?:domain\s+not\s+available|website\s+is\s+(?:currently\s+)?not\s+available|internetpr(?:ä|&auml;)senz\s+ist\s+zur\s+zeit\s+nicht\s+erreichbar)/i;
  var potrditevGostovanja = /(?:powered\s+by\s+strato|please\s+try\s+again\s+later|zu\s+einem\s+sp(?:ä|&auml;)teren\s+zeitpunkt)/i;
  var heiseNadomestnaStran = /(?:hier\s+entsteht\s+eine\s+neue\s+webseite|multifunktionaler\s+arbeitsplatz)/i.test(zacetek) &&
    /(?:heise\s+homepages|webseite\s+im\s+aufbau)/i.test(String(naslov || "") + " " + zacetek);
  var stranVGradnji = /(?:we(?:'|’)re|website\s+is)\s+under\s+construction/i.test(zacetek) &&
    /(?:check\s+back\s+(?:soon|for\s+an\s+update)|squarespace)/i.test(String(naslov || "") + " " + zacetek);
  var stran404 = /(?:^|\s)404(?:\s|$)/i.test(String(naslov || "") + " " + zacetek.slice(0, 500)) &&
    /(?:page\s+not\s+found|could\s+not\s+be\s+found)/i.test(zacetek.slice(0, 1000));
  return heiseNadomestnaStran || stranVGradnji || stran404 ||
    (oznakaNedosegljivosti.test(String(naslov || "") + " " + zacetek) && potrditevGostovanja.test(zacetek));
}

async function fetchJavniHtml(zacetniUrl) {
  var url = zacetniUrl;
  for (var preusmeritev = 0; preusmeritev < 6; preusmeritev += 1) {
    await preveriJavniSpletniNaslov(url.toString());
    var odgovor;
    for (var httpPoskus = 0; httpPoskus < 3; httpPoskus += 1) {
      odgovor = await fetchZRokom(url, {
        redirect: "manual",
        // Najprej se pošteno predstavimo kot aplikacija. Če WAF nebrowserski
        // profil zavrne s 403/5xx, naslednji poskus uporabi običajen brskalniški
        // profil; istega 429 nikoli ne obidemo z menjavo profila.
        headers: { "User-Agent": httpPoskus === 0 ? USER_AGENT : BROWSER_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      }, 10000);
      var zacasnaHttpNapaka = odgovor.status === 429 || odgovor.status >= 500;
      if (!zacasnaHttpNapaka || httpPoskus === 2) break;
      var retryAfter = Number(odgovor.headers.get("retry-after") || 0);
      var zakasnitev = retryAfter > 0 ? Math.min(retryAfter * 1000, 3000) : 500 * (httpPoskus + 1);
      await new Promise(function (resolve) { setTimeout(resolve, zakasnitev); });
    }
    if (odgovor.status >= 300 && odgovor.status < 400) {
      var lokacija = odgovor.headers.get("location");
      if (!lokacija) throw new Error("WEBSITE_REDIRECT_FAILED");
      url = new URL(lokacija, url);
      continue;
    }
    if (!odgovor.ok) {
      if (odgovor.status === 429) throw new Error("WEBSITE_RATE_LIMITED_429");
      if (odgovor.status >= 500) throw new Error("WEBSITE_SERVER_ERROR_" + odgovor.status);
      throw new Error("WEBSITE_FETCH_FAILED_" + odgovor.status);
    }
    var tip = String(odgovor.headers.get("content-type") || "");
    if (tip && !/text\/html|application\/xhtml\+xml/i.test(tip)) throw new Error("WEBSITE_NOT_HTML");
    var dolzina = Number(odgovor.headers.get("content-length") || 0);
    if (dolzina > MAX_IMPRESSUM_BYTES) throw new Error("WEBSITE_TOO_LARGE");
    var html = await odgovor.text();
    if (html.length > MAX_IMPRESSUM_BYTES) throw new Error("WEBSITE_TOO_LARGE");
    // Ponudniki gostovanja lahko ob deaktivirani domeni vrnejo HTTP 200 in
    // svojo nadomestno stran. To ni veljavno prebrana stran podjetja.
    if (jeNedosegljivaNadomestnaStran(html)) throw new Error("WEBSITE_PLACEHOLDER_UNAVAILABLE");
    return { html: html, url: url.toString() };
  }
  throw new Error("WEBSITE_TOO_MANY_REDIRECTS");
}

function najdiRegistrskiVnos(tekst) {
  // Na nekaterih straneh sta dve registrski številki zlepljeni brez presledka
  // (npr. »HRA 6331HRB14819«). Mejo med njima obnovimo pred razčlenjevanjem,
  // posamezne številke pa še vedno preverimo z enakimi strogimi pravili.
  var vir = String(tekst || "").replace(/(\d)(?=(?:HR[AB]|GnR|PR|VR)\s*\d)/gi, "$1 ");
  var vzorec = /\b(HR[AB]|GnR|PR|VR)\s*(?:[-–—]\s*)?(?:Nr\.?\s*:?\s*)?([A-Z]?\s*\d+[A-Z0-9-]*)\b/gi;
  var ujemanje;
  while ((ujemanje = vzorec.exec(vir))) {
    var neposrednoPred = vir.slice(Math.max(0, ujemanje.index - 40), ujemanje.index);
    var stevilka = String(ujemanje[2] || "").replace(/\s+/g, "");
    var stevke = stevilka.replace(/\D/g, "");
    // »Steuernummer: HRB ...« je napačno označena davčna številka, ne dokaz
    // vpisa v register. Nerazumno dolge vrednosti prav tako ne širimo kot dejstvo.
    if (/Steuernummer\s*:\s*$/i.test(neposrednoPred) || stevke.length > 7) continue;
    return {
      type: ujemanje[1],
      number: stevilka,
      formatted: (ujemanje[1] + " " + stevilka).replace(/\s+/g, " ").trim(),
    };
  }
  return null;
}

function razcleniVidniImpressumTekst(tekst, sourceUrl, vnos) {
  tekst = odstraniSekundarneVzorčneVrstice(normalizirajInlineNaslovneVrstice(tekst));
  var vrstice = String(tekst || "").split(/\r?\n/).map(function (vrstica) {
    return vrstica.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
  var lokacijaIndex = vrstice.findIndex(function (vrstica) { return /\b\d{5}\b/.test(vrstica); });
  if (lokacijaIndex < 0) return null;
  var lokacija = vrstice[lokacijaIndex];
  var posta = (lokacija.match(/\b\d{5}\b/) || [""])[0];
  var predPosto = lokacija.slice(0, lokacija.indexOf(posta))
    .replace(/(?:,\s*)?D-\s*$/i, "")
    .replace(/[,\s]+$/, "")
    .trim();
  var zaPosto = lokacija.slice(lokacija.indexOf(posta) + 5).replace(/^[,\s]+/, "").trim();
  var naslov = /\p{L}/u.test(predPosto) && /\d/.test(predPosto)
    ? predPosto
    : vrstice[lokacijaIndex - 1] || "";
  var kraj = zaPosto || String(vnos && vnos.kraj || "");
  var nazivDruzbe = najdiPrimarniPoslovniNaziv(vrstice, lokacijaIndex, vnos);
  var oznaceno = String(tekst || "").match(new RegExp("(" + LEGAL_ROLE_LABEL_SOURCE + ")\\s*:?\\s*(?:Herr\\s+|Frau\\s+)?([^\\n]{3,100})", "i"));
  var ime = oznaceno && (jeVerjetnoImeOsebe(oznaceno[2]) || jeVerjetnoDaljseOznacenoImeOsebe(oznaceno[2])) ? pocistiImeOsebe(oznaceno[2]) : "";
  var pravneVloge = ime ? [{ ime: ime, vloga: dolociPravnoVlogo(oznaceno[1], oznaceno[2]) }] : [];
  if (!ime) {
    var povezanaOseba = vrstice.slice(0, lokacijaIndex).map(razcleniOseboInPoslovniNaziv).find(Boolean);
    if (povezanaOseba) {
      ime = povezanaOseba.ime;
      pravneVloge.push({ ime: ime, vloga: "Neoznačena oseba", confidence: "primary_legal_block" });
    }
  }
  if (!ime && nazivDruzbe) {
    var registriraniTrgovec = najdiNosilcaRegistriranegaTrgovca(vrstice);
    if (registriraniTrgovec) {
      ime = registriraniTrgovec.ime;
      pravneVloge.push(registriraniTrgovec);
    }
  }
  if (!ime) {
    ime = najdiNeoznacenoOseboPrimarnegaBloka(vrstice, lokacijaIndex, [], sourceUrl, nazivDruzbe);
    if (ime) pravneVloge.push({ ime: ime, vloga: "Neoznačena oseba", confidence: "low" });
  }
  if (!ime || naslov.length < 3 || !posta || kraj.length < 2) return null;
  var register = najdiRegistrskiVnos(tekst);
  var registergericht = String(tekst || "").match(/(?:Registergericht|Amtsgericht)\s*:?\s*([^\n]{2,100})/i);
  if (!registergericht) registergericht = String(tekst || "").match(/Handelsregister\s*:?\s*(?:Amtsgericht\s+)?([^\n]{2,80}?)\s+(?:HR[AB]|GnR|PR|VR)\b/i);
  var email = (String(tekst || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
  var telefon = (String(tekst || "").match(/(?:Telefon|Tel\.)\s*:?\s*([+()\d][\d\s()\/-]{5,})/i) || [null, ""])[1].trim();
  return {
    ime: ime,
    naziv: kanonicniPravniNaziv(nazivDruzbe || String(vnos && vnos.ime || "").trim() || ime),
    entityType: jeNazivPravneDruzbe(nazivDruzbe) ? "company" : "person",
    nosilec: ime,
    zastopniki: [ime],
    vloge: pravneVloge,
    businessIdentityNames: nazivDruzbe && normaliziraj(nazivDruzbe) !== normaliziraj(ime) ? [nazivDruzbe] : [],
    legalEntityWithoutRepresentative: false,
    naslov: naslov,
    postnaStevilka: posta,
    kraj: kraj.replace(/,?\s*Deutschland$/i, "").trim(),
    registerNumber: register ? register.formatted : "",
    registerCourt: registergericht ? registergericht[1].trim() : "",
    vatId: "",
    email: email,
    telefon: telefon,
    sourceUrl: sourceUrl,
  };
}

async function poisciImpressumZBrskalnikom(urlji, vnos, pravniKontekst) {
  var browser = await zazeniBrskalnikZaDokazilo();
  try {
    for (var i = 0; i < urlji.length; i += 1) {
      var varenUrl;
      try { varenUrl = await preveriJavniSpletniNaslov(urlji[i]); } catch (_) { continue; }
      var stran = await browser.newPage();
      try {
        await stran.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
        await stran.setUserAgent(BROWSER_USER_AGENT);
        await stran.goto(varenUrl.toString(), { waitUntil: "domcontentloaded", timeout: 15000 });
        await new Promise(function (resolve) { setTimeout(resolve, 900); });
        if (pravniKontekst && !jeUrlVPravnemKontekstu(stran.url(), pravniKontekst)) continue;
        var vsebina = await stran.evaluate(function () {
          return { html: document.documentElement.outerHTML, tekst: document.body && document.body.innerText || "" };
        });
        if (jeNedosegljivaNadomestnaStran(vsebina.html)) continue;
        if (!jePravniIdentitetniDokument(vsebina.html, stran.url())) continue;
        var subjekt = razcleniImpressum(vsebina.html, stran.url(), vnos) || razcleniVidniImpressumTekst(vsebina.tekst, stran.url(), vnos);
        if (subjekt) {
          subjekt.sourceKind = jeImpressumDokument(vsebina.html, stran.url()) ? "impressum" : "labelled_provider_page";
          return { status: "found", subjekt: subjekt, sourceUrl: stran.url() };
        }
      } catch (_) {
        // Poskusimo naslednjo že preverjeno javno pot.
      } finally {
        await stran.close();
      }
    }
    return null;
  } finally {
    await zapriBrskalnikZaDokazilo(browser);
  }
}

function razcleniImpressumLegacy(html, sourceUrl, vnos) {
  var strukturiranHtml = String(html || "").replace(/<\/(?:h[1-6]|p|div|li|section|article)>/gi, "$&\n");
  var tekst = normalizirajInlineNaslovneVrstice(besediloIzHtml(strukturiranHtml).replace(/\s*\n\s*/g, "\n"));
  var vrstice = tekst.split("\n").map(function (vrstica) { return vrstica.trim(); }).filter(Boolean);
  var lokacijaIndex = vrstice.findIndex(function (vrstica) { return /\b\d{5}\s+[\p{L}]/u.test(vrstica); });
  var poslovnaImena = izlociStrukturiranaPoslovnaImena(html);
  var naziv = najdiPrimarniPoslovniNaziv(vrstice, lokacijaIndex, vnos);
  var ujemanje = tekst.match(new RegExp("(" + LEGAL_ROLE_LABEL_SOURCE + ")\\s*:?\\s*\\n?(?:Herr\\s+|Frau\\s+)?([^\\n]{2,100})", "i"));
  var nosilec = ujemanje && jeVerjetnoImeOsebe(ujemanje[2]) ? pocistiImeOsebe(ujemanje[2]) : "";
  if (!nosilec) nosilec = najdiNeoznacenoOseboPrimarnegaBloka(vrstice, lokacijaIndex, poslovnaImena, sourceUrl, naziv);
  if (!nosilec) return null;
  var lokacija = tekst.match(/\b(\d{5})\s+([^\n,]{2,80})/u);
  return {
    ime: nosilec,
    naziv: naziv || nosilec,
    entityType: jeNazivPravneDruzbe(naziv) ? "company" : "person",
    nosilec: nosilec,
    zastopniki: [nosilec],
    vloge: [{ ime: nosilec, vloga: ujemanje ? dolociPravnoVlogo(ujemanje[1], ujemanje[2]) : "Neoznačena oseba", confidence: ujemanje ? undefined : "low" }],
    businessIdentityNames: poslovnaImena.concat(
      naziv && normaliziraj(naziv) !== normaliziraj(nosilec) ? [naziv] : []
    ).filter(Boolean),
    naslov: lokacijaIndex > 0 ? vrstice[lokacijaIndex - 1] : String(vnos && vnos.naslov || ""),
    postnaStevilka: lokacija ? lokacija[1] : String(vnos && vnos.postnaStevilka || ""),
    kraj: lokacija ? lokacija[2].trim() : String(vnos && vnos.kraj || ""),
    sourceUrl: sourceUrl,
  };
}

function izlociPravniImpressumBlok(html) {
  var surovo = String(html || "");
  var zacetek = surovo.search(/<(?:h1|h2|h3)\b[^>]*>[\s\S]{0,400}?\b(?:Impressum|Imprint|Anbieterkennzeichnung|Anbieterkennung)\b[\s\S]{0,400}?<\/(?:h1|h2|h3)>/i);
  if (zacetek < 0) {
    zacetek = surovo.search(/<(?:h1|h2|h3)\b[^>]*>[\s\S]{0,400}?(?:Informationen\s+(?:ü|u)ber\s+uns\s+als\s+Verantwortliche|Verantwortliche(?:r)?\s+Anbieter)[\s\S]{0,400}?<\/(?:h1|h2|h3)>/i);
  }
  // Nekateri WordPress Impressumi nimajo naslova <h1>Impressum>, temveč se
  // pravni blok začne neposredno z »Angaben gemäß § 5 TMG/DDG«. Iščemo samo
  // znotraj <body>, da enaka fraza iz SEO meta opisa v <head> ne postane vir.
  if (zacetek < 0) {
    var teloIndex = surovo.search(/<body\b/i);
    var telo = teloIndex >= 0 ? surovo.slice(teloIndex) : surovo;
    var pravnaOznaka = telo.search(/(?:Angaben\s+gem(?:äß|&auml;|ass)\s*§?\s*5\s*(?:TMG|DDG)|Anbieterkennzeichnung|Gesetzliche\s+Anbieterkennung)/i);
    if (pravnaOznaka >= 0) zacetek = Math.max(0, (teloIndex >= 0 ? teloIndex : 0) + pravnaOznaka - 300);
  }
  if (zacetek < 0) return surovo;
  var blok = surovo.slice(zacetek, zacetek + 20000);
  var konec = blok.slice(200).search(/<(?:h[1-6]|strong|b)\b[^>]*>\s*(?:II\.\s*Rechte|Rechte\s+der\s+Nutzer|Haftungsausschluss|Haftung\s+f(?:ü|u)r|Urheberrecht|Datenschutz|Online-Streitbeilegung|Streitschlichtung)\b/i);
  if (konec >= 0) konec += 200;
  return konec > 200 ? blok.slice(0, konec) : blok;
}

function pocistiKontekstPravneVloge(vrednost) {
  return String(vrednost || "")
    .replace(/^\s*(?:\d+|[a-z])\s*[.)]\s*/i, "")
    .replace(/^\s*(?:(?:den|die|das)\s+)?(?:Inh\.(?=\s|:|$)|Inhaber(?:in|\s*\/\s*-?\s*in)?|Gesch(?:ä|a)ftsf(?:ü|u)hrer(?:in)?|Gesch(?:ä|a)ftsf(?:ü|u)hrung|Betriebsinhaber(?:in)?|Firmeninhaber(?:in)?|Gesch(?:ä|a)ftsinhaber(?:in)?|Vertretungsberechtigte(?:r|n)?|Gesetzliche(?:r|n)?\s+Vertreter(?:in)?|Gesellschafter(?:in|innen)?|Vorstand|Komplement(?:ä|a)r(?:in)?|Partner(?:in)?)\s*:?\s*/i, "")
    .trim();
}

function pocistiKrajIzPravneVrstice(vrednost) {
  return String(vrednost || "")
    .replace(new RegExp("\\s+(?:" + LEGAL_ROLE_LABEL_SOURCE + ")\\b[\\s\\S]*$", "i"), "")
    .replace(/\s+(?:Kontakt|Telefon|Tel\.?|E-?Mail|Registergericht|Umsatzsteuer)\s*:?\s*[\s\S]*$/i, "")
    .replace(/\s*\((?:B(?:ü|u)ro|Werkstatt|Filiale|Standort|Lager|Office)\)\s*$/i, "")
    .replace(/\s+Deutschland\s*$/i, "")
    .replace(/[,;•·\s]+$/, "")
    .trim();
}

function pocistiNaslovUlice(vrednost) {
  var naslov = String(vrednost || "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/^\s*(?:Adresse|Anschrift)\s*:\s*/i, "").replace(/[,;•·\s]+$/, "").trim();
  var sPredpono = naslov.match(/^[^,\d]{2,100},\s*([\p{L}][^,]{0,120}\d[\p{L}\d\s/.-]*)$/u);
  return (sPredpono ? sPredpono[1] : naslov).trim();
}

function normalizirajInlineNaslovneVrstice(vrednost) {
  return String(vrednost || "").split("\n").map(function (vrstica) {
    var deli = vrstica.split(/\s+(?:[-–—]|[•·])\s+/).map(function (del) { return del.trim(); }).filter(Boolean);
    if (deli.length < 3 || !deli.some(function (del) { return /\b\d{5}\s+\p{L}/u.test(del); }) ||
        !deli.some(function (del) { return /\p{L}/u.test(del) && /\d/.test(del) && !/\b\d{5}\b/.test(del); })) return vrstica;
    return deli.join("\n");
  }).join("\n");
}

function odstraniSekundarneVzorčneVrstice(vrednost) {
  var praviNaslovNajden = false;
  return String(vrednost || "").split("\n").filter(function (vrstica) {
    var vzorcnaVrstica = /\b(?:Muster(?:stra(?:ß|ss)e|weg|platz|stadt|hausen)|(?:Max|Erika)\s+(?:Mustermann|Musterfrau|Beispiel)|DE123456789)\b/i.test(vrstica);
    var vsebujeLokacijo = /\b\d{5}\s+[\p{L}]/u.test(vrstica);
    if (praviNaslovNajden && vzorcnaVrstica) return false;
    if (vsebujeLokacijo && !vzorcnaVrstica) praviNaslovNajden = true;
    return true;
  }).join("\n");
}

function dolociPravnoVlogo(oznaka, kontekst) {
  var skupaj = [oznaka, kontekst].filter(Boolean).join(" ");
  if (/(?:\bInh\.(?=\s|:|$)|\b(?:Betriebsinhaber|Firmeninhaber|Geschäftsinhaber|Inhaber)(?:in|\s*\/\s*-?\s*in)?\b)/i.test(skupaj)) return "Inhaber";
  if (/\b(?:Geschäftsführer|Geschäftsführung|GF)(?:in)?\b/i.test(skupaj)) return "Geschäftsführung";
  if (/\bVorstand\b/i.test(skupaj)) return "Vorstand";
  if (/\bKomplementär(?:in)?\b/i.test(skupaj)) return "Komplementär";
  if (/\bGesellschafter(?:in)?\b/i.test(skupaj)) return "Gesellschafter";
  if (/\bPartner(?:in)?\b/i.test(skupaj)) return "Partner";
  return "Vertretung";
}

function naslednjiKandidatPravneVloge(tekst, odIndeksa) {
  var vrstice = String(tekst || "").slice(Math.max(0, odIndeksa || 0)).split("\n")
    .map(function (vrstica) { return vrstica.trim(); }).filter(Boolean).slice(0, 3);
  for (var i = 0; i < vrstice.length; i += 1) {
    var kandidat = pocistiImeOsebe(pocistiKontekstPravneVloge(vrstice[i]));
    if (jeVerjetnoImeOsebe(kandidat)) return kandidat;
  }
  return "";
}

function najdiNosilcaRegistriranegaTrgovca(vrstice) {
  var seznam = Array.isArray(vrstice) ? vrstice : [];
  var lokacijaIndex = seznam.findIndex(function (vrstica) { return /\b\d{5}\s+[\p{L}]/u.test(vrstica); });
  if (lokacijaIndex < 3) return null;
  var registerIndex = seznam.findIndex(function (vrstica) { return /\bHRA\s*(?:[-–—]\s*)?(?:Nr\.?\s*:?\s*)?[A-Z]?\s*\d+[A-Z0-9-]*\b/i.test(vrstica); });
  if (registerIndex < 0) return null;
  var nazivIndex = seznam.findIndex(function (vrstica, index) {
    return index < lokacijaIndex && /\be\.?\s*K\.?\b/i.test(vrstica) && jeNazivPravneDruzbe(vrstica);
  });
  if (nazivIndex < 0 || nazivIndex + 1 >= lokacijaIndex) return null;
  var pravniNaslov = seznam.slice(Math.max(0, nazivIndex - 4), nazivIndex).join(" ");
  if (!/(?:Herausgeber\s+dieser\s+(?:Website|Webseite)|Diensteanbieter|Anbieter\s+dieser\s+(?:Website|Webseite)|Angaben\s+gem(?:äß|ass)\s+§\s*(?:5|6))/i.test(pravniNaslov)) return null;
  var kandidat = pocistiImeOsebe(seznam[nazivIndex + 1]);
  if (!jeVerjetnoImeOsebe(kandidat)) return null;
  var vrsticaUlice = seznam.slice(nazivIndex + 2, lokacijaIndex).find(function (vrstica) {
    return /\p{L}/u.test(vrstica) && /\d/.test(vrstica) && !/^(?:Telefon|Tel\.?|Fax|E-?Mail|Steuer|Register|HR[AB])\b/i.test(vrstica);
  });
  if (!vrsticaUlice) return null;
  return { ime: kandidat, vloga: "Inhaber", confidence: "primary_registered_merchant_block" };
}

function razcleniImpressum(html, sourceUrl, vnos) {
  var pravniHtml = izlociPravniImpressumBlok(html);
  var strukturiranHtml = pravniHtml.replace(/<\/(?:h[1-6]|p|div|li|section|article|address|td|dd)>/gi, "$&\n");
  var strukturiranoBesedilo = besediloIzHtml(strukturiranHtml).replace(/\s*\n\s*/g, "\n")
    .replace(/([^\n])(?=(?:Firmenname|Inhaber(?:in)?|Adresse|Anschrift|Telefon|Tel\.?|E-?Mail|Website|Webseite|Handelsregister|Registergericht|Amtsgericht|USt\.?-?Id)\s*:)/gi, "$1\n")
    .replace(/(^|\n)\s*(?:Vollst(?:ä|a)ndiger\s+Firmenname|Firmenname|Unternehmensname)\s*:?\s*(?=\n)/gi, "$1")
    .replace(/(^|\n)\s*(?:Vollst(?:ä|a)ndiger\s+Firmenname|Firmenname|Unternehmensname)\s*:\s*/gi, "$1");
  var tekst = odstraniSekundarneVzorčneVrstice(normalizirajInlineNaslovneVrstice(strukturiranoBesedilo));
  // Vse za splošnim kreditom izdelovalca strani je zunaj pravnega bloka
  // preverjanega podjetja. Tako besede, kot je "Partner" v imenu agencije,
  // ne morejo postati vloga ali zastopnik preverjenega subjekta.
  var izdelovalecIndex = tekst.search(/(?:^|\n)\s*(?:Entwicklung(?:\s*\/\s*(?:IT|Webdesign))*|Website\s+(?:gestaltet|erstellt|programmiert)|Webseite\s+(?:gestaltet|erstellt|programmiert)|Realisierung(?:\s+der\s+(?:Website|Webseite))?|Projektmanagement\s+f(?:ü|u)r\s+(?:Konzept|Konzeption|Design|Technik|Web|Website)|Webdesign|Konzeption|Grafik|Design|Agentur|Marketing|Programmierung)\b/im);
  if (izdelovalecIndex > 0) tekst = tekst.slice(0, izdelovalecIndex);
  var vrstice = tekst.split("\n").map(function (vrstica) { return vrstica.trim(); }).filter(Boolean);
  var naslovniIndexLokacije = vrstice.findIndex(function (vrstica) { return /\b\d{5}\s+[\p{L}]/u.test(vrstica); });
  var strukturiranaPoslovnaImena = izlociStrukturiranaPoslovnaImena(html);
  var primarniPoslovniNaziv = najdiPrimarniPoslovniNaziv(vrstice, naslovniIndexLokacije, vnos);
  if (!primarniPoslovniNaziv) {
    var domenskoIme = domenskiNaziv(sourceUrl);
    var strukturiraniKandidat = strukturiranaPoslovnaImena.map(function (ime) {
      return { ime: ime, ocena: oceniUjemanjePoslovnihNazivov(ime, domenskoIme) };
    }).filter(function (kandidat) {
      return !jeSplosnaOznakaPoslovnegaNaziva(kandidat.ime) &&
        (vsebujePoslovniOpis(kandidat.ime) || jeNazivPravneDruzbe(kandidat.ime)) && kandidat.ocena >= 0.34;
    }).sort(function (a, b) { return b.ocena - a.ocena; })[0];
    if (strukturiraniKandidat) primarniPoslovniNaziv = kanonicniPravniNaziv(strukturiraniKandidat.ime);
  }
  var lokacijaVrstica = naslovniIndexLokacije >= 0 ? vrstice[naslovniIndexLokacije] : "";
  var lokacija = lokacijaVrstica.match(/\b(\d{5})\s+([^,]{2,80})/u) || tekst.match(/\b(\d{5})\s+([^\n,]{2,80})/u);
  var naslovUlice = "";
  if (naslovniIndexLokacije >= 0) {
    var predPosto = lokacijaVrstica.replace(/\b\d{5}\b[\s\S]*$/, "").replace(/[,;]+$/, "").trim();
    var prejsnjaVrstica = vrstice[naslovniIndexLokacije - 1] || "";
    var kandidatNaslova = /\d/.test(predPosto) ? predPosto : prejsnjaVrstica;
    if (/\p{L}/u.test(kandidatNaslova) && /\d/.test(kandidatNaslova) && !/^\s*(?:telefon|tel\.?|fax|ust(?:\.?-?id)?|steuer|register|hr[ab]|iban)\b/i.test(kandidatNaslova)) {
      naslovUlice = kandidatNaslova.slice(0, 140).trim();
    }
  }
  var oznakaVloge = LEGAL_ROLE_LABEL_SOURCE;
  var vzorecVloge = new RegExp("(" + oznakaVloge + ")\\s*:?\\s*\\n?([^\\n]{0,180})", "gi");
  var nosilci = [];
  var pravneVloge = [];
  // Najprej obravnavamo nedvoumne oznake, ki sta na isti vidni vrstici kot
  // oseba. To ima prednost pred neoznačenimi kandidati iz navigacije,
  // certifikacijskih značk in piškotnih oken.
  vrstice.forEach(function (vrstica) {
    if (nosilci.length >= 6) return;
    var oznacenaOseba = vrstica.match(/^\s*((?:Gesch(?:ä|a)ftsf(?:ü|u)hrer(?:in)?|Gesch(?:ä|a)ftsf(?:ü|u)hrung|Betriebsinhaber(?:in)?|Firmeninhaber(?:in)?|Gesch(?:ä|a)ftsinhaber(?:in)?|Inhaber(?:in)?|Vorstand|Komplement(?:ä|a)r(?:in)?|Gesellschafter(?:in)?))\s*:\s*(.{2,180})$/i);
    if (!oznacenaOseba) return;
    oznacenaOseba[2].split(/\s*(?:;|\bund\b|\s&\s)\s*/i).forEach(function (suroviKandidat) {
      var kandidat = pocistiImeOsebe(suroviKandidat);
      if (!(jeVerjetnoImeOsebe(kandidat) || jeVerjetnoDaljseOznacenoImeOsebe(kandidat) ||
          jeVerjetnoPonovljenoOznacenoImeOsebe(kandidat)) ||
          nosilci.some(function (oseba) { return normaliziraj(oseba) === normaliziraj(kandidat); })) return;
      nosilci.push(kandidat);
      pravneVloge.push({ ime: kandidat, vloga: dolociPravnoVlogo(oznacenaOseba[1], oznacenaOseba[2]) });
    });
  });
  var ujemanjeVloge;
  while ((ujemanjeVloge = vzorecVloge.exec(tekst)) && nosilci.length < 6) {
    var suroviNosilci = [];
    var oznakaNajdeneVloge = ujemanjeVloge[1];
    var suroviKontekst = ujemanjeVloge[2];
    var ocisceniKontekst = pocistiKontekstPravneVloge(suroviKontekst);
    if (!ocisceniKontekst) ocisceniKontekst = naslednjiKandidatPravneVloge(tekst, vzorecVloge.lastIndex);
    ocisceniKontekst.split(/\s*(?:;|\bund\b|\s&\s)\s*/i).forEach(function (skupina) {
      var zVejico = skupina.split(/\s*,\s*/).filter(Boolean);
      var vejicaLocujeOsebe = zVejico.length > 1 && zVejico.every(function (del) {
        return pocistiImeOsebe(del).split(/\s+/).filter(Boolean).length >= 2;
      });
      Array.prototype.push.apply(suroviNosilci, vejicaLocujeOsebe ? zVejico : [skupina]);
    });
    for (var i = 0; i < suroviNosilci.length && nosilci.length < 6; i += 1) {
      var kandidat = pocistiImeOsebe(pocistiKontekstPravneVloge(suroviNosilci[i]));
      if ((jeVerjetnoImeOsebe(kandidat) || jeVerjetnoDaljseOznacenoImeOsebe(kandidat)) && !nosilci.some(function (oseba) {
        return normaliziraj(oseba) === normaliziraj(kandidat);
      })) {
        nosilci.push(kandidat);
        pravneVloge.push({ ime: kandidat, vloga: dolociPravnoVlogo(oznakaNajdeneVloge, suroviKontekst) });
      }
    }
    var naslednjeVrsticeVloge = String(tekst || "").slice(vzorecVloge.lastIndex).split("\n").slice(0, 4);
    for (var dodatniIndex = 0; dodatniIndex < naslednjeVrsticeVloge.length && nosilci.length < 6; dodatniIndex += 1) {
      var vrstica = naslednjeVrsticeVloge[dodatniIndex];
      var kandidat = pocistiImeOsebe(pocistiKontekstPravneVloge(vrstica));
      var veljavenKandidat = jeVerjetnoImeOsebe(kandidat) || jeVerjetnoDaljseOznacenoImeOsebe(kandidat);
      if (veljavenKandidat) {
        if (!nosilci.some(function (oseba) { return normaliziraj(oseba) === normaliziraj(kandidat); })) {
          nosilci.push(kandidat);
          pravneVloge.push({ ime: kandidat, vloga: dolociPravnoVlogo(oznakaNajdeneVloge, vrstica) });
        }
      } else if (String(vrstica || "").trim() && !/^\s*(?:\d+|[a-z])\s*[.)]\s+/i.test(vrstica)) {
        break;
      }
    }
  }

  if (!nosilci.length) {
    var povezanaOseba = vrstice.slice(0, naslovniIndexLokacije).map(razcleniOseboInPoslovniNaziv).find(Boolean);
    if (povezanaOseba) {
      nosilci.push(povezanaOseba.ime);
      pravneVloge.push({ ime: povezanaOseba.ime, vloga: "Neoznačena oseba", confidence: "primary_legal_block" });
    }
  }

  if (!nosilci.length) {
    var registriraniTrgovec = najdiNosilcaRegistriranegaTrgovca(vrstice);
    if (registriraniTrgovec) {
      nosilci.push(registriraniTrgovec.ime);
      pravneVloge.push(registriraniTrgovec);
    }
  }

  if (!nosilci.length) {
    var neoznacenaOseba = najdiNeoznacenoOseboPrimarnegaBloka(
      vrstice, naslovniIndexLokacije, strukturiranaPoslovnaImena, sourceUrl, primarniPoslovniNaziv
    );
    if (neoznacenaOseba) {
      nosilci.push(neoznacenaOseba);
      pravneVloge.push({ ime: neoznacenaOseba, vloga: "Neoznačena oseba", confidence: "low" });
    }
  }

  // Ta oznaka pogosto pomeni uredniško odgovorno osebo, zato je samo rezervni
  // kandidat. Končno identiteto mora še vedno potrditi register ali HWK.
  if (!nosilci.length) {
    var odgovornaOseba = tekst.match(/(?:Inhaltlich\s+verantwortlich|Verantwortlich\s+f(?:ĂĽ|u)r\s+den\s+Inhalt)\s*:?\s*\n?([^\n]{2,100})/i);
    if (odgovornaOseba && jeVerjetnoImeOsebe(odgovornaOseba[1])) {
      var odgovorni = pocistiImeOsebe(odgovornaOseba[1]);
      nosilci.push(odgovorni);
      pravneVloge.push({ ime: odgovorni, vloga: "Inhaltlich verantwortlich", confidence: "low" });
    }
  }

  var prviNaslovIndex = vrstice.findIndex(function (vrstica) { return /\b\d{5}\s+[\p{L}]/u.test(vrstica); });
  var pravneDruzbe = vrstice.map(function (vrstica, index) {
    if (!jeNazivPravneDruzbe(vrstica) || vrstica.length > 140) return null;
    // Primarna pravna oseba Impressuma je navedena v prvem identitetnem bloku
    // pred njenim naslovom. Družbe, navedene pozneje kot zavarovalnica,
    // ponudnik poravnave, spletna agencija ali drug partner, so tretje osebe.
    if (prviNaslovIndex >= 0 && index > prviNaslovIndex) return null;
    var kontekst = vrstice.slice(Math.max(0, index - 2), index + 1).join(" ");
    var izdelovalecStrani = /(?:Entwicklung(?:\s*\/\s*(?:IT|Webdesign))*|Realisierung|Webdesign|Webseite|Website|Konzeption|Konzept|Grafik|Design|Agentur|Werbeagentur|Marketing|Programmierung)/i.test(kontekst);
    if (izdelovalecStrani && (prviNaslovIndex < 0 || index > prviNaslovIndex)) return null;
    var razdaljaDoNosilca = nosilci.reduce(function (najmanjsa, nosilec) {
      var indeksNosilca = vrstice.findIndex(function (v) { return normaliziraj(v).includes(normaliziraj(nosilec)); });
      return indeksNosilca < 0 ? najmanjsa : Math.min(najmanjsa, Math.abs(index - indeksNosilca));
    }, 999);
    var ocena = (prviNaslovIndex >= 0 && index < prviNaslovIndex ? 100 : 0) + Math.max(0, 50 - razdaljaDoNosilca * 10);
    return { naziv: vrstica, ocena: ocena, index: index };
  }).filter(Boolean).sort(function (a, b) { return b.ocena - a.ocena; });
  // Pri kapitalski družbi je lahko pravna identiteta dovolj jasna tudi takrat,
  // ko Impressum direktorja ne navede ali uporablja naziva, ki ga ne poznamo.
  // Varovalka je stroga: pravni naziv mora biti pred naslovom, iz strani pa moramo
  // razbrati tako ulico kot pošto in kraj. Za samostojnega obrtnika osebno ime
  // ostaja obvezno, zato navigacija ali spletna agencija ne moreta postati nosilec.
  var popolnaPravnaDruzba = Boolean(
    pravneDruzbe.some(function (druzba) { return prviNaslovIndex > 0 && druzba.index < prviNaslovIndex; }) &&
    naslovUlice && lokacija
  );
  if (!nosilci.length && !popolnaPravnaDruzba) {
    return razcleniVidniImpressumTekst(tekst, sourceUrl, vnos);
  }
  var varniVneseniNaziv = jeSpletnoAliKontaktnoIme(vnos && vnos.ime) ? "" : String(vnos && vnos.ime || "").trim();
  var normaliziraniNosilec = normaliziraj(nosilci[0]);
  var vneseniNazivJePodprt = Boolean(varniVneseniNaziv && normaliziraj(varniVneseniNaziv) !== normaliziraniNosilec && (
    domenskiNaziv(sourceUrl) === normaliziraj(varniVneseniNaziv) ||
    strukturiranaPoslovnaImena.some(function (ime) {
      return normaliziraj(ime) === normaliziraj(varniVneseniNaziv);
    })
  ));
  // Pri samostojnem obrtniku je lahko v prvem naslovnem bloku najprej osebno
  // ime, poslovni naziv pa je že preverljivo podprt z domeno ali JSON-LD. Tak
  // naziv ohranimo samo kot naziv podjetja; nikoli ga ne uporabimo kot osebo.
  var primarniNazivJeSamoNosilec = primarniPoslovniNaziv && normaliziraj(primarniPoslovniNaziv) === normaliziraniNosilec;
  var nazivDruzbe = pravneDruzbe.length
    ? pravneDruzbe[0].naziv
    : (primarniNazivJeSamoNosilec && vneseniNazivJePodprt
      ? varniVneseniNaziv
      : (primarniPoslovniNaziv || (vneseniNazivJePodprt ? varniVneseniNaziv : "") || nosilci[0]));
  nazivDruzbe = kanonicniPravniNaziv(nazivDruzbe);
  if (!jeNazivPravneDruzbe(nazivDruzbe) && jeSplosnaOznakaPoslovnegaNaziva(nazivDruzbe)) {
    var rezervniDomenskiNaziv = domenskiNaziv(sourceUrl);
    var rezervniStrukturiraniNaziv = strukturiranaPoslovnaImena.map(function (ime) {
      return { ime: ime, ocena: oceniUjemanjePoslovnihNazivov(ime, rezervniDomenskiNaziv) };
    }).filter(function (kandidat) {
      return !jeSplosnaOznakaPoslovnegaNaziva(kandidat.ime) && kandidat.ocena >= 0.34;
    }).sort(function (a, b) { return b.ocena - a.ocena; })[0];
    nazivDruzbe = rezervniStrukturiraniNaziv
      ? kanonicniPravniNaziv(rezervniStrukturiraniNaziv.ime)
      : (vneseniNazivJePodprt ? kanonicniPravniNaziv(varniVneseniNaziv) : nosilci[0]);
  }
  var register = najdiRegistrskiVnos(tekst);
  var registergericht = tekst.match(/(?:Registergericht|Amtsgericht)\s*:?\s*([^\n]{2,100})/i);
  if (!registergericht) registergericht = tekst.match(/Handelsregister\s*:?[ \t]*(?:Amtsgericht\s+)?([^\n]{2,80}?)\s+(?:HR[AB]|GnR|PR|VR)\b/i);
  var ustId = tekst.match(/\b(?:USt\.?-?IdNr\.?|Umsatzsteuer(?:-|\s*)Identifikationsnummer)\s*:?\s*(DE\s*\d{9})\b/i);
  var email = tekst.match(/\b(?:E-?Mail)\s*:?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i);
  var telefon = tekst.match(/\b(?:Telefon|Tel\.?)\s*:?\s*(\+?[\d][\d\s()/.-]{5,}\d)/i);
  return {
    ime: nosilci[0] || nazivDruzbe,
    naziv: nazivDruzbe,
    entityType: jeNazivPravneDruzbe(nazivDruzbe) ? "company" : (nosilci.length ? "person" : "unknown"),
    nosilec: nosilci[0] || "",
    zastopniki: nosilci,
    vloge: pravneVloge,
    businessIdentityNames: strukturiranaPoslovnaImena.concat(
      nazivDruzbe && normaliziraj(nazivDruzbe) !== normaliziraj(nosilci[0]) ? [nazivDruzbe] : []
    ).filter(function (ime, index, seznam) {
      return ime && seznam.findIndex(function (drugo) {
        return normaliziraj(drugo) === normaliziraj(ime);
      }) === index;
    }),
    legalEntityWithoutRepresentative: Boolean(!nosilci.length && popolnaPravnaDruzba),
    naslov: pocistiNaslovUlice(naslovUlice),
    postnaStevilka: lokacija ? lokacija[1] : vnos.postnaStevilka,
    kraj: lokacija ? pocistiKrajIzPravneVrstice(lokacija[2]) : vnos.kraj,
    registerNumber: register ? register.formatted : "",
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
    var oznakaImpressuma = /(?:impressum|imprint|anbieterkennzeichnung|anbieterkennung)/i;
    if (!oznakaImpressuma.test(oznaka) && !oznakaImpressuma.test(ujemanje[1])) continue;
    try {
      var povezava = new URL(decodeHtml(ujemanje[1]), osnovni);
      if (/^https?:$/.test(povezava.protocol) && !rezultat.includes(povezava.toString())) {
        rezultat.push(povezava.toString());
      }
    } catch (_) {}
  }
  return rezultat;
}

function najdiOznacenePravnePovezave(html, sourceUrl) {
  var rezultat = [];
  var vzorec = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var osnovni = new URL(sourceUrl);
  var ujemanje;
  while ((ujemanje = vzorec.exec(String(html || ""))) && rezultat.length < 3) {
    var oznaka = besediloIzHtml(ujemanje[2]).replace(/\s+/g, " ").trim();
    var povezava;
    try { povezava = new URL(decodeHtml(ujemanje[1]), osnovni); } catch (_) { continue; }
    var zadnjiDelPoti = decodeURIComponent(povezava.pathname.split("/").filter(Boolean).pop() || "").replace(/[-_]+/g, " ");
    if (!LEGAL_POLICY_LINK_PATTERN.test(oznaka) && !LEGAL_POLICY_LINK_PATTERN.test(zadnjiDelPoti)) continue;
    if (/^https?:$/.test(povezava.protocol) && !rezultat.includes(povezava.toString())) rezultat.push(povezava.toString());
  }
  return rezultat;
}

function jeImpressumDokument(html, sourceUrl) {
  var url;
  try { url = new URL(sourceUrl); } catch (_) { return false; }
  if (/\b(?:impressum|imprint|anbieterkennzeichnung|anbieterkennung)\b/i.test(url.pathname)) return true;
  if (jeVgrajenImpressumDokument(html)) return true;
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

function jeVgrajenImpressumDokument(html) {
  var surovo = String(html || "");
  var teloUjemanje = surovo.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  var telo = teloUjemanje ? teloUjemanje[1] : surovo;
  // Zahtevamo pravi naslov razdelka v bodyju. Omemba v navigaciji, nogi,
  // metapodatkih ali marketinškem besedilu sama po sebi ni dovolj.
  var imaNaslov = /<(?:h1|h2|h3)\b[^>]*>[\s\S]{0,400}?\b(?:Impressum|Imprint|Anbieterkennzeichnung|Anbieterkennung)\b[\s\S]{0,400}?<\/(?:h1|h2|h3)>/i.test(telo);
  if (!imaNaslov) return false;

  var pravniBlok = izlociPravniImpressumBlok(telo);
  var strukturiran = pravniBlok.replace(/<\/(?:h[1-6]|p|div|li|section|article|address|td|dd)>/gi, "$&\n");
  var besedilo = besediloIzHtml(strukturiran).normalize("NFC").replace(/\s*\n\s*/g, "\n");
  var vrstice = besedilo.split("\n").map(function (vrstica) { return vrstica.replace(/\s+/g, " ").trim(); }).filter(Boolean);
  var imaUlico = vrstice.some(function (vrstica) {
    return /\p{L}.{0,90}\d+[a-z]?\b/iu.test(vrstica) && !/^D?-?\s*\d{5}\b/i.test(vrstica) &&
      !/^(?:Telefon|Tel\.?|Fax|USt|Steuer|HR[AB]|GnR|PR|VR)\b/i.test(vrstica);
  });
  var imaIdentiteto = jeNazivPravneDruzbe(besedilo) || new RegExp(LEGAL_ROLE_LABEL_SOURCE, "i").test(besedilo);
  return GERMAN_POSTAL_CITY_PATTERN.test(besedilo) && imaUlico && imaIdentiteto && LEGAL_IMPRESSUM_DATA_PATTERN.test(besedilo);
}

function jeOznacenaPravnaIdentitetnaStran(html, sourceUrl) {
  var besedilo = besediloIzHtml(String(html || "").replace(/<\/(?:h[1-6]|p|div|li|section|article|address|td|dd)>/gi, "$&\n"));
  var zadnjiDelPoti = normalizirajPotUrlja(sourceUrl).split("/").filter(Boolean).pop() || "";
  var jeOznacenaPravnaPot = LEGAL_POLICY_LINK_PATTERN.test(decodeURIComponent(zadnjiDelPoti).replace(/[-_]+/g, " "));
  return jeOznacenaPravnaPot && LEGAL_PROVIDER_IDENTITY_PATTERN.test(besedilo) &&
    LEGAL_IMPRESSUM_DATA_PATTERN.test(besedilo) && GERMAN_POSTAL_CITY_PATTERN.test(besedilo);
}

function jePravniIdentitetniDokument(html, sourceUrl) {
  return jeImpressumDokument(html, sourceUrl) || jeOznacenaPravnaIdentitetnaStran(html, sourceUrl);
}

function jePravnaImpressumVsebina(oznake, besedilo, obvezniPojmi, zahtevajPravnePodatke) {
  var vidnoBesedilo = String(besedilo || "");
  var imaPravnoOznako = IMPRESSUM_HEADING_PATTERN.test(String(oznake || "")) ||
    LEGAL_PROVIDER_IDENTITY_PATTERN.test(vidnoBesedilo);
  var zahtevani = (Array.isArray(obvezniPojmi) ? obvezniPojmi : [])
    .map(function (pojem) { return normaliziraj(pojem); })
    .filter(Boolean);
  // Samostojni obrtniki imajo lahko povsem veljaven Impressum brez fraze
  // »Angaben gemäß« ali označene vloge »Inhaber«. V tem primeru pravno stran
  // potrdimo samo, kadar so v njej hkrati vidni vsi že razbrani identitetni
  // podatki (oseba, ulica, PLZ in kraj). S tem ne ugibamo nove identitete.
  var normaliziranoBesedilo = normaliziraj(vidnoBesedilo);
  var imaNatancenIdentitetniBlok = zahtevani.length >= 3 && zahtevani.every(function (pojem) {
    return normaliziranoBesedilo.includes(pojem);
  });
  var imaPravnePodatke = LEGAL_IMPRESSUM_DATA_PATTERN.test(vidnoBesedilo);
  return imaPravnoOznako && GERMAN_POSTAL_CITY_PATTERN.test(vidnoBesedilo) &&
    (imaPravnePodatke || (!zahtevajPravnePodatke && imaNatancenIdentitetniBlok));
}

function razlogNapakeBranjaSpletneStrani(koda) {
  var vrednost = String(koda || "");
  if (/WEBSITE_(?:INVALID|NOT_PUBLIC)/.test(vrednost)) return "website_not_public";
  if (/WEBSITE_(?:REDIRECT_FAILED|TOO_MANY_REDIRECTS)/.test(vrednost)) return "website_redirect_failed";
  if (/WEBSITE_NOT_HTML/.test(vrednost)) return "website_not_html";
  if (/WEBSITE_TOO_LARGE/.test(vrednost)) return "website_too_large";
  if (/WEBSITE_SERVER_ERROR_\d{3}/.test(vrednost)) return "website_server_error";
  if (/WEBSITE_RATE_LIMITED_429/.test(vrednost)) return "website_rate_limited";
  return "website_unreachable";
}

function httpStatusNapakeSpletneStrani(koda) {
  var ujemanje = String(koda || "").match(/WEBSITE_(?:SERVER_ERROR|RATE_LIMITED)_(\d{3})/);
  return ujemanje ? Number(ujemanje[1]) : 0;
}

function normalizirajGostitelja(vrednost) {
  try { return new URL(vrednost).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, ""); }
  catch (_) { return ""; }
}

function normalizirajPotUrlja(vrednost) {
  try {
    var pot = new URL(vrednost).pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
    return pot || "/";
  } catch (_) { return ""; }
}

function jeOcitenPravniUrl(vrednost) {
  var pot = normalizirajPotUrlja(vrednost);
  return /(?:^|\/)(?:impressum|imprint|anbieterkennzeichnung|anbieterkennung)(?:[._/-]|$)/i.test(pot);
}

function dolociPravniKontekst(vrednost) {
  var url = new URL(vrednost);
  var deli = url.pathname.split("/").filter(Boolean);
  var neposredniPravniUrl = jeOcitenPravniUrl(url.toString());
  var splosniSegmenti = new Set([
    "de", "en", "home", "start", "startseite", "kontakt", "contact", "ueber-uns", "uber-uns",
    "about", "firma", "unternehmen", "team", "leistungen", "service", "news", "blog", "aktuell",
    "legal", "rechtliches", "datenschutz", "privacy",
  ]);
  var prviSegment = String(deli[0] || "").toLowerCase().replace(/_/g, "-");
  var imeniskePoti = new Set([
    "firmenprofil", "firmenprofile", "firmenverzeichnis", "branchenbuch", "anbieterprofil",
    "company-profile", "company-profiles", "companies", "business-profile", "businesses",
    "listing", "listings", "profile", "profiles",
  ]);
  var imeninskiProfil = !neposredniPravniUrl && deli.length >= 2 && imeniskePoti.has(prviSegment);
  // /index.html, /start.php in podobno so dokumenti v korenu strani, ne
  // imeniki oziroma ločene poslovalnice. Njihov Impressum je lahko sosednja
  // datoteka (tudi z drugačno velikostjo črk), npr. /Impressum.html.
  var korenskiDokument = !neposredniPravniUrl && deli.length === 1 && /\.[a-z0-9]{1,8}$/i.test(deli[0]);
  var najemniskaPot = "";
  if (neposredniPravniUrl && deli.length > 1) {
    najemniskaPot = "/" + deli.slice(0, -1).join("/") + "/";
  } else if (imeninskiProfil) {
    najemniskaPot = normalizirajPotUrlja(url.toString()) + "/";
  } else if (!neposredniPravniUrl && !korenskiDokument && prviSegment && !splosniSegmenti.has(prviSegment)) {
    najemniskaPot = "/" + deli[0] + "/";
  }
  return {
    vhodniUrl: url.toString(),
    gostitelj: normalizirajGostitelja(url.toString()),
    vhodnaPot: normalizirajPotUrlja(url.toString()),
    neposredniPravniUrl: neposredniPravniUrl,
    imeninskiProfil: imeninskiProfil,
    korenskiDokument: korenskiDokument,
    najemniskaPot: najemniskaPot,
  };
}

function jeUrlVPravnemKontekstu(vrednost, kontekst) {
  if (!kontekst) return true;
  if (normalizirajGostitelja(vrednost) !== kontekst.gostitelj) return !kontekst.najemniskaPot && !kontekst.neposredniPravniUrl;
  var pot = normalizirajPotUrlja(vrednost);
  if (kontekst.neposredniPravniUrl) return pot === kontekst.vhodnaPot;
  if (kontekst.najemniskaPot) return (pot + "/").startsWith(kontekst.najemniskaPot);
  return true;
}

function sestaviZacetneImpressumPoti(osnova, kontekst) {
  // Na javnih imenikih je naslednji segment druga profilna kartica, ne pravna
  // podstran trenutnega podjetja. Zato nikoli ne ugibamo sorodnega
  // /firmenprofil/impressum; dovolimo le vhodni profil in izrecno povezane
  // pravne podstrani znotraj istega profilnega zapisa.
  if (kontekst.neposredniPravniUrl || kontekst.imeninskiProfil) return [osnova];
  var koren = kontekst.najemniskaPot ? new URL(kontekst.najemniskaPot, osnova.origin) : new URL("/", osnova.origin);
  return [
    osnova,
    new URL("impressum", koren),
    new URL("impressum.html", koren),
    new URL("imprint", koren),
    new URL("anbieterkennzeichnung", koren),
    new URL("kontakt/impressum", koren),
    new URL("legal/impressum", koren),
  ];
}

function razlogNeujemanjaIdentiteteZVnosom(subjekt, vnos) {
  if (vnos.postnaStevilka && subjekt.postnaStevilka && String(vnos.postnaStevilka) !== String(subjekt.postnaStevilka)) return "entered_postal_context_mismatch";
  if (vnos.kraj && subjekt.kraj && normaliziraj(vnos.kraj) !== normaliziraj(subjekt.kraj)) return "entered_city_context_mismatch";
  if (vnos.naslov && subjekt.naslov && normalizirajNaslov(vnos.naslov) !== normalizirajNaslov(subjekt.naslov)) return "entered_street_context_mismatch";
  var vhodniGostitelj = normalizirajGostitelja(vnos && vnos.spletnaStran);
  var izvorniGostitelj = normalizirajGostitelja(subjekt && subjekt.sourceUrl);
  if (vhodniGostitelj && izvorniGostitelj && vhodniGostitelj !== izvorniGostitelj) {
    var iskaniNaziv = jeSpletnoAliKontaktnoIme(vnos && vnos.ime) ? "" : normaliziraj(vnos && vnos.ime);
    if (!iskaniNaziv) iskaniNaziv = domenskiNaziv(vnos && vnos.spletnaStran);
    var imenaSubjekta = [subjekt && subjekt.naziv, subjekt && subjekt.ime, subjekt && subjekt.nosilec]
      .concat(subjekt && subjekt.businessIdentityNames || []).map(normaliziraj).filter(Boolean);
    var nazivnoUjemanje = Boolean(iskaniNaziv && imenaSubjekta.some(function (ime) {
      var strnjenoIme = ime.replace(/\s+/g, "");
      var strnjenIskaniNaziv = iskaniNaziv.replace(/\s+/g, "");
      return ime === iskaniNaziv || (Math.min(strnjenoIme.length, strnjenIskaniNaziv.length) >= 5 &&
        (strnjenoIme.includes(strnjenIskaniNaziv) || strnjenIskaniNaziv.includes(strnjenoIme)));
    }));
    if (!nazivnoUjemanje) return "legal_source_context_mismatch";
  }
  return "";
}

function imaPopolnoImpressumIdentiteto(subjekt) {
  return Boolean(subjekt && (subjekt.ime || subjekt.naziv) && subjekt.naslov && /\d/.test(subjekt.naslov) &&
    /^\d{5}$/.test(String(subjekt.postnaStevilka || "")) && String(subjekt.kraj || "").trim().length >= 2);
}

async function poisciVImpressumu(vnos) {
  if (!vnos.spletnaStran) return { status: "not_provided" };
  try {
    var osnova = await preveriJavniSpletniNaslov(vnos.spletnaStran);
    var pravniKontekst = dolociPravniKontekst(osnova);
    var poti = sestaviZacetneImpressumPoti(osnova, pravniKontekst);
    var obiskane = new Set();
    var najdenImpressumBrezNosilca = "";
    var razlogNepopolnegaImpressuma = "";
    var uspesnoPrebrane = 0;
    var napakeBranja = [];
    var razlogNapakeKonteksta = "";
    for (var i = 0; i < poti.length && obiskane.size < 12; i += 1) {
      var cilj = poti[i].toString();
      if (obiskane.has(cilj)) continue;
      obiskane.add(cilj);
      try {
        var stran = await fetchJavniHtml(cilj);
        uspesnoPrebrane += 1;
        if (!jeUrlVPravnemKontekstu(stran.url, pravniKontekst)) {
          razlogNapakeKonteksta = "legal_source_context_mismatch";
          continue;
        }
        var noveImpressumPovezave = najdiImpressumPovezave(stran.html, stran.url).filter(function (povezava) {
          return !obiskane.has(povezava) && jeUrlVPravnemKontekstu(povezava, pravniKontekst);
        });
        noveImpressumPovezave.forEach(function (povezava) {
          poti.splice(i + 1, 0, povezava);
        });
        if (!noveImpressumPovezave.length) {
          najdiOznacenePravnePovezave(stran.html, stran.url).filter(function (povezava) {
            return !obiskane.has(povezava) && jeUrlVPravnemKontekstu(povezava, pravniKontekst);
          }).forEach(function (povezava) { poti.splice(i + 1, 0, povezava); });
        }
        var jeImpressum = jePravniIdentitetniDokument(stran.html, stran.url);
        var subjekt = jeImpressum ? razcleniImpressum(stran.html, stran.url, vnos) : null;
        if (subjekt) {
          subjekt.sourceKind = jeImpressumDokument(stran.html, stran.url) ? "impressum" : "labelled_provider_page";
          if (!imaPopolnoImpressumIdentiteto(subjekt)) {
            najdenImpressumBrezNosilca = stran.url;
            razlogNepopolnegaImpressuma = "legal_identity_incomplete";
            continue;
          }
          var neujemanjeVnosa = razlogNeujemanjaIdentiteteZVnosom(subjekt, vnos);
          if (neujemanjeVnosa) {
            razlogNapakeKonteksta = neujemanjeVnosa;
            continue;
          }
          return { status: "found", subjekt: subjekt, sourceUrl: stran.url };
        }
        if (jeImpressum) {
          najdenImpressumBrezNosilca = stran.url;
          razlogNepopolnegaImpressuma = jeNazivPravneDruzbe(besediloIzHtml(stran.html))
            ? "legal_identity_incomplete"
            : "holder_not_reliably_identified";
        }
      } catch (napakaBranja) {
        var kodaNapakeBranja = String(napakaBranja && (napakaBranja.message || napakaBranja.name) || "WEBSITE_FETCH_FAILED");
        napakeBranja.push(kodaNapakeBranja);
        // 429 pomeni izrecno omejitev, ponavljanje po drugih poteh bi jo kršilo.
        // Pri 5xx preverimo še eno običajno pot do Impressuma, nato odnehamo,
        // da večja čakalna vrsta ne pomnoži izpada tujega strežnika.
        if (/WEBSITE_RATE_LIMITED_429/.test(kodaNapakeBranja)) break;
        if (napakeBranja.filter(function (koda) { return /WEBSITE_SERVER_ERROR_\d{3}/.test(koda); }).length >= 2) break;
      }
    }
    if (!uspesnoPrebrane) {
      var brskalniskiRezultat = await poisciImpressumZBrskalnikom(poti.slice(0, 2).map(String), vnos, pravniKontekst);
      if (brskalniskiRezultat && imaPopolnoImpressumIdentiteto(brskalniskiRezultat.subjekt) &&
          !razlogNeujemanjaIdentiteteZVnosom(brskalniskiRezultat.subjekt, vnos)) return brskalniskiRezultat;
      var prvaNapaka = napakeBranja[0] || "WEBSITE_FETCH_FAILED";
      return {
        status: "unavailable",
        reason: razlogNapakeBranjaSpletneStrani(prvaNapaka),
        httpStatus: httpStatusNapakeSpletneStrani(prvaNapaka),
        attempts: napakeBranja.length,
        sourceUrl: osnova.toString(),
      };
    }
    // Tudi začetna stran je lahko dejanski pravni dokument: pri dinamičnih
    // straneh je Impressum vgrajen v domačo stran in ga razkrije šele brskalnik.
    var fallbackUrlji = [najdenImpressumBrezNosilca, osnova.toString()].concat(poti.filter(function (pot) { return jeOcitenPravniUrl(pot); }).map(String)).filter(Boolean);
    var fallbackRezultat = await poisciImpressumZBrskalnikom(Array.from(new Set(fallbackUrlji)).slice(0, 2), vnos, pravniKontekst);
    if (fallbackRezultat && imaPopolnoImpressumIdentiteto(fallbackRezultat.subjekt) &&
        !razlogNeujemanjaIdentiteteZVnosom(fallbackRezultat.subjekt, vnos)) return fallbackRezultat;
    return {
      status: "not_found",
      reason: razlogNapakeKonteksta || (najdenImpressumBrezNosilca ? razlogNepopolnegaImpressuma : "impressum_not_found"),
      sourceUrl: najdenImpressumBrezNosilca || osnova.toString(),
    };
  } catch (napaka) {
    var koda = String(napaka && (napaka.message || napaka.name) || "");
    return {
      status: "unavailable",
      reason: razlogNapakeBranjaSpletneStrani(koda),
      httpStatus: httpStatusNapakeSpletneStrani(koda),
      sourceUrl: String(vnos.spletnaStran || ""),
    };
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

function razcleniOpenRegisterReferenco(vnos) {
  var izImena = razcleniOpenRegisterVnos(vnos && vnos.ime);
  if (izImena.companyId || izImena.registerNumber) return izImena;
  return razcleniOpenRegisterVnos(vnos && vnos.registerNumber);
}

function pocistiRegistrskoSodisce(vrednost) {
  return String(vrednost || "")
    .replace(/^\s*(?:Amtsgericht|Registergericht|AG)\s*:?\s*/i, "")
    .replace(/\s*[,;\-]?\s*\b(?:HRA|HRB|PR|GNR|VR)\s*[- ]?\s*\d+\b.*$/i, "")
    .trim();
}

function oceniOpenRegisterZadetek(kandidat, vnos) {
  var register = razcleniOpenRegisterReferenco(vnos);
  if (register.companyId && String(kandidat && kandidat.company_id || "").toUpperCase() === register.companyId) return 500;
  var iskanoSodisce = normaliziraj(pocistiRegistrskoSodisce(vnos && vnos.registerCourt));
  var najdenoSodisce = normaliziraj(pocistiRegistrskoSodisce(kandidat && kandidat.register_court));
  var iskano = normaliziraj(vnos.ime);
  var najdeno = normaliziraj(kandidat && kandidat.name);
  var lokacijskeTocke = 0;
  var naslov = kandidat && kandidat.address || {};
  if (vnos.postnaStevilka && String(naslov.postal_code || "") === vnos.postnaStevilka) lokacijskeTocke += 80;
  if (vnos.kraj && normaliziraj(naslov.city) === normaliziraj(vnos.kraj)) lokacijskeTocke += 30;
  var popolnoRegistrskoUjemanje = register.registerNumber && String(kandidat && kandidat.register_number || "") === register.registerNumber &&
    (!register.registerType || String(kandidat && kandidat.register_type || "").toUpperCase() === register.registerType.toUpperCase());
  if (popolnoRegistrskoUjemanje) {
    var sodisceSeUjema = !iskanoSodisce || !najdenoSodisce || iskanoSodisce === najdenoSodisce;
    var nazivSeUjema = Boolean(iskano && najdeno && (iskano === najdeno || najdeno.includes(iskano) || iskano.includes(najdeno)));
    // Prepis sodišča iz Impressuma je lahko tipkarsko napačen. Točnega registra
    // ne zavrnemo, kadar ga neodvisno potrdita naziv ali lokacija; uradno ime
    // sodišča nato vedno prevzamemo iz OpenRegisterja.
    if (sodisceSeUjema) return iskanoSodisce && najdenoSodisce ? 500 : 450;
    return nazivSeUjema || lokacijskeTocke >= 80 ? 440 + lokacijskeTocke : 0;
  }
  if (!iskano || !najdeno) return 0;
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

function razlogOpenRegisterIdentitetneNapake(status) {
  if (status === 401 || status === 403) return "not_configured";
  if (status === 402) return "insufficient_credits";
  if (status === 429) return "rate_limited";
  return "api_error";
}

function sestaviOpenRegisterIskalniUrl(vnos) {
  var url = new URL(OPENREGISTER_SEARCH);
  var register = razcleniOpenRegisterReferenco(vnos);
  if (register.registerNumber) {
    url.searchParams.set("register_number", register.registerNumber);
    if (register.registerType) url.searchParams.set("register_type", register.registerType);
    // Registrsko sodišče iz Impressuma je le podatek za primerjavo, nikoli
    // začetni filter. Ista številka se lahko ponovi pri več sodiščih, zato vse
    // kandidate razločimo z uradnim nazivom in celotno lokacijo.
  } else {
    url.searchParams.set("query", vnos.ime);
  }
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "50");
  return url;
}

async function poisciOpenRegister(vnos) {
  var kljuc = String(process.env.OPENREGISTER_API_KEY || "").trim();
  if (!kljuc) return { status: "not_configured", sourceUrl: OPENREGISTER_WEB };
  try {
    var url = sestaviOpenRegisterIskalniUrl(vnos);
    var odgovor = await fetchZRokom(url, {
      headers: { Authorization: "Bearer " + kljuc, Accept: "application/json", "User-Agent": USER_AGENT },
    }, 12000);
    if (odgovor.status === 401 || odgovor.status === 403) return { status: "not_configured", reason: "not_configured", httpStatus: odgovor.status, sourceUrl: OPENREGISTER_WEB };
    if (!odgovor.ok) return {
      status: "unavailable", reason: razlogOpenRegisterIdentitetneNapake(odgovor.status),
      httpStatus: odgovor.status, sourceUrl: OPENREGISTER_WEB,
    };
    var podatki = await odgovor.json();
    var izbor = izberiOpenRegisterZadetek(podatki.results, vnos);
    var sourceUrl = izbor.status === "found" && izbor.company && izbor.company.company_id
      ? OPENREGISTER_WEB + "/company/" + encodeURIComponent(izbor.company.company_id)
      : OPENREGISTER_WEB;
    return Object.assign({ sourceUrl: sourceUrl, queryUrl: url.toString() }, izbor);
  } catch (_) {
    return { status: "unavailable", reason: "network_error", sourceUrl: OPENREGISTER_WEB };
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
  rezultat.fallbackUrl = HWK_MANUAL_FALLBACK_OVERRIDES[kljuc] || "";
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

function sestaviHwkIskalniUrl(vnos, iskalnik) {
  if (!iskalnik || iskalnik.type !== "odav" || !iskalnik.searchUrl) return "";
  var iskalniUrlObjekt = new URL(iskalnik.searchUrl);
  iskalniUrlObjekt.hash = "";
  iskalniUrlObjekt.searchParams.set("limit", "20");
  iskalniUrlObjekt.searchParams.set("search-searchterm", vnos.ime);
  iskalniUrlObjekt.searchParams.set("search-local", "0");
  iskalniUrlObjekt.searchParams.set("search-filter-zipcode", vnos.postnaStevilka);
  iskalniUrlObjekt.searchParams.set("search-filter-radius", "20");
  iskalniUrlObjekt.searchParams.set("offset", "0");
  return iskalniUrlObjekt.toString();
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
  var iskalniUrl = sestaviHwkIskalniUrl(vnos, iskalnik);
  var skupniPodatki = {
    searchUrl: iskalniUrl,
    searchedName: vnos.ime,
    chamberName: zbornica && zbornica.name || iskalnik.chamberName || "",
    chamberUrl: zbornica && (zbornica.homepage || zbornica.infoUrl) || iskalnik.chamberUrl || "",
  };
  function nedosegljivSamodejniVir(razlog) {
    if (iskalnik.fallbackUrl) {
      return Object.assign({
        status: "manual_available",
        reason: "official_search_requires_security_code",
        searchUrl: iskalnik.fallbackUrl,
        automatedSearchUrl: iskalniUrl,
        failedReason: razlog,
      }, skupniPodatki, { searchUrl: iskalnik.fallbackUrl });
    }
    return Object.assign({ status: "unavailable", reason: razlog }, skupniPodatki);
  }
  var odgovor;
  try {
    odgovor = await fetchZRokom(iskalniUrl, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  } catch (_) {
    return nedosegljivSamodejniVir("timeout_or_blocked");
  }
  if (!odgovor.ok) return nedosegljivSamodejniVir("source_http_error");
  var html = await odgovor.text();
  var izbor = izberiHwkZadetek(razcleniHwkRezultate(html, iskalniUrl), vnos);
  if (izbor.status !== "found") return Object.assign({}, skupniPodatki, izbor);

  var detail;
  try {
    detail = await fetchZRokom(izbor.kandidat.url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
  } catch (_) {
    return nedosegljivSamodejniVir("detail_timeout_or_blocked");
  }
  if (!detail.ok) return nedosegljivSamodejniVir("detail_http_error");
  return Object.assign({}, skupniPodatki, {
    status: "found",
    kandidat: izbor.kandidat,
    subjekt: razcleniHwkPodrobnosti(await detail.text(), izbor.kandidat.url),
  });
}

function sestaviHwkIskanja(vnos, javniProfil) {
  var iskanja = [Object.assign({}, vnos)];
  var nosilec = javniProfil && javniProfil.status === "found" && javniProfil.subjekt
    ? pocistiImeOsebe(String(javniProfil.subjekt.ime || "").trim())
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

function jeRegistriraniTrgovecOpenRegister(podjetje) {
  var opis = [
    podjetje && podjetje.name,
    podjetje && podjetje.legal_form,
    podjetje && podjetje.legal_form_label,
  ].filter(Boolean).join(" ");
  return /\be\.?\s*k\.?\b|eingetragene[rsn]?\s+kauf(?:mann|frau)|einzelkauf(?:mann|frau)/i.test(opis);
}

function potrebujeImpressumDopolnitev(openregister, vnos) {
  return Boolean(
    vnos && vnos.spletnaStran &&
    openregister && openregister.status === "found" &&
    jeRegistriraniTrgovecOpenRegister(openregister.company)
  );
}

function normalizirajNaslovZaDopolnitev(vrednost) {
  return normalizirajNaslov(vrednost).replace(/(\d)\s+([a-z])\b/g, "$1$2");
}

function normalizirajKrajZaDopolnitev(vrednost) {
  return normaliziraj(String(vrednost || "").replace(/\s*\([^)]*\)\s*/g, " "));
}

function preveriImpressumDopolnitevRegistriranegaTrgovca(openregister, javniProfil) {
  if (!openregister || openregister.status !== "found" || !jeRegistriraniTrgovecOpenRegister(openregister.company)) {
    return { matched: false, reason: "not_registered_merchant" };
  }
  var subjekt = javniProfil && javniProfil.status === "found" && javniProfil.subjekt;
  var nosilec = subjekt && pocistiImeOsebe(subjekt.nosilec || subjekt.ime);
  if (!subjekt || !jeVerjetnoImeOsebe(nosilec)) return { matched: false, reason: "representative_missing" };

  var uradniNaslov = openregister.company.address || {};
  var postaSeUjema = Boolean(uradniNaslov.postal_code && subjekt.postnaStevilka) &&
    String(uradniNaslov.postal_code) === String(subjekt.postnaStevilka);
  var ulicaSeUjema = Boolean(uradniNaslov.street && subjekt.naslov) &&
    normalizirajNaslovZaDopolnitev(uradniNaslov.street) === normalizirajNaslovZaDopolnitev(subjekt.naslov);
  var krajSeUjema = Boolean(uradniNaslov.city && subjekt.kraj) &&
    normalizirajKrajZaDopolnitev(uradniNaslov.city) === normalizirajKrajZaDopolnitev(subjekt.kraj);
  if (!postaSeUjema || !ulicaSeUjema || !krajSeUjema) {
    return { matched: false, reason: "official_address_mismatch" };
  }

  var mocnaPravnaVloga = Array.isArray(subjekt.vloge) && subjekt.vloge.some(function (vloga) {
    return normaliziraj(vloga && vloga.ime) === normaliziraj(nosilec) &&
      !/^(?:Neoznačena oseba|Inhaltlich verantwortlich)$/i.test(String(vloga && vloga.vloga || ""));
  });
  var nosilecVRegistrskemImenu = normaliziraj(openregister.company.name).indexOf(normaliziraj(nosilec)) >= 0;
  if (!mocnaPravnaVloga && !nosilecVRegistrskemImenu) {
    return { matched: false, reason: "representative_not_linked_to_registered_identity" };
  }
  return { matched: true, representative: nosilec };
}

function sestaviIdentiteto(openregister, hwk, javniProfil, vnos) {
  if (openregister && openregister.status === "found" && openregister.company) {
    var podjetje = openregister.company;
    var naslov = podjetje.address || {};
    var registrskaIdentiteta = {
      status: "verified_register",
      confidence: "high",
      entityType: "company",
      ime: podjetje.name,
      naziv: podjetje.name,
      naslov: naslov.street || "",
      postnaStevilka: naslov.postal_code || "",
      kraj: naslov.city || "",
      companyId: podjetje.company_id || "",
      legalForm: podjetje.legal_form || "",
      registerNumber: [podjetje.register_type, podjetje.register_number].filter(Boolean).join(" "),
      registerCourt: podjetje.register_court || "",
      registerCourtSource: "openregister_verified",
      active: podjetje.active !== false,
      source: "openregister",
      openRegisterIdentity: {
        status: "verified_api",
        companyId: podjetje.company_id || "",
        name: podjetje.name || "",
        street: naslov.street || "",
        postalCode: naslov.postal_code || "",
        city: naslov.city || "",
        legalForm: podjetje.legal_form || "",
        registerNumber: [podjetje.register_type, podjetje.register_number].filter(Boolean).join(" "),
        registerCourt: podjetje.register_court || "",
      },
    };
    var dopolnitev = preveriImpressumDopolnitevRegistriranegaTrgovca(openregister, javniProfil);
    if (dopolnitev.matched) {
      var impressumSubjekt = javniProfil.subjekt;
      registrskaIdentiteta.nosilec = dopolnitev.representative;
      registrskaIdentiteta.zastopniki = [dopolnitev.representative];
      registrskaIdentiteta.vloge = (impressumSubjekt.vloge || []).map(function (vloga) {
        return Object.assign({}, vloga, { ime: pocistiImeOsebe(vloga && vloga.ime) });
      }).filter(function (vloga) { return vloga.ime; });
      registrskaIdentiteta.businessIdentityNames = (impressumSubjekt.businessIdentityNames || []).slice();
      if (impressumSubjekt.naziv && normaliziraj(impressumSubjekt.naziv) !== normaliziraj(podjetje.name)) {
        registrskaIdentiteta.poslovniNaziv = impressumSubjekt.naziv;
        if (!registrskaIdentiteta.businessIdentityNames.some(function (ime) {
          return normaliziraj(ime) === normaliziraj(impressumSubjekt.naziv);
        })) registrskaIdentiteta.businessIdentityNames.push(impressumSubjekt.naziv);
      }
      registrskaIdentiteta.impressumSourceUrl = javniProfil.sourceUrl || impressumSubjekt.sourceUrl || "";
    }
    return registrskaIdentiteta;
  }
  if (hwk && hwk.status === "found" && hwk.subjekt) {
    var hwkSubjekt = Object.assign({}, hwk.subjekt, {
      status: "verified_directory",
      confidence: "medium",
      entityType: hwk.subjekt.entityType || razdeliImeZaInsolvenco(hwk.subjekt.ime).vrsta,
      naziv: vnos.ime,
      source: "hwk",
    });
    if (hwkSubjekt.entityType !== "company") {
      hwkSubjekt.ime = pocistiImeOsebe(hwkSubjekt.ime);
      hwkSubjekt.naziv = jeVerjetnoImeOsebe(hwkSubjekt.naziv) ? pocistiImeOsebe(hwkSubjekt.naziv) : hwkSubjekt.naziv;
    }
    return normalizirajOsebnaPoljaIdentitete(hwkSubjekt);
  }
  if (javniProfil && javniProfil.status === "found" && javniProfil.subjekt) {
    var impressumSubjekt = Object.assign({}, javniProfil.subjekt, {
      status: "probable_impressum",
      confidence: "medium",
      entityType: javniProfil.subjekt.entityType || razdeliImeZaInsolvenco(javniProfil.subjekt.naziv || javniProfil.subjekt.ime).vrsta,
      source: "impressum",
      registerCourtSource: javniProfil.subjekt.registerCourt ? "impressum_unverified" : "",
    });
    impressumSubjekt.nosilec = pocistiImeOsebe(impressumSubjekt.nosilec);
    impressumSubjekt.zastopniki = (impressumSubjekt.zastopniki || []).map(pocistiImeOsebe).filter(Boolean);
    impressumSubjekt.vloge = (impressumSubjekt.vloge || []).map(function (vloga) {
      return Object.assign({}, vloga, { ime: pocistiImeOsebe(vloga && vloga.ime) });
    }).filter(function (vloga) { return vloga.ime; });
    if (impressumSubjekt.entityType !== "company") {
      impressumSubjekt.ime = pocistiImeOsebe(impressumSubjekt.ime);
      if (jeVerjetnoImeOsebe(impressumSubjekt.naziv)) impressumSubjekt.naziv = pocistiImeOsebe(impressumSubjekt.naziv);
    }
    return normalizirajOsebnaPoljaIdentitete(impressumSubjekt);
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

function sestaviRocnoIdentiteto(vnos) {
  var ime = varnoBesedilo(vnos && vnos.ime, 180);
  var naslov = varnoBesedilo(vnos && vnos.naslov, 140);
  var postnaStevilka = varnoBesedilo(vnos && vnos.postnaStevilka, 5);
  var kraj = varnoBesedilo(vnos && vnos.kraj, 80);
  var jeDruzba = jeNazivPravneDruzbe(ime);
  if (!jeDruzba) ime = pocistiImeOsebe(ime);
  if ((!jeDruzba && !jeVerjetnoImeOsebe(ime)) || naslov.length < 3 || !/\d/.test(naslov) || !/^\d{5}$/.test(postnaStevilka) || kraj.length < 2) return null;
  return {
    status: "manual_input",
    confidence: "low",
    entityType: jeDruzba ? "company" : "person",
    ime: ime,
    naziv: ime,
    naslov: naslov,
    postnaStevilka: postnaStevilka,
    kraj: kraj,
    registerNumber: varnoBesedilo(vnos && vnos.registerNumber, 120),
    vatId: varnoBesedilo(vnos && vnos.vatId, 80),
    source: "user_input",
    verificationMode: "manual_pending_confirmation",
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
  var jeOznacenaPravnaStran = Boolean(javniProfil && javniProfil.subjekt && javniProfil.subjekt.sourceKind === "labelled_provider_page");
  var viri = [
    {
      id: "openregister",
      label: "Register podjetij",
      status: openregister.status,
      reason: openregister.reason || "",
      sourceUrl: openregister.sourceUrl || OPENREGISTER_WEB,
      message: openregister.status === "found"
        ? "Registrirana družba je najdena."
        : openregister.status === "disabled"
          ? "Preverjanje identitete prek OpenRegisterja je izklopljeno."
        : openregister.status === "not_configured"
          ? "API še ni povezan; preverjanje se nadaljuje z rezervnimi viri."
          : openregister.status === "ambiguous"
            ? "Najdenih je več možnih družb."
            : openregister.status === "unavailable"
              ? (openregister.reason === "insufficient_credits"
                ? "OpenRegister API nima dovolj kreditov. Javni zapis lahko odprete neposredno; preverjanje se nadaljuje z Impressumom."
                : openregister.reason === "rate_limited"
                  ? "OpenRegister je začasno omejil število zahtev; preverjanje se nadaljuje z rezervnimi viri."
                  : openregister.reason === "network_error"
                    ? "Povezava z OpenRegisterjem je začasno prekinjena; preverjanje se nadaljuje z rezervnimi viri."
                    : "OpenRegister API trenutno ni dosegljiv; preverjanje se nadaljuje z rezervnimi viri.")
              : "Registrirana družba s tem imenom ni najdena.",
    },
    {
      id: "impressum",
      label: jeOznacenaPravnaStran ? "Pravna stran podjetja" : "Impressum podjetja",
      status: javniProfil.status,
      sourceUrl: javniProfil.sourceUrl || (vnos.spletnaStran || ""),
      message: javniProfil.status === "found"
        ? (javniProfil.subjekt && javniProfil.subjekt.legalEntityWithoutRepresentative
          ? "Pravno ime in celoten naslov sta prepoznana; zastopnik ni naveden, zato podatke pred preverbo preglejte."
          : jeOznacenaPravnaStran
            ? "Pravni nosilec je prepoznan v jasno označenem bloku ponudnika."
            : "Pravni nosilec je prepoznan na spletni strani.")
        : javniProfil.status === "not_provided"
          ? "Spletna stran ni bila vnesena."
        : javniProfil.status === "skipped"
            ? "OpenRegister je identiteto že potrdil, zato Impressuma ni bilo treba preverjati."
          : javniProfil.status === "rejected" && /^registered_merchant_impressum_/.test(javniProfil.reason || "")
            ? "Impressum se ni dovolj zanesljivo ujemal z uradnim registrskim naslovom ali nosilcem, zato njegovih osebnih podatkov nismo združili."
          : javniProfil.reason === "website_not_public"
            ? "Vnesena povezava ni veljaven javni spletni naslov."
            : javniProfil.reason === "website_redirect_failed"
              ? "Spletna stran ima napačno ali predolgo verigo preusmeritev."
              : javniProfil.reason === "website_not_html"
                ? "Povezava ne vodi do berljive HTML spletne strani."
                : javniProfil.reason === "website_too_large"
                  ? "Spletna stran je prevelika za varno samodejno branje; odprite Impressum in vnesite njegov neposredni URL."
                  : javniProfil.reason === "website_unreachable"
                    ? "Spletna stran se ni odzvala ali je blokirala varen samodejni dostop. Preverite povezavo ali poskusite pozneje."
                    : javniProfil.reason === "website_server_error"
                      ? "Spletni strežnik podjetja po več poskusih še vedno vrača napako " + (javniProfil.httpStatus || "5xx") + ". Brez vsebine Impressuma identitete ni varno potrditi."
                      : javniProfil.reason === "website_rate_limited"
                        ? "Spletni strežnik podjetja začasno omejuje dostop (429). Sistem je poizvedbo večkrat ponovil; poskusite pozneje."
                    : /^(?:legal_source_context_mismatch|entered_(?:postal|city|street)_context_mismatch)$/.test(javniProfil.reason || "")
                      ? "Varnostno varovalo je zavrnilo Impressum druge poslovalnice ali pravnega subjekta. Uporabljena bo samo neposredno vnesena pravna stran oziroma stran v istem spletnem kontekstu."
                    : javniProfil.status === "unavailable"
                      ? "Spletne strani trenutno ni bilo mogoče prebrati."
                      : javniProfil.reason === "legal_identity_incomplete"
                        ? "Impressum je najden, vendar manjka zanesljivo pravno ime ali celoten naslov."
            : javniProfil.reason === "holder_not_reliably_identified"
              ? "Impressum je najden, vendar nosilca ni bilo mogoče zanesljivo prepoznati."
              : "Povezava do Impressuma ni bila najdena. Odprite Impressum in vnesite njegov neposredni URL.",
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
  var surovo = String(ime || "").replace(/^Firma\s+/i, "").trim();
  var cisto = jeNazivPravneDruzbe(surovo) ? kanonicniPravniNaziv(surovo) : pocistiImeOsebe(surovo);
  var jeDruzba = jeNazivPravneDruzbe(cisto);
  if (jeDruzba) return { firmaPriimek: cisto, ime: "", vrsta: "company" };
  var deli = cisto.split(/\s+/).filter(Boolean);
  if (deli.length < 2) return { firmaPriimek: cisto, ime: "", vrsta: "unknown" };
  return { firmaPriimek: deli.pop(), ime: deli.join(" "), vrsta: "person" };
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
    // Vsak zajem dobi svoj profil. Ob časovni prekinitvi zato zaklenjen profil
    // prejšnjega brskalnika ne more ustaviti vseh naslednjih preverjanj.
    var zacasniProfil = fs.mkdtempSync(path.join(os.tmpdir(), "mehka-boniteta-browser-"));
    var lokalniBrowser = await puppeteer.launch({
      executablePath: lokalniBrskalnik,
      headless: true,
      userDataDir: zacasniProfil,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    lokalniBrowser.__mehkaBonitetaTempProfile = zacasniProfil;
    return lokalniBrowser;
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

async function zapriBrskalnikZaDokazilo(browser) {
  if (!browser) return;
  var zacasniProfil = browser.__mehkaBonitetaTempProfile;
  try {
    await browser.close();
  } finally {
    if (!zacasniProfil) return;
    var razresenProfil = path.resolve(zacasniProfil);
    var razresenaTempMapa = path.resolve(os.tmpdir());
    if (path.dirname(razresenProfil) !== razresenaTempMapa ||
        !path.basename(razresenProfil).startsWith("mehka-boniteta-browser-")) return;
    try {
      await fs.promises.rm(razresenProfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    } catch (_) {
      // Zaklenjen profil ne sme podreti preverbe; naslednji zajem uporablja
      // drugo mapo in lahko nemoteno nadaljuje.
    }
  }
}

async function sprejmiPiskotke(stran) {
  var vzorci = [
    /^alle\s+(?:akzeptieren|annehmen|zulassen)$/i,
    /^alles\s+(?:akzeptieren|annehmen|zulassen)$/i,
    /^akzeptieren\s+und\s+weiter$/i,
    /^ich\s+stimme\s+zu$/i,
    /^zustimmen$/i,
    /^accept\s+all(?:\s+cookies)?$/i,
    /^accept$/i,
    /^allow\s+all$/i,
    /^agree$/i,
  ];
  for (var poskus = 0; poskus < 3; poskus += 1) {
    var okvirji = stran.frames();
    var kliknjeno = false;
    for (var i = 0; i < okvirji.length; i += 1) {
      try {
        kliknjeno = await okvirji[i].evaluate(function (besedilniVzorci) {
          var regexi = besedilniVzorci.map(function (vzorec) { return new RegExp(vzorec.source, vzorec.flags); });
          var koreni = [document];
          var elementi = [];
          while (koreni.length) {
            var koren = koreni.shift();
            var najdeni = Array.from(koren.querySelectorAll("button, input[type='button'], input[type='submit'], a, [role='button']"));
            najdeni.forEach(function (element) {
              elementi.push(element);
            });
            Array.from(koren.querySelectorAll("*")).forEach(function (element) {
              if (element.shadowRoot) koreni.push(element.shadowRoot);
            });
          }
          var kandidat = elementi.find(function (element) {
            var slog = window.getComputedStyle(element);
            var pravokotnik = element.getBoundingClientRect();
            if (slog.display === "none" || slog.visibility === "hidden" || pravokotnik.width < 20 || pravokotnik.height < 12) return false;
            var tekst = String(element.innerText || element.value || element.getAttribute("aria-label") || element.title || "")
              .replace(/\s+/g, " ").trim();
            return regexi.some(function (regex) { return regex.test(tekst); });
          });
          if (!kandidat) return false;
          kandidat.click();
          return true;
        }, vzorci.map(function (vzorec) { return { source: vzorec.source, flags: vzorec.flags }; }));
      } catch (_) {
        kliknjeno = false;
      }
      if (kliknjeno) break;
    }
    if (!kliknjeno) return false;
    await new Promise(function (resolve) { setTimeout(resolve, 450); });
  }
  return true;
}

function sestaviPojmeDokazilaIdentitete(identiteta) {
  var pravniNaziv = skrajsajNazivZaDokazilo(identiteta && identiteta.naziv);
  return [
    identiteta && identiteta.naziv,
    pravniNaziv,
    identiteta && identiteta.ime,
    identiteta && identiteta.nosilec,
    identiteta && identiteta.naslov,
    identiteta && identiteta.postnaStevilka,
    identiteta && identiteta.kraj,
    identiteta && identiteta.registerNumber,
    identiteta && identiteta.registerCourt,
  ]
    .map(function (vrednost) { return String(vrednost || "").replace(/\s+/g, " ").trim(); })
    .filter(function (vrednost, index, vse) {
      return vrednost.length >= 3 && vse.findIndex(function (druga) {
        return normaliziraj(druga) === normaliziraj(vrednost);
      }) === index;
    });
}

function skrajsajNazivZaDokazilo(vrednost) {
  return kanonicniPravniNaziv(String(vrednost || "").replace(/\s+/g, " ").trim());
}

function sestaviObveznePojmeDokazilaIdentitete(identiteta) {
  var osebnoIme = [identiteta && identiteta.nosilec, identiteta && identiteta.ime]
    .map(function (vrednost) { return pocistiImeOsebe(String(vrednost || "").replace(/\s+/g, " ").trim()); })
    .find(function (vrednost) { return jeVerjetnoImeOsebe(vrednost); });
  var jePravnaOseba = identiteta && identiteta.entityType === "company" || jeNazivPravneDruzbe(identiteta && identiteta.naziv);
  return [
    jePravnaOseba ? skrajsajNazivZaDokazilo(identiteta && identiteta.naziv) : osebnoIme,
    !jePravnaOseba && !osebnoIme && identiteta && identiteta.ime,
    identiteta && identiteta.naslov,
    identiteta && identiteta.postnaStevilka,
    identiteta && identiteta.kraj,
  ]
    .map(function (vrednost) { return String(vrednost || "").replace(/\s+/g, " ").trim(); })
    .filter(function (vrednost, index, vse) {
      return vrednost.length >= 3 && vse.findIndex(function (druga) {
        return normaliziraj(druga) === normaliziraj(vrednost);
      }) === index;
    });
}

async function dolociIzrezIdentitete(stran, identiteta) {
  var iskalniPojmi = sestaviPojmeDokazilaIdentitete(identiteta);
  var obvezniPojmi = sestaviObveznePojmeDokazilaIdentitete(identiteta);
  var osebniPojem = [identiteta && identiteta.nosilec, identiteta && identiteta.ime]
    .map(function (vrednost) { return pocistiImeOsebe(String(vrednost || "").replace(/\s+/g, " ").trim()); })
    .find(function (vrednost) { return jeVerjetnoImeOsebe(vrednost); }) || "";
  if (obvezniPojmi.length < 3) return null;

  var izrez = await stran.evaluate(function (podatki) {
    function normaliziraj(vrednost) {
      return String(vrednost || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ß/g, "ss")
        .toLowerCase()
        .replace(/[^a-z0-9&+]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    function jeViden(element) {
      var pravokotnik = element.getBoundingClientRect();
      if (pravokotnik.width <= 20 || pravokotnik.height <= 12) return false;
      // Otrok ima lahko opacity 1, njegov animirani nadrejeni element pa
      // opacity 0. V tem primeru je besedilo v DOM-u, na posnetku pa ga ni.
      for (var trenutni = element; trenutni && trenutni.nodeType === 1; trenutni = trenutni.parentElement) {
        var slog = window.getComputedStyle(trenutni);
        if (slog.display === "none" || slog.visibility === "hidden" || Number(slog.opacity || 1) < 0.98) return false;
      }
      return true;
    }
    function absolutniPravokotnik(pravokotnik) {
      return {
        left: pravokotnik.left + window.scrollX,
        top: pravokotnik.top + window.scrollY,
        right: pravokotnik.right + window.scrollX,
        bottom: pravokotnik.bottom + window.scrollY,
        width: pravokotnik.width,
        height: pravokotnik.height,
      };
    }
    function jeVNogi(element) {
      return Boolean(element && element.closest && element.closest("footer, [role='contentinfo'], #footer, .footer, [class*='site-footer'], [id*='site-footer']"));
    }
    function razdalja(a, b) {
      var ax = (a.left + a.right) / 2;
      var ay = (a.top + a.bottom) / 2;
      var bx = (b.left + b.right) / 2;
      var by = (b.top + b.bottom) / 2;
      return Math.abs(ay - by) * 4 + Math.abs(ax - bx);
    }
    var normaliziraniPojmi = podatki.pojmi.map(normaliziraj);
    var normaliziraniObvezniPojmi = podatki.obvezniPojmi.map(normaliziraj);
    var normaliziraniOsebniPojem = normaliziraj(podatki.osebniPojem);
    var sidraImpressuma = Array.from(document.querySelectorAll("h1, h2, h3, [role='heading']"))
      .filter(jeViden)
      .filter(function (element) {
        return /^(?:impressum|imprint|anbieterkennzeichnung|anbieterkennung)$/i.test(String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim());
      })
      .map(function (element) { return absolutniPravokotnik(element.getBoundingClientRect()); });
    var pojavi = normaliziraniPojmi.map(function () { return []; });
    var sprehajalec = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    var besedilnoVozlisce;
    while ((besedilnoVozlisce = sprehajalec.nextNode())) {
      var stars = besedilnoVozlisce.parentElement;
      if (!stars || !jeViden(stars)) continue;
      var surovaVsebina = String(besedilnoVozlisce.nodeValue || "");
      var vsebina = normaliziraj(surovaVsebina);
      normaliziraniPojmi.forEach(function (pojem, index) {
        if (!pojem || pojavi[index].length >= 30 || !vsebina.includes(pojem)) return;
        if (pojem === normaliziraniOsebniPojem && /@|https?:|www\./i.test(surovaVsebina)) return;
        var obseg = document.createRange();
        obseg.selectNodeContents(besedilnoVozlisce);
        var pravokotnik = obseg.getBoundingClientRect();
        if (pravokotnik.width > 0 && pravokotnik.height > 0) {
          var pojav = absolutniPravokotnik(pravokotnik);
          pojav.jeVNogi = jeVNogi(stars);
          pojavi[index].push(pojav);
        }
      });
    }
    normaliziraniPojmi.forEach(function (pojem, index) {
      if (pojavi[index].length) return;
      var elementiPojma = Array.from(document.querySelectorAll("address, section, article, main, div, p, li, td, dd, span, strong"))
        .filter(jeViden)
        .filter(function (element) {
          return normaliziraj(element.innerText || element.textContent || "").includes(pojem);
        })
        .sort(function (a, b) {
          var aRect = a.getBoundingClientRect();
          var bRect = b.getBoundingClientRect();
          return aRect.width * aRect.height - bRect.width * bRect.height;
        });
      elementiPojma.slice(0, 12).forEach(function (element) {
        var pojav = absolutniPravokotnik(element.getBoundingClientRect());
        pojav.jeVNogi = jeVNogi(element);
        pojavi[index].push(pojav);
      });
    });
    var obvezniIndeksi = normaliziraniObvezniPojmi.map(function (pojem) {
      return normaliziraniPojmi.indexOf(pojem);
    });
    if (obvezniIndeksi.some(function (index) { return index < 0 || !pojavi[index].length; })) return null;
    // Na pravni strani so ime in naslov pogosto še enkrat ponovljeni v nogi.
    // Kadar je celoten obvezni komplet v glavnem delu strani, nogo izločimo,
    // da kompaktnejši kontaktni footer ne premaga pravega Impressuma.
    var celotenKompletIzvenNoge = obvezniIndeksi.every(function (index) {
      return pojavi[index].some(function (pojav) { return !pojav.jeVNogi; });
    });
    if (celotenKompletIzvenNoge) {
      pojavi = pojavi.map(function (seznam) {
        var izvenNoge = seznam.filter(function (pojav) { return !pojav.jeVNogi; });
        return izvenNoge.length ? izvenNoge : seznam;
      });
    }

    var sidrniIndex = obvezniIndeksi[0];
    var najboljse = null;
    pojavi[sidrniIndex].forEach(function (sidro) {
      var izbrani = obvezniIndeksi.map(function (index) {
        return pojavi[index].slice().sort(function (a, b) {
          return razdalja(sidro, a) - razdalja(sidro, b);
        })[0];
      });
      var levo = Math.min.apply(null, izbrani.map(function (rect) { return rect.left; }));
      var zgoraj = Math.min.apply(null, izbrani.map(function (rect) { return rect.top; }));
      var desno = Math.max.apply(null, izbrani.map(function (rect) { return rect.right; }));
      var spodaj = Math.max.apply(null, izbrani.map(function (rect) { return rect.bottom; }));
      // Podvojeni kontakt v vizualni nogi je pogosto bolj kompakten od pravega
      // pravnega bloka. Če obstaja naslov Impressum, ima bližina temu naslovu
      // prednost pred samo majhnostjo izreza.
      var razdaljaDoImpressuma = sidraImpressuma.length
        ? Math.min.apply(null, sidraImpressuma.map(function (sidroImpressuma) {
          return Math.abs(zgoraj - sidroImpressuma.bottom);
        }))
        : 0;
      var ocena = razdaljaDoImpressuma * 1000000 + (spodaj - zgoraj) * 10000 + (desno - levo);
      if (!najboljse || ocena < najboljse.ocena) najboljse = { levo: levo, zgoraj: zgoraj, desno: desno, spodaj: spodaj, ocena: ocena };
    });
    if (najboljse) {
      var vodoravniOdmik = 90;
      var zgornjiOdmik = 140;
      var spodnjiOdmik = 320;
      var dokument = document.documentElement;
      var sirinaDokumenta = Math.max(dokument.scrollWidth, document.body ? document.body.scrollWidth : 0);
      var visinaDokumenta = Math.max(dokument.scrollHeight, document.body ? document.body.scrollHeight : 0);
      var zelenaSirina = Math.min(Math.max(800, najboljse.desno - najboljse.levo + vodoravniOdmik * 2), sirinaDokumenta);
      var sredinaX = (najboljse.levo + najboljse.desno) / 2;
      var besedilniX = Math.max(0, Math.min(sredinaX - zelenaSirina / 2, Math.max(0, sirinaDokumenta - zelenaSirina)));
      var besedilniY = Math.max(0, najboljse.zgoraj - zgornjiOdmik);
      var zelenaVisina = Math.max(700, najboljse.spodaj - najboljse.zgoraj + zgornjiOdmik + spodnjiOdmik);
      return {
        x: besedilniX,
        y: besedilniY,
        width: Math.min(zelenaSirina, sirinaDokumenta - besedilniX),
        height: Math.min(zelenaVisina, visinaDokumenta - besedilniY),
      };
    }
    return null;
  }, { pojmi: iskalniPojmi, obvezniPojmi: obvezniPojmi, osebniPojem: osebniPojem });
  if (!izrez || !Number.isFinite(izrez.width) || !Number.isFinite(izrez.height)) return null;
  return izrez;
}

async function pocakajNaIzrezIdentitete(stran, identiteta) {
  await pripraviZakasnjenoVsebinoDokazila(stran, identiteta);
  for (var poskus = 0; poskus < 10; poskus += 1) {
    var izrez = await dolociIzrezIdentitete(stran, identiteta);
    if (izrez) return izrez;
    if (poskus === 2 || poskus === 5) await pripraviZakasnjenoVsebinoDokazila(stran, identiteta);
    await new Promise(function (resolve) { setTimeout(resolve, 400); });
  }
  return null;
}

async function pripraviZakasnjenoVsebinoDokazila(stran, identiteta) {
  var obvezniPojmi = sestaviObveznePojmeDokazilaIdentitete(identiteta);
  if (obvezniPojmi.length < 3) return { found: false, revealed: 0 };
  return stran.evaluate(async function (pojmi) {
    function normaliziraj(vrednost) {
      return String(vrednost || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ß/g, "ss")
        .toLowerCase()
        .replace(/[^a-z0-9&+]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    function opisAnimacije(element) {
      return [
        element.id,
        typeof element.className === "string" ? element.className : "",
        element.getAttribute("data-aos"),
        element.getAttribute("data-animation"),
        element.getAttribute("data-animate"),
      ].join(" ");
    }
    var zahtevani = pojmi.map(normaliziraj).filter(Boolean);
    function najdiKandidate() {
      return Array.from(document.querySelectorAll("p, address, section, article, main, div, footer"))
        .filter(function (element) {
          var rect = element.getBoundingClientRect();
          if (rect.width <= 20 || rect.height <= 12) return false;
          var vsebina = normaliziraj(element.innerText || element.textContent || "");
          return zahtevani.every(function (pojem) { return vsebina.includes(pojem); });
        })
        .sort(function (a, b) {
          var aRect = a.getBoundingClientRect();
          var bRect = b.getBoundingClientRect();
          return aRect.width * aRect.height - bRect.width * bRect.height;
        });
    }
    var kandidati = najdiKandidate();
    if (!kandidati.length) {
      // Nekatere enostranske predstavitve hranijo celoten pravni blok v DOM-u,
      // prikažejo pa ga šele po kliku na lasten gumb »Impressum«. Kliknemo samo
      // vidni, natančno označeni pravni kontrolnik in nato ponovno poiščemo isti
      // že preverjeni identitetni blok; drugih skritih menijev ne odpiramo.
      var pravniKontrolnik = Array.from(document.querySelectorAll("button, a, [role='button'], summary")).find(function (element) {
        var rect = element.getBoundingClientRect();
        var oznaka = String(element.innerText || element.textContent || element.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
        return rect.width >= 12 && rect.height >= 10 && /^(?:Impressum|Imprint|Anbieterkennzeichnung|Anbieterkennung)$/i.test(oznaka);
      });
      if (pravniKontrolnik) {
        pravniKontrolnik.click();
        await new Promise(function (resolve) { setTimeout(resolve, 250); });
        kandidati = najdiKandidate();
      }
    }
    var cilj = kandidati[0];
    if (!cilj) return { found: false, revealed: 0 };

    cilj.scrollIntoView({ block: "center", inline: "nearest" });
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) { /* pisava ne sme blokirati dokazila */ }
    }
    if (typeof document.getAnimations === "function") {
      document.getAnimations().forEach(function (animacija) {
        try { animacija.finish(); } catch (_) { /* neskončne animacije preskočimo */ }
      });
    }

    // Zaključimo samo skrite animacijske ovoje, ki dejansko vsebujejo celoten
    // iskani pravni blok. Ne razkrivamo menijev, modalov ali druge skrite UI.
    var razkrito = 0;
    for (var trenutni = cilj; trenutni && trenutni !== document.body && trenutni !== document.documentElement; trenutni = trenutni.parentElement) {
      var slog = window.getComputedStyle(trenutni);
      var jeAnimacijskiOvoj = /(?:^|[\s_-])(?:animated?|animation|animate|aos|fade|reveal|wow|invisible)(?:[\s_-]|$)/i.test(opisAnimacije(trenutni));
      var jeVizualnoSkrit = Number(slog.opacity || 1) < 0.98 || slog.visibility === "hidden";
      if (!jeAnimacijskiOvoj || !jeVizualnoSkrit) continue;
      trenutni.style.setProperty("animation", "none", "important");
      trenutni.style.setProperty("transition", "none", "important");
      trenutni.style.setProperty("opacity", "1", "important");
      trenutni.style.setProperty("visibility", "visible", "important");
      trenutni.style.setProperty("transform", "none", "important");
      razkrito += 1;
    }
    await new Promise(function (resolve) {
      window.requestAnimationFrame(function () { window.requestAnimationFrame(resolve); });
    });
    return { found: true, revealed: razkrito };
  }, obvezniPojmi);
}

function jePosnetekDokazilaUporaben(posnetek, izrez) {
  if (typeof posnetek !== "string" || !posnetek) return false;
  var bajti = Math.floor(posnetek.length * 0.75);
  var slikovneTocke = Math.max(1, Number(izrez && izrez.width || 0) * Number(izrez && izrez.height || 0));
  // Enobarven oziroma skoraj prazen JPEG velikega izreza je zelo majhen.
  // Prag je namenoma konservativen: dvomljiv zajem ostane rumen, nikoli pa
  // se ne prikaže kot veljavno uradno dokazilo.
  return bajti >= 12000 && bajti / slikovneTocke >= 0.02;
}

async function analizirajSivinoPosnetka(stran, posnetek) {
  return stran.evaluate(async function (base64) {
    var slika = document.createElement("img");
    slika.src = "data:image/jpeg;base64," + base64;
    await slika.decode();
    var platno = document.createElement("canvas");
    platno.width = 64;
    platno.height = 64;
    var risanje = platno.getContext("2d", { willReadFrequently: true });
    risanje.drawImage(slika, 0, 0, 64, 64);
    var tocke = risanje.getImageData(0, 0, 64, 64).data;
    var vsota = 0;
    var sivihSrednjih = 0;
    var belih = 0;
    var stolpci = Array.from({ length: 8 }, function () { return { svetlost: 0, sivih: 0, skupaj: 0 }; });
    var vrstice = Array.from({ length: 8 }, function () { return { svetlost: 0, sivih: 0, skupaj: 0 }; });
    var osrednjeVrstice = Array.from({ length: 8 }, function () { return { vsebinskih: 0, skupaj: 0 }; });
    var osrednjihVsebinskih = 0;
    var osrednjihSkupaj = 0;
    for (var i = 0; i < tocke.length; i += 4) {
      var najvec = Math.max(tocke[i], tocke[i + 1], tocke[i + 2]);
      var najmanj = Math.min(tocke[i], tocke[i + 1], tocke[i + 2]);
      var svetlost = (tocke[i] + tocke[i + 1] + tocke[i + 2]) / 3;
      vsota += svetlost;
      if (svetlost >= 70 && svetlost <= 185 && najvec - najmanj < 20) sivihSrednjih += 1;
      if (svetlost >= 235) belih += 1;
      var indeksTocke = i / 4;
      var x = indeksTocke % 64;
      var stolpec = Math.min(7, Math.floor((indeksTocke % 64) / 8));
      var vrstica = Math.min(7, Math.floor(Math.floor(indeksTocke / 64) / 8));
      [stolpci[stolpec], vrstice[vrstica]].forEach(function (pas) {
        pas.svetlost += svetlost;
        pas.sivih += svetlost >= 70 && svetlost <= 185 && najvec - najmanj < 20 ? 1 : 0;
        pas.skupaj += 1;
      });
      // Robovi strani lahko vsebujejo ponavljajoč vzorec, medtem ko je
      // osrednji pravni blok popolnoma prazen. Zato merimo dejansko temnejšo
      // vsebino posebej v osrednjih 62,5 % izreza in po navpičnih pasovih.
      if (x >= 12 && x < 52) {
        var jeVsebinskaTocka = svetlost < 215 || najvec - najmanj > 32;
        osrednjihSkupaj += 1;
        osrednjeVrstice[vrstica].skupaj += 1;
        if (jeVsebinskaTocka) {
          osrednjihVsebinskih += 1;
          osrednjeVrstice[vrstica].vsebinskih += 1;
        }
      }
    }
    var stevilo = tocke.length / 4;
    function povzetekPasov(pasovi) {
      var svetlosti = pasovi.map(function (pas) { return pas.svetlost / Math.max(1, pas.skupaj); });
      var mocnoSivi = pasovi.filter(function (pas) {
        var povprecje = pas.svetlost / Math.max(1, pas.skupaj);
        return pas.sivih / Math.max(1, pas.skupaj) >= 0.72 && povprecje >= 65 && povprecje <= 190;
      }).length;
      return {
        delezMocnoSivih: mocnoSivi / pasovi.length,
        razponSvetlosti: Math.max.apply(null, svetlosti) - Math.min.apply(null, svetlosti),
      };
    }
    var vodoravno = povzetekPasov(stolpci);
    var navpicno = povzetekPasov(vrstice);
    return {
      povprecnaSvetlost: vsota / stevilo,
      delezSive: sivihSrednjih / stevilo,
      delezBele: belih / stevilo,
      delezMocnoSivihStolpcev: vodoravno.delezMocnoSivih,
      razponSvetlostiStolpcev: vodoravno.razponSvetlosti,
      delezMocnoSivihVrstic: navpicno.delezMocnoSivih,
      razponSvetlostiVrstic: navpicno.razponSvetlosti,
      delezVsebineVJedru: osrednjihVsebinskih / Math.max(1, osrednjihSkupaj),
      delezVsebinskihVrsticVJedru: osrednjeVrstice.filter(function (pas) {
        return pas.vsebinskih / Math.max(1, pas.skupaj) >= 0.025;
      }).length / osrednjeVrstice.length,
    };
  }, posnetek);
}

function jePosnetekZatemnjenZaradiSloja(analiza) {
  if (!analiza) return false;
  var celotnaZatemnitev = analiza.povprecnaSvetlost < 190 &&
    analiza.delezSive > 0.58 && analiza.delezBele < 0.16;
  function jeDelnaZatemnitev(delez, razpon) {
    return delez >= 0.25 && delez <= 0.875 && razpon >= 42;
  }
  return celotnaZatemnitev ||
    jeDelnaZatemnitev(analiza.delezMocnoSivihStolpcev || 0, analiza.razponSvetlostiStolpcev || 0) ||
    jeDelnaZatemnitev(analiza.delezMocnoSivihVrstic || 0, analiza.razponSvetlostiVrstic || 0);
}

function jePosnetekSkorajPrazen(analiza) {
  if (!analiza) return false;
  // Visok delež bele sam po sebi ni napaka: večina Impressumov je črno
  // besedilo na belem ozadju. Zajem zavrnemo šele, ko je hkrati skoraj bel
  // in v osrednjem delu nima vsebine, razporejene po več navpičnih pasovih.
  return analiza.delezBele >= 0.68 &&
    (analiza.delezVsebineVJedru || 0) <= 0.008 &&
    (analiza.delezVsebinskihVrsticVJedru || 0) <= 0.125;
}

async function zajemiIzrezDokazila(stran, izrez) {
  // Pojavni vtičniki lahko po prvem čiščenju znova ustvarijo isti ovoj.
  // Čiščenje zato ponovimo tik pred JPEG-om; spodaj vstavljena trajna CSS
  // varovalka ostane aktivna tudi, če vtičnik med zajemom zamenja DOM-vozlišče.
  await skrijPiskotkovnoPasicoZaPosnetek(stran);
  var prekrivanjeSeVednoAktivno = await stran.evaluate(function () {
    function jePravniDokazniElement(element) {
      var vsebina = String(element && (element.innerText || element.textContent) || "").replace(/\s+/g, " ").trim();
      return /\b(?:Impressum|Imprint|Anbieterkennzeichnung|Anbieterkennung)\b/i.test(vsebina) &&
        /\b\d{5}\s+[\p{L}]/u.test(vsebina) &&
        /(?:Angaben\s+gem(?:ä|a)ß|Handelsregister|Registergericht|Amtsgericht|Vertreten\s+durch|Geschäftsführer|Inhaber|\b(?:GmbH|UG|AG|KG|OHG|e\.?\s*K\.?)\b)/i.test(vsebina);
    }
    return Array.from(document.querySelectorAll("*")).some(function (element) {
      if (element === document.body || element === document.documentElement) return false;
      if (jePravniDokazniElement(element)) return false;
      var slog = window.getComputedStyle(element);
      var pravokotnik = element.getBoundingClientRect();
      var zIndex = Number.parseInt(slog.zIndex, 10);
      var opis = [element.id, element.className, element.getAttribute("role"), element.getAttribute("aria-label")].join(" ");
      var barvaOzadja = String(slog.backgroundColor || "").match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/i);
      var alfaOzadja = barvaOzadja && barvaOzadja[4] == null ? 1 : Number(barvaOzadja && barvaOzadja[4] || 0);
      var neimenovanaZatemnitev = Boolean(barvaOzadja && alfaOzadja >= 0.12 && alfaOzadja < 0.98 &&
        (Number(barvaOzadja[1]) + Number(barvaOzadja[2]) + Number(barvaOzadja[3])) / 3 < 230) ||
        (slog.backdropFilter && slog.backdropFilter !== "none");
      return (slog.position === "fixed" || slog.position === "sticky") &&
        slog.display !== "none" && slog.visibility !== "hidden" && Number(slog.opacity || 1) > 0.02 &&
        pravokotnik.width >= window.innerWidth * 0.6 && pravokotnik.height >= window.innerHeight * 0.6 &&
        Number.isFinite(zIndex) && zIndex >= 100 &&
        (neimenovanaZatemnitev || /(?:dialog|modal|overlay|backdrop|popup|lightbox|offcanvas|engage|(?:^|[\s_-])eb-(?:inst|dialog)(?:[\s_-]|$))/i.test(opis));
    });
  });
  if (prekrivanjeSeVednoAktivno) throw new Error("IDENTITY_SCREENSHOT_OVERLAY_ACTIVE");
  var posnetek = await stran.screenshot({
    type: "jpeg",
    quality: 82,
    clip: izrez,
    captureBeyondViewport: true,
    encoding: "base64",
  });
  var analiza = await analizirajSivinoPosnetka(stran, posnetek);
  var vsebinaIzrezaJeVidna = await stran.evaluate(function (clip) {
    return Array.from(document.querySelectorAll("h1, h2, h3, h4, p, address, li, dt, dd, strong"))
      .filter(function (element) {
        var slog = window.getComputedStyle(element);
        var rect = element.getBoundingClientRect();
        var levo = Math.max(clip.x, rect.left + window.scrollX);
        var zgoraj = Math.max(clip.y, rect.top + window.scrollY);
        var desno = Math.min(clip.x + clip.width, rect.right + window.scrollX);
        var spodaj = Math.min(clip.y + clip.height, rect.bottom + window.scrollY);
        return slog.display !== "none" && slog.visibility !== "hidden" && Number(slog.opacity || 1) >= 0.98 &&
          desno > levo && spodaj > zgoraj && String(element.innerText || element.textContent || "").trim().length >= 3;
      }).length >= 3;
  }, izrez);
  var naravnoTemnoOzadje = await stran.evaluate(function (clip) {
    function jeTemno(element) {
      if (!element) return false;
      var slog = window.getComputedStyle(element);
      var barva = slog.backgroundColor;
      var rgb = String(barva || "").match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/i);
      var alfa = rgb && rgb[4] == null ? 1 : Number(rgb && rgb[4] || 0);
      var zIndex = Number.parseInt(slog.zIndex, 10);
      var negativnoOzadje = Number.isFinite(zIndex) && zIndex < 0;
      if (Number(slog.opacity || 1) < 0.98) return false;
      if ((slog.position === "fixed" || slog.position === "sticky" || slog.position === "absolute") && !negativnoOzadje) return false;
      if (slog.filter !== "none" || slog.backdropFilter !== "none") return false;
      var opis = [element.id, element.className, element.getAttribute("role"), element.getAttribute("aria-label")].join(" ");
      if (/(?:dialog|modal|overlay|backdrop|popup|lightbox|offcanvas|cookie|consent|cmp|engage)/i.test(opis)) return false;
      var slikovnoOzadje = String(slog.backgroundImage || "none") !== "none";
      return slikovnoOzadje || Boolean(rgb && alfa >= 0.98 && (Number(rgb[1]) + Number(rgb[2]) + Number(rgb[3])) / 3 < 190);
    }
    if (jeTemno(document.body) || jeTemno(document.documentElement)) return true;
    var povrsinaIzreza = Math.max(1, clip.width * clip.height);
    return Array.from(document.querySelectorAll("body *")).some(function (element) {
      if (!jeTemno(element)) return false;
      var rect = element.getBoundingClientRect();
      var levo = Math.max(clip.x, rect.left + window.scrollX);
      var zgoraj = Math.max(clip.y, rect.top + window.scrollY);
      var desno = Math.min(clip.x + clip.width, rect.right + window.scrollX);
      var spodaj = Math.min(clip.y + clip.height, rect.bottom + window.scrollY);
      return Math.max(0, desno - levo) * Math.max(0, spodaj - zgoraj) / povrsinaIzreza >= 0.55;
    });
  }, izrez);
  if (!naravnoTemnoOzadje && !vsebinaIzrezaJeVidna && jePosnetekZatemnjenZaradiSloja(analiza)) throw new Error("IDENTITY_SCREENSHOT_DIMMED_OVERLAY");
  if (jePosnetekSkorajPrazen(analiza)) throw new Error("IDENTITY_SCREENSHOT_BLANK_CONTENT");
  return posnetek;
}

async function ponovnoZajemiImpressumBrezSkript(stran, sourceUrl, identiteta) {
  await stran.setJavaScriptEnabled(false);
  await stran.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
  // Preskočene skripte strani se ne izvedejo za nazaj. Izvajanje ponovno
  // omogočimo samo zato, da lahko Puppeteer v izoliranem okolju izračuna izrez
  // in analizira slikovne točke nastalega dokazila.
  await stran.setJavaScriptEnabled(true);
  // Vsebina Impressuma na strežniško izrisanih straneh je prisotna takoj;
  // kratek odmik je samo za pisave in slogovne datoteke, ne za skripte.
  await new Promise(function (resolve) { setTimeout(resolve, 350); });
  await skrijPiskotkovnoPasicoZaPosnetek(stran);
  var izrez = await pocakajNaIzrezIdentitete(stran, identiteta);
  if (!izrez) throw new Error("IDENTITY_BLOCK_NOT_FOUND_SCRIPTLESS");
  var posnetek = await zajemiIzrezDokazila(stran, izrez);
  if (!jePosnetekDokazilaUporaben(posnetek, izrez)) throw new Error("EMPTY_IDENTITY_SCREENSHOT_SCRIPTLESS");
  return { izrez: izrez, posnetek: posnetek };
}

async function skrijPiskotkovnoPasicoZaPosnetek(stran) {
  var okvirji = typeof stran.frames === "function" ? stran.frames() : [stran];
  var skritih = 0;
  for (var okvirIndex = 0; okvirIndex < okvirji.length; okvirIndex += 1) {
    try {
      skritih += await okvirji[okvirIndex].evaluate(function () {
        var vzorec = /(?:cookie|cookies|cookienotice|consent|privacy\s*(?:preferences|settings)|datenschutz|einwilligung|privatsph(?:ä|a)re|cmp)/i;
        var akcija = /^(?:accept|accept all|allow all|agree|decline|reject|preferences|save(?: selection| settings)?|ablehnen|akzeptieren|alle akzeptieren|zustimmen|speichern|auswahl speichern|einstellungen speichern|nur notwendige(?: cookies)?|nur erforderliche(?: cookies)?)$/i;
        var skriteTarce = [];
        var koreni = [document];

        // EngageBox in podobni vtičniki po nekaj sto milisekundah ponovno
        // ustvarijo ovoj. Pravilo ostane v dokumentu in zato blokira tudi novo
        // vozlišče, ne samo tistega, ki obstaja ob prvem pregledu.
        if (!document.getElementById("uj-dokazilo-brez-prekrivanj")) {
          var trajnoPravilo = document.createElement("style");
          trajnoPravilo.id = "uj-dokazilo-brez-prekrivanj";
          trajnoPravilo.textContent = [
            ".eb-inst, .eb-dialog, .eb-backdrop, [class*='engagebox'], [data-uj-dokazilo-prekrivanje='true'] {",
            "display:none!important; visibility:hidden!important; opacity:0!important; pointer-events:none!important;",
            "}",
            "html[data-uj-dokazilo-cisto='true'] body { filter:none!important; opacity:1!important; backdrop-filter:none!important; }"
          ].join("");
          (document.head || document.documentElement).appendChild(trajnoPravilo);
        }
        document.documentElement.setAttribute("data-uj-dokazilo-cisto", "true");

        function pocistiStanjePojavnegaOkna() {
          [document.documentElement, document.body].forEach(function (element) {
            if (!element) return;
            Array.from(element.classList).forEach(function (razred) {
              if (/^(?:eb-popup|eb-\d+-open)$/i.test(razred)) element.classList.remove(razred);
            });
            element.style.setProperty("filter", "none", "important");
            element.style.setProperty("opacity", "1", "important");
            element.style.setProperty("backdrop-filter", "none", "important");
          });
          document.documentElement.style.setProperty("overflow", "auto", "important");
          if (document.body) document.body.style.setProperty("overflow", "auto", "important");
        }
        pocistiStanjePojavnegaOkna();
        if (!document.documentElement.__ujDokaziloOpazovalec) {
          var opazovalec = new MutationObserver(pocistiStanjePojavnegaOkna);
          opazovalec.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
          if (document.body) opazovalec.observe(document.body, { attributes: true, attributeFilter: ["class"] });
          document.documentElement.__ujDokaziloOpazovalec = opazovalec;
        }

        function besedilo(element) {
          return String(element && (element.innerText || element.textContent) || "").replace(/\s+/g, " ").trim();
        }
        function oznaka(element) {
          return [element && element.id, element && element.className, element && element.getAttribute && element.getAttribute("role"), element && element.getAttribute && element.getAttribute("aria-label")].join(" ");
        }
        function jePrekrivniElement(element) {
          if (!element || element === document.body || element === document.documentElement) return false;
          var slog = window.getComputedStyle(element);
          return slog.position === "fixed" || slog.position === "sticky" ||
            element.getAttribute("aria-modal") === "true" || element.getAttribute("role") === "dialog" ||
            /(?:dialog|modal|overlay|backdrop|banner|cookie|cookienotice|consent|cmp)/i.test(oznaka(element));
        }
        function jeCelozaslonskiPojavniSloj(element) {
          if (!element || element === document.body || element === document.documentElement) return false;
          var slog = window.getComputedStyle(element);
          var pravokotnik = element.getBoundingClientRect();
          var zIndex = Number.parseInt(slog.zIndex, 10);
          var opis = oznaka(element);
          var jePojavniOvoj = /(?:dialog|modal|overlay|backdrop|popup|lightbox|offcanvas|engage|(?:^|[\s_-])eb-(?:inst|dialog)(?:[\s_-]|$))/i.test(opis) ||
            element.getAttribute("aria-modal") === "true" || element.getAttribute("role") === "dialog";
          return (slog.position === "fixed" || slog.position === "sticky") &&
            pravokotnik.width >= window.innerWidth * 0.6 && pravokotnik.height >= window.innerHeight * 0.6 &&
            Number.isFinite(zIndex) && zIndex >= 100 && jePojavniOvoj;
        }
        function jePravniDokazniElement(element) {
          var vsebina = besedilo(element);
          // Pravni podatki so lahko namenoma prikazani v modalnem oknu
          // (npr. Fancybox). Takšno okno ni piškotkovna pasica in ga pri
          // čiščenju prekrivanj ne smemo odstraniti. Zahtevamo hkrati pravni
          // naslov, nemški naslov in pravno značilnost, zato navadna omemba
          // povezave »Impressum« v nogi ne zadošča.
          return /(?:^|\n)\s*(?:Impressum|Imprint|Anbieterkennzeichnung|Anbieterkennung)\b/i.test(vsebina) &&
            /\b\d{5}\s+[\p{L}]/u.test(vsebina) &&
            /(?:Angaben\s+gem(?:ä|a)ß|Handelsregister|Registergericht|Amtsgericht|Vertreten\s+durch|Geschäftsführer|Inhaber|\b(?:GmbH|UG|AG|KG|OHG|e\.?\s*K\.?)\b)/i.test(vsebina);
        }
        function skrij(element) {
          if (!element || skriteTarce.indexOf(element) >= 0 || element === document.body || element === document.documentElement) return;
          if (jePravniDokazniElement(element)) return;
          element.style.setProperty("display", "none", "important");
          element.style.setProperty("visibility", "hidden", "important");
          element.setAttribute("data-uj-dokazilo-prekrivanje", "true");
          element.setAttribute("aria-hidden", "true");
          skriteTarce.push(element);

          // Usercentrics in podobni CMP-ji imajo dialog in zatemnitveno ozadje
          // kot ločena sorojenca v senčnem korenu. Dialog ima pravilen opis,
          // prazno ozadje pa naključno generiran razred. Ko zanesljivo skrijemo
          // consent/dialog, v istem korenu odstranimo tudi samo velike prazne
          // fiksne plasti z visokim z-indexom; vsebine strani se ne dotikamo.
          var koren = element.getRootNode && element.getRootNode();
          if (!koren || koren === document || !koren.querySelectorAll) return;
          Array.from(koren.querySelectorAll("*")).forEach(function (sosed) {
            if (sosed === element || skriteTarce.indexOf(sosed) >= 0) return;
            var slog = window.getComputedStyle(sosed);
            var rect = sosed.getBoundingClientRect();
            var zIndex = Number.parseInt(slog.zIndex, 10);
            var kratkoBesedilo = besedilo(sosed).length < 80;
            if ((slog.position === "fixed" || slog.position === "sticky") &&
                rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8 &&
                Number.isFinite(zIndex) && zIndex >= 100 && kratkoBesedilo) {
              sosed.style.setProperty("display", "none", "important");
              sosed.style.setProperty("visibility", "hidden", "important");
              sosed.setAttribute("data-uj-dokazilo-prekrivanje", "true");
              sosed.setAttribute("aria-hidden", "true");
              skriteTarce.push(sosed);
            }
          });
        }
        function dodajSenčneKorene(root) {
          Array.from(root.querySelectorAll("*")).forEach(function (element) {
            if (element.shadowRoot && koreni.indexOf(element.shadowRoot) < 0) {
              koreni.push(element.shadowRoot);
              dodajSenčneKorene(element.shadowRoot);
            }
          });
        }

        dodajSenčneKorene(document);
        koreni.forEach(function (root) {
          var oznaceni = Array.from(root.querySelectorAll("[id], [class], [role='dialog'], [aria-modal='true']"));
          oznaceni.forEach(function (element) {
            var opis = oznaka(element);
            var vsebina = besedilo(element);
            if (vzorec.test(opis) && jePrekrivniElement(element) && (vzorec.test(vsebina) || /(?:cookie|cookienotice|consent|cmp)/i.test(opis))) skrij(element);
            else if (jeCelozaslonskiPojavniSloj(element)) skrij(element);
          });

          Array.from(root.querySelectorAll("button, a, [role='button'], input[type='button'], input[type='submit']")).forEach(function (element) {
            var vrednost = besedilo(element) || String(element.value || element.getAttribute("aria-label") || "").trim();
            if (!akcija.test(vrednost)) return;
            var trenutni = element;
            for (var i = 0; i < 10 && trenutni && trenutni !== document.body && trenutni !== document.documentElement; i += 1) {
              if (jePrekrivniElement(trenutni) && vzorec.test(besedilo(trenutni) + " " + oznaka(trenutni))) {
                skrij(trenutni);
                break;
              }
              trenutni = trenutni.parentElement;
            }
          });
        });

        if (document.body) {
          document.body.style.setProperty("overflow", "auto", "important");
          Array.from(document.body.classList).forEach(function (razred) {
            if (/(?:cookie|cookienotice|consent|cmp)/i.test(razred)) document.body.classList.remove(razred);
          });
        }
        document.documentElement.style.setProperty("overflow", "auto", "important");
        return skriteTarce.length;
      });
    } catch (_) {
      // Okvir se je lahko med nalaganjem odstranil. Glavni dokument še vedno
      // obdelamo, zajem pa zaradi zunanjega okvirja ne sme pasti.
    }
  }
  return skritih;
}

function dolociVirDokazilaIdentitete(identiteta, openregister, hwk, javniProfil) {
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
  if (identiteta && ["probable_impressum", "confirmed_impressum"].includes(identiteta.status)) {
    return {
      sourceUrl: javniProfil && javniProfil.sourceUrl || identiteta.sourceUrl || "",
      sourceLabel: javniProfil && javniProfil.subjekt && javniProfil.subjekt.sourceKind === "labelled_provider_page"
        ? "Pravna stran podjetja – označeni ponudnik"
        : "Impressum podjetja",
    };
  }
  return null;
}

function sestaviApiDokaziloIdentitete(identiteta, openregister) {
  if (!identiteta || identiteta.status !== "verified_register") return null;
  return {
    status: "verified_api",
    verifiedAt: new Date().toISOString(),
    sourceUrl: openregister && openregister.sourceUrl || OPENREGISTER_WEB,
    sourceLabel: "OpenRegister API",
    companyId: identiteta.companyId || "",
    officialName: identiteta.ime || identiteta.naziv || "",
    officialStreet: identiteta.naslov || "",
    officialPostalCode: identiteta.postnaStevilka || "",
    officialCity: identiteta.kraj || "",
    legalForm: identiteta.legalForm || "",
    active: identiteta.active !== false,
    registerNumber: identiteta.registerNumber || "",
    registerCourt: identiteta.registerCourt || "",
  };
}

async function zajemiDokaziloIdentitete(identiteta, openregister, hwk, javniProfil) {
  var apiDokazilo = sestaviApiDokaziloIdentitete(identiteta, openregister);
  if (apiDokazilo) return apiDokazilo;
  if (identiteta && identiteta.status === "verified_directory" && hwk && hwk.manualEvidence) {
    return {
      status: "captured",
      imageDataUrl: hwk.manualEvidence.imageDataUrl,
      capturedAt: hwk.manualEvidence.capturedAt,
      sourceUrl: hwk.manualEvidence.sourceUrl || HANDWERKER_RADAR_SEARCH,
      sourceLabel: (hwk.chamberName || "Handwerkskammer") + " – ročno zajet uradni rezultat",
      evidenceMode: "user_uploaded_official_screenshot",
      captureVersion: "user-uploaded-official-screenshot-v1",
      viewportOverlaysRemoved: true,
      screenshotReady: true,
      evidenceContractVersion: identityEvidenceContract.CONTRACT_VERSION,
    };
  }
  var vir = dolociVirDokazilaIdentitete(identiteta, openregister, hwk, javniProfil);
  if (!vir || !vir.sourceUrl) return null;
  var varenUrl = await preveriJavniSpletniNaslov(vir.sourceUrl);
  var browser = await zazeniBrskalnikZaDokazilo();
  try {
    var stran = await browser.newPage();
    await stran.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1.5 });
    // Pravi brskalniški profil je nujen za strani, ki pri nebrowserskem
    // User-Agentu skrijejo pravno vsebino in pustijo viden samo cookie dialog.
    await stran.setUserAgent(BROWSER_USER_AGENT);
    await stran.goto(varenUrl.toString(), { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise(function (resolve) { setTimeout(resolve, 1200); });
    await skrijPiskotkovnoPasicoZaPosnetek(stran);
    await pripraviZakasnjenoVsebinoDokazila(stran, identiteta);
    var vnaprejZajetoDokazilo = null;
    if (identiteta && ["probable_impressum", "confirmed_impressum"].includes(identiteta.status)) {
      var vidnaPravnaVsebina = await stran.evaluate(function () {
        return {
          oznake: [document.title].concat(Array.from(document.querySelectorAll("h1, h2, h3, [role='heading']")).map(function (element) {
          return element.innerText || element.textContent || "";
          })).join(" "),
          besedilo: String(document.body && document.body.innerText || ""),
        };
      });
      var jePravnaImpressumStran = jePravnaImpressumVsebina(
        vidnaPravnaVsebina.oznake + (identiteta.sourceKind === "impressum" ? " Impressum" : ""),
        vidnaPravnaVsebina.besedilo,
        sestaviObveznePojmeDokazilaIdentitete(identiteta),
        identiteta.entityType === "company" || jeNazivPravneDruzbe(identiteta.naziv)
      );
      if (!jePravnaImpressumStran) {
        try {
          vnaprejZajetoDokazilo = await ponovnoZajemiImpressumBrezSkript(stran, varenUrl.toString(), identiteta);
        } catch (_) {
          throw new Error("IMPRINT_PAGE_NOT_CONFIRMED");
        }
      }
    }
    // Za dokazilo ne spreminjamo soglasja na tuji strani. Pasico samo lokalno
    // umaknemo iz posnetka, pravna vsebina Impressuma pa ostane nespremenjena.
    await skrijPiskotkovnoPasicoZaPosnetek(stran);
    await new Promise(function (resolve) { setTimeout(resolve, 350); });
    // Nekatere strani pravni blok izrišejo šele po zaprtju pasice za piškotke
    // ali po zakasnjenem odjemalskem izrisu. En sam trenutni posnetek je zato
    // občasno vrnil lažen IDENTITY_BLOCK_NOT_FOUND.
    var izrez = vnaprejZajetoDokazilo && vnaprejZajetoDokazilo.izrez || await pocakajNaIzrezIdentitete(stran, identiteta);
    if (!izrez) throw new Error("IDENTITY_BLOCK_NOT_FOUND");
    var posnetek = vnaprejZajetoDokazilo && vnaprejZajetoDokazilo.posnetek;
    if (!posnetek) {
      try {
        posnetek = await zajemiIzrezDokazila(stran, izrez);
      } catch (napakaPrvegaPosnetka) {
        if (!["IDENTITY_SCREENSHOT_DIMMED_OVERLAY", "IDENTITY_SCREENSHOT_OVERLAY_ACTIVE", "IDENTITY_SCREENSHOT_BLANK_CONTENT"].includes(napakaPrvegaPosnetka.message) ||
            !identiteta || !["probable_impressum", "confirmed_impressum"].includes(identiteta.status)) throw napakaPrvegaPosnetka;
        // Če slikovna analiza odkrije zatemnitev, isto pravno stran ponovno
        // naložimo brez izvajanja skript. Vsebina ostane izvirna, pojavni vtičnik
        // pa nima možnosti znova vključiti temnega ozadja.
        var ponovljenoBrezSkript = await ponovnoZajemiImpressumBrezSkript(stran, varenUrl.toString(), identiteta);
        izrez = ponovljenoBrezSkript.izrez;
        posnetek = ponovljenoBrezSkript.posnetek;
      }
    }
    if (!jePosnetekDokazilaUporaben(posnetek, izrez)) {
      // Animacija se lahko zaključi med izračunom izreza in samim zajemom.
      // Enkrat ponovno pripravimo vsebino in izračunamo svež izrez.
      await pripraviZakasnjenoVsebinoDokazila(stran, identiteta);
      await new Promise(function (resolve) { setTimeout(resolve, 350); });
      izrez = await pocakajNaIzrezIdentitete(stran, identiteta);
      if (!izrez) throw new Error("IDENTITY_BLOCK_NOT_FOUND");
      posnetek = await zajemiIzrezDokazila(stran, izrez);
    }
    if (!jePosnetekDokazilaUporaben(posnetek, izrez)) throw new Error("EMPTY_IDENTITY_SCREENSHOT");
    return {
      status: "captured",
      imageDataUrl: "data:image/jpeg;base64," + posnetek,
      capturedAt: new Date().toISOString(),
      captureVersion: IDENTITY_EVIDENCE_VERSION,
      viewportOverlaysRemoved: true,
      screenshotReady: true,
      evidenceContractVersion: identityEvidenceContract.CONTRACT_VERSION,
      sourceUrl: stran.url() || varenUrl.toString(),
      sourceLabel: vir.sourceLabel,
    };
  } finally {
    await zapriBrskalnikZaDokazilo(browser);
  }
}

function sestaviImpressumIdentitetoZaDopolnilniPosnetek(identiteta, javniProfil) {
  var subjekt = javniProfil && javniProfil.status === "found" && javniProfil.subjekt;
  if (!identiteta || identiteta.status !== "verified_register" || !identiteta.impressumSourceUrl || !subjekt) return null;
  return Object.assign({}, subjekt, {
    status: "probable_impressum",
    source: "impressum",
    sourceUrl: javniProfil.sourceUrl || identiteta.impressumSourceUrl,
    sourceKind: subjekt.sourceKind || "impressum",
    entityType: subjekt.entityType || "person",
  });
}

async function zajemiDopolnilnoImpressumDokazilo(identiteta, hwk, javniProfil) {
  var impressumIdentiteta = sestaviImpressumIdentitetoZaDopolnilniPosnetek(identiteta, javniProfil);
  if (!impressumIdentiteta) return null;
  var dokazilo = await zajemiDokaziloIdentitete(
    impressumIdentiteta,
    { status: "not_found" },
    hwk,
    javniProfil
  );
  if (!dokazilo) return null;
  return Object.assign({}, dokazilo, {
    evidenceRole: "registered_merchant_impressum_supplement",
    sourceLabel: "Impressum podjetja – dopolnitev registrskih podatkov",
  });
}

function pripraviDokaziloZaOdgovor(dokazilo) {
  if (!dokazilo) return null;
  return identityEvidenceContract.obogatiDokazilo({
    status: dokazilo.status || "captured",
    reason: dokazilo.reason || "",
    imageDataUrl: dokazilo.imageDataUrl || "",
    capturedAt: dokazilo.capturedAt || dokazilo.verifiedAt || "",
    captureVersion: dokazilo.captureVersion || "",
    viewportOverlaysRemoved: dokazilo.viewportOverlaysRemoved === true,
    evidenceMode: dokazilo.evidenceMode || "",
    evidenceRole: dokazilo.evidenceRole || "",
    verifiedAt: dokazilo.verifiedAt || "",
    sourceUrl: dokazilo.sourceUrl,
    sourceLabel: dokazilo.sourceLabel,
    companyId: dokazilo.companyId || "",
    registerNumber: dokazilo.registerNumber || "",
    registerCourt: dokazilo.registerCourt || "",
    screenshotReady: identityEvidenceContract.jePosnetekPrikazljiv(dokazilo),
    evidenceContractVersion: dokazilo.evidenceContractVersion || "",
  });
}

function sestaviOpenRegisterInsolvencnoIskanje(subjekt) {
  var filtri = [
    { field: "city", value: varnoBesedilo(subjekt.kraj, 80) },
    { field: "debtor_kind", value: subjekt.entityType === "company" ? "legal_person" : subjekt.entityType === "person" ? "natural_person" : "unknown" },
  ];
  if (subjekt.companyId) filtri.unshift({ field: "company_id", value: varnoBesedilo(subjekt.companyId, 120) });
  return {
    query: { value: varnoBesedilo(subjekt.entityType === "person" ? pocistiImeOsebe(subjekt.ime) : kanonicniPravniNaziv(subjekt.ime), 180) },
    filters: filtri,
    pagination: { page: 1, per_page: 5 },
  };
}

function sestaviUradneImenskePogoje(subjekt) {
  var vrstaSubjekta = subjekt && subjekt.entityType;
  var varnoIme = vrstaSubjekta === "company" ? kanonicniPravniNaziv(subjekt.ime) : pocistiImeOsebe(subjekt && subjekt.ime);
  var razdeljeno = razdeliImeZaInsolvenco(varnoIme);
  var posebnoImeZIzrecnoVlogo = Boolean(subjekt && Array.isArray(subjekt.vloge) &&
    (jeVerjetnoDaljseOznacenoImeOsebe(varnoIme) || jeVerjetnoPonovljenoOznacenoImeOsebe(varnoIme)) &&
    subjekt.vloge.some(function (vloga) {
      return normaliziraj(vloga && vloga.ime) === normaliziraj(varnoIme) &&
        !/^(?:Neoznačena oseba|Inhaltlich verantwortlich)$/i.test(String(vloga && vloga.vloga || ""));
    }));
  if (vrstaSubjekta === "company" && varnoIme) {
    return { firmaPriimek: varnoBesedilo(varnoIme, 180), ime: "", vrsta: "company" };
  }
  if (vrstaSubjekta === "person" && (jeVerjetnoImeOsebe(varnoIme) || posebnoImeZIzrecnoVlogo) && razdeljeno.vrsta === "person") {
    return { firmaPriimek: razdeljeno.firmaPriimek, ime: razdeljeno.ime, vrsta: "person" };
  }
  return { firmaPriimek: "", ime: "", vrsta: "unknown" };
}

function normaliziraniImenskiDeli(vrednost) {
  return normaliziraj(vrednost).split(/\s+/).filter(Boolean).sort();
}

function seImeDolznikaUjema(iskanoIme, dobljenoIme, vrsta) {
  if (vrsta === "person") {
    iskanoIme = pocistiImeOsebe(iskanoIme);
    dobljenoIme = pocistiImeOsebe(dobljenoIme);
  }
  var iskano = normaliziraj(iskanoIme);
  var dobljeno = normaliziraj(dobljenoIme);
  if (!iskano || !dobljeno) return false;
  if (iskano === dobljeno) return true;
  if (vrsta !== "person") return false;
  var iskaniDeli = normaliziraniImenskiDeli(iskanoIme);
  var dobljeniDeli = normaliziraniImenskiDeli(dobljenoIme);
  return iskaniDeli.length >= 2 && iskaniDeli.length === dobljeniDeli.length && iskaniDeli.every(function (del, index) {
    return del === dobljeniDeli[index];
  });
}

function vrednostOpenRegisterZadetka(kandidat, neposrednaPolja, ugnezdenaPolja) {
  var zadetek = kandidat && typeof kandidat === "object" ? kandidat : {};
  for (var i = 0; i < neposrednaPolja.length; i += 1) {
    if (zadetek[neposrednaPolja[i]]) return String(zadetek[neposrednaPolja[i]]).trim();
  }
  for (var j = 0; j < ugnezdenaPolja.length; j += 1) {
    var zapis = zadetek[ugnezdenaPolja[j][0]];
    if (zapis && zapis[ugnezdenaPolja[j][1]]) return String(zapis[ugnezdenaPolja[j][1]]).trim();
  }
  return "";
}

function presodiOpenRegisterInsolvencniZadetek(kandidat, subjekt) {
  var vrsta = subjekt && subjekt.entityType === "company" ? "company" : "person";
  var imeDolznika = vrednostOpenRegisterZadetka(kandidat,
    ["debtor_name", "debtorName", "name", "full_name"],
    [["debtor", "name"], ["debtor", "full_name"]]);
  if (!seImeDolznikaUjema(subjekt && subjekt.ime, imeDolznika, vrsta)) {
    return { matched: false, reason: "debtor_name_mismatch", debtorName: imeDolznika };
  }
  var krajDolznika = vrednostOpenRegisterZadetka(kandidat,
    ["debtor_city", "debtorCity", "city"],
    [["debtor", "city"], ["location", "city"], ["address", "city"]]);
  if (krajDolznika && subjekt && subjekt.kraj && normaliziraj(krajDolznika) !== normaliziraj(subjekt.kraj)) {
    return { matched: false, reason: "debtor_city_mismatch", debtorName: imeDolznika, debtorCity: krajDolznika };
  }
  var postaDolznika = vrednostOpenRegisterZadetka(kandidat,
    ["debtor_postal_code", "debtorPostalCode", "postal_code", "postalCode", "zip"],
    [["debtor", "postal_code"], ["location", "postal_code"], ["address", "postal_code"]]);
  if (postaDolznika && subjekt && subjekt.postnaStevilka && postaDolznika !== String(subjekt.postnaStevilka)) {
    return { matched: false, reason: "debtor_postal_code_mismatch", debtorName: imeDolznika, debtorPostalCode: postaDolznika };
  }
  var companyId = vrednostOpenRegisterZadetka(kandidat,
    ["company_id", "companyId"], [["debtor", "company_id"]]);
  if (companyId && subjekt && subjekt.companyId && companyId !== String(subjekt.companyId)) {
    return { matched: false, reason: "debtor_company_id_mismatch", debtorName: imeDolznika, companyId: companyId };
  }
  return {
    matched: true,
    reason: krajDolznika || postaDolznika || companyId ? "identity_and_location_match" : "exact_name_with_api_location_filter",
    debtorName: imeDolznika,
    debtorCity: krajDolznika,
    debtorPostalCode: postaDolznika,
    companyId: companyId,
  };
}

function razlogOpenRegisterInsolvencneNapake(status) {
  if (status === 401 || status === 403) return "not_configured";
  if (status === 402) return "insufficient_credits";
  if (status === 429) return "rate_limited";
  return "api_error";
}

async function pridobiOpenRegisterInsolvencnePodrobnosti(kandidat, kljuc) {
  var url = OPENREGISTER_INSOLVENCY_DETAIL + encodeURIComponent(kandidat.id);
  try {
    var odgovor = await fetchZRokom(url, {
      headers: { Authorization: "Bearer " + kljuc, Accept: "application/json", "User-Agent": USER_AGENT },
    }, 12000);
    if (!odgovor.ok) {
      return { id: kandidat.id, status: "unavailable", reason: razlogOpenRegisterInsolvencneNapake(odgovor.status) };
    }
    return { id: kandidat.id, status: "found", proceeding: await odgovor.json() };
  } catch (_) {
    return { id: kandidat.id, status: "unavailable", reason: "network_error" };
  }
}

function razcleniOpravilnoStevilko(vrednost) {
  var ujemanje = String(vrednost || "").trim().match(/^(.+?)\s+(AR|IE|IK|IN)\s+(\d+)\s*\/\s*(\d{2,4})$/i);
  if (!ujemanje) return null;
  return {
    oddelek: ujemanje[1].trim(),
    oznaka: ujemanje[2].toUpperCase(),
    stevilka: ujemanje[3],
    leto: ujemanje[4],
    celotna: [ujemanje[1].trim(), ujemanje[2].toUpperCase(), ujemanje[3] + "/" + ujemanje[4]].join(" "),
  };
}

function razcleniRegistrskiVnosZaInsolvenco(subjekt) {
  var register = String(subjekt && subjekt.registerNumber || "").match(/\b(HRA|HRB|PR|GNR|VR)\s*[- ]?\s*(\d+)\b/i);
  return {
    court: pocistiRegistrskoSodisce(subjekt && subjekt.registerCourt),
    type: register ? register[1].toUpperCase() : "",
    number: register ? register[2] : "",
  };
}

function imaPopolnRegistrskiVnos(register) {
  return Boolean(register && register.court && register.type && register.number);
}

function jeUradnoPotrjenRegistrskiVnos(subjekt) {
  var uradna = subjekt && subjekt.openRegisterIdentity;
  if (!subjekt || subjekt.source !== "openregister" || !uradna || uradna.status !== "verified_api") return false;
  var registrskiVnos = razcleniRegistrskiVnosZaInsolvenco(subjekt);
  var uradniRegistrskiVnos = razcleniRegistrskiVnosZaInsolvenco({
    registerNumber: uradna.registerNumber,
    registerCourt: uradna.registerCourt,
  });
  return imaPopolnRegistrskiVnos(registrskiVnos) && imaPopolnRegistrskiVnos(uradniRegistrskiVnos) &&
    normaliziraj(registrskiVnos.type + " " + registrskiVnos.number) === normaliziraj(uradniRegistrskiVnos.type + " " + uradniRegistrskiVnos.number) &&
    normaliziraj(registrskiVnos.court) === normaliziraj(uradniRegistrskiVnos.court);
}

function pripraviOpenRegisterVnosIzImpressuma(vnos, subjekt) {
  return Object.assign({}, vnos, {
    ime: subjekt && (subjekt.naziv || subjekt.ime) || "",
    registerNumber: subjekt && subjekt.registerNumber || "",
    registerCourt: subjekt && subjekt.registerCourt || "",
    naslov: subjekt && subjekt.naslov || "",
    postnaStevilka: subjekt && subjekt.postnaStevilka || "",
    kraj: subjekt && subjekt.kraj || "",
  });
}

var URADNA_INSOLVENCNA_POLJA = {
  datumOd: "frm_suche:ldi_datumVon:datumHtml5",
  datumDo: "frm_suche:ldi_datumBis:datumHtml5",
  firmaPriimek: "frm_suche:litx_firmaNachName:text",
  ime: "frm_suche:litx_vorname:text",
  kraj: "frm_suche:litx_sitzWohnsitz:text",
  oddelek: "frm_suche:iaz_aktenzeichen:itx_abteilung",
  oznaka: "frm_suche:iaz_aktenzeichen:som_registerzeichen:mysom",
  stevilka: "frm_suche:iaz_aktenzeichen:itx_lfdNr",
  leto: "frm_suche:iaz_aktenzeichen:itx_jahr",
  registrskoSodisce: "frm_suche:ir_registereintrag:som_registergericht:mysom",
  vrstaRegistra: "frm_suche:ir_registereintrag:som_registerart:mysom",
  registrskaStevilka: "frm_suche:ir_registereintrag:itx_registernummer",
};

function sestaviVarnoUradnoWildcardIme(subjekt) {
  var pogoji = sestaviUradneImenskePogoje(subjekt);
  if (!pogoji || pogoji.vrsta !== "company") return "";
  var naziv = String(pogoji.firmaPriimek || "").replace(/\s+/g, " ").trim();
  var pravnaOblika = naziv.search(/\s+(?:GmbH|UG(?:\s*\(haftungsbeschr(?:ä|a)nkt\))?|AG|KG|OHG|GbR|SE|e\.?\s*K\.?)\b/i);
  var jedro = (pravnaOblika > 0 ? naziv.slice(0, pravnaOblika) : naziv).trim();
  var zadnjaBeseda = jedro.match(/([\p{L}\d][\p{L}\d&+.-]*)$/u);
  if (!zadnjaBeseda || jedro.length < 5) return "";
  var beseda = zadnjaBeseda[1];
  // Skoraj celotno zadnjo razlikovalno besedo ohranimo in zamenjamo samo
  // zadnji znak. Tako "Plastics" najde uradni "Plastic", ne da bi iskanje
  // razširili na splošni izraz ali samo pravno obliko.
  var steblo = beseda.length >= 4 ? beseda.slice(0, -1) : beseda;
  if (steblo.length < 2) return "";
  return jedro.slice(0, jedro.length - beseda.length) + steblo + "*";
}

function pripraviStrogUradniInsolvencniVhod(subjekt, opravilo, datumOd, datumDo) {
  var imenskiPogoji = sestaviUradneImenskePogoje(subjekt);
  var register = jeUradnoPotrjenRegistrskiVnos(subjekt)
    ? razcleniRegistrskiVnosZaInsolvenco(subjekt)
    : { court: "", type: "", number: "" };
  var polnNaslov = Boolean(subjekt && String(subjekt.naslov || "").trim().length >= 3 && /\d/.test(subjekt.naslov) &&
    /^\d{5}$/.test(String(subjekt.postnaStevilka || "")) && String(subjekt.kraj || "").trim().length >= 2);
  if (imenskiPogoji.vrsta === "unknown") return { ok: false, reason: "identity_type_unresolved" };
  if (!polnNaslov) return { ok: false, reason: "official_location_missing" };

  var jeOpenRegister = subjekt && (subjekt.source === "openregister" || subjekt.openRegisterIdentity);
  var zaklenjenaIdentiteta = null;
  if (jeOpenRegister) {
    var uradna = subjekt.openRegisterIdentity;
    if (!uradna || uradna.status !== "verified_api") return { ok: false, reason: "openregister_identity_snapshot_missing" };
    if (!uradna.companyId || !uradna.name || !uradna.street || !/^\d{5}$/.test(String(uradna.postalCode || "")) || !uradna.city) {
      return { ok: false, reason: "openregister_official_data_incomplete" };
    }
    var jeRegistriraniNosilec = subjekt.insolvencyIdentityRole === "registered_merchant_owner";
    var imeZaPrimerjavo = jeRegistriraniNosilec ? subjekt.registeredBusinessName : (subjekt.ime || subjekt.naziv);
    var companyIdZaPrimerjavo = jeRegistriraniNosilec ? subjekt.registeredCompanyId : subjekt.companyId;
    var uradnaPoljaSeUjemajo = normaliziraj(imeZaPrimerjavo) === normaliziraj(uradna.name) &&
      normalizirajNaslov(subjekt.naslov) === normalizirajNaslov(uradna.street) &&
      String(subjekt.postnaStevilka) === String(uradna.postalCode) &&
      normaliziraj(subjekt.kraj) === normaliziraj(uradna.city) &&
      String(companyIdZaPrimerjavo || "") === String(uradna.companyId || "") &&
      normaliziraj(subjekt.registerNumber) === normaliziraj(uradna.registerNumber) &&
      normaliziraj(pocistiRegistrskoSodisce(subjekt.registerCourt)) === normaliziraj(pocistiRegistrskoSodisce(uradna.registerCourt));
    if (!uradnaPoljaSeUjemajo) return { ok: false, reason: "openregister_identity_mismatch" };
    if (!imaPopolnRegistrskiVnos(register)) return { ok: false, reason: "openregister_register_incomplete" };
    zaklenjenaIdentiteta = {
      source: "openregister",
      companyId: uradna.companyId,
      officialName: uradna.name,
      officialStreet: uradna.street,
      officialPostalCode: uradna.postalCode,
      officialCity: uradna.city,
      officialRegister: [register.court, register.type + " " + register.number].join(", "),
    };
  }

  return {
    ok: true,
    imenskiPogoji: imenskiPogoji,
    register: register,
    lockedIdentity: zaklenjenaIdentiteta,
    fields: {
      datumOd: datumOd,
      datumDo: datumDo,
      firmaPriimek: imenskiPogoji.firmaPriimek,
      ime: imenskiPogoji.ime,
      kraj: subjekt.kraj,
      oddelek: opravilo ? opravilo.oddelek : "",
      oznaka: opravilo ? opravilo.oznaka : "",
      stevilka: opravilo ? opravilo.stevilka : "",
      leto: opravilo ? opravilo.leto : "",
      registrskoSodisce: imaPopolnRegistrskiVnos(register) ? register.court : "",
      vrstaRegistra: imaPopolnRegistrskiVnos(register) ? register.type : "",
      registrskaStevilka: imaPopolnRegistrskiVnos(register) ? register.number : "",
    },
  };
}

function primerjajUradnaInsolvencnaPolja(pricakovano, dejansko) {
  var izbirnaPolja = ["oznaka", "registrskoSodisce", "vrstaRegistra"];
  var neujemanja = Object.keys(pricakovano || {}).filter(function (kljuc) {
    var normalizator = izbirnaPolja.includes(kljuc) ? normaliziraj : function (vrednost) { return String(vrednost || "").trim(); };
    return normalizator(pricakovano[kljuc]) !== normalizator(dejansko && dejansko[kljuc]);
  });
  return { matched: neujemanja.length === 0, mismatchedFields: neujemanja };
}

function dolociUradnoIzbirnoMoznost(moznosti, iskano, kontekst) {
  var veljavne = (Array.isArray(moznosti) ? moznosti : []).map(function (moznost) {
    return {
      value: String(moznost && moznost.value || ""),
      text: String(moznost && (moznost.text || moznost.label || moznost.value) || "").trim(),
    };
  }).filter(function (moznost) {
    return moznost.value && moznost.text && !/^(?:--|\*)/.test(moznost.text);
  });
  var iskanoBesedilo = pocistiRegistrskoSodisce(iskano);
  var iskanoNormalno = normaliziraj(iskanoBesedilo);
  if (!iskanoNormalno) return null;

  var neposredna = veljavne.find(function (moznost) {
    return normaliziraj(moznost.text) === iskanoNormalno || normaliziraj(moznost.value) === iskanoNormalno;
  });
  if (neposredna) return Object.assign({}, neposredna, {
    matched: true,
    matchMode: "exact",
    sourceText: iskanoBesedilo,
    contextText: String(kontekst || ""),
  });

  var nepomembneBesede = ["amtsgericht", "registergericht", "gericht", "am", "an", "der", "in", "im", "bei", "a", "d", "i"];
  function jedrniDeli(vrednost) {
    return normaliziraj(vrednost).split(/\s+/).filter(function (del) {
      return del.length >= 2 && !nepomembneBesede.includes(del);
    });
  }
  function vsebujeVse(seznam, iskani) {
    return iskani.length > 0 && iskani.every(function (del) { return seznam.includes(del); });
  }
  var iskaniDeli = jedrniDeli(iskanoBesedilo);
  var kontekstNormalno = normaliziraj(kontekst);
  var kontekstDeli = jedrniDeli(kontekst);
  var kandidati = veljavne.map(function (moznost) {
    var deli = jedrniDeli(moznost.text);
    var sorodna = vsebujeVse(deli, iskaniDeli) || vsebujeVse(iskaniDeli, deli);
    if (!sorodna) return null;
    var normalnoBesedilo = normaliziraj(moznost.text);
    var kontekstSeUjema = Boolean(kontekstNormalno && normalnoBesedilo === kontekstNormalno) ||
      Boolean(kontekstDeli.length && (vsebujeVse(deli, kontekstDeli) || vsebujeVse(kontekstDeli, deli)));
    return Object.assign({}, moznost, { contextMatched: kontekstSeUjema });
  }).filter(Boolean);

  if (!kandidati.length) return null;
  var kontekstniKandidati = kandidati.filter(function (kandidat) { return kandidat.contextMatched; });
  var najboljsi = kandidati.length === 1 ? kandidati[0] : (kontekstniKandidati.length === 1 ? kontekstniKandidati[0] : null);
  if (!najboljsi) return null;
  return {
    matched: true,
    value: najboljsi.value,
    text: najboljsi.text,
    matchMode: najboljsi.contextMatched ? "location_disambiguated" : "unique_qualified_name",
    sourceText: iskanoBesedilo,
    contextText: String(kontekst || ""),
  };
}

async function preberiUradnaInsolvencnaPolja(stran) {
  return stran.evaluate(function (polja) {
    var rezultat = {};
    Object.keys(polja).forEach(function (kljuc) {
      var element = document.querySelector('[name="' + polja[kljuc] + '"]');
      if (!element) {
        rezultat[kljuc] = null;
        return;
      }
      if (element.tagName === "SELECT") {
        var moznost = element.options && element.options[element.selectedIndex];
        rezultat[kljuc] = moznost ? String(moznost.textContent || moznost.value || "").trim() : "";
        if (/^(?:--|\*)/.test(rezultat[kljuc])) rezultat[kljuc] = "";
        return;
      }
      rezultat[kljuc] = String(element.value || "").trim();
    });
    return rezultat;
  }, URADNA_INSOLVENCNA_POLJA);
}

async function oznaciUjemajocePodatkeNaUradnemPosnetku(stran, polja) {
  return stran.evaluate(function (nastavitve) {
    var jeIskanaOseba = Boolean(String(nastavitve.polja.ime || "").trim());
    var barve = {
      blue: { rob: "#1769e0", ozadje: "rgba(23, 105, 224, .24)", naziv: jeIskanaOseba ? "Ime in priimek" : "Ime podjetja" },
      green: { rob: "#2d8a68", ozadje: "rgba(45, 138, 104, .14)", naziv: "Kraj" },
      violet: { rob: "#7657bd", ozadje: "rgba(118, 87, 189, .14)", naziv: "Register" },
      amber: { rob: "#b8751d", ozadje: "rgba(184, 117, 29, .15)", naziv: "Zadeva" },
    };
    function normalizirajVrednost(vrednost) {
      return String(vrednost || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    }
    function pobarvaj(element, ton) {
      if (!element || !barve[ton]) return false;
      element.style.setProperty("background-color", barve[ton].ozadje, "important");
      element.style.setProperty("box-shadow", "inset 0 0 0 3px " + barve[ton].rob, "important");
      element.style.setProperty("outline", "2px solid " + barve[ton].rob, "important");
      element.style.setProperty("outline-offset", "1px", "important");
      element.style.setProperty("border-radius", "5px", "important");
      element.dataset.uspesniJezekPrimerjava = ton;
      return true;
    }
    function najdiUradnoPolje(kljuc) {
      var selektor = nastavitve.selektorji[kljuc];
      if (!selektor) return null;
      var neposredno = document.querySelector('[name="' + selektor + '"]') || document.getElementById(selektor);
      if (neposredno) return neposredno;
      var oznake = { firmaPriimek: /Firma\s*\/\s*Nachname/i, ime: /^\s*Vorname\s*$/i };
      var vzorec = oznake[kljuc];
      if (!vzorec) return null;
      var vrstica = Array.from(document.querySelectorAll("tr")).find(function (kandidat) {
        var oznaka = kandidat.querySelector("td, th, label");
        return oznaka && vzorec.test(String(oznaka.textContent || ""));
      });
      return vrstica ? vrstica.querySelector("input, select, textarea") : null;
    }
    var obarvanih = 0;
    var povezavePolj = [
      ["firmaPriimek", "blue"], ["ime", "blue"], ["kraj", "green"],
      ["registrskoSodisce", "violet"], ["vrstaRegistra", "violet"], ["registrskaStevilka", "violet"],
      ["oddelek", "amber"], ["oznaka", "amber"], ["stevilka", "amber"], ["leto", "amber"],
    ];
    povezavePolj.forEach(function (povezava) {
      if (!nastavitve.polja[povezava[0]]) return;
      var element = najdiUradnoPolje(povezava[0]);
      if (pobarvaj(element, povezava[1])) obarvanih += 1;
    });

    var iskaniPojmi = {
      blue: [[nastavitve.polja.firmaPriimek, nastavitve.polja.ime].filter(Boolean).join(" "), nastavitve.polja.firmaPriimek],
      green: [nastavitve.polja.kraj],
      violet: [[nastavitve.polja.vrstaRegistra, nastavitve.polja.registrskaStevilka].filter(Boolean).join(" "), nastavitve.polja.registrskoSodisce],
      amber: [[nastavitve.polja.oddelek, nastavitve.polja.oznaka, nastavitve.polja.stevilka && nastavitve.polja.leto
        ? nastavitve.polja.stevilka + "/" + nastavitve.polja.leto : ""].filter(Boolean).join(" ")],
    };
    Array.from(document.querySelectorAll("table td")).forEach(function (celica) {
      var vsebina = normalizirajVrednost(celica.innerText || celica.textContent);
      Object.keys(iskaniPojmi).some(function (ton) {
        var ujemanje = iskaniPojmi[ton].some(function (pojem) {
          var normalniPojem = normalizirajVrednost(pojem);
          return normalniPojem.length >= 2 && vsebina.indexOf(normalniPojem) >= 0;
        });
        if (ujemanje && pobarvaj(celica, ton)) obarvanih += 1;
        return ujemanje;
      });
    });

    var glava = document.querySelector("main h2");
    if (glava && !document.querySelector("[data-uspesni-jezek-legenda]")) {
      var legenda = document.createElement("div");
      legenda.dataset.uspesniJezekLegenda = "true";
      legenda.style.cssText = "margin:12px 0;padding:10px 12px;border:1px solid #d6e0df;border-radius:8px;background:#fff;color:#294846;font:600 13px/1.35 Arial,sans-serif";
      var naslov = document.createElement("div");
      naslov.textContent = "Barvne oznake za hitro primerjavo (dodal Uspešni Ježek)";
      naslov.style.cssText = "margin-bottom:7px;font-weight:700";
      legenda.appendChild(naslov);
      Object.keys(barve).forEach(function (ton) {
        var imaVrednost = povezavePolj.some(function (povezava) { return povezava[1] === ton && nastavitve.polja[povezava[0]]; });
        if (!imaVrednost) return;
        var znacka = document.createElement("span");
        znacka.textContent = barve[ton].naziv;
        znacka.style.cssText = "display:inline-block;margin:0 6px 4px 0;padding:3px 7px;border:1px solid " + barve[ton].rob + ";border-radius:999px;background:" + barve[ton].ozadje + ";color:#263c3a;font-size:11px";
        legenda.appendChild(znacka);
      });
      var pojasnilo = document.createElement("div");
      pojasnilo.textContent = "Barve so samo vizualna oznaka; podatki in rezultat ostajajo vsebina uradnega portala.";
      pojasnilo.style.cssText = "margin-top:3px;color:#607573;font-size:10px;font-weight:400";
      legenda.appendChild(pojasnilo);
      glava.insertAdjacentElement("afterend", legenda);
    }
    return { status: "applied", highlightedElements: obarvanih, annotationVersion: "colour-linked-proof-v3-visible-person-full-name" };
  }, { polja: polja || {}, selektorji: URADNA_INSOLVENCNA_POLJA });
}

function presodiUradniInsolvencniRezultat(besedilo, subjekt, opravilo, objave, oddanaPolja) {
  var tekst = String(besedilo || "");
  if (/Keine Treffer/i.test(tekst)) return { status: "clear", reason: "no_publication_found" };
  if (/zu viele Treffer|maximale Trefferzahl/i.test(tekst)) return { status: "unavailable", reason: "too_many_results" };
  if (/Fehler in Feld\s*['\u2018\u2019\"]?Registereintrag/i.test(tekst)) {
    return { status: "unavailable", reason: "invalid_register_filter" };
  }
  if (!/Suchergebnis/i.test(tekst)) return { status: "unavailable", reason: "result_page_not_recognized" };
  var vrstice = Array.isArray(objave) ? objave : [];
  var imenskiPogoji = sestaviUradneImenskePogoje(subjekt);
  var dovoljenaImena = [
    subjekt && subjekt.ime,
    subjekt && subjekt.naziv,
    [imenskiPogoji.firmaPriimek, imenskiPogoji.ime].filter(Boolean).join(" "),
  ].concat(subjekt && Array.isArray(subjekt.businessIdentityNames) ? subjekt.businessIdentityNames : [])
    .map(normaliziraj).filter(Boolean);
  var wildcardVhod = String(oddanaPolja && oddanaPolja.firmaPriimek || "").trim();
  var wildcardPredpona = /\*$/.test(wildcardVhod) ? normaliziraj(wildcardVhod.slice(0, -1)) : "";
  var register = razcleniRegistrskiVnosZaInsolvenco(subjekt);
  var ujemanje = vrstice.find(function (objava) {
    var dolznik = normaliziraj(objava && objava.debtorName);
    var imeSeUjema = dovoljenaImena.includes(dolznik) || Boolean(wildcardPredpona && wildcardPredpona.length >= 4 && dolznik.startsWith(wildcardPredpona));
    var krajSeUjema = !subjekt || !subjekt.kraj || normaliziraj(objava && objava.city) === normaliziraj(subjekt.kraj);
    var opraviloSeUjema = !opravilo || normaliziraj(objava && objava.caseNumber) === normaliziraj(opravilo.celotna);
    var registerSeUjema = !register.number || normaliziraj(objava && objava.register).includes(normaliziraj(register.type + " " + register.number));
    return imeSeUjema && krajSeUjema && opraviloSeUjema && registerSeUjema;
  });
  if (ujemanje) {
    return { status: "confirmed_match", reason: wildcardPredpona ? "wildcard_identity_location_register_match" : "same_proceeding_confirmed", matchedPublication: ujemanje };
  }
  return { status: "unverified", reason: "result_identity_mismatch" };
}

async function preveriUradniInsolvencniPortalEnkrat(subjekt, openregisterRezultat) {
  var prviZadetek = openregisterRezultat && Array.isArray(openregisterRezultat.matches)
    ? openregisterRezultat.matches.find(function (zadetek) { return razcleniOpravilnoStevilko(zadetek && zadetek.case_number); })
    : null;
  var opravilo = razcleniOpravilnoStevilko(prviZadetek && prviZadetek.case_number);
  var glavniDatumOd = "2005-01-01";
  var glavniDatumDo = new Date().toISOString().slice(0, 10);
  var strogVhod = pripraviStrogUradniInsolvencniVhod(subjekt, opravilo, glavniDatumOd, glavniDatumDo);
  if (!strogVhod.ok) {
    return {
      status: "unavailable",
      reason: strogVhod.reason,
      source: "official_insolvency_portal",
      sourceLabel: "Insolvenzbekanntmachungen",
      sourceUrl: INSOLVENCY_PORTAL,
      checkedAt: new Date().toISOString(),
      evidenceStatus: "unavailable",
      evidenceVersion: OFFICIAL_INSOLVENCY_EVIDENCE_VERSION,
      inputVerification: { status: "blocked", reason: strogVhod.reason },
    };
  }
  var register = strogVhod.register;
  var imenskiPogoji = strogVhod.imenskiPogoji;
  var browser = await zazeniBrskalnikZaDokazilo();
  try {
    var stran = await browser.newPage();
    await stran.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
    await stran.setUserAgent(BROWSER_USER_AGENT);
    await stran.goto(INSOLVENCY_PORTAL, { waitUntil: "domcontentloaded", timeout: 25000 });

    async function izpolni(ciljnaStran, polje, vrednost) {
      var selector = '[name="' + polje + '"]';
      await ciljnaStran.waitForSelector(selector, { timeout: 12000 });
      await ciljnaStran.$eval(selector, function (element, novaVrednost) {
        element.value = novaVrednost;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }, vrednost || "");
    }

    async function izberiPoBesedilu(ciljnaStran, polje, vrednost, kontekst) {
      if (!vrednost) return null;
      var selector = '[name="' + polje + '"]';
      var moznosti = await ciljnaStran.$eval(selector, function (element) {
        return Array.from(element.options || []).map(function (option) {
          return { value: option.value, text: String(option.textContent || "").trim() };
        });
      });
      var izbor = dolociUradnoIzbirnoMoznost(moznosti, vrednost, kontekst);
      if (!izbor) return null;
      await ciljnaStran.select(selector, izbor.value);
      return izbor;
    }

    async function izvediIskanje(ciljnaStran, datumOd, datumDo, preglasitvePolj) {
      var vhod = pripraviStrogUradniInsolvencniVhod(subjekt, opravilo, datumOd, datumDo);
      if (!vhod.ok) return { ok: false, reason: vhod.reason };
      var oddanaPolja = Object.assign({}, vhod.fields, preglasitvePolj || {});
      var normalizacije = [];
      await izpolni(ciljnaStran, URADNA_INSOLVENCNA_POLJA.datumOd, oddanaPolja.datumOd);
      await izpolni(ciljnaStran, URADNA_INSOLVENCNA_POLJA.datumDo, oddanaPolja.datumDo);
      await izpolni(ciljnaStran, URADNA_INSOLVENCNA_POLJA.firmaPriimek, oddanaPolja.firmaPriimek);
      await izpolni(ciljnaStran, URADNA_INSOLVENCNA_POLJA.ime, oddanaPolja.ime);
      await izpolni(ciljnaStran, URADNA_INSOLVENCNA_POLJA.kraj, oddanaPolja.kraj);
      if (opravilo) {
        await izpolni(ciljnaStran, URADNA_INSOLVENCNA_POLJA.oddelek, vhod.fields.oddelek);
        var oznakaIzbrana = await izberiPoBesedilu(ciljnaStran, URADNA_INSOLVENCNA_POLJA.oznaka, vhod.fields.oznaka);
        if (!oznakaIzbrana) return { ok: false, reason: "official_form_case_option_unavailable" };
        await izpolni(ciljnaStran, URADNA_INSOLVENCNA_POLJA.stevilka, vhod.fields.stevilka);
        await izpolni(ciljnaStran, URADNA_INSOLVENCNA_POLJA.leto, vhod.fields.leto);
      }
      if (imaPopolnRegistrskiVnos(register)) {
        var sodisceIzbrano = await izberiPoBesedilu(ciljnaStran, URADNA_INSOLVENCNA_POLJA.registrskoSodisce, vhod.fields.registrskoSodisce, subjekt.kraj);
        var vrstaIzbrana = sodisceIzbrano && await izberiPoBesedilu(ciljnaStran, URADNA_INSOLVENCNA_POLJA.vrstaRegistra, vhod.fields.vrstaRegistra);
        if (sodisceIzbrano && vrstaIzbrana) {
          oddanaPolja.registrskoSodisce = sodisceIzbrano.text;
          oddanaPolja.vrstaRegistra = vrstaIzbrana.text;
          if (normaliziraj(sodisceIzbrano.sourceText) !== normaliziraj(sodisceIzbrano.text)) {
            normalizacije.push({
              field: "registrskoSodisce",
              sourceValue: sodisceIzbrano.sourceText,
              submittedValue: sodisceIzbrano.text,
              mode: sodisceIzbrano.matchMode,
              context: sodisceIzbrano.contextText,
            });
          }
          await izpolni(ciljnaStran, URADNA_INSOLVENCNA_POLJA.registrskaStevilka, vhod.fields.registrskaStevilka);
        } else {
          return { ok: false, reason: "official_form_register_option_unavailable" };
        }
      }
      var dejanskaPolja = await preberiUradnaInsolvencnaPolja(ciljnaStran);
      var primerjava = primerjajUradnaInsolvencnaPolja(oddanaPolja, dejanskaPolja);
      if (!primerjava.matched) {
        return { ok: false, reason: "official_form_input_mismatch", mismatchedFields: primerjava.mismatchedFields };
      }
      await Promise.all([
        ciljnaStran.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 }).catch(function () {}),
        ciljnaStran.click('[name="frm_suche:cbt_suchen"]'),
      ]);
      await ciljnaStran.waitForFunction(function () {
        return /Suchergebnis|Keine Treffer|zu viele Treffer|Fehler in Feld/i.test(document.body.innerText || "");
      }, { timeout: 20000 });
      return {
        ok: true,
        inputVerification: {
          status: "matched",
          verifiedBeforeSubmit: true,
          fields: dejanskaPolja,
          sourceFields: vhod.fields,
          safeNormalizations: normalizacije,
          lockedIdentity: vhod.lockedIdentity,
        },
      };
    }

    var oddaja = await izvediIskanje(stran, glavniDatumOd, glavniDatumDo);
    if (!oddaja.ok) {
      return {
        status: "unavailable",
        reason: oddaja.reason,
        source: "official_insolvency_portal",
        sourceLabel: "Insolvenzbekanntmachungen",
        sourceUrl: INSOLVENCY_PORTAL,
        checkedAt: new Date().toISOString(),
        evidenceStatus: "unavailable",
        evidenceVersion: OFFICIAL_INSOLVENCY_EVIDENCE_VERSION,
        inputVerification: {
          status: "blocked",
          reason: oddaja.reason,
          mismatchedFields: oddaja.mismatchedFields || [],
        },
      };
    }
    var rezultatBesedilo = await stran.evaluate(function () { return document.body.innerText || ""; });
    var wildcardIme = sestaviVarnoUradnoWildcardIme(subjekt);
    if (/Keine Treffer/i.test(rezultatBesedilo) && wildcardIme && wildcardIme !== oddaja.inputVerification.fields.firmaPriimek) {
      // Uradni portal zahteva natančen naziv. Če registrski/Impressum naziv
      // odstopa za en znak, ponovimo z ozkim wildcardom in nato preverimo
      // dejansko vrnjeno vrstico po imenu, kraju, registru in opravilni številki.
      await stran.goto(INSOLVENCY_PORTAL, { waitUntil: "domcontentloaded", timeout: 25000 });
      oddaja = await izvediIskanje(stran, glavniDatumOd, glavniDatumDo, { firmaPriimek: wildcardIme });
      if (!oddaja.ok) {
        return {
          status: "unavailable",
          reason: oddaja.reason,
          source: "official_insolvency_portal",
          sourceLabel: "Insolvenzbekanntmachungen",
          sourceUrl: INSOLVENCY_PORTAL,
          checkedAt: new Date().toISOString(),
          evidenceStatus: "unavailable",
          evidenceVersion: OFFICIAL_INSOLVENCY_EVIDENCE_VERSION,
          inputVerification: { status: "blocked", reason: oddaja.reason, mismatchedFields: oddaja.mismatchedFields || [] },
        };
      }
      rezultatBesedilo = await stran.evaluate(function () { return document.body.innerText || ""; });
    }
    var objaveMeta = await stran.evaluate(function () {
      return Array.from(document.querySelectorAll('input[alt="Veröffentlichungstext anzeigen"]')).map(function (gumb) {
        var celice = Array.from((gumb.closest("tr") || {}).querySelectorAll ? gumb.closest("tr").querySelectorAll("td") : [])
          .map(function (celica) { return String(celica.innerText || celica.textContent || "").replace(/\s+/g, " ").trim(); });
        return {
          publicationDate: celice[0] || "",
          caseNumber: celice[1] || "",
          court: celice[2] || "",
          debtorName: celice[3] || "",
          city: celice[4] || "",
          register: celice[5] || "",
        };
      });
    });
    var presoja = presodiUradniInsolvencniRezultat(
      rezultatBesedilo, subjekt, opravilo, objaveMeta, oddaja.inputVerification.fields
    );
    var oznakePosnetka = await oznaciUjemajocePodatkeNaUradnemPosnetku(stran, oddaja.inputVerification.fields);
    var posnetek = await stran.screenshot({ type: "jpeg", quality: 72, fullPage: true, encoding: "base64" });
    var uradneObjave = [];
    var steviloObjav = Math.min(objaveMeta.length, 50);
    for (var objavaIndex = 0; objavaIndex < steviloObjav; objavaIndex += 1) {
      var objavaStran = await browser.newPage();
      await objavaStran.setViewport({ width: 1100, height: 850, deviceScaleFactor: 1 });
      await objavaStran.setUserAgent(BROWSER_USER_AGENT);
      var datumUjemanje = String(objaveMeta[objavaIndex].publicationDate || "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      var datumObjave = datumUjemanje ? [datumUjemanje[3], datumUjemanje[2], datumUjemanje[1]].join("-") : "2005-01-01";
      var besediloObjave = "";
      try {
        await objavaStran.goto(INSOLVENCY_PORTAL, { waitUntil: "domcontentloaded", timeout: 25000 });
        var oddajaObjave = await izvediIskanje(objavaStran, datumObjave, datumObjave, {
          firmaPriimek: oddaja.inputVerification.fields.firmaPriimek,
        });
        if (!oddajaObjave.ok) throw new Error(oddajaObjave.reason || "OFFICIAL_PUBLICATION_SEARCH_INPUT_REJECTED");
        var prviGumbObjave = await objavaStran.$('input[alt="Veröffentlichungstext anzeigen"]');
        if (prviGumbObjave) {
          await prviGumbObjave.click();
          await objavaStran.waitForFunction(function () {
            var polje = document.querySelector('[name="frm_text:ihd_text"], [id="frm_text:ihd_text"]');
            return Boolean(polje && polje.value);
          }, { timeout: 8000 });
          besediloObjave = await objavaStran.$eval('[name="frm_text:ihd_text"], [id="frm_text:ihd_text"]', function (polje) {
            return String(polje.value || "").trim();
          });
        }
      } catch (_) {
        besediloObjave = "";
      } finally {
        await objavaStran.close();
      }
      if (besediloObjave && !uradneObjave.some(function (objava) { return objava.text === besediloObjave; })) {
        uradneObjave.push(Object.assign({}, objaveMeta[objavaIndex], { text: besediloObjave }));
      }
    }
    var dokaziloJeVeljavno = presoja.status !== "unavailable";
    return Object.assign({}, presoja, {
      source: "official_insolvency_portal",
      sourceLabel: "Insolvenzbekanntmachungen",
      sourceUrl: INSOLVENCY_PORTAL,
      checkedAt: new Date().toISOString(),
      searchedName: [oddaja.inputVerification.fields.firmaPriimek, oddaja.inputVerification.fields.ime].filter(Boolean).join(" "),
      searchedCity: subjekt.kraj,
      searchedCaseNumber: opravilo ? opravilo.celotna : "",
      searchedRegister: imaPopolnRegistrskiVnos(register)
        ? [oddaja.inputVerification.fields.registrskoSodisce || register.court, register.type + " " + register.number].join(", ")
        : "",
      publications: uradneObjave,
      publicationCount: objaveMeta.length,
      publicationsLimited: objaveMeta.length > steviloObjav,
      evidenceStatus: dokaziloJeVeljavno ? "captured" : "unavailable",
      evidenceVersion: OFFICIAL_INSOLVENCY_EVIDENCE_VERSION,
      inputVerification: oddaja.inputVerification,
      screenshotAnnotation: oznakePosnetka,
      evidenceImage: dokaziloJeVeljavno ? "data:image/jpeg;base64," + posnetek : "",
    });
  } finally {
    await zapriBrskalnikZaDokazilo(browser);
  }
}

async function preveriUradniInsolvencniPortal(subjekt, openregisterRezultat) {
  var zadnjaNapaka;
  for (var poskus = 0; poskus < 2; poskus += 1) {
    try {
      var rezultat = await preveriUradniInsolvencniPortalEnkrat(subjekt, openregisterRezultat);
      var jeZacasnaNapaka = rezultat && rezultat.status === "unavailable" && [
        "result_page_not_recognized",
        "capture_or_search_failed",
      ].includes(rezultat.reason);
      if (!jeZacasnaNapaka || poskus === 1) return rezultat;
    } catch (napaka) {
      zadnjaNapaka = napaka;
      if (poskus === 1) throw napaka;
    }
    await new Promise(function (resolve) { setTimeout(resolve, 700); });
  }
  throw zadnjaNapaka || new Error("OFFICIAL_INSOLVENCY_CHECK_FAILED");
}

function sestaviRezultatSamoUradnegaPortala(subjekt, uradniRezultat, openregisterFallbackReason) {
  var uradni = uradniRezultat || { status: "unavailable", reason: "capture_or_search_failed", evidenceStatus: "unavailable" };
  return {
    status: uradni.status === "confirmed_match" ? "possible_match" : uradni.status === "clear" ? "clear" : "unavailable",
    reason: uradni.reason || "",
    verificationMode: "official_portal_only",
    openregisterUsed: false,
    openregisterFallbackReason: varnoBesedilo(openregisterFallbackReason, 80),
    searchedName: varnoBesedilo(uradni.searchedName || subjekt && subjekt.ime, 180),
    searchedCity: varnoBesedilo(subjekt && subjekt.kraj, 80),
    searchedPostalCode: varnoBesedilo(subjekt && subjekt.postnaStevilka, 5),
    source: "official_insolvency_portal",
    sourceLabel: "Insolvenzbekanntmachungen",
    sourceUrl: INSOLVENCY_PORTAL,
    checkedAt: uradni.checkedAt || new Date().toISOString(),
    evidenceStatus: uradni.evidenceStatus || "unavailable",
    officialVerification: uradni,
  };
}

async function preveriSamoUradniInsolvencniPortalVarno(subjekt, openregisterFallbackReason) {
  try {
    return sestaviRezultatSamoUradnegaPortala(
      subjekt,
      await preveriUradniInsolvencniPortal(subjekt, null),
      openregisterFallbackReason
    );
  } catch (napakaUradnegaVira) {
    console.error("[mehka-boniteta:official-only-insolvency]", napakaUradnegaVira.message);
    return sestaviRezultatSamoUradnegaPortala(subjekt, {
      status: "unavailable",
      reason: "capture_or_search_failed",
      source: "official_insolvency_portal",
      sourceLabel: "Insolvenzbekanntmachungen",
      sourceUrl: INSOLVENCY_PORTAL,
      checkedAt: new Date().toISOString(),
      evidenceStatus: "unavailable",
    }, openregisterFallbackReason);
  }
}

function pripraviIdentitetoZaInsolvencnoPoizvedbo(identiteta) {
  if (!identiteta || !jeRegistriraniTrgovecOpenRegister({
    name: identiteta.ime || identiteta.naziv,
    legal_form: identiteta.legalForm,
  })) return identiteta;
  var nosilec = pocistiImeOsebe(identiteta.nosilec);
  if (!jeVerjetnoImeOsebe(nosilec)) return identiteta;
  return Object.assign({}, identiteta, {
    entityType: "person",
    ime: nosilec,
    companyId: "",
    registeredCompanyId: identiteta.companyId || "",
    insolvencyIdentityRole: "registered_merchant_owner",
    registeredBusinessName: identiteta.ime || identiteta.naziv || "",
  });
}

async function preveriInsolvenco(subjekt, moznosti) {
  var preverjeniImenskiPogoji = sestaviUradneImenskePogoje(subjekt);
  if (preverjeniImenskiPogoji.vrsta === "unknown") {
    return { status: "not_checked", reason: "identity_type_unresolved" };
  }
  var uporabiOpenRegister = !moznosti || moznosti.uporabiOpenRegister !== false;
  if (!uporabiOpenRegister) {
    return preveriSamoUradniInsolvencniPortalVarno(subjekt, "disabled");
  }
  var kljuc = String(process.env.OPENREGISTER_API_KEY || "").trim();
  var iskanoOb = new Date().toISOString();
  var iskalniPodatki = {
    name: varnoBesedilo(subjekt.ime, 180),
    city: varnoBesedilo(subjekt.kraj, 80),
    postalCode: varnoBesedilo(subjekt.postnaStevilka, 5),
    companyId: varnoBesedilo(subjekt.companyId, 120),
    debtorKind: subjekt.entityType === "company" ? "legal_person" : "natural_person",
  };
  if (!kljuc) {
    return preveriSamoUradniInsolvencniPortalVarno(subjekt, "not_configured");
  }

  var zahteva = sestaviOpenRegisterInsolvencnoIskanje(subjekt);
  var odgovor;
  try {
    odgovor = await fetchZRokom(OPENREGISTER_INSOLVENCY_SEARCH, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + kljuc,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(zahteva),
    }, 12000);
  } catch (_) {
    return preveriSamoUradniInsolvencniPortalVarno(subjekt, "network_error");
  }
  if (!odgovor.ok) {
    return preveriSamoUradniInsolvencniPortalVarno(subjekt, razlogOpenRegisterInsolvencneNapake(odgovor.status));
  }

  var podatki = await odgovor.json();
  var vsiZadetki = Array.isArray(podatki.results) ? podatki.results : [];
  var presojeZadetkov = vsiZadetki.map(function (kandidat) {
    return { kandidat: kandidat, presoja: presodiOpenRegisterInsolvencniZadetek(kandidat, subjekt) };
  });
  var zadetki = presojeZadetkov.filter(function (zapis) { return zapis.presoja.matched; })
    .map(function (zapis) { return zapis.kandidat; });
  var zavrnjeniZadetki = presojeZadetkov.filter(function (zapis) { return !zapis.presoja.matched; });
  var podrobnosti = await Promise.all(zadetki.map(function (kandidat) {
    return pridobiOpenRegisterInsolvencnePodrobnosti(kandidat, kljuc);
  }));
  var rezultat = {
    status: zadetki.length ? "possible_match" : "clear",
    searchedName: iskalniPodatki.name,
    searchedCity: iskalniPodatki.city,
    searchedPostalCode: iskalniPodatki.postalCode,
    searchedCompanyId: iskalniPodatki.companyId,
    source: "openregister_insolvency_api",
    sourceLabel: "OpenRegister Insolvency API",
    apiSourceUrl: "https://docs.openregister.de/endpoint/search-insolvency",
    sourceUrl: INSOLVENCY_PORTAL,
    checkedAt: iskanoOb,
    evidenceStatus: "verified_api",
    totalResults: podatki.pagination && Number(podatki.pagination.total_results) || vsiZadetki.length,
    matchingResults: zadetki.length,
    ignoredResults: zavrnjeniZadetki.length,
    detailsLimited: Boolean(podatki.pagination && Number(podatki.pagination.total_results) > vsiZadetki.length),
    matches: zadetki,
    apiEvidence: {
      sourceLabel: "OpenRegister Insolvency API",
      endpoint: OPENREGISTER_INSOLVENCY_SEARCH,
      searchedAt: iskanoOb,
      searchedData: iskalniPodatki,
      request: zahteva,
      response: podatki,
      matchAssessment: presojeZadetkov.map(function (zapis) { return zapis.presoja; }),
      details: podrobnosti,
    },
  };
  try {
    rezultat.officialVerification = await preveriUradniInsolvencniPortal(subjekt, rezultat);
  } catch (napakaUradnegaVira) {
    console.error("[mehka-boniteta:official-insolvency]", napakaUradnegaVira.message);
    rezultat.officialVerification = {
      status: "unavailable",
      reason: "capture_or_search_failed",
      source: "official_insolvency_portal",
      sourceLabel: "Insolvenzbekanntmachungen",
      sourceUrl: INSOLVENCY_PORTAL,
      checkedAt: new Date().toISOString(),
      evidenceStatus: "unavailable",
    };
  }
  if (rezultat.officialVerification.status === "confirmed_match") rezultat.status = "possible_match";
  return rezultat;
}

function sestaviSklep(identiteta, insolvenca, javniProfil) {
  if (!identiteta || identiteta.status === "unresolved") {
    var razlogProfila = javniProfil && javniProfil.reason;
    var sporocila = {
      website_not_public: "Vnesena povezava ni veljaven javni spletni naslov.",
      website_redirect_failed: "Spletna stran ima napačno ali predolgo verigo preusmeritev.",
      website_not_html: "Povezava ne vodi do berljive HTML spletne strani.",
      website_too_large: "Stran je prevelika za varno branje. Vnesite neposredno povezavo do Impressuma.",
      website_unreachable: "Spletna stran se ni odzvala ali je blokirala varen samodejni dostop. Poskusite ponovno ali vnesite neposredni URL Impressuma.",
      website_server_error: "Spletni strežnik podjetja po več poskusih še vedno vrača napako " + (javniProfil && javniProfil.httpStatus || "5xx") + ". Brez vsebine Impressuma identitete in insolvenčne preverbe ni varno izvesti.",
      website_rate_limited: "Spletni strežnik podjetja začasno omejuje dostop (429). Sistem je poizvedbo večkrat ponovil; poskusite pozneje.",
      legal_source_context_mismatch: "Varnostno varovalo je zavrnilo preusmeritev na Impressum druge poslovalnice ali pravnega subjekta. Napačni podatki niso bili sprejeti.",
      entered_postal_context_mismatch: "Impressum druge poslovalnice ali subjekta ima drugačno poštno številko. Napačni podatki niso bili sprejeti.",
      entered_city_context_mismatch: "Impressum druge poslovalnice ali subjekta ima drug kraj. Napačni podatki niso bili sprejeti.",
      entered_street_context_mismatch: "Impressum druge poslovalnice ali subjekta ima drug naslov. Napačni podatki niso bili sprejeti.",
      legal_identity_incomplete: "Impressum je najden, vendar v njem manjka zanesljivo pravno ime ali celoten naslov.",
      holder_not_reliably_identified: "Impressum je najden, vendar osebnega nosilca ni bilo mogoče dovolj zanesljivo prepoznati.",
      impressum_not_found: "Povezava do Impressuma ni bila najdena. Odprite Impressum in vnesite njegov neposredni URL.",
    };
    return {
      level: "yellow",
      title: "Identitete ni bilo mogoče potrditi",
      message: sporocila[razlogProfila] || "Preverjeni viri niso vrnili dovolj zanesljivega pravnega imena za insolvenčno preverbo.",
    };
  }
  if (insolvenca && insolvenca.reason === "identity_evidence_unavailable") {
    return { level: "yellow", title: "Vira ni bilo mogoče prikazati", message: "Podatki so najdeni, vendar posnetka oziroma dokazila vira ni bilo mogoče pripraviti. Insolvenčna poizvedba ni bila izvedena." };
  }
  if (identiteta.status === "probable_impressum") {
    return { level: "yellow", title: "Preverite razbrane podatke", message: "Sistem je podatke razbral iz Impressuma. Primerjajte jih s posnetkom, po potrebi popravite in potrdite insolvenčno poizvedbo." };
  }
  if (identiteta.status === "manual_input") {
    return { level: "yellow", title: "Ročni podatki nimajo preverljivega vira", message: "Dodajte spletno stran z dejanskim Impressumom ali vključite OpenRegister. Insolvenčne poizvedbe samo iz ročno vnesenih podatkov ne izvedemo." };
  }
  if (insolvenca && insolvenca.reason === "location_mismatch") {
    return { level: "red", title: "Naslov se ne ujema z uradnim virom", message: "Najdeno podjetje ali obrtnik ima drugačen naslov, kraj ali poštno številko. Insolvenčna preverba ni bila izvedena." };
  }
  if (insolvenca && insolvenca.reason === "location_unverifiable") {
    return { level: "yellow", title: "Lokacije ni bilo mogoče potrditi", message: "Uradni vir nima vseh podatkov za zanesljivo primerjavo naslova. Insolvenčna preverba ni bila izvedena." };
  }
  if (insolvenca && insolvenca.reason === "identity_type_unresolved") {
    return { level: "yellow", title: "Pravna vloga osebe ni dovolj jasna", message: "Prikazanega naziva ni mogoče zanesljivo razvrstiti kot osebo ali podjetje. Insolvenčna poizvedba zato ni bila izvedena." };
  }
  if (insolvenca && insolvenca.status === "not_checked") {
    return { level: "yellow", title: "Podatki čakajo na vašo potrditev", message: "Insolvenčna poizvedba se izvede šele, ko pregledate prikazane podatke in kliknete potrditev." };
  }
  if (!insolvenca || insolvenca.status === "unavailable") {
    if (insolvenca && insolvenca.verificationMode === "official_portal_only") {
      return { level: "yellow", title: "Uradna insolvenčna preverba ni uspela", message: "Portala Insolvenzbekanntmachungen ni bilo mogoče zanesljivo preveriti ali posneti. Poskusite ponovno pozneje." };
    }
    return { level: "yellow", title: "Identiteta je najdena, insolvenčna preverba ni uspela", message: "Poizvedbo ponovite pozneje." };
  }
  if (insolvenca.status === "possible_match") {
    if (insolvenca.verificationMode === "official_portal_only") {
      return { level: "red", title: "Najdena je možna insolvenčna objava", message: "Uradni portal Insolvenzbekanntmachungen je vrnil možen postopek za potrjeno ime in kraj. Pred sodelovanjem preglejte objavo in posnetek." };
    }
    if (insolvenca.officialVerification && insolvenca.officialVerification.status === "confirmed_match") {
      return { level: "red", title: "Insolvenčna objava je potrjena v dveh virih", message: "Isti postopek sta vrnila OpenRegister in uradni portal Insolvenzbekanntmachungen. Pred sodelovanjem preglejte uradno objavo." };
    }
    return { level: "red", title: "Najdena je možna insolvenčna objava", message: "OpenRegister je vrnil možen postopek, vendar ga uradni portal ni dokončno potrdil. Potreben je ročni pregled." };
  }
  if (!insolvenca.officialVerification || insolvenca.officialVerification.status !== "clear") {
    return { level: "yellow", title: "Uradna insolvenčna preverba ni dokončana", message: "OpenRegister ni vrnil zadetka, vendar uradni portal rezultata ni zanesljivo potrdil." };
  }
  if (identiteta.status === "confirmed_impressum") {
    if (insolvenca.verificationMode === "official_portal_only") {
      return { level: "yellow", title: "Mehka preverba prek uradnega insolvenčnega registra", message: "Uradni portal za uporabniško potrjeno ime in kraj ni vrnil insolvenčne objave. To ni popolna bonitetna garancija." };
    }
    return { level: "yellow", title: "Mehka preverba z uporabniško potrditvijo", message: "OpenRegister za uporabniško potrjeno ime in kraj ni vrnil publikacije. To ni uradna potrditev identitete ali solventnosti." };
  }
  if (identiteta.status === "confirmed_manual") {
    return { level: "yellow", title: "Insolvenčna poizvedba je izvedena z ročnim vnosom", message: "Za uporabniško potrjeno ime in kraj ni bila najdena insolvenčna objava. Identiteta ni bila potrjena z registrom ali Impressumom, zato to ni dokaz solventnosti." };
  }
  return { level: "green", title: "Osnovna mehka preverba je uspešna", message: "OpenRegister in uradni portal za preverjene iskalne podatke nista vrnila insolvenčne publikacije." };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return odgovorJson(res, 405, { ok: false, napaka: "Samo POST." });
  if (!req._mehkaBonitetaInternalUser && String(process.env.MEHKA_BONITETA_LEGACY_DIRECT || "").toLowerCase() !== "true") {
    return odgovorJson(res, 409, {
      ok: false,
      code: "QUEUE_REQUIRED",
      napaka: "Preverjanje mora biti zaradi zaščite uradnih virov izvedeno prek čakalne vrste.",
    });
  }

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
  // Delavec čakalne vrste lahko po že opravljenem preverjanju lastništva poda
  // internega uporabnika. Te lastnosti ni mogoče nastaviti prek HTTP telesa.
  var auth = req._mehkaBonitetaInternalUser
    ? { ok: true, user: req._mehkaBonitetaInternalUser }
    : await db.preveriUporabnika(req, cfg);
  if (!auth.ok) return odgovorJson(res, auth.status, { ok: false, napaka: auth.napaka });

  var telo = req.body && typeof req.body === "object" ? req.body : {};
  var vnos = pripraviVnosZaPreverbo(telo);
  var popolnRocniVnos = Boolean(vnos.ime && vnos.naslov.length >= 3 && /^\d{5}$/.test(vnos.postnaStevilka) && vnos.kraj.length >= 2);
  if (!vnos.spletnaStran && !popolnRocniVnos) {
    return odgovorJson(res, 400, { ok: false, code: "INVALID_INPUT", napaka: "Vnesite spletno stran ali pa ročno izpolnite ime in celoten naslov podjetja." });
  }
  try {
    var openregisterIdentitetaVklopljena = uporabiOpenRegisterZaIdentiteto(telo);
    var openregisterOsnovniVnos = pripraviOpenRegisterVnosZaPotrditev(telo, vnos);
    var openregister = openregisterIdentitetaVklopljena && openregisterOsnovniVnos.ime
      ? await poisciOpenRegister(openregisterOsnovniVnos)
      : openregisterIdentitetaVklopljena
        ? { status: "not_found", sourceUrl: OPENREGISTER_WEB }
        : { status: "disabled", reason: "user_disabled_identity_lookup", sourceUrl: OPENREGISTER_WEB };
    var dopolniRegistriranegaTrgovca = potrebujeImpressumDopolnitev(openregister, vnos);
    var javniProfil = openregister.status === "found" && !dopolniRegistriranegaTrgovca
      ? { status: "skipped", reason: "openregister_identity_verified", sourceUrl: vnos.spletnaStran || "" }
      : await poisciVImpressumu(vnos);
    if (dopolniRegistriranegaTrgovca && javniProfil.status === "found") {
      var ujemanjeDopolnitve = preveriImpressumDopolnitevRegistriranegaTrgovca(openregister, javniProfil);
      if (!ujemanjeDopolnitve.matched) {
        javniProfil = Object.assign({}, javniProfil, {
          status: "rejected",
          reason: "registered_merchant_impressum_" + ujemanjeDopolnitve.reason,
        });
      }
    }
    if (openregisterIdentitetaVklopljena && openregister.status !== "found" && javniProfil.status === "found" && javniProfil.subjekt) {
      var openregisterVnos = pripraviOpenRegisterVnosIzImpressuma(vnos, javniProfil.subjekt);
      if (openregisterVnos.ime) openregister = await poisciOpenRegister(openregisterVnos);
    }

    var hwk = { status: "disabled", reason: "temporarily_disabled" };
    var identiteta = sestaviIdentiteto(openregister, hwk, javniProfil, vnos);
    if (identiteta.status === "unresolved" && popolnRocniVnos) {
      identiteta = sestaviRocnoIdentiteto(vnos) || identiteta;
    }
    var viri = sestaviVire(openregister, hwk, javniProfil, vnos);
    if (identiteta.status === "unresolved") {
      return odgovorJson(res, 200, {
        ok: true,
        checkedAt: new Date().toISOString(),
        scope: "Nemčija – mehka preverba",
        identity: identiteta,
        sources: viri,
        openregister: openregister,
        hwk: hwk,
        publicProfile: javniProfil,
        identityEvidence: { status: "not_captured", reason: "identity_not_resolved" },
        insolvency: { status: "not_checked", reason: "identity_not_resolved" },
        result: sestaviSklep(identiteta, null, javniProfil),
      });
    }

    // Ročno prepisani podatki niso dokaz pravne identitete. Prikazujemo jih
    // uporabniku, vendar z njimi ne smemo sprožiti uradne insolvenčne poizvedbe.
    // Za nadaljevanje je potreben dejanski Impressum ali registrski zadetek.
    if (identiteta.status === "manual_input") {
      var brezPreverljivegaVira = { status: "not_checked", reason: "identity_source_required" };
      return odgovorJson(res, 200, {
        ok: true,
        checkedAt: new Date().toISOString(),
        scope: "Nemčija – mehka preverba",
        confirmationRequired: false,
        identity: identiteta,
        identityEvidence: { status: "unavailable", reason: "user_input_is_not_evidence" },
        sources: viri,
        openregister: openregister,
        hwk: hwk,
        publicProfile: javniProfil,
        insolvency: brezPreverljivegaVira,
        result: sestaviSklep(identiteta, brezPreverljivegaVira, javniProfil),
      });
    }

    var dokaziloIdentitete = null;
    if (!dokaziloIdentitete || (dokaziloIdentitete.status === "captured" && !identityEvidenceContract.jePosnetekPrikazljiv(dokaziloIdentitete))) {
      try {
        dokaziloIdentitete = await zajemiDokaziloIdentitete(identiteta, openregister, hwk, javniProfil);
      } catch (napakaDokazilaIdentitete) {
        console.error("[mehka-boniteta:identity-evidence]", napakaDokazilaIdentitete.message);
      }
    }
    if (!dokaziloIdentitete) {
      var nepreverjenaInsolvenca = { status: "not_checked", reason: "identity_evidence_unavailable" };
      var virNeuspelegaDokazila = dolociVirDokazilaIdentitete(identiteta, openregister, hwk, javniProfil) || {};
      return odgovorJson(res, 200, {
        ok: true,
        checkedAt: new Date().toISOString(),
        scope: "Nemčija – mehka preverba",
        identity: identiteta,
        identityEvidence: {
          status: "unavailable",
          reason: "capture_failed",
          sourceUrl: virNeuspelegaDokazila.sourceUrl || identiteta.sourceUrl || "",
          sourceLabel: virNeuspelegaDokazila.sourceLabel || "Vir identitete",
        },
        sources: viri,
        openregister: openregister,
        hwk: hwk,
        publicProfile: javniProfil,
        insolvency: nepreverjenaInsolvenca,
        result: sestaviSklep(identiteta, nepreverjenaInsolvenca, javniProfil),
      });
    }

    var dokaziloIdentiteteOdgovor = pripraviDokaziloZaOdgovor(dokaziloIdentitete);
    var dokaziloImpressuma = null;
    if (identiteta.status === "verified_register" && identiteta.impressumSourceUrl) {
      try {
        dokaziloImpressuma = await zajemiDopolnilnoImpressumDokazilo(identiteta, hwk, javniProfil);
      } catch (napakaDokazilaImpressuma) {
        console.error("[mehka-boniteta:impressum-evidence]", napakaDokazilaImpressuma.message);
        dokaziloImpressuma = {
          status: "unavailable",
          reason: "capture_failed",
          sourceUrl: identiteta.impressumSourceUrl,
          sourceLabel: "Impressum podjetja – dopolnitev registrskih podatkov",
          evidenceRole: "registered_merchant_impressum_supplement",
        };
      }
    }
    var dokaziloImpressumaOdgovor = pripraviDokaziloZaOdgovor(dokaziloImpressuma);
    var potrditev = pripraviPotrditevIdentitete(telo, identiteta);
    if (potrditev.status === "invalid") {
      var sporocilaPotrditve = {
        confirmation_missing: "Potrdite, da ste podatke primerjali s prikazanim virom.",
        confirmed_data_incomplete: "Vnesite veljavno ime, ulico s hišno številko, poštno številko in kraj.",
        confirmed_business_name_invalid: "Poslovni naziv ne sme biti spletni naslov, domena ali kontaktno polje.",
        confirmed_person_is_business_identity: "Izbrani zapis je v viru označen kot poslovni naziv, ne kot oseba. Preverite vrstico z nosilcem ali zastopnikom.",
        confirmed_representative_invalid: "Nosilec oziroma zastopnik mora biti zanesljivo prepoznano osebno ime.",
        identity_unavailable: "Identiteta za to potrditev ni več na voljo. Preverjanje začnite znova.",
        official_data_mismatch: "Pri registriranem podjetju se potrjeni podatki ne ujemajo z OpenRegister. Popravite vnos ali začnite novo preverjanje.",
      };
      return odgovorJson(res, 400, {
        ok: false,
        code: "INVALID_IDENTITY_CONFIRMATION",
        napaka: sporocilaPotrditve[potrditev.reason] || "Potrditve podatkov ni bilo mogoče sprejeti.",
      });
    }
    if (potrditev.status === "not_provided") {
      var cakaNaPotrditev = { status: "not_checked", reason: "user_confirmation_required" };
      return odgovorJson(res, 200, {
        ok: true,
        checkedAt: new Date().toISOString(),
        scope: "Nemčija – mehka preverba",
        confirmationRequired: true,
        identity: identiteta,
        identityEvidence: dokaziloIdentiteteOdgovor,
        impressumEvidence: dokaziloImpressumaOdgovor,
        sources: viri,
        openregister: openregister,
        hwk: hwk,
        publicProfile: javniProfil,
        insolvency: cakaNaPotrditev,
        result: sestaviSklep(identiteta, cakaNaPotrditev, javniProfil),
      });
    }

    identiteta = potrditev.identity;
    var potrjenaLokacija = {
      status: "matched",
      confirmationType: identiteta.status === "confirmed_impressum"
        ? "user_confirmed"
        : identiteta.status === "confirmed_manual" ? "manual_user_confirmed" : "official_register",
      entered: { naslov: identiteta.naslov, postnaStevilka: identiteta.postnaStevilka, kraj: identiteta.kraj },
      official: { naslov: identiteta.naslov, postnaStevilka: identiteta.postnaStevilka, kraj: identiteta.kraj },
      fields: { naslov: true, postnaStevilka: true, kraj: true },
      missingFields: [],
      mismatchedFields: [],
    };
    var insolvenca;
    try {
      insolvenca = await preveriInsolvenco(
        pripraviIdentitetoZaInsolvencnoPoizvedbo(identiteta),
        { uporabiOpenRegister: openregisterIdentitetaVklopljena }
      );
    } catch (insolventnaNapaka) {
      console.error("[mehka-boniteta:insolvency]", insolventnaNapaka.message);
      insolvenca = { status: "unavailable", reason: "unexpected_error", sourceUrl: INSOLVENCY_PORTAL };
    }
    return odgovorJson(res, 200, {
      ok: true,
      checkedAt: new Date().toISOString(),
      scope: "Nemčija – mehka preverba",
      confirmationRequired: false,
      identity: identiteta,
      identityEvidence: dokaziloIdentiteteOdgovor,
      impressumEvidence: dokaziloImpressumaOdgovor,
      locationMatch: potrjenaLokacija,
      sources: viri,
      openregister: openregister,
      hwk: hwk,
      publicProfile: javniProfil,
      insolvency: insolvenca,
      result: sestaviSklep(identiteta, insolvenca, javniProfil),
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
  sestaviOpenRegisterInsolvencnoIskanje: sestaviOpenRegisterInsolvencnoIskanje,
  sestaviUradneImenskePogoje: sestaviUradneImenskePogoje,
  seImeDolznikaUjema: seImeDolznikaUjema,
  presodiOpenRegisterInsolvencniZadetek: presodiOpenRegisterInsolvencniZadetek,
  razlogOpenRegisterInsolvencneNapake: razlogOpenRegisterInsolvencneNapake,
  razcleniOpravilnoStevilko: razcleniOpravilnoStevilko,
  razcleniRegistrskiVnosZaInsolvenco: razcleniRegistrskiVnosZaInsolvenco,
  imaPopolnRegistrskiVnos: imaPopolnRegistrskiVnos,
  jeUradnoPotrjenRegistrskiVnos: jeUradnoPotrjenRegistrskiVnos,
  pripraviStrogUradniInsolvencniVhod: pripraviStrogUradniInsolvencniVhod,
  sestaviVarnoUradnoWildcardIme: sestaviVarnoUradnoWildcardIme,
  primerjajUradnaInsolvencnaPolja: primerjajUradnaInsolvencnaPolja,
  dolociUradnoIzbirnoMoznost: dolociUradnoIzbirnoMoznost,
  presodiUradniInsolvencniRezultat: presodiUradniInsolvencniRezultat,
  preveriUradniInsolvencniPortal: preveriUradniInsolvencniPortal,
  dolociVirDokazilaIdentitete: dolociVirDokazilaIdentitete,
  sestaviPojmeDokazilaIdentitete: sestaviPojmeDokazilaIdentitete,
  sestaviObveznePojmeDokazilaIdentitete: sestaviObveznePojmeDokazilaIdentitete,
  skrajsajNazivZaDokazilo: skrajsajNazivZaDokazilo,
  dolociIzrezIdentitete: dolociIzrezIdentitete,
  pocakajNaIzrezIdentitete: pocakajNaIzrezIdentitete,
  pripraviZakasnjenoVsebinoDokazila: pripraviZakasnjenoVsebinoDokazila,
  jePosnetekDokazilaUporaben: jePosnetekDokazilaUporaben,
  analizirajSivinoPosnetka: analizirajSivinoPosnetka,
  jePosnetekZatemnjenZaradiSloja: jePosnetekZatemnjenZaradiSloja,
  jePosnetekSkorajPrazen: jePosnetekSkorajPrazen,
  ponovnoZajemiImpressumBrezSkript: ponovnoZajemiImpressumBrezSkript,
  skrijPiskotkovnoPasicoZaPosnetek: skrijPiskotkovnoPasicoZaPosnetek,
  zazeniBrskalnikZaDokazilo: zazeniBrskalnikZaDokazilo,
  zajemiDokaziloIdentitete: zajemiDokaziloIdentitete,
  sestaviImpressumIdentitetoZaDopolnilniPosnetek: sestaviImpressumIdentitetoZaDopolnilniPosnetek,
  zajemiDopolnilnoImpressumDokazilo: zajemiDopolnilnoImpressumDokazilo,
  pripraviDokaziloZaOdgovor: pripraviDokaziloZaOdgovor,
  sestaviApiDokaziloIdentitete: sestaviApiDokaziloIdentitete,
  sestaviSklep: sestaviSklep,
  jeFrankfurt: jeFrankfurt,
  razcleniImpressum: razcleniImpressum,
  razcleniVidniImpressumTekst: razcleniVidniImpressumTekst,
  poisciImpressumZBrskalnikom: poisciImpressumZBrskalnikom,
  izlociPravniImpressumBlok: izlociPravniImpressumBlok,
  besediloIzHtml: besediloIzHtml,
  najdiPrimarniPoslovniNaziv: najdiPrimarniPoslovniNaziv,
  najdiImpressumPovezave: najdiImpressumPovezave,
  najdiOznacenePravnePovezave: najdiOznacenePravnePovezave,
  dolociPravniKontekst: dolociPravniKontekst,
  jeUrlVPravnemKontekstu: jeUrlVPravnemKontekstu,
  sestaviZacetneImpressumPoti: sestaviZacetneImpressumPoti,
  razlogNeujemanjaIdentiteteZVnosom: razlogNeujemanjaIdentiteteZVnosom,
  imaPopolnoImpressumIdentiteto: imaPopolnoImpressumIdentiteto,
  jeImpressumDokument: jeImpressumDokument,
  jeVgrajenImpressumDokument: jeVgrajenImpressumDokument,
  jeOznacenaPravnaIdentitetnaStran: jeOznacenaPravnaIdentitetnaStran,
  jePravniIdentitetniDokument: jePravniIdentitetniDokument,
  jePravnaImpressumVsebina: jePravnaImpressumVsebina,
  pocistiImeOsebe: pocistiImeOsebe,
  odstraniNaziveIzOsebnegaImena: odstraniNaziveIzOsebnegaImena,
  normalizirajOsebnaPoljaIdentitete: normalizirajOsebnaPoljaIdentitete,
  jeVerjetnoImeOsebe: jeVerjetnoImeOsebe,
  sestaviHwkIskanja: sestaviHwkIskanja,
  jeRegistriraniTrgovecOpenRegister: jeRegistriraniTrgovecOpenRegister,
  potrebujeImpressumDopolnitev: potrebujeImpressumDopolnitev,
  preveriImpressumDopolnitevRegistriranegaTrgovca: preveriImpressumDopolnitevRegistriranegaTrgovca,
  sestaviHwkIskalniUrl: sestaviHwkIskalniUrl,
  pripraviRocnoHwkDokazilo: pripraviRocnoHwkDokazilo,
  pripraviPotrditevIdentitete: pripraviPotrditevIdentitete,
  jeZasebenIp: jeZasebenIp,
  poisciVImpressumu: poisciVImpressumu,
  izberiOpenRegisterZadetek: izberiOpenRegisterZadetek,
  poisciOpenRegister: poisciOpenRegister,
  razcleniOpenRegisterVnos: razcleniOpenRegisterVnos,
  razcleniOpenRegisterReferenco: razcleniOpenRegisterReferenco,
  razlogOpenRegisterIdentitetneNapake: razlogOpenRegisterIdentitetneNapake,
  pocistiRegistrskoSodisce: pocistiRegistrskoSodisce,
  sestaviIdentiteto: sestaviIdentiteto,
  sestaviRocnoIdentiteto: sestaviRocnoIdentiteto,
  normalizirajNaslov: normalizirajNaslov,
  preveriUjemanjeLokacije: preveriUjemanjeLokacije,
  sestaviVire: sestaviVire,
  preveriInsolvenco: preveriInsolvenco,
  sestaviRezultatSamoUradnegaPortala: sestaviRezultatSamoUradnegaPortala,
  pripraviIdentitetoZaInsolvencnoPoizvedbo: pripraviIdentitetoZaInsolvencnoPoizvedbo,
  pripraviVnosZaPreverbo: pripraviVnosZaPreverbo,
  pripraviOpenRegisterVnosZaPotrditev: pripraviOpenRegisterVnosZaPotrditev,
  pripraviOpenRegisterVnosIzImpressuma: pripraviOpenRegisterVnosIzImpressuma,
  sestaviOpenRegisterIskalniUrl: sestaviOpenRegisterIskalniUrl,
  uporabiOpenRegisterZaIdentiteto: uporabiOpenRegisterZaIdentiteto,
  pocistiNazivDruzbe: pocistiNazivDruzbe,
  jeNazivPravneDruzbe: jeNazivPravneDruzbe,
  razlogNapakeBranjaSpletneStrani: razlogNapakeBranjaSpletneStrani,
  jeNedosegljivaNadomestnaStran: jeNedosegljivaNadomestnaStran,
  httpStatusNapakeSpletneStrani: httpStatusNapakeSpletneStrani,
};

module.exports = sentry.wrapHandler(handler, "/api/mehka-boniteta");
