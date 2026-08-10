/* ========== Načrt opominjanja (korak 3) – podatkovna plast ==========
   window.UJOpominNacrt – brez DOM klicev.
   ============================================ */
(function (root) {
  "use strict";

  var KLJUC_SEJE = "neplacilo-korak3-nacrt";

  var ODMKI_BAZA = {
    super_evil: [0, 3, 6, 10, 14, 18],
    super_strict: [0, 5, 11, 17, 24, 30],
    strict: [0, 6, 13, 20, 28, 36],
    firm: [0, 8, 17, 26, 34, 42],
    friendly: [0, 11, 22, 30, 38, 46],
    super_friendly: [0, 14, 28, 36, 44, 52],
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
      type: "strict_reminder",
      title: "Dodaten odločen opomin",
      toneId: "strict",
      deliveryMode: "automatic",
    },
    {
      order: 5,
      type: "final_reminder",
      title: "Zadnji formalni opomin",
      toneId: "strict",
      deliveryMode: "automatic",
    },
    {
      order: 6,
      type: "legal_handoff",
      title: "Predaja odvetniku",
      toneId: "strict",
      deliveryMode: "manual",
    },
  ];

  var TON_OZNAKE_SL = {
    super_evil: "Super zloben",
    super_strict: "Super strog",
    strict: "Strog",
    firm: "Odločen",
    friendly: "Prijazen",
    super_friendly: "Super prijazen",
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

    var out = [0, baza[1], baza[2], baza[3], baza[4], baza[5]];

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
    var dni = Number(offsetDays) || 0;
    var d = new Date();
    /* Korak "danes" (0 dni) privzeto pošljemo ob trenutni uri – za korake v
       prihodnosti ostane razumna privzeta ura 12.00. */
    if (dni !== 0) d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + dni);
    return d.toISOString();
  }

  /** Lokalni koledarski datum YYYY-MM-DD (časovni pas naprave / podjetja). */
  function formatLocalYYYYMMDD(dt) {
    var y = dt.getFullYear();
    var m = String(dt.getMonth() + 1).padStart(2, "0");
    var d = String(dt.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function parseLocalDateTime(isoOrLocal) {
    if (!isoOrLocal) return null;
    var dt = new Date(isoOrLocal);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  /** Koledarska razlika v dnevih (B − A), ne milisekunde / 86400000. */
  function koledarskiDneviMed(isoA, isoB) {
    var a = parseLocalDateTime(isoA);
    var b = parseLocalDateTime(isoB);
    if (!a || !b) return null;
    var da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  }

  function dodajKoledarskeDniInCas(iso, deltaDni, deltaMsCas) {
    var d = parseLocalDateTime(iso);
    if (!d) return null;
    var out = new Date(d.getTime());
    if (deltaMsCas) out.setTime(out.getTime() + deltaMsCas);
    if (deltaDni) out.setDate(out.getDate() + deltaDni);
    return out.toISOString();
  }

  function slovenskaDniBeseda(n) {
    if (root.UJTonPriporocilo && typeof root.UJTonPriporocilo.slovenskaDniBeseda === "function") {
      return root.UJTonPriporocilo.slovenskaDniBeseda(n);
    }
    var d = Math.abs(Number(n) || 0);
    if (d === 1) return "1 dan";
    if (d === 2) return "2 dni";
    if (d === 3 || d === 4) return d + " dni";
    return d + " dni";
  }

  function oznakaCezDni(n) {
    return "Čez " + slovenskaDniBeseda(n);
  }

  function oznakaPoPrejsnjem(n) {
    return slovenskaDniBeseda(n) + " po prejšnjem koraku";
  }

  function syncScheduledAt(step) {
    if (!step) return step;
    if (step.scheduledAt && !step.sendAt) step.sendAt = step.scheduledAt;
    if (step.sendAt && !step.scheduledAt) step.scheduledAt = step.sendAt;
    if (step.sendAt) step.scheduledAt = step.sendAt;
    return step;
  }

  /** Posodobi scheduledOffsetDays iz dejanskih datumov (od prvega koraka). */
  function uskladiOffseteIzDatumov(plan) {
    var steps = (plan && plan.steps) || [];
    if (!steps.length) return plan;
    var first = steps[0];
    syncScheduledAt(first);
    var baseIso = first.sendAt || first.scheduledAt || privzetiSendAt(0);
    steps.forEach(function (s) {
      syncScheduledAt(s);
      var iso = s.sendAt || s.scheduledAt;
      var off = koledarskiDneviMed(baseIso, iso);
      if (off == null) off = Number(s.scheduledOffsetDays) || 0;
      s.scheduledOffsetDays = off;
      s.offsetDays = off;
    });
    var last = steps[steps.length - 1];
    plan.totalDurationDays = last ? last.scheduledOffsetDays : plan.totalDurationDays;
    return plan;
  }

  function jeKorakPremakljiv(step) {
    if (!step) return false;
    if (step.status === "sent" || step.status === "cancelled") return false;
    return true;
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
    if (index === 4) {
      return (
        "Guten Tag " +
        ime +
        ", die Rechnung" +
        stevilka +
        " über " +
        znesek +
        " bleibt unbezahlt. Wir bitten Sie dringend um Begleichung, um weitere rechtliche Schritte abzuwenden."
      );
    }
    if (index === 5) {
      return (
        "Letzte Aufforderung: Rechnung" +
        stevilka +
        " über " +
        znesek +
        " ist noch offen. Bei Nichtzahlung werden wir die Angelegenheit an unseren Rechtsbeistand übergeben."
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
    var sendAt = privzetiSendAt(offsetDays);
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
      sendAt: sendAt,
      scheduledAt: sendAt,
      manualScheduleOverride: false,
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
    var activationAt = steps[0] && steps[0].sendAt ? steps[0].sendAt : now;
    return {
      schemaVersion: 2,
      id: "plan-" + now,
      debtId: null,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      activationAt: activationAt,
      toneId: toneId,
      amountCents: amountCents,
      overdueDays: overdue,
      overdueDaysAtCreation: overdue,
      recommendationReason: sestaviRazlog(amountCents, overdue, toneId),
      recommendedGapDays: odmiki[1] != null ? odmiki[1] : 11,
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
    var steps = (plan.steps || []).filter(function (s) { return !s.isExcluded; });
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
    if (step.sendAt == null && step.scheduledAt) step.sendAt = step.scheduledAt;
    if (step.sendAt == null) {
      step.sendAt = privzetiSendAt(step.scheduledOffsetDays || 0);
    }
    step.scheduledAt = step.sendAt;
    if (step.offsetDays == null) {
      step.offsetDays = step.scheduledOffsetDays || 0;
    }
    if (step.customContacts == null) {
      step.customContacts = { phoneNumbers: [], emailAddresses: [] };
    } else {
      if (!Array.isArray(step.customContacts.phoneNumbers)) step.customContacts.phoneNumbers = [];
      if (!Array.isArray(step.customContacts.emailAddresses)) step.customContacts.emailAddresses = [];
    }
    if (step.manualScheduleOverride == null) {
      step.manualScheduleOverride = false;
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
    plan.recommendedGapDays = odmiki[1] != null ? odmiki[1] : 11;
    if (plan.keepStageIntervals == null) plan.keepStageIntervals = true;

    (plan.steps || []).forEach(function (step, i) {
      step.scheduledOffsetDays = odmiki[i];
      step.offsetDays = odmiki[i];
      step.sendAt = privzetiSendAt(odmiki[i]);
      step.scheduledAt = step.sendAt;
      step.manualScheduleOverride = false;
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

    plan.activationAt = plan.steps[0] ? plan.steps[0].sendAt : plan.activationAt;
    return osveziPlanStatus(plan);
  }

  function naloziOsnutek() {
    try {
      var surovo = sessionStorage.getItem(KLJUC_SEJE);
      if (!surovo) return null;
      var plan = JSON.parse(surovo);
      if (!plan || !Array.isArray(plan.steps) || plan.steps.length < 2) {
        return null;
      }
      if (plan.keepStageIntervals == null) plan.keepStageIntervals = true;
      plan.steps.forEach(normalizirajKorak);
      uskladiOffseteIzDatumov(plan);
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

  function jeStariStiriKoracniNacrt(plan) {
    var koraki = (plan && plan.steps) || [];
    return (
      !plan.schemaVersion &&
      koraki.length === 4 &&
      koraki.filter(function (korak) { return korak.kind === "sms"; }).length === 3 &&
      koraki[3] &&
      koraki[3].kind === "manual_lawyer"
    );
  }

  function nadgradiStariNacrt(plan, podatkiKorak1, podatkiKorak2) {
    var nov = narediNovPlan(podatkiKorak1, podatkiKorak2);
    var stariKoraki = plan.steps || [];

    /* Ohranimo obstoječe prve tri opomine; dodamo le nova 4. in 5. korak. */
    for (var i = 0; i < 3; i++) {
      if (!stariKoraki[i]) continue;
      nov.steps[i] = Object.assign({}, nov.steps[i], stariKoraki[i], {
        id: "stage-" + (i + 1),
        index: i + 1,
        order: i + 1,
      });
    }

    /* Obstoječo ročno predajo premaknemo na novi 6. korak. */
    var stariRocni = stariKoraki[3];
    if (stariRocni) {
      var noviRocni = nov.steps[5];
      nov.steps[5] = Object.assign({}, noviRocni, stariRocni, {
        id: noviRocni.id,
        index: noviRocni.index,
        order: noviRocni.order,
        type: noviRocni.type,
        title: noviRocni.title,
        toneId: noviRocni.toneId,
        kind: noviRocni.kind,
        deliveryMode: noviRocni.deliveryMode,
        scheduledOffsetDays: noviRocni.scheduledOffsetDays,
        offsetDays: noviRocni.offsetDays,
        sendAt: noviRocni.sendAt,
        scheduledAt: noviRocni.scheduledAt,
      });
    }

    nov.id = plan.id || nov.id;
    nov.createdAt = plan.createdAt || nov.createdAt;
    nov.stages = nov.steps;
    return nov;
  }

  function pridobiAliUstvari(podatkiKorak1, podatkiKorak2) {
    var plan = naloziOsnutek();
    if (!plan) {
      plan = narediNovPlan(podatkiKorak1, podatkiKorak2);
      shraniOsnutek(plan);
      return plan;
    }
    if (jeStariStiriKoracniNacrt(plan)) {
      plan = nadgradiStariNacrt(plan, podatkiKorak1, podatkiKorak2);
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

  /**
   * Premakni čas koraka.
   * @param {object} [opts]
   * @param {boolean} [opts.shiftFollowing=true] – prestavi tudi naslednje premakljive korake
   */
  function posodobiCasKoraka(plan, index, novSendAtIso, opts) {
    var step = najdiKorak(plan, index);
    if (!step || !novSendAtIso) return plan;
    if (!jeKorakPremakljiv(step)) return plan;

    var options = opts || {};
    var shiftFollowing =
      options.shiftFollowing != null
        ? Boolean(options.shiftFollowing)
        : Boolean(plan.keepStageIntervals);

    var staroIso = step.sendAt || step.scheduledAt || null;
    var staro = staroIso ? new Date(staroIso) : new Date();
    var novo = new Date(novSendAtIso);
    if (Number.isNaN(novo.getTime())) return plan;

    var deltaMs = novo.getTime() - staro.getTime();
    step.sendAt = novo.toISOString();
    step.scheduledAt = step.sendAt;
    step.manualScheduleOverride = true;
    oznaciNeedsReview(step);

    if (shiftFollowing && deltaMs !== 0) {
      var premakljivi = (plan.steps || []).filter(function (s) {
        return Number(s.index) > Number(step.index) && jeKorakPremakljiv(s);
      });
      if (premakljivi.length) {
        var intervalDni =
          options.gapDays != null
            ? Math.max(0, Math.round(Number(options.gapDays)))
            : null;
        if (
          intervalDni == null ||
          !Number.isFinite(intervalDni) ||
          intervalDni <= 0
        ) {
          /* Razmik, ki ga ravnokar določamo (prejšnji korak → ta korak),
             postane predloga za razmik do vseh naslednjih korakov –
             ne stari razmik do koraka, ki mu je sledil pred to spremembo. */
          intervalDni = null;
          var prejsnjiKorak = najdiKorak(plan, Number(step.index) - 1);
          var prejsnjiKorakCas = prejsnjiKorak
            ? parseLocalDateTime(
                prejsnjiKorak.sendAt || prejsnjiKorak.scheduledAt
              )
            : null;
          if (prejsnjiKorakCas) {
            intervalDni = koledarskiDneviMed(
              prejsnjiKorakCas.toISOString(),
              novo.toISOString()
            );
          }
          if (
            intervalDni == null ||
            !Number.isFinite(intervalDni) ||
            intervalDni <= 0
          ) {
            intervalDni = 1;
          }
        }
        var prejsnjiCas = novo;
        premakljivi.forEach(function (s) {
          var dn = new Date(prejsnjiCas.getTime());
          dn.setDate(dn.getDate() + intervalDni);
          dn.setHours(novo.getHours(), novo.getMinutes(), 0, 0);
          s.sendAt = dn.toISOString();
          s.scheduledAt = s.sendAt;
          oznaciNeedsReview(s);
          prejsnjiCas = dn;
        });
      }
    }

    uskladiOffseteIzDatumov(plan);
    if (!plan.activationAt && plan.steps[0]) {
      plan.activationAt = plan.steps[0].sendAt;
    }
    return osveziPlanStatus(plan);
  }

  /**
   * Validacija pred shranjevanjem časa koraka.
   * @returns {{ ok: boolean, napaka: string|null, preview: object }}
   */
  function validirajCasKoraka(plan, index, novSendAtIso, shiftFollowing, opts) {
    var step = najdiKorak(plan, index);
    var naslednji = najdiKorak(plan, Number(index) + 1);
    var prejsnji = najdiKorak(plan, Number(index) - 1);
    var preview = {
      shiftedCount: 0,
      lastSendAt: null,
      nextGapDays: null,
      onlyCurrent: !shiftFollowing,
    };
    var zacetekDanes = danesZacetekSafe();

    if (!step) {
      return { ok: false, napaka: "Korak ni najden.", preview: preview };
    }
    if (!jeKorakPremakljiv(step)) {
      return {
        ok: false,
        napaka: "Poslanega koraka ni mogoče spreminjati.",
        preview: preview,
      };
    }

    var novo = parseLocalDateTime(novSendAtIso);
    if (!novo) {
      return { ok: false, napaka: "Neveljaven datum.", preview: preview };
    }

    if (novo.getTime() < zacetekDanes) {
      return {
        ok: false,
        napaka: "Datum ne sme biti v preteklosti.",
        preview: preview,
      };
    }

    if (prejsnji && (prejsnji.sendAt || prejsnji.scheduledAt)) {
      var prev = parseLocalDateTime(prejsnji.sendAt || prejsnji.scheduledAt);
      if (prev && novo.getTime() <= prev.getTime()) {
        return {
          ok: false,
          napaka: "Ta korak mora biti načrtovan po prejšnjem koraku.",
          preview: preview,
        };
      }
    }

    var vOpts = opts || {};

    if (shiftFollowing) {
      var premakljivi = (plan.steps || []).filter(function (s) {
        return Number(s.index) > Number(step.index) && jeKorakPremakljiv(s);
      });
      var count = 0;
      var lastIso = novo.toISOString();
      var badPast = false;
      var intervalDni =
        vOpts.gapDays != null
          ? Math.max(0, Math.round(Number(vOpts.gapDays)))
          : null;
      if (
        intervalDni == null ||
        !Number.isFinite(intervalDni) ||
        intervalDni <= 0
      ) {
        intervalDni = null;
        var prviNaslednji = premakljivi[0];
        if (prviNaslednji) {
          var stariNaslednjiCas = parseLocalDateTime(
            prviNaslednji.sendAt || prviNaslednji.scheduledAt
          );
          if (stariNaslednjiCas) {
            intervalDni = koledarskiDneviMed(
              step.sendAt || step.scheduledAt,
              stariNaslednjiCas.toISOString()
            );
          }
        }
        if (
          intervalDni == null ||
          !Number.isFinite(intervalDni) ||
          intervalDni <= 0
        ) {
          intervalDni = 1;
        }
      }
      var prejsnjiCas = novo;
      premakljivi.forEach(function (s) {
        count += 1;
        var dn = new Date(prejsnjiCas.getTime());
        dn.setDate(dn.getDate() + intervalDni);
        dn.setHours(novo.getHours(), novo.getMinutes(), 0, 0);
        lastIso = dn.toISOString();
        if (dn.getTime() < zacetekDanes) badPast = true;
        prejsnjiCas = dn;
      });
      preview.shiftedCount = count;
      preview.lastSendAt = lastIso;
      if (badPast) {
        return {
          ok: false,
          napaka: "Premik bi postavil prihodnje korake v preteklost.",
          preview: preview,
        };
      }
    } else if (naslednji && (naslednji.sendAt || naslednji.scheduledAt)) {
      var next = parseLocalDateTime(naslednji.sendAt || naslednji.scheduledAt);
      if (next && next.getTime() <= novo.getTime()) {
        return {
          ok: false,
          napaka:
            "Naslednji korak je načrtovan prezgodaj. Spremenite datum ali prestavite tudi naslednje korake.",
          preview: preview,
        };
      }
      preview.nextGapDays = koledarskiDneviMed(
        novo.toISOString(),
        next.toISOString()
      );
      preview.lastSendAt = naslednji.sendAt || naslednji.scheduledAt;
    }

    var conflict = (plan.steps || []).some(function (s) {
      if (s.index === step.index) return false;
      if (
        shiftFollowing &&
        Number(s.index) > Number(step.index) &&
        jeKorakPremakljiv(s)
      ) {
        return false;
      }
      var t = parseLocalDateTime(s.sendAt || s.scheduledAt);
      return t && Math.abs(t.getTime() - novo.getTime()) < 60000;
    });
    if (conflict) {
      return {
        ok: false,
        napaka: "Dva koraka ne moreta imeti enakega časa.",
        preview: preview,
      };
    }

    return { ok: true, napaka: null, preview: preview };
  }

  function danesZacetekSafe() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /**
   * Nastavi razmik (v dnevih) od koraka index do naslednjega.
   * Ob shiftFollowing (ali keepStageIntervals) premakne tudi poznejše korake.
   */
  function posodobiRazmikDoNaslednjega(plan, index, noviDneviRazmika, opts) {
    var step = najdiKorak(plan, index);
    var naslednji = najdiKorak(plan, Number(index) + 1);
    if (!step || !naslednji || !jeKorakPremakljiv(naslednji)) return plan;

    var options = opts || {};
    var shiftFollowing =
      options.shiftFollowing != null
        ? Boolean(options.shiftFollowing)
        : Boolean(plan.keepStageIntervals);

    var dnevi = Math.max(0, Math.round(Number(noviDneviRazmika)));
    if (!Number.isFinite(dnevi)) return plan;

    var osnovniSend = step.sendAt
      ? new Date(step.sendAt)
      : new Date();
    if (Number.isNaN(osnovniSend.getTime())) osnovniSend = new Date();

    var novSend = new Date(osnovniSend.getTime());
    novSend.setDate(novSend.getDate() + dnevi);
    if (naslednji.sendAt) {
      var stari = new Date(naslednji.sendAt);
      if (!Number.isNaN(stari.getTime())) {
        novSend.setHours(stari.getHours(), stari.getMinutes(), 0, 0);
      }
    }

    return posodobiCasKoraka(plan, naslednji.index, novSend.toISOString(), {
      shiftFollowing: shiftFollowing,
      gapDays: dnevi,
    });
  }

  function oznaciAktiviran(plan) {
    plan.status = "activated";
    plan.updatedAt = zdajIso();
    plan.activatedAt = zdajIso();
    return plan;
  }

  function prviNepotrjenSmsIndex(plan) {
    var step = (plan.steps || []).find(function (s) {
      return !s.isExcluded && s.status !== "confirmed";
    });
    return step ? step.index : null;
  }

  function soVsiSmsPotrjeni(plan) {
    return izracunajPlanStatus(plan) === "ready_to_activate";
  }

  function steviloPotrjenih(plan) {
    return (plan.steps || []).filter(function (s) {
      return !s.isExcluded && s.status === "confirmed";
    }).length;
  }

  /** Odstrani korak z danim indexom iz plana. Preštevilči prikazne in
      interne indekse, da navigacija med sosednjimi koraki ostane pravilna. */
  function odstraniKorak(plan, index) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    var idx = -1;
    for (var i = 0; i < plan.steps.length; i++) {
      if (Number(plan.steps[i].index) === Number(index)) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return plan;
    var izbraniKorak = (plan.steps || []).find(function (s) {
      return s.id === plan.selectedStageId;
    });
    plan.steps.splice(idx, 1);
    /* UI išče prejšnji/naslednji korak z index - 1 oziroma index + 1,
       zato morajo po odstranitvi ostati zaporedni tudi interni indeksi. */
    for (var j = 0; j < plan.steps.length; j++) {
      var korak = plan.steps[j];
      var novoZaporedje = j + 1;
      korak.index = novoZaporedje;
      korak.order = novoZaporedje;
      korak.id = "stage-" + novoZaporedje;
    }
    plan.selectedStageId =
      izbraniKorak && plan.steps.indexOf(izbraniKorak) !== -1
        ? izbraniKorak.id
        : plan.steps[0]
          ? plan.steps[0].id
          : null;
    plan.stages = plan.steps;
    plan.totalDurationDays = plan.steps.length
      ? (plan.steps[plan.steps.length - 1].scheduledOffsetDays || 0)
      : 0;
    plan.updatedAt = zdajIso();
    return osveziPlanStatus(plan);
  }

  function steviloSmsKorakov(plan) {
    return (plan.steps || []).filter(function (s) {
      return s.kind === "sms";
    }).length;
  }

  function dodajKorak(plan) {
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length >= 6) return plan;
    var manualIndex = plan.steps.findIndex(function (s) {
      return s.kind === "manual_lawyer";
    });
    var insertAt = manualIndex >= 0 ? manualIndex : plan.steps.length;
    var prejsnji = plan.steps.slice(0, insertAt).filter(function (s) {
      return s.kind === "sms";
    }).pop();
    if (!prejsnji) return plan;

    var odmik = (Number(prejsnji.scheduledOffsetDays) || 0) + (Number(plan.recommendedGapDays) || 8);
    var nov = Object.assign({}, prejsnji, {
      id: "",
      index: 0,
      order: 0,
      type: "strict_reminder",
      title: "Dodaten opomin",
      toneId: "strict",
      status: "draft",
      confirmedAt: null,
      messageNeedsReview: false,
      scheduledOffsetDays: odmik,
      offsetDays: odmik,
      sendAt: privzetiSendAt(odmik),
      scheduledAt: privzetiSendAt(odmik),
    });
    plan.steps.splice(insertAt, 0, nov);
    plan.steps.forEach(function (step, i) {
      step.index = i + 1;
      step.order = i + 1;
      step.id = "stage-" + (i + 1);
    });
    plan.stages = plan.steps;
    plan.totalDurationDays = plan.steps.length
      ? Number(plan.steps[plan.steps.length - 1].scheduledOffsetDays) || 0
      : 0;
    return osveziPlanStatus(plan);
  }

  function jeZadnjiKorakManualLawyer(plan) {
    var steps = plan && plan.steps;
    if (!steps || !steps.length) return false;
    var last = steps[steps.length - 1];
    return last.kind === "manual_lawyer";
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
    validirajCasKoraka: validirajCasKoraka,
    uskladiOffseteIzDatumov: uskladiOffseteIzDatumov,
    koledarskiDneviMed: koledarskiDneviMed,
    slovenskaDniBeseda: slovenskaDniBeseda,
    oznakaCezDni: oznakaCezDni,
    oznakaPoPrejsnjem: oznakaPoPrejsnjem,
    jeKorakPremakljiv: jeKorakPremakljiv,
    oznaciAktiviran: oznaciAktiviran,
    izracunajPlanStatus: izracunajPlanStatus,
    prviNepotrjenSmsIndex: prviNepotrjenSmsIndex,
    soVsiSmsPotrjeni: soVsiSmsPotrjeni,
    steviloPotrjenih: steviloPotrjenih,
    odstraniKorak: odstraniKorak,
    dodajKorak: dodajKorak,
    steviloSmsKorakov: steviloSmsKorakov,
    jeZadnjiKorakManualLawyer: jeZadnjiKorakManualLawyer,
  };

  root.UJOpominNacrt = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
