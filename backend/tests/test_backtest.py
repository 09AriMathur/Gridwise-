"""Tests for replaying history against the user's habit.

Run from the backend/ directory:  python -m pytest
"""

from datetime import datetime, timedelta, timezone

import pytest

from src.backtest import average_over, backtest, next_ready, occurrences, run_once


def hourly_from(start: datetime, *values):
    return [
        {"datetime": (start + timedelta(hours=i)).isoformat().replace("+00:00", "Z"), "carbonIntensity": v}
        for i, v in enumerate(values)
    ]


T0 = datetime(2026, 10, 23, 18, tzinfo=timezone.utc)


def test_cleaner_window_later_saves_carbon():
    points = hourly_from(T0, 400, 400, 300, 100, 100, 300, 300, 300, 300, 300, 300, 300)
    run = run_once(points, kwh=1.5, duration_hours=2, habit_start=T0, flex_hours=12)
    assert run["best_start"] == "2026-10-23T21:00:00Z"
    assert run["habit_avg"] == 400
    assert run["best_avg"] == 100
    assert run["co2_saved_g"] == pytest.approx(450.0)


def test_habit_already_cleanest_saves_nothing():
    points = hourly_from(T0, 100, 100, *[300] * 10)
    run = run_once(points, kwh=1.5, duration_hours=2, habit_start=T0, flex_hours=12)
    assert run["best_start"] == run["habit_start"]
    assert run["co2_saved_g"] == 0.0


def test_not_enough_history_is_skipped():
    points = hourly_from(T0, 400, 100, 100)  # only 3 of the 12 flexible hours
    assert run_once(points, kwh=1, duration_hours=1, habit_start=T0, flex_hours=12) is None


def test_average_over_partial_hours():
    points = hourly_from(T0, 100, 300)
    assert average_over(points, T0 + timedelta(minutes=30), T0 + timedelta(minutes=90)) == 200
    assert average_over(points, T0, T0 + timedelta(hours=3)) is None


def test_occurrences_use_local_time():
    # 6 PM in Boston (UTC-4, getTimezoneOffset = 240) is 22:00 UTC.
    now = datetime(2026, 10, 24, 23, tzinfo=timezone.utc)
    first, second = occurrences(18 * 60, 240, now, days=1)[:2]
    assert first == datetime(2026, 10, 24, 22, tzinfo=timezone.utc)
    assert second == first - timedelta(days=1)


def test_backtest_counts_only_covered_days_and_totals_per_task():
    # Two full days of history: dirty at 18:00, clean overnight.
    day = [400, 400, 300, 100, 100, 300, 300, 300, 300, 300, 300, 300] + [300] * 12
    points = hourly_from(T0 - timedelta(days=1), *day, *day)
    now = T0 + timedelta(hours=23)
    tasks = [{"id": "dish", "kwh": 1.5, "duration_hours": 2}, {"id": "ev", "kwh": 10, "duration_hours": 3}]
    result = backtest(points, tasks, habit_minutes=18 * 60, tz_offset_min=0, flex_hours=12, days=7, now=now)
    assert result["days_covered"] == 2
    totals = {t["id"]: t["co2_saved_g"] for t in result["per_task"]}
    assert totals["dish"] == pytest.approx(900.0)   # 450 g a day, two days
    assert result["total_co2_saved_g"] == pytest.approx(sum(totals.values()))


def test_backtest_with_no_history_is_empty():
    result = backtest([], [{"id": "dish", "kwh": 1.5, "duration_hours": 2}], 18 * 60, 0, 12, 1, T0)
    assert result["days_covered"] == 0
    assert result["total_co2_saved_g"] == 0


def test_says_when_a_habit_day_will_be_covered():
    # 24 h of history ending now (22:00); a 22:00 habit with 12 flexible hours
    # isn't covered yet: yesterday's started before the history, today's needs
    # until 10:00 tomorrow.
    now = datetime(2026, 10, 24, 22, tzinfo=timezone.utc)
    points = hourly_from(now - timedelta(hours=23), *[300] * 24)
    result = backtest(points, [{"id": "dish", "kwh": 1.5, "duration_hours": 2}], 22 * 60, 0, 12, 1, now)
    assert result["days_covered"] == 0
    assert result["next_ready"] == "2026-10-25T10:00:00Z"
    assert next_ready([], 22 * 60, 0, 12, now) is None
