var sentry = require("./_lib/sentry");
"use strict";

var crypto = require("crypto");
var db = require("./_lib/supabase-server");
var provider = require("./_lib/sms-provider");
var scheduler = require("./_lib/scheduler-core");

function varnoEnako(a, b) {
  var aa = Buffer.from(String(a || ""));
  var bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
}

function cronAvtoriziran(req, secret) {
  var auth = String((req.headers && req.headers.authorization) || "");
  var match = auth.match(/^Bearer\s+(.+)$/i);
  return Boolean(match && varnoEnako(match[1].trim(), secret));
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, napaka: "Samo GET ali POST." });
  }

  var cronSecret = String(process.env.CRON_SECRET || "");
  if (cronSecret.length < 16) {
    return res.status(500).json({ ok: false, napaka: "CRON_SECRET ni varno konfiguriran." });
  }
  if (!cronAvtoriziran(req, cronSecret)) {
    return res.status(401).json({ ok: false, napaka: "Dostop zavrnjen." });
  }

  var cfg;
  try {
    cfg = db.konfiguracija();
  } catch (err) {
    console.error("[obdelaj-opomine]", err.code || err.message);
    return res.status(500).json({ ok: false, napaka: "Strežniška konfiguracija manjka." });
  }

  // Označevanje zapadlih korakov kot "čaka potrditev" in v-app obvestila NISO
  // odvisna od SMS providerja - to mora delovati tudi, če providerja še ni.
  // Oboje je hkrati zaščiteno z DB-nivo stikalom sistem_stikala.opomin_scheduler
  // (fail-closed - glej migracijo), ki ga tu ne podvajamo, ker ga preverita
  // sami SQL funkciji.
  var oznaceno = null;
  try {
    oznaceno = await db.pokliciRpc(cfg, "oznaci_zapadle_za_potrditev", { p_limit: 200 });
    await db.pokliciRpc(cfg, "preveri_potekle_obljube_placila", {});
  } catch (err) {
    console.error("[obdelaj-opomine] oznacevanje", err.code || err.message);
    return res.status(500).json({ ok: false, napaka: "Označevanje zapadlih korakov ni uspelo." });
  }

  if (!provider.konfiguriran()) {
    return res.json({
      ok: true,
      oznaceno: oznaceno,
      summary: null,
      napaka: "SMS ponudnik ni konfiguriran - samo označevanje opravljeno.",
    });
  }

  try {
    var summary = await scheduler.obdelajZapadle({
      limit: 20,
      concurrency: 5,
      claim: async function (limit) {
        return db.pokliciRpc(cfg, "prevzemi_zapadle_opomine", { p_limit: limit });
      },
      sendSms: async function (payload) {
        // Dodatna varovalka na Node nivoju poleg SQL filtra kanal='sms' v
        // prevzemi_zapadle_opomine - glej KROG 3-1 v implementacijskem načrtu.
        if (payload.channel !== "sms") {
          var napacenKanal = new Error("Nepodprt kanal za avtomatsko pošiljanje: " + payload.channel);
          napacenKanal.nonRetryable = true;
          throw napacenKanal;
        }
        return provider.posljiSms(payload);
      },
      finish: async function (result) {
        return db.pokliciRpc(cfg, "zakljuci_opomin_posiljanje", {
          p_id: result.id,
          p_claim_token: result.claimToken,
          p_success: result.success,
          p_provider_message_id: result.providerMessageId,
          p_error: result.error,
          p_terminal: result.terminal,
        });
      },
    });
    return res.json({ ok: true, oznaceno: oznaceno, summary: summary });
  } catch (err) {
    console.error("[obdelaj-opomine]", err.code || err.message);
    return res.status(500).json({ ok: false, napaka: "Obdelava opominov trenutno ni uspela." });
  }
}

module.exports = sentry.wrapHandler(handler, "/api/obdelaj-opomine");
module.exports._test = { cronAvtoriziran: cronAvtoriziran, varnoEnako: varnoEnako };
