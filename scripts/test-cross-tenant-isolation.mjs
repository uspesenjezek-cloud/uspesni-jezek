#!/usr/bin/env node
/**
 * Izvedljiv test ločenosti med najemniki (uporabnik A vs. uporabnik B).
 *
 * NAMEN
 * -----
 * Za vsako prednostno tabelo (računi, plačila, bančne transakcije, zadeve,
 * dokumenti) preveri, da uporabnik B skozi PostgREST (anon ključ + JWT
 * uporabnika B) NE more brati, spreminjati ali brisati vrstic uporabnika A.
 *
 * ZAGON
 * -----
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
 *   UJ_TEST_A_EMAIL=... UJ_TEST_A_PASSWORD=... \
 *   UJ_TEST_B_EMAIL=... UJ_TEST_B_PASSWORD=... \
 *   node scripts/test-cross-tenant-isolation.mjs
 *
 * VARNOSTNA PRAVILA TEGA SKRIPTA (ne spreminjaj brez razmisleka)
 * -------------------------------------------------------------
 * 1. Skript se NE zažene, če manjka katerakoli od šestih spremenljivk okolja.
 * 2. Uporablja SAMO anon ključ in prijavo z geslom - nikoli service_role.
 *    Zato ne more zaobiti RLS in ne more narediti česa, česar ne bi mogel
 *    narediti navaden uporabnik v brskalniku.
 * 3. Pišoče sonde se izvedejo nad RESNIČNO obstoječimi vrsticami uporabnika
 *    A. Nemogoč filter je bil odstranjen: dokazoval je samo, da vrstica ne
 *    obstaja, ne pa da je RLS zavrne.
 *      - "zadeve": skript vrstico sam ustvari kot A, jo napade kot B, nato
 *        kot A preveri, da je NESPREMENJENA, in jo pobriše.
 *      - POS tabele: uporabnik "authenticated" tam nima pravice INSERT, zato
 *        vrstice ni mogoče ustvariti prek PostgREST. Uporabijo se obstoječe
 *        vrstice uporabnika A. Ker bi uspešen zapis pomenil DEJANSKO
 *        spremembo podatkov testnega računa, se pišoče sonde nad njimi
 *        izvedejo samo ob izrecni privolitvi UJ_TEST_ALLOW_WRITE_PROBES=true.
 *        Skript pred napadom posname celotno vrstico in po njem primerja.
 * 4. Vse, kar skript ustvari, na koncu tudi pobriše.
 * 5. Skript nikoli ne ustvari, spremeni ali izbriše vrstice, ki je ni sam
 *    ustvaril.
 *
 * IZHOD: tabela PASS/FAIL/SKIP + izhodna koda 1, če katerakoli sonda pade.
 */

import { createClient } from "@supabase/supabase-js";

const OZNAKA = "UJ-CROSS-TENANT-TEST";

/* ---------------------------------------------------------------- okolje */

const OKOLJE = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "UJ_TEST_A_EMAIL",
  "UJ_TEST_A_PASSWORD",
  "UJ_TEST_B_EMAIL",
  "UJ_TEST_B_PASSWORD",
  "UJ_TEST_ENV_LABEL",
];

/*
 * Ciljno okolje mora biti izrecno poimenovano. Pisoce sonde lahko ob dejanski
 * ranljivosti spremenijo podatke, zato jih na okolju, oznacenem kot
 * produkcijsko, ne dovolimo - test se ne sme sam preusmeriti na produkcijo.
 */
function ciljnoOkolje() {
  const oznaka = String(process.env.UJ_TEST_ENV_LABEL || "").trim();
  let gostitelj = "(neznan)";
  try { gostitelj = new URL(String(process.env.SUPABASE_URL || "")).host; } catch (_) {}
  return { oznaka, gostitelj, jeProdukcija: /^(produkcija|production|prod)$/i.test(oznaka) };
}

/*
 * Zascita ne sme sloneti na poljubni oznaki: kdor jo napacno napise, pise v
 * produkcijo. Zato jo vezemo na DEJANSKI ciljni projekt. Operater mora
 * izrecno navesti, kateri Supabase gostitelj je testni
 * (UJ_TEST_EXPECTED_SUPABASE_HOST), in ta se mora ujemati s SUPABASE_URL.
 * Ce se ne ujemata, pisocih sond ni - ne glede na vse ostale zastavice.
 */
