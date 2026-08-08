/* ========== Načrt opominjanja (korak 3) – UI ==========
   Glavni + potrditveni zaslon. Kliče window.UJOpominNacrt.
   window.UJOpominNacrtUI
   ============================================ */
(function (root) {
  "use strict";

  var ZAVIHKI = [
    { index: 1, oznaka: "1. opomin" },
    { index: 2, oznaka: "2. opomin" },
    { index: 3, oznaka: "Zadnji opomin" },
    { index: 4, oznaka: "Predaja odvetniku" },
  ];

  var IKONA_KLJUKICA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  var IKONA_KLJUCAVNICA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusOznaka(status) {
    if (status === "confirmed") return "Potrjeno";
    if (status === "needs_review") return "Za pregled";
    return "Osnutek";
  }

  function odrez(besedilo, max) {
    var t = String(besedilo || "").replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + "…";
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

  /**
   * @param {object} opts
   * @param {HTMLElement} opts.glavniEl
   * @param {HTMLElement} opts.potrditevEl
   * @param {object} opts.podatkiKorak1
   * @param {object} opts.podatkiKorak2
   * @param {(besedilo: string, tehnicni?: string) => void} opts.pokaziNapako
   * @param {(plan: object) => Promise<void>} opts.aktivirajNacrt
   * @param {(opcije: object) => Promise<boolean>} [opts.potrdiVprasanje]
   */
  function inicializiraj(opts) {
    var N = root.UJOpominNacrt;
    var Gsm = root.UJGsm7Stevec;
    if (!N || !opts || !opts.glavniEl || !opts.potrditevEl) return null;

    var plan = N.pridobiAliUstvari(opts.podatkiKorak1, opts.podatkiKorak2);
    var aktivenIndex = 1;
    var debounceTimer = null;
    var urejevanIndex = null;

    function shrani() {
      N.shraniOsnutek(plan);
    }

    function pokaziGlavni() {
      opts.glavniEl.hidden = false;
      opts.potrditevEl.hidden = true;
      urejevanIndex = null;
      izrisiGlavni();
    }

    function pokaziPotrditev(index) {
      var step = N.najdiKorak(plan, index);
      if (!step || step.kind !== "sms") return;
      urejevanIndex = index;
      opts.glavniEl.hidden = true;
      opts.potrditevEl.hidden = false;
      izrisiPotrditev(step);
    }

    function razredKroga(step) {
      if (step.kind === "manual_lawyer") return "opomin-nacrt__krog--zaklenjen";
      if (step.status === "confirmed") return "opomin-nacrt__krog--potrjen";
      if (step.status === "needs_review") return "opomin-nacrt__krog--pregled";
      return "opomin-nacrt__krog--osnutek";
    }

    function vsebinaKroga(step) {
      if (step.kind === "manual_lawyer") return IKONA_KLJUCAVNICA;
      if (step.status === "confirmed") return IKONA_KLJUKICA;
      return String(step.index);
    }

    function izrisiGlavni() {
      var imaTelefon = Boolean(
        opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika
      );
      var step = N.najdiKorak(plan, aktivenIndex) || plan.steps[0];
      var prejsnji = N.najdiKorak(plan, aktivenIndex - 1);
      var razmik = prejsnji
        ? step.scheduledOffsetDays - prejsnji.scheduledOffsetDays
        : 0;
      var ready = N.soVsiSmsPotrjeni(plan);

      var krogiHtml = plan.steps
        .map(function (s) {
          return (
            '<button type="button" class="opomin-nacrt__krog ' +
            razredKroga(s) +
            (s.index === aktivenIndex ? " opomin-nacrt__krog--aktiven" : "") +
            '" data-krog="' +
            s.index +
            '" aria-label="' +
            esc(ZAVIHKI[s.index - 1].oznaka) +
            ", " +
            esc(statusOznaka(s.status)) +
            '" aria-current="' +
            (s.index === aktivenIndex ? "step" : "false") +
            '">' +
            vsebinaKroga(s) +
            "</button>"
          );
        })
        .join('<span class="opomin-nacrt__krog-crta" aria-hidden="true"></span>');

      var zavihkiHtml = ZAVIHKI.map(function (z) {
        return (
          '<button type="button" class="opomin-nacrt__zavihek' +
          (z.index === aktivenIndex ? " opomin-nacrt__zavihek--aktiven" : "") +
          '" data-zavihek="' +
          z.index +
          '">' +
          esc(z.oznaka) +
          "</button>"
        );
      }).join("");

      var karticaNotri;
      if (step.kind === "manual_lawyer") {
        karticaNotri =
          '<div class="opomin-nacrt__kartica-ikona" aria-hidden="true">' +
          IKONA_KLJUCAVNICA +
          "</div>" +
          '<p class="opomin-nacrt__kartica-naslov">Ročni korak</p>' +
          '<p class="opomin-nacrt__kartica-tekst">Ta korak izvedeš ročno, ko boš pripravljen predati zadevo odvetniku. Nikoli ga ne pošljemo samodejno.</p>' +
          '<span class="opomin-nacrt__znacka opomin-nacrt__znacka--zaklenjen">Ročno</span>';
      } else {
        karticaNotri =
          '<p class="opomin-nacrt__kartica-oznaka">Vsebina SMS</p>' +
          '<p class="opomin-nacrt__kartica-predogled">' +
          esc(odrez(step.finalMessage || step.generatedMessage, 80)) +
          "</p>" +
          '<div class="opomin-nacrt__kartica-vrstica">' +
          '<span class="opomin-nacrt__znacka opomin-nacrt__znacka--' +
          esc(step.status) +
          '">' +
          esc(statusOznaka(step.status)) +
          "</span>" +
          '<button type="button" class="opomin-nacrt__gumb-uredi" data-uredi="' +
          step.index +
          '">Uredi in potrdi →</button>' +
          "</div>";
      }

      opts.glavniEl.innerHTML =
        '<div class="opomin-nacrt__naslov-vrstica">' +
        "<div>" +
        '<h1 class="korak2__naslov">Predlagani načrt</h1>' +
        '<p class="korak2__podnaslov">Preglej in potrdi 4 korake opominjanja.</p>' +
        "</div>" +
        '<span class="korak2__oznaka">3 od 3</span>' +
        "</div>" +
        (!imaTelefon
          ? '<p class="opomin-nacrt__opozorilo" role="status">Telefonska številka dolžnika manjka – SMS-ov ne bo mogoče poslati, dokler je ne dodaš.</p>'
          : "") +
        '<div class="opomin-nacrt__napredek" role="list" aria-label="Napredek potrjevanja">' +
        krogiHtml +
        "</div>" +
        '<div class="opomin-nacrt__zavihki" role="tablist" aria-label="Koraki načrta">' +
        zavihkiHtml +
        "</div>" +
        '<p class="opomin-nacrt__cas">' +
        (step.scheduledOffsetDays === 0
          ? "Pošlje se: takoj ob aktivaciji (dan 0)"
          : "Pošlje se: čez ~" +
            step.scheduledOffsetDays +
            " dni (dan " +
            step.scheduledOffsetDays +
            ")") +
        (aktivenIndex > 1
          ? '<span class="opomin-nacrt__cas-razmik"> · Razmik od prejšnjega: ' +
            razmik +
            " dni</span>"
          : "") +
        "</p>" +
        '<section class="opomin-nacrt__kartica" aria-label="Vsebina koraka">' +
        karticaNotri +
        "</section>" +
        '<ul class="opomin-nacrt__opombe">' +
        "<li>Korake lahko urejaš do aktivacije.</li>" +
        "<li>Korak 4 nikoli ne pošljemo samodejno.</li>" +
        "<li>SMS se pošlje samo, če je telefon dolžnika naveden pri zadevi.</li>" +
        "</ul>" +
        '<footer class="opomin-nacrt__noga">' +
        '<p class="opomin-nacrt__mvp-opomba">Pošiljanje SMS-ov je v pripravi — načrt se shrani, prvi opomin bo poslan v naslednji različici.</p>' +
        '<button type="button" class="korak2__gumb-naprej' +
        (ready ? "" : " opomin-nacrt__cta--cakaj") +
        '" id="opomin-nacrt-cta" ' +
        (ready ? "" : 'aria-disabled="true"') +
        ">" +
        (ready
          ? "Pošlji prvi korak in aktiviraj načrt →"
          : "Potrdi vse korake za aktivacijo") +
        "</button>" +
        "</footer>";

      opts.glavniEl.querySelectorAll("[data-krog]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          aktivenIndex = Number(btn.getAttribute("data-krog"));
          izrisiGlavni();
        });
      });
      opts.glavniEl.querySelectorAll("[data-zavihek]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          aktivenIndex = Number(btn.getAttribute("data-zavihek"));
          izrisiGlavni();
        });
      });
      var uredi = opts.glavniEl.querySelector("[data-uredi]");
      if (uredi) {
        uredi.addEventListener("click", function () {
          pokaziPotrditev(Number(uredi.getAttribute("data-uredi")));
        });
      }
      var cta = opts.glavniEl.querySelector("#opomin-nacrt-cta");
      if (cta) {
        cta.addEventListener("click", function () {
          if (!N.soVsiSmsPotrjeni(plan)) {
            var prvi = N.prviNepotrjenSmsIndex(plan);
            if (prvi != null) {
              aktivenIndex = prvi;
              izrisiGlavni();
              pokaziPotrditev(prvi);
            }
            return;
          }
          aktiviraj();
        });
      }
    }

    function posodobiGsmStevec(textarea, el) {
      if (!el || !Gsm) return;
      var r = Gsm.stevejSms(textarea.value);
      el.textContent = r.label;
      el.classList.toggle("opomin-nacrt__gsm--opozorilo", r.dolgoOpozorilo);
      if (r.dolgoOpozorilo) {
        el.textContent =
          r.label + " — Dolgo sporočilo, poviša strošek/tveganje zavrnitve.";
      }
    }

    function izrisiPotrditev(step) {
      var tonOznaka = N.oznakaTona(plan.toneId);
      var ime =
        (opts.podatkiKorak1 && opts.podatkiKorak1.imeDolznika) || "—";
      var odmik =
        step.scheduledOffsetDays === 0
          ? "takoj ob aktivaciji (dan 0)"
          : "čez ~" + step.scheduledOffsetDays + " dni (dan " + step.scheduledOffsetDays + ")";

      opts.potrditevEl.innerHTML =
        '<div class="opomin-nacrt-potrdi__glava">' +
        '<button type="button" class="opomin-nacrt-potrdi__nazaj" id="opomin-potrdi-nazaj">← Nazaj</button>' +
        '<h1 class="korak2__naslov">Preglej ' +
        step.index +
        ". opomin</h1>" +
        "</div>" +
        '<section class="opomin-nacrt-potrdi__readonly" aria-label="Nastavitve (samo branje)">' +
        '<p><span class="opomin-nacrt-potrdi__label">Ton</span> ' +
        esc(tonOznaka) +
        "</p>" +
        '<p><span class="opomin-nacrt-potrdi__label">Pošiljanje</span> ' +
        esc(odmik) +
        "</p>" +
        '<p><span class="opomin-nacrt-potrdi__label">Dolžnik</span> ' +
        esc(ime) +
        "</p>" +
        '<p><span class="opomin-nacrt-potrdi__label">Znesek</span> ' +
        esc(formatirajZnesek(plan.amountCents)) +
        "</p>" +
        "</section>" +
        '<label class="opomin-nacrt-potrdi__sms-label" for="opomin-potrdi-sms">SMS sporočilo</label>' +
        '<textarea id="opomin-potrdi-sms" class="opomin-nacrt-potrdi__sms" rows="8" maxlength="1000">' +
        esc(step.finalMessage || step.generatedMessage) +
        "</textarea>" +
        '<p class="opomin-nacrt__gsm" id="opomin-potrdi-gsm" aria-live="polite"></p>' +
        '<footer class="opomin-nacrt__noga opomin-nacrt__noga--dva">' +
        '<button type="button" class="opomin-nacrt__gumb-sekundarni" id="opomin-potrdi-nazaj-2">Nazaj</button>' +
        '<button type="button" class="korak2__gumb-naprej" id="opomin-potrdi-shrani">Potrdi</button>' +
        "</footer>";

      var ta = opts.potrditevEl.querySelector("#opomin-potrdi-sms");
      var gsmEl = opts.potrditevEl.querySelector("#opomin-potrdi-gsm");
      var gumbPotrdi = opts.potrditevEl.querySelector("#opomin-potrdi-shrani");

      function osveziPotrdiGumb() {
        var ok = Boolean(ta && ta.value.trim());
        if (gumbPotrdi) gumbPotrdi.disabled = !ok;
      }

      if (ta) {
        posodobiGsmStevec(ta, gsmEl);
        osveziPotrdiGumb();
        ta.addEventListener("input", function () {
          osveziPotrdiGumb();
          posodobiGsmStevec(ta, gsmEl);
          plan = N.posodobiSporociloKoraka(plan, step.index, ta.value);
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(function () {
            shrani();
          }, 500);
        });
      }

      function nazaj() {
        /* Status se ne potrdi; morebiten debounce je že shranil osnutek besedila. */
        clearTimeout(debounceTimer);
        shrani();
        pokaziGlavni();
      }

      var n1 = opts.potrditevEl.querySelector("#opomin-potrdi-nazaj");
      var n2 = opts.potrditevEl.querySelector("#opomin-potrdi-nazaj-2");
      if (n1) n1.addEventListener("click", nazaj);
      if (n2) n2.addEventListener("click", nazaj);

      if (gumbPotrdi) {
        gumbPotrdi.addEventListener("click", function () {
          if (!ta || !ta.value.trim()) return;
          plan = N.potrdiKorak(plan, step.index, ta.value);
          shrani();
          aktivenIndex = step.index;
          pokaziGlavni();
        });
      }
    }

    async function aktiviraj() {
      if (!N.soVsiSmsPotrjeni(plan)) return;
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
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { inicializiraj: inicializiraj };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
