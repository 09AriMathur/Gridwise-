"""Maps URLs to functions."""

from fastapi import APIRouter

router = APIRouter(prefix="/api")


@router.get("/forecast")
def get_forecast(zone: str | None = None):
    """Carbon intensity forecast for a grid zone."""
    raise NotImplementedError


@router.post("/schedule")
def post_schedule():
    """Given a task's duration and deadline, return the best window to run it."""
    raise NotImplementedError


@router.get("/devices")
def list_devices():
    """The simulated devices the UI can schedule."""
    raise NotImplementedError
