"""Only file that calls Twilio.

Sends text-message reminders. Uses Twilio's REST API directly with
`requests` (already a dependency), so there's no SDK to install. Reads
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either TWILIO_FROM_NUMBER or
TWILIO_MESSAGING_SERVICE_SID from backend/.env. Never logs the token.
"""

import os
import re
import time

import requests
from dotenv import load_dotenv

load_dotenv()

ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
MESSAGING_SERVICE_SID = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "")
API = "https://api.twilio.com/2010-04-01"
TIMEOUT_SECONDS = 15

E164 = re.compile(r"^\+[1-9]\d{7,14}$")
_PLACEHOLDER = re.compile(r"^your_|^$")


class SmsError(Exception):
    """A text couldn't be sent; the message is safe to show the user."""


def _has(value: str) -> bool:
    return bool(value) and not _PLACEHOLDER.match(value)


def missing() -> list[str]:
    """Which settings are still needed, as env var names."""
    needed = []
    if not _has(ACCOUNT_SID):
        needed.append("TWILIO_ACCOUNT_SID")
    if not _has(AUTH_TOKEN):
        needed.append("TWILIO_AUTH_TOKEN")
    if not (_has(FROM_NUMBER) or _has(MESSAGING_SERVICE_SID)):
        needed.append("TWILIO_FROM_NUMBER")
    return needed


_account_cache: dict = {"at": 0.0, "type": None}


def _account_type() -> str | None:
    """"Trial" or "Full", cached for 10 minutes; None if it can't be checked."""
    if time.time() - _account_cache["at"] < 600:
        return _account_cache["type"]
    kind = None
    try:
        response = requests.get(f"{API}/Accounts/{ACCOUNT_SID}.json", auth=(ACCOUNT_SID, AUTH_TOKEN), timeout=TIMEOUT_SECONDS)
        if response.ok:
            kind = response.json().get("type")
    except requests.RequestException:
        pass
    _account_cache.update(at=time.time(), type=kind)
    return kind


def status() -> dict:
    """Whether texts can be sent, and if not, why (for the UI)."""
    needed = missing()
    if needed:
        return {"ready": False, "missing": needed, "trial": None,
                "reason": f"Add {', '.join(needed)} to backend/.env."}
    trial = _account_type() == "Trial"
    return {"ready": True, "missing": [], "trial": trial,
            "reason": "Trial account: Twilio only delivers to numbers verified in its console." if trial else ""}


def send(to: str, body: str) -> str:
    """Send one text; returns Twilio's message SID. Raises SmsError with a readable reason."""
    if not E164.match(to):
        raise SmsError("Use an international number like +16175550123.")
    needed = missing()
    if needed:
        raise SmsError(f"Texts aren't set up on the server: add {', '.join(needed)} to backend/.env.")
    payload = {"To": to, "Body": body}
    if _has(MESSAGING_SERVICE_SID):
        payload["MessagingServiceSid"] = MESSAGING_SERVICE_SID
    else:
        payload["From"] = FROM_NUMBER
    try:
        response = requests.post(f"{API}/Accounts/{ACCOUNT_SID}/Messages.json", data=payload,
                                 auth=(ACCOUNT_SID, AUTH_TOKEN), timeout=TIMEOUT_SECONDS)
    except requests.RequestException:
        raise SmsError("Couldn't reach Twilio.")
    if response.ok:
        return response.json().get("sid", "")
    try:
        error = response.json()
        detail = f"Twilio error {error.get('code')}: {error.get('message')}"
    except ValueError:
        detail = f"Twilio returned {response.status_code}."
    raise SmsError(detail)
