"""Credits earned for running a task in a clean window.

Arithmetic only: no network, no file I/O, no database, so this can be tested
with plain numbers the way scheduler.py and carbon.py are.
"""

import math
from dataclasses import dataclass

# One credit per 10g of CO2 avoided, so the score tracks real impact.
GRAMS_PER_CREDIT = 10


@dataclass(frozen=True)
class Level:
    """One rung of the badge ladder."""

    name: str
    min_credits: int


LEVELS = [
    Level(name="Seedling", min_credits=0),
    Level(name="Sprout", min_credits=100),
    Level(name="Sapling", min_credits=500),
    Level(name="Oak", min_credits=2_000),
    Level(name="Old Growth", min_credits=10_000),
]


def credits_for(grams_saved: float) -> int:
    """Credits earned by avoiding `grams_saved` of CO2.

    Rounds down, so a partial credit is never paid out. Saving nothing - or
    somehow less than nothing - earns zero rather than a negative score.
    """
    if grams_saved <= 0:
        return 0
    return math.floor(grams_saved / GRAMS_PER_CREDIT)


def level_for(total_credits: int) -> dict:
    """The level a lifetime credit total has reached, and the next one up.

    At the top of the ladder there is nothing left to earn, so `next_name` and
    `credits_to_next` are None rather than an invented further level.
    """
    if total_credits < 0:
        raise ValueError("total_credits cannot be negative")

    earned = LEVELS[0]
    for level in LEVELS:
        if total_credits < level.min_credits:
            break
        earned = level

    following = next((l for l in LEVELS if l.min_credits > total_credits), None)

    return {
        "name": earned.name,
        "min_credits": earned.min_credits,
        "next_name": following.name if following else None,
        "credits_to_next": following.min_credits - total_credits if following else None,
    }
