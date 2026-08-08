/* ========== Widget Ton sporočila (vrtiljak) ==========
   window.inicializirajTonWidget(ctx)
   ============================================ */
(function (root) {
  "use strict";

  var IKONE_SVG = {
    "smile-heart":
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    smile:
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>',
    message:
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    shield:
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
    alert:
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  };

  /**
   * @param {object} ctx
   * @param {() => object} ctx.getState
   * @param {(s: object) => void} ctx.setState
   * @param {object} ctx.recommendation – rezultat getRecommendedTone
   * @param {(toneId: string) => void} ctx.onToneSelected
   * @param {() => void} ctx.onReset
   * @param {(detail: string) => void} [ctx.onShowReasonDetail]
   */
  function inicializirajTonWidget(ctx) {
    var UJ = root.UJTonPriporocilo;
    var rootEl = document.getElementById("ton-widget");
    if (!UJ || !rootEl || !ctx) return;

    var tir = document.getElementById("ton-tir");
    var pike = document.getElementById("ton-pike");
    var levo = document.getElementById("ton-puscica-levo");
    var desno = document.getElementById("ton-puscica-desno");
    var znacka = document.getElementById("ton-predlagani-znacka");
    var razlaga = document.getElementById("ton-razlaga");
    var razlagaInfo = document.getElementById("ton-razlaga-info");
    var znesekZnacka = document.getElementById("ton-znesek-znacka");
    var casZnacka = document.getElementById("ton-cas-znacka");
    var overrideEl = document.getElementById("ton-override");
    var overrideBesedilo = document.getElementById("ton-override-besedilo");
    var ponastavi = document.getElementById("ton-ponastavi");
    var ariaLive = document.getElementById("ton-aria-live");
    var tabpanel = document.getElementById("ton-tabpanel-predloge");

    var potegAktiven = false;
    var potegPremaknil = false;
    var startX = 0;
    var scrollCasovnik = null;
    var tihoScrollanje = false;

    rootEl.hidden = false;

    function stanje() {
      return ctx.getState() || {};
    }

    function indeksTona(toneId) {
      for (var i = 0; i < UJ.TONI.length; i++) {
        if (UJ.TONI[i].id === toneId) return i;
      }
      return 0;
    }

    function posodobiGlavo() {
      var s = stanje();
      var rec = ctx.recommendation || {};
      var recTon = UJ.najdiTonPoId(s.recommendedToneId) || rec.tone;
      if (znacka && recTon) znacka.textContent = recTon.labelSl;
      if (razlaga) {
        razlaga.textContent =
          s.reasonText || rec.reasonText || "Predlagano glede na znesek in zapadlost računa.";
      }
      if (razlagaInfo) {
        var detail = s.reasonDetailText || rec.reasonDetailText || "";
        razlagaInfo.hidden = !detail || detail === (s.reasonText || rec.reasonText);
        razlagaInfo.dataset.detail = detail;
      }
      if (znesekZnacka) {
        var amount = s.amountLabel || rec.amountLabel || "";
        znesekZnacka.textContent = amount;
        znesekZnacka.hidden = !amount;
      }
      if (casZnacka) {
        var timing = s.timingLabel || rec.timingLabel || "";
        casZnacka.textContent = timing;
        casZnacka.hidden = !timing;
      }
      if (overrideEl && overrideBesedilo) {
        if (s.isOverridden) {
          var sel = UJ.najdiTonPoId(s.selectedToneId);
          overrideEl.hidden = false;
          overrideBesedilo.textContent =
            "Sistem predlaga: " +
            (recTon ? recTon.labelSl : "—") +
            "\nRočno izbrano: " +
            (sel ? sel.labelSl : "—");
        } else {
          overrideEl.hidden = true;
        }
      }
    }

    function posodobiPuscice() {
      var idx = indeksTona(stanje().selectedToneId);
      if (levo) levo.disabled = idx <= 0;
      if (desno) desno.disabled = idx >= UJ.TONI.length - 1;
    }

    function posodobiPike() {
      if (!pike) return;
      var idx = indeksTona(stanje().selectedToneId);
      pike.querySelectorAll(".ton-widget__pika").forEach(function (p, i) {
        p.classList.toggle("ton-widget__pika--aktivna", i === idx);
        p.setAttribute("aria-selected", i === idx ? "true" : "false");
      });
    }

    function posodobiKartice() {
      if (!tir) return;
      var s = stanje();
      tir.querySelectorAll(".ton-widget__kartica").forEach(function (kartica) {
        var id = kartica.dataset.toneId;
        var izbrana = id === s.selectedToneId;
        var predlagana = id === s.recommendedToneId;
        kartica.classList.toggle("ton-widget__kartica--izbrana", izbrana);
        kartica.setAttribute("aria-selected", izbrana ? "true" : "false");
        kartica.tabIndex = izbrana ? 0 : -1;
        var badge = kartica.querySelector(".ton-widget__kartica-predlagano");
        if (badge) badge.hidden = !predlagana;
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
      posodobiKartice();
      posodobiPike();
      posodobiPuscice();
    }

    function izberiTon(toneId, scrollaj) {
      if (!toneId) return;
      var s = stanje();
      if (s.selectedToneId === toneId && !scrollaj) {
        osveziUi();
        return;
      }
      if (typeof ctx.onToneSelected === "function") {
        ctx.onToneSelected(toneId);
      }
      osveziUi();
      if (scrollaj !== false) scrollToTone(toneId, true);
      sporociBralniku();
    }

    function karticaNaIndeksu(i) {
      if (!tir) return null;
      return tir.querySelectorAll(".ton-widget__kartica")[i] || null;
    }

    function scrollToTone(toneId, instant) {
      var idx = indeksTona(toneId);
      var kartica = karticaNaIndeksu(idx);
      if (!kartica || !tir) return;
      tihoScrollanje = true;
      var cilj =
        kartica.offsetLeft - (tir.clientWidth / 2 - kartica.offsetWidth / 2);
      tir.scrollTo({
        left: Math.max(0, cilj),
        behavior: instant ? "auto" : "smooth",
      });
      window.setTimeout(function () {
        tihoScrollanje = false;
      }, instant ? 50 : 350);
    }

    function najblizjaKartica() {
      if (!tir) return null;
      var sredisce = tir.scrollLeft + tir.clientWidth / 2;
      var kartice = tir.querySelectorAll(".ton-widget__kartica");
      var naj = null;
      var najRazlika = Infinity;
      kartice.forEach(function (k) {
        var c = k.offsetLeft + k.offsetWidth / 2;
        var d = Math.abs(c - sredisce);
        if (d < najRazlika) {
          najRazlika = d;
          naj = k;
        }
      });
      return naj;
    }

    function potrdiTonPoScrollu() {
      if (tihoScrollanje) return;
      var k = najblizjaKartica();
      if (!k) return;
      var id = k.dataset.toneId;
      if (id && id !== stanje().selectedToneId) {
        izberiTon(id, false);
      } else {
        osveziUi();
      }
    }

    function zgradiKartice() {
      if (!tir || !pike) return;
      tir.innerHTML = "";
      pike.innerHTML = "";
      UJ.TONI.forEach(function (ton, i) {
        var kartica = document.createElement("button");
        kartica.type = "button";
        kartica.className = "ton-widget__kartica";
        kartica.dataset.toneId = ton.id;
        kartica.setAttribute("role", "tab");
        kartica.setAttribute("aria-controls", "ton-tabpanel-predloge");
        kartica.id = "ton-tab-" + ton.id;
        kartica.innerHTML =
          '<span class="ton-widget__kartica-ikona">' +
          (IKONE_SVG[ton.iconKey] || IKONE_SVG.message) +
          "</span>" +
          '<span class="ton-widget__kartica-naziv"></span>' +
          '<span class="ton-widget__kartica-predlagano" hidden>Predlagano</span>';
        kartica.querySelector(".ton-widget__kartica-naziv").textContent = ton.labelSl;

        kartica.addEventListener("click", function (ev) {
          if (potegPremaknil) {
            ev.preventDefault();
            potegPremaknil = false;
            return;
          }
          izberiTon(ton.id, true);
        });

        tir.appendChild(kartica);

        var pika = document.createElement("button");
        pika.type = "button";
        pika.className = "ton-widget__pika";
        pika.setAttribute("aria-label", "Ton: " + ton.labelSl);
        pika.setAttribute("aria-selected", "false");
        pika.addEventListener("click", function () {
          izberiTon(ton.id, true);
        });
        pike.appendChild(pika);
      });
    }

    function premakniZa(delta) {
      var idx = indeksTona(stanje().selectedToneId) + delta;
      idx = Math.max(0, Math.min(UJ.TONI.length - 1, idx));
      izberiTon(UJ.TONI[idx].id, true);
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

      tir.addEventListener("keydown", function (ev) {
        if (ev.key === "ArrowLeft") {
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
    }

    if (levo) levo.addEventListener("click", function () { premakniZa(-1); });
    if (desno) desno.addEventListener("click", function () { premakniZa(1); });
    if (ponastavi) {
      ponastavi.addEventListener("click", function () {
        if (typeof ctx.onReset === "function") ctx.onReset();
        osveziUi();
        scrollToTone(stanje().selectedToneId, false);
        sporociBralniku();
      });
    }
    if (razlagaInfo) {
      razlagaInfo.addEventListener("click", function () {
        var detail = razlagaInfo.dataset.detail || "";
        if (!detail) return;
        if (typeof ctx.onShowReasonDetail === "function") {
          ctx.onShowReasonDetail(detail);
        } else if (typeof root.potrdiVprasanje === "function") {
          root.potrdiVprasanje({
            naslov: "Zakaj ta ton?",
            opis: detail,
            potrdiBesedilo: "V redu",
            samoEnGumb: true,
            stil: "primary",
          });
        }
      });
    }

    zgradiKartice();
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
    };
  }

  root.inicializirajTonWidget = inicializirajTonWidget;
})(typeof globalThis !== "undefined" ? globalThis : this);
