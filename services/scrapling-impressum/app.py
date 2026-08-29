from __future__ import annotations

import asyncio
import hmac
import ipaddress
import json
import os
import socket
import threading
import time
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from scrapling.fetchers import DynamicFetcher, Fetcher
from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route


SERVICE_VERSION = "scrapling-acquisition-v4"
IMPRESSUM_PURPOSE = "legal_impressum_fallback"
HWK_PURPOSE = "public_hwk_directory"
INSOLVENCY_PREFLIGHT_PURPOSE = "official_insolvency_preflight"
INSOLVENCY_LANDING_URL = "https://neu.insolvenzbekanntmachungen.de/ap/index.jsf"
INSOLVENCY_SEARCH_URL = "https://neu.insolvenzbekanntmachungen.de/ap/suche.jsf"
USER_AGENT = "Uspesni-Jezek-soft-business-check/1.0"
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
MAX_REQUEST_BYTES = 8 * 1024
MAX_HTML_CHARS = 5 * 1024 * 1024
MAX_TEXT_CHARS = 1024 * 1024
MIN_DOMAIN_DELAY_SECONDS = 1.0
MAX_ACTIVE_FETCHES = max(1, min(int(os.getenv("SCRAPLING_MAX_CONCURRENCY", "4")), 4))
MAX_PENDING_FETCHES = max(20, min(int(os.getenv("SCRAPLING_MAX_PENDING", "32")), 100))
QUEUE_WAIT_SECONDS = max(0.01, min(float(os.getenv("SCRAPLING_QUEUE_WAIT_SECONDS", "0.25")), 2.0))
_domain_access: dict[str, float] = {}
_domain_lock = threading.Lock()
_concurrency = asyncio.Semaphore(MAX_ACTIVE_FETCHES)
_capacity = asyncio.Semaphore(MAX_PENDING_FETCHES)
_in_flight: dict[str, asyncio.Task] = {}
_in_flight_lock = asyncio.Lock()

HWK_HOSTS = {
    "www.handwerkskammer.de",
    "www.kammerfinder.de",
    "www.handwerker-radar.de",
    "www.handwerk-owl.de",
    "www.hwk-aachen.de",
    "www.hwk-aurich.de",
    "www.hwk-berlin.de",
    "www.hwk-bls.de",
    "www.hwk-bremen.de",
    "www.hwk-cottbus.de",
    "www.hwk-do.de",
    "www.hwk-duesseldorf.de",
    "www.hwk-erfurt.de",
    "www.hwk-freiburg.de",
    "www.hwk-gera.de",
    "www.hwk-heilbronn.de",
    "www.hwk-konstanz.de",
    "www.hwk-koeln.de",
    "www.hwk-leipzig.de",
    "www.hwk-luebeck.de",
    "www.hwk-magdeburg.de",
    "www.hwk-mannheim.de",
    "www.hwk-muenchen.de",
    "www.hwk-muenster.de",
    "www.hwk-oberfranken.de",
    "www.hwk-oldenburg.de",
    "www.hwk-omv.de",
    "www.hwk-osnabrueck.de",
    "www.hwk-pfalz.de",
    "www.hwk-potsdam.de",
    "www.hwk-reutlingen.de",
    "www.hwk-saarland.de",
    "www.hwk-schwerin.de",
    "www.hwk-suedthueringen.de",
    "www.hwk-schwaben.de",
    "www.hwk-swf.de",
    "www.hwk-trier.de",
    "www.hwk-ulm.de",
    "www.hwk-wiesbaden.de",
    "www.hwk.de",
    "www.hwkno.de",
    "hwk-dresden.odav.de",
    "hwk-rhein-main.odav.de",
}


class InputError(ValueError):
    pass


def _token() -> str:
    return os.getenv("SCRAPLING_IMPRESSUM_TOKEN", "").strip()


def _is_authorized(header: str | None) -> bool:
    configured = _token()
    if len(configured) < 32 or not header or not header.startswith("Bearer "):
        return False
    return hmac.compare_digest(header[7:], configured)


