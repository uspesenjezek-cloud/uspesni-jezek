(function () {
  "use strict";

  if (window.UJKameraVAplikaciji) return;
  document.documentElement.setAttribute("data-uj-kamera-nalozena", "1");

  var ciljniVnos = null;
  var tokKamere = null;
  var predogledUrl = "";
  var zajetaDatoteka = null;
  var elementi = null;
  var zadnjiFokus = null;
  var stanjeDovoljenjaKamere = "";
  var brskalnik = window.navigator || {};

  if (brskalnik.permissions && typeof brskalnik.permissions.query === "function") {
    try {
      var poizvedbaDovoljenja = brskalnik.permissions.query({ name: "camera" });
      if (poizvedbaDovoljenja && typeof poizvedbaDovoljenja.then === "function") {
        poizvedbaDovoljenja.then(function (dovoljenje) {
          stanjeDovoljenjaKamere = dovoljenje.state;
          dovoljenje.addEventListener("change", function () { stanjeDovoljenjaKamere = dovoljenje.state; });
        }).catch(function () {});
      }
    } catch (_napakaDovoljenja) {
      stanjeDovoljenjaKamere = "unsupported";
    }
  }

  function svgPot(ime) {
    if (ime === "zapri") return '<path d="m14.5 5-7 7 7 7"/>';
    if (ime === "slikaj") return '<path d="M9 5.5 10.4 4h3.2L15 5.5h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h3Z"/><circle cx="12" cy="12" r="3.5"/>';
    if (ime === "galerija") return '<rect x="3.5" y="4" width="17" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m5 17 4.5-4.5 3 3 2-2 4.5 3.5"/>';
    return '<path d="m8 12 2.7 2.7L16.5 9"/>';
  }

  function ustvariIkono(ime) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + svgPot(ime) + '</svg>';
  }

  function zagotoviKamero() {
    if (elementi) return elementi;

    var ovoj = document.createElement("div");
    ovoj.className = "uj-kamera";
    ovoj.hidden = true;
    ovoj.innerHTML = [
      '<div class="uj-kamera__zatemnitev" data-uj-kamera-zapri></div>',
      '<section class="uj-kamera__list" role="dialog" aria-modal="true" aria-label="Kamera za slikanje dokumenta">',
      '  <div class="uj-kamera__okno">',
      '    <video class="uj-kamera__video" autoplay muted playsinline webkit-playsinline></video>',
      '    <img class="uj-kamera__slika" alt="Predogled posnetega dokumenta" hidden />',
      '    <div class="uj-kamera__nalaganje"><span></span><strong>Odpiram kamero …</strong></div>',
      '    <div class="uj-kamera__napaka" hidden><strong>Dovolite kamero v brskalniku</strong><p>Za živo sliko v tej kartici dovolite dostop do kamere.</p><button class="uj-kamera__poskusi" type="button">Poskusi znova</button></div>',
      '    <p class="uj-kamera__namig">Poravnajte dokument v kader</p>',
      '    <div class="uj-kamera__akcije">',
      '      <button class="uj-kamera__zapri" type="button" data-uj-kamera-zapri aria-label="Nazaj">' + ustvariIkono("zapri") + '</button>',
      '      <button class="uj-kamera__sprozi" type="button" aria-label="Slikaj dokument" disabled><span></span></button>',
      '      <button class="uj-kamera__galerija" type="button" aria-label="Izberi sliko iz galerije"><span aria-hidden="true"><i></i><i></i><i></i></span></button>',
      '    </div>',
      '    <div class="uj-kamera__pregled-akcije" hidden>',
      '      <button class="uj-kamera__ponovi" type="button">Ponovi</button>',
      '      <button class="uj-kamera__uporabi" type="button">' + ustvariIkono("kljukica") + '<span>Uporabi sliko</span></button>',
      '    </div>',
      '  </div>',
      '  <input class="uj-kamera__izberi" type="file" accept="image/*" hidden />',
      '  <canvas class="uj-kamera__platno" hidden></canvas>',
      '</section>',
    ].join("");
    document.body.appendChild(ovoj);

    elementi = {
      ovoj: ovoj,
      list: ovoj.querySelector(".uj-kamera__list"),
      video: ovoj.querySelector(".uj-kamera__video"),
      slika: ovoj.querySelector(".uj-kamera__slika"),
      nalaganje: ovoj.querySelector(".uj-kamera__nalaganje"),
      napaka: ovoj.querySelector(".uj-kamera__napaka"),
      namig: ovoj.querySelector(".uj-kamera__namig"),
      akcije: ovoj.querySelector(".uj-kamera__akcije"),
      sprozi: ovoj.querySelector(".uj-kamera__sprozi"),
      galerija: ovoj.querySelector(".uj-kamera__galerija"),
      pregledAkcije: ovoj.querySelector(".uj-kamera__pregled-akcije"),
      ponovi: ovoj.querySelector(".uj-kamera__ponovi"),
      uporabi: ovoj.querySelector(".uj-kamera__uporabi"),
      poskusi: ovoj.querySelector(".uj-kamera__poskusi"),
      izberi: ovoj.querySelector(".uj-kamera__izberi"),
      platno: ovoj.querySelector(".uj-kamera__platno"),
      zapri: ovoj.querySelector(".uj-kamera__zapri"),
    };

    ovoj.querySelectorAll("[data-uj-kamera-zapri]").forEach(function (gumb) {
      gumb.addEventListener("click", zapriKamero);
    });
    elementi.sprozi.addEventListener("click", zajemiSliko);
    elementi.ponovi.addEventListener("click", function () { void zacniPredogled(); });
    elementi.poskusi.addEventListener("click", function () { void zacniPredogled(); });
    elementi.uporabi.addEventListener("click", uporabiSliko);
    elementi.galerija.addEventListener("click", function () { elementi.izberi.click(); });
    elementi.izberi.addEventListener("change", function () {
      var datoteka = elementi.izberi.files && elementi.izberi.files[0];
      if (!datoteka) return;
      zajetaDatoteka = datoteka;
      prikaziZajetoSliko(datoteka);
      elementi.izberi.value = "";
    });
    return elementi;
  }

  function ustaviTok() {
    if (tokKamere) {
      tokKamere.getTracks().forEach(function (sled) { sled.stop(); });
      tokKamere = null;
    }
    if (elementi) elementi.video.srcObject = null;
  }

  function pocistiPredogledUrl() {
    if (predogledUrl) URL.revokeObjectURL(predogledUrl);
    predogledUrl = "";
  }

  function ponastaviPrikaz() {
    pocistiPredogledUrl();
    zajetaDatoteka = null;
    elementi.slika.hidden = true;
    elementi.slika.removeAttribute("src");
    elementi.video.hidden = false;
    elementi.nalaganje.hidden = false;
    elementi.napaka.hidden = true;
    elementi.namig.hidden = false;
    elementi.namig.textContent = "Poravnajte dokument v kader";
    elementi.akcije.hidden = false;
    elementi.pregledAkcije.hidden = true;
    elementi.sprozi.disabled = true;
  }

  function opisNapake(napaka) {
    if (napaka && (napaka.name === "NotAllowedError" || napaka.name === "SecurityError")) {
      return "V nastavitvah brskalnika dovolite dostop do kamere.";
    }
    if (napaka && napaka.name === "NotFoundError") {
      return "Na tej napravi kamera ni na voljo.";
    }
    return "Kamere trenutno ni mogoče zagnati.";
  }

  async function pridobiTokKamere() {
    var poskusi = [
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      { video: true, audio: false },
    ];
    var zadnjaNapaka = null;
    for (var i = 0; i < poskusi.length; i += 1) {
      try {
        return await brskalnik.mediaDevices.getUserMedia(poskusi[i]);
      } catch (napaka) {
        zadnjaNapaka = napaka;
        if (napaka && (napaka.name === "NotAllowedError" || napaka.name === "SecurityError")) throw napaka;
        if (i === 0) await new Promise(function (resolve) { setTimeout(resolve, 180); });
      }
    }
    throw zadnjaNapaka || new Error("camera_unavailable");
  }

  async function zacniPredogled() {
    zagotoviKamero();
    ustaviTok();
    ponastaviPrikaz();

    // iPhone Safari mora te lastnosti dobiti pred priklopom MediaStreama,
    // sicer lahko video preklopi v svoj celozaslonski predvajalnik.
    elementi.video.muted = true;
    elementi.video.setAttribute("playsinline", "");
    elementi.video.setAttribute("webkit-playsinline", "");

    if (!brskalnik.mediaDevices || typeof brskalnik.mediaDevices.getUserMedia !== "function") {
      var niVarnegaDostopa = new Error("camera_unavailable");
      niVarnegaDostopa.name = window.isSecureContext === false ? "SecurityError" : "NotSupportedError";
      prikaziNapako(niVarnegaDostopa);
      return;
    }

    try {
      tokKamere = await pridobiTokKamere();
      elementi.video.srcObject = tokKamere;
      var predvajanje = elementi.video.play();
      if (predvajanje && typeof predvajanje.catch === "function") predvajanje.catch(function () {});
      if (!elementi.video.videoWidth) {
        await new Promise(function (resolve) {
          var koncano = false;
          var dokonca = function () {
            if (koncano) return;
            koncano = true;
            elementi.video.removeEventListener("loadedmetadata", dokonca);
            resolve();
          };
          elementi.video.addEventListener("loadedmetadata", dokonca, { once: true });
          setTimeout(dokonca, 1400);
        });
      }
      elementi.nalaganje.hidden = true;
      elementi.sprozi.disabled = false;
    } catch (napaka) {
      prikaziNapako(napaka);
    }
  }

  function prikaziNapako(napaka) {
    ustaviTok();
    elementi.nalaganje.hidden = true;
    elementi.video.hidden = true;
    elementi.namig.hidden = true;
    elementi.sprozi.disabled = true;
    var jeDostopBlokiran = !brskalnik.mediaDevices ||
      typeof brskalnik.mediaDevices.getUserMedia !== "function" ||
      (napaka && (napaka.name === "NotAllowedError" || napaka.name === "SecurityError" || napaka.name === "NotSupportedError"));
    elementi.napaka.querySelector("strong").textContent = jeDostopBlokiran
      ? "Dovolite kamero v brskalniku"
      : "Kamere ni bilo mogoče zagnati";
    elementi.napaka.querySelector("p").textContent = jeDostopBlokiran
      ? "Za živo sliko v tej kartici dovolite dostop do kamere."
      : opisNapake(napaka);
    elementi.poskusi.textContent = "Poskusi znova";
    if (jeDostopBlokiran) stanjeDovoljenjaKamere = "denied";
    elementi.napaka.hidden = false;
  }

  function zajemiSliko() {
    if (!tokKamere || !elementi.video.videoWidth || !elementi.video.videoHeight) return;
    var platno = elementi.platno;
    platno.width = elementi.video.videoWidth;
    platno.height = elementi.video.videoHeight;
    var risar = platno.getContext("2d");
    risar.drawImage(elementi.video, 0, 0, platno.width, platno.height);
    platno.toBlob(function (blob) {
      if (!blob) return;
      var ime = "dokument-" + new Date().toISOString().replace(/[:.]/g, "-") + ".jpg";
      zajetaDatoteka = new File([blob], ime, { type: "image/jpeg", lastModified: Date.now() });
      prikaziZajetoSliko(zajetaDatoteka);
    }, "image/jpeg", 0.92);
  }

  function prikaziZajetoSliko(datoteka) {
    ustaviTok();
    pocistiPredogledUrl();
    predogledUrl = URL.createObjectURL(datoteka);
    elementi.slika.src = predogledUrl;
    elementi.slika.hidden = false;
    elementi.video.hidden = true;
    elementi.nalaganje.hidden = true;
    elementi.napaka.hidden = true;
    elementi.namig.hidden = false;
    elementi.namig.textContent = "Preverite, ali je celoten dokument oster in berljiv";
    elementi.akcije.hidden = true;
    elementi.pregledAkcije.hidden = false;
    elementi.uporabi.focus();
  }

  function dodeliDatoteko(vnos, datoteka) {
    var prenos = new DataTransfer();
    prenos.items.add(datoteka);
    vnos.files = prenos.files;
    vnos.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function uporabiSliko() {
    if (!ciljniVnos || !zajetaDatoteka) return;
    var vnos = ciljniVnos;
    var datoteka = zajetaDatoteka;
    zapriKamero(false);
    try {
      dodeliDatoteko(vnos, datoteka);
    } catch (_napaka) {
      vnos.removeAttribute("capture");
      vnos.click();
      vnos.setAttribute("capture", "environment");
    }
  }

  function odpriKamero(vnos) {
    if (!vnos || vnos.disabled) return;
    ciljniVnos = vnos;
    zadnjiFokus = document.activeElement;
    zagotoviKamero();
    elementi.ovoj.hidden = false;
    document.documentElement.classList.add("uj-kamera-odprta");
    elementi.zapri.focus();
    void zacniPredogled();
  }

  function zapriKamero(vrniFokus) {
    if (!elementi || elementi.ovoj.hidden) return;
    ustaviTok();
    pocistiPredogledUrl();
    elementi.ovoj.hidden = true;
    document.documentElement.classList.remove("uj-kamera-odprta");
    ciljniVnos = null;
    zajetaDatoteka = null;
    if (vrniFokus !== false && zadnjiFokus && typeof zadnjiFokus.focus === "function") zadnjiFokus.focus();
    zadnjiFokus = null;
  }

  document.addEventListener("click", function (dogodek) {
    var tarca = dogodek.target;
    var vnos = tarca && tarca.closest ? tarca.closest('input[type="file"][capture]') : null;
    if (!vnos) return;
    dogodek.preventDefault();
    dogodek.stopImmediatePropagation();
    odpriKamero(vnos);
  }, true);

  document.addEventListener("keydown", function (dogodek) {
    if (dogodek.key === "Escape" && elementi && !elementi.ovoj.hidden) zapriKamero();
  });

  window.addEventListener("pagehide", ustaviTok);
  window.UJKameraVAplikaciji = { odpri: odpriKamero, zapri: zapriKamero };
})();
