import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const Rok = require(join(rootDir, "app", "rok-placila-utils.js"));
const Priporocila = require(join(rootDir, "app", "ton-dodatki-priporocila.js"));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const pricakovano = {
  friendly: 4,
  firm: 2,
  strict: 2,
};

for (const [ton, st] of Object.entries(pricakovano)) {
  const norm = Priporocila.normalizirajTon(ton);
  const predlog = Rok.predlogObrocnegaZaTon(norm);
  assert(predlog.installments === st, ton + ": pričakovano " + st + ", dobljeno " + predlog.installments);
}

assert(Priporocila.normalizirajTon("neutral") === "firm", "neutral→firm");
assert(Rok.predlogObrocnegaZaTon("firm").installments === 2, "firm=2");
assert(Rok.predlogObrocnegaZaTon("neutral").installments === 3, "raw neutral še vedno 3 v utils");
// UI mora uporabljati normaliziran ton, ne raw neutral:
assert(
  Rok.predlogObrocnegaZaTon(Priporocila.normalizirajTon("neutral")).installments === 2,
  "normaliziran neutral → 2"
);

console.log("OK test-obrocno-ton-stevilo: friendly→4, firm→2, strict→2");
