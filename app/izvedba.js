/* ==========================================================
   izvedba.js
   Produkcijska stran "Izvedba" - bere/piše izključno prek Supabase
   (REST API poti + Realtime). Brez fixture podatkov, brez localStorage
   kot vira resnice (sessionStorage se NE uporablja tu sploh).
   ========================================================== */
(function () {
  "use strict";

  var K = window.UJIzvedbaKomponente;
  var Api = window.UJIzvedbaApi;

  var DEFAULT_ACTION_SETTINGS = {
    skip_current_step: { nextDelayDays: 0 },
    stop_plan: { resumeMode: "manual", resumeAt: null },
    handoff_to_lawyer: { timingMode: "asap", scheduledHandoffAt: null },
    postpone_reminder: { delayDays: 3 },
    payment_promised: { waitDays: 4 },
    partial_payment: { remainingAmount: null },
  };

  var DEFAULT_SETTLEMENT_SETTINGS = {
    full: { dateMode: "today", settledAt: null },
    partial: { paymentAmount: null, kind: "cash", reason: "", customReason: "", datumKoraka: null },
    compensation: { dateMode: "today", settledAt: null },
    installment: { paymentAmount: null, kind: "cash", reason: "", customReason: "", datumKoraka: null },
    credit_note: { settlementAmount: null, rocnoUrejeno: false },
    cancelled_invoice: { reason: "", customReason: "" },
  };

  var NastavitveIzidov = window.UJNastavitveIzidov;
  var SETTLEMENT_ORDER = (NastavitveIzidov && NastavitveIzidov.VRSTNI_RED_PORAVNAVE) ||
    ["full", "partial", "compensation", "installment", "credit_note", "cancelled_invoice"];
  /* Osnova (naslov/opis/razred/ikona/barva/gumb) prihaja iz skupne
     nastavitve-izidov.js - enotnega vira resnice, ki ga uporablja tudi
     koncani-primeri.js. "nastavitev" (oznaka nastavitvenega polja) in
     "badge" sta specifična samo za TO kartico izbire in zato ostajata tu. */
  var SETTLEMENT_KARTICA_DODATNO = {
    full: { nastavitev: "Datum plačila", badge: "Priporočeno" },
    partial: { nastavitev: "Prejeti znesek", badge: "Pogosto" },
    compensation: { nastavitev: "Datum zaprtja", badge: "Možnost" },
    installment: { nastavitev: "Prejeti obrok", badge: "Možnost" },
    credit_note: { nastavitev: "Celotni preostali dolg", badge: "Samodejno" },
    cancelled_invoice: { nastavitev: "Razlog", badge: "Posebno" },
  };
  var SETTLEMENT_META = SETTLEMENT_ORDER.reduce(function (acc, tip) {
    var osnova = (NastavitveIzidov && NastavitveIzidov.izid(tip)) || {};
    acc[tip] = Object.assign(
      { naslov: osnova.naslov, opis: osnova.opis, razred: osnova.razred, ikona: osnova.ikona, gumb: osnova.gumb },
      SETTLEMENT_KARTICA_DODATNO[tip]
    );
    return acc;
  }, {});

  var MEJE = {
    nextDelayDays: { min: 0, max: 30 },
    delayDays: { min: 1, max: 30 },
    waitDays: { min: 1, max: 60 },
  };

  var elVsebina = document.getElementById("izvedba-vsebina");
  var elSwipe = document.getElementById("izvedba-swipe");
  var elStevilo = document.getElementById("izvedba-stevilo-korakov");
  var elKartice = document.getElementById("izvedba-kartice");
  var elSticky = document.getElementById("izvedba-sticky");
  var elNapaka = document.getElementById("izvedba-napaka");
  var elActionSheet = document.getElementById("izvedba-action-sheet");
  var actionSheetReturnFocus = null;
  var fitMerilnik = document.createElement("canvas").getContext("2d");
  var sheetScrollY = 0;

  function zakleniOzadjeSheeta() {
    if (document.body.classList.contains("izvedba-sheet-open")) return;
    document.body.classList.add("izvedba-sheet-open");
    sheetScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = "fixed";
    document.body.style.top = "-" + sheetScrollY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function odkleniOzadjeSheeta() {
    if (!document.body.classList.contains("izvedba-sheet-open")) return;
    document.body.classList.remove("izvedba-sheet-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, sheetScrollY);
  }

  var state = {
    zadevaId: null,
    zadeva: null,
    plan: null,
    steps: [],
    ukrepi: [],
    nacrtKoraki: [],
    currentStepId: null,
    serverVersion: "0",
    selectedActionType: null,
    settingsByAction: JSON.parse(JSON.stringify(DEFAULT_ACTION_SETTINGS)),
    urejenaSporocila: {},
    isSubmitting: false,
    error: null,
    globalnaNapaka: null,
    channel: null,
    debounceTimer: null,
    actionSheetOpen: false,
    actionSheetMode: "actions",
    selectedSettlementType: null,
    settlementReasonMenuOpen: false,
    settlementReasonMenuTip: null,
    settlementSettings: JSON.parse(JSON.stringify(DEFAULT_SETTLEMENT_SETTINGS)),
    prodajalec: null,
    actionSheetStep: "izbira",
    razsirjenKorakPovzetka: null,
    aktivenDokument: 0,
    pregledDokumenta: null,
    kanaliPosiljanja: { sms: true, email: true },
    poravnavaDogovorAt: null,
  };

  function urlParametri() {
    var url = new URL(window.location.href);
    return {
      zadevaId: url.searchParams.get("zadevaId"),
      stepId: url.searchParams.get("stepId"),
      executionId: url.searchParams.get("executionId"),
    };
  }

  function celoStevilo(v) {
    var n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : NaN;
  }

  function omejiVMejo(v, meja) {
    return Math.max(meja.min, Math.min(meja.max, v));
  }

  function dodajHitraDejanja() {
    var gumbPozneje = document.getElementById("izvedba-gumb-pozneje");
    if (!gumbPozneje) return;
    var onemogoceno = state.isSubmitting ? " disabled" : "";
    gumbPozneje.insertAdjacentHTML(
      "beforebegin",
      '<div class="izvedba-hitre-akcije" aria-label="Hitra dejanja">' +
        '<button type="button" class="izvedba-hitra-akcija izvedba-hitra-akcija--preklic" id="izvedba-gumb-preklic"' + onemogoceno + '>' +
          '<span class="izvedba-hitra-akcija__ikona" aria-hidden="true">' + K.ikona("bellOff") + '</span>' +
          '<span class="izvedba-hitra-akcija__besedilo" data-izvedba-fit data-fit-min="7.5">Prekli\u010Di opomin</span>' +
        '</button>' +
        '<button type="button" class="izvedba-hitra-akcija izvedba-hitra-akcija--poravnano" id="izvedba-gumb-poravnano"' + onemogoceno + '>' +
          '<span class="izvedba-hitra-akcija__ikona" aria-hidden="true">' + K.ikona("receiptCheck") + '</span>' +
          '<span class="izvedba-hitra-akcija__besedilo" data-izvedba-fit data-fit-min="7.5">Ra\u010Dun je bil poravnan</span>' +
        '</button>' +
      '</div>'
    );
  }

  function prilagodiBesediloOmejenemuPolju(root) {
    var elementi = (root || document).querySelectorAll("[data-izvedba-fit]");
    elementi.forEach(function (element) {
      element.style.fontSize = "";
      var najmanjsaVelikost = Number(element.getAttribute("data-fit-min")) || 9;
      var velikost = parseFloat(window.getComputedStyle(element).fontSize) || 13;
      function vsebinaJePrevelika() {
        if (element.matches("input")) {
          var slog = window.getComputedStyle(element);
          fitMerilnik.font = slog.font;
          var vsebina = element.value || element.placeholder || "";
          var prostor = element.clientWidth - (parseFloat(slog.paddingLeft) || 0) - (parseFloat(slog.paddingRight) || 0) - 2;
          return fitMerilnik.measureText(vsebina).width > prostor;
        }
        return element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
      }
      while (velikost > najmanjsaVelikost && vsebinaJePrevelika()) {
        velikost = Math.max(najmanjsaVelikost, velikost - 0.5);
        element.style.fontSize = velikost + "px";
      }
    });
  }

  function korakiPoStepId(stepId) {
    return state.steps.filter(function (k) { return String(k.step_id) === String(stepId); });
  }

  function vkljuceniKorakiZaSwipe() {
    var videnStepId = {};
    var izhod = [];
    var korakiPlana = ((state.plan && state.plan.steps) || []).filter(function (step) {
      return step && !step.isExcluded;
    });

    /* Načrt je vedno avtoritativen seznam korakov. Starejši aktivni primeri
       lahko še nimajo vrstic v opomin_koraki; če bi gradili samo iz teh
       vrstic, bi zgornja časovnica izginila, čeprav je načrt veljaven. */
    korakiPlana.forEach(function (step, polozaj) {
      var stepId = String(step.stepId || step.id || ("step-" + (polozaj + 1)));
      var vrstica = (state.steps || []).find(function (k) {
        return String(k.step_id) === stepId;
      }) || {};
      var stepIndex = Number(vrstica.step_index || step.index || step.order || (polozaj + 1));
      videnStepId[stepId] = true;
      izhod.push({
        stepId: stepId,
        stepIndex: stepIndex,
        naslov: step.title || step.name || "Korak " + stepIndex,
        executionState: vrstica.step_id
          ? agregiranoStanjeKoraka(stepId)
          : (step.executionState || step.execution_state || (["sent", "cancelled", "skipped"].indexOf(step.status) >= 0 ? step.status : "scheduled")),
        scheduledAt: vrstica.scheduled_at || step.sendAt || step.scheduledAt || null,
      });
    });

    /* Združljivost za morebitno izvedbeno vrstico, ki še ni zapisana v
       trenutni različici načrta. Ne podvojimo korakov, ki so že zgoraj. */
    (state.steps || []).forEach(function (k) {
      var stepId = String(k.step_id || "");
      if (!stepId || videnStepId[stepId]) return;
      videnStepId[stepId] = true;
      izhod.push({
        stepId: stepId,
        stepIndex: Number(k.step_index || (izhod.length + 1)),
        naslov: "Korak " + Number(k.step_index || (izhod.length + 1)),
        executionState: agregiranoStanjeKoraka(stepId),
        scheduledAt: k.scheduled_at || null,
      });
    });
    izhod.sort(function (a, b) { return Number(a.stepIndex) - Number(b.stepIndex); });
    return izhod;
  }

  function agregiranoStanjeKoraka(stepId) {
    var vrstice = korakiPoStepId(stepId);
    if (!vrstice.length) return "scheduled";
    if (vrstice.some(function (k) { return k.execution_state === "sent"; })) return "sent";
    if (vrstice.some(function (k) { return k.execution_state === "processing"; })) return "processing";
    if (vrstice.some(function (k) { return k.execution_state === "ready_to_send"; })) return "ready_to_send";
    if (vrstice.some(function (k) { return k.execution_state === "awaiting_confirmation"; })) return "awaiting_confirmation";
    return vrstice[0].execution_state;
  }

  function trenutniJeAwaitingConfirmation() {
    if (!state.currentStepId) return false;
    var vrstice = korakiPoStepId(state.currentStepId).filter(function (k) { return k.kanal === "sms"; });
    return vrstice.length > 0 && vrstice.every(function (k) { return k.execution_state === "awaiting_confirmation"; });
  }

  function trenutniStepZakljucen() {
    var vrstice = korakiPoStepId(state.currentStepId);
    return vrstice.length > 0 && vrstice.every(function (k) {
      return k.execution_state === "sent" || k.execution_state === "cancelled" || k.execution_state === "skipped";
    });
  }

  // ---------- Nalaganje / osveževanje stanja ----------

  async function nalozi(params) {
    try {
      var odgovor = await Api.nalozi(params);
      if (!odgovor || odgovor.ok !== true) {
        state.globalnaNapaka = (odgovor && odgovor.napaka) || "Podatkov ni bilo mogoče naložiti.";
        render();
        return;
      }
      uporabiOdgovor(odgovor);
      state.zadevaId = odgovor.zadeva.id;
      if (!state.channel) {
        state.channel = Api.narociRealtime(state.zadevaId, naNoviDogodek, naSpremembaPovezave);
      }
      render();
    } catch (err) {
      state.globalnaNapaka = err.message || "Stran ni na voljo.";
      render();
    }
  }

  function uporabiOdgovor(odgovor) {
    state.zadeva = odgovor.zadeva;
    state.plan = odgovor.plan;
    state.steps = odgovor.steps || [];
    state.ukrepi = odgovor.ukrepi || state.ukrepi || [];
    if (odgovor.prodajalec !== undefined) state.prodajalec = odgovor.prodajalec;
    state.serverVersion = String((odgovor.plan && odgovor.plan.version) || odgovor.version || "0");
    // Ohrani trenutno odprt korak, če še obstaja v načrtu ali med izvedbenimi vrsticami.
    var korakiPlana = ((state.plan && state.plan.steps) || []).filter(function (step) {
      return step && !step.isExcluded;
    });
    var prviStepId = korakiPlana[0]
      ? String(korakiPlana[0].stepId || korakiPlana[0].id || "step-1")
      : (state.steps[0] && String(state.steps[0].step_id));
    var obstaja = korakiPlana.some(function (step, polozaj) {
      return String(step.stepId || step.id || ("step-" + (polozaj + 1))) === String(state.currentStepId);
    }) || state.steps.some(function (k) { return String(k.step_id) === String(state.currentStepId); });
    if (!obstaja) {
      state.currentStepId = odgovor.currentStepId != null
        ? String(odgovor.currentStepId)
        : (prviStepId || null);
    }
    state.globalnaNapaka = null;
  }

  function naNoviDogodek() {
    window.clearTimeout(state.debounceTimer);
    state.debounceTimer = window.setTimeout(function () {
      Api.nalozi({ zadevaId: state.zadevaId }).then(function (odgovor) {
        if (!odgovor || odgovor.ok !== true) return;
        var novaVerzija = Number((odgovor.plan && odgovor.plan.version) || odgovor.version || 0);
        var trenutnaVerzija = Number(state.serverVersion);
        if (novaVerzija <= trenutnaVerzija) return; // echo lastne spremembe ali starejše stanje
        uporabiOdgovor(odgovor);
        render();
      }).catch(function () { /* tiho - naslednji dogodek bo poskusil znova */ });
    }, 150);
  }

  function naSpremembaPovezave(status) {
    if (status === "SUBSCRIBED") {
      // Vedno osveži ob (ponovni) vzpostavitvi - pokrije spremembe med prekinitvijo.
      Api.nalozi({ zadevaId: state.zadevaId }).then(function (odgovor) {
        if (odgovor && odgovor.ok === true) { uporabiOdgovor(odgovor); render(); }
      }).catch(function () {});
    }
  }

  // ---------- Izbira kartice in nastavitve ----------

  function izberiAkcijo(actionType) {
    var jeMenjava = state.selectedActionType !== actionType;
    state.selectedActionType = actionType;
    state.error = null;
    if (actionType === "partial_payment") {
      state.selectedSettlementType = "partial";
      if (jeMenjava) {
        state.settlementSettings.partial = JSON.parse(JSON.stringify(DEFAULT_SETTLEMENT_SETTINGS.partial));
      }
    }
  }

  function posodobiStevec(actionType, polje, delta) {
    var trenutna = state.settingsByAction[actionType][polje];
    var novaVrednost = celoStevilo(trenutna) + delta;
    state.settingsByAction[actionType][polje] = omejiVMejo(novaVrednost, MEJE[polje]);
  }

  function posodobiSegment(actionType, polje, vrednost) {
    state.settingsByAction[actionType][polje] = vrednost;
  }

  function posodobiZnesek(actionType, polje, vrednost) {
    state.settingsByAction[actionType][polje] = vrednost === "" ? null : Number(vrednost);
  }

  // ---------- Pošiljanje ukrepa ----------

  function trenutniPreostaliDolg() {
    var z = state.zadeva || {};
    var vrednost = z.preostaliDolg != null ? z.preostaliDolg : (z.preostali_dolg != null ? z.preostali_dolg : z.znesek);
    var dolg = Number(vrednost);
    return Number.isFinite(dolg) ? dolg : 0;
  }

  function preostaliDolgPoNacrtu() {
    var zaceten = trenutniPreostaliDolg();
    var zaeNacrtovano = (state.nacrtKoraki || []).reduce(function (v, k) { return v + (Number(k.znesek) || 0); }, 0);
    return Math.max(0, zaceten - zaeNacrtovano);
  }

  function jeNacrtZaprt() {
    return (state.nacrtKoraki || []).some(function (k) { return k.actionType === "paid_in_full"; });
  }

  var BESEDA_ZAPOREDNEGA_KORAKA = { installment: "obrok", partial: "korak" };

  function besedaZaSteviloKorakov(n) {
    if (n === 1) return "korak";
    if (n === 2) return "koraka";
    if (n === 3 || n === 4) return "koraki";
    return "korakov";
  }

  function naslednjaStevilkaKoraka(tip) {
    var razredi = tip === "installment" ? ["obrok", "installment"] : tip === "partial" ? ["delno", "partial"] : null;
    if (!razredi) return 1;
    var steviloObstojecih = (state.ukrepi || []).filter(function (u) {
      if (u.status !== "completed") return false;
      var opis = opisUkrepaZaZgodovino(u);
      return opis && razredi.indexOf(opis.razred) !== -1;
    }).length;
    var steviloNacrtovanih = (state.nacrtKoraki || []).filter(function (k) {
      return razredi.indexOf(k.razred) !== -1;
    }).length;
    return steviloObstojecih + steviloNacrtovanih + 1;
  }

  function efektivenRazlog(nastavitve) {
    if (nastavitve.reason === "other") return String(nastavitve.customReason || "").trim();
    return nastavitve.reason || "";
  }

  function pripraviPoravnavoZaOddajo() {
    var tip = state.selectedSettlementType;
    var nastavitve = state.settlementSettings[tip];
    var dolg = preostaliDolgPoNacrtu();
    if (!tip || !nastavitve) return null;

    if (tip === "partial" || tip === "installment") {
      var znesekVneseno = Number(nastavitve.paymentAmount);
      if (!Number.isFinite(znesekVneseno) || znesekVneseno <= 0 || znesekVneseno >= dolg) {
        state.error = "Vnesite prejeti znesek, ki je večji od 0 in manjši od preostalega dolga.";
        return null;
      }
      var kindVneseno = nastavitve.kind === "credit" || nastavitve.kind === "writeoff" ? nastavitve.kind : "cash";
      var settledAtVneseno = nastavitve.datumKoraka || new Date().toISOString();
      if (kindVneseno === "cash") {
        return { actionType: "partial_payment", settings: { paymentAmount: znesekVneseno, settlementType: tip, settledAt: settledAtVneseno } };
      }
      if (kindVneseno === "writeoff" && !efektivenRazlog(nastavitve)) {
        state.error = "Izberite razlog za odpust.";
        return null;
      }
      return { actionType: "partial_settlement", settings: { kind: kindVneseno, amount: znesekVneseno, reason: kindVneseno === "writeoff" ? efektivenRazlog(nastavitve) : null, settledAt: settledAtVneseno } };
    }

    if (tip === "credit_note") {
      var vnesenDobropis = Number(nastavitve.settlementAmount);
      if (!Number.isFinite(vnesenDobropis) || vnesenDobropis <= 0) {
        state.error = "Vnesite znesek dobropisa.";
        return null;
      }
      if (vnesenDobropis > dolg + 0.009) {
        state.error = "Znesek dobropisa ne sme presegati preostalega dolga.";
        return null;
      }
      if (Math.abs(vnesenDobropis - dolg) <= 0.009) {
        return { actionType: "paid_in_full", settings: { settlementType: tip, settlementAmount: dolg, settledAt: new Date().toISOString() } };
      }
      return { actionType: "partial_settlement", settings: { kind: "credit", amount: vnesenDobropis, reason: null, settledAt: new Date().toISOString() } };
    }

    if (tip === "cancelled_invoice") {
      if (!efektivenRazlog(nastavitve)) {
        state.error = "Izberite razlog za storno računa.";
        return null;
      }
      return { actionType: "paid_in_full", settings: { settlementType: tip, reason: efektivenRazlog(nastavitve), settledAt: new Date().toISOString() } };
    }

    var datum = nastavitve.dateMode === "custom" ? nastavitve.settledAt : new Date().toISOString();
    if (!datum) {
      state.error = "Izberite datum zaključka.";
      return null;
    }
    return { actionType: "paid_in_full", settings: { settlementType: tip, settledAt: datum } };
  }

  function opisNacrtovanegaKoraka(tip, pripravljeno) {
    var meta = SETTLEMENT_META[tip];
    var s = pripravljeno.settings || {};
    if (pripravljeno.actionType === "partial_payment") {
      return { naslov: meta.naslov, znesek: Number(s.paymentAmount) || 0, ikona: meta.ikona, razred: meta.razred, datum: s.settledAt };
    }
    if (pripravljeno.actionType === "partial_settlement") {
      var jeOdpust = s.kind === "writeoff";
      return { naslov: jeOdpust ? "Odpust" : "Dobropis", znesek: Number(s.amount) || 0, ikona: jeOdpust ? "documentX" : "tag", razred: jeOdpust ? "storno" : "dobropis", datum: s.settledAt };
    }
    return { naslov: meta.naslov, znesek: preostaliDolgPoNacrtu(), ikona: meta.ikona, razred: meta.razred, datum: s.settledAt };
  }

  function dodajKorakVNacrt() {
    var pripravljeno = pripraviPoravnavoZaOddajo();
    if (!pripravljeno) return false;
    var tip = state.selectedSettlementType;
    var opis = opisNacrtovanegaKoraka(tip, pripravljeno);
    state.nacrtKoraki.push({
      tip: tip,
      actionType: pripravljeno.actionType,
      settings: pripravljeno.settings,
      naslov: opis.naslov,
      znesek: opis.znesek,
      ikona: opis.ikona,
      razred: opis.razred,
      datum: opis.datum,
    });
    if (tip === "partial" || tip === "installment") {
      state.settlementSettings[tip].paymentAmount = null;
      state.settlementSettings[tip].reason = "";
      state.settlementSettings[tip].customReason = "";
      state.settlementSettings[tip].datumKoraka = null;
    }
    state.error = null;
    return true;
  }

  function odstraniKorakIzNacrta(indeks) {
    state.nacrtKoraki.splice(indeks, 1);
    state.razsirjenKorakPovzetka = null;
    state.aktivenDokument = Math.max(0, Math.min(state.aktivenDokument, state.nacrtKoraki.length - 1));
    if (!state.nacrtKoraki.length && state.actionSheetStep === "povzetek") {
      state.actionSheetStep = "izbira";
    }
  }

  function tipRazveljavitveUkrepa(actionType) {
    if (actionType === "payment_promised") return "undo_payment_promise";
    if (actionType === "stop_plan") return "undo_stop_plan";
    return "undo_settlement";
  }

  async function odstraniIzvedenKorak(actionId, actionType) {
    if (state.isSubmitting || !actionId) return;
    state.isSubmitting = true;
    state.error = null;
    render();
    try {
      var undoId = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + Math.random();
      var odgovor = await Api.executeAction({
        zadevaId: state.zadevaId,
        stepId: state.currentStepId,
        version: state.serverVersion,
        actionId: undoId,
        actionType: tipRazveljavitveUkrepa(actionType),
        settings: { targetActionId: actionId },
      });
      if (!odgovor || odgovor.ok !== true) {
        state.error = (odgovor && odgovor.napaka) || "Koraka ni bilo mogoče odstraniti.";
        return;
      }
      uporabiOdgovor({
        zadeva: odgovor.zadeva,
        plan: odgovor.plan,
        steps: odgovor.steps,
        ukrepi: odgovor.ukrepi,
        version: odgovor.version,
        currentStepId: state.currentStepId,
      });
    } catch (err) {
      state.error = err.message || "Koraka ni bilo mogoče odstraniti.";
    } finally {
      state.isSubmitting = false;
      render();
    }
  }

  function ponastaviOsnutekPoravnave() {
    state.selectedSettlementType = null;
    state.settlementReasonMenuOpen = false;
    state.settlementReasonMenuTip = null;
    state.settlementSettings = JSON.parse(JSON.stringify(DEFAULT_SETTLEMENT_SETTINGS));
    state.settlementSettings.credit_note.settlementAmount = trenutniPreostaliDolg();
    state.nacrtKoraki = [];
    state.actionSheetStep = "izbira";
    state.razsirjenKorakPovzetka = null;
    state.aktivenDokument = 0;
    state.pregledDokumenta = null;
    state.kanaliPosiljanja = { sms: true, email: true };
    state.poravnavaDogovorAt = null;
  }

  function pomakniPotekNaDno() {
    requestAnimationFrame(function () {
      var potek = elActionSheet && elActionSheet.querySelector(".izvedba-poravnava-potek");
      if (!potek) return;
      potek.scrollTo({ top: potek.scrollHeight, behavior: "smooth" });
    });
  }

  async function nastaviNovNacrt() {
    if (state.isSubmitting || !state.nacrtKoraki.length) return;
    state.isSubmitting = true;
    state.error = null;
    render();
    try {
      while (state.nacrtKoraki.length) {
        var korak = state.nacrtKoraki[0];
        var actionId = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + Math.random();
        var odgovor = await Api.executeAction({
          zadevaId: state.zadevaId,
          stepId: state.currentStepId,
          version: state.serverVersion,
          actionId: actionId,
          actionType: korak.actionType,
          settings: korak.settings,
        });
        if (!odgovor || odgovor.ok !== true) {
          state.error = "Korak \"" + korak.naslov + "\" ni uspel: " + ((odgovor && odgovor.napaka) || "neznana napaka") + ".";
          return;
        }
        uporabiOdgovor({ zadeva: odgovor.zadeva, plan: odgovor.plan, steps: odgovor.steps, version: odgovor.version, currentStepId: state.currentStepId });
        state.nacrtKoraki.shift();
        if (korak.actionType === "paid_in_full") {
          var cilj = new URL("koncani-primeri.html", window.location.href);
          cilj.searchParams.set("nov", state.zadevaId);
          window.location.assign(cilj.href);
          return;
        }
      }
      state.selectedActionType = null;
      state.selectedSettlementType = null;
      state.actionSheetOpen = false;
      odkleniOzadjeSheeta();
    } catch (err) {
      state.error = err.message || "Načrta trenutno ni bilo mogoče izvesti.";
    } finally {
      state.isSubmitting = false;
      render();
    }
  }

  async function submitSelectedAction() {
    if (state.isSubmitting) return;
    var jePoravnavaTip = state.actionSheetMode === "payment" || state.selectedActionType === "partial_payment";
    var pripravljeno = jePoravnavaTip
      ? pripraviPoravnavoZaOddajo()
      : (state.selectedActionType ? { actionType: state.selectedActionType, settings: state.settingsByAction[state.selectedActionType] } : null);
    if (!pripravljeno) {
      if (state.error) izrisiActionSheet();
      return;
    }
    var actionType = pripravljeno.actionType;
    var settings = pripravljeno.settings;
    var pendingType = jePoravnavaTip ? actionType + ":" + state.selectedSettlementType : actionType;

    state.isSubmitting = true;
    state.error = null;
    render();

    var actionId = state.pendingActionId && state.pendingActionType === pendingType
      ? state.pendingActionId
      : (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + Math.random());
    state.pendingActionId = actionId;
    state.pendingActionType = pendingType;

    try {
      var odgovor = await Api.executeAction({
        zadevaId: state.zadevaId,
        stepId: state.currentStepId,
        version: state.serverVersion,
        actionId: actionId,
        actionType: actionType,
        settings: settings,
      });

      if (!odgovor || odgovor.ok !== true) {
        obravnavajNapakoUkrepa(odgovor);
      } else {
        uporabiOdgovor({ zadeva: odgovor.zadeva, plan: odgovor.plan, steps: odgovor.steps, version: odgovor.version, currentStepId: state.currentStepId });
        state.selectedActionType = null;
        state.selectedSettlementType = null;
        state.actionSheetOpen = false;
        odkleniOzadjeSheeta();
        state.pendingActionId = null;
        state.pendingActionType = null;
        if (actionType === "paid_in_full") {
          var cilj = new URL("koncani-primeri.html", window.location.href);
          cilj.searchParams.set("nov", state.zadevaId);
          window.location.assign(cilj.href);
          return;
        }
      }
    } catch (err) {
      state.error = err.message || "Dejanja trenutno ni bilo mogoče izvesti.";
    } finally {
      state.isSubmitting = false;
      render();
    }
  }

  function obravnavajNapakoUkrepa(odgovor) {
    var koda = odgovor && odgovor.code;
    if (koda === "VERSION_CONFLICT") {
      state.error = "Podatki so bili medtem spremenjeni na drugi napravi. Preglejte novo stanje.";
      state.pendingActionId = null;
      state.pendingActionType = null;
      Api.nalozi({ zadevaId: state.zadevaId }).then(function (sveze) {
        if (sveze && sveze.ok === true) { uporabiOdgovor(sveze); render(); }
      }).catch(function () {});
      return;
    }
    if (koda === "MISSING_HANDOFF_DATA") {
      state.error = "Za predajo odvetniku manjka: " + ((odgovor.missing || []).join(", ") || "obvezni podatki") + ".";
      return;
    }
    if (koda === "ACTION_IN_PROGRESS") {
      state.error = "Dejanje se še obdeluje, poskusite znova čez trenutek.";
      return;
    }
    state.error = odgovor.napaka || "Dejanja ni bilo mogoče izvesti.";
  }

  async function posljiOpominZdaj() {
    if (state.isSubmitting) return;
    var vrstice = korakiPoStepId(state.currentStepId).filter(function (k) { return k.kanal === "sms" && k.execution_state === "awaiting_confirmation"; });
    if (!vrstice.length) return;

    state.isSubmitting = true;
    state.error = null;
    render();

    var actionId = state.pendingSendActionId || (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + Math.random());
    state.pendingSendActionId = actionId;

    try {
      var sporocila = vrstice.map(function (k) {
        return { opominKorakId: k.id, koncnoBesedilo: (state.urejenaSporocila[k.id] != null ? state.urejenaSporocila[k.id] : k.sporocilo) };
      });
      var odgovor = await Api.posljiZdaj({
        zadevaId: state.zadevaId,
        stepId: state.currentStepId,
        version: state.serverVersion,
        actionId: actionId,
        sporocila: sporocila,
      });
      if (!odgovor || odgovor.ok !== true) {
        obravnavajNapakoUkrepa(odgovor);
      } else {
        state.serverVersion = String(odgovor.version || state.serverVersion);
        Api.nalozi({ zadevaId: state.zadevaId }).then(function (sveze) {
          if (sveze && sveze.ok === true) { uporabiOdgovor(sveze); render(); }
        }).catch(function () {});
        state.pendingSendActionId = null;
      }
    } catch (err) {
      state.error = err.message || "Sporočila trenutno ni bilo mogoče poslati.";
    } finally {
      state.isSubmitting = false;
      render();
    }
  }

  function racunPoravnan() {
    if (state.isSubmitting) return;
    actionSheetReturnFocus = document.activeElement;
    state.actionSheetMode = "payment";
    state.selectedActionType = null;
    state.error = null;
    ponastaviOsnutekPoravnave();
    state.poravnavaDogovorAt = new Date().toISOString();
    state.actionSheetOpen = true;
    izrisiSticky();
    izrisiActionSheet();
  }

  // ---------- Izris ----------

  function render() {
    var prejsnjiScrollY = window.scrollY || window.pageYOffset || 0;
    if (state.globalnaNapaka) {
      elNapaka.hidden = false;
      elNapaka.textContent = state.globalnaNapaka;
      elVsebina.hidden = true;
      return;
    }
    elNapaka.hidden = true;
    elVsebina.hidden = false;

    izrisiSwipe();
    izrisiPovzetek();
    izrisiKartice();
    izrisiSticky();
    izrisiActionSheet();
    /* Ponovni izris kartic ne sme premakniti celotnega zaslona. Vodoravni
       trak se upravlja loceno v izrisiSwipe(). */
    requestAnimationFrame(function () {
      if (Math.abs((window.scrollY || window.pageYOffset || 0) - prejsnjiScrollY) > 1) {
        window.scrollTo({ top: prejsnjiScrollY, left: 0, behavior: "auto" });
      }
    });
  }

  function izrisiSwipe() {
    var koraki = vkljuceniKorakiZaSwipe();
    elSwipe.innerHTML = K.izrisiSwipeTrak(koraki, state.currentStepId);
    var indeks = koraki.findIndex(function (k) { return k.stepId === state.currentStepId; });
    var polozaj = indeks >= 0 ? indeks + 1 : 0;
    var odstotek = koraki.length && polozaj ? Math.round(polozaj / koraki.length * 100) : 0;
    elStevilo.textContent = koraki.length ? polozaj + " od " + koraki.length + " korakov" : "";
    elStevilo.dataset.progressLabel = koraki.length ? odstotek + " %" : "";
    elStevilo.style.setProperty("--izvedba-napredek", odstotek + "%");
    function posodobiPovezaveKorakov() {
      elSwipe.querySelectorAll(".izvedba-mini-povezava").forEach(function (povezava) {
        var prejsnji = povezava.previousElementSibling;
        var naslednji = povezava.nextElementSibling;
        var prejsnjaStevilka = prejsnji && prejsnji.querySelector(".izvedba-mini-korak__stevilka");
        var naslednjaStevilka = naslednji && naslednji.querySelector(".izvedba-mini-korak__stevilka");
        var zacetna = prejsnji ? getComputedStyle(prejsnji).getPropertyValue("--mini-accent").trim() : "";
        var koncna = naslednji ? getComputedStyle(naslednji).getPropertyValue("--mini-accent").trim() : "";
        povezava.style.setProperty("--mini-from", zacetna || "#6cae90");
        povezava.style.setProperty("--mini-to", koncna || zacetna || "#87af72");
        if (!prejsnjaStevilka || !naslednjaStevilka) return;
        /* Aktivni korak ima svojo kartico (rob/ozadje), ki je širša od
           samega kroga. Če bi črto še vedno vezali na rob kroga, bi se
           vizualno začela/končala znotraj kartice namesto na njenem
           zunanjem robu. Za .is-current zato uporabimo rob same kartice,
           za navadne korake (brez kartice) pa ostane rob kroga. */
        var zacetek = prejsnji.classList.contains("is-current")
          ? prejsnji.offsetLeft + prejsnji.offsetWidth
          : prejsnji.offsetLeft + prejsnjaStevilka.offsetLeft + prejsnjaStevilka.offsetWidth;
        var konec = naslednji.classList.contains("is-current")
          ? naslednji.offsetLeft
          : naslednji.offsetLeft + naslednjaStevilka.offsetLeft;
        var sredina = prejsnji.offsetTop + prejsnjaStevilka.offsetTop + prejsnjaStevilka.offsetHeight / 2;
        povezava.style.left = Math.round(zacetek) + "px";
        povezava.style.top = Math.round(sredina - 1.5) + "px";
        povezava.style.width = Math.max(0, Math.round(konec - zacetek)) + "px";
      });
    }
    posodobiPovezaveKorakov();
    var trenutniGumb = elSwipe.querySelector('[data-swipe-step="' + (state.currentStepId || "") + '"]');
    var trak = elSwipe.querySelector(".izvedba-mini-trak");
    if (trenutniGumb && trak) {
      elStevilo.style.setProperty(
        "--izvedba-napredek-barva",
        getComputedStyle(trenutniGumb).getPropertyValue("--mini-accent").trim() || "#6cae90"
      );
      /* scrollIntoView lahko na Safariju premakne tudi celo stran navpicno.
         Premaknemo samo notranji vodoravni trak, brez animacije postavitve. */
      trak.scrollLeft = Math.max(
        0,
        trenutniGumb.offsetLeft - (trak.clientWidth - trenutniGumb.offsetWidth) / 2
      );
    }
    requestAnimationFrame(function () {
      prilagodiBesediloOmejenemuPolju(elSwipe);
      posodobiPovezaveKorakov();
    });
  }

  function izrisiPovzetek() {
    var elPovzetek = document.getElementById("izvedba-povzetek");
    if (!elPovzetek) return;
    var podatek = trenutniPodatekKoraka();
    var step = podatek.step || {};
    var vrstica = podatek.vrstica || {};
    var barva = barvaTrenutnegaKoraka(vrstica.step_index || step.index || 1);
    var datum = vrstica.scheduled_at ? new Date(vrstica.scheduled_at) : null;
    var datumBesedilo = datum && !isNaN(datum.getTime())
      ? datum.toLocaleString("sl-SI", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "Termin še ni določen";
    var jeDanes = datum && datum.toDateString() === new Date().toDateString();
    var ikona = K.ikona(ikonaTrenutnegaKoraka(step, podatek.polozaj));
    elVsebina.className = "zo-sledi";
    elVsebina.style.setProperty("--zo-accent", barva.accent);
    elVsebina.style.setProperty("--zo-accent-rgb", barva.rgb);
    var detailSheet = document.querySelector(".zo-detail-sheet");
    if (detailSheet) {
      detailSheet.style.setProperty("--zo-accent", barva.accent);
      detailSheet.style.setProperty("--zo-accent-rgb", barva.rgb);
    }
    elPovzetek.innerHTML =
      '<span class="zo-sledi__ikona-krog" aria-hidden="true">' + ikona + "</span>" +
      '<p class="zo-sledi__eyebrow">' + K.esc((podatek.polozaj || 1) + ". KORAK" + (jeDanes ? " · DANES" : "") + " — " + datumBesedilo) + "</p>" +
      '<h1 class="zo-sledi__naslov">' + K.esc("Čas je za " + zacetnicaMala(step.title || "aktivni opomin")) + "</h1>";
  }

  function zacetnicaMala(besedilo) {
    var vrednost = String(besedilo || "").trim();
    return vrednost ? vrednost.charAt(0).toLocaleLowerCase("sl-SI") + vrednost.slice(1) : vrednost;
  }

  function barvaTrenutnegaKoraka(index) {
    var barve = [
      ["#6cae90", "108,174,144"], ["#87af72", "135,175,114"],
      ["#c3a13b", "195,161,59"], ["#c49025", "196,144,37"],
      ["#c8842e", "200,132,46"], ["#c8773f", "200,119,63"],
      ["#c76b46", "199,107,70"], ["#c65d57", "198,93,87"],
      ["#b95660", "185,86,96"], ["#8762aa", "135,98,170"]
    ];
    var b = barve[Math.max(0, Math.min(9, Number(index || 1) - 1))];
    return { accent: b[0], rgb: b[1] };
  }

  function ikonaTrenutnegaKoraka(step, polozaj) {
    if (step && (step.kind === "manual_lawyer" || step.deliveryMode === "manual")) return "scales";
    if (Number(polozaj) >= 8) return "warning";
    if (Number(polozaj) >= 5) return "document";
    return "message";
  }

  function oznakaDejanskegaTona(toneId) {
    var id = String(toneId || "").toLowerCase();
    var oznake = {
      friendly: "Prijazen",
      prijazen: "Prijazen",
      firm: "Odločen",
      strict: "Strog",
      strog: "Strog",
      formal: "Formalen",
      formalen: "Formalen",
      neutral: "Nevtralen",
    };
    return oznake[id] || (toneId ? String(toneId) : "Samodejno prilagojen");
  }

  function trenutniPodatekKoraka() {
    var vrstica = (state.steps || []).find(function (k) { return k.step_id === state.currentStepId; }) || state.steps[0] || {};
    var seznam = (state.plan && state.plan.steps) || [];
    var step = seznam.find(function (s) { return String(s.stepId || s.id) === String(vrstica.step_id || state.currentStepId); }) || {};
    var vkljuceni = seznam.filter(function (s) { return s && !s.isExcluded; });
    var polozaj = vkljuceni.indexOf(step) + 1;
    return { vrstica: vrstica, step: step, polozaj: polozaj > 0 ? polozaj : Number(vrstica.step_index || 1), skupaj: vkljuceni.length };
  }

  function opisTrenutnegaKoraka(step, polozaj) {
    if (step && (step.summary || step.reason)) return step.summary || step.reason;
    if (step.kind === "manual_lawyer" || step.deliveryMode === "manual") {
      return "Ker prejšnji opomini niso bili uspešni, je primer pripravljen za predajo izbranemu odvetniku.";
    }
    if (Number(polozaj) <= 1) return "Dolžniku bo poslan prijazen prvi opomin z jasnim pozivom k plačilu.";
    if (Number(polozaj) >= 8) return "Ker se dolžnik na prejšnje opomine ni odzval, bo prejel zadnje opozorilo pred nadaljnjimi ukrepi.";
    return "Ker se dolžnik na prejšnji opomin ni odzval, mu bo poslan odločneje oblikovan opomin.";
  }

  function podatkiZaKartico(actionType, izbrano) {
    var nastavitve = state.settingsByAction[actionType];
    if (actionType === "skip_current_step") {
      var prikazZamika = nastavitve.nextDelayDays === 0 ? "Danes" : null;
      return K.izrisiStevec(actionType, "nextDelayDays", nastavitve.nextDelayDays, nastavitve.nextDelayDays === 1 ? "dan" : "dni", prikazZamika);
    }
    if (actionType === "stop_plan") {
      var ustavitev = K.izrisiSegmentiranKontrolnik(actionType, "resumeMode", [
        { vrednost: "manual", oznaka: "Takoj" },
        { vrednost: "date", oznaka: "Datum" },
      ], nastavitve.resumeMode);
      return ustavitev + (izbrano && nastavitve.resumeMode === "date" ? izrisiDatumVnos(actionType, "resumeAt", nastavitve.resumeAt, "Datum ponovnega zagona") : "");
    }
    if (actionType === "handoff_to_lawyer") {
      var predaja = K.izrisiSegmentiranKontrolnik(actionType, "timingMode", [
        { vrednost: "asap", oznaka: "Čim prej" },
        { vrednost: "custom", oznaka: "Določen datum" },
      ], nastavitve.timingMode);
      return predaja + (izbrano && nastavitve.timingMode === "custom" ? izrisiDatumVnos(actionType, "scheduledHandoffAt", nastavitve.scheduledHandoffAt, "Datum predaje") : "");
    }
    if (actionType === "postpone_reminder") {
      return K.izrisiStevec(actionType, "delayDays", nastavitve.delayDays, "dni");
    }
    if (actionType === "payment_promised") {
      return K.izrisiStevec(actionType, "waitDays", nastavitve.waitDays, "dni");
    }
    if (actionType === "partial_payment") {
      return izrisiPoravnavaKontrolnik("partial", izbrano);
    }
    return "";
  }

  var VRSTNI_RED_KARTIC = [
    "skip_current_step", "stop_plan", "handoff_to_lawyer",
    "postpone_reminder", "payment_promised", "partial_payment",
  ];

  var ACTION_SHEET_META = {
    skip_current_step: { opis: "Naslednji korak ostane aktiven.", nastavitev: "Naslednji korak čez", badge: "Privzeto", razred: "preklic", ikona: "messageX" },
    stop_plan: { opis: "Prekliče vse prihodnje opomine.", nastavitev: "Ponovni zagon", badge: "Privzeto", razred: "ustavi", ikona: "stopCircle" },
    handoff_to_lawyer: { opis: "Primer pripravi za predajo.", nastavitev: "Čas predaje", badge: "Priporočeno", razred: "odvetnik", ikona: "scales" },
    postpone_reminder: { opis: "Izberete nov datum pošiljanja.", nastavitev: "Prestavi za", badge: "Priporočeno", razred: "prestavi", ikona: "calendarArrow" },
    payment_promised: { opis: "Načrt začasno počaka.", nastavitev: "Počakaj", badge: "Priporočeno", razred: "obljuba", ikona: "handshake" },
    partial_payment: { opis: "Vnesete preostali dolg.", nastavitev: "Preostali dolg", badge: "Privzeto", razred: "delno", ikona: "coinCheck" },
  };

  function datumZaVnos(vrednost) {
    if (!vrednost) return "";
    var datum = new Date(vrednost);
    if (Number.isNaN(datum.getTime())) return "";
    var lokalno = new Date(datum.getTime() - datum.getTimezoneOffset() * 60000);
    return lokalno.toISOString().slice(0, 16);
  }

  function datumZaPrikaz(vrednost) {
    var lokalniDatum = datumZaVnos(vrednost);
    if (!lokalniDatum) return "Izberite datum";
    var deli = lokalniDatum.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!deli) return lokalniDatum.replace("T", " ");
    return deli[3] + ". " + deli[2] + ". " + deli[1] + " · " + deli[4] + ":" + deli[5];
  }

  function izrisiDatumVnos(actionType, polje, vrednost, oznaka) {
    return '<label class="izvedba-action-sheet__datum">' +
      '<span class="izvedba-action-sheet__datum-gumb" aria-hidden="true">' +
        '<span class="izvedba-action-sheet__datum-ikona" aria-hidden="true">' + K.ikona("calendar") + '</span>' +
        '<span class="izvedba-action-sheet__datum-vrednost" data-izvedba-fit data-fit-min="9">' + K.esc(datumZaPrikaz(vrednost)) + '</span>' +
      '</span>' +
      '<span class="sr-only">' + K.esc(oznaka) + '</span>' +
      '<input type="datetime-local" class="izvedba-action-sheet__datum-prekrivni" aria-label="' + K.esc(oznaka) + '" data-action-type="' + K.esc(actionType) + '" data-datetime-polje="' + K.esc(polje) + '" value="' + K.esc(datumZaVnos(vrednost)) + '" />' +
    '</label>';
  }

  function izrisiActionSvicer() {
    var gumbi = VRSTNI_RED_KARTIC.map(function (actionType) {
      var meta = K.AKCIJE_META[actionType];
      var sheetMeta = ACTION_SHEET_META[actionType];
      var izbran = state.selectedActionType === actionType;
      return '<button type="button" class="izvedba-poravnava-svicer__gumb izvedba-poravnava-svicer__gumb--akcija-' + K.esc(sheetMeta.razred) + (izbran ? ' is-selected' : '') + '" data-action-sheet-select="' + K.esc(actionType) + '" aria-pressed="' + String(izbran) + '">' +
        '<span class="izvedba-poravnava-svicer__ikona" aria-hidden="true">' + K.ikona(sheetMeta.ikona) + '</span>' +
        '<span data-izvedba-fit data-fit-min="7">' + K.esc(meta.naslov) + '</span></button>';
    }).join('');
    return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">1</span>Izberite naslednji korak</p>' +
      '<div class="izvedba-poravnava-svicer" role="group">' + gumbi + '</div></div>';
  }

  function izrisiActionPodrobnosti() {
    var actionType = state.selectedActionType;
    if (!actionType) return "";
    var meta = K.AKCIJE_META[actionType];
    var sheetMeta = ACTION_SHEET_META[actionType];
    return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">2</span>Podatki za ta korak</p>' +
      '<div class="izvedba-poravnava-podrobnosti izvedba-poravnava-podrobnosti--akcija-' + K.esc(sheetMeta.razred) + '" data-action-type="' + K.esc(actionType) + '">' +
        '<div class="izvedba-poravnava-podrobnosti__naslov" data-izvedba-fit data-fit-min="10">' + K.esc(meta.naslov) + '</div>' +
        '<p class="izvedba-poravnava-podrobnosti__opis" data-izvedba-fit data-fit-min="8">' + K.esc(sheetMeta.opis) + '</p>' +
        podatkiZaKartico(actionType, true) +
      '</div></div>';
  }

  function izrisiPoravnavaSegment(tip, polje, moznosti, izbrana) {
    var razredSteviloMoznosti = moznosti.length === 3 ? ' izvedba-segment--tri' : '';
    return '<div class="izvedba-segment' + razredSteviloMoznosti + '" role="group">' + moznosti.map(function (moznost) {
      return '<button type="button" class="izvedba-segment__gumb' + (moznost.vrednost === izbrana ? ' is-selected' : '') + '" ' +
        'data-settlement-segment="' + K.esc(polje) + '" data-settlement-value="' + K.esc(moznost.vrednost) + '" data-settlement-type="' + K.esc(tip) + '" ' +
        'data-izvedba-fit data-fit-min="8.5" aria-pressed="' + String(moznost.vrednost === izbrana) + '">' + K.esc(moznost.oznaka) + '</button>';
    }).join('') + '</div>';
  }

  function izrisiPoravnavaDatum(tip, vrednost, oznaka, polje) {
    var imePolja = polje || "settledAt";
    return '<label class="izvedba-action-sheet__datum">' +
      '<span class="izvedba-action-sheet__datum-gumb" aria-hidden="true">' +
        '<span class="izvedba-action-sheet__datum-ikona" aria-hidden="true">' + K.ikona("calendar") + '</span>' +
        '<span class="izvedba-action-sheet__datum-vrednost" data-izvedba-fit data-fit-min="9">' + K.esc(datumZaPrikaz(vrednost)) + '</span>' +
      '</span>' +
      '<span class="sr-only">' + K.esc(oznaka) + '</span>' +
      '<input type="datetime-local" class="izvedba-action-sheet__datum-prekrivni" aria-label="' + K.esc(oznaka) + '" data-settlement-datetime="' + K.esc(imePolja) + '" data-settlement-type="' + K.esc(tip) + '" max="' + K.esc(datumZaVnos(new Date().toISOString())) + '" value="' + K.esc(datumZaVnos(vrednost)) + '" />' +
    '</label>';
  }

  function izrisiPoravnavaZnesek(tip, polje, vrednost, placeholder, pokaziUredi) {
    return '<label class="izvedba-znesek' + (pokaziUredi ? ' izvedba-znesek--urejljivo' : '') + '" data-action-control><span class="sr-only">' + K.esc(placeholder) + '</span>' +
      (pokaziUredi ? '<span class="izvedba-znesek__ikona-levo" aria-hidden="true">' + K.ikona("pencil") + '</span>' : '') +
      '<input class="izvedba-znesek__vnos" data-settlement-amount="' + K.esc(polje) + '" data-settlement-type="' + K.esc(tip) + '" data-izvedba-fit data-fit-min="9" ' +
      'type="number" inputmode="decimal" step="0.01" min="0.01" value="' + K.esc(vrednost != null ? vrednost : '') + '" placeholder="' + K.esc(placeholder) + '" />' +
      '<span class="izvedba-znesek__ikona izvedba-znesek__ikona--eur" aria-hidden="true">€</span></label>';
  }

  function izrisiZnesekSamoPrikaz(vrednost) {
    return '<div class="izvedba-znesek izvedba-znesek--samo-prikaz" aria-label="Znesek kompenzacije">' +
      '<output class="izvedba-znesek__vnos izvedba-znesek__vnos--samo-prikaz">' + K.esc(K.formatirajEur(vrednost)) + '</output>' +
      '<span class="izvedba-znesek__ikona izvedba-znesek__ikona--eur" aria-hidden="true">€</span></div>';
  }

  function izrisiPoravnavaRazlog(tip) {
    var nastavitve = state.settlementSettings[tip];
    var razlogi = [
      { vrednost: "", oznaka: "Izberite razlog" },
      { vrednost: "duplicate", oznaka: "Podvojen račun" },
      { vrednost: "incorrect", oznaka: "Napačen račun" },
      { vrednost: "agreement", oznaka: "Dogovor z dolžnikom" },
      { vrednost: "other", oznaka: "Napiši sam" },
    ];
    var izbraniRazlog = nastavitve.reason || "";
    var izbranaMoznost = razlogi.find(function (razlog) { return razlog.vrednost === izbraniRazlog; }) || razlogi[0];
    var jeOdprt = state.settlementReasonMenuOpen && state.settlementReasonMenuTip === tip;
    var moznosti = razlogi.map(function (razlog) {
      var jeIzbran = razlog.vrednost === izbraniRazlog;
      return '<button type="button" class="izvedba-poravnava__razlog-moznost' + (jeIzbran ? ' is-selected' : '') + '" role="option" aria-selected="' + String(jeIzbran) + '" data-settlement-reason-option="' + K.esc(razlog.vrednost) + '" data-settlement-type="' + K.esc(tip) + '">' +
        '<span>' + K.esc(razlog.oznaka) + '</span><span class="izvedba-poravnava__razlog-kljukica" aria-hidden="true">✓</span></button>';
    }).join("");
    var meniHtml = '<div class="izvedba-poravnava__razlog-meni" role="listbox" aria-label="Razlog"' + (jeOdprt ? '' : ' hidden') + '>' + moznosti + '</div>';
    if (izbraniRazlog === "other") {
      return '<div class="izvedba-poravnava__razlog' + (jeOdprt ? ' is-open' : '') + '">' +
        '<div class="izvedba-poravnava__razlog-sprozi izvedba-poravnava__razlog-sprozi--lastno">' +
          '<textarea class="izvedba-poravnava__razlog-lastno-vnos" data-settlement-custom-reason data-settlement-type="' + K.esc(tip) + '" rows="1" placeholder="Napišite razlog" aria-label="Vaš razlog">' + K.esc(nastavitve.customReason || "") + '</textarea>' +
          '<button type="button" class="izvedba-poravnava__razlog-menjaj" data-settlement-reason-toggle data-settlement-type="' + K.esc(tip) + '" aria-haspopup="listbox" aria-expanded="' + String(jeOdprt) + '" aria-label="Izberite drug razlog"><span class="izvedba-poravnava__razlog-puscica" aria-hidden="true"></span></button>' +
        '</div>' + meniHtml + '</div>';
    }
    return '<div class="izvedba-poravnava__razlog' + (jeOdprt ? ' is-open' : '') + '">' +
      '<button type="button" class="izvedba-poravnava__razlog-sprozi" data-settlement-reason-toggle data-settlement-type="' + K.esc(tip) + '" aria-haspopup="listbox" aria-expanded="' + String(jeOdprt) + '">' +
        '<span data-izvedba-fit data-fit-min="9">' + K.esc(izbranaMoznost.oznaka) + '</span><span class="izvedba-poravnava__razlog-puscica" aria-hidden="true"></span></button>' +
      meniHtml + '</div>';
  }

  function izrisiPoravnavaDatumSegment(tip) {
    var nastavitve = state.settlementSettings[tip];
    var jeDatumIzbran = nastavitve.dateMode === "custom";
    var danesGumb = '<button type="button" class="izvedba-segment__gumb' + (jeDatumIzbran ? '' : ' is-selected') + '" ' +
      'data-settlement-segment="dateMode" data-settlement-value="today" data-settlement-type="' + K.esc(tip) + '" ' +
      'data-izvedba-fit data-fit-min="8.5" aria-pressed="' + String(!jeDatumIzbran) + '">Danes</button>';
    var datumOznaka = jeDatumIzbran ? datumZaPrikaz(nastavitve.settledAt) : "Datum";
    var datumGumb = '<label class="izvedba-segment__gumb izvedba-segment__gumb--datum' + (jeDatumIzbran ? ' is-selected' : '') + '">' +
      '<span data-izvedba-fit data-fit-min="8.5">' + K.esc(datumOznaka) + '</span>' +
      '<input type="datetime-local" class="izvedba-segment__datum-prekrivni" aria-label="Datum zaključka" ' +
        'data-settlement-datetime="settledAt" data-settlement-type="' + K.esc(tip) + '" data-settlement-datum-segment ' +
        'max="' + K.esc(datumZaVnos(new Date().toISOString())) + '" value="' + K.esc(datumZaVnos(nastavitve.settledAt || new Date().toISOString())) + '" />' +
    '</label>';
    return '<div class="izvedba-segment" role="group">' + danesGumb + datumGumb + '</div>';
  }

  function izrisiZnesekZaZakljucek(tip, izbrano, placeholder) {
    var nastavitve = state.settlementSettings[tip];
    if (!nastavitve.rocnoUrejeno) nastavitve.settlementAmount = preostaliDolgPoNacrtu();
    var znesekPolje = izrisiPoravnavaZnesek(tip, "settlementAmount", nastavitve.settlementAmount, placeholder, true);
    var jePolniZnesek = Math.abs((Number(nastavitve.settlementAmount) || 0) - preostaliDolgPoNacrtu()) <= 0.009;
    var namig = jePolniZnesek
      ? "Pokriva celoten preostali dolg — primer se bo zaprl."
      : "Manjši znesek od preostanka — primer ostane odprt.";
    return znesekPolje +
      (izbrano ? '<p class="izvedba-poravnava__namig" data-izvedba-fit data-fit-min="7">' + K.esc(namig) + '</p>' : '');
  }

  function izrisiPoravnavaKontrolnik(tip, izbrano) {
    var nastavitve = state.settlementSettings[tip];
    if (tip === "full") {
      return izrisiPoravnavaDatumSegment(tip);
    }
    if (tip === "compensation") {
      var zneskKompenzacije = preostaliDolgPoNacrtu();
      return izrisiPoravnavaDatumSegment(tip) + izrisiZnesekSamoPrikaz(zneskKompenzacije) +
        (izbrano ? '<p class="izvedba-poravnava__namig" data-izvedba-fit data-fit-min="7">Pokriva celoten preostali dolg — primer se bo zaprl.</p>' : '');
    }
    if (tip === "partial" || tip === "installment") {
      var kindSegment = izrisiPoravnavaSegment(tip, "kind", [
        { vrednost: "cash", oznaka: "Denar" },
        { vrednost: "credit", oznaka: "Dobropis" },
        { vrednost: "writeoff", oznaka: "Odpust" },
      ], nastavitve.kind || "cash");
      var znesekPolje = izrisiPoravnavaZnesek(tip, "paymentAmount", nastavitve.paymentAmount, "Vnesite znesek");
      var datumPolje = izrisiPoravnavaDatum(tip, nastavitve.datumKoraka || new Date().toISOString(), "Datum koraka", "datumKoraka");
      var razlogPolje = izbrano && nastavitve.kind === "writeoff" ? izrisiPoravnavaRazlog(tip) : "";
      var oznakaKoraka = '<p class="izvedba-poravnava__korak-oznaka">' + naslednjaStevilkaKoraka(tip) + '. ' + K.esc(BESEDA_ZAPOREDNEGA_KORAKA[tip] || "korak") + '</p>';
      return kindSegment + oznakaKoraka + '<div class="izvedba-poravnava-znesek-datum">' + znesekPolje + datumPolje + '</div>' + razlogPolje;
    }
    if (tip === "credit_note") {
      return izrisiZnesekZaZakljucek(tip, izbrano, "Vnesite znesek dobropisa");
    }
    return izrisiPoravnavaRazlog(tip);
  }

  function izrisiPoravnavaSvicer() {
    var zaprt = jeNacrtZaprt();
    var gumbi = SETTLEMENT_ORDER.map(function (tip) {
      var meta = SETTLEMENT_META[tip];
      var izbran = state.selectedSettlementType === tip;
      return '<button type="button" class="izvedba-poravnava-svicer__gumb izvedba-poravnava-svicer__gumb--' + K.esc(meta.razred) + (izbran ? ' is-selected' : '') + '" data-settlement-select="' + K.esc(tip) + '" aria-pressed="' + String(izbran) + '" ' + (zaprt ? 'disabled' : '') + '>' +
        '<span class="izvedba-poravnava-svicer__ikona" aria-hidden="true">' + K.ikona(meta.ikona) + '</span>' +
        '<span data-izvedba-fit data-fit-min="7">' + K.esc(meta.naslov) + '</span></button>';
    }).join('');
    return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">1</span>Izberite naslednji korak</p>' +
      '<div class="izvedba-poravnava-svicer" role="group">' + gumbi + '</div></div>';
  }

  function izrisiPoravnavaPodrobnosti() {
    var tip = state.selectedSettlementType;
    var meta = SETTLEMENT_META[tip];
    if (!meta) {
      return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">2</span>Podatki za ta korak</p>' +
        '<p class="izvedba-poravnava-potek__prazno">Najprej izberite korak zgoraj.</p></div>';
    }
    var zaprt = jeNacrtZaprt();
    var vsebinaKoraka = zaprt
      ? '<p class="izvedba-poravnava__namig">Ta korak zapre primer — po njem ni mogoče dodati novega koraka. Odstranite ga zgoraj v "Potek primera", če želite izbrati drugega.</p>'
      : izrisiPoravnavaKontrolnik(tip, true) + '<button type="button" class="izvedba-poravnava-dodaj-korak" data-nacrt-dodaj>+ Dodaj korak</button>';
    return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">2</span>Podatki za ta korak</p>' +
      '<div class="izvedba-poravnava-podrobnosti izvedba-poravnava-podrobnosti--' + K.esc(meta.razred) + '">' +
        '<div class="izvedba-poravnava-podrobnosti__naslov" data-izvedba-fit data-fit-min="10">' + K.esc(meta.naslov) + '</div>' +
        '<p class="izvedba-poravnava-podrobnosti__opis" data-izvedba-fit data-fit-min="8">' + K.esc(meta.opis) + '</p>' +
        vsebinaKoraka +
      '</div></div>';
  }

  function opisUkrepaZaZgodovino(ukrep) {
    var nastavitve = ukrep.settings || {};
    if (ukrep.action_type === "partial_payment") {
      var jeObrok = nastavitve.settlementType === "installment";
      return { naslov: jeObrok ? "Obrok" : "Delno plačilo", znesek: Number(nastavitve.paymentAmount) || 0, ikona: "coinCheck", razred: jeObrok ? "installment" : "partial" };
    }
    if (ukrep.action_type === "partial_settlement") {
      var jeOdpust = nastavitve.kind === "writeoff";
      return { naslov: jeOdpust ? "Odpust" : "Dobropis", znesek: Number(nastavitve.amount) || 0, ikona: jeOdpust ? "documentX" : "tag", razred: jeOdpust ? "cancelled_invoice" : "credit_note" };
    }
    if (ukrep.action_type === "paid_in_full") {
      var vrsta = nastavitve.settlementType || "full";
      var metaZakljucka = SETTLEMENT_META[vrsta] || SETTLEMENT_META.full;
      return { naslov: metaZakljucka.naslov, znesek: vrsta === "credit_note" ? Number(nastavitve.settlementAmount) || 0 : null, ikona: metaZakljucka.ikona, razred: vrsta };
    }
    if (ukrep.action_type === "skip_current_step") {
      return { naslov: "Korak preklican", znesek: null, ikona: "messageX", razred: "preklic" };
    }
    if (ukrep.action_type === "stop_plan") {
      return { naslov: "Načrt ustavljen", znesek: null, ikona: "stopCircle", razred: "ustavi" };
    }
    if (ukrep.action_type === "handoff_to_lawyer") {
      return { naslov: "Predano odvetniku", znesek: null, ikona: "scales", razred: "odvetnik" };
    }
    if (ukrep.action_type === "postpone_reminder") {
      return { naslov: "Opomin prestavljen", znesek: null, ikona: "calendarArrow", razred: "prestavi" };
    }
    if (ukrep.action_type === "payment_promised") {
      return { naslov: "Plačilo obljubljeno", znesek: null, ikona: "handshake", razred: "obljuba" };
    }
    return null;
  }

  function izrisiPotekPrimera() {
    var obstojeciKronolosko = (state.ukrepi || [])
      .filter(function (u) { return u.status === "completed"; })
      .map(function (u) {
        var opis = opisUkrepaZaZgodovino(u);
        return opis ? Object.assign({ datum: u.completed_at, jeNacrtovan: false, actionId: u.action_id, actionType: u.action_type }, opis) : null;
      })
      .filter(Boolean);
    var nacrtovani = (state.nacrtKoraki || []).map(function (korak) {
      return { naslov: korak.naslov, znesek: korak.znesek, ikona: korak.ikona, razred: korak.razred, datum: korak.datum, jeNacrtovan: true };
    });
    var stevciPoTipu = {};
    obstojeciKronolosko.concat(nacrtovani).forEach(function (korak) {
      var skupina = korak.razred === "obrok" || korak.razred === "installment" ? "installment"
        : korak.razred === "delno" || korak.razred === "partial" ? "partial" : null;
      if (skupina && korak.znesek != null) {
        stevciPoTipu[skupina] = (stevciPoTipu[skupina] || 0) + 1;
        korak.zaporednaStevilka = stevciPoTipu[skupina];
        korak.zaporednaSkupina = skupina;
      }
    });
    var seznam = obstojeciKronolosko.slice().reverse().concat(nacrtovani);
    var prvotniZnesek = Number(state.zadeva && state.zadeva.prvotniZnesek) || 0;
    var indeksNacrtovanega = -1;
    var vrstice = !seznam.length
      ? '<p class="izvedba-poravnava-potek__prazno">Ni še zabeleženih korakov.</p>'
      : seznam.map(function (korak, i) {
      if (korak.jeNacrtovan) indeksNacrtovanega += 1;
      var jeRazveljivUkrep = !korak.jeNacrtovan && ["partial_payment", "partial_settlement", "payment_promised", "stop_plan"].indexOf(korak.actionType) >= 0;
      var odstraniGumb = korak.jeNacrtovan
        ? '<button type="button" class="izvedba-poravnava-korak__odstrani" data-nacrt-odstrani="' + indeksNacrtovanega + '" aria-label="Odstrani korak">×</button>'
        : jeRazveljivUkrep
          ? '<button type="button" class="izvedba-poravnava-korak__odstrani" data-ukrep-odstrani="' + K.esc(korak.actionId) + '" data-ukrep-tip="' + K.esc(korak.actionType) + '" aria-label="Odstrani izvedeni korak">×</button>'
          : '<span class="izvedba-poravnava-korak__izveden" aria-label="Korak je že izveden" title="Že izvedeno">✓</span>';
      var metaVsebina = (korak.jeNacrtovan ? '<span class="izvedba-poravnava-korak__pill">Korak ' + (i + 1) + '</span>' : '') +
        '<span class="izvedba-poravnava-korak__info-datum">' + K.esc(K.formatirajDatumUro(korak.datum)) + '</span>';
      var znesekVsebina;
      if (korak.znesek != null) {
        var znesekOznaka = korak.zaporednaStevilka
          ? '<span class="izvedba-poravnava-korak__znesek-oznaka">' + korak.zaporednaStevilka + '. ' + K.esc(BESEDA_ZAPOREDNEGA_KORAKA[korak.zaporednaSkupina]) + '</span>'
          : "";
        znesekVsebina = '<span class="izvedba-poravnava-korak__znesek-blok">' + znesekOznaka + '<span class="izvedba-poravnava-korak__znesek">' + K.esc(K.formatirajEur(korak.znesek)) + '</span></span>';
      } else {
        znesekVsebina = '<span></span>';
      }
      return '<div class="izvedba-poravnava-korak izvedba-poravnava-korak--' + K.esc(korak.razred) + (korak.jeNacrtovan ? ' izvedba-poravnava-korak--nacrtovan' : '') + '">' +
        '<span class="izvedba-poravnava-korak__stevilka" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="izvedba-poravnava-korak__ikona" aria-hidden="true">' + K.ikona(korak.ikona) + '</span>' +
        '<span class="izvedba-poravnava-korak__info"><b data-izvedba-fit data-fit-min="8">' + K.esc(korak.naslov) + '</b><span class="izvedba-poravnava-korak__info-meta">' + metaVsebina + '</span></span>' +
        znesekVsebina +
        odstraniGumb +
      '</div>';
    }).join('');
    return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">3</span>Potek primera' +
      '<span class="izvedba-poravnava-cona__stevilo-korakov">' + seznam.length + ' ' + K.esc(besedaZaSteviloKorakov(seznam.length)) + '</span></p>' +
      '<div class="izvedba-potek-zneski">' +
        '<div class="izvedba-potek-zneski__stolpec">' +
          '<span class="izvedba-potek-zneski__oznaka">Originalni znesek</span>' +
          '<span class="izvedba-potek-zneski__vrednost">' + K.esc(K.formatirajEur(prvotniZnesek)) + '</span>' +
        '</div>' +
        '<div class="izvedba-potek-zneski__locilo" aria-hidden="true"></div>' +
        '<div class="izvedba-potek-zneski__stolpec izvedba-potek-zneski__stolpec--preostanek">' +
          '<span class="izvedba-potek-zneski__oznaka">Preostali znesek</span>' +
          '<span class="izvedba-potek-zneski__vrednost">' + K.esc(K.formatirajEur(preostaliDolgPoNacrtu())) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="izvedba-poravnava-potek">' + vrstice + '</div></div>';
  }

  function pozicijaTrenutnegaOpomina() {
    var korakiPlana = ((state.plan && state.plan.steps) || []).filter(function (step) {
      return step && !step.isExcluded;
    });
    var indeks = korakiPlana.findIndex(function (step, polozaj) {
      return String(step.stepId || step.id || ("step-" + (polozaj + 1))) === String(state.currentStepId);
    });
    return indeks >= 0 ? indeks + 1 : korakiPlana.length || 1;
  }

  function sestaviPripovedPovzetka() {
    var pozicija = pozicijaTrenutnegaOpomina();
    var zadeva = state.zadeva || {};
    var imeDolznika = String(zadeva.imeDolznika || "Dolžnik").trim();
    var znesekDolga = trenutniPreostaliDolg();
    var steviloKorakov = (state.nacrtKoraki || []).length;
    var datumDogovora = state.poravnavaDogovorAt || new Date().toISOString();
    var datumPrikaz = new Intl.DateTimeFormat("sl-SI", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).format(new Date(datumDogovora));
    var opisKorakov = steviloKorakov === 1
      ? "naslednji način poravnave"
      : "naslednje načine poravnave";
    return '<div class="izvedba-poravnava-pripoved">' +
      '<div class="izvedba-poravnava-pripoved__glava">' +
        '<span class="izvedba-poravnava-pripoved__ikona" aria-hidden="true">' + K.ikona("handshake") + '</span>' +
        '<span class="izvedba-poravnava-pripoved__oznaka">Dogovor z dolžnikom</span>' +
        '<span class="izvedba-poravnava-pripoved__datum">' + K.esc(datumPrikaz) + '</span>' +
      '</div>' +
      '<div class="izvedba-poravnava-pripoved__besedilo">' +
        '<p><b>' + K.esc(imeDolznika) + '</b> dolga v višini <b>' + K.esc(K.formatirajEur(znesekDolga)) + '</b> ni poravnal. Po <b>' + K.esc(String(pozicija)) + '. opominu</b> je pristal na ' + K.esc(opisKorakov) + ':</p>' +
      '</div>' +
    '</div>';
  }

  function izrisiKorakiPovzetka() {
    var seznam = state.nacrtKoraki || [];
    var vrstice = seznam.map(function (korak, i) {
      var razsirjen = state.razsirjenKorakPovzetka === i;
      var podrobnosti = '';
      if (korak.settings) {
        if (korak.settings.paymentAmount != null) podrobnosti += 'Prejeti znesek: ' + K.formatirajEur(korak.settings.paymentAmount) + '<br>';
        if (korak.settings.kind === "writeoff" && korak.settings.reason) podrobnosti += 'Razlog: ' + K.esc(korak.settings.reason) + '<br>';
      }
      podrobnosti += 'Datum: ' + K.esc(K.formatirajDatumUro(korak.datum)) + '<br>';
      var znesekVsebina = korak.znesek != null
        ? '<span class="izvedba-poravnava-korak__znesek-blok"><span class="izvedba-poravnava-korak__znesek">' + K.esc(K.formatirajEur(korak.znesek)) + '</span></span>'
        : '<span></span>';
      return '<div class="izvedba-poravnava-korak izvedba-poravnava-korak--' + K.esc(korak.razred) + '">' +
        '<span class="izvedba-poravnava-korak__stevilka" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="izvedba-poravnava-korak__ikona" aria-hidden="true">' + K.ikona(korak.ikona) + '</span>' +
        '<span class="izvedba-poravnava-korak__info"><b data-izvedba-fit data-fit-min="8">' + K.esc(korak.naslov) + '</b><span class="izvedba-poravnava-korak__info-meta"><span class="izvedba-poravnava-korak__info-datum">' + (i + 1) + '. korak · ' + K.esc(K.formatirajDatumUro(korak.datum)) + '</span></span></span>' +
        znesekVsebina +
        '<span class="izvedba-poravnava-korak__akcije">' +
          '<button type="button" class="izvedba-poravnava-korak__razsiri' + (razsirjen ? ' is-razsirjen' : '') + '" data-povzetek-korak-razsiri="' + i + '" aria-label="Podrobnosti koraka" aria-expanded="' + String(razsirjen) + '">' + K.ikona("chevron") + '</button>' +
          '<button type="button" class="izvedba-poravnava-korak__odstrani" data-nacrt-odstrani="' + i + '" aria-label="Odstrani korak iz osnutka">×</button>' +
        '</span>' +
        (razsirjen ? '<div class="izvedba-poravnava-korak__podrobnosti">' + podrobnosti + '</div>' : '') +
      '</div>';
    }).join('');
    return '<div class="izvedba-povzetek-cona"><p class="izvedba-povzetek-cona__naslov">Koraki plačilnega načrta</p>' +
      '<div class="izvedba-poravnava-potek izvedba-poravnava-potek--povzetek">' + vrstice + '</div></div>';
  }

  function izrisiKanaliPosiljanja() {
    var imaTel = Boolean(state.zadeva && state.zadeva.telefonDolznika);
    var imaEmail = Boolean(state.zadeva && state.zadeva.emailDolznika);
    var smsVrednost = imaTel ? K.esc(state.zadeva.telefonDolznika) : "Ni številke";
    var emailVrednost = imaEmail ? K.esc(state.zadeva.emailDolznika) : "Ni naslova";
    return '<div class="izvedba-povzetek-kanali">' +
      '<button type="button" class="izvedba-povzetek-kanal' + (state.kanaliPosiljanja.sms ? ' is-selected' : '') + '" data-povzetek-kanal="sms" aria-pressed="' + String(state.kanaliPosiljanja.sms) + '" ' + (imaTel ? '' : 'disabled title="Dolžnik nima telefonske številke."') + '>' +
        '<span class="izvedba-povzetek-kanal__kljukica" aria-hidden="true">' + K.ikona("checkCircle") + '</span>' +
        '<span class="izvedba-povzetek-kanal__besedilo"><span class="izvedba-povzetek-kanal__oznaka">SMS</span><span class="izvedba-povzetek-kanal__vrednost">' + smsVrednost + '</span></span>' +
      '</button>' +
      '<button type="button" class="izvedba-povzetek-kanal' + (state.kanaliPosiljanja.email ? ' is-selected' : '') + '" data-povzetek-kanal="email" aria-pressed="' + String(state.kanaliPosiljanja.email) + '" ' + (imaEmail ? '' : 'disabled title="Dolžnik nima e-poštnega naslova."') + '>' +
        '<span class="izvedba-povzetek-kanal__kljukica" aria-hidden="true">' + K.ikona("checkCircle") + '</span>' +
        '<span class="izvedba-povzetek-kanal__besedilo"><span class="izvedba-povzetek-kanal__oznaka">E-pošta</span><span class="izvedba-povzetek-kanal__vrednost">' + emailVrednost + '</span></span>' +
      '</button>' +
    '</div>';
  }

  var DOKUMENT_NASLOV = { placano: "Potrdilo o plačilu", delno: "Račun", kompenzacija: "Potrdilo o kompenzaciji", obrok: "Račun", dobropis: "Dobropis", storno: "Dobropis" };

  function pripraviDokumenteZaPredogled() {
    var preostanek = trenutniPreostaliDolg();
    return (state.nacrtKoraki || []).map(function (korak, i) {
      var pred = preostanek;
      var po = korak.znesek != null ? Math.max(0, preostanek - korak.znesek) : preostanek;
      preostanek = po;
      return {
        naslov: DOKUMENT_NASLOV[korak.razred] || "Dokument",
        stevilka: (state.zadeva && state.zadeva.stevilkaRacuna ? state.zadeva.stevilkaRacuna : "—") + "/" + (i + 1),
        datum: korak.datum,
        korakNaslov: korak.naslov,
        znesek: korak.znesek,
        pred: pred,
        po: po,
        razred: korak.razred,
      };
    });
  }

  function izrisiPredogledRacunov() {
    var dokumenti = pripraviDokumenteZaPredogled();
    if (!dokumenti.length) return "";
    var i = Math.min(state.aktivenDokument || 0, dokumenti.length - 1);
    var dok = dokumenti[i];
    var prodajalec = state.prodajalec;
    var glavaProdajalca = prodajalec
      ? K.esc(prodajalec.imePodjetja || "") + (prodajalec.naslov ? '<br>' + K.esc(prodajalec.naslov) : '') + (prodajalec.mesto ? ', ' + K.esc(prodajalec.mesto) : '')
      : '<span class="izvedba-poravnava__namig">Podatki podjetja še niso nastavljeni.</span>';
    var zavihki = dokumenti.length > 1
      ? '<div class="izvedba-povzetek-zavihki">' + dokumenti.map(function (d, di) {
          return '<button type="button" class="izvedba-povzetek-zavihek' + (di === i ? ' is-selected' : '') + '" data-povzetek-dokument="' + di + '">' + (di + 1) + '. ' + K.esc(d.naslov.toLowerCase()) + '</button>';
        }).join('') + '</div>'
      : '';
    return '<div class="izvedba-povzetek-racun-kartica">' +
      '<div class="izvedba-povzetek-racun-glava"><span class="izvedba-povzetek-racun-ikona" aria-hidden="true">' + K.ikona("receiptCheck") + '</span><span>Predogled računov</span><span class="izvedba-povzetek-racun-stevec">' + dokumenti.length + '</span><span class="izvedba-povzetek-racun-chevron" aria-hidden="true">' + K.ikona("chevron") + '</span></div>' +
      '<div class="izvedba-povzetek-racun-telo">' +
        zavihki +
        '<div class="izvedba-povzetek-dokument">' +
          '<div class="izvedba-povzetek-dokument__vrstica"><span>' + glavaProdajalca + '</span><span class="izvedba-povzetek-dokument__desno">' + K.esc(dok.naslov) + ' št. ' + K.esc(dok.stevilka) + '<br>Datum: ' + K.esc(K.formatirajDatumUro(dok.datum)) + '</span></div>' +
          '<div class="izvedba-povzetek-dokument__postavke">' +
            '<div class="izvedba-povzetek-dokument__vrstica"><span>Znesek pred korakom</span><span>' + K.esc(K.formatirajEur(dok.pred)) + '</span></div>' +
            '<div class="izvedba-povzetek-dokument__vrstica izvedba-povzetek-dokument__vrstica--' + K.esc(dok.razred) + '"><span>' + K.esc(dok.korakNaslov) + '</span><span>' + (dok.znesek != null ? '−' + K.esc(K.formatirajEur(dok.znesek)) : '—') + '</span></div>' +
          '</div>' +
          '<div class="izvedba-povzetek-dokument__skupaj"><span>' + (dok.po <= 0 ? 'Za plačilo' : 'Preostanek') + '</span><span>' + K.esc(K.formatirajEur(dok.po)) + '</span></div>' +
          '<button type="button" class="izvedba-poravnava-dodaj-korak" data-povzetek-poglej="' + i + '">Preglej celoten račun</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function izrisiPoravnavaPolniRacun() {
    var dokumenti = pripraviDokumenteZaPredogled();
    var i = Math.min(state.pregledDokumenta || 0, Math.max(0, dokumenti.length - 1));
    var dok = dokumenti[i];
    var prodajalec = state.prodajalec;
    elActionSheet.hidden = false;
    elActionSheet.innerHTML = '<div class="izvedba-action-sheet__backdrop" data-action-sheet-close></div>' +
      '<section class="izvedba-action-sheet__panel izvedba-action-sheet__panel--poravnano izvedba-action-sheet__panel--poravnava-' + K.esc(dok ? dok.razred : "placano") + '" role="dialog" aria-modal="true" aria-labelledby="izvedba-action-sheet-title">' +
        '<div class="izvedba-action-sheet__rocaj" aria-hidden="true"></div>' +
        '<header class="izvedba-action-sheet__header izvedba-action-sheet__header--povzetek">' +
          '<button type="button" class="izvedba-action-sheet__nazaj-puscica" data-povzetek-nazaj aria-label="Nazaj na povzetek"><span class="izvedba-action-sheet__nazaj-ikona" aria-hidden="true">' + K.ikona("chevron") + '</span></button>' +
          '<h2 id="izvedba-action-sheet-title" data-izvedba-fit data-fit-min="14">' + (dok ? K.esc(dok.naslov) + ' ' + K.esc(dok.stevilka) : "Dokument") + '</h2>' +
        '</header>' +
        '<div class="izvedba-action-sheet__scroll"><div class="izvedba-pdf-list">' + (dok ? '' +
          '<div class="izvedba-pdf">' +
            '<div class="izvedba-pdf__glava">' +
              '<div>' + (prodajalec ? '<b>' + K.esc(prodajalec.imePodjetja || "") + '</b><br>' + K.esc(prodajalec.naslov || "") + (prodajalec.posta || prodajalec.mesto ? '<br>' + K.esc((prodajalec.posta || "") + " " + (prodajalec.mesto || "")) : "") + (prodajalec.davcnaStevilka ? '<br>DŠ: ' + K.esc(prodajalec.davcnaStevilka) : "") + (prodajalec.iban ? '<br>IBAN: ' + K.esc(prodajalec.iban) : "") : 'Podatki podjetja še niso nastavljeni.') + '</div>' +
              '<div class="izvedba-pdf__glava-desno"><b>' + K.esc(dok.naslov) + ' št. ' + K.esc(dok.stevilka) + '</b><br>Izdano: ' + K.esc(K.formatirajDatumUro(dok.datum)) + '</div>' +
            '</div>' +
            '<div class="izvedba-pdf__kupec"><b>Kupec:</b> ' + K.esc((state.zadeva && state.zadeva.imeDolznika) || "") + (state.zadeva && state.zadeva.opisDolga ? '<br>Opis: ' + K.esc(state.zadeva.opisDolga) : '') + '</div>' +
            '<table class="izvedba-pdf__tabela"><tr><th>Postavka</th><th>Znesek</th></tr>' +
              '<tr><td>Znesek pred korakom</td><td>' + K.esc(K.formatirajEur(dok.pred)) + '</td></tr>' +
              '<tr><td>' + K.esc(dok.korakNaslov) + ' · ' + K.esc(K.formatirajDatumUro(dok.datum)) + '</td><td>' + (dok.znesek != null ? '−' + K.esc(K.formatirajEur(dok.znesek)) : '—') + '</td></tr>' +
            '</table>' +
            '<div class="izvedba-pdf__skupaj"><span>' + (dok.po <= 0 ? 'Za plačilo' : 'Preostanek') + '</span><span>' + K.esc(K.formatirajEur(dok.po)) + '</span></div>' +
          '</div>'
        : '<p>Dokument ni na voljo.</p>') + '</div></div>' +
      '</section>';
    zakleniOzadjeSheeta();
  }

  function izrisiPoravnavaPovzetek() {
    var steviloNacrtovanih = (state.nacrtKoraki || []).length;
    var dejanje = '<button type="button" class="izvedba-action-sheet__dejanje" data-action-sheet-confirm data-izvedba-fit data-fit-min="10" ' + (state.isSubmitting || steviloNacrtovanih === 0 ? 'disabled' : '') + '>' +
      (state.isSubmitting ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span>' : '') + 'Potrdi in pošlji' + '</button>';
    elActionSheet.hidden = false;
    elActionSheet.innerHTML = '<div class="izvedba-action-sheet__backdrop" data-action-sheet-close></div>' +
      '<section class="izvedba-action-sheet__panel izvedba-action-sheet__panel--poravnano" role="dialog" aria-modal="true" aria-labelledby="izvedba-action-sheet-title">' +
        '<div class="izvedba-action-sheet__rocaj" aria-hidden="true"></div>' +
        '<header class="izvedba-action-sheet__header izvedba-action-sheet__header--povzetek">' +
          '<button type="button" class="izvedba-action-sheet__nazaj-puscica" data-povzetek-nazaj aria-label="Nazaj na izbiro koraka"><span class="izvedba-action-sheet__nazaj-ikona" aria-hidden="true">' + K.ikona("chevron") + '</span></button>' +
          '<h2 id="izvedba-action-sheet-title" data-izvedba-fit data-fit-min="14">Povzetek načrta</h2>' +
          '<button type="button" class="izvedba-action-sheet__zapri" data-action-sheet-close aria-label="Zapri"><span aria-hidden="true">×</span></button>' +
        '</header>' +
        '<div class="izvedba-action-sheet__scroll">' +
          sestaviPripovedPovzetka() +
          izrisiKorakiPovzetka() +
          izrisiKanaliPosiljanja() +
          izrisiPredogledRacunov() +
          '<div class="izvedba-action-sheet__footer">' + (state.error ? '<p class="izvedba-action-sheet__napaka" role="alert">' + K.esc(state.error) + '</p>' : '') +
            dejanje + '</div></div></section>';
    zakleniOzadjeSheeta();
    requestAnimationFrame(function () { prilagodiBesediloOmejenemuPolju(elActionSheet); });
  }

  function izrisiPoravnavaSheet() {
    if (state.pregledDokumenta != null) {
      izrisiPoravnavaPolniRacun();
      return;
    }
    if (state.actionSheetStep === "povzetek") {
      izrisiPoravnavaPovzetek();
      return;
    }
    var meta = SETTLEMENT_META[state.selectedSettlementType];
    var steviloNacrtovanih = (state.nacrtKoraki || []).length;
    var dejanje = meta ? '<button type="button" class="izvedba-action-sheet__dejanje" data-action-sheet-confirm data-izvedba-fit data-fit-min="10" ' + (state.isSubmitting || steviloNacrtovanih === 0 ? 'disabled' : '') + '>' +
      (state.isSubmitting ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span>' : '') + 'Potrdi' + '</button>' : '';
    elActionSheet.hidden = false;
    elActionSheet.innerHTML = '<div class="izvedba-action-sheet__backdrop" data-action-sheet-close></div>' +
      '<section class="izvedba-action-sheet__panel izvedba-action-sheet__panel--poravnano' + (meta ? ' izvedba-action-sheet__panel--poravnava-' + K.esc(meta.razred) : '') + '" role="dialog" aria-modal="true" aria-labelledby="izvedba-action-sheet-title">' +
        '<div class="izvedba-action-sheet__rocaj" aria-hidden="true"></div>' +
        '<header class="izvedba-action-sheet__header"><span class="izvedba-action-sheet__header-ikona" aria-hidden="true">' + K.ikona("checkCircle") + '</span><div>' +
          '<h2 id="izvedba-action-sheet-title" data-izvedba-fit data-fit-min="14">Kako je bil račun poravnan?</h2><p>Izberite način in po potrebi dopolnite podatke.</p></div>' +
          '<button type="button" class="izvedba-action-sheet__zapri" data-action-sheet-close aria-label="Zapri"><span aria-hidden="true">×</span></button></header>' +
        '<div class="izvedba-action-sheet__scroll">' + izrisiPoravnavaSvicer() + izrisiPoravnavaPodrobnosti() + izrisiPotekPrimera() +
          '<div class="izvedba-action-sheet__footer">' + (state.error ? '<p class="izvedba-action-sheet__napaka" role="alert">' + K.esc(state.error) + '</p>' : '') +
            dejanje + '</div></div></section>';
    zakleniOzadjeSheeta();
    requestAnimationFrame(function () {
      prilagodiBesediloOmejenemuPolju(elActionSheet);
      var lastnoBesediloPolje = elActionSheet.querySelector("[data-settlement-custom-reason]");
      if (lastnoBesediloPolje) {
        lastnoBesediloPolje.style.height = "auto";
        lastnoBesediloPolje.style.height = lastnoBesediloPolje.scrollHeight + "px";
      }
    });
  }

  function izrisiActionSheet() {
    if (!elActionSheet) return;
    if (!state.actionSheetOpen) {
      elActionSheet.hidden = true;
      elActionSheet.innerHTML = "";
      odkleniOzadjeSheeta();
      return;
    }
    if (state.actionSheetMode === "payment") {
      izrisiPoravnavaSheet();
      return;
    }
    var panelRazred = state.selectedActionType ? " izvedba-action-sheet__panel--" + ACTION_SHEET_META[state.selectedActionType].razred : "";
    var dejanje = state.selectedActionType
      ? '<button type="button" class="izvedba-action-sheet__dejanje" data-action-sheet-confirm data-izvedba-fit data-fit-min="10" ' + (state.isSubmitting ? 'disabled' : '') + '>' +
          (state.isSubmitting ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span>' : '') + K.esc(besediloGlavnegaGumba()) + '</button>'
      : "";
    elActionSheet.hidden = false;
    elActionSheet.innerHTML = '<div class="izvedba-action-sheet__backdrop" data-action-sheet-close></div>' +
      '<section class="izvedba-action-sheet__panel izvedba-action-sheet__panel--akcije' + panelRazred + '" role="dialog" aria-modal="true" aria-labelledby="izvedba-action-sheet-title">' +
        '<div class="izvedba-action-sheet__rocaj" aria-hidden="true"></div>' +
        '<header class="izvedba-action-sheet__header"><span class="izvedba-action-sheet__header-ikona" aria-hidden="true">' + K.ikona("xCircle") + '</span><div>' +
          '<h2 id="izvedba-action-sheet-title">Kaj želite narediti?</h2><p>Izberite možnost in po potrebi prilagodite priporočeno nastavitev.</p></div>' +
          '<button type="button" class="izvedba-action-sheet__zapri" data-action-sheet-close aria-label="Zapri"><span aria-hidden="true">×</span></button></header>' +
        '<div class="izvedba-action-sheet__scroll">' + izrisiActionSvicer() + izrisiActionPodrobnosti() + izrisiPotekPrimera() +
          '<div class="izvedba-action-sheet__footer">' +
            (state.error ? '<p class="izvedba-action-sheet__napaka" role="alert">' + K.esc(state.error) + '</p>' : '') +
            dejanje + '<button type="button" class="izvedba-action-sheet__nazaj" data-action-sheet-close>Nazaj</button>' +
          '</div>' +
        '</div>' +
      '</section>';
    zakleniOzadjeSheeta();
    requestAnimationFrame(function () { prilagodiBesediloOmejenemuPolju(elActionSheet); });
  }

  function odpriActionSheet() {
    if (state.isSubmitting) return;
    actionSheetReturnFocus = document.activeElement;
    state.actionSheetMode = "actions";
    state.selectedActionType = null;
    state.error = null;
    state.actionSheetOpen = true;
    izrisiSticky();
    izrisiActionSheet();
    requestAnimationFrame(function () {
      var prvi = elActionSheet && elActionSheet.querySelector("[data-action-sheet-select]");
      if (prvi) prvi.focus({ preventScroll: true });
    });
  }

  function zapriActionSheet() {
    if (state.actionSheetMode === "payment") ponastaviOsnutekPoravnave();
    state.actionSheetOpen = false;
    state.selectedActionType = null;
    state.selectedSettlementType = null;
    state.settlementReasonMenuOpen = false;
    state.error = null;
    izrisiActionSheet();
    izrisiSticky();
    if (actionSheetReturnFocus && typeof actionSheetReturnFocus.focus === "function") {
      actionSheetReturnFocus.focus({ preventScroll: true });
    }
    actionSheetReturnFocus = null;
  }

  function izrisiKartice() {
    if (trenutniStepZakljucen()) {
      elKartice.innerHTML = '<p class="izvedba-kartice__zakljuceno">Ta korak je zaključen. Ukrepi niso na voljo.</p>';
      return;
    }

    var podatek = trenutniPodatekKoraka();
    var step = podatek.step || {};
    var vrstice = korakiPoStepId(state.currentStepId);
    var prva = vrstice[0] || {};
    var sporocilo = state.urejenaSporocila[prva.id] != null
      ? state.urejenaSporocila[prva.id]
      : (prva.sporocilo || step.finalMessage || step.generatedMessage || "");
    var imaSms = vrstice.some(function (k) { return k.kanal === "sms"; });
    var imaEmail = Boolean(state.zadeva && state.zadeva.emailDolznika && (!step.primaryContacts || step.primaryContacts.email !== false));
    var caka = trenutniJeAwaitingConfirmation();
    var z = state.zadeva || {};
    var rok = step.paymentDeadline;
    if (rok && typeof rok === "object") rok = rok.label || rok.date || rok.dueDate || null;
    var kontaktneKartice = [];
    if (imaEmail) {
      kontaktneKartice.push(
        '<div class="izvedba-kontakt izvedba-kontakt--email"><span class="izvedba-kontakt__ikona" aria-hidden="true">' + K.ikona("mail") + '</span><span class="izvedba-kontakt__besedilo"><span class="izvedba-kontakt__label">E-pošta</span><strong class="izvedba-kontakt__vrednost">' + K.esc(z.emailDolznika) + "</strong></span></div>"
      );
    }
    if (imaSms && z.telefonDolznika) {
      kontaktneKartice.push(
        '<div class="izvedba-kontakt izvedba-kontakt--sms"><span class="izvedba-kontakt__ikona" aria-hidden="true">' + K.ikona("message") + '</span><span class="izvedba-kontakt__besedilo"><span class="izvedba-kontakt__label">SMS</span><strong class="izvedba-kontakt__vrednost">' + K.esc(z.telefonDolznika) + "</strong></span></div>"
      );
    }
    var html =
      '<div class="zo-sledi__povzetek"><span class="zo-sledi__povzetek-ikona" aria-hidden="true">' + K.ikona("info") + '</span><p>' + K.esc(opisTrenutnegaKoraka(step, podatek.polozaj)) + "</p></div>" +
      '<div class="zo-kapsula"><div class="zo-kapsula__osnovni">' +
        '<div class="zo-kapsula__polje"><span class="zo-kapsula__label">Dolžnik</span><span class="zo-kapsula__vrednost">' + K.esc(z.imeDolznika || "—") + "</span></div>" +
        '<div class="zo-kapsula__polje"><span class="zo-kapsula__label">Dolg</span><span class="zo-kapsula__vrednost">' + K.esc(K.formatirajEur(z.preostaliDolg)) + "</span></div>" +
        '<div class="zo-kapsula__polje"><span class="zo-kapsula__label">Račun</span><span class="zo-kapsula__vrednost">' + K.esc(z.stevilkaRacuna ? "št. " + z.stevilkaRacuna : "—") + "</span></div>" +
      "</div>" +
      '<div class="zo-vec zo-kapsula__vec"><button type="button" class="zo-vec__gumb" aria-expanded="false">' +
        '<span class="zo-vec__ikona" aria-hidden="true">' + K.ikona("sliders") + '</span><span class="zo-vec__besedilo"><span class="zo-vec__naslov">Več informacij</span><span class="zo-vec__podnapis">Ton, rok plačila in podrobnosti koraka</span></span><span class="zo-vec__chevron" aria-hidden="true">' + K.ikona("chevron") + "</span></button>" +
        '<div class="zo-vec__panel" hidden><div class="zo-vec__vrstica"><span>Ton sporočila</span><span>' + K.esc(oznakaDejanskegaTona(step.toneId || (state.plan && state.plan.toneId))) + '</span></div><div class="zo-vec__vrstica"><span>Rok plačila</span><span>' + K.esc(rok || "Po načrtu") + '</span></div><div class="zo-vec__vrstica"><span>Stanje</span><span>' + K.esc(K.oznakaStanja(prva.execution_state || "scheduled")) + "</span></div></div></div></div>" +
      '<div class="zo-sporocilo"><h2 class="zo-sporocilo__naslov">Celotno sporočilo dolžniku</h2>' +
        (kontaktneKartice.length ? '<div class="izvedba-kontakti izvedba-kontakti--' + kontaktneKartice.length + '">' + kontaktneKartice.join("") + "</div>" : "") +
        '<textarea class="zo-sporocilo__telo" data-sporocilo-id="' + K.esc(prva.id || "trenutni") + '" rows="1">' + K.esc(sporocilo || "Sporočilo za ta korak še ni pripravljeno.") + "</textarea></div>" +
      '<div class="zo-potem"><span class="zo-potem__ikona" aria-hidden="true">' + K.ikona("checkCircle") + "</span><span>Če dolg ne bo poravnan, boste prejeli obvestilo za naslednji korak.</span></div>" +
      '<div class="zo-akcije"><button type="button" class="zo-akcija-glavna" id="izvedba-gumb-posljizdaj" ' + (!caka || state.isSubmitting ? "disabled" : "") + '>Pošlji</button><button type="button" class="zo-akcija-pozneje" id="izvedba-gumb-pozneje">Pozneje</button></div>';

    elKartice.className = "zo-sledi__vsebina";
    elKartice.innerHTML = html;
    dodajHitraDejanja();
    requestAnimationFrame(function () {
      prilagodiBesediloOmejenemuPolju(elKartice);
    });

    var gumbPosljiZdaj = document.getElementById("izvedba-gumb-posljizdaj");
    if (gumbPosljiZdaj && caka) gumbPosljiZdaj.addEventListener("click", posljiOpominZdaj);
    var gumbPozneje = document.getElementById("izvedba-gumb-pozneje");
    if (gumbPozneje) gumbPozneje.addEventListener("click", function () {
      window.location.href = "aktivni-primeri.html";
    });
    var gumbVec = elKartice.querySelector(".zo-vec__gumb");
    if (gumbVec) gumbVec.addEventListener("click", function () {
      var podrobnosti = elKartice.querySelector(".zo-vec__panel");
      var odprto = gumbVec.getAttribute("aria-expanded") === "true";
      gumbVec.setAttribute("aria-expanded", String(!odprto));
      if (podrobnosti) podrobnosti.hidden = odprto;
    });
    var sporociloVnos = elKartice.querySelector("[data-sporocilo-id]");
    if (sporociloVnos) {
      sporociloVnos.style.height = "auto";
      sporociloVnos.style.height = sporociloVnos.scrollHeight + "px";
      sporociloVnos.addEventListener("input", function () {
        state.urejenaSporocila[sporociloVnos.getAttribute("data-sporocilo-id")] = sporociloVnos.value;
        sporociloVnos.style.height = "auto";
        sporociloVnos.style.height = sporociloVnos.scrollHeight + "px";
      });
    }
    var gumbPreklic = document.getElementById("izvedba-gumb-preklic");
    if (gumbPreklic) gumbPreklic.addEventListener("click", odpriActionSheet);
    var gumbPoravnano = document.getElementById("izvedba-gumb-poravnano");
    if (gumbPoravnano) gumbPoravnano.addEventListener("click", racunPoravnan);
  }

  function besediloGlavnegaGumba() {
    var meta = K.AKCIJE_META[state.selectedActionType];
    if (!meta) return "Potrdi izbrano dejanje";
    var besedilo = meta.gumb;
    if (state.selectedActionType === "payment_promised") {
      besedilo = besedilo.replace("{waitDays}", state.settingsByAction.payment_promised.waitDays);
    }
    return besedilo;
  }

  function izrisiSticky() {
    if (state.actionSheetOpen || !state.selectedActionType) {
      elSticky.hidden = true;
      elSticky.innerHTML = "";
      return;
    }
    elSticky.hidden = false;
    elSticky.innerHTML =
      (state.error ? '<p class="izvedba-sticky__napaka" role="alert">' + K.esc(state.error) + "</p>" : "") +
      '<button type="button" class="btn btn--cta izvedba-sticky__gumb" id="izvedba-gumb-potrdi" ' +
      (state.isSubmitting ? "disabled" : "") + ">" +
      (state.isSubmitting ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span>' : "") +
      K.esc(besediloGlavnegaGumba()) +
      "</button>";
    var gumb = document.getElementById("izvedba-gumb-potrdi");
    if (gumb) gumb.addEventListener("click", submitSelectedAction);
  }

  // ---------- Dogodkovna delegacija (razdelek 19 specifikacije) ----------

  elKartice.addEventListener("click", function (event) {
    var stevecGumb = event.target.closest("[data-stevec-korak]");
    if (stevecGumb) {
      event.stopPropagation();
      var kartica = stevecGumb.closest("[data-action-type]");
      var actionType = kartica.getAttribute("data-action-type");
      var polje = stevecGumb.closest("[data-stevec-polje]").getAttribute("data-stevec-polje");
      izberiAkcijo(actionType);
      posodobiStevec(actionType, polje, Number(stevecGumb.getAttribute("data-stevec-korak")));
      render();
      return;
    }

    var segmentGumb = event.target.closest("[data-segment-vrednost]");
    if (segmentGumb) {
      event.stopPropagation();
      var kartica2 = segmentGumb.closest("[data-action-type]");
      var actionType2 = kartica2.getAttribute("data-action-type");
      izberiAkcijo(actionType2);
      posodobiSegment(actionType2, segmentGumb.getAttribute("data-segment-polje"), segmentGumb.getAttribute("data-segment-vrednost"));
      render();
      return;
    }

    var kartica3 = event.target.closest("[data-action-type]");
    if (!kartica3) return;
    izberiAkcijo(kartica3.getAttribute("data-action-type"));
    render();
  });

  elKartice.addEventListener("input", function (event) {
    var znesekVnos = event.target.closest("[data-znesek-polje]");
    if (!znesekVnos) return;
    var kartica = znesekVnos.closest("[data-action-type]");
    var actionType = kartica.getAttribute("data-action-type");
    izberiAkcijo(actionType);
    posodobiZnesek(actionType, znesekVnos.getAttribute("data-znesek-polje"), znesekVnos.value);
  });

  if (elActionSheet) {
    elActionSheet.addEventListener("click", function (event) {
      var close = event.target.closest("[data-action-sheet-close]");
      if (close) {
        zapriActionSheet();
        return;
      }
      var confirm = event.target.closest("[data-action-sheet-confirm]");
      if (confirm) {
        if (state.actionSheetMode === "payment") {
          if (state.actionSheetStep === "izbira") {
            state.actionSheetStep = "povzetek";
            izrisiActionSheet();
          } else {
            nastaviNovNacrt();
          }
        } else {
          submitSelectedAction();
        }
        return;
      }
      var povzetekNazaj = event.target.closest("[data-povzetek-nazaj]");
      if (povzetekNazaj) {
        if (state.pregledDokumenta != null) {
          state.pregledDokumenta = null;
        } else {
          state.actionSheetStep = "izbira";
        }
        izrisiActionSheet();
        return;
      }
      if (state.actionSheetStep === "povzetek" && state.actionSheetMode === "payment") {
        var korakRazsiri = event.target.closest("[data-povzetek-korak-razsiri]");
        if (korakRazsiri) {
          var indeksKoraka = Number(korakRazsiri.getAttribute("data-povzetek-korak-razsiri"));
          state.razsirjenKorakPovzetka = state.razsirjenKorakPovzetka === indeksKoraka ? null : indeksKoraka;
          izrisiActionSheet();
          return;
        }
        var kanalGumb = event.target.closest("[data-povzetek-kanal]");
        if (kanalGumb) {
          var kanalIme = kanalGumb.getAttribute("data-povzetek-kanal");
          state.kanaliPosiljanja[kanalIme] = !state.kanaliPosiljanja[kanalIme];
          izrisiActionSheet();
          return;
        }
        var dokumentZavihek = event.target.closest("[data-povzetek-dokument]");
        if (dokumentZavihek) {
          state.aktivenDokument = Number(dokumentZavihek.getAttribute("data-povzetek-dokument"));
          izrisiActionSheet();
          return;
        }
        var poglejCeloten = event.target.closest("[data-povzetek-poglej]");
        if (poglejCeloten) {
          state.pregledDokumenta = Number(poglejCeloten.getAttribute("data-povzetek-poglej"));
          izrisiActionSheet();
          return;
        }
      }
      if (state.actionSheetMode === "payment") {
        var ukrepOdstrani = event.target.closest("[data-ukrep-odstrani]");
        if (ukrepOdstrani) {
          odstraniIzvedenKorak(
            ukrepOdstrani.getAttribute("data-ukrep-odstrani"),
            ukrepOdstrani.getAttribute("data-ukrep-tip")
          );
          return;
        }
        var nacrtDodaj = event.target.closest("[data-nacrt-dodaj]");
        if (nacrtDodaj) {
          dodajKorakVNacrt();
          izrisiActionSheet();
          pomakniPotekNaDno();
          return;
        }
        var nacrtOdstrani = event.target.closest("[data-nacrt-odstrani]");
        if (nacrtOdstrani) {
          odstraniKorakIzNacrta(Number(nacrtOdstrani.getAttribute("data-nacrt-odstrani")));
          izrisiActionSheet();
          return;
        }
      }
      var korakZaklenjen = event.target.closest("[data-korak-zaklenjen]");
      if (korakZaklenjen) {
        state.error = "Ta korak je že izveden in ga trenutno ni mogoče razveljaviti prek te aplikacije.";
        izrisiActionSheet();
        return;
      }
      var razlogMoznost = event.target.closest("[data-settlement-reason-option]");
      if (razlogMoznost) {
        var razlogTip = razlogMoznost.getAttribute("data-settlement-type");
        state.selectedSettlementType = razlogTip;
        state.settlementSettings[razlogTip].reason = razlogMoznost.getAttribute("data-settlement-reason-option");
        state.settlementReasonMenuOpen = false;
        state.settlementReasonMenuTip = null;
        state.error = null;
        izrisiActionSheet();
        return;
      }
      var razlogSprozi = event.target.closest("[data-settlement-reason-toggle]");
      if (razlogSprozi) {
        var razlogSproziTip = razlogSprozi.getAttribute("data-settlement-type");
        state.selectedSettlementType = razlogSproziTip;
        var zeOdprtZaTaTip = state.settlementReasonMenuOpen && state.settlementReasonMenuTip === razlogSproziTip;
        state.settlementReasonMenuTip = zeOdprtZaTaTip ? null : razlogSproziTip;
        state.settlementReasonMenuOpen = !zeOdprtZaTaTip;
        state.error = null;
        izrisiActionSheet();
        requestAnimationFrame(function () {
          var prviRazlog = elActionSheet.querySelector(".izvedba-poravnava__razlog-moznost.is-selected");
          if (state.settlementReasonMenuOpen && prviRazlog) prviRazlog.focus({ preventScroll: true });
        });
        return;
      }
      var poravnavaIzbira = event.target.closest("[data-settlement-select]");
      if (poravnavaIzbira) {
        var izbranTip = poravnavaIzbira.getAttribute("data-settlement-select");
        state.selectedSettlementType = izbranTip;
        state.settlementReasonMenuOpen = false;
        state.error = null;
        izrisiActionSheet();
        return;
      }
      var poravnavaSegment = event.target.closest("[data-settlement-segment]");
      if (poravnavaSegment) {
        var poravnavaTip = poravnavaSegment.getAttribute("data-settlement-type");
        state.selectedSettlementType = poravnavaTip;
        state.settlementReasonMenuOpen = false;
        state.settlementReasonMenuTip = null;
        state.settlementSettings[poravnavaTip][poravnavaSegment.getAttribute("data-settlement-segment")] = poravnavaSegment.getAttribute("data-settlement-value");
        state.error = null;
        izrisiActionSheet();
        return;
      }
      var stevec = event.target.closest("[data-stevec-korak]");
      if (stevec) {
        var stevecKartica = stevec.closest("[data-action-type]");
        var stevecAction = stevecKartica.getAttribute("data-action-type");
        var stevecPolje = stevec.closest("[data-stevec-polje]").getAttribute("data-stevec-polje");
        izberiAkcijo(stevecAction);
        posodobiStevec(stevecAction, stevecPolje, Number(stevec.getAttribute("data-stevec-korak")));
        izrisiActionSheet();
        return;
      }
      var segment = event.target.closest("[data-segment-vrednost]");
      if (segment) {
        var segmentKartica = segment.closest("[data-action-type]");
        var segmentAction = segmentKartica.getAttribute("data-action-type");
        izberiAkcijo(segmentAction);
        posodobiSegment(segmentAction, segment.getAttribute("data-segment-polje"), segment.getAttribute("data-segment-vrednost"));
        izrisiActionSheet();
        return;
      }
      var izbira = event.target.closest("[data-action-sheet-select]");
      if (izbira) {
        izberiAkcijo(izbira.getAttribute("data-action-sheet-select"));
        izrisiActionSheet();
      }
    });

    elActionSheet.addEventListener("input", function (event) {
      var poravnavaZnesek = event.target.closest("[data-settlement-amount]");
      if (poravnavaZnesek) {
        var znesekTip = poravnavaZnesek.getAttribute("data-settlement-type");
        state.selectedSettlementType = znesekTip;
        state.settlementSettings[znesekTip][poravnavaZnesek.getAttribute("data-settlement-amount")] = poravnavaZnesek.value === "" ? null : Number(poravnavaZnesek.value);
        state.error = null;
        prilagodiBesediloOmejenemuPolju(poravnavaZnesek.parentElement);
        if (znesekTip === "credit_note") {
          state.settlementSettings.credit_note.rocnoUrejeno = true;
          var namigEl = poravnavaZnesek.parentElement.parentElement.querySelector(".izvedba-poravnava__namig");
          if (namigEl) {
            var vneseniDobropis = Number(state.settlementSettings.credit_note.settlementAmount) || 0;
            var jePolniDobropisVnos = Math.abs(vneseniDobropis - preostaliDolgPoNacrtu()) <= 0.009;
            namigEl.textContent = jePolniDobropisVnos
              ? "Pokriva celoten preostali dolg — primer se bo zaprl."
              : "Manjši znesek od preostanka — primer ostane odprt.";
          }
        }
        return;
      }
      var poravnavaDatum = event.target.closest("[data-settlement-datetime]");
      if (poravnavaDatum) {
        var datumTip = poravnavaDatum.getAttribute("data-settlement-type");
        var datumPolje = poravnavaDatum.getAttribute("data-settlement-datetime");
        state.selectedSettlementType = datumTip;
        var poravnavaDatumVrednost = poravnavaDatum.value ? new Date(poravnavaDatum.value) : null;
        state.settlementSettings[datumTip][datumPolje] = poravnavaDatumVrednost && !Number.isNaN(poravnavaDatumVrednost.getTime()) ? poravnavaDatumVrednost.toISOString() : null;
        if (poravnavaDatum.hasAttribute("data-settlement-datum-segment")) {
          state.settlementSettings[datumTip].dateMode = "custom";
          var poravnavaSegmentSkupina = poravnavaDatum.closest(".izvedba-segment");
          if (poravnavaSegmentSkupina) {
            var danesGumbEl = poravnavaSegmentSkupina.querySelector('[data-settlement-value="today"]');
            if (danesGumbEl) {
              danesGumbEl.classList.remove("is-selected");
              danesGumbEl.setAttribute("aria-pressed", "false");
            }
            var datumGumbEl = poravnavaSegmentSkupina.querySelector(".izvedba-segment__gumb--datum");
            if (datumGumbEl) {
              datumGumbEl.classList.add("is-selected");
              var datumTekstEl = datumGumbEl.querySelector("span");
              if (datumTekstEl) datumTekstEl.textContent = datumZaPrikaz(poravnavaDatum.value);
              prilagodiBesediloOmejenemuPolju(poravnavaSegmentSkupina);
            }
          }
        } else {
          var poravnavaDatumPrikaz = poravnavaDatum.parentElement.querySelector(".izvedba-action-sheet__datum-vrednost");
          if (poravnavaDatumPrikaz) {
            poravnavaDatumPrikaz.textContent = datumZaPrikaz(poravnavaDatum.value);
            prilagodiBesediloOmejenemuPolju(poravnavaDatum.parentElement);
          }
        }
        return;
      }
      var lastnoBesedilo = event.target.closest("[data-settlement-custom-reason]");
      if (lastnoBesedilo) {
        var besediloTip = lastnoBesedilo.getAttribute("data-settlement-type");
        state.selectedSettlementType = besediloTip;
        state.settlementSettings[besediloTip].customReason = lastnoBesedilo.value;
        state.error = null;
        lastnoBesedilo.style.height = "auto";
        lastnoBesedilo.style.height = lastnoBesedilo.scrollHeight + "px";
        return;
      }
      var znesek = event.target.closest("[data-znesek-polje]");
      if (znesek) {
        var znesekKartica = znesek.closest("[data-action-type]");
        var znesekAction = znesekKartica.getAttribute("data-action-type");
        izberiAkcijo(znesekAction);
        posodobiZnesek(znesekAction, znesek.getAttribute("data-znesek-polje"), znesek.value);
        return;
      }
      var datum = event.target.closest("[data-datetime-polje]");
      if (datum) {
        var datumAction = datum.getAttribute("data-action-type");
        izberiAkcijo(datumAction);
        var datumVrednost = datum.value ? new Date(datum.value) : null;
        state.settingsByAction[datumAction][datum.getAttribute("data-datetime-polje")] =
          datumVrednost && !Number.isNaN(datumVrednost.getTime()) ? datumVrednost.toISOString() : null;
        var datumPrikaz = datum.parentElement.querySelector(".izvedba-action-sheet__datum-vrednost");
        if (datumPrikaz) {
          datumPrikaz.textContent = datumZaPrikaz(datum.value);
          prilagodiBesediloOmejenemuPolju(datum.parentElement);
        }
      }
    });
  }

  document.addEventListener("keydown", function (event) {
    if (!state.actionSheetOpen || !elActionSheet) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (state.settlementReasonMenuOpen) {
        state.settlementReasonMenuOpen = false;
        state.settlementReasonMenuTip = null;
        izrisiActionSheet();
        var razlogSprozi = elActionSheet.querySelector("[data-settlement-reason-toggle]");
        if (razlogSprozi) razlogSprozi.focus({ preventScroll: true });
        return;
      }
      zapriActionSheet();
      return;
    }
    if (event.key !== "Tab") return;
    var fokusni = Array.prototype.slice.call(elActionSheet.querySelectorAll('button:not([disabled]), input:not([disabled])'));
    if (!fokusni.length) return;
    var prvi = fokusni[0];
    var zadnji = fokusni[fokusni.length - 1];
    if (event.shiftKey && document.activeElement === prvi) {
      event.preventDefault();
      zadnji.focus();
    } else if (!event.shiftKey && document.activeElement === zadnji) {
      event.preventDefault();
      prvi.focus();
    }
  });

  elSwipe.addEventListener("click", function (event) {
    var gumb = event.target.closest("[data-swipe-step]");
    if (!gumb) return;
    state.currentStepId = gumb.getAttribute("data-swipe-step");
    state.selectedActionType = null;
    render();
  });

  window.addEventListener("beforeunload", function () {
    Api.odjaviRealtime(state.channel);
  });

  window.addEventListener("resize", function () {
    prilagodiBesediloOmejenemuPolju(elKartice);
    prilagodiBesediloOmejenemuPolju(elActionSheet);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      prilagodiBesediloOmejenemuPolju(elKartice);
      prilagodiBesediloOmejenemuPolju(elActionSheet);
    });
  }

  /* Testni/razvojni kavelj - omogoča ročno preverjanje poravnalnega
     kontrolnika (Denar/Dobropis/Odpust) brez prijave/Supabase (glej npr.
     javascript_tool preverjanje v razvoju). Ne vpliva na produkcijsko
     delovanje strani. */
  window.UJIzvedbaDebug = {
    izrisiPoravnavaKontrolnik: izrisiPoravnavaKontrolnik,
    izrisiPoravnavaSvicer: izrisiPoravnavaSvicer,
    izrisiPoravnavaPodrobnosti: izrisiPoravnavaPodrobnosti,
    izrisiPotekPrimera: izrisiPotekPrimera,
    izrisiActionSvicer: izrisiActionSvicer,
    izrisiActionPodrobnosti: izrisiActionPodrobnosti,
    izberiAkcijo: izberiAkcijo,
    dodajKorakVNacrt: dodajKorakVNacrt,
    state: state,
  };

  // ---------- Zagon ----------

  var params = urlParametri();
  if (!params.zadevaId && !params.executionId) {
    state.globalnaNapaka = "Manjkajo parametri za odpiranje izvedbe (zadevaId ali executionId).";
    render();
  } else {
    state.currentStepId = params.stepId || null;
    nalozi(params);
  }
})();
