"""Best window logic.

Core idea: slide a window of `duration_hours` across the forecast and keep the
one with the lowest average carbon intensity that still finishes by the
deadline.
"""


def best_window(forecast: list[dict], duration_hours: int, deadline=None) -> dict:
    """Return the lowest-carbon window of the requested length."""
    raise NotImplementedError
