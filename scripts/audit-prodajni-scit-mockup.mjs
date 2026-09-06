"use strict";

import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const output = path.join(process.cwd(), "output", "playwright", "brez-avtomatike");
fs.mkdirSync(output, { recursive: true });
const pocakaj = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = await puppeteer.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

async function preveri(width, height) {
  const page = await browser.newPage();
  const napake = [];
  page.on("pageerror", (error) => napake.push("pageerror: " + error.message));
  page.on("console", (message) => { if (["error", "warning", "warn"].includes(message.type())) napake.push(message.type() + ": " + message.text()); });
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 500, hasTouch: width < 500 });
  await page.goto("http://127.0.0.1:8001/app/svetovalec-preverba.html?app-preview=1&prodajni-scit-audit=4", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForSelector("[data-hiter-klic]");
  await page.click("[data-hiter-klic]");
  await page.waitForSelector('html[data-prodajni-scit-ready="true"]');
  await pocakaj(400);
  napake.length = 0;

  const zacetek = await page.evaluate(() => ({
    url: location.href,
    storitve: document.querySelectorAll("[data-storitev]").length,
    kartice: document.querySelectorAll("[data-carovnik-kartica]").length,
    stariKartici: document.querySelectorAll(".scit-barvna").length,
    pilli: document.querySelectorAll("[data-carovnik-korak]").length,
    hiterKontakt: Boolean(document.querySelector("[data-hiter-kontakt]")),
    atenaVidna: !document.querySelector("[data-scit-atena-panel]").hidden,
    rocnoSkrito: document.querySelector("[data-scit-rocno-panel]").hidden,
    kontaktnaVrstica: Boolean(document.querySelector("[data-scit-atena-kontakt]")),
    atenaKontrole: document.querySelectorAll(".scit-atena__akcije button").length,
    atenaVisina: Math.round(document.querySelector("[data-scit-atena-panel]").getBoundingClientRect().height),
    atenaPolozaj: getComputedStyle(document.querySelector("[data-scit-atena-panel]")).position,
    atenaOdDna: Math.round(innerHeight - document.querySelector("[data-scit-atena-panel]").getBoundingClientRect().bottom),
    visinaKartice: Math.round(document.querySelector("[data-carovnik-kartica]").getBoundingClientRect().height),
    oddajStevec: document.querySelector("[data-oddaj-stevec]").textContent.trim(),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    frameLeft: Math.round(document.querySelector(".prodajni-scit__okvir").getBoundingClientRect().left),
    frameRight: Math.round(document.documentElement.clientWidth - document.querySelector(".prodajni-scit__okvir").getBoundingClientRect().right)
  }));
  await page.screenshot({ path: path.join(output, `prodajni-scit-referenca-${width}x${height}.png`), fullPage: true });
  await page.screenshot({ path: path.join(output, `prodajni-scit-atena-${width}x${height}.png`), fullPage: true });

  const storitveniVmesniki = [];
  const pricakovaniNaslovi = {
    zascita: "Zaščita pred klici",
    povratni: "Povratni klic",
    ponudba: "Pridobi ponudbo",
    ustavi: "Ustavi klice",
    preveri: "Preveri in oceni",
    ukrepaj: "Ukrepaj naprej"
  };
  for (const [tip, pricakovaniNaslov] of Object.entries(pricakovaniNaslovi)) {
    await page.click(`[data-storitev="${tip}"]`);
    await pocakaj(450);
    const stanjeStoritev = await page.evaluate(() => ({
      naslov: document.querySelector("[data-storitev-naslov]").textContent.trim(),
      brezPodvojenegaKontakta: !document.querySelector("[data-storitev-kontakt], [data-storitev-opomba]"),
      moznosti: document.querySelectorAll("[data-storitev-vrednost]").length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      popupPresega: document.querySelector(".storitev-popup__list").getBoundingClientRect().height > innerHeight - 30
    }));
    await page.click("[data-storitev-vrednost]");
    stanjeStoritev.izbrano = await page.$$eval('[data-storitev-vrednost][aria-pressed="true"]', (gumbi) => gumbi.length);
    await page.screenshot({ path: path.join(output, `prodajni-scit-storitev-${tip}-${width}x${height}.png`), fullPage: true });
    await page.click("[data-storitev-oddaj]");
    const oddano = await page.evaluate(() => ({
      zaprto: document.querySelector("[data-storitev-popup]").hidden,
      potrdilo: document.querySelector("[data-toast]").textContent.trim()
    }));
    storitveniVmesniki.push({ tip, pricakovaniNaslov, ...stanjeStoritev, oddano });
  }

  await page.$eval("[data-odpri-porocilo]", (gumb) => gumb.click());
  await pocakaj(250);
  const porocilo = await page.evaluate(() => ({
    odprto: !document.querySelector("[data-primer-popup]").hidden,
    zaslon: document.querySelector("[data-primer-popup]").dataset.zaslon,
    naslov: document.querySelector("[data-primer-naslov]").textContent.trim(),
    podatki: document.querySelectorAll(".porocilo-podatki > span").length,
    tveganja: document.querySelectorAll(".porocilo-blok--tveganja li").length,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    popupPresega: document.querySelector(".primer-popup__list").getBoundingClientRect().height > innerHeight - 30
  }));
  await page.screenshot({ path: path.join(output, `prodajni-scit-porocilo-${width}x${height}.png`), fullPage: true });

  await page.click("[data-iz-porocila-ukrep]");
  await page.click('[data-ukrep-vrednost="Preveri ponudbo"]');
  await page.type("[data-ukrep-opomba]", "Brez vezave.");
  const ukrep = await page.evaluate(() => ({
    zaslon: document.querySelector("[data-primer-popup]").dataset.zaslon,
    moznosti: document.querySelectorAll("[data-ukrep-vrednost]").length,
    izbrano: document.querySelectorAll('[data-ukrep-vrednost][aria-pressed="true"]').length,
    gumbOmogocen: !document.querySelector("[data-potrdi-ukrep]").disabled
  }));
  await page.screenshot({ path: path.join(output, `prodajni-scit-naslednji-korak-${width}x${height}.png`), fullPage: true });
  await page.click("[data-potrdi-ukrep]");
  const potrditev = await page.evaluate(() => ({
    zaslon: document.querySelector("[data-primer-popup]").dataset.zaslon,
    ukrep: document.querySelector("[data-ukrep-povzetek]").textContent.trim(),
    opomba: document.querySelector("[data-ukrep-povzetek-opomba]").textContent.trim()
  }));
  await page.screenshot({ path: path.join(output, `prodajni-scit-potrditev-ukrepa-${width}x${height}.png`), fullPage: true });
  await page.click("[data-dokoncno-potrdi]");
  const izvedba = await page.evaluate(() => ({
    popupZaprt: document.querySelector("[data-primer-popup]").hidden,
    status: document.querySelector("[data-glavni-status]").textContent.trim(),
    korakIzvedbeAktiven: document.querySelectorAll(".klic-status span")[3].classList.contains("je-aktivno")
  }));

  await page.click('[data-primer-filter="zakljuceni"]');
  const primeri = await page.evaluate(() => ({
    zakljuceniVidni: !document.querySelector('[data-primer-seznam="zakljuceni"]').hidden,
    aktivniSkriti: document.querySelector('[data-primer-seznam="aktivni"]').hidden,
    stevec: document.querySelector("[data-primeri-stevec]").textContent.trim(),
    zakljuceni: document.querySelectorAll('[data-primer-seznam="zakljuceni"] .primer-vrstica').length
  }));
  await page.click('[data-primer-filter="aktivni"]');

  await page.click("[data-scit-atena-poizveduj]");
  const kontaktOpozorilo = await page.$eval("[data-toast]", (element) => element.textContent.trim());
  await page.type("[data-scit-atena-kontakt]", "prodaja@telekom-primer.si");
  await page.click("[data-scit-atena-poizveduj]");
  const navodiloOpozorilo = await page.$eval("[data-toast]", (element) => element.textContent.trim());
  await page.type("[data-scit-atena-opis]", "Po e-pošti mi je poslal ponudbo za marketing. Preverite ponudbo in skrite stroške.");
  await page.click("[data-scit-atena-poizveduj]");
  await pocakaj(250);
  const atena = await page.evaluate(() => ({
    atenaVidna: !document.querySelector("[data-scit-atena-panel]").hidden,
    rocnoVidno: !document.querySelector("[data-scit-rocno-panel]").hidden,
    kontaktVnos: document.querySelector("[data-scit-atena-kontakt]").value,
    kontakt: document.querySelector("[data-carovnik-lastno]")?.value || "",
    izpolnjeniPilli: document.querySelectorAll("[data-carovnik-korak].je-izpolnjen").length,
    stevec: document.querySelector("[data-oddaj-stevec]").textContent.trim()
  }));
  await page.screenshot({ path: path.join(output, `prodajni-scit-rocno-po-ateni-${width}x${height}.png`), fullPage: true });
  await page.click('[data-carovnik-korak="1"]');
  await page.click('[data-carovnik-korak="0"]');
  const prviKorak = await page.evaluate(() => ({
    naslov: document.querySelector("[data-carovnik-naslov]").textContent.trim(),
    aktiven: document.querySelector('[data-carovnik-korak="0"]').classList.contains("je-aktiven"),
    kontakt: document.querySelector("[data-carovnik-lastno]")?.value || ""
  }));
  await page.screenshot({ path: path.join(output, `prodajni-scit-prvi-korak-${width}x${height}.png`), fullPage: true });
  await page.click('[data-carovnik-korak="1"]');
  const carovnikZacetek = await page.evaluate(() => ({
    naslov: document.querySelector("[data-carovnik-naslov]").textContent.trim(),
    pilli: document.querySelectorAll("[data-carovnik-korak]").length,
    kartice: document.querySelectorAll("[data-carovnik-kartica]").length,
    kontaktIzpolnjen: document.querySelector('[data-carovnik-korak="0"]').classList.contains("je-izpolnjen"),
    visinaKartice: Math.round(document.querySelector("[data-carovnik-kartica]").getBoundingClientRect().height),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
  await page.$eval('[data-carovnik-vrednost="telefon"]', (gumb) => gumb.click());
  const predPotegom = await page.evaluate(() => ({
    naslov: document.querySelector("[data-carovnik-naslov]").textContent.trim(),
    izbrano: document.querySelector('[data-carovnik-vrednost="telefon"]')?.getAttribute("aria-pressed"),
    pillIzpolnjen: document.querySelector('[data-carovnik-korak="1"]').classList.contains("je-izpolnjen")
  }));
  if (predPotegom.izbrano !== "true" || !predPotegom.pillIzpolnjen) throw new Error("Korak pred potegom ni izpolnjen: " + JSON.stringify(predPotegom));
  await page.$eval("[data-carovnik-kartica]", (kartica) => kartica.scrollIntoView({ block: "center" }));
  await pocakaj(120);
  await page.$eval("[data-carovnik-kartica]", (kartica) => {
    kartica.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 260 }));
    kartica.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 150 }));
  });
  await page.waitForFunction(() => document.querySelector("[data-carovnik-naslov]").textContent.trim() === "Kaj naj naredimo?", { timeout: 1500 });
  const poPotegu = await page.evaluate(() => ({
    naslov: document.querySelector("[data-carovnik-naslov]").textContent.trim(),
    prenesenUkrep: document.querySelectorAll('[data-carovnik-vrednost][aria-pressed="true"]').length > 0
  }));
  await page.$eval("[data-carovnik-naprej]", (gumb) => gumb.click());
  await page.waitForFunction(() => document.querySelector("[data-carovnik-naslov]").textContent.trim() === "Kaj vam ponuja?", { timeout: 1500 });
  await page.$eval('[data-carovnik-vrednost="telekom"]', (gumb) => gumb.click());
  await page.$eval('[data-carovnik-korak="4"]', (gumb) => gumb.click());
  await page.waitForFunction(() => document.querySelector("[data-carovnik-naslov]").textContent.trim() === "Kaj naj upoštevamo?", { timeout: 1500 });
  await page.$eval('[data-carovnik-vrednost="stroski"]', (gumb) => gumb.click());
  await page.$eval('[data-carovnik-korak="5"]', (gumb) => gumb.click());
  await page.waitForFunction(() => document.querySelector("[data-carovnik-naslov]").textContent.trim() === "Še kaj pomembnega?", { timeout: 1500 });
  await page.type("[data-carovnik-lastno]", "Pokličite po 15. uri.");
  const carovnik = { atena: { ...atena, kontaktOpozorilo, navodiloOpozorilo }, prviKorak, zacetek: carovnikZacetek, poPotegu };
  await page.screenshot({ path: path.join(output, `prodajni-scit-carovnik-${width}x${height}.png`), fullPage: true });
  const pripravljenGumb = await page.evaluate(() => ({
    stevec: document.querySelector("[data-oddaj-stevec]").textContent.trim(),
    omogocen: !document.querySelector("[data-oddaj]").disabled
  }));
  await page.evaluate(() => { document.querySelector("[data-toast]").hidden = true; });
  if (width === 390) await page.screenshot({ path: path.join(output, `prodajni-scit-gumb-pripravljen-${width}x${height}.png`), fullPage: true });
  await page.$eval("[data-oddaj]", (gumb) => gumb.click());
  await page.waitForSelector(".scit-uspeh");
  const konec = await page.evaluate(() => ({
    naslov: document.querySelector(".scit-uspeh h2").textContent.trim(),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
  await page.close();
  return { viewport: `${width}x${height}`, zacetek, storitveniVmesniki, porocilo, ukrep, potrditev, izvedba, primeri, carovnik, pripravljenGumb, konec, napake };
}

try {
  const rezultati = [await preveri(390, 844), await preveri(980, 900)];
  for (const rezultat of rezultati) {
    if (!rezultat.zacetek.url.endsWith("/app/prodajni-scit-mockup.html")) throw new Error("Vstopna kartica ni odprla mockupa.");
    if (rezultat.zacetek.storitve !== 6) throw new Error("Mreža storitev 3 × 2 ni popolna: " + JSON.stringify(rezultat));
    if (rezultat.carovnik.prviKorak.naslov !== "Kdo vas kontaktira?" || !rezultat.carovnik.prviKorak.aktiven || rezultat.carovnik.prviKorak.kontakt !== "prodaja@telekom-primer.si") throw new Error("Prvi korak se ne odpre ali ni povezan s kontaktnim poljem: " + JSON.stringify(rezultat));
    if (!rezultat.porocilo.odprto || rezultat.porocilo.zaslon !== "porocilo" || rezultat.porocilo.podatki !== 4 || rezultat.porocilo.tveganja !== 3 || rezultat.porocilo.overflow || rezultat.porocilo.popupPresega) throw new Error("Podrobno poročilo ni pravilno: " + JSON.stringify(rezultat));
    if (rezultat.ukrep.zaslon !== "ukrep" || rezultat.ukrep.moznosti !== 6 || rezultat.ukrep.izbrano !== 1 || !rezultat.ukrep.gumbOmogocen) throw new Error("Izbira ukrepa ni pravilna: " + JSON.stringify(rezultat));
    if (rezultat.potrditev.zaslon !== "potrditev" || rezultat.potrditev.ukrep !== "Preveri ponudbo" || rezultat.potrditev.opomba !== "Brez vezave.") throw new Error("Končna potrditev ni pravilna: " + JSON.stringify(rezultat));
    if (!rezultat.izvedba.popupZaprt || rezultat.izvedba.status !== "Ukrep v pripravi" || !rezultat.izvedba.korakIzvedbeAktiven) throw new Error("Status izvedbe se ni posodobil: " + JSON.stringify(rezultat));
    if (!rezultat.primeri.zakljuceniVidni || !rezultat.primeri.aktivniSkriti || rezultat.primeri.stevec !== "2 zaključena" || rezultat.primeri.zakljuceni !== 2) throw new Error("Pregled primerov ni pravilen: " + JSON.stringify(rezultat));
    if (rezultat.zacetek.oddajStevec !== "0/5" || rezultat.pripravljenGumb.stevec !== "5/5" || !rezultat.pripravljenGumb.omogocen) throw new Error("Napredek zaključnega gumba ni pravilen: " + JSON.stringify(rezultat));
    if (!rezultat.storitveniVmesniki.every((vmesnik) => vmesnik.naslov === vmesnik.pricakovaniNaslov && vmesnik.brezPodvojenegaKontakta && vmesnik.moznosti === 4 && vmesnik.izbrano === 1 && !vmesnik.overflow && !vmesnik.popupPresega && vmesnik.oddano.zaprto && vmesnik.oddano.potrdilo.includes("izbira je shranjena"))) throw new Error("Vmesnik storitve ni pravilen: " + JSON.stringify(rezultat));
    if (!rezultat.zacetek.atenaVidna || rezultat.zacetek.rocnoSkrito || !rezultat.zacetek.kontaktnaVrstica || rezultat.zacetek.atenaKontrole !== 4 || rezultat.zacetek.atenaVisina < 180 || rezultat.zacetek.atenaPolozaj !== "fixed" || rezultat.zacetek.atenaOdDna < 40 || rezultat.zacetek.atenaOdDna > 50) throw new Error("Atenin spodnji widget ni pravilno prikazan: " + JSON.stringify(rezultat));
    if (!rezultat.carovnik.atena.atenaVidna || !rezultat.carovnik.atena.rocnoVidno || rezultat.carovnik.atena.kontaktVnos !== "prodaja@telekom-primer.si" || rezultat.carovnik.atena.kontakt !== "prodaja@telekom-primer.si" || rezultat.carovnik.atena.izpolnjeniPilli < 5 || rezultat.carovnik.atena.stevec !== "5/5" || !rezultat.carovnik.atena.kontaktOpozorilo.includes("Najprej vnesite kontakt") || !rezultat.carovnik.atena.navodiloOpozorilo.includes("Zdaj napišite vprašanje")) throw new Error("Atena ni zahtevala kontakta ali predizpolnila ročnega pregleda: " + JSON.stringify(rezultat));
    if (rezultat.zacetek.kartice !== 1 || rezultat.zacetek.stariKartici !== 0 || rezultat.zacetek.pilli !== 6 || rezultat.zacetek.hiterKontakt || rezultat.zacetek.visinaKartice < 250 || rezultat.carovnik.zacetek.visinaKartice < 250) throw new Error("Enokartični tok ni pravilno sestavljen ali zgornji kontaktni blok še obstaja: " + JSON.stringify(rezultat));
    if (rezultat.zacetek.scrollWidth !== rezultat.zacetek.clientWidth || Math.abs(rezultat.zacetek.frameLeft - rezultat.zacetek.frameRight) > 1) throw new Error("Postavitev ni pravilna: " + JSON.stringify(rezultat));
    if (rezultat.carovnik.zacetek.naslov !== "Kaj se je zgodilo?" || rezultat.carovnik.zacetek.pilli !== 6 || rezultat.carovnik.zacetek.kartice !== 1 || !rezultat.carovnik.zacetek.kontaktIzpolnjen || rezultat.carovnik.zacetek.overflow || rezultat.carovnik.poPotegu.naslov !== "Kaj naj naredimo?" || !rezultat.carovnik.poPotegu.prenesenUkrep) throw new Error("Hitri kontakt, swipe ali prenos storitve v čarovnik ni pravilen: " + JSON.stringify(rezultat));
    if (rezultat.konec.naslov !== "Prodajalca smo prevzeli." || rezultat.konec.overflow || rezultat.napake.length) throw new Error("Zaključek ni pravilen: " + JSON.stringify(rezultat));
  }
  console.log(JSON.stringify({ ok: true, rezultati }, null, 2));
} finally {
  await browser.close();
}
