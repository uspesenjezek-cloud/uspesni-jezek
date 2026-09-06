"use strict";

/* Čista poslovna logika za stran "Izvedba" (7 nastavljivih ukrepov iz
 * razdelka 12/13 specifikacije). Brez DB klicev - vzame trenutno stanje
 * (plan, opomin_koraki DTO vrstice, zadeva) in izračuna nov plan +
 * spremembe vrstic, ki jih api/izvedi-opomin-ukrep.js pošlje RPC-ju
 * izvedi_opomin_ukrep, ta pa jih atomsko zapiše. Server VEDNO ponovno
 * validira nastavitve (razdelek 9 specifikacije) - frontend meje so
 * samo UX.
 *
 * Poenostavitev (dokumentirana v poročilu): premikanje datumov ne
 * upošteva še dovoljenih dni/okna v Europe/Ljubljana TZ (kot npr.
 * api/_lib/random-schedule.js) - to je priložnost za nadgradnjo, ni pa
 * blokada za osnovno funkcionalnost. Regeneracija sporočil pri delnem
 * plačilu je poenostavljena (zamenjava zneska v obstoječem besedilu),
 * ne polna predloga.
 */

var crypto = require("crypto");

var DEFAULT_ACTION_SETTINGS = {
  skip_current_step: {
    nextDelayDays: 0,
    skipReason: "",
    skipReasonDetail: "",
  },
  stop_plan: {
    resumeMode: "manual",
    resumeAt: null,
  },
  handoff_to_lawyer: {
    timingMode: "asap",
    scheduledHandoffAt: null,
  },
  postpone_reminder: {
    delayDays: 3,
  },
  payment_promised: {
    waitDays: 4,
  },
  partial_payment: {
    remainingAmount: null,
  },
};

var MEJE = {
  nextDelayDays: { min: 0, max: 30 },
  delayDays: { min: 1, max: 30 },
  waitDays: { min: 1, max: 60 },
};

