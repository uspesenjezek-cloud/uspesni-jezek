"use strict";

const crypto = require("node:crypto");
const supabase = require("./supabase-server");
const { processClaimed, rpcRow } = require("./pos-delivery-runner");
const { deliveryReadiness, openapiInvoiceReadiness } = require("./pos-delivery-providers");
const { fetchInvoice, reconciliationEvent } = require("./pos-openapi-invoice");

const MAX_PER_RUN = 3;
const RECONCILIATION_MIN_AGE_MS = 15 * 60 * 1000;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function bearer(req) {
  const match = String(req.headers && req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cronAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || "");
  return secret.length >= 16 && safeEqual(bearer(req), secret);
}

function candidateQuery(status, at, limit, provider, isTest) {
  const timeColumn = status === "processing" ? "locked_at" : "next_attempt_at";
  const operator = status === "processing" ? "lt" : "lte";
  return "status=eq." + status +
    "&provider=eq." + encodeURIComponent(provider || "sandbox") +
    "&is_test=eq." + (isTest === false ? "false" : "true") +
    "&" + timeColumn + "=" + operator + "." + encodeURIComponent(at) +
    "&select=*&order=" + timeColumn + ".asc&limit=" + Math.max(1, Math.min(MAX_PER_RUN, Number(limit) || 1));
}

async function modeCandidates(cfg, limit, provider, isTest, now) {
  const queued = await supabase.pridobiVrstice(cfg, "pos_invoice_deliveries", candidateQuery("queued", now.toISOString(), limit, provider, isTest));
  const remaining = Math.max(0, limit - queued.length);
  if (!remaining) return queued.slice(0, limit);
  const staleAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
  const stale = await supabase.pridobiVrstice(cfg, "pos_invoice_deliveries", candidateQuery("processing", staleAt, remaining, provider, isTest));
  return queued.concat(stale);
}

