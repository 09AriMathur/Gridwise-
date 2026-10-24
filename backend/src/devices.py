"""The devices a user can schedule, and how much energy each one draws."""

DEVICES = [
    {"id": "dishwasher", "name": "Dishwasher", "kwh": 1.5, "duration_hours": 2},
    {"id": "laundry", "name": "Washer + dryer", "kwh": 3.0, "duration_hours": 3},
    {"id": "ev", "name": "EV charge", "kwh": 40.0, "duration_hours": 8},
    {"id": "render", "name": "Render job", "kwh": 2.0, "duration_hours": 4},
]


def get_device(device_id: str) -> dict | None:
    """Look up one device by id."""
    raise NotImplementedError
