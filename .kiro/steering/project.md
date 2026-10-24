---
inclusion: always
---
# GridWise Project Steering

Read this before any non-trivial change. Directory rules live next to the code in `backend/skills.md` and `frontend/skills.md`; they load when you work on files in that directory. Feature specs (requirements, design, tasks) live in `.kiro/specs/`.

## Project Overview

GridWise is a carbon-aware scheduler for heavy home appliances, built at Hackachusetts for the Boston area. A user picks a device (EV charger, washer, dryer, dishwasher, water heater…) and a deadline. The backend reads the grid's carbon-intensity forecast from Electricity Maps and returns the lowest-carbon window that still finishes on time, with the CO₂ (and, on a time-of-use plan, the money) saved compared with running it now.

Around that core:
- **Reminders** for devices without a smart plug: turn-on/turn-off alerts in the app, and text messages via Twilio that the backend sends even when the app is closed.
- **Energy mix**: what the grid is made of now and in the chosen window ("58% gas, 17% nuclear").
- **Savings backtest**: replays real history to show what following GridWise would have saved.
- **Demo data**: a committed dataset that fills a fresh browser so every feature is visible.

## Tech Stack

- **Backend:** Python 3.12, FastAPI, uvicorn, `requests`, `python-dotenv`, SQLite (stdlib `sqlite3`). Tests: pytest.
- **Frontend:** Vite 5, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix, "nova" preset), lucide-react icons, recharts, sonner toasts. Font: the system font (SF Pro) with Inter as the fallback.
- **Grid data:** Electricity Maps **API v4** at `https://api.electricitymaps.com/v4`; default zone `US-NE-ISNE` (ISO New England).
- **Texts:** Twilio REST API, called with `requests` (no SDK).

## Architecture

```
React pages/components ──> frontend/src/lib/api.ts ──> FastAPI /api/* (backend/src/routes.py)
                                                         ├─ scheduler.py · carbon.py · mix.py · backtest.py   (pure logic)
                                                         ├─ grid_api.py  ──> Electricity Maps
                                                         ├─ sms.py       ──> Twilio
                                                         ├─ reminders.py (text reminders; sent by a loop in main.py)
                                                         └─ database.py  ──> gridwise.db (history + reminders)
Browser localStorage: devices, tasks, rates, notifications, phone, theme (frontend/src/lib/*.ts)
```

- The browser only talks to the backend. The backend is the only thing that talks to Electricity Maps or Twilio; keys never reach the frontend.
- One file per boundary. Keep it that way:
  - `frontend/src/lib/api.ts` for backend calls
  - `backend/src/grid_api.py` for Electricity Maps
  - `backend/src/sms.py` for Twilio
- **Scheduled tasks live in the browser** (`lib/tasks.ts`). The backend has no tasks table; `createTask` posts to `/api/schedule`. Text reminders are the exception: the backend stores them, so they send with the app closed.
- **Background loops** (`main.py` lifespan): save the last 24 h of grid history every hour; send due text reminders every 30 s.

## Backend API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/api/forecast?zone=&hours=48` | hourly carbon intensity; `source` is `live` or `synthetic` |
| POST | `/api/schedule` | best window for a task; also `window_mix` / `now_mix` when available |
| GET | `/api/devices` | catalog devices |
| GET | `/api/mix?zone=` | energy mix now + hourly mix forecast summary; 503 if unavailable |
| GET | `/api/history?days=1\|7` | stored carbon-intensity history |
| POST | `/api/backtest` | replay history: habit time vs GridWise's pick |
| GET | `/api/sms/status` | can the server text, and what's missing |
| POST | `/api/sms/test` | send a test text |
| POST | `/api/reminders` | store on/off texts for a task |
| POST | `/api/reminders/{task_id}/cancel` | cancel pending texts (`kinds: ["on","off"]`) |
| GET | `/api/reminders/{task_id}` | reminder status for a task |

## Folder Structure

