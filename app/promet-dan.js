/* ==========================================================
   promet-dan.js — Dnevni načrt poti.
   Nalogi dneva (začetek, konec, naslov) + izhodišče -> za vsak odsek
   poti priporočen odhod ob dejanski uri vožnje (POST /api/promet-dan).
   Nalogi se zaenkrat hranijo na napravi (localStorage); povezava s
   skupnim koledarjem pride pozneje.
   ========================================================== */
(function () {
  "use strict";

  var KLJUC = "uj-promet-dan-v1";
  var $ = function (id) { return document.getElementById(id); };

  var stanje = naloziStanje();
  var izbranDatum = jutri();
  var rezultati = {}; // datum -> odgovor API (samo za trenutno sejo)
  var urejaniId = null;

  /* ---------- shranjevanje ---------- */
  function naloziStanje() {
    var privzeto = { izhodisce: "", jezik: "sl", nalogi: {} };
    try {
      var s = JSON.parse(localStorage.getItem(KLJUC) || "null");
      if (s && typeof s === "object") return Object.assign(privzeto, s, { nalogi: s.nalogi && typeof s.nalogi === "object" ? s.nalogi : {} });
    } catch (_) {}
    return privzeto;
  }

  function shrani() {
    try { localStorage.setItem(KLJUC, JSON.stringify(stanje)); } catch (_) {}
  }

  /* ---------- datumi ---------- */
  function vIso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function jutri() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    return vIso(d);
  }

  function premakniDan(iso, dni) {
    var d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + dni);
    return vIso(d);
  }

  function prikazDatuma(iso) {
    var d = new Date(iso + "T12:00:00");
    var besedilo = new Intl.DateTimeFormat("sl-SI", { weekday: "long", day: "numeric", month: "long" }).format(d);
    var danes = vIso(new Date());
    if (iso === danes) besedilo = "Danes, " + besedilo;
    else if (iso === premakniDan(danes, 1)) besedilo = "Jutri, " + besedilo;
    return besedilo.charAt(0).toUpperCase() + besedilo.slice(1);
  }

  function minute(hhmm) {
    var d = String(hhmm || "").split(":").map(Number);
    return d[0] * 60 + d[1];
  }

  function nalogiDneva() {
    return (stanje.nalogi[izbranDatum] || []).slice().sort(function (a, b) { return minute(a.zacetek) - minute(b.zacetek); });
  }

  function razveljaviRezultat() {
    delete rezultati[izbranDatum];
  }

  /* ---------- prikaz ---------- */
  function ustvariNalog(n) {
    var li = $("pdan-nalog-predloga").content.firstElementChild.cloneNode(true);
    li.dataset.id = n.id;
    var cas = li.querySelector(".pdan__nalog-cas");
    cas.textContent = n.zacetek;
    var konec = document.createElement("span");
    konec.textContent = "do " + n.konec;
    cas.appendChild(konec);
    li.querySelector(".pdan__nalog-stranka").textContent = n.stranka || n.naslov;
    li.querySelector(".pdan__nalog-naslov").textContent = n.naslov;
    return li;
  }

  function besedilaOdseka(o) {
    var podrobno = [];
    if (o.trajanjeVarnoMin != null) {
      podrobno.push(o.trajanjeVarnoMin + " min vožnje");
      if (o.dodatnaZamudaMin > 0) podrobno.push("+" + o.dodatnaZamudaMin + " min promet");
      if (o.razdaljaKm != null) podrobno.push(String(o.razdaljaKm).replace(".", ",") + " km");
    }
    if (o.osnova === "zacetna_ocena" || o.osnova === "mesano") podrobno.push("ocena tipičnih konic");
    if (o.virPoti === "javni_preizkusni") podrobno.push("pot: javni preizkusni strežnik");
    (o.dogodki || []).forEach(function (d) { podrobno.push((d.zaprto ? "zapora" : "dela") + (d.cesta ? " " + d.cesta : "")); });

    switch (o.stanje) {
      case "isti_naslov":
        return { glavno: "Isti naslov – brez vožnje", podrobno: "", znacka: "" };
      case "napaka":
        return { glavno: "Za to pot ni napovedi", podrobno: o.napaka || "", znacka: "Napaka" };
      case "zamuda":
        return { glavno: "Premalo časa: ~" + o.zamudaMin + " min zamude", podrobno: "Prihod predvidoma ob " + o.predvidenPrihodUra + " · " + podrobno.join(" · "), znacka: "Zamuda" };
      case "tesno":
        return { glavno: "Tesno: odidite takoj po koncu", podrobno: podrobno.join(" · "), znacka: "Tesno" };
      default:
        if (!o.prvi && o.rezervaMin != null) podrobno.push(o.rezervaMin + " min rezerve");
        return { glavno: (o.prvi ? "Odhod od doma najkasneje " : "Odhod najkasneje ") + o.priporocenOdhodUra, podrobno: podrobno.join(" · "), znacka: o.opozorilo ? "Gneča" : "" };
    }
  }

  function ustvariOdsek(o) {
    var li = $("pdan-odsek-predloga").content.firstElementChild.cloneNode(true);
    li.classList.add("pdan__odsek--" + o.stanje);
    var b = besedilaOdseka(o);
    li.querySelector(".pdan__odsek-glavno").textContent = b.glavno;
    var pod = li.querySelector(".pdan__odsek-podrobno");
    pod.textContent = b.podrobno;
    pod.hidden = !b.podrobno;
    var z = li.querySelector(".pdan__znacka");
    z.textContent = b.znacka;
    z.hidden = !b.znacka;
    return li;
  }

  function izrisi() {
    $("pdan-datum").value = izbranDatum;
    $("pdan-datum-besedilo").textContent = prikazDatuma(izbranDatum);
    var seznam = $("pdan-seznam");
    seznam.textContent = "";
    var nalogi = nalogiDneva();
    var rez = rezultati[izbranDatum];
    var odsekiPoNalogu = {};
    if (rez) rez.odseki.forEach(function (o) { odsekiPoNalogu[o.nalogId] = o; });
    nalogi.forEach(function (n) {
      if (odsekiPoNalogu[n.id]) seznam.appendChild(ustvariOdsek(odsekiPoNalogu[n.id]));
      seznam.appendChild(ustvariNalog(n));
    });
    $("pdan-prazno").hidden = nalogi.length > 0;
    $("pdan-izracunaj").hidden = nalogi.length === 0;
    var povzetek = $("pdan-povzetek");
    povzetek.hidden = !rez;
    if (rez) $("pdan-sporocilo").textContent = rez.sporocilo;
  }

  function nastaviStatus(besedilo, jeNapaka) {
    var s = $("pdan-status");
    s.textContent = besedilo || "";
    s.hidden = !besedilo;
    s.classList.toggle("pdan__status--napaka", !!jeNapaka);
  }

  /* ---------- obrazec ---------- */
  function odpriObrazec(nalog) {
    urejaniId = nalog ? nalog.id : null;
    $("pdan-obrazec-naslov").textContent = nalog ? "Uredi nalog" : "Nov nalog";
    $("pdan-stranka").value = nalog ? nalog.stranka : "";
    $("pdan-naslov").value = nalog ? nalog.naslov : "";
    var zadnji = nalogiDneva().slice(-1)[0];
    $("pdan-zacetek").value = nalog ? nalog.zacetek : (zadnji ? zadnji.konec : "08:00");
    $("pdan-konec").value = nalog ? nalog.konec : "";
    $("pdan-napaka-obrazca").hidden = true;
    $("pdan-obrazec").hidden = false;
    $("pdan-dodaj").hidden = true;
    $("pdan-naslov").dispatchEvent(new Event("input", { bubbles: true }));
    $(nalog ? "pdan-naslov" : "pdan-stranka").focus({ preventScroll: true });
    $("pdan-obrazec").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function zapriObrazec() {
    urejaniId = null;
    $("pdan-obrazec").hidden = true;
    $("pdan-dodaj").hidden = false;
  }

  function napakaObrazca(besedilo) {
    var p = $("pdan-napaka-obrazca");
    p.textContent = besedilo;
    p.hidden = false;
  }

  function shraniNalog(dogodek) {
    dogodek.preventDefault();
    var nalog = {
      id: urejaniId || "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      stranka: $("pdan-stranka").value.trim(),
      naslov: $("pdan-naslov").value.trim(),
      zacetek: $("pdan-zacetek").value,
      konec: $("pdan-konec").value
    };
    if (!nalog.naslov) return napakaObrazca("Vnesite naslov stranke.");
    if (!/^\d{2}:\d{2}$/.test(nalog.zacetek) || !/^\d{2}:\d{2}$/.test(nalog.konec)) return napakaObrazca("Vnesite uro začetka in konca.");
    if (minute(nalog.konec) <= minute(nalog.zacetek)) return napakaObrazca("Konec mora biti po začetku.");
    var ostali = (stanje.nalogi[izbranDatum] || []).filter(function (n) { return n.id !== nalog.id; });
    var prekrit = ostali.find(function (n) { return minute(nalog.zacetek) < minute(n.konec) && minute(n.zacetek) < minute(nalog.konec); });
    if (prekrit) return napakaObrazca("Prekriva se z nalogom »" + (prekrit.stranka || prekrit.naslov) + "« (" + prekrit.zacetek + "–" + prekrit.konec + ").");
    stanje.nalogi[izbranDatum] = ostali.concat([nalog]);
    shrani();
    razveljaviRezultat();
    zapriObrazec();
    nastaviStatus("");
    izrisi();
  }

  function obdelajKlikSeznama(dogodek) {
    var gumb = dogodek.target.closest("[data-akcija]");
    if (!gumb) return;
    var id = gumb.closest(".pdan__nalog").dataset.id;
    var nalog = (stanje.nalogi[izbranDatum] || []).find(function (n) { return n.id === id; });
    if (!nalog) return;
    if (gumb.dataset.akcija === "uredi") return odpriObrazec(nalog);
    if (gumb.dataset.akcija === "izbrisi" && window.confirm("Izbrišem nalog »" + (nalog.stranka || nalog.naslov) + "«?")) {
      stanje.nalogi[izbranDatum] = stanje.nalogi[izbranDatum].filter(function (n) { return n.id !== id; });
      if (!stanje.nalogi[izbranDatum].length) delete stanje.nalogi[izbranDatum];
      shrani();
      razveljaviRezultat();
      izrisi();
    }
  }

  /* ---------- izračun ---------- */
  var tekociIzracun = 0;

  async function izracunaj() {
    var izhodisce = $("pdan-izhodisce").value.trim();
    if (!izhodisce) {
      nastaviStatus("Najprej vpišite izhodišče.", true);
      $("pdan-izhodisce").focus();
      return;
    }
    var nalogi = nalogiDneva();
    if (!nalogi.length) return;
    var stevilka = ++tekociIzracun;
    var datum = izbranDatum;
    var gumb = $("pdan-izracunaj");
    gumb.disabled = true;
    nastaviStatus("Računam poti in promet … (prvič lahko traja nekaj sekund na naslov)");
    try {
      var odgovor = await fetch("/api/promet-dan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ izhodisce: izhodisce, datum: datum, jezik: stanje.jezik, naloge: nalogi })
      });
      var podatki = null;
      try { podatki = await odgovor.json(); } catch (_) {}
      if (stevilka !== tekociIzracun) return;
      if (!odgovor.ok || !podatki || !podatki.ok) {
        var sporocilo = podatki && podatki.napaka ? podatki.napaka
          : odgovor.status === 404 ? "Napoved trenutno deluje samo na lokalnem strežniku (npm run dev)." : "Izračun ni uspel. Poskusite znova.";
        nastaviStatus(sporocilo, true);
        return;
      }
      rezultati[datum] = podatki;
      var tezave = podatki.odseki.filter(function (o) { return o.stanje === "zamuda" || o.stanje === "napaka"; }).length;
      nastaviStatus(tezave ? "Pozor: " + tezave + (tezave === 1 ? " odsek potrebuje" : " odseki potrebujejo") + " pozornost." : "Vse poti so izračunane.");
      if (datum === izbranDatum) izrisi();
    } catch (_) {
      if (stevilka === tekociIzracun) nastaviStatus("Povezava s strežnikom ni uspela. Ali teče lokalni strežnik (npm run dev)?", true);
    } finally {
      if (stevilka === tekociIzracun) gumb.disabled = false;
    }
  }

  async function kopiraj() {
    var besedilo = $("pdan-sporocilo").textContent;
    var oznaka = $("pdan-kopiraj-besedilo");
    try {
      await navigator.clipboard.writeText(besedilo);
      oznaka.textContent = "Kopirano";
    } catch (_) {
      var t = document.createElement("textarea");
      t.value = besedilo;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); oznaka.textContent = "Kopirano"; } catch (__) { oznaka.textContent = "Kopiranje ni uspelo"; }
      t.remove();
    }
    setTimeout(function () { oznaka.textContent = "Kopiraj sporočilo"; }, 2000);
  }

  async function naloziPodatkeOPrometu() {
    var p = $("pdan-podatki");
    try {
      var r = await fetch("/api/promet-stanje", { cache: "no-store" });
      var d = await r.json();
      if (!r.ok || !d.ok) throw new Error();
      var ime = { dars: "Slovenija (DARS)", autobahn: "Nemčija (avtoceste)" };
      var deli = [d.zbiralnikTece
        ? "Zbiranje podatkov teče (zadnji zajem ob " + new Date(d.zadnjiZajem).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" }) + ")."
        : "Zbiranje podatkov trenutno ne teče — napoved uporablja oceno tipičnih konic."];
      d.viri.forEach(function (v) { deli.push(ime[v.vir] + ": " + v.uspesnih + " zajemov, pokritost delavnika " + v.pokritostDelavnik + " %."); });
      p.textContent = deli.join(" ");
    } catch (_) {
      p.textContent = "Podatki o prometu so na voljo, ko aplikacija teče prek lokalnega strežnika.";
    }
  }

  /* ---------- dogodki ---------- */
  function init() {
    $("pdan-izhodisce").value = stanje.izhodisce || "";
    $("pdan-jezik").value = stanje.jezik === "de" ? "de" : "sl";
    $("pdan-izhodisce").addEventListener("change", function () {
      stanje.izhodisce = this.value.trim();
      shrani();
      rezultati = {};
      izrisi();
    });
    $("pdan-datum").addEventListener("change", function () {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(this.value)) return;
      izbranDatum = this.value;
      zapriObrazec();
      nastaviStatus("");
      izrisi();
    });
    $("pdan-prejsnji").addEventListener("click", function () { izbranDatum = premakniDan(izbranDatum, -1); zapriObrazec(); nastaviStatus(""); izrisi(); });
    $("pdan-naslednji").addEventListener("click", function () { izbranDatum = premakniDan(izbranDatum, 1); zapriObrazec(); nastaviStatus(""); izrisi(); });
    $("pdan-dodaj").addEventListener("click", function () { odpriObrazec(null); });
    $("pdan-preklici").addEventListener("click", zapriObrazec);
    $("pdan-obrazec").addEventListener("submit", shraniNalog);
    $("pdan-seznam").addEventListener("click", obdelajKlikSeznama);
    $("pdan-izracunaj").addEventListener("click", izracunaj);
    $("pdan-kopiraj").addEventListener("click", kopiraj);
    $("pdan-jezik").addEventListener("change", function () {
      stanje.jezik = this.value === "de" ? "de" : "sl";
      shrani();
      if (rezultati[izbranDatum]) izracunaj();
    });
    izrisi();
    naloziPodatkeOPrometu();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
