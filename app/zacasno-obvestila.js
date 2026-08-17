/* ==========================================================
   zacasno-obvestila.js

   Renderer + lokalno stanje za prototipni katalog "Začasno". Bere
   podatke izključno iz window.UJZacasnoObvestilaData (glej
   zacasno-obvestila-data.js). Iz istega zapisa izriše mini sistemsko
   obvestilo IN zaslon "Kaj sledi" – noben podatek se ne podvaja.

   Prototip: nobeno dejanje tukaj ne pošilja SMS-a/e-pošte, ne
   spreminja načrta, ne potrjuje koraka in ne piše v Supabase. V
   localStorage shrani samo čas začasne simulacije, da preživi menjavo strani.
   ============================================================ */
(function () {
  "use strict";

  var KORENSKA_OZNAKA = "data-zo-inicializirano";
  var SIM_STORAGE_KEY = "uj-zacasno-simulacije-v1";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- Majhne, lokalne ikone (dekorativne, brez odvisnosti) ---------- */
  var IKONE = {
    message:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-4.6 7.5 8.5 8.5 0 0 1-8.9-.7L3 21l1.9-4.5a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.3z"/></svg>',
    mail:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    document:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    scales:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="3"/><path d="M6.5 8a9.5 9.5 0 0 0 11 0"/><path d="M3 21h18"/><path d="M12 11v10"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    chevron:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    clock:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    mail:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    sliders:
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M8 14v6M16 4v6"/></svg>',
    checkCircle:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  };

  var DNEVI = ["Nedelja", "Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota"];
  var MESECI_KRATKI = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

  function formatDatumUraSl(iso) {
    if (!iso) return "Termin ni določen";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "Termin ni določen";
    var dan = DNEVI[d.getDay()];
    var datum = d.getDate() + ". " + MESECI_KRATKI[d.getMonth()] + ". " + d.getFullYear();
    var ura = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    return dan + ", " + datum + " ob " + ura;
  }

  function formatDatumKratkoSl(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    var ura = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    return d.getDate() + ". " + MESECI_KRATKI[d.getMonth()] + ". · " + ura;
  }

  function besediloKanalov(channels) {
    var ima = function (k) {
      return Array.isArray(channels) && channels.indexOf(k) >= 0;
    };
    var sms = ima("sms");
    var email = ima("email");
    if (sms && email) return "SMS in E-pošto";
    if (sms) return "SMS";
    if (email) return "E-pošto";
    return "—";
  }

  function stevecUvod(n) {
    return n + ". korak";
  }

  /* ---------- HTML: mini sistemsko obvestilo ---------- */
  function htmlMiniObvestilo(korak, platforma) {
    var ikona = IKONE[korak.icon] || IKONE.message;
    var opisSr = esc(korak.notification.title) + ". " + esc(korak.notification.body) + ". Simulacija sistemskega obvestila – nič ni bilo dejansko poslano.";
    if (platforma === "android") {
      return (
        '<button type="button" class="zo-mini zo-mini--android zo-tap" data-zo-odpri-sledi="' +
        esc(korak.id) +
        '" aria-label="' +
        opisSr +
        '">' +
        '<span class="zo-mini__ikona" style="color:' + esc(korak.accent) + ';background:rgba(' + esc(korak.accentRgb) + ',.12)" aria-hidden="true">' +
        ikona +
        "</span>" +
        '<span class="zo-mini__vsebina">' +
        '<span class="zo-mini__app-vrstica">Opomini · zdaj</span>' +
        '<span class="zo-mini__naslov">' + esc(korak.notification.title) + "</span>" +
        '<span class="zo-mini__telo">' + esc(korak.notification.body) + "</span>" +
        "</span>" +
        '<span class="zo-mini__desno">' + IKONE.chevron.replace('width="16" height="16"', 'width="16" height="16" class="zo-mini__android-chevron"') + "</span>" +
        "</button>"
      );
    }
    return (
      '<button type="button" class="zo-mini zo-mini--iphone zo-tap" data-zo-odpri-sledi="' +
      esc(korak.id) +
      '" aria-label="' +
      opisSr +
      '">' +
      '<span class="zo-mini__ikona" style="color:' + esc(korak.accent) + ';background:rgba(' + esc(korak.accentRgb) + ',.12)" aria-hidden="true">' +
      ikona +
      "</span>" +
      '<span class="zo-mini__vsebina">' +
      '<span class="zo-mini__app-vrstica"><span class="zo-mini__app">Opomini</span><span class="zo-mini__cas">zdaj</span></span>' +
      '<span class="zo-mini__naslov">' + esc(korak.notification.title) + "</span>" +
      '<span class="zo-mini__telo">' + esc(korak.notification.body) + "</span>" +
      "</span>" +
      "</button>"
    );
  }

  function htmlPlatformniPreklop(korakId, platforma) {
    return (
      '<div class="zo-platforme" role="radiogroup" aria-label="Platforma predogleda">' +
      '<button type="button" class="zo-platforme__gumb" role="radio" aria-checked="' + (platforma === "iphone" ? "true" : "false") + '" aria-pressed="' + (platforma === "iphone" ? "true" : "false") + '" data-zo-platforma="iphone" data-zo-platforma-korak="' + esc(korakId) + '">iPhone</button>' +
      '<button type="button" class="zo-platforme__gumb" role="radio" aria-checked="' + (platforma === "android" ? "true" : "false") + '" aria-pressed="' + (platforma === "android" ? "true" : "false") + '" data-zo-platforma="android" data-zo-platforma-korak="' + esc(korakId) + '">Android</button>' +
      "</div>"
    );
  }

  /* ---------- HTML: "Kaj sledi" (skelet – sporočilo se doda ločeno prek textContent) ---------- */
  function htmlVecInformacijVrstice(korak) {
    if (korak.kind === "manual_lawyer") {
      var h = korak.handoff || {};
      return (
        vrsticaVec("Odvetnik", h.lawyerName) +
        vrsticaVec("Paket", h.packageLabel) +
        vrsticaVec("Cena", h.priceLabel) +
        vrsticaVec("Način predaje", h.methodLabel)
      );
    }
    return (
      vrsticaVec("Ton sporočila", korak.toneLabel) +
      vrsticaVec("Nov rok plačila", korak.paymentDeadlineLabel) +
      vrsticaVec("Prejšnji korak", korak.previousStepLabel) +
      vrsticaVec("Razlog", korak.reason)
    );
  }

  function vrsticaVec(label, vrednost) {
    return (
      '<div class="zo-vec__vrstica"><span>' + esc(label) + "</span><span>" + esc(vrednost || "—") + "</span></div>"
    );
  }

  function htmlKajSledi(korak) {
    var ikona = IKONE[korak.icon] || IKONE.message;
    var jeRocni = korak.kind === "manual_lawyer";
    var sporociloNaslov = jeRocni ? "Sporočilo odvetniku" : "Celotno sporočilo dolžniku";
    var vecPodnapis = jeRocni ? "Odvetnik, paket in način predaje" : "Ton, rok plačila in podrobnosti koraka";
    var sledId = "zo-sledi-" + korak.id;
    var vecPanelId = "zo-vec-panel-" + korak.id;

    return (
      '<article class="zo-sledi" id="' + esc(sledId) + '" style="--zo-accent:' + esc(korak.accent) + ';--zo-accent-rgb:' + esc(korak.accentRgb) + '" tabindex="-1">' +
      '<header class="zo-sledi__glava">' +
      '<span class="zo-sledi__ikona-krog" aria-hidden="true">' + ikona + "</span>" +
      '<p class="zo-sledi__eyebrow">' + esc(stevecUvod(korak.order).toUpperCase()) + " · DANES</p>" +
      '<h2 class="zo-sledi__naslov">' + esc(korak.title) + "</h2>" +
      '<p class="zo-sledi__datum">' + esc(formatDatumUraSl(korak.scheduledAt)) + "</p>" +
      "</header>" +
      '<div class="zo-sledi__vsebina">' +
      '<div class="zo-sledi__povzetek">' +
      '<span class="zo-sledi__povzetek-ikona" aria-hidden="true">' + IKONE.info + "</span>" +
      "<p>" + esc(korak.summary) + "</p>" +
      "</div>" +
      '<div class="zo-kapsula">' +
      '<div class="zo-kapsula__osnovni">' +
      '<div class="zo-kapsula__polje"><span class="zo-kapsula__label">Dolžnik</span><span class="zo-kapsula__vrednost">' + esc(korak.debtor.displayName) + "</span></div>" +
      '<div class="zo-kapsula__polje"><span class="zo-kapsula__label">Dolg</span><span class="zo-kapsula__vrednost">' + esc(korak.debtor.amountLabel) + "</span></div>" +
      '<div class="zo-kapsula__polje"><span class="zo-kapsula__label">Račun</span><span class="zo-kapsula__vrednost">' + esc(korak.debtor.invoiceLabel) + "</span></div>" +
      "</div>" +
      "</div>" +
      '<div class="zo-vec">' +
      '<button type="button" class="zo-vec__gumb" aria-expanded="false" aria-controls="' + esc(vecPanelId) + '" data-zo-vec-gumb="' + esc(korak.id) + '">' +
      '<span class="zo-vec__ikona" aria-hidden="true">' + IKONE.sliders + "</span>" +
      '<span class="zo-vec__besedilo"><span class="zo-vec__naslov">Več informacij</span><span class="zo-vec__podnapis">' + esc(vecPodnapis) + "</span></span>" +
      '<span class="zo-vec__chevron" aria-hidden="true">' + IKONE.chevron + "</span>" +
      "</button>" +
      '<div class="zo-vec__panel" id="' + esc(vecPanelId) + '" hidden>' +
      htmlVecInformacijVrstice(korak) +
      "</div>" +
      "</div>" +
      htmlKanali(korak) +
      '<div class="zo-sporocilo">' +
      '<h3 class="zo-sporocilo__naslov">' + esc(sporociloNaslov) + "</h3>" +
      '<textarea class="zo-sporocilo__telo" data-zo-sporocilo-telo="' + esc(korak.id) + '" rows="1" spellcheck="true" aria-label="' + esc(sporociloNaslov) + '"></textarea>' +
      "</div>" +
      '<div class="zo-potem">' +
      '<span class="zo-potem__ikona" aria-hidden="true">' + IKONE.checkCircle + "</span>" +
      "<span>" + esc(korak.nextIfUnpaid) + "</span>" +
      "</div>" +
      '<div class="zo-akcije">' +
      '<button type="button" class="zo-akcija-glavna zo-tap" data-zo-akcija="' + esc(korak.id) + '">' + esc(korak.primaryActionLabel) + "</button>" +
      '<button type="button" class="zo-akcija-pozneje" data-zo-pozneje="' + esc(korak.id) + '">Pozneje</button>' +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function htmlKanali(korak) {
    var kanali = Array.isArray(korak.channels) ? korak.channels : [];
    var deli = [];
    if (kanali.indexOf("sms") >= 0) {
      deli.push('<span class="zo-kanal"><span aria-hidden="true">' + IKONE.message + '</span><strong>SMS</strong></span>');
    }
    if (kanali.indexOf("email") >= 0) {
      deli.push('<span class="zo-kanal"><span aria-hidden="true">' + IKONE.mail + '</span><strong>E-pošta</strong></span>');
    }
    var povezano = deli.join('<span class="zo-kanali__in">in</span>');
    return '<div class="zo-kanali"><span class="zo-kanali__uvod">' + (korak.kind === "manual_lawyer" ? "Paket bo pripravljen za" : "Dolžniku bo poslano prek") + '</span>' + povezano + '</div>';
  }

  /* ---------- HTML: ena skupina (mini + kaj sledi) ---------- */
  function htmlSkupina(korak, jeOdprta, platforma) {
    var telesnaOznaka = "zo-telo-" + korak.id;
    return (
      '<article class="zo-skupina' + (jeOdprta ? " zo-skupina--odprta" : "") + '" style="--zo-accent:' + esc(korak.accent) + ';--zo-accent-rgb:' + esc(korak.accentRgb) + '" data-zo-skupina="' + esc(korak.id) + '">' +
      '<div class="zo-skupina__vrh">' +
      '<button type="button" class="zo-skupina__glava zo-tap" aria-expanded="' + (jeOdprta ? "true" : "false") + '" aria-controls="' + telesnaOznaka + '" data-zo-preklopi="' + esc(korak.id) + '">' +
      '<span class="zo-skupina__krog" aria-hidden="true">' + korak.order + "</span>" +
      '<span class="zo-skupina__besedilo">' +
      '<span class="zo-skupina__naslov">' + esc(korak.title) + "</span>" +
      '<span class="zo-skupina__datum">' + esc(formatDatumKratkoSl(korak.scheduledAt)) + "</span>" +
      '<span class="zo-skupina__znacke"><span class="zo-znacka">Mini obvestilo</span><span class="zo-znacka">Kaj sledi</span></span>' +
      "</span>" +
      '<span class="zo-skupina__chevron" aria-hidden="true">' + IKONE.chevron + "</span>" +
      "</button>" +
      '<button type="button" class="zo-simuliraj zo-tap" data-zo-simuliraj="' + esc(korak.id) + '" aria-label="Simuliraj obvestilo za ' + esc(korak.title) + '"><span aria-hidden="true">●</span>Začasno</button>' +
      "</div>" +
      '<div class="zo-skupina__telo" id="' + telesnaOznaka + '"' + (jeOdprta ? "" : " hidden") + ">" +
      '<div class="zo-predogled zo-predogled--mini">' +
      '<h3 class="zo-predogled__naslov">Mini obvestilo</h3>' +
      '<p class="zo-predogled__opis">Kakor ga obrtnik najprej prejme na telefonu.</p>' +
      htmlPlatformniPreklop(korak.id, platforma) +
      '<div class="zo-mini-ovoj" data-zo-mini-ovoj="' + esc(korak.id) + '">' +
      htmlMiniObvestilo(korak, platforma) +
      "</div>" +
      "</div>" +
      '<div class="zo-odpri-sledi">' +
      '<span class="zo-odpri-sledi__ikona" aria-hidden="true">' + (IKONE[korak.icon] || IKONE.message) + "</span>" +
      '<span class="zo-odpri-sledi__vsebina"><strong>Kaj sledi</strong><small>Odprite celoten zaslon aktivnega koraka.</small></span>' +
      '<button type="button" class="zo-odpri-sledi__gumb zo-tap" data-zo-odpri-sledi="' + esc(korak.id) + '">Odpri pregled <span aria-hidden="true">→</span></button>' +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function htmlMiniSimulacija(korak, platforma) {
    return (
      '<div class="zo-sim-popup__glava">' +
      '<span><strong>Simulacija obvestila</strong><small>Takšno obvestilo bo obrtnik prejel na telefonu.</small></span>' +
      '<button type="button" class="zo-sim-popup__zapri zo-tap" data-zo-sim-zapri aria-label="Zapri mini obvestilo">×</button>' +
      "</div>" +
      '<div class="zo-mini-ovoj zo-sim-popup__mini">' + htmlMiniObvestilo(korak, platforma) + "</div>" +
      '<p class="zo-sim-popup__namig">Dotaknite se obvestila za pregled in pošiljanje koraka.</p>'
    );
  }

  /* ---------- Inicializacija ---------- */
  function init() {
    var koren = document.querySelector(".zacasno-obvestila");
    if (!koren || koren.hasAttribute(KORENSKA_OZNAKA)) return;
    koren.setAttribute(KORENSKA_OZNAKA, "1");

    var seznamEl = koren.querySelector("[data-zo-seznam]");
    if (!seznamEl) return;

    if (!window.UJZacasnoObvestilaData || typeof window.UJZacasnoObvestilaData.getKatalog !== "function") {
      seznamEl.innerHTML = '<p style="color:#9c302f;font-size:13px;">Podatkov ni bilo mogoče naložiti.</p>';
      return;
    }

    var katalog = window.UJZacasnoObvestilaData.getKatalog() || [];
    var odprtId = katalog.length ? katalog[0].id : null;
    var platformePoSkupini = Object.create(null);
    var detailKorakId = null;
    var detailVHistory = false;
    var sporocilaPoKoraku = Object.create(null);
    var katalogView = koren.querySelector("[data-zo-katalog-view]");
    var katalogTopbar = koren.querySelector("[data-zo-katalog-topbar]");
    var detailView = koren.querySelector("[data-zo-detail-view]");
    var detailSheet = koren.querySelector(".zo-detail-sheet");
    var detailContent = koren.querySelector("[data-zo-detail-content]");
    var detailNazaj = koren.querySelector("[data-zo-detail-nazaj]");
    var simPopup = koren.querySelector("[data-zo-sim-popup]");
    var simPopupVsebina = koren.querySelector("[data-zo-sim-popup-vsebina]");
    var simPopupKorakId = null;
    var simCakanja = Object.create(null);

    function najdiKorak(id) {
      for (var i = 0; i < katalog.length; i++) {
        if (katalog[i].id === id) return katalog[i];
      }
      return null;
    }

    function platformaZaSkupino(id) {
      return platformePoSkupini[id] === "android" ? "android" : "iphone";
    }

    function izrisi() {
      seznamEl.innerHTML = katalog
        .map(function (korak) {
          return htmlSkupina(korak, korak.id === odprtId, platformaZaSkupino(korak.id));
        })
        .join("");
      osveziVseSimGumbe();
    }

    function osveziSimGumb(id) {
      var gumb = seznamEl.querySelector('[data-zo-simuliraj="' + CSS.escape(id) + '"]');
      if (!gumb) return;
      var cakanje = simCakanja[id];
      if (!cakanje) {
        gumb.disabled = false;
        gumb.removeAttribute("aria-busy");
        gumb.innerHTML = '<span aria-hidden="true">●</span>Začasno';
        return;
      }
      var sekund = Math.max(0, Math.ceil((cakanje.prikaziOb - Date.now()) / 1000));
      gumb.disabled = true;
      gumb.setAttribute("aria-busy", "true");
      gumb.innerHTML = '<span aria-hidden="true">◷</span>' + sekund + " s";
    }

    function osveziVseSimGumbe() {
      Object.keys(simCakanja).forEach(osveziSimGumb);
    }

    function zapisSimulacije(id, cakanje) {
      var korak = najdiKorak(id);
      if (!korak) return null;
      return {
        id: id,
        prikaziOb: cakanje.prikaziOb,
        order: korak.order,
        title: korak.title,
        accent: korak.accent,
        accentRgb: korak.accentRgb,
        notificationTitle: korak.notification && korak.notification.title,
        notificationBody: korak.notification && korak.notification.body
      };
    }

    function shraniSimCakanja() {
      var zapisi = Object.keys(simCakanja).map(function (id) {
        return zapisSimulacije(id, simCakanja[id]);
      }).filter(Boolean);
      try {
        window.localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify(zapisi));
      } catch (e) {
        /* Simulacija deluje tudi, če brskalnik blokira localStorage. */
      }
    }

    function zazeniSimCakanje(id, prikaziOb, izShrambe) {
      if (!najdiKorak(id) || simCakanja[id]) return;
      var cakanje = { prikaziOb: Number(prikaziOb), intervalId: null };
      if (!isFinite(cakanje.prikaziOb)) return;
      simCakanja[id] = cakanje;

      function preveriCas() {
        if (!simCakanja[id]) return;
        if (Date.now() >= cakanje.prikaziOb) {
          window.clearInterval(cakanje.intervalId);
          delete simCakanja[id];
          shraniSimCakanja();
          osveziSimGumb(id);
          pokaziMiniSimulacijo(id);
          return;
        }
        osveziSimGumb(id);
      }

      cakanje.intervalId = window.setInterval(preveriCas, 1000);
      if (!izShrambe) shraniSimCakanja();
      preveriCas();
    }

    function naloziSimCakanja() {
      var zapisi = [];
      try {
        zapisi = JSON.parse(window.localStorage.getItem(SIM_STORAGE_KEY) || "[]");
      } catch (e) {
        zapisi = [];
      }
      if (!Array.isArray(zapisi)) return;
      zapisi.sort(function (a, b) { return Number(b.prikaziOb) - Number(a.prikaziOb); });
      zapisi.forEach(function (zapis) {
        if (zapis && zapis.id) zazeniSimCakanje(zapis.id, zapis.prikaziOb, true);
      });
    }

    function nastaviMiniSimulacijo(id) {
      if (!najdiKorak(id)) return;
      if (simCakanja[id]) {
        pokaziToast("Obvestilo za ta korak že čaka.");
        return;
      }
      zazeniSimCakanje(id, Date.now() + 60000, false);
      pokaziToast("Obvestilo bo prikazano čez približno 1 minuto.");
    }

    function vstaviSporocilo(kontekst, korak) {
      if (!kontekst || !korak) return;
      var sporociloEl = kontekst.querySelector('[data-zo-sporocilo-telo="' + CSS.escape(korak.id) + '"]');
      if (!sporociloEl) return;
      var imaPopravek = Object.prototype.hasOwnProperty.call(sporocilaPoKoraku, korak.id);
      sporociloEl.value = imaPopravek ? sporocilaPoKoraku[korak.id] : (korak.message || "");
      prilagodiVisinoSporocila(sporociloEl);
    }

    function prilagodiVisinoSporocila(sporociloEl) {
      if (!sporociloEl) return;
      var jeMobilni = window.matchMedia("(max-width: 520px)").matches;
      var velikost = jeMobilni ? 13.5 : 19;
      var najmanjsaVelikost = jeMobilni ? 10.5 : 13;
      var ciljnaVisina = jeMobilni ? 146 : 230;

      if (jeMobilni && document.activeElement === sporociloEl) {
        sporociloEl.style.fontSize = "16px";
        sporociloEl.style.height = "auto";
        sporociloEl.style.height = Math.max(108, sporociloEl.scrollHeight + 2) + "px";
        return;
      }

      sporociloEl.style.fontSize = velikost + "px";
      sporociloEl.style.height = "auto";
      while (sporociloEl.scrollHeight > ciljnaVisina && velikost > najmanjsaVelikost) {
        velikost = Math.max(najmanjsaVelikost, velikost - 0.5);
        sporociloEl.style.fontSize = velikost + "px";
      }
      sporociloEl.style.height = Math.max(jeMobilni ? 108 : 118, sporociloEl.scrollHeight + 2) + "px";
    }

    function prilagodiKratkePodatke(kontekst) {
      if (!kontekst) return;
      var vrednosti = kontekst.querySelectorAll(".zo-kapsula__vrednost");
      vrednosti.forEach(function (el) {
        el.style.fontSize = "";
        var slog = window.getComputedStyle(el);
        var velikost = parseFloat(slog.fontSize) || 16;
        var najmanjsaVelikost = window.matchMedia("(max-width: 520px)").matches ? 10.5 : 12;
        var lineHeight = parseFloat(slog.lineHeight) || (velikost * 1.2);
        var najvecDveVrstici = lineHeight * 2 + 1;

        while (el.scrollHeight > najvecDveVrstici && velikost > najmanjsaVelikost) {
          velikost = Math.max(najmanjsaVelikost, velikost - 0.5);
          el.style.fontSize = velikost + "px";
          lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || (velikost * 1.2);
          najvecDveVrstici = lineHeight * 2 + 1;
        }
      });
    }

    function odpriDetail(id, pushHistory) {
      var korak = najdiKorak(id);
      if (!korak || !katalogView || !detailView || !detailContent) return;
      odprtId = id;
      detailKorakId = id;
      detailContent.innerHTML = htmlKajSledi(korak);
      if (detailSheet) {
        detailSheet.style.setProperty("--zo-accent", korak.accent);
        detailSheet.style.setProperty("--zo-accent-rgb", korak.accentRgb);
        detailSheet.scrollTop = 0;
      }
      detailView.hidden = false;
      document.body.classList.add("zo-detail-aktiven");
      vstaviSporocilo(detailContent, korak);
      prilagodiKratkePodatke(detailContent);
      window.scrollTo({ top: 0, behavior: "auto" });
      var sledEl = detailContent.querySelector(".zo-sledi");
      if (sledEl) sledEl.focus({ preventScroll: true });
      if (pushHistory) {
        window.history.pushState({ zoDetail: id }, "", "#kaj-sledi-" + encodeURIComponent(id));
        detailVHistory = true;
      }
    }

    function zapriDetail(fromPopState) {
      if (!detailView || !katalogView || !detailContent) return;
      var prejsnjiId = detailKorakId;
      detailKorakId = null;
      detailVHistory = false;
      detailView.hidden = true;
      detailContent.innerHTML = "";
      document.body.classList.remove("zo-detail-aktiven");
      izrisi();
      window.requestAnimationFrame(function () {
        var sprozilec = prejsnjiId
          ? seznamEl.querySelector('[data-zo-odpri-sledi="' + CSS.escape(prejsnjiId) + '"]')
          : null;
        var skupina = prejsnjiId
          ? seznamEl.querySelector('[data-zo-skupina="' + CSS.escape(prejsnjiId) + '"]')
          : null;
        if (skupina) skupina.scrollIntoView({ block: "nearest", behavior: "auto" });
        if (sprozilec) sprozilec.focus({ preventScroll: true });
      });
      if (!fromPopState && window.location.hash.indexOf("#kaj-sledi-") === 0) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }

    function pokaziToast(besedilo) {
      var toast = koren.querySelector("[data-zo-toast]");
      if (!toast) return;
      toast.textContent = besedilo;
      toast.classList.add("zo-toast--vidno");
      window.clearTimeout(toast._zoTimer);
      toast._zoTimer = window.setTimeout(function () {
        toast.classList.remove("zo-toast--vidno");
      }, 2600);
    }

    function pokaziMiniSimulacijo(id) {
      var korak = najdiKorak(id);
      if (!korak || !simPopup || !simPopupVsebina) return;
      simPopupKorakId = id;
      simPopupVsebina.style.setProperty("--zo-accent", korak.accent);
      simPopupVsebina.style.setProperty("--zo-accent-rgb", korak.accentRgb);
      simPopupVsebina.innerHTML = htmlMiniSimulacija(korak, platformaZaSkupino(id));
      simPopup.hidden = false;
      simPopup.setAttribute("aria-hidden", "false");
      document.body.classList.add("zo-sim-popup-aktiven");
      window.requestAnimationFrame(function () {
        var obvestilo = simPopupVsebina.querySelector("[data-zo-odpri-sledi]");
        if (obvestilo) obvestilo.focus({ preventScroll: true });
      });
    }

    function zapriMiniSimulacijo(vrniFokus) {
      if (!simPopup || !simPopupVsebina) return;
      var prejsnjiId = simPopupKorakId;
      simPopupKorakId = null;
      simPopup.hidden = true;
      simPopup.setAttribute("aria-hidden", "true");
      simPopupVsebina.innerHTML = "";
      document.body.classList.remove("zo-sim-popup-aktiven");
      if (vrniFokus && prejsnjiId) {
        var gumb = seznamEl.querySelector('[data-zo-simuliraj="' + CSS.escape(prejsnjiId) + '"]');
        if (gumb) gumb.focus({ preventScroll: true });
      }
    }

    seznamEl.addEventListener("click", function (event) {
      var simulirajBtn = event.target.closest("[data-zo-simuliraj]");
      if (simulirajBtn) {
        nastaviMiniSimulacijo(simulirajBtn.getAttribute("data-zo-simuliraj"));
        return;
      }

      var preklopBtn = event.target.closest("[data-zo-preklopi]");
      if (preklopBtn) {
        var id = preklopBtn.getAttribute("data-zo-preklopi");
        odprtId = odprtId === id ? null : id;
        izrisi();
        var novaSkupina = seznamEl.querySelector('[data-zo-skupina="' + CSS.escape(id) + '"]');
        if (novaSkupina && odprtId === id) {
          novaSkupina.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        return;
      }

      var platformaBtn = event.target.closest("[data-zo-platforma]");
      if (platformaBtn) {
        var pKorakId = platformaBtn.getAttribute("data-zo-platforma-korak");
        var novaPlatforma = platformaBtn.getAttribute("data-zo-platforma");
        platformePoSkupini[pKorakId] = novaPlatforma;
        var ovojEl = seznamEl.querySelector('[data-zo-mini-ovoj="' + CSS.escape(pKorakId) + '"]');
        var korakZaPlatformo = najdiKorak(pKorakId);
        if (ovojEl && korakZaPlatformo) {
          ovojEl.innerHTML = htmlMiniObvestilo(korakZaPlatformo, novaPlatforma);
        }
        var gumbiPlatforme = seznamEl.querySelectorAll('[data-zo-platforma-korak="' + CSS.escape(pKorakId) + '"]');
        gumbiPlatforme.forEach(function (g) {
          var jeAktiven = g.getAttribute("data-zo-platforma") === novaPlatforma;
          g.setAttribute("aria-pressed", jeAktiven ? "true" : "false");
          g.setAttribute("aria-checked", jeAktiven ? "true" : "false");
        });
        return;
      }

      var miniBtn = event.target.closest("[data-zo-odpri-sledi]");
      if (miniBtn) {
        var miniKorakId = miniBtn.getAttribute("data-zo-odpri-sledi");
        odpriDetail(miniKorakId, true);
        return;
      }

      var vecBtn = event.target.closest("[data-zo-vec-gumb]");
      if (vecBtn) {
        var jeOdprtVec = vecBtn.getAttribute("aria-expanded") === "true";
        var panel = document.getElementById(vecBtn.getAttribute("aria-controls"));
        vecBtn.setAttribute("aria-expanded", jeOdprtVec ? "false" : "true");
        if (panel) panel.hidden = jeOdprtVec;
        return;
      }

      var akcijaBtn = event.target.closest("[data-zo-akcija]");
      if (akcijaBtn) {
        pokaziToast("Prototip: dejanje ni bilo poslano.");
        return;
      }

      var pozneje = event.target.closest("[data-zo-pozneje]");
      if (pozneje) {
        pokaziToast("V redu, korak lahko pregledate pozneje.");
        return;
      }
    });

    if (simPopup) {
      simPopup.addEventListener("click", function (event) {
        var odpriBtn = event.target.closest("[data-zo-odpri-sledi]");
        if (odpriBtn) {
          var id = odpriBtn.getAttribute("data-zo-odpri-sledi");
          zapriMiniSimulacijo(false);
          odpriDetail(id, true);
          return;
        }
        if (event.target === simPopup || event.target.closest("[data-zo-sim-zapri]")) {
          zapriMiniSimulacijo(true);
        }
      });
    }

    if (detailView) {
      detailView.addEventListener("focusin", function (event) {
        var sporociloEl = event.target.closest("[data-zo-sporocilo-telo]");
        if (!sporociloEl) return;
        window.requestAnimationFrame(function () {
          prilagodiVisinoSporocila(sporociloEl);
          if (detailSheet) detailSheet.scrollLeft = 0;
        });
      });

      detailView.addEventListener("focusout", function (event) {
        var sporociloEl = event.target.closest("[data-zo-sporocilo-telo]");
        if (!sporociloEl) return;
        window.requestAnimationFrame(function () {
          prilagodiVisinoSporocila(sporociloEl);
        });
      });

      detailView.addEventListener("input", function (event) {
        var sporociloEl = event.target.closest("[data-zo-sporocilo-telo]");
        if (!sporociloEl) return;
        var id = sporociloEl.getAttribute("data-zo-sporocilo-telo");
        sporocilaPoKoraku[id] = sporociloEl.value;
        prilagodiVisinoSporocila(sporociloEl);
      });

      detailView.addEventListener("click", function (event) {
        var vecBtn = event.target.closest("[data-zo-vec-gumb]");
        if (vecBtn) {
          var jeOdprtVec = vecBtn.getAttribute("aria-expanded") === "true";
          var panel = document.getElementById(vecBtn.getAttribute("aria-controls"));
          vecBtn.setAttribute("aria-expanded", jeOdprtVec ? "false" : "true");
          if (panel) panel.hidden = jeOdprtVec;
          return;
        }

        var akcijaBtn = event.target.closest("[data-zo-akcija]");
        if (akcijaBtn) {
          pokaziToast("Prototip: dejanje ni bilo poslano.");
          return;
        }

        var pozneje = event.target.closest("[data-zo-pozneje]");
        if (pozneje) pokaziToast("V redu, korak lahko pregledate pozneje.");
      });
    }

    if (detailNazaj) {
      detailNazaj.addEventListener("click", function () {
        if (detailVHistory) window.history.back();
        else zapriDetail(false);
      });
    }

    window.addEventListener("popstate", function () {
      if (detailKorakId) zapriDetail(true);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && simPopupKorakId) zapriMiniSimulacijo(true);
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) osveziVseSimGumbe();
    });

    window.addEventListener("resize", function () {
      if (!detailKorakId || !detailContent) return;
      var sporociloEl = detailContent.querySelector("[data-zo-sporocilo-telo]");
      prilagodiVisinoSporocila(sporociloEl);
      prilagodiKratkePodatke(detailContent);
    });

    izrisi();
    naloziSimCakanja();
    osveziVseSimGumbe();

    var hashPredpona = "#kaj-sledi-";
    if (window.location.hash.indexOf(hashPredpona) === 0) {
      var hashId = decodeURIComponent(window.location.hash.slice(hashPredpona.length));
      if (najdiKorak(hashId)) {
        window.setTimeout(function () { odpriDetail(hashId, false); }, 0);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
