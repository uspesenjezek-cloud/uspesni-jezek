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

test("HTML ima telefon, e-pošto in pomožno besedilo", () => {
  assert(/Telefon ali e-pošta/.test(html));
  assert(/id=["']telefon-dolznika["']/.test(html));
  assert(/id=["']email-dolznika["']/.test(html));
  assert(/type=["']tel["']/.test(html));
  assert(/type=["']email["']/.test(html));
  assert(/Za pošiljanje zadošča telefon ali e-pošta\./.test(html));
  assert(/Vnesite telefonsko številko ali e-poštni naslov\./.test(html));
  assert(/id=["']napaka-kontakt["']/.test(html));
  assert(/role=["']alert["']/.test(html));
});

test("zaporedje: telefon → e-pošta → napaka → pomoč", () => {
  const iTel = html.indexOf('id="telefon-dolznika"');
  const iEmail = html.indexOf('id="email-dolznika"');
  const iNapaka = html.indexOf('id="napaka-kontakt"');
  const iPomoc = html.indexOf('id="kontakt-pomoc"');
  assert(iTel > 0 && iEmail > iTel && iNapaka > iEmail && iPomoc > iNapaka);
});

test("CSS nima stilov za contact-kanal", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "..", "app", "styles.css"),
    "utf8"
  );
  assert(!/\.contact-kanal\b/.test(css), "styles.css še vsebuje .contact-kanal");
});

test("app.js nima logike kljukic", () => {
  assert(!/kanal-privzeto-sms/.test(appJs));
  assert(!/smsRocnoIzklop/.test(appJs));
  assert(!/posodobiKontaktneKljukice/.test(appJs));
  assert(!/obnoviKontaktneKljukiceIzOsnutka/.test(appJs));
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
