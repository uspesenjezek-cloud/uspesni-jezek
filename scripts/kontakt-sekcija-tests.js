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
const appJsPath = path.join(__dirname, "..", "app", "app.js");
const html = fs.readFileSync(htmlPath, "utf8");
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

test("potrjena strnjena postavitev ohrani funkcije in swipe namig", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "app", "styles.css"),
    "utf8"
  );
  assert(/KORAK 1 . potrjena strnjena postavitev/.test(css));
  assert(/#obrazec-neplacilo \.contact-inputs\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/s.test(css));
  assert(/#obrazec-neplacilo \.zadeva-obrazec__podvrstica--datumi/.test(css));
  assert(/#obrazec-neplacilo \.ocena-tveganja__polje-vrednost\s*\{[^}]*border-bottom:\s*1px solid/s.test(css));
  assert(/#obrazec-neplacilo \.ocena-tveganja__izbira\s*\{[^}]*4\.5/s.test(css));
  assert(/id="ocena-tveganja-zamuda-vrednost"[^>]*data-fit-number/.test(html));
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
  assert(/transition:\s*height 160ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/.test(css));
  assert(/\.opravljeno-vprasanja__viewport--takojsnja-visina\s*\{[^}]*transition:\s*none !important/s.test(css));
  assert(/Math\.max\([\s\S]{0,120}aktivnaStran\.scrollHeight[\s\S]{0,100}getBoundingClientRect\(\)\.height/.test(appJs));
  assert(/celotnaVisina > opravljenoVprasanjaViewport\.offsetHeight[\s\S]{0,220}viewport--takojsnja-visina/.test(appJs));
  assert(/osveziVisinoOpravljenoVprasanje\(\);[\s\S]{0,180}opravljenoVprasanjaViewport\.scrollTo/.test(appJs));
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
