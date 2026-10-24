# Design Document

## Overview

This slice implements the single boundary between the GridWise backend and the Electricity Maps API v3. It fills in the two stub functions in `backend/src/grid_api.py` (`fetch_forecast`, `fetch_current`) and the `get_forecast` handler in `backend/src/routes.py`.

The design preserves the existing single-boundary architecture: `grid_api.py` is the only module that calls Electricity Maps, the API key never leaves that module, and the client returns the raw v3 response dict without reshaping. The `/api/forecast` route is a thin pass-through that surfaces upstream failures as HTTP 502/503 rather than falling back to synthetic data.

Scope is strictly `backend/src/grid_api.py` and the `get_forecast` route in `backend/src/routes.py`. No signatures, module layout, or dependencies change.

### Divergence from `backend/skills.md`

`backend/skills.md` currently says "`grid_api.py` should normalize the API response to this shape." The clarified requirements for this slice (Requirement 1.3, 2.3, 3.2) state the opposite: the client returns the **raw** v3 response untouched, and normalization is the caller's responsibility (`routes.py` / `scheduler.py`). This design follows the requirements. The skills-file line is now stale; updating it is out of scope here and should be proposed to the user through the steering learning loop, not edited silently.

## Architecture

```
GET /api/forecast?zone=...  (routes.get_forecast)
        |  passes zone through, returns raw body, maps failures to 5xx
        v
grid_api.fetch_forecast(zone)      grid_api.fetch_current(zone)
        |                                   |
        |  GET {BASE_URL}/carbon-intensity/forecast?zone=...
        |  GET {BASE_URL}/carbon-intensity/latest?zone=...
        |  header: auth-token: <API_KEY>
        v
   Electricity Maps API v3  ->  raw JSON dict (returned untouched)
```

- The browser only talks to the backend; the backend is the only caller of Electricity Maps. This is unchanged.
- `grid_api.py` owns all `requests` usage against Electricity Maps and all reads of `ELECTRICITY_MAPS_API_KEY`.
- The route layer never reshapes the body. It passes `zone` down and the dict back up, translating transport/HTTP failures into FastAPI `HTTPException`s.

## Components and Interfaces

### `backend/src/grid_api.py` (Grid_Client)

Module-level configuration is read once at import time via `python-dotenv`, exactly as the current stub does. These names and defaults are unchanged:

```python
BASE_URL = os.getenv("ELECTRICITY_MAPS_BASE_URL", "https://api.electricitymap.org/v3")
API_KEY = os.getenv("ELECTRICITY_MAPS_API_KEY")
DEFAULT_ZONE = os.getenv("DEFAULT_ZONE", "US-NE-ISNE")
```

Endpoint paths (Electricity Maps v3, relative to `BASE_URL`):

- Forecast_Endpoint: `GET /carbon-intensity/forecast?zone={zone}`
- Current_Endpoint: `GET /carbon-intensity/latest?zone={zone}`

Authentication: the API key is sent in the Electricity Maps auth header `auth-token`. (v3 uses the `auth-token` request header for API-key auth; it is not a bearer token.)

```python
def fetch_forecast(zone: str = DEFAULT_ZONE) -> dict:
    """Hourly carbon intensity forecast for a zone.

    Returns the raw Electricity Maps v3 response as a dict, untouched.
    Every datetime in the response is UTC, ISO-8601 with a trailing 'Z'
    (the UTC contract); values are returned exactly as received.
    """

def fetch_current(zone: str = DEFAULT_ZONE) -> dict:
    """Carbon intensity right now, for a zone.

    Returns the raw Electricity Maps v3 response as a dict, untouched.
    Same UTC contract as fetch_forecast.
    """
```

Shared request behavior (a small private helper keeps the two functions consistent without changing their public signatures):

```python
def _get(path: str, zone: str) -> dict:
    url = f"{BASE_URL}/{path}"
    headers = {"auth-token": API_KEY}
    resp = requests.get(url, headers=headers, params={"zone": zone}, timeout=10)
    resp.raise_for_status()      # non-2xx -> requests.HTTPError
    return resp.json()           # raw dict, no reshaping
```

