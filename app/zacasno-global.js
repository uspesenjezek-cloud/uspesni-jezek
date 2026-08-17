(function () {
  "use strict";

  var STORAGE_KEY = "uj-zacasno-simulacije-v1";
  var timerId = null;
  var host = null;

  if (/\/zacasno-obvestila\.html$/i.test(window.location.pathname)) return;

  function preberi() {
    try {
      var vrednost = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(vrednost) ? vrednost : [];
    } catch (e) {
      return [];
    }
  }

  function shrani(vrednosti) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vrednosti));
    } catch (e) {
      /* Simulacija mora ostati neškodljiva tudi brez localStorage. */
    }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function dodajSloge() {
    if (document.getElementById("uj-zacasno-global-slogi")) return;
    var slog = document.createElement("style");
    slog.id = "uj-zacasno-global-slogi";
    slog.textContent =
      ".ujzg[hidden]{display:none!important}.ujzg{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-start;justify-content:center;padding:calc(18px + env(safe-area-inset-top,0px)) 12px 18px;background:rgba(18,34,34,.22);-webkit-backdrop-filter:blur(5px) saturate(.86);backdrop-filter:blur(5px) saturate(.86);font-family:inherit}.ujzg *{box-sizing:border-box}.ujzg__okno{--ujzg-accent:#6cae90;--ujzg-rgb:108,174,144;width:min(100%,430px);padding:12px;border:1px solid rgba(var(--ujzg-rgb),.38);border-radius:24px;background:radial-gradient(90% 100% at 0 0,rgba(var(--ujzg-rgb),.15),transparent 66%),#fff;box-shadow:0 18px 48px rgba(18,34,34,.25);animation:ujzg-vstop .22s cubic-bezier(.2,.8,.2,1) both}.ujzg__vrh{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 2px 10px 5px}.ujzg__vrh span{display:flex;flex-direction:column;gap:1px;color:#183a3a}.ujzg__vrh strong{font-size:13px}.ujzg__vrh small{font-size:10px;color:#718483}.ujzg__zapri{display:grid;place-items:center;width:34px;height:34px;border:1px solid #dfe8e6;border-radius:50%;background:rgba(255,255,255,.9);color:#40504e;font:inherit;font-size:22px;line-height:1;cursor:pointer}.ujzg__obvestilo{width:100%;display:grid;grid-template-columns:38px minmax(0,1fr);gap:10px;padding:12px;border:1px solid rgba(var(--ujzg-rgb),.5);border-radius:20px;background:#fff;color:#172224;text-align:left;font:inherit;box-shadow:0 8px 20px rgba(20,30,40,.13);cursor:pointer}.ujzg__ikona{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:rgba(var(--ujzg-rgb),.13);color:var(--ujzg-accent)}.ujzg__ikona svg{width:22px;height:22px}.ujzg__vsebina{min-width:0;display:flex;flex-direction:column;gap:2px}.ujzg__app{display:flex;justify-content:space-between;gap:8px;color:#899391;font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.ujzg__naslov{color:#111d22;font-size:13px;font-weight:800;line-height:1.25}.ujzg__telo{color:#3d4947;font-size:11px;line-height:1.4}.ujzg__namig{margin:9px 4px 1px;color:#718483;font-size:10.5px;line-height:1.4;text-align:center}@keyframes ujzg-vstop{from{opacity:0;transform:translateY(-14px) scale(.97)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.ujzg__okno{animation:none}}";
    document.head.appendChild(slog);
  }

  function zagotoviHost() {
    if (host && document.body.contains(host)) return host;
    // Med preusmeritvijo na prijavo je dokument lahko že brez <body>.
    // V tem vmesnem stanju obvestila ne ustvarjamo in ne prekinemo nalaganja strani.
    if (!document.body) return null;
    dodajSloge();
    host = document.createElement("section");
    host.className = "ujzg";
    host.hidden = true;
    host.setAttribute("aria-label", "Simulirano obvestilo");
    document.body.appendChild(host);
    return host;
  }

  function zapri() {
    if (!host) return;
    host.hidden = true;
    host.innerHTML = "";
    document.documentElement.style.overflow = "";
    planiraj();
  }

  function prikazi(zapis) {
    var seznam = preberi().filter(function (x) { return x.id !== zapis.id; });
    shrani(seznam);
    var el = zagotoviHost();
    var accent = zapis.accent || "#6cae90";
    var rgb = zapis.accentRgb || "108,174,144";
    el.innerHTML =
      '<div class="ujzg__okno" role="dialog" aria-modal="true" aria-label="Mini obvestilo koraka" style="--ujzg-accent:' + esc(accent) + ";--ujzg-rgb:" + esc(rgb) + '">' +
      '<div class="ujzg__vrh"><span><strong>Obvestilo</strong><small>Simulacija načrtovanega koraka</small></span><button type="button" class="ujzg__zapri" data-ujzg-zapri aria-label="Zapri">×</button></div>' +
      '<button type="button" class="ujzg__obvestilo" data-ujzg-odpri="' + esc(zapis.id) + '">' +
      '<span class="ujzg__ikona" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg></span>' +
      '<span class="ujzg__vsebina"><span class="ujzg__app"><span>Opomini</span><span>zdaj</span></span><span class="ujzg__naslov">' + esc(zapis.notificationTitle || ("Čas je za " + zapis.order + ". korak")) + '</span><span class="ujzg__telo">' + esc(zapis.notificationBody || zapis.title || "Korak je pripravljen za pregled.") + "</span></span>" +
      "</button>" +
      '<p class="ujzg__namig">Dotaknite se obvestila za pregled koraka.</p></div>';
    el.hidden = false;
    document.documentElement.style.overflow = "hidden";
    planiraj();
  }

  function planiraj() {
    window.clearTimeout(timerId);
    timerId = null;
    if (host && !host.hidden) return;
    var seznam = preberi().slice().sort(function (a, b) { return a.prikaziOb - b.prikaziOb; });
    if (!seznam.length || !document.body) return;
    var prvi = seznam[0];
    var zamik = Number(prvi.prikaziOb) - Date.now();
    if (zamik <= 0) {
      prikazi(prvi);
      return;
    }
    timerId = window.setTimeout(planiraj, Math.min(zamik, 2147483647));
  }

  function init() {
    host = zagotoviHost();
    if (!host) return;
    host.addEventListener("click", function (event) {
      if (event.target === host || event.target.closest("[data-ujzg-zapri]")) {
        zapri();
        return;
      }
      var odpri = event.target.closest("[data-ujzg-odpri]");
      if (odpri) {
        var id = odpri.getAttribute("data-ujzg-odpri");
        window.location.href = "zacasno-obvestila.html#kaj-sledi-" + encodeURIComponent(id);
      }
    });
    window.addEventListener("storage", function (event) {
      if (event.key === STORAGE_KEY) planiraj();
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) planiraj();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && host && !host.hidden) zapri();
    });
    planiraj();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
