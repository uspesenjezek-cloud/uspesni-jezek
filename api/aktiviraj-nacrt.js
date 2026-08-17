var sentry = require("./_lib/sentry");
"use strict";

var DateTime = require("luxon").DateTime;
var db = require("./_lib/supabase-server");
var random = require("./_lib/random-schedule");

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function veljavenUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function normalizirajTelefon(value) {
  var phone = String(value || "").trim();
  return phone.length >= 6 && phone.length <= 40 ? phone : "";
}

function prejemnikiKoraka(step, primaryPhone) {
  var telefoni = [];
  var seen = Object.create(null);
  function dodaj(value) {
    var phone = normalizirajTelefon(value);
    if (!phone || seen[phone]) return;
    seen[phone] = true;
    telefoni.push(phone);
  }
  if (!step.primaryContacts || step.primaryContacts.sms !== false) dodaj(primaryPhone);
  var custom = step.customContacts && step.customContacts.phoneNumbers;
  if (Array.isArray(custom)) custom.forEach(dodaj);
  return telefoni;
}

function pripraviAktivacijo(zadeva, expectedVersion, nowIso) {
  var plan = jsonClone(zadeva.opomin_nacrt);
  if (!plan || !Array.isArray(plan.steps)) {
    var noPlan = new Error("Načrt manjka ali je poškodovan.");
    noPlan.code = "INVALID_PLAN";
    throw noPlan;
  }

  var serverVersion = String(plan.version || "0");
  if (String(expectedVersion || "0") !== serverVersion) {
    var conflict = new Error("Podatki so zastareli.");
    conflict.code = "VERSION_CONFLICT";
    conflict.serverVersion = serverVersion;
    throw conflict;
  }

  var planId = String(plan.planId || plan.id || ("plan-" + zadeva.id));
  var dovoljenoOkno = plan.allowedSendWindow || {};
  var dovoljenoOd = String(dovoljenoOkno.start || "07:00");
  var dovoljenoDo = String(dovoljenoOkno.end || "21:00");
  var dovoljenoOdMinute = random.minuteIzUre(dovoljenoOd, "07:00");
  var dovoljenoDoMinute = random.minuteIzUre(dovoljenoDo, "21:00");
  if (dovoljenoDoMinute <= dovoljenoOdMinute) {
    var invalidWindow = new Error("Dovoljeni čas pošiljanja ni veljaven.");
    invalidWindow.code = "INVALID_SEND_WINDOW";
    throw invalidWindow;
  }
  var rows = [];
  var previousScheduled = null;
  var serverNow = nowIso || new Date().toISOString();

  plan.steps.forEach(function (step) {
    if (!step || step.isExcluded || step.kind === "manual_lawyer" || step.deliveryMode === "manual") return;
    if (step.status !== "confirmed" && step.status !== "scheduled") {
      var notConfirmed = new Error("Vsi vključeni SMS-koraki morajo biti potrjeni.");
      notConfirmed.code = "STEP_NOT_CONFIRMED";
      throw notConfirmed;
    }

    var uporabiLocenoOkno =
      plan.allowedSendWindowMode === "per_step" ||
      (plan.allowedSendWindowMode == null && step.allowedSendWindow);
    var dovoljenoOknoKoraka =
      (uporabiLocenoOkno && step.allowedSendWindow) || dovoljenoOkno;
    dovoljenoOd = String(dovoljenoOknoKoraka.start || "07:00");
    dovoljenoDo = String(dovoljenoOknoKoraka.end || "21:00");
    dovoljenoOdMinute = random.minuteIzUre(dovoljenoOd, "07:00");
    dovoljenoDoMinute = random.minuteIzUre(dovoljenoDo, "21:00");
    if (dovoljenoDoMinute <= dovoljenoOdMinute) {
      var invalidStepWindow = new Error(
        "Dovoljeni čas pošiljanja za korak " + step.index + " ni veljaven."
      );
      invalidStepWindow.code = "INVALID_SEND_WINDOW";
      throw invalidStepWindow;
    }

    var stepIndex = Number(step.index);
    var settings = random.odstraniPredogled(step._randomSchedule);
    settings.minSendTime = dovoljenoOd;
    settings.maxSendTime = dovoljenoDo;
    var baseIso = (step._randomSchedule && step._randomSchedule._previewBaseAt) || step.sendAt || step.scheduledAt;
    var finalIso;

    if (settings.enabled) {
      if (stepIndex === 1) {
        var firstRandom = new Error("Naključni čas je dovoljen šele od 2. koraka naprej.");
        firstRandom.code = "RANDOM_FIRST_STEP";
        throw firstRandom;
      }
      var resolved = random.izracunajRandomCas(baseIso, settings, null, previousScheduled);
      finalIso = resolved.resolvedScheduledAt;
      settings.resolvedScheduledAt = finalIso;
      settings.resolvedAt = serverNow;
      settings.resolvedMinutes = resolved.chosenMinutes;
    } else {
      var fixed = DateTime.fromISO(String(baseIso || ""), { zone: random.TZ });
      if (!fixed.isValid) {
        var invalidFixed = new Error("Korak nima veljavnega časa pošiljanja.");
        invalidFixed.code = "INVALID_STEP_TIME";
        throw invalidFixed;
      }
      var fixedMinute = fixed.hour * 60 + fixed.minute;
      if (
        fixedMinute < dovoljenoOdMinute ||
        fixedMinute > dovoljenoDoMinute
      ) {
        var outsideWindow = new Error(
          "Korak " +
            stepIndex +
            " je zunaj dovoljenega časa " +
            dovoljenoOd +
            "–" +
            dovoljenoDo +
            "."
        );
        outsideWindow.code = "OUTSIDE_SEND_WINDOW";
        throw outsideWindow;
      }
      finalIso = fixed.toUTC().toISO();
      settings.resolvedScheduledAt = null;
      settings.resolvedAt = null;
    }

    if (previousScheduled && DateTime.fromISO(finalIso).toMillis() < DateTime.fromISO(previousScheduled).toMillis()) {
      var orderError = new Error("Čas naslednjega koraka ne sme biti pred prejšnjim korakom.");
      orderError.code = "INVALID_STEP_ORDER";
      throw orderError;
    }
    previousScheduled = finalIso;

    var message = String(step.finalMessage || step.generatedMessage || "").trim();
    if (!message) {
      var noMessage = new Error("SMS sporočilo v koraku " + stepIndex + " je prazno.");
      noMessage.code = "EMPTY_MESSAGE";
      throw noMessage;
    }

    var recipients = prejemnikiKoraka(step, zadeva.telefon_dolznika);
    if (!recipients.length) {
      var noRecipient = new Error("Korak " + stepIndex + " nima veljavnega SMS-prejemnika.");
      noRecipient.code = "NO_SMS_RECIPIENT";
      throw noRecipient;
    }

    var stepId = String(step.stepId || step.id || ("step-" + stepIndex));
    step.stepId = stepId;
    step.sendAt = finalIso;
    step.scheduledAt = finalIso;
    step.status = "scheduled";
    step._randomSchedule = settings;

    recipients.forEach(function (phone, recipientIndex) {
      rows.push({
        plan_id: planId,
        step_id: stepId,
        step_index: stepIndex,
        recipient_index: recipientIndex,
        prejemnik: phone,
        sporocilo: message,
        scheduled_at: finalIso,
        idempotency_key: planId + ":" + stepId + ":" + recipientIndex,
      });
    });
  });

  if (!rows.length) {
    var empty = new Error("Načrt nima nobenega SMS-koraka za pošiljanje.");
    empty.code = "NO_SCHEDULED_STEPS";
    throw empty;
  }

  plan.planId = planId;
  plan.status = "active";
  plan.serverActivatedAt = serverNow;
  plan.updatedAt = serverNow;
  plan.version = String(Number(serverVersion) + 1);
  plan.stages = plan.steps;
  return { plan: plan, rows: rows, oldVersion: serverVersion };
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, napaka: "Samo POST." });

  /* Kill switch: dokler ni izbran in konfiguriran SMS ponudnik, se ne sme
     ustvariti vrsta, ki bi se ob kasnejšem vklopu nenadoma vsa poslala. */
  if (process.env.OPOMIN_SCHEDULER_ENABLED !== "true" ||
      !process.env.SMS_PROVIDER_URL || !process.env.SMS_PROVIDER_TOKEN) {
    return res.status(503).json({
      ok: false,
      code: "SCHEDULER_DISABLED",
      napaka: "Načrt je shranjen, samodejno pošiljanje pa še ni vključeno.",
    });
  }

  try {
    var cfg = db.konfiguracija();
    var auth = await db.preveriUporabnika(req, cfg);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, napaka: auth.napaka });

    var body = req.body || {};
    if (!veljavenUuid(body.zadevaId)) {
      return res.status(400).json({ ok: false, napaka: "Neveljaven ID zadeve." });
    }

    var zadeva = await db.preberiZadevo(cfg, body.zadevaId);
    if (!zadeva) return res.status(404).json({ ok: false, napaka: "Zadeva ni najdena." });
    if (zadeva.obrtnik_id !== auth.user.id) {
      return res.status(403).json({ ok: false, napaka: "Dostop zavrnjen." });
    }

    if (zadeva.opomin_nacrt && zadeva.opomin_nacrt.serverActivatedAt) {
      return res.json({
        ok: true,
        alreadyActivated: true,
        version: String(zadeva.opomin_nacrt.version || "0"),
      });
    }

    var prepared = pripraviAktivacijo(zadeva, body.version);
    var result = await db.pokliciRpc(cfg, "aktiviraj_opomin_nacrt", {
      p_zadeva_id: zadeva.id,
      p_expected_version: prepared.oldVersion,
      p_plan: prepared.plan,
      p_steps: prepared.rows,
    });

    if (!result || result.ok !== true) {
      var code = result && result.code;
      return res.status(code === "VERSION_CONFLICT" ? 409 : 400).json({
        ok: false,
        code: code || "ACTIVATION_FAILED",
        napaka: code === "VERSION_CONFLICT" ? "Podatki so zastareli. Osvežite stran." : "Načrta ni bilo mogoče aktivirati.",
      });
    }

    return res.json({
      ok: true,
      alreadyActivated: Boolean(result.alreadyActivated),
      version: result.version,
      scheduledCount: result.scheduledCount,
    });
  } catch (err) {
    var clientCodes = ["INVALID_PLAN", "VERSION_CONFLICT", "STEP_NOT_CONFIRMED", "RANDOM_FIRST_STEP", "INVALID_STEP_TIME", "INVALID_STEP_ORDER", "INVALID_PREVIOUS_TIME", "EMPTY_MESSAGE", "NO_SMS_RECIPIENT", "NO_SCHEDULED_STEPS", "INVALID_TIME", "INVALID_HARD_LIMIT", "INVALID_WINDOW", "EMPTY_RANGE"];
    var status = err.code === "VERSION_CONFLICT" ? 409 : (clientCodes.indexOf(err.code) >= 0 ? 400 : 500);
    if (status === 500) console.error("[aktiviraj-nacrt]", err.code || err.message);
    return res.status(status).json({
      ok: false,
      code: err.code || "SERVER_ERROR",
      napaka: status === 500 ? "Načrta trenutno ni bilo mogoče aktivirati." : err.message,
      serverVersion: err.serverVersion,
    });
  }
}

module.exports = sentry.wrapHandler(handler, "/api/aktiviraj-nacrt");

module.exports._test = {
  pripraviAktivacijo: pripraviAktivacijo,
  prejemnikiKoraka: prejemnikiKoraka,
};
