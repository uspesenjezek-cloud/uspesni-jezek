/* ========== Načrt opominjanja (korak 3) – UI ==========
   Vsebina gre v #opomin-nacrt-glavni (brez drugega čarovnika/glave).
   window.UJOpominNacrtUI
   ============================================ */
(function (root) {
  "use strict";

  var IKONA_KLJUKICA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  var IKONA_KLJUCAVNICA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

  var IKONA_KOLEDAR =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';

  var IKONA_URA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';

  var IKONA_RANDOM =
    '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.5a5 5 0 0 0 4-2L14 8a5 5 0 0 1 4-2h8"/><path d="M2 6h1.5a5 5 0 0 1 4 2l1.4 1.7"/><path d="M14.5 15.5 16 17a5 5 0 0 0 3.5 1H22"/></svg>';

  var IKONA_UREDI =
    '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';

  var IKONA_KOLEDAR_MAJHNA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';

  var IKONA_POSILJANJE =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>';

  var IKONA_INFO =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

  var IKONA_TON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>';

  var IKONA_PREDLOGA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>';

  var IKONA_ROK =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';

  var IKONA_OBROCNO =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>';

  var IKONA_TRR =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>';

  var IKONA_DENARNICA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>';

  var IKONA_NASMEH =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>';

  var IKONA_DOKUMENT =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';

  var IKONA_SPONKA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>';

  var IKONA_KAMERA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';

  var IKONA_UVOZI =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>';

  var IKONA_SLIKA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';

  var IKONA_SMS =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/></svg>';

  var IKONA_EMAIL =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 7L2 7"/></svg>';

  var IKONA_AKTOVKA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>';

  var IKONA_DOLZNIK =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';

  var IKONA_TEHTNICA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="3"/><path d="M6.5 8a9.5 9.5 0 0 0 11 0"/><path d="M3 21h18"/><path d="M12 11v10"/></svg>';

  var IKONA_KLJUKICA_KROG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#3f9998" stroke="#3f9998"/><path d="M17 10l-7 7-3-3" stroke="#ffffff"/></svg>';

  var IKONA_DOKUMENT =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

  var IKONA_NALAGANJE_ORANZNA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d8ab5c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-dasharray="4 3"/><path d="M12 8v8"/><path d="M8 12l4 4 4-4"/></svg>';

  var IKONA_SVINCNIK =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';

  var IKONA_NAMEN_PREGLED =
    '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';

  var IKONA_NAMEN_EURO =
    '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18v-2"/><path d="M12 6V4"/></svg>';

  var IKONA_NAMEN_SODISCE =
    '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>';

  var IKONA_SCIT_KLJUKICA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>';

  var IKONA_ZASTAVICA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 8 2a6 6 0 0 0 3.6-1.2A1 1 0 0 1 21 3.7V15a1 1 0 0 1-.4.8A6 6 0 0 1 17 17c-3 0-5-2-8-2a6 6 0 0 0-3.6 1.2"/></svg>';

  var IKONA_MAPA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';

  var IKONA_CHEVRON_DESNO =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

  var IKONA_CHEVRON_DOL =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  /* ========== Ikone za sestavljalnik "Predaja odvetniku" (10. korak) ========== */
  var IKONA_PREDAJA_DOKUMENT =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';

  var IKONA_PREDAJA_DOKUMENT_OKO =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5.5"/><polyline points="14 2 14 8 20 8"/><path d="M15 18.5c1.4-1.9 3.1-1.9 4.5 0"/><circle cx="17.25" cy="18.5" r="1.1"/></svg>';

  var IKONA_PREDAJA_SPOROCILO =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-4.6 7.5 8.5 8.5 0 0 1-8.9-.7L3 21l1.9-4.5a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.3z"/><circle cx="8.5" cy="11.5" r="0.6" fill="currentColor" stroke="none"/><circle cx="12" cy="11.5" r="0.6" fill="currentColor" stroke="none"/><circle cx="15.5" cy="11.5" r="0.6" fill="currentColor" stroke="none"/></svg>';

  var IKONA_PREDAJA_KLJUKICA_KROG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M17 9l-6.2 6.2L7 11.4" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

  var IKONA_PREDAJA_PLUS_KROG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Barvna stopnja avtomatskega koraka na lestvici 1–9. Stopnje se vedno
      razporedijo čez celoten razpon glede na trenutno število vključenih
      avtomatskih korakov, zato brisanje kartice ne pusti barvnih vrzeli. */
  function dolociBarvniNivo(pozicija, steviloKorakov) {
    var skupaj = Math.max(1, Number(steviloKorakov) || 1);
    var mesto = Math.max(0, Math.min(skupaj - 1, Number(pozicija) || 0));
    if (skupaj === 1) return 1;
    return Math.round((mesto * 8) / (skupaj - 1)) + 1;
  }

  /** Samostojni fokusni trap (Tab/Shift+Tab kroži znotraj panela). Vrne
      { priklopi, pospravi, panel }. priklopi() odstrani morebitni prejšnji
      trap in priklopi novega, zato ga je mogoče varno klicati ob vsakem
      odprtju brez podvajanja listenerjev. env je opcijski za testiranje. */
  function ustvariFokusniTrap(panel, env) {
    var doc = (env && env.document) || (typeof document !== "undefined" ? document : null);
    var MO = (env && env.MutationObserver) || (typeof MutationObserver !== "undefined" ? MutationObserver : null);
    var cleanup = null;

    function priklopi() {
      if (cleanup) { cleanup(); cleanup = null; }
      if (!panel) return null;
      if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");

      function elementi() {
        return Array.prototype.slice
          .call(
            panel.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          )
          .filter(function (el) {
            return !el.disabled && el.offsetParent !== null;
          });
      }
      function ujem(e) {
        if (e.key !== "Tab") return;
        var f = elementi();
        if (!f.length) return;
        var prvi = f[0];
        var zadnji = f[f.length - 1];
        var aktiven = doc && doc.activeElement;
        var jeZnotraj = aktiven === panel || f.indexOf(aktiven) >= 0;
        if (e.shiftKey && (aktiven === prvi || aktiven === panel || !jeZnotraj)) {
          e.preventDefault();
          zadnji.focus();
        } else if (!e.shiftKey && (aktiven === zadnji || aktiven === panel || !jeZnotraj)) {
          e.preventDefault();
          prvi.focus();
        }
      }
      panel.addEventListener("keydown", ujem);

      var ovojEl = panel.parentElement;
      var pospravljeno = false;
      function pospravi() {
        if (pospravljeno) return;
        pospravljeno = true;
        panel.removeEventListener("keydown", ujem);
        if (opazovalec) opazovalec.disconnect();
        if (cleanup === pospravi) cleanup = null;
      }
      var opazovalec = MO && ovojEl
        ? new MO(function () {
            if (ovojEl && (ovojEl.hidden || ovojEl.classList.contains("lp-popup-ovoj--zaprt"))) {
              pospravi();
            }
          })
        : null;
      if (opazovalec) opazovalec.observe(ovojEl, { attributes: true, attributeFilter: ["hidden", "class"] });

      cleanup = pospravi;
      return pospravi;
    }

    function pospraviTrenutno() {
      if (cleanup) { cleanup(); cleanup = null; }
    }

    return { priklopi: priklopi, pospravi: pospraviTrenutno, panel: panel };
  }

  function statusZnacka(status, kind) {
    if (kind === "manual_lawyer" && status === "draft") return "Za pregled";
    if (status === "confirmed") return "Potrjeno";
    if (status === "needs_review") return "Ponovno preverite";
    return "Za pregled";
  }

  function formatirajZnesek(cents) {
    var euros = (Number(cents) || 0) / 100;
    return (
      euros.toLocaleString("sl-SI", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " €"
    );
  }

  function formatCasKratko(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    var ura = String(d.getHours()).padStart(2, "0");
    var min = String(d.getMinutes()).padStart(2, "0");
    return ura + ":" + min;
  }

  function formatDatumSl(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return (
      d.getDate() +
      ". " +
      (d.getMonth() + 1) +
      ". " +
      d.getFullYear()
    );
  }

  function formatDanSl(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return [
      "Nedelja",
      "Ponedeljek",
      "Torek",
      "Sreda",
      "\u010cetrtek",
      "Petek",
      "Sobota",
    ][d.getDay()];
  }

  function formatCasPolno(iso) {
    if (!iso) return "—";
    return formatDatumSl(iso) + " ob " + formatCasKratko(iso);
  }

  function isoZaDateInput(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) d = new Date();
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate())
    );
  }

  function isoZaTimeInput(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) d = new Date();
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function isoIzDateInTime(dateStr, timeStr) {
    var deli = String(dateStr || "").split("-").map(Number);
    var ure = String(timeStr || "12:00").split(":").map(Number);
    if (deli.length < 3) return null;
    var d = new Date(
      deli[0],
      deli[1] - 1,
      deli[2],
      ure[0] || 0,
      ure[1] || 0,
      0,
      0
    );
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  /* Nekateri stari osnutki nimajo shranjenega mimeType (attachmentMeta) za
     priloge, zato slike zaznamo tudi po končnici datoteke kot varovalko. */
  function jeSlikaPriloga(p) {
    var ime = (p && p.originalFileName) || "";
    var mime = (p && p.mimeType) || "";
    if (mime.indexOf("pdf") >= 0) return false;
    if (mime.indexOf("image/") === 0) return true;
    return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(ime);
  }

  var KLJUC_CAS_BLIZNJICE = "uj-cas-bliznjice";

  function preberiCasBliznjice() {
    try {
      var raw = window.localStorage.getItem(KLJUC_CAS_BLIZNJICE);
      var seznam = raw ? JSON.parse(raw) : [];
      return Array.isArray(seznam) ? seznam : [];
    } catch (_e) {
      return [];
    }
  }

  function shraniCasBliznjice(seznam) {
    try {
      window.localStorage.setItem(
        KLJUC_CAS_BLIZNJICE,
        JSON.stringify(seznam || [])
      );
    } catch (_e) {
      /* prezri (npr. zaseben način brskanja) */
    }
  }

  var CASOVNE_ENOTE_V_DNEH = { dan: 1, teden: 7, mesec: 30 };

  function pretvoriDneveVEnoto(dnevi, enota) {
    var faktor = CASOVNE_ENOTE_V_DNEH[enota] || 1;
    return Math.round((Number(dnevi) || 0) / faktor);
  }

  function pretvoriEnotoVDneve(vrednostVEnoti, enota) {
    var faktor = CASOVNE_ENOTE_V_DNEH[enota] || 1;
    return Math.max(0, Math.round((Number(vrednostVEnoti) || 0) * faktor));
  }

  function dneviOdDanes(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) d = new Date();
    var baza = new Date();
    baza.setHours(12, 0, 0, 0);
    var t = new Date(d);
    t.setHours(12, 0, 0, 0);
    return Math.max(0, Math.round((t.getTime() - baza.getTime()) / 86400000));
  }

  function isoIzDniOdDanes(dnevi, ohraniUroIso) {
    var baza = new Date();
    var ura = 12;
    var min = 0;
    if (ohraniUroIso) {
      var stari = new Date(ohraniUroIso);
      if (!Number.isNaN(stari.getTime())) {
        ura = stari.getHours();
        min = stari.getMinutes();
      }
    }
    baza.setHours(ura, min, 0, 0);
    baza.setDate(baza.getDate() + Math.max(0, Number(dnevi) || 0));
    return baza.toISOString();
  }

  function isoIzDniOdOsnove(dnevi, osnovniIso, ohraniUroIso) {
    var baza = osnovniIso ? new Date(osnovniIso) : new Date();
    if (Number.isNaN(baza.getTime())) baza = new Date();
    var ura = 12;
    var min = 0;
    if (ohraniUroIso) {
      var stari = new Date(ohraniUroIso);
      if (!Number.isNaN(stari.getTime())) {
        ura = stari.getHours();
        min = stari.getMinutes();
      }
    }
    baza.setHours(ura, min, 0, 0);
    baza.setDate(baza.getDate() + Math.max(0, Number(dnevi) || 0));
    return baza.toISOString();
  }

  function isoIzPredizboraBliznjice(b) {
    var d = new Date();
    var ure = String((b && b.ura) || "12:00")
      .split(":")
      .map(Number);
    d.setHours(ure[0] || 0, ure[1] || 0, 0, 0);
    d.setDate(d.getDate() + Math.max(0, Number(b && b.dnevi) || 0));
    return d.toISOString();
  }

  function isoZaDatetimeLocal(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) d = new Date();
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  }

  function offsetOdZacetka(plan, step) {
    if (!plan || !step) return Number(step && step.scheduledOffsetDays) || 0;
    var N = root.UJOpominNacrt;
    var first = plan.steps && plan.steps[0];
    if (!first) return Number(step.scheduledOffsetDays) || 0;
    if (N && typeof N.koledarskiDneviMed === "function") {
      var off = N.koledarskiDneviMed(
        first.sendAt || first.scheduledAt,
        step.sendAt || step.scheduledAt
      );
      if (off != null) return off;
    }
    return Number(step.scheduledOffsetDays) || 0;
  }

  function razmikOdPrejsnjega(plan, step) {
    var N = root.UJOpominNacrt;
    /* Poišči prejšnji neizključen korak (ne nujno index - 1). */
    var koraki = (plan && plan.steps) || [];
    var idx = koraki.indexOf(step);
    var prejsnji = null;
    for (var i = idx - 1; i >= 0; i--) {
      if (!koraki[i].isExcluded) { prejsnji = koraki[i]; break; }
    }
    if (!prejsnji) return 0;
    if (N && typeof N.koledarskiDneviMed === "function") {
      return (
        N.koledarskiDneviMed(
          prejsnji.sendAt || prejsnji.scheduledAt,
          step.sendAt || step.scheduledAt
        ) || 0
      );
    }
    return (
      (Number(step.scheduledOffsetDays) || 0) -
      (Number(prejsnji.scheduledOffsetDays) || 0)
    );
  }

  function formatDatumKratekDDMM(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return (
      String(d.getDate()).padStart(2, "0") +
      "." +
      String(d.getMonth() + 1).padStart(2, "0") +
      "."
    );
  }

  function formatDatumKratekDDMMYY(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return (
      String(d.getDate()).padStart(2, "0") +
      "." +
      String(d.getMonth() + 1).padStart(2, "0") +
      "." +
      String(d.getFullYear()).slice(-2)
    );
  }

  function dolocenRandomCas(step) {
    if (!step || !step._randomSchedule || !step._randomSchedule.enabled) return null;
    return step._randomSchedule.resolvedScheduledAt || null;
  }

  function randomJeVklopljen(step) {
    return Boolean(step && step._randomSchedule && step._randomSchedule.enabled);
  }

  function prikazniRandomCas(step) {
    if (!randomJeVklopljen(step)) return null;
    return (
      step._randomSchedule.resolvedScheduledAt ||
      step._randomSchedule._previewResolvedAt ||
      null
    );
  }

  function besediloZModroRandomUro(besedilo, iso) {
    var tekst = String(besedilo || "");
    var ura = formatCasKratko(iso);
    var pozicija = ura && ura !== "—" ? tekst.lastIndexOf(ura) : -1;
    if (pozicija < 0) return esc(tekst);
    return (
      esc(tekst.slice(0, pozicija)) +
      '<span class="opomin-nacrt__random-ura">' +
      esc(ura) +
      "</span>" +
      esc(tekst.slice(pozicija + ura.length))
    );
  }

  function najdiPrejsnjiAktivniKorak(plan, index) {
    var koraki = (plan && plan.steps) || [];
    var pozicija = koraki.findIndex(function (korak) {
      return Number(korak.index) === Number(index);
    });
    for (var i = pozicija - 1; i >= 0; i--) {
      if (!koraki[i].isExcluded) return koraki[i];
    }
    return null;
  }

  function prikazniCasKoraka(step) {
    return prikazniRandomCas(step) || (step && (step.sendAt || step.scheduledAt)) || null;
  }

  function dovoljenoOknoPlana(plan) {
    var N = root.UJOpominNacrt;
    return N && typeof N.normalizirajDovoljenoOkno === "function"
      ? N.normalizirajDovoljenoOkno(plan && plan.allowedSendWindow)
      : (plan && plan.allowedSendWindow) || { start: "07:00", end: "21:00" };
  }

  function dovoljenoOknoKoraka(plan, stepOrIndex) {
    var N = root.UJOpominNacrt;
    return N && typeof N.dovoljenoOknoZaKorak === "function"
      ? N.dovoljenoOknoZaKorak(plan, stepOrIndex)
      : dovoljenoOknoPlana(plan);
  }

  function minuteIzUreUI(value) {
    var deli = String(value || "").split(":");
    var ura = Number(deli[0]);
    var minuta = Number(deli[1]);
    if (
      deli.length !== 2 ||
      !Number.isFinite(ura) ||
      !Number.isFinite(minuta) ||
      ura < 0 ||
      ura > 23 ||
      minuta < 0 ||
      minuta > 59
    ) {
      return NaN;
    }
    return ura * 60 + minuta;
  }

  function jeUraZnotrajDovoljenegaOkna(value, okno) {
    var minute = minuteIzUreUI(value);
    var minMinute = minuteIzUreUI(okno && okno.start);
    var maxMinute = minuteIzUreUI(okno && okno.end);
    if (
      !Number.isFinite(minute) ||
      !Number.isFinite(minMinute) ||
      !Number.isFinite(maxMinute)
    ) {
      return false;
    }
    return minute >= minMinute && minute <= maxMinute;
  }

  function besediloNedovoljeneUre(value, okno) {
    return (
      "Časa " +
      value +
      " ni mogoče izbrati. Dovoljeno je od " +
      okno.start +
      " do " +
      okno.end +
      "."
    );
  }

  function zavrniNedovoljenoPoljeUre(input, okno, opozori) {
    if (!input || !input.value) return true;
    var poskus = input.value;
    if (input.dataset.ujZavrnjenaUra === "true") {
      delete input.dataset.ujZavrnjenaUra;
      if (poskus === input.dataset.ujZadnjaDovoljenaUra) {
        input.removeAttribute("aria-invalid");
        return false;
      }
    }
    if (jeUraZnotrajDovoljenegaOkna(poskus, okno)) {
      input.dataset.ujZadnjaDovoljenaUra = poskus;
      input.removeAttribute("aria-invalid");
      return true;
    }
    input.value = input.dataset.ujZadnjaDovoljenaUra || "";
    input.dataset.ujZavrnjenaUra = "true";
    input.setAttribute("aria-invalid", "true");
    if (typeof opozori === "function") {
      opozori(besediloNedovoljeneUre(poskus, okno));
    }
    return false;
  }

  function jeCasKorakaIzvenDovoljenega(plan, step) {
    if (
      !step ||
      step.isExcluded ||
      step.kind === "manual_lawyer" ||
      step.deliveryMode === "manual" ||
      step.status === "sent"
    ) {
      return false;
    }
    var iso = prikazniCasKoraka(step);
    var N = root.UJOpominNacrt;
    if (!iso) return true;
    if (N && typeof N.jeUraVDovoljenemOkvirju === "function") {
      return !N.jeUraVDovoljenemOkvirju(plan, iso, step);
    }
    var datum = new Date(iso);
    if (Number.isNaN(datum.getTime())) return true;
    var okno = dovoljenoOknoKoraka(plan, step);
    var minute = datum.getHours() * 60 + datum.getMinutes();
    return (
      minute < minuteIzUreUI(okno.start) ||
      minute > minuteIzUreUI(okno.end)
    );
  }

  function htmlOpozoriloUreKartice(plan, step) {
    return '<span class="opomin-nacrt__stage-hard-opozorilo" aria-hidden="true">◷</span>';
  }

  function prviKorakZNeveljavnoUro(plan) {
    return ((plan && plan.steps) || []).find(function (step) {
      return jeCasKorakaIzvenDovoljenega(plan, step);
    }) || null;
  }

  function oznakaCarouselCas(step, plan) {
    if (step.deliveryMode === "manual" || step.kind === "manual_lawyer") {
      return IKONA_KLJUCAVNICA + " Ročno";
    }
    var randomIso = prikazniRandomCas(step);
    var iso = randomIso || step.sendAt || step.scheduledAt;
    var off = offsetOdZacetka(plan, step);
    var razmik = razmikOdPrejsnjega(plan, step);
    var vrh;
    if (off === 0) {
      vrh = "Danes";
    } else if (razmik === 0) {
      vrh = "Isti dan";
    } else {
      vrh = "+" + Math.max(0, razmik) + " dni";
    }
    var datum = iso ? new Date(iso) : null;
    var dnevi = ["Ned", "Pon", "Tor", "Sre", "Čet", "Pet", "Sob"];
    var danKratek = datum && !Number.isNaN(datum.getTime()) ? dnevi[datum.getDay()] : "";
    return (
      '<span class="opomin-nacrt__stage-cas-vrh">' +
      esc(vrh) +
      "</span>" +
      '<span class="opomin-nacrt__stage-cas-crta" aria-hidden="true"></span>' +
      '<span class="opomin-nacrt__stage-cas-dno">' +
      esc(formatCasKratko(iso)) +
      "</span>" +
      '<span class="opomin-nacrt__stage-cas-dan-datum">' +
      "<span>" + esc(danKratek) + "</span>" +
      "<span>" + esc(formatDatumKratekDDMMYY(iso)) + "</span>" +
      "</span>"
    );
  }

  function besediloPosiljanja(step) {
    if (step.deliveryMode === "manual" || step.kind === "manual_lawyer") {
      return "Ročni korak – samo opozorilo";
    }
    var iso = step.sendAt || step.scheduledAt;
    var off = Number(step.scheduledOffsetDays) || 0;
    /* »Danes« samo če je isti koledarski dan kot danes */
    var d = iso ? new Date(iso) : null;
    var danes = new Date();
    if (
      d &&
      !Number.isNaN(d.getTime()) &&
      d.getFullYear() === danes.getFullYear() &&
      d.getMonth() === danes.getMonth() &&
      d.getDate() === danes.getDate()
    ) {
      return "Pošlji danes ob " + formatCasKratko(iso);
    }
    return "Pošlji " + formatCasPolno(iso);
  }

  function besediloDatumaPosiljanja(step) {
    if (step.deliveryMode === "manual" || step.kind === "manual_lawyer") {
      return "Ročni korak – samo opozorilo";
    }
    var iso = step.sendAt || step.scheduledAt;
    var d = iso ? new Date(iso) : null;
    var danes = new Date();
    if (
      d &&
      !Number.isNaN(d.getTime()) &&
      d.getFullYear() === danes.getFullYear() &&
      d.getMonth() === danes.getMonth() &&
      d.getDate() === danes.getDate()
    ) {
      return "Pošlji danes";
    }
    return "Pošlji " + formatDatumSl(iso);
  }

  /** Besedilo za kartico "Predaja odvetniku" – samo datum (brez ure), z
      razlago razmika od zadnjega opomina ali oznako ročne prilagoditve. */
  function besediloPredajeOdvetniku(plan, step) {
    return "";
  }

  function besediloPoslano(step) {
    var iso = step.sentAt || step.sendAt || step.scheduledAt;
    return "Poslano " + formatCasPolno(iso);
  }

  function gsmLabel(Gsm, besedilo) {
    if (!Gsm) {
      var n = Array.from(String(besedilo || "")).length;
      return n + " znakov";
    }
    var r = Gsm.stevejSms(besedilo);
    var deli =
      r.parts === 1 ? "1 del" : r.parts === 2 ? "2 dela" : r.parts + " delov";
    return r.chars + " znakov · " + deli;
  }

  function formatEurIzCentov(cents) {
    if (cents == null || !Number.isFinite(Number(cents))) return null;
    if (root.UJTonPriporocilo && root.UJTonPriporocilo.formatirajZnesekEur) {
      return root.UJTonPriporocilo.formatirajZnesekEur(cents);
    }
    try {
      return new Intl.NumberFormat("sl-SI", {
        style: "currency",
        currency: "EUR",
      }).format(Number(cents) / 100);
    } catch (_e) {
      return formatirajZnesek(cents);
    }
  }

  function kategorijaDolgaIzCentov(cents) {
    var Ton = root.UJTonPriporocilo;
    if (Ton && typeof Ton.getDebtCategoryFromCents === "function") {
      var id = Ton.getDebtCategoryFromCents(cents);
      if (!id) return null;
      return (Ton.DEBT_CATEGORY_LABELS && Ton.DEBT_CATEGORY_LABELS[id]) || id;
    }
    if (cents == null || !Number.isFinite(Number(cents))) return null;
    var eur = Number(cents) / 100;
    if (eur <= 250) return "Nizek dolg";
    if (eur <= 1000) return "Srednji dolg";
    if (eur <= 5000) return "Visok dolg";
    return "Zelo visok dolg";
  }

  function imePredloge(step, k2) {
    if (step && step.title) {
      if (step.order === 1) return "Prijazen uvod";
      if (step.order === 2) return "Odločen opomin";
      if (step.order === 3) return "Zadnji opomin";
    }
    if (!k2 || !k2.izbranPredlogId) return "Izbrana predloga";
    return "Predloga";
  }

  /**
   * @param {object} opts
   */
  function inicializiraj(opts) {
    var N = root.UJOpominNacrt;
    var Gsm = root.UJGsm7Stevec;
    if (!N || !opts || !opts.glavniEl || !opts.potrditevEl) return null;

    var plan = N.pridobiAliUstvari(opts.podatkiKorak1, opts.podatkiKorak2);
    if (root.UJOpominKarticeSync) {
      plan = root.UJOpominKarticeSync.uporabiNaPlan(plan);
    }
    if (typeof N.zagotoviUrejljivSestiKorak === "function") {
      plan = N.zagotoviUrejljivSestiKorak(
        plan,
        opts.podatkiKorak1,
        opts.podatkiKorak2
      );
      N.shraniOsnutek(plan);
    }
    if (typeof N.uskladiOffseteIzDatumov === "function") {
      plan = N.uskladiOffseteIzDatumov(plan);
    }
    var shranjeniAktivniKorak = (plan.steps || []).find(function (korak) {
      return korak.id === plan.selectedStageId;
    });
    var aktivenIndex = shranjeniAktivniKorak
      ? shranjeniAktivniKorak.index
      : N.prviNepotrjenSmsIndex(plan) || 1;
    var zacetniBlokirajociKorak = N.prviNepotrjenPredZadnjimKorakom
      ? N.prviNepotrjenPredZadnjimKorakom(plan, aktivenIndex)
      : null;
    if (zacetniBlokirajociKorak) {
      aktivenIndex = zacetniBlokirajociKorak.index;
      plan.selectedStageId = zacetniBlokirajociKorak.id;
      N.shraniOsnutek(plan);
    }
    var debounceTimer = null;
    var urejevanIndex = null;
    var urejanjeKarticeIndex = null;
    var urejanjeKartic = false;
    /* Ponovni izris ne sme vrniti vodoravnega seznama na prvo kartico. */
    var carouselScrollLeft = 0;
    /* Kateri od gumbov "Zdaj"/"Predizbor" je trenutno aktiven (obarvan zeleno). */
    var zacetniAktivniKorak = N.najdiKorak(plan, aktivenIndex);
    var izbranCasNacin =
      zacetniAktivniKorak && zacetniAktivniKorak._uraRocnoNastavljena
        ? "rocno"
        : "zdaj";
    var hitraUraTimer = null;
    var hitraUraSamodejnaMinuta = "";
    var kontaktDodajOdprt = { sms: false, email: false };
    var casSheetShiftFollowing = true;
    var casSheetIndex = null;
    var casSheetOknoObseg = "vsi";
    /* "trenutni" = čas tega koraka; "naslednji" = razmik do naslednjega */
    var casSheetNacin = "trenutni";
    var casSheetBaseIndex = null;
    /* Enota prikaza v sheetu "Spremeni čas koraka" (dan/teden/mesec) – dejanska
       shranjena vrednost (#opomin-cas-sheet-dnevi ob klicu sync funkcij) je vedno
       v dneh, pretvorba je samo na meji prikaza/vnosa. */
    var casSheetEnota = "dan";
    /* Ali je uporabnik v tej odprtvi sheeta ročno spremenil polje "Ura" –
       če ne, ob izbiri "danes" (0 dni) privzeto nastavimo trenutno uro. */
    var uraRocnoNastavljena = false;

    function preklopiAktivniKorak(noviIndex) {
      var ciljIndex = Number(noviIndex);
      if (!Number.isFinite(ciljIndex)) return false;
      var blokirajociKorak = N.prviNepotrjenPredZadnjimKorakom
        ? N.prviNepotrjenPredZadnjimKorakom(plan, ciljIndex)
        : null;
      if (blokirajociKorak) return false;

      /* Živa ura je samo začetna pomoč ob prvem vstopu v glavni korak 3.
         Ko uporabnik zapusti prvo kartico, trenutno uro zamrznemo in jo ob
         naslednji vrnitvi prikažemo kot točno določeno uro. */
      if (Number(aktivenIndex) === 1 && ciljIndex !== 1) {
        var prviKorak = N.najdiKorak(plan, 1);
        if (prviKorak) prviKorak._uraRocnoNastavljena = true;
        if (hitraUraTimer) clearInterval(hitraUraTimer);
        hitraUraTimer = null;
      }

      aktivenIndex = ciljIndex;
      var ciljniKorak = N.najdiKorak(plan, aktivenIndex);
      izbranCasNacin =
        ciljniKorak && ciljniKorak._uraRocnoNastavljena
          ? "rocno"
          : "zdaj";
      return true;
    }

    var PV = root.UJPrilogeVsebina;
    var prilogeKoraka =
      PV && PV.izSejeVPriloge
        ? PV.izSejeVPriloge(opts.podatkiKorak1 || {})
        : [];
    var prilogeNapaka = "";
    var undoPriloga = null;
    var undoTimer = null;
    var smsPaketZeton =
      "p" +
      String((plan && plan.id) || Date.now())
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 10);

    function sinhronizirajPrilogeVKorak1() {
      if (!PV || !opts.podatkiKorak1) return;
      var paket = PV.prilogeVSejo(prilogeKoraka);
      Object.assign(opts.podatkiKorak1, paket);
      try {
        sessionStorage.setItem(
          "neplacilo-korak1-podatki",
          JSON.stringify(opts.podatkiKorak1)
        );
      } catch (_e) {
        /* prezri */
      }
      if (typeof opts.onPrilogeSpremenjene === "function") {
        opts.onPrilogeSpremenjene(opts.podatkiKorak1);
      }
    }

    /* Račun je enoten dokument skozi celoten čarovnik. Ko ga uporabnik
       doda v zadnjem koraku, ga zato ne shranimo v vzporedni
       lawyerHandoff.documents, temveč v isti prilogeKoraka vir kot na
       1. koraku. Tako so dodajanje, opis, brisanje in ponovni prikaz v obeh
       korakih vedno sinhronizirani. */
    function dodajNalozenRacunVPrilogeKoraka(file, rez, zahteva, groupId) {
      var id = PV && typeof PV.novId === "function"
        ? PV.novId()
        : "racun-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      var zdaj = new Date().toISOString();
      var priloga = {
        id: id,
        attachmentId: id,
        groupId: groupId || id,
        documentType: "invoice",
        originalFileName: file.name || "Račun",
        mimeType: file.type || "",
        sizeBytes: file.size != null ? file.size : null,
        storagePath: rez && rez.pot ? rez.pot : null,
        status: "ready",
        deliveryChannels: privzetiKanaliNovePriloge(),
        origin: "manual_attachment",
        createdAt: zdaj,
        updatedAt: zdaj,
        progress: 100,
        descriptionQuestion:
          (zahteva && zahteva.question) || "Na kateri posel se nanaša račun?",
        description: "",
        descriptionRequired: Boolean(zahteva && zahteva.required),
      };
      prilogeKoraka.push(priloga);
      sinhronizirajPrilogeVKorak1();
      return priloga;
    }

    function privzetiKanaliNovePriloge() {
      var k1 = opts.podatkiKorak1 || {};
      if (prilogeKoraka.length) {
        return skupniKanaliRacunov(
          Boolean(k1.telefonDolznika),
          Boolean(k1.emailDolznika)
        );
      }
      var k2 = opts.podatkiKorak2 || {};
      var sk = k2.sporociloKanali || k1.privzetiKanali || {};
      return PV.privzetiKanaliZaNovoPrilogo({
        imaTelefon: Boolean(k1.telefonDolznika),
        imaEmail: Boolean(k1.emailDolznika),
        korakSms: sk.sms !== false,
        korakEmail: sk.email !== false,
      });
    }

    /* Delovne kopije dodatkov (isti sheeti kot na 2. koraku). */
    var k2Seja = opts.podatkiKorak2 || {};
    var paymentDeadline = k2Seja.paymentDeadline || null;
    var installmentPlan = k2Seja.installmentPlan || null;
    var dodatki = {
      rok: Boolean(k2Seja.dodatki && k2Seja.dodatki.rok) ||
        Boolean(paymentDeadline && paymentDeadline.enabled),
      obrocno:
        Boolean(k2Seja.dodatki && k2Seja.dodatki.obrocno) ||
        Boolean(installmentPlan && installmentPlan.enabled),
      trr: Boolean(k2Seja.dodatki && k2Seja.dodatki.trr),
    };
    var dodatekBesedila = {
      rok: (k2Seja.dodatekBesedila && k2Seja.dodatekBesedila.rok) || "",
      obrocno: (k2Seja.dodatekBesedila && k2Seja.dodatekBesedila.obrocno) || "",
      trr: (k2Seja.dodatekBesedila && k2Seja.dodatekBesedila.trr) || "",
    };
    var privzetiDneviRoka = { 1: 5, 2: 7, 3: 10, 4: 14, 5: 14, 6: 14, 7: 14, 8: 14, 9: 14 };
    var rokSheetApi = null;
    var obrocnoSheetApi = null;
    var trrSheetApi = null;
    var trrAccount = k2Seja.trrAccount || null;
    var bridgeBesedilo = document.getElementById("opomin-bridge-besedilo");
    var bridgeRok = document.getElementById("opomin-bridge-rok");
    var bridgeObrocno = document.getElementById("opomin-bridge-obrocno");
    var bridgeTrr = document.getElementById("opomin-bridge-trr");

    function syncStageDodatki() {
      var step = N.najdiKorak(plan, aktivenIndex);
      if (!step) return;
      var predDodatki = JSON.stringify({
        paymentDeadline: step.paymentDeadline,
        installment: step.installment,
        bankTransfer: step.bankTransfer,
      });
      step.paymentDeadline = {
        enabled: Boolean(paymentDeadline && paymentDeadline.enabled),
        days:
          paymentDeadline && paymentDeadline.termDays != null
            ? Number(paymentDeadline.termDays)
            : null,
      };
      step.installment = {
        enabled: Boolean(installmentPlan && installmentPlan.enabled),
        planId: installmentPlan && installmentPlan.id ? String(installmentPlan.id) : null,
        count:
          installmentPlan && installmentPlan.installmentCount != null
            ? Number(installmentPlan.installmentCount)
            : null,
      };
      var ibanLast =
        trrAccount && trrAccount.ibanLastFour
          ? String(trrAccount.ibanLastFour)
          : null;
      step.bankTransfer = {
        enabled: Boolean(trrAccount && trrAccount.accountId),
        accountId:
          trrAccount && trrAccount.accountId
            ? String(trrAccount.accountId)
            : null,
        accountLabel:
          trrAccount && trrAccount.accountLabel
            ? String(trrAccount.accountLabel)
            : null,
        ibanLastFour: ibanLast,
      };
      var poDodatki = JSON.stringify({
        paymentDeadline: step.paymentDeadline,
        installment: step.installment,
        bankTransfer: step.bankTransfer,
      });
      /* Status "potrjeno" odstranimo SAMO, če so se dodatki dejansko
         spremenili - ne le zato, ker smo kartico odprli za ogled
         (npr. preklop med koraki v karuselu kliče isto funkcijo). */
      if (step.status === "confirmed" && predDodatki !== poDodatki) {
        step.status = "needs_review";
        step.confirmedAt = null;
        step.snapshotHash = null;
        step.confirmedSnapshotHash = null;
        step.messageNeedsReview = true;
      }
    }

    function syncKorak2Sejo() {
      try {
        var raw = sessionStorage.getItem("neplacilo-korak2-podatki");
        var k2 = raw ? JSON.parse(raw) : Object.assign({}, opts.podatkiKorak2 || {});
        k2.paymentDeadline = paymentDeadline;
        k2.installmentPlan = installmentPlan;
        k2.trrAccount = trrAccount;
        k2.dodatki = {
          rok: Boolean(dodatki.rok),
          obrocno: Boolean(dodatki.obrocno),
          trr: Boolean(dodatki.trr),
        };
        k2.dodatekBesedila = {
          rok: dodatekBesedila.rok || "",
          obrocno: dodatekBesedila.obrocno || "",
          trr: dodatekBesedila.trr || "",
        };
        if (opts.podatkiKorak2 && opts.podatkiKorak2.sporociloKanali) {
          k2.sporociloKanali = opts.podatkiKorak2.sporociloKanali;
        }
        sessionStorage.setItem("neplacilo-korak2-podatki", JSON.stringify(k2));
        opts.podatkiKorak2 = k2;
      } catch (_e) {
        /* ignore */
      }
    }

    function bazaDatumaPosiljanja() {
      var d = new Date();
      var m = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      return d.getFullYear() + "-" + m + "-" + day;
    }

    function znesekCentov() {
      if (root.UJObrocno) {
        var c = root.UJObrocno.eurosToCents(
          opts.podatkiKorak1 && opts.podatkiKorak1.znesek
        );
        return c != null && c > 0 ? c : 0;
      }
      return 0;
    }

    function shraniVse() {
      syncStageDodatki();
      syncKorak2Sejo();
      N.shraniOsnutek(plan);
      if (root.UJOpominKarticeSync) {
        root.UJOpominKarticeSync.narociShranjevanje(plan);
      }
    }

    function shrani() {
      shraniVse();
    }

    function inicializirajSheete() {
      if (
        bridgeRok &&
        typeof root.inicializirajRokPlacilaSheet === "function"
      ) {
        rokSheetApi = root.inicializirajRokPlacilaSheet({
          gumbRok: bridgeRok,
          get besediloPolje() {
            return bridgeBesedilo;
          },
          najvecZnakov: 1000,
          getPaymentDeadline: function () {
            return paymentDeadline;
          },
          setPaymentDeadline: function (v) {
            paymentDeadline = v;
            dodatki.rok = Boolean(v && v.enabled);
            if (v && v.insertedText) dodatekBesedila.rok = String(v.insertedText);
            if (bridgeRok) {
              bridgeRok.setAttribute(
                "aria-pressed",
                dodatki.rok ? "true" : "false"
              );
            }
          },
          getPrivzetiDnevi: function () {
            return privzetiDneviRoka;
          },
          setPrivzetiDnevi: function (v) {
            privzetiDneviRoka = v || privzetiDneviRoka;
          },
          getToneId: function () {
            var s = N.najdiKorak(plan, aktivenIndex);
            return (s && s.toneId) || plan.toneId || "friendly";
          },
          getToneIdZaPriporocila: function () {
            return plan.toneId || "friendly";
          },
          getPriporociloVhod: function () {
            return {
              toneId: plan.toneId || "friendly",
              overdueDays: plan.overdueDays || 0,
              amountCents: plan.amountCents || znesekCentov(),
            };
          },
          getDneviZaTon: function (toneId) {
            return root.UJRokPlacila
              ? root.UJRokPlacila.dneviZaTon(toneId)
              : 14;
          },
          onAfterChange: function () {},
          stevilkaIzbranegaPredloga: function () {
            return 1;
          },
          bazaDatumaPosiljanja: bazaDatumaPosiljanja,
          get dodatki() {
            return dodatki;
          },
          get dodatekBesedila() {
            return dodatekBesedila;
          },
          posodobiStanjeUrejevalnika: function () {},
          shraniOsnutekLokalno: function () {
            shraniVse();
          },
          potrdiVprasanje: opts.potrdiVprasanje,
          pokaziNapako: opts.pokaziNapako,
        });
      }

      if (
        bridgeObrocno &&
        typeof root.inicializirajObrocnoSheet === "function"
      ) {
        obrocnoSheetApi = root.inicializirajObrocnoSheet({
          gumbObrocno: bridgeObrocno,
          gumbRok: bridgeRok,
          get besediloPolje() {
            return bridgeBesedilo;
          },
          najvecZnakov: 1000,
          get dodatki() {
            return dodatki;
          },
          get dodatekBesedila() {
            return dodatekBesedila;
          },
          getInstallmentPlan: function () {
            return installmentPlan;
          },
          setInstallmentPlan: function (v) {
            installmentPlan = v;
            dodatki.obrocno = Boolean(v && v.enabled);
            if (v && v.addonText) dodatekBesedila.obrocno = String(v.addonText);
          },
          getPaymentDeadline: function () {
            return paymentDeadline;
          },
          setPaymentDeadline: function (v) {
            paymentDeadline = v;
            dodatki.rok = Boolean(v && v.enabled);
          },
          getTotalDebtCents: znesekCentov,
          getOriginalDueDate: function () {
            return (
              (opts.podatkiKorak1 && opts.podatkiKorak1.datumZapadlosti) || null
            );
          },
          getToneId: function () {
            var s = N.najdiKorak(plan, aktivenIndex);
            return (s && s.toneId) || plan.toneId || "friendly";
          },
          getToneIdZaPriporocila: function () {
            return plan.toneId || "friendly";
          },
          getPriporociloVhod: function () {
            return {
              toneId: plan.toneId || "friendly",
              overdueDays: plan.overdueDays || 0,
              amountCents: plan.amountCents || znesekCentov(),
            };
          },
          getJezik: function () {
            return "de";
          },
          stevilkaIzbranegaPredloga: function () {
            return 1;
          },
          bazaDatumaPosiljanja: bazaDatumaPosiljanja,
          posodobiStanjeUrejevalnika: function () {},
          shraniOsnutekLokalno: function () {
            shraniVse();
          },
          potrdiVprasanje: opts.potrdiVprasanje,
          pokaziNapako: opts.pokaziNapako,
        });
      }

      if (typeof root.inicializirajTrrSheet === "function") {
        trrSheetApi = root.inicializirajTrrSheet({
          getTrrAccount: function () {
            return trrAccount;
          },
          setTrrAccount: function (v) {
            trrAccount = v;
            dodatki.trr = Boolean(v && v.accountId);
            if (v && v.insertedText) {
              dodatekBesedila.trr = String(v.insertedText);
            } else if (!v) {
              dodatekBesedila.trr = "";
            }
            if (bridgeTrr) {
              bridgeTrr.setAttribute(
                "aria-pressed",
                dodatki.trr ? "true" : "false"
              );
            }
          },
          getPodatkiKorak1: function () {
            return opts.podatkiKorak1 || {};
          },
          get besediloPolje() {
            return bridgeBesedilo;
          },
          najvecZnakov: 1000,
          get dodatki() {
            return dodatki;
          },
          get dodatekBesedila() {
            return dodatekBesedila;
          },
          gumbTrr: bridgeTrr,
          posodobiStanjeUrejevalnika: function () {},
          shraniOsnutekLokalno: function () {
            shraniVse();
          },
          potrdiVprasanje: opts.potrdiVprasanje,
          pokaziNapako: opts.pokaziNapako,
          supabaseKlient:
            typeof supabaseKlient !== "undefined" ? supabaseKlient : null,
        });
      }

      if (bridgeBesedilo) {
        var s1 = N.najdiKorak(plan, 1);
        bridgeBesedilo.value =
          (s1 && (s1.finalMessage || s1.generatedMessage)) ||
          (k2Seja.sporociloDolzniku || "");
      }
      if (bridgeRok) {
        bridgeRok.setAttribute(
          "aria-pressed",
          paymentDeadline && paymentDeadline.enabled ? "true" : "false"
        );
      }
      if (bridgeObrocno) {
        bridgeObrocno.setAttribute(
          "aria-pressed",
          installmentPlan && installmentPlan.enabled ? "true" : "false"
        );
      }
      if (bridgeTrr) {
        bridgeTrr.setAttribute(
          "aria-pressed",
          trrAccount && trrAccount.accountId ? "true" : "false"
        );
      }
    }

    inicializirajSheete();

    function potrjeniCount() {
      return N.steviloPotrjenih ? N.steviloPotrjenih(plan) : 0;
    }

    function uskladiPrikazPriporocila(step) {
      var el = document.getElementById("tone-recommendation-section");
      if (!el) return;
      var skrij = Boolean(step) && (step.kind === "manual_lawyer" || step.deliveryMode === "manual");
      el.dataset.skritoNaPredajiOdvetniku = skrij ? "true" : "false";
      /* Widget ostane na strani le pri samodejnih korakih; razred za vijolično
         predajo je vseeno pripravljen, če bo ročni korak pozneje dobil isti
         priporočilni blok. */
      el.hidden = skrij;
      el.setAttribute("aria-hidden", skrij ? "true" : "false");

      /* Zgornji widget prevzame samo nežen barvni ton aktivne kartice.
         Barve kartic, tona sporočila in gumba »Uporabi priporočeno« ostanejo
         ločene ter se tukaj nikoli ne spreminjajo. */
      var widget = document.getElementById("ton-widget");
      if (!widget || !step) return;
      if (step.kind === "manual_lawyer" || step.deliveryMode === "manual") {
        widget.dataset.korakBarva = "predaja";
        return;
      }
      var samodejniKoraki = (plan.steps || []).filter(function (korak) {
        return (
          !korak.isExcluded &&
          korak.kind !== "manual_lawyer" &&
          korak.deliveryMode !== "manual"
        );
      });
      var pozicija = samodejniKoraki.indexOf(step);
      var nivo = dolociBarvniNivo(pozicija, samodejniKoraki.length);
      widget.dataset.korakBarva = "eskalacija-" + nivo;
    }

    function uporabiPriporoceniRazmikTegaKoraka(aktivniStep) {
      if (!aktivniStep) return;
      if (aktivniStep.kind === "manual_lawyer" || aktivniStep.deliveryMode === "manual") return;
      var vkljuceni = (plan.steps || []).filter(function (s) { return !s.isExcluded; });
      var aktPoz = -1;
      for (var i = 0; i < vkljuceni.length; i++) {
        if (vkljuceni[i].index === aktivniStep.index) { aktPoz = i; break; }
      }
      if (aktPoz < 0) return;

      var bo = plan._baseOffsets || [];
      var trenutniBO = Math.max(
        0,
        (bo[aktivniStep.index - 1] != null ? bo[aktivniStep.index - 1] : 0) || 0
      );

      if (aktPoz === 0) {
        /* Prvi korak nima prejšnjega – priporočilo je glede na "danes". */
        var obstojeciIso = aktivniStep.sendAt || aktivniStep.scheduledAt;
        var iso = isoIzDniOdDanes(trenutniBO, obstojeciIso);
        plan = N.posodobiCasKoraka(plan, aktivniStep.index, iso, {
          shiftFollowing: true,
        });
        izbranCasNacin = "enako";
        shrani();
        izrisiGlavni();
        return;
      }

      var prejsnji = vkljuceni[aktPoz - 1];
      if (!prejsnji) return;
      var prejsnjiBO = Math.max(
        0,
        (bo[prejsnji.index - 1] != null ? bo[prejsnji.index - 1] : 0) || 0
      );
      var razmikDni = Math.max(0, trenutniBO - prejsnjiBO);

      plan = N.posodobiRazmikDoNaslednjega(plan, prejsnji.index, razmikDni, {});
      izbranCasNacin = "enako";
      shrani();
      izrisiGlavni();
    }

    function pokaziGlavni() {
      opts.glavniEl.hidden = false;
      opts.potrditevEl.hidden = true;
      urejevanIndex = null;
      izrisiGlavni();
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }

    function pokaziPotrditev(index) {
      var step = N.najdiKorak(plan, index);
      if (!step) return;
      urejevanIndex = index;
      opts.glavniEl.hidden = true;
      opts.potrditevEl.hidden = false;
      /* Zadnji predogled pred pošiljanjem – widget "Priporočilo za ta dolg"
         tu ni potreben. */
      var priporociloEl = document.getElementById("tone-recommendation-section");
      if (priporociloEl) priporociloEl.hidden = true;
      izrisiPotrditev(step);
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }

    /* Premakne samo notranji karusel. scrollIntoView je na iOS pri zadnjih
       karticah premaknil tudi celotno stran, zato je 9. korak deloval povečan
       in zamaknjen v desno. */
    function poravnajKarticoVKaruselu(index, behavior) {
      var karusel = opts.glavniEl.querySelector(".opomin-nacrt__carousel");
      var kartica = opts.glavniEl.querySelector('[data-stage="' + index + '"]');
      if (!karusel || !kartica) return;
      var ovoj = kartica.closest(".opomin-nacrt__stage-ovoj") || kartica;
      var karuselRect = karusel.getBoundingClientRect();
      var ovojRect = ovoj.getBoundingClientRect();
      var cilj =
        karusel.scrollLeft +
        (ovojRect.left - karuselRect.left) -
        Math.max(0, (karusel.clientWidth - ovojRect.width) / 2);
      var najvec = Math.max(0, karusel.scrollWidth - karusel.clientWidth);
      cilj = Math.max(0, Math.min(najvec, cilj));
      karusel.scrollTo({ left: cilj, top: 0, behavior: behavior || "smooth" });
      carouselScrollLeft = cilj;
      if (window.scrollX !== 0) window.scrollTo({ left: 0, top: window.scrollY });
    }

    function razredPika(step) {
      var cls = "opomin-nacrt__pika";
      if (step.status === "confirmed") cls += " opomin-nacrt__pika--potrjen";
      else if (step.status === "needs_review")
        cls += " opomin-nacrt__pika--pregled";
      else cls += " opomin-nacrt__pika--osnutek";
      if (step.index === aktivenIndex) cls += " opomin-nacrt__pika--izbran";
      return cls;
    }

    function vsebinaPika(step) {
      if (step.status === "confirmed") return IKONA_KLJUKICA;
      return "";
    }

    /** Bottom-sheet za zgodovino opominov (korak "Predaja odvetniku") – en
        skupen sheet za seznam vseh opominov in podrobnosti posameznega, po
        vzoru obstoječega opomin-cas-sheet. Samo za branje. */
    function zagotoviZgodovinaSheet() {
      var el = document.getElementById("opomin-zgodovina-sheet");
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-zgodovina-sheet";
      el.className = "opomin-cas-sheet";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opomin-cas-sheet__backdrop" id="opomin-zgodovina-sheet-backdrop" aria-label="Zapri"></button>' +
        '<div class="opomin-cas-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="opomin-zgodovina-sheet-naslov">' +
        '<div class="opomin-cas-sheet__rocaj" aria-hidden="true"></div>' +
        '<div class="opomin-cas-sheet__glava">' +
        '<h2 class="opomin-cas-sheet__naslov" id="opomin-zgodovina-sheet-naslov" tabindex="-1">Zgodovina opominov</h2>' +
        '<button type="button" class="opomin-cas-sheet__zapri" id="opomin-zgodovina-sheet-zapri" aria-label="Zapri">' +
        '<span aria-hidden="true">×</span></button>' +
        "</div>" +
        '<div class="opomin-cas-sheet__telo" id="opomin-zgodovina-sheet-telo"></div>' +
        "</div>";
      document.body.appendChild(el);

      function zapri() {
        el.hidden = true;
        document.documentElement.classList.remove("uj-modal-odprt");
        document.body.classList.remove("uj-modal-odprt");
      }

      el.querySelector("#opomin-zgodovina-sheet-backdrop").addEventListener(
        "click",
        zapri
      );
      el.querySelector("#opomin-zgodovina-sheet-zapri").addEventListener(
        "click",
        zapri
      );
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") zapri();
      });
      return el;
    }

    function odpriZgodovinaSheet(nacin, index) {
      var el = zagotoviZgodovinaSheet();
      var telo = el.querySelector("#opomin-zgodovina-sheet-telo");
      var naslovEl = el.querySelector("#opomin-zgodovina-sheet-naslov");
      var pregled = pridobiPregledVsehOpominov(plan, opts.podatkiKorak1, opts.podatkiKorak2);
      var vsiPodatki = pregled.vsiOpomini;

      var podatkiZaPodrobnosti =
        nacin === "podrobnosti"
          ? vsiPodatki.find(function (p) {
              return p.index === Number(index);
            })
          : null;

      if (podatkiZaPodrobnosti) {
        naslovEl.textContent = podatkiZaPodrobnosti.index + ". korak";
        telo.innerHTML =
          '<button type="button" class="opomin-zgodovina-podrobnosti__nazaj" id="opomin-zgodovina-nazaj">← Nazaj na seznam</button>' +
          htmlZgodovinaPodrobnosti(podatkiZaPodrobnosti);
        var nazajBtn = telo.querySelector("#opomin-zgodovina-nazaj");
        if (nazajBtn) {
          nazajBtn.addEventListener("click", function () {
            odpriZgodovinaSheet("seznam");
          });
        }
      } else {
        naslovEl.textContent = "Potek opominov";
        telo.innerHTML =
          '<p class="opomin-zgodovina-seznam__podnaslov">' +
          esc(stevecPoslanih(pregled.poslani.length) + " · " + stevecNacrtovanih(pregled.nacrtovani.length)) +
          "</p>" +
          htmlZgodovinaSeznam(vsiPodatki);
        telo.querySelectorAll("[data-zgodovina-korak]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            odpriZgodovinaSheet(
              "podrobnosti",
              Number(btn.getAttribute("data-zgodovina-korak"))
            );
          });
        });
      }

      el.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      naslovEl.focus();
    }

    /** Bottom-sheet za ročni vnos/spremembo odvetnika (korak "Predaja
        odvetniku"). Ni imenika obstoječih odvetnikov (v aplikaciji še ne
        obstaja) – lawyerId ostane null, struktura pa je pripravljena za
        poznejšo povezavo z resničnim virom. */
    function zagotoviOdvetnikSheet() {
      var el = document.getElementById("opomin-odvetnik-sheet");
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-odvetnik-sheet";
      el.className = "opomin-cas-sheet";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opomin-cas-sheet__backdrop" id="opomin-odvetnik-sheet-backdrop" aria-label="Zapri"></button>' +
        '<div class="opomin-cas-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="opomin-odvetnik-sheet-naslov">' +
        '<div class="opomin-cas-sheet__rocaj" aria-hidden="true"></div>' +
        '<div class="opomin-cas-sheet__glava">' +
        '<h2 class="opomin-cas-sheet__naslov" id="opomin-odvetnik-sheet-naslov" tabindex="-1">Odvetnik</h2>' +
        '<button type="button" class="opomin-cas-sheet__zapri" id="opomin-odvetnik-sheet-zapri" aria-label="Zapri">' +
        '<span aria-hidden="true">×</span></button>' +
        "</div>" +
        '<div class="opomin-cas-sheet__telo">' +
        '<p class="opomin-odvetnik-obrazec__namig">Ročno vnesi podatke odvetnika ali odvetniške pisarne.</p>' +
        '<label class="opomin-odvetnik-obrazec__polje" for="opomin-odvetnik-ime">' +
        "<span>Ime in priimek</span>" +
        '<input type="text" id="opomin-odvetnik-ime" maxlength="120" autocomplete="name" />' +
        "</label>" +
        '<label class="opomin-odvetnik-obrazec__polje" for="opomin-odvetnik-pisarna">' +
        "<span>Odvetniška pisarna</span>" +
        '<input type="text" id="opomin-odvetnik-pisarna" maxlength="160" autocomplete="organization" />' +
        "</label>" +
        '<label class="opomin-odvetnik-obrazec__polje" for="opomin-odvetnik-email">' +
        "<span>E-pošta</span>" +
        '<input type="email" id="opomin-odvetnik-email" maxlength="160" autocomplete="email" />' +
        "</label>" +
        '<p class="opomin-odvetnik-obrazec__napaka" id="opomin-odvetnik-napaka" hidden></p>' +
        '<label class="opomin-odvetnik-obrazec__polje" for="opomin-odvetnik-telefon">' +
        "<span>Telefon</span>" +
        '<input type="tel" id="opomin-odvetnik-telefon" maxlength="40" autocomplete="tel" />' +
        "</label>" +
        "</div>" +
        '<div class="opomin-cas-sheet__noga">' +
        '<button type="button" class="opomin-cas-sheet__gumb opomin-cas-sheet__gumb--obris" id="opomin-odvetnik-preklici">Prekliči</button>' +
        '<button type="button" class="opomin-cas-sheet__gumb opomin-cas-sheet__gumb--primarni" id="opomin-odvetnik-shrani">Shrani</button>' +
        "</div></div>";
      document.body.appendChild(el);

      function zapri() {
        el.hidden = true;
        document.documentElement.classList.remove("uj-modal-odprt");
        document.body.classList.remove("uj-modal-odprt");
      }

      el.querySelector("#opomin-odvetnik-sheet-backdrop").addEventListener(
        "click",
        zapri
      );
      el.querySelector("#opomin-odvetnik-sheet-zapri").addEventListener(
        "click",
        zapri
      );
      el.querySelector("#opomin-odvetnik-preklici").addEventListener(
        "click",
        zapri
      );
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") zapri();
      });
      el._zapri = zapri;
      return el;
    }

    function odpriOdvetnikSheet(step) {
      var el = zagotoviOdvetnikSheet();
      var lh = (step && step.lawyerHandoff) || {};
      var snap = lh.lawyerSnapshot || {};
      var imeEl = el.querySelector("#opomin-odvetnik-ime");
      var pisarnaEl = el.querySelector("#opomin-odvetnik-pisarna");
      var emailEl = el.querySelector("#opomin-odvetnik-email");
      var telefonEl = el.querySelector("#opomin-odvetnik-telefon");
      var napakaEl = el.querySelector("#opomin-odvetnik-napaka");
      imeEl.value = snap.name || "";
      pisarnaEl.value = snap.officeName || "";
      emailEl.value = snap.email || "";
      telefonEl.value = snap.phone || "";
      napakaEl.hidden = true;
      napakaEl.textContent = "";

      var shraniBtn = el.querySelector("#opomin-odvetnik-shrani");
      var noviShraniBtn = shraniBtn.cloneNode(true);
      shraniBtn.parentNode.replaceChild(noviShraniBtn, shraniBtn);
      noviShraniBtn.addEventListener("click", function () {
        var ime = imeEl.value.trim();
        var pisarna = pisarnaEl.value.trim();
        var email = emailEl.value.trim();
        var telefon = telefonEl.value.trim();

        if (!ime && !pisarna) {
          napakaEl.textContent = "Vnesi vsaj ime odvetnika ali naziv pisarne.";
          napakaEl.hidden = false;
          return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          napakaEl.textContent = "Vnesena e-pošta ni veljavna.";
          napakaEl.hidden = false;
          return;
        }

        plan = N.posodobiOdvetnika(plan, step.index, {
          name: ime,
          officeName: pisarna,
          email: email,
          phone: telefon,
        });
        shrani();
        if (el._zapri) el._zapri();
        izrisiGlavni();
      });

      el.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      el.querySelector("#opomin-odvetnik-sheet-naslov").focus();
    }

    /** Ena vrstica v sheetu "Vsi dokumenti" (glej odpriPredajaVsiDokumentiSheet)
        – prikaže status, po potrebi povezavo za ogled, gumb za dodajanje
        manjkajočega računa/pogodbe ali gumb za odstranitev (samo za
        uporabniško dodane dokumente – "Podatki dolžnika" in "Zgodovina
        opominov" nista nikoli odstranljiva, ker nista datoteki). */
    function htmlPredajaVsiDokumentiVrstica(doc) {
      var jePripravljen = doc.status === "ready";
      var jeNalagajocTip = doc.type === "invoice" || doc.type === "contract";
      var statusHtml = jePripravljen
        ? '<span class="opomin-predaja-vsi-dok__status opomin-predaja-vsi-dok__status--ok" aria-hidden="true">' +
          IKONA_PREDAJA_KLJUKICA_KROG +
          "</span>"
        : jeNalagajocTip
          ? '<span class="opomin-predaja-vsi-dok__status opomin-predaja-vsi-dok__status--manjka" aria-hidden="true">' +
            IKONA_PREDAJA_PLUS_KROG +
            "</span>"
          : "";
      var akcijeHtml = "";
      if (jePripravljen && doc.storagePath) {
        akcijeHtml +=
          '<a class="opomin-predaja-vsi-dok__akcija" href="' +
          esc(doc.storagePath) +
          '" target="_blank" rel="noopener">Ogled</a>';
      }
      if (!jePripravljen && jeNalagajocTip) {
        akcijeHtml +=
          '<button type="button" class="opomin-predaja-vsi-dok__akcija" data-dokument-dodaj="' +
          esc(doc.type) +
          '">Dodaj</button>';
      }
      if (jePripravljen && doc.documentId) {
        akcijeHtml +=
          '<button type="button" class="opomin-predaja-vsi-dok__akcija opomin-predaja-vsi-dok__akcija--odstrani" data-dokument-odstrani="' +
          esc(doc.documentId) +
          '" aria-label="Odstrani ' +
          esc(doc.title) +
          '">Odstrani</button>';
      }
      return (
        '<div class="opomin-predaja-vsi-dok__vrstica">' +
        '<span class="opomin-predaja-vsi-dok__ikona" aria-hidden="true">' +
        IKONA_PREDAJA_DOKUMENT +
        "</span>" +
        '<span class="opomin-predaja-vsi-dok__besedilo">' +
        '<span class="opomin-predaja-vsi-dok__naslov">' +
        esc(doc.title) +
        "</span>" +
        '<span class="opomin-predaja-vsi-dok__podnapis">' +
        esc(doc.subtitle) +
        "</span>" +
        "</span>" +
        statusHtml +
        (akcijeHtml
          ? '<span class="opomin-predaja-vsi-dok__akcije">' + akcijeHtml + "</span>"
          : "") +
        "</div>"
      );
    }

    function htmlPredajaVsiDokumentiTelo(step) {
      var dokStanje = N.dokumentnoStanjePredaje(
        plan,
        step.index,
        opts.podatkiKorak1,
        prilogeKoraka
      );
      var html = '<div class="opomin-predaja-vsi-dok">';
      dokStanje.osnovniDokumenti.forEach(function (tile) {
        html +=
          '<div class="opomin-predaja-vsi-dok__locilo-naslov">' +
          esc(tile.title) +
          " · " +
          tile.fileCount +
          "</div>";
        if (tile.files.length) {
          html += tile.files.map(htmlPredajaKategorijaDatotekaVrstica).join("");
        } else {
          html +=
            '<p class="opomin-predaja-kategorija-dok__prazno">Ni datotek</p>';
        }
      });
      if (dokStanje.dodatniDokumenti.length) {
        html +=
          '<div class="opomin-predaja-vsi-dok__locilo-naslov">Dodatna dokazila</div>';
        dokStanje.dodatniDokumenti.forEach(function (d) {
          if (d.files && d.files.length) {
            html += d.files.map(htmlPredajaKategorijaDatotekaVrstica).join("");
          }
        });
      }
      html +=
        '<button type="button" class="opomin-predaja-vsi-dok__dodaj-drugo" id="opomin-predaja-dodaj-drugo-dokazilo">+ Dodaj drugo dokazilo</button>';
      html += "</div>";
      return html;
    }

    /** Bottom-sheet "Vsi dokumenti" (Faza 7) – odpre se prek gumba "Preglej
        vse dokumente" v sestavljalniku 10. koraka. Ponovno uporabi isti
        skriti datotečni vnos (#opomin-dokument-datoteka) in isto change-
        wiring, ki živi v poveziGlavni – tu samo sproži klik nanj. */
    function zagotoviPredajaVsiDokumentiSheet() {
      var el = document.getElementById("opomin-predaja-vsi-dokumenti-sheet");
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-predaja-vsi-dokumenti-sheet";
      el.className = "opomin-cas-sheet";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opomin-cas-sheet__backdrop" id="opomin-predaja-vsi-dokumenti-sheet-backdrop" aria-label="Zapri"></button>' +
        '<div class="opomin-cas-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="opomin-predaja-vsi-dokumenti-sheet-naslov">' +
        '<div class="opomin-cas-sheet__rocaj" aria-hidden="true"></div>' +
        '<div class="opomin-cas-sheet__glava">' +
        '<h2 class="opomin-cas-sheet__naslov" id="opomin-predaja-vsi-dokumenti-sheet-naslov" tabindex="-1">Vsi dokumenti</h2>' +
        '<button type="button" class="opomin-cas-sheet__zapri" id="opomin-predaja-vsi-dokumenti-sheet-zapri" aria-label="Zapri">' +
        '<span aria-hidden="true">×</span></button>' +
        "</div>" +
        '<div class="opomin-cas-sheet__telo" id="opomin-predaja-vsi-dokumenti-sheet-telo"></div>' +
        "</div>";
      document.body.appendChild(el);

      function zapri() {
        el.hidden = true;
        document.documentElement.classList.remove("uj-modal-odprt");
        document.body.classList.remove("uj-modal-odprt");
      }
      el.querySelector("#opomin-predaja-vsi-dokumenti-sheet-backdrop").addEventListener(
        "click",
        zapri
      );
      el.querySelector("#opomin-predaja-vsi-dokumenti-sheet-zapri").addEventListener(
        "click",
        zapri
      );
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") zapri();
      });
      el._zapri = zapri;
      return el;
    }

    function vezavaPredajaVsiDokumentiTelo(el, step) {
      var telo = el.querySelector("#opomin-predaja-vsi-dokumenti-sheet-telo");
      telo.querySelectorAll("[data-kategorija-odpri]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var datoteka = najdiPredajaDatoteko(
            step,
            btn.getAttribute("data-kategorija-odpri") || ""
          );
          if (datoteka) odpriPredajaDatotekaModal(step, datoteka.type, datoteka, el);
        });
      });
      telo.querySelectorAll("[data-dokument-dodaj]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var dokumentDatoteka = document.getElementById("opomin-dokument-datoteka");
          if (!dokumentDatoteka) return;
          dokumentDatoteka.setAttribute(
            "data-dokument-tip",
            btn.getAttribute("data-dokument-dodaj")
          );
          dokumentDatoteka.removeAttribute("data-dokument-group-id");
          dokumentDatoteka.removeAttribute("capture");
          dokumentDatoteka.setAttribute("accept", "image/*,.pdf");
          dokumentDatoteka.click();
        });
      });
      telo.querySelectorAll("[data-dokument-odstrani]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          plan = N.odstraniDokumentOdvetniku(
            plan,
            step.index,
            btn.getAttribute("data-dokument-odstrani")
          );
          step = N.najdiKorak(plan, step.index) || step;
          shrani();
          izrisiPredajaVsiDokumentiTelo(el, step);
          izrisiGlavni();
          osveziPredajaKategorijaDokumentiSheetCeOdprt(step);
        });
      });
      telo.querySelectorAll("[data-kategorija-odstrani]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          plan = N.odstraniDokumentOdvetniku(
            plan,
            step.index,
            btn.getAttribute("data-kategorija-odstrani")
          );
          step = N.najdiKorak(plan, step.index) || step;
          shrani();
          izrisiPredajaVsiDokumentiTelo(el, step);
          izrisiGlavni();
          osveziPredajaKategorijaDokumentiSheetCeOdprt(step);
        });
      });
      napolniPredajaKategorijaUrlje(telo);
      var dodajDrugo = telo.querySelector("#opomin-predaja-dodaj-drugo-dokazilo");
      if (dodajDrugo) {
        dodajDrugo.addEventListener("click", function () {
          var dokumentDatoteka = document.getElementById("opomin-dokument-datoteka");
          if (!dokumentDatoteka) return;
          dokumentDatoteka.setAttribute("data-dokument-tip", "other");
          dokumentDatoteka.click();
        });
      }
    }

    function izrisiPredajaVsiDokumentiTelo(el, step) {
      var telo = el.querySelector("#opomin-predaja-vsi-dokumenti-sheet-telo");
      telo.innerHTML = htmlPredajaVsiDokumentiTelo(step);
      vezavaPredajaVsiDokumentiTelo(el, step);
    }

    function odpriPredajaVsiDokumentiSheet(step) {
      var el = zagotoviPredajaVsiDokumentiSheet();
      izrisiPredajaVsiDokumentiTelo(el, step);
      el.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      el.querySelector("#opomin-predaja-vsi-dokumenti-sheet-naslov").focus();
    }

    /** Če je sheet trenutno odprt, osveži njegovo vsebino (klic po nalaganju/
        odstranitvi dokumenta, sproženem iz glavnega sestavljalnika samega,
        ne iz sheeta). Brez učinka, če sheet ni odprt. */
    function osveziPredajaVsiDokumentiSheetCeOdprt(step) {
      var el = document.getElementById("opomin-predaja-vsi-dokumenti-sheet");
      if (!el || el.hidden) return;
      izrisiPredajaVsiDokumentiTelo(el, step);
    }

    /* ========== Kategorijski sheet "Ena kategorija dokumentov" (Faza 7) =====
       Odpre se s klikom na posamezen dokumentni kvadratek. Prikaže vse datoteke
       izbrane kategorije, omogoča ogled posamezne datoteke (signed URL),
       individualno odstranjevanje in dodajanje več datotek naenkrat. */

    var IKONA_PREDAJA_DOKUMENT_PDF =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/><path d="M9 11h3"/></svg>';

    function velikostPredajaDatoteke(f) {
      if (PV && PV.formatVelikost && f.sizeBytes != null) {
        return PV.formatVelikost(f.sizeBytes);
      }
      return "";
    }

    function zahtevaDokumentaPredaja(step, tip) {
      var lh = (step && step.lawyerHandoff) || {};
      var zahteve = (lh.lawyerSnapshot && lh.lawyerSnapshot.attachmentRequirements) || {};
      var z = zahteve[tip] || {};
      var privzete = {
        invoice: ["Po priporočilu odvetnika priložite račun in morebitna dokazila o izdaji.", "Na kateri posel se nanaša račun?"],
        debtor_info: ["Po priporočilu odvetnika preverite podatke dolžnika in priložite dodatna dokazila, če jih imate.", "Kaj dodatno dokazilo pove o dolžniku?"],
        reminder_history: ["Po priporočilu odvetnika priložite dodatna dokazila o dosedanji komunikaciji, če jih imate.", "Kdaj je komunikacija potekala in kaj dokazuje?"],
        contract: ["Po priporočilu odvetnika priložite pogodbo, ponudbo ali dokazilo o dogovoru.", "Kdaj in kako je bil dogovor sklenjen?"],
      };
      var privzeto = privzete[tip] || ["Po priporočilu odvetnika priložite ustrezna dokazila.", "Kaj prikazuje oziroma dokazuje priloga?"];
      return {
        recommendation: String(z.recommendation || privzeto[0]),
        question: String(z.question || privzeto[1]),
        required: Boolean(z.required),
      };
    }

    function htmlPredajaKategorijaDatotekaVrstica(f) {
      var jeSlika = String(f.mimeType || "").indexOf("image/") === 0;
      var velikost = velikostPredajaDatoteke(f);
      var opisKljuc = f.id || f.attachmentId || f.storagePath || "";
      var predogledHtml = jeSlika
        ? '<img class="opomin-predaja-kategorija-dok__thumbnail" alt="" data-predogled-path="' +
          esc(f.storagePath || "") +
          '" />'
        : '<span class="opomin-predaja-kategorija-dok__ikona" aria-hidden="true">' +
          IKONA_PREDAJA_DOKUMENT_PDF +
          "</span>";
      return (
        '<div class="opomin-predaja-kategorija-dok__datoteka opomin-predaja-kategorija-dok__datoteka--minimizirana" data-datoteka-id="' +
        esc(f.id || "") +
        '">' +
        '<button type="button" class="opomin-predaja-kategorija-dok__klik" data-kategorija-odpri="' +
        esc(opisKljuc) +
        '" aria-label="Odpri ' +
        esc(f.name || "datoteko") +
        '">' +
        '<span class="opomin-predaja-kategorija-dok__medij">' +
        predogledHtml +
        '<span class="opomin-predaja-kategorija-dok__povecaj" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="5.5"></circle><path d="m15 15 4 4"></path></svg></span>' +
        "</span>" +
        '<span class="opomin-predaja-kategorija-dok__besedilo">' +
        '<span class="opomin-predaja-kategorija-dok__ime">' +
        esc(f.name || "Datoteka") +
        "</span>" +
        '<span class="opomin-predaja-kategorija-dok__namig">Klikni za pregled in urejanje' +
        (velikost ? " · " + esc(velikost) : "") +
        "</span>" +
        "</span>" +
        '<span class="opomin-predaja-kategorija-dok__puscica" aria-hidden="true">›</span>' +
        "</button>" +
        "</div>"
      );
    }

    function htmlPredajaKategorijaDokumentiTelo(doc, step) {
      var zahteva = zahtevaDokumentaPredaja(step, doc.type);
      var skupine = [];
      var skupinePoId = Object.create(null);
      (doc.files || []).forEach(function (f) {
        var kljuc = f.groupId || f.id || f.attachmentId || f.storagePath || ("skupina-" + skupine.length);
        if (!skupinePoId[kljuc]) {
          skupinePoId[kljuc] = [];
          skupine.push(skupinePoId[kljuc]);
        }
        skupinePoId[kljuc].push(f);
      });
      var mrezaHtml = skupine.length
        ? skupine.map(function (skupina) {
            var prikaz = Object.assign({}, skupina[0]);
            if (skupina.length > 1) prikaz.name = skupina.length + " priložene datoteke";
            return htmlPredajaKategorijaDatotekaVrstica(prikaz);
          }).join("")
        : '<p class="opomin-predaja-kategorija-dok__prazno">V tej kategoriji še ni datotek.</p>';
      return (
        '<div class="opomin-predaja-kategorija-dok">' +
        '<div class="opomin-predaja-kategorija-dok__povzetek">' +
        "<strong>" +
        esc(doc.title) +
        "</strong>" +
        "<span>" +
        esc(N.besediloStevilaDatotek(doc.fileCount)) +
        "</span>" +
        "</div>" +
        '<div class="opravljeno-bubble__zahteva opomin-predaja-kategorija-dok__zahteva">' +
        '<div class="opravljeno-bubble__priporocilo" role="note">' +
        '<span class="opravljeno-bubble__priporocilo-ikona" aria-hidden="true">' + IKONA_PREDAJA_DOKUMENT_PDF + '</span>' +
        '<span>' + esc(zahteva.recommendation) + '</span>' +
        '<div class="opravljeno-bubble__priporocilo-akcije">' +
        '<button type="button" class="opravljeno-bubble__gumb" data-kategorija-uvozi="' + esc(doc.type) + '">Uvozi</button>' +
        '<button type="button" class="opravljeno-bubble__gumb" data-kategorija-slikaj="' + esc(doc.type) + '">Slikaj</button>' +
        (doc.type === "invoice" ? "" : '<button type="button" class="opravljeno-bubble__gumb opravljeno-bubble__gumb--brez-slike" data-kategorija-brez="' + esc(doc.type) + '">Nimam</button>') +
        '</div></div>' +
        '<div class="opravljeno-bubble__seznam opomin-predaja-kategorija-dok__mreza">' + mrezaHtml + '</div>' +
        '</div>' +
        "</div>"
      );
    }

    function zagotoviPredajaKategorijaDokumentiSheet() {
      var el = document.getElementById("opomin-predaja-kategorija-dokumenti-sheet");
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-predaja-kategorija-dokumenti-sheet";
      el.className = "opomin-cas-sheet";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opomin-cas-sheet__backdrop" id="opomin-predaja-kategorija-dokumenti-sheet-backdrop" aria-label="Zapri"></button>' +
        '<div class="opomin-cas-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="opomin-predaja-kategorija-dokumenti-sheet-naslov">' +
        '<div class="opomin-cas-sheet__rocaj" aria-hidden="true"></div>' +
        '<div class="opomin-cas-sheet__glava">' +
        '<h2 class="opomin-cas-sheet__naslov" id="opomin-predaja-kategorija-dokumenti-sheet-naslov" tabindex="-1">Dokumenti</h2>' +
        '<div class="opomin-predaja-kategorija-dok__glava-akcije">' +
        '<button type="button" class="opomin-predaja-kategorija-dok__preklici" id="opomin-predaja-kategorija-dokumenti-sheet-preklici">Prekliči</button>' +
        '<button type="button" class="opomin-predaja-kategorija-dok__shrani" id="opomin-predaja-kategorija-dokumenti-sheet-shrani">Shrani</button>' +
        "</div>" +
        "</div>" +
        '<div class="opomin-cas-sheet__telo" id="opomin-predaja-kategorija-dokumenti-sheet-telo"></div>' +
        "</div>";
      document.body.appendChild(el);

      function zapriOkno() {
        el.hidden = true;
        document.documentElement.classList.remove("uj-modal-odprt");
        document.body.classList.remove("uj-modal-odprt");
      }

      function obnoviObjekt(cilj, vir) {
        Object.keys(cilj || {}).forEach(function (kljuc) {
          delete cilj[kljuc];
        });
        Object.keys(vir || {}).forEach(function (kljuc) {
          cilj[kljuc] = vir[kljuc];
        });
      }

      function prekliciInZapri() {
        var osnutek = el._osnutekPredOdprtjem;
        el._osnutekPredOdprtjem = null;
        if (osnutek) {
          plan = osnutek.plan;
          prilogeKoraka.splice.apply(
            prilogeKoraka,
            [0, prilogeKoraka.length].concat(osnutek.prilogeKoraka || [])
          );
          obnoviObjekt(opts.podatkiKorak1, osnutek.podatkiKorak1 || {});
          try {
            sessionStorage.setItem(
              "neplacilo-korak1-podatki",
              JSON.stringify(opts.podatkiKorak1 || {})
            );
          } catch (_napakaPreklicDokumentov) {}
          N.shraniOsnutek(plan);
        }
        zapriOkno();
        izrisiGlavni();
      }

      function shraniInZapri() {
        el._osnutekPredOdprtjem = null;
        shrani();
        zapriOkno();
        izrisiGlavni();
      }
      el.querySelector("#opomin-predaja-kategorija-dokumenti-sheet-backdrop").addEventListener(
        "click",
        prekliciInZapri
      );
      el.querySelector("#opomin-predaja-kategorija-dokumenti-sheet-preklici").addEventListener(
        "click",
        prekliciInZapri
      );
      el.querySelector("#opomin-predaja-kategorija-dokumenti-sheet-shrani").addEventListener(
        "click",
        shraniInZapri
      );
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") prekliciInZapri();
      });
      el._zapri = prekliciInZapri;
      el._shraniInZapri = shraniInZapri;
      return el;
    }

    function najdiPredajaDatoteko(step, kljuc) {
      var stanje = N.dokumentnoStanjePredaje(
        plan,
        step.index,
        opts.podatkiKorak1,
        prilogeKoraka
      );
      var sklopi = stanje.osnovniDokumenti.concat(stanje.dodatniDokumenti || []);
      var najdena = null;
      sklopi.some(function (sklop) {
        najdena = (sklop.files || []).find(function (f) {
          return (f.id || f.attachmentId || f.storagePath || "") === kljuc;
        });
        return Boolean(najdena);
      });
      return najdena;
    }

    function shraniOpisPredajaDatoteke(step, datoteka, odgovor) {
      var kljuc = datoteka.id || datoteka.attachmentId || datoteka.storagePath || "";
      var lh = (step && step.lawyerHandoff) || {};
      var lastenDokument = (lh.documents || []).find(function (d) {
        return d.id === kljuc;
      });
      if (lastenDokument) {
        plan = N.posodobiOpisDokumentaOdvetniku(
          plan,
          step.index,
          lastenDokument.id,
          odgovor
        );
      } else {
        var zunanja = prilogeKoraka.find(function (p) {
          return p.attachmentId === kljuc || p.storagePath === kljuc;
        });
        if (zunanja) {
          zunanja.description = odgovor;
          var k1 = opts.podatkiKorak1 || {};
          if (zunanja.textOnly) {
            var brezSlike = Array.isArray(k1.opravljenoBrezSlike) ? k1.opravljenoBrezSlike.slice() : [];
            var brezSlikeIndeks = brezSlike.findIndex(function (m) {
              return m.id === zunanja.attachmentId;
            });
            if (brezSlikeIndeks >= 0) {
              brezSlike[brezSlikeIndeks] = Object.assign({}, brezSlike[brezSlikeIndeks], {
                description: odgovor,
                collapsed: true,
                textOnly: true,
              });
              k1.opravljenoBrezSlike = brezSlike;
              try {
                sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify(k1));
              } catch (_napakaOpisBrezSlike) {}
            }
            sinhronizirajPrilogeVKorak1();
            if (N.oznaciZunanjePrilogePredajeSpremenjene) {
              plan = N.oznaciZunanjePrilogePredajeSpremenjene(plan, step.index);
            }
            shrani();
            return N.najdiKorak(plan, step.index) || step;
          }
          var jeDokazilo = zunanja.documentType === "work_evidence";
          var potiKljuc = jeDokazilo ? "opravljenoDatotekePoti" : "racunDatotekePoti";
          var metaKljuc = jeDokazilo ? "opravljenoAttachmentMeta" : "attachmentMeta";
          var poti = Array.isArray(k1[potiKljuc]) ? k1[potiKljuc] : [];
          var meta = Array.isArray(k1[metaKljuc]) ? k1[metaKljuc].slice() : [];
          var i = poti.indexOf(zunanja.storagePath);
          if (i >= 0) {
            meta[i] = Object.assign({}, meta[i] || {}, {
              id: zunanja.attachmentId || (meta[i] && meta[i].id) || null,
              originalFileName: zunanja.originalFileName || zunanja.name || "Priloga",
              mimeType: zunanja.mimeType || "",
              sizeBytes: zunanja.sizeBytes != null ? zunanja.sizeBytes : null,
              descriptionQuestion:
                zunanja.descriptionQuestion || "Kdaj je nastala ta slika oziroma dokument?",
              description: odgovor,
              descriptionRequired: Boolean(zunanja.descriptionRequired),
              collapsed: true,
            });
            k1[metaKljuc] = meta;
            try {
              sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify(k1));
            } catch (_napakaOpisPredajaModal) {}
          }
          sinhronizirajPrilogeVKorak1();
          if (N.oznaciZunanjePrilogePredajeSpremenjene) {
            plan = N.oznaciZunanjePrilogePredajeSpremenjene(plan, step.index);
          }
        }
      }
      shrani();
      return N.najdiKorak(plan, step.index) || step;
    }

    function odstraniPredajaDatoteko(step, datoteka) {
      if (datoteka.id) {
        plan = N.odstraniDokumentOdvetniku(plan, step.index, datoteka.id);
      } else {
        var kljuc = datoteka.attachmentId || datoteka.storagePath || "";
        var indeks = prilogeKoraka.findIndex(function (p) {
          return p.attachmentId === kljuc || p.storagePath === kljuc;
        });
        if (indeks >= 0) {
          var zunanja = prilogeKoraka[indeks];
          var k1 = opts.podatkiKorak1 || {};
          if (zunanja.textOnly) {
            k1.opravljenoBrezSlike = (Array.isArray(k1.opravljenoBrezSlike)
              ? k1.opravljenoBrezSlike
              : []).filter(function (m) {
              return m.id !== zunanja.attachmentId;
            });
            prilogeKoraka.splice(indeks, 1);
            sinhronizirajPrilogeVKorak1();
            if (N.oznaciZunanjePrilogePredajeSpremenjene) {
              plan = N.oznaciZunanjePrilogePredajeSpremenjene(plan, step.index);
            }
            shrani();
            return N.najdiKorak(plan, step.index) || step;
          }
          var jeDokazilo = zunanja.documentType === "work_evidence";
          var potiKljuc = jeDokazilo ? "opravljenoDatotekePoti" : "racunDatotekePoti";
          var metaKljuc = jeDokazilo ? "opravljenoAttachmentMeta" : "attachmentMeta";
          var poti = Array.isArray(k1[potiKljuc]) ? k1[potiKljuc].slice() : [];
          var meta = Array.isArray(k1[metaKljuc]) ? k1[metaKljuc].slice() : [];
          var potIndeks = poti.indexOf(zunanja.storagePath);
          if (potIndeks >= 0) {
            poti.splice(potIndeks, 1);
            meta.splice(potIndeks, 1);
            k1[potiKljuc] = poti;
            k1[metaKljuc] = meta;
          }
          prilogeKoraka.splice(indeks, 1);
          sinhronizirajPrilogeVKorak1();
          if (N.oznaciZunanjePrilogePredajeSpremenjene) {
            plan = N.oznaciZunanjePrilogePredajeSpremenjene(plan, step.index);
          }
        }
      }
      shrani();
      return N.najdiKorak(plan, step.index) || step;
    }

    function skupinaPredajaDatotek(step, datoteka) {
      var groupId = datoteka.groupId || datoteka.id || datoteka.attachmentId || datoteka.storagePath || "";
      return N.dokumentiPredajePoTipu(
        plan,
        step.index,
        datoteka.type || "other",
        opts.podatkiKorak1,
        prilogeKoraka
      ).filter(function (d) {
        return (d.groupId || d.id || d.attachmentId || d.storagePath || "") === groupId;
      });
    }

    function zagotoviPredajaDatotekaModal() {
      var el = document.getElementById("opomin-predaja-datoteka-modal");
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-predaja-datoteka-modal";
      el.className = "opravljeno-modal opomin-predaja-datoteka-modal";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opravljeno-modal__backdrop" data-predaja-datoteka-zapri aria-label="Zapri"></button>' +
        '<section class="opravljeno-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="opomin-predaja-datoteka-naslov">' +
        '<div class="opravljeno-modal__rocaj" aria-hidden="true"></div>' +
        '<header class="opravljeno-modal__glava"><h2 class="opravljeno-modal__naslov" id="opomin-predaja-datoteka-naslov" tabindex="-1">Dokument</h2>' +
        '<button type="button" class="opravljeno-modal__zapri" data-predaja-datoteka-zapri aria-label="Zapri">×</button></header>' +
        '<div class="opravljeno-modal__vsebina"><div class="opravljeno-modal__medij">' +
        '<img class="opravljeno-modal__slika" data-predaja-datoteka-slika alt="" hidden />' +
        '<iframe class="opravljeno-modal__pdf" data-predaja-datoteka-pdf title="Predogled dokumenta" hidden></iframe>' +
        '<span class="opravljeno-modal__nalaganje" data-predaja-datoteka-nalaganje>Pripravljam predogled …</span>' +
        '<div class="opravljeno-modal__galerija" data-predaja-datoteka-galerija hidden></div>' +
        '<div class="opravljeno-modal__brez-slike" data-predaja-datoteka-brez-slike hidden><strong>Brez datoteke</strong><span>Dodajte opis oziroma pojasnilo v spodnjem polju.</span></div></div>' +
        '<button type="button" class="opravljeno-modal__dodaj" data-predaja-datoteka-dodaj>+ Dodaj še datoteke</button>' +
        '<label class="opravljeno-modal__opis"><span class="opravljeno-modal__vprasanje" data-predaja-datoteka-vprasanje></span>' +
        '<textarea class="opravljeno-modal__vnos" data-predaja-datoteka-vnos rows="3" maxlength="500" placeholder="Kratek opis dokumenta …"></textarea></label></div>' +
        '<footer class="opravljeno-modal__noga"><button type="button" class="opravljeno-modal__izbrisi" data-predaja-datoteka-odstrani>Odstrani</button>' +
        '<button type="button" class="opravljeno-modal__shrani" data-predaja-datoteka-shrani>Shrani</button></footer></section>';
      document.body.appendChild(el);

      function zapri() {
        el.hidden = true;
        el._token = (el._token || 0) + 1;
        var slika = el.querySelector("[data-predaja-datoteka-slika]");
        var pdf = el.querySelector("[data-predaja-datoteka-pdf]");
        var brezSlike = el.querySelector("[data-predaja-datoteka-brez-slike]");
        var galerija = el.querySelector("[data-predaja-datoteka-galerija]");
        slika.hidden = true;
        slika.removeAttribute("src");
        pdf.hidden = true;
        pdf.removeAttribute("src");
        if (brezSlike) brezSlike.hidden = true;
        if (galerija) { galerija.hidden = true; galerija.innerHTML = ""; }
        var medij = el.querySelector(".opravljeno-modal__medij");
        if (medij) medij.classList.remove("opravljeno-modal__medij--brez-slike");
        if (!el._parentSheet || el._parentSheet.hidden) {
          document.documentElement.classList.remove("uj-modal-odprt");
          document.body.classList.remove("uj-modal-odprt");
        }
      }

      el.querySelectorAll("[data-predaja-datoteka-zapri]").forEach(function (gumb) {
        gumb.addEventListener("click", zapri);
      });
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") zapri();
      });
      el.querySelector("[data-predaja-datoteka-shrani]").addEventListener("click", function () {
        var vnos = el.querySelector("[data-predaja-datoteka-vnos]");
        var odgovor = String(vnos.value || "").trim();
        if (el._datoteka.descriptionRequired && !odgovor) {
          el.querySelector("[data-predaja-datoteka-vprasanje]").classList.add("opravljeno-modal__vprasanje--manjka");
          vnos.focus();
          return;
        }
        var skupina = skupinaPredajaDatotek(el._step, el._datoteka);
        if (!skupina.length) skupina = [el._datoteka];
        skupina.forEach(function (datoteka) {
          el._step = shraniOpisPredajaDatoteke(el._step, datoteka, odgovor);
        });
        zapri();
        if (el._parentSheet && el._parentSheet.id === "opomin-predaja-kategorija-dokumenti-sheet") {
          izrisiPredajaKategorijaDokumentiTelo(el._parentSheet, el._step, el._tip);
        } else if (el._parentSheet) {
          izrisiPredajaVsiDokumentiTelo(el._parentSheet, el._step);
        }
        izrisiGlavni();
      });
      el.querySelector("[data-predaja-datoteka-odstrani]").addEventListener("click", function () {
        var skupina = skupinaPredajaDatotek(el._step, el._datoteka);
        if (!skupina.length) skupina = [el._datoteka];
        skupina.forEach(function (datoteka) {
          el._step = odstraniPredajaDatoteko(el._step, datoteka);
        });
        zapri();
        if (el._parentSheet && el._parentSheet.id === "opomin-predaja-kategorija-dokumenti-sheet") {
          izrisiPredajaKategorijaDokumentiTelo(el._parentSheet, el._step, el._tip);
        } else if (el._parentSheet) {
          izrisiPredajaVsiDokumentiTelo(el._parentSheet, el._step);
        }
        izrisiGlavni();
      });
      el.querySelector("[data-predaja-datoteka-dodaj]").addEventListener("click", function () {
        var dokumentDatoteka = document.getElementById("opomin-dokument-datoteka");
        if (!dokumentDatoteka) return;
        dokumentDatoteka.setAttribute("data-dokument-tip", el._tip || "other");
        dokumentDatoteka.setAttribute("data-dokument-group-id", el._groupId || "");
        dokumentDatoteka.setAttribute("accept", "image/*,.pdf");
        dokumentDatoteka.removeAttribute("capture");
        dokumentDatoteka.click();
      });
      el._zapri = zapri;
      return el;
    }

    function odpriPredajaDatotekaModal(step, tip, datoteka, parentSheet) {
      var el = zagotoviPredajaDatotekaModal();
      el._step = step;
      el._tip = tip || datoteka.type || "other";
      el._datoteka = datoteka;
      el._parentSheet = parentSheet;
      el._token = (el._token || 0) + 1;
      var token = el._token;
      var naslov = el.querySelector("#opomin-predaja-datoteka-naslov");
      var vprasanje = el.querySelector("[data-predaja-datoteka-vprasanje]");
      var vnos = el.querySelector("[data-predaja-datoteka-vnos]");
      var slika = el.querySelector("[data-predaja-datoteka-slika]");
      var pdf = el.querySelector("[data-predaja-datoteka-pdf]");
      var nalaganje = el.querySelector("[data-predaja-datoteka-nalaganje]");
      var brezSlike = el.querySelector("[data-predaja-datoteka-brez-slike]");
      var galerija = el.querySelector("[data-predaja-datoteka-galerija]");
      var dodajGumb = el.querySelector("[data-predaja-datoteka-dodaj]");
      var medij = el.querySelector(".opravljeno-modal__medij");
      var skupina = skupinaPredajaDatotek(step, datoteka);
      if (!skupina.length) skupina = [datoteka];
      el._groupId = datoteka.groupId || datoteka.id || datoteka.attachmentId || datoteka.storagePath || "";
      naslov.textContent = datoteka.textOnly
        ? "Opis brez datoteke"
        : skupina.length === 1
          ? "1 datoteka"
          : skupina.length + " datotek";
      vprasanje.classList.remove("opravljeno-modal__vprasanje--manjka");
      vprasanje.textContent =
        (datoteka.descriptionQuestion || "Kdaj je nastala ta slika oziroma dokument?") +
        (datoteka.descriptionRequired ? " *" : " (opcijsko)");
      vnos.value = datoteka.description || "";
      slika.hidden = true;
      pdf.hidden = true;
      if (brezSlike) brezSlike.hidden = true;
      if (galerija) { galerija.hidden = true; galerija.innerHTML = ""; }
      if (dodajGumb) dodajGumb.hidden = Boolean(datoteka.textOnly);
      if (medij) medij.classList.remove("opravljeno-modal__medij--brez-slike", "opravljeno-modal__medij--galerija");
      nalaganje.hidden = false;
      nalaganje.textContent = "Pripravljam predogled …";
      el.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      // Brez programskega fokusa naslova: iOS/Safari sicer okoli besedila
      // prikaže velik zelen fokusni pravokotnik.
      if (datoteka.textOnly) {
        nalaganje.hidden = true;
        if (brezSlike) brezSlike.hidden = false;
        if (medij) medij.classList.add("opravljeno-modal__medij--brez-slike");
        return;
      }
      nalaganje.hidden = true;
      galerija.hidden = false;
      medij.classList.add("opravljeno-modal__medij--galerija");
      skupina.filter(function (d) { return !d.textOnly; }).forEach(function (clan) {
        var kartica = document.createElement("div");
        kartica.className = "opravljeno-modal__thumb";
        var predogled = document.createElement("div");
        predogled.className = "opravljeno-modal__thumb-medij";
        var jeSlika = String(clan.mimeType || "").indexOf("image/") === 0;
        if (jeSlika && clan.storagePath && typeof opts.pridobiUrlPriloge === "function") {
          var img = document.createElement("img");
          img.alt = clan.name || "Dokument";
          predogled.appendChild(img);
          opts.pridobiUrlPriloge(clan.storagePath).then(function (rez) {
            if (rez && rez.url && img.isConnected) img.src = rez.url;
          }).catch(function () {});
        } else {
          predogled.innerHTML = IKONA_PREDAJA_DOKUMENT_PDF;
        }
        var odstrani = document.createElement("button");
        odstrani.type = "button";
        odstrani.className = "opravljeno-modal__thumb-odstrani";
        odstrani.setAttribute("aria-label", "Odstrani " + (clan.name || "datoteko"));
        odstrani.textContent = "×";
        odstrani.addEventListener("click", function () {
          var noviStep = odstraniPredajaDatoteko(el._step, clan);
          var preostale = skupinaPredajaDatotek(noviStep, datoteka);
          izrisiPredajaKategorijaDokumentiTelo(parentSheet, noviStep, el._tip);
          izrisiGlavni();
          if (preostale.length) odpriPredajaDatotekaModal(noviStep, el._tip, preostale[0], parentSheet);
          else el._zapri();
        });
        var ime = document.createElement("span");
        ime.className = "opravljeno-modal__thumb-ime";
        ime.textContent = clan.name || "Datoteka";
        kartica.appendChild(predogled);
        kartica.appendChild(odstrani);
        kartica.appendChild(ime);
        galerija.appendChild(kartica);
      });
      el.querySelector("[data-predaja-datoteka-odstrani]").textContent = skupina.length > 1 ? "Odstrani vse" : "Odstrani";
    }

    function napolniPredajaKategorijaUrlje(el) {
      if (typeof opts.pridobiUrlPriloge !== "function") return;
      el.querySelectorAll("[data-predogled-path]").forEach(function (img) {
        var pot = img.getAttribute("data-predogled-path");
        if (!pot) return;
        opts
          .pridobiUrlPriloge(pot)
          .then(function (rez) {
            if (rez && rez.url) img.src = rez.url;
          })
          .catch(function () {});
      });
      el.querySelectorAll("[data-ogled-path]").forEach(function (a) {
        var pot = a.getAttribute("data-ogled-path");
        if (!pot) return;
        opts
          .pridobiUrlPriloge(pot)
          .then(function (rez) {
            if (rez && rez.url) a.href = rez.url;
            else a.textContent = "Predogled trenutno ni na voljo";
          })
          .catch(function () {
            a.textContent = "Predogled trenutno ni na voljo";
          });
      });
    }

    function vezavaPredajaKategorijaDokumentiTelo(el, step, tip) {
      var telo = el.querySelector("#opomin-predaja-kategorija-dokumenti-sheet-telo");
      function odpriIzbiroDatoteke(samoSlika) {
        var dokumentDatoteka = document.getElementById("opomin-dokument-datoteka");
        if (!dokumentDatoteka) return;
        dokumentDatoteka.setAttribute("data-dokument-tip", tip);
        dokumentDatoteka.setAttribute("data-dokument-group-id", "predaja-" + tip + "-" + Date.now().toString(36));
        dokumentDatoteka.setAttribute("accept", samoSlika ? "image/*" : "image/*,.pdf");
        if (samoSlika) dokumentDatoteka.setAttribute("capture", "environment");
        else dokumentDatoteka.removeAttribute("capture");
        dokumentDatoteka.click();
      }
      telo.querySelectorAll("[data-kategorija-uvozi]").forEach(function (btn) {
        btn.addEventListener("click", function () { odpriIzbiroDatoteke(false); });
      });
      telo.querySelectorAll("[data-kategorija-slikaj]").forEach(function (btn) {
        btn.addEventListener("click", function () { odpriIzbiroDatoteke(true); });
      });
      telo.querySelectorAll("[data-kategorija-brez]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var zahteva = zahtevaDokumentaPredaja(step, tip);
          var groupId = "predaja-" + tip + "-text-" + Date.now().toString(36);
          plan = N.dodajDokumentOdvetniku(plan, step.index, {
            type: tip,
            source: "text_only",
            groupId: groupId,
            name: "Opis – " + (el.querySelector("#opomin-predaja-kategorija-dokumenti-sheet-naslov").textContent || "dokument"),
            mimeType: "text/plain",
            status: "ready",
            textOnly: true,
            recommendation: zahteva.recommendation,
            descriptionQuestion: zahteva.question,
            description: "",
            descriptionRequired: true,
          });
          step = N.najdiKorak(plan, step.index) || step;
          shrani();
          izrisiPredajaKategorijaDokumentiTelo(el, step, tip);
          izrisiGlavni();
          var dodana = N.dokumentiPredajePoTipu(plan, step.index, tip, opts.podatkiKorak1, prilogeKoraka).filter(function (d) {
            return d.groupId === groupId;
          })[0];
          if (dodana) odpriPredajaDatotekaModal(step, tip, dodana, el);
        });
      });
      telo.querySelectorAll("[data-kategorija-odpri]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var datoteka = najdiPredajaDatoteko(
            step,
            btn.getAttribute("data-kategorija-odpri") || ""
          );
          if (datoteka) odpriPredajaDatotekaModal(step, tip, datoteka, el);
        });
      });
      telo.querySelectorAll("[data-kategorija-odstrani]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          plan = N.odstraniDokumentOdvetniku(
            plan,
            step.index,
            btn.getAttribute("data-kategorija-odstrani")
          );
          step = N.najdiKorak(plan, step.index) || step;
          shrani();
          izrisiPredajaKategorijaDokumentiTelo(el, step, tip);
          izrisiGlavni();
          osveziPredajaVsiDokumentiSheetCeOdprt(step);
        });
      });
      telo.querySelectorAll("[data-kategorija-opis]").forEach(function (vnos) {
        vnos.addEventListener("change", function () {
          var kljuc = vnos.getAttribute("data-kategorija-opis") || "";
          var odgovor = String(vnos.value || "").trim();
          var lh = (step && step.lawyerHandoff) || {};
          var lastenDokument = (lh.documents || []).find(function (d) {
            return d.id === kljuc;
          });
          if (lastenDokument) {
            plan = N.posodobiOpisDokumentaOdvetniku(
              plan,
              step.index,
              lastenDokument.id,
              odgovor
            );
          } else {
            var zunanja = prilogeKoraka.find(function (p) {
              return p.attachmentId === kljuc || p.storagePath === kljuc;
            });
            if (zunanja) {
              zunanja.description = odgovor;
              var k1 = opts.podatkiKorak1 || {};
              var poti = Array.isArray(k1.racunDatotekePoti) ? k1.racunDatotekePoti : [];
              var meta = Array.isArray(k1.attachmentMeta) ? k1.attachmentMeta.slice() : [];
              var i = poti.indexOf(zunanja.storagePath);
              if (i >= 0) {
                meta[i] = Object.assign({}, meta[i] || {}, {
                  id: zunanja.attachmentId || (meta[i] && meta[i].id) || null,
                  originalFileName: zunanja.originalFileName || zunanja.name || "Priloga",
                  mimeType: zunanja.mimeType || "",
                  sizeBytes: zunanja.sizeBytes != null ? zunanja.sizeBytes : null,
                  descriptionQuestion:
                    zunanja.descriptionQuestion ||
                    "Kdaj je nastala ta slika oziroma dokument?",
                  description: odgovor,
                  descriptionRequired: Boolean(zunanja.descriptionRequired),
                });
                k1.attachmentMeta = meta;
                try {
                  sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify(k1));
                } catch (_napakaOpisPriloge) {
                  /* Podatek ostane v trenutnem načrtu tudi brez sejne shrambe. */
                }
              }
              sinhronizirajPrilogeVKorak1();
              if (N.oznaciZunanjePrilogePredajeSpremenjene) {
                plan = N.oznaciZunanjePrilogePredajeSpremenjene(plan, step.index);
              }
            }
          }
          step = N.najdiKorak(plan, step.index) || step;
          shrani();
          izrisiPredajaKategorijaDokumentiTelo(el, step, tip);
          izrisiGlavni();
        });
      });
      napolniPredajaKategorijaUrlje(telo);
    }

    function izrisiPredajaKategorijaDokumentiTelo(el, step, tip) {
      var stanje = N.dokumentnoStanjePredaje(
        plan,
        step.index,
        opts.podatkiKorak1,
        prilogeKoraka
      );
      var doc = stanje.osnovniDokumenti.find(function (d) {
        return d.type === tip;
      });
      if (!doc) {
        doc = { type: tip, title: "Dokumenti", fileCount: 0, files: [] };
      }
      el.querySelector("#opomin-predaja-kategorija-dokumenti-sheet-naslov").textContent =
        doc.title;
      var telo = el.querySelector("#opomin-predaja-kategorija-dokumenti-sheet-telo");
      telo.innerHTML = htmlPredajaKategorijaDokumentiTelo(doc, step);
      vezavaPredajaKategorijaDokumentiTelo(el, step, tip);
    }

    function odpriPredajaKategorijaDokumentiSheet(step, tip) {
      var el = zagotoviPredajaKategorijaDokumentiSheet();
      el._osnutekPredOdprtjem = {
        plan: JSON.parse(JSON.stringify(plan)),
        podatkiKorak1: JSON.parse(JSON.stringify(opts.podatkiKorak1 || {})),
        prilogeKoraka: JSON.parse(JSON.stringify(prilogeKoraka || [])),
      };
      el._kategorijaTip = tip;
      izrisiPredajaKategorijaDokumentiTelo(el, step, tip);
      el.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      el.querySelector("#opomin-predaja-kategorija-dokumenti-sheet-naslov").focus();
    }

    function osveziPredajaKategorijaDokumentiSheetCeOdprt(step) {
      var el = document.getElementById("opomin-predaja-kategorija-dokumenti-sheet");
      if (!el || el.hidden) return;
      var tip = el._kategorijaTip || "invoice";
      izrisiPredajaKategorijaDokumentiTelo(el, step, tip);
    }


    /** Bottom-sheet "Končni pregled" (Faza 6) – zadnji, read-only korak pred
        dejansko predajo. Vsebina se izriše izključno iz preparedSnapshot
        (glej htmlKoncniPregledVsebina); ločen potrditveni gumb tu izvede
        pravo predajo, šele ko je (bodoča) strežniška operacija uspešna. */
    function zagotoviKoncniPregledSheet() {
      var el = document.getElementById("opomin-koncni-pregled-sheet");
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-koncni-pregled-sheet";
      el.className = "opomin-cas-sheet";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opomin-cas-sheet__backdrop" id="opomin-koncni-pregled-sheet-backdrop" aria-label="Zapri"></button>' +
        '<div class="opomin-cas-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="opomin-koncni-pregled-sheet-naslov">' +
        '<div class="opomin-cas-sheet__rocaj" aria-hidden="true"></div>' +
        '<div class="opomin-cas-sheet__glava">' +
        '<h2 class="opomin-cas-sheet__naslov" id="opomin-koncni-pregled-sheet-naslov" tabindex="-1">Končni pregled</h2>' +
        '<button type="button" class="opomin-cas-sheet__zapri" id="opomin-koncni-pregled-sheet-zapri" aria-label="Zapri">' +
        '<span aria-hidden="true">×</span></button>' +
        "</div>" +
        '<div class="opomin-cas-sheet__telo" id="opomin-koncni-pregled-sheet-telo"></div>' +
        '<div class="opomin-cas-sheet__noga" id="opomin-koncni-pregled-sheet-noga"></div>' +
        "</div>";
      document.body.appendChild(el);

      function zapri() {
        el.hidden = true;
        document.documentElement.classList.remove("uj-modal-odprt");
        document.body.classList.remove("uj-modal-odprt");
      }

      el.querySelector("#opomin-koncni-pregled-sheet-backdrop").addEventListener(
        "click",
        zapri
      );
      el.querySelector("#opomin-koncni-pregled-sheet-zapri").addEventListener(
        "click",
        zapri
      );
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") zapri();
      });
      el._zapri = zapri;
      return el;
    }

    function odpriKoncniPregledSheet(step) {
      var el = zagotoviKoncniPregledSheet();
      var telo = el.querySelector("#opomin-koncni-pregled-sheet-telo");
      var noga = el.querySelector("#opomin-koncni-pregled-sheet-noga");
      telo.innerHTML = htmlKoncniPregledVsebina(step);

      var lh = step.lawyerHandoff || {};
      var lahkoPredamo = N.moznaPredajaOdvetniku(lh);
      var zePredano = lh.status === "handed_over" && Boolean(lh.handedOverAt);

      if (zePredano) {
        noga.className = "opomin-cas-sheet__noga opomin-cas-sheet__noga--eno";
        noga.innerHTML =
          '<button type="button" class="opomin-cas-sheet__gumb opomin-cas-sheet__gumb--primarni" id="opomin-koncni-pregled-zapri-noga">Zapri</button>';
        noga
          .querySelector("#opomin-koncni-pregled-zapri-noga")
          .addEventListener("click", function () {
            el._zapri();
          });
      } else if (lahkoPredamo) {
        /* Status "handed_over" sme nastaviti IZKLJUČNO uspešen odgovor
           strežnika (glej izvediPredajoOdvetniku). Dokler opts.predajOdvetniku
           ni priključen, "Predaj odvetniku" ne sme biti klikljiv - drugače bi
           aplikacija prikazala "predano", čeprav ni bilo nič dejansko poslano. */
        var streznikPovezan = typeof opts.predajOdvetniku === "function";
        /* Ročna evidenca je enkratna – ko je enkrat zapisana, gumb izgine in
           ostane samo obstoječa oznaka (glej htmlKoncniPregledVsebina) z
           izvirnim datumom, da ga poznejši ponovni klik ne more prepisati. */
        var zeRocnoEvidentirano = Boolean(lh.manuallyConfirmedAt);
        noga.className = "opomin-cas-sheet__noga";
        noga.innerHTML =
          (streznikPovezan
            ? ""
            : '<p class="opomin-koncni-pregled__opozorilo opomin-koncni-pregled__opozorilo--info">Povezava za predajo še ni nastavljena.</p>') +
          '<button type="button" class="opomin-cas-sheet__gumb opomin-cas-sheet__gumb--obris" id="opomin-koncni-pregled-preklici">Prekliči</button>' +
          '<button type="button" class="opomin-cas-sheet__gumb opomin-cas-sheet__gumb--primarni" id="opomin-koncni-pregled-predaj"' +
          (streznikPovezan
            ? ""
            : ' disabled aria-disabled="true" title="Povezava za predajo še ni nastavljena."') +
          ">Predaj odvetniku</button>" +
          (!streznikPovezan && !zeRocnoEvidentirano
            ? '<button type="button" class="opomin-cas-sheet__gumb opomin-cas-sheet__gumb--sekundarni opomin-koncni-pregled__rocno-gumb" id="opomin-koncni-pregled-rocno">Označi kot ročno predano</button>'
            : "");
        noga
          .querySelector("#opomin-koncni-pregled-preklici")
          .addEventListener("click", function () {
            el._zapri();
          });
        var predajBtn = noga.querySelector("#opomin-koncni-pregled-predaj");
        if (streznikPovezan) {
          predajBtn.addEventListener("click", async function () {
            /* Brani pred dvojnim klikom - gumb se onemogoči takoj, sinhrono. */
            if (predajBtn.disabled) return;
            if (!N.moznaPredajaOdvetniku(step.lawyerHandoff)) {
              el._zapri();
              izrisiGlavni();
              return;
            }
            predajBtn.disabled = true;
            predajBtn.textContent = "Predajam …";
            try {
              await opts.predajOdvetniku(
                plan,
                step,
                step.lawyerHandoff.handoverIdempotencyKey
              );
              /* N.izvediPredajoOdvetniku (status "handed_over") se pokliče
                 samo tu, po uspešnem (resolved) odgovoru zgornjega klica. */
              plan = N.izvediPredajoOdvetniku(plan, step.index);
              shrani();
              el._zapri();
              izrisiGlavni();
            } catch (napaka) {
              predajBtn.disabled = false;
              predajBtn.textContent = "Predaj odvetniku";
              if (typeof opts.pokaziNapako === "function") {
                opts.pokaziNapako(
                  "Predaje ni bilo mogoče zaključiti. Poskusite znova.",
                  napaka && napaka.message ? napaka.message : ""
                );
              }
            }
          });
        }
        var rocnoBtn = noga.querySelector("#opomin-koncni-pregled-rocno");
        if (rocnoBtn) {
          rocnoBtn.addEventListener("click", async function () {
            /* Onemogoči takoj, sinhrono - brani pred dvojnim klikom, še preden
               se odpre potrditveno okno (ne zanašamo se samo na to, da deljeni
               modal prejšnji klic prekliče). */
            if (rocnoBtn.disabled) return;
            rocnoBtn.disabled = true;
            var potrjeno = true;
            if (typeof opts.potrdiVprasanje === "function") {
              potrjeno = await opts.potrdiVprasanje({
                naslov: "Označi kot ročno predano?",
                opis:
                  "Aplikacija ni poslala ničesar odvetniku. Potrdi samo, če si zadevo že sam izročil odvetniku (po pošti, e-pošti ali osebno).",
                potrdiBesedilo: "Da, ročno sem predal",
                prekliciBesedilo: "Prekliči",
                stil: "primary",
              });
            }
            if (!potrjeno) {
              rocnoBtn.disabled = false;
              return;
            }
            plan = N.oznaciRocnoPredanoOdvetniku(plan, step.index);
            shrani();
            el._zapri();
            izrisiGlavni();
          });
        }
      } else {
        noga.className = "opomin-cas-sheet__noga opomin-cas-sheet__noga--eno";
        noga.innerHTML =
          '<p class="opomin-koncni-pregled__opozorilo">Podatki so se spremenili po pripravi – pred predajo pripravi novo različico.</p>' +
          '<button type="button" class="opomin-cas-sheet__gumb opomin-cas-sheet__gumb--primarni" id="opomin-koncni-pregled-zapri-noga">Zapri</button>';
        noga
          .querySelector("#opomin-koncni-pregled-zapri-noga")
          .addEventListener("click", function () {
            el._zapri();
          });
      }

      el.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      el.querySelector("#opomin-koncni-pregled-sheet-naslov").focus();
    }

    function zagotoviCasSheet() {
      var el = document.getElementById("opomin-cas-sheet");
      if (el && !document.getElementById("opomin-cas-sheet-dnevi")) {
        el.remove();
        el = null;
      }
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-cas-sheet";
      el.className = "opomin-cas-sheet";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opomin-cas-sheet__backdrop" id="opomin-cas-sheet-backdrop" aria-label="Zapri"></button>' +
        '<div class="opomin-cas-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="opomin-cas-sheet-naslov">' +
        '<div class="opomin-cas-sheet__rocaj" aria-hidden="true"></div>' +
        '<div class="opomin-cas-sheet__glava">' +
        '<h2 class="opomin-cas-sheet__naslov" id="opomin-cas-sheet-naslov" tabindex="-1">Spremeni čas koraka</h2>' +
        '<button type="button" class="opomin-cas-sheet__zapri" id="opomin-cas-sheet-zapri" aria-label="Zapri"><span aria-hidden="true">×</span></button>' +
        "</div>" +
        '<div class="opomin-cas-sheet__telo">' +
        '<label class="opomin-cas-sheet__oznaka" id="opomin-cas-sheet-dnevi-label" for="opomin-cas-sheet-dnevi">Dnevi</label>' +
        '<div class="opomin-cas-sheet__casovna-vrstica">' +
        '<div class="opomin-cas-sheet__enota" role="group" aria-label="Enota časa" id="opomin-cas-sheet-enota">' +
        '<button type="button" class="opomin-cas-sheet__enota-gumb opomin-cas-sheet__enota-gumb--aktiven" data-enota="dan" id="opomin-cas-sheet-enota-dan">Dnevi</button>' +
        '<button type="button" class="opomin-cas-sheet__enota-gumb" data-enota="teden" id="opomin-cas-sheet-enota-teden">Tedni</button>' +
        '<button type="button" class="opomin-cas-sheet__enota-gumb" data-enota="mesec" id="opomin-cas-sheet-enota-mesec">Meseci</button>' +
        "</div>" +
        '<div class="opomin-nacrt__dnevi-krmilnik">' +
        '<button type="button" class="opomin-nacrt__dnevi-btn" id="opomin-cas-sheet-dnevi-minus" aria-label="Manj">−</button>' +
        '<input type="number" id="opomin-cas-sheet-dnevi" class="opomin-nacrt__dnevi-input" min="0" step="1" value="0" aria-label="Vrednost v izbrani enoti" />' +
        '<button type="button" class="opomin-nacrt__dnevi-btn" id="opomin-cas-sheet-dnevi-plus" aria-label="Več">+</button>' +
        "</div>" +
        "</div>" +
        '<div class="opomin-cas-sheet__cas-okvir">' +
        '<div class="opomin-cas-sheet__vrstica-2">' +
        '<div class="opomin-cas-sheet__polje">' +
        '<label class="opomin-cas-sheet__oznaka" for="opomin-cas-sheet-datum">Datum</label>' +
        '<div class="opomin-cas-sheet__datum-vrstica">' +
        '<input type="date" id="opomin-cas-sheet-datum" class="opomin-cas-sheet__input" />' +
        '<span class="opomin-cas-sheet__dan-crta" aria-hidden="true"></span>' +
        '<span class="opomin-cas-sheet__dan-tekst" id="opomin-cas-sheet-dan-tedna"></span>' +
        "</div>" +
        '<p class="opomin-cas-sheet__dnevi-opozorilo" id="opomin-cas-sheet-dnevi-opozorilo" hidden></p>' +
        "</div>" +
        '<div class="opomin-cas-sheet__polje">' +
        '<label class="opomin-cas-sheet__oznaka" for="opomin-cas-sheet-ura">Ura</label>' +
        '<div class="opomin-cas-sheet__datum-vrstica">' +
        '<input type="time" id="opomin-cas-sheet-ura" class="opomin-cas-sheet__input" />' +
        '<span class="opomin-cas-sheet__dan-crta" aria-hidden="true"></span>' +
        '<span class="opomin-cas-sheet__dan-tekst" id="opomin-cas-sheet-ura-obdobje"></span>' +
        "</div>" +
        '<p class="opomin-cas-sheet__ura-napaka" id="opomin-cas-sheet-ura-napaka" role="alert" hidden></p>' +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="opomin-cas-sheet__stikalo-ovoj" id="opomin-cas-sheet-stikalo-ovoj">' +
        '<button type="button" class="opomin-nacrt__switch opomin-nacrt__switch--on" id="opomin-cas-sheet-shift" role="switch" aria-checked="true" aria-label="Prestavi tudi naslednje korake">' +
        '<span class="opomin-nacrt__switch-gumb" aria-hidden="true"></span></button>' +
        '<div class="opomin-cas-sheet__stikalo-tekst">' +
        '<p class="opomin-cas-sheet__stikalo-naslov">Prestavi tudi naslednje korake</p>' +
        '<p class="opomin-cas-sheet__stikalo-opis" id="opomin-cas-sheet-stikalo-opis">Naslednji koraki se premaknejo za enako število dni.</p>' +
        "</div></div>" +
        '<div class="opomin-cas-sheet__bliznjice">' +
        '<p class="opomin-cas-sheet__bliznjice-namig">Predlogi za hitro izbiro</p>' +
        '<div class="opomin-cas-sheet__bliznjice-vrstica">' +
        '<button type="button" class="opomin-cas-sheet__bliznjica-dodaj" id="opomin-cas-sheet-bliznjica-plus" aria-label="Dodaj bližnjico">+</button>' +
        '<div class="opomin-cas-sheet__bliznjice-scroll" id="opomin-cas-sheet-bliznjice-vrstica"></div>' +
        "</div>" +
        '<div class="opomin-cas-sheet__bliznjica-forma" id="opomin-cas-sheet-bliznjica-forma" hidden>' +
        '<span class="opomin-cas-sheet__bliznjica-enota-prikaz" id="opomin-cas-sheet-bliznjica-enota-prikaz" aria-live="polite"></span>' +
        '<span class="opomin-cas-sheet__bliznjica-ob">ob</span>' +
        '<input type="time" id="opomin-cas-sheet-bliznjica-ura" class="opomin-cas-sheet__bliznjica-input" aria-label="Ura bližnjice" />' +
        '<button type="button" class="opomin-cas-sheet__bliznjica-shrani" id="opomin-cas-sheet-bliznjica-shrani">Shrani</button>' +
        "</div>" +
        "</div>" +
        '<div class="opomin-cas-sheet__dovoljeno-okno" aria-labelledby="opomin-cas-sheet-dovoljeno-naslov">' +
        '<span class="opomin-cas-sheet__dovoljeno-ikona" aria-hidden="true">◷</span>' +
        '<span class="opomin-cas-sheet__dovoljeno-besedilo"><strong id="opomin-cas-sheet-dovoljeno-naslov">Dovoljen čas pošiljanja</strong><small>Sistem ne bo poslal sporočila zunaj tega časa.</small></span>' +
        '<label class="opomin-cas-sheet__dovoljeno-cas"><span class="sr-only">Najprej ob</span><input type="time" id="opomin-cas-sheet-dovoljeno-od" value="07:00" aria-label="Pošiljanje dovoljeno od" /></label>' +
        '<span class="opomin-cas-sheet__dovoljeno-locilo" aria-hidden="true">–</span>' +
        '<label class="opomin-cas-sheet__dovoljeno-cas"><span class="sr-only">Najpozneje ob</span><input type="time" id="opomin-cas-sheet-dovoljeno-do" value="21:00" aria-label="Pošiljanje dovoljeno do" /></label>' +
        "</div>" +
        '<div class="opomin-cas-sheet__okno-obseg" role="group" aria-label="Za katere korake velja dovoljen čas">' +
        '<button type="button" class="opomin-cas-sheet__okno-obseg-gumb opomin-cas-sheet__okno-obseg-gumb--aktiven" data-okno-obseg="vsi" aria-pressed="true">Vsi koraki</button>' +
        '<button type="button" class="opomin-cas-sheet__okno-obseg-gumb" data-okno-obseg="korak" aria-pressed="false">Samo ta korak</button>' +
        "</div>" +
        "</div>" +
        '<div class="opomin-cas-sheet__sporocila" aria-live="polite">' +
        '<p class="opomin-cas-sheet__okno-obseg-opis" id="opomin-cas-sheet-okno-obseg-opis"></p>' +
        '<p class="opomin-cas-sheet__predogled" id="opomin-cas-sheet-predogled"></p>' +
        '<p class="opomin-cas-sheet__napaka" id="opomin-cas-sheet-napaka" hidden></p>' +
        "</div>" +
        '<div class="opomin-cas-sheet__noga">' +
        '<button type="button" class="opomin-cas-sheet__gumb opomin-cas-sheet__gumb--obris" id="opomin-cas-sheet-preklici">Prekliči</button>' +
        '<button type="button" class="opomin-cas-sheet__gumb opomin-cas-sheet__gumb--primarni" id="opomin-cas-sheet-shrani">Shrani</button>' +
        "</div></div>";
      document.body.appendChild(el);

      function zapri() {
        el.hidden = true;
        casSheetIndex = null;
        casSheetBaseIndex = null;
        casSheetNacin = "trenutni";
        casSheetOknoObseg = "vsi";
        document.documentElement.classList.remove("uj-modal-odprt");
        document.body.classList.remove("uj-modal-odprt");
      }

      function preberiIsoIzPolj() {
        var datumEl = document.getElementById("opomin-cas-sheet-datum");
        var uraEl = document.getElementById("opomin-cas-sheet-ura");
        if (!datumEl || !uraEl) return null;
        return isoIzDateInTime(datumEl.value, uraEl.value);
      }

      function preberiDovoljenoOknoIzPolj() {
        var odEl = document.getElementById("opomin-cas-sheet-dovoljeno-od");
        var doEl = document.getElementById("opomin-cas-sheet-dovoljeno-do");
        var od = (odEl && odEl.value) || "07:00";
        var doCasa = (doEl && doEl.value) || "21:00";
        var odMinute = randomMinuteIzCasa(od);
        var doMinute = randomMinuteIzCasa(doCasa);
        return {
          start: od,
          end: doCasa,
          startMinutes: odMinute,
          endMinutes: doMinute,
          ok:
            Number.isFinite(odMinute) &&
            Number.isFinite(doMinute) &&
            doMinute > odMinute,
        };
      }

      function uporabiDovoljenoOknoKotMejo() {
        var okno = preberiDovoljenoOknoIzPolj();
        var odEl = document.getElementById("opomin-cas-sheet-dovoljeno-od");
        var doEl = document.getElementById("opomin-cas-sheet-dovoljeno-do");
        var uraEl = document.getElementById("opomin-cas-sheet-ura");
        var bliznjicaUraEl = document.getElementById(
          "opomin-cas-sheet-bliznjica-ura"
        );
        if (odEl) odEl.max = (doEl && doEl.value) || "";
        if (doEl) doEl.min = (odEl && odEl.value) || "";
        if (!okno.ok) return okno;
        [uraEl, bliznjicaUraEl].forEach(function (polje) {
          if (!polje) return;
          polje.min = okno.start;
          polje.max = okno.end;
          if (jeUraZnotrajDovoljenegaOkna(polje.value, okno)) {
            polje.dataset.ujZadnjaDovoljenaUra = polje.value;
          } else {
            delete polje.dataset.ujZadnjaDovoljenaUra;
          }
        });
        return okno;
      }

      function planZNovoMejoZaPredogled(okno) {
        var kopija;
        try {
          kopija = JSON.parse(JSON.stringify(plan));
        } catch (_napaka) {
          return plan;
        }
        if (
          casSheetOknoObseg === "korak" &&
          typeof N.nastaviDovoljenoOknoKoraka === "function"
        ) {
          return N.nastaviDovoljenoOknoKoraka(
            kopija,
            casSheetIndex,
            okno.start,
            okno.end
          );
        }
        if (typeof N.nastaviDovoljenoOkno === "function") {
          return N.nastaviDovoljenoOkno(
            kopija,
            okno.start,
            okno.end
          );
        }
        return kopija;
      }

      function prikaziNapakoUre(message) {
        var opozorilo = document.getElementById("opomin-cas-sheet-ura-napaka");
        if (!opozorilo) return;
        opozorilo.textContent = message || "";
        opozorilo.hidden = !message;
      }

      function osveziGumbaObsega() {
        el.querySelectorAll("[data-okno-obseg]").forEach(function (gumb) {
          var aktiven = gumb.getAttribute("data-okno-obseg") === casSheetOknoObseg;
          gumb.classList.toggle(
            "opomin-cas-sheet__okno-obseg-gumb--aktiven",
            aktiven
          );
          gumb.setAttribute("aria-pressed", aktiven ? "true" : "false");
        });
        var opis = document.getElementById("opomin-cas-sheet-okno-obseg-opis");
        if (opis) {
          opis.classList.toggle(
            "opomin-cas-sheet__okno-obseg-opis--opozorilo",
            casSheetOknoObseg === "korak"
          );
          opis.textContent =
            casSheetOknoObseg === "korak"
              ? "Velja samo za ta korak. Drugi koraki ostanejo nespremenjeni."
              : "Velja za vse SMS-korake. Posamezne omejitve bodo zamenjane.";
        }
      }

      function naloziOknoZaIzbraniObseg() {
        var korak = N.najdiKorak(plan, casSheetIndex);
        var okno =
          casSheetOknoObseg === "korak"
            ? dovoljenoOknoKoraka(plan, korak)
            : dovoljenoOknoPlana(plan);
        var odEl = document.getElementById("opomin-cas-sheet-dovoljeno-od");
        var doEl = document.getElementById("opomin-cas-sheet-dovoljeno-do");
        var uraPolje = document.getElementById("opomin-cas-sheet-ura");
        if (odEl) odEl.value = okno.start;
        if (doEl) doEl.value = okno.end;
        uporabiDovoljenoOknoKotMejo();
        osveziGumbaObsega();
        osveziPredogled();
        posodobiPovzetekIzbire();
      }

      function preveriDovoljenoOkno(iso) {
        var okno = preberiDovoljenoOknoIzPolj();
        if (!okno.ok) {
          return "Končna dovoljena ura mora biti poznejša od začetne.";
        }
        var datum = iso ? new Date(iso) : null;
        if (datum && !Number.isNaN(datum.getTime())) {
          var minute = datum.getHours() * 60 + datum.getMinutes();
          if (minute < okno.startMinutes || minute > okno.endMinutes) {
            return (
              "Sporočilo je dovoljeno poslati med " +
              okno.start +
              " in " +
              okno.end +
              "."
            );
          }
        }
        return "";
      }

      function syncDatumIzDni() {
        var dneviEl = document.getElementById("opomin-cas-sheet-dnevi");
        var datumEl = document.getElementById("opomin-cas-sheet-datum");
        var uraEl = document.getElementById("opomin-cas-sheet-ura");
        if (!dneviEl || !datumEl || !uraEl || casSheetIndex == null) return;
        var dnevi = Math.max(0, Math.round(Number(dneviEl.value) || 0));
        dneviEl.value = String(dnevi);
        var ura = uraEl.value || "12:00";
        if (casSheetNacin === "naslednji") {
          var bazaStep = N.najdiKorak(plan, casSheetBaseIndex);
          var osnovni = bazaStep
            ? new Date(bazaStep.sendAt || bazaStep.scheduledAt)
            : new Date();
          if (Number.isNaN(osnovni.getTime())) osnovni = new Date();
          var nov = new Date(osnovni.getTime());
          nov.setDate(nov.getDate() + dnevi);
          datumEl.value = isoZaDateInput(nov.toISOString());
          var ure = String(ura).split(":").map(Number);
          nov.setHours(ure[0] || 0, ure[1] || 0, 0, 0);
        } else {
          var iso = isoIzDniOdDanes(dnevi, null);
          datumEl.value = isoZaDateInput(iso);
          var ure2 = String(ura).split(":").map(Number);
          var d2 = new Date(iso);
          d2.setHours(ure2[0] || 0, ure2[1] || 0, 0, 0);
          datumEl.value = isoZaDateInput(d2.toISOString());
        }
      }

      function syncDneviIzDatuma() {
        var dneviEl = document.getElementById("opomin-cas-sheet-dnevi");
        var datumEl = document.getElementById("opomin-cas-sheet-datum");
        var uraEl = document.getElementById("opomin-cas-sheet-ura");
        if (!dneviEl || !datumEl || !uraEl || !datumEl.value) return;
        var iso = isoIzDateInTime(datumEl.value, uraEl.value || "12:00");
        if (!iso) return;
        if (casSheetNacin === "naslednji") {
          var bazaStep = N.najdiKorak(plan, casSheetBaseIndex);
          var osnovniIso =
            (bazaStep && (bazaStep.sendAt || bazaStep.scheduledAt)) || null;
          var raz =
            typeof N.koledarskiDneviMed === "function"
              ? N.koledarskiDneviMed(osnovniIso, iso)
              : dneviOdDanes(iso);
          dneviEl.value = String(Math.max(0, Number(raz) || 0));
        } else {
          dneviEl.value = String(dneviOdDanes(iso));
        }
      }

      function osveziPredogled() {
        var predogled = document.getElementById("opomin-cas-sheet-predogled");
        var napakaEl = document.getElementById("opomin-cas-sheet-napaka");
        var shraniBtn = document.getElementById("opomin-cas-sheet-shrani");
        if (casSheetIndex == null) return;
        var iso = preberiIsoIzPolj();
        var dovoljenoOkno = uporabiDovoljenoOknoKotMejo();
        var napakaOkna = preveriDovoljenoOkno(iso);
        prikaziNapakoUre(napakaOkna);
        var predogledPlan = dovoljenoOkno.ok
          ? planZNovoMejoZaPredogled(dovoljenoOkno)
          : plan;
        var v = napakaOkna
          ? { ok: false, napaka: napakaOkna, preview: {} }
          : N.validirajCasKoraka
          ? N.validirajCasKoraka(
              predogledPlan,
              casSheetIndex,
              iso,
              casSheetShiftFollowing,
              { gapDays: izbraniGapDni() }
            )
          : { ok: true, napaka: null, preview: {} };
        if (napakaEl) {
          if (v.napaka && !napakaOkna) {
            napakaEl.hidden = false;
            napakaEl.textContent = v.napaka;
          } else {
            napakaEl.hidden = true;
            napakaEl.textContent = "";
          }
        }
        if (shraniBtn) shraniBtn.disabled = !v.ok;
        if (!predogled) return;
        var p = v.preview || {};
        var imaNaslednje = Boolean(N.najdiKorak(plan, casSheetIndex + 1));
        if (!imaNaslednje) {
          predogled.textContent = "";
          return;
        }
        if (casSheetShiftFollowing) {
          var n = p.shiftedCount || 0;
          var zadnji = p.lastSendAt ? formatCasPolno(p.lastSendAt) : "";
          predogled.textContent =
            (n === 1
              ? "Premaknjen bo 1 korak."
              : n === 2
                ? "Premaknjena bosta 2 koraka."
                : "Premaknjeni bodo " + n + " koraki.") +
            (zadnji ? " Zadnji korak bo " + zadnji + "." : "");
        } else {
          predogled.textContent = "";
        }
      }

      el.querySelector("#opomin-cas-sheet-backdrop").addEventListener(
        "click",
        zapri
      );
      el.querySelector("#opomin-cas-sheet-zapri").addEventListener("click", zapri);
      el.querySelector("#opomin-cas-sheet-preklici").addEventListener(
        "click",
        zapri
      );

      var shiftBtn = el.querySelector("#opomin-cas-sheet-shift");
      var shiftOvoj = el.querySelector("#opomin-cas-sheet-stikalo-ovoj");
      function preklopiPremikNaslednjih() {
        if (!shiftBtn || shiftBtn.disabled) return;
        casSheetShiftFollowing = !casSheetShiftFollowing;
        shiftBtn.classList.toggle(
          "opomin-nacrt__switch--on",
          casSheetShiftFollowing
        );
        shiftBtn.setAttribute(
          "aria-checked",
          casSheetShiftFollowing ? "true" : "false"
        );
        osveziPredogled();
      }
      if (shiftBtn) {
        shiftBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          preklopiPremikNaslednjih();
        });
      }
      if (shiftOvoj) {
        shiftOvoj.addEventListener("click", function () {
          preklopiPremikNaslednjih();
        });
      }

      var dneviMinus = el.querySelector("#opomin-cas-sheet-dnevi-minus");
      var dneviPlus = el.querySelector("#opomin-cas-sheet-dnevi-plus");
      var dneviInput = el.querySelector("#opomin-cas-sheet-dnevi");
      var enotaGumbi = el.querySelectorAll(".opomin-cas-sheet__enota-gumb");
      var uraEl = el.querySelector("#opomin-cas-sheet-ura");

      /* Razmik v PRAVIH dnevih (pretvorba iz izbrane enote) - uporabi se kot
         enotni interval za vse naslednje korake, ko je stikalo
         "Prestavi tudi naslednje korake" vklopljeno. */
      function trenutniGapDni() {
        if (!dneviInput) return null;
        var v = Math.max(0, Math.round(Number(dneviInput.value) || 0));
        return Math.max(0, Math.round(pretvoriEnotoVDneve(v, casSheetEnota)));
      }

      function izbraniGapDni() {
        var g = trenutniGapDni();
        return g != null && g > 0 ? g : null;
      }

      function trenutnaUraHHMM() {
        var d = new Date();
        var h = String(d.getHours()).padStart(2, "0");
        var m = String(d.getMinutes()).padStart(2, "0");
        return h + ":" + m;
      }

      /* Če je izbran "danes" (0 dni) in uporabnik ure še ni ročno nastavil,
         privzeto uro postavimo na trenutno uro (namesto fiksne 12.00). Če
         uporabnik uro ročno spremeni, spoštujemo njegovo izbiro naprej. */
      function posodobiUraCeDanes(trueDays) {
        if (uraRocnoNastavljena || !uraEl) return;
        if (trueDays === 0) {
          var prejsnjaUra = uraEl.value;
          uraEl.value = trenutnaUraHHMM();
          var okno = preberiDovoljenoOknoIzPolj();
          if (
            okno.ok &&
            !zavrniNedovoljenoPoljeUre(uraEl, okno, prikaziNapakoUre)
          ) {
            uraEl.value = prejsnjaUra;
          }
        }
      }

      /* vEnoti je vrednost v TRENUTNI izbrani enoti (dan/teden/mesec).
         #opomin-cas-sheet-dnevi mora ob klicu syncDatumIzDni/syncDneviIzDatuma
         vedno vsebovati pravo število DNI (ta dva ostajata nespremenjena),
         zato tu pretvorimo v dneve, pokličemo sync, nato prikaz nazaj
         pretvorimo v izbrano enoto. */
      function primeniEnotoVrednost(vEnoti) {
        if (!dneviInput) return;
        var trueDays = Math.min(
          365,
          pretvoriEnotoVDneve(vEnoti, casSheetEnota)
        );
        posodobiUraCeDanes(trueDays);
        dneviInput.value = String(trueDays);
        syncDatumIzDni();
        dneviInput.value = String(
          pretvoriDneveVEnoto(Number(dneviInput.value) || 0, casSheetEnota)
        );
        osveziPredogled();
        posodobiBliznjicaPrikaz();
        posodobiPovzetekIzbire();
      }

      function posodobiAktivnoEnoto() {
        enotaGumbi.forEach(function (g) {
          g.classList.toggle(
            "opomin-cas-sheet__enota-gumb--aktiven",
            g.getAttribute("data-enota") === casSheetEnota
          );
        });
      }

      function izberiEnoto(novaEnota) {
        if (!dneviInput || novaEnota === casSheetEnota) return;
        var trenutniDnevi = pretvoriEnotoVDneve(
          Number(dneviInput.value) || 0,
          casSheetEnota
        );
        casSheetEnota = novaEnota;
        posodobiUraCeDanes(trenutniDnevi);
        dneviInput.value = String(Math.min(365, trenutniDnevi));
        syncDatumIzDni();
        dneviInput.value = String(
          pretvoriDneveVEnoto(Number(dneviInput.value) || 0, casSheetEnota)
        );
        posodobiAktivnoEnoto();
        osveziPredogled();
        posodobiBliznjicaPrikaz();
        posodobiPovzetekIzbire();
      }

      enotaGumbi.forEach(function (g) {
        g.addEventListener("click", function () {
          prekiniAktivnoBliznjico();
          izberiEnoto(g.getAttribute("data-enota"));
        });
      });

      var bliznjiceVrstica = el.querySelector(
        "#opomin-cas-sheet-bliznjice-vrstica"
      );
      var bliznjicaPlus = el.querySelector("#opomin-cas-sheet-bliznjica-plus");
      var bliznjicaForma = el.querySelector("#opomin-cas-sheet-bliznjica-forma");
      var bliznjicaUra = el.querySelector("#opomin-cas-sheet-bliznjica-ura");
      var bliznjicaEnotaPrikaz = el.querySelector(
        "#opomin-cas-sheet-bliznjica-enota-prikaz"
      );
      var bliznjicaShrani = el.querySelector(
        "#opomin-cas-sheet-bliznjica-shrani"
      );
      var povzetekIzbireEl = el.querySelector(
        "#opomin-cas-sheet-povzetek-izbire"
      );

      function oznakaEnoteStevila(n, enota) {
        n = Math.max(0, Math.round(Number(n) || 0));
        if (enota === "teden") {
          if (n === 1) return n + " teden";
          if (n === 2) return n + " tedna";
          if (n === 3 || n === 4) return n + " tedne";
          return n + " tednov";
        }
        if (enota === "mesec") {
          if (n === 1) return n + " mesec";
          if (n === 2) return n + " meseca";
          if (n === 3 || n === 4) return n + " mesece";
          return n + " mesecev";
        }
        if (n === 1) return n + " dan";
        return n + " dni";
      }

      function posodobiBliznjicaPrikaz() {
        if (!bliznjicaEnotaPrikaz || !dneviInput) return;
        bliznjicaEnotaPrikaz.textContent = oznakaEnoteStevila(
          dneviInput.value,
          casSheetEnota
        );
      }

      var DNEVI_V_TEDNU = [
        "Nedelja",
        "Ponedeljek",
        "Torek",
        "Sreda",
        "Četrtek",
        "Petek",
        "Sobota",
      ];

      function posodobiPovzetekIzbire() {
        if (!dneviInput || !uraEl) return;
        var vEnoti = Number(dneviInput.value) || 0;
        var ura = uraEl.value || "12:00";
        var besedilo =
          vEnoti === 0 && casSheetEnota === "dan"
            ? "Danes ob " + ura
            : "Čez " + oznakaEnoteStevila(vEnoti, casSheetEnota) + " ob " + ura;
        if (povzetekIzbireEl) povzetekIzbireEl.textContent = besedilo;

        var danTednaEl = el.querySelector("#opomin-cas-sheet-dan-tedna");
        var datumElZa = el.querySelector("#opomin-cas-sheet-datum");
        var danOpozoriloEl = el.querySelector("#opomin-cas-sheet-dnevi-opozorilo");
        if (danTednaEl && datumElZa && datumElZa.value) {
          var d = new Date(datumElZa.value + "T12:00:00");
          var danIme = Number.isNaN(d.getTime()) ? "" : DNEVI_V_TEDNU[d.getDay()];
          danTednaEl.textContent = danIme;
          /* Preveri, ali je izbrani dan med aktivnimi dnevi. */
          if (danOpozoriloEl && !Number.isNaN(d.getTime())) {
            var aktivni = (plan._aktivniDnevi && plan._aktivniDnevi.length === 7)
              ? plan._aktivniDnevi
              : [true, true, true, true, true, true, true];
            var sloIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
            if (!aktivni[sloIdx]) {
              var naslDan = "";
              for (var adi = 1; adi <= 7; adi++) {
                var ni = (sloIdx + adi) % 7;
                if (aktivni[ni]) {
                  var DNEVI_SLO = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];
                  naslDan = DNEVI_SLO[ni];
                  break;
                }
              }
              danOpozoriloEl.hidden = false;
              danOpozoriloEl.textContent =
                danIme + " ni na voljo za pošiljanje. Naslednji možen dan: " + naslDan + ".";
            } else {
              danOpozoriloEl.hidden = true;
            }
          }
        }

        var uraObdobjeEl = el.querySelector("#opomin-cas-sheet-ura-obdobje");
        if (uraObdobjeEl) {
          uraObdobjeEl.textContent = ura;
        }
      }

      var aktivnaBliznjica = null;
      var aktivnaBliznjicaIndex = -1;
      var stanjePredBliznjico = null;

      function posnetekPredBliznjico() {
        var datum = el.querySelector("#opomin-cas-sheet-datum");
        return {
          enota: casSheetEnota,
          vrednost: dneviInput ? dneviInput.value : "0",
          datum: datum ? datum.value : "",
          ura: uraEl ? uraEl.value : "",
          uraRocno: uraRocnoNastavljena,
        };
      }

      function obnoviStanjePredBliznjico() {
        if (!stanjePredBliznjico) return;
        var datum = el.querySelector("#opomin-cas-sheet-datum");
        casSheetEnota = stanjePredBliznjico.enota || "dan";
        if (dneviInput) dneviInput.value = stanjePredBliznjico.vrednost;
        if (datum) datum.value = stanjePredBliznjico.datum;
        if (uraEl) uraEl.value = stanjePredBliznjico.ura;
        uraRocnoNastavljena = Boolean(stanjePredBliznjico.uraRocno);
        posodobiAktivnoEnoto();
        osveziPredogled();
        posodobiBliznjicaPrikaz();
        posodobiPovzetekIzbire();
      }

      function prekiniAktivnoBliznjico() {
        if (!aktivnaBliznjica) return;
        aktivnaBliznjica = null;
        aktivnaBliznjicaIndex = -1;
        stanjePredBliznjico = null;
        izrisiBliznjice();
      }

      function uporabiBliznjico(b, i) {
        if (!dneviInput || !uraEl || !b) return;
        if (aktivnaBliznjicaIndex === i) {
          obnoviStanjePredBliznjico();
          aktivnaBliznjica = null;
          aktivnaBliznjicaIndex = -1;
          stanjePredBliznjico = null;
          izrisiBliznjice();
          return;
        }
        if (!aktivnaBliznjica) stanjePredBliznjico = posnetekPredBliznjico();
        casSheetEnota = "dan";
        posodobiAktivnoEnoto();
        var oknoBliznjice = preberiDovoljenoOknoIzPolj();
        var izbranaUraBliznjice = b.ura || "12:00";
        if (
          oknoBliznjice.ok &&
          !jeUraZnotrajDovoljenegaOkna(
            izbranaUraBliznjice,
            oknoBliznjice
          )
        ) {
          prikaziNapako(
            besediloNedovoljeneUre(
              izbranaUraBliznjice,
              oknoBliznjice
            )
          );
          return;
        }
        uraEl.value = izbranaUraBliznjice;
        uraEl.dataset.ujZadnjaDovoljenaUra = izbranaUraBliznjice;
        uraRocnoNastavljena = true;
        dneviInput.value = String(Math.max(0, Number(b.dnevi) || 0));
        syncDatumIzDni();
        osveziPredogled();
        aktivnaBliznjica = b;
        aktivnaBliznjicaIndex = i;
        izrisiBliznjice();
      }

      function izrisiBliznjice() {
        if (!bliznjiceVrstica) return;
        var seznam = preberiCasBliznjice();
        bliznjiceVrstica.innerHTML = "";
        seznam.forEach(function (b, i) {
          var chip = document.createElement("button");
          chip.type = "button";
          chip.className =
            "opomin-cas-sheet__bliznjica" +
            (i === aktivnaBliznjicaIndex
              ? " opomin-cas-sheet__bliznjica--aktivna"
              : "");
          chip.setAttribute(
            "aria-pressed",
            i === aktivnaBliznjicaIndex ? "true" : "false"
          );
          var oznakaBliznjice =
            (b.ura || "") +
            " · " +
            (Number(b.dnevi) === 0
              ? "danes"
              : "čez " + b.dnevi + (Number(b.dnevi) === 1 ? " dan" : " dni"));
          chip.setAttribute(
            "aria-label",
            "Uporabi bližnjico " + oznakaBliznjice
          );
          chip.addEventListener("click", function () {
            if (bliznjiceVrstica && bliznjiceVrstica._ujJeDrsela) {
              bliznjiceVrstica._ujJeDrsela = false;
              return;
            }
            uporabiBliznjico(b, i);
          });
          var besedilo = document.createElement("span");
          besedilo.className = "opomin-cas-sheet__bliznjica-besedilo";
          besedilo.textContent = oznakaBliznjice;
          chip.appendChild(besedilo);
          var odstrani = document.createElement("span");
          odstrani.className = "opomin-cas-sheet__bliznjica-x";
          odstrani.setAttribute("aria-hidden", "true");
          odstrani.textContent = "×";
          odstrani.addEventListener("click", function (ev) {
            ev.stopPropagation();
            var trenutni = preberiCasBliznjice();
            trenutni.splice(i, 1);
            shraniCasBliznjice(trenutni);
            if (i === aktivnaBliznjicaIndex) {
              aktivnaBliznjica = null;
              aktivnaBliznjicaIndex = -1;
              stanjePredBliznjico = null;
            } else if (i < aktivnaBliznjicaIndex) {
              aktivnaBliznjicaIndex -= 1;
            }
            izrisiBliznjice();
          });
          chip.appendChild(odstrani);
          bliznjiceVrstica.appendChild(chip);
        });
      }

      if (bliznjiceVrstica) {
        var bliznjiceScrollZacetek = 0;
        bliznjiceVrstica.addEventListener("pointerdown", function () {
          bliznjiceScrollZacetek = bliznjiceVrstica.scrollLeft;
          bliznjiceVrstica._ujJeDrsela = false;
        });
        bliznjiceVrstica.addEventListener("scroll", function () {
          if (
            Math.abs(bliznjiceVrstica.scrollLeft - bliznjiceScrollZacetek) > 6
          ) {
            bliznjiceVrstica._ujJeDrsela = true;
          }
        });
      }

      el._ujPonastaviBliznjico = function () {
        aktivnaBliznjica = null;
        aktivnaBliznjicaIndex = -1;
        stanjePredBliznjico = null;
        izrisiBliznjice();
      };

      if (bliznjicaPlus && bliznjicaForma) {
        bliznjicaPlus.addEventListener("click", function () {
          var odprto = !bliznjicaForma.hidden;
          bliznjicaForma.hidden = odprto;
          if (!odprto) {
            if (bliznjicaUra) {
              bliznjicaUra.value = (uraEl && uraEl.value) || "12:00";
              bliznjicaUra.dataset.ujZadnjaDovoljenaUra =
                bliznjicaUra.value;
            }
            posodobiBliznjicaPrikaz();
        posodobiPovzetekIzbire();
          }
        });
      }

      if (bliznjicaShrani) {
        bliznjicaShrani.addEventListener("click", function () {
          var oknoBliznjice = preberiDovoljenoOknoIzPolj();
          if (
            oknoBliznjice.ok &&
            !zavrniNedovoljenoPoljeUre(
              bliznjicaUra,
              oknoBliznjice,
              prikaziNapakoUre
            )
          ) {
            if (bliznjicaUra) bliznjicaUra.focus();
            return;
          }
          var ura = (bliznjicaUra && bliznjicaUra.value) || "";
          if (!ura) {
            if (bliznjicaUra) bliznjicaUra.focus();
            return;
          }
          var dnevi = pretvoriEnotoVDneve(
            Number((dneviInput && dneviInput.value) || 0),
            casSheetEnota
          );
          var seznam = preberiCasBliznjice();
          seznam.push({ ura: ura, dnevi: dnevi });
          shraniCasBliznjice(seznam);
          if (bliznjicaForma) bliznjicaForma.hidden = true;
          izrisiBliznjice();
        });
      }

      izrisiBliznjice();
      posodobiBliznjicaPrikaz();
      posodobiPovzetekIzbire();

      if (dneviMinus) {
        dneviMinus.addEventListener("click", function () {
          if (!dneviInput) return;
          prekiniAktivnoBliznjico();
          primeniEnotoVrednost(
            Math.max(0, (Number(dneviInput.value) || 0) - 1)
          );
        });
      }
      if (dneviPlus) {
        dneviPlus.addEventListener("click", function () {
          if (!dneviInput) return;
          prekiniAktivnoBliznjico();
          primeniEnotoVrednost((Number(dneviInput.value) || 0) + 1);
        });
      }
      if (dneviInput) {
        dneviInput.addEventListener("input", function () {
          prekiniAktivnoBliznjico();
          /* Pri enoti "dan" je prikazana vrednost enaka pravim dnem, zato lahko
             sproti (med tipkanjem) osvežimo datum/predogled brez prepisa polja.
             Pri tednih/mesecih pretvorbo naredimo šele ob "change" (blur/enter),
             da med tipkanjem ne skačemo kurzorja s prepisom vrednosti. */
          if (casSheetEnota === "dan") {
            posodobiUraCeDanes(Math.max(0, Number(dneviInput.value) || 0));
            syncDatumIzDni();
            osveziPredogled();
            posodobiBliznjicaPrikaz();
        posodobiPovzetekIzbire();
          }
        });
        dneviInput.addEventListener("change", function () {
          primeniEnotoVrednost(Number(dneviInput.value) || 0);
        });
      }

      if (uraEl) {
        uraEl.addEventListener("input", function () {
          prekiniAktivnoBliznjico();
          var okno = preberiDovoljenoOknoIzPolj();
          if (
            okno.ok &&
            !zavrniNedovoljenoPoljeUre(uraEl, okno, prikaziNapakoUre)
          ) return;
          prikaziNapakoUre("");
          uraRocnoNastavljena = true;
          osveziPredogled();
          posodobiPovzetekIzbire();
        });
        uraEl.addEventListener("change", function () {
          var okno = preberiDovoljenoOknoIzPolj();
          if (
            okno.ok &&
            !zavrniNedovoljenoPoljeUre(uraEl, okno, prikaziNapakoUre)
          ) return;
          prikaziNapakoUre("");
          uraRocnoNastavljena = true;
          osveziPredogled();
          posodobiPovzetekIzbire();
        });
      }
      if (bliznjicaUra) {
        function preveriBliznjicaUro() {
          var okno = preberiDovoljenoOknoIzPolj();
          if (okno.ok) {
            zavrniNedovoljenoPoljeUre(
              bliznjicaUra,
              okno,
              prikaziNapakoUre
            );
          }
        }
        bliznjicaUra.addEventListener("input", preveriBliznjicaUro);
        bliznjicaUra.addEventListener("change", preveriBliznjicaUro);
      }
      ["opomin-cas-sheet-dovoljeno-od", "opomin-cas-sheet-dovoljeno-do"].forEach(
        function (id) {
          var polje = el.querySelector("#" + id);
          if (!polje) return;
          function osveziMejeInPredogled() {
            uporabiDovoljenoOknoKotMejo();
            osveziPredogled();
            posodobiPovzetekIzbire();
          }
          polje.addEventListener("input", osveziMejeInPredogled);
          polje.addEventListener("change", osveziMejeInPredogled);
        }
      );
      el.querySelectorAll("[data-okno-obseg]").forEach(function (gumb) {
        gumb.addEventListener("click", function () {
          casSheetOknoObseg =
            gumb.getAttribute("data-okno-obseg") === "korak" ? "korak" : "vsi";
          naloziOknoZaIzbraniObseg();
        });
      });
      el._ujOsveziGumbaObsega = osveziGumbaObsega;
      var datumEl = el.querySelector("#opomin-cas-sheet-datum");
      if (datumEl) {
        datumEl.addEventListener("input", function () {
          prekiniAktivnoBliznjico();
          syncDneviIzDatuma();
          if (dneviInput) {
            dneviInput.value = String(
              pretvoriDneveVEnoto(Number(dneviInput.value) || 0, casSheetEnota)
            );
          }
          osveziPredogled();
          posodobiPovzetekIzbire();
        });
        datumEl.addEventListener("change", function () {
          syncDneviIzDatuma();
          if (dneviInput) {
            dneviInput.value = String(
              pretvoriDneveVEnoto(Number(dneviInput.value) || 0, casSheetEnota)
            );
          }
          osveziPredogled();
          posodobiPovzetekIzbire();
        });
      }

      el.querySelector("#opomin-cas-sheet-shrani").addEventListener(
        "click",
        async function () {
          var shraniBtn = document.getElementById("opomin-cas-sheet-shrani");
          if (casSheetIndex == null) return;
          var iso = preberiIsoIzPolj();
          var dovoljenoOkno = preberiDovoljenoOknoIzPolj();
          if (!dovoljenoOkno.ok || preveriDovoljenoOkno(iso)) {
            osveziPredogled();
            return;
          }
          /* Preveri, ali ročno izbrani dan spada med neaktivne. */
          if (iso) {
            var datumPreverba = new Date(iso);
            if (!Number.isNaN(datumPreverba.getTime())) {
              var aktivni = (plan._aktivniDnevi && plan._aktivniDnevi.length === 7)
                ? plan._aktivniDnevi
                : null;
              if (aktivni && !aktivni.every(function (a) { return a; })) {
                var danP = datumPreverba.getDay();
                var sloP = danP === 0 ? 6 : danP - 1;
                if (!aktivni[sloP]) {
                  if (typeof opts.potrdiVprasanje === "function") {
                    await opts.potrdiVprasanje({
                      naslov: "Dan ni na voljo",
                      opis: "Tega dneva ni mogoče izbrati, ker je onemogočen v Možnih dnevih pošiljanja.",
                      potrdiBesedilo: "V redu",
                      samoEnGumb: true,
                      stil: "primary",
                    });
                  }
                  return;
                }
              }
            }
          }
          var gapDni = izbraniGapDni();
          var predogledPlan = planZNovoMejoZaPredogled(dovoljenoOkno);
          var v = N.validirajCasKoraka(
            predogledPlan,
            casSheetIndex,
            iso,
            casSheetShiftFollowing,
            { gapDays: gapDni }
          );
          if (!v.ok) {
            osveziPredogled();
            return;
          }
          if (shraniBtn) shraniBtn.disabled = true;
          if (
            casSheetShiftFollowing &&
            v.preview &&
            Number(v.preview.shiftedCount) > 0 &&
            typeof opts.potrdiVprasanje === "function"
          ) {
            var opisPremika = gapDni
              ? "Ali želite vse naslednje korake premakniti tako, da bo med njimi " +
                (N.slovenskaDniBeseda
                  ? N.slovenskaDniBeseda(gapDni)
                  : gapDni + " dni") +
                " razmika?"
              : "Ali želite vse naslednje korake premakniti za izbrani časovni premik?";
            var potrjeno = await opts.potrdiVprasanje({
              naslov: "Premaknem tudi naslednje korake?",
              opis: opisPremika,
              prekliciBesedilo: "Ne, vrni se",
              potrdiBesedilo: "Da",
              stil: "primary",
            });
            if (!potrjeno) {
              if (shraniBtn) shraniBtn.disabled = false;
              return;
            }
          }
          if (
            casSheetOknoObseg === "korak" &&
            typeof N.nastaviDovoljenoOknoKoraka === "function"
          ) {
            plan = N.nastaviDovoljenoOknoKoraka(
              plan,
              casSheetIndex,
              dovoljenoOkno.start,
              dovoljenoOkno.end
            );
          } else if (typeof N.nastaviDovoljenoOkno === "function") {
            plan = N.nastaviDovoljenoOkno(
              plan,
              dovoljenoOkno.start,
              dovoljenoOkno.end
            );
          }
          if (
            shiftBtn &&
            !shiftBtn.disabled &&
            typeof N.nastaviKeepIntervals === "function"
          ) {
            plan = N.nastaviKeepIntervals(plan, casSheetShiftFollowing);
          }
          plan = N.posodobiCasKoraka(plan, casSheetIndex, iso, {
            shiftFollowing: casSheetShiftFollowing,
            gapDays: gapDni,
          });
          if (Number(casSheetIndex) === 1 && casSheetNacin === "trenutni") {
            var rocnoNastavljenPrvi = N.najdiKorak(plan, 1);
            if (rocnoNastavljenPrvi) {
              rocnoNastavljenPrvi._uraRocnoNastavljena = true;
            }
            izbranCasNacin = "rocno";
          }
          shrani();
          zapri();
          izrisiGlavni();
        }
      );

      el._ujOsveziPredogled = osveziPredogled;
      el._ujZapri = zapri;
      el._ujSyncDneviIzDatuma = syncDneviIzDatuma;
      el._ujPosodobiPovzetekIzbire = posodobiPovzetekIzbire;
      return el;
    }

    function randomPrivzetaObdobja() {
      return [
        { id: "zgodnje_jutro", label: "Zgodnje jutro", start: "08:00", end: "10:00", windowMinutes: 40 },
        { id: "pozno_jutro", label: "Pozno jutro", start: "10:00", end: "12:00", windowMinutes: 50 },
        { id: "opoldne", label: "Opoldne", start: "12:00", end: "14:00", windowMinutes: 40 },
        { id: "popoldne", label: "Popoldne", start: "14:00", end: "17:00", windowMinutes: 40 },
        { id: "proti_veceru", label: "Proti večeru", start: "17:00", end: "19:00", windowMinutes: 20 },
        { id: "vecer", label: "Večer", start: "19:00", end: "21:00", windowMinutes: 20 },
      ];
    }

    function randomMinuteIzCasa(value) {
      var deli = String(value || "").split(":");
      var ura = Number(deli[0]);
      var minuta = Number(deli[1]);
      if (!Number.isFinite(ura) || !Number.isFinite(minuta)) return NaN;
      return ura * 60 + minuta;
    }

    function randomNormalizirajObdobja(value) {
      var defaults = randomPrivzetaObdobja();
      if (!Array.isArray(value) || !value.length) return defaults;
      return defaults.map(function (fallback, index) {
        var item = value[index] || {};
        return {
          id: fallback.id,
          label: fallback.label,
          start: /^\d{2}:\d{2}$/.test(String(item.start || "")) ? item.start : fallback.start,
          end: /^\d{2}:\d{2}$/.test(String(item.end || "")) ? item.end : fallback.end,
          windowMinutes: Math.max(5, Math.min(120, Number(item.windowMinutes) || fallback.windowMinutes)),
        };
      });
    }

    function randomObdobjeZaMinute(periods, minute) {
      var najblizje = null;
      var najmanjsaRazdalja = Infinity;
      for (var i = 0; i < periods.length; i++) {
        var start = randomMinuteIzCasa(periods[i].start);
        var end = randomMinuteIzCasa(periods[i].end);
        var jeZadnje = i === periods.length - 1;
        if (minute >= start && (minute < end || (jeZadnje && minute <= end))) return periods[i];
        var razdalja = minute < start ? start - minute : minute - end;
        if (razdalja < najmanjsaRazdalja) {
          najmanjsaRazdalja = razdalja;
          najblizje = periods[i];
        }
      }
      return najblizje;
    }

    function randomCelaMinutaRazen(spodaj, zgoraj, izkljucenaMinuta) {
      var skupno = zgoraj - spodaj + 1;
      if (skupno <= 0) return null;
      var izkljuci =
        skupno > 1 &&
        izkljucenaMinuta >= spodaj &&
        izkljucenaMinuta <= zgoraj;
      var moznosti = skupno - (izkljuci ? 1 : 0);
      var arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      var odmik = arr[0] % moznosti;
      var rezultat = spodaj + odmik;
      if (izkljuci && rezultat >= izkljucenaMinuta) rezultat++;
      return rezultat;
    }

    function ustvariRandomPredogled(step, nastavitve) {
      var rs = nastavitve || (step && step._randomSchedule);
      var baseIso = step && (step.sendAt || step.scheduledAt);
      if (!step || !rs || !rs.enabled || !baseIso) return null;

      var baseDate = new Date(baseIso);
      if (Number.isNaN(baseDate.getTime())) return null;
      var minMn = randomMinuteIzCasa(rs.minSendTime || "07:00");
      var maxMn = randomMinuteIzCasa(rs.maxSendTime || "21:00");
      if (!Number.isFinite(minMn) || !Number.isFinite(maxMn) || maxMn <= minMn) {
        return null;
      }

      var baseMn = baseDate.getHours() * 60 + baseDate.getMinutes();
      var spodaj;
      var zgoraj;
      if (rs.mode === "pametno") {
        var previewPeriods = randomNormalizirajObdobja(rs.smartPeriods);
        var previewPeriod = randomObdobjeZaMinute(previewPeriods, baseMn);
        if (!previewPeriod) return null;
        var periodStart = randomMinuteIzCasa(previewPeriod.start);
        var periodEnd = randomMinuteIzCasa(previewPeriod.end);
        var periodWindow = Number(previewPeriod.windowMinutes) || 20;
        var anchor = Math.max(periodStart, Math.min(baseMn, periodEnd));
        spodaj = Math.max(anchor - periodWindow, periodStart, minMn);
        zgoraj = Math.min(anchor + periodWindow, periodEnd, maxMn);
      } else {
        var before = Math.max(0, Number(rs.minutesBefore) || 0);
        var after = Math.max(0, Number(rs.minutesAfter) || 0);
        spodaj = Math.max(baseMn - before, minMn);
        zgoraj = Math.min(baseMn + after, maxMn);
      }

      var prejsnji = najdiPrejsnjiAktivniKorak(plan, step.index);
      var prejsnjiIso = prikazniCasKoraka(prejsnji);
      if (prejsnjiIso) {
        var prejsnjiDatum = new Date(prejsnjiIso);
        if (
          !Number.isNaN(prejsnjiDatum.getTime()) &&
          prejsnjiDatum.getFullYear() === baseDate.getFullYear() &&
          prejsnjiDatum.getMonth() === baseDate.getMonth() &&
          prejsnjiDatum.getDate() === baseDate.getDate()
        ) {
          var prejsnjaMinuta =
            prejsnjiDatum.getHours() * 60 + prejsnjiDatum.getMinutes();
          if (prejsnjiDatum.getSeconds() > 0 || prejsnjiDatum.getMilliseconds() > 0) {
            prejsnjaMinuta++;
          }
          spodaj = Math.max(spodaj, prejsnjaMinuta);
        }
      }

      if (zgoraj < spodaj) return null;
      var rndMn = randomCelaMinutaRazen(spodaj, zgoraj, baseMn);
      if (rndMn == null) return null;
      baseDate.setHours(Math.floor(rndMn / 60), rndMn % 60, 0, 0);
      rs.baseScheduledAt = baseIso;
      rs._previewBaseAt = baseIso;
      rs._previewResolvedAt = baseDate.toISOString();
      rs._previewGeneratedAt = new Date().toISOString();
      return rs._previewResolvedAt;
    }

    function randomPojasnilo(step, izbraniIso) {
      var rs = (step && step._randomSchedule) || {};
      var osnovniIso =
        rs._previewBaseAt ||
        rs.baseScheduledAt ||
        (step && (step.sendAt || step.scheduledAt));
      var osnovniDatum = osnovniIso ? new Date(osnovniIso) : null;
      var izbraniDatum = izbraniIso ? new Date(izbraniIso) : null;
      if (
        !osnovniDatum ||
        !izbraniDatum ||
        Number.isNaN(osnovniDatum.getTime()) ||
        Number.isNaN(izbraniDatum.getTime())
      ) {
        return "Random je vklopljen. Ura bo izbrana ob potrditvi.";
      }

      var prejsnjiKorak = najdiPrejsnjiAktivniKorak(plan, step.index);
      var prejsnjiIso =
        dolocenRandomCas(prejsnjiKorak) ||
        (prejsnjiKorak &&
          (prejsnjiKorak.sendAt || prejsnjiKorak.scheduledAt));
      var prejsnjiDatum = prejsnjiIso ? new Date(prejsnjiIso) : null;
      var osnovnaMinuta =
        osnovniDatum.getHours() * 60 + osnovniDatum.getMinutes();
      var jeOsnovaPrejsnjiKorak =
        prejsnjiDatum &&
        !Number.isNaN(prejsnjiDatum.getTime()) &&
        osnovnaMinuta ===
          prejsnjiDatum.getHours() * 60 + prejsnjiDatum.getMinutes();
      var referencnaMinuta = jeOsnovaPrejsnjiKorak
        ? prejsnjiDatum.getHours() * 60 + prejsnjiDatum.getMinutes()
        : osnovnaMinuta;
      var izbranaMinuta =
        izbraniDatum.getHours() * 60 + izbraniDatum.getMinutes();
      var dejanskiZamik = izbranaMinuta - referencnaMinuta;
      var referenca = jeOsnovaPrejsnjiKorak
        ? "ure prejšnjega koraka"
        : "izbrane ure";
      var rezultat;
      if (dejanskiZamik < 0) {
        rezultat = Math.abs(dejanskiZamik) + " min prej od " + referenca;
      } else if (dejanskiZamik > 0) {
        rezultat = dejanskiZamik + " min pozneje od " + referenca;
      } else {
        rezultat = "brez zamika glede na " + referenca;
      }

      var nastavitev;
      if (rs.mode === "pametno") {
        var obdobja = randomNormalizirajObdobja(rs.smartPeriods);
        var obdobje = randomObdobjeZaMinute(obdobja, osnovnaMinuta);
        nastavitev = obdobje
          ? "pametno obdobje " +
            obdobje.label +
            " z zamikom do " +
            obdobje.windowMinutes +
            " min"
          : "pametno obdobje";
      } else {
        var prej = Math.max(0, Number(rs.minutesBefore) || 0);
        var pozneje = Math.max(0, Number(rs.minutesAfter) || 0);
        var deli = [];
        if (prej > 0) deli.push("do " + prej + " min prej");
        if (pozneje > 0) deli.push("do " + pozneje + " min pozneje");
        nastavitev = deli.join(" / ") || "brez dovoljenega zamika";
      }

      return (
        "Ura je naključno prilagojena: " +
        rezultat +
        ". Nastavljeno: " +
        nastavitev +
        "."
      );
    }

    function odpriRandomSheet(step) {
      var sheet = document.getElementById("random-sheet");
      if (!sheet) return;
      var backdrop = sheet.querySelector("#random-sheet-backdrop");
      var zapri = sheet.querySelector("#random-sheet-zapri");
      var ponastaviCas = sheet.querySelector("#random-sheet-ponastavi-cas");
      var shrani = sheet.querySelector("#random-sheet-shrani");
      var izklopi = sheet.querySelector("#random-sheet-izklopi");
      var minCasEl = sheet.querySelector("#random-min-cas");
      var maxCasEl = sheet.querySelector("#random-max-cas");
      var prejEl = sheet.querySelector("#random-minut-prej");
      var poznejeEl = sheet.querySelector("#random-minut-pozneje");
      var okoliEl = sheet.querySelector("#random-okoli");
      var pametnoEl = sheet.querySelector("#random-pametno");
      var periodsEl = sheet.querySelector("#random-periods");
      var napakaEl = sheet.querySelector("#random-napaka");
      var rezultatEl = sheet.querySelector("#random-rezultat");
      var ponastaviEl = sheet.querySelector("#random-ponastavi-obdobja");
      var rs = step._randomSchedule || {};
      var enabled = Boolean(rs.enabled);
      var globalneRandomNastavitve = plan._randomScheduleDefaults || {};
      var dovoljenoOknoRandom = dovoljenoOknoKoraka(plan, step);
      var virNastavitev = enabled
        ? rs
        : Object.keys(globalneRandomNastavitve).length
          ? globalneRandomNastavitve
          : rs;
      var obdobja = randomNormalizirajObdobja(virNastavitev.smartPeriods);
      if (ponastaviCas) ponastaviCas.hidden = false;

      function zapriSheet() {
        sheet.hidden = true;
      }

      function izbraniNacin() {
        var checked = sheet.querySelector('input[name="random-nacin"]:checked');
        return checked ? checked.value : "okoli";
      }

      function preberiObdobjaIzPolj() {
        return obdobja.map(function (item, index) {
          var card = periodsEl.querySelector('[data-random-period="' + index + '"]');
          return {
            id: item.id,
            label: item.label,
            start: card.querySelector('[data-period-start]').value,
            end: card.querySelector('[data-period-end]').value,
            windowMinutes: Number(card.querySelector('[data-period-window]').value),
          };
        });
      }

      function blokirajNeStevilcniVnos(event) {
        if (
          event.inputType === "insertText" &&
          event.data &&
          /[^0-9]/.test(event.data)
        ) {
          event.preventDefault();
        }
      }

      function izrisiObdobja() {
        periodsEl.innerHTML = obdobja.map(function (item, index) {
          return (
            '<div class="random-sheet__obdobje" data-random-period="' + index + '">' +
              '<div class="random-sheet__obdobje-vrh">' +
                '<span class="random-sheet__obdobje-stevilka">' + (index + 1) + '</span>' +
                '<span class="random-sheet__obdobje-ime">' + esc(item.label) + '</span>' +
                '<label class="random-sheet__obdobje-okno"><span class="random-sheet__obdobje-okno-oznaka">Zamik</span><span aria-hidden="true">±</span>' +
                  '<input type="number" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off" min="5" max="120" step="5" value="' + esc(item.windowMinutes) + '" data-period-window aria-label="Naključni razpon za ' + esc(item.label) + '">' +
                  '<span>min</span></label>' +
              '</div>' +
              '<div class="random-sheet__obdobje-casi">' +
                '<label><span>Od</span><input type="time" value="' + esc(item.start) + '" data-period-start aria-label="Začetek: ' + esc(item.label) + '"></label>' +
                '<span class="random-sheet__obdobje-puscica" aria-hidden="true">→</span>' +
                '<label><span>Do</span><input type="time" value="' + esc(item.end) + '" data-period-end aria-label="Konec: ' + esc(item.label) + '"></label>' +
              '</div>' +
            '</div>'
          );
        }).join("");
        periodsEl.querySelectorAll("input").forEach(function (input) {
          if (input.type === "number") {
            input.onbeforeinput = blokirajNeStevilcniVnos;
          }
          input.oninput = osveziPovzetek;
        });
      }

      function osveziPovzetek() {
        if (!rezultatEl) return;
        var base = new Date(step.sendAt || step.scheduledAt);
        var baseMinute = Number.isNaN(base.getTime()) ? 12 * 60 : base.getHours() * 60 + base.getMinutes();
        if (izbraniNacin() === "okoli") {
          var before = Math.max(0, Number(prejEl.value) || 0);
          var after = Math.max(0, Number(poznejeEl.value) || 0);
          rezultatEl.textContent = "Izbrana ura: −" + before + " / +" + after + " min · dovoljeno " + minCasEl.value + "–" + maxCasEl.value;
        } else {
          var trenutna = preberiObdobjaIzPolj();
          var period = randomObdobjeZaMinute(trenutna, baseMinute);
          rezultatEl.textContent = period
            ? "Za izbrano uro se uporabi: " + period.label + " · ±" + period.windowMinutes + " min"
            : "Nastavite vsaj eno veljavno obdobje.";
        }
      }

      function preklopiNacin() {
        var nacin = izbraniNacin();
        okoliEl.hidden = nacin !== "okoli";
        pametnoEl.hidden = nacin !== "pametno";
        osveziPovzetek();
      }

      function prikaziNapako(message) {
        napakaEl.textContent = message;
        napakaEl.hidden = !message;
        if (message) napakaEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      function validirajObdobja(items, minAllowed, maxAllowed) {
        var previousEnd = null;
        for (var i = 0; i < items.length; i++) {
          var start = randomMinuteIzCasa(items[i].start);
          var end = randomMinuteIzCasa(items[i].end);
          var windowMinutes = Number(items[i].windowMinutes);
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            return "Pri obdobju »" + items[i].label + "« mora biti končna ura poznejša od začetne.";
          }
          if (start < minAllowed || end > maxAllowed) {
            return "Obdobje »" + items[i].label + "« mora biti znotraj dovoljenih ur.";
          }
          if (previousEnd != null && start < previousEnd) {
            return "Pametna obdobja se ne smejo prekrivati.";
          }
          if (!Number.isFinite(windowMinutes) || windowMinutes < 5 || windowMinutes > 120) {
            return "Naključni razpon mora biti med 5 in 120 minutami.";
          }
          previousEnd = end;
        }
        return "";
      }

      minCasEl.value = dovoljenoOknoRandom.start;
      maxCasEl.value = dovoljenoOknoRandom.end;
      prejEl.value = virNastavitev.minutesBefore != null ? virNastavitev.minutesBefore : 15;
      poznejeEl.value = virNastavitev.minutesAfter != null ? virNastavitev.minutesAfter : 15;
      var mode = virNastavitev.mode === "pametno" ? "pametno" : "okoli";
      var modeRadio = sheet.querySelector('input[name="random-nacin"][value="' + mode + '"]');
      if (modeRadio) modeRadio.checked = true;
      prikaziNapako("");
      izrisiObdobja();
      preklopiNacin();

      backdrop.onclick = zapriSheet;
      zapri.onclick = zapriSheet;
      sheet.querySelectorAll('input[name="random-nacin"]').forEach(function (radio) {
        radio.onchange = preklopiNacin;
      });
      [minCasEl, maxCasEl, prejEl, poznejeEl].forEach(function (input) {
        if (input.type === "number") {
          input.onbeforeinput = blokirajNeStevilcniVnos;
        }
        input.oninput = osveziPovzetek;
      });

      ponastaviEl.onclick = function () {
        obdobja = randomPrivzetaObdobja();
        izrisiObdobja();
        osveziPovzetek();
        prikaziNapako("");
      };

      shrani.onclick = function () {
        var minSend = minCasEl.value || "07:00";
        var maxSend = maxCasEl.value || "21:00";
        var minH = randomMinuteIzCasa(minSend);
        var maxH = randomMinuteIzCasa(maxSend);
        if (!Number.isFinite(minH) || !Number.isFinite(maxH) || maxH <= minH) {
          prikaziNapako("Končna dovoljena ura mora biti poznejša od začetne.");
          return;
        }
        var nacin = izbraniNacin();
        var before = Number(prejEl.value);
        var after = Number(poznejeEl.value);
        if (nacin === "okoli" && (!Number.isFinite(before) || !Number.isFinite(after) || before < 0 || after < 0 || before + after <= 0)) {
          prikaziNapako("Vnesite veljaven razpon pred ali po izbrani uri.");
          return;
        }
        var novaObdobja = preberiObdobjaIzPolj();
        if (nacin === "pametno") {
          var periodError = validirajObdobja(novaObdobja, minH, maxH);
          if (periodError) {
            prikaziNapako(periodError);
            return;
          }
        }
        var trajneNastavitve = {
          mode: nacin,
          minSendTime: minSend,
          maxSendTime: maxSend,
          minutesBefore: Math.max(0, Math.min(120, Math.floor(before || 0))),
          minutesAfter: Math.max(0, Math.min(120, Math.floor(after || 0))),
          smartPeriods: novaObdobja,
        };
        if (
          plan.allowedSendWindowMode === "per_step" &&
          step.allowedSendWindow &&
          typeof N.nastaviDovoljenoOknoKoraka === "function"
        ) {
          plan = N.nastaviDovoljenoOknoKoraka(
            plan,
            step.index,
            minSend,
            maxSend
          );
        } else if (typeof N.nastaviDovoljenoOkno === "function") {
          plan = N.nastaviDovoljenoOkno(plan, minSend, maxSend, {
            ohraniIzjeme: true,
          });
        }
        plan._randomScheduleDefaults = JSON.parse(JSON.stringify(trajneNastavitve));
        step._randomSchedule = Object.assign({}, trajneNastavitve, {
          enabled: true,
          baseScheduledAt: step.sendAt || step.scheduledAt,
          resolvedScheduledAt: null,
          resolvedAt: null,
        });
        ustvariRandomPredogled(step, step._randomSchedule);
        N.shraniOsnutek(plan);
        zapriSheet();
        izrisiGlavni();
      };

      function uporabiCasBrezRandoma(
        ciljniIso,
        nacin,
        ohraniMoznostPonastavitve
      ) {
        var trenutniIso = step.sendAt || step.scheduledAt;
        var zgodovinaRandoma = ohraniMoznostPonastavitve
          ? Object.assign({}, rs, {
              enabled: false,
              lastRandomScheduledAt: ciljniIso,
              resolvedScheduledAt: null,
              resolvedAt: null,
            })
          : null;
        if (zgodovinaRandoma) {
          delete zgodovinaRandoma._previewResolvedAt;
          delete zgodovinaRandoma._previewGeneratedAt;
          delete zgodovinaRandoma._previewBaseAt;
        }
        step._randomSchedule = null;
        if (ciljniIso && trenutniIso) {
          var ciljniDatum = new Date(ciljniIso);
          if (!Number.isNaN(ciljniDatum.getTime())) {
            var validacija = N.validirajCasKoraka
              ? N.validirajCasKoraka(
                  plan,
                  step.index,
                  ciljniDatum.toISOString(),
                  true
                )
              : { ok: true };
            if (validacija.ok) {
              plan = N.posodobiCasKoraka(
                plan,
                step.index,
                ciljniDatum.toISOString(),
                { shiftFollowing: true }
              );
            }
          }
        }

        var posodobljenKorak = N.najdiKorak(plan, step.index);
        if (posodobljenKorak) {
          posodobljenKorak._uraRocnoNastavljena = true;
          posodobljenKorak._randomSchedule = zgodovinaRandoma;
        }
        izbranCasNacin = nacin || "rocno";
        N.shraniOsnutek(plan);
        zapriSheet();
        izrisiGlavni();
      }

      izklopi.onclick = function () {
        var ohranjeniRandomCas =
          rs.resolvedScheduledAt ||
          rs._previewResolvedAt ||
          rs.lastRandomScheduledAt ||
          step.sendAt ||
          step.scheduledAt;
        uporabiCasBrezRandoma(ohranjeniRandomCas, "rocno", true);
      };

      if (ponastaviCas) ponastaviCas.onclick = function () {
        var privzeteNastavitve = {
          mode: "okoli",
          minSendTime: "07:00",
          maxSendTime: "21:00",
          minutesBefore: 15,
          minutesAfter: 15,
          smartPeriods: randomPrivzetaObdobja(),
        };

        plan._randomScheduleDefaults = JSON.parse(
          JSON.stringify(privzeteNastavitve)
        );
        minCasEl.value = privzeteNastavitve.minSendTime;
        maxCasEl.value = privzeteNastavitve.maxSendTime;
        prejEl.value = String(privzeteNastavitve.minutesBefore);
        poznejeEl.value = String(privzeteNastavitve.minutesAfter);
        obdobja = randomPrivzetaObdobja();

        var okoliRadio = sheet.querySelector(
          'input[name="random-nacin"][value="okoli"]'
        );
        if (okoliRadio) okoliRadio.checked = true;

        if (step._randomSchedule) {
          step._randomSchedule = Object.assign(
            {},
            step._randomSchedule,
            privzeteNastavitve,
            {
              enabled: Boolean(step._randomSchedule.enabled),
              resolvedScheduledAt: null,
              resolvedAt: null,
            }
          );
          rs = step._randomSchedule;
          delete rs._previewResolvedAt;
          delete rs._previewGeneratedAt;
          delete rs._previewBaseAt;
          if (rs.enabled) ustvariRandomPredogled(step, rs);
        }

        izrisiObdobja();
        preklopiNacin();
        prikaziNapako("");
        N.shraniOsnutek(plan);
        izrisiGlavni();
      };

      sheet.hidden = false;
      var naslov = sheet.querySelector("#random-sheet-naslov");
      if (naslov) naslov.focus();
    }

    function odpriCasSheet(index, nacin) {
      var nacinOdprtja = nacin === "naslednji" ? "naslednji" : "trenutni";
      var baseIndex = Number(index);
      var targetIndex =
        nacinOdprtja === "naslednji" ? baseIndex + 1 : baseIndex;
      var step = N.najdiKorak(plan, targetIndex);
      if (!step || (N.jeKorakPremakljiv && !N.jeKorakPremakljiv(step))) return;
      if (nacinOdprtja === "naslednji") {
        var baza = N.najdiKorak(plan, baseIndex);
        if (!baza) return;
      }

      var sheet = zagotoviCasSheet();
      casSheetNacin = nacinOdprtja;
      casSheetBaseIndex = baseIndex;
      casSheetIndex = targetIndex;
      casSheetOknoObseg =
        plan.allowedSendWindowMode === "per_step" ? "korak" : "vsi";
      casSheetEnota = "dan";
      uraRocnoNastavljena = false;
      sheet
        .querySelectorAll(".opomin-cas-sheet__enota-gumb")
        .forEach(function (g) {
          g.classList.toggle(
            "opomin-cas-sheet__enota-gumb--aktiven",
            g.getAttribute("data-enota") === "dan"
          );
        });

      var pragZaNaslednje =
        nacinOdprtja === "naslednji" ? baseIndex : targetIndex;
      var imaNaslednje = (plan.steps || []).some(function (s) {
        return (
          Number(s.index) > Number(pragZaNaslednje) &&
          (!N.jeKorakPremakljiv || N.jeKorakPremakljiv(s))
        );
      });
      var stikaloOvoj = document.getElementById("opomin-cas-sheet-stikalo-ovoj");
      if (stikaloOvoj) stikaloOvoj.hidden = false;
      var shiftBtn = document.getElementById("opomin-cas-sheet-shift");
      if (shiftBtn) {
        var shranjenoPremikanje =
          plan.keepStageIntervals == null
            ? true
            : Boolean(plan.keepStageIntervals);
        casSheetShiftFollowing = imaNaslednje && shranjenoPremikanje;
        shiftBtn.disabled = !imaNaslednje;
        shiftBtn.setAttribute("aria-disabled", imaNaslednje ? "false" : "true");
        shiftBtn.classList.toggle(
          "opomin-nacrt__switch--on",
          casSheetShiftFollowing
        );
        shiftBtn.setAttribute(
          "aria-checked",
          casSheetShiftFollowing ? "true" : "false"
        );
      }
      if (stikaloOvoj) {
        stikaloOvoj.classList.toggle(
          "opomin-cas-sheet__stikalo-ovoj--onemogoceno",
          !imaNaslednje
        );
      }
      var stikaloOpis = document.getElementById("opomin-cas-sheet-stikalo-opis");
      if (stikaloOpis) {
        stikaloOpis.textContent = imaNaslednje
          ? "Naslednji koraki se premaknejo za enako število dni."
          : "Za tem korakom ni naslednjih korakov.";
      }

      var naslov = document.getElementById("opomin-cas-sheet-naslov");
      var dneviLabel = document.getElementById("opomin-cas-sheet-dnevi-label");
      if (naslov) {
        naslov.textContent =
          nacinOdprtja === "naslednji"
            ? "Spremeni razmik do naslednjega"
            : "Spremeni čas koraka";
      }
      if (dneviLabel) {
        dneviLabel.textContent =
          nacinOdprtja === "naslednji"
            ? "Razmik do naslednjega koraka"
            : "Čez koliko dni od danes";
      }

      var iso = step.sendAt || step.scheduledAt;
      var datumEl = document.getElementById("opomin-cas-sheet-datum");
      var uraEl = document.getElementById("opomin-cas-sheet-ura");
      var dneviEl = document.getElementById("opomin-cas-sheet-dnevi");
      var dovoljenoOdEl = document.getElementById("opomin-cas-sheet-dovoljeno-od");
      var dovoljenoDoEl = document.getElementById("opomin-cas-sheet-dovoljeno-do");
      var dovoljenoOkno =
        casSheetOknoObseg === "korak"
          ? dovoljenoOknoKoraka(plan, step)
          : dovoljenoOknoPlana(plan);
      if (datumEl) datumEl.value = isoZaDateInput(iso);
      if (uraEl) {
        uraEl.value = isoZaTimeInput(iso);
        uraEl.min = dovoljenoOkno.start;
        uraEl.max = dovoljenoOkno.end;
        if (jeUraZnotrajDovoljenegaOkna(uraEl.value, dovoljenoOkno)) {
          uraEl.dataset.ujZadnjaDovoljenaUra = uraEl.value;
        }
      }
      var bliznjicaUraEl = document.getElementById(
        "opomin-cas-sheet-bliznjica-ura"
      );
      if (bliznjicaUraEl) {
        bliznjicaUraEl.min = dovoljenoOkno.start;
        bliznjicaUraEl.max = dovoljenoOkno.end;
      }
      if (dovoljenoOdEl) dovoljenoOdEl.value = dovoljenoOkno.start;
      if (dovoljenoDoEl) dovoljenoDoEl.value = dovoljenoOkno.end;
      if (sheet._ujOsveziGumbaObsega) sheet._ujOsveziGumbaObsega();
      var uraNapakaEl = document.getElementById("opomin-cas-sheet-ura-napaka");
      if (uraNapakaEl) {
        uraNapakaEl.textContent = "";
        uraNapakaEl.hidden = true;
      }
      if (dneviEl) {
        if (nacinOdprtja === "naslednji") {
          var bazaStep = N.najdiKorak(plan, baseIndex);
          var raz =
            typeof N.koledarskiDneviMed === "function"
              ? N.koledarskiDneviMed(
                  bazaStep && (bazaStep.sendAt || bazaStep.scheduledAt),
                  iso
                )
              : 0;
          dneviEl.value = String(Math.max(0, Number(raz) || 0));
        } else {
          dneviEl.value = String(dneviOdDanes(iso));
        }
      }
      /* Ob odprtju: če je izbran "danes" (0) in je ura še nedotaknjena privzeta
         12.00, jo takoj zamenjamo za trenutno uro (glej posodobiUraCeDanes). */
      if (
        uraEl &&
        dneviEl &&
        dneviEl.value === "0" &&
        uraEl.value === "12:00"
      ) {
        var dZdaj = new Date();
        uraEl.value =
          String(dZdaj.getHours()).padStart(2, "0") +
          ":" +
          String(dZdaj.getMinutes()).padStart(2, "0");
      }

      if (sheet._ujPonastaviBliznjico) sheet._ujPonastaviBliznjico();

      sheet.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      if (sheet._ujOsveziPredogled) sheet._ujOsveziPredogled();
      if (sheet._ujPosodobiPovzetekIzbire) sheet._ujPosodobiPovzetekIzbire();
      if (naslov) naslov.focus();
    }

    function vrsticaVsebine(o) {
      o = o || {};
      var vrednostHtml = "";
      if (o.vrednostKotPill && o.vrednost) {
        vrednostHtml =
          '<span class="opomin-nacrt__vrednost-pill">' +
          esc(o.vrednost) +
          "</span>";
      } else if (o.vrednost) {
        vrednostHtml =
          '<span class="opomin-nacrt__vsebina-vrednost">' +
          esc(o.vrednost) +
          "</span>";
      }
      return (
        '<button type="button" class="opomin-nacrt__vsebina-vrstica" data-vsebina="' +
        esc(o.akcija || "") +
        '">' +
        '<span class="opomin-nacrt__vsebina-levo">' +
        '<span class="opomin-nacrt__vsebina-ikona" aria-hidden="true">' +
        (o.ikona || "") +
        "</span>" +
        '<span class="opomin-nacrt__vsebina-naslov">' +
        esc(o.naslov || "") +
        "</span>" +
        "</span>" +
        '<span class="opomin-nacrt__vsebina-desno">' +
        vrednostHtml +
        (o.badge
          ? '<span class="opomin-nacrt__mini-badge">' + esc(o.badge) + "</span>"
          : "") +
        '<span class="opomin-nacrt__chevron" aria-hidden="true">›</span>' +
        "</span>" +
        "</button>"
      );
    }

    function htmlAddonKartica(o) {
      o = o || {};
      var vklopljeno = Boolean(o.vklopljeno);
      return (
        '<button type="button" class="sporocilo-dodatek' +
        (o.priporocilo ? " sporocilo-dodatek--priporocilo" : "") +
        '" data-vsebina="' +
        esc(o.akcija || "") +
        '" aria-pressed="' +
        (vklopljeno ? "true" : "false") +
        '" aria-label="' +
        esc(o.aria || o.naslov || "") +
        '">' +
        (o.priporocilo
          ? '<span class="sporocilo-dodatek__zvezda" aria-hidden="true" title="Sistemsko priporočilo">★</span>'
          : "") +
        '<span class="sporocilo-dodatek__ikona" aria-hidden="true">' +
        (o.ikona || "") +
        "</span>" +
        '<span class="sporocilo-dodatek__naslov">' +
        esc(o.naslov || "") +
        "</span>" +
        '<span class="sporocilo-dodatek__stanje">' +
        esc(o.stanje || (vklopljeno ? "Vklopljeno" : "Izklopljeno")) +
        "</span>" +
        "</button>"
      );
    }

    function stevecSklanjatev(n) {
      if (n === 1) return "1 račun";
      if (n === 2) return "2 računa";
      if (n === 3 || n === 4) return n + " računi";
      return n + " računov";
    }

    function statusnoBesediloPriloge(p, imaTel, imaEmail) {
      var sms =
        Boolean(p.deliveryChannels && p.deliveryChannels.sms) &&
        imaTel &&
        p.status === "ready";
      var email =
        Boolean(p.deliveryChannels && p.deliveryChannels.email) &&
        imaEmail &&
        p.status === "ready";
      if (sms && email) return "SMS · E-pošta";
      if (sms) return "SMS";
      if (email) return "E-pošta";
      return "";
    }

    function htmlStatusPriloge(p, imaTel, imaEmail, dodatnoBesedilo) {
      if (p.status !== "ready") return esc(dodatnoBesedilo || "");
      var kanali = statusnoBesediloPriloge(p, imaTel, imaEmail);
      return (
        '<span class="vk-racun-kartica__status-osnova">Dodano kot priloga</span>' +
        (kanali
          ? '<span class="vk-racun-kartica__status-locilo" aria-hidden="true">|</span>' +
            '<span class="vk-racun-kartica__status-kanali">' + esc(kanali) + "</span>"
          : "") +
        (dodatnoBesedilo
          ? '<span class="vk-racun-kartica__status-locilo" aria-hidden="true">·</span>' +
            '<span class="vk-racun-kartica__status-velikost">' + esc(dodatnoBesedilo) + "</span>"
          : "")
      );
    }

    function htmlKanalGumb(vrsta, vkljucen, onemogocen, imeDatoteke) {
      var jeSms = vrsta === "sms";
      var label = jeSms ? "SMS" : "E-pošta";
      var razredi = "vk-kanal-gumb";
      if (onemogocen) razredi += " vk-kanal-gumb--disabled";
      else if (vkljucen) {
        razredi += jeSms ? " vk-kanal-gumb--sms-on" : " vk-kanal-gumb--email-on";
      }
      var aria =
        (jeSms ? "Pošlji račun " : "Pošlji račun ") +
        imeDatoteke +
        (jeSms ? " prek SMS-a" : " po e-pošti");
      return (
        '<button type="button" class="' +
        razredi +
        '" data-kanal="' +
        vrsta +
        '" aria-pressed="' +
        (vkljucen ? "true" : "false") +
        '"' +
        (onemogocen
          ? ' disabled aria-disabled="true" title="' +
            esc(
              jeSms
                ? "Dolžnik nima telefonske številke."
                : "Dolžnik nima e-poštnega naslova."
            ) +
            '"'
          : "") +
        ' aria-label="' +
        esc(aria) +
        '">' +
        (vkljucen && !onemogocen ? "✓ " : "") +
        label +
        "</button>"
      );
    }

    function htmlZgornjaOrodnaVrstica(steviloPrilog) {
      return (
        '<div class="racun-posiljanje__vrstica vk-priloge-orodna-vrstica" role="group" aria-label="Priložite račun">' +
        '<div class="racun-posiljanje__oznaka">' +
        '<span class="racun-posiljanje__oznaka-ikona" aria-hidden="true">' + IKONA_DOKUMENT + "</span>" +
        '<h3 class="racun-posiljanje__naslov" data-fit-text data-fit-text-min="9"><span class="racun-posiljanje__naslov-besedilo">Priložite račun</span>' +
        '<span class="racun-posiljanje__stevec" aria-label="' +
        esc(stevecSklanjatev(steviloPrilog)) +
        '">' +
        esc(steviloPrilog) +
        "</span></h3>" +
        "</div>" +
        '<div class="racun-posiljanje__akcije racun-posiljanje__akcije--orodna-vrstica">' +
        '<button type="button" class="racun-posiljanje__gumb vk-priloge-orodna-vrstica__gumb" id="vk-priloge-slikaj" aria-label="Slikaj račun">' +
        IKONA_KAMERA +
        ' <span class="vk-priloge-orodna-vrstica__gumb-tekst">Slikaj</span></button>' +
        '<button type="button" class="racun-posiljanje__gumb vk-priloge-orodna-vrstica__gumb" id="vk-priloge-uvozi" aria-label="Uvozi račun">' +
        IKONA_UVOZI +
        ' <span class="vk-priloge-orodna-vrstica__gumb-tekst">Uvozi</span></button>' +
        "</div>" +
        "</div>"
      );
    }

    function skupniKanaliRacunov(imaTel, imaEmail) {
      var prva = prilogeKoraka.find(function (p) {
        return p && p.deliveryChannels;
      });
      return {
        sms: imaTel && Boolean(prva ? prva.deliveryChannels.sms : imaTel),
        email: imaEmail && Boolean(prva ? prva.deliveryChannels.email : imaEmail),
      };
    }

    function htmlSkupniKanaliRacunov(imaTel, imaEmail) {
      if (!prilogeKoraka.length) return "";
      var kanali = skupniKanaliRacunov(imaTel, imaEmail);
      return (
        '<div class="vk-racun-kanali-vsi" role="group" aria-label="Kanali pošiljanja vseh računov">' +
        '<span class="vk-racun-kanali-vsi__oznaka" data-fit-text data-fit-text-min="8.5">Pošlji vse račune prek</span>' +
        '<div class="vk-racun-kanali-vsi__gumbi">' +
        htmlRacunKanalVsiGumb("sms", kanali.sms, !imaTel) +
        htmlRacunKanalVsiGumb("email", kanali.email, !imaEmail) +
        "</div></div>"
      );
    }

    function htmlRacunKanalVsiGumb(vrsta, vkljucen, onemogocen) {
      var jeSms = vrsta === "sms";
      var label = jeSms ? "SMS" : "E-pošta";
      return (
        '<button type="button" class="vk-racun-kanali-vsi__gumb' +
        (vkljucen ? " vk-racun-kanali-vsi__gumb--izbran" : "") +
        '" data-racun-kanal-vsi="' + vrsta + '" data-kanal="' + vrsta +
        '" aria-pressed="' + (vkljucen ? "true" : "false") + '"' +
        (onemogocen ? ' aria-disabled="true"' : "") +
        ' aria-label="Pošlji vse račune ' + (jeSms ? "prek SMS-a" : "po e-pošti") + '">' +
        '<span data-fit-text data-fit-text-min="8">' + label + "</span></button>"
      );
    }

    function htmlKarticaRacuna(p, imaTel, imaEmail) {
      var PV = root.UJPrilogeVsebina;
      var ime = p.originalFileName || "Račun";
      var jePdf =
        (p.mimeType && p.mimeType.indexOf("pdf") >= 0) ||
        /\.pdf$/i.test(ime);
      var jeSlika = jeSlikaPriloga(p) && !jePdf;
      var nalaga =
        p.status === "uploading" || p.status === "processing";
      var napaka = p.status === "error";
      var velikostTekst = "";
      if (nalaga) {
        velikostTekst =
          p.progress != null && p.progress < 100
            ? "Nalaganje " + Math.round(p.progress) + " %"
            : "Obdelujem …";
      } else if (napaka) {
        velikostTekst = "Nalaganje ni uspelo.";
      } else if (PV && PV.formatVelikost && p.sizeBytes != null) {
        velikostTekst = PV.formatVelikost(p.sizeBytes);
      }
      var statusHtml = napaka || nalaga
        ? esc(velikostTekst)
        : htmlStatusPriloge(p, imaTel, imaEmail, velikostTekst);
      var ikonaPredogleda = jeSlika ? IKONA_SLIKA : IKONA_DOKUMENT;
      var komentar = String(p.description || "").trim();
      return (
        '<div class="vk-racun-kartica" data-priloga-id="' +
        esc(p.id) +
        '" role="listitem">' +
        '<div class="vk-racun-kartica__datoteka">' +
        '<span class="vk-racun-kartica__predogled" data-priloga-predogled="' +
        esc(p.id) +
        '" aria-hidden="true">' +
        ikonaPredogleda +
        "</span>" +
        '<div class="vk-racun-kartica__meta">' +
        '<p class="vk-racun-kartica__ime" title="' +
        esc(ime) +
        '">' +
        esc(ime) +
        "</p>" +
        '<p class="vk-racun-kartica__status' +
        (napaka ? " vk-racun-kartica__status--napaka" : "") +
        '" data-fit-text data-fit-text-min="7.5">' +
        statusHtml +
        (napaka
          ? ' <button type="button" class="vk-priloga-ponovi" data-priloga-ponovi="' +
            esc(p.id) +
            '">Poskusi znova</button>'
          : "") +
        "</p>" +
        (!imaTel && !imaEmail && p.status === "ready"
          ? '<p class="vk-racun-kartica__status vk-racun-kartica__status--napaka">Dodajte telefon ali e-pošto dolžnika.</p>'
          : "") +
        "</div>" +
        '<button type="button" class="vk-racun-kartica__odstrani" data-priloga-odstrani="' +
        esc(p.id) +
        '" aria-label="Odstrani račun ' +
        esc(ime) +
        '">×</button>' +
        "</div>" +
        (komentar
          ? '<div class="vk-racun-kartica__komentar"><span class="vk-racun-kartica__komentar-oznaka">Komentar</span><p class="vk-racun-kartica__komentar-besedilo">' +
            esc(komentar) +
            "</p></div>"
          : "") +
        "</div>"
      );
    }

    function htmlKanalGumbV2(vrsta, vkljucen, onemogocen, imeDatoteke) {
      var jeSms = vrsta === "sms";
      var label = jeSms ? "SMS" : "E-pošta";
      var aria =
        (jeSms ? "Pošlji račun " : "Pošlji račun ") +
        imeDatoteke +
        (jeSms ? " prek SMS-a" : " po e-pošti");
      var ikona = vkljucen ? IKONA_KLJUKICA : jeSms ? IKONA_SMS : IKONA_EMAIL;
      return (
        '<button type="button" class="vk-kanal-gumb-v2" data-kanal="' +
        vrsta +
        '" aria-pressed="' +
        (vkljucen ? "true" : "false") +
        '"' +
        (onemogocen
          ? ' aria-disabled="true" title="' +
            esc(
              jeSms
                ? "Dolžnik nima telefonske številke."
                : "Dolžnik nima e-poštnega naslova."
            ) +
            '"'
          : "") +
        ' aria-label="' +
        esc(aria) +
        '">' +
        '<span class="vk-kanal-gumb-v2__ikona" aria-hidden="true">' +
        ikona +
        '</span><span class="vk-kanal-gumb-v2__besedilo">' +
        label +
        "</span>" +
        "</button>"
      );
    }

    function htmlGlobalniKanalGumb(vrsta, vkljucen, onemogocen) {
      var jeSms = vrsta === "sms";
      var label = jeSms ? "SMS" : "E-pošta";
      var ikona = vkljucen ? IKONA_KLJUKICA : jeSms ? IKONA_SMS : IKONA_EMAIL;
      var aria = jeSms
        ? "Pošlji ta korak prek SMS-a"
        : "Pošlji ta korak po e-pošti";
      return (
        '<button type="button" class="vk-kanal-gumb-v2 vk-kanal-gumb-v2--kompakt" data-kanal-globalno="' +
        vrsta +
        '" aria-pressed="' +
        (vkljucen ? "true" : "false") +
        '"' +
        (onemogocen
          ? ' aria-disabled="true" title="' +
            esc(
              jeSms
                ? "Dolžnik nima telefonske številke."
                : "Dolžnik nima e-poštnega naslova."
            ) +
            '"'
          : "") +
        ' aria-label="' +
        esc(aria) +
        '">' +
        '<span class="vk-kanal-gumb-v2__ikona" aria-hidden="true">' +
        ikona +
        '</span><span class="vk-kanal-gumb-v2__besedilo">' +
        label +
        "</span>" +
        "</button>"
      );
    }

    function htmlPrilogaVrstica(p, imaTel, imaEmail) {
      var PV = root.UJPrilogeVsebina;
      var ime = p.originalFileName || "Račun";
      var jePdf =
        (p.mimeType && p.mimeType.indexOf("pdf") >= 0) ||
        /\.pdf$/i.test(ime);
      var kanali = p.deliveryChannels || {};
      var nalaga =
        p.status === "uploading" || p.status === "processing";
      var napaka = p.status === "error";
      var velikostTekst = "";
      if (nalaga) {
        velikostTekst =
          p.progress != null && p.progress < 100
            ? "Nalaganje " + Math.round(p.progress) + " %"
            : "Obdelujem …";
      } else if (napaka) {
        velikostTekst = "Nalaganje ni uspelo.";
      } else if (PV && PV.formatVelikost && p.sizeBytes != null) {
        velikostTekst = PV.formatVelikost(p.sizeBytes);
      }
      var smsOn = Boolean(kanali.sms) && imaTel && !nalaga && !napaka;
      var emailOn = Boolean(kanali.email) && imaEmail && !nalaga && !napaka;
      return (
        '<div class="vk-priloga-vrstica" data-priloga-id="' +
        esc(p.id) +
        '" role="listitem">' +
        '<span class="vk-priloga-vrstica__ikona" aria-hidden="true">' +
        (jePdf ? IKONA_DOKUMENT : IKONA_SLIKA) +
        "</span>" +
        '<div class="vk-priloga-vrstica__meta">' +
        '<p class="vk-priloga-vrstica__ime">' +
        esc(ime) +
        "</p>" +
        '<p class="vk-priloga-vrstica__velikost' +
        (napaka ? " vk-priloga-vrstica__velikost--napaka" : "") +
        '">' +
        esc(velikostTekst) +
        (napaka
          ? ' <button type="button" class="vk-priloga-ponovi" data-priloga-ponovi="' +
            esc(p.id) +
            '">Poskusi znova</button>'
          : "") +
        "</p>" +
        (!imaTel && !imaEmail && p.status === "ready"
          ? '<p class="vk-priloga-vrstica__velikost--napaka">Dodajte telefon ali e-pošto dolžnika.</p>'
          : "") +
        "</div>" +
        '<div class="vk-priloga-kanali">' +
        htmlKanalGumb("sms", smsOn, !imaTel || nalaga || napaka, ime) +
        htmlKanalGumb("email", emailOn, !imaEmail || nalaga || napaka, ime) +
        "</div>" +
        '<button type="button" class="vk-priloga-vrstica__odstrani" data-priloga-odstrani="' +
        esc(p.id) +
        '" aria-label="Odstrani račun ' +
        esc(ime) +
        '">×</button>' +
        "</div>"
      );
    }

    function htmlKontaktnaKartica(vrsta, primarniVrednost, dodatniSeznam, primarniVkljucen, dodatniVkljucen, onemogoceno) {
      var jeSms = vrsta === "sms";
      var ikonaSvg = jeSms ? IKONA_SMS : IKONA_EMAIL;
      var naziv = jeSms ? "SMS" : "E-pošta";
      var primarniLabel = primarniVrednost || (jeSms ? "Brez številke" : "Brez e-pošte");
      var placeholderText = jeSms ? "+386..." : "email@domena.si";
      var spremembaHtml = primarniVrednost && !primarniVkljucen
        ? '<p class="kontakt-kartica__sprememba">Ali &#382;elite spremeniti ' +
          (jeSms ? "&#353;tevilko" : "e-po&#353;to") +
          " za ta korak?</p>"
        : "";

      var dodatniHtml = "";
      if (Array.isArray(dodatniSeznam) && dodatniSeznam.length) {
        dodatniHtml = '<div class="kontakt-kartica__dodatni">' +
          dodatniSeznam.map(function (v) {
            return '<span class="kontakt-dodatni">' + esc(v) +
              '<button type="button" class="kontakt-dodatni__x" data-kontakt-odstrani="' + vrsta + '" data-value="' + esc(v) + '" aria-label="Odstrani">×</button>' +
              '</span>';
          }).join("") +
          '</div>';
      }

      var primarniHtml = primarniVrednost
        ? '<div class="kontakt-kartica__primarni">' +
          '<span class="kontakt-kartica__primarni-naslov">' + esc(primarniLabel) + ' <span class="kontakt-kartica__primarni-oznaka">(korak 1)</span></span>' +
          '<button type="button" class="kontakt-toggle kontakt-toggle--majhen' +
          (primarniVkljucen && !onemogoceno ? " kontakt-toggle--vkljucen" : "") +
          '" data-kontakt-toggle-primarni="' + vrsta + '"' +
          (onemogoceno ? ' disabled aria-disabled="true"' : "") +
          ' aria-pressed="' + (primarniVkljucen ? "true" : "false") + '"' +
          ' aria-label="' + esc(primarniVkljucen ? "Izključi primarni " + naziv : "Vključi primarni " + naziv) + '">' +
          (primarniVkljucen && !onemogoceno ? "✓" : "") +
          "</button>" +
          '<button type="button" class="kontakt-kartica__odpri-dodaj" data-kontakt-odpri-vnos="' + vrsta + '" aria-label="Dodaj ' + esc(naziv.toLowerCase()) + '">+</button>' +
          "</div>"
        : '<div class="kontakt-kartica__primarni kontakt-kartica__primarni--brez">' +
          '<span class="kontakt-kartica__primarni-naslov">' + esc(primarniLabel) + '</span>' +
          '<button type="button" class="kontakt-kartica__odpri-dodaj" data-kontakt-odpri-vnos="' + vrsta + '" aria-label="Dodaj ' + esc(naziv.toLowerCase()) + '">+</button>' +
        "</div>";

      return (
        '<div class="kontakt-kartica' + (onemogoceno ? " kontakt-kartica--onemogoceno" : "") + '" data-kontakt-vrsta="' + vrsta + '">' +
        '<div class="kontakt-kartica__glava" aria-label="' + esc(naziv) + '">' +
        '<span class="kontakt-kartica__ikona" aria-hidden="true">' + ikonaSvg + "</span>" +
        "</div>" +
        primarniHtml +
        spremembaHtml +
        dodatniHtml +
        '<div class="kontakt-kartica__dodaj"' + (kontaktDodajOdprt[vrsta] ? "" : " hidden") + '>' +
        '<input type="text" class="kontakt-kartica__dodaj-input" data-kontakt-dodaj-vnos="' + vrsta + '" placeholder="' + esc(placeholderText) + '" maxlength="80" />' +
        '<button type="button" class="kontakt-kartica__dodaj-gumb" data-kontakt-dodaj-gumb="' + vrsta + '" aria-label="Dodaj ' + esc(naziv.toLowerCase()) + '">+</button>' +
        '<button type="button" class="kontakt-kartica__dodaj-preklici" data-kontakt-dodaj-preklici="' + vrsta + '" aria-label="Prekliči dodajanje">×</button>' +
        "</div>" +
        "</div>"
      );
    }

    function htmlKontaktneKartice(ctx) {
      var imaTel = Boolean(ctx.imaTelefon);
      var imaEmail = Boolean(ctx.imaEmail);
      var sporociloKanali = ctx.sporociloKanali || { sms: imaTel, email: imaEmail };
      var customContacts = ctx.customContacts || { phoneNumbers: [], emailAddresses: [] };
      var telIzK1 = ctx.primarniTelefon || "";
      var emailIzK1 = ctx.primarniEmail || "";

      return (
        '<div class="kontakt-kartice" role="group" aria-label="Prejemniki za ta korak">' +
        htmlKontaktnaKartica("sms", telIzK1, customContacts.phoneNumbers, Boolean(sporociloKanali.sms), true, false) +
        htmlKontaktnaKartica("email", emailIzK1, customContacts.emailAddresses, Boolean(sporociloKanali.email), true, false) +
        "</div>"
      );
    }

    /** Ena vrstica v razširjenih "Več podatkov o primeru" – če vrednost manjka,
        se vrstica v celoti skrije (razen za ključna polja, ki se izpišejo
        drugje z "Ni podatka"). */
    function vrsticaPovzetka(oznaka, vrednost) {
      var v = vrednost == null ? "" : String(vrednost).trim();
      if (!v) return "";
      return (
        '<div class="opomin-povzetek__vrstica">' +
        '<span class="opomin-povzetek__vrstica-oznaka">' + esc(oznaka) + "</span>" +
        '<span class="opomin-povzetek__vrstica-vrednost">' + esc(v) + "</span>" +
        "</div>"
      );
    }

    /** Kartica "Povzetek primera" na koraku "Predaja odvetniku" – samo za
        branje, podatki neposredno iz 1. koraka (brez podvajanja v
        step.lawyerHandoff; snapshot nastane šele ob "Pripravi predajo"). */
    function htmlPrimerPripravljenZaPredajo() {
      return (
        '<section class="opomin-predaja-info" aria-label="Primer pripravljen za predajo">' +
        '<span class="opomin-predaja-info__ikona" aria-hidden="true">' + IKONA_AKTOVKA + "</span>" +
        '<div class="opomin-predaja-info__besedilo">' +
        '<p class="opomin-predaja-info__naslov">Primer je pripravljen za predajo</p>' +
        '<p class="opomin-predaja-info__opis">Podatki, dokumenti in zgodovina opominov so pripravljeni za pregled.</p>' +
        "</div>" +
        "</section>"
      );
    }

    function htmlPovzetekPrimera(k1) {
      k1 = k1 || {};
      var N = root.UJOpominNacrt;

      var imeDolznika = String(k1.imeDolznika || "").trim() || "Ni podatka";
      var jeFizicnaOseba = k1.vrstaDolznika === "fizicna_oseba";
      var vrstaDolznikaBesedilo = jeFizicnaOseba ? "Fizična oseba" : "Podjetje";

      var znesekBesedilo =
        k1.znesek != null
          ? (Number(k1.znesek) || 0).toLocaleString("sl-SI", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) + " €"
          : "Ni podatka";
      var stevilkaRacunaBesedilo = String(k1.stevilkaRacuna || "").trim() || "Ni podatka";
      var zapadlostBesedilo = k1.datumZapadlosti
        ? formatDatumSl(k1.datumZapadlosti + "T12:00:00")
        : "Ni podatka";

      var zamudaDni =
        N && typeof N.izracunajZamudoDni === "function"
          ? N.izracunajZamudoDni(k1.datumZapadlosti)
          : null;
      var zamudaBesedilo =
        zamudaDni == null
          ? ""
          : zamudaDni > 0
            ? zamudaDni + " dni zamude"
            : "Rok plačila še ni potekel";

      var vecPodatkovHtml =
        vrsticaPovzetka("Vrsta dolžnika", vrstaDolznikaBesedilo) +
        (jeFizicnaOseba
          ? vrsticaPovzetka("Ime in priimek", [k1.ime, k1.priimek].filter(Boolean).join(" "))
          : vrsticaPovzetka("Naziv podjetja", k1.nazivPodjetja)) +
        (jeFizicnaOseba ? "" : vrsticaPovzetka("Davčna številka", k1.davcnaStevilka)) +
        (jeFizicnaOseba ? "" : vrsticaPovzetka("Kontaktna oseba", k1.kontaktnaOseba)) +
        vrsticaPovzetka("Telefon", k1.telefonDolznika) +
        vrsticaPovzetka("E-pošta", k1.emailDolznika) +
        vrsticaPovzetka("Znesek dolga", znesekBesedilo) +
        vrsticaPovzetka("Številka računa", k1.stevilkaRacuna) +
        vrsticaPovzetka(
          "Datum izdaje",
          k1.datumIzdajeRacuna ? formatDatumSl(k1.datumIzdajeRacuna + "T12:00:00") : ""
        ) +
        vrsticaPovzetka("Rok plačila", zapadlostBesedilo) +
        vrsticaPovzetka("Kaj je bilo opravljeno", k1.opisDolga) +
        vrsticaPovzetka("Zamuda", zamudaBesedilo);

      return (
        '<section class="opomin-povzetek" aria-label="Povzetek primera">' +
        '<h3 class="opomin-povzetek__naslov">Povzetek primera</h3>' +
        '<div class="opomin-povzetek__dolznik">' +
        '<span class="opomin-povzetek__dolznik-ikona" aria-hidden="true">' + IKONA_DOLZNIK + "</span>" +
        '<span class="opomin-povzetek__dolznik-besedilo">' +
        '<span class="opomin-povzetek__dolznik-oznaka">Dolžnik</span>' +
        '<span class="opomin-povzetek__dolznik-ime">' + esc(imeDolznika) + "</span>" +
        "</span>" +
        "</div>" +
        '<div class="opomin-povzetek__osnovni">' +
        '<div class="opomin-povzetek__polje">' +
        '<span class="opomin-povzetek__polje-oznaka">Račun</span>' +
        '<span class="opomin-povzetek__polje-vrednost">' + esc(stevilkaRacunaBesedilo) + "</span>" +
        "</div>" +
        '<div class="opomin-povzetek__polje">' +
        '<span class="opomin-povzetek__polje-oznaka">Dolg</span>' +
        '<span class="opomin-povzetek__polje-vrednost">' + esc(znesekBesedilo) + "</span>" +
        "</div>" +
        '<div class="opomin-povzetek__polje">' +
        '<span class="opomin-povzetek__polje-oznaka">Zapadlost</span>' +
        '<span class="opomin-povzetek__polje-vrednost">' + esc(zapadlostBesedilo) + "</span>" +
        "</div>" +
        "</div>" +
        '<button type="button" class="opomin-povzetek__vec" id="opomin-povzetek-vec" aria-expanded="false" aria-controls="opomin-povzetek-vec-vsebina">' +
        '<span>Več podatkov o primeru</span>' +
        '<span class="opomin-povzetek__vec-puscica" aria-hidden="true">⌄</span>' +
        "</button>" +
        '<div class="opomin-povzetek__vec-vsebina" id="opomin-povzetek-vec-vsebina">' +
        '<div class="opomin-povzetek__vec-notranji">' +
        vecPodatkovHtml +
        "</div></div>" +
        "</section>"
      );
    }

    /** Podatki enega (samodejnega, 1.–9.) koraka za prikaz v zgodovini
        opominov na koraku "Predaja odvetniku" – bere neposredno iz koraka,
        brez podvajanja v lawyerHandoff. */
    function podatkiZgodovineKoraka(step, k1, k2) {
      var N = root.UJOpominNacrt;
      var resolvedRandom = dolocenRandomCas(step);
      var iso = resolvedRandom || step.sentAt || step.sendAt || step.scheduledAt;
      var statusBesedilo =
        step.status === "sent"
          ? "Poslano"
          : step.status === "failed"
            ? "Ni uspelo"
            : step.status === "skipped"
              ? "Preskočeno"
              : step.status === "confirmed"
                ? "Potrjeno"
                : "Načrtovano";

      var primarniKontakti = step.primaryContacts || (k2 && k2.sporociloKanali) || { sms: true, email: true };
      var dodatniKontakti = step.customContacts || {};
      var kanali = [];
      if (
        (primarniKontakti.sms !== false && k1 && k1.telefonDolznika) ||
        (Array.isArray(dodatniKontakti.phoneNumbers) && dodatniKontakti.phoneNumbers.length)
      ) {
        kanali.push("SMS");
      }
      if (
        (primarniKontakti.email !== false && k1 && k1.emailDolznika) ||
        (Array.isArray(dodatniKontakti.emailAddresses) && dodatniKontakti.emailAddresses.length)
      ) {
        kanali.push("E-pošta");
      }

      return {
        index: step.index,
        naslov: step.title || "",
        iso: iso,
        status: step.status,
        statusBesedilo: statusBesedilo,
        jePoslano: step.status === "sent",
        kanalBesedilo: kanali.length ? kanali.join(" · ") : "—",
        predogled: String(step.finalMessage || step.generatedMessage || "").trim(),
        tonOznaka: N && typeof N.oznakaTona === "function" ? N.oznakaTona(step.toneId) : "—",
        predlogaOznaka: imePredloge(step, k2),
      };
    }

    function htmlZgodovinaKartica(p) {
      return (
        '<button type="button" class="opomin-zgodovina__kartica" data-zgodovina-korak="' +
        p.index +
        '" role="listitem" aria-label="' +
        esc(p.index + ". korak, " + p.naslov + ", " + p.statusBesedilo) +
        '">' +
        '<div class="opomin-zgodovina__kartica-glava">' +
        '<span class="opomin-zgodovina__kartica-stevilka">' +
        p.index +
        "</span>" +
        '<span class="opomin-zgodovina__kartica-naslov">' +
        esc(p.naslov) +
        "</span>" +
        "</div>" +
        '<span class="opomin-zgodovina__status opomin-zgodovina__status--' +
        esc(p.status) +
        '">' +
        esc(p.statusBesedilo) +
        "</span>" +
        '<div class="opomin-zgodovina__kartica-cas">' +
        IKONA_KOLEDAR_MAJHNA +
        esc(formatCasPolno(p.iso)) +
        "</div>" +
        '<div class="opomin-zgodovina__kartica-kanal">' +
        IKONA_POSILJANJE +
        esc(p.kanalBesedilo) +
        "</div>" +
        '<div class="opomin-zgodovina__kartica-locilo" aria-hidden="true"></div>' +
        '<div class="opomin-zgodovina__kartica-predogled">' +
        esc(p.predogled || "Brez sporočila.") +
        "</div>" +
        "</button>"
      );
    }

    function htmlZgodovinaOpominov(plan, k1, k2) {
      var koraki = (plan.steps || [])
        .slice(0, -1)
        .filter(function (s) {
          return !s.isExcluded;
        });
      if (!koraki.length) return "";
      var poslanih = koraki.filter(function (s) {
        return s.status === "sent";
      }).length;
      var kartice = koraki
        .map(function (s) {
          return htmlZgodovinaKartica(podatkiZgodovineKoraka(s, k1, k2));
        })
        .join("");
      var pikeHtml = koraki
        .map(function (_, i) {
          return (
            '<button type="button" class="opomin-zgodovina__pika' +
            (i === 0 ? " opomin-zgodovina__pika--aktivna" : "") +
            '" data-pika="' +
            i +
            '" aria-label="Kartica ' +
            (i + 1) +
            " od " +
            koraki.length +
            "\"></button>"
          );
        })
        .join("");
      return (
        '<section class="opomin-zgodovina" aria-label="Zgodovina opominov">' +
        '<div class="opomin-zgodovina__glava">' +
        '<h3 class="opomin-zgodovina__naslov">' +
        poslanih +
        " poslanih opominov</h3>" +
        '<button type="button" class="opomin-zgodovina__poglej-vse" id="opomin-zgodovina-poglej-vse">Poglej vse ' +
        '<span aria-hidden="true">→</span></button>' +
        "</div>" +
        '<div class="opomin-zgodovina__drsnik-ovoj">' +
        '<div class="opomin-zgodovina__drsnik" role="list" aria-label="Seznam poslanih opominov" tabindex="0">' +
        kartice +
        "</div>" +
        "</div>" +
        '<div class="opomin-zgodovina__pike" role="tablist" aria-label="Kartice">' +
        pikeHtml +
        "</div>" +
        "</section>"
      );
    }

    function htmlZgodovinaPodrobnosti(p) {
      return (
        '<div class="opomin-zgodovina-podrobnosti">' +
        '<div class="opomin-zgodovina-podrobnosti__glava">' +
        '<span class="opomin-zgodovina-podrobnosti__stevilka">' +
        p.index +
        ". korak</span>" +
        '<span class="opomin-zgodovina__status opomin-zgodovina__status--' +
        esc(p.status) +
        '">' +
        esc(p.statusBesedilo) +
        "</span>" +
        "</div>" +
        '<h3 class="opomin-zgodovina-podrobnosti__naslov">' +
        esc(p.naslov) +
        "</h3>" +
        '<dl class="opomin-zgodovina-podrobnosti__meta">' +
        "<div><dt>Datum in ura</dt><dd>" +
        esc(formatCasPolno(p.iso)) +
        "</dd></div>" +
        "<div><dt>Kanal</dt><dd>" +
        esc(p.kanalBesedilo) +
        "</dd></div>" +
        "<div><dt>Ton</dt><dd>" +
        esc(p.tonOznaka) +
        "</dd></div>" +
        "<div><dt>Predloga</dt><dd>" +
        esc(p.predlogaOznaka) +
        "</dd></div>" +
        "</dl>" +
        '<p class="opomin-zgodovina-podrobnosti__label">Sporočilo</p>' +
        '<p class="opomin-zgodovina-podrobnosti__sporocilo">' +
        esc(p.predogled || "Brez sporočila.") +
        "</p>" +
        "</div>"
      );
    }

    function htmlZgodovinaSeznam(vsiPodatki) {
      return (
        '<div class="opomin-zgodovina-seznam" role="list">' +
        vsiPodatki
          .map(function (p) {
            return (
              '<button type="button" class="opomin-zgodovina-seznam__vrstica" data-zgodovina-korak="' +
              p.index +
              '" role="listitem" aria-label="Podrobnosti: ' +
              esc(p.index + ". korak, " + p.naslov) +
              '">' +
              '<span class="opomin-zgodovina-seznam__st">' +
              p.index +
              "</span>" +
              '<span class="opomin-zgodovina-seznam__besedilo">' +
              '<span class="opomin-zgodovina-seznam__naslov">' +
              esc(p.naslov) +
              "</span>" +
              '<span class="opomin-zgodovina-seznam__cas">' +
              esc(formatCasPolno(p.iso)) +
              " · " +
              esc(p.kanalBesedilo) +
              "</span>" +
              "</span>" +
              '<span class="opomin-zgodovina__status opomin-zgodovina__status--' +
              esc(p.status) +
              '">' +
              esc(p.statusBesedilo) +
              "</span>" +
              "</button>"
            );
          })
          .join("") +
        "</div>"
      );
    }

    /* ========== Predaja odvetniku – odvetnik / namen / sporočilo / dokumenti
       (Faza 4). Samo za koraka "manual_lawyer"; branje/pisanje neposredno v
       step.lawyerHandoff, brez podvajanja podatkov iz koraka 1 ali priponk. */

    /* Lebdeča pill kartica izbranega odvetnika nad sestavljalnikom 10. koraka.
       Desna oznaka jasno pove, da klik odpre pregled vseh odvetnikov. */
    function htmlPredajaOdvetnikPill(step) {
      var lh = (step && step.lawyerHandoff) || {};
      var snap = lh.lawyerSnapshot || {};
      var ime = String(snap.name || snap.officeName || "").trim();
      var imaOdvetnika = Boolean(ime);
      var zaklenjeno = lh.status === "handed_over";
      var inicialke = imaOdvetnika ? inicialkeOdvetnika({ name: ime }) : "";
      return (
        '<button type="button" class="opomin-predaja-sestavljalnik__odvetnik-pill' +
        (imaOdvetnika ? "" : " opomin-predaja-sestavljalnik__odvetnik-pill--prazno") +
        '" id="opomin-predaja-odvetnik-pill"' +
        (zaklenjeno ? " disabled aria-disabled=\"true\"" : "") +
        ' aria-label="' +
        (imaOdvetnika
          ? "Odvetnik " + esc(ime) + ". Kliknite za spremembo."
          : "Izberite odvetnika.") +
        '">' +
        '<span class="opomin-predaja-sestavljalnik__odvetnik-avatar" aria-hidden="true">' +
        (imaOdvetnika ? esc(inicialke) : "+") +
        "</span>" +
        '<span class="opomin-predaja-sestavljalnik__odvetnik-besedilo">' +
        (imaOdvetnika
          ? ""
          : '<span class="opomin-predaja-sestavljalnik__odvetnik-oznaka">Odvetnik</span>') +
        '<span class="opomin-predaja-sestavljalnik__odvetnik-ime" data-fit-text data-fit-text-min="8.5">' +
        esc(imaOdvetnika ? ime : "Izberite odvetnika") +
        "</span>" +
        "</span>" +
        '<span class="opomin-predaja-sestavljalnik__odvetnik-vsi">' +
        '<span data-fit-text data-fit-text-min="8">Preglej vse odvetnike</span>' +
        '<span class="opomin-predaja-sestavljalnik__odvetnik-chevron" aria-hidden="true">' +
        IKONA_CHEVRON_DESNO +
        "</span>" +
        "</span>" +
        "</button>"
      );
    }

    var DNEVI_PREDAJE_OZNAKE = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];
    var PRIVZETI_DNEVI_PREDAJE = [true, true, true, true, true, false, false];

    function dneviPredajeKoraka(step) {
      var dnevi = step && step.lawyerHandoff && step.lawyerHandoff.availableHandoffDays;
      if (!Array.isArray(dnevi) || dnevi.length !== 7 || !dnevi.some(Boolean)) {
        return PRIVZETI_DNEVI_PREDAJE.slice();
      }
      return dnevi.map(Boolean);
    }

    function sloIndexDneva(datum) {
      var dan = datum.getDay();
      return dan === 0 ? 6 : dan - 1;
    }

    function najzgodnejsiCasPredaje(dnevi) {
      var kandidat = new Date(Date.now() + 5 * 60 * 1000);
      kandidat.setSeconds(0, 0);
      kandidat.setMinutes(Math.ceil(kandidat.getMinutes() / 5) * 5);
      if (dnevi[sloIndexDneva(kandidat)]) return kandidat.toISOString();
      for (var zamik = 1; zamik <= 7; zamik += 1) {
        var naslednji = new Date(kandidat);
        naslednji.setDate(kandidat.getDate() + zamik);
        naslednji.setHours(9, 0, 0, 0);
        if (dnevi[sloIndexDneva(naslednji)]) return naslednji.toISOString();
      }
      return kandidat.toISOString();
    }

    function casPredajeKoraka(step) {
      var lh = (step && step.lawyerHandoff) || {};
      if (lh.scheduledHandoffAt && !Number.isNaN(new Date(lh.scheduledHandoffAt).getTime())) {
        return lh.scheduledHandoffAt;
      }
      return najzgodnejsiCasPredaje(dneviPredajeKoraka(step));
    }

    function oznakaDnevaPredaje(iso) {
      var datum = new Date(iso);
      if (Number.isNaN(datum.getTime())) return "";
      var jeNemsko = Boolean(
        root.document &&
        root.document.documentElement &&
        /^de(?:-|$)/i.test(root.document.documentElement.lang || "")
      );
      var danes = new Date();
      danes.setHours(0, 0, 0, 0);
      var ciljniDan = new Date(datum);
      ciljniDan.setHours(0, 0, 0, 0);
      var razlikaDni = Math.round((ciljniDan.getTime() - danes.getTime()) / 86400000);
      if (razlikaDni === 0) return jeNemsko ? "Heute" : "Danes";
      if (razlikaDni === 1) return jeNemsko ? "Morgen" : "Jutri";
      var dneviSl = ["Nedelja", "Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota"];
      var dneviDe = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
      return (jeNemsko ? dneviDe : dneviSl)[datum.getDay()];
    }

    function htmlPredajaDnevi(step) {
      var lh = (step && step.lawyerHandoff) || {};
      var dnevi = dneviPredajeKoraka(step);
      var zaklenjeno = lh.status === "handed_over";
      var nacinCasa = lh.handoffTimingMode === "custom" ? "custom" : "asap";
      var casIso = casPredajeKoraka(step);
      var oznakaDneva = oznakaDnevaPredaje(casIso);
      var gumbi = DNEVI_PREDAJE_OZNAKE.map(function (oznaka, index) {
        var aktiven = dnevi[index];
        return (
          '<button type="button" class="opomin-predaja-sestavljalnik__dan' +
          (aktiven ? " opomin-predaja-sestavljalnik__dan--aktiven" : "") +
          '" data-predaja-dan="' + index + '" aria-pressed="' +
          (aktiven ? "true" : "false") + '" aria-label="' +
          esc(oznaka + (aktiven ? ", izbran dan" : ", neizbran dan")) + '"' +
          (zaklenjeno ? ' disabled aria-disabled="true"' : "") + '>' +
          esc(oznaka) + "</button>"
        );
      }).join("");

      return (
        '<section class="opomin-predaja-sestavljalnik__dnevi" aria-labelledby="opomin-predaja-dnevi-naslov">' +
        '<div class="opomin-predaja-sestavljalnik__dnevi-glava">' +
        '<span class="opomin-predaja-sestavljalnik__dnevi-ikona" aria-hidden="true">' +
        IKONA_KOLEDAR_MAJHNA + "</span>" +
        '<h3 class="opomin-predaja-sestavljalnik__dnevi-naslov" id="opomin-predaja-dnevi-naslov">Možni dnevi predaje</h3>' +
        '<span class="opomin-predaja-sestavljalnik__dnevi-znacka">Po navodilih odvetnika</span>' +
        "</div>" +
        '<div class="opomin-predaja-sestavljalnik__dnevi-vrstica" role="group" aria-label="Možni dnevi predaje">' +
        gumbi + "</div>" +
        '<p class="opomin-predaja-sestavljalnik__dnevi-pomoc">Privzeto nastavi izbrani odvetnik <span aria-hidden="true">·</span> lahko spremenite</p>' +
        '<div class="opomin-predaja-sestavljalnik__cas" aria-label="Čas predaje">' +
        '<div class="opomin-predaja-sestavljalnik__cas-vrstica' +
        (nacinCasa === "asap" ? " opomin-predaja-sestavljalnik__cas-vrstica--aktivna" : "") + '">' +
        '<button type="button" class="opomin-predaja-sestavljalnik__cas-gumb" data-predaja-cas-nacin="asap" aria-pressed="' +
        (nacinCasa === "asap" ? "true" : "false") + '"' +
        (zaklenjeno ? ' disabled aria-disabled="true"' : "") + '>Čimprej</button>' +
        '<span class="opomin-predaja-sestavljalnik__cas-rezultat">' +
        '<strong class="opomin-predaja-sestavljalnik__cas-dan' +
        (oznakaDneva.length > 7 ? " opomin-predaja-sestavljalnik__cas-dan--dolg" : "") + '">' +
        esc(oznakaDneva) + "</strong>" +
        '<span class="opomin-predaja-sestavljalnik__cas-datum-ura">' +
        esc(formatDatumKratekDDMM(casIso)) + '<span aria-hidden="true"> · </span>' +
        esc(formatCasKratko(casIso)) + "</span></span>" +
        "</div>" +
        '<div class="opomin-predaja-sestavljalnik__cas-vrstica opomin-predaja-sestavljalnik__cas-vrstica--rocno' +
        (nacinCasa === "custom" ? " opomin-predaja-sestavljalnik__cas-vrstica--aktivna" : "") + '">' +
        '<button type="button" class="opomin-predaja-sestavljalnik__cas-gumb" data-predaja-cas-nacin="custom" aria-pressed="' +
        (nacinCasa === "custom" ? "true" : "false") + '"' +
        (zaklenjeno ? ' disabled aria-disabled="true"' : "") + '>Določi čas</button>' +
        '<span class="opomin-predaja-sestavljalnik__cas-vnosa">' +
        '<label class="opomin-predaja-sestavljalnik__cas-polje">' +
        '<input type="date" id="opomin-predaja-cas-datum" min="' + esc(isoZaDateInput(new Date().toISOString())) +
        '" value="' + esc(isoZaDateInput(casIso)) + '" aria-label="Datum predaje odvetniku"' +
        (zaklenjeno ? " disabled" : "") + ' /></label>' +
        '<label class="opomin-predaja-sestavljalnik__cas-polje">' +
        '<input type="time" id="opomin-predaja-cas-ura" value="' + esc(isoZaTimeInput(casIso)) +
        '" aria-label="Ura predaje odvetniku"' + (zaklenjeno ? " disabled" : "") + ' /></label>' +
        "</span></div>" +
        '<p class="opomin-predaja-sestavljalnik__cas-napaka" id="opomin-predaja-cas-napaka" role="alert" hidden></p>' +
        "</div>" +
        "</section>"
      );
    }

    var NAMENI_PREDAJE_META = [
      { value: "review", label: "Pregled primera", ikona: IKONA_NAMEN_PREGLED },
      { value: "debt_collection", label: "Izterjava dolga", ikona: IKONA_NAMEN_EURO },
      { value: "legal_proceedings", label: "Pravni postopek", ikona: IKONA_NAMEN_SODISCE },
    ];

    function htmlNamenPredaje(step) {
      var lh = (step && step.lawyerHandoff) || {};
      var izbran = lh.requestedAction || "debt_collection";
      var gumbi = NAMENI_PREDAJE_META.map(function (n) {
        var aktiven = n.value === izbran;
        return (
          '<button type="button" class="opomin-namen__gumb' +
          (aktiven ? " opomin-namen__gumb--aktiven" : "") +
          '" data-namen-predaje="' +
          n.value +
          '" role="radio" aria-checked="' +
          (aktiven ? "true" : "false") +
          '">' +
          '<span class="opomin-namen__gumb-ikona" aria-hidden="true">' +
          n.ikona +
          "</span>" +
          '<span class="opomin-namen__gumb-label">' +
          esc(n.label) +
          "</span>" +
          "</button>"
        );
      }).join("");
      return (
        '<div class="opomin-namen__sklop">' +
        '<h3 class="opomin-namen__naslov">Kaj želite od odvetnika?</h3>' +
        '<div class="opomin-namen__vrstica" role="radiogroup" aria-label="Namen predaje">' +
        gumbi +
        "</div>" +
        "</div>"
      );
    }

    /* Neposredno urejevalno polje "Sporočilo odvetniku" znotraj sestavljalnika
       10. koraka. Akciji za obnovitev in shranjevanje sta vidni samo med
       urejanjem; sam klik izven polja spremembe ne potrdi. */
    function htmlPredajaSporocilo(step) {
      var lh = (step && step.lawyerHandoff) || {};
      var besedilo = String(lh.message || "");
      var zaklenjeno = lh.status === "handed_over";
      return (
        '<section class="opomin-predaja-sestavljalnik__sporocilo" aria-label="Sporočilo odvetniku">' +
        '<div class="opomin-predaja-sestavljalnik__sporocilo-glava">' +
        '<span class="opomin-predaja-sestavljalnik__sporocilo-ikona" aria-hidden="true">' +
        IKONA_PREDAJA_SPOROCILO +
        "</span>" +
        '<span class="opomin-predaja-sestavljalnik__sporocilo-naslovi">' +
        '<h3 class="opomin-predaja-sestavljalnik__sporocilo-naslov">Sporočilo odvetniku</h3>' +
        '<p class="opomin-predaja-sestavljalnik__sporocilo-podnaslov">Sporočilo lahko še dopolnite.</p>' +
        "</span>" +
        "</div>" +
        '<label class="opomin-predaja-sestavljalnik__sr-only" for="opomin-predaja-sporocilo-textarea">Sporočilo odvetniku</label>' +
        '<div class="opomin-predaja-sestavljalnik__sporocilo-polje-ovoj">' +
        '<textarea class="opomin-predaja-sestavljalnik__sporocilo-textarea" id="opomin-predaja-sporocilo-textarea" maxlength="2000"' +
        (zaklenjeno ? " readonly aria-readonly=\"true\"" : "") +
        ">" +
        esc(besedilo) +
        "</textarea>" +
        (zaklenjeno
          ? ""
          : '<span class="opomin-predaja-sestavljalnik__sporocilo-svincnik" aria-hidden="true">' +
            IKONA_SVINCNIK +
            "</span>") +
        "</div>" +
        (zaklenjeno
          ? ""
          : '<div class="opomin-predaja-sestavljalnik__sporocilo-akcije" id="opomin-predaja-sporocilo-akcije" hidden>' +
            '<button type="button" class="opomin-predaja-sestavljalnik__sporocilo-vrni" id="opomin-predaja-sporocilo-vrni">Vrni v prejšnje stanje</button>' +
            '<button type="button" class="opomin-predaja-sestavljalnik__sporocilo-shrani" id="opomin-predaja-sporocilo-shrani">Shrani</button>' +
            "</div>") +
        "</section>"
      );
    }

    /* ========== Kaj se bo zgodilo – paketi odvetniških storitev ========== */
    var LAWYER_ACTION_PACKAGES = [
      {
        id: "lawyer_demand_letter",
        title: "Odvetnik pošlje opomin",
        shortDescription: "Uradni odvetniški opomin z rokom za plačilo.",
        icon: "mail",
        priceCents: 2990,
        pricePrefix: "",
        priceSuffix: "enkratno",
        includedInPlan: false,
        badge: "Priporočeno",
        actionLabel: "Odvetniški opomin",
        actionMicrocopy: "Pošlje odvetnik",
        previewTitle: "Odvetniški opomin",
        flowTitle: "Odvetniški opomin",
        flowActionText: "bo poslan po vaši potrditvi",
        requiresSurcharge: false,
        includedItems: [
          "Pregled podatkov in dokumentov",
          "Priprava uradnega odvetniškega opomina",
          "Pošiljanje dolžniku po vaši potrditvi",
          "Evidenca izvedenega koraka v primeru",
        ],
      },
      {
        id: "lawyer_phone_call",
        title: "Odvetnik pokliče dolžnika",
        shortDescription: "Osebni telefonski poziv k plačilu.",
        icon: "phone",
        priceCents: 4990,
        pricePrefix: "",
        priceSuffix: "enkratno",
        includedInPlan: false,
        actionLabel: "Klic dolžniku",
        actionMicrocopy: "Pokliče odvetnik",
        previewTitle: "Telefonski poziv",
        flowTitle: "Odvetniški klic",
        flowActionText: "bo izveden po vaši potrditvi",
        requiresSurcharge: true,
        includedItems: [
          "Pregled osnovnih podatkov primera",
          "Priprava na telefonski pogovor",
          "Telefonski poziv dolžniku",
          "Evidenca rezultata pogovora",
        ],
      },
      {
        id: "legal_proceeding",
        title: "Začetek pravnega postopka",
        shortDescription: "Priprava primera za formalni pravni postopek.",
        icon: "scales",
        priceCents: 14900,
        pricePrefix: "od",
        priceSuffix: "",
        includedInPlan: false,
        actionLabel: "Pravni postopek",
        actionMicrocopy: "Pripravi odvetnik",
        previewTitle: "Začetek pravnega postopka",
        flowTitle: "Pravni postopek",
        flowActionText: "se začne po vaši potrditvi",
        requiresSurcharge: true,
        includedItems: [
          "Pregled pravne podlage",
          "Pregled dokazil",
          "Predlog nadaljnjega postopka",
          "Ocena morebitnih dodatnih stroškov",
        ],
      },
      {
        id: "case_review",
        title: "Samo pregled primera",
        shortDescription: "Odvetnik pregleda primer in poda priporočilo.",
        icon: "document",
        priceCents: 0,
        pricePrefix: "",
        priceSuffix: "",
        includedInPlan: true,
        actionLabel: "Pregled primera",
        actionMicrocopy: "Pregleda odvetnik",
        previewTitle: "Pregled primera",
        flowTitle: "Pregled primera",
        flowActionText: "bo opravljen po vaši potrditvi",
        requiresSurcharge: false,
        includedItems: [
          "Pregled podatkov primera",
          "Pregled priloženih dokazil",
          "Ocena možnosti nadaljevanja",
          "Priporočilo odvetnika",
        ],
      },
    ];

    /* Dodatna peta kartica v obstoječem carousel-u. Prvi štirje paketi
       ostanejo nespremenjeni; ta kartica samo odpre sestavljalnik storitev. */
    var CUSTOM_LAWYER_PACKAGE_CARD = {
      id: "custom_lawyer_services",
      title: "Sestavite paket storitev",
      shortDescription: "Združite več odvetniških rešitev v paket po meri.",
      icon: "document",
      priceCents: 0,
      pricePrefix: "",
      priceSuffix: "",
      includedInPlan: true,
      actionLabel: "Paket po meri",
      actionMicrocopy: "Izberete sami",
      previewTitle: "Paket storitev po meri",
      flowTitle: "Paket po meri",
      flowActionText: "bo sestavljen po vaši izbiri",
      requiresSurcharge: false,
      includedItems: [],
      isCustomBuilder: true,
    };

    var CUSTOM_LAWYER_SERVICES = [
      { id: "lawyer_demand_letter", title: "Odvetnik pošlje opomin", description: "Odvetnik pošlje uradni opomin za plačilo v vašem imenu.", icon: "mail", priceCents: 2990, includedItems: ["Pregled podatkov o dolgu", "Priprava odvetniškega opomina", "Pošiljanje opomina dolžniku"] },
      { id: "lawyer_phone_call", title: "Odvetnik pokliče dolžnika", description: "Odvetnik pokliče dolžnika in ga pozove k plačilu.", icon: "phone", priceCents: 4990, includedItems: ["Pregled primera pred klicem", "Telefonski poziv k plačilu", "Kratek povzetek opravljenega klica"] },
      { id: "case_review", title: "Pregled primera", description: "Odvetnik pregleda vaš primer in oceni možnosti za izterjavo.", icon: "document", priceCents: 1990, includedItems: ["Pregled ključnih dokumentov", "Ocena pravnega položaja", "Predlog naslednjega koraka"] },
      { id: "legal_proceeding", title: "Začetek pravnega postopka", description: "Odvetnik pripravi začetek sodnega postopka za izterjavo dolga.", icon: "scales", priceCents: null, priceOnRequest: true, includedItems: ["Pregled pogojev za postopek", "Priprava potrebne dokumentacije", "Ocena stroškov pred začetkom"] },
      { id: "payment_agreement", title: "Predlog plačilnega dogovora", description: "Odvetnik pripravi dogovor o obročnem plačilu z jasnimi roki.", icon: "document", priceCents: 3990, includedItems: ["Priprava plačilnega načrta", "Določitev rokov in obrokov", "Osnutek dogovora za dolžnika"] },
      { id: "asset_check", title: "Preverjanje premoženja", description: "Odvetnik preveri razpoložljive podatke in oceni smiselnost izterjave.", icon: "scales", priceCents: 6990, includedItems: ["Pregled razpoložljivih podatkov", "Ocena možnosti poplačila", "Priporočilo glede nadaljnje izterjave"] },
    ];

    var LAWYER_PROFILES = [
      {
        id: "joze_kovac",
        name: "Odvetnik Jože Kovač",
        shortName: "Odvetnik Jože",
        officeName: "Odvetniška pisarna Kovač",
        email: "joze.kovac@primer.si",
        phone: "+386 1 555 01 10",
        availableHandoffDays: [true, true, true, true, true, false, false],
        attachmentRequirements: {
          invoice: { question: "Na kateri posel se nanaša račun?", required: false },
          contract: { question: "Ali je bila pogodba podpisana?", required: false },
          work_evidence: {
            recommendation: "Po priporočilu odvetnika priložite slike prvotnega stanja.",
            question: "Kdaj in kje je bila fotografija posneta ter kaj prikazuje?",
            required: true,
          },
        },
        city: "Ljubljana",
        rating: "4,9",
        experience: "12 let izkušenj",
        specialty: "Izterjava dolgov in gospodarsko pravo",
        description: "Podjetjem pomaga pri hitri in premišljeni izterjavi zapadlih obveznosti. Poseben poudarek daje jasni komunikaciji in rešitvam brez nepotrebnih sodnih stroškov.",
        services: ["Odvetniški opomini", "Telefonska izterjava", "Pregled primerov", "Gospodarski spori"],
      },
      {
        id: "ana_novak",
        name: "Odvetnica Ana Novak",
        shortName: "Odvetnica Ana",
        officeName: "Pravna pisarna Novak",
        email: "ana.novak@primer.si",
        phone: "+386 1 555 02 20",
        availableHandoffDays: [true, true, true, true, true, false, false],
        attachmentRequirements: {
          invoice: { question: "Na kateri posel se nanaša račun?", required: false },
          contract: { question: "Kdaj in kako je bila pogodba sklenjena?", required: true },
          work_evidence: {
            recommendation: "Po priporočilu odvetnice priložite slike prvotnega stanja in dogovorjenega rezultata.",
            question: "Kaj je na prilogi in kako dokazuje opravljeno delo?",
            required: true,
          },
        },
        city: "Maribor",
        rating: "4,8",
        experience: "9 let izkušenj",
        specialty: "Pogajanja in plačilni dogovori",
        description: "Specializirana je za pogajanja z dolžniki, pripravo plačilnih dogovorov in mirno reševanje poslovnih sporov.",
        services: ["Plačilni dogovori", "Pogajanja z dolžniki", "Pregled dokumentacije", "Odvetniški opomini"],
      },
      {
        id: "marko_zupan",
        name: "Odvetnik Marko Župan",
        shortName: "Odvetnik Marko",
        officeName: "Župan pravno svetovanje",
        email: "marko.zupan@primer.si",
        phone: "+386 4 555 03 30",
        availableHandoffDays: [true, true, true, true, true, false, false],
        attachmentRequirements: {
          invoice: { question: "Kdaj je račun zapadel v plačilo?", required: true },
          contract: { question: "Kdaj in kako je bila pogodba sklenjena?", required: true },
          work_evidence: {
            recommendation: "Po priporočilu odvetnika priložite slike prvotnega stanja, poteka in končnega rezultata.",
            question: "Kdaj je priloga nastala in s katerim opravljenim delom je povezana?",
            required: true,
          },
        },
        city: "Kranj",
        rating: "4,7",
        experience: "15 let izkušenj",
        specialty: "Sodni postopki in izvršba",
        description: "Izkušen je na področju sodnih postopkov, izvršbe in zahtevnejših primerov poslovne izterjave.",
        services: ["Sodni postopki", "Izvršba", "Preverjanje premoženja", "Zahtevnejša izterjava"],
      },
    ];

    var PACKAGE_BEST_LAWYER = {
      lawyer_demand_letter: "joze_kovac",
      lawyer_phone_call: "ana_novak",
      legal_proceeding: "marko_zupan",
      case_review: "joze_kovac",
      custom_lawyer_services: "ana_novak",
    };

    function shraniZahtevePrilogIzbranegaOdvetnika(lawyer) {
      if (!lawyer || !lawyer.attachmentRequirements) return;
      var k1 = opts.podatkiKorak1 || {};
      k1.odvetnikZahtevePrilog = JSON.parse(
        JSON.stringify(lawyer.attachmentRequirements)
      );
      k1.izbraniOdvetnikZaZahteve = {
        id: lawyer.id,
        name: lawyer.name,
      };
      try {
        sessionStorage.setItem("neplacilo-korak1-podatki", JSON.stringify(k1));
      } catch (_napakaShranjevanjaZahtevOdvetnika) {
        /* Zahteve ostanejo v trenutnem stanju tudi brez sejne shrambe. */
      }
    }

    var PACKAGE_LAWYER_OFFERS = {
      lawyer_demand_letter: ["joze_kovac", "ana_novak", "marko_zupan"],
      lawyer_phone_call: ["ana_novak", "joze_kovac", "marko_zupan"],
      legal_proceeding: ["marko_zupan", "joze_kovac", "ana_novak"],
      case_review: ["joze_kovac", "ana_novak", "marko_zupan"],
      custom_lawyer_services: ["ana_novak", "joze_kovac", "marko_zupan"],
    };

    function najdiProfilOdvetnika(id) {
      return LAWYER_PROFILES.find(function (lawyer) { return lawyer.id === id; }) || null;
    }

    function inicialkeOdvetnika(lawyer) {
      var deli = String((lawyer && lawyer.name) || "OD").replace(/^Odvetnik(?:a)?\s+/i, "").trim().split(/\s+/);
      return ((deli[0] || "O").charAt(0) + (deli[1] || deli[0] || "D").charAt(0)).toUpperCase();
    }

    function pridobiFilterPonudb(step) {
      var lh = (step && step.lawyerHandoff) || {};
      var custom = Array.isArray(lh.customLawyers) ? lh.customLawyers : [];
      var sistemIds = LAWYER_PROFILES.map(function (lawyer) { return lawyer.id; });
      var customIds = custom.map(function (c) { return c.id; });
      var vsiIds = sistemIds.concat(customIds);

      function ocisti(seznam) {
        var ids = (Array.isArray(seznam) ? seznam : [])
          .map(function (id) { return String(id == null ? "" : id).trim(); })
          .filter(Boolean);
        ids = Array.from(new Set(ids));
        return ids.filter(function (id) { return vsiIds.indexOf(id) >= 0; });
      }

      var f = lh.offerFilter;
      if (f && f.mode === "single_lawyer" && f.singleLawyerId) {
        var idsSingle = ocisti(f.lawyerIds);
        if (idsSingle.indexOf(String(f.singleLawyerId)) >= 0) {
          return { mode: "single_lawyer", lawyerIds: idsSingle, singleLawyerId: String(f.singleLawyerId) };
        }
      }
      if (f && f.mode === "best_match") {
        var idsBest = ocisti(f.lawyerIds);
        if (idsBest.length) return { mode: "best_match", lawyerIds: idsBest, singleLawyerId: null };
      }
      if (Array.isArray(lh.visibleLawyerIds) && lh.visibleLawyerIds.length) {
        var idsVisible = ocisti(lh.visibleLawyerIds);
        if (idsVisible.length) return { mode: "best_match", lawyerIds: idsVisible, singleLawyerId: null };
      }
      return { mode: "best_match", lawyerIds: vsiIds.slice(), singleLawyerId: null };
    }

    function prikazaniOdvetniki(step) {
      return pridobiFilterPonudb(step).lawyerIds;
    }

    function ponudbeZaPrikaz(step) {
      var filter = pridobiFilterPonudb(step);
      var lh = (step && step.lawyerHandoff) || {};
      var vidni = filter.lawyerIds;
      var izbraniPaketId = (lh.selectedPackage && lh.selectedPackage.packageId) || null;
      var izbraniLawyerId = lh.lawyerId || null;

      var pripetiId = {};
      var rezultat = [];

      function dodaj(pkg, lawyer) {
        if (!pkg || pripetiId[pkg.id]) return;
        pripetiId[pkg.id] = true;
        rezultat.push({ package: pkg, lawyer: lawyer || null });
      }

      /* Že izbrani paket (sistemski) pripnemo na začetek, tudi če njegov
         odvetnik ni več v filtru – ohrani oznako "Izbrano" in izbiro. */
      var izbraniPaket = izbraniPaketId ? najdiPaket(izbraniPaketId) : null;
      if (izbraniPaket) {
        dodaj(izbraniPaket, najdiProfilOdvetnika(izbraniLawyerId));
      }

      paketiZaCarousel().forEach(function (pkg) {
        if (pkg.id === izbraniPaketId && izbraniPaket) return;

        /* Lastni odvetnik v "Samo en odvetnik" → veže kartico "Paket po meri"
           nanj (prikaže njegovo ime, brez izmišljene ocene). */
        if (pkg.isCustomBuilder && filter.mode === "single_lawyer") {
          var cl = najdiOdvetnikaFiltra(filter.singleLawyerId, step);
          if (cl && cl.isCustom) { dodaj(pkg, cl); return; }
        }

        var ponudbeIds = PACKAGE_LAWYER_OFFERS[pkg.id] || [];
        var lawyerId = null;
        if (filter.mode === "single_lawyer") {
          if (ponudbeIds.indexOf(filter.singleLawyerId) >= 0) lawyerId = filter.singleLawyerId;
        } else if (izbraniLawyerId && vidni.indexOf(izbraniLawyerId) >= 0 && ponudbeIds.indexOf(izbraniLawyerId) >= 0) {
          lawyerId = izbraniLawyerId;
        } else {
          lawyerId = ponudbeIds.find(function (id) { return vidni.indexOf(id) >= 0; }) || null;
        }
        if (!lawyerId) return;
        var lawyer = najdiProfilOdvetnika(lawyerId);
        if (lawyer) dodaj(pkg, lawyer);
      });

      return rezultat;
    }

    function odvetnikZaPaket(pkg, step) {
      var ponudba = ponudbeZaPrikaz(step).find(function (o) {
        return o.package && o.package.id === pkg.id;
      });
      if (!ponudba) return { lawyer: null, selected: false };
      if (ponudba.lawyer && ponudba.lawyer.isCustom) {
        return { lawyer: ponudba.lawyer, selected: true };
      }
      var lh = (step && step.lawyerHandoff) || {};
      var selected = Boolean(ponudba.lawyer && lh.lawyerId && ponudba.lawyer.id === lh.lawyerId);
      return { lawyer: ponudba.lawyer, selected: selected };
    }

    function izberiPaketInPrikazanegaOdvetnika(pkg, paketSnapshot, stepIndex) {
      if (!pkg || !paketSnapshot) return plan;
      var aktualniStep = N.najdiKorak(plan, stepIndex) || step;
      var rezultat = odvetnikZaPaket(pkg, aktualniStep);
      var lawyer = rezultat && rezultat.lawyer;
      if (!lawyer) {
        return typeof N.posodobiIzbraniPaket === "function"
          ? N.posodobiIzbraniPaket(plan, stepIndex, paketSnapshot)
          : plan;
      }
      var lawyerSnapshot = {
        name: lawyer.name,
        officeName: lawyer.officeName,
        email: lawyer.email,
        phone: lawyer.phone,
        availableHandoffDays: lawyer.availableHandoffDays,
        attachmentRequirements: lawyer.attachmentRequirements,
      };
      if (typeof N.posodobiPaketInOdvetnika === "function") {
        plan = N.posodobiPaketInOdvetnika(
          plan,
          stepIndex,
          paketSnapshot,
          lawyerSnapshot,
          lawyer.id
        );
      } else {
        plan = typeof N.posodobiIzbraniPaket === "function"
          ? N.posodobiIzbraniPaket(plan, stepIndex, paketSnapshot)
          : plan;
        plan = typeof N.posodobiOdvetnika === "function"
          ? N.posodobiOdvetnika(plan, stepIndex, lawyerSnapshot, lawyer.id)
          : plan;
      }
      shraniZahtevePrilogIzbranegaOdvetnika(lawyer);
      return plan;
    }

    function htmlPaketOdvetnik(pkg, step, praznaOznaka) {
      var rezultat = odvetnikZaPaket(pkg, step);
      var lawyer = rezultat.lawyer;
      if (!lawyer) return '<div class="lp-paket-kartica__odvetnik lp-paket-kartica__odvetnik--prazen"><span>' +
        esc(praznaOznaka || "Vsi odvetniki so skriti") + "</span></div>";
      if (lawyer.isCustom) {
        return '<div class="lp-paket-kartica__odvetnik lp-paket-kartica__odvetnik--custom"><span class="lp-paket-kartica__odvetnik-avatar" aria-hidden="true">' +
          esc(inicialkeOdvetnika({ name: lawyer.name })) + '</span><span class="lp-paket-kartica__odvetnik-podatki">' +
          "<small>Vaš odvetnik</small>" + '<strong data-fit-text data-fit-text-min="8">' + esc(lawyer.shortName || lawyer.name) +
          '</strong></span><span class="lp-paket-kartica__odvetnik-ocena">Po dogovoru</span></div>';
      }
      var oznakaPonudbe = rezultat.selected
        ? ""
        : "<small>Najboljša ponudba</small>";
      return '<div class="lp-paket-kartica__odvetnik"><span class="lp-paket-kartica__odvetnik-avatar" aria-hidden="true">' +
        esc(inicialkeOdvetnika(lawyer)) + '</span><span class="lp-paket-kartica__odvetnik-podatki">' +
        oznakaPonudbe + '<strong data-fit-text data-fit-text-min="8">' + esc(lawyer.shortName) +
        '</strong></span><span class="lp-paket-kartica__odvetnik-ocena">★ ' + esc(lawyer.rating) + "</span></div>";
    }

    function paketiZaCarousel() {
      return LAWYER_ACTION_PACKAGES.concat([CUSTOM_LAWYER_PACKAGE_CARD]);
    }

    function najdiCustomStoritev(id) {
      return CUSTOM_LAWYER_SERVICES.find(function (service) { return service.id === id; }) || null;
    }

    function formatirajCenoCustomStoritev(service) {
      if (!service || service.priceOnRequest || service.priceCents == null) return "Po ponudbi";
      return (service.priceCents / 100).toFixed(2).replace(".", ",") + " €";
    }

    function izbraneCustomStoritve(selectedPackage) {
      if (!selectedPackage || selectedPackage.packageId !== "custom_lawyer_services") return [];
      return (selectedPackage.services || [])
        .map(function (service) { return service && service.serviceId; })
        .filter(function (id) { return Boolean(najdiCustomStoritev(id)); });
    }

    function povzetekCustomStoritev(ids) {
      var storitve = (ids || []).map(najdiCustomStoritev).filter(Boolean);
      return {
        storitve: storitve,
        totalCents: storitve.reduce(function (sum, service) {
          return sum + (Number.isFinite(service.priceCents) ? service.priceCents : 0);
        }, 0),
        imaPonudbo: storitve.some(function (service) { return service.priceOnRequest; }),
      };
    }

    function formatirajCente(cents) {
      return (Math.max(0, Number(cents) || 0) / 100).toFixed(2).replace(".", ",") + " €";
    }

    function snapshotCustomPaketa(ids) {
      var p = povzetekCustomStoritev(ids);
      if (!p.storitve.length) return null;
      return {
        packageId: "custom_lawyer_services",
        selectedAt: new Date().toISOString(),
        priceCents: p.totalCents,
        priceLabel: formatirajCente(p.totalCents) + (p.imaPonudbo ? " + po ponudbi" : ""),
        currency: "EUR",
        titleSnapshot: "Paket odvetniških storitev",
        services: p.storitve.map(function (service) {
          return {
            serviceId: service.id,
            titleSnapshot: service.title,
            priceCents: service.priceCents,
            priceLabel: formatirajCenoCustomStoritev(service),
          };
        }),
        hasPriceOnRequest: p.imaPonudbo,
        configurationVersion: 2,
      };
    }

    function najdiPaket(packageId) {
      return (
        LAWYER_ACTION_PACKAGES.find(function (p) {
          return p.id === packageId;
        }) || null
      );
    }

    function formatirajCenoPaketa(pkg) {
      if (!pkg) return "";
      if (pkg.includedInPlan && pkg.priceCents === 0) {
        return "Vključeno";
      }
      var eur = (pkg.priceCents / 100).toFixed(2).replace(".", ",");
      return (pkg.pricePrefix ? pkg.pricePrefix + " " : "") + eur + " €" + (pkg.priceSuffix ? " " + pkg.priceSuffix : "");
    }

    function formatirajCenoKratek(pkg) {
      if (!pkg) return "";
      if (pkg.includedInPlan && pkg.priceCents === 0) return "Vključeno";
      var eur = (pkg.priceCents / 100).toFixed(2).replace(".", ",");
      return (pkg.pricePrefix ? pkg.pricePrefix + " " : "") + eur + " €";
    }

    function dolociPriporoceniPaket(plan) {
      var stPoslanih =
        ((plan.steps || []).filter(function (s) {
          return s.status === "sent";
        }).length) || 0;
      var stDni = 0;
      var prviPoslani = null;
      (plan.steps || []).forEach(function (s) {
        if (s.status === "sent" && s.sentAt) {
          if (!prviPoslani || s.sentAt < prviPoslani) prviPoslani = s.sentAt;
        }
      });
      if (prviPoslani) {
        stDni = Math.max(
          0,
          Math.floor((Date.now() - new Date(prviPoslani).getTime()) / 86400000)
        );
      }
      var potrjenoBrezOdziva =
        plan.debtorResponseStatus === "no_response" ||
        plan.paymentStatus === "no_response";
      if (potrjenoBrezOdziva && stPoslanih >= 3 && stDni >= 14) {
        return "lawyer_phone_call";
      }
      return "lawyer_demand_letter";
    }

    function jePaketIzbran(step, packageId) {
      var lh = (step && step.lawyerHandoff) || {};
      var sel = lh.selectedPackage || {};
      return sel.packageId === packageId;
    }

    function ustvariSnapshotPaketa(pkg) {
      if (!pkg) return null;
      return {
        packageId: pkg.id,
        selectedAt: new Date().toISOString(),
        priceCents: pkg.priceCents,
        priceLabel: formatirajCenoPaketa(pkg),
        currency: "EUR",
        titleSnapshot: pkg.title,
        includedItemsSnapshot: (pkg.includedItems || []).slice(),
        configurationVersion: 1,
      };
    }

    var lawyerPopupState = {
      pendingPackageId: null,
      previewPackageId: null,
      activePackageId: null,
      draftCustomServiceIds: [],
      customPreviewServiceId: null,
      previewLawyerId: null,
      lawyerVisibilityChanged: false,
      activeFlowStep: 0,
      filterDraft: null,
      filterOpener: null,
      filterView: "main",
    };

    function posodobiPrikazPaketov(step) {
      var lh = (step && step.lawyerHandoff) || {};
      var izbran = lh.selectedPackage && lh.selectedPackage.packageId;
      lawyerPopupState.activePackageId = izbran || dolociPriporoceniPaket(plan);
    }

    /* ========== HTML generatorji za zgornja widgeta ========== */

    /** Enotni vir podatkov za zgornji modul "Potek opominov" IN spodnji sheet
        "Poglej vse" (odpriZgodovinaSheet) - oba uporabljata podatkiZgodovineKoraka,
        da se seznam nikoli ne podvoji ali razhaja. Vključuje VSE relevantne
        opomine (poslane, načrtovane, potrjene, morebitne neuspele/preskočene),
        ne samo poslane - glej podatkiZgodovineKoraka za preslikavo statusov. */
    function pridobiPregledVsehOpominov(plan, k1, k2) {
      var vsiOpomini = (plan.steps || [])
        .slice(0, -1)
        .filter(function (s) {
          return !s.isExcluded;
        })
        .map(function (s) {
          return podatkiZgodovineKoraka(s, k1, k2);
        });
      var poslani = vsiOpomini.filter(function (p) {
        return p.status === "sent";
      });
      var nacrtovani = vsiOpomini.filter(function (p) {
        return p.status !== "sent";
      });
      return {
        vsiOpomini: vsiOpomini,
        poslani: poslani,
        nacrtovani: nacrtovani,
        skupno: vsiOpomini.length,
        prviDatum: vsiOpomini.length ? vsiOpomini[0].iso : null,
        zadnjiDatum: vsiOpomini.length ? vsiOpomini[vsiOpomini.length - 1].iso : null,
      };
    }

    /* Slovenska sklanjatev (slovenskaOblika/stevecPoslanih/stevecNacrtovanih)
       je premaknjena v opomin-nacrt.js (N.slovenskaOblika ipd.), da je čisto
       testljiva v Node brez brskalniških odvisnosti - glej scripts/test-opomini-pregled.js. */
    var N_predaja = root.UJOpominNacrt || {};
    function slovenskaOblika(n, oblike) {
      return N_predaja.slovenskaOblika(n, oblike);
    }
    function stevecPoslanih(n) {
      return N_predaja.stevecPoslanih(n);
    }
    function stevecNacrtovanih(n) {
      return N_predaja.stevecNacrtovanih(n);
    }

    function opominiBesediloSt(n) {
      return n + " " + slovenskaOblika(n, ["poslan opomin", "poslana opomina", "poslani opomini", "poslanih opominov"]);
    }

    function opominiGumbBesediloVsi(n) {
      if (n === 1) return "Poglej opomin";
      if (n === 2) return "Poglej oba opomina";
      if (n === 3 || n === 4) return "Poglej vse " + n + " opominov";
      return "Poglej vseh " + n + " opominov";
    }

    function besediloPredDnevi(iso) {
      if (!iso) return "";
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      var dni = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
      if (dni === 0) return "danes";
      if (dni === 1) return "včeraj";
      return "pred " + dni + " " + slovenskaOblika(dni, ["dnevom", "dnevoma", "dnevi", "dnevi"]);
    }

    function htmlOpominiPregled(plan, step, k1, k2) {
      var pregled = pridobiPregledVsehOpominov(plan, k1, k2);
      var vsiOpomini = pregled.vsiOpomini;
      var poslani = pregled.poslani;
      var nacrtovani = pregled.nacrtovani;

      var stanjeOdziva = plan.debtorResponseStatus || plan.paymentStatus || "unknown";
      if (["unknown", "no_response", "responded", "partially_paid", "paid"].indexOf(stanjeOdziva) < 0) {
        stanjeOdziva = "unknown";
      }

      var razredStanja = "";
      var statusOznaka = "Stanje ni potrjeno";
      if (stanjeOdziva === "no_response") {
        razredStanja = "lp-opomini-pregled--brez-odziva";
        statusOznaka = "Brez odziva";
      } else if (stanjeOdziva === "responded") {
        razredStanja = "lp-opomini-pregled--odziv";
        statusOznaka = "Dolžnik se je odzval";
      } else if (stanjeOdziva === "partially_paid") {
        razredStanja = "lp-opomini-pregled--delno";
        statusOznaka = "Delno plačano";
      } else if (stanjeOdziva === "paid") {
        razredStanja = "lp-opomini-pregled--placano";
        statusOznaka = "Plačano";
      } else {
        razredStanja = "lp-opomini-pregled--neznan";
      }

      var ikonaHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>';

      /* Pravo prazno stanje SAMO, kadar načrt res nima niti enega relevantnega
         opomina (glej odsek 22 specifikacije) - ne kadar je poslanih 0. */
      if (pregled.skupno === 0) {
        return (
          '<section class="lp-opomini-pregled lp-opomini-pregled--prazen ' + razredStanja + '" aria-label="Zgodovina opominov">' +
          '<div class="lp-opomini-pregled__prazno-vrh">' +
          '<span class="lp-opomini-pregled__prazno-eyebrow">ZGODOVINA OPOMINOV</span>' +
          '<span class="lp-opomini-pregled__status">' + esc(statusOznaka) + "</span>" +
          "</div>" +
          '<div class="lp-opomini-pregled__prazno-glavno">' +
          '<span class="lp-opomini-pregled__prazno-ikona" aria-hidden="true">' + ikonaHtml + "</span>" +
          '<span class="lp-opomini-pregled__prazno-vsebina">' +
          "<strong>Opomini še niso bili dodani</strong>" +
          "<span>V načrtu trenutno ni nobenega opomina.</span>" +
          "</span>" +
          "</div>" +
          "</section>"
        );
      }

      var stevciBesedilo;
      var opisBesedilo;
      if (nacrtovani.length === 0) {
        /* Vsi relevantni opomini so že poslani. */
        stevciBesedilo = opominiBesediloSt(poslani.length);
        if (poslani.length > 1 && pregled.prviDatum && pregled.zadnjiDatum) {
          var razponDni = Math.max(
            0,
            Math.round((new Date(pregled.zadnjiDatum).getTime() - new Date(pregled.prviDatum).getTime()) / 86400000)
          );
          opisBesedilo =
            "Pošiljanje je potekalo v obdobju " + razponDni + " " + slovenskaOblika(razponDni, ["dneva", "dni", "dni", "dni"]) + ".";
        } else {
          opisBesedilo = "Poslano " + besediloPredDnevi(pregled.zadnjiDatum) + ".";
        }
      } else {
        stevciBesedilo = stevecPoslanih(poslani.length) + " · " + stevecNacrtovanih(nacrtovani.length);
        if (poslani.length === 0) {
          opisBesedilo = "Opomini so pripravljeni v vašem načrtu.";
        } else {
          var zadnjiPoslani = poslani[poslani.length - 1];
          opisBesedilo = "Zadnji opomin je bil poslan " + besediloPredDnevi(zadnjiPoslani.iso) + ".";
        }
      }

      var trakHtml = vsiOpomini
        .map(function (p) {
          var stanjeRazred =
            p.status === "sent"
              ? "poslan"
              : p.status === "confirmed"
                ? "potrjen"
                : p.status === "failed"
                  ? "neuspel"
                  : p.status === "skipped"
                    ? "preskocen"
                    : "nacrtovan";
          var datum = "";
          if (p.iso) {
            var dd = new Date(p.iso);
            if (!Number.isNaN(dd.getTime())) {
              datum = dd.getDate() + ". " + (dd.getMonth() + 1) + ".";
            }
          }
          return (
            '<button type="button" class="lp-opomini-pregled__korak lp-opomini-pregled__korak--' +
            stanjeRazred +
            '" data-zgodovina-korak="' +
            p.index +
            '" aria-label="' +
            esc(p.naslov + ", " + p.statusBesedilo + (datum ? ", " + datum : "")) +
            '">' +
            '<span class="lp-opomini-pregled__stevilka">' +
            p.index +
            "</span>" +
            '<strong class="lp-opomini-pregled__naziv">' +
            esc(p.naslov) +
            "</strong>" +
            (datum ? '<time class="lp-opomini-pregled__datum">' + esc(datum) + "</time>" : "") +
            '<span class="lp-opomini-pregled__korak-status lp-opomini-pregled__korak-status--' +
            stanjeRazred +
            '">' +
            (p.status === "sent" ? IKONA_KLJUKICA + " " : "") +
            esc(p.statusBesedilo) +
            "</span>" +
            "</button>"
          );
        })
        .join("");

      var gumbBesedilo = opominiGumbBesediloVsi(pregled.skupno);
      var chevronHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

      return (
        '<section class="lp-opomini-pregled ' + razredStanja + '" aria-label="Potek opominov">' +
        '<div class="lp-opomini-pregled__glava">' +
        '<span class="lp-opomini-pregled__glava-ikona" aria-hidden="true">' + ikonaHtml + "</span>" +
        '<span class="lp-opomini-pregled__glava-vsebina">' +
        '<span class="lp-opomini-pregled__eyebrow">POTEK OPOMINOV</span>' +
        '<strong class="lp-opomini-pregled__stevci">' + esc(stevciBesedilo) + "</strong>" +
        '<span class="lp-opomini-pregled__opis">' + esc(opisBesedilo) + "</span>" +
        "</span>" +
        '<span class="lp-opomini-pregled__status">' + esc(statusOznaka) + "</span>" +
        "</div>" +
        '<div class="lp-opomini-pregled__trak-ovoj">' +
        '<div class="lp-opomini-pregled__trak" role="list" aria-label="Potek opominov">' +
        trakHtml +
        "</div>" +
        "</div>" +
        '<button type="button" class="lp-opomini-pregled__vsi" id="lp-opomini-poglej-vse" aria-label="' + esc(gumbBesedilo) + '">' +
        '<span class="lp-opomini-pregled__vsi-ikona" aria-hidden="true">' + ikonaHtml + "</span>" +
        '<span class="lp-opomini-pregled__vsi-besedilo">' +
        "<strong>" + esc(gumbBesedilo) + "</strong>" +
        "<span>Celoten načrt, zgodovina in vsebina</span>" +
        "</span>" +
        '<span class="lp-opomini-pregled__vsi-chevron" aria-hidden="true">' + chevronHtml + "</span>" +
        "</button>" +
        "</section>"
      );
    }

    /* Ista preslikava kot oznakaPreteklihZamud v priporocilo-widget.js – tam
       je zaprta v svoj modul in ni dostopna od tu, zato majhna podvojitev za
       enak izpis ("unknown" → "—", "9plus" → "9+"). */
    function oznakaPreteklihZamudZaPredajo(zgodovinaZamud) {
      var z = zgodovinaZamud == null ? null : String(zgodovinaZamud);
      if (!z || z === "unknown") return "—";
      if (z === "9plus") return "9+";
      return z;
    }

    function htmlPredajaPovzetek(plan, step, podatkiKorak1) {
      var k1 = podatkiKorak1 || {};
      var znesek = formatEurIzCentov(plan.amountCents != null ? plan.amountCents : k1.znesek * 100);
      var dolznikNaziv = k1.nazivPodjetja || k1.imeDolznika || "—";
      var datumZapadlosti = "—";
      if (k1.rokPlacila) datumZapadlosti = formatDatumSl(k1.rokPlacila);
      else if (k1.datumZapadlosti) datumZapadlosti = formatDatumSl(k1.datumZapadlosti);
      /* Isti vir kot zgoraj za prikaz datuma (rokPlacila ima prednost, sicer
         datumZapadlosti) – prej je štel SAMO rokPlacila, zato je zamuda ostala
         na "0 dni", tudi ko je bil datum zapadlosti že leta nazaj. */
      var virZaZamudo = k1.rokPlacila || k1.datumZapadlosti;
      var dneviZamude = virZaZamudo
        ? Math.max(0, Math.floor((Date.now() - new Date(virZaZamudo).getTime()) / 86400000))
        : 0;
      var zamudaVrednost = String(dneviZamude);
      var zamudaEnota = dneviZamude === 1 ? "dan zamude" : "dni zamude";
      var preteklihZamudVrednost = oznakaPreteklihZamudZaPredajo(k1.zgodovinaZamud);
      var dolznikDolzina = String(dolznikNaziv || "").trim().length;
      var dolznikRazred = dolznikDolzina > 34
        ? " lp-predaja-povzetek__dolznik--zelo-dolg"
        : dolznikDolzina > 20
          ? " lp-predaja-povzetek__dolznik--dolg"
          : "";

      return (
        '<section class="lp-predaja-povzetek" aria-label="Predaja odvetniku">' +
        '<div class="lp-predaja-povzetek__glava">' +
        '<span class="lp-predaja-povzetek__ikona" aria-hidden="true">' +
        IKONA_TEHTNICA +
        "</span>" +
        '<div class="lp-predaja-povzetek__glava-besedilo">' +
        '<h2 class="lp-predaja-povzetek__naslov">Predaja odvetniku</h2>' +
        '<p class="lp-predaja-povzetek__podnaslov">10. in zadnji korak</p>' +
        "</div>" +
        '<span class="lp-predaja-povzetek__znacka">Za pregled</span>' +
        "</div>" +
        '<p class="lp-predaja-povzetek__eyebrow">PODATKI O PRIMERU</p>' +
        '<div class="lp-predaja-povzetek__telo">' +
        /* Ista postavitev in isti CSS razredi (debt-summary) kot pri widgetu
           "Priporočilo za ta dolg" na koraku 2/3 – kompakten dvovrstičen
           prikaz brez podnapisov namesto prejšnjega centriranega enovrstičnega
           s tremi stolpci. Barva vrednosti ostane vijolična (glej
           .lp-predaja-povzetek .debt-summary__amount), da se kartica ujema z
           ikono in značko "Za pregled" te kartice, ne s tealom widgeta. */
        '<div class="debt-summary-skupina">' +
        '<div class="debt-summary debt-summary--vrstica-1">' +
        '<div class="debt-summary__amount-column">' +
        '<span class="debt-summary__label">Dolžnik</span>' +
        '<span class="debt-summary__amount debt-summary__amount--sm lp-predaja-povzetek__dolznik' + dolznikRazred + '" title="' + esc(dolznikNaziv) + '">' + esc(dolznikNaziv) + "</span>" +
        "</div>" +
        '<div class="debt-summary__category-column">' +
        '<span class="debt-summary__label">Dolg</span>' +
        '<span class="debt-summary__amount debt-summary__amount--sm">' + esc(znesek) + "</span>" +
        "</div>" +
        "</div>" +
        '<div class="debt-summary debt-summary--tri debt-summary--vrstica-2">' +
        '<div class="debt-summary__amount-column">' +
        '<span class="debt-summary__label">Zapadlost</span>' +
        '<span class="debt-summary__amount debt-summary__amount--sm">' + esc(datumZapadlosti) + "</span>" +
        "</div>" +
        '<div class="debt-summary__category-column">' +
        '<span class="debt-summary__label">Zamuda</span>' +
        '<span class="debt-summary__amount debt-summary__amount--sm">' + esc(zamudaVrednost) + " " + esc(zamudaEnota) + "</span>" +
        "</div>" +
        '<div class="debt-summary__category-column">' +
        '<span class="debt-summary__label">Pretekle zamude</span>' +
        '<span class="debt-summary__amount debt-summary__amount--sm">' + esc(preteklihZamudVrednost) + "</span>" +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="lp-predaja-povzetek__razsirjeno" id="lp-razsirjeni-podatki" hidden>' +
        htmlRazsirjenePodatke(k1) +
        "</div>" +
        "</div>" +
        "</section>"
      );
    }

    /* Ime dolžnika mora ostati v fiksno visokem povzetku. Besede se lomijo
       samo na presledkih, pisava pa se po pol slikovne pike zmanjšuje, dokler
       so vse vrstice v razpoložljivem polju. Tako daljše ime ne poveča
       widgeta in ne prekrije sosednjih podatkov. */
    function prilagodiVelikostImenaDolznika() {
      if (!opts.glavniEl || typeof window === "undefined") return;
      var el = opts.glavniEl.querySelector(".lp-predaja-povzetek__dolznik");
      if (!el) return;
      el.style.fontSize = "";
      var velikost = parseFloat(window.getComputedStyle(el).fontSize) || 15;
      var najmanjsa = 5.5;
      while (
        velikost > najmanjsa &&
        (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
      ) {
        velikost -= 0.5;
        el.style.fontSize = velikost + "px";
      }
    }

    function htmlRazsirjenePodatke(k1) {
      var vrstice = [];
      var tip = k1.tipDolznika || "";
      if (tip) vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">Vrsta dolžnika</span><span>' + esc(tip) + "</span></div>");
      var naziv = k1.nazivPodjetja || k1.imeDolznika || "";
      if (naziv) vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">' + (k1.nazivPodjetja ? "Naziv" : "Ime in priimek") + '</span><span>' + esc(naziv) + "</span></div>");
      var ds = k1.davcnaStevilka || "";
      if (ds) vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">Davčna številka</span><span>' + esc(ds) + "</span></div>");
      var kontakt = k1.kontaktnaOseba || "";
      if (kontakt) vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">Kontaktna oseba</span><span>' + esc(kontakt) + "</span></div>");
      var tel = k1.telefonDolznika || "";
      if (tel) vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">Telefon</span><span>' + esc(tel) + "</span></div>");
      var email = k1.emailDolznika || "";
      if (email) vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">E-pošta</span><span>' + esc(email) + "</span></div>");
      var stRac = k1.stevilkaRacuna || "";
      if (stRac) vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">Številka računa</span><span>' + esc(stRac) + "</span></div>");
      var znesek = k1.znesek;
      if (znesek != null) vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">Znesek</span><span>' + esc(formatEurIzCentov(znesek * 100)) + "</span></div>");
      var datumIzdaje = k1.datumIzdaje || "";
      if (datumIzdaje) vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">Datum izdaje</span><span>' + esc(formatDatumSl(datumIzdaje)) + "</span></div>");
      var rokPlacila = k1.rokPlacila || k1.datumZapadlosti || "";
      if (rokPlacila) vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">Rok plačila</span><span>' + esc(formatDatumSl(rokPlacila)) + "</span></div>");
      if (rokPlacila) {
        var zamuda = Math.max(0, Math.floor((Date.now() - new Date(rokPlacila).getTime()) / 86400000));
        vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">Trenutna zamuda</span><span>' + zamuda + " dni</span></div>");
      }
      var opis = k1.opisDela || k1.opisPrimera || "";
      if (opis) vrstice.push('<div class="lp-vrstica lp-vrstica--siroko"><span class="lp-vrstica-label">Opis opravljenega dela</span><span>' + esc(opis) + "</span></div>");
      var prilogeSt = k1.steviloPrilog || (k1.priloge && k1.priloge.length) || 0;
      if (prilogeSt) vrstice.push('<div class="lp-vrstica"><span class="lp-vrstica-label">Število prilog</span><span>' + prilogeSt + "</span></div>");
      return vrstice.join("");
    }

    function vsiOdvetnikiFiltra(step, customLawyers) {
      var lh = (step && step.lawyerHandoff) || {};
      var sistem = LAWYER_PROFILES.map(function (lawyer) {
        return {
          id: lawyer.id,
          name: lawyer.name,
          shortName: lawyer.shortName,
          officeName: lawyer.officeName,
          email: lawyer.email,
          phone: lawyer.phone,
          isCustom: false,
        };
      });
      var customList = Array.isArray(customLawyers)
        ? customLawyers
        : Array.isArray(lh.customLawyers)
          ? lh.customLawyers
          : [];
      var custom = customList.map(function (c) {
        return {
          id: c.id,
          name: c.name,
          shortName: c.name,
          officeName: c.officeName || "",
          email: c.email || "",
          phone: c.phone || "",
          isCustom: true,
        };
      });
      return sistem.concat(custom);
    }

    function najdiOdvetnikaFiltra(id, step, customLawyers) {
      return vsiOdvetnikiFiltra(step, customLawyers).find(function (o) { return o.id === id; }) || null;
    }

    function besediloFiltraPonudb(step) {
      var filter = pridobiFilterPonudb(step);
      var sistemIds = LAWYER_PROFILES.map(function (l) { return l.id; });
      var vsiSistemski = sistemIds.every(function (id) {
        return filter.lawyerIds.indexOf(id) >= 0;
      });
      var stCustom = filter.lawyerIds.filter(function (id) { return sistemIds.indexOf(id) < 0; }).length;

      if (filter.mode === "single_lawyer") {
        var lawyer = najdiOdvetnikaFiltra(filter.singleLawyerId, step);
        var kratko = lawyer ? (lawyer.shortName || lawyer.name) : "Odvetnik";
        var polno = lawyer ? (lawyer.name || "") : "Odvetnik";
        return {
          buttonText: kratko,
          povzetek: "Način prikaza: samo ponudbe — " + polno,
        };
      }

      var n = filter.lawyerIds.length;
      if (vsiSistemski && stCustom === 0) {
        return {
          buttonText: "Mešane ponudbe",
          povzetek: "Način prikaza: najbolj ustrezni paketi vseh odvetnikov",
        };
      }
      var buttonText = n + " " + slovenskaOblika(n, ["odvetnik", "odvetnika", "odvetniki", "odvetnikov"]);
      var povzetek = n === 1
        ? "Način prikaza: ponudbe 1 izbranega odvetnika"
        : "Način prikaza: ponudbe " + n + " izbranih odvetnikov";
      return { buttonText: buttonText, povzetek: povzetek };
    }

    function razlogPriporocenegaPaketa(plan) {
      if (dolociPriporoceniPaket(plan) === "lawyer_phone_call") {
        return "Po več opominih brez odziva je neposreden odvetniški klic najprimernejši naslednji korak.";
      }
      return "Uradni odvetniški opomin je glede na dosedanji potek najprimernejši naslednji korak.";
    }

    function htmlFilterPonudbVrstica(plan, step) {
      var info = besediloFiltraPonudb(step);
      var ikonaFilter = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4"/></svg>';
      var chevron = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
      return (
        '<div class="lp-filter-ponudb__orodna-vrstica">' +
        '<button type="button" id="lp-filter-priporoceno" class="lp-filter-ponudb__priporoceno">' +
        '<span aria-hidden="true">★</span><span>Priporočeno</span></button>' +
        '<button type="button" id="lp-filter-ponudb-odpri" class="lp-filter-ponudb__odpri" aria-haspopup="dialog" aria-expanded="false" aria-controls="lp-filter-ponudb-ovoj">' +
        '<span class="lp-filter-ponudb__odpri-ikona" aria-hidden="true">' + ikonaFilter + "</span>" +
        '<span class="lp-filter-ponudb__odpri-tekst">' + esc(info.buttonText) + "</span>" +
        '<span class="lp-filter-ponudb__odpri-chevron" aria-hidden="true">' + chevron + "</span></button>" +
        "</div>" +
        '<p class="lp-filter-ponudb__povzetek"><strong>Zakaj priporočamo:</strong> ' + esc(razlogPriporocenegaPaketa(plan)) + "</p>"
      );
    }

    function htmlKajSeBoZgodilo(plan, step) {
      posodobiPrikazPaketov(step);
      var ponudbe = ponudbeZaPrikaz(step);
      var aktivenId = lawyerPopupState.activePackageId;
      var priporocenId = dolociPriporoceniPaket(plan);
      var izbranId = (step.lawyerHandoff && step.lawyerHandoff.selectedPackage && step.lawyerHandoff.selectedPackage.packageId) || null;

      var aktivenViden = ponudbe.some(function (o) { return o.package.id === aktivenId; });
      if (!aktivenViden) {
        if (izbranId && ponudbe.some(function (o) { return o.package.id === izbranId; })) {
          aktivenId = izbranId;
        } else if (ponudbe.length) {
          aktivenId = ponudbe[0].package.id;
        } else {
          aktivenId = null;
        }
        lawyerPopupState.activePackageId = aktivenId;
      }

      var pikeHtml = ponudbe.map(function (o, i) {
        return '<button type="button" class="lp-paket-pika' +
          (o.package.id === aktivenId ? " lp-paket-pika--aktivna" : "") +
          '" data-paket-index="' + i + '" aria-label="Paket ' + (i + 1) + '"></button>';
      }).join("");
      var karticeHtml = ponudbe.map(function (o) {
        var pkg = o.package;
        var jeIzbran = izbranId === pkg.id;
        var jePriporocen = pkg.id === priporocenId;
        var jeAktiven = pkg.id === aktivenId;
        return pkg.isCustomBuilder
          ? htmlCustomPaketKartica(step, jeIzbran, o.lawyer)
          : htmlPaketKartica(pkg, jeIzbran, jePriporocen, jeAktiven, step);
      }).join("");
      var aktivniPaket = ponudbe.find(function (o) { return o.package.id === aktivenId; }) || null;
      var korakiHtml = htmlDinamicniKoraki(aktivniPaket ? aktivniPaket.package : null, step);

      return (
        '<section class="lp-kaj-se-bo-zgodilo" aria-label="Kaj se bo zgodilo">' +
        '<div class="lp-kaj-se-bo-zgodilo__glava">' +
        '<span class="lp-kaj-se-bo-zgodilo__glava-ikona" aria-hidden="true">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>' +
        "</span>" +
        '<div class="lp-kaj-se-bo-zgodilo__glava-besedilo">' +
        "<h3>Izberite naslednji korak</h3>" +
        "</div>" +
        "</div>" +
        htmlFilterPonudbVrstica(plan, step) +
        '<div class="lp-paket-pike">' + pikeHtml + "</div>" +
        '<div class="lp-paket-carousel-ovoj">' +
        '<div class="lp-paket-carousel" id="lp-paket-carousel" role="list" aria-label="Paketi">' +
        karticeHtml +
        "</div>" +
        "</div>" +
        korakiHtml +
        "</section>"
      );
    }

    function htmlCustomPaketKartica(step, jeIzbran, lawyer) {
      var selectedPackage = step.lawyerHandoff && step.lawyerHandoff.selectedPackage;
      var ids = izbraneCustomStoritve(selectedPackage);
      var p = povzetekCustomStoritev(ids);
      var jeCustomOdvetnik = Boolean(lawyer && lawyer.isCustom);
      var cenaGlavna = jeCustomOdvetnik ? "Po dogovoru" : "Paket po meri";
      var cenaOpis = jeCustomOdvetnik ? "z odvetnikom " + lawyer.name : "Izberite eno ali več storitev";
      return '<div class="lp-paket-kartica lp-paket-kartica--custom' + (jeIzbran ? " lp-paket-kartica--izbrana" : "") +
        '" data-paket-id="custom_lawyer_services" role="listitem">' +
        (jeIzbran ? '<span class="lp-paket-kartica__znacka lp-paket-kartica__znacka--izbrano">Izbrano ✓</span>' : "") +
        '<div class="lp-paket-kartica__cena-vrstica"><span class="lp-paket-kartica__ikona" aria-hidden="true">' +
        htmlIkonaPaketa("document") + '</span><span class="lp-paket-kartica__cena">' +
        '<span class="lp-paket-kartica__cena-znesek">' + esc(cenaGlavna) + '</span>' +
        '<span class="lp-paket-kartica__cena-opis">' + esc(cenaOpis) + "</span></span></div>" +
        '<h4 class="lp-paket-kartica__naslov">Sestavite paket storitev</h4>' +
        '<p class="lp-paket-kartica__opis">Združite odvetniške rešitve, ki jih potrebujete za svoj primer.</p>' +
        htmlPaketOdvetnik(CUSTOM_LAWYER_PACKAGE_CARD, step, "Vsi odvetniki") +
        (ids.length
          ? '<div class="lp-custom-kartica__povzetek" aria-label="Izbrane storitve in skupna cena"><span class="lp-custom-kartica__stevilo-storitev">' + ids.length +
            (ids.length === 1 ? " storitev" : ids.length === 2 ? " storitvi" : " storitve") +
            '</span><strong class="lp-custom-kartica__skupna-cena">' + esc(formatirajCente(p.totalCents)) + (p.imaPonudbo ? " + ponudba" : "") + "</strong></div>"
          : "") +
        '<button type="button" class="lp-paket-kartica__gumb lp-paket-kartica__gumb--izberi lp-custom-kartica__gumb" id="lp-odpri-custom-paket">' +
        (ids.length ? "Uredi paket" : "Sestavi paket") + "</button></div>";
    }

    function htmlCustomPaketPopup(step) {
      var selectedPackage = step.lawyerHandoff && step.lawyerHandoff.selectedPackage;
      var ids = izbraneCustomStoritve(selectedPackage);
      var storitveHtml = CUSTOM_LAWYER_SERVICES.map(function (service) {
        var izbrana = ids.indexOf(service.id) >= 0;
        return '<article class="lp-storitev' + (izbrana ? " lp-storitev--izbrana" : "") +
          '" data-custom-kartica="' + esc(service.id) + '"><div class="lp-storitev__glavna">' +
          '<span class="lp-storitev__ikona" aria-hidden="true">' + htmlIkonaPaketa(service.icon) + "</span>" +
          '<span class="lp-storitev__besedilo">' +
          (service.id === "lawyer_demand_letter" ? '<small class="lp-storitev__znacka">Priporočeno</small>' : "") +
          '<strong>' + esc(service.title) + '</strong><span>' + esc(service.description) + "</span></span>" +
          '<strong class="lp-storitev__cena">' + esc(formatirajCenoCustomStoritev(service)) + "</strong>" +
          '<span class="lp-storitev__check" aria-hidden="true">' + (izbrana ? "✓" : "") + "</span></div>" +
          '<div class="lp-storitev__gumbi"><button type="button" class="lp-storitev__preglej" data-custom-predogled-storitev="' + esc(service.id) + '">' +
          (izbrana ? "Preglej · Izbrano ✓" : "Preglej in izberi") + "</button></div></article>";
      }).join("");
      return '<div class="lp-popup-ovoj lp-popup-ovoj--zaprt" id="lp-custom-paket-ovoj" hidden>' +
        '<div class="lp-popup-backdrop" id="lp-custom-paket-backdrop"></div>' +
        '<section class="lp-popup-panel lp-sestavljalnik" role="dialog" aria-modal="true" aria-labelledby="lp-custom-paket-naslov" tabindex="-1">' +
        '<div class="lp-popup-rocaj" aria-hidden="true"></div>' +
        '<header class="lp-sestavljalnik__glava"><h2 id="lp-custom-paket-naslov">Sestavite paket storitev</h2>' +
        '<p>Izberite eno ali več rešitev. Za ostale podrsajte gor ali dol.</p><button type="button" class="lp-popup-zapri" id="lp-custom-paket-zapri" aria-label="Zapri">×</button></header>' +
        '<div class="lp-sestavljalnik__storitve" id="lp-custom-paket-drsnik">' + storitveHtml + "</div>" +
        '<div class="lp-sestavljalnik__povzetek" id="lp-custom-paket-povzetek"></div>' +
        '<button type="button" class="lp-sestavljalnik__potrdi" id="lp-custom-paket-potrdi">Poglej predogled paketa</button>' +
        "</section>" +
        '<section class="lp-popup-panel lp-custom-predogled" id="lp-custom-paket-predogled-panel" role="dialog" aria-modal="true" aria-labelledby="lp-custom-predogled-naslov" tabindex="-1" hidden>' +
        '<div class="lp-popup-rocaj" aria-hidden="true"></div>' +
        '<header class="lp-custom-predogled__glava"><span class="lp-custom-predogled__oznaka">Predogled</span>' +
        '<h2 id="lp-custom-predogled-naslov">Predogled storitve</h2><p id="lp-custom-predogled-podnaslov">Preverite vse podrobnosti pred izbiro.</p>' +
        '<button type="button" class="lp-popup-zapri" id="lp-custom-predogled-zapri" aria-label="Zapri">×</button></header>' +
        '<div class="lp-custom-predogled__vsebina" id="lp-custom-predogled-vsebina"></div>' +
        '<div class="lp-custom-predogled__gumbi"><button type="button" class="lp-custom-predogled__nazaj" id="lp-custom-predogled-nazaj">Nazaj</button>' +
        '<button type="button" class="lp-custom-predogled__izberi" id="lp-custom-paket-izberi">Izberi paket</button></div>' +
        "</section></div>";
    }

    function htmlOdvetnikiIzbiraPopup(step) {
      var lh = (step && step.lawyerHandoff) || {};
      var vidni = prikazaniOdvetniki(step);
      var priporocenId = PACKAGE_BEST_LAWYER[lawyerPopupState.activePackageId] || LAWYER_PROFILES[0].id;
      var kartice = LAWYER_PROFILES.map(function (lawyer) {
        var jeIzbran = lh.lawyerId === lawyer.id;
        var jeViden = vidni.indexOf(lawyer.id) >= 0;
        var storitve = (lawyer.services || []).slice(0, 3).map(function (service) {
          return '<span>' + esc(service) + "</span>";
        }).join("");
        return '<article class="lp-odvetnik-izbira__kartica' + (jeIzbran ? " lp-odvetnik-izbira__kartica--izbrana" : "") + (!jeViden ? " lp-odvetnik-izbira__kartica--skrita" : "") + '" data-odvetnik-kartica="' + esc(lawyer.id) + '">' +
          '<span class="lp-odvetnik-izbira__avatar" aria-hidden="true">' + esc(inicialkeOdvetnika(lawyer)) + "</span>" +
          '<span class="lp-odvetnik-izbira__podatki">' +
          (lawyer.id === priporocenId ? '<small class="lp-odvetnik-izbira__priporocen">Najboljša ponudba</small>' : "") +
          '<strong>' + esc(lawyer.name) + '</strong><span>' + esc(lawyer.specialty) + '</span><small>★ ' + esc(lawyer.rating) + " · " + esc(lawyer.city) + "</small></span>" +
          '<p class="lp-odvetnik-izbira__kratek-opis">' + esc(lawyer.description) + "</p>" +
          '<div class="lp-odvetnik-izbira__storitve" aria-label="Glavne storitve">' + storitve + "</div>" +
          '<div class="lp-odvetnik-izbira__dejanja"><button type="button" class="lp-odvetnik-izbira__switch" role="switch" aria-checked="' + (jeViden ? "true" : "false") + '" data-odvetnik-vidnost="' + esc(lawyer.id) + '">' +
          '<span class="lp-odvetnik-izbira__switch-track" aria-hidden="true"><i></i></span><span class="lp-odvetnik-izbira__switch-label">Prikaži v seznamu</span></button>' +
          '<button type="button" class="lp-odvetnik-izbira__poglej" data-odvetnik-profil="' + esc(lawyer.id) + '">Poglej/izberi</button></div></article>';
      }).join("");
      return '<div class="lp-popup-ovoj lp-popup-ovoj--zaprt" id="lp-odvetniki-ovoj" hidden>' +
        '<div class="lp-popup-backdrop" id="lp-odvetniki-backdrop"></div>' +
        '<section class="lp-popup-panel lp-odvetnik-izbira" id="lp-odvetniki-seznam" role="dialog" aria-modal="true" aria-labelledby="lp-odvetniki-naslov" tabindex="-1">' +
        '<div class="lp-popup-rocaj" aria-hidden="true"></div><header class="lp-odvetnik-izbira__glava">' +
        '<h2 id="lp-odvetniki-naslov">Izberite odvetnika</h2><p>Vključite odvetnike, katerih ponudbe želite videti, ali odprite njihov celoten profil.</p>' +
        '<button type="button" class="lp-popup-zapri" id="lp-odvetniki-zapri" aria-label="Zapri">×</button></header>' +
        '<div class="lp-odvetnik-izbira__seznam">' + kartice + "</div></section>" +
        '<section class="lp-popup-panel lp-odvetnik-profil" id="lp-odvetnik-profil" role="dialog" aria-modal="true" aria-labelledby="lp-odvetnik-profil-naslov" tabindex="-1" hidden>' +
        '<div class="lp-popup-rocaj" aria-hidden="true"></div><header class="lp-odvetnik-profil__glava"><span>Profil odvetnika</span>' +
        '<h2 id="lp-odvetnik-profil-naslov">Odvetnik</h2><button type="button" class="lp-popup-zapri" id="lp-odvetnik-profil-zapri" aria-label="Zapri">×</button></header>' +
        '<div class="lp-odvetnik-profil__vsebina" id="lp-odvetnik-profil-vsebina"></div>' +
        '<div class="lp-odvetnik-profil__gumbi"><button type="button" id="lp-odvetnik-profil-nazaj">Nazaj</button>' +
        '<button type="button" id="lp-odvetnik-profil-izberi">Izberi odvetnika</button></div></section></div>';
    }

    function htmlFilterPonudbPopup() {
      return (
        '<div class="lp-popup-ovoj lp-popup-ovoj--zaprt" id="lp-filter-ponudb-ovoj" hidden>' +
        '<div class="lp-popup-backdrop" id="lp-filter-ponudb-backdrop"></div>' +
        '<section class="lp-popup-panel lp-filter-ponudb" id="lp-filter-ponudb-panel" role="dialog" aria-modal="true" aria-labelledby="lp-filter-ponudb-naslov" aria-describedby="lp-filter-ponudb-opis" tabindex="-1">' +
        '<div class="lp-popup-rocaj" aria-hidden="true"></div>' +
        '<header class="lp-filter-ponudb__glava">' +
        '<div class="lp-filter-ponudb__glava-besedilo">' +
        '<h2 id="lp-filter-ponudb-naslov">Način prikaza ponudb</h2>' +
        '<p id="lp-filter-ponudb-opis">Izberite, katere ponudbe želite videti</p>' +
        "</div>" +
        '<button type="button" class="lp-filter-ponudb__zapri" id="lp-filter-ponudb-zapri" aria-label="Zapri brez shranjevanja">×</button>' +
        "</header>" +
        '<div class="lp-filter-ponudb__telo" id="lp-filter-ponudb-telo">' +
        '<div class="lp-filter-ponudb__pogled" id="lp-filter-ponudb-main">' +
        '<div class="lp-filter-ponudb__trenutno" id="lp-filter-ponudb-trenutno"></div>' +
        '<div class="lp-filter-ponudb__nacin" id="lp-filter-ponudb-nacin" role="radiogroup" aria-label="Način prikaza ponudb"></div>' +
        '<h3 class="lp-filter-ponudb__podnaslov">Izbrani odvetniki</h3>' +
        '<div class="lp-filter-ponudb__odvetniki" id="lp-filter-ponudb-odvetniki" role="group" aria-label="Izbrani odvetniki"></div>' +
        '<button type="button" class="lp-filter-ponudb__dodaj" id="lp-filter-ponudb-dodaj">' +
        '<span class="lp-filter-ponudb__dodaj-plus" aria-hidden="true">+</span>' +
        "<span>Dodaj svojega odvetnika</span></button>" +
        "</div>" +
        '<div class="lp-filter-ponudb__pogled" id="lp-filter-ponudb-dodaj-pogled" hidden>' +
        '<div class="lp-filter-ponudb__polja">' +
        '<label class="lp-filter-ponudb__polje"><span>Ime in priimek</span>' +
        '<input type="text" id="lp-filter-ponudb-ime" autocomplete="name" /></label>' +
        '<label class="lp-filter-ponudb__polje"><span>Naziv pisarne</span>' +
        '<input type="text" id="lp-filter-ponudb-pisarna" /></label>' +
        '<label class="lp-filter-ponudb__polje"><span>E-pošta</span>' +
        '<input type="email" id="lp-filter-ponudb-email" inputmode="email" /></label>' +
        '<label class="lp-filter-ponudb__polje"><span>Telefon</span>' +
        '<input type="tel" id="lp-filter-ponudb-telefon" inputmode="tel" /></label>' +
        "</div>" +
        '<p class="lp-filter-ponudb__opomba">Vnesite vsaj e-pošto ali telefon.</p>' +
        '<div class="lp-filter-ponudb__dodaj-gumbi">' +
        '<button type="button" class="lp-filter-ponudb__nazaj" id="lp-filter-ponudb-nazaj">Nazaj</button>' +
        '<button type="button" class="lp-filter-ponudb__dodaj-potrdi" id="lp-filter-ponudb-dodaj-potrdi">Dodaj odvetnika</button>' +
        "</div>" +
        "</div>" +
        "</div>" +
        '<p class="lp-filter-ponudb__napaka" id="lp-filter-ponudb-napaka" role="alert" hidden></p>' +
        '<footer class="lp-filter-ponudb__noga">' +
        '<button type="button" class="lp-filter-ponudb__uporabi" id="lp-filter-ponudb-uporabi">Uporabi filter</button>' +
        "</footer>" +
        "</section>" +
        "</div>"
      );
    }

    function htmlPaketKartica(pkg, jeIzbran, jePriporocen, jeAktiven, step) {
      var cenaGlavna = formatirajCenoKratek(pkg);
      var cenaOpis = pkg.includedInPlan && pkg.priceCents === 0 ? "" : (pkg.priceSuffix || "");
      var cenaRazred = cenaGlavna.length > 12 ? " lp-paket-kartica__cena-znesek--zelo-dolg" : cenaGlavna.length > 8 ? " lp-paket-kartica__cena-znesek--dolg" : "";
      var naslovRazred = pkg.title.length > 27 ? " lp-paket-kartica__naslov--zelo-dolg" : pkg.title.length > 21 ? " lp-paket-kartica__naslov--dolg" : "";
      var opisRazred = pkg.shortDescription.length > 62 ? " lp-paket-kartica__opis--zelo-dolg" : pkg.shortDescription.length > 48 ? " lp-paket-kartica__opis--dolg" : "";
      return (
        '<div class="lp-paket-kartica lp-paket-kartica--standard' +
        (jeIzbran ? " lp-paket-kartica--izbrana" : "") +
        (jePriporocen && !jeIzbran ? " lp-paket-kartica--priporocena" : "") +
        '" data-paket-id="' + esc(pkg.id) + '" role="listitem">' +
        (jePriporocen && !jeIzbran
          ? '<span class="lp-paket-kartica__znacka lp-paket-kartica__znacka--priporoceno"><span aria-hidden="true">★</span><span>Priporočeno</span></span>'
          : "") +
        (jeIzbran
          ? '<span class="lp-paket-kartica__znacka lp-paket-kartica__znacka--izbrano">Izbrano ✓</span>'
          : "") +
        '<div class="lp-paket-kartica__cena-vrstica">' +
        '<span class="lp-paket-kartica__ikona" aria-hidden="true">' +
        htmlIkonaPaketa(pkg.icon) +
        "</span>" +
        '<span class="lp-paket-kartica__cena">' +
        '<span class="lp-paket-kartica__cena-znesek' + cenaRazred + '">' + esc(cenaGlavna) + "</span>" +
        (cenaOpis ? '<span class="lp-paket-kartica__cena-opis">' + esc(cenaOpis) + "</span>" : "") +
        "</span>" +
        "</div>" +
        '<h4 class="lp-paket-kartica__naslov' + naslovRazred + '">' + esc(pkg.title) + "</h4>" +
        '<p class="lp-paket-kartica__opis' + opisRazred + '">' + esc(pkg.shortDescription) + "</p>" +
        htmlPaketOdvetnik(pkg, step) +
        (pkg.requiresSurcharge
          ? '<span class="lp-paket-kartica__doplacilo">Doplačilo</span>'
          : '<span class="lp-paket-kartica__doplacilo lp-paket-kartica__doplacilo--prazen" aria-hidden="true">Doplačilo</span>') +
        '<div class="lp-paket-kartica__gumbi">' +
        '<button type="button" class="lp-paket-kartica__gumb lp-paket-kartica__gumb--predogled" data-paket-predogled="' + esc(pkg.id) + '">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
        " Predogled</button>" +
        (jeIzbran
          ? '<button type="button" class="lp-paket-kartica__gumb lp-paket-kartica__gumb--izberi" data-paket-spremeni="' + esc(pkg.id) + '">Spremeni izbiro</button>'
          : '<button type="button" class="lp-paket-kartica__gumb lp-paket-kartica__gumb--izberi" data-paket-izberi="' + esc(pkg.id) + '">Izberi</button>') +
        "</div>" +
        "</div>"
      );
    }

    function htmlIkonaPaketa(icon) {
      if (icon === "mail") {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';
      }
      if (icon === "phone") {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
      }
      if (icon === "scales") {
        return IKONA_TEHTNICA;
      }
      return IKONA_DOKUMENT;
    }

    function htmlIkonaPregledPaketa() {
      return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M17 8h24l8 8v30H17z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M41 8v10h8M24 25h17M24 32h13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M30 46s5-7 13-7 13 7 13 7-5 7-13 7-13-7-13-7Z" fill="#f5faf9" stroke="currentColor" stroke-width="2.2"/><circle cx="43" cy="46" r="3.2" stroke="currentColor" stroke-width="2.2"/></svg>';
    }

    function htmlIkonaPotrditev() {
      return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="25" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/><circle cx="32" cy="32" r="19" stroke="currentColor" stroke-width="2.4"/><path d="m23 32 6 6 13-14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function htmlVelikaIkonaPaketa(icon) {
      if (icon === "phone") {
        return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M20 11h9l3 12-7 5c4 8 7 11 15 15l5-7 12 3v9c0 4-3 7-7 7-22-2-39-19-41-41 0-4 3-7 7-7Z" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';
      }
      if (icon === "scales") {
        return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 9v43M18 16h28M12 51h40M32 16 19 22M32 16l13 6M19 22l-8 17h16l-8-17ZM45 22l-8 17h16l-8-17Z" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 39c1 5 15 5 16 0M37 39c1 5 15 5 16 0" stroke="currentColor" stroke-width="2.3"/></svg>';
      }
      if (icon === "document") return htmlIkonaPregledPaketa();
      return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="10" y="16" width="44" height="34" rx="4" stroke="currentColor" stroke-width="2.4"/><path d="m12 20 20 16 20-16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function nazivIzbranegaPaketa(pkg) {
      if (pkg && pkg.isCustomBuilder) {
        return "Paket po meri";
      }
      return (pkg && (pkg.flowTitle || pkg.title)) || "Paket";
    }

    function htmlIkonaOsebeOdvetnika() {
      return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="23" r="11" stroke="currentColor" stroke-width="2.4"/><path d="M14 53c2-11 9-17 18-17s16 6 18 17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M23 40l9 8 9-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function odvetnikZaSpodnjiKorak(pkg, step) {
      var lh = (step && step.lawyerHandoff) || {};
      var profil = najdiProfilOdvetnika(lh.lawyerId);
      if (profil) return { lawyer: profil, selected: true };
      var snap = lh.lawyerSnapshot || {};
      if (String(snap.name || snap.officeName || "").trim()) {
        return {
          lawyer: {
            name: snap.name || snap.officeName,
            shortName: snap.name || snap.officeName,
            officeName: snap.officeName || "",
          },
          selected: true,
        };
      }
      return odvetnikZaPaket(pkg, step);
    }

    function htmlKorakOdvetnik(pkg, step) {
      var rezultat = odvetnikZaSpodnjiKorak(pkg, step);
      var lawyer = rezultat.lawyer || LAWYER_PROFILES[0];
      return '<button type="button" class="lp-korak lp-korak--odvetnik' + (lawyerPopupState.activeFlowStep === 1 ? " lp-korak--aktiven" : "") +
        '" id="lp-izberi-odvetnika" data-lp-flow-step="1" aria-label="Poglej in izberi odvetnika">' +
        '<span class="lp-korak__st">1</span><span class="lp-korak__ikona lp-korak__ikona--odvetnik" aria-hidden="true">' +
        htmlIkonaOsebeOdvetnika() + htmlIkonaVecInformacij() + '</span><span class="lp-korak__besedilo"><strong class="lp-korak__naslov" data-fit-text data-fit-text-min="8">' + esc(lawyer.shortName || lawyer.name) +
        "</strong></span></button>";
    }

    function htmlDinamicniKoraki(pkg, step) {
      if (!pkg) return "";
      return (
        '<div class="lp-koraki">' +
        '<div class="lp-koraki__vrstica" id="lp-dinamicni-koraki">' +
        htmlKorakOdvetnik(pkg, step) +
        '<span class="lp-koraki__puscica" aria-hidden="true">→</span>' +
        htmlKorak(2, htmlVelikaIkonaPaketa(pkg.icon), nazivIzbranegaPaketa(pkg), "", false, "data-lp-korak-paket") +
        '<span class="lp-koraki__puscica" aria-hidden="true">→</span>' +
        htmlKorak(3, htmlVelikaIkonaPaketa("scales"), "Začetek postopka", "", false, "data-lp-korak-postopek") +
        "</div>" +
        "</div>"
      );
    }

    function htmlKorak(st, ikonaHtml, naslov, opis, opisJeHtml, actionAttribute) {
      return (
        '<button type="button" class="lp-korak lp-korak--klikljiv' + (lawyerPopupState.activeFlowStep === st ? " lp-korak--aktiven" : "") +
        '" data-lp-flow-step="' + st + '" ' + (actionAttribute || "") + ' aria-label="' + esc(naslov) + ' – odpri podrobnosti">' +
        '<span class="lp-korak__st">' + st + "</span>" +
        '<span class="lp-korak__ikona" aria-hidden="true">' + ikonaHtml + htmlIkonaVecInformacij() + "</span>" +
        '<span class="lp-korak__besedilo"><strong class="lp-korak__naslov">' + esc(naslov) + "</strong>" +
        (opis ? '<span class="lp-korak__opis">' + (opisJeHtml ? opis : esc(opis)) + "</span>" : "") +
        "</span>" +
        "</button>"
      );
    }

    function htmlIkonaVecInformacij() {
      return '<span class="lp-korak__vec-info"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="4.5" stroke="currentColor" stroke-width="1.8"/><path d="m12 12 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>';
    }

    function htmlPotrditveniPopup(pkg) {
      return (
        '<div class="lp-popup-ovoj lp-popup-ovoj--zaprt" id="lp-popup-ovoj" hidden>' +
        '<div class="lp-popup-backdrop" id="lp-popup-backdrop"></div>' +
        htmlPotrditveniPopupInner(pkg) +
        "</div>"
      );
    }

    function htmlPotrditveniPopupInner(pkg) {
      var cena = formatirajCenoPaketa(pkg);
      var jePriporocen = pkg.id === dolociPriporoceniPaket(plan);
      var znackaHtml = jePriporocen
        ? '<span class="lp-popup-znacka">Priporočeno</span>'
        : "";
      var cenaPodnapis =
        pkg.includedInPlan && pkg.priceCents === 0
          ? ""
          : [pkg.priceSuffix, "z DDV"].filter(Boolean).join(" · ");
      var itemsHtml = (pkg.includedItems || []).map(function (item) {
        return '<div class="lp-popup-vrstica"><span class="lp-popup-vrstica__kljukica" aria-hidden="true">✓</span><span>' + esc(item) + "</span></div>";
      }).join("");
      return (
        '<div class="lp-popup-panel lp-popup-panel--potrditev" role="dialog" aria-modal="true" aria-labelledby="lp-popup-naslov">' +
        '<div class="lp-popup-rocaj" aria-hidden="true"></div>' +
        '<div class="lp-popup-glava">' +
        '<span class="lp-popup-glava-ikona" aria-hidden="true">' + htmlIkonaPaketa("mail") + "</span>" +
        '<div class="lp-popup-glava-besedilo">' +
        '<h3 class="lp-popup-naslov" id="lp-popup-naslov">Potrdite izbiro paketa</h3>' +
        '<p class="lp-popup-podnaslov">Pred potrditvijo preverite, kaj paket vključuje.</p>' +
        "</div>" +
        '<button type="button" class="lp-popup-zapri" id="lp-popup-zapri" aria-label="Zapri">×</button>' +
        "</div>" +
        '<div class="lp-popup-povzetek">' +
        znackaHtml +
        '<div class="lp-popup-povzetek-vrstica">' +
        '<div class="lp-popup-povzetek-besedilo">' +
        '<h4 class="lp-popup-paket-naslov">' + esc(pkg.title) + "</h4>" +
        '<p class="lp-popup-paket-opis">' + esc(pkg.shortDescription) + "</p>" +
        "</div>" +
        '<div class="lp-popup-povzetek-cena">' +
        '<span class="lp-popup-cena-znesek">' + esc(cena) + "</span>" +
        (cenaPodnapis ? '<span class="lp-popup-cena-opis">' + esc(cenaPodnapis) + "</span>" : "") +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="lp-popup-vkljucuje">' +
        '<h4 class="lp-popup-vkljucuje-naslov">Paket vključuje</h4>' +
        itemsHtml +
        "</div>" +
        '<div class="lp-popup-potek">' +
        '<h4 class="lp-popup-potek-naslov">Pred pošiljanjem</h4>' +
        '<div class="lp-popup-potek-vrstica">' +
        '<div class="lp-popup-potek-korak">' +
        '<span class="lp-popup-potek-korak__st" aria-hidden="true">1</span>' +
        '<span class="lp-popup-potek-korak__ikona" aria-hidden="true">' + htmlIkonaPregledPaketa() + "</span>" +
        '<span class="lp-popup-potek-korak__naziv">Pregled paketa</span>' +
        "</div>" +
        '<span class="lp-popup-potek-puscica" aria-hidden="true">→</span>' +
        '<div class="lp-popup-potek-korak">' +
        '<span class="lp-popup-potek-korak__st" aria-hidden="true">2</span>' +
        '<span class="lp-popup-potek-korak__ikona" aria-hidden="true">' + htmlIkonaPotrditev() + "</span>" +
        '<span class="lp-popup-potek-korak__naziv">Vaša potrditev</span>' +
        "</div>" +
        '<span class="lp-popup-potek-puscica" aria-hidden="true">→</span>' +
        '<div class="lp-popup-potek-korak">' +
        '<span class="lp-popup-potek-korak__st" aria-hidden="true">3</span>' +
        '<span class="lp-popup-potek-korak__ikona" aria-hidden="true">' + htmlVelikaIkonaPaketa(pkg.icon) + "</span>" +
        '<span class="lp-popup-potek-korak__naziv">' + esc(pkg.actionLabel) + "</span>" +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="lp-popup-varnost">' +
        '<span class="lp-popup-varnost-ikona" aria-hidden="true">' + IKONA_KLJUCAVNICA + "</span>" +
        "<span>Brez vaše končne potrditve se nič ne pošlje.</span>" +
        "</div>" +
        '<div class="lp-popup-skupaj">' +
        '<div class="lp-popup-skupaj-besedilo">' +
        '<span class="lp-popup-skupaj-naslov">Skupaj</span>' +
        '<span class="lp-popup-skupaj-podnapis">Z izbiro potrdite paket, ne še njegovega pošiljanja.</span>' +
        "</div>" +
        '<span class="lp-popup-skupaj-cena">' + esc(cena) + "</span>" +
        "</div>" +
        '<div class="lp-popup-gumbi">' +
        '<button type="button" class="lp-popup-gumb lp-popup-gumb--nazaj" id="lp-popup-nazaj">Nazaj</button>' +
        '<button type="button" class="lp-popup-gumb lp-popup-gumb--potrdi" id="lp-popup-potrdi">' +
        '<span class="lp-popup-gumb-kljukica" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>' +
        "Potrdi izbiro paketa</button>" +
        "</div>" +
        "</div>"
      );
    }

    function htmlPredogledPopup(pkg) {
      return (
        '<div class="lp-popup-ovoj lp-popup-ovoj--zaprt" id="lp-predogled-ovoj" hidden>' +
        '<div class="lp-popup-backdrop" id="lp-predogled-backdrop"></div>' +
        htmlPredogledPopupInner(pkg) +
        "</div>"
      );
    }

    function htmlPredogledPopupInner(pkg) {
      var itemsHtml = (pkg.includedItems || []).map(function (item) {
        return '<div class="lp-popup-vrstica"><span class="lp-popup-vrstica__kljukica" aria-hidden="true">✓</span><span>' + esc(item) + "</span></div>";
      }).join("");
      return (
        '<div class="lp-popup-panel" role="dialog" aria-modal="true" aria-labelledby="lp-predogled-naslov">' +
        '<div class="lp-popup-rocaj" aria-hidden="true"></div>' +
        '<div class="lp-popup-glava">' +
        '<h3 class="lp-popup-naslov" id="lp-predogled-naslov">' + esc(pkg.previewTitle) + "</h3>" +
        '<p class="lp-popup-podnaslov">' + esc(pkg.shortDescription) + "</p>" +
        '<button type="button" class="lp-popup-zapri" id="lp-predogled-zapri" aria-label="Zapri">×</button>' +
        "</div>" +
        '<div class="lp-popup-povzetek">' +
        '<div class="lp-popup-cena-vrstica">' +
        '<span class="lp-popup-cena-znesek">' + esc(formatirajCenoPaketa(pkg)) + "</span>" +
        "</div>" +
        "</div>" +
        '<div class="lp-popup-vkljucuje">' +
        '<h4 class="lp-popup-vkljucuje-naslov">Paket vključuje</h4>' +
        itemsHtml +
        "</div>" +
        '<div class="lp-popup-gumbi">' +
        '<button type="button" class="lp-popup-gumb lp-popup-gumb--nazaj" id="lp-predogled-zapri-gumb">Zapri</button>' +
        '<button type="button" class="lp-popup-gumb lp-popup-gumb--potrdi" id="lp-predogled-izberi">Izberi ta paket</button>' +
        "</div>" +
        "</div>"
      );
    }

    function opisTipaDatoteke(priloga) {
      if (!priloga) return "";
      var mime = String(priloga.mimeType || "").toLowerCase();
      if (mime.indexOf("pdf") >= 0) return "PDF";
      if (mime.indexOf("image") >= 0) return "Slika";
      var ime = String(priloga.originalFileName || priloga.name || "");
      var pika = ime.lastIndexOf(".");
      return pika >= 0 ? ime.slice(pika + 1).toUpperCase() : "Datoteka";
    }

    /* Generičen mini gradnik dokumentne zahteve. Mreža sprejme poljubno
       število zahtev iz podatkov izbranega odvetnika in jih samodejno zlaga
       po dve v vrstico. Vsak gradnik odpre kategorijski bottom-sheet z vsemi
       pripadajočimi datotekami; podnapis vedno kaže trenutno stanje. */
    function htmlPredajaDokumentPloscica(doc) {
      var jePripravljen = doc.status === "ready";
      var razredi =
        "opomin-predaja-sestavljalnik__ploscica" +
        (jePripravljen
          ? " opomin-predaja-sestavljalnik__ploscica--ok"
          : " opomin-predaja-sestavljalnik__ploscica--manjka");
      var notranjost =
        '<span class="opomin-predaja-sestavljalnik__ploscica-ikona" aria-hidden="true">' +
        IKONA_PREDAJA_DOKUMENT +
        "</span>" +
        '<span class="opomin-predaja-sestavljalnik__ploscica-besedilo">' +
        '<span class="opomin-predaja-sestavljalnik__ploscica-naslov">' +
        esc(doc.title) +
        "</span>" +
        '<span class="opomin-predaja-sestavljalnik__ploscica-podnapis">' +
        esc(doc.subtitle) +
        "</span>" +
        "</span>" +
        (jePripravljen
          ? '<span class="opomin-predaja-sestavljalnik__ploscica-status" aria-hidden="true">' +
            IKONA_PREDAJA_KLJUKICA_KROG +
            "</span>" +
            '<span class="opomin-predaja-sestavljalnik__ploscica-chevron" aria-hidden="true">' +
            IKONA_CHEVRON_DESNO +
            "</span>"
          : '<span class="opomin-predaja-sestavljalnik__ploscica-plus" aria-hidden="true">' +
            IKONA_PREDAJA_PLUS_KROG +
            "</span>");

      return (
        '<button type="button" class="' +
        razredi +
        '" data-dokument-odpri-tip="' +
        esc(doc.type) +
        '" data-dokument-ploscica="' +
        esc(doc.type) +
        '" aria-label="Odpri: ' +
        esc(doc.title) +
        ": " +
        esc(doc.subtitle) +
        '">' +
        notranjost +
        "</button>"
      );
    }

    /* Sekcija "Dokumenti" – glava s pillom, progress bar, mreža 2×2 in
       vrstica "Preglej vse dokumente" (odpre celoten sheet, glej
       odpriPredajaDokumentiSheet). Enoten vir stanja je
       N.dokumentnoStanjePredaje – glej opomin-nacrt.js. */
    function htmlPredajaDokumenti(plan, step, prilogeKoraka, podatkiKorak1) {
      var dokStanje = N.dokumentnoStanjePredaje(
        plan,
        step.index,
        podatkiKorak1,
        prilogeKoraka
      );
      var odstotek = Math.round(
        (dokStanje.preparedCount / dokStanje.baseTotal) * 100
      );
      var mrezaHtml = dokStanje.osnovniDokumenti
        .map(htmlPredajaDokumentPloscica)
        .join("");

      return (
        '<section class="opomin-predaja-sestavljalnik__dokumenti" id="opomin-predaja-sestavljalnik-dokumenti" aria-label="Dokumenti">' +
        '<div class="opomin-predaja-sestavljalnik__dokumenti-glava">' +
        '<span class="opomin-predaja-sestavljalnik__dokumenti-ikona" aria-hidden="true">' +
        IKONA_PREDAJA_DOKUMENT +
        "</span>" +
        '<h3 class="opomin-predaja-sestavljalnik__dokumenti-naslov">Dokumenti</h3>' +
        '<span class="opomin-predaja-sestavljalnik__dokumenti-status">' +
        dokStanje.preparedCount +
        " od " +
        dokStanje.baseTotal +
        " pripravljeno</span>" +
        "</div>" +
        '<div class="opomin-predaja-sestavljalnik__napredek" role="progressbar" aria-valuenow="' +
        dokStanje.preparedCount +
        '" aria-valuemin="0" aria-valuemax="' +
        dokStanje.baseTotal +
        '"><span class="opomin-predaja-sestavljalnik__napredek-crta" style="width:' +
        odstotek +
        '%"></span></div>' +
        '<div class="opomin-predaja-sestavljalnik__mreza">' +
        mrezaHtml +
        "</div>" +
        '<p class="opomin-predaja-sestavljalnik__dokumenti-napaka" id="opomin-predaja-dokument-napaka" role="alert" hidden></p>' +
        '<button type="button" class="opomin-predaja-sestavljalnik__vse-gumb" id="opomin-predaja-vsi-dokumenti">' +
        '<span class="opomin-predaja-sestavljalnik__vse-ikona" aria-hidden="true">' +
        IKONA_PREDAJA_DOKUMENT_OKO +
        "</span>" +
        '<span class="opomin-predaja-sestavljalnik__vse-besedilo">Preglej vse dokumente</span>' +
        '<span class="opomin-predaja-sestavljalnik__vse-stevilka">' +
        esc(N.stevecDokumentov(dokStanje.allCount)) +
        "</span>" +
        '<span class="opomin-predaja-sestavljalnik__vse-chevron" aria-hidden="true">' +
        IKONA_CHEVRON_DESNO +
        "</span>" +
        "</button>" +
        '<input type="file" id="opomin-dokument-datoteka" hidden multiple data-dokument-tip="" accept="image/*,.pdf" />' +
        "</section>"
      );
    }

    /* ========== Gumbi sestavljalnika – "Shrani osnutek" in "Nadaljuj na
       pregled" (Faza 7). Slednji nadomešča staro ločeno kartico "Priprava
       predaje": ista validacija (N.preveriPogojeZaPripravoPredaje + izbran
       paket), ista priprava nespremenljivega snapshota
       (N.pripraviPredajoOdvetniku), nato takoj odpre končni pregled. */
    function htmlPredajaGumbi(plan, step, prilogeKoraka, podatkiKorak1) {
      var lh = (step && step.lawyerHandoff) || {};
      var preverjeno = N.preveriPogojeZaPripravoPredaje(
        plan,
        step.index,
        podatkiKorak1,
        prilogeKoraka
      );

      var potrebnaPonovnaPriprava =
        lh.status === "needs_review" && Boolean(lh.preparedSnapshot);

      var opozoriloHtml = potrebnaPonovnaPriprava
        ? '<p class="opomin-predaja-sestavljalnik__opozorilo" role="status">Podatki so bili spremenjeni. Pred pregledom bo pripravljena nova različica.</p>'
        : "";

      var napakaHtml =
        '<div class="opomin-predaja-sestavljalnik__napaka" id="opomin-predaja-napaka" role="alert"' +
        (preverjeno.ok ? " hidden" : "") +
        ">" +
        (preverjeno.ok
          ? ""
          : "Manjkajo obvezni podatki: " + esc(preverjeno.manjkajoce.join(", ")) + ".") +
        "</div>";

      return napakaHtml + opozoriloHtml;
    }

    /* ========== Sestavljalnik 10. koraka "Predaja odvetniku" (Faza 7) – ena
       kartica: lebdeča pill odvetnika, dokumenti (2×2 mreža + "Preglej vse
       dokumente"), neposredno urejevalno sporočilo odvetniku, gumba "Shrani
       osnutek" / "Nadaljuj na pregled". Nadomešča prejšnje ločene sekcije
       (odvetnik / paket dokumentov / sporočilo / priprava predaje). */
    function htmlPredajaSestavljalnik(plan, step, prilogeKoraka, podatkiKorak1) {
      var lh = (step && step.lawyerHandoff) || {};
      var zaklenjeno = lh.status === "handed_over";
      return (
        '<div class="opomin-predaja-sestavljalnik' +
        (zaklenjeno ? " opomin-predaja-sestavljalnik--zaklenjeno" : "") +
        '">' +
        htmlPredajaOdvetnikPill(step) +
        htmlPredajaDnevi(step) +
        htmlPredajaDokumenti(plan, step, prilogeKoraka, podatkiKorak1) +
        '<hr class="opomin-predaja-sestavljalnik__locilo" />' +
        htmlPredajaSporocilo(step) +
        htmlPredajaGumbi(plan, step, prilogeKoraka, podatkiKorak1) +
        "</div>"
      );
    }

    /* ========== Končni pregled (Faza 6). Bere IZKLJUČNO iz
       step.lawyerHandoff.preparedSnapshot – nikoli iz živih podatkov koraka 1
       ali trenutnega stanja lawyerHandoff, da pregled vedno ustreza tisti
       različici, ki bo (ali je bila) dejansko predana. */
    function htmlKoncniPregledVsebina(step) {
      var lh = (step && step.lawyerHandoff) || {};
      var snap = lh.preparedSnapshot;
      if (!snap) {
        return (
          '<p class="opomin-koncni-pregled__manjka">Predaja še ni pripravljena – posnetek ne obstaja. Najprej klikni »Pripravi predajo«.</p>'
        );
      }
      var steviloRazlicic =
        (Array.isArray(lh.snapshotHistory) ? lh.snapshotHistory.length : 0) + 1;
      var namenMeta = NAMENI_PREDAJE_META.find(function (n) {
        return n.value === snap.namenPredaje;
      });
      var dolznik = snap.dolznik || {};
      var odvetnik = snap.odvetnik || {};
      var dneviPredaje = Array.isArray(odvetnik.mozniDneviPredaje)
        ? odvetnik.mozniDneviPredaje
            .map(function (izbran, index) {
              return izbran ? DNEVI_PREDAJE_OZNAKE[index] : null;
            })
            .filter(Boolean)
        : DNEVI_PREDAJE_OZNAKE.slice(0, 5);
      var casPredajeSnapshot = snap.casPredaje || {};
      var dokumenti = snap.dokumenti || [];
      var zgodovina = snap.zgodovinaOpominov || [];

      return (
        '<div class="opomin-koncni-pregled">' +
        '<p class="opomin-koncni-pregled__razlicica">Različica ' +
        steviloRazlicic +
        " · pripravljeno " +
        esc(formatCasPolno(lh.preparedAt)) +
        "</p>" +
        (lh.status === "handed_over" && lh.handedOverAt
          ? '<p class="opomin-koncni-pregled__predano">✓ Predano odvetniku ' +
            esc(formatCasPolno(lh.handedOverAt)) +
            "</p>"
          : lh.manuallyConfirmedAt
            ? '<p class="opomin-koncni-pregled__rocno">Ročno evidentirano kot predano ' +
              esc(formatCasPolno(lh.manuallyConfirmedAt)) +
              " (aplikacija ni ničesar poslala).</p>"
            : "") +
        '<section class="opomin-koncni-pregled__blok">' +
        "<h3>Dolžnik</h3>" +
        "<p>" +
        esc(dolznik.ime || "—") +
        "</p>" +
        '<p class="opomin-koncni-pregled__podrobno">' +
        esc(dolznik.telefon || "—") +
        " · " +
        esc(dolznik.email || "—") +
        "</p>" +
        '<p class="opomin-koncni-pregled__podrobno">Dolg: ' +
        esc(formatEurIzCentov(dolznik.znesekCentov)) +
        (dolznik.stevilkaRacuna
          ? " · Račun: " + esc(dolznik.stevilkaRacuna)
          : "") +
        "</p>" +
        "</section>" +
        '<section class="opomin-koncni-pregled__blok">' +
        "<h3>Odvetnik</h3>" +
        "<p>" +
        esc(odvetnik.ime || odvetnik.pisarna || "—") +
        (odvetnik.ime && odvetnik.pisarna ? " · " + esc(odvetnik.pisarna) : "") +
        "</p>" +
        '<p class="opomin-koncni-pregled__podrobno">' +
        esc(odvetnik.email || "—") +
        (odvetnik.telefon ? " · " + esc(odvetnik.telefon) : "") +
        "</p>" +
        '<p class="opomin-koncni-pregled__podrobno">Možni dnevi predaje: ' +
        esc(dneviPredaje.join(", ")) +
        "</p>" +
        '<p class="opomin-koncni-pregled__podrobno">Čas predaje: ' +
        esc(casPredajeSnapshot.nacin === "custom" ? "Določen čas" : "Čimprej") +
        (casPredajeSnapshot.scheduledAt
          ? " · " + esc(formatCasPolno(casPredajeSnapshot.scheduledAt))
          : "") +
        "</p>" +
        "</section>" +
        '<section class="opomin-koncni-pregled__blok">' +
        "<h3>Namen predaje</h3><p>" +
        esc((namenMeta && namenMeta.label) || snap.namenPredaje || "—") +
        "</p>" +
        "</section>" +
        '<section class="opomin-koncni-pregled__blok">' +
        "<h3>Sporočilo odvetniku</h3>" +
        '<p class="opomin-koncni-pregled__sporocilo">' +
        esc(snap.sporociloOdvetniku || "—") +
        "</p>" +
        "</section>" +
        '<section class="opomin-koncni-pregled__blok">' +
        "<h3>Dokumenti (" +
        dokumenti.length +
        ")</h3>" +
        (dokumenti.length
          ? '<ul class="opomin-koncni-pregled__seznam">' +
            dokumenti
              .map(function (d) {
                return (
                  "<li><strong>" +
                  esc(d.name || opisTipaDatoteke(d)) +
                  "</strong>" +
                  (d.descriptionQuestion
                    ? '<span class="opomin-koncni-pregled__opis-vprasanje">' +
                      esc(d.descriptionQuestion) +
                      "</span>"
                    : "") +
                  (d.description
                    ? '<span class="opomin-koncni-pregled__opis-odgovor">' +
                      esc(d.description) +
                      "</span>"
                    : '<span class="opomin-koncni-pregled__opis-prazno">Brez dodatnega opisa</span>') +
                  "</li>"
                );
              })
              .join("") +
            "</ul>"
          : '<p class="opomin-koncni-pregled__podrobno">Ni dokumentov.</p>') +
        "</section>" +
        '<section class="opomin-koncni-pregled__blok">' +
        "<h3>Zgodovina opominov (" +
        zgodovina.length +
        ")</h3>" +
        (zgodovina.length
          ? '<ul class="opomin-koncni-pregled__seznam">' +
            zgodovina
              .map(function (z) {
                return (
                  "<li>" +
                  z.index +
                  ". " +
                  esc(z.naslov || "") +
                  " · " +
                  esc(statusZnacka(z.status)) +
                  "</li>"
                );
              })
              .join("") +
            "</ul>"
          : '<p class="opomin-koncni-pregled__podrobno">Ni zapisov.</p>') +
        "</section>" +
        "</div>"
      );
    }

    function htmlVsebinaKoraka(ctx) {
      ctx = ctx || {};
      var PV = root.UJPrilogeVsebina;
      var K = root.UJPrilogeKonstante || {};
      var znesekTekst = ctx.znesekTekst;
      var tonOznaka = ctx.tonOznaka || "—";
      var smsBesedilo = ctx.smsBesedilo || "";
      var smsUrejanje = ctx.smsUrejanje || "";
      var smsMeta = ctx.smsMeta || "";
      var imaSms = Boolean(String(smsBesedilo).trim());
      var priloge = ctx.priloge || [];
      var imaTel = Boolean(ctx.imaTelefon);
      var imaEmail = Boolean(ctx.imaEmail);
      var readyN = PV ? PV.stevecReady(priloge) : 0;
      var accept = K.ACCEPT_ATTR || "image/*,application/pdf";
      var sporociloKanali = ctx.sporociloKanali || {
        sms: imaTel,
        email: imaEmail,
      };
      var casPosiljanjaIso = ctx.casPosiljanjaIso || null;
      var casPosiljanjaBesedilo = casPosiljanjaIso
        ? "Pošlje se " + formatCasPolno(casPosiljanjaIso)
        : "Čas pošiljanja še ni določen";
      var casPosiljanjaHtml = ctx.randomAktiven && casPosiljanjaIso
        ? besediloZModroRandomUro(
            casPosiljanjaBesedilo,
            casPosiljanjaIso
          )
        : esc(casPosiljanjaBesedilo);
      var razmikPoPrejsnjem = ctx.razmikPoPrejsnjem || "";

      return (
        '<section class="step-content-card" aria-label="Vsebina koraka">' +
        '<div class="step-content-card__header">' +
        '<h3 class="step-content-card__title">Vsebina koraka</h3>' +
        '<div class="step-content-card__send-row">' +
        '<p class="step-content-card__send-time">' +
        '<span class="step-content-card__send-time-icon" aria-hidden="true">' +
        IKONA_KOLEDAR +
        '</span><span class="step-content-card__send-time-copy">' +
        '<span class="step-content-card__send-time-main">' +
        casPosiljanjaHtml +
        "</span>" +
        (razmikPoPrejsnjem
          ? '<span class="step-content-card__send-time-offset">' +
            esc(razmikPoPrejsnjem) +
            "</span>"
          : "") +
        "</span></p></div></div>" +
        htmlKontaktneKartice(ctx) +
        '<div class="debt-summary debt-summary--compact">' +
        '<span class="debt-summary__icon" aria-hidden="true">' +
        IKONA_DENARNICA +
        "</span>" +
        '<div class="debt-summary__main">' +
        '<span class="debt-summary__label">Dolg</span>' +
        '<span class="debt-summary__amount">' +
        esc(znesekTekst || "—") +
        "</span>" +
        "</div>" +
        '<button type="button" class="debt-summary__tone" data-vsebina="ton" aria-label="Spremeni ton sporočila. Trenutno: ' +
        esc(tonOznaka) +
        '.">' +
        '<span class="debt-summary__tone-content">' +
        '<span class="debt-summary__tone-label">Ton sporočila</span>' +
        '<span class="debt-summary__tone-value">' +
        esc(tonOznaka) +
        "</span>" +
        "</span>" +
        '<span class="debt-summary__tone-chevron" aria-hidden="true">›</span>' +
        "</button>" +
        "</div>" +
        '<div class="vk-sporocilo-priloge">' +
        '<div class="sms-preview">' +
        '<div class="sms-preview__header">' +
        '<span class="sms-preview__title">SMS</span>' +
        '<span class="sms-preview__meta">' +
        esc(smsMeta) +
        "</span>" +
        "</div>" +
        '<p class="sms-preview__caption">Besedilo lahko popravite neposredno tukaj.</p>' +
        '<div class="sms-preview__okno">' +
        '<textarea class="sms-preview__viewport" id="opomin-sms-urejanje" aria-label="Uredi SMS sporočilo" maxlength="1000" placeholder="Napišite SMS sporočilo">' +
        esc(smsUrejanje) +
        "</textarea>" +
        "</div>" +
        '<section class="opomin-sporocilo-dodatki" aria-labelledby="opomin-sporocilo-dodatki-naslov">' +
        '<h4 class="opomin-sporocilo-dodatki__naslov" id="opomin-sporocilo-dodatki-naslov">Dodajte v sporočilo</h4>' +
        '<p class="opomin-sporocilo-dodatki__opis">Izbrani podatki se dodajo na konec besedila.</p>' +
        '<div class="sporocilo-dodatki__gumbi" role="group" aria-label="Dodatki v sporočilo">' +
        htmlAddonKartica({
          ikona: IKONA_ROK,
          naslov: "Rok plačila",
          stanje: ctx.rokStanje,
          vklopljeno: ctx.rokStanje === "Vklopljeno",
          priporocilo: true,
          akcija: "rok",
          aria: "Nastavi rok plačila. Trenutno: " + (ctx.rokStanje || "Izklopljeno"),
        }) +
        htmlAddonKartica({
          ikona: IKONA_OBROCNO,
          naslov: "Obročno plačilo",
          stanje: ctx.obrocnoStanje,
          vklopljeno: ctx.obrocnoStanje === "Vklopljeno",
          priporocilo: true,
          akcija: "obrocno",
          aria: "Nastavi obročno plačilo. Trenutno: " + (ctx.obrocnoStanje || "Izklopljeno"),
        }) +
        htmlAddonKartica({
          ikona: IKONA_TRR,
          naslov: "TRR",
          stanje: ctx.trrStanje,
          vklopljeno: ctx.trrStanje === "Vklopljeno",
          akcija: "trr",
          aria: "Nastavi TRR. Trenutno: " + (ctx.trrStanje || "Izklopljeno"),
        }) +
        "</div>" +
        "</section>" +
        '<div class="opomin-potrdi-predloge" id="opomin-glavni-predloge" hidden>' +
        '<div class="opomin-potrdi-predloge__glava">' +
        '<p class="opomin-potrdi-predloge__naslov">Predloge</p>' +
        '<button type="button" class="opomin-potrdi-predloge__vec" id="opomin-glavni-predloge-vec">Dodaj predlog</button>' +
        "</div>" +
        '<div class="opomin-potrdi-predloge__drsnik" id="opomin-glavni-predloge-drsnik" role="list"></div>' +
        '<div class="opomin-potrdi-predloge__indikator" id="opomin-glavni-predloge-indikator" aria-hidden="true">' +
        '<span class="opomin-potrdi-predloge__pika opomin-potrdi-predloge__pika--aktivna"></span>' +
        '<span class="opomin-potrdi-predloge__pika"></span>' +
        '<span class="opomin-potrdi-predloge__pika"></span>' +
        "</div>" +
        "</div>" +
        "</div>" +
        htmlZgornjaOrodnaVrstica(readyN) +
        htmlSkupniKanaliRacunov(imaTel, imaEmail) +
        '<div class="vk-priloge-kartice-seznam"' +
        (priloge.length ? "" : " hidden") +
        ">" +
        priloge
          .map(function (p) {
            return htmlKarticaRacuna(p, imaTel, imaEmail);
          })
          .join("") +
        "</div>" +
        '<p class="vk-priloge-napaka" id="vk-priloge-napaka" hidden></p>' +
        '<input type="file" id="vk-priloge-datoteka" accept="' +
        esc(accept) +
        '" multiple hidden aria-label="Uvozi račun" />' +
        '<input type="file" id="vk-priloge-kamera" accept="image/*" capture="environment" hidden aria-label="Slikaj račun" />' +
        "</div>" +
        "</section>"
      );
    }

    function izrisiGlavni() {
      if (hitraUraTimer) {
        clearInterval(hitraUraTimer);
        hitraUraTimer = null;
      }
      var imaTelefon = Boolean(
        opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika
      );
      var step = N.najdiKorak(plan, aktivenIndex) || plan.steps[0];
      uskladiPrikazPriporocila(step);
      var prejsnji = N.najdiKorak(plan, aktivenIndex - 1);
      var naslednji = N.najdiKorak(plan, Number(aktivenIndex) + 1);
      var ready = N.soVsiSmsPotrjeni(plan);
      var potrjeno = potrjeniCount();
      var k2 = opts.podatkiKorak2 || {};
      var imaEmailGlobalno = Boolean(
        opts.podatkiKorak1 && opts.podatkiKorak1.emailDolznika
      );
      var sporociloKanaliGlobalno =
        k2.sporociloKanali || { sms: imaTelefon, email: imaEmailGlobalno };
      if (!step.primaryContacts) {
        step.primaryContacts = {
          sms: Boolean(sporociloKanaliGlobalno.sms),
          email: Boolean(sporociloKanaliGlobalno.email),
        };
      }
      var jeManual =
        step.kind === "manual_lawyer" || step.deliveryMode === "manual";
      if (
        jeManual &&
        step.lawyerHandoff &&
        !step.lawyerHandoff.scheduledHandoffAt &&
        typeof N.posodobiCasPredajeOdvetniku === "function"
      ) {
        plan = N.posodobiCasPredajeOdvetniku(
          plan,
          step.index,
          "asap",
          najzgodnejsiCasPredaje(dneviPredajeKoraka(step))
        );
        step = N.najdiKorak(plan, step.index) || step;
        N.shraniOsnutek(plan);
      }
      var razmikPrejsnji = razmikOdPrejsnjega(plan, step);

      var korakPoslan = step.status === "sent";
      var korakPremakljiv =
        typeof N.jeKorakPremakljiv === "function"
          ? N.jeKorakPremakljiv(step)
          : !korakPoslan && !jeManual;
      var spremeniCasGumbHtml =
        !korakPoslan && !jeManual && korakPremakljiv
          ? '<button type="button" class="opomin-nacrt__gumb-spremeni" id="opomin-spremeni-cas"><span aria-hidden="true">✎</span> Spremeni</button>'
          : "";

      var jePrviKorak = Number(step.index) === 1;
      var prejsnjiKorakZaUro = najdiPrejsnjiAktivniKorak(plan, step.index);
      var hardOknoZaUro = dovoljenoOknoKoraka(plan, step);
      var uraZaHitriGumbIso = jePrviKorak
        ? new Date().toISOString()
        : prikazniCasKoraka(prejsnjiKorakZaUro) || step.sendAt || step.scheduledAt;
      var hitraUraZgorajHtml =
        !korakPoslan &&
        !jeManual &&
        korakPremakljiv
          ? '<div class="opomin-nacrt__izbira-ure opomin-nacrt__izbira-ure--drugi" role="group" aria-label="Izbira ure tega koraka">' +
            '<button type="button" class="opomin-nacrt__izbira-ure-gumb' +
            (izbranCasNacin === "zdaj" ? " opomin-nacrt__izbira-ure-gumb--aktiven" : "") +
            '" id="opomin-uporabi-zivo-uro" aria-label="' +
            (jePrviKorak ? "Uporabi trenutno uro" : "Uporabi uro prejšnjega koraka") +
            '">' +
            IKONA_URA +
            '<span class="opomin-nacrt__izbira-ure-vsebina">' +
            (jePrviKorak
              ? '<span id="opomin-ziva-ura-prikaz" class="opomin-nacrt__izbira-ure-cas-siva">' +
                esc(formatCasKratko(uraZaHitriGumbIso)) +
                "</span>"
              : '<span class="opomin-nacrt__izbira-ure-naziv">Prejšnji korak</span>' +
                '<span id="opomin-ziva-ura-prikaz" class="opomin-nacrt__izbira-ure-podnapis opomin-nacrt__izbira-ure-podnapis--ura">' +
                esc(formatCasKratko(uraZaHitriGumbIso)) +
                "</span>") +
            "</span></button>" +
            '<label class="opomin-nacrt__izbira-ure-gumb' +
            (izbranCasNacin === "rocno" ? " opomin-nacrt__izbira-ure-gumb--aktiven" : "") +
            (randomJeVklopljen(step)
              ? " opomin-nacrt__izbira-ure-gumb--random-povezan"
              : "") +
            '"><span class="opomin-nacrt__izbira-ure-vsebina"><span class="opomin-nacrt__izbira-ure-naziv">Določi točno uro</span>' +
            (izbranCasNacin === "rocno"
              ? '<small class="opomin-nacrt__izbira-ure-podnapis opomin-nacrt__izbira-ure-podnapis--ura">' +
                esc(formatCasKratko(step.sendAt || step.scheduledAt)) +
                "</small>"
              : "") +
            "</span>" +
            '<input type="time" id="opomin-hitra-ura-input" min="' +
            esc(hardOknoZaUro.start) +
            '" max="' +
            esc(hardOknoZaUro.end) +
            '" value="' +
            esc(isoZaTimeInput(step.sendAt || step.scheduledAt)) +
            '" aria-label="Ročno nastavi uro tega koraka" /></label>' +
            "</div>" +
            '<p class="opomin-nacrt__ura-inline-napaka" id="opomin-hitra-ura-napaka" role="alert" hidden></p>'
          : "";

      var imaDodelanCasWidget = !korakPoslan && !jeManual && korakPremakljiv;
      var randomAktiven = randomJeVklopljen(step);
      if (
        randomAktiven &&
        !dolocenRandomCas(step) &&
        !step._randomSchedule._previewResolvedAt
      ) {
        ustvariRandomPredogled(step, step._randomSchedule);
        N.shraniOsnutek(plan);
      }
      var randomResolvedAt = dolocenRandomCas(step);
      var randomPonoviDovoljen = Boolean(
        randomAktiven &&
          !randomResolvedAt &&
          step.status !== "confirmed" &&
          step.status !== "sent" &&
          step.status !== "processing"
      );
      var randomPrikazAt = prikazniRandomCas(step);
      var stepZaPrikazCasa = randomPrikazAt
        ? Object.assign({}, step, {
            sendAt: randomPrikazAt,
            scheduledAt: randomPrikazAt,
          })
        : step;
      var besediloCasa = korakPoslan
        ? besediloPoslano(step)
        : jeManual
          ? besediloPredajeOdvetniku(plan, stepZaPrikazCasa)
          : Number(step.index) === 1
            ? besediloDatumaPosiljanja(stepZaPrikazCasa)
            : besediloPosiljanja(stepZaPrikazCasa);
      var besediloCasaHtml = randomAktiven
        ? besediloZModroRandomUro(
            besediloCasa,
            stepZaPrikazCasa.sendAt || stepZaPrikazCasa.scheduledAt
          )
        : esc(besediloCasa);
      // Priporočen razmik ZA TA korak, glede na prejšnji (ne-izključen) korak.
      var prejsnjiAktiven = null;
      var vkljuceni = (plan.steps || []).filter(function (s) { return !s.isExcluded; });
      var aktivenPozVkljucenih = -1;
      for (var vi = 0; vi < vkljuceni.length; vi++) {
        if (vkljuceni[vi].index === step.index) { aktivenPozVkljucenih = vi; break; }
      }
      if (aktivenPozVkljucenih > 0) {
        prejsnjiAktiven = vkljuceni[aktivenPozVkljucenih - 1];
      }

      var priporoceniRazmikDni = 0;
      var priporoceniRazmikJeUporabljen = false;
      var priporoceniRazmikOdDanes = !prejsnjiAktiven;
      if (!jeManual) {
        var bo = plan._baseOffsets || [];
        var trenutniBO = Math.max(
          0,
          (bo[step.index - 1] != null ? bo[step.index - 1] : 0) || 0
        );
        if (prejsnjiAktiven) {
          var prejsnjiBO = Math.max(
            0,
            (bo[prejsnjiAktiven.index - 1] != null ? bo[prejsnjiAktiven.index - 1] : 0) || 0
          );
          priporoceniRazmikDni = Math.max(0, trenutniBO - prejsnjiBO);
          // Preveri, če je trenutni razmik (od prejšnjega koraka) že enak priporočenemu
          var dejanskiRazmik = razmikOdPrejsnjega(plan, step);
          priporoceniRazmikJeUporabljen = dejanskiRazmik === priporoceniRazmikDni;
        } else {
          // Prvi korak nima prejšnjega – primerjamo glede na "danes".
          priporoceniRazmikDni = trenutniBO;
          var dejanskiOdDanes = dneviOdDanes(step.sendAt || step.scheduledAt);
          priporoceniRazmikJeUporabljen = dejanskiOdDanes === priporoceniRazmikDni;
        }
      }

      var priporocenoGumbHtml =
        '<button type="button" class="opomin-nacrt__gumb-enako' +
        (priporoceniRazmikJeUporabljen ? " opomin-nacrt__gumb-enako--aktiven" : "") +
        '" id="opomin-enako-cas" aria-label="Priporočeno"><span aria-hidden="true">★</span> Priporočeno</button>';

      // Zlata vrstica: samo opisno besedilo (ni klikljivo), vedno zlato z zvezdico.
      var priporoceniRazmikHtml = "";
      if (!jeManual) {
        var casovniDelBesedila;
        if (priporoceniRazmikDni > 0) {
          var razmikBesedilo = N.slovenskaDniBeseda
            ? N.slovenskaDniBeseda(priporoceniRazmikDni)
            : priporoceniRazmikDni + " dni";
          casovniDelBesedila =
            '<strong class="opomin-priporocen-razmik__dni">čez ' + esc(razmikBesedilo) + "</strong>" +
            (priporoceniRazmikOdDanes ? " od danes" : " od prejšnjega");
        } else {
          casovniDelBesedila = '<strong class="opomin-priporocen-razmik__dni">danes</strong>';
        }
        priporoceniRazmikHtml =
          '<p class="opomin-priporocen-razmik">' +
          '<span class="opomin-priporocen-razmik__ikona" aria-hidden="true">★</span>' +
          '<span class="opomin-priporocen-razmik__besedilo">' +
          (priporoceniRazmikJeUporabljen
            ? "Kot priporočeno: ta korak bo poslan "
            : "Priporočamo: ta korak naj bo poslan ") +
          casovniDelBesedila +
          "</span>" +
          "</p>";
      }
      var randomGumbHtml =
        '<button type="button" class="opomin-nacrt__gumb-random' +
        (step._randomSchedule && step._randomSchedule.enabled
          ? " opomin-nacrt__gumb-random--aktiven"
          : "") +
        '" id="opomin-random-cas" aria-pressed="' +
        (step._randomSchedule && step._randomSchedule.enabled ? "true" : "false") +
        '">' +
        IKONA_RANDOM +
        '<span>Random</span></button>';
      var predizborOvojHtml =
        '<span class="opomin-nacrt__predizbor-ovoj">' +
        '<button type="button" class="opomin-nacrt__gumb-predizbor' +
        (izbranCasNacin === "predizbor"
          ? " opomin-nacrt__gumb-predizbor--aktiven"
          : "") +
        '" id="opomin-predizbor-cas" aria-haspopup="true" aria-expanded="false">' +
        '<svg class="opomin-nacrt__gumb-predizbor-puscica" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.25 4.5 6 8.25 9.75 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span class="opomin-nacrt__gumb-predizbor-tekst">Predizbor</span>' +
        '</button>' +
        '<div class="opomin-nacrt__predizbor-meni" id="opomin-predizbor-meni" hidden></div>' +
        "</span>";
      var odmikDniHtml = "";
      var prejsnjiKorakZaOdmik = null;
      if (Number(step.index) > 1) {
        var korakiZaOdmik = plan.steps || [];
        var pozicijaKorakaZaOdmik = korakiZaOdmik.findIndex(function (korak) {
          return Number(korak.index) === Number(step.index);
        });
        for (var oi = pozicijaKorakaZaOdmik - 1; oi >= 0; oi--) {
          if (!korakiZaOdmik[oi].isExcluded) {
            prejsnjiKorakZaOdmik = korakiZaOdmik[oi];
            break;
          }
        }
      }
      if (imaDodelanCasWidget) {
        var praviDneviOdmika = prejsnjiKorakZaOdmik
          ? razmikOdPrejsnjega(plan, step)
          : dneviOdDanes(step.sendAt || step.scheduledAt);
        var prikazanaVrednostOdmika = pretvoriDneveVEnoto(
          praviDneviOdmika,
          casSheetEnota
        );
        var oznakaOdmika = prejsnjiKorakZaOdmik
          ? "Čez koliko dni od prejšnjega koraka"
          : "Čez koliko dni od danes";
        odmikDniHtml =
          '<span class="opomin-nacrt__cas-odmik-vrstica">' +
          '<span class="opomin-cas-sheet__oznaka">' +
          esc(oznakaOdmika) +
          "</span>" +
          '<span class="opomin-nacrt__cas-odmik-kontrolniki">' +
          '<span class="opomin-cas-sheet__enota" role="group" aria-label="Enota časa">' +
          '<button type="button" class="opomin-cas-sheet__enota-gumb' +
          (casSheetEnota === "dan" ? " opomin-cas-sheet__enota-gumb--aktiven" : "") +
          '" data-hitri-enota="dan">Dnevi</button>' +
          '<button type="button" class="opomin-cas-sheet__enota-gumb' +
          (casSheetEnota === "teden" ? " opomin-cas-sheet__enota-gumb--aktiven" : "") +
          '" data-hitri-enota="teden">Tedni</button>' +
          '<button type="button" class="opomin-cas-sheet__enota-gumb' +
          (casSheetEnota === "mesec" ? " opomin-cas-sheet__enota-gumb--aktiven" : "") +
          '" data-hitri-enota="mesec">Meseci</button></span>' +
          '<span class="opomin-nacrt__dnevi-krmilnik">' +
          '<button type="button" class="opomin-nacrt__dnevi-btn" id="opomin-hitri-dnevi-minus" aria-label="Manj">−</button>' +
          '<input type="number" id="opomin-hitri-dnevi" class="opomin-nacrt__dnevi-input" min="0" step="1" value="' +
          esc(prikazanaVrednostOdmika) +
          '" aria-label="Vrednost v izbrani enoti" />' +
          '<button type="button" class="opomin-nacrt__dnevi-btn" id="opomin-hitri-dnevi-plus" aria-label="Več">+</button>' +
          "</span>" +
          '<label class="opomin-nacrt__hitri-koledar' +
          (izbranCasNacin === "datum" ? " opomin-nacrt__hitri-koledar--aktiven" : "") +
          '"><span aria-hidden="true">' +
          IKONA_KOLEDAR +
          "</span>" +
          '<input type="date" id="opomin-hitri-datum" value="' +
          esc(isoZaDateInput(step.sendAt || step.scheduledAt)) +
          '" aria-label="Ročno izberi točen datum" /></label>' +
          "</span></span>";
      }
      var preskokZnackaHtml = "";
      if (imaDodelanCasWidget && Number(step._preskokDni)) {
        var preskokVrednostZnacka = Number(step._preskokDni);
        preskokZnackaHtml =
          '<span class="opomin-nacrt__preskok-znacka">' +
          (preskokVrednostZnacka > 0 ? "+" : "−") +
          Math.abs(preskokVrednostZnacka) +
          " dni</span>";
      }
      var datumNadPoljemHtml = imaDodelanCasWidget
        ? '<div class="opomin-nacrt__datum-nad-poljem">' +
          '<span class="opomin-nacrt__cas-ikona" aria-hidden="true">' +
          IKONA_KOLEDAR +
          "</span>" +
          '<span class="opomin-nacrt__cas-tekst"' +
          (randomAktiven
            ? ' title="' + (randomResolvedAt ? "Čas je določil Random" : "Random je vključen") + '"'
            : "") +
          "\">" +
          besediloCasaHtml +
          "</span>" +
          (randomAktiven
            ? '<button type="button" class="opomin-nacrt__random-znacka" id="opomin-random-ponovi-zgoraj" aria-label="Izberi drug naključni čas"' +
              (randomPonoviDovoljen
                ? ""
                : ' disabled aria-disabled="true" title="Čas je že potrjen"') +
              ">" +
              IKONA_RANDOM +
              '<span>Random</span></button>'
            : "") +
          preskokZnackaHtml +
          "</div>"
        : "";

      var casKarticaHtml =
        '<div class="opomin-nacrt__cas-vrstica' +
        (Number(step.index) === 1 && !imaDodelanCasWidget
          ? " opomin-nacrt__cas-vrstica--prvi"
          : "") +
        '">' +
        '<span class="opomin-nacrt__cas-ikona' +
        (imaDodelanCasWidget ? " opomin-nacrt__datum-rezerviran-prostor" : "") +
        '" aria-hidden="true">' +
        IKONA_KOLEDAR +
        "</span>" +
        '<span class="opomin-nacrt__cas-tekst' +
        (imaDodelanCasWidget ? " opomin-nacrt__datum-rezerviran-prostor" : "") +
        '">' +
        besediloCasaHtml +
        "</span>" +
        hitraUraZgorajHtml +
        (jeManual
          ? !korakPoslan && korakPremakljiv
            ? '<label class="opomin-nacrt__gumb-cas-uredi opomin-nacrt__datum-predaje-polje" for="opomin-datum-predaje">' +
              IKONA_UREDI +
              " Spremeni datum" +
              '<input type="date" id="opomin-datum-predaje" value="' +
              esc(isoZaDateInput(step.sendAt || step.scheduledAt)) +
              '" aria-label="Datum predaje odvetniku" /></label>'
            : ""
          : '<button type="button" class="opomin-nacrt__gumb-cas-uredi' +
            (imaDodelanCasWidget ? " opomin-nacrt__gumb-cas-uredi--drugi" : "") +
            '" id="opomin-spremeni-cas">' + IKONA_UREDI + ' Določi čas</button>') +
        (korakPoslan || jeManual
          ? ""
          : korakPremakljiv
            ? imaDodelanCasWidget
              ? odmikDniHtml +
                '<span class="opomin-nacrt__cas-gumbi opomin-nacrt__cas-gumbi--tretja">' +
                randomGumbHtml +
                predizborOvojHtml +
                priporocenoGumbHtml +
                "</span>"
              : '<span class="opomin-nacrt__cas-gumbi">' +
                priporocenoGumbHtml +
                (Number(step.index) === 1
                  ? '<span class="opomin-nacrt__cas-gumb-prostor" aria-hidden="true"></span>'
                  : '<button type="button" class="opomin-nacrt__gumb-zdaj' +
                    (izbranCasNacin === "zdaj"
                      ? " opomin-nacrt__gumb-zdaj--aktiven"
                      : "") +
                    '" id="opomin-zdaj-cas" aria-label="Uporabi uro prejšnjega koraka">Prejšnji korak</button>') +
                randomGumbHtml +
                predizborOvojHtml +
                "</span>"
            : "") +
        "</div>" +
        (step._randomSchedule && step._randomSchedule.enabled
          ? (step._randomSchedule.resolvedScheduledAt
            ? '<p class="random-sheet__rezultat" style="margin:4px 0 0">' +
              esc(randomPojasnilo(
                step,
                step._randomSchedule.resolvedScheduledAt
              )) + '</p>'
            : (step._randomSchedule._previewResolvedAt
              ? '<p class="random-sheet__rezultat" style="margin:4px 0 0">' +
                esc(randomPojasnilo(
                  step,
                  step._randomSchedule._previewResolvedAt
                )) + '</p>'
              : '<p class="random-sheet__rezultat" style="margin:4px 0 0">Random je vklopljen. Ura bo izbrana ob potrditvi.</p>'))
          : "");

      var DNEVI_TEDNA = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];
      var aktivniDnevi = (plan._aktivniDnevi && plan._aktivniDnevi.length === 7)
        ? plan._aktivniDnevi
        : [true, true, true, true, true, true, true];
      var dneviVTednuHtml = "";
      for (var di = 0; di < DNEVI_TEDNA.length; di++) {
        dneviVTednuHtml +=
          '<button type="button" class="opomin-nacrt__dan' +
          (aktivniDnevi[di] ? " opomin-nacrt__dan--aktiven" : "") +
          '" data-dan="' + di + '" aria-pressed="' + (aktivniDnevi[di] ? "true" : "false") + '">' +
          DNEVI_TEDNA[di] +
          "</button>";
      }

      /* Dejanski zamik (step._preskokDni) nastavi N.uskladiOffseteIzDatumov –
         step.sendAt je tu že prilagojen (premaknjen na aktiven dan), zato za
         prikaz opombe rekonstruiramo pot od izvirnega (nezamaknjenega) datuma
         in naštejemo VSE neaktivne dni, čez katere je zamik dejansko šel
         (ne samo prvega). */
      var DNEVI_TEDNA_POLNA = [
        "Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota", "Nedelja",
      ];
      var prilagoditevDneviOpomba = "";
      var vseDneviAktivni = aktivniDnevi.every(function (a) { return a; });
      var stepPreskokDni = Number(step && step._preskokDni) || 0;
      if (!vseDneviAktivni && step && !jeManual && stepPreskokDni !== 0) {
        var datumPosiljanja = new Date(step.sendAt || step.scheduledAt);
        if (!Number.isNaN(datumPosiljanja.getTime())) {
          var izvirniDatum = new Date(
            datumPosiljanja.getTime() - stepPreskokDni * 86400000
          );
          var smerKoraka = stepPreskokDni > 0 ? 1 : -1;
          var preskoceniDnevi = [];
          var kazalec = new Date(izvirniDatum.getTime());
          for (var pk = 0; pk < Math.abs(stepPreskokDni); pk++) {
            var dIdx = kazalec.getDay();
            var sIdx = dIdx === 0 ? 6 : dIdx - 1;
            var imeDneva = DNEVI_TEDNA_POLNA[sIdx];
            if (preskoceniDnevi.indexOf(imeDneva) === -1) {
              preskoceniDnevi.push(imeDneva);
            }
            kazalec.setDate(kazalec.getDate() + smerKoraka);
          }
          var seznamDniBesedilo =
            preskoceniDnevi.length > 1
              ? preskoceniDnevi.slice(0, -1).join(", ") +
                " in " +
                preskoceniDnevi[preskoceniDnevi.length - 1]
              : preskoceniDnevi[0] || "";
          var glagolStanja = preskoceniDnevi.length > 1 ? "niso aktivni" : "ni aktiven";
          var glagolPreskoka = stepPreskokDni > 0 ? "prištetih" : "odštetih";
          prilagoditevDneviOpomba =
            '<p class="opomin-nacrt__dnevi-opomba">' +
            seznamDniBesedilo + " " + glagolStanja + " — " + glagolPreskoka + " " +
            Math.abs(stepPreskokDni) + " dni</p>";
        }
      }

      var karticeHtml = "";

      var podrobnostCas =
        !jeManual && step.index > 1
          ? '<p class="opomin-nacrt__cas-podrobnost">' +
            esc(formatCasPolno(step.sendAt || step.scheduledAt)) +
            " · " +
            esc(
              N.oznakaPoPrejsnjem
                ? N.oznakaPoPrejsnjem(Math.max(0, razmikPrejsnji))
                : Math.max(0, razmikPrejsnji) + " dni po prejšnjem koraku"
            ) +
            "</p>"
          : "";

      var vkljuceniKoraki = plan.steps.filter(function (s) { return !s.isExcluded; });
      var prikazaniKoraki = urejanjeKartic ? plan.steps : vkljuceniKoraki;
      var vkljuceniSamodejniKoraki = vkljuceniKoraki.filter(function (s) {
        return s.kind !== "manual_lawyer";
      });

      /* Preslikava index → prikazni red: izključeni koraki se preskočijo. */
      var prikazniRedMap = {};
      var prikazniRedStevec = 0;
      plan.steps.forEach(function (s) {
        if (!s.isExcluded) {
          prikazniRedStevec++;
          prikazniRedMap[s.index] = prikazniRedStevec;
        }
      });
      var prikazniRedStep = step ? (prikazniRedMap[step.index] || step.order) : 1;

      var pikeHtml = vkljuceniKoraki
        .map(function (s) {
          return (
            '<span class="' +
            razredPika(s) +
            '" role="listitem" aria-label="' +
            esc(s.title) +
            ", " +
            esc(statusZnacka(s.status, s.kind)) +
            '">' +
            vsebinaPika(s) +
            "</span>"
          );
        })
        .join("");

      var carouselHtml = prikazaniKoraki
        .map(function (s) {
          var aktiven = s.index === aktivenIndex;
          var jeVVeljavnemUrejanju = urejanjeKartic;
          var barvniRazred = "";
          if (!s.isExcluded && s.kind === "manual_lawyer") {
            barvniRazred = " opomin-nacrt__stage--barvna opomin-nacrt__stage--predaja";
          } else if (!s.isExcluded) {
            var barvnaPozicija = vkljuceniSamodejniKoraki.indexOf(s);
            var barvniNivo = dolociBarvniNivo(
              barvnaPozicija,
              vkljuceniSamodejniKoraki.length
            );
            barvniRazred =
              " opomin-nacrt__stage--barvna opomin-nacrt__stage--eskalacija-" +
              barvniNivo;
          }
          var razmikDoPrejsnjega = razmikOdPrejsnjega(plan, s);
          var jeIstiDan = s.index > 1 && razmikDoPrejsnjega === 0 && !s.isExcluded;
          var casIzvenDovoljenega = jeCasKorakaIzvenDovoljenega(plan, s);
          var blokirajociPredZadnjim = N.prviNepotrjenPredZadnjimKorakom
            ? N.prviNepotrjenPredZadnjimKorakom(plan, s.index)
            : null;
          var zaklenjenZadnji = Boolean(blokirajociPredZadnjim);
          var html =
            '<div class="opomin-nacrt__stage-ovoj' +
            (jeVVeljavnemUrejanju ? " opomin-nacrt__stage-ovoj--urejanje" : "") +
            (s.isExcluded ? " opomin-nacrt__stage-ovoj--izkljucen" : "") +
            (jeIstiDan ? " opomin-nacrt__stage-ovoj--isti-dan" : "") +
            '">' +
            '<button type="button" class="opomin-nacrt__stage' +
            barvniRazred +
            (aktiven ? " opomin-nacrt__stage--izbran" : "") +
            (s.isExcluded ? " opomin-nacrt__stage--izkljucen" : "") +
            (s.status === "confirmed" ? " opomin-nacrt__stage--potrjen" : "") +
            (zaklenjenZadnji ? " opomin-nacrt__stage--zaklenjen" : "") +
            (casIzvenDovoljenega ? " opomin-nacrt__stage--hard-opozorilo" : "") +
            '" data-stage="' +
            s.index +
            '" aria-current="' +
            (aktiven ? "step" : "false") +
            '" aria-disabled="' +
            (zaklenjenZadnji ? "true" : "false") +
            '" aria-label="' +
            esc(
              (prikazniRedMap[s.index] || s.order) +
                ". " +
                s.title +
                (zaklenjenZadnji
                  ? ", zaklenjeno do potrditve " +
                    (prikazniRedMap[blokirajociPredZadnjim.index] || blokirajociPredZadnjim.order) +
                    ". koraka"
                  : "") +
                (casIzvenDovoljenega ? ", opozorilo: ponastavite uro" : "")
            ) +
            '">' +
            '<span class="opomin-nacrt__stage-st">' +
            (s.isExcluded ? "—" : (prikazniRedMap[s.index] || s.order)) +
            "</span>" +
            '<span class="opomin-nacrt__stage-naslov' +
            (String(s.title || "").length > 20 ? " opomin-nacrt__stage-naslov--zelo-dolg" : String(s.title || "").length > 15 ? " opomin-nacrt__stage-naslov--dolg" : "") +
            '">' +
            esc(s.title) +
            "</span>" +
            '<span class="opomin-nacrt__stage-cas' +
            (Number(s._preskokDni) ? " opomin-nacrt__stage-cas--opozorilo" : "") +
            (randomJeVklopljen(s) ? " opomin-nacrt__stage-cas--randomized" : "") +
            '">' +
            oznakaCarouselCas(s, plan) +
            "</span>" +
            (casIzvenDovoljenega ? htmlOpozoriloUreKartice(plan, s) : "") +
            "</button>";
          if (jeVVeljavnemUrejanju && s.index !== 1) {
            html += '<button type="button" class="opomin-nacrt__stage-odstrani" data-odstrani-kartico="' + s.index + '" aria-label="Odstrani ' + esc(s.title) + '">×</button>';
          }
          return html + "</div>";
        })
        .join("");
      var smsOsnova = step.finalMessage || step.generatedMessage || "";
      var smsBesedilo =
        PV && PV.sestaviSmsZPrilogami
          ? PV.sestaviSmsZPrilogami(smsOsnova, prilogeKoraka, smsPaketZeton)
          : smsOsnova;
      var smsMeta = gsmLabel(Gsm, smsBesedilo);

      var vsebinaHtml = "";
      if (!jeManual) {
        var rokAktiven =
          (paymentDeadline && paymentDeadline.enabled) ||
          (step.paymentDeadline && step.paymentDeadline.enabled);
        var obrocAktiven = Boolean(
          installmentPlan && installmentPlan.enabled
        );
        var trrAktiven = Boolean(
          dodatki.trr ||
            (step.bankTransfer && step.bankTransfer.enabled)
        );

        var znesekTekst = formatEurIzCentov(plan.amountCents);
        var kategorijaTekst = kategorijaDolgaIzCentov(plan.amountCents);
        var tonOznaka = N.oznakaTona(step.toneId || plan.toneId);
        var predlogaOznaka = imePredloge(step, k2);
        var predlogaPriporocena =
          !step.templateSelectionMode ||
          step.templateSelectionMode === "automatic";

        vsebinaHtml = htmlVsebinaKoraka({
          znesekTekst: znesekTekst,
          kategorijaTekst: kategorijaTekst,
          tonOznaka: tonOznaka,
          predlogaOznaka: predlogaOznaka,
          predlogaPriporocena: predlogaPriporocena,
          rokStanje: rokAktiven ? "Vklopljeno" : "Izklopljeno",
          obrocnoStanje: obrocAktiven ? "Vklopljeno" : "Izklopljeno",
          trrStanje: trrAktiven ? "Vklopljeno" : "Izklopljeno",
          smsBesedilo: smsBesedilo,
          smsUrejanje: smsOsnova,
          smsMeta: smsMeta,
          casPosiljanjaIso: prikazniCasKoraka(step),
          randomAktiven: randomJeVklopljen(step),
          razmikPoPrejsnjem:
            Number(step.index) > 1
              ? N.oznakaPoPrejsnjem
                ? N.oznakaPoPrejsnjem(Math.max(0, razmikPrejsnji))
                : Math.max(0, razmikPrejsnji) +
                  " dni po prejšnjem koraku"
              : "",
          priloge: prilogeKoraka,
          imaTelefon: Boolean(
            opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika
          ),
          imaEmail: Boolean(
            opts.podatkiKorak1 && opts.podatkiKorak1.emailDolznika
          ),
          sporociloKanali: step.primaryContacts,
          customContacts: step.customContacts || { phoneNumbers: [], emailAddresses: [] },
          primarniTelefon: (opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika) || "",
          primarniEmail: (opts.podatkiKorak1 && opts.podatkiKorak1.emailDolznika) || "",
        });
      } else {
        var lpPovzetekHtml = htmlPredajaPovzetek(plan, step, opts.podatkiKorak1);
        var lpKajSeBoZgodiloHtml = htmlKajSeBoZgodilo(plan, step);
        var lpCustomPaketPopupHtml = htmlCustomPaketPopup(step);
        var lpOdvetnikiPopupHtml = htmlOdvetnikiIzbiraPopup(step);
        /* Paketna izbira za ročni odvetniški 10. korak. */
        var lpPriporocenId = dolociPriporoceniPaket(plan);
        var lpPotrditveniPopupHtml = htmlPotrditveniPopup(najdiPaket(lpPriporocenId) || LAWYER_ACTION_PACKAGES[0]);
        var lpPredogledPopupHtml = htmlPredogledPopup(najdiPaket(lpPriporocenId) || LAWYER_ACTION_PACKAGES[0]);
        var lpFilterPonudbPopupHtml = htmlFilterPonudbPopup();
        vsebinaHtml =
          htmlPredajaSestavljalnik(plan, step, prilogeKoraka, opts.podatkiKorak1) +
          lpCustomPaketPopupHtml +
          lpOdvetnikiPopupHtml +
          lpPotrditveniPopupHtml +
          lpPredogledPopupHtml +
          lpFilterPonudbPopupHtml;
      }

      var ctaBesedilo = ready
        ? "Pošlji prvi korak in aktiviraj načrt →"
        : "Preveri in potrdi " + prikazniRedStep + ". korak →";
      var casAktivnegaIzvenDovoljenega = jeCasKorakaIzvenDovoljenega(
        plan,
        step
      );
      var dovoljenoOknoAktivnega = dovoljenoOknoKoraka(plan, step);
      var opozoriloAktivnegaCasaHtml = casAktivnegaIzvenDovoljenega
        ? '<div class="opomin-nacrt__hard-opozorilo" role="alert">' +
          '<span class="opomin-nacrt__hard-opozorilo-ikona" aria-hidden="true">⚠</span>' +
          '<span><strong>Ura pošiljanja ni dovoljena</strong><small>Izberi uro med ' +
          esc(dovoljenoOknoAktivnega.start) +
          " in " +
          esc(dovoljenoOknoAktivnega.end) +
          ".</small></span>" +
          '<button type="button" id="opomin-ponastavi-neveljavno-uro">Ponastavi uro</button>' +
          "</div>"
        : "";

      var prejsnjiCarousel = opts.glavniEl.querySelector(".opomin-nacrt__carousel");
      if (prejsnjiCarousel) carouselScrollLeft = prejsnjiCarousel.scrollLeft;

      opts.glavniEl.innerHTML =
        '<div class="opomin-nacrt__vsebina">' +
        (jeManual
          ? '<section class="lp-enotni-widget">' + lpPovzetekHtml + lpKajSeBoZgodiloHtml + '</section>'
          : "") +
        (!imaTelefon
          ? '<p class="opomin-nacrt__opozorilo" role="status">Telefonska številka dolžnika manjka – SMS-ov ne bo mogoče poslati, dokler je ne dodaš.</p>'
          : "") +
        '<div class="opomin-nacrt__napredek-vrstica">' +
        '<div class="opomin-nacrt__napredek-levo">' +
        '<p class="opomin-nacrt__napredek-tekst">Potrjeno ' +
        potrjeno +
        " od " +
        vkljuceniKoraki.length +
        "</p>" +
        '<div class="opomin-nacrt__pike' +
        (vkljuceniKoraki.length > 6 ? " opomin-nacrt__pike--veliko" : "") +
        '" role="list" aria-label="Napredek potrjevanja">' +
        pikeHtml +
        "</div>" +
        "</div>" +
        '<button type="button" class="opomin-nacrt__uredi-korake' +
        (urejanjeKartic ? " opomin-nacrt__uredi-korake--aktivno" : "") +
        '" id="opomin-uredi-korake" aria-pressed="' +
        (urejanjeKartic ? "true" : "false") +
        '">' + (urejanjeKartic ? "Shrani" : "Uredi") +
        "</button>" +
        "</div>" +
        '<div class="opomin-nacrt__carousel-ovoj">' +
        '<div class="opomin-nacrt__carousel" role="list" aria-label="Koraki načrta">' +
        carouselHtml +
        "</div>" +
        '<span class="opomin-nacrt__carousel-puscica" aria-hidden="true">›</span>' +
        "</div>" +
        (urejanjeKartic && plan.steps.length < 10
          ? '<button type="button" class="opomin-nacrt__dodaj-korak" data-dodaj-korak>+ Dodaj korak</button>'
          : "") +
         datumNadPoljemHtml +
        opozoriloAktivnegaCasaHtml +
        priporoceniRazmikHtml +
        (jeManual
          ? ""
          : '<section class="opomin-nacrt__cas-kartica" aria-label="Čas pošiljanja tega koraka">' +
            casKarticaHtml +
            '<div class="opomin-nacrt__dnevi-teden">' +
            '<span class="opomin-nacrt__dnevi-teden-oznaka">Možni dnevi pošiljanja</span>' +
            '<span class="opomin-nacrt__dnevi-teden-vrstica">' +
            dneviVTednuHtml +
            "</span>" +
            "</div>" +
            prilagoditevDneviOpomba +
            "</section>") +
        '<div class="opomin-nacrt__izbran-glava">' +
        '<h2 class="opomin-nacrt__izbran-naslov">' +
        esc(prikazniRedStep + ". korak – " + step.title) +
        "</h2>" +
        '<span class="opomin-nacrt__status-badge opomin-nacrt__status-badge--' +
        esc(step.status) +
        '">' +
        esc(statusZnacka(step.status, step.kind)) +
        "</span>" +
        "</div>" +
        karticeHtml +
        vsebinaHtml +
        '<p class="opomin-nacrt__opozorilo-sivo">Potrditev koraka še ne pošlje sporočila.</p>' +
        '<footer class="opomin-nacrt__noga">' +
        '<button type="button" class="korak2__gumb-naprej" id="opomin-nacrt-cta">' +
        esc(ctaBesedilo) +
        "</button>" +
        '<button type="button" class="opomin-nacrt__shrani-osnutek" id="opomin-shrani-osnutek">Shrani kot osnutek</button>' +
        "</footer>" +
        "</div>";

      var noviCarousel = opts.glavniEl.querySelector(".opomin-nacrt__carousel");
      if (noviCarousel && carouselScrollLeft > 0) {
        noviCarousel.scrollLeft = carouselScrollLeft;
      }

      if (jeManual) {
        prilagodiVelikostImenaDolznika();
      }

      poveziGlavni(step, ready);
    }

    function poveziGlavni(step, ready) {
      var smsUrejanje = opts.glavniEl.querySelector("#opomin-sms-urejanje");
      if (smsUrejanje) {
        smsUrejanje.addEventListener("input", function () {
          plan = N.posodobiSporociloKoraka(
            plan,
            step.index,
            smsUrejanje.value
          );

          var celotnoSporocilo =
            PV && PV.sestaviSmsZPrilogami
              ? PV.sestaviSmsZPrilogami(
                  smsUrejanje.value,
                  prilogeKoraka,
                  smsPaketZeton
                )
              : smsUrejanje.value;
          var meta = opts.glavniEl.querySelector(".sms-preview__meta");
          if (meta) meta.textContent = gsmLabel(Gsm, celotnoSporocilo);

          var badge = opts.glavniEl.querySelector(".opomin-nacrt__status-badge");
          if (badge) {
            badge.className =
              "opomin-nacrt__status-badge opomin-nacrt__status-badge--" +
              step.status;
            badge.textContent = statusZnacka(step.status, step.kind);
          }
          var ctaVZivo = opts.glavniEl.querySelector("#opomin-nacrt-cta");
          if (ctaVZivo) {
            ctaVZivo.textContent =
              "Preveri in potrdi " + prikazniRedStep + ". korak →";
          }

          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(function () {
            N.shraniOsnutek(plan);
          }, 350);
        });
        smsUrejanje.addEventListener("blur", function () {
          clearTimeout(debounceTimer);
          debounceTimer = null;
          N.shraniOsnutek(plan);
        });
        izrisiKompaktnePredloge(
          step,
          smsUrejanje,
          null,
          "opomin-glavni-predloge",
          "opomin-glavni-predloge-drsnik"
        );
      }

      opts.glavniEl.querySelectorAll("[data-dan]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var dan = Number(btn.getAttribute("data-dan"));
          if (!Array.isArray(plan._aktivniDnevi) || plan._aktivniDnevi.length !== 7) {
            plan._aktivniDnevi = [true, true, true, true, true, true, true];
          }
          plan._aktivniDnevi[dan] = !plan._aktivniDnevi[dan];
          if (typeof N.uskladiOffseteIzDatumov === "function") {
            plan = N.uskladiOffseteIzDatumov(plan);
          }
          N.shraniOsnutek(plan);
          izrisiGlavni();
        });
      });

      opts.glavniEl
        .querySelectorAll("[data-kanal-globalno]")
        .forEach(function (gumb) {
          gumb.addEventListener("click", function () {
            var kanal = gumb.getAttribute("data-kanal-globalno");
            if (gumb.getAttribute("aria-disabled") === "true") {
              if (typeof opts.potrdiVprasanje === "function") {
                opts.potrdiVprasanje({
                  naslov:
                    kanal === "sms"
                      ? "Dolžnik nima telefonske številke."
                      : "Dolžnik nima e-poštnega naslova.",
                  potrdiBesedilo: "V redu",
                  samoEnGumb: true,
                  stil: "primary",
                });
              }
              return;
            }
            var k2 = opts.podatkiKorak2 || {};
            var imaTelefon = Boolean(
              opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika
            );
            var imaEmailGlobalno = Boolean(
              opts.podatkiKorak1 && opts.podatkiKorak1.emailDolznika
            );
            var trenutni =
              k2.sporociloKanali || { sms: imaTelefon, email: imaEmailGlobalno };
            var novi = { sms: Boolean(trenutni.sms), email: Boolean(trenutni.email) };
            novi[kanal] = !novi[kanal];
            k2.sporociloKanali = novi;
            opts.podatkiKorak2 = k2;
            syncKorak2Sejo();
            izrisiGlavni();
          });
        });

      opts.glavniEl.querySelectorAll("[data-stage]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var ciljniIndex = Number(btn.getAttribute("data-stage"));
          var blokirajociKorak = N.prviNepotrjenPredZadnjimKorakom
            ? N.prviNepotrjenPredZadnjimKorakom(plan, ciljniIndex)
            : null;
          if (blokirajociKorak) {
            if (typeof opts.potrdiVprasanje === "function") {
              opts.potrdiVprasanje({
                naslov: "Zadnji korak še ni na voljo",
                opis:
                  "Najprej izpolnite in potrdite »" +
                  String(blokirajociKorak.title || blokirajociKorak.index + ". korak") +
                  "«.",
                potrdiBesedilo: "V redu",
                samoEnGumb: true,
                stil: "primary",
              });
            }
            return;
          }
          if (!preklopiAktivniKorak(ciljniIndex)) return;
          var izbranKorak = N.najdiKorak(plan, aktivenIndex);
          if (izbranKorak) izbranKorak.isExcluded = false;
          plan.selectedStageId = (izbranKorak || {}).id;
          shrani();
          izrisiGlavni();
        });
      });

      var spremeni = opts.glavniEl.querySelector("#opomin-spremeni-cas");
      if (spremeni) {
        spremeni.addEventListener("click", function () {
          odpriCasSheet(step.index, "trenutni");
        });
      }

      var ponastaviNeveljavnoUro = opts.glavniEl.querySelector(
        "#opomin-ponastavi-neveljavno-uro"
      );
      if (ponastaviNeveljavnoUro) {
        ponastaviNeveljavnoUro.addEventListener("click", function () {
          odpriCasSheet(step.index, "trenutni");
        });
      }

      var datumPredaje = opts.glavniEl.querySelector("#opomin-datum-predaje");
      if (datumPredaje) {
        datumPredaje.addEventListener("change", function () {
          var noviDatum = datumPredaje.value;
          if (!noviDatum) return;
          var obstojeciIso = step.sendAt || step.scheduledAt;
          var iso = isoIzDateInTime(noviDatum, isoZaTimeInput(obstojeciIso));
          var v = N.validirajCasKoraka
            ? N.validirajCasKoraka(plan, step.index, iso, false)
            : { ok: true };
          if (!v.ok) {
            datumPredaje.value = isoZaDateInput(obstojeciIso);
            if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                v.napaka || "Datuma predaje ni bilo mogoče nastaviti."
              );
            }
            return;
          }
          plan = N.posodobiCasKoraka(plan, step.index, iso, {
            shiftFollowing: false,
          });
          shrani();
          izrisiGlavni();
        });
      }

      var povzetekVec = opts.glavniEl.querySelector("#opomin-povzetek-vec");
      if (povzetekVec) {
        povzetekVec.addEventListener("click", function () {
          var vsebina = opts.glavniEl.querySelector(
            "#opomin-povzetek-vec-vsebina"
          );
          if (!vsebina) return;
          var odprto = povzetekVec.getAttribute("aria-expanded") === "true";
          povzetekVec.setAttribute("aria-expanded", odprto ? "false" : "true");
          povzetekVec.classList.toggle("opomin-povzetek__vec--odprto", !odprto);
          vsebina.classList.toggle("opomin-povzetek__vec-vsebina--odprto", !odprto);
        });
      }

      var zgodovinaPoglejVse = opts.glavniEl.querySelector(
        "#opomin-zgodovina-poglej-vse"
      );
      if (zgodovinaPoglejVse) {
        zgodovinaPoglejVse.addEventListener("click", function () {
          odpriZgodovinaSheet("seznam");
        });
      }

      opts.glavniEl
        .querySelectorAll(".opomin-zgodovina__kartica")
        .forEach(function (kartica) {
          kartica.addEventListener("click", function () {
            odpriZgodovinaSheet(
              "podrobnosti",
              Number(kartica.getAttribute("data-zgodovina-korak"))
            );
          });
        });

      var zgodovinaDrsnik = opts.glavniEl.querySelector(".opomin-zgodovina__drsnik");
      var zgodovinaPike = opts.glavniEl.querySelectorAll(".opomin-zgodovina__pika");
      if (zgodovinaDrsnik && zgodovinaPike.length) {
        function posodobiPike() {
          var scrollLeft = zgodovinaDrsnik.scrollLeft;
          var kartice = zgodovinaDrsnik.querySelectorAll(".opomin-zgodovina__kartica");
          var aktivna = 0;
          kartice.forEach(function (k, i) {
            if (k.offsetLeft - scrollLeft <= k.offsetWidth / 2) {
              aktivna = i;
            }
          });
          zgodovinaPike.forEach(function (pika, i) {
            pika.classList.toggle("opomin-zgodovina__pika--aktivna", i === aktivna);
          });
        }
        zgodovinaDrsnik.addEventListener("scroll", posodobiPike, { passive: true });
        zgodovinaPike.forEach(function (pika, i) {
          pika.addEventListener("click", function () {
            var kartice = zgodovinaDrsnik.querySelectorAll(".opomin-zgodovina__kartica");
            if (kartice[i]) {
              kartice[i].scrollIntoView({ behavior: "smooth", inline: "start" });
            }
          });
        });
      }

      var opominiPoglejVse = opts.glavniEl.querySelector("#lp-opomini-poglej-vse");
      if (opominiPoglejVse) {
        opominiPoglejVse.addEventListener("click", function () {
          odpriZgodovinaSheet("seznam");
        });
      }

      opts.glavniEl
        .querySelectorAll(".lp-opomini-pregled__korak")
        .forEach(function (el) {
          el.addEventListener("click", function () {
            var korakIndex = Number(el.getAttribute("data-zgodovina-korak"));
            if (!isNaN(korakIndex)) odpriZgodovinaSheet("podrobnosti", korakIndex);
          });
        });

      /* ========== Sestavljalnik "Predaja odvetniku" (Faza 7) ========== */

      /* --- Lebdeča pill odvetnika --- */
      var predajaOdvetnikPill = opts.glavniEl.querySelector(
        "#opomin-predaja-odvetnik-pill"
      );
      if (predajaOdvetnikPill) {
        predajaOdvetnikPill.addEventListener("click", function () {
          var marketplaceTrigger = opts.glavniEl.querySelector("#lp-izberi-odvetnika");
          if (marketplaceTrigger) marketplaceTrigger.click();
          else odpriOdvetnikSheet(step);
        });
      }

      /* --- Sporočilo odvetniku: akciji se pokažeta samo med urejanjem. --- */
      /* Možni dnevi predaje: najmanj en dan mora ostati izbran. */
      opts.glavniEl.querySelectorAll("[data-predaja-dan]").forEach(function (gumb) {
        gumb.addEventListener("click", function () {
          if (typeof N.posodobiDnevePredaje !== "function") return;
          var indexDneva = Number(gumb.getAttribute("data-predaja-dan"));
          if (isNaN(indexDneva) || indexDneva < 0 || indexDneva > 6) return;
          var aktualniStep = N.najdiKorak(plan, step.index) || step;
          var noviDnevi = dneviPredajeKoraka(aktualniStep);
          if (noviDnevi[indexDneva] && noviDnevi.filter(Boolean).length === 1) return;
          noviDnevi[indexDneva] = !noviDnevi[indexDneva];
          plan = N.posodobiDnevePredaje(plan, step.index, noviDnevi);
          step = N.najdiKorak(plan, step.index) || step;
          if (
            step.lawyerHandoff &&
            step.lawyerHandoff.handoffTimingMode !== "custom" &&
            typeof N.posodobiCasPredajeOdvetniku === "function"
          ) {
            plan = N.posodobiCasPredajeOdvetniku(
              plan,
              step.index,
              "asap",
              najzgodnejsiCasPredaje(noviDnevi)
            );
            step = N.najdiKorak(plan, step.index) || step;
          }
          shrani();
          izrisiGlavni();
        });
      });

      function pokaziNapakoCasaPredaje(besedilo) {
        var napakaEl = opts.glavniEl.querySelector("#opomin-predaja-cas-napaka");
        if (!napakaEl) return;
        napakaEl.textContent = besedilo || "";
        napakaEl.hidden = !besedilo;
      }

      function shraniCasPredaje(nacin) {
        if (typeof N.posodobiCasPredajeOdvetniku !== "function") return;
        var aktualniStep = N.najdiKorak(plan, step.index) || step;
        var dnevi = dneviPredajeKoraka(aktualniStep);
        var iso;
        if (nacin === "asap") {
          iso = najzgodnejsiCasPredaje(dnevi);
        } else {
          var datumInput = opts.glavniEl.querySelector("#opomin-predaja-cas-datum");
          var uraInput = opts.glavniEl.querySelector("#opomin-predaja-cas-ura");
          if (!datumInput || !uraInput || !datumInput.value || !uraInput.value) {
            pokaziNapakoCasaPredaje("Vnesite datum in uro predaje.");
            return;
          }
          iso = isoIzDateInTime(datumInput.value, uraInput.value);
          var izbraniDatum = iso ? new Date(iso) : null;
          if (!izbraniDatum || Number.isNaN(izbraniDatum.getTime())) {
            pokaziNapakoCasaPredaje("Vnesite veljaven datum in uro.");
            return;
          }
          if (izbraniDatum.getTime() < Date.now()) {
            pokaziNapakoCasaPredaje("Izbrani čas ne sme biti v preteklosti.");
            return;
          }
          if (!dnevi[sloIndexDneva(izbraniDatum)]) {
            pokaziNapakoCasaPredaje("Izberite enega od označenih dni predaje.");
            return;
          }
        }
        pokaziNapakoCasaPredaje("");
        plan = N.posodobiCasPredajeOdvetniku(plan, step.index, nacin, iso);
        step = N.najdiKorak(plan, step.index) || step;
        shrani();
        izrisiGlavni();
      }

      opts.glavniEl.querySelectorAll("[data-predaja-cas-nacin]").forEach(function (gumb) {
        gumb.addEventListener("click", function () {
          shraniCasPredaje(gumb.getAttribute("data-predaja-cas-nacin"));
        });
      });
      ["#opomin-predaja-cas-datum", "#opomin-predaja-cas-ura"].forEach(function (selektor) {
        var input = opts.glavniEl.querySelector(selektor);
        if (input) input.addEventListener("change", function () {
          shraniCasPredaje("custom");
        });
      });

      var predajaSporociloTextarea = opts.glavniEl.querySelector(
        "#opomin-predaja-sporocilo-textarea"
      );
      function flushPredajaSporocilo() {
        if (!predajaSporociloTextarea) return;
        var trenutnaLh = (step && step.lawyerHandoff) || {};
        if (predajaSporociloTextarea.value === String(trenutnaLh.message || "")) return;
        plan = N.posodobiSporociloOdvetniku(
          plan,
          step.index,
          predajaSporociloTextarea.value,
          true
        );
        step = N.najdiKorak(plan, step.index) || step;
      }
      /** Polje raste z besedilom, da je sporočilo vidno v celoti brez drsenja
          znotraj okvirja (CSS ima zato overflow-y: hidden in nima max-height).
          min-height iz CSS ostane spodnja meja, zato ga ne prevozimo. */
      function prilagodiVisinoPredajeSporocila() {
        if (!predajaSporociloTextarea) return;
        predajaSporociloTextarea.style.height = "auto";
        var visina = predajaSporociloTextarea.scrollHeight;
        /* scrollHeight je 0, kadar element ni v postavitvi – takrat višine ne
           zapišemo, sicer bi se polje sesedlo. */
        if (!visina) {
          predajaSporociloTextarea.style.removeProperty("height");
          return;
        }
        predajaSporociloTextarea.style.height = visina + "px";
      }

      if (predajaSporociloTextarea) {
        /* Prva meritev je pogosto prekratka, ker pisava ob izrisu še ni
           naložena in se scrollHeight izračuna z metrikami nadomestne pisave. */
        prilagodiVisinoPredajeSporocila();
        if (typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(prilagodiVisinoPredajeSporocila);
        }
        if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
          document.fonts.ready.then(prilagodiVisinoPredajeSporocila).catch(function () {});
        }
        var predajaSporociloAkcije = opts.glavniEl.querySelector("#opomin-predaja-sporocilo-akcije");
        var predajaSporociloVrni = opts.glavniEl.querySelector("#opomin-predaja-sporocilo-vrni");
        var predajaSporociloShrani = opts.glavniEl.querySelector("#opomin-predaja-sporocilo-shrani");
        var predajaSporociloPrejsnjaVrednost = predajaSporociloTextarea.value;
        var predajaSporociloSeUreja = false;

        function pokaziPredajaSporociloAkcije() {
          if (!predajaSporociloSeUreja) {
            predajaSporociloPrejsnjaVrednost = predajaSporociloTextarea.value;
            predajaSporociloSeUreja = true;
          }
          if (predajaSporociloAkcije) predajaSporociloAkcije.hidden = false;
        }

        function skrijPredajaSporociloAkcije() {
          predajaSporociloSeUreja = false;
          if (predajaSporociloAkcije) predajaSporociloAkcije.hidden = true;
        }

        predajaSporociloTextarea.addEventListener("focus", pokaziPredajaSporociloAkcije);
        predajaSporociloTextarea.addEventListener("click", pokaziPredajaSporociloAkcije);
        predajaSporociloTextarea.addEventListener("input", function () {
          pokaziPredajaSporociloAkcije();
          prilagodiVisinoPredajeSporocila();
        });

        if (predajaSporociloVrni) predajaSporociloVrni.addEventListener("click", function () {
          predajaSporociloTextarea.value = predajaSporociloPrejsnjaVrednost;
          prilagodiVisinoPredajeSporocila();
          skrijPredajaSporociloAkcije();
          predajaSporociloTextarea.blur();
        });

        if (predajaSporociloShrani) predajaSporociloShrani.addEventListener("click", function () {
          flushPredajaSporocilo();
          shrani();
          predajaSporociloPrejsnjaVrednost = predajaSporociloTextarea.value;
          skrijPredajaSporociloAkcije();
          predajaSporociloTextarea.blur();
        });
      }

      /* --- Dokumenti: mreža 2×2 + nalaganje/odstranjevanje --- */
      function najdiPredajaDokumentPloscico(tip) {
        return opts.glavniEl.querySelector(
          '[data-dokument-ploscica="' + tip + '"]'
        );
      }
      function nastaviNalaganjePredajaPloscice(tip, nalaga) {
        var el = najdiPredajaDokumentPloscico(tip);
        if (!el) return;
        if (nalaga) {
          if (el._predajaPrejsnjaVsebina === undefined) {
            el._predajaPrejsnjaVsebina = el.innerHTML;
          }
          el.classList.add("opomin-predaja-sestavljalnik__ploscica--nalaganje");
          el.setAttribute("aria-busy", "true");
          if (el.tagName === "BUTTON") el.disabled = true;
          var obstojeciStatus = el.querySelector(
            ".opomin-predaja-sestavljalnik__ploscica-status, .opomin-predaja-sestavljalnik__ploscica-plus"
          );
          var spinner = document.createElement("span");
          spinner.className = "opomin-predaja-sestavljalnik__ploscica-spinner";
          spinner.setAttribute("role", "status");
          spinner.setAttribute("aria-live", "polite");
          spinner.setAttribute("aria-label", "Nalaganje");
          if (obstojeciStatus && obstojeciStatus.replaceWith) {
            obstojeciStatus.replaceWith(spinner);
          } else if (obstojeciStatus) {
            obstojeciStatus.parentNode.replaceChild(spinner, obstojeciStatus);
          } else {
            el.appendChild(spinner);
          }
        } else {
          el.classList.remove("opomin-predaja-sestavljalnik__ploscica--nalaganje");
          el.removeAttribute("aria-busy");
          if (el.tagName === "BUTTON") el.disabled = false;
          if (el._predajaPrejsnjaVsebina !== undefined) {
            el.innerHTML = el._predajaPrejsnjaVsebina;
            delete el._predajaPrejsnjaVsebina;
          }
        }
      }
      var predajaDokumentNapakaEl = opts.glavniEl.querySelector(
        "#opomin-predaja-dokument-napaka"
      );
      function pokaziPredajaDokumentNapako(besedilo) {
        if (!predajaDokumentNapakaEl) return;
        predajaDokumentNapakaEl.textContent = besedilo;
        predajaDokumentNapakaEl.hidden = false;
      }
      function skrijPredajaDokumentNapako() {
        if (!predajaDokumentNapakaEl) return;
        predajaDokumentNapakaEl.hidden = true;
        predajaDokumentNapakaEl.textContent = "";
      }

      var dokumentDatoteka = opts.glavniEl.querySelector(
        "#opomin-dokument-datoteka"
      );

      opts.glavniEl.querySelectorAll("[data-dokument-odpri-tip]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          odpriPredajaKategorijaDokumentiSheet(
            step,
            btn.getAttribute("data-dokument-odpri-tip")
          );
        });
      });

      opts.glavniEl.querySelectorAll("[data-dokument-dodaj]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!dokumentDatoteka) return;
          dokumentDatoteka.setAttribute(
            "data-dokument-tip",
            btn.getAttribute("data-dokument-dodaj")
          );
          dokumentDatoteka.removeAttribute("data-dokument-group-id");
          dokumentDatoteka.removeAttribute("capture");
          dokumentDatoteka.setAttribute("accept", "image/*,.pdf");
          dokumentDatoteka.click();
        });
      });

      var predajaNalaganjeBatch = false;
      if (dokumentDatoteka) {
        dokumentDatoteka.addEventListener("change", async function () {
          if (predajaNalaganjeBatch) return;
          var tip = dokumentDatoteka.getAttribute("data-dokument-tip") || "other";
          var groupId = dokumentDatoteka.getAttribute("data-dokument-group-id") ||
            ("predaja-" + tip + "-" + Date.now().toString(36));
          var zahteva = zahtevaDokumentaPredaja(step, tip);
          var datoteke = Array.from(dokumentDatoteka.files || []);
          dokumentDatoteka.value = "";
          dokumentDatoteka.removeAttribute("capture");
          dokumentDatoteka.setAttribute("accept", "image/*,.pdf");
          if (!datoteke.length) return;

          skrijPredajaDokumentNapako();
          var lh = (step && step.lawyerHandoff) || {};
          var obstojeciVsi = (lh.documents || []).map(function (d) {
            return { sizeBytes: d.sizeBytes != null ? d.sizeBytes : 0 };
          });
          var obstojeciVKategoriji = N.dokumentiPredajePoTipu(
            plan,
            step.index,
            tip,
            opts.podatkiKorak1,
            prilogeKoraka
          );

          function jeDvojnik(f) {
            return obstojeciVKategoriji.some(function (e) {
              return (
                e.name === f.name &&
                Number(e.sizeBytes) === f.size &&
                e.mimeType === f.type
              );
            });
          }

          predajaNalaganjeBatch = true;
          nastaviNalaganjePredajaPloscice(tip, true);
          var neuspehi = [];
          var sprejete = [];

          try {
            for (var i = 0; i < datoteke.length; i++) {
              var file = datoteke[i];
              pokaziPredajaDokumentNapako(
                "Nalaganje " + (i + 1) + " od " + datoteke.length + " …"
              );

              var v =
                PV && typeof PV.validirajDatoteko === "function"
                  ? PV.validirajDatoteko(
                      file,
                      obstojeciVsi.concat(
                        sprejete.map(function (s) {
                          return { sizeBytes: s.sizeBytes };
                        })
                      )
                    )
                  : { ok: true };
              if (v.napaka) {
                neuspehi.push(file.name + " – " + v.napaka);
                continue;
              }
              if (jeDvojnik(file)) {
                neuspehi.push(file.name + " – datoteka je že dodana");
                continue;
              }
              if (typeof opts.naloziPrilogo !== "function") continue;

              var rez;
              try {
                rez = await opts.naloziPrilogo(file);
              } catch (napaka) {
                neuspehi.push(file.name + " – ni bilo mogoče naložiti");
                continue;
              }
              if (rez && rez.napaka) {
                neuspehi.push(file.name + " – " + rez.napaka);
                continue;
              }
              if (tip === "invoice") {
                dodajNalozenRacunVPrilogeKoraka(file, rez, zahteva, groupId);
                if (N.oznaciZunanjePrilogePredajeSpremenjene) {
                  plan = N.oznaciZunanjePrilogePredajeSpremenjene(plan, step.index);
                }
              } else {
                plan = N.dodajDokumentOdvetniku(plan, step.index, {
                  type: tip,
                  source: "uploaded",
                  groupId: groupId,
                  storagePath: rez && rez.pot ? rez.pot : null,
                  name: file.name || "",
                  mimeType: file.type || "",
                  sizeBytes: file.size != null ? file.size : null,
                  status: "ready",
                  recommendation: zahteva.recommendation,
                  descriptionQuestion: zahteva.question,
                  description: "",
                  descriptionRequired: zahteva.required,
                });
              }
              sprejete.push({ sizeBytes: file.size });
            }
            step = N.najdiKorak(plan, step.index) || step;
            shrani();
            izrisiGlavni();
            osveziPredajaVsiDokumentiSheetCeOdprt(step);
            osveziPredajaKategorijaDokumentiSheetCeOdprt(step);

            var odprtModal = document.getElementById("opomin-predaja-datoteka-modal");
            var dodanaSkupina = N.dokumentiPredajePoTipu(
              plan,
              step.index,
              tip,
              opts.podatkiKorak1,
              prilogeKoraka
            ).filter(function (d) { return d.groupId === groupId; });
            if (dodanaSkupina.length && odprtModal && !odprtModal.hidden && odprtModal._groupId === groupId) {
              odpriPredajaDatotekaModal(step, tip, dodanaSkupina[0], odprtModal._parentSheet);
            } else if (dodanaSkupina.length && (!odprtModal || odprtModal.hidden)) {
              var kategorijaSheet = document.getElementById("opomin-predaja-kategorija-dokumenti-sheet");
              if (kategorijaSheet && !kategorijaSheet.hidden) {
                odpriPredajaDatotekaModal(step, tip, dodanaSkupina[0], kategorijaSheet);
              }
            }

            if (neuspehi.length) {
              pokaziPredajaDokumentNapako(neuspehi.join(" · "));
            } else {
              skrijPredajaDokumentNapako();
            }
          } finally {
            nastaviNalaganjePredajaPloscice(tip, false);
            predajaNalaganjeBatch = false;
          }
        });
      }

      var predajaVsiDokumentiGumb = opts.glavniEl.querySelector(
        "#opomin-predaja-vsi-dokumenti"
      );
      if (predajaVsiDokumentiGumb) {
        predajaVsiDokumentiGumb.addEventListener("click", function () {
          odpriPredajaVsiDokumentiSheet(step);
        });
      }

      /* --- "Nadaljuj na pregled": validacija + priprava nespremenljivega
         snapshota (ista kanonična funkcija kot prejšnji gumb "Pripravi
         predajo") + takojšnje odprtje končnega pregleda. Če je predaja že
         pripravljena/predana, samo odpre obstoječi pregled brez nove verzije. */
      var randomCas = opts.glavniEl.querySelector("#opomin-random-cas");
      if (randomCas) {
        randomCas.addEventListener("click", function () {
          if (Number(step.index) === 1) {
            if (typeof opts.potrdiVprasanje === "function") {
              opts.potrdiVprasanje({
                naslov: "Naključni čas je na voljo od 2. koraka naprej",
                opis: "Prvi opomin se pošlje ob izbranem času. Pri naslednjih korakih lahko sistem čas pošiljanja nekoliko spremeni, da sporočila niso poslana vedno ob isti uri in minuti.",
                potrdiBesedilo: "Razumem",
                samoEnGumb: true,
                stil: "primary",
              });
            }
            return;
          }
          odpriRandomSheet(step);
        });
      }

      var randomPonovi = opts.glavniEl.querySelector(
        "#opomin-random-ponovi-zgoraj"
      );
      if (randomPonovi) {
        randomPonovi.addEventListener("click", function () {
          var trenutniKorak = N.najdiKorak(plan, step.index);
          var randomNastavitve =
            trenutniKorak && trenutniKorak._randomSchedule;
          if (
            !trenutniKorak ||
            !randomNastavitve ||
            !randomNastavitve.enabled ||
            randomNastavitve.resolvedScheduledAt ||
            trenutniKorak.status === "confirmed" ||
            trenutniKorak.status === "sent" ||
            trenutniKorak.status === "processing"
          ) {
            return;
          }

          var prejsnjiPredogled = randomNastavitve._previewResolvedAt || null;
          var noviPredogled = null;
          var poskusi = 0;
          do {
            noviPredogled = ustvariRandomPredogled(
              trenutniKorak,
              randomNastavitve
            );
            poskusi++;
          } while (
            noviPredogled &&
            noviPredogled === prejsnjiPredogled &&
            poskusi < 8
          );

          if (!noviPredogled) {
            if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                "V nastavljenem razponu ni drugega dovoljenega časa."
              );
            }
            return;
          }
          N.shraniOsnutek(plan);
          izrisiGlavni();
        });
      }

      var hitraUraNapakaEl = opts.glavniEl.querySelector(
        "#opomin-hitra-ura-napaka"
      );
      function prikaziHitroNapakoUre(message) {
        if (!hitraUraNapakaEl) return;
        hitraUraNapakaEl.textContent = message || "";
        hitraUraNapakaEl.hidden = !message;
      }

      var enakoCas = opts.glavniEl.querySelector("#opomin-enako-cas");
      if (enakoCas) {
        enakoCas.addEventListener("click", function () {
          uporabiPriporoceniRazmikTegaKoraka(step);
        });
      }

      var zdajCas = opts.glavniEl.querySelector("#opomin-zdaj-cas");
      if (zdajCas) {
        zdajCas.addEventListener("click", function () {
          var prejsnjiZaUro = najdiPrejsnjiAktivniKorak(plan, step.index);
          var izvorniIso = prikazniCasKoraka(prejsnjiZaUro);
          var zdaj = izvorniIso ? new Date(izvorniIso) : new Date();
          var datumKoraka = Number(step.index) === 1
            ? new Date(zdaj.getTime())
            : new Date(step.sendAt || step.scheduledAt);
          datumKoraka.setHours(zdaj.getHours(), zdaj.getMinutes(), zdaj.getSeconds(), 0);
          var iso = datumKoraka.toISOString();
          var v = N.validirajCasKoraka
            ? N.validirajCasKoraka(plan, step.index, iso, true)
            : { ok: true };
          if (!v.ok) {
            prikaziHitroNapakoUre(
              v.napaka || "Časa ni bilo mogoče nastaviti."
            );
            return;
          }
          plan = N.posodobiCasKoraka(plan, step.index, iso, {
            shiftFollowing: true,
          });
          izbranCasNacin = "zdaj";
          shrani();
          izrisiGlavni();
        });
      }

      var hitraUraInput = opts.glavniEl.querySelector(
        "#opomin-hitra-ura-input"
      );
      if (hitraUraInput) {
        if (
          jeUraZnotrajDovoljenegaOkna(
            hitraUraInput.value,
            dovoljenoOknoKoraka(plan, step)
          )
        ) {
          hitraUraInput.dataset.ujZadnjaDovoljenaUra =
            hitraUraInput.value;
        }
        function oznaciRocnoUroTakoj() {
          izbranCasNacin = "rocno";
          var ovoj = hitraUraInput.closest(
            ".opomin-nacrt__izbira-ure--drugi"
          );
          if (!ovoj) return;
          ovoj
            .querySelectorAll(".opomin-nacrt__izbira-ure-gumb--aktiven")
            .forEach(function (gumb) {
              gumb.classList.remove(
                "opomin-nacrt__izbira-ure-gumb--aktiven"
              );
            });
          var rocniGumb = hitraUraInput.closest(
            ".opomin-nacrt__izbira-ure-gumb"
          );
          if (rocniGumb) {
            rocniGumb.classList.add(
              "opomin-nacrt__izbira-ure-gumb--aktiven"
            );
          }
        }

        hitraUraInput.addEventListener(
          "pointerdown",
          oznaciRocnoUroTakoj,
          { passive: true }
        );
        hitraUraInput.addEventListener("focus", oznaciRocnoUroTakoj);
        hitraUraInput.addEventListener("input", function () {
          zavrniNedovoljenoPoljeUre(
            hitraUraInput,
            dovoljenoOknoKoraka(plan, step),
            function (sporocilo) {
              prikaziHitroNapakoUre(sporocilo);
            }
          );
        });

        hitraUraInput.addEventListener("change", function () {
          if (
            !zavrniNedovoljenoPoljeUre(
              hitraUraInput,
              dovoljenoOknoKoraka(plan, step),
              function (sporocilo) {
                prikaziHitroNapakoUre(sporocilo);
              }
            )
          ) return;
          prikaziHitroNapakoUre("");
          var novaUra = hitraUraInput.value;
          if (!novaUra) return;
          var obstojeciIso = step.sendAt || step.scheduledAt;
          var iso = isoIzDateInTime(isoZaDateInput(obstojeciIso), novaUra);
          var v = N.validirajCasKoraka
            ? N.validirajCasKoraka(plan, step.index, iso, true)
            : { ok: true };
          if (!v.ok) {
            hitraUraInput.value = isoZaTimeInput(obstojeciIso);
            prikaziHitroNapakoUre(
              v.napaka || "Ure ni bilo mogoče nastaviti."
            );
            return;
          }
          plan = N.posodobiCasKoraka(plan, step.index, iso, {
            shiftFollowing: true,
          });
          var rocnoPosodobljenPrvi = N.najdiKorak(plan, step.index);
          if (rocnoPosodobljenPrvi) {
            rocnoPosodobljenPrvi._uraRocnoNastavljena = true;
          }
          izbranCasNacin = "rocno";
          shrani();
          izrisiGlavni();
        });

        function osveziSamodejnoUroPrvegaKoraka() {
          var prviKorak = N.najdiKorak(plan, 1);
          if (
            !prviKorak ||
            prviKorak._uraRocnoNastavljena ||
            Number(aktivenIndex) !== 1
          ) {
            if (hitraUraTimer) clearInterval(hitraUraTimer);
            hitraUraTimer = null;
            return;
          }

          var zdaj = new Date();
          var minuta =
            zdaj.getFullYear() +
            "-" +
            (zdaj.getMonth() + 1) +
            "-" +
            zdaj.getDate() +
            "-" +
            zdaj.getHours() +
            "-" +
            zdaj.getMinutes();
          if (minuta === hitraUraSamodejnaMinuta) return;

          var iso = zdaj.toISOString();
          var v = N.validirajCasKoraka
            ? N.validirajCasKoraka(plan, 1, iso, true)
            : { ok: true };
          if (!v.ok) return;

          plan = N.posodobiCasKoraka(plan, 1, iso, {
            shiftFollowing: true,
          });
          prviKorak = N.najdiKorak(plan, 1);
          if (prviKorak) prviKorak._uraRocnoNastavljena = false;
          hitraUraSamodejnaMinuta = minuta;
          izbranCasNacin = "zdaj";
          shrani();

          var polje = opts.glavniEl.querySelector("#opomin-hitra-ura-input");
          var vrednost = opts.glavniEl.querySelector(
            "#opomin-ziva-ura-prikaz"
          );
          if (polje) polje.value = isoZaTimeInput(iso);
          if (vrednost) vrednost.textContent = formatCasKratko(iso);
        }

        if (Number(step.index) === 1) {
          osveziSamodejnoUroPrvegaKoraka();
          var prviKorakZaTimer = N.najdiKorak(plan, 1);
          if (prviKorakZaTimer && !prviKorakZaTimer._uraRocnoNastavljena) {
            hitraUraTimer = setInterval(
              osveziSamodejnoUroPrvegaKoraka,
              10000
            );
          }
        } else {
          var prikazPrejsnjeUre = opts.glavniEl.querySelector(
            "#opomin-ziva-ura-prikaz"
          );
          var prejsnjiZaPrikaz = najdiPrejsnjiAktivniKorak(plan, step.index);
          var prejsnjiCasZaPrikaz = prikazniCasKoraka(prejsnjiZaPrikaz);
          if (prikazPrejsnjeUre && prejsnjiCasZaPrikaz) {
            prikazPrejsnjeUre.textContent = formatCasKratko(prejsnjiCasZaPrikaz);
          }
        }
      }

      var uporabiZivoUro = opts.glavniEl.querySelector(
        "#opomin-uporabi-zivo-uro"
      );
      if (uporabiZivoUro) {
        uporabiZivoUro.addEventListener("click", function () {
          var prejsnjiZaUro = najdiPrejsnjiAktivniKorak(plan, step.index);
          var izvorniIso = Number(step.index) === 1
            ? null
            : prikazniCasKoraka(prejsnjiZaUro);
          var zdaj = izvorniIso ? new Date(izvorniIso) : new Date();
          var datumKoraka = Number(step.index) === 1
            ? new Date(zdaj.getTime())
            : new Date(step.sendAt || step.scheduledAt);
          datumKoraka.setHours(
            zdaj.getHours(),
            zdaj.getMinutes(),
            zdaj.getSeconds(),
            0
          );
          var iso = datumKoraka.toISOString();
          var v = N.validirajCasKoraka
            ? N.validirajCasKoraka(plan, step.index, iso, true)
            : { ok: true };
          if (!v.ok) {
            if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                v.napaka || "Časa ni bilo mogoče nastaviti."
              );
            }
            return;
          }
          plan = N.posodobiCasKoraka(plan, step.index, iso, {
            shiftFollowing: true,
          });
          var posodobljenKorak = N.najdiKorak(plan, step.index);
          if (posodobljenKorak) posodobljenKorak._uraRocnoNastavljena = false;
          izbranCasNacin = "zdaj";
          shrani();
          izrisiGlavni();
        });
      }

      var hitriDneviInput = opts.glavniEl.querySelector("#opomin-hitri-dnevi");
      var hitriDneviMinus = opts.glavniEl.querySelector(
        "#opomin-hitri-dnevi-minus"
      );
      var hitriDneviPlus = opts.glavniEl.querySelector(
        "#opomin-hitri-dnevi-plus"
      );
      var hitriDatumInput = opts.glavniEl.querySelector("#opomin-hitri-datum");
      var hitriEnotaGumbi = opts.glavniEl.querySelectorAll(
        "[data-hitri-enota]"
      );

      /* Prejšnji (ne-izključen) korak pred trenutnim – uporablja se za
         izračun "Čez koliko dni od prejšnjega koraka". Izračunano lokalno,
         ker izrisiGlavni() svojo različico te spremenljivke izgubi, ko se
         funkcija konča (drug obseg). */
      var prejsnjiKorakZaOdmik = null;
      if (Number(step.index) > 1) {
        var korakiZaOdmik = plan.steps || [];
        var pozicijaKorakaZaOdmik = korakiZaOdmik.findIndex(function (korak) {
          return Number(korak.index) === Number(step.index);
        });
        for (var oi = pozicijaKorakaZaOdmik - 1; oi >= 0; oi--) {
          if (!korakiZaOdmik[oi].isExcluded) {
            prejsnjiKorakZaOdmik = korakiZaOdmik[oi];
            break;
          }
        }
      }

      function uporabiHitriOdmik(vrednostVEnoti) {
        if (!hitriDneviInput) return;
        /* Sprememba dneva in izbira ure sta neodvisni. Zapomnimo si trenutno
           izbiro ure, da +/− ali ročni vnos dni ne ugasne gumba zanjo. */
        var ohranjeniNacinUre = izbranCasNacin;
        var uraJeBilaRocnoNastavljena = Boolean(step._uraRocnoNastavljena);
        var prikazanaVrednost = Math.max(
          0,
          Math.round(Number(vrednostVEnoti) || 0)
        );
        var praviDnevi = Math.min(
          365,
          pretvoriEnotoVDneve(prikazanaVrednost, casSheetEnota)
        );
        var obstojeciIso = step.sendAt || step.scheduledAt;
        var iso = prejsnjiKorakZaOdmik
          ? isoIzDniOdOsnove(
              praviDnevi,
              prejsnjiKorakZaOdmik.sendAt ||
                prejsnjiKorakZaOdmik.scheduledAt,
              obstojeciIso
            )
          : isoIzDniOdDanes(praviDnevi, obstojeciIso);
        var v = N.validirajCasKoraka
          ? N.validirajCasKoraka(plan, step.index, iso, true)
          : { ok: true };
        if (!v.ok) {
          hitriDneviInput.value = String(
            pretvoriDneveVEnoto(
              prejsnjiKorakZaOdmik
                ? razmikOdPrejsnjega(plan, step)
                : dneviOdDanes(obstojeciIso),
              casSheetEnota
            )
          );
          if (typeof opts.pokaziNapako === "function") {
            opts.pokaziNapako(
              v.napaka || "Števila dni ni bilo mogoče nastaviti."
            );
          }
          return;
        }
        plan = N.posodobiCasKoraka(plan, step.index, iso, {
          shiftFollowing: true,
        });
        var posodobljenKorak = N.najdiKorak(plan, step.index);
        if (posodobljenKorak) {
          posodobljenKorak._uraRocnoNastavljena =
            uraJeBilaRocnoNastavljena || ohranjeniNacinUre === "rocno";
        }
        izbranCasNacin = ohranjeniNacinUre;
        shrani();
        izrisiGlavni();
      }

      if (hitriDneviMinus) {
        hitriDneviMinus.addEventListener("click", function () {
          uporabiHitriOdmik(
            Math.max(0, (Number(hitriDneviInput.value) || 0) - 1)
          );
        });
      }
      if (hitriDneviPlus) {
        hitriDneviPlus.addEventListener("click", function () {
          uporabiHitriOdmik((Number(hitriDneviInput.value) || 0) + 1);
        });
      }
      if (hitriDneviInput) {
        hitriDneviInput.addEventListener("change", function () {
          uporabiHitriOdmik(hitriDneviInput.value);
        });
      }
      hitriEnotaGumbi.forEach(function (gumb) {
        gumb.addEventListener("click", function () {
          casSheetEnota = gumb.getAttribute("data-hitri-enota") || "dan";
          izrisiGlavni();
        });
      });

      if (hitriDatumInput) {
        hitriDatumInput.addEventListener("change", function () {
          var novDatum = hitriDatumInput.value;
          if (!novDatum) return;
          var obstojeciIso = step.sendAt || step.scheduledAt;
          var iso = isoIzDateInTime(novDatum, isoZaTimeInput(obstojeciIso));
          var v = N.validirajCasKoraka
            ? N.validirajCasKoraka(plan, step.index, iso, true)
            : { ok: true };
          if (!v.ok) {
            hitriDatumInput.value = isoZaDateInput(obstojeciIso);
            if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                v.napaka || "Datuma ni bilo mogoče nastaviti."
              );
            }
            return;
          }
          plan = N.posodobiCasKoraka(plan, step.index, iso, {
            shiftFollowing: true,
          });
          var posodobljenKorak = N.najdiKorak(plan, step.index);
          if (posodobljenKorak) posodobljenKorak._uraRocnoNastavljena = true;
          izbranCasNacin = "datum";
          shrani();
          izrisiGlavni();
        });
      }

      var predizborGumb = opts.glavniEl.querySelector("#opomin-predizbor-cas");
      var predizborMeni = opts.glavniEl.querySelector("#opomin-predizbor-meni");

      function uporabiPredizborBliznjico(b) {
        var iso = isoIzPredizboraBliznjice(b);
        var v = N.validirajCasKoraka
          ? N.validirajCasKoraka(plan, step.index, iso, true)
          : { ok: true };
        if (!v.ok) {
          if (typeof opts.pokaziNapako === "function") {
            opts.pokaziNapako(v.napaka || "Časa ni bilo mogoče nastaviti.");
          }
          return;
        }
        plan = N.posodobiCasKoraka(plan, step.index, iso, {
          shiftFollowing: true,
        });
        var predizbranKorak = N.najdiKorak(plan, step.index);
        if (predizbranKorak && Number(step.index) === 1) {
          predizbranKorak._uraRocnoNastavljena = true;
        }
        izbranCasNacin = "predizbor";
        shrani();
        izrisiGlavni();
      }

      function zapriPredizborMeni() {
        if (predizborMeni) predizborMeni.hidden = true;
        if (predizborGumb) predizborGumb.setAttribute("aria-expanded", "false");
      }

      if (predizborGumb && predizborMeni) {
        predizborGumb.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var odprto = !predizborMeni.hidden;
          if (odprto) {
            zapriPredizborMeni();
            return;
          }
          var seznam = preberiCasBliznjice();
          predizborMeni.innerHTML = "";
          var zapriGumb = document.createElement("button");
          zapriGumb.type = "button";
          zapriGumb.className = "opomin-nacrt__predizbor-zapri";
          zapriGumb.setAttribute("aria-label", "Zapri");
          zapriGumb.innerHTML = '<span aria-hidden="true">×</span>';
          zapriGumb.addEventListener("click", function (ev) {
            ev.stopPropagation();
            zapriPredizborMeni();
          });
          predizborMeni.appendChild(zapriGumb);
          if (izbranCasNacin === "predizbor") {
            var izklopiPredizborGumb = document.createElement("button");
            izklopiPredizborGumb.type = "button";
            izklopiPredizborGumb.className =
              "opomin-nacrt__predizbor-izklopi";
            izklopiPredizborGumb.setAttribute(
              "aria-label",
              "Izklopi predizbor"
            );
            izklopiPredizborGumb.innerHTML =
              '<span aria-hidden="true">×</span> Izklopi';
            izklopiPredizborGumb.addEventListener("click", function (ev) {
              ev.stopPropagation();
              var trenutniKorak = N.najdiKorak(plan, step.index);
              if (trenutniKorak) trenutniKorak._uraRocnoNastavljena = true;
              izbranCasNacin = "rocno";
              zapriPredizborMeni();
              shrani();
              izrisiGlavni();
            });
            predizborMeni.appendChild(izklopiPredizborGumb);
          }
          var naslovMeni = document.createElement("p");
          naslovMeni.className = "opomin-nacrt__predizbor-naslov";
          naslovMeni.textContent = "Bližnjice";
          predizborMeni.appendChild(naslovMeni);
          if (!seznam.length) {
            var prazno = document.createElement("p");
            prazno.className = "opomin-nacrt__predizbor-prazno";
            prazno.textContent =
              "Ni shranjenih bližnjic. Dodaš jih v »Spremeni«.";
            predizborMeni.appendChild(prazno);
          } else {
            seznam.forEach(function (b) {
              var postavka = document.createElement("button");
              postavka.type = "button";
              postavka.className = "opomin-nacrt__predizbor-postavka";
              postavka.textContent =
                (b.ura || "") +
                " · " +
                (Number(b.dnevi) === 0
                  ? "danes"
                  : "čez " +
                    b.dnevi +
                    (Number(b.dnevi) === 1 ? " dan" : " dni"));
              postavka.addEventListener("click", function () {
                zapriPredizborMeni();
                uporabiPredizborBliznjico(b);
              });
              predizborMeni.appendChild(postavka);
            });
          }
          predizborMeni.hidden = false;
          predizborGumb.setAttribute("aria-expanded", "true");
        });

        document.addEventListener("click", function (ev) {
          if (
            !predizborMeni.hidden &&
            !predizborMeni.contains(ev.target) &&
            ev.target !== predizborGumb
          ) {
            zapriPredizborMeni();
          }
        });
      }

      var istiDan = opts.glavniEl.querySelector("#opomin-isti-dan");
      if (istiDan) {
        istiDan.addEventListener("click", function () {
          var naslednjiKorak = N.najdiKorak(plan, Number(step.index) + 1);
          if (!naslednjiKorak) return;
          var datumKoraka = new Date(step.sendAt || step.scheduledAt);
          var uraNaslednjega = new Date(naslednjiKorak.sendAt || naslednjiKorak.scheduledAt);
          datumKoraka.setHours(uraNaslednjega.getHours(), uraNaslednjega.getMinutes(), uraNaslednjega.getSeconds(), 0);
          if (datumKoraka.getTime() <= new Date(step.sendAt || step.scheduledAt).getTime()) {
            datumKoraka.setMinutes(datumKoraka.getMinutes() + 1);
          }
          var iso = datumKoraka.toISOString();
          var v = N.validirajCasKoraka
            ? N.validirajCasKoraka(plan, naslednjiKorak.index, iso, true)
            : { ok: true };
          if (!v.ok) {
            if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(v.napaka || "Časa ni bilo mogoče nastaviti.");
            }
            return;
          }
          plan = N.posodobiCasKoraka(plan, naslednjiKorak.index, iso, {
            shiftFollowing: true,
          });
          shrani();
          izrisiGlavni();
        });
      }

      var spremeniRazmik = opts.glavniEl.querySelector("#opomin-spremeni-razmik");
      if (spremeniRazmik) {
        spremeniRazmik.addEventListener("click", function () {
          odpriCasSheet(step.index, "naslednji");
        });
      }

      var spremeniPrejsnjiRazmik = opts.glavniEl.querySelector(
        "#opomin-spremeni-prejsnji-razmik"
      );
      var prejsnjiKorakZaRazmik = N.najdiKorak(plan, step.index - 1);
      if (spremeniPrejsnjiRazmik && prejsnjiKorakZaRazmik) {
        spremeniPrejsnjiRazmik.addEventListener("click", function () {
          odpriCasSheet(prejsnjiKorakZaRazmik.index, "naslednji");
        });
      }

      opts.glavniEl.querySelectorAll("[data-vsebina]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var akcija = btn.getAttribute("data-vsebina");
          if (akcija === "rok") {
            if (rokSheetApi && typeof rokSheetApi.odpri === "function") {
              rokSheetApi.odpri({
                toneId: (step && step.toneId) || plan.toneId,
                onClose: function () {
                  shraniVse();
                  izrisiGlavni();
                },
              });
            } else if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                "Nastavitve roka plačila se niso naložile. Osvežite stran (Ctrl+F5)."
              );
            }
            return;
          }
          if (akcija === "obrocno") {
            if (obrocnoSheetApi && typeof obrocnoSheetApi.odpri === "function") {
              obrocnoSheetApi.odpri({
                toneId: (step && step.toneId) || plan.toneId,
                onClose: function () {
                  shraniVse();
                  izrisiGlavni();
                },
              });
            } else if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                "Nastavitve obročnega plačila se niso naložile. Osvežite stran (Ctrl+F5)."
              );
            }
            return;
          }
          if (akcija === "trr") {
            if (trrSheetApi && typeof trrSheetApi.odpri === "function") {
              trrSheetApi.odpri({
                onClose: function () {
                  shraniVse();
                  izrisiGlavni();
                },
              });
            } else if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                "Nastavitve TRR se niso naložile. Osvežite stran (Ctrl+F5)."
              );
            }
            return;
          }
          if (typeof opts.potrdiVprasanje === "function") {
            opts.potrdiVprasanje({
              naslov: "Kmalu na voljo",
              opis:
                "Urejanje tona in predloge po korakih pride v naslednji različici. Rok, obročno in TRR pa lahko že urejate tukaj.",
              potrdiBesedilo: "V redu",
              samoEnGumb: true,
              stil: "primary",
            });
          }
        });
      });

      var shraniOsnutek = opts.glavniEl.querySelector("#opomin-shrani-osnutek");
      if (shraniOsnutek) {
        shraniOsnutek.addEventListener("click", function () {
          shrani();
          sinhronizirajPrilogeVKorak1();
          if (typeof opts.potrdiVprasanje === "function") {
            opts.potrdiVprasanje({
              naslov: "Osnutek shranjen",
              opis: "Načrt ostane v tej seji, dokler ga ne aktiviraš ali zbrišeš.",
              potrdiBesedilo: "V redu",
              samoEnGumb: true,
              stil: "primary",
            });
          }
        });
      }

      /* --- Vezava gumbov na karticah --- */
      opts.glavniEl.querySelectorAll("[data-uredi-kartico]").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var idx = Number(btn.getAttribute("data-uredi-kartico"));
          if (urejanjeKarticeIndex === idx) {
            urejanjeKarticeIndex = null;
          } else {
            urejanjeKarticeIndex = idx;
          }
          izrisiGlavni();
        });
      });

      var urediKorake = opts.glavniEl.querySelector("#opomin-uredi-korake");
      if (urediKorake) {
        urediKorake.addEventListener("click", function () {
          urejanjeKartic = !urejanjeKartic;
          urejanjeKarticeIndex = null;
          if (!urejanjeKartic) {
            var trenutni = N.najdiKorak(plan, aktivenIndex);
            if (!trenutni || trenutni.isExcluded) {
              var prviVkljucen = plan.steps.find(function (s) { return !s.isExcluded; });
              if (prviVkljucen) {
                preklopiAktivniKorak(prviVkljucen.index);
                plan.selectedStageId = prviVkljucen.id;
              }
            }
          }
          N.shraniOsnutek(plan);
          izrisiGlavni();
        });
      }

      opts.glavniEl.querySelectorAll("[data-dodaj-korak]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (typeof N.dodajKorak !== "function") return;
          plan = N.dodajKorak(plan);
          if (root.UJOpominKarticeSync) {
            root.UJOpominKarticeSync.narociShranjevanje(plan);
          }
          N.shraniOsnutek(plan);
          izrisiGlavni();
        });
      });

      opts.glavniEl.querySelectorAll("[data-odstrani-kartico]").forEach(function (btn) {
        btn.addEventListener("click", async function (ev) {
          ev.stopPropagation();
          var idx = Number(btn.getAttribute("data-odstrani-kartico"));
          if (idx === 1) return; // Prvi korak je zaklenjen
          var stepZaOdstranitev = N.najdiKorak(plan, idx);
          if (!stepZaOdstranitev) return;
          stepZaOdstranitev.isExcluded = !stepZaOdstranitev.isExcluded;
          if (typeof N.preracunajOdmikePoIzkljucitvi === "function") {
            plan = N.preracunajOdmikePoIzkljucitvi(plan);
          }
          if (typeof N.uskladiOffseteIzDatumov === "function") {
            plan = N.uskladiOffseteIzDatumov(plan);
          }
          if (root.UJOpominKarticeSync) {
            root.UJOpominKarticeSync.narociShranjevanje(plan);
          }
          N.shraniOsnutek(plan);
          izrisiGlavni();
        });
      });

      /* Klik izven kartic zapre urejevalni način */
      opts.glavniEl.addEventListener("click", function (ev) {
        if (urejanjeKarticeIndex == null) return;
        var target = ev.target;
        var jeZKartice = false;
        while (target && target !== opts.glavniEl) {
          if (target.classList && target.classList.contains("opomin-nacrt__stage-ovoj")) {
            jeZKartice = true;
            break;
          }
          target = target.parentElement;
        }
        if (!jeZKartice) {
          urejanjeKarticeIndex = null;
          izrisiGlavni();
        }
      });

      poveziKontaktneDogodke();
      poveziPrilogeDogodke();

      var cta = opts.glavniEl.querySelector("#opomin-nacrt-cta");
      if (cta) {
        cta.addEventListener("click", async function () {
          var jeRocnaPredaja =
            step &&
            (step.kind === "manual_lawyer" || step.deliveryMode === "manual");

          /* Deseti korak preverimo še na trenutnem zaslonu. Če uporabnik po
             urejanju neposredno nadaljuje, zadnji vnos najprej varno prenesemo
             v načrt in šele nato izvedemo validacijo. */
          if (jeRocnaPredaja) {
            flushPredajaSporocilo();
            var preverjenaPredaja = N.preveriPogojeZaPripravoPredaje(
              plan,
              step.index,
              opts.podatkiKorak1,
              prilogeKoraka
            );
            if (!preverjenaPredaja.ok) {
              if (typeof opts.potrdiVprasanje === "function") {
                await opts.potrdiVprasanje({
                  naslov: "Dopolnite podatke za predajo",
                  odstavki: [
                    {
                      besedilo:
                        "Pred pregledom dopolnite spodnje obvezne podatke. Ostali boste na tem koraku.",
                    },
                    {
                      naslov: "Manjka",
                      besedilo: (preverjenaPredaja.manjkajoce || []).join(" • "),
                      nevarno: true,
                    },
                  ],
                  potrdiBesedilo: "V redu",
                  samoEnGumb: true,
                  stil: "primary",
                });
              }
              return;
            }

            plan = N.pripraviPredajoOdvetniku(
              plan,
              step.index,
              opts.podatkiKorak1,
              prilogeKoraka
            );
            shrani();
            pokaziPotrditev(step.index);
            return;
          }

          if (jeCasKorakaIzvenDovoljenega(plan, step)) {
            var okno = dovoljenoOknoKoraka(plan, step);
            if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                "Ponastavi uro pošiljanja. Dovoljen čas je od " +
                  okno.start +
                  " do " +
                  okno.end +
                  "."
              );
            }
            odpriCasSheet(step.index, "trenutni");
            return;
          }
          var k1 = opts.podatkiKorak1 || {};
          var valid =
            PV && PV.vsePrilogeVeljavneZaPotrditev
              ? PV.vsePrilogeVeljavneZaPotrditev(
                  prilogeKoraka,
                  Boolean(k1.telefonDolznika),
                  Boolean(k1.emailDolznika)
                )
              : { ok: true };
          if (!valid.ok) {
            prilogeNapaka = valid.razlog || "Preverite priloge računov.";
            if (typeof opts.potrdiVprasanje === "function") {
              opts.potrdiVprasanje({
                naslov: "Priloge niso pripravljene",
                opis: prilogeNapaka,
                potrdiBesedilo: "V redu",
                samoEnGumb: true,
                stil: "primary",
              });
            }
            return;
          }
          if (N.soVsiSmsPotrjeni(plan)) {
            aktiviraj();
            return;
          }
          /* Vedno odpri pregled TRENUTNO izbranega koraka - tudi če je že
             potrjen, da ga lahko uporabnik znova odpre in po potrebi
             popravi (besedilo/dodatke). Preskok na naslednji nepotrjen
             korak bi uporabniku onemogočil urejanje že potrjenega koraka. */
          pokaziPotrditev(step.index);
        });
      }

      /* Paketna izbira za ročni odvetniški 10. korak. */
      if (step && (step.kind === "manual_lawyer" || step.deliveryMode === "manual")) {
        var lpRazsiri = opts.glavniEl.querySelector("#lp-razsiri-podatke");
        if (lpRazsiri) {
          lpRazsiri.addEventListener("click", function (e) {
            e.preventDefault();
            var razsirjeno = opts.glavniEl.querySelector("#lp-razsirjeni-podatki");
            if (!razsirjeno) return;
            var odprto = lpRazsiri.getAttribute("aria-expanded") === "true";
            if (odprto) {
              lpRazsiri.setAttribute("aria-expanded", "false");
              razsirjeno.classList.remove("lp-predaja-povzetek__razsirjeno--odprto");
              razsirjeno.addEventListener("transitionend", function h() {
                razsirjeno.removeEventListener("transitionend", h);
                razsirjeno.hidden = true;
              });
            } else {
              lpRazsiri.setAttribute("aria-expanded", "true");
              razsirjeno.hidden = false;
              requestAnimationFrame(function () {
                razsirjeno.classList.add("lp-predaja-povzetek__razsirjeno--odprto");
              });
            }
          });
        }

        var lpCarousel = opts.glavniEl.querySelector("#lp-paket-carousel");
        var lpPike = opts.glavniEl.querySelectorAll(".lp-paket-pika");
        if (lpCarousel && lpPike.length) {
          function lpPosodobiAktivniPaket(aktivna) {
            var kartice = lpCarousel.querySelectorAll(".lp-paket-kartica");
            lpPike.forEach(function (p, i) {
              p.classList.toggle("lp-paket-pika--aktivna", i === aktivna);
              p.setAttribute("aria-current", i === aktivna ? "true" : "false");
            });
            kartice.forEach(function (kartica, i) {
              kartica.classList.toggle("lp-paket-kartica--aktivna-drsnik", i === aktivna);
            });
            /* Ponudbe se lahko po filtru ali izbiri prerazporedijo (izbrana je
               pripeta na začetek). Zato aktivnega paketa nikoli ne določamo
               več po indeksu statičnega kataloga, ampak po ID-ju dejansko
               prikazane kartice. Sicer se po izbiri označi napačna kartica. */
            var aktivnaKartica = kartice[aktivna];
            var aktivniPaketId = aktivnaKartica && aktivnaKartica.getAttribute("data-paket-id");
            var pkg = aktivniPaketId ? najdiPaket(aktivniPaketId) : null;
            if (pkg) {
              lawyerPopupState.activePackageId = pkg.id;
              var korakiEl = opts.glavniEl.querySelector("#lp-dinamicni-koraki");
              if (korakiEl) {
                korakiEl.innerHTML =
                  htmlKorakOdvetnik(pkg, step) +
                  '<span class="lp-koraki__puscica" aria-hidden="true">→</span>' +
                  htmlKorak(2, htmlVelikaIkonaPaketa(pkg.icon), nazivIzbranegaPaketa(pkg), "", false, "data-lp-korak-paket") +
                  '<span class="lp-koraki__puscica" aria-hidden="true">→</span>' +
                  htmlKorak(3, htmlVelikaIkonaPaketa("scales"), "Začetek postopka", "", false, "data-lp-korak-postopek");
              }
            }
          }

          function lpAktivniIndexIzScrolla() {
            var kartice = lpCarousel.querySelectorAll(".lp-paket-kartica");
            var sredina = lpCarousel.scrollLeft + lpCarousel.clientWidth / 2;
            var aktivna = 0;
            var razdalja = Infinity;
            kartice.forEach(function (kartica, i) {
              var d = Math.abs(kartica.offsetLeft + kartica.offsetWidth / 2 - sredina);
              if (d < razdalja) { razdalja = d; aktivna = i; }
            });
            return aktivna;
          }

          function lpPosodobiSkaliranjeKartic() {
            var kartice = lpCarousel.querySelectorAll(".lp-paket-kartica");
            var sredina = lpCarousel.scrollLeft + lpCarousel.clientWidth / 2;
            var razpon = lpCarousel.clientWidth * 0.62;
            kartice.forEach(function (kartica) {
              var center = kartica.offsetLeft + kartica.offsetWidth / 2;
              var t = Math.min(1, Math.abs(center - sredina) / razpon);
              var skala = 1 - t * 0.08;
              kartica.style.transform = "scale(" + skala.toFixed(3) + ")";
            });
          }

          function lpPremakniCarousel(index, behavior) {
            var kartice = lpCarousel.querySelectorAll(".lp-paket-kartica");
            if (!kartice[index]) return;
            lpCarousel.scrollTo({ left: kartice[index].offsetLeft, behavior: behavior || "smooth" });
            lpPosodobiAktivniPaket(index);
          }

          var lpScrollRaf = null;
          lpCarousel.addEventListener("scroll", function () {
            if (lpScrollRaf) cancelAnimationFrame(lpScrollRaf);
            lpScrollRaf = requestAnimationFrame(function () {
              lpPosodobiSkaliranjeKartic();
              lpPosodobiAktivniPaket(lpAktivniIndexIzScrolla());
              lpScrollRaf = null;
            });
          }, { passive: true });
          lpPosodobiSkaliranjeKartic();

          var aktivenId = lawyerPopupState.activePackageId;
          var karticelj = lpCarousel.querySelectorAll(".lp-paket-kartica");
          var aktivenIndexLj = Array.prototype.findIndex.call(karticelj, function (kartica) {
            return kartica.getAttribute("data-paket-id") === aktivenId;
          });
          if (aktivenIndexLj >= 0) {
            if (karticelj[aktivenIndexLj]) {
              // Ob ponovnem izrisu (npr. takoj po izbiri paketa) postavimo
              // carousel na aktivno kartico se pred naslednjim izrisom zaslona.
              // Tako ohranimo Cloudovo animacijo pri rocnih premikih, izbira pa
              // ne pokaze vmesnega preskoka na prvo/levo kartico.
              lpPremakniCarousel(aktivenIndexLj, "auto");
              requestAnimationFrame(lpPosodobiSkaliranjeKartic);
            }
          } else {
            lpPosodobiAktivniPaket(0);
          }

          lpPike.forEach(function (pika, i) {
            pika.addEventListener("click", function () {
              lpPremakniCarousel(i, "smooth");
            });
          });
        }

        var lpPotrjevanje = false;
        var lpEscapeHandler = null;

        function lpOdstraniEscapeHandler() {
          if (!lpEscapeHandler) return;
          document.removeEventListener("keydown", lpEscapeHandler);
          lpEscapeHandler = null;
        }

        function lpDodajEscapeHandler() {
          lpOdstraniEscapeHandler();
          lpEscapeHandler = function (e) {
            if (e.key === "Escape") lpZapriPopupe();
          };
          document.addEventListener("keydown", lpEscapeHandler);
        }

        function lpIzrisiCustomPovzetek() {
          var el = opts.glavniEl.querySelector("#lp-custom-paket-povzetek");
          var potrdi = opts.glavniEl.querySelector("#lp-custom-paket-potrdi");
          if (!el) return;
          var p = povzetekCustomStoritev(lawyerPopupState.draftCustomServiceIds);
          var vrstice = p.storitve.map(function (service, i) {
            return '<div><span>Storitev ' + (i + 1) + '</span><strong>' + esc(formatirajCenoCustomStoritev(service)) + "</strong></div>";
          }).join("");
          el.innerHTML = p.storitve.length
            ? '<strong class="lp-sestavljalnik__povzetek-naslov">Izbrane storitve (' + p.storitve.length + ")</strong>" +
              '<div class="lp-sestavljalnik__povzetek-vrstice">' + vrstice + "</div>" +
              '<div class="lp-sestavljalnik__skupaj"><span>Skupna cena</span><strong>' + esc(formatirajCente(p.totalCents)) +
              (p.imaPonudbo ? " + ponudba" : "") + "</strong></div>"
            : '<span class="lp-sestavljalnik__brez-izbire">Izberite najmanj eno storitev.</span>';
          if (potrdi) potrdi.disabled = !p.storitve.length;
        }

        function lpPosodobiCustomKartico(id, izbrana) {
          var kartica = opts.glavniEl.querySelector('[data-custom-kartica="' + id + '"]');
          if (!kartica) return;
          var gumb = kartica.querySelector("[data-custom-predogled-storitev]");
          if (kartica) kartica.classList.toggle("lp-storitev--izbrana", izbrana);
          if (gumb) gumb.textContent = izbrana ? "Preglej · Izbrano ✓" : "Preglej in izberi";
          var check = kartica && kartica.querySelector(".lp-storitev__check");
          if (check) check.textContent = izbrana ? "✓" : "";
        }

        function lpIzrisiCustomPredogled(serviceId) {
          var el = opts.glavniEl.querySelector("#lp-custom-predogled-vsebina");
          if (!el) return;
          var naslov = opts.glavniEl.querySelector("#lp-custom-predogled-naslov");
          var podnaslov = opts.glavniEl.querySelector("#lp-custom-predogled-podnaslov");
          var izberi = opts.glavniEl.querySelector("#lp-custom-paket-izberi");
          var service = serviceId ? najdiCustomStoritev(serviceId) : null;
          lawyerPopupState.customPreviewServiceId = service ? service.id : null;
          if (service) {
            var jeIzbrana = lawyerPopupState.draftCustomServiceIds.indexOf(service.id) >= 0;
            var vkljucuje = (service.includedItems || []).map(function (item) {
              return '<li><span aria-hidden="true">✓</span><span>' + esc(item) + "</span></li>";
            }).join("");
            if (naslov) naslov.textContent = service.title;
            if (podnaslov) podnaslov.textContent = "Celoten pregled izbrane odvetniške rešitve.";
            if (izberi) {
              izberi.textContent = jeIzbrana ? "Odstrani storitev" : "Izberi storitev";
              izberi.disabled = false;
            }
            el.innerHTML = '<div class="lp-custom-predogled__hero"><span class="lp-custom-predogled__hero-ikona" aria-hidden="true">' +
              htmlIkonaPaketa(service.icon) + '</span><div><span>Odvetniška rešitev</span><strong>' + esc(service.title) +
              '</strong></div><strong class="lp-custom-predogled__hero-cena">' + esc(formatirajCenoCustomStoritev(service)) + "</strong></div>" +
              '<p class="lp-custom-predogled__opis">' + esc(service.description) + "</p>" +
              '<div class="lp-custom-predogled__vkljucuje"><h3>Kaj vključuje</h3><ul>' + vkljucuje + "</ul></div>" +
              '<div class="lp-custom-predogled__skupaj"><span>Cena storitve</span><strong>' +
              esc(formatirajCenoCustomStoritev(service)) + "</strong></div>";
            return;
          }
          var p = povzetekCustomStoritev(lawyerPopupState.draftCustomServiceIds);
          if (naslov) naslov.textContent = "Vaš paket storitev";
          if (podnaslov) podnaslov.textContent = "Pred izbiro še enkrat preverite vključene rešitve.";
          if (izberi) {
            izberi.textContent = "Izberi paket";
            izberi.disabled = false;
          }
          var vrstice = p.storitve.map(function (service) {
            return '<div class="lp-custom-predogled__storitev"><span class="lp-custom-predogled__ikona" aria-hidden="true">' +
              htmlIkonaPaketa(service.icon) + '</span><span class="lp-custom-predogled__besedilo"><strong>' + esc(service.title) +
              '</strong><span>' + esc(service.description) + '</span></span><strong class="lp-custom-predogled__cena">' +
              esc(formatirajCenoCustomStoritev(service)) + "</strong></div>";
          }).join("");
          el.innerHTML = '<div class="lp-custom-predogled__kartica"><div class="lp-custom-predogled__kartica-glava">' +
            '<span>Paket po meri</span><strong>' + p.storitve.length + (p.storitve.length === 1 ? " storitev" : " storitev") + "</strong></div>" +
            '<div class="lp-custom-predogled__storitve">' + vrstice + "</div>" +
            '<div class="lp-custom-predogled__skupaj"><span>Skupna cena</span><strong>' + esc(formatirajCente(p.totalCents)) +
            (p.imaPonudbo ? " + ponudba" : "") + "</strong></div></div>" +
            '<p class="lp-custom-predogled__opomba">Paket bo izbran šele, ko pritisnete »Izberi paket«.</p>';
        }

        function lpPokaziCustomPredogled(serviceId) {
          if (serviceId && !najdiCustomStoritev(serviceId)) return;
          if (!serviceId && !snapshotCustomPaketa(lawyerPopupState.draftCustomServiceIds)) return;
          var ovoj = opts.glavniEl.querySelector("#lp-custom-paket-ovoj");
          if (!ovoj) return;
          lpIzrisiCustomPredogled(serviceId);
          var sestavljalnik = ovoj.querySelector(".lp-sestavljalnik");
          var predogled = ovoj.querySelector("#lp-custom-paket-predogled-panel");
          if (sestavljalnik) sestavljalnik.hidden = true;
          if (predogled) {
            predogled.hidden = false;
            predogled.focus({ preventScroll: true });
          }
        }

        function lpNazajNaCustomSestavljalnik() {
          var ovoj = opts.glavniEl.querySelector("#lp-custom-paket-ovoj");
          if (!ovoj) return;
          var sestavljalnik = ovoj.querySelector(".lp-sestavljalnik");
          var predogled = ovoj.querySelector("#lp-custom-paket-predogled-panel");
          if (predogled) predogled.hidden = true;
          lawyerPopupState.customPreviewServiceId = null;
          if (sestavljalnik) {
            sestavljalnik.hidden = false;
            sestavljalnik.focus({ preventScroll: true });
          }
        }

        function lpPonastaviAktivniKorak() {
          lawyerPopupState.activeFlowStep = 0;
          var koraki = opts.glavniEl.querySelector("#lp-dinamicni-koraki");
          if (!koraki) return;
          koraki.querySelectorAll(".lp-korak--aktiven").forEach(function (korak) {
            korak.classList.remove("lp-korak--aktiven");
          });
        }

        function lpZapriCustomPaket() {
          var ovoj = opts.glavniEl.querySelector("#lp-custom-paket-ovoj");
          if (ovoj) { ovoj.hidden = true; ovoj.classList.add("lp-popup-ovoj--zaprt"); }
          document.body.classList.remove("lp-popup-zaklenjeno-telo");
          lpOdstraniEscapeHandler();
          lpPonastaviAktivniKorak();
          var opener = opts.glavniEl.querySelector("#lp-odpri-custom-paket");
          if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
        }

        function lpOdpriCustomPaket() {
          var ovoj = opts.glavniEl.querySelector("#lp-custom-paket-ovoj");
          if (!ovoj) return;
          var selectedPackage = step.lawyerHandoff && step.lawyerHandoff.selectedPackage;
          lawyerPopupState.draftCustomServiceIds = izbraneCustomStoritve(selectedPackage);
          lawyerPopupState.customPreviewServiceId = null;
          ovoj.querySelectorAll("[data-custom-kartica]").forEach(function (kartica) {
            var id = kartica.getAttribute("data-custom-kartica");
            lpPosodobiCustomKartico(id, lawyerPopupState.draftCustomServiceIds.indexOf(id) >= 0);
          });
          lpIzrisiCustomPovzetek();
          var sestavljalnik = ovoj.querySelector(".lp-sestavljalnik");
          var predogled = ovoj.querySelector("#lp-custom-paket-predogled-panel");
          if (sestavljalnik) sestavljalnik.hidden = false;
          if (predogled) predogled.hidden = true;
          ovoj.hidden = false;
          ovoj.classList.remove("lp-popup-ovoj--zaprt");
          var drsnik = ovoj.querySelector("#lp-custom-paket-drsnik");
          if (drsnik) drsnik.scrollTop = 0;
          document.body.classList.add("lp-popup-zaklenjeno-telo");
          lpDodajEscapeHandler();
          setTimeout(function () {
            var panel = ovoj.querySelector(".lp-sestavljalnik");
            if (panel) panel.focus({ preventScroll: true });
          }, 0);
        }

        function lpZapriOdvetnike() {
          var osveziPonudbe = lawyerPopupState.lawyerVisibilityChanged;
          var ovoj = opts.glavniEl.querySelector("#lp-odvetniki-ovoj");
          if (ovoj) { ovoj.hidden = true; ovoj.classList.add("lp-popup-ovoj--zaprt"); }
          lawyerPopupState.previewLawyerId = null;
          lawyerPopupState.lawyerVisibilityChanged = false;
          document.body.classList.remove("lp-popup-zaklenjeno-telo");
          lpOdstraniEscapeHandler();
          lpPonastaviAktivniKorak();
          var opener = opts.glavniEl.querySelector("#lp-izberi-odvetnika");
          if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
          if (osveziPonudbe) izrisiGlavni();
        }

        function lpNazajNaSeznamOdvetnikov() {
          var ovoj = opts.glavniEl.querySelector("#lp-odvetniki-ovoj");
          if (!ovoj) return;
          var seznam = ovoj.querySelector("#lp-odvetniki-seznam");
          var profil = ovoj.querySelector("#lp-odvetnik-profil");
          if (profil) profil.hidden = true;
          if (seznam) {
            seznam.hidden = false;
            seznam.focus({ preventScroll: true });
          }
          lawyerPopupState.previewLawyerId = null;
        }

        function lpPokaziProfilOdvetnika(lawyerId) {
          var lawyer = najdiProfilOdvetnika(lawyerId);
          var ovoj = opts.glavniEl.querySelector("#lp-odvetniki-ovoj");
          if (!lawyer || !ovoj) return;
          lawyerPopupState.previewLawyerId = lawyer.id;
          var naslov = ovoj.querySelector("#lp-odvetnik-profil-naslov");
          var vsebina = ovoj.querySelector("#lp-odvetnik-profil-vsebina");
          var izberi = ovoj.querySelector("#lp-odvetnik-profil-izberi");
          var jeIzbran = Boolean(step.lawyerHandoff && step.lawyerHandoff.lawyerId === lawyer.id);
          var storitveHtml = (lawyer.services || []).map(function (service) {
            return "<li>" + esc(service) + "</li>";
          }).join("");
          if (naslov) naslov.textContent = lawyer.name;
          if (vsebina) vsebina.innerHTML =
            '<div class="lp-odvetnik-profil__hero"><span class="lp-odvetnik-profil__avatar" aria-hidden="true">' + esc(inicialkeOdvetnika(lawyer)) +
            '</span><div><strong>' + esc(lawyer.name) + '</strong><span>' + esc(lawyer.officeName) + '</span><small>★ ' + esc(lawyer.rating) + " · " + esc(lawyer.city) + "</small></div></div>" +
            '<div class="lp-odvetnik-profil__meta"><span>' + esc(lawyer.experience) + '</span><span>' + esc(lawyer.specialty) + "</span></div>" +
            '<section class="lp-odvetnik-profil__opis"><h3>O odvetniku</h3><p>' + esc(lawyer.description) + "</p></section>" +
            '<section class="lp-odvetnik-profil__storitve"><h3>Storitve za podjetnike</h3><ul>' + storitveHtml + "</ul></section>" +
            '<section class="lp-odvetnik-profil__kontakt"><h3>Kontakt</h3><p>' + esc(lawyer.email) + "</p><p>" + esc(lawyer.phone) + "</p></section>";
          if (izberi) {
            izberi.textContent = jeIzbran ? "Izbrano ✓" : "Izberi odvetnika";
            izberi.disabled = jeIzbran;
          }
          var seznam = ovoj.querySelector("#lp-odvetniki-seznam");
          var profil = ovoj.querySelector("#lp-odvetnik-profil");
          if (seznam) seznam.hidden = true;
          if (profil) {
            profil.hidden = false;
            profil.focus({ preventScroll: true });
          }
        }

        function lpOdpriOdvetnike() {
          var ovoj = opts.glavniEl.querySelector("#lp-odvetniki-ovoj");
          if (!ovoj) return;
          lawyerPopupState.previewLawyerId = null;
          lawyerPopupState.lawyerVisibilityChanged = false;
          var seznam = ovoj.querySelector("#lp-odvetniki-seznam");
          var profil = ovoj.querySelector("#lp-odvetnik-profil");
          if (seznam) seznam.hidden = false;
          if (profil) profil.hidden = true;
          ovoj.hidden = false;
          ovoj.classList.remove("lp-popup-ovoj--zaprt");
          document.body.classList.add("lp-popup-zaklenjeno-telo");
          lpDodajEscapeHandler();
          if (seznam) seznam.focus({ preventScroll: true });
        }
        function lpPotrdiPaket(packageId) {
          if (lpPotrjevanje) return;
          lpPotrjevanje = true;
          var pkg = najdiPaket(packageId);
          if (!pkg) { lpPotrjevanje = false; return; }
          var snapshot = ustvariSnapshotPaketa(pkg);
          plan = izberiPaketInPrikazanegaOdvetnika(pkg, snapshot, step.index);
          var posodobljenKorak = N.najdiKorak(plan, step.index);
          var dejanskoIzbranId = posodobljenKorak && posodobljenKorak.lawyerHandoff &&
            posodobljenKorak.lawyerHandoff.selectedPackage &&
            posodobljenKorak.lawyerHandoff.selectedPackage.packageId;
          if (dejanskoIzbranId !== pkg.id) {
            lpPotrjevanje = false;
            return;
          }
          /* Izbrani paket mora ostati v pogledu tudi po ponovnem izrisu, ko
             se zaradi oznake »Izbrano« pripne na začetek seznama. */
          lawyerPopupState.activePackageId = pkg.id;
          N.shraniOsnutek(plan);
          var ovoj = opts.glavniEl.querySelector("#lp-popup-ovoj");
          if (ovoj) { ovoj.hidden = true; ovoj.classList.add("lp-popup-ovoj--zaprt"); }
          ovoj = opts.glavniEl.querySelector("#lp-predogled-ovoj");
          if (ovoj) { ovoj.hidden = true; ovoj.classList.add("lp-popup-ovoj--zaprt"); }
          lpPonastaviAktivniKorak();
          izrisiGlavni();
          lpPotrjevanje = false;
        }

        function lpZapriPopupe() {
          var osveziPonudbe = lawyerPopupState.lawyerVisibilityChanged;
          var ovoj = opts.glavniEl.querySelector("#lp-popup-ovoj");
          if (ovoj) { ovoj.hidden = true; ovoj.classList.add("lp-popup-ovoj--zaprt"); }
          ovoj = opts.glavniEl.querySelector("#lp-predogled-ovoj");
          if (ovoj) { ovoj.hidden = true; ovoj.classList.add("lp-popup-ovoj--zaprt"); }
          ovoj = opts.glavniEl.querySelector("#lp-custom-paket-ovoj");
          if (ovoj) { ovoj.hidden = true; ovoj.classList.add("lp-popup-ovoj--zaprt"); }
          ovoj = opts.glavniEl.querySelector("#lp-odvetniki-ovoj");
          if (ovoj) { ovoj.hidden = true; ovoj.classList.add("lp-popup-ovoj--zaprt"); }
          ovoj = opts.glavniEl.querySelector("#lp-filter-ponudb-ovoj");
          if (ovoj) { ovoj.hidden = true; ovoj.classList.add("lp-popup-ovoj--zaprt"); }
          var filterOdpr = opts.glavniEl.querySelector("#lp-filter-ponudb-odpri");
          if (filterOdpr) filterOdpr.setAttribute("aria-expanded", "false");
          lawyerPopupState.filterDraft = null;
          lawyerPopupState.filterView = "main";
          lawyerPopupState.filterOpener = null;
          document.body.classList.remove("lp-popup-zaklenjeno-telo");
          lawyerPopupState.pendingPackageId = null;
          lawyerPopupState.previewPackageId = null;
          lawyerPopupState.lawyerVisibilityChanged = false;
          lpOdstraniEscapeHandler();
          lpPonastaviAktivniKorak();
          if (osveziPonudbe) izrisiGlavni();
        }

        function lpIzrisiFilterPonudb(step) {
          var panel = opts.glavniEl.querySelector("#lp-filter-ponudb-panel");
          if (!panel) return;
          var draft = lawyerPopupState.filterDraft;
          if (!draft) return;

          var chevronHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

          var trenutno = panel.querySelector("#lp-filter-ponudb-trenutno");
          if (trenutno) {
            var savedText = besediloFiltraPonudb(step).buttonText;
            trenutno.innerHTML =
              '<span class="lp-filter-ponudb__trenutno-oznaka">Trenutno:</span>' +
              '<span class="lp-filter-ponudb__trenutno-vrednost">' + esc(savedText) + "</span>";
          }

          var nacinEl = panel.querySelector("#lp-filter-ponudb-nacin");
          if (nacinEl) {
            nacinEl.innerHTML = ["best_match", "single_lawyer"].map(function (m) {
              var jeBest = m === "best_match";
              var izbrano = jeBest ? draft.mode !== "single_lawyer" : draft.mode === "single_lawyer";
              return (
                '<label class="lp-filter-ponudb__nacin-kartica' + (izbrano ? " lp-filter-ponudb__nacin-kartica--izbrana" : "") + '">' +
                '<input type="radio" name="lp-filter-ponudb-nacin" value="' + m + '"' +
                (izbrano ? " checked" : "") + ' data-lp-filter-nacin />' +
                '<span class="lp-filter-ponudb__nacin-radio" aria-hidden="true"></span>' +
                '<span class="lp-filter-ponudb__nacin-besedilo">' +
                "<strong>" + (jeBest ? "Najbolj ustrezne ponudbe" : "Samo en odvetnik") + "</strong>" +
                "<span>" + (jeBest ? "Paketi vseh odvetnikov, razvrščeni za vaš primer" : "Prikaži samo ponudbe izbranega odvetnika") + "</span>" +
                "</span></label>"
              );
            }).join("");
          }

          var odvetnikiEl = panel.querySelector("#lp-filter-ponudb-odvetniki");
          if (odvetnikiEl) {
            var jeRadio = draft.mode === "single_lawyer";
            odvetnikiEl.innerHTML = vsiOdvetnikiFiltra(step, draft.customLawyers).map(function (o) {
              var izbran = draft.lawyerIds.indexOf(o.id) >= 0;
              var inic = inicialkeOdvetnika({ name: o.name });
              return (
                '<label class="lp-filter-ponudb__odvetnik' + (izbran ? " lp-filter-ponudb__odvetnik--izbran" : "") + '">' +
                '<input type="' + (jeRadio ? "radio" : "checkbox") + '" name="lp-filter-ponudb-odvetnik" value="' +
                esc(o.id) + '"' + (izbran ? " checked" : "") + " data-lp-filter-odvetnik" +
                (jeRadio ? " data-lp-filter-odvetnik-single" : "") + " />" +
                '<span class="lp-filter-ponudb__odvetnik-check" aria-hidden="true"></span>' +
                '<span class="lp-filter-ponudb__odvetnik-avatar" aria-hidden="true">' + esc(inic) + "</span>" +
                '<span class="lp-filter-ponudb__odvetnik-besedilo"><strong>' + esc(o.name) + "</strong>" +
                (o.officeName ? "<span>" + esc(o.officeName) + "</span>" : "") + "</span>" +
                '<span class="lp-filter-ponudb__odvetnik-chevron" aria-hidden="true">' + chevronHtml + "</span>" +
                "</label>"
              );
            }).join("");
          }
        }

        function lpZapriFilterPonudb() {
          var ovoj = opts.glavniEl.querySelector("#lp-filter-ponudb-ovoj");
          if (ovoj) { ovoj.hidden = true; ovoj.classList.add("lp-popup-ovoj--zaprt"); }
          var odpiralec = opts.glavniEl.querySelector("#lp-filter-ponudb-odpri");
          if (odpiralec) odpiralec.setAttribute("aria-expanded", "false");
          document.body.classList.remove("lp-popup-zaklenjeno-telo");
          lpOdstraniEscapeHandler();
          lawyerPopupState.filterDraft = null;
          lawyerPopupState.filterView = "main";
          if (lawyerPopupState.filterOpener && document.contains(lawyerPopupState.filterOpener)) {
            lawyerPopupState.filterOpener.focus({ preventScroll: true });
          }
          lawyerPopupState.filterOpener = null;
        }

        function lpKlonirajFilter(filter, step) {
          var lh = (step && step.lawyerHandoff) || {};
          return {
            mode: filter.mode,
            lawyerIds: (filter.lawyerIds || []).slice(),
            singleLawyerId: filter.singleLawyerId || null,
            customLawyers: (Array.isArray(lh.customLawyers) ? lh.customLawyers : []).map(function (c) {
              return {
                id: c.id,
                name: c.name,
                officeName: c.officeName,
                email: c.email,
                phone: c.phone,
                createdAt: c.createdAt,
              };
            }),
          };
        }

        function lpOdpriFilterPonudb() {
          var ovoj = opts.glavniEl.querySelector("#lp-filter-ponudb-ovoj");
          if (!ovoj) return;
          var aktualniStep = N.najdiKorak(plan, step.index) || step;
          lawyerPopupState.filterOpener = document.activeElement || opts.glavniEl.querySelector("#lp-filter-ponudb-odpri");
          lawyerPopupState.filterDraft = lpKlonirajFilter(pridobiFilterPonudb(aktualniStep), aktualniStep);
          lawyerPopupState.filterView = "main";
          var glavni = ovoj.querySelector("#lp-filter-ponudb-main");
          var dodaj = ovoj.querySelector("#lp-filter-ponudb-dodaj-pogled");
          var noga = ovoj.querySelector(".lp-filter-ponudb__noga");
          if (glavni) glavni.hidden = false;
          if (dodaj) dodaj.hidden = true;
          if (noga) noga.hidden = false;
          var napaka = ovoj.querySelector("#lp-filter-ponudb-napaka");
          if (napaka) napaka.hidden = true;
          lpIzrisiFilterPonudb(aktualniStep);
          var odpr = opts.glavniEl.querySelector("#lp-filter-ponudb-odpri");
          if (odpr) odpr.setAttribute("aria-expanded", "true");
          ovoj.hidden = false;
          ovoj.classList.remove("lp-popup-ovoj--zaprt");
          document.body.classList.add("lp-popup-zaklenjeno-telo");
          lpDodajEscapeHandler();
          lpPoveziFilterFokus(ovoj.querySelector("#lp-filter-ponudb-panel"));
          setTimeout(function () {
            var p = ovoj.querySelector("#lp-filter-ponudb-panel");
            if (p) p.focus({ preventScroll: true });
          }, 0);
        }

        function lpPotrdiFilterPonudb() {
          var draft = lawyerPopupState.filterDraft;
          var gumb = opts.glavniEl.querySelector("#lp-filter-ponudb-uporabi");
          if (!draft) { lpZapriFilterPonudb(); return; }
          var napaka = opts.glavniEl.querySelector("#lp-filter-ponudb-napaka");
          if (!draft.lawyerIds || !draft.lawyerIds.length) {
            if (napaka) { napaka.hidden = false; napaka.textContent = "Izberite vsaj enega odvetnika."; }
            return;
          }
          if (draft.mode === "single_lawyer" && !draft.singleLawyerId) {
            if (napaka) { napaka.hidden = false; napaka.textContent = "Izberite enega odvetnika."; }
            return;
          }
          if (gumb) { gumb.disabled = true; gumb.setAttribute("aria-busy", "true"); }
          var aktualniStep = N.najdiKorak(plan, step.index) || step;
          var validni = LAWYER_PROFILES.map(function (l) { return l.id; }).concat(
            (draft.customLawyers || []).map(function (c) { return c.id; })
          );
          plan = N.posodobiFilterPonudb(plan, step.index, {
            mode: draft.mode,
            lawyerIds: draft.lawyerIds,
            singleLawyerId: draft.singleLawyerId,
            customLawyers: draft.customLawyers,
            validLawyerIds: validni,
          });
          N.shraniOsnutek(plan);
          lpZapriFilterPonudb();
          izrisiGlavni();
        }

        function lpUporabiPriporoceniFilter() {
          var sistemIds = LAWYER_PROFILES.map(function (l) { return l.id; });
          plan = N.posodobiFilterPonudb(plan, step.index, {
            mode: "best_match",
            lawyerIds: sistemIds,
            singleLawyerId: null,
            validLawyerIds: sistemIds,
          });
          N.shraniOsnutek(plan);
          izrisiGlavni();
          var gumb = opts.glavniEl.querySelector("#lp-filter-priporoceno");
          if (gumb) {
            gumb.classList.add("lp-filter-ponudb__priporoceno--potrjen");
            setTimeout(function () {
              if (gumb && document.contains(gumb)) gumb.classList.remove("lp-filter-ponudb__priporoceno--potrjen");
            }, 1200);
          }
        }

        function lpPokaziDodajOdvetnika() {
          var ovoj = opts.glavniEl.querySelector("#lp-filter-ponudb-ovoj");
          if (!ovoj) return;
          lawyerPopupState.filterView = "dodaj";
          var glavni = ovoj.querySelector("#lp-filter-ponudb-main");
          var dodaj = ovoj.querySelector("#lp-filter-ponudb-dodaj-pogled");
          var noga = ovoj.querySelector(".lp-filter-ponudb__noga");
          var napaka = ovoj.querySelector("#lp-filter-ponudb-napaka");
          if (napaka) napaka.hidden = true;
          if (glavni) glavni.hidden = true;
          if (noga) noga.hidden = true;
          if (dodaj) {
            dodaj.hidden = false;
            var ime = ovoj.querySelector("#lp-filter-ponudb-ime");
            if (ime) ime.focus({ preventScroll: true });
          }
        }

        function lpNazajIzDodajOdvetnika() {
          var ovoj = opts.glavniEl.querySelector("#lp-filter-ponudb-ovoj");
          if (!ovoj) return;
          lawyerPopupState.filterView = "main";
          var glavni = ovoj.querySelector("#lp-filter-ponudb-main");
          var dodaj = ovoj.querySelector("#lp-filter-ponudb-dodaj-pogled");
          var noga = ovoj.querySelector(".lp-filter-ponudb__noga");
          var napaka = ovoj.querySelector("#lp-filter-ponudb-napaka");
          if (napaka) napaka.hidden = true;
          if (dodaj) dodaj.hidden = true;
          if (glavni) glavni.hidden = false;
          if (noga) noga.hidden = false;
        }

        function lpDodajOdvetnikaVDraft() {
          var ovoj = opts.glavniEl.querySelector("#lp-filter-ponudb-ovoj");
          if (!ovoj || !lawyerPopupState.filterDraft) return;
          var imeEl = ovoj.querySelector("#lp-filter-ponudb-ime");
          var pisarnaEl = ovoj.querySelector("#lp-filter-ponudb-pisarna");
          var emailEl = ovoj.querySelector("#lp-filter-ponudb-email");
          var telEl = ovoj.querySelector("#lp-filter-ponudb-telefon");
          var napaka = ovoj.querySelector("#lp-filter-ponudb-napaka");
          var imeV = String((imeEl && imeEl.value) || "").trim();
          var emailV = String((emailEl && emailEl.value) || "").trim();
          var telV = String((telEl && telEl.value) || "").trim();
          if (!imeV) { if (napaka) { napaka.hidden = false; napaka.textContent = "Vnesite ime in priimek."; } return; }
          if (!emailV && !telV) { if (napaka) { napaka.hidden = false; napaka.textContent = "Vnesite vsaj e-pošto ali telefon."; } return; }
          var nov = {
            id: "custom_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
            name: imeV,
            officeName: String((pisarnaEl && pisarnaEl.value) || "").trim(),
            email: emailV,
            phone: telV,
            createdAt: new Date().toISOString(),
          };
          var draft = lawyerPopupState.filterDraft;
          draft.customLawyers = (draft.customLawyers || []).concat([nov]);
          var stanje = N.dodajOdvetnikaVDraftStanje(draft, nov.id);
          draft.lawyerIds = stanje.lawyerIds;
          draft.singleLawyerId = stanje.singleLawyerId;
          if (imeEl) imeEl.value = "";
          if (pisarnaEl) pisarnaEl.value = "";
          if (emailEl) emailEl.value = "";
          if (telEl) telEl.value = "";
          lpNazajIzDodajOdvetnika();
          lpIzrisiFilterPonudb(step);
        }

        var lpFilterFokusTrap = null;

        function lpPoveziFilterFokus(panel) {
          if (!panel) return;
          /* Vztrajna instanca trapa za ta panel: priklopi() ob vsakem odprtju
             samodejno odstrani prejšnjega, zato Tab/Shift+Tab delujeta tudi ob
             drugem/tretjem odprtju brez podvojenih listenerjev. */
          if (!lpFilterFokusTrap || lpFilterFokusTrap.panel !== panel) {
            lpFilterFokusTrap = ustvariFokusniTrap(panel);
          }
          lpFilterFokusTrap.priklopi();
        }

        function lpPoveziPotrditveniPopupDogodke(panel) {
          var potrdi = panel.querySelector("#lp-popup-potrdi");
          if (potrdi) {
            potrdi.addEventListener("click", function () {
              if (potrdi.disabled) return;
              potrdi.disabled = true;
              potrdi.setAttribute("aria-busy", "true");
              potrdi.classList.add("lp-popup-gumb--nalaganje");
              setTimeout(function () {
                lpPotrdiPaket(lawyerPopupState.pendingPackageId);
              }, 60);
            });
          }
          var nazaj = panel.querySelector("#lp-popup-nazaj");
          if (nazaj) nazaj.addEventListener("click", lpZapriPopupe);
          var zapri = panel.querySelector("#lp-popup-zapri");
          if (zapri) zapri.addEventListener("click", lpZapriPopupe);
          var backdrop = panel.parentElement.querySelector("#lp-popup-backdrop");
          if (backdrop) {
            backdrop.removeEventListener("click", lpZapriPopupe);
            backdrop.addEventListener("click", lpZapriPopupe, { once: true });
          }

          /* Fokus trap + vračanje fokusa + zaklep drsenja ozadja (a11y, #14).
             Reagira na zaprtje popupa preko MutationObserver-ja namesto
             spreminjanja skupnih lpZapriPopupe/lpOdpriPotrditveniPopup
             funkcij, ki jih deli tudi predogledni popup. */
          var opener = document.activeElement;
          document.body.classList.add("lp-popup-zaklenjeno-telo");
          if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
          /* Ovoj je v tem trenutku (znotraj lpOdpriPotrditveniPopup) še
             hidden, zato .focus() zdaj ne bi prijel — odloži prek
             setTimeout (zanesljivo tudi v ozadju zavihka, drugače kot
             requestAnimationFrame) na trenutek, ko je ovoj že prikazan. */
          setTimeout(function () {
            panel.focus({ preventScroll: true });
          }, 0);

          function lpFokusniElementi() {
            return Array.prototype.slice
              .call(
                panel.querySelectorAll(
                  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                )
              )
              .filter(function (el) {
                return !el.disabled && el.offsetParent !== null;
              });
          }

          function lpUjemFokus(e) {
            if (e.key !== "Tab") return;
            var f = lpFokusniElementi();
            if (!f.length) return;
            var prvi = f[0];
            var zadnji = f[f.length - 1];
            if (e.shiftKey && document.activeElement === prvi) {
              e.preventDefault();
              zadnji.focus();
            } else if (!e.shiftKey && document.activeElement === zadnji) {
              e.preventDefault();
              prvi.focus();
            }
          }
          panel.addEventListener("keydown", lpUjemFokus);

          var ovojEl = panel.parentElement;
          var pospravljeno = false;
          function lpPospraviFokus() {
            if (pospravljeno) return;
            pospravljeno = true;
            document.body.classList.remove("lp-popup-zaklenjeno-telo");
            panel.removeEventListener("keydown", lpUjemFokus);
            opazovalec.disconnect();
            if (opener && typeof opener.focus === "function" && document.contains(opener)) {
              opener.focus();
            }
          }
          var opazovalec = new MutationObserver(function () {
            if (ovojEl.hidden || ovojEl.classList.contains("lp-popup-ovoj--zaprt")) {
              lpPospraviFokus();
            }
          });
          opazovalec.observe(ovojEl, { attributes: true, attributeFilter: ["hidden", "class"] });
        }

        function lpPoveziPredogledniPopupDogodke(panel) {
          var zapri = panel.querySelector("#lp-predogled-zapri");
          if (zapri) zapri.addEventListener("click", lpZapriPopupe);
          var zapriGumb = panel.querySelector("#lp-predogled-zapri-gumb");
          if (zapriGumb) zapriGumb.addEventListener("click", lpZapriPopupe);
          var izberi = panel.querySelector("#lp-predogled-izberi");
          if (izberi) izberi.addEventListener("click", function () {
            var pkg = najdiPaket(lawyerPopupState.previewPackageId);
            if (pkg) {
              var o = opts.glavniEl.querySelector("#lp-predogled-ovoj"); if (o) { o.hidden = true; o.classList.add("lp-popup-ovoj--zaprt"); }
              lawyerPopupState.pendingPackageId = pkg.id;
              lpOdpriPotrditveniPopup(pkg);
            }
          });
          var backdrop = panel.parentElement.querySelector("#lp-predogled-backdrop");
          if (backdrop) {
            backdrop.removeEventListener("click", lpZapriPopupe);
            backdrop.addEventListener("click", lpZapriPopupe, { once: true });
          }
        }

        function lpOdpriPotrditveniPopup(pkg) {
          var ovoj = opts.glavniEl.querySelector("#lp-popup-ovoj");
          if (!ovoj) return;
          // Vsebina popupa — poišči panel in zamenjaj HTML
          var panel = ovoj.querySelector(".lp-popup-panel");
          if (panel) {
            var tmp = document.createElement("div");
            tmp.innerHTML = htmlPotrditveniPopupInner(pkg);
            var novPanel = tmp.querySelector(".lp-popup-panel");
            if (novPanel) {
              panel.innerHTML = novPanel.innerHTML;
              lpPoveziPotrditveniPopupDogodke(panel);
            }
          }
          ovoj.hidden = false;
          ovoj.classList.remove("lp-popup-ovoj--zaprt");
          lpDodajEscapeHandler();
        }

        function lpOdpriPredogledniPopup(pkg) {
          var ovoj = opts.glavniEl.querySelector("#lp-predogled-ovoj");
          if (!ovoj) return;
          var panel = ovoj.querySelector(".lp-popup-panel");
          if (panel) {
            var tmp = document.createElement("div");
            tmp.innerHTML = htmlPredogledPopupInner(pkg);
            var novPanel = tmp.querySelector(".lp-popup-panel");
            if (novPanel) {
              panel.innerHTML = novPanel.innerHTML;
              lpPoveziPredogledniPopupDogodke(panel);
            }
          }
          ovoj.hidden = false;
          ovoj.classList.remove("lp-popup-ovoj--zaprt");
          lpDodajEscapeHandler();
        }

        var lpWidget = opts.glavniEl.querySelector(".lp-kaj-se-bo-zgodilo");
        if (lpWidget) {
          lpWidget.addEventListener("click", function (event) {
            var gumb = event.target.closest("[data-paket-izberi], [data-paket-spremeni], [data-paket-predogled]");
            if (!gumb || !lpWidget.contains(gumb)) return;
            var id =
              gumb.getAttribute("data-paket-izberi") ||
              gumb.getAttribute("data-paket-spremeni") ||
              gumb.getAttribute("data-paket-predogled");
            var pkg = najdiPaket(id);
            if (!pkg) return;
            if (gumb.hasAttribute("data-paket-predogled")) {
              lawyerPopupState.previewPackageId = id;
              lpOdpriPredogledniPopup(pkg);
              return;
            }
            lawyerPopupState.pendingPackageId = id;
            lpOdpriPotrditveniPopup(pkg);
          });
        }

        var lpOdpriCustom = opts.glavniEl.querySelector("#lp-odpri-custom-paket");
        if (lpOdpriCustom) lpOdpriCustom.addEventListener("click", lpOdpriCustomPaket);
        var lpCustomOvoj = opts.glavniEl.querySelector("#lp-custom-paket-ovoj");
        if (lpCustomOvoj) {
          lpCustomOvoj.querySelectorAll("[data-custom-predogled-storitev]").forEach(function (gumb) {
            gumb.addEventListener("click", function () {
              lpPokaziCustomPredogled(gumb.getAttribute("data-custom-predogled-storitev"));
            });
          });
          var customZapri = lpCustomOvoj.querySelector("#lp-custom-paket-zapri");
          if (customZapri) customZapri.addEventListener("click", lpZapriCustomPaket);
          var customBackdrop = lpCustomOvoj.querySelector("#lp-custom-paket-backdrop");
          if (customBackdrop) customBackdrop.addEventListener("click", lpZapriCustomPaket);
          var customPotrdi = lpCustomOvoj.querySelector("#lp-custom-paket-potrdi");
          if (customPotrdi) customPotrdi.addEventListener("click", function () {
            lpPokaziCustomPredogled();
          });
          var customPredogledNazaj = lpCustomOvoj.querySelector("#lp-custom-predogled-nazaj");
          if (customPredogledNazaj) customPredogledNazaj.addEventListener("click", lpNazajNaCustomSestavljalnik);
          var customPredogledZapri = lpCustomOvoj.querySelector("#lp-custom-predogled-zapri");
          if (customPredogledZapri) customPredogledZapri.addEventListener("click", lpZapriCustomPaket);
          var customIzberi = lpCustomOvoj.querySelector("#lp-custom-paket-izberi");
          if (customIzberi) customIzberi.addEventListener("click", function () {
            var previewServiceId = lawyerPopupState.customPreviewServiceId;
            if (previewServiceId) {
              var previewIndex = lawyerPopupState.draftCustomServiceIds.indexOf(previewServiceId);
              if (previewIndex < 0) {
                lawyerPopupState.draftCustomServiceIds.push(previewServiceId);
              } else {
                lawyerPopupState.draftCustomServiceIds.splice(previewIndex, 1);
              }
              lpPosodobiCustomKartico(previewServiceId, previewIndex < 0);
              lpIzrisiCustomPovzetek();
              lpNazajNaCustomSestavljalnik();
              return;
            }
            var snapshot = snapshotCustomPaketa(lawyerPopupState.draftCustomServiceIds);
            if (!snapshot) return;
            plan = izberiPaketInPrikazanegaOdvetnika(
              CUSTOM_LAWYER_PACKAGE_CARD,
              snapshot,
              step.index
            );
            N.shraniOsnutek(plan);
            lpZapriCustomPaket();
            izrisiGlavni();
          });
        }

        var lpOdvetnikKoraki = opts.glavniEl.querySelector("#lp-dinamicni-koraki");
        if (lpOdvetnikKoraki) lpOdvetnikKoraki.addEventListener("click", function (event) {
          var trigger = event.target.closest("#lp-izberi-odvetnika, [data-lp-korak-paket], [data-lp-korak-postopek]");
          if (!trigger || !lpOdvetnikKoraki.contains(trigger)) return;
          lawyerPopupState.activeFlowStep = Number(trigger.getAttribute("data-lp-flow-step")) || 0;
          lpOdvetnikKoraki.querySelectorAll(".lp-korak").forEach(function (korak) {
            korak.classList.toggle("lp-korak--aktiven", Number(korak.getAttribute("data-lp-flow-step")) === lawyerPopupState.activeFlowStep);
          });
          if (trigger.id === "lp-izberi-odvetnika") {
            lpOdpriOdvetnike();
            return;
          }
          var aktivniPkg = paketiZaCarousel().find(function (pkg) {
            return pkg.id === lawyerPopupState.activePackageId;
          }) || null;
          if (trigger.hasAttribute("data-lp-korak-paket")) {
            if (!aktivniPkg) return;
            if (aktivniPkg.isCustomBuilder) lpOdpriCustomPaket();
            else {
              lawyerPopupState.previewPackageId = aktivniPkg.id;
              lpOdpriPredogledniPopup(aktivniPkg);
            }
            return;
          }
          if (trigger.hasAttribute("data-lp-korak-postopek")) {
            if (typeof opts.potrdiVprasanje !== "function") {
              lpPonastaviAktivniKorak();
              return;
            }
            Promise.resolve(opts.potrdiVprasanje({
              naslov: "Začetek postopka",
              opis: aktivniPkg
                ? "Po končni potrditvi bo izbrani odvetnik začel izvajati paket »" + aktivniPkg.title + "«. Pred vašo potrditvijo se nič ne pošlje in postopek se ne začne."
                : "Po končni potrditvi bo izbrani odvetnik začel izvajati izbrani paket. Pred vašo potrditvijo se nič ne pošlje.",
              potrdiBesedilo: "Razumem",
              samoEnGumb: true,
              stil: "primary",
              tema: "odvetnik",
            })).then(lpPonastaviAktivniKorak, lpPonastaviAktivniKorak);
          }
        });
        var lpOdvetnikiOvoj = opts.glavniEl.querySelector("#lp-odvetniki-ovoj");
        if (lpOdvetnikiOvoj) {
          lpOdvetnikiOvoj.querySelectorAll("[data-odvetnik-vidnost]").forEach(function (stikalo) {
            stikalo.addEventListener("click", function () {
              var lawyerId = stikalo.getAttribute("data-odvetnik-vidnost");
              var aktualniStep = N.najdiKorak(plan, step.index) || step;
              var vidni = prikazaniOdvetniki(aktualniStep);
              var jeViden = vidni.indexOf(lawyerId) >= 0;
              var noviVidni = jeViden
                ? vidni.filter(function (id) { return id !== lawyerId; })
                : vidni.concat(lawyerId);
              if (typeof N.posodobiPrikazaneOdvetnike === "function") {
                plan = N.posodobiPrikazaneOdvetnike(plan, step.index, noviVidni);
                N.shraniOsnutek(plan);
              }
              lawyerPopupState.lawyerVisibilityChanged = true;
              stikalo.setAttribute("aria-checked", jeViden ? "false" : "true");
              var label = stikalo.querySelector(".lp-odvetnik-izbira__switch-label");
              if (label) label.textContent = "Prikaži v seznamu";
              var kartica = stikalo.closest("[data-odvetnik-kartica]");
              if (kartica) kartica.classList.toggle("lp-odvetnik-izbira__kartica--skrita", jeViden);
            });
          });
          lpOdvetnikiOvoj.querySelectorAll("[data-odvetnik-profil]").forEach(function (gumb) {
            gumb.addEventListener("click", function () {
              lpPokaziProfilOdvetnika(gumb.getAttribute("data-odvetnik-profil"));
            });
          });
          var lpOdvetnikiZapri = lpOdvetnikiOvoj.querySelector("#lp-odvetniki-zapri");
          if (lpOdvetnikiZapri) lpOdvetnikiZapri.addEventListener("click", lpZapriOdvetnike);
          var lpOdvetnikProfilZapri = lpOdvetnikiOvoj.querySelector("#lp-odvetnik-profil-zapri");
          if (lpOdvetnikProfilZapri) lpOdvetnikProfilZapri.addEventListener("click", lpZapriOdvetnike);
          var lpOdvetnikiBackdrop = lpOdvetnikiOvoj.querySelector("#lp-odvetniki-backdrop");
          if (lpOdvetnikiBackdrop) lpOdvetnikiBackdrop.addEventListener("click", lpZapriOdvetnike);
          var lpOdvetnikNazaj = lpOdvetnikiOvoj.querySelector("#lp-odvetnik-profil-nazaj");
          if (lpOdvetnikNazaj) lpOdvetnikNazaj.addEventListener("click", lpNazajNaSeznamOdvetnikov);
          var lpOdvetnikIzberi = lpOdvetnikiOvoj.querySelector("#lp-odvetnik-profil-izberi");
          if (lpOdvetnikIzberi) lpOdvetnikIzberi.addEventListener("click", function () {
            var lawyer = najdiProfilOdvetnika(lawyerPopupState.previewLawyerId);
            if (!lawyer) return;
            var aktualniStep = N.najdiKorak(plan, step.index) || step;
            var vidni = prikazaniOdvetniki(aktualniStep);
            if (vidni.indexOf(lawyer.id) < 0 && typeof N.posodobiPrikazaneOdvetnike === "function") {
              plan = N.posodobiPrikazaneOdvetnike(plan, step.index, vidni.concat(lawyer.id));
            }
            plan = typeof N.posodobiOdvetnika === "function"
              ? N.posodobiOdvetnika(plan, step.index, {
                  name: lawyer.name,
                  officeName: lawyer.officeName,
                  email: lawyer.email,
                  phone: lawyer.phone,
                  availableHandoffDays: lawyer.availableHandoffDays,
                  attachmentRequirements: lawyer.attachmentRequirements,
                }, lawyer.id)
              : plan;
            shraniZahtevePrilogIzbranegaOdvetnika(lawyer);
            N.shraniOsnutek(plan);
            lawyerPopupState.lawyerVisibilityChanged = false;
            lpZapriOdvetnike();
            izrisiGlavni();
          });
        }

        var lpFilterOvoj = opts.glavniEl.querySelector("#lp-filter-ponudb-ovoj");
        if (lpFilterOvoj) {
          var lpFilterOdpri = opts.glavniEl.querySelector("#lp-filter-ponudb-odpri");
          if (lpFilterOdpri) lpFilterOdpri.addEventListener("click", lpOdpriFilterPonudb);
          var lpFilterPriporoceno = opts.glavniEl.querySelector("#lp-filter-priporoceno");
          if (lpFilterPriporoceno) lpFilterPriporoceno.addEventListener("click", lpUporabiPriporoceniFilter);

          var lpFilterZapri = lpFilterOvoj.querySelector("#lp-filter-ponudb-zapri");
          if (lpFilterZapri) lpFilterZapri.addEventListener("click", lpZapriFilterPonudb);
          var lpFilterBackdrop = lpFilterOvoj.querySelector("#lp-filter-ponudb-backdrop");
          if (lpFilterBackdrop) lpFilterBackdrop.addEventListener("click", lpZapriFilterPonudb);
          var lpFilterUporabi = lpFilterOvoj.querySelector("#lp-filter-ponudb-uporabi");
          if (lpFilterUporabi) lpFilterUporabi.addEventListener("click", lpPotrdiFilterPonudb);

          var lpFilterDodaj = lpFilterOvoj.querySelector("#lp-filter-ponudb-dodaj");
          if (lpFilterDodaj) lpFilterDodaj.addEventListener("click", lpPokaziDodajOdvetnika);
          var lpFilterNazaj = lpFilterOvoj.querySelector("#lp-filter-ponudb-nazaj");
          if (lpFilterNazaj) lpFilterNazaj.addEventListener("click", lpNazajIzDodajOdvetnika);
          var lpFilterDodajPotrdi = lpFilterOvoj.querySelector("#lp-filter-ponudb-dodaj-potrdi");
          if (lpFilterDodajPotrdi) lpFilterDodajPotrdi.addEventListener("click", lpDodajOdvetnikaVDraft);

          var lpFilterNacinEl = lpFilterOvoj.querySelector("#lp-filter-ponudb-nacin");
          if (lpFilterNacinEl) lpFilterNacinEl.addEventListener("change", function (e) {
            var input = e.target && e.target.closest ? e.target.closest("[data-lp-filter-nacin]") : null;
            if (!input || !lawyerPopupState.filterDraft) return;
            if (input.value === "single_lawyer") {
              var prvi = (lawyerPopupState.filterDraft.lawyerIds && lawyerPopupState.filterDraft.lawyerIds[0]) || null;
              lawyerPopupState.filterDraft.mode = "single_lawyer";
              lawyerPopupState.filterDraft.singleLawyerId = prvi;
              lawyerPopupState.filterDraft.lawyerIds = prvi ? [prvi] : [];
            } else {
              lawyerPopupState.filterDraft.mode = "best_match";
              lawyerPopupState.filterDraft.singleLawyerId = null;
            }
            lpIzrisiFilterPonudb(step);
          });

          var lpFilterOdvetnikiEl = lpFilterOvoj.querySelector("#lp-filter-ponudb-odvetniki");
          if (lpFilterOdvetnikiEl) lpFilterOdvetnikiEl.addEventListener("change", function (e) {
            var input = e.target && e.target.closest ? e.target.closest("[data-lp-filter-odvetnik]") : null;
            if (!input || !lawyerPopupState.filterDraft) return;
            var id = input.value;
            var draft = lawyerPopupState.filterDraft;
            if (draft.mode === "single_lawyer") {
              draft.singleLawyerId = id;
              draft.lawyerIds = [id];
            } else {
              var idx = draft.lawyerIds.indexOf(id);
              if (input.checked) { if (idx < 0) draft.lawyerIds.push(id); }
              else if (idx >= 0) { draft.lawyerIds.splice(idx, 1); }
            }
            lpIzrisiFilterPonudb(step);
          });
        }

      }
    }

    function pokaziPrilogeNapako(tekst) {
      prilogeNapaka = tekst || "";
      var el = opts.glavniEl.querySelector("#vk-priloge-napaka");
      if (!el) return;
      if (!prilogeNapaka) {
        el.hidden = true;
        el.textContent = "";
        return;
      }
      el.hidden = false;
      el.textContent = prilogeNapaka;
    }

    function pokaziUndoToast(priloga) {
      var obstojeci = document.getElementById("vk-undo-toast");
      if (obstojeci) obstojeci.remove();
      var toast = document.createElement("div");
      toast.id = "vk-undo-toast";
      toast.className = "vk-undo-toast";
      toast.setAttribute("role", "status");
      toast.innerHTML =
        "<span>Račun je odstranjen.</span>" +
        '<button type="button" id="vk-undo-btn">Razveljavi</button>';
      document.body.appendChild(toast);
      clearTimeout(undoTimer);
      undoPriloga = priloga;
      document.getElementById("vk-undo-btn").addEventListener("click", function () {
        if (undoPriloga) {
          prilogeKoraka.push(undoPriloga);
          undoPriloga = null;
          sinhronizirajPrilogeVKorak1();
          izrisiGlavni();
        }
        toast.remove();
        clearTimeout(undoTimer);
      });
      undoTimer = setTimeout(function () {
        undoPriloga = null;
        toast.remove();
      }, 5000);
    }

    async function dodajDatotekePrilog(fileList) {
      var files = Array.prototype.slice.call(fileList || []);
      if (!files.length || !PV) return;
      pokaziPrilogeNapako("");
      var k1 = opts.podatkiKorak1 || {};
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var v = PV.validirajDatoteko(file, prilogeKoraka);
        if (v.napaka) {
          pokaziPrilogeNapako(v.napaka);
          continue;
        }
        var imeLower = String(file.name || "").toLowerCase();
        var tipLower = String(file.type || "").toLowerCase();
        if (
          tipLower.indexOf("heic") >= 0 ||
          tipLower.indexOf("heif") >= 0 ||
          /\.heic$|\.heif$/i.test(imeLower)
        ) {
          pokaziPrilogeNapako(
            "HEIC/HEIF fotografije trenutno niso pretvorjene. Izvozite kot JPG ali PNG."
          );
          continue;
        }
        var id = PV.novId();
        var kanali = privzetiKanaliNovePriloge();
        var temp = {
          id: id,
          attachmentId: id,
          groupId: id,
          documentType: "invoice",
          originalFileName: file.name || "Račun",
          mimeType: file.type || "",
          sizeBytes: file.size,
          storagePath: null,
          status: "uploading",
          deliveryChannels: kanali,
          origin: "manual_attachment",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          progress: 10,
          _file: file,
        };
        prilogeKoraka.push(temp);
        izrisiGlavni();
        try {
          if (typeof opts.naloziPrilogo === "function") {
            temp.status = "processing";
            temp.progress = 45;
            izrisiGlavni();
            var rez = await opts.naloziPrilogo(file);
            if (rez && rez.napaka) throw new Error(rez.napaka);
            temp.storagePath = rez.pot;
            temp.status = "ready";
            temp.progress = 100;
            temp.updatedAt = new Date().toISOString();
            delete temp._file;
          } else {
            temp.storagePath = "local/" + id + "/" + (file.name || "racun");
            temp.status = "ready";
            temp.progress = 100;
          }
        } catch (err) {
          temp.status = "error";
          temp.progress = 0;
          temp.napaka = (err && err.message) || "Nalaganje ni uspelo.";
          pokaziPrilogeNapako(temp.napaka);
        }
        sinhronizirajPrilogeVKorak1();
        izrisiGlavni();
      }
    }

    function osveziKanalGumbV2(gumb, vkljucen) {
      if (!gumb) return;
      gumb.setAttribute("aria-pressed", vkljucen ? "true" : "false");
      var ikona = gumb.querySelector(".vk-kanal-gumb-v2__ikona");
      if (!ikona) return;
      var vrsta = gumb.getAttribute("data-kanal");
      var jeSms = vrsta === "sms";
      ikona.innerHTML = vkljucen
        ? IKONA_KLJUKICA
        : jeSms
          ? IKONA_SMS
          : IKONA_EMAIL;
    }

    function posodobiStatusnoBesediloPriloge(vrstica, p, imaTel, imaEmail) {
      if (!vrstica || !p || p.status !== "ready") return;
      var statusEl = vrstica.querySelector(".vk-racun-kartica__status");
      if (!statusEl) return;
      var velikostTekst = "";
      if (PV && PV.formatVelikost && p.sizeBytes != null) {
        velikostTekst = PV.formatVelikost(p.sizeBytes);
      }
      statusEl.textContent =
        statusnoBesediloPriloge(p, imaTel, imaEmail) +
        (velikostTekst ? " · " + velikostTekst : "");
    }

    function osveziSmsPredogled() {
      var step = N.najdiKorak(plan, aktivenIndex);
      if (!step || !opts.glavniEl) return;
      var smsOsnova = step.finalMessage || step.generatedMessage || "";
      var novoBesedilo =
        PV && PV.sestaviSmsZPrilogami
          ? PV.sestaviSmsZPrilogami(smsOsnova, prilogeKoraka, smsPaketZeton)
          : smsOsnova;
      var novaVsebina = String(novoBesedilo).trim()
        ? esc(novoBesedilo)
        : '<span class="sms-preview__prazno">Sporočilo še ni sestavljeno.</span>';
      var viewport = opts.glavniEl.querySelector(".sms-preview__viewport");
      if (viewport && viewport.tagName === "TEXTAREA") {
        if (document.activeElement !== viewport && viewport.value !== smsOsnova) {
          viewport.value = smsOsnova;
        }
      } else if (viewport && viewport.innerHTML !== novaVsebina) {
        viewport.innerHTML = novaVsebina;
      }
      var novaMeta = gsmLabel(Gsm, novoBesedilo);
      var meta = opts.glavniEl.querySelector(".sms-preview__meta");
      if (meta && meta.textContent !== novaMeta) {
        meta.textContent = novaMeta;
      }
    }

    var lightboxEl = document.getElementById("lightbox");
    var lightboxSlikaEl = document.getElementById("lightbox-slika");
    var lightboxZapriEl = document.getElementById("lightbox-zapri");
    var lightboxOzicen = false;

    function zapriPrilogeLightbox() {
      if (!lightboxEl) return;
      lightboxEl.hidden = true;
      if (lightboxSlikaEl) lightboxSlikaEl.src = "";
    }

    function odpriPrilogeLightbox(url) {
      if (!lightboxEl || !lightboxSlikaEl) return;
      lightboxSlikaEl.src = url;
      lightboxEl.hidden = false;
      if (!lightboxOzicen) {
        lightboxOzicen = true;
        if (lightboxZapriEl) {
          lightboxZapriEl.addEventListener("click", zapriPrilogeLightbox);
        }
        lightboxEl.addEventListener("click", function (ev) {
          if (ev.target === lightboxEl) zapriPrilogeLightbox();
        });
        document.addEventListener("keydown", function (ev) {
          if (ev.key === "Escape" && !lightboxEl.hidden) {
            zapriPrilogeLightbox();
          }
        });
      }
    }

    function poveziPrilogeDogodke() {
      var kamera = opts.glavniEl.querySelector("#vk-priloge-kamera");
      var datoteka = opts.glavniEl.querySelector("#vk-priloge-datoteka");
      var gumbSlikaj = opts.glavniEl.querySelector("#vk-priloge-slikaj");
      var gumbUvozi = opts.glavniEl.querySelector("#vk-priloge-uvozi");
      if (typeof opts.pridobiUrlPriloge === "function") {
        opts.glavniEl
          .querySelectorAll("[data-priloga-predogled]")
          .forEach(function (predogled) {
            var id = predogled.getAttribute("data-priloga-predogled");
            var priloga = prilogeKoraka.find(function (p) {
              return p.id === id;
            });
            if (!priloga || !priloga.storagePath) return;
            var jeSlika = jeSlikaPriloga(priloga);
            if (jeSlika) {
              opts.pridobiUrlPriloge(priloga.storagePath).then(function (rez) {
                if (!predogled.isConnected || !rez || !rez.url) return;
                var img = document.createElement("img");
                img.src = rez.url;
                img.alt = "";
                predogled.classList.add(
                  "vk-racun-kartica__predogled--slika"
                );
                predogled.replaceChildren(img);
              });
            }
            predogled.classList.add("vk-racun-kartica__predogled--klik");
            predogled.setAttribute("role", "button");
            predogled.setAttribute("tabindex", "0");
            predogled.setAttribute(
              "aria-label",
              "Odpri predogled " + (priloga.originalFileName || "računa")
            );
            function odpriPredogled() {
              opts.pridobiUrlPriloge(priloga.storagePath).then(function (rez) {
                if (!rez || !rez.url) return;
                if (jeSlika) {
                  odpriPrilogeLightbox(rez.url);
                } else {
                  window.open(rez.url, "_blank");
                }
              });
            }
            predogled.addEventListener("click", odpriPredogled);
            predogled.addEventListener("keydown", function (ev) {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                odpriPredogled();
              }
            });
          });
      }
      if (gumbSlikaj && kamera) {
        gumbSlikaj.addEventListener("click", function () {
          kamera.click();
        });
      }
      if (gumbUvozi && datoteka) {
        gumbUvozi.addEventListener("click", function () {
          datoteka.click();
        });
      }
      if (kamera) {
        kamera.addEventListener("change", function () {
          dodajDatotekePrilog(kamera.files);
          kamera.value = "";
        });
      }
      if (datoteka) {
        datoteka.addEventListener("change", function () {
          dodajDatotekePrilog(datoteka.files);
          datoteka.value = "";
        });
      }

      opts.glavniEl.querySelectorAll("[data-priloga-odstrani]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-priloga-odstrani");
          var idx = prilogeKoraka.findIndex(function (p) {
            return p.id === id;
          });
          if (idx < 0) return;
          var odstranjen = prilogeKoraka.splice(idx, 1)[0];
          sinhronizirajPrilogeVKorak1();
          izrisiGlavni();
          pokaziUndoToast(odstranjen);
        });
      });

      opts.glavniEl.querySelectorAll("[data-racun-kanal-vsi]").forEach(function (gumb) {
        gumb.addEventListener("click", function () {
          var kanal = gumb.getAttribute("data-racun-kanal-vsi");
          if (gumb.getAttribute("aria-disabled") === "true") {
            if (typeof opts.potrdiVprasanje === "function") {
              opts.potrdiVprasanje({
                naslov:
                  kanal === "sms"
                    ? "Dolžnik nima telefonske številke."
                    : "Dolžnik nima e-poštnega naslova.",
                potrdiBesedilo: "V redu",
                samoEnGumb: true,
                stil: "primary",
              });
            }
            return;
          }
          var imaTel = Boolean(opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika);
          var imaEmail = Boolean(opts.podatkiKorak1 && opts.podatkiKorak1.emailDolznika);
          var novi = skupniKanaliRacunov(imaTel, imaEmail);
          novi[kanal] = !novi[kanal];
          if (!novi.sms && !novi.email) return;
          prilogeKoraka.forEach(function (p) {
            p.deliveryChannels = { sms: Boolean(novi.sms), email: Boolean(novi.email) };
            p.updatedAt = new Date().toISOString();
          });
          sinhronizirajPrilogeVKorak1();
          izrisiGlavni();
          osveziSmsPredogled();
        });
      });

      if (prilogeNapaka) pokaziPrilogeNapako(prilogeNapaka);
    }

    function poveziKontaktneDogodke() {
      var step = N.najdiKorak(plan, aktivenIndex);
      if (!step) return;
      if (!step.customContacts) step.customContacts = { phoneNumbers: [], emailAddresses: [] };
      var cc = step.customContacts;

      // Odpri ali zapri majhno polje za dodajanje kontakta.
      opts.glavniEl.querySelectorAll("[data-kontakt-odpri-vnos]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var vrsta = btn.getAttribute("data-kontakt-odpri-vnos");
          kontaktDodajOdprt[vrsta] = true;
          izrisiGlavni();
          window.requestAnimationFrame(function () {
            var vnosEl = opts.glavniEl.querySelector('[data-kontakt-dodaj-vnos="' + vrsta + '"]');
            if (!vnosEl) return;
            try {
              vnosEl.focus({ preventScroll: true });
            } catch (_e) {
              vnosEl.focus();
            }
          });
        });
      });

      opts.glavniEl.querySelectorAll("[data-kontakt-dodaj-preklici]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var vrsta = btn.getAttribute("data-kontakt-dodaj-preklici");
          kontaktDodajOdprt[vrsta] = false;
          izrisiGlavni();
        });
      });

      // Toggle primarni kontakt
      opts.glavniEl.querySelectorAll("[data-kontakt-toggle-primarni]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var vrsta = btn.getAttribute("data-kontakt-toggle-primarni");
          if (!step.primaryContacts) step.primaryContacts = { sms: true, email: true };
          step.primaryContacts[vrsta] = !step.primaryContacts[vrsta];
          kontaktDodajOdprt[vrsta] = !step.primaryContacts[vrsta];
          shrani();
          izrisiGlavni();
        });
      });

      // Dodaj dodatni kontakt
      opts.glavniEl.querySelectorAll("[data-kontakt-dodaj-gumb]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var vrsta = btn.getAttribute("data-kontakt-dodaj-gumb");
          var vnosEl = opts.glavniEl.querySelector('[data-kontakt-dodaj-vnos="' + vrsta + '"]');
          if (!vnosEl) return;
          var vrednost = String(vnosEl.value || "").trim();
          if (!vrednost) return;
          var seznam = vrsta === "sms" ? cc.phoneNumbers : cc.emailAddresses;
          if (seznam.indexOf(vrednost) < 0) {
            seznam.push(vrednost);
            shrani();
          }
          kontaktDodajOdprt[vrsta] = false;
          izrisiGlavni();
        });
      });

      // Enter v input polju
      opts.glavniEl.querySelectorAll("[data-kontakt-dodaj-vnos]").forEach(function (vnosEl) {
        vnosEl.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            var vrsta = vnosEl.getAttribute("data-kontakt-dodaj-vnos");
            var gumb = opts.glavniEl.querySelector('[data-kontakt-dodaj-gumb="' + vrsta + '"]');
            if (gumb) gumb.click();
          }
        });
      });

      // Odstrani dodaten kontakt
      opts.glavniEl.querySelectorAll("[data-kontakt-odstrani]").forEach(function (xBtn) {
        xBtn.addEventListener("click", function () {
          var vrsta = xBtn.getAttribute("data-kontakt-odstrani");
          var value = xBtn.getAttribute("data-value");
          var seznam = vrsta === "sms" ? cc.phoneNumbers : cc.emailAddresses;
          var idx = seznam.indexOf(value);
          if (idx >= 0) {
            seznam.splice(idx, 1);
            shrani();
            izrisiGlavni();
          }
        });
      });
    }

    function besediloGumbaPotrdi(step) {
      var naslednjiKorak = N.najdiNaslednjiVkljuceniKorak(plan, step.index);
      if (naslednjiKorak) {
        var red = 0;
        var koraki = plan.steps || [];
        for (var ri = 0; ri < koraki.length; ri++) {
          if (!koraki[ri].isExcluded) red++;
          if (koraki[ri].index === naslednjiKorak.index) break;
        }
        return "Shrani in nadaljuj na " + red + ". korak\u00a0→";
      }
      return "Shrani in dokončaj načrt →";
    }

    var mojiPredlogiPromise = null;

    function nalozimMojePredlogeAsync() {
      if (mojiPredlogiPromise) return mojiPredlogiPromise;
      mojiPredlogiPromise = new Promise(function (resolve) {
        function beriIzLocalStorage(kljuc) {
          try {
            var surovo = localStorage.getItem(kljuc);
            if (!surovo) return [];
            var seznam = JSON.parse(surovo);
            if (!Array.isArray(seznam)) return [];
            return seznam
              .filter(function (p) {
                return p && typeof p.besedilo === "string" && p.besedilo.trim();
              })
              .map(function (p) {
                return {
                  id: String(p.id || "moj-" + Date.now()),
                  naslov: String(p.naslov || "Moj predlog"),
                  besedilo: String(p.besedilo).slice(0, 1000),
                  jeMoj: true,
                  toneId: p.toneId || null,
                  language: p.language || "de",
                  source: "user",
                  order: Number(p.order) || null,
                  isRecommended: false,
                };
              });
          } catch (napaka) {
            return [];
          }
        }
        function zdruziBrezPodvajanja(seznami) {
          var videni = {};
          var izhod = [];
          seznami.forEach(function (seznam) {
            seznam.forEach(function (p) {
              if (videni[p.id]) return;
              videni[p.id] = true;
              izhod.push(p);
            });
          });
          return izhod;
        }

        var osnovniKljuc = "neplacilo-moji-predlogi";
        if (
          typeof supabaseKlient !== "undefined" &&
          supabaseKlient &&
          supabaseKlient.auth
        ) {
          supabaseKlient.auth
            .getSession()
            .then(function (res) {
              var uid =
                res &&
                res.data &&
                res.data.session &&
                res.data.session.user &&
                res.data.session.user.id;
              var brezUid = beriIzLocalStorage(osnovniKljuc);
              var zUid = uid
                ? beriIzLocalStorage(osnovniKljuc + "-" + uid)
                : [];
              resolve(zdruziBrezPodvajanja([zUid, brezUid]));
            })
            .catch(function () {
              resolve(beriIzLocalStorage(osnovniKljuc));
            });
        } else {
          resolve(beriIzLocalStorage(osnovniKljuc));
        }
      });
      return mojiPredlogiPromise;
    }

    function odpriPredogledPredloge(predlog, onUporabi) {
      var modal = document.getElementById("predloge3-predogled");
      if (!modal) { if (onUporabi) onUporabi(); return; }
      var naslovEl = document.getElementById("predloge3-predogled-naslov");
      var besediloEl = document.getElementById("predloge3-predogled-besedilo");
      var uporabiBtn = document.getElementById("predloge3-predogled-uporabi");
      var zapriBtn = document.getElementById("predloge3-predogled-zapri");
      var ponastaviBtn = document.getElementById("predloge3-predogled-ponastavi");
      var backdrop = document.getElementById("predloge3-predogled-backdrop");
      var original = predlog.besedilo || "";

      if (naslovEl) naslovEl.textContent = predlog.naslov || "—";
      if (besediloEl) besediloEl.value = original;

      function zapri() {
        modal.hidden = true;
        document.body.style.overflow = "";
        if (uporabiBtn) uporabiBtn.removeEventListener("click", onApply);
        if (zapriBtn) zapriBtn.removeEventListener("click", zapri);
        if (backdrop) backdrop.removeEventListener("click", zapri);
        if (ponastaviBtn) ponastaviBtn.removeEventListener("click", ponastavi);
      }

      function ponastavi() {
        if (besediloEl) besediloEl.value = original;
      }

      function onApply() {
        var novoBesedilo = besediloEl ? besediloEl.value : "";
        var jeSpremenjeno = String(novoBesedilo || "").trim() !== String(original || "").trim();
        if (jeSpremenjeno && root.potrdiVprasanje && typeof root.potrdiVprasanje === "function") {
          root.potrdiVprasanje({
            naslov: "Shrani spremembe?",
            opis: "Besedilo predloge ste spremenili.",
            potrdiBesedilo: "Shrani in uporabi",
            prekliciBesedilo: "Prekliči",
            stil: "primary",
          }).then(function (potrjeno) {
            if (!potrjeno) return;
            zapri();
            if (onUporabi) onUporabi(novoBesedilo);
          });
        } else {
          zapri();
          if (onUporabi) onUporabi(novoBesedilo);
        }
      }

      if (uporabiBtn) {
        uporabiBtn.textContent = "Uporabi";
        uporabiBtn.addEventListener("click", onApply);
      }
      if (zapriBtn) zapriBtn.addEventListener("click", zapri);
      if (backdrop) backdrop.addEventListener("click", zapri);
      if (ponastaviBtn) ponastaviBtn.addEventListener("click", ponastavi);

      function onEscape(ev) {
        if (ev.key === "Escape") { zapri(); document.removeEventListener("keydown", onEscape); }
      }
      document.addEventListener("keydown", onEscape);

      var origZapri = zapri;
      zapri = function () { document.removeEventListener("keydown", onEscape); origZapri(); };

      modal.hidden = false;
      document.body.style.overflow = "hidden";
    }

    function izrisiSeznamPredlog(predlogi, ovoj, drsnik, ta) {
      if (!predlogi || !predlogi.length) {
        ovoj.hidden = true;
        return;
      }

      drsnik.innerHTML = "";
      predlogi.forEach(function (predlog) {
        var kartica = document.createElement("button");
        kartica.type = "button";
        kartica.className = "opomin-potrdi-predloge__kartica";
        kartica.setAttribute("role", "listitem");
        if (
          String(ta.value || "").trim() ===
          String(predlog.besedilo || "").trim()
        ) {
          kartica.classList.add("opomin-potrdi-predloge__kartica--izbrana");
        }
        kartica.innerHTML =
          '<span class="opomin-potrdi-predloge__kartica-ikona" aria-hidden="true">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>' +
          "</span>" +
          '<span class="opomin-potrdi-predloge__kartica-vsebina">' +
          '<span class="opomin-potrdi-predloge__kartica-naslov"></span>' +
          '<span class="opomin-potrdi-predloge__kartica-opis"></span>' +
          "</span>";
        kartica.querySelector(
          ".opomin-potrdi-predloge__kartica-naslov"
        ).textContent = predlog.naslov;
        kartica.querySelector(
          ".opomin-potrdi-predloge__kartica-opis"
        ).textContent = predlog.besedilo;
        kartica.addEventListener("click", function () {
          odpriPredogledPredloge(predlog, function (novoBesedilo) {
            ta.value = String(novoBesedilo || predlog.besedilo || "").slice(0, 1000);
            ta.dispatchEvent(new Event("input", { bubbles: true }));
            drsnik
              .querySelectorAll(".opomin-potrdi-predloge__kartica--izbrana")
              .forEach(function (k) {
                k.classList.remove("opomin-potrdi-predloge__kartica--izbrana");
              });
            kartica.classList.add("opomin-potrdi-predloge__kartica--izbrana");
          });
        });
        drsnik.appendChild(kartica);
      });

      ovoj.hidden = false;

      // Indikator pikic — posodobi ob scrollu
      var indikator = document.getElementById((ovoj.id || "opomin-glavni-predloge") + "-indikator");
      if (indikator) {
        var pike = indikator.querySelectorAll(".opomin-potrdi-predloge__pika");
        function posodobiIndikator() {
          if (!pike.length) return;
          var w = drsnik.offsetWidth;
          if (w <= 0) return;
          var idx = Math.round(drsnik.scrollLeft / w);
          idx = Math.max(0, Math.min(pike.length - 1, idx));
          pike.forEach(function (p, i) {
            p.classList.toggle("opomin-potrdi-predloge__pika--aktivna", i === idx);
          });
        }
        drsnik.addEventListener("scroll", posodobiIndikator, { passive: true });
        posodobiIndikator();
      }

      ta.addEventListener("input", function () {
        drsnik.querySelectorAll(".opomin-potrdi-predloge__kartica").forEach(
          function (kartica, i) {
            var ujema =
              String(ta.value || "").trim() ===
              String((predlogi[i] || {}).besedilo || "").trim();
            kartica.classList.toggle(
              "opomin-potrdi-predloge__kartica--izbrana",
              ujema
            );
          }
        );
      });
    }

    function izrisiKompaktnePredloge(step, ta, gsmEl, ovojId, drsnikId) {
      var ovoj = document.getElementById(ovojId || "opomin-potrdi-predloge");
      var drsnik = document.getElementById(
        drsnikId || "opomin-potrdi-predloge-drsnik"
      );
      if (!ovoj || !drsnik || !window.UJTonPredloge) return;

      var jezik = "de";
      var osnovni = window.UJTonPredloge.sestaviSistemskePredloge(
        opts.podatkiKorak1,
        jezik
      );
      var tonId = step.toneId || plan.toneId;
      var predlogi = window.UJTonPredloge.filtrirajPredloge(
        osnovni,
        tonId,
        jezik
      );

      izrisiSeznamPredlog(predlogi, ovoj, drsnik, ta);

      var gumbVec = document.getElementById(
        (ovojId || "opomin-potrdi-predloge") + "-vec"
      );
      if (gumbVec && !gumbVec._ujVezano) {
        gumbVec._ujVezano = true;
        gumbVec.addEventListener("click", function () {
          if (!window.inicializirajPredlogiUrejevalnik) return;
          var api = window.inicializirajPredlogiUrejevalnik({
            podatkiKorak1: opts.podatkiKorak1,
            toneId: tonId,
            jezik: jezik,
            potrdiVprasanje: opts.potrdiVprasanje,
            onUporabi: function (predlog) {
              ta.value = String(predlog.besedilo || "").slice(0, 1000);
              ta.dispatchEvent(new Event("input", { bubbles: true }));
            },
            rokSheetApi: rokSheetApi,
            obrocnoSheetApi: obrocnoSheetApi,
            trrSheetApi: trrSheetApi,
            pokaziNapako: opts.pokaziNapako,
            getPaymentDeadline: function () { return paymentDeadline; },
            getInstallmentPlan: function () { return installmentPlan; },
            getTrrAccount: function () { return trrAccount; },
          });
          api.odpri();
        });
      }

      nalozimMojePredlogeAsync().then(function (mojiPredlogi) {
        if (!mojiPredlogi || !mojiPredlogi.length) return;
        var ovojZdaj = document.getElementById(
          ovojId || "opomin-potrdi-predloge"
        );
        var drsnikZdaj = document.getElementById(
          drsnikId || "opomin-potrdi-predloge-drsnik"
        );
        if (!ovojZdaj || !drsnikZdaj) return;
        var kombinirano = osnovni.concat(mojiPredlogi);
        var predlogiZdaj = window.UJTonPredloge.filtrirajPredloge(
          kombinirano,
          tonId,
          jezik
        );
        izrisiSeznamPredlog(predlogiZdaj, ovojZdaj, drsnikZdaj, ta);
      });
    }

    /* ========== Končni pregled 10. koraka "Predaja odvetniku" (Faza C) ==========
       Ločen, namenski zaslon – NI generična SMS-potrditev, NI izbira paketa.
       Bere IZKLJUČNO iz step.lawyerHandoff.preparedSnapshot (nikoli iz živih
       podatkov, trenutnega seznama prilog ali activePackageId), da uporabnik
       vidno natanko tisto različico paketa, ki je bila pripravljena. */

    function statusOdzivaMeta(status) {
      switch (status) {
        case "no_response":
          return { label: "Brez odziva", cls: "koralno" };
        case "responded":
          return { label: "Dolžnik se je odzval", cls: "nevtralno" };
        case "partially_paid":
          return { label: "Delno plačano", cls: "nevtralno" };
        case "paid":
          return { label: "Plačano", cls: "teal" };
        default:
          return { label: "Stanje ni potrjeno", cls: "nevtralno" };
      }
    }

    function predajaDniOd(iso) {
      if (!iso) return null;
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
    }

    function htmlPredajaRazsirjenoPolje(label, vrednost) {
      if (!vrednost) return "";
      return (
        '<div class="opomin-predaja-pregled__razsirjeno-vrstica"><span>' +
        esc(label) +
        "</span><span>" +
        esc(vrednost) +
        "</span></div>"
      );
    }

    function htmlPredajaProcesKorak(st, ikonaHtml, naslov, podtekst) {
      return (
        '<div class="opomin-predaja-pregled__proces-korak">' +
        '<span class="opomin-predaja-pregled__proces-st" aria-hidden="true">' +
        st +
        "</span>" +
        '<span class="opomin-predaja-pregled__proces-ikona-krog" aria-hidden="true">' +
        ikonaHtml +
        "</span>" +
        '<span class="opomin-predaja-pregled__proces-naziv" data-pregled-auto-fit="block" data-min-font="8">' +
        esc(naslov) +
        "</span>" +
        '<span class="opomin-predaja-pregled__proces-podtekst" data-pregled-auto-fit="block" data-min-font="7.5">' +
        esc(podtekst) +
        "</span>" +
        "</div>"
      );
    }

    /* --- Bottom-sheet: podrobnosti enega zgodovinskega opomina (samo iz snapshota) --- */
    function zagotoviPredajaZgodovinaSheet() {
      var el = document.getElementById("opomin-predaja-zgodovina-sheet");
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-predaja-zgodovina-sheet";
      el.className = "opomin-cas-sheet";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opomin-cas-sheet__backdrop" id="opomin-predaja-zgodovina-sheet-backdrop" aria-label="Zapri"></button>' +
        '<div class="opomin-cas-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="opomin-predaja-zgodovina-sheet-naslov">' +
        '<div class="opomin-cas-sheet__rocaj" aria-hidden="true"></div>' +
        '<div class="opomin-cas-sheet__glava">' +
        '<h2 class="opomin-cas-sheet__naslov" id="opomin-predaja-zgodovina-sheet-naslov" tabindex="-1">Opomin</h2>' +
        '<button type="button" class="opomin-cas-sheet__zapri" id="opomin-predaja-zgodovina-sheet-zapri" aria-label="Zapri"><span aria-hidden="true">×</span></button>' +
        "</div>" +
        '<div class="opomin-cas-sheet__telo" id="opomin-predaja-zgodovina-sheet-telo"></div>' +
        "</div>";
      document.body.appendChild(el);
      function zapri() {
        el.hidden = true;
        document.documentElement.classList.remove("uj-modal-odprt");
        document.body.classList.remove("uj-modal-odprt");
      }
      el.querySelector("#opomin-predaja-zgodovina-sheet-backdrop").addEventListener("click", zapri);
      el.querySelector("#opomin-predaja-zgodovina-sheet-zapri").addEventListener("click", zapri);
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") zapri();
      });
      el._zapri = zapri;
      return el;
    }

    function razlagaTonaKoraka(toneId, tonOznaka, jeBrezOdziva) {
      var ton = String(toneId || "").toLowerCase();
      if (jeBrezOdziva || ton === "strict" || ton === "super_strict" || ton === "very_strict") {
        return "Dolg je že zapadel, prejšnji opomini pa niso bili uspešni. Zato je sporočilo jasno, neposredno in opozori na možne nadaljnje pravne korake.";
      }
      if (ton === "firm" || ton === "neutral" || String(tonOznaka).toLowerCase().indexOf("odločen") >= 0) {
        return "Dolg je že zapadel, zato sporočilo jasno določi pričakovano plačilo in naslednji rok, hkrati pa ostane profesionalno.";
      }
      return "To je zgodnejši korak opominjanja, zato sporočilo ostane prijazno in spoštljivo, vendar dolžnika jasno opozori na odprt dolg in rok plačila.";
    }

    function odpriPredajaZgodovinaSheet(z, jeBrezOdziva, barvniRazred) {
      var el = zagotoviPredajaZgodovinaSheet();
      var panelEl = el.querySelector(".opomin-cas-sheet__panel");
      var telo = el.querySelector("#opomin-predaja-zgodovina-sheet-telo");
      var naslovEl = el.querySelector("#opomin-predaja-zgodovina-sheet-naslov");
      if (panelEl) {
        panelEl.className =
          "opomin-cas-sheet__panel opomin-predaja-korak-sheet " +
          (barvniRazred || "opomin-nacrt__stage--eskalacija-1");
      }
      var naslovKoraka = z.naslov || "Korak";
      var kanaliBesedilo = z.kanali && z.kanali.length ? z.kanali.join(" · ") : "—";
      var stanjeBesedilo = jeBrezOdziva
        ? "Brez odziva"
        : z.status === "sent"
          ? "Poslano"
          : z.status === "confirmed"
            ? "Potrjeno"
            : "Načrtovano";
      var tonOznaka = N && typeof N.oznakaTona === "function"
        ? N.oznakaTona(z.toneId || plan.toneId)
        : "—";
      var k1Podrobnosti = opts.podatkiKorak1 || {};
      var znesekCentov = z.znesekCentov != null
        ? z.znesekCentov
        : plan.amountCents != null
          ? plan.amountCents
          : k1Podrobnosti.znesek != null
            ? Math.round(Number(k1Podrobnosti.znesek) * 100)
            : null;
      var dolgBesedilo = formatEurIzCentov(znesekCentov) || "—";
      var zapadlostIso = z.datumZapadlosti || k1Podrobnosti.datumZapadlosti || plan.originalDueDate;
      var zapadlostBesedilo = zapadlostIso ? formatDatumSl(zapadlostIso) : "—";
      var razlagaTona = razlagaTonaKoraka(z.toneId || plan.toneId, tonOznaka, jeBrezOdziva);

      naslovEl.innerHTML =
        '<span class="opomin-korak-detail__stevilka" aria-hidden="true">' + esc(z.index) + "</span>" +
        '<span class="opomin-korak-detail__naslov-sklop"><span class="opomin-korak-detail__naslov">' +
        esc(naslovKoraka) +
        '</span><span class="opomin-korak-detail__status">' + esc(stanjeBesedilo) + "</span></span>";
      naslovEl.setAttribute("aria-label", z.index + ". " + naslovKoraka + ", " + stanjeBesedilo);

      telo.innerHTML =
        '<section class="opomin-korak-detail__povzetek" aria-label="Povzetek koraka">' +
        '<div class="opomin-korak-detail__zgoraj">' +
        '<div class="opomin-korak-detail__podatek"><span class="opomin-korak-detail__ikona">' + IKONA_KOLEDAR +
        '</span><span><small>Datum in ura</small><strong>' + esc(formatCasPolno(z.sendAt)) + "</strong></span></div>" +
        '<div class="opomin-korak-detail__podatek"><span class="opomin-korak-detail__ikona">' + IKONA_POSILJANJE +
        '</span><span><small>Kanal</small><strong>' + esc(kanaliBesedilo) + "</strong></span></div>" +
        "</div>" +
        '<div class="opomin-korak-detail__spodaj">' +
        '<div class="opomin-korak-detail__podatek"><span class="opomin-korak-detail__ikona">' + IKONA_DENARNICA +
        '</span><span><small>Dolg</small><strong>' + esc(dolgBesedilo) + "</strong></span></div>" +
        '<div class="opomin-korak-detail__podatek"><span class="opomin-korak-detail__ikona">' + IKONA_KOLEDAR_MAJHNA +
        '</span><span><small>Zapadlost</small><strong>' + esc(zapadlostBesedilo) + "</strong></span></div>" +
        '<div class="opomin-korak-detail__podatek"><span class="opomin-korak-detail__ikona">' + IKONA_TON +
        '</span><span><small>Ton</small><strong>' + esc(tonOznaka) + "</strong></span></div>" +
        "</div></section>" +
        '<section class="opomin-korak-detail__razlaga"><div class="opomin-korak-detail__razlaga-glava">' +
        '<span class="opomin-korak-detail__razlaga-ikona" aria-hidden="true">' + IKONA_INFO + "</span>" +
        '<h3>Zakaj ' + esc(String(tonOznaka).toLowerCase()) + ' ton?</h3></div>' +
        "<p>" + esc(razlagaTona) + "</p></section>" +
        '<section class="opomin-korak-detail__sporocilo-sklop"><h3><span aria-hidden="true">' + IKONA_SMS +
        "</span>Sporočilo dolžniku</h3>" +
        '<p class="opomin-korak-detail__sporocilo">' + esc(z.sporocilo || "Brez sporočila.") + "</p></section>" +
        '<button type="button" class="opomin-korak-detail__zapri" data-opomin-korak-detail-zapri>Zapri pregled</button>';
      var zapriPregledBtn = telo.querySelector("[data-opomin-korak-detail-zapri]");
      if (zapriPregledBtn) zapriPregledBtn.addEventListener("click", el._zapri);
      el.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      naslovEl.focus();
    }

    /* --- Bottom-sheet: informativen predogled izbranega (pripravljenega) paketa --- */
    function zagotoviPredajaPaketSheet() {
      var el = document.getElementById("opomin-predaja-paket-sheet");
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-predaja-paket-sheet";
      el.className = "opomin-cas-sheet";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opomin-cas-sheet__backdrop" id="opomin-predaja-paket-sheet-backdrop" aria-label="Zapri"></button>' +
        '<div class="opomin-cas-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="opomin-predaja-paket-sheet-naslov">' +
        '<div class="opomin-cas-sheet__rocaj" aria-hidden="true"></div>' +
        '<div class="opomin-cas-sheet__glava">' +
        '<h2 class="opomin-cas-sheet__naslov" id="opomin-predaja-paket-sheet-naslov" tabindex="-1">Paket</h2>' +
        '<button type="button" class="opomin-cas-sheet__zapri" id="opomin-predaja-paket-sheet-zapri" aria-label="Zapri"><span aria-hidden="true">×</span></button>' +
        "</div>" +
        '<div class="opomin-cas-sheet__telo" id="opomin-predaja-paket-sheet-telo"></div>' +
        "</div>";
      document.body.appendChild(el);
      function zapri() {
        el.hidden = true;
        document.documentElement.classList.remove("uj-modal-odprt");
        document.body.classList.remove("uj-modal-odprt");
      }
      el.querySelector("#opomin-predaja-paket-sheet-backdrop").addEventListener("click", zapri);
      el.querySelector("#opomin-predaja-paket-sheet-zapri").addEventListener("click", zapri);
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") zapri();
      });
      el._zapri = zapri;
      return el;
    }

    function odpriPredajaPaketSheet(pak) {
      var el = zagotoviPredajaPaketSheet();
      var telo = el.querySelector("#opomin-predaja-paket-sheet-telo");
      var naslovEl = el.querySelector("#opomin-predaja-paket-sheet-naslov");
      if (!pak) {
        naslovEl.textContent = "Paket";
        telo.innerHTML = "<p>Paket ni zabeležen v pripravljenem posnetku.</p>";
      } else {
        naslovEl.textContent = pak.titleSnapshot || pak.title || "Izbrani paket";
        var postavke = (pak.includedItemsSnapshot || pak.includedItems || [])
          .map(function (item) {
            return (
              '<div class="lp-popup-vrstica"><span class="lp-popup-vrstica__kljukica" aria-hidden="true">✓</span><span>' +
              esc(item) +
              "</span></div>"
            );
          })
          .join("");
        telo.innerHTML =
          '<p class="opomin-predaja-pregled__paket-sheet-cena">' +
          esc(pak.priceLabel || "") +
          "</p>" +
          (postavke ? '<div class="opomin-predaja-pregled__paket-sheet-postavke">' + postavke + "</div>" : "");
      }
      el.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      naslovEl.focus();
    }

    /* --- Bottom-sheet: read-only podrobnosti odvetnika (Faza 8). Nima gumba
       "Izberi"/"Spremeni" - samo prikaz podatkov iz zamrznjenega snapshota. */
    function zagotoviPredajaOdvetnikPodrobnoSheet() {
      var el = document.getElementById("opomin-predaja-odvetnik-podrobno-sheet");
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-predaja-odvetnik-podrobno-sheet";
      el.className = "opomin-cas-sheet";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opomin-cas-sheet__backdrop" id="opomin-predaja-odvetnik-podrobno-sheet-backdrop" aria-label="Zapri"></button>' +
        '<div class="opomin-cas-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="opomin-predaja-odvetnik-podrobno-sheet-naslov">' +
        '<div class="opomin-cas-sheet__rocaj" aria-hidden="true"></div>' +
        '<div class="opomin-cas-sheet__glava">' +
        '<h2 class="opomin-cas-sheet__naslov" id="opomin-predaja-odvetnik-podrobno-sheet-naslov" tabindex="-1">Odvetnik</h2>' +
        '<button type="button" class="opomin-cas-sheet__zapri" id="opomin-predaja-odvetnik-podrobno-sheet-zapri" aria-label="Zapri"><span aria-hidden="true">×</span></button>' +
        "</div>" +
        '<div class="opomin-cas-sheet__telo" id="opomin-predaja-odvetnik-podrobno-sheet-telo"></div>' +
        "</div>";
      document.body.appendChild(el);
      function zapri() {
        el.hidden = true;
        document.documentElement.classList.remove("uj-modal-odprt");
        document.body.classList.remove("uj-modal-odprt");
      }
      el.querySelector("#opomin-predaja-odvetnik-podrobno-sheet-backdrop").addEventListener("click", zapri);
      el.querySelector("#opomin-predaja-odvetnik-podrobno-sheet-zapri").addEventListener("click", zapri);
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") zapri();
      });
      el._zapri = zapri;
      return el;
    }

    function odpriPredajaOdvetnikPodrobnoSheet(odv) {
      var o = odv || {};
      var el = zagotoviPredajaOdvetnikPodrobnoSheet();
      var telo = el.querySelector("#opomin-predaja-odvetnik-podrobno-sheet-telo");
      var naslovEl = el.querySelector("#opomin-predaja-odvetnik-podrobno-sheet-naslov");
      naslovEl.textContent = o.pisarna || o.ime || "Odvetnik";
      var vrsticeHtml =
        (o.ime ? "<div><dt>Ime</dt><dd>" + esc(o.ime) + "</dd></div>" : "") +
        (o.pisarna ? "<div><dt>Pisarna</dt><dd>" + esc(o.pisarna) + "</dd></div>" : "") +
        (o.email ? "<div><dt>E-pošta</dt><dd>" + esc(o.email) + "</dd></div>" : "") +
        (o.telefon ? "<div><dt>Telefon</dt><dd>" + esc(o.telefon) + "</dd></div>" : "");
      telo.innerHTML = vrsticeHtml
        ? '<dl class="opomin-zgodovina-podrobnosti__meta">' + vrsticeHtml + "</dl>"
        : "<p>Odvetnik ni izbran.</p>";
      el.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      naslovEl.focus();
    }

    /* --- Bottom-sheet: podrobnosti enega koraka prihodnje časovnice (Faza 8)
       – posplošitev odpriPredajaZgodovinaSheet za samodejne IN ročni korak
       "Predaja odvetniku". Vsi podatki prihajajo iz preparedSnapshot. */
    function odpriPredajaKorakSheet(
      tip,
      idx,
      zgodovina,
      snap,
      pak,
      odv,
      terminBesedilo,
      pripravljeniDokumenti,
      vsiOsnovniDokumenti
    ) {
      if (tip === "rocni") {
        var el = zagotoviPredajaZgodovinaSheet();
        var panelEl = el.querySelector(".opomin-cas-sheet__panel");
        var telo = el.querySelector("#opomin-predaja-zgodovina-sheet-telo");
        var naslovEl = el.querySelector("#opomin-predaja-zgodovina-sheet-naslov");
        if (panelEl) {
          panelEl.className =
            "opomin-cas-sheet__panel opomin-predaja-korak-sheet opomin-nacrt__stage--predaja";
        }
        naslovEl.textContent = "Predaja odvetniku";
        telo.innerHTML =
          '<dl class="opomin-zgodovina-podrobnosti__meta">' +
          "<div><dt>Datum predaje</dt><dd>" +
          esc(terminBesedilo || "—") +
          "</dd></div>" +
          "<div><dt>Odvetnik</dt><dd>" +
          esc((odv && (odv.pisarna || odv.ime)) || "Ni izbran") +
          "</dd></div>" +
          "<div><dt>Paket</dt><dd>" +
          esc((pak && (pak.titleSnapshot || pak.title)) || "Ni izbran") +
          "</dd></div>" +
          "<div><dt>Cena</dt><dd>" +
          esc((pak && pak.priceLabel) || "Cena ni določena") +
          "</dd></div>" +
          "<div><dt>Dokumenti</dt><dd>" +
          pripravljeniDokumenti +
          " od " +
          vsiOsnovniDokumenti +
          " pripravljenih</dd></div>" +
          "</dl>" +
          '<p class="opomin-zgodovina-podrobnosti__label">Sporočilo odvetniku</p>' +
          '<p class="opomin-zgodovina-podrobnosti__sporocilo">' +
          esc((snap && snap.sporociloOdvetniku) || "Brez sporočila.") +
          "</p>";
        el.hidden = false;
        document.documentElement.classList.add("uj-modal-odprt");
        document.body.classList.add("uj-modal-odprt");
        naslovEl.focus();
        return;
      }
      var item = (zgodovina || []).find(function (z) {
        return z.index === idx;
      });
      if (!item) return;
      var pozicijaKoraka = Math.max(0, (zgodovina || []).indexOf(item));
      var barvniNivoKoraka = dolociBarvniNivo(
        pozicijaKoraka,
        Math.max(1, (zgodovina || []).length)
      );
      var jeZadnjiIndeks =
        zgodovina.length && zgodovina[zgodovina.length - 1].index === idx;
      odpriPredajaZgodovinaSheet(
        item,
        jeZadnjiIndeks && snap && snap.responseStatus === "no_response",
        "opomin-nacrt__stage--eskalacija-" + barvniNivoKoraka
      );
    }

    /* --- Bottom-sheet: seznam pripravljenih dokumentov (samo za branje) --- */
    function zagotoviPredajaDokumentiSheet() {
      var el = document.getElementById("opomin-predaja-dokumenti-sheet");
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-predaja-dokumenti-sheet";
      el.className = "opomin-cas-sheet";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opomin-cas-sheet__backdrop" id="opomin-predaja-dokumenti-sheet-backdrop" aria-label="Zapri"></button>' +
        '<div class="opomin-cas-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="opomin-predaja-dokumenti-sheet-naslov">' +
        '<div class="opomin-cas-sheet__rocaj" aria-hidden="true"></div>' +
        '<div class="opomin-cas-sheet__glava">' +
        '<h2 class="opomin-cas-sheet__naslov" id="opomin-predaja-dokumenti-sheet-naslov" tabindex="-1">Dokumenti</h2>' +
        '<button type="button" class="opomin-cas-sheet__zapri" id="opomin-predaja-dokumenti-sheet-zapri" aria-label="Zapri"><span aria-hidden="true">×</span></button>' +
        "</div>" +
        '<div class="opomin-cas-sheet__telo" id="opomin-predaja-dokumenti-sheet-telo"></div>' +
        "</div>";
      document.body.appendChild(el);
      function zapri() {
        el.hidden = true;
        document.documentElement.classList.remove("uj-modal-odprt");
        document.body.classList.remove("uj-modal-odprt");
      }
      el.querySelector("#opomin-predaja-dokumenti-sheet-backdrop").addEventListener("click", zapri);
      el.querySelector("#opomin-predaja-dokumenti-sheet-zapri").addEventListener("click", zapri);
      el.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") zapri();
      });
      el._zapri = zapri;
      return el;
    }

    function odpriPredajaDokumentiSheet(dokumenti) {
      var el = zagotoviPredajaDokumentiSheet();
      var telo = el.querySelector("#opomin-predaja-dokumenti-sheet-telo");
      var naslovEl = el.querySelector("#opomin-predaja-dokumenti-sheet-naslov");
      telo.innerHTML = dokumenti.length
        ? dokumenti
            .map(function (d) {
              var vsebina =
                '<span class="opomin-predaja-pregled__dokument-vrstica-ikona" aria-hidden="true">' +
                IKONA_DOKUMENT +
                "</span>" +
                '<span class="opomin-predaja-pregled__dokument-vrstica-ime">' +
                esc(d.name || "Dokument") +
                "</span>";
              return d.storagePath
                ? '<a class="opomin-predaja-pregled__dokument-vrstica" href="' +
                    esc(d.storagePath) +
                    '" target="_blank" rel="noopener">' +
                    vsebina +
                    "</a>"
                : '<div class="opomin-predaja-pregled__dokument-vrstica">' + vsebina + "</div>";
            })
            .join("")
        : "<p>Ni dokumentov.</p>";
      el.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      naslovEl.focus();
    }

    function odpriPredajaPojasniloSheet() {
      if (typeof opts.potrdiVprasanje === "function") {
        opts.potrdiVprasanje({
          naslov: "Kaj pomeni ročna predaja?",
          opis:
            "Aplikacija ne pošlje dokumentov ali sporočila odvetniku. Paket bo pripravljen za prenos oziroma ročno predajo – sami poskrbite za varen prenos odvetniku. Izvedeno predajo lahko pozneje evidentirate.",
          potrdiBesedilo: "V redu",
          samoEnGumb: true,
          stil: "primary",
        });
      }
    }

    function izrisiPotrditevPredajeOdvetniku(step) {
      var lh = step.lawyerHandoff || {};
      var snap = lh.preparedSnapshot;
      var manjkajociPogojiZaPrikaz = [];

      /* Varna obnova za OBSTOJEČE (legacy) osnutke: korak je lahko bil
         izdelan pred uvedbo preparedSnapshot, ali je bila priprava opravljena
         s starejšo različico kode, ali je bil status kdaj ročno/napačno
         nastavljen brez dejanske priprave. Če snapshot manjka in stanje ni
         "needs_review" (tam je ponovna priprava namerno ročna, glej opozorilo
         spodaj) ali "handed_over" (dokončano, snapshot mora ostati takšen,
         kot je), preveri IZKLJUČNO z isto kanonično validacijo kot gumb
         "Pripravi predajo" (N.preveriPogojeZaPripravoPredaje) in če so pogoji
         dejansko izpolnjeni, ustvari snapshot IZKLJUČNO prek iste kanonične
         podatkovne funkcije (N.pripraviPredajoOdvetniku) - nič se ne sestavlja
         tukaj. Idempotentno: po prvi uspešni obnovi ima korak preparedSnapshot
         in status "prepared", zato ta blok ob naslednjem odpiranju takoj
         izstopi na zgornjem pogoju (snap resnično obstaja). Ne pošlje
         ničesar, ne kliče omrežja, ne spremeni handedOverAt/"handed_over". */
      if (!snap && lh.status !== "needs_review" && lh.status !== "handed_over") {
        var preverjenoObnova = N.preveriPogojeZaPripravoPredaje(
          plan,
          step.index,
          opts.podatkiKorak1,
          prilogeKoraka
        );
        if (preverjenoObnova.ok) {
          plan = N.pripraviPredajoOdvetniku(
            plan,
            step.index,
            opts.podatkiKorak1,
            prilogeKoraka
          );
          shrani();
          step = N.najdiKorak(plan, step.index) || step;
          lh = step.lawyerHandoff || {};
          snap = lh.preparedSnapshot;
        } else {
          manjkajociPogojiZaPrikaz = preverjenoObnova.manjkajoce || [];
        }
      }

      var prikazniRed = 0;
      var korakiVsi = plan.steps || [];
      for (var ri = 0; ri < korakiVsi.length; ri++) {
        if (!korakiVsi[ri].isExcluded) prikazniRed++;
        if (korakiVsi[ri].index === step.index) break;
      }

      if (!snap || lh.status === "draft") {
        var manjkaSeznamHtml = manjkajociPogojiZaPrikaz.length
          ? '<p class="opomin-predaja-pregled__manjka-naslov">Manjka:</p>' +
            '<ul class="opomin-predaja-pregled__manjka-seznam">' +
            manjkajociPogojiZaPrikaz
              .map(function (m) {
                return "<li>" + esc(m) + "</li>";
              })
              .join("") +
            "</ul>"
          : "";
        opts.potrditevEl.innerHTML =
          '<div class="opomin-predaja-pregled">' +
          '<div class="opomin-predaja-pregled__manjka">' +
          "<p>Predaja še ni pripravljena. Najprej preverite podatke in pripravite paket.</p>" +
          manjkaSeznamHtml +
          '<button type="button" class="opomin-predaja-pregled__nazaj-gumb" id="opomin-predaja-pregled-nazaj-prazno">← Nazaj na ' +
          esc(String(prikazniRed)) +
          ". korak</button>" +
          "</div>" +
          "</div>";
        var nazajPrazno = opts.potrditevEl.querySelector("#opomin-predaja-pregled-nazaj-prazno");
        if (nazajPrazno) {
          nazajPrazno.addEventListener("click", function () {
            pokaziGlavni();
          });
        }
        return;
      }

      var jePregled = lh.status === "needs_review";
      var jeZeDokoncano = step.status === "confirmed" && Boolean(lh.manualHandoffAcknowledgedAt);

      var opozoriloHtml = jePregled
        ? '<div class="opomin-predaja-pregled__opozorilo" role="alert">' +
          "<strong>Podatki so se spremenili po pripravi.</strong>" +
          "<span>Pred dokončanjem se vrnite na " +
          esc(String(prikazniRed)) +
          ". korak in paket pripravite znova.</span>" +
          "</div>"
        : "";

      /* --- Kartica "Primer je pripravljen za pregled" --- */
      var d = snap.dolznik || {};
      var vrstaBesedilo =
        d.vrsta === "fizicna_oseba" ? "Fizična oseba" : d.vrsta === "podjetje" ? "Podjetje" : d.vrsta;
      var primerKarticaHtml =
        '<section class="opomin-predaja-pregled__kartica opomin-predaja-pregled__kartica--primer">' +
        '<div class="opomin-predaja-pregled__primer-glava">' +
        '<span class="opomin-predaja-pregled__primer-ikona" aria-hidden="true">' +
        IKONA_SCIT_KLJUKICA +
        "</span>" +
        '<h3 class="opomin-predaja-pregled__primer-naslov">Primer je pripravljen za pregled</h3>' +
        '<span class="opomin-predaja-pregled__primer-znacka">Pred potrditvijo</span>' +
        "</div>" +
        '<div class="opomin-predaja-pregled__primer-stolpci">' +
        '<div class="opomin-predaja-pregled__primer-stolpec"><span class="opomin-predaja-pregled__primer-label">Dolžnik</span><span class="opomin-predaja-pregled__primer-vrednost">' +
        esc(d.ime || "—") +
        "</span></div>" +
        '<div class="opomin-predaja-pregled__primer-stolpec"><span class="opomin-predaja-pregled__primer-label">Dolg</span><span class="opomin-predaja-pregled__primer-vrednost">' +
        esc(formatEurIzCentov(d.znesekCentov)) +
        "</span></div>" +
        '<div class="opomin-predaja-pregled__primer-stolpec"><span class="opomin-predaja-pregled__primer-label">Zapadlost</span><span class="opomin-predaja-pregled__primer-vrednost">' +
        esc(formatDatumSl(d.datumZapadlosti)) +
        "</span></div>" +
        "</div>" +
        '<button type="button" class="opomin-predaja-pregled__razsiri" id="opomin-predaja-pregled-razsiri" aria-expanded="false" aria-controls="opomin-predaja-pregled-razsirjeno">' +
        '<span class="opomin-predaja-pregled__razsiri-ikona" aria-hidden="true">' +
        IKONA_DOKUMENT +
        "</span>" +
        '<span class="opomin-predaja-pregled__razsiri-tekst">Vsi podatki o primeru</span>' +
        '<span class="opomin-predaja-pregled__razsiri-chevron" aria-hidden="true">' +
        IKONA_CHEVRON_DOL +
        "</span>" +
        "</button>" +
        '<div class="opomin-predaja-pregled__razsirjeno" id="opomin-predaja-pregled-razsirjeno" hidden>' +
        htmlPredajaRazsirjenoPolje("Vrsta dolžnika", vrstaBesedilo) +
        htmlPredajaRazsirjenoPolje("Davčna številka", d.davcnaStevilka) +
        htmlPredajaRazsirjenoPolje("Kontaktna oseba", d.kontaktnaOseba) +
        htmlPredajaRazsirjenoPolje("Telefon", d.telefon) +
        htmlPredajaRazsirjenoPolje("E-pošta", d.email) +
        htmlPredajaRazsirjenoPolje("Številka računa", d.stevilkaRacuna) +
        htmlPredajaRazsirjenoPolje(
          "Račun priložen",
          d.racunPriloga ? (typeof d.racunPriloga === "string" ? d.racunPriloga : "Da") : "Ne"
        ) +
        "</div>" +
        "</section>";

      /* --- "Kaj se bo zgodilo naprej?" – prihodnja časovnica (Faza 8).
         Seznam mora vedno odražati TRENUTNO vključene kartice. PreparedSnapshot
         ostane nespremenljiv vir podatkov predaje, ni pa več vir števila
         korakov, ker bi po poznejšem vklopu kartic prikazal zastarel seznam. */
      var zgodovinaPosnetka = snap.zgodovinaOpominov || [];
      var zgodovinaPoIndeksu = {};
      zgodovinaPosnetka.forEach(function (zapis) {
        zgodovinaPoIndeksu[String(zapis.index)] = zapis;
      });
      var trenutniK1 = opts.podatkiKorak1 || {};
      var zgodovina = (plan.steps || [])
        .filter(function (s) {
          return s.kind !== "manual_lawyer" && !s.isExcluded;
        })
        .map(function (s) {
          var starZapis = zgodovinaPoIndeksu[String(s.index)] || {};
          var primarniKontakti = s.primaryContacts || { sms: true, email: true };
          var dodatniKontakti = s.customContacts || {};
          var kanali = [];
          if (
            (primarniKontakti.sms !== false && trenutniK1.telefonDolznika) ||
            (Array.isArray(dodatniKontakti.phoneNumbers) && dodatniKontakti.phoneNumbers.length)
          ) kanali.push("SMS");
          if (
            (primarniKontakti.email !== false && trenutniK1.emailDolznika) ||
            (Array.isArray(dodatniKontakti.emailAddresses) && dodatniKontakti.emailAddresses.length)
          ) kanali.push("E-pošta");
          return {
            index: s.index,
            naslov: s.title || starZapis.naslov || null,
            status: s.status,
            kanali: kanali.length ? kanali : (starZapis.kanali || []),
            sendAt:
              (s._randomSchedule && s._randomSchedule.enabled && s._randomSchedule.resolvedScheduledAt) ||
              s.sentAt || s.sendAt || s.scheduledAt || starZapis.sendAt || null,
            sporocilo: s.finalMessage || s.generatedMessage || starZapis.sporocilo || "",
            toneId: s.toneId || plan.toneId || starZapis.toneId || "friendly",
            znesekCentov:
              plan.amountCents != null
                ? plan.amountCents
                : snap.dolznik && snap.dolznik.znesekCentov != null
                  ? snap.dolznik.znesekCentov
                  : null,
            datumZapadlosti:
              trenutniK1.datumZapadlosti ||
              (snap.dolznik && snap.dolznik.datumZapadlosti) ||
              plan.originalDueDate ||
              null,
          };
        });
      var steviloSamodejnihKorakov = zgodovina.length;
      var pakZaCasovnico = snap.izbraniPaket;
      var odvZaCasovnico = snap.odvetnik || {};
      var casPredajeZaCasovnico = snap.casPredaje || {};
      var terminPredajeKratek = casPredajeZaCasovnico.scheduledAt
        ? formatDatumSl(casPredajeZaCasovnico.scheduledAt)
        : null;

      function barvaCrtePrihodnjegaKoraka(pozicija, steviloKorakov) {
        var barve = {
          1: "#6cae90",
          2: "#87af72",
          3: "#c3a13b",
          4: "#c49025",
          5: "#c8842e",
          6: "#c8773f",
          7: "#c76b46",
          8: "#c65d57",
          9: "#b95660",
        };
        return barve[dolociBarvniNivo(pozicija, steviloKorakov)] || "#6cae90";
      }

      function htmlPredajaPrihodnjaVrstica(
        stevilka,
        barvniRazred,
        ikonaSvg,
        naslov,
        podnapisKanali,
        podnapisOpis,
        datumIso,
        dataAtributi,
        jeZadnja,
        prejsnjaBarva,
        trenutnaBarva,
        naslednjaBarva
      ) {
        var dolzinaNaslova = String(naslov || "").length;
        var naslovVelikostRazred =
          dolzinaNaslova > 21
            ? " opomin-predaja-pregled__prihodnji-naslov--zelo-dolg"
            : dolzinaNaslova > 15
              ? " opomin-predaja-pregled__prihodnji-naslov--dolg"
              : "";
        var kanalDolzina = String(podnapisKanali || "").length;
        var kanalVelikostRazred =
          kanalDolzina > 38
            ? " opomin-predaja-pregled__prihodnji-kanali--zelo-dolgi"
            : kanalDolzina > 28
              ? " opomin-predaja-pregled__prihodnji-kanali--dolgi"
              : "";
        return (
          '<div class="opomin-predaja-pregled__prihodnji-sklop ' +
          barvniRazred +
          (stevilka === 1 ? " opomin-predaja-pregled__prihodnji-sklop--prvi" : "") +
          (jeZadnja ? " opomin-predaja-pregled__prihodnji-sklop--zadnji" : "") +
          '" style="--timeline-prev:' + prejsnjaBarva +
          ";--timeline-current:" + trenutnaBarva +
          ";--timeline-next:" + naslednjaBarva + ';">' +
          '<span class="opomin-predaja-pregled__prihodnji-stolpec" aria-hidden="true">' +
          '<span class="opomin-predaja-pregled__prihodnji-stevilka">' +
          stevilka +
          "</span>" +
          (jeZadnja ? "" : '<span class="opomin-predaja-pregled__prihodnji-crta"></span>') +
          "</span>" +
          '<button type="button" class="opomin-predaja-pregled__prihodnji-kartica" ' +
          dataAtributi +
          ' aria-label="Preglej podrobnosti koraka ' +
          esc(naslov) +
          '">' +
          '<span class="opomin-predaja-pregled__prihodnji-ikona" aria-hidden="true">' +
          ikonaSvg +
          "</span>" +
          '<span class="opomin-predaja-pregled__prihodnji-vsebina">' +
          '<strong class="opomin-predaja-pregled__prihodnji-naslov-koraka' +
          naslovVelikostRazred +
          '" data-prihodnji-auto-fit="multiline" data-min-font="9.5">' +
          esc(naslov) +
          "</strong>" +
          '<span class="opomin-predaja-pregled__prihodnji-kanali' + kanalVelikostRazred +
          '" data-prihodnji-auto-fit="multiline" data-min-font="8.2">' +
          esc(podnapisKanali) +
          "</span>" +
          '<span class="opomin-predaja-pregled__prihodnji-opis" data-prihodnji-auto-fit="single" data-min-font="8">' +
          esc(podnapisOpis) +
          "</span>" +
          "</span>" +
          '<span class="opomin-predaja-pregled__prihodnji-desno">' +
          (datumIso
            ? '<time datetime="' + esc(datumIso) + '">' +
              '<span class="opomin-predaja-pregled__prihodnji-datum">' + esc(formatDatumSl(datumIso)) + "</span>" +
              '<span class="opomin-predaja-pregled__prihodnji-dan-cas" data-prihodnji-auto-fit="single" data-min-font="8.5">' +
              '<span>' + esc(formatDanSl(datumIso)) + '</span>' +
              '<span class="opomin-predaja-pregled__prihodnji-locilo" aria-hidden="true">&middot;</span>' +
              '<span>' + esc(formatCasKratko(datumIso)) + '</span>' +
              "</span></time>"
            : "") +
          '<span class="opomin-predaja-pregled__prihodnji-preglej">Preglej →</span>' +
          "</span>" +
          "</button>" +
          "</div>"
        );
      }

      var prihodnjeVrsticeDeli = zgodovina.map(function (z, i) {
        var barvniNivo = dolociBarvniNivo(i, steviloSamodejnihKorakov);
        var barvniRazred = "opomin-nacrt__stage--eskalacija-" + barvniNivo;
        var trenutnaBarva = barvaCrtePrihodnjegaKoraka(i, steviloSamodejnihKorakov);
        var prejsnjaBarva = i > 0
          ? barvaCrtePrihodnjegaKoraka(i - 1, steviloSamodejnihKorakov)
          : trenutnaBarva;
        var naslednjaBarva = i + 1 < steviloSamodejnihKorakov
          ? barvaCrtePrihodnjegaKoraka(i + 1, steviloSamodejnihKorakov)
          : "#8762aa";
        var ikonaSvg = z.kanali && z.kanali.indexOf("SMS") >= 0 ? IKONA_SMS : IKONA_EMAIL;
        var kanaliBesedilo = z.kanali && z.kanali.length
          ? "Poslan bo " + z.kanali.map(function (kanal) {
              return kanal === "SMS" ? "SMS" : String(kanal).toLowerCase();
            }).join(" in ")
          : "Na\u010din po\u0161iljanja ni dolo\u010den";
        var vrstica = htmlPredajaPrihodnjaVrstica(
          i + 1,
          barvniRazred,
          ikonaSvg,
          z.naslov || "Opomin",
          kanaliBesedilo,
          "Prejmete obvestilo za potrditev.",
          z.sendAt || null,
          'data-predaja-korak-preglej="' + z.index + '" data-predaja-tip-koraka="avto"',
          false,
          prejsnjaBarva,
          trenutnaBarva,
          naslednjaBarva
        );
        var vmesniPogojHtml =
          '<div class="opomin-predaja-pregled__prihodnji-vmesni" style="--timeline-current:' +
          trenutnaBarva + ";--timeline-next:" + naslednjaBarva + ';">' +
          '<span class="opomin-predaja-pregled__prihodnji-stolpec opomin-predaja-pregled__prihodnji-stolpec--vmesni" aria-hidden="true">' +
          '<span class="opomin-predaja-pregled__prihodnji-crta"></span>' +
          "</span>" +
          '<p class="opomin-predaja-pregled__prihodnji-pogoj"><span aria-hidden="true">↓</span> ' +
          esc(i === 0 ? "Če dolg ni poravnan" : "Če dolg še vedno ni poravnan") +
          "</p>" +
          "</div>";
        return vrstica + vmesniPogojHtml;
      });

      var rocniKorakVrstica = htmlPredajaPrihodnjaVrstica(
        steviloSamodejnihKorakov + 1,
        "opomin-nacrt__stage--predaja",
        IKONA_TEHTNICA,
        "Predaja odvetniku",
        pakZaCasovnico
          ? (pakZaCasovnico.titleSnapshot || pakZaCasovnico.title || "Izbrani paket") +
            (pakZaCasovnico.priceLabel ? " · " + pakZaCasovnico.priceLabel : "")
          : "Paket ni izbran",
        "Prejmete obvestilo za potrditev.",
        casPredajeZaCasovnico.scheduledAt || null,
        'data-predaja-korak-preglej="rocni" data-predaja-tip-koraka="rocni"',
        true,
        steviloSamodejnihKorakov
          ? barvaCrtePrihodnjegaKoraka(steviloSamodejnihKorakov - 1, steviloSamodejnihKorakov)
          : "#8762aa",
        "#8762aa",
        "#8762aa"
      );

      var barveHrbtenice = zgodovina.map(function (_z, i) {
        return barvaCrtePrihodnjegaKoraka(i, steviloSamodejnihKorakov);
      }).concat(["#8762aa"]);
      var gradientHrbtenice = "linear-gradient(to bottom, " +
        barveHrbtenice.map(function (barva, i) {
          var odstotek = barveHrbtenice.length > 1
            ? Math.round((i / (barveHrbtenice.length - 1)) * 10000) / 100
            : 0;
          return barva + " " + odstotek + "%";
        }).join(", ") + ")";

      var potekKarticaHtml =
        '<section class="opomin-predaja-pregled__prihodnji" aria-label="Kaj se bo zgodilo naprej">' +
        '<h3 class="opomin-predaja-pregled__prihodnji-naslov">Kaj se bo zgodilo naprej?</h3>' +
        '<p class="opomin-predaja-pregled__prihodnji-podnaslov">Načrt je pripravljen. Pred vsakim dejanjem boste prejeli obvestilo.</p>' +
        '<div class="opomin-predaja-pregled__prihodnji-hrbtenica" style="--timeline-spine:' + gradientHrbtenice + ';">' +
        prihodnjeVrsticeDeli.join("") +
        rocniKorakVrstica +
        "</div>" +
        "</section>";

      /* --- Kartica: odvetnik + paket + sporočilo (Faza 8) – en zunanji bubble,
         ločen s tankimi ločnicami. Brez dokumentne vrstice (dokumenti se ne
         prikazujejo več na tem zaslonu), brez "Možnih dni predaje"/"Čas
         predaje: Čimprej" in brez gumba "Spremeni" (glej odpriPredajaOdvetnikPodrobnoSheet). */
      var odv = snap.odvetnik || {};
      var casPredajePregled = snap.casPredaje || {};
      var pak = snap.izbraniPaket;
      var dokumentnoStanjePregled = N.dokumentnoStanjePredaje(
        plan,
        step.index,
        opts.podatkiKorak1,
        prilogeKoraka
      );
      var pripravljeniDokumenti = dokumentnoStanjePregled.preparedCount || 0;
      var vsiOsnovniDokumenti = dokumentnoStanjePregled.baseTotal || 4;
      var dokumentiPopolni = pripravljeniDokumenti >= vsiOsnovniDokumenti;
      var terminPredajeDolg = casPredajePregled.scheduledAt
        ? oznakaDnevaPredaje(casPredajePregled.scheduledAt) +
          ", " +
          formatDatumSl(casPredajePregled.scheduledAt) +
          " ob " +
          formatCasKratko(casPredajePregled.scheduledAt)
        : "Termin bo prikazan po potrditvi.";

      var odvetnikVrstica =
        '<div class="opomin-predaja-pregled__odvetnik-glava">' +
        '<span class="opomin-predaja-pregled__odvetnik-ikona" aria-hidden="true">' +
        IKONA_DOLZNIK +
        "</span>" +
        '<div class="opomin-predaja-pregled__odvetnik-besedilo">' +
        '<span class="opomin-predaja-pregled__odvetnik-naslov">Odvetniku bo pripravljen paket</span>' +
        '<span class="opomin-predaja-pregled__odvetnik-ime">' +
        esc(odv.pisarna || odv.ime || "Odvetnik ni izbran") +
        "</span>" +
        (odv.email
          ? '<span class="opomin-predaja-pregled__odvetnik-email">' + esc(odv.email) + "</span>"
          : "") +
        "</div>" +
        '<button type="button" class="opomin-predaja-pregled__podrobno-gumb" id="opomin-predaja-pregled-odvetnik-podrobno">Podrobno</button>' +
        "</div>";

      var paketVrstica = pak
        ? '<div class="opomin-predaja-pregled__paket-vrstica">' +
          '<div class="opomin-predaja-pregled__paket-zgoraj">' +
          '<span class="opomin-predaja-pregled__paket-ikona" aria-hidden="true">' +
          IKONA_EMAIL +
          "</span>" +
          '<span class="opomin-predaja-pregled__paket-besedilo">' +
          '<span class="opomin-predaja-pregled__paket-oznaka">Izbrani paket <span class="opomin-predaja-pregled__paket-oznaka-znacka">Izbrano ' +
          IKONA_KLJUKICA +
          "</span></span>" +
          '<span class="opomin-predaja-pregled__paket-naslov">' +
          esc(pak.titleSnapshot || pak.title || "Izbrani paket") +
          "</span>" +
          "</span>" +
          '<span class="opomin-predaja-pregled__paket-cena">' +
          esc(pak.priceLabel || "") +
          "</span>" +
          "</div>" +
          '<div class="opomin-predaja-pregled__paket-akcije">' +
          '<button type="button" class="opomin-predaja-pregled__paket-preglej" id="opomin-predaja-pregled-poglej-paket">' +
          '<span aria-hidden="true">' + IKONA_PREDAJA_DOKUMENT_OKO + "</span>Preglej paket" +
          "</button>" +
          "</div>" +
          "</div>"
        : '<div class="opomin-predaja-pregled__paket-vrstica opomin-predaja-pregled__paket-vrstica--manjka">' +
          '<div class="opomin-predaja-pregled__paket-zgoraj">' +
          '<span class="opomin-predaja-pregled__paket-ikona" aria-hidden="true">' +
          IKONA_EMAIL +
          "</span>" +
          '<span class="opomin-predaja-pregled__paket-besedilo">' +
          '<span class="opomin-predaja-pregled__paket-naslov">Paket ni zabeležen</span>' +
          "</span>" +
          "</div>" +
          "</div>";

      var sporociloVrstica =
        '<div class="opomin-predaja-pregled__sporocilo-glava">' +
        '<span class="opomin-predaja-pregled__sporocilo-naslovi">' +
        '<span class="opomin-predaja-pregled__sporocilo-naslov">Sporočilo odvetniku</span>' +
        '<span class="opomin-predaja-pregled__sporocilo-podnaslov">Sporočilo lahko še dopolnite.</span>' +
        "</span>" +
        '<span class="opomin-predaja-pregled__sporocilo-svincnik" aria-hidden="true">' +
        IKONA_SVINCNIK +
        "</span>" +
        "</div>" +
        '<textarea class="opomin-predaja-pregled__sporocilo-besedilo" id="opomin-predaja-pregled-sporocilo" rows="1" aria-label="Sporočilo odvetniku" placeholder="Vnesite sporočilo za odvetnika">' +
        esc((lh && lh.message) || snap.sporociloOdvetniku || "") +
        "</textarea>" +
        (jeZeDokoncano
          ? ""
          : '<div class="opomin-predaja-pregled__sporocilo-akcije" id="opomin-predaja-pregled-sporocilo-akcije" hidden>' +
            '<button type="button" class="opomin-predaja-pregled__sporocilo-vrni" id="opomin-predaja-pregled-sporocilo-vrni">Vrni v prejšnje stanje</button>' +
            '<button type="button" class="opomin-predaja-pregled__sporocilo-shrani" id="opomin-predaja-pregled-sporocilo-shrani">Shrani</button>' +
            "</div>");

      var odvetnikPaketKarticaHtml =
        '<section class="opomin-predaja-pregled__kartica opomin-predaja-pregled__kartica--paket">' +
        odvetnikVrstica +
        '<hr class="opomin-predaja-pregled__paket-locnica" />' +
        paketVrstica +
        '<hr class="opomin-predaja-pregled__paket-locnica" />' +
        sporociloVrstica +
        "</section>";

      /* --- "Kaj se bo zgodilo po potrditvi?" – vijolična shema (--predaja),
         iste CSS-spremenljivke kot ročni korak v časovnici zgoraj. --- */
      var procesHtml =
        '<section class="opomin-predaja-pregled__proces opomin-nacrt__stage--predaja" aria-label="Kaj se bo zgodilo po potrditvi">' +
        '<h3 class="opomin-predaja-pregled__proces-naslov">Kaj se bo zgodilo po potrditvi?</h3>' +
        '<div class="opomin-predaja-pregled__proces-vrstica">' +
        htmlPredajaProcesKorak(1, IKONA_MAPA, "Paket predate odvetniku", terminPredajeDolg) +
        '<span class="opomin-predaja-pregled__proces-puscica" aria-hidden="true">→</span>' +
        htmlPredajaProcesKorak(2, IKONA_DOLZNIK, "Odvetnik pregleda in pošlje opomin", "Običajno v 1–3 delovnih dneh") +
        '<span class="opomin-predaja-pregled__proces-puscica" aria-hidden="true">→</span>' +
        htmlPredajaProcesKorak(3, IKONA_EMAIL, "Odvetnik vas obvesti", "Po e-pošti ali telefonu") +
        "</div>" +
        "</section>";

      var varnostHtml =
        '<div class="opomin-predaja-pregled__varnost">' +
        '<span class="opomin-predaja-pregled__varnost-ikona" aria-hidden="true">' +
        IKONA_KLJUCAVNICA +
        "</span>" +
        '<span class="opomin-predaja-pregled__varnost-besedilo">' +
        "<strong>Potrditev ne pošlje ničesar odvetniku.</strong>" +
        "<span>Aplikacija pripravi in shrani paket za vašo ročno predajo.</span>" +
        "</span>" +
        "</div>";

      var checkboxHtml =
        '<div class="opomin-predaja-pregled__checkbox-vrstica">' +
        '<label class="opomin-predaja-pregled__checkbox-label">' +
        '<input type="checkbox" id="opomin-predaja-pregled-checkbox"' +
        (jeZeDokoncano ? " checked" : "") +
        " />" +
        "<span>Razumem, da moram paket odvetniku predati sam.</span>" +
        "</label>" +
        '<button type="button" class="opomin-predaja-pregled__povezava" id="opomin-predaja-pregled-kaj-pomeni">Kaj pomeni ročna predaja?</button>' +
        "</div>";

      /* --- Končna cena (Faza 8) – dinamičen obračun iz snap.izbraniPaket,
         nikoli hardkodiran in nikoli parsan iz priceLabel besedila. --- */
      var cenaPovzetek = N.povzetekCenePredaje(snap.izbraniPaket);
      function besediloCenePostavke(p) {
        if (p.priceOnRequest) return "Po ponudbi";
        if (p.priceCents === 0) return "Vključeno";
        return formatEurIzCentov(p.priceCents);
      }
      var cenaSkupajBesedilo;
      if (!cenaPovzetek.postavke.length) {
        cenaSkupajBesedilo = "Cena ni določena";
      } else if (cenaPovzetek.imaCenoPoPonudbi && cenaPovzetek.znaniSkupajCents > 0) {
        cenaSkupajBesedilo = formatEurIzCentov(cenaPovzetek.znaniSkupajCents) + " + po ponudbi";
      } else if (cenaPovzetek.imaCenoPoPonudbi) {
        cenaSkupajBesedilo = "Po ponudbi";
      } else {
        cenaSkupajBesedilo = formatEurIzCentov(cenaPovzetek.znaniSkupajCents) + " enkratno";
      }
      var cenaHtml =
        '<section class="opomin-predaja-pregled__cena" aria-label="Končna cena">' +
        '<div class="opomin-predaja-pregled__cena-glava">' +
        '<h3 class="opomin-predaja-pregled__cena-naslov">Končna cena</h3>' +
        '<span class="opomin-predaja-pregled__cena-pomoc">Plačate samo izbrane pakete.</span>' +
        "</div>" +
        (cenaPovzetek.postavke.length
          ? cenaPovzetek.postavke
              .map(function (p) {
                return (
                  '<div class="opomin-predaja-pregled__cena-postavka">' +
                  "<span>" + esc(p.naslov) + "</span>" +
                  "<span>" + esc(besediloCenePostavke(p)) + "</span>" +
                  "</div>"
                );
              })
              .join("") +
            '<div class="opomin-predaja-pregled__cena-skupaj">' +
            "<span>Skupaj</span>" +
            "<strong>" + esc(cenaSkupajBesedilo) + "</strong>" +
            "</div>"
          : '<p class="opomin-predaja-pregled__cena-prazno">Cena ni določena</p>') +
        "</section>";

      var gumbiHtml =
        '<div class="opomin-predaja-pregled__akcije-vrstica">' +
        '<button type="button" class="opomin-predaja-pregled__nazaj-gumb" id="opomin-predaja-pregled-nazaj">← Nazaj na ' +
        esc(String(prikazniRed)) +
        ". korak</button>" +
        '<button type="button" class="opomin-predaja-pregled__izbrisi-gumb" id="opomin-predaja-pregled-izbrisi">Izbriši ' +
        esc(String(prikazniRed)) +
        ". korak</button>" +
        "</div>" +
        '<div class="opomin-predaja-pregled__akcije">' +
        '<button type="button" class="opomin-predaja-pregled__glavni-gumb" id="opomin-predaja-pregled-dokoncaj" disabled>' +
        (jeZeDokoncano ? "Nadaljuj →" : "Potrdi oddajo →") +
        "</button>" +
        "</div>" +
        '<div class="opomin-predaja-pregled__noga">' +
        '<button type="button" class="opomin-predaja-pregled__osnutek-gumb" id="opomin-predaja-pregled-osnutek">Shrani kot osnutek</button>' +
        "</div>";

      opts.potrditevEl.innerHTML =
        '<div class="opomin-predaja-pregled">' +
        opozoriloHtml +
        primerKarticaHtml +
        potekKarticaHtml +
        odvetnikPaketKarticaHtml +
        procesHtml +
        varnostHtml +
        checkboxHtml +
        cenaHtml +
        gumbiHtml +
        "</div>";

      /* Kartice imajo fiksne mere. Dalj\u0161a vsebina se zmanj\u0161a samo znotraj
         svoje rezervirane vrstice, zato se postavitev nikoli ne raztegne ali
         prekriva z datumom, ikono oziroma naslednjo vrstico. */
      function prilagodiBesedilaPrihodnjihKartic() {
        opts.potrditevEl
          .querySelectorAll("[data-prihodnji-auto-fit], [data-pregled-auto-fit]")
          .forEach(function (el) {
            el.style.removeProperty("font-size");
            var najmanjsa = Number(el.getAttribute("data-min-font")) || 8;
            var trenutna = parseFloat(root.getComputedStyle(el).fontSize) || 12;
            var preveriSirino = el.getAttribute("data-prihodnji-auto-fit") === "single";
            var varovalo = 24;
            while (
              trenutna > najmanjsa &&
              varovalo-- > 0 &&
              (el.scrollHeight > el.clientHeight + 1 ||
                (preveriSirino && el.scrollWidth > el.clientWidth + 1))
            ) {
              trenutna = Math.max(najmanjsa, trenutna - 0.4);
              el.style.setProperty("font-size", trenutna.toFixed(1) + "px", "important");
            }
          });
      }

      root.requestAnimationFrame(prilagodiBesedilaPrihodnjihKartic);
      if (opts.potrditevEl._prihodnjiFitObserver) {
        opts.potrditevEl._prihodnjiFitObserver.disconnect();
      }
      if (typeof root.ResizeObserver === "function") {
        opts.potrditevEl._prihodnjiFitObserver = new root.ResizeObserver(function () {
          root.requestAnimationFrame(prilagodiBesedilaPrihodnjihKartic);
        });
        var prihodnjaCasovnicaEl = opts.potrditevEl.querySelector(
          ".opomin-predaja-pregled__prihodnji-hrbtenica"
        );
        if (prihodnjaCasovnicaEl) {
          opts.potrditevEl._prihodnjiFitObserver.observe(prihodnjaCasovnicaEl);
        }
        var procesPotrditveEl = opts.potrditevEl.querySelector(
          ".opomin-predaja-pregled__proces-vrstica"
        );
        if (procesPotrditveEl) {
          opts.potrditevEl._prihodnjiFitObserver.observe(procesPotrditveEl);
        }
      }

      /* ---------- Vezava dogodkov ---------- */
      var razsiriBtn = opts.potrditevEl.querySelector("#opomin-predaja-pregled-razsiri");
      var razsirjenoEl = opts.potrditevEl.querySelector("#opomin-predaja-pregled-razsirjeno");
      if (razsiriBtn && razsirjenoEl) {
        razsiriBtn.addEventListener("click", function () {
          var jeOdprto = !razsirjenoEl.hidden;
          razsirjenoEl.hidden = jeOdprto;
          razsiriBtn.setAttribute("aria-expanded", jeOdprto ? "false" : "true");
          razsiriBtn.classList.toggle("opomin-predaja-pregled__razsiri--odprto", !jeOdprto);
        });
      }

      opts.potrditevEl.querySelectorAll("[data-predaja-korak-preglej]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var tip = btn.getAttribute("data-predaja-tip-koraka");
          var idx = Number(btn.getAttribute("data-predaja-korak-preglej"));
          odpriPredajaKorakSheet(
            tip,
            idx,
            zgodovina,
            snap,
            pak,
            odv,
            terminPredajeDolg,
            pripravljeniDokumenti,
            vsiOsnovniDokumenti
          );
        });
      });

      var odvetnikPodrobnoBtn = opts.potrditevEl.querySelector(
        "#opomin-predaja-pregled-odvetnik-podrobno"
      );
      if (odvetnikPodrobnoBtn) {
        odvetnikPodrobnoBtn.addEventListener("click", function () {
          odpriPredajaOdvetnikPodrobnoSheet(odv);
        });
      }

      var poglejPaketBtn = opts.potrditevEl.querySelector("#opomin-predaja-pregled-poglej-paket");
      if (poglejPaketBtn) {
        poglejPaketBtn.addEventListener("click", function () {
          odpriPredajaPaketSheet(pak);
        });
      }

      var pregledSporociloEl = opts.potrditevEl.querySelector(
        "#opomin-predaja-pregled-sporocilo"
      );

      function prilagodiVisinoPregledSporocila() {
        if (!pregledSporociloEl) return;
        pregledSporociloEl.style.height = "auto";
        var visina = pregledSporociloEl.scrollHeight;
        /* Če element (še) ni v postavitvi, je scrollHeight 0. Višine 0 ne
           zapišemo – polje bi se sesedlo in besedilo bi bilo odrezano. */
        if (!visina) {
          pregledSporociloEl.style.removeProperty("height");
          return;
        }
        pregledSporociloEl.style.height = visina + "px";
      }

      /** Prva meritev je pogosto prekratka, ker pisava Inter ob izrisu še ni
          naložena in se scrollHeight izračuna z metrikami nadomestne pisave.
          Ko se pisava zamenja, besedilo potrebuje vrstico več, kot je bilo
          izmerjeno, in konec sporočila se odreže. Zato izmerimo še enkrat v
          naslednji sličici in ko so pisave dejansko naložene. */
      function prilagodiVisinoPregledSporocilaZNaknadnimi() {
        prilagodiVisinoPregledSporocila();
        if (typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(prilagodiVisinoPregledSporocila);
        }
        if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
          document.fonts.ready.then(prilagodiVisinoPregledSporocila).catch(function () {});
        }
      }

      function shraniPregledSporocilo() {
        if (!pregledSporociloEl || jeZeDokoncano) return;
        var trenutniKorak = N.najdiKorak(plan, step.index) || step;
        var trenutnoSporocilo = String(
          (trenutniKorak.lawyerHandoff && trenutniKorak.lawyerHandoff.message) || ""
        );
        var novoSporocilo = pregledSporociloEl.value;
        if (novoSporocilo === trenutnoSporocilo) return;

        plan = N.posodobiSporociloOdvetniku(plan, step.index, novoSporocilo, true);
        plan = N.pripraviPredajoOdvetniku(
          plan,
          step.index,
          opts.podatkiKorak1,
          prilogeKoraka
        );
        step = N.najdiKorak(plan, step.index) || step;
        lh = step.lawyerHandoff || lh;
        snap = lh.preparedSnapshot || snap;
        shrani();
      }

      if (pregledSporociloEl) {
        if (jeZeDokoncano) pregledSporociloEl.readOnly = true;
        prilagodiVisinoPregledSporocilaZNaknadnimi();
        var pregledSporociloAkcije = opts.potrditevEl.querySelector("#opomin-predaja-pregled-sporocilo-akcije");
        var pregledSporociloVrni = opts.potrditevEl.querySelector("#opomin-predaja-pregled-sporocilo-vrni");
        var pregledSporociloShrani = opts.potrditevEl.querySelector("#opomin-predaja-pregled-sporocilo-shrani");
        var pregledSporociloPrejsnjaVrednost = pregledSporociloEl.value;
        var pregledSporociloSeUreja = false;

        function pokaziPregledSporociloAkcije() {
          if (jeZeDokoncano) return;
          if (!pregledSporociloSeUreja) {
            pregledSporociloPrejsnjaVrednost = pregledSporociloEl.value;
            pregledSporociloSeUreja = true;
          }
          if (pregledSporociloAkcije) pregledSporociloAkcije.hidden = false;
        }

        function skrijPregledSporociloAkcije() {
          pregledSporociloSeUreja = false;
          if (pregledSporociloAkcije) pregledSporociloAkcije.hidden = true;
        }

        pregledSporociloEl.addEventListener("focus", pokaziPregledSporociloAkcije);
        pregledSporociloEl.addEventListener("click", pokaziPregledSporociloAkcije);
        pregledSporociloEl.addEventListener("input", function () {
          pokaziPregledSporociloAkcije();
          prilagodiVisinoPregledSporocila();
        });

        if (pregledSporociloVrni) pregledSporociloVrni.addEventListener("click", function () {
          pregledSporociloEl.value = pregledSporociloPrejsnjaVrednost;
          prilagodiVisinoPregledSporocila();
          skrijPregledSporociloAkcije();
          pregledSporociloEl.blur();
        });

        if (pregledSporociloShrani) pregledSporociloShrani.addEventListener("click", function () {
          shraniPregledSporocilo();
          pregledSporociloPrejsnjaVrednost = pregledSporociloEl.value;
          skrijPregledSporociloAkcije();
          pregledSporociloEl.blur();
        });
      }

      var kajPomeniBtn = opts.potrditevEl.querySelector("#opomin-predaja-pregled-kaj-pomeni");
      if (kajPomeniBtn) {
        kajPomeniBtn.addEventListener("click", function () {
          odpriPredajaPojasniloSheet();
        });
      }

      var nazajBtn = opts.potrditevEl.querySelector("#opomin-predaja-pregled-nazaj");
      if (nazajBtn) {
        nazajBtn.addEventListener("click", function () {
          pokaziGlavni();
        });
      }

      var osnutekBtn = opts.potrditevEl.querySelector("#opomin-predaja-pregled-osnutek");
      if (osnutekBtn) {
        osnutekBtn.addEventListener("click", function () {
          N.shraniOsnutek(plan);
          if (typeof opts.potrdiVprasanje === "function") {
            opts.potrdiVprasanje({
              naslov: "Shranjeno",
              opis: "Načrt je shranjen kot osnutek.",
              potrdiBesedilo: "V redu",
              samoEnGumb: true,
              stil: "primary",
            });
          }
        });
      }

      var izbrisiBtn = opts.potrditevEl.querySelector("#opomin-predaja-pregled-izbrisi");
      if (izbrisiBtn) {
        izbrisiBtn.addEventListener("click", async function () {
          if (typeof opts.potrdiVprasanje === "function") {
            await opts.potrdiVprasanje({
              naslov: "Zadnjega koraka ni mogoče izbrisati",
              opis:
                "Predaja odvetniku je obvezni zaključni korak načrta. Lahko se vrnete in spremenite njegove podatke ali shranite načrt kot osnutek.",
              potrdiBesedilo: "V redu",
              samoEnGumb: true,
              stil: "primary",
            });
          }
        });
      }

      var checkboxEl = opts.potrditevEl.querySelector("#opomin-predaja-pregled-checkbox");
      var glavniGumb = opts.potrditevEl.querySelector("#opomin-predaja-pregled-dokoncaj");
      var zaposleno = false;

      function osveziGlavniGumb() {
        if (!glavniGumb) return;
        if (jeZeDokoncano) {
          glavniGumb.disabled = zaposleno || !N.soVsiSmsPotrjeni(plan);
          return;
        }
        glavniGumb.disabled =
          jePregled ||
          !N.moznaPredajaOdvetniku(lh) ||
          zaposleno ||
          !checkboxEl ||
          !checkboxEl.checked;
      }
      if (checkboxEl) {
        checkboxEl.addEventListener("change", function () {
          if (checkboxEl.checked && jePregled) {
            var preverjenoZaOsvezitev = N.preveriPogojeZaPripravoPredaje(
              plan,
              step.index,
              opts.podatkiKorak1,
              prilogeKoraka
            );
            if (preverjenoZaOsvezitev.ok) {
              plan = N.pripraviPredajoOdvetniku(
                plan,
                step.index,
                opts.podatkiKorak1,
                prilogeKoraka
              );
              step = N.najdiKorak(plan, step.index) || step;
              lh = step.lawyerHandoff || lh;
              snap = lh.preparedSnapshot || snap;
              jePregled = lh.status === "needs_review";
              shrani();
              var opozoriloPregleda = opts.potrditevEl.querySelector(
                ".opomin-predaja-pregled__opozorilo"
              );
              if (opozoriloPregleda && !jePregled) opozoriloPregleda.hidden = true;
            }
          }
          osveziGlavniGumb();
        });
      }
      osveziGlavniGumb();

      if (glavniGumb) {
        glavniGumb.addEventListener("click", function () {
          if (glavniGumb.disabled || zaposleno) return;
          if (jeZeDokoncano) {
            zaposleno = true;
            glavniGumb.disabled = true;
            glavniGumb.textContent = "Aktiviram načrt …";
            aktiviraj();
            return;
          }
          if (!checkboxEl || !checkboxEl.checked) return;
          shraniPregledSporocilo();
          zaposleno = true;
          glavniGumb.disabled = true;
          var nazajGumbRef = opts.potrditevEl.querySelector("#opomin-predaja-pregled-nazaj");
          if (nazajGumbRef) nazajGumbRef.disabled = true;
          var prejsnjeBesedilo = glavniGumb.textContent;
          glavniGumb.textContent = "Pripravljam paket …";
          setTimeout(async function () {
            try {
              var trenutniKorak = N.najdiKorak(plan, step.index);
              if (!trenutniKorak || !N.moznaPredajaOdvetniku(trenutniKorak.lawyerHandoff)) {
                throw new Error("Predaja ni več pripravljena – vrnite se na korak in paket pripravite znova.");
              }
              plan = N.potrdiCelotenNacrtZaOddajo(plan, step.index);
              N.shraniOsnutek(plan);
              /* Tudi posebni 10. korak mora biti v skupnem osnutku potrjen,
                 preden se zacne aktivacija in je mogoca osvezitev strani. */
              if (root.UJOpominKarticeSync) {
                await root.UJOpominKarticeSync.narociShranjevanje(plan);
              }
              if (N.soVsiSmsPotrjeni(plan)) {
                glavniGumb.textContent = "Aktiviram načrt …";
                aktiviraj();
                return;
              }
              throw new Error(
                "Preverite, ali imajo vsi vključeni koraki pripravljeno sporočilo."
              );
            } catch (napakaDokoncanja) {
              zaposleno = false;
              if (nazajGumbRef) nazajGumbRef.disabled = false;
              glavniGumb.textContent = prejsnjeBesedilo;
              osveziGlavniGumb();
              if (typeof opts.pokaziNapako === "function") {
                opts.pokaziNapako(
                  "Paketa ni bilo mogoče dokončati.",
                  napakaDokoncanja && napakaDokoncanja.message ? napakaDokoncanja.message : ""
                );
              }
            }
          }, 50);
        });
      }
    }

    function izrisiPotrditev(step) {
      var jeManual =
        step.kind === "manual_lawyer" || step.deliveryMode === "manual";

      if (jeManual) {
        izrisiPotrditevPredajeOdvetniku(step);
        return;
      }

      /* Prikazni red koraka: koliko neizključenih korakov je pred njim + 1 */
      var prikazniRedPotrditev = 0;
      var koraki = plan.steps || [];
      for (var ri = 0; ri < koraki.length; ri++) {
        if (!koraki[ri].isExcluded) prikazniRedPotrditev++;
        if (koraki[ri].index === step.index) break;
      }
      var tonOznaka = N.oznakaTona(step.toneId || plan.toneId);

      var k1 = opts.podatkiKorak1 || {};
      var k2Potrditev = opts.podatkiKorak2 || {};
      var primarniKontakti =
        step.primaryContacts ||
        k2Potrditev.sporociloKanali || { sms: true, email: true };

      function povzetekCasaPotrditev(korak) {
        var iso = prikazniCasKoraka(korak);
        if (!iso) return "Čas še ni določen";
        var odmik = dneviOdDanes(iso);
        var dan =
          odmik === 0
            ? "Danes"
            : odmik === 1
              ? "Jutri"
              : formatDatumSl(iso);
        return dan + " ob " + formatCasKratko(iso);
      }

      function prikazniRedKoraka(korak) {
        var red = 0;
        for (var i = 0; i < koraki.length; i++) {
          if (!koraki[i].isExcluded) red++;
          if (koraki[i].index === korak.index) return red;
        }
        return red;
      }

      var vkljuceniSamodejniPotrditev = koraki.filter(function (korak) {
        return (
          !korak.isExcluded &&
          korak.kind !== "manual_lawyer" &&
          korak.deliveryMode !== "manual"
        );
      });
      var barvniNivoPotrditev = dolociBarvniNivo(
        Math.max(0, vkljuceniSamodejniPotrditev.indexOf(step)),
        vkljuceniSamodejniPotrditev.length
      );
      var barvniRazredPotrditev =
        " opomin-nacrt__stage--eskalacija-" + barvniNivoPotrditev;

      function htmlKanalovPotrditev() {
        var kanali = [];
        if (primarniKontakti.sms !== false) kanali.push("SMS");
        if (primarniKontakti.email !== false) kanali.push("E-pošta");
        if (!kanali.length) return '<span class="opomin-nacrt-potrdi__kanal">Ni izbrano</span>';
        return kanali
          .map(function (kanal) {
            return '<span class="opomin-nacrt-potrdi__kanal">' + esc(kanal) + "</span>";
          })
          .join('<span class="opomin-nacrt-potrdi__kanal-locilo" aria-hidden="true"></span>');
      }

      function htmlNaslednjePotrditve() {
        var naslednji = N.najdiNaslednjiVkljuceniKorak(plan, step.index);
        var iso = naslednji && prikazniCasKoraka(naslednji);
        if (!naslednji || !iso) return "";
        var datum = new Date(iso);
        if (Number.isNaN(datum.getTime())) return "";
        var odmik = dneviOdDanes(iso);
        var oznaka =
          odmik === 0
            ? "Danes"
            : odmik === 1
              ? "Jutri"
              : N.oznakaCezDni(odmik);
        var dnevi = [
          "nedeljo",
          "ponedeljek",
          "torek",
          "sredo",
          "četrtek",
          "petek",
          "soboto",
        ];
        var casovniUvod =
          odmik === 0
            ? "Danes ob " + formatCasKratko(iso)
            : odmik === 1
              ? "Jutri, v " +
                dnevi[datum.getDay()] +
                " ob " +
                formatCasKratko(iso)
              : oznaka +
                ", v " +
                dnevi[datum.getDay()] +
                " ob " +
                formatCasKratko(iso);
        var naslednjiRed = prikazniRedKoraka(naslednji);
        var zvonec =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
        var barvniRazred =
          " opomin-nacrt-potrdi__obvestilo--barvno" +
          barvniRazredPotrditev;
        return (
          '<section class="opomin-nacrt-potrdi__obvestilo' +
          barvniRazred +
          '" aria-label="Naslednja potrditev">' +
          '<div class="opomin-nacrt-potrdi__obvestilo-glava">' +
          '<span class="opomin-nacrt-potrdi__obvestilo-ikona" aria-hidden="true">' +
          zvonec +
          "</span>" +
          '<span class="opomin-nacrt-potrdi__obvestilo-oznaka">Obvestilo za potrditev</span>' +
          '<strong class="opomin-nacrt-potrdi__obvestilo-korak">' +
          esc(String(naslednjiRed) + ". korak") +
          "</strong></div>" +
          '<strong class="opomin-nacrt-potrdi__obvestilo-naslov" data-obvestilo-auto-fit data-min-font="11">' +
          esc(
            casovniUvod +
              " boste prejeli obvestilo za potrditev " +
              naslednjiRed +
              ". koraka."
          ) +
          "</strong>" +
          '<span class="opomin-nacrt-potrdi__obvestilo-opis" data-obvestilo-auto-fit data-min-font="8.5"><strong>' +
          esc(naslednji.title || "Naslednji korak") +
          '</strong><span class="opomin-nacrt-potrdi__obvestilo-pika" aria-hidden="true">•</span><span>Pred potrditvijo ga boste lahko še enkrat pregledali.</span></span>' +
          "</section>"
        );
      }

      var rokPlacilaPotrditev =
        step.paymentDeadline && step.paymentDeadline.enabled
          ? step.paymentDeadline.days != null
            ? step.paymentDeadline.days + " dni"
            : "Vklopljeno"
          : "Izklopljeno";
      var readonly =
        '<section class="opomin-nacrt-potrdi__readonly opomin-nacrt-potrdi__readonly--barvno' +
        (jeManual ? "" : " opomin-nacrt-potrdi__readonly--kompakt") +
        barvniRazredPotrditev +
        '" aria-label="Ključne nastavitve koraka">' +
        '<div class="opomin-nacrt-potrdi__readonly-postavka">' +
        '<span class="opomin-nacrt-potrdi__readonly-ikona">' +
        IKONA_URA +
        '</span><span class="opomin-nacrt-potrdi__readonly-besedilo">' +
        '<span class="opomin-nacrt-potrdi__label">Pošiljanje</span>' +
        '<strong class="opomin-nacrt-potrdi__vrednost">' +
        esc(povzetekCasaPotrditev(step)) +
        "</strong></span></div>" +
        '<div class="opomin-nacrt-potrdi__readonly-postavka">' +
        '<span class="opomin-nacrt-potrdi__readonly-ikona">' +
        IKONA_EMAIL +
        '</span><span class="opomin-nacrt-potrdi__readonly-besedilo">' +
        '<span class="opomin-nacrt-potrdi__label">Kanal</span>' +
        '<strong class="opomin-nacrt-potrdi__vrednost opomin-nacrt-potrdi__kanali">' +
        htmlKanalovPotrditev() +
        "</strong></span></div>" +
        '<div class="opomin-nacrt-potrdi__readonly-postavka">' +
        '<span class="opomin-nacrt-potrdi__readonly-ikona">' +
        IKONA_TON +
        '</span><span class="opomin-nacrt-potrdi__readonly-besedilo">' +
        '<span class="opomin-nacrt-potrdi__label">Ton</span>' +
        '<strong class="opomin-nacrt-potrdi__vrednost">' +
        esc(tonOznaka) +
        "</strong></span></div>" +
        '<div class="opomin-nacrt-potrdi__readonly-postavka">' +
        '<span class="opomin-nacrt-potrdi__readonly-ikona">' +
        IKONA_ROK +
        '</span><span class="opomin-nacrt-potrdi__readonly-besedilo">' +
        '<span class="opomin-nacrt-potrdi__label">Rok plačila</span>' +
        '<strong class="opomin-nacrt-potrdi__vrednost">' +
        esc(rokPlacilaPotrditev) +
        "</strong></span></div>" +
        "</section>";
      var naslednjaPotrditevHtml = htmlNaslednjePotrditve();
      var zlozenPovzetekHtml = naslednjaPotrditevHtml
        ? '<div class="opomin-nacrt-potrdi__zlozen-povzetek">' +
          naslednjaPotrditevHtml +
          readonly +
          "</div>"
        : readonly;

      var smsBlock = jeManual
        ? '<p class="opomin-nacrt__rocni-tekst">Ta korak ne pošlje SMS-a. Potrditev pomeni, da boš predajo odvetniku izvedel ročno.</p>'
        : '<label class="opomin-nacrt-potrdi__sms-label" for="opomin-potrdi-sms">SMS sporočilo</label>' +
          '<textarea id="opomin-potrdi-sms" class="opomin-nacrt-potrdi__sms" rows="8" maxlength="1000">' +
          esc(step.finalMessage || step.generatedMessage) +
          "</textarea>" +
          '<p class="opomin-nacrt__gsm" id="opomin-potrdi-gsm" aria-live="polite"></p>';

      var prejemnikDeli = "";
      var prikazaniPrejemniki = {};
      function dodajPrejemnika(vrednost, ikona) {
        vrednost = String(vrednost || "").trim();
        if (!vrednost || prikazaniPrejemniki[vrednost]) return;
        prikazaniPrejemniki[vrednost] = true;
        prejemnikDeli +=
          '<span class="opomin-nacrt-potrdi__prejemnik-postavka">' +
          '<span class="opomin-nacrt-potrdi__prejemnik-ikona" aria-hidden="true">' +
          ikona +
          "</span>" +
          esc(vrednost) +
          "</span>";
      }
      if (primarniKontakti.sms !== false) dodajPrejemnika(k1.telefonDolznika, IKONA_SMS);
      var dodatniKontakti = step.customContacts || {};
      (Array.isArray(dodatniKontakti.phoneNumbers) ? dodatniKontakti.phoneNumbers : []).forEach(function (telefon) {
        dodajPrejemnika(telefon, IKONA_SMS);
      });
      if (primarniKontakti.email !== false) dodajPrejemnika(k1.emailDolznika, IKONA_EMAIL);
      (Array.isArray(dodatniKontakti.emailAddresses) ? dodatniKontakti.emailAddresses : []).forEach(function (email) {
        dodajPrejemnika(email, IKONA_EMAIL);
      });
      var prejemnikHtml = prejemnikDeli
        ? '<div class="opomin-nacrt-potrdi__prejemnik">' + prejemnikDeli + "</div>"
        : "";

      var prilogeHtml = "";
      if (prilogeKoraka.length) {
        prilogeHtml =
          '<section class="opomin-nacrt-potrdi__priloge" aria-label="Priložene priloge">' +
          '<p class="opomin-nacrt-potrdi__priloge-naslov">Priložene priloge</p>' +
          '<div class="opomin-nacrt-potrdi__priloge-seznam">' +
          prilogeKoraka
            .map(function (p) {
              var ime = p.originalFileName || "Račun";
              var jePdf =
                (p.mimeType && p.mimeType.indexOf("pdf") >= 0) ||
                /\.pdf$/i.test(ime);
              var jeSlika = jeSlikaPriloga(p) && !jePdf;
              return (
                '<div class="opomin-nacrt-potrdi__priloga" data-priloga-id="' +
                esc(p.id) +
                '">' +
                '<span class="opomin-nacrt-potrdi__priloga-predogled" data-priloga-predogled="' +
                esc(p.id) +
                '" aria-hidden="true">' +
                (jeSlika ? IKONA_SLIKA : IKONA_DOKUMENT) +
                "</span>" +
                '<span class="opomin-nacrt-potrdi__priloga-ime">' +
                esc(ime) +
                "</span>" +
                '<button type="button" class="opomin-nacrt-potrdi__priloga-odstrani" data-priloga-odstrani="' +
                esc(p.id) +
                '" aria-label="Odstrani ' +
                esc(ime) +
                '">×</button>' +
                "</div>"
              );
            })
            .join("") +
          "</div>" +
          "</section>";
      }

      opts.potrditevEl.innerHTML =
        '<div class="opomin-nacrt-potrdi__vsebina">' +
        '<header class="opomin-nacrt-potrdi__glava">' +
        '<div class="opomin-nacrt-potrdi__glava-besedilo"><h2 class="opomin-nacrt-potrdi__naslov">Preglej ' +
        esc(String(prikazniRedPotrditev)) +
        ". korak</h2>" +
        '<p class="opomin-nacrt-potrdi__podnaslov">' +
        esc(step.title) +
        "</p></div>" +
        '<button type="button" class="opomin-nacrt-potrdi__izbrisi-zgoraj" id="opomin-potrdi-izbrisi">Izbriši ' +
        esc(String(prikazniRedPotrditev)) +
        ". korak</button></header>" +
        prejemnikHtml +
        zlozenPovzetekHtml +
        smsBlock +
        prilogeHtml +
        '<footer class="opomin-nacrt__noga opomin-nacrt__noga--stolpec">' +
        '<div class="opomin-nacrt__noga-vrsta opomin-nacrt__noga-vrsta--potrditev">' +
        '<button type="button" class="opomin-nacrt__izbrisi-korak opomin-nacrt__izbrisi-korak--nazaj" id="opomin-potrdi-nazaj-2" aria-label="Nazaj na korak ' +
        esc(String(prikazniRedPotrditev)) +
        '">← Nazaj</button>' +
        '<button type="button" class="korak2__gumb-naprej" id="opomin-potrdi-shrani">' +
        esc(besediloGumbaPotrdi(step)) +
        "</button>" +
        "</div>" +
        "</footer>" +
        "</div>";

      /* Prvih devet kartic uporablja kompaktni 2 × 2 povzetek. Višina vsake
         celice je 30 % manjša, daljša vrednost pa se zmanjša samo znotraj
         svojega polja, zato kartica ostane fiksna in nič ni odrezano. */
      function prilagodiKompaktneNastavitve() {
        opts.potrditevEl
          .querySelectorAll(
            ".opomin-nacrt-potrdi__readonly--kompakt .opomin-nacrt-potrdi__vrednost"
          )
          .forEach(function (el) {
            var ovoj = el.closest(".opomin-nacrt-potrdi__readonly-besedilo");
            if (!ovoj) return;
            el.style.removeProperty("font-size");
            var velikost = parseFloat(root.getComputedStyle(el).fontSize) || 13;
            var najmanjsa = 9.5;
            var varovalo = 12;
            while (
              velikost > najmanjsa &&
              varovalo-- > 0 &&
              (ovoj.scrollHeight > ovoj.clientHeight + 1 ||
                el.scrollWidth > el.clientWidth + 1)
            ) {
              velikost = Math.max(najmanjsa, velikost - 0.5);
              el.style.fontSize = velikost + "px";
            }
          });
      }

      root.requestAnimationFrame(prilagodiKompaktneNastavitve);
      if (opts.potrditevEl._kompaktneNastavitveObserver) {
        opts.potrditevEl._kompaktneNastavitveObserver.disconnect();
      }
      var kompaktniReadonly = opts.potrditevEl.querySelector(
        ".opomin-nacrt-potrdi__readonly--kompakt"
      );
      if (kompaktniReadonly && typeof root.ResizeObserver === "function") {
        opts.potrditevEl._kompaktneNastavitveObserver = new root.ResizeObserver(
          function () {
            root.requestAnimationFrame(prilagodiKompaktneNastavitve);
          }
        );
        opts.potrditevEl._kompaktneNastavitveObserver.observe(kompaktniReadonly);
      }

      function prilagodiKompaktnoObvestilo() {
        opts.potrditevEl
          .querySelectorAll("[data-obvestilo-auto-fit]")
          .forEach(function (el) {
            el.style.removeProperty("font-size");
            var velikost = parseFloat(root.getComputedStyle(el).fontSize) || 12;
            var najmanjsa = Number(el.getAttribute("data-min-font")) || 8.5;
            var varovalo = 14;
            while (
              velikost > najmanjsa &&
              varovalo-- > 0 &&
              (el.scrollHeight > el.clientHeight + 1 ||
                el.scrollWidth > el.clientWidth + 1)
            ) {
              velikost = Math.max(najmanjsa, velikost - 0.5);
              el.style.fontSize = velikost + "px";
            }
          });
      }

      root.requestAnimationFrame(prilagodiKompaktnoObvestilo);
      if (opts.potrditevEl._kompaktnoObvestiloObserver) {
        opts.potrditevEl._kompaktnoObvestiloObserver.disconnect();
      }
      var kompaktnoObvestilo = opts.potrditevEl.querySelector(
        ".opomin-nacrt-potrdi__obvestilo"
      );
      if (kompaktnoObvestilo && typeof root.ResizeObserver === "function") {
        opts.potrditevEl._kompaktnoObvestiloObserver = new root.ResizeObserver(
          function () {
            root.requestAnimationFrame(prilagodiKompaktnoObvestilo);
          }
        );
        opts.potrditevEl._kompaktnoObvestiloObserver.observe(kompaktnoObvestilo);
      }

      var ta = opts.potrditevEl.querySelector("#opomin-potrdi-sms");
      var gsmEl = opts.potrditevEl.querySelector("#opomin-potrdi-gsm");
      var gumbPotrdi = opts.potrditevEl.querySelector("#opomin-potrdi-shrani");

      function osveziPotrdiGumb() {
        if (!gumbPotrdi) return;
        if (jeManual) {
          gumbPotrdi.disabled = false;
          return;
        }
        gumbPotrdi.disabled = !(ta && ta.value.trim());
      }

      if (ta) {
        if (gsmEl) {
          gsmEl.textContent = gsmLabel(Gsm, ta.value);
        }
        osveziPotrdiGumb();
        ta.addEventListener("input", function () {
          osveziPotrdiGumb();
          if (gsmEl) gsmEl.textContent = gsmLabel(Gsm, ta.value);
          plan = N.posodobiSporociloKoraka(plan, step.index, ta.value);
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(function () {
            shrani();
          }, 500);
        });
      } else {
        osveziPotrdiGumb();
      }

      if (typeof opts.pridobiUrlPriloge === "function") {
        opts.potrditevEl
          .querySelectorAll("[data-priloga-predogled]")
          .forEach(function (predogled) {
            var id = predogled.getAttribute("data-priloga-predogled");
            var priloga = prilogeKoraka.find(function (p) {
              return p.id === id;
            });
            if (!priloga || !priloga.storagePath) return;
            var jeSlika = jeSlikaPriloga(priloga);
            if (jeSlika) {
              opts.pridobiUrlPriloge(priloga.storagePath).then(function (rez) {
                if (!predogled.isConnected || !rez || !rez.url) return;
                var img = document.createElement("img");
                img.src = rez.url;
                img.alt = "";
                predogled.classList.add(
                  "opomin-nacrt-potrdi__priloga-predogled--slika"
                );
                predogled.replaceChildren(img);
              });
            }
            predogled.classList.add(
              "opomin-nacrt-potrdi__priloga-predogled--klik"
            );
            predogled.setAttribute("role", "button");
            predogled.setAttribute("tabindex", "0");
            predogled.setAttribute(
              "aria-label",
              "Odpri predogled " + (priloga.originalFileName || "računa")
            );
            function odpriPredogled() {
              opts.pridobiUrlPriloge(priloga.storagePath).then(function (rez) {
                if (!rez || !rez.url) return;
                if (jeSlika) {
                  odpriPrilogeLightbox(rez.url);
                } else {
                  window.open(rez.url, "_blank");
                }
              });
            }
            predogled.addEventListener("click", odpriPredogled);
            predogled.addEventListener("keydown", function (ev) {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                odpriPredogled();
              }
            });
          });
      }

      opts.potrditevEl
        .querySelectorAll("[data-priloga-odstrani]")
        .forEach(function (btn) {
          btn.addEventListener("click", function () {
            var id = btn.getAttribute("data-priloga-odstrani");
            var idx = prilogeKoraka.findIndex(function (p) {
              return p.id === id;
            });
            if (idx < 0) return;
            prilogeKoraka.splice(idx, 1);
            sinhronizirajPrilogeVKorak1();
            izrisiPotrditev(step);
          });
        });

      function nazaj() {
        clearTimeout(debounceTimer);
        shrani();
        pokaziGlavni();
      }

      var n1 = opts.potrditevEl.querySelector("#opomin-potrdi-nazaj");
      var n2 = opts.potrditevEl.querySelector("#opomin-potrdi-nazaj-2");
      if (n1) n1.addEventListener("click", nazaj);
      if (n2) n2.addEventListener("click", nazaj);

      var gumbIzbrisiKorak = opts.potrditevEl.querySelector("#opomin-potrdi-izbrisi");
      if (gumbIzbrisiKorak) {
        gumbIzbrisiKorak.addEventListener("click", async function () {
          if (step.index === 1) {
            if (typeof opts.potrdiVprasanje === "function") {
              await opts.potrdiVprasanje({
                naslov: "Brisanje ni mogoče",
                opis: "Prvi korak je obvezen in ga ni mogoče izbrisati.",
                potrdiBesedilo: "V redu",
                samoEnGumb: true,
                stil: "primary",
              });
            }
            return;
          }
          if (step.kind === "manual_lawyer") {
            if (typeof opts.potrdiVprasanje === "function") {
              await opts.potrdiVprasanje({
                naslov: "Brisanje ni mogoče",
                opis: "Zadnji korak »Predaja odvetniku« je obvezen in ga ni mogoče izbrisati.",
                potrdiBesedilo: "V redu",
                samoEnGumb: true,
                stil: "primary",
              });
            }
            return;
          }
          var smsCount = typeof N.steviloSmsKorakov === "function" ? N.steviloSmsKorakov(plan) : 0;
          if (step.kind === "sms" && smsCount <= 1) {
            if (typeof opts.potrdiVprasanje === "function") {
              await opts.potrdiVprasanje({
                naslov: "Odstranitev ni mogoča",
                opis: "Načrt mora vsebovati vsaj en samodejni korak. Tega koraka ne moreš odstraniti.",
                potrdiBesedilo: "V redu",
                samoEnGumb: true,
                stil: "primary",
              });
            }
            return;
          }
          var potrjeno = false;
          if (typeof opts.potrdiVprasanje === "function") {
            potrjeno = await opts.potrdiVprasanje({
              naslov: "Izbriši korak?",
              opis: "Korak »" + (step.title || "") + "« bo izbrisan. Preostali koraki se samodejno preštevilčijo.",
              potrdiBesedilo: "Izbriši",
              prekliciBesedilo: "Prekliči",
              stil: "nevarno",
            });
          }
          if (!potrjeno) return;
          clearTimeout(debounceTimer);
          if (typeof N.odstraniKorak === "function") {
            plan = N.odstraniKorak(plan, step.index);
          }
          preklopiAktivniKorak(plan.steps[0] ? plan.steps[0].index : 1);
          plan.selectedStageId = plan.steps[0] ? plan.steps[0].id : null;
          urejanjeKarticeIndex = null;
          urejanjeKartic = false;
          N.shraniOsnutek(plan);
          pokaziGlavni();
        });
      }

      async function izvediPotrditev() {
        try {
          if (!jeManual && jeCasKorakaIzvenDovoljenega(plan, step)) {
            var dovoljenoOkno = dovoljenoOknoKoraka(plan, step);
            if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                "Koraka ni mogoče potrditi. Uro nastavi med " +
                  dovoljenoOkno.start +
                  " in " +
                  dovoljenoOkno.end +
                  "."
              );
            }
            return;
          }
          gumbPotrdi.disabled = true;
          clearTimeout(debounceTimer);
          debounceTimer = null;

          /* Če je vklopljen Random in čas še ni izračunan, ga izračunaj. */
          var rs = step._randomSchedule;
          if (rs && rs.enabled && !rs.resolvedScheduledAt) {
            var zadevaId = (opts.podatkiKorak1 && opts.podatkiKorak1.zadevaId) || null;
            var baseIso = step.sendAt || step.scheduledAt;

            if (zadevaId && baseIso) {
              /* Produkcijska pot: kliči API za strežniški izračun. */
              try {
                var authToken = "";
                try {
                  var session = (typeof supabaseKlient !== "undefined" && supabaseKlient && supabaseKlient.auth)
                    ? (await supabaseKlient.auth.getSession()).data.session
                    : null;
                  authToken = (session && session.access_token) || "";
                } catch (_at) {}
                var apiRes = await fetch("/api/potrdi-korak", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": authToken ? "Bearer " + authToken : "",
                  },
                  body: JSON.stringify({ zadevaId: zadevaId, stepIndex: step.index, version: plan.version || "0" }),
                });
                var apiData = await apiRes.json();
                if (apiData.ok) {
                  plan.version = apiData.version || plan.version;
                  if (apiData.resolvedScheduledAt) {
                    rs.resolvedScheduledAt = apiData.resolvedScheduledAt;
                    rs.resolvedAt = new Date().toISOString();
                    step.sendAt = apiData.resolvedScheduledAt;
                    plan = N.posodobiCasKoraka(plan, step.index, apiData.resolvedScheduledAt, { shiftFollowing: false });
                  }
                } else {
                  var opis = apiData.napaka || "Koraka trenutno ni bilo mogoče potrditi. Poskusite znova.";
                  if (apiData.code === "VERSION_CONFLICT") opis = "Podatki so zastareli. Osvežite stran.";
                  if (typeof opts.potrdiVprasanje === "function") {
                    await opts.potrdiVprasanje({ naslov: "Napaka", opis: opis, potrdiBesedilo: "V redu", samoEnGumb: true, stil: "primary" });
                  }
                  gumbPotrdi.disabled = false;
                  return;
                }
              } catch (_apiErr) {
                if (typeof opts.potrdiVprasanje === "function") {
                  await opts.potrdiVprasanje({ naslov: "Strežnik ni dosegljiv", opis: "Koraka trenutno ni bilo mogoče potrditi. Poskusite znova.", potrdiBesedilo: "V redu", samoEnGumb: true, stil: "primary" });
                }
                gumbPotrdi.disabled = false;
                return;
              }
            } else if (baseIso) {
              /* Nov osnutek (brez zadevaId): lokalni CSPRNG samo kot predogled.
                 Pravi resolvedScheduledAt bo določil strežnik po shranitvi zadeve. */
              ustvariRandomPredogled(step, rs);
            }
          }

          /* Najprej shrani dodatke trenutnega koraka. Če bi shrani() klicali
             po potrditvi, bi syncStageDodatki potrjeni korak vrnil v pregled. */
          shrani();
          plan = N.potrdiKorak(
            plan,
            step.index,
            jeManual ? "" : ta.value
          );
          var potrjeniKorak = N.najdiKorak(plan, step.index);
          if (!potrjeniKorak || potrjeniKorak.status !== "confirmed") {
            throw new Error("Koraka ni bilo mogoče potrditi.");
          }
          var naslednjiKorak = N.najdiNaslednjiVkljuceniKorak(
            plan,
            step.index
          );
          if (naslednjiKorak) {
            preklopiAktivniKorak(naslednjiKorak.index);
            plan.selectedStageId = naslednjiKorak.id;
            N.shraniOsnutek(plan);
            /* Potrjeno stanje mora prispeti v skupni osnutek PREDEN uporabnik
               dobi naslednjo kartico. Prejsnji klic shrani() je namenoma
               shranil dodatke tik pred potrditvijo, zato je lahko ob hitri
               osvezitvi iz baze prisla se njegova starejsa, nepotrjena kopija. */
            if (root.UJOpominKarticeSync) {
              await root.UJOpominKarticeSync.narociShranjevanje(plan);
            }
            pokaziGlavni();
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            requestAnimationFrame(function () {
              poravnajKarticoVKaruselu(aktivenIndex, "smooth");
            });
            return;
          }
          preklopiAktivniKorak(step.index);
          plan.selectedStageId = step.id;
          N.shraniOsnutek(plan);
          if (root.UJOpominKarticeSync) {
            await root.UJOpominKarticeSync.narociShranjevanje(plan);
          }
          pokaziGlavni();
          window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        } catch (napakaPotrditve) {
          osveziPotrdiGumb();
          if (typeof opts.pokaziNapako === "function") {
            opts.pokaziNapako(
              "Potrditev koraka ni uspela.",
              napakaPotrditve && napakaPotrditve.message
                ? napakaPotrditve.message
                : String(napakaPotrditve)
            );
          }
        }
      }

      /* Kratka veselo-praznična animacija gumba (skoči proti sredini,
         se skrči in izgine, za sabo pusti zvezdice) - šele nato se
         dejansko izvede potrditev in preklop na naslednji korak. */
      function animirajInPotrdi() {
        var zvezdiceOvoj = document.createElement("span");
        zvezdiceOvoj.className = "opomin-potrdi-zvezdice";
        zvezdiceOvoj.setAttribute("aria-hidden", "true");
        var stKotov = 6;
        for (var i = 0; i < stKotov; i++) {
          var z = document.createElement("span");
          z.className = "opomin-potrdi-zvezdica";
          z.textContent = "★";
          var kot = (360 / stKotov) * i;
          z.style.setProperty("--kot", kot + "deg");
          z.style.animationDelay = i * 25 + "ms";
          zvezdiceOvoj.appendChild(z);
        }
        gumbPotrdi.appendChild(zvezdiceOvoj);
        gumbPotrdi.classList.add("opomin-potrdi-shrani--skoci");
        gumbPotrdi.disabled = true;
        window.setTimeout(izvediPotrditev, 680);
      }

      if (gumbPotrdi) {
        gumbPotrdi.addEventListener("click", function () {
          if (!jeManual && jeCasKorakaIzvenDovoljenega(plan, step)) {
            var okno = dovoljenoOknoKoraka(plan, step);
            if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                "Koraka ni mogoče potrditi. Uro nastavi med " +
                  okno.start +
                  " in " +
                  okno.end +
                  "."
              );
            }
            return;
          }
          if (!jeManual && (!ta || !ta.value.trim())) {
            if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                "SMS sporočilo je prazno – dopolni ga pred potrditvijo."
              );
            }
            return;
          }
          /* Potrditev ne sme biti odvisna od zaključka vizualne animacije. */
          izvediPotrditev();
        });
      }
    }

    async function aktiviraj() {
      if (!N.soVsiSmsPotrjeni(plan)) return;
      var neveljavniKorak = prviKorakZNeveljavnoUro(plan);
      if (neveljavniKorak) {
        var okno = dovoljenoOknoKoraka(plan, neveljavniKorak);
        preklopiAktivniKorak(neveljavniKorak.index);
        plan.selectedStageId = neveljavniKorak.id;
        shrani();
        izrisiGlavni();
        if (typeof opts.pokaziNapako === "function") {
          opts.pokaziNapako(
            "Načrta ni mogoče aktivirati. V " +
              neveljavniKorak.index +
              ". koraku ponastavi uro med " +
              okno.start +
              " in " +
              okno.end +
              "."
          );
        }
        return;
      }
      var cta = opts.glavniEl.querySelector("#opomin-nacrt-cta");
      if (cta) cta.disabled = true;
      try {
        plan = N.oznaciAktiviran(plan);
        shrani();
        await opts.aktivirajNacrt(plan);
      } catch (e) {
        plan.status = "ready_to_activate";
        shrani();
        if (cta) cta.disabled = false;
        if (typeof opts.pokaziNapako === "function") {
          opts.pokaziNapako(
            "Načrta ni bilo mogoče aktivirati.",
            e && e.message ? e.message : ""
          );
        }
        izrisiGlavni();
      }
    }

    pokaziGlavni();

    return {
      getPlan: function () {
        return plan;
      },
      osvezi: function () {
        plan = N.pridobiAliUstvari(opts.podatkiKorak1, opts.podatkiKorak2);
        if (urejevanIndex != null) {
          var s = N.najdiKorak(plan, urejevanIndex);
          if (s) izrisiPotrditev(s);
          else pokaziGlavni();
        } else {
          izrisiGlavni();
        }
      },
    };
  }

  root.UJOpominNacrtUI = {
    inicializiraj: inicializiraj,
    dolociBarvniNivo: dolociBarvniNivo,
    ustvariFokusniTrap: ustvariFokusniTrap,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      inicializiraj: inicializiraj,
      dolociBarvniNivo: dolociBarvniNivo,
      ustvariFokusniTrap: ustvariFokusniTrap,
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
