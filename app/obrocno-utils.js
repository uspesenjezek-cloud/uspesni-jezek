/* ========== Obročno plačilo – čista logika (brez DOM) ==========
   window.UJObrocno / module.exports
   ============================================ */
(function (root) {
  "use strict";

  var MIN_OBROKOV = 2;
  var MAX_OBROKOV = 20;
  var PRIPOROCEN_MIN_CENTS = 1000; // 10 €

  var PRIVZETA_POLITIKA = {
    minInstallments: MIN_OBROKOV,
    maxInstallments: MAX_OBROKOV,
    recommendedMinCents: PRIPOROCEN_MIN_CENTS,
    // Osnovno št. obrokov po znesku (cents)
    countByAmount: [
      { maxCents: 10000, count: 2 },
      { maxCents: 50000, count: 3 },
      { maxCents: 150000, count: 5 },
      { maxCents: Infinity, count: 6 },
    ],
    // Prioriteta 1 (strogo) … 9 (prijazno) → prilagoditev števila
    priorityShift: {
      1: -2,
      2: -1,
      3: -1,
      4: 0,
      5: 0,
      6: 0,
      7: 1,
      8: 1,
      9: 2,
    },
    // Dnevi do prvega obroka po prioriteti
    firstDelayByPriority: {
      1: 3,
      2: 3,
      3: 5,
      4: 5,
      5: 7,
      6: 10,
      7: 10,
      8: 14,
      9: 14,
    },
    defaultInterval: "monthly",
  };

  var idStevec = 0;
  function novId() {
    idStevec += 1;
    return "inst-" + Date.now().toString(36) + "-" + idStevec;
  }

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

  function dodajKoledarskeDni(yyyyMmDd, dnevi) {
    var dt = parseLocalYYYYMMDD(yyyyMmDd);
    if (!dt) return "";
    dt.setDate(dt.getDate() + Number(dnevi));
    return formatLocalYYYYMMDD(dt);
  }

  /** Dodaj n koledarskih mesecev; ohrani dan ali zadnji veljavni dan. */
  function dodajKoledarskeMesce(yyyyMmDd, meseci) {
    var dt = parseLocalYYYYMMDD(yyyyMmDd);
    if (!dt) return "";
    var dan = dt.getDate();
    var ciljniMesec = dt.getMonth() + Number(meseci);
    var leto = dt.getFullYear() + Math.floor(ciljniMesec / 12);
    var mesec = ((ciljniMesec % 12) + 12) % 12;
    var zadnji = new Date(leto, mesec + 1, 0).getDate();
    var novDan = Math.min(dan, zadnji);
    return formatLocalYYYYMMDD(new Date(leto, mesec, novDan));
  }

  function izracunajDniZamude(originalDueDate, evaluationDate) {
    var due = parseLocalYYYYMMDD(originalDueDate);
    var evalDt = parseLocalYYYYMMDD(evaluationDate || danesYYYYMMDD());
    if (!due || !evalDt) return null;
    return Math.round((evalDt.getTime() - due.getTime()) / 86400000);
  }

  function formatCentsSl(cents) {
    var n = Number(cents) || 0;
    var eur = n / 100;
    return (
      eur.toLocaleString("sl-SI", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " €"
    );
  }

  /** Prikaz v polju (brez €): 12.935,20 */
  function formatCentsPolje(cents) {
    return formatCentsSl(cents).replace(/\s*€\s*$/, "").trim();
  }

  /** Urejanje med fokusom (brez tisočic): 12935,20 */
  function formatCentsEditable(cents) {
    var n = Math.round(Number(cents) || 0);
    var sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    var whole = Math.floor(n / 100);
    var frac = String(n % 100).padStart(2, "0");
    return sign + whole + "," + frac;
  }

  /** Med tipkanjem: samo številke + ena vejica, max 2 decimalni. */
  function filtrirajZnesekVnos(raw) {
    var s = String(raw || "")
      .replace(/[^\d.,]/g, "")
      .replace(/\./g, ",");
    var first = s.indexOf(",");
    if (first !== -1) {
      s =
        s.slice(0, first + 1) + s.slice(first + 1).replace(/,/g, "");
      var parts = s.split(",");
      if (parts[1] != null) parts[1] = parts[1].slice(0, 2);
      s = parts.join(",");
    }
    return s;
  }

  /** SL prikaz datuma: 13. 8. 2026 */
  function formatDateSl(yyyyMmDd) {
    var dt = parseLocalYYYYMMDD(yyyyMmDd);
    if (!dt) return yyyyMmDd || "";
    return dt.getDate() + ". " + (dt.getMonth() + 1) + ". " + dt.getFullYear();
  }

  /**
   * Sprejme 50 / 50,0 / 50,00 / 50.00 / 1.234,56 → cents ali null.
   * Podpira vejico in piko kot decimalno ločilo.
   */
  function parseAmountToCents(vnos) {
    if (typeof vnos === "number") {
      if (!Number.isFinite(vnos)) return null;
      return Math.round(vnos * 100);
    }
    var raw = String(vnos || "")
      .trim()
      .replace(/\s/g, "")
      .replace(/\u00a0/g, "")
      .replace(/€/g, "");
    if (!raw) return null;
    var s;
    if (/^\d+[.,]\d{1,2}$/.test(raw) || /^\d+$/.test(raw)) {
      s = raw.replace(",", ".");
    } else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(raw)) {
      // 1.234,56
      s = raw.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(raw)) {
      // 1,234.56
      s = raw.replace(/,/g, "");
    } else {
      return null;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }

  /** Evri (number ali niz z vejico/piko) → centi. */
  function eurosToCents(euros) {
    if (euros == null || euros === "") return null;
    return parseAmountToCents(euros);
  }

  /**
   * Enakomerna delitev centov: prvih (remainder) dobi +1 cent.
   * Spec primer 7564/5 → 1513×4 + 1512.
   */
  function splitCentsEvenly(totalCents, count) {
    var total = Math.round(Number(totalCents));
    var n = Math.max(0, Math.round(Number(count)));
    if (n <= 0) return [];
    if (total < 0) total = 0;
    var base = Math.floor(total / n);
    var rem = total % n;
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push(base + (i < rem ? 1 : 0));
    }
    return out;
  }

  function vsotaCents(installments) {
    return (installments || []).reduce(function (s, r) {
      return s + (Number(r.amountCents) || 0);
    }, 0);
  }

  /** Preostanek razdeli med samodejne vrstice; ročne ostanejo. */
  function preracunajZneske(plan) {
    var p = plan;
    var total = Math.round(Number(p.totalDebtCents) || 0);
    var rows = (p.installments || []).slice();
    var manualTotal = 0;
    var autoIdx = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].amountMode === "manual") {
        manualTotal += Number(rows[i].amountCents) || 0;
      } else {
        autoIdx.push(i);
      }
    }
    var remaining = total - manualTotal;
    if (autoIdx.length === 0) {
      p.installments = rows;
      p.totalCents = vsotaCents(rows);
      return p;
    }
    var parts = splitCentsEvenly(Math.max(0, remaining), autoIdx.length);
    for (var j = 0; j < autoIdx.length; j++) {
      rows[autoIdx[j]].amountCents = parts[j];
      rows[autoIdx[j]].amountMode = "automatic";
    }
    p.installments = rows;
    p.totalCents = vsotaCents(rows);
    return p;
  }

  function preracunajDatume(plan) {
    var p = plan;
    if (!p.firstDueDate || p.intervalType === "custom") {
      return p;
    }
    var rows = (p.installments || []).slice();
    if (!rows.length) return p;
    rows[0].dueDate = p.firstDueDate;
    for (var i = 1; i < rows.length; i++) {
      if (p.intervalType === "weekly") {
        rows[i].dueDate = dodajKoledarskeDni(rows[i - 1].dueDate, 7);
      } else if (p.intervalType === "biweekly") {
        rows[i].dueDate = dodajKoledarskeDni(rows[i - 1].dueDate, 14);
      } else {
        rows[i].dueDate = dodajKoledarskeMesce(p.firstDueDate, i);
      }
    }
    p.installments = rows;
    return p;
  }

  function oštevilci(plan) {
    (plan.installments || []).forEach(function (r, i) {
      r.order = i + 1;
    });
    plan.installmentCount = (plan.installments || []).length;
    return plan;
  }

  function najmanjsiPrviDatum(originalDueDate, plannedSendDate) {
    var send = plannedSendDate || danesYYYYMMDD();
    var due = originalDueDate || null;
    var overdue = due ? izracunajDniZamude(due, send) : null;
    if (due && overdue != null && overdue < 0) {
      // še ni zapadlo → prvi obrok ne pred originalnim rokom
      return send > due ? send : due;
    }
    return send;
  }

  function priorityIzToneAliOverdue(priority, toneId, overdueDays) {
    if (priority >= 1 && priority <= 9) return priority;
    var tonMap = {
      strict: 1,
      firm: 3,
      neutral: 5,
      friendly: 7,
      very_friendly: 9,
    };
    if (toneId && tonMap[toneId]) return tonMap[toneId];
    if (overdueDays == null || overdueDays < 0) return 8;
    if (overdueDays <= 7) return 7;
    if (overdueDays <= 14) return 6;
    if (overdueDays <= 30) return 5;
    if (overdueDays <= 60) return 3;
    return 1;
  }

  function getInstallmentSuggestion(input) {
    var podatki = input || {};
    var politika = podatki.policy || PRIVZETA_POLITIKA;
    var total =
      podatki.totalDebtCents == null
        ? 0
        : Math.round(Number(podatki.totalDebtCents));
    var planned = podatki.plannedSendDate || danesYYYYMMDD();
    var original = podatki.originalDueDate || null;
    var overdue =
      typeof podatki.overdueDays === "number"
        ? podatki.overdueDays
        : izracunajDniZamude(original, planned);
    var priority = priorityIzToneAliOverdue(
      podatki.priority,
      podatki.toneId,
      overdue
    );

    var count = politika.minInstallments;
    var pravila = politika.countByAmount || [];
    for (var i = 0; i < pravila.length; i++) {
      if (total <= pravila[i].maxCents) {
        count = pravila[i].count;
        break;
      }
    }
    var shift = (politika.priorityShift && politika.priorityShift[priority]) || 0;
    count = Math.max(
      politika.minInstallments,
      Math.min(politika.maxInstallments, count + shift)
    );

    // Če račun še ni zapadel, ne zaostruj
    if (overdue != null && overdue < 0) {
      count = Math.max(count, 3);
    }

    var delay =
      (politika.firstDelayByPriority && politika.firstDelayByPriority[priority]) ||
      7;
    var minFirst = najmanjsiPrviDatum(original, planned);
    var firstDue = dodajKoledarskeDni(minFirst, delay);
    if (firstDue < minFirst) firstDue = minFirst;

    var amounts = splitCentsEvenly(total, count);
    var installments = amounts.map(function (cents, idx) {
      return {
        id: novId(),
        order: idx + 1,
        amountCents: cents,
        amountMode: "automatic",
        dueDate: firstDue,
      };
    });

    var plan = {
      enabled: false,
      source: "suggested",
      totalDebtCents: total,
      linkedProposalNumber:
        podatki.linkedProposalNumber != null
          ? Number(podatki.linkedProposalNumber)
          : null,
      priority: priority,
      overdueDaysSnapshot: overdue,
      originalDueDate: original,
      plannedSendDate: planned,
      firstDueDate: firstDue,
      intervalType: politika.defaultInterval || "monthly",
      installmentCount: count,
      installments: installments,
      totalCents: total,
      addonText: "",
      addonLanguage: podatki.language || "de",
      addonManuallyEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    preracunajDatume(plan);
    plan.addonText = sestaviAddonText(plan, plan.addonLanguage);
    return plan;
  }

  function nastaviSteviloObrokov(plan, novoStevilo) {
    var n = Math.max(MIN_OBROKOV, Math.min(MAX_OBROKOV, Math.round(novoStevilo)));
    var rows = (plan.installments || []).slice();
    while (rows.length > n) rows.pop();
    while (rows.length < n) {
      rows.push({
        id: novId(),
        order: rows.length + 1,
        amountCents: 0,
        amountMode: "automatic",
        dueDate: plan.firstDueDate,
      });
    }
    plan.installments = rows;
    plan.installmentCount = n;
    plan.source = "custom";
    preracunajZneske(plan);
    preracunajDatume(plan);
    oštevilci(plan);
    plan.updatedAt = new Date().toISOString();
    return plan;
  }

  /** Zagotovi installmentCount === installments.length (2–20). */
  function uskladiSteviloVrstic(plan) {
    if (!plan) return plan;
    var len = Array.isArray(plan.installments) ? plan.installments.length : 0;
    var n = Number(plan.installmentCount);
    if (!Number.isFinite(n) || n < MIN_OBROKOV) n = len || MIN_OBROKOV;
    n = Math.max(MIN_OBROKOV, Math.min(MAX_OBROKOV, Math.round(n)));
    if (len !== n) {
      return nastaviSteviloObrokov(plan, n);
    }
    oštevilci(plan);
    return plan;
  }

  /**
   * Ali je shranjeni načrt varen za prikaz glede na svež dolg.
   * Če totalDebtCents ni enak ali struktura ne drži – zavrzi.
   */
  function jePlanUporaben(plan, expectedTotalCents) {
    if (!plan || !Array.isArray(plan.installments)) return false;
    if (plan.installments.length < MIN_OBROKOV) return false;
    if (plan.installments.length > MAX_OBROKOV) return false;
    if (plan.installments.length !== Number(plan.installmentCount)) return false;
    var expected = Math.round(Number(expectedTotalCents));
    if (!Number.isFinite(expected) || expected <= 0) return false;
    if (Math.round(Number(plan.totalDebtCents)) !== expected) return false;
    // Vsota vrstic mora biti enaka dolgu (sicer je plan iz stare/pokvarjene seje).
    if (vsotaCents(plan.installments) !== expected) return false;
    var v = validatePlan(plan);
    return Boolean(v && v.ok);
  }

  function nastaviRocniZnesek(plan, installmentId, amountCents) {
    var rows = plan.installments || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === installmentId) {
        rows[i].amountCents = Math.round(Number(amountCents));
        rows[i].amountMode = "manual";
        break;
      }
    }
    plan.source = "custom";
    preracunajZneske(plan);
    plan.updatedAt = new Date().toISOString();
    return plan;
  }

  function enakomernoRazdeli(plan) {
    (plan.installments || []).forEach(function (r) {
      r.amountMode = "automatic";
    });
    plan.source = "suggested";
    preracunajZneske(plan);
    plan.updatedAt = new Date().toISOString();
    return plan;
  }

  function odstraniObrok(plan, installmentId) {
    if ((plan.installments || []).length <= MIN_OBROKOV) {
      return { ok: false, code: "min_two", plan: plan };
    }
    var removed = null;
    var idx = -1;
    plan.installments = (plan.installments || []).filter(function (r, i) {
      if (r.id === installmentId) {
        removed = JSON.parse(JSON.stringify(r));
        idx = i;
        return false;
      }
      return true;
    });
    if (!removed) return { ok: false, code: "not_found", plan: plan };
    plan.source = "custom";
    oštevilci(plan);
    preracunajZneske(plan);
    if (plan.intervalType !== "custom") {
      if (idx === 0 && plan.installments[0]) {
        plan.firstDueDate = plan.installments[0].dueDate;
      }
      preracunajDatume(plan);
    } else if (idx === 0 && plan.installments[0]) {
      plan.firstDueDate = plan.installments[0].dueDate;
    }
    plan.updatedAt = new Date().toISOString();
    return {
      ok: true,
      plan: plan,
      undo: { removed: removed, index: idx },
    };
  }

  function razveljaviOdstranitev(plan, undo) {
    if (!undo || !undo.removed) return plan;
    var rows = (plan.installments || []).slice();
    var idx = Math.max(0, Math.min(rows.length, Number(undo.index) || 0));
    rows.splice(idx, 0, undo.removed);
    plan.installments = rows;
    oštevilci(plan);
    preracunajZneske(plan);
    if (plan.intervalType !== "custom") preracunajDatume(plan);
    plan.updatedAt = new Date().toISOString();
    return plan;
  }

  function nastaviDatum(plan, installmentId, dueDate) {
    var rows = plan.installments || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === installmentId) {
        rows[i].dueDate = dueDate;
        if (i === 0) plan.firstDueDate = dueDate;
        if (i > 0 || plan.intervalType !== "custom") {
          // Ročna sprememba 2.+ → Po meri; tudi prvi lahko ostane monthly če samo prvi
          if (i > 0) plan.intervalType = "custom";
        }
        break;
      }
    }
    // Če spremenimo prvi pri samodejnem razmiku – preračunaj ostale
    if (plan.intervalType !== "custom") {
      preracunajDatume(plan);
    }
    plan.source = "custom";
    plan.updatedAt = new Date().toISOString();
    return plan;
  }

  function nastaviRazmik(plan, intervalType) {
    plan.intervalType = intervalType;
    plan.source = "custom";
    if (intervalType !== "custom") preracunajDatume(plan);
    plan.updatedAt = new Date().toISOString();
    return plan;
  }

  function soDatumiNarascajoci(plan) {
    var rows = plan.installments || [];
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i].dueDate || rows[i].dueDate <= rows[i - 1].dueDate) {
        return false;
      }
    }
    return true;
  }

  function validatePlan(plan, politika) {
    var pol = politika || PRIVZETA_POLITIKA;
    var errors = [];
    var warnings = [];
    var rows = plan.installments || [];
    if (rows.length < MIN_OBROKOV) {
      errors.push({
        code: "min_two",
        message:
          "Obročno plačilo mora vsebovati najmanj dva obroka. Za enkratno plačilo uporabite možnost »Rok plačila«.",
      });
    }
    if (rows.length > MAX_OBROKOV) {
      errors.push({ code: "max_twenty", message: "Največ 20 obrokov." });
    }
    var manualTotal = 0;
    var hasAuto = false;
    for (var i = 0; i < rows.length; i++) {
      var c = Number(rows[i].amountCents);
      if (!Number.isFinite(c) || c <= 0) {
        errors.push({
          code: "bad_amount",
          installmentId: rows[i].id,
          message: "Znesek mora biti večji od 0.",
        });
      }
      if (rows[i].amountMode === "manual") manualTotal += c;
      else hasAuto = true;
      if (c > 0 && c < (pol.recommendedMinCents || PRIPOROCEN_MIN_CENTS)) {
        warnings.push({
          code: "low_amount",
          installmentId: rows[i].id,
          message:
            "Posamezni obrok je nižji od priporočenih " +
            formatCentsSl(pol.recommendedMinCents || PRIPOROCEN_MIN_CENTS) +
            ".",
        });
      }
    }
    var total = Math.round(Number(plan.totalDebtCents) || 0);
    if (manualTotal > total) {
      errors.push({
        code: "manual_over",
        message: "Znesek ročno nastavljenih obrokov presega celotni dolg.",
      });
    }
    if (hasAuto && total - manualTotal < rows.filter(function (r) {
      return r.amountMode !== "manual";
    }).length) {
      // preostanek bi dal < 1 cent na avto
      if (total - manualTotal <= 0) {
        errors.push({
          code: "auto_zero",
          message: "Za samodejne obroke ne ostane dovolj zneska.",
        });
      }
    }
    var sum = vsotaCents(rows);
    var diff = sum - total;
    if (diff !== 0) {
      errors.push({
        code: "sum_mismatch",
        message:
          diff < 0
            ? "Manjka še " + formatCentsSl(-diff) + "."
            : "Vsota obrokov presega dolg za " + formatCentsSl(diff) + ".",
        diff: diff,
      });
    }
    if (!soDatumiNarascajoci(plan)) {
      errors.push({
        code: "dates",
        message: "Datum obroka mora biti poznejši od prejšnjega obroka.",
      });
    }
    var minFirst = najmanjsiPrviDatum(
      plan.originalDueDate,
      plan.plannedSendDate
    );
    if (plan.firstDueDate && plan.firstDueDate < minFirst) {
      errors.push({
        code: "first_date",
        message: "Datum prvega obroka je prezgodaj.",
      });
    }
    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      sumCents: sum,
      diffCents: diff,
    };
  }

  function soEnakiZneski(rows) {
    if (!rows.length) return true;
    var first = rows[0].amountCents;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i].amountCents !== first) return false;
    }
    return true;
  }

  function sestaviAddonText(plan, jezik) {
    var j = jezik || "de";
    var rows = plan.installments || [];
    var n = rows.length;
    if (!n) return "";
    var first = rows[0];
    var rest = rows.slice(1);
    var intervalLabel =
      plan.intervalType === "weekly"
        ? j === "de"
          ? "wöchentlich"
          : j === "en"
            ? "weekly"
            : "tedensko"
        : plan.intervalType === "biweekly"
          ? j === "de"
            ? "alle zwei Wochen"
            : j === "en"
              ? "every two weeks"
              : "vsaka 2 tedna"
          : plan.intervalType === "monthly"
            ? j === "de"
              ? "monatlich"
              : j === "en"
                ? "monthly"
                : "mesečno"
            : "";

    var formatDate = function (d) {
      var dt = parseLocalYYYYMMDD(d);
      if (!dt) return d;
      if (j === "de") {
        return (
          String(dt.getDate()).padStart(2, "0") +
          "." +
          String(dt.getMonth() + 1).padStart(2, "0") +
          "." +
          dt.getFullYear()
        );
      }
      if (j === "en") {
        return (
          dt.getDate() +
          "/" +
          (dt.getMonth() + 1) +
          "/" +
          dt.getFullYear()
        );
      }
      return dt.getDate() + ". " + (dt.getMonth() + 1) + ". " + dt.getFullYear();
    };

    var needsList =
      plan.intervalType === "custom" ||
      (!soEnakiZneski(rest) && rest.length > 0) ||
      rest.some(function (r) {
        return r.amountMode === "manual";
      });

    if (needsList && n <= 8) {
      var lines = rows.map(function (r) {
        if (j === "de") {
          return (
            r.order +
            ". Rate: " +
            formatCentsSl(r.amountCents).replace(" €", " €") +
            " bis " +
            formatDate(r.dueDate)
          );
        }
        if (j === "en") {
          return (
            r.order +
            ". installment: " +
            formatCentsSl(r.amountCents) +
            " by " +
            formatDate(r.dueDate)
          );
        }
        return (
          r.order +
          ". obrok: " +
          formatCentsSl(r.amountCents) +
          " do " +
          formatDate(r.dueDate)
        );
      });
      if (j === "de") {
        return (
          "Wir bieten Ihnen eine Zahlung nach folgendem Plan an:\n" +
          lines.join("\n")
        );
      }
      if (j === "en") {
        return "We offer payment according to the following plan:\n" + lines.join("\n");
      }
      return "Ponujamo plačilo po naslednjem načrtu:\n" + lines.join("\n");
    }

    var restEqual = rest.length && soEnakiZneski(rest);
    var restAmt = restEqual ? formatCentsSl(rest[0].amountCents) : "";

    if (j === "de") {
      if (restEqual && intervalLabel) {
        return (
          "Wir bieten Ihnen eine Zahlung in " +
          n +
          " Raten an. Die erste Rate " +
          formatCentsSl(first.amountCents) +
          " ist am " +
          formatDate(first.dueDate) +
          " fällig, die übrigen betragen " +
          restAmt +
          " " +
          intervalLabel +
          "."
        );
      }
      return (
        "Wir bieten Ihnen eine Zahlung in " + n + " Raten an. Erste Rate " +
        formatCentsSl(first.amountCents) +
        " fällig am " +
        formatDate(first.dueDate) +
        "."
      );
    }
    if (j === "en") {
      if (restEqual && intervalLabel) {
        return (
          "We offer payment in " +
          n +
          " installments. The first installment of " +
          formatCentsSl(first.amountCents) +
          " is due on " +
          formatDate(first.dueDate) +
          ", the remaining ones are " +
          restAmt +
          " " +
          intervalLabel +
          "."
        );
      }
      return (
        "We offer payment in " +
        n +
        " installments. First installment " +
        formatCentsSl(first.amountCents) +
        " due " +
        formatDate(first.dueDate) +
        "."
      );
    }
    // sl
    if (restEqual && intervalLabel) {
      return (
        "Omogočamo plačilo v " +
        n +
        " obrokih. Prvi obrok " +
        formatCentsSl(first.amountCents) +
        " zapade " +
        formatDate(first.dueDate) +
        ", preostali pa znašajo " +
        restAmt +
        " " +
        intervalLabel +
        "."
      );
    }
    return (
      "Omogočamo plačilo v " +
      n +
      " obrokih. Prvi obrok " +
      formatCentsSl(first.amountCents) +
      " zapade " +
      formatDate(first.dueDate) +
      "."
    );
  }

  function osveziAddon(plan, jezik) {
    plan.addonLanguage = jezik || plan.addonLanguage || "de";
    plan.addonText = sestaviAddonText(plan, plan.addonLanguage);
    return plan;
  }

  var api = {
    MIN_OBROKOV: MIN_OBROKOV,
    MAX_OBROKOV: MAX_OBROKOV,
    PRIVZETA_POLITIKA: PRIVZETA_POLITIKA,
    formatLocalYYYYMMDD: formatLocalYYYYMMDD,
    parseLocalYYYYMMDD: parseLocalYYYYMMDD,
    danesYYYYMMDD: danesYYYYMMDD,
    dodajKoledarskeDni: dodajKoledarskeDni,
    dodajKoledarskeMesce: dodajKoledarskeMesce,
    izracunajDniZamude: izracunajDniZamude,
    eurosToCents: eurosToCents,
    formatCentsSl: formatCentsSl,
    formatCentsPolje: formatCentsPolje,
    formatCentsEditable: formatCentsEditable,
    filtrirajZnesekVnos: filtrirajZnesekVnos,
    formatDateSl: formatDateSl,
    parseAmountToCents: parseAmountToCents,
    splitCentsEvenly: splitCentsEvenly,
    vsotaCents: vsotaCents,
    preracunajZneske: preracunajZneske,
    preracunajDatume: preracunajDatume,
    getInstallmentSuggestion: getInstallmentSuggestion,
    nastaviSteviloObrokov: nastaviSteviloObrokov,
    uskladiSteviloVrstic: uskladiSteviloVrstic,
    jePlanUporaben: jePlanUporaben,
    nastaviRocniZnesek: nastaviRocniZnesek,
    enakomernoRazdeli: enakomernoRazdeli,
    odstraniObrok: odstraniObrok,
    razveljaviOdstranitev: razveljaviOdstranitev,
    nastaviDatum: nastaviDatum,
    nastaviRazmik: nastaviRazmik,
    validatePlan: validatePlan,
    sestaviAddonText: sestaviAddonText,
    osveziAddon: osveziAddon,
    najmanjsiPrviDatum: najmanjsiPrviDatum,
  };

  root.UJObrocno = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
