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

/* Ključ za začasno shranjevanje podatkov 1. koraka obrazca (vse razen
   sporočila dolžniku) v sessionStorage, dokler obrtnik ne konča še 2.
   (zadnjega) koraka na neplacila-sporocilo.html - glej inicializirajNeplacila
   (shrani) in inicializirajSporociloDolzniku (prebere in na koncu izbriše). */
const KLJUC_SEJE_KORAK1_PODATKI = "neplacilo-korak1-podatki";
/* Ključ za "opomniček", da naj se ob vrnitvi na neplacila.html prikaže
   sporočilo o uspešno dodani zadevi (glej pokaziUspesnoDodano spodaj) -
   ker se zadeva zdaj dejansko doda šele na 2. koraku, na prvi strani pa je
   takrat ne moremo več prikazati neposredno. */
const KLJUC_SEJE_ZADEVA_DODANA = "neplacilo-zadeva-dodana";

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
  const zavihekKorak2 = document.getElementById("zavihek-korak-2");
  let casovnikSporocilaSkritje = null;
  // Datoteke (slike/PDF-ji), ki jih je obrtnik izbral za priloge k zadevi -
  // dejansko se naložijo v Supabase Storage šele ob oddaji obrazca.
  let izbranePrilogeDatoteke = [];
  const NAJVEC_PRILOG = 6;
  const NAJVECJA_VELIKOST_PRILOGE_B = 10 * 1024 * 1024; // 10 MB - enako kot v sql/003

  if (!obrazec || !seznamVsebina) {
    // Ta stran ne vsebuje obrazca/seznama za neplačila - ne naredi ničesar.
    return;
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

  /* Znova izriše seznam že izbranih prilog (glej izbranePrilogeDatoteke) -
     vsaka ima kompaktno vrstico z imenom, velikostjo in gumbom "✕". Ko je
     doseženih NAJVEC_PRILOG, se gumba za dodajanje skrijeta in namesto
     njiju prikaže kratko opozorilo. */
  function izrisiIzbranePriloge() {
    // Sprostimo začasne URL-je sličic, da ne kopičiš pomnilnika ob vsakem
    // pre-risu seznama (npr. po dodajanju/odstranitvi priloge).
    prilogaSeznamVsebnik.querySelectorAll("img").forEach((slika) => {
      if (slika.src && slika.src.startsWith("blob:")) {
        URL.revokeObjectURL(slika.src);
      }
    });

    prilogaSeznamVsebnik.innerHTML = "";

    izbranePrilogeDatoteke.forEach((datoteka, indeks) => {
      const postavka = document.createElement("div");
      postavka.className = "zadeva-obrazec__priloga-postavka";

      const ikona = document.createElement("span");
      ikona.className = "zadeva-obrazec__priloga-ikona";
      ikona.setAttribute("aria-hidden", "true");

      if (datoteka.type && datoteka.type.startsWith("image/")) {
        const sličica = document.createElement("img");
        sličica.src = URL.createObjectURL(datoteka);
        sličica.alt = "";
        ikona.appendChild(sličica);
      } else {
        ikona.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>';
      }

      const meta = document.createElement("span");
      meta.className = "zadeva-obrazec__priloga-meta";

      const ime = document.createElement("span");
      ime.className = "zadeva-obrazec__priloga-ime";
      ime.textContent = datoteka.name;

      const velikost = document.createElement("span");
      velikost.className = "zadeva-obrazec__priloga-velikost";
      velikost.textContent = formatirajVelikostDatoteke(datoteka.size);

      meta.appendChild(ime);
      if (velikost.textContent) meta.appendChild(velikost);

      const odstrani = document.createElement("button");
      odstrani.type = "button";
      odstrani.className = "zadeva-obrazec__priloga-odstrani";
      odstrani.setAttribute("aria-label", "Odstrani prilogo");
      odstrani.textContent = "✕";
      odstrani.addEventListener("click", () => {
        izbranePrilogeDatoteke.splice(indeks, 1);
        izrisiIzbranePriloge();
      });

      postavka.appendChild(ikona);
      postavka.appendChild(meta);
      postavka.appendChild(odstrani);
      prilogaSeznamVsebnik.appendChild(postavka);
    });

    const dosezenaMeja = izbranePrilogeDatoteke.length >= NAJVEC_PRILOG;
    prilogaGumbiVsebnik.hidden = dosezenaMeja;
    prilogaLimitOpozorilo.hidden = !dosezenaMeja;
  }

  /* Doda novo(-e) izbrano(-e) datoteko(-e) v seznam prilog, do skupaj
     največ NAJVEC_PRILOG - presežek se tiho zavrže (uporabnik takoj vidi
     opozorilo o meji, glej izrisiIzbranePriloge). */
  function dodajIzbranePriloge(datoteke) {
    for (const datoteka of datoteke) {
      if (izbranePrilogeDatoteke.length >= NAJVEC_PRILOG) break;
      izbranePrilogeDatoteke.push(datoteka);
    }
    izrisiIzbranePriloge();
  }

  function pocistiIzbranePriloge() {
    izbranePrilogeDatoteke = [];
    gumbPrilogaDatoteka.value = "";
    gumbPrilogaFotoaparat.value = "";
    izrisiIzbranePriloge();
  }

  /* Dva ločena gumba odpreta vsak svoj file input - isti seznam prilog.
     "Slikaj račun" uporablja capture="environment" (zadnja kamera); na
     namizju brskalnik varno pade na običajni izbor slike. */
  const prilogaGumbPriloziti = document.getElementById("priloga-gumb-priloziti");
  const prilogaGumbSlikaj = document.getElementById("priloga-gumb-slikaj");

  if (gumbPrilogaDatoteka && gumbPrilogaFotoaparat) {
    gumbPrilogaDatoteka.addEventListener("change", () => {
      dodajIzbranePriloge(gumbPrilogaDatoteka.files);
      gumbPrilogaDatoteka.value = "";
    });

    gumbPrilogaFotoaparat.addEventListener("change", () => {
      dodajIzbranePriloge(gumbPrilogaFotoaparat.files);
      gumbPrilogaFotoaparat.value = "";
    });
  }

  if (prilogaGumbPriloziti && gumbPrilogaDatoteka) {
    prilogaGumbPriloziti.addEventListener("click", () => {
      gumbPrilogaDatoteka.click();
    });
  }

  if (prilogaGumbSlikaj && gumbPrilogaFotoaparat) {
    prilogaGumbSlikaj.addEventListener("click", () => {
      gumbPrilogaFotoaparat.click();
    });
  }

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

  /* ---------- "Naloži račun" - samodejno branje računa z AI (Claude vision) ----------
     Blok NAD razdelkom "Kdo vam dolguje?" (glej #ai-zajem v neplacila.html).
     Slika/PDF gre na /api/citaj-racun (Vercel serverless funkcija, glej
     api/citaj-racun.js) - Anthropic API ključ je SAMO tam, na strežniku,
     nikoli v tej datoteki, ker bi bil sicer javno viden vsakomur. Ta klic
     zato deluje SAMO na Vercel deployu, ne v lokalnem serve.ps1 razvoju. */
  const aiZajemGumbPriloziti = document.getElementById("ai-zajem-gumb-priloziti");
  const aiZajemGumbSlikaj = document.getElementById("ai-zajem-gumb-slikaj");
  const aiZajemDatoteka = document.getElementById("ai-zajem-datoteka");
  const aiZajemFotoaparat = document.getElementById("ai-zajem-fotoaparat");
  const aiZajemPredogled = document.getElementById("ai-zajem-predogled");
  const aiZajemSlicica = document.getElementById("ai-zajem-slicica");
  const aiZajemDatotekaIkona = document.getElementById("ai-zajem-datoteka-ikona");
  const aiZajemIme = document.getElementById("ai-zajem-ime");
  const aiZajemStatus = document.getElementById("ai-zajem-status");
  const aiZajemStatusBesedilo = document.getElementById("ai-zajem-status-besedilo");
  const aiZajemSpinner = aiZajemStatus ? aiZajemStatus.querySelector(".ai-zajem__spinner") : null;
  const aiZajemOdstrani = document.getElementById("ai-zajem-odstrani");
  const NAJVECJA_VELIKOST_AI_PDF_B = 3 * 1024 * 1024; // 3 MB - glej api/citaj-racun.js za razlog
  let aiZajemPredoglejUrl = null;

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
    // stanje: "nalaganje" | "uspeh" | "napaka" | null (skrij status)
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
    if (stanje === "uspeh") aiZajemStatus.classList.add("ai-zajem__status--uspeh");
    if (stanje === "napaka") aiZajemStatus.classList.add("ai-zajem__status--napaka");
    if (aiZajemSpinner) aiZajemSpinner.hidden = stanje !== "nalaganje";
  }

  function pokaziAiZajemPredogled(datoteka) {
    if (aiZajemPredoglejUrl) {
      URL.revokeObjectURL(aiZajemPredoglejUrl);
      aiZajemPredoglejUrl = null;
    }

    aiZajemIme.textContent = datoteka.name;
    if (datoteka.type && datoteka.type.startsWith("image/")) {
      aiZajemPredoglejUrl = URL.createObjectURL(datoteka);
      aiZajemSlicica.src = aiZajemPredoglejUrl;
      aiZajemSlicica.hidden = false;
      aiZajemDatotekaIkona.hidden = true;
    } else {
      aiZajemSlicica.hidden = true;
      aiZajemSlicica.src = "";
      aiZajemDatotekaIkona.hidden = false;
    }

    aiZajemPredogled.hidden = false;
    nastaviAiZajemStatus("AI bere račun …", "nalaganje");
  }

  function pocistiAiZajem() {
    if (aiZajemPredoglejUrl) {
      URL.revokeObjectURL(aiZajemPredoglejUrl);
      aiZajemPredoglejUrl = null;
    }
    aiZajemPredogled.hidden = true;
    aiZajemSlicica.hidden = true;
    aiZajemSlicica.src = "";
    aiZajemDatotekaIkona.hidden = true;
    aiZajemIme.textContent = "";
    nastaviAiZajemStatus("", null);
    if (aiZajemDatoteka) aiZajemDatoteka.value = "";
    if (aiZajemFotoaparat) aiZajemFotoaparat.value = "";
  }

  /* Označi polje kot samodejno izpolnjeno (bled zelen border, glej
     .obrazec__polje--ai-izpolnjeno v styles.css) - oznaka se sname takoj,
     ko uporabnik polje ročno spremeni, da ne zavaja glede izvora vrednosti. */
  function oznaciPoljeKotAiIzpolnjeno(polje) {
    if (!polje) return;
    polje.classList.add("obrazec__polje--ai-izpolnjeno");
    const odstraniOznako = () => {
      polje.classList.remove("obrazec__polje--ai-izpolnjeno");
      polje.removeEventListener("input", odstraniOznako);
    };
    polje.addEventListener("input", odstraniOznako);
  }

  /* Prepiše SAMO polja, ki jih je AI dejansko prepoznal (ne piše čez polje,
     če je AI vrnil null - glej zahtevo "če ne prepozna, pusti prazno" v
     api/citaj-racun.js). Uporabnik lahko vsako vrednost pred oddajo obrazca
     še vedno ročno popravi. */
  function izpolniPoljaIzAI(podatki) {
    if (!podatki) return;

    if (podatki.naziv) {
      const polje = document.getElementById("ime-stranke");
      polje.value = podatki.naziv;
      oznaciPoljeKotAiIzpolnjeno(polje);
    }

    if (podatki.znesek != null && Number.isFinite(Number(podatki.znesek))) {
      const polje = document.getElementById("znesek-dolga");
      polje.value = Number(podatki.znesek).toFixed(2);
      oznaciPoljeKotAiIzpolnjeno(polje);
    }

    if (podatki.datum && /^\d{4}-\d{2}-\d{2}$/.test(podatki.datum)) {
      const polje = document.getElementById("datum-izdaje");
      polje.value = podatki.datum;
      oznaciPoljeKotAiIzpolnjeno(polje);
    }

    if (podatki.opis) {
      const polje = document.getElementById("opis-dolga");
      polje.value = podatki.opis;
      oznaciPoljeKotAiIzpolnjeno(polje);
    }
  }

  async function obdelajRacunZAi(datoteka) {
    pokaziAiZajemPredogled(datoteka);

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
      nastaviAiZajemStatus("Podatki so prepoznani - preverite jih spodaj.", "uspeh");

      // Slikan/naložen račun postane tudi dejanska priloga zadeve, da ga ni
      // treba v razdelku 2 nalagati/slikati še enkrat.
      dodajIzbranePriloge([datoteka]);
    } catch (napakaAi) {
      nastaviAiZajemStatus(
        napakaAi && napakaAi.message ? napakaAi.message : "Prišlo je do napake pri branju računa - podatke vnesite ročno.",
        "napaka"
      );
    }
  }

  if (aiZajemGumbPriloziti && aiZajemDatoteka) {
    aiZajemGumbPriloziti.addEventListener("click", () => aiZajemDatoteka.click());
  }

  if (aiZajemGumbSlikaj && aiZajemFotoaparat) {
    aiZajemGumbSlikaj.addEventListener("click", () => aiZajemFotoaparat.click());
  }

  if (aiZajemDatoteka) {
    aiZajemDatoteka.addEventListener("change", () => {
      if (aiZajemDatoteka.files[0]) obdelajRacunZAi(aiZajemDatoteka.files[0]);
    });
  }

  if (aiZajemFotoaparat) {
    aiZajemFotoaparat.addEventListener("change", () => {
      if (aiZajemFotoaparat.files[0]) obdelajRacunZAi(aiZajemFotoaparat.files[0]);
    });
  }

  if (aiZajemOdstrani) {
    aiZajemOdstrani.addEventListener("click", pocistiAiZajem);
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

    const obrazecRazdelek = document.getElementById("obrazec");
    const semaforRazdelek = document.getElementById("seznam");
    const seznamRazdelek = document.getElementById("seznam-vsebnik");

    if (idRazdelka === "seznam") {
      if (obrazecRazdelek) obrazecRazdelek.hidden = true;
    } else if (idRazdelka === "obrazec") {
      if (semaforRazdelek) semaforRazdelek.hidden = true;
      if (seznamRazdelek) seznamRazdelek.hidden = true;
    }

    const razdelek = document.getElementById(idRazdelka);
    if (razdelek) razdelek.scrollIntoView({ behavior: "auto", block: "start" });
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

    // Zadeva se dejansko doda v bazo šele na 2. (zadnjem) koraku, potem ko
    // obrtnik napiše še sporočilo dolžniku (glej neplacila-sporocilo.html
    // in inicializirajSporociloDolzniku spodaj) - tu samo naložimo
    // morebitne priloge (kot doslej) in vse podatke tega koraka začasno
    // shranimo, da jih 2. korak lahko prebere.
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
      })
    );

    window.location.href = "neplacila-sporocilo.html";
  });

  /* Zavihek "2 · Sestavi opomin" je samo bližnjica do gumba "Naprej" na dnu
     obrazca - requestSubmit() sproži IST "submit" dogodek zgoraj (torej
     enako preverbo obveznih polj in enak potek), da za klik na zavihek ni
     treba podvajati logike. */
  if (zavihekKorak2) {
    zavihekKorak2.addEventListener("click", () => {
      obrazec.requestSubmit();
    });
  }

  /* Če se obrtnik pravkar vrnil iz 2. koraka po uspešno dodani zadevi
     (glej inicializirajSporociloDolzniku), prikaži isto potrditveno
     sporočilo kot prej, ko se je zadeva dodajala neposredno tu. */
  if (sessionStorage.getItem(KLJUC_SEJE_ZADEVA_DODANA)) {
    sessionStorage.removeItem(KLJUC_SEJE_ZADEVA_DODANA);
    pokaziUspesnoDodano();
  }

  prilagodiPrikazGledeNaFragment();
  osveziSeznam();
}

