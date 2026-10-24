# Backend Skill File

## Purpose

The FastAPI service:
- fetches carbon intensity, energy mix and history from Electricity Maps
- picks the best window to run a task, and computes CO₂ savings
- replays history for the savings backtest
- stores grid history and text reminders in SQLite, and sends reminder texts through Twilio

## When to Edit This Directory

Edit here for API endpoints, scheduling logic, carbon/mix/backtest math, the device catalog, Electricity Maps or Twilio integration, and storage.

Don't edit here when the problem is only rendering, form state, browser storage or styling. That belongs in `frontend/`.

## Important Files

- **`main.py`:** app creation, CORS, router include, `/health`. Its lifespan starts two background loops: save history hourly (`_keep_history`) and send due texts every 30 s (`_send_reminders`). Run as `uvicorn main:app` from `backend/`.
- **`src/routes.py`:** an `APIRouter` with prefix `/api`. Keep handlers thin; logic lives in the modules below. Endpoints are listed in `.kiro/steering/project.md`.
- **`src/scheduler.py`:**
  - `best_window(forecast, duration_hours, deadline)` slides a window over **hourly** entries and returns the one with the lowest average intensity that finishes by the deadline.
  - It rounds the duration up to whole hours.
  - `routes.post_schedule` then starts the window no earlier than now and runs it for the exact duration.
- **`src/carbon.py`:** `emissions_grams` and `savings_vs_now` (grams = intensity × kWh).
- **`src/mix.py`:**
  - `shares(row)`: sources plus imports as percentages adding up to 100, with `low_carbon_pct`, `fossil_pct` and `imports_pct`
  - `window_mix(rows, start, end)`: overlap-weighted average over a window
  - `summary(row)`
- **`src/backtest.py`:** `backtest(points, tasks, habit_minutes, tz_offset_min, flex_hours, days, now)`.
  - Compares running at the habit time with GridWise's pick within `flex_hours`, using `best_window`.
  - `next_ready()` says when history will first cover a habit day.
- **`src/grid_api.py`:** the only module that calls Electricity Maps.
  - `fetch_forecast`, `fetch_current`, `fetch_history`, `fetch_mix`, `fetch_mix_forecast`, `zone_name`
  - Normalises rows to `{"datetime": "…Z", "carbonIntensity": n}`.
  - Mix rows become `{"datetime", "sources": {name: MW}, "imports", "exports"}`: nulls become 0, storage discharge becomes `"storage"`.
- **`src/sms.py`:** the only module that calls Twilio. `status()`, `missing()`, `send(to, body)` (raises `SmsError` with a readable reason), `E164`.
- **`src/reminders.py`:** `compose()` (fixed wording, local times), `schedule()` (stores on/off rows), `dispatch(now, send)` (sends due rows; skips texts more than 30 min late for "on" or 2 h late for "off").
- **`src/database.py`:** SQLite at `DB_PATH` (env `GRIDWISE_DB`, default `gridwise.db`).
  - Tables: `history(zone, datetime, carbon_intensity)` and `reminders(task_id, kind, phone, send_at, body, status, …)`.
  - Helpers: `save_history`, `load_history`, `days_covered`, `add_reminders`, `due_reminders`, `mark_reminder`, `cancel_reminders`, `reminders_for`.
- **`src/devices.py`:** the `DEVICES` catalog and `get_device`.
- **`data/sample_forecast.json`:** a synthetic forecast. `routes._sample_from_now()` shifts it to the current hour.

## Rules

- **Electricity Maps** calls go through `src/grid_api.py`. **Twilio** calls go through `src/sms.py`. No other module uses `requests`.
- Forecast and history entries have the shape `{"datetime": "<ISO UTC, Z suffix>", "carbonIntensity": <gCO₂eq/kWh>}`. Normalise API responses to it.
- **Keep `scheduler.py`, `carbon.py`, `mix.py` and `backtest.py` pure:**
  - no network, file I/O or env vars, so they can be tested with literal lists
  - reuse `best_window`; don't write a second scheduler
- Imports use `from src.<module> import …`, which only resolves when the current directory is `backend/`.
- If you serve the sample forecast, the response must say it's synthetic (`source: "synthetic"`).
- Validate input and return 4xx with a clear message for:
  - an unknown device
  - a duration ≤ 0 or a bad deadline
  - `days` not 1 or 7
  - a phone number not in E.164
  - Twilio not configured: **503**, naming the missing env var

  None of these may surface as a 500.
- **Best-effort extras must not break the core:** if the mix fetch inside `/api/schedule` fails, the plan is returned without `window_mix`.
- **Text wording** comes from `reminders.compose`, never from the request. Device names are cleaned and capped at 40 characters.
- **Never log** the API key, the Twilio token, request headers, or phone numbers.
- **Tests** must not touch the network or the real DB:
  - `tests/test_routes.py` has an autouse `no_network` fixture that stubs `fetch_mix*`, `fetch_history` and `zone_name`, and points `database.DB_PATH` at `tmp_path`
  - fake Twilio by monkeypatching `sms.requests.post` or passing a `send` function to `dispatch`

## Common Mistakes

- **Running `pytest` or `uvicorn` from the repo root, or plain `pytest`.** The `src.` imports only resolve from `backend/`. Fix: `cd backend && ./venv/bin/python -m pytest`.
- **Expecting more than 24 h of history from the API.** This key gets 401 on `past-range`. Fix: read stored history with `database.load_history`; the hourly loop keeps it growing while the backend runs.
- **Treating an hourly forecast as 15-minute (or the reverse).** `best_window` and `routes.post_schedule` assume hourly entries (`HOUR`). Fix: see `.kiro/specs/fifteen-minute-and-location/` before changing granularity.
- **Setting `TWILIO_FROM_NUMBER` to a personal number.** Status says "ready" but Twilio rejects every send. Fix: the From number must be a Twilio number owned by the account. On a trial account, recipients must be verified too.
- **Editing `.env` and expecting `--reload` to pick it up.** Fix: restart uvicorn.

## Debugging Playbook

1. Reproduce the request at http://127.0.0.1:8000/docs or with curl.
2. Read the uvicorn traceback.
3. Check what `grid_api.py` returns against the shapes above, using curl with the `auth-token` header and without printing the key.
4. Test the scheduler, carbon, mix or backtest logic on its own with literal lists in pytest.
5. For texts, check `GET /api/sms/status`, then `GET /api/reminders/{task_id}` for each reminder's status and error. Twilio error codes are kept there.
6. Check what the frontend expects (`frontend/src/lib/api.ts`, `lib/types.ts`) before changing a response shape.

## Validation

```bash
cd backend && ./venv/bin/python -m pytest
```

## Self-Improvement Rule

If a correction, bug root cause, or discovery applies only to `backend/`, propose a one-line rule for this file and follow the learning loop in `.kiro/steering/project.md`. Don't edit this file without the user's approval.
