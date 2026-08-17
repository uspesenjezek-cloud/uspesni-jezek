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
  const previewParam = new URLSearchParams(window.location.search).get("app-preview");
  if (previewParam === "1") sessionStorage.setItem("app-iphone-preview", "1");
  if (previewParam === "0") sessionStorage.removeItem("app-iphone-preview");
  if (sessionStorage.getItem("app-iphone-preview") === "1") {
    document.documentElement.classList.add("app-iphone-preview");
  }
})();

(async function preveriPrijavo() {
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

/* Globalna produkcijska obvestila v aplikaciji (ne OS push) so bila
   odstranjena na zahtevo - krog z zvončkom se ne prikazuje več. */
