"""Tests for text-message reminders. Nothing here talks to Twilio.

Run from the backend/ directory:  python -m pytest
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from src import database, reminders, routes, sms

NOW = datetime(2026, 10, 24, 22, 0, tzinfo=timezone.utc)
STAMP = lambda m: m.isoformat().replace("+00:00", "Z")  # noqa: E731


@pytest.fixture(autouse=True)
def temp_db(monkeypatch, tmp_path):
    monkeypatch.setattr(database, "DB_PATH", str(tmp_path / "test.db"))


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(sms, "ACCOUNT_SID", "AC123")
    monkeypatch.setattr(sms, "AUTH_TOKEN", "secret")
    monkeypatch.setattr(sms, "FROM_NUMBER", "+16175550000")
    monkeypatch.setattr(sms, "MESSAGING_SERVICE_SID", "")
    monkeypatch.setattr(sms, "_account_type", lambda: "Trial")


class FakeResponse:
    def __init__(self, ok, body, status=200):
        self.ok, self._body, self.status_code = ok, body, status

    def json(self):
        return self._body


def test_missing_settings_are_named(monkeypatch):
    monkeypatch.setattr(sms, "FROM_NUMBER", "your_twilio_phone_number")
    monkeypatch.setattr(sms, "MESSAGING_SERVICE_SID", "")
    assert "TWILIO_FROM_NUMBER" in sms.missing()
    assert sms.status()["ready"] is False


def test_status_flags_trial_accounts(configured):
    status = sms.status()
    assert status["ready"] is True
    assert status["trial"] is True


def test_send_posts_to_twilio(configured, monkeypatch):
    calls = []

    def fake_post(url, data, auth, timeout):
        calls.append((url, data, auth))
        return FakeResponse(True, {"sid": "SM1"})

    monkeypatch.setattr(sms.requests, "post", fake_post)
    assert sms.send("+16175551234", "hello") == "SM1"
    url, data, auth = calls[0]
    assert url.endswith("/Accounts/AC123/Messages.json")
    assert data == {"To": "+16175551234", "Body": "hello", "From": "+16175550000"}
    assert auth == ("AC123", "secret")


def test_twilio_errors_are_readable(configured, monkeypatch):
    monkeypatch.setattr(sms.requests, "post", lambda *a, **k: FakeResponse(False, {"code": 21608, "message": "The number is unverified."}, 400))
    with pytest.raises(sms.SmsError, match="21608"):
        sms.send("+16175551234", "hello")


def test_bad_number_is_rejected_before_calling_twilio(configured):
    with pytest.raises(sms.SmsError, match="international"):
        sms.send("6175551234", "hello")


def test_messages_use_local_time_and_clean_names():
    body = reminders.compose("on", "Dish<washer>!", NOW, NOW + timedelta(hours=2), tz_offset_min=240)
    assert body.startswith("GridWise: Time to turn on your dishwasher.")
    assert "8:00 PM" in body  # 00:00 UTC is 8 PM in Boston (UTC-4)


def schedule_demo(start=NOW, hours=2):
    return reminders.schedule("t1", "+16175551234", "Dishwasher", STAMP(start), STAMP(start + timedelta(hours=hours)), 240)


def test_on_and_off_texts_go_out_at_the_right_times():
    schedule_demo()
    sent = []
    send = lambda to, body: sent.append(body)  # noqa: E731
    assert reminders.dispatch(NOW - timedelta(minutes=1), send) == {"sent": 0, "failed": 0, "skipped": 0}
    assert reminders.dispatch(NOW, send)["sent"] == 1
    assert "turn on" in sent[0]
    assert reminders.dispatch(NOW + timedelta(minutes=5), send)["sent"] == 0       # never twice
    assert reminders.dispatch(NOW + timedelta(hours=2), send)["sent"] == 1
    assert "Turn off" in sent[1]


def test_cancelled_tasks_send_nothing():
    schedule_demo()
    assert database.cancel_reminders("t1") == 2
    assert reminders.dispatch(NOW + timedelta(hours=2), lambda *_: None)["sent"] == 0


def test_turned_off_early_cancels_only_the_off_text():
    schedule_demo()
    database.cancel_reminders("t1", ("off",))
    assert reminders.dispatch(NOW, lambda *_: None)["sent"] == 1                       # the "on" text
    assert reminders.dispatch(NOW + timedelta(hours=2), lambda *_: None)["sent"] == 0  # no "off" text


def test_late_texts_are_skipped_and_failures_recorded():
    schedule_demo()
    counts = reminders.dispatch(NOW + timedelta(hours=1), lambda *_: None)  # "on" is 60 min late
    assert counts["skipped"] == 1
    def failing(to, body):
        raise sms.SmsError("Twilio error 21608: unverified")
    assert reminders.dispatch(NOW + timedelta(hours=2), failing)["failed"] == 1
    statuses = {r["kind"]: (r["status"], r["error"]) for r in database.reminders_for("t1")}
    assert statuses["on"][0] == "skipped"
    assert statuses["off"] == ("failed", "Twilio error 21608: unverified")


def test_rescheduling_replaces_the_old_times():
    schedule_demo()
    schedule_demo(start=NOW + timedelta(hours=5))
    rows = database.reminders_for("t1")
    assert len(rows) == 2
    assert rows[0]["send_at"] == STAMP(NOW + timedelta(hours=5))


def test_reminders_route_needs_twilio_configured(monkeypatch):
    monkeypatch.setattr(sms, "FROM_NUMBER", "")
    monkeypatch.setattr(sms, "MESSAGING_SERVICE_SID", "")
    with pytest.raises(HTTPException) as error:
        routes.post_reminders(routes.ReminderRequest(task_id="t1", phone="+16175551234", device_name="Dishwasher",
                                                     start=STAMP(NOW), end=STAMP(NOW + timedelta(hours=1))))
    assert error.value.status_code == 503
    assert "TWILIO_FROM_NUMBER" in error.value.detail


def test_reminders_route_validates_the_number(configured):
    with pytest.raises(HTTPException) as error:
        routes.post_reminders(routes.ReminderRequest(task_id="t1", phone="617", device_name="Dishwasher",
                                                     start=STAMP(NOW), end=STAMP(NOW + timedelta(hours=1))))
    assert error.value.status_code == 422


def test_test_text_reports_twilio_errors(configured, monkeypatch):
    monkeypatch.setattr(sms.requests, "post", lambda *a, **k: FakeResponse(False, {"code": 21608, "message": "unverified"}, 400))
    with pytest.raises(HTTPException) as error:
        routes.post_sms_test(routes.SmsTest(phone="+16175551234"))
    assert error.value.status_code == 400
    assert "21608" in error.value.detail
