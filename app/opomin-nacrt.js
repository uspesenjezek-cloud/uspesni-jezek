/* ========== Načrt opominjanja (korak 3) – podatkovna plast ==========
   Avtomatiziran večkoraken SMS načrt ob ustvarjanju NOVE zadeve.
   To NI isto kot ročni "Pošlji naslednji opomin" na neplacila.html
   (posljiOpomin / VRSTNI_RED_STATUSOV) – tisti samo napreduje status
   že obstoječe zadeve enkratno / ročno.

   window.UJOpominNacrt – brez DOM klicev.
   ============================================ */
(function (root) {
  "use strict";

  var KLJUC_SEJE = "neplacilo-korak3-nacrt";

  var ODMKI_BAZA = {
    strict: [0, 6, 13, 20],
    firm: [0, 8, 17, 26],
    friendly: [0, 11, 22, 30],
  };

  var TON_OZNAKE_SL = {
    strict: "strog ton",
    firm: "odločen ton",
    friendly: "prijazen ton",
    neutral: "odločen ton",
  };

  function zdajIso() {
    return new Date().toISOString();
  }

  function eurosToCents(euros) {
    var n = Number(euros);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function izracunajZamudoDni(datumZapadlosti) {
    if (!datumZapadlosti) return 0;
    var due = new Date(String(datumZapadlosti) + "T12:00:00");
    if (Number.isNaN(due.getTime())) return 0;
    var danes = new Date();
    danes.setHours(12, 0, 0, 0);
    return Math.floor((danes.getTime() - due.getTime()) / 86400000);
  }

  function preberiTonIzKorak2(podatkiKorak2) {
    var tr =
      podatkiKorak2 && podatkiKorak2.toneRecommendation
        ? podatkiKorak2.toneRecommendation
        : null;
    var raw =
      (tr && (tr.appliedToneId || tr.selectedToneId)) ||
      (podatkiKorak2 && podatkiKorak2.izbranTonId) ||
      "friendly";
    var UJ = root.UJTonDodatkiPriporocila;
    if (UJ && typeof UJ.normalizirajTon === "function") {
      return UJ.normalizirajTon(raw);
    }
    if (raw === "strict") return "strict";
    if (raw === "firm" || raw === "neutral") return "firm";
    return "friendly";
  }

  function oznakaTona(toneId) {
    return TON_OZNAKE_SL[toneId] || "izbrani ton";
  }

  /** Preprost sinhroni hash – samo za zaznavanje sprememb. */
  function izracunajHash(deli) {
    var s = Array.isArray(deli) ? deli.join("|") : String(deli || "");
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h.toString(16) + ":" + s.length;
  }

  function vhodniHash(amountCents, toneId, overdueDays) {
    return izracunajHash([
      String(amountCents),
      String(toneId),
      String(overdueDays),
    ]);
  }

  function korakSnapshotHash(step, amountCents, toneId, overdueDays) {
    return izracunajHash([
      String(amountCents),
      String(toneId),
      String(overdueDays),
      String(step.scheduledOffsetDays),
      String(step.index),
    ]);
  }

  /**
   * Predlagani odmiki (scheduledOffsetDays) – glej Traycer razdelek 3.
   * Uporabi UJTonDodatkiPriporocila.razvrstiZamudo / razvrstiZnesek.
   */
  function izracunajOdmike(toneId, overdueDays, amountCents) {
    var UJ = root.UJTonDodatkiPriporocila;
    var ton = toneId;
    if (UJ && typeof UJ.normalizirajTon === "function") {
      ton = UJ.normalizirajTon(toneId);
    }
    var baza = (ODMKI_BAZA[ton] || ODMKI_BAZA.friendly).slice();
    var zamuda = "kratka";
    var znesek = "nizek";
    if (UJ) {
      if (typeof UJ.razvrstiZamudo === "function") {
        zamuda = UJ.razvrstiZamudo(overdueDays);
      }
      if (typeof UJ.razvrstiZnesek === "function") {
        znesek = UJ.razvrstiZnesek(amountCents);
      }
    }

    /* Korak 1 vedno dan 0. */
    var out = [0, baza[1], baza[2], baza[3]];

    if (zamuda === "dolga") {
      for (var i = 1; i < out.length; i++) {
        out[i] = Math.max(i, Math.round(out[i] * 0.7));
      }
    }

    if (znesek === "visok") {
      var razmik23 = out[2] - out[1];
      out[2] = out[1] + Math.max(2, Math.round(razmik23 * 0.75));
    }

    /* Zagotovi strogo naraščajoče. */
    for (var j = 1; j < out.length; j++) {
      if (out[j] <= out[j - 1]) out[j] = out[j - 1] + 2;
    }
    return out;
  }

  function formatirajZnesekDe(cents) {
    var euros = (Number(cents) || 0) / 100;
    return (
      euros.toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " €"
    );
  }

  function sestaviGeneratedMessage(index, ctx) {
    var ime = String(ctx.imeDolznika || "Kunde").trim() || "Kunde";
    var znesek = formatirajZnesekDe(ctx.amountCents);
    var stevilka = ctx.stevilkaRacuna
      ? " Nr. " + String(ctx.stevilkaRacuna).trim()
      : "";

    if (index === 1) {
      var izKorak2 = String(ctx.sporociloDolzniku || "").trim();
      if (izKorak2) return izKorak2;
      return (
        "Guten Tag, wir erinnern freundlich an die offene Rechnung" +
        stevilka +
        " über " +
        znesek +
        ". Bitte begleichen Sie den Betrag zeitnah. Danke."
      );
    }
    if (index === 2) {
      return (
        "Guten Tag " +
        ime +
        ", trotz vorheriger Erinnerung ist die Rechnung" +
        stevilka +
        " über " +
        znesek +
        " noch offen. Bitte zahlen Sie umgehend."
      );
    }
    if (index === 3) {
      return (
        "Letzte Mahnung: Die Rechnung" +
        stevilka +
        " über " +
        znesek +
        " ist weiterhin unbezahlt. Ohne Zahlung behalten wir uns weitere Schritte vor."
      );
    }
    return "";
  }

  function narediKorak(index, offsetDays, ctx) {
    var kind = index === 4 ? "manual_lawyer" : "sms";
    if (kind === "manual_lawyer") {
      return {
        index: 4,
        kind: kind,
        scheduledOffsetDays: offsetDays,
        status: "confirmed",
        generatedMessage: "",
        finalMessage: "",
        messageEditedManually: false,
        messageNeedsReview: false,
        snapshotHash: null,
        confirmedAt: zdajIso(),
      };
    }
    var msg = sestaviGeneratedMessage(index, ctx);
    return {
      index: index,
      kind: kind,
      scheduledOffsetDays: offsetDays,
      status: "draft",
      generatedMessage: msg,
      finalMessage: msg,
      messageEditedManually: false,
      messageNeedsReview: false,
      snapshotHash: null,
      confirmedAt: null,
    };
  }

  function narediNovPlan(podatkiKorak1, podatkiKorak2) {
    var amountCents = eurosToCents(podatkiKorak1 && podatkiKorak1.znesek);
    var toneId = preberiTonIzKorak2(podatkiKorak2);
    var overdue = izracunajZamudoDni(
      podatkiKorak1 && podatkiKorak1.datumZapadlosti
    );
    var odmiki = izracunajOdmike(toneId, overdue, amountCents);
    var ctx = {
      imeDolznika: podatkiKorak1 && podatkiKorak1.imeDolznika,
      stevilkaRacuna: podatkiKorak1 && podatkiKorak1.stevilkaRacuna,
      sporociloDolzniku: podatkiKorak2 && podatkiKorak2.sporociloDolzniku,
      amountCents: amountCents,
    };
    var steps = [1, 2, 3, 4].map(function (idx) {
      return narediKorak(idx, odmiki[idx - 1], ctx);
    });
    var now = zdajIso();
    return {
      status: "draft",
      createdAt: now,
      updatedAt: now,
      toneId: toneId,
      amountCents: amountCents,
      overdueDaysAtCreation: overdue,
      inputsHash: vhodniHash(amountCents, toneId, overdue),
      steps: steps,
    };
  }

  function izracunajPlanStatus(plan) {
    if (!plan) return "draft";
    if (plan.status === "activated") return "activated";
    var sms = (plan.steps || []).filter(function (s) {
      return s.kind === "sms";
    });
    if (
      sms.length > 0 &&
      sms.every(function (s) {
        return s.status === "confirmed";
      })
    ) {
      return "ready_to_activate";
    }
    return "draft";
  }

  function osveziPlanStatus(plan) {
    plan.status = izracunajPlanStatus(plan);
    plan.updatedAt = zdajIso();
    return plan;
  }

  /** Če so se vhodi (ton/znesek/datum) spremenili – invalidiraj potrjene SMS korake. */
  function uskladiZVhodi(plan, podatkiKorak1, podatkiKorak2) {
    if (!plan || plan.status === "activated") return plan;

    var amountCents = eurosToCents(podatkiKorak1 && podatkiKorak1.znesek);
    var toneId = preberiTonIzKorak2(podatkiKorak2);
    var overdue = izracunajZamudoDni(
      podatkiKorak1 && podatkiKorak1.datumZapadlosti
    );
    var novHash = vhodniHash(amountCents, toneId, overdue);
    var ctx = {
      imeDolznika: podatkiKorak1 && podatkiKorak1.imeDolznika,
      stevilkaRacuna: podatkiKorak1 && podatkiKorak1.stevilkaRacuna,
      sporociloDolzniku: podatkiKorak2 && podatkiKorak2.sporociloDolzniku,
      amountCents: amountCents,
    };

    if (plan.inputsHash === novHash) {
      return plan;
    }

    var odmiki = izracunajOdmike(toneId, overdue, amountCents);
    plan.toneId = toneId;
    plan.amountCents = amountCents;
    plan.overdueDaysAtCreation = overdue;
    plan.inputsHash = novHash;

    (plan.steps || []).forEach(function (step, i) {
      step.scheduledOffsetDays = odmiki[i];
      if (step.kind === "manual_lawyer") {
        step.status = "confirmed";
        return;
      }
      var novoGenerated = sestaviGeneratedMessage(step.index, ctx);
      step.generatedMessage = novoGenerated;
      if (!step.messageEditedManually) {
        step.finalMessage = novoGenerated;
      }
      if (step.status === "confirmed" || step.confirmedAt) {
        step.status = "needs_review";
        step.messageNeedsReview = true;
        step.snapshotHash = null;
      }
    });

    return osveziPlanStatus(plan);
  }

  function naloziOsnutek() {
    try {
      var surovo = sessionStorage.getItem(KLJUC_SEJE);
      if (!surovo) return null;
      var plan = JSON.parse(surovo);
      if (!plan || !Array.isArray(plan.steps) || plan.steps.length !== 4) {
        return null;
      }
      return plan;
    } catch (_e) {
      return null;
    }
  }

  function shraniOsnutek(plan) {
    if (!plan) return;
    plan.updatedAt = zdajIso();
    plan.status = izracunajPlanStatus(plan);
    sessionStorage.setItem(KLJUC_SEJE, JSON.stringify(plan));
  }

  function pocistiOsnutek() {
    sessionStorage.removeItem(KLJUC_SEJE);
  }

  function pridobiAliUstvari(podatkiKorak1, podatkiKorak2) {
    var plan = naloziOsnutek();
    if (!plan) {
      plan = narediNovPlan(podatkiKorak1, podatkiKorak2);
      shraniOsnutek(plan);
      return plan;
    }
    plan = uskladiZVhodi(plan, podatkiKorak1, podatkiKorak2);
    shraniOsnutek(plan);
    return plan;
  }

  function najdiKorak(plan, index) {
    return (plan.steps || []).find(function (s) {
      return Number(s.index) === Number(index);
    });
  }

  function posodobiSporociloKoraka(plan, index, besedilo) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "sms") return plan;
    var t = String(besedilo || "");
    step.finalMessage = t;
    step.messageEditedManually = true;
    if (step.status === "confirmed") {
      step.status = "draft";
      step.messageNeedsReview = false;
      step.snapshotHash = null;
      step.confirmedAt = null;
    }
    return osveziPlanStatus(plan);
  }

  function potrdiKorak(plan, index, besedilo) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "sms") return plan;
    var t = String(besedilo || "").trim();
    if (!t) return plan;
    step.finalMessage = t;
    step.status = "confirmed";
    step.messageNeedsReview = false;
    step.confirmedAt = zdajIso();
    step.snapshotHash = korakSnapshotHash(
      step,
      plan.amountCents,
      plan.toneId,
      plan.overdueDaysAtCreation
    );
    return osveziPlanStatus(plan);
  }

  function oznaciAktiviran(plan) {
    plan.status = "activated";
    plan.updatedAt = zdajIso();
    plan.activatedAt = zdajIso();
    return plan;
  }

  function prviNepotrjenSmsIndex(plan) {
    var step = (plan.steps || []).find(function (s) {
      return s.kind === "sms" && s.status !== "confirmed";
    });
    return step ? step.index : null;
  }

  function soVsiSmsPotrjeni(plan) {
    return izracunajPlanStatus(plan) === "ready_to_activate";
  }

  var api = {
    KLJUC_SEJE: KLJUC_SEJE,
    eurosToCents: eurosToCents,
    izracunajZamudoDni: izracunajZamudoDni,
    preberiTonIzKorak2: preberiTonIzKorak2,
    oznakaTona: oznakaTona,
    izracunajOdmike: izracunajOdmike,
    izracunajHash: izracunajHash,
    narediNovPlan: narediNovPlan,
    pridobiAliUstvari: pridobiAliUstvari,
    naloziOsnutek: naloziOsnutek,
    shraniOsnutek: shraniOsnutek,
    pocistiOsnutek: pocistiOsnutek,
    uskladiZVhodi: uskladiZVhodi,
    najdiKorak: najdiKorak,
    posodobiSporociloKoraka: posodobiSporociloKoraka,
    potrdiKorak: potrdiKorak,
    oznaciAktiviran: oznaciAktiviran,
    izracunajPlanStatus: izracunajPlanStatus,
    prviNepotrjenSmsIndex: prviNepotrjenSmsIndex,
    soVsiSmsPotrjeni: soVsiSmsPotrjeni,
  };

  root.UJOpominNacrt = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
