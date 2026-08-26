"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requestQuery = require(path.join(root, "api", "_lib", "pos-request-query"));
const stripe = require(path.join(root, "api", "_lib", "stripe-sandbox"));
const finapi = require(path.join(root, "api", "_lib", "finapi-access"));
const fiskaly = require(path.join(root, "api", "_lib", "fiskaly-sign-de"));
const datev = require(path.join(root, "api", "_lib", "datev-cloud"));
const delivery = require(path.join(root, "api", "_lib", "pos-delivery-providers"));
const posDispatcher = require(path.join(root, "api", "pos"));

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; return this; },
    json(value) { this.body = value; return this; },
    end(value) { this.body = JSON.parse(String(value || "null")); return this; },
  };
}

const req = { url: "/api/pos?handler=invoice-pdf&invoiceId=abc%20123&mode=metadata&mode=download" };
Object.defineProperty(req, "query", {
  get() { throw new Error("POS handlerji ne smejo uporabljati zastarelega req.query."); },
});
const query = requestQuery(req);
assert.equal(Object.getPrototypeOf(query), null);
assert.equal(query.handler, "invoice-pdf");
assert.equal(query.invoiceId, "abc 123");
assert.equal(query.mode, "metadata", "Ponovljeni parameter ne sme tiho preglasiti prve vrednosti.");
assert.equal(Object.isFrozen(query), true);
assert.deepEqual(Object.keys(requestQuery({ url: "not a valid absolute url" })), []);

const handlerDir = path.join(root, "api", "_handlers");
for (const name of fs.readdirSync(handlerDir).filter((value) => /^pos-.*\.js$/.test(value))) {
  const source = fs.readFileSync(path.join(handlerDir, name), "utf8");
  assert.doesNotMatch(source, /req\.query/, name + " ne sme sprožiti Node url.parse() prek Vercel req.query.");
}

assert.throws(
  () => stripe.configuration({ STRIPE_MODE: "live", STRIPE_SECRET_KEY: "sk_live_forbidden", STRIPE_WEBHOOK_SECRET: "whsec_1234567890123456" }),
  (error) => error && error.code === "STRIPE_LIVE_LOCKED"
);
assert.throws(
  () => finapi.configuration({ FINAPI_MODE: "production", FINAPI_CLIENT_ID: "x", FINAPI_CLIENT_SECRET: "y", FINAPI_USER_KEY: "0".repeat(32) }),
  (error) => error && error.code === "FINAPI_LIVE_LOCKED"
);
assert.throws(
  () => fiskaly.configuration({ FISKALY_SIGN_DE_MODE: "live", FISKALY_API_KEY_TEST: "x", FISKALY_API_SECRET_TEST: "y" }),
  (error) => error && error.code === "FISKALY_LIVE_LOCKED"
);
assert.throws(
  () => datev.configuration({ DATEV_MODE: "production" }),
  (error) => error && error.code === "DATEV_PRODUCTION_LOCKED"
);
assert.equal(delivery.deliveryReadiness({
  RESEND_API_KEY: "re_configured", POS_EMAIL_FROM: "rechnung@example.de",
}).sendEnabled, false, "Samo prisotni e-poštni ključi ne smejo omogočiti pošiljanja.");
assert.equal(delivery.deliveryReadiness({
  RESEND_API_KEY: "re_configured", POS_EMAIL_FROM: "rechnung@example.de",
  POS_EMAIL_DELIVERY_MODE: "production",
}).liveEnabled, false, "Produkcijski način brez izrecnega stikala ne sme omogočiti pošiljanja.");

(async function () {
  assert.equal(posDispatcher._test.route({ url: "/api/pos?handler=openapi-invoice&webhook=1" }), "openapi-invoice");
  const previousSecret = process.env.OPENAPI_INVOICE_WEBHOOK_SECRET;
  try {
    process.env.OPENAPI_INVOICE_WEBHOOK_SECRET = "";
    const response = mockRes();
    await posDispatcher({
      method: "POST",
      url: "/api/pos?handler=openapi-invoice&webhook=1",
      headers: {},
      body: {},
    }, response);
    assert.equal(response.statusCode, 401, "Javni callback mora doseči Openapi handler in brez skrivnosti vrniti aplikacijski 401.");
    assert.notEqual(response.body && response.body.napaka, "Neznana POS pot.");
  } finally {
    if (previousSecret === undefined) delete process.env.OPENAPI_INVOICE_WEBHOOK_SECRET;
    else process.env.OPENAPI_INVOICE_WEBHOOK_SECRET = previousSecret;
  }
  console.log("POS request meje, Node 24 URL pot, Openapi callback in produkcijski zaklepi: OK.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
