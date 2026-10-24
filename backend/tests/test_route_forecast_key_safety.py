"""Route property test: the API key never leaks on failure.

Feature: grid-connection, Property 6: The API key never leaks on failure.

For any upstream failure, the configured API key value appears neither in the
forecast route's error response body nor in any log output produced while the
request is handled.

Run from the backend/ directory:  pytest tests/test_route_forecast_key_safety.py

Validates: Requirements 5.3, 5.4
"""

import logging

import pytest
import requests
from fastapi.testclient import TestClient

from main import app
from src import grid_api, routes

# A recognizable fake credential. If any part of the request-handling path
# echoes the configured key into an error body or a log record, this exact
# string would surface and the assertions below would catch it.
FAKE_API_KEY = "fake-em-key-DO-NOT-LEAK-0123456789abcdef"

# The full family of upstream failures the route is expected to translate into
# a 502/503, mirroring the error-handling table in the design. Each should be
# handled without ever exposing the key.
UPSTREAM_FAILURES = [
    requests.ConnectionError("Electricity Maps unreachable"),
    requests.Timeout("request timed out"),
    requests.HTTPError("502 Bad Gateway"),
    requests.RequestException("some other transport failure"),
]


@pytest.fixture
def client():
    return TestClient(app)


@pytest.mark.parametrize("exc", UPSTREAM_FAILURES, ids=lambda e: type(e).__name__)
def test_api_key_never_leaks_on_failure(client, monkeypatch, caplog, exc):
    """The fake key must not appear in the error body or in any log output."""
    # Configure a fake key on the only module allowed to hold it. We assert the
    # key stays confined even though the request fails before it is ever used.
    monkeypatch.setattr(grid_api, "API_KEY", FAKE_API_KEY, raising=False)

    # Drive the route down its failure path without touching the network: the
    # client function the route calls raises the upstream failure directly.
    def boom(*args, **kwargs):
        raise exc

    monkeypatch.setattr(routes, "fetch_forecast", boom)

    # Capture everything logged anywhere during request handling.
    with caplog.at_level(logging.DEBUG, logger=""):
        response = client.get("/api/forecast")

    # The failure is surfaced as an upstream error, never a 2xx.
    assert response.status_code in (502, 503)

    # The key must not be anywhere in the response body (raw bytes and text).
    assert FAKE_API_KEY not in response.text
    assert FAKE_API_KEY.encode() not in response.content

    # The key must not appear in any log output produced while handling the
    # request: neither in formatted records nor in raw message/args.
    for record in caplog.records:
        assert FAKE_API_KEY not in record.getMessage()
        assert FAKE_API_KEY not in str(record.args)
    assert FAKE_API_KEY not in caplog.text


@pytest.mark.parametrize("exc", UPSTREAM_FAILURES, ids=lambda e: type(e).__name__)
def test_api_key_never_leaks_with_zone_query(client, monkeypatch, caplog, exc):
    """Same guarantee when an explicit zone query param is supplied."""
    monkeypatch.setattr(grid_api, "API_KEY", FAKE_API_KEY, raising=False)

    def boom(*args, **kwargs):
        raise exc

    monkeypatch.setattr(routes, "fetch_forecast", boom)

    with caplog.at_level(logging.DEBUG, logger=""):
        response = client.get("/api/forecast", params={"zone": "US-CAL-CISO"})

    assert response.status_code in (502, 503)
    assert FAKE_API_KEY not in response.text
    assert FAKE_API_KEY.encode() not in response.content

    for record in caplog.records:
        assert FAKE_API_KEY not in record.getMessage()
        assert FAKE_API_KEY not in str(record.args)
    assert FAKE_API_KEY not in caplog.text