- `backend/main.py`: app, CORS, router, `/health`, background loops
- `backend/src/`:
  - `routes.py`: thin handlers
  - `scheduler.py`: `best_window`
  - `carbon.py`: grams, savings
  - `mix.py`: energy-mix shares
  - `backtest.py`: replaying history
  - `reminders.py`: text wording and dispatch
  - `grid_api.py`, `sms.py`: the external API clients
  - `database.py`: SQLite
  - `devices.py`: catalog devices
- `backend/data/sample_forecast.json`: synthetic fallback forecast. It's shifted to the current hour when used, and always flagged synthetic.
- `backend/tests/`: pytest. Tests never touch the network or the real DB.
- `frontend/src/pages/`: `Dashboard.tsx`, `MyHome.tsx`, `Insights.tsx`
- `frontend/src/components/`:
  - `common.tsx`: the design toolkit
  - `ui/`: generated shadcn components; don't hand-edit except for theming fixes
  - feature components: forecast charts, mix bars, reminders, rates, SMS, backtest
- `frontend/src/lib/`: the API client, browser stores (devices, tasks, rates, notifications, phone), the optimizer fallback, time helpers, demo data loader
- `frontend/src/data/demo-data.json`: committed demo dataset, loaded on a browser's first open
- `.kiro/specs/`: feature specs (requirements, design, tasks)

## Commands

Backend, from `backend/`:

```bash
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.example .env               # add your keys; see Dangerous Areas
./venv/bin/uvicorn main:app --reload --port 8000   # http://127.0.0.1:8000, docs at /docs
./venv/bin/python -m pytest        # plain `pytest` can't import `src`
```

Frontend, from `frontend/`:

```bash
npm install
cp .env.example .env               # VITE_API_URL, VITE_DEMO_DATA
npm run dev                        # http://localhost:5173
npx tsc --noEmit -p .              # type check
npm run build                      # production build
```

There's no linter or formatter. Don't claim lint passed. Ask before adding one.

## Editing Rules

- Make the smallest change that solves the task. No unrelated refactors.
- Keep `scheduler.py`, `carbon.py`, `mix.py` and `backtest.py` pure: no network, files or env vars. Reuse `best_window` rather than writing another scheduler.
- Ask before adding dependencies (`requirements.txt` or `package.json`).
- If you change an API request or response shape, update all of these in the same change:
  - `routes.py`
  - the mapper in `frontend/src/lib/api.ts` and `lib/types.ts`
  - every component that reads it
- **Never hard-code figures in the UI.** Money and CO₂ shown to users are computed: `moneySaved()` in `lib/rates.ts`, `emissions_grams` in `carbon.py`. Sample figures belong in `frontend/src/data/demo-data.json`.
- **Be honest in the UI:**
  - label sample data as sample data
  - don't claim a cleaner window has "more renewables" unless the mix shows it
  - say when SMS isn't set up instead of failing silently

## Dangerous Areas

- **`backend/.env`** holds the Electricity Maps key and Twilio credentials. Never print, log or commit it, and never read its values. Variable names are in `.env.example`:
  - `ELECTRICITY_MAPS_API_KEY`, `ELECTRICITY_MAPS_BASE_URL`, `DEFAULT_ZONE`
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER` (or `TWILIO_MESSAGING_SERVICE_SID`)
  - optional `GRIDWISE_DB`
- **`backend/gridwise.db`** (gitignored) stores grid history and users' phone numbers for reminders. Don't commit it or log its rows.
- **CORS** in `backend/main.py` allows only `http://localhost:5173`. Update it if the frontend origin changes. Don't use `"*"` while `allow_credentials=True`.
- **Text wording** is composed on the server (`reminders.compose`). Never send request-supplied text through Twilio.
- **Sample data:** `backend/data/sample_forecast.json` and the demo dataset are synthetic. Never present them as real readings.

## Debugging Playbook

