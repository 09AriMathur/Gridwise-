# Design: Energy Mix and Savings Backtest

## Overview

`grid_api.py` gains the mix and history calls. Two new pure modules hold the logic: `mix.py` (shares) and `backtest.py` (replay). `database.py` stores history. The frontend adds `MixBar` / `MixList` / `MixCompare` and `BacktestPanel`.

## Architecture

```
GET /api/mix ── grid_api.fetch_mix() + fetch_mix_forecast() ── mix.shares() / mix.summary()
POST /api/schedule ── (best effort) fetch_mix_forecast() ── mix.window_mix(planned window) + window_mix(now)
GET /api/history, POST /api/backtest ── grid_api.fetch_history() → database.save_history() → load_history()
                                        └─ backtest.backtest() ── scheduler.best_window()
main.py lifespan: _keep_history() every hour
```

## Components and Interfaces

- **`grid_api`:**
  - `fetch_mix(zone)` / `fetch_mix_forecast(zone)` return `{datetime, sources: {name: MW}, imports, exports}`. Nulls become 0; storage discharge becomes `"storage"`; charging is ignored.
  - `fetch_history(zone)`; `zone_name(zone)`, from `/zones`, cached.
- **`mix`:**
  - `shares(row)` returns `{total_mw, sources: [{key, label, mw, percent, low_carbon}], low_carbon_pct, fossil_pct, imports_pct}`
  - `window_mix(rows, start, end)`; `summary(row)`
- **`backtest`:**
  - `average_over(points, start, end)`
  - `occurrences(habit_minutes, tz_offset_min, now, days)`
  - `run_once(points, kwh, duration_hours, habit_start, flex_hours)`
  - `backtest(...)` returns `{days_covered, days: [{habit_start, tasks: [...]}], per_task, total_co2_saved_g, next_ready}`
- **`database`:** `history(zone, datetime, carbon_intensity)`; `save_history` (upsert), `load_history`, `days_covered`.
- **Frontend:**
  - `api.mix()`, `api.backtest()`; `useGrid()` adds `mix` and `zoneName`
  - `components/MixBar.tsx`: `SOURCE_COLOR` gives low-carbon sources colours and fossil sources grays
  - `components/BacktestPanel.tsx`: habit time saved as `gridwise.habit.v1`; "Last 24 Hours" / "This Week" segmented control

## Data Models

- **`POST /api/backtest` request:** `{tasks: [{id, kwh, duration_min}], habit_minutes, tz_offset_min, flex_hours, days}`
- **Run result:** `{id, habit_start, habit_end, habit_avg, best_start, best_end, best_avg, co2_saved_g}`

## Error Handling

- Mix unavailable: 503 from `/api/mix`; the schedule response omits the mix; the UI hides the mix sections.
- History fetch fails: serve stored history with `fresh: false`.
- The habit day isn't covered: `days_covered: 0` plus `next_ready`; the UI says when it will be ready.
- Bad input (`days` not 1 or 7, `habit_minutes` out of range, `flex_hours` outside 1–23): 422.

## Testing Strategy

- `tests/test_mix.py`:
  - API row normalisation (nulls, storage, flows)
  - shares add up to 100; storage counts as low-carbon; empty mix; overlap weighting
- `tests/test_backtest.py`:
  - cleaner later window; already-clean habit; too little history; partial hours
  - local-time occurrences; multi-day totals; `next_ready`
- `tests/test_database.py`: upserts don't duplicate; zones stay separate.
- `tests/test_routes.py`: the schedule mix explanation and its outage path; mix 503; history served from storage when the API is down; backtest endpoint.
- Live check: mix shares add up to 100 for ISO New England; the backtest replays real data (e.g. 1.2 kg/day with a 2 AM habit).
