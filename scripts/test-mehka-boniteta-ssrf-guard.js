"use strict";

var assert = require("node:assert/strict");
var dgram = require("node:dgram");
var EventEmitter = require("node:events");
var fs = require("node:fs");
var path = require("node:path");
var test = require("../api/_handlers/mehka-boniteta")._test;

function zahteva(url, moznosti) {
  var nastavitve = moznosti || {};
  var zakljuci;
  var rezultat = { action: "pending", reason: "", response: null, continueCalls: 0 };
  var done = new Promise(function (resolve) { zakljuci = resolve; });
  var handled = false;
  return {
    result: rezultat,
    done: done,
    url: function () { return url; },
    method: function () { return nastavitve.method || "GET"; },
    headers: function () { return nastavitve.headers || { accept: "text/html" }; },
    postData: function () { return nastavitve.postData; },
    resourceType: function () { return nastavitve.resourceType || "document"; },
    isNavigationRequest: function () { return nastavitve.navigation !== false; },
    isInterceptResolutionHandled: function () { return handled; },
    continue: async function () {
      assert.strictEqual(handled, false, "zahteva se sme zaključiti samo enkrat");
      handled = true;
      rezultat.continueCalls += 1;
      rezultat.action = "continue";
      zakljuci(rezultat);
    },
    respond: async function (response) {
      assert.strictEqual(handled, false, "zahteva se sme zaključiti samo enkrat");
      handled = true;
      rezultat.action = "respond";
      rezultat.response = response;
      zakljuci(rezultat);
    },
    abort: async function (reason) {
      assert.strictEqual(handled, false, "zahteva se sme zaključiti samo enkrat");
      handled = true;
      rezultat.action = "abort";
      rezultat.reason = reason;
      zakljuci(rezultat);
    },
  };
}

class TestnaStran extends EventEmitter {
  constructor() {
    super();
    this.interception = [];
    this.serviceWorkerBypass = [];
    this.closed = false;
  }

  async setRequestInterception(vrednost) {
    this.interception.push(vrednost);
  }

  async setBypassServiceWorker(vrednost) {
    this.serviceWorkerBypass.push(vrednost);
  }

  isClosed() {
    return this.closed;
  }
}

function lokalnaHttpTvornica(zapisi) {
  return function (url, moznosti, obOdgovoru) {
    var odhodna = new EventEmitter();
    var unicena = false;
    odhodna.destroy = function (napaka) {
      unicena = true;
      if (napaka) setImmediate(function () { odhodna.emit("error", napaka); });
    };
    odhodna.end = function (telo) {
      moznosti.lookup(url.hostname, { all: false }, function (napaka, address, family) {
        if (napaka) { odhodna.emit("error", napaka); return; }
        zapisi.push({
          url: url.toString(),
          address: address,
          family: family,
          servername: moznosti.servername,
          rejectUnauthorized: moznosti.rejectUnauthorized,
          method: moznosti.method,
          acceptEncoding: moznosti.headers["accept-encoding"],
          body: telo ? Buffer.from(telo).toString("utf8") : "",
        });
        if (unicena) return;
        var odgovor = new EventEmitter();
        var jePreusmeritev = url.hostname === "redirect-public.test";
        var jeStisnjen = url.hostname === "compressed.test";
        var jeHtml = url.hostname === "fetch-public.test";
        odgovor.statusCode = jePreusmeritev ? 302 : 200;
        odgovor.headers = jePreusmeritev
          ? { location: "http://redirect-private.test/admin", connection: "keep-alive" }
          : { "content-type": jeHtml ? "text/html; charset=utf-8" : "text/plain", connection: "keep-alive" };
        if (jeStisnjen) odgovor.headers["content-encoding"] = "gzip";
        odgovor.destroy = function () { unicena = true; };
        obOdgovoru(odgovor);
        setImmediate(function () {
          if (unicena) return;
          if (!jePreusmeritev) odgovor.emit("data", Buffer.from(jeHtml ? "<html><body>Javni Impressum</body></html>" : "varen javni odgovor"));
          odgovor.emit("end");
        });
      });
    };
    return odhodna;
  };
}

