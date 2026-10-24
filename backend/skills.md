# Backend Skill File

## Purpose

This is the FastAPI service. It fetches carbon-intensity data, picks the best window to run a task, and computes the CO2 savings.

## When to Edit This Directory

Edit here for: API endpoints, scheduling logic, carbon math, the device catalog, and Electricity Maps integration.

Don't edit here when the problem is only rendering or form state in the UI. That belongs in `frontend/`.

## Important Files

- `main.py`: app creation, CORS, router include, `/health`. Run as `uvicorn main:app` from `backend/`.
- `src/routes.py`: an `APIRouter` with prefix `/api`, serving `GET /forecast`, `POST /schedule`, and `GET /devices`. Keep handlers thin and put the logic in the modules below.
- `src/scheduler.py`: `best_window(forecast, duration_hours, deadline)` slides a window across the forecast and returns the one with the lowest average intensity that still finishes by the deadline.
- `src/carbon.py`: `emissions_grams` and `savings_vs_now`. Intensity is in gCO2eq/kWh, so grams = intensity × kWh.
- `src/devices.py`: the `DEVICES` list (`id`, `name`, `kwh`, `duration_hours`) and `get_device`.
- `src/grid_api.py`: the only module that calls Electricity Maps. It reads its config from env vars via `load_dotenv()`.
- `src/database.py`: an SQLite stub that nothing imports. Only wire it up if scheduled tasks need to survive a restart.
- `data/sample_forecast.json`: a synthetic forecast for zone `US-NE-ISNE`.

## Rules

- All HTTP calls to Electricity Maps go through `src/grid_api.py`. Other modules call its functions and never use `requests` themselves.
- A forecast entry has the shape `{"datetime": "<ISO8601 UTC, Z suffix>", "carbonIntensity": <number gCO2eq/kWh>}`. Tests and the sample data both use it. `grid_api.py` should normalize the API response to this shape.
- Keep `scheduler.py` and `carbon.py` pure: no network, no file I/O, no env vars. That way they can be tested with literal lists.
- Imports use `from src.<module> import ...`, which only resolves when the current directory is `backend/`.
- If you serve `sample_forecast.json`, the response must make it clear the data is synthetic.
- Validate request input (unknown device id, a deadline earlier than now plus the duration, `duration_hours` <= 0) and return a 4xx with a clear message. Don't let these cases surface as a 500.
- Never log the API key or the full request headers.

## Common Mistakes

- Mistake: running `pytest` or `uvicorn` from the repo root.
  - Why it happens: the `src.` imports only resolve from `backend/`.
  - How to avoid it: `cd backend` first.
- Mistake: deleting or loosening the skipped test in `tests/test_scheduler.py`.
  - How to avoid it: when you implement `best_window`, remove only the `@pytest.mark.skip` decorator and make the test pass as written.

## Debugging Playbook

1. Reproduce the request at http://127.0.0.1:8000/docs.
2. Read the uvicorn traceback. A `NotImplementedError` means you hit a stub that hasn't been implemented yet.
3. Check what `grid_api.py` returns against the forecast shape described above.
4. Test the scheduler or carbon logic on its own with a literal forecast list in pytest.
5. Check what the frontend expects (`frontend/src/api.js` and the components) before changing a response shape.

## Validation

```bash
cd backend && pytest
```

## Self-Improvement Rule

If a correction, bug root cause, or discovery applies only to `backend/`, propose a one-line rule for this file and follow the learning loop in `.kiro/steering/project.md`. Don't edit this file without the user's approval.
