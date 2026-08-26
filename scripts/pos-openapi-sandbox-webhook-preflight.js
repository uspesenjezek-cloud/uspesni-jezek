"use strict";

function preflightError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sandboxWebhookUrl(value) {
  let url;
  try { url = new URL(String(value || "")); }
  catch (_) {
    throw preflightError("OPENAPI_SANDBOX_WEBHOOK_URL_INVALID", "Sandbox webhook URL ni veljaven.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw preflightError("OPENAPI_SANDBOX_WEBHOOK_URL_INVALID", "Sandbox webhook mora uporabljati čist HTTPS URL.");
  }
  if (url.searchParams.get("handler") !== "openapi-invoice" ||
      url.searchParams.get("webhook") !== "1" ||
      url.searchParams.get("sandbox") !== "1") {
    throw preflightError("OPENAPI_SANDBOX_WEBHOOK_URL_INVALID", "Sandbox webhook URL nima zahtevanega Openapi sandbox konteksta.");
  }
  return url;
}

async function verifySandboxWebhook(options) {
  const input = options || {};
  const url = sandboxWebhookUrl(input.url);
  const fetchImpl = input.fetch || global.fetch;
  if (typeof fetchImpl !== "function") {
    throw preflightError("OPENAPI_SANDBOX_WEBHOOK_FETCH_UNAVAILABLE", "Preverjanje sandbox webhooka ni na voljo.");
  }

  let response;
  try {
    response = await fetchImpl(url.toString(), {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json" },
      // No credential is sent. The endpoint must reject this deliberately
      // incomplete request before parsing the body or touching Supabase.
      body: JSON.stringify({ data: {} }),
    });
  } catch (_) {
    throw preflightError("OPENAPI_SANDBOX_WEBHOOK_UNREACHABLE", "Sandbox webhook ni dosegljiv.");
  }

  if (response.status >= 300 && response.status < 400) {
    throw preflightError("OPENAPI_SANDBOX_WEBHOOK_DEPLOYMENT_PROTECTED", "Sandbox webhook je preusmerjen na zaščito deploymenta.");
  }

  let body = null;
  try { body = await response.json(); }
  catch (_) { body = null; }
  const deploymentProtected = response.status === 401 && body && (
    Boolean(body.protection && body.protection.vercel_auth_enabled) ||
    String(body.error && body.error.message || "").toLowerCase() === "protected deployment"
  );
  if (deploymentProtected) {
    throw preflightError("OPENAPI_SANDBOX_WEBHOOK_DEPLOYMENT_PROTECTED", "Sandbox webhook je blokiran z zaščito deploymenta.");
  }
  const routeMissing = response.status === 404 && body && body.ok === false &&
    /Neznana POS pot\./i.test(String(body.napaka || ""));
  if (routeMissing) {
    throw preflightError("OPENAPI_SANDBOX_WEBHOOK_ROUTE_MISSING", "Sandbox webhook handler v tem deploymentu ni nameščen.");
  }
  const expectedRejection = response.status === 401 && body && body.ok === false &&
    /Openapi webhook ni pooblaščen\./i.test(String(body.napaka || ""));
  if (!expectedRejection) {
    throw preflightError(
      "OPENAPI_SANDBOX_WEBHOOK_ROUTE_MISMATCH",
      "Sandbox webhook ni vrnil pričakovanega varnega preflight odgovora."
    );
  }

  return { ok: true, status: response.status, origin: url.origin, pathname: url.pathname };
}

module.exports = { sandboxWebhookUrl, verifySandboxWebhook };
