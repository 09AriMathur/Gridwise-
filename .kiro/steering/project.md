---
inclusion: always
---
# GridWise Project Steering

Read this before any non-trivial change. Directory rules live next to the code in `backend/skills.md` and `frontend/skills.md`. They load only when you work on files in that directory.

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
| Something a tool can enforce mechanically | a lint rule, or a Kiro hook in `.kiro/hooks/` (it's better for a tool to check than for prose to remind) |

Rules for the loop:
- Never edit an instruction file (any of the above) without the user's approval. Show the exact line and the target file first.
- Make it specific and checkable, with file paths or names. "Be careful with X" isn't a rule.
- If a new rule contradicts an existing one, say so and propose replacing the old one. Don't just add the new one alongside.
- Edit `backend/skills.md` or `frontend/skills.md`, never the loader stubs in `.kiro/steering/`.
- At the end of a task, run `/wrap-up` to catch anything you missed.

## Open Questions

- Timezone handling: the forecast datetimes are UTC (`...Z`), but Boston users will enter deadlines in local time. Settle the conversion rule and record it here.
- What `/api/schedule` should do when the Electricity Maps API is unreachable (fall back to the sample data, or error?).

## Recent Lessons

<!-- Format: - Lesson: ... | Why: ... | Where: ... -->
