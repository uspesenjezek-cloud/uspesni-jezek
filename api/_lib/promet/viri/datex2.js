"use strict";

/* Bralnik DATEX II (v2.3 in v3.x) za vire NAP / DARS.
   Iščemo po lokalnih imenih elementov (brez imenskih prostorov) in
   rekurzivno, zato isti bralnik prenese razlike med različicami:
   - SituationPublication  -> zastoji, dela, zapore (z lokacijo),
   - MeasurementSiteTablePublication -> merilna mesta (števci) s koordinatami,
   - MeasuredDataPublication -> meritve (hitrost, pretok) po merilnih mestih,
   - ElaboratedDataPublication / TravelTimeData -> potovalni časi.
   Vrednosti beremo kot besedilo (brez samodejnega pretvarjanja), da se
   oznake, kot je »0012«, ne spremenijo. */

var XMLParser = require("fast-xml-parser").XMLParser;
var skupno = require("./skupno");

var parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true
});

function razcleni(xml) {
  if (typeof xml !== "string" || xml.indexOf("<") === -1) throw skupno.napakaVira("datex2", "odgovor ni XML");
  try { return parser.parse(xml); } catch (e) { throw skupno.napakaVira("datex2", "neveljaven XML (" + e.message + ")"); }
}

function seznam(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }

function besedilo(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v["#text"] != null) return String(v["#text"]);
  // DATEX II večjezično besedilo: values.value[]
  var vrednosti = najdiVse(v, "value");
  for (var i = 0; i < vrednosti.length; i++) {
    var t = besedilo(vrednosti[i]);
    if (t) return t;
  }
  return "";
}

function stevilo(v) {
  var t = String(besedilo(v)).trim();
  if (!t) return null; // manjkajoča vrednost ni 0
  var n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* Vsi potomci z danim lokalnim imenom (v globino, v vrstnem redu dokumenta). */
function najdiVse(koren, ime, omejitev) {
  var out = [];
  var meja = omejitev || 100000;
  (function hodi(v) {
    if (out.length >= meja || v == null || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach(hodi); return; }
    Object.keys(v).forEach(function (k) {
      if (k[0] === "@" || k === "#text") return;
      if (k === ime) seznam(v[k]).forEach(function (x) { out.push(x); });
      hodi(v[k]);
    });
  })(koren);
  return out;
}

function prvi(koren, ime) { return najdiVse(koren, ime, 1)[0]; }

function tip(v) {
  if (!v || typeof v !== "object") return "";
  var t = v["@type"] || "";
  return String(t).split(":").pop();
}

function id(v) {
  if (!v || typeof v !== "object") return "";
  return String(v["@id"] || v["@targetId"] || v["@idG"] || besedilo(v["id"]) || "");
}

/* Koordinate v lokaciji. Po vrstnem redu natančnosti (prvi, ki obstaja):
   GML posList (cela linija) -> OpenLR referenčne točke -> pointCoordinates
   -> coordinatesForDisplay (ena točka za prikaz). NAP v3.3 uporablja vse. */
function tockeIz(seznamVozlisc) {
  var out = [];
  seznamVozlisc.forEach(function (p) {
    var lat = stevilo(p.latitude);
    var lon = stevilo(p.longitude);
    if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) out.push({ lat: lat, lon: lon });
  });
  return out;
}

function koordinate(lokacija) {
  var tocke = [];
  najdiVse(lokacija, "posList").forEach(function (pl) {
    var d = besedilo(pl).trim().split(/\s+/).map(Number);
    for (var i = 0; i + 1 < d.length; i += 2) {
      if (Number.isFinite(d[i]) && Number.isFinite(d[i + 1])) tocke.push({ lat: d[i], lon: d[i + 1] });
    }
  });
  if (tocke.length >= 2) return tocke;
  var openlr = tockeIz(najdiVse(lokacija, "openlrCoordinates"));
  if (openlr.length) return openlr;
  if (tocke.length) return tocke;
  var tocka = tockeIz(najdiVse(lokacija, "pointCoordinates"));
  if (tocka.length) return tocka;
  return tockeIz(najdiVse(lokacija, "coordinatesForDisplay"));
}