function celoStevilo(vrednost) {
  var n = Number(vrednost);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function znotrajMeje(vrednost, meja) {
  return Number.isFinite(vrednost) && vrednost >= meja.min && vrednost <= meja.max;
}

function zaokrozi2(vrednost) {
  return Math.round(Number(vrednost) * 100) / 100;
}

function obreziBesedilo(vrednost, maxDolzina) {
  var s = String(vrednost == null ? "" : vrednost).trim();
  return s.length > maxDolzina ? s.slice(0, maxDolzina) : s;
}

function normalizirajIzbirniDatum(vrednost) {
  if (vrednost == null || vrednost === "") return { ok: true, value: null };
  var datum = new Date(vrednost);
  return Number.isNaN(datum.getTime())
    ? { ok: false, value: null }
    : { ok: true, value: datum.toISOString() };
}

/* Vhod iz čarovnika na strani "Izvedba" (izvedba.js) - dopolni obstoječi
   plan.steps[manual_lawyer].lawyerHandoff namesto polnega čarovnika iz
   opomin-nacrt-ui.js. Neznana/manjkajoča polja se preprosto izpustijo -
   preveriPredajoPopolno spodaj vseeno preveri popolnost pred izvedbo. */
function sanitizirajLawyerHandoffPatch(vhod) {
  if (!vhod || typeof vhod !== "object") return null;
  var patch = {};
  var imaPodatke = false;

  if (vhod.lawyerId) {
    patch.lawyerId = obreziBesedilo(vhod.lawyerId, 100);
    imaPodatke = true;
  }
  var snap = vhod.lawyerSnapshot;
  if (snap && typeof snap === "object") {
    patch.lawyerSnapshot = {
      name: obreziBesedilo(snap.name, 200),
      officeName: obreziBesedilo(snap.officeName, 200),
      email: obreziBesedilo(snap.email, 200),
      phone: obreziBesedilo(snap.phone, 60),
    };
    imaPodatke = true;
  }
  var pkg = vhod.selectedPackage;
  if (pkg && typeof pkg === "object" && pkg.packageId) {
    patch.selectedPackage = {
      packageId: obreziBesedilo(pkg.packageId, 100),
      title: obreziBesedilo(pkg.title, 200),
      priceCents: Number.isFinite(Number(pkg.priceCents)) ? Math.round(Number(pkg.priceCents)) : null,
    };
    imaPodatke = true;
  }
  if (Array.isArray(vhod.documents)) {
    patch.documents = vhod.documents.slice(0, 20).map(function (d) {
      return { id: obreziBesedilo(d && d.id, 60), title: obreziBesedilo(d && d.title, 200) };
    }).filter(function (d) { return d.id; });
    imaPodatke = true;
  }
  if (vhod.message != null) {
    patch.message = obreziBesedilo(vhod.message, 2000);
    imaPodatke = true;
  }
  if (Array.isArray(vhod.availableHandoffDays) && vhod.availableHandoffDays.length === 7) {
    patch.availableHandoffDays = vhod.availableHandoffDays.map(Boolean);
    imaPodatke = true;
  }
  if (Array.isArray(vhod.historyBeforePlan)) {
    patch.historyBeforePlan = vhod.historyBeforePlan.slice(0, 30).map(function (dogodek) {
      var d = dogodek && typeof dogodek === "object" ? dogodek : {};
      var nastavitve = d.settings && typeof d.settings === "object" ? d.settings : {};
      var znesek = Number(d.znesek != null ? d.znesek : nastavitve.paymentAmount);
      return {
        tip: obreziBesedilo(d.tip, 60),
        actionType: obreziBesedilo(d.actionType, 60),
        naslov: obreziBesedilo(d.naslov, 300),
        znesek: Number.isFinite(znesek) ? znesek : null,
        ikona: obreziBesedilo(d.ikona, 60),
        razred: obreziBesedilo(d.razred, 60),
        datum: obreziBesedilo(d.datum, 60),
        datumNeznan: d.datumNeznan === true,
        settings: {
          description: obreziBesedilo(nastavitve.description, 300),
          eventKind: obreziBesedilo(nastavitve.eventKind, 60),
          extensionStatus: obreziBesedilo(nastavitve.extensionStatus, 60),
          occurredAt: obreziBesedilo(nastavitve.occurredAt || nastavitve.settledAt, 60),
          occurredAtApproximation: obreziBesedilo(nastavitve.occurredAtApproximation, 120),
          promisedDate: obreziBesedilo(nastavitve.promisedDate, 60),
          installmentCount: Number.isFinite(Number(nastavitve.installmentCount)) ? Number(nastavitve.installmentCount) : null,
          paymentAmount: Number.isFinite(Number(nastavitve.paymentAmount)) ? Number(nastavitve.paymentAmount) : null,
          settlementType: obreziBesedilo(nastavitve.settlementType, 60),
          kind: obreziBesedilo(nastavitve.kind, 60),
          reason: obreziBesedilo(nastavitve.reason, 300),
          paymentMethod: obreziBesedilo(nastavitve.paymentMethod, 60),
          communicationChannel: obreziBesedilo(nastavitve.communicationChannel, 60),
          documentReference: obreziBesedilo(nastavitve.documentReference, 120),
          statementKind: obreziBesedilo(nastavitve.statementKind, 60),
          sourceDescription: obreziBesedilo(nastavitve.sourceDescription, 300),
          occurredAtUnknown: nastavitve.occurredAtUnknown === true,
          promisedDateUnknown: nastavitve.promisedDateUnknown === true,
        },
      };
    }).filter(function (d) { return d.tip || d.naslov; });
    imaPodatke = true;
  }
  if (vhod.riskAssessment && typeof vhod.riskAssessment === "object") {
    var latePayments = String(vhod.riskAssessment.latePayments == null ? "" : vhod.riskAssessment.latePayments);
    if (["unknown", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9plus"].indexOf(latePayments) !== -1) {
      patch.riskAssessment = { latePayments: latePayments };
      imaPodatke = true;
    }
  }

  return imaPodatke ? patch : null;
}

function validirajNastavitve(actionType, settings, context) {
  var vhod = settings && typeof settings === "object" ? settings : {};
  context = context || {};

  if (actionType === "skip_current_step") {
    var nextDelayDays = celoStevilo(
      vhod.nextDelayDays != null ? vhod.nextDelayDays : DEFAULT_ACTION_SETTINGS.skip_current_step.nextDelayDays
    );
    if (!znotrajMeje(nextDelayDays, MEJE.nextDelayDays)) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Število dni do naslednjega koraka mora biti med 1 in 30." };
    }
    var skipReason = obreziBesedilo(vhod.skipReason, 40);
    if (["", "debtor_agreement", "wrong_data", "not_needed", "other"].indexOf(skipReason) === -1) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Izbrani razlog preklica ni veljaven." };
    }
    var skipReasonDetail = skipReason === "other" ? obreziBesedilo(vhod.skipReasonDetail, 300) : "";
    return { ok: true, settings: { nextDelayDays: nextDelayDays, skipReason: skipReason, skipReasonDetail: skipReasonDetail } };
  }

  if (actionType === "stop_plan") {
    var resumeMode = vhod.resumeMode === "date" ? "date" : "manual";
    var resumeAt = null;
    if (resumeMode === "date") {
      resumeAt = vhod.resumeAt ? new Date(vhod.resumeAt) : null;
      if (!resumeAt || Number.isNaN(resumeAt.getTime()) || resumeAt.getTime() <= Date.now()) {
        return { ok: false, code: "INVALID_SETTINGS", napaka: "Datum ponovnega zagona mora biti veljaven in v prihodnosti." };
      }
    }
    return { ok: true, settings: { resumeMode: resumeMode, resumeAt: resumeAt ? resumeAt.toISOString() : null } };
  }

  if (actionType === "handoff_to_lawyer") {
    var timingMode = vhod.timingMode === "custom" ? "custom" : "asap";
    var scheduledHandoffAt = null;
    if (timingMode === "custom") {
      scheduledHandoffAt = vhod.scheduledHandoffAt ? new Date(vhod.scheduledHandoffAt) : null;
      if (!scheduledHandoffAt || Number.isNaN(scheduledHandoffAt.getTime()) || scheduledHandoffAt.getTime() <= Date.now()) {
        return { ok: false, code: "INVALID_SETTINGS", napaka: "Datum predaje mora biti veljaven in v prihodnosti." };
      }
    }
    return {
      ok: true,
      settings: {
        timingMode: timingMode,
        scheduledHandoffAt: scheduledHandoffAt ? scheduledHandoffAt.toISOString() : null,
        lawyerHandoff: sanitizirajLawyerHandoffPatch(vhod.lawyerHandoff),
      },
    };
  }

  if (actionType === "postpone_reminder") {
    var delayDays = celoStevilo(
      vhod.delayDays != null ? vhod.delayDays : DEFAULT_ACTION_SETTINGS.postpone_reminder.delayDays
    );
    if (!znotrajMeje(delayDays, MEJE.delayDays)) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Prestavitev mora biti med 1 in 30 dni." };
    }
    return { ok: true, settings: { delayDays: delayDays } };
  }

  if (actionType === "payment_promised") {
    var waitDays = celoStevilo(
      vhod.waitDays != null ? vhod.waitDays : DEFAULT_ACTION_SETTINGS.payment_promised.waitDays
    );
    if (!znotrajMeje(waitDays, MEJE.waitDays)) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Čakanje mora biti med 1 in 60 dni." };
    }
    var dovoljeniDogovori = ["full", "partial", "installment", "deadline", "compensation", "credit_note", "custom"];
    var agreementKind = dovoljeniDogovori.indexOf(vhod.agreementKind) >= 0 ? vhod.agreementKind : null;
    var opisDogovora = obreziBesedilo(vhod.description, 500);
    var dogovorjeniZnesekVhod = vhod.agreedAmount != null ? vhod.agreedAmount : vhod.promisedAmount;
    var dogovorjeniZnesek = dogovorjeniZnesekVhod == null || dogovorjeniZnesekVhod === "" ? null : zaokrozi2(dogovorjeniZnesekVhod);
    var preostaliDolgDogovora = Number(context.preostaliDolg);
    if (dogovorjeniZnesek != null && (!Number.isFinite(dogovorjeniZnesek) || dogovorjeniZnesek <= 0)) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Dogovorjeni znesek mora biti večji od 0." };
    }
    if (dogovorjeniZnesek != null && preostaliDolgDogovora > 0 && dogovorjeniZnesek > preostaliDolgDogovora + 0.009) {
      return { ok: false, code: "PAYMENT_EXCEEDS_DEBT", napaka: "Dogovorjeni znesek presega preostali dolg." };
    }
    var rokDogovora = normalizirajIzbirniDatum(vhod.dueAt != null ? vhod.dueAt : vhod.promisedDate);
    var datumDogovora = normalizirajIzbirniDatum(vhod.agreedAt != null ? vhod.agreedAt : vhod.occurredAt);
    if (!rokDogovora.ok || !datumDogovora.ok) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Datum dogovora ali rok plačila ni veljaven." };
    }
    var obrokiVhod = Array.isArray(vhod.installments) ? vhod.installments : [];
    if (obrokiVhod.length > 20) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Dogovor ima lahko največ 20 obrokov." };
    }
    var vsotaObrokov = 0;
    var obroki = [];
    for (var oi = 0; oi < obrokiVhod.length; oi++) {
      var obrokVhod = obrokiVhod[oi] || {};
      var znesekObroka = zaokrozi2(obrokVhod.amount);
      var rokObroka = normalizirajIzbirniDatum(obrokVhod.dueAt);
      var rokObrokaPriblizno = obreziBesedilo(obrokVhod.dueAtApproximation, 120);
      if (!Number.isFinite(znesekObroka) || znesekObroka <= 0 || !rokObroka.ok || (!rokObroka.value && obrokVhod.dueAtUnknown !== true && !rokObrokaPriblizno)) {
        return { ok: false, code: "INVALID_SETTINGS", napaka: "Vsak obrok potrebuje veljaven znesek in rok." };
      }
      vsotaObrokov = zaokrozi2(vsotaObrokov + znesekObroka);
      obroki.push({ amount: znesekObroka, dueAt: rokObroka.value, dueAtUnknown: obrokVhod.dueAtUnknown === true, dueAtApproximation: rokObrokaPriblizno || null });
    }
    if (obroki.length && dogovorjeniZnesek != null && Math.abs(vsotaObrokov - dogovorjeniZnesek) > 0.009) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Vsota obrokov se ne ujema z dogovorjenim zneskom." };
    }
    if (obroki.length && preostaliDolgDogovora > 0 && vsotaObrokov > preostaliDolgDogovora + 0.009) {
      return { ok: false, code: "PAYMENT_EXCEEDS_DEBT", napaka: "Vsota obrokov presega preostali dolg." };
    }
    var settingsDogovora = { waitDays: waitDays };
    if (agreementKind) settingsDogovora.agreementKind = agreementKind;
    if (dogovorjeniZnesek != null) {
      settingsDogovora.agreedAmount = dogovorjeniZnesek;
      settingsDogovora.promisedAmount = dogovorjeniZnesek;
    }
    if (datumDogovora.value) settingsDogovora.agreedAt = datumDogovora.value;
    if (rokDogovora.value) {
      settingsDogovora.dueAt = rokDogovora.value;
      settingsDogovora.promisedDate = rokDogovora.value;
    }
    if (vhod.occurredAtUnknown === true) settingsDogovora.occurredAtUnknown = true;
    if (vhod.promisedDateUnknown === true) settingsDogovora.promisedDateUnknown = true;
    var datumDogovoraPriblizno = obreziBesedilo(vhod.occurredAtApproximation, 120);
    var rokDogovoraPriblizno = obreziBesedilo(vhod.promisedDateApproximation, 120);
    if (datumDogovoraPriblizno) settingsDogovora.occurredAtApproximation = datumDogovoraPriblizno;
    if (rokDogovoraPriblizno) settingsDogovora.promisedDateApproximation = rokDogovoraPriblizno;
    if (obroki.length) {
      settingsDogovora.installmentCount = obroki.length;
      settingsDogovora.installments = obroki;
    }
    var nacinPlacila = obreziBesedilo(vhod.paymentMethod, 80);
    var kanal = obreziBesedilo(vhod.communicationChannel, 80);
    var vir = ["manual", "natural_language", "quick_action"].indexOf(vhod.source) >= 0 ? vhod.source : null;
    if (nacinPlacila) settingsDogovora.paymentMethod = nacinPlacila;
    if (kanal) settingsDogovora.communicationChannel = kanal;
    if (vir) settingsDogovora.source = vir;
    if (opisDogovora) settingsDogovora.description = opisDogovora;
    return { ok: true, settings: settingsDogovora };
  }

  if (actionType === "partial_payment") {
    var preostaliDolg = Number(context.preostaliDolg);
    var settlementTypeDelno = vhod.settlementType === "installment" ? "installment" : "partial";
    var paymentAmount = vhod.paymentAmount != null ? Number(vhod.paymentAmount) : null;
    var remainingAmount = paymentAmount != null ? zaokrozi2(preostaliDolg - paymentAmount) : Number(vhod.remainingAmount);
    if (!(preostaliDolg > 0)) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Trenutni dolg ni znan." };
    }
    if (!Number.isFinite(remainingAmount) || remainingAmount <= 0) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Preostali dolg mora biti večji od 0." };
    }
    if (remainingAmount >= preostaliDolg) {
      return { ok: false, code: "PAYMENT_EXCEEDS_DEBT", napaka: "Preostali dolg po plačilu mora biti manjši od trenutnega dolga." };
    }
    var placiloZnesek = zaokrozi2(preostaliDolg - remainingAmount);
    var settledAtDelno = vhod.settledAt ? new Date(vhod.settledAt) : new Date();
    if (Number.isNaN(settledAtDelno.getTime()) || settledAtDelno.getTime() > Date.now() + 300000) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Datum plačila ni veljaven." };
    }
    return {
      ok: true,
      settings: {
        remainingAmount: zaokrozi2(remainingAmount),
        paymentAmount: placiloZnesek,
        settlementType: settlementTypeDelno,
        settledAt: settledAtDelno.toISOString()
      },
      placiloZnesek: placiloZnesek,
      placiloVrsta: settlementTypeDelno
    };
  }

  if (actionType === "partial_settlement") {
    var preostaliDolgNed = Number(context.preostaliDolg);
    var kind = vhod.kind === "writeoff"
      ? "writeoff"
      : (vhod.kind === "compensation" ? "compensation" : "credit");
    var amountNed = Number(vhod.amount);
    if (!(preostaliDolgNed > 0)) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Trenutni dolg ni znan." };
    }
    if (!Number.isFinite(amountNed)) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Vnesite znesek, ki je večji od 0." };
    }
    var placiloZnesekNed = zaokrozi2(amountNed);
    if (!(placiloZnesekNed > 0)) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Vnesite znesek, ki je večji od 0." };
    }
    if (placiloZnesekNed >= preostaliDolgNed) {
      return { ok: false, code: "PAYMENT_EXCEEDS_DEBT", napaka: "Znesek mora biti manjši od trenutnega preostalega dolga." };
    }
    if (kind === "writeoff" && !String(vhod.reason || "").trim()) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Razlog za odpust je obvezen." };
    }
    var placiloVrstaNed = kind === "writeoff"
      ? "cancelled_invoice"
      : (kind === "compensation" ? "compensation" : "credit_note");
    var novPreostanekNed = zaokrozi2(preostaliDolgNed - placiloZnesekNed);
    var settledAtNed = vhod.settledAt ? new Date(vhod.settledAt) : new Date();
    if (Number.isNaN(settledAtNed.getTime()) || settledAtNed.getTime() > Date.now() + 300000) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Datum poravnave ni veljaven." };
    }
    return {
      ok: true,
      settings: {
        kind: kind,
        amount: placiloZnesekNed,
        remainingAmount: novPreostanekNed,
        reason: kind === "writeoff" ? String(vhod.reason) : null,
        settledAt: settledAtNed.toISOString()
      },
      placiloZnesek: placiloZnesekNed,
      placiloVrsta: placiloVrstaNed
    };
  }

  if (actionType === "paid_in_full") {
    var dovoljenePoravnave = ["full", "compensation", "credit_note", "cancelled_invoice"];
    var settlementType = dovoljenePoravnave.indexOf(vhod.settlementType) >= 0 ? vhod.settlementType : "full";
    var settledAt = vhod.settledAt ? new Date(vhod.settledAt) : new Date();
    if (Number.isNaN(settledAt.getTime()) || settledAt.getTime() > Date.now() + 300000) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Datum poravnave ni veljaven." };
    }
    if (settlementType === "credit_note") {
      var settlementAmount = Number(vhod.settlementAmount);
      if (!(Number(context.preostaliDolg) > 0) || !Number.isFinite(settlementAmount) || Math.abs(settlementAmount - Number(context.preostaliDolg)) > 0.009) {
        return { ok: false, code: "INVALID_SETTINGS", napaka: "Dobropis mora pokriti celotni preostali dolg." };
      }
    }
    if (settlementType === "cancelled_invoice" && !String(vhod.reason || "").trim()) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Razlog za storno je obvezen." };
    }
    return { ok: true, settings: {
      settlementType: settlementType,
      settledAt: settledAt.toISOString(),
      settlementAmount: settlementType === "credit_note" ? zaokrozi2(vhod.settlementAmount) : null,
      reason: settlementType === "cancelled_invoice" ? String(vhod.reason) : null
    }, placiloVrsta: settlementType };
  }

  if (actionType === "send_reminder") {
    return { ok: true, settings: {} };
  }

  return { ok: false, code: "UNKNOWN_ACTION_TYPE", napaka: "Neznan tip dejanja." };
}

