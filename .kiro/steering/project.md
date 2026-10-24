---
inclusion: always
---
# GridWise Project Steering

Read this before any non-trivial change. Directory rules live in `backend.md` and `frontend.md` in this folder and load automatically when you touch files there.

## Project Overview

GridWise is a carbon-aware scheduler for heavy home appliances in Boston, built at Hackachusetts. A user picks a task (dishwasher, laundry, EV charge, render job) and a deadline. The backend reads the New England grid carbon-intensity forecast from Electricity Maps and returns the lowest-carbon window that still finishes before the deadline, plus the CO2 saved compared with running it now.

## Tech Stack

- Backend: Python, FastAPI, uvicorn, `requests`, `python-dotenv`
- Frontend: Vite + React 18, plain JSX (no TypeScript, no router, no CSS framework)
- Data source: Electricity Maps API v3, zone `US-NE-ISNE`
- Storage: none yet (`backend/src/database.py` is an unused SQLite stub)
- Tests: pytest (backend only)

## Architecture

```
React components -> frontend/src/api.js -> FastAPI /api/* (backend/src/routes.py)
    -> scheduler.py / carbon.py / devices.py
    -> grid_api.py -> Electricity Maps
```

- The browser only talks to the backend, and the backend is the only thing that talks to Electricity Maps. The API key never reaches the frontend.
- Each boundary goes through exactly one file: `frontend/src/api.js` for backend calls and `backend/src/grid_api.py` for Electricity Maps calls. Keep it that way.

## Folder Structure

- `backend/main.py`: creates the app, CORS, includes the router, `/health`
- `backend/src/`: routes, scheduling logic, carbon math, devices, the Electricity Maps client
- `backend/data/sample_forecast.json`: synthetic fallback forecast
- `backend/tests/`: pytest tests
- `frontend/src/api.js`: the only backend client
- `frontend/src/components/`: `TaskForm`, `Recommendation`, `DeviceSimulator`

## Commands

Backend (run from `backend/`, with the venv active):

```bash
pip install -r requirements.txt
uvicorn main:app --reload   # http://127.0.0.1:8000, docs at /docs
pytest
```

Frontend (run from `frontend/`):

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # the only check available on the frontend today
```

No linter, formatter, or typechecker is configured for either side. Don't claim lint or typecheck passed. Ask before adding one.

## Editing Rules

- Make the smallest change that solves the task. No unrelated refactors.
- Many functions are intentional stubs (`raise NotImplementedError`). Implement them in place with the signatures and docstrings already there. Don't restructure the modules.
- Don't add dependencies (`requirements.txt` or `package.json`) without asking first.
- If you change an API request or response shape, update `routes.py`, `frontend/src/api.js`, and every component that reads it, all in the same change.

## Dangerous Areas

- `backend/.env`: holds the Electricity Maps key. Never read, print, log, or commit it. `.env.example` lists the variable names: `ELECTRICITY_MAPS_API_KEY`, `ELECTRICITY_MAPS_BASE_URL`, `DEFAULT_ZONE`.
- CORS in `backend/main.py` allows only `http://localhost:5173`. If the frontend's origin changes, update this list. Don't replace it with `"*"` while `allow_credentials=True`.
- `backend/data/sample_forecast.json` is synthetic. Never present it as a real reading.

## Debugging Playbook

1. Reproduce it: hit the endpoint at `/docs` or with curl before touching the UI.
2. Decide which layer is at fault: the frontend, routes, the scheduler/carbon logic, or the Electricity Maps call.
3. A CORS error in the browser usually means a backend crash or a wrong origin. Check the uvicorn logs first.
4. Fix the root cause with the smallest change, then run `pytest` (backend) or `npm run build` (frontend).
5. If the bug came from missing project knowledge, propose a lesson for the relevant steering file.

## Self-Improvement Rule

When you fix a bug, find an architectural detail, or get a correction from the user, propose a specific edit to the right steering file:

- It affects the whole project: this file
- It affects only `backend/` or `frontend/`: `backend.md` or `frontend.md`
- It's a reusable workflow: a skill in `.kiro/skills/`

Show the exact text you want to add and apply it once the user approves. Write concrete rules with file paths, not vague reminders. Run `/wrap-up` at the end of a task.

## Open Questions

- Timezone handling: the forecast datetimes are UTC (`...Z`), but Boston users will enter deadlines in local time. Settle the conversion rule and record it here.
- What `/api/schedule` should do when the Electricity Maps API is unreachable (fall back to the sample data, or error?).

## Recent Lessons

<!-- Format: - Lesson: ... | Why: ... | Where: ... -->
