import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const preberi = (pot) => readFileSync(new URL(`../${pot}`, import.meta.url), "utf8");
const strani = ["app/neplacila-posiljanje.html", "app/neplacila-sporocilo.html"];

for (const pot of strani) {
  const html = preberi(pot);
  assert.match(html, /Nastavi rok plačila ročno/);
  assert.match(html, /class="rok-sheet__hitro-znacka">Hitra izbira<\/span>/);
  assert.doesNotMatch(html, /id="rok-sheet-rocno"|>Ročno<\/button>/);
  assert.match(html, /id="rok-sheet-datum"[\s\S]{0,100}aria-label="Spremeni izbrani rok plačila"/);
  assert.doesNotMatch(html, /Tapnite za spremembo/);
  assert.match(html, /class="rok-sheet__povzetek-zgoraj"[\s\S]{0,1000}class="rok-sheet__povzetek-meta"[\s\S]{0,180}rok-sheet__povzetek-rel/);
  assert.match(html, /class="rok-sheet__povzetek-akcija"[\s\S]{0,180}Določite točni datum[\s\S]{0,220}rok-sheet__povzetek-dostop/);
  assert.doesNotMatch(html, /rok-sheet__povzetek-locilo/);
  assert.match(html, /class="rok-sheet__povzetek-dostop"/);
  assert.doesNotMatch(html, /id="rok-sheet-samodejno"|id="rok-sheet-pomoc"/);
  assert.match(
    html,
    /Dodatek k glavnemu sporočilu[\s\S]{0,180}To besedilo bo dodano na konec glavnega sporočila\.[\s\S]{0,180}id="rok-sheet-addon"[^>]*aria-live="polite"/,
    `${pot}: rok plačila mora prikazati natančen dodatek k glavnemu sporočilu.`
  );
  assert.match(html, /id="obrocno-sheet-razmik-izbira"[\s\S]*?data-obrocno-razmik="weekly"[\s\S]*?data-obrocno-razmik="custom"/);
  assert.match(
    html,
    /class="obrocno-sheet__znesek-kartica"[\s\S]{0,260}Znesek dolga[\s\S]{0,180}id="obrocno-sheet-znesek"/,
    `${pot}: kartica mora jasno prikazati znesek dolga.`
  );
  assert.doesNotMatch(
    html,
    /obrocno-sheet-znacka|Samodejni predlog|Prilagojen načrt/,
    `${pot}: kartica zneska ne sme prikazovati dodatne statusne oznake.`
  );
  assert.match(html, /id="obrocno-sheet-razmik" hidden aria-hidden="true" tabindex="-1"/);
  assert.match(html, /class="obrocno-sheet__nacrt-glava"[\s\S]*?Načrt obrokov[\s\S]*?<\/div>\s*<button[^>]*class="obrocno-sheet__enakomerno"[^>]*id="obrocno-sheet-enakomerno"[^>]*aria-pressed="false"[\s\S]*?Enakomerno razdeli € med obroke/);
  for (const predpona of ["rok-sheet", "obrocno-sheet"]) {
    assert.match(
      html,
      new RegExp(
        `id="${predpona}-preklici"[\\s\\S]{0,100}Prekliči[\\s\\S]{0,220}` +
          `id="${predpona}-shrani"[\\s\\S]{0,100}Shrani`
      ),
      `${pot}: ${predpona} mora imeti spodaj gumba Prekliči in Shrani.`
    );
  }
  assert.match(
    html,
    /id="trr-sheet-preklici"[\s\S]{0,100}Prekliči[\s\S]{0,220}id="trr-sheet-shrani"[\s\S]{0,100}Vklopi/,
    `${pot}: TRR ohrani gumba Prekliči in Vklopi.`
  );
}

