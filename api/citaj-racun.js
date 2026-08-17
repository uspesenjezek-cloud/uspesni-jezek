var sentry = require("./_lib/sentry");
/* ==========================================================
   api/citaj-racun.js - Vercel serverless funkcija (Node.js
   runtime). Na strežniku (kjer je ANTHROPIC_API_KEY skrit v
   Vercel environment variable, glej Project Settings ->
   Environment Variables) pokliče Claude vision API in iz
   slike/PDF-ja računa izlušči osnovne podatke za samodejno
   izpolnjevanje obrazca "Nov dolg" (glej "Naloži račun" v
   app/neplacila.html in obdelajRacunZAi v app/app.js).

   Klic na Anthropic API MORA iti prek te funkcije, ne
   neposredno iz brskalnika - drugače bi bil API ključ javno
   viden v client kodi vsakomur, ki odpre "View Source".

   POMEMBNO: ta endpoint deluje SAMO na Vercel deployu (in z
   lokalno nameščenim "vercel dev"), NE preko serve.ps1 +
   ngrok - serve.ps1 streže samo statične datoteke in nima
   pojma o /api poteh.
   ========================================================== */

// Vercel-ova trda omejitev velikosti telesa zahteve za Node.js
// serverless funkcije je ~4.5 MB - base64 zapis je ~33 % večji
// od izvirnika, zato tu pustimo dovolj rezerve. Slike se pred
// pošiljanjem na strežnik že stisnejo (glej stisniSlikoZaAi v
// app.js), za PDF (ki ga ni mogoče preprosto stisniti) pa app.js
// zavrne datoteke nad 3 MB, še preden pridejo sem.
const NAJVECJA_VELIKOST_BASE64_ZNAKOV = 6 * 1024 * 1024;

const DOVOLJENI_MEDIA_TIPI = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const NAVODILO_ZA_AI =
  'Iz priloženega računa/dokumenta izlušči SAMO naslednje podatke. ' +
  'POMEMBNO: pred izpolnjevanjem JSON-a PREGLEJ CELOTEN dokument - glavo (zgoraj), ' +
  'telo (sredina) in nogo/opombe (spodaj). Ne sklepaj, da podatka ni, če si preveril ' +
  'samo en očiten del dokumenta.\n\n' +
  'Polja:\n' +
  '- "naziv": naziv stranke ali podjetja oz. ime in priimek (prejemnik/dolžnik).\n' +
  '- "znesek": skupni znesek za plačilo kot število brez valute in brez ločil tisočic, z decimalno piko.\n' +
  '- "datum": datum izdaje računa v obliki LLLL-MM-DD.\n' +
  '- "rokPlacila": rok plačila / valuta (Zahlungsziel, Fälligkeitsdatum, Due date, Rok plačila) v obliki LLLL-MM-DD.\n' +
  '- "stevilkaRacuna": številka računa. Tipične oznake: "Št. računa", "Račun št.", "Številka računa", ' +
  '"Invoice no.", "Invoice number", "Rechnungsnummer", "Rechnung Nr.", "Nr.", "Belegnr.". ' +
  'Vrednost je pogosto alfanumerična (npr. "2026-0847", "R-12345", "RE2026/12") - prepiši jo TOČNO, ' +
  'vključno z vezaji/poševnicami. Išči v glavi in blizu naslova dokumenta, pa tudi v telesu.\n' +
  '- "opis": kratek opis opravljenega dela ali blaga.\n' +
  '- "telefon": telefonska številka, če je navedena (izdajatelj ali prejemnik).\n' +
  '- "email": e-poštni naslov v obliki ime@domena (npr. info@firma.si, name@firma.de). ' +
  'Lahko je kjerkoli na dokumentu (izdajatelj ALI prejemnik) - v glavi, podpisu, nogi, ' +
  'kontaktnem bloku ali opombah. POZORNO poišči znak @ po CELOTNEM dokumentu. ' +
  'Če najdeš več e-poštnih naslovov, izberi tistega, ki najbolj verjetno pripada stranki/prejemniku; ' +
  'če ni jasno, vrni prvega čitljivega.\n\n' +
  'SELF-CHECK pred odgovorom: preden nastaviš "stevilkaRacuna" ali "email" (ali katerokoli drugo polje) ' +
  'na null, še ENKRAT preglej celoten dokument. null uporabi SAMO, če podatka res ni ali ni čitljiv - ' +
  'NIKOLI si ne izmišljuj ali ne ugibaj vrednosti.\n\n' +
  'Vrni SAMO veljaven JSON objekt s točno temi osmimi ključi ' +
  '(naziv, znesek, datum, rokPlacila, stevilkaRacuna, opis, telefon, email), ' +
  'brez dodatnega besedila pred ali za njim, brez oznak kode (```).';

