"""Only file that calls Electricity Maps.

Everything else in the backend goes through these functions, so if the API
changes shape, this is the one file that has to change.
"""

import os

import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("ELECTRICITY_MAPS_BASE_URL", "https://api.electricitymap.org/v3")
API_KEY = os.getenv("ELECTRICITY_MAPS_API_KEY")
DEFAULT_ZONE = os.getenv("DEFAULT_ZONE", "US-NE-ISNE")


def _get(path: str, zone: str) -> dict:
    """Issue a GET against Electricity Maps and return the raw JSON dict.

    Builds the URL from BASE_URL and `path`, sends the API key in the
    Electricity Maps ``auth-token`` header, and scopes the request to `zone`.
    Raises on non-2xx responses and lets transport errors propagate.

    The request headers (and therefore the API key) are never logged.

    Raises:
        requests.Timeout: the request exceeded the timeout.
        requests.ConnectionError: Electricity Maps was unreachable.
        requests.HTTPError: Electricity Maps returned a non-2xx status.
    """
    url = f"{BASE_URL}/{path}"
    headers = {"auth-token": API_KEY}
    resp = requests.get(url, headers=headers, params={"zone": zone}, timeout=10)
    resp.raise_for_status()
    return resp.json()


def fetch_forecast(zone: str = DEFAULT_ZONE) -> dict:
    """Hourly carbon intensity forecast for a zone.

    Returns the raw Electricity Maps v3 response as a dict, untouched (no
    reshaping, filtering, or renaming of keys). Every datetime value in the
    response is UTC, ISO-8601 formatted with a trailing 'Z' (the UTC
    contract); values are returned exactly as received.
    """
    return _get("carbon-intensity/forecast", zone)


def fetch_current(zone: str = DEFAULT_ZONE) -> dict:
    """Carbon intensity right now, for a zone.

    Returns the raw Electricity Maps v3 response as a dict, untouched.
    Every datetime in the response is UTC, ISO-8601 with a trailing 'Z'
    (the UTC contract); values are returned exactly as received.
    """
    return _get("carbon-intensity/latest", zone)
