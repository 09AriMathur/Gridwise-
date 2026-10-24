"""Route property test for the /api/forecast pass-through.

Feature: grid-connection, Property 3: The forecast route forwards the zone
and returns the client body unchanged.

Run from the backend/ directory:  pytest tests/test_route_forecast_passthrough.py

The route (src.routes.get_forecast) is a thin pass-through: it forwards the
`zone` query value to the Electricity Maps client and returns the client's
raw dict as the response body. These tests patch `src.routes.fetch_forecast`
so no live network call is made, then assert both the call arguments and the
returned body.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# Representative client bodies: empty, simple, nested, and a v3-shaped forecast
# carrying UTC `...Z` datetime strings that must survive the round trip.
BODIES = [
    {},
    {"zone": "US-NE-ISNE", "carbonIntensity": 123},
    {
        "zone": "DE",
        "forecast": [
            {"datetime": "2026-10-24T00:00:00Z", "carbonIntensity": 400},
            {"datetime": "2026-10-24T01:00:00Z", "carbonIntensity": 100},
        ],
        "updatedAt": "2026-10-23T23:00:00Z",
    },
    {"nested": {"a": [1, 2, {"b": "2026-01-01T00:00:00Z"}]}, "flag": True, "n": None},
]

# Representative zone query values the route should forward verbatim.
ZONES = ["US-NE-ISNE", "DE", "FR", "US-CAL-CISO", "GB"]


@pytest.mark.parametrize("body", BODIES)
@pytest.mark.parametrize("zone", ZONES)
def test_forwards_zone_and_returns_body_unchanged(zone, body):
    """With a `zone` query param, the route forwards that exact value to
    `fetch_forecast` and returns the client dict unchanged.

    Validates: Requirements 4.1, 4.2
    """
    with patch("src.routes.fetch_forecast", return_value=body) as mock_fetch:
        response = client.get("/api/forecast", params={"zone": zone})

    assert response.status_code == 200
    # Forwarded the zone value positionally (route calls fetch_forecast(zone)).
    mock_fetch.assert_called_once_with(zone)
    # Returned the client body unchanged.
    assert response.json() == body


@pytest.mark.parametrize("body", BODIES)
def test_absent_zone_calls_fetch_without_argument(body):
    """With no `zone` query param, the route calls `fetch_forecast` with no
    argument (so DEFAULT_ZONE applies) and returns the client dict unchanged.

    Validates: Requirements 4.1, 4.2
    """
    with patch("src.routes.fetch_forecast", return_value=body) as mock_fetch:
        response = client.get("/api/forecast")

    assert response.status_code == 200
    # No zone argument forwarded when the query param is absent.
    mock_fetch.assert_called_once_with()
    assert response.json() == body
