"""Would following GridWise have saved anything? Replays real history.

For each day, a task runs at the user's usual ("habit") time, or GridWise
moves it to the cleanest window within the next `flex_hours`. The best
window is found by scheduler.best_window, the same code that plans live
tasks, so the two can't disagree. Pure functions: no network, no I/O.
"""

from datetime import datetime, timedelta, timezone

from src.carbon import emissions_grams
from src.scheduler import best_window

HOUR = timedelta(hours=1)


def _parse(timestamp: str) -> datetime:
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))


def _format(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def average_over(points: list[dict], start: datetime, end: datetime) -> float | None:
    """Time-weighted average intensity over [start, end) from hourly points; None if not fully covered."""
    total = covered = 0.0
    for point in points:
        point_start = _parse(point["datetime"])
        overlap = (min(end, point_start + HOUR) - max(start, point_start)).total_seconds()
        if overlap > 0:
            total += point["carbonIntensity"] * overlap
            covered += overlap
    if covered < (end - start).total_seconds() - 1:
        return None
    return total / covered


def occurrences(habit_minutes: int, tz_offset_min: int, now: datetime, days: int) -> list[datetime]:
    """The last `days + 2` times the habit clock time came round, newest first, in UTC.

    `tz_offset_min` is the browser's Date.getTimezoneOffset(): UTC minus local.
    """
    offset = timedelta(minutes=tz_offset_min)
    local_now = now - offset
    local_midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    habits = [local_midnight - timedelta(days=d) + timedelta(minutes=habit_minutes) + offset for d in range(days + 2)]
    return [moment for moment in habits if moment <= now]


def run_once(points: list[dict], kwh: float, duration_hours: float, habit_start: datetime, flex_hours: float) -> dict | None:
    """One task on one day: habit window vs. GridWise's pick. None if history doesn't cover it."""
    habit_end = habit_start + timedelta(hours=duration_hours)
    flex_end = habit_start + timedelta(hours=flex_hours)
    habit_avg = average_over(points, habit_start, habit_end)
    if habit_avg is None or average_over(points, habit_start, flex_end) is None:
        return None

    # Candidate starts: hours from the habit time onward that finish inside the flexible span.
    candidates = [p for p in points if habit_start <= _parse(p["datetime"]) < flex_end]
    try:
        window = best_window(candidates, duration_hours, flex_end)
    except ValueError:
        return None
    best_start = _parse(window["start"])
    best_avg = average_over(points, best_start, best_start + timedelta(hours=duration_hours))
    if best_avg is None or best_avg > habit_avg:
        # Nothing cleaner fits: GridWise would have said "run it at your usual time".
        best_start, best_avg = habit_start, habit_avg

    saved = round(emissions_grams(habit_avg, kwh) - emissions_grams(best_avg, kwh), 1)
    return {
        "habit_start": _format(habit_start),
        "habit_end": _format(habit_end),
        "habit_avg": round(habit_avg, 1),
        "best_start": _format(best_start),
        "best_end": _format(best_start + timedelta(hours=duration_hours)),
        "best_avg": round(best_avg, 1),
        "co2_saved_g": max(0.0, saved),
    }


def next_ready(points: list[dict], habit_minutes: int, tz_offset_min: int, flex_hours: float, now: datetime) -> str | None:
    """When the first habit day will be fully covered, if none is yet.

    The API only returns 24 h of history, so a habit time plus its flexible
    span may not fit inside it until later today or tomorrow.
    """
    if not points:
        return None
    earliest = min(_parse(p["datetime"]) for p in points)
    future = occurrences(habit_minutes, tz_offset_min, now + timedelta(days=2), days=4)
    covered_from = [moment for moment in sorted(future) if moment >= earliest]
    if not covered_from:
        return None
    return _format(max(now, covered_from[0] + timedelta(hours=flex_hours)))


def backtest(points: list[dict], tasks: list[dict], habit_minutes: int, tz_offset_min: int,
             flex_hours: float, days: int, now: datetime) -> dict:
    """Replay the most recent `days` habit occurrences that history fully covers.

    Each task is {"id", "kwh", "duration_hours"}. Returns one entry per day
    (newest first), per-task totals and an overall total.
    """
    points = sorted(points, key=lambda p: p["datetime"])
    results = []
    for habit_start in occurrences(habit_minutes, tz_offset_min, now, days):
        if len(results) == days:
            break
        runs = []
        for task in tasks:
            run = run_once(points, task["kwh"], task["duration_hours"], habit_start, flex_hours)
            if run is not None:
                runs.append({"id": task["id"], **run})
        if runs:
            results.append({"habit_start": _format(habit_start), "tasks": runs})

    per_task = {task["id"]: 0.0 for task in tasks}
    for day in results:
        for run in day["tasks"]:
            per_task[run["id"]] += run["co2_saved_g"]

    return {
        "days_requested": days,
        "days_covered": len(results),
        "flex_hours": flex_hours,
        "days": results,
        "per_task": [{"id": task_id, "co2_saved_g": round(total, 1)} for task_id, total in per_task.items()],
        "total_co2_saved_g": round(sum(per_task.values()), 1),
        "next_ready": None if results else next_ready(points, habit_minutes, tz_offset_min, flex_hours, now),
    }
