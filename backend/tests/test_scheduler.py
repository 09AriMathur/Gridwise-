"""Tests for the best-window logic.

Run from the backend/ directory:  pytest
"""

import json
from pathlib import Path

import pytest

from src.scheduler import best_window

SAMPLE = Path(__file__).resolve().parents[1] / "data" / "sample_forecast.json"


def hourly(*intensities):
    """Build a forecast starting at midnight from a list of intensities."""
    return [
        {"datetime": f"2026-10-24T{hour:02d}:00:00Z", "carbonIntensity": value}
        for hour, value in enumerate(intensities)
    ]


def test_picks_the_cleanest_window():
    forecast = [
        {"datetime": "2026-10-24T00:00:00Z", "carbonIntensity": 400},
        {"datetime": "2026-10-24T01:00:00Z", "carbonIntensity": 100},
        {"datetime": "2026-10-24T02:00:00Z", "carbonIntensity": 100},
        {"datetime": "2026-10-24T03:00:00Z", "carbonIntensity": 400},
    ]
    result = best_window(forecast, duration_hours=2)
    assert result["start"] == "2026-10-24T01:00:00Z"


def test_reports_the_end_and_average_intensity():
    result = best_window(hourly(400, 100, 200, 400), duration_hours=2)
    assert result["start"] == "2026-10-24T01:00:00Z"
    assert result["end"] == "2026-10-24T03:00:00Z"
    assert result["intensity"] == 150.0


def test_deadline_rules_out_a_later_cleaner_window():
    # The 100/100 pair at 02:00 is cleanest, but it finishes at 04:00.
    forecast = hourly(200, 200, 100, 100, 500)
    result = best_window(forecast, duration_hours=2, deadline="2026-10-24T02:00:00Z")
    assert result["start"] == "2026-10-24T00:00:00Z"


def test_window_ending_exactly_on_the_deadline_is_allowed():
    result = best_window(hourly(300, 100, 100), duration_hours=2,
                         deadline="2026-10-24T03:00:00Z")
    assert result["start"] == "2026-10-24T01:00:00Z"


def test_impossible_deadline_raises():
    with pytest.raises(ValueError, match="finishes by"):
        best_window(hourly(100, 100, 100), duration_hours=3,
                    deadline="2026-10-24T01:00:00Z")


def test_ties_go_to_the_earliest_window():
    result = best_window(hourly(100, 100, 400, 100, 100), duration_hours=2)
    assert result["start"] == "2026-10-24T00:00:00Z"


def test_sub_hour_task_rounds_up_to_the_cleanest_single_hour():
    result = best_window(hourly(400, 100, 300), duration_hours=0.5)
    assert result["start"] == "2026-10-24T01:00:00Z"
    assert result["end"] == "2026-10-24T02:00:00Z"
    assert result["intensity"] == 100.0


def test_fractional_duration_rounds_up_not_down():
    # 2.5 hours needs three forecast hours, so only one window fits in four.
    result = best_window(hourly(100, 500, 500, 500), duration_hours=2.5)
    assert result["start"] == "2026-10-24T00:00:00Z"
    assert result["end"] == "2026-10-24T03:00:00Z"


def test_task_longer_than_the_forecast_says_to_start_now():
    with pytest.raises(ValueError, match="start it now"):
        best_window(hourly(100, 200), duration_hours=5)


def test_task_exactly_as_long_as_the_forecast_is_allowed():
    result = best_window(hourly(100, 200), duration_hours=2)
    assert result["start"] == "2026-10-24T00:00:00Z"
    assert result["intensity"] == 150.0


def test_zero_duration_raises():
    with pytest.raises(ValueError, match="greater than 0"):
        best_window(hourly(100, 200), duration_hours=0)


def test_negative_duration_raises():
    with pytest.raises(ValueError, match="greater than 0"):
        best_window(hourly(100, 200), duration_hours=-3)


def test_matches_the_sample_forecast():
    forecast = json.loads(SAMPLE.read_text())["forecast"]
    result = best_window(forecast, duration_hours=3)
    assert result["start"] == "2026-10-24T13:00:00Z"
    assert result["intensity"] == 258.0
