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
    partial: { paymentAmount: null },
    compensation: { dateMode: "today", settledAt: null },
    installment: { paymentAmount: null },
    credit_note: { settlementAmount: null },
    cancelled_invoice: { reason: "" },
  };

  var SETTLEMENT_ORDER = ["full", "partial", "compensation", "installment", "credit_note", "cancelled_invoice"];
  var SETTLEMENT_META = {
    full: { naslov: "Plačilo v celoti", opis: "Celotni dolg je poravnan.", nastavitev: "Datum plačila", badge: "Priporočeno", razred: "placano", ikona: "checkCircle", gumb: "Potrdi celotno plačilo" },
    partial: { naslov: "Delno plačilo", opis: "Prejet je le del zneska.", nastavitev: "Prejeti znesek", badge: "Pogosto", razred: "delno", ikona: "coinCheck", gumb: "Shrani delno plačilo" },
    compensation: { naslov: "Kompenzacija", opis: "Račun je zaprt s pobotom.", nastavitev: "Datum zaprtja", badge: "Možnost", razred: "kompenzacija", ikona: "swap", gumb: "Potrdi kompenzacijo" },
    installment: { naslov: "Plačilo v obrokih", opis: "Evidentirajte prejeti obrok.", nastavitev: "Prejeti obrok", badge: "Možnost", razred: "obrok", ikona: "calendarArrow", gumb: "Shrani prejeti obrok" },
    credit_note: { naslov: "Dobropis ali popust", opis: "Dolg je zaprt z zmanjšanjem.", nastavitev: "Znesek dobropisa", badge: "Možnost", razred: "dobropis", ikona: "tag", gumb: "Potrdi dobropis" },
    cancelled_invoice: { naslov: "Storniran račun", opis: "Račun ne bo izterjan.", nastavitev: "Razlog", badge: "Posebno", razred: "storno", ikona: "documentX", gumb: "Potrdi storno računa" },
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
  var elActionSheet = document.getElementById("izvedba-action-sheet");
  var actionSheetReturnFocus = null;
  var fitMerilnik = document.createElement("canvas").getContext("2d");

  var state = {
    zadevaId: null,
    zadeva: null,
    plan: null,
    steps: [],
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
    settlementSettings: JSON.parse(JSON.stringify(DEFAULT_SETTLEMENT_SETTINGS)),
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
          '<span class="izvedba-hitra-akcija__ikona" aria-hidden="true">' + K.ikona("xCircle") + '</span>' +
          '<span class="izvedba-hitra-akcija__besedilo" data-izvedba-fit data-fit-min="7.5">Prekli\u010Di opomin</span>' +
        '</button>' +
        '<button type="button" class="izvedba-hitra-akcija izvedba-hitra-akcija--poravnano" id="izvedba-gumb-poravnano"' + onemogoceno + '>' +
          '<span class="izvedba-hitra-akcija__ikona" aria-hidden="true">' + K.ikona("checkCircle") + '</span>' +
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
    return state.steps.filter(function (k) { return k.step_id === stepId; });
  }

  function vkljuceniKorakiZaSwipe() {
    var videnStepId = {};
    var izhod = [];
    (state.steps || []).forEach(function (k) {
      if (videnStepId[k.step_id]) return;
      videnStepId[k.step_id] = true;
      var stepVPlanu = ((state.plan && state.plan.steps) || []).find(function (s) { return s.id === k.step_id; });
      izhod.push({
        stepId: k.step_id,
        stepIndex: k.step_index,
        naslov: (stepVPlanu && stepVPlanu.title) || "Korak " + k.step_index,
        executionState: agregiranoStanjeKoraka(k.step_id),
        scheduledAt: k.scheduled_at,
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
    state.serverVersion = String((odgovor.plan && odgovor.plan.version) || odgovor.version || "0");
    // Ohrani trenutno odprt korak, če še obstaja med koraki.
    var obstaja = state.steps.some(function (k) { return k.step_id === state.currentStepId; });
    if (!obstaja) {
      state.currentStepId = odgovor.currentStepId || (state.steps[0] && state.steps[0].step_id) || null;
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
    state.selectedActionType = actionType;
    state.error = null;
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

  function pripraviPoravnavoZaOddajo() {
    var tip = state.selectedSettlementType;
    var nastavitve = state.settlementSettings[tip];
    var dolg = trenutniPreostaliDolg();
    if (!tip || !nastavitve) return null;

    if (tip === "partial" || tip === "installment") {
      var placilo = Number(nastavitve.paymentAmount);
      if (!Number.isFinite(placilo) || placilo <= 0 || placilo >= dolg) {
        state.error = "Vnesite prejeti znesek, ki je večji od 0 in manjši od preostalega dolga.";
        return null;
      }
      return { actionType: "partial_payment", settings: { paymentAmount: placilo, settlementType: tip } };
    }

    if (tip === "credit_note") {
      var dobropis = Number(nastavitve.settlementAmount);
      if (!Number.isFinite(dobropis) || Math.abs(dobropis - dolg) > 0.009) {
        state.error = "Za zaključek primera mora znesek dobropisa pokriti celotni preostali dolg.";
        return null;
      }
      return { actionType: "paid_in_full", settings: { settlementType: tip, settlementAmount: dobropis, settledAt: new Date().toISOString() } };
    }

    if (tip === "cancelled_invoice") {
      if (!nastavitve.reason) {
        state.error = "Izberite razlog za storno računa.";
        return null;
      }
      return { actionType: "paid_in_full", settings: { settlementType: tip, reason: nastavitve.reason, settledAt: new Date().toISOString() } };
    }

    var datum = nastavitve.dateMode === "custom" ? nastavitve.settledAt : new Date().toISOString();
    if (!datum) {
      state.error = "Izberite datum zaključka.";
      return null;
    }
    return { actionType: "paid_in_full", settings: { settlementType: tip, settledAt: datum } };
  }

  async function submitSelectedAction() {
    if (state.isSubmitting) return;
    var pripravljeno = state.actionSheetMode === "payment"
      ? pripraviPoravnavoZaOddajo()
      : (state.selectedActionType ? { actionType: state.selectedActionType, settings: state.settingsByAction[state.selectedActionType] } : null);
    if (!pripravljeno) {
      if (state.error) izrisiActionSheet();
      return;
    }
    var actionType = pripravljeno.actionType;
    var settings = pripravljeno.settings;
    var pendingType = state.actionSheetMode === "payment" ? actionType + ":" + state.selectedSettlementType : actionType;

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
        document.body.classList.remove("izvedba-sheet-open");
        state.pendingActionId = null;
        state.pendingActionType = null;
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
    state.selectedSettlementType = "full";
    state.error = null;
    state.settlementSettings = JSON.parse(JSON.stringify(DEFAULT_SETTLEMENT_SETTINGS));
    state.settlementSettings.credit_note.settlementAmount = trenutniPreostaliDolg();
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
    elStevilo.textContent = koraki.length ? (indeks + 1) + " od " + koraki.length + " korakov" : "";
    var trenutniGumb = elSwipe.querySelector('[data-swipe-step="' + (state.currentStepId || "") + '"]');
    var trak = elSwipe.querySelector(".izvedba-mini-trak");
    if (trenutniGumb && trak) {
      /* scrollIntoView lahko na Safariju premakne tudi celo stran navpicno.
         Premaknemo samo notranji vodoravni trak, brez animacije postavitve. */
      trak.scrollLeft = Math.max(
        0,
        trenutniGumb.offsetLeft - (trak.clientWidth - trenutniGumb.offsetWidth) / 2
      );
    }
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
      return '<label class="izvedba-znesek" data-action-control><span class="sr-only">Preostali dolg (€)</span>' +
        '<input class="izvedba-znesek__vnos" data-znesek-polje="remainingAmount" type="number" inputmode="decimal" step="0.01" min="0.01" value="' + K.esc(nastavitve.remainingAmount != null ? nastavitve.remainingAmount : "") + '" placeholder="Vnesite znesek" />' +
        '<span class="izvedba-znesek__ikona" aria-hidden="true">' + K.ikona("pencil") + '</span></label>';
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
    return '<label class="izvedba-action-sheet__datum"><span class="sr-only">' + K.esc(oznaka) + '</span>' +
      '<span class="izvedba-action-sheet__datum-ikona" aria-hidden="true">' + K.ikona("calendar") + '</span>' +
      '<span class="izvedba-action-sheet__datum-vrednost" data-izvedba-fit data-fit-min="9">' + K.esc(datumZaPrikaz(vrednost)) + '</span>' +
      '<input type="datetime-local" aria-label="' + K.esc(oznaka) + '" data-action-type="' + K.esc(actionType) + '" data-datetime-polje="' + K.esc(polje) + '" value="' + K.esc(datumZaVnos(vrednost)) + '" /></label>';
  }

  function izrisiActionCard(actionType) {
    var meta = K.AKCIJE_META[actionType];
    var sheetMeta = ACTION_SHEET_META[actionType];
    var izbrano = state.selectedActionType === actionType;
    return '<article class="izvedba-action-card izvedba-action-card--' + sheetMeta.razred + (izbrano ? ' is-selected' : '') + '" data-action-type="' + K.esc(actionType) + '">' +
      '<button type="button" class="izvedba-action-card__izbira" data-action-sheet-select="' + K.esc(actionType) + '" aria-pressed="' + String(izbrano) + '">' +
        '<span class="izvedba-action-card__ikona" aria-hidden="true">' + K.ikona(sheetMeta.ikona) + '</span>' +
        '<span class="izvedba-action-card__naslov" data-izvedba-fit data-fit-min="8">' + K.esc(meta.naslov) + '</span>' +
        '<span class="izvedba-action-card__opis">' + K.esc(sheetMeta.opis) + '</span>' +
      '</button>' +
      '<div class="izvedba-action-card__nastavitve">' +
        '<div class="izvedba-action-card__label"><span>' + K.esc(sheetMeta.nastavitev) + '</span><span class="izvedba-action-card__badge">' + K.esc(sheetMeta.badge) + '</span></div>' +
        podatkiZaKartico(actionType, izbrano) +
      '</div>' +
    '</article>';
  }

  function izrisiPoravnavaSegment(tip, polje, moznosti, izbrana) {
    return '<div class="izvedba-segment" role="group">' + moznosti.map(function (moznost) {
      return '<button type="button" class="izvedba-segment__gumb' + (moznost.vrednost === izbrana ? ' is-selected' : '') + '" ' +
        'data-settlement-segment="' + K.esc(polje) + '" data-settlement-value="' + K.esc(moznost.vrednost) + '" data-settlement-type="' + K.esc(tip) + '" ' +
        'data-izvedba-fit data-fit-min="8.5" aria-pressed="' + String(moznost.vrednost === izbrana) + '">' + K.esc(moznost.oznaka) + '</button>';
    }).join('') + '</div>';
  }

  function izrisiPoravnavaDatum(tip, vrednost, oznaka) {
    return '<label class="izvedba-action-sheet__datum"><span class="sr-only">' + K.esc(oznaka) + '</span>' +
      '<span class="izvedba-action-sheet__datum-ikona" aria-hidden="true">' + K.ikona("calendar") + '</span>' +
      '<span class="izvedba-action-sheet__datum-vrednost" data-izvedba-fit data-fit-min="9">' + K.esc(datumZaPrikaz(vrednost)) + '</span>' +
      '<input type="datetime-local" aria-label="' + K.esc(oznaka) + '" data-settlement-datetime="settledAt" data-settlement-type="' + K.esc(tip) + '" max="' + K.esc(datumZaVnos(new Date().toISOString())) + '" value="' + K.esc(datumZaVnos(vrednost)) + '" /></label>';
  }

  function izrisiPoravnavaZnesek(tip, polje, vrednost, placeholder) {
    return '<label class="izvedba-znesek" data-action-control><span class="sr-only">' + K.esc(placeholder) + '</span>' +
      '<input class="izvedba-znesek__vnos" data-settlement-amount="' + K.esc(polje) + '" data-settlement-type="' + K.esc(tip) + '" data-izvedba-fit data-fit-min="9" ' +
      'type="number" inputmode="decimal" step="0.01" min="0.01" value="' + K.esc(vrednost != null ? vrednost : '') + '" placeholder="' + K.esc(placeholder) + '" />' +
      '<span class="izvedba-znesek__ikona" aria-hidden="true">' + K.ikona("pencil") + '</span></label>';
  }

  function izrisiPoravnavaKontrolnik(tip, izbrano) {
    var nastavitve = state.settlementSettings[tip];
    if (tip === "full" || tip === "compensation") {
      var segment = izrisiPoravnavaSegment(tip, "dateMode", [
        { vrednost: "today", oznaka: "Danes" },
        { vrednost: "custom", oznaka: "Datum" },
      ], nastavitve.dateMode);
      return segment + (izbrano && nastavitve.dateMode === "custom" ? izrisiPoravnavaDatum(tip, nastavitve.settledAt, "Datum zaključka") : "");
    }
    if (tip === "partial" || tip === "installment") {
      return izrisiPoravnavaZnesek(tip, "paymentAmount", nastavitve.paymentAmount, "Vnesite znesek");
    }
    if (tip === "credit_note") {
      return izrisiPoravnavaZnesek(tip, "settlementAmount", nastavitve.settlementAmount, "Vnesite znesek");
    }
    return '<label class="izvedba-poravnava__razlog"><span class="sr-only">Razlog</span><select data-settlement-reason data-settlement-type="cancelled_invoice" aria-label="Razlog za storno">' +
      '<option value="">Izberite razlog</option><option value="duplicate">Podvojen račun</option><option value="incorrect">Napačen račun</option>' +
      '<option value="agreement">Dogovor z dolžnikom</option><option value="other">Drugo</option></select></label>';
  }

  function izrisiPoravnavaKartico(tip) {
    var meta = SETTLEMENT_META[tip];
    var izbrano = state.selectedSettlementType === tip;
    return '<article class="izvedba-action-card izvedba-action-card--poravnava-' + meta.razred + (izbrano ? ' is-selected' : '') + '" data-settlement-card="' + K.esc(tip) + '">' +
      '<button type="button" class="izvedba-action-card__izbira" data-settlement-select="' + K.esc(tip) + '" aria-pressed="' + String(izbrano) + '">' +
        '<span class="izvedba-action-card__ikona" aria-hidden="true">' + K.ikona(meta.ikona) + '</span>' +
        '<span class="izvedba-action-card__naslov" data-izvedba-fit data-fit-min="8">' + K.esc(meta.naslov) + '</span>' +
        '<span class="izvedba-action-card__opis" data-izvedba-fit data-fit-min="7.5">' + K.esc(meta.opis) + '</span>' +
      '</button><div class="izvedba-action-card__nastavitve">' +
        '<div class="izvedba-action-card__label"><span data-izvedba-fit data-fit-min="7.5">' + K.esc(meta.nastavitev) + '</span><span class="izvedba-action-card__badge" data-izvedba-fit data-fit-min="7">' + K.esc(meta.badge) + '</span></div>' +
        izrisiPoravnavaKontrolnik(tip, izbrano) + '</div></article>';
  }

  function izrisiPoravnavaSheet() {
    var meta = SETTLEMENT_META[state.selectedSettlementType];
    var kartice = SETTLEMENT_ORDER.map(izrisiPoravnavaKartico).join("");
    var dejanje = meta ? '<button type="button" class="izvedba-action-sheet__dejanje" data-action-sheet-confirm data-izvedba-fit data-fit-min="10" ' + (state.isSubmitting ? 'disabled' : '') + '>' +
      (state.isSubmitting ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span>' : '') + K.esc(meta.gumb) + '</button>' : '';
    elActionSheet.hidden = false;
    elActionSheet.innerHTML = '<div class="izvedba-action-sheet__backdrop" data-action-sheet-close></div>' +
      '<section class="izvedba-action-sheet__panel izvedba-action-sheet__panel--poravnano" role="dialog" aria-modal="true" aria-labelledby="izvedba-action-sheet-title">' +
        '<div class="izvedba-action-sheet__rocaj" aria-hidden="true"></div>' +
        '<header class="izvedba-action-sheet__header"><span class="izvedba-action-sheet__header-ikona" aria-hidden="true">' + K.ikona("checkCircle") + '</span><div>' +
          '<h2 id="izvedba-action-sheet-title" data-izvedba-fit data-fit-min="14">Kako je bil račun poravnan?</h2><p>Izberite način in po potrebi dopolnite podatke.</p></div>' +
          '<button type="button" class="izvedba-action-sheet__zapri" data-action-sheet-close aria-label="Zapri"><span aria-hidden="true">×</span></button></header>' +
        '<div class="izvedba-action-sheet__scroll"><div class="izvedba-action-sheet__mreza">' + kartice + '</div>' +
          '<div class="izvedba-action-sheet__footer">' + (state.error ? '<p class="izvedba-action-sheet__napaka" role="alert">' + K.esc(state.error) + '</p>' : '') +
            dejanje + '<button type="button" class="izvedba-action-sheet__nazaj" data-action-sheet-close>Nazaj</button></div></div></section>';
    document.body.classList.add("izvedba-sheet-open");
    requestAnimationFrame(function () { prilagodiBesediloOmejenemuPolju(elActionSheet); });
  }

  function izrisiActionSheet() {
    if (!elActionSheet) return;
    if (!state.actionSheetOpen) {
      elActionSheet.hidden = true;
      elActionSheet.innerHTML = "";
      document.body.classList.remove("izvedba-sheet-open");
      return;
    }
    if (state.actionSheetMode === "payment") {
      izrisiPoravnavaSheet();
      return;
    }
    var kartice = VRSTNI_RED_KARTIC.map(izrisiActionCard).join("");
    var panelRazred = state.selectedActionType ? " izvedba-action-sheet__panel--" + ACTION_SHEET_META[state.selectedActionType].razred : "";
    var dejanje = state.selectedActionType
      ? '<button type="button" class="izvedba-action-sheet__dejanje" data-action-sheet-confirm data-izvedba-fit data-fit-min="10" ' + (state.isSubmitting ? 'disabled' : '') + '>' +
          (state.isSubmitting ? '<span class="izvedba-sticky__loader" aria-hidden="true"></span>' : '') + K.esc(besediloGlavnegaGumba()) + '</button>'
      : "";
    elActionSheet.hidden = false;
    elActionSheet.innerHTML = '<div class="izvedba-action-sheet__backdrop" data-action-sheet-close></div>' +
      '<section class="izvedba-action-sheet__panel' + panelRazred + '" role="dialog" aria-modal="true" aria-labelledby="izvedba-action-sheet-title">' +
        '<div class="izvedba-action-sheet__rocaj" aria-hidden="true"></div>' +
        '<header class="izvedba-action-sheet__header"><span class="izvedba-action-sheet__header-ikona" aria-hidden="true">' + K.ikona("xCircle") + '</span><div>' +
          '<h2 id="izvedba-action-sheet-title">Kaj želite narediti?</h2><p>Izberite možnost in po potrebi prilagodite priporočeno nastavitev.</p></div>' +
          '<button type="button" class="izvedba-action-sheet__zapri" data-action-sheet-close aria-label="Zapri"><span aria-hidden="true">×</span></button></header>' +
        '<div class="izvedba-action-sheet__scroll">' +
          '<div class="izvedba-action-sheet__mreza">' + kartice + '</div>' +
          '<div class="izvedba-action-sheet__footer">' +
            (state.error ? '<p class="izvedba-action-sheet__napaka" role="alert">' + K.esc(state.error) + '</p>' : '') +
            dejanje + '<button type="button" class="izvedba-action-sheet__nazaj" data-action-sheet-close>Nazaj</button>' +
          '</div>' +
        '</div>' +
      '</section>';
    document.body.classList.add("izvedba-sheet-open");
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
    state.actionSheetOpen = false;
    state.selectedActionType = null;
    state.selectedSettlementType = null;
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
        submitSelectedAction();
        return;
      }
      if (state.actionSheetMode === "payment") {
        var poravnavaIzbira = event.target.closest("[data-settlement-select]");
        if (poravnavaIzbira) {
          state.selectedSettlementType = poravnavaIzbira.getAttribute("data-settlement-select");
          state.error = null;
          izrisiActionSheet();
          return;
        }
        var poravnavaSegment = event.target.closest("[data-settlement-segment]");
        if (poravnavaSegment) {
          var poravnavaTip = poravnavaSegment.getAttribute("data-settlement-type");
          state.selectedSettlementType = poravnavaTip;
          state.settlementSettings[poravnavaTip][poravnavaSegment.getAttribute("data-settlement-segment")] = poravnavaSegment.getAttribute("data-settlement-value");
          state.error = null;
          izrisiActionSheet();
          return;
        }
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
      if (state.actionSheetMode === "payment") {
        var poravnavaZnesek = event.target.closest("[data-settlement-amount]");
        if (poravnavaZnesek) {
          var znesekTip = poravnavaZnesek.getAttribute("data-settlement-type");
          state.selectedSettlementType = znesekTip;
          state.settlementSettings[znesekTip][poravnavaZnesek.getAttribute("data-settlement-amount")] = poravnavaZnesek.value === "" ? null : Number(poravnavaZnesek.value);
          state.error = null;
          prilagodiBesediloOmejenemuPolju(poravnavaZnesek.parentElement);
          return;
        }
        var poravnavaDatum = event.target.closest("[data-settlement-datetime]");
        if (poravnavaDatum) {
          var datumTip = poravnavaDatum.getAttribute("data-settlement-type");
          state.selectedSettlementType = datumTip;
          var poravnavaDatumVrednost = poravnavaDatum.value ? new Date(poravnavaDatum.value) : null;
          state.settlementSettings[datumTip].settledAt = poravnavaDatumVrednost && !Number.isNaN(poravnavaDatumVrednost.getTime()) ? poravnavaDatumVrednost.toISOString() : null;
          var poravnavaDatumPrikaz = poravnavaDatum.parentElement.querySelector(".izvedba-action-sheet__datum-vrednost");
          if (poravnavaDatumPrikaz) {
            poravnavaDatumPrikaz.textContent = datumZaPrikaz(poravnavaDatum.value);
            prilagodiBesediloOmejenemuPolju(poravnavaDatum.parentElement);
          }
          return;
        }
        var razlog = event.target.closest("[data-settlement-reason]");
        if (razlog) {
          state.selectedSettlementType = "cancelled_invoice";
          state.settlementSettings.cancelled_invoice.reason = razlog.value;
          state.error = null;
          return;
        }
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
