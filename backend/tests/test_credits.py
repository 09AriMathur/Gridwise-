"""Tests for the credit and level maths.

Run from the backend/ directory:  pytest
"""

import pytest

from src.credits import credits_for, level_for


def test_laundry_saving_earns_credits():
    # 3 kWh of laundry moved to the cleanest window avoids 156g in the sample data.
    assert credits_for(156) == 15


def test_ev_charge_earns_proportionally_more():
    assert credits_for(2080) == 208


def test_an_exact_multiple_has_no_remainder():
    assert credits_for(20) == 2


def test_partial_credits_round_down():
    assert credits_for(19) == 1


def test_a_saving_too_small_to_count_earns_nothing():
    assert credits_for(9) == 0


def test_saving_nothing_earns_nothing():
    assert credits_for(0) == 0


def test_a_negative_saving_earns_nothing_rather_than_a_penalty():
    assert credits_for(-50) == 0


def test_a_new_account_starts_at_the_bottom_rung():
    assert level_for(0)["name"] == "Seedling"


def test_each_threshold_promotes_on_the_exact_number():
    assert level_for(100)["name"] == "Sprout"
    assert level_for(500)["name"] == "Sapling"
    assert level_for(2_000)["name"] == "Oak"
    assert level_for(10_000)["name"] == "Old Growth"


def test_one_credit_short_of_a_threshold_stays_on_the_lower_rung():
    assert level_for(99)["name"] == "Seedling"
    assert level_for(499)["name"] == "Sprout"
    assert level_for(1_999)["name"] == "Sapling"
    assert level_for(9_999)["name"] == "Oak"


def test_reports_how_far_the_next_rung_is():
    result = level_for(600)
    assert result["name"] == "Sapling"
    assert result["next_name"] == "Oak"
    assert result["credits_to_next"] == 1_400


def test_the_top_rung_has_nothing_above_it():
    result = level_for(12_000)
    assert result["name"] == "Old Growth"
    assert result["next_name"] is None
    assert result["credits_to_next"] is None


def test_a_negative_total_raises():
    with pytest.raises(ValueError, match="cannot be negative"):
        level_for(-1)
