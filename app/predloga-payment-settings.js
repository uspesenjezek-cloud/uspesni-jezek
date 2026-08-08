/* ========== Plačilni paket na uporabniški predlogi ==========
   window.UJPredlogaPaymentSettings
   ============================================ */
(function (root) {
  "use strict";

  var INTERVALI = { weekly: 1, biweekly: 1, monthly: 1, custom: 1 };

  function jeObjekt(v) {
    return v != null && typeof v === "object" && !Array.isArray(v);
  }

  /**
   * null = predloga nima paketa (ob Uporabi ne spreminjaj dodatkov).
   * Objekt = recept za rok / obročno / TRR (brez absolutnih datumov).
   */
  function normalizirajPaymentSettings(raw) {
    if (raw == null || raw === false) return null;
    if (!jeObjekt(raw)) return null;

    var rokIn = jeObjekt(raw.rok) ? raw.rok : {};
    var obIn = jeObjekt(raw.obrocno) ? raw.obrocno : {};
    var trrIn = jeObjekt(raw.trr) ? raw.trr : {};

    var termDays = Math.round(Number(rokIn.termDays));
    if (!Number.isFinite(termDays) || termDays < 1) termDays = 14;
    if (termDays > 365) termDays = 365;

    var mode = rokIn.mode === "manual" ? "manual" : "automatic";
    // V paketu shranjujemo samo dneve (tudi pri "manual" v UI paketa = dnevi).
    if (mode === "manual") mode = "automatic";

    var count = Math.round(Number(obIn.installmentCount));
    if (!Number.isFinite(count) || count < 1) count = 2;
    if (count > 20) count = 20;

    var intervalType = String(obIn.intervalType || "monthly");
    if (!INTERVALI[intervalType]) intervalType = "monthly";

    var rokEnabled = Boolean(rokIn.enabled);
    var obEnabled = Boolean(obIn.enabled);
    // Enkratni rok in obročno se izključujeta.
    if (rokEnabled && obEnabled) {
      obEnabled = false;
    }

    var out = {
      version: 1,
      rok: {
        enabled: rokEnabled,
        mode: mode,
        termDays: termDays,
      },
      obrocno: {
        enabled: obEnabled,
        installmentCount: count,
        intervalType: intervalType,
      },
      trr: {
        enabled: Boolean(trrIn.enabled),
      },
    };

    // Prazen paket (vse izklopljeno) še vedno šteje kot "ima paket"
    // – ob Uporabi počisti dodatke in uveljavi "nič od tega".
    return out;
  }

  function imaPaymentSettings(predlog) {
    if (!predlog) return false;
    return normalizirajPaymentSettings(predlog.paymentSettings) != null;
  }

  /**
   * Recept za Uporabi predlogo.
   * null = paketa ni → dodatkov ne spreminjaj (brez reset).
   * objekt = najprej reset, nato uveljavi polja (rok XOR obročno).
   */
  function pripraviUveljavitev(paketRaw) {
    var paket = normalizirajPaymentSettings(paketRaw);
    if (paket == null) return null;
    return {
      resetDodatke: true,
      rok: paket.rok.enabled
        ? { termDays: paket.rok.termDays, mode: "automatic" }
        : null,
      obrocno: paket.obrocno.enabled
        ? {
            installmentCount: paket.obrocno.installmentCount,
            intervalType: paket.obrocno.intervalType,
          }
        : null,
      trr: Boolean(paket.trr.enabled),
    };
  }

  /** Privzet prazen paket za novo uporabniško predlogo (še ni nastavljeno). */
  function prazenPaket() {
    return null;
  }

  /** Začetni paket ob prvem urejanju v modalu (vse izklopljeno). */
  function zacetniPaketZaUrejanje(toneId) {
    var days = 14;
    var count = 4;
    if (root.UJRokPlacila) {
      if (typeof root.UJRokPlacila.dneviZaTon === "function") {
        var d = Number(root.UJRokPlacila.dneviZaTon(toneId));
        if (Number.isFinite(d) && d > 0) days = d;
      }
      if (typeof root.UJRokPlacila.predlogObrocnegaZaTon === "function") {
        var p = root.UJRokPlacila.predlogObrocnegaZaTon(toneId);
        if (p && Number(p.installments) >= 1) count = Number(p.installments);
      }
    }
    return normalizirajPaymentSettings({
      version: 1,
      rok: { enabled: false, mode: "automatic", termDays: days },
      obrocno: {
        enabled: false,
        installmentCount: count,
        intervalType: "monthly",
      },
      trr: { enabled: false },
    });
  }

  function paketIzTona(toneId) {
    var days = 14;
    var count = 4;
    var gap = 21;
    var intervalType = "custom";
    if (root.UJRokPlacila) {
      if (typeof root.UJRokPlacila.dneviZaTon === "function") {
        var d = Number(root.UJRokPlacila.dneviZaTon(toneId));
        if (Number.isFinite(d) && d > 0) days = d;
      }
      if (typeof root.UJRokPlacila.predlogObrocnegaZaTon === "function") {
        var p = root.UJRokPlacila.predlogObrocnegaZaTon(toneId);
        if (p) {
          if (Number(p.installments) >= 1) count = Number(p.installments);
          gap = Number(p.gapDays) || gap;
        }
      }
    }
    if (gap === 7) intervalType = "weekly";
    else if (gap === 14) intervalType = "biweekly";
    else if (gap >= 28 && gap <= 31) intervalType = "monthly";
    else intervalType = "custom";

    return normalizirajPaymentSettings({
      version: 1,
      rok: { enabled: true, mode: "automatic", termDays: days },
      obrocno: {
        enabled: false,
        installmentCount: count,
        intervalType: intervalType,
      },
      trr: { enabled: false },
    });
  }

  var api = {
    normalizirajPaymentSettings: normalizirajPaymentSettings,
    imaPaymentSettings: imaPaymentSettings,
    pripraviUveljavitev: pripraviUveljavitev,
    prazenPaket: prazenPaket,
    zacetniPaketZaUrejanje: zacetniPaketZaUrejanje,
    paketIzTona: paketIzTona,
  };

  root.UJPredlogaPaymentSettings = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
