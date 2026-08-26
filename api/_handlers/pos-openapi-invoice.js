"use strict";

const crypto = require("node:crypto");
const supabase = require("../_lib/supabase-server");
const { processClaimed, rpcRow } = require("../_lib/pos-delivery-runner");
const { openapiInvoiceReadiness } = require("../_lib/pos-delivery-providers");
const { syncConfigurationWebhook, usageSummary } = require("../_lib/pos-openapi-invoice");
const requestJson = require("../_lib/pos-request-json");

const MAX_BODY_BYTES = 16 * 1024;
const MAX_PROVIDER_CLOCK_SKEW_MS = 10 * 60 * 1000;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
}

function uuid(value) {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : "";
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

function webhookRequest(req) {
  try { return new URL(req && req.url || "/", "http://localhost").searchParams.get("webhook") === "1"; }
  catch (_) { return false; }
}

function sandboxWebhookRequest(req) {
  try { return new URL(req && req.url || "/", "http://localhost").searchParams.get("sandbox") === "1"; }
  catch (_) { return false; }
}

function syncWebhookRequest(req) {
  try { return new URL(req && req.url || "/", "http://localhost").searchParams.get("sync-webhook") === "1"; }
  catch (_) { return false; }
}

function usageRequest(req) {
  try { return new URL(req && req.url || "/", "http://localhost").searchParams.get("usage") === "1"; }
  catch (_) { return false; }
}

function providerEventTime(value, nowMs) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(raw)) return "";
  const parsed = new Date(raw);
  const parsedMs = parsed.getTime();
  const currentMs = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  if (Number.isNaN(parsedMs) || parsedMs > currentMs + MAX_PROVIDER_CLOCK_SKEW_MS) return "";
  return parsed.toISOString();
}

async function handleWebhookSync(req, res, readiness) {
  const secret = String(process.env.OPENAPI_INVOICE_SYNC_TOKEN || "");
  if (secret.length < 32 || !safeEqual(bearer(req), secret)) {
    return json(res, 401, { ok: false, napaka: "Openapi sinhronizacija ni pooblaščena." });
  }
  let body;
  try { body = requestJson(req, MAX_BODY_BYTES); }
  catch (error) { return json(res, error.status || 400, { ok: false, code: error.code, napaka: error.message }); }
  if (body.confirmed !== true || !readiness.sandboxEnabled) {
    return json(res, 409, { ok: false, napaka: "Dovoljena je samo potrjena sandbox sinhronizacija." });
  }
  try {
    const configuration = await syncConfigurationWebhook(process.env.OPENAPI_INVOICE_SANDBOX_FISCAL_ID, { env: process.env });
    return json(res, 200, { ok: true, synced: true, configurationId: String(configuration && configuration.id || "") });
  } catch (error) {
    console.error("[pos-openapi-webhook-sync]", error && error.stack || error);
    return json(res, 502, { ok: false, code: error && error.code || "OPENAPI_CONFIGURATION_SYNC_FAILED", napaka: String(error && error.message || "Sinhronizacija ni uspela.") });
  }
}

async function handleWebhook(req, res, readiness) {
  const sandbox = sandboxWebhookRequest(req);
  const secret = String(sandbox
    ? process.env.OPENAPI_INVOICE_SANDBOX_WEBHOOK_SECRET
    : process.env.OPENAPI_INVOICE_WEBHOOK_SECRET || "");
  if (secret.length < 32 || !safeEqual(bearer(req), secret)) {
    return json(res, 401, { ok: false, napaka: "Openapi webhook ni pooblaščen." });
  }
  let body;
  try { body = requestJson(req, MAX_BODY_BYTES); }
  catch (error) { return json(res, error.status || 400, { ok: false, code: error.code, napaka: error.message }); }
  const event = body && body.data && typeof body.data === "object" ? body.data : body;
  const providerReference = String(event && event.id || "").trim();
  const state = String(event && event.state || "").trim().toUpperCase();
  const externalStatus = String(event && event.details && event.details.external_status || state).trim().toLowerCase();
  const rawEventAt = String(event && (event.updated_at || event.update_at || event.create_at) || "").trim();
  const eventAt = providerEventTime(rawEventAt);
  if (!providerReference || providerReference.length > 240 || !["NEW", "SENT", "DONE", "ERROR"].includes(state) || externalStatus.length > 120) {
    return json(res, 400, { ok: false, napaka: "Openapi webhook nima veljavne reference ali stanja." });
  }
  if (rawEventAt && !eventAt) return json(res, 400, { ok: false, napaka: "Openapi webhook nima veljavnega časa dogodka." });
  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  try {
    const delivery = rpcRow(await supabase.pokliciRpc(cfg, "pos_apply_openapi_invoice_event", {
      p_provider_reference: providerReference,
      p_state: state,
      p_external_status: externalStatus,
      p_event_at: eventAt || null,
      p_sandbox: sandbox,
    }));
    if (!delivery) {
      return json(res, 503, { ok: false, code: "OPENAPI_DELIVERY_NOT_READY", napaka: "Openapi dostava še ni pripravljena za dogodek." });
    }
    return json(res, 200, { ok: true, matched: true });
  } catch (error) {
    console.error("[pos-openapi-webhook]", error && error.stack || error);
    return json(res, 503, { ok: false, napaka: "Openapi dogodka trenutno ni mogoče shraniti." });
  }
}

