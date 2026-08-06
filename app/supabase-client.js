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

const supabaseKlient = supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey,
  {
    auth: {
      // Supabase privzeto uporablja brskalniško "Web Locks" ključavnico,
      // da bi uskladil branje/osveževanje seje med več hkrati odprtimi
      // zavihki. Znana napaka v tej knjižnici je, da ta ključavnica lahko
      // ostane "obtičala" (npr. če stran zapustimo sredi preverjanja) -
      // takrat vsak naslednji getSession() čaka do 30 sekund, preden se
      // vda. Ker naša stran ne rabi usklajevanja seje med več zavihki,
      // ta mehanizem tukaj preprosto izklopimo - preverjanje prijave je
      // po tem skoraj takojšnje.
      lock: async (_ime, _casOmejitve, izvedi) => izvedi(),
    },
  }
);