const NAVODILO_ZA_BONITETNO_PREVERBO =
  'Preberi priloženi račun, ponudbo, predračun ali drug poslovni dokument in prepoznaj vse glavne pogodbene stranke. ' +
  'Najpogosteje sta to IZDAJATELJ in PREJEMNIK. Ne zamenjaj ju z banko, računovodskim servisom, dostavno službo, ' +
  'izdelovalcem dokumenta ali ponudnikom programske opreme. Preglej glavo, naslovne bloke, telo, nogo in drobni tisk.\n\n' +
  'Za vsako dejansko stranko vrni:\n' +
  '- "vloga": samo "izdajatelj", "prejemnik" ali "drugo";\n' +
  '- "pravnoIme": uradno pravno ime ali ime in priimek samostojnega podjetnika;\n' +
  '- "poslovniNaziv": blagovna znamka oziroma poslovni naziv, če se razlikuje od pravnega imena;\n' +
  '- "ulica": ulica in hišna številka;\n' +
  '- "postnaStevilka": poštna številka;\n' +
  '- "kraj": kraj;\n' +
  '- "spletnaStran": neposredno zapisana spletna stran ali jasno zapisana poslovna domena;\n' +
  '- "registerNumber": registrska oznaka in številka, npr. HRB 12345, HRA 123 ali matična številka;\n' +
  '- "vatId": davčna oziroma DDV številka, npr. DE123456789.\n\n' +
  'Ne združuj podatkov dveh strank. Če je posamezen podatek nejasen ali ga ni, vrni null. ' +
  'Ne ugibaj spletne strani samo iz splošnega e-poštnega naslova (gmail, hotmail, outlook ipd.). ' +
  'Ne dodajaj stranke brez prepoznavnega imena. Podvojene zapise združi. ' +
  'Vrni SAMO veljaven JSON objekt oblike {"stranke":[...]} brez dodatnega besedila in brez oznak kode.';

function varnoPoljeStranke(vrednost, najvec) {
  return typeof vrednost === "string" ? vrednost.trim().replace(/\s+/g, " ").slice(0, najvec) || null : null;
}

function normalizirajBonitetnoStranko(stranka) {
  var vloga = ["izdajatelj", "prejemnik", "drugo"].includes(stranka && stranka.vloga)
    ? stranka.vloga
    : "drugo";
  var pravnoIme = varnoPoljeStranke(stranka && stranka.pravnoIme, 240);
  var poslovniNaziv = varnoPoljeStranke(stranka && stranka.poslovniNaziv, 240);
  if (!pravnoIme && !poslovniNaziv) return null;
  return {
    vloga: vloga,
    pravnoIme: pravnoIme,
    poslovniNaziv: poslovniNaziv,
    ulica: varnoPoljeStranke(stranka && stranka.ulica, 140),
    postnaStevilka: varnoPoljeStranke(stranka && stranka.postnaStevilka, 12),
    kraj: varnoPoljeStranke(stranka && stranka.kraj, 80),
    spletnaStran: varnoPoljeStranke(stranka && stranka.spletnaStran, 240),
    registerNumber: varnoPoljeStranke(stranka && stranka.registerNumber, 120),
    vatId: varnoPoljeStranke(stranka && stranka.vatId, 80),
  };
}

