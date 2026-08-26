"use strict";

const assert = require("node:assert");
const { sandboxWebhookUrl, verifySandboxWebhook } = require("./pos-openapi-sandbox-webhook-preflight");

const validUrl = "https://preview.example.test/api/pos?handler=openapi-invoice&webhook=1&sandbox=1";

function response(status, body, headers) {
  return {
    status,
    headers: new Headers(headers || {}),
    async json() {
      if (body === undefined) throw new Error("not json");
      return body;
    },
  };
}

assert.strictEqual(sandboxWebhookUrl(validUrl).hostname, "preview.example.test");
for (const invalid of [
  "http://preview.example.test/api/pos?handler=openapi-invoice&webhook=1&sandbox=1",
  "https://preview.example.test/api/pos?handler=openapi-invoice&webhook=1",
  "https://preview.example.test/api/pos?handler=openapi-invoice&webhook=1&sandbox=0",
  "https://user:pass@preview.example.test/api/pos?handler=openapi-invoice&webhook=1&sandbox=1",
]) {
  assert.throws(() => sandboxWebhookUrl(invalid), (error) => error.code === "OPENAPI_SANDBOX_WEBHOOK_URL_INVALID");
}

(async function () {
  let request;
  const passed = await verifySandboxWebhook({
    url: validUrl,
    fetch: async function (url, options) {
      request = { url, options };
      return response(401, { ok: false, napaka: "Openapi webhook ni pooblaščen." });
    },
  });
  assert.deepStrictEqual(passed, {
    ok: true, status: 401, origin: "https://preview.example.test", pathname: "/api/pos",
  });
  assert.strictEqual(request.options.redirect, "manual");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(request.options.headers, "Authorization"), false);
  assert.deepStrictEqual(JSON.parse(request.options.body), { data: {} });

  await assert.rejects(
    () => verifySandboxWebhook({
      url: validUrl,
      fetch: async () => response(302, undefined, { location: "https://vercel.com/sso-api" }),
    }),
    (error) => error.code === "OPENAPI_SANDBOX_WEBHOOK_DEPLOYMENT_PROTECTED"
  );
  await assert.rejects(
    () => verifySandboxWebhook({
      url: validUrl,
      fetch: async () => response(401, {
        protection: { vercel_auth_enabled: true },
        error: { message: "Protected deployment", code: "401" },
      }),
    }),
    (error) => error.code === "OPENAPI_SANDBOX_WEBHOOK_DEPLOYMENT_PROTECTED"
  );
  await assert.rejects(
    () => verifySandboxWebhook({ url: validUrl, fetch: async () => response(401, { ok: false, napaka: "Drug odgovor." }) }),
    (error) => error.code === "OPENAPI_SANDBOX_WEBHOOK_ROUTE_MISMATCH"
  );
  await assert.rejects(
    () => verifySandboxWebhook({
      url: validUrl,
      fetch: async () => response(404, { ok: false, napaka: "Neznana POS pot." }),
    }),
    (error) => error.code === "OPENAPI_SANDBOX_WEBHOOK_ROUTE_MISSING"
  );
  await assert.rejects(
    () => verifySandboxWebhook({ url: validUrl, fetch: async () => response(404, { ok: false }) }),
    (error) => error.code === "OPENAPI_SANDBOX_WEBHOOK_ROUTE_MISMATCH"
  );
  await assert.rejects(
    () => verifySandboxWebhook({ url: validUrl, fetch: async () => { throw new Error("offline"); } }),
    (error) => error.code === "OPENAPI_SANDBOX_WEBHOOK_UNREACHABLE"
  );

  console.log("POS Openapi sandbox webhook preflight tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
