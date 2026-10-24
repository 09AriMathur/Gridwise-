"""Maps URLs to functions."""

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src import database, grid_api, reminders, sms
from src.backtest import backtest
from src.carbon import savings_vs_now
from src.credits import GRAMS_PER_CREDIT, LEVELS, credits_for
from src.mix import shares, summary, window_mix
from src.devices import DEVICES, get_device
from src.scheduler import best_window

router = APIRouter(prefix="/api")

SAMPLE = Path(__file__).resolve().parents[1] / "data" / "sample_forecast.json"
HOUR = timedelta(hours=1)


class Availability(BaseModel):
    """A span of time the user can start the task in."""

    start: str
    end: str


class ScheduleRequest(BaseModel):
    """Name a catalog device, or give the duration and energy directly.

    The frontend sends duration_min and energy_kwh; duration_hours and kwh are
    the older names and still work.
    """

    device_id: str | int | None = None
    appliance: str | None = None
    duration_hours: float | None = None
    duration_min: float | None = None
    kwh: float | None = None
    energy_kwh: float | None = None
    deadline: str | None = None
    availability: list[Availability] | None = None
    phone: str | None = None
    zone: str | None = None


def _parse(timestamp: str) -> datetime:
    """Parse an ISO 8601 timestamp; a naive one is taken as UTC."""
    moment = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def _format(moment: datetime) -> str:
    stamp = moment.astimezone(timezone.utc).replace(microsecond=0).isoformat()
    return stamp.replace("+00:00", "Z")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sample_from_now() -> list[dict]:
    """The sample forecast, shifted so its first hour is the current hour.

    The file has fixed dates, so without this it goes stale after one day.
    """
    hours = json.loads(SAMPLE.read_text())["forecast"]
    start = _now().replace(minute=0, second=0, microsecond=0)
    return [
        {"datetime": _format(start + i * HOUR), "carbonIntensity": hour["carbonIntensity"]}
        for i, hour in enumerate(hours)
    ]


def _forecast(zone: str | None) -> tuple[list[dict], bool]:
    """Live forecast if we can get one, the sample file if we can't.

    Returns the hours and whether they are synthetic, so the caller can say so
    in the response.
    """
    try:
        return grid_api.fetch_forecast(zone) if zone else grid_api.fetch_forecast(), False
    except Exception:
        # Covers a missing key as well as a real outage.
        return _sample_from_now(), True


@router.get("/forecast")
def get_forecast(zone: str | None = None, hours: int = 48):
    """Carbon intensity forecast for a grid zone."""
    if hours < 1:
        raise HTTPException(status_code=422, detail="hours must be at least 1")
    forecast, synthetic = _forecast(zone)
    return {
        "zone": zone or grid_api.DEFAULT_ZONE,
        "source": "synthetic" if synthetic else "live",
        "forecast": forecast[:hours],
    }


def _task(request: ScheduleRequest) -> tuple[float, float, str]:
    """Work out duration (hours), energy (kWh) and a display name."""
    if isinstance(request.device_id, str) and (device := get_device(request.device_id)):
        return device.duration_hours, device.kwh, device.name

    duration = request.duration_min / 60 if request.duration_min is not None else request.duration_hours
    energy = request.energy_kwh if request.energy_kwh is not None else request.kwh
    if duration is None or energy is None:
        if isinstance(request.device_id, str):
            raise HTTPException(status_code=404, detail=f"unknown device: {request.device_id}")
        raise HTTPException(
            status_code=422,
            detail="give a device_id, or a duration (duration_min) and energy (energy_kwh)",
        )
    if duration <= 0:
        raise HTTPException(status_code=422, detail="duration must be greater than 0")
    if energy < 0:
        raise HTTPException(status_code=422, detail="energy cannot be negative")
    return duration, energy, request.appliance or "Custom task"


