# Design: Device Reminders (In-App and SMS)

## Overview

There are two independent channels:
- **In-app:** runs in the browser off the local task list.
- **SMS:** runs on the backend off its own reminders table.

The frontend keeps the two in step through `useDeviceSwitch()`.

## Architecture

```
In-app:  ReminderScheduler (Shell) ── every 15 s + on tab visible ── dueReminders(tasks, fired, now)
           └─ raise() -> inbox (localStorage) + browser Notification + toast;  ActionBanner reads liveStatus()

SMS:     Dashboard.schedule() ── api.scheduleTexts() ──> POST /api/reminders ── reminders.schedule() ── database.add_reminders()
         main.py _send_reminders (every 30 s) ── reminders.dispatch(now) ── sms.send() ──> Twilio REST
         useDeviceSwitch.turnOff/cancel ── api.cancelTexts() ──> POST /api/reminders/{id}/cancel
```

## Components and Interfaces

- **`frontend/src/lib/notifications.ts`:**
  - `dueReminders()`: pure
  - `useReminderScheduler()`, `raise()`, `usePermission()`, `sendTest()`
  - storage: `gridwise.notifications.v1`, plus `gridwise.reminders.fired.v1` (survives clearing the inbox)
- **`frontend/src/components/Reminders.tsx`:** `ReminderScheduler`, `ActionBanner` (iOS-notification style), `NotificationBell` (popover inbox and permission control), `useDeviceSwitch` (`turnOn`, `turnOff`, `cancel`).
- **`frontend/src/lib/tasks.ts`:** `status` is `scheduled | started | finished | cancelled`. `liveStatus` adds `due` and `turn_off`. `sms?` holds the phone number texts go to.
- **`frontend/src/components/SmsPanel.tsx`, `lib/phone.ts`:** status, the saved number (`gridwise.phone.v1`), the test text.
- **`backend/src/sms.py`:**
  - `status()` (ready, missing, trial)
  - `send(to, body)`: POST `/2010-04-01/Accounts/{SID}/Messages.json` with basic auth; `From` or `MessagingServiceSid`
  - `SmsError`, `E164`
- **`backend/src/reminders.py`:** `compose()`, `schedule()`, `dispatch(now, send=sms.send)`, `LATE_LIMIT`.
- **`backend/src/database.py`:** a `reminders` table, unique on (`task_id`, `kind`); `add_reminders`, `due_reminders`, `mark_reminder`, `cancel_reminders`, `reminders_for`.
- **Routes:**
  - `GET /api/sms/status`, `POST /api/sms/test`
  - `POST /api/reminders`, `POST /api/reminders/{task_id}/cancel`, `GET /api/reminders/{task_id}`

## Data Models

- **`reminders` row:** `id, task_id, kind ("on"|"off"), phone, send_at (UTC Z), body, status (pending|sent|failed|cancelled|skipped), error, sent_at`
- **Environment:**
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER` (a Twilio number owned by the account) or `TWILIO_MESSAGING_SERVICE_SID`

## Error Handling

- SMS not configured: 503 from `/api/reminders`, naming the missing variables. The UI toast explains it, and the in-app reminders still work.
- Twilio rejects a text: `SmsError("Twilio error <code>: <message>")`, stored on the row and shown for test texts.
- Backend down past the late limit: the row is marked `skipped`.
- Mobile browsers that only allow notifications from a service worker: no system notification; the banner and bell still work.

## Security

- Phone numbers are stored in `gridwise.db` (gitignored) and never logged.
- The auth token is never logged.
- Wording is fixed on the server, so the endpoint can't relay arbitrary text.

## Testing Strategy

- `tests/test_sms.py`, with no real Twilio:
  - missing settings are named; trial accounts are flagged
  - the request payload is correct; Twilio errors are readable; bad numbers are rejected
  - local-time wording; names are cleaned
  - on/off timing; cancellation; turning off early
  - late texts skipped; failures recorded; rescheduling replaces old times
  - route 503/422
- Bundled assertions for `dueReminders`: fire once, smart plugs excluded, the late limits.
- Playwright: the Notification API is spied on; on → off flow; no duplicate fires after reload; the SMS panel and the scheduling error path while Twilio isn't set up.
