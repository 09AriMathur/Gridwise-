"""Tests for the history store.

Run from the backend/ directory:  python -m pytest
"""

import pytest

from src import database


@pytest.fixture(autouse=True)
def temp_db(monkeypatch, tmp_path):
    monkeypatch.setattr(database, "DB_PATH", str(tmp_path / "test.db"))


ROWS = [
    {"datetime": "2026-10-23T23:00:00Z", "carbonIntensity": 300},
    {"datetime": "2026-10-24T00:00:00Z", "carbonIntensity": 250},
]


def test_saving_the_same_history_twice_keeps_one_copy():
    database.save_history("US-NE-ISNE", ROWS)
    database.save_history("US-NE-ISNE", ROWS)
    assert database.load_history("US-NE-ISNE", "2026-10-01T00:00:00Z") == ROWS


def test_a_newer_reading_replaces_the_old_one():
    database.save_history("US-NE-ISNE", ROWS)
    database.save_history("US-NE-ISNE", [{"datetime": "2026-10-24T00:00:00Z", "carbonIntensity": 240}])
    assert database.load_history("US-NE-ISNE", "2026-10-24T00:00:00Z") == [{"datetime": "2026-10-24T00:00:00Z", "carbonIntensity": 240}]


def test_zones_are_kept_apart_and_days_counted():
    database.save_history("US-NE-ISNE", ROWS)
    database.save_history("GB", ROWS[:1])
    assert database.days_covered("US-NE-ISNE") == 2
    assert database.days_covered("GB") == 1
    assert database.load_history("FR", "2026-01-01T00:00:00Z") == []
