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
assert(istiPlan.collectionApproachConfirmed === true, "Nova zadeva ne sme več odpreti stare potrditve pristopa.");
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
assert(!html.includes('id="opomin-pristop-potrdi"'), "Stari gumb Potrdi izbiro se ne sme več izrisati.");
assert(html.includes("styles.css?v=20260902-pristop-zaporedno-odpiranje-v1"), "CSS cache različica ni osvežena.");
assert(html.includes("opomin-nacrt-ui.js?v=20260902-pristop-zaporedno-odpiranje-v1"), "UI cache različica ni osvežena.");
assert(html.includes("opomin-nacrt.js?v=20260901-pristop-brez-stare-potrditve-v1"), "Podatkovni cache različica ni osvežena.");
assert(html.includes('id="opomin-pristop-razpri"'), "Mobilnemu widgetu manjka gumb Več informacij.");
assert(html.includes('id="opomin-pristop-krogi"'), "Mobilnemu widgetu manjkajo začetni krogi.");
assert(/\.wizard-debt-summary:has\(\+ \.opomin-pristop\.is-collapsed\)\s*\{[^}]*width:\s*calc\(100% - 6px\);[^}]*margin-inline:\s*3px;/s.test(css), "Povzetek mora biti na telefonu minimalno ožji in centriran.");
assert(/\.opomin-pristop\.is-collapsed\s*\{[^}]*margin:\s*-1px 3px 52px;/s.test(css), "Spodnji del widgeta mora slediti isti ožji širini.");
const indeksNaslova = ui.indexOf('<p class="opomin-nacrt__napredek-tekst">Koraki načrta</p>');
const indeksPik = ui.indexOf('opomin-nacrt__pike--v-premici');
const indeksKartic = ui.indexOf('class="opomin-nacrt__carousel-ovoj"');
assert(indeksNaslova >= 0 && indeksNaslova < indeksPik && indeksPik < indeksKartic, "Krogci morajo biti v ločilni premici ob naslovu Koraki načrta.");
assert(!ui.includes('opomin-nacrt__pike--pod-karticami'), "Pod karticami ne sme ostati dodatna vrstica krogcev.");
assert(/\.opomin-nacrt__napredek-locilo\s*\{[^}]*grid-template-columns:\s*minmax\(12px, 1fr\) auto minmax\(12px, 1fr\);/s.test(css), "Ločilna premica mora krogce držati med dvema črtama.");
assert(/\.opomin-nacrt__pike--v-premici\s*\{[^}]*justify-content:\s*center;/s.test(css), "Krogci v premici morajo biti sredinsko poravnani.");
assert(ui.includes('data-opomin-pristop="'), "UI ne izriše klikljivih pristopov.");
assert(ui.includes("pristopKarticeOdprte"), "UI mora ohranjati stanje razširjenih kartic.");
assert(ui.includes('class="opomin-pristop__krog'), "UI mora izrisati tri kroge iz istih pristopov kot kartice.");
assert(ui.includes("collectionApproachConfirmed = true"), "Izbira pristopa se mora neposredno shraniti.");
assert(!ui.includes("collectionApproachConfirmed = false"), "Klik pristopa ne sme več obuditi stare potrditvene različice.");
assert(!html.includes("Kako želite postopati?") && !html.includes("Potrdi izbiro"), "Stari naslov in potrditveni gumb morata biti odstranjena.");
assert(!ui.includes('if (!jePristopPotrjen()) {\n        opts.glavniEl.innerHTML = "";'), "Celoten načrt ne sme biti pred potrditvijo pristopa izpraznjen.");
assert(ui.includes("opts.glavniEl.hidden = false"), "Celoten 4. korak mora biti viden že med izbiro pristopa.");
assert(css.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"), "Pristopi morajo ostati v treh enakih stolpcih.");
assert(css.includes(".opomin-pristop.is-collapsed"), "Po potrditvi se morajo pristopi skrčiti v kompaktne gumbe.");
assert(css.includes(".opomin-pristop__kartica::after"), "Obroba kartice mora biti pri spodnjem medaljonu optično prekinjena.");
assert(css.includes(".opomin-pristop.is-collapsed.is-expanded .opomin-pristop__izbire"), "Na telefonu morajo kartice zdrsniti izpod povzetka.");
assert(css.includes("@keyframes opomin-pristop-kartica-pade") && css.includes("--opomin-pristop-pot: 168px") && !css.includes("--opomin-pristop-pot: 158px") && css.includes("animation-delay: 70ms") && css.includes("animation-delay: 140ms"), "Kartice in njihovi krogi morajo po celotni izmerjeni poti potovati gladko in zaporedno tudi na ozkih telefonih.");
assert(ui.includes("is-opening-prime") && ui.includes("pristopKarticeSeOdpirajo") && css.includes(".is-expanded.is-opening-prime") && css.includes(".is-expanded.is-opening .opomin-pristop__kartica"), "Odpiranje mora najprej določiti začetni kader in šele nato zaporedno animirati kartice.");
assert(ui.includes('izberiPristopIzterjave(krogGumb.getAttribute("data-opomin-pristop-odpri"), true)') && ui.includes("!ohraniOdpiranje"), "Izbira iz kompaktnih polkrogov ne sme označiti kartic kot že odprto menjavo in izklopiti njihove animacije.");
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
assert(/\.opomin-pristop__krog,[\s\S]*?box-shadow:\s*0 11px 24px rgba\(30, 72, 68, \.22\),\s*0 3px 8px rgba\(30, 72, 68, \.14\);/.test(css), "Kompaktni krogi morajo imeti jasno, mehko dvojno senco.");
assert(/\.opomin-nacrt__carousel\s*\{[\s\S]*?padding-bottom:\s*16px;/.test(css), "Karusel mora ohraniti prostor za spodnjo senco kartic.");
assert(/\.opomin-nacrt__stage\s*\{[\s\S]*?box-shadow:\s*0 9px 15px -8px rgba\(31, 68, 63, \.20\),\s*0 3px 6px -4px rgba\(31, 68, 63, \.10\);/.test(css), "Kartice načrta morajo imeti nežno senco, usmerjeno navzdol.");
assert(/\.opomin-nacrt__stage--barvna\.opomin-nacrt__stage--izbran[\s\S]*?box-shadow:\s*0 10px 18px -8px rgba\(31, 68, 63, \.24\),\s*0 4px 7px -4px rgba\(31, 68, 63, \.12\);/.test(css), "Izbrana barvna kartica mora biti nežno dvignjena brez močne sence med karticami.");
assert(/\.opomin-nacrt__stevilo-kartic\s*\{[\s\S]*?grid-template-columns:\s*auto 44px 44px;[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/.test(css), "Število korakov mora biti čist tekst ob ločenih okroglih gumbih.");
assert(/\.opomin-nacrt__stevilo-kartic button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;[\s\S]*?border-radius:\s*50%;/.test(css), "Minus in plus morata ostati ločena okrogla 44px gumba.");
assert(/\.opomin-nacrt__stevilo-kartic small\s*\{[\s\S]*?font-size:\s*13px;[\s\S]*?font-weight:\s*700;/.test(css), "Beseda koraki mora biti enako jasno berljiva kot številka.");
assert(ui.includes('<span aria-live="polite"><strong>') && ui.indexOf('<span aria-live="polite"><strong>') < ui.indexOf('id="opomin-kartice-minus"'), "Napis s številom korakov mora biti pred gumboma minus in plus.");
assert(!ui.includes('class="opomin-preoblikuj__izbrani-korak"') && !ui.includes("Izbrani korak</small>"), "Pod karticami se izbrani korak ne sme podvajati.");
assert(ui.includes('var casPodrobnoOdprto = !jeManual && Boolean(step._casPodrobnoOdprto);'), "Podrobne nastavitve časa se ne smejo samodejno odpreti zaradi odstopanja od priporočila.");
assert(ui.includes('ciljniKorakZaCas._casPodrobnoOdprto = false'), "Ob prehodu na drug korak se morajo podrobne nastavitve časa zapreti.");
assert((ui.match(/Prikaži nastavitve/g) || []).length >= 2, "Zaprt urejevalnik mora jasno ponuditi gumb Prikaži nastavitve.");

console.log("PASS: trije pristopi pravilno prilagodijo načrt in ohranijo zadnjo predajo odvetniku.");
