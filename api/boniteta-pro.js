var sentry = require("./_lib/sentry");
"use strict";

var db = require("./_lib/supabase-server");
var store = require("./_lib/boniteta-pro-store");
var queue = require("./_lib/mehka-boniteta-queue");
var openregister = require("./_lib/openregister-pro-client");
var projectMonitor = require("./_lib/projektno-spremljanje");
var crif = require("./_lib/crif-priprava");
var crifResult = require("./_lib/crif-rezultat");
var MONITOR_PREFERENCES = new Set(["basic", "representation", "financials", "documents", "ownership", "holdings", "insolvencies"]);

function json(res, status, body) { res.setHeader("Cache-Control", "no-store"); return res.status(status).json(body); }
function query(req, name) { if (req.query && req.query[name] != null) return String(req.query[name]); try { return new URL(req.url, "http://localhost").searchParams.get(name) || ""; } catch (_) { return ""; } }
function preferences(input) { var values = (Array.isArray(input) ? input : []).map(String).filter(function (v) { return MONITOR_PREFERENCES.has(v); }); return Array.from(new Set(values)).slice(0, 7); }
function route(req) { var named = query(req, "route"); if (named) return named; return String(req.url || "").includes("boniteta-profili") ? "profiles" : "openregister"; }

async function profiles(req, res, cfg, auth) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  if (req.method === "GET") {
    var view = query(req, "view");
    if (view === "alerts") return json(res, 200, { ok: true, alerts: await store.listAlerts(cfg, auth.user.id) });
    var id = query(req, "id");
    if (id) { var profile = await store.getProfile(cfg, auth.user.id, id); return profile ? json(res, 200, { ok: true, profile: profile }) : json(res, 404, { ok: false, napaka: "Profil ni bil najden." }); }
    return json(res, 200, { ok: true, profiles: await store.listProfiles(cfg, auth.user.id, view === "watched") });
  }
  var body = req.body && typeof req.body === "object" ? req.body : {};
  if (req.method === "DELETE") {
    var profileId = String(body.profileId || "");
    var profile = await store.getProfile(cfg, auth.user.id, profileId);
    if (!profile) return json(res, 404, { ok: false, napaka: "Profil ni bil najden." });
    // Če ima profil plačljivo OpenRegister spremljanje, ga odstranimo najprej,
    // da po brisanju lokalne vrstice ne ostane nevidna zunanja naročnina.
    var monitor = await store.getMonitorByProfile(cfg, auth.user.id, profile.id);
    if (monitor && profile.company_id) {
      try { await openregister.deleteMonitor(profile.company_id); }
      catch (deleteError) { if (deleteError.code !== "OPENREGISTER_NOT_FOUND") throw deleteError; }
    }
    // Profil in čakalna vrsta sta namensko ločena. Pred brisanjem profila zato
    // odstranimo tudi vse rezultate, dokazne posnetke in ponovne poskuse tega
    // podjetja, vendar izključno za prijavljenega uporabnika.
    // Če poseben service-role ključ ni nameščen, uporabimo prijavno sejo.
    // RLS v bazi tej seji dovoljuje izključno njene lastne vrstice.
    var purgeCfg;
    try { purgeCfg = db.konfiguracija(); } catch (_) { purgeCfg = cfg; }
    var purgedChecks = await queue.izbrisiPodatkeProfila(purgeCfg, auth.user.id, profile);
    var deleted = await store.deleteProfile(cfg, auth.user.id, profile.id);
    return json(res, 200, { ok: true, deleted: { id: deleted.id, legalName: deleted.legal_name, purgedChecks: purgedChecks } });
  }
  if (body.action === "mark_alert_read") return json(res, 200, { ok: true, alert: await store.markAlertRead(cfg, auth.user.id, String(body.alertId || "")) });
  if (body.action !== "save_check") return json(res, 400, { ok: false, napaka: "Neznana operacija." });
  return json(res, 200, { ok: true, profile: await store.upsertProfile(cfg, auth.user.id, body.profile || {}) });
}

async function crifRequests(req, res, cfg, auth) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  if (req.method === "GET") {
    var requestId = query(req, "id");
    if (requestId) { var detail = await store.getCrifRequest(cfg, auth.user.id, requestId); return detail ? json(res, 200, { ok: true, request: detail, provider: crif.providerStatus() }) : json(res, 404, { ok: false, napaka: "Analiza ni bila najdena." }); }
    return json(res, 200, { ok: true, requests: await store.listCrifRequests(cfg, auth.user.id), provider: crif.providerStatus() });
  }
  var body = req.body && typeof req.body === "object" ? req.body : {};
  if (body.action === "save_decision") return json(res, 200, { ok: true, request: await store.saveCrifDecision(cfg, String(body.requestId || ""), crifResult.decision(body)) });
  if (body.action === "open_dispute") return json(res, 200, { ok: true, request: await store.openCrifDispute(cfg, String(body.requestId || ""), crifResult.dispute(body)) });
  if (body.action === "activate" || body.action === "query" || body.action === "report") {
    var provider = crif.providerStatus();
    if (!provider.enabled) return json(res, 409, { ok: false, code: "CRIF_CONTRACT_REQUIRED", napaka: "CRIF poizvedba bo na voljo po sklenitvi platformske pogodbe in vnosu API dovoljenj." });
    return json(res, 501, { ok: false, code: "CRIF_ADAPTER_MAPPING_REQUIRED", napaka: "Pogodbeni CRIF-produkt je aktiviran, manjka pa še potrjena preslikava njegovega API-odziva." });
  }
  if (body.action !== "prepare_request") return json(res, 400, { ok: false, napaka: "Neznana operacija." });
  var prepared = crif.validate(body);
  return json(res, 200, { ok: true, request: await store.saveCrifRequest(cfg, auth.user.id, prepared), provider: prepared.provider, recommendation: prepared.recommendation });
}

