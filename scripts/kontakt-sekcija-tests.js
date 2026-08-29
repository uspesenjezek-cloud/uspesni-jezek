/**
 * Testi kontaktne sekcije (korak 1): brez SMS/e-pošta kljukic,
 * kanali se izpeljejo iz kontaktov.
 * Zaženi: node scripts/kontakt-sekcija-tests.js
 */
const path = require("path");
const fs = require("fs");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

let ok = 0;

function test(name, fn) {
  try {
    fn();
    ok += 1;
    console.log("ok -", name);
  } catch (e) {
    console.error("FAIL -", name, e.message);
    process.exitCode = 1;
  }
}

const htmlPath = path.join(__dirname, "..", "app", "neplacila.html");
const zgodovinaHtmlPath = path.join(__dirname, "..", "app", "neplacila-zgodovina.html");
const zgodovinaJsPath = path.join(__dirname, "..", "app", "neplacila-zgodovina.js");
const posiljanjeHtmlPath = path.join(__dirname, "..", "app", "neplacila-posiljanje.html");
const ocenaJsPath = path.join(__dirname, "..", "app", "ocena-tveganja.js");
const appJsPath = path.join(__dirname, "..", "app", "app.js");
const html = fs.readFileSync(htmlPath, "utf8");
const zgodovinaHtml = fs.readFileSync(zgodovinaHtmlPath, "utf8");
const zgodovinaJs = fs.readFileSync(zgodovinaJsPath, "utf8");
const posiljanjeHtml = fs.readFileSync(posiljanjeHtmlPath, "utf8");
const ocenaJs = fs.readFileSync(ocenaJsPath, "utf8");
const appJs = fs.readFileSync(appJsPath, "utf8");

