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

  var IKONA_DENARNICA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>';

  var IKONA_NASMEH =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>';

  var IKONA_DOKUMENT =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';

  var IKONA_SPONKA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>';

  var IKONA_KAMERA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';

  var IKONA_UVOZI =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>';

  var IKONA_SLIKA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';

  var IKONA_SMS =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/></svg>';

  var IKONA_EMAIL =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 7L2 7"/></svg>';

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
    return ura + "." + min;
  }

  function formatDatumSl(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return (
      d.getDate() +
      ". " +
      (d.getMonth() + 1) +
      ". " +
      d.getFullYear()
    );
  }

  function formatCasPolno(iso) {
    if (!iso) return "—";
    return formatDatumSl(iso) + " ob " + formatCasKratko(iso);
  }

  function isoZaDateInput(iso) {
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
      pad(d.getDate())
    );
  }

  function isoZaTimeInput(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) d = new Date();
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function isoIzDateInTime(dateStr, timeStr) {
    var deli = String(dateStr || "").split("-").map(Number);
    var ure = String(timeStr || "12:00").split(":").map(Number);
    if (deli.length < 3) return null;
    var d = new Date(
      deli[0],
      deli[1] - 1,
      deli[2],
      ure[0] || 0,
      ure[1] || 0,
      0,
      0
    );
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  /* Nekateri stari osnutki nimajo shranjenega mimeType (attachmentMeta) za
     priloge, zato slike zaznamo tudi po končnici datoteke kot varovalko. */
  function jeSlikaPriloga(p) {
    var ime = (p && p.originalFileName) || "";
    var mime = (p && p.mimeType) || "";
    if (mime.indexOf("pdf") >= 0) return false;
    if (mime.indexOf("image/") === 0) return true;
    return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(ime);
  }

  var KLJUC_CAS_BLIZNJICE = "uj-cas-bliznjice";

  function preberiCasBliznjice() {
    try {
      var raw = window.localStorage.getItem(KLJUC_CAS_BLIZNJICE);
      var seznam = raw ? JSON.parse(raw) : [];
      return Array.isArray(seznam) ? seznam : [];
    } catch (_e) {
      return [];
    }
  }

  function shraniCasBliznjice(seznam) {
    try {
      window.localStorage.setItem(
        KLJUC_CAS_BLIZNJICE,
        JSON.stringify(seznam || [])
      );
    } catch (_e) {
      /* prezri (npr. zaseben način brskanja) */
    }
  }

  var CASOVNE_ENOTE_V_DNEH = { dan: 1, teden: 7, mesec: 30 };

  function pretvoriDneveVEnoto(dnevi, enota) {
    var faktor = CASOVNE_ENOTE_V_DNEH[enota] || 1;
    return Math.round((Number(dnevi) || 0) / faktor);
  }

  function pretvoriEnotoVDneve(vrednostVEnoti, enota) {
    var faktor = CASOVNE_ENOTE_V_DNEH[enota] || 1;
    return Math.max(0, Math.round((Number(vrednostVEnoti) || 0) * faktor));
  }

  function dneviOdDanes(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) d = new Date();
    var baza = new Date();
    baza.setHours(12, 0, 0, 0);
    var t = new Date(d);
    t.setHours(12, 0, 0, 0);
    return Math.max(0, Math.round((t.getTime() - baza.getTime()) / 86400000));
  }

  function isoIzDniOdDanes(dnevi, ohraniUroIso) {
    var baza = new Date();
    var ura = 12;
    var min = 0;
    if (ohraniUroIso) {
      var stari = new Date(ohraniUroIso);
      if (!Number.isNaN(stari.getTime())) {
        ura = stari.getHours();
        min = stari.getMinutes();
      }
    }
    baza.setHours(ura, min, 0, 0);
    baza.setDate(baza.getDate() + Math.max(0, Number(dnevi) || 0));
    return baza.toISOString();
  }

  function isoIzPredizboraBliznjice(b) {
    var d = new Date();
    var ure = String((b && b.ura) || "12:00")
      .split(":")
      .map(Number);
    d.setHours(ure[0] || 0, ure[1] || 0, 0, 0);
    d.setDate(d.getDate() + Math.max(0, Number(b && b.dnevi) || 0));
    return d.toISOString();
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

  function offsetOdZacetka(plan, step) {
    if (!plan || !step) return Number(step && step.scheduledOffsetDays) || 0;
    var N = root.UJOpominNacrt;
    var first = plan.steps && plan.steps[0];
    if (!first) return Number(step.scheduledOffsetDays) || 0;
    if (N && typeof N.koledarskiDneviMed === "function") {
      var off = N.koledarskiDneviMed(
        first.sendAt || first.scheduledAt,
        step.sendAt || step.scheduledAt
      );
      if (off != null) return off;
    }
    return Number(step.scheduledOffsetDays) || 0;
  }

  function razmikOdPrejsnjega(plan, step) {
    var N = root.UJOpominNacrt;
    var prejsnji = N ? N.najdiKorak(plan, step.index - 1) : null;
    if (!prejsnji) return 0;
    if (N && typeof N.koledarskiDneviMed === "function") {
      return (
        N.koledarskiDneviMed(
          prejsnji.sendAt || prejsnji.scheduledAt,
          step.sendAt || step.scheduledAt
        ) || 0
      );
    }
    return (
      (Number(step.scheduledOffsetDays) || 0) -
      (Number(prejsnji.scheduledOffsetDays) || 0)
    );
  }

  function formatDatumKratekDDMM(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return (
      String(d.getDate()).padStart(2, "0") +
      "." +
      String(d.getMonth() + 1).padStart(2, "0") +
      "."
    );
  }

  function oznakaCarouselCas(step, plan) {
    if (step.deliveryMode === "manual" || step.kind === "manual_lawyer") {
      return IKONA_KLJUCAVNICA + " Ročno";
    }
    var off = offsetOdZacetka(plan, step);
    var razmik = razmikOdPrejsnjega(plan, step);
    var iso = step.sendAt || step.scheduledAt;
    var vrh = off === 0 ? "Danes" : "+" + Math.max(0, razmik) + " dni";
    var dno = off === 0 ? formatCasKratko(iso) : formatDatumKratekDDMM(iso);
    return (
      '<span class="opomin-nacrt__stage-cas-vrh">' +
      esc(vrh) +
      "</span>" +
      '<span class="opomin-nacrt__stage-cas-crta" aria-hidden="true"></span>' +
      '<span class="opomin-nacrt__stage-cas-dno">' +
      esc(dno) +
      "</span>"
    );
  }

  function besediloPosiljanja(step) {
    if (step.deliveryMode === "manual" || step.kind === "manual_lawyer") {
      return "Ročni korak – samo opozorilo";
    }
    var iso = step.sendAt || step.scheduledAt;
    var off = Number(step.scheduledOffsetDays) || 0;
    /* »Danes« samo če je isti koledarski dan kot danes */
    var d = iso ? new Date(iso) : null;
    var danes = new Date();
    if (
      d &&
      !Number.isNaN(d.getTime()) &&
      d.getFullYear() === danes.getFullYear() &&
      d.getMonth() === danes.getMonth() &&
      d.getDate() === danes.getDate()
    ) {
      return "Pošlji danes ob " + formatCasKratko(iso);
    }
    return "Pošlji " + formatCasPolno(iso);
  }

  function besediloPoslano(step) {
    var iso = step.sentAt || step.sendAt || step.scheduledAt;
    return "Poslano " + formatCasPolno(iso);
  }

  function gsmLabel(Gsm, besedilo) {
    if (!Gsm) {
      var n = Array.from(String(besedilo || "")).length;
      return n + " znakov";
    }
    var r = Gsm.stevejSms(besedilo);
    var deli =
      r.parts === 1 ? "1 del" : r.parts === 2 ? "2 dela" : r.parts + " delov";
    return r.chars + " znakov · " + deli;
  }

  function formatEurIzCentov(cents) {
    if (cents == null || !Number.isFinite(Number(cents))) return null;
    if (root.UJTonPriporocilo && root.UJTonPriporocilo.formatirajZnesekEur) {
      return root.UJTonPriporocilo.formatirajZnesekEur(cents);
    }
    try {
      return new Intl.NumberFormat("sl-SI", {
        style: "currency",
        currency: "EUR",
      }).format(Number(cents) / 100);
    } catch (_e) {
      return formatirajZnesek(cents);
    }
  }

  function kategorijaDolgaIzCentov(cents) {
    var Ton = root.UJTonPriporocilo;
    if (Ton && typeof Ton.getDebtCategoryFromCents === "function") {
      var id = Ton.getDebtCategoryFromCents(cents);
      if (!id) return null;
      return (Ton.DEBT_CATEGORY_LABELS && Ton.DEBT_CATEGORY_LABELS[id]) || id;
    }
    if (cents == null || !Number.isFinite(Number(cents))) return null;
    var eur = Number(cents) / 100;
    if (eur <= 250) return "Nizek dolg";
    if (eur <= 1000) return "Srednji dolg";
    if (eur <= 5000) return "Visok dolg";
    return "Zelo visok dolg";
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
    if (typeof N.uskladiOffseteIzDatumov === "function") {
      plan = N.uskladiOffseteIzDatumov(plan);
    }
    var shranjeniAktivniKorak = (plan.steps || []).find(function (korak) {
      return korak.id === plan.selectedStageId;
    });
    var aktivenIndex = shranjeniAktivniKorak
      ? shranjeniAktivniKorak.index
      : N.prviNepotrjenSmsIndex(plan) || 1;
    var debounceTimer = null;
    var urejevanIndex = null;
    var urejanjeKarticeIndex = null;
    var urejanjeKartic = false;
    /* Ponovni izris ne sme vrniti vodoravnega seznama na prvo kartico. */
    var carouselScrollLeft = 0;
    /* Kateri od gumbov "Zdaj"/"Predizbor" je trenutno aktiven (obarvan zeleno). */
    var izbranCasNacin = "zdaj";
    var kontaktDodajOdprt = { sms: false, email: false };
    var casSheetShiftFollowing = true;
    var casSheetIndex = null;
    /* "trenutni" = čas tega koraka; "naslednji" = razmik do naslednjega */
    var casSheetNacin = "trenutni";
    var casSheetBaseIndex = null;
    /* Enota prikaza v sheetu "Spremeni čas koraka" (dan/teden/mesec) – dejanska
       shranjena vrednost (#opomin-cas-sheet-dnevi ob klicu sync funkcij) je vedno
       v dneh, pretvorba je samo na meji prikaza/vnosa. */
    var casSheetEnota = "dan";
    /* Ali je uporabnik v tej odprtvi sheeta ročno spremenil polje "Ura" –
       če ne, ob izbiri "danes" (0 dni) privzeto nastavimo trenutno uro. */
    var uraRocnoNastavljena = false;

    var PV = root.UJPrilogeVsebina;
    var prilogeKoraka =
      PV && PV.izSejeVPriloge
        ? PV.izSejeVPriloge(opts.podatkiKorak1 || {})
        : [];
    var prilogeNapaka = "";
    var undoPriloga = null;
    var undoTimer = null;
    var smsPaketZeton =
      "p" +
      String((plan && plan.id) || Date.now())
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 10);

    function sinhronizirajPrilogeVKorak1() {
      if (!PV || !opts.podatkiKorak1) return;
      var paket = PV.prilogeVSejo(prilogeKoraka);
      Object.assign(opts.podatkiKorak1, paket);
      try {
        sessionStorage.setItem(
          "neplacilo-korak1-podatki",
          JSON.stringify(opts.podatkiKorak1)
        );
      } catch (_e) {
        /* prezri */
      }
      if (typeof opts.onPrilogeSpremenjene === "function") {
        opts.onPrilogeSpremenjene(opts.podatkiKorak1);
      }
    }

    function privzetiKanaliNovePriloge() {
      var k1 = opts.podatkiKorak1 || {};
      var k2 = opts.podatkiKorak2 || {};
      var sk = k2.sporociloKanali || k1.privzetiKanali || {};
      return PV.privzetiKanaliZaNovoPrilogo({
        imaTelefon: Boolean(k1.telefonDolznika),
        imaEmail: Boolean(k1.emailDolznika),
        korakSms: sk.sms !== false,
        korakEmail: sk.email !== false,
      });
    }

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
    var trrSheetApi = null;
    var trrAccount = k2Seja.trrAccount || null;
    var bridgeBesedilo = document.getElementById("opomin-bridge-besedilo");
    var bridgeRok = document.getElementById("opomin-bridge-rok");
    var bridgeObrocno = document.getElementById("opomin-bridge-obrocno");
    var bridgeTrr = document.getElementById("opomin-bridge-trr");

    function syncStageDodatki() {
      var step = N.najdiKorak(plan, aktivenIndex);
      if (!step) return;
      var predDodatki = JSON.stringify({
        paymentDeadline: step.paymentDeadline,
        installment: step.installment,
        bankTransfer: step.bankTransfer,
      });
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
      var ibanLast =
        trrAccount && trrAccount.ibanLastFour
          ? String(trrAccount.ibanLastFour)
          : null;
      step.bankTransfer = {
        enabled: Boolean(trrAccount && trrAccount.accountId),
        accountId:
          trrAccount && trrAccount.accountId
            ? String(trrAccount.accountId)
            : null,
        accountLabel:
          trrAccount && trrAccount.accountLabel
            ? String(trrAccount.accountLabel)
            : null,
        ibanLastFour: ibanLast,
      };
      var poDodatki = JSON.stringify({
        paymentDeadline: step.paymentDeadline,
        installment: step.installment,
        bankTransfer: step.bankTransfer,
      });
      /* Status "potrjeno" odstranimo SAMO, če so se dodatki dejansko
         spremenili - ne le zato, ker smo kartico odprli za ogled
         (npr. preklop med koraki v karuselu kliče isto funkcijo). */
      if (step.status === "confirmed" && predDodatki !== poDodatki) {
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
        k2.trrAccount = trrAccount;
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
        if (opts.podatkiKorak2 && opts.podatkiKorak2.sporociloKanali) {
          k2.sporociloKanali = opts.podatkiKorak2.sporociloKanali;
        }
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

      if (typeof root.inicializirajTrrSheet === "function") {
        trrSheetApi = root.inicializirajTrrSheet({
          getTrrAccount: function () {
            return trrAccount;
          },
          setTrrAccount: function (v) {
            trrAccount = v;
            dodatki.trr = Boolean(v && v.accountId);
            if (v && v.insertedText) {
              dodatekBesedila.trr = String(v.insertedText);
            } else if (!v) {
              dodatekBesedila.trr = "";
            }
            if (bridgeTrr) {
              bridgeTrr.setAttribute(
                "aria-pressed",
                dodatki.trr ? "true" : "false"
              );
            }
          },
          getPodatkiKorak1: function () {
            return opts.podatkiKorak1 || {};
          },
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
          gumbTrr: bridgeTrr,
          posodobiStanjeUrejevalnika: function () {},
          shraniOsnutekLokalno: function () {
            shraniVse();
          },
          potrdiVprasanje: opts.potrdiVprasanje,
          pokaziNapako: opts.pokaziNapako,
          supabaseKlient:
            typeof supabaseKlient !== "undefined" ? supabaseKlient : null,
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
      if (bridgeTrr) {
        bridgeTrr.setAttribute(
          "aria-pressed",
          trrAccount && trrAccount.accountId ? "true" : "false"
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
      izrisiGlavni();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function pokaziPotrditev(index) {
      var step = N.najdiKorak(plan, index);
      if (!step) return;
      urejevanIndex = index;
      opts.glavniEl.hidden = true;
      opts.potrditevEl.hidden = false;
      izrisiPotrditev(step);
      window.scrollTo({ top: 0, behavior: "smooth" });
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

    function zagotoviCasSheet() {
      var el = document.getElementById("opomin-cas-sheet");
      if (el && !document.getElementById("opomin-cas-sheet-dnevi")) {
        el.remove();
        el = null;
      }
      if (el) return el;
      el = document.createElement("div");
      el.id = "opomin-cas-sheet";
      el.className = "opomin-cas-sheet";
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="opomin-cas-sheet__backdrop" id="opomin-cas-sheet-backdrop" aria-label="Zapri"></button>' +
        '<div class="opomin-cas-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="opomin-cas-sheet-naslov">' +
        '<div class="opomin-cas-sheet__rocaj" aria-hidden="true"></div>' +
        '<div class="opomin-cas-sheet__glava">' +
        '<h2 class="opomin-cas-sheet__naslov" id="opomin-cas-sheet-naslov" tabindex="-1">Spremeni čas koraka</h2>' +
        '<button type="button" class="opomin-cas-sheet__zapri" id="opomin-cas-sheet-zapri" aria-label="Zapri"><span aria-hidden="true">×</span></button>' +
        "</div>" +
        '<div class="opomin-cas-sheet__telo">' +
        '<p class="opomin-cas-sheet__namig">Zgoraj dnevi in ura · spodaj točen datum</p>' +
        '<label class="opomin-cas-sheet__oznaka" id="opomin-cas-sheet-dnevi-label" for="opomin-cas-sheet-dnevi">Dnevi</label>' +
        '<div class="opomin-cas-sheet__casovna-vrstica">' +
        '<div class="opomin-cas-sheet__enota" role="group" aria-label="Enota časa" id="opomin-cas-sheet-enota">' +
        '<button type="button" class="opomin-cas-sheet__enota-gumb opomin-cas-sheet__enota-gumb--aktiven" data-enota="dan" id="opomin-cas-sheet-enota-dan">Dnevi</button>' +
        '<button type="button" class="opomin-cas-sheet__enota-gumb" data-enota="teden" id="opomin-cas-sheet-enota-teden">Tedni</button>' +
        '<button type="button" class="opomin-cas-sheet__enota-gumb" data-enota="mesec" id="opomin-cas-sheet-enota-mesec">Meseci</button>' +
        "</div>" +
        '<div class="opomin-nacrt__dnevi-krmilnik">' +
        '<button type="button" class="opomin-nacrt__dnevi-btn" id="opomin-cas-sheet-dnevi-minus" aria-label="Manj">−</button>' +
        '<input type="number" id="opomin-cas-sheet-dnevi" class="opomin-nacrt__dnevi-input" min="0" step="1" value="0" aria-label="Vrednost v izbrani enoti" />' +
        '<button type="button" class="opomin-nacrt__dnevi-btn" id="opomin-cas-sheet-dnevi-plus" aria-label="Več">+</button>' +
        "</div>" +
        "</div>" +
        '<div class="opomin-cas-sheet__cas-okvir">' +
        '<div class="opomin-cas-sheet__vrstica-2">' +
        '<div class="opomin-cas-sheet__polje">' +
        '<label class="opomin-cas-sheet__oznaka" for="opomin-cas-sheet-datum">Datum</label>' +
        '<div class="opomin-cas-sheet__datum-vrstica">' +
        '<input type="date" id="opomin-cas-sheet-datum" class="opomin-cas-sheet__input" />' +
        '<span class="opomin-cas-sheet__dan-crta" aria-hidden="true"></span>' +
        '<span class="opomin-cas-sheet__dan-tekst" id="opomin-cas-sheet-dan-tedna"></span>' +
        "</div>" +
        "</div>" +
        '<div class="opomin-cas-sheet__polje">' +
        '<label class="opomin-cas-sheet__oznaka" for="opomin-cas-sheet-ura">Ura</label>' +
        '<div class="opomin-cas-sheet__datum-vrstica">' +
        '<input type="time" id="opomin-cas-sheet-ura" class="opomin-cas-sheet__input" />' +
        '<span class="opomin-cas-sheet__dan-crta" aria-hidden="true"></span>' +
        '<span class="opomin-cas-sheet__dan-tekst" id="opomin-cas-sheet-ura-obdobje"></span>' +
        "</div>" +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="opomin-cas-sheet__stikalo-ovoj" id="opomin-cas-sheet-stikalo-ovoj">' +
        '<button type="button" class="opomin-nacrt__switch opomin-nacrt__switch--on" id="opomin-cas-sheet-shift" role="switch" aria-checked="true" aria-label="Prestavi tudi naslednje korake">' +
        '<span class="opomin-nacrt__switch-gumb" aria-hidden="true"></span></button>' +
        '<div class="opomin-cas-sheet__stikalo-tekst">' +
        '<p class="opomin-cas-sheet__stikalo-naslov">Prestavi tudi naslednje korake</p>' +
        '<p class="opomin-cas-sheet__stikalo-opis" id="opomin-cas-sheet-stikalo-opis">Naslednji koraki se premaknejo za enako število dni.</p>' +
        "</div></div>" +
        '<div class="opomin-cas-sheet__bliznjice">' +
        '<p class="opomin-cas-sheet__bliznjice-namig">Predlogi za hitro izbiro</p>' +
        '<div class="opomin-cas-sheet__bliznjice-vrstica">' +
        '<button type="button" class="opomin-cas-sheet__bliznjica-dodaj" id="opomin-cas-sheet-bliznjica-plus" aria-label="Dodaj bližnjico">+</button>' +
        '<div class="opomin-cas-sheet__bliznjice-scroll" id="opomin-cas-sheet-bliznjice-vrstica"></div>' +
        "</div>" +
        '<div class="opomin-cas-sheet__bliznjica-forma" id="opomin-cas-sheet-bliznjica-forma" hidden>' +
        '<span class="opomin-cas-sheet__bliznjica-enota-prikaz" id="opomin-cas-sheet-bliznjica-enota-prikaz" aria-live="polite"></span>' +
        '<span class="opomin-cas-sheet__bliznjica-ob">ob</span>' +
        '<input type="time" id="opomin-cas-sheet-bliznjica-ura" class="opomin-cas-sheet__bliznjica-input" aria-label="Ura bližnjice" />' +
        '<button type="button" class="opomin-cas-sheet__bliznjica-shrani" id="opomin-cas-sheet-bliznjica-shrani">Shrani</button>' +
        "</div>" +
        "</div>" +
        '<p class="opomin-cas-sheet__predogled" id="opomin-cas-sheet-predogled"></p>' +
        '<p class="opomin-cas-sheet__napaka" id="opomin-cas-sheet-napaka" hidden></p>' +
        "</div>" +
        '<div class="opomin-cas-sheet__noga">' +
        '<button type="button" class="opomin-cas-sheet__gumb opomin-cas-sheet__gumb--obris" id="opomin-cas-sheet-preklici">Prekliči</button>' +
        '<button type="button" class="opomin-cas-sheet__gumb opomin-cas-sheet__gumb--primarni" id="opomin-cas-sheet-shrani">Shrani</button>' +
        "</div></div>";
      document.body.appendChild(el);

      function zapri() {
        el.hidden = true;
        casSheetIndex = null;
        casSheetBaseIndex = null;
        casSheetNacin = "trenutni";
        document.documentElement.classList.remove("uj-modal-odprt");
        document.body.classList.remove("uj-modal-odprt");
      }

      function preberiIsoIzPolj() {
        var datumEl = document.getElementById("opomin-cas-sheet-datum");
        var uraEl = document.getElementById("opomin-cas-sheet-ura");
        if (!datumEl || !uraEl) return null;
        return isoIzDateInTime(datumEl.value, uraEl.value);
      }

      function syncDatumIzDni() {
        var dneviEl = document.getElementById("opomin-cas-sheet-dnevi");
        var datumEl = document.getElementById("opomin-cas-sheet-datum");
        var uraEl = document.getElementById("opomin-cas-sheet-ura");
        if (!dneviEl || !datumEl || !uraEl || casSheetIndex == null) return;
        var dnevi = Math.max(0, Math.round(Number(dneviEl.value) || 0));
        dneviEl.value = String(dnevi);
        var ura = uraEl.value || "12:00";
        if (casSheetNacin === "naslednji") {
          var bazaStep = N.najdiKorak(plan, casSheetBaseIndex);
          var osnovni = bazaStep
            ? new Date(bazaStep.sendAt || bazaStep.scheduledAt)
            : new Date();
          if (Number.isNaN(osnovni.getTime())) osnovni = new Date();
          var nov = new Date(osnovni.getTime());
          nov.setDate(nov.getDate() + dnevi);
          datumEl.value = isoZaDateInput(nov.toISOString());
          var ure = String(ura).split(":").map(Number);
          nov.setHours(ure[0] || 0, ure[1] || 0, 0, 0);
        } else {
          var iso = isoIzDniOdDanes(dnevi, null);
          datumEl.value = isoZaDateInput(iso);
          var ure2 = String(ura).split(":").map(Number);
          var d2 = new Date(iso);
          d2.setHours(ure2[0] || 0, ure2[1] || 0, 0, 0);
          datumEl.value = isoZaDateInput(d2.toISOString());
        }
      }

      function syncDneviIzDatuma() {
        var dneviEl = document.getElementById("opomin-cas-sheet-dnevi");
        var datumEl = document.getElementById("opomin-cas-sheet-datum");
        var uraEl = document.getElementById("opomin-cas-sheet-ura");
        if (!dneviEl || !datumEl || !uraEl || !datumEl.value) return;
        var iso = isoIzDateInTime(datumEl.value, uraEl.value || "12:00");
        if (!iso) return;
        if (casSheetNacin === "naslednji") {
          var bazaStep = N.najdiKorak(plan, casSheetBaseIndex);
          var osnovniIso =
            (bazaStep && (bazaStep.sendAt || bazaStep.scheduledAt)) || null;
          var raz =
            typeof N.koledarskiDneviMed === "function"
              ? N.koledarskiDneviMed(osnovniIso, iso)
              : dneviOdDanes(iso);
          dneviEl.value = String(Math.max(0, Number(raz) || 0));
        } else {
          dneviEl.value = String(dneviOdDanes(iso));
        }
      }

      function osveziPredogled() {
        var predogled = document.getElementById("opomin-cas-sheet-predogled");
        var napakaEl = document.getElementById("opomin-cas-sheet-napaka");
        var shraniBtn = document.getElementById("opomin-cas-sheet-shrani");
        if (casSheetIndex == null) return;
        var iso = preberiIsoIzPolj();
        var v = N.validirajCasKoraka
          ? N.validirajCasKoraka(
              plan,
              casSheetIndex,
              iso,
              casSheetShiftFollowing,
              { gapDays: izbraniGapDni() }
            )
          : { ok: true, napaka: null, preview: {} };
        if (napakaEl) {
          if (v.napaka) {
            napakaEl.hidden = false;
            napakaEl.textContent = v.napaka;
          } else {
            napakaEl.hidden = true;
            napakaEl.textContent = "";
          }
        }
        if (shraniBtn) shraniBtn.disabled = !v.ok;
        if (!predogled) return;
        var p = v.preview || {};
        var imaNaslednje = Boolean(N.najdiKorak(plan, casSheetIndex + 1));
        if (!imaNaslednje) {
          predogled.textContent = "";
          return;
        }
        if (casSheetShiftFollowing) {
          var n = p.shiftedCount || 0;
          var zadnji = p.lastSendAt ? formatCasPolno(p.lastSendAt) : "";
          predogled.textContent =
            (n === 1
              ? "Premaknjen bo 1 korak."
              : n === 2
                ? "Premaknjena bosta 2 koraka."
                : "Premaknjeni bodo " + n + " koraki.") +
            (zadnji ? " Zadnji korak bo " + zadnji + "." : "");
        } else {
          var gap = p.nextGapDays;
          predogled.textContent =
            "Spremenjen bo samo " +
            casSheetIndex +
            ". korak." +
            (gap != null
              ? " Naslednji korak bo čez " +
                (N.slovenskaDniBeseda
                  ? N.slovenskaDniBeseda(gap)
                  : gap + " dni") +
                "."
              : "");
        }
      }

      el.querySelector("#opomin-cas-sheet-backdrop").addEventListener(
        "click",
        zapri
      );
      el.querySelector("#opomin-cas-sheet-zapri").addEventListener("click", zapri);
      el.querySelector("#opomin-cas-sheet-preklici").addEventListener(
        "click",
        zapri
      );

      var shiftBtn = el.querySelector("#opomin-cas-sheet-shift");
      var shiftOvoj = el.querySelector("#opomin-cas-sheet-stikalo-ovoj");
      function preklopiPremikNaslednjih() {
        if (!shiftBtn || shiftBtn.disabled) return;
        casSheetShiftFollowing = !casSheetShiftFollowing;
        shiftBtn.classList.toggle(
          "opomin-nacrt__switch--on",
          casSheetShiftFollowing
        );
        shiftBtn.setAttribute(
          "aria-checked",
          casSheetShiftFollowing ? "true" : "false"
        );
        osveziPredogled();
      }
      if (shiftBtn) {
        shiftBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          preklopiPremikNaslednjih();
        });
      }
      if (shiftOvoj) {
        shiftOvoj.addEventListener("click", function () {
          preklopiPremikNaslednjih();
        });
      }

      var dneviMinus = el.querySelector("#opomin-cas-sheet-dnevi-minus");
      var dneviPlus = el.querySelector("#opomin-cas-sheet-dnevi-plus");
      var dneviInput = el.querySelector("#opomin-cas-sheet-dnevi");
      var enotaGumbi = el.querySelectorAll(".opomin-cas-sheet__enota-gumb");
      var uraEl = el.querySelector("#opomin-cas-sheet-ura");

      /* Razmik v PRAVIH dnevih (pretvorba iz izbrane enote) - uporabi se kot
         enotni interval za vse naslednje korake, ko je stikalo
         "Prestavi tudi naslednje korake" vklopljeno. */
      function trenutniGapDni() {
        if (!dneviInput) return null;
        var v = Math.max(0, Math.round(Number(dneviInput.value) || 0));
        return Math.max(0, Math.round(pretvoriEnotoVDneve(v, casSheetEnota)));
      }

      function izbraniGapDni() {
        var g = trenutniGapDni();
        return g != null && g > 0 ? g : null;
      }

      function trenutnaUraHHMM() {
        var d = new Date();
        var h = String(d.getHours()).padStart(2, "0");
        var m = String(d.getMinutes()).padStart(2, "0");
        return h + ":" + m;
      }

      /* Če je izbran "danes" (0 dni) in uporabnik ure še ni ročno nastavil,
         privzeto uro postavimo na trenutno uro (namesto fiksne 12.00). Če
         uporabnik uro ročno spremeni, spoštujemo njegovo izbiro naprej. */
      function posodobiUraCeDanes(trueDays) {
        if (uraRocnoNastavljena || !uraEl) return;
        if (trueDays === 0) uraEl.value = trenutnaUraHHMM();
      }

      /* vEnoti je vrednost v TRENUTNI izbrani enoti (dan/teden/mesec).
         #opomin-cas-sheet-dnevi mora ob klicu syncDatumIzDni/syncDneviIzDatuma
         vedno vsebovati pravo število DNI (ta dva ostajata nespremenjena),
         zato tu pretvorimo v dneve, pokličemo sync, nato prikaz nazaj
         pretvorimo v izbrano enoto. */
      function primeniEnotoVrednost(vEnoti) {
        if (!dneviInput) return;
        var trueDays = Math.min(
          365,
          pretvoriEnotoVDneve(vEnoti, casSheetEnota)
        );
        posodobiUraCeDanes(trueDays);
        dneviInput.value = String(trueDays);
        syncDatumIzDni();
        dneviInput.value = String(
          pretvoriDneveVEnoto(Number(dneviInput.value) || 0, casSheetEnota)
        );
        osveziPredogled();
        posodobiBliznjicaPrikaz();
        posodobiPovzetekIzbire();
      }

      function posodobiAktivnoEnoto() {
        enotaGumbi.forEach(function (g) {
          g.classList.toggle(
            "opomin-cas-sheet__enota-gumb--aktiven",
            g.getAttribute("data-enota") === casSheetEnota
          );
        });
      }

      function izberiEnoto(novaEnota) {
        if (!dneviInput || novaEnota === casSheetEnota) return;
        var trenutniDnevi = pretvoriEnotoVDneve(
          Number(dneviInput.value) || 0,
          casSheetEnota
        );
        casSheetEnota = novaEnota;
        posodobiUraCeDanes(trenutniDnevi);
        dneviInput.value = String(Math.min(365, trenutniDnevi));
        syncDatumIzDni();
        dneviInput.value = String(
          pretvoriDneveVEnoto(Number(dneviInput.value) || 0, casSheetEnota)
        );
        posodobiAktivnoEnoto();
        osveziPredogled();
        posodobiBliznjicaPrikaz();
        posodobiPovzetekIzbire();
      }

      enotaGumbi.forEach(function (g) {
        g.addEventListener("click", function () {
          prekiniAktivnoBliznjico();
          izberiEnoto(g.getAttribute("data-enota"));
        });
      });

      var bliznjiceVrstica = el.querySelector(
        "#opomin-cas-sheet-bliznjice-vrstica"
      );
      var bliznjicaPlus = el.querySelector("#opomin-cas-sheet-bliznjica-plus");
      var bliznjicaForma = el.querySelector("#opomin-cas-sheet-bliznjica-forma");
      var bliznjicaUra = el.querySelector("#opomin-cas-sheet-bliznjica-ura");
      var bliznjicaEnotaPrikaz = el.querySelector(
        "#opomin-cas-sheet-bliznjica-enota-prikaz"
      );
      var bliznjicaShrani = el.querySelector(
        "#opomin-cas-sheet-bliznjica-shrani"
      );
      var povzetekIzbireEl = el.querySelector(
        "#opomin-cas-sheet-povzetek-izbire"
      );

      function oznakaEnoteStevila(n, enota) {
        n = Math.max(0, Math.round(Number(n) || 0));
        if (enota === "teden") {
          if (n === 1) return n + " teden";
          if (n === 2) return n + " tedna";
          if (n === 3 || n === 4) return n + " tedne";
          return n + " tednov";
        }
        if (enota === "mesec") {
          if (n === 1) return n + " mesec";
          if (n === 2) return n + " meseca";
          if (n === 3 || n === 4) return n + " mesece";
          return n + " mesecev";
        }
        if (n === 1) return n + " dan";
        return n + " dni";
      }

      function posodobiBliznjicaPrikaz() {
        if (!bliznjicaEnotaPrikaz || !dneviInput) return;
        bliznjicaEnotaPrikaz.textContent = oznakaEnoteStevila(
          dneviInput.value,
          casSheetEnota
        );
      }

      var DNEVI_V_TEDNU = [
        "Nedelja",
        "Ponedeljek",
        "Torek",
        "Sreda",
        "Četrtek",
        "Petek",
        "Sobota",
      ];

      function posodobiPovzetekIzbire() {
        if (!dneviInput || !uraEl) return;
        var vEnoti = Number(dneviInput.value) || 0;
        var ura = uraEl.value || "12:00";
        var besedilo =
          vEnoti === 0 && casSheetEnota === "dan"
            ? "Danes ob " + ura
            : "Čez " + oznakaEnoteStevila(vEnoti, casSheetEnota) + " ob " + ura;
        if (povzetekIzbireEl) povzetekIzbireEl.textContent = besedilo;

        var danTednaEl = el.querySelector("#opomin-cas-sheet-dan-tedna");
        var datumElZa = el.querySelector("#opomin-cas-sheet-datum");
        if (danTednaEl && datumElZa && datumElZa.value) {
          var d = new Date(datumElZa.value + "T12:00:00");
          danTednaEl.textContent = Number.isNaN(d.getTime())
            ? ""
            : DNEVI_V_TEDNU[d.getDay()];
        }

        var uraObdobjeEl = el.querySelector("#opomin-cas-sheet-ura-obdobje");
        if (uraObdobjeEl) {
          uraObdobjeEl.textContent = ura;
        }
      }

      var aktivnaBliznjica = null;
      var aktivnaBliznjicaIndex = -1;
      var stanjePredBliznjico = null;

      function posnetekPredBliznjico() {
        var datum = el.querySelector("#opomin-cas-sheet-datum");
        return {
          enota: casSheetEnota,
          vrednost: dneviInput ? dneviInput.value : "0",
          datum: datum ? datum.value : "",
          ura: uraEl ? uraEl.value : "",
          uraRocno: uraRocnoNastavljena,
        };
      }

      function obnoviStanjePredBliznjico() {
        if (!stanjePredBliznjico) return;
        var datum = el.querySelector("#opomin-cas-sheet-datum");
        casSheetEnota = stanjePredBliznjico.enota || "dan";
        if (dneviInput) dneviInput.value = stanjePredBliznjico.vrednost;
        if (datum) datum.value = stanjePredBliznjico.datum;
        if (uraEl) uraEl.value = stanjePredBliznjico.ura;
        uraRocnoNastavljena = Boolean(stanjePredBliznjico.uraRocno);
        posodobiAktivnoEnoto();
        osveziPredogled();
        posodobiBliznjicaPrikaz();
        posodobiPovzetekIzbire();
      }

      function prekiniAktivnoBliznjico() {
        if (!aktivnaBliznjica) return;
        aktivnaBliznjica = null;
        aktivnaBliznjicaIndex = -1;
        stanjePredBliznjico = null;
        izrisiBliznjice();
      }

      function uporabiBliznjico(b, i) {
        if (!dneviInput || !uraEl || !b) return;
        if (aktivnaBliznjicaIndex === i) {
          obnoviStanjePredBliznjico();
          aktivnaBliznjica = null;
          aktivnaBliznjicaIndex = -1;
          stanjePredBliznjico = null;
          izrisiBliznjice();
          return;
        }
        if (!aktivnaBliznjica) stanjePredBliznjico = posnetekPredBliznjico();
        casSheetEnota = "dan";
        posodobiAktivnoEnoto();
        uraEl.value = b.ura || "12:00";
        uraRocnoNastavljena = true;
        dneviInput.value = String(Math.max(0, Number(b.dnevi) || 0));
        syncDatumIzDni();
        osveziPredogled();
        aktivnaBliznjica = b;
        aktivnaBliznjicaIndex = i;
        izrisiBliznjice();
      }

      function izrisiBliznjice() {
        if (!bliznjiceVrstica) return;
        var seznam = preberiCasBliznjice();
        bliznjiceVrstica.innerHTML = "";
        seznam.forEach(function (b, i) {
          var chip = document.createElement("button");
          chip.type = "button";
          chip.className =
            "opomin-cas-sheet__bliznjica" +
            (i === aktivnaBliznjicaIndex
              ? " opomin-cas-sheet__bliznjica--aktivna"
              : "");
          chip.setAttribute(
            "aria-pressed",
            i === aktivnaBliznjicaIndex ? "true" : "false"
          );
          chip.textContent =
            (b.ura || "") +
            " · " +
            (Number(b.dnevi) === 0
              ? "danes"
              : "čez " + b.dnevi + (Number(b.dnevi) === 1 ? " dan" : " dni"));
          chip.setAttribute(
            "aria-label",
            "Uporabi bližnjico " + chip.textContent
          );
          chip.addEventListener("click", function () {
            if (bliznjiceVrstica && bliznjiceVrstica._ujJeDrsela) {
              bliznjiceVrstica._ujJeDrsela = false;
              return;
            }
            uporabiBliznjico(b, i);
          });
          var odstrani = document.createElement("span");
          odstrani.className = "opomin-cas-sheet__bliznjica-x";
          odstrani.setAttribute("aria-hidden", "true");
          odstrani.textContent = "×";
          odstrani.addEventListener("click", function (ev) {
            ev.stopPropagation();
            var trenutni = preberiCasBliznjice();
            trenutni.splice(i, 1);
            shraniCasBliznjice(trenutni);
            if (i === aktivnaBliznjicaIndex) {
              aktivnaBliznjica = null;
              aktivnaBliznjicaIndex = -1;
              stanjePredBliznjico = null;
            } else if (i < aktivnaBliznjicaIndex) {
              aktivnaBliznjicaIndex -= 1;
            }
            izrisiBliznjice();
          });
          chip.appendChild(odstrani);
          bliznjiceVrstica.appendChild(chip);
        });
      }

      if (bliznjiceVrstica) {
        var bliznjiceScrollZacetek = 0;
        bliznjiceVrstica.addEventListener("pointerdown", function () {
          bliznjiceScrollZacetek = bliznjiceVrstica.scrollLeft;
          bliznjiceVrstica._ujJeDrsela = false;
        });
        bliznjiceVrstica.addEventListener("scroll", function () {
          if (
            Math.abs(bliznjiceVrstica.scrollLeft - bliznjiceScrollZacetek) > 6
          ) {
            bliznjiceVrstica._ujJeDrsela = true;
          }
        });
      }

      el._ujPonastaviBliznjico = function () {
        aktivnaBliznjica = null;
        aktivnaBliznjicaIndex = -1;
        stanjePredBliznjico = null;
        izrisiBliznjice();
      };

      if (bliznjicaPlus && bliznjicaForma) {
        bliznjicaPlus.addEventListener("click", function () {
          var odprto = !bliznjicaForma.hidden;
          bliznjicaForma.hidden = odprto;
          if (!odprto) {
            if (bliznjicaUra) {
              bliznjicaUra.value = (uraEl && uraEl.value) || "12:00";
            }
            posodobiBliznjicaPrikaz();
        posodobiPovzetekIzbire();
          }
        });
      }

      if (bliznjicaShrani) {
        bliznjicaShrani.addEventListener("click", function () {
          var ura = (bliznjicaUra && bliznjicaUra.value) || "";
          if (!ura) {
            if (bliznjicaUra) bliznjicaUra.focus();
            return;
          }
          var dnevi = pretvoriEnotoVDneve(
            Number((dneviInput && dneviInput.value) || 0),
            casSheetEnota
          );
          var seznam = preberiCasBliznjice();
          seznam.push({ ura: ura, dnevi: dnevi });
          shraniCasBliznjice(seznam);
          if (bliznjicaForma) bliznjicaForma.hidden = true;
          izrisiBliznjice();
        });
      }

      izrisiBliznjice();
      posodobiBliznjicaPrikaz();
      posodobiPovzetekIzbire();

      if (dneviMinus) {
        dneviMinus.addEventListener("click", function () {
          if (!dneviInput) return;
          prekiniAktivnoBliznjico();
          primeniEnotoVrednost(
            Math.max(0, (Number(dneviInput.value) || 0) - 1)
          );
        });
      }
      if (dneviPlus) {
        dneviPlus.addEventListener("click", function () {
          if (!dneviInput) return;
          prekiniAktivnoBliznjico();
          primeniEnotoVrednost((Number(dneviInput.value) || 0) + 1);
        });
      }
      if (dneviInput) {
        dneviInput.addEventListener("input", function () {
          prekiniAktivnoBliznjico();
          /* Pri enoti "dan" je prikazana vrednost enaka pravim dnem, zato lahko
             sproti (med tipkanjem) osvežimo datum/predogled brez prepisa polja.
             Pri tednih/mesecih pretvorbo naredimo šele ob "change" (blur/enter),
             da med tipkanjem ne skačemo kurzorja s prepisom vrednosti. */
          if (casSheetEnota === "dan") {
            posodobiUraCeDanes(Math.max(0, Number(dneviInput.value) || 0));
            syncDatumIzDni();
            osveziPredogled();
            posodobiBliznjicaPrikaz();
        posodobiPovzetekIzbire();
          }
        });
        dneviInput.addEventListener("change", function () {
          primeniEnotoVrednost(Number(dneviInput.value) || 0);
        });
      }

      if (uraEl) {
        uraEl.addEventListener("input", function () {
          prekiniAktivnoBliznjico();
          uraRocnoNastavljena = true;
          osveziPredogled();
          posodobiPovzetekIzbire();
        });
        uraEl.addEventListener("change", function () {
          uraRocnoNastavljena = true;
          osveziPredogled();
          posodobiPovzetekIzbire();
        });
      }
      var datumEl = el.querySelector("#opomin-cas-sheet-datum");
      if (datumEl) {
        datumEl.addEventListener("input", function () {
          prekiniAktivnoBliznjico();
          syncDneviIzDatuma();
          if (dneviInput) {
            dneviInput.value = String(
              pretvoriDneveVEnoto(Number(dneviInput.value) || 0, casSheetEnota)
            );
          }
          osveziPredogled();
          posodobiPovzetekIzbire();
        });
        datumEl.addEventListener("change", function () {
          syncDneviIzDatuma();
          if (dneviInput) {
            dneviInput.value = String(
              pretvoriDneveVEnoto(Number(dneviInput.value) || 0, casSheetEnota)
            );
          }
          osveziPredogled();
          posodobiPovzetekIzbire();
        });
      }

      el.querySelector("#opomin-cas-sheet-shrani").addEventListener(
        "click",
        async function () {
          var shraniBtn = document.getElementById("opomin-cas-sheet-shrani");
          if (casSheetIndex == null) return;
          var iso = preberiIsoIzPolj();
          var gapDni = izbraniGapDni();
          var v = N.validirajCasKoraka(
            plan,
            casSheetIndex,
            iso,
            casSheetShiftFollowing,
            { gapDays: gapDni }
          );
          if (!v.ok) {
            osveziPredogled();
            return;
          }
          if (shraniBtn) shraniBtn.disabled = true;
          if (
            casSheetShiftFollowing &&
            v.preview &&
            Number(v.preview.shiftedCount) > 0 &&
            typeof opts.potrdiVprasanje === "function"
          ) {
            var opisPremika = gapDni
              ? "Ali želite vse naslednje korake premakniti tako, da bo med njimi " +
                (N.slovenskaDniBeseda
                  ? N.slovenskaDniBeseda(gapDni)
                  : gapDni + " dni") +
                " razmika?"
              : "Ali želite vse naslednje korake premakniti za izbrani časovni premik?";
            var potrjeno = await opts.potrdiVprasanje({
              naslov: "Premaknem tudi naslednje korake?",
              opis: opisPremika,
              prekliciBesedilo: "Ne, vrni se",
              potrdiBesedilo: "Da",
              stil: "primary",
            });
            if (!potrjeno) {
              if (shraniBtn) shraniBtn.disabled = false;
              return;
            }
          }
          if (
            shiftBtn &&
            !shiftBtn.disabled &&
            typeof N.nastaviKeepIntervals === "function"
          ) {
            plan = N.nastaviKeepIntervals(plan, casSheetShiftFollowing);
          }
          plan = N.posodobiCasKoraka(plan, casSheetIndex, iso, {
            shiftFollowing: casSheetShiftFollowing,
            gapDays: gapDni,
          });
          shrani();
          zapri();
          izrisiGlavni();
        }
      );

      el._ujOsveziPredogled = osveziPredogled;
      el._ujZapri = zapri;
      el._ujSyncDneviIzDatuma = syncDneviIzDatuma;
      el._ujPosodobiPovzetekIzbire = posodobiPovzetekIzbire;
      return el;
    }

    function odpriCasSheet(index, nacin) {
      var nacinOdprtja = nacin === "naslednji" ? "naslednji" : "trenutni";
      var baseIndex = Number(index);
      var targetIndex =
        nacinOdprtja === "naslednji" ? baseIndex + 1 : baseIndex;
      var step = N.najdiKorak(plan, targetIndex);
      if (!step || (N.jeKorakPremakljiv && !N.jeKorakPremakljiv(step))) return;
      if (nacinOdprtja === "naslednji") {
        var baza = N.najdiKorak(plan, baseIndex);
        if (!baza) return;
      }

      var sheet = zagotoviCasSheet();
      casSheetNacin = nacinOdprtja;
      casSheetBaseIndex = baseIndex;
      casSheetIndex = targetIndex;
      casSheetEnota = "dan";
      uraRocnoNastavljena = false;
      sheet
        .querySelectorAll(".opomin-cas-sheet__enota-gumb")
        .forEach(function (g) {
          g.classList.toggle(
            "opomin-cas-sheet__enota-gumb--aktiven",
            g.getAttribute("data-enota") === "dan"
          );
        });

      var pragZaNaslednje =
        nacinOdprtja === "naslednji" ? baseIndex : targetIndex;
      var imaNaslednje = (plan.steps || []).some(function (s) {
        return (
          Number(s.index) > Number(pragZaNaslednje) &&
          (!N.jeKorakPremakljiv || N.jeKorakPremakljiv(s))
        );
      });
      var stikaloOvoj = document.getElementById("opomin-cas-sheet-stikalo-ovoj");
      if (stikaloOvoj) stikaloOvoj.hidden = false;
      var shiftBtn = document.getElementById("opomin-cas-sheet-shift");
      if (shiftBtn) {
        var shranjenoPremikanje =
          plan.keepStageIntervals == null
            ? true
            : Boolean(plan.keepStageIntervals);
        casSheetShiftFollowing = imaNaslednje && shranjenoPremikanje;
        shiftBtn.disabled = !imaNaslednje;
        shiftBtn.setAttribute("aria-disabled", imaNaslednje ? "false" : "true");
        shiftBtn.classList.toggle(
          "opomin-nacrt__switch--on",
          casSheetShiftFollowing
        );
        shiftBtn.setAttribute(
          "aria-checked",
          casSheetShiftFollowing ? "true" : "false"
        );
      }
      if (stikaloOvoj) {
        stikaloOvoj.classList.toggle(
          "opomin-cas-sheet__stikalo-ovoj--onemogoceno",
          !imaNaslednje
        );
      }
      var stikaloOpis = document.getElementById("opomin-cas-sheet-stikalo-opis");
      if (stikaloOpis) {
        stikaloOpis.textContent = imaNaslednje
          ? "Naslednji koraki se premaknejo za enako število dni."
          : "Za tem korakom ni naslednjih korakov.";
      }

      var naslov = document.getElementById("opomin-cas-sheet-naslov");
      var dneviLabel = document.getElementById("opomin-cas-sheet-dnevi-label");
      if (naslov) {
        naslov.textContent =
          nacinOdprtja === "naslednji"
            ? "Spremeni razmik do naslednjega"
            : "Spremeni čas koraka";
      }
      if (dneviLabel) {
        dneviLabel.textContent =
          nacinOdprtja === "naslednji"
            ? "Razmik do naslednjega koraka"
            : "Čez koliko dni od danes";
      }

      var iso = step.sendAt || step.scheduledAt;
      var datumEl = document.getElementById("opomin-cas-sheet-datum");
      var uraEl = document.getElementById("opomin-cas-sheet-ura");
      var dneviEl = document.getElementById("opomin-cas-sheet-dnevi");
      if (datumEl) datumEl.value = isoZaDateInput(iso);
      if (uraEl) uraEl.value = isoZaTimeInput(iso);
      if (dneviEl) {
        if (nacinOdprtja === "naslednji") {
          var bazaStep = N.najdiKorak(plan, baseIndex);
          var raz =
            typeof N.koledarskiDneviMed === "function"
              ? N.koledarskiDneviMed(
                  bazaStep && (bazaStep.sendAt || bazaStep.scheduledAt),
                  iso
                )
              : 0;
          dneviEl.value = String(Math.max(0, Number(raz) || 0));
        } else {
          dneviEl.value = String(dneviOdDanes(iso));
        }
      }
      /* Ob odprtju: če je izbran "danes" (0) in je ura še nedotaknjena privzeta
         12.00, jo takoj zamenjamo za trenutno uro (glej posodobiUraCeDanes). */
      if (
        uraEl &&
        dneviEl &&
        dneviEl.value === "0" &&
        uraEl.value === "12:00"
      ) {
        var dZdaj = new Date();
        uraEl.value =
          String(dZdaj.getHours()).padStart(2, "0") +
          ":" +
          String(dZdaj.getMinutes()).padStart(2, "0");
      }

      if (sheet._ujPonastaviBliznjico) sheet._ujPonastaviBliznjico();

      sheet.hidden = false;
      document.documentElement.classList.add("uj-modal-odprt");
      document.body.classList.add("uj-modal-odprt");
      if (sheet._ujOsveziPredogled) sheet._ujOsveziPredogled();
      if (sheet._ujPosodobiPovzetekIzbire) sheet._ujPosodobiPovzetekIzbire();
      if (naslov) naslov.focus();
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

    function htmlAddonVrstica(o) {
      o = o || {};
      var vklopljeno = o.stanje === "Vklopljeno";
      return (
        '<button type="button" class="step-addon-row" data-vsebina="' +
        esc(o.akcija || "") +
        '" aria-label="' +
        esc(o.aria || o.naslov || "") +
        '">' +
        '<span class="step-addon-row__icon" aria-hidden="true">' +
        (o.ikona || "") +
        "</span>" +
        '<span class="step-addon-row__label">' +
        esc(o.naslov || "") +
        "</span>" +
        '<span class="step-addon-row__status' +
        (vklopljeno ? " step-addon-row__status--vklopljeno" : "") +
        '">' +
        esc(o.stanje || "") +
        "</span>" +
        "</button>"
      );
    }

    function stevecSklanjatev(n) {
      if (n === 1) return "1 račun";
      if (n === 2) return "2 računa";
      if (n === 3 || n === 4) return n + " računi";
      return n + " računov";
    }

    function statusnoBesediloPriloge(p, imaTel, imaEmail) {
      var sms =
        Boolean(p.deliveryChannels && p.deliveryChannels.sms) &&
        imaTel &&
        p.status === "ready";
      var email =
        Boolean(p.deliveryChannels && p.deliveryChannels.email) &&
        imaEmail &&
        p.status === "ready";
      if (sms && email) return "Priloženo SMS-u in e-pošti";
      if (sms) return "Priloženo SMS-u";
      if (email) return "Priloženo e-pošti";
      return "Dodano samo kot priloga";
    }

    function htmlKanalGumb(vrsta, vkljucen, onemogocen, imeDatoteke) {
      var jeSms = vrsta === "sms";
      var label = jeSms ? "SMS" : "E-pošta";
      var razredi = "vk-kanal-gumb";
      if (onemogocen) razredi += " vk-kanal-gumb--disabled";
      else if (vkljucen) {
        razredi += jeSms ? " vk-kanal-gumb--sms-on" : " vk-kanal-gumb--email-on";
      }
      var aria =
        (jeSms ? "Pošlji račun " : "Pošlji račun ") +
        imeDatoteke +
        (jeSms ? " prek SMS-a" : " po e-pošti");
      return (
        '<button type="button" class="' +
        razredi +
        '" data-kanal="' +
        vrsta +
        '" aria-pressed="' +
        (vkljucen ? "true" : "false") +
        '"' +
        (onemogocen
          ? ' disabled aria-disabled="true" title="' +
            esc(
              jeSms
                ? "Dolžnik nima telefonske številke."
                : "Dolžnik nima e-poštnega naslova."
            ) +
            '"'
          : "") +
        ' aria-label="' +
        esc(aria) +
        '">' +
        (vkljucen && !onemogocen ? "✓ " : "") +
        label +
        "</button>"
      );
    }

    function htmlZgornjaOrodnaVrstica(steviloPrilog) {
      return (
        '<div class="vk-priloge-orodna-vrstica" role="group" aria-label="Priloženi računi">' +
        '<div class="vk-priloge-orodna-vrstica__povzetek">' +
        '<span class="vk-priloge-orodna-vrstica__oznaka">Priloženi računi</span>' +
        '<span class="vk-priloge-orodna-vrstica__stevec" aria-label="' +
        esc(stevecSklanjatev(steviloPrilog)) +
        '">' +
        esc(stevecSklanjatev(steviloPrilog)) +
        "</span>" +
        "</div>" +
        '<button type="button" class="vk-priloge-orodna-vrstica__gumb" id="vk-priloge-slikaj" aria-label="Slikaj račun">' +
        IKONA_KAMERA +
        ' <span class="vk-priloge-orodna-vrstica__gumb-tekst">Slikaj</span></button>' +
        '<button type="button" class="vk-priloge-orodna-vrstica__gumb" id="vk-priloge-uvozi" aria-label="Uvozi račun">' +
        IKONA_UVOZI +
        ' <span class="vk-priloge-orodna-vrstica__gumb-tekst">Uvozi</span></button>' +
        "</div>"
      );
    }

    function htmlKarticaRacuna(p, imaTel, imaEmail) {
      var PV = root.UJPrilogeVsebina;
      var ime = p.originalFileName || "Račun";
      var jePdf =
        (p.mimeType && p.mimeType.indexOf("pdf") >= 0) ||
        /\.pdf$/i.test(ime);
      var jeSlika = jeSlikaPriloga(p) && !jePdf;
      var kanali = p.deliveryChannels || {};
      var nalaga =
        p.status === "uploading" || p.status === "processing";
      var napaka = p.status === "error";
      var velikostTekst = "";
      if (nalaga) {
        velikostTekst =
          p.progress != null && p.progress < 100
            ? "Nalaganje " + Math.round(p.progress) + " %"
            : "Obdelujem …";
      } else if (napaka) {
        velikostTekst = "Nalaganje ni uspelo.";
      } else if (PV && PV.formatVelikost && p.sizeBytes != null) {
        velikostTekst = PV.formatVelikost(p.sizeBytes);
      }
      var statusTekst = napaka
        ? velikostTekst
        : nalaga
          ? velikostTekst
          : statusnoBesediloPriloge(p, imaTel, imaEmail) +
            (velikostTekst ? " · " + velikostTekst : "");
      var smsOn = Boolean(kanali.sms) && imaTel && !nalaga && !napaka;
      var emailOn = Boolean(kanali.email) && imaEmail && !nalaga && !napaka;
      var ikonaPredogleda = jeSlika ? IKONA_SLIKA : IKONA_DOKUMENT;
      return (
        '<div class="vk-racun-kartica" data-priloga-id="' +
        esc(p.id) +
        '" role="listitem">' +
        '<div class="vk-racun-kartica__datoteka">' +
        '<span class="vk-racun-kartica__predogled" data-priloga-predogled="' +
        esc(p.id) +
        '" aria-hidden="true">' +
        ikonaPredogleda +
        "</span>" +
        '<div class="vk-racun-kartica__meta">' +
        '<p class="vk-racun-kartica__ime" title="' +
        esc(ime) +
        '">' +
        esc(ime) +
        "</p>" +
        '<p class="vk-racun-kartica__status' +
        (napaka ? " vk-racun-kartica__status--napaka" : "") +
        '">' +
        esc(statusTekst) +
        (napaka
          ? ' <button type="button" class="vk-priloga-ponovi" data-priloga-ponovi="' +
            esc(p.id) +
            '">Poskusi znova</button>'
          : "") +
        "</p>" +
        (!imaTel && !imaEmail && p.status === "ready"
          ? '<p class="vk-racun-kartica__status vk-racun-kartica__status--napaka">Dodajte telefon ali e-pošto dolžnika.</p>'
          : "") +
        "</div>" +
        '<button type="button" class="vk-racun-kartica__odstrani" data-priloga-odstrani="' +
        esc(p.id) +
        '" aria-label="Odstrani račun ' +
        esc(ime) +
        '">×</button>' +
        "</div>" +
        '<div class="vk-racun-kartica__locilo" aria-hidden="true"></div>' +
        '<div class="vk-racun-kartica__kanali">' +
        '<span class="vk-racun-kartica__kanali-oznaka">Priloži v:</span>' +
        '<div class="vk-racun-kanali-gumbi">' +
        htmlKanalGumbV2("sms", smsOn, !imaTel || nalaga || napaka, ime) +
        htmlKanalGumbV2("email", emailOn, !imaEmail || nalaga || napaka, ime) +
        "</div>" +
        "</div>" +
        "</div>"
      );
    }

    function htmlKanalGumbV2(vrsta, vkljucen, onemogocen, imeDatoteke) {
      var jeSms = vrsta === "sms";
      var label = jeSms ? "SMS" : "E-pošta";
      var aria =
        (jeSms ? "Pošlji račun " : "Pošlji račun ") +
        imeDatoteke +
        (jeSms ? " prek SMS-a" : " po e-pošti");
      var ikona = vkljucen ? IKONA_KLJUKICA : jeSms ? IKONA_SMS : IKONA_EMAIL;
      return (
        '<button type="button" class="vk-kanal-gumb-v2" data-kanal="' +
        vrsta +
        '" aria-pressed="' +
        (vkljucen ? "true" : "false") +
        '"' +
        (onemogocen
          ? ' aria-disabled="true" title="' +
            esc(
              jeSms
                ? "Dolžnik nima telefonske številke."
                : "Dolžnik nima e-poštnega naslova."
            ) +
            '"'
          : "") +
        ' aria-label="' +
        esc(aria) +
        '">' +
        '<span class="vk-kanal-gumb-v2__ikona" aria-hidden="true">' +
        ikona +
        '</span><span class="vk-kanal-gumb-v2__besedilo">' +
        label +
        "</span>" +
        "</button>"
      );
    }

    function htmlGlobalniKanalGumb(vrsta, vkljucen, onemogocen) {
      var jeSms = vrsta === "sms";
      var label = jeSms ? "SMS" : "E-pošta";
      var ikona = vkljucen ? IKONA_KLJUKICA : jeSms ? IKONA_SMS : IKONA_EMAIL;
      var aria = jeSms
        ? "Pošlji ta korak prek SMS-a"
        : "Pošlji ta korak po e-pošti";
      return (
        '<button type="button" class="vk-kanal-gumb-v2 vk-kanal-gumb-v2--kompakt" data-kanal-globalno="' +
        vrsta +
        '" aria-pressed="' +
        (vkljucen ? "true" : "false") +
        '"' +
        (onemogocen
          ? ' aria-disabled="true" title="' +
            esc(
              jeSms
                ? "Dolžnik nima telefonske številke."
                : "Dolžnik nima e-poštnega naslova."
            ) +
            '"'
          : "") +
        ' aria-label="' +
        esc(aria) +
        '">' +
        '<span class="vk-kanal-gumb-v2__ikona" aria-hidden="true">' +
        ikona +
        '</span><span class="vk-kanal-gumb-v2__besedilo">' +
        label +
        "</span>" +
        "</button>"
      );
    }

    function htmlPrilogaVrstica(p, imaTel, imaEmail) {
      var PV = root.UJPrilogeVsebina;
      var ime = p.originalFileName || "Račun";
      var jePdf =
        (p.mimeType && p.mimeType.indexOf("pdf") >= 0) ||
        /\.pdf$/i.test(ime);
      var kanali = p.deliveryChannels || {};
      var nalaga =
        p.status === "uploading" || p.status === "processing";
      var napaka = p.status === "error";
      var velikostTekst = "";
      if (nalaga) {
        velikostTekst =
          p.progress != null && p.progress < 100
            ? "Nalaganje " + Math.round(p.progress) + " %"
            : "Obdelujem …";
      } else if (napaka) {
        velikostTekst = "Nalaganje ni uspelo.";
      } else if (PV && PV.formatVelikost && p.sizeBytes != null) {
        velikostTekst = PV.formatVelikost(p.sizeBytes);
      }
      var smsOn = Boolean(kanali.sms) && imaTel && !nalaga && !napaka;
      var emailOn = Boolean(kanali.email) && imaEmail && !nalaga && !napaka;
      return (
        '<div class="vk-priloga-vrstica" data-priloga-id="' +
        esc(p.id) +
        '" role="listitem">' +
        '<span class="vk-priloga-vrstica__ikona" aria-hidden="true">' +
        (jePdf ? IKONA_DOKUMENT : IKONA_SLIKA) +
        "</span>" +
        '<div class="vk-priloga-vrstica__meta">' +
        '<p class="vk-priloga-vrstica__ime">' +
        esc(ime) +
        "</p>" +
        '<p class="vk-priloga-vrstica__velikost' +
        (napaka ? " vk-priloga-vrstica__velikost--napaka" : "") +
        '">' +
        esc(velikostTekst) +
        (napaka
          ? ' <button type="button" class="vk-priloga-ponovi" data-priloga-ponovi="' +
            esc(p.id) +
            '">Poskusi znova</button>'
          : "") +
        "</p>" +
        (!imaTel && !imaEmail && p.status === "ready"
          ? '<p class="vk-priloga-vrstica__velikost--napaka">Dodajte telefon ali e-pošto dolžnika.</p>'
          : "") +
        "</div>" +
        '<div class="vk-priloga-kanali">' +
        htmlKanalGumb("sms", smsOn, !imaTel || nalaga || napaka, ime) +
        htmlKanalGumb("email", emailOn, !imaEmail || nalaga || napaka, ime) +
        "</div>" +
        '<button type="button" class="vk-priloga-vrstica__odstrani" data-priloga-odstrani="' +
        esc(p.id) +
        '" aria-label="Odstrani račun ' +
        esc(ime) +
        '">×</button>' +
        "</div>"
      );
    }

    function htmlKontaktnaKartica(vrsta, primarniVrednost, dodatniSeznam, primarniVkljucen, dodatniVkljucen, onemogoceno) {
      var jeSms = vrsta === "sms";
      var ikonaSvg = jeSms ? IKONA_SMS : IKONA_EMAIL;
      var naziv = jeSms ? "SMS" : "E-pošta";
      var primarniLabel = primarniVrednost || (jeSms ? "Brez številke" : "Brez e-pošte");
      var placeholderText = jeSms ? "+386..." : "email@domena.si";
      var spremembaHtml = primarniVrednost && !primarniVkljucen
        ? '<p class="kontakt-kartica__sprememba">Ali &#382;elite spremeniti ' +
          (jeSms ? "&#353;tevilko" : "e-po&#353;to") +
          " za ta korak?</p>"
        : "";

      var dodatniHtml = "";
      if (Array.isArray(dodatniSeznam) && dodatniSeznam.length) {
        dodatniHtml = '<div class="kontakt-kartica__dodatni">' +
          dodatniSeznam.map(function (v) {
            return '<span class="kontakt-dodatni">' + esc(v) +
              '<button type="button" class="kontakt-dodatni__x" data-kontakt-odstrani="' + vrsta + '" data-value="' + esc(v) + '" aria-label="Odstrani">×</button>' +
              '</span>';
          }).join("") +
          '</div>';
      }

      var primarniHtml = primarniVrednost
        ? '<div class="kontakt-kartica__primarni">' +
          '<span class="kontakt-kartica__primarni-naslov">' + esc(primarniLabel) + ' <span class="kontakt-kartica__primarni-oznaka">(korak 1)</span></span>' +
          '<button type="button" class="kontakt-toggle kontakt-toggle--majhen' +
          (primarniVkljucen && !onemogoceno ? " kontakt-toggle--vkljucen" : "") +
          '" data-kontakt-toggle-primarni="' + vrsta + '"' +
          (onemogoceno ? ' disabled aria-disabled="true"' : "") +
          ' aria-pressed="' + (primarniVkljucen ? "true" : "false") + '"' +
          ' aria-label="' + esc(primarniVkljucen ? "Izključi primarni " + naziv : "Vključi primarni " + naziv) + '">' +
          (primarniVkljucen && !onemogoceno ? "✓" : "") +
          "</button>" +
          '<button type="button" class="kontakt-kartica__odpri-dodaj" data-kontakt-odpri-vnos="' + vrsta + '" aria-label="Dodaj ' + esc(naziv.toLowerCase()) + '">+</button>' +
          "</div>"
        : '<div class="kontakt-kartica__primarni kontakt-kartica__primarni--brez">' +
          '<span class="kontakt-kartica__primarni-naslov">' + esc(primarniLabel) + '</span>' +
          '<button type="button" class="kontakt-kartica__odpri-dodaj" data-kontakt-odpri-vnos="' + vrsta + '" aria-label="Dodaj ' + esc(naziv.toLowerCase()) + '">+</button>' +
          "</div>";

      return (
        '<div class="kontakt-kartica' + (onemogoceno ? " kontakt-kartica--onemogoceno" : "") + '" data-kontakt-vrsta="' + vrsta + '">' +
        '<div class="kontakt-kartica__glava" aria-label="' + esc(naziv) + '">' +
        '<span class="kontakt-kartica__ikona" aria-hidden="true">' + ikonaSvg + "</span>" +
        "</div>" +
        primarniHtml +
        spremembaHtml +
        dodatniHtml +
        '<div class="kontakt-kartica__dodaj"' + (kontaktDodajOdprt[vrsta] ? "" : " hidden") + '>' +
        '<input type="text" class="kontakt-kartica__dodaj-input" data-kontakt-dodaj-vnos="' + vrsta + '" placeholder="' + esc(placeholderText) + '" maxlength="80" />' +
        '<button type="button" class="kontakt-kartica__dodaj-gumb" data-kontakt-dodaj-gumb="' + vrsta + '" aria-label="Dodaj ' + esc(naziv.toLowerCase()) + '">+</button>' +
        '<button type="button" class="kontakt-kartica__dodaj-preklici" data-kontakt-dodaj-preklici="' + vrsta + '" aria-label="Prekliči dodajanje">×</button>' +
        "</div>" +
        "</div>"
      );
    }

    function htmlKontaktneKartice(ctx) {
      var imaTel = Boolean(ctx.imaTelefon);
      var imaEmail = Boolean(ctx.imaEmail);
      var sporociloKanali = ctx.sporociloKanali || { sms: imaTel, email: imaEmail };
      var customContacts = ctx.customContacts || { phoneNumbers: [], emailAddresses: [] };
      var telIzK1 = ctx.primarniTelefon || "";
      var emailIzK1 = ctx.primarniEmail || "";

      return (
        '<div class="kontakt-kartice" role="group" aria-label="Prejemniki za ta korak">' +
        htmlKontaktnaKartica("sms", telIzK1, customContacts.phoneNumbers, Boolean(sporociloKanali.sms), true, false) +
        htmlKontaktnaKartica("email", emailIzK1, customContacts.emailAddresses, Boolean(sporociloKanali.email), true, false) +
        "</div>"
      );
    }

    function htmlVsebinaKoraka(ctx) {
      ctx = ctx || {};
      var PV = root.UJPrilogeVsebina;
      var K = root.UJPrilogeKonstante || {};
      var znesekTekst = ctx.znesekTekst;
      var tonOznaka = ctx.tonOznaka || "—";
      var smsBesedilo = ctx.smsBesedilo || "";
      var smsUrejanje = ctx.smsUrejanje || "";
      var smsMeta = ctx.smsMeta || "";
      var imaSms = Boolean(String(smsBesedilo).trim());
      var priloge = ctx.priloge || [];
      var imaTel = Boolean(ctx.imaTelefon);
      var imaEmail = Boolean(ctx.imaEmail);
      var readyN = PV ? PV.stevecReady(priloge) : 0;
      var accept = K.ACCEPT_ATTR || "image/*,application/pdf";
      var sporociloKanali = ctx.sporociloKanali || {
        sms: imaTel,
        email: imaEmail,
      };

      return (
        '<section class="step-content-card" aria-label="Vsebina koraka">' +
        '<h3 class="step-content-card__title">Vsebina koraka</h3>' +
        htmlKontaktneKartice(ctx) +
        '<div class="debt-summary debt-summary--compact">' +
        '<span class="debt-summary__icon" aria-hidden="true">' +
        IKONA_DENARNICA +
        "</span>" +
        '<div class="debt-summary__main">' +
        '<span class="debt-summary__label">Dolg</span>' +
        '<span class="debt-summary__amount">' +
        esc(znesekTekst || "—") +
        "</span>" +
        "</div>" +
        '<button type="button" class="debt-summary__tone" data-vsebina="ton" aria-label="Spremeni ton sporočila. Trenutno: ' +
        esc(tonOznaka) +
        '.">' +
        '<span class="debt-summary__tone-content">' +
        '<span class="debt-summary__tone-label">Ton sporočila</span>' +
        '<span class="debt-summary__tone-value">' +
        esc(tonOznaka) +
        "</span>" +
        "</span>" +
        '<span class="debt-summary__tone-chevron" aria-hidden="true">›</span>' +
        "</button>" +
        "</div>" +
        '<div class="step-addons-list">' +
        htmlAddonVrstica({
          ikona: IKONA_ROK,
          naslov: "Rok plačila",
          stanje: ctx.rokStanje,
          akcija: "rok",
          aria:
            "Nastavi rok plačila. Trenutno: " + (ctx.rokStanje || "Izklopljeno"),
        }) +
        htmlAddonVrstica({
          ikona: IKONA_OBROCNO,
          naslov: "Obročno plačilo",
          stanje: ctx.obrocnoStanje,
          akcija: "obrocno",
          aria:
            "Nastavi obročno plačilo. Trenutno: " +
            (ctx.obrocnoStanje || "Izklopljeno"),
        }) +
        htmlAddonVrstica({
          ikona: IKONA_TRR,
          naslov: "TRR",
          stanje: ctx.trrStanje,
          akcija: "trr",
          aria: "Nastavi TRR. Trenutno: " + (ctx.trrStanje || "Izklopljeno"),
        }) +
        "</div>" +
        '<div class="vk-sporocilo-priloge">' +
        '<div class="sms-preview">' +
        '<div class="sms-preview__header">' +
        '<span class="sms-preview__title">SMS</span>' +
        '<span class="sms-preview__meta">' +
        esc(smsMeta) +
        "</span>" +
        "</div>" +
        '<p class="sms-preview__caption">Besedilo lahko popravite neposredno tukaj.</p>' +
        '<div class="sms-preview__okno">' +
        '<textarea class="sms-preview__viewport" id="opomin-sms-urejanje" aria-label="Uredi SMS sporočilo" maxlength="1000" placeholder="Napišite SMS sporočilo">' +
        esc(smsUrejanje) +
        "</textarea>" +
        "</div>" +
        '<div class="opomin-potrdi-predloge" id="opomin-glavni-predloge" hidden>' +
        '<div class="opomin-potrdi-predloge__glava">' +
        '<p class="opomin-potrdi-predloge__naslov">Predloge</p>' +
        '<button type="button" class="opomin-potrdi-predloge__vec" id="opomin-glavni-predloge-vec">Več</button>' +
        "</div>" +
        '<div class="opomin-potrdi-predloge__drsnik" id="opomin-glavni-predloge-drsnik" role="list"></div>' +
        '<div class="opomin-potrdi-predloge__indikator" id="opomin-glavni-predloge-indikator" aria-hidden="true">' +
        '<span class="opomin-potrdi-predloge__pika opomin-potrdi-predloge__pika--aktivna"></span>' +
        '<span class="opomin-potrdi-predloge__pika"></span>' +
        '<span class="opomin-potrdi-predloge__pika"></span>' +
        "</div>" +
        "</div>" +
        "</div>" +
        htmlZgornjaOrodnaVrstica(readyN) +
        '<div class="vk-priloge-kartice-seznam"' +
        (priloge.length ? "" : " hidden") +
        ">" +
        priloge
          .map(function (p) {
            return htmlKarticaRacuna(p, imaTel, imaEmail);
          })
          .join("") +
        "</div>" +
        '<p class="vk-priloge-napaka" id="vk-priloge-napaka" hidden></p>' +
        '<input type="file" id="vk-priloge-datoteka" accept="' +
        esc(accept) +
        '" multiple hidden aria-label="Uvozi račun" />' +
        '<input type="file" id="vk-priloge-kamera" accept="image/*" capture="environment" hidden aria-label="Slikaj račun" />' +
        "</div>" +
        "</section>"
      );
    }

    function izrisiGlavni() {
      var imaTelefon = Boolean(
        opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika
      );
      var step = N.najdiKorak(plan, aktivenIndex) || plan.steps[0];
      var prejsnji = N.najdiKorak(plan, aktivenIndex - 1);
      var naslednji = N.najdiKorak(plan, Number(aktivenIndex) + 1);
      var ready = N.soVsiSmsPotrjeni(plan);
      var potrjeno = potrjeniCount();
      var k2 = opts.podatkiKorak2 || {};
      var imaEmailGlobalno = Boolean(
        opts.podatkiKorak1 && opts.podatkiKorak1.emailDolznika
      );
      var sporociloKanaliGlobalno =
        k2.sporociloKanali || { sms: imaTelefon, email: imaEmailGlobalno };
      if (!step.primaryContacts) {
        step.primaryContacts = {
          sms: Boolean(sporociloKanaliGlobalno.sms),
          email: Boolean(sporociloKanaliGlobalno.email),
        };
      }
      var jeManual =
        step.kind === "manual_lawyer" || step.deliveryMode === "manual";
      var razmikPrejsnji = razmikOdPrejsnjega(plan, step);

      var razmikNaslednji = 0;
      if (naslednji) {
        if (typeof N.koledarskiDneviMed === "function") {
          razmikNaslednji =
            N.koledarskiDneviMed(
              step.sendAt || step.scheduledAt,
              naslednji.sendAt || naslednji.scheduledAt
            ) || 0;
        } else {
          razmikNaslednji =
            Number(naslednji.scheduledOffsetDays) -
            Number(step.scheduledOffsetDays);
        }
      }

      var korakPoslan = step.status === "sent";
      var korakPremakljiv =
        typeof N.jeKorakPremakljiv === "function"
          ? N.jeKorakPremakljiv(step)
          : !korakPoslan && !jeManual;
      var spremeniCasGumbHtml =
        !korakPoslan && !jeManual && korakPremakljiv
          ? '<button type="button" class="opomin-nacrt__gumb-spremeni" id="opomin-spremeni-cas"><span aria-hidden="true">✎</span> Spremeni</button>'
          : "";

      var casKarticaHtml =
        '<section class="opomin-nacrt__cas-kartica" aria-label="Čas in razmiki">' +
        '<div class="opomin-nacrt__cas-vrstica">' +
        '<span class="opomin-nacrt__cas-ikona" aria-hidden="true">' +
        IKONA_KOLEDAR +
        "</span>" +
        '<span class="opomin-nacrt__cas-tekst">' +
        esc(
          korakPoslan
            ? besediloPoslano(step)
            : besediloPosiljanja(step)
        ) +
        "</span>" +
        spremeniCasGumbHtml +
        (korakPoslan || jeManual
          ? ""
          : korakPremakljiv
            ? '<span class="opomin-nacrt__cas-gumbi">' +
              '<button type="button" class="opomin-nacrt__gumb-zdaj' +
              (izbranCasNacin === "zdaj"
                ? " opomin-nacrt__gumb-zdaj--aktiven"
                : "") +
              '" id="opomin-zdaj-cas" aria-label="Nastavi na zdaj">Zdaj</button>' +
              '<span class="opomin-nacrt__predizbor-ovoj">' +
              '<button type="button" class="opomin-nacrt__gumb-predizbor' +
              (izbranCasNacin === "predizbor"
                ? " opomin-nacrt__gumb-predizbor--aktiven"
                : "") +
              '" id="opomin-predizbor-cas" aria-haspopup="true" aria-expanded="false">Predizbor</button>' +
              '<div class="opomin-nacrt__predizbor-meni" id="opomin-predizbor-meni" hidden></div>' +
              "</span>" +
              "</span>"
            : "") +
        "</div>";

      if (naslednji && !jeManual) {
        var naslednjiPremakljiv =
          typeof N.jeKorakPremakljiv === "function"
            ? N.jeKorakPremakljiv(naslednji)
            : naslednji.status !== "sent";
        var oznakaRazmik = N.oznakaCezDni
          ? N.oznakaCezDni(Math.max(0, razmikNaslednji))
          : "Čez " + Math.max(0, razmikNaslednji) + " dni";
        casKarticaHtml +=
          '<div class="opomin-nacrt__cas-vrstica opomin-nacrt__cas-vrstica--zadnja">' +
          '<span class="opomin-nacrt__cas-ikona" aria-hidden="true">' +
          IKONA_URA +
          "</span>" +
          '<span class="opomin-nacrt__cas-blok">' +
          '<span class="opomin-nacrt__cas-oznaka">Naslednji korak</span>' +
          '<span class="opomin-nacrt__cas-tekst">' +
          esc(formatCasPolno(naslednji.sendAt || naslednji.scheduledAt)) +
          "</span>" +
          "</span>" +
          (naslednjiPremakljiv
            ? '<button type="button" class="opomin-nacrt__gumb-dnevi" id="opomin-spremeni-razmik" aria-label="Spremeni razmik: ' +
              esc(oznakaRazmik) +
              '">' +
              esc(oznakaRazmik) +
              "</button>"
            : '<span class="opomin-nacrt__cas-znacka">' +
              esc(oznakaRazmik) +
              "</span>") +
          "</div>";
      } else if (!naslednji && prejsnji) {
        var oznakaRazmikPrejsnji = N.oznakaCezDni
          ? N.oznakaCezDni(Math.max(0, razmikPrejsnji))
          : "Čez " + Math.max(0, razmikPrejsnji) + " dni";
        casKarticaHtml +=
          '<div class="opomin-nacrt__cas-vrstica opomin-nacrt__cas-vrstica--zadnja">' +
          '<span class="opomin-nacrt__cas-ikona" aria-hidden="true">' +
          IKONA_URA +
          "</span>" +
          '<span class="opomin-nacrt__cas-blok">' +
          '<span class="opomin-nacrt__cas-oznaka">Od prejšnjega koraka</span>' +
          '<span class="opomin-nacrt__cas-tekst">' +
          esc(formatCasPolno(prejsnji.sendAt || prejsnji.scheduledAt)) +
          "</span>" +
          "</span>" +
          (korakPremakljiv
            ? '<button type="button" class="opomin-nacrt__gumb-dnevi" id="opomin-spremeni-prejsnji-razmik" aria-label="Spremeni razmik: ' +
              esc(oznakaRazmikPrejsnji) +
              '">' +
              esc(oznakaRazmikPrejsnji) +
              "</button>"
            : '<span class="opomin-nacrt__cas-znacka">' +
              esc(oznakaRazmikPrejsnji) +
              "</span>") +
          "</div>";
      } else if (!naslednji) {
        casKarticaHtml +=
          '<div class="opomin-nacrt__cas-vrstica opomin-nacrt__cas-vrstica--zadnja">' +
          '<span class="opomin-nacrt__cas-ikona" aria-hidden="true">' +
          IKONA_URA +
          "</span>" +
          '<span class="opomin-nacrt__cas-tekst opomin-nacrt__cas-tekst--muted">Zadnji korak načrta</span>' +
          "</div>";
      }

      casKarticaHtml += "</section>";

      var karticeHtml = "";

      var podrobnostCas =
        !jeManual && step.index > 1
          ? '<p class="opomin-nacrt__cas-podrobnost">' +
            esc(formatCasPolno(step.sendAt || step.scheduledAt)) +
            " · " +
            esc(
              N.oznakaPoPrejsnjem
                ? N.oznakaPoPrejsnjem(Math.max(0, razmikPrejsnji))
                : Math.max(0, razmikPrejsnji) + " dni po prejšnjem koraku"
            ) +
            "</p>"
          : "";

      var vkljuceniKoraki = plan.steps.filter(function (s) { return !s.isExcluded; });
      var prikazaniKoraki = urejanjeKartic ? plan.steps : vkljuceniKoraki;

      /* Preslikava index → prikazni red: izključeni koraki se preskočijo. */
      var prikazniRedMap = {};
      var prikazniRedStevec = 0;
      plan.steps.forEach(function (s) {
        if (!s.isExcluded) {
          prikazniRedStevec++;
          prikazniRedMap[s.index] = prikazniRedStevec;
        }
      });
      var prikazniRedStep = step ? (prikazniRedMap[step.index] || step.order) : 1;

      var pikeHtml = vkljuceniKoraki
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

      var carouselHtml = prikazaniKoraki
        .map(function (s) {
          var aktiven = s.index === aktivenIndex;
          var jeVVeljavnemUrejanju = urejanjeKartic;
          var html =
            '<div class="opomin-nacrt__stage-ovoj' +
            (jeVVeljavnemUrejanju ? " opomin-nacrt__stage-ovoj--urejanje" : "") +
            (s.isExcluded ? " opomin-nacrt__stage-ovoj--izkljucen" : "") +
            '">' +
            '<button type="button" class="opomin-nacrt__stage' +
            (aktiven ? " opomin-nacrt__stage--izbran" : "") +
            (s.isExcluded ? " opomin-nacrt__stage--izkljucen" : "") +
            (s.status === "confirmed" ? " opomin-nacrt__stage--potrjen" : "") +
            '" data-stage="' +
            s.index +
            '" aria-current="' +
            (aktiven ? "step" : "false") +
            '" aria-label="' +
            esc((prikazniRedMap[s.index] || s.order) + ". " + s.title) +
            '">' +
            '<span class="opomin-nacrt__stage-st">' +
            (s.isExcluded ? "—" : (prikazniRedMap[s.index] || s.order)) +
            "</span>" +
            '<span class="opomin-nacrt__stage-naslov' +
            (String(s.title || "").length > 20 ? " opomin-nacrt__stage-naslov--zelo-dolg" : String(s.title || "").length > 15 ? " opomin-nacrt__stage-naslov--dolg" : "") +
            '">' +
            esc(s.title) +
            "</span>" +
            '<span class="opomin-nacrt__stage-cas">' +
            oznakaCarouselCas(s, plan) +
            "</span>" +
            "</button>";
          if (jeVVeljavnemUrejanju) {
            html += '<button type="button" class="opomin-nacrt__stage-odstrani" data-odstrani-kartico="' + s.index + '" aria-label="Odstrani ' + esc(s.title) + '">×</button>';
          }
          return html + "</div>";
        })
        .join("");
      var smsOsnova = step.finalMessage || step.generatedMessage || "";
      var smsBesedilo =
        PV && PV.sestaviSmsZPrilogami
          ? PV.sestaviSmsZPrilogami(smsOsnova, prilogeKoraka, smsPaketZeton)
          : smsOsnova;
      var smsMeta = gsmLabel(Gsm, smsBesedilo);

      var vsebinaHtml = "";
      if (!jeManual) {
        var rokAktiven =
          (paymentDeadline && paymentDeadline.enabled) ||
          (step.paymentDeadline && step.paymentDeadline.enabled);
        var obrocAktiven = Boolean(
          installmentPlan && installmentPlan.enabled
        );
        var trrAktiven = Boolean(
          dodatki.trr ||
            (step.bankTransfer && step.bankTransfer.enabled)
        );

        var znesekTekst = formatEurIzCentov(plan.amountCents);
        var kategorijaTekst = kategorijaDolgaIzCentov(plan.amountCents);
        var tonOznaka = N.oznakaTona(step.toneId || plan.toneId);
        var predlogaOznaka = imePredloge(step, k2);
        var predlogaPriporocena =
          !step.templateSelectionMode ||
          step.templateSelectionMode === "automatic";

        vsebinaHtml = htmlVsebinaKoraka({
          znesekTekst: znesekTekst,
          kategorijaTekst: kategorijaTekst,
          tonOznaka: tonOznaka,
          predlogaOznaka: predlogaOznaka,
          predlogaPriporocena: predlogaPriporocena,
          rokStanje: rokAktiven ? "Vklopljeno" : "Izklopljeno",
          obrocnoStanje: obrocAktiven ? "Vklopljeno" : "Izklopljeno",
          trrStanje: trrAktiven ? "Vklopljeno" : "Izklopljeno",
          smsBesedilo: smsBesedilo,
          smsUrejanje: smsOsnova,
          smsMeta: smsMeta,
          priloge: prilogeKoraka,
          imaTelefon: Boolean(
            opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika
          ),
          imaEmail: Boolean(
            opts.podatkiKorak1 && opts.podatkiKorak1.emailDolznika
          ),
          sporociloKanali: step.primaryContacts,
          customContacts: step.customContacts || { phoneNumbers: [], emailAddresses: [] },
          primarniTelefon: (opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika) || "",
          primarniEmail: (opts.podatkiKorak1 && opts.podatkiKorak1.emailDolznika) || "",
        });
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
        : "Preveri in potrdi " + prikazniRedStep + ". korak →";

      var prejsnjiCarousel = opts.glavniEl.querySelector(".opomin-nacrt__carousel");
      if (prejsnjiCarousel) carouselScrollLeft = prejsnjiCarousel.scrollLeft;

      opts.glavniEl.innerHTML =
        '<div class="opomin-nacrt__vsebina">' +
        (!imaTelefon
          ? '<p class="opomin-nacrt__opozorilo" role="status">Telefonska številka dolžnika manjka – SMS-ov ne bo mogoče poslati, dokler je ne dodaš.</p>'
          : "") +
        '<div class="opomin-nacrt__napredek-vrstica">' +
        '<div class="opomin-nacrt__napredek-levo">' +
        '<p class="opomin-nacrt__napredek-tekst">Potrjeno ' +
        potrjeno +
        " od " +
        vkljuceniKoraki.length +
        "</p>" +
        '<div class="opomin-nacrt__pike" role="list" aria-label="Napredek potrjevanja">' +
        pikeHtml +
        "</div>" +
        "</div>" +
        '<button type="button" class="opomin-nacrt__uredi-korake' +
        (urejanjeKartic ? " opomin-nacrt__uredi-korake--aktivno" : "") +
        '" id="opomin-uredi-korake" aria-pressed="' +
        (urejanjeKartic ? "true" : "false") +
        '">Uredi' +
        "</button>" +
        "</div>" +
        '<div class="opomin-nacrt__carousel-ovoj">' +
        '<div class="opomin-nacrt__carousel" role="list" aria-label="Koraki načrta">' +
        carouselHtml +
        "</div>" +
        '<span class="opomin-nacrt__carousel-puscica" aria-hidden="true">›</span>' +
        "</div>" +
        (urejanjeKartic && plan.steps.length < 6
          ? '<button type="button" class="opomin-nacrt__dodaj-korak" data-dodaj-korak>+ Dodaj korak</button>'
          : "") +
        '<div class="opomin-nacrt__izbran-glava">' +
        '<h2 class="opomin-nacrt__izbran-naslov">' +
        esc(prikazniRedStep + ". korak – " + step.title) +
        "</h2>" +
        '<span class="opomin-nacrt__status-badge opomin-nacrt__status-badge--' +
        esc(step.status) +
        '">' +
        esc(statusZnacka(step.status, step.kind)) +
        "</span>" +
        "</div>" +
        podrobnostCas +
        casKarticaHtml +
        karticeHtml +
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

      var noviCarousel = opts.glavniEl.querySelector(".opomin-nacrt__carousel");
      if (noviCarousel && carouselScrollLeft > 0) {
        noviCarousel.scrollLeft = carouselScrollLeft;
      }

      poveziGlavni(step, ready);
    }

    function poveziGlavni(step, ready) {
      var smsUrejanje = opts.glavniEl.querySelector("#opomin-sms-urejanje");
      if (smsUrejanje) {
        smsUrejanje.addEventListener("input", function () {
          plan = N.posodobiSporociloKoraka(
            plan,
            step.index,
            smsUrejanje.value
          );

          var celotnoSporocilo =
            PV && PV.sestaviSmsZPrilogami
              ? PV.sestaviSmsZPrilogami(
                  smsUrejanje.value,
                  prilogeKoraka,
                  smsPaketZeton
                )
              : smsUrejanje.value;
          var meta = opts.glavniEl.querySelector(".sms-preview__meta");
          if (meta) meta.textContent = gsmLabel(Gsm, celotnoSporocilo);

          var badge = opts.glavniEl.querySelector(".opomin-nacrt__status-badge");
          if (badge) {
            badge.className =
              "opomin-nacrt__status-badge opomin-nacrt__status-badge--" +
              step.status;
            badge.textContent = statusZnacka(step.status, step.kind);
          }
          var ctaVZivo = opts.glavniEl.querySelector("#opomin-nacrt-cta");
          if (ctaVZivo) {
            ctaVZivo.textContent =
              "Preveri in potrdi " + prikazniRedStep + ". korak →";
          }

          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(function () {
            N.shraniOsnutek(plan);
          }, 350);
        });
        smsUrejanje.addEventListener("blur", function () {
          clearTimeout(debounceTimer);
          debounceTimer = null;
          N.shraniOsnutek(plan);
        });
        izrisiKompaktnePredloge(
          step,
          smsUrejanje,
          null,
          "opomin-glavni-predloge",
          "opomin-glavni-predloge-drsnik"
        );
      }

      opts.glavniEl
        .querySelectorAll("[data-kanal-globalno]")
        .forEach(function (gumb) {
          gumb.addEventListener("click", function () {
            var kanal = gumb.getAttribute("data-kanal-globalno");
            if (gumb.getAttribute("aria-disabled") === "true") {
              if (typeof opts.potrdiVprasanje === "function") {
                opts.potrdiVprasanje({
                  naslov:
                    kanal === "sms"
                      ? "Dolžnik nima telefonske številke."
                      : "Dolžnik nima e-poštnega naslova.",
                  potrdiBesedilo: "V redu",
                  samoEnGumb: true,
                  stil: "primary",
                });
              }
              return;
            }
            var k2 = opts.podatkiKorak2 || {};
            var imaTelefon = Boolean(
              opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika
            );
            var imaEmailGlobalno = Boolean(
              opts.podatkiKorak1 && opts.podatkiKorak1.emailDolznika
            );
            var trenutni =
              k2.sporociloKanali || { sms: imaTelefon, email: imaEmailGlobalno };
            var novi = { sms: Boolean(trenutni.sms), email: Boolean(trenutni.email) };
            novi[kanal] = !novi[kanal];
            k2.sporociloKanali = novi;
            opts.podatkiKorak2 = k2;
            syncKorak2Sejo();
            izrisiGlavni();
          });
        });

      opts.glavniEl.querySelectorAll("[data-stage]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          aktivenIndex = Number(btn.getAttribute("data-stage"));
          var izbranKorak = N.najdiKorak(plan, aktivenIndex);
          if (izbranKorak) izbranKorak.isExcluded = false;
          plan.selectedStageId = (izbranKorak || {}).id;
          shrani();
          izrisiGlavni();
        });
      });

      var spremeni = opts.glavniEl.querySelector("#opomin-spremeni-cas");
      if (spremeni) {
        spremeni.addEventListener("click", function () {
          odpriCasSheet(step.index, "trenutni");
        });
      }

      var zdajCas = opts.glavniEl.querySelector("#opomin-zdaj-cas");
      if (zdajCas) {
        zdajCas.addEventListener("click", function () {
          var iso = new Date().toISOString();
          var v = N.validirajCasKoraka
            ? N.validirajCasKoraka(plan, step.index, iso, true)
            : { ok: true };
          if (!v.ok) {
            if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                v.napaka || "Časa ni bilo mogoče nastaviti."
              );
            }
            return;
          }
          plan = N.posodobiCasKoraka(plan, step.index, iso, {
            shiftFollowing: true,
          });
          izbranCasNacin = "zdaj";
          shrani();
          izrisiGlavni();
        });
      }

      var predizborGumb = opts.glavniEl.querySelector("#opomin-predizbor-cas");
      var predizborMeni = opts.glavniEl.querySelector("#opomin-predizbor-meni");

      function uporabiPredizborBliznjico(b) {
        var iso = isoIzPredizboraBliznjice(b);
        var v = N.validirajCasKoraka
          ? N.validirajCasKoraka(plan, step.index, iso, true)
          : { ok: true };
        if (!v.ok) {
          if (typeof opts.pokaziNapako === "function") {
            opts.pokaziNapako(v.napaka || "Časa ni bilo mogoče nastaviti.");
          }
          return;
        }
        plan = N.posodobiCasKoraka(plan, step.index, iso, {
          shiftFollowing: true,
        });
        izbranCasNacin = "predizbor";
        shrani();
        izrisiGlavni();
      }

      function zapriPredizborMeni() {
        if (predizborMeni) predizborMeni.hidden = true;
        if (predizborGumb) predizborGumb.setAttribute("aria-expanded", "false");
      }

      if (predizborGumb && predizborMeni) {
        predizborGumb.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var odprto = !predizborMeni.hidden;
          if (odprto) {
            zapriPredizborMeni();
            return;
          }
          var seznam = preberiCasBliznjice();
          predizborMeni.innerHTML = "";
          var zapriGumb = document.createElement("button");
          zapriGumb.type = "button";
          zapriGumb.className = "opomin-nacrt__predizbor-zapri";
          zapriGumb.setAttribute("aria-label", "Zapri");
          zapriGumb.innerHTML = '<span aria-hidden="true">×</span>';
          zapriGumb.addEventListener("click", function (ev) {
            ev.stopPropagation();
            zapriPredizborMeni();
          });
          predizborMeni.appendChild(zapriGumb);
          var naslovMeni = document.createElement("p");
          naslovMeni.className = "opomin-nacrt__predizbor-naslov";
          naslovMeni.textContent = "Bližnjice";
          predizborMeni.appendChild(naslovMeni);
          if (!seznam.length) {
            var prazno = document.createElement("p");
            prazno.className = "opomin-nacrt__predizbor-prazno";
            prazno.textContent =
              "Ni shranjenih bližnjic. Dodaš jih v »Spremeni«.";
            predizborMeni.appendChild(prazno);
          } else {
            seznam.forEach(function (b) {
              var postavka = document.createElement("button");
              postavka.type = "button";
              postavka.className = "opomin-nacrt__predizbor-postavka";
              postavka.textContent =
                (b.ura || "") +
                " · " +
                (Number(b.dnevi) === 0
                  ? "danes"
                  : "čez " +
                    b.dnevi +
                    (Number(b.dnevi) === 1 ? " dan" : " dni"));
              postavka.addEventListener("click", function () {
                zapriPredizborMeni();
                uporabiPredizborBliznjico(b);
              });
              predizborMeni.appendChild(postavka);
            });
          }
          predizborMeni.hidden = false;
          predizborGumb.setAttribute("aria-expanded", "true");
        });

        document.addEventListener("click", function (ev) {
          if (
            !predizborMeni.hidden &&
            !predizborMeni.contains(ev.target) &&
            ev.target !== predizborGumb
          ) {
            zapriPredizborMeni();
          }
        });
      }

      var spremeniRazmik = opts.glavniEl.querySelector("#opomin-spremeni-razmik");
      if (spremeniRazmik) {
        spremeniRazmik.addEventListener("click", function () {
          odpriCasSheet(step.index, "naslednji");
        });
      }

      var spremeniPrejsnjiRazmik = opts.glavniEl.querySelector(
        "#opomin-spremeni-prejsnji-razmik"
      );
      if (spremeniPrejsnjiRazmik && prejsnji) {
        spremeniPrejsnjiRazmik.addEventListener("click", function () {
          odpriCasSheet(prejsnji.index, "naslednji");
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
            if (trrSheetApi && typeof trrSheetApi.odpri === "function") {
              trrSheetApi.odpri({
                onClose: function () {
                  shraniVse();
                  izrisiGlavni();
                },
              });
            } else if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                "Nastavitve TRR se niso naložile. Osvežite stran (Ctrl+F5)."
              );
            }
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
          sinhronizirajPrilogeVKorak1();
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

      /* --- Vezava gumbov na karticah --- */
      opts.glavniEl.querySelectorAll("[data-uredi-kartico]").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var idx = Number(btn.getAttribute("data-uredi-kartico"));
          if (urejanjeKarticeIndex === idx) {
            urejanjeKarticeIndex = null;
          } else {
            urejanjeKarticeIndex = idx;
          }
          izrisiGlavni();
        });
      });

      var urediKorake = opts.glavniEl.querySelector("#opomin-uredi-korake");
      if (urediKorake) {
        urediKorake.addEventListener("click", function () {
          urejanjeKartic = !urejanjeKartic;
          urejanjeKarticeIndex = null;
          if (!urejanjeKartic) {
            var trenutni = N.najdiKorak(plan, aktivenIndex);
            if (!trenutni || trenutni.isExcluded) {
              var prviVkljucen = plan.steps.find(function (s) { return !s.isExcluded; });
              if (prviVkljucen) {
                aktivenIndex = prviVkljucen.index;
                plan.selectedStageId = prviVkljucen.id;
              }
            }
          }
          N.shraniOsnutek(plan);
          izrisiGlavni();
        });
      }

      opts.glavniEl.querySelectorAll("[data-dodaj-korak]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (typeof N.dodajKorak !== "function") return;
          plan = N.dodajKorak(plan);
          N.shraniOsnutek(plan);
          izrisiGlavni();
        });
      });

      opts.glavniEl.querySelectorAll("[data-odstrani-kartico]").forEach(function (btn) {
        btn.addEventListener("click", async function (ev) {
          ev.stopPropagation();
          var idx = Number(btn.getAttribute("data-odstrani-kartico"));
          var stepZaOdstranitev = N.najdiKorak(plan, idx);
          if (!stepZaOdstranitev) return;
          stepZaOdstranitev.isExcluded = !stepZaOdstranitev.isExcluded;
          N.shraniOsnutek(plan);
          izrisiGlavni();
        });
      });

      /* Klik izven kartic zapre urejevalni način */
      opts.glavniEl.addEventListener("click", function (ev) {
        if (urejanjeKarticeIndex == null) return;
        var target = ev.target;
        var jeZKartice = false;
        while (target && target !== opts.glavniEl) {
          if (target.classList && target.classList.contains("opomin-nacrt__stage-ovoj")) {
            jeZKartice = true;
            break;
          }
          target = target.parentElement;
        }
        if (!jeZKartice) {
          urejanjeKarticeIndex = null;
          izrisiGlavni();
        }
      });

      poveziKontaktneDogodke();
      poveziPrilogeDogodke();

      var cta = opts.glavniEl.querySelector("#opomin-nacrt-cta");
      if (cta) {
        cta.addEventListener("click", function () {
          var k1 = opts.podatkiKorak1 || {};
          var valid =
            PV && PV.vsePrilogeVeljavneZaPotrditev
              ? PV.vsePrilogeVeljavneZaPotrditev(
                  prilogeKoraka,
                  Boolean(k1.telefonDolznika),
                  Boolean(k1.emailDolznika)
                )
              : { ok: true };
          if (!valid.ok) {
            prilogeNapaka = valid.razlog || "Preverite priloge računov.";
            if (typeof opts.potrdiVprasanje === "function") {
              opts.potrdiVprasanje({
                naslov: "Priloge niso pripravljene",
                opis: prilogeNapaka,
                potrdiBesedilo: "V redu",
                samoEnGumb: true,
                stil: "primary",
              });
            }
            return;
          }
          if (N.soVsiSmsPotrjeni(plan)) {
            aktiviraj();
            return;
          }
          /* Vedno odpri pregled TRENUTNO izbranega koraka - tudi če je že
             potrjen, da ga lahko uporabnik znova odpre in po potrebi
             popravi (besedilo/dodatke). Preskok na naslednji nepotrjen
             korak bi uporabniku onemogočil urejanje že potrjenega koraka. */
          pokaziPotrditev(step.index);
        });
      }
    }

    function pokaziPrilogeNapako(tekst) {
      prilogeNapaka = tekst || "";
      var el = opts.glavniEl.querySelector("#vk-priloge-napaka");
      if (!el) return;
      if (!prilogeNapaka) {
        el.hidden = true;
        el.textContent = "";
        return;
      }
      el.hidden = false;
      el.textContent = prilogeNapaka;
    }

    function pokaziUndoToast(priloga) {
      var obstojeci = document.getElementById("vk-undo-toast");
      if (obstojeci) obstojeci.remove();
      var toast = document.createElement("div");
      toast.id = "vk-undo-toast";
      toast.className = "vk-undo-toast";
      toast.setAttribute("role", "status");
      toast.innerHTML =
        "<span>Račun je odstranjen.</span>" +
        '<button type="button" id="vk-undo-btn">Razveljavi</button>';
      document.body.appendChild(toast);
      clearTimeout(undoTimer);
      undoPriloga = priloga;
      document.getElementById("vk-undo-btn").addEventListener("click", function () {
        if (undoPriloga) {
          prilogeKoraka.push(undoPriloga);
          undoPriloga = null;
          sinhronizirajPrilogeVKorak1();
          izrisiGlavni();
        }
        toast.remove();
        clearTimeout(undoTimer);
      });
      undoTimer = setTimeout(function () {
        undoPriloga = null;
        toast.remove();
      }, 5000);
    }

    async function dodajDatotekePrilog(fileList) {
      var files = Array.prototype.slice.call(fileList || []);
      if (!files.length || !PV) return;
      pokaziPrilogeNapako("");
      var k1 = opts.podatkiKorak1 || {};
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var v = PV.validirajDatoteko(file, prilogeKoraka);
        if (v.napaka) {
          pokaziPrilogeNapako(v.napaka);
          continue;
        }
        var imeLower = String(file.name || "").toLowerCase();
        var tipLower = String(file.type || "").toLowerCase();
        if (
          tipLower.indexOf("heic") >= 0 ||
          tipLower.indexOf("heif") >= 0 ||
          /\.heic$|\.heif$/i.test(imeLower)
        ) {
          pokaziPrilogeNapako(
            "HEIC/HEIF fotografije trenutno niso pretvorjene. Izvozite kot JPG ali PNG."
          );
          continue;
        }
        var id = PV.novId();
        var kanali = privzetiKanaliNovePriloge();
        var temp = {
          id: id,
          originalFileName: file.name || "Račun",
          mimeType: file.type || "",
          sizeBytes: file.size,
          storagePath: null,
          status: "uploading",
          deliveryChannels: kanali,
          origin: "manual_attachment",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          progress: 10,
          _file: file,
        };
        prilogeKoraka.push(temp);
        izrisiGlavni();
        try {
          if (typeof opts.naloziPrilogo === "function") {
            temp.status = "processing";
            temp.progress = 45;
            izrisiGlavni();
            var rez = await opts.naloziPrilogo(file);
            if (rez && rez.napaka) throw new Error(rez.napaka);
            temp.storagePath = rez.pot;
            temp.status = "ready";
            temp.progress = 100;
            temp.updatedAt = new Date().toISOString();
            delete temp._file;
          } else {
            temp.storagePath = "local/" + id + "/" + (file.name || "racun");
            temp.status = "ready";
            temp.progress = 100;
          }
        } catch (err) {
          temp.status = "error";
          temp.progress = 0;
          temp.napaka = (err && err.message) || "Nalaganje ni uspelo.";
          pokaziPrilogeNapako(temp.napaka);
        }
        sinhronizirajPrilogeVKorak1();
        izrisiGlavni();
      }
    }

    function osveziKanalGumbV2(gumb, vkljucen) {
      if (!gumb) return;
      gumb.setAttribute("aria-pressed", vkljucen ? "true" : "false");
      var ikona = gumb.querySelector(".vk-kanal-gumb-v2__ikona");
      if (!ikona) return;
      var vrsta = gumb.getAttribute("data-kanal");
      var jeSms = vrsta === "sms";
      ikona.innerHTML = vkljucen
        ? IKONA_KLJUKICA
        : jeSms
          ? IKONA_SMS
          : IKONA_EMAIL;
    }

    function posodobiStatusnoBesediloPriloge(vrstica, p, imaTel, imaEmail) {
      if (!vrstica || !p || p.status !== "ready") return;
      var statusEl = vrstica.querySelector(".vk-racun-kartica__status");
      if (!statusEl) return;
      var velikostTekst = "";
      if (PV && PV.formatVelikost && p.sizeBytes != null) {
        velikostTekst = PV.formatVelikost(p.sizeBytes);
      }
      statusEl.textContent =
        statusnoBesediloPriloge(p, imaTel, imaEmail) +
        (velikostTekst ? " · " + velikostTekst : "");
    }

    function osveziSmsPredogled() {
      var step = N.najdiKorak(plan, aktivenIndex);
      if (!step || !opts.glavniEl) return;
      var smsOsnova = step.finalMessage || step.generatedMessage || "";
      var novoBesedilo =
        PV && PV.sestaviSmsZPrilogami
          ? PV.sestaviSmsZPrilogami(smsOsnova, prilogeKoraka, smsPaketZeton)
          : smsOsnova;
      var novaVsebina = String(novoBesedilo).trim()
        ? esc(novoBesedilo)
        : '<span class="sms-preview__prazno">Sporočilo še ni sestavljeno.</span>';
      var viewport = opts.glavniEl.querySelector(".sms-preview__viewport");
      if (viewport && viewport.tagName === "TEXTAREA") {
        if (document.activeElement !== viewport && viewport.value !== smsOsnova) {
          viewport.value = smsOsnova;
        }
      } else if (viewport && viewport.innerHTML !== novaVsebina) {
        viewport.innerHTML = novaVsebina;
      }
      var novaMeta = gsmLabel(Gsm, novoBesedilo);
      var meta = opts.glavniEl.querySelector(".sms-preview__meta");
      if (meta && meta.textContent !== novaMeta) {
        meta.textContent = novaMeta;
      }
    }

    var lightboxEl = document.getElementById("lightbox");
    var lightboxSlikaEl = document.getElementById("lightbox-slika");
    var lightboxZapriEl = document.getElementById("lightbox-zapri");
    var lightboxOzicen = false;

    function zapriPrilogeLightbox() {
      if (!lightboxEl) return;
      lightboxEl.hidden = true;
      if (lightboxSlikaEl) lightboxSlikaEl.src = "";
    }

    function odpriPrilogeLightbox(url) {
      if (!lightboxEl || !lightboxSlikaEl) return;
      lightboxSlikaEl.src = url;
      lightboxEl.hidden = false;
      if (!lightboxOzicen) {
        lightboxOzicen = true;
        if (lightboxZapriEl) {
          lightboxZapriEl.addEventListener("click", zapriPrilogeLightbox);
        }
        lightboxEl.addEventListener("click", function (ev) {
          if (ev.target === lightboxEl) zapriPrilogeLightbox();
        });
        document.addEventListener("keydown", function (ev) {
          if (ev.key === "Escape" && !lightboxEl.hidden) {
            zapriPrilogeLightbox();
          }
        });
      }
    }

    function poveziPrilogeDogodke() {
      var kamera = opts.glavniEl.querySelector("#vk-priloge-kamera");
      var datoteka = opts.glavniEl.querySelector("#vk-priloge-datoteka");
      var gumbSlikaj = opts.glavniEl.querySelector("#vk-priloge-slikaj");
      var gumbUvozi = opts.glavniEl.querySelector("#vk-priloge-uvozi");
      if (typeof opts.pridobiUrlPriloge === "function") {
        opts.glavniEl
          .querySelectorAll("[data-priloga-predogled]")
          .forEach(function (predogled) {
            var id = predogled.getAttribute("data-priloga-predogled");
            var priloga = prilogeKoraka.find(function (p) {
              return p.id === id;
            });
            if (!priloga || !priloga.storagePath) return;
            var jeSlika = jeSlikaPriloga(priloga);
            if (jeSlika) {
              opts.pridobiUrlPriloge(priloga.storagePath).then(function (rez) {
                if (!predogled.isConnected || !rez || !rez.url) return;
                var img = document.createElement("img");
                img.src = rez.url;
                img.alt = "";
                predogled.classList.add(
                  "vk-racun-kartica__predogled--slika"
                );
                predogled.replaceChildren(img);
              });
            }
            predogled.classList.add("vk-racun-kartica__predogled--klik");
            predogled.setAttribute("role", "button");
            predogled.setAttribute("tabindex", "0");
            predogled.setAttribute(
              "aria-label",
              "Odpri predogled " + (priloga.originalFileName || "računa")
            );
            function odpriPredogled() {
              opts.pridobiUrlPriloge(priloga.storagePath).then(function (rez) {
                if (!rez || !rez.url) return;
                if (jeSlika) {
                  odpriPrilogeLightbox(rez.url);
                } else {
                  window.open(rez.url, "_blank");
                }
              });
            }
            predogled.addEventListener("click", odpriPredogled);
            predogled.addEventListener("keydown", function (ev) {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                odpriPredogled();
              }
            });
          });
      }
      if (gumbSlikaj && kamera) {
        gumbSlikaj.addEventListener("click", function () {
          kamera.click();
        });
      }
      if (gumbUvozi && datoteka) {
        gumbUvozi.addEventListener("click", function () {
          datoteka.click();
        });
      }
      if (kamera) {
        kamera.addEventListener("change", function () {
          dodajDatotekePrilog(kamera.files);
          kamera.value = "";
        });
      }
      if (datoteka) {
        datoteka.addEventListener("change", function () {
          dodajDatotekePrilog(datoteka.files);
          datoteka.value = "";
        });
      }

      opts.glavniEl.querySelectorAll("[data-priloga-odstrani]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-priloga-odstrani");
          var idx = prilogeKoraka.findIndex(function (p) {
            return p.id === id;
          });
          if (idx < 0) return;
          var odstranjen = prilogeKoraka.splice(idx, 1)[0];
          sinhronizirajPrilogeVKorak1();
          izrisiGlavni();
          pokaziUndoToast(odstranjen);
        });
      });

      opts.glavniEl.querySelectorAll(".vk-racun-kartica").forEach(function (vrstica) {
        var id = vrstica.getAttribute("data-priloga-id");
        var p = prilogeKoraka.find(function (x) {
          return x.id === id;
        });
        if (!p) return;
        vrstica.querySelectorAll("[data-kanal]").forEach(function (gumb) {
          gumb.addEventListener("click", function () {
            if (gumb.disabled || gumb.getAttribute("aria-disabled") === "true") {
              var kanal = gumb.getAttribute("data-kanal");
              if (typeof opts.potrdiVprasanje === "function") {
                opts.potrdiVprasanje({
                  naslov:
                    kanal === "sms"
                      ? "Dolžnik nima telefonske številke."
                      : "Dolžnik nima e-poštnega naslova.",
                  potrdiBesedilo: "V redu",
                  samoEnGumb: true,
                  stil: "primary",
                });
              }
              return;
            }
            var kanal = gumb.getAttribute("data-kanal");
            var prej = {
              sms: Boolean(p.deliveryChannels && p.deliveryChannels.sms),
              email: Boolean(p.deliveryChannels && p.deliveryChannels.email),
            };
            var novo = {
              sms: prej.sms,
              email: prej.email,
            };
            novo[kanal] = !novo[kanal];
            p.deliveryChannels = novo;
            p.updatedAt = new Date().toISOString();
            sinhronizirajPrilogeVKorak1();
            /* Brez ponovnega izrisa celotnega koraka – posodobimo samo
               kliknjen gumb, statusno besedilo »Priloženo …« in SMS predogled,
               da stran ostane na istem mestu in fokus ni premaknjen. */
            osveziKanalGumbV2(gumb, novo[kanal]);
            posodobiStatusnoBesediloPriloge(
              vrstica,
              p,
              Boolean(opts.podatkiKorak1 && opts.podatkiKorak1.telefonDolznika),
              Boolean(opts.podatkiKorak1 && opts.podatkiKorak1.emailDolznika)
            );
            osveziSmsPredogled();
          });
        });
      });

      if (prilogeNapaka) pokaziPrilogeNapako(prilogeNapaka);
    }

    function poveziKontaktneDogodke() {
      var step = N.najdiKorak(plan, aktivenIndex);
      if (!step) return;
      if (!step.customContacts) step.customContacts = { phoneNumbers: [], emailAddresses: [] };
      var cc = step.customContacts;

      // Odpri ali zapri majhno polje za dodajanje kontakta.
      opts.glavniEl.querySelectorAll("[data-kontakt-odpri-vnos]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var vrsta = btn.getAttribute("data-kontakt-odpri-vnos");
          kontaktDodajOdprt[vrsta] = true;
          izrisiGlavni();
          window.requestAnimationFrame(function () {
            var vnosEl = opts.glavniEl.querySelector('[data-kontakt-dodaj-vnos="' + vrsta + '"]');
            if (!vnosEl) return;
            try {
              vnosEl.focus({ preventScroll: true });
            } catch (_e) {
              vnosEl.focus();
            }
          });
        });
      });

      opts.glavniEl.querySelectorAll("[data-kontakt-dodaj-preklici]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var vrsta = btn.getAttribute("data-kontakt-dodaj-preklici");
          kontaktDodajOdprt[vrsta] = false;
          izrisiGlavni();
        });
      });

      // Toggle primarni kontakt
      opts.glavniEl.querySelectorAll("[data-kontakt-toggle-primarni]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var vrsta = btn.getAttribute("data-kontakt-toggle-primarni");
          if (!step.primaryContacts) step.primaryContacts = { sms: true, email: true };
          step.primaryContacts[vrsta] = !step.primaryContacts[vrsta];
          kontaktDodajOdprt[vrsta] = !step.primaryContacts[vrsta];
          shrani();
          izrisiGlavni();
        });
      });

      // Dodaj dodatni kontakt
      opts.glavniEl.querySelectorAll("[data-kontakt-dodaj-gumb]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var vrsta = btn.getAttribute("data-kontakt-dodaj-gumb");
          var vnosEl = opts.glavniEl.querySelector('[data-kontakt-dodaj-vnos="' + vrsta + '"]');
          if (!vnosEl) return;
          var vrednost = String(vnosEl.value || "").trim();
          if (!vrednost) return;
          var seznam = vrsta === "sms" ? cc.phoneNumbers : cc.emailAddresses;
          if (seznam.indexOf(vrednost) < 0) {
            seznam.push(vrednost);
            shrani();
          }
          kontaktDodajOdprt[vrsta] = false;
          izrisiGlavni();
        });
      });

      // Enter v input polju
      opts.glavniEl.querySelectorAll("[data-kontakt-dodaj-vnos]").forEach(function (vnosEl) {
        vnosEl.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            var vrsta = vnosEl.getAttribute("data-kontakt-dodaj-vnos");
            var gumb = opts.glavniEl.querySelector('[data-kontakt-dodaj-gumb="' + vrsta + '"]');
            if (gumb) gumb.click();
          }
        });
      });

      // Odstrani dodaten kontakt
      opts.glavniEl.querySelectorAll("[data-kontakt-odstrani]").forEach(function (xBtn) {
        xBtn.addEventListener("click", function () {
          var vrsta = xBtn.getAttribute("data-kontakt-odstrani");
          var value = xBtn.getAttribute("data-value");
          var seznam = vrsta === "sms" ? cc.phoneNumbers : cc.emailAddresses;
          var idx = seznam.indexOf(value);
          if (idx >= 0) {
            seznam.splice(idx, 1);
            shrani();
            izrisiGlavni();
          }
        });
      });
    }

    function besediloGumbaPotrdi(step) {
      var naslednjiKorak = N.najdiKorak(plan, step.index + 1);
      if (naslednjiKorak) {
        var red = 0;
        var koraki = plan.steps || [];
        for (var ri = 0; ri < koraki.length; ri++) {
          if (!koraki[ri].isExcluded) red++;
          if (koraki[ri].index === naslednjiKorak.index) break;
        }
        return "Shrani in naprej na korak " + red + " →";
      }
      return "Shrani in dokončaj načrt →";
    }

    var mojiPredlogiPromise = null;

    function nalozimMojePredlogeAsync() {
      if (mojiPredlogiPromise) return mojiPredlogiPromise;
      mojiPredlogiPromise = new Promise(function (resolve) {
        function beriIzLocalStorage(kljuc) {
          try {
            var surovo = localStorage.getItem(kljuc);
            if (!surovo) return [];
            var seznam = JSON.parse(surovo);
            if (!Array.isArray(seznam)) return [];
            return seznam
              .filter(function (p) {
                return p && typeof p.besedilo === "string" && p.besedilo.trim();
              })
              .map(function (p) {
                return {
                  id: String(p.id || "moj-" + Date.now()),
                  naslov: String(p.naslov || "Moj predlog"),
                  besedilo: String(p.besedilo).slice(0, 1000),
                  jeMoj: true,
                  toneId: p.toneId || null,
                  language: p.language || "de",
                  source: "user",
                  order: Number(p.order) || null,
                  isRecommended: false,
                };
              });
          } catch (napaka) {
            return [];
          }
        }
        function zdruziBrezPodvajanja(seznami) {
          var videni = {};
          var izhod = [];
          seznami.forEach(function (seznam) {
            seznam.forEach(function (p) {
              if (videni[p.id]) return;
              videni[p.id] = true;
              izhod.push(p);
            });
          });
          return izhod;
        }

        var osnovniKljuc = "neplacilo-moji-predlogi";
        if (
          typeof supabaseKlient !== "undefined" &&
          supabaseKlient &&
          supabaseKlient.auth
        ) {
          supabaseKlient.auth
            .getSession()
            .then(function (res) {
              var uid =
                res &&
                res.data &&
                res.data.session &&
                res.data.session.user &&
                res.data.session.user.id;
              var brezUid = beriIzLocalStorage(osnovniKljuc);
              var zUid = uid
                ? beriIzLocalStorage(osnovniKljuc + "-" + uid)
                : [];
              resolve(zdruziBrezPodvajanja([zUid, brezUid]));
            })
            .catch(function () {
              resolve(beriIzLocalStorage(osnovniKljuc));
            });
        } else {
          resolve(beriIzLocalStorage(osnovniKljuc));
        }
      });
      return mojiPredlogiPromise;
    }

    function odpriPredogledPredloge(predlog, onUporabi) {
      var modal = document.getElementById("predloge3-predogled");
      if (!modal) { if (onUporabi) onUporabi(); return; }
      var naslovEl = document.getElementById("predloge3-predogled-naslov");
      var besediloEl = document.getElementById("predloge3-predogled-besedilo");
      var uporabiBtn = document.getElementById("predloge3-predogled-uporabi");
      var zapriBtn = document.getElementById("predloge3-predogled-zapri");
      var ponastaviBtn = document.getElementById("predloge3-predogled-ponastavi");
      var backdrop = document.getElementById("predloge3-predogled-backdrop");
      var original = predlog.besedilo || "";

      if (naslovEl) naslovEl.textContent = predlog.naslov || "—";
      if (besediloEl) besediloEl.value = original;

      function zapri() {
        modal.hidden = true;
        document.body.style.overflow = "";
        if (uporabiBtn) uporabiBtn.removeEventListener("click", onApply);
        if (zapriBtn) zapriBtn.removeEventListener("click", zapri);
        if (backdrop) backdrop.removeEventListener("click", zapri);
        if (ponastaviBtn) ponastaviBtn.removeEventListener("click", ponastavi);
      }

      function ponastavi() {
        if (besediloEl) besediloEl.value = original;
      }

      function onApply() {
        var novoBesedilo = besediloEl ? besediloEl.value : "";
        var jeSpremenjeno = String(novoBesedilo || "").trim() !== String(original || "").trim();
        if (jeSpremenjeno && root.potrdiVprasanje && typeof root.potrdiVprasanje === "function") {
          root.potrdiVprasanje({
            naslov: "Shrani spremembe?",
            opis: "Besedilo predloge ste spremenili.",
            potrdiBesedilo: "Shrani in uporabi",
            prekliciBesedilo: "Prekliči",
            stil: "primary",
          }).then(function (potrjeno) {
            if (!potrjeno) return;
            zapri();
            if (onUporabi) onUporabi(novoBesedilo);
          });
        } else {
          zapri();
          if (onUporabi) onUporabi(novoBesedilo);
        }
      }

      if (uporabiBtn) {
        uporabiBtn.textContent = "Uporabi";
        uporabiBtn.addEventListener("click", onApply);
      }
      if (zapriBtn) zapriBtn.addEventListener("click", zapri);
      if (backdrop) backdrop.addEventListener("click", zapri);
      if (ponastaviBtn) ponastaviBtn.addEventListener("click", ponastavi);

      function onEscape(ev) {
        if (ev.key === "Escape") { zapri(); document.removeEventListener("keydown", onEscape); }
      }
      document.addEventListener("keydown", onEscape);

      var origZapri = zapri;
      zapri = function () { document.removeEventListener("keydown", onEscape); origZapri(); };

      modal.hidden = false;
      document.body.style.overflow = "hidden";
    }

    function izrisiSeznamPredlog(predlogi, ovoj, drsnik, ta) {
      if (!predlogi || !predlogi.length) {
        ovoj.hidden = true;
        return;
      }

      drsnik.innerHTML = "";
      predlogi.forEach(function (predlog) {
        var kartica = document.createElement("button");
        kartica.type = "button";
        kartica.className = "opomin-potrdi-predloge__kartica";
        kartica.setAttribute("role", "listitem");
        if (
          String(ta.value || "").trim() ===
          String(predlog.besedilo || "").trim()
        ) {
          kartica.classList.add("opomin-potrdi-predloge__kartica--izbrana");
        }
        kartica.innerHTML =
          '<span class="opomin-potrdi-predloge__kartica-ikona" aria-hidden="true">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>' +
          "</span>" +
          '<span class="opomin-potrdi-predloge__kartica-vsebina">' +
          '<span class="opomin-potrdi-predloge__kartica-naslov"></span>' +
          '<span class="opomin-potrdi-predloge__kartica-opis"></span>' +
          "</span>";
        kartica.querySelector(
          ".opomin-potrdi-predloge__kartica-naslov"
        ).textContent = predlog.naslov;
        kartica.querySelector(
          ".opomin-potrdi-predloge__kartica-opis"
        ).textContent = predlog.besedilo;
        kartica.addEventListener("click", function () {
          odpriPredogledPredloge(predlog, function (novoBesedilo) {
            ta.value = String(novoBesedilo || predlog.besedilo || "").slice(0, 1000);
            ta.dispatchEvent(new Event("input", { bubbles: true }));
            drsnik
              .querySelectorAll(".opomin-potrdi-predloge__kartica--izbrana")
              .forEach(function (k) {
                k.classList.remove("opomin-potrdi-predloge__kartica--izbrana");
              });
            kartica.classList.add("opomin-potrdi-predloge__kartica--izbrana");
          });
        });
        drsnik.appendChild(kartica);
      });

      ovoj.hidden = false;

      // Indikator pikic — posodobi ob scrollu
      var indikator = document.getElementById((ovoj.id || "opomin-glavni-predloge") + "-indikator");
      if (indikator) {
        var pike = indikator.querySelectorAll(".opomin-potrdi-predloge__pika");
        function posodobiIndikator() {
          if (!pike.length) return;
          var w = drsnik.offsetWidth;
          if (w <= 0) return;
          var idx = Math.round(drsnik.scrollLeft / w);
          idx = Math.max(0, Math.min(pike.length - 1, idx));
          pike.forEach(function (p, i) {
            p.classList.toggle("opomin-potrdi-predloge__pika--aktivna", i === idx);
          });
        }
        drsnik.addEventListener("scroll", posodobiIndikator, { passive: true });
        posodobiIndikator();
      }

      ta.addEventListener("input", function () {
        drsnik.querySelectorAll(".opomin-potrdi-predloge__kartica").forEach(
          function (kartica, i) {
            var ujema =
              String(ta.value || "").trim() ===
              String((predlogi[i] || {}).besedilo || "").trim();
            kartica.classList.toggle(
              "opomin-potrdi-predloge__kartica--izbrana",
              ujema
            );
          }
        );
      });
    }

    function izrisiKompaktnePredloge(step, ta, gsmEl, ovojId, drsnikId) {
      var ovoj = document.getElementById(ovojId || "opomin-potrdi-predloge");
      var drsnik = document.getElementById(
        drsnikId || "opomin-potrdi-predloge-drsnik"
      );
      if (!ovoj || !drsnik || !window.UJTonPredloge) return;

      var jezik = "de";
      var osnovni = window.UJTonPredloge.sestaviSistemskePredloge(
        opts.podatkiKorak1,
        jezik
      );
      var tonId = step.toneId || plan.toneId;
      var predlogi = window.UJTonPredloge.filtrirajPredloge(
        osnovni,
        tonId,
        jezik
      );

      izrisiSeznamPredlog(predlogi, ovoj, drsnik, ta);

      var gumbVec = document.getElementById(
        (ovojId || "opomin-potrdi-predloge") + "-vec"
      );
      if (gumbVec && !gumbVec._ujVezano) {
        gumbVec._ujVezano = true;
        gumbVec.addEventListener("click", function () {
          if (!window.inicializirajPredlogiUrejevalnik) return;
          var api = window.inicializirajPredlogiUrejevalnik({
            podatkiKorak1: opts.podatkiKorak1,
            toneId: tonId,
            jezik: jezik,
            potrdiVprasanje: opts.potrdiVprasanje,
            onUporabi: function (predlog) {
              ta.value = String(predlog.besedilo || "").slice(0, 1000);
              ta.dispatchEvent(new Event("input", { bubbles: true }));
            },
            rokSheetApi: rokSheetApi,
            obrocnoSheetApi: obrocnoSheetApi,
            trrSheetApi: trrSheetApi,
            pokaziNapako: opts.pokaziNapako,
            getPaymentDeadline: function () { return paymentDeadline; },
            getInstallmentPlan: function () { return installmentPlan; },
            getTrrAccount: function () { return trrAccount; },
          });
          api.odpri();
        });
      }

      nalozimMojePredlogeAsync().then(function (mojiPredlogi) {
        if (!mojiPredlogi || !mojiPredlogi.length) return;
        var ovojZdaj = document.getElementById(
          ovojId || "opomin-potrdi-predloge"
        );
        var drsnikZdaj = document.getElementById(
          drsnikId || "opomin-potrdi-predloge-drsnik"
        );
        if (!ovojZdaj || !drsnikZdaj) return;
        var kombinirano = osnovni.concat(mojiPredlogi);
        var predlogiZdaj = window.UJTonPredloge.filtrirajPredloge(
          kombinirano,
          tonId,
          jezik
        );
        izrisiSeznamPredlog(predlogiZdaj, ovojZdaj, drsnikZdaj, ta);
      });
    }

    function izrisiPotrditev(step) {
      var jeManual =
        step.kind === "manual_lawyer" || step.deliveryMode === "manual";

      /* Prikazni red koraka: koliko neizključenih korakov je pred njim + 1 */
      var prikazniRedPotrditev = 0;
      var koraki = plan.steps || [];
      for (var ri = 0; ri < koraki.length; ri++) {
        if (!koraki[ri].isExcluded) prikazniRedPotrditev++;
        if (koraki[ri].index === step.index) break;
      }
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

      var k1 = opts.podatkiKorak1 || {};
      var prejemnikDeli = "";
      var prikazaniPrejemniki = {};
      function dodajPrejemnika(vrednost, ikona) {
        vrednost = String(vrednost || "").trim();
        if (!vrednost || prikazaniPrejemniki[vrednost]) return;
        prikazaniPrejemniki[vrednost] = true;
        prejemnikDeli +=
          '<span class="opomin-nacrt-potrdi__prejemnik-postavka">' +
          '<span class="opomin-nacrt-potrdi__prejemnik-ikona" aria-hidden="true">' +
          ikona +
          "</span>" +
          esc(vrednost) +
          "</span>";
      }
      var k2Potrditev = opts.podatkiKorak2 || {};
      var primarniKontakti = step.primaryContacts || k2Potrditev.sporociloKanali || { sms: true, email: true };
      if (primarniKontakti.sms !== false) dodajPrejemnika(k1.telefonDolznika, IKONA_SMS);
      var dodatniKontakti = step.customContacts || {};
      (Array.isArray(dodatniKontakti.phoneNumbers) ? dodatniKontakti.phoneNumbers : []).forEach(function (telefon) {
        dodajPrejemnika(telefon, IKONA_SMS);
      });
      if (primarniKontakti.email !== false) dodajPrejemnika(k1.emailDolznika, IKONA_EMAIL);
      (Array.isArray(dodatniKontakti.emailAddresses) ? dodatniKontakti.emailAddresses : []).forEach(function (email) {
        dodajPrejemnika(email, IKONA_EMAIL);
      });
      var prejemnikHtml = prejemnikDeli
        ? '<div class="opomin-nacrt-potrdi__prejemnik">' + prejemnikDeli + "</div>"
        : "";

      var prilogeHtml = "";
      if (prilogeKoraka.length) {
        prilogeHtml =
          '<section class="opomin-nacrt-potrdi__priloge" aria-label="Priložene priloge">' +
          '<p class="opomin-nacrt-potrdi__priloge-naslov">Priložene priloge</p>' +
          '<div class="opomin-nacrt-potrdi__priloge-seznam">' +
          prilogeKoraka
            .map(function (p) {
              var ime = p.originalFileName || "Račun";
              var jePdf =
                (p.mimeType && p.mimeType.indexOf("pdf") >= 0) ||
                /\.pdf$/i.test(ime);
              var jeSlika = jeSlikaPriloga(p) && !jePdf;
              return (
                '<div class="opomin-nacrt-potrdi__priloga" data-priloga-id="' +
                esc(p.id) +
                '">' +
                '<span class="opomin-nacrt-potrdi__priloga-predogled" data-priloga-predogled="' +
                esc(p.id) +
                '" aria-hidden="true">' +
                (jeSlika ? IKONA_SLIKA : IKONA_DOKUMENT) +
                "</span>" +
                '<span class="opomin-nacrt-potrdi__priloga-ime">' +
                esc(ime) +
                "</span>" +
                '<button type="button" class="opomin-nacrt-potrdi__priloga-odstrani" data-priloga-odstrani="' +
                esc(p.id) +
                '" aria-label="Odstrani ' +
                esc(ime) +
                '">×</button>' +
                "</div>"
              );
            })
            .join("") +
          "</div>" +
          "</section>";
      }

      opts.potrditevEl.innerHTML =
        '<div class="opomin-nacrt-potrdi__vsebina">' +
        '<h2 class="opomin-nacrt-potrdi__naslov">Preglej ' +
        esc(String(prikazniRedPotrditev)) +
        ". korak</h2>" +
        '<p class="opomin-nacrt-potrdi__podnaslov">' +
        esc(step.title) +
        "</p>" +
        prejemnikHtml +
        readonly +
        smsBlock +
        prilogeHtml +
        '<footer class="opomin-nacrt__noga opomin-nacrt__noga--stolpec">' +
        '<div class="opomin-nacrt__noga-vrsta">' +
        '<button type="button" class="opomin-nacrt__izbrisi-korak" id="opomin-potrdi-izbrisi">Izbriši korak ' +
        esc(String(prikazniRedPotrditev)) +
        "</button>" +
        '<button type="button" class="korak2__gumb-naprej" id="opomin-potrdi-shrani">' +
        esc(besediloGumbaPotrdi(step)) +
        "</button>" +
        "</div>" +
        '<button type="button" class="opomin-nacrt__shrani-osnutek" id="opomin-potrdi-nazaj-2">← Nazaj na urejanje koraka ' +
        esc(String(prikazniRedPotrditev)) +
        "</button>" +
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

      if (typeof opts.pridobiUrlPriloge === "function") {
        opts.potrditevEl
          .querySelectorAll("[data-priloga-predogled]")
          .forEach(function (predogled) {
            var id = predogled.getAttribute("data-priloga-predogled");
            var priloga = prilogeKoraka.find(function (p) {
              return p.id === id;
            });
            if (!priloga || !priloga.storagePath) return;
            var jeSlika = jeSlikaPriloga(priloga);
            if (jeSlika) {
              opts.pridobiUrlPriloge(priloga.storagePath).then(function (rez) {
                if (!predogled.isConnected || !rez || !rez.url) return;
                var img = document.createElement("img");
                img.src = rez.url;
                img.alt = "";
                predogled.classList.add(
                  "opomin-nacrt-potrdi__priloga-predogled--slika"
                );
                predogled.replaceChildren(img);
              });
            }
            predogled.classList.add(
              "opomin-nacrt-potrdi__priloga-predogled--klik"
            );
            predogled.setAttribute("role", "button");
            predogled.setAttribute("tabindex", "0");
            predogled.setAttribute(
              "aria-label",
              "Odpri predogled " + (priloga.originalFileName || "računa")
            );
            function odpriPredogled() {
              opts.pridobiUrlPriloge(priloga.storagePath).then(function (rez) {
                if (!rez || !rez.url) return;
                if (jeSlika) {
                  odpriPrilogeLightbox(rez.url);
                } else {
                  window.open(rez.url, "_blank");
                }
              });
            }
            predogled.addEventListener("click", odpriPredogled);
            predogled.addEventListener("keydown", function (ev) {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                odpriPredogled();
              }
            });
          });
      }

      opts.potrditevEl
        .querySelectorAll("[data-priloga-odstrani]")
        .forEach(function (btn) {
          btn.addEventListener("click", function () {
            var id = btn.getAttribute("data-priloga-odstrani");
            var idx = prilogeKoraka.findIndex(function (p) {
              return p.id === id;
            });
            if (idx < 0) return;
            prilogeKoraka.splice(idx, 1);
            sinhronizirajPrilogeVKorak1();
            izrisiPotrditev(step);
          });
        });

      function nazaj() {
        clearTimeout(debounceTimer);
        shrani();
        pokaziGlavni();
      }

      var n1 = opts.potrditevEl.querySelector("#opomin-potrdi-nazaj");
      var n2 = opts.potrditevEl.querySelector("#opomin-potrdi-nazaj-2");
      if (n1) n1.addEventListener("click", nazaj);
      if (n2) n2.addEventListener("click", nazaj);

      var gumbIzbrisiKorak = opts.potrditevEl.querySelector("#opomin-potrdi-izbrisi");
      if (gumbIzbrisiKorak) {
        gumbIzbrisiKorak.addEventListener("click", async function () {
          var smsCount = typeof N.steviloSmsKorakov === "function" ? N.steviloSmsKorakov(plan) : 0;
          if (step.kind === "sms" && smsCount <= 1) {
            if (typeof opts.potrdiVprasanje === "function") {
              await opts.potrdiVprasanje({
                naslov: "Odstranitev ni mogoča",
                opis: "Načrt mora vsebovati vsaj en samodejni korak. Tega koraka ne moreš odstraniti.",
                potrdiBesedilo: "V redu",
                samoEnGumb: true,
                stil: "primary",
              });
            }
            return;
          }
          var potrjeno = false;
          if (typeof opts.potrdiVprasanje === "function") {
            potrjeno = await opts.potrdiVprasanje({
              naslov: "Izbriši korak?",
              opis: "Korak »" + (step.title || "") + "« bo izbrisan. Preostali koraki se samodejno preštevilčijo.",
              potrdiBesedilo: "Izbriši",
              prekliciBesedilo: "Prekliči",
              stil: "nevarno",
            });
          }
          if (!potrjeno) return;
          clearTimeout(debounceTimer);
          if (typeof N.odstraniKorak === "function") {
            plan = N.odstraniKorak(plan, step.index);
          }
          aktivenIndex = plan.steps[0] ? plan.steps[0].index : 1;
          plan.selectedStageId = plan.steps[0] ? plan.steps[0].id : null;
          urejanjeKarticeIndex = null;
          urejanjeKartic = false;
          N.shraniOsnutek(plan);
          pokaziGlavni();
        });
      }

      function izvediPotrditev() {
        try {
          gumbPotrdi.disabled = true;
          clearTimeout(debounceTimer);
          debounceTimer = null;

          /* Najprej shrani dodatke trenutnega koraka. Če bi shrani() klicali
             po potrditvi, bi syncStageDodatki potrjeni korak vrnil v pregled. */
          shrani();
          plan = N.potrdiKorak(
            plan,
            step.index,
            jeManual ? "" : ta.value
          );
          var potrjeniKorak = N.najdiKorak(plan, step.index);
          if (!potrjeniKorak || potrjeniKorak.status !== "confirmed") {
            throw new Error("Koraka ni bilo mogoče potrditi.");
          }
          var naslednjiKorak = N.najdiKorak(plan, Number(step.index) + 1);
          if (naslednjiKorak) {
            aktivenIndex = Number(naslednjiKorak.index);
            plan.selectedStageId = naslednjiKorak.id;
            N.shraniOsnutek(plan);
            pokaziGlavni();
            window.scrollTo({ top: 0, behavior: "smooth" });
            requestAnimationFrame(function () {
              var naslednjaKartica = opts.glavniEl.querySelector(
                '[data-stage="' + aktivenIndex + '"]'
              );
              if (naslednjaKartica && naslednjaKartica.scrollIntoView) {
                naslednjaKartica.scrollIntoView({
                  behavior: "smooth",
                  inline: "center",
                  block: "nearest",
                });
              }
            });
            return;
          }
          aktivenIndex = step.index;
          plan.selectedStageId = step.id;
          N.shraniOsnutek(plan);
          pokaziGlavni();
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (napakaPotrditve) {
          osveziPotrdiGumb();
          if (typeof opts.pokaziNapako === "function") {
            opts.pokaziNapako(
              "Potrditev koraka ni uspela.",
              napakaPotrditve && napakaPotrditve.message
                ? napakaPotrditve.message
                : String(napakaPotrditve)
            );
          }
        }
      }

      /* Kratka veselo-praznična animacija gumba (skoči proti sredini,
         se skrči in izgine, za sabo pusti zvezdice) - šele nato se
         dejansko izvede potrditev in preklop na naslednji korak. */
      function animirajInPotrdi() {
        var zvezdiceOvoj = document.createElement("span");
        zvezdiceOvoj.className = "opomin-potrdi-zvezdice";
        zvezdiceOvoj.setAttribute("aria-hidden", "true");
        var stKotov = 6;
        for (var i = 0; i < stKotov; i++) {
          var z = document.createElement("span");
          z.className = "opomin-potrdi-zvezdica";
          z.textContent = "★";
          var kot = (360 / stKotov) * i;
          z.style.setProperty("--kot", kot + "deg");
          z.style.animationDelay = i * 25 + "ms";
          zvezdiceOvoj.appendChild(z);
        }
        gumbPotrdi.appendChild(zvezdiceOvoj);
        gumbPotrdi.classList.add("opomin-potrdi-shrani--skoci");
        gumbPotrdi.disabled = true;
        window.setTimeout(izvediPotrditev, 680);
      }

      if (gumbPotrdi) {
        gumbPotrdi.addEventListener("click", function () {
          if (!jeManual && (!ta || !ta.value.trim())) {
            if (typeof opts.pokaziNapako === "function") {
              opts.pokaziNapako(
                "SMS sporočilo je prazno – dopolni ga pred potrditvijo."
              );
            }
            return;
          }
          /* Potrditev ne sme biti odvisna od zaključka vizualne animacije. */
          izvediPotrditev();
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