1. Reproduce it: hit the endpoint at `/docs` or with curl before touching the UI.
2. Decide which layer is at fault: frontend, routes, pure logic, an external API (Electricity Maps or Twilio), or storage.
3. A CORS error in the browser usually means a backend crash or a wrong origin. Check the uvicorn logs first.
4. Fix the root cause with the smallest change, then run the backend tests and/or the frontend type check and build.
5. If the bug came from missing project knowledge, propose a lesson for the relevant steering file.

## Learning Loop (Self-Improvement Rule)

Triggers:
- The user corrects something that is likely to recur
- You fix a bug whose root cause came from missing project knowledge
- You discover an architectural detail or edge case that isn't written down

When one happens, propose a **one-line rule** and say where it belongs:

| Scope | Where it goes |
|---|---|
| All projects (how you work in general) | `~/.kiro/steering/AGENTS.md` (global) |
| The whole GridWise project | this file (`.kiro/steering/project.md`), in the matching section or under Recent Lessons |
| Only `backend/` or only `frontend/` | `backend/skills.md` or `frontend/skills.md` |
| A repeatable multi-step workflow | a skill in `.kiro/skills/<name>/SKILL.md` |
| A feature's requirements, design or remaining tasks | `.kiro/specs/<feature>/` |
| Something a tool can enforce mechanically | a lint rule, or a Kiro hook in `.kiro/hooks/` (it's better for a tool to check than for prose to remind) |

Rules for the loop:
- Never edit an instruction file (any of the above) without the user's approval. Show the exact line and the target file first.
- Make it specific and checkable, with file paths or names. "Be careful with X" isn't a rule.
- If a new rule contradicts an existing one, say so and propose replacing the old one. Don't just add the new one alongside.
- Edit `backend/skills.md` or `frontend/skills.md`, never the loader stubs in `.kiro/steering/`.
- At the end of a task, run `/wrap-up` to catch anything you missed.

## Decisions (formerly Open Questions)

- **Timezones:** the backend works in UTC (`…Z`). The frontend formats times in `America/New_York` (`lib/time.ts`). It sends the browser's `getTimezoneOffset()` where local time matters: backtest habit times, and times in text messages.
- **Electricity Maps unreachable:** `/api/forecast` and `/api/schedule` fall back to the sample forecast, shifted to start at the current hour, with `source`/`forecast_source` = `synthetic`. The UI shows a warning. `/api/mix` returns 503, and the UI hides the mix.

## Open Questions

- Tasks live only in the browser. A server-side tasks table would sync devices across browsers and let smart plugs be triggered. Not built.
- `lib/time.ts` hard-codes `America/New_York`. Revisit when location support lands (`.kiro/specs/fifteen-minute-and-location/`).
- Twilio: the account is a trial; the From number must be a Twilio number on the account, and recipients must be verified. US delivery may need A2P 10DLC or toll-free registration.

## Recent Lessons

<!-- Format: - Lesson: ... | Why: ... | Where: ... -->
- Lesson: run backend tests with `./venv/bin/python -m pytest` from `backend/`. | Why: plain `pytest` can't import `src`. | Where: Commands
- Lesson: this Electricity Maps key can't use `carbon-intensity/past-range` (401) and only gets 24 h of history. | Why: a week-long backtest needs history stored by `database.py`, saved hourly in `main.py`. | Where: backend/skills.md
- Lesson: a lower carbon intensity doesn't always mean a higher low-carbon share. | Why: imports and the fossil mix also move intensity; `MixCompare` wording follows the numbers. | Where: frontend/skills.md
- Lesson: uvicorn `--reload` and Vite don't pick up `.env` changes. | Why: env is read at startup; restart the server after editing `.env`. | Where: Commands
- Lesson: Twilio's `From` must be a number owned by the account (check `IncomingPhoneNumbers`). | Why: a personal number as `TWILIO_FROM_NUMBER` looks configured but every send fails. | Where: backend/skills.md
