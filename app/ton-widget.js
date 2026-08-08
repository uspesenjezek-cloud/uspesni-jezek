/* ========== Widget Ton sporočila (odzivni carousel) ==========
   window.inicializirajTonWidget(ctx)
   ============================================ */
(function (root) {
  "use strict";

  var TONE_CARD_WIDTH = 148;
  var TONE_CARD_GAP = 10;

  var TONE_REASON_ADJECTIVES = {
    friendly: "prijazen",
    firm: "odločen",
    strict: "strog",
    very_friendly: "prijazen",
    veryFriendly: "prijazen",
    neutral: "odločen",
  };

  var IKONE_SVG = {
    "smile-plus":
      '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/><path d="M16 5h4"/><path d="M18 3v4"/></svg>',
    smile:
      '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>',
    meh:
      '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="8" x2="16" y1="15" y2="15"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>',
    shield:
      '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
    "triangle-alert":
      '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    "circle-alert":
      '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
    alert:
      '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
  };

  function pridevnikTona(toneId) {
    return TONE_REASON_ADJECTIVES[toneId] || "ta";
  }

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
    var sectionEl = document.getElementById("tone-recommendation-section");
    if (!UJ || !rootEl || !ctx) return;

    var tir = document.getElementById("ton-tir");
    var carousel = document.getElementById("ton-carousel");
    var znesekZnacka = document.getElementById("ton-znesek-znacka");
    var kategorijaZnacka = document.getElementById("ton-kategorija-znacka");
    var casTekst = document.getElementById("ton-cas-tekst");
    var reasonRow = document.getElementById("ton-reason-row");
    var reasonText = document.getElementById("ton-reason-text");
    var ariaLive = document.getElementById("ton-aria-live");
    var tabpanel = document.getElementById("ton-tabpanel-predloge");

    var potegAktiven = false;
    var potegPremaknil = false;
    var startX = 0;
    var scrollCasovnik = null;
    var tihoScrollanje = false;
    var uporabnikDrsne = false;

    if (sectionEl) sectionEl.hidden = false;
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

    function priporoceniId() {
      var s = stanje();
      return (
        s.recommendedToneId ||
        (ctx.recommendation && ctx.recommendation.recommendedToneId) ||
        "friendly"
      );
    }

    function posodobiPaddingCarousela() {
      if (!tir || !carousel) return;
      var w = carousel.clientWidth || tir.clientWidth || 0;
      var pad = Math.max(0, (w - TONE_CARD_WIDTH) / 2);
      tir.style.paddingInline = pad + "px";
      tir.style.scrollPaddingInline = pad + "px";
    }

    function scrollToTone(toneId, instant) {
      if (!tir) return;
      var gumb = tir.querySelector(
        '.tone-option[data-tone-id="' + toneId + '"]'
      );
      if (!gumb) return;
      tihoScrollanje = true;
      if (typeof gumb.scrollIntoView === "function") {
        try {
          gumb.scrollIntoView({
            behavior: instant ? "auto" : "smooth",
            block: "nearest",
            inline: "center",
          });
        } catch (_e) {
          var cilj =
            gumb.offsetLeft - (tir.clientWidth / 2 - gumb.offsetWidth / 2);
          tir.scrollTo({
            left: Math.max(0, cilj),
            behavior: instant ? "auto" : "smooth",
          });
        }
      }
      window.setTimeout(
        function () {
          tihoScrollanje = false;
        },
        instant ? 60 : 340
      );
    }

    function pokaziZakaj() {
      var s = stanje();
      var rec = Object.assign({}, ctx.recommendation || {}, s);
      rec.recommendedToneId = priporoceniId();
      var razlaga =
        typeof UJ.sestaviRazlagoZaModal === "function"
          ? UJ.sestaviRazlagoZaModal(rec)
          : null;

      if (typeof ctx.onShowReasonDetail === "function") {
        ctx.onShowReasonDetail({
          razlaga: razlaga,
          jeRocno: jeRocno(),
          recommendedToneId: priporoceniId(),
        });
        return;
      }

      if (typeof root.potrdiVprasanje !== "function") return;

      var pridevnik = pridevnikTona(priporoceniId());
      var naslov =
        (razlaga && razlaga.naslov) ||
        "Zakaj priporočamo " + pridevnik + " ton?";

      if (jeRocno()) {
        root
          .potrdiVprasanje({
            naslov: naslov,
            odstavki: (razlaga && razlaga.odstavki) || null,
            opis: !(razlaga && razlaga.odstavki)
              ? podrobniRazlog()
              : "",
            potrdiBesedilo: "Uporabi priporočeni ton",
            prekliciBesedilo: "Razumem",
            stil: "primary",
          })
          .then(function (ok) {
            if (ok) {
              if (typeof ctx.onReset === "function") ctx.onReset();
              else izberiTon(priporoceniId(), true);
              osveziUi();
              scrollToTone(priporoceniId(), false);
            }
          });
        return;
      }

      root.potrdiVprasanje({
        naslov: naslov,
        odstavki: (razlaga && razlaga.odstavki) || null,
        opis: !(razlaga && razlaga.odstavki) ? podrobniRazlog() : "",
        potrdiBesedilo: "Razumem",
        samoEnGumb: true,
        stil: "primary",
      });
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
        (missingAmount ? "Ni določen" : "");
      var debtLabel =
        s.debtCategoryLabel ||
        rec.debtCategoryLabel ||
        (missingAmount ? "Ni določena" : "");
      var timing = s.timingLabel || rec.timingLabel || "";

      if (znesekZnacka) {
        znesekZnacka.textContent = amount || "Ni določen";
      }
      if (kategorijaZnacka) {
        kategorijaZnacka.textContent = debtLabel || "Ni določena";
        kategorijaZnacka.hidden = false;
      }
      if (casTekst) {
        casTekst.textContent = timing || "Datum zapadlosti ni določen";
      }

      if (reasonText) {
        reasonText.textContent =
          "Zakaj predlagamo " + pridevnikTona(priporoceniId()) + " ton?";
      }
      if (reasonRow) {
        reasonRow.setAttribute(
          "aria-label",
          "Pojasni: Zakaj predlagamo " +
            pridevnikTona(priporoceniId()) +
            " ton?"
        );
      }
    }

    function posodobiGumbe() {
      if (!tir) return;
      var s = stanje();
      var recId = priporoceniId();
      tir.querySelectorAll(".tone-option").forEach(function (gumb) {
        var id = gumb.dataset.toneId;
        var izbrana = id === s.selectedToneId;
        var priporocena = id === recId;
        gumb.setAttribute("data-selected", izbrana ? "true" : "false");
        gumb.setAttribute("aria-checked", izbrana ? "true" : "false");
        gumb.tabIndex = izbrana ? 0 : -1;

        var zvezda = gumb.querySelector(".tone-option__recommended-star");
        if (zvezda) zvezda.hidden = !priporocena;

        var ton = UJ.najdiTonPoId(id);
        var label = ton ? ton.labelSl : id;
        gumb.setAttribute(
          "aria-label",
          label +
            " ton" +
            (priporocena ? ", priporočeno" : "") +
            (izbrana ? ", izbrano" : "")
        );
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
      var gumbi = tir.querySelectorAll(".tone-option");
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
      if (tihoScrollanje || !uporabnikDrsne) return;
      uporabnikDrsne = false;
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
        gumb.className = "tone-option";
        gumb.dataset.toneId = ton.id;
        gumb.setAttribute("role", "radio");
        gumb.setAttribute("aria-checked", "false");
        gumb.setAttribute("data-selected", "false");
        gumb.id = "ton-tab-" + ton.id;
        gumb.innerHTML =
          '<span class="tone-option__icon" aria-hidden="true">' +
          (IKONE_SVG[ton.iconKey] || IKONE_SVG.smile) +
          "</span>" +
          '<span class="tone-option__label"></span>' +
          '<span class="tone-option__recommended-star" aria-hidden="true" hidden>★</span>';
        gumb.querySelector(".tone-option__label").textContent = ton.labelSl;

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
          if (tihoScrollanje) return;
          uporabnikDrsne = true;
          if (scrollCasovnik) window.clearTimeout(scrollCasovnik);
          scrollCasovnik = window.setTimeout(potrdiTonPoScrollu, 100);
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

    if (reasonRow) {
      reasonRow.addEventListener("click", function () {
        pokaziZakaj();
      });
    }

    if (typeof ResizeObserver !== "undefined" && carousel) {
      var ro = new ResizeObserver(function () {
        posodobiPaddingCarousela();
        if (!uporabnikDrsne && !potegAktiven) {
          scrollToTone(stanje().selectedToneId || "friendly", true);
        }
      });
      ro.observe(carousel);
    }

    zgradiGumbe();
    posodobiPaddingCarousela();
    osveziUi();
    window.requestAnimationFrame(function () {
      posodobiPaddingCarousela();
      scrollToTone(stanje().selectedToneId || "friendly", true);
      sporociBralniku();
    });

    return {
      osvezi: function () {
        osveziUi();
        posodobiPaddingCarousela();
      },
      scrollToSelected: function () {
        scrollToTone(stanje().selectedToneId, false);
      },
      pokaziZakaj: pokaziZakaj,
      IKONE_SVG: IKONE_SVG,
    };
  }

  root.inicializirajTonWidget = inicializirajTonWidget;
  root.UJTonWidgetIkone = IKONE_SVG;
  root.UJTonPridevnik = pridevnikTona;
})(typeof globalThis !== "undefined" ? globalThis : this);