async function poslji(stran, url, moznosti) {
  var req = zahteva(url, moznosti);
  stran.emit("request", req);
  await req.done;
  return req.result;
}

async function moraZavrniti(obljuba, koda) {
  await assert.rejects(obljuba, function (napaka) {
    return napaka && napaka.message === koda;
  });
}

async function konfiguracijaRealnegaChromiuma() {
  var puppeteerModul = await import("puppeteer-core");
  var puppeteer = puppeteerModul.default || puppeteerModul;
  if (process.platform === "win32") {
    var poti = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    var executablePath = poti.find(function (pot) { return fs.existsSync(pot); });
    assert.ok(executablePath, "Realni Chrome/Edge za WebRTC UDP harness ni bil najden.");
    return { puppeteer: puppeteer, executablePath: executablePath, headless: true, baseArgs: ["--no-sandbox", "--disable-setuid-sandbox"] };
  }
  var chromiumModul = await import("@sparticuz/chromium");
  var chromium = chromiumModul.default || chromiumModul;
  chromium.setGraphicsMode = false;
  return {
    puppeteer: puppeteer,
    executablePath: await chromium.executablePath(),
    headless: "shell",
    baseArgs: chromium.args,
  };
}

async function zaznajWebRtcStunUdp(konfiguracija, argumenti) {
  var udp = dgram.createSocket("udp4");
  var udpHit = false;
  udp.on("message", function () { udpHit = true; });
  await new Promise(function (resolve, reject) {
    udp.once("error", reject);
    udp.bind(0, "127.0.0.1", function () { udp.removeListener("error", reject); resolve(); });
  });
  var port = udp.address().port;
  var browser = null;
  try {
    browser = await konfiguracija.puppeteer.launch({
      executablePath: konfiguracija.executablePath,
      headless: konfiguracija.headless,
      args: argumenti,
    });
    var stran = await browser.newPage();
    await stran.goto("data:text/html,<meta charset=utf-8><title>WebRTC UDP SSRF harness</title>");
    var podprt = await stran.evaluate(async function (stunPort) {
      if (typeof RTCPeerConnection !== "function") return false;
      var povezava = new RTCPeerConnection({ iceServers: [{ urls: "stun:127.0.0.1:" + stunPort }] });
      window.__ssrfWebRtcHarness = povezava;
      povezava.createDataChannel("ssrf-probe");
      await povezava.setLocalDescription(await povezava.createOffer());
      return true;
    }, port);
    assert.strictEqual(podprt, true, "Realni Chromium nima pričakovanega RTCPeerConnection API-ja.");
    var konec = Date.now() + 2000;
    while (!udpHit && Date.now() < konec) await new Promise(function (resolve) { setTimeout(resolve, 50); });
    return udpHit;
  } finally {
    if (browser) await browser.close();
    await new Promise(function (resolve) {
      try { udp.close(function () { resolve(); }); } catch (_) { resolve(); }
    });
  }
}

