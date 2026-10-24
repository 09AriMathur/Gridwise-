# Design: Savings, Rates and Demo Data

## Overview

All money maths runs in the browser, in `frontend/src/lib/rates.ts`, with rates the user typed in. The backend never sees prices. Demo data is a JSON file resolved against the current time and written into the same browser stores the app uses.

## Components and Interfaces

- **`lib/rates.ts`:**
  - `RatePlan = {kind: "flat", rate} | {kind: "tou", peak, offPeak, peakStart, peakEnd, weekdaysOnly}` (plus `confirmed`)
  - `rateAt(plan, ms)`: handles weekends and peaks that cross midnight
  - `runCost(plan, start, end, kwh)`: 5-minute slices, energy drawn evenly
  - `moneySaved(plan, now, start, end, kwh)` returns `{now, window, saved}`
  - `useRates()`, `replacePlan()`, `dollars()`, `describePlan()`
- **`components/RatesPanel.tsx`:** a segmented Flat / Time-of-Use control, fields with validation, Save.
- **Dashboard recommendation:** a money tile with "Saved" / "Extra" / "Cost".
- **`schedule()`:** stores `money` on the `LocalTask`.
- **My Home:** a "Money Saved" stat.
- **Dashboard banner:** totals across tasks that weren't cancelled.
- **`lib/demo.ts`:**
  - `loadDemo()` resolves the JSON's `{minutesFromNow}` / `{day, time}` times, computes `co2g = kWh × (baseline − best)` and `money` via `moneySaved`, then writes to the stores with `replaceDevices`, `replaceTasks`, `replacePlan` and `replaceNotifications`
  - `seedDemoOnFirstRun()` runs in `main.tsx` before the first render
  - `resetAll()`

## Data Models

- **localStorage keys:**
  - `gridwise.rates.v1`, `gridwise.tasks.v1`, `gridwise.devices.v1`, `gridwise.notifications.v1`
  - `gridwise.reminders.fired.v1`
  - `gridwise.demo.seeded.v1`: set after seeding or resetting, so the demo isn't re-seeded
- **The demo JSON** has `rates`, `devices`, `tasks` (`start`, `plannedAt`, `hours`, `best`, `baseline`, `status`), `notifications` and `firedReminders`.

## Error Handling

- Storage blocked: the stores fall back to defaults, and seeding is skipped.
- Invalid rate input: field errors, nothing saved.
- An unknown device id in the JSON: that task is skipped, not a crash.

## Testing Strategy

- Assertions for `rates.ts`, run by bundling with esbuild in the scratchpad:
  - flat rate is $0 saved
  - peak vs off-peak gives $1.80
  - a run straddling peak end costs $3.10
  - weekends; a peak crossing midnight; negative savings
- Browser checks (Playwright):
  - a fresh device auto-seeds 11 tasks, 6 devices and the TOU rates
  - user changes survive a reload
  - Reset stays empty after reload
  - existing data isn't overwritten
