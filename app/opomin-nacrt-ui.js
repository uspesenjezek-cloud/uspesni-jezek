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

  var IKONA_INFO =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function formatCasPolno(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return (
      d.toLocaleDateString("sl-SI", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) +
      " ob " +
      formatCasKratko(iso)
    );
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

  function oznakaCarouselCas(step, index) {
    if (step.deliveryMode === "manual" || step.kind === "manual_lawyer") {
      return IKONA_KLJUCAVNICA + " Ročno";
    }
    if (Number(step.scheduledOffsetDays) === 0) {
      return "Danes • " + formatCasKratko(step.sendAt);
    }
    return "+" + step.scheduledOffsetDays + " dni";
  }

  function besediloPosiljanja(step) {
    if (step.deliveryMode === "manual" || step.kind === "manual_lawyer") {
      return "Ročni korak – samo opozorilo";
    }
    if (Number(step.scheduledOffsetDays) === 0) {
      return "Pošlji danes ob " + formatCasKratko(step.sendAt);
    }
    return "Pošlji " + formatCasPolno(step.sendAt);
  }

  function gsmLabel(Gsm, besedilo) {
    if (!Gsm) {
      var n = String(besedilo || "").length;
      return n + " znakov";
    }
    var r = Gsm.stevejSms(besedilo);
    var deli =
      r.parts === 1 ? "1 del" : r.parts === 2 ? "2 dela" : r.parts + " deli";
    return r.chars + " znakov • " + deli;
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
    var aktivenIndex = 1;
    var debounceTimer = null;
    var urejevanIndex = null;
    var pokaziZakaj = false;
    var pokaziCasPicker = false;

    function shrani() {
      N.shraniOsnutek(plan);
    }

    function potrjeniCount() {
      return N.steviloPotrjenih ? N.steviloPotrjenih(plan) : 0;
    }

    function pokaziGlavni() {
      opts.glavniEl.hidden = false;
      opts.potrditevEl.hidden = true;
      urejevanIndex = null;
      pokaziCasPicker = false;
      izrisiGlavni();
    }

    function pokaziPotrditev(index) {
      var step = N.najdiKorak(plan, index);
      if (!step) return;
      urejevanIndex = index;
      pokaziCasPicker = false;
      opts.glavniEl.hidden = true;
      opts.potrditevEl.hidden = false;
      izrisiPotrditev(step);
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

    function vrsticaVsebine(ikona, naslov, vrednost, badge, dataAkcija) {
      return (
        '<button type="button" class="opomin-nacrt__vsebina-vrstica" data-vsebina="' +
        esc(dataAkcija) +
        '">' +
        '<span class="opomin-nacrt__vsebina-levo">' +
        '<span class="opomin-nacrt__vsebina-ikona" aria-hidden="true">' +
        ikona +
        "</span>" +
        '<span class="opomin-nacrt__vsebina-naslov">' +
        esc(naslov) +
        "</span>" +
        "</span>" +
        '<span class="opomin-nacrt__vsebina-desno">' +
        (badge
          ? '<span class="opomin-nacrt__mini-badge">' + esc(badge) + "</span>"
          : "") +
        '<span class="opomin-nacrt__vsebina-vrednost">' +
        esc(vrednost) +
        "</span>" +
        '<span class="opomin-nacrt__chevron" aria-hidden="true">›</span>' +
        "</span>" +
        "</button>"
      );
    }

    function izrisiGlavni() {
      var imaTelefon = Boolean(
        opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika
      );
      var step = N.najdiKorak(plan, aktivenIndex) || plan.steps[0];
      var prejsnji = N.najdiKorak(plan, aktivenIndex - 1);
      var naslednji = N.najdiKorak(plan, aktivenIndex + 1);
      var ready = N.soVsiSmsPotrjeni(plan);
      var potrjeno = potrjeniCount();
      var k2 = opts.podatkiKorak2 || {};
      var jeManual =
        step.kind === "manual_lawyer" || step.deliveryMode === "manual";

      var razmikNaslednji = 0;
      if (naslednji) {
        razmikNaslednji =
          Number(naslednji.scheduledOffsetDays) -
          Number(step.scheduledOffsetDays);
      } else if (prejsnji) {
        razmikNaslednji =
          Number(step.scheduledOffsetDays) -
          Number(prejsnji.scheduledOffsetDays);
      }

      var pikeHtml = plan.steps
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

      var carouselHtml = plan.steps
        .map(function (s) {
          var aktiven = s.index === aktivenIndex;
          return (
            '<button type="button" class="opomin-nacrt__stage' +
            (aktiven ? " opomin-nacrt__stage--izbran" : "") +
            (s.status === "confirmed" ? " opomin-nacrt__stage--potrjen" : "") +
            '" data-stage="' +
            s.index +
            '" aria-current="' +
            (aktiven ? "step" : "false") +
            '" aria-label="' +
            esc(s.order + ". " + s.title) +
            '">' +
            '<span class="opomin-nacrt__stage-st">' +
            s.order +
            "</span>" +
            '<span class="opomin-nacrt__stage-naslov">' +
            esc(s.title) +
            "</span>" +
            '<span class="opomin-nacrt__stage-cas">' +
            oznakaCarouselCas(s, s.index) +
            "</span>" +
            "</button>"
          );
        })
        .join("");

      var smsBesedilo = step.finalMessage || step.generatedMessage || "";
      var smsMeta = gsmLabel(Gsm, smsBesedilo);

      var vsebinaHtml = "";
      if (!jeManual) {
        var rokVal =
          step.paymentDeadline && step.paymentDeadline.enabled
            ? step.paymentDeadline.days != null
              ? step.paymentDeadline.days + " dni"
              : "Vklopljeno"
            : "Izklopljeno";
        var trrVal =
          step.bankTransfer && step.bankTransfer.enabled
            ? (step.bankTransfer.accountLabel || "Privzeti") +
              (step.bankTransfer.ibanLastFour
                ? " • …" + step.bankTransfer.ibanLastFour
                : "")
            : "Izklopljeno";
        vsebinaHtml =
          '<section class="opomin-nacrt__vsebina-kartica" aria-label="Vsebina koraka">' +
          '<h3 class="opomin-nacrt__sekcija-naslov">Vsebina koraka</h3>' +
          '<div class="opomin-nacrt__vsebina-seznam">' +
          vrsticaVsebine("☺", "Ton sporočila", N.oznakaTona(step.toneId || plan.toneId), null, "ton") +
          vrsticaVsebine(
            "▤",
            "Predloga",
            imePredloge(step, k2),
            "Priporočeno",
            "predloga"
          ) +
          vrsticaVsebine("▣", "Rok plačila", rokVal, null, "rok");
        if (step.installment && step.installment.enabled) {
          vsebinaHtml += vrsticaVsebine(
            "▤",
            "Obročno plačilo",
            (step.installment.count || "?") + " obroki",
            null,
            "obrocno"
          );
        }
        vsebinaHtml +=
          vrsticaVsebine("▭", "TRR", trrVal, null, "trr") +
          "</div></section>";

        vsebinaHtml +=
          '<section class="opomin-nacrt__sms" aria-label="SMS predogled">' +
          '<div class="opomin-nacrt__sms-glava">' +
          "<span>SMS</span>" +
          '<span class="opomin-nacrt__sms-meta">' +
          esc(smsMeta) +
          "</span>" +
          "</div>" +
          '<div class="opomin-nacrt__sms-predogled" tabindex="0" aria-label="Predogled SMS sporočila">' +
          esc(smsBesedilo) +
          "</div>" +
          '<p class="opomin-nacrt__sms-opomba">Celotno sporočilo lahko uredite pri pregledu koraka.</p>' +
          "</section>";
      } else {
        vsebinaHtml =
          '<section class="opomin-nacrt__rocni" aria-label="Ročni korak">' +
          '<div class="opomin-nacrt__rocni-ikona" aria-hidden="true">' +
          IKONA_KLJUCAVNICA +
          "</div>" +
          '<p class="opomin-nacrt__rocni-naslov">Predaja odvetniku</p>' +
          '<p class="opomin-nacrt__rocni-tekst">Ta korak potrdiš kot načrt predaje. Nikoli ga ne pošljemo samodejno — izvedeš ga ročno, ko boš pripravljen.</p>' +
          "</section>";
      }

      var ctaBesedilo = ready
        ? "Pošlji prvi korak in aktiviraj načrt →"
        : "Preveri in potrdi " + step.order + ". korak →";

      opts.glavniEl.innerHTML =
        '<div class="opomin-nacrt__vsebina">' +
        (!imaTelefon
          ? '<p class="opomin-nacrt__opozorilo" role="status">Telefonska številka dolžnika manjka – SMS-ov ne bo mogoče poslati, dokler je ne dodaš.</p>'
          : "") +
        '<section class="opomin-nacrt__povzetek" aria-label="Predlagani načrt">' +
        '<p class="opomin-nacrt__povzetek-naslov">Predlagani načrt</p>' +
        '<p class="opomin-nacrt__povzetek-vrednost">4 koraki v ' +
        esc(String(plan.totalDurationDays || 0)) +
        " dneh</p>" +
        '<div class="opomin-nacrt__povzetek-vrstica">' +
        '<div class="opomin-nacrt__povzetek-znacke">' +
        '<span class="opomin-nacrt__chip opomin-nacrt__chip--teal">' +
        esc(formatirajZnesek(plan.amountCents)) +
        "</span>" +
        '<span class="opomin-nacrt__chip opomin-nacrt__chip--beige">' +
        esc(String(plan.overdueDays != null ? plan.overdueDays : plan.overdueDaysAtCreation || 0)) +
        " dni zamude</span>" +
        "</div>" +
        '<button type="button" class="opomin-nacrt__povezava" id="opomin-zakaj">Zakaj ta časovnica?</button>' +
        "</div>" +
        (pokaziZakaj
          ? '<p class="opomin-nacrt__zakaj" id="opomin-zakaj-tekst">' +
            esc(
              plan.recommendationReason ||
                N.sestaviRazlog(
                  plan.amountCents,
                  plan.overdueDays || 0,
                  plan.toneId
                )
            ) +
            "</p>"
          : "") +
        "</section>" +
        '<div class="opomin-nacrt__napredek-vrstica">' +
        '<p class="opomin-nacrt__napredek-tekst">Potrjeno ' +
        potrjeno +
        " od " +
        plan.steps.length +
        "</p>" +
        '<div class="opomin-nacrt__pike" role="list" aria-label="Napredek potrjevanja">' +
        pikeHtml +
        "</div>" +
        "</div>" +
        '<div class="opomin-nacrt__carousel-ovoj">' +
        '<div class="opomin-nacrt__carousel" role="list" aria-label="Koraki načrta">' +
        carouselHtml +
        "</div>" +
        '<span class="opomin-nacrt__carousel-puscica" aria-hidden="true">›</span>' +
        "</div>" +
        '<div class="opomin-nacrt__izbran-glava">' +
        '<h2 class="opomin-nacrt__izbran-naslov">' +
        esc(step.order + ". korak – " + step.title) +
        "</h2>" +
        '<span class="opomin-nacrt__status-badge opomin-nacrt__status-badge--' +
        esc(step.status) +
        '">' +
        esc(statusZnacka(step.status, step.kind)) +
        "</span>" +
        "</div>" +
        '<section class="opomin-nacrt__cas-kartica" aria-label="Čas in razmiki">' +
        '<h3 class="opomin-nacrt__sekcija-naslov">Čas in razmiki</h3>' +
        '<div class="opomin-nacrt__cas-vrstica">' +
        '<span class="opomin-nacrt__cas-ikona" aria-hidden="true">' +
        IKONA_KOLEDAR +
        "</span>" +
        '<span class="opomin-nacrt__cas-tekst">' +
        esc(besediloPosiljanja(step)) +
        "</span>" +
        (jeManual
          ? ""
          : '<button type="button" class="opomin-nacrt__gumb-spremeni" id="opomin-spremeni-cas">Spremeni</button>') +
        "</div>" +
        (pokaziCasPicker && !jeManual
          ? '<div class="opomin-nacrt__cas-picker">' +
            '<label class="opomin-nacrt__cas-picker-label" for="opomin-cas-input">Datum in ura</label>' +
            '<input type="datetime-local" id="opomin-cas-input" class="opomin-nacrt__cas-input" value="' +
            esc(isoZaDatetimeLocal(step.sendAt)) +
            '" />' +
            '<div class="opomin-nacrt__cas-picker-akcije">' +
            '<button type="button" class="opomin-nacrt__gumb-sekundarni" id="opomin-cas-preklici">Prekliči</button>' +
            '<button type="button" class="korak2__gumb-naprej opomin-nacrt__gumb-majhen" id="opomin-cas-shrani">Posodobi časovnico</button>' +
            "</div></div>"
          : "") +
        (naslednji
          ? '<div class="opomin-nacrt__cas-vrstica">' +
            '<span class="opomin-nacrt__cas-ikona" aria-hidden="true">' +
            IKONA_URA +
            "</span>" +
            '<span class="opomin-nacrt__cas-tekst">Naslednji korak čez ' +
            esc(String(Math.max(0, razmikNaslednji))) +
            " dni</span>" +
            "</div>"
          : "") +
        '<div class="opomin-nacrt__cas-vrstica opomin-nacrt__cas-vrstica--zadnja">' +
        '<span class="opomin-nacrt__cas-ikona" aria-hidden="true">' +
        IKONA_URA +
        "</span>" +
        '<span class="opomin-nacrt__cas-tekst">Ohrani razmike med koraki</span>' +
        '<button type="button" class="opomin-nacrt__switch' +
        (plan.keepStageIntervals ? " opomin-nacrt__switch--on" : "") +
        '" id="opomin-keep-intervals" role="switch" aria-checked="' +
        (plan.keepStageIntervals ? "true" : "false") +
        '" aria-label="Ohrani razmike med koraki">' +
        '<span class="opomin-nacrt__switch-gumb" aria-hidden="true"></span>' +
        "</button>" +
        "</div>" +
        "</section>" +
        vsebinaHtml +
        '<div class="opomin-nacrt__info" role="note">' +
        '<span class="opomin-nacrt__info-ikona" aria-hidden="true">' +
        IKONA_INFO +
        "</span>" +
        "<p>Potrjeni koraki se bodo poslali samodejno po časovnici. Načrt se ustavi ob plačilu ali odgovoru dolžnika.</p>" +
        "</div>" +
        '<p class="opomin-nacrt__opozorilo-sivo">Potrditev koraka še ne pošlje sporočila.</p>' +
        '<footer class="opomin-nacrt__noga">' +
        '<button type="button" class="korak2__gumb-naprej" id="opomin-nacrt-cta">' +
        esc(ctaBesedilo) +
        "</button>" +
        '<button type="button" class="opomin-nacrt__shrani-osnutek" id="opomin-shrani-osnutek">Shrani kot osnutek</button>' +
        "</footer>" +
        "</div>";

      poveziGlavni(step, ready);
    }

    function poveziGlavni(step, ready) {
      opts.glavniEl.querySelectorAll("[data-stage]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          aktivenIndex = Number(btn.getAttribute("data-stage"));
          plan.selectedStageId = (N.najdiKorak(plan, aktivenIndex) || {}).id;
          pokaziCasPicker = false;
          shrani();
          izrisiGlavni();
        });
      });

      var zakaj = opts.glavniEl.querySelector("#opomin-zakaj");
      if (zakaj) {
        zakaj.addEventListener("click", function () {
          pokaziZakaj = !pokaziZakaj;
          izrisiGlavni();
        });
      }

      var sw = opts.glavniEl.querySelector("#opomin-keep-intervals");
      if (sw) {
        sw.addEventListener("click", function () {
          plan = N.nastaviKeepIntervals(plan, !plan.keepStageIntervals);
          shrani();
          izrisiGlavni();
        });
      }

      var spremeni = opts.glavniEl.querySelector("#opomin-spremeni-cas");
      if (spremeni) {
        spremeni.addEventListener("click", function () {
          pokaziCasPicker = !pokaziCasPicker;
          izrisiGlavni();
        });
      }

      var casPreklici = opts.glavniEl.querySelector("#opomin-cas-preklici");
      if (casPreklici) {
        casPreklici.addEventListener("click", function () {
          pokaziCasPicker = false;
          izrisiGlavni();
        });
      }

      var casShrani = opts.glavniEl.querySelector("#opomin-cas-shrani");
      if (casShrani) {
        casShrani.addEventListener("click", async function () {
          var input = opts.glavniEl.querySelector("#opomin-cas-input");
          if (!input || !input.value) return;
          if (plan.keepStageIntervals && typeof opts.potrdiVprasanje === "function") {
            var ok = await opts.potrdiVprasanje({
              naslov: "Posodobim časovnico?",
              opis: "Spremenili se bodo tudi datumi naslednjih korakov.",
              potrdiBesedilo: "Posodobi časovnico",
              stil: "primary",
            });
            if (!ok) return;
          }
          var local = input.value;
          var iso = new Date(local).toISOString();
          plan = N.posodobiCasKoraka(plan, step.index, iso);
          shrani();
          pokaziCasPicker = false;
          izrisiGlavni();
        });
      }

      opts.glavniEl.querySelectorAll("[data-vsebina]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (typeof opts.potrdiVprasanje !== "function") return;
          opts.potrdiVprasanje({
            naslov: "Nastavitev koraka",
            opis:
              "Vrednosti so iz 2. koraka. Podrobno urejanje na tem zaslonu pride v naslednji različici — pri pregledu koraka lahko urediš SMS.",
            potrdiBesedilo: "V redu",
            samoEnGumb: true,
            stil: "primary",
          });
        });
      });

      var shraniOsnutek = opts.glavniEl.querySelector("#opomin-shrani-osnutek");
      if (shraniOsnutek) {
        shraniOsnutek.addEventListener("click", function () {
          shrani();
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

      var cta = opts.glavniEl.querySelector("#opomin-nacrt-cta");
      if (cta) {
        cta.addEventListener("click", function () {
          if (ready) {
            aktiviraj();
            return;
          }
          if (step.status === "confirmed") {
            var prvi = N.prviNepotrjenSmsIndex(plan);
            if (prvi != null) {
              aktivenIndex = prvi;
              izrisiGlavni();
              pokaziPotrditev(prvi);
            }
            return;
          }
          pokaziPotrditev(step.index);
        });
      }
    }

    function izrisiPotrditev(step) {
      var jeManual =
        step.kind === "manual_lawyer" || step.deliveryMode === "manual";
      var tonOznaka = N.oznakaTona(step.toneId || plan.toneId);

      var readonly =
        '<section class="opomin-nacrt-potrdi__readonly" aria-label="Nastavitve (samo branje)">' +
        '<p><span class="opomin-nacrt-potrdi__label">Čas</span> ' +
        esc(besediloPosiljanja(step)) +
        "</p>" +
        '<p><span class="opomin-nacrt-potrdi__label">Ton</span> ' +
        esc(tonOznaka) +
        "</p>" +
        '<p><span class="opomin-nacrt-potrdi__label">Predloga</span> ' +
        esc(imePredloge(step, opts.podatkiKorak2)) +
        "</p>" +
        '<p><span class="opomin-nacrt-potrdi__label">Rok plačila</span> ' +
        esc(
          step.paymentDeadline && step.paymentDeadline.enabled
            ? step.paymentDeadline.days != null
              ? step.paymentDeadline.days + " dni"
              : "Vklopljeno"
            : "Izklopljeno"
        ) +
        "</p>";
      if (step.installment && step.installment.enabled) {
        readonly +=
          '<p><span class="opomin-nacrt-potrdi__label">Obročno</span> ' +
          esc((step.installment.count || "?") + " obroki") +
          "</p>";
      }
      readonly +=
        '<p><span class="opomin-nacrt-potrdi__label">TRR</span> ' +
        esc(
          step.bankTransfer && step.bankTransfer.enabled
            ? step.bankTransfer.accountLabel || "Privzeti"
            : "Izklopljeno"
        ) +
        "</p></section>";

      var smsBlock = jeManual
        ? '<p class="opomin-nacrt__rocni-tekst">Ta korak ne pošlje SMS-a. Potrditev pomeni, da boš predajo odvetniku izvedel ročno.</p>'
        : '<label class="opomin-nacrt-potrdi__sms-label" for="opomin-potrdi-sms">SMS sporočilo</label>' +
          '<textarea id="opomin-potrdi-sms" class="opomin-nacrt-potrdi__sms" rows="8" maxlength="1000">' +
          esc(step.finalMessage || step.generatedMessage) +
          "</textarea>" +
          '<p class="opomin-nacrt__gsm" id="opomin-potrdi-gsm" aria-live="polite"></p>';

      opts.potrditevEl.innerHTML =
        '<div class="opomin-nacrt-potrdi__vsebina">' +
        '<button type="button" class="opomin-nacrt-potrdi__nazaj" id="opomin-potrdi-nazaj">← Nazaj in uredi nastavitve</button>' +
        '<h2 class="opomin-nacrt-potrdi__naslov">Preglej ' +
        esc(String(step.order)) +
        ". korak</h2>" +
        '<p class="opomin-nacrt-potrdi__podnaslov">' +
        esc(step.title) +
        "</p>" +
        readonly +
        smsBlock +
        '<footer class="opomin-nacrt__noga opomin-nacrt__noga--stolpec">' +
        '<button type="button" class="korak2__gumb-naprej" id="opomin-potrdi-shrani">Potrdi ' +
        esc(String(step.order)) +
        ". korak in nadaljuj →</button>" +
        '<button type="button" class="opomin-nacrt__shrani-osnutek" id="opomin-potrdi-nazaj-2">← Nazaj in uredi nastavitve</button>' +
        "</footer>" +
        "</div>";

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

      function nazaj() {
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
          if (!jeManual && (!ta || !ta.value.trim())) return;
          plan = N.potrdiKorak(
            plan,
            step.index,
            jeManual ? "" : ta.value
          );
          shrani();
          var naslednji = N.prviNepotrjenSmsIndex(plan);
          if (naslednji != null) {
            aktivenIndex = naslednji;
          } else {
            aktivenIndex = step.index;
          }
          pokaziGlavni();
          var carousel = opts.glavniEl.querySelector(
            '[data-stage="' + aktivenIndex + '"]'
          );
          if (carousel && carousel.scrollIntoView) {
            carousel.scrollIntoView({
              behavior: "smooth",
              inline: "center",
              block: "nearest",
            });
          }
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
