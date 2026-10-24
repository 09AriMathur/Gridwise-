# Frontend Skill File

## Purpose

The Vite + React 19 + TypeScript UI, in three pages:
- **Dashboard:** pick a device and deadline, see the cleanest window, its CO₂ and money saved, and why it's cleaner (energy mix).
- **My Home:** devices, upcoming tasks, history, electricity rates, text-message reminders, demo data.
- **Insights:** the 24 h forecast, what's powering the grid, and the savings backtest.

## When to Edit This Directory

Edit here for pages, components, forms, styling, browser storage, the in-app reminders, and calling the backend.

Don't edit here when the problem is the logic behind the numbers:
- the recommended window is wrong: `backend/src/scheduler.py`
- CO₂ numbers are wrong: `backend/src/carbon.py`
- mix shares are wrong: `backend/src/mix.py`
- the backtest is wrong: `backend/src/backtest.py`
- forecast data is bad: `backend/src/grid_api.py`
- texts don't send: `backend/src/sms.py` / `reminders.py`

## Important Files

- **`src/lib/api.ts`:** the **only** file that calls the backend. `ROUTES` lists every path. Mappers (`mapForecast`, `mapPlan`, `mapMix`, `mapGridMix`) turn backend JSON into the types in `src/lib/types.ts`. `request()` throws `ApiError` with a readable message.
- **`src/lib/grid.tsx`:** `GridProvider` / `useGrid()` polls the forecast and the mix every 10 min. It exposes `forecast`, `now` (with its level), `mix` and `zoneName`.
- **Browser stores**, each a `useX()` hook over `localStorage` that syncs across tabs:
  - `devices.ts` (`gridwise.devices.v1`)
  - `tasks.ts` (`gridwise.tasks.v1`, `liveStatus()`)
  - `rates.ts` (`gridwise.rates.v1`, `moneySaved()`, `runCost()`)
  - `notifications.ts` (`gridwise.notifications.v1`, plus fired-reminder keys)
  - `phone.ts` (`gridwise.phone.v1`)
  - the habit time in `BacktestPanel.tsx` (`gridwise.habit.v1`)
  - the theme (`vite-ui-theme`)
- **`src/lib/demo.ts` + `src/data/demo-data.json`:** the demo dataset.
  - `seedDemoOnFirstRun()` (called in `main.tsx`) loads it into a fresh browser unless `VITE_DEMO_DATA=false`.
  - Times in the JSON are relative (`{"minutesFromNow": n}` or `{"day": d, "time": "HH:MM"}`).
  - CO₂ and money are computed when loaded.
- **`src/lib/optimizer.ts`:**
  - `findBestWindow` is the browser fallback when the server can't plan.
  - `levelOf` / `levelThresholds` split the day into low/moderate/high thirds; the "Grid now" pill and the charts use the same split.
- **`src/lib/time.ts`:** `fmtClock` ("5:40 PM"), `fmtHour` ("5PM"), `fmtDayTime`, all in `America/New_York`.
- **`src/components/common.tsx`:** the design toolkit. Use it instead of ad-hoc classes:
  - layout: `Panel` (inset-grouped section), `Row` (list row with inset separator), `PageTitle`, `Stat`
  - controls: `IconChip` (Settings-style squircle), `Segmented`, `IosSwitch` / `Toggle`
  - feedback: `Note`, `Tag`
  - button classes: `btnSolid` / `btnLine` / `btnTinted` / `btnBare` / `iconBtn`
  - mappings: `fieldCls` / `labelCls`, `LEVEL_UI`, `DEVICE_ICONS` / `DEVICE_TONES`
- **`src/components/`:** `Shell.tsx` (nav bar, tab bar, toasts, reminders), `ForecastBars.tsx`, `ForecastChart.tsx`, `MixBar.tsx` (`MixBar`, `MixList`, `MixCompare`), `Reminders.tsx`, `SmsPanel.tsx`, `RatesPanel.tsx`, `BacktestPanel.tsx`, `DeviceDialog.tsx`, `DevicesRow.tsx`, `theme-provider.tsx`, `mode-toggle.tsx`.
  - `Reminders.tsx` holds `ReminderScheduler`, `ActionBanner`, `NotificationBell` and `useDeviceSwitch`.
- **`src/components/ui/`:** generated shadcn components (`npx shadcn@latest add …`). Don't restyle them here; pass classes from call sites. Theme-level fixes (e.g. `sonner.tsx` using our `useTheme`) are the exception.
- **`src/index.css`:** theme tokens (iOS system colours, light and dark), Apple's type scale as utilities (`text-large-title` … `text-caption-2`), and `material` / `hairline-*` utilities.

