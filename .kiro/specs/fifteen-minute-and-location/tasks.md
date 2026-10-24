# Implementation Plan: 15-Minute Scheduling and Location (Planned)

- [ ] 1. `best_window` infers the step from the data; add 15-minute tests; existing hourly tests unchanged
  - _Requirements: 1.1, 1.2_
- [ ] 2. `fetch_forecast` with `temporalGranularity=15_minutes`; `routes.post_schedule`, `backtest` and `mix` use the inferred step
  - _Requirements: 1.1, 1.2_
- [ ] 3. Frontend `avgIntensity` weights points by their real span; `ForecastBars` averages to hours for display
  - _Requirements: 1.3, 1.4_
- [ ] 4. `lib/location.ts` with browser geolocation and a fallback to `DEFAULT_ZONE`
  - _Requirements: 2.1_
- [ ] 5. Pass `lat` / `lon` through `api.ts` → routes → `grid_api._get`; return and use the resolved zone
  - _Requirements: 2.1, 2.2, 2.4_
- [ ] 6. `lib/time.ts` formats in the browser's timezone
  - _Requirements: 2.3_
- [ ] 7. Update `.kiro/steering/project.md` (Decisions, Open Questions) and the skills files when done
