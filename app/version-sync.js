(function () {
  "use strict";

  /* Lokalni razvojni prikaz se mora na PC-ju in telefonu vedno osvežiti,
     sicer odprti zavihek kaže star UI tudi potem, ko strežnik že servira novo
     različico. Spremljajo se samo sredstva trenutno odprte strani. */
  var host = window.location.hostname;
  var lokalniAliZasebniNaslov =
    host === "localhost" ||
    host === "127.0.0.1" ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  var samodejnoOsvezevanje =
    lokalniAliZasebniNaslov ||
    new URLSearchParams(window.location.search).get("app-auto-refresh") === "1";
  if (!samodejnoOsvezevanje) return;

  var trenutnaRazlicica = null;
  var preverjanjeVTeku = false;

  var spremljanaSredstva = [window.location.pathname];
  document
    .querySelectorAll('link[rel="stylesheet"][href], script[src]')
    .forEach(function (element) {
      var vrednost = element.href || element.src;
      if (!vrednost) return;
      var naslov = new URL(vrednost, window.location.href);
      if (naslov.origin !== window.location.origin) return;
      if (spremljanaSredstva.indexOf(naslov.pathname) === -1) {
        spremljanaSredstva.push(naslov.pathname);
      }
    });

  function naslovRazlicice() {
    var naslov = new URL("/__app-version", window.location.origin);
    naslov.searchParams.set("t", String(Date.now()));
    spremljanaSredstva.forEach(function (sredstvo) {
      naslov.searchParams.append("asset", sredstvo);
    });
    return naslov.href;
  }

  async function preveriRazlicico() {
    if (preverjanjeVTeku || document.visibilityState === "hidden") return;
    preverjanjeVTeku = true;
    try {
      var odgovor = await fetch(naslovRazlicice(), {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!odgovor.ok) return;
      var podatki = await odgovor.json();
      var novaRazlicica = String((podatki && podatki.version) || "");
      if (!novaRazlicica) return;
      if (trenutnaRazlicica == null) {
        trenutnaRazlicica = novaRazlicica;
        return;
      }
      if (novaRazlicica !== trenutnaRazlicica) {
        var sveziNaslov = new URL(window.location.href);
        sveziNaslov.searchParams.set("_dev", String(Date.now()));
        window.location.replace(sveziNaslov.href);
      }
    } catch (_napaka) {
      /* Kratka prekinitev povezave ne sme motiti uporabe aplikacije. */
    } finally {
      preverjanjeVTeku = false;
    }
  }

  preveriRazlicico();
  window.setInterval(preveriRazlicico, 2000);
  window.addEventListener("focus", preveriRazlicico);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") preveriRazlicico();
  });
})();
