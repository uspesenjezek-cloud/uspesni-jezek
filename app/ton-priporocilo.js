/* ========== Ton sporočila – priporočilo (brez DOM) ==========
   Centralna poslovna pravila. Brskalnik: window.UJTonPriporocilo
   Node: module.exports
   Aktivni toni: super_friendly | friendly | firm | strict | super_strict | super_evil (6).
   Stari ID-ji (very_friendly, neutral) se preslikajo.
   ============================================ */
(function (root) {
  "use strict";

  /** Šest tonov: order 0 = super prijazen … 5 = super zloben. */
  var TONI = [
    {
      id: "super_friendly",
      key: "super_friendly",
      order: 0,
      labelSl: "Super prijazen",
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
      id: "firm",
      key: "firm",
      order: 2,
      labelSl: "Odločen",
      iconKey: "shield",
      active: true,
    },
    {
      id: "strict",
      key: "strict",
      order: 3,
      labelSl: "Strog",
      iconKey: "circle-alert",
      active: true,
    },
    {
      id: "super_strict",
      key: "super_strict",
      order: 4,
      labelSl: "Super strog",
      iconKey: "triangle-alert",
      active: true,
    },
    {
      id: "super_evil",
      key: "super_evil",
      order: 5,
      labelSl: "Super zloben",
      iconKey: "flame",
      active: true,
    },
  ];

  /** Stari ID-ji (5 tonov) → novi (3). */
  var STARI_TON_PRESLIKAVA = {
    very_friendly: "friendly",
    friendly: "friendly",
    neutral: "firm",
    firm: "firm",
    strict: "strict",
  };

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

  /** Osnovna stopnja tona (0–2) glede na kategorijo zamude. */
  var BASE_TONE_LEVEL = {
    notDue: 0,
    dueToday: 0,
    short: 0,
    medium: 1,
    long: 2,
    veryLong: 2,
  };

  var RECOMMENDATION_VERSION = 2;

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
    var o = Math.max(0, Math.min(5, Number(order)));
    if (!Number.isFinite(o)) o = 0;
    for (var i = 0; i < TONI.length; i++) {
      if (TONI[i].order === o) return TONI[i];
    }
    return TONI[0];
  }

  function najdiTonPoId(id) {
    for (var i = 0; i < TONI.length; i++) {
      if (TONI[i].id === id) return TONI[i];
    }
    return null;
  }

  /** Preslika stari/neveljavni ID v veljavnega (friendly|firm|strict). */
  function normalizirajTonId(id) {
    if (!id) return "friendly";
    var mapped = STARI_TON_PRESLIKAVA[id] || id;
    return najdiTonPoId(mapped) ? mapped : "friendly";
  }

  function normalizirajIntenzivnostStalneStranke(vrednost) {
    if (vrednost === "dve_stopnji") return 2;
    if (vrednost === "ena_stopnja" || vrednost === "najvec_prijazen") return 1;
    var n = Number(vrednost);
    return Number.isFinite(n) ? Math.max(0, Math.min(2, Math.round(n))) : 1;
  }

  function izracunajIntenzivnostStalneStranke(nastavitve) {
    var n = nastavitve || {};
    var trajanje = String(n.trajanje || "");
    var placilo = String(n.nacinPlacila || "");
    var dni = Number(n.dodatniRokDni) || 7;
    if (trajanje === "prvic" || placilo === "po_dogovoru" || placilo === "ne_vem") return 0;
    if (placilo === "po_obrokih") return ["eno_do_tri_leta", "tri_do_pet_let", "vec_kot_pet_let"].indexOf(trajanje) >= 0 ? 1 : 0;
    if (trajanje === "vec_kot_pet_let") return 2;
    if (trajanje === "tri_do_pet_let") return dni >= 14 ? 2 : 1;
    if (trajanje === "eno_do_tri_leta") return dni >= 21 ? 2 : 1;
    return trajanje === "malo_casa" && placilo === "v_celoti_takoj" ? 1 : 0;
  }

  function omehcajTonZaStalnoStranko(toneId, intenzivnost) {
    var ton = najdiTonPoId(normalizirajTonId(toneId)) || najdiTonPoId("friendly");
    var order = ton ? ton.order : 1;
    order = Math.max(0, order - normalizirajIntenzivnostStalneStranke(intenzivnost));
    return najdiTonPoOrder(order);
  }

  function formatirajZnesekEur(cents) {
    if (cents == null || !Number.isFinite(Number(cents))) return "";
    var eur = Number(cents) / 100;
    try {
      return new Intl.NumberFormat("sl-SI", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
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
  var OVERDUE_CATEGORY_PHRASE = {
    notDue: "brez zamude",
    dueToday: "da račun zapade danes",
    short: "kratko zamudo",
    medium: "srednjo zamudo",
    long: "dolgo zamudo",
    veryLong: "zelo dolgo zamudo",
  };

  var TONE_REASON_ADJECTIVES = {
    friendly: "prijazen",
    firm: "odločen",
    strict: "strog",
  };

  function pridevnikTonaZaRazlago(toneId) {
    var id = normalizirajTonId(toneId);
    return TONE_REASON_ADJECTIVES[id] || "ta";
  }

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

    var casBlok;
    var overdueCat =
      r.overdueCategory || getOverdueCategory(r.overdueDays);
    if (r.missingDue) {
      casBlok = "Datum zapadlosti ni določen.";
    } else if (r.overdueDays != null && r.overdueDays < 0) {
      casBlok = "Račun še ni zapadel, zato zamude še ni.";
    } else if (r.overdueDays === 0) {
      casBlok = "Račun zapade danes.";
    } else {
      casBlok =
        "Račun zamuja " +
        slovenskaDniBeseda(r.overdueDays) +
        (OVERDUE_CATEGORY_PHRASE[overdueCat]
          ? ", kar pomeni " + OVERDUE_CATEGORY_PHRASE[overdueCat] + "."
          : ".");
    }

    var ton = najdiTonPoId(r.recommendedToneId);
    var toneLabel = ton ? ton.labelSl.toLowerCase() : "ustrezni";
    var pridevnik = pridevnikTonaZaRazlago(r.recommendedToneId);
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
        "Zaradi " +
        (debtLower || "tega dolga") +
        " in " +
        (OVERDUE_CATEGORY_PHRASE[overdueCat] || "zamude") +
        " priporočamo " +
        toneLabel +
        " ton.";
    } else {
      priporociloBlok =
        r.reasonDetailText ||
        r.reasonText ||
        ("Predlagamo " + toneLabel + " ton.");
    }

    return {
      naslov: "Zakaj priporočamo " + pridevnik + " ton?",
      odstavki: [
        { naslov: "Znesek dolga", besedilo: znesekBlok },
        { naslov: "Čas zamude", besedilo: casBlok },
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
      level = 0;
    } else {
      level = BASE_TONE_LEVEL[overdueCategory];
      if (level == null) level = 0;
      if (!missingAmount && debtCategory) {
        var boost = getAmountToneBoost(debtCategory, overdueDays);
        if (boost > 0) {
          level = Math.min(2, level + boost);
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
      level = Math.min(level, 0);
      amountShifted = false;
    }

    level = Math.max(0, Math.min(2, level));
    var osnovniTon = najdiTonPoOrder(level);
    var jeStalnaStranka = podatki.stalnaStranka === true;
    var stalnaStrankaNastavitve = podatki.stalnaStrankaNastavitve || null;
    var stalnaStrankaIntenzivnost = stalnaStrankaNastavitve
      ? izracunajIntenzivnostStalneStranke(stalnaStrankaNastavitve)
      : normalizirajIntenzivnostStalneStranke(
          podatki.stalnaStrankaIntenzivnost != null
            ? podatki.stalnaStrankaIntenzivnost
            : podatki.stalnaStrankaUcinek
        );
    var ton = jeStalnaStranka
      ? omehcajTonZaStalnoStranko(osnovniTon.id, stalnaStrankaIntenzivnost)
      : osnovniTon;
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
    if (jeStalnaStranka && stalnaStrankaIntenzivnost > 0) {
      razlog.codes.push("returning_customer");
      razlog.shortText += " Ton je omiljen za " + stalnaStrankaIntenzivnost + (stalnaStrankaIntenzivnost === 1 ? " stopnjo" : " stopnji") + ".";
      razlog.detailText += " Ker je dolžnik označen kot stalna stranka, smo priporočilo prilagodili glede na izbrano intenzivnost.";
    }

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
      stalnaStranka: jeStalnaStranka,
      stalnaStrankaIntenzivnost: stalnaStrankaIntenzivnost,
      stalnaStrankaNastavitve: stalnaStrankaNastavitve,
      osnovniToneId: osnovniTon.id,
      recommendationVersion: RECOMMENDATION_VERSION,
    };
  }

  function applyRecommendationToState(prevState, recommendation) {
    var prev = prevState || {};
    var selectionMode =
      prev.selectionMode ||
      (prev.isOverridden ? "manual" : "automatic");
    var selectedToneId = normalizirajTonId(prev.selectedToneId || null);

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
      appliedToneId: prev.appliedToneId
        ? normalizirajTonId(prev.appliedToneId)
        : null,
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
    var ton = najdiTonPoId(normalizirajTonId(toneId));
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
    STARI_TON_PRESLIKAVA: STARI_TON_PRESLIKAVA,
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
    normalizirajTonId: normalizirajTonId,
    omehcajTonZaStalnoStranko: omehcajTonZaStalnoStranko,
    normalizirajIntenzivnostStalneStranke: normalizirajIntenzivnostStalneStranke,
    izracunajIntenzivnostStalneStranke: izracunajIntenzivnostStalneStranke,
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
