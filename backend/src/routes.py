"""Maps URLs to functions."""

import requests
from fastapi import APIRouter, HTTPException

from src.grid_api import fetch_forecast

router = APIRouter(prefix="/api")


@router.get("/forecast")
def get_forecast(zone: str | None = None):
    """Carbon intensity forecast for a grid zone.

    Thin pass-through: forwards the zone to the Electricity Maps client and
    returns the raw client dict unchanged. Upstream failures are mapped to
    HTTP 502/503 with fixed, generic detail messages that never include the
    upstream body, request headers, or the API key. There is no synthetic
    fallback to sample data.
    """
    try:
        if zone is None:
            return fetch_forecast()
        return fetch_forecast(zone)
    except (requests.Timeout, requests.ConnectionError):
        raise HTTPException(status_code=503, detail="Grid data source unavailable")
    except requests.HTTPError:
        raise HTTPException(status_code=502, detail="Grid data source returned an error")
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Grid data source request failed")


@router.post("/schedule")
def post_schedule():
    """Given a task's duration and deadline, return the best window to run it."""
    raise NotImplementedError


@router.get("/devices")
def list_devices():
    """The simulated devices the UI can schedule."""
    raise NotImplementedError
