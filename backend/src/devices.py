"""The devices a user can schedule, and how much energy each one draws."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Device:
    """One schedulable appliance.

    `kwh` is the total energy a single run consumes, not a rate.
    """

    id: str
    name: str
    kwh: float
    duration_hours: int


DEVICES = [
    Device(id="dishwasher", name="Dishwasher", kwh=1.5, duration_hours=2),
    Device(id="laundry", name="Washer + dryer", kwh=3.0, duration_hours=3),
    Device(id="ev", name="EV charge", kwh=40.0, duration_hours=8),
    Device(id="render", name="Render job", kwh=2.0, duration_hours=4),
]


def get_device(device_id: str) -> Device | None:
    """Look up one device by id."""
    return next((device for device in DEVICES if device.id == device_id), None)
