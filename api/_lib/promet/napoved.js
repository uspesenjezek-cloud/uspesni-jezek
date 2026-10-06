"use strict";

/* Deterministična napoved priporočenega odhoda za delovni nalog.

   trajanje = čas prostega toka (OSRM/Valhalla nad OpenStreetMap)
            + za vsak odsek poti p85 zamuda iz naučenega profila
              ob uri, ko bo vozilo tam (časovno odvisno, iterativno)
            + kazen za znane dogodke (dela, zapore) na poti
   odhod    = prihod − trajanje − varnostna rezerva, zaokroženo navzdol.

   Kjer meritev še ni dovolj (prvih nekaj tednov ali ceste, ki jih viri ne
   pokrivajo), uporabimo fiksno začetno tabelo konic. Isti vhod vedno da
   isti izhod. */

var luxon = require("luxon");
var celice = require("./celice");
var tipDneva = require("./tip-dneva");
var profilMod = require("./profil");

var PRIVZETO = {
  minVzorcev: 8,        // najmanj zajemov v (tip dneva, interval), da zaupamo meritvi
  rezervaMin: 10,       // fiksna varnostna rezerva (parkiranje, iskanje naslova)
  zaokrozitevMin: 5,
  pragOpozorilaMin: 10, // od te dodatne zamude naprej pošljemo opozorilo
  kaznDelaMin: 5,
  kaznZaporaMin: 15,
  razdaljaDogodkaM: 300
};

/* Začetna ocena konic (faktor na čas prostega toka), dokler ni meritev.
   To NI meritev: le groba, previdna predpostavka o urah konic po državah,
   ki jo za vsak odsek zamenja merjeni profil, ko je vzorcev dovolj.
   [od, do, faktor] v lokalnih urah.
   SI: delovni čas pogosto 7–15, zato popoldanska konica že od ~13:30;
   petek od 12:00. DE: popoldanska konica ~15:00–18:30. */
var ZACETNE_KONICE = {
  SI: {
    delavnik: [[6, 6.5, 1.15], [6.5, 8.5, 1.4], [8.5, 13.5, 1.1], [13.5, 17.5, 1.45], [17.5, 19, 1.15]],
    petek: [[6, 6.5, 1.15], [6.5, 8.5, 1.35], [8.5, 12, 1.1], [12, 17, 1.5], [17, 19, 1.15]],
    pocitnice_delavnik: [[6.5, 8.5, 1.2], [8.5, 13.5, 1.05], [13.5, 17, 1.25]],
    sobota: [[9, 13, 1.15]],
    nedelja_praznik: []
  },
  DE: {
    delavnik: [[6.5, 9, 1.35], [9, 15, 1.1], [15, 18.5, 1.4], [18.5, 20, 1.1]],
    petek: [[6.5, 9, 1.3], [9, 12.5, 1.1], [12.5, 18, 1.45], [18, 20, 1.1]],
    pocitnice_delavnik: [[6.5, 9, 1.15], [9, 15, 1.05], [15, 18, 1.2]],
    sobota: [[9, 13, 1.1]],
    nedelja_praznik: []
  }
};

function faktorKonice(tip, uraDec, drzava) {
  var tabela = ZACETNE_KONICE[drzava] || ZACETNE_KONICE.SI;
  var p = (tabela[tip] || []).find(function (r) { return uraDec >= r[0] && uraDec < r[1]; });
  return p ? p[2] : 1;
}

function indeksProfila(profil) {
  var vrstice = new Map();
  var opazovaneCelice = new Set();
  ((profil && profil.vrstice) || []).forEach(function (r) {
    vrstice.set(r.vir + "|" + r.celica + "|" + r.tip_dneva + "|" + r.interval, r);
    opazovaneCelice.add(r.celica);
  });
  var pokritost = new Map();
  ((profil && profil.pokritost) || []).forEach(function (r) {
    pokritost.set(r.vir + "|" + r.tip_dneva + "|" + r.interval, r.n_vzorcev);
  });
  var viri = Array.from(new Set(((profil && profil.pokritost) || []).map(function (r) { return r.vir; }))).sort();
  return { vrstice: vrstice, pokritost: pokritost, opazovaneCelice: opazovaneCelice, viri: viri };
}

