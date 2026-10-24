"""Tests for the best-window logic.

Run from the backend/ directory:  pytest
"""

import pytest

from src.scheduler import best_window


@pytest.mark.skip(reason="best_window is not implemented yet")
def test_picks_the_cleanest_window():
    forecast = [
        {"datetime": "2026-10-24T00:00:00Z", "carbonIntensity": 400},
        {"datetime": "2026-10-24T01:00:00Z", "carbonIntensity": 100},
        {"datetime": "2026-10-24T02:00:00Z", "carbonIntensity": 100},
        {"datetime": "2026-10-24T03:00:00Z", "carbonIntensity": 400},
    ]
    result = best_window(forecast, duration_hours=2)
    assert result["start"] == "2026-10-24T01:00:00Z"
