"use strict";
/* DOPOLNILO 2026-09-05: pokrije vzorce, ki jih app/atena-card-templates.js
   bind() namenoma NE pozna, ker pripadajo drugemu sistemu (.atena-izbira,
   real production produkcija) ali so čisto generične NAZORJEVA ilustracije
   brez data-atributov (npr. vrstica 10, 20). Nikoli se ne dotika ničesar,
   kar že ima data-card-choice/data-step/data-condition-* ipd. — to je
   izključno last app/atena-card-templates.js bind(), da ne pride do
   podvojenega/nasprotujočega si preklapljanja. */
(function () {
  "use strict";

  function enojnaIzbira(gumb, sorojenci) {
    sorojenci.forEach(function (g) {
      g.classList.remove("is-selected");
      g.setAttribute("aria-pressed", "false");
    });
    gumb.classList.add("is-selected");
    gumb.setAttribute("aria-pressed", "true");
  }

  function terminskoBesedilo(n) {
    if (n === 1) return n + " termin";
    if (n === 2) return n + " termina";
    if (n >= 3 && n <= 4) return n + " termini";
    return n + " terminov";
  }

  function osveziSkupnoOceno(kartica) {
    if (!kartica) return;
    var ocenaVnosi = Array.prototype.slice.call(kartica.querySelectorAll(".uj-card-score__row input[type=number]"));
    if (!ocenaVnosi.length) return;
    var povprecje = ocenaVnosi.reduce(function (sum, el) { return sum + (Number(el.value) || 0); }, 0) / ocenaVnosi.length;
    var izpisOcene = kartica.querySelector(".uj-card-score__summary output");
    if (izpisOcene) izpisOcene.textContent = povprecje.toFixed(1).replace(".", ",");
  }

  function osveziObroke(kartica, stevilo) {
    if (!kartica) return;
    var SKUPNA_VSOTA_OBROKOV = 2400;
    var posamezniObrok = Math.round(SKUPNA_VSOTA_OBROKOV / stevilo);
    var izpisPosameznega = kartica.querySelector(".uj-card-installments__summary b");
    if (izpisPosameznega) izpisPosameznega.textContent = posamezniObrok.toLocaleString("sl-SI") + " €";
    var stolpciOvoj = kartica.querySelector(".uj-card-installments__bars");
    if (stolpciOvoj) {
      stolpciOvoj.innerHTML = "";
      for (var i = 1; i <= stevilo; i += 1) {
        var stolpec = document.createElement("i");
        var stevilka = document.createElement("span");
        stevilka.textContent = String(i);
        stolpec.appendChild(stevilka);
        stolpciOvoj.appendChild(stolpec);
      }
    }
  }

  /* Atomarni primer drsnik+natančen vnos brez polnega realnega konteksta
     (npr. vrstica 96) — preprost, varen sinhron sync namesto klica prave,
     a za samostojen kontekst prestroge funkcije iz bind(). */
  document.addEventListener("input", function (dogodek) {
    var vnos = dogodek.target;
    if (!vnos || vnos.tagName !== "INPUT") return;
    var ovoj = vnos.closest("[data-expected-atomic] [data-expected-param]");
    if (!ovoj) return;
    var range = ovoj.querySelector("[data-atomic-range]");
    var number = ovoj.querySelector("[data-atomic-number]");
    var output = ovoj.querySelector("[data-atomic-output]");
    if (!range || !number || !output) return;
    var vrednost = Math.max(Number(range.min), Math.min(Number(range.max), Number(vnos.value) || 0));
    range.value = String(vrednost);
    number.value = String(vrednost);
    var enota = output.textContent.trim().slice(-1) === "€" ? " €" : " %";
    output.textContent = vrednost + enota;
  });

  document.addEventListener("click", function (dogodek) {
    var gumb = dogodek.target.closest ? dogodek.target.closest("button") : null;
    if (!gumb) return;

    /* .atena-izbira: prava produkcijska izbira, ločen sistem od NAZORJEVA.
       Vse doslej pregledane resnične rabe (vloga, način plačila, da/ne ...)
       so enojna izbira — en gumb je izbran naenkrat. */
    if (gumb.classList.contains("atena-izbira") && !gumb.hasAttribute("data-atena-choice")) {
      var izbire = gumb.closest(".atena-izbire");
      if (!izbire) return;
      enojnaIzbira(gumb, Array.prototype.slice.call(izbire.querySelectorAll(".atena-izbira")));
      return;
    }

    /* Gole NAZORJEVA izbire brez data-card-choice (npr. vrstica 10, generični primeri) */
    if (gumb.hasAttribute("data-card-choice") || gumb.hasAttribute("data-step") || gumb.hasAttribute("data-condition-toggle") || gumb.hasAttribute("data-condition-choice")) return;
    var goliStarsi = gumb.parentElement;
    if (goliStarsi && goliStarsi.matches(".uj-card-choices, .uj-card-segment, .uj-card-choice-grid, .uj-card-choice-list")) {
      var goliSorojenci = Array.prototype.filter.call(goliStarsi.children, function (el) { return el.tagName === "BUTTON"; });
      enojnaIzbira(gumb, goliSorojenci);
      return;
    }

    /* Dnevi ponavljanja brez data-recurrence-day: večizbira */
    if (gumb.parentElement && gumb.parentElement.classList.contains("uj-card-recurrence__days") && !gumb.hasAttribute("data-recurrence-day")) {
      gumb.classList.toggle("is-selected");
      return;
    }

    /* .atena-kolicina: prava produkcijska količina/stepper, ločen sistem od NAZORJEVA .uj-card-stepper */
    if ((gumb.textContent.trim() === "+" || gumb.textContent.trim() === "−" || gumb.textContent.trim() === "-") && gumb.closest(".atena-kolicina") && !gumb.hasAttribute("data-atena-step")) {
      var kolicinaOvoj = gumb.closest(".atena-kolicina");
      var kolicinaVnos = kolicinaOvoj.querySelector('input[type="number"]');
      if (!kolicinaVnos) return;
      var kolicinaDelta = gumb.textContent.trim() === "+" ? 1 : -1;
      var kolicinaMin = kolicinaVnos.min !== "" ? Number(kolicinaVnos.min) : 0;
      var kolicinaNovo = Math.max(kolicinaMin, (Number(kolicinaVnos.value) || 0) + kolicinaDelta);
      kolicinaVnos.value = String(kolicinaNovo);
      return;
    }

    /* .atena-hitre-izbire: prave produkcijske bližnjice — enojna izbira */
    if (gumb.parentElement && gumb.parentElement.classList.contains("atena-hitre-izbire") && !gumb.hasAttribute("data-atena-quick-value") && !gumb.hasAttribute("data-atena-mode-button") && !gumb.hasAttribute("data-atena-date-mode") && !gumb.hasAttribute("data-atena-deadline-mode")) {
      var hitreSorojenci = Array.prototype.filter.call(gumb.parentElement.children, function (el) { return el.tagName === "BUTTON"; });
      hitreSorojenci.forEach(function (g) { g.setAttribute("aria-pressed", "false"); });
      gumb.setAttribute("aria-pressed", "true");
      return;
    }

    /* Atomarni primer ukrepnih gumbov brez polnega realnega konteksta (vrstica
       95: .uj-card-expected__actions brez data-expected-value/debt starsa) —
       enak razlog kot pri vrstici 96: prava applyExpectedAction() zahteva
       [data-expected-value] prednika, ki ga samostojen primer nima. */
    if (gumb.parentElement && gumb.parentElement.classList.contains("uj-card-expected__actions") && !gumb.hasAttribute("data-expected-action")) {
      var pricakovaniSorojenci = Array.prototype.filter.call(gumb.parentElement.children, function (el) { return el.tagName === "BUTTON"; });
      enojnaIzbira(gumb, pricakovaniSorojenci);
      return;
    }

    /* Samostojna legenda 4 stopenj zasedenosti (vrstica 112) brez pravega
       dneva/tedna konteksta — vsak gumb je neodvisen krogotok 0→3→0, prava
       updateHeatmap() bi tu padla (cell.dataset.heatDay je undefined). */
    if (gumb.hasAttribute("data-standalone-heat-cell")) {
      var trenutnaStopnja = (Number(gumb.dataset.load) + 1) % 4;
      gumb.dataset.load = String(trenutnaStopnja);
      var stopnjeOznake = ["Prosto", "Malo dela", "Srednje zasedeno", "Zelo zasedeno"];
      gumb.setAttribute("aria-label", stopnjeOznake[trenutnaStopnja] + ". Klik spremeni stopnjo zasedenosti.");
      return;
    }

    /* Tedenska mreža terminov (vrstica 103): golo, večizbirno preklapljanje
       + prešteje izbrane termine v spodnjem povzetku. */
    if (gumb.closest(".uj-card-week__row") && !gumb.hasAttribute("data-slot")) {
      gumb.classList.toggle("is-selected");
      var tedenskaKartica = gumb.closest(".uj-card-week");
      var izbraniTermini = tedenskaKartica ? tedenskaKartica.querySelectorAll(".uj-card-week__row button.is-selected").length : 0;
      var terminiIzpis = tedenskaKartica && tedenskaKartica.querySelector("p b");
      if (terminiIzpis) terminiIzpis.textContent = terminskoBesedilo(izbraniTermini);
      return;
    }

    /* Ocenjevalni seznam s povprečjem (vrstica 104): minus/plus na oceno
       vsakega merila (1–5), zgornji povzetek je njihovo povprečje. */
    if ((gumb.textContent.trim() === "+" || gumb.textContent.trim() === "−") && gumb.closest(".uj-card-score__row") && !gumb.hasAttribute("data-score-step")) {
      var ocenaVrstica = gumb.closest(".uj-card-score__row");
      var ocenaVnos = ocenaVrstica.querySelector('input[type="number"]');
      if (!ocenaVnos) return;
      var ocenaDelta = gumb.textContent.trim() === "+" ? 1 : -1;
      var novaOcena = Math.max(1, Math.min(5, (Number(ocenaVnos.value) || 0) + ocenaDelta));
      ocenaVnos.value = String(novaOcena);
      osveziSkupnoOceno(ocenaVrstica.closest(".uj-card-score"));
      return;
    }

    /* Dodajanje novega scenarija v skupino (vrstica 110): samostojen, varen
       podnabor prave scenarioPreset logike — brez drsnikov/parametrov, ki jih
       ta atomarni primer nima. */
    if (gumb.hasAttribute("data-standalone-scenario-preset")) {
      var predlogeSorojenci = Array.prototype.slice.call(gumb.parentElement.querySelectorAll("[data-standalone-scenario-preset]"));
      enojnaIzbira(gumb, predlogeSorojenci);
      return;
    }
    if (gumb.hasAttribute("data-standalone-scenario-add")) {
      var ovojDodaj = gumb.closest(".vrstica-primer");
      var obrazecDodaj = ovojDodaj && ovojDodaj.querySelector("[data-standalone-scenario-form]");
      if (obrazecDodaj) { obrazecDodaj.hidden = false; var imeVnosDodaj = obrazecDodaj.querySelector("[data-standalone-scenario-name]"); if (imeVnosDodaj) imeVnosDodaj.focus(); }
      return;
    }
    if (gumb.hasAttribute("data-standalone-scenario-cancel")) {
      var obrazecPreklici = gumb.closest("[data-standalone-scenario-form]");
      if (obrazecPreklici) { obrazecPreklici.hidden = true; var vnosPreklici = obrazecPreklici.querySelector("[data-standalone-scenario-name]"); if (vnosPreklici) vnosPreklici.value = ""; }
      return;
    }
    if (gumb.hasAttribute("data-standalone-scenario-create")) {
      var obrazecUstvari = gumb.closest("[data-standalone-scenario-form]");
      var vnosUstvari = obrazecUstvari && obrazecUstvari.querySelector("[data-standalone-scenario-name]");
      var imeScenarija = vnosUstvari ? vnosUstvari.value.trim() : "";
      var ovojUstvari = gumb.closest(".vrstica-primer");
      var predlogeVrstica = ovojUstvari && ovojUstvari.querySelector("[data-standalone-scenario-presets]");
      if (imeScenarija && predlogeVrstica) {
        var novScenarijGumb = document.createElement("button");
        novScenarijGumb.type = "button";
        novScenarijGumb.setAttribute("data-standalone-scenario-preset", "");
        novScenarijGumb.textContent = imeScenarija;
        predlogeVrstica.insertBefore(novScenarijGumb, predlogeVrstica.querySelector("[data-standalone-scenario-add]"));
        enojnaIzbira(novScenarijGumb, Array.prototype.slice.call(predlogeVrstica.querySelectorAll("[data-standalone-scenario-preset]")));
      }
      if (obrazecUstvari) { obrazecUstvari.hidden = true; if (vnosUstvari) vnosUstvari.value = ""; }
      return;
    }

    /* Denar ali odstotek (vrstica 120): atomaren preklop enote brez
       spremljajočega drsnika/vnosa, ki bi ga prava moneyPercentHtml() zahtevala. */
    if (gumb.closest(".atena-znesek-enota") && gumb.parentElement && gumb.parentElement.getAttribute("role") === "group" && !gumb.hasAttribute("data-atena-unit-button")) {
      Array.prototype.filter.call(gumb.parentElement.children, function (el) { return el.tagName === "BUTTON"; }).forEach(function (g) { g.setAttribute("aria-pressed", String(g === gumb)); });
      return;
    }

    /* Stolpci obrokov (vrstica 126): minus/plus spremeni število obrokov,
       preračuna posamezni obrok (fiksna skupna vsota 2.400 €) in prerise
       ustrezno število stolpičkov. */
    if ((gumb.textContent.trim() === "+" || gumb.textContent.trim() === "−") && gumb.closest(".uj-card-installments__stepper") && !gumb.hasAttribute("data-installment-step")) {
      var obrokKartica = gumb.closest(".uj-card-installments");
      var obrokVnos = obrokKartica && obrokKartica.querySelector(".uj-card-installments__stepper input");
      if (!obrokVnos) return;
      var obrokDelta = gumb.textContent.trim() === "+" ? 1 : -1;
      var novoSteviloObrokov = Math.max(1, Math.min(12, (Number(obrokVnos.value) || 0) + obrokDelta));
      obrokVnos.value = String(novoSteviloObrokov);
      osveziObroke(obrokKartica, novoSteviloObrokov);
      return;
    }

    /* Glasovni vnos z merilnikom (vrstica 127): preklop med snemanjem in
       mirovanjem — v mirovanju se sprosti gumb 'Pripravi dogodke'. */
    if (gumb.classList.contains("zgodovina-ai__snemaj")) {
      var snemaZdaj = gumb.classList.toggle("is-recording");
      var oznakaSnemanja = gumb.querySelector("span:not(.zgodovina-ai__glasnost)");
      if (oznakaSnemanja) oznakaSnemanja.textContent = snemaZdaj ? "Prekini snemanje" : "Povej na glas";
      var pripraviGumb = gumb.parentElement && gumb.parentElement.querySelector(".zgodovina-ai__razumi");
      if (pripraviGumb) pripraviGumb.disabled = snemaZdaj;
      return;
    }

    /* Urejanje opisa s svinčnikom (vrstica 130): klik spremeni prikazano
       besedilo v urejevalno polje, kot pravi opis vrstice zahteva. */
    if (gumb.classList.contains("zgodovina-ai-pogovor__opis")) {
      var opisSpan = gumb.querySelector("span:first-child");
      var trenutnoBesedilo = opisSpan ? opisSpan.textContent.replace(/^"|"$/g, "") : "";
      var poljeUrejanja = document.createElement("textarea");
      poljeUrejanja.className = "zgodovina-ai-pogovor__opis-urejanje";
      poljeUrejanja.rows = 2;
      poljeUrejanja.style.width = "100%";
      poljeUrejanja.style.boxSizing = "border-box";
      poljeUrejanja.value = trenutnoBesedilo;
      var opisStars = gumb.parentElement;
      opisStars.replaceChild(poljeUrejanja, gumb);
      poljeUrejanja.focus();
      poljeUrejanja.setSelectionRange(poljeUrejanja.value.length, poljeUrejanja.value.length);
      poljeUrejanja.addEventListener("blur", function zapriUrejanjeOpisa() {
        if (opisSpan) opisSpan.textContent = '"' + poljeUrejanja.value.trim() + '"';
        opisStars.replaceChild(gumb, poljeUrejanja);
      }, { once:true });
      return;
    }

    /* Kartica razjasnitve dogodka (vrstica 131): gumb '×' odstrani celotno
       kartico dogodka, kot njen aria-label/namen narekuje. */
    if (gumb.classList.contains("zgodovina-ai-vprasanje__odstrani")) {
      var vprasanjeKartica = gumb.closest(".zgodovina-ai-vprasanje");
      if (vprasanjeKartica) vprasanjeKartica.remove();
      return;
    }

    /* Povzetek vrstica z uredi/izbriši (vrstica 132): gumb '×' odstrani
       povzetek vrstice. */
    if (gumb.parentElement && gumb.parentElement.classList.contains("zgodovina-ai-povzetek__akcije") && gumb.textContent.trim() === "×") {
      var povzetekVrstica = gumb.closest(".zgodovina-ai-povzetek");
      if (povzetekVrstica) povzetekVrstica.remove();
      return;
    }
  });
})();
