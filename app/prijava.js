/* ==========================================================
   prijava.js - obrazec za prijavo in registracijo obrtnika.
   Uporablja Supabase Auth (supabaseKlient iz supabase-client.js).
   ========================================================== */

let jeRegistracija = false;

const obrazec = document.getElementById("obrazec-prijava");
const poljeImePodjetja = document.getElementById("polje-ime-podjetja");
const naslov = document.getElementById("prijava-naslov");
const gumbPoslji = document.getElementById("gumb-poslji");
const preklopBesedilo = document.getElementById("preklop-besedilo");
const preklopPovezava = document.getElementById("preklop-povezava");
const napaka = document.getElementById("obrazec-napaka");
const sporocilo = document.getElementById("obrazec-sporocilo");

function pokaziNapako(besedilo) {
  napaka.textContent = besedilo;
  napaka.hidden = false;
  sporocilo.hidden = true;
}

function pokaziSporocilo(besedilo) {
  sporocilo.textContent = besedilo;
  sporocilo.hidden = false;
  napaka.hidden = true;
}

function skrijObvestila() {
  napaka.hidden = true;
  sporocilo.hidden = true;
}

preklopPovezava.addEventListener("click", (dogodek) => {
  dogodek.preventDefault();
  jeRegistracija = !jeRegistracija;
  skrijObvestila();

  if (jeRegistracija) {
    naslov.textContent = "Registracija";
    gumbPoslji.textContent = "Registracija";
    preklopBesedilo.textContent = "Že imaš račun?";
    preklopPovezava.textContent = "Prijava";
    poljeImePodjetja.hidden = false;
  } else {
    naslov.textContent = "Prijava";
    gumbPoslji.textContent = "Prijava";
    preklopBesedilo.textContent = "Nimaš še računa?";
    preklopPovezava.textContent = "Registracija";
    poljeImePodjetja.hidden = true;
  }
});

obrazec.addEventListener("submit", async (dogodek) => {
  dogodek.preventDefault();
  skrijObvestila();

  const podatki = new FormData(obrazec);
  const email = podatki.get("email").trim();
  const geslo = podatki.get("geslo");
  const imePodjetja = (podatki.get("imePodjetja") || "").trim();

  gumbPoslji.disabled = true;

  if (jeRegistracija) {
    // Po kliku na potrditveno povezavo v e-pošti Supabase uporabnika
    // preusmeri sem, na glavni zaslon app-a (deluje enako lokalno in kasneje
    // na pravi domeni, ker uporabimo trenutni naslov strani).
    const naslovPoPotrditvi = window.location.origin + "/app/index.html";

    const { data, error } = await supabaseKlient.auth.signUp({
      email,
      password: geslo,
      options: {
        data: { ime_podjetja: imePodjetja },
        emailRedirectTo: naslovPoPotrditvi,
      },
    });

    gumbPoslji.disabled = false;

    if (error) {
      pokaziNapako(error.message);
      return;
    }

    if (data.session) {
      window.location.href = "index.html";
    } else {
      pokaziSporocilo(
        "Račun je ustvarjen. Preveri e-pošto in potrdi račun, nato se prijavi."
      );
    }
    return;
  }

  const { error } = await supabaseKlient.auth.signInWithPassword({
    email,
    password: geslo,
  });

  gumbPoslji.disabled = false;

  if (error) {
    pokaziNapako(error.message);
    return;
  }

  window.location.href = "index.html";
});
