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

function prevediAuthNapako(napakaAuth) {
  const izvirno = String((napakaAuth && napakaAuth.message) || napakaAuth || "").trim();
  if (/invalid login credentials/i.test(izvirno)) {
    return "E-pošta ali geslo nista pravilna.";
  }
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(izvirno)) {
    return "Povezava s prijavnim strežnikom ni uspela. Preverite povezavo in poskusite znova.";
  }
  if (/email not confirmed/i.test(izvirno)) {
    return "E-poštni naslov še ni potrjen. Preverite potrditveno sporočilo.";
  }
  return izvirno || "Prijava trenutno ni mogoča. Poskusite znova.";
}

async function izvediAuth(klic) {
  try {
    if (!supabaseKlient || !supabaseKlient.auth) {
      throw new Error("Povezava s prijavnim strežnikom ni nastavljena.");
    }
    return await klic();
  } catch (napakaAuth) {
    return { data: null, error: napakaAuth };
  }
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

    const { data, error } = await izvediAuth(() =>
      supabaseKlient.auth.signUp({
        email,
        password: geslo,
        options: {
          data: { ime_podjetja: imePodjetja },
          emailRedirectTo: naslovPoPotrditvi,
        },
      })
    );

    gumbPoslji.disabled = false;

    if (error) {
      pokaziNapako(prevediAuthNapako(error));
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

  const { error } = await izvediAuth(() =>
    supabaseKlient.auth.signInWithPassword({
      email,
      password: geslo,
    })
  );

  gumbPoslji.disabled = false;

  if (error) {
    pokaziNapako(prevediAuthNapako(error));
    return;
  }

  window.location.href = "index.html";
});
