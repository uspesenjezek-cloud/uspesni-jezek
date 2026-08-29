(function () {
  "use strict";

  var DOMOV = new URL("index.html", document.baseURI).href;

  function jePrejsnjaStranVAppu() {
    if (!document.referrer || history.length <= 1) return false;
    try {
      var prejsnja = new URL(document.referrer);
      return prejsnja.origin === location.origin && prejsnja.pathname.indexOf("/app/") !== -1;
    } catch (_napaka) {
      return false;
    }
  }

  function ciljPrejsnjegaKoraka() {
    var glavaKorakov = document.querySelector("[data-wizard-progress-header][data-korak]");
    if (!glavaKorakov) return "";

    var trenutniKorak = Number(glavaKorakov.getAttribute("data-korak"));
    if (!Number.isFinite(trenutniKorak) || trenutniKorak < 1) return "";

    if (trenutniKorak > 1) {
      var prejsnjaPovezava = document.querySelector(
        '[data-koraki-postopek] a[data-korak="' + (trenutniKorak - 1) + '"][href]'
      );
      if (prejsnjaPovezava) return prejsnjaPovezava.href;
    }

    /* Korak 1 -> korak 0. Postopki brez zgornje vrstice določijo izhod
       neposredno na glavi korakov, da history.back ne ustvari zanke
       Dolžnik -> Pošiljanje -> Dolžnik. */
    var doloceniZacetniZaslon = glavaKorakov.getAttribute(
      "data-wizard-zacetni-zaslon"
    );
    if (doloceniZacetniZaslon) {
      return new URL(doloceniZacetniZaslon, document.baseURI).href;
    }

    var zacetniZaslon = document.querySelector(".wizard-topbar__nazaj[href]");
    return zacetniZaslon ? zacetniZaslon.href : "";
  }

  function pojdiNazaj() {
    /* Stran lahko najprej zapre svoj trenutni notranji korak (npr. rezultat
       preverbe). Šele ko notranjega koraka ni, smemo zapustiti stran. */
    if (
      typeof window.UJPoskusiNotranjiKorakNazaj === "function" &&
      window.UJPoskusiNotranjiKorakNazaj()
    ) {
      return;
    }

    var prejsnjiKorak = ciljPrejsnjegaKoraka();
    if (prejsnjiKorak) {
      /* Prejšnji korak nadomesti trenutnega v zgodovini. Sicer bi pritisk
         Nazaj na prvem koraku odprl pravkar zapuščeni drugi korak. */
      location.replace(prejsnjiKorak);
      return;
    }

    if (jePrejsnjaStranVAppu()) {
      history.back();
      return;
    }
    location.assign(DOMOV);
  }

  function vsebinaVrstice() {
    return [
      '<button class="app-testna-vrstica__gumb" type="button" data-app-nazaj aria-label="Nazaj">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
      '<span>Nazaj</span>',
      '</button>',
      '<a class="app-testna-vrstica__gumb" data-app-domov href="index.html" aria-label="Home – osnovni meni">',
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
      '<span>Home</span>',
      '</a>',
      '<span class="app-testna-vrstica__prazno" aria-hidden="true"></span>'
    ].join("");
  }

  function pripraviVrstico() {
    document.body.classList.add("app-testna-vrstica-prisotna");

    var vrstica = document.querySelector("#app-testna-vrstica, #boniteta-app-testna-vrstica");
    var prostor = document.querySelector(".app-testna-vrstica-prostor");
    /* Bonitetni center ima lasten, že rezerviran spodnji prostor za dve
       navigaciji. Na drugih straneh ga skupna vrstica doda sama. */
    if (!prostor && !vrstica) {
      prostor = document.createElement("div");
      prostor.className = "app-testna-vrstica-prostor";
      prostor.setAttribute("aria-hidden", "true");
      document.body.appendChild(prostor);
    }

    if (!vrstica) {
      vrstica = document.createElement("nav");
      vrstica.className = "app-testna-vrstica";
      vrstica.id = "app-testna-vrstica";
      vrstica.setAttribute("data-locked", "true");
      document.body.appendChild(vrstica);
    }

    vrstica.setAttribute("role", "navigation");
    vrstica.setAttribute("aria-label", "Glavna navigacija aplikacije");
    vrstica.innerHTML = vsebinaVrstice();
    vrstica.querySelector("[data-app-nazaj]").addEventListener("click", pojdiNazaj);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pripraviVrstico, { once: true });
  } else {
    pripraviVrstico();
  }
})();
