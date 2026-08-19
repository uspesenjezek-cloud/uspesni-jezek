(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJStoragePrilogeCache = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var KLJUC_SHRAMBE = "uj-signed-url-priloge-v1";
  var PODPIS_VELJA_SEKUND = 15 * 60;
  var NAJVEC_VNOSOV = 30;

  function varnoPreberi(shramba) {
    if (!shramba || typeof shramba.getItem !== "function") return {};
    try {
      var vrednost = JSON.parse(shramba.getItem(KLJUC_SHRAMBE) || "{}");
      return vrednost && typeof vrednost === "object" && !Array.isArray(vrednost)
        ? vrednost
        : {};
    } catch (_napaka) {
      return {};
    }
  }

  function varnoShrani(shramba, vnosi) {
    if (!shramba || typeof shramba.setItem !== "function") return;
    try {
      shramba.setItem(KLJUC_SHRAMBE, JSON.stringify(vnosi));
    } catch (_napaka) {
      /* Zasebni način lahko sessionStorage zavrne; pomnilniški cache ostane. */
    }
  }

  function ustvari(moznosti) {
    var opts = moznosti || {};
    if (typeof opts.podpisi !== "function") {
      throw new Error("Manjka funkcija za podpis priloge.");
    }

    var shramba = opts.shramba || null;
    var zdaj = typeof opts.zdaj === "function" ? opts.zdaj : Date.now;
    var cakajoci = new Map();
    var pomnilnik = varnoPreberi(shramba);

    function pocistiInShrani() {
      var cas = zdaj();
      var veljavni = Object.keys(pomnilnik)
        .map(function (pot) {
          return { pot: pot, vnos: pomnilnik[pot] };
        })
        .filter(function (element) {
          return element.vnos && element.vnos.url && Number(element.vnos.expiresAt) > cas;
        })
        .sort(function (a, b) {
          return Number(b.vnos.expiresAt) - Number(a.vnos.expiresAt);
        })
        .slice(0, NAJVEC_VNOSOV);
      pomnilnik = {};
      veljavni.forEach(function (element) {
        pomnilnik[element.pot] = element.vnos;
      });
      varnoShrani(shramba, pomnilnik);
    }

    async function pridobi(pot, zahtevanaVeljavnostSekund) {
      var varnaPot = String(pot || "").trim();
      if (!varnaPot) return { napaka: "Manjka pot do priloge." };

      var zahtevano = Math.max(15, Number(zahtevanaVeljavnostSekund) || 60);
      var obstojeci = pomnilnik[varnaPot];
      if (
        obstojeci &&
        obstojeci.url &&
        Number(obstojeci.expiresAt) > zdaj() + (zahtevano + 5) * 1000
      ) {
        return { url: obstojeci.url, izPredpomnilnika: true };
      }

      if (cakajoci.has(varnaPot)) return cakajoci.get(varnaPot);

      var zahteva = (async function () {
        try {
          var url = await opts.podpisi(varnaPot, PODPIS_VELJA_SEKUND);
          if (!url) throw new Error("Ni podpisane povezave.");
          pomnilnik[varnaPot] = {
            url: String(url),
            expiresAt: zdaj() + PODPIS_VELJA_SEKUND * 1000,
          };
          pocistiInShrani();
          return { url: String(url), izPredpomnilnika: false };
        } catch (napaka) {
          return {
            napaka: (napaka && napaka.message) || "Priloge ni bilo mogoče podpisati.",
          };
        } finally {
          cakajoci.delete(varnaPot);
        }
      })();

      cakajoci.set(varnaPot, zahteva);
      return zahteva;
    }

    return { pridobi: pridobi };
  }

  return {
    ustvari: ustvari,
    PODPIS_VELJA_SEKUND: PODPIS_VELJA_SEKUND,
  };
});
