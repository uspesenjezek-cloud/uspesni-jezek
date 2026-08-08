/* ========== Kompaktni widget Ton sporočila ==========
   window.inicializirajTonWidget(ctx)
   ============================================ */
(function (root) {
  "use strict";

  var IKONE_SVG = {
    "smile-plus":
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/><path d="M16 5h4"/><path d="M18 3v4"/></svg>',
    smile:
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>',
    meh:
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="8" x2="16" y1="15" y2="15"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>',
    "triangle-alert":
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    "circle-alert":
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
  };

  /**
   * @param {object} ctx
   * @param {() => object} ctx.getState
   * @param {(s: object) => void} ctx.setState
   * @param {object} ctx.recommendation
   * @param {(toneId: string) => void|Promise<boolean>} ctx.onToneSelected
   * @param {() => void|Promise<boolean>} [ctx.onReset]
   * @param {(detail: string|object) => void} [ctx.onShowReasonDetail]
   */
  function inicializirajTonWidget(ctx) {
    var UJ = root.UJTonPriporocilo;
    var rootEl = document.getElementById("ton-widget");
    if (!UJ || !rootEl || !ctx) return;

    var tir = document.getElementById("ton-tir");
    var znesekZnacka = document.getElementById("ton-znesek-znacka");
    var kategorijaZnacka = document.getElementById("ton-kategorija-znacka");
    var povzetek = document.getElementById("ton-povzetek");
    var casTekst = document.getElementById("ton-cas-tekst");
    var znackaPredlagano = document.getElementById("ton-znacka-predlagano");
    var zakaj = document.getElementById("ton-zakaj");
    var ponastavi = document.getElementById("ton-ponastavi");
    var ariaLive = document.getElementById("ton-aria-live");
    var tabpanel = document.getElementById("ton-tabpanel-predloge");

    var potegAktiven = false;
    var potegPremaknil = false;
    var startX = 0;
    var scrollCasovnik = null;
    var tihoScrollanje = false;

    rootEl.hidden = false;
    rootEl.classList.remove("ton-widget--skeleton");

    function stanje() {
      return ctx.getState() || {};
    }

    function indeksTona(toneId) {
      for (var i = 0; i < UJ.TONI.length; i++) {
        if (UJ.TONI[i].id === toneId) return i;
      }
      return 0;
    }

    function jeRocno() {
      var s = stanje();
      return s.selectionMode === "manual" || s.isOverridden === true;
    }

    function pokaziZakaj() {
      var s = stanje();
      var rec = Object.assign({}, ctx.recommendation || {}, s);
      var razlaga =
        typeof UJ.sestaviRazlagoZaModal === "function"
          ? UJ.sestaviRazlagoZaModal(rec)
          : null;
      if (typeof ctx.onShowReasonDetail === "function") {
        ctx.onShowReasonDetail(razlaga || podrobniRazlog());
        return;
      }
      if (typeof root.potrdiVprasanje === "function") {
        if (razlaga) {
          root.potrdiVprasanje({
            naslov: razlaga.naslov,
            odstavki: razlaga.odstavki,
            potrdiBesedilo: "Razumem",
            samoEnGumb: true,
            stil: "primary",
          });
        } else {
          root.potrdiVprasanje({
            naslov: "Zakaj priporočamo ta ton?",
            opis: podrobniRazlog(),
            potrdiBesedilo: "Razumem",
            samoEnGumb: true,
            stil: "primary",
          });
        }
      }
    }

    function podrobniRazlog() {
      var s = stanje();
      var rec = ctx.recommendation || {};
      return (
        s.reasonDetailText ||
        rec.reasonDetailText ||
        s.reasonText ||
        rec.reasonText ||
        "Ton je predlagan glede na znesek in zapadlost računa."
      );
    }

    function posodobiGlavo() {
      var s = stanje();
      var rec = ctx.recommendation || {};
      var missingAmount = Boolean(s.missingAmount || rec.missingAmount);
      var amount =
        s.amountLabel ||
        rec.amountLabel ||
        (missingAmount ? "Znesek ni določen" : "");
      var debtLabel = s.debtCategoryLabel || rec.debtCategoryLabel || "";
      var timing = s.timingLabel || rec.timingLabel || "";

      if (znesekZnacka) {
        znesekZnacka.textContent = amount || "Znesek ni določen";
      }
      if (kategorijaZnacka) {
        if (debtLabel) {
          kategorijaZnacka.textContent = debtLabel;
          kategorijaZnacka.hidden = false;
        } else {
          kategorijaZnacka.textContent = "—";
          kategorijaZnacka.hidden = missingAmount;
        }
      }
      if (casTekst) {
        casTekst.textContent = timing;
      }

      if (znackaPredlagano) {
        znackaPredlagano.textContent = jeRocno()
          ? "Ročno izbrano"
          : "Predlagano";
        znackaPredlagano.classList.toggle(
          "ton-widget__znacka--rocno",
          jeRocno()
        );
      }
      if (ponastavi) {
        ponastavi.hidden = !jeRocno();
      }
    }

    function posodobiGumbe() {
      if (!tir) return;
      var s = stanje();
      tir.querySelectorAll(".ton-widget__gumb").forEach(function (gumb) {
        var id = gumb.dataset.toneId;
        var izbrana = id === s.selectedToneId;
        gumb.classList.toggle("ton-widget__gumb--izbran", izbrana);
        gumb.setAttribute("aria-pressed", izbrana ? "true" : "false");
        gumb.setAttribute("aria-selected", izbrana ? "true" : "false");
        gumb.tabIndex = izbrana ? 0 : -1;
      });
    }

    function sporociBralniku() {
      if (!ariaLive) return;
      var ton = UJ.najdiTonPoId(stanje().selectedToneId);
      var n = 0;
      if (tabpanel) {
        var stevec = document.getElementById("predlogi-stevilo-oznaka");
        n = stevec ? Number(stevec.textContent) || 0 : 0;
      }
      ariaLive.textContent =
        "Izbran ton: " +
        (ton ? ton.labelSl : "") +
        ". Prikazanih je " +
        n +
        " predlog" +
        (n === 1 ? "" : ".");
    }

    function osveziUi() {
      posodobiGlavo();
      posodobiGumbe();
    }

    function scrollToTone(toneId, instant) {
      if (!tir) return;
      var gumb = tir.querySelector(
        '.ton-widget__gumb[data-tone-id="' + toneId + '"]'
      );
      if (!gumb) return;
      tihoScrollanje = true;
      var cilj =
        gumb.offsetLeft - (tir.clientWidth / 2 - gumb.offsetWidth / 2);
      tir.scrollTo({
        left: Math.max(0, cilj),
        behavior: instant ? "auto" : "smooth",
      });
      window.setTimeout(
        function () {
          tihoScrollanje = false;
        },
        instant ? 50 : 320
      );
    }

    function izberiTon(toneId, scrollaj) {
      if (!toneId) return;
      var s = stanje();
      if (s.selectedToneId === toneId) {
        osveziUi();
        if (scrollaj) scrollToTone(toneId, true);
        return;
      }
      if (typeof ctx.onToneSelected === "function") {
        ctx.onToneSelected(toneId);
      }
      osveziUi();
      if (scrollaj !== false) scrollToTone(toneId, false);
      sporociBralniku();
    }

    function najblizjiGumb() {
      if (!tir) return null;
      var sredisce = tir.scrollLeft + tir.clientWidth / 2;
      var gumbi = tir.querySelectorAll(".ton-widget__gumb");
      var naj = null;
      var najRazlika = Infinity;
      gumbi.forEach(function (g) {
        var c = g.offsetLeft + g.offsetWidth / 2;
        var d = Math.abs(c - sredisce);
        if (d < najRazlika) {
          najRazlika = d;
          naj = g;
        }
      });
      return naj;
    }

    function potrdiTonPoScrollu() {
      if (tihoScrollanje) return;
      var g = najblizjiGumb();
      if (!g) return;
      var id = g.dataset.toneId;
      if (id && id !== stanje().selectedToneId) {
        izberiTon(id, false);
      } else {
        osveziUi();
      }
    }

    function premakniZa(delta) {
      var idx = indeksTona(stanje().selectedToneId) + delta;
      idx = Math.max(0, Math.min(UJ.TONI.length - 1, idx));
      izberiTon(UJ.TONI[idx].id, true);
    }

    function zgradiGumbe() {
      if (!tir) return;
      tir.innerHTML = "";
      UJ.TONI.forEach(function (ton) {
        if (ton.active === false) return;
        var gumb = document.createElement("button");
        gumb.type = "button";
        gumb.className = "ton-widget__gumb";
        gumb.dataset.toneId = ton.id;
        gumb.setAttribute("role", "tab");
        gumb.setAttribute("aria-controls", "ton-tabpanel-predloge");
        gumb.setAttribute(
          "aria-label",
          "Izberi " + ton.labelSl.toLowerCase() + " ton"
        );
        gumb.id = "ton-tab-" + ton.id;
        gumb.innerHTML =
          '<span class="ton-widget__gumb-ikona" aria-hidden="true">' +
          (IKONE_SVG[ton.iconKey] || IKONE_SVG.smile) +
          "</span>" +
          '<span class="ton-widget__gumb-naziv"></span>';
        gumb.querySelector(".ton-widget__gumb-naziv").textContent = ton.labelSl;

        gumb.addEventListener("click", function (ev) {
          if (potegPremaknil) {
            ev.preventDefault();
            potegPremaknil = false;
            return;
          }
          izberiTon(ton.id, true);
        });

        gumb.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            izberiTon(ton.id, true);
          } else if (ev.key === "ArrowLeft") {
            ev.preventDefault();
            premakniZa(-1);
          } else if (ev.key === "ArrowRight") {
            ev.preventDefault();
            premakniZa(1);
          } else if (ev.key === "Home") {
            ev.preventDefault();
            izberiTon(UJ.TONI[0].id, true);
          } else if (ev.key === "End") {
            ev.preventDefault();
            izberiTon(UJ.TONI[UJ.TONI.length - 1].id, true);
          }
        });

        tir.appendChild(gumb);
      });
    }

    if (tir) {
      tir.addEventListener(
        "scroll",
        function () {
          if (scrollCasovnik) window.clearTimeout(scrollCasovnik);
          scrollCasovnik = window.setTimeout(potrdiTonPoScrollu, 80);
        },
        { passive: true }
      );

      tir.addEventListener(
        "pointerdown",
        function (ev) {
          potegAktiven = true;
          potegPremaknil = false;
          startX = ev.clientX;
        },
        { passive: true }
      );
      tir.addEventListener(
        "pointermove",
        function (ev) {
          if (!potegAktiven) return;
          if (Math.abs(ev.clientX - startX) > 8) potegPremaknil = true;
        },
        { passive: true }
      );
      tir.addEventListener(
        "pointerup",
        function () {
          potegAktiven = false;
          window.setTimeout(function () {
            potegPremaknil = false;
          }, 50);
        },
        { passive: true }
      );
      tir.addEventListener("pointercancel", function () {
        potegAktiven = false;
      });
    }

    if (zakaj) {
      zakaj.addEventListener("click", function () {
        pokaziZakaj();
      });
    }

    if (povzetek) {
      povzetek.addEventListener("click", function () {
        pokaziZakaj();
      });
    }

    if (ponastavi) {
      ponastavi.addEventListener("click", function () {
        if (typeof ctx.onReset === "function") {
          ctx.onReset();
        } else {
          izberiTon(stanje().recommendedToneId || "friendly", true);
          return;
        }
        osveziUi();
        scrollToTone(stanje().selectedToneId, false);
        sporociBralniku();
      });
    }

    zgradiGumbe();
    osveziUi();
    window.requestAnimationFrame(function () {
      scrollToTone(stanje().selectedToneId || "friendly", true);
      sporociBralniku();
    });

    return {
      osvezi: osveziUi,
      scrollToSelected: function () {
        scrollToTone(stanje().selectedToneId, false);
      },
      pokaziZakaj: pokaziZakaj,
      IKONE_SVG: IKONE_SVG,
    };
  }

  root.inicializirajTonWidget = inicializirajTonWidget;
  root.UJTonWidgetIkone = IKONE_SVG;
})(typeof globalThis !== "undefined" ? globalThis : this);
