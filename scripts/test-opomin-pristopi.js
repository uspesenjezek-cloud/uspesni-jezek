const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const N = require(path.join(root, "app", "opomin-nacrt.js"));
const ui = fs.readFileSync(path.join(root, "app", "opomin-nacrt-ui.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "styles.css"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "neplacila-posiljanje.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function novPlan() {
  return N.narediNovPlan(
    { imeDolznika: "Testni dolžnik", znesek: 4200, datumZapadlosti: "2026-01-01" },
    { toneRecommendation: "firm", sporociloDolzniku: "Test" }
  );
}

const osvezeniPodatki = { imeDolznika: "Testni dolžnik", znesek: 4200, datumZapadlosti: "2026-01-01" };
const istiPlan = N.uporabiPristopIzterjave(novPlan(), "uravnotezeno");
istiPlan.collectionApproachConfirmed = true;
N.uskladiZVhodi(istiPlan, osvezeniPodatki, { toneRecommendation: "firm", sporociloDolzniku: "Test" });
assert(istiPlan.collectionApproachConfirmed === true, "Osvežitev iste zadeve mora ohraniti potrjen pristop.");
N.uskladiZVhodi(istiPlan, { ...osvezeniPodatki, imeDolznika: "Drug dolžnik" }, { toneRecommendation: "firm", sporociloDolzniku: "Test" });
assert(istiPlan.collectionApproachConfirmed === false, "Nova zadeva mora ponovno zahtevati potrditev pristopa.");
assert(
  N.aktivniPristopIzterjave(istiPlan) === N.priporoceniPristopIzterjave(istiPlan),
  "Nova zadeva mora začeti s sveže priporočenim pristopom, ne s staro izbiro drugega dolžnika."
);

[
  ["postopno", 6],
  ["uravnotezeno", 5],
  ["odlocno", 4],
].forEach(([id, stevilo]) => {
  const plan = N.uporabiPristopIzterjave(novPlan(), id);
  const vkljuceni = plan.steps.filter((step) => !step.isExcluded);
  assert(vkljuceni.length === stevilo, `${id} mora imeti ${stevilo} vključenih korakov.`);
  assert(vkljuceni.at(-1).kind === "manual_lawyer", `${id} mora ohraniti predajo odvetniku kot zadnji korak.`);
  assert(N.aktivniPristopIzterjave(plan) === id, `${id} se mora shraniti kot aktivni pristop.`);
});

assert(N.priporoceniPristopIzterjave({ overdueDays: 12, amountCents: 90000 }) === "postopno", "Majhna sveža terjatev mora priporočiti postopen pristop.");
assert(N.priporoceniPristopIzterjave({ overdueDays: 45, amountCents: 300000 }) === "uravnotezeno", "Srednja terjatev mora priporočiti uravnotežen pristop.");
assert(N.priporoceniPristopIzterjave({ overdueDays: 120, amountCents: 800000 }) === "odlocno", "Visoko tveganje mora priporočiti odločen pristop.");

assert(html.includes('id="opomin-pristop-izbire"'), "Na strani manjka gostitelj treh pristopov.");
assert(html.includes('id="opomin-pristop-potrdi"'), "Na strani manjka izrecna potrditev izbranega pristopa.");
assert(html.includes("styles.css?v=20260831-pristop-widget-mobile-v18"), "CSS cache različica ni osvežena.");
assert(html.includes("opomin-nacrt-ui.js?v=20260831-pristop-widget-mobile-v13"), "UI cache različica ni osvežena.");
assert(html.includes("opomin-nacrt.js?v=20260830-pristop-collapse-v1"), "Podatkovni cache različica ni osvežena.");
assert(html.includes('id="opomin-pristop-razpri"'), "Mobilnemu widgetu manjka gumb Več informacij.");
assert(html.includes('id="opomin-pristop-krogi"'), "Mobilnemu widgetu manjkajo začetni krogi.");
assert(ui.includes('data-opomin-pristop="'), "UI ne izriše klikljivih pristopov.");
assert(ui.includes("pristopKarticeOdprte"), "UI mora ohranjati stanje razširjenih kartic.");
assert(ui.includes('class="opomin-pristop__krog'), "UI mora izrisati tri kroge iz istih pristopov kot kartice.");
assert(ui.includes("collectionApproachConfirmed = true"), "Potrditev pristopa se mora izrecno shraniti.");
assert(ui.includes("if (jeMiniGumb)"), "Klik mini gumba mora ponovno odpreti velike kartice.");
assert(/if \(jeMiniGumb\) \{\s*plan\.collectionApproachConfirmed = false;\s*\}/.test(ui), "Klik mini gumba mora izbiro razširiti v prvotne velike kartice.");
assert(ui.includes("opts.glavniEl.hidden = true"), "Podrobni načrt mora biti pred potrditvijo skrit.");
assert(css.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"), "Pristopi morajo ostati v treh enakih stolpcih.");
assert(css.includes(".opomin-pristop.is-collapsed"), "Po potrditvi se morajo pristopi skrčiti v kompaktne gumbe.");
assert(css.includes(".opomin-pristop__kartica::after"), "Obroba kartice mora biti pri spodnjem medaljonu optično prekinjena.");
assert(css.includes(".opomin-pristop.is-collapsed.is-expanded .opomin-pristop__izbire"), "Na telefonu morajo kartice zdrsniti izpod povzetka.");
assert(css.includes("@keyframes opomin-pristop-kartica-pade") && css.includes("--opomin-pristop-pot: 168px") && !css.includes("--opomin-pristop-pot: 158px") && css.includes("animation-delay: 70ms") && css.includes("animation-delay: 140ms"), "Kartice in njihovi krogi morajo po celotni izmerjeni poti potovati gladko in zaporedno tudi na ozkih telefonih.");
const animacijaPade = css.match(/@keyframes opomin-pristop-kartica-pade\s*\{(?:[^{}]|\{[^{}]*\})*\}/)?.[0] || "";
const animacijaPospravi = css.match(/@keyframes opomin-pristop-kartica-pospravi\s*\{(?:[^{}]|\{[^{}]*\})*\}/)?.[0] || "";
assert(animacijaPade && animacijaPospravi && !animacijaPade.includes("opacity:") && !animacijaPospravi.includes("opacity:"), "Kartice med odpiranjem ali zapiranjem ne smejo izginiti z bledenjem.");
assert(css.includes("@keyframes opomin-pristop-kartica-pospravi") && css.includes(".is-expanded.is-closing") && ui.includes("pristopKarticeSeZapirajo"), "Zapiranje mora uporabiti zrcalno zaporedno animacijo pred skrčenjem widgeta.");
assert(ui.includes("animirajPremikVsebinePristopa") && ui.includes('closest("main")') && ui.includes("pristopVsebinaPremikPx") && ui.includes("getBoundingClientRect().top"), "Zunanji vsebinski blok mora z izmerjenim FLIP premikom slediti karticam brez končnega skoka postavitve.");
assert(ui.includes("zapiralneAnimacije") && ui.includes("animacija.finished") && ui.includes("zakljuciZapiranjePristopa"), "Kompaktni krogi se smejo vrniti šele po dejanskem zaključku vseh zapiralnih animacij.");
assert(!ui.includes("pristopKarticeZapiranjeTimer") && !ui.includes("setTimeout(zakljuciZapiranjePristopa"), "Časovni fallback ne sme prekiniti zapiranja pred dejanskim zaključkom animacij.");
assert(css.includes(".is-expanded.is-closing .opomin-pristop__razpri svg") && css.includes("transform: rotate(0deg)"), "Puščica se mora obrniti navzdol že med zapiranjem, ne šele po zadnjem kadru.");
assert(css.includes("translateX(calc(-50% + 2.333333px))") && css.includes("translateX(calc(-50% - 2.333333px))"), "Zunanja medaljona morata končati na istih vodoravnih središčih kot kompaktna kroga.");
assert(/is-closing[\s\S]*?nth-child\(1\).*?140ms;[\s\S]*?nth-child\(2\).*?70ms;[\s\S]*?nth-child\(3\).*?0ms;/.test(css), "Zapiranje mora kartice pospraviti v obratnem vrstnem redu.");
assert(!css.includes("max-height 360ms") && !css.includes("margin-top 360ms"), "Razpiranje ne sme animirati postavitve in povzročati zatikanja.");
assert(/\.opomin-pristop\.is-collapsed \.opomin-pristop__kartica\.is-selected \{[\s\S]*?padding: 18px 7px 39px;[\s\S]*?border-width: 1px;/.test(css), "Izbrana sredinska kartica mora ostati navpično poravnana z ostalima.");
assert(css.includes("width: 84px") && css.includes("height: 84px"), "Krogi pred in po razširitvi morajo uporabljati isto mobilno velikost.");

console.log("PASS: trije pristopi pravilno prilagodijo načrt in ohranijo zadnjo predajo odvetniku.");
