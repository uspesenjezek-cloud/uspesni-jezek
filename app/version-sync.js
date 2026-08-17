(function () {
  "use strict";

  var trenutnaRazlicica = null;
  var preverjanjeVTeku = false;

  async function preveriRazlicico() {
    if (preverjanjeVTeku || document.visibilityState === "hidden") return;
    preverjanjeVTeku = true;
    try {
      var odgovor = await fetch("/__app-version?t=" + Date.now(), {
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
        window.location.reload();
      }
    } catch (_napaka) {
      /* Kratka prekinitev povezave ne sme motiti uporabe aplikacije. */
    } finally {
      preverjanjeVTeku = false;
    }
  }

  preveriRazlicico();
  window.setInterval(preveriRazlicico, 5000);
  window.addEventListener("focus", preveriRazlicico);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") preveriRazlicico();
  });
})();
