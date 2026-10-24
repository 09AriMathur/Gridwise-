# Implementation Plan: Live Grid Scheduling

- [x] 1. Implement the Electricity Maps client in `backend/src/grid_api.py`
  - `fetch_forecast`, `fetch_current`, normalise timestamps to `…Z`; raise on a missing key
  - _Requirements: 1.1, 1.4_
- [x] 2. Move to Electricity Maps v4 (`https://api.electricitymaps.com/v4`) in code, `.env.example` and `.env`
  - _Requirements: 1.1_
- [x] 3. `GET /api/forecast` with a synthetic fallback shifted to the current hour
  - _Requirements: 1.1, 1.2, 1.3_
- [x] 4. `POST /api/schedule` accepting the frontend request shape; exact-duration window starting no earlier than now; like-for-like "now" baseline
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
- [x] 5. Browser fallback planner (`lib/optimizer.findBestWindow`) and the "Planned on this device" label
  - _Requirements: 2.5_
- [x] 6. Forecast charts coloured by level, best-window highlight, bar selection, dimmed hours after the deadline
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
- [x] 7. Route tests with the network stubbed
  - _Requirements: 1, 2_
- [ ] 8. Serve 15-minute forecasts and schedule in 15-minute steps (see `.kiro/specs/fifteen-minute-and-location/`)