/* ---------- Situacije (dogodki) ---------- */

var ZASTOJ_TIPI = /stationary|queuing|slow|heavy|congest|stopAndGo/i;

function vrstaSituacije(z) {
  var t = tip(z);
  if (/AbnormalTraffic/i.test(t)) {
    var vrsta = besedilo(z.abnormalTrafficType);
    return { vrsta: "zastoj", barva: /stationary|queuing/i.test(vrsta) || !vrsta ? "rdece" : "oranzno" };
  }
  if (/Roadworks|MaintenanceWorks|ConstructionWorks/i.test(t)) return { vrsta: "dela", barva: "oranzno" };
  if (/RoadOrCarriagewayOrLaneManagement|RoadClosure|NetworkManagement/i.test(t)) {
    var u = besedilo(z.roadOrCarriagewayOrLaneManagementType) + " " + besedilo(z.complianceOption);
    if (/closed|closure|blocked/i.test(u)) return { vrsta: "zapora", barva: "rdece" };
    return { vrsta: "dela", barva: "oranzno" };
  }
  if (/Accident|VehicleObstruction|GeneralObstruction|Obstruction/i.test(t)) return { vrsta: "zastoj", barva: "rdece" };
  if (ZASTOJ_TIPI.test(besedilo(z.abnormalTrafficType))) return { vrsta: "zastoj", barva: "rdece" };
  return null;
}

function razcleniSituacije(xml) {
  var drevo = typeof xml === "string" ? razcleni(xml) : xml;
  var zapisi = najdiVse(drevo, "situationRecord");
  if (!zapisi.length && !najdiVse(drevo, "situation", 1).length && !najdiVse(drevo, "payloadPublication", 1).length && !najdiVse(drevo, "publication", 1).length) {
    throw skupno.napakaVira("datex2", "v odgovoru ni objave situacij");
  }
  var out = [];
  zapisi.forEach(function (z) {
    var v = vrstaSituacije(z);
    if (!v) return;
    var lok = z.locationReference || z.groupOfLocations || z.location || z;
    var tocke = koordinate(lok);
    if (!tocke.length) return;
    var zamudaS = stevilo(prvi(z, "delayTimeValue"));
    out.push({
      id: id(z),
      vrsta: v.vrsta,
      barva: v.barva,
      tocke: tocke,
      zamudaMin: zamudaS != null ? Math.round(zamudaS / 60) : null,
      cesta: besedilo(prvi(lok, "roadNumber")) || besedilo(prvi(lok, "roadName")),
      opis: besedilo(prvi(z, "generalPublicComment")) || besedilo(prvi(z, "comment")) || tip(z),
      zaprto: v.vrsta === "zapora"
    });
  });
  return out;
}

/* ---------- Merilna mesta in meritve (števci) ---------- */

function razcleniMerilnaMesta(xml) {
  var drevo = typeof xml === "string" ? razcleni(xml) : xml;
  var mesta = new Map();
  // v2.3: measurementSiteRecord; v3.x (NAP): measurementSite
  najdiVse(drevo, "measurementSiteRecord").concat(najdiVse(drevo, "measurementSite")).forEach(function (m) {
    var tocke = koordinate(m.measurementSiteLocation || m);
    if (!tocke.length) return;
    mesta.set(id(m), {
      id: id(m),
      lat: tocke[0].lat,
      lon: tocke[0].lon,
      ime: besedilo(m.measurementSiteName) || besedilo(prvi(m, "measurementSiteIdentification")),
      cesta: besedilo(prvi(m, "roadNumber")) || besedilo(prvi(m, "roadName"))
    });
  });
  return mesta;
}

/* Povprečna hitrost (km/h), pretok (voz/h) in zasedenost po merilnem mestu.
   Pri več pasovih vzamemo najnižjo hitrost (najslabši pas). */