def validate_public_url(raw_url: str) -> str:
    value = raw_url.strip()
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise InputError("invalid_url")
    if parsed.username or parsed.password:
        raise InputError("credentials_not_allowed")
    try:
        addresses = socket.getaddrinfo(
            parsed.hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise InputError("dns_failed") from exc
    resolved = {item[4][0] for item in addresses}
    if not resolved or any(not ipaddress.ip_address(address).is_global for address in resolved):
        raise InputError("non_public_target")
    return value


def validate_hwk_url(raw_url: str) -> str:
    value = validate_public_url(raw_url)
    host = (urlparse(value).hostname or "").lower()
    if host not in HWK_HOSTS and not (host.endswith(".odav.de") and host.startswith("hwk-")):
        raise InputError("hwk_host_not_allowed")
    return value


def _response_body(page) -> str:
    body = page.body
    if isinstance(body, bytes):
        return body.decode(page.encoding or "utf-8", errors="replace")
    return str(body or "")


def _visible_text(page) -> str:
    values = page.xpath("//body//text()[normalize-space()]").getall()
    return "\n".join(str(value).strip() for value in values if str(value).strip())


def check_robots(url: str) -> dict[str, object]:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    try:
        response = Fetcher.get(
            robots_url,
            impersonate="chrome",
            stealthy_headers=False,
            headers={"User-Agent": USER_AGENT, "Accept": "text/plain,*/*;q=0.1"},
            timeout=10,
            retries=0,
            follow_redirects="safe",
            max_redirects=3,
        )
    except Exception:
        return {"url": robots_url, "status": None, "allowed": False, "reason": "robots_unavailable"}
    if response.status == 404:
        return {"url": robots_url, "status": 404, "allowed": True, "crawl_delay": None}
    if response.status != 200:
        return {"url": robots_url, "status": response.status, "allowed": False, "reason": "robots_unavailable"}
    parser = RobotFileParser()
    parser.set_url(robots_url)
    parser.parse(_response_body(response).splitlines())
    delay = parser.crawl_delay(USER_AGENT) or parser.crawl_delay("*")
    return {
        "url": robots_url,
        "status": 200,
        "allowed": parser.can_fetch(USER_AGENT, url),
        "crawl_delay": delay,
    }


def check_robots_urls(urls: list[str]) -> dict[str, dict[str, object]]:
    if not urls:
        return {}
    parsed_urls = [urlparse(url) for url in urls]
    origins = {(parsed.scheme, parsed.netloc) for parsed in parsed_urls}
    if len(origins) != 1:
        raise InputError("robots_origins_mismatch")
    scheme, netloc = next(iter(origins))
    robots_url = f"{scheme}://{netloc}/robots.txt"
    try:
        response = Fetcher.get(
            robots_url,
            impersonate="chrome",
            stealthy_headers=False,
            headers={"User-Agent": USER_AGENT, "Accept": "text/plain,*/*;q=0.1"},
            timeout=4,
            retries=0,
            follow_redirects="safe",
            max_redirects=3,
        )
    except Exception:
        return {
            url: {"url": robots_url, "status": None, "allowed": False, "reason": "robots_unavailable"}
            for url in urls
        }
    if response.status == 404:
        return {
            url: {"url": robots_url, "status": 404, "allowed": True, "crawl_delay": None}
            for url in urls
        }
    if response.status != 200:
        return {
            url: {"url": robots_url, "status": response.status, "allowed": False, "reason": "robots_unavailable"}
            for url in urls
        }
    parser = RobotFileParser()
    parser.set_url(robots_url)
    parser.parse(_response_body(response).splitlines())
    delay = parser.crawl_delay(USER_AGENT) or parser.crawl_delay("*")
    return {
        url: {
            "url": robots_url,
            "status": 200,
            "allowed": parser.can_fetch(USER_AGENT, url),
            "crawl_delay": delay,
        }
        for url in urls
    }


def throttle(url: str, robots: dict[str, object]) -> None:
    host = (urlparse(url).hostname or "").lower()
    delay = max(MIN_DOMAIN_DELAY_SECONDS, float(robots.get("crawl_delay") or 0))
    with _domain_lock:
        wait_for = max(0.0, _domain_access.get(host, 0.0) + delay - time.monotonic())
        if wait_for:
            time.sleep(min(wait_for, 10.0))
        _domain_access[host] = time.monotonic()


def install_public_network_guard(page) -> None:
    verdicts: dict[str, bool] = {}

    def route_handler(route) -> None:
        target = route.request.url
        parsed = urlparse(target)
        if parsed.scheme in {"data", "blob", "about"}:
            route.fallback()
            return
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            route.abort()
            return
        key = f"{parsed.scheme}://{parsed.netloc}"
        allowed = verdicts.get(key)
        if allowed is None:
            try:
                validate_public_url(key)
                allowed = True
            except InputError:
                allowed = False
            verdicts[key] = allowed
        if allowed:
            route.fallback()
        else:
            route.abort()

    page.route("**/*", route_handler)


def _fetch_static(url: str):
    return Fetcher.get(
        url,
        impersonate="chrome",
        stealthy_headers=False,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
        timeout=15,
        retries=1,
        follow_redirects="safe",
        max_redirects=5,
    )


def _fetch_preflight_landing(url: str):
    return Fetcher.get(
        url,
        impersonate="chrome",
        stealthy_headers=False,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
        timeout=4,
        retries=0,
        follow_redirects="safe",
        max_redirects=3,
    )


def _fetch_dynamic(url: str):
    return DynamicFetcher.fetch(
        url,
        headless=True,
        block_ads=True,
        network_idle=False,
        timeout=20_000,
        wait=750,
        retries=1,
        google_search=False,
        useragent=BROWSER_USER_AGENT,
        locale="de-DE",
        page_setup=install_public_network_guard,
    )


def _thin_page(page) -> bool:
    try:
        text = _visible_text(page)
    except Exception:
        text = ""
    return len(text) < 250 or not page.css("body").get()


def fetch_public_page(url: str, purpose: str = IMPRESSUM_PURPOSE) -> dict[str, object]:
    requested_url = validate_hwk_url(url) if purpose == HWK_PURPOSE else validate_public_url(url)
    robots = check_robots(requested_url)
    if robots.get("allowed") is not True:
        return {"ok": False, "status": "robots_disallowed", "robots": robots, "service_version": SERVICE_VERSION}
    throttle(requested_url, robots)
    try:
        page = _fetch_static(requested_url)
    except Exception:
        return {"ok": False, "status": "unavailable", "reason": "static_fetch_failed", "service_version": SERVICE_VERSION}
    status = int(page.status)
    if status == 429:
        return {"ok": False, "status": "rate_limited", "http_status": 429, "service_version": SERVICE_VERSION}
    if status in {401, 402} or status >= 500:
        return {"ok": False, "status": "unavailable", "reason": f"http_{status}", "http_status": status, "service_version": SERVICE_VERSION}
    mode = "static"
    if status == 403 or (status < 400 and _thin_page(page)):
        try:
            page = _fetch_dynamic(requested_url)
            mode = "dynamic"
            status = int(page.status)
        except Exception:
            return {"ok": False, "status": "unavailable", "reason": "dynamic_fetch_failed", "service_version": SERVICE_VERSION}
    if status == 429:
        return {"ok": False, "status": "rate_limited", "http_status": 429, "service_version": SERVICE_VERSION}
    if status >= 400:
        return {"ok": False, "status": "unavailable", "reason": f"http_{status}", "http_status": status, "service_version": SERVICE_VERSION}
    final_url = validate_public_url(str(page.url))
    html = str(page.html_content)
    text = _visible_text(page)
    if len(html) > MAX_HTML_CHARS or len(text) > MAX_TEXT_CHARS:
        return {"ok": False, "status": "unavailable", "reason": "response_too_large", "service_version": SERVICE_VERSION}
    return {
        "ok": True,
        "status": "fetched",
        "final_url": final_url,
        "http_status": status,
        "mode": mode,
        "html": html,
        "text": text,
        "robots": robots,
        "service_version": SERVICE_VERSION,
    }


def fetch_impressum(url: str) -> dict[str, object]:
    return fetch_public_page(url, IMPRESSUM_PURPOSE)


def fetch_hwk(url: str) -> dict[str, object]:
    return fetch_public_page(url, HWK_PURPOSE)


def preflight_insolvency_portal() -> dict[str, object]:
    """Check only the public landing page; never request or interpret the form route."""
    robots = check_robots_urls([INSOLVENCY_LANDING_URL])
    landing_robots = robots[INSOLVENCY_LANDING_URL]
    portal_reachable = False
    landing_http_status: int | None = None

    if landing_robots.get("allowed") is True:
        throttle(INSOLVENCY_LANDING_URL, landing_robots)
        try:
            page = _fetch_preflight_landing(INSOLVENCY_LANDING_URL)
            landing_http_status = int(page.status)
            final = urlparse(str(page.url))
            portal_reachable = (
                200 <= landing_http_status < 400
                and (final.hostname or "").lower() == "neu.insolvenzbekanntmachungen.de"
            )
        except Exception:
            portal_reachable = False

    common = {
        "portal_reachable": portal_reachable,
        "landing_http_status": landing_http_status,
        "transaction_ready": portal_reachable,
        "transaction_mode": "authorized_form_submission",
        "landing_url": INSOLVENCY_LANDING_URL,
        "search_url": INSOLVENCY_SEARCH_URL,
        "landing_robots": landing_robots,
        "search_robots": None,
        "search_robots_checked": False,
        "service_version": SERVICE_VERSION,
    }
    if landing_robots.get("allowed") is not True:
        return {"ok": False, "status": "unavailable", "reason": "landing_not_fetchable", **common}
    if not portal_reachable:
        return {"ok": False, "status": "unavailable", "reason": "landing_unavailable", **common}
    return {"ok": True, "status": "ready", "reason": "", **common}


async def _run_bounded_fetch(url: str, purpose: str) -> dict[str, object]:
    try:
        await asyncio.wait_for(_capacity.acquire(), timeout=QUEUE_WAIT_SECONDS)
    except TimeoutError:
        return {
            "ok": False,
            "status": "busy",
            "reason": "queue_full",
            "service_version": SERVICE_VERSION,
        }
    try:
        async with _concurrency:
            fetcher = fetch_hwk if purpose == HWK_PURPOSE else fetch_impressum
            return await run_in_threadpool(fetcher, url)
    finally:
        _capacity.release()


async def fetch_shared(url: str, purpose: str) -> dict[str, object]:
    key = f"{purpose}:{url}"
    async with _in_flight_lock:
        task = _in_flight.get(key)
        if task is None:
            task = asyncio.create_task(_run_bounded_fetch(url, purpose))
            _in_flight[key] = task
    try:
        return await asyncio.shield(task)
    finally:
        if task.done():
            async with _in_flight_lock:
                if _in_flight.get(key) is task:
                    _in_flight.pop(key, None)


async def _run_bounded_insolvency_preflight() -> dict[str, object]:
    try:
        await asyncio.wait_for(_capacity.acquire(), timeout=QUEUE_WAIT_SECONDS)
    except TimeoutError:
        return {
            "ok": False,
            "status": "unavailable",
            "reason": "queue_full",
            "service_version": SERVICE_VERSION,
        }
    try:
        async with _concurrency:
            return await run_in_threadpool(preflight_insolvency_portal)
    finally:
        _capacity.release()


async def insolvency_preflight_shared() -> dict[str, object]:
    key = INSOLVENCY_PREFLIGHT_PURPOSE
    async with _in_flight_lock:
        task = _in_flight.get(key)
        if task is None:
            task = asyncio.create_task(_run_bounded_insolvency_preflight())
            _in_flight[key] = task
    try:
        return await asyncio.shield(task)
    finally:
        if task.done():
            async with _in_flight_lock:
                if _in_flight.get(key) is task:
                    _in_flight.pop(key, None)


async def health(_: Request) -> JSONResponse:
    return JSONResponse({
        "ok": True,
        "service": SERVICE_VERSION,
        "max_active_fetches": MAX_ACTIVE_FETCHES,
        "max_pending_fetches": MAX_PENDING_FETCHES,
        "in_flight": len(_in_flight),
    })


async def api_fetch(request: Request) -> JSONResponse:
    if not _is_authorized(request.headers.get("authorization")):
        return JSONResponse({"ok": False, "status": "unauthorized"}, status_code=401)
    body = await request.body()
    if len(body) > MAX_REQUEST_BYTES:
        return JSONResponse({"ok": False, "status": "invalid_request", "reason": "request_too_large"}, status_code=413)
    try:
        payload = json.loads(body or b"{}")
        if not isinstance(payload, dict) or payload.get("purpose") != IMPRESSUM_PURPOSE:
            raise InputError("invalid_purpose")
        url = str(payload.get("url", ""))
        result = await fetch_shared(url, IMPRESSUM_PURPOSE)
        return JSONResponse(result, headers={"Cache-Control": "no-store"})
    except (InputError, json.JSONDecodeError) as exc:
        return JSONResponse({"ok": False, "status": "invalid_request", "reason": str(exc)}, status_code=400)
    except Exception:
        return JSONResponse({"ok": False, "status": "unavailable", "reason": "internal_error"}, status_code=503)


async def api_hwk_fetch(request: Request) -> JSONResponse:
    if not _is_authorized(request.headers.get("authorization")):
        return JSONResponse({"ok": False, "status": "unauthorized"}, status_code=401)
    body = await request.body()
    if len(body) > MAX_REQUEST_BYTES:
        return JSONResponse({"ok": False, "status": "invalid_request", "reason": "request_too_large"}, status_code=413)
    try:
        payload = json.loads(body or b"{}")
        if not isinstance(payload, dict) or payload.get("purpose") != HWK_PURPOSE:
            raise InputError("invalid_purpose")
        url = validate_hwk_url(str(payload.get("url", "")))
        result = await fetch_shared(url, HWK_PURPOSE)
        status_code = 503 if result.get("status") == "busy" else 200
        return JSONResponse(result, status_code=status_code, headers={"Cache-Control": "no-store"})
    except (InputError, json.JSONDecodeError) as exc:
        return JSONResponse({"ok": False, "status": "invalid_request", "reason": str(exc)}, status_code=400)
    except Exception:
        return JSONResponse({"ok": False, "status": "unavailable", "reason": "internal_error"}, status_code=503)


async def api_insolvency_preflight(request: Request) -> JSONResponse:
    if not _is_authorized(request.headers.get("authorization")):
        return JSONResponse({"ok": False, "status": "unauthorized"}, status_code=401)
    body = await request.body()
    if len(body) > MAX_REQUEST_BYTES:
        return JSONResponse({"ok": False, "status": "invalid_request", "reason": "request_too_large"}, status_code=413)
    try:
        payload = json.loads(body or b"{}")
        if (
            not isinstance(payload, dict)
            or payload.get("purpose") != INSOLVENCY_PREFLIGHT_PURPOSE
            or set(payload) != {"purpose"}
        ):
            raise InputError("invalid_purpose")
        result = await insolvency_preflight_shared()
        return JSONResponse(result, headers={"Cache-Control": "no-store"})
    except (InputError, json.JSONDecodeError) as exc:
        return JSONResponse({"ok": False, "status": "invalid_request", "reason": str(exc)}, status_code=400)
    except Exception:
        return JSONResponse({"ok": False, "status": "unavailable", "reason": "internal_error"}, status_code=503)


app = Starlette(
    debug=False,
    routes=[
        Route("/health", health, methods=["GET"]),
        Route("/v1/impressum/fetch", api_fetch, methods=["POST"]),
        Route("/v1/hwk/fetch", api_hwk_fetch, methods=["POST"]),
        Route("/v1/insolvency/preflight", api_insolvency_preflight, methods=["POST"]),
    ],
)


if __name__ == "__main__":
    import uvicorn

    # Cloud Run zahteva poslušanje na vseh vmesnikih in poda vrata prek PORT.
    # Lokalno lahko PORT še vedno prepišemo na 8766.
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
