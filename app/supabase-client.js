/* ==========================================================
   supabase-client.js - vzpostavi ENO skupno povezavo s Supabase,
   ki jo uporabljajo vse ostale skripte (auth-zascita.js, prijava.js,
   app.js ...).

   Knjižnico Supabase naložimo neposredno iz spleta (CDN) z <script>
   oznako v <head> vsake strani, zato tu samo pokličemo
   supabase.createClient() - brez npm, brez "build" koraka.

   Vrstni red <script> oznak na vsaki strani je pomemben:
   1. CDN knjižnica (definira globalno spremenljivko "supabase")
   2. config.js (definira SUPABASE_CONFIG s tvojimi podatki)
   3. supabase-client.js (ta datoteka - ustvari supabaseKlient)
   4. auth-zascita.js (uporabi supabaseKlient za preverjanje prijave)
   ========================================================== */

let supabaseKlient = null;

(function inicializirajSupabaseKlienta() {
  const konfiguracija =
    typeof SUPABASE_CONFIG !== "undefined" && SUPABASE_CONFIG
      ? SUPABASE_CONFIG
      : {};
  const url = String(konfiguracija.url || "").trim();
  const anonKey = String(konfiguracija.anonKey || "").trim();
  const veljavenUrl = /^https:\/\/[^\s/]+(?:\/.*)?$/i.test(url);
  const sdkNaVoljo =
    typeof supabase !== "undefined" &&
    supabase &&
    typeof supabase.createClient === "function";
  const jeLoopback = ["localhost", "127.0.0.1", "::1"].includes(
    window.location.hostname
  );

  /* Neveljavna konfiguracija prej pusti `const supabaseKlient` v TDZ in
     zato sesuje celoten načrt že ob varnem `typeof` preverjanju. V lokalnem
     okolju ohranimo stabilno null vrednost in odpremo obstoječi razvojni
     predogled; produkcijska prijava in njene meje ostanejo nespremenjene. */
  if (!sdkNaVoljo || !veljavenUrl || !anonKey) {
    console.warn("Povezava s Supabase ni nastavljena.");
    globalThis.UJ_LOKALNI_PREDOGLED_BREZ_SUPABASE = jeLoopback;
    if (
      jeLoopback &&
      new URLSearchParams(window.location.search).get("app-preview") !== "1"
    ) {
      const lokalniNaslov = new URL(window.location.href);
      lokalniNaslov.searchParams.set("app-preview", "1");
      window.location.replace(lokalniNaslov.href);
    }
    return;
  }

  try {
    supabaseKlient = supabase.createClient(url, anonKey);
  } catch (_napaka) {
    supabaseKlient = null;
    console.warn("Povezave s Supabase ni bilo mogoče vzpostaviti.");
  }
})();
