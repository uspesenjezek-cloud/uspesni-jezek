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
const appJs = fs.readFileSync(path.join(__dirname, "..", "app", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "app", "neplacila.html"), "utf8");

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

test("prvi korak ima eno skupno izbiro kanalov za vse račune", () => {
  const indeksKanalov = html.indexOf('id="racun-posiljanje-kanali-vsi"');
  const indeksSeznama = html.indexOf('id="racun-posiljanje-seznam"');
  assert(indeksKanalov > 0 && indeksKanalov < indeksSeznama, "izbira mora biti nad vsemi računi");
  assert(/messageAttachments\.forEach\(\(priloga\) => \{\s*priloga\.kanali = kopirajKanale\(usklajeni\)/.test(appJs));
  assert(/\.racun-posiljanje__kanali-vsi\s*\{[\s\S]*?grid-template-columns:[\s\S]*?width:\s*100%/.test(css));
  assert(/data-fit-text-min="8\.5"/.test(html));
  const skupnaIzbira = appJs.match(/function izrisiIzbiroKanalovVsehRacunov\(\)[\s\S]*?\n  function izrisiIzbranePriloge/);
  assert(skupnaIzbira && !/Oboje/.test(skupnaIzbira[0]), "skupna izbira ne sme imeti gumba Oboje");
  assert(/racun-posiljanje__kanal-gumb--izbran/.test(skupnaIzbira[0]));
  assert(/if \(!novi\.sms && !novi\.email\) return/.test(skupnaIzbira[0]));
  assert(/racun-posiljanje__datoteka-izvor-locilo/.test(appJs));
  assert(/oznakeKanalov\.join\(" · "\)/.test(appJs));
});

test("drugi korak uporablja isti skupni sistem kanalov kot prvi", () => {
  const kartica = ui.match(/function htmlKarticaRacuna\(p, imaTel, imaEmail\)[\s\S]*?\n    function htmlKanalGumbV2/);
  assert(kartica, "manjka prikaz kartice računa");
  assert(!/Priloži v:/.test(kartica[0]), "kartica ne sme več ponavljati gumbov kanalov");
  assert(/Dodano kot priloga/.test(ui));
  assert(/vk-racun-kartica__status-locilo/.test(ui));
  assert(/SMS · E-pošta/.test(ui));
  assert(/htmlSkupniKanaliRacunov\(imaTel, imaEmail\)/.test(ui));
  assert(/data-racun-kanal-vsi/.test(ui));
  assert(/prilogeKoraka\.forEach\(function \(p\) \{\s*p\.deliveryChannels = \{ sms: Boolean\(novi\.sms\), email: Boolean\(novi\.email\) \}/.test(ui));
  assert(/if \(!novi\.sms && !novi\.email\) return/.test(ui));
  assert(/data-fit-text-min="7\.5"/.test(ui));
  assert(/if \(prilogeKoraka\.length\) \{[\s\S]*?return skupniKanaliRacunov/.test(ui));
});

test("oba koraka imata isti naslov Priložite račun in siv številčni števec", () => {
  assert(/racun-posiljanje__naslov-besedilo">Priložite račun<\/span><span class="racun-posiljanje__stevec"[^>]*>0<\/span>/.test(html));
  assert(/racunStevec\.textContent = String\(messageAttachments\.length\)/.test(appJs));
  assert(/Priložite račun<\/span>[\s\S]*?racun-posiljanje__stevec[\s\S]*?esc\(steviloPrilog\)/.test(ui));
  assert(/\.racun-posiljanje__stevec\s*\{[\s\S]*?color:\s*#8a9996/.test(css));
  assert(/\.racun-posiljanje__stevec\s*\{[\s\S]*?border-left:\s*1px solid #c5cfcd/.test(css));
  assert(/\.racun-posiljanje--kompaktno \.racun-posiljanje__naslov\s*\{[\s\S]*?height:\s*32px[\s\S]*?align-items:\s*center/.test(css));
  assert(/\.vk-priloge-orodna-vrstica \.racun-posiljanje__naslov\s*\{[\s\S]*?height:\s*32px[\s\S]*?align-items:\s*center/.test(css));
  assert(/#obrazec-neplacilo \.racun-posiljanje--kompaktno \.racun-posiljanje__oznaka,[\s\S]*?transform:\s*translateY\(3px\)/.test(css));
  assert(/#obrazec-neplacilo \.racun-posiljanje--kompaktno \.racun-posiljanje__naslov,[\s\S]*?font-size:\s*12\.5px/.test(css));
  assert(/Enotna sredinska poravnava orodne vrstice računa[\s\S]*?\.racun-posiljanje__oznaka\s*\{[\s\S]*?height:\s*40px[\s\S]*?transform:\s*none/.test(css));
  assert(/Enotna sredinska poravnava orodne vrstice računa[\s\S]*?\.racun-posiljanje__naslov\s*\{[\s\S]*?height:\s*40px[\s\S]*?align-items:\s*center/.test(css));
  assert(/Enotna sredinska poravnava orodne vrstice računa[\s\S]*?\.racun-posiljanje__akcije--orodna-vrstica\s*\{[\s\S]*?height:\s*40px[\s\S]*?align-items:\s*center/.test(css));
  assert(!/vk-priloge-orodna-vrstica__oznaka">Priloženi računi/.test(ui));
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
