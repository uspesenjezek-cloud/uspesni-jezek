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
const buildVersion = (html.match(/name="uj-build-version"\s+content="([^"]+)"/) || [])[1] || "";
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
    authGuard.includes('window.location.hostname === "localhost"') &&
    authGuard.includes('window.matchMedia("(max-width: 620px)").matches') &&
    authGuard.includes('sessionStorage.setItem("app-iphone-preview", "1")') &&
    authGuard.includes('classList.add("app-iphone-preview")'),
  "Lokalni telefonski prikaz mora po resetu sam obnoviti predogled celotnega iPhona."
);
assert(
  authGuard.includes("omogociNamiznoTouchDrsenje") &&
    authGuard.includes('dogodek.pointerType !== "mouse"') &&
    authGuard.includes("poisciDrsniVsebnik") &&
    authGuard.includes("poteza.scroller.scrollTop -= premik") &&
    authGuard.includes('dogodek.preventDefault()'),
  "Namizni iPhone predogled mora omogočiti navpično drsenje z vlečenjem miške kot s prstom."
);
assert(
  sharedCss.includes("html.app-iphone-preview.app-preview-touch-dragging") &&
    sharedCss.includes("cursor: grabbing") &&
    sharedCss.includes("user-select: none"),
  "Med namiznim touch vlečenjem mora biti izbira besedila izključena in kazalec jasen."
);
assert(
  protectedPages.length >= 10 &&
    protectedPages.every(
      (page) =>
        page.content.includes("styles.css?v=") &&
        page.content.includes("auth-zascita.js?v=")
    ),
  "Vse zaščitene kategorije morajo naložiti svežo različico skupnega iPhone predogleda."
);
assert(
  html.includes('auth-zascita.js?v=20260822-preview-touch-v16'),
  "Bonitetna stran mora po popravku naložiti svežo različico iPhone predogleda."
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
  html.includes('src="pwa-dev-refresh.js?v=20260822-stable-preview-v3"'),
  "Bonitetna PWA mora vključiti lokalno samodejno osveževanje."
);
assert(
  devRefresh.includes('get("app-auto-refresh") === "1"') &&
    devRefresh.includes("zahtevanoSamodejnoOsvezevanje || isPrivateHost") &&
    devRefresh.includes("if (!samodejnoOsvezevanje) return;"),
  "Samodejno osveževanje mora biti na lokalnem naslovu vedno vključeno."
);
assert(
  /-v\d+$/.test(buildVersion) &&
    !devRefresh.includes('params.get("app") !== "1"') &&
    devRefresh.includes('window.matchMedia("(display-mode: standalone)")') &&
    devRefresh.includes("!isPrivateHost && !isStandalone") &&
    devRefresh.includes("readServerBuild") &&
    devRefresh.includes('searchParams.set("_uj_check"') &&
    devRefresh.includes("serverBuild !== documentBuild") &&
    devRefresh.includes('cache: "no-store"') &&
    devRefresh.includes("visibilitychange") &&
    devRefresh.includes("window.location.replace"),
  "Samodejno osveževanje mora v lokalnem in nameščenem iPhone načinu zaznati star posnetek strani tudi ob prvem ponovnem odprtju."
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
