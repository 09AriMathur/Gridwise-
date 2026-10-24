# Implementation Plan: Savings, Rates and Demo Data

- [x] 1. Rate model and maths in `frontend/src/lib/rates.ts` (`rateAt`, `runCost`, `moneySaved`)
  - _Requirements: 1.1, 1.3, 2.1_
- [x] 2. `RatesPanel` in My Home with a placeholder flag and validation
  - _Requirements: 1.1, 1.2, 1.4_
- [x] 3. Money tile in the Dashboard recommendation (Saved / Extra / Cost), flat-rate explanation
  - _Requirements: 2.1, 2.2, 2.3_
- [x] 4. Store `money` on scheduled tasks; totals in the My Home stat and the Dashboard banner
  - _Requirements: 2.4_
- [x] 5. Demo dataset as committed JSON with relative times; `loadDemo` / `resetAll`
  - _Requirements: 3.1, 3.3, 3.4, 3.6_
- [x] 6. Seed on first run, honouring `VITE_DEMO_DATA` and existing data
  - _Requirements: 3.2, 3.5_
- [ ] 7. Optional: read real TOU tariffs (e.g. utility rate APIs) instead of manual entry
- [ ] 8. Optional: sync rates and tasks across devices through a backend tasks table
