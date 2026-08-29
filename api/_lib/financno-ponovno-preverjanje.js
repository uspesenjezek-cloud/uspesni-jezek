"use strict";

var db = require("./supabase-server");
var store = require("./boniteta-pro-store");
var projectMonitor = require("./projektno-spremljanje");
var DOVOLJENI_RAZLOGI = new Set(["financial_caution"]);

function intervalDays(value) {
  var days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw Object.assign(new Error("Interval ponovne preverbe mora biti celo število od 1 do 365 dni."), { status: 400, code: "INVALID_FINANCIAL_RECHECK_INTERVAL" });
  }
  return days;
}

function reason(value) {
  var normalized = String(value || "financial_caution");
  if (!DOVOLJENI_RAZLOGI.has(normalized)) throw Object.assign(new Error("Razlog ponovne preverbe ni veljaven."), { status: 400, code: "INVALID_FINANCIAL_RECHECK_REASON" });
  return normalized;
}

async function get(cfg, userId, profileId, inputReason) {
  var rows = await store.rest(cfg, "boniteta_ponovne_preverbe?user_id=eq." + encodeURIComponent(userId) + "&profile_id=eq." + encodeURIComponent(profileId) + "&reason=eq." + encodeURIComponent(reason(inputReason)) + "&select=*&limit=1");
  return rows && rows[0] || null;
}

async function save(cfg, userId, profile, input) {
  var days = intervalDays(input && input.intervalDays);
  var normalizedReason = reason(input && input.reason);
  var scheduled = new Date();
  scheduled.setUTCDate(scheduled.getUTCDate() + days);
  var rows = await store.rest(cfg, "boniteta_ponovne_preverbe?on_conflict=user_id,profile_id,reason", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: {
      user_id: userId,
      profile_id: profile.id,
      reason: normalizedReason,
      interval_days: days,
      scheduled_for: scheduled.toISOString(),
      request_payload: projectMonitor._test.request(profile),
      status: "scheduled",
      last_job_id: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    },
  });
  return rows && rows[0];
}

async function remove(cfg, userId, profileId, inputReason) {
  await store.rest(cfg, "boniteta_ponovne_preverbe?user_id=eq." + encodeURIComponent(userId) + "&profile_id=eq." + encodeURIComponent(profileId) + "&reason=eq." + encodeURIComponent(reason(inputReason)), { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

async function schedule(cfg) { return db.pokliciRpc(cfg, "razporedi_zapadlo_financno_ponovno_preverbo", {}); }
async function finish(cfg, job, success, result) {
  if (job && job.financial_recheck_id) await db.pokliciRpc(cfg, "zakljuci_financno_ponovno_preverbo", { p_job_id: job.id, p_success: Boolean(success), p_result: result || null });
}

module.exports = { get: get, save: save, remove: remove, schedule: schedule, finish: finish, _test: { intervalDays: intervalDays, reason: reason } };
