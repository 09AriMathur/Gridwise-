"""Unit tests for the grid client's defaults, auth header, and configuration.

Covers Requirements 1.2, 1.4, 2.2, 2.4, 5.4, 6.1, 6.2, 6.3, 6.4.

These tests patch ``requests.get`` so no live network call is made and no real
API key is required. A fake key is used throughout; assertions confirm it is
sent in the Electricity Maps ``auth-token`` header and never reaches log output.

Because ``BASE_URL``/``API_KEY``/``DEFAULT_ZONE`` are read once at import time,
tests that assert default-zone/auth behavior patch the module constants
directly, and tests that vary env configuration reload the module after setting
the relevant environment variables.

Run from the backend/ directory:  pytest tests/test_grid_api_config.py
"""

import importlib
import logging
from unittest.mock import patch

import pytest

from src import grid_api

FAKE_KEY = "fake-test-key-DO-NOT-LOG-1234567890"


def _make_response(payload=None):
    """A stand-in for the object returned by ``requests.get``."""

    class _Resp:
        def __init__(self, data):
            self._data = data

        def raise_for_status(self):
            return None

        def json(self):
            return self._data

    return _Resp({} if payload is None else payload)


# ---------------------------------------------------------------------------
# Auth header carries the key (Requirements 1.4, 2.4)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "fetch_name",
    ["fetch_forecast", "fetch_current"],
)
def test_auth_token_header_carries_the_api_key(fetch_name):
    with patch.object(grid_api, "API_KEY", FAKE_KEY), patch.object(
        grid_api, "requests"
    ) as mock_requests:
        mock_requests.get.return_value = _make_response({"ok": True})

        getattr(grid_api, fetch_name)("US-CAL-CISO")

        assert mock_requests.get.call_count == 1
        _, kwargs = mock_requests.get.call_args
        assert kwargs["headers"] == {"auth-token": FAKE_KEY}


# ---------------------------------------------------------------------------
# Default zone applies when called with no argument (Requirements 1.2, 2.2)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "fetch_name",
    ["fetch_forecast", "fetch_current"],
)
def test_default_zone_applies_when_called_without_argument(fetch_name):
    with patch.object(grid_api, "API_KEY", FAKE_KEY), patch.object(
        grid_api, "requests"
    ) as mock_requests:
        mock_requests.get.return_value = _make_response({"ok": True})

        getattr(grid_api, fetch_name)()

        _, kwargs = mock_requests.get.call_args
        assert kwargs["params"] == {"zone": grid_api.DEFAULT_ZONE}


@pytest.mark.parametrize(
    "fetch_name",
    ["fetch_forecast", "fetch_current"],
)
def test_explicit_zone_overrides_default(fetch_name):
    with patch.object(grid_api, "API_KEY", FAKE_KEY), patch.object(
        grid_api, "requests"
    ) as mock_requests:
        mock_requests.get.return_value = _make_response({"ok": True})

        getattr(grid_api, fetch_name)("DE")

        _, kwargs = mock_requests.get.call_args
        assert kwargs["params"] == {"zone": "DE"}


# ---------------------------------------------------------------------------
# Config resolves from env vars, including unset defaults (Requirements 6.1-6.4)
# ---------------------------------------------------------------------------


def _reload_with_env(monkeypatch, env):
    """Reload grid_api with the given env var overrides applied.

    ``env`` maps a var name to either a string value or ``None`` to delete it.
    """
    for name, value in env.items():
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)
    # Prevent python-dotenv from re-reading a local .env and overriding us.
    monkeypatch.setattr(grid_api, "load_dotenv", lambda *a, **k: False, raising=False)
    return importlib.reload(grid_api)


@pytest.fixture(autouse=True)
def _restore_grid_api_module():
    """Reload grid_api cleanly after any test that mutated its env/import state."""
    yield
    importlib.reload(grid_api)


def test_base_url_read_from_env(monkeypatch):
    # Requirement 6.1
    reloaded = _reload_with_env(
        monkeypatch,
        {
            "ELECTRICITY_MAPS_BASE_URL": "https://grid.example.test/v9",
            "DEFAULT_ZONE": "US-NE-ISNE",
        },
    )
    assert reloaded.BASE_URL == "https://grid.example.test/v9"


def test_base_url_defaults_when_unset(monkeypatch):
    # Requirement 6.2
    reloaded = _reload_with_env(
        monkeypatch,
        {"ELECTRICITY_MAPS_BASE_URL": None},
    )
    assert reloaded.BASE_URL == "https://api.electricitymap.org/v3"


def test_default_zone_read_from_env(monkeypatch):
    # Requirement 6.3
    reloaded = _reload_with_env(
        monkeypatch,
        {"DEFAULT_ZONE": "FR"},
    )
    assert reloaded.DEFAULT_ZONE == "FR"


def test_default_zone_defaults_when_unset(monkeypatch):
    # Requirement 6.4
    reloaded = _reload_with_env(
        monkeypatch,
        {"DEFAULT_ZONE": None},
    )
    assert reloaded.DEFAULT_ZONE == "US-NE-ISNE"


def test_request_uses_configured_base_url(monkeypatch):
    # Requirements 6.1 + 6.3 end to end: the configured BASE_URL and DEFAULT_ZONE
    # flow into the actual request URL and params.
    reloaded = _reload_with_env(
        monkeypatch,
        {
            "ELECTRICITY_MAPS_BASE_URL": "https://grid.example.test/v9",
            "DEFAULT_ZONE": "FR",
            "ELECTRICITY_MAPS_API_KEY": FAKE_KEY,
        },
    )
    with patch.object(reloaded, "requests") as mock_requests:
        mock_requests.get.return_value = _make_response({"ok": True})

        reloaded.fetch_forecast()

        args, kwargs = mock_requests.get.call_args
        assert args[0] == "https://grid.example.test/v9/carbon-intensity/forecast"
        assert kwargs["params"] == {"zone": "FR"}


# ---------------------------------------------------------------------------
# The API key never appears in logged output (Requirement 5.4)
# ---------------------------------------------------------------------------


def test_api_key_never_appears_in_log_output(caplog):
    with patch.object(grid_api, "API_KEY", FAKE_KEY), patch.object(
        grid_api, "requests"
    ) as mock_requests:
        mock_requests.get.return_value = _make_response({"ok": True})

        with caplog.at_level(logging.DEBUG):
            grid_api.fetch_forecast("US-CAL-CISO")
            grid_api.fetch_current("US-CAL-CISO")

        assert FAKE_KEY not in caplog.text
        for record in caplog.records:
            assert FAKE_KEY not in record.getMessage()