Both `fetch_forecast` and `fetch_current` delegate to `_get` with their respective path and the resolved zone. They do **not** catch exceptions: `requests.Timeout`, `requests.ConnectionError`, and `requests.HTTPError` propagate to the caller so the route can map them. This keeps the client thin and leaves the HTTP-status policy in one place (the route).

Signatures `fetch_forecast(zone=DEFAULT_ZONE) -> dict` and `fetch_current(zone=DEFAULT_ZONE) -> dict` are preserved exactly (Requirement 7.1, 7.2).

### `backend/src/routes.py` (Forecast_Route)

The handler keeps its existing signature and stays thin:

```python
from fastapi import APIRouter, HTTPException
import requests

from src.grid_api import fetch_forecast

@router.get("/forecast")
def get_forecast(zone: str | None = None):
    """Carbon intensity forecast for a grid zone."""
    try:
        if zone is None:
            return fetch_forecast()          # DEFAULT_ZONE applies
        return fetch_forecast(zone)          # pass the query param through
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="...")  # see note below
    except requests.ConnectionError:
        raise HTTPException(status_code=503, detail="Grid data source unreachable")
    except requests.HTTPError:
        raise HTTPException(status_code=502, detail="Grid data source returned an error")
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Grid data source request failed")
```

Notes on the status mapping:

- Requirement 4.4/4.5 require **502 or 503** for unreachable/timeout/non-2xx. To stay strictly within the required set, timeouts and connection errors both map to **503** (service unavailable) and non-2xx upstream responses map to **502** (bad gateway). The `504` shown above is illustrative only; the implementation will use 503 for timeouts to remain within the 502/503 contract.
- `detail` strings are fixed, generic messages. They never include the upstream response body, the request headers, or the API key (Requirement 5.3).
- No branch reads or returns `backend/data/sample_forecast.json`. There is no fallback path (Requirement 4.6).
- The `zone is None` check distinguishes "no query param" (let `DEFAULT_ZONE` apply via the client default) from an explicit zone, satisfying 4.2 and 4.3 without the route hard-coding the default.

`get_forecast(zone: str | None = None)` is preserved exactly (Requirement 7.3).

## Data Models

The client returns the Electricity Maps v3 response as a Python `dict`, deserialized with `resp.json()` and otherwise untouched. No model class is introduced; callers own interpretation and normalization.

- **Forecast response**: the v3 forecast body for a zone. Each entry carries a `datetime` and a carbon-intensity value. Exact key names are whatever v3 returns; the client does not rename them.
- **Current/latest response**: the v3 latest body for a zone, carrying a single reading with a `datetime` and a carbon-intensity value.
- **UTC contract**: every `datetime` value in a returned response is UTC, ISO-8601 formatted with a trailing `Z` (e.g. `2026-10-24T00:00:00Z`). The client returns these strings unmodified. This matches the shape used in `backend/data/sample_forecast.json` and `tests/test_scheduler.py`, so downstream conversion to Boston local time can rely on a single known format.

The route response body for a successful request is exactly the dict `fetch_forecast` returned. Error responses are FastAPI's standard `{"detail": "..."}` shape with a 502/503 status and no upstream content.

## Error Handling

All error policy lives in the route. The client lets `requests` exceptions propagate; the route maps them:

| Condition | Source exception | Route response |
|---|---|---|
| Electricity Maps host unreachable / DNS / connection refused | `requests.ConnectionError` | HTTP 503 |
| Request times out | `requests.Timeout` | HTTP 503 |
| Upstream returns non-2xx (from `raise_for_status`) | `requests.HTTPError` | HTTP 502 |
| Any other transport failure | `requests.RequestException` | HTTP 502 |

