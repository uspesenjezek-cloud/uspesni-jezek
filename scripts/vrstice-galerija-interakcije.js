"use strict";
/* NAZORJEVA-VRSTICE-GALERIJA.html: generične interakcije po pravih data-atributih/razredih,
   isti pristop kot v NAZORJEVA-PREDLOGI-MOCKUP.html (V1-V133 blok) — noben gumb/drsnik ne sme
   ostati popolnoma mrtev. Namenoma NI bespoke logike za vsako od 133 kartic; pokriva skupne,
   ponovno uporabljene vzorce iz registra in produkcijskih rendererjev. */
(function () {
  "use strict";

  function clampInt(n, min, max) {
    if (Number.isNaN(n)) n = 0;
    if (typeof min === "number" && n < min) n = min;
    if (typeof max === "number" && n > max) n = max;
    return n;
  }

  function numAttr(el, name, fallback) {
    var raw = el.getAttribute(name);
    var n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  /* --- 1) Izbirne skupine: [data-card-choice-group] > [data-card-choice] --- */
  function obdelajCardChoice(gumb) {
    var skupina = gumb.closest("[data-card-choice-group]");
    if (!skupina) return;
    var vsiGumbi = Array.prototype.slice.call(skupina.querySelectorAll("[data-card-choice]"));
    var vecIzbira = skupina.hasAttribute("data-choice-multiple");
    if (!vecIzbira) {
      vsiGumbi.forEach(function (g) {
        g.classList.remove("is-selected");
        g.setAttribute("aria-pressed", "false");
      });
      gumb.classList.add("is-selected");
      gumb.setAttribute("aria-pressed", "true");
    } else {
      var izbran = gumb.classList.toggle("is-selected");
      gumb.setAttribute("aria-pressed", izbran ? "true" : "false");
    }
  }

  /* --- 1b) Enako, a brez data-card-choice-group (čisto ilustrativni NAZORJEVA primeri #1-26) --- */
  var RAZREDI_IZBIRE = ".uj-card-choices, .uj-card-segment, .uj-card-choice-grid, .uj-card-choice-list";
  function obdelajGoloIzbiro(gumb) {
    var skupina = gumb.parentElement;
    if (!skupina || !skupina.matches(RAZREDI_IZBIRE)) return false;
    var vsiGumbi = Array.prototype.filter.call(skupina.children, function (el) { return el.tagName === "BUTTON"; });
    vsiGumbi.forEach(function (g) { g.classList.remove("is-selected"); });
    gumb.classList.add("is-selected");
    return true;
  }

  /* --- 2) Prava produkcijska izbira: .atena-izbire > .atena-izbira[aria-pressed] --- */
  function obdelajAtenaIzbira(gumb) {
    var skupina = gumb.closest(".atena-izbire");
    if (!skupina) return;
    if (skupina.classList.contains("atena-izbire--choice-grid") || skupina.classList.contains("atena-izbire--choice-segments")) {
      var vsi = Array.prototype.slice.call(skupina.querySelectorAll(".atena-izbira"));
      vsi.forEach(function (g) { g.setAttribute("aria-pressed", "false"); });
      gumb.setAttribute("aria-pressed", "true");
    } else {
      var trenutno = gumb.getAttribute("aria-pressed") === "true";
      gumb.setAttribute("aria-pressed", trenutno ? "false" : "true");
    }
  }

  /* --- 3) Stepperji: [data-card-stepper]/.uj-card-stepper [data-step ali golo −/+] + input[type=number] --- */
  function jePlusMinusBesedilo(gumb) {
    var t = gumb.textContent.trim();
    return t === "+" || t === "-" || t === "−" || t === "–";
  }
  function obdelajStepper(gumb) {
    var ovoj = gumb.closest("[data-card-stepper], .uj-card-stepper, .uj-card-recurrence__interval, .uj-card-relative__rule > div, .atena-kolicina, [data-atena-composite]");
    if (!ovoj) return;
    var vnos = ovoj.querySelector("input[type=number], input[data-atena-number], input[data-recurrence-count], input[data-relative-days]");
    if (!vnos) return;
    var smer = gumb.getAttribute("data-step") || gumb.getAttribute("data-recurrence-step") || gumb.getAttribute("data-relative-step") || gumb.getAttribute("data-atena-step");
    var delta;
    if (smer != null) delta = (smer === "-1" || smer === "-") ? -1 : 1;
    else delta = /^[-−–]$/.test(gumb.textContent.trim()) ? -1 : 1;
    var korak = numAttr(vnos, "step", 1);
    var trenutno = parseFloat(vnos.value);
    if (Number.isNaN(trenutno)) trenutno = numAttr(vnos, "min", 0);
    var novo = clampInt(trenutno + delta * korak, numAttr(vnos, "min", undefined), numAttr(vnos, "max", undefined));
    vnos.value = String(novo);
    vnos.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* --- 4) Custom dropdown: [data-condition-toggle] / [data-condition-menu] / [data-condition-choice] --- */
  function zapriVseMenije(razenTega) {
    document.querySelectorAll("[data-condition-menu]").forEach(function (meni) {
      if (meni === razenTega) return;
      meni.hidden = true;
      var gumb = meni.previousElementSibling;
      if (gumb && gumb.hasAttribute("data-condition-toggle")) gumb.setAttribute("aria-expanded", "false");
    });
  }
  function obdelajConditionToggle(gumb) {
    var ovoj = gumb.closest("[data-condition-select], .uj-card-condition__select");
    if (!ovoj) return;
    var meni = ovoj.querySelector("[data-condition-menu]");
    if (!meni) return;
    var odprto = !meni.hidden;
    zapriVseMenije(odprto ? null : meni);
    meni.hidden = odprto;
    gumb.setAttribute("aria-expanded", odprto ? "false" : "true");
  }
  function obdelajConditionChoice(izbira) {
    var meni = izbira.closest("[data-condition-menu]");
    var ovoj = izbira.closest("[data-condition-select], .uj-card-condition__select");
    if (!meni || !ovoj) return;
    var gumb = ovoj.querySelector("[data-condition-toggle]");
    var vrednost = ovoj.querySelector("[data-condition-field]");
    var oznaka = gumb ? gumb.querySelector("[data-condition-select-value], span") : null;
    meni.querySelectorAll("[data-condition-choice]").forEach(function (o) {
      o.classList.remove("is-selected");
      o.setAttribute("aria-selected", "false");
    });
    izbira.classList.add("is-selected");
    izbira.setAttribute("aria-selected", "true");
    if (oznaka) oznaka.textContent = izbira.textContent.trim();
    if (vrednost) vrednost.value = izbira.getAttribute("data-condition-choice") || izbira.textContent.trim();
    meni.hidden = true;
    if (gumb) gumb.setAttribute("aria-expanded", "false");
  }

  /* --- 5) Koledar: .uj-card-calendar__days button (enojna izbira dneva) --- */
  function obdelajKoledarDan(gumb) {
    var mreza = gumb.closest(".uj-card-calendar__days");
    if (!mreza) return;
    mreza.querySelectorAll("button").forEach(function (g) { g.classList.remove("is-selected"); });
    gumb.classList.add("is-selected");
  }

  /* --- 6) Kontrolni seznam: .uj-card-checklist > button (odkljukanje + napredek) --- */
  function obdelajChecklist(gumb) {
    var kartica = gumb.closest(".uj-card-checklist");
    if (!kartica) return;
    gumb.classList.toggle("is-done");
    var vsi = kartica.querySelectorAll(":scope > button");
    var opravljeni = kartica.querySelectorAll(":scope > button.is-done").length;
    var napis = kartica.querySelector(".uj-card-checklist__progress b");
    if (napis) napis.textContent = opravljeni + " od " + vsi.length;
    var trak = kartica.querySelector(".uj-card-checklist__progress i");
    if (trak && vsi.length) trak.style.width = Math.round((opravljeni / vsi.length) * 100) + "%";
  }

  /* --- 7) Žetoni: .uj-card-tags__bank <-> .uj-card-tags__selected --- */
  function obdelajZetonBanka(gumb) {
    var kartica = gumb.closest(".vrstica-primer, .uj-card-field, body");
    var izbrani = kartica ? kartica.querySelector(".uj-card-tags__selected") : null;
    gumb.classList.toggle("is-selected");
    if (!izbrani) return;
    var besedilo = gumb.textContent.trim();
    if (gumb.classList.contains("is-selected")) {
      var obstaja = Array.prototype.some.call(izbrani.children, function (c) { return c.getAttribute("data-tag") === besedilo; });
      if (!obstaja) {
        var chip = document.createElement("span");
        chip.setAttribute("data-tag", besedilo);
        chip.appendChild(document.createTextNode(besedilo + " "));
        var x = document.createElement("button");
        x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Odstrani " + besedilo);
        chip.appendChild(x);
        izbrani.appendChild(chip);
      }
    } else {
      Array.prototype.slice.call(izbrani.children).forEach(function (c) {
        if (c.getAttribute("data-tag") === besedilo) izbrani.removeChild(c);
      });
    }
  }
  function obdelajZetonOdstrani(gumb) {
    var chip = gumb.closest("span");
    var izbrani = gumb.closest(".uj-card-tags__selected");
    if (!chip || !izbrani) return;
    var besedilo = chip.getAttribute("data-tag");
    izbrani.removeChild(chip);
    if (!besedilo) return;
    var kartica = izbrani.closest(".vrstica-primer, .uj-card-field, body");
    var banka = kartica ? kartica.querySelector(".uj-card-tags__bank") : null;
    if (!banka) return;
    Array.prototype.slice.call(banka.children).forEach(function (g) {
      if (g.textContent.trim() === besedilo) g.classList.remove("is-selected");
    });
  }

  /* --- 8) Prost seznam: [data-card-list] add/remove + produkcijski .atena-seznam --- */
  function obdelajListAdd(gumb) {
    var ovoj = gumb.closest(".uj-card-list__add, .atena-seznam__dodaj");
    if (!ovoj) return;
    var vnos = ovoj.querySelector("input[type=text]");
    var seznam = ovoj.previousElementSibling;
    if (!vnos || !vnos.value.trim() || !seznam) return;
    var vrstica = document.createElement("span");
    vrstica.appendChild(document.createTextNode(vnos.value.trim() + " "));
    var x = document.createElement("button");
    x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Odstrani");
    vrstica.appendChild(x);
    seznam.appendChild(vrstica);
    vnos.value = "";
  }
  function obdelajListRemove(gumb) {
    var vrstica = gumb.closest("span");
    if (vrstica && vrstica.parentElement) vrstica.parentElement.removeChild(vrstica);
  }

  /* --- 9) Večizbirni gumbi znotraj lastnih skupin (ponavljanje dni, join, kind, status, mode) --- */
  var VEC_IZBIRA_SKUPINE = [".uj-card-recurrence__days"];
  var ENO_IZBIRA_ATRIBUTI = ["data-condition-join", "data-change-kind", "data-change-status", "data-relative-mode", "data-recurrence-day"];
  function obdelajEnoIzbiraAtribut(gumb, atribut) {
    var starsi = gumb.parentElement;
    if (!starsi) return;
    var vecIzbira = VEC_IZBIRA_SKUPINE.some(function (sel) { return starsi.matches && starsi.matches(sel); });
    var sorojenci = Array.prototype.filter.call(starsi.children, function (el) { return el.hasAttribute(atribut); });
    if (!vecIzbira) {
      sorojenci.forEach(function (g) { g.classList.remove("is-selected"); g.setAttribute("aria-pressed", "false"); });
      gumb.classList.add("is-selected");
      gumb.setAttribute("aria-pressed", "true");
    } else {
      var izbran = gumb.classList.toggle("is-selected");
      gumb.setAttribute("aria-pressed", izbran ? "true" : "false");
    }
  }

  /* --- 10) Hitre bližnjice: data-atena-quick-value / data-atena-date-mode / data-atena-deadline-mode --- */
  function obdelajHitroIzbiro(gumb, atribut) {
    var skupina = gumb.parentElement;
    if (!skupina) return;
    Array.prototype.filter.call(skupina.children, function (el) { return el.hasAttribute(atribut); }).forEach(function (g) {
      g.setAttribute("aria-pressed", "false");
    });
    gumb.setAttribute("aria-pressed", "true");
  }

  /* --- 11) Enojni drsnik: input[type=range] -> najbližji output/readout + stolpci --- */
  function slovenskoStevilo(vrednost) {
    var n = parseFloat(vrednost);
    if (Number.isNaN(n)) return String(vrednost);
    var zaokrozeno = Math.round(n * 10) / 10;
    return String(zaokrozeno).replace(".", ",");
  }
  function obdelajDrsnikStolpce(vnos) {
    var ovoj = vnos.closest(".uj-card-range, .vrstica-primer") || document;
    var stolpci = ovoj.querySelector("[data-range-bars]");
    if (!stolpci) return;
    var vsi = Array.prototype.slice.call(stolpci.children);
    if (!vsi.length) return;
    var min = numAttr(vnos, "min", 0), max = numAttr(vnos, "max", 100);
    var delez = max === min ? 1 : (parseFloat(vnos.value) - min) / (max - min);
    var aktivnih = clampInt(Math.round(delez * vsi.length), 0, vsi.length);
    vsi.forEach(function (stolpec, indeks) {
      stolpec.classList.toggle("is-active", indeks < aktivnih);
    });
  }
  /* Splošen izhod za preostale, medsebojno različne analitične widgete (allocation,
     goal, change, probability, plane, breakeven, provenance ...) — brez lastne bespoke
     funkcije za vsakega: poišče prvo številko v najbližjem vidnem povzetku in jo
     zamenja z novo vrednostjo drsnika. Manj natančno kot namenski izhod, a nobena
     kartica ne ostane mrtva. */
  function prvaStevilka(besedilo) {
    var m = String(besedilo == null ? "" : besedilo).match(/[-+]?\d+(?:[.,]\d+)?/);
    return m ? m[0] : null;
  }
  function zamenjajStevilko(besedilo, novo) {
    return String(besedilo).replace(/[-+]?\d+(?:[.,]\d+)?/, novo);
  }
  function obdelajSplosniIzhod(vnos, kartica) {
    var kandidati = kartica.querySelectorAll(".uj-card-goal__gauge b, .uj-card-probability__control-head b, .uj-card-change__head strong, .uj-card-change__values strong, .uj-card-breakeven__control b, .uj-card-breakeven__summary b, .uj-card-plane__detail b, .uj-card-plane__discount b, .uj-card-provenance__age b, .uj-card-allocation__donut b, b, strong, output");
    for (var i = 0; i < kandidati.length; i++) {
      if (prvaStevilka(kandidati[i].textContent) != null) {
        kandidati[i].textContent = zamenjajStevilko(kandidati[i].textContent, slovenskoStevilo(vnos.value));
        return true;
      }
    }
    return false;
  }
  /* Sinhronizacija para drsnik+številčni vnos (npr. data-provenance-age-range +
     data-provenance-age-number) — oba prikazujeta isto vrednost. */
  function obdelajSinhroniziranPar(vnos) {
    var ovoj = vnos.parentElement;
    if (!ovoj) return false;
    var parVnos = ovoj.querySelector("input[type=number]");
    if (!parVnos) return false;
    parVnos.value = String(Math.round(parseFloat(vnos.value)));
    if (vnos.hasAttribute("aria-valuetext")) {
      var pripona = ovoj.querySelector("span");
      vnos.setAttribute("aria-valuetext", parVnos.value + (pripona ? " " + pripona.textContent.trim() : ""));
    }
    return true;
  }
  function obdelajDrsnik(vnos) {
    var kartica = vnos.closest(".vrstica-primer") || document;
    var izhod = kartica.querySelector(".uj-card-range__readout output, .uj-card-radius__readout b, output");
    var imaSinhroniPar = obdelajSinhroniziranPar(vnos);
    if (izhod) {
      var enota = /%/.test(izhod.textContent) ? " %" : "";
      izhod.textContent = slovenskoStevilo(vnos.value) + enota;
    } else if (!imaSinhroniPar) {
      obdelajSplosniIzhod(vnos, kartica);
    }
    obdelajDrsnikStolpce(vnos);
  }

  /* --- 12) Dvojni drsnik: [data-dual-min] / [data-dual-max] --- */
  function obdelajDvojniDrsnik(vnos) {
    var ovoj = vnos.closest(".uj-card-dual-range");
    if (!ovoj) return;
    var minVnos = ovoj.querySelector("[data-dual-min]");
    var maxVnos = ovoj.querySelector("[data-dual-max]");
    if (!minVnos || !maxVnos) return;
    var minV = parseFloat(minVnos.value), maxV = parseFloat(maxVnos.value);
    if (minV > maxV) {
      if (vnos === minVnos) maxVnos.value = String(minV); else minVnos.value = String(maxV);
      minV = parseFloat(minVnos.value); maxV = parseFloat(maxVnos.value);
    }
    var minIzhod = ovoj.querySelector("[data-dual-min-output]");
    var maxIzhod = ovoj.querySelector("[data-dual-max-output]");
    if (minIzhod) minIzhod.textContent = minV.toLocaleString("sl-SI") + " €";
    if (maxIzhod) maxIzhod.textContent = maxV.toLocaleString("sl-SI") + " €";
  }

  document.addEventListener("click", function (dogodek) {
    var tarca = dogodek.target;
    var gumb = tarca.closest ? tarca.closest("button") : null;
    if (!gumb) return;

    if (gumb.hasAttribute("data-condition-toggle")) { obdelajConditionToggle(gumb); return; }
    if (gumb.hasAttribute("data-condition-choice")) { obdelajConditionChoice(gumb); return; }
    if (gumb.hasAttribute("data-list-remove")) { obdelajListRemove(gumb); return; }
    if (gumb.hasAttribute("data-list-add")) { obdelajListAdd(gumb); return; }
    if (gumb.closest(".uj-card-list__add") && gumb.textContent.trim() === "Dodaj") { obdelajListAdd(gumb); return; }
    if (gumb.closest(".atena-seznam__dodaj")) { obdelajListAdd(gumb); return; }
    if (gumb.parentElement && gumb.parentElement.tagName === "SPAN" && gumb.textContent.trim() === "×" && gumb.closest(".uj-card-tags__selected")) { obdelajZetonOdstrani(gumb); return; }
    if (gumb.parentElement && gumb.parentElement.tagName === "SPAN" && gumb.textContent.trim() === "×") { obdelajListRemove(gumb); return; }
    if (gumb.closest(".uj-card-tags__bank")) { obdelajZetonBanka(gumb); return; }
    if (gumb.hasAttribute("data-card-choice")) { obdelajCardChoice(gumb); return; }
    if (gumb.classList.contains("atena-izbira")) { obdelajAtenaIzbira(gumb); return; }
    if (obdelajGoloIzbiro(gumb)) return;
    if (gumb.hasAttribute("data-step") || gumb.hasAttribute("data-recurrence-step") || gumb.hasAttribute("data-relative-step") || gumb.hasAttribute("data-atena-step")) { obdelajStepper(gumb); return; }
    if (jePlusMinusBesedilo(gumb) && gumb.closest("[data-card-stepper], .uj-card-stepper, .uj-card-recurrence__interval, .uj-card-relative__rule > div, .atena-kolicina, [data-atena-composite]")) { obdelajStepper(gumb); return; }
    if (gumb.closest(".uj-card-calendar__days")) { obdelajKoledarDan(gumb); return; }
    if (gumb.parentElement && gumb.parentElement.classList && gumb.parentElement.classList.contains("uj-card-checklist")) { obdelajChecklist(gumb); return; }
    for (var i = 0; i < ENO_IZBIRA_ATRIBUTI.length; i++) {
      if (gumb.hasAttribute(ENO_IZBIRA_ATRIBUTI[i])) { obdelajEnoIzbiraAtribut(gumb, ENO_IZBIRA_ATRIBUTI[i]); return; }
    }
    if (gumb.hasAttribute("data-atena-quick-value")) { obdelajHitroIzbiro(gumb, "data-atena-quick-value"); return; }
    if (gumb.hasAttribute("data-atena-date-mode")) { obdelajHitroIzbiro(gumb, "data-atena-date-mode"); return; }
    if (gumb.hasAttribute("data-atena-deadline-mode")) { obdelajHitroIzbiro(gumb, "data-atena-deadline-mode"); return; }
  });

  document.addEventListener("click", function (dogodek) {
    if (!dogodek.target.closest || !dogodek.target.closest("[data-condition-toggle]")) {
      var odprtMeni = document.querySelector("[data-condition-menu]:not([hidden])");
      if (odprtMeni && !odprtMeni.contains(dogodek.target)) zapriVseMenije(null);
    }
  });

  document.addEventListener("input", function (dogodek) {
    var vnos = dogodek.target;
    if (!vnos || vnos.tagName !== "INPUT") return;
    if (vnos.type === "range") {
      if (vnos.hasAttribute("data-dual-min") || vnos.hasAttribute("data-dual-max")) obdelajDvojniDrsnik(vnos);
      else obdelajDrsnik(vnos);
    }
  });
})();