function kanonicniJson(vrednost) {
  if (Array.isArray(vrednost)) {
    return "[" + vrednost.map(kanonicniJson).join(",") + "]";
  }
  if (vrednost && typeof vrednost === "object") {
    var kljuci = Object.keys(vrednost).sort();
    return "{" + kljuci.map(function (k) { return JSON.stringify(k) + ":" + kanonicniJson(vrednost[k]); }).join(",") + "}";
  }
  return JSON.stringify(vrednost === undefined ? null : vrednost);
}

function izracunajFingerprint(podatki) {
  var kanonicno = kanonicniJson({
    obrtnikId: podatki.obrtnikId,
    zadevaId: podatki.zadevaId,
    stepId: podatki.stepId || null,
    actionType: podatki.actionType,
    settings: podatki.settings || {},
  });
  return crypto.createHash("sha256").update(kanonicno).digest("hex");
}

function najdiKorakVPlanu(plan, stepId) {
  var steps = (plan && plan.steps) || [];
  for (var i = 0; i < steps.length; i++) {
    if (String(steps[i].stepId || steps[i].id || ("step-" + (i + 1))) === String(stepId)) {
      return { step: steps[i], index: i };
    }
  }
  return null;
}

function idKoraka(step, index) {
  return String((step && (step.stepId || step.id)) || ("step-" + (Number(index) + 1)));
}

