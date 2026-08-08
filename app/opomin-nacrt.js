/* ========== Načrt opominjanja (korak 3) – podatkovna plast ==========
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

  var KORAKI_META = [
    {
      order: 1,
      type: "friendly_reminder",
      title: "Prijazen opomin",
      toneId: "friendly",
      deliveryMode: "automatic",
    },
    {
      order: 2,
      type: "firm_reminder",
      title: "Odločen opomin",
      toneId: "firm",
      deliveryMode: "automatic",
    },
    {
      order: 3,
      type: "strict_reminder",
      title: "Strog opomin",
      toneId: "strict",
      deliveryMode: "automatic",
    },
    {
      order: 4,
      type: "legal_handoff",
      title: "Predaja odvetniku",
      toneId: "strict",
      deliveryMode: "manual",
    },
  ];

  var TON_OZNAKE_SL = {
    strict: "Strog",
    firm: "Odločen",
    friendly: "Zelo prijazen",
    neutral: "Odločen",
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
    return Math.max(0, Math.floor((danes.getTime() - due.getTime()) / 86400000));
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
    return TON_OZNAKE_SL[toneId] || "Izbrani ton";
  }

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

  function korakSnapshotHash(step) {
    return izracunajHash([
      String(step.sendAt || ""),
      String(step.scheduledOffsetDays),
      String(step.toneId || ""),
      String(step.templateId || ""),
      JSON.stringify(step.paymentDeadline || null),
      JSON.stringify(step.installment || null),
      JSON.stringify(step.bankTransfer || null),
      String(step.finalMessage || ""),
    ]);
  }

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

    for (var j = 1; j < out.length; j++) {
      if (out[j] <= out[j - 1]) out[j] = out[j - 1] + 2;
    }
    return out;
  }

  function sestaviRazlog(amountCents, overdueDays, toneId) {
    var znesek =
      ((Number(amountCents) || 0) / 100).toLocaleString("sl-SI", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " €";
    var ton = oznakaTona(toneId).toLowerCase();
    return (
      "Časovnica je predlagana glede na znesek dolga (" +
      znesek +
      "), " +
      overdueDays +
      " dni zamude, izbrani ton (" +
      ton +
      ") in pretek poteka opominjanja."
    );
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

  function privzetiSendAt(offsetDays) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + (Number(offsetDays) || 0));
    return d.toISOString();
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

  function vsebinaIzKorak2(podatkiKorak2) {
    var k2 = podatkiKorak2 || {};
    var pd = k2.paymentDeadline || null;
    var ip = k2.installmentPlan || null;
    var dodatki = k2.dodatki || {};
    return {
      paymentDeadline: {
        enabled: Boolean(dodatki.rok || (pd && pd.enabled)),
        days: pd && pd.termDays != null ? Number(pd.termDays) : null,
      },
      installment: {
        enabled: Boolean(dodatki.obrocno || (ip && ip.enabled)),
        planId: ip && ip.id ? String(ip.id) : null,
        count:
          ip && ip.installmentCount != null
            ? Number(ip.installmentCount)
            : null,
      },
      bankTransfer: {
        enabled: Boolean(dodatki.trr),
        accountId: null,
        accountLabel: dodatki.trr ? "Privzeti" : null,
        ibanLastFour: null,
      },
      templateId: k2.izbranPredlogId ? String(k2.izbranPredlogId) : null,
    };
  }

  function narediKorak(meta, offsetDays, ctx, vsebina) {
    var kind = meta.deliveryMode === "manual" ? "manual_lawyer" : "sms";
    var base = {
      id: "stage-" + meta.order,
      index: meta.order,
      order: meta.order,
      type: meta.type,
      title: meta.title,
      kind: kind,
      deliveryMode: meta.deliveryMode,
      scheduledOffsetDays: offsetDays,
      offsetDays: offsetDays,
      sendAt: privzetiSendAt(offsetDays),
      toneId: meta.toneId,
      templateId: vsebina.templateId,
      paymentDeadline: vsebina.paymentDeadline,
      installment: vsebina.installment,
      bankTransfer: vsebina.bankTransfer,
      status: "draft",
      generatedMessage: "",
      finalMessage: "",
      messageEditedManually: false,
      messageNeedsReview: false,
      snapshotHash: null,
      confirmedAt: null,
      confirmedSnapshotHash: null,
    };

    if (kind === "manual_lawyer") {
      return base;
    }

    var msg = sestaviGeneratedMessage(meta.order, ctx);
    base.generatedMessage = msg;
    base.finalMessage = msg;
    return base;
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
    var vsebina = vsebinaIzKorak2(podatkiKorak2);
    var steps = KORAKI_META.map(function (meta, i) {
      return narediKorak(meta, odmiki[i], ctx, vsebina);
    });
    var now = zdajIso();
    var totalDurationDays = odmiki[odmiki.length - 1] || 0;
    return {
      id: "plan-" + now,
      debtId: null,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      toneId: toneId,
      amountCents: amountCents,
      overdueDays: overdue,
      overdueDaysAtCreation: overdue,
      recommendationReason: sestaviRazlog(amountCents, overdue, toneId),
      totalDurationDays: totalDurationDays,
      selectedStageId: steps[0].id,
      keepStageIntervals: true,
      inputsHash: vhodniHash(amountCents, toneId, overdue),
      steps: steps,
      stages: steps,
    };
  }

  function izracunajPlanStatus(plan) {
    if (!plan) return "draft";
    if (plan.status === "activated" || plan.status === "active") return "activated";
    var steps = plan.steps || [];
    if (
      steps.length > 0 &&
      steps.every(function (s) {
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
    plan.stages = plan.steps;
    return plan;
  }

  function normalizirajKorak(step, i) {
    var meta = KORAKI_META[i] || KORAKI_META[0];
    if (!step.title) step.title = meta.title;
    if (!step.type) step.type = meta.type;
    if (!step.order) step.order = step.index || meta.order;
    if (!step.id) step.id = "stage-" + step.order;
    if (!step.deliveryMode) {
      step.deliveryMode =
        step.kind === "manual_lawyer" ? "manual" : "automatic";
    }
    if (!step.toneId) step.toneId = meta.toneId;
    if (step.sendAt == null) {
      step.sendAt = privzetiSendAt(step.scheduledOffsetDays || 0);
    }
    if (step.offsetDays == null) {
      step.offsetDays = step.scheduledOffsetDays || 0;
    }
    return step;
  }

  function uskladiZVhodi(plan, podatkiKorak1, podatkiKorak2) {
    if (!plan || plan.status === "activated") return plan;

    (plan.steps || []).forEach(function (s, i) {
      normalizirajKorak(s, i);
    });

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

    plan.recommendationReason = sestaviRazlog(amountCents, overdue, toneId);
    plan.overdueDays = overdue;

    if (plan.inputsHash === novHash) {
      return osveziPlanStatus(plan);
    }

    var odmiki = izracunajOdmike(toneId, overdue, amountCents);
    var vsebina = vsebinaIzKorak2(podatkiKorak2);
    plan.toneId = toneId;
    plan.amountCents = amountCents;
    plan.overdueDaysAtCreation = overdue;
    plan.inputsHash = novHash;
    plan.totalDurationDays = odmiki[odmiki.length - 1] || 0;
    if (plan.keepStageIntervals == null) plan.keepStageIntervals = true;

    (plan.steps || []).forEach(function (step, i) {
      step.scheduledOffsetDays = odmiki[i];
      step.offsetDays = odmiki[i];
      step.sendAt = privzetiSendAt(odmiki[i]);
      if (!step.paymentDeadline) step.paymentDeadline = vsebina.paymentDeadline;
      if (!step.installment) step.installment = vsebina.installment;
      if (!step.bankTransfer) step.bankTransfer = vsebina.bankTransfer;
      if (step.kind === "manual_lawyer") return;
      var novoGenerated = sestaviGeneratedMessage(step.index, ctx);
      step.generatedMessage = novoGenerated;
      if (!step.messageEditedManually) {
        step.finalMessage = novoGenerated;
      }
      if (step.status === "confirmed" || step.confirmedAt) {
        step.status = "needs_review";
        step.messageNeedsReview = true;
        step.snapshotHash = null;
        step.confirmedSnapshotHash = null;
        step.confirmedAt = null;
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
      if (plan.keepStageIntervals == null) plan.keepStageIntervals = true;
      plan.steps.forEach(normalizirajKorak);
      plan.stages = plan.steps;
      return plan;
    } catch (_e) {
      return null;
    }
  }

  function shraniOsnutek(plan) {
    if (!plan) return;
    plan.updatedAt = zdajIso();
    plan.status = izracunajPlanStatus(plan);
    plan.stages = plan.steps;
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

  function oznaciNeedsReview(step) {
    if (!step) return;
    if (step.status === "confirmed" || step.confirmedAt) {
      step.status = "needs_review";
      step.confirmedAt = null;
      step.snapshotHash = null;
      step.confirmedSnapshotHash = null;
      step.messageNeedsReview = true;
    }
  }

  function posodobiSporociloKoraka(plan, index, besedilo) {
    var step = najdiKorak(plan, index);
    if (!step || step.kind !== "sms") return plan;
    var t = String(besedilo || "");
    step.finalMessage = t;
    step.messageEditedManually = true;
    oznaciNeedsReview(step);
    if (step.status === "confirmed") {
      step.status = "draft";
    }
    return osveziPlanStatus(plan);
  }

  function potrdiKorak(plan, index, besedilo) {
    var step = najdiKorak(plan, index);
    if (!step) return plan;

    if (step.kind === "manual_lawyer") {
      step.status = "confirmed";
      step.messageNeedsReview = false;
      step.confirmedAt = zdajIso();
      step.confirmedSnapshotHash = korakSnapshotHash(step);
      step.snapshotHash = step.confirmedSnapshotHash;
      return osveziPlanStatus(plan);
    }

    var t = String(besedilo != null ? besedilo : step.finalMessage || "").trim();
    if (!t) return plan;
    step.finalMessage = t;
    step.status = "confirmed";
    step.messageNeedsReview = false;
    step.confirmedAt = zdajIso();
    step.confirmedSnapshotHash = korakSnapshotHash(step);
    step.snapshotHash = step.confirmedSnapshotHash;
    return osveziPlanStatus(plan);
  }

  function nastaviKeepIntervals(plan, vrednost) {
    plan.keepStageIntervals = Boolean(vrednost);
    return osveziPlanStatus(plan);
  }

  /** Premakni sendAt trenutnega koraka; po potrebi ohrani razmike. */
  function posodobiCasKoraka(plan, index, novSendAtIso) {
    var step = najdiKorak(plan, index);
    if (!step || !novSendAtIso) return plan;

    var staro = step.sendAt ? new Date(step.sendAt) : new Date();
    var novo = new Date(novSendAtIso);
    if (Number.isNaN(novo.getTime())) return plan;

    var deltaMs = novo.getTime() - staro.getTime();
    step.sendAt = novo.toISOString();

    var baza = new Date();
    baza.setHours(12, 0, 0, 0);
    step.scheduledOffsetDays = Math.max(
      0,
      Math.round((novo.getTime() - baza.getTime()) / 86400000)
    );
    step.offsetDays = step.scheduledOffsetDays;
    oznaciNeedsReview(step);

    if (plan.keepStageIntervals) {
      (plan.steps || []).forEach(function (s) {
        if (s.index <= step.index) return;
        if (s.sendAt) {
          var dn = new Date(s.sendAt);
          dn.setTime(dn.getTime() + deltaMs);
          s.sendAt = dn.toISOString();
          s.scheduledOffsetDays = Math.max(
            0,
            Math.round((dn.getTime() - baza.getTime()) / 86400000)
          );
          s.offsetDays = s.scheduledOffsetDays;
        }
        oznaciNeedsReview(s);
      });
    }

    var last = plan.steps[plan.steps.length - 1];
    plan.totalDurationDays = last
      ? last.scheduledOffsetDays
      : plan.totalDurationDays;
    return osveziPlanStatus(plan);
  }

  /**
   * Nastavi razmik (v dnevih) od koraka index do naslednjega.
   * Ob keepStageIntervals premakne tudi vse poznejše korake.
   */
  function posodobiRazmikDoNaslednjega(plan, index, noviDneviRazmika) {
    var step = najdiKorak(plan, index);
    var naslednji = najdiKorak(plan, Number(index) + 1);
    if (!step || !naslednji) return plan;

    var dnevi = Math.max(0, Math.round(Number(noviDneviRazmika)));
    if (!Number.isFinite(dnevi)) return plan;

    var baza = new Date();
    baza.setHours(12, 0, 0, 0);

    var staroOffset = Number(naslednji.scheduledOffsetDays) || 0;
    var novOffset = (Number(step.scheduledOffsetDays) || 0) + dnevi;
    var deltaDni = novOffset - staroOffset;

    var osnovniSend = step.sendAt
      ? new Date(step.sendAt)
      : new Date(baza.getTime() + (Number(step.scheduledOffsetDays) || 0) * 86400000);
    if (Number.isNaN(osnovniSend.getTime())) osnovniSend = new Date(baza);

    var novSend = new Date(osnovniSend.getTime() + dnevi * 86400000);
    /* Ohrani uro naslednjega, če že obstaja. */
    if (naslednji.sendAt) {
      var stari = new Date(naslednji.sendAt);
      if (!Number.isNaN(stari.getTime())) {
        novSend.setHours(stari.getHours(), stari.getMinutes(), 0, 0);
      }
    }

    naslednji.sendAt = novSend.toISOString();
    naslednji.scheduledOffsetDays = novOffset;
    naslednji.offsetDays = novOffset;
    oznaciNeedsReview(naslednji);

    if (plan.keepStageIntervals && deltaDni !== 0) {
      (plan.steps || []).forEach(function (s) {
        if (s.index <= naslednji.index) return;
        s.scheduledOffsetDays =
          (Number(s.scheduledOffsetDays) || 0) + deltaDni;
        s.offsetDays = s.scheduledOffsetDays;
        if (s.sendAt) {
          var d = new Date(s.sendAt);
          d.setDate(d.getDate() + deltaDni);
          s.sendAt = d.toISOString();
        } else {
          s.sendAt = privzetiSendAt(s.scheduledOffsetDays);
        }
        oznaciNeedsReview(s);
      });
    }

    var last = plan.steps[plan.steps.length - 1];
    plan.totalDurationDays = last
      ? last.scheduledOffsetDays
      : plan.totalDurationDays;
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
      return s.status !== "confirmed";
    });
    return step ? step.index : null;
  }

  function soVsiSmsPotrjeni(plan) {
    return izracunajPlanStatus(plan) === "ready_to_activate";
  }

  function steviloPotrjenih(plan) {
    return (plan.steps || []).filter(function (s) {
      return s.status === "confirmed";
    }).length;
  }

  var api = {
    KLJUC_SEJE: KLJUC_SEJE,
    KORAKI_META: KORAKI_META,
    eurosToCents: eurosToCents,
    izracunajZamudoDni: izracunajZamudoDni,
    preberiTonIzKorak2: preberiTonIzKorak2,
    oznakaTona: oznakaTona,
    izracunajOdmike: izracunajOdmike,
    izracunajHash: izracunajHash,
    sestaviRazlog: sestaviRazlog,
    narediNovPlan: narediNovPlan,
    pridobiAliUstvari: pridobiAliUstvari,
    naloziOsnutek: naloziOsnutek,
    shraniOsnutek: shraniOsnutek,
    pocistiOsnutek: pocistiOsnutek,
    uskladiZVhodi: uskladiZVhodi,
    najdiKorak: najdiKorak,
    posodobiSporociloKoraka: posodobiSporociloKoraka,
    potrdiKorak: potrdiKorak,
    nastaviKeepIntervals: nastaviKeepIntervals,
    posodobiCasKoraka: posodobiCasKoraka,
    posodobiRazmikDoNaslednjega: posodobiRazmikDoNaslednjega,
    oznaciAktiviran: oznaciAktiviran,
    izracunajPlanStatus: izracunajPlanStatus,
    prviNepotrjenSmsIndex: prviNepotrjenSmsIndex,
    soVsiSmsPotrjeni: soVsiSmsPotrjeni,
    steviloPotrjenih: steviloPotrjenih,
  };

  root.UJOpominNacrt = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
