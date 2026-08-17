var sentry = require("./_lib/sentry");
/* ==========================================================
   api/potrdi-korak.js — Vercel serverless v3.
   DB-backed, avtoriziran, optimistic locking, Luxon TZ.

   Zahteva env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   (SERVICE_ROLE KEY nikoli ne zapusti strežnika.)
   ========================================================== */

var crypto = require("crypto");
var luxon = require("luxon");
var randomSchedule = require("./_lib/random-schedule");

var TZ = "Europe/Ljubljana";

/* ---------- Pomožne ---------- */

function parseTimeToMinutes(timeStr) {
  var parts = String(timeStr).split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
}

function minutesToTime(t) {
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
}

function versionIncrement(oldVersion) {
  return String(Number(oldVersion || 0) + 1);
}

/** Vrne lokalne minute (0–1439) ISO datuma v Europe/Ljubljana. */
function ljMinute(isoString) {
  var dt = luxon.DateTime.fromISO(isoString, { zone: "utc" }).setZone(TZ);
  return dt.isValid ? dt.hour * 60 + dt.minute : NaN;
}

/** Sestavi ISO 8601 v UTC iz lokalnih komponent Europe/Ljubljana. */
function ljISO(localDate, hour, minute) {
  var base = luxon.DateTime.fromJSDate(localDate, { zone: "utc" }).setZone(TZ);
  var dt = luxon.DateTime.fromObject(
    { year: base.year, month: base.month, day: base.day, hour: hour, minute: minute },
    { zone: TZ }
  );
  if (!dt.isValid) throw new Error("Neveljaven lokalni čas.");
  return dt.toUTC().toISO();
}

function izracunajNakljucniMinute(earliest, latest) {
  var range = latest - earliest;
  if (range <= 0) return earliest;
  return earliest + crypto.randomInt(range + 1);
}

/* ---------- Avtorizacija ---------- */

async function verifyAuth(req, SUPABASE_URL, SERVICE_KEY) {
  var authHeader = req.headers["authorization"] || "";
  var token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, napaka: "Ni avtorizacijskega žetona." };

  var userRes;
  try {
    userRes = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { "apikey": SERVICE_KEY, "Authorization": "Bearer " + token },
    });
  } catch (_) {
    return { ok: false, status: 502, napaka: "Avtorizacijski strežnik ni dosegljiv." };
  }

  if (!userRes.ok) {
    return { ok: false, status: 401, napaka: "Neveljaven žeton." };
  }

  var userData = await userRes.json();
  if (!userData || !userData.id) {
    return { ok: false, status: 401, napaka: "Uporabnik ni prepoznan." };
  }

  return { ok: true, userId: userData.id };
}

