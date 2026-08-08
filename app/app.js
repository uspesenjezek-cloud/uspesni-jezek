/* ==========================================================
   app.js - skupna JS logika za delovni portal (app/*.html)
   Trenutno vsebuje logiko za Kat. 1: Opozarjanje na neplačila.

   Podatki se shranjujejo v Supabase tabelo "zadeve" (glej
   sql/001_tabela_zadeve.sql za strukturo tabele in
   supabase-client.js za povezavo). Row Level Security v bazi
   poskrbi, da vsak obrtnik vidi/ureja/briše samo svoje zadeve -
   zato v poizvedbah spodaj ni treba ročno filtrirati po
   uporabniku, baza to naredi sama.
   ========================================================== */

/* Vrstni red statusov - od najbolj svežega do rešenega, točno tak, kot je
   zapisan v bazi (glej "check" v sql/001_tabela_zadeve.sql).
   "Pošlji naslednji opomin" premakne zadevo za eno mesto naprej po tem seznamu. */
const VRSTNI_RED_STATUSOV = [
  "Nov",
  "1. opomin poslan",
  "2. opomin poslan",
  "Zadnji opomin poslan",
  "Predano odvetniku",
  "Rešeno",
];

/* Poveže besedilo statusa (kot je shranjeno v bazi) z imenom CSS razreda
   za barvno značko - glej .zadeva__status--... v styles.css. */
const CSS_RAZRED_STATUSA = {
  Nov: "nov",
  "1. opomin poslan": "opomin-1",
  "2. opomin poslan": "opomin-2",
  "Zadnji opomin poslan": "opomin-zadnji",
  "Predano odvetniku": "odvetnik",
  Rešeno: "reseno",
};

/* Ključ za začasno shranjevanje podatkov 1. koraka obrazca v sessionStorage,
   dokler obrtnik ne konča 3. koraka - glej inicializirajNeplacila (shrani)
   in inicializirajPosiljanje (prebere in na koncu izbriše). */
const KLJUC_SEJE_KORAK1_PODATKI = "neplacilo-korak1-podatki";
/* Podatki 2. koraka (sporočilo + izbrani predlog/dodatki), dokler obrtnik
   ne konča 3. koraka (neplacila-posiljanje.html). */
const KLJUC_SEJE_KORAK2_PODATKI = "neplacilo-korak2-podatki";
/* Ključ za "opomniček", da naj se ob vrnitvi na neplacila.html prikaže
   sporočilo o uspešno dodani zadevi (glej pokaziUspesnoDodano spodaj) -
   ker se zadeva zdaj dejansko doda šele na 3. koraku, na prvi strani pa je
   takrat ne moremo več prikazati neposredno. */
const KLJUC_SEJE_ZADEVA_DODANA = "neplacilo-zadeva-dodana";
/* Uporabniško shranjeni predlogi sporočil (localStorage, po obrtniku).
   Kasneje lahko pride sinhronizacija s Supabase - glej modal Predogled. */
const KLJUC_MOJI_PREDLOGI_OSNOVA = "neplacilo-moji-predlogi";
/* Vrstni red (številke 1–9) in skrite predloge – localStorage po uporabniku. */
const KLJUC_PREDLOGI_NASTAVITVE_OSNOVA = "neplacilo-predlogi-nastavitve";

/* URL-ji treh korakov postopka (klikljiv kazalnik napredka). */
const URL_KORAKI_POSTOPKA = {
  1: "neplacila.html#obrazec",
  2: "neplacila-sporocilo.html",
  3: "neplacila-posiljanje.html",
};

/* Prebere sejo 2. koraka (osnutek ali potrjeno). */
function preberiKorak2Sejo() {
  try {
    const surovo = sessionStorage.getItem(KLJUC_SEJE_KORAK2_PODATKI);
    if (!surovo) return null;
    const podatki = JSON.parse(surovo);
    return podatki && typeof podatki === "object" ? podatki : null;
  } catch (_napaka) {
    return null;
  }
}

/* Najvišji dosežen korak: 2, če obstaja korak 1; 3 šele po potrditvi koraka 2. */
function ugotoviMaxDosezenKorak() {
  if (jeKorakIzpolnjen(2)) return 3;
  if (sessionStorage.getItem(KLJUC_SEJE_KORAK1_PODATKI)) return 2;
  return 1;
}

/* Korak je »izpolnjen« šele po uspešnem kliku Naprej (ne ob osnutku).
   Korak 1: zapis v sejo ob submitu obrazca.
   Korak 2: zapis z zastavico potrjen:true ob »Nadaljuj na pošiljanje«.
   Korak 3: po »Shrani zadevo« se seja počisti – krogec 3 v čarovniku ne ostane. */
function jeKorakIzpolnjen(stevilka) {
  if (stevilka === 1) return Boolean(sessionStorage.getItem(KLJUC_SEJE_KORAK1_PODATKI));
  if (stevilka === 2) {
    const podatki = preberiKorak2Sejo();
    return Boolean(podatki && podatki.potrjen === true);
  }
  return false;
}

/* Skupna definicija korakov za WizardProgressHeader (vse 3 strani postopka). */
const WIZARD_KORAKI = [
  {
    number: 1,
    shortLabel: "Dolžnik",
    fullTitle: "Vnos dolžnika",
    icon: "user-round",
  },
  {
    number: 2,
    shortLabel: "Sporočilo",
    fullTitle: "Vnos sporočila",
    icon: "message-square-text",
  },
  {
    number: 3,
    shortLabel: "Pošiljanje",
    fullTitle: "Pošiljanje",
    icon: "send",
  },
];

const SVG_WIZARD_IKONE = {
  "user-round":
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>',
  "message-square-text":
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M13 8H8"/><path d="M16 12H8"/></svg>',
  send:
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
};

function posodobiDebtStepMarker(el, stanje, stevilka) {
  // Številke vedno ostanejo številke (brez puščic, pik ali kljukic).
  const stevilkaEl = el.querySelector(".debt-step__number");
  if (stevilkaEl) stevilkaEl.textContent = String(stevilka);

  const meta = WIZARD_KORAKI[stevilka - 1];
  if (meta) {
    const statusBesedilo =
      stanje === "complete"
        ? "zaključeno"
        : stanje === "active"
          ? "trenutno"
          : "še ni začeto";
    el.setAttribute(
      "aria-label",
      stevilka + " od 3: " + meta.fullTitle + " – " + statusBesedilo
    );
  }
}

/**
 * Skupna komponenta WizardProgressHeader – koraki + glava trenutnega koraka.
 * Uporabi se na vseh treh straneh postopka (placeholder [data-wizard-progress-header]).
 */
function renderWizardProgressHeader(opcije) {
  const root = document.querySelector("[data-wizard-progress-header]");
  if (!root) return null;

  const fromAttr = Number(root.getAttribute("data-korak"));
  const currentStep =
    Number(opcije && opcije.currentStep) ||
    (Number.isInteger(fromAttr) && fromAttr >= 1 && fromAttr <= 3 ? fromAttr : 1);
  const draftSaved = !opcije || opcije.draftSaved !== false;
  const trenutni = WIZARD_KORAKI[currentStep - 1] || WIZARD_KORAKI[0];
  const ikonaSvg = SVG_WIZARD_IKONE[trenutni.icon] || SVG_WIZARD_IKONE["user-round"];

  const korakiHtml = WIZARD_KORAKI.map((korak) => {
    const href = URL_KORAKI_POSTOPKA[korak.number] || "#";
    return (
      '<a href="' +
      href +
      '" class="debt-step" data-korak="' +
      korak.number +
      '" aria-label="' +
      korak.number +
      " od 3: " +
      korak.fullTitle +
      '">' +
      '<span class="debt-step__content">' +
      '<span class="debt-step__number" aria-hidden="true">' +
      korak.number +
      "</span>" +
      '<span class="debt-step__label">' +
      korak.shortLabel +
      "</span>" +
      "</span>" +
      '<span class="debt-step__line" aria-hidden="true"></span>' +
      "</a>"
    );
  }).join("");

  root.innerHTML =
    '<nav class="debt-stepper" data-koraki-postopek aria-label="Koraki postopka">' +
    korakiHtml +
    "</nav>" +
    '<header class="korak-glava wizard-current-header">' +
    '<div class="korak-glava__levo">' +
    '<span class="korak-glava__ikona" aria-hidden="true">' +
    ikonaSvg +
    "</span>" +
    '<div class="korak-glava__besedilo">' +
    '<p class="korak-glava__meta">Korak ' +
    currentStep +
    " od 3</p>" +
    '<h2 class="korak-glava__naslov">' +
    trenutni.fullTitle +
    "</h2>" +
    "</div>" +
    "</div>" +
    (draftSaved
      ? '<p class="korak-glava__osnutek" id="osnutek-status" role="status" aria-live="polite">Osnutek shranjen</p>'
      : "") +
    "</header>";

  return root;
}

function inicializirajWizardProgressHeader(trenutniKorak) {
  const korak = Number(trenutniKorak) || 1;
  // Oznaka kot doslej na koraku 1 – vedno vidna; ni nove poslovne logike.
  renderWizardProgressHeader({ currentStep: korak, draftSaved: true });
  inicializirajKorakePostopka(korak);
}

/* ---------- Skupni potrditveni / opozorilni modal (namesto confirm/alert) ---------- */

const SVG_POTRDI_IKONA_TURKIZ =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>';
const SVG_POTRDI_IKONA_NEVARNO =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';

let ujPotrdiZakljuci = null;

