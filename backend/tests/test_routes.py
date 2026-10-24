"""Tests for the /api routes, called as plain functions.

Run from the backend/ directory:  pytest
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from src import database, grid_api, routes
from src.routes import Availability, ScheduleRequest

NOW = datetime(2026, 10, 24, 20, 30, tzinfo=timezone.utc)


def stamp(moment: datetime) -> str:
    return moment.isoformat().replace("+00:00", "Z")


def hourly_from(start: datetime, *intensities):
    """A forecast with one entry per hour from `start`."""
    return [
        {"datetime": stamp(start + timedelta(hours=i)), "carbonIntensity": value}
        for i, value in enumerate(intensities)
    ]


@pytest.fixture(autouse=True)
def frozen_now(monkeypatch):
    monkeypatch.setattr(routes, "_now", lambda: NOW)


@pytest.fixture(autouse=True)
def no_network(monkeypatch, tmp_path):
    """No test talks to Electricity Maps; mix and history are opted into per test."""
    def offline(*_args, **_kwargs):
        raise RuntimeError("no network in tests")

    for name in ("fetch_mix", "fetch_mix_forecast", "fetch_history"):
        monkeypatch.setattr(grid_api, name, offline)
    monkeypatch.setattr(grid_api, "zone_name", lambda zone=None: "ISO New England")
    monkeypatch.setattr(database, "DB_PATH", str(tmp_path / "test.db"))


@pytest.fixture
def live(monkeypatch):
    """Serve a known forecast as if it came from Electricity Maps."""

    def use(forecast):
        monkeypatch.setattr(grid_api, "fetch_forecast", lambda zone=None: forecast)

    return use


@pytest.fixture
def offline(monkeypatch):
    def fail(zone=None):
        raise RuntimeError("no network")

    monkeypatch.setattr(grid_api, "fetch_forecast", fail)


def frontend_request(minutes, deadline, availability=None, kwh=1.5):
    """The body the Dashboard sends."""
    return ScheduleRequest(
        appliance="dishwasher",
        device_id=None,
        duration_min=minutes,
        energy_kwh=kwh,
        deadline=stamp(deadline),
        availability=availability,
        phone=None,
    )


def test_forecast_is_live_when_the_api_answers(live):
    live(hourly_from(datetime(2026, 10, 24, 20, tzinfo=timezone.utc), 300, 250, 200))
    body = routes.get_forecast(hours=2)
    assert body["source"] == "live"
    assert [hour["carbonIntensity"] for hour in body["forecast"]] == [300, 250]


def test_forecast_falls_back_to_sample_starting_this_hour(offline):
    body = routes.get_forecast()
    assert body["source"] == "synthetic"
    assert body["forecast"][0]["datetime"] == "2026-10-24T20:00:00Z"
    assert len(body["forecast"]) == 24


def test_forecast_rejects_zero_hours(live):
    with pytest.raises(HTTPException) as error:
        routes.get_forecast(hours=0)
    assert error.value.status_code == 422


def test_frontend_request_gets_exact_duration_starting_no_earlier_than_now(live):
    # 20:00 is the current hour, and the cleanest by far.
    live(hourly_from(datetime(2026, 10, 24, 20, tzinfo=timezone.utc), 100, 100, 400, 400))
    body = routes.post_schedule(frontend_request(90, NOW + timedelta(hours=3)))

    start = datetime.fromisoformat(body["planned_start"].replace("Z", "+00:00"))
    end = datetime.fromisoformat(body["planned_end"].replace("Z", "+00:00"))
    assert start == NOW
    assert end - start == timedelta(minutes=90)
    assert body["forecast_source"] == "live"
    assert body["avg_intensity_best"] == 100
    assert body["avg_intensity_now"] == 100


def test_plan_uses_a_later_cleaner_window(live):
    live(hourly_from(datetime(2026, 10, 24, 20, tzinfo=timezone.utc), 400, 400, 100, 100, 400))
    body = routes.post_schedule(frontend_request(120, NOW + timedelta(hours=5)))
    assert body["planned_start"] == "2026-10-24T22:00:00Z"
    assert body["planned_end"] == "2026-10-25T00:00:00Z"
    assert body["co2_avoided_g"] == pytest.approx(450.0)


def test_hours_that_already_ended_are_skipped(live):
    # 19:00 is in the past and very clean; it must not be picked.
    live(hourly_from(datetime(2026, 10, 24, 19, tzinfo=timezone.utc), 10, 300, 200, 400))
    body = routes.post_schedule(frontend_request(60, NOW + timedelta(hours=4)))
    assert body["planned_start"] == "2026-10-24T21:00:00Z"


def test_availability_end_tighter_than_deadline_wins(live):
    # The cleanest hour (23:00) is after the user's availability ends.
    live(hourly_from(datetime(2026, 10, 24, 20, tzinfo=timezone.utc), 300, 200, 300, 50, 300))
    spans = [Availability(start=stamp(NOW), end="2026-10-24T23:00:00Z")]
    body = routes.post_schedule(frontend_request(60, NOW + timedelta(hours=6), availability=spans))
    assert body["planned_start"] == "2026-10-24T21:00:00Z"


def test_availability_start_is_respected(live):
    live(hourly_from(datetime(2026, 10, 24, 20, tzinfo=timezone.utc), 50, 300, 200, 300))
    spans = [Availability(start="2026-10-24T22:00:00Z", end="2026-10-25T02:00:00Z")]
    body = routes.post_schedule(frontend_request(60, NOW + timedelta(hours=6), availability=spans))
    assert body["planned_start"] == "2026-10-24T22:00:00Z"


def test_missing_energy_is_a_422(live):
    live(hourly_from(datetime(2026, 10, 24, 20, tzinfo=timezone.utc), 300, 200))
    with pytest.raises(HTTPException) as error:
        routes.post_schedule(ScheduleRequest(duration_min=60))
    assert error.value.status_code == 422


def test_unknown_catalog_device_is_a_404(live):
    live(hourly_from(datetime(2026, 10, 24, 20, tzinfo=timezone.utc), 300, 200))
    with pytest.raises(HTTPException) as error:
        routes.post_schedule(ScheduleRequest(device_id="toaster"))
    assert error.value.status_code == 404


def test_catalog_device_still_works(live):
    live(hourly_from(datetime(2026, 10, 24, 20, tzinfo=timezone.utc), 300, 200, 100, 300))
    body = routes.post_schedule(ScheduleRequest(device_id="dishwasher"))
    assert body["task"] == "Dishwasher"
    assert body["planned_start"] == "2026-10-24T21:00:00Z"


def test_deadline_too_soon_is_a_400(live):
    live(hourly_from(datetime(2026, 10, 24, 20, tzinfo=timezone.utc), 300, 200, 100))
    with pytest.raises(HTTPException) as error:
        routes.post_schedule(frontend_request(120, NOW + timedelta(minutes=30)))
    assert error.value.status_code == 400


def test_entry_normalizes_api_timestamps():
    raw = {"datetime": "2026-10-24T20:00:00.000Z", "carbonIntensity": 289}
    assert grid_api._entry(raw) == {"datetime": "2026-10-24T20:00:00Z", "carbonIntensity": 289}


def mix_row(hour: datetime, gas: float, nuclear: float, imports: float = 0.0):
    return {"datetime": stamp(hour), "sources": {"gas": gas, "nuclear": nuclear}, "imports": imports, "exports": 0.0}


def test_schedule_explains_the_window_with_the_mix(live, monkeypatch):
    start = datetime(2026, 10, 24, 20, tzinfo=timezone.utc)
    live(hourly_from(start, 400, 400, 100, 100, 400))
    rows = [mix_row(start + timedelta(hours=i), gas, nuclear) for i, (gas, nuclear) in enumerate([(80, 20), (80, 20), (20, 80), (20, 80), (80, 20)])]
    monkeypatch.setattr(grid_api, "fetch_mix_forecast", lambda zone=None: rows)
    body = routes.post_schedule(frontend_request(120, NOW + timedelta(hours=5)))
    assert body["window_mix"]["low_carbon_pct"] == 80.0
    # Running now (20:30-22:30) spends 30 min in the clean 22:00 hour: (0.5*20 + 20 + 0.5*80) / 2.
    assert body["now_mix"]["low_carbon_pct"] == 35.0


def test_schedule_still_works_when_the_mix_is_down(live):
    live(hourly_from(datetime(2026, 10, 24, 20, tzinfo=timezone.utc), 300, 200, 100))
    body = routes.post_schedule(frontend_request(60, NOW + timedelta(hours=3)))
    assert "window_mix" not in body
    assert body["planned_start"] == "2026-10-24T22:00:00Z"


def test_mix_endpoint_returns_shares_and_zone_name(monkeypatch):
    monkeypatch.setattr(grid_api, "fetch_mix", lambda zone=None: mix_row(NOW, 60, 30, imports=10))
    body = routes.get_mix()
    assert body["zone_name"] == "ISO New England"
    assert [s["key"] for s in body["now"]["sources"]] == ["gas", "nuclear", "imports"]
    assert body["forecast"] == []


def test_mix_endpoint_is_a_503_when_unavailable():
    with pytest.raises(HTTPException) as error:
        routes.get_mix()
    assert error.value.status_code == 503


def test_history_is_stored_and_served_when_the_api_goes_down(monkeypatch):
    rows = hourly_from(NOW.replace(minute=0) - timedelta(hours=23), *range(300, 324))
    monkeypatch.setattr(grid_api, "fetch_history", lambda zone=None: rows)
    assert len(routes.get_history()["points"]) == 24
    monkeypatch.setattr(grid_api, "fetch_history", lambda zone=None: (_ for _ in ()).throw(RuntimeError("down")))
    body = routes.get_history()
    assert body["fresh"] is False
    assert len(body["points"]) == 24


def test_backtest_endpoint_finds_savings(monkeypatch):
    # Yesterday 18:00 UTC is dirty (400); the night after is clean (100).
    start = datetime(2026, 10, 23, 20, tzinfo=timezone.utc)
    values = [400] * 4 + [100] * 6 + [300] * 14
    monkeypatch.setattr(grid_api, "fetch_history", lambda zone=None: hourly_from(start, *values))
    body = routes.post_backtest(routes.BacktestRequest(
        tasks=[routes.BacktestTask(id="dishwasher", kwh=1.5, duration_min=120)],
        habit_minutes=20 * 60, tz_offset_min=0, flex_hours=12, days=1))
    assert body["days_covered"] == 1
    run = body["days"][0]["tasks"][0]
    assert run["habit_start"] == "2026-10-23T20:00:00Z"
    assert run["best_start"] == "2026-10-24T00:00:00Z"
    assert run["co2_saved_g"] == pytest.approx(450.0)


def test_backtest_rejects_bad_days():
    with pytest.raises(HTTPException) as error:
        routes.post_backtest(routes.BacktestRequest(tasks=[], days=3))
    assert error.value.status_code == 422
