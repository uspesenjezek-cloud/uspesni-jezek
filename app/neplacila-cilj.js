(function () {
  "use strict";

  var debug = window.UJPoravnavaWidget;
  var K = window.UJIzvedbaKomponente;
  var root = document.getElementById("izvedba-action-sheet");
  var nacin = "natural";
  var naravniOpis = "";
  var korak1 = null;
  var SELECTOR_NADALJUJ = "[data-zgodovina-nadaljuj], [data-action-sheet-confirm]";

  try {
    korak1 = JSON.parse(sessionStorage.getItem("neplacilo-korak1-podatki") || "null");
  } catch (_napaka) {
    korak1 = null;
  }

  if (!korak1 || !Number(korak1.znesek) || !debug || !debug.state || !root || !K) {
    var napaka = document.getElementById("cilj-napaka");
    if (napaka) {
      napaka.textContent = "Izbire cilja trenutno ni mogoče odpreti.";
      napaka.hidden = false;
    }
    return;
  }

  function naravniVnosHtml() {
    return '<section class="zgodovina-ai" aria-label="Povejte ali napišite cilj">' +
      '<label class="zgodovina-ai__vnos"><span class="sr-only">Opis želenega cilja</span>' +
      '<textarea maxlength="2000" data-cilj-opis placeholder="Npr. želim čimprejšnje plačilo …"></textarea></label>' +
      '<div class="zgodovina-ai__akcije">' +
      '<button type="button" class="zgodovina-ai__snemaj" data-cilj-prihodnja-funkcija aria-label="Povej na glas">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg><span class="zgodovina-ai__snemaj-napis"><span>Povej</span><span>na glas</span></span></button>' +
      '<button type="button" class="zgodovina-ai__razumi" data-cilj-prihodnja-funkcija>Pripravi možnosti</button>' +
      '</div></section>';
  }

  function nacinaHtml() {
    return '<section class="zgodovina-nacina" data-cilj-nacina aria-label="Način izbire cilja">' +
      '<div class="zgodovina-nacina__izbira" role="tablist" aria-label="Način izbire cilja">' +
      '<button type="button" role="tab" data-cilj-nacin="natural" aria-selected="' + String(nacin === "natural") + '" class="' + (nacin === "natural" ? "is-selected" : "") + '">' +
      '<span aria-hidden="true">' + K.ikona("pencil") + '</span><strong>Povej ali napiši</strong><small>Hitrejši vnos</small></button>' +
      '<button type="button" role="tab" data-cilj-nacin="manual" aria-selected="' + String(nacin === "manual") + '" class="' + (nacin === "manual" ? "is-selected" : "") + '">' +
      '<span aria-hidden="true">' + K.ikona("checkCircle") + '</span><strong>Ročno izberi</strong><small>Obstoječe kartice</small></button>' +
      '</div>' + (nacin === "natural" ? naravniVnosHtml() : '') + '</section>';
  }

  function zamenjajBesediloNaslova(element, besedilo) {
    if (!element) return;
    var vozlisce = Array.prototype.find.call(element.childNodes, function (item) {
      return item.nodeType === 3;
    });
    if (vozlisce) vozlisce.nodeValue = " " + besedilo + " ";
  }

  window.UJZgodovinaPoIzrisu = function (state, vsebnik) {
    var panel = vsebnik.querySelector(".izvedba-action-sheet__panel");
    if (panel) {
      panel.removeAttribute("aria-modal");
      panel.setAttribute("role", "region");
    }

    var glava = vsebnik.querySelector(".izvedba-action-sheet__header");
    if (glava) {
      glava.classList.add("zgodovina-ai-glava--z-izbrisom");
      var naslov = glava.querySelector("h2");
      var opis = glava.querySelector("p");
      if (naslov) naslov.textContent = "Kaj želite, da se zgodi?";
      if (opis) opis.textContent = "Izberite, kaj želite doseči s tem dolgom.";
      if (!glava.querySelector("[data-cilj-izbrisi]")) {
        glava.insertAdjacentHTML(
          "beforeend",
          '<button type="button" class="zgodovina-ai-pogovor__izbrisi-vse" data-cilj-izbrisi' +
            (state.nacrtKoraki.length ? "" : " disabled") +
            ' aria-label="Izbriši vse izbrane možnosti"><span aria-hidden="true">' +
            K.ikona("trash") +
            '</span><span>Izbriši</span></button>'
        );
      }
    }

    var obstojeciNacini = vsebnik.querySelector("[data-cilj-nacina]");
    if (obstojeciNacini) obstojeciNacini.remove();
    var cone = vsebnik.querySelectorAll(".izvedba-poravnava-cona");
    if (cone[0]) cone[0].insertAdjacentHTML("beforebegin", nacinaHtml());
    if (nacin === "natural") {
      if (cone[0]) cone[0].hidden = true;
      if (cone[1]) cone[1].hidden = true;
      var opisPolje = vsebnik.querySelector("[data-cilj-opis]");
      if (opisPolje) opisPolje.value = naravniOpis;
    }

    var potek = cone.length ? cone[cone.length - 1] : null;
    if (potek) {
      var potekNaslov = potek.querySelector(".izvedba-poravnava-cona__naslov");
      zamenjajBesediloNaslova(potekNaslov, "Izbrani cilj");
      var stevec = potek.querySelector(".izvedba-poravnava-cona__stevilo-korakov");
      if (stevec) {
        stevec.textContent = state.nacrtKoraki.length +
          (state.nacrtKoraki.length === 1 ? " možnost" : " možnosti");
      }
      var prazno = potek.querySelector(".izvedba-poravnava-potek__prazno");
      if (prazno) prazno.textContent = "Cilj še ni izbran.";
    }

    var nadaljuj = vsebnik.querySelector(SELECTOR_NADALJUJ);
    if (nadaljuj) nadaljuj.textContent = "Nadaljuj";
  };

  var state = debug.state;
  state.globalnaNapaka = null;
  state.error = null;
  state.zadeva = {
    prvotniZnesek: Number(korak1.znesek),
    preostaliDolg: Number(korak1.znesek),
    znesek: Number(korak1.znesek),
  };
  state.ukrepi = [];
  state.nacrtKoraki = [];
  state.selectedSettlementType = null;
  state.actionSheetOpen = true;
  state.actionSheetMode = "payment";
  state.actionSheetStep = "izbira";

  root.addEventListener("click", function (dogodek) {
    var preklop = dogodek.target.closest("[data-cilj-nacin]");
    if (preklop) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      nacin = preklop.getAttribute("data-cilj-nacin") === "manual" ? "manual" : "natural";
      state.selectedSettlementType = null;
      state.error = null;
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-cilj-izbrisi]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      state.nacrtKoraki = [];
      state.selectedSettlementType = null;
      state.error = null;
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest(SELECTOR_NADALJUJ)) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      window.location.href = "neplacila-posiljanje.html";
      return;
    }
    if (dogodek.target.closest("[data-cilj-prihodnja-funkcija]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
    }
  }, true);

  root.addEventListener("input", function (dogodek) {
    if (dogodek.target.matches("[data-cilj-opis]")) {
      naravniOpis = dogodek.target.value.slice(0, 2000);
    }
  }, true);

  if (typeof window.UJInicializirajWizardProgressHeader === "function") {
    window.UJInicializirajWizardProgressHeader(3);
  }
  debug.izrisiActionSheet();
})();
