"""Route property test for upstream-failure -> HTTP 502/503 mapping.

Feature: grid-connection, Property 4: Any upstream failure maps to HTTP 502
or 503.

Run from the backend/ directory:  pytest tests/test_route_forecast_failure.py

The route (src.routes.get_forecast) is a thin pass-through that translates
every upstream failure from the Electricity Maps client into an HTTP 502 or
503 response. These tests patch `src.routes.fetch_forecast` to raise -- across
the full family of `requests` transport exceptions and `requests.HTTPError`
for a range of non-2xx statuses -- so no live network call is made, then
assert the route's status code.

Status policy (from design.md):
  - requests.ConnectionError / requests.Timeout -> 503
  - requests.HTTPError                          -> 502
  - any other requests.RequestException         -> 502
"""

from unittest.mock import patch

import pytest
import requests
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# Representative zone query values. The failure mapping must hold regardless of
# whether a zone is forwarded, so the absent-zone case is covered too (None).
ZONES = [None, "US-NE-ISNE", "DE", "FR", "US-CAL-CISO", "GB"]


def _http_error(status_code):
    """Build a requests.HTTPError carrying a response with the given status,
    as `raise_for_status()` would produce for a non-2xx upstream reply."""
    response = requests.Response()
    response.status_code = status_code
    return requests.HTTPError(f"{status_code} error", response=response)


# Transport exceptions -> expected to map to HTTP 503. ConnectionError and
# Timeout are the "unreachable / timed out" family (Requirement 4.4).
TRANSPORT_503_CASES = [
    requests.ConnectionError("connection refused"),
    requests.ConnectionError("name resolution failed"),
    requests.Timeout("request timed out"),
    requests.ConnectTimeout("connect timed out"),  # subclass of ConnectionError + Timeout
    requests.ReadTimeout("read timed out"),         # subclass of Timeout
]

# A range of non-2xx upstream statuses surfaced as HTTPError, plus a generic
# transport failure -> expected to map to HTTP 502 (Requirement 4.5 and the
# "any other RequestException" branch).
HTTP_ERROR_502_CASES = [
    _http_error(400),
    _http_error(401),
    _http_error(403),
    _http_error(404),
    _http_error(429),
    _http_error(500),
    _http_error(502),
    _http_error(503),
    requests.RequestException("some other transport failure"),
    requests.TooManyRedirects("too many redirects"),  # subclass of RequestException
]


@pytest.mark.parametrize("exc", TRANSPORT_503_CASES, ids=lambda e: type(e).__name__)
@pytest.mark.parametrize("zone", ZONES, ids=lambda z: str(z))
def test_transport_failure_maps_to_503(zone, exc):
    """A transport failure (connection error / timeout) from the client maps
    the route response to HTTP 503 -- always within the 502/503 contract.

    Validates: Requirements 4.4
    """
    with patch("src.routes.fetch_forecast", side_effect=exc):
        if zone is None:
            response = client.get("/api/forecast")
        else:
            response = client.get("/api/forecast", params={"zone": zone})

    assert response.status_code == 503
    assert response.status_code in (502, 503)


@pytest.mark.parametrize("exc", HTTP_ERROR_502_CASES, ids=lambda e: type(e).__name__)
@pytest.mark.parametrize("zone", ZONES, ids=lambda z: str(z))
def test_http_error_and_other_failures_map_to_502(zone, exc):
    """A non-2xx upstream status (HTTPError) or any other transport failure
    maps the route response to HTTP 502 -- always within the 502/503 contract.

    Validates: Requirements 4.5
    """
    with patch("src.routes.fetch_forecast", side_effect=exc):
        if zone is None:
            response = client.get("/api/forecast")
        else:
            response = client.get("/api/forecast", params={"zone": zone})

    assert response.status_code == 502
    assert response.status_code in (502, 503)


@pytest.mark.parametrize(
    "exc",
    TRANSPORT_503_CASES + HTTP_ERROR_502_CASES,
    ids=lambda e: type(e).__name__,
)
def test_any_upstream_failure_stays_within_502_503(exc):
    """The core property: for any upstream failure the route responds with a
    status in {502, 503} and never leaks a 500 or a success status.

    Validates: Requirements 4.4, 4.5
    """
    with patch("src.routes.fetch_forecast", side_effect=exc):
        response = client.get("/api/forecast", params={"zone": "US-NE-ISNE"})

    assert response.status_code in (502, 503)
