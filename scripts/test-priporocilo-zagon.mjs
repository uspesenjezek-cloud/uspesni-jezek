import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const preberi = (ime) => fs.readFileSync(path.join(root, "..", "app", ime), "utf8");
const appSrc = preberi("app.js");
const widgetSrc = preberi("priporocilo-widget.js");
const htmlSrc = preberi("neplacila-posiljanje.html");

assert.ok(
  appSrc.includes('dispatchEvent(new CustomEvent("uj:nacrt-pripravljen"))'),
  "Nacrt mora widget obvestiti, ko so asinhrono nalozeni podatki pripravljeni"
);
assert.ok(widgetSrc.includes('addEventListener("uj:nacrt-pripravljen"'));
assert.ok(widgetSrc.includes("var korak3Zagnan = false"));
assert.ok(widgetSrc.includes("if (korak3Zagnan) return true"));
assert.ok(htmlSrc.includes("app.js?v=20260815-racun-stevec-v19"));

console.log("Zagon widgeta Priporocilo za ta dolg: vsi testi uspesni");
