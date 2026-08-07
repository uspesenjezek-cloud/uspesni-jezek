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
  'Iz priloženega računa/dokumenta izlušči SAMO naslednje podatke: ' +
  'naziv stranke ali podjetja oz. ime in priimek ("naziv"), ' +
  'skupni znesek za plačilo kot število brez valute in brez ločil tisočic, z decimalno piko ("znesek"), ' +
  'datum izdaje računa v obliki LLLL-MM-DD ("datum"), ' +
  'kratek opis opravljenega dela ali blaga ("opis"), ' +
  'telefonska številka stranke ali podjetja, če je navedena na dokumentu ("telefon"), ' +
  'email naslov stranke ali podjetja, če je naveden na dokumentu ("email"). ' +
  'Če katerega od teh podatkov na dokumentu ni ali ni čitljiv, nastavi to polje na null - ' +
  'NIKOLI si ne izmišljuj ali ne ugibaj vrednosti. ' +
  'Vrni SAMO veljaven JSON objekt s točno temi šestimi ključi (naziv, znesek, datum, opis, telefon, email), ' +
  'brez dodatnega besedila pred ali za njim, brez oznak kode (```).';

module.exports = async function handler(req, res) {
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
            content: [vsebinskiBlok, { type: "text", text: NAVODILO_ZA_AI }],
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
        opis: typeof razclenjenoJson.opis === "string" ? razclenjenoJson.opis.trim() : null,
        telefon: typeof razclenjenoJson.telefon === "string" ? razclenjenoJson.telefon.trim() : null,
      email: typeof razclenjenoJson.email === "string" ? razclenjenoJson.email.trim() : null,
      },
    });
  } catch (napaka) {
    console.error("[citaj-racun] Nepričakovana napaka:", napaka);
    res.status(500).json({ ok: false, napaka: "Nepričakovana napaka pri branju računa." });
  }
};