@router.post("/schedule")
def post_schedule(request: ScheduleRequest):
    """Given a task's duration and deadline, return the best window to run it."""
    duration_hours, kwh, name = _task(request)
    forecast, synthetic = _forecast(request.zone)
    now = _now()

    # Only hours that haven't finished yet can be scheduled.
    hours = [hour for hour in forecast if _parse(hour["datetime"]) + HOUR > now]

    deadline = _parse(request.deadline) if request.deadline else None
    if request.availability:
        earliest = min(_parse(span.start) for span in request.availability)
        latest = max(_parse(span.end) for span in request.availability)
        deadline = min(deadline, latest) if deadline else latest
        hours = [hour for hour in hours if _parse(hour["datetime"]) + HOUR > earliest]
    else:
        earliest = now

    if not hours:
        raise HTTPException(status_code=400, detail="the forecast has no hours left to schedule in")

    try:
        window = best_window(hours, duration_hours, deadline)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    # The scheduler works in whole hours from the top of the hour. Start no
    # earlier than now and the availability start, and run for the real duration.
    start = max(_parse(window["start"]), now, earliest)
    end = start + timedelta(hours=duration_hours)
    if deadline and end > deadline:
        raise HTTPException(
            status_code=400,
            detail=f"not enough time to finish a {duration_hours:g}-hour task by {_format(deadline)}",
        )

    # Compare like with like: the same number of hours, starting now.
    if_now = hours[: math.ceil(duration_hours)]
    now_intensity = round(sum(hour["carbonIntensity"] for hour in if_now) / len(if_now), 1)
    savings = savings_vs_now(
        best_intensity=window["intensity"],
        now_intensity=now_intensity,
        energy_kwh=kwh,
    )

    # Why this window is cleaner: the grid's mix then vs now. Best effort, so a
    # mix outage never breaks planning.
    mix = {}
    try:
        mix_rows = grid_api.fetch_mix_forecast(request.zone) if request.zone else grid_api.fetch_mix_forecast()
        mix = {
            "window_mix": window_mix(mix_rows, start, end),
            "now_mix": window_mix(mix_rows, now, now + timedelta(hours=duration_hours)),
        }
    except Exception:
        pass

    return {
        "task": name,
        **window,
        **savings,
        **mix,
        "synthetic": synthetic,
        "planned_start": _format(start),
        "planned_end": _format(end),
        "avg_intensity_best": window["intensity"],
        "avg_intensity_now": now_intensity,
        "co2_avoided_g": max(0.0, savings["grams_saved"]),
        "credits": credits_for(savings["grams_saved"]),
        "forecast_source": "synthetic" if synthetic else "live",
    }


@router.get("/levels")
def get_levels():
    """The badge ladder, so the browser scores its own total against one source."""
    return {
        "grams_per_credit": GRAMS_PER_CREDIT,
        "levels": [{"name": level.name, "min_credits": level.min_credits} for level in LEVELS],
    }


@router.get("/mix")
def get_mix(zone: str | None = None):
    """What the grid is made of now, plus an hourly summary of the mix forecast."""
    zone = zone or grid_api.DEFAULT_ZONE
    try:
        now_row = grid_api.fetch_mix(zone)
    except Exception:
        raise HTTPException(status_code=503, detail="the grid's energy mix isn't available right now")
    try:
        forecast = [summary(row) for row in grid_api.fetch_mix_forecast(zone)]
    except Exception:
        forecast = []
    return {"zone": zone, "zone_name": grid_api.zone_name(zone), "now": shares(now_row), "forecast": forecast}


def _history(zone: str, days: int) -> tuple[list[dict], bool]:
    """Fetch the last 24 h, store it, and return the stored range. Second value: whether the fetch worked."""
    live = True
    try:
        database.save_history(zone, grid_api.fetch_history(zone))
    except Exception:
        live = False  # serve whatever is already stored
    since = _format(_now() - timedelta(days=days, hours=12))
    return database.load_history(zone, since), live


