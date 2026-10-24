"""Only file that calls Electricity Maps.

Everything else in the backend goes through these functions, so if the API
changes shape, this is the one file that has to change.
"""

import os
from datetime import datetime, timezone
from functools import lru_cache

import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("ELECTRICITY_MAPS_BASE_URL", "https://api.electricitymaps.com/v4")
API_KEY = os.getenv("ELECTRICITY_MAPS_API_KEY")
DEFAULT_ZONE = os.getenv("DEFAULT_ZONE", "US-NE-ISNE")
TIMEOUT_SECONDS = 10


def _get(path: str, zone: str | None) -> dict:
    """GET one Electricity Maps endpoint. Raises on a missing key or a bad status."""
    if not API_KEY:
        raise RuntimeError("ELECTRICITY_MAPS_API_KEY is not set")
    response = requests.get(
        f"{BASE_URL}/{path}",
        params={"zone": zone} if zone else None,
        headers={"auth-token": API_KEY},
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.json()


def _stamp(raw: str) -> str:
    """"2026-10-24T20:00:00.000Z" -> "2026-10-24T20:00:00Z", the shape the rest of the backend uses."""
    moment = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    return moment.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _entry(raw: dict) -> dict:
    """Normalize one reading to {"datetime": "...Z", "carbonIntensity": n}."""
    return {"datetime": _stamp(raw["datetime"]), "carbonIntensity": raw["carbonIntensity"]}


def _mw(value) -> float:
    """Missing sources come back as null; treat them as 0 MW."""
    return float(value) if isinstance(value, (int, float)) and value > 0 else 0.0


def _mix_row(raw: dict) -> dict:
    """Normalize one electricity-mix row.

    The API gives MW per source, with nulls, storage as {charge, discharge}
    and cross-border flows separately. Storage discharging counts as supply;
    charging is demand, so it's left out.
    """
    sources: dict[str, float] = {}
    storage = 0.0
    for name, value in raw.get("mix", {}).items():
        if name == "flows":
            continue
        if isinstance(value, dict):
            storage += _mw(value.get("discharge"))
        else:
            sources[name] = _mw(value)
    if storage:
        sources["storage"] = storage
    flows = raw.get("mix", {}).get("flows") or {}
    return {
        "datetime": _stamp(raw["datetime"]),
        "sources": sources,
        "imports": _mw(flows.get("imports")),
        "exports": _mw(flows.get("exports")),
    }


def fetch_forecast(zone: str = DEFAULT_ZONE) -> list[dict]:
    """Hourly carbon intensity forecast for a zone."""
    body = _get("carbon-intensity/forecast", zone)
    return [_entry(hour) for hour in body["forecast"] if hour.get("carbonIntensity") is not None]


def fetch_current(zone: str = DEFAULT_ZONE) -> dict:
    """Carbon intensity right now, for a zone."""
    return _entry(_get("carbon-intensity/latest", zone))


def fetch_history(zone: str = DEFAULT_ZONE) -> list[dict]:
    """Hourly carbon intensity for the last 24 hours."""
    body = _get("carbon-intensity/history", zone)
    return [_entry(hour) for hour in body["history"] if hour.get("carbonIntensity") is not None]


def fetch_mix(zone: str = DEFAULT_ZONE) -> dict:
    """What the grid is made of right now (MW per source)."""
    return _mix_row(_get("electricity-mix/latest", zone)["data"][0])


def fetch_mix_forecast(zone: str = DEFAULT_ZONE) -> list[dict]:
    """Hourly electricity-mix forecast, about 25 hours ahead."""
    return [_mix_row(row) for row in _get("electricity-mix/forecast", zone)["data"]]


@lru_cache(maxsize=1)
def _zones() -> dict:
    return _get("zones", None)


def zone_name(zone: str = DEFAULT_ZONE) -> str:
    """Readable zone name ("ISO New England"); the key itself if it can't be looked up."""
    try:
        return _zones().get(zone, {}).get("zoneName") or zone
    except Exception:
        return zone
