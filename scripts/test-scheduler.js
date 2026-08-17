"use strict";

var assert = require("assert/strict");
var fs = require("fs");
var path = require("path");
var random = require("../api/_lib/random-schedule");
var scheduler = require("../api/_lib/scheduler-core");
var activationHandler = require("../api/aktiviraj-nacrt");
var activation = activationHandler._test;
var cron = require("../api/obdelaj-opomine")._test;

var passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("  ✓ " + name);
  } catch (err) {
    console.error("  ✗ " + name);
    throw err;
  }
}

function basePlan(overrides) {
  var step = Object.assign({
    id: "stage-2",
    index: 2,
    kind: "sms",
    deliveryMode: "automatic",
    status: "confirmed",
    sendAt: "2026-08-12T10:00:00.000Z",
    finalMessage: "Testno sporočilo",
    primaryContacts: { sms: true },
    customContacts: { phoneNumbers: [] },
    _randomSchedule: { enabled: true, minSendTime: "07:00", maxSendTime: "21:00", minutesBefore: 15, minutesAfter: 30 },
  }, overrides || {});
  return { id: "plan-test", planId: "plan-test", version: "3", status: "ready_to_activate", steps: [step] };
}

async function main() {
  console.log("\nScheduler in aktivacija");

  await test("asimetrični Random uporablja −15/+30", function () {
    var result = random.izracunajRandomCas(
      "2026-08-12T10:00:00.000Z",
      { minSendTime: "07:00", maxSendTime: "21:00", minutesBefore: 15, minutesAfter: 30 },
      function (min) { return min; }
    );
    assert.equal(result.earliestMinutes, 11 * 60 + 45);
    assert.equal(result.latestMinutes, 12 * 60 + 30);
  });

  await test("Random nikoli ne preseže 07:00–21:00", function () {
    var result = random.izracunajRandomCas(
      "2026-08-12T04:55:00.000Z",
      { minSendTime: "07:00", maxSendTime: "21:00", minutesBefore: 60, minutesAfter: 180 },
      function (min) { return min; }
    );
    assert.equal(result.earliestMinutes, 7 * 60);
  });

  await test("aktivacija zavrne fiksni čas zunaj skupnega okna", function () {
    var plan = basePlan({
      sendAt: "2026-08-12T04:59:00.000Z",
      _randomSchedule: null,
    });
    plan.allowedSendWindow = { start: "07:00", end: "21:00" };
    assert.throws(function () {
      activation.pripraviAktivacijo(
        { id: "case-1", telefon_dolznika: "+38640111222", opomin_nacrt: plan },
        "3"
      );
    }, function (err) { return err.code === "OUTSIDE_SEND_WINDOW"; });
  });

  await test("skupno okno načrta je avtoritativno za Random", function () {
    var plan = basePlan({
      sendAt: "2026-08-12T17:50:00.000Z",
      _randomSchedule: {
        enabled: true,
        minSendTime: "07:00",
        maxSendTime: "21:00",
        minutesBefore: 0,
        minutesAfter: 60,
      },
    });
    plan.allowedSendWindow = { start: "08:00", end: "20:00" };
    var prepared = activation.pripraviAktivacijo(
      { id: "case-1", telefon_dolznika: "+38640111222", opomin_nacrt: plan },
      "3"
    );
    assert.ok(Date.parse(prepared.rows[0].scheduled_at) <= Date.parse("2026-08-12T18:00:00.000Z"));
    assert.equal(prepared.plan.steps[0]._randomSchedule.minSendTime, "08:00");
    assert.equal(prepared.plan.steps[0]._randomSchedule.maxSendTime, "20:00");
  });

  await test("izjema koraka ima prednost pred skupnim oknom", function () {
    var plan = basePlan({
      sendAt: "2026-08-12T15:50:00.000Z",
      allowedSendWindow: { start: "09:00", end: "18:00" },
      _randomSchedule: {
        enabled: true,
        minSendTime: "07:00",
        maxSendTime: "21:00",
        minutesBefore: 0,
        minutesAfter: 120,
      },
    });
    plan.allowedSendWindow = { start: "07:00", end: "21:00" };
    plan.allowedSendWindowMode = "per_step";
    var prepared = activation.pripraviAktivacijo(
      { id: "case-1", telefon_dolznika: "+38640111222", opomin_nacrt: plan },
      "3"
    );
    assert.ok(
      Date.parse(prepared.rows[0].scheduled_at) <=
        Date.parse("2026-08-12T16:00:00.000Z")
    );
    assert.equal(prepared.plan.steps[0]._randomSchedule.minSendTime, "09:00");
    assert.equal(prepared.plan.steps[0]._randomSchedule.maxSendTime, "18:00");
  });

  await test("Random ne obdrži osnovne minute, kadar obstaja druga možnost", function () {
    var result = random.izracunajRandomCas(
      "2026-08-12T18:49:00.000Z",
      { minSendTime: "07:00", maxSendTime: "21:00", minutesBefore: 15, minutesAfter: 15 },
      function () { return 15; }
    );
    assert.notEqual(result.chosenMinutes, 20 * 60 + 49);
    assert.ok(result.chosenMinutes >= 20 * 60 + 34);
    assert.ok(result.chosenMinutes <= 21 * 60);
  });

  await test("naslednji Random termin ni pred prejšnjim korakom", function () {
    var result = random.izracunajRandomCas(
      "2026-08-12T10:00:00.000Z",
      { minSendTime: "07:00", maxSendTime: "21:00", minutesBefore: 30, minutesAfter: 30 },
      function (min) { return min; },
      "2026-08-12T10:10:00.000Z"
    );
    assert.equal(result.earliestMinutes, 12 * 60 + 10);
    assert.ok(Date.parse(result.resolvedScheduledAt) >= Date.parse("2026-08-12T10:10:00.000Z"));
  });

  await test("pametna obdobja izberejo pravilen del dneva in njegov razpon", function () {
    var result = random.izracunajRandomCas(
      "2026-08-12T13:00:00.000Z",
      {
        mode: "pametno",
        minSendTime: "07:00",
        maxSendTime: "21:00",
        smartPeriods: random.privzetaPametnaObdobja(),
      },
      function (min) { return min; }
    );
    assert.equal(result.activePeriod.id, "popoldne");
    assert.equal(result.activePeriod.windowMinutes, 40);
    assert.equal(result.earliestMinutes, 14 * 60 + 20);
    assert.equal(result.latestMinutes, 15 * 60 + 40);
  });

  await test("prekrivajoča pametna obdobja so zavrnjena", function () {
    assert.throws(function () {
      random.izracunajRandomCas("2026-08-12T09:00:00.000Z", {
        mode: "pametno",
        minSendTime: "07:00",
        maxSendTime: "21:00",
        smartPeriods: [
          { start: "08:00", end: "11:00", windowMinutes: 20 },
          { start: "10:00", end: "12:00", windowMinutes: 20 },
        ],
      });
    }, function (err) { return err.code === "INVALID_SMART_PERIODS"; });
  });

  await test("prvi korak zavrne Random", function () {
    var plan = basePlan({ index: 1, id: "stage-1" });
    assert.throws(function () {
      activation.pripraviAktivacijo({ id: "case-1", telefon_dolznika: "+38640111222", opomin_nacrt: plan }, "3");
    }, function (err) { return err.code === "RANDOM_FIRST_STEP"; });
  });

  await test("izklopljen scheduler ne ustvari čakalne vrste", async function () {
    var oldEnabled = process.env.OPOMIN_SCHEDULER_ENABLED;
    delete process.env.OPOMIN_SCHEDULER_ENABLED;
    var statusCode = 200;
    var responseBody;
    var res = {
      status: function (value) { statusCode = value; return this; },
      json: function (value) { responseBody = value; return value; },
    };
    await activationHandler({ method: "POST", headers: {}, body: {} }, res);
    if (oldEnabled == null) delete process.env.OPOMIN_SCHEDULER_ENABLED;
    else process.env.OPOMIN_SCHEDULER_ENABLED = oldEnabled;
    assert.equal(statusCode, 503);
    assert.equal(responseBody.code, "SCHEDULER_DISABLED");
  });

  await test("predogled ni uporabljen kot dokončni čas", function () {
    var plan = basePlan();
    plan.steps[0]._randomSchedule._previewBaseAt = "2026-08-12T10:00:00.000Z";
    plan.steps[0]._randomSchedule._previewResolvedAt = "2026-08-12T15:00:00.000Z";
    plan.steps[0].sendAt = "2026-08-12T15:00:00.000Z";
    var prepared = activation.pripraviAktivacijo(
      { id: "case-1", telefon_dolznika: "+38640111222", opomin_nacrt: plan },
      "3",
      "2026-08-11T10:00:00.000Z"
    );
    var finalMillis = Date.parse(prepared.rows[0].scheduled_at);
    assert.ok(finalMillis >= Date.parse("2026-08-12T09:45:00.000Z"));
    assert.ok(finalMillis <= Date.parse("2026-08-12T10:30:00.000Z"));
    assert.equal(prepared.plan.steps[0]._randomSchedule._previewResolvedAt, undefined);
  });

  await test("vsak dodatni SMS-prejemnik dobi svoj idempotency ključ", function () {
    var plan = basePlan({ customContacts: { phoneNumbers: ["+38640111223", "+38640111223"] } });
    var prepared = activation.pripraviAktivacijo(
      { id: "case-1", telefon_dolznika: "+38640111222", opomin_nacrt: plan }, "3"
    );
    assert.equal(prepared.rows.length, 2);
    assert.notEqual(prepared.rows[0].idempotency_key, prepared.rows[1].idempotency_key);
  });

  await test("dva sočasna schedulerja ne prevzameta iste vrstice", async function () {
    var queue = [{ id: "1", prejemnik: "+38640111222", sporocilo: "A", idempotency_key: "p:s:0", claim_token: "c1" }];
    var sent = 0;
    async function claim() { return queue.splice(0, 1); }
    async function finish() { return true; }
    async function sendSms() { sent++; return { providerMessageId: "m1" }; }
    await Promise.all([
      scheduler.obdelajZapadle({ claim: claim, finish: finish, sendSms: sendSms }),
      scheduler.obdelajZapadle({ claim: claim, finish: finish, sendSms: sendSms }),
    ]);
    assert.equal(sent, 1);
  });

  await test("napaka ponudnika se zaključi kot failed in ohrani ključ", async function () {
    var row = { id: "1", prejemnik: "+38640111222", sporocilo: "A", idempotency_key: "p:s:0", claim_token: "c1", kanal: "sms" };
    var finishResult;
    var seenKey;
    var result = await scheduler.obdelajZapadle({
      claim: async function () { return [row]; },
      sendSms: async function (payload) { seenKey = payload.idempotencyKey; throw new Error("timeout"); },
      finish: async function (payload) { finishResult = payload; return true; },
    });
    assert.equal(seenKey, "p:s:0");
    assert.equal(finishResult.success, false);
    assert.equal(finishResult.terminal, false);
    assert.equal(result.failed, 1);
  });

  await test("sendSms payload vsebuje kanal iz vrstice (KROG 3-1)", async function () {
    var row = { id: "1", prejemnik: "+38640111222", sporocilo: "A", idempotency_key: "p:s:0", claim_token: "c1", kanal: "sms" };
    var seenChannel;
    await scheduler.obdelajZapadle({
      claim: async function () { return [row]; },
      sendSms: async function (payload) { seenChannel = payload.channel; return { providerMessageId: "m1" }; },
      finish: async function () { return true; },
    });
    assert.equal(seenChannel, "sms");
  });

  await test("neustrezen kanal je zavrnjen kot terminalna napaka pred pošiljanjem", async function () {
    var row = { id: "1", prejemnik: "test@example.com", sporocilo: "A", idempotency_key: "p:s:0", claim_token: "c1", kanal: "email" };
    var finishResult;
    var sendSmsPoklican = false;
    var result = await scheduler.obdelajZapadle({
      claim: async function () { return [row]; },
      sendSms: async function (payload) {
        sendSmsPoklican = true;
        if (payload.channel !== "sms") {
          var err = new Error("Nepodprt kanal za avtomatsko pošiljanje: " + payload.channel);
          err.nonRetryable = true;
          throw err;
        }
        return { providerMessageId: "m1" };
      },
      finish: async function (payload) { finishResult = payload; return true; },
    });
    assert.equal(sendSmsPoklican, true);
    assert.equal(finishResult.success, false);
    assert.equal(finishResult.terminal, true);
    assert.equal(result.failed, 1);
  });

  await test("neveljaven cron secret je zavrnjen", function () {
    assert.equal(cron.cronAvtoriziran({ headers: { authorization: "Bearer napačen" } }, "1234567890123456"), false);
    assert.equal(cron.cronAvtoriziran({ headers: { authorization: "Bearer 1234567890123456" } }, "1234567890123456"), true);
  });

  await test("migracija omeji RPC funkcije na service_role", function () {
    var migrationDir = path.join(__dirname, "..", "supabase", "migrations");
    var migration = fs.readFileSync(path.join(migrationDir, "20260811160523_opomin_scheduler.sql"), "utf8");
    assert.match(migration, /for update skip locked/i);
    assert.match(migration, /revoke all on function public\.prevzemi_zapadle_opomine/i);
    assert.match(migration, /grant execute on function public\.prevzemi_zapadle_opomine\(integer\) to service_role/i);
  });

  await test("Vercel Hobby uporablja največ dnevni cron", function () {
    var config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
    var crons = Array.isArray(config.crons) ? config.crons : [];
    assert.ok(crons.every(function (cron) {
      var deli = String(cron.schedule || "").trim().split(/\s+/);
      return deli.length === 5 && deli[0] !== "*" && deli[1] !== "*";
    }), "Hobby konfiguracija ne sme vsebovati minutnega ali urnega crona");
    assert.ok(crons.some(function (cron) {
      return cron.path === "/api/mehka-boniteta-delavec" && cron.schedule === "17 2 * * *";
    }), "projektno spremljanje potrebuje en dnevni zagon delavca");
  });

  await test("Random sheet vsebuje vseh šest pametnih obdobij", function () {
    var ui = fs.readFileSync(path.join(__dirname, "..", "app", "opomin-nacrt-ui.js"), "utf8");
    ["Zgodnje jutro", "Pozno jutro", "Opoldne", "Popoldne", "Proti večeru", "Večer"].forEach(function (label) {
      assert.ok(ui.includes(label), "Manjka obdobje: " + label);
    });
  });

  console.log("\nUspešnih scheduler testov: " + passed);
}

main().catch(function (err) {
  console.error(err.stack || err);
  process.exit(1);
});
