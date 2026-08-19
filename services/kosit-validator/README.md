# KoSIT XRechnung validator

Ločen servis poganja uradni KoSIT validator 1.6.2 z uradno konfiguracijo XRechnung 3.0.2 z dne 2026-01-31. Docker build preveri SHA-256 obeh uradnih paketov, zato zamenjan prenos ne more neopazno v sliko.

## Lokalni zagon

```sh
docker compose up --build
```

Health check: `http://127.0.0.1:8080/server/health`.

V okolje aplikacije dodajte:

```text
KOSIT_VALIDATOR_URL=https://zasciten-validator.example
KOSIT_VALIDATOR_TOKEN=skrivni-token-iz-reverse-proxyja
```

`KOSIT_VALIDATOR_TOKEN` je neobvezen le v lokalnem, omrežno izoliranem okolju. KoSIT daemon sam nima prijave. Javnega porta zato ne izpostavljajte neposredno: pred njega postavite TLS reverse proxy, avtentikacijo, omejitev velikosti telesa in rate limit. Aplikacija ob nedosegljivem validatorju pusti dokument v stanju `pending`; nikoli ga ne označi kot veljavnega.

Uradna navodila in izdaje:

- https://github.com/itplr-kosit/validator/releases/tag/v1.6.2
- https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/tag/v2026-01-31
- https://github.com/itplr-kosit/validator/blob/main/docs/daemon.md
