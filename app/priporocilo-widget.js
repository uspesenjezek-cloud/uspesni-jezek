/* ========== Widget "Priporočilo za ta dolg" – skupni del za korak 2 in korak 3 ==========
   Ne spreminja obstoječe logike izbire tona (ton-widget.js / ton-priporocilo.js /
   opomin-nacrt.js) – samo dodaja manjkajoč prikaz (pretekle zamude, razlaga, gumb
   "Uporabi priporočeno", časovnica na koraku 3) in na koraku 3 vklopi obstoječ
   carousel za izbiro tona, ki na koraku 2 že teče prek app.js.
   ============================================ */
(function (root) {
  "use strict";

  var KLJUC_KORAK1 = "neplacilo-korak1-podatki";
  var KLJUC_KORAK2 = "neplacilo-korak2-podatki";
  var korak3Zagnan = false;

  function preberiKorak1() {
    try {
      return JSON.parse(sessionStorage.getItem(KLJUC_KORAK1) || "{}");
    } catch (_e) {
      return {};
    }
  }

  function preberiKorak2() {
    try {
      return JSON.parse(sessionStorage.getItem(KLJUC_KORAK2) || "{}");
    } catch (_e) {
      return {};
    }
  }

  function izracunajDnevZamude(datumZapadlosti) {
    if (!datumZapadlosti) return null;
    var Ton = root.UJTonPriporocilo;
    if (Ton && typeof Ton.izracunajDniZamude === "function") {
      return Ton.izracunajDniZamude(datumZapadlosti, Ton.danesYYYYMMDD());
    }
    var Ocena = root.UJOcenaTveganja;
    if (Ocena && typeof Ocena.koledarskiDneviZamude === "function") {
      return Ocena.koledarskiDneviZamude(datumZapadlosti);
    }
    return null;
  }

  function steviloPreteklihZamud(zgodovinaZamud) {
    if (zgodovinaZamud == null) return null;
    var z = String(zgodovinaZamud);
    if (z === "unknown") return null;
    if (z === "9plus") return 9;
    var n = Number(z);
    return Number.isFinite(n) ? n : null;
  }

  function oznakaPreteklihZamud(zgodovinaZamud) {
    var z = zgodovinaZamud == null ? null : String(zgodovinaZamud);
    if (!z || z === "unknown") return "—";
    if (z === "9plus") return "9+";
    return z;
  }

  function sestaviRazlago(overdueDays, zgodovinaZamud) {
    var deli = [];
    if (overdueDays != null && overdueDays > 0) {
      deli.push(overdueDays + (overdueDays === 1 ? " dan" : " dni") + " zamude");
    }
    var n = steviloPreteklihZamud(zgodovinaZamud);
    if (n != null && n > 0) {
      deli.push(n + (n === 1 ? " pretekle zamude" : " preteklih zamud"));
    }
    if (!deli.length) return "Ton je predlagan glede na znesek in zapadlost.";
    return "Ta ton priporočamo zaradi " + deli.join(" in ") + ".";
  }

  function prilagodiPovzetek() {
    var ids = [
      "ton-znesek-znacka",
      "ton-cas-tekst",
      "ton-zgodovina-znacka",
      "ton-dolznik-znacka",
      "ton-zapadlost-znacka",
    ];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !el.clientWidth) return;
      if (typeof root.UJPrilagodiVelikostVrednosti === "function") {
        root.UJPrilagodiVelikostVrednosti(el);
      }
    });
  }

  function izracunajPriporocilo(podatkiKorak1) {
    var Ton = root.UJTonPriporocilo;
    if (!Ton) return null;
    var vhod = {
      totalDebtCents: Ton.eurosToCents(podatkiKorak1.znesek),
      originalDueDate: podatkiKorak1.datumZapadlosti || null,
      evaluationDate: Ton.danesYYYYMMDD(),
    };
    var Ocena = root.UJOcenaTveganja;
    if (Ocena && typeof Ocena.izracunajPriporocilo === "function") {
      return Ocena.izracunajPriporocilo(vhod);
    }
    return Ton.getRecommendedTone(vhod);
  }

  function najdiPriporocenoKartico(tir) {
    if (!tir) return null;
    var zvezda = tir.querySelector(".tone-option__recommended-star:not([hidden])");
    return zvezda ? zvezda.closest(".tone-option") : null;
  }

  function vezaviGumbUporabi(gumbId, tirId) {
    var gumb = document.getElementById(gumbId || "priporocilo-uporabi-gumb");
    if (!gumb) return;
    gumb.addEventListener("click", function () {
      var tir = document.getElementById(tirId || "ton-tir");
      var cilj = najdiPriporocenoKartico(tir);
      if (cilj) cilj.click();
    });
  }

  function pluralKorakov(n) {
    if (n === 1) return "korak";
    if (n === 2) return "koraka";
    if (n === 3 || n === 4) return "koraki";
    return "korakov";
  }

  /* ---------- Korak 2: samo manjkajoč prikaz (ton-widget že teče prek app.js) ---------- */

  function inicializirajKorak2() {
    var korak1 = preberiKorak1();
    var overdueDays = izracunajDnevZamude(korak1.datumZapadlosti);

    function osvezi() {
      var zgodovinaEl = document.getElementById("ton-zgodovina-znacka");
      var razlagaEl = document.getElementById("priporocilo-razlaga");
      var dolznikEl = document.getElementById("ton-dolznik-znacka");
      var zapadlostEl = document.getElementById("ton-zapadlost-znacka");
      if (zgodovinaEl) zgodovinaEl.textContent = oznakaPreteklihZamud(korak1.zgodovinaZamud);
      if (razlagaEl) razlagaEl.textContent = sestaviRazlago(overdueDays, korak1.zgodovinaZamud);
      if (dolznikEl) {
        dolznikEl.textContent = korak1.nazivPodjetja || korak1.imeDolznika || "—";
      }
      if (zapadlostEl) {
        /* Enaka prednost vira datuma kot na kartici "Predaja odvetniku"
           (opomin-nacrt-ui.js, htmlPredajaPovzetek): rokPlacila je datum,
           prebran iz skeniranega dokumenta, in ima prednost pred ročno
           vnesenim datumZapadlosti, če oba obstajata. */
        var virZapadlosti = korak1.rokPlacila || korak1.datumZapadlosti;
        zapadlostEl.textContent =
          virZapadlosti && typeof formatirajDatumSl === "function"
            ? formatirajDatumSl(virZapadlosti)
            : "—";
      }
      prilagodiPovzetek();
    }

    osvezi();
    root.setTimeout(prilagodiPovzetek, 80);
    vezaviGumbUporabi("priporocilo-uporabi-gumb", "ton-tir");
  }

  /* ---------- Korak 3: widget + vklop obstoječega carousela za izbiro tona ---------- */

  function inicializirajKorak3() {
    if (korak3Zagnan) return true;
    if (
      !root.UJNacrtApi ||
      !root.UJOpominNacrt ||
      !root.UJTonPriporocilo ||
      typeof root.inicializirajTonWidget !== "function"
    ) {
      return false;
    }

    var korak1 = preberiKorak1();
    var overdueDaysZgodovina = izracunajDnevZamude(korak1.datumZapadlosti);
    var priporocilo = izracunajPriporocilo(korak1) || {};
    var widgetApi = null;

    function trenutniPlan() {
      return root.UJNacrtApi.getPlan();
    }

    function stanje() {
      var plan = trenutniPlan();
      var selected = (plan && plan.toneId) || priporocilo.recommendedToneId || "friendly";
      var recId = priporocilo.recommendedToneId || "friendly";
      return {
        recommendedToneId: recId,
        selectedToneId: selected,
        selectionMode: selected === recId ? "automatic" : "manual",
        isOverridden: selected !== recId,
        amountLabel: priporocilo.amountLabel,
        debtCategoryLabel: priporocilo.debtCategoryLabel,
        overdueDays: priporocilo.overdueDays,
        timingLabel: priporocilo.timingLabel,
        reasonText: priporocilo.reasonText,
        reasonDetailText: priporocilo.reasonDetailText,
      };
    }

    function osveziRazlagoInZgodovino() {
      var zgodovinaEl = document.getElementById("ton-zgodovina-znacka");
      var razlagaEl = document.getElementById("priporocilo-razlaga");
      var dolznikEl = document.getElementById("ton-dolznik-znacka");
      var zapadlostEl = document.getElementById("ton-zapadlost-znacka");
      if (zgodovinaEl) zgodovinaEl.textContent = oznakaPreteklihZamud(korak1.zgodovinaZamud);
      if (razlagaEl) {
        razlagaEl.textContent = sestaviRazlago(overdueDaysZgodovina, korak1.zgodovinaZamud);
      }
      if (dolznikEl) {
        dolznikEl.textContent = korak1.nazivPodjetja || korak1.imeDolznika || "—";
      }
      if (zapadlostEl) {
        var virZapadlosti = korak1.rokPlacila || korak1.datumZapadlosti;
        zapadlostEl.textContent =
          virZapadlosti && typeof formatirajDatumSl === "function"
            ? formatirajDatumSl(virZapadlosti)
            : "—";
      }
      prilagodiPovzetek();
    }

    function osveziCasovnico() {
      var plan = trenutniPlan();
      var stEl = document.getElementById("priporocilo-casovnica-koraki");
      var trEl = document.getElementById("priporocilo-casovnica-trajanje");
      if (!plan || !stEl) return;
      var n = (plan.steps || []).filter(function (korak) { return !korak.isExcluded; }).length;
      stEl.textContent = n + " " + pluralKorakov(n);
      if (trEl) {
        trEl.textContent =
          plan.totalDurationDays != null ? "v " + plan.totalDurationDays + " dneh" : "";
      }
    }

    function onToneSelected(toneId) {
      var k2 = root.UJPodatkiKorak2Ref;
      if (!k2) return;
      k2.toneRecommendation = Object.assign({}, k2.toneRecommendation, {
        appliedToneId: toneId,
        selectedToneId: toneId,
      });
      k2.izbranTonId = toneId;
      try {
        sessionStorage.setItem(KLJUC_KORAK2, JSON.stringify(k2));
      } catch (_e) {}
      if (root.UJNacrtApi && typeof root.UJNacrtApi.osvezi === "function") {
        root.UJNacrtApi.osvezi();
      }
      if (widgetApi) widgetApi.osvezi();
      osveziCasovnico();
    }

    widgetApi = root.inicializirajTonWidget({
      getState: stanje,
      recommendation: priporocilo,
      onToneSelected: onToneSelected,
    });

    osveziRazlagoInZgodovino();
    root.setTimeout(prilagodiPovzetek, 80);
    osveziCasovnico();
    vezaviGumbUporabi("priporocilo-uporabi-gumb", "ton-tir");

    var casovnicaVrstica = document.getElementById("priporocilo-casovnica-vrstica");
    var glavniEl = document.getElementById("opomin-nacrt-glavni");
    if (casovnicaVrstica && glavniEl) {
      casovnicaVrstica.addEventListener("click", function () {
        glavniEl.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    korak3Zagnan = true;
    return true;
  }

  function zazeni() {
    if (document.getElementById("opomin-nacrt-glavni")) {
      inicializirajKorak3();
    } else if (document.getElementById("obrazec-sporocilo")) {
      inicializirajKorak2();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", zazeni);
  } else {
    zazeni();
  }
  /* inicializirajPosiljanje je asinhron (med drugim pocaka sinhronizacijo
     kartic). Ce DOMContentLoaded pride prej, widget dobi se ta zanesljiv
     drugi signal in se napolni takoj, ko so podatki na voljo. */
  root.addEventListener("uj:nacrt-pripravljen", function () {
    inicializirajKorak3();
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