async function candidates(cfg, limit) {
  const now = new Date();
  const rows = await modeCandidates(cfg, limit, "sandbox", true, now);
  const readiness = deliveryReadiness();
  if (readiness.testEnabled && rows.length < limit) rows.push(...await modeCandidates(cfg, limit - rows.length, "resend", true, now));
  if (readiness.liveEnabled && rows.length < limit) rows.push(...await modeCandidates(cfg, limit - rows.length, "resend", false, now));
  const openapi = openapiInvoiceReadiness();
  if (openapi.sandboxEnabled && rows.length < limit) rows.push(...await modeCandidates(cfg, limit - rows.length, "openapi", true, now));
  if (openapi.liveEnabled && rows.length < limit) rows.push(...await modeCandidates(cfg, limit - rows.length, "openapi", false, now));
  const seen = new Set();
  return rows.filter((row) => {
    if (!row || !row.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).slice(0, limit);
}

async function claim(cfg, candidate, workerId) {
  const rpcName = candidate && candidate.is_test && candidate.provider === "resend"
    ? "pos_claim_resend_test_invoice_delivery"
    : "pos_claim_invoice_delivery";
  return rpcRow(await supabase.pokliciRpc(cfg, rpcName, {
    p_delivery_id: candidate.id,
    p_user_id: candidate.user_id,
    p_worker_id: workerId,
  }));
}

function reconciliationQuery(isTest, now, before, limit) {
  return "provider=eq.openapi" +
    "&is_test=eq." + (isTest ? "true" : "false") +
    "&status=in.(sent,test_completed)" +
    "&provider_reference=neq." +
    "&reconciliation_attempt_count=lt.7" +
    "&or=(reconcile_after.lte." + encodeURIComponent(now) + ",and(reconcile_after.is.null,updated_at.lte." + encodeURIComponent(before) + "))" +
    "&select=id,user_id,provider_reference,is_test,status,reconcile_after,updated_at,reconciliation_attempt_count" +
    "&order=updated_at.asc&limit=" + Math.max(1, Math.min(MAX_PER_RUN, Number(limit) || 1));
}

async function reconciliationCandidates(cfg, limit, readiness, now) {
  if (!readiness.sendEnabled || !readiness.reconciliationEnabled || limit < 1) return [];
  const current = now || new Date();
  const before = new Date(current.getTime() - RECONCILIATION_MIN_AGE_MS).toISOString();
  return supabase.pridobiVrstice(cfg, "pos_invoice_deliveries", reconciliationQuery(
    readiness.sandboxEnabled,
    current.toISOString(),
    before,
    limit
  ));
}

async function claimReconciliationCandidate(cfg, candidate, now) {
  return rpcRow(await supabase.pokliciRpc(cfg, "pos_claim_openapi_reconciliation", {
    p_provider_reference: candidate.provider_reference,
    p_sandbox: Boolean(candidate.is_test),
    p_checked_at: (now || new Date()).toISOString(),
  }));
}

async function reconcileCandidate(cfg, candidate, now) {
  const entry = await fetchInvoice(candidate.provider_reference, { env: process.env });
  const event = reconciliationEvent(entry);
  if (event.providerReference !== candidate.provider_reference) {
    throw new Error("Openapi referenca usklajevanja se ne ujema z dostavo.");
  }
  return rpcRow(await supabase.pokliciRpc(cfg, "pos_reconcile_openapi_invoice_event", {
    p_provider_reference: event.providerReference,
    p_state: event.state,
    p_external_status: event.externalStatus,
    p_event_at: event.eventAt,
    p_sandbox: Boolean(candidate.is_test),
    p_checked_at: (now || new Date()).toISOString(),
  }));
}

async function recordReconciliationFailure(cfg, candidate, error, now) {
  const code = String(error && error.code || "OPENAPI_RECONCILIATION_FAILED")
    .trim().replace(/[\r\n]/g, "_").slice(0, 120) || "OPENAPI_RECONCILIATION_FAILED";
  return rpcRow(await supabase.pokliciRpc(cfg, "pos_record_openapi_reconciliation_failure", {
    p_provider_reference: candidate.provider_reference,
    p_sandbox: Boolean(candidate.is_test),
    p_checked_at: (now || new Date()).toISOString(),
    p_error_code: code,
    p_retryable: Boolean(error && error.retryable),
  }));
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Dovoljena sta GET in POST." });
  if (!cronAuthorized(req)) return json(res, 401, { ok: false, napaka: "Dostop do delavca ni dovoljen." });
  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  try {
    const rows = await candidates(cfg, MAX_PER_RUN);
    const results = [];
    for (const candidate of rows) {
      const workerId = crypto.randomUUID();
      const claimed = await claim(cfg, candidate, workerId);
      if (!claimed) continue;
      const result = await processClaimed(cfg, claimed, workerId);
      results.push({ id: claimed.id, ok: result.ok, provider: claimed.provider, status: result.delivery && result.delivery.status || "processing", retryable: Boolean(result.error && result.error.retryable) });
    }
    const readiness = deliveryReadiness();
    const openapi = openapiInvoiceReadiness();
    const reconciliationResults = [];
    let reconciliationRows = [];
    let reconciliationUnavailable = false;
    try {
      reconciliationRows = await reconciliationCandidates(cfg, MAX_PER_RUN - results.length, openapi, new Date());
    } catch (error) {
      reconciliationUnavailable = true;
      console.error("[pos-openapi-reconciliation-candidates]", error && error.message || error);
    }
    for (const candidate of reconciliationRows) {
      const checkedAt = new Date();
      let claimed;
      try {
        claimed = await claimReconciliationCandidate(cfg, candidate, checkedAt);
        if (!claimed) continue;
        const reconciled = await reconcileCandidate(cfg, claimed, checkedAt);
        reconciliationResults.push({ id: candidate.id, ok: Boolean(reconciled), status: reconciled && reconciled.status || candidate.status });
      } catch (error) {
        console.error("[pos-openapi-reconciliation]", candidate.id, error && error.message || error);
        if (claimed) {
          try {
            await recordReconciliationFailure(cfg, claimed, error, checkedAt);
          } catch (trackingError) {
            console.error("[pos-openapi-reconciliation-failure-tracking]", candidate.id, trackingError && trackingError.message || trackingError);
          }
        }
        reconciliationResults.push({ id: candidate.id, ok: false, status: candidate.status });
      }
    }
    return json(res, 200, {
      ok: true,
      mode: readiness.mode,
      openapiMode: openapi.mode,
      sandbox: !readiness.sendEnabled,
      processed: results.length,
      completed: results.filter((entry) => entry.ok).length,
      retrying: results.filter((entry) => entry.status === "queued").length,
      failed: results.filter((entry) => entry.status === "failed").length,
      reconciled: reconciliationResults.filter((entry) => entry.ok).length,
      reconciliationFailed: reconciliationResults.filter((entry) => !entry.ok).length,
      reconciliationUnavailable,
    });
  } catch (error) {
    console.error("[pos-dostava-delavec]", error && error.stack || error);
    return json(res, 503, { ok: false, napaka: "Dostavni delavec trenutno ni dosegljiv." });
  }
}

module.exports = handler;
module.exports._test = { bearer, candidateQuery, candidates, claimReconciliationCandidate, cronAuthorized, reconcileCandidate, reconciliationCandidates, reconciliationQuery, recordReconciliationFailure, safeEqual };