function jePlanKorakZakljucen(step) {
  return ["sent", "cancelled", "skipped"].indexOf(String((step && step.status) || "")) >= 0;
}

function vkljuceniKoraki(plan) {
  var steps = (plan && plan.steps) || [];
  return steps
    .filter(function (s) { return !s.isExcluded; })
    .sort(function (a, b) { return Number(a.index) - Number(b.index); });
}

function jeKorakPoslan(vrsticeKoraka) {
  return vrsticeKoraka.some(function (k) { return k.executionState === "sent"; });
}

function povecajVerzijo(plan) {
  return String((Number(plan.version) || 0) + 1);
}

/* 12.1 Prekliči samo ta korak */
function izracunajPreklicKoraka(ctx) {
  var plan = ctx.plan, koraki = ctx.koraki, stepId = ctx.stepId, nextDelayDays = ctx.settings.nextDelayDays;
  var skipReason = ctx.settings.skipReason || "", skipReasonDetail = ctx.settings.skipReasonDetail || "";
  var najden = najdiKorakVPlanu(plan, stepId);
  if (!najden) return { ok: false, code: "STEP_NOT_FOUND" };

  var trenutniKoraki = koraki.filter(function (k) { return k.stepId === stepId; });
  if (jeKorakPoslan(trenutniKoraki) || (!trenutniKoraki.length && jePlanKorakZakljucen(najden.step))) {
    return { ok: false, code: "STEP_ALREADY_SENT" };
  }

  var vkljuceni = vkljuceniKoraki(plan);
  var trenutniIndex = vkljuceni.findIndex(function (s, index) { return idKoraka(s, index) === String(stepId); });
  if (trenutniIndex === -1) return { ok: false, code: "STEP_NOT_FOUND" };

  var korakiUpdates = trenutniKoraki.map(function (k) {
    return { id: k.id, execution_state: "skipped", status: "cancelled", cancel_reason: "user_skipped" };
  });

  var naslednjiStepId = null;
  for (var i = trenutniIndex + 1; i < vkljuceni.length; i++) {
    var kandidatId = idKoraka(vkljuceni[i], i);
    var kandidatKoraki = koraki.filter(function (k) { return k.stepId === kandidatId; });
    if ((kandidatKoraki.length && !jeKorakPoslan(kandidatKoraki)) ||
        (!kandidatKoraki.length && !jePlanKorakZakljucen(vkljuceni[i]))) {
      naslednjiStepId = kandidatId;
      break;
    }
  }

  var novPlan = JSON.parse(JSON.stringify(plan));
  var noviTrenutni = najdiKorakVPlanu(novPlan, stepId);
  if (noviTrenutni) {
    noviTrenutni.step.status = "skipped";
    if (skipReason) {
      noviTrenutni.step.skipReason = skipReason;
      noviTrenutni.step.skipReasonDetail = skipReasonDetail || null;
    }
  }

  if (naslednjiStepId) {
    var zamikMs = nextDelayDays * 86400000;
    var osnovniCasMs = Date.now() + zamikMs;
    var naslednjiTrenutniKoraki = koraki.filter(function (k) { return k.stepId === naslednjiStepId; });
    var naslednjiVPlanu = najdiKorakVPlanu(plan, naslednjiStepId);
    var staraZaporednaVrednostMs = naslednjiTrenutniKoraki.length
      ? Date.parse(naslednjiTrenutniKoraki[0].scheduledAt)
      : Date.parse(naslednjiVPlanu && (naslednjiVPlanu.step.sendAt || naslednjiVPlanu.step.scheduledAt));
    if (!Number.isFinite(staraZaporednaVrednostMs)) staraZaporednaVrednostMs = osnovniCasMs;
    var razlikaMs = osnovniCasMs - staraZaporednaVrednostMs;

    naslednjiTrenutniKoraki.forEach(function (k) {
      korakiUpdates.push({ id: k.id, scheduled_at: new Date(osnovniCasMs).toISOString(), execution_state: "scheduled" });
    });
    var noviNaslednji = najdiKorakVPlanu(novPlan, naslednjiStepId);
    if (noviNaslednji) {
      noviNaslednji.step.sendAt = new Date(osnovniCasMs).toISOString();
      noviNaslednji.step.scheduledAt = noviNaslednji.step.sendAt;
    }

    var naslednjiIndexVSeznamu = vkljuceni.findIndex(function (s, index) { return idKoraka(s, index) === naslednjiStepId; });
    for (var j = naslednjiIndexVSeznamu + 1; j < vkljuceni.length; j++) {
      var poznejsiId = idKoraka(vkljuceni[j], j);
      var poznejsiKoraki = koraki.filter(function (k) { return k.stepId === poznejsiId; });
      if (jeKorakPoslan(poznejsiKoraki) || (!poznejsiKoraki.length && jePlanKorakZakljucen(vkljuceni[j]))) continue;
      poznejsiKoraki.forEach(function (k) {
        var novCasMs = Date.parse(k.scheduledAt) + razlikaMs;
        if (Number.isFinite(novCasMs)) korakiUpdates.push({ id: k.id, scheduled_at: new Date(novCasMs).toISOString() });
      });
      var poznejsiVPlanu = najdiKorakVPlanu(novPlan, poznejsiId);
      if (poznejsiVPlanu) {
        var osnova = poznejsiVPlanu.step.sendAt || poznejsiVPlanu.step.scheduledAt;
        var novCasPlanMs = Date.parse(osnova) + razlikaMs;
        if (Number.isFinite(novCasPlanMs)) {
          poznejsiVPlanu.step.sendAt = new Date(novCasPlanMs).toISOString();
          poznejsiVPlanu.step.scheduledAt = poznejsiVPlanu.step.sendAt;
        }
      }
    }
  }

  novPlan.version = povecajVerzijo(plan);
  return { ok: true, newPlan: novPlan, korakiUpdates: korakiUpdates, nextStepId: naslednjiStepId };
}

