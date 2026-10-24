# Requirements: Savings, Rates and Demo Data

## Introduction

Shifting a run changes its carbon footprint, but its cost only changes on a time-of-use (TOU) plan. Electricity Maps has no retail or day-ahead price data for ISO-NE on this key, so prices come from the user's bill. This spec also covers the committed demo dataset that fills a fresh browser.

## Requirements

### Requirement 1: Electricity rates

**User Story:** As a user, I want to enter my electricity rates, so that GridWise shows real money figures for my plan.

#### Acceptance Criteria
1. The system SHALL let the user choose a flat rate, or a TOU plan: peak and off-peak $/kWh, peak start and end times, and a "weekdays only" switch.
2. WHEN no rates have been saved THEN the system SHALL use a placeholder rate AND SHALL label it "placeholder" wherever money appears.
3. WHEN a TOU peak period crosses midnight (e.g. 22:00–06:00) THEN the rate lookup SHALL handle it.
4. Rates SHALL be stored in the browser only.

### Requirement 2: Money in recommendations

**User Story:** As a user on a TOU plan, I want to see how much a recommended window saves compared with running now.

#### Acceptance Criteria
1. WHEN the plan is TOU THEN the recommendation SHALL show "Saved $X vs $Y now". The cost SHALL be calculated by charging each 5-minute slice at the rate in force then.
2. WHEN the cleanest window costs more than running now THEN the system SHALL say so ("Extra") rather than hide it.
3. WHEN the plan is flat THEN the system SHALL show the cost per run AND SHALL say that timing doesn't change the bill.
4. WHEN a window is scheduled THEN the money saved SHALL be stored with the task. My Home and the Dashboard banner SHALL add up totals from stored tasks, never from hard-coded figures.

### Requirement 3: Demo data

**User Story:** As a teammate or judge opening GridWise for the first time, I want sample data already loaded, so that I can see every feature without setup.

#### Acceptance Criteria
1. The dataset SHALL live in a committed file, `frontend/src/data/demo-data.json`.
2. WHEN a browser opens GridWise for the first time AND has no tasks or devices of its own AND `VITE_DEMO_DATA` is not `false` THEN the system SHALL load the demo data automatically.
3. Times in the dataset SHALL be relative (minutes from now, or a day offset plus a clock time), so the demo never goes stale.
4. CO₂ and money SHALL be computed from the dataset's rates and intensities when it loads.
5. WHEN the user's own data exists, or they have reset, THEN the demo SHALL NOT overwrite it on reload.
6. My Home SHALL offer "Load Demo Data" and "Reset Everything".