function zamudaOdseka(odsek, dt, tip, idx, o) {
  var iv = Math.floor((dt.hour * 60 + dt.minute) / profilMod.INTERVAL_MIN);
  var zaupanjaVredni = idx.viri.filter(function (v) { return (idx.pokritost.get(v + "|" + tip + "|" + iv) || 0) >= o.minVzorcev; });
  if (zaupanjaVredni.length && idx.opazovaneCelice.has(odsek.celica)) {
    var najvec = { p85: 0, mediana: 0, n: 0, vir: null, p: 0 };
    zaupanjaVredni.forEach(function (v) {
      var r = idx.vrstice.get(v + "|" + odsek.celica + "|" + tip + "|" + iv);
      var n = idx.pokritost.get(v + "|" + tip + "|" + iv);
      if (r && r.p85_s > najvec.p85) najvec = { p85: r.p85_s, mediana: r.mediana_s, n: n, vir: v, p: r.p_zastoja };
      if (!najvec.vir) najvec = Object.assign(najvec, { n: n, vir: v });
    });
    return { p85S: najvec.p85, medianaS: najvec.mediana, osnova: "meritve", vir: najvec.vir, nVzorcev: najvec.n, pZastoja: najvec.p };
  }
  var f = faktorKonice(tip, dt.hour + dt.minute / 60, o.drzava);
  var dodatek = Math.round(odsek.trajanjeProstoS * (f - 1));
  return { p85S: dodatek, medianaS: Math.round(dodatek / 2), osnova: "zacetna_ocena", vir: null, nVzorcev: 0, pZastoja: null };
}

function voznja(odhod, odseki, tip, idx, o, kljuc) {
  var t = odhod;
  var razlogi = [];
  var osnove = { meritve: 0, zacetna_ocena: 0 };
  odseki.forEach(function (od) {
    var z = zamudaOdseka(od, t, tip, idx, o);
    osnove[z.osnova] += od.trajanjeProstoS;
    if (z[kljuc] > 0) razlogi.push({ celica: od.celica, ura: t.toFormat("HH:mm"), zamudaS: z[kljuc], osnova: z.osnova, vir: z.vir, nVzorcev: z.nVzorcev, pZastoja: z.pZastoja });
    t = t.plus({ seconds: od.trajanjeProstoS + z[kljuc] });
  });
  return { trajanjeS: t.diff(odhod, "seconds").seconds, razlogi: razlogi, osnove: osnove };
}

function dogodkiNaPoti(dogodki, tocke, o) {
  return (dogodki || []).filter(function (d) {
    return (d.tocke || []).some(function (dt) {
      return tocke.some(function (pt) { return celice.razdaljaM(dt, pt) <= o.razdaljaDogodkaM; });
    });
  }).sort(function (a, b) { return String(a.zunanjiId).localeCompare(String(b.zunanjiId)); });
}

function casDoKonvergence(prihod, odseki, tip, idx, o, kljuc, kaznS) {
  var prosto = odseki.reduce(function (s, x) { return s + x.trajanjeProstoS; }, 0);
  var odhod = prihod.minus({ seconds: prosto + kaznS });
  var r = null;
  for (var i = 0; i < 12; i++) {
    r = voznja(odhod, odseki, tip, idx, o, kljuc);
    var nov = prihod.minus({ seconds: r.trajanjeS + kaznS });
    if (Math.abs(nov.diff(odhod, "seconds").seconds) < 30) { odhod = nov; break; }
    odhod = nov;
  }
  return { odhod: odhod, trajanjeS: r.trajanjeS + kaznS, razlogi: r.razlogi, osnove: r.osnove };
}

/* vhod: { prihod: "2026-10-07T07:30", tz, drzava, regija, koledar,
           pot: { trajanjeProstoS, tocke: [{lat,lon}] }, profil, dogodki, opcije } */
