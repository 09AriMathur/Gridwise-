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


def fetch_forecast(zone: str = DEFAULT_ZONE) -> dict:
    """Hourly carbon intensity forecast for a zone."""
    raise NotImplementedError


def fetch_current(zone: str = DEFAULT_ZONE) -> dict:
    """Carbon intensity right now, for a zone."""
    raise NotImplementedError