function zagotoviPotrditveniModal() {
  let modal = document.getElementById("uj-potrdi-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "uj-potrdi-modal";
  modal.className = "osnutek-modal";
  modal.hidden = true;
  modal.innerHTML =
    '<button type="button" class="osnutek-modal__backdrop" id="uj-potrdi-backdrop" aria-label="Zapri"></button>' +
    '<div class="osnutek-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="uj-potrdi-naslov" aria-describedby="uj-potrdi-opis">' +
    '<div class="osnutek-modal__vrh">' +
    '<span class="osnutek-modal__ikona" id="uj-potrdi-ikona" aria-hidden="true"></span>' +
    '<button type="button" class="osnutek-modal__zapri" id="uj-potrdi-zapri" aria-label="Zapri">' +
    '<span aria-hidden="true">×</span></button></div>' +
    '<h2 class="osnutek-modal__naslov" id="uj-potrdi-naslov"></h2>' +
    '<p class="osnutek-modal__opis" id="uj-potrdi-opis"></p>' +
    '<div class="osnutek-modal__akcije" id="uj-potrdi-akcije">' +
    '<button type="button" class="osnutek-modal__preklici" id="uj-potrdi-preklici">Prekliči</button>' +
    '<button type="button" class="osnutek-modal__potrdi" id="uj-potrdi-potrdi">Potrdi</button>' +
    "</div></div>";
  document.body.appendChild(modal);
  return modal;
}

/**
 * Skupno potrditveno / opozorilno okno – vedno to, nikoli window.confirm/alert.
 * Primer: await potrdiVprasanje({ naslov, opis, potrdiBesedilo, stil: "primary"|"nevarno" })
 * Za samo opozorilo: samoEnGumb: true (en gumb »V redu«).
 * @returns {Promise<boolean>} true = potrjeno / V redu; false = preklic
 */
function potrdiVprasanje(opcije) {
  const nastavitve = opcije || {};
  const naslov = nastavitve.naslov || "Potrditev";
  const opis = nastavitve.opis || "";
  const potrdiBesedilo = nastavitve.potrdiBesedilo || "Potrdi";
  const prekliciBesedilo = nastavitve.prekliciBesedilo || "Prekliči";
  const stil = nastavitve.stil === "nevarno" ? "nevarno" : "primary";
  const samoEnGumb = Boolean(nastavitve.samoEnGumb);

  const modal = zagotoviPotrditveniModal();
  const naslovEl = document.getElementById("uj-potrdi-naslov");
  const opisEl = document.getElementById("uj-potrdi-opis");
  const ikonaEl = document.getElementById("uj-potrdi-ikona");
  const akcijeEl = document.getElementById("uj-potrdi-akcije");
  const preklici = document.getElementById("uj-potrdi-preklici");
  const potrdi = document.getElementById("uj-potrdi-potrdi");
  const zapri = document.getElementById("uj-potrdi-zapri");
  const backdrop = document.getElementById("uj-potrdi-backdrop");

  if (!naslovEl || !opisEl || !potrdi) return Promise.resolve(false);

  if (typeof ujPotrdiZakljuci === "function") {
    ujPotrdiZakljuci(false);
  }

  naslovEl.textContent = naslov;
  opisEl.textContent = opis;
  opisEl.hidden = !opis;
  potrdi.textContent = potrdiBesedilo;
  if (preklici) {
    preklici.textContent = prekliciBesedilo;
    preklici.hidden = samoEnGumb;
  }
  if (akcijeEl) {
    akcijeEl.classList.toggle("osnutek-modal__akcije--en-gumb", samoEnGumb);
  }
  if (ikonaEl) {
    ikonaEl.className =
      "osnutek-modal__ikona" + (stil === "nevarno" ? "" : " osnutek-modal__ikona--turkiz");
    ikonaEl.innerHTML = stil === "nevarno" ? SVG_POTRDI_IKONA_NEVARNO : SVG_POTRDI_IKONA_TURKIZ;
  }
  potrdi.className =
    "osnutek-modal__potrdi" + (stil === "primary" ? " osnutek-modal__potrdi--primary" : "");

  return new Promise((resolve) => {
    function zakljuci(odgovor) {
      if (ujPotrdiZakljuci !== zakljuci) return;
      modal.hidden = true;
      document.removeEventListener("keydown", obEscape);
      if (preklici) preklici.removeEventListener("click", obPreklici);
      potrdi.removeEventListener("click", obPotrdi);
      if (zapri) zapri.removeEventListener("click", obPreklici);
      if (backdrop) backdrop.removeEventListener("click", obPreklici);
      ujPotrdiZakljuci = null;
      resolve(odgovor);
    }

    function obPreklici() {
      zakljuci(false);
    }

    function obPotrdi() {
      zakljuci(true);
    }

    function obEscape(dogodek) {
      if (dogodek.key === "Escape" && !modal.hidden) {
        dogodek.preventDefault();
        zakljuci(samoEnGumb ? true : false);
      }
    }

    ujPotrdiZakljuci = zakljuci;
    if (preklici) preklici.addEventListener("click", obPreklici);
    potrdi.addEventListener("click", obPotrdi);
    if (zapri) zapri.addEventListener("click", obPreklici);
    if (backdrop) backdrop.addEventListener("click", obPreklici);
    document.addEventListener("keydown", obEscape);

    modal.hidden = false;
    potrdi.focus();
  });
}

/* Gumb »Izbriši osnutek« – uporabi skupni potrditveni modal. */
function inicializirajIzbrisOsnutka() {
  const gumb = document.getElementById("gumb-izbrisi-osnutek");
  if (!gumb) return;

  gumb.addEventListener("click", async () => {
    const potrjeno = await potrdiVprasanje({
      naslov: "Izbrišem ta osnutek?",
      opis: "Vneseni podatki in sporočilo bodo odstranjeni. Tega dejanja ni mogoče razveljaviti.",
      potrdiBesedilo: "Izbriši osnutek",
      stil: "nevarno",
    });
    if (!potrjeno) return;
    sessionStorage.removeItem(KLJUC_SEJE_KORAK1_PODATKI);
    sessionStorage.removeItem(KLJUC_SEJE_KORAK2_PODATKI);
    if (window.UJOpominNacrt && typeof window.UJOpominNacrt.pocistiOsnutek === "function") {
      window.UJOpominNacrt.pocistiOsnutek();
    } else {
      sessionStorage.removeItem("neplacilo-korak3-nacrt");
    }
    window.location.href = "neplacila.html#seznam";
  });
}

/* Placeholder kartice »Kmalu na voljo« – stilizirano opozorilo namesto alert(). */
function inicializirajKmaluNaVoljo() {
  document.querySelectorAll(".kartica--placeholder").forEach((gumb) => {
    gumb.addEventListener("click", () => {
      potrdiVprasanje({
        naslov: "Kmalu na voljo",
        potrdiBesedilo: "V redu",
        samoEnGumb: true,
        stil: "primary",
      });
    });
  });
}

/* Oznaci korake (current/complete/upcoming) in omogoči klik na že dosežene. */
function inicializirajKorakePostopka(trenutniKorak) {
  const vsebnik = document.querySelector("[data-koraki-postopek]");
  if (!vsebnik) return;

  const maxDosezen = Math.max(ugotoviMaxDosezenKorak(), trenutniKorak);
  const jeDebtStepper = vsebnik.classList.contains("debt-stepper");

  vsebnik.querySelectorAll("[data-korak]").forEach((el) => {
    const n = Number(el.dataset.korak);
    if (!Number.isInteger(n) || n < 1 || n > 3) return;

    el.classList.remove(
      "is-current",
      "is-complete",
      "is-upcoming",
      "is-clickable",
      "debt-step--complete",
      "debt-step--active",
      "debt-step--upcoming"
    );
    el.removeAttribute("aria-current");
    el.removeAttribute("aria-disabled");
    el.removeAttribute("tabindex");
    if (URL_KORAKI_POSTOPKA[n]) el.setAttribute("href", URL_KORAKI_POSTOPKA[n]);

    if (jeDebtStepper) {
      // Aktivno = trenutni korak (obarva besedilo).
      // Izpolnjeno = podatki v seji (obarva krogec) – ločeno od aktivnega.
      const jeTrenutni = n === trenutniKorak;
      const jeIzpolnjen = jeKorakIzpolnjen(n);
      const jeDosegljiv = n <= maxDosezen;

      if (jeTrenutni) {
        el.classList.add("debt-step--active");
        el.setAttribute("aria-current", "step");
        el.setAttribute("aria-disabled", "true");
        el.setAttribute("tabindex", "-1");
      }
      if (jeIzpolnjen) {
        el.classList.add("debt-step--complete");
        if (!jeTrenutni) el.classList.add("is-clickable");
      } else if (!jeTrenutni) {
        el.classList.add("debt-step--upcoming");
        if (jeDosegljiv) {
          el.classList.add("is-clickable");
        } else {
          el.setAttribute("aria-disabled", "true");
          el.setAttribute("tabindex", "-1");
        }
      }

      const stanje = jeIzpolnjen ? "complete" : jeTrenutni ? "active" : "upcoming";
      posodobiDebtStepMarker(el, stanje, n);
      return;
    }

    if (n === trenutniKorak) {
      el.classList.add("is-current");
      el.setAttribute("aria-current", "step");
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("tabindex", "-1");
    } else if (n <= maxDosezen) {
      el.classList.add("is-complete", "is-clickable");
    } else {
      el.classList.add("is-upcoming");
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("tabindex", "-1");
    }
  });

  vsebnik.addEventListener("click", (dogodek) => {
    const povezava = dogodek.target.closest("[data-korak]");
    if (!povezava || !vsebnik.contains(povezava)) return;
    const n = Number(povezava.dataset.korak);
    if (n === trenutniKorak || n > maxDosezen) {
      dogodek.preventDefault();
    }
  });
}

/* Poveže vsak status z eno od 3 kategorij za "semafor" na vrhu strani
   (glej .zadeve-semafor v styles.css). Semafor služi tudi kot filter za
   seznam zadev spodaj - glej aktivnaKategorija v inicializirajNeplacila. */
const KATEGORIJA_SEMAFORJA_PO_STATUSU = {
  Nov: "v-teku",
  "1. opomin poslan": "v-teku",
  "2. opomin poslan": "v-teku",
  "Zadnji opomin poslan": "v-teku",
  "Predano odvetniku": "odvetnik",
  Rešeno: "reseno",
};

/* ---------- Pomožne funkcije ---------- */

function formatirajZnesek(znesek) {
  return Number(znesek).toFixed(2) + " €";
}

function formatirajDatum(datumBesedilo) {
  if (!datumBesedilo) return "";
  const datum = new Date(datumBesedilo);
  if (Number.isNaN(datum.getTime())) return datumBesedilo;
  return datum.toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/* Iz poti do priloge v Storage (glej nalozitEnoPrilogo spodaj, oblika
   "<id-obrtnika>/<čas>-<naključni-niz>-<izvirno-ime>") izlušči samo
   izvirno ime datoteke, da je obrtniku prikaz razumljiv. */
function imeDatotekeIzPoti(pot) {
  const zadnjiDel = pot.split("/").pop() || pot;
  return zadnjiDel.replace(/^\d+-[a-z0-9]+-/i, "");
}

function jePdfDatoteka(pot) {
  return pot.toLowerCase().endsWith(".pdf");
}

function naslednjiStatus(trenutniStatus) {
  const indeks = VRSTNI_RED_STATUSOV.indexOf(trenutniStatus);
  if (indeks === -1 || indeks >= VRSTNI_RED_STATUSOV.length - 1) {
    return trenutniStatus;
  }
  return VRSTNI_RED_STATUSOV[indeks + 1];
}

/* ---------- Logika strani neplacila.html ---------- */

function inicializirajNeplacila() {
  const obrazec = document.getElementById("obrazec-neplacilo");
  const seznamVsebina = document.getElementById("seznam-zadev-vsebina");
  const napaka = document.getElementById("splosna-napaka");
  const sporociloDodano = document.getElementById("zadeva-dodana-sporocilo");
  const semaforKartice = document.querySelectorAll(".zadeve-semafor__kartica");
  const semaforVsebnik = document.querySelector(".zadeve-semafor__kartice");
  const gumbPrilogaDatoteka = document.getElementById("priloga-datoteka");
  const gumbPrilogaFotoaparat = document.getElementById("priloga-fotoaparat");
  const prilogaGumbiVsebnik = document.getElementById("priloga-gumbi");
  const prilogaSeznamVsebnik = document.getElementById("priloga-seznam");
  const prilogaLimitOpozorilo = document.getElementById("priloga-limit-opozorilo");
  const lightbox = document.getElementById("lightbox");
  const lightboxSlika = document.getElementById("lightbox-slika");
  const lightboxZapri = document.getElementById("lightbox-zapri");
  let casovnikSporocilaSkritje = null;
  // Datoteke (slike/PDF-ji), ki jih je obrtnik izbral za priloge k zadevi -
  // dejansko se naložijo v Supabase Storage šele ob oddaji obrazca.
  /* Priloge za pošiljanje: { file, origin: "ocr" | "manual_attachment" }. */
  let izbranePrilogeDatoteke = [];
  let ocrSourceFile = null;
  let messageAttachments = [];
  let shouldSendAttachment = true;
  const NAJVEC_PRILOG = 6;
  const NAJVECJA_VELIKOST_PRILOGE_B = 10 * 1024 * 1024; // 10 MB - enako kot v sql/003

  if (!obrazec || !seznamVsebina) {
    // Ta stran ne vsebuje obrazca/seznama za neplačila - ne naredi ničesar.
    return;
  }

  inicializirajWizardProgressHeader(1);
  inicializirajIzbrisOsnutka();

  // Ob vrnitvi s kasnejšega koraka napolni obrazec iz seje (brez prilog).
  try {
    const osnutekKorak1Json = sessionStorage.getItem(KLJUC_SEJE_KORAK1_PODATKI);
    if (osnutekKorak1Json) {
      const osnutek = JSON.parse(osnutekKorak1Json);
      const nastavi = (name, vrednost) => {
        const polje = obrazec.elements.namedItem(name);
        if (polje && vrednost != null && vrednost !== "") polje.value = vrednost;
      };
      nastavi("ime", osnutek.imeDolznika);
      nastavi("telefon", osnutek.telefonDolznika);
      nastavi("email", osnutek.emailDolznika);
      nastavi("znesek", osnutek.znesek != null ? String(osnutek.znesek) : "");
      nastavi("opis", osnutek.opisDolga);
      nastavi("datumIzdaje", osnutek.datumIzdajeRacuna);
      nastavi("datum", osnutek.datumZapadlosti);
      nastavi("stevilkaRacuna", osnutek.stevilkaRacuna);
    }
  } catch (_napaka) {
    /* prezri okvarjen osnutek */
  }

  // Vse zadeve, kot so bile nazadnje naložene iz baze (za filtriranje brez
  // novega klica na bazo) in trenutno izbrana kategorija semaforja (null =
  // filter ni aktiven, prikažemo vse zadeve).
  let vseZadeve = [];
  let aktivnaKategorija = null;

  function pokaziNapako(besedilo, tehnicniPodatki) {
    napaka.textContent = tehnicniPodatki
      ? besedilo + " (" + tehnicniPodatki + ")"
      : besedilo;
    napaka.hidden = false;
    // Opozorilo je na vrhu strani (glej #splosna-napaka v HTML) - če je
    // obrtnik s pogledom pri gumbu na dnu dolgega obrazca, ga sicer sploh
    // ne bi opazil in bi izgledalo, kot da se ob kliku "nič ne zgodi".
    napaka.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function skrijNapako() {
    napaka.hidden = true;
  }

  /* Prikaže kratko "lebdeče" potrditveno sporočilo na sredini zaslona (glej
     .obrazec__sporocilo v styles.css - position: fixed) - to je obrtniku
     edini takojšnji znak, da je bila zadeva shranjena, saj je pri prihodu
     preko "Dodaj nov račun" (#obrazec) seznam zadev skrit (glej
     prilagodiPrikazGledeNaFragment). Ker je sporočilo pripeto na zaslon in
     ne na mesto v obrazcu, je vidno tudi, če je gumb "Dodaj zadevo" sicer
     nizko na dolgi strani. Trajanje časovnika (1000 ms) mora ustrezati
     trajanju CSS animacije "obrazec-sporocilo-lebdi", ki sama poskrbi za
     pojav, premik navzgor in zbledenje. */
  function pokaziUspesnoDodano() {
    if (!sporociloDodano) return;

    clearTimeout(casovnikSporocilaSkritje);

    sporociloDodano.hidden = false;
    sporociloDodano.classList.remove("obrazec__sporocilo--prikazano");
    // Prisili preračun stila, da se animacija zažene znova tudi, če je
    // sporočilo pravkar (še) izginjalo od prejšnjega dodajanja.
    void sporociloDodano.offsetWidth;
    sporociloDodano.classList.add("obrazec__sporocilo--prikazano");

    casovnikSporocilaSkritje = setTimeout(() => {
      sporociloDodano.hidden = true;
      sporociloDodano.classList.remove("obrazec__sporocilo--prikazano");
    }, 1000);
  }

  /* Oblikuje velikost datoteke za kompaktni prikaz pod gumboma priloge. */
  function formatirajVelikostDatoteke(bajti) {
    if (!Number.isFinite(bajti) || bajti < 0) return "";
    if (bajti < 1024) return bajti + " B";
    if (bajti < 1024 * 1024) return Math.round(bajti / 1024) + " KB";
    return (bajti / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
  }

  const racunPrazno = document.getElementById("racun-posiljanje-prazno");
  const racunPolno = document.getElementById("racun-posiljanje-polno");
  const racunSeznam = document.getElementById("racun-posiljanje-seznam");
  const racunDodajSe = document.getElementById("racun-posiljanje-dodaj-se");
  const racunStikalo = document.getElementById("racun-posiljanje-stikalo");
  const racunStikaloPomoc = document.getElementById("racun-posiljanje-stikalo-pomoc");
  const prilogaLimitOpozoriloEl = document.getElementById("priloga-limit-opozorilo");

  function sinhronizirajPrilogeZaNalaganje() {
    izbranePrilogeDatoteke = messageAttachments.map((p) => p.file);
  }

  function besediloIzvoraPriloge(izvor) {
    return izvor === "ocr"
      ? "Dodano pri samodejnem vnosu podatkov"
      : "Dodano samo kot priloga";
  }

  function izrisiIzbranePriloge() {
    sinhronizirajPrilogeZaNalaganje();
    const ima = messageAttachments.length > 0;
    const dosezenaMeja = messageAttachments.length >= NAJVEC_PRILOG;
    if (racunPrazno) racunPrazno.hidden = ima;
    if (racunPolno) racunPolno.hidden = !ima;
    if (racunDodajSe) racunDodajSe.hidden = dosezenaMeja;
    if (prilogaLimitOpozoriloEl) prilogaLimitOpozoriloEl.hidden = !dosezenaMeja;
    if (racunSeznam) {
      racunSeznam.innerHTML = "";
      messageAttachments.forEach((priloga, indeks) => {
        const vrstica = document.createElement("div");
        vrstica.className = "racun-posiljanje__kartica";
        vrstica.setAttribute("role", "listitem");

        const datotekaBlok = document.createElement("div");
        datotekaBlok.className = "racun-posiljanje__datoteka";
        datotekaBlok.innerHTML =
          '<span class="racun-posiljanje__datoteka-ikona" aria-hidden="true">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/></svg>' +
          "</span>";

        const meta = document.createElement("div");
        meta.className = "racun-posiljanje__datoteka-meta";
        const ime = document.createElement("p");
        ime.className = "racun-posiljanje__datoteka-ime";
        ime.textContent = priloga.file.name;
        const izvor = document.createElement("p");
        izvor.className = "racun-posiljanje__datoteka-izvor";
        izvor.textContent = besediloIzvoraPriloge(priloga.origin);
        const velikost = document.createElement("p");
        velikost.className = "racun-posiljanje__datoteka-velikost";
        velikost.textContent = formatirajVelikostDatoteke(priloga.file.size);
        meta.appendChild(ime);
        meta.appendChild(izvor);
        if (velikost.textContent) meta.appendChild(velikost);
        datotekaBlok.appendChild(meta);

        const odstrani = document.createElement("button");
        odstrani.type = "button";
        odstrani.className = "racun-posiljanje__akcija racun-posiljanje__akcija--odstrani";
        odstrani.setAttribute("aria-label", "Odstrani " + priloga.file.name);
        odstrani.textContent = "Odstrani";
        odstrani.addEventListener("click", () => {
          messageAttachments.splice(indeks, 1);
          izrisiIzbranePriloge();
        });

        vrstica.appendChild(datotekaBlok);
        vrstica.appendChild(odstrani);
        racunSeznam.appendChild(vrstica);
      });
    }
    if (racunStikalo) racunStikalo.checked = shouldSendAttachment;
    if (racunStikaloPomoc) {
      const vec = messageAttachments.length > 1;
      racunStikaloPomoc.textContent = shouldSendAttachment
        ? vec
          ? "Računi bodo dodani končnemu sporočilu."
          : "Račun bo dodan končnemu sporočilu."
        : vec
          ? "Računi ostanejo shranjeni, vendar ne bodo poslani."
          : "Račun ostane shranjen, vendar ne bo poslan.";
    }
  }

  function dodajIzbranePriloge(datoteke, izvor) {
    const seznam = Array.from(datoteke || []);
    if (!seznam.length) return;
    const izvorPriloge = izvor || "manual_attachment";
    for (const datoteka of seznam) {
      if (messageAttachments.length >= NAJVEC_PRILOG) break;
      messageAttachments.push({ file: datoteka, origin: izvorPriloge });
    }
    if (seznam.length) shouldSendAttachment = true;
    izrisiIzbranePriloge();
  }

  function pocistiIzbranePriloge() {
    messageAttachments = [];
    shouldSendAttachment = true;
    izbranePrilogeDatoteke = [];
    if (gumbPrilogaDatoteka) gumbPrilogaDatoteka.value = "";
    if (gumbPrilogaFotoaparat) gumbPrilogaFotoaparat.value = "";
    izrisiIzbranePriloge();
  }

  /* Spodnji widget: samo priloga – BREZ OCR. */
  if (gumbPrilogaDatoteka) {
    gumbPrilogaDatoteka.addEventListener("change", () => {
      if (gumbPrilogaDatoteka.files && gumbPrilogaDatoteka.files.length) {
        dodajIzbranePriloge(gumbPrilogaDatoteka.files, "manual_attachment");
      }
      gumbPrilogaDatoteka.value = "";
    });
  }
  if (gumbPrilogaFotoaparat) {
    gumbPrilogaFotoaparat.addEventListener("change", () => {
      if (gumbPrilogaFotoaparat.files && gumbPrilogaFotoaparat.files.length) {
        dodajIzbranePriloge(gumbPrilogaFotoaparat.files, "manual_attachment");
      }
      gumbPrilogaFotoaparat.value = "";
    });
  }

  document.querySelectorAll("[data-priloga-uvozi]").forEach((gumb) => {
    gumb.addEventListener("click", () => {
      if (gumbPrilogaDatoteka) gumbPrilogaDatoteka.click();
    });
  });
  document.querySelectorAll("[data-priloga-slikaj]").forEach((gumb) => {
    gumb.addEventListener("click", () => {
      if (gumbPrilogaFotoaparat) gumbPrilogaFotoaparat.click();
    });
  });
  if (racunStikalo) {
    racunStikalo.addEventListener("change", () => {
      shouldSendAttachment = racunStikalo.checked;
      izrisiIzbranePriloge();
    });
  }
  izrisiIzbranePriloge();

  /* Preklop "Podjetje / Fizična oseba" je za zdaj samo vizualen (glej
     pogovor z uporabnikom) - ne shranjuje se nikamor, samo poudari
     izbrano možnost. */
  document.querySelectorAll(".tip-dolznika-preklop__gumb").forEach((gumbPreklopa) => {
    gumbPreklopa.addEventListener("click", () => {
      document
        .querySelectorAll(".tip-dolznika-preklop__gumb")
        .forEach((g) => g.classList.remove("tip-dolznika-preklop__gumb--aktiven"));
      gumbPreklopa.classList.add("tip-dolznika-preklop__gumb--aktiven");
    });
  });

  /* ---------- Samodejni vnos podatkov iz računa (OCR) ----------
     Zgornji widget (#ai-zajem): bere račun in izpolni obrazec.
     Slika/PDF gre na /api/citaj-racun - ključ je samo na strežniku. */
  const aiZajemZacetek = document.getElementById("ai-zajem-zacetek");
  const aiZajemUspehBlok = document.getElementById("ai-zajem-uspeh");
  const aiZajemUspehDatoteka = document.getElementById("ai-zajem-uspeh-datoteka");
  const aiZajemGumbSlikaj = document.getElementById("ai-zajem-gumb-slikaj");
  const aiZajemGumbUvozi = document.getElementById("ai-zajem-gumb-uvozi");
  const aiZajemGumbPonovi = document.getElementById("ai-zajem-gumb-ponovi");
  const aiZajemDatoteka = document.getElementById("ai-zajem-datoteka");
  const aiZajemFotoaparat = document.getElementById("ai-zajem-fotoaparat");
  const aiZajemNaslov = document.getElementById("ai-zajem-naslov");
  const aiZajemOpis = document.getElementById("ai-zajem-opis");
  const aiZajemIkona = document.getElementById("ai-zajem-ikona");
  const aiZajemStatus = document.getElementById("ai-zajem-status");
  const aiZajemStatusBesedilo = document.getElementById("ai-zajem-status-besedilo");
  const aiZajemSpinner = aiZajemStatus ? aiZajemStatus.querySelector(".ai-zajem__spinner") : null;
  const NAJVECJA_VELIKOST_AI_PDF_B = 3 * 1024 * 1024; // 3 MB - glej api/citaj-racun.js
  const SVG_AI_SKEN =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="8" x="7" y="8" rx="1"/></svg>';
  const AI_BESEDILO = {
    naslov: "Samodejno vnesite podatke",
    opis: "Slikajte ali uvozite račun in podatke bomo prepisali v spodnja polja.",
    nalaganjeNaslov: "Beremo podatke z računa",
    nalaganjeOpis: "To običajno traja le nekaj trenutkov.",
    napaka: "Poskusite račun slikati ali uvoziti znova.",
  };
  let aiZajemUspeh = false;
  let aiZajemVTehniku = false;
  let aiZajemPreskociNaslednjoPotrditev = false;

  /* Zmanjša sliko na največ 1600 px na daljši stranici in jo ponovno
     zakodira kot JPEG (kakovost 0.82) - fotografije s telefona so lahko
     8-12 MB, kar bi skupaj z base64 pretvorbo (+33 %) zlahka preseglo
     Vercel-ovo trdo omejitev velikosti telesa zahteve za serverless funkcije
     (~4.5 MB) in po nepotrebnem podražilo/upočasnilo AI klic. */
  function stisniSlikoZaAi(datoteka, najvecjaStranica = 1600, kakovost = 0.82) {
    return new Promise((resolve, reject) => {
      const slikaEl = new Image();
      const zacasniUrl = URL.createObjectURL(datoteka);
      slikaEl.onload = () => {
        URL.revokeObjectURL(zacasniUrl);
        let { width, height } = slikaEl;
        if (width > najvecjaStranica || height > najvecjaStranica) {
          if (width >= height) {
            height = Math.round((height / width) * najvecjaStranica);
            width = najvecjaStranica;
          } else {
            width = Math.round((width / height) * najvecjaStranica);
            height = najvecjaStranica;
          }
        }
        const platno = document.createElement("canvas");
        platno.width = width;
        platno.height = height;
        const ctx = platno.getContext("2d");
        ctx.drawImage(slikaEl, 0, 0, width, height);
        platno.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Stiskanje slike ni uspelo."))),
          "image/jpeg",
          kakovost
        );
      };
      slikaEl.onerror = () => {
        URL.revokeObjectURL(zacasniUrl);
        reject(new Error("Slike ni bilo mogoče prebrati."));
      };
      slikaEl.src = zacasniUrl;
    });
  }

  function blobVBase64(blob) {
    return new Promise((resolve, reject) => {
      const bralnik = new FileReader();
      bralnik.onload = () => {
        const rezultat = bralnik.result;
        const zarez = typeof rezultat === "string" ? rezultat.indexOf(",") : -1;
        resolve(zarez === -1 ? rezultat : rezultat.slice(zarez + 1));
      };
      bralnik.onerror = () => reject(new Error("Datoteke ni bilo mogoče prebrati."));
      bralnik.readAsDataURL(blob);
    });
  }

  function nastaviAiZajemStatus(besedilo, stanje) {
    // stanje: "nalaganje" | "napaka" | null
    if (!aiZajemStatus || !aiZajemStatusBesedilo) return;
    if (!stanje) {
      aiZajemStatus.hidden = true;
      aiZajemStatusBesedilo.textContent = "";
      if (aiZajemSpinner) aiZajemSpinner.hidden = true;
      return;
    }
    aiZajemStatus.hidden = false;
    aiZajemStatusBesedilo.textContent = besedilo;
    aiZajemStatus.classList.remove("ai-zajem__status--uspeh", "ai-zajem__status--napaka");
    if (stanje === "napaka") aiZajemStatus.classList.add("ai-zajem__status--napaka");
    if (aiZajemSpinner) aiZajemSpinner.hidden = stanje !== "nalaganje";
  }

  function nastaviAiZajemGumbe(onemogocen) {
    if (aiZajemGumbSlikaj) aiZajemGumbSlikaj.disabled = !!onemogocen;
    if (aiZajemGumbUvozi) aiZajemGumbUvozi.disabled = !!onemogocen;
    if (aiZajemGumbPonovi) aiZajemGumbPonovi.disabled = !!onemogocen;
  }

  function imaZeIzpolnjenaPoljaObrazca() {
    const ime = (document.getElementById("ime-stranke") || {}).value || "";
    const znesek = (document.getElementById("znesek-dolga") || {}).value || "";
    const opis = (document.getElementById("opis-dolga") || {}).value || "";
    return Boolean(ime.trim() || znesek.trim() || opis.trim());
  }

  function pokaziAiZajemZacetek() {
    if (aiZajemZacetek) aiZajemZacetek.hidden = false;
    if (aiZajemUspehBlok) aiZajemUspehBlok.hidden = true;
    if (aiZajemNaslov) aiZajemNaslov.textContent = AI_BESEDILO.naslov;
    if (aiZajemOpis) aiZajemOpis.textContent = AI_BESEDILO.opis;
    if (aiZajemIkona) {
      aiZajemIkona.classList.remove("ai-zajem__ikona--uspeh");
      aiZajemIkona.innerHTML = SVG_AI_SKEN;
    }
    nastaviAiZajemStatus("", null);
    nastaviAiZajemGumbe(false);
  }

  function pripraviAiZajemZaBranje() {
    aiZajemVTehniku = true;
    if (aiZajemZacetek) aiZajemZacetek.hidden = false;
    if (aiZajemUspehBlok) aiZajemUspehBlok.hidden = true;
    if (aiZajemNaslov) aiZajemNaslov.textContent = AI_BESEDILO.nalaganjeNaslov;
    if (aiZajemOpis) aiZajemOpis.textContent = AI_BESEDILO.nalaganjeOpis;
    if (aiZajemIkona) {
      aiZajemIkona.classList.remove("ai-zajem__ikona--uspeh");
      aiZajemIkona.innerHTML = SVG_AI_SKEN;
    }
    nastaviAiZajemStatus(AI_BESEDILO.nalaganjeNaslov, "nalaganje");
    nastaviAiZajemGumbe(true);
  }

  function pokaziAiZajemUspeh(imeDatoteke) {
    aiZajemUspeh = true;
    aiZajemVTehniku = false;
    if (aiZajemZacetek) aiZajemZacetek.hidden = true;
    if (aiZajemUspehBlok) aiZajemUspehBlok.hidden = false;
    if (aiZajemUspehDatoteka) aiZajemUspehDatoteka.textContent = imeDatoteke || "";
    nastaviAiZajemStatus("", null);
    nastaviAiZajemGumbe(false);
  }

  function pokaziAiZajemNapako(sporocilo) {
    aiZajemVTehniku = false;
    if (aiZajemZacetek) aiZajemZacetek.hidden = false;
    if (aiZajemUspehBlok) aiZajemUspehBlok.hidden = true;
    if (aiZajemNaslov) aiZajemNaslov.textContent = AI_BESEDILO.naslov;
    if (aiZajemOpis) aiZajemOpis.textContent = AI_BESEDILO.opis;
    if (aiZajemIkona) {
      aiZajemIkona.classList.remove("ai-zajem__ikona--uspeh");
      aiZajemIkona.innerHTML = SVG_AI_SKEN;
    }
    nastaviAiZajemStatus(sporocilo || AI_BESEDILO.napaka, "napaka");
    nastaviAiZajemGumbe(false);
  }

  async function potrdiZamenjavoOcrPodatkov() {
    if (aiZajemPreskociNaslednjoPotrditev) {
      aiZajemPreskociNaslednjoPotrditev = false;
      return true;
    }
    if (!aiZajemUspeh && !imaZeIzpolnjenaPoljaObrazca()) return true;
    return potrdiVprasanje({
      naslov: "Zamenjam podatke?",
      opis: "Trenutni vnos bo nadomeščen z novim branjem računa.",
      potrdiBesedilo: "Zamenjaj",
      stil: "primary",
    });
  }

  async function poOcrUspehuNastaviPrilogo(datoteka) {
    ocrSourceFile = datoteka;
    const ocrIndeks = messageAttachments.findIndex((p) => p.origin === "ocr");
    if (ocrIndeks >= 0) {
      messageAttachments[ocrIndeks] = { file: datoteka, origin: "ocr" };
      shouldSendAttachment = true;
      izrisiIzbranePriloge();
      return;
    }
    if (messageAttachments.length === 0) {
      dodajIzbranePriloge([datoteka], "ocr");
      return;
    }
    // Spodaj so že ročne priloge – vprašaj pred dodajanjem.
    const dodajKotPrilogo = await potrdiVprasanje({
      naslov: "Dodam tudi kot prilogo?",
      opis: "Želite novi račun uporabiti tudi kot prilogo za pošiljanje?",
      potrdiBesedilo: "Da, dodaj",
      prekliciBesedilo: "Ne, obdrži trenutne",
      stil: "primary",
    });
    if (dodajKotPrilogo) dodajIzbranePriloge([datoteka], "ocr");
  }

  /* Označi polje kot samodejno izpolnjeno (bled zelen border, glej
     .obrazec__polje--ai-izpolnjeno v styles.css) - oznaka se sname takoj,
     ko uporabnik polje ročno spremeni, da ne zavaja glede izvora vrednosti. */
  function oznaciPoljeKotAiIzpolnjeno(polje) {
    if (!polje) return;
    polje.classList.remove("obrazec__polje--ai-manjka");
    polje.classList.add("obrazec__polje--ai-izpolnjeno");
    const odstraniOznako = () => {
      polje.classList.remove("obrazec__polje--ai-izpolnjeno");
      polje.removeEventListener("input", odstraniOznako);
    };
    polje.addEventListener("input", odstraniOznako);
  }

  /* Rumeno: AI podatka ni našel - obrtnik naj ga vnese ročno.
     Oznaka izgine ob prvem ročnem vnosu (isto kot zelena). */
  function oznaciPoljeKotAiManjka(polje) {
    if (!polje) return;
    polje.classList.remove("obrazec__polje--ai-izpolnjeno");
    polje.classList.add("obrazec__polje--ai-manjka");
    const odstraniOznako = () => {
      polje.classList.remove("obrazec__polje--ai-manjka");
      polje.removeEventListener("input", odstraniOznako);
    };
    polje.addEventListener("input", odstraniOznako);
  }

  /* Prepiše polja, ki jih je AI prepoznal (zeleno). Manjkajoča pomembna
     polja označi rumeno (glej oznaciPoljeKotAiManjka). Telefon in e-pošta
     sta izjema: zadošča eden od njiju - rumeno sta samo, če manjkata OBA. */
  function izpolniPoljaIzAI(podatki) {
    if (!podatki) return;

    const naziv = document.getElementById("ime-stranke");
    if (podatki.naziv) {
      naziv.value = podatki.naziv;
      oznaciPoljeKotAiIzpolnjeno(naziv);
    } else {
      oznaciPoljeKotAiManjka(naziv);
    }

    const znesek = document.getElementById("znesek-dolga");
    if (podatki.znesek != null && Number.isFinite(Number(podatki.znesek))) {
      znesek.value = Number(podatki.znesek).toFixed(2);
      oznaciPoljeKotAiIzpolnjeno(znesek);
    } else {
      oznaciPoljeKotAiManjka(znesek);
    }

    const datumIzdaje = document.getElementById("datum-izdaje");
    if (podatki.datum && /^\d{4}-\d{2}-\d{2}$/.test(podatki.datum)) {
      datumIzdaje.value = podatki.datum;
      oznaciPoljeKotAiIzpolnjeno(datumIzdaje);
    } else {
      oznaciPoljeKotAiManjka(datumIzdaje);
    }

    const rokPlacila = document.getElementById("datum-zapadlosti");
    if (podatki.rokPlacila && /^\d{4}-\d{2}-\d{2}$/.test(podatki.rokPlacila)) {
      rokPlacila.value = podatki.rokPlacila;
      oznaciPoljeKotAiIzpolnjeno(rokPlacila);
    } else {
      oznaciPoljeKotAiManjka(rokPlacila);
    }

    const stevilkaRacuna = document.getElementById("stevilka-racuna");
    if (podatki.stevilkaRacuna) {
      stevilkaRacuna.value = podatki.stevilkaRacuna;
      oznaciPoljeKotAiIzpolnjeno(stevilkaRacuna);
    } else {
      oznaciPoljeKotAiManjka(stevilkaRacuna);
    }

    const opis = document.getElementById("opis-dolga");
    if (podatki.opis) {
      opis.value = podatki.opis;
      oznaciPoljeKotAiIzpolnjeno(opis);
    } else {
      oznaciPoljeKotAiManjka(opis);
    }

    const telefon = document.getElementById("telefon-dolznika");
    const email = document.getElementById("email-dolznika");
    const imaTelefon = Boolean(podatki.telefon);
    const imaEmail = Boolean(podatki.email);

    if (imaTelefon) {
      telefon.value = podatki.telefon;
      oznaciPoljeKotAiIzpolnjeno(telefon);
    }
    if (imaEmail) {
      email.value = podatki.email;
      oznaciPoljeKotAiIzpolnjeno(email);
    }
    // Zadošča eden od kontaktov - rumeno samo, če manjkata oba.
    if (!imaTelefon && !imaEmail) {
      oznaciPoljeKotAiManjka(telefon);
      oznaciPoljeKotAiManjka(email);
    }
  }

  async function obdelajRacunZAi(datoteka) {
    pripraviAiZajemZaBranje();

    try {
      let mediaType;
      let base64;

      if (datoteka.type === "application/pdf") {
        if (datoteka.size > NAJVECJA_VELIKOST_AI_PDF_B) {
          throw new Error("PDF je prevelik za samodejno branje (največ 3 MB) - podatke vnesite ročno spodaj.");
        }
        mediaType = "application/pdf";
        base64 = await blobVBase64(datoteka);
      } else if (datoteka.type && datoteka.type.startsWith("image/")) {
        const stisnjena = await stisniSlikoZaAi(datoteka);
        mediaType = "image/jpeg";
        base64 = await blobVBase64(stisnjena);
      } else {
        throw new Error("Podprte so samo slike ali PDF datoteke.");
      }

      const odgovor = await fetch("/api/citaj-racun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType, podatki: base64 }),
      });

      const telo = await odgovor.json().catch(() => null);

      if (!odgovor.ok || !telo || !telo.ok) {
        throw new Error((telo && telo.napaka) || "Računa ni bilo mogoče prebrati.");
      }

      izpolniPoljaIzAI(telo.podatki);
      await poOcrUspehuNastaviPrilogo(datoteka);
      pokaziAiZajemUspeh(datoteka.name);
    } catch (napakaAi) {
      pokaziAiZajemNapako(
        napakaAi && napakaAi.message ? napakaAi.message : AI_BESEDILO.napaka
      );
    }
  }

  /* click() na file input mora ostati v istem user-gesture (brez await pred tem),
     sicer brskalnik tiho zavrne odpiranje izbirnika. */
  function zazeniOcrIzbiro(inputEl) {
    if (aiZajemVTehniku || !inputEl) return;

    const potrebujePotrditev =
      !aiZajemPreskociNaslednjoPotrditev &&
      (aiZajemUspeh || imaZeIzpolnjenaPoljaObrazca());

    if (!potrebujePotrditev) {
      if (aiZajemPreskociNaslednjoPotrditev) {
        aiZajemPreskociNaslednjoPotrditev = false;
      }
      inputEl.click();
      return;
    }

    potrdiZamenjavoOcrPodatkov().then((potrjeno) => {
      if (potrjeno) inputEl.click();
    });
  }

  if (aiZajemGumbSlikaj && aiZajemFotoaparat) {
    aiZajemGumbSlikaj.addEventListener("click", () => zazeniOcrIzbiro(aiZajemFotoaparat));
  }

  if (aiZajemGumbUvozi && aiZajemDatoteka) {
    aiZajemGumbUvozi.addEventListener("click", () => zazeniOcrIzbiro(aiZajemDatoteka));
  }

  if (aiZajemGumbPonovi) {
    aiZajemGumbPonovi.addEventListener("click", async () => {
      if (aiZajemVTehniku) return;
      const potrjeno = await potrdiZamenjavoOcrPodatkov();
      if (!potrjeno) return;
      aiZajemUspeh = false;
      aiZajemPreskociNaslednjoPotrditev = true;
      pokaziAiZajemZacetek();
    });
  }

  if (aiZajemDatoteka) {
    aiZajemDatoteka.addEventListener("change", () => {
      if (aiZajemDatoteka.files[0]) obdelajRacunZAi(aiZajemDatoteka.files[0]);
      aiZajemDatoteka.value = "";
    });
  }

  if (aiZajemFotoaparat) {
    aiZajemFotoaparat.addEventListener("change", () => {
      if (aiZajemFotoaparat.files[0]) obdelajRacunZAi(aiZajemFotoaparat.files[0]);
      aiZajemFotoaparat.value = "";
    });
  }

  /* Naloži eno datoteko v Supabase Storage (bucket "racuni-priloge", glej
     sql/003_dodaj_racun_prilogo.sql) in vrne POT do nje. Vsaka datoteka
     gre v mapo, poimenovano po ID-ju obrtnika (auth.uid()) - to je isto
     ime, ki ga RLS pravila na bucketu preverjajo, da vsak obrtnik
     vidi/nalaga samo svoje. Časovni žig v imenu poskrbi, da se več
     datotek z istim izvirnim imenom med seboj ne prepiše. */
  async function nalozitEnoPrilogo(datoteka, obrtnikId) {
    if (datoteka.size > NAJVECJA_VELIKOST_PRILOGE_B) {
      return { napaka: `Datoteka "${datoteka.name}" je prevelika (največ 10 MB).` };
    }

    const varnoIme = datoteka.name.replace(/[^a-zA-Z0-9.\-]/g, "_");
    const pot = `${obrtnikId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${varnoIme}`;

    const { data, error } = await supabaseKlient.storage
      .from("racuni-priloge")
      .upload(pot, datoteka);

    if (error) {
      return { napaka: error.message };
    }

    return { pot: data.path };
  }

  /* Naloži VSE izbrane priloge (glej izbranePrilogeDatoteke) enega za
     drugim in vrne seznam njihovih poti. Če katerakoli naložena datoteka
     spodleti, se ustavi in vrne napako - da ne pride do zadeve z le delno
     naloženimi prilogami. */
  async function nalozitVsePriloge(datoteke) {
    if (datoteke.length === 0) return { poti: [] };

    const {
      data: { user },
    } = await supabaseKlient.auth.getUser();

    if (!user) {
      return { napaka: "Uporabnik ni prijavljen." };
    }

    const poti = [];
    for (const datoteka of datoteke) {
      const rezultat = await nalozitEnoPrilogo(datoteka, user.id);
      if (rezultat.napaka) {
        return { napaka: rezultat.napaka };
      }
      poti.push(rezultat.pot);
    }

    return { poti };
  }

  async function nalozizadeve() {
    const { data, error } = await supabaseKlient
      .from("zadeve")
      .select("*")
      .order("ustvarjeno_at", { ascending: false });

    if (error) {
      pokaziNapako(
        "Zadev ni bilo mogoče naložiti. Preveri internetno povezavo in poskusi znova.",
        error.message
      );
      return [];
    }

    return data;
  }

  /* Odpre PDF prilogo v novem zavihku. Bucket "racuni-priloge" je
     ZASEBEN (glej sql/003_dodaj_racun_prilogo.sql), zato ne obstaja javna
     povezava do datotek - tik pred odpiranjem zato zahtevamo kratkotrajno
     "podpisano" povezavo (velja 60 sekund, dovolj za takojšen ogled, a ne
     za trajno shranjevanje). RLS na Storage sama poskrbi, da lahko
     createSignedUrl uspe samo za datoteke prijavljenega obrtnika - v kodi
     tu ni in ne sme biti nobenega "obvoza" te preverbe.
     Prazen zavihek odpremo TAKOJ, še preden dobimo povezavo - če bi
     počakali na odgovor od Supabase, bi brskalnik window.open() pogosto
     blokiral kot pojavno okno, ker takrat klic ne bi bil več neposredno
     del uporabnikovega klika. Slike gredo namesto tega v lightbox (glej
     odpriSlikoVLightboxu spodaj) - tam ni popup blokatorja, ker se nič ne
     odpre v novem zavihku. */
  async function odpriPrilogo(pot) {
    const novZavihek = window.open("", "_blank");

    const { data, error } = await supabaseKlient.storage
      .from("racuni-priloge")
      .createSignedUrl(pot, 60);

    if (error || !data) {
      if (novZavihek) novZavihek.close();
      pokaziNapako("Priloge ni bilo mogoče odpreti.", error && error.message);
      return;
    }

    if (novZavihek) {
      novZavihek.location.href = data.signedUrl;
    } else {
      // Če je brskalnik vseeno blokiral pojavno okno, odpremo v istem zavihku.
      window.location.href = data.signedUrl;
    }
  }

  function zapriLightbox() {
    lightbox.hidden = true;
    lightboxSlika.src = "";
  }

  lightboxZapri.addEventListener("click", zapriLightbox);

  // Klik kjerkoli na temno ozadje zapre lightbox, klik na samo sliko pa ne
  // (dogodek se ne razširi na .lightbox, ker slika ni ozadje samo).
  lightbox.addEventListener("click", (dogodek) => {
    if (dogodek.target === lightbox) zapriLightbox();
  });

  document.addEventListener("keydown", (dogodek) => {
    if (dogodek.key === "Escape" && !lightbox.hidden) zapriLightbox();
  });

  /* Prikaže sliko priloge v celozaslonskem lightboxu namesto v novem
     zavihku - glej #lightbox v neplacila.html. Modal je en sam, ponovno
     uporabljen element: tu se mu samo nastavi src in ga prikaže. */
  async function odpriSlikoVLightboxu(pot) {
    const { data, error } = await supabaseKlient.storage
      .from("racuni-priloge")
      .createSignedUrl(pot, 60);

    if (error || !data) {
      pokaziNapako("Priloge ni bilo mogoče odpreti.", error && error.message);
      return;
    }

    lightboxSlika.src = data.signedUrl;
    lightbox.hidden = false;
  }

  function izrisiZadeve(zadeve) {
    seznamVsebina.innerHTML = "";

    if (zadeve.length === 0) {
      const prazno = document.createElement("p");
      prazno.className = "seznam-zadev__prazno";
      prazno.textContent = "Trenutno ni nobenih neplačanih zadev.";
      seznamVsebina.appendChild(prazno);
      return;
    }

    const seznam = document.createElement("div");
    seznam.className = "seznam-zadev__seznam";

    zadeve.forEach((zadeva) => {
      seznam.appendChild(ustvariKartico(zadeva));
    });

    seznamVsebina.appendChild(seznam);
  }

  function ustvariKartico(zadeva) {
    const kartica = document.createElement("article");
    kartica.className = "zadeva";

    const glava = document.createElement("div");
    glava.className = "zadeva__glava";

    const ime = document.createElement("span");
    ime.className = "zadeva__ime";
    ime.textContent = zadeva.ime_dolznika;

    const znesek = document.createElement("span");
    znesek.className = "zadeva__znesek";
    znesek.textContent = formatirajZnesek(zadeva.znesek);

    glava.appendChild(ime);
    glava.appendChild(znesek);
    kartica.appendChild(glava);

    if (zadeva.opis_dolga) {
      const opis = document.createElement("p");
      opis.className = "zadeva__opis";
      opis.textContent = zadeva.opis_dolga;
      kartica.appendChild(opis);
    }

    const datum = document.createElement("p");
    datum.className = "zadeva__datum";
    datum.textContent = "Zapade: " + formatirajDatum(zadeva.datum_zapadlosti);
    kartica.appendChild(datum);

    const status = document.createElement("span");
    const cssRazred = CSS_RAZRED_STATUSA[zadeva.status] || "nov";
    status.className = "zadeva__status zadeva__status--" + cssRazred;
    status.textContent = zadeva.status;
    kartica.appendChild(status);

    // Razdelek s prilogami se prikaže SAMO, če zadeva dejansko ima vsaj
    // eno naloženo prilogo (glej racun_datoteke_poti v sql/003) - sicer se
    // sploh ne izriše, da ne pušča praznega prostora na kartici.
    if (Array.isArray(zadeva.racun_datoteke_poti) && zadeva.racun_datoteke_poti.length > 0) {
      const prilogeRazdelek = document.createElement("div");
      prilogeRazdelek.className = "zadeva__priloge";

      const prilogeNaslov = document.createElement("span");
      prilogeNaslov.className = "zadeva__priloge-naslov";
      prilogeNaslov.textContent = "Priložene datoteke";
      prilogeRazdelek.appendChild(prilogeNaslov);

      const prilogeSeznam = document.createElement("div");
      prilogeSeznam.className = "zadeva__priloge-seznam";

      zadeva.racun_datoteke_poti.forEach((pot) => {
        const prilogaGumb = document.createElement("button");
        prilogaGumb.type = "button";
        prilogaGumb.className = "zadeva__priloga-gumb";
        prilogaGumb.innerHTML =
          '<span aria-hidden="true">' + (jePdfDatoteka(pot) ? "📄" : "🖼️") + "</span>" +
          '<span class="zadeva__priloga-gumb-ime"></span>';
        prilogaGumb.querySelector(".zadeva__priloga-gumb-ime").textContent =
          imeDatotekeIzPoti(pot);
        prilogaGumb.addEventListener("click", () => {
          if (jePdfDatoteka(pot)) {
            odpriPrilogo(pot);
          } else {
            odpriSlikoVLightboxu(pot);
          }
        });
        prilogeSeznam.appendChild(prilogaGumb);
      });

      prilogeRazdelek.appendChild(prilogeSeznam);
      kartica.appendChild(prilogeRazdelek);
    }

    const akcije = document.createElement("div");
    akcije.className = "zadeva__akcije";

    if (zadeva.status !== "Rešeno") {
      const gumbNaprej = document.createElement("button");
      gumbNaprej.type = "button";
      gumbNaprej.className = "btn btn--cta btn--majhen";
      gumbNaprej.textContent =
        zadeva.status === "Predano odvetniku"
          ? "Označi kot rešeno"
          : "Pošlji naslednji opomin";
      gumbNaprej.addEventListener("click", () => posljiOpomin(zadeva));
      akcije.appendChild(gumbNaprej);
    }

    const gumbIzbrisi = document.createElement("button");
    gumbIzbrisi.type = "button";
    gumbIzbrisi.className = "btn btn--nevarnost-obris";
    gumbIzbrisi.textContent = "Izbriši zadevo";
    gumbIzbrisi.addEventListener("click", () => izbrisiZadevo(zadeva.id));
    akcije.appendChild(gumbIzbrisi);

    kartica.appendChild(akcije);

    return kartica;
  }

  /* Sešteje število zadev in vsoto zneskov po kategorijah (glej
     KATEGORIJA_SEMAFORJA_PO_STATUSU zgoraj) in izpiše v kartice semaforja. */
  function izrisiSemafor(zadeve) {
    const povzetek = {
      "v-teku": { stevilo: 0, znesek: 0 },
      odvetnik: { stevilo: 0, znesek: 0 },
      reseno: { stevilo: 0, znesek: 0 },
    };

    zadeve.forEach((zadeva) => {
      const kategorija = KATEGORIJA_SEMAFORJA_PO_STATUSU[zadeva.status];
      if (!kategorija) return;
      povzetek[kategorija].stevilo += 1;
      povzetek[kategorija].znesek += Number(zadeva.znesek) || 0;
    });

    Object.keys(povzetek).forEach((kategorija) => {
      const steviloElement = document.getElementById(
        "semafor-" + kategorija + "-stevilo"
      );
      const zneskElement = document.getElementById(
        "semafor-" + kategorija + "-znesek"
      );
      if (steviloElement) steviloElement.textContent = povzetek[kategorija].stevilo;
      if (zneskElement)
        zneskElement.textContent = formatirajZnesek(povzetek[kategorija].znesek);
    });

    // "Odprti" dolgovi = vsi, ki še niso označeni kot "Rešeno".
    const odprtihElement = document.getElementById("semafor-odprtih");
    if (odprtihElement) {
      const odprtih = zadeve.filter((zadeva) => zadeva.status !== "Rešeno").length;
      odprtihElement.textContent = odprtih;
    }
  }

  /* Prikaže seznam zadev, upoštevajoč trenutno izbrano kategorijo
     semaforja (aktivnaKategorija) - če ni izbrana, prikaže vse zadeve. */
  function osveziPrikazSeznama() {
    const prikazane = aktivnaKategorija
      ? vseZadeve.filter(
          (zadeva) =>
            KATEGORIJA_SEMAFORJA_PO_STATUSU[zadeva.status] === aktivnaKategorija
        )
      : vseZadeve;

    izrisiZadeve(prikazane);

    semaforKartice.forEach((kartica) => {
      const jeAktivna = kartica.dataset.kategorija === aktivnaKategorija;
      kartica.classList.toggle("zadeve-semafor__kartica--aktivna", jeAktivna);
    });

    if (semaforVsebnik) {
      semaforVsebnik.classList.toggle(
        "zadeve-semafor__kartice--filtrirano",
        Boolean(aktivnaKategorija)
      );
    }
  }

  semaforKartice.forEach((kartica) => {
    kartica.addEventListener("click", () => {
      const kategorija = kartica.dataset.kategorija;
      aktivnaKategorija = aktivnaKategorija === kategorija ? null : kategorija;
      osveziPrikazSeznama();
    });
  });

  /* Glede na URL fragment prikaže samo en del strani - obe povezavi na
     app/zascita-posla.html vodita na isto stran, a vsaka naj pokaže samo
     tisto, kar spada k njej (semafor+seznam sta v ločeni "kategoriji" kot
     obrazec za dodajanje):
     - #seznam ("Preveri odprte zadeve") - skrije obrazec, prikaže samo
       semafor in seznam zadev.
     - #obrazec ("Dodaj nov račun") - skrije semafor in seznam zadev,
       prikaže samo obrazec za dodajanje.
     Če fragmenta ni (npr. nekdo pride na stran neposredno), se stran
     obnaša kot doslej - prikaže se vse, od vrha. */
  function prilagodiPrikazGledeNaFragment() {
    const idRazdelka = window.location.hash.replace("#", "");
    if (!idRazdelka) return;

    const obrazecRazdelek = document.getElementById("neplacila-obrazec");
    const semaforRazdelek = document.getElementById("seznam");
    const seznamRazdelek = document.getElementById("seznam-vsebnik");

    if (idRazdelka === "seznam") {
      // Samo semafor + seznam zadev (gumb "Preveri odprte zadeve").
      document.body.className = "stran--neplacila stran--samo-seznam";
      if (obrazecRazdelek) obrazecRazdelek.hidden = true;
      if (semaforRazdelek) semaforRazdelek.hidden = false;
      if (seznamRazdelek) seznamRazdelek.hidden = false;
      if (semaforRazdelek) {
        semaforRazdelek.scrollIntoView({ behavior: "auto", block: "start" });
      }
    } else if (idRazdelka === "obrazec") {
      // Enako kot koraka 2/3: samo stran--sporocilo (+ skrij seznam).
      document.body.className = "stran--sporocilo stran--samo-obrazec";
      if (obrazecRazdelek) obrazecRazdelek.hidden = false;
      if (semaforRazdelek) semaforRazdelek.hidden = true;
      if (seznamRazdelek) seznamRazdelek.hidden = true;
      window.scrollTo(0, 0);
    }
  }

  async function osveziSeznam() {
    vseZadeve = await nalozizadeve();
    izrisiSemafor(vseZadeve);
    osveziPrikazSeznama();
  }

  async function posljiOpomin(zadeva) {
    skrijNapako();

    const { error } = await supabaseKlient
      .from("zadeve")
      .update({ status: naslednjiStatus(zadeva.status) })
      .eq("id", zadeva.id);

    if (error) {
      pokaziNapako("Statusa ni bilo mogoče posodobiti.", error.message);
      return;
    }

    osveziSeznam();
  }

  async function izbrisiZadevo(id) {
    skrijNapako();

    const { error } = await supabaseKlient
      .from("zadeve")
      .delete()
      .eq("id", id);

    if (error) {
      pokaziNapako("Zadeve ni bilo mogoče izbrisati.", error.message);
      return;
    }

    osveziSeznam();
  }

  const napakaKontakt = document.getElementById("napaka-kontakt");
  const poljeTelefon = document.getElementById("telefon-dolznika");
  const poljeEmail = document.getElementById("email-dolznika");
  let casovnikOsnutkaKorak1 = null;
  let casovnikOznakeOsnutkaKorak1 = null;

  function oznaciShranjevanjeKorak1() {
    const statusEl = document.getElementById("osnutek-status");
    if (!statusEl) return;
    statusEl.textContent = "Shranjevanje …";
    if (casovnikOznakeOsnutkaKorak1) clearTimeout(casovnikOznakeOsnutkaKorak1);
    casovnikOznakeOsnutkaKorak1 = setTimeout(() => {
      statusEl.textContent = "Osnutek shranjen";
    }, 420);
  }

  function preberiObstojeciOsnutekKorak1() {
    try {
      const surovo = sessionStorage.getItem(KLJUC_SEJE_KORAK1_PODATKI);
      if (!surovo) return {};
      const o = JSON.parse(surovo);
      return o && typeof o === "object" ? o : {};
    } catch (_e) {
      return {};
    }
  }

  function znesekIzObrazcaZaOsnutek(raw) {
    if (window.UJObrocno) {
      const c = window.UJObrocno.eurosToCents(raw);
      return c != null ? c / 100 : 0;
    }
    const n = Number(String(raw || "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  /** Live osnutek polj koraka 1 (priloge ostanejo iz prejšnjega shranjevanja). */
  function shraniOsnutekKorak1Lokalno() {
    oznaciShranjevanjeKorak1();
    const podatki = new FormData(obrazec);
    const obstojeci = preberiObstojeciOsnutekKorak1();
    sessionStorage.setItem(
      KLJUC_SEJE_KORAK1_PODATKI,
      JSON.stringify({
        imeDolznika: String(podatki.get("ime") || "").trim(),
        telefonDolznika: String(podatki.get("telefon") || "").trim(),
        emailDolznika: String(podatki.get("email") || "").trim(),
        znesek: znesekIzObrazcaZaOsnutek(podatki.get("znesek")),
        opisDolga: String(podatki.get("opis") || "").trim(),
        datumIzdajeRacuna: podatki.get("datumIzdaje") || null,
        datumZapadlosti: podatki.get("datum") || null,
        stevilkaRacuna: String(podatki.get("stevilkaRacuna") || "").trim() || null,
        racunDatotekePoti: Array.isArray(obstojeci.racunDatotekePoti)
          ? obstojeci.racunDatotekePoti
          : [],
        shouldSendAttachment:
          typeof obstojeci.shouldSendAttachment === "boolean"
            ? obstojeci.shouldSendAttachment
            : true,
        attachmentOrigins: Array.isArray(obstojeci.attachmentOrigins)
          ? obstojeci.attachmentOrigins
          : [],
      })
    );
  }

  function narociShranjevanjeOsnutkaKorak1() {
    if (casovnikOsnutkaKorak1) clearTimeout(casovnikOsnutkaKorak1);
    casovnikOsnutkaKorak1 = setTimeout(() => {
      shraniOsnutekKorak1Lokalno();
    }, 400);
  }

  function skrijNapakoKontakta() {
    if (napakaKontakt) napakaKontakt.hidden = true;
    if (poljeTelefon) poljeTelefon.classList.remove("obrazec__polje--napaka");
    if (poljeEmail) poljeEmail.classList.remove("obrazec__polje--napaka");
  }

  function pokaziNapakoKontakta() {
    if (napakaKontakt) {
      napakaKontakt.hidden = false;
      napakaKontakt.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (poljeTelefon) poljeTelefon.classList.add("obrazec__polje--napaka");
    if (poljeEmail) poljeEmail.classList.add("obrazec__polje--napaka");
  }

  if (poljeTelefon) {
    poljeTelefon.addEventListener("input", skrijNapakoKontakta);
  }
  if (poljeEmail) {
    poljeEmail.addEventListener("input", skrijNapakoKontakta);
  }

  obrazec.addEventListener("input", narociShranjevanjeOsnutkaKorak1);
  obrazec.addEventListener("change", narociShranjevanjeOsnutkaKorak1);

  obrazec.addEventListener("submit", async (dogodek) => {
    dogodek.preventDefault();
    skrijNapako();
    skrijNapakoKontakta();

    const podatki = new FormData(obrazec);
    const imeDolznika = podatki.get("ime").trim();
    const telefonDolznika = podatki.get("telefon").trim();
    const emailDolznika = podatki.get("email").trim();
    const datumZapadlosti = podatki.get("datum");
    const opisDolga = podatki.get("opis").trim();

    if (!imeDolznika || !datumZapadlosti || !opisDolga) return;

    if (!telefonDolznika && !emailDolznika) {
      pokaziNapakoKontakta();
      return;
    }

    // Zadeva se dejansko doda v bazo šele na 3. koraku (po sporočilu),
    // glej neplacila-posiljanje.html - tu samo naložimo morebitne priloge
    // in podatke 1. koraka začasno shranimo za naslednja koraka.
    const rezultatPrilog = await nalozitVsePriloge(izbranePrilogeDatoteke);
    if (rezultatPrilog.napaka) {
      pokaziNapako("Prilog ni bilo mogoče naložiti.", rezultatPrilog.napaka);
      return;
    }

    sessionStorage.setItem(
      KLJUC_SEJE_KORAK1_PODATKI,
      JSON.stringify({
        imeDolznika,
        telefonDolznika,
        emailDolznika,
        znesek: (() => {
          const raw = podatki.get("znesek");
          if (window.UJObrocno) {
            const c = window.UJObrocno.eurosToCents(raw);
            return c != null ? c / 100 : 0;
          }
          const n = Number(String(raw || "").replace(",", "."));
          return Number.isFinite(n) ? n : 0;
        })(),
        opisDolga,
        datumIzdajeRacuna: podatki.get("datumIzdaje") || null,
        datumZapadlosti,
        stevilkaRacuna: podatki.get("stevilkaRacuna").trim() || null,
        racunDatotekePoti: rezultatPrilog.poti,
        shouldSendAttachment: messageAttachments.length > 0 && shouldSendAttachment,
        attachmentOrigins: messageAttachments.map((p) => p.origin),
      })
    );

    window.location.href = "neplacila-sporocilo.html";
  });

  /* Če se obrtnik pravkar vrnil iz 3. koraka po uspešno dodani zadevi,
     prikaži potrditveno sporočilo. */
  if (sessionStorage.getItem(KLJUC_SEJE_ZADEVA_DODANA)) {
    sessionStorage.removeItem(KLJUC_SEJE_ZADEVA_DODANA);
    pokaziUspesnoDodano();
  }

  prilagodiPrikazGledeNaFragment();
  osveziSeznam();
}



/* ---------- Logika strani neplacila-sporocilo.html (2. korak) ---------- */

function formatirajZnesekDe(znesek) {
  return (
    Number(znesek).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function formatirajDatumDe(datumBesedilo) {
  if (!datumBesedilo) return "";
  const datum = new Date(datumBesedilo + "T12:00:00");
  if (Number.isNaN(datum.getTime())) return datumBesedilo;
  return datum.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function izracunajNoviRok(datumZapadlosti) {
  if (!datumZapadlosti) return "";
  const datum = new Date(datumZapadlosti + "T12:00:00");
  if (Number.isNaN(datum.getTime())) return "";
  datum.setDate(datum.getDate() + 14);
  return datum.toISOString().slice(0, 10);
}

function sestaviPredlogeSporocil(podatki) {
  const invoiceNumber = (podatki.stevilkaRacuna || "").trim();
  const amount = formatirajZnesekDe(podatki.znesek || 0);
  const dueDate = formatirajDatumDe(podatki.datumZapadlosti);
  const newDeadline = formatirajDatumDe(izracunajNoviRok(podatki.datumZapadlosti));
  const iban = (podatki.iban || "").trim();

  function vrstice(seznam) {
    return seznam.filter(Boolean).join("\n");
  }

  return [
    {
      id: "vljuden",
      naslov: "Vljuden opomin",
      ikona: "hand-heart",
      stilIkone: "krem",
      besedilo: vrstice([
        "Guten Tag,",
        invoiceNumber
          ? "ich möchte Sie freundlich an die noch offene Rechnung Nr. " +
            invoiceNumber +
            " über " +
            amount +
            " erinnern." +
            (dueDate ? " Die Rechnung war am " + dueDate + " fällig." : "")
          : "ich möchte Sie freundlich an die noch offene Rechnung über " +
            amount +
            " erinnern." +
            (dueDate ? " Die Rechnung war am " + dueDate + " fällig." : ""),
        "Bitte überweisen Sie den offenen Betrag zeitnah. Falls Sie bereits bezahlt haben, betrachten Sie diese Nachricht bitte als gegenstandslos.",
        "Vielen Dank und freundliche Grüße",
      ]),
    },
    {
      id: "kratek",
      naslov: "Kratek opomin",
      ikona: "message-circle",
      stilIkone: "",
      besedilo: vrstice([
        "Guten Tag,",
        invoiceNumber
          ? "die Rechnung Nr. " + invoiceNumber + " über " + amount + " ist noch offen. Bitte überweisen Sie den Betrag zeitnah."
          : "die Rechnung über " + amount + " ist noch offen. Bitte überweisen Sie den Betrag zeitnah.",
        "Sollte die Zahlung bereits erfolgt sein, können Sie diese Nachricht ignorieren.",
        "Freundliche Grüße",
      ]),
    },
    {
      id: "jasen",
      naslov: "Jasen poziv k plačilu",
      ikona: "badge-euro",
      stilIkone: "",
      besedilo: vrstice([
        "Guten Tag,",
        invoiceNumber
          ? "die Rechnung Nr. " +
            invoiceNumber +
            " über " +
            amount +
            (dueDate ? " ist seit dem " + dueDate + " fällig" : " ist fällig") +
            " und bisher nicht beglichen."
          : "die Rechnung über " +
            amount +
            (dueDate ? " ist seit dem " + dueDate + " fällig" : " ist fällig") +
            " und bisher nicht beglichen.",
        "Bitte überweisen Sie den offenen Betrag ohne weitere Verzögerung. Senden Sie uns anschließend gern eine kurze Zahlungsbestätigung.",
        "Freundliche Grüße",
      ]),
    },
    {
      id: "novi-rok",
      naslov: "Prijazen opomnik",
      ikona: "calendar-clock",
      stilIkone: "krem",
      besedilo: vrstice([
        "Guten Tag,",
        invoiceNumber
          ? "für die Rechnung Nr. " + invoiceNumber + " über " + amount + " konnten wir noch keinen Zahlungseingang feststellen."
          : "für die Rechnung über " + amount + " konnten wir noch keinen Zahlungseingang feststellen.",
        newDeadline
          ? "Bitte begleichen Sie den offenen Betrag bis spätestens " +
            newDeadline +
            ". Falls Sie bereits bezahlt haben, teilen Sie uns dies bitte kurz mit."
          : "Bitte begleichen Sie den offenen Betrag zeitnah. Falls Sie bereits bezahlt haben, teilen Sie uns dies bitte kurz mit.",
        "Vielen Dank und freundliche Grüße",
      ]),
    },
    {
      id: "zadnji",
      naslov: "Zadnji opomin",
      ikona: "triangle-alert",
      stilIkone: "",
      besedilo: vrstice([
        "Guten Tag,",
        dueDate
          ? "trotz Fälligkeit am " +
            dueDate +
            " und unserer bisherigen Erinnerung ist die Rechnung" +
            (invoiceNumber ? " Nr. " + invoiceNumber : "") +
            " über " +
            amount +
            " noch offen."
          : "trotz unserer bisherigen Erinnerung ist die Rechnung" +
            (invoiceNumber ? " Nr. " + invoiceNumber : "") +
            " über " +
            amount +
            " noch offen.",
        newDeadline
          ? "Bitte begleichen Sie den Betrag bis spätestens " +
            newDeadline +
            ". Sollte bis dahin kein Zahlungseingang erfolgen, behalten wir uns weitere Schritte vor."
          : "Bitte begleichen Sie den Betrag ohne weitere Verzögerung. Sollte kein Zahlungseingang erfolgen, behalten wir uns weitere Schritte vor.",
        "Freundliche Grüße",
      ]),
    },
    {
      id: "obrocno",
      naslov: "Obročno plačilo",
      ikona: "calendar-range",
      stilIkone: "",
      besedilo: vrstice([
        "Guten Tag,",
        invoiceNumber
          ? "die Rechnung Nr. " + invoiceNumber + " über " + amount + " ist weiterhin offen."
          : "die Rechnung über " + amount + " ist weiterhin offen.",
        "Falls Sie den Gesamtbetrag derzeit nicht vollständig begleichen können, melden Sie sich bitte bei uns. Wir können gemeinsam eine passende Ratenzahlung vereinbaren.",
        "Freundliche Grüße",
      ]),
    },
  ].map((predlog) => ({
    ...predlog,
    // IBAN se uporabi samo v dodatkih, ne v osnovnih predlogih.
    _iban: iban,
    _newDeadline: newDeadline,
    _invoiceNumber: invoiceNumber,
  }));
}

function formatirajDatumSl(datumBesedilo) {
  if (!datumBesedilo) return "";
  const datum = new Date(datumBesedilo + "T12:00:00");
  if (Number.isNaN(datum.getTime())) return datumBesedilo;
  return datum.toLocaleDateString("sl-SI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function inicializirajSporociloDolzniku() {
  const obrazec = document.getElementById("obrazec-sporocilo");
  const napaka = document.getElementById("splosna-napaka");
  const seznam = document.getElementById("predlogi-seznam");
  const okvir = document.getElementById("predlogi-okvir");
  const indikator = document.getElementById("predlogi-indikator");

  if (!obrazec || !seznam) return;

  const podatkiKorak1Json = sessionStorage.getItem(KLJUC_SEJE_KORAK1_PODATKI);
  if (!podatkiKorak1Json) {
    window.location.href = "neplacila.html#obrazec";
    return;
  }

  inicializirajWizardProgressHeader(2);
  inicializirajIzbrisOsnutka();

  const podatkiKorak1 = JSON.parse(podatkiKorak1Json);
  /* Ton sporočila: priporočilo + izbira (widget Faza C; osnutek Faza D). */
  let jezikPredlog = "de";
  let tonPriporociloRezultat = null;
  let toneState = {
    recommendedToneId: "friendly",
    selectedToneId: "friendly",
    appliedToneId: null,
    isOverridden: false,
    reasonCodes: [],
    reasonText: "",
    reasonDetailText: "",
    amountCentsSnapshot: null,
    amountLabel: "",
    originalDueDateSnapshot: null,
    evaluationDate: null,
    overdueDays: null,
    timingLabel: null,
    calculatedAt: null,
  };
  if (window.UJTonPriporocilo) {
    tonPriporociloRezultat = window.UJTonPriporocilo.getRecommendedTone({
      totalDebtCents: window.UJTonPriporocilo.eurosToCents(podatkiKorak1.znesek),
      originalDueDate: podatkiKorak1.datumZapadlosti || null,
      evaluationDate: window.UJTonPriporocilo.danesYYYYMMDD(),
    });
    toneState = window.UJTonPriporocilo.applyRecommendationToState(
      null,
      tonPriporociloRezultat
    );
  }
  let izbranTonId = toneState.selectedToneId || "friendly";
  /* Zgodnja obnova tona iz osnutka (priporočilo sveže, ročna izbira ohranjena). */
  try {
    const osnutekTonJson = sessionStorage.getItem(KLJUC_SEJE_KORAK2_PODATKI);
    if (osnutekTonJson && window.UJTonPriporocilo && tonPriporociloRezultat) {
      const osnutekTon = JSON.parse(osnutekTonJson);
      if (osnutekTon && osnutekTon.toneRecommendation) {
        const prev = osnutekTon.toneRecommendation;
        toneState = window.UJTonPriporocilo.applyRecommendationToState(
          prev,
          tonPriporociloRezultat
        );
        if (prev.appliedToneId) toneState.appliedToneId = prev.appliedToneId;
        izbranTonId = toneState.selectedToneId || izbranTonId;
      }
    }
  } catch (_e) {
    /* ignoriraj pokvarjen osnutek tona */
  }
  const vgrajeniPredlogi = window.UJTonPredloge
    ? window.UJTonPredloge.sestaviSistemskePredloge(podatkiKorak1, jezikPredlog)
    : sestaviPredlogeSporocil(podatkiKorak1);
  let mojiPredlogi = [];
  let predlogi = [];
  let kljucMojihPredlogov = KLJUC_MOJI_PREDLOGI_OSNOVA;
  let kljucNastavitev = KLJUC_PREDLOGI_NASTAVITVE_OSNOVA;
  let nastavitvePredlogov = { stevilke: {}, skritiIds: [] };
  const NAJVEC_STEVILK_V_TONU = 6;

  const besediloPolje = document.getElementById("sporocilo-besedilo");
  const pomocPolja = document.getElementById("sporocilo-pomoc");
  const stevecPolja = document.getElementById("sporocilo-stevec");
  const osnutekStatus = document.getElementById("osnutek-status");
  const oznakaStevila = document.getElementById("predlogi-stevilo-oznaka");
  const gumbDodajPredlog = document.getElementById("predlogi-dodaj");
  const predlogiObvestilo = document.getElementById("predlogi-obvestilo");
  const dodatekRok = document.getElementById("dodatek-rok");
  const dodatekObrocno = document.getElementById("dodatek-obrocno");
  const dodatekTrr = document.getElementById("dodatek-trr");
  const modal = document.getElementById("predogled-modal");
  const modalNaslovGlava = document.getElementById("predogled-naslov-glava");
  const modalNaslovVnos = document.getElementById("predogled-naslov-vnos");
  const modalUrejevalnik = document.getElementById("predogled-urejevalnik");
  const modalStevec = document.getElementById("predogled-stevec");
  const modalIzbrisi = document.getElementById("predogled-izbrisi");
  const modalShrani = document.getElementById("predogled-shrani");
  const modalPreklici = document.getElementById("predogled-preklici");
  const modalZapri = document.getElementById("predogled-zapri");
  const modalBackdrop = document.getElementById("predogled-backdrop");
  const modalStevilkaOvoj = document.getElementById("predogled-stevilka");
  const modalStevilkeMreza = document.getElementById("predogled-stevilke-mreza");
  const modalPlacila = document.getElementById("predogled-placila");
  const modalDodatekRok = document.getElementById("predogled-dodatek-rok");
  const modalDodatekRokStanje = document.getElementById(
    "predogled-dodatek-rok-stanje"
  );
  const modalDodatekObrocno = document.getElementById(
    "predogled-dodatek-obrocno"
  );
  const modalDodatekObrocnoStanje = document.getElementById(
    "predogled-dodatek-obrocno-stanje"
  );
  const modalDodatekTrr = document.getElementById("predogled-dodatek-trr");
  const modalDodatekTrrStanje = document.getElementById(
    "predogled-dodatek-trr-stanje"
  );
  const modalPredlagajTon = document.getElementById("predogled-predlagaj-ton");
  const modalPredlagajTonHint = document.getElementById(
    "predogled-predlagaj-ton-hint"
  );
  const modalPriporociloVrstica = document.getElementById(
    "predogled-priporocilo-vrstica"
  );
  const modalPriporociloNaslov = document.getElementById(
    "predogled-priporocilo-naslov"
  );
  const modalRazveljaviPriporocilo = document.getElementById(
    "predogled-razveljavi-priporocilo"
  );
  const modalVsebina = document.getElementById("predogled-vsebina");
  const predlogaPredogled = document.getElementById("predloga-predogled");
  const predlogaPredogledNaslov = document.getElementById(
    "predloga-predogled-naslov"
  );
  const predlogaPredogledBesedilo = document.getElementById(
    "predloga-predogled-besedilo"
  );
  const predlogaPredogledZapri = document.getElementById(
    "predloga-predogled-zapri"
  );
  const predlogaPredogledBackdrop = document.getElementById(
    "predloga-predogled-backdrop"
  );
  const predlogaPredogledUredi = document.getElementById(
    "predloga-predogled-uredi"
  );
  const predlogaPredogledUporabi = document.getElementById(
    "predloga-predogled-uporabi"
  );

  const NAJVEC_ZNAKOV = 1000;
  let izbranPredlogId = null;
  let odprtPredlog = null;
  let predogledPredlog = null;
  let predogledScrollY = 0;
  let predogledZapriCasovnik = null;
  let predogledZapriHandler = null;
  let modalIzbranaStevilka = 1;
  /** Začetno stanje ob odprtju – za zavržene spremembe. */
  let originalTemplateSnapshot = null;
  /** Snapshot pred »Predlagaj ton« – za Razveljavi. */
  let recommendationSnapshot = null;
  /** Sheet odprt iz urejevalnika predloge – ne spreminjaj osnutka sporočila. */
  let predlogaSheetAktiven = false;
  let predlogaSheetSaved = false;
  let predlogaDraftDeadline = null;
  let predlogaDraftPlan = null;
  /** Po zaprtju sheeta: blokiraj ghost-click na dodatke (sicer se odpre Obročno). */
  let modalDodatkiKlikPavzaDo = 0;
  let modalDodatkiPavzaCasovnik = null;
  /** Prekliče zakasnjeno odpiranje Roka/Obročnega, če uporabnik zapre modal. */
  let predlogaSheetOdpriToken = 0;
  const predlogaSheetBesedilo = { value: "" };
  const predlogaDraftDodatki = { rok: false, obrocno: false, trr: false };
  const predlogaDraftDodatekBesedila = { rok: "", obrocno: "", trr: "" };
  let templateEditorScrollY = 0;
  let templateEditorParent = null;
  /* true = sporočilo sledi predlogi s številko 1 (privzeta izbira). */
  let slediPrivzetiStevilki1 = true;
  let obnovljenOsnutekSporocila = false;
  let sporociloRocnoUrejeno = false;
  let zadnjeUporabljenoBesediloPredloge = "";
  const dodatki = { rok: false, obrocno: false, trr: false };
  const dodatekBesedila = { rok: "", obrocno: "", trr: "" };
  let casovnikOsnutka = null;
  const zeliZmanjsanoGibanje = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ikonaSvincnika =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';
  const ikonaKljukice =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  /* Mala rumena zvezda (zgoraj levo) pri številki 1 – cifra »1« ostane glavna. */
  const ikonaZvezdePrioriteta =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.75 6.2 6.75.7-5.1 4.55 1.45 6.55L12 16.9l-5.85 3.6 1.45-6.55-5.1-4.55 6.75-.7L12 2.5z"/></svg>';

  function htmlStevilkaZvezda() {
    return (
      '<span class="predlog-kartica__zvezda" aria-hidden="true">' +
      ikonaZvezdePrioriteta +
      "</span>" +
      '<span class="predlog-kartica__zvezda-cifra">1</span>'
    );
  }

  /** Številka 1: vidna »1« + mala zvezda zgoraj levo. */
  function nastaviVsebinoStevilkeGumba(gumb, n, razredPrioriteta) {
    if (Number(n) === 1) {
      gumb.classList.add(razredPrioriteta);
      gumb.innerHTML = htmlStevilkaZvezda();
      gumb.setAttribute("aria-label", "Prioritetna številka 1 – privzeto sporočilo");
    } else {
      gumb.classList.remove(razredPrioriteta);
      gumb.textContent = String(n);
      gumb.removeAttribute("aria-label");
    }
  }

  function pokaziNapako(besedilo, tehnicniPodatki) {
    if (!napaka) return;
    napaka.textContent = tehnicniPodatki ? besedilo + " (" + tehnicniPodatki + ")" : besedilo;
    napaka.hidden = false;
    napaka.scrollIntoView({ behavior: zeliZmanjsanoGibanje ? "auto" : "smooth", block: "start" });
  }

  function skrijNapako() {
    if (napaka) napaka.hidden = true;
  }

  function posodobiDrsnik() {
    if (!okvir || !indikator || !seznam) return;
    const maxScroll = seznam.scrollHeight - seznam.clientHeight;
    const proportionalHeight = Math.round(
      (seznam.clientHeight / Math.max(seznam.scrollHeight, 1)) * seznam.clientHeight
    );
    indikator.style.height = Math.max(60, proportionalHeight) + "px";
    const travel = Math.max(0, seznam.clientHeight - indikator.offsetHeight - 2);
    const ratio = maxScroll > 0 ? seznam.scrollTop / maxScroll : 0;
    indikator.style.transform = "translateY(" + Math.round(travel * ratio) + "px)";
  }

  function posodobiStanjeUrejevalnika() {
    const dolzina = besediloPolje.value.length;
    const imaBesedilo = besediloPolje.value.trim().length > 0;
    if (stevecPolja) stevecPolja.textContent = dolzina + "/" + NAJVEC_ZNAKOV;
    if (pomocPolja) {
      pomocPolja.textContent = imaBesedilo
        ? "Besedilo lahko poljubno uredite"
        : "Izberite predlog ali napišite svoje sporočilo";
    }
  }

  function oznaciShranjevanje() {
    if (!osnutekStatus) return;
    osnutekStatus.textContent = "Shranjevanje …";
    if (casovnikOsnutka) clearTimeout(casovnikOsnutka);
    casovnikOsnutka = setTimeout(() => {
      osnutekStatus.textContent = "Osnutek shranjen";
    }, 420);
  }

  let paymentDeadline = null;
  let installmentPlan = null;
  let privzetiDneviRoka = window.UJRokPlacila
    ? window.UJRokPlacila.naloziPrivzeteDni()
    : { 1: 3, 2: 5, 3: 7, 4: 10, 5: 14, 6: 21, 7: 30, 8: 45, 9: 60 };

  /** Prezrtja blokov v »Možna priporočila«.
   * Ponastavi se ob: (1) Uporabi druge predloge, (2) spremembi zneska/datuma/računa.
   * Ne več samo ob menjavi tona. */
  let priporocilaPrezrta = {
    rok: false,
    obrocno: false,
    predlogIdObPrezrtju: null,
    kontekstDolgaObPrezrtju: null,
  };

  function praznoPriporocilaPrezrta() {
    return {
      rok: false,
      obrocno: false,
      predlogIdObPrezrtju: null,
      kontekstDolgaObPrezrtju: null,
    };
  }

  function normalizirajPriporocilaPrezrta(raw) {
    const v = raw && typeof raw === "object" ? raw : {};
    return {
      rok: Boolean(v.rok),
      obrocno: Boolean(v.obrocno),
      predlogIdObPrezrtju: v.predlogIdObPrezrtju
        ? String(v.predlogIdObPrezrtju)
        : null,
      kontekstDolgaObPrezrtju:
        v.kontekstDolgaObPrezrtju != null
          ? String(v.kontekstDolgaObPrezrtju)
          : null,
    };
  }

  function kontekstDolgaZaPriporocila() {
    const p = podatkiKorak1 || {};
    const poti = Array.isArray(p.racunDatotekePoti)
      ? p.racunDatotekePoti.map(String).slice().sort().join("|")
      : "";
    return [
      String(p.znesek ?? ""),
      String(p.datumZapadlosti ?? ""),
      String(p.datumIzdajeRacuna ?? ""),
      String(p.stevilkaRacuna ?? ""),
      poti,
    ].join("::");
  }

  function ponastaviPriporocilaPrezrta() {
    priporocilaPrezrta = praznoPriporocilaPrezrta();
  }

  function shraniOsnutekLokalno() {
    oznaciShranjevanje();
    // Osnutek (textarea/predloga) – NE označi koraka kot izpolnjenega.
    // Zastavico potrjen ohranimo, če je uporabnik že uspešno nadaljeval na 3.
    const obstojeci = preberiKorak2Sejo();
    const zePotrjen = Boolean(obstojeci && obstojeci.potrjen === true);
    sessionStorage.setItem(
      KLJUC_SEJE_KORAK2_PODATKI,
      JSON.stringify({
        sporociloDolzniku: besediloPolje.value,
        izbranPredlogId,
        dodatki: { ...dodatki },
        dodatekBesedila: { ...dodatekBesedila },
        paymentDeadline: paymentDeadline,
        installmentPlan: installmentPlan,
        toneRecommendation: { ...toneState },
        sporociloRocnoUrejeno: sporociloRocnoUrejeno,
        priporocilaPrezrta: { ...priporocilaPrezrta },
        potrjen: zePotrjen,
      })
    );
  }

  function posodobiObrocnoKarticoStanje(plan) {
    const stanjeEl = document.getElementById("dodatek-obrocno-stanje");
    if (!stanjeEl) return;
    stanjeEl.textContent = plan && plan.enabled ? "Vklopljeno" : "Izklopljeno";
  }

  function formatRokDatumZaKartico(deadline) {
    if (!deadline || !deadline.enabled || !deadline.deadlineDate) return "";
    if (window.UJRokPlacila && window.UJRokPlacila.formatirajDatumZaPrikaz) {
      return (
        window.UJRokPlacila.formatirajDatumZaPrikaz(
          deadline.deadlineDate,
          "sl"
        ) || String(deadline.deadlineDate)
      );
    }
    return String(deadline.deadlineDate);
  }

  function posodobiRokKarticoStanje(deadline) {
    const stanjeEl = document.getElementById("dodatek-rok-stanje");
    if (!stanjeEl) return;
    const datum = formatRokDatumZaKartico(deadline);
    stanjeEl.textContent = datum || "Izklopljeno";
  }

  function resetirajDodatke() {
    dodatki.rok = false;
    dodatki.obrocno = false;
    dodatki.trr = false;
    dodatekBesedila.rok = "";
    dodatekBesedila.obrocno = "";
    dodatekBesedila.trr = "";
    installmentPlan = null;
    if (dodatekRok) dodatekRok.setAttribute("aria-pressed", "false");
    if (dodatekObrocno) dodatekObrocno.setAttribute("aria-pressed", "false");
    if (dodatekTrr) dodatekTrr.setAttribute("aria-pressed", "false");
    posodobiObrocnoKarticoStanje(null);
    posodobiRokKarticoStanje(null);
  }

  function normalizirajPaymentSettingsPredloge(raw) {
    if (window.UJPredlogaPaymentSettings) {
      return window.UJPredlogaPaymentSettings.normalizirajPaymentSettings(raw);
    }
    return raw == null ? null : raw;
  }

  function naloziMojePredlogeIzLocalStorage() {
    try {
      const surovo = localStorage.getItem(kljucMojihPredlogov);
      if (!surovo) return [];
      const seznam = JSON.parse(surovo);
      if (!Array.isArray(seznam)) return [];
      return seznam
        .filter((p) => p && typeof p.besedilo === "string" && p.besedilo.trim())
        .map((p) => ({
          id: String(p.id || "moj-" + Date.now()),
          naslov: String(p.naslov || "Moj predlog"),
          ikona: p.ikona || "message-circle",
          stilIkone: "",
          besedilo: String(p.besedilo).slice(0, NAJVEC_ZNAKOV),
          jeMoj: true,
          toneId: p.toneId || null,
          language: p.language || jezikPredlog,
          source: "user",
          order: Number(p.order) || null,
          isRecommended: false,
          overridesSystemId: p.overridesSystemId
            ? String(p.overridesSystemId)
            : null,
          paymentSettings: normalizirajPaymentSettingsPredloge(p.paymentSettings),
        }));
    } catch (_napaka) {
      return [];
    }
  }

  function shraniMojePredlogeVLocalStorage() {
    const zaShraniti = mojiPredlogi.map((p) => ({
      id: p.id,
      naslov: p.naslov,
      ikona: p.ikona || "message-circle",
      besedilo: p.besedilo,
      toneId: p.toneId || izbranTonId,
      language: p.language || jezikPredlog,
      order: p.order || null,
      source: "user",
      overridesSystemId: p.overridesSystemId || null,
      paymentSettings: normalizirajPaymentSettingsPredloge(p.paymentSettings),
    }));
    localStorage.setItem(kljucMojihPredlogov, JSON.stringify(zaShraniti));
  }

  function skrijSistemskoPredlogo(systemId) {
    if (!systemId) return;
    if (!Array.isArray(nastavitvePredlogov.skritiIds)) {
      nastavitvePredlogov.skritiIds = [];
    }
    const sid = String(systemId);
    if (!nastavitvePredlogov.skritiIds.includes(sid)) {
      nastavitvePredlogov.skritiIds.push(sid);
    }
  }

  function naloziNastavitvePredlogov() {
    try {
      const surovo = localStorage.getItem(kljucNastavitev);
      if (!surovo) return { stevilke: {}, skritiIds: [] };
      const podatki = JSON.parse(surovo);
      return {
        stevilke:
          podatki && podatki.stevilke && typeof podatki.stevilke === "object"
            ? podatki.stevilke
            : {},
        skritiIds: Array.isArray(podatki && podatki.skritiIds)
          ? podatki.skritiIds.map(String)
          : [],
      };
    } catch (_napaka) {
      return { stevilke: {}, skritiIds: [] };
    }
  }

  function shraniNastavitvePredlogov() {
    localStorage.setItem(kljucNastavitev, JSON.stringify(nastavitvePredlogov));
  }

  function pokaziObvestiloPredlogov(besedilo) {
    if (!predlogiObvestilo) return;
    predlogiObvestilo.textContent = besedilo;
    predlogiObvestilo.hidden = !besedilo;
  }

  function najdiProstoStevilko(zasedene, zeliOd, maxStevilk) {
    const maxN =
      maxStevilk ||
      (window.UJTonPredloge ? NAJVEC_STEVILK_V_TONU : 9);
    const zacetek = Math.max(1, Math.min(maxN, Number(zeliOd) || 1));
    for (let n = zacetek; n <= maxN; n++) {
      if (!zasedene.has(n)) return n;
    }
    for (let n = 1; n < zacetek; n++) {
      if (!zasedene.has(n)) return n;
    }
    return null;
  }

  function posodobiNaslovPredlogZaTon() {
    const naslovEl = document.getElementById("predloge-naslov");
    if (!naslovEl) return;
    if (window.UJTonPredloge) {
      naslovEl.textContent = window.UJTonPredloge.naslovRazdelkaZaTon(izbranTonId);
    } else {
      naslovEl.textContent = "Izberite predlogo";
    }
  }

  function sestaviSeznamPredlogov() {
    const skriti = new Set(nastavitvePredlogov.skritiIds || []);
    const vsi = [...mojiPredlogi, ...vgrajeniPredlogi].filter((p) => !skriti.has(p.id));

    if (window.UJTonPredloge) {
      const filtrirani = window.UJTonPredloge.filtrirajPredloge(
        vsi,
        izbranTonId,
        jezikPredlog
      );
      // Ne uporabljaj sortirajPredlogeZaTon – ta vsakič vsili sistemski order.
      predlogi = filtrirani.slice();
      const zasedene = new Set();
      predlogi.forEach((predlog) => {
        const zelena = Number(nastavitvePredlogov.stevilke[predlog.id]);
        if (
          Number.isInteger(zelena) &&
          zelena >= 1 &&
          zelena <= NAJVEC_STEVILK_V_TONU &&
          !zasedene.has(zelena)
        ) {
          predlog.stevilka = zelena;
          zasedene.add(zelena);
        } else {
          predlog.stevilka = null;
        }
      });
      predlogi.forEach((predlog, indeks) => {
        if (predlog.stevilka != null) return;
        const hint = Number(predlog.order) || indeks + 1;
        const prosta = najdiProstoStevilko(zasedene, hint);
        predlog.stevilka = prosta != null ? prosta : indeks + 1;
        nastavitvePredlogov.stevilke[predlog.id] = predlog.stevilka;
        if (prosta != null) zasedene.add(prosta);
      });
      predlogi.sort(
        (a, b) => (Number(a.stevilka) || 99) - (Number(b.stevilka) || 99)
      );
    } else {
      // Fallback brez ton-modula (stari način 1–9).
      predlogi = vsi;
      const zasedene = new Set();
      predlogi.forEach((predlog, indeks) => {
        predlog._indeks = indeks;
        const stevilka = Number(nastavitvePredlogov.stevilke[predlog.id]);
        if (
          Number.isInteger(stevilka) &&
          stevilka >= 1 &&
          stevilka <= 9 &&
          !zasedene.has(stevilka)
        ) {
          predlog.stevilka = stevilka;
          zasedene.add(stevilka);
        } else {
          predlog.stevilka = null;
        }
      });
      predlogi.forEach((predlog) => {
        if (predlog.stevilka != null) return;
        const zelena = Number(nastavitvePredlogov.stevilke[predlog.id]);
        const od = Number.isInteger(zelena) && zelena >= 1 && zelena <= 9 ? zelena : 1;
        const prosta = najdiProstoStevilko(zasedene, od, 9);
        predlog.stevilka = prosta != null ? prosta : 9;
        nastavitvePredlogov.stevilke[predlog.id] = predlog.stevilka;
        if (prosta != null) zasedene.add(prosta);
      });
      predlogi.sort((a, b) => {
        if (a.stevilka !== b.stevilka) return a.stevilka - b.stevilka;
        return a._indeks - b._indeks;
      });
    }

    posodobiNaslovPredlogZaTon();

    if (oznakaStevila) {
      const n = predlogi.length;
      oznakaStevila.textContent = String(n);
      oznakaStevila.setAttribute(
        "aria-label",
        n + (n === 1 ? " predlog" : " predlogov")
      );
    }
    shraniNastavitvePredlogov();
  }

  function vrniStevilkeIzbirnikDomov(izbirnik) {
    if (!izbirnik) return;
    izbirnik.classList.remove("predlog-kartica__stevilke-izbirnik--plavajoč");
    izbirnik.style.top = "";
    izbirnik.style.left = "";
    izbirnik.hidden = true;
    if (izbirnik._domov && izbirnik.parentElement !== izbirnik._domov) {
      izbirnik._domov.appendChild(izbirnik);
    }
  }

  function pozicionirajStevilkeIzbirnik(izbirnik, gumbStevilke) {
    const rect = gumbStevilke.getBoundingClientRect();
    const rob = 8;
    const sirina = izbirnik.offsetWidth;
    const visina = izbirnik.offsetHeight;
    let top = rect.bottom + 6;
    let left = rect.left;

    // Če spodaj ni prostora, odpri nad krogom.
    if (top + visina > window.innerHeight - rob) {
      top = Math.max(rob, rect.top - visina - 6);
    }
    // Ob ozkem zaslonu drži znotraj viewporta.
    if (left + sirina > window.innerWidth - rob) {
      left = Math.max(rob, window.innerWidth - sirina - rob);
    }
    if (left < rob) left = rob;

    izbirnik.style.top = Math.round(top) + "px";
    izbirnik.style.left = Math.round(left) + "px";
  }

  function odpriStevilkeIzbirnik(gumbStevilke, izbirnik) {
    const ovoj = gumbStevilke.closest(".predlog-kartica__stevilka-ovoj");
    if (!ovoj || !izbirnik) return;

    izbirnik._domov = ovoj;
    document.body.appendChild(izbirnik);
    izbirnik.hidden = false;
    izbirnik.classList.add("predlog-kartica__stevilke-izbirnik--plavajoč");
    pozicionirajStevilkeIzbirnik(izbirnik, gumbStevilke);
    gumbStevilke.setAttribute("aria-expanded", "true");
  }

  function zapriVseStevilkeIzbire() {
    document.querySelectorAll(".predlog-kartica__stevilke-izbirnik").forEach((el) => {
      vrniStevilkeIzbirnikDomov(el);
    });
    seznam.querySelectorAll(".predlog-kartica__stevilka").forEach((gumb) => {
      gumb.setAttribute("aria-expanded", "false");
    });
  }

  function nastaviStevilkoPredloga(predlogId, novaStevilka) {
    const id = String(predlogId);
    const maxN = window.UJTonPredloge ? NAJVEC_STEVILK_V_TONU : 9;
    const urejeni = predlogi
      .slice()
      .sort((a, b) => (Number(a.stevilka) || 99) - (Number(b.stevilka) || 99));
    const indeks = urejeni.findIndex((p) => String(p.id) === id);
    if (indeks < 0) return;

    const stara = Number(urejeni[indeks].stevilka) || indeks + 1;
    const zgornja = Math.min(maxN, urejeni.length);
    const nova = Math.max(1, Math.min(zgornja, Number(novaStevilka) || 1));

    if (stara !== nova) {
      const [predlog] = urejeni.splice(indeks, 1);
      urejeni.splice(nova - 1, 0, predlog);
    }

    // Sorazmerno: cel seznam dobi številke 1…n po novem vrstnem redu.
    urejeni.forEach((p, i) => {
      nastavitvePredlogov.stevilke[String(p.id)] = i + 1;
    });
    pokaziObvestiloPredlogov("");

    shraniNastavitvePredlogov();
    sestaviSeznamPredlogov();
    izrisiPredloge();
    // Če še sledimo privzetemu vrstnemu redu: nova št. 1 → novo besedilo zgoraj.
    if (slediPrivzetiStevilki1) {
      uporabiPredlogStevilka1(true);
    } else if (izbranPredlogId) {
      oznaciIzbranega(izbranPredlogId);
      syncRokPoMenjaviPredloga();
    }
  }

  function stevilkaIzbranegaPredloga() {
    if (!izbranPredlogId) return 1;
    const p = predlogi.find((x) => String(x.id) === String(izbranPredlogId));
    const n = Number(p && p.stevilka);
    return n >= 1 && n <= 9 ? n : 1;
  }

  function bazaDatumaPosiljanja() {
    // Načrtovanega pošiljanja še ni – uporabi današnji lokalni datum.
    return window.UJRokPlacila
      ? window.UJRokPlacila.danesYYYYMMDD()
      : new Date().toISOString().slice(0, 10);
  }

  /** Samodejni rok: ob menjavi številke/predloga posodobi vrstico. */
  function syncRokPoMenjaviPredloga() {
    const UJ = window.UJRokPlacila;
    if (!UJ || !paymentDeadline || !paymentDeadline.enabled) return;
    if (paymentDeadline.mode !== "automatic") return;
    const linked = stevilkaIzbranegaPredloga();
    const days = Number(privzetiDneviRoka[linked]) || 5;
    const base = bazaDatumaPosiljanja();
    const deadline = UJ.izracunajRok(base, days);
    const jezik =
      paymentDeadline.messageLanguage || UJ.ugotoviJezikSporocila(besediloPolje.value);
    const vrstica = UJ.sestaviVrsticoRoka(deadline, jezik);
    const rez = UJ.posodobiSistemskoVrstico(
      besediloPolje.value,
      paymentDeadline.insertedText || "",
      vrstica,
      true
    );
    if (!rez.ok) return;
    besediloPolje.value = String(rez.besedilo).slice(0, NAJVEC_ZNAKOV);
    paymentDeadline = {
      ...paymentDeadline,
      linkedProposalNumber: linked,
      termDays: days,
      deadlineDate: deadline,
      baseSendDate: base,
      insertedText: vrstica,
      messageLanguage: jezik,
    };
    dodatekBesedila.rok = vrstica;
    dodatki.rok = true;
    if (dodatekRok) dodatekRok.setAttribute("aria-pressed", "true");
    posodobiRokKarticoStanje(paymentDeadline);
    posodobiStanjeUrejevalnika();
    shraniOsnutekLokalno();
  }

  function stevilkaPredlogeZaPaket(predlog) {
    const n = Number(predlog && predlog.stevilka);
    return n >= 1 && n <= 9 ? n : 1;
  }

  function znesekCentovZaPaket() {
    if (window.UJObrocno) {
      const c = window.UJObrocno.eurosToCents(podatkiKorak1.znesek);
      return c != null && c > 0 ? c : 0;
    }
    return 0;
  }

  function vstaviDodatekVBesedilo(vrstica) {
    const UJ = window.UJRokPlacila;
    if (UJ && typeof UJ.posodobiSistemskoVrstico === "function") {
      const rez = UJ.posodobiSistemskoVrstico(
        besediloPolje.value,
        "",
        vrstica,
        true
      );
      besediloPolje.value = String(rez.besedilo).slice(0, NAJVEC_ZNAKOV);
      return;
    }
    const osnova = String(besediloPolje.value || "").replace(/\s+$/, "");
    besediloPolje.value = (osnova ? osnova + "\n\n" + vrstica : vrstica).slice(
      0,
      NAJVEC_ZNAKOV
    );
  }

  /**
   * Uveljavi paymentSettings predloge (recept → sveži dodatki).
   * Kliče se samo, če paket obstaja (po resetu dodatkov).
   */
  function uveljaviPaymentSettingsPredloge(predlog, paketRaw) {
    const PPS = window.UJPredlogaPaymentSettings;
    const navodilo = PPS
      ? PPS.pripraviUveljavitev(paketRaw)
      : (() => {
          const p = normalizirajPaymentSettingsPredloge(paketRaw);
          return p
            ? {
                resetDodatke: true,
                rok: p.rok.enabled
                  ? { termDays: p.rok.termDays, mode: "automatic" }
                  : null,
                obrocno: p.obrocno.enabled
                  ? {
                      installmentCount: p.obrocno.installmentCount,
                      intervalType: p.obrocno.intervalType,
                    }
                  : null,
                trr: Boolean(p.trr.enabled),
              }
            : null;
        })();
    if (!navodilo) return;

    resetirajDodatke();
    paymentDeadline = null;

    const UJ = window.UJRokPlacila;
    const UJO = window.UJObrocno;
    const linked = stevilkaPredlogeZaPaket(predlog);
    const tonId = predlog.toneId || izbranTonId || null;

    if (navodilo.rok && UJ) {
      const base = bazaDatumaPosiljanja();
      const days = Number(navodilo.rok.termDays) || 14;
      const deadline = UJ.izracunajRok(base, days);
      const jezik = UJ.ugotoviJezikSporocila(besediloPolje.value);
      const vrstica = UJ.sestaviVrsticoRoka(deadline, jezik);
      vstaviDodatekVBesedilo(vrstica);
      paymentDeadline = {
        enabled: true,
        mode: "automatic",
        linkedProposalNumber: linked,
        linkedToneId: tonId,
        termDays: days,
        deadlineDate: deadline,
        baseSendDate: base,
        insertedText: vrstica,
        messageLanguage: jezik,
      };
      dodatekBesedila.rok = vrstica;
      dodatki.rok = true;
      if (dodatekRok) dodatekRok.setAttribute("aria-pressed", "true");
      posodobiRokKarticoStanje(paymentDeadline);
    }

    if (navodilo.obrocno && UJO) {
      const total = znesekCentovZaPaket();
      if (total > 0) {
        const jezik = UJ
          ? UJ.ugotoviJezikSporocila(besediloPolje.value)
          : "de";
        let plan = UJO.getInstallmentSuggestion({
          totalDebtCents: total,
          originalDueDate: podatkiKorak1.datumZapadlosti || null,
          plannedSendDate: bazaDatumaPosiljanja(),
          linkedProposalNumber: linked,
          toneId: tonId,
          language: jezik,
        });
        plan = UJO.nastaviSteviloObrokov(
          plan,
          Number(navodilo.obrocno.installmentCount) || 2
        );
        if (navodilo.obrocno.intervalType) {
          plan = UJO.nastaviRazmik(plan, navodilo.obrocno.intervalType);
        }
        plan = UJO.osveziAddon(plan, jezik);
        plan.enabled = true;
        const vrstica = plan.addonText || "";
        if (vrstica) vstaviDodatekVBesedilo(vrstica);
        installmentPlan = plan;
        dodatekBesedila.obrocno = vrstica;
        dodatki.obrocno = true;
        if (dodatekObrocno) dodatekObrocno.setAttribute("aria-pressed", "true");
        posodobiObrocnoKarticoStanje(plan);
      }
    }

    if (navodilo.trr) {
      const iban = (podatkiKorak1.iban || "").trim();
      if (iban) {
        const vrstica = "TRR: " + iban + ".";
        vstaviDodatekVBesedilo(vrstica);
        dodatekBesedila.trr = vrstica;
        dodatki.trr = true;
        if (dodatekTrr) dodatekTrr.setAttribute("aria-pressed", "true");
      }
    }
  }

  async function uporabiPredlog(predlog, opcije) {
    const tiho = Boolean(opcije && opcije.tiho);
    if (
      !tiho &&
      sporociloRocnoUrejeno &&
      besediloPolje.value.trim().length > 0
    ) {
      const potrjeno = await potrdiVprasanje({
        naslov: "Zamenjam besedilo?",
        opis: "Z izbiro druge predloge boste zamenjali trenutno besedilo in nastavitve.",
        potrdiBesedilo: "Uporabi novo predlogo",
        prekliciBesedilo: "Prekliči",
        stil: "primary",
      });
      if (!potrjeno) return false;
    }

    /* Druga predloga (ne ista kot trenutno izbrana) → ponovno pokaži prezrta priporočila. */
    const prejsnjiPredlogId = izbranPredlogId;
    if (
      (priporocilaPrezrta.rok || priporocilaPrezrta.obrocno) &&
      String(prejsnjiPredlogId || "") !== String(predlog.id)
    ) {
      ponastaviPriporocilaPrezrta();
    }

    const PPS = window.UJPredlogaPaymentSettings;
    const navodilo = PPS
      ? PPS.pripraviUveljavitev(predlog.paymentSettings)
      : normalizirajPaymentSettingsPredloge(predlog.paymentSettings);

    besediloPolje.value = String(predlog.besedilo || "").slice(0, NAJVEC_ZNAKOV);
    oznaciIzbranega(predlog.id);
    slediPrivzetiStevilki1 = Number(predlog.stevilka) === 1;

    if (navodilo) {
      // S paketom: počisti dodatke in uveljavi recept te predloge.
      uveljaviPaymentSettingsPredloge(predlog, predlog.paymentSettings);
    }
    // Brez paketa: dodatkov (rok/obročno/TRR) ne spreminjaj.

    toneState.appliedToneId = predlog.toneId || izbranTonId;
    if (predlog.toneId && predlog.toneId !== izbranTonId) {
      nastaviIzbranTon(predlog.toneId, false);
    }
    zadnjeUporabljenoBesediloPredloge = besediloPolje.value;
    sporociloRocnoUrejeno = false;
    posodobiObvestiloNeuporabljenegaTona();
    posodobiNamigeTonaDodatkov();

    posodobiStanjeUrejevalnika();
    shraniOsnutekLokalno();
    return true;
  }

  const modalDialog = modal
    ? modal.querySelector(".template-editor__shell") ||
      document.getElementById("predogled-dialog")
    : null;

  function updateTemplateEditorViewport() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    document.documentElement.style.setProperty(
      "--template-viewport-height",
      viewport.height + "px"
    );
    document.documentElement.style.setProperty(
      "--template-viewport-top",
      viewport.offsetTop + "px"
    );
  }

  function pritrdiUrediModalNaVrh() {
    updateTemplateEditorViewport();
    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        updateTemplateEditorViewport
      );
      window.visualViewport.addEventListener(
        "scroll",
        updateTemplateEditorViewport
      );
    }
    window.addEventListener("resize", updateTemplateEditorViewport);
  }

  function odstraniPritrditevUrediModala() {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener(
        "resize",
        updateTemplateEditorViewport
      );
      window.visualViewport.removeEventListener(
        "scroll",
        updateTemplateEditorViewport
      );
    }
    window.removeEventListener("resize", updateTemplateEditorViewport);
  }

  function zakleniOzadjeZaUrediModal() {
    templateEditorScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add("template-editor-odprt");
    document.body.style.position = "fixed";
    document.body.style.top = "-" + templateEditorScrollY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function odkleniOzadjeZaUrediModal() {
    document.body.classList.remove("template-editor-odprt");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, templateEditorScrollY || 0);
  }

  function premakniModalVBody() {
    if (!modal) return;
    if (!templateEditorParent) templateEditorParent = modal.parentNode;
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }
  }

  function vrniModalNaMesto() {
    if (!modal || !templateEditorParent) return;
    if (modal.parentNode !== templateEditorParent) {
      templateEditorParent.appendChild(modal);
    }
  }

  function privzetaStevilkaZaNovPredlog() {
    const zasedene = new Set(
      predlogi.map((p) => Number(nastavitvePredlogov.stevilke[p.id]) || p.stevilka)
    );
    return najdiProstoStevilko(zasedene, 1) || 1;
  }

  function posodobiModalStevilkeUI() {
    if (!modalStevilkeMreza) return;
    modalStevilkeMreza
      .querySelectorAll(".korak2-modal__stevilka-izbira")
      .forEach((gumb) => {
        const n = Number(gumb.dataset.stevilka);
        gumb.setAttribute(
          "aria-selected",
          n === modalIzbranaStevilka ? "true" : "false"
        );
      });
  }

  function pripraviModalStevilke() {
    if (!modalStevilkeMreza || modalStevilkeMreza.childElementCount > 0) return;
    for (let n = 1; n <= 9; n++) {
      const gumb = document.createElement("button");
      gumb.type = "button";
      gumb.className = "korak2-modal__stevilka-izbira";
      gumb.dataset.stevilka = String(n);
      gumb.setAttribute("role", "option");
      nastaviVsebinoStevilkeGumba(
        gumb,
        n,
        "korak2-modal__stevilka-izbira--prioriteta"
      );
      gumb.addEventListener("click", () => {
        modalIzbranaStevilka = n;
        posodobiModalStevilkeUI();
        skrijPriporociloVrstico();
      });
      modalStevilkeMreza.appendChild(gumb);
    }
  }

  function tonZaModalPlacila() {
    return (
      (odprtPredlog && odprtPredlog.toneId) ||
      tonZaPriporocila() ||
      izbranTonId ||
      "friendly"
    );
  }

  function zacetniPaketZaModal() {
    if (
      window.UJPredlogaPaymentSettings &&
      typeof window.UJPredlogaPaymentSettings.zacetniPaketZaUrejanje === "function"
    ) {
      return window.UJPredlogaPaymentSettings.zacetniPaketZaUrejanje(
        tonZaModalPlacila()
      );
    }
    return {
      version: 1,
      rok: { enabled: false, mode: "automatic", termDays: 14 },
      obrocno: {
        enabled: false,
        installmentCount: 4,
        intervalType: "monthly",
      },
      trr: { enabled: false },
    };
  }

  function oznakaIntervala(intervalType) {
    if (intervalType === "weekly") return "tedensko";
    if (intervalType === "biweekly") return "vsaka 2 tedna";
    if (intervalType === "monthly") return "mesečno";
    return "";
  }

  function posodobiModalDodatkeKartice() {
    const p =
      normalizirajPaymentSettingsPredloge(
        odprtPredlog && odprtPredlog.paymentSettings
      ) || zacetniPaketZaModal();

    if (modalDodatekRok) {
      modalDodatekRok.setAttribute(
        "aria-pressed",
        p.rok.enabled ? "true" : "false"
      );
    }
    if (modalDodatekRokStanje) {
      modalDodatekRokStanje.textContent = p.rok.enabled
        ? "Vklopljeno"
        : "Izklopljeno";
    }

    if (modalDodatekObrocno) {
      modalDodatekObrocno.setAttribute(
        "aria-pressed",
        p.obrocno.enabled ? "true" : "false"
      );
    }
    if (modalDodatekObrocnoStanje) {
      modalDodatekObrocnoStanje.textContent = p.obrocno.enabled
        ? "Vklopljeno"
        : "Izklopljeno";
    }

    if (modalDodatekTrr) {
      modalDodatekTrr.setAttribute(
        "aria-pressed",
        p.trr.enabled ? "true" : "false"
      );
    }
    if (modalDodatekTrrStanje) {
      if (!p.trr.enabled) {
        modalDodatekTrrStanje.textContent = "Izklopljeno";
      } else {
        const iban = (podatkiKorak1.iban || "").trim();
        const konec = iban ? iban.slice(-4) : "";
        modalDodatekTrrStanje.textContent = konec
          ? "Privzeti • …" + konec
          : "Privzeti";
      }
    }
  }

  function posodobiModalStevec() {
    if (!modalStevec || !modalUrejevalnik) return;
    modalStevec.textContent =
      String(modalUrejevalnik.value.length) + "/" + NAJVEC_ZNAKOV;
  }

  function posodobiPredlagajTonGumb() {
    const imaBesedilo = Boolean(
      modalUrejevalnik && modalUrejevalnik.value.trim()
    );
    if (modalPredlagajTon) modalPredlagajTon.disabled = !imaBesedilo;
    if (modalPredlagajTonHint) modalPredlagajTonHint.hidden = imaBesedilo;
  }

  function skrijPriporociloVrstico() {
    recommendationSnapshot = null;
    if (modalPriporociloVrstica) modalPriporociloVrstica.hidden = true;
  }

  function posnetekTrenutnegaOsnutka() {
    return {
      naslov: (modalNaslovVnos && modalNaslovVnos.value) || "",
      besedilo: (modalUrejevalnik && modalUrejevalnik.value) || "",
      stevilka: modalIzbranaStevilka,
      toneId: (odprtPredlog && odprtPredlog.toneId) || null,
      paymentSettings: normalizirajPaymentSettingsPredloge(
        odprtPredlog && odprtPredlog.paymentSettings
      ),
    };
  }

  function imaNeshranjeneSpremembe() {
    if (!originalTemplateSnapshot) return false;
    const zdaj = posnetekTrenutnegaOsnutka();
    return JSON.stringify(zdaj) !== JSON.stringify(originalTemplateSnapshot);
  }

  function napolniUiIzPosnetka(snap) {
    if (!snap || !odprtPredlog) return;
    if (modalNaslovVnos) modalNaslovVnos.value = snap.naslov || "";
    if (modalUrejevalnik) modalUrejevalnik.value = snap.besedilo || "";
    modalIzbranaStevilka = Number(snap.stevilka) || 1;
    odprtPredlog.toneId = snap.toneId || odprtPredlog.toneId;
    odprtPredlog.paymentSettings =
      normalizirajPaymentSettingsPredloge(snap.paymentSettings) ||
      zacetniPaketZaModal();
    posodobiModalStevilkeUI();
    posodobiModalDodatkeKartice();
    posodobiModalStevec();
    posodobiPredlagajTonGumb();
  }

  function labelTona(toneId) {
    const id = String(toneId || "");
    if (id === "friendly" || id === "very_friendly") return "Prijazen";
    if (id === "firm" || id === "neutral") return "Odločen";
    if (id === "strict" || id === "very_strict") return "Strog";
    return "Predlagani";
  }

  function ocistiSheetLockPoUrediModalu() {
    predlogaSheetOdpriToken += 1;
    predlogaSheetAktiven = false;
    predlogaSheetSaved = false;
    predlogaDraftDeadline = null;
    predlogaDraftPlan = null;
    modalDodatkiKlikPavzaDo = 0;
    if (modalDodatkiPavzaCasovnik) {
      clearTimeout(modalDodatkiPavzaCasovnik);
      modalDodatkiPavzaCasovnik = null;
    }
    if (modal) modal.classList.remove("template-editor--sheet-pavza");
    // Zapri sheete brez onClose (brez shranjevanja osnutka) in odkleni scroll.
    try {
      if (obrocnoSheetApi && typeof obrocnoSheetApi.zapriNaSilo === "function") {
        obrocnoSheetApi.zapriNaSilo();
      }
    } catch (_e) {
      /* ignore */
    }
    try {
      if (rokSheetApi && typeof rokSheetApi.zapriNaSilo === "function") {
        rokSheetApi.zapriNaSilo();
      }
    } catch (_e2) {
      /* ignore */
    }
    document.body.classList.remove("obrocno-sheet-odprt", "rok-sheet-odprt");
    const obEl = document.getElementById("obrocno-sheet");
    if (obEl) obEl.hidden = true;
    const rokEl = document.getElementById("rok-sheet");
    if (rokEl) rokEl.hidden = true;
  }

  async function zapriUrediModal(opcije) {
    if (!modal) return;
    const vsili = Boolean(opcije && opcije.vsili);
    if (!vsili && imaNeshranjeneSpremembe()) {
      const zavrzi = await potrdiVprasanje({
        naslov: "Želite zavreči neshranjene spremembe?",
        opis: "",
        potrdiBesedilo: "Zavrzi spremembe",
        prekliciBesedilo: "Nadaljuj urejanje",
        stil: "nevarno",
      });
      if (!zavrzi) return;
    }
    ocistiSheetLockPoUrediModalu();
    odstraniPritrditevUrediModala();
    modal.hidden = true;
    odkleniOzadjeZaUrediModal();
    vrniModalNaMesto();
    odprtPredlog = null;
    originalTemplateSnapshot = null;
    recommendationSnapshot = null;
    if (modalNaslovVnos) modalNaslovVnos.value = "";
    if (modalUrejevalnik) modalUrejevalnik.value = "";
    if (modalIzbrisi) modalIzbrisi.hidden = false;
    if (modalPreklici) modalPreklici.hidden = true;
    if (modalStevilkaOvoj) modalStevilkaOvoj.hidden = true;
    if (modalPriporociloVrstica) modalPriporociloVrstica.hidden = true;
  }

  function posodobiPredogledUporabiGumb() {
    if (!predlogaPredogledUporabi || !predogledPredlog) return;
    const jeIzbrana =
      izbranPredlogId != null &&
      String(predogledPredlog.id) === String(izbranPredlogId);
    predlogaPredogledUporabi.setAttribute(
      "aria-pressed",
      jeIzbrana ? "true" : "false"
    );
    predlogaPredogledUporabi.textContent = jeIzbrana ? "Izbrano" : "Uporabi";
  }

  function zakleniOzadjeZaPredogled() {
    predogledScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add("predloga-predogled-odprt");
    document.body.style.position = "fixed";
    document.body.style.top = "-" + predogledScrollY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function odkleniOzadjeZaPredogled() {
    document.body.classList.remove("predloga-predogled-odprt");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, predogledScrollY || 0);
  }

  function predogledZeliAnimacijo() {
    return !(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function ocistiPredogledZapiranje() {
    if (predogledZapriCasovnik != null) {
      clearTimeout(predogledZapriCasovnik);
      predogledZapriCasovnik = null;
    }
    if (predogledZapriHandler && predlogaPredogled) {
      const panel = predlogaPredogled.querySelector(".predloga-predogled__panel");
      if (panel) panel.removeEventListener("transitionend", predogledZapriHandler);
      predogledZapriHandler = null;
    }
  }

  function zapriPredlogaPredogled(opcije) {
    if (!predlogaPredogled || predlogaPredogled.hidden) return;
    const takoj = Boolean(opcije && opcije.takoj);

    const dokoncaj = () => {
      ocistiPredogledZapiranje();
      if (predlogaPredogled.hidden) return;
      predlogaPredogled.classList.remove("predloga-predogled--odprt");
      predlogaPredogled.hidden = true;
      predogledPredlog = null;
      odkleniOzadjeZaPredogled();
    };

    if (
      takoj ||
      !predogledZeliAnimacijo() ||
      !predlogaPredogled.classList.contains("predloga-predogled--odprt")
    ) {
      dokoncaj();
      return;
    }

    ocistiPredogledZapiranje();
    const panel = predlogaPredogled.querySelector(".predloga-predogled__panel");
    predogledZapriHandler = (dogodek) => {
      if (dogodek.target !== panel) return;
      if (
        dogodek.propertyName !== "opacity" &&
        dogodek.propertyName !== "transform"
      ) {
        return;
      }
      dokoncaj();
    };
    if (panel) panel.addEventListener("transitionend", predogledZapriHandler);
    predlogaPredogled.classList.remove("predloga-predogled--odprt");
    predogledZapriCasovnik = setTimeout(dokoncaj, 280);
  }

  function odpriPredlogaPredogled(predlog) {
    if (!predlogaPredogled || !predlog) return;
    zapriVseStevilkeIzbire();
    ocistiPredogledZapiranje();
    predogledPredlog = predlog;
    if (predlogaPredogledNaslov) {
      predlogaPredogledNaslov.textContent = predlog.naslov || "Predloga";
    }
    if (predlogaPredogledBesedilo) {
      predlogaPredogledBesedilo.textContent = predlog.besedilo || "";
    }
    posodobiPredogledUporabiGumb();
    predlogaPredogled.classList.remove("predloga-predogled--odprt");
    predlogaPredogled.hidden = false;
    zakleniOzadjeZaPredogled();
    void predlogaPredogled.offsetWidth;
    requestAnimationFrame(() => {
      if (!predlogaPredogled || predlogaPredogled.hidden) return;
      predlogaPredogled.classList.add("predloga-predogled--odprt");
    });
    if (
      predlogaPredogledNaslov &&
      typeof predlogaPredogledNaslov.focus === "function"
    ) {
      predlogaPredogledNaslov.focus();
    }
  }

  function odpriUrediModal(predlog) {
    if (!modal || !modalUrejevalnik) return;
    const obstojeciPaket = normalizirajPaymentSettingsPredloge(
      predlog.paymentSettings
    );
    odprtPredlog = {
      ...predlog,
      paymentSettings: obstojeciPaket || zacetniPaketZaModal(),
    };
    recommendationSnapshot = null;
    if (modalPriporociloVrstica) modalPriporociloVrstica.hidden = true;

    if (modalNaslovGlava) {
      modalNaslovGlava.textContent = predlog.jeNov
        ? "Nova predloga"
        : "Uredi predlogo";
    }
    if (modalNaslovVnos) modalNaslovVnos.value = (predlog.naslov || "").slice(0, 80);
    modalUrejevalnik.value = (predlog.besedilo || "").slice(0, NAJVEC_ZNAKOV);
    posodobiModalStevec();
    posodobiPredlagajTonGumb();

    if (modalShrani) {
      modalShrani.textContent = predlog.jeNov ? "Shrani predlogo" : "Spremeni";
    }
    if (modalIzbrisi) {
      modalIzbrisi.hidden = !!predlog.jeNov;
      modalIzbrisi.textContent = "Izbriši predlogo";
    }
    if (modalPreklici) modalPreklici.hidden = !predlog.jeNov;

    if (modalStevilkaOvoj) modalStevilkaOvoj.hidden = false;
    pripraviModalStevilke();
    if (predlog.jeNov) {
      modalIzbranaStevilka = privzetaStevilkaZaNovPredlog();
    } else {
      const trenutna = Number(
        predlog.stevilka || nastavitvePredlogov.stevilke[predlog.id]
      );
      modalIzbranaStevilka =
        Number.isInteger(trenutna) && trenutna >= 1 && trenutna <= 9
          ? trenutna
          : privzetaStevilkaZaNovPredlog();
    }
    posodobiModalStevilkeUI();
    posodobiModalDodatkeKartice();
    if (modalPlacila) modalPlacila.hidden = false;

    premakniModalVBody();
    zakleniOzadjeZaUrediModal();
    modal.hidden = false;
    pritrdiUrediModalNaVrh();
    originalTemplateSnapshot = posnetekTrenutnegaOsnutka();

    if (modalVsebina) modalVsebina.scrollTop = 0;
    // Ne fokusiraj input/textarea ob odprtju – sicer se na mobilcu takoj odpre tipkovnica.
    if (modalNaslovGlava && typeof modalNaslovGlava.focus === "function") {
      modalNaslovGlava.focus();
    }
  }

  function odpriNovPredlogModal() {
    odpriUrediModal({
      id: null,
      naslov: "",
      besedilo: "",
      jeMoj: true,
      jeNov: true,
      ikona: "message-circle",
      toneId: izbranTonId || null,
      paymentSettings: null,
    });
  }

  function pavzirajKlikeNaModalDodatke(ms) {
    const delay = Number(ms) > 0 ? Number(ms) : 450;
    modalDodatkiKlikPavzaDo = Date.now() + delay;
    if (modal) modal.classList.add("template-editor--sheet-pavza");
    if (modalDodatkiPavzaCasovnik) clearTimeout(modalDodatkiPavzaCasovnik);
    modalDodatkiPavzaCasovnik = setTimeout(() => {
      modalDodatkiPavzaCasovnik = null;
      if (Date.now() >= modalDodatkiKlikPavzaDo && modal) {
        modal.classList.remove("template-editor--sheet-pavza");
      }
    }, delay);
  }

  function modalDodatkiKlikDovoljen() {
    return Date.now() >= modalDodatkiKlikPavzaDo;
  }

  function poZaprtjuSheetaNadPredlogo() {
    pavzirajKlikeNaModalDodatke(450);
    if (modalNaslovGlava && typeof modalNaslovGlava.focus === "function") {
      try {
        modalNaslovGlava.focus();
      } catch (_e) {
        /* ignore */
      }
    }
  }

  function odpriModalDodatekRok() {
    if (!modalDodatkiKlikDovoljen()) return;
    if (!rokSheetApi || typeof rokSheetApi.odpri !== "function") {
      pokaziNapako(
        "Nastavitve roka plačila se niso naložile. Osvežite stran (Ctrl+F5)."
      );
      return;
    }
    const p =
      normalizirajPaymentSettingsPredloge(
        odprtPredlog && odprtPredlog.paymentSettings
      ) || zacetniPaketZaModal();
    predlogaSheetAktiven = true;
    predlogaSheetSaved = false;
    predlogaSheetBesedilo.value = (modalUrejevalnik && modalUrejevalnik.value) || "";
    predlogaDraftDodatki.rok = false;
    predlogaDraftDodatekBesedila.rok = "";
    const UJ = window.UJRokPlacila;
    const days = Number(p.rok.termDays) || 14;
    const base = bazaDatumaPosiljanja();
    predlogaDraftDeadline = p.rok.enabled
      ? {
          enabled: true,
          mode: "automatic",
          linkedProposalNumber: Number(modalIzbranaStevilka) || 1,
          linkedToneId: (odprtPredlog && odprtPredlog.toneId) || null,
          termDays: days,
          deadlineDate: UJ ? UJ.izracunajRok(base, days) : "",
          baseSendDate: base,
          insertedText: "",
          messageLanguage: "sl",
        }
      : null;

    const rokToken = ++predlogaSheetOdpriToken;
    window.setTimeout(() => {
      if (rokToken !== predlogaSheetOdpriToken) return;
      if (!document.body.classList.contains("template-editor-odprt")) return;
      rokSheetApi.odpri({
        termDays: days,
        toneId: tonZaModalPlacila(),
        onClose: () => {
          if (predlogaSheetSaved) {
            const d = predlogaDraftDeadline;
            if (d && d.enabled) {
              odprtPredlog.paymentSettings = normalizirajPaymentSettingsPredloge({
                ...(odprtPredlog.paymentSettings || zacetniPaketZaModal()),
                rok: {
                  enabled: true,
                  mode: "automatic",
                  termDays: Number(d.termDays) || days,
                },
                obrocno: {
                  ...(odprtPredlog.paymentSettings &&
                    odprtPredlog.paymentSettings.obrocno),
                  enabled: false,
                },
              });
            } else {
              const cur =
                odprtPredlog.paymentSettings || zacetniPaketZaModal();
              odprtPredlog.paymentSettings = normalizirajPaymentSettingsPredloge({
                ...cur,
                rok: { ...cur.rok, enabled: false },
              });
            }
            skrijPriporociloVrstico();
            posodobiModalDodatkeKartice();
          }
          predlogaSheetAktiven = false;
          predlogaSheetSaved = false;
          predlogaDraftDeadline = null;
          if (installmentPlan) posodobiObrocnoKarticoStanje(installmentPlan);
          poZaprtjuSheetaNadPredlogo();
        },
      });
    }, 0);
  }

  function odpriModalDodatekObrocno() {
    if (!modalDodatkiKlikDovoljen()) return;
    if (!obrocnoSheetApi || typeof obrocnoSheetApi.odpri !== "function") {
      pokaziNapako(
        "Nastavitve obročnega plačila se niso naložile. Osvežite stran (Ctrl+F5)."
      );
      return;
    }
    const p =
      normalizirajPaymentSettingsPredloge(
        odprtPredlog && odprtPredlog.paymentSettings
      ) || zacetniPaketZaModal();
    predlogaSheetAktiven = true;
    predlogaSheetSaved = false;
    predlogaSheetBesedilo.value = (modalUrejevalnik && modalUrejevalnik.value) || "";
    predlogaDraftDodatki.obrocno = false;
    predlogaDraftDodatekBesedila.obrocno = "";
    // Osnutek naredi sheet v predlogaNacin (ne zgolj jePlanUporaben + fiksen 10000 €).
    predlogaDraftPlan = null;

    let totalZaPredlogo = 10000;
    if (window.UJObrocno) {
      const x = window.UJObrocno.eurosToCents(podatkiKorak1.znesek);
      if (x != null && x > 0) totalZaPredlogo = x;
    }

    const obToken = ++predlogaSheetOdpriToken;
    window.setTimeout(() => {
      if (obToken !== predlogaSheetOdpriToken) return;
      if (!document.body.classList.contains("template-editor-odprt")) return;
      obrocnoSheetApi.odpri({
        toneId: tonZaModalPlacila(),
        predlogaNacin: true,
        totalDebtCents: totalZaPredlogo,
        zacetnoEnabled: Boolean(p.obrocno && p.obrocno.enabled),
        zacetnoStevilo:
          p.obrocno && p.obrocno.enabled
            ? Number(p.obrocno.installmentCount) || 2
            : null,
        zacetnoInterval:
          p.obrocno && p.obrocno.enabled
            ? p.obrocno.intervalType || "monthly"
            : null,
        onClose: () => {
          if (predlogaSheetSaved) {
            const plan = predlogaDraftPlan;
            if (plan && plan.enabled) {
              odprtPredlog.paymentSettings = normalizirajPaymentSettingsPredloge({
                ...(odprtPredlog.paymentSettings || zacetniPaketZaModal()),
                rok: {
                  ...((odprtPredlog.paymentSettings &&
                    odprtPredlog.paymentSettings.rok) ||
                    {}),
                  enabled: false,
                },
                obrocno: {
                  enabled: true,
                  installmentCount:
                    Number(plan.installmentCount) ||
                    (plan.installments && plan.installments.length) ||
                    2,
                  intervalType: plan.intervalType || "monthly",
                },
              });
            } else {
              const cur =
                odprtPredlog.paymentSettings || zacetniPaketZaModal();
              odprtPredlog.paymentSettings = normalizirajPaymentSettingsPredloge({
                ...cur,
                obrocno: { ...cur.obrocno, enabled: false },
              });
            }
            skrijPriporociloVrstico();
            posodobiModalDodatkeKartice();
          }
          predlogaSheetAktiven = false;
          predlogaSheetSaved = false;
          predlogaDraftPlan = null;
          if (installmentPlan) posodobiObrocnoKarticoStanje(installmentPlan);
          else if (dodatekObrocno) {
            dodatekObrocno.setAttribute("aria-pressed", String(dodatki.obrocno));
          }
          poZaprtjuSheetaNadPredlogo();
        },
      });
    }, 0);
  }

  function preklopiModalTrr() {
    if (!modalDodatkiKlikDovoljen()) return;
    if (!odprtPredlog) return;
    const cur =
      normalizirajPaymentSettingsPredloge(odprtPredlog.paymentSettings) ||
      zacetniPaketZaModal();
    const iban = (podatkiKorak1.iban || "").trim();
    if (!cur.trr.enabled && !iban) {
      pokaziNapako(
        "TRR/IBAN še ni na voljo v podatkih zadeve – dodajte ga v prvem koraku."
      );
      return;
    }
    odprtPredlog.paymentSettings = normalizirajPaymentSettingsPredloge({
      ...cur,
      trr: { enabled: !cur.trr.enabled },
    });
    skrijPriporociloVrstico();
    posodobiModalDodatkeKartice();
  }

  function predlagajTonZaPredlogo() {
    if (!odprtPredlog || !modalUrejevalnik) return;
    const besedilo = modalUrejevalnik.value.trim();
    if (!besedilo) {
      posodobiPredlagajTonGumb();
      if (modalPredlagajTonHint) modalPredlagajTonHint.hidden = false;
      return;
    }
    recommendationSnapshot = posnetekTrenutnegaOsnutka();

    let toneId = tonZaModalPlacila();
    if (
      window.UJTonPriporocilo &&
      typeof window.UJTonPriporocilo.getRecommendedTone === "function"
    ) {
      const rec = window.UJTonPriporocilo.getRecommendedTone({
        originalDueDate: podatkiKorak1.datumZapadlosti || null,
        totalDebtCents: znesekDolgaVCentih() || null,
        evaluationDate: bazaDatumaPosiljanja(),
      });
      if (rec && rec.recommendedToneId) toneId = rec.recommendedToneId;
    }
    odprtPredlog.toneId = toneId;

    let paket = null;
    if (
      window.UJPredlogaPaymentSettings &&
      typeof window.UJPredlogaPaymentSettings.paketIzTona === "function"
    ) {
      paket = window.UJPredlogaPaymentSettings.paketIzTona(toneId);
    }
    if (!paket) {
      paket = zacetniPaketZaModal();
      paket.rok.enabled = true;
    }
    paket.trr = { enabled: true };
    odprtPredlog.paymentSettings = paket;

    if (window.UJRokPlacila && typeof window.UJRokPlacila.stevilkaZaTon === "function") {
      const n = Number(window.UJRokPlacila.stevilkaZaTon(toneId));
      if (n >= 1 && n <= 9) modalIzbranaStevilka = n;
    } else if (toneId === "friendly" || toneId === "very_friendly") {
      modalIzbranaStevilka = 1;
    } else if (toneId === "firm" || toneId === "neutral") {
      modalIzbranaStevilka = 5;
    } else {
      modalIzbranaStevilka = 8;
    }

    posodobiModalStevilkeUI();
    posodobiModalDodatkeKartice();
    if (modalPriporociloNaslov) {
      modalPriporociloNaslov.textContent =
        "★ Predlagani ton: " + labelTona(toneId);
    }
    if (modalPriporociloVrstica) modalPriporociloVrstica.hidden = false;
  }

  function razveljaviPriporociloTona() {
    if (!recommendationSnapshot) return;
    napolniUiIzPosnetka(recommendationSnapshot);
    skrijPriporociloVrstico();
  }

  function shraniPredlogIzModala() {
    if (!modalUrejevalnik || !odprtPredlog) return;
    const naslov = (modalNaslovVnos ? modalNaslovVnos.value : "")
      .trim()
      .slice(0, 80);
    const besedilo = modalUrejevalnik.value.trim().slice(0, NAJVEC_ZNAKOV);
    if (!naslov) {
      pokaziNapako("Vnesite ime predloge.");
      if (modalNaslovVnos) {
        modalNaslovVnos.focus();
        if (modalVsebina) modalVsebina.scrollTop = 0;
      }
      return;
    }
    if (!besedilo) {
      pokaziNapako("Vnesite besedilo predloge.");
      modalUrejevalnik.focus();
      return;
    }
    if (!(modalIzbranaStevilka >= 1 && modalIzbranaStevilka <= 9)) {
      pokaziNapako("Izberite številko predloge.");
      return;
    }

    const paymentSettingsZaShraniti =
      normalizirajPaymentSettingsPredloge(
        odprtPredlog.paymentSettings || zacetniPaketZaModal()
      ) || zacetniPaketZaModal();
    const toneZaShraniti = odprtPredlog.toneId || izbranTonId;
    const orderZaShraniti = Number(modalIzbranaStevilka) || null;

    // Nova predloga
    if (odprtPredlog.jeNov) {
      const novPredlog = {
        id: "moj-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        naslov,
        ikona: odprtPredlog.ikona || "message-circle",
        stilIkone: "",
        besedilo,
        jeMoj: true,
        toneId: toneZaShraniti,
        language: jezikPredlog,
        source: "user",
        isRecommended: false,
        order: orderZaShraniti,
        overridesSystemId: null,
        paymentSettings: paymentSettingsZaShraniti,
      };
      mojiPredlogi = [novPredlog, ...mojiPredlogi];
      shraniMojePredlogeVLocalStorage();
      sestaviSeznamPredlogov();
      nastaviStevilkoPredloga(novPredlog.id, modalIzbranaStevilka);
      zapriUrediModal({ vsili: true });
      return;
    }

    // Sistemska predloga → shrani kot uporabniški override (skrij izvirnik, ne kopijo poleg)
    if (!odprtPredlog.jeMoj) {
      const systemId = String(odprtPredlog.id);
      const obstojeci = mojiPredlogi.find(
        (p) => String(p.overridesSystemId || "") === systemId
      );
      let idZaStevilko;
      if (obstojeci) {
        idZaStevilko = obstojeci.id;
        mojiPredlogi = mojiPredlogi.map((p) =>
          p.id === obstojeci.id
            ? {
                ...p,
                naslov,
                besedilo,
                toneId: toneZaShraniti,
                language: jezikPredlog,
                order: orderZaShraniti,
                overridesSystemId: systemId,
                paymentSettings: paymentSettingsZaShraniti,
              }
            : p
        );
      } else {
        const novPredlog = {
          id: "moj-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
          naslov,
          ikona: odprtPredlog.ikona || "message-circle",
          stilIkone: "",
          besedilo,
          jeMoj: true,
          toneId: toneZaShraniti,
          language: jezikPredlog,
          source: "user",
          isRecommended: Boolean(odprtPredlog.isRecommended),
          order: orderZaShraniti,
          overridesSystemId: systemId,
          paymentSettings: paymentSettingsZaShraniti,
        };
        mojiPredlogi = [novPredlog, ...mojiPredlogi];
        idZaStevilko = novPredlog.id;
      }
      skrijSistemskoPredlogo(systemId);
      if (String(izbranPredlogId) === systemId) {
        izbranPredlogId = idZaStevilko;
      }
      delete nastavitvePredlogov.stevilke[systemId];
      shraniMojePredlogeVLocalStorage();
      shraniNastavitvePredlogov();
      sestaviSeznamPredlogov();
      nastaviStevilkoPredloga(idZaStevilko, modalIzbranaStevilka);
      if (izbranPredlogId) oznaciIzbranega(izbranPredlogId);
      zapriUrediModal({ vsili: true });
      return;
    }

    // Obstajajoča moja predloga → overwrite
    const idMojega = odprtPredlog.id;
    mojiPredlogi = mojiPredlogi.map((p) =>
      p.id === idMojega
        ? {
            ...p,
            naslov,
            besedilo,
            toneId: toneZaShraniti || p.toneId || izbranTonId,
            language: p.language || jezikPredlog,
            order: orderZaShraniti,
            paymentSettings: paymentSettingsZaShraniti,
          }
        : p
    );
    shraniMojePredlogeVLocalStorage();
    sestaviSeznamPredlogov();
    nastaviStevilkoPredloga(idMojega, modalIzbranaStevilka);
    if (izbranPredlogId) oznaciIzbranega(izbranPredlogId);
    zapriUrediModal({ vsili: true });
  }

  async function izbrisiOdprtPredlog() {
    if (!odprtPredlog) return;
    if (odprtPredlog.jeNov) {
      zapriUrediModal({ vsili: true });
      return;
    }

    if (modalUrejevalnik) modalUrejevalnik.blur();
    if (modalNaslovVnos) modalNaslovVnos.blur();

    const potrjeno = await potrdiVprasanje({
      naslov: "Odstranim predlogo?",
      opis: "»" + odprtPredlog.naslov + "«",
      potrdiBesedilo: "Odstrani",
      stil: "nevarno",
    });
    if (!potrjeno) return;

    const id = odprtPredlog.id;
    if (odprtPredlog.jeMoj) {
      mojiPredlogi = mojiPredlogi.filter((p) => p.id !== id);
      shraniMojePredlogeVLocalStorage();
    } else {
      if (!Array.isArray(nastavitvePredlogov.skritiIds))
        nastavitvePredlogov.skritiIds = [];
      if (!nastavitvePredlogov.skritiIds.includes(id)) {
        nastavitvePredlogov.skritiIds.push(id);
      }
    }

    delete nastavitvePredlogov.stevilke[id];
    if (izbranPredlogId === id) izbranPredlogId = null;

    shraniNastavitvePredlogov();
    zapriUrediModal({ vsili: true });
    sestaviSeznamPredlogov();
    izrisiPredloge();
    if (izbranPredlogId) oznaciIzbranega(izbranPredlogId);
    pokaziObvestiloPredlogov("Predloga je bila odstranjena.");
  }

  function oznaciIzbranega(id) {
    izbranPredlogId = id == null ? null : String(id);
    seznam.querySelectorAll(".predlog-kartica").forEach((kartica) => {
      const jeIzbrana =
        izbranPredlogId != null &&
        String(kartica.dataset.predlogId) === izbranPredlogId;
      kartica.classList.toggle("predlog-kartica--izbrana", jeIzbrana);
      const gumb = kartica.querySelector(".predlog-gumb--uporabi");
      if (!gumb) return;
      gumb.setAttribute("aria-pressed", jeIzbrana ? "true" : "false");
      gumb.innerHTML = ikonaKljukice + (jeIzbrana ? "Izbrano" : "Uporabi");
    });
    if (predlogaPredogled && !predlogaPredogled.hidden) {
      posodobiPredogledUporabiGumb();
    }
  }

  function jeVeljavenIzbranPredlog(id) {
    if (id == null || id === "") return false;
    return predlogi.some((p) => String(p.id) === String(id));
  }

  function izrisiPredloge() {
    zapriVseStevilkeIzbire();
    seznam.innerHTML = "";

    if (!predlogi.length) {
      const prazno = document.createElement("p");
      prazno.className = "korak2-sklop__opis";
      prazno.setAttribute("role", "status");
      prazno.textContent = window.UJTonPredloge
        ? "Za ta ton v izbranem jeziku še ni predlog."
        : "Ni predlog.";
      seznam.appendChild(prazno);
      requestAnimationFrame(posodobiDrsnik);
      return;
    }

    const maxStevilk = window.UJTonPredloge ? NAJVEC_STEVILK_V_TONU : 9;

    predlogi.forEach((predlog, indeks) => {
      const kartica = document.createElement("article");
      kartica.className = "predlog-kartica";
      kartica.setAttribute("role", "listitem");
      kartica.dataset.predlogId = String(predlog.id);
      if (
        izbranPredlogId != null &&
        String(predlog.id) === String(izbranPredlogId)
      ) {
        kartica.classList.add("predlog-kartica--izbrana");
      }

      const stevilka = predlog.stevilka || 1;
      const jePriporocena = Boolean(predlog.isRecommended);
      const jePrioriteta = jePriporocena || Number(stevilka) === 1;
      const stilStevilke = jePrioriteta
        ? " predlog-kartica__stevilka--prioriteta"
        : indeks % 2 === 1
          ? " predlog-kartica__stevilka--alt"
          : "";
      const oznakaStevilke = jePriporocena
        ? "Priporočena predloga (številka " + stevilka + ")"
        : "Vrstni red predloge znotraj tona, trenutno " + stevilka;

      kartica.innerHTML =
        '<div class="predlog-kartica__stevilka-ovoj">' +
        '<button type="button" class="predlog-kartica__stevilka' +
        stilStevilke +
        '" aria-expanded="false" aria-haspopup="listbox" aria-label="' +
        oznakaStevilke +
        '"></button>' +
        '<div class="predlog-kartica__stevilke-izbirnik" hidden role="listbox" aria-label="Izberi številko od 1 do ' +
        maxStevilk +
        '">' +
        '<div class="predlog-kartica__stevilke-mreza"></div>' +
        "</div>" +
        "</div>" +
        '<p class="predlog-kartica__naslov"></p>' +
        '<p class="predlog-kartica__opis"></p>' +
        '<button type="button" class="preview-button">' +
        ikonaSvincnika +
        "<span>Uredi</span></button>" +
        '<div class="predlog-kartica__akcije">' +
        '<button type="button" class="predlog-gumb predlog-gumb--uporabi" aria-pressed="false" data-predlog-id="' +
        predlog.id +
        '">' +
        ikonaKljukice +
        "Uporabi</button>" +
        "</div>";

      kartica.querySelector(".predlog-kartica__naslov").textContent = predlog.naslov;
      kartica.querySelector(".predlog-kartica__opis").textContent = predlog.besedilo;

      const gumbStevilke = kartica.querySelector(".predlog-kartica__stevilka");
      nastaviVsebinoStevilkeGumba(
        gumbStevilke,
        stevilka,
        "predlog-kartica__stevilka--prioriteta"
      );
      const izbirnik = kartica.querySelector(".predlog-kartica__stevilke-izbirnik");
      const mreza = kartica.querySelector(".predlog-kartica__stevilke-mreza");

      for (let n = 1; n <= maxStevilk; n++) {
        const gumbN = document.createElement("button");
        gumbN.type = "button";
        gumbN.className = "predlog-kartica__stevilka-izbira";
        gumbN.setAttribute("role", "option");
        gumbN.setAttribute("aria-selected", n === stevilka ? "true" : "false");
        nastaviVsebinoStevilkeGumba(
          gumbN,
          n,
          "predlog-kartica__stevilka-izbira--prioriteta"
        );
        gumbN.addEventListener("click", (dogodek) => {
          dogodek.stopPropagation();
          nastaviStevilkoPredloga(predlog.id, n);
        });
        mreza.appendChild(gumbN);
      }

      gumbStevilke.addEventListener("click", (dogodek) => {
        dogodek.stopPropagation();
        const jeOdprt =
          !izbirnik.hidden &&
          izbirnik.classList.contains("predlog-kartica__stevilke-izbirnik--plavajoč");
        zapriVseStevilkeIzbire();
        if (!jeOdprt) odpriStevilkeIzbirnik(gumbStevilke, izbirnik);
      });

      kartica.querySelector(".preview-button").addEventListener("click", (dogodek) => {
        dogodek.stopPropagation();
        zapriVseStevilkeIzbire();
        odpriUrediModal(predlog);
      });

      kartica.querySelector(".predlog-gumb--uporabi").addEventListener("click", (dogodek) => {
        dogodek.stopPropagation();
        zapriVseStevilkeIzbire();
        uporabiPredlog(predlog, { tiho: false });
      });

      kartica.addEventListener("click", (dogodek) => {
        if (
          dogodek.target.closest(
            "button, a, .predlog-kartica__stevilka-ovoj, .predlog-kartica__akcije, .preview-button"
          )
        ) {
          return;
        }
        odpriPredlogaPredogled(predlog);
      });

      seznam.appendChild(kartica);
    });

    requestAnimationFrame(posodobiDrsnik);
  }

  function preklopiDodatek(kljuc, besedilo, gumb) {
    if (dodatki[kljuc]) {
      const vzorec = "\n\n" + dodatekBesedila[kljuc];
      if (besediloPolje.value.includes(vzorec)) {
        besediloPolje.value = besediloPolje.value.replace(vzorec, "");
      } else if (besediloPolje.value.includes(dodatekBesedila[kljuc])) {
        besediloPolje.value = besediloPolje.value.replace(dodatekBesedila[kljuc], "").trim();
      }
      dodatki[kljuc] = false;
      dodatekBesedila[kljuc] = "";
      gumb.setAttribute("aria-pressed", "false");
    } else {
      const osnova = besediloPolje.value.replace(/\s+$/, "");
      const novo = osnova ? osnova + "\n\n" + besedilo : besedilo;
      besediloPolje.value = novo.slice(0, NAJVEC_ZNAKOV);
      dodatki[kljuc] = true;
      dodatekBesedila[kljuc] = besedilo;
      gumb.setAttribute("aria-pressed", "true");
    }
    posodobiStanjeUrejevalnika();
    shraniOsnutekLokalno();
  }

  const gumbPreglejRok = document.getElementById("gumb-preglej-rok");
  const gumbPreglejObrocno = document.getElementById("gumb-preglej-obrocno");
  const gumbPrezriRok = document.getElementById("gumb-prezri-rok");
  const gumbPrezriObrocno = document.getElementById("gumb-prezri-obrocno");
  const ovojMoznaPriporocila = document.getElementById("ton-dodatki-namigi");
  const sklopPriporociloRok = document.getElementById("sklop-priporocilo-rok");
  const sklopPriporociloObrocno = document.getElementById(
    "sklop-priporocilo-obrocno"
  );
  let rokSheetApi = null;
  let obrocnoSheetApi = null;

  function aktivniTonZaDodatke() {
    return toneState.appliedToneId || toneState.selectedToneId || izbranTonId;
  }

  /** Za priporočila uporabi izbrani ton (tudi pred uporabo predloge). */
  function tonZaPriporocila() {
    return toneState.selectedToneId || izbranTonId || toneState.appliedToneId;
  }

  function znesekDolgaVCentih() {
    if (window.UJObrocno) {
      const c = window.UJObrocno.eurosToCents(podatkiKorak1.znesek);
      return c != null && c > 0 ? c : 0;
    }
    if (window.UJTonPriporocilo) {
      const c = window.UJTonPriporocilo.eurosToCents(podatkiKorak1.znesek);
      return c != null && c > 0 ? c : 0;
    }
    return 0;
  }

  function dniZamudeZaPriporocila() {
    if (!window.UJTonPriporocilo || !podatkiKorak1.datumZapadlosti) return null;
    return window.UJTonPriporocilo.izracunajDniZamude(
      podatkiKorak1.datumZapadlosti,
      window.UJTonPriporocilo.danesYYYYMMDD()
    );
  }

  function preveriResetPrezrtjaObKontekstuDolga() {
    if (!(priporocilaPrezrta.rok || priporocilaPrezrta.obrocno)) return;
    if (priporocilaPrezrta.kontekstDolgaObPrezrtju == null) return;
    if (
      String(priporocilaPrezrta.kontekstDolgaObPrezrtju) !==
      kontekstDolgaZaPriporocila()
    ) {
      ponastaviPriporocilaPrezrta();
    }
  }

  function resetirajSklopPriporocilaAnimacijo(sklop) {
    if (!sklop) return;
    sklop.classList.remove("ton-priporocila__sklop--odhajaj");
    sklop.style.height = "";
    sklop.style.marginTop = "";
    sklop.style.marginBottom = "";
    sklop.style.opacity = "";
    sklop.style.transform = "";
  }

  function posodobiNamigeTonaDodatkov() {
    preveriResetPrezrtjaObKontekstuDolga();
    if (sklopPriporociloRok) {
      if (!priporocilaPrezrta.rok) resetirajSklopPriporocilaAnimacijo(sklopPriporociloRok);
      sklopPriporociloRok.hidden = Boolean(priporocilaPrezrta.rok);
    }
    if (sklopPriporociloObrocno) {
      if (!priporocilaPrezrta.obrocno) {
        resetirajSklopPriporocilaAnimacijo(sklopPriporociloObrocno);
      }
      sklopPriporociloObrocno.hidden = Boolean(priporocilaPrezrta.obrocno);
    }
    if (ovojMoznaPriporocila) {
      const obaPrezrta =
        Boolean(priporocilaPrezrta.rok) && Boolean(priporocilaPrezrta.obrocno);
      if (!obaPrezrta) {
        ovojMoznaPriporocila.classList.remove("ton-priporocila--odhajaj");
      }
      ovojMoznaPriporocila.hidden = obaPrezrta;
    }
  }

  /** Mehko skrije en sklop priporočila (višina + fade). */
  function animirajOdhodPriporocila(sklop, nato) {
    const koncaj = () => {
      if (sklop) {
        sklop.hidden = true;
        resetirajSklopPriporocilaAnimacijo(sklop);
      }
      if (typeof nato === "function") nato();
    };

    if (!sklop || sklop.hidden || zeliZmanjsanoGibanje) {
      koncaj();
      return;
    }

    const visina = sklop.offsetHeight;
    sklop.style.height = visina + "px";
    sklop.style.overflow = "hidden";
    sklop.classList.add("ton-priporocila__sklop--odhajaj");
    void sklop.offsetHeight;
    requestAnimationFrame(() => {
      sklop.style.height = "0px";
    });

    let koncano = false;
    const varnoKoncaj = () => {
      if (koncano) return;
      koncano = true;
      sklop.style.overflow = "";
      koncaj();
    };
    sklop.addEventListener("transitionend", varnoKoncaj, { once: true });
    window.setTimeout(varnoKoncaj, 280);
  }

  function animirajOdhodCelotnegaRazdelka(nato) {
    if (
      !ovojMoznaPriporocila ||
      ovojMoznaPriporocila.hidden ||
      zeliZmanjsanoGibanje
    ) {
      if (ovojMoznaPriporocila) ovojMoznaPriporocila.hidden = true;
      if (typeof nato === "function") nato();
      return;
    }
    ovojMoznaPriporocila.classList.add("ton-priporocila--odhajaj");
    let koncano = false;
    const varnoKoncaj = () => {
      if (koncano) return;
      koncano = true;
      ovojMoznaPriporocila.hidden = true;
      ovojMoznaPriporocila.classList.remove("ton-priporocila--odhajaj");
      if (typeof nato === "function") nato();
    };
    ovojMoznaPriporocila.addEventListener("transitionend", varnoKoncaj, {
      once: true,
    });
    window.setTimeout(varnoKoncaj, 260);
  }

  function prezriPriporocilo(vrsta) {
    if (vrsta === "rok") priporocilaPrezrta.rok = true;
    if (vrsta === "obrocno") priporocilaPrezrta.obrocno = true;
    priporocilaPrezrta.predlogIdObPrezrtju = izbranPredlogId
      ? String(izbranPredlogId)
      : null;
    priporocilaPrezrta.kontekstDolgaObPrezrtju = kontekstDolgaZaPriporocila();

    const sklop =
      vrsta === "rok" ? sklopPriporociloRok : sklopPriporociloObrocno;
    const obaPrezrta =
      Boolean(priporocilaPrezrta.rok) && Boolean(priporocilaPrezrta.obrocno);

    animirajOdhodPriporocila(sklop, () => {
      if (obaPrezrta) {
        animirajOdhodCelotnegaRazdelka();
      } else {
        posodobiNamigeTonaDodatkov();
      }
    });
    shraniOsnutekLokalno();
  }

  /** Po uspešnem shrani iz Preglej → animirano odstrani priporočilo. */
  function onCloseIzPriporocil(rezultat, vrsta) {
    if (!rezultat || !rezultat.shranjeno) return;
    prezriPriporocilo(vrsta);
  }

  if (dodatekRok) {
    if (typeof window.inicializirajRokPlacilaSheet === "function") {
      rokSheetApi = window.inicializirajRokPlacilaSheet({
        get gumbRok() {
          return predlogaSheetAktiven && modalDodatekRok
            ? modalDodatekRok
            : dodatekRok;
        },
        get besediloPolje() {
          return predlogaSheetAktiven ? predlogaSheetBesedilo : besediloPolje;
        },
        najvecZnakov: NAJVEC_ZNAKOV,
        getPaymentDeadline: () =>
          predlogaSheetAktiven ? predlogaDraftDeadline : paymentDeadline,
        setPaymentDeadline: (v) => {
          if (predlogaSheetAktiven) {
            predlogaDraftDeadline = v;
            predlogaSheetSaved = true;
          } else {
            paymentDeadline = v;
            posodobiRokKarticoStanje(paymentDeadline);
          }
        },
        getPrivzetiDnevi: () => privzetiDneviRoka,
        setPrivzetiDnevi: (v) => {
          privzetiDneviRoka = v;
        },
        getToneId: () =>
          predlogaSheetAktiven
            ? (odprtPredlog && odprtPredlog.toneId) || aktivniTonZaDodatke()
            : aktivniTonZaDodatke(),
        getToneIdZaPriporocila: () =>
          predlogaSheetAktiven
            ? (odprtPredlog && odprtPredlog.toneId) || tonZaPriporocila()
            : tonZaPriporocila(),
        getPriporociloVhod: () => ({
          toneId: predlogaSheetAktiven
            ? (odprtPredlog && odprtPredlog.toneId) || tonZaPriporocila()
            : tonZaPriporocila(),
          overdueDays: dniZamudeZaPriporocila(),
          amountCents: znesekDolgaVCentih(),
        }),
        getDneviZaTon: (toneId) =>
          window.UJRokPlacila ? window.UJRokPlacila.dneviZaTon(toneId) : 14,
        onAfterChange: () => {
          if (!predlogaSheetAktiven) {
            posodobiRokKarticoStanje(paymentDeadline);
            posodobiNamigeTonaDodatkov();
          }
        },
        stevilkaIzbranegaPredloga: () =>
          predlogaSheetAktiven
            ? Number(modalIzbranaStevilka) || 1
            : stevilkaIzbranegaPredloga(),
        bazaDatumaPosiljanja,
        get dodatki() {
          return predlogaSheetAktiven ? predlogaDraftDodatki : dodatki;
        },
        get dodatekBesedila() {
          return predlogaSheetAktiven
            ? predlogaDraftDodatekBesedila
            : dodatekBesedila;
        },
        posodobiStanjeUrejevalnika: () => {
          if (!predlogaSheetAktiven) posodobiStanjeUrejevalnika();
        },
        shraniOsnutekLokalno: () => {
          if (!predlogaSheetAktiven) shraniOsnutekLokalno();
        },
        potrdiVprasanje,
        pokaziNapako,
      });
    } else {
      dodatekRok.addEventListener("click", () => {
        pokaziNapako(
          "Nastavitve roka plačila se niso naložile. Osvežite stran (Ctrl+F5)."
        );
      });
    }
  }

  if (dodatekObrocno) {
    if (typeof window.inicializirajObrocnoSheet === "function") {
      obrocnoSheetApi = window.inicializirajObrocnoSheet({
        get gumbObrocno() {
          return predlogaSheetAktiven && modalDodatekObrocno
            ? modalDodatekObrocno
            : dodatekObrocno;
        },
        get gumbRok() {
          return predlogaSheetAktiven && modalDodatekRok
            ? modalDodatekRok
            : dodatekRok;
        },
        get besediloPolje() {
          return predlogaSheetAktiven ? predlogaSheetBesedilo : besediloPolje;
        },
        najvecZnakov: NAJVEC_ZNAKOV,
        get dodatki() {
          return predlogaSheetAktiven ? predlogaDraftDodatki : dodatki;
        },
        get dodatekBesedila() {
          return predlogaSheetAktiven
            ? predlogaDraftDodatekBesedila
            : dodatekBesedila;
        },
        getInstallmentPlan: () =>
          predlogaSheetAktiven ? predlogaDraftPlan : installmentPlan,
        setInstallmentPlan: (v) => {
          if (predlogaSheetAktiven) {
            predlogaDraftPlan = v;
            predlogaSheetSaved = true;
          } else installmentPlan = v;
        },
        getPaymentDeadline: () =>
          predlogaSheetAktiven ? predlogaDraftDeadline : paymentDeadline,
        setPaymentDeadline: (v) => {
          if (predlogaSheetAktiven) {
            predlogaDraftDeadline = v;
            predlogaSheetSaved = true;
          } else {
            paymentDeadline = v;
            posodobiRokKarticoStanje(paymentDeadline);
            if (dodatekRok) {
              dodatekRok.setAttribute(
                "aria-pressed",
                paymentDeadline && paymentDeadline.enabled ? "true" : "false"
              );
            }
          }
        },
        getTotalDebtCents: () => {
          let c = 0;
          if (window.UJObrocno) {
            const x = window.UJObrocno.eurosToCents(podatkiKorak1.znesek);
            c = x != null && x > 0 ? x : 0;
          }
          if (c <= 0 && predlogaSheetAktiven) return 10000;
          return c;
        },
        getOriginalDueDate: () => podatkiKorak1.datumZapadlosti || null,
        getToneId: () =>
          predlogaSheetAktiven
            ? (odprtPredlog && odprtPredlog.toneId) || aktivniTonZaDodatke()
            : aktivniTonZaDodatke(),
        getToneIdZaPriporocila: () =>
          predlogaSheetAktiven
            ? (odprtPredlog && odprtPredlog.toneId) || tonZaPriporocila()
            : tonZaPriporocila(),
        getPriporociloVhod: () => ({
          toneId: predlogaSheetAktiven
            ? (odprtPredlog && odprtPredlog.toneId) || tonZaPriporocila()
            : tonZaPriporocila(),
          overdueDays: dniZamudeZaPriporocila(),
          amountCents:
            znesekDolgaVCentih() || (predlogaSheetAktiven ? 10000 : 0),
        }),
        getJezik: () => {
          const tekst = predlogaSheetAktiven
            ? (modalUrejevalnik && modalUrejevalnik.value) || ""
            : besediloPolje.value;
          if (window.UJRokPlacila) {
            return window.UJRokPlacila.ugotoviJezikSporocila(tekst);
          }
          return "de";
        },
        stevilkaIzbranegaPredloga: () =>
          predlogaSheetAktiven
            ? Number(modalIzbranaStevilka) || 1
            : stevilkaIzbranegaPredloga(),
        bazaDatumaPosiljanja,
        posodobiStanjeUrejevalnika: () => {
          if (!predlogaSheetAktiven) posodobiStanjeUrejevalnika();
        },
        shraniOsnutekLokalno: () => {
          if (!predlogaSheetAktiven) shraniOsnutekLokalno();
        },
        potrdiVprasanje,
        pokaziNapako,
      });
    } else {
      dodatekObrocno.addEventListener("click", () => {
        pokaziNapako(
          "Nastavitve obročnega plačila se niso naložile. Osvežite stran (Ctrl+F5)."
        );
      });
    }
  }

  if (gumbPreglejRok) {
    gumbPreglejRok.addEventListener("click", () => {
      if (!rokSheetApi || typeof rokSheetApi.odpri !== "function") {
        pokaziNapako(
          "Nastavitve roka plačila se niso naložile. Osvežite stran (Ctrl+F5)."
        );
        return;
      }
      const tonId = tonZaPriporocila();
      const termDays = window.UJRokPlacila
        ? window.UJRokPlacila.dneviZaTon(tonId)
        : 14;
      window.setTimeout(() => {
        rokSheetApi.odpri({
          izPriporocil: true,
          toneId: tonId,
          termDays: termDays,
          onClose: (rez) => onCloseIzPriporocil(rez, "rok"),
        });
      }, 0);
    });
  }

  if (gumbPrezriRok) {
    gumbPrezriRok.addEventListener("click", () => prezriPriporocilo("rok"));
  }

  if (gumbPreglejObrocno) {
    gumbPreglejObrocno.addEventListener("click", () => {
      if (!obrocnoSheetApi || typeof obrocnoSheetApi.odpri !== "function") {
        pokaziNapako(
          "Nastavitve obročnega plačila se niso naložile. Osvežite stran (Ctrl+F5)."
        );
        return;
      }
      window.setTimeout(() => {
        obrocnoSheetApi.odpri({
          izPriporocil: true,
          toneId: tonZaPriporocila(),
          onClose: (rez) => onCloseIzPriporocil(rez, "obrocno"),
        });
      }, 0);
    });
  }

  if (gumbPrezriObrocno) {
    gumbPrezriObrocno.addEventListener("click", () =>
      prezriPriporocilo("obrocno")
    );
  }

  if (dodatekTrr) {
    dodatekTrr.addEventListener("click", () => {
      const iban = (podatkiKorak1.iban || "").trim();
      if (!iban) {
        pokaziNapako("TRR/IBAN še ni na voljo v podatkih zadeve - dodajte ga ročno v sporočilo.");
        return;
      }
      preklopiDodatek("trr", "TRR: " + iban + ".", dodatekTrr);
    });
  }

  if (gumbDodajPredlog) gumbDodajPredlog.addEventListener("click", odpriNovPredlogModal);
  if (modalIzbrisi) {
    modalIzbrisi.addEventListener("click", (dogodek) => {
      dogodek.preventDefault();
      dogodek.stopPropagation();
      izbrisiOdprtPredlog();
    });
  }
  if (modalShrani) modalShrani.addEventListener("click", shraniPredlogIzModala);
  if (modalZapri) modalZapri.addEventListener("click", () => zapriUrediModal());
  if (modalBackdrop) modalBackdrop.addEventListener("click", () => zapriUrediModal());

  if (modalDodatekRok) {
    modalDodatekRok.addEventListener("click", () => odpriModalDodatekRok());
  }
  if (modalDodatekObrocno) {
    modalDodatekObrocno.addEventListener("click", () =>
      odpriModalDodatekObrocno()
    );
  }
  if (modalDodatekTrr) {
    modalDodatekTrr.addEventListener("click", () => preklopiModalTrr());
  }
  if (modalPredlagajTon) {
    modalPredlagajTon.addEventListener("click", () => predlagajTonZaPredlogo());
  }
  if (modalRazveljaviPriporocilo) {
    modalRazveljaviPriporocilo.addEventListener("click", () =>
      razveljaviPriporociloTona()
    );
  }
  if (modalPreklici) {
    modalPreklici.addEventListener("click", () => zapriUrediModal());
  }
  if (modalNaslovVnos) {
    modalNaslovVnos.addEventListener("input", () => {
      skrijPriporociloVrstico();
    });
  }
  if (modalUrejevalnik) {
    modalUrejevalnik.addEventListener("input", () => {
      if (modalUrejevalnik.value.length > NAJVEC_ZNAKOV) {
        modalUrejevalnik.value = modalUrejevalnik.value.slice(0, NAJVEC_ZNAKOV);
      }
      posodobiModalStevec();
      posodobiPredlagajTonGumb();
      skrijPriporociloVrstico();
    });
  }

  document.addEventListener("keydown", (dogodek) => {
    if (dogodek.key !== "Escape") return;
    const potrdiModal = document.getElementById("uj-potrdi-modal");
    if (potrdiModal && !potrdiModal.hidden) return;
    if (predlogaPredogled && !predlogaPredogled.hidden) {
      dogodek.preventDefault();
      zapriPredlogaPredogled();
      return;
    }
    if (!modal || modal.hidden) return;
    // Escape naj najprej zapre potrditveni modal, ne urejevalnika.
    zapriUrediModal();
  });

  if (predlogaPredogledZapri) {
    predlogaPredogledZapri.addEventListener("click", () => {
      zapriPredlogaPredogled();
    });
  }
  if (predlogaPredogledBackdrop) {
    predlogaPredogledBackdrop.addEventListener("click", () => {
      zapriPredlogaPredogled();
    });
  }
  if (predlogaPredogledUredi) {
    predlogaPredogledUredi.addEventListener("click", () => {
      const predlog = predogledPredlog;
      if (!predlog) return;
      zapriPredlogaPredogled({ takoj: true });
      odpriUrediModal(predlog);
    });
  }
  if (predlogaPredogledUporabi) {
    predlogaPredogledUporabi.addEventListener("click", async () => {
      const predlog = predogledPredlog;
      if (!predlog) return;
      const uspelo = await uporabiPredlog(predlog, { tiho: false });
      if (uspelo) zapriPredlogaPredogled();
    });
  }

  besediloPolje.addEventListener("input", () => {
    skrijNapako();
    if (besediloPolje.value.length > NAJVEC_ZNAKOV) {
      besediloPolje.value = besediloPolje.value.slice(0, NAJVEC_ZNAKOV);
    }
    if (zadnjeUporabljenoBesediloPredloge) {
      sporociloRocnoUrejeno =
        besediloPolje.value.trim() !== zadnjeUporabljenoBesediloPredloge.trim();
    } else if (besediloPolje.value.trim()) {
      sporociloRocnoUrejeno = true;
    }
    if (
      installmentPlan &&
      installmentPlan.enabled &&
      dodatekBesedila.obrocno &&
      !besediloPolje.value.includes(dodatekBesedila.obrocno)
    ) {
      installmentPlan.addonManuallyEdited = true;
    }
    posodobiStanjeUrejevalnika();
    shraniOsnutekLokalno();
  });

  seznam.addEventListener(
    "scroll",
    () => {
      posodobiDrsnik();
      zapriVseStevilkeIzbire();
    },
    { passive: true }
  );
  window.addEventListener("resize", () => {
    posodobiDrsnik();
    zapriVseStevilkeIzbire();
  });
  if (typeof ResizeObserver !== "undefined") {
    const opazovalec = new ResizeObserver(() => posodobiDrsnik());
    opazovalec.observe(seznam);
    if (okvir) opazovalec.observe(okvir);
  }

  obrazec.addEventListener("submit", (dogodek) => {
    dogodek.preventDefault();
    skrijNapako();
    const sporocilo = besediloPolje.value.trim();
    if (!sporocilo) {
      pokaziNapako("Najprej napišite sporočilo ali uporabite predlog.");
      return;
    }

    // Šele ta uspešen submit označi korak 2 kot izpolnjen (potrjen: true).
    sessionStorage.setItem(
      KLJUC_SEJE_KORAK2_PODATKI,
      JSON.stringify({
        sporociloDolzniku: sporocilo,
        izbranPredlogId,
        dodatki: { ...dodatki },
        dodatekBesedila: { ...dodatekBesedila },
        paymentDeadline: paymentDeadline,
        installmentPlan: installmentPlan,
        toneRecommendation: { ...toneState },
        sporociloRocnoUrejeno: sporociloRocnoUrejeno,
        priporocilaPrezrta: { ...priporocilaPrezrta },
        potrjen: true,
      })
    );

    window.location.href = "neplacila-posiljanje.html";
  });

  // Obnovi morebiten osnutek iz 2. koraka (npr. po Nazaj s 3. koraka).
  const osnutekKorak2Json = sessionStorage.getItem(KLJUC_SEJE_KORAK2_PODATKI);
  if (osnutekKorak2Json) {
    try {
      const osnutek = JSON.parse(osnutekKorak2Json);
      if (osnutek.sporociloDolzniku) {
        besediloPolje.value = String(osnutek.sporociloDolzniku).slice(0, NAJVEC_ZNAKOV);
        obnovljenOsnutekSporocila = Boolean(String(osnutek.sporociloDolzniku).trim());
      }
      if (osnutek.izbranPredlogId) izbranPredlogId = osnutek.izbranPredlogId;
      if (osnutek.dodatekBesedila) {
        dodatekBesedila.rok = String(osnutek.dodatekBesedila.rok || "");
        dodatekBesedila.obrocno = String(osnutek.dodatekBesedila.obrocno || "");
        dodatekBesedila.trr = String(osnutek.dodatekBesedila.trr || "");
      }
      if (osnutek.paymentDeadline && osnutek.paymentDeadline.enabled) {
        paymentDeadline = osnutek.paymentDeadline;
        dodatki.rok = true;
        if (!dodatekBesedila.rok && paymentDeadline.insertedText) {
          dodatekBesedila.rok = String(paymentDeadline.insertedText);
        }
      }
      if (osnutek.installmentPlan && osnutek.installmentPlan.enabled) {
        const sveziCenti = window.UJObrocno
          ? window.UJObrocno.eurosToCents(podatkiKorak1.znesek)
          : null;
        if (
          sveziCenti != null &&
          window.UJObrocno.jePlanUporaben(osnutek.installmentPlan, sveziCenti)
        ) {
          installmentPlan = osnutek.installmentPlan;
          dodatki.obrocno = true;
          if (!dodatekBesedila.obrocno && installmentPlan.addonText) {
            dodatekBesedila.obrocno = String(installmentPlan.addonText);
          }
        } else {
          // Pokvarjen/neusklajen načrt – zavrzi (nov predlog ob odprtju sheet-a).
          installmentPlan = null;
        }
      }
      if (osnutek.dodatki) {
        dodatki.rok = Boolean(osnutek.dodatki.rok) || Boolean(paymentDeadline && paymentDeadline.enabled);
        dodatki.obrocno =
          Boolean(installmentPlan && installmentPlan.enabled) ||
          (Boolean(osnutek.dodatki.obrocno) && Boolean(installmentPlan));
        dodatki.trr = Boolean(osnutek.dodatki.trr);
        if (dodatekRok) dodatekRok.setAttribute("aria-pressed", String(dodatki.rok));
        posodobiRokKarticoStanje(
          dodatki.rok && paymentDeadline ? paymentDeadline : null
        );
        if (dodatekObrocno) {
          dodatekObrocno.setAttribute("aria-pressed", String(dodatki.obrocno));
          posodobiObrocnoKarticoStanje(
            dodatki.obrocno && installmentPlan ? installmentPlan : null
          );
        }
        if (dodatekTrr) dodatekTrr.setAttribute("aria-pressed", String(dodatki.trr));
      } else if (paymentDeadline && paymentDeadline.enabled && dodatekRok) {
        dodatekRok.setAttribute("aria-pressed", "true");
        posodobiRokKarticoStanje(paymentDeadline);
      }
      if (typeof osnutek.sporociloRocnoUrejeno === "boolean") {
        sporociloRocnoUrejeno = osnutek.sporociloRocnoUrejeno;
      } else if (obnovljenOsnutekSporocila) {
        sporociloRocnoUrejeno = true;
      }
      if (osnutek.priporocilaPrezrta) {
        priporocilaPrezrta = normalizirajPriporocilaPrezrta(
          osnutek.priporocilaPrezrta
        );
      }
      if (obnovljenOsnutekSporocila) {
        zadnjeUporabljenoBesediloPredloge = "";
      }
    } catch (_napaka) {
      // Pokvarjen osnutek - ignoriraj.
    }
  }

  function najdiPredlogStevilka1() {
    return (
      predlogi.find((p) => p.isRecommended) ||
      predlogi.find((p) => Number(p.stevilka) === 1) ||
      predlogi[0] ||
      null
    );
  }

  function posodobiObvestiloNeuporabljenegaTona() {
    if (!predlogiObvestilo) return;
    const selected = toneState.selectedToneId || izbranTonId;
    const applied = toneState.appliedToneId || null;
    if (applied && selected && applied === selected) {
      if (predlogiObvestilo.textContent.indexOf("Izberite predlogo") !== -1) {
        pokaziObvestiloPredlogov("");
      }
      return;
    }
    if (!applied || applied !== selected) {
      pokaziObvestiloPredlogov(
        "Izberite predlogo, da uporabite novi ton v sporočilu."
      );
    }
  }

  /** Menjava tona osveži seznam predlog – ne prepiše glavnega sporočila. */
  function nastaviIzbranTon(toneId, osveziSeznam) {
    if (!toneId) return;
    izbranTonId = String(toneId);
    if (window.UJTonPriporocilo) {
      toneState = window.UJTonPriporocilo.selectTone(toneState, toneId);
    } else {
      toneState.selectedToneId = izbranTonId;
      toneState.isOverridden =
        toneState.selectedToneId !== toneState.recommendedToneId;
    }
    if (osveziSeznam !== false) {
      sestaviSeznamPredlogov();
      izrisiPredloge();
      if (seznam) seznam.scrollTop = 0;
      if (jeVeljavenIzbranPredlog(izbranPredlogId)) {
        oznaciIzbranega(izbranPredlogId);
      } else {
        izbranPredlogId = null;
      }
      posodobiObvestiloNeuporabljenegaTona();
      posodobiNamigeTonaDodatkov();
    }
  }
  window.__ujNastaviIzbranTon = nastaviIzbranTon;
  window.__ujPredlogObrocnegaZaTon = function () {
    return window.UJRokPlacila
      ? window.UJRokPlacila.predlogObrocnegaZaTon(aktivniTonZaDodatke())
      : null;
  };

  /**
   * Predloga s številko 1 = privzeto sporočilo zgoraj + zelena označba.
   * vsiliBesedilo: true → vedno prepiši polje; false → polje samo če je prazno.
   */
  function uporabiPredlogStevilka1(vsiliBesedilo) {
    const privzeti = najdiPredlogStevilka1();
    if (!privzeti) return;
    if (vsiliBesedilo || !besediloPolje.value.trim()) {
      uporabiPredlog(privzeti, { tiho: true });
    } else {
      oznaciIzbranega(privzeti.id);
      slediPrivzetiStevilki1 = true;
    }
  }

  function zagonSPredlogi() {
    mojiPredlogi = naloziMojePredlogeIzLocalStorage();
    nastavitvePredlogov = naloziNastavitvePredlogov();
    sestaviSeznamPredlogov();
    izrisiPredloge();

    if (jeVeljavenIzbranPredlog(izbranPredlogId)) {
      const izbran = predlogi.find((p) => String(p.id) === String(izbranPredlogId));
      slediPrivzetiStevilki1 = Boolean(izbran && Number(izbran.stevilka) === 1);
    } else {
      izbranPredlogId = null;
      slediPrivzetiStevilki1 = true;
    }

    if (slediPrivzetiStevilki1) {
      // Svež vnos: vedno vstavi besedilo #1. Obnovljen osnutek: obdrži besedilo, označi #1.
      uporabiPredlogStevilka1(!obnovljenOsnutekSporocila);
    } else {
      oznaciIzbranega(izbranPredlogId);
    }
    posodobiStanjeUrejevalnika();
  }

  document.addEventListener("click", (dogodek) => {
    if (
      dogodek.target.closest(".predlog-kartica__stevilka-ovoj") ||
      dogodek.target.closest(".predlog-kartica__stevilke-izbirnik")
    ) {
      return;
    }
    zapriVseStevilkeIzbire();
  });

  // Najprej prikaži vgrajene, nato (ko poznamo user id) naloži tudi moje predloge.
  zagonSPredlogi();

  let tonWidgetApi = null;
  if (typeof window.inicializirajTonWidget === "function" && window.UJTonPriporocilo) {
    tonWidgetApi = window.inicializirajTonWidget({
      getState: () => toneState,
      setState: (s) => {
        toneState = s;
      },
      recommendation: tonPriporociloRezultat,
      onToneSelected: (toneId) => {
        nastaviIzbranTon(toneId, true);
        shraniOsnutekLokalno();
      },
      onReset: () => {
        if (!window.UJTonPriporocilo) return;
        toneState = window.UJTonPriporocilo.resetToRecommended(toneState);
        nastaviIzbranTon(toneState.selectedToneId, true);
        shraniOsnutekLokalno();
      },
    });
    posodobiObvestiloNeuporabljenegaTona();
    posodobiNamigeTonaDodatkov();
    if (tonWidgetApi && typeof tonWidgetApi.osvezi === "function") {
      tonWidgetApi.osvezi();
    }
  } else {
    posodobiNamigeTonaDodatkov();
  }

  if (typeof supabaseKlient !== "undefined" && supabaseKlient.auth) {
    supabaseKlient.auth
      .getSession()
      .then(({ data }) => {
        const uid = data && data.session && data.session.user && data.session.user.id;
        if (uid) {
          kljucMojihPredlogov = KLJUC_MOJI_PREDLOGI_OSNOVA + "-" + uid;
          kljucNastavitev = KLJUC_PREDLOGI_NASTAVITVE_OSNOVA + "-" + uid;
        }
        zagonSPredlogi();
      })
      .catch(() => {
        zagonSPredlogi();
      });
  }
}

/* ---------- Logika strani neplacila-posiljanje.html (3. korak) ----------
   Avtomatiziran "Načrt opominjanja" (SMS koraki 1–3 + ročni korak 4).
   To NI isto kot ročni "Pošlji naslednji opomin" (posljiOpomin) na
   neplacila.html — tisti samo napreduje status že obstoječe zadeve. */

function inicializirajPosiljanje() {
  const glavniEl = document.getElementById("opomin-nacrt-glavni");
  const potrditevEl = document.getElementById("opomin-nacrt-potrditev");
  const napaka = document.getElementById("splosna-napaka");
  if (!glavniEl || !potrditevEl) return;

  const podatkiKorak1Json = sessionStorage.getItem(KLJUC_SEJE_KORAK1_PODATKI);
  const podatkiKorak2Json = sessionStorage.getItem(KLJUC_SEJE_KORAK2_PODATKI);
  if (!podatkiKorak1Json) {
    window.location.href = "neplacila.html#obrazec";
    return;
  }
  if (!podatkiKorak2Json) {
    window.location.href = "neplacila-sporocilo.html";
    return;
  }

  inicializirajWizardProgressHeader(3);
  inicializirajIzbrisOsnutka();

  const podatkiKorak1 = JSON.parse(podatkiKorak1Json);
  const podatkiKorak2 = JSON.parse(podatkiKorak2Json);
  const prilogaInfo = document.getElementById("priloga-posiljanje-info");
  const prilogaBesedilo = document.getElementById("priloga-posiljanje-besedilo");
  const prilogaKanali = document.getElementById("priloga-posiljanje-kanali");
  const kanalEmail = document.getElementById("kanal-email");
  const kanalSms = document.getElementById("kanal-sms");

  function pokaziNapako(besedilo, tehnicniPodatki) {
    if (!napaka) return;
    napaka.textContent = tehnicniPodatki
      ? besedilo + " (" + tehnicniPodatki + ")"
      : besedilo;
    napaka.hidden = false;
  }

  /* Prikaz priloge glede na kanal (e-pošta = PDF, SMS = varna povezava). */
  function posodobiBesediloPrilogeZaKanal() {
    if (!prilogaInfo || !prilogaBesedilo) return;
    const imaPrilogo =
      Array.isArray(podatkiKorak1.racunDatotekePoti) &&
      podatkiKorak1.racunDatotekePoti.length > 0;
    const poslji = podatkiKorak1.shouldSendAttachment !== false;
    if (!imaPrilogo || !poslji) {
      prilogaInfo.hidden = true;
      return;
    }
    prilogaInfo.hidden = false;
    const imaEmail = Boolean(podatkiKorak1.emailDolznika);
    const imaTelefon = Boolean(podatkiKorak1.telefonDolznika);
    if (prilogaKanali) prilogaKanali.hidden = !(imaEmail && imaTelefon);
    let kanal = "email";
    if (kanalSms && kanalSms.checked) kanal = "sms";
    else if (kanalEmail && kanalEmail.checked) kanal = "email";
    else if (!imaEmail && imaTelefon) kanal = "sms";
    if (kanalEmail) {
      kanalEmail.disabled = !imaEmail;
      if (imaEmail && !imaTelefon) kanalEmail.checked = true;
    }
    if (kanalSms) {
      kanalSms.disabled = !imaTelefon;
      if (imaTelefon && !imaEmail) kanalSms.checked = true;
    }
    if (
      imaEmail &&
      imaTelefon &&
      kanalEmail &&
      kanalSms &&
      !kanalEmail.checked &&
      !kanalSms.checked
    ) {
      kanalEmail.checked = true;
      kanal = "email";
    }
    prilogaBesedilo.textContent =
      kanal === "sms"
        ? "Dolžnik bo prejel varno povezavo do računa."
        : "Račun bo priložen e-poštnemu sporočilu kot PDF.";
  }

  if (kanalEmail) kanalEmail.addEventListener("change", posodobiBesediloPrilogeZaKanal);
  if (kanalSms) kanalSms.addEventListener("change", posodobiBesediloPrilogeZaKanal);
  posodobiBesediloPrilogeZaKanal();

  if (!window.UJOpominNacrtUI || !window.UJOpominNacrt) {
    pokaziNapako(
      "Načrt opominjanja se ni naložil. Osvežite stran (Ctrl+F5)."
    );
    return;
  }

  async function aktivirajNacrt(plan) {
    /* Shrani zadevo + opomin_nacrt. Dejansko SMS pošiljanje še ni v MVP. */
    const korak1Sms =
      plan &&
      Array.isArray(plan.steps) &&
      plan.steps.find((s) => Number(s.index) === 1);
    const sporociloZaZadevo =
      (korak1Sms && korak1Sms.finalMessage) ||
      podatkiKorak2.sporociloDolzniku ||
      null;

    const { error } = await supabaseKlient.from("zadeve").insert({
      ime_dolznika: podatkiKorak1.imeDolznika,
      telefon_dolznika: podatkiKorak1.telefonDolznika || null,
      email_dolznika: podatkiKorak1.emailDolznika || null,
      znesek: podatkiKorak1.znesek,
      opis_dolga: podatkiKorak1.opisDolga,
      datum_izdaje_racuna: podatkiKorak1.datumIzdajeRacuna,
      datum_zapadlosti: podatkiKorak1.datumZapadlosti,
      stevilka_racuna: podatkiKorak1.stevilkaRacuna,
      racun_datoteke_poti: podatkiKorak1.racunDatotekePoti,
      sporocilo_dolzniku: sporociloZaZadevo,
      opomin_nacrt: plan,
    });

    if (error) {
      throw new Error(error.message || "Napaka pri shranjevanju zadeve.");
    }

    sessionStorage.removeItem(KLJUC_SEJE_KORAK1_PODATKI);
    sessionStorage.removeItem(KLJUC_SEJE_KORAK2_PODATKI);
    if (window.UJOpominNacrt.pocistiOsnutek) {
      window.UJOpominNacrt.pocistiOsnutek();
    }
    sessionStorage.setItem(KLJUC_SEJE_ZADEVA_DODANA, "1");
    window.location.href = "neplacila.html#seznam";
  }

  window.UJOpominNacrtUI.inicializiraj({
    glavniEl,
    potrditevEl,
    podatkiKorak1,
    podatkiKorak2,
    pokaziNapako,
    aktivirajNacrt,
    potrdiVprasanje,
  });
}

inicializirajNeplacila();
inicializirajSporociloDolzniku();
inicializirajPosiljanje();
inicializirajKmaluNaVoljo();

