import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const url = "http://localhost:8001/NAZORJEVA-PREDLOGI-MOCKUP.html";

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const napake = [];
  page.on("pageerror", (e) => napake.push("PAGEERROR: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") napake.push("CONSOLE: " + m.text()); });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

  const klik = (sel, i = 0) => page.$$eval(sel, (els, ix) => {
    const el = els[ix];
    el.scrollIntoView({ block: "center" });
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, i);
  const razred = (sel, i = 0) => page.$$eval(sel, (els, ix) => els[ix].className, i);
  const zivec = (karticaSel) => page.$eval(karticaSel, (kartica) => {
    const primer = kartica.closest(".vrstica-primer") || kartica.parentElement;
    return primer.querySelector("p.mk-live").textContent;
  });

  // P13: tristopenjsko — izbira se premakne, povzetek prešteje nejasne
  await klik(".mk-tristopenjsko__vrsta .mk-tristopenjsko__gumbi button", 1);
  assert.match(await razred(".mk-tristopenjsko__vrsta .mk-tristopenjsko__gumbi button", 1), /is-selected/, "P13: Ni jasno se izbere");
  assert.doesNotMatch(await razred(".mk-tristopenjsko__vrsta .mk-tristopenjsko__gumbi button", 0), /is-selected/, "P13: prejšnja izbira se umakne");

  // P14: trojna — izbor se premakne
  await klik(".mk-trojna button", 0);
  assert.match(await razred(".mk-trojna button", 0), /is-najboljsa/, "P14: Ponudnik A postane izbran");

  // P15: manjkajoče — odvzemi eno vprašanje (začetno stanje: obe dodani)
  await klik(".mk-manjka__vrsta button", 0);
  assert.doesNotMatch(await razred(".mk-manjka__vrsta button", 0), /je-dodano/, "P15: tap odstrani vprašanje");
  await klik(".mk-manjka__vrsta button", 0);
  assert.match(await razred(".mk-manjka__vrsta button", 0), /je-dodano/, "P15: ponovni tap ga vrne");

  // P24: stikalo — preklopi in preimenuje aria
  const stikaloPred = await razred(".mk-stikalo__gumb");
  await klik(".mk-stikalo__gumb");
  const stikaloPo = await razred(".mk-stikalo__gumb");
  assert.notEqual(stikaloPred, stikaloPo, "P24: stikalo se preklopi");
  assert.equal(await page.$eval(".mk-stikalo__gumb", (el) => el.getAttribute("aria-label")), "Opomnik izklopljen", "P24: aria pove stanje");

  // P26: ocene — tap na 5 izbere in zapiše povzetek
  await klik(".mk-ocene button", 4);
  assert.match(await razred(".mk-ocene button", 4), /is-selected/, "P26: ocena 5 se izbere");
  assert.match(await zivec(".mk-ocene"), /5 od 5/, "P26: povzetek pove 5 od 5");

  // P27: pogostost — ena izbira s povzetkom
  await klik(".mk-pogostost button", 0);
  assert.match(await razred(".mk-pogostost button", 0), /is-selected/, "P27: Ves čas se izbere");
  assert.match(await zivec(".mk-pogostost"), /Ves čas/, "P27: povzetek odmeva izbiro");

  // P29: računi — Maj se doda, povzetek šteje vse 3
  await klik(".mk-racuni button", 2);
  assert.match(await razred(".mk-racuni button", 2), /je-ima/, "P29: Maj je zdaj v roki");
  assert.match(await zivec(".mk-racuni"), /vse 3/, "P29: povzetek šteje vse 3");

    // P32: pill-stikalo — Nisem obarva vrstico in prišteje ugovor
    await klik('.mk-racun-vrste__vrsta [data-sodba="nisem"]', 0);
    assert.match(await razred(".mk-racun-vrste__vrsta", 0), /je-sumljiva/, "P32: Nisem obarva vrstico sumljivo");
    await klik('.mk-racun-vrste__vrsta [data-sodba="sem"]', 0);
    assert.doesNotMatch(await razred(".mk-racun-vrste__vrsta", 0), /je-sumljiva/, "P32: Sem vrne vrstico med redne");

  // P51: oblaki so večizbira — dva nova tapa ne izklopita starih (prva skupina .mk-oblaki je P51)
  await page.evaluate(() => {
    const skupina = document.querySelectorAll(".mk-oblaki")[0];
    const b = skupina.querySelectorAll("button");
    [b[2], b[3]].forEach((el) => {
      el.scrollIntoView({ block: "center" });
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  });
  assert.equal(await page.$eval(".mk-oblaki", (skupina) => skupina.querySelectorAll("button.is-selected").length), 5, "P51: večizbira obdrži vseh 5");

  // P37: števec zvestobe — + dvigne številko in povzetek
  await klik(".mk-leta button", 1);
  assert.equal(await page.$eval(".mk-leta output b", (el) => el.textContent), "7", "P37: števec gre na 7");
  assert.match(await zivec(".mk-leta"), /7 let/, "P37: povzetek gre z njim");

  // P19: odsek traku pokaže podrobnosti, ponovni tap povrne vsoto
  await page.evaluate(() => {
    const sklad = document.querySelector(".mk-sklad");
    sklad.scrollIntoView({ block: "center" });
    sklad.querySelectorAll(".mk-sklad__bar i")[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.match(await zivec(".mk-sklad"), /Mesečna naročnina.*490/, "P19: odsek pokaže naročnino");
  await page.evaluate(() => {
    document.querySelectorAll(".mk-sklad__legenda span")[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.match(await zivec(".mk-sklad"), /Vodenje oglasov.*380/, "P19: legenda preklopi na oglase");
  await page.evaluate(() => {
    document.querySelectorAll(".mk-sklad__legenda span")[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.match(await zivec(".mk-sklad"), /Skupaj/, "P19: ponovni tap povrne vsoto");

  // P55: puščica dol zamenja prvi dve, gor na vrhu je onemogočena, tap nese na vrh
  await page.evaluate(() => {
    const rang = document.querySelector("[data-rang]");
    rang.scrollIntoView({ block: "center" });
    rang.querySelectorAll('[data-rang-vrsta="cena"] [data-rang-smer="dol"]')[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.match(await page.$eval("[data-rang-live]", (el) => el.textContent), /odziv → cena → računi/, "P55: dol zamenja vrstici");
  assert.equal(await page.evaluate(() => document.querySelector('[data-rang-vrsta="odziv"] [data-rang-smer="gor"]').disabled), true, "P55: gor na vrhu je onemogočena");
  await page.evaluate(() => {
    document.querySelector('[data-rang-vrsta="računi"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.match(await page.$eval("[data-rang-live]", (el) => el.textContent), /računi → odziv → cena/, "P55: tap nese na vrh");
  assert.deepEqual(await page.evaluate(() => ["cena", "odziv", "računi"].map((k) => getComputedStyle(document.querySelector('[data-rang-vrsta="' + k + '"] i')).backgroundColor)), ["rgb(41, 163, 162)", "rgb(41, 163, 162)", "rgb(41, 163, 162)"], "P55: številke so privzeto turkizne");
  assert.deepEqual(await page.evaluate(() => ["cena", "odziv", "računi"].map((k) => getComputedStyle(document.querySelector('[data-rang-vrsta="' + k + '"] .mk-rang__tag')).backgroundColor)), ["rgb(63, 153, 152)", "rgb(91, 141, 239)", "rgb(217, 123, 46)"], "P55: naslovi so v fiksnih barvnih mehurčkih");
  assert.equal(await page.evaluate(() => document.querySelector('[data-rang-vrsta="računi"] i').textContent), "1", "P55: številka sledi mestu");

  // P73: zgoraj ni številk (višina je ocena), cena ostane v povzetku in aria-labelu
  assert.equal(await page.$$eval("[data-stolpci] .mk-stolpec__cena", (els) => els.length), 0, "P73: ni zgornjih številk");
  assert.match(await page.$eval("[data-stolpci-live]", (el) => el.textContent), /Stabilni paket/, "P73: povzetek pove izbrano ponudbo");

  // P4: paketi odmevajo (izrecno dovoljeno), P22/P7 ročni povzetki ostanejo
  await klik(".mk-paket", 2);
  assert.match(await zivec(".mk-paketi"), /Premium/, "P4: povzetek pove Premium");
  const p22Pred = await zivec(".mk-cilj");
  await page.$$eval(".vrstica-kartica", (kartice) => {
    const p22 = kartice.find((k) => (k.querySelector("h2") || {}).textContent === "So vam povedali, da bo dražje?");
    p22.querySelectorAll(".mk-izbire button")[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.equal(await zivec(".mk-cilj"), p22Pred, "P22: ročni povzetek se ne prepiše z oznako gumba");

  // P5: vlečenje semaforja posodobi sodbo
  await page.evaluate(() => {
    const trak = document.querySelector(".mk-semafor__trak");
    trak.scrollIntoView({ block: "center" });
    const r = trak.getBoundingClientRect();
    const x = r.left + r.width * 0.1;
    trak.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, pointerId: 7 }));
    trak.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, pointerId: 7 }));
    trak.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7 }));
  });
  assert.match(await zivec(".mk-semafor"), /poceni/, "P5: pin levo pomeni poceni");
  // P5/P6: pin ostane centriran tudi med juice-pok (translate + scale ga je metal dol/desno)
  const odmik = await page.evaluate(async () => {
    const pin = document.querySelector(".mk-semafor__trak > i");
    const trak = document.querySelector(".mk-semafor__trak");
    pin.scrollIntoView({ block: "center" });
    pin.classList.remove("juice-pok"); void pin.offsetWidth; pin.classList.add("juice-pok");
    await new Promise((r) => setTimeout(r, 120));
    const r = trak.getBoundingClientRect(), p = pin.getBoundingClientRect();
    return Math.abs((p.top + p.bottom) / 2 - (r.top + r.bottom) / 2);
  });
  assert.ok(odmik < 3, "P5: pin ostane navpično centriran med pokom (odmik " + odmik + "px)");
  assert.equal(await page.evaluate(() => {
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules) {
        if ((r.selectorText === ".mk-semafor__trak > i" || r.selectorText === ".mk-dvojni__trak i") && /translate\(-50%/.test(r.style.transform)) return true;
      }
    }
    return false;
  }), false, "P5/P6/P8: pini se ne centrirajo s transform");

  // P10: ton se izbere s kratko oznako (ne zlepljeno s podnapisom)
  await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("Izberite nastop") >= 0);
    kartica.scrollIntoView({ block: "center" });
    kartica.querySelectorAll(".mk-ton button")[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.match(await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("Izberite nastop") >= 0);
    return kartica.querySelector(".vrstica-primer p.mk-live").textContent;
  }), /Prijazno/, "P10: povzetek pove Prijazno");
  assert.equal(await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("Izberite nastop") >= 0);
    return kartica.querySelectorAll(".mk-ton button.is-selected").length;
  }), 1, "P10: izbran je natanko en nastop");

  // P12: par Popravi/Drži se preklopi (vizualno, brez povzetka)
  await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("Smo prav razumeli") >= 0);
    kartica.querySelectorAll(".mk-glas__akciji button")[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.match(await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("Smo prav razumeli") >= 0);
    const b = kartica.querySelectorAll(".mk-glas__akciji button");
    return b[0].className + "|" + b[1].className;
  }), /is-selected[^|]*\|je-prim$/, "P12: Popravi prevzame izbor");

  // P12: Popravi odpre urejanje, Shrani zapiše (urejanje je že odprto iz prejšnjega klika)
  assert.ok(await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("Smo prav razumeli") >= 0);
    if (!kartica.querySelector("[data-urediznesek]")) kartica.querySelectorAll(".mk-glas__akciji button")[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return !!kartica.querySelector("[data-urediznesek]");
  }), "P12: Popravi odpre vnose");
  await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("Smo prav razumeli") >= 0);
    kartica.querySelector("[data-urediznesek]").value = "400";
    kartica.querySelectorAll(".mk-glas__akciji button")[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.match(await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("Smo prav razumeli") >= 0);
    return kartica.querySelectorAll(".mk-pogodba__vrsta")[1].querySelector("b").textContent;
  }), /400/, "P12: Shrani zapiše 400");
  assert.equal(await page.evaluate(() => !!document.querySelector("[data-potrdi] [data-urediznesek]")), false, "P12: urejanje se zapre");

  // P53: NPS deluje tudi po drsenju mini-sliderjev (regresija gnezdenja)
  await page.evaluate(() => {
    const mini = document.querySelector("[data-mini] input");
    mini.value = "5";
    mini.dispatchEvent(new Event("input", { bubbles: true }));
    mini.value = "1";
    mini.dispatchEvent(new Event("input", { bubbles: true }));
    const nps = document.querySelector("[data-nps] input");
    nps.value = "2";
    nps.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await page.$eval("[data-npsstevilka]", (el) => el.textContent), "2", "P53: NPS pokaže 2");

  // P42: tipkovnica — Enter na 5. zvezdici
  await page.evaluate(() => {
    const g = document.querySelectorAll("[data-zvezde] [data-v]")[4];
    g.focus();
    g.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  assert.match(await page.$eval("[data-zvezde-live]", (el) => el.textContent), /5 od 5/, "P42: Enter izbere 5");

  // P58: vlečenje ohrani data-zaupanje-izbira
  await page.evaluate(() => {
    const tir = document.querySelector("[data-zaupanje-tir]");
    tir.scrollIntoView({ block: "center" });
    const r = tir.getBoundingClientRect();
    tir.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: r.left + r.width * 0.9, pointerId: 9 }));
    tir.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: r.left + r.width * 0.9, pointerId: 9 }));
    tir.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 9 }));
  });
  assert.ok(await page.$("[data-zaupanje-izbira]"), "P58: izbira preživi vlečenje");

  // P66: sam tap pike ne skoči z vrednostjo
  const mehurPred = await page.$eval("[data-krivulja-mehur]", (el) => el.textContent);
  await page.evaluate(() => {
    const g = document.querySelectorAll("[data-krivulja-pika]")[5];
    const r = g.getBoundingClientRect();
    const o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 + 40, pointerId: 11 };
    g.dispatchEvent(new PointerEvent("pointerdown", o));
    g.dispatchEvent(new PointerEvent("pointerup", o));
  });
  assert.equal(await page.$eval("[data-krivulja-mehur]", (el) => el.textContent), mehurPred, "P66: tap brez potega ne spremeni vrednosti");

  // P9: krogci časovnice se izberejo, kljukice vodijo naprej
  const p9live = () => page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("do kdaj ste varni") >= 0);
    return kartica.querySelector(".vrstica-primer p.mk-live").textContent;
  });
  await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("do kdaj ste varni") >= 0);
    kartica.scrollIntoView({ block: "center" });
    kartica.querySelectorAll(".mk-casovnica > div")[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.match(await p9live(), /Še pride:.*Konec vezave/, "P9: tretji krogec se izbere in pove");
  await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("do kdaj ste varni") >= 0);
    kartica.querySelectorAll(".mk-check button").forEach((el) => {
      if (!el.classList.contains("je-opravljeno")) el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  });
  assert.match(await p9live(), /lahko greste naprej/, "P9: vse kljukice vodijo naprej");
  assert.equal(await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("do kdaj ste varni") >= 0);
    return kartica.querySelector("[data-casovnica-naprej]").hidden;
  }), false, "P9: gumb Naprej se pokaže");
  const drsenjePred = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("do kdaj ste varni") >= 0);
    kartica.querySelector("[data-casovnica-naprej]").dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 700));
  assert.ok(await page.evaluate(() => window.scrollY) > drsenjePred, "P9: Naprej odpelje na naslednjo kartico");
  await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("do kdaj ste varni") >= 0);
    kartica.querySelectorAll(".mk-check button")[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.doesNotMatch(await p9live(), /lahko greste naprej/, "P9: odvzeta kljukica umakne naprej");

  // P49: ista časovnica, ista logika
  await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("ko kaj crkne") >= 0);
    kartica.querySelectorAll(".mk-casovnica > div")[3].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.match(await page.evaluate(() => {
    const kartica = Array.from(document.querySelectorAll(".vrstica-kartica")).find((k) => ((k.querySelector("h2") || {}).textContent || "").indexOf("ko kaj crkne") >= 0);
    return kartica.querySelector(".vrstica-primer p.mk-live").textContent;
  }), /Še pride:.*Še čakam/, "P49: krogec se izbere");

  // P83: časovnica-izbira — ena poteza, povzetek pove naslov
  await page.evaluate(() => {
    const gumbi = document.querySelectorAll("[data-casizbira] .mk-casizbira__vrsta");
    gumbi[1].scrollIntoView({ block: "center" });
    gumbi[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.equal(await page.$$eval("[data-casizbira] .mk-casizbira__vrsta.is-selected", (els) => els.length), 1, "P83: izbrana je natanko ena poteza");
  assert.match(await page.$eval("[data-casizbira-live]", (el) => el.textContent), /Cilj pogovora/, "P83: povzetek pove Cilj pogovora");

  // P84: 3 plasti (trenutno / vaš plan / z nami), Y-lestvica, premica pokaže vse 3
  assert.match(await page.$eval("[data-ph-mesecno]", (el) => el.textContent), /10\.600/, "P84: trenutno pokaže december");
  assert.match(await page.$eval("[data-ph-plan-vred]", (el) => el.textContent), /12\.200/, "P84: vaš plan pokaže december");
  assert.match(await page.$eval("[data-ph-znami-vred]", (el) => el.textContent), /13\.900/, "P84: z nami pokaže december");
  assert.match(await page.$eval("[data-ph-letno]", (el) => el.textContent), /96\.200/, "P84: letno je seštevek");
  assert.ok(await page.$$eval("[data-ph-os] span", (els) => els.length) >= 4, "P84: Y-lestvica denarja v višino");
  assert.ok(await page.$("[data-ph-vodilo]"), "P84: premična premica obstaja");
  assert.equal(await page.$$eval(".mk-prihodek__mehur", (els) => els.length), 0, "P84: brez oblačkov na grafu");
  assert.equal(await page.$("[data-ph-namig]"), null, "P84: lebdeči oblaček je odstranjen");
  assert.ok(await page.$("[data-ph-pika-trenutno]"), "P84: pika trenutno na krivulji");
  assert.ok(await page.$("[data-ph-pika-plan]"), "P84: pika plan na krivulji");
  assert.ok(await page.$("[data-ph-pika-znami]"), "P84: pika z nami na krivulji");
  await page.evaluate(() => {
    const gumbi = document.querySelectorAll("[data-ph-mesec]");
    gumbi[2].scrollIntoView({ block: "center" });
    gumbi[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  assert.match(await page.$eval("[data-ph-mesecno]", (el) => el.textContent), /7\.900/, "P84: oktober posodobi trenutni");
  assert.match(await page.$eval("[data-ph-plan-vred]", (el) => el.textContent), /9\.100/, "P84: oktober posodobi plan");
  assert.match(await page.$eval("[data-ph-znami-vred]", (el) => el.textContent), /10\.400/, "P84: oktober posodobi z nami");
  assert.match(await page.$eval("[data-prihodek-live]", (el) => el.textContent), /oktober/, "P84: povzetek pove oktober");
  // P85: lok pokaže 67,2 % + top 15 %, tap po segmentu spremeni vrednost
  await page.evaluate(() => {
    document.querySelector("[data-primerjava]").scrollIntoView({ block: "center" });
  });
  await page.waitForFunction(() => document.querySelector("[data-pv-odstotek]").textContent.includes("67,2"), { timeout: 8000 });
  assert.match(await page.$eval("[data-pv-znacka-besedilo]", (el) => el.textContent), /top 15/, "P85: značka pove top 15 %");
  assert.equal(await page.$$eval("[data-pv-seg]", (els) => els.length), 17, "P85: lok ima 17 ploščic");
  await page.evaluate(() => {
    const segi = document.querySelectorAll("[data-pv-seg]");
    segi[segi.length - 1].scrollIntoView({ block: "center" });
    segi[segi.length - 1].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => document.querySelector("[data-pv-odstotek]").textContent.includes("100,0"), { timeout: 8000 });
  assert.match(await page.$eval("[data-pv-znacka-besedilo]", (el) => el.textContent), /top 5/, "P85: značka gre na top 5 %");
  await page.waitForFunction(() => document.querySelector("[data-pv-racuni]").textContent.includes("1.940"), { timeout: 8000 });
  assert.match(await page.$eval("[data-pv-zbrano]", (el) => el.textContent), /31\.400/, "P85: zbrano sledi loku");
  // P85: pravi drsnik s prijemalom
  await page.evaluate(() => {
    const d = document.querySelector("[data-pv-range]");
    d.scrollIntoView({ block: "center" });
    d.value = "29.4";
    d.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector("[data-pv-odstotek]").textContent.includes("29,4"), { timeout: 8000 });
  assert.match(await page.$eval("[data-pv-znacka-besedilo]", (el) => el.textContent), /Pod povprečjem/, "P85: značka pade pod povprečje");
  await page.evaluate(() => {
    const lok = document.querySelector("[data-pv-lok]");
    lok.scrollIntoView({ block: "center" });
    const r = lok.getBoundingClientRect();
    lok.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.05, pointerId: 31 }));
    lok.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 31 }));
  });
  await page.waitForFunction(() => document.querySelector("[data-pv-odstotek]").textContent.includes("52,9"), { timeout: 8000 });
  assert.match(await page.$eval("[data-pv-znacka-besedilo]", (el) => el.textContent), /top 30/, "P85: značka sledi vlečenju");
  // P84: vlečenje premice po grafu premakne izbor (pointer na sredino = november)
  await page.evaluate(() => {
    const platno = document.querySelector("[data-ph-platno]");
    platno.scrollIntoView({ block: "center" });
    const r = platno.getBoundingClientRect();
    const x = r.left + r.width * 0.44;
    const y = r.top + r.height * 0.4;
    platno.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y, pointerId: 21 }));
    platno.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 21 }));
  });
  assert.match(await page.$eval("[data-prihodek-live]", (el) => el.textContent), /november/, "P84: premica se premakne na november");
  assert.match(await page.$eval("[data-ph-mesecno]", (el) => el.textContent), /9\.200/, "P84: premica pokaže november trenutni");

  // Izvorna regresija: NPS-init ni več ugnezden v mini-osveži
  const vir = fs.readFileSync(path.join(root, "NAZORJEVA-PREDLOGI-MOCKUP.html"), "utf8");
  assert.ok(vir.includes('osveziSkupek();\n    }\n    drsnik.addEventListener("input", osvezi);\n    osvezi();\n  });\n  document.querySelectorAll("[data-nps]")'), "vir: NPS-init je na vrhu, ne v mini-osveži");

  assert.deepEqual(napake, [], "brez JS-napak: " + JSON.stringify(napake));
  console.log("OK: NAZORJEVA-PREDLOGI-MOCKUP — vsi P-ji delujejo");
} finally {
  await browser.close();
}
