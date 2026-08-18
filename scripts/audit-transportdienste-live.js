"use strict";

var fs = require("node:fs");
var path = require("node:path");
var puppeteer = require("puppeteer-core");

var root = path.resolve(__dirname, "..");
var outputDir = path.join(root, "output", "playwright", "transportdienste");
var reportPath = path.join(outputDir, "live-audit.json");

function loadLocalEnvironment() {
  var configPath = path.join(root, "app", "config.js");
  if (fs.existsSync(configPath)) {
    var config = fs.readFileSync(configPath, "utf8");
    var url = config.match(/url:\s*["']([^"']+)["']/);
    var anonKey = config.match(/anonKey:\s*["']([^"']+)["']/);
    if (url && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = url[1];
    if (anonKey && !process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = anonKey[1];
  }
  var envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach(function (line) {
    var match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'].*?)["']?\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  });
}

function browserExecutable() {
  var candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  return candidates.find(function (candidate) { return fs.existsSync(candidate); });
}

async function discover(page) {
  await page.goto("https://top-angebot.de/kategorien/transportdienste", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise(function (resolve) { setTimeout(resolve, 1200); });
  var rounds = 0;
  while (rounds < 50) {
    var loadMore = await page.$("a.loadmore");
    if (!loadMore) break;
    var before = await page.$$eval("a", function (anchors) {
      return anchors.filter(function (anchor) { return (anchor.textContent || "").trim() === "Mehr lesen"; }).length;
    });
    await page.evaluate(function (element) { element.click(); }, loadMore);
    await page.waitForFunction(function (previous) {
      var count = Array.from(document.querySelectorAll("a"))
        .filter(function (anchor) { return (anchor.textContent || "").trim() === "Mehr lesen"; }).length;
      return count > previous || !document.querySelector("a.loadmore");
    }, { timeout: 6000 }, before).catch(function () {});
    var after = await page.$$eval("a", function (anchors) {
      return anchors.filter(function (anchor) { return (anchor.textContent || "").trim() === "Mehr lesen"; }).length;
    });
    rounds += 1;
    if (after <= before) break;
  }
  return page.evaluate(async function () {
    var profiles = Array.from(new Set(Array.from(document.querySelectorAll("a[href]"))
      .filter(function (anchor) { return (anchor.textContent || "").trim() === "Mehr lesen"; })
      .map(function (anchor) { return anchor.href; })));
    var result = [];
    function visit(value, found) {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value.sameAs)) found.push.apply(found, value.sameAs);
      Object.values(value).forEach(function (child) { visit(child, found); });
    }
    for (var offset = 0; offset < profiles.length; offset += 6) {
      var items = await Promise.all(profiles.slice(offset, offset + 6).map(async function (profile) {
        try {
          var response = await fetch(profile, { credentials: "same-origin" });
          var html = await response.text();
          var doc = new DOMParser().parseFromString(html, "text/html");
          var found = [];
          var companyName = "";
          doc.querySelectorAll('script[type="application/ld+json"]').forEach(function (script) {
            try {
              var value = JSON.parse(script.textContent || "null");
              visit(value, found);
              var values = Array.isArray(value) ? value : [value];
              var business = values.find(function (entry) { return entry && entry.name && (entry.address || entry.telephone); });
              if (!companyName && business) companyName = business.name;
            } catch (_) { /* invalid JSON-LD is irrelevant for discovery */ }
          });
          var websites = Array.from(new Set(found
            .filter(function (url) { return /^https?:/i.test(url); })
            .filter(function (url) { return !/(facebook|instagram|youtube|linkedin|google\.|twitter|tiktok|wa\.me|whatsapp)/i.test(url); })));
          return websites.map(function (website) { return { companyName: companyName, profile: profile, website: website }; });
        } catch (_) {
          return [];
        }
      }));
      items.forEach(function (batch) { result.push.apply(result, batch); });
    }
    return { profileCount: profiles.length, websites: result };
  });
}

function responseCollector(resolve) {
  var payload = null;
  return {
    statusCode: 200,
    setHeader: function () {},
    status: function (status) { this.statusCode = status; return this; },
    json: function (data) { payload = data; resolve({ status: this.statusCode, data: data }); return this; },
    end: function (body) {
      if (payload !== null) return;
      try { payload = body ? JSON.parse(String(body)) : {}; } catch (_) { payload = { raw: String(body || "") }; }
      resolve({ status: this.statusCode, data: payload });
    },
  };
}

async function callEngine(handler, body) {
  return new Promise(function (resolve, reject) {
    var response = responseCollector(resolve);
    Promise.resolve(handler({
      method: "POST",
      body: body,
      headers: {},
      _mehkaBonitetaInternalUser: { id: "transportdienste-live-audit" },
    }, response)).catch(reject);
  });
}

async function imageMetrics(page, dataUrl) {
  if (!/^data:image\/jpeg;base64,/.test(String(dataUrl || ""))) return null;
  return page.evaluate(async function (source) {
    var image = document.createElement("img");
    image.src = source;
    await image.decode();
    var canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    var context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 64, 64);
    var pixels = context.getImageData(0, 0, 64, 64).data;
    var brightness = 0;
    var gray = 0;
    var white = 0;
    for (var index = 0; index < pixels.length; index += 4) {
      var high = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
      var low = Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
      var light = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
      brightness += light;
      if (light >= 70 && light <= 190 && high - low < 20) gray += 1;
      if (light >= 240) white += 1;
    }
    var count = pixels.length / 4;
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      averageBrightness: Math.round(brightness / count),
      grayRatio: Number((gray / count).toFixed(3)),
      whiteRatio: Number((white / count).toFixed(3)),
    };
  }, dataUrl);
}

