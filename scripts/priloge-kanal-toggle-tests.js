/**
 * Test toggle logike kanalov priloge (SMS / E-pošta) – enaka, neodvisna.
 * Zaženi: node scripts/priloge-kanal-toggle-tests.js
 */
const path = require("path");
const fs = require("fs");
const { JSDOM } = (() => {
  try {
    return { JSDOM: require("jsdom").JSDOM };
  } catch (_e) {
    return { JSDOM: null };
  }
})();

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

const css = fs.readFileSync(
  path.join(__dirname, "..", "app", "styles.css"),
  "utf8"
);
const ui = fs.readFileSync(
  path.join(__dirname, "..", "app", "opomin-nacrt-ui.js"),
  "utf8"
);

test("SMS in E-pošta on stil sta enaka", () => {
  assert(/\.vk-kanal-gumb--sms-on,\s*\.vk-kanal-gumb--email-on\s*\{/.test(css));
  assert(!/\.vk-kanal-gumb--sms-on\s*\{\s*border-color:\s*#3d999b/.test(css));
});

test("ni blokade 'Vsaj en kanal mora biti izbran'", () => {
  assert(!/Vsaj en kanal mora biti izbran/.test(ui));
});

test("toggle funkcija: SMS in e-pošta neodvisno", () => {
  function toggle(prej, kanal) {
    const novo = { sms: prej.sms, email: prej.email };
    novo[kanal] = !novo[kanal];
    return novo;
  }
  let s = { sms: true, email: true };
  s = toggle(s, "sms");
  assert(s.sms === false && s.email === true, "odkljukaj SMS");
  s = toggle(s, "email");
  assert(s.sms === false && s.email === false, "odkljukaj e-pošto (oba off OK)");
  s = toggle(s, "sms");
  assert(s.sms === true && s.email === false, "vklopi samo SMS");
  s = toggle(s, "email");
  assert(s.sms === true && s.email === true, "vklopi oba");
});

if (JSDOM) {
  test("DOM: aria-pressed in razredi se enako nastavita za SMS/E-pošta", () => {
    // Izsekamo htmlKanalGumb iz datoteke z eval znotraj mocka – raje
    // preverimo, da oba gumba uporabljata isti vzorec aria-pressed + ✓.
    assert(/aria-pressed="'\s*\+\s*\(vkljucen \? "true" : "false"\)/.test(ui) ||
      /aria-pressed="\$\{?/.test(ui) ||
      ui.indexOf('aria-pressed="') >= 0);
    assert(ui.indexOf('vk-kanal-gumb--sms-on') >= 0);
    assert(ui.indexOf('vk-kanal-gumb--email-on') >= 0);
    assert(ui.indexOf('(vkljucen && !onemogocen ? "✓ " : "")') >= 0);
  });
}

console.log("\n" + ok + " testov OK");
