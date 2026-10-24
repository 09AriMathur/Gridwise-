# Implementation Plan: grid-connection

## Overview

Implement the single Electricity Maps boundary in place: a private `_get` helper plus `fetch_forecast` and `fetch_current` in `backend/src/grid_api.py`, and the `get_forecast` handler in `backend/src/routes.py`. The client returns the raw v3 response untouched and lets `requests` exceptions propagate; the route passes the zone through, returns the body unchanged, and maps upstream failures to HTTP 502/503 with no `sample_forecast.json` fallback. Existing signatures, module layout, and the single-boundary architecture are preserved. Tests use `pytest` and FastAPI's `TestClient`, mock the `requests` layer, use a fake key, and make no live network calls. No new dependencies.

## Tasks

- [x] 1. Implement the Electricity Maps client in `backend/src/grid_api.py`
  - [x] 1.1 Add the private `_get` helper
    - Add `def _get(path: str, zone: str) -> dict` that builds `f"{BASE_URL}/{path}"`, sets the `auth-token: API_KEY` header, passes `params={"zone": zone}` and `timeout=10`, calls `resp.raise_for_status()`, and returns `resp.json()` untouched (no reshaping)
    - Do not catch exceptions here — let `requests.Timeout`, `requests.ConnectionError`, and `requests.HTTPError` propagate to the caller
    - Never log the request headers or the API key
    - Keep module-level `BASE_URL`, `API_KEY`, `DEFAULT_ZONE` reads unchanged
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 5.1, 5.2, 5.4, 6.1, 6.2, 6.3, 6.4_

  - [x] 1.2 Implement `fetch_forecast` in place
    - Delegate to `_get("carbon-intensity/forecast", zone)` with the resolved zone, preserving the signature `fetch_forecast(zone: str = DEFAULT_ZONE) -> dict`
    - Document in the docstring that the return value is the raw v3 dict and that every datetime is UTC, ISO-8601 with a trailing `Z` (the UTC contract)
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 7.1_

  - [x] 1.3 Implement `fetch_current` in place
    - Delegate to `_get("carbon-intensity/latest", zone)` with the resolved zone, preserving the signature `fetch_current(zone: str = DEFAULT_ZONE) -> dict`
    - Document the same raw-dict return and UTC contract in the docstring
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 7.2_

  - [x] 1.4 Write client property test for endpoint/zone targeting
    - Patch `requests.get`; assert `fetch_forecast(zone)` targets the forecast endpoint and `fetch_current(zone)` the latest endpoint, both under `BASE_URL`, with the given zone as the `zone` param, across representative zone strings
    - **Feature: grid-connection, Property 1: Request targets the correct endpoint for the given zone**
    - **Validates: Requirements 1.1, 2.1**

  - [x] 1.5 Write client property test for raw passthrough
    - Patch `requests.get` so `.json()` returns representative dicts (including UTC `...Z` datetime strings); assert both functions return a dict equal to the input with no keys reshaped, filtered, or renamed and datetimes preserved exactly
    - **Feature: grid-connection, Property 2: Raw response is returned untouched**
    - **Validates: Requirements 1.3, 2.3, 3.2**

  - [x] 1.6 Write client unit tests for defaults, auth header, and config
    - Patch `requests.get` with a fake key; assert the `auth-token` header carries the fake key (1.4, 2.4), the default zone applies when called with no argument (1.2, 2.2), and `BASE_URL`/`DEFAULT_ZONE` env configuration resolves correctly including the unset defaults (6.1–6.4); assert the fake key never appears in logged output (5.4)
    - _Requirements: 1.2, 1.4, 2.2, 2.4, 5.4, 6.1, 6.2, 6.3, 6.4_

- [x] 2. Checkpoint - client implemented and tested
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement the `/api/forecast` route in `backend/src/routes.py`
  - [x] 3.1 Implement `get_forecast` as a thin pass-through
    - Preserve the signature `get_forecast(zone: str | None = None)`; call `fetch_forecast()` when `zone is None` (so `DEFAULT_ZONE` applies) and `fetch_forecast(zone)` otherwise, returning the client dict unchanged as the response body
    - Import `requests` and `HTTPException`; in ordered `except` clauses (most specific first) map `requests.Timeout` and `requests.ConnectionError` to HTTP 503, `requests.HTTPError` to HTTP 502, and any other `requests.RequestException` to HTTP 502
    - Use fixed, generic `detail` strings that never include the upstream body, request headers, or the API key; add no `sample_forecast.json` fallback branch
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.3, 7.3, 7.4_

  - [x] 3.2 Write route property test for zone forwarding and body passthrough
    - Use FastAPI `TestClient` and patch `src.routes.fetch_forecast`; assert the route calls `fetch_forecast` with the `zone` query value when present and with no argument when absent, and returns a body equal to the dict the client produced
    - **Feature: grid-connection, Property 3: The forecast route forwards the zone and returns the client body unchanged**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 3.3 Write route property test for failure -> 502/503 mapping
    - Patch `src.routes.fetch_forecast` to raise, across the full family of `requests` transport exceptions (`ConnectionError`, `Timeout`, other `RequestException`) and `requests.HTTPError` for a range of non-2xx statuses; assert the route responds with 502 or 503 (ConnectionError/Timeout -> 503, HTTPError/other -> 502)
    - **Feature: grid-connection, Property 4: Any upstream failure maps to HTTP 502 or 503**
    - **Validates: Requirements 4.4, 4.5**

  - [x] 3.4 Write route property test for no synthetic fallback
    - Patch `src.routes.fetch_forecast` to fail; assert the error response body contains none of the data from `backend/data/sample_forecast.json`
    - **Feature: grid-connection, Property 5: No synthetic fallback on failure**
    - **Validates: Requirements 4.6**

  - [x] 3.5 Write route property test for API key not leaking on failure
    - Configure a fake key, patch `src.routes.fetch_forecast` to fail; assert the fake key value appears neither in the error response body nor in any log output produced while handling the request
    - **Feature: grid-connection, Property 6: The API key never leaks on failure**
    - **Validates: Requirements 5.3, 5.4**

- [x] 4. Final checkpoint - route wired and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP.
- Property tests use parametrized/table-driven representative inputs (random zones, random JSON bodies, the exception family, a range of non-2xx statuses) rather than a property-based testing library, so no new dependency is introduced.
- Mock boundaries: patch `requests.get` for client tests, patch `src.routes.fetch_forecast` for route tests. No live network, fake key only.
- Run tests from `backend/` (`cd backend && pytest`) so the `src.` imports resolve.
- Each property test references its design property with the `Feature: grid-connection, Property N` tag for traceability.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "1.6", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5"] }
  ]
}
```
