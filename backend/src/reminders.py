"""Text-message reminders for devices without a smart plug.

"Turn it on" when the clean window starts, "turn it off" when it ends. The
backend stores them (database.py) and a loop in main.py calls dispatch()
every 30 s, so texts go out even when no browser is open. The wording is
fixed here, never taken from the request, so the endpoint can't be used to
send arbitrary messages.
"""

from datetime import datetime, timedelta, timezone

from src import database, sms

# Same limits as the in-app reminders: a text this late isn't useful any more.
LATE_LIMIT = {"on": timedelta(minutes=30), "off": timedelta(hours=2)}
MAX_NAME = 40


def _parse(timestamp: str) -> datetime:
    moment = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def _format(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _clock(moment: datetime, tz_offset_min: int) -> str:
    """"5:00 AM" in the user's local time (tz_offset_min = browser getTimezoneOffset())."""
    local = moment - timedelta(minutes=tz_offset_min)
    return local.strftime("%I:%M %p").lstrip("0")


def _clean_name(name: str) -> str:
    """Device names come from the browser: keep letters, digits and simple punctuation."""
    kept = "".join(ch for ch in name if ch.isalnum() or ch in " -'&()").strip()
    return (kept or "device")[:MAX_NAME]


def compose(kind: str, device_name: str, start: datetime, end: datetime, tz_offset_min: int) -> str:
    name = _clean_name(device_name).lower()
    if kind == "on":
        return (f"GridWise: Time to turn on your {name}. The grid is at its cleanest until "
                f"{_clock(end, tz_offset_min)}. Reply STOP to opt out.")
    return (f"GridWise: Turn off your {name}. Its clean window ended at {_clock(end, tz_offset_min)}; "
            f"switch it off if it's still running.")


def schedule(task_id: str, phone: str, device_name: str, start: str, end: str, tz_offset_min: int) -> list[dict]:
    """Store the on/off reminders for one task. Returns what was stored."""
    if not sms.E164.match(phone):
        raise ValueError("Use an international number like +16175550123.")
    begin, finish = _parse(start), _parse(end)
    if finish <= begin:
        raise ValueError("the reminder window must end after it starts")
    rows = [
        {"task_id": task_id, "kind": kind, "phone": phone, "send_at": _format(at),
         "body": compose(kind, device_name, begin, finish, tz_offset_min)}
        for kind, at in (("on", begin), ("off", finish))
    ]
    database.add_reminders(rows)
    return [{"kind": row["kind"], "send_at": row["send_at"]} for row in rows]


def dispatch(now: datetime, send=sms.send) -> dict:
    """Send every reminder that's due. Returns counts, for logs and tests."""
    counts = {"sent": 0, "failed": 0, "skipped": 0}
    for reminder in database.due_reminders(_format(now)):
        if now - _parse(reminder["send_at"]) > LATE_LIMIT.get(reminder["kind"], timedelta(minutes=30)):
            database.mark_reminder(reminder["id"], "skipped", "too late to be useful (the backend was off)")
            counts["skipped"] += 1
            continue
        try:
            send(reminder["phone"], reminder["body"])
        except sms.SmsError as error:
            database.mark_reminder(reminder["id"], "failed", str(error))
            counts["failed"] += 1
        else:
            database.mark_reminder(reminder["id"], "sent", sent_at=_format(now))
            counts["sent"] += 1
    return counts
