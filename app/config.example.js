/* ==========================================================
   config.example.js - PRIMER datoteke, varen za Git.

   Kako uporabiti:
   1. Naredi kopijo te datoteke in jo preimenuj v "config.js"
      (v isti mapi, torej app/config.js).
   2. V Supabase nadzorni plošči pojdi na Settings -> API.
   3. Vrednosti "Project URL" in "publishable key" prekopiraj spodaj.

   Datoteka config.js se NE sme znajti na GitHubu - je že dodana
   v .gitignore, zato jo Git ne bo nikoli poslal v repozitorij.
   ========================================================== */

const SUPABASE_CONFIG = {
  url: "VNESI-SVOJ-PROJECT-URL-TUKAJ",
  anonKey: "VNESI-SVOJ-PUBLISHABLE-KLJUC-TUKAJ",
};

/* DSN ni skrivnost, vendar ga za posamezno okolje vseeno nastavimo prek
   SENTRY_DSN v Vercelu. Sentry auth token nikoli ne sodi v to datoteko. */
const SENTRY_CONFIG = globalThis.SENTRY_CONFIG = Object.freeze({
  dsn: "",
  environment: "development",
  release: "",
});
