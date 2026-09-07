"use strict";

const supabase = require("./supabase-server");
const { buildDeliveryPackage } = require("./pos-delivery-package");
const { providerFor } = require("./pos-delivery-providers");

function rpcRow(value) {
  if (Array.isArray(value)) return value[0] || null;
  if (value && typeof value === "object" && value.id) return value;
  return null;
}

async function finish(cfg, delivery, workerId, result) {
  const rpcName = delivery && delivery.is_test && delivery.provider === "resend"
    ? "pos_finish_resend_test_invoice_delivery"
    : "pos_finish_invoice_delivery";
  return rpcRow(await supabase.pokliciRpc(cfg, rpcName, {
    p_delivery_id: delivery.id,
    p_user_id: delivery.user_id,
    p_worker_id: workerId,
    p_success: Boolean(result.success),
    p_provider_reference: result.providerReference || "",
    p_error: result.error || "",
    p_retryable: Boolean(result.retryable),
  }));
}

async function applyImmediateOpenapiResult(cfg, delivery, completed, providerResult, callRpc) {
  if (!completed || !providerResult || providerResult.provider !== "openapi" || providerResult.delivered !== true) return completed;
  try {
    const applied = rpcRow(await (callRpc || supabase.pokliciRpc)(cfg, "pos_apply_openapi_invoice_event", {
      p_provider_reference: providerResult.providerReference || "",
      p_state: providerResult.remoteState || "",
      p_external_status: providerResult.externalStatus || "",
      p_event_at: null,
      p_sandbox: Boolean(delivery && delivery.is_test),
    }));
    return applied || completed;
  } catch (error) {
    console.error("[pos-openapi-immediate-finalization]", error && error.stack || error);
    return completed;
  }
}

function acceptedPendingDelivery(claimed, providerResult) {
  return Object.assign({}, claimed, {
    status: "processing",
    provider_reference: String(
      providerResult && providerResult.providerReference || claimed && claimed.provider_reference || ""
    ).slice(0, 240),
  });
}

async function resendFirstAttemptAt(cfg, delivery, readRows) {
  // Claims append this event atomically before POST. Unlike locked_at and
  // attempt_count, its timestamp survives subsequent claims and requeues.
  const rows = await (readRows || supabase.pridobiVrstice)(cfg, "pos_invoice_delivery_events",
    "delivery_id=eq." + encodeURIComponent(delivery.id) +
    "&user_id=eq." + encodeURIComponent(delivery.user_id) +
    "&event_type=eq.processing&details->>provider=eq.resend&select=created_at&order=created_at.asc&limit=1");
  return rows && rows[0] && rows[0].created_at || "";
}

async function processClaimed(cfg, claimed, workerId, dependencies) {
  const deps = dependencies || {};
  const buildPackage = deps.buildDeliveryPackage || buildDeliveryPackage;
  const selectProvider = deps.providerFor || providerFor;
  const finishDelivery = deps.finish || finish;
  const logError = deps.logError || console.error;
  let providerResult;
  try {
    const deliveryPackage = await buildPackage(cfg, claimed);
    if (claimed.provider === "resend") {
      deliveryPackage.resendFirstAttemptAt = await resendFirstAttemptAt(cfg, claimed, deps.readRows);
    }
    const provider = selectProvider(claimed.provider);
    providerResult = await provider.deliver(deliveryPackage);
  } catch (error) {
    const failed = await finishDelivery(cfg, claimed, workerId, {
      success: false,
      retryable: Boolean(error && error.retryable),
      error: String(error && error.message || "Dostava ni uspela.").slice(0, 1000),
    });
    return { ok: false, delivery: failed, error };
  }

  let completed;
  try {
    completed = await finishDelivery(cfg, claimed, workerId, {
      success: true,
      providerReference: providerResult.providerReference,
      retryable: false,
    });
    if (!completed) {
      const error = new Error("Zaključka sprejete dostave ni bilo mogoče potrditi.");
      error.code = "DELIVERY_FINALIZATION_RESPONSE_MISSING";
      error.retryable = true;
      throw error;
    }
  } catch (error) {
    logError(
      "[pos-delivery-finalization-pending]",
      claimed && claimed.id || "unknown",
      providerResult && providerResult.providerReference || "",
      error && error.message || error
    );
    return {
      ok: false,
      accepted: true,
      finalizationPending: true,
      delivery: acceptedPendingDelivery(claimed, providerResult),
      providerResult,
      error,
    };
  }

  completed = await applyImmediateOpenapiResult(cfg, claimed, completed, providerResult);
  return { ok: true, delivery: completed, providerResult };
}

module.exports = { resendFirstAttemptAt, acceptedPendingDelivery, applyImmediateOpenapiResult, finish, processClaimed, rpcRow };