## Design Rules (Apple Human Interface Guidelines)

- **Clarity, deference, depth:**
  - flat cards (`bg-card`) on grouped backgrounds, with no coloured shadows or gradients on content
  - translucent bars (`material`) with hairline separators
- **Type:**
  - the system font stack (SF Pro, with Inter as the fallback), sized with the type-scale utilities
  - big numbers use `font-rounded` (SF Rounded) and `tabular-nums`
  - buttons use title case ("Find Cleanest Time")
- **Colour:**
  - use `var(--ios-*)` / `bg-ios-*` system colours and the semantic tokens (`text-muted-foreground` = secondary label)
  - levels: low = green, moderate = orange, high = red; the best window = `primary` (indigo)
  - mix: low-carbon sources get colours, fossil sources get grays (`SOURCE_COLOR` in `MixBar.tsx`)
- **Controls:**
  - `Segmented` for 2–5 options
  - `IosSwitch` for on/off settings
  - filled `btnSolid` for the primary action, `btnLine` (gray) for secondary actions, `btnBare` for text actions
  - lists use `Row` inside a `Panel` with `bodyClassName="p-0 sm:p-0"`
- **Light and dark** follow shadcn's Vite guide (`ThemeProvider`, `ModeToggle`). Test both.
- **Phones:**
  - 390 px wide, no horizontal page scroll
  - the bottom tab bar is fixed, so page content needs `pb-28` (already set on `main` in `Shell`)

## Rules

- Components never call `fetch` directly. Add or extend a function in `src/lib/api.ts`, and its type in `types.ts`.
- **Never hard-code figures.** Money comes from `moneySaved()` / `runCost()` at the user's rates. CO₂ comes from the backend or the task record. Sample figures belong in `src/data/demo-data.json`.
- **Every async UI needs loading, error and empty states.** `api.ts` throws `ApiError`; catch it and show `e.message`.
- **Hide features that fail; don't break the page.** If `/api/mix` fails, `useGrid().mix` is `null` and the mix cards are hidden. If texts can't be scheduled, show why and keep the in-app reminders.
- **Times:** the backend returns UTC ISO strings. Format them with `lib/time.ts`. Send `new Date().getTimezoneOffset()` when the backend needs local time (backtest, texts).
- **Wording must match the data:**
  - `MixCompare` only says "more low-carbon power" when the low-carbon share actually rises
  - label sample or synthetic data as such
- **Task actions:** turning a device on/off or cancelling a task goes through `useDeviceSwitch()` (`turnOn`, `turnOff`, `cancel`). That keeps toasts, banners and backend text reminders (`api.cancelTexts`) in step.
- Shape request bodies to match `backend/src/routes.py` (`ScheduleRequest`, `BacktestRequest`, `ReminderRequest`).

## Common Mistakes

- **Using React 18 with shadcn's current components.** Refs through `asChild` and `Input` are dropped, which breaks tooltips, dialog focus and alert buttons. Fix: stay on React 19.
- **A banner that appears above the content scrolls the page under the sticky header** (Chrome scroll anchoring). Fix: keep `overflow-anchor: none` on `html, body` in `index.css`.
- **Editing `.env` and expecting Vite to pick it up.** Fix: restart `npm run dev`.
- **Changing the demo JSON and not seeing it.** It only loads into a browser that has never opened GridWise. Fix: use My Home → Demo Data → Load Demo Data.
- **Treating forecast points as 15-minute data.** `optimizer.avgIntensity` assumes each point covers an hour. Fix: change that before using 15-minute data (`.kiro/specs/fifteen-minute-and-location/`).
- **A frontend on a port other than 5173.** Every request fails with a CORS error. Fix: use the default port, or update `allow_origins` in `backend/main.py`.

## Debugging Playbook

1. Check the browser console and the Network tab. Is the request reaching `127.0.0.1:8000`?
2. If you get a CORS error, check that the backend is running and look at its logs before suspecting the frontend.
3. Compare the response JSON with the mapper in `api.ts` and the type in `types.ts`.
4. For "wrong numbers", check `localStorage` (`gridwise.*` keys). Reset or reload the demo in My Home.
5. Decide whether the bug is really bad backend data.

## Validation

```bash
cd frontend && npx tsc --noEmit -p . && npm run build
```

No linter or test runner. For UI changes, check light and dark at desktop and 390 px width.

## Self-Improvement Rule

If a correction, bug root cause, or discovery applies only to `frontend/`, propose a one-line rule for this file and follow the learning loop in `.kiro/steering/project.md`. Don't edit this file without the user's approval.
