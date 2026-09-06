const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app", "prodajni-scit-mockup.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "prodajni-scit-mockup.css"), "utf8");
const js = fs.readFileSync(path.join(root, "app", "prodajni-scit-mockup.js"), "utf8");
const host = fs.readFileSync(path.join(root, "app", "svetovalec-preverba.js"), "utf8");

["Prodajni ščit", "Kaj lahko uredimo?", "Dopolnite podatke", "Zadnji obravnavani klic", "Vaši prodajni primeri", "Brez vaše končne potrditve"].forEach((besedilo) => {
  if (!html.includes(besedilo)) throw new Error(`Manjka vsebina: ${besedilo}`);
});

["Kaj vam ponujajo", "Preverjanje prodajalca", "Na kaj pazite", "NAŠE PRIPOROČILO", "Preveri ponudbo", "Primerjaj ponudbe", "Pogajaj se", "Pridobi druge ponudbe", "Zavrni ponudbo", "Ustavi klice", "KONČNA POTRDITEV"].forEach((besedilo) => {
  if (!(html + js).includes(besedilo)) throw new Error(`Manjka poročilo ali naslednji ukrep: ${besedilo}`);
});
if (!html.includes("data-primer-popup") || !html.includes("data-primer-filter") || !html.includes("data-dokoncno-potrdi") || !js.includes("prikaziPrimerZaslon") || !js.includes("ukrep je potrjen in v pripravi")) {
  throw new Error("Poročilo, primeri in potrditveni tok niso povezani.");
}
if ((html.match(/data-ukrep-vrednost=/g) || []).length !== 6 || (html.match(/data-primer-seznam=/g) || []).length !== 2) {
  throw new Error("Manjkajo nadaljnji ukrepi ali pregledi primerov.");
}
if (js.includes("naslednji del mockupa")) throw new Error("Gumba poročila sta še vedno placeholderja.");

