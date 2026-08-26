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

async function processClaimed(cfg, claimed, workerId) {
  try {
    const deliveryPackage = await buildDeliveryPackage(cfg, claimed);
    const provider = providerFor(claimed.provider);
    const providerResult = await provider.deliver(deliveryPackage);
    let completed = await finish(cfg, claimed, workerId, {
      success: true,
      providerReference: providerResult.providerReference,
      retryable: false,
    });
    completed = await applyImmediateOpenapiResult(cfg, claimed, completed, providerResult);
    return { ok: true, delivery: completed, providerResult };
  } catch (error) {
    const failed = await finish(cfg, claimed, workerId, {
      success: false,
      retryable: Boolean(error && error.retryable),
      error: String(error && error.message || "Dostava ni uspela.").slice(0, 1000),
    });
    return { ok: false, delivery: failed, error };
  }
}

module.exports = { applyImmediateOpenapiResult, finish, processClaimed, rpcRow };