async function pro(req, res, cfg, auth) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  var body = req.body && typeof req.body === "object" ? req.body : {};
  var action = req.method === "GET" ? query(req, "action") : String(body.action || "");
  if (action === "credits") return json(res, 200, { ok: true, credits: await openregister.credits() });
  if (action === "search") return json(res, 200, { ok: true, results: await openregister.advancedSearch(body) });
  var profileId = req.method === "GET" ? query(req, "profileId") : String(body.profileId || "");
  var profile = await store.getProfile(cfg, auth.user.id, profileId);
  if (!profile) return json(res, 404, { ok: false, napaka: "Profil ni bil najden." });
  // Plačljiv dokument mora biti vedno vezan na profil trenutnega uporabnika.
  // Sicer bi poljuben prijavljen uporabnik lahko po ID-ju naročil tuj dokument.
  if (action === "document") return json(res, 200, { ok: true, document: await openregister.document(body.documentId, false), creditsUsed: 10 });
  if (action === "document_realtime") return json(res, 200, { ok: true, document: await openregister.realtimeDocument(profile.company_id, body.category), creditsUsed: 10 });
  if (action === "transparency_order") return json(res, 200, { ok: true, extract: await openregister.transparencyOrder(profile.company_id), creditsUsed: 25 });
  if (action === "transparency_get") return json(res, 200, { ok: true, extract: await openregister.transparencyGet(body.extractId), creditsUsed: 0 });
  if (action === "project_monitor_get") return json(res, 200, { ok: true, monitor: await projectMonitor.get(cfg, auth.user.id, profile.id), policy: projectMonitor.policy(Number(body.projectValue || 0)) });
  if (action === "project_monitor_save") return json(res, 200, { ok: true, monitor: await projectMonitor.save(cfg, auth.user.id, profile, body) });
  if (action === "project_monitor_delete") { await projectMonitor.remove(cfg, auth.user.id, profile.id); return json(res, 200, { ok: true }); }
  if (action === "section") {
    var section = req.method === "GET" ? query(req, "section") : String(body.section || "");
    var force = req.method === "GET" ? query(req, "refresh") === "1" : Boolean(body.refresh);
    var realtime = req.method === "GET" ? query(req, "realtime") === "1" : Boolean(body.realtime);
    var cached = !force ? await store.getCache(cfg, auth.user.id, profile.id, section, false) : null;
    if (cached) return json(res, 200, { ok: true, section: section, data: cached.payload, cache: { hit: true, fetchedAt: cached.fetched_at, expiresAt: cached.expires_at, creditsUsed: 0, sourceMode: cached.source_mode } });
    if (!profile.company_id) return json(res, 409, { ok: false, code: "REGISTERED_COMPANY_REQUIRED", napaka: "Ta sklop je na voljo za uradno registrirana podjetja z OpenRegister ID." });
    var result = await openregister.section(profile.company_id, section, realtime), saved = await store.putCache(cfg, auth.user.id, profile.id, section, result);
    return json(res, 200, { ok: true, section: section, data: saved.payload, cache: { hit: false, fetchedAt: saved.fetched_at, expiresAt: saved.expires_at, creditsUsed: saved.credits_used, sourceMode: saved.source_mode } });
  }
  if (action === "monitor_create") {
    var prefs = preferences(body.preferences); if (!prefs.length) return json(res, 400, { ok: false, napaka: "Izberite vsaj eno vrsto sprememb." });
    var frequency = body.frequency === "daily" ? "daily" : "weekly", created = await openregister.createMonitor(profile.company_id, frequency, prefs), monitor;
    try {
      monitor = await store.upsertMonitor(cfg, auth.user.id, profile, frequency, prefs, created);
    } catch (saveError) {
      // Če lokalnega zapisa ni mogoče shraniti, odstranimo pravkar ustvarjeni
      // plačljivi monitor, da uporabniku ne ostane nevidna naročnina.
      try { await openregister.deleteMonitor(profile.company_id); } catch (_) {}
      throw saveError;
    }
    return json(res, 200, { ok: true, monitor: monitor, creditsUsed: frequency === "daily" ? 50 : 25 });
  }
  if (action === "monitor_delete") {
    try { await openregister.deleteMonitor(profile.company_id); }
    catch (deleteError) { if (deleteError.code !== "OPENREGISTER_NOT_FOUND") throw deleteError; }
    await store.deleteMonitor(cfg, auth.user.id, profile.company_id);
    return json(res, 200, { ok: true });
  }
  return json(res, 400, { ok: false, napaka: "Neznana OpenRegister Pro operacija." });
}

async function handler(req, res) {
  var cfg; try { cfg = db.uporabniskaKonfiguracija(); } catch (_) { return json(res, 503, { ok: false, napaka: "Strežniška shramba ni povezana." }); }
  var auth = await db.preveriUporabnika(req, cfg); if (!auth.ok) return json(res, auth.status, { ok: false, napaka: auth.napaka }); cfg.userToken = auth.token;
  try { var selected = route(req); return selected === "profiles" ? await profiles(req, res, cfg, auth) : selected === "crif" ? await crifRequests(req, res, cfg, auth) : await pro(req, res, cfg, auth); }
  catch (err) { console.error("[boniteta-pro]", err.code || err.message, err.details || ""); return json(res, err.status || 502, { ok: false, code: err.code || "BONITETA_PRO_FAILED", napaka: err.message || "Operacija ni uspela." }); }
}

module.exports = sentry.wrapHandler(handler, "/api/boniteta-pro");
module.exports._test = { preferences: preferences, query: query, route: route, crifRequests: crifRequests, normalizeCrifResult: crifResult.normalize };
