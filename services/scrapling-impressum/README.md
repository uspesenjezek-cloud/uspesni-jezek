# Scrapling Impressum service

Internal acquisition service for public German legal pages, allowlisted public HWK directories, and a non-blocking health preflight for the official insolvency portal. It is not an identity authority: Node parsers still apply the canonical legal-context, identity and address gates.

The service checks `robots.txt`, resolves every target to public IP addresses, throttles per domain and never retries or bypasses `429`, authentication, payment, consent or CAPTCHA controls. It first uses Scrapling's static fetcher and only uses an ordinary headless browser for a `403` or a thin JavaScript page. It does not use Scrapling's Cloudflare-solving or stealth browser mode.

## Local run

```powershell
$env:SCRAPLING_IMPRESSUM_TOKEN = "replace-with-at-least-32-random-characters"
$env:PORT = "8766"
python app.py
```

Configure the Node application with:

```text
SCRAPLING_IMPRESSUM_URL=http://127.0.0.1:8766
SCRAPLING_IMPRESSUM_TOKEN=<same token>
```

Production must use HTTPS and keep this service private. Only `/health` is unauthenticated. `/v1/impressum/fetch` requires purpose `legal_impressum_fallback`; `/v1/hwk/fetch` requires purpose `public_hwk_directory`; `/v1/insolvency/preflight` requires purpose `official_insolvency_preflight`. All protected endpoints require the same bearer token.

The insolvency preflight accepts no caller-supplied URL. Scrapling checks `robots.txt` only for the fixed public landing URL, fetches that landing page with no retry, and never requests, parses, or submits the official search form. The result is cached for five minutes, concurrent calls are deduplicated, and the client has a five-second deadline. The check starts in parallel with the already-authorized form transaction and never blocks or replaces it. A missing or unavailable Scrapling service is only a health signal; the existing evidence browser still submits the user-confirmed identity and location, validates the actual form values before submission, captures the official result, and fails closed if that transaction itself cannot be verified.

The service accepts at least 20 simultaneous unique requests. It keeps at most four network fetches active, deduplicates identical in-flight URLs and serializes the start delay per target domain. This lets bursts queue safely without sending a 20-request burst to one chamber. `busy/queue_full`, `rate_limited`, `robots_disallowed` and `unavailable` are terminal transport states and must never block the application's primary verification flow.

## Google Cloud Run

Cloud Run is the preferred low-volume deployment because it scales to zero. The container listens on `0.0.0.0:$PORT`, uses no minimum instances and can therefore stay inside the Cloud Run free tier while usage is low.

Recommended service limits:

```text
Region: europe-west3 (Frankfurt)
CPU: 1
Memory: 2 GiB
Minimum instances: 0
Maximum instances: 1
Concurrency: 32
Request timeout: 60 seconds
Authentication: Allow unauthenticated HTTP (the fetch endpoint still requires its bearer token)
```

From Google Cloud Shell, after selecting a project with billing enabled:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud run deploy scrapling-impressum \
  --source . \
  --region europe-west3 \
  --allow-unauthenticated \
  --cpu 1 \
  --memory 2Gi \
  --min 0 \
  --max 1 \
  --concurrency 32 \
  --timeout 60 \
  --set-env-vars SCRAPLING_MAX_CONCURRENCY=4,SCRAPLING_MAX_PENDING=32,SCRAPLING_IMPRESSUM_TOKEN=REPLACE_WITH_A_RANDOM_32_PLUS_CHARACTER_SECRET
```

Run the command from this service directory. Do not commit the real token. After deployment, copy the HTTPS service URL into `SCRAPLING_IMPRESSUM_URL` in Vercel and set the same token as `SCRAPLING_IMPRESSUM_TOKEN`. Configure a small Google Cloud budget alert before production use; a budget alert warns but does not automatically stop resources.
