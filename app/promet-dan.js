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
  /* »Vožnja: običajno 20 min · ob tej uri +4 min (gneča)« — čas brez prometa
     proti času ob uri, ko se bo ta pot dejansko vozila. */
  function besediloVoznje(o) {
    if (!o || o.trajanjeProstoMin == null || o.stanje === "napaka" || o.stanje === "isti_naslov") return "";
    var dodatno = o.dodatnaZamudaMin || 0;
    var deli = ["Vožnja: običajno " + o.trajanjeProstoMin + " min"];
    deli.push(dodatno > 0 ? "ob tej uri +" + dodatno + " min" + (o.opozorilo ? " (gneča)" : "") : "ob tej uri brez zamude");
    deli.push(o.osnova === "meritve" ? "po meritvah" : o.osnova === "mesano" ? "delno po meritvah" : "groba ocena, še brez meritev");
    return deli.join(" · ");
  }

  function ustvariNalog(n, odsek) {
    var li = $("pdan-nalog-predloga").content.firstElementChild.cloneNode(true);
    li.dataset.id = n.id;
    var cas = li.querySelector(".pdan__nalog-cas");
    cas.textContent = n.zacetek;
    var konec = document.createElement("span");
    konec.textContent = "do " + n.konec;
    cas.appendChild(konec);
    li.querySelector(".pdan__nalog-stranka").textContent = n.stranka || n.naslov;
    li.querySelector(".pdan__nalog-naslov").textContent = n.naslov;
    var voznja = li.querySelector(".pdan__nalog-voznja");
    voznja.textContent = besediloVoznje(odsek);
    voznja.hidden = !voznja.textContent;
    voznja.classList.toggle("pdan__nalog-voznja--gneca", !!(odsek && odsek.opozorilo));
    return li;
  }

  function besedilaOdseka(o) {
    var podrobno = [];
    if (o.trajanjeVarnoMin != null) {
      podrobno.push(o.trajanjeVarnoMin + " min vožnje");
      if (o.dodatnaZamudaMin > 0) podrobno.push("+" + o.dodatnaZamudaMin + " min promet");
      if (o.razdaljaKm != null) podrobno.push(String(o.razdaljaKm).replace(".", ",") + " km");
    }
    if (o.osnova === "zacetna_ocena" || o.osnova === "mesano") podrobno.push("groba ocena, še brez meritev");
    if (o.virPoti === "javni_preizkusni") podrobno.push("pot: javni preizkusni strežnik");
    if (o.priblizno && o.iskano) podrobno.push("naslov približno: " + o.iskano);
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
      seznam.appendChild(ustvariNalog(n, odsekiPoNalogu[n.id]));
    });
    $("pdan-prazno").hidden = nalogi.length > 0;
    $("pdan-izracunaj").hidden = nalogi.length === 0;
    var povzetek = $("pdan-povzetek");
    povzetek.hidden = !rez;
    if (rez) $("pdan-sporocilo").textContent = rez.sporocilo;
    narisiPoti();
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

  /* ---------- prijava (na Vercelu API zahteva žeton) ---------- */
  async function glave(dodatno) {
    var h = Object.assign({}, dodatno || {});
    try {
      // supabase-client.js deklarira »const supabaseKlient«: ni lastnost objekta window.
      var klient = typeof supabaseKlient !== "undefined" ? supabaseKlient : window.supabaseKlient;
      var seja = await klient.auth.getSession();
      var zeton = seja && seja.data && seja.data.session && seja.data.session.access_token;
      if (zeton) h.Authorization = "Bearer " + zeton;
    } catch (_) {}
    return h;
  }

  function sporociloNapake(odgovor, podatki) {
    if (podatki && podatki.napaka) return podatki.napaka;
    if (odgovor.status === 404) return "Strežnik ne pozna napovedi prometa. Posodobite kodo in znova zaženite strežnik (npm run dev).";
    if (odgovor.status === 401) return "Prijava je potekla. Prijavite se znova.";
    return "Izračun ni uspel (napaka " + odgovor.status + "). Poskusite znova.";
  }

  /* ---------- zemljevid ---------- */
  var BARVE = { rdece: "#c62828", oranzno: "#d97b3f", zeleno: "#3f9d5e", ni_podatka: "#94a3b8" };
  var zemljevid = null;
  var zemljevidPripravljen = false;
  var oznake = [];
  var zadnjiPromet = null;
  var casovnikOsvezitve = null;

  function barvaIzraza() {
    return ["match", ["get", "barva"], "rdece", BARVE.rdece, "oranzno", BARVE.oranzno, "zeleno", BARVE.zeleno, BARVE.ni_podatka];
  }

  function sporociloZemljevida(besedilo) {
    var ovoj = $("pdan-zemljevid");
    var p = ovoj.querySelector(".pdan__zemljevid-sporocilo");
    if (!p) { p = document.createElement("p"); p.className = "pdan__zemljevid-sporocilo"; ovoj.appendChild(p); }
    p.textContent = besedilo;
  }

  function initZemljevid() {
    if (!window.maplibregl) {
      sporociloZemljevida("Zemljevida ni bilo mogoče naložiti (ni povezave do knjižnice zemljevidov).");
      $("pdan-zemljevid-status").textContent = "";
      return;
    }
    try {
      zemljevid = new window.maplibregl.Map({
        container: "pdan-zemljevid",
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [14.85, 46.12],
        zoom: 7,
        attributionControl: { compact: true },
        cooperativeGestures: true
      });
    } catch (_) {
      sporociloZemljevida("Ta naprava ne podpira prikaza zemljevida.");
      return;
    }
    zemljevid.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "top-right");
    zemljevid.on("load", function () {
      zemljevid.addSource("promet", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      zemljevid.addSource("poti", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      zemljevid.addLayer({ id: "poti-obroba", type: "line", source: "poti", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 8 } });
      zemljevid.addLayer({ id: "poti", type: "line", source: "poti", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": barvaIzraza(), "line-width": 5 } });
      zemljevid.addLayer({ id: "promet-crte", type: "line", source: "promet", filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round" }, paint: { "line-color": barvaIzraza(), "line-width": 5 } });
      zemljevid.addLayer({ id: "promet-stevci", type: "circle", source: "promet", filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "vrsta"], "stevec"]],
        paint: { "circle-color": barvaIzraza(), "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2.5, 10, 5, 14, 7], "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 } });
      zemljevid.addLayer({ id: "promet-dogodki", type: "circle", source: "promet", filter: ["all", ["==", ["geometry-type"], "Point"], ["!=", ["get", "vrsta"], "stevec"]],
        paint: { "circle-color": barvaIzraza(), "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 4, 12, 8], "circle-stroke-color": "#1a2e24", "circle-stroke-width": ["case", ["==", ["get", "vrsta"], "zapora"], 2.5, 1] } });
      ["promet-crte", "promet-stevci", "promet-dogodki"].forEach(function (sloj) {
        zemljevid.on("click", sloj, function (e) {
          var p = e.features[0].properties;
          var vrsta = { stevec: "Števec prometa", zastoj: "Zastoj", dela: "Dela na cesti", zapora: "Zapora" }[p.vrsta] || "Promet";
          var deli = [vrsta + (p.cesta ? " · " + p.cesta : ""), p.opis, p.stanje, p.hitrost ? "Hitrost: " + p.hitrost + " km/h" : "", p.zamudaMin ? "Zamuda: " + p.zamudaMin + " min" : ""].filter(Boolean);
          var div = document.createElement("div");
          deli.forEach(function (d, i) { var el = document.createElement(i ? "div" : "strong"); el.textContent = d; div.appendChild(el); });
          new window.maplibregl.Popup({ closeButton: false, maxWidth: "240px" }).setLngLat(e.lngLat).setDOMContent(div).addTo(zemljevid);
        });
        zemljevid.on("mouseenter", sloj, function () { zemljevid.getCanvas().style.cursor = "pointer"; });
        zemljevid.on("mouseleave", sloj, function () { zemljevid.getCanvas().style.cursor = ""; });
      });
      zemljevidPripravljen = true;
      if (zadnjiPromet) zemljevid.getSource("promet").setData(zadnjiPromet);
      narisiPoti();
    });
    zemljevid.on("error", function (e) {
      if (!zemljevidPripravljen && e && e.error) sporociloZemljevida("Podlage zemljevida ni bilo mogoče naložiti.");
    });
  }

  async function naloziPromet() {
    var status = $("pdan-zemljevid-status");
    try {
      var r = await fetch("/api/promet-zemljevid", { cache: "no-store", headers: await glave() });
      var d = null;
      try { d = await r.json(); } catch (_) {}
      if (!r.ok || !d || !d.ok) throw new Error(sporociloNapake(r, d));
      zadnjiPromet = { type: "FeatureCollection", features: d.features };
      if (zemljevidPripravljen) zemljevid.getSource("promet").setData(zadnjiPromet);
      var ura = new Date(d.posodobljeno).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" });
      // Pri napaki vira izpišemo tudi razlog (HTTP koda, napačen odgovor …),
      // da je jasno, ali gre za vir ali za našo aplikacijo.
      var napake = d.viri.filter(function (v) { return !v.ok; }).map(function (v) {
        var ime = { "dars-stevci": "števci DARS", "dars-dogodki": "dogodki DARS", autobahn: "nemške avtoceste" }[v.vir] || v.vir;
        return ime + (v.napaka ? " (" + String(v.napaka).replace(/^[a-z-]+: /, "").slice(0, 140) + ")" : "");
      });
      status.textContent = "Posodobljeno ob " + ura + " · DARS (SI) in Autobahn (DE)." +
        (napake.length ? " Ni podatkov: " + napake.join("; ") + "." : "") +
        " Ceste brez števca niso pobarvane.";
    } catch (e) {
      status.textContent = "Promet v živo ni na voljo: " + e.message;
    }
  }

  /* Barva poti: razmerje zamude IN absolutna zamuda (3 min na 10 min ni rdeče). */
  function barvaOdseka(o) {
    if (o.stanje === "zamuda" || o.stanje === "napaka") return "rdece";
    var dodatno = o.dodatnaZamudaMin || 0;
    var prosto = o.trajanjeProstoMin || 0;
    var razmerje = prosto > 0 ? dodatno / prosto : 0;
    if (razmerje >= 0.3 && dodatno >= 8) return "rdece";
    if (o.stanje === "tesno" || (razmerje >= 0.1 && dodatno >= 3)) return "oranzno";
    return "zeleno";
  }

  function oznaka(lngLat, besedilo, dom) {
    var el = document.createElement("div");
    el.className = "pdan__oznaka-tocke" + (dom ? " pdan__oznaka-tocke--dom" : "");
    el.textContent = besedilo;
    return new window.maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(zemljevid);
  }

  function narisiPoti() {
    if (!zemljevidPripravljen) return;
    oznake.forEach(function (m) { m.remove(); });
    oznake = [];
    var rez = rezultati[izbranDatum];
    var odseki = rez ? rez.odseki.filter(function (o) { return o.geometrija && o.geometrija.length >= 2; }) : [];
    zemljevid.getSource("poti").setData({ type: "FeatureCollection", features: odseki.map(function (o) {
      return { type: "Feature", geometry: { type: "LineString", coordinates: o.geometrija }, properties: { barva: barvaOdseka(o) } };
    }) });
    if (!odseki.length) return;
    var meje = new window.maplibregl.LngLatBounds();
    var st = 0;
    rez.odseki.forEach(function (o) {
      if (o.prvi && o.odTocka) { oznake.push(oznaka(o.odTocka, "D", true)); meje.extend(o.odTocka); }
      if (o.doTocka) { st++; oznake.push(oznaka(o.doTocka, String(st), false)); meje.extend(o.doTocka); }
      (o.geometrija || []).forEach(function (t) { meje.extend(t); });
    });
    zemljevid.fitBounds(meje, { padding: { top: 40, bottom: 40, left: 40, right: 64 }, maxZoom: 14, duration: 600 });
  }

  function zacniOsvezevanje() {
    clearInterval(casovnikOsvezitve);
    casovnikOsvezitve = setInterval(function () { if (!document.hidden) naloziPromet(); }, 3 * 60 * 1000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) naloziPromet(); });
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
        headers: await glave({ "Content-Type": "application/json" }),
        body: JSON.stringify({ izhodisce: izhodisce, datum: datum, jezik: stanje.jezik, naloge: nalogi })
      });
      var podatki = null;
      try { podatki = await odgovor.json(); } catch (_) {}
      if (stevilka !== tekociIzracun) return;
      if (!odgovor.ok || !podatki || !podatki.ok) {
        nastaviStatus(sporociloNapake(odgovor, podatki), true);
        return;
      }
      rezultati[datum] = podatki;
      var tezave = podatki.odseki.filter(function (o) { return o.stanje === "zamuda" || o.stanje === "napaka"; }).length;
      var opozorilaPodatkov = [];
      podatki.odseki.forEach(function (o) { (o.opozorila || []).forEach(function (t) { if (opozorilaPodatkov.indexOf(t) === -1) opozorilaPodatkov.push(t); }); });
      nastaviStatus((tezave ? "Pozor: " + tezave + (tezave === 1 ? " odsek potrebuje" : " odseki potrebujejo") + " pozornost." : "Vse poti so izračunane.") +
        (opozorilaPodatkov.length ? " " + opozorilaPodatkov.join(" ") : ""));
      if (datum === izbranDatum) izrisi();
    } catch (_) {
      if (stevilka === tekociIzracun) nastaviStatus("Povezava s strežnikom ni uspela. Preverite internetno povezavo oziroma ali teče strežnik.", true);
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
      var r = await fetch("/api/promet-stanje", { cache: "no-store", headers: await glave() });
      var d = null;
      try { d = await r.json(); } catch (_) {}
      if (!r.ok || !d || !d.ok) throw new Error(sporociloNapake(r, d));
      var ime = { dars: "Slovenija (DARS)", autobahn: "Nemčija (avtoceste)" };
      var deli = [d.zbiralnikTece
        ? "Zgodovina se zbira vsakih 15 min (zadnji zajem ob " + new Date(d.zadnjiZajem).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" }) + ")."
        : "Zgodovina prometa se še ne zbira — napoved uporablja oceno tipičnih konic."];
      d.viri.forEach(function (v) {
        var vrstica = ime[v.vir] + ": " + v.uspesnih + " uspešnih zajemov, pokritost delavnika " + v.pokritostDelavnik + " %.";
        if (v.zadnji && !v.zadnji.uspeh && v.zadnji.napaka) vrstica += " Zadnja napaka: " + v.zadnji.napaka.replace(/^[a-z-]+: /, "") + ".";
        deli.push(vrstica);
      });
      if (d.napaka) deli = [d.napaka + " Napoved zato uporablja oceno tipičnih konic."];
      p.textContent = deli.join(" ");
    } catch (e) {
      p.textContent = "Stanja zbiranja ni bilo mogoče prebrati" + (e && e.message ? " (" + e.message + ")" : "") + ".";
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
    $("pdan-osvezi").addEventListener("click", naloziPromet);
    izrisi();
    initZemljevid();
    naloziPromet();
    zacniOsvezevanje();
    naloziPodatkeOPrometu();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
