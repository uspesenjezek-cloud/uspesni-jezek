"use strict";

/* Prostorske celice (~2 km) za učenje profila zastojev.
   Vsako opazovanje in vsako točko poti preslikamo v isto mrežo, zato
   rezultat ni odvisen od imen cest ali ID-jev, ki jih viri spreminjajo. */

var LAT_KORAK = 0.02; // ~2,2 km
var LON_KORAK = 0.03; // ~2,3 km pri 46–50° s. g. š.

function celica(lat, lon) {
  var la = Number(lat);
  var lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return "c:" + Math.floor(la / LAT_KORAK) + ":" + Math.floor(lo / LON_KORAK);
}

function razdaljaM(a, b) {
  var R = 6371000;
  var rad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * rad;
  var dLon = (b.lon - a.lon) * rad;
  var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

var KORAK_ZGOSTITVE_M = 500;

/* Dolge ravne odseke (npr. avtocesta z redkimi točkami) razdeli na kose
   do 500 m, da pot ne preskoči vmesnih celic. */
function zgosti(tocke) {
  var out = [tocke[0]];
  for (var i = 1; i < tocke.length; i++) {
    var a = tocke[i - 1];
    var b = tocke[i];
    var kosov = Math.max(1, Math.ceil(razdaljaM(a, b) / KORAK_ZGOSTITVE_M));
    for (var k = 1; k <= kosov; k++) {
      out.push({ lat: a.lat + (b.lat - a.lat) * k / kosov, lon: a.lon + (b.lon - a.lon) * k / kosov });
    }
  }
  return out;
}

/* Geometrijo poti [{lat,lon}] razdeli na zaporedne odseke po celicah.
   Čas prostega toka se razdeli sorazmerno z razdaljo. */
function odsekiPoCelicah(vhodneTocke, trajanjeProstoS) {
  if (!Array.isArray(vhodneTocke) || vhodneTocke.length < 2) return [];
  var tocke = zgosti(vhodneTocke.map(function (t) { return { lat: Number(t.lat), lon: Number(t.lon) }; }));
  var dolzine = [];
  var skupaj = 0;
  for (var i = 1; i < tocke.length; i++) {
    var d = razdaljaM(tocke[i - 1], tocke[i]);
    dolzine.push(d);
    skupaj += d;
  }
  if (!(skupaj > 0)) return [];
  var odseki = [];
  var odmik = 0;
  for (var j = 1; j < tocke.length; j++) {
    var sredina = { lat: (tocke[j - 1].lat + tocke[j].lat) / 2, lon: (tocke[j - 1].lon + tocke[j].lon) / 2 };
    var c = celica(sredina.lat, sredina.lon);
    var trajanje = trajanjeProstoS * dolzine[j - 1] / skupaj;
    var zadnji = odseki[odseki.length - 1];
    if (zadnji && zadnji.celica === c) {
      zadnji.trajanjeProstoS += trajanje;
      zadnji.razdaljaM += dolzine[j - 1];
    } else {
      odseki.push({ celica: c, odmikProstoS: odmik, trajanjeProstoS: trajanje, razdaljaM: dolzine[j - 1] });
    }
    odmik += trajanje;
  }
  return odseki;
}

module.exports = { celica: celica, razdaljaM: razdaljaM, odsekiPoCelicah: odsekiPoCelicah, LAT_KORAK: LAT_KORAK, LON_KORAK: LON_KORAK };
