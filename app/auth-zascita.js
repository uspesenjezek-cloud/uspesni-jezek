/* ==========================================================
   auth-zascita.js - varuje app strani pred neprijavljenimi obiskovalci.

   Vključi to skripto na VSAKO app stran RAZEN prijava.html (na
   prijava.html bi povzročila neskončno preusmerjanje, ker takrat
   uporabnik še nima seje).

   Če uporabnik ni prijavljen, ga takoj preusmeri na prijava.html.
   ========================================================== */

/* Namizni predogled iPhone/PWA varnega območja je skupen vsem
   zaščitenim kategorijam. Izbira ostane aktivna med prehodi po aplikaciji. */
(function nastaviIphonePredogled() {
  const jeSamostojnaAplikacija =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (jeSamostojnaAplikacija) {
    document.documentElement.classList.add("app-standalone");
  }
  const previewParam = new URLSearchParams(window.location.search).get("app-preview");
  const jeLokalniTelefon =
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
    window.matchMedia("(max-width: 620px)").matches;

  if (previewParam === "0") {
    sessionStorage.removeItem("app-iphone-preview");
  } else if (previewParam === "1" || jeLokalniTelefon) {
    // Lokalni Device Mode mora ohraniti iPhonove proporcije tudi po resetu
    // brskalnika, ki izbriše sessionStorage. Produkcije to ne spremeni.
    sessionStorage.setItem("app-iphone-preview", "1");
  }
  if (sessionStorage.getItem("app-iphone-preview") === "1") {
    document.documentElement.classList.add("app-iphone-preview");
  }
})();

/* V namiznem iPhone predogledu miška posnema prst: uporabnik lahko prime
   neinteraktivni del zaslona in z navpičnim potegom premakne najbližji
   drsni vsebnik. Pravi telefoni ohranijo svoje naravno touch drsenje. */
(function omogociNamiznoTouchDrsenje() {
  if (!document.documentElement.classList.contains("app-iphone-preview")) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  const interaktivniElementi =
    "a, button, input, textarea, select, option, label, [contenteditable], [role='button'], [role='slider'], [data-no-preview-drag]";
  let poteza = null;

  function poisciDrsniVsebnik(element) {
    let kandidat = element instanceof Element ? element : null;
    while (kandidat && kandidat !== document.body) {
      const slog = window.getComputedStyle(kandidat);
      if (
        kandidat.scrollHeight > kandidat.clientHeight + 1 &&
        /^(auto|scroll|overlay)$/.test(slog.overflowY)
      ) {
        return kandidat;
      }
      kandidat = kandidat.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function koncajPotezo(dogodek) {
    if (!poteza || (dogodek && dogodek.pointerId !== poteza.pointerId)) return;
    poteza = null;
    document.documentElement.classList.remove("app-preview-touch-dragging");
  }

  document.addEventListener("pointerdown", function (dogodek) {
    if (dogodek.pointerType !== "mouse" || dogodek.button !== 0) return;
    if (!(dogodek.target instanceof Element) || dogodek.target.closest(interaktivniElementi)) return;
    poteza = {
      pointerId: dogodek.pointerId,
      startX: dogodek.clientX,
      startY: dogodek.clientY,
      lastY: dogodek.clientY,
      scroller: poisciDrsniVsebnik(dogodek.target),
      dragging: false
    };
  }, { passive: true });

  document.addEventListener("pointermove", function (dogodek) {
    if (!poteza || dogodek.pointerId !== poteza.pointerId) return;
    const dx = dogodek.clientX - poteza.startX;
    const dy = dogodek.clientY - poteza.startY;
    if (!poteza.dragging) {
      if (Math.hypot(dx, dy) < 7) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        koncajPotezo(dogodek);
        return;
      }
      poteza.dragging = true;
      document.documentElement.classList.add("app-preview-touch-dragging");
    }
    const premik = dogodek.clientY - poteza.lastY;
    poteza.lastY = dogodek.clientY;
    poteza.scroller.scrollTop -= premik;
    dogodek.preventDefault();
  }, { passive: false });

  document.addEventListener("pointerup", koncajPotezo, { passive: true });
  document.addEventListener("pointercancel", koncajPotezo, { passive: true });
  window.addEventListener("blur", function () { koncajPotezo(); });
})();

(async function preveriPrijavo() {
  const jeLoopback = ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname
  );
  const jeLokalniPredogled =
    jeLoopback &&
    new URLSearchParams(window.location.search).get("app-preview") === "1";
  // Lokalni predogled uporablja strogo omejen strežniški žeton, ki velja
  // samo na loopback naslovu. Zato tukaj ne sme biti odvisen od oddaljenega
  // Supabase prijavnega strežnika ali se ob njegovi nedosegljivosti preusmeriti.
  if (
    jeLokalniPredogled ||
    (jeLoopback && globalThis.UJ_LOKALNI_PREDOGLED_BREZ_SUPABASE === true)
  ) return;
  const { data } = await supabaseKlient.auth.getSession();
  if (!data.session) {
    window.location.href = "prijava.html";
  }
})();

/* Skupni prikaz simuliranega obvestila na vseh zaščitenih straneh. */
(function naloziGlobalnoSimulacijo() {
  if (document.querySelector('script[data-zacasno-global]')) return;
  const script = document.createElement("script");
  script.src = "zacasno-global.js?v=20260817-global-v2";
  script.defer = true;
  script.setAttribute("data-zacasno-global", "1");
  document.head.appendChild(script);
})();

/* Vsi gumbi za slikanje uporabljajo enoten predogled kamere znotraj
   aplikacije. Obstoječi file inputi in njihovi change handlerji ostanejo
   vir resnice za nadaljnji OCR, priloge in shranjevanje. */
(function naloziKameroVAplikaciji() {
  if (!document.querySelector('link[data-uj-kamera-slog]')) {
    const slog = document.createElement("link");
    slog.rel = "stylesheet";
    slog.href = "in-app-camera.css?v=20260821-inline-static-v5";
    slog.setAttribute("data-uj-kamera-slog", "1");
    document.head.appendChild(slog);
  }
  if (document.querySelector('script[data-uj-kamera]')) return;
  const script = document.createElement("script");
  script.src = "in-app-camera.js?v=20260821-iphone-inline-v11";
  script.defer = true;
  script.setAttribute("data-uj-kamera", "1");
  document.head.appendChild(script);
})();

/* Globalna produkcijska obvestila v aplikaciji (ne OS push) so bila
   odstranjena na zahtevo - krog z zvončkom se ne prikazuje več. */
