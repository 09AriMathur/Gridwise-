"""Maps URLs to functions."""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src import grid_api
from src.carbon import savings_vs_now
from src.devices import DEVICES, get_device
from src.scheduler import best_window

router = APIRouter(prefix="/api")

SAMPLE = Path(__file__).resolve().parents[1] / "data" / "sample_forecast.json"


class ScheduleRequest(BaseModel):
    """Either name a device, or give duration_hours and kwh directly."""

    device_id: str | None = None
    duration_hours: float | None = None
    kwh: float | None = None
    deadline: str | None = None
    zone: str | None = None


def _forecast(zone: str | None) -> tuple[list[dict], bool]:
    """Live forecast if we can get one, the sample file if we can't.

    Returns the hours and whether they are synthetic, so the caller can say so
    in the response.
    """
    try:
        return grid_api.fetch_forecast(zone) if zone else grid_api.fetch_forecast(), False
    except Exception:
        # Covers the unimplemented stub as well as a real outage.
        return json.loads(SAMPLE.read_text())["forecast"], True


@router.get("/forecast")
def get_forecast(zone: str | None = None):
    """Carbon intensity forecast for a grid zone."""
    raise NotImplementedError


@router.post("/schedule")
def post_schedule(request: ScheduleRequest):
    """Given a task's duration and deadline, return the best window to run it."""
    if request.device_id is not None:
        device = get_device(request.device_id)
        if device is None:
            raise HTTPException(status_code=404, detail=f"unknown device: {request.device_id}")
        duration_hours, kwh, name = device.duration_hours, device.kwh, device.name
    elif request.duration_hours is not None and request.kwh is not None:
        duration_hours, kwh, name = request.duration_hours, request.kwh, "Custom task"
    else:
        raise HTTPException(
            status_code=422,
            detail="give a device_id, or both duration_hours and kwh",
        )

    forecast, synthetic = _forecast(request.zone)

    try:
        window = best_window(forecast, duration_hours, request.deadline)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    savings = savings_vs_now(
        best_intensity=window["intensity"],
        now_intensity=forecast[0]["carbonIntensity"],
        energy_kwh=kwh,
    )

    return {
        "task": name,
        **window,
        **savings,
        "synthetic": synthetic,
    }


@router.get("/devices")
def list_devices():
    """The simulated devices the UI can schedule."""
    return DEVICES
