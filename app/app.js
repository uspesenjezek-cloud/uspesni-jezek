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
/* Vrstni red (številke 1–9) in Push-privzeta predloga – localStorage po uporabniku. */
const KLJUC_PREDLOGI_NASTAVITVE_OSNOVA = "neplacilo-predlogi-nastavitve";

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

    document.body.classList.remove("stran--samo-obrazec", "stran--samo-seznam");

    if (idRazdelka === "seznam") {
      // Samo semafor + seznam zadev (gumb "Preveri odprte zadeve").
      // Obrazec "Dodaj nov račun" mora biti popolnoma skrit.
      document.body.classList.add("stran--samo-seznam");
      if (obrazecRazdelek) obrazecRazdelek.hidden = true;
      if (semaforRazdelek) semaforRazdelek.hidden = false;
      if (seznamRazdelek) seznamRazdelek.hidden = false;
    } else if (idRazdelka === "obrazec") {
      // Samo obrazec za dodajanje (gumb "Dodaj nov račun").
      document.body.classList.add("stran--samo-obrazec");
      if (obrazecRazdelek) obrazecRazdelek.hidden = false;
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
  const podatkiKorak1 = JSON.parse(podatkiKorak1Json);
  const vgrajeniPredlogi = sestaviPredlogeSporocil(podatkiKorak1);
  let mojiPredlogi = [];
  let predlogi = [...vgrajeniPredlogi];
  let kljucMojihPredlogov = KLJUC_MOJI_PREDLOGI_OSNOVA;
  let kljucNastavitev = KLJUC_PREDLOGI_NASTAVITVE_OSNOVA;
  let nastavitvePredlogov = { stevilke: {}, pushPredlogId: null, skritiIds: [] };

  const besediloPolje = document.getElementById("sporocilo-besedilo");
  const pomocPolja = document.getElementById("sporocilo-pomoc");
  const stevecPolja = document.getElementById("sporocilo-stevec");
  const osnutekStatus = document.getElementById("osnutek-status");
  const oznakaStevila = document.getElementById("predlogi-stevilo-oznaka");
  const predlogiObvestilo = document.getElementById("predlogi-obvestilo");
  const dodatekRok = document.getElementById("dodatek-rok");
  const dodatekObrocno = document.getElementById("dodatek-obrocno");
  const dodatekTrr = document.getElementById("dodatek-trr");
  const modal = document.getElementById("predogled-modal");
  const modalNaslovVnos = document.getElementById("predogled-naslov-vnos");
  const modalUrejevalnik = document.getElementById("predogled-urejevalnik");
  const modalPush = document.getElementById("predogled-push");
  const modalIzbrisi = document.getElementById("predogled-izbrisi");
  const modalPreklici = document.getElementById("predogled-preklici");
  const modalShrani = document.getElementById("predogled-shrani");
  const modalZapri = document.getElementById("predogled-zapri");
  const modalBackdrop = document.getElementById("predogled-backdrop");

  const NAJVEC_ZNAKOV = 1000;
  let izbranPredlogId = null;
  let odprtPredlog = null;
  const dodatki = { rok: false, obrocno: false, trr: false };
  const dodatekBesedila = { rok: "", obrocno: "", trr: "" };
  let casovnikOsnutka = null;
  const zeliZmanjsanoGibanje = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ikonaSvincnika =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';
  const ikonaKljukice =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

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

  function shraniOsnutekLokalno() {
    oznaciShranjevanje();
    sessionStorage.setItem(
      KLJUC_SEJE_KORAK2_PODATKI,
      JSON.stringify({
        sporociloDolzniku: besediloPolje.value,
        izbranPredlogId,
        dodatki: { ...dodatki },
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
      if (!surovo) return { stevilke: {}, pushPredlogId: null, skritiIds: [] };
      const podatki = JSON.parse(surovo);
      return {
        stevilke:
          podatki && podatki.stevilke && typeof podatki.stevilke === "object"
            ? podatki.stevilke
            : {},
        pushPredlogId:
          podatki && typeof podatki.pushPredlogId === "string" ? podatki.pushPredlogId : null,
        skritiIds: Array.isArray(podatki && podatki.skritiIds)
          ? podatki.skritiIds.map(String)
          : [],
      };
    } catch (_napaka) {
      return { stevilke: {}, pushPredlogId: null, skritiIds: [] };
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
    if (
      nastavitvePredlogov.pushPredlogId &&
      !predlogi.some((p) => p.id === nastavitvePredlogov.pushPredlogId)
    ) {
      nastavitvePredlogov.pushPredlogId = null;
    }

    predlogi.sort((a, b) => {
      if (a.stevilka !== b.stevilka) return a.stevilka - b.stevilka;
      return a._indeks - b._indeks;
    });

    if (oznakaStevila) {
      const n = predlogi.length;
      oznakaStevila.textContent = n + (n === 1 ? " predlog" : " predlogov");
    }
    shraniNastavitvePredlogov();
  }

  function zapriVseStevilkeIzbire() {
    seznam.querySelectorAll(".predlog-kartica__stevilke-izbirnik").forEach((el) => {
      el.hidden = true;
    });
    seznam.querySelectorAll(".predlog-kartica__stevilka").forEach((gumb) => {
      gumb.setAttribute("aria-expanded", "false");
    });
    seznam.querySelectorAll(".predlog-kartica--popover-odprt").forEach((kartica) => {
      kartica.classList.remove("predlog-kartica--popover-odprt");
    });
    seznam.classList.remove("predlogi-okvir__vsebina--popover-odprt");
  }

  function nastaviStevilkoPredloga(predlogId, novaStevilka) {
    const nova = Math.max(1, Math.min(9, Number(novaStevilka) || 1));
    const konflikt = predlogi.find(
      (p) => p.id !== predlogId && Number(nastavitvePredlogov.stevilke[p.id]) === nova
    );

    nastavitvePredlogov.stevilke[predlogId] = nova;

    if (konflikt) {
      const zasedene = new Set(
        predlogi
          .filter((p) => p.id !== konflikt.id)
          .map((p) => Number(nastavitvePredlogov.stevilke[p.id]) || p.stevilka)
      );
      zasedene.add(nova);
      const prosta = najdiProstoStevilko(zasedene, nova + 1);
      if (prosta != null) {
        nastavitvePredlogov.stevilke[konflikt.id] = prosta;
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
    if (izbranPredlogId) oznaciIzbranega(izbranPredlogId);
  }

  function uporabiPredlog(predlog) {
    resetirajDodatke();
    besediloPolje.value = predlog.besedilo.slice(0, NAJVEC_ZNAKOV);
    oznaciIzbranega(predlog.id);
    posodobiStanjeUrejevalnika();
    shraniOsnutekLokalno();
  }

  function nastaviPushPredlog(predlogId, vklop) {
    if (vklop) {
      nastavitvePredlogov.pushPredlogId = predlogId;
      const predlog = predlogi.find((p) => p.id === predlogId);
      if (predlog) uporabiPredlog(predlog);
    } else if (nastavitvePredlogov.pushPredlogId === predlogId) {
      nastavitvePredlogov.pushPredlogId = null;
    }
    shraniNastavitvePredlogov();
    izrisiPredloge();
    if (izbranPredlogId) oznaciIzbranega(izbranPredlogId);
    if (modalPush && odprtPredlog && odprtPredlog.id === predlogId) {
      modalPush.setAttribute("aria-pressed", vklop ? "true" : "false");
    }
  }

  function posodobiModalPushGumb() {
    if (!modalPush || !odprtPredlog) return;
    const jePush = nastavitvePredlogov.pushPredlogId === odprtPredlog.id;
    modalPush.setAttribute("aria-pressed", jePush ? "true" : "false");
    modalPush.textContent = jePush ? "Push vklopljen" : "Push";
  }

  const modalDialog = modal ? modal.querySelector(".korak2-modal__dialog") : null;

  function posodobiPozicijoUrediModala() {
    if (!modal || modal.hidden || !modalDialog) return;
    const vv = window.visualViewport;
    if (vv) {
      // Poravnaj dialog na vrh VIDNEGA dela; višina dovolj velika, da noga (Push/Izbriši) ostane vidna.
      modalDialog.style.top = Math.round(vv.offsetTop + 8) + "px";
      modalDialog.style.maxHeight = Math.max(260, Math.round(vv.height - 16)) + "px";
    } else {
      modalDialog.style.top = "12px";
      modalDialog.style.maxHeight = "calc(100dvh - 24px)";
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
      modalDialog.style.top = "";
      modalDialog.style.maxHeight = "";
      modalDialog.scrollTop = 0;
    }
  }

  function zapriUrediModal() {
    if (!modal) return;
    odstraniPritrditevUrediModala();
    modal.hidden = true;
    odprtPredlog = null;
    if (modalNaslovVnos) modalNaslovVnos.value = "";
    if (modalUrejevalnik) modalUrejevalnik.value = "";
    if (modalPush) {
      modalPush.setAttribute("aria-pressed", "false");
      modalPush.textContent = "Push";
    }
  }

  function odpriUrediModal(predlog) {
    if (!modal || !modalUrejevalnik) return;
    odprtPredlog = predlog;
    if (modalNaslovVnos) modalNaslovVnos.value = predlog.naslov.slice(0, 80);
    modalUrejevalnik.value = predlog.besedilo.slice(0, NAJVEC_ZNAKOV);
    if (modalShrani) {
      modalShrani.textContent = predlog.jeMoj ? "Shrani" : "Shrani kot nov predlog";
    }
    posodobiModalPushGumb();
    modal.hidden = false;
    pritrdiUrediModalNaVrh();
    // Fokus → tipkovnica; po kratkem zamiku ponovno poravnaj (iOS).
    if (modalNaslovVnos) modalNaslovVnos.focus();
    else modalUrejevalnik.focus();
    requestAnimationFrame(posodobiPozicijoUrediModala);
    setTimeout(posodobiPozicijoUrediModala, 280);
  }

  if (modalNaslovVnos) {
    modalNaslovVnos.addEventListener("focus", () => {
      setTimeout(posodobiPozicijoUrediModala, 50);
      setTimeout(posodobiPozicijoUrediModala, 300);
    });
  }
  if (modalUrejevalnik) {
    modalUrejevalnik.addEventListener("focus", () => {
      setTimeout(posodobiPozicijoUrediModala, 50);
      setTimeout(posodobiPozicijoUrediModala, 300);
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

    if (odprtPredlog.jeMoj) {
      mojiPredlogi = mojiPredlogi.map((p) =>
        p.id === odprtPredlog.id ? { ...p, naslov, besedilo } : p
      );
      shraniMojePredlogeVLocalStorage();
      sestaviSeznamPredlogov();
      izrisiPredloge();
      if (izbranPredlogId) oznaciIzbranega(izbranPredlogId);
      zapriUrediModal();
      return;
    }

    // Vgrajena predloga: shrani kot novo (original ostane).
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
    nastaviStevilkoPredloga(novPredlog.id, 1);
    zapriUrediModal();
  }

  function izbrisiOdprtPredlog() {
    if (!odprtPredlog) return;
    const potrjeno = window.confirm(
      "Ali res želite odstraniti predlogo »" + odprtPredlog.naslov + "«?"
    );
    if (!potrjeno) return;

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

    if (nastavitvePredlogov.pushPredlogId === id) {
      nastavitvePredlogov.pushPredlogId = null;
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
    izbranPredlogId = id;
    seznam.querySelectorAll(".predlog-kartica").forEach((kartica) => {
      const jeIzbrana = kartica.dataset.predlogId === id;
      kartica.classList.toggle("predlog-kartica--izbrana", jeIzbrana);
      const gumb = kartica.querySelector(".predlog-gumb--uporabi");
      if (!gumb) return;
      gumb.setAttribute("aria-pressed", jeIzbrana ? "true" : "false");
      gumb.innerHTML = ikonaKljukice + (jeIzbrana ? "Izbrano" : "Uporabi");
    });
  }

  function izrisiPredloge() {
    seznam.innerHTML = "";

    predlogi.forEach((predlog, indeks) => {
      const kartica = document.createElement("article");
      kartica.className = "predlog-kartica";
      kartica.setAttribute("role", "listitem");
      kartica.dataset.predlogId = predlog.id;

      const stilStevilke = indeks % 2 === 1 ? " predlog-kartica__stevilka--alt" : "";
      const stevilka = predlog.stevilka || 1;

      kartica.innerHTML =
        '<div class="predlog-kartica__stevilka-ovoj">' +
        '<button type="button" class="predlog-kartica__stevilka' +
        stilStevilke +
        '" aria-expanded="false" aria-haspopup="listbox" aria-label="Vrstni red predloge, trenutno ' +
        stevilka +
        '">' +
        stevilka +
        "</button>" +
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
      const izbirnik = kartica.querySelector(".predlog-kartica__stevilke-izbirnik");
      const mreza = kartica.querySelector(".predlog-kartica__stevilke-mreza");

      for (let n = 1; n <= 9; n++) {
        const gumbN = document.createElement("button");
        gumbN.type = "button";
        gumbN.className = "predlog-kartica__stevilka-izbira";
        gumbN.setAttribute("role", "option");
        gumbN.setAttribute("aria-selected", n === stevilka ? "true" : "false");
        gumbN.textContent = String(n);
        gumbN.addEventListener("click", (dogodek) => {
          dogodek.stopPropagation();
          nastaviStevilkoPredloga(predlog.id, n);
        });
        mreza.appendChild(gumbN);
      }

      gumbStevilke.addEventListener("click", (dogodek) => {
        dogodek.stopPropagation();
        const jeOdprt = !izbirnik.hidden;
        zapriVseStevilkeIzbire();
        if (!jeOdprt) {
          izbirnik.hidden = false;
          gumbStevilke.setAttribute("aria-expanded", "true");
          kartica.classList.add("predlog-kartica--popover-odprt");
          seznam.classList.add("predlogi-okvir__vsebina--popover-odprt");
        }
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
    dodatekRok.addEventListener("click", () => {
      const rok =
        formatirajDatumSl(podatkiKorak1.datumZapadlosti) ||
        formatirajDatumSl(izracunajNoviRok(podatkiKorak1.datumZapadlosti));
      if (!rok) {
        pokaziNapako("Roka plačila ni mogoče dodati, ker manjka datum iz 1. koraka.");
        return;
      }
      preklopiDodatek("rok", "Rok plačila: " + rok + ".", dodatekRok);
    });
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

  if (modalPush) {
    modalPush.addEventListener("click", () => {
      if (!odprtPredlog) return;
      const jePush = nastavitvePredlogov.pushPredlogId === odprtPredlog.id;
      nastaviPushPredlog(odprtPredlog.id, !jePush);
      posodobiModalPushGumb();
    });
  }
  if (modalIzbrisi) modalIzbrisi.addEventListener("click", izbrisiOdprtPredlog);
  if (modalPreklici) modalPreklici.addEventListener("click", zapriUrediModal);
  if (modalShrani) modalShrani.addEventListener("click", shraniPredlogIzModala);
  if (modalZapri) modalZapri.addEventListener("click", zapriUrediModal);
  if (modalBackdrop) modalBackdrop.addEventListener("click", zapriUrediModal);
  document.addEventListener("keydown", (dogodek) => {
    if (dogodek.key !== "Escape" || !modal || modal.hidden) return;
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

  seznam.addEventListener("scroll", posodobiDrsnik);
  window.addEventListener("resize", posodobiDrsnik);
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

    sessionStorage.setItem(
      KLJUC_SEJE_KORAK2_PODATKI,
      JSON.stringify({
        sporociloDolzniku: sporocilo,
        izbranPredlogId,
        dodatki: { ...dodatki },
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
      }
      if (osnutek.izbranPredlogId) izbranPredlogId = osnutek.izbranPredlogId;
      if (osnutek.dodatki) {
        dodatki.rok = Boolean(osnutek.dodatki.rok);
        dodatki.obrocno = Boolean(osnutek.dodatki.obrocno);
        dodatki.trr = Boolean(osnutek.dodatki.trr);
        if (dodatekRok) dodatekRok.setAttribute("aria-pressed", String(dodatki.rok));
        if (dodatekObrocno) dodatekObrocno.setAttribute("aria-pressed", String(dodatki.obrocno));
        if (dodatekTrr) dodatekTrr.setAttribute("aria-pressed", String(dodatki.trr));
      }
    } catch (_napaka) {
      // Pokvarjen osnutek - ignoriraj.
    }
  }

  // Push ne sme prepisati že obnovljenega osnutka.
  const imaOsnutekBesedila = besediloPolje.value.trim().length > 0;
  let pushZeUporabljen = false;

  function zagonSPredlogi(moznoUporabiPush) {
    mojiPredlogi = naloziMojePredlogeIzLocalStorage();
    nastavitvePredlogov = naloziNastavitvePredlogov();
    sestaviSeznamPredlogov();
    izrisiPredloge();

    if (
      moznoUporabiPush &&
      !pushZeUporabljen &&
      !imaOsnutekBesedila &&
      nastavitvePredlogov.pushPredlogId
    ) {
      const pushPredlog = predlogi.find((p) => p.id === nastavitvePredlogov.pushPredlogId);
      if (pushPredlog) {
        uporabiPredlog(pushPredlog);
        pushZeUporabljen = true;
      }
    } else if (izbranPredlogId) {
      oznaciIzbranega(izbranPredlogId);
    }

    posodobiStanjeUrejevalnika();
  }

  document.addEventListener("click", (dogodek) => {
    if (!dogodek.target.closest(".predlog-kartica__stevilka-ovoj")) {
      zapriVseStevilkeIzbire();
    }
  });

  // Najprej prikaži vgrajene, nato (ko poznamo user id) naloži tudi moje predloge.
  zagonSPredlogi(false);
  if (typeof supabaseKlient !== "undefined" && supabaseKlient.auth) {
    supabaseKlient.auth
      .getSession()
      .then(({ data }) => {
        const uid = data && data.session && data.session.user && data.session.user.id;
        if (uid) {
          kljucMojihPredlogov = KLJUC_MOJI_PREDLOGI_OSNOVA + "-" + uid;
          kljucNastavitev = KLJUC_PREDLOGI_NASTAVITVE_OSNOVA + "-" + uid;
        }
        zagonSPredlogi(true);
      })
      .catch(() => {
        zagonSPredlogi(true);
      });
  } else {
    zagonSPredlogi(true);
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

  const podatkiKorak1 = JSON.parse(podatkiKorak1Json);
  const podatkiKorak2 = JSON.parse(podatkiKorak2Json);
  const gumbShrani = document.getElementById("gumb-shrani-zadevo");

  function pokaziNapako(besedilo, tehnicniPodatki) {
    napaka.textContent = tehnicniPodatki ? besedilo + " (" + tehnicniPodatki + ")" : besedilo;
    napaka.hidden = false;
  }

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

