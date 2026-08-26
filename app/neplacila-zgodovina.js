(function () {
  "use strict";

  var KLJUC_KORAK1 = "neplacilo-korak1-podatki";
  var KLJUC_ZGODOVINA = "neplacilo-zgodovina-podatki";
  var debug = window.UJPoravnavaWidget;
  var customActive = false;
  var customDraft = { opis: "", datum: new Date().toISOString().slice(0, 10) };

  function preberiJson(kljuc) {
    try { return JSON.parse(sessionStorage.getItem(kljuc) || "null"); }
    catch (_napaka) { return null; }
  }

  function esc(vrednost) {
    return String(vrednost == null ? "" : vrednost)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var korak1 = preberiJson(KLJUC_KORAK1);
  if (!korak1 || !String(korak1.imeDolznika || "").trim() || !Number(korak1.znesek)) {
    window.location.replace("neplacila.html#obrazec");
    return;
  }
  if (!debug || !debug.state) {
    var napaka = document.getElementById("zgodovina-napaka");
    if (napaka) {
      napaka.textContent = "Vnosa zgodovine trenutno ni mogoče odpreti.";
      napaka.hidden = false;
    }
    return;
  }

  var shranjeno = preberiJson(KLJUC_ZGODOVINA) || {};
  if (shranjeno.drugoOsnutek) customDraft = shranjeno.drugoOsnutek;

  function shrani(potrjena) {
    sessionStorage.setItem(KLJUC_ZGODOVINA, JSON.stringify({
      potrjena: potrjena === true,
      dogodki: debug.state.nacrtKoraki || [],
      settlementSettings: debug.state.settlementSettings || {},
      settingsByAction: debug.state.settingsByAction || {},
      drugoOsnutek: customDraft,
      preostaliZnesek: Math.max(0, Number(korak1.znesek) - (debug.state.nacrtKoraki || []).reduce(function (vsota, korak) {
        return vsota + (Number(korak.znesek) || 0);
      }, 0)),
    }));
  }

  function izrisiDrugoPodrobnosti(root) {
    var cone = root.querySelectorAll(".izvedba-poravnava-cona");
    if (cone.length < 2) return;
    var podrobnosti = root.querySelector("[data-zgodovina-podrobnosti]") || cone[1];
    podrobnosti.hidden = false;
    podrobnosti.innerHTML =
      '<p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">2</span>Opišite dogodek</p>' +
      '<div class="izvedba-poravnava-podrobnosti izvedba-poravnava-podrobnosti--drugo">' +
        '<div class="izvedba-poravnava-podrobnosti__naslov">Drugo</div>' +
        '<p class="izvedba-poravnava-podrobnosti__opis">Na kratko zapišite, kaj se je zgodilo.</p>' +
        '<textarea class="zgodovina-drugo__polje" data-zgodovina-drugo-opis maxlength="300" placeholder="Npr. dolžnik je prosil za nov rok plačila …">' + esc(customDraft.opis) + '</textarea>' +
        '<label class="zgodovina-drugo__datum">Datum dogodka<input type="date" data-zgodovina-drugo-datum value="' + esc(customDraft.datum) + '" /></label>' +
        '<button type="button" class="izvedba-poravnava-dodaj-korak" data-zgodovina-drugo-dodaj>+ Dodaj dogodek</button>' +
      '</div>';
  }

  window.UJZgodovinaPoIzrisu = function (_state, root) {
    var svicer = root.querySelector(".izvedba-poravnava-svicer");
    if (svicer && !svicer.querySelector("[data-zgodovina-drugo]")) {
      var gumb = document.createElement("button");
      gumb.type = "button";
      gumb.className = "izvedba-poravnava-svicer__gumb izvedba-poravnava-svicer__gumb--drugo" + (customActive ? " is-selected" : "");
      gumb.setAttribute("data-zgodovina-drugo", "");
      gumb.setAttribute("aria-pressed", customActive ? "true" : "false");
      gumb.disabled = Boolean(svicer.querySelector("[data-settlement-select]:disabled"));
      gumb.innerHTML = '<span class="izvedba-poravnava-svicer__ikona" aria-hidden="true">' + window.UJIzvedbaKomponente.ikona("pencil") + '</span><span>Drugo / opiši sam</span>';
      svicer.appendChild(gumb);
    }
    if (customActive) izrisiDrugoPodrobnosti(root);
    shrani(false);
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
  state.nacrtKoraki = Array.isArray(shranjeno.dogodki) ? shranjeno.dogodki : [];
  if (shranjeno.settlementSettings) state.settlementSettings = Object.assign(state.settlementSettings, shranjeno.settlementSettings);
  if (shranjeno.settingsByAction) state.settingsByAction = Object.assign(state.settingsByAction, shranjeno.settingsByAction);
  state.selectedSettlementType = null;
  state.actionSheetOpen = true;
  state.actionSheetMode = "payment";
  state.actionSheetStep = "izbira";

  var root = document.getElementById("izvedba-action-sheet");
  if (window.UJOcenaTveganja && typeof window.UJOcenaTveganja.inicializirajUIOceno === "function") {
    window.UJOcenaTveganja.inicializirajUIOceno();
    window.UJOcenaTveganja.osveziKartice();
  }
  var ocenaTveganja = document.getElementById("ocena-tveganja");
  if (ocenaTveganja) {
    ocenaTveganja.addEventListener("click", function (dogodek) {
      if (!dogodek.target.closest("[data-zgodovina-zamud]")) return;
      var napakaOcene = document.getElementById("zgodovina-napaka");
      if (napakaOcene) napakaOcene.hidden = true;
    });
  }
  root.addEventListener("click", function (dogodek) {
    var potrdi = dogodek.target.closest("[data-action-sheet-confirm]");
    if (potrdi) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var zgodovinaZamud = document.querySelector(
        '#ocena-tveganja [data-zgodovina-zamud][aria-pressed="true"]'
      );
      if (!zgodovinaZamud) {
        var ocena = document.getElementById("ocena-tveganja");
        var napakaOcene = document.getElementById("zgodovina-napaka");
        if (napakaOcene) {
          napakaOcene.textContent = "Izberite, ali je dolžnik že kdaj zamudil s plačilom.";
          napakaOcene.hidden = false;
        }
        if (ocena) ocena.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      shrani(true);
      window.location.href = "neplacila-posiljanje.html";
      return;
    }
    if (dogodek.target.closest("[data-zgodovina-drugo]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      customActive = true;
      state.selectedSettlementType = null;
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-settlement-select]")) customActive = false;
    var dodajDrugo = dogodek.target.closest("[data-zgodovina-drugo-dodaj]");
    if (dodajDrugo) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var opis = String(customDraft.opis || "").trim();
      if (!opis) {
        var polje = root.querySelector("[data-zgodovina-drugo-opis]");
        if (polje) { polje.setCustomValidity("Vpišite kratek opis dogodka."); polje.reportValidity(); }
        return;
      }
      state.nacrtKoraki.push({
        tip: "history_custom",
        actionType: "history_custom",
        settings: { description: opis, occurredAt: customDraft.datum },
        naslov: opis,
        znesek: null,
        ikona: "pencil",
        razred: "drugo",
        datum: customDraft.datum ? customDraft.datum + "T12:00:00" : new Date().toISOString(),
      });
      customDraft = { opis: "", datum: new Date().toISOString().slice(0, 10) };
      customActive = false;
      debug.izrisiActionSheet();
      if (typeof debug.pomakniPotekNaDno === "function") debug.pomakniPotekNaDno();
      return;
    }
    setTimeout(function () { shrani(false); }, 0);
  }, true);

  root.addEventListener("input", function (dogodek) {
    if (dogodek.target.matches("[data-zgodovina-drugo-opis]")) customDraft.opis = dogodek.target.value;
    if (dogodek.target.matches("[data-zgodovina-drugo-datum]")) customDraft.datum = dogodek.target.value;
    setTimeout(function () { shrani(false); }, 0);
  });

  if (typeof window.UJInicializirajWizardProgressHeader === "function") {
    window.UJInicializirajWizardProgressHeader(2);
  }
  debug.izrisiActionSheet();
})();