(async function () {
  var handlerSource = fs.readFileSync(path.join(__dirname, "../api/_handlers/mehka-boniteta.js"), "utf8");
  assert.match(handlerSource, /async function poisciImpressumZBrskalnikom[\s\S]*?newPage\(\)[\s\S]*?namestiVarovaloJavnihPuppeteerZahtev\(stran\)[\s\S]*?stran\.goto/,
    "brskalniško iskanje Impressuma mora guard namestiti pred prvo navigacijo");
  assert.match(handlerSource, /async function zajemiDokaziloIdentitete[\s\S]*?newPage\(\)[\s\S]*?namestiVarovaloJavnihPuppeteerZahtev\(stran\)[\s\S]*?stran\.goto/,
    "zajem dokazila mora guard namestiti pred navigacijo");
  var uradniTok = (handlerSource.match(/async function preveriUradniInsolvencniPortalEnkrat[\s\S]*?\r?\n}\r?\n\r?\nasync function preveriUradniInsolvencniPortal\(/) || [""])[0];
  assert.match(uradniTok, /zazeniBrskalnikZaDokazilo\(\{\s*dovoljeniConnectUrlji:\s*\[INSOLVENCY_PORTAL\]\s*}\)/,
    "uradni insolvenčni tok mora uporabljati browser-wide allowlist fiksnega portala");
  assert.doesNotMatch(uradniTok, /namestiVarovaloJavnihPuppeteerZahtev/,
    "fiksni uradni portal ne sme ročno proxyjati vsakega Chromium resursa");
  assert.match(handlerSource, /function zazeniBlokirniPuppeteerProxy[\s\S]*server\.on\("connect"[\s\S]*najdiDovoljeniPuppeteerConnectCilj[\s\S]*net\.connect\(\{ host: cilj\.address/,
    "allowlist proxy mora CONNECT tunel pripeti na vnaprej preverjeni javni IP");
  assert.ok((handlerSource.match(/args:\s*varniPuppeteerOmrezniArgumenti/g) || []).length >= 2,
    "vse lokalne in produkcijske launch poti morajo imeti browser-wide fail-closed egress");
  assert.match(handlerSource, /function zazeniBlokirniPuppeteerProxy[\s\S]*server\.on\("connect"[\s\S]*socket\.destroy\(\)[\s\S]*server\.on\("upgrade"/,
    "blokirni proxy mora zavrniti tudi CONNECT in nadgradnje novega popup targeta");
  var popupArgumenti = test.varniPuppeteerOmrezniArgumenti([
    "--no-sandbox", "--proxy-server=http://napacen.test:8080", "--proxy-bypass-list=*",
    "--webrtc-ip-handling-policy=default", "--force-webrtc-ip-handling-policy=default", "--disable-quic"
  ], "http://127.0.0.1:43123");
  assert.ok(popupArgumenti.includes("--proxy-server=http://127.0.0.1:43123"));
  assert.ok(popupArgumenti.includes("--proxy-bypass-list=<-loopback>"),
    "raw-IP/localhost popup ne sme uporabiti Chromiumovega implicitnega loopback bypassa");
  assert.ok(popupArgumenti.includes("--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"),
    "Chromium mora doseči samo lokalni proxy, vsi ciljni DNS pa ostanejo blokirani");
  assert.ok(popupArgumenti.includes("--webrtc-ip-handling-policy=disable_non_proxied_udp"));
  assert.ok(popupArgumenti.includes("--force-webrtc-ip-handling-policy=disable_non_proxied_udp"));
  assert.ok(popupArgumenti.includes("--disable-quic"));
  assert.strictEqual(popupArgumenti.filter(function (argument) { return argument.startsWith("--proxy-server="); }).length, 1,
    "nov target mora že pred page interceptorjem poznati samo naš blokirni proxy");
  assert.strictEqual(popupArgumenti.filter(function (argument) { return argument.startsWith("--webrtc-ip-handling-policy="); }).length, 1);
  assert.strictEqual(popupArgumenti.filter(function (argument) { return argument.startsWith("--force-webrtc-ip-handling-policy="); }).length, 1);
  assert.strictEqual(popupArgumenti.filter(function (argument) { return argument === "--disable-quic"; }).length, 1);

  var uradniCilji = await test.pripraviDovoljenePuppeteerConnectCilje([
    "https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf",
  ], async function (hostname) {
    assert.strictEqual(hostname, "neu.insolvenzbekanntmachungen.de");
    return [{ address: "93.184.216.34", family: 4 }];
  });
  assert.deepStrictEqual(uradniCilji, [{
    hostname: "neu.insolvenzbekanntmachungen.de",
    address: "93.184.216.34",
    family: 4,
    port: 443,
  }]);
  assert.strictEqual(test.najdiDovoljeniPuppeteerConnectCilj(
    "neu.insolvenzbekanntmachungen.de:443", uradniCilji
  ), uradniCilji[0]);
  assert.strictEqual(test.najdiDovoljeniPuppeteerConnectCilj(
    "NEU.INSOLVENZBEKANNTMACHUNGEN.DE:443", uradniCilji
  ), uradniCilji[0]);
  assert.strictEqual(test.najdiDovoljeniPuppeteerConnectCilj("127.0.0.1:443", uradniCilji), null);
  assert.strictEqual(test.najdiDovoljeniPuppeteerConnectCilj("169.254.169.254:80", uradniCilji), null);
  assert.strictEqual(test.najdiDovoljeniPuppeteerConnectCilj("neu.insolvenzbekanntmachungen.de:80", uradniCilji), null);
  await moraZavrniti(test.pripraviDovoljenePuppeteerConnectCilje([
    "https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf",
  ], async function () { return [{ address: "127.0.0.1", family: 4 }]; }), "WEBSITE_NOT_PUBLIC");

  var realniChromium = await konfiguracijaRealnegaChromiuma();
  var utrjeniArgumenti = test.varniPuppeteerOmrezniArgumenti(realniChromium.baseArgs, "http://127.0.0.1:9");
  var argumentiPredUdpPopravkom = utrjeniArgumenti.filter(function (argument) {
    return !/^--(?:webrtc-ip-handling-policy|force-webrtc-ip-handling-policy|disable-quic)(?:=|$)/.test(argument);
  });
  assert.strictEqual(await zaznajWebRtcStunUdp(realniChromium, argumentiPredUdpPopravkom), true,
    "kontrolni realni Chrome mora brez UDP utrditve reproducirati WebRTC/STUN loopback bypass");
  assert.strictEqual(await zaznajWebRtcStunUdp(realniChromium, utrjeniArgumenti), false,
    "utrjeni realni Chrome ne sme poslati WebRTC/STUN UDP mimo HTTP proxyja");

  assert.strictEqual(test.jeZasebenIp("10.2.3.4"), true);
  assert.strictEqual(test.jeZasebenIp("100.64.1.1"), true, "CGNAT ne sme biti dosegljiv iz brskalnika");
  assert.strictEqual(test.jeZasebenIp("169.254.169.254"), true, "metadata naslov mora biti blokiran");
  assert.strictEqual(test.jeZasebenIp("192.0.2.10"), true, "dokumentacijski IPv4 je rezerviran");
  assert.strictEqual(test.jeZasebenIp("198.18.0.1"), true, "benchmark omrežje je rezervirano");
  assert.strictEqual(test.jeZasebenIp("8.8.8.8"), false);
  assert.strictEqual(test.jeZasebenIp("::1"), true);
  assert.strictEqual(test.jeZasebenIp("::ffff:127.0.0.1"), true, "IPv4-mapped loopback mora ostati blokiran");
  assert.strictEqual(test.jeZasebenIp("fc00::1"), true);
  assert.strictEqual(test.jeZasebenIp("2001:db8::1"), true, "dokumentacijski IPv6 je rezerviran");
  assert.strictEqual(test.jeZasebenIp("2606:4700:4700::1111"), false);

  var lookupKlici = [];
  async function javniLookup(hostname) {
    lookupKlici.push(hostname);
    return [{ address: "93.184.216.34", family: 4 }, { address: "2606:4700:4700::1111", family: 6 }];
  }

  var javniUrl = await test.preveriJavniSpletniNaslov("https://public.test/path", { lookup: javniLookup });
  assert.strictEqual(javniUrl.hostname, "public.test");
  assert.deepStrictEqual(lookupKlici, ["public.test"]);
  assert.strictEqual((await test.preveriJavniSpletniNaslov("https://8.8.8.8/", { lookup: function () {
    throw new Error("IP literal ne sme sprožiti DNS");
  } })).hostname, "8.8.8.8");
  await moraZavrniti(test.preveriJavniSpletniNaslov("http://127.0.0.1/"), "WEBSITE_NOT_PUBLIC");
  await moraZavrniti(test.preveriJavniSpletniNaslov("http://2130706433/"), "WEBSITE_NOT_PUBLIC");
  await moraZavrniti(test.preveriJavniSpletniNaslov("http://0x7f000001/"), "WEBSITE_NOT_PUBLIC");
  await moraZavrniti(test.preveriJavniSpletniNaslov("http://[::1]/"), "WEBSITE_NOT_PUBLIC");
  await moraZavrniti(test.preveriJavniSpletniNaslov("https://localhost/"), "WEBSITE_NOT_PUBLIC");
  await moraZavrniti(test.preveriJavniSpletniNaslov("file:///etc/passwd", { dodajHttps: false }), "WEBSITE_INVALID");
  await moraZavrniti(test.preveriJavniSpletniNaslov("https://user:secret@public.test/", { lookup: javniLookup }), "WEBSITE_INVALID");
  await moraZavrniti(test.preveriJavniSpletniNaslov("https://mixed.test/", {
    lookup: async function () {
      return [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }];
    },
  }), "WEBSITE_NOT_PUBLIC");

  var stran = new TestnaStran();
  var rebindStevec = 0;
  var dnsGostitelji = [];
  var transportniZapisi = [];
  var cleanup = await test.namestiVarovaloJavnihPuppeteerZahtev(stran, {
    lookup: async function (hostname) {
      dnsGostitelji.push(hostname);
      if (hostname === "redirect-private.test" || hostname === "assets-private.test") {
        return [{ address: "10.1.2.3", family: 4 }];
      }
      if (hostname === "rebind.test") {
        rebindStevec += 1;
        return [{ address: rebindStevec === 1 ? "93.184.216.34" : "192.168.1.20", family: 4 }];
      }
      return [{ address: "93.184.216.34", family: 4 }];
    },
    requestFactory: lokalnaHttpTvornica(transportniZapisi),
  });

  assert.deepStrictEqual(stran.interception, [true]);
  assert.deepStrictEqual(stran.serviceWorkerBypass, [true]);
  var javnaZahteva = await poslji(stran, "https://public.test/", { navigation: true });
  assert.strictEqual(javnaZahteva.action, "respond");
  assert.strictEqual(javnaZahteva.continueCalls, 0, "http(s) zahteva nikoli ne sme biti prepuščena Chromiumovemu DNS");
  assert.strictEqual(String(javnaZahteva.response.body), "varen javni odgovor");
  assert.strictEqual(transportniZapisi[0].address, "93.184.216.34");
  assert.strictEqual(transportniZapisi[0].servername, "public.test", "TLS mora ohraniti prvotni SNI in preverjanje certifikata");
  assert.strictEqual(transportniZapisi[0].rejectUnauthorized, true, "TLS certifikat mora ostati obvezno preverjen");
  assert.strictEqual(transportniZapisi[0].acceptEncoding, "identity");
  var stisnjenOdgovor = await poslji(stran, "https://compressed.test/bomba", { navigation: true });
  assert.strictEqual(stisnjenOdgovor.action, "abort",
    "strežnik, ki ignorira Accept-Encoding: identity, ne sme poslati stisnjenega telesa Chromiumu");
  assert.strictEqual(stisnjenOdgovor.continueCalls, 0);

  var preusmeritev = await poslji(stran, "https://redirect-public.test/start", { navigation: true });
  assert.strictEqual(preusmeritev.action, "respond");
  assert.strictEqual(preusmeritev.continueCalls, 0);
  assert.strictEqual(preusmeritev.response.status, 302, "Node transport ne sme sam slediti preusmeritvi");
  assert.strictEqual(preusmeritev.response.headers.location, "http://redirect-private.test/admin");
  assert.strictEqual((await poslji(stran, "https://redirect-private.test/admin", { navigation: true })).action, "abort",
    "zasebni cilj preusmeritve mora biti blokiran");
  assert.strictEqual((await poslji(stran, "http://assets-private.test/config", { navigation: false, resourceType: "xhr" })).action, "abort",
    "zasebni podvir mora biti blokiran");
  assert.strictEqual((await poslji(stran, "http://169.254.169.254/latest/meta-data", { navigation: false, resourceType: "fetch" })).action, "abort");
  assert.strictEqual((await poslji(stran, "http://[::1]/", { navigation: true })).action, "abort");
  assert.strictEqual((await poslji(stran, "file:///etc/passwd", { navigation: true })).action, "abort");
  assert.strictEqual((await poslji(stran, "data:text/html,<h1>ne</h1>", { navigation: true })).action, "abort",
    "data dokument ne sme postati navigacijski cilj");
  assert.strictEqual((await poslji(stran, "data:image/png;base64,AA==", { navigation: false, resourceType: "image" })).action, "continue");
  assert.strictEqual((await poslji(stran, "blob:https://public.test/id", { navigation: false, resourceType: "image" })).action, "continue");
  assert.strictEqual((await poslji(stran, "data:text/javascript,alert(1)", { navigation: false, resourceType: "script" })).action, "abort",
    "izvedljivi vgrajeni vir ni potreben za zajem dokazila");

  var prviRebind = await poslji(stran, "https://rebind.test/first", { navigation: true });
  assert.strictEqual(prviRebind.action, "respond");
  assert.strictEqual(prviRebind.continueCalls, 0);
  assert.strictEqual(rebindStevec, 1, "isti request sme izvorni DNS vprašati samo enkrat");
  var prviRebindTransport = transportniZapisi.find(function (zapis) { return zapis.url.includes("rebind.test/first"); });
  assert.ok(prviRebindTransport);
  assert.strictEqual(prviRebindTransport.address, "93.184.216.34",
    "transport mora uporabiti že preverjeni javni IP, ne naslednjega DNS odgovora");
  assert.strictEqual((await poslji(stran, "https://rebind.test/second", { navigation: false, resourceType: "xhr" })).action, "abort",
    "isti hostname se mora ob vsaki zahtevi znova razrešiti in zaznati DNS rebinding");
  assert.strictEqual(rebindStevec, 2);
  assert.ok(dnsGostitelji.includes("redirect-private.test"));
  assert.ok(dnsGostitelji.includes("assets-private.test"));

  var neposredniDnsKlici = 0;
  var neposredniTransportniZapisi = [];
  var neposredniHtml = await test.fetchJavniHtml(new URL("https://fetch-public.test/impressum"), {
    lookup: async function () {
      neposredniDnsKlici += 1;
      return [{ address: neposredniDnsKlici === 1 ? "93.184.216.34" : "10.0.0.8", family: 4 }];
    },
    requestFactory: lokalnaHttpTvornica(neposredniTransportniZapisi),
    timeoutMs: 1000,
  });
  assert.match(neposredniHtml.html, /Javni Impressum/);
  assert.strictEqual(neposredniDnsKlici, 1,
    "isti neposredni fetch ne sme po javnem preverjanju sprožiti drugega DNS odgovora");
  assert.strictEqual(neposredniTransportniZapisi[0].address, "93.184.216.34",
    "fetchJavniHtml mora priklop pripeti na že preverjeni javni IP");

  await cleanup();
  await cleanup();
  assert.deepStrictEqual(stran.interception, [true, false], "cleanup mora prestrezanje izklopiti natanko enkrat");
  assert.strictEqual(stran.listenerCount("request"), 0, "cleanup mora odstraniti request listener");

  var pocasnaStran = new TestnaStran();
  var sprostiLookup;
  var pocasniTransportniZapisi = [];
  var pocasniCleanup = await test.namestiVarovaloJavnihPuppeteerZahtev(pocasnaStran, {
    lookup: function () {
      return new Promise(function (resolve) { sprostiLookup = resolve; });
    },
    requestFactory: lokalnaHttpTvornica(pocasniTransportniZapisi),
  });
  var pocasnaZahteva = zahteva("https://slow.test/", { navigation: true });
  pocasnaStran.emit("request", pocasnaZahteva);
  await new Promise(function (resolve) { setImmediate(resolve); });
  var cleanupKoncan = false;
  var cakanjeNaCleanup = pocasniCleanup().then(function () { cleanupKoncan = true; });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(cleanupKoncan, false, "cleanup mora počakati na aktivno DNS preverjanje");
  sprostiLookup([{ address: "93.184.216.34", family: 4 }]);
  await Promise.all([pocasnaZahteva.done, cakanjeNaCleanup]);
  assert.strictEqual(pocasnaZahteva.result.action, "respond");
  assert.strictEqual(pocasniTransportniZapisi[0].address, "93.184.216.34");
  assert.deepStrictEqual(pocasnaStran.interception, [true, false]);
  assert.strictEqual(pocasnaStran.listenerCount("request"), 0);

  console.log("Mehka Boniteta Puppeteer SSRF guard: OK");
})().catch(function (napaka) {
  console.error(napaka);
  process.exitCode = 1;
});