/* 12.2 Ustavi celoten načrt */
function izracunajUstavitevNacrta(ctx) {
  var plan = ctx.plan, koraki = ctx.koraki, settings = ctx.settings;
  var neposlaniKoraki = koraki.filter(function (k) {
    return k.executionState !== "sent" && k.executionState !== "cancelled" && k.executionState !== "skipped";
  });
  var korakiUpdates = neposlaniKoraki.map(function (k) {
    return { id: k.id, execution_state: "paused", paused_until: settings.resumeMode === "date" ? settings.resumeAt : null };
  });

  var novPlan = JSON.parse(JSON.stringify(plan));
  novPlan.status = "paused";
  novPlan.pausedAt = new Date().toISOString();
  novPlan.resumeMode = settings.resumeMode;
  novPlan.resumeAt = settings.resumeAt || null;
  novPlan.version = povecajVerzijo(plan);

  return { ok: true, newPlan: novPlan, korakiUpdates: korakiUpdates };
}

function preveriPredajoPopolno(lawyerHandoff) {
  var manjkajoce = [];
  var lh = lawyerHandoff || {};
  var snap = lh.lawyerSnapshot || {};
  if (!lh.lawyerId && !String(snap.name || "").trim() && !String(snap.officeName || "").trim()) {
    manjkajoce.push("Izbran odvetnik");
  }
  if (!lh.selectedPackage || !lh.selectedPackage.packageId) {
    manjkajoce.push("Izbran paket");
  }
  if (!Array.isArray(lh.documents) || !lh.documents.length) {
    manjkajoce.push("Zahtevani dokumenti");
  }
  if (!String(lh.message || "").trim()) {
    manjkajoce.push("Sporočilo odvetniku");
  }
  return manjkajoce;
}

