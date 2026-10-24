# Requirements: Live Grid Scheduling

## Introduction

GridWise plans when to run a heavy appliance so it uses the cleanest electricity that still lets the run finish on time. This spec covers:
- the live forecast from Electricity Maps
- the scheduling endpoint, and the browser fallback when the server can't plan
- the forecast charts

## Requirements

### Requirement 1: Live forecast

**User Story:** As a user, I want to see the real carbon-intensity forecast for my grid, so that I can trust the recommendation.

#### Acceptance Criteria
1. WHEN the frontend requests `GET /api/forecast?hours=48` THEN the system SHALL return hourly `{datetime, carbonIntensity}` points from Electricity Maps v4, with `source: "live"`.
2. WHEN Electricity Maps is unreachable or the key is missing THEN the system SHALL return the sample forecast shifted to start at the current hour, with `source: "synthetic"`, AND the UI SHALL show a warning that it's sample data.
3. WHEN `hours` is less than 1 THEN the system SHALL respond 422.
4. The Electricity Maps key SHALL never be sent to the browser.

### Requirement 2: Best window

**User Story:** As a user, I want GridWise to pick the lowest-carbon time to run a device before my deadline, so that I cut emissions without missing it.

#### Acceptance Criteria
1. WHEN the frontend posts `{appliance, duration_min, energy_kwh, deadline, availability}` to `POST /api/schedule` THEN the system SHALL return `planned_start` and `planned_end`. The window SHALL:
   - start no earlier than now or the start of the availability window
   - end at or before the deadline and the end of availability
   - last exactly the requested duration
2. The system SHALL return `avg_intensity_best`, `avg_intensity_now` (the same duration starting now) and `co2_avoided_g` (≥ 0).
3. WHEN no window fits THEN the system SHALL respond 400 with a readable reason.
4. WHEN a catalog `device_id` is given THEN the system SHALL use its duration and energy. An unknown string id SHALL return 404.
5. IF the server can't plan THEN the UI SHALL plan in the browser from the forecast it already has, and SHALL label the result "Planned on this device".

### Requirement 3: Forecast display

**User Story:** As a user, I want to see when the grid is clean or dirty, so that I understand the recommendation.

#### Acceptance Criteria
1. The Dashboard bar chart SHALL colour each hour by its level relative to the day: low (green), moderate (orange) or high (red), using the same split as the "Grid now" pill.
2. WHEN a window is chosen THEN its bars SHALL be highlighted in the app tint, and the chart header SHALL show its average intensity and time range.
3. WHEN the user taps a bar THEN the chart SHALL show that hour's intensity and how a start at that hour compares with the best window.
4. Hours after the deadline SHALL be dimmed.
