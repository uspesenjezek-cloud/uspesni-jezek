# KoSIT XRechnung validator

Ločen servis poganja uradni KoSIT validator 1.6.2 z uradno konfiguracijo XRechnung 3.0.2 z dne 2026-01-31. Docker build preveri SHA-256 obeh uradnih paketov, zato zamenjan prenos ne more neopazno v sliko. Pred KoSIT demonom teče majhen lasten prehod, ki zahteva bearer token, sprejme samo XML do 2 MB in ne predpomni poročil.

## Lokalni zagon

```sh
export KOSIT_VALIDATOR_TOKEN="vsaj-32-znakov-dolg-nakljucni-token"
docker compose up --build
```

Health check: `http://127.0.0.1:8080/server/health`.

V okolje aplikacije dodajte:

```text
KOSIT_VALIDATOR_URL=https://zasciten-validator.example
KOSIT_VALIDATOR_TOKEN=skrivni-token-iz-reverse-proxyja
```

`KOSIT_VALIDATOR_TOKEN` je vedno obvezen in mora vsebovati najmanj 32 znakov. Javni promet doseže samo zaščiteni prehod; KoSIT daemon posluša izključno na `127.0.0.1:8081`. Aplikacija ob nedosegljivem validatorju pusti dokument v stanju `pending`; nikoli ga ne označi kot veljavnega.

Uradna navodila in izdaje:

- https://github.com/itplr-kosit/validator/releases/tag/v1.6.2
- https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/tag/v2026-01-31
- https://github.com/itplr-kosit/validator/blob/main/docs/daemon.md
