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
    skip_current_step: { nextDelayDays: 0, skipReason: "", skipReasonDetail: "" },
    stop_plan: { resumeMode: "manual", resumeAt: null },
    handoff_to_lawyer: { timingMode: "asap", scheduledHandoffAt: null },
    postpone_reminder: { delayDays: 3 },
    payment_promised: { waitDays: 4, promisedAmount: null, promisedDate: null, occurredAt: null, occurredAtApproximation: "", occurredAtApproximate: false, historyMode: "promise", occurredAtUnknown: false, promisedDateUnknown: false, promisedDateApproximation: "", promisedDateApproximate: false, communicationChannel: null, description: "" },
    partial_payment: { remainingAmount: null },
  };

  var DEFAULT_SETTLEMENT_SETTINGS = {
    full: { dateMode: "today", settledAt: null, datumKoraka: null, datumKorakaUnknown: false, datumKorakaApproximation: "", datumKorakaApproximate: false, paymentMethod: null },
    partial: { paymentAmount: null, datumKoraka: null, datumKorakaUnknown: false, datumKorakaApproximation: "", datumKorakaApproximate: false, paymentMethod: null },
    compensation: { dateMode: "today", settledAt: null, settlementAmount: null, rocnoUrejeno: false },
    installment: { paymentAmount: null, datumKoraka: null, datumKorakaUnknown: false, datumKorakaApproximation: "", datumKorakaApproximate: false, paymentMethod: null, planer: null, historyMode: "paid", installmentCount: null, agreementDate: null, agreementDateUnknown: false, agreementDateApproximation: "", agreementDateApproximate: false, description: "" },
    unpaid_installment: { installmentNumber: null, installmentNumberUnknown: false, dueAt: null, dueAtUnknown: false, dueAtApproximation: "", dueAtApproximate: false },
    credit_note: { settlementAmount: null, rocnoUrejeno: false, kind: "credit", reason: "", customReason: "", datumKoraka: null },
    cancelled_invoice: { reason: "", customReason: "", datumKoraka: null },
    payment_failed: { paymentMethod: null, occurredAt: null, occurredAtUnknown: false, occurredAtApproximation: "", occurredAtApproximate: false, description: "" },
    invoice_dispute: { communicationChannel: null, occurredAt: null, occurredAtUnknown: false, occurredAtApproximation: "", occurredAtApproximate: false, description: "" },
    insolvency: { occurredAt: null, occurredAtUnknown: false, occurredAtApproximation: "", occurredAtApproximate: false, description: "", documentReference: "" },
  };

  var NastavitveIzidov = window.UJNastavitveIzidov;
  var SETTLEMENT_ORDER = (NastavitveIzidov && NastavitveIzidov.VRSTNI_RED_PORAVNAVE) ||
    ["full", "partial", "compensation", "installment", "credit_note"];
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
  var SETTLEMENT_META = SETTLEMENT_ORDER.concat(["cancelled_invoice"]).reduce(function (acc, tip) {
    if (acc[tip]) return acc;
    var osnova = (NastavitveIzidov && NastavitveIzidov.izid(tip)) || {};
    acc[tip] = Object.assign(
      { naslov: osnova.naslov, opis: osnova.opis, razred: osnova.razred, ikona: osnova.ikona, gumb: osnova.gumb },
      SETTLEMENT_KARTICA_DODATNO[tip]
    );
    return acc;
  }, {});
  var DOGOVOR_META = {
    full: Object.assign({}, SETTLEMENT_META.full, { naslov: "Plačal bo v celoti", opis: "Dogovor za plačilo celotnega dolga." }),
    partial: Object.assign({}, SETTLEMENT_META.partial, { naslov: "Plačal bo delno", opis: "Dogovor za delno prihodnje plačilo." }),
    installment: Object.assign({}, SETTLEMENT_META.installment, { naslov: "Plačal bo v obrokih", opis: "Dogovorjeni zneski in roki obrokov." }),
    payment_promised: { naslov: "Plačal bo do novega roka", opis: "Načrt začasno počaka.", razred: "akcija-obljuba", ikona: "handshake" },
    compensation: Object.assign({}, SETTLEMENT_META.compensation, { naslov: "Poravnal bo s kompenzacijo", opis: "Dogovorjena prihodnja kompenzacija." }),
    credit_note: Object.assign({}, SETTLEMENT_META.credit_note, { naslov: "Poravnava z dobropisom", opis: "Dogovorjeni prihodnji dobropis." }),
  };
  var ZGODOVINA_META = {
    partial: { naslov: "Delno plačilo", razred: "delno", ikona: "cardDown" },
    full: { naslov: "Plačano v celoti", razred: "placano-v-celoti", ikona: "receiptCheck" },
    installment: { naslov: "Obroki", razred: "obrok", ikona: "calendar" },
    unpaid_installment: { naslov: "Neplačan obrok", razred: "neplacan-obrok", ikona: "clock" },
    payment_promised: { naslov: "Obljuba / nov rok", razred: "akcija-obljuba", ikona: "calendarArrow" },
    payment_failed: { naslov: "Plačilo ni uspelo", razred: "neuspesno-placilo", ikona: "warning" },
    invoice_dispute: { naslov: "Ugovor / reklamacija", razred: "ugovor", ikona: "messageX" },
    insolvency: { naslov: "Stečaj / insolventnost", razred: "insolventnost", ikona: "shield" },
    credit_note: { naslov: "Dobropis / nota", razred: "dobropis", ikona: "documentMinus" },
    compensation: { naslov: "Kompenzacija (pobot)", razred: "kompenzacija", ikona: "scales" },
    cancelled_invoice: { naslov: "Odpis / storno", razred: "storno", ikona: "xCircle" },
  };

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
  var elReadOnlyBanner = document.getElementById("izvedba-readonly-banner");
  var elActionSheet = document.getElementById("izvedba-action-sheet");
  var actionSheetReturnFocus = null;
  var fitMerilnik = document.createElement("canvas").getContext("2d");
  var sheetScrollY = 0;

  function jeStranZgodovine() {
    return document.body.classList.contains("stran--neplacila-zgodovina");
  }

  function jeOdvetnikZgodovina() {
    return state && state.actionSheetMode === "lawyer" && state.lawyerWizard && state.lawyerWizard.screen === "zgodovina";
  }

  function jeVnosZgodovine() {
    return jeStranZgodovine() || jeOdvetnikZgodovina() || Boolean(state && state.assistedHistoryInputActive);
  }

  function jePlacilniEngine() {
    return state && state.actionSheetMode === "payment";
  }

  function jeBoPlacalNeposrednaHitraIzbira() {
    return jePlacilniEngine() && !jeVnosZgodovine() && state.boPlacalHitraIzbira &&
      ["full", "partial", "payment_promised"].indexOf(state.selectedSettlementType) >= 0;
  }

  function jeAtena() {
    return jeVnosZgodovine() || jePlacilniEngine();
  }

  function jePlacilniDogodkovniTip(tip) {
    return jePlacilniEngine() && ["unpaid_installment", "payment_failed", "invoice_dispute", "cancelled_invoice", "insolvency"].indexOf(tip) >= 0;
  }

  function zakleniOzadjeSheeta() {
    if (jeStranZgodovine()) return;
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
    if (jeStranZgodovine()) return;
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
    aktivniFilterKartic: null,
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
    boPlacalHitraIzbira: false,
    customActionActive: false,
    customActionDescription: "",
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
    lawyerWizard: null,
    lawyerWizardDraft: null,
    readonlyRequested: false,
  };

  /* Čarovnik "Posreduj takoj odvetniku" (izvedba.js) - lahka izvedba, ki
     samo dopolni obstoječi plan.steps[manual_lawyer].lawyerHandoff (glej
     api/_lib/izvedba-core.js: preveriPredajoPopolno). Namerno NE uvaža
     opomin-nacrt-ui.js (677 KB, tuja DOM/globalna vezava) - gl. ZAPISNIK. */
  var LAWYER_PROFILES = [
    { id: "joze_kovac", name: "Odvetnik Jože Kovač", shortName: "Odvetnik Jože", officeName: "Odvetniška pisarna Kovač", email: "joze.kovac@primer.si", phone: "+386 1 555 01 10", rating: "4,9", availableHandoffDays: [true, true, true, true, true, false, false] },
    { id: "ana_novak", name: "Odvetnica Ana Novak", shortName: "Odvetnica Ana", officeName: "Pravna pisarna Novak", email: "ana.novak@primer.si", phone: "+386 1 555 02 20", rating: "4,8", availableHandoffDays: [true, true, true, true, true, false, false] },
    { id: "marko_zupan", name: "Odvetnik Marko Župan", shortName: "Odvetnik Marko", officeName: "Župan pravno svetovanje", email: "marko.zupan@primer.si", phone: "+386 4 555 03 30", rating: "4,7", availableHandoffDays: [true, true, true, true, true, false, false] },
  ];

  var LAWYER_PACKAGES = [
    { id: "lawyer_demand_letter", naslov: "Odvetnik pošlje opomin", opis: "Uradni odvetniški opomin z rokom za plačilo.", ikona: "mail", cena: 29.9, cenaPredpona: "", cenaOpis: "enkratno", lawyerId: "joze_kovac", requiresSurcharge: false },
    { id: "lawyer_phone_call", naslov: "Odvetnik pokliče dolžnika", opis: "Osebni telefonski poziv k plačilu.", ikona: "phone", cena: 49.9, cenaPredpona: "", cenaOpis: "enkratno", lawyerId: "ana_novak", requiresSurcharge: true },
    { id: "legal_proceeding", naslov: "Začetek pravnega postopka", opis: "Priprava primera za formalni pravni postopek.", ikona: "scales", cena: 149, cenaPredpona: "od", cenaOpis: "", lawyerId: "marko_zupan", requiresSurcharge: true },
    { id: "case_review", naslov: "Samo pregled primera", opis: "Odvetnik pregleda primer in poda priporočilo.", ikona: "document", cena: 0, cenaPredpona: "", cenaOpis: "", lawyerId: "joze_kovac", requiresSurcharge: false },
  ];

  function najdiLawyerPaket(packageId) {
    return LAWYER_PACKAGES.find(function (p) { return p.id === packageId; }) || LAWYER_PACKAGES[2];
  }

  function najdiLawyerProfil(lawyerId) {
    return LAWYER_PROFILES.find(function (o) { return o.id === lawyerId; }) || LAWYER_PROFILES[0];
  }

  function najdiLawyerStep() {
    var koraki = (state.plan && state.plan.steps) || [];
    for (var i = koraki.length - 1; i >= 0; i--) {
      if (koraki[i] && koraki[i].kind === "manual_lawyer") return koraki[i];
    }
    return null;
  }

  function kopirajPodatke(vrednost) {
    return vrednost == null ? vrednost : JSON.parse(JSON.stringify(vrednost));
  }

  function jePredajaOdvetnikuPripravljena(lawyerHandoff) {
    return Boolean(
      lawyerHandoff &&
      lawyerHandoff.status === "prepared" &&
      lawyerHandoff.preparedSnapshot
    );
  }

  function podatkiPripravljenePredaje(lawyerHandoff) {
    var lh = lawyerHandoff || {};
    var snapshot = lh.preparedSnapshot || {};
    var odvetnik = snapshot.odvetnik || {};
    var paket = kopirajPodatke(snapshot.izbraniPaket || lh.selectedPackage || {});
    return {
      pripravljen: jePredajaOdvetnikuPripravljena(lh),
      snapshot: kopirajPodatke(snapshot),
      lawyerId: odvetnik.lawyerId || lh.lawyerId || null,
      lawyerSnapshot: {
        name: odvetnik.ime || (lh.lawyerSnapshot && lh.lawyerSnapshot.name) || "",
        officeName: odvetnik.pisarna || (lh.lawyerSnapshot && lh.lawyerSnapshot.officeName) || "",
        email: odvetnik.email || (lh.lawyerSnapshot && lh.lawyerSnapshot.email) || "",
        phone: odvetnik.telefon || (lh.lawyerSnapshot && lh.lawyerSnapshot.phone) || "",
      },
      selectedPackage: paket,
      documents: kopirajPodatke(snapshot.dokumenti || lh.documents || []),
      message: snapshot.sporociloOdvetniku || lh.message || "",
      messageEditedManually: Boolean(lh.messageEditedManually),
      historyBeforePlan: kopirajPodatke(lh.historyBeforePlan || []),
      riskAssessment: kopirajPodatke(lh.riskAssessment || null),
      availableHandoffDays: kopirajPodatke(odvetnik.mozniDneviPredaje || lh.availableHandoffDays || []),
      timingMode: (snapshot.casPredaje && snapshot.casPredaje.nacin) || lh.handoffTimingMode || "asap",
      scheduledHandoffAt: (snapshot.casPredaje && snapshot.casPredaje.scheduledAt) || lh.scheduledHandoffAt || null,
    };
  }

  function urlParametri() {
    var url = new URL(window.location.href);
    return {
      zadevaId: url.searchParams.get("zadevaId"),
      stepId: url.searchParams.get("stepId"),
      executionId: url.searchParams.get("executionId"),
      readonly: url.searchParams.get("readonly") === "1",
    };
  }

  function jeSamoZaBranje() {
    return state.readonlyRequested === true || Boolean(state.zadeva && state.zadeva.status === "Rešeno");
  }

  function zavrniSprememboCeSamoZaBranje() {
    if (!jeSamoZaBranje()) return false;
    state.error = "Ta primer je že zaključen in ga ni več mogoče spreminjati.";
    state.actionSheetOpen = false;
    state.selectedActionType = null;
    state.selectedSettlementType = null;
    state.aktivniFilterKartic = null;
    odkleniOzadjeSheeta();
    render();
    return true;
  }

  function celoStevilo(v) {
    var n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : NaN;
  }

  function omejiVMejo(v, meja) {
    return Math.max(meja.min, Math.min(meja.max, v));
  }

  function dodajHitraDejanja() {
    if (jeSamoZaBranje()) return;
    var vrsticaPoslji = document.querySelector(".izvedba-posljizdaj-vrstica");
    if (!vrsticaPoslji) return;
    var onemogoceno = state.isSubmitting ? " disabled" : "";
    vrsticaPoslji.insertAdjacentHTML(
      "beforebegin",
      '<div class="izvedba-hitre-akcije" aria-label="Hitra dejanja">' +
        '<button type="button" class="izvedba-hitra-akcija izvedba-hitra-akcija--preklic" id="izvedba-gumb-preklic"' + onemogoceno + '>' +
          '<span class="izvedba-hitra-akcija__ikona" aria-hidden="true">' + K.ikona("xCircle") + '</span>' +
          '<span class="izvedba-hitra-akcija__besedilo" data-izvedba-fit data-fit-min="10.5">Ne bo pla\u010Dal</span>' +
        '</button>' +
        '<button type="button" class="izvedba-hitra-akcija izvedba-hitra-akcija--poravnano" id="izvedba-gumb-poravnano"' + onemogoceno + '>' +
          '<span class="izvedba-hitra-akcija__ikona" aria-hidden="true">' + K.ikona("handshake") + '</span>' +
          '<span class="izvedba-hitra-akcija__besedilo" data-izvedba-fit data-fit-min="9.5">Pristal je na dogovor</span>' +
        '</button>' +
        '<button type="button" class="izvedba-hitra-akcija izvedba-hitra-akcija--opomin" id="izvedba-gumb-preklici-hitro"' + onemogoceno + '>' +
          '<span class="izvedba-hitra-akcija__ikona" aria-hidden="true">' + K.ikona("bellOff") + '</span>' +
          '<span class="izvedba-hitra-akcija__besedilo" data-izvedba-fit data-fit-min="10.5">Prekli\u010Di opomin</span>' +
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
    state.customActionActive = false;
    state.error = null;
    if (actionType === "partial_payment") {
      state.selectedSettlementType = "partial";
      if (jeMenjava) {
        state.settlementSettings.partial = JSON.parse(JSON.stringify(DEFAULT_SETTLEMENT_SETTINGS.partial));
      }
    }
    if (actionType === "cancelled_invoice") {
      state.selectedSettlementType = "cancelled_invoice";
      if (jeMenjava) {
        state.settlementSettings.cancelled_invoice = JSON.parse(JSON.stringify(DEFAULT_SETTLEMENT_SETTINGS.cancelled_invoice));
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

  function delezPoravnanegaDolga(prvotniZnesek, preostaliZnesek) {
    var prvotni = Number(prvotniZnesek);
    var preostali = Number(preostaliZnesek);
    if (!(Number.isFinite(prvotni) && prvotni > 0 && Number.isFinite(preostali))) return 0;
    return Math.max(0, Math.min(100, ((prvotni - preostali) / prvotni) * 100));
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

  function besedaZaSteviloDogodkov(n) {
    if (n === 1) return "dogodek";
    if (n === 2) return "dogodka";
    if (n === 3 || n === 4) return "dogodki";
    return "dogodkov";
  }

  function besedaZaSteviloDogovorov(n) {
    if (n === 1) return "dogovor";
    if (n === 2) return "dogovora";
    if (n === 3 || n === 4) return "dogovori";
    return "dogovorov";
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

  function dneviCakanjaZaDogovor(datum) {
    var ciljniDatum = datum ? new Date(datum) : null;
    if (!ciljniDatum || Number.isNaN(ciljniDatum.getTime())) return DEFAULT_ACTION_SETTINGS.payment_promised.waitDays;
    return Math.max(1, Math.min(60, Math.ceil((ciljniDatum.getTime() - Date.now()) / 86400000)));
  }

  function pripraviDogovorZaOddajo(tip) {
    if (!jePlacilniEngine() || jeVnosZgodovine()) return undefined;
    var dolg = trenutniPreostaliDolg();
    var dogovorjenAt = state.poravnavaDogovorAt || new Date().toISOString();
    var osnovneNastavitve = state.settingsByAction.payment_promised || DEFAULT_ACTION_SETTINGS.payment_promised;
    var agreementKind = tip === "payment_promised" ? "deadline" : tip;
    var settings = {
      waitDays: osnovneNastavitve.waitDays,
      agreementKind: agreementKind,
      agreedAt: dogovorjenAt,
      source: "manual",
    };

    if (tip === "payment_promised") {
      var rokObljube = osnovneNastavitve.promisedDate || null;
      return { actionType: "payment_promised", settings: Object.assign({}, osnovneNastavitve, settings, {
        waitDays: dneviCakanjaZaDogovor(rokObljube),
        agreedAmount: Number(osnovneNastavitve.promisedAmount) > 0 ? Number(osnovneNastavitve.promisedAmount) : null,
        dueAt: rokObljube,
      }) };
    }

    var nastavitve = state.settlementSettings[tip];
    if (!nastavitve) return null;

    if (tip === "full") {
      var rokPolnegaPlacila = nastavitve.dateMode === "custom" ? nastavitve.settledAt : new Date().toISOString();
      return { actionType: "payment_promised", settings: Object.assign(settings, {
        waitDays: dneviCakanjaZaDogovor(rokPolnegaPlacila), agreedAmount: dolg, promisedAmount: dolg,
        dueAt: rokPolnegaPlacila, promisedDate: rokPolnegaPlacila, paymentMethod: nastavitve.paymentMethod || null,
      }) };
    }

    if (tip === "partial") {
      var delniZnesek = Number(nastavitve.paymentAmount);
      if (!Number.isFinite(delniZnesek) || delniZnesek <= 0 || delniZnesek >= dolg - 0.009) {
        state.error = "Vnesite dogovorjeni znesek, ki je večji od 0 in manjši od preostalega dolga.";
        return null;
      }
      var rokDelnegaPlacila = nastavitve.datumKoraka || new Date().toISOString();
      return { actionType: "payment_promised", settings: Object.assign(settings, {
        waitDays: dneviCakanjaZaDogovor(rokDelnegaPlacila), agreedAmount: delniZnesek, promisedAmount: delniZnesek,
        dueAt: rokDelnegaPlacila, promisedDate: rokDelnegaPlacila, paymentMethod: nastavitve.paymentMethod || null,
      }) };
    }

    if (tip === "installment") {
      var planer = nastavitve.planer;
      var vrstice = planer && Array.isArray(planer.obroki) ? planer.obroki : [];
      if (!vrstice.length || vrstice.length > 20) {
        state.error = "Dodajte najmanj en in največ 20 obrokov.";
        return null;
      }
      var vsota = 0;
      var obroki = [];
      for (var i = 0; i < vrstice.length; i++) {
        var vrstica = vrstice[i] || {};
        var znesek = Number(vrstica.znesek);
        var priblizniDatum = String(vrstica.datumPriblizno || "").trim();
        if (!Number.isFinite(znesek) || znesek <= 0 || (!vrstica.datum && vrstica.datumNeznan !== true && !priblizniDatum)) {
          state.error = "Vsak obrok potrebuje znesek in datum.";
          return null;
        }
        vsota += znesek;
        obroki.push({ amount: znesek, dueAt: vrstica.datum || null, dueAtUnknown: vrstica.datumNeznan === true, dueAtApproximation: priblizniDatum || null });
      }
      vsota = Math.round(vsota * 100) / 100;
      if (vsota > dolg + 0.009) {
        state.error = "Vsota obrokov ne sme preseči preostalega dolga.";
        return null;
      }
      var zadnjiRok = obroki.reduce(function (zadnji, obrok) { return obrok.dueAt || zadnji; }, null);
      return { actionType: "payment_promised", settings: Object.assign(settings, {
        waitDays: dneviCakanjaZaDogovor(zadnjiRok), agreedAmount: vsota, promisedAmount: vsota,
        dueAt: zadnjiRok, promisedDate: zadnjiRok, installmentCount: obroki.length,
        installments: obroki, paymentMethod: nastavitve.paymentMethod || null,
      }) };
    }

    if (tip === "compensation" || tip === "credit_note") {
      var dogovorjeniZnesek = Number(nastavitve.settlementAmount);
      if (!Number.isFinite(dogovorjeniZnesek) || dogovorjeniZnesek <= 0 || dogovorjeniZnesek > dolg + 0.009) {
        state.error = "Vnesite dogovorjeni znesek, ki ne presega preostalega dolga.";
        return null;
      }
      var rokNedenarnePoravnave = tip === "compensation"
        ? (nastavitve.dateMode === "custom" ? nastavitve.settledAt : new Date().toISOString())
        : (nastavitve.datumKoraka || null);
      return { actionType: "payment_promised", settings: Object.assign(settings, {
        waitDays: dneviCakanjaZaDogovor(rokNedenarnePoravnave), agreedAmount: dogovorjeniZnesek,
        promisedAmount: dogovorjeniZnesek, dueAt: rokNedenarnePoravnave, promisedDate: rokNedenarnePoravnave,
        description: tip === "credit_note" ? efektivenRazlog(nastavitve) : "",
      }) };
    }

    return null;
  }

  function pripraviPoravnavoZaOddajo() {
    var tip = state.selectedSettlementType;
    if (state.customActionActive && jePlacilniEngine()) {
      var opisDrugegaDogovora = String(state.customActionDescription || "").trim();
      if (!opisDrugegaDogovora) {
        state.error = "Na kratko opišite dogovor z dolžnikom.";
        return null;
      }
      return { actionType: "payment_promised", settings: Object.assign({}, state.settingsByAction.payment_promised, { agreementKind: "custom", description: opisDrugegaDogovora, agreedAt: state.poravnavaDogovorAt || new Date().toISOString(), source: "manual" }) };
    }
    var pripravljeniDogovor = pripraviDogovorZaOddajo(tip);
    if (pripravljeniDogovor !== undefined) return pripravljeniDogovor;
    if (tip === "unpaid_installment" && (jeVnosZgodovine() || jePlacilniDogodkovniTip(tip))) {
      var neplacan = state.settlementSettings.unpaid_installment;
      var stevilkaObrokaNeznana = neplacan.installmentNumberUnknown === true;
      var stevilkaObroka = Math.floor(Number(neplacan.installmentNumber));
      if (!stevilkaObrokaNeznana && (!Number.isInteger(stevilkaObroka) || stevilkaObroka < 1 || stevilkaObroka > 99)) {
        state.error = "Vnesite številko neplačanega obroka ali izberite Ne vem.";
        return null;
      }
      if (!zgodovinaDatumJeVeljaven(neplacan, "dueAt")) {
        state.error = "Izberite rok plačila, Približno ali Ne vem.";
        return null;
      }
      return { actionType: "history_custom", settings: { description: stevilkaObrokaNeznana ? "Neplačan obrok (številka ni znana)" : stevilkaObroka + ". obrok ni plačan", installmentNumber: stevilkaObrokaNeznana ? null : stevilkaObroka, installmentNumberUnknown: stevilkaObrokaNeznana, occurredAt: neplacan.dueAt, occurredAtUnknown: neplacan.dueAtUnknown === true, occurredAtApproximation: zgodovinaDatumPriblizno(neplacan, "dueAt") || null } };
    }
    if (tip === "full" && jeVnosZgodovine()) {
      var polno = state.settlementSettings.full;
      if (!zgodovinaDatumJeVeljaven(polno, "datumKoraka")) {
        state.error = "Izberite datum plačila, Približno ali Ne vem.";
        return null;
      }
      if (!String(polno.paymentMethod || "")) {
        state.error = "Izberite način plačila ali Ne vem.";
        return null;
      }
      if (polno.datumKorakaUnknown === true || zgodovinaDatumPriblizno(polno, "datumKoraka")) {
        return { actionType: "history_custom", settings: { eventKind: "paid_in_full", description: "Račun je bil plačan v celoti", paymentAmount: preostaliDolgPoNacrtu(), paymentMethod: polno.paymentMethod, occurredAt: null, occurredAtUnknown: polno.datumKorakaUnknown === true, occurredAtApproximation: zgodovinaDatumPriblizno(polno, "datumKoraka") || null } };
      }
      return { actionType: "paid_in_full", settings: { settlementType: "full", settledAt: polno.datumKoraka, paymentMethod: polno.paymentMethod, occurredAtUnknown: false } };
    }
    if (tip === "installment" && jeVnosZgodovine() && state.settlementSettings.installment.historyMode === "agreement") {
      var dogovorObrokov = state.settlementSettings.installment;
      var planerDogovora = dogovorObrokov.planer;
      var dogovorjeneVrstice = planerDogovora && Array.isArray(planerDogovora.obroki) ? planerDogovora.obroki : [];
      var steviloDogovorjenihObrokov = dogovorjeneVrstice.length;
      if (!Number.isInteger(steviloDogovorjenihObrokov) || steviloDogovorjenihObrokov < 2 || steviloDogovorjenihObrokov > 20) {
        state.error = "Dodajte najmanj dva in največ 20 obrokov.";
        return null;
      }
      if (!zgodovinaDatumJeVeljaven(dogovorObrokov, "agreementDate")) {
        state.error = "Izberite datum dogovora, Približno ali Ne vem.";
        return null;
      }
      var vsotaDogovora = 0;
      var neveljavenObrok = dogovorjeneVrstice.some(function (vrstica) {
        var znesekObroka = Number(vrstica && vrstica.znesek);
        var datumObrokaVeljaven = Boolean(datumZaVnosPreprost(vrstica && vrstica.datum)) || Boolean(vrstica && vrstica.datumNeznan === true) || Boolean(String(vrstica && vrstica.datumPriblizno || "").trim());
        if (!Number.isFinite(znesekObroka) || znesekObroka <= 0 || !datumObrokaVeljaven) return true;
        vsotaDogovora += znesekObroka;
        return false;
      });
      if (neveljavenObrok) {
        state.error = "Vsak obrok potrebuje znesek in datum.";
        return null;
      }
      if (vsotaDogovora > preostaliDolgPoNacrtu() + 0.009) {
        state.error = "Vsota obrokov ne sme preseči preostalega dolga.";
        return null;
      }
      var opisDogovora = String(dogovorObrokov.description || "").trim() || "Dogovorjeno plačilo v " + steviloDogovorjenihObrokov + " obrokih";
      return { actionType: "history_custom", settings: { eventKind: "installment_agreement", description: opisDogovora, installmentCount: steviloDogovorjenihObrokov, installments: dogovorjeneVrstice.map(function (vrstica) { return { amount: Number(vrstica.znesek), dueAt: vrstica.datum, dueAtUnknown: vrstica.datumNeznan === true, dueAtApproximation: String(vrstica.datumPriblizno || "").trim() || null }; }), plannedTotal: Math.round(vsotaDogovora * 100) / 100, occurredAt: dogovorObrokov.agreementDate, occurredAtUnknown: dogovorObrokov.agreementDateUnknown === true, occurredAtApproximation: zgodovinaDatumPriblizno(dogovorObrokov, "agreementDate") || null } };
    }
    if (tip === "payment_promised" && jeVnosZgodovine()) {
      var obljubaZgodovina = state.settingsByAction.payment_promised;
      if (!obljubaZgodovina.occurredAt && obljubaZgodovina.occurredAtUnknown !== true && !String(obljubaZgodovina.occurredAtApproximation || "").trim()) {
        state.error = "Izberite datum dogovora ali označite Ne vem.";
        return null;
      }
      if (!zgodovinaDatumJeVeljaven(obljubaZgodovina, "promisedDate")) {
        state.error = "Izberite rok plačila, Približno ali Ne vem.";
        return null;
      }
      if (!String(obljubaZgodovina.communicationChannel || "")) {
        state.error = "Izberite način komunikacije ali Ne vem.";
        return null;
      }
      var nacinDogovora = ["request", "approved"].indexOf(obljubaZgodovina.historyMode) >= 0 ? obljubaZgodovina.historyMode : "promise";
      if (nacinDogovora !== "promise") {
        var naslovRoka = nacinDogovora === "approved" ? "Odobren je bil nov rok plačila" : "Dolžnik je prosil za nov rok plačila";
        return { actionType: "history_custom", settings: { eventKind: "deadline_extension", extensionStatus: nacinDogovora, description: String(obljubaZgodovina.description || "").trim() || naslovRoka, occurredAt: obljubaZgodovina.occurredAt, occurredAtUnknown: obljubaZgodovina.occurredAtUnknown === true, occurredAtApproximation: zgodovinaDatumPriblizno(obljubaZgodovina, "occurredAt") || null, promisedDate: obljubaZgodovina.promisedDate, promisedDateUnknown: obljubaZgodovina.promisedDateUnknown === true, promisedDateApproximation: zgodovinaDatumPriblizno(obljubaZgodovina, "promisedDate") || null, communicationChannel: obljubaZgodovina.communicationChannel } };
      }
      return { actionType: "payment_promised", settings: Object.assign({}, obljubaZgodovina, { occurredAt: obljubaZgodovina.occurredAt || null }) };
    }
    if (["payment_failed", "invoice_dispute", "insolvency"].indexOf(tip) >= 0 && (jeVnosZgodovine() || jePlacilniDogodkovniTip(tip))) {
      var posebenDogodek = state.settlementSettings[tip];
      if (!zgodovinaDatumJeVeljaven(posebenDogodek, "occurredAt")) {
        state.error = "Izberite datum dogodka, Približno ali Ne vem.";
        return null;
      }
      if (!String(posebenDogodek.description || "").trim()) {
        state.error = "Na kratko opišite dogodek.";
        return null;
      }
      if (tip === "payment_failed" && !String(posebenDogodek.paymentMethod || "")) {
        state.error = "Izberite način plačila ali Ne vem.";
        return null;
      }
      if (tip === "invoice_dispute" && !String(posebenDogodek.communicationChannel || "")) {
        state.error = "Izberite način komunikacije ali Ne vem.";
        return null;
      }
      return { actionType: "history_custom", settings: { eventKind: tip, description: String(posebenDogodek.description).trim(), occurredAt: posebenDogodek.occurredAt, occurredAtUnknown: posebenDogodek.occurredAtUnknown === true, occurredAtApproximation: zgodovinaDatumPriblizno(posebenDogodek, "occurredAt") || null, paymentMethod: posebenDogodek.paymentMethod || null, communicationChannel: posebenDogodek.communicationChannel || null, documentReference: posebenDogodek.documentReference || null } };
    }
    if (tip === "payment_promised") {
      return { actionType: "payment_promised", settings: state.settingsByAction.payment_promised };
    }
    var nastavitve = state.settlementSettings[tip];
    var dolg = preostaliDolgPoNacrtu();
    if (!tip || !nastavitve) return null;

    if (tip === "partial" || tip === "installment") {
      var znesekVneseno = Number(nastavitve.paymentAmount);
      var presegaPreostaliDolg = znesekVneseno > dolg + 0.009;
      var delnoPlaciloPoravnaVesDolg = tip === "partial" && znesekVneseno >= dolg;
      if (!Number.isFinite(znesekVneseno) || znesekVneseno <= 0 || presegaPreostaliDolg || delnoPlaciloPoravnaVesDolg) {
        state.error = "Vnesite prejeti znesek, ki je večji od 0 in ne presega preostalega dolga.";
        return null;
      }
      if (jeVnosZgodovine() && !zgodovinaDatumJeVeljaven(nastavitve, "datumKoraka")) {
        state.error = "Izberite datum plačila, Približno ali Ne vem.";
        return null;
      }
      if (jeVnosZgodovine() && !String(nastavitve.paymentMethod || "")) {
        state.error = "Izberite način plačila ali Ne vem.";
        return null;
      }
      var settledAtVneseno = nastavitve.datumKoraka || new Date().toISOString();
      return { actionType: "partial_payment", settings: { paymentAmount: znesekVneseno, settlementType: tip, settledAt: settledAtVneseno, paymentMethod: nastavitve.paymentMethod || null, occurredAtUnknown: nastavitve.datumKorakaUnknown === true, occurredAtApproximation: zgodovinaDatumPriblizno(nastavitve, "datumKoraka") || null } };
    }

    if (tip === "credit_note") {
      var vnesenDobropis = Number(nastavitve.settlementAmount);
      if (!Number.isFinite(vnesenDobropis) || vnesenDobropis <= 0) {
        state.error = "Vnesite znesek dobropisa ali odpusta.";
        return null;
      }
      if (vnesenDobropis > dolg + 0.009) {
        state.error = "Znesek ne sme presegati preostalega dolga.";
        return null;
      }
      var kindDobropisOdpust = nastavitve.kind === "writeoff" ? "writeoff" : "credit";
      var datumDobropisa = jeVnosZgodovine() && nastavitve.datumKoraka ? nastavitve.datumKoraka : new Date().toISOString();
      if (kindDobropisOdpust === "writeoff" && !efektivenRazlog(nastavitve)) {
        state.error = "Izberite razlog za odpust.";
        return null;
      }
      if (Math.abs(vnesenDobropis - dolg) <= 0.009) {
        return { actionType: "paid_in_full", settings: { settlementType: tip, kind: kindDobropisOdpust, settlementAmount: dolg, reason: kindDobropisOdpust === "writeoff" ? efektivenRazlog(nastavitve) : null, settledAt: datumDobropisa } };
      }
      return { actionType: "partial_settlement", settings: { kind: kindDobropisOdpust, amount: vnesenDobropis, reason: kindDobropisOdpust === "writeoff" ? efektivenRazlog(nastavitve) : null, settledAt: datumDobropisa } };
    }

    if (tip === "compensation" && jeVnosZgodovine()) {
      var vnesenaKompenzacija = Number(nastavitve.settlementAmount);
      if (!Number.isFinite(vnesenaKompenzacija) || vnesenaKompenzacija <= 0) {
        state.error = "Vnesite znesek kompenzacije.";
        return null;
      }
      if (vnesenaKompenzacija > dolg + 0.009) {
        state.error = "Znesek kompenzacije ne sme presegati preostalega dolga.";
        return null;
      }
      var datumKompenzacije = nastavitve.dateMode === "custom" ? nastavitve.settledAt : new Date().toISOString();
      if (!datumKompenzacije) {
        state.error = "Izberite datum kompenzacije.";
        return null;
      }
      if (Math.abs(vnesenaKompenzacija - dolg) <= 0.009) {
        return { actionType: "paid_in_full", settings: { settlementType: tip, settlementAmount: dolg, settledAt: datumKompenzacije } };
      }
      return { actionType: "partial_settlement", settings: { kind: "compensation", amount: vnesenaKompenzacija, settledAt: datumKompenzacije } };
    }

    if (tip === "cancelled_invoice") {
      if (!efektivenRazlog(nastavitve)) {
        state.error = "Izberite razlog za storno računa.";
        return null;
      }
      return { actionType: "paid_in_full", settings: { settlementType: tip, reason: efektivenRazlog(nastavitve), settledAt: (jeVnosZgodovine() || jePlacilniDogodkovniTip(tip)) && nastavitve.datumKoraka ? nastavitve.datumKoraka : new Date().toISOString() } };
    }

    var datum = nastavitve.dateMode === "custom" ? nastavitve.settledAt : new Date().toISOString();
    if (!datum) {
      state.error = "Izberite datum zaključka.";
      return null;
    }
    return { actionType: "paid_in_full", settings: { settlementType: tip, settledAt: datum } };
  }

  function opisNacrtovanegaKoraka(tip, pripravljeno) {
    var s = pripravljeno.settings || {};
    if (s.agreementKind === "custom") return { naslov: "Drug dogovor", znesek: null, ikona: "pencil", razred: "drugo", datum: null };
    if (tip === "unpaid_installment") return { naslov: s.description, znesek: null, ikona: "clock", razred: "neplacan-obrok", datum: s.occurredAt, datumNeznan: s.occurredAtUnknown === true, datumPriblizno: String(s.occurredAtApproximation || "").trim() };
    if (s.eventKind) {
      var posebniMeta = {
        paid_in_full: { naslov: "Plačano v celoti", ikona: "receiptCheck", razred: "placano-v-celoti", znesek: preostaliDolgPoNacrtu() },
        installment_agreement: { naslov: "Dogovor o obrokih", ikona: "calendarArrow", razred: "obrok", znesek: null },
        deadline_extension: { naslov: s.extensionStatus === "approved" ? "Odobren nov rok plačila" : "Prošnja za nov rok plačila", ikona: "calendarArrow", razred: "obljuba", znesek: null },
        payment_failed: { naslov: "Plačilo ni uspelo", ikona: "warning", razred: "neuspesno-placilo", znesek: null },
        remaining_unpaid: { naslov: "Preostanek ni plačan", ikona: "clock", razred: "neplacan-obrok", znesek: null },
        invoice_dispute: { naslov: "Ugovor / reklamacija", ikona: "messageX", razred: "ugovor", znesek: null },
        insolvency: { naslov: "Stečaj / insolventnost", ikona: "shield", razred: "insolventnost", znesek: null },
      }[s.eventKind];
      if (posebniMeta) return { naslov: posebniMeta.naslov, znesek: posebniMeta.znesek, ikona: posebniMeta.ikona, razred: posebniMeta.razred, datum: s.occurredAt, datumNeznan: s.occurredAtUnknown === true, datumPriblizno: String(s.occurredAtApproximation || "").trim() };
    }
    if (pripravljeno.actionType === "payment_promised") {
      var obljubaDatumBesedilo = s.promisedDate ? datumSamoZaPrikaz(s.promisedDate) : "";
      var dogovorMeta = !jeVnosZgodovine() && DOGOVOR_META[tip] ? DOGOVOR_META[tip] : null;
      return { naslov: (dogovorMeta ? dogovorMeta.naslov : (jeVnosZgodovine() ? "Plačilo je bilo obljubljeno" : "Dolžnik je obljubil plačilo")) + (obljubaDatumBesedilo ? " do " + obljubaDatumBesedilo : ""), znesek: null, ikona: dogovorMeta ? dogovorMeta.ikona : "handshake", razred: dogovorMeta ? dogovorMeta.razred : "obljuba", datum: s.agreedAt || s.occurredAt || null, datumNeznan: s.occurredAtUnknown === true, datumPriblizno: String(s.occurredAtApproximation || "").trim() };
    }
    var meta = jeVnosZgodovine() ? ZGODOVINA_META[tip] : SETTLEMENT_META[tip];
    if (tip === "compensation") {
      return { naslov: meta.naslov, znesek: Number(s.amount != null ? s.amount : s.settlementAmount) || preostaliDolgPoNacrtu(), ikona: meta.ikona, razred: meta.razred, datum: s.settledAt };
    }
    if (pripravljeno.actionType === "partial_payment") {
      return { naslov: meta.naslov, znesek: Number(s.paymentAmount) || 0, ikona: meta.ikona, razred: meta.razred, datum: s.settledAt, datumNeznan: s.occurredAtUnknown === true, datumPriblizno: String(s.occurredAtApproximation || "").trim() };
    }
    if (pripravljeno.actionType === "partial_settlement") {
      var jeOdpust = s.kind === "writeoff";
      var jeKompenzacija = s.kind === "compensation";
      return { naslov: jeOdpust ? "Odpust" : (jeKompenzacija ? "Kompenzacija (pobot)" : "Dobropis"), znesek: Number(s.amount) || 0, ikona: jeOdpust ? "documentX" : (jeKompenzacija ? "scales" : "tag"), razred: jeOdpust ? "storno" : (jeKompenzacija ? "kompenzacija" : "dobropis"), datum: s.settledAt };
    }
    if (tip === "credit_note") {
      var jePolniOdpust = s.kind === "writeoff";
      return { naslov: jePolniOdpust ? "Odpust" : "Dobropis", znesek: Number(s.settlementAmount) || preostaliDolgPoNacrtu(), ikona: jePolniOdpust ? "documentX" : "tag", razred: jePolniOdpust ? "storno" : "dobropis", datum: s.settledAt };
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
      datumNeznan: opis.datumNeznan === true,
      datumPriblizno: String(opis.datumPriblizno || "").trim(),
    });
    if (opis.datumNeznan === true) {
      var zadnjiKorak = state.nacrtKoraki[state.nacrtKoraki.length - 1];
      zadnjiKorak.datum = null;
      zadnjiKorak.settings = Object.assign({}, zadnjiKorak.settings, { settledAt: null, occurredAt: null, occurredAtUnknown: true });
    }
    if (pripravljeno.settings && pripravljeno.settings.agreementKind === "custom") {
      state.customActionActive = false;
      state.customActionDescription = "";
      state.selectedSettlementType = null;
    }
    if (tip === "partial" || tip === "installment") {
      state.settlementSettings[tip].paymentAmount = null;
      state.settlementSettings[tip].reason = "";
      state.settlementSettings[tip].customReason = "";
      state.settlementSettings[tip].datumKoraka = null;
      state.settlementSettings[tip].datumKorakaUnknown = false;
      state.settlementSettings[tip].datumKorakaApproximation = "";
      state.settlementSettings[tip].datumKorakaApproximate = false;
      state.settlementSettings[tip].paymentMethod = null;
    }
    if (tip === "unpaid_installment") state.settlementSettings.unpaid_installment = JSON.parse(JSON.stringify(DEFAULT_SETTLEMENT_SETTINGS.unpaid_installment));
    if (jeVnosZgodovine() && tip === "installment") state.settlementSettings.installment = JSON.parse(JSON.stringify(DEFAULT_SETTLEMENT_SETTINGS.installment));
    if ((jeVnosZgodovine() || jePlacilniDogodkovniTip(tip)) && ["full", "payment_failed", "invoice_dispute", "insolvency"].indexOf(tip) >= 0) state.settlementSettings[tip] = JSON.parse(JSON.stringify(DEFAULT_SETTLEMENT_SETTINGS[tip]));
    if (jeVnosZgodovine() && tip === "payment_promised") state.settingsByAction.payment_promised = JSON.parse(JSON.stringify(DEFAULT_ACTION_SETTINGS.payment_promised));
    state.error = null;
    return true;
  }

  function datumKandidataIzCasovnegaZiga(vrednost) {
    var surovo = String(vrednost || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(surovo)) return surovo;
    var datum = surovo ? new Date(surovo) : null;
    return datum && !Number.isNaN(datum.getTime()) ? datum.toISOString().slice(0, 10) : null;
  }

  function kandidatnaPogodba(tip) {
    var pogodbe = {
      partial_payment: [["amount", "occurredDate", "paymentMethod"], ["amount", "occurredDate", "paymentMethod"]],
      paid_in_full: [["amount", "occurredDate", "paymentMethod"], ["amount", "occurredDate", "paymentMethod"]],
      installment_payment: [["amount", "occurredDate", "paymentMethod"], ["amount", "occurredDate", "paymentMethod"]],
      unpaid_installment: [["occurredDate"], ["occurredDate"]],
      installment_agreement: [["occurredDate", "description"], ["occurredDate", "description"]],
      payment_promise: [["amount", "occurredDate", "promisedDate", "communicationChannel"], ["occurredDate", "promisedDate", "communicationChannel"]],
      deadline_extension: [["occurredDate", "promisedDate", "communicationChannel", "description"], ["occurredDate", "promisedDate", "communicationChannel", "description"]],
      payment_failed: [["occurredDate", "paymentMethod", "description"], ["occurredDate", "paymentMethod", "description"]],
      invoice_dispute: [["occurredDate", "communicationChannel", "description"], ["occurredDate", "communicationChannel", "description"]],
      insolvency: [["occurredDate", "description"], ["occurredDate", "description"]],
      credit_note: [["amount", "occurredDate"], ["amount", "occurredDate"]],
      compensation: [["amount", "occurredDate"], ["amount", "occurredDate"]],
      cancelled_invoice: [["occurredDate", "reason"], ["occurredDate", "reason"]],
      reminder_sent: [["occurredDate", "communicationChannel"], ["occurredDate", "communicationChannel"]],
    };
    var pogodba = pogodbe[tip] || [["occurredDate", "description"], ["occurredDate", "description"]];
    return { fieldOrder: pogodba[0].slice(), requiredFields: pogodba[1].slice() };
  }

  function pripraviKandidatIzIzbire() {
    var uiTip = state.selectedSettlementType;
    var pripravljeno = pripraviPoravnavoZaOddajo();
    if (!pripravljeno) return { ok: false, error: state.error || "Preverite podatke dogodka." };
    var s = pripravljeno.settings || {};
    var tip = uiTip === "partial" ? "partial_payment"
      : uiTip === "full" ? "paid_in_full"
      : uiTip === "installment" ? (s.eventKind === "installment_agreement" ? "installment_agreement" : "installment_payment")
      : uiTip === "payment_promised" ? (s.eventKind === "deadline_extension" ? "deadline_extension" : "payment_promise")
      : uiTip;
    if (uiTip === "credit_note" && s.kind === "writeoff") tip = "cancelled_invoice";
    var pogodba = kandidatnaPogodba(tip);
    var occurredAt = s.occurredAt || s.settledAt || null;
    var kandidat = {
      type: tip,
      amount: ["paid_in_full", "partial_payment", "installment_payment", "credit_note", "compensation"].indexOf(tip) >= 0
        ? Number(s.paymentAmount != null ? s.paymentAmount : s.amount != null ? s.amount : s.settlementAmount != null ? s.settlementAmount : preostaliDolgPoNacrtu()) || null
        : (tip === "payment_promise" && Number(s.promisedAmount) > 0 ? Number(s.promisedAmount) : null),
      occurredDate: datumKandidataIzCasovnegaZiga(occurredAt),
      occurredDateUnknown: s.occurredAtUnknown === true,
      occurredDateApproximate: Boolean(String(s.occurredAtApproximation || "").trim()),
      occurredDateApproximation: String(s.occurredAtApproximation || "").trim(),
      promisedDate: datumKandidataIzCasovnegaZiga(s.promisedDate),
      promisedDateUnknown: s.promisedDateUnknown === true,
      promisedDateApproximate: Boolean(String(s.promisedDateApproximation || "").trim()),
      promisedDateApproximation: String(s.promisedDateApproximation || "").trim(),
      paymentMethod: s.paymentMethod || null,
      communicationChannel: s.communicationChannel || null,
      reason: tip === "cancelled_invoice" ? String(s.reason || "").trim() : null,
      description: String(s.description || "").trim(),
      documentReference: s.documentReference || null,
      fieldOrder: pogodba.fieldOrder,
      requiredFields: pogodba.requiredFields,
      missing: [],
      dateRelation: null,
    };
    if (tip === "unpaid_installment") kandidat.description = String(s.description || "Neplačan obrok").trim();
    if (tip === "installment_agreement") {
      kandidat.installmentCount = Number(s.installmentCount) || null;
      kandidat.installments = Array.isArray(s.installments) ? s.installments : [];
    }
    state.error = null;
    return { ok: true, candidate: kandidat };
  }

  function datumKandidata(vrednost) {
    var text = String(vrednost || "");
    var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    var datum = new Date(text + "T12:00:00");
    return !Number.isNaN(datum.getTime()) && datum.getFullYear() === Number(match[1]) && datum.getMonth() + 1 === Number(match[2]) && datum.getDate() === Number(match[3])
      ? datum.toISOString()
      : null;
  }

  function uporabiKandidatniDogodek(kandidat) {
    var tip = String(kandidat && kandidat.type || "");
    var datum = datumKandidata(kandidat && kandidat.occurredDate);
    var datumNeznan = Boolean(kandidat && kandidat.occurredDateUnknown === true);
    var datumPriblizno = String(kandidat && kandidat.occurredDateApproximation || "").trim();
    var znesek = Number(kandidat && kandidat.amount);
    if (["custom", "debtor_statement", "remaining_unpaid", "unpaid_installment", "installment_agreement", "deadline_extension", "payment_failed", "invoice_dispute", "insolvency", "reminder_sent"].indexOf(tip) >= 0) {
      var opis = String(kandidat.description || (tip === "unpaid_installment" ? "Neplačan obrok" : tip === "reminder_sent" ? "Opomin za plačilo je bil poslan." : "")).trim();
      if (!opis || (!datum && !datumNeznan && !datumPriblizno)) { state.error = "Dopolnite opis in datum dogodka, približni čas ali izberite Ne vem."; return false; }
      if (tip === "remaining_unpaid" && (!Number.isFinite(znesek) || znesek <= 0)) { state.error = "Dopolnite neplačani preostanek."; return false; }
      if (["debtor_statement", "remaining_unpaid", "invoice_dispute", "deadline_extension", "reminder_sent"].indexOf(tip) >= 0 && !String(kandidat.communicationChannel || "")) { state.error = "Izberite način komunikacije."; return false; }
      if (tip === "payment_failed" && !String(kandidat.paymentMethod || "")) { state.error = "Izberite način neuspelega plačila."; return false; }
      var noviRok = tip === "deadline_extension" ? datumKandidata(kandidat.promisedDate) : null;
      var noviRokNeznan = tip === "deadline_extension" && kandidat.promisedDateUnknown === true;
      var noviRokPriblizno = tip === "deadline_extension" ? String(kandidat.promisedDateApproximation || "").trim() : "";
      if (tip === "deadline_extension" && !noviRok && !noviRokNeznan && !noviRokPriblizno) { state.error = "Dopolnite novi rok plačila, približni čas ali izberite Ne vem."; return false; }
      var opisniMeta = {
        debtor_statement: { naslov: "Ugovor / zavrnitev", ikona: "messageX", razred: "ugovor" },
        remaining_unpaid: { naslov: "Preostanek ni plačan", ikona: "clock", razred: "neplacan-obrok" },
        unpaid_installment: { naslov: opis, ikona: "clock", razred: "neplacan-obrok" },
        installment_agreement: { naslov: "Dogovor o obrokih", ikona: "calendarArrow", razred: "obrok" },
        deadline_extension: { naslov: "Nov rok plačila", ikona: "calendarArrow", razred: "obljuba" },
        payment_failed: { naslov: "Plačilo ni uspelo", ikona: "warning", razred: "neuspesno-placilo" },
        invoice_dispute: { naslov: "Ugovor / reklamacija", ikona: "messageX", razred: "ugovor" },
        insolvency: { naslov: "Stečaj / insolventnost", ikona: "shield", razred: "insolventnost" },
        reminder_sent: { naslov: "Poslan opomin", ikona: "receiptCheck", razred: "akcija-opomin" },
        custom: { naslov: opis, ikona: "pencil", razred: "drugo" },
      }[tip];
      state.nacrtKoraki.push({
        tip: tip === "custom" ? "history_custom" : tip,
        actionType: "history_custom",
        settings: {
          description: opis,
          eventKind: tip === "custom" ? null : tip,
          occurredAt: datum,
          occurredAtUnknown: datumNeznan,
          occurredAtApproximation: datumPriblizno || null,
          promisedDate: noviRok,
          promisedDateUnknown: noviRokNeznan,
          promisedDateApproximation: noviRokPriblizno || null,
          paymentMethod: kandidat.paymentMethod || null,
          communicationChannel: kandidat.communicationChannel || null,
          statementKind: tip === "debtor_statement" ? "payment_refusal" : null,
          documentReference: kandidat.documentReference || null,
          remainingAmount: tip === "remaining_unpaid" || tip === "unpaid_installment" ? znesek : null,
        },
        naslov: opisniMeta.naslov,
        znesek: null,
        ikona: opisniMeta.ikona,
        razred: opisniMeta.razred,
        datum: datum,
        datumNeznan: datumNeznan,
        datumPriblizno: datumPriblizno,
        assistedCandidateId: kandidat.candidateId || null,
      });
      return true;
    }
    if (!datum && !datumNeznan && !datumPriblizno) { state.error = "Dopolnite datum dogodka, približni čas ali izberite Ne vem."; return false; }
    if (tip === "payment_promise") {
      var promisedDate = datumKandidata(kandidat.promisedDate);
      var promisedDateUnknown = Boolean(kandidat.promisedDateUnknown === true);
      var promisedDateApproximation = String(kandidat.promisedDateApproximation || "").trim();
      if (!promisedDate && !promisedDateUnknown && !promisedDateApproximation) { state.error = "Dopolnite obljubljeni datum plačila, približni čas ali izberite Ne vem."; return false; }
      state.selectedSettlementType = "payment_promised";
      state.settingsByAction.payment_promised = Object.assign({}, state.settingsByAction.payment_promised, {
        promisedAmount: Number.isFinite(znesek) && znesek > 0 ? znesek : null,
        promisedDate: promisedDate,
        promisedDateUnknown: promisedDateUnknown,
        promisedDateApproximation: promisedDateApproximation,
        occurredAt: datum,
        occurredAtApproximation: datumPriblizno,
        communicationChannel: kandidat.communicationChannel || null,
      });
    } else if (tip === "paid_in_full") {
      if (!Number.isFinite(znesek) || znesek <= 0) { state.error = "Dopolnite celotni plačani znesek."; return false; }
      state.selectedSettlementType = "full";
      state.settlementSettings.full.datumKoraka = datum;
      state.settlementSettings.full.datumKorakaUnknown = datumNeznan;
      state.settlementSettings.full.datumKorakaApproximation = datumPriblizno;
      state.settlementSettings.full.datumKorakaApproximate = Boolean(datumPriblizno);
      state.settlementSettings.full.paymentMethod = kandidat.paymentMethod || "unknown";
    } else if (tip === "partial_payment" || tip === "installment_payment") {
      if (!Number.isFinite(znesek) || znesek <= 0) { state.error = "Dopolnite veljaven znesek plačila."; return false; }
      state.selectedSettlementType = tip === "installment_payment" ? "installment" : "partial";
      state.settlementSettings[state.selectedSettlementType].paymentAmount = znesek;
      state.settlementSettings[state.selectedSettlementType].datumKoraka = datum;
      state.settlementSettings[state.selectedSettlementType].datumKorakaUnknown = datumNeznan;
      state.settlementSettings[state.selectedSettlementType].datumKorakaApproximation = datumPriblizno;
      state.settlementSettings[state.selectedSettlementType].datumKorakaApproximate = Boolean(datumPriblizno);
      state.settlementSettings[state.selectedSettlementType].paymentMethod = kandidat.paymentMethod || "unknown";
    } else if (tip === "credit_note") {
      if (!Number.isFinite(znesek) || znesek <= 0) { state.error = "Dopolnite veljaven znesek dobropisa."; return false; }
      state.selectedSettlementType = "credit_note";
      state.settlementSettings.credit_note.kind = "credit";
      state.settlementSettings.credit_note.settlementAmount = znesek;
      state.settlementSettings.credit_note.rocnoUrejeno = true;
      state.settlementSettings.credit_note.datumKoraka = datum || new Date().toISOString();
    } else if (tip === "compensation") {
      if (!Number.isFinite(znesek) || znesek <= 0) { state.error = "Dopolnite veljaven znesek kompenzacije."; return false; }
      state.selectedSettlementType = "compensation";
      state.settlementSettings.compensation.settlementAmount = znesek;
      state.settlementSettings.compensation.rocnoUrejeno = true;
      state.settlementSettings.compensation.dateMode = "custom";
      state.settlementSettings.compensation.settledAt = datum || new Date().toISOString();
    } else if (tip === "cancelled_invoice") {
      var razlog = String(kandidat.reason || "").trim();
      if (!razlog) { state.error = "Dopolnite razlog za odpis ali odstop."; return false; }
      state.selectedSettlementType = "cancelled_invoice";
      var cancelledSettings = state.settlementSettings.cancelled_invoice;
      cancelledSettings.reason = "other";
      cancelledSettings.customReason = razlog;
      cancelledSettings.datumKoraka = datum || new Date().toISOString();
    } else {
      state.error = "Tega predlaganega dogodka ni mogoče dodati.";
      return false;
    }
    var added = dodajKorakVNacrt();
    if (added) {
      var dodaniKorak = state.nacrtKoraki[state.nacrtKoraki.length - 1];
      dodaniKorak.assistedCandidateId = kandidat.candidateId || null;
      dodaniKorak.settings = Object.assign({}, dodaniKorak.settings, {
        paymentMethod: kandidat.paymentMethod || null,
        communicationChannel: kandidat.communicationChannel || null,
        documentReference: kandidat.documentReference || null,
        sourceDescription: kandidat.description || null,
        occurredAtUnknown: datumNeznan,
        occurredAtApproximation: datumPriblizno || null,
        promisedDateUnknown: Boolean(kandidat.promisedDateUnknown === true),
        promisedDateApproximation: String(kandidat.promisedDateApproximation || "").trim() || null,
      });
      if (datumPriblizno) dodaniKorak.datumPriblizno = datumPriblizno;
      if (datumNeznan) {
        dodaniKorak.datum = null;
        dodaniKorak.datumNeznan = true;
        dodaniKorak.settings.settledAt = null;
        dodaniKorak.settings.occurredAt = null;
      }
    }
    return added;
  }

  function dodajKandidatneDogodke(kandidati) {
    var pripravljeni = Array.isArray(kandidati) ? kandidati : [];
    if (!pripravljeni.length || pripravljeni.length > 20) return { ok: false, error: "Ni pripravljenih dogodkov za potrditev." };
    var seznam = pripravljeni.filter(function (kandidat) {
      return kandidat && kandidat.type !== "remaining_unpaid";
    });
    if (!seznam.length) return { ok: false, error: "Ni dejanskih dogodkov za potrditev." };
    var snapshot = {
      nacrtKoraki: kopirajPodatke(state.nacrtKoraki),
      settlementSettings: kopirajPodatke(state.settlementSettings),
      settingsByAction: kopirajPodatke(state.settingsByAction),
      selectedSettlementType: state.selectedSettlementType,
    };
    var prejsnjiAssistedHistoryInput = state.assistedHistoryInputActive;
    state.assistedHistoryInputActive = true;
    state.error = null;
    try {
      for (var i = 0; i < seznam.length; i += 1) {
        if (!uporabiKandidatniDogodek(seznam[i])) {
          state.nacrtKoraki = snapshot.nacrtKoraki;
          state.settlementSettings = snapshot.settlementSettings;
          state.settingsByAction = snapshot.settingsByAction;
          state.selectedSettlementType = snapshot.selectedSettlementType;
          return { ok: false, index: i, error: state.error || "Preverite podatke dogodka." };
        }
      }
    } finally {
      state.assistedHistoryInputActive = prejsnjiAssistedHistoryInput;
    }
    state.selectedSettlementType = null;
    state.error = null;
    return { ok: true, added: seznam.length };
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
    if (zavrniSprememboCeSamoZaBranje()) return;
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
    state.boPlacalHitraIzbira = false;
    state.customActionActive = false;
    state.customActionDescription = "";
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

  function pomakniPotekNaDno(steviloDodanih) {
    requestAnimationFrame(function () {
      var potek = elActionSheet && elActionSheet.querySelector(".izvedba-poravnava-potek");
      if (!potek) return;
      var kartice = potek.querySelectorAll(".izvedba-poravnava-korak");
      var stevilo = Math.max(1, Number(steviloDodanih) || 1);
      var prvaNova = kartice[Math.max(0, kartice.length - stevilo)];
      var zadnjaNova = kartice[kartice.length - 1];
      for (var i = Math.max(0, kartice.length - stevilo); i < kartice.length; i++) {
        kartice[i].classList.add("is-pravkar-dodan");
      }
      potek.scrollTo({ top: potek.scrollHeight, behavior: "smooth" });
      if (zadnjaNova && typeof zadnjaNova.scrollIntoView === "function") {
        zadnjaNova.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
      if (prvaNova) setTimeout(function () {
        for (var j = Math.max(0, kartice.length - stevilo); j < kartice.length; j++) {
          kartice[j].classList.remove("is-pravkar-dodan");
        }
      }, 720);
    });
  }

  async function nastaviNovNacrt() {
    if (zavrniSprememboCeSamoZaBranje()) return;
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
    if (zavrniSprememboCeSamoZaBranje()) return;
    if (state.isSubmitting) return;
    var jePoravnavaTip = state.actionSheetMode === "payment" || state.selectedActionType === "partial_payment" || state.selectedActionType === "cancelled_invoice";
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
      if (err && err.podatki) obravnavajNapakoUkrepa(err.podatki);
      else state.error = err.message || "Dejanja trenutno ni bilo mogoče izvesti.";
    } finally {
      state.isSubmitting = false;
      render();
    }
  }

  function obravnavajNapakoUkrepa(odgovor) {
    var koda = odgovor && odgovor.code;
    if (koda === "CASE_RESOLVED") {
      state.error = "Ta primer je že zaključen in ga ni več mogoče spreminjati.";
      state.pendingActionId = null;
      state.pendingActionType = null;
      state.pendingSendActionId = null;
      state.actionSheetOpen = false;
      if (state.zadeva) state.zadeva.status = "Rešeno";
      else state.readonlyRequested = true;
      odkleniOzadjeSheeta();
      return;
    }
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
    if (zavrniSprememboCeSamoZaBranje()) return;
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
      if (err && err.podatki) obravnavajNapakoUkrepa(err.podatki);
      else state.error = err.message || "Sporočila trenutno ni bilo mogoče poslati.";
    } finally {
      state.isSubmitting = false;
      render();
    }
  }

  function racunPoravnan() {
    if (zavrniSprememboCeSamoZaBranje()) return;
    if (state.isSubmitting) return;
    actionSheetReturnFocus = document.activeElement;
    if (typeof window.UJZgodovinaNastaviPrivzetiNacin === "function") {
      window.UJZgodovinaNastaviPrivzetiNacin("natural");
    }
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
    var samoZaBranje = jeSamoZaBranje();
    document.body.classList.toggle("izvedba-readonly", samoZaBranje);
    if (elReadOnlyBanner) elReadOnlyBanner.hidden = !samoZaBranje;
    if (samoZaBranje && state.actionSheetOpen) {
      state.actionSheetOpen = false;
      state.selectedActionType = null;
      state.selectedSettlementType = null;
      state.aktivniFilterKartic = null;
      odkleniOzadjeSheeta();
    }
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
      : (jeSamoZaBranje() ? "Termin ni zabeležen" : "Termin še ni določen");
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
      '<h1 class="zo-sledi__naslov">' + K.esc((jeSamoZaBranje() ? "Zaključen korak: " : "Čas je za ") + zacetnicaMala(step.title || "aktivni opomin")) + "</h1>";
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
    if (jeSamoZaBranje()) {
      if (step && (step.kind === "manual_lawyer" || step.deliveryMode === "manual")) return "Primer je bil pripravljen za predajo izbranemu odvetniku.";
      if (Number(polozaj) <= 1) return "Dolžniku je bil poslan prvi opomin z jasnim pozivom k plačilu.";
      if (Number(polozaj) >= 8) return "Evidentirano je bilo zadnje opozorilo pred nadaljnjimi ukrepi.";
      return "Evidentiran je bil nadaljnji opomin v tem zaključenem primeru.";
    }
    if (step && (step.summary || step.reason)) return step.summary || step.reason;
    if (step.kind === "manual_lawyer" || step.deliveryMode === "manual") {
      return "Ker prejšnji opomini niso bili uspešni, je primer pripravljen za predajo izbranemu odvetniku.";
    }
    if (Number(polozaj) <= 1) return "Dolžniku bo poslan prijazen prvi opomin z jasnim pozivom k plačilu.";
    if (Number(polozaj) >= 8) return "Ker se dolžnik na prejšnje opomine ni odzval, bo prejel zadnje opozorilo pred nadaljnjimi ukrepi.";
    return "Ker se dolžnik na prejšnji opomin ni odzval, mu bo poslan odločneje oblikovan opomin.";
  }

  function izrisiPreklicRazlog(nastavitve) {
    var razlogi = [
      { vrednost: "debtor_agreement", oznaka: "Dogovor z dolžnikom" },
      { vrednost: "wrong_data", oznaka: "Napačni podatki" },
      { vrednost: "not_needed", oznaka: "Opomin ni potreben" },
      { vrednost: "other", oznaka: "Drugo" },
    ];
    var izbrani = String(nastavitve.skipReason || "");
    return '<div class="izvedba-preklic-razlog"><p class="izvedba-preklic-razlog__naslov">Razlog preklica <small>neobvezno</small></p>' +
      '<div class="izvedba-preklic-razlog__moznosti" role="group" aria-label="Razlog preklica">' + razlogi.map(function (razlog) {
        var jeIzbran = izbrani === razlog.vrednost;
        return '<button type="button" class="izvedba-preklic-razlog__moznost' + (jeIzbran ? ' is-selected' : '') + '" data-skip-reason="' + K.esc(razlog.vrednost) + '" aria-pressed="' + String(jeIzbran) + '">' + K.esc(razlog.oznaka) + '</button>';
      }).join('') + '</div>' +
      (izbrani === "other" ? '<textarea class="izvedba-preklic-razlog__opis" data-skip-reason-detail maxlength="300" rows="2" placeholder="Na kratko napišite razlog …" aria-label="Drug razlog preklica">' + K.esc(nastavitve.skipReasonDetail || "") + '</textarea>' : '') +
      '</div>';
  }

  function podatkiZaKartico(actionType, izbrano) {
    var nastavitve = state.settingsByAction[actionType];
    if (actionType === "skip_current_step") {
      var prikazZamika = nastavitve.nextDelayDays === 0 ? "Danes" : null;
      return K.izrisiStevec(actionType, "nextDelayDays", nastavitve.nextDelayDays, nastavitve.nextDelayDays === 1 ? "dan" : "dni", prikazZamika) + izrisiPreklicRazlog(nastavitve);
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
      var obljubaStevec = K.izrisiStevec(actionType, "waitDays", nastavitve.waitDays, "dni");
      if (!izbrano) return obljubaStevec;
      var obljubaZnesekPolje = '<label class="izvedba-znesek" data-action-control><span class="sr-only">Obljubljen znesek</span>' +
        '<input class="izvedba-znesek__vnos" data-znesek-polje="promisedAmount" data-izvedba-fit data-fit-min="9" type="number" inputmode="decimal" step="0.01" min="0.01" value="' + K.esc(nastavitve.promisedAmount != null ? nastavitve.promisedAmount : "") + '" placeholder="Znesek" />' +
        '<span class="izvedba-znesek__ikona izvedba-znesek__ikona--eur" aria-hidden="true">€</span></label>';
      var obljubaDatumPolje = izrisiDatumVnos(actionType, "promisedDate", nastavitve.promisedDate, "Datum obljube");
      return obljubaStevec +
        '<p class="izvedba-poravnava__korak-oznaka">Kaj je obljubil? (neobvezno)</p>' +
        '<div class="izvedba-poravnava-znesek-datum">' + obljubaZnesekPolje + obljubaDatumPolje + '</div>';
    }
    if (actionType === "partial_payment") {
      return izrisiPoravnavaKontrolnik("partial", izbrano);
    }
    if (actionType === "cancelled_invoice") {
      return izrisiPoravnavaKontrolnik("cancelled_invoice", izbrano);
    }
    return "";
  }

  var VRSTNI_RED_KARTIC = [
    "skip_current_step", "stop_plan", "handoff_to_lawyer",
    "postpone_reminder", "payment_promised", "partial_payment", "cancelled_invoice",
  ];

  var ACTION_SHEET_META = {
    skip_current_step: { opis: "Naslednji korak ostane aktiven.", nastavitev: "Naslednji korak čez", badge: "Privzeto", razred: "preklic", ikona: "messageX" },
    stop_plan: { opis: "Prekliče vse prihodnje opomine.", nastavitev: "Ponovni zagon", badge: "Privzeto", razred: "ustavi", ikona: "stopCircle" },
    handoff_to_lawyer: { opis: "Primer pripravi za predajo.", nastavitev: "Čas predaje", badge: "Priporočeno", razred: "odvetnik", ikona: "scales" },
    postpone_reminder: { opis: "Izberete nov datum pošiljanja.", nastavitev: "Prestavi za", badge: "Priporočeno", razred: "prestavi", ikona: "calendarArrow" },
    payment_promised: { opis: "Načrt začasno počaka.", nastavitev: "Počakaj", badge: "Priporočeno", razred: "obljuba", ikona: "handshake" },
    partial_payment: { opis: "Vnesite prejeti znesek.", nastavitev: "Prejeti znesek", badge: "Privzeto", razred: "delno", ikona: "coinCheck" },
    cancelled_invoice: { opis: "Račun je bil storniran in se ne izterjuje.", nastavitev: "Razlog", badge: "Posebno", razred: "storno", ikona: "documentX" },
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

  function izrisiDatumVnos(actionType, polje, vrednost, oznaka, omejiNaDanes) {
    return '<label class="izvedba-action-sheet__datum">' +
      '<span class="izvedba-action-sheet__datum-gumb" aria-hidden="true">' +
        '<span class="izvedba-action-sheet__datum-ikona" aria-hidden="true">' + K.ikona("calendar") + '</span>' +
        '<span class="izvedba-action-sheet__datum-vrednost" data-izvedba-fit data-fit-min="9">' + K.esc(datumZaPrikaz(vrednost)) + '</span>' +
      '</span>' +
      '<span class="sr-only">' + K.esc(oznaka) + '</span>' +
      '<input type="datetime-local" class="izvedba-action-sheet__datum-prekrivni" aria-label="' + K.esc(oznaka) + '" data-action-type="' + K.esc(actionType) + '" data-datetime-polje="' + K.esc(polje) + '"' + (omejiNaDanes ? ' max="' + K.esc(datumZaVnos(new Date().toISOString())) + '"' : '') + ' value="' + K.esc(datumZaVnos(vrednost)) + '" />' +
    '</label>';
  }

  function izrisiActionSvicer() {
    var karticeZaPrikaz = state.aktivniFilterKartic
      ? VRSTNI_RED_KARTIC.filter(function (actionType) { return state.aktivniFilterKartic.indexOf(actionType) !== -1; })
      : VRSTNI_RED_KARTIC;
    var gumbi = karticeZaPrikaz.map(function (actionType) {
      var meta = K.AKCIJE_META[actionType];
      var sheetMeta = ACTION_SHEET_META[actionType];
      var izbran = state.selectedActionType === actionType;
      return '<button type="button" class="izvedba-poravnava-svicer__gumb izvedba-poravnava-svicer__gumb--akcija-' + K.esc(sheetMeta.razred) + (izbran ? ' is-selected' : '') + '" data-action-sheet-select="' + K.esc(actionType) + '" aria-pressed="' + String(izbran) + '">' +
        '<span class="izvedba-poravnava-svicer__ikona" aria-hidden="true">' + K.ikona(sheetMeta.ikona) + '</span>' +
        '<span data-izvedba-fit data-fit-min="7">' + K.esc(meta.naslov) + '</span></button>';
    }).join('');
    if (!jePreklicOpominaFilter()) gumbi += izrisiDrugoGumb();
    return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">1</span>Izberite naslednji korak</p>' +
      '<div class="izvedba-poravnava-svicer" role="group">' + gumbi + '</div></div>';
  }

  function izrisiDrugoGumb(disabled, oznaka) {
    return '<button type="button" class="izvedba-poravnava-svicer__gumb izvedba-poravnava-svicer__gumb--drugo' + (state.customActionActive ? ' is-selected' : '') + '" data-action-custom aria-pressed="' + String(state.customActionActive) + '" ' + (disabled ? 'disabled' : '') + '>' +
      '<span class="izvedba-poravnava-svicer__ikona" aria-hidden="true">' + K.ikona("pencil") + '</span>' +
      '<span>' + K.esc(oznaka || "Drugo / opiši sam") + '</span></button>';
  }

  function izrisiDrugoPodrobnosti() {
    var jeDogovor = jePlacilniEngine();
    return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">2</span>Podatki za ta korak</p>' +
      '<div class="izvedba-poravnava-podrobnosti izvedba-poravnava-podrobnosti--drugo">' +
        '<div class="izvedba-poravnava-podrobnosti__naslov">' + (jeDogovor ? 'Drug dogovor' : 'Drugo') + '</div>' +
        '<p class="izvedba-poravnava-podrobnosti__opis">' + (jeDogovor ? 'Na kratko opišite dogovor z dolžnikom.' : 'Na kratko opišite, kaj želite narediti.') + '</p>' +
        '<textarea class="izvedba-drugo__polje" data-action-custom-description maxlength="500" rows="3" placeholder="' + (jeDogovor ? 'Npr. plačilo po opravljeni reklamaciji …' : 'Vpišite svoj opis …') + '" aria-label="Lastni opis">' + K.esc(state.customActionDescription) + '</textarea>' +
        (jeDogovor ? '<button type="button" class="izvedba-poravnava-dodaj-korak" data-nacrt-dodaj>+ Dodaj dogovor</button>' : '') +
      '</div></div>';
  }

  function izrisiOdvetnikDrugoZgodovina() {
    var w = state.lawyerWizard || {};
    var datum = w.customHistoryDate || new Date().toISOString().slice(0, 10);
    return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">2</span>Opišite dogodek</p>' +
      '<div class="izvedba-poravnava-podrobnosti izvedba-poravnava-podrobnosti--drugo">' +
        '<div class="izvedba-poravnava-podrobnosti__naslov">Drugo</div>' +
        '<p class="izvedba-poravnava-podrobnosti__opis">Na kratko zapišite, kaj se je zgodilo.</p>' +
        '<textarea class="izvedba-drugo__polje" data-lawyer-history-custom-description maxlength="300" rows="3" placeholder="Npr. dolžnik je prosil za nov rok plačila …">' + K.esc(w.customHistoryDescription || "") + '</textarea>' +
        '<label class="izvedba-odvetnik-zgodovina__datum">Datum dogodka<input type="date" data-lawyer-history-custom-date value="' + K.esc(datum) + '" /></label>' +
        '<button type="button" class="izvedba-poravnava-dodaj-korak" data-lawyer-history-custom-add>+ Dodaj dogodek</button>' +
      '</div></div>';
  }

  function izrisiActionPodrobnosti() {
    var actionType = state.selectedActionType;
    if (state.customActionActive) return izrisiDrugoPodrobnosti();
    if (!actionType) return "";
    var meta = K.AKCIJE_META[actionType];
    var sheetMeta = ACTION_SHEET_META[actionType];
    return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">2</span>Podatki za ta korak</p>' +
      '<div class="izvedba-poravnava-podrobnosti izvedba-poravnava-podrobnosti--akcija-' + K.esc(sheetMeta.razred) + '" data-action-type="' + K.esc(actionType) + '">' +
        '<button type="button" class="izvedba-poravnava-podrobnosti__strni" data-action-sheet-select="' + K.esc(actionType) + '" aria-label="Skrči ta korak">' + K.ikona("chevron") + '</button>' +
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
    var jePrihodnjiDogovor = jePlacilniEngine() && !jeVnosZgodovine();
    var mejaDatuma = jePrihodnjiDogovor
      ? ' min="' + K.esc(datumZaVnos(new Date().toISOString())) + '"'
      : ' max="' + K.esc(datumZaVnos(new Date().toISOString())) + '"';
    return '<label class="izvedba-action-sheet__datum">' +
      '<span class="izvedba-action-sheet__datum-gumb" aria-hidden="true">' +
        '<span class="izvedba-action-sheet__datum-ikona" aria-hidden="true">' + K.ikona("calendar") + '</span>' +
        '<span class="izvedba-action-sheet__datum-vrednost" data-izvedba-fit data-fit-min="9">' + K.esc(datumZaPrikaz(vrednost)) + '</span>' +
      '</span>' +
      '<span class="sr-only">' + K.esc(oznaka) + '</span>' +
      '<input type="datetime-local" class="izvedba-action-sheet__datum-prekrivni" aria-label="' + K.esc(oznaka) + '" data-settlement-datetime="' + K.esc(imePolja) + '" data-settlement-type="' + K.esc(tip) + '"' + mejaDatuma + ' value="' + K.esc(datumZaVnos(vrednost)) + '" />' +
    '</label>';
  }

  function izrisiPoravnavaZnesek(tip, polje, vrednost, placeholder, pokaziUredi) {
    return '<label class="izvedba-znesek' + (pokaziUredi ? ' izvedba-znesek--urejljivo' : '') + '" data-action-control><span class="sr-only">' + K.esc(placeholder) + '</span>' +
      (pokaziUredi ? '<span class="izvedba-znesek__ikona-levo" aria-hidden="true">' + K.ikona("pencil") + '</span>' : '') +
      '<input class="izvedba-znesek__vnos" data-settlement-amount="' + K.esc(polje) + '" data-settlement-type="' + K.esc(tip) + '" data-izvedba-fit data-fit-min="9" ' +
      'type="number" inputmode="decimal" step="0.01" min="0.01" value="' + K.esc(vrednost != null ? vrednost : '') + '" placeholder="' + K.esc(placeholder) + '" />' +
      '<span class="izvedba-znesek__ikona izvedba-znesek__ikona--eur" aria-hidden="true">€</span></label>';
  }

  function izrisiZnesekSamoPrikaz(vrednost, oznaka) {
    return '<div class="izvedba-znesek izvedba-znesek--samo-prikaz" aria-label="' + K.esc(oznaka || "Znesek kompenzacije") + '">' +
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
    var moznosti = razlogi.filter(function (razlog) { return razlog.vrednost; }).map(function (razlog) {
      var jeIzbran = razlog.vrednost === izbraniRazlog;
      return '<button type="button" class="izvedba-poravnava__razlog-moznost' + (jeIzbran ? ' is-selected' : '') + '" role="option" aria-selected="' + String(jeIzbran) + '" data-settlement-reason-option="' + K.esc(razlog.vrednost) + '" data-settlement-type="' + K.esc(tip) + '">' +
        '<span>' + K.esc(razlog.oznaka) + '</span><span class="izvedba-poravnava__razlog-kljukica" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span></button>';
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
    var jePrihodnjiDogovor = jePlacilniEngine() && !jeVnosZgodovine();
    var jeDatumIzbran = nastavitve.dateMode === "custom";
    var danesGumb = '<button type="button" class="izvedba-segment__gumb' + (jeDatumIzbran ? '' : ' is-selected') + '" ' +
      'data-settlement-segment="dateMode" data-settlement-value="today" data-settlement-type="' + K.esc(tip) + '" ' +
      'data-izvedba-fit data-fit-min="8.5" aria-pressed="' + String(!jeDatumIzbran) + '">Danes</button>';
    var datumOznaka = jeDatumIzbran ? datumZaPrikaz(nastavitve.settledAt) : "Datum";
    var datumGumb = '<label class="izvedba-segment__gumb izvedba-segment__gumb--datum' + (jeDatumIzbran ? ' is-selected' : '') + '">' +
      '<span data-izvedba-fit data-fit-min="8.5">' + K.esc(datumOznaka) + '</span>' +
      '<input type="datetime-local" class="izvedba-segment__datum-prekrivni" aria-label="' + (jePrihodnjiDogovor ? 'Dogovorjeni rok' : 'Datum zaključka') + '" ' +
        'data-settlement-datetime="settledAt" data-settlement-type="' + K.esc(tip) + '" data-settlement-datum-segment ' +
        (jePrihodnjiDogovor ? 'min="' : 'max="') + K.esc(datumZaVnos(new Date().toISOString())) + '" value="' + K.esc(datumZaVnos(nastavitve.settledAt || new Date().toISOString())) + '" />' +
    '</label>';
    return '<div class="izvedba-segment" role="group">' + danesGumb + datumGumb + '</div>';
  }

  function izrisiZnesekZaZakljucek(tip, izbrano, placeholder) {
    var nastavitve = state.settlementSettings[tip];
    if (!nastavitve.rocnoUrejeno) nastavitve.settlementAmount = preostaliDolgPoNacrtu();
    var znesekPolje = izrisiPoravnavaZnesek(tip, "settlementAmount", nastavitve.settlementAmount, placeholder, true);
    var jePolniZnesek = Math.abs((Number(nastavitve.settlementAmount) || 0) - preostaliDolgPoNacrtu()) <= 0.009;
    var jePrihodnjiDogovor = jePlacilniEngine() && !jeVnosZgodovine();
    var namig = jePrihodnjiDogovor
      ? (jePolniZnesek ? "Dogovor pokriva celoten dolg; dolg se še ne zmanjša." : "Dogovor pokriva del dolga; dolg se še ne zmanjša.")
      : (jePolniZnesek ? "Pokriva celoten preostali dolg — primer se bo zaprl." : "Manjši znesek od preostanka — primer ostane odprt.");
    return znesekPolje +
      (izbrano ? '<p class="izvedba-poravnava__namig" data-izvedba-fit data-fit-min="7">' + K.esc(namig) + '</p>' : '');
  }

  function zgodovinaNastavitve(tip) {
    return tip === "payment_promised" ? state.settingsByAction.payment_promised : state.settlementSettings[tip];
  }

  function izrisiZgodovinaIzbire(tip, polje, moznosti, izbrano) {
    return '<div class="zgodovina-dogodek__izbire" role="group">' + moznosti.map(function (moznost) {
      var aktivna = moznost.vrednost === izbrano;
      return '<button type="button" data-history-choice="' + K.esc(moznost.vrednost) + '" data-history-field="' + K.esc(polje) + '" data-history-type="' + K.esc(tip) + '" aria-pressed="' + String(aktivna) + '" class="' + (aktivna ? 'is-selected' : '') + '">' + K.esc(moznost.oznaka) + '</button>';
    }).join('') + '</div>';
  }

  function zgodovinaDatumPriblizno(nastavitve, polje) {
    return String(nastavitve && nastavitve[polje + "Approximation"] || "").trim();
  }

  function zgodovinaDatumJeVeljaven(nastavitve, polje) {
    return Boolean(nastavitve && nastavitve[polje]) || Boolean(nastavitve && nastavitve[polje + "Unknown"] === true) || Boolean(zgodovinaDatumPriblizno(nastavitve, polje));
  }

  function izrisiZgodovinaDatum(tip, polje, vrednost, neznan, oznaka, prihodnji) {
    var nastavitve = zgodovinaNastavitve(tip);
    var pribliznoBesedilo = zgodovinaDatumPriblizno(nastavitve, polje);
    var priblizno = Boolean(nastavitve && nastavitve[polje + "Approximate"] === true) || Boolean(pribliznoBesedilo);
    var datumOnemogocen = neznan === true || priblizno;
    var datumManjka = !datumZaVnosPreprost(vrednost) && neznan !== true && !pribliznoBesedilo;
    return '<label class="zgodovina-dogodek__polje zgodovina-dogodek__polje--polno' + (datumManjka ? ' is-obvezno-manjka' : '') + '"><span>' + K.esc(oznaka) + '</span>' +
      '<span class="zgodovina-dogodek__datum"><input type="date" data-history-setting="' + K.esc(polje) + '" data-history-type="' + K.esc(tip) + '"' + (prihodnji ? '' : ' max="' + new Date().toISOString().slice(0, 10) + '"') + ' value="' + K.esc(datumZaVnosPreprost(vrednost)) + '"' + (datumOnemogocen ? ' disabled' : '') + '>' +
      '<button type="button" data-history-date-unknown="' + K.esc(polje) + '" data-history-type="' + K.esc(tip) + '" aria-pressed="' + String(neznan === true) + '" class="' + (neznan ? 'is-selected' : '') + '">Ne vem</button>' +
      '<button type="button" data-history-date-approx="' + K.esc(polje) + '" data-history-type="' + K.esc(tip) + '" aria-pressed="' + String(priblizno) + '" class="' + (priblizno ? 'is-selected' : '') + '">Približno</button></span>' +
      (priblizno ? '<input class="zgodovina-dogodek__datum-priblizno" type="text" maxlength="120" data-history-date-approximation="' + K.esc(polje) + '" data-history-type="' + K.esc(tip) + '" value="' + K.esc(pribliznoBesedilo) + '" placeholder="Npr. začetek maja 2025">' : '') +
    '</label>';
  }

  function izrisiZgodovinaSelect(tip, polje, vrednost, oznaka, vrsta) {
    var moznosti = vrsta === "communication"
      ? [["", "Izberite"], ["phone", "Telefon"], ["email", "E-pošta"], ["sms", "SMS"], ["in_person", "Osebno"], ["letter", "Pismo"], ["other", "Drugo"], ["unknown", "Ne vem"]]
      : [["", "Izberite"], ["bank_transfer", "Bančno nakazilo"], ["cash", "Gotovina"], ["card", "Kartica"], ["direct_debit", "Direktna obremenitev"], ["other", "Drugo"], ["unknown", "Ne vem"]];
    var selectId = "zgodovina-select-" + tip + "-" + polje;
    var izbranaMoznost = moznosti.find(function (moznost) { return moznost[0] === vrednost; }) || moznosti[0];
    var praznaOznaka = vrsta === "communication" ? "Izberite način komunikacije" : "Izberite način plačila";
    var prikazIzbire = izbranaMoznost[0] ? izbranaMoznost[1] : praznaOznaka;
    var menijskeMoznosti = moznosti.filter(function (moznost) { return moznost[0]; });
    return '<div class="zgodovina-dogodek__polje zgodovina-dogodek__polje--par' + (!vrednost ? ' is-obvezno-manjka' : '') + '"><span id="' + K.esc(selectId) + '-label">' + K.esc(oznaka) + '</span>' +
      '<div class="zgodovina-kontrolnik__select' + (vrednost ? ' has-value' : '') + '">' +
        '<select class="zgodovina-kontrolnik__native" tabindex="-1" aria-labelledby="' + K.esc(selectId) + '-label" data-history-setting="' + K.esc(polje) + '" data-history-type="' + K.esc(tip) + '">' + moznosti.map(function (moznost) { return '<option value="' + K.esc(moznost[0]) + '"' + (vrednost === moznost[0] ? ' selected' : '') + '>' + K.esc(moznost[1]) + '</option>'; }).join('') + '</select>' +
        '<button type="button" class="zgodovina-kontrolnik__select-gumb" data-history-select-toggle aria-haspopup="listbox" aria-expanded="false" aria-controls="' + K.esc(selectId) + '-list"><span>' + K.esc(prikazIzbire) + '</span>' + K.ikona("chevron") + '</button>' +
        '<div class="zgodovina-kontrolnik__select-seznam" id="' + K.esc(selectId) + '-list" role="listbox" aria-labelledby="' + K.esc(selectId) + '-label" hidden>' + menijskeMoznosti.map(function (moznost) {
          var aktivna = vrednost === moznost[0];
          return '<button type="button" role="option" data-history-select-option="' + K.esc(moznost[0]) + '" aria-selected="' + String(aktivna) + '" class="' + (aktivna ? 'is-selected' : '') + '"><span>' + K.esc(moznost[1]) + '</span>' + K.ikona("check") + '</button>';
        }).join('') + '</div>' +
      '</div>' +
    '</div>';
  }

  function izrisiZgodovinaOpis(tip, vrednost, oznaka, placeholder) {
    return '<label class="zgodovina-dogodek__polje zgodovina-dogodek__polje--polno"><span>' + K.esc(oznaka) + '</span><textarea data-history-setting="description" data-history-type="' + K.esc(tip) + '" maxlength="500" rows="2" placeholder="' + K.esc(placeholder) + '">' + K.esc(vrednost || "") + '</textarea></label>';
  }

  function izrisiZgodovinaKontrolnik(tip) {
    var nastavitve = state.settlementSettings[tip];
    var zdaj = new Date().toISOString();
    if (tip === "partial") {
      return '<div class="zgodovina-dogodek__polja">' +
        '<div class="zgodovina-dogodek__polje zgodovina-dogodek__polje--par"><span>Plačani znesek</span>' + izrisiPoravnavaZnesek(tip, "paymentAmount", nastavitve.paymentAmount, "Znesek") + '</div>' +
        izrisiZgodovinaDatum(tip, "datumKoraka", nastavitve.datumKoraka, nastavitve.datumKorakaUnknown, "Datum plačila", false) +
        izrisiZgodovinaSelect(tip, "paymentMethod", nastavitve.paymentMethod, "Način plačila", "payment") +
      '</div>';
    }
    if (tip === "full") {
      return '<div class="zgodovina-dogodek__polja">' +
        '<div class="zgodovina-dogodek__polje zgodovina-dogodek__polje--par"><span>Celotni znesek</span>' + izrisiZnesekSamoPrikaz(preostaliDolgPoNacrtu(), "Celotni znesek") + '</div>' +
        izrisiZgodovinaDatum(tip, "datumKoraka", nastavitve.datumKoraka, nastavitve.datumKorakaUnknown, "Datum plačila", false) +
        izrisiZgodovinaSelect(tip, "paymentMethod", nastavitve.paymentMethod, "Način plačila", "payment") +
      '</div>';
    }
    if (tip === "installment") {
      var nacinObrokov = nastavitve.historyMode === "agreement" ? "agreement" : "paid";
      var obrokiIzbira = izrisiZgodovinaIzbire(tip, "historyMode", [{ vrednost: "paid", oznaka: "Obrok je plačan" }, { vrednost: "agreement", oznaka: "Dogovor o obrokih" }], nacinObrokov);
      if (nacinObrokov === "agreement") {
        zagotoviObrokPlaner(2);
        return obrokiIzbira + '<div class="zgodovina-obroki__dogovor-meta">' +
          izrisiZgodovinaDatum(tip, "agreementDate", nastavitve.agreementDate, nastavitve.agreementDateUnknown, "Datum dogovora", false) +
          izrisiZgodovinaOpis(tip, nastavitve.description, "Dogovor", "Npr. mesečni obroki") +
        '</div>' + izrisiObrokPlaner();
      }
      zagotoviObrokPlaner();
      return obrokiIzbira + izrisiObrokPlaner();
    }
    if (tip === "unpaid_installment") {
      return '<div class="zgodovina-neplacan-obrok__polja">' +
        '<label><span>Številka obroka</span><span class="zgodovina-neplacan-obrok__stevilka"><input type="number" inputmode="numeric" min="1" max="99" step="1" data-settlement-amount="installmentNumber" data-settlement-type="unpaid_installment" value="' + K.esc(nastavitve.installmentNumber == null ? "" : nastavitve.installmentNumber) + '" placeholder="Npr. 3"' + (nastavitve.installmentNumberUnknown === true ? ' disabled' : '') + '><button type="button" data-unpaid-installment-number-unknown aria-pressed="' + String(nastavitve.installmentNumberUnknown === true) + '" class="' + (nastavitve.installmentNumberUnknown === true ? 'is-selected' : '') + '">Ne vem</button></span></label>' +
        izrisiZgodovinaDatum(tip, "dueAt", nastavitve.dueAt, nastavitve.dueAtUnknown, "Rok plačila", false) +
      '</div>';
    }
    if (tip === "payment_promised") {
      var obljuba = state.settingsByAction.payment_promised;
      var nacinObljube = ["request", "approved"].indexOf(obljuba.historyMode) >= 0 ? obljuba.historyMode : "promise";
      var obljubaIzbira = izrisiZgodovinaIzbire(tip, "historyMode", [{ vrednost: "promise", oznaka: "Obljuba" }, { vrednost: "request", oznaka: "Prošnja za rok" }, { vrednost: "approved", oznaka: "Rok odobren" }], nacinObljube);
      return obljubaIzbira + '<div class="zgodovina-dogodek__polja">' +
        (nacinObljube === "promise" ? '<label class="zgodovina-dogodek__polje zgodovina-dogodek__polje--par"><span>Obljubljeni znesek <small>neobvezno</small></span><input type="number" min="0.01" step="0.01" inputmode="decimal" data-history-setting="promisedAmount" data-history-type="payment_promised" value="' + K.esc(obljuba.promisedAmount == null ? "" : obljuba.promisedAmount) + '" placeholder="Znesek"></label>' : '') +
        izrisiZgodovinaDatum(tip, "occurredAt", obljuba.occurredAt, obljuba.occurredAtUnknown, nacinObljube === "promise" ? "Datum obljube" : "Datum dogovora", false) +
        izrisiZgodovinaDatum(tip, "promisedDate", obljuba.promisedDate, obljuba.promisedDateUnknown, nacinObljube === "promise" ? "Rok plačila" : "Novi rok plačila", true) +
        izrisiZgodovinaSelect(tip, "communicationChannel", obljuba.communicationChannel, "Kako je bilo sporočeno?", "communication") +
        (nacinObljube === "promise" ? '' : izrisiZgodovinaOpis(tip, obljuba.description, "Opomba", "Npr. razlog za novi rok")) +
      '</div>';
    }
    if (tip === "payment_failed") {
      return '<div class="zgodovina-dogodek__polja">' +
        izrisiZgodovinaDatum(tip, "occurredAt", nastavitve.occurredAt, nastavitve.occurredAtUnknown, "Datum poskusa", false) +
        izrisiZgodovinaSelect(tip, "paymentMethod", nastavitve.paymentMethod, "Način plačila", "payment") +
        izrisiZgodovinaOpis(tip, nastavitve.description, "Kaj se je zgodilo?", "Npr. banka je nakazilo vrnila") +
      '</div>';
    }
    if (tip === "invoice_dispute") {
      return '<div class="zgodovina-dogodek__polja">' +
        izrisiZgodovinaDatum(tip, "occurredAt", nastavitve.occurredAt, nastavitve.occurredAtUnknown, "Datum ugovora", false) +
        izrisiZgodovinaSelect(tip, "communicationChannel", nastavitve.communicationChannel, "Kako je ugovarjal?", "communication") +
        izrisiZgodovinaOpis(tip, nastavitve.description, "Kaj izpodbija?", "Npr. kakovost izvedbe ali del zneska") +
      '</div>';
    }
    if (tip === "insolvency") {
      return '<div class="zgodovina-dogodek__polja">' +
        izrisiZgodovinaDatum(tip, "occurredAt", nastavitve.occurredAt, nastavitve.occurredAtUnknown, "Datum informacije", false) +
        '<label class="zgodovina-dogodek__polje zgodovina-dogodek__polje--par"><span>Opravilna številka <small>neobvezno</small></span><input type="text" maxlength="120" data-history-setting="documentReference" data-history-type="insolvency" value="' + K.esc(nastavitve.documentReference || "") + '" placeholder="Npr. St 123/2026"></label>' +
        izrisiZgodovinaOpis(tip, nastavitve.description, "Vrsta postopka", "Npr. stečaj ali prisilna poravnava") +
      '</div>';
    }
    if (tip === "credit_note") {
      var vrstaDobropisa = izrisiPoravnavaSegment(tip, "kind", [
        { vrednost: "credit", oznaka: "Dobropis" },
        { vrednost: "writeoff", oznaka: "Odpust" },
      ], nastavitve.kind || "credit");
      if (!nastavitve.rocnoUrejeno) nastavitve.settlementAmount = preostaliDolgPoNacrtu();
      return vrstaDobropisa + '<div class="izvedba-poravnava-znesek-datum">' +
        izrisiPoravnavaZnesek(tip, "settlementAmount", nastavitve.settlementAmount, nastavitve.kind === "writeoff" ? "Znesek odpusta" : "Znesek dobropisa", true) +
        izrisiPoravnavaDatum(tip, nastavitve.datumKoraka || zdaj, "Datum dogodka", "datumKoraka") +
      '</div>' + (nastavitve.kind === "writeoff" ? izrisiPoravnavaRazlog(tip) : "");
    }
    if (tip === "compensation") {
      if (!nastavitve.rocnoUrejeno) nastavitve.settlementAmount = preostaliDolgPoNacrtu();
      return izrisiPoravnavaDatumSegment(tip) +
        izrisiPoravnavaZnesek(tip, "settlementAmount", nastavitve.settlementAmount, "Znesek kompenzacije", true);
    }
    if (tip === "cancelled_invoice") {
      return izrisiPoravnavaRazlog(tip) + izrisiPoravnavaDatum(tip, nastavitve.datumKoraka || zdaj, "Datum dogodka", "datumKoraka");
    }
    return "";
  }

  /* ---------- Napredni načrtovalec obrokov (samo tip "installment") ---------- */

  function datumSamoZaPrikaz(vrednost) {
    if (!vrednost) return "";
    var datum = new Date(vrednost);
    if (Number.isNaN(datum.getTime())) return "";
    var lokalno = new Date(datum.getTime() - datum.getTimezoneOffset() * 60000);
    var deli = lokalno.toISOString().slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return deli ? deli[3] + ". " + deli[2] + ". " + deli[1] : "";
  }

  function datumZaVnosPreprost(vrednost) {
    if (!vrednost) return "";
    var datum = new Date(vrednost);
    if (Number.isNaN(datum.getTime())) return "";
    var lokalno = new Date(datum.getTime() - datum.getTimezoneOffset() * 60000);
    return lokalno.toISOString().slice(0, 10);
  }

  function datumZaPlanerIndeks(indeks, razmik) {
    var datum = new Date();
    var nastavitveObrokov = state.settlementSettings.installment;
    var jePlacanaZgodovina = jeVnosZgodovine() && nastavitveObrokov.historyMode !== "agreement";
    var stevilo = nastavitveObrokov.planer ? nastavitveObrokov.planer.steviloObrokov : 1;
    var stevec = jePlacanaZgodovina ? indeks - (stevilo - 1) : indeks + 1;
    if (razmik === "weekly") datum.setDate(datum.getDate() + 7 * stevec);
    else if (razmik === "biweekly") datum.setDate(datum.getDate() + 14 * stevec);
    else if (razmik === "monthly") datum.setMonth(datum.getMonth() + stevec);
    else return null;
    return datum.toISOString();
  }

  function izracunajEnakomerneZneske(dolg, stevilo) {
    var osnovni = Math.floor((dolg / stevilo) * 100) / 100;
    var zneski = [];
    var vsota = 0;
    for (var i = 0; i < stevilo - 1; i++) { zneski.push(osnovni); vsota += osnovni; }
    zneski.push(Math.round((dolg - vsota) * 100) / 100);
    return zneski;
  }

  function obnoviPlanerObroke() {
    var nastavitve = state.settlementSettings.installment;
    var planer = nastavitve.planer;
    if (!planer) return;
    var stevilo = planer.steviloObrokov;
    var star = planer.obroki || [];
    var zneski = planer.enakomerno ? izracunajEnakomerneZneske(preostaliDolgPoNacrtu(), stevilo) : null;
    var novi = [];
    for (var i = 0; i < stevilo; i++) {
      var obstojec = star[i];
      novi.push({
        znesek: planer.enakomerno ? zneski[i] : (obstojec ? obstojec.znesek : null),
        datum: (obstojec && (obstojec.datumRocno || obstojec.datumNeznan || obstojec.datumPribliznoAktivno)) ? obstojec.datum : datumZaPlanerIndeks(i, planer.razmik),
        datumRocno: obstojec ? Boolean(obstojec.datumRocno) : false,
        datumNeznan: obstojec ? Boolean(obstojec.datumNeznan) : false,
        datumPriblizno: obstojec ? String(obstojec.datumPriblizno || "") : "",
        datumPribliznoAktivno: obstojec ? Boolean(obstojec.datumPribliznoAktivno) : false,
        razsirjen: true,
      });
    }
    planer.obroki = novi;
  }

  function zagotoviObrokPlaner(najmanj) {
    var nastavitve = state.settlementSettings.installment;
    if (!nastavitve.planer) {
      nastavitve.planer = { steviloObrokov: Math.max(1, Number(najmanj) || 1), razmik: null, enakomerno: false, obroki: [] };
      obnoviPlanerObroke();
    } else if (Number(najmanj) > nastavitve.planer.steviloObrokov) {
      nastavitve.planer.steviloObrokov = Number(najmanj);
      obnoviPlanerObroke();
    }
  }

  function dodajVsePlaniraneObroke() {
    var nastavitve = state.settlementSettings.installment;
    var planer = nastavitve.planer;
    var skupniNacinPlacila = nastavitve.paymentMethod;
    if (!planer || !planer.obroki.length) return;
    if (jePlacilniEngine() && !jeVnosZgodovine()) {
      if (dodajKorakVNacrt()) state.selectedSettlementType = null;
      return;
    }
    if (jeVnosZgodovine() && nastavitve.historyMode === "agreement") {
      nastavitve.installmentCount = planer.obroki.length;
      dodajKorakVNacrt();
      return;
    }
    for (var i = 0; i < planer.obroki.length; i++) {
      var vrstica = planer.obroki[i];
      var aktivneNastavitve = state.settlementSettings.installment;
      aktivneNastavitve.paymentAmount = vrstica.znesek;
      aktivneNastavitve.datumKoraka = vrstica.datum;
      aktivneNastavitve.datumKorakaUnknown = vrstica.datumNeznan === true;
      aktivneNastavitve.datumKorakaApproximation = String(vrstica.datumPriblizno || "").trim();
      aktivneNastavitve.datumKorakaApproximate = Boolean(vrstica.datumPribliznoAktivno);
      aktivneNastavitve.paymentMethod = skupniNacinPlacila;
      if (!dodajKorakVNacrt()) {
        state.error = (i + 1) + ". obrok: " + (state.error || "Preverite vnos.");
        return;
      }
    }
    var razmikOhranjen = planer.razmik;
    state.settlementSettings.installment.planer = { steviloObrokov: 1, razmik: razmikOhranjen, enakomerno: false, obroki: [] };
    obnoviPlanerObroke();
    if (jeVnosZgodovine()) state.selectedSettlementType = null;
  }

  function posodobiPlanerKontrolnikeVZivo() {
    var planer = state.settlementSettings.installment.planer;
    if (!planer) return;
    var dolg = preostaliDolgPoNacrtu();
    var vsota = planer.obroki.reduce(function (v, o) { return v + (Number(o.znesek) || 0); }, 0);
    var presega = vsota > dolg + 0.009;
    var vsiVeljavni = planer.obroki.length > 0 && planer.obroki.every(function (vrstica) {
      return Number(vrstica.znesek) > 0 && (Boolean(datumZaVnosPreprost(vrstica.datum)) || vrstica.datumNeznan === true || Boolean(String(vrstica.datumPriblizno || "").trim()));
    });
    var potrdiEl = elActionSheet.querySelector("[data-obrok-planer-dodaj-vse]");
    if (potrdiEl) potrdiEl.disabled = !vsiVeljavni || presega;
    planer.obroki.forEach(function (vrstica, indeks) {
      var znesekEl = elActionSheet.querySelector('[data-obrok-planer-vrstica-znesek="' + indeks + '"]');
      var datumEl = elActionSheet.querySelector('[data-obrok-planer-vrstica-datum="' + indeks + '"]');
      var pribliznoEl = elActionSheet.querySelector('[data-obrok-planer-datum-approximation="' + indeks + '"]');
      if (znesekEl) znesekEl.classList.toggle("is-obvezno-manjka", !(Number(vrstica.znesek) > 0));
      if (datumEl) datumEl.classList.toggle("is-obvezno-manjka", !datumZaVnosPreprost(vrstica.datum) && !vrstica.datumNeznan && !vrstica.datumPribliznoAktivno);
      if (pribliznoEl) pribliznoEl.classList.toggle("is-obvezno-manjka", !String(vrstica.datumPriblizno || "").trim());
      var povzetekEl = elActionSheet.querySelector('[data-obrok-planer-vrstica-preklop="' + indeks + '"] small');
      if (povzetekEl) {
        var priblizniDatum = String(vrstica.datumPriblizno || "").trim();
        var datumPovzetek = vrstica.datumNeznan ? "Datum ni znan" : priblizniDatum ? "Približno " + priblizniDatum : datumSamoZaPrikaz(vrstica.datum) || "Datum ni izbran";
        povzetekEl.textContent = [Number(vrstica.znesek) > 0 ? K.formatirajEur(vrstica.znesek) : "Znesek ni vnesen", datumPovzetek].join(" · ");
      }
    });
  }

  function izrisiObrokPlaner() {
    var nastavitve = state.settlementSettings.installment;
    var planer = nastavitve.planer;
    if (!planer) return "";
    var dolg = preostaliDolgPoNacrtu();
    var steviloPilli = [];
    for (var i = 1; i <= 20; i++) {
      var jeIzbrano = planer.steviloObrokov === i;
      steviloPilli.push('<button type="button" class="izvedba-obrok-planer__stevilo-pill' + (jeIzbrano ? ' is-selected' : '') + '" data-obrok-planer-stevilo="' + i + '" aria-pressed="' + String(jeIzbrano) + '">' + i + '</button>');
    }
    var razmikOpcije = [
      { vrednost: "weekly", naslov: "Vsak teden", opis: "7 dni" },
      { vrednost: "biweekly", naslov: "Vsaka 2 tedna", opis: "14 dni" },
      { vrednost: "monthly", naslov: "Vsak mesec", opis: "Koledarsko" },
      { vrednost: "custom", naslov: "Ročno", opis: "Izberem datume" },
    ];
    var razmikHtml = razmikOpcije.map(function (opcija) {
      var izbrano = planer.razmik === opcija.vrednost;
      return '<button type="button" class="izvedba-obrok-planer__razmik-kartica' + (izbrano ? ' is-selected' : '') + '" data-obrok-planer-razmik="' + opcija.vrednost + '" aria-pressed="' + String(izbrano) + '"><strong>' + K.esc(opcija.naslov) + '</strong><small>' + K.esc(opcija.opis) + '</small></button>';
    }).join("");
    var vsotaObrokov = planer.obroki.reduce(function (v, o) { return v + (Number(o.znesek) || 0); }, 0);
    var vsotaPresega = vsotaObrokov > dolg + 0.009;
    var vsiObrokiVeljavni = planer.obroki.length > 0 && planer.obroki.every(function (vrstica) {
      return Number(vrstica.znesek) > 0 && (Boolean(datumZaVnosPreprost(vrstica.datum)) || vrstica.datumNeznan === true || Boolean(String(vrstica.datumPriblizno || "").trim()));
    });
    var jePlacanaZgodovina = jeVnosZgodovine() && nastavitve.historyMode !== "agreement";
    if (jePlacanaZgodovina && !String(nastavitve.paymentMethod || "")) vsiObrokiVeljavni = false;
    var nacinPlacilaHtml = jeVnosZgodovine() && nastavitve.historyMode === "agreement"
      ? ""
      : '<div class="izvedba-obrok-planer__nacin">' + izrisiZgodovinaSelect("installment", "paymentMethod", nastavitve.paymentMethod, "Način plačila", "payment") + '</div>';
    var omejitevDatuma = jePlacanaZgodovina ? ' max="' + new Date().toISOString().slice(0, 10) + '"' : '';
    var vrsticeHtml = planer.obroki.map(function (vrstica, indeks) {
      var razsirjen = vrstica.razsirjen !== false;
      var priblizniDatumVrstice = String(vrstica.datumPriblizno || "").trim();
      var datumPovzetek = vrstica.datumNeznan ? "Datum ni znan" : priblizniDatumVrstice ? "Približno " + priblizniDatumVrstice : datumSamoZaPrikaz(vrstica.datum) || "Datum ni izbran";
      var povzetek = [Number(vrstica.znesek) > 0 ? K.formatirajEur(vrstica.znesek) : "Znesek ni vnesen", datumPovzetek].join(" · ");
      return '<div class="izvedba-obrok-planer__vrstica' + (razsirjen ? ' is-expanded' : '') + '">' +
        '<div class="izvedba-obrok-planer__vrstica-glava"><button type="button" class="izvedba-obrok-planer__vrstica-preklop" data-obrok-planer-vrstica-preklop="' + indeks + '" aria-expanded="' + String(razsirjen) + '"><span><strong>' + (indeks + 1) + '. obrok</strong><small>' + K.esc(povzetek) + '</small></span></button>' +
          '<button type="button" class="izvedba-obrok-planer__odstrani" data-obrok-planer-vrstica-odstrani="' + indeks + '" aria-label="Odstrani ' + (indeks + 1) + '. obrok">×</button></div>' +
        '<div class="izvedba-obrok-planer__vrstica-telo"' + (razsirjen ? '' : ' hidden') + '><div class="izvedba-poravnava-znesek-datum">' +
          '<label class="izvedba-znesek" data-action-control><span class="sr-only">Znesek</span>' +
            '<input class="izvedba-znesek__vnos' + (!(Number(vrstica.znesek) > 0) ? ' is-obvezno-manjka' : '') + '" data-obrok-planer-vrstica-znesek="' + indeks + '" data-izvedba-fit data-fit-min="9" type="number" inputmode="decimal" step="0.01" min="0.01" value="' + K.esc(vrstica.znesek != null ? vrstica.znesek : "") + '" placeholder="Vnesite znesek" />' +
            '<span class="izvedba-znesek__ikona izvedba-znesek__ikona--eur" aria-hidden="true">€</span></label>' +
          '<label class="izvedba-obrok-planer__datum"><input type="date" class="izvedba-obrok-planer__datum-vnos' + (!datumZaVnosPreprost(vrstica.datum) && !vrstica.datumNeznan && !vrstica.datumPribliznoAktivno ? ' is-obvezno-manjka' : '') + '" data-obrok-planer-vrstica-datum="' + indeks + '"' + omejitevDatuma + ' value="' + K.esc(datumZaVnosPreprost(vrstica.datum)) + '"' + (vrstica.datumNeznan || vrstica.datumPribliznoAktivno ? ' disabled' : '') + ' /></label>' +
        '</div><div class="izvedba-obrok-planer__datum-moznosti" role="group" aria-label="Natančnost datuma ' + (indeks + 1) + '. obroka">' +
          '<button type="button" data-obrok-planer-datum-unknown="' + indeks + '" aria-pressed="' + String(vrstica.datumNeznan === true) + '" class="' + (vrstica.datumNeznan ? 'is-selected' : '') + '">Ne vem</button>' +
          '<button type="button" data-obrok-planer-datum-approx="' + indeks + '" aria-pressed="' + String(vrstica.datumPribliznoAktivno === true) + '" class="' + (vrstica.datumPribliznoAktivno ? 'is-selected' : '') + '">Približno</button></div>' +
        (vrstica.datumPribliznoAktivno ? '<input class="izvedba-obrok-planer__datum-priblizno' + (!String(vrstica.datumPriblizno || "").trim() ? ' is-obvezno-manjka' : '') + '" type="text" maxlength="120" data-obrok-planer-datum-approximation="' + indeks + '" value="' + K.esc(vrstica.datumPriblizno || "") + '" placeholder="Npr. začetek maja 2025">' : '') +
        '</div></div>';
    }).join("");
    return '<div class="izvedba-obrok-planer">' +
      '<div class="izvedba-obrok-planer__glava"><p class="rok-sheet__oznaka">Število obrokov</p><p class="izvedba-obrok-planer__pomoc">do 20</p></div>' +
      '<div class="izvedba-obrok-planer__stevilke">' + steviloPilli.join("") + '</div>' +
      '<div class="izvedba-obrok-planer__glava"><p class="rok-sheet__oznaka">Razmik med obroki</p></div>' +
      '<div class="izvedba-obrok-planer__razmik' + (!planer.razmik ? ' is-obvezno-manjka' : '') + '">' + razmikHtml + '</div>' +
      '<button type="button" class="izvedba-obrok-planer__enakomerno' + (planer.enakomerno ? ' is-selected' : '') + '" data-obrok-planer-enakomerno aria-pressed="' + String(Boolean(planer.enakomerno)) + '">' +
        '<span class="izvedba-obrok-planer__enakomerno-ikona" aria-hidden="true">' + (planer.enakomerno ? K.ikona("checkCircle") : "") + '</span>' +
        '<span>Enakomerno razdeli ' + K.esc(K.formatirajEur(dolg)) + ' med obroke</span>' +
      '</button>' +
      nacinPlacilaHtml +
      '<div class="izvedba-obrok-planer__vrstice">' + vrsticeHtml + '</div>' +
      '<div class="izvedba-obrok-planer__akcije">' +
        '<button type="button" class="izvedba-obrok-planer__dodaj" data-obrok-planer-dodaj' + (planer.obroki.length >= 20 ? ' disabled' : '') + '>+ Dodaj obrok</button>' +
        '<button type="button" class="izvedba-poravnava-dodaj-korak" data-obrok-planer-dodaj-vse' + (vsiObrokiVeljavni && !vsotaPresega ? '' : ' disabled') + '>Shrani obroke</button>' +
      '</div>' +
    '</div>';
  }

  function izrisiPoravnavaKontrolnik(tip, izbrano) {
    var nastavitve = state.settlementSettings[tip];
    if (tip === "full") {
      return izrisiPoravnavaDatumSegment(tip);
    }
    if (tip === "compensation") {
      var zneskKompenzacije = preostaliDolgPoNacrtu();
      return izrisiPoravnavaDatumSegment(tip) + izrisiZnesekSamoPrikaz(zneskKompenzacije) +
        (izbrano ? '<p class="izvedba-poravnava__namig" data-izvedba-fit data-fit-min="7">Dogovor pokriva celoten dolg; dolg se še ne zmanjša.</p>' : '');
    }
    if (tip === "installment") {
      zagotoviObrokPlaner();
      return izrisiObrokPlaner();
    }
    if (tip === "payment_promised") {
      return podatkiZaKartico("payment_promised", izbrano);
    }
    if (tip === "partial") {
      var znesekPolje = izrisiPoravnavaZnesek(tip, "paymentAmount", nastavitve.paymentAmount, "Vnesite znesek");
      var datumPolje = izrisiPoravnavaDatum(tip, nastavitve.datumKoraka || new Date().toISOString(), "Datum koraka", "datumKoraka");
      var oznakaKoraka = state.actionSheetMode === "payment"
        ? '<p class="izvedba-poravnava__korak-oznaka">' + naslednjaStevilkaKoraka(tip) + '. ' + K.esc(BESEDA_ZAPOREDNEGA_KORAKA[tip] || "korak") + '</p>'
        : "";
      return oznakaKoraka + '<div class="izvedba-poravnava-znesek-datum">' + znesekPolje + datumPolje + '</div>';
    }
    if (tip === "credit_note") {
      var dobropisKindSegment = izrisiPoravnavaSegment(tip, "kind", [
        { vrednost: "credit", oznaka: "Dobropis" },
        { vrednost: "writeoff", oznaka: "Odpust" },
      ], nastavitve.kind || "credit");
      var dobropisZnesek = izrisiZnesekZaZakljucek(tip, izbrano, nastavitve.kind === "writeoff" ? "Vnesite znesek odpusta" : "Vnesite znesek dobropisa");
      var dobropisRazlog = izbrano && nastavitve.kind === "writeoff" ? izrisiPoravnavaRazlog(tip) : "";
      return dobropisKindSegment + dobropisZnesek + dobropisRazlog;
    }
    return izrisiPoravnavaRazlog(tip);
  }

  function izrisiPoravnavaSvicer() {
    var jeZgodovina = jeVnosZgodovine();
    var jeRazsirjeniPlacilniEngine = jePlacilniEngine();
    var zaprt = !jeZgodovina && jeNacrtZaprt();
    var vrstniRed = jeZgodovina
      ? ["partial", "installment", "unpaid_installment", "payment_promised", "full", "payment_failed", "invoice_dispute", "credit_note", "compensation", "cancelled_invoice", "insolvency"]
      : jeRazsirjeniPlacilniEngine
      ? ["full", "partial", "installment", "payment_promised", "compensation", "credit_note"]
      : SETTLEMENT_ORDER;
    var gumbi = vrstniRed.map(function (tip) {
      var meta = jeZgodovina ? ZGODOVINA_META[tip] : jeRazsirjeniPlacilniEngine ? DOGOVOR_META[tip] : tip === "payment_promised"
        ? { naslov: K.AKCIJE_META.payment_promised.naslov, razred: "akcija-obljuba", ikona: K.AKCIJE_META.payment_promised.ikona }
        : SETTLEMENT_META[tip];
      var izbran = !state.customActionActive && state.selectedSettlementType === tip;
      return '<button type="button" class="izvedba-poravnava-svicer__gumb izvedba-poravnava-svicer__gumb--' + K.esc(meta.razred) + (izbran ? ' is-selected' : '') + '" data-settlement-select="' + K.esc(tip) + '" aria-pressed="' + String(izbran) + '" ' + (zaprt ? 'disabled' : '') + '>' +
        '<span class="izvedba-poravnava-svicer__ikona" aria-hidden="true">' + K.ikona(meta.ikona) + '</span>' +
        '<span data-izvedba-fit data-fit-min="7">' + K.esc(meta.naslov) + '</span></button>';
    }).join('');
    if (jeOdvetnikZgodovina()) gumbi += izrisiDrugoGumb(zaprt);
    if (jeRazsirjeniPlacilniEngine) gumbi += izrisiDrugoGumb(zaprt, "Drug dogovor");
    if (!jeZgodovina && !jeRazsirjeniPlacilniEngine) {
      var obljubaMeta = K.AKCIJE_META.payment_promised;
      var obljubaIzbran = state.selectedSettlementType === "payment_promised";
      gumbi += '<button type="button" class="izvedba-poravnava-svicer__gumb izvedba-poravnava-svicer__gumb--akcija-obljuba' + (obljubaIzbran ? ' is-selected' : '') + '" data-settlement-select="payment_promised" aria-pressed="' + String(obljubaIzbran) + '" ' + (zaprt ? 'disabled' : '') + '>' +
        '<span class="izvedba-poravnava-svicer__ikona" aria-hidden="true">' + K.ikona(obljubaMeta.ikona) + '</span>' +
        '<span data-izvedba-fit data-fit-min="7">' + K.esc(obljubaMeta.naslov) + '</span></button>';
      gumbi += izrisiDrugoGumb(zaprt);
    }
    return '<div class="izvedba-poravnava-cona">' + (jeZgodovina ? '' : '<p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">1</span>' + (jeRazsirjeniPlacilniEngine ? 'Izberite dogovor' : 'Izberite naslednji korak') + '</p>') +
      '<div class="izvedba-poravnava-svicer" role="group">' + gumbi + '</div>' + (jeZgodovina || jeRazsirjeniPlacilniEngine ? '<div class="zgodovina-svicer__pikice" aria-label="Podrsajte levo ali desno za več možnosti"><span class="zgodovina-svicer__pikica is-active" aria-hidden="true"></span><span class="zgodovina-svicer__pikica" aria-hidden="true"></span></div>' : '') + '</div>';
  }

  var OBLJUBA_SETTLEMENT_META = { naslov: "Plačal bo do novega roka", opis: "Načrt začasno počaka.", razred: "akcija-obljuba", ikona: "handshake" };

  function izrisiPoravnavaPodrobnosti() {
    var tip = state.selectedSettlementType;
    var jeZgodovina = jeVnosZgodovine();
    var jePlacilniDogodek = jePlacilniDogodkovniTip(tip);
    if (state.customActionActive) return jeOdvetnikZgodovina() ? izrisiOdvetnikDrugoZgodovina() : (!jeZgodovina ? izrisiDrugoPodrobnosti() : '');
    var meta = jeZgodovina || jePlacilniDogodek ? ZGODOVINA_META[tip] : jePlacilniEngine() ? DOGOVOR_META[tip] : tip === "payment_promised" ? OBLJUBA_SETTLEMENT_META : SETTLEMENT_META[tip];
    if (!meta) {
      if (jeZgodovina) {
        return '<div class="izvedba-poravnava-cona" data-zgodovina-podrobnosti hidden></div>';
      }
      return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">2</span>Podatki za ta korak</p>' +
        '<p class="izvedba-poravnava-potek__prazno">Najprej izberite korak zgoraj.</p></div>';
    }
    var zaprt = !jeZgodovina && jeNacrtZaprt();
    var neposrednaHitraIzbira = jeBoPlacalNeposrednaHitraIzbira();
    var jeDogovorniVnos = jePlacilniEngine() && !jeZgodovina;
    var zgodovinaDodajGumb = tip === "installment" || neposrednaHitraIzbira
      ? ""
      : '<button type="button" class="izvedba-poravnava-dodaj-korak" data-nacrt-dodaj>+ Dodaj dogodek</button>';
    var vsebinaKoraka = jeZgodovina || jePlacilniDogodek
      ? izrisiZgodovinaKontrolnik(tip) + zgodovinaDodajGumb
      : zaprt
      ? '<p class="izvedba-poravnava__namig">Ta korak zapre primer — po njem ni mogoče dodati novega koraka. Odstranite ga zgoraj v "Potek primera", če želite izbrati drugega.</p>'
      : izrisiPoravnavaKontrolnik(tip, true) + (tip === "installment" || neposrednaHitraIzbira ? "" : '<button type="button" class="izvedba-poravnava-dodaj-korak" data-nacrt-dodaj>+ ' + (jeDogovorniVnos ? 'Dodaj dogovor' : 'Dodaj korak') + '</button>');
    return '<div class="izvedba-poravnava-cona"><p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">2</span>' + (jeZgodovina || jePlacilniDogodek ? 'Podatki o dogodku' : jeDogovorniVnos ? 'Podatki dogovora' : 'Podatki za ta korak') + '</p>' +
      '<div class="izvedba-poravnava-podrobnosti izvedba-poravnava-podrobnosti--' + K.esc(meta.razred) + '"' + (tip === "payment_promised" ? ' data-action-type="payment_promised"' : '') + '>' +
        (zaprt ? '' : '<button type="button" class="izvedba-poravnava-podrobnosti__strni" data-settlement-select="' + K.esc(tip) + '" aria-label="' + (jeZgodovina ? 'Skrči dogodek' : 'Skrči ta korak') + '">' + K.ikona("chevron") + '</button>') +
        '<div class="izvedba-poravnava-podrobnosti__naslov" data-izvedba-fit data-fit-min="10">' + K.esc(meta.naslov) + '</div>' +
        (jeZgodovina ? '' : '<p class="izvedba-poravnava-podrobnosti__opis" data-izvedba-fit data-fit-min="8">' + K.esc(meta.opis) + '</p>') +
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
      var jeKompenzacija = nastavitve.kind === "compensation";
      return { naslov: jeOdpust ? "Odpust" : (jeKompenzacija ? "Kompenzacija (pobot)" : "Dobropis"), znesek: Number(nastavitve.amount) || 0, ikona: jeOdpust ? "documentX" : (jeKompenzacija ? "scales" : "tag"), razred: jeOdpust ? "cancelled_invoice" : (jeKompenzacija ? "compensation" : "credit_note") };
    }
    if (ukrep.action_type === "paid_in_full") {
      var vrsta = nastavitve.settlementType || "full";
      if (vrsta === "credit_note" && nastavitve.kind === "writeoff") {
        return { naslov: "Odpust", znesek: Number(nastavitve.settlementAmount) || 0, ikona: "documentX", razred: "storno" };
      }
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
      var obljubaNastavitve = ukrep.settings || {};
      var obljubaZnesek = Number(obljubaNastavitve.promisedAmount);
      var obljubaDatumBesedilo = obljubaNastavitve.promisedDate ? datumSamoZaPrikaz(obljubaNastavitve.promisedDate) : "";
      var obljubaNaslov = "Plačilo obljubljeno" + (obljubaDatumBesedilo ? " do " + obljubaDatumBesedilo : "");
      return { naslov: obljubaNaslov, znesek: Number.isFinite(obljubaZnesek) && obljubaZnesek > 0 ? obljubaZnesek : null, ikona: "handshake", razred: "obljuba" };
    }
    return null;
  }

  function izrisiPotekPrimera() {
    var jeZgodovina = jeVnosZgodovine();
    var jeAtenaVnos = jeAtena();
    var jeDogovorniVnos = jePlacilniEngine() && !jeZgodovina;
    var obstojeciKronolosko = (state.ukrepi || [])
      .filter(function (u) { return u.status === "completed"; })
      .map(function (u) {
        var opis = opisUkrepaZaZgodovino(u);
        return opis ? Object.assign({ datum: u.completed_at, jeNacrtovan: false, actionId: u.action_id, actionType: u.action_type }, opis) : null;
      })
      .filter(Boolean);
    var nacrtovani = (state.nacrtKoraki || []).map(function (korak) {
      var prikazniZnesek = korak.settings && Number(korak.settings.remainingAmount);
      return { naslov: korak.naslov, znesek: korak.znesek, prikazniZnesek: Number.isFinite(prikazniZnesek) && prikazniZnesek > 0 ? prikazniZnesek : null, ikona: korak.ikona, razred: korak.razred, datum: korak.datum, datumNeznan: Boolean(korak.datumNeznan || (korak.settings && korak.settings.occurredAtUnknown)), datumPriblizno: String(korak.datumPriblizno || (korak.settings && korak.settings.occurredAtApproximation) || "").trim(), jeNacrtovan: true };
    });
    if (jeZgodovina && nacrtovani.length) {
      nacrtovani.push({
        naslov: "Preostali dolg",
        znesek: preostaliDolgPoNacrtu(),
        ikona: "clock",
        razred: "neplacan-obrok",
        datum: null,
        metaBesedilo: "Po pripravljenih dogodkih",
        jeNacrtovan: true,
        jeIzracunaniPreostanek: true,
      });
    }
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
    var steviloDogodkov = seznam.filter(function (korak) { return !korak.jeIzracunaniPreostanek; }).length;
    var indeksNacrtovanega = -1;
    var vrstice = !seznam.length
      ? (jeAtenaVnos ? '' : '<p class="izvedba-poravnava-potek__prazno">Ni še zabeleženih ' + (jeZgodovina ? 'dogodkov' : 'korakov') + '.</p>')
      : seznam.map(function (korak, i) {
      if (korak.jeNacrtovan && !korak.jeIzracunaniPreostanek) indeksNacrtovanega += 1;
      var jeRazveljivUkrep = !korak.jeNacrtovan && ["partial_payment", "partial_settlement", "paid_in_full", "payment_promised", "stop_plan"].indexOf(korak.actionType) >= 0;
      var odstraniGumb = korak.jeIzracunaniPreostanek
        ? '<span aria-hidden="true"></span>'
        : korak.jeNacrtovan
        ? '<button type="button" class="izvedba-poravnava-korak__odstrani" data-nacrt-odstrani="' + indeksNacrtovanega + '" aria-label="Odstrani ' + (jeZgodovina ? 'dogodek' : 'korak') + '">×</button>'
        : jeRazveljivUkrep
          ? '<button type="button" class="izvedba-poravnava-korak__odstrani" data-ukrep-odstrani="' + K.esc(korak.actionId) + '" data-ukrep-tip="' + K.esc(korak.actionType) + '" aria-label="Odstrani izvedeni korak">×</button>'
          : '<span class="izvedba-poravnava-korak__izveden" aria-label="Korak je že izveden" title="Že izvedeno"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span>';
      var metaDatum = korak.metaBesedilo || (korak.datumPriblizno ? "Približno " + korak.datumPriblizno : korak.datumNeznan ? "Datum ni znan" : K.formatirajDatumUro(korak.datum));
      var metaVsebina = (korak.jeNacrtovan ? '<span class="izvedba-poravnava-korak__pill">' + (korak.jeIzracunaniPreostanek ? 'Korak ' : jeZgodovina ? 'Dogodek ' : 'Korak ') + (i + 1) + '</span>' : '') +
        '<span class="izvedba-poravnava-korak__info-datum">' + K.esc(metaDatum) + '</span>';
      var znesekVsebina;
      var znesekZaPrikaz = korak.znesek != null ? korak.znesek : korak.prikazniZnesek;
      if (znesekZaPrikaz != null) {
        var znesekOznaka = korak.zaporednaStevilka
          ? '<span class="izvedba-poravnava-korak__znesek-oznaka">' + korak.zaporednaStevilka + '. ' + K.esc(BESEDA_ZAPOREDNEGA_KORAKA[korak.zaporednaSkupina]) + '</span>'
          : "";
        znesekVsebina = '<span class="izvedba-poravnava-korak__znesek-blok">' + znesekOznaka + '<span class="izvedba-poravnava-korak__znesek">' + K.esc(K.formatirajEur(znesekZaPrikaz)) + '</span></span>';
      } else {
        znesekVsebina = '<span></span>';
      }
      return '<div class="izvedba-poravnava-korak izvedba-poravnava-korak--' + K.esc(korak.razred) + (korak.jeNacrtovan ? ' izvedba-poravnava-korak--nacrtovan' : '') + (korak.jeIzracunaniPreostanek ? ' izvedba-poravnava-korak--izracunani-preostanek' : '') + '"' + (korak.jeIzracunaniPreostanek ? ' aria-label="Preostali dolg po pripravljenih dogodkih"' : '') + '>' +
        '<span class="izvedba-poravnava-korak__stevilka" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="izvedba-poravnava-korak__ikona" aria-hidden="true">' + K.ikona(korak.ikona) + '</span>' +
        '<span class="izvedba-poravnava-korak__info"><b data-izvedba-fit data-fit-min="8">' + K.esc(korak.naslov) + '</b><span class="izvedba-poravnava-korak__info-meta">' + metaVsebina + '</span></span>' +
        znesekVsebina +
        odstraniGumb +
      '</div>';
    }).join('');
    return '<div class="izvedba-poravnava-cona' + (jeAtenaVnos ? ' izvedba-poravnava-cona--atena-dogodki' + (!seznam.length ? ' is-empty' : '') : '') + '"><p class="izvedba-poravnava-cona__naslov">' + (jeAtenaVnos ? '' : '<span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">3</span>') + (jeDogovorniVnos ? 'Pripravljeni dogovori' : jeAtenaVnos ? 'Pripravljeni dogodki' : 'Potek primera') +
      '<span class="izvedba-poravnava-cona__stevilo-korakov">' + steviloDogodkov + ' ' + K.esc(jeDogovorniVnos ? besedaZaSteviloDogovorov(steviloDogodkov) : jeAtenaVnos || jeZgodovina ? besedaZaSteviloDogodkov(steviloDogodkov) : besedaZaSteviloKorakov(steviloDogodkov)) + '</span></p>' +
      (jeAtenaVnos && !seznam.length ? '' : '<div class="izvedba-poravnava-potek">' + vrstice + '</div>') + '</div>';
  }

  function izrisiStanjeDolga() {
    var prvotniZnesek = arguments.length > 0
      ? Number(arguments[0]) || 0
      : Number(state.zadeva && state.zadeva.prvotniZnesek) || 0;
    var preostaliZnesek = arguments.length > 1
      ? Number(arguments[1]) || 0
      : preostaliDolgPoNacrtu();
    var delezPoravnanega = delezPoravnanegaDolga(prvotniZnesek, preostaliZnesek);
    return '<div class="izvedba-dolg-tok" data-ai-live-debt-flow data-original-debt="' + K.esc(String(prvotniZnesek)) + '">' +
      '<div class="izvedba-dolg-tok__znesek">' +
        '<span class="izvedba-dolg-tok__oznaka" data-izvedba-fit data-fit-min="7.5">Originalni znesek</span>' +
        '<span class="izvedba-dolg-tok__vrednost" data-izvedba-fit data-fit-min="11">' + K.esc(K.formatirajEur(prvotniZnesek)) + '</span>' +
      '</div>' +
      '<div class="izvedba-dolg-tok__smer" aria-hidden="true"><span class="izvedba-dolg-tok__crta" data-ai-live-debt-progress style="--dolg-napredek:' + delezPoravnanega.toFixed(2) + '%"><span></span></span><span class="izvedba-dolg-tok__puscica"></span></div>' +
      '<div class="izvedba-dolg-tok__znesek izvedba-dolg-tok__znesek--preostanek">' +
        '<span class="izvedba-dolg-tok__oznaka" data-izvedba-fit data-fit-min="7.5">Preostali znesek</span>' +
        '<span class="izvedba-dolg-tok__vrednost" data-ai-live-debt-remaining data-izvedba-fit data-fit-min="11">' + K.esc(K.formatirajEur(preostaliZnesek)) + '</span>' +
      '</div>' +
    '</div>';
  }

  window.UJIzvedbaStanjeDolgaHtml = function (prvotniZnesek, preostaliZnesek) {
    return '<section class="zgodovina-stanje-dolga zgodovina-stanje-dolga--tok" aria-label="Stanje dolga">' +
      izrisiStanjeDolga(prvotniZnesek, preostaliZnesek) + '</section>';
  };

  function izrisiStanjeDolgaBlok() {
    return '<section class="zgodovina-stanje-dolga zgodovina-stanje-dolga--tok" aria-label="Stanje dolga">' + izrisiStanjeDolga() + '</section>';
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
      var priblizniDatum = String(korak.datumPriblizno || (korak.settings && korak.settings.occurredAtApproximation) || "").trim();
      podrobnosti += 'Datum: ' + K.esc(priblizniDatum ? "Približno: " + priblizniDatum : korak.datumNeznan || (korak.settings && korak.settings.occurredAtUnknown) ? "Ni znan" : K.formatirajDatumUro(korak.datum)) + '<br>';
      var znesekVsebina = korak.znesek != null
        ? '<span class="izvedba-poravnava-korak__znesek-blok"><span class="izvedba-poravnava-korak__znesek">' + K.esc(K.formatirajEur(korak.znesek)) + '</span></span>'
        : '<span></span>';
      return '<div class="izvedba-poravnava-korak izvedba-poravnava-korak--' + K.esc(korak.razred) + '">' +
        '<span class="izvedba-poravnava-korak__stevilka" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="izvedba-poravnava-korak__ikona" aria-hidden="true">' + K.ikona(korak.ikona) + '</span>' +
        '<span class="izvedba-poravnava-korak__info"><b data-izvedba-fit data-fit-min="8">' + K.esc(korak.naslov) + '</b><span class="izvedba-poravnava-korak__info-meta"><span class="izvedba-poravnava-korak__info-datum">' + (i + 1) + '. korak · ' + K.esc(priblizniDatum ? "Približno " + priblizniDatum : korak.datumNeznan || (korak.settings && korak.settings.occurredAtUnknown) ? "Datum ni znan" : K.formatirajDatumUro(korak.datum)) + '</span></span></span>' +
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

  // ---------- Čarovnik: Posreduj takoj odvetniku ----------

  function dnevZamude() {
    var rok = state.zadeva && state.zadeva.datumZapadlosti;
    if (!rok) return null;
    var razlika = Math.round((Date.now() - new Date(rok).getTime()) / 86400000);
    return razlika > 0 ? razlika : 0;
  }

  function pripraviDokumenteZaOdvetnika() {
    var z = state.zadeva || {};
    var poslanihOpominov = (state.steps || []).filter(function (k) { return k.execution_state === "sent"; }).length;
    return [
      { id: "racun", title: "Račun", ready: Boolean(z.stevilkaRacuna) },
      { id: "podatki_dolznika", title: "Podatki dolžnika", ready: Boolean(z.imeDolznika) },
      { id: "zgodovina_opominov", title: "Zgodovina opominov", ready: poslanihOpominov > 0 },
    ];
  }

  function privzetoSporociloOdvetniku(paket) {
    var z = state.zadeva || {};
    var zgodovina = zgodovinaPredNacrtomZaOdvetnika().map(opisDogodkaZaOdvetnika);
    var zgodovinaBesedilo = zgodovina.length
      ? " Pred začetkom postopka se je pri računu zgodilo naslednje: " + zgodovina.join(" ")
      : "";
    var zamude = state.lawyerWizard && state.lawyerWizard.historyLatePayments;
    var tveganjeBesedilo = zamude === "unknown" || zamude == null ? ""
      : zamude === "0" ? " Dolžnik pred tem računom ni zamujal s plačili."
      : " Dolžnik je v preteklosti s plačilom zamudil " + (zamude === "9plus" ? "devetkrat ali več" : zamude + "-krat") + ".";
    return "Pozdravljeni, prosim za pomoč pri izterjavi zapadlega dolga v višini " +
      K.formatirajEur(z.preostaliDolg) + " od dolžnika " + (z.imeDolznika || "—") +
      "." + tveganjeBesedilo + zgodovinaBesedilo + " Priloženi so podatki primera" + (paket && paket.id !== "case_review" ? " in zgodovina poslanih opominov." : ".");
  }

  function vstopiVOdvetnikZgodovino() {
    var w = state.lawyerWizard;
    if (!w || w.historyBufferActive) return;
    if (typeof window.UJZgodovinaNastaviPrivzetiNacin === "function") {
      window.UJZgodovinaNastaviPrivzetiNacin("natural");
    }
    w.previousNacrtKoraki = kopirajPodatke(state.nacrtKoraki || []);
    state.nacrtKoraki = kopirajPodatke(w.historyEvents || zgodovinaPredNacrtomZaOdvetnika());
    w.historyBufferActive = true;
    state.selectedSettlementType = null;
    state.customActionActive = false;
  }

  function zapustiOdvetnikZgodovino(shraniVPlan) {
    var w = state.lawyerWizard;
    if (!w || !w.historyBufferActive) return;
    w.historyEvents = kopirajPodatke(state.nacrtKoraki || []);
    state.nacrtKoraki = kopirajPodatke(w.previousNacrtKoraki || []);
    w.historyBufferActive = false;
    if (shraniVPlan && state.plan) {
      state.plan.historyBeforePlan = kopirajPodatke(w.historyEvents);
      w.preservePlanHandoff = false;
      if (!w.messageEditedManually) w.message = privzetoSporociloOdvetniku(najdiLawyerPaket(w.packageId));
    }
  }

  function odpriOdvetnikCarovnik() {
    if (state.isSubmitting) return;
    actionSheetReturnFocus = document.activeElement;
    var obstojeciKorak = najdiLawyerStep();
    var obstojeciLh = (obstojeciKorak && obstojeciKorak.lawyerHandoff) || {};
    var pripravljenaPredaja = podatkiPripravljenePredaje(obstojeciLh);
    var imaZgodovinoPredNacrtom = zgodovinaPredNacrtomZaOdvetnika().length > 0;
    var privzetPaket = najdiLawyerPaket((pripravljenaPredaja.selectedPackage && pripravljenaPredaja.selectedPackage.packageId) || "legal_proceeding");
    state.selectedActionType = "handoff_to_lawyer";
    state.actionSheetMode = "lawyer";
    state.error = null;
    state.settingsByAction.handoff_to_lawyer = JSON.parse(JSON.stringify(DEFAULT_ACTION_SETTINGS.handoff_to_lawyer));
    state.settingsByAction.handoff_to_lawyer.timingMode = pripravljenaPredaja.timingMode;
    state.settingsByAction.handoff_to_lawyer.scheduledHandoffAt = pripravljenaPredaja.scheduledHandoffAt;
    state.lawyerWizard = state.lawyerWizardDraft ? kopirajPodatke(state.lawyerWizardDraft) : {
      screen: "zgodovina",
      packageId: privzetPaket.id,
      lawyerId: pripravljenaPredaja.lawyerId || privzetPaket.lawyerId,
      message: pripravljenaPredaja.messageEditedManually || !imaZgodovinoPredNacrtom ? pripravljenaPredaja.message : "",
      messageEditedManually: pripravljenaPredaja.messageEditedManually,
      preparedFromPlan: pripravljenaPredaja.pripravljen,
      preservePlanHandoff: pripravljenaPredaja.pripravljen && (pripravljenaPredaja.messageEditedManually || !imaZgodovinoPredNacrtom),
      preparedData: pripravljenaPredaja,
      availableHandoffDays: pripravljenaPredaja.availableHandoffDays.length
        ? kopirajPodatke(pripravljenaPredaja.availableHandoffDays)
        : kopirajPodatke(najdiLawyerProfil(pripravljenaPredaja.lawyerId || privzetPaket.lawyerId).availableHandoffDays),
      razumem: false,
      historyEvents: pripravljenaPredaja.historyBeforePlan.length ? kopirajPodatke(pripravljenaPredaja.historyBeforePlan) : kopirajPodatke(zgodovinaPredNacrtomZaOdvetnika()),
      historyLatePayments: pripravljenaPredaja.riskAssessment && pripravljenaPredaja.riskAssessment.latePayments || null,
      customHistoryDescription: "",
      customHistoryDate: new Date().toISOString().slice(0, 10),
    };
    if (!Array.isArray(state.lawyerWizard.historyEvents)) {
      state.lawyerWizard.historyEvents = kopirajPodatke(zgodovinaPredNacrtomZaOdvetnika());
      state.lawyerWizard.screen = "zgodovina";
    }
    state.lawyerWizard.screen = state.lawyerWizard.screen || "zgodovina";
    if (state.lawyerWizard.screen === "zgodovina") vstopiVOdvetnikZgodovino();
    state.actionSheetOpen = true;
    izrisiSticky();
    izrisiActionSheet();
    requestAnimationFrame(function () {
      var izbrani = elActionSheet && elActionSheet.querySelector(".lp-paket-kartica--izbrana");
      var prvi = izbrani || (elActionSheet && elActionSheet.querySelector("[data-lawyer-package]"));
      if (prvi) prvi.focus({ preventScroll: true });
      poravnajIzbraniLawyerPaket();
    });
  }

  function poravnajIzbraniLawyerPaket() {
    var izbrani = elActionSheet && elActionSheet.querySelector(".lp-paket-kartica--izbrana");
    var carousel = izbrani && izbrani.closest(".lp-paket-carousel");
    if (!izbrani || !carousel) return;
    requestAnimationFrame(function () {
      carousel.style.scrollBehavior = "auto";
      carousel.scrollLeft = Math.max(0, izbrani.offsetLeft - (carousel.clientWidth - izbrani.offsetWidth) / 2);
    });
  }

  /* Markup od tod do konca "Čarovnik: Posreduj takoj odvetniku" dobesedno
     povzema razrede in strukturo obstoječega "Predaja odvetniku" (10. korak
     v opomin-nacrt-ui.js: htmlPredajaPovzetek/htmlPaketKartica/
     htmlPredajaOdvetnikPill/htmlPredajaDnevi/htmlPredajaDokumenti/
     izrisiPotrditevPredajeOdvetniku) - styles.css je na izvedba.html že
     naložen, zato je videz brez ene same nove vrstice CSS enak. Ne uvaža se
     opomin-nacrt-ui.js sam (677 KB, tuja DOM/globalna vezava - gl. ZAPISNIK),
     samo njegov CSS besednjak in podatkovna oblika. */
  function cenaPaketaKratka(paket) {
    if (!(paket.cena > 0)) return "Vključeno";
    return (paket.cenaPredpona ? paket.cenaPredpona + " " : "") + paket.cena.toFixed(2).replace(".", ",") + " €";
  }

  function lawyerPaketIkona(ikona) {
    if (ikona === "mail") return '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';
    if (ikona === "phone") return '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
    if (ikona === "scales") return '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 7h14M5 7l-3 6h6L5 7Zm14 0-3 6h6l-3-6ZM8 21h8"/></svg>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';
  }

  function lawyerKorakIkona(ikona) {
    if (ikona === "person") return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="23" r="11" stroke="currentColor" stroke-width="2.4"/><path d="M14 53c2-11 9-17 18-17s16 6 18 17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M23 40l9 8 9-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if (ikona === "scales") return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M32 9v43M18 16h28M12 51h40M32 16 19 22M32 16l13 6M19 22l-8 17h16l-8-17ZM45 22l-8 17h16l-8-17Z" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 39c1 5 15 5 16 0M37 39c1 5 15 5 16 0" stroke="currentColor" stroke-width="2.3"/></svg>';
    if (ikona === "phone") return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11h9l3 12-7 5c4 8 7 11 15 15l5-7 12 3v9c0 4-3 7-7 7-22-2-39-19-41-41 0-4 3-7 7-7Z" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';
    if (ikona === "document") return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h24l8 8v30H17z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M41 8v10h8M24 25h17M24 32h13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M30 46s5-7 13-7 13 7 13 7-5 7-13 7-13-7-13-7Z" fill="#f5faf9" stroke="currentColor" stroke-width="2.2"/><circle cx="43" cy="46" r="3.2" stroke="currentColor" stroke-width="2.2"/></svg>';
    return '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="16" width="44" height="34" rx="4" stroke="currentColor" stroke-width="2.4"/><path d="m12 20 20 16 20-16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function lawyerVecInfoIkona() {
    return '<span class="lp-korak__vec-info"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="4.5" stroke="currentColor" stroke-width="1.8"/><path d="m12 12 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>';
  }

  function paketZaWizard(w) {
    var osnova = najdiLawyerPaket(w.packageId);
    var planPaket = w.preparedFromPlan && w.preparedData && w.preparedData.selectedPackage;
    if (!planPaket || planPaket.packageId !== w.packageId) return osnova;
    return Object.assign({}, osnova, {
      id: planPaket.packageId,
      naslov: planPaket.titleSnapshot || planPaket.title || osnova.naslov,
      cena: typeof planPaket.priceCents === "number" ? planPaket.priceCents / 100 : osnova.cena,
    });
  }

  function odvetnikZaWizard(w) {
    if (w.preparedFromPlan && w.preparedData && w.preparedData.lawyerId === w.lawyerId) {
      return Object.assign({ id: w.lawyerId, rating: "" }, w.preparedData.lawyerSnapshot, {
        availableHandoffDays: w.preparedData.availableHandoffDays,
      });
    }
    return najdiLawyerProfil(w.lawyerId);
  }

  function dokumentiZaWizard(w) {
    if (w.preparedFromPlan && w.preparedData) {
      return (w.preparedData.documents || []).map(function (d) {
        return Object.assign({}, d, { title: d.name || d.title || d.type || "Dokument", ready: d.status !== "missing" });
      });
    }
    return pripraviDokumenteZaOdvetnika();
  }

  function lawyerDokumentIkona() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>';
  }

  function lawyerDokumentPregledIkona() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7"/><polyline points="14 2 14 8 20 8"/><path d="M15 18.5c1.4-1.9 3.1-1.9 4.5 0"/><circle cx="17.25" cy="16.25" r="1.75"/></svg>';
  }

  function lawyerSporociloIkona() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 9.3 9.3 0 0 1-4-.9L3 21l1.7-4.4A8.4 8.4 0 1 1 21 11.5Z"/><circle cx="8.5" cy="11.5" r=".65" fill="currentColor" stroke="none"/><circle cx="12" cy="11.5" r=".65" fill="currentColor" stroke="none"/><circle cx="15.5" cy="11.5" r=".65" fill="currentColor" stroke="none"/></svg>';
  }

  function lawyerSvincnikIkona() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
  }

  function dokumentneKategorijeZaWizard(w) {
    var pripravljeni = dokumentiZaWizard(w);
    var imaPripravljenoPredajo = Boolean(w.preparedFromPlan && w.preparedData);
    var vsiPripravljeni = imaPripravljenoPredajo && pripravljeni.length > 0;
    var pogodba = pripravljeni.some(function (d) {
      return /pogodb|ponudb|contract|offer/i.test(String(d.type || d.title || d.name || ""));
    });
    var zgodovina = pripravljeni.some(function (d) {
      return /opomin|zgodovin|reminder|history/i.test(String(d.type || d.title || d.name || ""));
    });
    var racun = pripravljeni.some(function (d) { return /invoice|račun|racun/i.test(String(d.type || d.title || d.name || "")); });
    var steviloDatotekZgodovine = pripravljeni.filter(function (d) { return /opomin|zgodovin|reminder|history/i.test(String(d.type || d.title || d.name || "")); }).length;
    return [
      { id: "racun", title: "Račun", subtitle: racun ? "1 datoteka" : "Stranka nima računa", ready: vsiPripravljeni || racun || Boolean(state.zadeva && state.zadeva.stevilkaRacuna) },
      { id: "podatki_dolznika", title: "Podatki dolžnika", subtitle: "Pripravljeno · 0 datotek", ready: vsiPripravljeni || Boolean(state.zadeva && state.zadeva.imeDolznika) },
      { id: "zgodovina_opominov", title: "Zgodovina opominov", subtitle: "Pripravljeno · " + steviloDatotekZgodovine + (steviloDatotekZgodovine === 1 ? " datoteka" : " datotek"), ready: vsiPripravljeni || zgodovina || Boolean((state.plan && state.plan.steps || []).some(function (s) { return s && s.kind !== "manual_lawyer" && !s.isExcluded; })) },
      { id: "pogodba_ponudba", title: "Pogodba ali ponudba", subtitle: pogodba ? "1 datoteka" : (vsiPripravljeni ? "Pripravljeno" : "Manjka"), ready: vsiPripravljeni || pogodba },
    ];
  }

  function zgodovinaPredNacrtomZaOdvetnika() {
    return Array.isArray(state.plan && state.plan.historyBeforePlan)
      ? state.plan.historyBeforePlan.filter(Boolean)
      : [];
  }

  function opisDogodkaZaOdvetnika(korak) {
    var tip = String(korak.tip || korak.razred || "");
    var nastavitve = korak.settings || {};
    var znesek = Number(korak.znesek != null ? korak.znesek : nastavitve.paymentAmount);
    var znesekBesedilo = Number.isFinite(znesek) && znesek > 0 ? " v višini " + K.formatirajEur(znesek) : "";
    var naciniPlacila = { bank_transfer: "z bančnim nakazilom", cash: "z gotovino", card: "s kartico", direct_debit: "z direktno obremenitvijo", other: "na drug način" };
    var nacinBesedilo = naciniPlacila[nastavitve.paymentMethod] ? " " + naciniPlacila[nastavitve.paymentMethod] : "";
    if (tip === "partial" || tip === "delno") return "Račun je bil delno poravnan" + znesekBesedilo + nacinBesedilo + ".";
    if (tip === "installment" || tip === "obrok") return "Dogovorjeno je bilo obročno plačilo" + znesekBesedilo + nacinBesedilo + ".";
    if (tip === "payment_promised" || tip === "obljuba") return "Dolžnik je obljubil plačilo.";
    if (tip === "credit_note" || tip === "dobropis") return "Izdan je bil dobropis" + znesekBesedilo + ".";
    if (tip === "compensation" || tip === "kompenzacija") return "Dolg je bil poravnan s kompenzacijo" + znesekBesedilo + ".";
    if (tip === "cancelled_invoice" || tip === "storno") return "Račun je bil odpisan oziroma storniran.";
    if (tip === "debtor_statement" || tip === "izjava") return "Dolžnik je izjavil: " + String(nastavitve.description || korak.naslov || "").replace(/^Izjava dolžnika:\s*/i, "").replace(/[.!?]+$/, "") + ".";
    var opis = String(nastavitve.description || korak.naslov || "").trim();
    if (!opis) return "Zabeležen je bil dodaten dogodek pri računu.";
    if (opis.length > 120) opis = opis.slice(0, 117).trim() + "…";
    return opis.replace(/[.!?]+$/, "") + ".";
  }

  function izrisiOdvetnikZgodovino() {
    return '<div class="izvedba-odvetnik-zgodovina"><section class="izvedba-odvetnik-zgodovina__dogodki"><div class="izvedba-odvetnik-zgodovina__uvod"><div><h3>Kaj se je do zdaj zgodilo?</h3><p>Dodajte samo dogodke, ki so se že zgodili.</p></div></div>' +
      izrisiStanjeDolgaBlok() + izrisiPoravnavaSvicer() + izrisiPoravnavaPodrobnosti() + izrisiPotekPrimera() + '</section></div>';
  }

  function razredDogodkaZaOdvetnika(korak) {
    var razred = String(korak.razred || korak.tip || "drugo");
    if (razred === "partial") return "delno";
    if (razred === "installment") return "obrok";
    if (razred === "payment_promised" || razred === "akcija-obljuba") return "obljuba";
    if (razred === "credit_note") return "dobropis";
    if (razred === "compensation") return "kompenzacija";
    if (razred === "cancelled_invoice") return "storno";
    return razred;
  }

  function steviloVsehDokumentovZaWizard(w) {
    var dodatni = dokumentiZaWizard(w).filter(function (d) {
      return /other|work_evidence|dokaz/i.test(String(d.type || ""));
    }).length;
    return 4 + dodatni;
  }

  function izrisiOdvetnikPaket() {
    var w = state.lawyerWizard;
    var z = state.zadeva || {};
    var zamuda = dnevZamude();
    var paketiZaPrikaz = LAWYER_PACKAGES.slice().sort(function (a, b) {
      if (a.id === w.packageId) return -1;
      if (b.id === w.packageId) return 1;
      return 0;
    });

    var povzetek = '<section class="lp-predaja-povzetek" aria-label="Predaja odvetniku">' +
      '<div class="lp-predaja-povzetek__glava">' +
        '<span class="lp-predaja-povzetek__ikona" aria-hidden="true">' + K.ikona("scales") + '</span>' +
        '<div class="lp-predaja-povzetek__glava-besedilo">' +
          '<h2 class="lp-predaja-povzetek__naslov">Predaja odvetniku</h2>' +
          '<p class="lp-predaja-povzetek__podnaslov">Ne bo plačal</p>' +
        '</div>' +
        '<span class="lp-predaja-povzetek__znacka">Za pregled</span>' +
      '</div>' +
      '<p class="lp-predaja-povzetek__eyebrow">PODATKI O PRIMERU</p>' +
      '<div class="lp-predaja-povzetek__telo"><div class="debt-summary-skupina">' +
        '<div class="debt-summary debt-summary--vrstica-1">' +
          '<div class="debt-summary__amount-column"><span class="debt-summary__label">Dolžnik</span><span class="debt-summary__amount debt-summary__amount--sm lp-predaja-povzetek__dolznik" data-izvedba-fit data-fit-min="10">' + K.esc(z.imeDolznika || "—") + '</span></div>' +
          '<div class="debt-summary__category-column"><span class="debt-summary__label">Dolg</span><span class="debt-summary__amount debt-summary__amount--sm" data-izvedba-fit data-fit-min="10">' + K.esc(K.formatirajEur(z.preostaliDolg)) + '</span></div>' +
        '</div>' +
        '<div class="debt-summary debt-summary--tri debt-summary--vrstica-2">' +
          '<div class="debt-summary__amount-column"><span class="debt-summary__label">Zapadlost</span><span class="debt-summary__amount debt-summary__amount--sm" data-izvedba-fit data-fit-min="9">' + K.esc(datumSamoZaPrikaz(z.datumZapadlosti) || "—") + '</span></div>' +
          '<div class="debt-summary__category-column"><span class="debt-summary__label">Zamuda</span><span class="debt-summary__amount debt-summary__amount--sm" data-izvedba-fit data-fit-min="9">' + (zamuda != null ? K.esc(zamuda) + (zamuda === 1 ? ' dan' : ' dni') : "—") + '</span></div>' +
          '<div class="debt-summary__category-column"><span class="debt-summary__label">Pretekle zamude</span><span class="debt-summary__amount debt-summary__amount--sm">—</span></div>' +
        '</div>' +
      '</div></div>' +
    '</section>';

    var kartice = paketiZaPrikaz.map(function (paketOsnova) {
      var paket = w.packageId === paketOsnova.id ? paketZaWizard(w) : paketOsnova;
      var izbran = w.packageId === paket.id;
      var jePriporocen = paket.id === "lawyer_demand_letter" && !izbran;
      var odvetnik = izbran && w.preparedFromPlan ? odvetnikZaWizard(w) : najdiLawyerProfil(paket.lawyerId);
      var cena = cenaPaketaKratka(paket);
      var cenaRazred = cena.length > 12 ? " lp-paket-kartica__cena-znesek--zelo-dolg" : cena.length > 8 ? " lp-paket-kartica__cena-znesek--dolg" : "";
      var naslovRazred = paket.naslov.length > 27 ? " lp-paket-kartica__naslov--zelo-dolg" : paket.naslov.length > 21 ? " lp-paket-kartica__naslov--dolg" : "";
      var opisRazred = paket.opis.length > 62 ? " lp-paket-kartica__opis--zelo-dolg" : paket.opis.length > 48 ? " lp-paket-kartica__opis--dolg" : "";
      return '<div class="lp-paket-kartica lp-paket-kartica--standard' + (izbran ? ' lp-paket-kartica--izbrana' : '') + (jePriporocen ? ' lp-paket-kartica--priporocena' : '') + '" data-lawyer-package="' + K.esc(paket.id) + '" role="listitem" tabindex="0" aria-pressed="' + String(izbran) + '">' +
        (jePriporocen ? '<span class="lp-paket-kartica__znacka lp-paket-kartica__znacka--priporoceno"><span aria-hidden="true">★</span><span>Priporočeno</span></span>' : '') +
        (izbran ? '<span class="lp-paket-kartica__znacka lp-paket-kartica__znacka--izbrano">Izbrano ✓</span>' : '') +
        '<div class="lp-paket-kartica__cena-vrstica"><span class="lp-paket-kartica__ikona" aria-hidden="true">' + lawyerPaketIkona(paket.ikona) + '</span>' +
          '<span class="lp-paket-kartica__cena"><span class="lp-paket-kartica__cena-znesek' + cenaRazred + '">' + K.esc(cena) + '</span>' + (paket.cenaOpis ? '<span class="lp-paket-kartica__cena-opis">' + K.esc(paket.cenaOpis) + '</span>' : '') + '</span>' +
        '</div>' +
        '<h4 class="lp-paket-kartica__naslov' + naslovRazred + '">' + K.esc(paket.naslov) + '</h4>' +
        '<p class="lp-paket-kartica__opis' + opisRazred + '">' + K.esc(paket.opis) + '</p>' +
        '<div class="lp-paket-kartica__odvetnik"><span class="lp-paket-kartica__odvetnik-avatar" aria-hidden="true">' + K.esc(inicialkeOdvetnika(odvetnik)) + '</span>' +
          '<span class="lp-paket-kartica__odvetnik-podatki">' + (izbran ? '' : '<small>Najboljša ponudba</small>') + '<strong data-fit-text data-fit-text-min="8">' + K.esc(odvetnik.shortName || odvetnik.name) + '</strong></span>' +
          (odvetnik.rating ? '<span class="lp-paket-kartica__odvetnik-ocena">★ ' + K.esc(odvetnik.rating) + '</span>' : '') + '</div>' +
        (paket.requiresSurcharge ? '<span class="lp-paket-kartica__doplacilo">Doplačilo</span>' : '<span class="lp-paket-kartica__doplacilo lp-paket-kartica__doplacilo--prazen" aria-hidden="true">Doplačilo</span>') +
        '<div class="lp-paket-kartica__gumbi"><button type="button" class="lp-paket-kartica__gumb lp-paket-kartica__gumb--predogled" data-lawyer-package-preview="' + K.esc(paket.id) + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>Predogled</span></button>' +
          '<button type="button" class="lp-paket-kartica__gumb lp-paket-kartica__gumb--izberi" data-lawyer-package="' + K.esc(paket.id) + '">' + (izbran ? 'Spremeni izbiro' : 'Izberi') + '</button></div>' +
      '</div>';
    }).join("");

    var pike = paketiZaPrikaz.map(function (paket) {
      return '<button type="button" class="lp-paket-pika' + (w.packageId === paket.id ? ' lp-paket-pika--aktivna' : '') + '" data-lawyer-scroll-package="' + K.esc(paket.id) + '" aria-label="Paket ' + K.esc(paket.naslov) + '"></button>';
    }).join("");
    var izbraniPaket = paketZaWizard(w);
    var izbraniOdvetnik = odvetnikZaWizard(w);
    var filterPonudb = '<div class="lp-filter-ponudb__orodna-vrstica">' +
      '<button type="button" class="lp-filter-ponudb__priporoceno" data-lawyer-scroll-package="lawyer_demand_letter"><span aria-hidden="true">★</span><span>Priporočeno</span></button>' +
      '<button type="button" class="lp-filter-ponudb__odpri" data-lawyer-show-all><span class="lp-filter-ponudb__odpri-ikona" aria-hidden="true">' + K.ikona("sliders") + '</span><span class="lp-filter-ponudb__odpri-tekst">Mešane ponudbe</span><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button></div>' +
      '<p class="lp-filter-ponudb__povzetek"><strong>Zakaj priporočamo:</strong> Glede na dosedanji potek je to najprimernejši naslednji pravni korak.</p>';
    var koraki = '<div class="lp-koraki"><div class="lp-koraki__vrstica">' +
      '<button type="button" class="lp-korak lp-korak--odvetnik" data-lawyer-details><span class="lp-korak__st">1</span><span class="lp-korak__ikona lp-korak__ikona--odvetnik" aria-hidden="true">' + lawyerKorakIkona("person") + lawyerVecInfoIkona() + '</span><span class="lp-korak__besedilo"><strong class="lp-korak__naslov" data-fit-text data-fit-text-min="8">' + K.esc(izbraniOdvetnik.shortName || izbraniOdvetnik.name) + '</strong></span></button>' +
      '<span class="lp-koraki__puscica" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span>' +
      '<button type="button" class="lp-korak lp-korak--klikljiv" data-lawyer-package-preview="' + K.esc(izbraniPaket.id) + '"><span class="lp-korak__st">2</span><span class="lp-korak__ikona" aria-hidden="true">' + lawyerKorakIkona(izbraniPaket.ikona) + lawyerVecInfoIkona() + '</span><span class="lp-korak__besedilo"><strong class="lp-korak__naslov">' + K.esc(izbraniPaket.naslov.replace(/^Začetek /, "")) + '</strong></span></button>' +
      '<span class="lp-koraki__puscica" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span>' +
      '<button type="button" class="lp-korak lp-korak--klikljiv" data-lawyer-next><span class="lp-korak__st">3</span><span class="lp-korak__ikona" aria-hidden="true">' + lawyerKorakIkona("scales") + lawyerVecInfoIkona() + '</span><span class="lp-korak__besedilo"><strong class="lp-korak__naslov">Začetek postopka</strong></span></button>' +
      '</div></div>';

    return povzetek +
      '<section class="lp-kaj-se-bo-zgodilo" aria-label="Kaj se bo zgodilo">' +
        '<div class="lp-kaj-se-bo-zgodilo__glava"><span class="lp-kaj-se-bo-zgodilo__glava-ikona" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg></span><div class="lp-kaj-se-bo-zgodilo__glava-besedilo"><h3>Izberite naslednji korak</h3></div></div>' +
        filterPonudb + '<div class="lp-paket-pike">' + pike + '</div>' +
        '<div class="lp-paket-carousel-ovoj"><div class="lp-paket-carousel" role="list" aria-label="Paketi">' + kartice + '</div></div>' + koraki +
      '</section>';
  }

  function izrisiOdvetnikPaketPregled() {
    var w = state.lawyerWizard;
    var paket = (w.previewPackageId || w.packageId) === w.packageId ? paketZaWizard(w) : najdiLawyerPaket(w.previewPackageId);
    var odvetnik = (w.previewPackageId || w.packageId) === w.packageId ? odvetnikZaWizard(w) : najdiLawyerProfil(paket.lawyerId);
    return '<section class="opomin-predaja-pregled__kartica opomin-predaja-pregled__kartica--paket">' +
      '<div class="opomin-predaja-pregled__odvetnik-glava"><span class="opomin-predaja-pregled__odvetnik-ikona" aria-hidden="true">' + K.ikona(paket.ikona) + '</span>' +
      '<div class="opomin-predaja-pregled__odvetnik-besedilo"><span class="opomin-predaja-pregled__odvetnik-naslov">' + K.esc(paket.naslov) + '</span>' +
      '<span class="opomin-predaja-pregled__odvetnik-ime">' + K.esc(odvetnik.name) + '</span><span class="opomin-predaja-pregled__odvetnik-email">' + K.esc(odvetnik.officeName || "") + '</span></div></div>' +
      '<hr class="opomin-predaja-pregled__paket-locnica" /><p class="opomin-predaja-pregled__sporocilo-besedilo">' + K.esc(paket.opis) + '</p>' +
      '<div class="opomin-predaja-pregled__paket-vrstica"><strong>' + K.esc(cenaPaketaKratka(paket)) + '</strong></div></section>';
  }

  function inicialkeOdvetnika(odvetnik) {
    var deli = String((odvetnik && odvetnik.name) || "").trim().split(/\s+/).filter(Boolean);
    return (deli[0] ? deli[0][0] : "") + (deli[1] ? deli[1][0] : "");
  }

  function sloIndexDnevaPredaje(datum) {
    return datum.getDay() === 0 ? 6 : datum.getDay() - 1;
  }

  function najzgodnejsiCasLawyerPredaje(dnevi) {
    var dovoljeniDnevi = Array.isArray(dnevi) && dnevi.some(Boolean) ? dnevi : [true, true, true, true, true, false, false];
    var kandidat = new Date(Date.now() + 5 * 60000);
    kandidat.setSeconds(0, 0);
    kandidat.setMinutes(Math.ceil(kandidat.getMinutes() / 5) * 5);
    if (dovoljeniDnevi[sloIndexDnevaPredaje(kandidat)]) return kandidat.toISOString();
    for (var zamik = 1; zamik <= 7; zamik += 1) {
      var naslednji = new Date(kandidat);
      naslednji.setDate(kandidat.getDate() + zamik);
      naslednji.setHours(9, 0, 0, 0);
      if (dovoljeniDnevi[sloIndexDnevaPredaje(naslednji)]) return naslednji.toISOString();
    }
    return kandidat.toISOString();
  }

  function casLawyerPredaje(nastavitve, dnevi) {
    var nastavljen = nastavitve && nastavitve.scheduledHandoffAt;
    if (nastavljen && !Number.isNaN(new Date(nastavljen).getTime())) return nastavljen;
    return najzgodnejsiCasLawyerPredaje(dnevi);
  }

  function lawyerDatumDeli(iso) {
    var datum = new Date(iso);
    if (Number.isNaN(datum.getTime())) datum = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return {
      datum: datum.getFullYear() + "-" + pad(datum.getMonth() + 1) + "-" + pad(datum.getDate()),
      ura: pad(datum.getHours()) + ":" + pad(datum.getMinutes()),
      kratko: pad(datum.getDate()) + "." + pad(datum.getMonth() + 1) + ".",
      dan: ["Nedelja", "Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota"][datum.getDay()],
    };
  }

  function izrisiOdvetnikPodrobnosti() {
    var w = state.lawyerWizard;
    var nastavitve = state.settingsByAction.handoff_to_lawyer;
    var odvetnik = odvetnikZaWizard(w);
    var dokumenti = dokumentneKategorijeZaWizard(w);
    var pripravljenih = dokumenti.filter(function (d) { return d.ready; }).length;
    var zgodovinaPredNacrtom = zgodovinaPredNacrtomZaOdvetnika();
    var casPredaje = casLawyerPredaje(nastavitve, w.availableHandoffDays);
    var casPredajeDeli = lawyerDatumDeli(casPredaje);
    var danesZaVnos = lawyerDatumDeli(new Date().toISOString()).datum;
    var oznakeDnevov = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];
    var gumbiDnevov = oznakeDnevov.map(function (oznaka, index) {
      var aktiven = Boolean(w.availableHandoffDays && w.availableHandoffDays[index]);
      return '<button type="button" class="opomin-predaja-sestavljalnik__dan' + (aktiven ? ' opomin-predaja-sestavljalnik__dan--aktiven' : '') + '" data-lawyer-day="' + index + '" aria-pressed="' + aktiven + '">' + oznaka + '</button>';
    }).join("");

    var pill = '<button type="button" class="opomin-predaja-sestavljalnik__odvetnik-pill" data-lawyer-swap-toggle>' +
      '<span class="opomin-predaja-sestavljalnik__odvetnik-avatar" aria-hidden="true">' + K.esc(inicialkeOdvetnika(odvetnik)) + '</span>' +
      '<span class="opomin-predaja-sestavljalnik__odvetnik-besedilo"><span class="opomin-predaja-sestavljalnik__odvetnik-ime" data-izvedba-fit data-fit-min="8.5">' + K.esc(odvetnik.name) + '</span></span>' +
      '<span class="opomin-predaja-sestavljalnik__odvetnik-vsi"><span>Preglej vse odvetnike</span><span class="opomin-predaja-sestavljalnik__odvetnik-chevron" aria-hidden="true">' + K.ikona("chevron") + '</span></span>' +
    '</button>' +
    '<div class="izvedba-odvetnik-seznam" data-lawyer-swap-list' + (w.showLawyerList ? '' : ' hidden') + '>' +
      LAWYER_PROFILES.map(function (o) {
        var izbran = w.lawyerId === o.id;
        return '<button type="button" class="izvedba-odvetnik-vrstica' + (izbran ? ' is-selected' : '') + '" data-lawyer-select="' + K.esc(o.id) + '"><b>' + K.esc(o.name) + '</b><span>' + K.esc(o.officeName) + ' · ★ ' + K.esc(o.rating) + '</span></button>';
      }).join("") +
    '</div>';

    var dnevi = '<section class="opomin-predaja-sestavljalnik__dnevi" aria-labelledby="opomin-predaja-dnevi-naslov">' +
      '<div class="opomin-predaja-sestavljalnik__dnevi-glava"><span class="opomin-predaja-sestavljalnik__dnevi-ikona" aria-hidden="true">' + K.ikona("calendar") + '</span>' +
        '<h3 class="opomin-predaja-sestavljalnik__dnevi-naslov" id="opomin-predaja-dnevi-naslov">Možni dnevi predaje</h3><span class="opomin-predaja-sestavljalnik__dnevi-znacka">Po navodilih odvetnika</span></div>' +
        '<div class="opomin-predaja-sestavljalnik__dnevi-vrstica" role="group" aria-label="Možni dnevi predaje">' + gumbiDnevov + '</div>' +
        '<p class="opomin-predaja-sestavljalnik__dnevi-pomoc">Privzeto nastavi izbrani odvetnik · lahko spremenite</p>' +
      '<div class="opomin-predaja-sestavljalnik__cas" aria-label="Čas predaje">' +
        '<div class="opomin-predaja-sestavljalnik__cas-vrstica' + (nastavitve.timingMode === "asap" ? ' opomin-predaja-sestavljalnik__cas-vrstica--aktivna' : '') + '">' +
          '<button type="button" class="opomin-predaja-sestavljalnik__cas-gumb" data-lawyer-timing="asap" aria-pressed="' + (nastavitve.timingMode === "asap") + '">Čimprej</button>' +
          '<span class="opomin-predaja-sestavljalnik__cas-rezultat"><strong class="opomin-predaja-sestavljalnik__cas-dan" data-izvedba-fit data-fit-min="11">' + K.esc(casPredajeDeli.dan) + '</strong><span class="opomin-predaja-sestavljalnik__cas-datum-ura">' + K.esc(casPredajeDeli.kratko) + '<span aria-hidden="true"> · </span>' + K.esc(casPredajeDeli.ura) + '</span></span>' +
        '</div>' +
        '<div class="opomin-predaja-sestavljalnik__cas-vrstica opomin-predaja-sestavljalnik__cas-vrstica--rocno' + (nastavitve.timingMode === "custom" ? ' opomin-predaja-sestavljalnik__cas-vrstica--aktivna' : '') + '">' +
          '<button type="button" class="opomin-predaja-sestavljalnik__cas-gumb" data-lawyer-timing="custom" aria-pressed="' + (nastavitve.timingMode === "custom") + '">Določi čas</button>' +
          '<span class="opomin-predaja-sestavljalnik__cas-vnosa"><label class="opomin-predaja-sestavljalnik__cas-polje"><span class="izvedba-odvetnik-cas-vrednost" data-lawyer-handoff-date-display>' + K.esc(casPredajeDeli.datum.split("-").reverse().join(".")) + '</span><span class="izvedba-odvetnik-cas-ikona" aria-hidden="true">' + K.ikona("calendar") + '</span><input type="date" data-lawyer-handoff-date min="' + K.esc(danesZaVnos) + '" value="' + K.esc(casPredajeDeli.datum) + '" aria-label="Datum predaje odvetniku" /></label><label class="opomin-predaja-sestavljalnik__cas-polje"><span class="izvedba-odvetnik-cas-vrednost" data-lawyer-handoff-time-display>' + K.esc(casPredajeDeli.ura) + '</span><span class="izvedba-odvetnik-cas-ikona" aria-hidden="true">' + K.ikona("clock") + '</span><input type="time" data-lawyer-handoff-time value="' + K.esc(casPredajeDeli.ura) + '" aria-label="Ura predaje odvetniku" /></label></span>' +
        '</div>' +
      '</div>' +
    '</section>';

    var mreza = dokumenti.map(function (d) {
      return '<button type="button" class="opomin-predaja-sestavljalnik__ploscica' + (d.ready ? ' opomin-predaja-sestavljalnik__ploscica--ok' : ' opomin-predaja-sestavljalnik__ploscica--manjka') + '" data-lawyer-documents aria-label="' + K.esc(d.title + ": " + d.subtitle) + '">' +
        '<span class="opomin-predaja-sestavljalnik__ploscica-ikona" aria-hidden="true">' + lawyerDokumentIkona() + '</span>' +
        '<span class="opomin-predaja-sestavljalnik__ploscica-besedilo"><span class="opomin-predaja-sestavljalnik__ploscica-naslov">' + K.esc(d.title) + '</span><span class="opomin-predaja-sestavljalnik__ploscica-podnapis">' + K.esc(d.subtitle) + '</span></span>' +
        (d.ready ? '<span class="opomin-predaja-sestavljalnik__ploscica-status" aria-hidden="true">' + K.ikona("checkCircle") + '</span><span class="opomin-predaja-sestavljalnik__ploscica-chevron" aria-hidden="true">' + K.ikona("chevron") + '</span>' : '<span class="opomin-predaja-sestavljalnik__ploscica-plus" aria-hidden="true">+</span>') +
      '</button>';
    }).join("");
    var vsiDokumentiHtml = '<div class="izvedba-odvetnik-dokumenti" data-lawyer-documents-list' + (w.showDocuments ? '' : ' hidden') + '>' +
      dokumentiZaWizard(w).map(function (d) {
        return '<div class="izvedba-odvetnik-dokument"><span aria-hidden="true">' + K.ikona("document") + '</span><span><b>' + K.esc(d.name || d.title || d.type || "Dokument") + '</b><small>' + (d.ready ? 'Pripravljeno za predajo' : 'Manjka') + '</small></span>' + (d.ready ? K.ikona("checkCircle") : '') + '</div>';
      }).join("") + '</div>';
    var dokumentiHtml = '<section class="opomin-predaja-sestavljalnik__dokumenti" aria-label="Dokumenti">' +
      '<div class="opomin-predaja-sestavljalnik__dokumenti-glava"><span class="opomin-predaja-sestavljalnik__dokumenti-ikona" aria-hidden="true">' + lawyerDokumentIkona() + '</span>' +
        '<h3 class="opomin-predaja-sestavljalnik__dokumenti-naslov">Dokumenti</h3>' +
        '<span class="opomin-predaja-sestavljalnik__dokumenti-status">' + pripravljenih + ' od ' + dokumenti.length + ' pripravljeno</span></div>' +
      '<div class="opomin-predaja-sestavljalnik__napredek" role="progressbar" aria-valuenow="' + pripravljenih + '" aria-valuemin="0" aria-valuemax="' + dokumenti.length + '"><span class="opomin-predaja-sestavljalnik__napredek-crta" style="width:' + Math.round(pripravljenih / dokumenti.length * 100) + '%"></span></div>' +
      '<div class="opomin-predaja-sestavljalnik__mreza">' + mreza + '</div>' +
      '<button type="button" class="opomin-predaja-sestavljalnik__vse-gumb" data-lawyer-documents aria-expanded="' + String(Boolean(w.showDocuments)) + '"><span class="opomin-predaja-sestavljalnik__vse-ikona" aria-hidden="true">' + lawyerDokumentPregledIkona() + '</span><span class="opomin-predaja-sestavljalnik__vse-besedilo">Preglej vse dokumente</span><span class="opomin-predaja-sestavljalnik__vse-stevilka">' + steviloVsehDokumentovZaWizard(w) + ' dokumentov</span><span class="opomin-predaja-sestavljalnik__vse-chevron" aria-hidden="true">' + K.ikona("chevron") + '</span></button>' + vsiDokumentiHtml +
    '</section>';

    var zgodovinaHtml = zgodovinaPredNacrtom.length ? '<section class="izvedba-odvetnik-zgodovina-pred-nacrtom" aria-label="Kaj se je že zgodilo pri računu">' +
      '<div class="izvedba-odvetnik-zgodovina-pred-nacrtom__glava"><span class="izvedba-odvetnik-zgodovina-pred-nacrtom__ikona" aria-hidden="true">' + K.ikona("clock") + '</span><span><h3>Kaj se je že zgodilo?</h3><p>Dodano iz 2. koraka Zgodovina</p></span><b>' + zgodovinaPredNacrtom.length + '</b></div>' +
      '<div class="izvedba-odvetnik-zgodovina-pred-nacrtom__mreza">' + zgodovinaPredNacrtom.map(function (korak) {
        return '<div class="izvedba-odvetnik-zgodovina-pred-nacrtom__kartica izvedba-odvetnik-zgodovina-pred-nacrtom__kartica--' + K.esc(razredDogodkaZaOdvetnika(korak)) + '"><span aria-hidden="true">' + K.ikona(korak.ikona || "pencil") + '</span><strong>' + K.esc(korak.naslov || opisDogodkaZaOdvetnika(korak)) + '</strong></div>';
      }).join("") + '</div>' +
      '<p class="izvedba-odvetnik-zgodovina-pred-nacrtom__opomba">Ti podatki so samodejno vključeni v kratko sporočilo odvetniku.</p>' +
    '</section>' : '';

    var sporocilo = '<section class="opomin-predaja-sestavljalnik__sporocilo" aria-label="Sporočilo odvetniku">' +
      '<div class="opomin-predaja-sestavljalnik__sporocilo-glava"><span class="opomin-predaja-sestavljalnik__sporocilo-ikona" aria-hidden="true">' + lawyerSporociloIkona() + '</span>' +
        '<span class="opomin-predaja-sestavljalnik__sporocilo-naslovi"><h3 class="opomin-predaja-sestavljalnik__sporocilo-naslov">Sporočilo odvetniku</h3>' +
        '<p class="opomin-predaja-sestavljalnik__sporocilo-podnaslov">Sporočilo lahko še dopolnite.</p></span></div>' +
      '<label class="opomin-predaja-sestavljalnik__sr-only" for="izvedba-odvetnik-sporocilo">Sporočilo odvetniku</label>' +
      '<div class="opomin-predaja-sestavljalnik__sporocilo-polje-ovoj"><textarea class="opomin-predaja-sestavljalnik__sporocilo-textarea" id="izvedba-odvetnik-sporocilo" data-lawyer-message maxlength="2000" rows="4">' + K.esc(w.message) + '</textarea><span class="opomin-predaja-sestavljalnik__sporocilo-svincnik" aria-hidden="true">' + lawyerSvincnikIkona() + '</span></div>' +
    '</section>';

    return '<div class="opomin-predaja-sestavljalnik izvedba-odvetnik-priprava" id="izvedba-odvetnik-priprava">' + pill + dnevi + dokumentiHtml + zgodovinaHtml + '<hr class="opomin-predaja-sestavljalnik__locilo" />' + sporocilo + '</div>';
  }

  function izrisiOdvetnikPregled() {
    var w = state.lawyerWizard;
    var z = state.zadeva || {};
    var pripravljeno = w.preparedFromPlan && w.preparedData;
    var snapshot = pripravljeno ? (w.preparedData.snapshot || {}) : {};
    var dolznik = snapshot.dolznik || {};
    var paket = paketZaWizard(w);
    var odvetnik = odvetnikZaWizard(w);
    var imeDolznika = dolznik.ime || z.imeDolznika || "—";
    var dolg = typeof dolznik.znesekCentov === "number" ? dolznik.znesekCentov / 100 : z.preostaliDolg;
    var zapadlost = dolznik.datumZapadlosti || z.datumZapadlosti;
    var casPredaje = casLawyerPredaje(state.settingsByAction.handoff_to_lawyer, w.availableHandoffDays);
    var datumPredaje = lawyerDatumDeli(casPredaje);
    var reviewDraft = w.reviewMessageDraft == null ? String(w.message || "") : String(w.reviewMessageDraft);
    w.reviewMessageDraft = reviewDraft;

    function pregledDatum(iso) {
      if (!iso || Number.isNaN(new Date(iso).getTime())) return { datum: "Termin še ni določen", danCas: "" };
      var d = new Date(iso);
      var dnevi = ["Nedelja", "Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota"];
      var pad = function (n) { return String(n).padStart(2, "0"); };
      return { datum: pad(d.getDate()) + ". " + pad(d.getMonth() + 1) + ". " + d.getFullYear(), danCas: dnevi[d.getDay()] + " · " + pad(d.getHours()) + ":" + pad(d.getMinutes()) };
    }
    function opisNeuspesnegaKoraka(korak) {
      if (String(korak.stepId) === String(state.currentStepId)) return "Dolžnik je označen, da ne bo plačal.";
      if (korak.executionState === "sent") return "Opomin je bil poslan, dolg pa ni bil poravnan.";
      if (korak.executionState === "failed") return "Pošiljanje opomina ni uspelo.";
      return "Korak je bil zaključen brez poravnave dolga.";
    }
    function oznakaStanjaZgodovine(korak) {
      if (String(korak.stepId) === String(state.currentStepId)) return "Ne bo plačal";
      if (korak.executionState === "sent") return "Poslano · brez plačila";
      if (korak.executionState === "failed") return "Pošiljanje ni uspelo";
      return "Brez plačila";
    }

    var primerKartica = '<section class="opomin-predaja-pregled__kartica opomin-predaja-pregled__kartica--primer">' +
      '<div class="opomin-predaja-pregled__primer-glava"><span class="opomin-predaja-pregled__primer-ikona" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 20 5v6c0 5.2-3.4 9.2-8 11-4.6-1.8-8-5.8-8-11V5l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg></span>' +
        '<h3 class="opomin-predaja-pregled__primer-naslov">Primer je pripravljen za pregled</h3>' +
        '<span class="opomin-predaja-pregled__primer-znacka">Pred potrditvijo</span></div>' +
      '<div class="opomin-predaja-pregled__primer-stolpci">' +
        '<div class="opomin-predaja-pregled__primer-stolpec"><span class="opomin-predaja-pregled__primer-label">Dolžnik</span><span class="opomin-predaja-pregled__primer-vrednost">' + K.esc(imeDolznika) + '</span></div>' +
        '<div class="opomin-predaja-pregled__primer-stolpec"><span class="opomin-predaja-pregled__primer-label">Dolg</span><span class="opomin-predaja-pregled__primer-vrednost">' + K.esc(K.formatirajEur(dolg)) + '</span></div>' +
        (zapadlost ? '<div class="opomin-predaja-pregled__primer-stolpec"><span class="opomin-predaja-pregled__primer-label">Zapadlost</span><span class="opomin-predaja-pregled__primer-vrednost">' + K.esc(datumSamoZaPrikaz(zapadlost)) + '</span></div>' : '') +
      '</div><button type="button" class="opomin-predaja-pregled__razsiri" data-lawyer-case-toggle aria-expanded="false"><span class="opomin-predaja-pregled__razsiri-ikona" aria-hidden="true">' + K.ikona("document") + '</span><span class="opomin-predaja-pregled__razsiri-tekst">Vsi podatki o primeru</span><span class="opomin-predaja-pregled__razsiri-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></button>' +
      '<div class="opomin-predaja-pregled__razsirjeno" data-lawyer-case-details hidden><div><span>Številka računa</span><strong>' + K.esc(dolznik.stevilkaRacuna || z.stevilkaRacuna || "—") + '</strong></div><div><span>E-pošta</span><strong>' + K.esc(dolznik.email || z.emailDolznika || "—") + '</strong></div></div>' +
    '</section>';

    var vsiKorakiZgodovine = vkljuceniKorakiZaSwipe();
    var trenutniIndeksZgodovine = vsiKorakiZgodovine.findIndex(function (korak) { return String(korak.stepId) === String(state.currentStepId); });
    var neuspesniKoraki = vsiKorakiZgodovine.filter(function (korak, indeks) {
      if (trenutniIndeksZgodovine >= 0 && indeks > trenutniIndeksZgodovine) return false;
      return korak.executionState === "sent" || korak.executionState === "failed" || korak.executionState === "cancelled" || korak.executionState === "skipped" || String(korak.stepId) === String(state.currentStepId);
    });
    if (!neuspesniKoraki.length && vsiKorakiZgodovine.length) neuspesniKoraki = [vsiKorakiZgodovine[0]];
    var zgodovinaKartice = neuspesniKoraki.map(function (korak, indeks) {
      var odprt = String(w.expandedHistoryStepId || "") === String(korak.stepId);
      var cas = pregledDatum(korak.scheduledAt);
      var vrstice = korakiPoStepId(korak.stepId);
      var kanali = vrstice.map(function (vrstica) { return String(vrstica.kanal || "").toUpperCase(); }).filter(Boolean);
      var kanaliBesedilo = kanali.length ? kanali.filter(function (kanal, i) { return kanali.indexOf(kanal) === i; }).join(" in ") : "Način pošiljanja ni zabeležen";
      return '<article class="izvedba-odvetnik-zgodovina__kartica opomin-predaja-pregled__prihodnji-sklop opomin-nacrt__stage--eskalacija-' + Math.max(1, Math.min(9, Number(korak.stepIndex || indeks + 1))) + '">' +
        '<span class="opomin-predaja-pregled__prihodnji-stolpec" aria-hidden="true"><span class="opomin-predaja-pregled__prihodnji-stevilka">' + (indeks + 1) + '</span></span><div class="izvedba-odvetnik-zgodovina__vsebnik">' +
        '<button type="button" class="izvedba-odvetnik-zgodovina__povzetek opomin-predaja-pregled__prihodnji-kartica" data-lawyer-history-toggle="' + K.esc(korak.stepId) + '" aria-expanded="' + String(odprt) + '">' +
          '<span class="izvedba-odvetnik-zgodovina__ikona opomin-predaja-pregled__prihodnji-ikona" aria-hidden="true">' + K.ikona("message") + '</span><span class="izvedba-odvetnik-zgodovina__besedilo opomin-predaja-pregled__prihodnji-vsebina"><strong class="opomin-predaja-pregled__prihodnji-naslov-koraka" data-izvedba-fit data-fit-min="12">' + K.esc(korak.naslov) + '</strong><span class="opomin-predaja-pregled__prihodnji-kanali">' + K.esc(oznakaStanjaZgodovine(korak)) + '</span><span class="opomin-predaja-pregled__prihodnji-opis">Več podrobnosti</span></span>' +
          '<span class="izvedba-odvetnik-zgodovina__datum opomin-predaja-pregled__prihodnji-desno"><time><strong class="opomin-predaja-pregled__prihodnji-datum" data-izvedba-fit data-fit-min="9">' + K.esc(cas.datum) + '</strong><span class="opomin-predaja-pregled__prihodnji-dan-cas">' + K.esc(cas.danCas) + '</span></time><span class="opomin-predaja-pregled__prihodnji-preglej">Podrobno <span class="izvedba-odvetnik-zgodovina__chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span></span></span></button>' +
        '<div class="izvedba-odvetnik-zgodovina__podrobnosti" data-lawyer-history-details="' + K.esc(korak.stepId) + '"' + (odprt ? '' : ' hidden') + '><p>' + K.esc(opisNeuspesnegaKoraka(korak)) + '</p><dl><div><dt>Kanali</dt><dd>' + K.esc(kanaliBesedilo) + '</dd></div><div><dt>Stanje</dt><dd>' + K.esc(oznakaStanjaZgodovine(korak)) + '</dd></div></dl></div></div></article>';
    }).join("");
    var zgodovina = '<section class="izvedba-odvetnik-zgodovina opomin-predaja-pregled__prihodnji" aria-label="Kaj se je zgodilo"><h3 class="opomin-predaja-pregled__prihodnji-naslov">Kaj se je zgodilo?</h3><p class="izvedba-odvetnik-zgodovina__uvod opomin-predaja-pregled__prihodnji-podnaslov">Kratek pregled neuspešnih korakov pred predajo odvetniku.</p><div class="izvedba-odvetnik-zgodovina__seznam opomin-predaja-pregled__prihodnji-hrbtenica">' + zgodovinaKartice + '</div></section>';

    var odvetnikPaketKartica = '<section class="opomin-predaja-pregled__kartica opomin-predaja-pregled__kartica--paket">' +
      '<div class="opomin-predaja-pregled__odvetnik-glava"><span class="opomin-predaja-pregled__odvetnik-ikona" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7"/></svg></span>' +
        '<div class="opomin-predaja-pregled__odvetnik-besedilo"><span class="opomin-predaja-pregled__odvetnik-naslov">Odvetniku bo pripravljen paket</span>' +
        '<span class="opomin-predaja-pregled__odvetnik-ime">' + K.esc(odvetnik.officeName) + '</span>' +
        '<span class="opomin-predaja-pregled__odvetnik-email">' + K.esc(odvetnik.email) + '</span></div>' +
        '<button type="button" class="opomin-predaja-pregled__podrobno-gumb" data-lawyer-details>Podrobno</button></div>' +
      '<hr class="opomin-predaja-pregled__paket-locnica" />' +
      '<div class="opomin-predaja-pregled__paket-vrstica"><div class="opomin-predaja-pregled__paket-zgoraj">' +
        '<span class="opomin-predaja-pregled__paket-ikona" aria-hidden="true">' + K.ikona(paket.ikona) + '</span>' +
        '<span class="opomin-predaja-pregled__paket-besedilo"><span class="opomin-predaja-pregled__paket-oznaka">Izbrani paket <span class="opomin-predaja-pregled__paket-oznaka-znacka">Izbrano ✓</span></span>' +
        '<span class="opomin-predaja-pregled__paket-naslov">' + K.esc(paket.naslov) + '</span></span>' +
        '<span class="opomin-predaja-pregled__paket-cena">' + K.esc(cenaPaketaKratka(paket)) + '</span>' +
      '</div><div class="opomin-predaja-pregled__paket-akcije"><button type="button" class="opomin-predaja-pregled__paket-preglej" data-lawyer-package-preview="' + K.esc(paket.id) + '"><span aria-hidden="true">' + K.ikona("document") + '</span>Preglej paket</button></div></div>' +
      '<hr class="opomin-predaja-pregled__paket-locnica" />' +
      '<div class="opomin-predaja-pregled__sporocilo-glava"><span class="opomin-predaja-pregled__sporocilo-naslovi"><span class="opomin-predaja-pregled__sporocilo-naslov">Sporočilo odvetniku</span><span class="opomin-predaja-pregled__sporocilo-podnaslov">Sporočilo lahko še dopolnite.</span></span><span class="opomin-predaja-pregled__sporocilo-svincnik" aria-hidden="true">' + K.ikona("pencil") + '</span></div>' +
      '<textarea class="opomin-predaja-pregled__sporocilo-besedilo" data-lawyer-review-message rows="1" aria-label="Sporočilo odvetniku">' + K.esc(reviewDraft) + '</textarea>' +
      '<div class="opomin-predaja-pregled__sporocilo-akcije" data-lawyer-review-message-actions' + (w.reviewMessageEditing ? '' : ' hidden') + '><button type="button" class="opomin-predaja-pregled__sporocilo-vrni" data-lawyer-review-message-revert>Vrni v prejšnje stanje</button><button type="button" class="opomin-predaja-pregled__sporocilo-shrani" data-lawyer-review-message-save>Shrani</button></div>' +
    '</section>';

    var proces = '<section class="opomin-predaja-pregled__proces opomin-nacrt__stage--predaja" aria-label="Kaj se bo zgodilo po potrditvi">' +
      '<h3 class="opomin-predaja-pregled__proces-naslov">Kaj se bo zgodilo po potrditvi?</h3>' +
      '<div class="opomin-predaja-pregled__proces-vrstica">' +
        '<div class="opomin-predaja-pregled__proces-korak"><span class="opomin-predaja-pregled__proces-st" aria-hidden="true">1</span><span class="opomin-predaja-pregled__proces-ikona-krog" aria-hidden="true">' + K.ikona("document") + '</span><span class="opomin-predaja-pregled__proces-naziv">Paket predate odvetniku</span><span class="opomin-predaja-pregled__proces-podtekst">' + K.esc(datumPredaje.dan + ", " + datumPredaje.datum.split("-").reverse().join(". ") + " ob " + datumPredaje.ura) + '</span></div>' +
        '<span class="opomin-predaja-pregled__proces-puscica" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span>' +
        '<div class="opomin-predaja-pregled__proces-korak"><span class="opomin-predaja-pregled__proces-st" aria-hidden="true">2</span><span class="opomin-predaja-pregled__proces-ikona-krog" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7"/></svg></span><span class="opomin-predaja-pregled__proces-naziv">Odvetnik pregleda in pošlje opomin</span><span class="opomin-predaja-pregled__proces-podtekst">Običajno v 1–3 delovnih dneh</span></div>' +
        '<span class="opomin-predaja-pregled__proces-puscica" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></span>' +
        '<div class="opomin-predaja-pregled__proces-korak"><span class="opomin-predaja-pregled__proces-st" aria-hidden="true">3</span><span class="opomin-predaja-pregled__proces-ikona-krog" aria-hidden="true">' + K.ikona("mail") + '</span><span class="opomin-predaja-pregled__proces-naziv">Odvetnik vas obvesti</span><span class="opomin-predaja-pregled__proces-podtekst">Po e-pošti ali telefonu</span></div>' +
      '</div>' +
    '</section>';

    var varnost = '<div class="opomin-predaja-pregled__varnost"><span class="opomin-predaja-pregled__varnost-ikona" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>' +
      '<span class="opomin-predaja-pregled__varnost-besedilo"><strong>Potrditev ne pošlje ničesar odvetniku.</strong><span>Aplikacija pripravi in shrani paket za vašo ročno predajo.</span></span></div>';

    var checkbox = '<div class="opomin-predaja-pregled__checkbox-vrstica"><label class="opomin-predaja-pregled__checkbox-label">' +
      '<input type="checkbox" data-lawyer-razumem ' + (w.razumem ? "checked" : "") + ' />' +
      '<span>Razumem, da moram paket odvetniku predati sam.</span></label>' +
      '<button type="button" class="opomin-predaja-pregled__povezava" data-lawyer-manual-info aria-expanded="' + String(Boolean(w.showManualInfo)) + '">Kaj pomeni ročna predaja?</button>' +
      '<p class="izvedba-odvetnik-rocna-razlaga" data-lawyer-manual-info-text' + (w.showManualInfo ? '' : ' hidden') + '>Po potrditvi aplikacija pripravi paket. Nato ga sami pošljete izbranemu odvetniku po dogovorjenem kanalu.</p></div>';

    var cenaBesedilo = cenaPaketaKratka(paket);
    var cenaSkupaj = paket.cena > 0 ? paket.cena.toFixed(2).replace(".", ",") + " € enkratno" : "Vključeno";
    var cenaKartica = '<section class="opomin-predaja-pregled__cena" aria-label="Končna cena">' +
      '<div class="opomin-predaja-pregled__cena-glava"><h3 class="opomin-predaja-pregled__cena-naslov">Končna cena</h3><span class="opomin-predaja-pregled__cena-pomoc">Plačate samo izbrane pakete.</span></div>' +
      '<div class="opomin-predaja-pregled__cena-postavka"><span>' + K.esc(paket.naslov) + '</span><span>' + K.esc(cenaBesedilo) + '</span></div>' +
      '<div class="opomin-predaja-pregled__cena-skupaj"><span>Skupaj</span><strong>' + K.esc(cenaSkupaj) + '</strong></div></section>';

    return '<div class="opomin-predaja-pregled izvedba-odvetnik-pregled">' + primerKartica + zgodovina + odvetnikPaketKartica + proces + varnost + checkbox + cenaKartica + '</div>';
  }

  function izrisiOdvetnikKorake(screen) {
    var aktivniKorak = screen === "pregled" ? 4 : screen === "podrobnosti" ? 3 : screen === "paket" || screen === "paket-pregled" ? 2 : 1;
    var koraki = [
      { st: 1, naslov: "Zgodovina", screen: "zgodovina" },
      { st: 2, naslov: "Paket", screen: "paket" },
      { st: 3, naslov: "Predaja", screen: "podrobnosti" },
      { st: 4, naslov: "Pregled", screen: "pregled" },
    ];
    return '<nav class="izvedba-odvetnik-koraki" aria-label="Koraki predaje odvetniku">' + koraki.map(function (korak) {
      var aktiven = korak.st === aktivniKorak;
      var opravljen = korak.st < aktivniKorak;
      var dosegljiv = korak.st <= aktivniKorak;
      return '<button type="button" class="izvedba-odvetnik-korak' + (aktiven ? ' is-active' : '') + (opravljen ? ' is-complete' : '') + '" data-lawyer-go-screen="' + korak.screen + '"' + (dosegljiv ? '' : ' disabled') + ' aria-current="' + (aktiven ? 'step' : 'false') + '"><span class="izvedba-odvetnik-korak__stevilka">' + korak.st + '</span><span class="izvedba-odvetnik-korak__naslov">' + korak.naslov + '</span></button>';
    }).join('<span class="izvedba-odvetnik-koraki__crta" aria-hidden="true"></span>') + '</nav>';
  }

  function izrisiOdvetnikSheet() {
    var w = state.lawyerWizard;
    if (!w) { w = state.lawyerWizard = { screen: "zgodovina", packageId: "legal_proceeding", lawyerId: "joze_kovac", timingMode: "asap", scheduledHandoffAt: null, message: "", razumem: false, historyEvents: [] }; vstopiVOdvetnikZgodovino(); }
    if (!w.message && !w.messageEditedManually) w.message = privzetoSporociloOdvetniku(najdiLawyerPaket(w.packageId));

    var naslovi = { zgodovina: "Zgodovina računa", paket: "Predaja odvetniku", "paket-pregled": "Pregled paketa", podrobnosti: "Podatki predaje", pregled: "Odvetniku bo pripravljen paket" };
    var vsebina = w.screen === "pregled" ? izrisiOdvetnikPregled()
      : w.screen === "paket-pregled" ? izrisiOdvetnikPaketPregled()
      : w.screen === "podrobnosti" ? izrisiOdvetnikPodrobnosti() + '<p class="izvedba-odvetnik-potrditveni-namig">Potrditev koraka še ne pošlje sporočila.</p>'
      : w.screen === "zgodovina" ? izrisiOdvetnikZgodovino()
      : izrisiOdvetnikPaket();

    var jeZadnji = w.screen === "pregled";
    var nastavitveCas = state.settingsByAction.handoff_to_lawyer;
    var jeVeljavenCustomDatum = nastavitveCas.timingMode !== "custom" ||
      (nastavitveCas.scheduledHandoffAt && new Date(nastavitveCas.scheduledHandoffAt).getTime() > Date.now());
    var lahkoNaprej = w.screen === "zgodovina"
      ? (typeof window.UJZgodovinaVgrajeniVnosJePripravljen !== "function" || window.UJZgodovinaVgrajeniVnosJePripravljen())
      : w.screen === "paket-pregled" ? true
      : w.screen === "paket" ? Boolean(w.packageId)
      : w.screen === "podrobnosti" ? Boolean(dokumentiZaWizard(w).some(function (d) { return d.ready; }) && String(w.message || "").trim() && jeVeljavenCustomDatum)
      : w.razumem;
    var jePaketPregled = w.screen === "paket-pregled";
    var brezZgodovine = w.screen === "zgodovina" && !(state.nacrtKoraki || []).length;
    var dejanje = '<button type="button" class="izvedba-action-sheet__dejanje' + (brezZgodovine ? ' atena__nadaljuj-brez' : '') + '" ' + (jeZadnji ? 'data-lawyer-submit' : jePaketPregled ? 'data-lawyer-back' : 'data-lawyer-next') + ' data-izvedba-fit data-fit-min="10" ' + (state.isSubmitting || !lahkoNaprej ? 'disabled' : '') + '>' +
      (state.isSubmitting ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span>' : '') + (jeZadnji ? 'Potrdi oddajo →' : jePaketPregled ? 'Nazaj na izbiro' : w.screen === "zgodovina" ? 'Nadaljuj na izbiro paketa →' : w.screen === "paket" ? 'Nadaljuj na podatke predaje →' : 'Preveri in potrdi podatke →') + '</button>';
    if (jeZadnji) {
      dejanje = '<div class="opomin-predaja-pregled__akcije-vrstica"><button type="button" class="opomin-predaja-pregled__nazaj-gumb" data-lawyer-back>← Nazaj na 2. korak</button><button type="button" class="opomin-predaja-pregled__izbrisi-gumb" data-lawyer-delete-details>Izbriši 2. korak</button></div>' +
        '<div class="opomin-predaja-pregled__akcije"><button type="button" class="opomin-predaja-pregled__glavni-gumb" data-lawyer-submit ' + (state.isSubmitting || !lahkoNaprej || w.reviewMessageEditing ? 'disabled' : '') + '>' + (state.isSubmitting ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span>' : '') + 'Potrdi oddajo →</button></div>' +
        '<div class="opomin-predaja-pregled__noga"><button type="button" class="opomin-predaja-pregled__osnutek-gumb" data-lawyer-save-draft>Shrani kot osnutek</button></div>';
    }
    if (w.screen === "podrobnosti") {
      dejanje = '<div class="izvedba-odvetnik-podrobnosti-akcije"><button type="button" class="izvedba-odvetnik-podrobnosti-izbrisi" data-lawyer-delete-details>Izbriši</button>' + dejanje + '</div>';
    }
    var nazajGumb = w.screen !== "zgodovina"
      ? '<button type="button" class="izvedba-action-sheet__nazaj-puscica" data-lawyer-back aria-label="Nazaj"><span class="izvedba-action-sheet__nazaj-ikona" aria-hidden="true">' + K.ikona("chevron") + '</span></button>'
      : '<span class="izvedba-action-sheet__header-ikona" aria-hidden="true">' + K.ikona("scales") + '</span>';

    elActionSheet.hidden = false;
    elActionSheet.innerHTML = '<div class="izvedba-action-sheet__backdrop" data-action-sheet-close></div>' +
      '<section class="izvedba-action-sheet__panel izvedba-action-sheet__panel--odvetnik' + (w.screen === "paket" ? ' izvedba-action-sheet__panel--odvetnik-paket' : '') + (w.screen === "zgodovina" ? ' izvedba-action-sheet__panel--odvetnik-zgodovina' : '') + (jeZadnji ? ' izvedba-action-sheet__panel--odvetnik-pregled' : '') + '" role="dialog" aria-modal="true" aria-labelledby="izvedba-action-sheet-title">' +
        '<div class="izvedba-action-sheet__rocaj" aria-hidden="true"></div>' +
        '<header class="izvedba-action-sheet__header">' + nazajGumb + '<div>' +
          '<h2 id="izvedba-action-sheet-title" data-izvedba-fit data-fit-min="14">' + K.esc(naslovi[w.screen]) + '</h2></div>' +
          '<button type="button" class="izvedba-action-sheet__zapri" data-action-sheet-close aria-label="Zapri"><span aria-hidden="true">×</span></button></header>' +
        '<div class="izvedba-action-sheet__scroll">' + (w.screen === "paket-pregled" ? '' : izrisiOdvetnikKorake(w.screen)) + vsebina +
          '<div class="izvedba-action-sheet__footer' + (jeZadnji ? ' izvedba-action-sheet__footer--odvetnik-pregled' : '') + '">' + (state.error ? '<p class="izvedba-action-sheet__napaka" role="alert">' + K.esc(state.error) + '</p>' : '') +
            dejanje + '</div></div></section>';
    zakleniOzadjeSheeta();
    if (w.screen === "zgodovina" && typeof window.UJZgodovinaPoIzrisu === "function") {
      window.UJZgodovinaPoIzrisu(state, elActionSheet);
    }
    requestAnimationFrame(function () {
      if (w.screen === "zgodovina") {
        var zgodovinaSvicer = elActionSheet.querySelector(".izvedba-odvetnik-zgodovina__dogodki .izvedba-poravnava-svicer");
        if (zgodovinaSvicer) {
          var osveziZgodovinaPikice = function () {
            var pikice = elActionSheet.querySelectorAll(".izvedba-odvetnik-zgodovina__dogodki .zgodovina-svicer__pikica");
            var najvecjiPomik = Math.max(0, zgodovinaSvicer.scrollWidth - zgodovinaSvicer.clientWidth);
            var aktivna = najvecjiPomik > 0 && zgodovinaSvicer.scrollLeft / najvecjiPomik >= 0.5 ? 1 : 0;
            pikice.forEach(function (pikica, indeks) { pikica.classList.toggle("is-active", indeks === aktivna); });
          };
          osveziZgodovinaPikice();
          zgodovinaSvicer.addEventListener("scroll", osveziZgodovinaPikice, { passive: true });
        }
      }
      prilagodiBesediloOmejenemuPolju(elActionSheet);
      var sporociloPolje = elActionSheet.querySelector("[data-lawyer-message]");
      if (sporociloPolje) {
        sporociloPolje.style.height = "auto";
        sporociloPolje.style.height = Math.max(176, sporociloPolje.scrollHeight + 2) + "px";
      }
      var reviewSporocilo = elActionSheet.querySelector("[data-lawyer-review-message]");
      if (reviewSporocilo) {
        reviewSporocilo.style.height = "auto";
        reviewSporocilo.style.height = Math.max(150, reviewSporocilo.scrollHeight + 2) + "px";
      }
    });
  }

  function izrisiOdvetnikSheetZOhranjenimPomikom() {
    var prejsnji = elActionSheet && elActionSheet.querySelector(".izvedba-action-sheet__scroll");
    var pomik = prejsnji ? prejsnji.scrollTop : 0;
    izrisiActionSheet();
    requestAnimationFrame(function () {
      var trenutni = elActionSheet && elActionSheet.querySelector(".izvedba-action-sheet__scroll");
      if (trenutni) trenutni.scrollTop = pomik;
      requestAnimationFrame(function () {
        var poFokusu = elActionSheet && elActionSheet.querySelector(".izvedba-action-sheet__scroll");
        if (poFokusu) poFokusu.scrollTop = pomik;
      });
    });
  }

  function pomakniDoOdvetnikPriprave() {
    var priprava = elActionSheet && elActionSheet.querySelector("#izvedba-odvetnik-priprava");
    if (!priprava) return;
    priprava.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function submitLawyerWizard() {
    if (zavrniSprememboCeSamoZaBranje()) return;
    if (state.isSubmitting) return;
    var w = state.lawyerWizard;
    var paket = paketZaWizard(w);
    var odvetnik = odvetnikZaWizard(w);
    var dokumenti = dokumentiZaWizard(w).filter(function (d) { return d.ready; });
    var nastavitveCas = state.settingsByAction.handoff_to_lawyer;
    var settings = {
      timingMode: nastavitveCas.timingMode,
      scheduledHandoffAt: nastavitveCas.scheduledHandoffAt,
    };
    // Pri že pripravljeni predaji namenoma ne pošiljamo zmanjšane kopije.
    // Jedro tako uporabi nespremenjen, celoten lawyerHandoff iz načrta.
    if (!w.preservePlanHandoff) {
      settings.lawyerHandoff = {
        lawyerId: odvetnik.id,
        lawyerSnapshot: { name: odvetnik.name, officeName: odvetnik.officeName, email: odvetnik.email, phone: odvetnik.phone },
        selectedPackage: { packageId: paket.id, title: paket.naslov, priceCents: Math.round(paket.cena * 100) },
        documents: dokumenti,
        message: w.message,
        availableHandoffDays: w.availableHandoffDays,
        historyBeforePlan: kopirajPodatke(w.historyEvents || zgodovinaPredNacrtomZaOdvetnika()),
        riskAssessment: { latePayments: w.historyLatePayments },
      };
    }

    state.isSubmitting = true;
    state.error = null;
    render();

    var actionId = state.pendingActionId && state.pendingActionType === "handoff_to_lawyer"
      ? state.pendingActionId
      : (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + Math.random());
    state.pendingActionId = actionId;
    state.pendingActionType = "handoff_to_lawyer";

    try {
      var odgovor = await Api.executeAction({
        zadevaId: state.zadevaId,
        stepId: state.currentStepId,
        version: state.serverVersion,
        actionId: actionId,
        actionType: "handoff_to_lawyer",
        settings: settings,
      });
      if (!odgovor || odgovor.ok !== true) {
        obravnavajNapakoUkrepa(odgovor);
      } else {
        uporabiOdgovor({ zadeva: odgovor.zadeva, plan: odgovor.plan, steps: odgovor.steps, version: odgovor.version, currentStepId: state.currentStepId });
        state.selectedActionType = null;
        state.actionSheetMode = "actions";
        state.actionSheetOpen = false;
        state.lawyerWizard = null;
        state.lawyerWizardDraft = null;
        odkleniOzadjeSheeta();
        state.pendingActionId = null;
        state.pendingActionType = null;
      }
    } catch (err) {
      if (err && err.podatki) obravnavajNapakoUkrepa(err.podatki);
      else state.error = err.message || "Predaje odvetniku trenutno ni bilo mogoče pripraviti.";
    } finally {
      state.isSubmitting = false;
      render();
    }
  }

  function izrisiBoPlacalHitraDejanja() {
    var onemogoceno = state.isSubmitting ? " disabled" : "";
    function hitra(tip, razred, ikona, oznaka) {
      var izbrana = !state.customActionActive && state.selectedSettlementType === tip;
      return '<button type="button" class="izvedba-hitra-akcija atena-gostitelj__hitra atena-gostitelj__hitra--' + razred + (izbrana ? ' is-selected' : '') + '" data-settlement-select="' + tip + '" aria-pressed="' + String(izbrana) + '"' + onemogoceno + '>' +
        '<span class="izvedba-hitra-akcija__ikona" aria-hidden="true">' + K.ikona(ikona) + '</span>' +
        '<span class="izvedba-hitra-akcija__besedilo" data-izvedba-fit data-fit-min="8">' + oznaka + '</span></button>';
    }
    return '<div class="izvedba-hitre-akcije atena-gostitelj__hitre" aria-label="Najpogostejša dejanja">' +
      hitra("full", "placano", "receiptCheck", "Plačal bo v celoti") +
      hitra("partial", "delno", "coinCheck", "Plačal bo delno") +
      hitra("payment_promised", "obljuba", "handshake", "Plačal bo do novega roka") +
      '</div>';
  }

  function izrisiBoPlacalGostiteljPovzetek() {
    return '<section class="bo-placal-gostitelj__povzetek" aria-labelledby="bo-placal-gostitelj-povzetek-naslov">' +
      '<div class="bo-placal-gostitelj__glava"><span class="bo-placal-gostitelj__ikona" aria-hidden="true">' + K.ikona("handshake") + '</span><div>' +
        '<h2 id="bo-placal-gostitelj-povzetek-naslov" data-izvedba-fit data-fit-min="14">Na kakšen dogovor je pristal?</h2>' +
        '<p>Izberite dogovor z dolžnikom.</p>' +
      '</div></div>' + izrisiStanjeDolgaBlok() +
    '</section>';
  }

  function jePreklicOpominaFilter() {
    return (state.aktivniFilterKartic || []).join("|") === "skip_current_step|stop_plan|postpone_reminder";
  }

  function actionGostiteljKartice() {
    var kljuc = (state.aktivniFilterKartic || []).join("|");
    if (kljuc === "handoff_to_lawyer|partial_payment|cancelled_invoice") return state.aktivniFilterKartic;
    if (jePreklicOpominaFilter()) return state.aktivniFilterKartic;
    return null;
  }

  function actionGostiteljGlava() {
    if (jePreklicOpominaFilter()) {
      return {
        ikona: "bellOff",
        naslov: "Prekliči opomin",
        opis: "Izberite, ali želite preklicati, ustaviti ali prestaviti trenutni opomin.",
        razred: "opomin",
      };
    }
    return {
      ikona: "xCircle",
      naslov: "Ne bo plačal",
      opis: "Izberite najprimernejši naslednji korak za ta račun.",
      razred: "ne-bo-placal",
    };
  }

  function izrisiActionGostiteljHitraDejanja(actionTypes) {
    var onemogoceno = state.isSubmitting ? " disabled" : "";
    return '<div class="izvedba-hitre-akcije hitra-dejanja-gostitelj__hitre" aria-label="Najpogostejša dejanja">' + actionTypes.map(function (actionType) {
      var meta = K.AKCIJE_META[actionType];
      var sheetMeta = ACTION_SHEET_META[actionType];
      var izbrana = state.selectedActionType === actionType;
      return '<button type="button" class="izvedba-hitra-akcija hitra-dejanja-gostitelj__hitra hitra-dejanja-gostitelj__hitra--' + K.esc(sheetMeta.razred) + (izbrana ? ' is-selected' : '') + '" data-action-sheet-select="' + K.esc(actionType) + '" aria-pressed="' + String(izbrana) + '"' + onemogoceno + '>' +
        '<span class="izvedba-hitra-akcija__ikona" aria-hidden="true">' + K.ikona(sheetMeta.ikona) + '</span>' +
        '<span class="izvedba-hitra-akcija__besedilo" data-izvedba-fit data-fit-min="8">' + K.esc(meta.naslov) + '</span></button>';
    }).join('') + '</div>';
  }

  function izrisiPoravnavaSheet() {
    var prejsnjiSvicer = elActionSheet.querySelector(".izvedba-poravnava-svicer");
    var prejsnjiSvicerScrollLeft = prejsnjiSvicer ? prejsnjiSvicer.scrollLeft : null;
    if (state.pregledDokumenta != null) {
      izrisiPoravnavaPolniRacun();
      return;
    }
    if (state.actionSheetStep === "povzetek") {
      izrisiPoravnavaPovzetek();
      return;
    }
    var meta = SETTLEMENT_META[state.selectedSettlementType] || (jePlacilniDogodkovniTip(state.selectedSettlementType) ? ZGODOVINA_META[state.selectedSettlementType] : null);
    var steviloNacrtovanih = (state.nacrtKoraki || []).length;
    var zgodovinaVnos = jeVnosZgodovine();
    var jeBoPlacalGostitelj = jePlacilniEngine() && !zgodovinaVnos;
    var jeBoPlacalNeposrednaHitra = jeBoPlacalGostitelj && jeBoPlacalNeposrednaHitraIzbira();
    var izbrisiVseZgodovino = zgodovinaVnos && steviloNacrtovanih > 0 ? '<button type="button" class="izvedba-action-sheet__izbrisi-vse" data-zgodovina-izbrisi-vse>Zbriši vse</button>' : '';
    var dejanje = (meta || jeBoPlacalNeposrednaHitra || zgodovinaVnos || (jePlacilniEngine() && steviloNacrtovanih > 0)) ? '<button type="button" class="izvedba-action-sheet__dejanje' + (zgodovinaVnos && steviloNacrtovanih === 0 ? ' atena__nadaljuj-brez' : '') + '" ' + (zgodovinaVnos ? 'data-zgodovina-nadaljuj' : 'data-action-sheet-confirm') + ' data-izvedba-fit data-fit-min="10" ' + (state.isSubmitting || (!zgodovinaVnos && steviloNacrtovanih === 0 && !jeBoPlacalNeposrednaHitra) ? 'disabled' : '') + '>' +
      (state.isSubmitting ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span>' : '') + (zgodovinaVnos ? (steviloNacrtovanih ? 'Shrani in nadaljuj' : 'Nadaljuj brez zgodovine →') : 'Potrdi') + '</button>' : '';
    elActionSheet.hidden = false;
    elActionSheet.innerHTML = '<div class="izvedba-action-sheet__backdrop" data-action-sheet-close></div>' +
      '<section class="izvedba-action-sheet__panel izvedba-action-sheet__panel--poravnano' + (jeBoPlacalGostitelj ? ' izvedba-action-sheet__panel--atena-gostitelj' : '') + (meta ? ' izvedba-action-sheet__panel--poravnava-' + K.esc(meta.razred) : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + (jeBoPlacalGostitelj ? 'bo-placal-gostitelj-povzetek-naslov' : 'izvedba-action-sheet-title') + '">' +
        (jeBoPlacalGostitelj ? '<div class="atena-gostitelj__pas"><div class="izvedba-action-sheet__rocaj" aria-hidden="true"></div><p class="atena-gostitelj__naslov">Hitra dejanja</p><button type="button" class="izvedba-action-sheet__zapri atena-gostitelj__zapri" data-action-sheet-close aria-label="Zapri"><span aria-hidden="true">×</span></button>' + izrisiBoPlacalHitraDejanja() + '</div><div class="atena__jedro atena__jedro--bo-placal' + (jeBoPlacalNeposrednaHitra ? ' atena__jedro--neposredna' : '') + '">' + izrisiBoPlacalGostiteljPovzetek() : '<div class="izvedba-action-sheet__rocaj" aria-hidden="true"></div>') +
        (jeBoPlacalNeposrednaHitra ? '' : '<header class="izvedba-action-sheet__header">' + (jeAtena() ? '' : '<span class="izvedba-action-sheet__header-ikona" aria-hidden="true">' + K.ikona("checkCircle") + '</span>') + '<div>' +
          (jeBoPlacalGostitelj ? '' : '<h2 id="izvedba-action-sheet-title" data-izvedba-fit data-fit-min="14">' + (jeAtena() ? 'Kaj se je do zdaj zgodilo?' : 'Kako je bil račun poravnan?') + '</h2>') + '<p>' + (jeAtena() ? 'Dodajte samo dogodke, ki so se že zgodili.' : 'Izberite način in po potrebi dopolnite podatke.') + '</p></div>' +
          (jeBoPlacalGostitelj ? '' : '<button type="button" class="izvedba-action-sheet__zapri" data-action-sheet-close aria-label="Zapri"><span aria-hidden="true">×</span></button>') + '</header>') +
        '<div class="izvedba-action-sheet__scroll">' + (zgodovinaVnos ? '' : izrisiStanjeDolgaBlok()) + (jeBoPlacalNeposrednaHitra ? '' : izrisiPoravnavaSvicer()) + izrisiPoravnavaPodrobnosti() + izrisiPotekPrimera() +
          '<div class="izvedba-action-sheet__footer' + (izbrisiVseZgodovino ? ' izvedba-action-sheet__footer--zgodovina-akcije' : '') + '">' + (state.error ? '<p class="izvedba-action-sheet__napaka" role="alert">' + K.esc(state.error) + '</p>' : '') +
            izbrisiVseZgodovino + dejanje + '</div></div>' + (jeBoPlacalGostitelj ? '</div>' : '') + '</section>';
    zakleniOzadjeSheeta();
    if ((zgodovinaVnos || jePlacilniEngine()) && typeof window.UJZgodovinaPoIzrisu === "function") {
      window.UJZgodovinaPoIzrisu(state, elActionSheet);
    }
    requestAnimationFrame(function () {
      var noviSvicer;
      if (prejsnjiSvicerScrollLeft != null) {
        noviSvicer = elActionSheet.querySelector(".izvedba-poravnava-svicer");
        if (noviSvicer) noviSvicer.scrollLeft = Math.min(prejsnjiSvicerScrollLeft, Math.max(0, noviSvicer.scrollWidth - noviSvicer.clientWidth));
      }
      if (zgodovinaVnos || jePlacilniEngine()) {
        noviSvicer = noviSvicer || elActionSheet.querySelector(".izvedba-poravnava-svicer");
        if (noviSvicer) {
          var osveziPikice = function () {
            var pikice = elActionSheet.querySelectorAll(".zgodovina-svicer__pikica");
            var najvecjiPomik = Math.max(0, noviSvicer.scrollWidth - noviSvicer.clientWidth);
            var aktivna = najvecjiPomik > 0 && noviSvicer.scrollLeft / najvecjiPomik >= 0.5 ? 1 : 0;
            pikice.forEach(function (pikica, indeks) { pikica.classList.toggle("is-active", indeks === aktivna); });
          };
          osveziPikice();
          noviSvicer.addEventListener("scroll", osveziPikice, { passive: true });
        }
      }
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
    if (jeSamoZaBranje()) {
      state.actionSheetOpen = false;
      elActionSheet.hidden = true;
      elActionSheet.innerHTML = "";
      odkleniOzadjeSheeta();
      return;
    }
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
    if (state.actionSheetMode === "lawyer") {
      izrisiOdvetnikSheet();
      return;
    }
    var gostiteljKartice = actionGostiteljKartice();
    var jeHitraDejanjaGostitelj = Boolean(gostiteljKartice);
    var gostiteljGlava = jeHitraDejanjaGostitelj ? actionGostiteljGlava() : null;
    var actionSvicer = jeHitraDejanjaGostitelj ? "" : izrisiActionSvicer();
    var panelRazred = state.selectedActionType ? " izvedba-action-sheet__panel--" + ACTION_SHEET_META[state.selectedActionType].razred : "";
    var dejanje = state.selectedActionType
      ? '<button type="button" class="izvedba-action-sheet__dejanje" data-action-sheet-confirm data-izvedba-fit data-fit-min="10" ' + (state.isSubmitting ? 'disabled' : '') + '>' +
          (state.isSubmitting ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span>' : '') + K.esc(besediloGlavnegaGumba()) + '</button>'
      : "";
    elActionSheet.hidden = false;
    elActionSheet.innerHTML = '<div class="izvedba-action-sheet__backdrop" data-action-sheet-close></div>' +
      '<section class="izvedba-action-sheet__panel izvedba-action-sheet__panel--akcije' + (jeHitraDejanjaGostitelj ? ' izvedba-action-sheet__panel--hitra-gostitelj' : '') + panelRazred + '" role="dialog" aria-modal="true" aria-labelledby="izvedba-action-sheet-title">' +
        (jeHitraDejanjaGostitelj ? '<div class="hitra-dejanja-gostitelj__pas"><div class="izvedba-action-sheet__rocaj" aria-hidden="true"></div><p class="hitra-dejanja-gostitelj__naslov">Hitra dejanja</p><button type="button" class="izvedba-action-sheet__zapri hitra-dejanja-gostitelj__zapri" data-action-sheet-close aria-label="Zapri"><span aria-hidden="true">×</span></button>' + izrisiActionGostiteljHitraDejanja(gostiteljKartice) + '</div><div class="hitra-dejanja-gostitelj__jedro">' : '<div class="izvedba-action-sheet__rocaj" aria-hidden="true"></div>') +
        '<header class="izvedba-action-sheet__header' + (gostiteljGlava ? ' izvedba-action-sheet__header--kontekst izvedba-action-sheet__header--' + K.esc(gostiteljGlava.razred) : '') + '"><span class="izvedba-action-sheet__header-ikona" aria-hidden="true">' + K.ikona(gostiteljGlava ? gostiteljGlava.ikona : "xCircle") + '</span><div>' +
          '<h2 id="izvedba-action-sheet-title">' + K.esc(gostiteljGlava ? gostiteljGlava.naslov : "Kaj želite narediti?") + '</h2><p>' + K.esc(gostiteljGlava ? gostiteljGlava.opis : "Izberite možnost in po potrebi prilagodite priporočeno nastavitev.") + '</p></div>' +
          (jeHitraDejanjaGostitelj ? '' : '<button type="button" class="izvedba-action-sheet__zapri" data-action-sheet-close aria-label="Zapri"><span aria-hidden="true">×</span></button>') + '</header>' +
        '<div class="izvedba-action-sheet__scroll">' + izrisiStanjeDolgaBlok() + actionSvicer + izrisiActionPodrobnosti() + izrisiPotekPrimera() +
          '<div class="izvedba-action-sheet__footer">' +
            (state.error ? '<p class="izvedba-action-sheet__napaka" role="alert">' + K.esc(state.error) + '</p>' : '') +
            dejanje + (jeHitraDejanjaGostitelj ? '' : '<button type="button" class="izvedba-action-sheet__nazaj" data-action-sheet-close>Nazaj</button>') +
          '</div>' +
        '</div>' + (jeHitraDejanjaGostitelj ? '</div>' : '') +
      '</section>';
    zakleniOzadjeSheeta();
    requestAnimationFrame(function () { prilagodiBesediloOmejenemuPolju(elActionSheet); });
  }

  function odpriActionSheet(filterKartic) {
    if (zavrniSprememboCeSamoZaBranje()) return;
    if (state.isSubmitting) return;
    actionSheetReturnFocus = document.activeElement;
    state.actionSheetMode = "actions";
    state.selectedActionType = null;
    state.customActionActive = false;
    state.customActionDescription = "";
    state.aktivniFilterKartic = filterKartic || null;
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
    if (state.actionSheetMode === "lawyer" && state.lawyerWizard && state.lawyerWizard.historyBufferActive) zapustiOdvetnikZgodovino(false);
    if (state.actionSheetMode === "payment") {
      if (typeof window.UJZgodovinaPonastaviVgrajeniVnos === "function") window.UJZgodovinaPonastaviVgrajeniVnos();
      ponastaviOsnutekPoravnave();
    }
    state.actionSheetOpen = false;
    state.selectedActionType = null;
    state.aktivniFilterKartic = null;
    state.selectedSettlementType = null;
    state.customActionActive = false;
    state.customActionDescription = "";
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
    var samoZaBranje = jeSamoZaBranje();
    if (trenutniStepZakljucen() && !samoZaBranje) {
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
        '<textarea class="zo-sporocilo__telo" data-sporocilo-id="' + K.esc(prva.id || "trenutni") + '"' + (samoZaBranje ? ' readonly aria-readonly="true"' : '') + ' rows="1">' + K.esc(sporocilo || "Sporočilo za ta korak še ni pripravljeno.") + "</textarea></div>" +
      (samoZaBranje
        ? '<div class="zo-potem"><span class="zo-potem__ikona" aria-hidden="true">' + K.ikona("checkCircle") + "</span><span>Primer je zaključen; podatki so na voljo samo za ogled.</span></div>"
        : '<div class="zo-potem"><span class="zo-potem__ikona" aria-hidden="true">' + K.ikona("checkCircle") + "</span><span>Če dolg ne bo poravnan, boste prejeli obvestilo za naslednji korak.</span></div>" +
          '<div class="zo-akcije"><div class="izvedba-posljizdaj-vrstica"><button type="button" class="zo-akcija-glavna" id="izvedba-gumb-posljizdaj" ' + (!caka || state.isSubmitting ? "disabled" : "") + '>Pošlji</button></div></div>');

    elKartice.className = "zo-sledi__vsebina";
    elKartice.innerHTML = html;
    if (!samoZaBranje) dodajHitraDejanja();
    requestAnimationFrame(function () {
      prilagodiBesediloOmejenemuPolju(elKartice);
    });

    var gumbPosljiZdaj = document.getElementById("izvedba-gumb-posljizdaj");
    if (!samoZaBranje && gumbPosljiZdaj && caka) gumbPosljiZdaj.addEventListener("click", posljiOpominZdaj);
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
      if (!samoZaBranje) {
        sporociloVnos.addEventListener("input", function () {
          state.urejenaSporocila[sporociloVnos.getAttribute("data-sporocilo-id")] = sporociloVnos.value;
          sporociloVnos.style.height = "auto";
          sporociloVnos.style.height = sporociloVnos.scrollHeight + "px";
        });
      }
    }
    var gumbPreklic = document.getElementById("izvedba-gumb-preklic");
    if (gumbPreklic) gumbPreklic.addEventListener("click", function () {
      odpriActionSheet(["handoff_to_lawyer", "partial_payment", "cancelled_invoice"]);
    });
    var gumbPrekliciHitro = document.getElementById("izvedba-gumb-preklici-hitro");
    if (gumbPrekliciHitro) gumbPrekliciHitro.addEventListener("click", function () {
      odpriActionSheet(["skip_current_step", "stop_plan", "postpone_reminder"]);
    });
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
    if (jeSamoZaBranje() || state.actionSheetOpen || !state.selectedActionType) {
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
      var datumIzbirnik = event.target.closest("input.izvedba-action-sheet__datum-prekrivni, input.izvedba-segment__datum-prekrivni");
      if (datumIzbirnik && typeof datumIzbirnik.showPicker === "function") {
        try { datumIzbirnik.showPicker(); } catch (_napaka) { /* brskalnik uporabi svoj privzeti izbirnik */ }
      }
      if (!event.target.closest(".zgodovina-kontrolnik__select")) {
        elActionSheet.querySelectorAll(".zgodovina-kontrolnik__select.is-open").forEach(function (ovoj) {
          ovoj.classList.remove("is-open");
          var sprozi = ovoj.querySelector("[data-history-select-toggle]");
          var seznam = ovoj.querySelector(".zgodovina-kontrolnik__select-seznam");
          if (sprozi) sprozi.setAttribute("aria-expanded", "false");
          if (seznam) seznam.hidden = true;
        });
      }
      var close = event.target.closest("[data-action-sheet-close]");
      if (close) {
        zapriActionSheet();
        return;
      }
      var confirm = event.target.closest("[data-action-sheet-confirm]");
      if (confirm) {
        if (state.actionSheetMode === "payment") {
          if (state.actionSheetStep === "izbira") {
            if (jeBoPlacalNeposrednaHitraIzbira()) {
              if (dodajKorakVNacrt()) nastaviNovNacrt();
              else izrisiActionSheet();
            } else {
              state.actionSheetStep = "povzetek";
              izrisiActionSheet();
            }
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
      if (state.actionSheetMode === "payment" || jeOdvetnikZgodovina()) {
        var zgodovinaIzbrisiVse = event.target.closest("[data-zgodovina-izbrisi-vse]");
        if (zgodovinaIzbrisiVse) {
          state.nacrtKoraki = [];
          state.razsirjenKorakPovzetka = null;
          state.aktivenDokument = 0;
          state.error = null;
          izrisiActionSheet();
          return;
        }
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
          var korakDodan = dodajKorakVNacrt();
          if (korakDodan && jeVnosZgodovine()) state.selectedSettlementType = null;
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
        var planerStevilo = event.target.closest("[data-obrok-planer-stevilo]");
        if (planerStevilo) {
          state.settlementSettings.installment.planer.steviloObrokov = Number(planerStevilo.getAttribute("data-obrok-planer-stevilo"));
          obnoviPlanerObroke();
          state.error = null;
          izrisiActionSheet();
          return;
        }
        var planerRazmik = event.target.closest("[data-obrok-planer-razmik]");
        if (planerRazmik) {
          var izbranaVrednostRazmika = planerRazmik.getAttribute("data-obrok-planer-razmik");
          var planerZaRazmik = state.settlementSettings.installment.planer;
          planerZaRazmik.razmik = planerZaRazmik.razmik === izbranaVrednostRazmika ? null : izbranaVrednostRazmika;
          obnoviPlanerObroke();
          state.error = null;
          izrisiActionSheet();
          return;
        }
        var planerVrsticaOdstrani = event.target.closest("[data-obrok-planer-vrstica-odstrani]");
        if (planerVrsticaOdstrani) {
          var odstraniIndeks = Number(planerVrsticaOdstrani.getAttribute("data-obrok-planer-vrstica-odstrani"));
          var planerZaOdstranitev = state.settlementSettings.installment.planer;
          planerZaOdstranitev.obroki.splice(odstraniIndeks, 1);
          planerZaOdstranitev.steviloObrokov = planerZaOdstranitev.obroki.length;
          if (planerZaOdstranitev.enakomerno) obnoviPlanerObroke();
          izrisiActionSheet();
          return;
        }
        var planerVrsticaPreklop = event.target.closest("[data-obrok-planer-vrstica-preklop]");
        if (planerVrsticaPreklop) {
          var preklopIndeks = Number(planerVrsticaPreklop.getAttribute("data-obrok-planer-vrstica-preklop"));
          var preklopVrstica = state.settlementSettings.installment.planer.obroki[preklopIndeks];
          if (preklopVrstica) preklopVrstica.razsirjen = preklopVrstica.razsirjen === false;
          izrisiActionSheet();
          return;
        }
        var planerDatumNeznan = event.target.closest("[data-obrok-planer-datum-unknown]");
        if (planerDatumNeznan) {
          var datumNeznanIndeks = Number(planerDatumNeznan.getAttribute("data-obrok-planer-datum-unknown"));
          var datumNeznanVrstica = state.settlementSettings.installment.planer.obroki[datumNeznanIndeks];
          if (datumNeznanVrstica) {
            datumNeznanVrstica.datumNeznan = datumNeznanVrstica.datumNeznan !== true;
            datumNeznanVrstica.datum = null;
            datumNeznanVrstica.datumPriblizno = "";
            datumNeznanVrstica.datumPribliznoAktivno = false;
            datumNeznanVrstica.datumRocno = true;
          }
          state.error = null;
          izrisiActionSheet();
          return;
        }
        var planerDatumPriblizno = event.target.closest("[data-obrok-planer-datum-approx]");
        if (planerDatumPriblizno) {
          var datumPribliznoIndeks = Number(planerDatumPriblizno.getAttribute("data-obrok-planer-datum-approx"));
          var datumPribliznoVrstica = state.settlementSettings.installment.planer.obroki[datumPribliznoIndeks];
          if (datumPribliznoVrstica) {
            datumPribliznoVrstica.datumPribliznoAktivno = datumPribliznoVrstica.datumPribliznoAktivno !== true;
            datumPribliznoVrstica.datum = null;
            datumPribliznoVrstica.datumNeznan = false;
            if (!datumPribliznoVrstica.datumPribliznoAktivno) datumPribliznoVrstica.datumPriblizno = "";
            datumPribliznoVrstica.datumRocno = true;
          }
          state.error = null;
          izrisiActionSheet();
          requestAnimationFrame(function () {
            var pribliznoVnos = elActionSheet.querySelector('[data-obrok-planer-datum-approximation="' + datumPribliznoIndeks + '"]');
            if (pribliznoVnos) pribliznoVnos.focus({ preventScroll: true });
          });
          return;
        }
        var planerDodaj = event.target.closest("[data-obrok-planer-dodaj]");
        if (planerDodaj) {
          var planerZaDodajanje = state.settlementSettings.installment.planer;
          if (planerZaDodajanje.obroki.length < 20) {
            planerZaDodajanje.steviloObrokov = planerZaDodajanje.obroki.length + 1;
            obnoviPlanerObroke();
          }
          state.error = null;
          izrisiActionSheet();
          return;
        }
        var planerDodajVse = event.target.closest("[data-obrok-planer-dodaj-vse]");
        if (planerDodajVse) {
          var steviloDodanihObrokov = state.settlementSettings.installment.planer.obroki.length;
          dodajVsePlaniraneObroke();
          izrisiActionSheet();
          pomakniPotekNaDno(steviloDodanihObrokov);
          return;
        }
        var planerEnakomerno = event.target.closest("[data-obrok-planer-enakomerno]");
        if (planerEnakomerno) {
          state.settlementSettings.installment.planer.enakomerno = !state.settlementSettings.installment.planer.enakomerno;
          obnoviPlanerObroke();
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
      var preklicRazlog = event.target.closest("[data-skip-reason]");
      if (preklicRazlog) {
        var novPreklicRazlog = preklicRazlog.getAttribute("data-skip-reason");
        state.settingsByAction.skip_current_step.skipReason = state.settingsByAction.skip_current_step.skipReason === novPreklicRazlog ? "" : novPreklicRazlog;
        if (state.settingsByAction.skip_current_step.skipReason !== "other") state.settingsByAction.skip_current_step.skipReasonDetail = "";
        state.error = null;
        izrisiActionSheet();
        return;
      }
      var razlogMoznost = event.target.closest("[data-settlement-reason-option]");
      if (razlogMoznost) {
        var razlogTip = razlogMoznost.getAttribute("data-settlement-type");
        var razlogVrednost = razlogMoznost.getAttribute("data-settlement-reason-option");
        state.selectedSettlementType = razlogTip;
        state.settlementSettings[razlogTip].reason = state.settlementSettings[razlogTip].reason === razlogVrednost ? "" : razlogVrednost;
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
      var zgodovinaIzbira = event.target.closest("[data-history-choice]");
      if (zgodovinaIzbira) {
        var zgodovinaIzbiraTip = zgodovinaIzbira.getAttribute("data-history-type");
        var zgodovinaIzbiraPolje = zgodovinaIzbira.getAttribute("data-history-field");
        var zgodovinaIzbiraVrednost = zgodovinaIzbira.getAttribute("data-history-choice");
        var zgodovinaIzbiraNastavitve = zgodovinaNastavitve(zgodovinaIzbiraTip);
        zgodovinaIzbiraNastavitve[zgodovinaIzbiraPolje] = zgodovinaIzbiraNastavitve[zgodovinaIzbiraPolje] === zgodovinaIzbiraVrednost ? "" : zgodovinaIzbiraVrednost;
        state.selectedSettlementType = zgodovinaIzbiraTip;
        state.error = null;
        izrisiActionSheet();
        return;
      }
      var zgodovinaSelectMoznost = event.target.closest("[data-history-select-option]");
      if (zgodovinaSelectMoznost) {
        var zgodovinaSelectOvoj = zgodovinaSelectMoznost.closest(".zgodovina-kontrolnik__select");
        var zgodovinaNativeSelect = zgodovinaSelectOvoj && zgodovinaSelectOvoj.querySelector("select[data-history-setting]");
        if (zgodovinaNativeSelect) {
          var zgodovinaSelectVrednost = zgodovinaSelectMoznost.getAttribute("data-history-select-option");
          zgodovinaNativeSelect.value = zgodovinaNativeSelect.value === zgodovinaSelectVrednost ? "" : zgodovinaSelectVrednost;
          zgodovinaNativeSelect.dispatchEvent(new Event("input", { bubbles: true }));
          izrisiActionSheet();
        }
        return;
      }
      var zgodovinaSelectSprozi = event.target.closest("[data-history-select-toggle]");
      if (zgodovinaSelectSprozi) {
        var zgodovinaSelectTrenutni = zgodovinaSelectSprozi.closest(".zgodovina-kontrolnik__select");
        var zgodovinaSelectSeznam = zgodovinaSelectTrenutni && zgodovinaSelectTrenutni.querySelector(".zgodovina-kontrolnik__select-seznam");
        var zgodovinaSelectOdprt = zgodovinaSelectSprozi.getAttribute("aria-expanded") === "true";
        elActionSheet.querySelectorAll(".zgodovina-kontrolnik__select.is-open").forEach(function (ovoj) {
          ovoj.classList.remove("is-open");
          var drugSprozi = ovoj.querySelector("[data-history-select-toggle]");
          var drugSeznam = ovoj.querySelector(".zgodovina-kontrolnik__select-seznam");
          if (drugSprozi) drugSprozi.setAttribute("aria-expanded", "false");
          if (drugSeznam) drugSeznam.hidden = true;
        });
        if (!zgodovinaSelectOdprt && zgodovinaSelectTrenutni && zgodovinaSelectSeznam) {
          zgodovinaSelectTrenutni.classList.add("is-open");
          zgodovinaSelectSprozi.setAttribute("aria-expanded", "true");
          zgodovinaSelectSeznam.hidden = false;
        }
        return;
      }
      var zgodovinaDatumNeznan = event.target.closest("[data-history-date-unknown]");
      if (zgodovinaDatumNeznan) {
        var zgodovinaDatumTip = zgodovinaDatumNeznan.getAttribute("data-history-type");
        var zgodovinaDatumPolje = zgodovinaDatumNeznan.getAttribute("data-history-date-unknown");
        var zgodovinaDatumNastavitve = zgodovinaNastavitve(zgodovinaDatumTip);
        var zgodovinaUnknownPolje = zgodovinaDatumPolje + "Unknown";
        zgodovinaDatumNastavitve[zgodovinaUnknownPolje] = zgodovinaDatumNastavitve[zgodovinaUnknownPolje] !== true;
        if (zgodovinaDatumNastavitve[zgodovinaUnknownPolje]) {
          zgodovinaDatumNastavitve[zgodovinaDatumPolje] = null;
          zgodovinaDatumNastavitve[zgodovinaDatumPolje + "Approximation"] = "";
          zgodovinaDatumNastavitve[zgodovinaDatumPolje + "Approximate"] = false;
        }
        state.selectedSettlementType = zgodovinaDatumTip;
        state.error = null;
        izrisiActionSheet();
        return;
      }
      var neplacanStevilkaNeznana = event.target.closest("[data-unpaid-installment-number-unknown]");
      if (neplacanStevilkaNeznana) {
        var neplacanStevilkaNastavitve = state.settlementSettings.unpaid_installment;
        neplacanStevilkaNastavitve.installmentNumberUnknown = neplacanStevilkaNastavitve.installmentNumberUnknown !== true;
        if (neplacanStevilkaNastavitve.installmentNumberUnknown) neplacanStevilkaNastavitve.installmentNumber = null;
        state.selectedSettlementType = "unpaid_installment";
        state.error = null;
        izrisiActionSheet();
        return;
      }
      var zgodovinaDatumPribliznoGumb = event.target.closest("[data-history-date-approx]");
      if (zgodovinaDatumPribliznoGumb) {
        var pribliznoTip = zgodovinaDatumPribliznoGumb.getAttribute("data-history-type");
        var pribliznoPolje = zgodovinaDatumPribliznoGumb.getAttribute("data-history-date-approx");
        var pribliznoNastavitve = zgodovinaNastavitve(pribliznoTip);
        var pribliznoAktivno = pribliznoNastavitve[pribliznoPolje + "Approximate"] === true || Boolean(zgodovinaDatumPriblizno(pribliznoNastavitve, pribliznoPolje));
        pribliznoNastavitve[pribliznoPolje + "Approximate"] = !pribliznoAktivno;
        pribliznoNastavitve[pribliznoPolje + "Unknown"] = false;
        if (!pribliznoAktivno) pribliznoNastavitve[pribliznoPolje] = null;
        else pribliznoNastavitve[pribliznoPolje + "Approximation"] = "";
        state.selectedSettlementType = pribliznoTip;
        state.error = null;
        izrisiActionSheet();
        requestAnimationFrame(function () {
          var pribliznoVnos = elActionSheet.querySelector('[data-history-date-approximation="' + pribliznoPolje + '"][data-history-type="' + pribliznoTip + '"]');
          if (pribliznoVnos) pribliznoVnos.focus({ preventScroll: true });
        });
        return;
      }
      var poravnavaIzbira = event.target.closest("[data-settlement-select]");
      var neplacanDatumNeznan = event.target.closest("[data-unpaid-date-unknown]");
      if (neplacanDatumNeznan) {
        var neplacanNastavitve = state.settlementSettings.unpaid_installment;
        neplacanNastavitve.dueAtUnknown = neplacanNastavitve.dueAtUnknown !== true;
        if (neplacanNastavitve.dueAtUnknown) neplacanNastavitve.dueAt = null;
        state.selectedSettlementType = "unpaid_installment";
        state.error = null;
        izrisiActionSheet();
        return;
      }
      if (poravnavaIzbira) {
        var izbranTip = poravnavaIzbira.getAttribute("data-settlement-select");
        var jeGostiteljskaHitra = poravnavaIzbira.classList.contains("atena-gostitelj__hitra");
        var boOstalaIzbrana = state.selectedSettlementType !== izbranTip;
        state.customActionActive = false;
        state.selectedSettlementType = boOstalaIzbrana ? izbranTip : null;
        state.boPlacalHitraIzbira = jeGostiteljskaHitra && boOstalaIzbrana;
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
        var akcijaZaIzbiro = izbira.getAttribute("data-action-sheet-select");
        if (akcijaZaIzbiro === "handoff_to_lawyer") {
          odpriOdvetnikCarovnik();
          return;
        }
        if (state.selectedActionType === akcijaZaIzbiro) {
          state.selectedActionType = null;
          state.error = null;
        } else {
          izberiAkcijo(akcijaZaIzbiro);
        }
        izrisiActionSheet();
        return;
      }
      var lastnaAkcija = event.target.closest("[data-action-custom]");
      if (lastnaAkcija) {
        state.customActionActive = !state.customActionActive;
        state.selectedActionType = null;
        state.selectedSettlementType = state.customActionActive && state.actionSheetMode === "payment" ? "payment_promised" : null;
        state.error = null;
        izrisiActionSheet();
        return;
      }
      var lawyerHistoryCustomAdd = event.target.closest("[data-lawyer-history-custom-add]");
      if (lawyerHistoryCustomAdd) {
        var lawyerHistoryOpis = String(state.lawyerWizard.customHistoryDescription || "").trim();
        if (!lawyerHistoryOpis) {
          var lawyerHistoryPolje = elActionSheet.querySelector("[data-lawyer-history-custom-description]");
          if (lawyerHistoryPolje) { lawyerHistoryPolje.setCustomValidity("Vpišite kratek opis dogodka."); lawyerHistoryPolje.reportValidity(); }
          return;
        }
        var lawyerHistoryDatum = state.lawyerWizard.customHistoryDate || new Date().toISOString().slice(0, 10);
        state.nacrtKoraki.push({ tip: "history_custom", actionType: "history_custom", settings: { description: lawyerHistoryOpis, occurredAt: lawyerHistoryDatum }, naslov: lawyerHistoryOpis, znesek: null, ikona: "pencil", razred: "drugo", datum: lawyerHistoryDatum + "T12:00:00" });
        state.lawyerWizard.customHistoryDescription = "";
        state.lawyerWizard.customHistoryDate = new Date().toISOString().slice(0, 10);
        state.customActionActive = false;
        izrisiActionSheet();
        pomakniPotekNaDno();
        return;
      }
      var lawyerShowAll = event.target.closest("[data-lawyer-show-all]");
      if (lawyerShowAll) {
        state.lawyerWizard.showLawyerList = true;
        state.lawyerWizard.screen = "podrobnosti";
        izrisiActionSheet();
        return;
      }
      var lawyerDetails = event.target.closest("[data-lawyer-details]");
      if (lawyerDetails) {
        state.lawyerWizard.screen = "podrobnosti";
        izrisiActionSheet();
        return;
      }
      var lawyerCaseToggle = event.target.closest("[data-lawyer-case-toggle]");
      if (lawyerCaseToggle) {
        var caseDetails = elActionSheet.querySelector("[data-lawyer-case-details]");
        var expanded = lawyerCaseToggle.getAttribute("aria-expanded") === "true";
        lawyerCaseToggle.setAttribute("aria-expanded", String(!expanded));
        if (caseDetails) caseDetails.hidden = expanded;
        return;
      }
      var lawyerHistoryToggle = event.target.closest("[data-lawyer-history-toggle]");
      if (lawyerHistoryToggle) {
        var historyStepId = lawyerHistoryToggle.getAttribute("data-lawyer-history-toggle");
        state.lawyerWizard.expandedHistoryStepId = String(state.lawyerWizard.expandedHistoryStepId || "") === String(historyStepId) ? null : historyStepId;
        izrisiOdvetnikSheetZOhranjenimPomikom();
        return;
      }
      var lawyerReviewCurrent = event.target.closest("[data-lawyer-review-current]");
      if (lawyerReviewCurrent) {
        zapriActionSheet();
        return;
      }
      var lawyerGoScreen = event.target.closest("[data-lawyer-go-screen]");
      if (lawyerGoScreen && !lawyerGoScreen.disabled) {
        var ciljniLawyerScreen = lawyerGoScreen.getAttribute("data-lawyer-go-screen");
        if (state.lawyerWizard.screen === "zgodovina" && ciljniLawyerScreen !== "zgodovina") zapustiOdvetnikZgodovino(true);
        state.lawyerWizard.screen = ciljniLawyerScreen;
        if (ciljniLawyerScreen === "zgodovina") vstopiVOdvetnikZgodovino();
        izrisiActionSheet();
        return;
      }
      var lawyerScrollPackage = event.target.closest("[data-lawyer-scroll-package]");
      if (lawyerScrollPackage) {
        var scrollPackageId = lawyerScrollPackage.getAttribute("data-lawyer-scroll-package");
        var scrollCard = elActionSheet.querySelector('.lp-paket-kartica[data-lawyer-package="' + scrollPackageId + '"]');
        if (scrollCard) scrollCard.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        elActionSheet.querySelectorAll(".lp-paket-pika").forEach(function (dot) {
          dot.classList.toggle("lp-paket-pika--aktivna", dot.getAttribute("data-lawyer-scroll-package") === scrollPackageId);
        });
        return;
      }
      var lawyerPackagePreview = event.target.closest("[data-lawyer-package-preview]");
      if (lawyerPackagePreview) {
        state.lawyerWizard.previewPackageId = lawyerPackagePreview.getAttribute("data-lawyer-package-preview");
        state.lawyerWizard.screen = "paket-pregled";
        izrisiActionSheet();
        return;
      }
      var lawyerPaket = event.target.closest("[data-lawyer-package]");
      if (lawyerPaket) {
        var noviPaketId = lawyerPaket.getAttribute("data-lawyer-package");
        if (noviPaketId !== state.lawyerWizard.packageId) {
          var noviPaket = najdiLawyerPaket(noviPaketId);
          var noviOdvetnik = najdiLawyerProfil(noviPaket.lawyerId);
          state.lawyerWizard.packageId = noviPaketId;
          state.lawyerWizard.lawyerId = noviPaket.lawyerId;
          state.lawyerWizard.availableHandoffDays = kopirajPodatke(noviOdvetnik.availableHandoffDays);
          state.lawyerWizard.preservePlanHandoff = false;
          if (!state.lawyerWizard.messageEditedManually) state.lawyerWizard.message = "";
        }
        izrisiOdvetnikSheetZOhranjenimPomikom();
        return;
      }
      var lawyerSwapToggle = event.target.closest("[data-lawyer-swap-toggle]");
      if (lawyerSwapToggle) {
        var seznam = elActionSheet.querySelector("[data-lawyer-swap-list]");
        if (seznam) seznam.hidden = !seznam.hidden;
        return;
      }
      var lawyerSelect = event.target.closest("[data-lawyer-select]");
      if (lawyerSelect) {
        state.lawyerWizard.lawyerId = lawyerSelect.getAttribute("data-lawyer-select");
        state.lawyerWizard.availableHandoffDays = kopirajPodatke(najdiLawyerProfil(state.lawyerWizard.lawyerId).availableHandoffDays);
        state.lawyerWizard.preservePlanHandoff = false;
        izrisiOdvetnikSheetZOhranjenimPomikom();
        return;
      }
      var lawyerDocuments = event.target.closest("[data-lawyer-documents]");
      if (lawyerDocuments) {
        state.lawyerWizard.showDocuments = !state.lawyerWizard.showDocuments;
        var seznamDokumentov = elActionSheet.querySelector("[data-lawyer-documents-list]");
        if (seznamDokumentov) seznamDokumentov.hidden = !state.lawyerWizard.showDocuments;
        elActionSheet.querySelectorAll("[data-lawyer-documents]").forEach(function (gumbDokumentov) {
          gumbDokumentov.setAttribute("aria-expanded", String(Boolean(state.lawyerWizard.showDocuments)));
        });
        return;
      }
      var lawyerDay = event.target.closest("[data-lawyer-day]");
      if (lawyerDay) {
        var dayIndex = Number(lawyerDay.getAttribute("data-lawyer-day"));
        var selectedDays = state.lawyerWizard.availableHandoffDays || [true, true, true, true, true, false, false];
        if (!selectedDays[dayIndex] || selectedDays.filter(Boolean).length > 1) {
          selectedDays[dayIndex] = !selectedDays[dayIndex];
          state.lawyerWizard.availableHandoffDays = selectedDays;
          state.lawyerWizard.preservePlanHandoff = false;
          lawyerDay.classList.toggle("opomin-predaja-sestavljalnik__dan--aktiven", selectedDays[dayIndex]);
          lawyerDay.setAttribute("aria-pressed", String(selectedDays[dayIndex]));
          izrisiOdvetnikSheetZOhranjenimPomikom();
        }
        return;
      }
      var lawyerTiming = event.target.closest("[data-lawyer-timing]");
      if (lawyerTiming) {
        state.settingsByAction.handoff_to_lawyer.timingMode = lawyerTiming.getAttribute("data-lawyer-timing");
        state.lawyerWizard.preservePlanHandoff = false;
        if (state.settingsByAction.handoff_to_lawyer.timingMode === "asap") {
          state.settingsByAction.handoff_to_lawyer.scheduledHandoffAt = null;
        } else if (!state.settingsByAction.handoff_to_lawyer.scheduledHandoffAt) {
          state.settingsByAction.handoff_to_lawyer.scheduledHandoffAt = najzgodnejsiCasLawyerPredaje(state.lawyerWizard.availableHandoffDays);
        }
        izrisiOdvetnikSheetZOhranjenimPomikom();
        return;
      }
      var lawyerNext = event.target.closest("[data-lawyer-next]");
      if (lawyerNext) {
        if (state.lawyerWizard.screen === "zgodovina") {
          zapustiOdvetnikZgodovino(true);
          state.lawyerWizard.screen = "paket";
        } else {
          state.lawyerWizard.screen = state.lawyerWizard.screen === "paket" ? "podrobnosti" : "pregled";
        }
        izrisiActionSheet();
        return;
      }
      var lawyerDeleteDetails = event.target.closest("[data-lawyer-delete-details]");
      if (lawyerDeleteDetails) {
        state.lawyerWizard.message = "";
        state.lawyerWizard.messageEditedManually = false;
        state.lawyerWizard.showDocuments = false;
        state.lawyerWizard.showLawyerList = false;
        state.lawyerWizard.preservePlanHandoff = false;
        state.lawyerWizard.screen = "paket";
        izrisiActionSheet();
        return;
      }
      var lawyerBack = event.target.closest("[data-lawyer-back]");
      if (lawyerBack) {
        if (state.lawyerWizard.screen === "pregled") state.lawyerWizard.screen = "podrobnosti";
        else if (state.lawyerWizard.screen === "podrobnosti" || state.lawyerWizard.screen === "paket-pregled") state.lawyerWizard.screen = "paket";
        else {
          state.lawyerWizard.screen = "zgodovina";
          vstopiVOdvetnikZgodovino();
        }
        izrisiActionSheet();
        return;
      }
      var lawyerSubmit = event.target.closest("[data-lawyer-submit]");
      if (lawyerSubmit) {
        submitLawyerWizard();
        return;
      }
      var lawyerReviewMessageRevert = event.target.closest("[data-lawyer-review-message-revert]");
      if (lawyerReviewMessageRevert) {
        state.lawyerWizard.reviewMessageDraft = state.lawyerWizard.message;
        state.lawyerWizard.reviewMessageEditing = false;
        izrisiActionSheet();
        return;
      }
      var lawyerReviewMessageSave = event.target.closest("[data-lawyer-review-message-save]");
      if (lawyerReviewMessageSave) {
        state.lawyerWizard.message = String(state.lawyerWizard.reviewMessageDraft || "");
        state.lawyerWizard.messageEditedManually = true;
        state.lawyerWizard.reviewMessageEditing = false;
        state.lawyerWizard.preservePlanHandoff = false;
        izrisiActionSheet();
        return;
      }
      var lawyerSaveDraft = event.target.closest("[data-lawyer-save-draft]");
      if (lawyerSaveDraft) {
        state.lawyerWizardDraft = kopirajPodatke(state.lawyerWizard);
        zapriActionSheet();
        return;
      }
      var lawyerManualInfo = event.target.closest("[data-lawyer-manual-info]");
      if (lawyerManualInfo) {
        state.lawyerWizard.showManualInfo = !state.lawyerWizard.showManualInfo;
        lawyerManualInfo.setAttribute("aria-expanded", String(Boolean(state.lawyerWizard.showManualInfo)));
        var razlagaRocnePredaje = elActionSheet.querySelector("[data-lawyer-manual-info-text]");
        if (razlagaRocnePredaje) razlagaRocnePredaje.hidden = !state.lawyerWizard.showManualInfo;
        return;
      }
    });

    elActionSheet.addEventListener("input", function (event) {
      var preklicRazlogOpis = event.target.closest("[data-skip-reason-detail]");
      if (preklicRazlogOpis) {
        state.settingsByAction.skip_current_step.skipReason = "other";
        state.settingsByAction.skip_current_step.skipReasonDetail = preklicRazlogOpis.value;
        state.error = null;
        return;
      }
      var lawyerHistoryOpis = event.target.closest("[data-lawyer-history-custom-description]");
      if (lawyerHistoryOpis) {
        state.lawyerWizard.customHistoryDescription = lawyerHistoryOpis.value;
        lawyerHistoryOpis.setCustomValidity("");
        return;
      }
      var lawyerHistoryDatum = event.target.closest("[data-lawyer-history-custom-date]");
      if (lawyerHistoryDatum) {
        state.lawyerWizard.customHistoryDate = lawyerHistoryDatum.value;
        return;
      }
      var lawyerDatum = event.target.closest("[data-lawyer-handoff-date], [data-lawyer-handoff-time]");
      if (lawyerDatum) {
        var datumInput = elActionSheet.querySelector("[data-lawyer-handoff-date]");
        var uraInput = elActionSheet.querySelector("[data-lawyer-handoff-time]");
        var datumDeli = String(datumInput && datumInput.value || "").split("-").map(Number);
        var uraDeli = String(uraInput && uraInput.value || "09:00").split(":").map(Number);
        if (datumDeli.length === 3 && datumDeli.every(Number.isFinite) && uraDeli.length >= 2 && uraDeli.every(Number.isFinite)) {
          var novCasPredaje = new Date(datumDeli[0], datumDeli[1] - 1, datumDeli[2], uraDeli[0], uraDeli[1], 0, 0);
          if (!Number.isNaN(novCasPredaje.getTime())) {
            state.settingsByAction.handoff_to_lawyer.timingMode = "custom";
            state.settingsByAction.handoff_to_lawyer.scheduledHandoffAt = novCasPredaje.toISOString();
            state.lawyerWizard.preservePlanHandoff = false;
            var noviPrikazCasa = lawyerDatumDeli(novCasPredaje.toISOString());
            var prikazDneva = elActionSheet.querySelector(".opomin-predaja-sestavljalnik__cas-dan");
            var prikazDatumaUre = elActionSheet.querySelector(".opomin-predaja-sestavljalnik__cas-datum-ura");
            var prikazDatumPolja = elActionSheet.querySelector("[data-lawyer-handoff-date-display]");
            var prikazUrePolja = elActionSheet.querySelector("[data-lawyer-handoff-time-display]");
            if (prikazDneva) prikazDneva.textContent = noviPrikazCasa.dan;
            if (prikazDatumaUre) prikazDatumaUre.textContent = noviPrikazCasa.kratko + " · " + noviPrikazCasa.ura;
            if (prikazDatumPolja) prikazDatumPolja.textContent = noviPrikazCasa.datum.split("-").reverse().join(".");
            if (prikazUrePolja) prikazUrePolja.textContent = noviPrikazCasa.ura;
            elActionSheet.querySelectorAll("[data-lawyer-timing]").forEach(function (gumb) {
              var aktiven = gumb.getAttribute("data-lawyer-timing") === "custom";
              gumb.setAttribute("aria-pressed", String(aktiven));
              var vrstica = gumb.closest(".opomin-predaja-sestavljalnik__cas-vrstica");
              if (vrstica) vrstica.classList.toggle("opomin-predaja-sestavljalnik__cas-vrstica--aktivna", aktiven);
            });
          }
        }
        return;
      }
      var neplacanRok = event.target.closest("[data-unpaid-installment-due]");
      if (neplacanRok) {
        var rokDatum = neplacanRok.value ? new Date(neplacanRok.value + "T12:00:00") : null;
        state.settlementSettings.unpaid_installment.dueAt = rokDatum && !Number.isNaN(rokDatum.getTime()) ? rokDatum.toISOString() : null;
        state.settlementSettings.unpaid_installment.dueAtUnknown = false;
        state.selectedSettlementType = "unpaid_installment";
        state.error = null;
        return;
      }
      var zgodovinaPribliznoVnos = event.target.closest("[data-history-date-approximation]");
      if (zgodovinaPribliznoVnos) {
        var zgodovinaPribliznoTip = zgodovinaPribliznoVnos.getAttribute("data-history-type");
        var zgodovinaPribliznoPolje = zgodovinaPribliznoVnos.getAttribute("data-history-date-approximation");
        var zgodovinaPribliznoNastavitve = zgodovinaNastavitve(zgodovinaPribliznoTip);
        zgodovinaPribliznoNastavitve[zgodovinaPribliznoPolje + "Approximation"] = zgodovinaPribliznoVnos.value;
        zgodovinaPribliznoNastavitve[zgodovinaPribliznoPolje + "Approximate"] = true;
        zgodovinaPribliznoNastavitve[zgodovinaPribliznoPolje + "Unknown"] = false;
        zgodovinaPribliznoNastavitve[zgodovinaPribliznoPolje] = null;
        state.selectedSettlementType = zgodovinaPribliznoTip;
        state.error = null;
        return;
      }
      var zgodovinaPolje = event.target.closest("[data-history-setting]");
      if (zgodovinaPolje) {
        var zgodovinaPoljeTip = zgodovinaPolje.getAttribute("data-history-type");
        var zgodovinaPoljeIme = zgodovinaPolje.getAttribute("data-history-setting");
        var zgodovinaPoljeNastavitve = zgodovinaNastavitve(zgodovinaPoljeTip);
        var zgodovinaPoljeVrednost = zgodovinaPolje.value;
        if (zgodovinaPolje.type === "date") {
          var zgodovinaDatumVrednost = zgodovinaPoljeVrednost ? new Date(zgodovinaPoljeVrednost + "T12:00:00") : null;
          zgodovinaPoljeNastavitve[zgodovinaPoljeIme] = zgodovinaDatumVrednost && !Number.isNaN(zgodovinaDatumVrednost.getTime()) ? zgodovinaDatumVrednost.toISOString() : null;
          if (zgodovinaPoljeVrednost) {
            zgodovinaPoljeNastavitve[zgodovinaPoljeIme + "Unknown"] = false;
            zgodovinaPoljeNastavitve[zgodovinaPoljeIme + "Approximation"] = "";
            zgodovinaPoljeNastavitve[zgodovinaPoljeIme + "Approximate"] = false;
          }
        } else if (zgodovinaPolje.type === "number") {
          zgodovinaPoljeNastavitve[zgodovinaPoljeIme] = zgodovinaPoljeVrednost === "" ? null : Number(zgodovinaPoljeVrednost);
        } else {
          zgodovinaPoljeNastavitve[zgodovinaPoljeIme] = zgodovinaPoljeVrednost;
        }
        state.selectedSettlementType = zgodovinaPoljeTip;
        state.error = null;
        return;
      }
      var poravnavaZnesek = event.target.closest("[data-settlement-amount]");
      if (poravnavaZnesek) {
        var znesekTip = poravnavaZnesek.getAttribute("data-settlement-type");
        state.selectedSettlementType = znesekTip;
        state.settlementSettings[znesekTip][poravnavaZnesek.getAttribute("data-settlement-amount")] = poravnavaZnesek.value === "" ? null : Number(poravnavaZnesek.value);
        if (znesekTip === "unpaid_installment" && poravnavaZnesek.getAttribute("data-settlement-amount") === "installmentNumber") {
          state.settlementSettings.unpaid_installment.installmentNumberUnknown = false;
        }
        state.error = null;
        prilagodiBesediloOmejenemuPolju(poravnavaZnesek.parentElement);
        if (znesekTip === "credit_note" || znesekTip === "compensation") {
          state.settlementSettings[znesekTip].rocnoUrejeno = true;
        }
        if (znesekTip === "credit_note") {
          var namigEl = poravnavaZnesek.parentElement.parentElement.querySelector(".izvedba-poravnava__namig");
          if (namigEl) {
            var vneseniDobropis = Number(state.settlementSettings.credit_note.settlementAmount) || 0;
            var jePolniDobropisVnos = Math.abs(vneseniDobropis - preostaliDolgPoNacrtu()) <= 0.009;
            var jePrihodnjiDogovor = jePlacilniEngine() && !jeVnosZgodovine();
            namigEl.textContent = jePrihodnjiDogovor
              ? (jePolniDobropisVnos ? "Dogovor pokriva celoten dolg; dolg se še ne zmanjša." : "Dogovor pokriva del dolga; dolg se še ne zmanjša.")
              : (jePolniDobropisVnos ? "Pokriva celoten preostali dolg — primer se bo zaprl." : "Manjši znesek od preostanka — primer ostane odprt.");
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
      var lastniOpis = event.target.closest("[data-action-custom-description]");
      if (lastniOpis) {
        state.customActionActive = true;
        state.customActionDescription = lastniOpis.value;
        state.error = null;
        lastniOpis.style.height = "auto";
        lastniOpis.style.height = lastniOpis.scrollHeight + "px";
        return;
      }
      var planerZnesek = event.target.closest("[data-obrok-planer-vrstica-znesek]");
      if (planerZnesek) {
        var planerZnesekIndeks = Number(planerZnesek.getAttribute("data-obrok-planer-vrstica-znesek"));
        var planerObjZnesek = state.settlementSettings.installment.planer;
        var vrsticaZnesek = planerObjZnesek.obroki[planerZnesekIndeks];
        if (vrsticaZnesek) vrsticaZnesek.znesek = planerZnesek.value === "" ? null : Number(planerZnesek.value);
        planerObjZnesek.enakomerno = false;
        var enakomernoEl = elActionSheet.querySelector("[data-obrok-planer-enakomerno]");
        if (enakomernoEl) {
          enakomernoEl.classList.remove("is-selected");
          enakomernoEl.setAttribute("aria-pressed", "false");
          var enakomernoIkonaEl = enakomernoEl.querySelector(".izvedba-obrok-planer__enakomerno-ikona");
          if (enakomernoIkonaEl) enakomernoIkonaEl.innerHTML = "";
        }
        state.error = null;
        posodobiPlanerKontrolnikeVZivo();
        return;
      }
      var planerDatum = event.target.closest("[data-obrok-planer-vrstica-datum]");
      if (planerDatum) {
        var planerDatumIndeks = Number(planerDatum.getAttribute("data-obrok-planer-vrstica-datum"));
        var vrsticaDatum = state.settlementSettings.installment.planer.obroki[planerDatumIndeks];
        if (vrsticaDatum) {
          var datumVrednostNova = planerDatum.value ? new Date(planerDatum.value + "T00:00:00") : null;
          vrsticaDatum.datum = datumVrednostNova && !Number.isNaN(datumVrednostNova.getTime()) ? datumVrednostNova.toISOString() : null;
          vrsticaDatum.datumNeznan = false;
          vrsticaDatum.datumPriblizno = "";
          vrsticaDatum.datumPribliznoAktivno = false;
          vrsticaDatum.datumRocno = true;
        }
        state.error = null;
        posodobiPlanerKontrolnikeVZivo();
        return;
      }
      var planerDatumPribliznoVnos = event.target.closest("[data-obrok-planer-datum-approximation]");
      if (planerDatumPribliznoVnos) {
        var planerDatumPribliznoVnosIndeks = Number(planerDatumPribliznoVnos.getAttribute("data-obrok-planer-datum-approximation"));
        var vrsticaDatumPriblizno = state.settlementSettings.installment.planer.obroki[planerDatumPribliznoVnosIndeks];
        if (vrsticaDatumPriblizno) {
          vrsticaDatumPriblizno.datumPriblizno = planerDatumPribliznoVnos.value;
          vrsticaDatumPriblizno.datumPribliznoAktivno = true;
          vrsticaDatumPriblizno.datum = null;
          vrsticaDatumPriblizno.datumNeznan = false;
          vrsticaDatumPriblizno.datumRocno = true;
        }
        state.error = null;
        posodobiPlanerKontrolnikeVZivo();
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
        return;
      }
      var lawyerMessage = event.target.closest("[data-lawyer-message]");
      if (lawyerMessage) {
        state.lawyerWizard.message = lawyerMessage.value;
        state.lawyerWizard.messageEditedManually = true;
        state.lawyerWizard.preservePlanHandoff = false;
        lawyerMessage.style.height = "auto";
        lawyerMessage.style.height = Math.max(176, lawyerMessage.scrollHeight + 2) + "px";
        return;
      }
      var lawyerReviewMessage = event.target.closest("[data-lawyer-review-message]");
      if (lawyerReviewMessage) {
        state.lawyerWizard.reviewMessageDraft = lawyerReviewMessage.value;
        state.lawyerWizard.reviewMessageEditing = lawyerReviewMessage.value !== state.lawyerWizard.message;
        lawyerReviewMessage.style.height = "auto";
        lawyerReviewMessage.style.height = Math.max(150, lawyerReviewMessage.scrollHeight + 2) + "px";
        var reviewActions = elActionSheet.querySelector("[data-lawyer-review-message-actions]");
        if (reviewActions) reviewActions.hidden = !state.lawyerWizard.reviewMessageEditing;
        var submitReview = elActionSheet.querySelector("[data-lawyer-submit]");
        if (submitReview) submitReview.disabled = !state.lawyerWizard.razumem || state.lawyerWizard.reviewMessageEditing;
        return;
      }
      var lawyerRazumem = event.target.closest("[data-lawyer-razumem]");
      if (lawyerRazumem) {
        state.lawyerWizard.razumem = lawyerRazumem.checked;
        izrisiActionSheet();
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
    if (state.actionSheetMode === "lawyer" && state.lawyerWizard && state.lawyerWizard.screen === "paket") {
      poravnajIzbraniLawyerPaket();
    }
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
    izrisiActionSheet: izrisiActionSheet,
    izrisiActionSvicer: izrisiActionSvicer,
    izrisiActionPodrobnosti: izrisiActionPodrobnosti,
    izberiAkcijo: izberiAkcijo,
    dodajKorakVNacrt: dodajKorakVNacrt,
    dodajKandidatneDogodke: dodajKandidatneDogodke,
    pripraviKandidatIzIzbire: pripraviKandidatIzIzbire,
    pomakniPotekNaDno: pomakniPotekNaDno,
    state: state,
  };
  window.UJPoravnavaWidget = window.UJIzvedbaDebug;

  // ---------- Zagon ----------

  var params = urlParametri();
  state.readonlyRequested = params.readonly === true;
  if (jeVnosZgodovine()) return;
  if (!params.zadevaId && !params.executionId) {
    state.globalnaNapaka = "Manjkajo parametri za odpiranje izvedbe (zadevaId ali executionId).";
    render();
  } else {
    state.currentStepId = params.stepId || null;
    nalozi(params);
  }
})();
