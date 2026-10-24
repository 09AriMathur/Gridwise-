"""Client endpoint/zone targeting tests for the Electricity Maps grid client.

Feature: grid-connection, Property 1: Request targets the correct endpoint
for the given zone.

Validates: Requirements 1.1, 2.1

Run from the backend/ directory:  pytest tests/test_grid_api_targeting.py

These tests patch ``requests.get`` so no live network call is made and no
real API key is required. They assert that ``fetch_forecast(zone)`` targets
the forecast endpoint and ``fetch_current(zone)`` the latest endpoint, both
under ``BASE_URL``, with the given zone passed as the ``zone`` query param.
"""

from unittest.mock import MagicMock

import pytest

from src import grid_api

# Representative zone strings: default, other ISO zones, sub-zones, and an
# edge-case empty string. Property 1 should hold for any zone string.
REPRESENTATIVE_ZONES = [
    "US-NE-ISNE",
    "DE",
    "FR",
    "US-CAL-CISO",
    "GB",
    "AU-NSW",
    "JP-TK",
    "IN-WE",
    "",
]


@pytest.fixture
def captured_get(monkeypatch):
    """Patch ``requests.get`` in the grid_api module and capture the call.

    Returns the MagicMock so tests can inspect how it was invoked. The mock's
    return value is a fake response whose ``raise_for_status`` is a no-op and
    whose ``json`` returns an empty dict, so the client functions complete
    without a live call.
    """
    fake_resp = MagicMock()
    fake_resp.raise_for_status.return_value = None
    fake_resp.json.return_value = {}

    mock_get = MagicMock(return_value=fake_resp)
    # Patch the name as used inside grid_api (it does ``import requests``
    # then calls ``requests.get``), so patch the attribute on that module's
    # requests reference.
    monkeypatch.setattr(grid_api.requests, "get", mock_get)
    # Use a fake key so nothing real is ever required.
    monkeypatch.setattr(grid_api, "API_KEY", "fake-test-key")
    return mock_get


def _assert_targeted(mock_get, expected_path, expected_zone):
    """Assert the single captured GET hit {BASE_URL}/{path}?zone=zone."""
    mock_get.assert_called_once()
    args, kwargs = mock_get.call_args

    # URL is the first positional arg to requests.get.
    url = args[0] if args else kwargs.get("url")
    assert url == f"{grid_api.BASE_URL}/{expected_path}"
    # The zone is passed as the "zone" query param.
    assert kwargs["params"] == {"zone": expected_zone}


@pytest.mark.parametrize("zone", REPRESENTATIVE_ZONES)
def test_fetch_forecast_targets_forecast_endpoint(captured_get, zone):
    """fetch_forecast(zone) hits carbon-intensity/forecast with the zone.

    Feature: grid-connection, Property 1: Request targets the correct
    endpoint for the given zone.
    Validates: Requirements 1.1
    """
    grid_api.fetch_forecast(zone)
    _assert_targeted(captured_get, "carbon-intensity/forecast", zone)


@pytest.mark.parametrize("zone", REPRESENTATIVE_ZONES)
def test_fetch_current_targets_latest_endpoint(captured_get, zone):
    """fetch_current(zone) hits carbon-intensity/latest with the zone.

    Feature: grid-connection, Property 1: Request targets the correct
    endpoint for the given zone.
    Validates: Requirements 2.1
    """
    grid_api.fetch_current(zone)
    _assert_targeted(captured_get, "carbon-intensity/latest", zone)
