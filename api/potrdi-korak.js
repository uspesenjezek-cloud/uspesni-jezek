/* ==========================================================
   api/potrdi-korak.js — Vercel serverless funkcija.
   Strežniško potrdi korak načrta opominjanja in izračuna
   naključni čas pošiljanja (Random), če je vklopljen.

   Uporablja Node.js crypto za varen naključni izbor in
   upošteva časovni pas Europe/Ljubljana.
   ========================================================== */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, napaka: "Samo POST." });
  }

  try {
    var telo = req.body || {};
    var plan = telo.plan;
    var index = Number(telo.index);

    if (!plan || !Array.isArray(plan.steps) || !Number.isFinite(index) || index < 1) {
      return res.status(400).json({ ok: false, napaka: "Manjkajo plan ali index." });
    }

    var step = plan.steps.find(function (s) { return Number(s.index) === index; });
    if (!step) {
      return res.status(400).json({ ok: false, napaka: "Korak ni najden." });
    }

    /* Status zaščita: potrjenega ali poslanega koraka ne spreminjaj. */
    if (step.status === "sent" || step.status === "processing") {
      return res.status(409).json({ ok: false, napaka: "Korak je že poslan ali v obdelavi." });
    }

    var rs = step._randomSchedule || {};

    /* Če Random ni vklopljen, samo potrdi korak. */
    if (!rs.enabled) {
      step.status = step.status === "confirmed" ? "confirmed" : "confirmed";
      step.confirmedAt = new Date().toISOString();
      return res.json({ ok: true, plan: plan, randomEnabled: false });
    }

    /* Če je naključni čas že izračunan, ga ne računaj ponovno. */
    if (rs.resolvedScheduledAt) {
      return res.json({
        ok: true,
        plan: plan,
        randomEnabled: true,
        resolvedScheduledAt: rs.resolvedScheduledAt,
        recalculated: false,
      });
    }

    /* --- Izračun naključnega časa --- */

    var baseIso = step.sendAt || step.scheduledAt;
    if (!baseIso) {
      return res.status(400).json({ ok: false, napaka: "Korak nima nastavljenega časa." });
    }

    /* Parsiramo v lokalnem času Europe/Ljubljana. */
    var baseDate = new Date(baseIso);
    if (Number.isNaN(baseDate.getTime())) {
      return res.status(400).json({ ok: false, napaka: "Neveljaven osnovni čas." });
    }

    var minSendTime = rs.minSendTime || "07:00";
    var maxSendTime = rs.maxSendTime || "21:00";
    var minMn = parseTimeToMinutes(minSendTime);
    var maxMn = parseTimeToMinutes(maxSendTime);

    if (maxMn - minMn < 60) {
      return res.status(400).json({
        ok: false,
        napaka: "Dovoljen razpon pošiljanja mora biti vsaj 60 minut.",
      });
    }

    /* Uporabi lokalne komponente datuma (Europe/Ljubljana). */
    var baseHours = baseDate.getHours();
    var baseMinutes = baseDate.getMinutes();
    var baseMn = baseHours * 60 + baseMinutes;

    var halfWindow;
    var mode = rs.mode || "okoli";

    if (mode === "okoli") {
      var minutesBefore = Number(rs.minutesBefore) || 15;
      var minutesAfter = Number(rs.minutesAfter) || 15;
      halfWindow = Math.min(minutesBefore, minutesAfter);
    } else {
      halfWindow = 20; /* Privzeto, pametna obdobja pridejo kasneje. */
    }

    var earliestAllowed = Math.max(baseMn - halfWindow, minMn);
    var latestAllowed = Math.min(baseMn + halfWindow, maxMn);

    if (earliestAllowed >= latestAllowed) {
      return res.status(400).json({
        ok: false,
        napaka: "Znotraj dovoljenega časa (" + minSendTime + "–" + maxSendTime +
          ") ni veljavnega termina za osnovni čas " +
          String(baseHours).padStart(2, "0") + ":" + String(baseMinutes).padStart(2, "0") +
          " z razponom ±" + halfWindow + " min.",
      });
    }

    /* Varen naključni izbor s crypto. */
    var rangeMinutes = latestAllowed - earliestAllowed;
    var randomOffset;
    try {
      var buf = require("crypto").randomBytes(4);
      randomOffset = buf.readUInt32BE(0) % rangeMinutes;
    } catch (cryptoErr) {
      /* Fallback: Math.random če crypto.randomBytes ni na voljo. */
      randomOffset = Math.floor(Math.random() * rangeMinutes);
    }
    var chosenMn = earliestAllowed + randomOffset;

    baseDate.setHours(Math.floor(chosenMn / 60), chosenMn % 60, 0, 0);

    /* Shrani rezultat. */
    rs.resolvedScheduledAt = baseDate.toISOString();
    rs.resolvedAt = new Date().toISOString();
    rs.resolvedMinutes = chosenMn;
    step._randomSchedule = rs;

    /* Nastavi status na scheduled (čaka na pošiljanje). */
    if (step.status !== "confirmed") {
      step.status = "confirmed";
    }
    step.confirmedAt = new Date().toISOString();

    return res.json({
      ok: true,
      plan: plan,
      randomEnabled: true,
      resolvedScheduledAt: rs.resolvedScheduledAt,
      recalculated: true,
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

function parseTimeToMinutes(timeStr) {
  var parts = String(timeStr).split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
}

function minutesToTime(totalMinutes) {
  var h = Math.floor(totalMinutes / 60);
  var m = totalMinutes % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