/* ---------- Logika strani neplacila-sporocilo.html (2. korak) ---------- */

function inicializirajSporociloDolzniku() {
  const obrazec = document.getElementById("obrazec-sporocilo");
  const napaka = document.getElementById("splosna-napaka");

  if (!obrazec) {
    // Ta stran ne vsebuje obrazca za sporočilo dolžniku - ne naredi ničesar.
    return;
  }

  const podatkiKorak1Json = sessionStorage.getItem(KLJUC_SEJE_KORAK1_PODATKI);
  if (!podatkiKorak1Json) {
    // Obrtnik je prišel na to stran neposredno, brez da bi izpolnil 1.
    // korak (npr. osvežil stran, prilepil povezavo) - podatkov o zadevi
    // sploh nimamo, zato ga vrnemo nazaj na začetek.
    window.location.href = "neplacila.html#obrazec";
    return;
  }
  const podatkiKorak1 = JSON.parse(podatkiKorak1Json);

  const besediloPolje = document.getElementById("sporocilo-besedilo");
  const gumbPoslji = obrazec.querySelector("button[type=submit]");

  function pokaziNapako(besedilo, tehnicniPodatki) {
    napaka.textContent = tehnicniPodatki
      ? besedilo + " (" + tehnicniPodatki + ")"
      : besedilo;
    napaka.hidden = false;
    napaka.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function skrijNapako() {
    napaka.hidden = true;
  }

  /* Vstavi besedilo predloga (iz katerekoli skupine - sporočila ali
     možnosti plačila) v okno sporočila - če je okno še prazno, ga samo
     napolni, sicer besedilo doda na konec, tako da lahko obrtnik
     sporočilo, ki ga že piše, s predlogom samo dopolni. */
  function vstaviPredlogVSporocilo(besedilo) {
    const obstojeceBesedilo = besediloPolje.value.replace(/\s+$/, "");
    besediloPolje.value = obstojeceBesedilo
      ? obstojeceBesedilo + " " + besedilo
      : besedilo;
    besediloPolje.focus();
  }

  /* Poveže eno "skupino" predlogov (predlogi sporočila ALI možnosti
     plačila - obe uporabljata popolnoma enak vzorec, glej
     .sporocilo-predlog v styles.css) z bazo: naloži obstoječe predloge te
     kategorije (glej stolpec "kategorija" v tabeli sporocilo_predlogi),
     izriše jih kot klikljive gumbe, in poveže obrazec "+ Dodaj predlog". */
  function inicializirajSkupinoPredlogov(kategorija, elementi) {
    const { seznam, gumbDodaj, novObrazec, novoBesedilo, gumbShrani, gumbPreklici, gumbUredi } =
      elementi;

    // Predlogi te kategorije, v trenutnem vrstnem redu - hranimo jih tukaj
    // (ne samo v DOM-u), da lahko ob kliku na puščico "levo"/"desno" preprosto
    // zamenjamo dva soseda v tem seznamu in celoten trak znova izrišemo.
    let podatki = [];

    function izrisiVse() {
      seznam.innerHTML = "";
      podatki.forEach((predlog, indeks) => izrisiPredlog(predlog, indeks));
    }

    /* Zamenja vrstni red predloga na "indeks" s sosedom na "sosednjiIndeks"
       (levo = indeks-1, desno = indeks+1) - takoj posodobi prikaz, nato v
       ozadju shrani zamenjan "vrstni_red" obeh predlogov v bazo. */
    async function premakniPredlog(indeks, sosednjiIndeks) {
      const predlogA = podatki[indeks];
      const predlogB = podatki[sosednjiIndeks];
      const vrstniRedA = predlogA.vrstni_red;
      const vrstniRedB = predlogB.vrstni_red;

      [podatki[indeks], podatki[sosednjiIndeks]] = [podatki[sosednjiIndeks], podatki[indeks]];
      izrisiVse();

      const [{ error: napakaA }, { error: napakaB }] = await Promise.all([
        supabaseKlient
          .from("sporocilo_predlogi")
          .update({ vrstni_red: vrstniRedB })
          .eq("id", predlogA.id),
        supabaseKlient
          .from("sporocilo_predlogi")
          .update({ vrstni_red: vrstniRedA })
          .eq("id", predlogB.id),
      ]);

      const napaka = napakaA || napakaB;
      if (napaka) {
        pokaziNapako("Vrstnega reda ni bilo mogoče shraniti.", napaka.message);
        return;
      }

      predlogA.vrstni_red = vrstniRedB;
      predlogB.vrstni_red = vrstniRedA;
    }

    function izrisiPredlog(predlog, indeks) {
      const ovoj = document.createElement("div");
      ovoj.className = "sporocilo-predlog-ovoj";

      if (predlog.priporoceno) {
        const zvezdica = document.createElement("span");
        zvezdica.className = "sporocilo-predlog-zvezdica";
        zvezdica.textContent = "★";
        zvezdica.title = "Priporočeno";
        ovoj.appendChild(zvezdica);
      }

      const gumbPredlog = document.createElement("button");
      gumbPredlog.type = "button";
      gumbPredlog.className = "sporocilo-predlog";
      gumbPredlog.textContent = predlog.besedilo;
      gumbPredlog.addEventListener("click", () => vstaviPredlogVSporocilo(predlog.besedilo));
      ovoj.appendChild(gumbPredlog);

      const gumbBrisi = document.createElement("button");
      gumbBrisi.type = "button";
      gumbBrisi.className = "sporocilo-predlog-brisi";
      gumbBrisi.textContent = "✕";
      gumbBrisi.setAttribute("aria-label", "Izbriši predlog");
      gumbBrisi.addEventListener("click", async () => {
        if (!confirm("Ali res želiš izbrisati ta predlog?")) return;

        const { error } = await supabaseKlient
          .from("sporocilo_predlogi")
          .delete()
          .eq("id", predlog.id);

        if (error) {
          pokaziNapako("Predloga ni bilo mogoče izbrisati.", error.message);
          return;
        }

        podatki = podatki.filter((p) => p.id !== predlog.id);
        izrisiVse();
      });
      ovoj.appendChild(gumbBrisi);

      const gumbLevo = document.createElement("button");
      gumbLevo.type = "button";
      gumbLevo.className = "sporocilo-predlog-premakni sporocilo-predlog-premakni--levo";
      gumbLevo.textContent = "‹";
      gumbLevo.setAttribute("aria-label", "Premakni predlog v levo");
      gumbLevo.disabled = indeks === 0;
      gumbLevo.addEventListener("click", () => premakniPredlog(indeks, indeks - 1));
      ovoj.appendChild(gumbLevo);

      const gumbDesno = document.createElement("button");
      gumbDesno.type = "button";
      gumbDesno.className = "sporocilo-predlog-premakni sporocilo-predlog-premakni--desno";
      gumbDesno.textContent = "›";
      gumbDesno.setAttribute("aria-label", "Premakni predlog v desno");
      gumbDesno.disabled = indeks === podatki.length - 1;
      gumbDesno.addEventListener("click", () => premakniPredlog(indeks, indeks + 1));
      ovoj.appendChild(gumbDesno);

      seznam.appendChild(ovoj);
    }

    async function nalozi() {
      const { data, error } = await supabaseKlient
        .from("sporocilo_predlogi")
        .select("*")
        .eq("kategorija", kategorija)
        .order("vrstni_red", { ascending: true })
        .order("ustvarjeno_at", { ascending: true });

      if (error) {
        pokaziNapako("Predlogov ni bilo mogoče naložiti.", error.message);
        return;
      }

      podatki = data;
      izrisiVse();
    }

    gumbDodaj.addEventListener("click", () => {
      novObrazec.hidden = false;
      gumbDodaj.hidden = true;
      novoBesedilo.value = "";
      novoBesedilo.focus();
    });

    gumbPreklici.addEventListener("click", () => {
      novObrazec.hidden = true;
      gumbDodaj.hidden = false;
    });

    gumbUredi.addEventListener("click", () => {
      const urejanjeVklopljeno = seznam.classList.toggle("sporocilo-predlogi-seznam--urejanje");
      gumbUredi.textContent = urejanjeVklopljeno ? "Končano" : "Uredi";
      gumbUredi.classList.toggle("btn--aktiven", urejanjeVklopljeno);
    });

    gumbShrani.addEventListener("click", async () => {
      const besedilo = novoBesedilo.value.trim();
      if (!besedilo) return;

      skrijNapako();

      const {
        data: { user },
      } = await supabaseKlient.auth.getUser();

      // Nov predlog gre vedno na konec seznama.
      const vrstniRedNaKoncu =
        podatki.length > 0 ? Math.max(...podatki.map((p) => p.vrstni_red)) + 1 : 1;

      const { data, error } = await supabaseKlient
        .from("sporocilo_predlogi")
        .insert({
          besedilo,
          kategorija,
          dodal_obrtnik_id: user ? user.id : null,
          vrstni_red: vrstniRedNaKoncu,
        })
        .select()
        .single();

      if (error) {
        pokaziNapako("Predloga ni bilo mogoče shraniti.", error.message);
        return;
      }

      podatki.push(data);
      izrisiVse();
      novObrazec.hidden = true;
      gumbDodaj.hidden = false;
    });

    nalozi();
  }

  inicializirajSkupinoPredlogov("sporocilo", {
    seznam: document.getElementById("predlogi-seznam"),
    gumbDodaj: document.getElementById("gumb-dodaj-predlog"),
    novObrazec: document.getElementById("nov-predlog-obrazec"),
    novoBesedilo: document.getElementById("nov-predlog-besedilo"),
    gumbShrani: document.getElementById("gumb-shrani-predlog"),
    gumbPreklici: document.getElementById("gumb-preklici-predlog"),
    gumbUredi: document.getElementById("gumb-uredi-predlog"),
  });

  inicializirajSkupinoPredlogov("placilo", {
    seznam: document.getElementById("predlogi-placilo-seznam"),
    gumbDodaj: document.getElementById("gumb-dodaj-predlog-placilo"),
    novObrazec: document.getElementById("nov-predlog-placilo-obrazec"),
    novoBesedilo: document.getElementById("nov-predlog-placilo-besedilo"),
    gumbShrani: document.getElementById("gumb-shrani-predlog-placilo"),
    gumbPreklici: document.getElementById("gumb-preklici-predlog-placilo"),
    gumbUredi: document.getElementById("gumb-uredi-predlog-placilo"),
  });

  obrazec.addEventListener("submit", async (dogodek) => {
    dogodek.preventDefault();
    skrijNapako();
    gumbPoslji.disabled = true;

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
      sporocilo_dolzniku: besediloPolje.value.trim() || null,
    });

    if (error) {
      gumbPoslji.disabled = false;
      pokaziNapako("Zadeve ni bilo mogoče dodati.", error.message);
      return;
    }

    sessionStorage.removeItem(KLJUC_SEJE_KORAK1_PODATKI);
    sessionStorage.setItem(KLJUC_SEJE_ZADEVA_DODANA, "1");
    window.location.href = "neplacila.html#seznam";
  });
}

inicializirajNeplacila();
inicializirajSporociloDolzniku();
