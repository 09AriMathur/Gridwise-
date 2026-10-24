"""Property test: the grid client returns the raw Electricity Maps response untouched.

Feature: grid-connection, Property 2: Raw response is returned untouched
Validates: Requirements 1.3, 2.3, 3.2

For any JSON-serializable dict returned by a successful Electricity Maps
response, ``fetch_forecast`` and ``fetch_current`` return a dict equal to it,
with no keys reshaped, filtered, or renamed and all datetime strings (the UTC
``...Z`` values) preserved exactly.

Expressed as parametrized/table-driven pytest cases over representative input
bodies rather than a property-based testing library, so no new dependency is
introduced. ``requests.get`` is patched so no live network call is made; a fake
API key is used.

Run from the backend/ directory:  pytest tests/test_grid_api_passthrough.py
"""

import copy

import pytest

from src import grid_api
from src.grid_api import fetch_current, fetch_forecast


class _FakeResponse:
    """Stand-in for requests.Response that returns a fixed JSON body."""

    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        # Successful response: nothing to raise.
        return None

    def json(self):
        return self._payload


# Representative Electricity Maps v3 bodies. Each exercises something the client
# must preserve: UTC "...Z" datetime strings, nested structures, zone/key names,
# numeric and null values, and an empty body.
REPRESENTATIVE_BODIES = [
    # Forecast-shaped body: a list of hourly entries with UTC datetimes.
    {
        "zone": "US-NE-ISNE",
        "forecast": [
            {"datetime": "2026-10-24T00:00:00Z", "carbonIntensity": 400},
            {"datetime": "2026-10-24T01:00:00Z", "carbonIntensity": 100},
            {"datetime": "2026-10-24T02:00:00Z", "carbonIntensity": 250},
        ],
        "updatedAt": "2026-10-23T23:15:00Z",
        "emissionFactorType": "lifecycle",
        "isEstimated": True,
    },
    # Latest/current-shaped body: a single reading.
    {
        "zone": "DE",
        "carbonIntensity": 312,
        "datetime": "2026-10-24T12:00:00Z",
        "updatedAt": "2026-10-24T12:05:00Z",
        "createdAt": "2026-10-20T09:00:00Z",
        "emissionFactorType": "lifecycle",
        "isEstimated": False,
    },
    # Keys that could tempt a reshaper: snake_case, camelCase, odd casing.
    {
        "zone": "FR",
        "carbon_intensity": 45,
        "carbonIntensity": 45,
        "DateTime": "2026-01-01T00:00:00Z",
        "datetime": "2026-01-01T00:00:00Z",
        "nested": {"inner": {"datetime": "2026-01-01T00:00:00Z", "value": None}},
    },
    # Null values and empty collections must survive untouched.
    {
        "zone": "US-CAL-CISO",
        "carbonIntensity": None,
        "datetime": "2026-07-04T18:30:45Z",
        "history": [],
        "meta": {},
    },
    # Empty body.
    {},
    # Fractional-second and offset-less UTC datetimes.
    {
        "zone": "GB",
        "forecast": [
            {"datetime": "2026-12-31T23:59:59Z", "carbonIntensity": 1},
            {"datetime": "2026-12-31T23:59:59.500Z", "carbonIntensity": 2},
        ],
    },
]


@pytest.fixture(autouse=True)
def _fake_api_key(monkeypatch):
    """Use a fake API key so no real credential is required."""
    monkeypatch.setattr(grid_api, "API_KEY", "fake-test-key")


@pytest.mark.parametrize("fetch", [fetch_forecast, fetch_current])
@pytest.mark.parametrize("body", REPRESENTATIVE_BODIES)
def test_returns_raw_response_untouched(fetch, body, monkeypatch):
    """The returned dict equals the response body exactly, with nothing reshaped."""
    # Deep-copy the expected value up front so the assertion can't be fooled by
    # in-place mutation, and so the fake response hands back an independent object.
    expected = copy.deepcopy(body)

    def fake_get(url, headers=None, params=None, timeout=None):
        return _FakeResponse(copy.deepcopy(body))

    monkeypatch.setattr(grid_api.requests, "get", fake_get)

    result = fetch(zone="US-NE-ISNE")

    # Equal to the input: no keys filtered, renamed, or added; values preserved.
    assert result == expected
    # Same set of top-level keys, in case equality ever ignored extras.
    assert set(result.keys()) == set(expected.keys())


@pytest.mark.parametrize("fetch", [fetch_forecast, fetch_current])
def test_datetime_strings_preserved_exactly(fetch, monkeypatch):
    """Every UTC "...Z" datetime string is returned byte-for-byte unchanged."""
    body = {
        "zone": "US-NE-ISNE",
        "forecast": [
            {"datetime": "2026-10-24T00:00:00Z", "carbonIntensity": 400},
            {"datetime": "2026-10-24T01:00:00.250Z", "carbonIntensity": 100},
        ],
        "updatedAt": "2026-10-23T23:15:00Z",
    }
    expected_datetimes = [
        "2026-10-24T00:00:00Z",
        "2026-10-24T01:00:00.250Z",
        "2026-10-23T23:15:00Z",
    ]

    def fake_get(url, headers=None, params=None, timeout=None):
        return _FakeResponse(copy.deepcopy(body))

    monkeypatch.setattr(grid_api.requests, "get", fake_get)

    result = fetch(zone="US-NE-ISNE")

    assert result["updatedAt"] == "2026-10-23T23:15:00Z"
    returned_datetimes = [entry["datetime"] for entry in result["forecast"]] + [
        result["updatedAt"]
    ]
    assert returned_datetimes == expected_datetimes
    # No trailing Z was stripped or rewritten to an offset.
    for value in returned_datetimes:
        assert value.endswith("Z")


def test_returned_object_is_whatever_json_returned(monkeypatch):
    """The client returns exactly the object resp.json() produced (identity)."""
    payload = {"zone": "US-NE-ISNE", "datetime": "2026-10-24T00:00:00Z"}

    def fake_get(url, headers=None, params=None, timeout=None):
        return _FakeResponse(payload)

    monkeypatch.setattr(grid_api.requests, "get", fake_get)

    assert fetch_forecast(zone="US-NE-ISNE") is payload
    assert fetch_current(zone="US-NE-ISNE") is payload