["Zaščita", "Povratni", "Pridobi", "Ustavi", "Preveri", "Ukrepaj"].forEach((besedilo) => {
  if (!html.includes(besedilo)) throw new Error(`Manjka storitev: ${besedilo}`);
});
if ((html.match(/data-storitev="/g) || []).length !== 6 || !html.includes("data-storitev-popup")) {
  throw new Error("Šest storitev ni povezanih z lastnim vmesnikom.");
}
if (!css.includes("grid-template-columns: repeat(3,minmax(0,1fr))") || !js.includes("const storitve =") || !js.includes("odpriStoritev")) {
  throw new Error("Mreža 3 × 2 ali vmesniki posameznih storitev niso pripravljeni.");
}
if (js.includes("data-storitev-kontakt") || js.includes("data-storitev-opomba") || !js.includes('storitevOddaj.textContent = "Potrdi izbiro"') || !css.includes('button[aria-pressed="true"]::before')) {
  throw new Error("Zgornje storitve morajo vsebovati samo izbiro možnosti s kljukicami.");
}
if ((html + js + css).includes("Vse preverite samodejno") || (html + js + css).includes("data-avtomatika") || js.includes("prodajniScitSamodejnoV1")) {
  throw new Error("Odstranjeni blok za samodejno preverjanje je še vedno prisoten.");
}

[
  "Kdo vas kontaktira?",
  "Kaj se je zgodilo?",
  "Kaj naj naredimo?",
  "Kaj vam ponuja?",
  "Kaj naj upoštevamo?",
  "ALI NAPIŠITE SVOJ ODGOVOR",
  "Predaj prodajalca"
].forEach((besedilo) => {
  if (!(html + js).includes(besedilo)) throw new Error(`Manjka korak: ${besedilo}`);
});

if ((html + js + css).includes("data-hiter-kontakt") || (html + js + css).includes("scit-hiter-kontakt") || !js.includes("let trenutniKorak = 0")) {
  throw new Error("Odstranjeni zgornji kontaktni blok je še vedno prisoten ali vprašalnik ne začne s prvim korakom.");
}
if (!html.includes("data-carovnik-kartica") || !html.includes("data-carovnik-pilli") || !html.includes("data-carovnik-naprej") || !js.includes("premakniCarovnik") || !js.includes('addEventListener("pointerup"')) {
  throw new Error("Enotni vprašalnik nima korakov, gumbov ali swipe upravljanja.");
}
if (!js.includes('trenutniKorak = indeks') || !js.includes('Math.max(0, Math.min') || !js.includes('data-carovnik-brez') || !js.includes('if (tip === "kontakt")')) {
  throw new Error("Prvi indikator ne odpre dejanskega kontaktnega koraka v čarovniku.");
}
if (!html.includes("data-oddaj-stevec") || !html.includes("0/5") || !css.includes("--scit-izpolnjeno") || !js.includes("izpolnjeni + \"/\" + obvezni.length")) {
  throw new Error("Zaključni gumb ne prikazuje živega napredka obveznih korakov.");
}
if ((html + css + js).includes("prednastavit")) {
  throw new Error("Odstranjeni vmesnik prednastavitev je še vedno prisoten.");
}
if ((html.match(/data-scit-nacin=/g) || []).length || !html.includes("data-scit-atena-panel") || !html.includes("data-scit-rocno-panel")) {
  throw new Error("Atena mora biti spodnji widget, ročni koraki pa stalno vidni brez zavihkov.");
}
if (!html.includes("uporabite Ateno spodaj") || !html.includes("data-scit-atena-kontakt") || !html.includes("data-scit-atena-opis") || !html.includes("data-scit-atena-poizveduj")) {
  throw new Error("Spodnji Atenin hitri vnos ni pravilno sestavljen.");
}
if ((html.match(/data-scit-atena-(?:glas|kamera|uvoz|poizveduj)(?:\s|=|>)/g) || []).length !== 4 || !html.includes("Poizveduj")) {
  throw new Error("Atenina vrstica nima mikrofona, kamere, uvoza in gumba Poizveduj.");
}
if (!js.includes("razcleniAteninVnos") || !js.includes("Najprej vnesite kontakt prodajalca") || !js.includes("Zdaj napišite vprašanje ali navodilo") || !js.includes("rocnoPanel.scrollIntoView") || !js.includes("Atena je izpolnila podatke")) {
  throw new Error("Atenin spodnji vnos ni povezan z ročnim pregledom korakov.");
}
if (!css.includes(".scit-atena-dock") || !css.includes(".scit-atena__kontakt") || !css.includes("position:fixed") || !css.includes("bottom:calc(42px") || !css.includes("rgba(223,174,84,.72)") || !css.includes("minmax(112px,1.42fr)")) {
  throw new Error("Atenin kompozitor ni poenoten z obstoječim slogom aplikacije.");
}
if (!css.includes("grid-template-columns: repeat(6,minmax(0,1fr))") || !css.includes(".scit-carovnik__kartica[data-tip=\"ukrepi\"]") || !css.includes("scit-carovnik-levo")) {
  throw new Error("Manjka barvni enokartični čarovnik z napredkom in animacijo.");
}
if (!js.includes("storitevVUkrep") || !js.includes("stanje.ukrepi = stanje.ukrepi.concat(ukrep)")) {
  throw new Error("Izbira zgornje storitve se ne prenese v korak Kaj naj naredimo.");
}
if (!css.includes("width: min(100%, 470px)") || !css.includes("font-size: 16px")) {
  throw new Error("Manjka mobilna omejitev ali zaščita pred iPhone input zoomom.");
}
if (!host.includes("prodajni-scit-mockup.html")) throw new Error("Vstopna kartica ne odpira mockupa.");

console.log("Prodajni ščit: kontaktni prvi korak, enokartični čarovnik, swipe in storitve so povezani.");
