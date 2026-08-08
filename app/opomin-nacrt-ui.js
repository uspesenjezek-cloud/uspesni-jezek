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
    var bridgeBesedilo = document.getElementById("opomin-bridge-besedilo");
    var bridgeRok = document.getElementById("opomin-bridge-rok");
    var bridgeObrocno = document.getElementById("opomin-bridge-obrocno");

    function syncStageDodatki() {
      var step = N.najdiKorak(plan, aktivenIndex);
      if (!step) return;
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
      var iban = String(
        (opts.podatkiKorak1 && opts.podatkiKorak1.iban) || ""
      ).trim();
      step.bankTransfer = {
        enabled: Boolean(dodatki.trr),
        accountId: null,
        accountLabel: dodatki.trr ? "Privzeti" : null,
        ibanLastFour: iban ? iban.slice(-4) : null,
      };
      if (step.status === "confirmed") {
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
    }

    inicializirajSheete();

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
        var rokAktiven =
          (paymentDeadline && paymentDeadline.enabled) ||
          (step.paymentDeadline && step.paymentDeadline.enabled);
        var rokDnevi =
          (paymentDeadline && paymentDeadline.termDays != null
            ? paymentDeadline.termDays
            : null) ||
          (step.paymentDeadline && step.paymentDeadline.days != null
            ? step.paymentDeadline.days
            : null);
        var rokVal = rokAktiven
          ? rokDnevi != null
            ? rokDnevi + " dni"
            : "Vklopljeno"
          : "Izklopljeno";

        var planObroc =
          installmentPlan && installmentPlan.enabled
            ? installmentPlan
            : null;
        var obrocVal = planObroc
          ? (planObroc.installmentCount ||
              (planObroc.installments && planObroc.installments.length) ||
              "?") + " obroki"
          : "Izklopljeno";

        var iban = String(
          (opts.podatkiKorak1 && opts.podatkiKorak1.iban) || ""
        ).trim();
        var iban4 = iban ? iban.slice(-4) : "";
        var trrAktiven = Boolean(
          dodatki.trr ||
            (step.bankTransfer && step.bankTransfer.enabled)
        );
        var trrVal = trrAktiven
          ? "Privzeti" + (iban4 ? " • …" + iban4 : "")
          : "Izklopljeno";

        vsebinaHtml =
          '<section class="opomin-nacrt__vsebina-kartica" aria-label="Vsebina koraka">' +
          '<h3 class="opomin-nacrt__sekcija-naslov">Vsebina koraka</h3>' +
          '<div class="opomin-nacrt__vsebina-seznam">' +
          vrsticaVsebine({
            ikona: IKONA_TON,
            naslov: "Ton sporočila",
            vrednost: N.oznakaTona(step.toneId || plan.toneId),
            vrednostKotPill: true,
            akcija: "ton",
          }) +
          vrsticaVsebine({
            ikona: IKONA_PREDLOGA,
            naslov: "Predloga",
            vrednost: imePredloge(step, k2),
            badge: "Priporočeno",
            akcija: "predloga",
          }) +
          vrsticaVsebine({
            ikona: IKONA_ROK,
            naslov: "Rok plačila",
            vrednost: rokVal,
            akcija: "rok",
          }) +
          vrsticaVsebine({
            ikona: IKONA_OBROCNO,
            naslov: "Obročno plačilo",
            vrednost: obrocVal,
            akcija: "obrocno",
          }) +
          vrsticaVsebine({
            ikona: IKONA_TRR,
            naslov: "TRR",
            vrednost: trrVal,
            akcija: "trr",
          }) +
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
            var iban = String(
              (opts.podatkiKorak1 && opts.podatkiKorak1.iban) || ""
            ).trim();
            if (!iban) {
              if (typeof opts.pokaziNapako === "function") {
                opts.pokaziNapako(
                  "TRR/IBAN še ni na voljo v podatkih zadeve – dodajte ga v prvem koraku ali ročno v sporočilo."
                );
              }
              return;
            }
            dodatki.trr = !dodatki.trr;
            dodatekBesedila.trr = dodatki.trr ? "TRR: " + iban + "." : "";
            shraniVse();
            izrisiGlavni();
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
