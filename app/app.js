/* ==========================================================
   app.js - skupna JS logika za delovni portal (app/*.html)
   Trenutno vsebuje logiko za Kat. 1: Opozarjanje na neplačila.
   Ko dodajamo nove kategorije, njihovo logiko dodajamo sem
   ali v nove ločene datoteke, glede na to, kako velika postane.
   ========================================================== */

const KLJUC_SHRAMBE_NEPLACILA = "uspesniJezek_neplacila";

/* Vrstni red statusov - od najbolj svežega do rešenega.
   "Pošlji naslednji opomin" premakne zadevo za eno mesto naprej po tem seznamu. */
const VRSTNI_RED_STATUSOV = [
  "nov",
  "opomin-1",
  "opomin-2",
  "opomin-zadnji",
  "odvetnik",
  "reseno",
];

const OZNAKE_STATUSOV = {
  nov: "Nov",
  "opomin-1": "1. opomin poslan",
  "opomin-2": "2. opomin poslan",
  "opomin-zadnji": "Zadnji opomin poslan",
  odvetnik: "Predano odvetniku",
  reseno: "Rešeno",
};

/* ---------- Shranjevanje v localStorage ---------- */

function naloziZadeve() {
  const shranjeno = localStorage.getItem(KLJUC_SHRAMBE_NEPLACILA);
  if (!shranjeno) return [];
  try {
    return JSON.parse(shranjeno);
  } catch (napaka) {
    console.error("Napaka pri branju shranjenih zadev:", napaka);
    return [];
  }
}

function shraniZadeve(zadeve) {
  localStorage.setItem(KLJUC_SHRAMBE_NEPLACILA, JSON.stringify(zadeve));
}

/* ---------- Pomožne funkcije ---------- */

function ustvariId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

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

  if (!obrazec || !seznamVsebina) {
    // Ta stran ne vsebuje obrazca/seznama za neplačila - ne naredi ničesar.
    return;
  }

  let zadeve = naloziZadeve();

  function izrisiZadeve() {
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
    ime.textContent = zadeva.ime;

    const znesek = document.createElement("span");
    znesek.className = "zadeva__znesek";
    znesek.textContent = formatirajZnesek(zadeva.znesek);

    glava.appendChild(ime);
    glava.appendChild(znesek);
    kartica.appendChild(glava);

    if (zadeva.opis) {
      const opis = document.createElement("p");
      opis.className = "zadeva__opis";
      opis.textContent = zadeva.opis;
      kartica.appendChild(opis);
    }

    const datum = document.createElement("p");
    datum.className = "zadeva__datum";
    datum.textContent = "Zapade: " + formatirajDatum(zadeva.datum);
    kartica.appendChild(datum);

    const status = document.createElement("span");
    status.className = "zadeva__status zadeva__status--" + zadeva.status;
    status.textContent = OZNAKE_STATUSOV[zadeva.status] || zadeva.status;
    kartica.appendChild(status);

    const akcije = document.createElement("div");
    akcije.className = "zadeva__akcije";

    if (zadeva.status !== "reseno") {
      const gumbNaprej = document.createElement("button");
      gumbNaprej.type = "button";
      gumbNaprej.className = "btn btn--cta btn--majhen";
      gumbNaprej.textContent =
        zadeva.status === "odvetnik"
          ? "Označi kot rešeno"
          : "Pošlji naslednji opomin";
      gumbNaprej.addEventListener("click", () => posljiOpomin(zadeva.id));
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

  function posljiOpomin(id) {
    zadeve = zadeve.map((zadeva) => {
      if (zadeva.id !== id) return zadeva;
      return { ...zadeva, status: naslednjiStatus(zadeva.status) };
    });
    shraniZadeve(zadeve);
    izrisiZadeve();
  }

  function izbrisiZadevo(id) {
    zadeve = zadeve.filter((zadeva) => zadeva.id !== id);
    shraniZadeve(zadeve);
    izrisiZadeve();
  }

  obrazec.addEventListener("submit", (dogodek) => {
    dogodek.preventDefault();

    const podatki = new FormData(obrazec);
    const novaZadeva = {
      id: ustvariId(),
      ime: podatki.get("ime").trim(),
      znesek: parseFloat(podatki.get("znesek")) || 0,
      opis: podatki.get("opis").trim(),
      datum: podatki.get("datum"),
      status: "nov",
    };

    if (!novaZadeva.ime || !novaZadeva.datum) return;

    zadeve.push(novaZadeva);
    shraniZadeve(zadeve);
    izrisiZadeve();
    obrazec.reset();
  });

  izrisiZadeve();
}

inicializirajNeplacila();
