(function () {
  "use strict";

  var KLJUC_KORAK1 = "neplacilo-korak1-podatki";
  var KLJUC_ZGODOVINA = "neplacilo-zgodovina-podatki";
  var ATENA_ENGINE_VERSION = "atena-v7";
  var HISTORY_CONTRACT_VERSION = "history-fact-v75";
  var debug = window.UJPoravnavaWidget;
  var jeVgrajenaZgodovina = document.body && document.body.classList.contains("stran--izvedba-primer");
  var relativniDatumi = window.UJZgodovinaRelativniDatumi;
  var replacementState = window.UJZgodovinaZamenjavaState;
  var preverjanjeZneskov = window.UJZgodovinaPreverjanjeZneskov;
  var customActive = false;
  var ocenaActive = false;
  function lokalniDanesIso(vrednost) {
    var datum = vrednost instanceof Date ? vrednost : new Date();
    function dve(stevilo) { return String(stevilo).padStart(2, "0"); }
    return datum.getFullYear() + "-" + dve(datum.getMonth() + 1) + "-" + dve(datum.getDate());
  }
  var customDraft = { opis: "", datum: lokalniDanesIso(), datumNeznan: false, datumPriblizno: false, datumPribliznoBesedilo: "" };
  var analizaAbort = null;
  var analizaGeneracija = 0;
  var analizaStatusCasovnik = 0;
  var analizaStatusKorak = 0;
  var virUrejanje = false;
  var virOsnutek = "";
  var ANALIZA_STATUS_BESEDILA = [
    "Berem vaš opis …",
    "Iščem ključne dogodke …",
    "Preverjam datume …",
    "Povezujem zneske …",
    "Razvrščam dogodke …",
    "Preverjam podrobnosti …",
    "Pripravljam pregled …",
  ];
  var canary = null;
  var snemanjeAktivno = false;
  var prekinitevPoZagonu = false;
  var ravenGlasu = 0;
  var naravni = {
    mode: "manual",
    text: "",
    status: "idle",
    statusText: "Napišite ali povejte, kaj se je zgodilo.",
    error: "",
    requestId: "",
    candidates: [],
    phase: "input",
    questionIndex: 0,
    questionKeys: [],
    questionPlan: [],
    lunaReport: "",
    lunaReason: "",
    clarificationQuestion: "",
    clarificationClauseId: "",
    clarificationAnswer: "",
    clarificationRound: 0,
    clarificationExhausted: false,
    editCandidate: null,
    replacement: null,
  };

  function preberiJson(kljuc) {
    try { return JSON.parse(sessionStorage.getItem(kljuc) || "null"); }
    catch (_napaka) { return null; }
  }

  function esc(vrednost) {
    return String(vrednost == null ? "" : vrednost)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var korak1 = jeVgrajenaZgodovina ? {} : preberiJson(KLJUC_KORAK1);
  if (jeVgrajenaZgodovina) {
    Object.defineProperty(korak1, "znesek", {
      enumerable: true,
      get: function () {
        var zadeva = debug && debug.state && debug.state.zadeva || {};
        return Number(zadeva.prvotniZnesek != null ? zadeva.prvotniZnesek : (zadeva.znesek || zadeva.preostaliDolg || 0));
      },
    });
  }
  if (!korak1 || !String(korak1.imeDolznika || "").trim() || !Number(korak1.znesek)) {
    if (!jeVgrajenaZgodovina) {
      window.location.replace("neplacila.html#obrazec");
      return;
    }
  }
  if (!debug || !debug.state) {
    var napaka = document.getElementById("zgodovina-napaka");
    if (napaka) {
      napaka.textContent = "Vnosa zgodovine trenutno ni mogoče odpreti.";
      napaka.hidden = false;
    }
    return;
  }

  var shranjeno = jeVgrajenaZgodovina ? {} : (preberiJson(KLJUC_ZGODOVINA) || {});
  if (shranjeno.drugoOsnutek) customDraft = shranjeno.drugoOsnutek;
  if (shranjeno.naravniVnos && typeof shranjeno.naravniVnos === "object") {
    naravni.mode = shranjeno.naravniVnos.mode === "manual" ? "manual" : "natural";
    naravni.text = String(shranjeno.naravniVnos.text || "").slice(0, 2000);
    var shranjeniKandidati = Array.isArray(shranjeno.naravniVnos.candidates) ? shranjeno.naravniVnos.candidates.slice(0, 20) : [];
    var zastarelContract = shranjeniKandidati.length > 0 && (
      shranjeno.naravniVnos.engineVersion !== ATENA_ENGINE_VERSION ||
      shranjeno.naravniVnos.contractVersion !== HISTORY_CONTRACT_VERSION
    );
    naravni.candidates = zastarelContract ? [] : shranjeniKandidati;
    naravni.requestId = zastarelContract ? "" : String(shranjeno.naravniVnos.requestId || "");
    var shranjenaFaza = ["input", "clarification", "clarification_exhausted", "questions", "review"].indexOf(shranjeno.naravniVnos.phase) >= 0 ? shranjeno.naravniVnos.phase : null;
    naravni.phase = zastarelContract ? "input" : shranjenaFaza || (naravni.candidates.length ? "questions" : "input");
    naravni.questionIndex = Math.max(0, Number(shranjeno.naravniVnos.questionIndex) || 0);
    naravni.questionKeys = Array.isArray(shranjeno.naravniVnos.questionKeys) ? shranjeno.naravniVnos.questionKeys.slice(0, 80) : [];
    naravni.questionPlan = Array.isArray(shranjeno.naravniVnos.questionPlan) ? shranjeno.naravniVnos.questionPlan.slice(0, 20) : [];
    naravni.lunaReport = String(shranjeno.naravniVnos.lunaReport || "").slice(0, 240);
    naravni.lunaReason = String(shranjeno.naravniVnos.lunaReason || "").slice(0, 120);
    naravni.clarificationQuestion = String(shranjeno.naravniVnos.clarificationQuestion || "").slice(0, 180);
    naravni.clarificationClauseId = String(shranjeno.naravniVnos.clarificationClauseId || "").slice(0, 80);
    naravni.clarificationAnswer = String(shranjeno.naravniVnos.clarificationAnswer || "").slice(0, 400);
    naravni.clarificationRound = Math.max(0, Math.min(2, Number(shranjeno.naravniVnos.clarificationRound) || 0));
    naravni.clarificationExhausted = shranjeno.naravniVnos.clarificationExhausted === true;
    if (naravni.phase === "clarification" && !naravni.clarificationQuestion) naravni.phase = "input";
    if (naravni.phase === "clarification_exhausted" && !naravni.clarificationExhausted) naravni.phase = "input";
    naravni.editCandidate = Number.isInteger(shranjeno.naravniVnos.editCandidate) ? shranjeno.naravniVnos.editCandidate : null;
    naravni.replacement = shranjeno.naravniVnos.replacement && shranjeno.naravniVnos.replacement.active === true
      ? shranjeno.naravniVnos.replacement
      : null;
    naravni.candidates.forEach(zagotoviKandidatId);
    if (naravni.replacement && najdiIzvorniIndeksZamenjave() < 0) naravni.replacement = null;
    if (naravni.candidates.length) {
      dopolniRelativneDatume(naravni.candidates);
      dopolniIzracunaniNeplacaniObrok(naravni.candidates);
      if (shranjeno.naravniVnos.questionGrouping !== "candidate-engine-v1") {
        naravni.questionKeys = naravni.editCandidate != null ? vsaVprasanjaKandidata(naravni.editCandidate) : manjkajocaVprasanja();
        naravni.questionIndex = 0;
      }
      naravni.questionKeys = normalizirajKljuciVprasanj(naravni.questionKeys);
      if (!naravni.questionKeys.length) naravni.questionKeys = manjkajocaVprasanja();
      naravni.questionIndex = Math.max(0, Math.min(naravni.questionIndex, Math.max(0, naravni.questionKeys.length - 1)));
      if (!naravni.questionKeys.length) naravni.phase = "review";
      naravni.status = "ready";
      naravni.statusText = "Preglejte pripravljene osnutke. Nič še ni shranjeno.";
    } else if (zastarelContract) {
      naravni.status = "ready";
      naravni.statusText = "Opis je treba ponovno preveriti z novejšim razumevanjem. Pritisnite Pripravi dogodke.";
    }
  }

  function shrani(potrjena) {
    if (jeVgrajenaZgodovina) {
      var stanjeVgrajenega = debug && debug.state;
      if (!stanjeVgrajenega) return;
      var ciljVgrajenega = stanjeVgrajenega.actionSheetMode === "payment"
        ? stanjeVgrajenega
        : stanjeVgrajenega.lawyerWizard;
      if (!ciljVgrajenega) return;
      ciljVgrajenega[stanjeVgrajenega.actionSheetMode === "payment" ? "paymentNaturalInput" : "historyNaturalInput"] = {
        engineVersion: ATENA_ENGINE_VERSION,
        contractVersion: HISTORY_CONTRACT_VERSION,
        mode: naravni.mode,
        text: naravni.text,
        requestId: naravni.requestId,
        candidates: naravni.candidates,
        phase: naravni.phase,
        questionIndex: naravni.questionIndex,
        questionKeys: naravni.questionKeys,
        questionPlan: naravni.questionPlan,
        lunaReport: naravni.lunaReport,
        lunaReason: naravni.lunaReason,
        clarificationQuestion: naravni.clarificationQuestion,
        clarificationClauseId: naravni.clarificationClauseId,
        clarificationAnswer: naravni.clarificationAnswer,
        clarificationRound: naravni.clarificationRound,
        clarificationExhausted: naravni.clarificationExhausted,
        editCandidate: naravni.editCandidate,
        replacement: naravni.replacement,
      };
      return;
    }
    sessionStorage.setItem(KLJUC_ZGODOVINA, JSON.stringify({
      potrjena: potrjena === true,
      dogodki: debug.state.nacrtKoraki || [],
      settlementSettings: debug.state.settlementSettings || {},
      settingsByAction: debug.state.settingsByAction || {},
      drugoOsnutek: customDraft,
      naravniVnos: {
        engineVersion: ATENA_ENGINE_VERSION,
        contractVersion: HISTORY_CONTRACT_VERSION,
        mode: naravni.mode,
        text: naravni.text,
        requestId: naravni.requestId,
        candidates: naravni.candidates,
        phase: naravni.phase,
        questionIndex: naravni.questionIndex,
        questionKeys: naravni.questionKeys,
        questionPlan: naravni.questionPlan,
        lunaReport: naravni.lunaReport,
        lunaReason: naravni.lunaReason,
        clarificationQuestion: naravni.clarificationQuestion,
        clarificationClauseId: naravni.clarificationClauseId,
        clarificationAnswer: naravni.clarificationAnswer,
        clarificationRound: naravni.clarificationRound,
        clarificationExhausted: naravni.clarificationExhausted,
        questionGrouping: "candidate-engine-v1",
        editCandidate: naravni.editCandidate,
        replacement: naravni.replacement,
      },
      preostaliZnesek: Math.max(0, Number(korak1.znesek) - (debug.state.nacrtKoraki || []).reduce(function (vsota, korak) {
        return vsota + (Number(korak.znesek) || 0);
      }, 0)),
    }));
  }

  var K = window.UJIzvedbaKomponente;
  var KANDIDAT_META = {
    partial_payment: { naslov: "Delno plačilo", razred: "delno", ikona: "cardDown" },
    paid_in_full: { naslov: "Plačano v celoti", razred: "placano-v-celoti", ikona: "receiptCheck" },
    installment_payment: { naslov: "Plačan obrok", razred: "obrok", ikona: "calendar" },
    unpaid_installment: { naslov: "Neplačan obrok", razred: "neplacan-obrok", ikona: "clock" },
    remaining_unpaid: { naslov: "Preostanek ni plačan", razred: "preostanek", ikona: "clock" },
    installment_agreement: { naslov: "Dogovor o obrokih", razred: "dogovor-obroki", ikona: "calendarArrow" },
    payment_promise: { naslov: "Obljuba plačila", razred: "akcija-obljuba", ikona: "handshake" },
    deadline_extension: { naslov: "Nov rok plačila", razred: "podaljsanje", ikona: "calendarArrow" },
    payment_failed: { naslov: "Plačilo ni uspelo", razred: "neuspesno-placilo", ikona: "warning" },
    invoice_dispute: { naslov: "Ugovor / reklamacija", razred: "ugovor", ikona: "messageX" },
    insolvency: { naslov: "Stečaj / insolventnost", razred: "insolventnost", ikona: "shield" },
    credit_note: { naslov: "Dobropis / nota", razred: "dobropis", ikona: "documentMinus" },
    compensation: { naslov: "Kompenzacija (pobot)", razred: "kompenzacija", ikona: "scales" },
    cancelled_invoice: { naslov: "Odpis / storno", razred: "storno", ikona: "xCircle" },
    reminder_sent: { naslov: "Poslan opomin", razred: "akcija-opomin", ikona: "receiptCheck" },
    debtor_statement: { naslov: "Ugovor / zavrnitev", razred: "izjava", ikona: "messageX" },
    custom: { naslov: "Drugo / opiši sam", razred: "drugo", ikona: "pencil" },
  };

  function predmetObljube(kandidat) {
    if (!kandidat || kandidat.type !== "payment_promise") return "";
    var opis = String(kandidat.description || "").toLowerCase();
    if (opis.indexOf("dobropis") >= 0) return "dobropis";
    if (opis.indexOf("pobot") >= 0) return "pobot";
    if (opis.indexOf("storno") >= 0) return "storno";
    return "";
  }

  function metaKandidata(kandidat) {
    var meta = KANDIDAT_META[kandidat && kandidat.type] || KANDIDAT_META.custom;
    var predmet = predmetObljube(kandidat);
    if (!predmet) return meta;
    return Object.assign({}, meta, { naslov: predmet === "dobropis" ? "Obljuba dobropisa" : predmet === "pobot" ? "Obljuba pobota" : "Obljuba storna računa" });
  }

  function novRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return "history:" + window.crypto.randomUUID();
    return "history:" + Date.now().toString(36) + ":" + Math.random().toString(36).slice(2);
  }

  function zagotoviKandidatId(kandidat) {
    if (!kandidat || kandidat.candidateId) return kandidat && kandidat.candidateId;
    kandidat.candidateId = "history-draft:" + (window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : Date.now().toString(36) + ":" + Math.random().toString(36).slice(2));
    return kandidat.candidateId;
  }

  function najdiIzvorniIndeksZamenjave() {
    if (!naravni.replacement) return -1;
    if (replacementState && typeof replacementState.najdiIndeks === "function") {
      return replacementState.najdiIndeks(naravni.candidates, naravni.replacement);
    }
    var poId = naravni.candidates.findIndex(function (kandidat) {
      return kandidat && kandidat.candidateId === naravni.replacement.sourceCandidateId;
    });
    if (poId >= 0) return poId;
    var indeks = Number(naravni.replacement.sourceIndex);
    return Number.isInteger(indeks) && indeks >= 0 && indeks < naravni.candidates.length ? indeks : -1;
  }

  function zacniZamenjavo(indeks) {
    var kandidat = naravni.candidates[indeks];
    if (!kandidat) return;
    var kandidatId = zagotoviKandidatId(kandidat);
    naravni.replacement = {
      active: true,
      sourceCandidateId: kandidatId,
      sourceIndex: indeks,
      returnPhase: naravni.phase,
      returnQuestionIndex: naravni.questionIndex,
      returnEditCandidate: naravni.editCandidate,
      selectedSettlementType: null,
    };
    naravni.mode = "manual";
    naravni.editCandidate = null;
    customActive = false;
    ocenaActive = false;
    state.selectedSettlementType = null;
    if (canary && canary.isRecording()) canary.stop().catch(function () {});
    try {
      history.pushState(Object.assign({}, history.state || {}, { ujZgodovinaReplacement: true }), "");
    } catch (_napaka) {}
    shrani(false);
    debug.izrisiActionSheet();
  }

  function prekliciZamenjavo(uporabiZgodovino) {
    if (!naravni.replacement) return;
    if (uporabiZgodovino && history.state && history.state.ujZgodovinaReplacement === true) {
      history.back();
      return;
    }
    var vrnitev = naravni.replacement;
    naravni.replacement = null;
    naravni.mode = "natural";
    naravni.phase = ["input", "questions", "review"].indexOf(vrnitev.returnPhase) >= 0 ? vrnitev.returnPhase : "questions";
    naravni.questionIndex = Math.max(0, Math.min(Number(vrnitev.returnQuestionIndex) || 0, Math.max(0, naravni.questionKeys.length - 1)));
    naravni.editCandidate = Number.isInteger(vrnitev.returnEditCandidate) ? vrnitev.returnEditCandidate : null;
    state.selectedSettlementType = null;
    state.error = null;
    shrani(false);
    debug.izrisiActionSheet();
  }

  function kandidatniOsnutekZaZamenjavo(uiTip, izvorniIndeks) {
    var tip = {
      partial: "partial_payment",
      full: "paid_in_full",
      installment: "installment_payment",
      unpaid_installment: "unpaid_installment",
      payment_promised: "payment_promise",
      payment_failed: "payment_failed",
      invoice_dispute: "invoice_dispute",
      insolvency: "insolvency",
      credit_note: "credit_note",
      compensation: "compensation",
      cancelled_invoice: "cancelled_invoice",
    }[uiTip];
    if (!tip) return null;
    var kandidat = {
      type: tip,
      amount: tip === "paid_in_full" ? saldoPredKandidatom(naravni.candidates[izvorniIndeks]) : null,
      occurredDate: null,
      occurredDateUnknown: false,
      occurredDateApproximate: false,
      occurredDateApproximation: "",
      promisedDate: null,
      promisedDateUnknown: false,
      promisedDateApproximate: false,
      promisedDateApproximation: "",
      paymentMethod: null,
      communicationChannel: null,
      reason: null,
      description: tip === "unpaid_installment" ? "Neplačan obrok" : null,
      dateRelation: null,
    };
    kandidat.fieldOrder = poljaKandidata(kandidat);
    kandidat.requiredFields = kandidat.fieldOrder.filter(function (polje) {
      return !(tip === "payment_promise" && polje === "amount");
    });
    kandidat.missing = poljaKiManjkajo(kandidat);
    return kandidat;
  }

  function potrdiZamenjavo() {
    var izvorniIndeks = najdiIzvorniIndeksZamenjave();
    if (izvorniIndeks < 0) {
      state.error = "Izvornega koraka ni več mogoče varno zamenjati.";
      debug.izrisiActionSheet();
      return;
    }
    var prejsnjiKljuciVprasanj = naravni.questionKeys.slice();
    var vrnitevNaVprasanje = Math.max(0, Number(naravni.replacement.returnQuestionIndex) || 0);
    var novi = kandidatniOsnutekZaZamenjavo(state.selectedSettlementType, izvorniIndeks);
    if (!novi) {
      state.error = "Najprej izberite vrsto dogodka.";
      debug.izrisiActionSheet();
      return;
    }
    zagotoviKandidatId(naravni.candidates[izvorniIndeks]);
    var zamenjano = replacementState && typeof replacementState.zamenjajNaMestu === "function"
      ? replacementState.zamenjajNaMestu(naravni.candidates, naravni.replacement, novi)
      : null;
    if (!zamenjano || zamenjano.ok !== true) {
      state.error = "Izvornega koraka ni več mogoče varno zamenjati.";
      debug.izrisiActionSheet();
      return;
    }
    izvorniIndeks = zamenjano.index;
    dopolniRelativneDatume(naravni.candidates);
    dopolniIzracunaniNeplacaniObrok(naravni.candidates);
    novi.missing = poljaKiManjkajo(novi);
    var indeksVprasanja = prejsnjiKljuciVprasanj.findIndex(function (kljuc) {
      return razcleniKljucVprasanja(kljuc).indeks === izvorniIndeks;
    });
    if (indeksVprasanja >= 0) {
      prejsnjiKljuciVprasanj[indeksVprasanja] = kljucVprasanja(izvorniIndeks, poljaKandidata(novi));
      naravni.questionKeys = prejsnjiKljuciVprasanj;
    } else {
      naravni.questionKeys = manjkajocaVprasanja();
      indeksVprasanja = naravni.questionKeys.findIndex(function (kljuc) {
        return razcleniKljucVprasanja(kljuc).indeks === izvorniIndeks;
      });
    }
    naravni.questionIndex = indeksVprasanja >= 0
      ? indeksVprasanja
      : Math.min(vrnitevNaVprasanje, Math.max(0, naravni.questionKeys.length - 1));
    naravni.questionPlan = naravni.candidates.map(function (kandidat, indeks) {
      var manjka = poljaKiManjkajo(kandidat);
      return { candidateIndex: indeks, fields: poljaKandidata(kandidat), missing: manjka.slice() };
    });
    naravni.phase = naravni.questionKeys.length ? "questions" : "review";
    naravni.mode = "natural";
    naravni.editCandidate = null;
    naravni.replacement = null;
    state.selectedSettlementType = null;
    state.error = null;
    naravni.status = "ready";
    naravni.statusText = "Korak je zamenjan. Preverite posodobljene dogodke.";
    try {
      if (history.state && history.state.ujZgodovinaReplacement === true) {
        history.replaceState(Object.assign({}, history.state, { ujZgodovinaReplacement: false }), "");
      }
    } catch (_napaka) {}
    shrani(false);
    debug.izrisiActionSheet();
  }

  function preostaliDolg() {
    return Math.max(0, Number(korak1.znesek) - (debug.state.nacrtKoraki || []).reduce(function (vsota, korak) {
      return vsota + (Number(korak.znesek) || 0);
    }, 0));
  }

  function opozoriloPrevisokihPlacil(opis) {
    if (!preverjanjeZneskov || typeof preverjanjeZneskov.oceni !== "function") return null;
    var rezultat = preverjanjeZneskov.oceni(opis, preostaliDolg());
    if (!rezultat.presega) return null;
    function formatiraj(vrednost) {
      var deli = Number(vrednost || 0).toFixed(2).split(".");
      return deli[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + deli[1] + " €";
    }
    return {
      vsota: rezultat.vsota,
      sporocilo: "Opisani plačani zneski (" + formatiraj(rezultat.vsota) + ") presegajo preostali dolg (" + formatiraj(rezultat.dolg) + "). Uredite opis.",
    };
  }

  function posodobiOpozoriloPrevisokihPlacil(root) {
    var opozorilo = opozoriloPrevisokihPlacil(naravni.text);
    var prikaz = root && root.querySelector("[data-ai-debt-warning]");
    if (prikaz) {
      prikaz.hidden = !opozorilo;
      prikaz.textContent = opozorilo ? opozorilo.sporocilo : "";
    }
    var analyze = root && root.querySelector("[data-ai-analyze]");
    if (analyze) analyze.disabled = !naravni.text.trim() || Boolean(opozorilo) || naravni.status === "analyzing";
    return opozorilo;
  }

  function dopolniIzracunaniNeplacaniObrok(kandidati) {
    var preostanek = preostaliDolg();
    (kandidati || []).forEach(function (kandidat) {
      if (["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation"].indexOf(kandidat.type) >= 0) {
        var placano = Number(kandidat.amount);
        if (Number.isFinite(placano) && placano > 0) preostanek = Math.max(0, Math.round((preostanek - placano) * 100) / 100);
        return;
      }
      if (kandidat.type === "unpaid_installment" || kandidat.type === "remaining_unpaid") {
        kandidat.amount = preostanek > 0 ? preostanek : null;
        kandidat.amountCalculated = true;
      }
    });
  }

  function veljavenIsoDatum(vrednost) {
    var iso = String(vrednost || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var deli = iso.split("-").map(Number);
    var datum = new Date(Date.UTC(deli[0], deli[1] - 1, deli[2]));
    return datum.getUTCFullYear() === deli[0] && datum.getUTCMonth() === deli[1] - 1 && datum.getUTCDate() === deli[2];
  }

  function premakniIsoDatum(iso, dni) {
    if (!veljavenIsoDatum(iso) || !Number.isInteger(dni)) return null;
    var deli = iso.split("-").map(Number);
    var datum = new Date(Date.UTC(deli[0], deli[1] - 1, deli[2] + dni));
    return datum.toISOString().slice(0, 10);
  }

  function steviloTednov(vrednost) {
    var besede = { en: 1, ena: 1, eno: 1, prvem: 1, enem: 1, dva: 2, dve: 2, drugem: 2, tri: 3, tretjem: 3, štiri: 4, četrtem: 4 };
    var stevilo = Object.prototype.hasOwnProperty.call(besede, vrednost) ? besede[vrednost] : Number(vrednost);
    return Number.isInteger(stevilo) && stevilo >= 1 && stevilo <= 52 ? stevilo : null;
  }

  function datumPoTednih(iso, vrednost) {
    var tedni = steviloTednov(vrednost);
    return tedni == null ? null : premakniIsoDatum(iso, tedni * 7);
  }

  function lokalniDatumPlacila(text) {
    var opis = String(text || "").toLowerCase();
    var izdaja = veljavenIsoDatum(korak1.datumIzdajeRacuna) ? korak1.datumIzdajeRacuna : null;
    var zapadlost = veljavenIsoDatum(korak1.datumZapadlosti) ? korak1.datumZapadlosti : null;
    var ujemanje = opis.match(/\bpo\s+(prvem|enem|drugem|tretjem|četrtem|\d+)\s+tedn(?:u|ih)\b/i);
    if (izdaja && ujemanje) return datumPoTednih(izdaja, ujemanje[1]);
    ujemanje = opis.match(/\b(\d+|en|ena|eno|dva|dve|tri|štiri)\s+ted(?:en|na|ne|nov)\s+po\s+(?:izdaji|izstavitvi|datumu\s+izdaje)\b/i);
    if (izdaja && ujemanje) return datumPoTednih(izdaja, ujemanje[1]);
    ujemanje = opis.match(/\b(\d+|en|ena|eno|dva|dve|tri|štiri)\s+ted(?:en|na|ne|nov)\s+po\s+(?:roku(?:\s+plačila)?|zapadlosti)\b/i);
    if (zapadlost && ujemanje) return datumPoTednih(zapadlost, ujemanje[1]);
    return null;
  }

  function dopolniLokalniDatumPlacila(text, kandidati) {
    var datum = lokalniDatumPlacila(text);
    if (!datum) return;
    (kandidati || []).some(function (kandidat) {
      if (["partial_payment", "installment_payment", "paid_in_full"].indexOf(kandidat.type) < 0 || veljavenIsoDatum(kandidat.occurredDate)) return false;
      kandidat.occurredDate = datum;
      kandidat.occurredDateUnknown = false;
      kandidat.missing = Array.isArray(kandidat.missing) ? kandidat.missing.filter(function (polje) { return polje !== "occurredDate"; }) : [];
      return true;
    });
  }

  function dopolniRelativneDatume(kandidati) {
    if (!relativniDatumi || typeof relativniDatumi.razresiDatume !== "function") return false;
    var changed = relativniDatumi.razresiDatume(kandidati || []);
    (kandidati || []).forEach(function (kandidat) { kandidat.missing = poljaKiManjkajo(kandidat); });
    naravni.questionPlan = (kandidati || []).map(function (kandidat, indeks) {
      return { candidateIndex: indeks, fields: poljaKandidata(kandidat), missing: kandidat.missing.slice() };
    });
    return changed;
  }

  function najpoznejsiDatumKandidata(kandidat) {
    if (!relativniDatumi || typeof relativniDatumi.najpoznejsiDatumZaKandidata !== "function") return lokalniDanesIso();
    return relativniDatumi.najpoznejsiDatumZaKandidata(naravni.candidates, kandidat, lokalniDanesIso()) || lokalniDanesIso();
  }

  function poljaKiManjkajo(kandidat) {
    var zahtevana = Array.isArray(kandidat.requiredFields) && kandidat.requiredFields.length
      ? kandidat.requiredFields
      : poljaKandidata(kandidat).filter(function (polje) { return !(kandidat.type === "payment_promise" && polje === "amount"); });
    if (kandidat.type === "remaining_unpaid") zahtevana = zahtevana.filter(function (polje) { return polje !== "amount"; });
    return zahtevana.filter(function (polje) { return !poljeKandidataPrisotno(kandidat, polje); });
  }

  function jePlacilniDogodek(kandidat) {
    return Boolean(kandidat && ["partial_payment", "installment_payment", "paid_in_full"].indexOf(kandidat.type) >= 0);
  }

  function jeIzrecnoDokazanZnesek(kandidat, znesek) {
    var dokaz = kandidat && kandidat.evidence;
    return Boolean(dokaz && dokaz.explicit === true && Number(dokaz.explicitAmountEur) === Number(znesek));
  }

  function podedujNacinPlacilaNaslednjimPlacilom(kandidat, indeks, vrednost) {
    if (!jePlacilniDogodek(kandidat)) return;
    var nacin = String(vrednost || "").trim();
    for (var i = indeks + 1; i < naravni.candidates.length; i += 1) {
      var naslednji = naravni.candidates[i];
      if (!jePlacilniDogodek(naslednji)) continue;
      var jePodedovan = naslednji.paymentMethodInheritedFrom != null;
      if (!jePodedovan && String(naslednji.paymentMethod || "").trim()) break;
      naslednji.paymentMethod = nacin || null;
      if (nacin) naslednji.paymentMethodInheritedFrom = indeks;
      else delete naslednji.paymentMethodInheritedFrom;
      naslednji.missing = poljaKiManjkajo(naslednji);
    }
  }

  function saldoPredKandidatom(kandidat) {
    var saldo = preostaliDolg();
    for (var i = 0; i < naravni.candidates.length; i += 1) {
      var item = naravni.candidates[i];
      if (item === kandidat) break;
      if (["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation"].indexOf(item.type) < 0) continue;
      var znesek = Number(item.amount);
      if (Number.isFinite(znesek) && znesek > 0 && (znesek <= saldo + 0.009 || jeIzrecnoDokazanZnesek(item, znesek))) saldo = Math.max(0, Math.round((saldo - znesek) * 100) / 100);
    }
    return saldo;
  }

  function poljeKandidataPrisotno(kandidat, polje) {
    if (polje === "amount") {
      var znesek = Number(kandidat.amount);
      var saldo = saldoPredKandidatom(kandidat);
      if (!Number.isFinite(znesek) || znesek <= 0 || (znesek > saldo + 0.009 && !jeIzrecnoDokazanZnesek(kandidat, znesek))) return false;
      return kandidat.type !== "paid_in_full" || Math.abs(znesek - saldo) <= 0.009;
    }
    if (polje === "occurredDate" || polje === "promisedDate") {
      var jePriblizenDatum = kandidat[polje + "Approximate"] === true && Boolean(String(kandidat[polje + "Approximation"] || "").trim());
      var datum = kandidat[polje];
      var jeVeljavenDatum = veljavenIsoDatum(datum) && (polje !== "occurredDate" || datum <= najpoznejsiDatumKandidata(kandidat));
      return kandidat[polje + "Unknown"] === true || jeVeljavenDatum || jePriblizenDatum;
    }
    return Boolean(String(kandidat[polje] || "").trim());
  }

  function vsiKandidatiDopolnjeni() {
    return naravni.candidates.length > 0 && naravni.candidates.every(function (kandidat) {
      return poljaKiManjkajo(kandidat).length === 0;
    });
  }

  function poljaKandidata(kandidat) {
    var dovoljena = ["amount", "occurredDate", "promisedDate", "paymentMethod", "communicationChannel", "reason", "description"];
    if (kandidat.type === "remaining_unpaid") {
      return Array.isArray(kandidat.fieldOrder)
        ? kandidat.fieldOrder.filter(function (polje, indeks, vsa) { return polje !== "amount" && dovoljena.indexOf(polje) >= 0 && vsa.indexOf(polje) === indeks; })
        : [];
    }
    if (Array.isArray(kandidat.fieldOrder) && kandidat.fieldOrder.length) {
      var pogodba = kandidat.fieldOrder.filter(function (polje, indeks, vsa) { return dovoljena.indexOf(polje) >= 0 && vsa.indexOf(polje) === indeks; });
      if (pogodba.length) return predmetObljube(kandidat) ? pogodba.filter(function (polje) { return polje !== "amount"; }) : pogodba;
    }
    if (["partial_payment", "paid_in_full", "installment_payment"].indexOf(kandidat.type) >= 0) return ["amount", "occurredDate", "paymentMethod"];
    if (kandidat.type === "unpaid_installment") return ["occurredDate"];
    if (kandidat.type === "installment_agreement" || kandidat.type === "insolvency") return ["occurredDate", "description"];
    if (kandidat.type === "payment_promise") return ["amount", "occurredDate", "promisedDate", "communicationChannel"];
    if (kandidat.type === "deadline_extension") return ["occurredDate", "promisedDate", "communicationChannel", "description"];
    if (kandidat.type === "payment_failed") return ["occurredDate", "paymentMethod", "description"];
    if (kandidat.type === "invoice_dispute") return ["occurredDate", "communicationChannel", "description"];
    if (["credit_note", "compensation"].indexOf(kandidat.type) >= 0) return ["amount", "occurredDate"];
    if (kandidat.type === "cancelled_invoice") return ["occurredDate", "reason"];
    if (kandidat.type === "debtor_statement") return ["occurredDate", "communicationChannel", "description"];
    if (kandidat.type === "reminder_sent") return ["occurredDate", "communicationChannel"];
    return ["occurredDate", "description"];
  }

  function kljucVprasanja(indeks, polja) { return indeks + ":" + (Array.isArray(polja) ? polja.join(",") : polja); }

  function razcleniKljucVprasanja(kljuc) {
    var deli = String(kljuc || "").split(":");
    var polja = String(deli[1] || "").split(",").filter(Boolean);
    return { indeks: Number(deli[0]), polje: polja[0] || "", polja: polja };
  }

  function normalizirajKljuciVprasanj(kljuci) {
    return (kljuci || []).reduce(function (rezultat, kljuc) {
      var podatki = razcleniKljucVprasanja(kljuc);
      var kandidat = naravni.candidates[podatki.indeks];
      if (!kandidat) return rezultat;
      var dovoljenaPolja = poljaKandidata(kandidat);
      var polja = podatki.polja.filter(function (polje) { return dovoljenaPolja.indexOf(polje) >= 0; });
      if (polja.length) rezultat.push(kljucVprasanja(podatki.indeks, polja));
      return rezultat;
    }, []);
  }

  function manjkajocaVprasanja() {
    var kljuci = [];
    naravni.candidates.forEach(function (kandidat, indeks) {
      var polja = poljaKandidata(kandidat);
      if (polja.length) kljuci.push(kljucVprasanja(indeks, polja));
    });
    return kljuci;
  }

  function vsaVprasanjaKandidata(indeks) {
    var kandidat = naravni.candidates[indeks];
    var polja = kandidat ? poljaKandidata(kandidat) : [];
    return polja.length ? [kljucVprasanja(indeks, polja)] : [];
  }

  function kandidatZaporedje(indeks) {
    var kandidat = naravni.candidates[indeks];
    if (!kandidat) return "";
    var enaki = naravni.candidates.filter(function (item) { return item.type === kandidat.type; });
    if (enaki.length < 2) return "";
    var zaporedje = 0;
    for (var i = 0; i <= indeks; i += 1) if (naravni.candidates[i].type === kandidat.type) zaporedje += 1;
    return String(zaporedje);
  }

  function oznakaObroka(kandidat, indeks) {
    var opis = String(kandidat && kandidat.description || "").trim();
    if (/^\d+\/\d+\s+obrok$/u.test(opis)) return opis;
    var zaporedje = kandidatZaporedje(indeks);
    return zaporedje ? zaporedje + ". obrok" : "";
  }

  function imeDogodka(kandidat, indeks) {
    var oznaka = oznakaObroka(kandidat, indeks);
    if (kandidat.type === "installment_payment" && oznaka) return oznaka;
    if (kandidat.type === "unpaid_installment" && kandidat.description) return kandidat.description;
    return metaKandidata(kandidat).naslov.toLowerCase();
  }

  function jePoljeIzpolnjeno(kandidat, polje) {
    if (!kandidat) return false;
    if (polje === "amount") return Number(kandidat.amount) > 0;
    if (polje === "occurredDate" || polje === "promisedDate") return /^\d{4}-\d{2}-\d{2}$/.test(String(kandidat[polje] || "")) || kandidat[polje + "Unknown"] === true || (kandidat[polje + "Approximate"] === true && Boolean(String(kandidat[polje + "Approximation"] || "").trim()));
    return Boolean(String(kandidat[polje] || "").trim());
  }

  function aktivnoVprasanjeIzpolnjeno() {
    var podatki = razcleniKljucVprasanja(naravni.questionKeys[naravni.questionIndex]);
    var kandidat = naravni.candidates[podatki.indeks];
    return podatki.polja.length > 0 && poljaKiManjkajo(kandidat).length === 0;
  }

  function vprasanjeIzpolnjeno(indeks) {
    var podatki = razcleniKljucVprasanja(naravni.questionKeys[indeks]);
    var kandidat = naravni.candidates[podatki.indeks];
    return podatki.polja.length > 0 && podatki.polja.every(function (polje) {
      return jePoljeIzpolnjeno(kandidat, polje);
    });
  }

  function vprasanjeBesedilo(kandidat, indeks, polje) {
    var dogodek = imeDogodka(kandidat, indeks);
    if (polje === "amount") return kandidat.type === "installment_payment" ? "Kolikšen je bil " + dogodek + "?" : kandidat.type === "paid_in_full" ? "Kolikšen je bil celotni plačani znesek?" : kandidat.type === "payment_promise" ? "Kolikšen znesek je obljubil plačati?" : "Kolikšen znesek je bil plačan?";
    if (polje === "occurredDate") {
      if (["partial_payment", "installment_payment"].indexOf(kandidat.type) >= 0) return "Kdaj je plačal" + (kandidat.type === "installment_payment" ? " " + dogodek : "") + "?";
      if (kandidat.type === "unpaid_installment") return "Kdaj bi moral biti ta obrok plačan?";
      if (kandidat.type === "remaining_unpaid") return "Kdaj ste ga zaradi neplačanega preostanka kontaktirali?";
      if (kandidat.type === "debtor_statement") return "Kdaj je dolžnik to povedal?";
      if (kandidat.type === "invoice_dispute") return "Kdaj je dolžnik ugovarjal?";
      if (kandidat.type === "deadline_extension") return "Kdaj je bil predlagan ali odobren novi rok?";
      if (kandidat.type === "payment_failed") return "Kdaj plačilo ni uspelo?";
      if (kandidat.type === "installment_agreement") return "Kdaj ste se dogovorili za obroke?";
      if (kandidat.type === "insolvency") return "Kdaj ste izvedeli za postopek?";
      if (kandidat.type === "payment_promise") return "Kdaj je dolžnik dal obljubo?";
      if (kandidat.type === "reminder_sent") return "Kdaj ste poslali opomin?";
      return "Kdaj se je zgodil ta dogodek?";
    }
    if (polje === "paymentMethod") return "Kako je plačal" + (kandidat.type === "installment_payment" ? " " + dogodek : "") + "?";
    if (polje === "promisedDate") return kandidat.type === "deadline_extension" ? "Kateri je novi rok plačila?" : predmetObljube(kandidat) ? "Do kdaj je obljubil izpolnitev?" : "Do kdaj je obljubil plačilo?";
    if (polje === "communicationChannel") return kandidat.type === "reminder_sent" ? "Kako ste poslali opomin?" : kandidat.type === "remaining_unpaid" ? "Kako ste ga kontaktirali?" : "Kako je to sporočil?";
    if (polje === "reason") return "Zakaj je bil račun odpisan ali storniran?";
    if (polje === "description" && kandidat.type === "debtor_statement") return "Kaj natančno je dolžnik povedal?";
    if (polje === "description" && kandidat.type === "remaining_unpaid") return "Kaj vam je povedal oziroma odgovoril?";
    if (polje === "description" && kandidat.type === "invoice_dispute") return "Čemu dolžnik ugovarja?";
    if (polje === "description" && kandidat.type === "payment_failed") return "Zakaj plačilo ni uspelo?";
    if (polje === "description" && kandidat.type === "installment_agreement") return "Kako ste se dogovorili za obroke?";
    if (polje === "description" && kandidat.type === "insolvency") return "Za kateri postopek gre?";
    return "Kaj se je zgodilo?";
  }

  function oznakaVprasanjaHtml(kandidat, indeks, polje, dodatnoHtml) {
    var priblizniDatum = (polje === "occurredDate" || polje === "promisedDate") && kandidat[polje + "Approximate"] === true;
    return '<span class="zgodovina-ai-vprasanje__oznaka-vrstica"><span class="zgodovina-ai-vprasanje__oznaka">' + esc(vprasanjeBesedilo(kandidat, indeks, polje)) + (dodatnoHtml || '') + '</span>' +
      (priblizniDatum ? '<span class="zgodovina-ai-vprasanje__datum-namig">Za točen datum izklopite Približno.</span>' : '') + '</span>';
  }

  function izbiraVprasanjaHtml(kandidat, indeks, polje, praznoBesedilo, moznosti) {
    var vrednost = String(kandidat && kandidat[polje] || "");
    var izbrana = moznosti.find(function (moznost) { return moznost.value === vrednost; });
    var prilagodiBesedilo = jePlacilniDogodek(kandidat) && polje === "paymentMethod" ? ' data-izvedba-fit data-fit-min="8"' : '';
    var seznamId = "zgodovina-izbira-" + indeks + "-" + polje;
    var gumbi = moznosti.map(function (moznost) {
      var aktivna = moznost.value === vrednost;
      return '<button type="button" role="option" data-ai-choice-option data-ai-choice-value="' + esc(moznost.value) + '" aria-selected="' + String(aktivna) + '" class="' + (aktivna ? "is-selected" : "") + '"><span>' + esc(moznost.label) + '</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3 3 7-7"/></svg></button>';
    }).join("");
    return '<div class="zgodovina-ai-vprasanje__izbira" data-ai-choice>' +
      '<input class="zgodovina-ai-vprasanje__izbira-input" type="hidden" data-ai-candidate-field="' + polje + '" data-ai-candidate-index="' + indeks + '" value="' + esc(vrednost) + '">' +
      '<button type="button" class="zgodovina-ai-vprasanje__izbira-gumb" data-ai-choice-toggle aria-haspopup="listbox" aria-expanded="false" aria-controls="' + seznamId + '"><span' + prilagodiBesedilo + '>' + esc(izbrana ? izbrana.label : praznoBesedilo) + '</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg></button>' +
      '<div class="zgodovina-ai-vprasanje__izbira-seznam" id="' + seznamId + '" role="listbox" hidden>' + gumbi + '</div></div>';
  }

  function kontrolnikVprasanja(kandidat, indeks, polje) {
    var skupno = ' data-ai-candidate-field="' + polje + '" data-ai-candidate-index="' + indeks + '" data-izvedba-fit data-fit-min="10"';
    if (polje === "amount") {
      var najvec = jeIzrecnoDokazanZnesek(kandidat, kandidat.amount) ? Math.max(preostaliDolg(), Number(kandidat.amount)) : preostaliDolg();
      var znesek = '<span class="zgodovina-ai-vprasanje__znesek"><input type="number" inputmode="decimal" step="0.01" min="0.01" max="' + esc(najvec) + '"' + skupno + ' value="' + esc(kandidat.amount == null ? "" : kandidat.amount) + '" placeholder="Vnesite znesek"><b>€</b></span>';
      return kandidat.type === "payment_promise" ? '<div class="zgodovina-ai-vprasanje__znesek-vrstica">' + znesek + '<button type="button" data-ai-promise-remaining data-ai-candidate-index="' + indeks + '">Preostanek</button></div>' : znesek;
    }
    if (polje === "occurredDate" || polje === "promisedDate") {
      var jeNeznano = kandidat[polje + "Unknown"] === true;
      var jePriblizno = kandidat[polje + "Approximate"] === true;
      var datumInput = jeNeznano
        ? '<input type="text" data-ai-unknown-date-display' + skupno + ' value="Ne vem" disabled>'
        : jePriblizno
          ? '<input type="text" maxlength="120" data-ai-candidate-field="' + polje + 'Approximation" data-ai-candidate-index="' + indeks + '" data-izvedba-fit data-fit-min="10" value="' + esc(kandidat[polje + "Approximation"] || "") + '" placeholder="Npr. v začetku avgusta">'
          : '<input type="date"' + (polje === "occurredDate" ? ' max="' + esc(najpoznejsiDatumKandidata(kandidat)) + '"' : '') + skupno + ' value="' + esc(kandidat[polje] || "") + '">';
      return '<div class="zgodovina-ai-vprasanje__datum zgodovina-ai-vprasanje__datum--obljuba">' + datumInput + '<button type="button" data-ai-unknown-field="' + polje + '" data-ai-candidate-index="' + indeks + '" aria-pressed="' + String(jeNeznano) + '" class="' + (jeNeznano ? "is-selected" : "") + '">Ne vem</button><button type="button" data-ai-approximate-field="' + polje + '" data-ai-candidate-index="' + indeks + '" aria-pressed="' + String(jePriblizno) + '" class="' + (jePriblizno ? "is-selected" : "") + '">Približno</button></div>';
    }
    if (polje === "paymentMethod") return izbiraVprasanjaHtml(kandidat, indeks, polje, "Izberite način plačila", [{ value: "bank_transfer", label: "Bančno nakazilo" }, { value: "cash", label: "Gotovina" }, { value: "card", label: "Kartica" }, { value: "direct_debit", label: "Direktna obremenitev" }, { value: "other", label: "Drugo" }, { value: "unknown", label: "Ne vem" }]);
    if (polje === "communicationChannel") return izbiraVprasanjaHtml(kandidat, indeks, polje, "Izberite način komunikacije", [{ value: "phone", label: "Po telefonu" }, { value: "email", label: "Po e-pošti" }, { value: "sms", label: "SMS" }, { value: "in_person", label: "Osebno" }, { value: "letter", label: "Pisno pismo" }, { value: "other", label: "Drugo" }, { value: "unknown", label: "Ne vem" }]);
    return '<textarea maxlength="' + (polje === "reason" ? "300" : "500") + '"' + skupno + ' placeholder="Vpišite odgovor">' + esc(kandidat[polje] || "") + '</textarea>';
  }

  function napredekHtml(trenutni, skupaj) {
    var krogi = [];
    var indeksi = [];
    if (skupaj <= 8) for (var i = 0; i < skupaj; i += 1) indeksi.push(i);
    else {
      indeksi = [0];
      for (var j = Math.max(1, trenutni - 2); j <= Math.min(skupaj - 2, trenutni + 2); j += 1) if (indeksi.indexOf(j) < 0) indeksi.push(j);
      if (indeksi[indeksi.length - 1] !== skupaj - 1) indeksi.push(skupaj - 1);
    }
    indeksi.forEach(function (indeks, mesto) {
      if (mesto > 0 && indeks - indeksi[mesto - 1] > 1) krogi.push('<span class="is-gap" aria-hidden="true">…</span>');
      var podatkiKoraka = indeks < naravni.questionKeys.length ? razcleniKljucVprasanja(naravni.questionKeys[indeks]) : null;
      var kandidatKoraka = podatkiKoraka && naravni.candidates[podatkiKoraka.indeks];
      var tonKoraka = kandidatKoraka ? metaKandidata(kandidatKoraka).razred : "povzetek";
      var jePovzetek = indeks === naravni.questionKeys.length;
      var stanje = indeks === trenutni ? "current" : (!jePovzetek && indeks < trenutni && vprasanjeIzpolnjeno(indeks) ? "completed" : "upcoming");
      var oznaka = jePovzetek ? "Povzetek" : "Korak " + (indeks + 1);
      var opisStanja = stanje === "current" ? "trenutni" : stanje === "completed" ? "dokončan" : "prihodnji";
      var vsebinaKroga = jePovzetek ? K.ikona("thumbsUp") : String(indeks + 1);
      krogi.push('<button type="button" data-ai-question-step="' + indeks + '" class="is-tone-' + esc(tonKoraka) + ' is-' + stanje + '" aria-label="' + esc(oznaka + ", " + opisStanja) + '"' + (stanje === "current" ? ' aria-current="step"' : '') + '><span>' + vsebinaKroga + '</span></button>');
    });
    return '<div class="zgodovina-ai-napredek" aria-label="Korak ' + (trenutni + 1) + ' od ' + skupaj + '"><i aria-hidden="true"></i>' + krogi.join("") + '</div>';
  }

  function formatirajDatumVnosa(vrednost) {
    var match = String(vrednost || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? Number(match[3]) + ". " + Number(match[2]) + ". " + match[1] : "datum ni določen";
  }

  function predvideniPreostaliDolgZaKandidate(kandidati) {
    if (replacementState && typeof replacementState.saldoPoKandidatih === "function") {
      return replacementState.saldoPoKandidatih(preostaliDolg(), kandidati);
    }
    return Math.max(0, Math.round((kandidati || []).reduce(function (preostanek, kandidat) {
      if (["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation"].indexOf(kandidat.type) < 0) return preostanek;
      var placano = Number(kandidat.amount);
      return Number.isFinite(placano) && placano > 0 ? preostanek - placano : preostanek;
    }, preostaliDolg()) * 100) / 100);
  }

  function predvideniPreostaliDolg() {
    return predvideniPreostaliDolgZaKandidate(naravni.candidates);
  }

  function predvideniPreostaliDolgAktivnegaKoraka() {
    if (naravni.phase !== "questions") return predvideniPreostaliDolg();
    var podatki = razcleniKljucVprasanja(naravni.questionKeys[naravni.questionIndex]);
    if (!Number.isInteger(podatki.indeks) || podatki.indeks < 0) return preostaliDolg();
    return predvideniPreostaliDolgZaKandidate(naravni.candidates.slice(0, podatki.indeks + 1));
  }

  function stanjeDolgaNapredekHtml() {
    function formatiraj(vrednost) {
      var deli = Number(vrednost || 0).toFixed(2).split(".");
      return deli[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + deli[1] + " €";
    }
    return '<div class="zgodovina-ai-stanje-dolga" aria-label="Originalni in preostali znesek">' +
      '<div class="zgodovina-ai-stanje-dolga__stolpec"><span>Originalni znesek</span><strong data-izvedba-fit data-fit-min="9">' + esc(formatiraj(korak1.znesek)) + '</strong></div>' +
      '<i aria-hidden="true"></i>' +
      '<div class="zgodovina-ai-stanje-dolga__stolpec zgodovina-ai-stanje-dolga__stolpec--preostanek"><span>Preostali znesek</span><strong data-ai-remaining-debt data-izvedba-fit data-fit-min="9">' + esc(formatiraj(predvideniPreostaliDolgAktivnegaKoraka())) + '</strong></div>' +
    '</div>';
  }

  function posodobiPrikazPreostalegaDolga(root) {
    var saldoKoraka = root && root.querySelector("[data-ai-remaining-debt]");
    if (saldoKoraka) saldoKoraka.textContent = K.formatirajEur(predvideniPreostaliDolgAktivnegaKoraka());
    var vrednost = root && root.querySelector(".zgodovina-stanje-dolga .izvedba-potek-zneski__stolpec--preostanek .izvedba-potek-zneski__vrednost");
    if (!vrednost) return;
    var znesek = naravni.mode === "natural" && naravni.candidates.length
      ? predvideniPreostaliDolg()
      : preostaliDolg();
    vrednost.textContent = K.formatirajEur(znesek);
  }

  function preostanekPovzetekHtml() {
    var vsota = predvideniPreostaliDolg().toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return '<article class="zgodovina-ai-povzetek zgodovina-ai-povzetek--neplacan-obrok zgodovina-ai-povzetek--preostali-dolg" aria-label="Preostali dolg po teh dogodkih"><span aria-hidden="true">' + K.ikona("clock") + '</span><div><strong>Preostali dolg</strong><p><b>Vsota: ' + esc(vsota) + ' €</b></p></div></article>';
  }

  function povzetekKandidata(kandidat, indeks) {
    var meta = metaKandidata(kandidat);
    var nacini = { bank_transfer: "bančno nakazilo", cash: "gotovina", card: "kartica", direct_debit: "direktna obremenitev", other: "drugo", unknown: "način ni znan" };
    var kanali = { phone: "telefon", email: "e-pošta", sms: "SMS", in_person: "osebno", letter: "pisno pismo", other: "drugo", unknown: "način komunikacije ni znan" };
    var deli = [];
    if (Number(kandidat.amount) > 0) deli.push(Number(kandidat.amount).toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €");
    if (kandidat.occurredDateApproximate === true && String(kandidat.occurredDateApproximation || "").trim()) deli.push(String(kandidat.occurredDateApproximation).trim());
    else if (kandidat.occurredDateUnknown === true) deli.push("datum ni znan");
    else if (kandidat.occurredDate) deli.push(formatirajDatumVnosa(kandidat.occurredDate));
    if (kandidat.paymentMethod) deli.push(nacini[kandidat.paymentMethod] || kandidat.paymentMethod);
    if (kandidat.promisedDateUnknown === true) deli.push("rok ni znan");
    else if (kandidat.promisedDate) deli.push("rok " + formatirajDatumVnosa(kandidat.promisedDate));
    if (kandidat.communicationChannel) deli.push(kanali[kandidat.communicationChannel] || kandidat.communicationChannel);
    if (kandidat.reason) deli.push(kandidat.reason);
    if (kandidat.description && kandidat.type !== "unpaid_installment" && !(kandidat.type === "installment_payment" && /^\d+\/\d+\s+obrok$/u.test(String(kandidat.description).trim()))) deli.push(kandidat.description);
    var naslov = kandidat.type === "installment_payment" && oznakaObroka(kandidat, indeks) ? oznakaObroka(kandidat, indeks) : kandidat.type === "unpaid_installment" && kandidat.description ? kandidat.description : meta.naslov;
    var odprto = naravni.editCandidate === indeks;
    return '<article class="zgodovina-ai-povzetek zgodovina-ai-povzetek--' + esc(meta.razred) + (odprto ? ' is-editing' : '') + '"><span aria-hidden="true">' + K.ikona(meta.ikona) + '</span><div><strong>' + esc(naslov) + '</strong><p>' + esc(deli.join(" · ")) + '</p></div>' +
      '<span class="zgodovina-ai-povzetek__akcije"><button type="button" data-ai-edit-candidate="' + indeks + '" aria-expanded="' + String(odprto) + '">' + (odprto ? 'Zapri' : 'Uredi') + '</button><button type="button" data-ai-candidate-remove="' + indeks + '" aria-label="Izbriši ' + esc(naslov) + '">×</button></span>' +
      (odprto ? kandidatPolja(kandidat, indeks) : '') + '</article>';
  }

  function pogovorVprasanjeHtml() {
    var podatki = razcleniKljucVprasanja(naravni.questionKeys[naravni.questionIndex]);
    var kandidat = naravni.candidates[podatki.indeks];
    if (!kandidat) return '';
    var meta = metaKandidata(kandidat);
    var skupaj = naravni.questionKeys.length + 1;
    var kompaktnoPlacilo = jePlacilniDogodek(kandidat);
    var poljaHtml = podatki.polja.map(function (polje) {
      var razredPolja = kompaktnoPlacilo && ["amount", "occurredDate", "paymentMethod"].indexOf(polje) >= 0 ? ' class="is-' + (polje === "occurredDate" ? "date" : polje === "paymentMethod" ? "payment-method" : "amount") + '"' : '';
      return '<label' + razredPolja + '>' + oznakaVprasanjaHtml(kandidat, podatki.indeks, polje) + kontrolnikVprasanja(kandidat, podatki.indeks, polje) + '</label>';
    }).join('');
    var naslednjiGumb = virUrejanje
      ? '<button type="button" data-ai-source-update' + (!virOsnutek.trim() || virOsnutek.trim() === naravni.text.trim() ? ' disabled' : '') + '>Posodobi</button>'
      : '<button type="button" data-ai-question-next' + (aktivnoVprasanjeIzpolnjeno() ? '' : ' disabled') + '>' + (naravni.questionIndex + 1 === naravni.questionKeys.length ? 'Pokaži povzetek' : 'Naprej') + '</button>';
    return '<div class="zgodovina-ai-pogovor zgodovina-ai-pogovor--' + esc(meta.razred) + '">' + virOpisHtml() + lunaPorociloHtml() + napredekHtml(naravni.questionIndex, skupaj) + stanjeDolgaNapredekHtml() +
      '<div class="zgodovina-ai-vprasanje zgodovina-ai-vprasanje--' + esc(meta.razred) + '"><button type="button" class="zgodovina-ai-vprasanje__odstrani" data-ai-candidate-remove="' + podatki.indeks + '" aria-label="Izbriši ' + esc(imeDogodka(kandidat, podatki.indeks)) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button><span class="zgodovina-ai-vprasanje__ikona" aria-hidden="true">' + K.ikona(meta.ikona) + '</span><div><h4>Dopolnite ' + esc(imeDogodka(kandidat, podatki.indeks)) + '</h4><p>Vsi manjkajoči podatki tega dogodka so združeni tukaj.</p></div><button type="button" class="zgodovina-ai-vprasanje__spremeni" data-ai-change-candidate aria-label="Spremeni vrsto dogodka">Spremeni</button><div class="zgodovina-ai-vprasanje__polja' + (kompaktnoPlacilo ? ' zgodovina-ai-vprasanje__polja--placilo-kompaktno' : '') + '">' + poljaHtml + '</div></div>' +
      '<div class="zgodovina-ai-pogovor__akcije"><button type="button" data-ai-edit-description>Spremeni opis</button>' + naslednjiGumb + '</div></div>';
  }

  function virOpisHtml() {
    var svincnik = '<span class="zgodovina-ai-pogovor__opis-svincnik" aria-hidden="true">' + K.ikona("pencil") + '</span>';
    if (virUrejanje) {
      return '<label class="zgodovina-ai-pogovor__opis zgodovina-ai-pogovor__opis--urejanje"><span class="sr-only">Popravite opis dogodkov</span><textarea maxlength="2000" data-ai-source-edit aria-label="Popravite opis dogodkov">' + esc(virOsnutek) + '</textarea>' + svincnik + '</label>';
    }
    return '<button type="button" class="zgodovina-ai-pogovor__opis" data-ai-source-edit-open aria-label="Popravi opis dogodkov"><span>“' + esc(naravni.text) + '”</span>' + svincnik + '</button>';
  }

  function pogovorPovzetekHtml() {
    dopolniIzracunaniNeplacaniObrok(naravni.candidates);
    var skupaj = Math.max(1, naravni.questionKeys.length + 1);
    var akcije = virUrejanje
      ? '<button type="button" data-ai-source-cancel>Nazaj</button><button type="button" data-ai-source-update' + (!virOsnutek.trim() || virOsnutek.trim() === naravni.text.trim() ? ' disabled' : '') + '>Posodobi</button>'
      : '<button type="button" data-ai-edit-description>Popravi opis</button><button type="button" data-ai-confirm-candidates' + (vsiKandidatiDopolnjeni() ? '' : ' disabled') + '>Da, potrdi dogodke</button>';
    return '<div class="zgodovina-ai-pogovor zgodovina-ai-pogovor--povzetek">' + virOpisHtml() + lunaPorociloHtml() + napredekHtml(skupaj - 1, skupaj) + stanjeDolgaNapredekHtml() +
      '<div class="zgodovina-ai-pogovor__potrditev"><span aria-hidden="true">' + K.ikona("checkCircle") + '</span><div><h4>Če prav razumem …</h4><p>Preverite dogodke in jih potrdite.</p></div></div>' +
      '<div class="zgodovina-ai-povzetki">' + naravni.candidates.map(povzetekKandidata).join("") + preostanekPovzetekHtml() + '</div>' +
      '<div class="zgodovina-ai-pogovor__akcije">' + akcije + '</div></div>';
  }

  function ponastaviAtenoGumbHtml() {
    var onemogocen = !naravni.text.trim() && !naravni.candidates.length;
    return '<button type="button" class="zgodovina-ai-pogovor__izbrisi-vse atena__ponastavi" data-ai-remove-all aria-label="Ponastavi Ateno"' + (onemogocen ? ' disabled' : '') + '><span aria-hidden="true">' + K.ikona("refresh") + '</span><span>Ponastavi</span></button>';
  }

  function kandidatPolja(kandidat, indeks) {
    var polja = poljaKandidata(kandidat);
    var poljaHtml = polja.map(function (polje) {
      var polno = polja.length === 1 || ["paymentMethod", "communicationChannel", "reason", "description"].indexOf(polje) >= 0;
      var oznaka = oznakaVprasanjaHtml(kandidat, indeks, polje, kandidat.type === "payment_promise" && polje === "amount" ? ' <small>neobvezno</small>' : '');
      return '<label class="' + (polno ? 'is-full' : '') + '">' + oznaka + kontrolnikVprasanja(kandidat, indeks, polje) + '</label>';
    }).join('');
    var manjka = poljaKiManjkajo(kandidat);
    var manjkaHtml = manjka.length
      ? '<p class="zgodovina-ai-osnutek__manjka" role="status">Dopolnite označena polja pred potrditvijo.</p>'
      : '<p class="zgodovina-ai-osnutek__pripravljen">Pripravljeno za potrditev</p>';
    return '<div class="zgodovina-ai-povzetek__urejanje zgodovina-ai-vprasanje" data-ai-candidate="' + indeks + '"><div class="zgodovina-ai-vprasanje__polja">' + poljaHtml + '</div>' + manjkaHtml + '</div>';
  }

  function naravniStatusHtml() {
    var sporocilo = naravni.error ? sporociloNapakeZaObrtnika(naravni.error) : priporociloZaObrtnika(naravni.statusText);
    if (!sporocilo) return '';
    var razred = naravni.error ? " is-error" : " is-ready";
    return '<p class="zgodovina-ai__status' + razred + '" aria-live="polite">' + esc(sporocilo) + '</p>';
  }

  function sporociloNapakeZaObrtnika(napaka) {
    var besedilo = String(napaka || "").trim();
    var malo = besedilo.toLowerCase();
    if (/prijava je potekla|ni prijavljen|invalid.*session|jwt/.test(malo)) {
      return "Prijava je potekla. Osvežite stran in se prijavite znova.";
    }
    if (/prijavn.*strež|auth[_ -]?server|failed to fetch|network|omrež|timeout|časovn/.test(malo)) {
      return "Dogodkov trenutno ni bilo mogoče pripraviti. Poskusite znova čez nekaj trenutkov.";
    }
    if (/posodobljen|contract.*version/.test(malo)) {
      return "Atena je bila posodobljena. Osvežite stran in poskusite znova.";
    }
    if (!/luna|strežnik|supabase|auth|token|api|model|contract|json|fetch|https?|exception|stack/i.test(besedilo) &&
        /dopolnite|izberite|uredite|odstranite|najprej|poskusite|osvežite|prijavite|dodajte/i.test(besedilo)) {
      return besedilo.slice(0, 220);
    }
    return "Dogodkov trenutno ni bilo mogoče pripraviti. Poskusite znova ali jih dodajte ročno.";
  }

  function priporociloZaObrtnika(sporocilo) {
    if (naravni.status !== "ready") return "";
    var besedilo = String(sporocilo || "").trim();
    return /poskusite|pritisnite|preverite|dopolnite|odgovorite|dodajte.*ročno|osvežite/i.test(besedilo) ? besedilo : "";
  }

  function porociloPripravljenihDogodkov(stevilo) {
    if (stevilo === 1) return "Pripravljen je 1 dogodek. Preverite podatke in dopolnite manjkajoče.";
    if (stevilo === 2) return "Pripravljena sta 2 dogodka. Preverite podatke in dopolnite manjkajoče.";
    if (stevilo === 3 || stevilo === 4) return "Pripravljeni so " + stevilo + " dogodki. Preverite podatke in dopolnite manjkajoče.";
    return "Pripravljenih je " + stevilo + " dogodkov. Preverite podatke in dopolnite manjkajoče.";
  }

  function kratkoPorociloPripravljenihDogodkov(stevilo) {
    if (stevilo === 1) return "Pripravljen je 1 dogodek.";
    if (stevilo === 2) return "Pripravljena sta 2 dogodka.";
    if (stevilo === 3 || stevilo === 4) return "Pripravljeni so " + stevilo + " dogodki.";
    return "Pripravljenih je " + stevilo + " dogodkov.";
  }

  function posodobiPodnaslovGlave(root) {
    var podnaslov = root && root.querySelector(".izvedba-action-sheet__header > div > p");
    if (!podnaslov) return;
    var imaKandidate = naravni.mode === "natural" && naravni.candidates.length > 0;
    var jePripravljeno = imaKandidate && vsiKandidatiDopolnjeni();
    podnaslov.hidden = false;
    podnaslov.classList.toggle("zgodovina-ai-glava__status--ok", jePripravljeno);
    podnaslov.classList.toggle("zgodovina-ai-glava__status--opozorilo", imaKandidate && !jePripravljeno);
    podnaslov.textContent = imaKandidate
      ? kratkoPorociloPripravljenihDogodkov(naravni.candidates.length) + (jePripravljeno ? " Vse je pripravljeno." : " Nekaj podatkov še manjka.")
      : "Dodajte samo dogodke, ki so se že zgodili.";
  }

  function lunaPorocilo(semanticPlan, kandidati) {
    var plan = semanticPlan && typeof semanticPlan === "object" ? semanticPlan : {};
    var stevilo = Array.isArray(kandidati) ? kandidati.length : 0;
    if ((plan.status === "OK" || plan.status === "CORRECTED") && stevilo > 0) return porociloPripravljenihDogodkov(stevilo);
    if (plan.status === "CLARIFICATION_REQUIRED") return "Za varen vnos manjka en podatek. Odgovorite na kratko vprašanje.";
    if (plan.status === "NOT_ATTEMPTED") return "Dogodki niso bili pripravljeni. Poskusite znova ali jih dodajte ročno.";
    return "Opisa ni bilo mogoče zanesljivo razčleniti. Popravite opis ali izberite ročni vnos.";
  }

  function lunaPorociloHtml() {
    if (naravni.candidates.length) return '';
    return naravni.lunaReport ? '<p class="zgodovina-ai__status is-ready" aria-live="polite">' + esc(naravni.lunaReport) + '</p>' : '';
  }

  function ustaviAnalizaStatus() {
    if (analizaStatusCasovnik) window.clearInterval(analizaStatusCasovnik);
    analizaStatusCasovnik = 0;
    analizaStatusKorak = 0;
  }

  function posodobiAnalizaStatus() {
    var oznaka = root.querySelector("[data-ai-analyze-status]");
    if (!oznaka || naravni.status !== "analyzing") return;
    oznaka.textContent = ANALIZA_STATUS_BESEDILA[analizaStatusKorak];
    oznaka.classList.remove("is-changing");
    void oznaka.offsetWidth;
    oznaka.classList.add("is-changing");
    analizaStatusKorak = (analizaStatusKorak + 1) % ANALIZA_STATUS_BESEDILA.length;
  }

  function zacniAnalizaStatus() {
    ustaviAnalizaStatus();
    posodobiAnalizaStatus();
    analizaStatusCasovnik = window.setInterval(posodobiAnalizaStatus, 1200);
  }

  function zacniRazsiritevAtene() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var akcije = root.querySelector(".zgodovina-ai__akcije");
        if (akcije && naravni.status === "analyzing") akcije.classList.add("is-analyzing");
      });
    });
  }

  function zacniRazsiritevSnemanja() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var akcije = root.querySelector(".zgodovina-ai__akcije");
        if (akcije && snemanjeAktivno) akcije.classList.add("is-recording");
      });
    });
  }

  function posodobiAtenaGlasnost(vrednost) {
    ravenGlasu = Math.min(1, Math.max(0, Number(vrednost) || 0));
    var merilnik = root.querySelector("[data-ai-voice-meter]");
    if (!merilnik) return;
    var faktorji = [0.56, 0.82, 1, 0.76, 0.5];
    Array.prototype.forEach.call(merilnik.children, function (stolpec, indeks) {
      var nivo = Math.max(0.12, Math.min(1, ravenGlasu * faktorji[indeks] + ravenGlasu * ravenGlasu * (indeks % 2 ? 0.14 : 0.24)));
      stolpec.style.setProperty("--voice-bar", nivo.toFixed(3));
    });
  }

  function jeSnemalnoStanje(stanje) {
    return ["starting", "recording", "transcribing", "stopping"].indexOf(stanje) >= 0;
  }

  function pocakajNaRazsiritevGumba(zacetek) {
    var preostanek = 900 - (Date.now() - zacetek);
    return preostanek > 0 ? new Promise(function (resolve) { window.setTimeout(resolve, preostanek); }) : Promise.resolve();
  }

  function pocakajNaOdzivSnemanja(zacetek) {
    var preostanek = 650 - (Date.now() - zacetek);
    return preostanek > 0 ? new Promise(function (resolve) { window.setTimeout(resolve, preostanek); }) : Promise.resolve();
  }

  function naravniVnosHtml() {
    var busy = ["starting", "recording", "transcribing", "stopping", "analyzing"].indexOf(naravni.status) >= 0;
    var recording = snemanjeAktivno || Boolean(canary && canary.isRecording());
    var opozoriloDolga = opozoriloPrevisokihPlacil(naravni.text);
    var merilnik = recording ? '<span class="zgodovina-ai__glasnost" data-ai-voice-meter aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' : '';
    var vnos = '<label class="zgodovina-ai__vnos"><span class="sr-only">Opis dogodkov</span><textarea maxlength="2000" data-ai-text placeholder="Npr. plačal je tri obroke po 300 € …">' + esc(naravni.text) + '</textarea></label>' +
      '<div class="zgodovina-ai__akcije"><button type="button" class="zgodovina-ai__snemaj' + (recording ? ' is-recording' : '') + '" data-ai-record aria-label="' + (recording ? 'Prekini snemanje' : 'Povej na glas') + '" aria-pressed="' + String(Boolean(recording)) + '"' + (naravni.status === "analyzing" ? ' disabled' : '') + '>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg><span class="zgodovina-ai__snemaj-napis">' + (recording ? 'Prekini snemanje' : 'Povej na glas') + '</span>' + merilnik + '</button>' +
        '<button type="button" class="zgodovina-ai__razumi" data-ai-analyze' + (naravni.status === "analyzing" ? ' aria-busy="true"' : '') + (!naravni.text.trim() || busy || opozoriloDolga ? ' disabled' : '') + '>' + (naravni.status === "analyzing" ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span><span data-ai-analyze-status>' + esc(ANALIZA_STATUS_BESEDILA[0]) + '</span>' : 'Pripravi dogodke') + '</button></div>' +
      '<p class="zgodovina-ai__status is-error" data-ai-debt-warning aria-live="polite"' + (opozoriloDolga ? '' : ' hidden') + '>' + esc(opozoriloDolga ? opozoriloDolga.sporocilo : '') + '</p>' + naravniStatusHtml();
    var vsebina = naravni.phase === "clarification_exhausted" && naravni.clarificationExhausted
      ? pojasniloIzcrpanoHtml()
      : naravni.phase === "clarification" && naravni.clarificationQuestion
      ? pojasniloHtml()
      : naravni.phase === "questions" ? pogovorVprasanjeHtml() : naravni.phase === "review" && naravni.candidates.length ? pogovorPovzetekHtml() : vnos;
    return '<section class="zgodovina-ai" aria-label="Povejte ali napišite">' + vsebina + '</section>';
  }

  function prilagodiVisinoAtenaVnosa(polje) {
    if (!polje) return;
    polje.style.height = "auto";
    var obroba = Math.max(0, polje.offsetHeight - polje.clientHeight);
    polje.style.height = Math.max(polje.scrollHeight + obroba, 91) + "px";
  }

  function pojasniloHtml() {
    var busy = naravni.status === "analyzing";
    var status = busy || naravni.error ? naravniStatusHtml() : "";
    return '<div class="zgodovina-ai-pogovor zgodovina-ai-pogovor--pojasnilo">' + virOpisHtml() +
      '<div class="zgodovina-ai-pojasnilo" role="dialog" aria-modal="false" aria-labelledby="zgodovina-ai-pojasnilo-naslov">' +
      '<div class="zgodovina-ai-pojasnilo__ikona" aria-hidden="true">?</div>' +
      '<div class="zgodovina-ai-pojasnilo__vsebina"><p class="zgodovina-ai-pojasnilo__oznaka">Potrebujemo še en podatek</p>' +
      '<h3 id="zgodovina-ai-pojasnilo-naslov">' + esc(naravni.clarificationQuestion) + '</h3>' +
      '<label><span class="sr-only">Vaš odgovor</span><textarea maxlength="400" data-ai-clarification-answer placeholder="Odgovorite s kratkim jasnim stavkom …"' + (busy ? ' disabled' : '') + '>' + esc(naravni.clarificationAnswer) + '</textarea></label>' +
      '<div class="zgodovina-ai-pojasnilo__akcije"><button type="button" data-ai-clarification-edit' + (busy ? ' disabled' : '') + '>Uredi opis</button>' +
      '<button type="button" class="zgodovina-ai__potrdi" data-ai-clarification-submit' + (!naravni.clarificationAnswer.trim() || busy ? ' disabled' : '') + '>' + (busy ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span> Preverjam …' : 'Odgovori') + '</button></div>' +
      status + '</div></div></div>';
  }

  function pojasniloIzcrpanoHtml() {
    return '<div class="zgodovina-ai-pojasnilo zgodovina-ai-pojasnilo--izcrpano" role="dialog" aria-modal="false" aria-labelledby="zgodovina-ai-pojasnilo-izcrpano-naslov">' +
      '<div class="zgodovina-ai-pojasnilo__ikona" aria-hidden="true">!</div>' +
      '<div class="zgodovina-ai-pojasnilo__vsebina"><p class="zgodovina-ai-pojasnilo__oznaka">Varna omejitev dosežena</p>' +
      '<h3 id="zgodovina-ai-pojasnilo-izcrpano-naslov">Opisa ni bilo mogoče dovolj zanesljivo razumeti.</h3>' +
      '<p class="zgodovina-ai-pojasnilo__besedilo">Dogodke dodajte ročno ali uredite prvotni opis.</p>' +
      '<div class="zgodovina-ai-pojasnilo__akcije"><button type="button" data-ai-clarification-edit>Uredi opis</button>' +
      '<button type="button" class="zgodovina-ai__potrdi" data-ai-clarification-manual>Ročno izberi</button></div></div></div>';
  }

  function izrisiNacina(root, brezIzbireNacina) {
    var cona = root.querySelector(".izvedba-poravnava-cona");
    if (!cona) return;
    root.classList.add("atena");
    root.setAttribute("data-engine", "atena");
    root.setAttribute("data-engine-version", ATENA_ENGINE_VERSION);
    var panel = root.querySelector(".izvedba-action-sheet__panel");
    if (panel) panel.classList.add("atena__panel");
    var atenaPovrsina = root.querySelector(".atena__jedro") || root.querySelector(".izvedba-odvetnik-zgodovina__dogodki") || panel;
    if (atenaPovrsina) atenaPovrsina.classList.add("atena__povrsina", "stran--neplacila-zgodovina");
    var glava = atenaPovrsina && atenaPovrsina.querySelector(".izvedba-odvetnik-zgodovina__uvod, .izvedba-action-sheet__header");
    if (!glava) glava = root.querySelector(".izvedba-action-sheet__header");
    if (glava) {
      var zapri = glava.querySelector(".izvedba-action-sheet__zapri");
      glava.classList.add("zgodovina-ai-glava--z-izbrisom");
      if (zapri) zapri.insertAdjacentHTML("beforebegin", ponastaviAtenoGumbHtml());
      else glava.insertAdjacentHTML("beforeend", ponastaviAtenoGumbHtml());
    }
    if (brezIzbireNacina) return;
    var preklop = document.createElement("section");
    preklop.className = "zgodovina-nacina";
    preklop.innerHTML = naravni.replacement
      ? '<div class="zgodovina-zamenjava__vrstica"><p class="zgodovina-zamenjava__opis">Izberite drugo vrsto dogodka za ta korak.</p>' +
        '<div class="zgodovina-zamenjava__akcije"><button type="button" class="zgodovina-zamenjava__potrdi" data-ai-replacement-confirm' + (state.selectedSettlementType ? '' : ' disabled') + '>Spremeni</button>' +
        '<button type="button" class="zgodovina-zamenjava__preklic" data-ai-replacement-cancel aria-label="Nazaj brez zamenjave">×</button></div></div>'
      : '<div class="zgodovina-nacina__izbira" role="tablist" aria-label="Način dodajanja dogodkov">' +
        '<button type="button" role="tab" data-zgodovina-mode="natural" aria-selected="' + String(naravni.mode === "natural") + '" class="' + (naravni.mode === "natural" ? 'is-selected' : '') + '"><span aria-hidden="true">' + K.ikona("pencil") + '</span><strong>Povej ali napiši</strong><small>Hitrejši vnos</small></button>' +
        '<button type="button" role="tab" data-zgodovina-mode="manual" aria-selected="' + String(naravni.mode === "manual") + '" class="' + (naravni.mode === "manual" ? 'is-selected' : '') + '"><span aria-hidden="true">' + K.ikona("checkCircle") + '</span><strong>Ročno izberi</strong><small>Obstoječe kartice</small></button></div>' +
        (naravni.mode === "natural" ? naravniVnosHtml() : '<p class="zgodovina-nacina__rocno-opis">Izberite vrsto dogodka in ročno dopolnite njegove podatke.</p>');
    cona.parentNode.insertBefore(preklop, cona);
    var cone = root.querySelectorAll(".izvedba-poravnava-cona");
    if (naravni.mode === "natural") {
      if (cone[0]) cone[0].hidden = true;
      if (cone[1]) cone[1].hidden = true;
    }
  }

  function prilagodiPrikazZamenjave(root) {
    root.classList.toggle("is-replacement-mode", Boolean(naravni.replacement));
    if (!naravni.replacement) return;
    var naslov = root.querySelector("#izvedba-action-sheet-title");
    if (naslov) naslov.textContent = "S čim želite nadomestiti korak?";
    var podnaslov = naslov && naslov.parentElement ? naslov.parentElement.querySelector("p") : null;
    if (podnaslov) podnaslov.textContent = "Izberite kartico, s katero želite zamenjati izvorni korak.";
    var izbrisiVse = root.querySelector("[data-ai-remove-all]");
    if (izbrisiVse) izbrisiVse.remove();
    var zapriZamenjavo = root.querySelector(".izvedba-action-sheet__zapri[data-action-sheet-close]");
    if (zapriZamenjavo) zapriZamenjavo.remove();
    var cone = root.querySelectorAll(".izvedba-poravnava-cona");
    if (cone[1]) cone[1].remove();
  }

  async function token(prisilnoOsvezi) {
    var seja = await supabaseKlient.auth.getSession();
    if (seja && seja.error) throw seja.error;
    var trenutnaSeja = seja && seja.data && seja.data.session;
    var poteceKmalu = trenutnaSeja && trenutnaSeja.expires_at && trenutnaSeja.expires_at * 1000 < Date.now() + 60000;
    if (prisilnoOsvezi || !trenutnaSeja || poteceKmalu) {
      var osvezena = await supabaseKlient.auth.refreshSession();
      if (osvezena && osvezena.error) throw osvezena.error;
      trenutnaSeja = osvezena && osvezena.data && osvezena.data.session;
    }
    var accessToken = trenutnaSeja && trenutnaSeja.access_token;
    if (!accessToken) throw new Error("Prijava je potekla. Prijavite se znova.");
    return accessToken;
  }

  async function razcleniBesedilo(pojasnilo) {
    var text = String(naravni.text || "").trim();
    if (!text || naravni.status === "analyzing") return;
    if (opozoriloPrevisokihPlacil(text)) {
      posodobiOpozoriloPrevisokihPlacil(root);
      return;
    }
    var analizaZacetek = Date.now();
    analizaGeneracija += 1;
    var mojaGeneracija = analizaGeneracija;
    if (analizaAbort) analizaAbort.abort();
    analizaAbort = new AbortController();
    if (pojasnilo || !naravni.requestId) naravni.requestId = novRequestId();
    naravni.status = "analyzing";
    naravni.statusText = "Razumem opis in pripravljam osnutke …";
    naravni.lunaReport = "";
    naravni.lunaReason = "";
    naravni.error = "";
    debug.izrisiActionSheet();
    zacniRazsiritevAtene();
    zacniAnalizaStatus();
    try {
      var telo = JSON.stringify({ requestId: naravni.requestId, text: text, referenceDate: lokalniDanesIso(), originalDebt: Number(korak1.znesek), remainingDebt: preostaliDolg(), clarification: pojasnilo || null });
      var odgovor = null;
      var data = {};
      var prisilnoOsvezi = false;
      for (var authPoskus = 0; authPoskus < 3; authPoskus += 1) {
        var accessToken = await token(prisilnoOsvezi);
        odgovor = await fetch("/api/razcleni-zgodovino", {
          method: "POST",
          headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
          body: telo,
          signal: analizaAbort.signal,
        });
        data = await odgovor.json().catch(function () { return {}; });
        if (odgovor.ok) break;
        var authZacasna = data.retryable === true && ["AUTH_SERVER_UNAVAILABLE", "AUTH_TIMEOUT"].includes(data.code);
        var sejaNeveljavna = ["AUTH_SESSION_INVALID", "AUTH_SESSION_REFRESH_REQUIRED"].includes(data.code);
        if (sejaNeveljavna && authPoskus === 0) {
          prisilnoOsvezi = true;
          continue;
        }
        if (!authZacasna || authPoskus === 2) break;
        await new Promise(function (resolve) { window.setTimeout(resolve, authPoskus === 0 ? 500 : 1200); });
        prisilnoOsvezi = authPoskus > 0;
      }
      await pocakajNaRazsiritevGumba(analizaZacetek);
      if (!odgovor.ok) {
        throw new Error(data.napaka || "Besedila trenutno ni bilo mogoče razumeti.");
      }
      if (mojaGeneracija !== analizaGeneracija || data.requestId !== naravni.requestId) return;
      if (data.engineVersion !== ATENA_ENGINE_VERSION || data.contractVersion !== HISTORY_CONTRACT_VERSION) throw new Error("Atena je bila posodobljena. Osvežite stran in poskusite znova.");
      var lunaStatus = data.semanticPlan && String(data.semanticPlan.status || "");
      var lunaSprejet = lunaStatus === "OK" || lunaStatus === "CORRECTED";
      naravni.candidates = lunaSprejet && Array.isArray(data.candidates) ? data.candidates.slice(0, 20) : [];
      naravni.candidates.forEach(zagotoviKandidatId);
      naravni.replacement = null;
      naravni.questionPlan = lunaSprejet && Array.isArray(data.questionPlan) ? data.questionPlan.slice(0, 20) : [];
      naravni.lunaReport = lunaPorocilo(data.semanticPlan, naravni.candidates);
      naravni.lunaReason = String(data.semanticPlan && data.semanticPlan.reason || "").slice(0, 120);
      var novoPojasnilo = data.clarification && typeof data.clarification === "object" ? data.clarification : null;
      naravni.clarificationQuestion = novoPojasnilo ? String(novoPojasnilo.question || "").slice(0, 180) : "";
      naravni.clarificationClauseId = novoPojasnilo ? String(novoPojasnilo.clauseId || "").slice(0, 80) : "";
      naravni.clarificationAnswer = "";
      naravni.clarificationRound = novoPojasnilo ? Math.max(1, Math.min(2, Number(novoPojasnilo.round) || 1)) : 0;
      naravni.clarificationExhausted = data.clarificationExhausted === true;
      if (!lunaSprejet && !naravni.clarificationQuestion && !naravni.clarificationExhausted) naravni.requestId = "";
      dopolniLokalniDatumPlacila(text, naravni.candidates);
      dopolniRelativneDatume(naravni.candidates);
      dopolniIzracunaniNeplacaniObrok(naravni.candidates);
      naravni.questionKeys = manjkajocaVprasanja();
      naravni.questionIndex = 0;
      naravni.editCandidate = null;
      naravni.phase = naravni.clarificationExhausted ? "clarification_exhausted" : naravni.clarificationQuestion ? "clarification" : naravni.candidates.length ? (naravni.questionKeys.length ? "questions" : "review") : "input";
      naravni.status = "ready";
      var pojasnilo = data.needsClarification === true ? String(data.summary || "").trim().slice(0, 240) : "";
      naravni.statusText = naravni.clarificationExhausted ? String(data.summary || "Dogodke dodajte ročno.").slice(0, 240) : naravni.clarificationQuestion ? "Odgovorite na eno kratko vprašanje. Nič še ni shranjeno." : naravni.candidates.length ? "Odgovorite na kratka vprašanja. Nič še ni shranjeno." : naravni.lunaReport + (pojasnilo ? " " + pojasnilo : "");
      naravni.error = "";
      shrani(false);
    } catch (error) {
      if (error.name === "AbortError") return;
      await pocakajNaRazsiritevGumba(analizaZacetek);
      naravni.requestId = "";
      naravni.status = "error";
      naravni.error = error && error.message || "Razumevanje ni uspelo.";
    } finally {
      if (mojaGeneracija === analizaGeneracija) {
        ustaviAnalizaStatus();
        analizaAbort = null;
        debug.izrisiActionSheet();
      }
    }
  }

  function zagotoviCanary() {
    if (canary) return canary;
    if (!window.UJHandyCanary) throw new Error("Lokalni Handy/Canary vmesnik ni naložen.");
    canary = window.UJHandyCanary.create({
      onText: function (text) {
        naravni.text = String(text || "").slice(0, 2000);
        naravni.requestId = "";
        naravni.candidates = [];
        naravni.phase = "input";
        naravni.questionKeys = [];
        naravni.questionIndex = 0;
        naravni.clarificationQuestion = "";
        naravni.clarificationClauseId = "";
        naravni.clarificationAnswer = "";
        naravni.clarificationRound = 0;
        naravni.clarificationExhausted = false;
        var polje = root.querySelector("[data-ai-text]");
        if (polje) {
          polje.value = naravni.text;
          prilagodiVisinoAtenaVnosa(polje);
        }
        shrani(false);
      },
      onState: function (podatek) {
        var prejAktivno = snemanjeAktivno;
        naravni.status = podatek.state;
        naravni.statusText = podatek.message;
        naravni.error = "";
        snemanjeAktivno = jeSnemalnoStanje(podatek.state);
        if (!snemanjeAktivno) {
          prekinitevPoZagonu = false;
          ravenGlasu = 0;
        }
        if (prejAktivno !== snemanjeAktivno) {
          debug.izrisiActionSheet();
          if (snemanjeAktivno) zacniRazsiritevSnemanja();
        }
        if (snemanjeAktivno) posodobiAtenaGlasnost(ravenGlasu);
      },
      onLevel: function (podatek) {
        posodobiAtenaGlasnost(podatek && podatek.level);
      },
      onError: function (error) {
        snemanjeAktivno = false;
        prekinitevPoZagonu = false;
        ravenGlasu = 0;
        naravni.status = "error";
        naravni.error = error.message || "Lokalni prepis ni uspel.";
        debug.izrisiActionSheet();
      },
    });
    return canary;
  }

  function izrisiDrugoPodrobnosti(root) {
    var cone = root.querySelectorAll(".izvedba-poravnava-cona");
    if (cone.length < 2) return;
    var podrobnosti = root.querySelector("[data-zgodovina-podrobnosti]") || cone[1];
    podrobnosti.hidden = false;
    podrobnosti.innerHTML =
      '<p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">2</span>Opišite dogodek</p>' +
      '<div class="izvedba-poravnava-podrobnosti izvedba-poravnava-podrobnosti--drugo">' +
        '<div class="izvedba-poravnava-podrobnosti__naslov">Drugo</div>' +
        '<p class="izvedba-poravnava-podrobnosti__opis">Na kratko zapišite, kaj se je zgodilo.</p>' +
        '<textarea class="zgodovina-drugo__polje" data-zgodovina-drugo-opis maxlength="300" placeholder="Npr. dolžnik je prosil za nov rok plačila …">' + esc(customDraft.opis) + '</textarea>' +
        '<label class="zgodovina-drugo__datum">Datum dogodka<span class="zgodovina-dogodek__datum"><input type="date" data-zgodovina-drugo-datum value="' + esc(customDraft.datum) + '"' + (customDraft.datumNeznan || customDraft.datumPriblizno ? ' disabled' : '') + ' /><button type="button" data-zgodovina-drugo-datum-neznan aria-pressed="' + String(customDraft.datumNeznan === true) + '" class="' + (customDraft.datumNeznan ? 'is-selected' : '') + '">Ne vem</button><button type="button" data-zgodovina-drugo-datum-priblizno aria-pressed="' + String(customDraft.datumPriblizno === true) + '" class="' + (customDraft.datumPriblizno ? 'is-selected' : '') + '">Približno</button></span>' +
        (customDraft.datumPriblizno ? '<input class="zgodovina-dogodek__datum-priblizno" type="text" maxlength="120" data-zgodovina-drugo-datum-priblizno-besedilo value="' + esc(customDraft.datumPribliznoBesedilo || '') + '" placeholder="Npr. začetek maja 2025">' : '') + '</label>' +
        '<button type="button" class="izvedba-poravnava-dodaj-korak" data-zgodovina-drugo-dodaj>+ Dodaj dogodek</button>' +
      '</div>';
  }

  function preberiOcenoZamud() {
    korak1 = preberiJson(KLJUC_KORAK1) || korak1 || {};
    if (!korak1.vprasalnikOdgovori) {
      korak1.vprasalnikOdgovori = { poravnalVedno: null, opomniliVeckrat: null, prekrsilDogovor: null };
    }
    return korak1;
  }

  function shraniOcenoZamud(vrednost, polje) {
    var podatki = preberiOcenoZamud();
    if (polje) podatki.vprasalnikOdgovori[polje] = vrednost === "true";
    else podatki.zgodovinaZamud = vrednost;
    sessionStorage.setItem(KLJUC_KORAK1, JSON.stringify(podatki));
    korak1 = podatki;
    if (typeof window.UJOsveziKompaktniPovzetekDolga === "function") window.UJOsveziKompaktniPovzetekDolga();
  }

  function izrisiOcenaIzbiro(vrednost, oznaka, izbrano) {
    return '<button type="button" data-zgodovina-zamud="' + esc(vrednost) + '" aria-pressed="' + String(izbrano) + '" class="' + (izbrano ? 'is-selected' : '') + '">' + esc(oznaka) + '</button>';
  }

  function izrisiOcenaDaNe(polje, vprasanje, vrednost) {
    return '<div class="zgodovina-ocena-panel__polje"><span>' + esc(vprasanje) + '</span><div class="zgodovina-ocena-panel__da-ne" role="group" aria-label="' + esc(vprasanje) + '">' +
      '<button type="button" data-zgodovina-ocena-odgovor="' + esc(polje) + '" data-zgodovina-ocena-vrednost="true" aria-pressed="' + String(vrednost === true) + '" class="' + (vrednost === true ? 'is-selected' : '') + '">Da</button>' +
      '<button type="button" data-zgodovina-ocena-odgovor="' + esc(polje) + '" data-zgodovina-ocena-vrednost="false" aria-pressed="' + String(vrednost === false) + '" class="' + (vrednost === false ? 'is-selected' : '') + '">Ne</button></div></div>';
  }

  function izrisiOcenaPodrobnosti(root) {
    var cone = root.querySelectorAll(".izvedba-poravnava-cona");
    if (cone.length < 2) return;
    var podrobnosti = root.querySelector("[data-zgodovina-podrobnosti]") || cone[1];
    var podatki = preberiOcenoZamud();
    var izbrano = podatki.zgodovinaZamud == null ? "" : String(podatki.zgodovinaZamud);
    var odgovori = podatki.vprasalnikOdgovori;
    var izbire = [["unknown", "Ne vem"], ["0", "Ne"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"], ["7", "7"], ["8", "8"], ["9plus", "9+"]].map(function (izbira) {
      return izrisiOcenaIzbiro(izbira[0], izbira[1], izbrano === izbira[0]);
    }).join("");
    var imaPretekle = izbrano !== "" && izbrano !== "unknown" && izbrano !== "0";
    var dodatna = imaPretekle
      ? '<div class="zgodovina-ocena-panel__dodatna">' +
          izrisiOcenaDaNe("poravnalVedno", "Ali je dolg pozneje vedno poravnal?", odgovori.poravnalVedno) +
          izrisiOcenaDaNe("opomniliVeckrat", "Ste ga morali večkrat opomniti?", odgovori.opomniliVeckrat) +
          izrisiOcenaDaNe("prekrsilDogovor", "Je že kdaj prekršil dogovor o plačilu?", odgovori.prekrsilDogovor) +
        '</div>'
      : '';
    podrobnosti.hidden = false;
    podrobnosti.innerHTML =
      '<p class="izvedba-poravnava-cona__naslov"><span class="izvedba-poravnava-cona__stevilka" aria-hidden="true">2</span>Podatki o plačilnih navadah</p>' +
      '<div class="izvedba-poravnava-podrobnosti izvedba-poravnava-podrobnosti--ocena">' +
        '<button type="button" class="izvedba-poravnava-podrobnosti__strni" data-zgodovina-ocena-toggle aria-label="Skrči pretekle zamude">' + K.ikona("chevron") + '</button>' +
        '<div class="izvedba-poravnava-podrobnosti__naslov">Pretekle zamude</div>' +
        '<p class="izvedba-poravnava-podrobnosti__opis">Odgovori pomagajo določiti primeren ton sporočila.</p>' +
        '<div class="zgodovina-ocena-panel__polje"><span>Ali je dolžnik že kdaj zamudil s plačilom?</span><div class="zgodovina-ocena-panel__izbire" role="group" aria-label="Število preteklih zamud">' + izbire + '</div></div>' +
        dodatna +
        '<button type="button" class="izvedba-poravnava-dodaj-korak zgodovina-ocena-panel__shrani" data-zgodovina-ocena-shrani>Shrani podatke</button>' +
      '</div>';
  }

  window.UJZgodovinaPoIzrisu = function (_state, root) {
    var neposrednaHitraIzbira = Boolean(_state && _state.actionSheetMode === "payment" && _state.boPlacalHitraIzbira);
    if (!neposrednaHitraIzbira) posodobiPodnaslovGlave(root);
    var svicer = root.querySelector(".izvedba-poravnava-svicer");
    if (jeVgrajenaZgodovina && svicer) {
      var obstojeciDrugo = svicer.querySelector("[data-action-custom]");
      if (obstojeciDrugo) {
        obstojeciDrugo.removeAttribute("data-action-custom");
        obstojeciDrugo.setAttribute("data-zgodovina-drugo", "");
        obstojeciDrugo.classList.toggle("is-selected", customActive);
        obstojeciDrugo.setAttribute("aria-pressed", String(customActive));
      }
    }
    if (!jeVgrajenaZgodovina && svicer && naravni.mode === "manual" && !svicer.querySelector("[data-zgodovina-ocena-toggle]")) {
      var ocenaGumb = document.createElement("button");
      ocenaGumb.type = "button";
      ocenaGumb.className = "izvedba-poravnava-svicer__gumb izvedba-poravnava-svicer__gumb--ocena" + (ocenaActive ? " is-selected" : "");
      ocenaGumb.setAttribute("data-zgodovina-ocena-toggle", "");
      ocenaGumb.setAttribute("aria-pressed", ocenaActive ? "true" : "false");
      ocenaGumb.innerHTML = '<span class="izvedba-poravnava-svicer__ikona" aria-hidden="true">' + K.ikona("clock") + '</span><span data-izvedba-fit data-fit-min="7">Pretekle zamude</span>';
      svicer.insertBefore(ocenaGumb, svicer.firstChild);
    }
    if (svicer && !svicer.querySelector("[data-zgodovina-drugo]")) {
      var gumb = document.createElement("button");
      gumb.type = "button";
      gumb.className = "izvedba-poravnava-svicer__gumb izvedba-poravnava-svicer__gumb--drugo" + (customActive ? " is-selected" : "");
      gumb.setAttribute("data-zgodovina-drugo", "");
      gumb.setAttribute("aria-pressed", customActive ? "true" : "false");
      gumb.disabled = Boolean(svicer.querySelector("[data-settlement-select]:disabled"));
      gumb.innerHTML = '<span class="izvedba-poravnava-svicer__ikona" aria-hidden="true">' + window.UJIzvedbaKomponente.ikona("pencil") + '</span><span>Drugo / opiši sam</span>';
      svicer.appendChild(gumb);
    }
    if (ocenaActive && naravni.mode === "manual") izrisiOcenaPodrobnosti(root);
    else if (customActive && naravni.mode === "manual") izrisiDrugoPodrobnosti(root);
    izrisiNacina(root, neposrednaHitraIzbira);
    prilagodiVisinoAtenaVnosa(root.querySelector("[data-ai-text]"));
    if (jeVgrajenaZgodovina) {
      var stanjeDolga = root.querySelector(".izvedba-odvetnik-zgodovina__dogodki .zgodovina-stanje-dolga");
      if (stanjeDolga) stanjeDolga.hidden = naravni.mode === "natural";
    }
    prilagodiPrikazZamenjave(root);
    posodobiPrikazPreostalegaDolga(root);
    shrani(false);
  };

  window.UJZgodovinaVgrajeniVnosJePripravljen = function () {
    return naravni.status !== "analyzing" && naravni.candidates.length === 0;
  };

  var state = debug.state;
  if (!jeVgrajenaZgodovina) {
    state.globalnaNapaka = null;
    state.error = null;
    state.zadeva = {
      prvotniZnesek: Number(korak1.znesek),
      preostaliDolg: Number(korak1.znesek),
      znesek: Number(korak1.znesek),
    };
    state.ukrepi = [];
    state.nacrtKoraki = Array.isArray(shranjeno.dogodki) ? shranjeno.dogodki : [];
    if (shranjeno.settlementSettings) state.settlementSettings = Object.assign(state.settlementSettings, shranjeno.settlementSettings);
    if (shranjeno.settingsByAction) state.settingsByAction = Object.assign(state.settingsByAction, shranjeno.settingsByAction);
    state.selectedSettlementType = null;
    state.actionSheetOpen = true;
    state.actionSheetMode = "payment";
    state.actionSheetStep = "izbira";
    if (naravni.replacement) state.selectedSettlementType = String(naravni.replacement.selectedSettlementType || "") || null;
  }

  var root = document.getElementById("izvedba-action-sheet");
  window.addEventListener("resize", function () {
    window.requestAnimationFrame(function () {
      prilagodiVisinoAtenaVnosa(root.querySelector("[data-ai-text]"));
    });
  });
  if (window.UJOcenaTveganja && typeof window.UJOcenaTveganja.inicializirajUIOceno === "function") {
    window.UJOcenaTveganja.inicializirajUIOceno();
    window.UJOcenaTveganja.osveziKartice();
  }
  root.addEventListener("click", function (dogodek) {
    var kartica = dogodek.target.closest("[data-settlement-select]");
    if (!naravni.replacement || !kartica) return;
    dogodek.preventDefault();
    dogodek.stopImmediatePropagation();
    var tip = kartica.getAttribute("data-settlement-select");
    state.selectedSettlementType = state.selectedSettlementType === tip ? null : tip;
    naravni.replacement.selectedSettlementType = state.selectedSettlementType;
    customActive = false;
    ocenaActive = false;
    state.error = null;
    shrani(false);
    debug.izrisiActionSheet();
  }, true);
  root.addEventListener("click", function (dogodek) {
    if (!dogodek.target.closest("[data-ai-choice]")) {
      root.querySelectorAll("[data-ai-choice].is-open").forEach(function (izbira) {
        izbira.classList.remove("is-open");
        izbira.querySelector("[data-ai-choice-toggle]").setAttribute("aria-expanded", "false");
        izbira.querySelector("[role=listbox]").hidden = true;
      });
    }
    if (naravni.replacement && dogodek.target.closest("[data-action-sheet-close]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      prekliciZamenjavo(true);
      return;
    }
    if (dogodek.target.closest("[data-ai-replacement-cancel]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      prekliciZamenjavo(true);
      return;
    }
    if (dogodek.target.closest("[data-ai-replacement-clear-selection]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      state.selectedSettlementType = null;
      state.error = null;
      if (naravni.replacement) naravni.replacement.selectedSettlementType = null;
      shrani(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-ai-replacement-confirm]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      potrdiZamenjavo();
      return;
    }
    var izbiraPreklop = dogodek.target.closest("[data-ai-choice-toggle]");
    if (izbiraPreklop) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var izbiraOkvir = izbiraPreklop.closest("[data-ai-choice]");
      var izbiraSeznam = izbiraOkvir.querySelector("[role=listbox]");
      var odpri = izbiraSeznam.hidden;
      izbiraOkvir.classList.toggle("is-open", odpri);
      izbiraPreklop.setAttribute("aria-expanded", String(odpri));
      izbiraSeznam.hidden = !odpri;
      return;
    }
    var izbiraMoznost = dogodek.target.closest("[data-ai-choice-option]");
    if (izbiraMoznost) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var moznostOkvir = izbiraMoznost.closest("[data-ai-choice]");
      var skritoPolje = moznostOkvir.querySelector("[data-ai-candidate-field]");
      skritoPolje.value = izbiraMoznost.getAttribute("data-ai-choice-value") || "";
      skritoPolje.dispatchEvent(new Event("input", { bubbles: true }));
      moznostOkvir.querySelector("[data-ai-choice-toggle] > span").textContent = izbiraMoznost.querySelector("span").textContent;
      moznostOkvir.querySelectorAll("[data-ai-choice-option]").forEach(function (moznost) {
        var aktivna = moznost === izbiraMoznost;
        moznost.classList.toggle("is-selected", aktivna);
        moznost.setAttribute("aria-selected", String(aktivna));
      });
      moznostOkvir.classList.remove("is-open");
      moznostOkvir.querySelector("[data-ai-choice-toggle]").setAttribute("aria-expanded", "false");
      moznostOkvir.querySelector("[role=listbox]").hidden = true;
      return;
    }
    var ocenaGumb = dogodek.target.closest("[data-zgodovina-ocena-toggle]");
    if (ocenaGumb) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      ocenaActive = !ocenaActive;
      customActive = false;
      state.selectedSettlementType = null;
      debug.izrisiActionSheet();
      return;
    }
    var ocenaIzbira = dogodek.target.closest("[data-zgodovina-zamud]");
    if (ocenaIzbira) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      shraniOcenoZamud(ocenaIzbira.getAttribute("data-zgodovina-zamud"));
      var napakaOcene = document.getElementById("zgodovina-napaka");
      if (napakaOcene) napakaOcene.hidden = true;
      debug.izrisiActionSheet();
      return;
    }
    var ocenaOdgovor = dogodek.target.closest("[data-zgodovina-ocena-odgovor]");
    if (ocenaOdgovor) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      shraniOcenoZamud(ocenaOdgovor.getAttribute("data-zgodovina-ocena-vrednost"), ocenaOdgovor.getAttribute("data-zgodovina-ocena-odgovor"));
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-zgodovina-ocena-shrani]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      ocenaActive = false;
      debug.izrisiActionSheet();
      return;
    }
    var mode = dogodek.target.closest("[data-zgodovina-mode]");
    if (mode) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      naravni.mode = mode.getAttribute("data-zgodovina-mode") === "manual" ? "manual" : "natural";
      customActive = false;
      ocenaActive = false;
      state.selectedSettlementType = null;
      if (naravni.mode === "manual" && canary && canary.isRecording()) canary.stop().catch(function () {});
      debug.izrisiActionSheet();
      return;
    }
    var record = dogodek.target.closest("[data-ai-record]");
    if (record) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      try {
        var lokalniCanary = zagotoviCanary();
        if (lokalniCanary.isRecording()) {
          lokalniCanary.stop().catch(function (error) {
            naravni.status = "error";
            naravni.error = error.message || "Prepisa ni bilo mogoče zaključiti.";
            debug.izrisiActionSheet();
          });
        } else if (snemanjeAktivno) {
          prekinitevPoZagonu = true;
          record.disabled = true;
        } else {
          var snemanjeZacetek = Date.now();
          snemanjeAktivno = true;
          prekinitevPoZagonu = false;
          naravni.status = "starting";
          naravni.error = "";
          debug.izrisiActionSheet();
          zacniRazsiritevSnemanja();
          lokalniCanary.start(naravni.text).then(function () {
            if (prekinitevPoZagonu && lokalniCanary.isRecording()) return lokalniCanary.stop();
          }).catch(async function (error) {
            await pocakajNaOdzivSnemanja(snemanjeZacetek);
            snemanjeAktivno = false;
            prekinitevPoZagonu = false;
            ravenGlasu = 0;
            naravni.status = "error";
            naravni.error = error.name === "NotAllowedError" ? "Dovoljenje za mikrofon je zavrnjeno." : (error.message || "Lokalnega prepisa ni bilo mogoče začeti.");
            debug.izrisiActionSheet();
          });
        }
      } catch (error) {
        naravni.status = "error";
        naravni.error = error.message;
        debug.izrisiActionSheet();
      }
      return;
    }
    if (dogodek.target.closest("[data-ai-analyze]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      razcleniBesedilo();
      return;
    }
    if (dogodek.target.closest("[data-ai-clarification-submit]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var odgovorPojasnila = String(naravni.clarificationAnswer || "").trim();
      if (!odgovorPojasnila || !naravni.clarificationQuestion) return;
      razcleniBesedilo({
        question: naravni.clarificationQuestion,
        clauseId: naravni.clarificationClauseId,
        answer: odgovorPojasnila,
        round: naravni.clarificationRound,
      });
      return;
    }
    if (dogodek.target.closest("[data-ai-clarification-manual]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      naravni.mode = "manual";
      state.selectedSettlementType = null;
      shrani(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-ai-clarification-edit]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      naravni.phase = "input";
      naravni.requestId = "";
      naravni.clarificationQuestion = "";
      naravni.clarificationClauseId = "";
      naravni.clarificationAnswer = "";
      naravni.clarificationRound = 0;
      naravni.clarificationExhausted = false;
      naravni.status = "idle";
      naravni.error = "";
      shrani(false);
      debug.izrisiActionSheet();
      return;
    }
    var preostanekObljube = dogodek.target.closest("[data-ai-promise-remaining]");
    if (preostanekObljube) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var preostanekIndeks = Number(preostanekObljube.getAttribute("data-ai-candidate-index"));
      var preostanekKandidat = naravni.candidates[preostanekIndeks];
      var preostanekKontrolnik = root.querySelector('[data-ai-candidate-field="amount"][data-ai-candidate-index="' + preostanekIndeks + '"]');
      if (preostanekKontrolnik && preostanekKandidat && preostanekKandidat.type === "payment_promise") {
        preostanekKontrolnik.value = saldoPredKandidatom(preostanekKandidat);
        preostanekKontrolnik.dispatchEvent(new Event("input", { bubbles: true }));
        shrani(false);
        debug.izrisiActionSheet();
      }
      return;
    }
    var pribliznoPolje = dogodek.target.closest("[data-ai-approximate-field]");
    if (pribliznoPolje) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var pribliznoIndeks = Number(pribliznoPolje.getAttribute("data-ai-candidate-index"));
      var pribliznoKandidat = naravni.candidates[pribliznoIndeks];
      var pribliznoIme = pribliznoPolje.getAttribute("data-ai-approximate-field");
      if (pribliznoKandidat && (pribliznoIme === "occurredDate" || pribliznoIme === "promisedDate")) {
        if (relativniDatumi && typeof relativniDatumi.oznaciRocniPopravek === "function") relativniDatumi.oznaciRocniPopravek(pribliznoKandidat, pribliznoIme);
        pribliznoKandidat[pribliznoIme + "Approximate"] = pribliznoKandidat[pribliznoIme + "Approximate"] !== true;
        pribliznoKandidat[pribliznoIme] = null;
        pribliznoKandidat[pribliznoIme + "Unknown"] = false;
        if (!pribliznoKandidat[pribliznoIme + "Approximate"]) pribliznoKandidat[pribliznoIme + "Approximation"] = "";
        dopolniRelativneDatume(naravni.candidates);
        naravni.error = "";
        shrani(false);
        debug.izrisiActionSheet();
      }
      return;
    }
    var neznanoPolje = dogodek.target.closest("[data-ai-unknown-field]");
    if (neznanoPolje) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var neznanoIndeks = Number(neznanoPolje.getAttribute("data-ai-candidate-index"));
      var neznanoIme = neznanoPolje.getAttribute("data-ai-unknown-field");
      var neznanoKandidat = naravni.candidates[neznanoIndeks];
      if (neznanoKandidat && (neznanoIme === "occurredDate" || neznanoIme === "promisedDate")) {
        if (relativniDatumi && typeof relativniDatumi.oznaciRocniPopravek === "function") relativniDatumi.oznaciRocniPopravek(neznanoKandidat, neznanoIme);
        neznanoKandidat[neznanoIme + "Unknown"] = neznanoKandidat[neznanoIme + "Unknown"] !== true;
        if (neznanoKandidat[neznanoIme + "Unknown"] === true) {
          neznanoKandidat[neznanoIme + "Approximate"] = false;
          neznanoKandidat[neznanoIme + "Approximation"] = "";
        }
        dopolniRelativneDatume(naravni.candidates);
        naravni.error = "";
        shrani(false);
        debug.izrisiActionSheet();
      }
      return;
    }
    if (dogodek.target.closest("[data-ai-source-edit-open]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      virUrejanje = true;
      virOsnutek = naravni.text;
      debug.izrisiActionSheet();
      requestAnimationFrame(function () {
        var virPolje = root.querySelector("[data-ai-source-edit]");
        if (virPolje) {
          virPolje.focus({ preventScroll: true });
          virPolje.setSelectionRange(virPolje.value.length, virPolje.value.length);
        }
      });
      return;
    }
    if (dogodek.target.closest("[data-ai-source-cancel]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      virUrejanje = false;
      virOsnutek = "";
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-ai-source-update]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var posodobljeniVir = virOsnutek.trim();
      if (!posodobljeniVir || posodobljeniVir === naravni.text.trim()) return;
      naravni.text = posodobljeniVir;
      naravni.requestId = "";
      naravni.phase = "input";
      naravni.questionIndex = 0;
      naravni.editCandidate = null;
      naravni.clarificationQuestion = "";
      naravni.clarificationClauseId = "";
      naravni.clarificationAnswer = "";
      naravni.clarificationRound = 0;
      naravni.clarificationExhausted = false;
      naravni.status = "idle";
      naravni.error = "";
      virUrejanje = false;
      virOsnutek = "";
      razcleniBesedilo();
      return;
    }
    if (dogodek.target.closest("[data-ai-question-back]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      if (virUrejanje) {
        virUrejanje = false;
        virOsnutek = "";
        debug.izrisiActionSheet();
        return;
      }
      if (naravni.questionIndex > 0) naravni.questionIndex -= 1;
      else if (naravni.editCandidate != null) { naravni.phase = "review"; naravni.editCandidate = null; }
      else naravni.phase = "input";
      naravni.error = "";
      shrani(false);
      debug.izrisiActionSheet();
      return;
    }
    var neposredniKorak = dogodek.target.closest("[data-ai-question-step]");
    if (neposredniKorak) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var ciljniIndeks = Number(neposredniKorak.getAttribute("data-ai-question-step"));
      if (Number.isInteger(ciljniIndeks) && ciljniIndeks >= 0 && ciljniIndeks <= naravni.questionKeys.length) {
        if (ciljniIndeks === naravni.questionKeys.length) {
          naravni.phase = "review";
          naravni.editCandidate = null;
        } else {
          naravni.phase = "questions";
          naravni.questionIndex = ciljniIndeks;
        }
        naravni.error = "";
        shrani(false);
        debug.izrisiActionSheet();
      }
      return;
    }
    if (dogodek.target.closest("[data-ai-question-next]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      if (!aktivnoVprasanjeIzpolnjeno()) return;
      var naslednjiIndeks = naravni.questionIndex + 1;
      if (naslednjiIndeks < naravni.questionKeys.length) naravni.questionIndex = naslednjiIndeks;
      else { naravni.phase = "review"; naravni.editCandidate = null; }
      naravni.error = "";
      shrani(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-ai-change-candidate]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var aktivniPodatki = razcleniKljucVprasanja(naravni.questionKeys[naravni.questionIndex]);
      if (Number.isInteger(aktivniPodatki.indeks)) zacniZamenjavo(aktivniPodatki.indeks);
      return;
    }
    var urediKandidata = dogodek.target.closest("[data-ai-edit-candidate]");
    if (urediKandidata) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var urediIndeks = Number(urediKandidata.getAttribute("data-ai-edit-candidate"));
      naravni.editCandidate = naravni.editCandidate === urediIndeks ? null : urediIndeks;
      naravni.error = "";
      shrani(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-ai-edit-description]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      naravni.phase = "input";
      naravni.editCandidate = null;
      naravni.error = "";
      shrani(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-ai-remove-all]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      naravni.candidates = [];
      naravni.text = "";
      naravni.requestId = "";
      naravni.phase = "input";
      naravni.editCandidate = null;
      naravni.questionKeys = [];
      naravni.questionPlan = [];
      naravni.lunaReport = "";
      naravni.lunaReason = "";
      naravni.clarificationQuestion = "";
      naravni.clarificationClauseId = "";
      naravni.clarificationAnswer = "";
      naravni.clarificationRound = 0;
      naravni.clarificationExhausted = false;
      naravni.questionIndex = 0;
      naravni.status = "ready";
      naravni.statusText = "Vsi osnutki so odstranjeni.";
      naravni.error = "";
      shrani(false);
      debug.izrisiActionSheet();
      return;
    }
    var odstraniKandidat = dogodek.target.closest("[data-ai-candidate-remove]");
    if (odstraniKandidat) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var odstraniIndeks = Number(odstraniKandidat.getAttribute("data-ai-candidate-remove"));
      var prejsnjiKljuci = naravni.questionKeys.slice();
      var odstranjenKorak = prejsnjiKljuci.findIndex(function (kljuc) {
        return razcleniKljucVprasanja(kljuc).indeks === odstraniIndeks;
      });
      naravni.candidates.splice(odstraniIndeks, 1);
      dopolniRelativneDatume(naravni.candidates);
      dopolniIzracunaniNeplacaniObrok(naravni.candidates);
      naravni.editCandidate = null;
      naravni.questionKeys = prejsnjiKljuci.reduce(function (kljuci, kljuc) {
        var podatki = razcleniKljucVprasanja(kljuc);
        if (podatki.indeks === odstraniIndeks) return kljuci;
        var noviIndeks = podatki.indeks > odstraniIndeks ? podatki.indeks - 1 : podatki.indeks;
        if (naravni.candidates[noviIndeks]) kljuci.push(kljucVprasanja(noviIndeks, podatki.polja));
        return kljuci;
      }, []);
      if (naravni.candidates.length && !naravni.questionKeys.length) {
        var prejsnjiKandidat = Math.max(0, Math.min(odstraniIndeks - 1, naravni.candidates.length - 1));
        naravni.questionKeys = vsaVprasanjaKandidata(prejsnjiKandidat);
      }
      naravni.questionPlan = naravni.candidates.map(function (kandidat, indeks) {
        var manjka = poljaKiManjkajo(kandidat);
        return { candidateIndex: indeks, fields: poljaKandidata(kandidat), missing: manjka.slice() };
      });
      naravni.phase = naravni.candidates.length ? (naravni.questionKeys.length ? "questions" : "review") : "input";
      naravni.questionIndex = naravni.candidates.length
        ? Math.max(0, Math.min(odstranjenKorak > 0 ? odstranjenKorak - 1 : 0, naravni.questionKeys.length - 1))
        : 0;
      naravni.status = "ready";
      naravni.statusText = naravni.candidates.length ? "Korak je odstranjen. Nadaljujte s prejšnjo kartico." : "Vsi osnutki so odstranjeni.";
      shrani(false);
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-ai-confirm-candidates]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      dopolniIzracunaniNeplacaniObrok(naravni.candidates);
      naravni.candidates.forEach(function (kandidat) { kandidat.missing = poljaKiManjkajo(kandidat); });
      if (!vsiKandidatiDopolnjeni()) {
        naravni.status = "error";
        naravni.error = "Dopolnite manjkajoče podatke pred potrditvijo.";
        debug.izrisiActionSheet();
        return;
      }
      var dodano = debug.dodajKandidatneDogodke(naravni.candidates);
      if (!dodano.ok) {
        naravni.status = "error";
        naravni.error = dodano.error || "Dogodkov ni bilo mogoče dodati.";
        debug.izrisiActionSheet();
        return;
      }
      naravni.candidates = [];
      naravni.phase = "input";
      naravni.questionKeys = [];
      naravni.questionIndex = 0;
      naravni.editCandidate = null;
      naravni.requestId = "";
      naravni.text = "";
      naravni.status = "ready";
      naravni.statusText = dodano.added + " " + (dodano.added === 1 ? "dogodek je dodan" : "dogodki so dodani") + ". Preverite jih v poteku primera.";
      naravni.error = "";
      shrani(false);
      debug.izrisiActionSheet();
      if (typeof debug.pomakniPotekNaDno === "function") debug.pomakniPotekNaDno(dodano.added);
      return;
    }
    var potrdi = dogodek.target.closest("[data-zgodovina-nadaljuj]");
    if (potrdi) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      if (naravni.candidates.length) {
        naravni.mode = "natural";
        naravni.status = "error";
        naravni.error = "Najprej dopolnite in potrdite pripravljene osnutke ali jih odstranite.";
        debug.izrisiActionSheet();
        return;
      }
      korak1 = preberiJson(KLJUC_KORAK1) || korak1;
      var zgodovinaZamud = korak1.zgodovinaZamud;
      if (zgodovinaZamud == null || zgodovinaZamud === "") {
        shraniOcenoZamud("unknown");
      }
      var napakaOcene = document.getElementById("zgodovina-napaka");
      if (napakaOcene) napakaOcene.hidden = true;
      shrani(true);
      window.location.href = "neplacila-cilj.html";
      return;
    }
    if (dogodek.target.closest("[data-zgodovina-drugo]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      customActive = true;
      ocenaActive = false;
      state.selectedSettlementType = null;
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-settlement-select]")) {
      customActive = false;
      ocenaActive = false;
    }
    if (dogodek.target.closest("[data-zgodovina-drugo-datum-neznan]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      customDraft.datumNeznan = customDraft.datumNeznan !== true;
      customDraft.datum = "";
      customDraft.datumPriblizno = false;
      customDraft.datumPribliznoBesedilo = "";
      debug.izrisiActionSheet();
      return;
    }
    if (dogodek.target.closest("[data-zgodovina-drugo-datum-priblizno]")) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      customDraft.datumPriblizno = customDraft.datumPriblizno !== true;
      customDraft.datum = "";
      customDraft.datumNeznan = false;
      if (!customDraft.datumPriblizno) customDraft.datumPribliznoBesedilo = "";
      debug.izrisiActionSheet();
      requestAnimationFrame(function () {
        var vnos = root.querySelector("[data-zgodovina-drugo-datum-priblizno-besedilo]");
        if (vnos) vnos.focus({ preventScroll: true });
      });
      return;
    }
    var dodajDrugo = dogodek.target.closest("[data-zgodovina-drugo-dodaj]");
    if (dodajDrugo) {
      dogodek.preventDefault();
      dogodek.stopImmediatePropagation();
      var opis = String(customDraft.opis || "").trim();
      if (!opis) {
        var polje = root.querySelector("[data-zgodovina-drugo-opis]");
        if (polje) { polje.setCustomValidity("Vpišite kratek opis dogodka."); polje.reportValidity(); }
        return;
      }
      if (customDraft.datumPriblizno && !String(customDraft.datumPribliznoBesedilo || "").trim()) {
        var datumPribliznoPolje = root.querySelector("[data-zgodovina-drugo-datum-priblizno-besedilo]");
        if (datumPribliznoPolje) { datumPribliznoPolje.setCustomValidity("Opišite približni datum."); datumPribliznoPolje.reportValidity(); }
        return;
      }
      state.nacrtKoraki.push({
        tip: "history_custom",
        actionType: "history_custom",
        settings: { description: opis, occurredAt: customDraft.datum || null, occurredAtUnknown: customDraft.datumNeznan === true, occurredAtApproximation: customDraft.datumPriblizno ? String(customDraft.datumPribliznoBesedilo || "").trim() || null : null },
        naslov: opis,
        znesek: null,
        ikona: "pencil",
        razred: "drugo",
        datum: customDraft.datum ? customDraft.datum + "T12:00:00" : new Date().toISOString(),
        datumNeznan: customDraft.datumNeznan === true,
        datumPriblizno: customDraft.datumPriblizno ? String(customDraft.datumPribliznoBesedilo || "").trim() : "",
      });
      customDraft = { opis: "", datum: lokalniDanesIso(), datumNeznan: false, datumPriblizno: false, datumPribliznoBesedilo: "" };
      customActive = false;
      debug.izrisiActionSheet();
      if (typeof debug.pomakniPotekNaDno === "function") debug.pomakniPotekNaDno();
      return;
    }
    setTimeout(function () { shrani(false); }, 0);
  }, true);

  root.addEventListener("input", function (dogodek) {
    if (dogodek.target.matches("[data-zgodovina-drugo-opis]")) customDraft.opis = dogodek.target.value;
    if (dogodek.target.matches("[data-zgodovina-drugo-datum]")) {
      customDraft.datum = dogodek.target.value;
      customDraft.datumNeznan = false;
      customDraft.datumPriblizno = false;
      customDraft.datumPribliznoBesedilo = "";
    }
    if (dogodek.target.matches("[data-zgodovina-drugo-datum-priblizno-besedilo]")) customDraft.datumPribliznoBesedilo = dogodek.target.value;
    if (dogodek.target.matches("[data-ai-source-edit]")) {
      virOsnutek = dogodek.target.value.slice(0, 2000);
      var posodobiVir = root.querySelector("[data-ai-source-update]");
      if (posodobiVir) posodobiVir.disabled = !virOsnutek.trim() || virOsnutek.trim() === naravni.text.trim();
    }
    if (dogodek.target.matches("[data-ai-text]")) {
      prilagodiVisinoAtenaVnosa(dogodek.target);
      naravni.text = dogodek.target.value.slice(0, 2000);
      naravni.requestId = "";
      naravni.candidates = [];
      naravni.phase = "input";
      naravni.questionKeys = [];
      naravni.questionIndex = 0;
      naravni.editCandidate = null;
      naravni.clarificationQuestion = "";
      naravni.clarificationClauseId = "";
      naravni.clarificationAnswer = "";
      naravni.clarificationRound = 0;
      naravni.clarificationExhausted = false;
      naravni.status = "idle";
      naravni.error = "";
      posodobiOpozoriloPrevisokihPlacil(root);
      posodobiPrikazPreostalegaDolga(root);
    }
    if (dogodek.target.matches("[data-ai-clarification-answer]")) {
      naravni.clarificationAnswer = dogodek.target.value.slice(0, 400);
      naravni.error = "";
      var odgovori = root.querySelector("[data-ai-clarification-submit]");
      if (odgovori) odgovori.disabled = !naravni.clarificationAnswer.trim();
      shrani(false);
    }
    if (dogodek.target.matches("[data-ai-candidate-field]")) {
      var kandidat = naravni.candidates[Number(dogodek.target.getAttribute("data-ai-candidate-index"))];
      var kandidatIndeks = Number(dogodek.target.getAttribute("data-ai-candidate-index"));
      var poljeKandidata = dogodek.target.getAttribute("data-ai-candidate-field");
      if (kandidat && poljeKandidata) {
        kandidat[poljeKandidata] = poljeKandidata === "amount"
          ? (dogodek.target.value === "" ? null : Number(dogodek.target.value))
          : dogodek.target.value;
        if ((poljeKandidata === "occurredDate" || poljeKandidata === "promisedDate") && relativniDatumi && typeof relativniDatumi.oznaciRocniPopravek === "function") {
          relativniDatumi.oznaciRocniPopravek(kandidat, poljeKandidata);
        }
        if (poljeKandidata === "paymentMethod") {
          delete kandidat.paymentMethodInheritedFrom;
          podedujNacinPlacilaNaslednjimPlacilom(kandidat, kandidatIndeks, dogodek.target.value);
        }
        if (poljeKandidata === "amount") {
          dopolniIzracunaniNeplacaniObrok(naravni.candidates);
          posodobiPrikazPreostalegaDolga(root);
        }
        if ((poljeKandidata === "occurredDate" || poljeKandidata === "promisedDate") && dogodek.target.value) {
          kandidat[poljeKandidata + "Unknown"] = false;
          kandidat[poljeKandidata + "Approximate"] = false;
          kandidat[poljeKandidata + "Approximation"] = "";
        }
        dopolniRelativneDatume(naravni.candidates);
        naravni.error = "";
        var kartica = dogodek.target.closest("[data-ai-candidate]");
        var stanje = kartica && kartica.querySelector(".zgodovina-ai-osnutek__manjka, .zgodovina-ai-osnutek__pripravljen");
        if (stanje) {
          stanje.className = kandidat.missing.length ? "zgodovina-ai-osnutek__manjka" : "zgodovina-ai-osnutek__pripravljen";
          stanje.textContent = kandidat.missing.length ? "Dopolnite označena polja pred potrditvijo." : "Pripravljeno za potrditev";
        }
        var confirmCandidates = root.querySelector("[data-ai-confirm-candidates]");
        if (confirmCandidates) confirmCandidates.disabled = !vsiKandidatiDopolnjeni();
        var naslednjeVprasanje = root.querySelector("[data-ai-question-next]");
        if (naslednjeVprasanje) naslednjeVprasanje.disabled = !aktivnoVprasanjeIzpolnjeno();
        posodobiPodnaslovGlave(root);
      }
    }
    setTimeout(function () { shrani(false); }, 0);
  });

  root.addEventListener("focusout", function (dogodek) {
    if (!dogodek.target.matches("[data-ai-source-edit]")) return;
    setTimeout(function () {
      if (!virUrejanje || virOsnutek.trim() !== naravni.text.trim()) return;
      var okvirUrejanja = root.querySelector(".zgodovina-ai-pogovor__opis--urejanje");
      if (okvirUrejanja && okvirUrejanja.contains(document.activeElement)) return;
      virUrejanje = false;
      virOsnutek = "";
      debug.izrisiActionSheet();
    }, 0);
  });

  window.addEventListener("popstate", function () {
    if (naravni.replacement) prekliciZamenjavo(false);
  });

  if (!jeVgrajenaZgodovina && typeof window.UJInicializirajWizardProgressHeader === "function") {
    window.UJInicializirajWizardProgressHeader(2);
  }
  if (!jeVgrajenaZgodovina) debug.izrisiActionSheet();
})();