- `requests.Timeout` and `requests.ConnectionError` are subclasses of `requests.RequestException`, so the ordered `except` clauses (most specific first) resolve correctly.
- A `timeout=10` is set on every request so a hung upstream surfaces as `requests.Timeout` rather than blocking the worker.
- Error `detail` messages are static and generic. They do not interpolate the API key, request headers, or the upstream body, keeping secrets and raw upstream data out of client-facing errors (Requirement 5.3).
- No exception path reads or serves `sample_forecast.json` (Requirement 4.6).

### Secret handling

- `API_KEY` is read only from `ELECTRICITY_MAPS_API_KEY`, only in `grid_api.py` (Requirement 5.1, 5.2).
- The key is placed solely in the `auth-token` request header and never logged, never echoed into exceptions, and never included in any response body (Requirement 5.3, 5.4). The client does not log full request headers.

## Testing Strategy

Tests use `pytest` (already a dependency) and mock the `requests` layer so no live network call is made and no real API key is required. No new dependencies are introduced; `monkeypatch` and `unittest.mock` from the standard library plus FastAPI's `TestClient` (shipped with FastAPI/Starlette, already a dependency) cover everything. If a property-based testing library were ever wanted, that would require adding a dependency and must be asked first — so the property tests below are expressed as table/parametrized tests driven by representative generated inputs rather than requiring a new library.

Guidelines:

- **Mock boundaries**: patch `requests.get` (for `grid_api` unit tests) or patch `src.routes.fetch_forecast` (for route tests). Never hit the real API.
- **No real key**: tests set a fake key via `monkeypatch.setenv` or patch the module constant; assertions check the fake key is used in the `auth-token` header and never leaks.
- **Config read at import**: because `BASE_URL`/`API_KEY`/`DEFAULT_ZONE` are module-level, env-var tests either patch the module constants directly or reload the module after setting env vars.
- **Run location**: `cd backend && pytest` (the `src.` imports only resolve from `backend/`).
- Property tests run representative inputs (random zones, random JSON bodies, the full family of transport exceptions and a range of non-2xx statuses). Each property test references its design property with the tag **Feature: grid-connection, Property N: ...**.

Unit/example tests cover: default-zone resolution (1.2, 2.2, 4.3), auth header carries the key (1.4, 2.4), base-URL and default-zone configuration (6.1–6.4), and signature/boundary preservation (7.1–7.4, 5.1, 5.2) as smoke checks.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Request targets the correct endpoint for the given zone

For any zone string, calling `fetch_forecast(zone)` issues a GET to the forecast endpoint with that zone as the `zone` parameter, and calling `fetch_current(zone)` issues a GET to the latest/current endpoint with that zone — both against `BASE_URL`.

**Validates: Requirements 1.1, 2.1**

### Property 2: Raw response is returned untouched

For any JSON-serializable dict returned by a successful Electricity Maps response, `fetch_forecast` and `fetch_current` return a dict equal to it, with no keys reshaped, filtered, or renamed and all datetime strings (the UTC `...Z` values) preserved exactly.

**Validates: Requirements 1.3, 2.3, 3.2**

### Property 3: The forecast route forwards the zone and returns the client body unchanged

For any dict the client returns and any zone query value, `get_forecast` calls `fetch_forecast` with that zone (and with no zone argument when the query param is absent) and returns a response body equal to the dict the client produced.

**Validates: Requirements 4.1, 4.2**

### Property 4: Any upstream failure maps to HTTP 502 or 503

For any upstream failure — a transport exception (`requests.ConnectionError`, `requests.Timeout`, or any other `requests.RequestException`) or a non-2xx upstream status surfaced as `requests.HTTPError` — the forecast route responds with an HTTP status of 502 or 503.

**Validates: Requirements 4.4, 4.5**

### Property 5: No synthetic fallback on failure

For any upstream failure, the forecast route's response body contains none of the data from `backend/data/sample_forecast.json`.

**Validates: Requirements 4.6**

### Property 6: The API key never leaks on failure

For any upstream failure, the configured API key value appears neither in the route's error response body nor in any log output produced while handling the request.

**Validates: Requirements 5.3, 5.4**