function compactEvidence(evidence, metrics) {
  evidence = evidence || {};
  var image = evidence.imageDataUrl || evidence.evidenceImage || "";
  return {
    status: evidence.status || evidence.evidenceStatus || "",
    reason: evidence.reason || "",
    screenshotReady: evidence.screenshotReady === true || evidence.evidenceStatus === "captured",
    bytes: image ? Math.floor((image.split(",")[1] || "").length * 0.75) : 0,
    sourceUrl: evidence.sourceUrl || "",
    captureVersion: evidence.captureVersion || "",
    metrics: metrics,
  };
}

function confirmation(identity) {
  return {
    name: identity.ime || identity.naziv || "",
    businessName: identity.naziv || identity.ime || "",
    representativeName: identity.nosilec || identity.zastopniki && identity.zastopniki[0] || "",
    street: identity.naslov || "",
    postalCode: identity.postnaStevilka || "",
    city: identity.kraj || "",
    companyId: identity.companyId || "",
    confirmed: true,
  };
}

function saveReport(report) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

async function main() {
  loadLocalEnvironment();
  var executablePath = browserExecutable();
  if (!executablePath) throw new Error("Local Chrome/Edge executable was not found.");
  var args = process.argv.slice(2);
  var limitArg = args.find(function (arg) { return arg.startsWith("--limit="); });
  var startArg = args.find(function (arg) { return arg.startsWith("--start="); });
  var matchArg = args.find(function (arg) { return arg.startsWith("--match="); });
  var limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
  var start = startArg ? Math.max(0, Number(startArg.split("=")[1]) || 0) : 0;
  var full = args.includes("--full");
  var browser = await puppeteer.launch({ executablePath: executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  var page = await browser.newPage();
  var discovery = await discover(page);
  if (args.includes("--discover-only")) {
    console.log(JSON.stringify({ profileCount: discovery.profileCount, websiteCount: discovery.websites.length }));
    await browser.close().catch(function () {});
    return;
  }
  var matchPatterns = matchArg ? matchArg.split("=")[1].toLowerCase().split(",").filter(Boolean) : [];
  var discoveredWebsites = matchArg
    ? discovery.websites.filter(function (entry) {
      return matchPatterns.some(function (pattern) { return entry.website.toLowerCase().includes(pattern); });
    })
    : discovery.websites;
  var websites = discoveredWebsites.slice(start, Number.isFinite(limit) ? start + limit : discoveredWebsites.length);
  var report = { startedAt: new Date().toISOString(), profileCount: discovery.profileCount, discoveredWebsiteCount: discovery.websites.length, startOffset: start, full: full, results: [] };
  saveReport(report);
  var handler = require("../api/mehka-boniteta");

  for (var index = 0; index < websites.length; index += 1) {
    var entry = websites[index];
    var started = Date.now();
    var record = { companyName: entry.companyName, profile: entry.profile, website: entry.website };
    try {
      var first = await callEngine(handler, { spletnaStran: entry.website, uporabiOpenRegisterIdentiteto: false });
      var firstData = first.data || {};
      var identityImage = firstData.identityEvidence && firstData.identityEvidence.imageDataUrl;
      var identityMetrics = await imageMetrics(page, identityImage).catch(function () { return null; });
      record.httpStatus = first.status;
      record.identity = firstData.identity || {};
      record.publicProfile = {
        status: firstData.publicProfile && firstData.publicProfile.status || "",
        reason: firstData.publicProfile && firstData.publicProfile.reason || "",
        sourceUrl: firstData.publicProfile && firstData.publicProfile.sourceUrl || "",
      };
      record.identityEvidence = compactEvidence(firstData.identityEvidence, identityMetrics);
      record.confirmationRequired = firstData.confirmationRequired === true;
      record.result = firstData.result || {};
      if (full && first.status === 200 && firstData.confirmationRequired && firstData.identity) {
        var confirmed = confirmation(firstData.identity);
        var second = await callEngine(handler, {
          spletnaStran: entry.website,
          uporabiOpenRegisterIdentiteto: false,
          confirmedIdentity: confirmed,
        });
        var secondData = second.data || {};
        var official = secondData.insolvency && secondData.insolvency.officialVerification || {};
        var officialMetrics = await imageMetrics(page, official.evidenceImage).catch(function () { return null; });
        record.confirmationHttpStatus = second.status;
        record.confirmationError = secondData.ok === false ? { code: secondData.code || "", message: secondData.napaka || "" } : null;
        record.insolvency = {
          status: secondData.insolvency && secondData.insolvency.status || "",
          reason: secondData.insolvency && secondData.insolvency.reason || "",
          searchedName: secondData.insolvency && secondData.insolvency.searchedName || "",
          searchedCity: secondData.insolvency && secondData.insolvency.searchedCity || "",
          officialStatus: official.status || "",
          officialReason: official.reason || "",
          evidence: compactEvidence(official, officialMetrics),
        };
      }
    } catch (error) {
      record.error = String(error && error.stack || error);
    }
    record.durationMs = Date.now() - started;
    report.results.push(record);
    report.updatedAt = new Date().toISOString();
    saveReport(report);
    console.log("[" + (start + index + 1) + "/" + discoveredWebsites.length + "] " + entry.website + " -> " + (record.identity && record.identity.status || record.error || "unknown"));
  }
  report.finishedAt = new Date().toISOString();
  saveReport(report);
  await browser.close().catch(function () {});
  console.log("Report: " + reportPath);
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
