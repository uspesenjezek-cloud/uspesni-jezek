const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const js = fs.readFileSync(path.join(root, "app", "izvedba.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "neplacila-zgodovina.css"), "utf8");
const html = fs.readFileSync(path.join(root, "app", "neplacila-zgodovina.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

[
  "partial", "full", "installment", "unpaid_installment", "payment_promised",
  "payment_failed", "invoice_dispute", "insolvency", "credit_note",
  "compensation", "cancelled_invoice",
].forEach((type) => assert(js.includes(`${type}: { naslov:`), `Manjka kartica zgodovine: ${type}`));

assert(js.includes('class="zgodovina-dogodek__polje zgodovina-dogodek__polje--polno"'), "Datumska polja morajo ostati čez celo vrstico.");
assert(js.includes('class="zgodovina-dogodek__polje zgodovina-dogodek__polje--par"'), "Kratka združljiva polja morajo uporabljati kompaktni par.");
assert(css.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "Manjka dvostolpčna kompaktna mreža.");
assert(css.includes(":has(> .zgodovina-dogodek__polje--par ~ .zgodovina-dogodek__polje--par)"), "Samotno kratko polje se mora razširiti čez vrstico.");
assert(css.includes("@media (max-width: 330px)"), "Na najožjih zaslonih se morajo polja zložiti v en stolpec.");

assert(js.includes("installmentNumberUnknown: false"), "Manjka začetno stanje za neznano številko obroka.");
assert(js.includes("data-unpaid-installment-number-unknown"), "Manjka gumb Ne vem pri številki obroka.");
assert(js.includes('installmentNumber: stevilkaObrokaNeznana ? null : stevilkaObroka'), "Neznana številka obroka se ne zapisuje varno.");
assert(js.includes("Vnesite številko neplačanega obroka ali izberite Ne vem."), "Validacija ne ponudi možnosti Ne vem.");
assert(js.includes('[\"unknown\", \"Ne vem\"]'), "Izbirniki plačila in komunikacije morajo vsebovati Ne vem.");
assert(js.includes('data-history-date-unknown=\"'), "Datumi morajo vsebovati Ne vem.");
assert(js.includes('data-history-date-approx=\"'), "Datumi morajo vsebovati Približno.");

assert(css.includes("rgba(var(--action-rgb, 63, 153, 152), .78)"), "Obroba obveznega polja mora slediti barvi aktivnega dogodka.");
assert(html.includes("neplacila-zgodovina.css?v=20260830-nadaljuj-zunaj-v1-atena-pill-v2-event-border-v1"), "CSS cache različica ni osvežena.");
assert(html.includes("izvedba.js?v=20260830-preostanek-prikaz-v2-choice-toggle-v1"), "JS cache različica ni usklajena z zaslonom.");

console.log("PASS: kartice zgodovine imajo kompaktne pare, polne datumske vrstice in varno možnost Ne vem.");
