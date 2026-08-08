/* ========== Ton sporočila – priporočilo (brez DOM) ==========
   Centralna poslovna pravila. Brskalnik: window.UJTonPriporocilo
   Node: module.exports
   ID-ji tonov ostanejo: very_friendly | friendly | neutral | firm | strict
   ============================================ */
(function (root) {
  "use strict";

  /** Pet tonov: order 0 = najbolj prijazen … 4 = najstrožji. */
  var TONI = [
    {
      id: "very_friendly",
      key: "very_friendly",
      order: 0,
      labelSl: "Zelo prijazen",
      iconKey: "smile-plus",
      active: true,
    },
    {
      id: "friendly",
      key: "friendly",
      order: 1,
      labelSl: "Prijazen",
      iconKey: "smile",
      active: true,
    },
    {
      id: "neutral",
      key: "neutral",
      order: 2,
      labelSl: "Nevtralen",
      iconKey: "meh",
      active: true,
    },
    {
      id: "firm",
      key: "firm",
      order: 3,
      labelSl: "Bolj strog",
      iconKey: "triangle-alert",
      active: true,
    },
    {
      id: "strict",
      key: "strict",
      order: 4,
      labelSl: "Zelo strog",
      iconKey: "circle-alert",
      active: true,
    },
  ];

  /** Meje kategorij dolga (EUR) – ena centralna konfiguracija. */
  var DEBT_THRESHOLDS = {
    lowMax: 250,
    mediumMax: 1000,
    highMax: 5000,
  };

  var DEBT_CATEGORY_LABELS = {
    low: "Nizek dolg",
    medium: "Srednji dolg",
    high: "Visok dolg",
    veryHigh: "Zelo visok dolg",
  };

  /** Osnovna stopnja tona (0–4) glede na kategorijo zamude. */
  var BASE_TONE_LEVEL = {
    notDue: 1,
    dueToday: 1,
    short: 1,
    medium: 2,
    long: 3,
    veryLong: 4,
  };

  var RECOMMENDATION_VERSION = 1;

  function formatLocalYYYYMMDD(dt) {
    var y = dt.getFullYear();
    var m = String(dt.getMonth() + 1).padStart(2, "0");
    var d = String(dt.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function parseLocalYYYYMMDD(yyyyMmDd) {
    if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return null;
    var deli = yyyyMmDd.split("-").map(Number);
    var dt = new Date(deli[0], deli[1] - 1, deli[2]);
    if (
      dt.getFullYear() !== deli[0] ||
      dt.getMonth() !== deli[1] - 1 ||
      dt.getDate() !== deli[2]
    ) {
      return null;
    }
    return dt;
  }

  function danesYYYYMMDD() {
    return formatLocalYYYYMMDD(new Date());
  }

  /** Koledarska razlika v dnevih: evaluation - due (lahko negativna). */
  function izracunajDniZamude(originalDueDate, evaluationDate) {
    var due = parseLocalYYYYMMDD(originalDueDate);
    var evalDt = parseLocalYYYYMMDD(evaluationDate || danesYYYYMMDD());
    if (!due || !evalDt) return null;
    var ms = evalDt.getTime() - due.getTime();
    return Math.round(ms / 86400000);
  }

  function getDebtCategory(amountEuros) {
    var n = Number(amountEuros);
    if (!Number.isFinite(n)) return null;
    if (n <= DEBT_THRESHOLDS.lowMax) return "low";
    if (n <= DEBT_THRESHOLDS.mediumMax) return "medium";
    if (n <= DEBT_THRESHOLDS.highMax) return "high";
    return "veryHigh";
  }

  function getDebtCategoryFromCents(cents) {
    if (cents == null || !Number.isFinite(Number(cents))) return null;
    return getDebtCategory(Number(cents) / 100);
  }

  function getOverdueCategory(daysOverdue) {
    if (daysOverdue == null || !Number.isFinite(Number(daysOverdue))) {
      return null;
    }
    var d = Number(daysOverdue);
    if (d < 0) return "notDue";
    if (d === 0) return "dueToday";
    if (d <= 7) return "short";
    if (d <= 30) return "medium";
    if (d <= 60) return "long";
    return "veryLong";
  }

  function slovenskaDniBeseda(n) {
    var d = Math.abs(Number(n) || 0);
    if (d === 1) return "1 dan";
    if (d === 2) return "2 dni";
    if (d === 3 || d === 4) return d + " dni";
    return d + " dni";
  }

  function oznakaCasovnosti(overdueDays) {
    if (overdueDays == null) return "Datum zapadlosti ni določen";
    if (overdueDays < 0) return "Ni zapadlo · Brez zamude";
    if (overdueDays === 0) return "Zapade danes";
    var cat = getOverdueCategory(overdueDays);
    var zamuda = "Zamuda " + slovenskaDniBeseda(overdueDays);
    if (cat === "short") return zamuda + " · Kratka zamuda";
    if (cat === "medium") return zamuda + " · Srednja zamuda";
    if (cat === "long") return zamuda + " · Dolga zamuda";
    if (cat === "veryLong") return zamuda + " · Zelo dolga zamuda";
    return zamuda;
  }

  function getAmountToneBoost(debtCategory, daysOverdue) {
    if (daysOverdue == null || daysOverdue <= 0) return 0;
    if (debtCategory === "veryHigh" && daysOverdue >= 1) return 1;
    if (debtCategory === "high" && daysOverdue >= 8) return 1;
    if (debtCategory === "medium" && daysOverdue >= 31) return 1;
    return 0;
  }

  function najdiTonPoOrder(order) {
    var o = Math.max(0, Math.min(4, Number(order)));
    if (!Number.isFinite(o)) o = 1;
    for (var i = 0; i < TONI.length; i++) {
      if (TONI[i].order === o) return TONI[i];
    }
    return TONI[1];
  }

  function najdiTonPoId(id) {
    for (var i = 0; i < TONI.length; i++) {
      if (TONI[i].id === id) return TONI[i];
    }
    return null;
  }

  function formatirajZnesekEur(cents) {
    if (cents == null || !Number.isFinite(Number(cents))) return "";
    var eur = Number(cents) / 100;
    try {
      return new Intl.NumberFormat("sl-SI", {
        style: "currency",
        currency: "EUR",
      }).format(eur);
    } catch (_e) {
      return (
        eur.toLocaleString("sl-SI", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) + " €"
      );
    }
  }

  function sestaviRazlog(ctx) {
    var codes = [];
    var shortText = "Predlagano glede na znesek in zapadlost računa.";
    var detailText = "";
    var debtLabel = ctx.debtCategoryLabel || "";
    var toneLabel = (ctx.toneLabel || "ta ton").toLowerCase();

    if (ctx.missingDue && ctx.missingAmount) {
      codes.push("missing_both");
      shortText = "Priporočilo ni popolno – manjkata znesek in rok plačila.";
      detailText =
        "Ker manjkata znesek in rok plačila, uporabimo varen prijazen ton.";
      return { codes: codes, shortText: shortText, detailText: detailText };
    }
    if (ctx.missingDue) {
      codes.push("missing_due");
      shortText =
        "Rok plačila ni vnesen, zato priporočila ni mogoče natančno določiti.";
      detailText = shortText;
      return { codes: codes, shortText: shortText, detailText: detailText };
    }
    if (ctx.missingAmount) {
      codes.push("missing_amount");
      shortText = "Ton je predlagan samo glede na zapadlost računa.";
    }

    var d = ctx.overdueDays;
    if (d == null) {
      codes.push("unknown_time");
      detailText = shortText;
    } else if (d < 0) {
      codes.push("not_due");
      detailText =
        "Račun še ni zapadel, zato zamude še ni. Predlagamo " +
        toneLabel +
        " ton" +
        (debtLabel ? ", ker gre za " + debtLabel.toLowerCase() : "") +
        ".";
      if (!ctx.missingAmount) shortText = detailText;
    } else if (d === 0) {
      codes.push("due_today");
      detailText =
        "Račun zapade danes. Predlagamo " + toneLabel + " ton.";
    } else {
      codes.push("overdue_" + d);
      detailText =
        "Zaradi zamude " +
        slovenskaDniBeseda(d) +
        (debtLabel ? " in kategorije »" + debtLabel + "«" : "") +
        " predlagamo " +
        toneLabel +
        " ton.";
    }

    if (ctx.amountShifted) {
      codes.push("amount_shift");
      detailText += " Višina dolga je priporočilo rahlo zaostrila.";
    }

    return {
      codes: codes,
      shortText: shortText,
      detailText: detailText || shortText,
    };
  }

  /**
   * Strukturirana razlaga za modal »Zakaj?«.
   */
  function sestaviRazlagoZaModal(recommendation) {
    var r = recommendation || {};
    var znesekBlok;
    if (r.missingAmount) {
      znesekBlok = "Znesek ni določen.";
    } else {
      znesekBlok =
        (r.amountLabel || "") +
        (r.debtCategoryLabel
          ? ' spada v kategorijo »' + r.debtCategoryLabel + "«."
          : ".");
    }

    var datumBlok;
    if (r.missingDue) {
      datumBlok = "Datum zapadlosti ni določen.";
    } else if (r.overdueDays != null && r.overdueDays < 0) {
      datumBlok = "Račun še ni zapadel, zato zamude še ni.";
    } else if (r.overdueDays === 0) {
      datumBlok = "Račun zapade danes.";
    } else {
      datumBlok =
        "Račun zamuja " +
        slovenskaDniBeseda(r.overdueDays) +
        " (" +
        (r.timingLabel || "") +
        ").";
    }

    var ton = najdiTonPoId(r.recommendedToneId);
    var toneLabel = ton ? ton.labelSl.toLowerCase() : "ustrezni";
    var debtLower = r.debtCategoryLabel
      ? r.debtCategoryLabel.toLowerCase()
      : "";
    var priporociloBlok;
    if (r.missingDue) {
      priporociloBlok =
        "Ker datum zapadlosti ni določen, predlagamo " + toneLabel + " ton.";
    } else if (r.overdueDays != null && r.overdueDays < 0) {
      priporociloBlok =
        "Predlagamo " +
        toneLabel +
        " ton, ker gre za " +
        (debtLower || "ta dolg") +
        " brez zamude.";
    } else if (r.overdueDays === 0) {
      priporociloBlok =
        "Predlagamo " +
        toneLabel +
        " ton, ker račun zapade danes" +
        (debtLower ? " in gre za " + debtLower : "") +
        ".";
    } else if (r.overdueDays != null) {
      priporociloBlok =
        "Predlagamo " +
        toneLabel +
        " ton zaradi zamude" +
        (debtLower ? " in kategorije »" + r.debtCategoryLabel + "«" : "") +
        ".";
    } else {
      priporociloBlok =
        r.reasonDetailText ||
        r.reasonText ||
        ("Predlagamo " + toneLabel + " ton.");
    }

    return {
      naslov: "Zakaj priporočamo ta ton?",
      odstavki: [
        { naslov: "Znesek dolga", besedilo: znesekBlok },
        { naslov: "Datum zapadlosti", besedilo: datumBlok },
        { naslov: "Priporočilo", besedilo: priporociloBlok },
      ],
    };
  }

  /**
   * @param {object} input
   * @param {number|null} [input.totalDebtCents]
   * @param {string|null} [input.originalDueDate] YYYY-MM-DD
   * @param {string|null} [input.evaluationDate] YYYY-MM-DD
   * @param {number|null} [input.overdueDays]
   */
  function getRecommendedTone(input) {
    var podatki = input || {};
    var evaluationDate = podatki.evaluationDate || danesYYYYMMDD();
    var originalDueDate = podatki.originalDueDate || null;
    var totalDebtCents =
      podatki.totalDebtCents == null || podatki.totalDebtCents === ""
        ? null
        : Number(podatki.totalDebtCents);

    var missingDue = !originalDueDate || !parseLocalYYYYMMDD(originalDueDate);
    var missingAmount =
      totalDebtCents == null || !Number.isFinite(totalDebtCents);

    var overdueDays = null;
    if (!missingDue) {
      overdueDays =
        typeof podatki.overdueDays === "number"
          ? podatki.overdueDays
          : izracunajDniZamude(originalDueDate, evaluationDate);
    }

    var debtCategory = missingAmount
      ? null
      : getDebtCategoryFromCents(totalDebtCents);
    var debtCategoryLabel = debtCategory
      ? DEBT_CATEGORY_LABELS[debtCategory]
      : "";
    var overdueCategory = getOverdueCategory(overdueDays);

    var level;
    var amountShifted = false;

    if (missingDue) {
      /* Brez datuma: varen prijazen, ne strog. */
      level = 1;
    } else {
      level = BASE_TONE_LEVEL[overdueCategory];
      if (level == null) level = 1;
      if (!missingAmount && debtCategory) {
        var boost = getAmountToneBoost(debtCategory, overdueDays);
        if (boost > 0) {
          level = Math.min(4, level + boost);
          amountShifted = true;
        }
      }
    }

    /* Pred zapadlostjo / danes: nikoli strožje od Prijazen. */
    if (
      !missingDue &&
      overdueDays != null &&
      overdueDays <= 0
    ) {
      level = Math.min(level, 1);
      amountShifted = false;
    }

    level = Math.max(0, Math.min(4, level));
    var ton = najdiTonPoOrder(level);
    var amountLabel = missingAmount ? "" : formatirajZnesekEur(totalDebtCents);
    var razlog = sestaviRazlog({
      missingDue: missingDue,
      missingAmount: missingAmount,
      overdueDays: overdueDays,
      toneLabel: ton.labelSl,
      amountLabel: amountLabel,
      amountShifted: amountShifted,
      debtCategoryLabel: debtCategoryLabel,
    });

    return {
      recommendedToneId: ton.id,
      tone: ton,
      reasonCodes: razlog.codes,
      reasonText: razlog.shortText,
      reasonDetailText: razlog.detailText,
      amountCentsSnapshot: missingAmount ? null : totalDebtCents,
      amountLabel: amountLabel,
      debtCategory: debtCategory,
      debtCategoryLabel: debtCategoryLabel,
      overdueCategory: overdueCategory,
      originalDueDateSnapshot: missingDue ? null : originalDueDate,
      evaluationDate: evaluationDate,
      overdueDays: overdueDays,
      timingLabel: missingDue
        ? "Datum zapadlosti ni določen"
        : oznakaCasovnosti(overdueDays),
      calculatedAt: new Date().toISOString(),
      missingDue: missingDue,
      missingAmount: missingAmount,
      recommendationVersion: RECOMMENDATION_VERSION,
    };
  }

  function applyRecommendationToState(prevState, recommendation) {
    var prev = prevState || {};
    var selectionMode =
      prev.selectionMode ||
      (prev.isOverridden ? "manual" : "automatic");
    var selectedToneId = prev.selectedToneId || null;

    if (
      selectionMode !== "manual" ||
      !selectedToneId ||
      !najdiTonPoId(selectedToneId)
    ) {
      selectedToneId = recommendation.recommendedToneId;
      selectionMode = "automatic";
    } else if (selectedToneId === recommendation.recommendedToneId) {
      selectionMode = "automatic";
    }

    return {
      recommendedToneId: recommendation.recommendedToneId,
      selectedToneId: selectedToneId,
      appliedToneId: prev.appliedToneId || null,
      selectionMode: selectionMode,
      isOverridden: selectionMode === "manual",
      reasonCodes: recommendation.reasonCodes,
      reasonText: recommendation.reasonText,
      reasonDetailText: recommendation.reasonDetailText,
      amountCentsSnapshot: recommendation.amountCentsSnapshot,
      amountLabel: recommendation.amountLabel,
      debtCategory: recommendation.debtCategory,
      debtCategoryLabel: recommendation.debtCategoryLabel,
      overdueCategory: recommendation.overdueCategory,
      originalDueDateSnapshot: recommendation.originalDueDateSnapshot,
      evaluationDate: recommendation.evaluationDate,
      overdueDays: recommendation.overdueDays,
      timingLabel: recommendation.timingLabel,
      calculatedAt: recommendation.calculatedAt,
      missingDue: recommendation.missingDue,
      missingAmount: recommendation.missingAmount,
      recommendationVersion: RECOMMENDATION_VERSION,
    };
  }

  function resetToRecommended(state) {
    var s = state || {};
    return Object.assign({}, s, {
      selectedToneId: s.recommendedToneId,
      selectionMode: "automatic",
      isOverridden: false,
    });
  }

  function selectTone(state, toneId) {
    var s = state || {};
    var ton = najdiTonPoId(toneId);
    if (!ton) return s;
    var manual = ton.id !== s.recommendedToneId;
    return Object.assign({}, s, {
      selectedToneId: ton.id,
      selectionMode: manual ? "manual" : "automatic",
      isOverridden: manual,
    });
  }

  function eurosToCents(euros) {
    if (euros == null || euros === "") return null;
    if (root.UJObrocno && typeof root.UJObrocno.eurosToCents === "function") {
      return root.UJObrocno.eurosToCents(euros);
    }
    if (typeof euros === "number") {
      if (!Number.isFinite(euros)) return null;
      return Math.round(euros * 100);
    }
    var raw = String(euros)
      .trim()
      .replace(/\s/g, "")
      .replace(/\u00a0/g, "")
      .replace(/€/g, "")
      .replace(",", ".");
    var n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }

  var api = {
    TONI: TONI,
    DEBT_THRESHOLDS: DEBT_THRESHOLDS,
    DEBT_CATEGORY_LABELS: DEBT_CATEGORY_LABELS,
    BASE_TONE_LEVEL: BASE_TONE_LEVEL,
    RECOMMENDATION_VERSION: RECOMMENDATION_VERSION,
    formatLocalYYYYMMDD: formatLocalYYYYMMDD,
    parseLocalYYYYMMDD: parseLocalYYYYMMDD,
    danesYYYYMMDD: danesYYYYMMDD,
    izracunajDniZamude: izracunajDniZamude,
    getDebtCategory: getDebtCategory,
    getDebtCategoryFromCents: getDebtCategoryFromCents,
    getOverdueCategory: getOverdueCategory,
    getAmountToneBoost: getAmountToneBoost,
    slovenskaDniBeseda: slovenskaDniBeseda,
    oznakaCasovnosti: oznakaCasovnosti,
    formatirajZnesekEur: formatirajZnesekEur,
    najdiTonPoId: najdiTonPoId,
    najdiTonPoOrder: najdiTonPoOrder,
    getRecommendedTone: getRecommendedTone,
    sestaviRazlagoZaModal: sestaviRazlagoZaModal,
    applyRecommendationToState: applyRecommendationToState,
    resetToRecommended: resetToRecommended,
    selectTone: selectTone,
    eurosToCents: eurosToCents,
  };

  root.UJTonPriporocilo = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