/* ---------- Glavni handler ---------- */

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, napaka: "Samo POST." });
  }

  var SUPABASE_URL = process.env.SUPABASE_URL;
  var SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({
      ok: false, napaka: "Strežnik ni konfiguriran (SUPABASE_SERVICE_ROLE_KEY).",
    });
  }

  /* --- 1. Avtorizacija --- */
  var auth = await verifyAuth(req, SUPABASE_URL, SERVICE_KEY);
  if (!auth.ok) {
    return res.status(auth.status).json({ ok: false, napaka: auth.napaka });
  }
  var userId = auth.userId;

  try {
    var telo = req.body || {};
    var zadevaId = telo.zadevaId;
    var stepIndex = Number(telo.stepIndex);
    var clientVersion = String(telo.version || "0");

    if (!zadevaId || !Number.isFinite(stepIndex) || stepIndex < 1) {
      return res.status(400).json({ ok: false, napaka: "Manjkajo zadevaId ali stepIndex." });
    }

    /* --- 2. Preberi zadevo (service_role, a s preverjenim lastništvom) --- */
    var fetchUrl = SUPABASE_URL + "/rest/v1/zadeve?id=eq." + encodeURIComponent(zadevaId) +
      "&select=id,obrtnik_id,opomin_nacrt";
    var fetchRes = await fetch(fetchUrl, {
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": "Bearer " + SERVICE_KEY,
        "Accept": "application/json",
      },
    });

    if (!fetchRes.ok) {
      return res.status(502).json({ ok: false, napaka: "Baze ni bilo mogoče prebrati." });
    }

    var rows = await fetchRes.json();
    if (!rows || !rows.length) {
      return res.status(404).json({ ok: false, napaka: "Zadeva ni najdena." });
    }

    var zadeva = rows[0];

    /* --- 3. Preveri lastništvo --- */
    if (zadeva.obrtnik_id !== userId) {
      return res.status(403).json({ ok: false, napaka: "Dostop zavrnjen." });
    }

    var plan = zadeva.opomin_nacrt;
    if (!plan || !Array.isArray(plan.steps)) {
      return res.status(400).json({ ok: false, napaka: "Načrt manjka." });
    }

    /* --- 4. Optimistic locking --- */
    var serverVersion = String(plan.version || "0");
    if (clientVersion !== serverVersion) {
      return res.status(409).json({
        ok: false, napaka: "Podatki so zastareli. Osvežite stran in poskusite znova.",
        code: "VERSION_CONFLICT", serverVersion: serverVersion,
      });
    }

    /* --- 5. Najdi korak --- */
    var step = plan.steps.find(function (s) { return Number(s.index) === stepIndex; });
    if (!step) {
      return res.status(400).json({ ok: false, napaka: "Korak ni najden." });
    }

    if (step.status === "sent" || step.status === "processing") {
      return res.status(409).json({ ok: false, napaka: "Korak je že poslan ali v obdelavi." });
    }

    var rs = step._randomSchedule || {};

    /* --- 6. Brez Random --- */
    if (!rs.enabled) {
      step.status = "confirmed";
      step.confirmedAt = new Date().toISOString();
      plan.version = versionIncrement(serverVersion);

      var patchRes1 = await atomicPatch(
        SUPABASE_URL, SERVICE_KEY, zadevaId, serverVersion, plan
      );
      if (!patchRes1.ok) {
        return res.status(409).json({ ok: false, napaka: "Sočasna sprememba.", code: "VERSION_CONFLICT" });
      }

      return res.json({ ok: true, randomEnabled: false, version: plan.version });
    }

    /* --- 7. Idempotentnost --- */
    if (rs.resolvedScheduledAt) {
      return res.json({
        ok: true, randomEnabled: true,
        resolvedScheduledAt: rs.resolvedScheduledAt, recalculated: false,
        version: serverVersion,
      });
    }

    /* --- 8. Izračun naključnega časa --- */
    var baseIso = step.sendAt || step.scheduledAt;
    if (!baseIso) {
      return res.status(400).json({ ok: false, napaka: "Korak nima nastavljenega časa." });
    }

    var baseMn = ljMinute(baseIso);
    if (Number.isNaN(baseMn)) {
      return res.status(400).json({ ok: false, napaka: "Neveljaven osnovni čas." });
    }

    var uporabiLocenoOkno =
      plan.allowedSendWindowMode === "per_step" ||
      (plan.allowedSendWindowMode == null && step.allowedSendWindow);
    var dovoljenoOkno =
      (uporabiLocenoOkno && step.allowedSendWindow) ||
      plan.allowedSendWindow ||
      {};
    var minSendTime = dovoljenoOkno.start || "07:00";
    var maxSendTime = dovoljenoOkno.end || "21:00";
    var minMn = parseTimeToMinutes(minSendTime);
    var maxMn = parseTimeToMinutes(maxSendTime);

    if (maxMn <= minMn) {
      return res.status(400).json({
        ok: false, napaka: "Končna ura (" + maxSendTime + ") mora biti po začetni (" + minSendTime + ").",
      });
    }

    /* Pravilo koraka ima prednost; sicer velja skupno pravilo načrta. */
    rs.minSendTime = minSendTime;
    rs.maxSendTime = maxSendTime;

    var calculated;
    try {
      calculated = randomSchedule.izracunajRandomCas(baseIso, rs);
    } catch (randomError) {
      return res.status(400).json({
        ok: false,
        code: randomError.code || "INVALID_RANDOM_SCHEDULE",
        napaka: randomError.message || "Naključnega časa ni bilo mogoče izračunati.",
      });
    }
    var earliest = calculated.earliestMinutes;
    var latest = calculated.latestMinutes;
    var chosenMn = calculated.chosenMinutes;
    baseMn = calculated.baseMinutes;

    /* --- 9. Shrani v plan --- */
    rs.resolvedScheduledAt = calculated.resolvedScheduledAt;
    rs.resolvedAt = new Date().toISOString();
    rs.resolvedMinutes = chosenMn;
    step._randomSchedule = rs;
    step.status = "confirmed";
    step.confirmedAt = new Date().toISOString();
    if (!plan.planId) plan.planId = "plan-" + zadevaId;
    if (!step.stepId) step.stepId = "step-" + zadevaId + "-" + step.index;
    plan.version = versionIncrement(serverVersion);

    var patchRes = await atomicPatch(
      SUPABASE_URL, SERVICE_KEY, zadevaId, serverVersion, plan
    );

    if (!patchRes.ok) {
      return res.status(409).json({
        ok: false, napaka: "Sočasna sprememba — poskusite znova.", code: "VERSION_CONFLICT",
      });
    }

    return res.json({
      ok: true, randomEnabled: true,
      resolvedScheduledAt: rs.resolvedScheduledAt, recalculated: true,
      version: plan.version,
      range: {
        earliest: minutesToTime(earliest), latest: minutesToTime(latest),
        chosen: minutesToTime(chosenMn), base: minutesToTime(baseMn),
        mode: rs.mode || "okoli",
        activePeriod: calculated.activePeriod,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false, napaka: "Napaka strežnika: " + (err.message || "Neznana napaka."),
    });
  }
}

/**
 * Atomski PATCH z optimističnim zaklepom.
 * Vrne { ok: true } samo če je bila posodobljena natanko 1 vrstica.
 */
async function atomicPatch(SUPABASE_URL, SERVICE_KEY, zadevaId, oldVersion, plan) {
  try {
    var patchUrl =
      SUPABASE_URL + "/rest/v1/zadeve?id=eq." + encodeURIComponent(zadevaId) +
      "&opomin_nacrt->>version=eq." + encodeURIComponent(oldVersion);

    var patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": "Bearer " + SERVICE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ opomin_nacrt: plan }),
    });

    if (!patchRes.ok) return { ok: false };

    /* Preveri, da je bila posodobljena natanko 1 vrstica. */
    var patchedRows = await patchRes.json();
    if (!Array.isArray(patchedRows) || patchedRows.length !== 1) {
      return { ok: false };
    }

    return { ok: true, row: patchedRows[0] };
  } catch (_) {
    return { ok: false };
  }
}

module.exports = sentry.wrapHandler(handler, "/api/potrdi-korak");
