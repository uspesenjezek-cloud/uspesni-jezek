"use strict";

/* Dnevni načrt: dom -> nalog A -> nalog B -> ...
   Vsak odsek se izračuna ob uri, ko se bo dejansko vozil. Za odseke med
   nalogi se preveri, ali je med koncem prejšnjega in začetkom naslednjega
   naloga dovolj časa. */

var luxon = require("luxon");
var storitev = require("./storitev");
var profilMod = require("./profil");

var URA = /^\d{2}:\d{2}$/;
var MAX_NALOGOV = 20;

function napakaVnosa(sporocilo) {
  var e = new Error(sporocilo);
  e.code = "NEVELJAVEN_VNOS";
  return e;
}

function minute(hhmm) {
  var d = String(hhmm).split(":").map(Number);
  return d[0] * 60 + d[1];
}

function normalizirajNaslov(n) {
  return String(n || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/* Čista funkcija: preveri in uredi naloge. */
function pripraviNaloge(naloge) {
  if (!Array.isArray(naloge) || !naloge.length) throw napakaVnosa("Za ta dan ni nalogov.");
  if (naloge.length > MAX_NALOGOV) throw napakaVnosa("Največ " + MAX_NALOGOV + " nalogov na dan.");
  var urejeni = naloge.map(function (n, i) {
    var naslov = String(n && n.naslov || "").trim().slice(0, 300);
    var zacetek = String(n && n.zacetek || "");
    var konec = String(n && n.konec || "");
    var ime = String(n && n.stranka || "").trim().slice(0, 120) || naslov;
    if (!naslov) throw napakaVnosa("Nalog »" + (ime || i + 1) + "« nima naslova.");
    if (!URA.test(zacetek) || !URA.test(konec)) throw napakaVnosa("Nalog »" + ime + "« potrebuje uro začetka in konca.");
    if (minute(konec) <= minute(zacetek)) throw napakaVnosa("Pri nalogu »" + ime + "« je konec pred začetkom.");
    return { id: String(n.id || i), stranka: ime, naslov: naslov, zacetek: zacetek, konec: konec };
  });
  urejeni.sort(function (a, b) { return minute(a.zacetek) - minute(b.zacetek) || a.id.localeCompare(b.id); });
  for (var i = 1; i < urejeni.length; i++) {
    if (minute(urejeni[i].zacetek) < minute(urejeni[i - 1].konec)) {
      throw napakaVnosa("Naloga »" + urejeni[i - 1].stranka + "« in »" + urejeni[i].stranka + "« se časovno prekrivata.");
    }
  }
  return urejeni;
}

/* Čista funkcija: oceni odsek med dvema nalogoma.
   r = rezultat napovedi, najprejOdhod = konec prejšnjega naloga (luxon). */
function ovrednotiPrehod(r, najprejOdhod, zacetek) {
  var priporocen = luxon.DateTime.fromISO(r.priporocenOdhod, { setZone: true });
  if (priporocen >= najprejOdhod) {
    return { stanje: "ok", rezervaMin: Math.round(priporocen.diff(najprejOdhod, "minutes").minutes), zamudaMin: 0 };
  }
  var predvidenPrihod = najprejOdhod.plus({ minutes: r.trajanjeVarnoMin });
  var zamuda = Math.ceil(predvidenPrihod.diff(zacetek, "minutes").minutes);
  return { stanje: zamuda > 0 ? "zamuda" : "tesno", rezervaMin: 0, zamudaMin: Math.max(0, zamuda), predvidenPrihodUra: predvidenPrihod.toFormat("HH:mm") };
}

async function izracunajDan(vhod, opcije) {
  var v = vhod || {};
  var izhodisce = String(v.izhodisce || "").trim();
  if (!izhodisce) throw napakaVnosa("Nastavite izhodišče (od kod začnete dan).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.datum || ""))) throw napakaVnosa("Izberite dan.");
  var jezik = v.jezik === "de" ? "de" : "sl";
  var naloge = pripraviNaloge(v.naloge);

  var odseki = [];
  for (var i = 0; i < naloge.length; i++) {
    var n = naloge[i];
    var prejsnji = i ? naloge[i - 1] : null;
    var od = prejsnji ? prejsnji.naslov : izhodisce;
    var odsek = { nalogId: n.id, od: prejsnji ? prejsnji.stranka : "izhodišče", do: n.stranka, prihod: n.zacetek, prvi: !prejsnji };
    if (normalizirajNaslov(od) === normalizirajNaslov(n.naslov)) {
      odseki.push(Object.assign(odsek, { stanje: "isti_naslov" }));
      continue;
    }
    try {
      var r = await storitev.napovejNalog({ izhodisce: od, cilj: n.naslov, datum: v.datum, prihod: n.zacetek, jezik: jezik }, opcije);
      Object.assign(odsek, {
        priporocenOdhodUra: r.priporocenOdhodUra,
        trajanjeProstoMin: r.trajanjeProstoMin,
        trajanjeVarnoMin: r.trajanjeVarnoMin,
        dodatnaZamudaMin: r.dodatnaZamudaMin,
        razdaljaKm: r.razdaljaKm,
        osnova: r.osnova,
        opozorilo: r.opozorilo,
        dogodki: r.dogodki,
        virPoti: r.virPoti,
        drzava: r.drzava,
        tipDneva: r.tipDneva
      });
      if (prejsnji) {
        var tz = profilMod.CASOVNI_PAS[r.drzava];
        var konecPrej = luxon.DateTime.fromISO(v.datum + "T" + prejsnji.konec, { zone: tz });
        var zac = luxon.DateTime.fromISO(v.datum + "T" + n.zacetek, { zone: tz });
        Object.assign(odsek, ovrednotiPrehod(r, konecPrej, zac));
      } else {
        odsek.stanje = "ok";
      }
    } catch (e) {
      if (e.code !== "NASLOV_NI_NAJDEN" && e.code !== "NEVELJAVEN_VNOS" && e.code !== "POT_NI_NA_VOLJO" && e.code !== "ZUNANJI_VIR") throw e;
      Object.assign(odsek, { stanje: "napaka", napaka: e.message });
    }
    odseki.push(odsek);
  }
  return { datum: v.datum, odseki: odseki, sporocilo: sporociloDneva(v.datum, odseki, jezik) };
}

var B = {
  sl: {
    dom: "Odhod najkasneje ob {o} (prihod k »{d}« ob {p}{g}).",
    gneca: ", na poti običajno gneča do +{z} min",
    zamuda: "Med »{od}« in »{d}« je premalo časa: predvidoma boste ob {p} ~{z} min pozni.",
    tesno: "Med »{od}« in »{d}« je tesno: odidite takoj po koncu.",
    ok: "Od »{od}« do »{d}«: odhod najkasneje ob {o}.",
    napaka: "Za pot do »{d}« ni napovedi: {n}"
  },
  de: {
    dom: "Abfahrt spätestens um {o} (Ankunft bei „{d}“ um {p}{g}).",
    gneca: ", unterwegs üblicherweise Stau bis +{z} Min.",
    zamuda: "Zwischen „{od}“ und „{d}“ reicht die Zeit nicht: voraussichtlich ~{z} Min. Verspätung um {p}.",
    tesno: "Zwischen „{od}“ und „{d}“ wird es knapp: direkt nach Ende losfahren.",
    ok: "Von „{od}“ nach „{d}“: Abfahrt spätestens um {o}.",
    napaka: "Für die Fahrt zu „{d}“ gibt es keine Prognose: {n}"
  }
};

function sporociloDneva(datum, odseki, jezik) {
  var b = B[jezik] || B.sl;
  return odseki.filter(function (o) { return o.stanje !== "isti_naslov"; }).map(function (o) {
    var f = function (s) {
      return s.replace("{o}", o.priporocenOdhodUra || "").replace("{d}", o.do).replace("{od}", o.od).replace("{p}", o.prihod)
        .replace("{z}", o.stanje === "zamuda" ? o.zamudaMin : o.dodatnaZamudaMin).replace("{n}", o.napaka || "")
        .replace("{g}", o.opozorilo ? b.gneca.replace("{z}", o.dodatnaZamudaMin) : "");
    };
    if (o.stanje === "napaka") return f(b.napaka);
    if (o.prvi) return f(b.dom);
    return f(b[o.stanje] || b.ok);
  }).join("\n");
}

module.exports = { izracunajDan: izracunajDan, pripraviNaloge: pripraviNaloge, ovrednotiPrehod: ovrednotiPrehod, sporociloDneva: sporociloDneva };
