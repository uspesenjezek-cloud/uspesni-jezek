/* ==========================================================
   api/potrdi-korak.js — Vercel serverless funkcija v2.
   DB-backed: bere in posodablja zadeve.opomin_nacrt atomsko.
   Uporablja optimistic locking (version), explicit
   Europe/Ljubljana časovni pas in crypto.randomBytes.

   Zahteva env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   ========================================================== */

var crypto;
try { crypto = require("crypto"); } catch (_) { crypto = null; }

/* ---------- Pomožne funkcije ---------- */

function parseTimeToMinutes(timeStr) {
  var parts = String(timeStr).split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
}

function minutesToTime(totalMinutes) {
  var h = Math.floor(totalMinutes / 60);
  var m = totalMinutes % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function versionIncrement(oldVersion) {
  return String(Number(oldVersion || 0) + 1);
}

/**
 * Vrne lokalne komponente ISO datuma v Europe/Ljubljana.
 * Na Vercelu (UTC) je new Date(iso).getHours() != lokalna ura,
 * zato uporabimo Intl.DateTimeFormat za pravilno pretvorbo.
 */
function ljubljanskaUraInMinute(isoString) {
  try {
    var deli = new Intl.DateTimeFormat("sl-SI", {
      timeZone: "Europe/Ljubljana",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(isoString));

    var ura = 0;
    var min = 0;
    deli.forEach(function (p) {
      if (p.type === "hour") ura = parseInt(p.value);
      if (p.type === "minute") min = parseInt(p.value);
    });
    return ura * 60 + min;
  } catch (_) {
    var d = new Date(isoString);
    return d.getHours() * 60 + d.getMinutes();
  }
}

function ljubljanskiDatum(isoString) {
  try {
    return new Date(
      new Date(isoString).toLocaleString("en-US", { timeZone: "Europe/Ljubljana" })
    );
  } catch (_) {
    return new Date(isoString);
  }
}

function ljubljanskiISO(datum) {
  var leto = datum.getFullYear();
  var mesec = String(datum.getMonth() + 1).padStart(2, "0");
  var dan = String(datum.getDate()).padStart(2, "0");
  var ura = String(datum.getHours()).padStart(2, "0");
  var min = String(datum.getMinutes()).padStart(2, "0");
  return leto + "-" + mesec + "-" + dan + "T" + ura + ":" + min + ":00.000Z";
}

function izracunajNakljucniMinute(earliestAllowed, latestAllowed) {
  var rangeMinutes = latestAllowed - earliestAllowed;
  if (rangeMinutes <= 0) return earliestAllowed;
  /* crypto.randomInt (Node 18+) je CSPRNG in ne trpi modulo-bias
     pri majhnih razponih. Fallback na crypto.randomBytes z modulom. */
  if (crypto && typeof crypto.randomInt === "function") {
    try {
      return earliestAllowed + crypto.randomInt(rangeMinutes + 1);
    } catch (_) {}
  }
  if (crypto && typeof crypto.randomBytes === "function") {
    var buf = crypto.randomBytes(4);
    return earliestAllowed + (buf.readUInt32BE(0) % (rangeMinutes + 1));
  }
  /* Zadnji fallback: Math.random. */
  return earliestAllowed + Math.floor(Math.random() * (rangeMinutes + 1));
}

/* ---------- Glavni handler ---------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, napaka: "Samo POST." });
  }

  var SUPABASE_URL = process.env.SUPABASE_URL;
  var SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({
      ok: false,
      napaka: "Strežnik ni konfiguriran (manjka SUPABASE_SERVICE_ROLE_KEY).",
    });
  }

  try {
    var telo = req.body || {};
    var zadevaId = telo.zadevaId;
    var stepIndex = Number(telo.stepIndex);
    var clientVersion = String(telo.version || "0");

    if (!zadevaId || !Number.isFinite(stepIndex) || stepIndex < 1) {
      return res.status(400).json({ ok: false, napaka: "Manjkajo zadevaId ali stepIndex." });
    }

    /* --- 1. Preberi zadevo iz Supabase --- */
    var fetchUrl = SUPABASE_URL + "/rest/v1/zadeve?id=eq." + encodeURIComponent(zadevaId) +
      "&select=id,opomin_nacrt,status";
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
    var plan = zadeva.opomin_nacrt;
    if (!plan || !Array.isArray(plan.steps)) {
      return res.status(400).json({ ok: false, napaka: "Načrt manjka." });
    }

    /* --- 2. Optimistic locking --- */
    var serverVersion = String(plan.version || "0");
    if (clientVersion !== serverVersion) {
      return res.status(409).json({
        ok: false,
        napaka: "Podatki so zastareli. Osvežite stran in poskusite znova.",
        code: "VERSION_CONFLICT",
        serverVersion: serverVersion,
      });
    }

    /* --- 3. Najdi korak --- */
    var step = plan.steps.find(function (s) { return Number(s.index) === stepIndex; });
    if (!step) {
      return res.status(400).json({ ok: false, napaka: "Korak ni najden." });
    }

    /* Status zaščita. */
    if (step.status === "sent" || step.status === "processing") {
      return res.status(409).json({ ok: false, napaka: "Korak je že poslan ali v obdelavi." });
    }

    var rs = step._randomSchedule || {};

    /* --- 4. Če Random ni vklopljen, samo potrdi --- */
    if (!rs.enabled) {
      step.status = "confirmed";
      step.confirmedAt = new Date().toISOString();
      plan.version = versionIncrement(serverVersion);
      plan.updatedAt = new Date().toISOString();

      var patchRes1 = await fetch(
        SUPABASE_URL + "/rest/v1/zadeve?id=eq." + encodeURIComponent(zadevaId) +
          "&opomin_nacrt->>version=eq." + encodeURIComponent(serverVersion),
        {
          method: "PATCH",
          headers: {
            "apikey": SERVICE_KEY,
            "Authorization": "Bearer " + SERVICE_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
          },
          body: JSON.stringify({
            opomin_nacrt: plan,
          }),
        }
      );

      if (!patchRes1.ok) {
        return res.status(409).json({ ok: false, napaka: "Sočasna sprememba — poskusite znova.", code: "VERSION_CONFLICT" });
      }

      return res.json({ ok: true, randomEnabled: false, version: plan.version });
    }

    /* --- 5. Random: preveri idempotentnost --- */
    if (rs.resolvedScheduledAt) {
      return res.json({
        ok: true,
        randomEnabled: true,
        resolvedScheduledAt: rs.resolvedScheduledAt,
        recalculated: false,
        version: serverVersion,
      });
    }

    /* --- 6. Izračun naključnega časa --- */
    var baseIso = step.sendAt || step.scheduledAt;
    if (!baseIso) {
      return res.status(400).json({ ok: false, napaka: "Korak nima nastavljenega časa." });
    }

    /* Uporabi Europe/Ljubljana za vse časovne izračune. */
    var baseMn = ljubljanskaUraInMinute(baseIso);
    var baseHours = Math.floor(baseMn / 60);
    var baseMinutes = baseMn % 60;

    var minSendTime = rs.minSendTime || "07:00";
    var maxSendTime = rs.maxSendTime || "21:00";
    var minMn = parseTimeToMinutes(minSendTime);
    var maxMn = parseTimeToMinutes(maxSendTime);

    /* Validacija: končna ura mora biti po začetni. */
    if (maxMn <= minMn) {
      return res.status(400).json({
        ok: false,
        napaka: "Končna ura (" + maxSendTime + ") mora biti po začetni (" + minSendTime + ").",
      });
    }

    var halfWindow;
    if (rs.mode === "okoli") {
      var minutesBefore = Number(rs.minutesBefore);
      var minutesAfter = Number(rs.minutesAfter);
      if (!Number.isFinite(minutesBefore) || minutesBefore < 0) minutesBefore = 15;
      if (!Number.isFinite(minutesAfter) || minutesAfter < 0) minutesAfter = 15;
      /* halfWindow = koliko minut levo in desno od osnovne ure */
      halfWindow = Math.min(minutesBefore, minutesAfter);
    } else {
      halfWindow = 20;
    }

    if (halfWindow <= 0) {
      return res.status(400).json({ ok: false, napaka: "Razpon mora biti večji od 0 minut." });
    }

    var earliestAllowed = Math.max(baseMn - halfWindow, minMn);
    var latestAllowed = Math.min(baseMn + halfWindow, maxMn);

    if (earliestAllowed >= latestAllowed) {
      return res.status(400).json({
        ok: false,
        napaka:
          "Znotraj dovoljenega časa (" + minSendTime + "–" + maxSendTime +
          ") ni veljavnega termina za osnovno uro " + minutesToTime(baseMn) +
          " z razponom ±" + halfWindow + " min.",
      });
    }

    var chosenMn = izracunajNakljucniMinute(earliestAllowed, latestAllowed);

    /* --- 7. Shrani rezultat v plan in zbirko (atomsko) --- */
    rs.resolvedScheduledAt = ljubljanskiISO(
      new Date(
        ljubljanskiDatum(baseIso).setHours(
          Math.floor(chosenMn / 60),
          chosenMn % 60,
          0,
          0
        )
        ? ljubljanskiDatum(baseIso)
        : 0
      )
    );
    /* Popravek: pravilno sestavi ISO v Ljubljanskem času */
    var ljDatum = ljubljanskiDatum(baseIso);
    if (Number.isNaN(ljDatum.getTime())) {
      ljDatum = new Date(baseIso);
    }
    ljDatum.setHours(Math.floor(chosenMn / 60), chosenMn % 60, 0, 0);
    rs.resolvedScheduledAt = ljubljanskiISO(ljDatum);
    rs.resolvedAt = new Date().toISOString();
    rs.resolvedMinutes = chosenMn;
    step._randomSchedule = rs;

    if (step.status !== "confirmed") {
      step.status = "confirmed";
    }
    step.confirmedAt = new Date().toISOString();
    plan.version = versionIncrement(serverVersion);
    plan.updatedAt = new Date().toISOString();

    var patchRes = await fetch(
      SUPABASE_URL + "/rest/v1/zadeve?id=eq." + encodeURIComponent(zadevaId) +
        "&opomin_nacrt->>version=eq." + encodeURIComponent(serverVersion),
      {
        method: "PATCH",
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": "Bearer " + SERVICE_KEY,
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify({
          opomin_nacrt: plan,
        }),
      }
    );

    if (!patchRes.ok) {
      return res.status(409).json({
        ok: false,
        napaka: "Sočasna sprememba — poskusite znova.",
        code: "VERSION_CONFLICT",
      });
    }

    return res.json({
      ok: true,
      randomEnabled: true,
      resolvedScheduledAt: rs.resolvedScheduledAt,
      recalculated: true,
      version: plan.version,
      range: {
        earliest: minutesToTime(earliestAllowed),
        latest: minutesToTime(latestAllowed),
        chosen: minutesToTime(chosenMn),
        base: minutesToTime(baseMn),
        halfWindow: halfWindow,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      napaka: "Napaka strežnika: " + (err.message || "Neznana napaka."),
    });
  }
}
