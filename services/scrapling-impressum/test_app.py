from __future__ import annotations

import asyncio
import json
import os
import sys
import threading
import time
import types
import unittest
from unittest.mock import patch

try:
    import scrapling.fetchers  # noqa: F401
except ModuleNotFoundError:
    scrapling_module = types.ModuleType("scrapling")
    fetchers_module = types.ModuleType("scrapling.fetchers")

    class MissingFetcher:
        @staticmethod
        def get(*_args, **_kwargs):
            raise RuntimeError("Scrapling fetcher must be mocked in unit tests")

        @staticmethod
        def fetch(*_args, **_kwargs):
            raise RuntimeError("Scrapling fetcher must be mocked in unit tests")

    fetchers_module.Fetcher = MissingFetcher
    fetchers_module.DynamicFetcher = MissingFetcher
    scrapling_module.fetchers = fetchers_module
    sys.modules["scrapling"] = scrapling_module
    sys.modules["scrapling.fetchers"] = fetchers_module

try:
    import starlette.applications  # noqa: F401
except ModuleNotFoundError:
    starlette_module = types.ModuleType("starlette")
    applications_module = types.ModuleType("starlette.applications")
    concurrency_module = types.ModuleType("starlette.concurrency")
    requests_module = types.ModuleType("starlette.requests")
    responses_module = types.ModuleType("starlette.responses")
    routing_module = types.ModuleType("starlette.routing")

    class DummyStarlette:
        def __init__(self, **kwargs):
            self.routes = kwargs.get("routes", [])

    class DummyRequest:
        pass

    class DummyJSONResponse(dict):
        def __init__(self, content, status_code=200, headers=None):
            super().__init__(content)
            self.status_code = status_code
            self.headers = headers or {}

    class DummyRoute:
        def __init__(self, path, endpoint, methods=None):
            self.path = path
            self.endpoint = endpoint
            self.methods = methods or []

    async def dummy_run_in_threadpool(function, *args):
        return await asyncio.to_thread(function, *args)

    applications_module.Starlette = DummyStarlette
    concurrency_module.run_in_threadpool = dummy_run_in_threadpool
    requests_module.Request = DummyRequest
    responses_module.JSONResponse = DummyJSONResponse
    routing_module.Route = DummyRoute
    starlette_module.applications = applications_module
    starlette_module.concurrency = concurrency_module
    starlette_module.requests = requests_module
    starlette_module.responses = responses_module
    starlette_module.routing = routing_module
    sys.modules["starlette"] = starlette_module
    sys.modules["starlette.applications"] = applications_module
    sys.modules["starlette.concurrency"] = concurrency_module
    sys.modules["starlette.requests"] = requests_module
    sys.modules["starlette.responses"] = responses_module
    sys.modules["starlette.routing"] = routing_module

import app


class FakeSelection:
    def __init__(self, value):
        self.value = value

    def getall(self):
        return self.value if isinstance(self.value, list) else []

    def get(self):
        return self.value if isinstance(self.value, str) else None


class FakePage:
    def __init__(self, status=200, text=None, url="https://example.com/impressum"):
        self.status = status
        self.url = url
        self.body = b"<html><body>Impressum</body></html>"
        self.encoding = "utf-8"
        self.html_content = self.body.decode()
        self._text = text or ["Impressum", "Max Muster", "Musterstrasse 1", "60311 Frankfurt"]

    def xpath(self, _selector):
        return FakeSelection(self._text)

    def css(self, selector):
        return FakeSelection("<body>Impressum</body>" if selector == "body" else None)


class FakeBrowserPage:
    def route(self, pattern, handler):
        self.pattern = pattern
        self.handler = handler


class FakeRoute:
    def __init__(self, url):
        self.request = type("Request", (), {"url": url})()
        self.action = None

    def fallback(self):
        self.action = "fallback"

    def abort(self):
        self.action = "abort"


class FakeRequest:
    def __init__(self, payload, authorization="Bearer " + "x" * 32):
        self._payload = payload
        self.headers = {"authorization": authorization}

    async def body(self):
        return self._payload