function izracunajOdhod(vhod) {
  var o = Object.assign({}, PRIVZETO, vhod.opcije || {}, { drzava: vhod.drzava === "DE" ? "DE" : "SI" });
  var tz = vhod.tz || profilMod.CASOVNI_PAS[vhod.drzava] || "Europe/Ljubljana";
  var prihod = luxon.DateTime.fromISO(String(vhod.prihod), { zone: tz });
  if (!prihod.isValid) throw new Error("Neveljaven čas prihoda.");
  var pot = vhod.pot || {};
  if (!(pot.trajanjeProstoS > 0)) throw new Error("Manjka trajanje poti v prostem toku.");
  var odseki = celice.odsekiPoCelicah(pot.tocke, pot.trajanjeProstoS);
  if (!odseki.length) throw new Error("Pot nima geometrije.");

  var tip = tipDneva.tipDneva(prihod.toISODate(), vhod.koledar, vhod.regija);
  var idx = indeksProfila(vhod.profil);
  var naPoti = dogodkiNaPoti(vhod.dogodki, pot.tocke, o);
  var kaznS = naPoti.reduce(function (s, d) { return s + 60 * (d.zaprto ? o.kaznZaporaMin : o.kaznDelaMin); }, 0);

  var obicajno = casDoKonvergence(prihod, odseki, tip, idx, o, "medianaS", kaznS);
  var varno = casDoKonvergence(prihod, odseki, tip, idx, o, "p85S", kaznS);

  var rezervaS = o.rezervaMin * 60;
  var surovOdhod = prihod.minus({ seconds: varno.trajanjeS + rezervaS });
  var z = o.zaokrozitevMin;
  var odhod = surovOdhod.startOf("minute").minus({ minutes: surovOdhod.minute % z });

  var prostoS = pot.trajanjeProstoS;
  var dodatnaMin = Math.round((varno.trajanjeS - prostoS) / 60);
  // delež poti (po času prostega toka), ki temelji na meritvah
  var deleziMeritev = varno.osnove.meritve / (varno.osnove.meritve + varno.osnove.zacetna_ocena);

  return {
    prihod: prihod.toISO({ suppressMilliseconds: true }),
    priporocenOdhod: odhod.toISO({ suppressMilliseconds: true }),
    priporocenOdhodUra: odhod.toFormat("HH:mm"),
    tipDneva: tip,
    trajanjeProstoMin: Math.round(prostoS / 60),
    trajanjeObicajnoMin: Math.round(obicajno.trajanjeS / 60),
    trajanjeVarnoMin: Math.round(varno.trajanjeS / 60),
    dodatnaZamudaMin: dodatnaMin,
    rezervaMin: o.rezervaMin,
    opozorilo: dodatnaMin >= o.pragOpozorilaMin,
    osnova: deleziMeritev >= 0.999 ? "meritve" : deleziMeritev <= 0.001 ? "zacetna_ocena" : "mesano",
    delezMeritev: Math.round(deleziMeritev * 100) / 100,
    razlogi: varno.razlogi,
    dogodki: naPoti.map(function (d) { return { vir: d.vir, tip: d.tip, cesta: d.cesta, naslov: d.naslov, zaprto: !!d.zaprto }; }),
    verzijaModela: profilMod.VERZIJA
  };
}

var BESEDILA = {
  sl: {
    gneca: "Ob tej uri je na vaši poti običajno gneča (do +{z} min).",
    dogodek: "Na poti so napovedana dela ali zapora: {d}.",
    odhod: "Za prihod ob {p} priporočamo odhod najkasneje ob {o}.",
    normalno: "Na poti ne pričakujemo posebne gneče. Odhod ob {o} zadošča za prihod ob {p}.",
    ocena: "(Ocena na podlagi tipičnih konic; meritve za to pot še zbiramo.)"
  },
  de: {
    gneca: "Zu dieser Uhrzeit ist auf Ihrer Strecke üblicherweise Stau (bis zu +{z} Min.).",
    dogodek: "Auf der Strecke sind Baustellen oder Sperrungen gemeldet: {d}.",
    odhod: "Für die Ankunft um {p} empfehlen wir die Abfahrt spätestens um {o}.",
    normalno: "Auf der Strecke ist kein besonderer Stau zu erwarten. Abfahrt um {o} reicht für die Ankunft um {p}.",
    ocena: "(Schätzung anhand typischer Stoßzeiten; Messwerte für diese Strecke werden noch gesammelt.)"
  }
};

function sporocilo(r, jezik) {
  var b = BESEDILA[jezik] || BESEDILA.sl;
  var prihod = luxon.DateTime.fromISO(r.prihod, { setZone: true }).toFormat("HH:mm");
  var vrstice = [];
  var f = function (s) { return s.replace("{z}", r.dodatnaZamudaMin).replace("{p}", prihod).replace("{o}", r.priporocenOdhodUra).replace("{d}", r.dogodki.map(function (d) { return d.cesta || d.naslov; }).filter(Boolean).join(", ")); };
  if (r.opozorilo) { vrstice.push(f(b.gneca)); }
  if (r.dogodki.length) vrstice.push(f(b.dogodek));
  vrstice.push(f(r.opozorilo || r.dogodki.length ? b.odhod : b.normalno));
  if (r.osnova !== "meritve") vrstice.push(b.ocena);
  return vrstice.join(" ");
}

module.exports = { izracunajOdhod: izracunajOdhod, sporocilo: sporocilo, faktorKonice: faktorKonice, PRIVZETO: PRIVZETO, ZACETNE_KONICE: ZACETNE_KONICE };