const rok = preberi("app/rok-placila-sheet.js");
assert.match(
  rok,
  /preklici\.addEventListener\("click", function \(\) \{\s*zapiranjeDovoljeno = true;\s*zapriSheet\(false\);/,
  "Prekliči pri roku mora zapreti obrazec brez odstranitve roka."
);
assert.doesNotMatch(rok, /Shrani in dodaj|Shrani spremembe/);
assert.doesNotMatch(rok, /rocnoGumb|showPicker|datumPolje\.click\(\)/);
assert.match(rok, /var addon = document\.getElementById\("rok-sheet-addon"\);/);
assert.match(
  rok,
  /addon\.textContent = UJ\.sestaviVrsticoRoka\(deadline, ugotoviJezik\(\)\);/,
  "Predogled roka mora uporabljati isto funkcijo kot besedilo, ki se dejansko pripiše sporočilu."
);
assert.match(
  rok,
  /onUndo: function \(\) \{[\s\S]{0,500}draftEnabled = true;[\s\S]{0,220}osnutek\.mode = "manual";/,
  "Umik priporočila za rok mora ohraniti funkcijo vključeno za ročno nastavitev."
);

const obrocno = preberi("app/obrocno-sheet.js");
assert.match(obrocno, /function besediloShraniGumba\(\) \{\s*return "Shrani";/);
assert.match(obrocno, /function posodobiRazmikIzbiro\(\)/);
assert.match(obrocno, /razmik\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
assert.match(obrocno, /enakomernoPotrjeno = true;[\s\S]*?sporoci\("Znesek je enakomerno razdeljen med obroke\."\)/);
assert.match(obrocno, /function ponastaviEnakomernoStanje\(\)/);
assert.match(
  obrocno,
  /onUndo: function \(\) \{[\s\S]{0,500}draftEnabled = true;[\s\S]{0,120}draftIncluded = true;/,
  "Umik priporočila za obroke mora ohraniti funkcijo vključeno za ročno nastavitev."
);
assert.match(obrocno, /if \(enakomernoPotrjeno\) \{[\s\S]*?ponastaviEnakomernoStanje\(\);[\s\S]*?Enakomerna razdelitev ni več izbrana\.[\s\S]*?return;/);

const trr = preberi("app/trr-sheet.js");
assert.match(trr, /shraniGumb\.textContent = originalEnabled \? "Shrani" : "Vklopi";/);
assert.match(
  trr,
  /if \(vsebina\) vsebina\.hidden = false;/,
  "Celoten TRR meni mora biti viden tudi, ko je vključitev v sporočilo izklopljena."
);
assert.doesNotMatch(
  trr,
  /if \(vsebina\) vsebina\.hidden = !on;/,
  "Stikalo TRR ne sme več skrivati nastavitev računa."
);
assert.match(
  trr,
  /sheet\.classList\.toggle\("trr-sheet--vkljucen", on\)/,
  "TRR sheet mora vizualno označiti, ali je dodatek dejansko vključen."
);

const slogi = preberi("app/styles.css");
assert.match(
  slogi,
  /\.rok-sheet__stikalo-tir\s*\{[\s\S]{0,180}width:\s*64px;[\s\S]{0,100}height:\s*28px;/,
  "Skupno stikalo za rok plačila, obroke in TRR mora imeti jasno širši 64 px tir."
);
assert.match(
  slogi,
  /\.rok-sheet__stikalo input:checked \+ \.rok-sheet__stikalo-tir::after\s*\{[\s\S]{0,100}translateX\(36px\)/,
  "Krog širšega stikala mora v vključenem stanju priti do desnega roba."
);
assert.match(slogi, /#rok-sheet \.rok-sheet__rocaj,[\s\S]{0,160}display:\s*none;/);
assert.match(slogi, /\.rok-sheet__telo\s*\{[\s\S]{0,120}scrollbar-width:\s*none;/);
assert.match(slogi, /\.obrocno-sheet__znesek-kartica\s*\{[\s\S]{0,260}margin:\s*0 0 8px;[\s\S]{0,100}padding:\s*7px 12px 8px;/);
assert.match(slogi, /\.obrocno-sheet__znesek-kartica \.rok-sheet__oznaka\s*\{[\s\S]{0,80}margin-bottom:\s*3px;/);
assert.match(slogi, /\.rok-sheet__povzetek-rel\s*\{[\s\S]{0,260}min-width:\s*140px;[\s\S]{0,500}border-radius:\s*999px;[\s\S]{0,300}font-size:\s*0\.95rem;[\s\S]{0,100}font-weight:\s*750;/);
assert.match(slogi, /\.rok-sheet__povzetek-akcija\s*\{[\s\S]{0,300}border-top:/);
assert.match(slogi, /\.obrocno-sheet__razmik-izbira\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
assert.match(slogi, /\.obrocno-sheet__razmik-kartica--izbrana,[\s\S]*?radial-gradient/);
assert.match(slogi, /\.obrocno-sheet__enakomerno\s*\{[\s\S]*?width:\s*100%;[\s\S]*?linear-gradient/);
assert.match(slogi, /\.obrocno-sheet__enakomerno::after\s*\{[\s\S]*?content:\s*"";/);
assert.match(slogi, /\.obrocno-sheet__enakomerno\[aria-pressed="true"\]::after\s*\{[\s\S]*?content:\s*"✓";/);
assert.match(slogi, /\.obrocno-sheet__enakomerno-ikona\s*\{[\s\S]*?background:\s*#ffffff;/);
assert.match(
  slogi,
  /\.obrocno-sheet__vrstica\s*\{[\s\S]*?radial-gradient[\s\S]*?linear-gradient[\s\S]*?box-shadow:/,
  "Kartice obrokov morajo imeti nežen barvni preliv in globino."
);
assert.match(
  slogi,
  /\.obrocno-sheet__vrstica-naslov::before\s*\{[\s\S]*?background:\s*linear-gradient/,
  "Vsak obrok mora imeti majhen barvni orientacijski poudarek."
);
assert.match(slogi, /\.trr-sheet__kartica--izbrana\s*\{[\s\S]*?background:\s*#f1f4f4;/);
assert.match(
  slogi,
  /\.trr-sheet--vkljucen \.trr-sheet__kartica--izbrana\s*\{[\s\S]*?background:\s*var\(--teal-pale, #eaf6f5\);/
);
assert.match(slogi, /\.trr-sheet__kartica input\s*\{[\s\S]*?appearance:\s*none;/);
assert.match(slogi, /\.trr-sheet__kartica input:checked\s*\{[\s\S]*?radial-gradient/);

const navigacija = preberi("app/testna-vrstica.css");
assert.match(navigacija, /body\.rok-sheet-odprt \.app-testna-vrstica/);
assert.match(navigacija, /body\.obrocno-sheet-odprt \.app-testna-vrstica/);

console.log("Sheet akcije: OK");
