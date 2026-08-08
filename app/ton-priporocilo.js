/* ========== Ton sporočila – priporočilo (brez DOM) ==========
   Centralna poslovna pravila. Brskalnik: window.UJTonPriporocilo
   Node: module.exports
   ============================================ */
(function (root) {
  "use strict";

  /** Pet tonov: 1 = najbolj prijazen … 5 = najstrožji. */
  var TONI = [
    {
      id: "very_friendly",
      key: "very_friendly",
      order: 1,
      labelSl: "Zelo prijazen",
      iconKey: "smile-plus",
      active: true,
    },
    {
      id: "friendly",
      key: "friendly",
      order: 2,
      labelSl: "Prijazen",
      iconKey: "smile",
      active: true,
    },
    {
      id: "neutral",
      key: "neutral",
      order: 3,
      labelSl: "Nevtralen",
      iconKey: "meh",
      active: true,
    },
    {
      id: "firm",
      key: "firm",
      order: 4,
      labelSl: "Odločen",
      iconKey: "shield",
      active: true,
    },
    {
      id: "strict",
      key: "strict",
      order: 5,
      labelSl: "Strog",
      iconKey: "circle-alert",
      active: true,
    },
  ];

  /**
   * Nastavljiva politika (poznejše urejanje na enem mestu).
   * Čas = glavni dejavnik; znesek sme premakniti največ za 1 stopnjo.
   */
  var PRIVZETA_POLITIKA = {
    // overdueDays (null = še ni zapadlo / negativen) → indeks 1–5
    casovnaPravila: [
      { maxOverdueDays: -1, toneOrder: 1 }, // še ni zapadlo
      { maxOverdueDays: 7, toneOrder: 1 }, // 0–7
      { maxOverdueDays: 14, toneOrder: 2 }, // 8–14
      { maxOverdueDays: 30, toneOrder: 3 }, // 15–30
      { maxOverdueDays: 60, toneOrder: 4 }, // 31–60
      { maxOverdueDays: Infinity, toneOrder: 5 }, // >60
    ],
    // Premik +1 stopnja samo ob pogojih:
    znesekPravila: [
      { maxCents: 10000, shift: 0 }, // do 100 €
      { maxCents: 50000, shift: 0 }, // do 500 €
      {
        maxCents: 150000,
        shift: 1,
        minOverdueDays: 15,
      }, // 500,01–1500 €, zamuda ≥ 15
      {
        maxCents: Infinity,
        shift: 1,
        minOverdueDays: 0, // že zapadel (overdueDays >= 0)
        requireOverdue: true,
      },
    ],
  };

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

  function najdiTonPoOrder(order) {
    var o = Math.max(1, Math.min(5, Number(order) || 3));
    for (var i = 0; i < TONI.length; i++) {
      if (TONI[i].order === o) return TONI[i];
    }
    return TONI[2];
  }

  function najdiTonPoId(id) {
    for (var i = 0; i < TONI.length; i++) {
      if (TONI[i].id === id) return TONI[i];
    }
    return null;
  }

  function orderIzCasa(overdueDays, politika) {
    var pravila = (politika && politika.casovnaPravila) || PRIVZETA_POLITIKA.casovnaPravila;
    // še ni zapadlo
    if (overdueDays == null || overdueDays < 0) {
      return 1;
    }
    for (var i = 0; i < pravila.length; i++) {
      var p = pravila[i];
      if (p.maxOverdueDays < 0) continue;
      if (overdueDays <= p.maxOverdueDays) return p.toneOrder;
    }
    return 5;
  }

  function premikZaradiZneska(totalDebtCents, overdueDays, politika) {
    if (totalDebtCents == null || !Number.isFinite(Number(totalDebtCents))) {
      return 0;
    }
    var cents = Number(totalDebtCents);
    var pravila = (politika && politika.znesekPravila) || PRIVZETA_POLITIKA.znesekPravila;
    for (var i = 0; i < pravila.length; i++) {
      var p = pravila[i];
      if (cents <= p.maxCents) {
        if (!p.shift) return 0;
        if (p.requireOverdue && (overdueDays == null || overdueDays < 0)) {
          return 0;
        }
        if (
          typeof p.minOverdueDays === "number" &&
          (overdueDays == null || overdueDays < p.minOverdueDays)
        ) {
          return 0;
        }
        return Math.min(1, Number(p.shift) || 0);
      }
    }
    return 0;
  }

  function oznakaCasovnosti(overdueDays) {
    if (overdueDays == null) return "Ni podatka";
    if (overdueDays < 0) return "Še ni zapadlo";
    if (overdueDays === 0) return "Zapade danes";
    if (overdueDays <= 14) return "Krajša zamuda";
    if (overdueDays <= 30) return "Zmerna zamuda";
    if (overdueDays <= 60) return "Daljša zamuda";
    return "Dolga zamuda";
  }

  function formatirajZnesekEur(cents) {
    if (cents == null || !Number.isFinite(Number(cents))) return "";
    var eur = Number(cents) / 100;
    return (
      eur.toLocaleString("sl-SI", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " €"
    );
  }

  function sestaviRazlog(ctx) {
    var codes = [];
    var shortText = "Predlagano glede na znesek in zapadlost računa.";
    var detailText = "";

    if (ctx.missingDue && ctx.missingAmount) {
      codes.push("missing_both");
      shortText = "Priporočilo ni popolno – manjkata znesek in rok plačila.";
      detailText =
        "Ker manjkata znesek in rok plačila, uporabimo varen nevtralen ton.";
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
    var label = ctx.toneLabel || "ta ton";
    if (d == null) {
      codes.push("unknown_time");
      detailText = shortText;
    } else if (d < 0) {
      codes.push("not_due");
      detailText = "Račun še ni zapadel. Predlagamo " + label.toLowerCase() + " ton.";
      if (!ctx.missingAmount) shortText = detailText;
    } else if (d === 0) {
      codes.push("due_today");
      detailText = "Račun zapade danes. Predlagamo " + label.toLowerCase() + " ton.";
    } else {
      codes.push("overdue_" + d);
      if (ctx.amountLabel) {
        detailText =
          "Račun zamuja " +
          d +
          " dni, znesek dolga pa znaša " +
          ctx.amountLabel +
          ".";
      } else {
        detailText = "Račun zamuja " + d + " dni.";
      }
      if (d >= 31) {
        detailText =
          "Zaradi " + d + " dni zamude predlagamo odločnejši ton.";
      }
    }

    if (ctx.amountShifted) {
      codes.push("amount_shift");
      detailText += " Znesek je priporočilo rahlo zaostril.";
    }

    return { codes: codes, shortText: shortText, detailText: detailText || shortText };
  }

  /**
   * @param {object} input
   * @param {number|null} [input.totalDebtCents]
   * @param {string|null} [input.originalDueDate] YYYY-MM-DD
   * @param {string|null} [input.evaluationDate] YYYY-MM-DD
   * @param {number|null} [input.overdueDays] če podano, ne računaj znova
   * @param {object} [input.tonePolicy]
   */
  function getRecommendedTone(input) {
    var podatki = input || {};
    var politika = podatki.tonePolicy || PRIVZETA_POLITIKA;
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

    var order;
    var amountShifted = false;

    if (missingDue) {
      order = 3; // varen nevtralen
    } else {
      order = orderIzCasa(overdueDays, politika);
      if (!missingAmount) {
        var shift = premikZaradiZneska(totalDebtCents, overdueDays, politika);
        if (shift > 0) {
          order = Math.min(5, order + shift);
          amountShifted = true;
        }
      }
    }

    // Visok znesek pred zapadlostjo ne sme dati strogega tona
    if (!missingDue && overdueDays != null && overdueDays < 0) {
      order = Math.min(order, 1);
      amountShifted = false;
    }

    order = Math.max(1, Math.min(5, order));
    var ton = najdiTonPoOrder(order);
    var amountLabel = missingAmount ? "" : formatirajZnesekEur(totalDebtCents);
    var razlog = sestaviRazlog({
      missingDue: missingDue,
      missingAmount: missingAmount,
      overdueDays: overdueDays,
      toneLabel: ton.labelSl,
      amountLabel: amountLabel,
      amountShifted: amountShifted,
    });

    return {
      recommendedToneId: ton.id,
      tone: ton,
      reasonCodes: razlog.codes,
      reasonText: razlog.shortText,
      reasonDetailText: razlog.detailText,
      amountCentsSnapshot: missingAmount ? null : totalDebtCents,
      amountLabel: amountLabel,
      originalDueDateSnapshot: missingDue ? null : originalDueDate,
      evaluationDate: evaluationDate,
      overdueDays: overdueDays,
      timingLabel: missingDue ? null : oznakaCasovnosti(overdueDays),
      calculatedAt: new Date().toISOString(),
      missingDue: missingDue,
      missingAmount: missingAmount,
    };
  }

  /**
   * Obnovi / posodobi stanje toneRecommendation.
   * Ročna izbira se ohrani; sistemsko priporočilo se posodobi.
   */
  function applyRecommendationToState(prevState, recommendation) {
    var prev = prevState || {};
    var isOverridden = Boolean(prev.isOverridden);
    var selectedToneId = prev.selectedToneId || null;

    if (!isOverridden || !selectedToneId || !najdiTonPoId(selectedToneId)) {
      selectedToneId = recommendation.recommendedToneId;
      isOverridden = false;
    } else if (selectedToneId === recommendation.recommendedToneId) {
      isOverridden = false;
    }

    return {
      recommendedToneId: recommendation.recommendedToneId,
      selectedToneId: selectedToneId,
      appliedToneId: prev.appliedToneId || null,
      isOverridden: isOverridden,
      reasonCodes: recommendation.reasonCodes,
      reasonText: recommendation.reasonText,
      reasonDetailText: recommendation.reasonDetailText,
      amountCentsSnapshot: recommendation.amountCentsSnapshot,
      originalDueDateSnapshot: recommendation.originalDueDateSnapshot,
      evaluationDate: recommendation.evaluationDate,
      overdueDays: recommendation.overdueDays,
      timingLabel: recommendation.timingLabel,
      amountLabel: recommendation.amountLabel,
      calculatedAt: recommendation.calculatedAt,
    };
  }

  /** Ponastavi izbrani ton na priporočenega. */
  function resetToRecommended(state) {
    var s = state || {};
    return Object.assign({}, s, {
      selectedToneId: s.recommendedToneId,
      isOverridden: false,
    });
  }

  /** Ročna izbira tona. */
  function selectTone(state, toneId) {
    var s = state || {};
    var ton = najdiTonPoId(toneId);
    if (!ton) return s;
    return Object.assign({}, s, {
      selectedToneId: ton.id,
      isOverridden: ton.id !== s.recommendedToneId,
    });
  }

  function eurosToCents(euros) {
    if (euros == null || euros === "") return null;
    var n = Number(euros);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }

  var api = {
    TONI: TONI,
    PRIVZETA_POLITIKA: PRIVZETA_POLITIKA,
    formatLocalYYYYMMDD: formatLocalYYYYMMDD,
    parseLocalYYYYMMDD: parseLocalYYYYMMDD,
    danesYYYYMMDD: danesYYYYMMDD,
    izracunajDniZamude: izracunajDniZamude,
    oznakaCasovnosti: oznakaCasovnosti,
    formatirajZnesekEur: formatirajZnesekEur,
    najdiTonPoId: najdiTonPoId,
    najdiTonPoOrder: najdiTonPoOrder,
    getRecommendedTone: getRecommendedTone,
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
