const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.css"), "utf8");
const sharedCss = fs.readFileSync(path.join(root, "app", "styles.css"), "utf8");
const authGuard = fs.readFileSync(path.join(root, "app", "auth-zascita.js"), "utf8");
const devRefresh = fs.readFileSync(path.join(root, "app", "pwa-dev-refresh.js"), "utf8");
const pwaViewport = fs.readFileSync(path.join(root, "app", "pwa-viewport.js"), "utf8");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "app", "bonitetna-manifest.json"), "utf8")
);
const protectedPages = fs
  .readdirSync(path.join(root, "app"))
  .filter((name) => name.endsWith(".html"))
  .map((name) => ({
    name,
    content: fs.readFileSync(path.join(root, "app", name), "utf8")
  }))
  .filter((page) => page.content.includes("auth-zascita.js"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(html.includes("viewport-fit=cover"), "Bonitetna stran mora upoštevati iPhone safe area.");
assert(
  html.includes('name="apple-mobile-web-app-capable" content="yes"'),
  "Bonitetna stran mora omogočiti iOS standalone način."
);
assert(
  html.includes('name="apple-mobile-web-app-status-bar-style" content="default"'),
  "Vsebina PWA se mora začeti pod iPhonovo statusno vrstico."
);
assert(
  html.includes('rel="manifest" href="bonitetna-manifest.json"'),
  "Bonitetna stran mora uporabljati svoj PWA manifest."
);
assert(
  authGuard.includes('get("app-preview")') &&
    authGuard.includes('sessionStorage.setItem("app-iphone-preview", "1")') &&
    authGuard.includes('classList.add("app-iphone-preview")'),
  "Vse zaščitene kategorije morajo podpirati namenski predogled celotnega iPhona."
);
assert(
  protectedPages.length >= 10 &&
    protectedPages.every(
      (page) =>
        page.content.includes("styles.css?v=20260817-iphone-preview-v1") &&
        page.content.includes("auth-zascita.js?v=20260817-iphone-preview-v1")
    ),
  "Vse zaščitene kategorije morajo naložiti svežo različico skupnega iPhone predogleda."
);
assert(
  sharedCss.includes("html.app-iphone-preview body::before") && sharedCss.includes("height: 47px"),
  "Namizni app predogled mora rezervirati prostor iPhonove statusne vrstice."
);
assert(
  sharedCss.includes("html.app-iphone-preview::before") &&
    sharedCss.includes("width: 118px") &&
    sharedCss.includes("border-radius: 999px"),
  "Namizni app predogled mora prikazati iPhonov Dynamic Island."
);
assert(
  html.includes('src="pwa-dev-refresh.js?v=20260817-v1"'),
  "Bonitetna PWA mora vključiti lokalno samodejno osveževanje."
);
assert(
  devRefresh.includes('params.get("app") !== "1"') &&
    devRefresh.includes('cache: "no-store"') &&
    devRefresh.includes("visibilitychange") &&
    devRefresh.includes("window.location.replace"),
  "Samodejno osveževanje mora biti omejeno na lokalni PWA način in zaznati vrnitev v aplikacijo."
);
assert(
  html.includes('src="pwa-viewport.js?v=20260817-v1"') &&
    html.includes('window.matchMedia("(display-mode: standalone)")'),
  "PWA mora prepoznati samostojni prikaz še pred izrisom strani."
);
assert(
  html.includes('class="boniteta-zacasno-nazaj"') &&
    html.includes('href="index.html"') &&
    css.includes(".boniteta-zacasno-nazaj"),
  "Bonitetni center mora imeti začasni gumb za vrnitev na glavno stran."
);
assert(
  css.includes("html.boniteta-standalone.boniteta-pwa-fits") &&
    css.includes("overscroll-behavior-y: none"),
  "Kratka PWA stran mora preprečiti prazen elastični pomik."
);
assert(
  pwaViewport.includes("getVisibleContentBottom") &&
    pwaViewport.includes('root.classList.toggle("boniteta-pwa-fits", fits)') &&
    pwaViewport.includes("ResizeObserver"),
  "Zaklep pomika se mora prilagajati dejanski višini trenutne vsebine."
);
assert(manifest.display === "standalone", "Manifest mora odstraniti vmesnik brskalnika.");
assert(
  manifest.start_url === "/app/bonitetna-preverba.html?app=1",
  "PWA se mora odpreti neposredno v bonitetnem centru."
);
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "Manifest mora vsebovati ikone.");

console.log("Bonitetna PWA konfiguracija je veljavna.");