@router.get("/history")
def get_history(zone: str | None = None, days: int = 1):
    """Stored carbon-intensity history (the API only gives 24 h; the backend keeps the rest)."""
    if days not in (1, 7):
        raise HTTPException(status_code=422, detail="days must be 1 or 7")
    zone = zone or grid_api.DEFAULT_ZONE
    points, live = _history(zone, days)
    return {"zone": zone, "points": points, "fresh": live, "dates_stored": database.days_covered(zone)}


class BacktestTask(BaseModel):
    id: str
    kwh: float
    duration_min: float


class BacktestRequest(BaseModel):
    """Replay history: each task at the habit time vs. GridWise's pick within `flex_hours`."""

    tasks: list[BacktestTask]
    habit_minutes: int = 18 * 60   # minutes after local midnight; 6:00 PM
    tz_offset_min: int = 0         # the browser's Date.getTimezoneOffset()
    flex_hours: float = 12
    days: int = 1
    zone: str | None = None


@router.post("/backtest")
def post_backtest(request: BacktestRequest):
    """How much following GridWise would have saved over the last day or week of real data."""
    if request.days not in (1, 7):
        raise HTTPException(status_code=422, detail="days must be 1 or 7")
    if not 0 <= request.habit_minutes < 24 * 60:
        raise HTTPException(status_code=422, detail="habit_minutes must be between 0 and 1439")
    if not 1 <= request.flex_hours <= 23:
        raise HTTPException(status_code=422, detail="flex_hours must be between 1 and 23")
    tasks = [
        {"id": t.id, "kwh": t.kwh, "duration_hours": t.duration_min / 60}
        for t in request.tasks
        if t.kwh > 0 and 0 < t.duration_min <= request.flex_hours * 60
    ]
    zone = request.zone or grid_api.DEFAULT_ZONE
    points, live = _history(zone, request.days)
    result = backtest(points, tasks, request.habit_minutes, request.tz_offset_min, request.flex_hours, request.days, _now())
    return {"zone": zone, "fresh": live, **result}


@router.get("/sms/status")
def get_sms_status():
    """Whether the server can send texts, and if not, what's missing."""
    return sms.status()


class SmsTest(BaseModel):
    phone: str


@router.post("/sms/test")
def post_sms_test(request: SmsTest):
    """Send one test text, so a user can check their number works."""
    try:
        sms.send(request.phone, "GridWise: Text reminders are on. We'll tell you when to turn devices on and off.")
    except sms.SmsError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return {"sent": True}


class ReminderRequest(BaseModel):
    """Text the user at the start and end of a manual device's clean window."""

    task_id: str
    phone: str
    device_name: str
    start: str
    end: str
    tz_offset_min: int = 0   # the browser's Date.getTimezoneOffset(), for local times in the text


@router.post("/reminders")
def post_reminders(request: ReminderRequest):
    status = sms.status()
    if not status["ready"]:
        raise HTTPException(status_code=503, detail=f"Texts aren't set up on the server yet. {status['reason']}")
    try:
        stored = reminders.schedule(request.task_id, request.phone, request.device_name,
                                    request.start, request.end, request.tz_offset_min)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    return {"task_id": request.task_id, "reminders": stored, "trial": status["trial"]}


class CancelRequest(BaseModel):
    kinds: list[str] = ["on", "off"]


@router.post("/reminders/{task_id}/cancel")
def cancel_reminders(task_id: str, request: CancelRequest):
    """Stop pending texts: all of them when a task is cancelled, just "off" once it's switched off."""
    kinds = tuple(kind for kind in request.kinds if kind in ("on", "off"))
    if not kinds:
        raise HTTPException(status_code=422, detail='kinds must include "on" and/or "off"')
    return {"cancelled": database.cancel_reminders(task_id, kinds)}


@router.get("/reminders/{task_id}")
def get_reminders(task_id: str):
    return {"task_id": task_id, "reminders": database.reminders_for(task_id)}


@router.get("/devices")
def list_devices():
    """The simulated devices the UI can schedule."""
    return DEVICES
