"use strict";

var crypto = require("crypto");
var DateTime = require("luxon").DateTime;

var TZ = "Europe/Ljubljana";

function napaka(message, code) {
  var err = new Error(message);
  err.code = code || "INVALID_RANDOM_SCHEDULE";
  return err;
}

function minuteIzUre(value, fallback) {
  var text = String(value || fallback || "");
  var match = text.match(/^(\d{2}):(\d{2})$/);
  if (!match) throw napaka("Čas mora biti zapisan kot HH:mm.", "INVALID_TIME");
  var hour = Number(match[1]);
  var minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw napaka("Čas je izven dovoljenega obsega.", "INVALID_TIME");
  return hour * 60 + minute;
}

function nakljucnoCelo(min, max, rng) {
  if (max < min) throw napaka("Naključni časovni razpon je prazen.", "EMPTY_RANGE");
  if (max === min) return min;
  return (rng || crypto.randomInt)(min, max + 1);
}

function nakljucnoCeloRazen(min, max, excluded, rng) {
  if (max < min) throw napaka("Naključni časovni razpon je prazen.", "EMPTY_RANGE");
  if (max === min || excluded < min || excluded > max) {
    return nakljucnoCelo(min, max, rng);
  }
  var offset = nakljucnoCelo(0, max - min - 1, rng);
  var chosen = min + offset;
  return chosen >= excluded ? chosen + 1 : chosen;
}

function osnovniDatum(baseIso) {
  var dt = DateTime.fromISO(String(baseIso || ""), { zone: TZ });
  if (!dt.isValid) throw napaka("Korak nima veljavnega osnovnega časa.", "INVALID_BASE_TIME");
  return dt.setZone(TZ);
}

function privzetaPametnaObdobja() {
  return [
    { id: "zgodnje_jutro", label: "Zgodnje jutro", start: "08:00", end: "10:00", windowMinutes: 40 },
    { id: "pozno_jutro", label: "Pozno jutro", start: "10:00", end: "12:00", windowMinutes: 50 },
    { id: "opoldne", label: "Opoldne", start: "12:00", end: "14:00", windowMinutes: 40 },
    { id: "popoldne", label: "Popoldne", start: "14:00", end: "17:00", windowMinutes: 40 },
    { id: "proti_veceru", label: "Proti večeru", start: "17:00", end: "19:00", windowMinutes: 20 },
    { id: "vecer", label: "Večer", start: "19:00", end: "21:00", windowMinutes: 20 },
  ];
}

function pripraviPametnaObdobja(settings, minAllowed, maxAllowed) {
  var source = Array.isArray(settings.smartPeriods) && settings.smartPeriods.length
    ? settings.smartPeriods
    : privzetaPametnaObdobja();
  var periods = source.map(function (item, index) {
    var start = minuteIzUre(item.start);
    var end = minuteIzUre(item.end);
    var windowMinutes = Math.floor(Number(item.windowMinutes));
    if (end <= start || start < minAllowed || end > maxAllowed) {
      throw napaka("Pametno obdobje je izven dovoljenih ur.", "INVALID_SMART_PERIODS");
    }
    if (!Number.isFinite(windowMinutes) || windowMinutes < 5 || windowMinutes > 120) {
      throw napaka("Razpon pametnega obdobja mora biti med 5 in 120 minutami.", "INVALID_SMART_PERIODS");
    }
    return {
      id: String(item.id || ("period-" + index)),
      label: String(item.label || ("Obdobje " + (index + 1))),
      start: start,
      end: end,
      windowMinutes: windowMinutes,
    };
  }).sort(function (a, b) { return a.start - b.start; });
  for (var i = 1; i < periods.length; i++) {
    if (periods[i].start < periods[i - 1].end) {
      throw napaka("Pametna obdobja se ne smejo prekrivati.", "INVALID_SMART_PERIODS");
    }
  }
  return periods;
}

function izberiPametnoObdobje(periods, baseMinutes) {
  var closest = null;
  var closestDistance = Infinity;
  for (var i = 0; i < periods.length; i++) {
    var period = periods[i];
    var isLast = i === periods.length - 1;
    if (baseMinutes >= period.start && (baseMinutes < period.end || (isLast && baseMinutes <= period.end))) {
      return period;
    }
    var distance = baseMinutes < period.start ? period.start - baseMinutes : baseMinutes - period.end;
    if (distance < closestDistance) {
      closest = period;
      closestDistance = distance;
    }
  }
  return closest;
}