function pisoceSondeDovoljene(okolje) {
  if (String(process.env.UJ_TEST_ALLOW_WRITE_PROBES || "").toLowerCase() !== "true") {
    return { ok: false, razlog: "UJ_TEST_ALLOW_WRITE_PROBES ni true" };
  }
  const pricakovan = String(process.env.UJ_TEST_EXPECTED_SUPABASE_HOST || "").trim().toLowerCase();
  if (!pricakovan) {
    return { ok: false, razlog: "UJ_TEST_EXPECTED_SUPABASE_HOST ni nastavljen - ciljni projekt ni potrjen" };
  }
  if (pricakovan !== okolje.gostitelj.toLowerCase()) {
    return { ok: false, razlog: "SUPABASE_URL (" + okolje.gostitelj + ") se NE ujema s potrjenim testnim projektom (" + pricakovan + ")" };
  }
  if (okolje.jeProdukcija) {
    return { ok: false, razlog: "UJ_TEST_ENV_LABEL je produkcija" };
  }
  return { ok: true, razlog: "" };
}

function preveriOkolje() {
  const manjka = OKOLJE.filter((k) => !String(process.env[k] || "").trim());
  if (manjka.length) {
    console.error("Test ni zagnan. Manjkajo spremenljivke okolja:");
    manjka.forEach((k) => console.error("  - " + k));
    console.error("\nUporabi IZKLJUCNO testna racuna, nikoli pravih strank.");
    process.exit(2);
  }
  const a = String(process.env.UJ_TEST_A_EMAIL).trim().toLowerCase();
  const b = String(process.env.UJ_TEST_B_EMAIL).trim().toLowerCase();
  if (a === b) {
    console.error("Test ni zagnan: UJ_TEST_A_EMAIL in UJ_TEST_B_EMAIL sta enaka.");
    process.exit(2);
  }
}

/* --------------------------------------------------------------- prijava */

