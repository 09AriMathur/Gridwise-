# GridWise

Carbon-aware scheduler for heavy home appliances, built at Hackachusetts for the Boston area. GridWise reads the grid's carbon-intensity forecast and energy mix from Electricity Maps and finds the cleanest time to run laundry, dishwashers, water heaters and EV charging before your deadline.

- **Plan:** the lowest-carbon window that still finishes on time, with CO₂ saved, money saved on a time-of-use plan, and *why* the window is cleaner (the grid's mix).
- **Remind:** for devices without a smart plug, turn-on and turn-off reminders in the app and by text message (Twilio).
- **Prove it:** a savings backtest that replays real grid history.
- **Demo data:** a fresh browser is filled with sample data so every feature is visible.

## Layout

    backend/    FastAPI service. Talks to Electricity Maps and Twilio; plans windows; stores history and text reminders in SQLite.
    frontend/   Vite + React 19 + TypeScript UI (shadcn/ui, Apple HIG style). Talks only to the backend.
    .kiro/      Steering docs, skills, and feature specs (requirements, design, tasks).

## Running the backend

    cd backend
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
    cp .env.example .env              # add your Electricity Maps key; Twilio settings for texts
    ./venv/bin/uvicorn main:app --reload --port 8000   # http://127.0.0.1:8000, API docs at /docs
    ./venv/bin/python -m pytest       # tests (no network)

Environment (`backend/.env`):

| Variable | What it's for |
|---|---|
| `ELECTRICITY_MAPS_API_KEY` | grid data (required for live data; otherwise a labelled sample forecast is used) |
| `ELECTRICITY_MAPS_BASE_URL` | `https://api.electricitymaps.com/v4` |
| `DEFAULT_ZONE` | `US-NE-ISNE` (ISO New England) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | text-message reminders |
| `TWILIO_FROM_NUMBER` (or `TWILIO_MESSAGING_SERVICE_SID`) | the Twilio number texts come from; it must be a number on your Twilio account |

The backend has to be restarted after editing `.env`. On a Twilio trial account, texts only reach numbers verified in the Twilio console.

## Running the frontend

    cd frontend
    npm install
    cp .env.example .env              # VITE_API_URL, VITE_DEMO_DATA
    npm run dev                       # http://localhost:5173
    npx tsc --noEmit -p . && npm run build

Set `VITE_DEMO_DATA=false` to start with an empty app instead of the demo dataset (`frontend/src/data/demo-data.json`).

## Docs

- `.kiro/steering/project.md`: architecture, API, rules and decisions
- `backend/skills.md`, `frontend/skills.md`: per-directory rules, including the frontend design system
- `.kiro/specs/`: `live-grid-scheduling`, `savings-and-rates`, `device-reminders`, `energy-mix-and-backtest`, and the planned `fifteen-minute-and-location`
