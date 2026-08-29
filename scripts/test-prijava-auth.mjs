import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const preberi = (pot) => readFileSync(new URL(`../${pot}`, import.meta.url), "utf8");
const js = preberi("app/prijava.js");
const html = preberi("app/prijava.html");
const css = preberi("app/styles.css");
const generator = preberi("scripts/generate-config.js");

assert.match(js, /function prevediAuthNapako\(napakaAuth\)/);
assert.match(js, /invalid login credentials[\s\S]{0,120}E-pošta ali geslo nista pravilna\./i);
assert.match(js, /failed to fetch\|networkerror\|load failed\|fetch failed/i);
assert.match(js, /if \(!supabaseKlient \|\| !supabaseKlient\.auth\)/);
assert.match(html, /config\.js\?v=20260823-auth-config-repair-v1/);
assert.match(html, /prijava\.js\?v=20260823-auth-config-repair-v1/);
assert.match(css, /\.obrazec__polje\[hidden\]\s*\{\s*display:\s*none;/);
assert.match(generator, /SENSITIVE\|REDACTED/);

console.log("Prijava Auth: OK");