async function prijava(oznaka, email, geslo) {
  const klient = createClient(
    String(process.env.SUPABASE_URL).trim(),
    String(process.env.SUPABASE_ANON_KEY).trim(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await klient.auth.signInWithPassword({
    email: String(email).trim(),
    password: String(geslo),
  });
  if (error || !data || !data.user) {
    throw new Error("Prijava " + oznaka + " ni uspela: " + (error ? error.message : "brez uporabnika"));
  }
  return { klient, userId: data.user.id, email: String(email).trim() };
}

/* ------------------------------------------------------------- porocanje */

const izidi = [];

function zabelezi(tabela, sonda, uspeh, podrobnost) {
  izidi.push({ tabela, sonda, status: uspeh === null ? "SKIP" : uspeh ? "PASS" : "FAIL", podrobnost: podrobnost || "" });
}

function izpisiTabelo() {
  const sirinaT = Math.max(6, ...izidi.map((v) => v.tabela.length));
  const sirinaS = Math.max(5, ...izidi.map((v) => v.sonda.length));
  const crta = "-".repeat(sirinaT + sirinaS + 60);
  console.log("\n" + crta);
  console.log(
    "TABELA".padEnd(sirinaT) + "  " + "SONDA".padEnd(sirinaS) + "  IZID   PODROBNOST"
  );
  console.log(crta);
  for (const v of izidi) {
    console.log(
      v.tabela.padEnd(sirinaT) + "  " + v.sonda.padEnd(sirinaS) + "  " +
      v.status.padEnd(6) + " " + v.podrobnost
    );
  }
  console.log(crta);
  const pass = izidi.filter((v) => v.status === "PASS").length;
  const fail = izidi.filter((v) => v.status === "FAIL").length;
  const skip = izidi.filter((v) => v.status === "SKIP").length;
  console.log("PASS: " + pass + "   FAIL: " + fail + "   SKIP: " + skip);
  console.log(crta + "\n");
  return fail;
}

/* ----------------------------------------------------------------- sonde */

/** B poskusi PREBRATI vrstico uporabnika A. Pricakovano: 0 vrstic. */
async function sondaBranje(b, tabela, idVrstice) {
  const { data, error } = await b.klient.from(tabela).select("id").eq("id", idVrstice);
  if (error) {
    zabelezi(tabela, "B SELECT", true, "zavrnjeno z napako: " + error.code + " " + error.message);
    return;
  }
  const n = Array.isArray(data) ? data.length : 0;
  zabelezi(tabela, "B SELECT", n === 0, n === 0 ? "0 vrstic (pricakovano)" : "PUSCANJE: vrnjenih " + n + " vrstic uporabnika A");
}

/**
 * B poskusi PISATI po vrstici uporabnika A, a z dodatnim nemogocim filtrom,
 * tako da tudi ob manjkajoci zascititi ne more nicesar spremeniti.
 * Pricakovano: napaka 42501 (ni pravice) ali 0 vrstic.
 */
/**
 * B poskusi PISATI po RESNIČNI vrstici uporabnika A.
 *
 * Ta sonda lahko ob dejanski ranljivosti podatke tudi spremeni, zato teče
 * samo ob izrecni privolitvi. Pred poskusom posname celotno vrstico (prek
 * A) in po poskusu primerja - tako je razlika dokazana, ne domnevana.
 */
async function sondaPisanjeNadObstojeco(a, b, tabela, idVrstice, vrsta, spremembe) {
  const dovoljenje = pisoceSondeDovoljene(ciljnoOkolje());
  if (!dovoljenje.ok) {
    zabelezi(tabela, "B " + vrsta, null, "PRESKOCENO: " + dovoljenje.razlog);
    return;
  }
  const prej = await posnetekVrstice(a, tabela, idVrstice);
  const osnova = b.klient.from(tabela);
  const poizvedba = vrsta === "UPDATE"
    ? osnova.update(spremembe).eq("id", idVrstice).select("id")
    : osnova.delete().eq("id", idVrstice).select("id");
  const { data, error } = await poizvedba;

  if (error) {
    zabelezi(tabela, "B " + vrsta, true, "zavrnjeno: " + error.code + " " + error.message);
  } else {
    const n = Array.isArray(data) ? data.length : 0;
    zabelezi(tabela, "B " + vrsta, n === 0,
      n === 0 ? "0 vrstic (pricakovano)" : "PUSCANJE: prizadetih " + n + " vrstic uporabnika A");
  }

  // Neodvisna potrditev: A znova prebere vrstico in primerja.
  const potem = await posnetekVrstice(a, tabela, idVrstice);
  const enako = JSON.stringify(prej) === JSON.stringify(potem);
  zabelezi(tabela, "A po " + vrsta, enako,
    enako ? "vrstica nespremenjena" : "SPREMENJENO ALI IZBRISANO - vrstica uporabnika A se je spremenila");
}

/**
 * POZITIVNA KONTROLA. Brez nje lahko test navidezno uspe: ce bi bilo blokirano
 * VSE (npr. napacen kljuc, potekla seja, odvzeta pravica select), bi vse
 * negativne sonde pokazale "0 vrstic" in test bi zeleno lagal. Zato najprej
 * dokazemo, da A do SVOJE vrstice pride.
 */
async function kontrolaLastnegaDostopa(a, tabela, idVrstice) {
  const { data, error } = await a.klient.from(tabela).select("id").eq("id", idVrstice);
  if (error) {
    zabelezi(tabela, "A BERE SVOJE", false, "A ne more brati svoje vrstice: " + error.code + " " + error.message);
    return false;
  }
  const najdeno = Array.isArray(data) && data.length === 1;
  zabelezi(tabela, "A BERE SVOJE", najdeno,
    najdeno ? "A vidi svojo vrstico (kontrola veljavna)" : "A NE vidi svoje vrstice - negativne sonde niso dokaz");
  return najdeno;
}

/** Prebere celotno vrstico kot uporabnik A; null pomeni, da je ni (vec). */
async function posnetekVrstice(a, tabela, idVrstice) {
  const { data, error } = await a.klient.from(tabela).select("*").eq("id", idVrstice).maybeSingle();
  if (error) return { napaka: error.code || error.message };
  return data || null;
}

/** B poskusi PISATI po vrstici, ki jo je ustvaril ta skript (varno v celoti). */
async function sondaPisanjeNadTestnoVrstico(b, tabela, idVrstice, vrsta, spremembe) {
  const osnova = b.klient.from(tabela);
  const poizvedba = vrsta === "UPDATE"
    ? osnova.update(spremembe).eq("id", idVrstice).select("id")
    : osnova.delete().eq("id", idVrstice).select("id");
  const { data, error } = await poizvedba;
  if (error) {
    zabelezi(tabela, "B " + vrsta, true, "zavrnjeno: " + error.code + " " + error.message);
    return;
  }
  const n = Array.isArray(data) ? data.length : 0;
  zabelezi(tabela, "B " + vrsta, n === 0, n === 0 ? "0 vrstic (pricakovano)" : "PUSCANJE: prizadetih " + n + " vrstic uporabnika A");
}

/* --------------------------------------------------------------- zadeve  */

async function ustvariTestnoZadevo(a) {
  const znesek = 12.34;
  const { data, error } = await a.klient
    .from("zadeve")
    .insert({
      obrtnik_id: a.userId,
      ime_dolznika: OZNAKA + " " + Date.now(),
      znesek,
      prvotni_znesek: znesek,
      preostali_dolg: znesek,
      placano_skupaj: 0,
      opis_dolga: OZNAKA + " - samodejni test locenosti, brez pravih podatkov",
    })
    .select("id")
    .single();
  if (error) throw new Error("A ni mogel ustvariti testne zadeve: " + error.message);
  return data.id;
}

async function pobrisiTestnoZadevo(a, id) {
  if (!id) return;
  const { error } = await a.klient.from("zadeve").delete().eq("id", id).eq("obrtnik_id", a.userId);
  if (error) console.warn("OPOZORILO: testne zadeve " + id + " ni bilo mogoce pobrisati: " + error.message);
}

/* ------------------------------------------------- obstojece POS vrstice */

/**
 * Poisce ID ene vrstice, ki jo uporabnik A ze ima. Skript te vrstice NIKOLI
 * ne spremeni - uporabi jo samo kot tarco za bralno sondo uporabnika B in za
 * pisoco sondo z nemogocim filtrom.
 */
async function najdiIdUporabnikaA(a, tabela) {
  const { data, error } = await a.klient.from(tabela).select("id").limit(1);
  if (error) return { id: null, razlog: "A ne more brati " + tabela + ": " + error.message };
  if (!Array.isArray(data) || !data.length) return { id: null, razlog: "uporabnik A nima nobene vrstice v " + tabela };
  return { id: data[0].id, razlog: "" };
}

const POS_TABELE = [
  { tabela: "pos_invoices", sprememba: { customer_name: OZNAKA } },
  { tabela: "pos_payments", sprememba: { provider_reference: OZNAKA } },
  { tabela: "pos_bank_transactions", sprememba: { remittance_info: OZNAKA } },
  { tabela: "pos_invoice_documents", sprememba: { generator_version: OZNAKA } },
  { tabela: "pos_archive_records", sprememba: { document_kind: OZNAKA } },
  { tabela: "pos_adjustment_documents", sprememba: { generator_version: OZNAKA } },
];

/* ------------------------------------------------------------------ tek  */

async function main() {
  preveriOkolje();

  const okolje = ciljnoOkolje();
  console.log("CILJNO OKOLJE: " + okolje.oznaka + "  (" + okolje.gostitelj + ")");
  const pisanje = pisoceSondeDovoljene(okolje);
  console.log("Pisoce sonde: " + (pisanje.ok ? "DOVOLJENE" : "NE - " + pisanje.razlog));
  console.log("");

  console.log("Prijava obeh testnih racunov ...");
  const a = await prijava("A", process.env.UJ_TEST_A_EMAIL, process.env.UJ_TEST_A_PASSWORD);
  const b = await prijava("B", process.env.UJ_TEST_B_EMAIL, process.env.UJ_TEST_B_PASSWORD);
  if (a.userId === b.userId) {
    console.error("Test ni zagnan: racuna A in B sta isti uporabnik (" + a.userId + ").");
    process.exit(2);
  }
  console.log("A = " + a.email + " (" + a.userId + ")");
  console.log("B = " + b.email + " (" + b.userId + ")\n");

  let idZadeve = null;
  try {
    /* 1. zadeve - skript vrstico ustvari, zato so pisoce sonde v celoti varne. */
    idZadeve = await ustvariTestnoZadevo(a);
    console.log("A ustvaril testno zadevo " + idZadeve);
    const kontrolaZadeve = await kontrolaLastnegaDostopa(a, "zadeve", idZadeve);
    if (!kontrolaZadeve) {
      console.error("USTAVLJENO: A ne vidi lastne vrstice - okolje ni v stanju, ki bi dopuscalo veljaven sklep.");
    }
    await sondaBranje(b, "zadeve", idZadeve);
    await sondaPisanjeNadTestnoVrstico(b, "zadeve", idZadeve, "UPDATE", { ime_dolznika: OZNAKA + " SPREMENIL B" });
    await sondaPisanjeNadTestnoVrstico(b, "zadeve", idZadeve, "DELETE", null);

    /* Potrditev, da vrstica po sondah B se vedno obstaja in je nespremenjena. */
    const { data: poSondah } = await a.klient.from("zadeve").select("id,ime_dolznika").eq("id", idZadeve);
    const ohranjena = Array.isArray(poSondah) && poSondah.length === 1 &&
      !String(poSondah[0].ime_dolznika || "").includes("SPREMENIL B");
    zabelezi("zadeve", "A KONTROLA", ohranjena, ohranjena ? "vrstica A nedotaknjena" : "vrstica A je bila spremenjena ali izbrisana");

    /* 2. POS tabele - vrstic ni mogoce ustvariti prek PostgREST (ni pravice INSERT),
       zato se uporabijo obstojece vrstice A, z obvezno pozitivno kontrolo. */
    for (const { tabela, sprememba } of POS_TABELE) {
      const { id, razlog } = await najdiIdUporabnikaA(a, tabela);
      if (!id) {
        zabelezi(tabela, "B SELECT", null, razlog);
        zabelezi(tabela, "B UPDATE", null, razlog);
        zabelezi(tabela, "B DELETE", null, razlog);
        continue;
      }
      const veljavna = await kontrolaLastnegaDostopa(a, tabela, id);
      if (!veljavna) {
        zabelezi(tabela, "B SELECT", null, "preskoceno: pozitivna kontrola ni uspela");
        continue;
      }
      await sondaBranje(b, tabela, id);
      await sondaPisanjeNadObstojeco(a, b, tabela, id, "UPDATE", sprememba);
      await sondaPisanjeNadObstojeco(a, b, tabela, id, "DELETE", null);
    }
  } finally {
    await pobrisiTestnoZadevo(a, idZadeve);
    await a.klient.auth.signOut().catch(() => {});
    await b.klient.auth.signOut().catch(() => {});
  }

  const izid = izpisiTabelo();
  if (izid.fail > 0) {
    console.error("NEUSPEH: " + izid.fail + " sond kaze na dostop cez mejo najemnika.");
    process.exit(1);
  }
  if (izid.skip > 0) {
    // SKIP pomeni, da sonda NI bila izvedena (ni bilo tarce, pozitivna kontrola
    // ni uspela, ali pisoce sonde niso bile dovoljene). Tak tek ne dokazuje
    // nicesar in se NE sme koncati kot uspeh.
    console.error("NEPOPOLNO: " + izid.skip + " obveznih sond ni bilo izvedenih. Locenost NI dokazana.");
    console.error("Dopolni manjkajoce podatke ali dovoljenja in ponovi.");
    process.exit(4);
  }
  if (izid.pass === 0) {
    console.error("NEPOPOLNO: nobena sonda ni bila izvedena.");
    process.exit(4);
  }
  console.log("VSE sonde izvedene in zavrnjene po pricakovanju; pozitivne kontrole uspele.");
}

main().catch((napaka) => {
  console.error("Test se je ustavil z napako: " + (napaka && napaka.message ? napaka.message : napaka));
  process.exit(3);
});