function razcleniMeritve(xml) {
  var drevo = typeof xml === "string" ? razcleni(xml) : xml;
  var meritve = new Map();
  najdiVse(drevo, "siteMeasurements").forEach(function (s) {
    var ref = s.measurementSiteReference;
    var mid = id(ref) || besedilo(ref);
    if (!mid) return;
    var m = meritve.get(mid) || { id: mid, hitrost: null, pretok: 0, zasedenost: null, cas: besedilo(s.measurementTimeDefault) || null };
    najdiVse(s, "averageVehicleSpeed").forEach(function (h) {
      var v = stevilo(prvi(h, "speed") != null ? prvi(h, "speed") : h);
      if (v != null && v > 0 && (m.hitrost == null || v < m.hitrost)) m.hitrost = v;
    });
    najdiVse(s, "vehicleFlow").forEach(function (f) {
      var v = stevilo(prvi(f, "vehicleFlowRate") != null ? prvi(f, "vehicleFlowRate") : f);
      if (v != null && v >= 0) m.pretok += v;
    });
    najdiVse(s, "occupancy").forEach(function (o) {
      var v = stevilo(prvi(o, "percentage") != null ? prvi(o, "percentage") : o);
      if (v != null && (m.zasedenost == null || v > m.zasedenost)) m.zasedenost = v;
    });
    meritve.set(mid, m);
  });
  return meritve;
}

/* ---------- Potovalni časi ---------- */

function razcleniPotovalneCase(xml) {
  var drevo = typeof xml === "string" ? razcleni(xml) : xml;
  var out = [];
  // v3.x: physicalQuantity { pertinentLocation, source, basicData }; v2.3: elaboratedData { basicData { pertinentLocation } }
  var vsebniki = najdiVse(drevo, "physicalQuantity").concat(najdiVse(drevo, "elaboratedData"));
  vsebniki.forEach(function (v) {
    seznam(v.basicData).forEach(function (b) {
      if (!/TravelTime/i.test(tip(b))) return;
      var cas = stevilo(prvi(b.travelTime || {}, "duration"));
      if (cas == null) cas = stevilo(b.travelTime);
      if (cas == null) return;
      var prosto = stevilo(prvi(b.freeFlowTravelTime || {}, "duration"));
      if (prosto == null) prosto = stevilo(b.freeFlowTravelTime);
      var obicajno = stevilo(prvi(b.normallyExpectedTravelTime || {}, "duration"));
      var lok = v.pertinentLocation || b.pertinentLocation || {};
      var predef = prvi(lok, "predefinedLocationReference");
      out.push({
        lokacija: predef ? (id(predef) || besedilo(predef)) : null,
        tocke: predef ? [] : koordinate(lok),
        ime: besedilo(prvi(v.source || {}, "sourceName")),
        casS: cas,
        prostoS: prosto,
        obicajnoS: obicajno
      });
    });
  });
  return out;
}

/* Preddefinirane lokacije (odseki za potovalne čase) -> id -> točke. */
function razcleniLokacije(xml) {
  var drevo = typeof xml === "string" ? razcleni(xml) : xml;
  var lokacije = new Map();
  // NAP v3.3: predefinedLocationReference (xsi:type PredefinedLocation) z id in lokacijo
  ["predefinedLocation", "predefinedLocationReference", "predefinedItinerary"].forEach(function (ime) {
    najdiVse(drevo, ime).forEach(function (l) {
      if (!l || typeof l !== "object" || !id(l) || lokacije.has(id(l))) return;
      var t = koordinate(l);
      if (t.length) lokacije.set(id(l), { ime: besedilo(l.predefinedLocationName) || besedilo(l.name), tocke: t });
    });
  });
  return lokacije;
}

module.exports = {
  razcleni: razcleni,
  razcleniSituacije: razcleniSituacije,
  razcleniMerilnaMesta: razcleniMerilnaMesta,
  razcleniMeritve: razcleniMeritve,
  razcleniPotovalneCase: razcleniPotovalneCase,
  razcleniLokacije: razcleniLokacije,
  _test: { najdiVse: najdiVse, koordinate: koordinate, besedilo: besedilo }
};
