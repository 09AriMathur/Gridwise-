"""Tests for turning the grid's energy mix into shares.

Run from the backend/ directory:  python -m pytest
"""

from datetime import datetime, timezone

import pytest

from src.grid_api import _mix_row
from src.mix import shares, summary, window_mix


def test_api_row_is_normalized():
    raw = {
        "datetime": "2026-10-24T21:00:00.000Z",
        "mix": {
            "nuclear": 2110.0, "coal": None, "gas": 7153.0, "wind": 103.0,
            "hydro storage": {"charge": 0, "discharge": None},
            "battery storage": {"charge": None, "discharge": 2.5},
            "flows": {"exports": 184.7, "imports": 1515.0},
        },
    }
    row = _mix_row(raw)
    assert row["datetime"] == "2026-10-24T21:00:00Z"
    assert row["sources"] == {"nuclear": 2110.0, "coal": 0.0, "gas": 7153.0, "wind": 103.0, "storage": 2.5}
    assert row["imports"] == 1515.0
    assert row["exports"] == 184.7


def test_shares_are_sorted_add_to_100_and_include_imports():
    result = shares({"sources": {"gas": 50, "nuclear": 30, "coal": 0}, "imports": 20})
    assert [s["key"] for s in result["sources"]] == ["gas", "nuclear", "imports"]
    assert sum(s["percent"] for s in result["sources"]) == pytest.approx(100)
    assert result["fossil_pct"] == 50.0
    assert result["low_carbon_pct"] == 30.0
    assert result["imports_pct"] == 20.0
    assert result["sources"][0]["label"] == "Gas"


def test_storage_counts_as_low_carbon():
    assert shares({"sources": {"storage": 10, "gas": 10}})["low_carbon_pct"] == 50.0


def test_empty_mix_does_not_divide_by_zero():
    result = shares({"sources": {"gas": 0}, "imports": 0})
    assert result["sources"] == []
    assert result["low_carbon_pct"] == 0.0


def test_window_mix_weights_by_overlap():
    rows = [
        {"datetime": "2026-10-24T00:00:00Z", "sources": {"gas": 100, "wind": 0}, "imports": 0},
        {"datetime": "2026-10-24T01:00:00Z", "sources": {"gas": 0, "wind": 100}, "imports": 0},
    ]
    start = datetime(2026, 10, 24, 0, 30, tzinfo=timezone.utc)
    end = datetime(2026, 10, 24, 2, 0, tzinfo=timezone.utc)
    # 30 min of all-gas, 60 min of all-wind -> one third gas.
    result = window_mix(rows, start, end)
    assert result["fossil_pct"] == pytest.approx(33.3, abs=0.1)
    assert result["low_carbon_pct"] == pytest.approx(66.7, abs=0.1)


def test_window_outside_the_rows_is_none():
    rows = [{"datetime": "2026-10-24T00:00:00Z", "sources": {"gas": 1}, "imports": 0}]
    later = datetime(2026, 10, 25, tzinfo=timezone.utc)
    assert window_mix(rows, later, later.replace(hour=2)) is None


def test_summary_names_the_top_source():
    result = summary({"datetime": "2026-10-24T00:00:00Z", "sources": {"gas": 60, "hydro": 40}, "imports": 0})
    assert result["top"] == {"key": "gas", "label": "Gas", "percent": 60.0}