/* 12.3 Posreduj takoj odvetniku */
function izracunajPredajoOdvetniku(ctx) {
  var plan = ctx.plan, koraki = ctx.koraki, settings = ctx.settings;
  var steps = (plan && plan.steps) || [];
  var lawyerStep = steps.filter(function (s) { return s.kind === "manual_lawyer"; }).pop();
  if (!lawyerStep) return { ok: false, code: "LAWYER_STEP_NOT_FOUND" };
  var lawyerStepIndex = steps.indexOf(lawyerStep);
  var lawyerStepId = idKoraka(lawyerStep, lawyerStepIndex);

  var novPlan = JSON.parse(JSON.stringify(plan));
  var noviLawyerStep = najdiKorakVPlanu(novPlan, lawyerStepId).step;
  if (settings.lawyerHandoff) {
    noviLawyerStep.lawyerHandoff = Object.assign({}, noviLawyerStep.lawyerHandoff || {}, settings.lawyerHandoff);
  }

  var manjkajoce = preveriPredajoPopolno(noviLawyerStep.lawyerHandoff);
  if (manjkajoce.length) {
    return { ok: false, code: "MISSING_HANDOFF_DATA", missing: manjkajoce };
  }

  var vkljuceni = vkljuceniKoraki(plan);
  var korakiUpdates = [];
  vkljuceni.forEach(function (s, index) {
    var stepId = idKoraka(s, index);
    if (stepId === lawyerStepId) return;
    var vrsticeKoraka = koraki.filter(function (k) { return k.stepId === stepId; });
    if (!vrsticeKoraka.length || jeKorakPoslan(vrsticeKoraka)) return;
    vrsticeKoraka.forEach(function (k) {
      korakiUpdates.push({ id: k.id, execution_state: "cancelled", status: "cancelled", cancel_reason: "handoff_to_lawyer" });
    });
  });

  var novCas = settings.timingMode === "custom" && settings.scheduledHandoffAt
    ? settings.scheduledHandoffAt
    : new Date().toISOString();

  var lawyerKoraki = koraki.filter(function (k) { return k.stepId === lawyerStepId; });
  lawyerKoraki.forEach(function (k) {
    korakiUpdates.push({ id: k.id, execution_state: "awaiting_confirmation", scheduled_at: novCas });
  });

  noviLawyerStep.status = "scheduled";
  noviLawyerStep.sendAt = novCas;
  noviLawyerStep.scheduledAt = novCas;
  novPlan.version = povecajVerzijo(plan);

  return { ok: true, newPlan: novPlan, korakiUpdates: korakiUpdates };
}

