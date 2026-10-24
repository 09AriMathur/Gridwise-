"""Best window logic.

Core idea: slide a window of `duration_hours` across the forecast and keep the
one with the lowest average carbon intensity that still finishes by the
deadline.
"""

import math
from datetime import datetime, timedelta, timezone


def _parse(timestamp: str) -> datetime:
    """Parse an ISO 8601 timestamp, accepting the trailing Z the API returns."""
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))


def _format(moment: datetime) -> str:
    """Render a datetime back in the Z-suffixed shape the forecast uses."""
    return moment.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def best_window(forecast: list[dict], duration_hours: float, deadline=None) -> dict:
    """Return the lowest-carbon window of the requested length.

    The forecast is hourly, so a task shorter than an hour is rounded up to
    one: a 40-minute cycle is scheduled into the single cleanest hour.
    """
    if duration_hours <= 0:
        raise ValueError("duration_hours must be greater than 0")

    # An hour is the smallest slice the forecast can resolve.
    hours = math.ceil(duration_hours)

    if len(forecast) < hours:
        raise ValueError(
            f"the forecast only covers {len(forecast)} hours, so a "
            f"{duration_hours:g}-hour task cannot be scheduled - start it now"
        )

    # A window starting at index i covers hours i .. i + hours - 1, so the last
    # legal start leaves exactly `hours` entries behind it.
    starts = list(range(len(forecast) - hours + 1))

    def ends_at(start: int) -> datetime:
        return _parse(forecast[start]["datetime"]) + timedelta(hours=hours)

    if deadline is not None:
        if isinstance(deadline, str):
            deadline = _parse(deadline)
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)

        starts = [start for start in starts if ends_at(start) <= deadline]
        if not starts:
            raise ValueError(
                f"no {hours}-hour window finishes by {_format(deadline)}"
            )

    def average_intensity(start: int) -> float:
        window = forecast[start : start + hours]
        return sum(hour["carbonIntensity"] for hour in window) / hours

    # Ties go to the earliest window, since min keeps the first minimum it sees.
    best = min(starts, key=average_intensity)

    return {
        "start": forecast[best]["datetime"],
        "end": _format(ends_at(best)),
        "intensity": round(average_intensity(best), 1),
    }
