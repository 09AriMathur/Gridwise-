# Requirements: 15-Minute Scheduling and Location (Planned)

## Introduction

Not built yet; deferred on 2026-10-24.
- **15-minute scheduling:** Electricity Maps serves 15-minute forecasts and history (`temporalGranularity=15_minutes`; 100 forecast points about 25 h ahead). With them, a 40-minute dishwasher gets a 45-minute slot instead of a whole hour.
- **Location:** carbon-intensity endpoints accept `lat`/`lon` and resolve the zone (verified: NYC → `US-NY-NYIS`, London → `GB`). The user chose **browser geolocation only**, falling back to ISO New England.

## Requirements

### Requirement 1: 15-minute scheduling

**User Story:** As a user with a short cycle, I want the window to fit my run, so that I'm not charged for a whole hour of grid time.

#### Acceptance Criteria
1. WHEN the forecast is 15-minute THEN `best_window` SHALL step and size windows in 15-minute slots (`ceil(duration / 15 min)`), AND hourly input SHALL behave exactly as today (the existing tests still pass).
2. The step SHALL be inferred from the data (the gap between consecutive points), not hard-coded.
3. The browser fallback `avgIntensity` SHALL weight each point by its real duration.
4. The Dashboard chart SHALL stay hourly for readability, averaging 15-minute points per hour, while planning uses the full resolution.

### Requirement 2: Location

**User Story:** As a user outside Boston, I want GridWise to use my grid.

#### Acceptance Criteria
1. WHEN the app first opens THEN it SHALL ask for browser geolocation. IF it's granted, the backend calls SHALL pass `lat`/`lon`. IF it's denied or unavailable, the app SHALL use `DEFAULT_ZONE` (ISO New England).
2. The resolved zone and its readable name SHALL be shown, and SHALL drive the forecast, the mix, history and the backtest.
3. Times SHALL be shown in the user's local timezone, not hard-coded `America/New_York`.
4. History SHALL be stored per zone (already keyed by zone in `database.history`).
