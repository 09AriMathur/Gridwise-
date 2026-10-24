# Design: 15-Minute Scheduling and Location (Planned)

## Overview

These are mostly changes to existing seams, with no new modules.

## 15-minute scheduling

- **`grid_api.fetch_forecast(zone, granularity="hourly")`:** pass `temporalGranularity=15_minutes`. Keep normalising to `{datetime, carbonIntensity}`.
- **`scheduler.best_window`:**
  - derive `step` from `forecast[1].datetime - forecast[0].datetime`
  - `slots = ceil(duration / step)`; replace `timedelta(hours=hours)` with `slots * step`
  - keep the docstring and signature
- **`routes.post_schedule`:** replace the `HOUR` filters with the inferred step.
- **`backtest.average_over` / `mix.window_mix`:** read the step from the data instead of `HOUR`.
- **`frontend/src/lib/optimizer.ts`:** in `avgIntensity`, use each point's own span (the next point's time minus its own) instead of `HOUR`.
- **`ForecastBars.tsx`:** group points into hours for display.

## Location

- **Frontend:**
  - `lib/location.ts`: `useLocation()` calls `navigator.geolocation.getCurrentPosition` once and caches `{lat, lon}` in `localStorage` (`gridwise.location.v1`)
  - add `lat` / `lon` query params to `api.ts` forecast, mix, history, backtest and schedule calls
- **Backend:**
  - `grid_api._get(path, zone, lat=None, lon=None)` sends `lat` / `lon` when given
  - the response's `zone` field tells us the resolved zone; return it, so `zone_name()` and the history storage use it
- **Times:** `lib/time.ts` uses the browser's timezone (drop `TZ = "America/New_York"`).

## Risks

- Zones without a mix or forecast on this key: keep the current fallbacks (503 hides the mix; the sample forecast is flagged synthetic). The sample is ISO-NE-shaped, so label it as sample data for other zones too.
- Rates are per user, not per zone; no change.

## Testing Strategy

- Scheduler tests with 15-minute literal lists (a 40-minute task gets a 45-minute window), plus every existing hourly test unchanged.
- A route test passing `lat` / `lon` through to a stubbed `grid_api`.
- A browser check with Playwright geolocation permission granted and denied.
