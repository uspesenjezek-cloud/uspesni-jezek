(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJZgodovinaRelativniDatumi = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function veljavenIsoDatum(value) {
    var iso = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var parts = iso.split("-").map(Number);
    var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
  }

  function premakniDatum(iso, relation) {
    if (!veljavenIsoDatum(iso) || !relation || ![1, -1].includes(Number(relation.direction))) return null;
    var amount = Number(relation.amount);
    var unit = String(relation.unit || "");
    if (!Number.isInteger(amount) || amount < 1 || !["day", "week", "month", "year"].includes(unit)) return null;
    var parts = iso.split("-").map(Number);
    var direction = Number(relation.direction);
    if (unit === "day" || unit === "week") {
      var days = amount * direction * (unit === "week" ? 7 : 1);
      return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days)).toISOString().slice(0, 10);
    }
    var monthDelta = amount * direction * (unit === "year" ? 12 : 1);
    var targetMonthNumber = parts[0] * 12 + parts[1] - 1 + monthDelta;
    var targetYear = Math.floor(targetMonthNumber / 12);
    var targetMonth = ((targetMonthNumber % 12) + 12) % 12;
    var lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    var explicitDay = relation.dayOfMonth == null ? null : Number(relation.dayOfMonth);
    if (explicitDay != null && (!Number.isInteger(explicitDay) || explicitDay < 1 || explicitDay > lastDay)) return null;
    return new Date(Date.UTC(targetYear, targetMonth, explicitDay == null ? Math.min(parts[2], lastDay) : explicitDay)).toISOString().slice(0, 10);
  }

  function oznaciRocniPopravek(candidate, field) {
    if (!candidate || !candidate.dateRelation || candidate.dateRelation.field !== field) return false;
    candidate[field + "ManualOverride"] = true;
    candidate[field + "Derived"] = false;
    delete candidate[field + "DerivedFrom"];
    return true;
  }

  function razresiDatume(candidates) {
    var list = Array.isArray(candidates) ? candidates : [];
    var changed = false;
    for (var pass = 0; pass < Math.max(1, list.length); pass += 1) {
      list.forEach(function (candidate, index) {
        var relation = candidate && candidate.dateRelation;
        if (!relation || relation.anchor !== "previous_event" || relation.field !== "occurredDate") return;
        var field = relation.field;
        if (candidate[field + "ManualOverride"] === true) return;
        var anchor = relation.anchorCandidateId
          ? list.find(function (item) { return item && item.candidateId === relation.anchorCandidateId; })
          : null;
        if (!anchor && index > 0) anchor = list[index - 1];
        if (anchor && anchor.candidateId) relation.anchorCandidateId = anchor.candidateId;
        var anchorDate = anchor && anchor[field];
        if (!veljavenIsoDatum(anchorDate)) {
          if (candidate[field + "Derived"] === true && candidate[field]) {
            candidate[field] = null;
            changed = true;
          }
          candidate[field + "Derived"] = true;
          candidate[field + "DerivedFrom"] = anchor && anchor.candidateId || null;
          return;
        }
        var derived = premakniDatum(anchorDate, relation);
        if (!derived) return;
        if (candidate[field] !== derived) {
          candidate[field] = derived;
          changed = true;
        }
        candidate[field + "Derived"] = true;
        candidate[field + "ManualOverride"] = false;
        candidate[field + "DerivedFrom"] = anchor.candidateId || null;
        candidate[field + "Unknown"] = false;
        candidate[field + "Approximate"] = false;
        candidate[field + "Approximation"] = "";
      });
    }
    return changed;
  }

  return {
    veljavenIsoDatum: veljavenIsoDatum,
    premakniDatum: premakniDatum,
    oznaciRocniPopravek: oznaciRocniPopravek,
    razresiDatume: razresiDatume,
  };
});