class ScraplingServiceTests(unittest.TestCase):
    def setUp(self):
        os.environ["SCRAPLING_IMPRESSUM_TOKEN"] = "x" * 32

    def test_authorization_uses_required_bearer_token(self):
        self.assertFalse(app._is_authorized(None))
        self.assertFalse(app._is_authorized("Bearer short"))
        self.assertTrue(app._is_authorized("Bearer " + "x" * 32))

    def test_browser_route_guard_aborts_non_public_subresources(self):
        page = FakeBrowserPage()
        app.install_public_network_guard(page)
        self.assertEqual(page.pattern, "**/*")
        public = FakeRoute("https://example.com/app.js")
        private = FakeRoute("http://127.0.0.1/secret")
        with patch("app.validate_public_url", side_effect=lambda value: value if "example.com" in value else (_ for _ in ()).throw(app.InputError("non_public_target"))):
            page.handler(public)
            page.handler(private)
        self.assertEqual(public.action, "fallback")
        self.assertEqual(private.action, "abort")

    @patch("app.socket.getaddrinfo", return_value=[(None, None, None, None, ("127.0.0.1", 443))])
    def test_private_target_is_rejected(self, _lookup):
        with self.assertRaisesRegex(app.InputError, "non_public_target"):
            app.validate_public_url("https://internal.example/impressum")

    @patch("app.validate_public_url", side_effect=lambda value: value)
    def test_hwk_target_must_use_an_allowlisted_official_host(self, _validate):
        self.assertEqual(
            app.validate_hwk_url("https://hwk-rhein-main.odav.de/betriebe/suche.html"),
            "https://hwk-rhein-main.odav.de/betriebe/suche.html",
        )
        with self.assertRaisesRegex(app.InputError, "hwk_host_not_allowed"):
            app.validate_hwk_url("https://example.com/fake-hwk")

    @patch("app.validate_public_url", side_effect=lambda value: value)
    @patch("app.throttle")
    @patch("app.check_robots", return_value={"allowed": True})
    @patch("app._fetch_dynamic")
    @patch("app._fetch_static", return_value=FakePage(status=429))
    def test_429_never_falls_through_to_dynamic(self, _static, dynamic, _robots, _throttle, _validate):
        result = app.fetch_impressum("https://example.com/impressum")
        self.assertEqual(result["status"], "rate_limited")
        dynamic.assert_not_called()

    @patch("app.validate_public_url", side_effect=lambda value: value)
    @patch("app.throttle")
    @patch("app.check_robots", return_value={"allowed": False})
    @patch("app._fetch_static")
    def test_robots_denial_stops_before_fetch(self, static, _robots, _throttle, _validate):
        result = app.fetch_impressum("https://example.com/impressum")
        self.assertEqual(result["status"], "robots_disallowed")
        static.assert_not_called()

    @patch("app.validate_public_url", side_effect=lambda value: value)
    @patch("app.throttle")
    @patch("app.check_robots", return_value={"allowed": True})
    @patch("app._fetch_static", return_value=FakePage())
    def test_static_public_page_returns_bounded_contract(self, _static, _robots, _throttle, _validate):
        _static.return_value._text.append("Rechtliche Anbieterangaben " * 20)
        result = app.fetch_impressum("https://example.com/impressum")
        self.assertTrue(result["ok"])
        self.assertEqual(result["status"], "fetched")
        self.assertEqual(result["mode"], "static")
        self.assertIn("Impressum", result["text"])

    @patch("app.validate_hwk_url", side_effect=lambda value: value)
    @patch("app.throttle")
    @patch("app.check_robots", return_value={"allowed": True})
    def test_twenty_unique_hwk_searches_are_accepted_with_bounded_active_fetches(self, _robots, _throttle, _validate):
        state = {"active": 0, "max_active": 0, "calls": 0}
        lock = threading.Lock()

        def fake_static(url):
            with lock:
                state["active"] += 1
                state["calls"] += 1
                state["max_active"] = max(state["max_active"], state["active"])
            time.sleep(0.02)
            with lock:
                state["active"] -= 1
            return FakePage(url=url, text=["Handwerkersuche", "Ergebnisse 1 - 1 von 1", "Öffentlicher Handwerksbetrieb " * 20])

        async def run_twenty():
            urls = [f"https://hwk-rhein-main.odav.de/search?name=person-{index}" for index in range(20)]
            return await asyncio.gather(*(app.fetch_shared(url, app.HWK_PURPOSE) for url in urls))

        with patch("app._fetch_static", side_effect=fake_static):
            results = asyncio.run(run_twenty())

        self.assertEqual(len(results), 20)
        self.assertTrue(all(result["status"] == "fetched" for result in results))
        self.assertEqual(state["calls"], 20)
        self.assertGreaterEqual(state["max_active"], 2)
        self.assertLessEqual(state["max_active"], app.MAX_ACTIVE_FETCHES)

    @patch("app.validate_hwk_url", side_effect=lambda value: value)
    @patch("app.throttle")
    @patch("app.check_robots", return_value={"allowed": True})
    def test_duplicate_concurrent_hwk_searches_share_one_fetch(self, _robots, _throttle, _validate):
        calls = 0
        lock = threading.Lock()

        def fake_static(url):
            nonlocal calls
            with lock:
                calls += 1
            time.sleep(0.02)
            return FakePage(url=url, text=["Handwerkersuche", "Ergebnisse 1 - 1 von 1", "Öffentlicher Handwerksbetrieb " * 20])

        async def run_duplicates():
            url = "https://hwk-rhein-main.odav.de/search?name=same-person"
            return await asyncio.gather(*(app.fetch_shared(url, app.HWK_PURPOSE) for _ in range(20)))

        with patch("app._fetch_static", side_effect=fake_static):
            results = asyncio.run(run_duplicates())

        self.assertEqual(len(results), 20)
        self.assertEqual(calls, 1)

    @patch("app.throttle")
    @patch("app._fetch_preflight_landing")
    @patch("app.check_robots_urls")
    def test_insolvency_landing_robots_denial_stops_scrapling_fetch(self, robots, static, _throttle):
        robots.return_value = {
            app.INSOLVENCY_LANDING_URL: {
                "url": "https://neu.insolvenzbekanntmachungen.de/robots.txt", "status": 200, "allowed": False,
            },
        }
        result = app.preflight_insolvency_portal()
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["reason"], "landing_not_fetchable")
        robots.assert_called_once_with([app.INSOLVENCY_LANDING_URL])
        static.assert_not_called()

    @patch("app.throttle")
    @patch("app._fetch_preflight_landing", return_value=FakePage(
        url="https://neu.insolvenzbekanntmachungen.de/ap/index.jsf",
        text=["Insolvenzbekanntmachungen", "Startseite", "Bekanntmachungen suchen"],
    ))
    @patch("app.check_robots_urls")
    def test_insolvency_preflight_checks_only_landing_and_reports_transaction_ready(self, _robots, static, _throttle):
        _robots.return_value = {
            app.INSOLVENCY_LANDING_URL: {"status": 200, "allowed": True},
        }
        result = app.preflight_insolvency_portal()
        self.assertTrue(result["ok"])
        self.assertEqual(result["status"], "ready")
        self.assertTrue(result["transaction_ready"])
        self.assertEqual(result["transaction_mode"], "authorized_form_submission")
        self.assertFalse(result["search_robots_checked"])
        self.assertIsNone(result["search_robots"])
        _robots.assert_called_once_with([app.INSOLVENCY_LANDING_URL])
        static.assert_called_once_with(app.INSOLVENCY_LANDING_URL)

    def test_insolvency_endpoint_rejects_arbitrary_url_fields(self):
        request = FakeRequest(json.dumps({
            "purpose": app.INSOLVENCY_PREFLIGHT_PURPOSE,
            "url": "https://example.com/should-not-be-accepted",
        }).encode())
        response = asyncio.run(app.api_insolvency_preflight(request))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response["status"], "invalid_request")


if __name__ == "__main__":
    unittest.main()