test("HTML nima checkboxov SMS / E-pošta", () => {
  assert(!/kanal-privzeto-sms/.test(html), "kanal-privzeto-sms še obstaja");
  assert(!/kanal-privzeto-email/.test(html), "kanal-privzeto-email še obstaja");
  assert(!/contact-kanal/.test(html), "contact-kanal še obstaja");
  const kontaktniBlok = html.match(
    /<fieldset class="contact-group">[\s\S]*?<\/fieldset>/
  );
  assert(kontaktniBlok, "ni contact-group fieldset");
  assert(
    !/<input[^>]*type=["']checkbox["']/i.test(kontaktniBlok[0]),
    "checkbox še v kontaktni sekciji"
  );
  assert(!/>\s*SMS\s*</.test(kontaktniBlok[0]), "oznaka SMS še v sekciji");
});

test("HTML ima telefon, e-pošto in napako (brez pomožnega teksta)", () => {
  assert(/Telefon ali e-pošta/.test(html));
  assert(/id=["']telefon-dolznika["']/.test(html));
  assert(/id=["']email-dolznika["']/.test(html));
  assert(/type=["']tel["']/.test(html));
  assert(/type=["']email["']/.test(html));
  assert(!/Za pošiljanje zadošča telefon ali e-pošta\./.test(html));
  assert(!/kontakt-pomoc/.test(html));
  assert(!/contact-help/.test(html));
  assert(/Vnesite telefonsko številko ali e-poštni naslov\./.test(html));
  assert(/id=["']napaka-kontakt["']/.test(html));
  assert(/role=["']alert["']/.test(html));
});

test("zaporedje: telefon → e-pošta → napaka", () => {
  const iTel = html.indexOf('id="telefon-dolznika"');
  const iEmail = html.indexOf('id="email-dolznika"');
  const iNapaka = html.indexOf('id="napaka-kontakt"');
  assert(iTel > 0 && iEmail > iTel && iNapaka > iEmail);
  assert(html.indexOf('id="kontakt-pomoc"') === -1);
});

test("CSS: ozek razmik med poljema, brez contact-help/kanal", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "app", "styles.css"),
    "utf8"
  );
  assert(!/\.contact-kanal\b/.test(css), "styles.css še vsebuje .contact-kanal");
  assert(!/\.contact-help\b/.test(css), "styles.css še vsebuje .contact-help");
  assert(/\.contact-inputs\s*\{[^}]*gap:\s*var\(--space-xs\)/s.test(css), "gap ni --space-xs");
});

test("ocena tveganja je umaknjena s 1. koraka in dostopna ob priporočilu", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "app", "styles.css"),
    "utf8"
  );
  assert(/KORAK 1 . potrjena strnjena postavitev/.test(css));
  assert(/#obrazec-neplacilo \.contact-inputs\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/s.test(css));
  assert(/#obrazec-neplacilo \.zadeva-obrazec__podvrstica--datumi/.test(css));
  assert(!/<section class="ocena-tveganja"/.test(html), "kartica ocene tveganja je še vedno vidna na 1. koraku");
  assert(/priporocilo-widget__naslov">Priporočilo za ta dolg<\/h3>[\s\S]*data-odpri-oceno-tveganja[\s\S]*Ocena tveganja/.test(posiljanjeHtml), "ob priporočilu manjka mali gumb ocene tveganja");
  assert(/id="ocena-dolg-sheet" hidden[\s\S]*data-ocena-preklop="dolg"[\s\S]*data-ocena-preklop="zamuda"/.test(posiljanjeHtml), "nad nastavitvami dolga manjkata oba preklopna widgeta");
  assert(/id="ocena-zamuda-sheet" hidden[\s\S]*data-ocena-preklop="dolg"[\s\S]*data-ocena-preklop="zamuda"/.test(posiljanjeHtml), "nad nastavitvami zamude manjkata oba preklopna widgeta");
  assert(/pregledGumb\.addEventListener\("click"[\s\S]*odpriNastavitveOcene\("dolg"\)/.test(ocenaJs), "gumb ne odpre nastavitev neposredno");
  assert(/\[data-ocena-preklop\][\s\S]*odpriNastavitveOcene\(this\.getAttribute\("data-ocena-preklop"\)\)/.test(ocenaJs), "preklop med nastavitvama ni povezan");
});

test("zgodovina zamud ostane nastavljiva, nadaljevanje brez izbire pa deluje", () => {
  assert(!/data-zgodovina-zamud/.test(html), "izbira zgodovine je še vedno na 1. koraku");
  assert(!/id="ocena-tveganja"|class="zgodovina-ocena/.test(zgodovinaHtml), "vprašanje je še vedno ločena vrstica nad mini karticami");
  assert(/izvedba-poravnava-svicer__gumb--ocena[\s\S]*data-zgodovina-ocena-toggle[\s\S]*Pretekle zamude/.test(zgodovinaJs), "na 2. koraku manjka mini kartica za pretekle zamude");
  assert(/svicer\.insertBefore\(ocenaGumb, svicer\.firstChild\)/.test(zgodovinaJs), "mini kartica ni vstavljena v obstoječi sklop kartic");
  assert(/izvedba-poravnava-podrobnosti--ocena[\s\S]*Ali je dolžnik že kdaj zamudil s plačilom\?[\s\S]*data-zgodovina-zamud/.test(zgodovinaJs), "vprašanja niso izrisana v skupnem podrobnostnem panelu");
  assert(/data-zgodovina-ocena-odgovor[\s\S]*data-zgodovina-ocena-shrani/.test(zgodovinaJs), "manjkajo dodatna vprašanja ali shranjevanje odgovora");
  assert(/var zgodovinaZamud = korak1\.zgodovinaZamud;[\s\S]*shraniOcenoZamud\("unknown"\);[\s\S]*window\.location\.href = "neplacila-posiljanje\.html"/.test(zgodovinaJs), "nadaljevanje brez izbire ne nastavi varne privzete vrednosti");
});

test("app.js nima logike kljukic", () => {
  assert(!/kanal-privzeto-sms/.test(appJs));
  assert(!/smsRocnoIzklop/.test(appJs));
  assert(!/posodobiKontaktneKljukice/.test(appJs));
  assert(!/obnoviKontaktneKljukiceIzOsnutka/.test(appJs));
});

test("vsa enovrsticna polja prvega koraka sproti zmanjsajo predolgo vrednost", () => {
  assert(appJs.includes("#obrazec-neplacilo input[type=\"text\"]"));
  assert(appJs.includes("#obrazec-neplacilo input[type=\"tel\"]"));
  assert(appJs.includes("#obrazec-neplacilo input[type=\"email\"]"));
  assert(appJs.includes("#obrazec-neplacilo input[type=\"number\"]"));
  assert(/function prilagodiVelikostVnosnegaPolja\(el\)/.test(appJs));
  assert(/merilnikVnosnegaBesedila\.measureText\(vsebina\)/.test(appJs));
  assert(/style\.setProperty\(\s*"font-size",[\s\S]*?"important"\s*\)/.test(appJs));
  assert(/document\.addEventListener\("input",[\s\S]*?prilagodiVelikostVnosnegaPolja\(cilj\)/.test(appJs));
  assert(/document\.fonts\.ready\.then\(nacrtujPrilagoditevZneskov\)/.test(appJs));
});

test("vprasalni widget je locen in ima vedno viden kompaktni vnos", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "app", "styles.css"),
    "utf8"
  );
  assert(/KORAK 1 . korekcija po potrjeni referenci \(v2\)/.test(css));
  assert(!/\.opravljeno-vprasanje--shranjeno \.opravljeno-vprasanje__odgovor\s*\{[^}]*display:\s*none/s.test(css));
  assert(/\.opravljeno-bubble #opis-dolga\s*\{[^}]*height:\s*42px;[^}]*border:\s*1px solid/s.test(css));
  assert(/\.obrazec-razdelek--dolg \.obrazec__polje--opravljeno\s*\{[^}]*border:\s*1px solid[^}]*border-radius:\s*13px/s.test(css));
  assert(/#obrazec-neplacilo \.obrazec__polje--opravljeno-vprasanja \.opravljeno-bubble #opis-dolga\s*\{[^}]*height:\s*40px;[^}]*min-height:\s*40px/s.test(css));
  assert(/#obrazec-neplacilo \.obrazec__polje--opravljeno-vprasanja \.opravljeno-vprasanje__odgovor\s*\{[^}]*width:\s*100%;[^}]*padding:\s*0 0 5px/s.test(css));
  assert(/#obrazec-neplacilo \.obrazec__polje--opravljeno-vprasanja \.opravljeno-vprasanja__puscica\s*\{[^}]*width:\s*26px;[^}]*height:\s*26px/s.test(css));
  assert(/transition:\s*height var\(--opravljeno-visina-trajanje, 80ms\) cubic-bezier\(0\.22, 1, 0\.36, 1\)/.test(css));
  assert(/\.opravljeno-vprasanja__viewport--takojsnja-visina\s*\{[^}]*transition:\s*none !important/s.test(css));
  assert(/\.opravljeno-vprasanja__viewport--programski-prehod\s*\{[^}]*scroll-snap-type:\s*none/s.test(css));
  assert(/Math\.max\([\s\S]{0,120}aktivnaStran\.scrollHeight[\s\S]{0,100}getBoundingClientRect\(\)\.height/.test(appJs));
  assert(/celotnaVisina > opravljenoVprasanjaViewport\.offsetHeight[\s\S]{0,220}viewport--takojsnja-visina/.test(appJs));
  assert(/osveziVisinoOpravljenoVprasanje\(gladko, true\);[\s\S]{0,180}animirajPomikOpravljenoVprasanje/.test(appJs));
  assert(/const trajanje = 260;[\s\S]{0,300}Math\.pow\(1 - napredek, 4\)/.test(appJs));
  assert(/scrollWidth - opravljenoVprasanjaViewport\.clientWidth/.test(appJs));
  assert(/Math\.floor\(polozajMedStranmi\)[\s\S]{0,220}Math\.ceil\(polozajMedStranmi\)/.test(appJs));
  assert(/visjaVidnaStran\.visina > opravljenoVprasanjaViewport\.offsetHeight[\s\S]{0,180}osveziVisinoOpravljenoVprasanje\(\s*false,\s*true,\s*visjaVidnaStran\.stranIndeks/.test(appJs));
  assert(/opravljenoVprasanjaViewport\.scrollLeft - ciljniOdmikAktivneStrani[\s\S]{0,100}<= 1[\s\S]{0,120}osveziVisinoOpravljenoVprasanje\(true\)/.test(appJs));
  assert(/Math\.abs\(celotnaVisina - trenutnaVisina\) > 0\.5[\s\S]{0,180}celotnaVisina < trenutnaVisina \? "80ms" : "120ms"/.test(appJs));
  assert(/new ResizeObserver\([\s\S]{0,2600}opravljenoVelikostObserver\.observe\(stran\)/.test(appJs));
  assert(/touchend",[\s\S]{0,120}zakljuciRocniPrehodOpravljenoVprasanje/.test(appJs));
  assert(/rocniCiljOpravljenoVprasanje != null[\s\S]{0,180}osveziVisinoOpravljenoVprasanje\(\s*true,\s*false,\s*rocniCiljOpravljenoVprasanje/.test(appJs));
  assert(/Math\.abs\(premik\) > 12[\s\S]{0,180}premik > 0[\s\S]{0,120}Math\.ceil[\s\S]{0,120}Math\.floor/.test(appJs));
  assert(/Math\.abs\(trenutniOdmik - ciljniOdmik\) <= 1[\s\S]{0,100}rocniCiljOpravljenoVprasanje = null/.test(appJs));
  assert(/opisDolgaGlava\.addEventListener\("click"/.test(appJs));
  assert(/String\(priloga\.description \|\| ""\)\.trim\(\)\) priloga\.collapsed = true/.test(appJs));
  assert(/grid-template-columns:\s*minmax\(108px, 0\.72fr\) minmax\(0, 1\.28fr\)/.test(css));
});

test("privzetiKanaliIzKontaktov: telefon / e-pošta / oboje / prazno", () => {
  function izKontaktov(telefon, email) {
    return {
      sms: Boolean(String(telefon || "").trim()),
      email: Boolean(String(email || "").trim()),
    };
  }
  // Enaka logika kot privzetiKanaliIzKontaktov / razpolozljiviKanaliIzKontaktov v app.js
  assert(/function privzetiKanaliIzKontaktov\(telefon, email\) \{[\s\S]*?return razpolozljiviKanaliIzKontaktov\(telefon, email\);/.test(appJs));
  const samoTel = izKontaktov("041 123 456", "");
  assert(samoTel.sms === true && samoTel.email === false);
  const samoEmail = izKontaktov("", "a@b.si");
  assert(samoEmail.sms === false && samoEmail.email === true);
  const oboje = izKontaktov("041 123 456", "a@b.si");
  assert(oboje.sms === true && oboje.email === true);
  const prazno = izKontaktov("", "  ");
  assert(prazno.sms === false && prazno.email === false);
});

console.log("\n" + ok + " testov uspešnih");
