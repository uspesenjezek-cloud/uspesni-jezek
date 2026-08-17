"use strict";

/* Stub - pravega e-poštnega ponudnika (še) ni. Dokler konfiguriran() vrača
 * false, se e-poštne opomin_koraki vrstice nikoli ne smejo prikazati kot
 * poslane ali čakajoče na pošiljanje - glej api/_lib/izvedba-core.js in
 * poslji-opomin-zdaj.js. */
function konfiguriran() {
  return Boolean(process.env.EMAIL_PROVIDER_URL && process.env.EMAIL_PROVIDER_TOKEN);
}

module.exports = { konfiguriran: konfiguriran };
