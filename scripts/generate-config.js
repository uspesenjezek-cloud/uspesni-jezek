/* ==========================================================
   generate-config.js - poganja Vercel ob vsakem deployu (glej
   "build" script v package.json). Iz environment variables
   SUPABASE_URL in SUPABASE_ANON_KEY (Vercel Project Settings ->
   Environment Variables) ustvari app/config.js v ISTI obliki, ki
   jo aplikacija sicer ročno ustvari lokalno po vzoru
   app/config.example.js (glej tudi README.md za lokalno navodilo).

   app/config.js NAMENOMA ni v Gitu (.gitignore) - ta skripta ga
   ob vsaki gradnji ustvari na novo v efemernem Vercel build
   okolju, zato pravi ključi nikoli ne pristanejo v repozitoriju.
   ========================================================== */

const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const sentryDsn = process.env.SENTRY_DSN || "";
const sentryEnvironment = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
const sentryRelease = process.env.VERCEL_GIT_COMMIT_SHA || "";
const atenaSpeechBaseUrl = "https://speech.uspesni-jezek.de";
const atenaSpeechEndpointVerified = process.env.ATENA_SPEECH_ENDPOINT_VERIFIED === "true" && sentryEnvironment === "production";

if (!url || !anonKey) {
  console.error(
    "Manjkata SUPABASE_URL in/ali SUPABASE_ANON_KEY environment variables (Vercel Project Settings -> Environment Variables) - app/config.js ne bo ustvarjen."
  );
  process.exit(1);
}

// Nikoli ne prepiši delujoče lokalne/produkcijske konfiguracije s primerom iz
// predloge. To se lahko zgodi, če nekdo zažene build s testnimi env vrednostmi.
if (
  !/^https:\/\/[^\s/]+\.supabase\.co\/?$/i.test(url) ||
  /YOUR_|PLACEHOLDER|EXAMPLE|SENSITIVE|REDACTED/i.test(url) ||
  /YOUR_|PLACEHOLDER|EXAMPLE|SENSITIVE|REDACTED/i.test(anonKey)
) {
  console.error(
    "SUPABASE_URL ali SUPABASE_ANON_KEY vsebuje testno vrednost - app/config.js ne bo prepisan."
  );
  process.exit(1);
}

const vsebina = `/* ==========================================================
   config.js - SAMODEJNO GENERIRANO ob Vercel gradnji, glej
   scripts/generate-config.js. Ne urejaj ročno na produkciji -
   spremembe se ob naslednjem deployu prepišejo.

   Za lokalni razvoj naredi svojo kopijo po vzoru
   app/config.example.js namesto urejanja te datoteke.
   ========================================================== */

const SUPABASE_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)},
};

/* Sentry DSN je javni naslov za oddajo dogodkov. Skrivni Sentry auth token
   se nikoli ne zapisuje v brskalniško konfiguracijo. */
const SENTRY_CONFIG = globalThis.SENTRY_CONFIG = Object.freeze({
  dsn: ${JSON.stringify(sentryDsn)},
  environment: ${JSON.stringify(sentryEnvironment)},
  release: ${JSON.stringify(sentryRelease)},
});

/* Endpoint je namerno pripet na en zaupanja vreden hostname. Produkcijski
   prenos ostane zaprt do ločene potrditve DNS, TLS in strežnika. */
const ATENA_SPEECH_CONFIG = globalThis.ATENA_SPEECH_CONFIG = Object.freeze({
  baseUrl: ${JSON.stringify(atenaSpeechBaseUrl)},
  endpointVerified: ${JSON.stringify(atenaSpeechEndpointVerified)},
});
`;

const ciljnaPot = path.join(__dirname, "..", "app", "config.js");
fs.writeFileSync(ciljnaPot, vsebina);
console.log("app/config.js ustvarjen iz environment variables (" + ciljnaPot + ").");