function normalizirajBonitetneStranke(vrednost) {
  var stranke = vrednost && Array.isArray(vrednost.stranke) ? vrednost.stranke : [];
  var videnaImena = new Set();
  return stranke.map(normalizirajBonitetnoStranko).filter(Boolean).filter(function (stranka) {
    var kljuc = String(stranka.pravnoIme || stranka.poslovniNaziv).toLowerCase().replace(/[^a-z0-9äöüß]+/gi, " ").trim();
    if (!kljuc || videnaImena.has(kljuc)) return false;
    videnaImena.add(kljuc);
    return true;
  }).slice(0, 4);
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, napaka: "Metoda ni dovoljena, uporabi POST." });
    return;
  }

  const apiKljuc = process.env.ANTHROPIC_API_KEY;
  if (!apiKljuc) {
    res.status(500).json({
      ok: false,
      napaka: "Strežnik ni nastavljen - manjka ANTHROPIC_API_KEY v Vercel environment variables.",
    });
    return;
  }

  const telo = req.body || {};
  const mediaType = telo.mediaType;
  const podatki = telo.podatki;
  const jeBonitetnaPreverba = telo.namen === "bonitetna_preverba";

  if (!podatki || typeof podatki !== "string") {
    res.status(400).json({ ok: false, napaka: "Manjkajo podatki datoteke." });
    return;
  }

  if (podatki.length > NAJVECJA_VELIKOST_BASE64_ZNAKOV) {
    res.status(413).json({ ok: false, napaka: "Datoteka je prevelika za samodejno branje." });
    return;
  }

  if (!DOVOLJENI_MEDIA_TIPI.includes(mediaType)) {
    res.status(400).json({ ok: false, napaka: "Nepodprt tip datoteke." });
    return;
  }

  const vsebinskiBlok =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: mediaType, data: podatki } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: podatki } };

  try {
    const odgovorAnthropic = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKljuc,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        // Claude Sonnet 5 ima "thinking" privzeto vklopljen, thinking
        // tokeni pa se štejejo v max_tokens - pri tako majhnem max_tokens
        // bi lahko thinking porabil celotno rezervo, še preden model
        // izpiše dejanski JSON odgovor. Ker za to enostavno nalogo
        // razmišljanja ne potrebujemo, ga izklopimo.
        thinking: { type: "disabled" },
        messages: [
          {
            role: "user",
            content: [vsebinskiBlok, { type: "text", text: jeBonitetnaPreverba ? NAVODILO_ZA_BONITETNO_PREVERBO : NAVODILO_ZA_AI }],
          },
        ],
      }),
    });

    if (!odgovorAnthropic.ok) {
      const napakaBesedilo = await odgovorAnthropic.text().catch(() => "");
      console.error(
        "[citaj-racun] Anthropic API napaka, koda " + odgovorAnthropic.status + ":",
        napakaBesedilo
      );
      res.status(502).json({
        ok: false,
        napaka: "Klic na AI ni uspel (koda " + odgovorAnthropic.status + ").",
        podrobnosti: napakaBesedilo.slice(0, 500),
      });
      return;
    }

    const odgovorTelo = await odgovorAnthropic.json();
    const besediloOdgovora =
      odgovorTelo &&
      Array.isArray(odgovorTelo.content) &&
      odgovorTelo.content[0] &&
      typeof odgovorTelo.content[0].text === "string"
        ? odgovorTelo.content[0].text.trim()
        : "";

    let razclenjenoJson;
    try {
      // Claude občasno vseeno obda JSON s ```json ... ``` kodnim blokom
      // kljub izrecnemu navodilu - to tu odstranimo pred JSON.parse.
      // Presledki/nove vrstice pred oznako (npr. "\n```json") in po njej
      // se prav tako pojavljajo, zato najprej obrežemo, nato odstranimo
      // oznake, nato spet obrežemo, preden poskusimo razčleniti JSON.
      const ociscenoBesedilo = besediloOdgovora
        .trim()
        .replace(/^```(json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      razclenjenoJson = JSON.parse(ociscenoBesedilo);
    } catch (napakaParsanja) {
      console.error(
        "[citaj-racun] JSON.parse ni uspel:",
        napakaParsanja,
        "- surovo besedilo odgovora:",
        besediloOdgovora,
        "- celotno telo odgovora Anthropic:",
        JSON.stringify(odgovorTelo)
      );
      res.status(502).json({
        ok: false,
        napaka: "AI odgovora ni bilo mogoče razumeti kot JSON.",
        surovoBesedilo: besediloOdgovora.slice(0, 2000),
      });
      return;
    }

    if (jeBonitetnaPreverba) {
      const stranke = normalizirajBonitetneStranke(razclenjenoJson);
      if (!stranke.length) {
        res.status(422).json({ ok: false, napaka: "Na dokumentu ni bilo mogoče zanesljivo prepoznati nobene stranke." });
        return;
      }
      res.status(200).json({ ok: true, stranke });
      return;
    }

    res.status(200).json({
      ok: true,
      podatki: {
        naziv: typeof razclenjenoJson.naziv === "string" ? razclenjenoJson.naziv.trim() : null,
        znesek:
          razclenjenoJson.znesek !== null &&
          razclenjenoJson.znesek !== undefined &&
          Number.isFinite(Number(razclenjenoJson.znesek))
            ? Number(razclenjenoJson.znesek)
            : null,
        datum: typeof razclenjenoJson.datum === "string" ? razclenjenoJson.datum.trim() : null,
        rokPlacila:
          typeof razclenjenoJson.rokPlacila === "string" ? razclenjenoJson.rokPlacila.trim() : null,
        stevilkaRacuna:
          typeof razclenjenoJson.stevilkaRacuna === "string"
            ? razclenjenoJson.stevilkaRacuna.trim()
            : null,
        opis: typeof razclenjenoJson.opis === "string" ? razclenjenoJson.opis.trim() : null,
        telefon: typeof razclenjenoJson.telefon === "string" ? razclenjenoJson.telefon.trim() : null,
        email: typeof razclenjenoJson.email === "string" ? razclenjenoJson.email.trim() : null,
      },
    });
  } catch (napaka) {
    console.error("[citaj-racun] Nepričakovana napaka:", napaka);
    res.status(500).json({ ok: false, napaka: "Nepričakovana napaka pri branju računa." });
  }
}

module.exports = sentry.wrapHandler(handler, "/api/citaj-racun");

module.exports._test = {
  normalizirajBonitetnoStranko,
  normalizirajBonitetneStranke,
  NAVODILO_ZA_BONITETNO_PREVERBO,
};