/* 12.4 Prestavi opomin */
function izracunajPrestavitevOpomina(ctx) {
  var plan = ctx.plan, koraki = ctx.koraki, stepId = ctx.stepId, delayDays = ctx.settings.delayDays;
  var najden = najdiKorakVPlanu(plan, stepId);
  if (!najden) return { ok: false, code: "STEP_NOT_FOUND" };
  var trenutniKoraki = koraki.filter(function (k) { return k.stepId === stepId; });
  if (jeKorakPoslan(trenutniKoraki) || (!trenutniKoraki.length && jePlanKorakZakljucen(najden.step))) {
    return { ok: false, code: "STEP_ALREADY_SENT" };
  }

  var vkljuceni = vkljuceniKoraki(plan);
  var trenutniIndex = vkljuceni.findIndex(function (s, index) { return idKoraka(s, index) === String(stepId); });
  if (trenutniIndex === -1) return { ok: false, code: "STEP_NOT_FOUND" };

  var zamikMs = delayDays * 86400000;
  var korakiUpdates = [];

  for (var i = trenutniIndex; i < vkljuceni.length; i++) {
    var id = idKoraka(vkljuceni[i], i);
    var vrstice = koraki.filter(function (k) { return k.stepId === id; });
    if (jeKorakPoslan(vrstice) || (!vrstice.length && jePlanKorakZakljucen(vkljuceni[i]))) continue;
    vrstice.forEach(function (k) {
      var novCasMs = Date.parse(k.scheduledAt) + zamikMs;
      if (Number.isFinite(novCasMs)) {
        korakiUpdates.push({
          id: k.id,
          scheduled_at: new Date(novCasMs).toISOString(),
          execution_state: "scheduled",
        });
      }
    });
  }

  var novPlan = JSON.parse(JSON.stringify(plan));
  for (var j = trenutniIndex; j < vkljuceni.length; j++) {
    var stepIdJ = idKoraka(vkljuceni[j], j);
    var vrsticeJ = koraki.filter(function (k) { return k.stepId === stepIdJ; });
    if (jeKorakPoslan(vrsticeJ) || (!vrsticeJ.length && jePlanKorakZakljucen(vkljuceni[j]))) continue;
    var noviStep = najdiKorakVPlanu(novPlan, stepIdJ).step;
    var osnovaMs = Date.parse(noviStep.sendAt || noviStep.scheduledAt) + zamikMs;
    if (Number.isFinite(osnovaMs)) {
      noviStep.sendAt = new Date(osnovaMs).toISOString();
      noviStep.scheduledAt = noviStep.sendAt;
    }
    if (stepIdJ === stepId) noviStep.status = "scheduled";
  }
  novPlan.version = povecajVerzijo(plan);

  return { ok: true, newPlan: novPlan, korakiUpdates: korakiUpdates };
}

/* 12.5 Dolžnik je obljubil plačilo */
function izracunajObljuboPlacila(ctx) {
  var plan = ctx.plan, koraki = ctx.koraki, waitDays = ctx.settings.waitDays;
  var promisedUntil = new Date(Date.now() + waitDays * 86400000).toISOString();
  var neposlani = koraki.filter(function (k) {
    return k.executionState !== "sent" && k.executionState !== "cancelled" && k.executionState !== "skipped";
  });
  var korakiUpdates = neposlani.map(function (k) {
    return { id: k.id, execution_state: "paused", paused_until: promisedUntil };
  });

  var novPlan = JSON.parse(JSON.stringify(plan));
  novPlan.status = "waiting_for_promised_payment";
  novPlan.promisedPaymentUntil = promisedUntil;
  delete novPlan.promisedPaymentNotifiedAt;
  novPlan.version = povecajVerzijo(plan);

  return { ok: true, newPlan: novPlan, korakiUpdates: korakiUpdates };
}

/* 12.6 Račun je delno poravnan - placiloZnesek/novPreostanek sta že
 * izračunana v validirajNastavitve/klicatelju. */
