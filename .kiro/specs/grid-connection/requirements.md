# Requirements Document

## Introduction

This feature implements the grid connection slice of GridWise: the single boundary between the backend and the Electricity Maps API v3. It covers the two client functions in `backend/src/grid_api.py` (`fetch_forecast` and `fetch_current`) and the `/api/forecast` route in `backend/src/routes.py` that exposes the forecast to the frontend.

The slice establishes three contracts resolved during clarification:
1. When Electricity Maps is unreachable, the forecast route surfaces an upstream error (HTTP 502/503). There is no silent fallback to `sample_forecast.json`.
2. `fetch_forecast` and `fetch_current` return the raw Electricity Maps v3 response untouched. Normalization is the responsibility of callers (`routes.py` / `scheduler.py`), not the client.
3. `grid_api.py` documents and guarantees a UTC ISO-8601 (`...Z`) contract for the datetimes in the data it returns.

Scope is limited to `backend/src/grid_api.py` and the `/api/forecast` route in `backend/src/routes.py`. Existing function signatures, module structure, and the single-boundary architecture are preserved. The Electricity Maps API key stays confined to `grid_api.py` and never reaches the frontend.

## Glossary

- **Grid_Client**: The code in `backend/src/grid_api.py`, comprising the `fetch_forecast` and `fetch_current` functions. The single boundary that calls Electricity Maps.
- **Forecast_Route**: The `get_forecast` handler bound to `GET /api/forecast` in `backend/src/routes.py`.
- **Electricity_Maps**: The external Electricity Maps API v3, reachable at `ELECTRICITY_MAPS_BASE_URL` (default `https://api.electricitymap.org/v3`).
- **Zone**: An Electricity Maps grid zone identifier. The default is `US-NE-ISNE`, read from `DEFAULT_ZONE`.
- **API_Key**: The Electricity Maps credential, read from the `ELECTRICITY_MAPS_API_KEY` environment variable.
- **Raw_Response**: The JSON body returned by Electricity Maps v3, deserialized to a Python dict without reshaping, filtering, or renaming of keys.
- **UTC_Contract**: The guarantee that every datetime value in a Raw_Response returned by Grid_Client is UTC and ISO-8601 formatted with a trailing `Z`.
- **Forecast_Endpoint**: The Electricity Maps v3 carbon intensity forecast resource.
- **Current_Endpoint**: The Electricity Maps v3 latest (current) carbon intensity resource.

## Requirements

### Requirement 1: Fetch carbon intensity forecast

**User Story:** As a backend developer, I want `fetch_forecast` to retrieve the hourly carbon intensity forecast from Electricity Maps, so that the scheduler can choose the lowest-carbon window.

#### Acceptance Criteria

1. WHEN `fetch_forecast` is called, THE Grid_Client SHALL request the Forecast_Endpoint from Electricity_Maps using the provided Zone.
2. WHEN `fetch_forecast` is called without a zone argument, THE Grid_Client SHALL use the value of `DEFAULT_ZONE`.
3. WHEN Electricity_Maps returns a successful response, THE Grid_Client SHALL return the Raw_Response as a Python dict without reshaping, filtering, or renaming any keys.
4. THE Grid_Client SHALL send the API_Key in the request to the Forecast_Endpoint using the Electricity Maps authentication header.

### Requirement 2: Fetch current carbon intensity

**User Story:** As a backend developer, I want `fetch_current` to retrieve the current carbon intensity from Electricity Maps, so that the CO2-saved-versus-running-now comparison has a baseline.

#### Acceptance Criteria

1. WHEN `fetch_current` is called, THE Grid_Client SHALL request the Current_Endpoint from Electricity_Maps using the provided Zone.
2. WHEN `fetch_current` is called without a zone argument, THE Grid_Client SHALL use the value of `DEFAULT_ZONE`.
3. WHEN Electricity_Maps returns a successful response, THE Grid_Client SHALL return the Raw_Response as a Python dict without reshaping, filtering, or renaming any keys.
4. THE Grid_Client SHALL send the API_Key in the request to the Current_Endpoint using the Electricity Maps authentication header.

### Requirement 3: Documented UTC datetime contract

**User Story:** As a consumer of the grid client, I want a documented UTC datetime contract, so that downstream timezone conversion can rely on a single known format.

#### Acceptance Criteria

1. THE Grid_Client SHALL document that every datetime value in a Raw_Response it returns is UTC and ISO-8601 formatted with a trailing `Z`.
2. THE Grid_Client SHALL return datetime values from Electricity_Maps unmodified, preserving the UTC_Contract.

### Requirement 4: Surface upstream failures, no silent fallback

**User Story:** As a frontend user, I want the forecast route to report upstream failures clearly, so that I am never shown synthetic data as if it were a real grid reading.

#### Acceptance Criteria

1. WHEN a request reaches the Forecast_Route, THE Forecast_Route SHALL call `fetch_forecast` and return the Raw_Response as the response body.
2. WHEN the Forecast_Route receives a `zone` query parameter, THE Forecast_Route SHALL pass that value to `fetch_forecast`.
3. WHEN the Forecast_Route receives no `zone` query parameter, THE Forecast_Route SHALL call `fetch_forecast` without a zone argument so that `DEFAULT_ZONE` applies.
4. IF the call to Electricity_Maps fails because Electricity_Maps is unreachable or times out, THEN THE Forecast_Route SHALL respond with HTTP status 502 or 503.
5. IF the call to Electricity_Maps returns an unsuccessful HTTP status, THEN THE Forecast_Route SHALL respond with HTTP status 502 or 503.
6. IF a request to Electricity_Maps fails, THEN THE Forecast_Route SHALL return no data from `backend/data/sample_forecast.json`.

### Requirement 5: Confine the API key to the grid client

**User Story:** As the project maintainer, I want the API key confined to the grid client, so that the credential never reaches the browser or the version control history.

#### Acceptance Criteria

1. THE Grid_Client SHALL read the API_Key only from the `ELECTRICITY_MAPS_API_KEY` environment variable.
2. THE Grid_Client SHALL be the only module that reads the API_Key.
3. IF the Forecast_Route returns an error response, THEN THE Forecast_Route SHALL exclude the API_Key value from the response body.
4. THE Grid_Client SHALL exclude the API_Key value from log output.

### Requirement 6: Configure the grid client via environment variables

**User Story:** As a backend developer, I want the grid client configured through environment variables, so that the base URL and default zone can change without editing code.

#### Acceptance Criteria

1. THE Grid_Client SHALL read the Electricity Maps base URL from the `ELECTRICITY_MAPS_BASE_URL` environment variable.
2. WHERE `ELECTRICITY_MAPS_BASE_URL` is unset, THE Grid_Client SHALL use `https://api.electricitymap.org/v3`.
3. THE Grid_Client SHALL read the default zone from the `DEFAULT_ZONE` environment variable.
4. WHERE `DEFAULT_ZONE` is unset, THE Grid_Client SHALL use `US-NE-ISNE`.

### Requirement 7: Preserve existing signatures and module layout

**User Story:** As the project maintainer, I want the existing signatures and module layout preserved, so that the change stays a minimal in-place implementation.

#### Acceptance Criteria

1. THE Grid_Client SHALL keep the signature `fetch_forecast(zone=DEFAULT_ZONE) -> dict`.
2. THE Grid_Client SHALL keep the signature `fetch_current(zone=DEFAULT_ZONE) -> dict`.
3. THE Forecast_Route SHALL keep the signature `get_forecast(zone: str | None = None)`.
4. THE Grid_Client SHALL remain the single module in the backend that calls Electricity_Maps.
