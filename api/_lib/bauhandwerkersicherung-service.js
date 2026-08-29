"use strict";

var model = require("../../app/bauhandwerkersicherung");

function same(a, b) { return String(a || "").trim().toLocaleLowerCase("de-DE") === String(b || "").trim().toLocaleLowerCase("de-DE"); }
function uuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }

async function prepare(cfg, userId, body, store) {
  var profile = await store.getProfile(cfg, userId, String(body.profileId || ""));
  if (!profile) throw Object.assign(new Error("Profil podjetja ni bil najden."), { status: 404, code: "PROFILE_NOT_FOUND" });
  if (!body.identity || !same(body.identity.legalName || body.identity.name, profile.legal_name)) throw Object.assign(new Error("Vnesena stranka se ne ujema z izbranim preverjenim profilom."), { status: 409, code: "PROFILE_IDENTITY_MISMATCH" });
  var draft = model.createDraft(body), audit = model.audit(draft, userId);
  var rows = await store.rest(cfg, "boniteta_650f_osnutki", { method: "POST", headers: { Prefer: "return=representation" }, body: { user_id: userId, profile_id: profile.id, status: "draft", legal_review_status: "pending", template_version: draft.templateVersion, draft_payload: draft, audit_payload: audit } });
  var saved = Array.isArray(rows) ? rows[0] : rows;
  return { id: saved && saved.id, draft: draft, audit: audit };
}

async function read(cfg, userId, draftId, store) {
  if (!uuid(draftId)) throw Object.assign(new Error("Manjka veljaven osnutek."), { status: 400, code: "INVALID_DRAFT_ID" });
  var rows = await store.rest(cfg, "boniteta_650f_osnutki?id=eq." + encodeURIComponent(draftId) + "&user_id=eq." + encodeURIComponent(userId) + "&select=*&limit=1");
  var row = Array.isArray(rows) && rows[0];
  if (!row) throw Object.assign(new Error("Osnutek ni bil najden."), { status: 404, code: "DRAFT_NOT_FOUND" });
  return row;
}

async function send(cfg, userId, body, store) {
  var row = await read(cfg, userId, body.draftId, store), draft = Object.assign({}, row.draft_payload, { sendGate: { legalReviewStatus: row.legal_review_status } });
  return model.sendGate(draft, { craftsmanConfirmed: body.craftsmanConfirmed === true });
}

async function handle(cfg, userId, body, store) {
  var action = String(body && body.action || "");
  if (action === "prepare_draft") return prepare(cfg, userId, body, store);
  if (action === "get_draft") return { draft: await read(cfg, userId, body.draftId, store) };
  if (action === "send_draft") return send(cfg, userId, body, store);
  throw Object.assign(new Error("Neznana operacija §650f."), { status: 400, code: "UNKNOWN_650F_ACTION" });
}

module.exports = { handle: handle, prepare: prepare, read: read, send: send, _test: { same: same, uuid: uuid } };