function izracunajRandomCas(baseIso, settings, rng, notBeforeIso) {
  settings = settings || {};
  var base = osnovniDatum(baseIso);
  var minAllowed = minuteIzUre(settings.minSendTime, "07:00");
  var maxAllowed = minuteIzUre(settings.maxSendTime, "21:00");
  if (maxAllowed <= minAllowed) {
    throw napaka("Končna dovoljena ura mora biti po začetni.", "INVALID_HARD_LIMIT");
  }

  var baseMinutes = base.hour * 60 + base.minute;
  var earliest;
  var latest;
  var activePeriod = null;

  if (settings.mode === "pametno") {
    var periods = pripraviPametnaObdobja(settings, minAllowed, maxAllowed);
    activePeriod = izberiPametnoObdobje(periods, baseMinutes);
    if (!activePeriod) throw napaka("Ni nastavljenega pametnega obdobja.", "INVALID_SMART_PERIODS");
    var anchor = Math.max(activePeriod.start, Math.min(baseMinutes, activePeriod.end));
    earliest = Math.max(anchor - activePeriod.windowMinutes, activePeriod.start, minAllowed);
    latest = Math.min(anchor + activePeriod.windowMinutes, activePeriod.end, maxAllowed);
  } else {
    var before = Number(settings.minutesBefore);
    var after = Number(settings.minutesAfter);
    if (!Number.isFinite(before)) before = 15;
    if (!Number.isFinite(after)) after = 15;
    before = Math.floor(before);
    after = Math.floor(after);
    if (before < 0 || after < 0 || before + after <= 0) {
      throw napaka("Naključni razpon mora biti večji od 0 minut.", "INVALID_WINDOW");
    }
    earliest = Math.max(baseMinutes - before, minAllowed);
    latest = Math.min(baseMinutes + after, maxAllowed);
  }

  if (notBeforeIso) {
    var previous = DateTime.fromISO(String(notBeforeIso), { zone: TZ }).setZone(TZ);
    if (!previous.isValid) throw napaka("Prejšnji korak nima veljavnega časa.", "INVALID_PREVIOUS_TIME");
    var baseDay = base.toISODate();
    var previousDay = previous.toISODate();
    if (previousDay > baseDay) {
      throw napaka("Naslednji korak ne more biti pred prejšnjim.", "EMPTY_RANGE");
    }
    if (previousDay === baseDay) {
      var previousMinute = previous.hour * 60 + previous.minute;
      if (previous.second > 0 || previous.millisecond > 0) previousMinute++;
      earliest = Math.max(earliest, previousMinute);
    }
  }
  if (earliest > latest) {
    throw napaka("Znotraj dovoljenega časa ni veljavnega termina.", "EMPTY_RANGE");
  }

  /* Če razpon ponuja več kot eno minuto, ne izberi povsem enake minute kot
     osnovna ura. Tako je Random tudi uporabniku takoj jasno viden. */
  var chosen = nakljucnoCeloRazen(
    earliest,
    latest,
    baseMinutes,
    rng
  );
  var local = DateTime.fromObject({
    year: base.year,
    month: base.month,
    day: base.day,
    hour: Math.floor(chosen / 60),
    minute: chosen % 60,
    second: 0,
    millisecond: 0,
  }, { zone: TZ });
  if (!local.isValid) throw napaka("Izbrani lokalni čas ni veljaven.", "INVALID_LOCAL_TIME");

  return {
    resolvedScheduledAt: local.toUTC().toISO(),
    earliestMinutes: earliest,
    latestMinutes: latest,
    chosenMinutes: chosen,
    baseMinutes: baseMinutes,
    activePeriod: activePeriod ? {
      id: activePeriod.id,
      label: activePeriod.label,
      windowMinutes: activePeriod.windowMinutes,
    } : null,
  };
}

function odstraniPredogled(settings) {
  var clean = Object.assign({}, settings || {});
  delete clean._previewResolvedAt;
  delete clean._previewGeneratedAt;
  delete clean._previewBaseAt;
  return clean;
}

module.exports = {
  TZ: TZ,
  minuteIzUre: minuteIzUre,
  privzetaPametnaObdobja: privzetaPametnaObdobja,
  pripraviPametnaObdobja: pripraviPametnaObdobja,
  izracunajRandomCas: izracunajRandomCas,
  odstraniPredogled: odstraniPredogled,
};
