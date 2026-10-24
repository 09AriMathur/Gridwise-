"""Property test: the forecast route never falls back to synthetic sample data.

Feature: grid-connection, Property 5: No synthetic fallback on failure
Validates: Requirements 4.6

For any upstream failure, the forecast route's response body contains none of
the data from ``backend/data/sample_forecast.json``. The route maps upstream
failures to HTTP 502/503 and must not read or serve the synthetic demo file as
a fallback reading.

Expressed as parametrized/table-driven pytest cases over the full family of
``requests`` failures rather than a property-based testing library, so no new
dependency is introduced. ``src.routes.fetch_forecast`` is patched to raise so
no live network call is made and a fake key is never required.

Run from the backend/ directory:  pytest tests/test_route_forecast_no_fallback.py
"""

import json
from pathlib import Path

import pytest
import requests
from fastapi.testclient import TestClient

from main import app
from src import routes

# Path to the synthetic demo data the route must never serve on failure.
SAMPLE_FORECAST_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "sample_forecast.json"
)


def _load_sample_forecast():
    with SAMPLE_FORECAST_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def _synthetic_markers(sample):
    """Distinctive strings from the sample file that must never appear on failure.

    Collects the note, zone, units, every datetime, and every carbon-intensity
    value (as text) so we can assert none of them leak into an error body.
    """
    markers = set()

    note = sample.get("_note")
    if note:
        markers.add(note)

    zone = sample.get("zone")
    if zone:
        markers.add(zone)

    units = sample.get("units")
    if units:
        markers.add(units)

    for entry in sample.get("forecast", []):
        dt = entry.get("datetime")
        if dt:
            markers.add(dt)
        intensity = entry.get("carbonIntensity")
        if intensity is not None:
            markers.add(str(intensity))

    return markers


# The full family of upstream failures the route maps to 502/503.
# ConnectionError/Timeout -> 503; HTTPError/other RequestException -> 502.
FAILURES = [
    ("connection_error", requests.ConnectionError("unreachable"), 503),
    ("timeout", requests.Timeout("timed out"), 503),
    ("http_error", requests.HTTPError("500 Server Error"), 502),
    ("request_exception", requests.RequestException("boom"), 502),
]


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.mark.parametrize(
    "label, exc, expected_status",
    FAILURES,
    ids=[case[0] for case in FAILURES],
)
@pytest.mark.parametrize("zone_param", [None, "US-NE-ISNE", "DE", "FR"])
def test_failure_body_has_no_synthetic_data(
    client, monkeypatch, label, exc, expected_status, zone_param
):
    """On any upstream failure, the response body contains none of the sample data."""
    sample = _load_sample_forecast()
    markers = _synthetic_markers(sample)

    def fake_fetch_forecast(*args, **kwargs):
        raise exc

    monkeypatch.setattr(routes, "fetch_forecast", fake_fetch_forecast)

    params = {} if zone_param is None else {"zone": zone_param}
    response = client.get("/api/forecast", params=params)

    # It is a mapped upstream failure, not a success.
    assert response.status_code == expected_status

    body_text = response.text

    # None of the synthetic markers (note, zone, units, datetimes, values) leak.
    for marker in markers:
        assert marker not in body_text, (
            f"synthetic marker {marker!r} leaked into the {label} error body"
        )

    # The parsed error body carries no forecast payload from the sample file.
    payload = response.json()
    assert "forecast" not in payload
    assert payload.get("zone") != sample.get("zone")
    # FastAPI's standard error shape: just a generic detail string.
    assert set(payload.keys()) <= {"detail"}


def test_sample_file_is_present_and_has_markers():
    """Guard: the sample file exists and yields markers, so the test has teeth."""
    sample = _load_sample_forecast()
    markers = _synthetic_markers(sample)
    # The note, zone, units, 24 datetimes and their values should all be present.
    assert sample.get("zone") == "US-NE-ISNE"
    assert len(sample.get("forecast", [])) == 24
    assert len(markers) > 0
