# Requirements: Energy Mix and Savings Backtest

## Introduction

Carbon intensity is one number. Electricity Maps' `electricity-mix` endpoints say what the grid is made of. Its history endpoint lets GridWise replay what really happened. This spec turns those into:
- a reason for each recommendation
- a "what you'd have saved" replay of real history

API facts for this key, probed 2026-10-24:
- `electricity-mix/latest`, `/history` (24 h) and `/forecast` (25 h) are hourly MW per source, with imports and exports.
- `carbon-intensity/history` covers 24 h only.
- `carbon-intensity/past-range` returns **401**, which is why the backend stores history itself.

## Requirements

### Requirement 1: What's powering the grid

**User Story:** As a user, I want to see what the grid is made of right now, so that I understand why it's clean or dirty.

#### Acceptance Criteria
1. WHEN `GET /api/mix` is called THEN the system SHALL return, for the current hour, shares of supply (local sources plus imports) that add up to 100, along with `low_carbon_pct`, `fossil_pct`, `imports_pct`, the zone's readable name, and an hourly forecast summary.
2. Low-carbon SHALL mean nuclear, wind, solar, hydro, geothermal, biomass and storage discharge. Fossil SHALL mean gas, coal and oil.
3. WHEN the mix is unavailable THEN `/api/mix` SHALL respond 503, AND the UI SHALL hide the mix sections without affecting planning.
4. Insights SHALL show a stacked bar, a per-source list (% and MW), the low-carbon share and when the mix will be cleanest in the next 24 h.
5. The zone name from the API ("ISO New England") SHALL replace hard-coded "New England" text.

### Requirement 2: Why this window

**User Story:** As a user, I want to know why the recommended window is cleaner.

#### Acceptance Criteria
1. WHEN `/api/schedule` can fetch the mix forecast THEN it SHALL include `window_mix` (overlap-weighted over the planned window) and `now_mix` (the same duration starting now).
2. WHEN the mix fetch fails THEN `/api/schedule` SHALL still return the plan without those fields.
3. The UI SHALL compare the two mixes, AND its sentence SHALL claim only what the numbers show:
   - "more low-carbon power" only when the low-carbon share rises by at least 1 point
   - otherwise "less fossil power" if the fossil share falls by at least 1 point
   - otherwise say the mix is about the same

### Requirement 3: Savings backtest

**User Story:** As a user, I want to see what following GridWise would have saved on real data, so that I trust it's worth it.

#### Acceptance Criteria
1. WHEN `POST /api/backtest` is called with devices, a habit time (local), the timezone offset, `flex_hours` (default 12) and `days` (1 or 7) THEN for each covered day it SHALL compare running at the habit time with the cleanest window in the following `flex_hours`, using the live scheduler's `best_window`.
2. Savings SHALL never be negative. IF nothing cleaner fits, the habit time SHALL be reported as already the cleanest.
3. WHEN history doesn't cover a habit day THEN the response SHALL say so and give `next_ready`, the time it will be covered.
4. The backend SHALL save the last 24 h of history at startup and hourly while running, so "This Week" becomes available after 7 days, AND the UI SHALL show "Collecting history · N of 7 days" until then.
5. Money in the backtest SHALL use the user's own rates in the browser (`moneySaved`), AND SHALL explain a $0 result.