function publicResult(delivery) {
  if (!delivery) return null;
  return {
    id: delivery.id,
    status: delivery.status,
    provider: delivery.provider,
    providerReference: delivery.provider_reference || "",
    attemptCount: delivery.attempt_count,
    nextAttemptAt: delivery.next_attempt_at,
    completedAt: delivery.completed_at,
    lastError: delivery.last_error,
    isTest: Boolean(delivery.is_test),
  };
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Dovoljena sta GET in POST." });
  const readiness = openapiInvoiceReadiness();
  if (req.method === "POST" && syncWebhookRequest(req)) return handleWebhookSync(req, res, readiness);
  if (req.method === "POST" && webhookRequest(req)) return handleWebhook(req, res, readiness);
  let publicCfg;
  try { publicCfg = supabase.uporabniskaKonfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  const auth = await supabase.preveriUporabnika(req, publicCfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  if (req.method === "GET" && !usageRequest(req)) return json(res, 200, { ok: true, invoice: readiness });
  if (req.method === "GET") {
    try {
      const cfg = supabase.konfiguracija();
      const query = "user_id=eq." + encodeURIComponent(auth.user.id) +
        "&provider=eq.openapi&select=provider,is_test,status,provider_reference,reconciliation_attempt_count";
      const rows = await supabase.pridobiVrstice(cfg, "pos_invoice_deliveries", query);
      return json(res, 200, { ok: true, invoice: readiness, usage: usageSummary(rows, process.env) });
    } catch (error) {
      console.error("[pos-openapi-usage]", error && error.stack || error);
      return json(res, 503, { ok: false, napaka: "Openapi porabe trenutno ni mogoče izračunati." });
    }
  }

  let body;
  try { body = requestJson(req, MAX_BODY_BYTES); }
  catch (error) { return json(res, error.status || 400, { ok: false, code: error.code, napaka: error.message }); }
  if (!readiness.sendEnabled) return json(res, 409, { ok: false, code: "OPENAPI_NOT_ENABLED", napaka: "Openapi Invoice še ni vključen.", invoice: readiness });
  if (body.confirmed !== true) return json(res, 400, { ok: false, napaka: "Pred oddajo je potrebna izrecna potrditev." });
  const deliveryId = uuid(body.deliveryId);
  if (!deliveryId) return json(res, 400, { ok: false, napaka: "Neveljavna dostava." });

  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  try {
    const queued = rpcRow(await supabase.pokliciRpc(cfg, "pos_queue_openapi_invoice_delivery", {
      p_delivery_id: deliveryId,
      p_user_id: auth.user.id,
      p_confirmed: true,
      p_sandbox: readiness.sandboxEnabled,
    }));
    if (!queued) return json(res, 409, { ok: false, napaka: "Openapi dostave ni bilo mogoče pripraviti." });
    if (["test_completed", "sent", "delivered"].includes(queued.status) && queued.provider_reference) {
      return json(res, 200, { ok: true, alreadyCompleted: true, sandbox: readiness.sandboxEnabled, delivery: publicResult(queued) });
    }
    const workerId = crypto.randomUUID();
    const claimed = rpcRow(await supabase.pokliciRpc(cfg, "pos_claim_invoice_delivery", {
      p_delivery_id: queued.id,
      p_user_id: auth.user.id,
      p_worker_id: workerId,
    }));
    if (!claimed) return json(res, 202, { ok: true, queued: true, sandbox: readiness.sandboxEnabled, delivery: publicResult(queued) });
    const result = await processClaimed(cfg, claimed, workerId);
    if (!result.ok) {
      return json(res, result.error && result.error.retryable ? 503 : 502, {
        ok: false,
        code: result.error && result.error.code || "OPENAPI_DELIVERY_FAILED",
        napaka: result.error && result.error.message || "Openapi dostava ni uspela.",
        delivery: publicResult(result.delivery),
      });
    }
    return json(res, 200, {
      ok: true,
      sandbox: readiness.sandboxEnabled,
      sent: Boolean(result.providerResult && result.providerResult.sent),
      remoteState: result.providerResult && result.providerResult.remoteState || "",
      delivery: publicResult(result.delivery),
    });
  } catch (error) {
    console.error("[pos-openapi-invoice]", error && error.stack || error);
    return json(res, Number(error && error.status) === 409 ? 409 : 502, {
      ok: false,
      code: error && error.code || "OPENAPI_DELIVERY_FAILED",
      napaka: String(error && error.message || "Openapi dostave ni bilo mogoče izvesti."),
    });
  }
}

module.exports = handler;
module.exports._test = { MAX_BODY_BYTES, MAX_PROVIDER_CLOCK_SKEW_MS, bearer, handleWebhook, handleWebhookSync, providerEventTime, publicResult, safeEqual, sandboxWebhookRequest, syncWebhookRequest, usageRequest, uuid, webhookRequest };
