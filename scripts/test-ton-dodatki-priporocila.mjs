import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const root = dirname(fileURLToPath(import.meta.url));
const rok = require(join(root, "..", "app", "rok-placila-utils.js"));
const api = require(join(root, "..", "app", "ton-dodatki-priporocila.js"));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(api.normalizirajTon("very_friendly") === "friendly", "map very_friendly");
assert(api.normalizirajTon("neutral") === "firm", "map neutral");
assert(api.normalizirajTon("firm") === "firm", "firm");
assert(api.normalizirajTon("strict") === "strict", "strict");

assert(api.razvrstiZamudo(-1) === "ni_zapadlo", "neg");
assert(api.razvrstiZamudo(0) === "kratka", "0");
assert(api.razvrstiZamudo(14) === "kratka", "14");
assert(api.razvrstiZamudo(15) === "srednja", "15");
assert(api.razvrstiZamudo(31) === "dolga", "31");

assert(api.razvrstiZnesek(9999) === "nizek", "nizek");
assert(api.razvrstiZnesek(10000) === "srednji", "srednji");
assert(api.razvrstiZnesek(50001) === "visok", "visok");

const p = api.sestaviPriporocila({
  toneId: "friendly",
  overdueDays: 5,
  amountCents: 60000,
});
assert(p.toneId === "friendly", "tone");
assert(p.termDays === rok.dneviZaTon("friendly"), "days sync");
assert(p.installments === rok.predlogObrocnegaZaTon("friendly").installments, "inst");
assert(p.rokText.includes("14 dni"), "rok 14");
assert(p.obrocnoText.includes("4 obroki"), "4 obroki");
assert(p.obrocnoText.includes("višjem znesku"), "znesek dodatek");
assert(p.rokHtml.includes("<strong>14 dni</strong>"), "html bold");

const s = api.sestaviPriporocila({
  toneId: "strict",
  overdueDays: null,
  amountCents: 5000,
});
assert(s.rokText.includes("3 dni"), "strict rok");
assert(s.obrocnoText.includes("2 obroka"), "strict obrocno");
assert(s.obrocnoText.includes("nizkem znesku"), "nizek");

console.log("OK test-ton-dodatki-priporocila");