function izracunajDelnoPlacilo(ctx) {
  var plan = ctx.plan, koraki = ctx.koraki, placiloZnesek = ctx.placiloZnesek, novPreostanek = ctx.novPreostanek;
  var novPlan = JSON.parse(JSON.stringify(plan));
  var steps = novPlan.steps || [];

  steps.forEach(function (step) {
    var vrstice = koraki.filter(function (k) { return k.stepId === step.id; });
    if (jeKorakPoslan(vrstice)) return;
    if (step.messageEditedManually) return;
    if (typeof step.finalMessage === "string" && step.finalMessage) {
      step.finalMessage = step.finalMessage.replace(
        /\d+[.,]\d{2}\s?€/g,
        String(novPreostanek.toFixed(2)).replace(".", ",") + " €"
      );
      step.messageNeedsReview = true;
    }
  });

  novPlan.version = povecajVerzijo(plan);
  return { ok: true, newPlan: novPlan, korakiUpdates: [], placiloZnesek: placiloZnesek };
}

/* Razveljavitev že zabeležene delne poravnave mora popraviti tudi zneske v
 * prihodnjih, še neposlanih sporočilih. Sam RPC nato v isti transakciji vrne
 * finančne stolpce in izbriše pripadajoči knjigovodski zapis. */
function izracunajRazveljavitevPoravnave(ctx) {
  var plan = ctx.plan, koraki = ctx.koraki, novPreostanek = Number(ctx.novPreostanek);
  if (!Number.isFinite(novPreostanek) || novPreostanek <= 0) {
    return { ok: false, code: "INVALID_SETTINGS", napaka: "Obnovljeni preostali dolg ni veljaven." };
  }
  var novPlan = JSON.parse(JSON.stringify(plan || {}));
  if (ctx.zakljucnaPoravnava) {
    novPlan.status = "active";
    delete novPlan.settlement;
  }
  (novPlan.steps || []).forEach(function (step) {
    var stepId = String(step.stepId || step.id || "");
    var vrstice = (koraki || []).filter(function (k) { return String(k.stepId) === stepId; });
    if (jeKorakPoslan(vrstice) || step.messageEditedManually) return;
    if (typeof step.finalMessage === "string" && step.finalMessage) {
      step.finalMessage = step.finalMessage.replace(
        /\d+[.,]\d{2}\s?€/g,
        String(novPreostanek.toFixed(2)).replace(".", ",") + " €"
      );
      step.messageNeedsReview = true;
    }
  });
  novPlan.version = povecajVerzijo(plan || {});
  return { ok: true, newPlan: novPlan, korakiUpdates: [] };
}

/* 13. Račun je bil poravnan (polno plačilo) */
function izracunajPolnoPlacilo(ctx) {
  var plan = ctx.plan, koraki = ctx.koraki, settings = ctx.settings || {};
  var settlementType = settings.settlementType || "full";
  var neposlani = koraki.filter(function (k) {
    return k.executionState !== "sent" && k.executionState !== "cancelled" && k.executionState !== "skipped";
  });
  var korakiUpdates = neposlani.map(function (k) {
    return { id: k.id, execution_state: "cancelled", status: "cancelled", cancel_reason: settlementType };
  });

  var novPlan = JSON.parse(JSON.stringify(plan));
  var statusi = { full: "completed_paid", compensation: "completed_compensated", credit_note: "completed_credited", cancelled_invoice: "completed_cancelled" };
  novPlan.status = statusi[settlementType] || "completed_paid";
  novPlan.settlement = {
    type: settlementType,
    settledAt: settings.settledAt || new Date().toISOString(),
    amount: settings.settlementAmount != null ? settings.settlementAmount : null,
    reason: settings.reason || null,
  };
  novPlan.version = povecajVerzijo(plan);

  return { ok: true, newPlan: novPlan, korakiUpdates: korakiUpdates };
}

function izracunajUkrep(actionType, ctx) {
  switch (actionType) {
    case "skip_current_step": return izracunajPreklicKoraka(ctx);
    case "stop_plan": return izracunajUstavitevNacrta(ctx);
    case "handoff_to_lawyer": return izracunajPredajoOdvetniku(ctx);
    case "postpone_reminder": return izracunajPrestavitevOpomina(ctx);
    case "payment_promised": return izracunajObljuboPlacila(ctx);
    case "partial_payment": return izracunajDelnoPlacilo(ctx);
    case "partial_settlement": return izracunajDelnoPlacilo(ctx);
    case "paid_in_full": return izracunajPolnoPlacilo(ctx);
    default: return { ok: false, code: "UNKNOWN_ACTION_TYPE" };
  }
}

module.exports = {
  DEFAULT_ACTION_SETTINGS: DEFAULT_ACTION_SETTINGS,
  validirajNastavitve: validirajNastavitve,
  izracunajFingerprint: izracunajFingerprint,
  izracunajUkrep: izracunajUkrep,
  izracunajRazveljavitevPoravnave: izracunajRazveljavitevPoravnave,
  _test: {
    najdiKorakVPlanu: najdiKorakVPlanu,
    vkljuceniKoraki: vkljuceniKoraki,
    jeKorakPoslan: jeKorakPoslan,
    preveriPredajoPopolno: preveriPredajoPopolno,
    izracunajPreklicKoraka: izracunajPreklicKoraka,
    izracunajUstavitevNacrta: izracunajUstavitevNacrta,
    izracunajPredajoOdvetniku: izracunajPredajoOdvetniku,
    izracunajPrestavitevOpomina: izracunajPrestavitevOpomina,
    izracunajObljuboPlacila: izracunajObljuboPlacila,
    izracunajDelnoPlacilo: izracunajDelnoPlacilo,
    izracunajPolnoPlacilo: izracunajPolnoPlacilo,
  },
};
