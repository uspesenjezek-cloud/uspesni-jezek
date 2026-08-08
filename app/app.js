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
      ? '<p class="korak-glava__osnutek">Osnutek shranjen</p>'
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

  async function zazeniOcrIzbiro(inputEl) {
    if (aiZajemVTehniku) return;
    const potrjeno = await potrdiZamenjavoOcrPodatkov();
    if (!potrjeno) return;
    if (inputEl) inputEl.click();
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
        znesek: parseFloat(podatki.get("znesek")) || 0,
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
  const vgrajeniPredlogi = sestaviPredlogeSporocil(podatkiKorak1);
  let mojiPredlogi = [];
  let predlogi = [...vgrajeniPredlogi];
  let kljucMojihPredlogov = KLJUC_MOJI_PREDLOGI_OSNOVA;
  let kljucNastavitev = KLJUC_PREDLOGI_NASTAVITVE_OSNOVA;
  let nastavitvePredlogov = { stevilke: {}, skritiIds: [] };

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
  const modalNaslovVnos = document.getElementById("predogled-naslov-vnos");
  const modalUrejevalnik = document.getElementById("predogled-urejevalnik");
  const modalIzbrisi = document.getElementById("predogled-izbrisi");
  const modalShrani = document.getElementById("predogled-shrani");
  const modalZapri = document.getElementById("predogled-zapri");
  const modalBackdrop = document.getElementById("predogled-backdrop");
  const modalStevilkaOvoj = document.getElementById("predogled-stevilka");
  const modalStevilkeMreza = document.getElementById("predogled-stevilke-mreza");

  const NAJVEC_ZNAKOV = 1000;
  let izbranPredlogId = null;
  let odprtPredlog = null;
  let modalIzbranaStevilka = 1;
  /* true = sporočilo sledi predlogi s številko 1 (privzeta izbira). */
  let slediPrivzetiStevilki1 = true;
  let obnovljenOsnutekSporocila = false;
  const dodatki = { rok: false, obrocno: false, trr: false };
  const dodatekBesedila = { rok: "", obrocno: "", trr: "" };
  let casovnikOsnutka = null;
  const zeliZmanjsanoGibanje = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ikonaSvincnika =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';
  const ikonaKljukice =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  /* Rumena zvezda za predlogo s številko 1 (prioriteta / privzeto sporočilo). */
  const ikonaZvezdePrioriteta =
    '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.75 6.2 6.75.7-5.1 4.55 1.45 6.55L12 16.9l-5.85 3.6 1.45-6.55-5.1-4.55 6.75-.7L12 2.5z"/></svg>';

  function htmlStevilkaZvezda() {
    return (
      '<span class="predlog-kartica__zvezda" aria-hidden="true">' +
      ikonaZvezdePrioriteta +
      '</span><span class="predlog-kartica__zvezda-cifra">1</span>'
    );
  }

  /** Številka 1 povsod: rumena zvezda z »1« (kartica, popover, modal Uredi). */
  function nastaviVsebinoStevilkeGumba(gumb, n, razredPrioriteta) {
    if (Number(n) === 1) {
      gumb.classList.add(razredPrioriteta);
      gumb.innerHTML = htmlStevilkaZvezda();
      gumb.setAttribute("aria-label", "Prioritetna številka 1 – privzeto sporočilo");
    } else {
      gumb.textContent = String(n);
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
  let privzetiDneviRoka = window.UJRokPlacila
    ? window.UJRokPlacila.naloziPrivzeteDni()
    : { 1: 3, 2: 5, 3: 7, 4: 10, 5: 14, 6: 21, 7: 30, 8: 45, 9: 60 };

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
        potrjen: zePotrjen,
      })
    );
  }

  function resetirajDodatke() {
    dodatki.rok = false;
    dodatki.obrocno = false;
    dodatki.trr = false;
    dodatekBesedila.rok = "";
    dodatekBesedila.obrocno = "";
    dodatekBesedila.trr = "";
    if (dodatekRok) dodatekRok.setAttribute("aria-pressed", "false");
    if (dodatekObrocno) dodatekObrocno.setAttribute("aria-pressed", "false");
    if (dodatekTrr) dodatekTrr.setAttribute("aria-pressed", "false");
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
    }));
    localStorage.setItem(kljucMojihPredlogov, JSON.stringify(zaShraniti));
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

  function najdiProstoStevilko(zasedene, zeliOd) {
    const zacetek = Math.max(1, Math.min(9, Number(zeliOd) || 1));
    for (let n = zacetek; n <= 9; n++) {
      if (!zasedene.has(n)) return n;
    }
    for (let n = 1; n < zacetek; n++) {
      if (!zasedene.has(n)) return n;
    }
    return null;
  }

  function sestaviSeznamPredlogov() {
    const skriti = new Set(nastavitvePredlogov.skritiIds || []);
    predlogi = [...mojiPredlogi, ...vgrajeniPredlogi].filter((p) => !skriti.has(p.id));
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
      const prosta = najdiProstoStevilko(zasedene, od);
      // Če so vse številke 1–9 zasedene (več kot 9 predlogov), pusti želeno / 9.
      predlog.stevilka = prosta != null ? prosta : Number.isInteger(zelena) ? zelena : 9;
      nastavitvePredlogov.stevilke[predlog.id] = predlog.stevilka;
      if (prosta != null) zasedene.add(prosta);
    });

    // Počisti nastavitve za predloge, ki jih ni več.
    Object.keys(nastavitvePredlogov.stevilke).forEach((id) => {
      if (!predlogi.some((p) => p.id === id)) delete nastavitvePredlogov.stevilke[id];
    });
    predlogi.sort((a, b) => {
      if (a.stevilka !== b.stevilka) return a.stevilka - b.stevilka;
      return a._indeks - b._indeks;
    });

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
    const nova = Math.max(1, Math.min(9, Number(novaStevilka) || 1));
    const konflikt = predlogi.find(
      (p) => String(p.id) !== id && Number(nastavitvePredlogov.stevilke[p.id]) === nova
    );

    nastavitvePredlogov.stevilke[id] = nova;

    if (konflikt) {
      const zasedene = new Set(
        predlogi
          .filter((p) => p.id !== konflikt.id)
          .map((p) => Number(nastavitvePredlogov.stevilke[p.id]) || p.stevilka)
      );
      zasedene.add(nova);
      const prosta = najdiProstoStevilko(zasedene, nova + 1);
      if (prosta != null) {
        nastavitvePredlogov.stevilke[String(konflikt.id)] = prosta;
        pokaziObvestiloPredlogov(
          "Številka " +
            nova +
            " je bila zasedena – predloga »" +
            konflikt.naslov +
            "« je premaknjena na " +
            prosta +
            "."
        );
      } else {
        pokaziObvestiloPredlogov(
          "Številka " + nova + " je zasedena – vrstni red ohranja prejšnji položaj."
        );
      }
    } else {
      pokaziObvestiloPredlogov("");
    }

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
    posodobiStanjeUrejevalnika();
    shraniOsnutekLokalno();
  }

  function uporabiPredlog(predlog) {
    const UJ = window.UJRokPlacila;
    const rokAktivno = Boolean(paymentDeadline && paymentDeadline.enabled);
    const mode = rokAktivno ? paymentDeadline.mode : null;
    const manualDate = rokAktivno ? paymentDeadline.deadlineDate : null;
    const termDaysObstojeci = rokAktivno ? Number(paymentDeadline.termDays) : null;

    resetirajDodatke();
    besediloPolje.value = predlog.besedilo.slice(0, NAJVEC_ZNAKOV);
    oznaciIzbranega(predlog.id);
    slediPrivzetiStevilki1 = Number(predlog.stevilka) === 1;

    if (rokAktivno && UJ) {
      const linked =
        Number(predlog.stevilka) >= 1 && Number(predlog.stevilka) <= 9
          ? Number(predlog.stevilka)
          : 1;
      const base = bazaDatumaPosiljanja();
      let days;
      let deadline;
      let modeOut;
      if (mode === "manual" && manualDate) {
        modeOut = "manual";
        deadline = manualDate;
        days = termDaysObstojeci || Number(privzetiDneviRoka[linked]) || 5;
      } else {
        modeOut = "automatic";
        days = Number(privzetiDneviRoka[linked]) || 5;
        deadline = UJ.izracunajRok(base, days);
      }
      const jezik = UJ.ugotoviJezikSporocila(besediloPolje.value);
      const vrstica = UJ.sestaviVrsticoRoka(deadline, jezik);
      const rez = UJ.posodobiSistemskoVrstico(besediloPolje.value, "", vrstica, true);
      besediloPolje.value = String(rez.besedilo).slice(0, NAJVEC_ZNAKOV);
      paymentDeadline = {
        enabled: true,
        mode: modeOut,
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
    } else {
      paymentDeadline = null;
    }

    posodobiStanjeUrejevalnika();
    shraniOsnutekLokalno();
  }

  const modalDialog = modal ? modal.querySelector(".korak2-modal__dialog") : null;

  function posodobiPozicijoUrediModala() {
    if (!modal || modal.hidden || !modalDialog) return;
    const vv = window.visualViewport;
    const rob = 8;

    if (vv) {
      // iOS: dialog = fixed na visualViewport (nad tipkovnico).
      const top = Math.round(vv.offsetTop + rob);
      const left = Math.round(vv.offsetLeft + rob);
      const width = Math.max(260, Math.round(vv.width - rob * 2));
      const height = Math.max(200, Math.round(vv.height - rob * 2));

      modalDialog.style.position = "fixed";
      modalDialog.style.top = top + "px";
      modalDialog.style.left = left + "px";
      modalDialog.style.right = "auto";
      modalDialog.style.width = width + "px";
      modalDialog.style.height = height + "px";
      modalDialog.style.maxHeight = height + "px";
      modalDialog.style.maxWidth = width + "px";
    } else {
      modalDialog.style.position = "fixed";
      modalDialog.style.top = "8px";
      modalDialog.style.left = "14px";
      modalDialog.style.right = "14px";
      modalDialog.style.width = "";
      modalDialog.style.height = "";
      modalDialog.style.maxHeight = "min(50dvh, 55vh)";
      modalDialog.style.maxWidth = "";
    }
  }

  function pritrdiUrediModalNaVrh() {
    posodobiPozicijoUrediModala();
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", posodobiPozicijoUrediModala);
      window.visualViewport.addEventListener("scroll", posodobiPozicijoUrediModala);
    }
    window.addEventListener("resize", posodobiPozicijoUrediModala);
  }

  function odstraniPritrditevUrediModala() {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", posodobiPozicijoUrediModala);
      window.visualViewport.removeEventListener("scroll", posodobiPozicijoUrediModala);
    }
    window.removeEventListener("resize", posodobiPozicijoUrediModala);
    if (modalDialog) {
      modalDialog.style.position = "";
      modalDialog.style.top = "";
      modalDialog.style.left = "";
      modalDialog.style.right = "";
      modalDialog.style.width = "";
      modalDialog.style.height = "";
      modalDialog.style.maxHeight = "";
      modalDialog.style.maxWidth = "";
      modalDialog.scrollTop = 0;
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
    modalStevilkeMreza.querySelectorAll(".korak2-modal__stevilka-izbira").forEach((gumb) => {
      const n = Number(gumb.dataset.stevilka);
      gumb.setAttribute("aria-selected", n === modalIzbranaStevilka ? "true" : "false");
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
      nastaviVsebinoStevilkeGumba(gumb, n, "korak2-modal__stevilka-izbira--prioriteta");
      gumb.addEventListener("click", () => {
        modalIzbranaStevilka = n;
        posodobiModalStevilkeUI();
      });
      modalStevilkeMreza.appendChild(gumb);
    }
  }

  function zapriUrediModal() {
    if (!modal) return;
    odstraniPritrditevUrediModala();
    modal.hidden = true;
    odprtPredlog = null;
    if (modalNaslovVnos) modalNaslovVnos.value = "";
    if (modalUrejevalnik) modalUrejevalnik.value = "";
    if (modalIzbrisi) modalIzbrisi.hidden = false;
    if (modalStevilkaOvoj) modalStevilkaOvoj.hidden = true;
  }

  function odpriUrediModal(predlog) {
    if (!modal || !modalUrejevalnik) return;
    odprtPredlog = predlog;
    if (modalNaslovVnos) modalNaslovVnos.value = (predlog.naslov || "").slice(0, 80);
    modalUrejevalnik.value = (predlog.besedilo || "").slice(0, NAJVEC_ZNAKOV);
    if (modalShrani) {
      modalShrani.textContent =
        predlog.jeNov || predlog.jeMoj ? "Shrani" : "Shrani kot nov predlog";
    }
    if (modalIzbrisi) modalIzbrisi.hidden = !!predlog.jeNov;

    // Številka 1–9: vedno (novi, moji in vgrajeni) – kartica + modal.
    if (modalStevilkaOvoj) modalStevilkaOvoj.hidden = false;
    pripraviModalStevilke();
    if (predlog.jeNov) {
      modalIzbranaStevilka = privzetaStevilkaZaNovPredlog();
    } else {
      const trenutna = Number(predlog.stevilka || nastavitvePredlogov.stevilke[predlog.id]);
      modalIzbranaStevilka =
        Number.isInteger(trenutna) && trenutna >= 1 && trenutna <= 9
          ? trenutna
          : privzetaStevilkaZaNovPredlog();
    }
    posodobiModalStevilkeUI();

    modal.hidden = false;
    pritrdiUrediModalNaVrh();
    // Fokus → tipkovnica; po kratkem zamiku ponovno poravnaj (iOS).
    if (modalNaslovVnos) modalNaslovVnos.focus();
    else modalUrejevalnik.focus();
    requestAnimationFrame(posodobiPozicijoUrediModala);
    // iOS tipkovnica se odpre z zamikom – večkrat poravnaj.
    setTimeout(posodobiPozicijoUrediModala, 100);
    setTimeout(posodobiPozicijoUrediModala, 350);
    setTimeout(posodobiPozicijoUrediModala, 600);
  }

  function odpriNovPredlogModal() {
    odpriUrediModal({
      id: null,
      naslov: "",
      besedilo: "",
      jeMoj: true,
      jeNov: true,
      ikona: "message-circle",
    });
  }

  if (modalNaslovVnos) {
    modalNaslovVnos.addEventListener("focus", () => {
      setTimeout(posodobiPozicijoUrediModala, 50);
      setTimeout(posodobiPozicijoUrediModala, 300);
      setTimeout(posodobiPozicijoUrediModala, 600);
    });
  }
  if (modalUrejevalnik) {
    modalUrejevalnik.addEventListener("focus", () => {
      setTimeout(posodobiPozicijoUrediModala, 50);
      setTimeout(posodobiPozicijoUrediModala, 300);
      setTimeout(posodobiPozicijoUrediModala, 600);
    });
  }

  function shraniPredlogIzModala() {
    if (!modalUrejevalnik || !odprtPredlog) return;
    const naslov = (modalNaslovVnos ? modalNaslovVnos.value : "").trim().slice(0, 80);
    const besedilo = modalUrejevalnik.value.trim().slice(0, NAJVEC_ZNAKOV);
    if (!naslov) {
      pokaziNapako("Vnesite ime predloga.");
      if (modalNaslovVnos) modalNaslovVnos.focus();
      return;
    }
    if (!besedilo) {
      pokaziNapako("Predloga ne sme biti prazna.");
      return;
    }

    // Nov prazen predlog ali kopija vgrajenega → shrani med moje predloge.
    if (odprtPredlog.jeNov || !odprtPredlog.jeMoj) {
      const novPredlog = {
        id: "moj-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        naslov,
        ikona: odprtPredlog.ikona || "message-circle",
        stilIkone: "",
        besedilo,
        jeMoj: true,
      };
      mojiPredlogi = [novPredlog, ...mojiPredlogi];
      shraniMojePredlogeVLocalStorage();
      sestaviSeznamPredlogov();
      nastaviStevilkoPredloga(novPredlog.id, modalIzbranaStevilka);
      zapriUrediModal();
      return;
    }

    const idMojega = String(odprtPredlog.id);
    mojiPredlogi = mojiPredlogi.map((p) =>
      p.id === idMojega ? { ...p, naslov, besedilo } : p
    );
    shraniMojePredlogeVLocalStorage();
    sestaviSeznamPredlogov();
    nastaviStevilkoPredloga(idMojega, modalIzbranaStevilka);
    if (izbranPredlogId) oznaciIzbranega(izbranPredlogId);
    zapriUrediModal();
  }

  async function izbrisiOdprtPredlog() {
    if (!odprtPredlog) return;
    if (odprtPredlog.jeNov) {
      zapriUrediModal();
      return;
    }

    // Odstrani fokus s textarea (iOS tipkovnica) in začasno ustavi
    // visualViewport-resize, da se urejevalnik ne raztegne čez zaslon
    // medtem ko čakamo na potrditveni modal (ki mora biti zgoraj).
    if (modalUrejevalnik) modalUrejevalnik.blur();
    if (modalNaslovVnos) modalNaslovVnos.blur();
    odstraniPritrditevUrediModala();

    const potrjeno = await potrdiVprasanje({
      naslov: "Odstranim predlogo?",
      opis: "»" + odprtPredlog.naslov + "«",
      potrdiBesedilo: "Odstrani",
      stil: "nevarno",
    });
    if (!potrjeno) {
      if (modal && !modal.hidden) pritrdiUrediModalNaVrh();
      return;
    }

    const id = odprtPredlog.id;
    if (odprtPredlog.jeMoj) {
      mojiPredlogi = mojiPredlogi.filter((p) => p.id !== id);
      shraniMojePredlogeVLocalStorage();
    } else {
      if (!Array.isArray(nastavitvePredlogov.skritiIds)) nastavitvePredlogov.skritiIds = [];
      if (!nastavitvePredlogov.skritiIds.includes(id)) {
        nastavitvePredlogov.skritiIds.push(id);
      }
    }

    delete nastavitvePredlogov.stevilke[id];
    if (izbranPredlogId === id) izbranPredlogId = null;

    shraniNastavitvePredlogov();
    zapriUrediModal();
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
  }

  function jeVeljavenIzbranPredlog(id) {
    if (id == null || id === "") return false;
    return predlogi.some((p) => String(p.id) === String(id));
  }

  function izrisiPredloge() {
    zapriVseStevilkeIzbire();
    seznam.innerHTML = "";

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
      const jePrioriteta = Number(stevilka) === 1;
      const stilStevilke = jePrioriteta
        ? " predlog-kartica__stevilka--prioriteta"
        : indeks % 2 === 1
          ? " predlog-kartica__stevilka--alt"
          : "";
      const oznakaStevilke = jePrioriteta
        ? "Prioritetna predloga (številka 1) – privzeto sporočilo"
        : "Vrstni red predloge, trenutno " + stevilka;

      kartica.innerHTML =
        '<div class="predlog-kartica__stevilka-ovoj">' +
        '<button type="button" class="predlog-kartica__stevilka' +
        stilStevilke +
        '" aria-expanded="false" aria-haspopup="listbox" aria-label="' +
        oznakaStevilke +
        '"></button>' +
        '<div class="predlog-kartica__stevilke-izbirnik" hidden role="listbox" aria-label="Izberi številko od 1 do 9">' +
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

      for (let n = 1; n <= 9; n++) {
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

      kartica.querySelector(".preview-button").addEventListener("click", () => {
        zapriVseStevilkeIzbire();
        odpriUrediModal(predlog);
      });

      kartica.querySelector(".predlog-gumb--uporabi").addEventListener("click", () => {
        zapriVseStevilkeIzbire();
        uporabiPredlog(predlog);
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
    besediloPolje.focus();
  }

  if (dodatekRok) {
    if (typeof window.inicializirajRokPlacilaSheet === "function") {
      window.inicializirajRokPlacilaSheet({
        gumbRok: dodatekRok,
        besediloPolje,
        najvecZnakov: NAJVEC_ZNAKOV,
        getPaymentDeadline: () => paymentDeadline,
        setPaymentDeadline: (v) => {
          paymentDeadline = v;
        },
        getPrivzetiDnevi: () => privzetiDneviRoka,
        setPrivzetiDnevi: (v) => {
          privzetiDneviRoka = v;
        },
        stevilkaIzbranegaPredloga,
        bazaDatumaPosiljanja,
        dodatki,
        dodatekBesedila,
        posodobiStanjeUrejevalnika,
        shraniOsnutekLokalno,
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
    dodatekObrocno.addEventListener("click", () => {
      preklopiDodatek("obrocno", "Možno je obročno plačilo po dogovoru.", dodatekObrocno);
    });
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
  if (modalZapri) modalZapri.addEventListener("click", zapriUrediModal);
  if (modalBackdrop) modalBackdrop.addEventListener("click", zapriUrediModal);
  document.addEventListener("keydown", (dogodek) => {
    if (dogodek.key !== "Escape" || !modal || modal.hidden) return;
    // Escape naj najprej zapre potrditveni modal, ne urejevalnika.
    const potrdiModal = document.getElementById("uj-potrdi-modal");
    if (potrdiModal && !potrdiModal.hidden) return;
    zapriUrediModal();
  });

  besediloPolje.addEventListener("input", () => {
    skrijNapako();
    if (besediloPolje.value.length > NAJVEC_ZNAKOV) {
      besediloPolje.value = besediloPolje.value.slice(0, NAJVEC_ZNAKOV);
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
      if (osnutek.dodatki) {
        dodatki.rok = Boolean(osnutek.dodatki.rok) || Boolean(paymentDeadline && paymentDeadline.enabled);
        dodatki.obrocno = Boolean(osnutek.dodatki.obrocno);
        dodatki.trr = Boolean(osnutek.dodatki.trr);
        if (dodatekRok) dodatekRok.setAttribute("aria-pressed", String(dodatki.rok));
        if (dodatekObrocno) dodatekObrocno.setAttribute("aria-pressed", String(dodatki.obrocno));
        if (dodatekTrr) dodatekTrr.setAttribute("aria-pressed", String(dodatki.trr));
      } else if (paymentDeadline && paymentDeadline.enabled && dodatekRok) {
        dodatekRok.setAttribute("aria-pressed", "true");
      }
    } catch (_napaka) {
      // Pokvarjen osnutek - ignoriraj.
    }
  }

  function najdiPredlogStevilka1() {
    return predlogi.find((p) => Number(p.stevilka) === 1) || predlogi[0] || null;
  }

  /**
   * Predloga s številko 1 = privzeto sporočilo zgoraj + zelena označba.
   * vsiliBesedilo: true → vedno prepiši polje; false → polje samo če je prazno.
   */
  function uporabiPredlogStevilka1(vsiliBesedilo) {
    const privzeti = najdiPredlogStevilka1();
    if (!privzeti) return;
    if (vsiliBesedilo || !besediloPolje.value.trim()) {
      uporabiPredlog(privzeti);
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

/* ---------- Logika strani neplacila-posiljanje.html (3. korak - začasni stub) ---------- */

function inicializirajPosiljanje() {
  const obrazec = document.getElementById("obrazec-posiljanje");
  const napaka = document.getElementById("splosna-napaka");
  if (!obrazec) return;

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
  const gumbShrani = document.getElementById("gumb-shrani-zadevo");
  const prilogaInfo = document.getElementById("priloga-posiljanje-info");
  const prilogaBesedilo = document.getElementById("priloga-posiljanje-besedilo");
  const prilogaKanali = document.getElementById("priloga-posiljanje-kanali");
  const kanalEmail = document.getElementById("kanal-email");
  const kanalSms = document.getElementById("kanal-sms");

  function pokaziNapako(besedilo, tehnicniPodatki) {
    napaka.textContent = tehnicniPodatki ? besedilo + " (" + tehnicniPodatki + ")" : besedilo;
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
    if (imaEmail && imaTelefon && kanalEmail && kanalSms && !kanalEmail.checked && !kanalSms.checked) {
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

  obrazec.addEventListener("submit", async (dogodek) => {
    dogodek.preventDefault();
    if (gumbShrani) gumbShrani.disabled = true;

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
      sporocilo_dolzniku: podatkiKorak2.sporociloDolzniku || null,
    });

    if (error) {
      if (gumbShrani) gumbShrani.disabled = false;
      pokaziNapako("Zadeve ni bilo mogoče dodati.", error.message);
      return;
    }

    sessionStorage.removeItem(KLJUC_SEJE_KORAK1_PODATKI);
    sessionStorage.removeItem(KLJUC_SEJE_KORAK2_PODATKI);
    sessionStorage.setItem(KLJUC_SEJE_ZADEVA_DODANA, "1");
    window.location.href = "neplacila.html#seznam";
  });
}

inicializirajNeplacila();
inicializirajSporociloDolzniku();
inicializirajPosiljanje();
inicializirajKmaluNaVoljo();

