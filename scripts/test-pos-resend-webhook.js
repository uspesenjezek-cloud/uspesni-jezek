"use strict";

const assert = require("node:assert");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const webhook = require(path.join(root, "api", "_handlers", "pos-dostava-webhook.js"));
const migrationName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter(function (name) { return /pos_resend_webhook_events\.sql$/.test(name); })
  .sort().pop();
const hardeningName = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter(function (name) { return /pos_resend_webhook_hardening\.sql$/.test(name); })
  .sort().pop();
const hardening = fs.readFileSync(path.join(root, "supabase", "migrations", hardeningName), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", migrationName), "utf8");
const router = fs.readFileSync(path.join(root, "api", "pos.js"), "utf8");
const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
const localServer = fs.readFileSync(path.join(root, "scripts", "local-server.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "app", "pos-terminal.js"), "utf8");

function sign(secretBytes, id, timestamp, rawBody) {
  return crypto.createHmac("sha256", secretBytes)
    .update([id, timestamp, rawBody].join("."))
    .digest("base64");
}

const secretBytes = crypto.randomBytes(32);
const secret = "whsec_" + secretBytes.toString("base64");
const id = "msg_webhook_01";
const timestamp = "1787130000";
const rawBody = '{"type":"email.delivered","data":{"email_id":"email_01"},"created_at":"2026-08-19T17:00:00.000Z"}';
const signature = sign(secretBytes, id, timestamp, rawBody);

assert.strictEqual(webhook._test.verifySvixSignature({
  id, timestamp, signature: "v1," + signature, rawBody, secret, nowSeconds: Number(timestamp),
}), true, "veljaven Svix podpis mora biti sprejet");
assert.strictEqual(webhook._test.verifySvixSignature({
  id, timestamp, signature: "v1," + signature, rawBody: rawBody + " ", secret, nowSeconds: Number(timestamp),
}), false, "ze ena sprememba surovega telesa mora podpis zavrniti");
assert.strictEqual(webhook._test.verifySvixSignature({
  id, timestamp, signature: "v1," + signature, rawBody, secret, nowSeconds: Number(timestamp) + 301,
}), false, "zastarel webhook mora biti zavrnjen");
assert.strictEqual(webhook._test.verifySvixSignature({
  id, timestamp, signature: "v1,narobe v1," + signature, rawBody, secret, nowSeconds: Number(timestamp),
}), true, "rotacija podpisov mora sprejeti katerikoli veljaven v1 podpis");
assert.strictEqual(webhook._test.safeFailureCode({ data: { reason: "mailbox_full" } }), "mailbox_full", "kratka tehnicna koda je dovoljena");
assert.strictEqual(webhook._test.safeFailureCode({ data: { reason: "blocked recipient@example.de\n" } }), "", "poljubno besedilo ali naslov ne sme v podatkovno sled");

assert.match(migration, /create table private\.pos_resend_webhook_receipts/i);
assert.match(migration, /svix_id text primary key/i);
assert.match(migration, /on conflict \(svix_id\) do nothing/i);
assert.match(migration, /provider_event_at timestamptz/i);
assert.match(migration, /p_event_created_at > v_delivery\.last_provider_event_at/i);
assert.match(migration, /revoke all on function public\.pos_apply_resend_webhook_event[\s\S]*from public, anon, authenticated/i);
assert.match(migration, /grant execute on function public\.pos_apply_resend_webhook_event[\s\S]*to service_role/i);
assert.doesNotMatch(migration, /grant execute[\s\S]*to authenticated[\s\S]*pos_apply_resend_webhook_event/i);
assert.match(hardening, /alter table private\.pos_resend_webhook_receipts enable row level security/i);
assert.match(hardening, /create index pos_resend_webhook_receipts_delivery_idx/i);
assert.match(router, /"delivery-webhook": require\("\.\/_handlers\/pos-dostava-webhook"\)/);
assert.match(vercel, /"\/api\/pos-dostava-webhook"[\s\S]*handler=delivery-webhook/);
assert.match(localServer, /RESEND_WEBHOOK_SECRET/);
assert.match(localServer, /\/api\/pos-dostava-webhook/);
["Zakasnjeno", "Zavrnjeno", "Prijavljeno", "Zadržano", "Odprto", "Kliknjeno"].forEach(function (label) {
  assert.ok(ui.includes(label), "UI mora vsebovati status: " + label);
});

console.log("POS Resend webhook testi: OK");
