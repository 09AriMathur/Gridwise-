---
inclusion: fileMatch
fileMatchPattern: ["frontend/**"]
---
# Frontend Steering

## Purpose

This is the Vite + React UI. The user picks a device and a deadline, then sees the recommended window and the CO2 it saves.

## When to Edit This Directory

Edit here for: forms, displaying results, the device simulator, and calling the backend.

Don't edit here when: the recommended window is wrong (fix `backend/src/scheduler.py`), the CO2 numbers are wrong (fix `backend/src/carbon.py`), or the forecast data is bad (fix `backend/src/grid_api.py`).

## Important Files

- `src/api.js`: the only file that calls the backend. It exports `getForecast(zone)`, `getSchedule(task)`, and `getDevices()`, and holds `BASE_URL = "http://127.0.0.1:8000/api"`.
- `src/App.jsx`: owns the `recommendation` state and passes `onResult` to `TaskForm` and `data` to `Recommendation`.
- `src/components/TaskForm.jsx`: device picker, duration, deadline, and submit.
- `src/components/Recommendation.jsx`: start time, end time, and grams saved. Renders nothing while `data` is null.
- `src/components/DeviceSimulator.jsx`: fake devices so the demo works without hardware.

## Rules

- Components never call `fetch` directly. Add or extend a function in `src/api.js` and import it.
- Keep plain JSX and the existing function-component style. Don't add TypeScript, a router, a state library, or a CSS framework without asking.
- Every async UI needs loading, error, and empty states. The `api.js` functions throw on a non-OK response, so catch the error and show it.
- Forecast and window times from the backend are UTC ISO strings. Format them in local time for display.
- Shape the request body sent by `getSchedule(task)` to match what `POST /api/schedule` accepts in `backend/src/routes.py`.

## Common Mistakes

- Mistake: the frontend runs on a port other than 5173 and every request fails with a CORS error.
  - How to avoid it: use the default Vite port, or update `allow_origins` in `backend/main.py`.

## Debugging Playbook

1. Check the browser console and the Network tab. Is the request reaching `127.0.0.1:8000`?
2. If you get a CORS error, check that the backend is running and look at its logs before suspecting the frontend.
3. Compare the response JSON with what the component reads.
4. Check the props passed down from `App.jsx`.
5. Decide whether the bug is really bad backend data.

## Validation

```bash
cd frontend && npm run build
```

There's no frontend linter or test runner yet.

## Self-Improvement Rule

If a lesson only applies to `frontend/`, propose adding it to this file.
