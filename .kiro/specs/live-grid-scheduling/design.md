# Design: Live Grid Scheduling

## Overview

The backend fetches the hourly forecast, picks the window with `scheduler.best_window`, and adjusts it to "now" and the exact duration. The frontend shows it and falls back to `lib/optimizer.findBestWindow` if the server fails.

## Architecture

```
Dashboard ── api.plan() ──> POST /api/schedule ── _forecast() ── grid_api.fetch_forecast() ── Electricity Maps v4
   │                                   └─ fallback: _sample_from_now() (synthetic)
   │                        best_window() (hourly, duration rounded up) -> start = max(start, now, availability start)
   └─ on error: optimizer.findBestWindow() in the browser (15-min steps over hourly points)
```

## Components and Interfaces

- **`grid_api.fetch_forecast(zone)`:** `GET {BASE_URL}/carbon-intensity/forecast?zone=` with the `auth-token` header. Returns `[{datetime: "…Z", carbonIntensity}]`.
- **`routes._forecast(zone)`:** returns `(hours, synthetic)`. On any error it returns the sample forecast via `_sample_from_now()`.
- **`scheduler.best_window(forecast, duration_hours, deadline)`:** pure. It slides a window of `ceil(duration)` hours and returns `{start, end, intensity}`.
- **`POST /api/schedule`:** request model `ScheduleRequest`. It accepts both the frontend shape (`duration_min`, `energy_kwh`, `availability`) and the older shape (`device_id`, `duration_hours`, `kwh`).
- **Frontend:** `api.forecast()` / `api.plan()` with `mapForecast` / `mapPlan` in `lib/api.ts`; `useGrid()` polls the forecast every 10 min; `ForecastBars.tsx` (Dashboard) and `ForecastChart.tsx` (Insights).

## Data Models

- **Forecast point:** `{ "datetime": "2026-10-24T20:00:00Z", "carbonIntensity": 312 }`
- **Plan response:**
  - `planned_start`, `planned_end`
  - `avg_intensity_best`, `avg_intensity_now`, `co2_avoided_g`
  - `forecast_source`
  - optional `window_mix` / `now_mix` (see the energy-mix spec)

## Error Handling

- No key, or the API is down: synthetic forecast plus a UI warning.
- No window fits: 400 with a reason. The UI shows it and tries the browser fallback.
- The Dashboard rejects a server plan that starts in the past or doesn't match the duration (±60 s) and uses the fallback instead.

## Testing Strategy

- `tests/test_scheduler.py`: `best_window` edge cases on literal lists.
- `tests/test_routes.py`:
  - live vs synthetic sources
  - exact duration, starting no earlier than now
  - availability bounds; 400, 404 and 422 paths
- Network is stubbed by the `no_network` fixture.
