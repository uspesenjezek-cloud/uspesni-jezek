"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const client = require(path.join(root, "api", "_lib", "fiskaly-sign-de"));
const handler = fs.readFileSync(path.join(root, "api", "_handlers", "pos-fiskaly.js"), "utf8");
const router = fs.readFileSync(path.join(root, "api", "pos.js"), "utf8");
const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "pos-terminal.html"), "utf8");
const js = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");

assert.strictEqual(client.TEST_BASE_URL, "https://kassensichv-middleware.fiskaly.com/api/v2");
assert.strictEqual(client.LIVE_BASE_URL, "https://kassensichv.fiskaly.com/api/v2");
assert.throws(() => client.configuration({}), /še ni nastavljena/);
assert.throws(() => client.configuration({ FISKALY_SIGN_DE_MODE: "live", FISKALY_API_KEY_TEST: "x", FISKALY_API_SECRET_TEST: "y" }), /še ni omogočen/);
const cfg = client.configuration({ FISKALY_API_KEY_TEST: "test_key", FISKALY_API_SECRET_TEST: "test_secret" });
assert.deepStrictEqual({ mode: cfg.mode, baseUrl: cfg.baseUrl }, { mode: "test", baseUrl: client.TEST_BASE_URL });
const configured = client.configuration({ FISKALY_API_KEY_TEST: "test_key", FISKALY_API_SECRET_TEST: "test_secret", FISKALY_TSS_ID_TEST: "tss", FISKALY_CLIENT_ID_TEST: "client" });
assert.deepStrictEqual({ tssId: configured.tssId, clientId: configured.clientId }, { tssId: "tss", clientId: "client" });
assert.strictEqual(client.listCount([{ id: 1 }]), 1);
assert.strictEqual(client.listCount({ data: [{ id: 1 }, { id: 2 }] }), 2);
assert.match(handler, /preveriUporabnika/);
assert.match(handler, /Cache-Control/);
assert.doesNotMatch(handler, /api_secret|FISKALY_API_SECRET_TEST/);
assert.match(router, /"fiskaly-sign": require\("\.\/_handlers\/pos-fiskaly"\)/);
assert.match(vercel, /\/api\/pos-fiskaly/);
assert.match(html, /data-fiskaly-status/);
assert.match(html, /Gotovinski modul ostaja izključen/);
assert.match(js, /loadFiskalyCapability/);
assert.match(js, /integrationReady/);
assert.doesNotMatch(js, /FISKALY_API_(?:KEY|SECRET)/);

console.log("POS fiskaly SIGN DE testna povezava: OK");
